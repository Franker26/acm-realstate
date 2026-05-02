import asyncio
import json
import logging
import os
import re
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger("acm")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")

STEP_ORDER = ["sujeto", "comparables", "ponderadores", "resultados", "exportar"]
STAGE_ORDER = ["nuevo", "en_progreso", "finalizado", "cancelado"]

_STAGE_MIGRATION = {
    "Borrador": "nuevo",
    "En progreso": "en_progreso",
    "Finalizado": "finalizado",
    "Cancelado": "cancelado",
}

import httpx
from bs4 import BeautifulSoup
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
import bcrypt as _bcrypt_lib
from pydantic import BaseModel as PydanticBase
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

import calculator as calc
from models import (
    ACM,
    AppSetting,
    ApprovalComment,
    ApprovalStatus,
    Base,
    Comparable,
    Company,
    CompanySetting,
    PlatformSetting,
    SessionLocal,
    StageACM,
    User,
    engine,
)
# --- Auth config ---

_SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-production")
_ALGORITHM = "HS256"
_TOKEN_EXPIRE_DAYS = 7

# Rutas que no requieren token
_PUBLIC_PATHS = {
    "/api/auth/login",
    "/api/admin/login",
    "/api/ponderadores/defaults",
    "/api/settings/branding",
}


def _hash_password(pw: str) -> str:
    return _bcrypt_lib.hashpw(pw.encode(), _bcrypt_lib.gensalt()).decode()


def _verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt_lib.checkpw(plain.encode(), hashed.encode())


def _create_token(username: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": username, "exp": exp}, _SECRET_KEY, algorithm=_ALGORITHM)


def _decode_token(token: str) -> str:
    payload = jwt.decode(token, _SECRET_KEY, algorithms=[_ALGORITHM])
    username = payload.get("sub")
    if not username:
        raise JWTError("no sub")
    return username


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in _PUBLIC_PATHS or not request.url.path.startswith("/api/"):
            return await call_next(request)
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return JSONResponse({"detail": "No autenticado"}, status_code=401)
        try:
            _decode_token(auth.split(" ", 1)[1])
        except JWTError:
            return JSONResponse({"detail": "Token inválido o expirado"}, status_code=401)
        return await call_next(request)
from schemas import (
    ACMCreate,
    ACMRead,
    ACMSummary,
    ACMUpdate,
    AdminUserCreate,
    ApprovalCommentRead,
    ApprovalReviewRequest,
    BrandingSettings,
    ComparableCreate,
    ComparableRead,
    ComparableResultado,
    ComparableUpdate,
    CompanyCreate,
    CompanyRead,
    CompanyUpdate,
    PonderadoresDefaults,
    ResultadoResponse,
    StageUpdateRequest,
    StepUpdateRequest,
    UserCreate,
    UserRead,
    UserUpdate,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        # Column migrations — each statement is tried individually.
        # "duplicate column" errors are caught and ignored (idempotent).
        # IF NOT EXISTS is omitted for SQLite compatibility.
        for stmt in (
            "ALTER TABLE acm ALTER COLUMN stage TYPE VARCHAR USING stage::text",  # PG only, ignored on SQLite
            "ALTER TABLE acm ADD COLUMN current_step VARCHAR DEFAULT 'sujeto'",
            "ALTER TABLE acm ADD COLUMN steps_completed VARCHAR DEFAULT '[]'",
            "ALTER TABLE acm ADD COLUMN deleted_at TIMESTAMP",
            "ALTER TABLE users ADD COLUMN is_superadmin BOOLEAN DEFAULT 0",
            "ALTER TABLE users ADD COLUMN company_id INTEGER",
            "ALTER TABLE acm ADD COLUMN company_id INTEGER",
            "ALTER TABLE acm ADD COLUMN approval_status VARCHAR DEFAULT 'No requerida'",
            "ALTER TABLE acm ADD COLUMN approved_by_id INTEGER",
            "ALTER TABLE acm ADD COLUMN approved_at TIMESTAMP",
        ):
            try:
                db.execute(text(stmt))
                db.commit()
            except Exception:
                db.rollback()

        for acm in db.query(ACM).all():
            if acm.updated_at is None:
                acm.updated_at = acm.fecha_creacion
            if acm.approval_status is None:
                _mark_acm_pending_if_required(acm)
            if acm.stage in _STAGE_MIGRATION:
                acm.stage = _STAGE_MIGRATION[acm.stage]
            if not acm.current_step:
                acm.current_step = "sujeto"
            if not acm.steps_completed:
                acm.steps_completed = "[]"
        db.commit()

        # --- Multi-tenant bootstrap ---
        # 1. Create default company if none exist
        if db.query(Company).count() == 0:
            default_co = Company(name="Default")
            db.add(default_co)
            db.commit()
            db.refresh(default_co)
        else:
            default_co = db.query(Company).order_by(Company.id).first()

        default_cid = default_co.id

        # 2. Assign users without company to default
        db.query(User).filter(User.company_id.is_(None)).update(
            {User.company_id: default_cid}, synchronize_session=False
        )
        db.commit()

        # 3. Assign ACMs without company to default
        db.query(ACM).filter(ACM.company_id.is_(None)).update(
            {ACM.company_id: default_cid}, synchronize_session=False
        )
        db.commit()

        # 4. Copy legacy AppSetting → CompanySetting for default company
        for setting in db.query(AppSetting).all():
            exists = db.query(CompanySetting).filter(
                CompanySetting.company_id == default_cid,
                CompanySetting.key == setting.key,
            ).first()
            if not exists:
                db.add(CompanySetting(
                    company_id=default_cid,
                    key=setting.key,
                    value=setting.value,
                ))
        db.commit()

        # 5. Bootstrap superadmin from env vars (only if none exists)
        sa_user = os.getenv("SUPERADMIN_USERNAME")
        sa_pass = os.getenv("SUPERADMIN_PASSWORD")
        if sa_user and sa_pass:
            exists = db.query(User).filter(User.is_superadmin.is_(True)).first()
            if not exists:
                db.add(User(
                    username=sa_user,
                    hashed_password=_hash_password(sa_pass),
                    is_superadmin=True,
                    is_admin=False,
                    company_id=None,
                ))
                db.commit()
    yield


app = FastAPI(title="ACM Real Estate API", lifespan=lifespan)

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(AuthMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- Auth endpoints ---

class LoginRequest(PydanticBase):
    username: str
    password: str


@app.post("/api/auth/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not _verify_password(body.password, user.hashed_password):
        raise HTTPException(401, "Usuario o contraseña incorrectos")
    if user.is_superadmin:
        raise HTTPException(403, "Acceso de superadmin no permitido desde esta pantalla. Usá /admin.")
    return {
        "access_token": _create_token(user.username),
        "token_type": "bearer",
        "username": user.username,
        "is_admin": user.is_admin,
        "is_approver": user.is_approver,
        "needs_approval": user.needs_approval,
        "company_id": user.company_id,
        "company_name": user.company.name if user.company else None,
    }


@app.get("/api/auth/me")
def me(request: Request, db: Session = Depends(get_db)):
    user = _current_user(request, db)
    return {
        "id": user.id,
        "username": user.username,
        "is_admin": user.is_admin,
        "is_approver": user.is_approver,
        "needs_approval": user.needs_approval,
        "company_id": user.company_id,
        "company_name": user.company.name if user.company else None,
    }


# --- User management ---

def _current_user(request: Request, db: Session) -> User:
    token = request.headers.get("Authorization", "").split(" ", 1)[-1]
    try:
        username = _decode_token(token)
    except JWTError:
        raise HTTPException(401, "Token inválido")
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(401, "Usuario no encontrado")
    return user


def _require_admin(request: Request, db: Session) -> User:
    user = _current_user(request, db)
    if not user.is_admin:
        raise HTTPException(403, "Se requieren permisos de administrador")
    return user


def _require_approver(request: Request, db: Session) -> User:
    user = _current_user(request, db)
    if not user.is_admin or not user.is_approver:
        raise HTTPException(403, "Se requieren permisos de approver")
    return user


def _require_superadmin(request: Request, db: Session) -> User:
    user = _current_user(request, db)
    if not user.is_superadmin:
        raise HTTPException(403, "Se requieren permisos de superadmin")
    return user


def _get_company_setting(db: Session, company_id: int, key: str) -> Optional[str]:
    s = db.query(CompanySetting).filter(
        CompanySetting.company_id == company_id,
        CompanySetting.key == key,
    ).first()
    return s.value if s else None


def _save_company_setting(db: Session, company_id: int, key: str, value: str) -> None:
    s = db.query(CompanySetting).filter(
        CompanySetting.company_id == company_id,
        CompanySetting.key == key,
    ).first()
    if not s:
        s = CompanySetting(company_id=company_id, key=key)
        db.add(s)
    s.value = value
    db.commit()


def _get_platform_setting(db: Session, key: str) -> Optional[str]:
    s = db.query(PlatformSetting).filter(PlatformSetting.key == key).first()
    return s.value if s else None


def _save_platform_setting(db: Session, key: str, value: str) -> None:
    s = db.query(PlatformSetting).filter(PlatformSetting.key == key).first()
    if not s:
        s = PlatformSetting(key=key)
        db.add(s)
    s.value = value
    db.commit()


def _get_scraper_settings(db: Session) -> dict:
    """Read global scraper settings with env var fallback."""
    return {
        "scraper_service_url": _get_platform_setting(db, "scraper_service_url") or _SCRAPER_SERVICE_URL,
        "scraper_service_token": _get_platform_setting(db, "scraper_service_token") or _SCRAPER_SERVICE_TOKEN,
    }


def _serialize_user(user: User) -> UserRead:
    return UserRead(
        id=user.id,
        username=user.username,
        is_admin=user.is_admin,
        is_approver=user.is_approver,
        needs_approval=user.needs_approval,
        company_id=user.company_id,
    )


class ChangePasswordRequest(PydanticBase):
    new_password: str


@app.get("/api/users", response_model=list[UserRead])
def list_users(request: Request, db: Session = Depends(get_db)):
    current = _require_admin(request, db)
    users = (
        db.query(User)
        .filter(User.company_id == current.company_id, User.is_superadmin.is_(False))
        .order_by(User.id)
        .all()
    )
    return [_serialize_user(u) for u in users]


@app.post("/api/users", response_model=UserRead, status_code=201)
def create_user(body: UserCreate, request: Request, db: Session = Depends(get_db)):
    current = _require_admin(request, db)
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(409, f"El usuario '{body.username}' ya existe")
    user = User(
        username=body.username,
        hashed_password=_hash_password(body.password),
        is_admin=body.is_admin,
        is_approver=body.is_approver,
        needs_approval=body.needs_approval,
        company_id=current.company_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _serialize_user(user)


@app.patch("/api/users/{user_id}", response_model=UserRead)
def update_user(user_id: int, body: UserUpdate, request: Request, db: Session = Depends(get_db)):
    current = _require_admin(request, db)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")

    data = body.model_dump(exclude_none=True)
    next_is_admin = data.get("is_admin", user.is_admin)
    next_is_approver = data.get("is_approver", user.is_approver)
    if next_is_approver and not next_is_admin:
        raise HTTPException(400, "Un approver también debe ser admin")
    if current.id == user_id and "is_admin" in data and not next_is_admin:
        raise HTTPException(400, "No podés quitarte el rol de admin")
    if current.id == user_id and "is_approver" in data and not next_is_approver:
        raise HTTPException(400, "No podés quitarte el rol de approver")

    for field, value in data.items():
        setattr(user, field, value)
    if "needs_approval" in data:
        for acm in user.acms:
            _mark_acm_pending_if_required(acm)
    db.commit()
    db.refresh(user)
    return _serialize_user(user)


@app.delete("/api/users/{user_id}", status_code=204)
def delete_user(user_id: int, request: Request, db: Session = Depends(get_db)):
    current = _require_admin(request, db)
    if current.id == user_id:
        raise HTTPException(400, "No podés eliminar tu propio usuario")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    db.delete(user)
    db.commit()


@app.put("/api/users/{user_id}/password", status_code=204)
def change_user_password(user_id: int, body: ChangePasswordRequest, request: Request, db: Session = Depends(get_db)):
    current = _current_user(request, db)
    if not current.is_admin and current.id != user_id:
        raise HTTPException(403, "Sin permisos")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    user.hashed_password = _hash_password(body.new_password)
    db.commit()


@app.get("/api/settings/branding", response_model=BrandingSettings)
def get_branding_settings(request: Request, db: Session = Depends(get_db)):
    # Public endpoint: try to get company from auth token, fallback to first company
    company_id: Optional[int] = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            username = _decode_token(auth.split(" ", 1)[1])
            user = db.query(User).filter(User.username == username).first()
            if user:
                company_id = user.company_id
        except Exception:
            pass
    return _get_branding_settings(db, company_id)


@app.put("/api/settings/branding", response_model=BrandingSettings)
def update_branding_settings(body: BrandingSettings, request: Request, db: Session = Depends(get_db)):
    current = _require_admin(request, db)
    _save_branding_settings(body, db, current.company_id)
    return _get_branding_settings(db, current.company_id)


_SENSITIVE_SETTING_KEYS = {"scraper_service_token"}


@app.get("/api/settings/integrations/status")
def get_integration_status(request: Request, db: Session = Depends(get_db)):
    """Return connection status for each source (clients can see this, no credentials)."""
    _current_user(request, db)
    scraper = _get_scraper_settings(db)
    scraper_url = scraper.get("scraper_service_url", "").strip() if scraper.get("scraper_service_url") else ""
    return {
        "scraper_configured": bool(scraper_url),
        "sources": [
            {"name": "Zonaprop", "key": "zonaprop", "available": bool(scraper_url)},
            {"name": "Argenprop", "key": "argenprop", "available": bool(scraper_url)},
            {"name": "MercadoLibre", "key": "mercadolibre", "available": bool(scraper_url)},
        ],
    }


@app.get("/api/settings/params")
def get_system_params(request: Request, db: Session = Depends(get_db)):
    current = _require_admin(request, db)
    settings = (
        db.query(CompanySetting)
        .filter(CompanySetting.company_id == current.company_id)
        .order_by(CompanySetting.key)
        .all()
    )
    return [
        {
            "key": s.key,
            "value": "***" if s.key in _SENSITIVE_SETTING_KEYS and s.value else (s.value or ""),
        }
        for s in settings
    ]


def _parse_steps(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        return json.loads(raw)
    except Exception:
        return []


def _get_acm_or_404(acm_id: int, db: Session) -> ACM:
    acm = db.query(ACM).filter(ACM.id == acm_id, ACM.deleted_at.is_(None)).first()
    if not acm:
        raise HTTPException(status_code=404, detail=f"ACM {acm_id} no encontrado")
    return acm


def _get_comparable_or_404(acm_id: int, cid: int, db: Session) -> Comparable:
    comp = db.query(Comparable).filter(
        Comparable.id == cid, Comparable.acm_id == acm_id
    ).first()
    if not comp:
        raise HTTPException(status_code=404, detail=f"Comparable {cid} no encontrado")
    return comp


def _requires_approval(acm: ACM) -> bool:
    return bool(acm.owner and acm.owner.needs_approval)


def _serialize_approval_comment(comment: ApprovalComment) -> ApprovalCommentRead:
    data = ApprovalCommentRead.model_validate(comment)
    data.author_username = comment.author.username if comment.author else None
    return data


def _mark_acm_pending_if_required(acm: ACM):
    if _requires_approval(acm):
        # Only transition to pending if not already in an active approval state
        if acm.approval_status == ApprovalStatus.no_requerida:
            acm.approval_status = ApprovalStatus.pendiente
    else:
        acm.approval_status = ApprovalStatus.no_requerida
        acm.approved_by_id = None
        acm.approved_at = None


_BRANDING_DEFAULTS = {
    "app_name": "ACM Real Estate",
    "primary_color": "#1a3a5c",
    "logo_data_url": None,
}


def _get_first_company_id(db: Session) -> Optional[int]:
    co = db.query(Company).order_by(Company.id).first()
    return co.id if co else None


def _get_branding_settings(db: Session, company_id: Optional[int] = None) -> BrandingSettings:
    cid = company_id or _get_first_company_id(db)
    payload = {}
    for key, default in _BRANDING_DEFAULTS.items():
        val = _get_company_setting(db, cid, key) if cid else None
        payload[key] = val if val is not None else default
    return BrandingSettings(**payload)


def _save_branding_settings(body: BrandingSettings, db: Session, company_id: int) -> None:
    for key, value in body.model_dump().items():
        _save_company_setting(db, company_id, key, value if value is not None else "")


def _make_snapshot(obj) -> calc.PropertySnapshot:
    return calc.PropertySnapshot(
        superficie_cubierta=obj.superficie_cubierta,
        superficie_semicubierta=getattr(obj, "superficie_semicubierta", None),
        superficie_descubierta=getattr(obj, "superficie_descubierta", None),
        piso=obj.piso,
        antiguedad=obj.antiguedad,
        orientacion=obj.orientacion,
        estado=obj.estado,
        calidad=obj.calidad,
        distribucion=obj.distribucion,
        cochera=getattr(obj, "cochera", None),
        pileta=getattr(obj, "pileta", None),
    )


def _enrich_comparable(acm: ACM, comp: Comparable) -> ComparableRead:
    subject = _make_snapshot(acm)
    comp_snap = _make_snapshot(comp)
    overrides = {
        "factor_antiguedad": comp.factor_antiguedad,
        "factor_estado": comp.factor_estado,
        "factor_calidad": comp.factor_calidad,
        "factor_superficie": comp.factor_superficie,
        "factor_piso": comp.factor_piso,
        "factor_orientacion": comp.factor_orientacion,
        "factor_distribucion": comp.factor_distribucion,
        "factor_oferta": comp.factor_oferta,
        "factor_oportunidad": comp.factor_oportunidad,
        "factor_cochera": comp.factor_cochera,
        "factor_pileta": comp.factor_pileta,
        "factor_luminosidad": comp.factor_luminosidad,
        "factor_vistas": comp.factor_vistas,
        "factor_amenities": comp.factor_amenities,
    }
    result = calc.compute_adjusted_price(
        subject=subject,
        comp=comp_snap,
        precio=comp.precio,
        dias_mercado=comp.dias_mercado,
        oportunidad_mercado=comp.oportunidad_mercado or False,
        overrides=overrides,
    )
    data = ComparableRead.model_validate(comp)
    data.precio_m2_publicado = result["precio_m2_publicado"]
    data.precio_ajustado_m2 = result["precio_ajustado_m2"]
    return data


# --- ACM endpoints ---

_COMPUTED_FIELDS = {"superficie_homogeneizada"}


def _get_acm_checked(acm_id: int, request: Request, db: Session) -> ACM:
    current = _current_user(request, db)
    acm = _get_acm_or_404(acm_id, db)
    _check_acm_access(acm, current)
    return acm


def _check_acm_access(acm: ACM, current: User):
    if acm.company_id != current.company_id:
        raise HTTPException(403, "Sin acceso a este ACM")
    if not current.is_admin and acm.owner_id != current.id:
        raise HTTPException(403, "Sin acceso a este ACM")


@app.post("/api/acm", response_model=ACMRead, status_code=201)
def create_acm(body: ACMCreate, request: Request, db: Session = Depends(get_db)):
    current = _current_user(request, db)
    acm = ACM(**body.model_dump(exclude=_COMPUTED_FIELDS), owner_id=current.id, company_id=current.company_id)
    _mark_acm_pending_if_required(acm)
    db.add(acm)
    db.commit()
    db.refresh(acm)
    return _build_acm_read(acm)


@app.get("/api/acm/stages")
def get_stages():
    """Ordered stage list — single source of truth for frontend."""
    return {"stages": STAGE_ORDER}


@app.get("/api/acm", response_model=list[ACMSummary])
def list_acms(request: Request, db: Session = Depends(get_db)):
    current = _current_user(request, db)
    query = (
        db.query(ACM)
        .filter(ACM.deleted_at.is_(None), ACM.company_id == current.company_id)
        .order_by(ACM.fecha_creacion.desc())
    )
    if not current.is_admin:
        query = query.filter(ACM.owner_id == current.id)
    result = []
    for acm in query.all():
        s = ACMSummary.model_validate(acm)
        s.cantidad_comparables = len(acm.comparables)
        s.owner_username = acm.owner.username if acm.owner else None
        s.requires_approval = _requires_approval(acm)
        result.append(s)
    return result


@app.get("/api/acm/{acm_id}", response_model=ACMRead)
def get_acm(acm_id: int, request: Request, db: Session = Depends(get_db)):
    current = _current_user(request, db)
    acm = _get_acm_or_404(acm_id, db)
    _check_acm_access(acm, current)
    return _build_acm_read(acm)


@app.patch("/api/acm/{acm_id}", response_model=ACMRead)
def update_acm(acm_id: int, body: ACMUpdate, request: Request, db: Session = Depends(get_db)):
    current = _current_user(request, db)
    acm = _get_acm_or_404(acm_id, db)
    _check_acm_access(acm, current)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(acm, field, value)
    if body.model_dump(exclude_none=True):
        _mark_acm_pending_if_required(acm)
    db.commit()
    db.refresh(acm)
    return _build_acm_read(acm)


@app.delete("/api/acm/{acm_id}", status_code=204)
def delete_acm(acm_id: int, request: Request, db: Session = Depends(get_db)):
    current = _current_user(request, db)
    acm = _get_acm_or_404(acm_id, db)
    _check_acm_access(acm, current)
    acm.deleted_at = datetime.utcnow()
    db.commit()
    logger.info("soft_delete acm=%d by=%s", acm_id, current.username)


@app.patch("/api/acm/{acm_id}/stage", response_model=ACMRead)
def update_stage(acm_id: int, body: StageUpdateRequest, request: Request, db: Session = Depends(get_db)):
    if body.stage not in STAGE_ORDER:
        raise HTTPException(400, f"Etapa inválida: '{body.stage}'. Válidas: {STAGE_ORDER}")
    acm = _get_acm_checked(acm_id, request, db)
    old_stage = acm.stage
    acm.stage = body.stage
    _mark_acm_pending_if_required(acm)
    db.commit()
    db.refresh(acm)
    logger.info("stage_change acm=%d %s→%s", acm_id, old_stage, body.stage)
    return _build_acm_read(acm)


@app.patch("/api/acm/{acm_id}/step", response_model=ACMRead)
def update_step(acm_id: int, body: StepUpdateRequest, request: Request, db: Session = Depends(get_db)):
    if body.step not in STEP_ORDER:
        raise HTTPException(400, f"Step inválido: '{body.step}'. Válidos: {STEP_ORDER}")
    acm = _get_acm_checked(acm_id, request, db)
    steps = _parse_steps(acm.steps_completed)
    if body.completed:
        if body.step not in steps:
            steps.append(body.step)
    else:
        steps = [s for s in steps if s != body.step]
    acm.steps_completed = json.dumps(steps)
    acm.current_step = body.step
    db.commit()
    db.refresh(acm)
    logger.info("step_update acm=%d step=%s completed=%s", acm_id, body.step, body.completed)
    return _build_acm_read(acm)


def _build_acm_read(acm: ACM) -> ACMRead:
    enriched = [_enrich_comparable(acm, c) for c in acm.comparables]
    data = ACMRead.model_validate(acm)
    data.owner_username = acm.owner.username if acm.owner else None
    data.requires_approval = _requires_approval(acm)
    data.comparables = enriched
    data.approval_comments = [_serialize_approval_comment(c) for c in acm.approval_comments]
    return data


# --- Comparable endpoints ---

@app.post("/api/acm/{acm_id}/comparable", response_model=ComparableRead, status_code=201)
def add_comparable(acm_id: int, body: ComparableCreate, request: Request, db: Session = Depends(get_db)):
    acm = _get_acm_checked(acm_id, request, db)
    comp = Comparable(acm_id=acm_id, **body.model_dump(exclude=_COMPUTED_FIELDS))
    db.add(comp)
    _mark_acm_pending_if_required(acm)
    db.commit()
    db.refresh(comp)
    return _enrich_comparable(acm, comp)


@app.put("/api/acm/{acm_id}/comparable/{cid}", response_model=ComparableRead)
def update_comparable(acm_id: int, cid: int, body: ComparableUpdate, request: Request, db: Session = Depends(get_db)):
    acm = _get_acm_checked(acm_id, request, db)
    comp = _get_comparable_or_404(acm_id, cid, db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(comp, field, value)
    if body.model_dump(exclude_none=True):
        _mark_acm_pending_if_required(acm)
    db.commit()
    db.refresh(comp)
    return _enrich_comparable(acm, comp)


@app.delete("/api/acm/{acm_id}/comparable/{cid}", status_code=204)
def delete_comparable(acm_id: int, cid: int, request: Request, db: Session = Depends(get_db)):
    acm = _get_acm_checked(acm_id, request, db)
    comp = _get_comparable_or_404(acm_id, cid, db)
    db.delete(comp)
    _mark_acm_pending_if_required(acm)
    db.commit()


# --- Approval workflow ---

@app.get("/api/approvals/pending", response_model=list[ACMSummary])
def list_pending_approvals(request: Request, db: Session = Depends(get_db)):
    current = _require_approver(request, db)
    query = (
        db.query(ACM)
        .filter(ACM.approval_status == ApprovalStatus.pendiente, ACM.company_id == current.company_id)
        .order_by(ACM.updated_at.desc(), ACM.fecha_creacion.desc())
    )
    result = []
    for acm in query.all():
        s = ACMSummary.model_validate(acm)
        s.cantidad_comparables = len(acm.comparables)
        s.owner_username = acm.owner.username if acm.owner else None
        s.requires_approval = _requires_approval(acm)
        result.append(s)
    return result


@app.put("/api/acm/{acm_id}/approval", response_model=ACMRead)
def review_acm(
    acm_id: int,
    body: ApprovalReviewRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    reviewer = _require_approver(request, db)
    acm = _get_acm_or_404(acm_id, db)
    if not _requires_approval(acm):
        raise HTTPException(400, "Esta tasación no requiere aprobación")

    acm.approval_status = body.status
    acm.approved_by_id = reviewer.id if body.status == ApprovalStatus.aprobado else None
    acm.approved_at = datetime.utcnow() if body.status == ApprovalStatus.aprobado else None

    db.query(ApprovalComment).filter(ApprovalComment.acm_id == acm_id).delete()
    for item in body.comments:
        db.add(ApprovalComment(
            acm_id=acm_id,
            section=item.section.strip(),
            message=item.message.strip(),
            author_id=reviewer.id,
        ))
    db.commit()
    db.refresh(acm)
    return _build_acm_read(acm)


# --- Resultado y PDF ---

@app.get("/api/acm/{acm_id}/resultado", response_model=ResultadoResponse)
def get_resultado(acm_id: int, request: Request, db: Session = Depends(get_db)):
    acm = _get_acm_checked(acm_id, request, db)
    if not acm.comparables:
        raise HTTPException(status_code=422, detail="El ACM no tiene comparables")

    subject = _make_snapshot(acm)

    comp_resultados = []
    adjusted_prices = []

    for comp in acm.comparables:
        comp_snap = _make_snapshot(comp)
        overrides = {
            "factor_antiguedad": comp.factor_antiguedad,
            "factor_estado": comp.factor_estado,
            "factor_calidad": comp.factor_calidad,
            "factor_superficie": comp.factor_superficie,
            "factor_piso": comp.factor_piso,
            "factor_orientacion": comp.factor_orientacion,
            "factor_distribucion": comp.factor_distribucion,
            "factor_oferta": comp.factor_oferta,
            "factor_oportunidad": comp.factor_oportunidad,
            "factor_cochera": comp.factor_cochera,
            "factor_pileta": comp.factor_pileta,
            "factor_luminosidad": comp.factor_luminosidad,
            "factor_vistas": comp.factor_vistas,
            "factor_amenities": comp.factor_amenities,
        }
        r = calc.compute_adjusted_price(
            subject=subject,
            comp=comp_snap,
            precio=comp.precio,
            dias_mercado=comp.dias_mercado,
            oportunidad_mercado=comp.oportunidad_mercado or False,
            overrides=overrides,
        )
        adjusted_prices.append(r["precio_ajustado_m2"])
        comp_resultados.append(ComparableResultado(
            id=comp.id,
            direccion=comp.direccion,
            url=comp.url,
            precio=comp.precio,
            precio_m2_publicado=r["precio_m2_publicado"],
            factor_total=r["factor_total"],
            precio_ajustado_m2=r["precio_ajustado_m2"],
            detalle_factores=r["detalle_factores"],
        ))

    kpis = calc.compute_kpis(adjusted_prices, subject.superficie_homogeneizada)
    return ResultadoResponse(acm_id=acm_id, comparables=comp_resultados, **kpis)


# --- Ponderadores defaults (también sirve como liveness probe) ---

@app.get("/api/ponderadores/defaults", response_model=PonderadoresDefaults)
def get_defaults():
    return PonderadoresDefaults(**calc.DEFAULTS)


# --- Mapa estático del ACM ---

@app.get("/api/acm/{acm_id}/map")
def get_acm_map(acm_id: int, request: Request, db: Session = Depends(get_db)):
    from map_generator import generate_map_image
    acm = _get_acm_checked(acm_id, request, db)
    comp_addresses = [c.direccion for c in acm.comparables if c.direccion]
    map_b64 = generate_map_image(acm.direccion, comp_addresses)
    if not map_b64:
        raise HTTPException(status_code=503, detail="No se pudo generar el mapa para esta dirección")
    return {"map_image": map_b64}


# --- Modifier options ---

@app.get("/api/modifiers", response_model=list[ModifierOptionRead])
def list_modifiers(request: Request, db: Session = Depends(get_db)):
    current = _current_user(request, db)
    return (
        db.query(ModifierOption)
        .filter(ModifierOption.company_id == current.company_id)
        .order_by(ModifierOption.factor_key, ModifierOption.option_label)
        .all()
    )


@app.post("/api/modifiers", response_model=ModifierOptionRead, status_code=201)
def create_modifier(body: ModifierOptionCreate, request: Request, db: Session = Depends(get_db)):
    current = _require_admin(request, db)
    obj = ModifierOption(**body.model_dump(), company_id=current.company_id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.put("/api/modifiers/{mid}", response_model=ModifierOptionRead)
def update_modifier(mid: int, body: ModifierOptionUpdate, request: Request, db: Session = Depends(get_db)):
    current = _require_admin(request, db)
    obj = db.query(ModifierOption).filter(
        ModifierOption.id == mid, ModifierOption.company_id == current.company_id
    ).first()
    if not obj:
        raise HTTPException(404, "Modificador no encontrado")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    obj.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(obj)
    return obj


@app.delete("/api/modifiers/{mid}", status_code=204)
def delete_modifier(mid: int, request: Request, db: Session = Depends(get_db)):
    current = _require_admin(request, db)
    obj = db.query(ModifierOption).filter(
        ModifierOption.id == mid, ModifierOption.company_id == current.company_id
    ).first()
    if not obj:
        raise HTTPException(404, "Modificador no encontrado")
    db.delete(obj)
    db.commit()



# --- Integrations ---

_SCRAPER_SERVICE_URL = os.getenv("SCRAPER_SERVICE_URL")
_SCRAPER_SERVICE_TOKEN = os.getenv("SCRAPER_SERVICE_TOKEN", "")


class ExtractRequest(PydanticBase):
    url: str


@app.post("/api/extract")
async def extract_property(body: ExtractRequest, request: Request, db: Session = Depends(get_db)):
    from integrations import extract as integration_extract
    _current_user(request, db)
    settings = _get_scraper_settings(db)
    return await integration_extract(body.url.strip(), settings)


# ── Admin endpoints (/api/admin/*) ────────────────────────────────────────────

@app.post("/api/admin/login")
def admin_login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not _verify_password(body.password, user.hashed_password):
        raise HTTPException(401, "Usuario o contraseña incorrectos")
    if not user.is_superadmin:
        raise HTTPException(403, "Acceso restringido a superadmin")
    return {
        "access_token": _create_token(user.username),
        "token_type": "bearer",
        "username": user.username,
        "is_superadmin": True,
    }


@app.get("/api/admin/companies")
def admin_list_companies(request: Request, db: Session = Depends(get_db)):
    _require_superadmin(request, db)
    companies = db.query(Company).order_by(Company.id).all()
    result = []
    for co in companies:
        user_count = db.query(User).filter(User.company_id == co.id, User.is_superadmin.is_(False)).count()
        acm_count = db.query(ACM).filter(ACM.company_id == co.id, ACM.deleted_at.is_(None)).count()
        result.append({
            "id": co.id,
            "name": co.name,
            "created_at": co.created_at,
            "user_count": user_count,
            "acm_count": acm_count,
        })
    return result


@app.post("/api/admin/companies", status_code=201)
def admin_create_company(body: CompanyCreate, request: Request, db: Session = Depends(get_db)):
    _require_superadmin(request, db)
    if db.query(Company).filter(Company.name == body.name).first():
        raise HTTPException(409, f"La empresa '{body.name}' ya existe")
    co = Company(name=body.name)
    db.add(co)
    db.commit()
    db.refresh(co)
    return {"id": co.id, "name": co.name, "created_at": co.created_at, "user_count": 0, "acm_count": 0}


@app.get("/api/admin/companies/{company_id}")
def admin_get_company(company_id: int, request: Request, db: Session = Depends(get_db)):
    _require_superadmin(request, db)
    co = db.query(Company).filter(Company.id == company_id).first()
    if not co:
        raise HTTPException(404, "Empresa no encontrada")
    user_count = db.query(User).filter(User.company_id == co.id, User.is_superadmin.is_(False)).count()
    acm_count = db.query(ACM).filter(ACM.company_id == co.id, ACM.deleted_at.is_(None)).count()
    return {"id": co.id, "name": co.name, "created_at": co.created_at, "user_count": user_count, "acm_count": acm_count}


@app.patch("/api/admin/companies/{company_id}")
def admin_update_company(company_id: int, body: CompanyUpdate, request: Request, db: Session = Depends(get_db)):
    _require_superadmin(request, db)
    co = db.query(Company).filter(Company.id == company_id).first()
    if not co:
        raise HTTPException(404, "Empresa no encontrada")
    co.name = body.name
    db.commit()
    db.refresh(co)
    return {"id": co.id, "name": co.name, "created_at": co.created_at}


@app.delete("/api/admin/companies/{company_id}", status_code=204)
def admin_delete_company(company_id: int, request: Request, db: Session = Depends(get_db)):
    _require_superadmin(request, db)
    co = db.query(Company).filter(Company.id == company_id).first()
    if not co:
        raise HTTPException(404, "Empresa no encontrada")
    has_users = db.query(User).filter(User.company_id == company_id, User.is_superadmin.is_(False)).count() > 0
    if has_users:
        raise HTTPException(400, "No se puede eliminar una empresa con usuarios activos")
    db.delete(co)
    db.commit()


@app.get("/api/admin/companies/{company_id}/users")
def admin_list_company_users(company_id: int, request: Request, db: Session = Depends(get_db)):
    _require_superadmin(request, db)
    users = (
        db.query(User)
        .filter(User.company_id == company_id, User.is_superadmin.is_(False))
        .order_by(User.id)
        .all()
    )
    return [_serialize_user(u) for u in users]


@app.post("/api/admin/companies/{company_id}/users", status_code=201)
def admin_create_company_user(company_id: int, body: AdminUserCreate, request: Request, db: Session = Depends(get_db)):
    _require_superadmin(request, db)
    if not db.query(Company).filter(Company.id == company_id).first():
        raise HTTPException(404, "Empresa no encontrada")
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(409, f"El usuario '{body.username}' ya existe")
    user = User(
        username=body.username,
        hashed_password=_hash_password(body.password),
        is_admin=body.is_admin,
        is_approver=body.is_approver,
        needs_approval=body.needs_approval,
        company_id=company_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _serialize_user(user)


@app.patch("/api/admin/companies/{company_id}/users/{user_id}")
def admin_update_company_user(company_id: int, user_id: int, body: UserUpdate, request: Request, db: Session = Depends(get_db)):
    _require_superadmin(request, db)
    user = db.query(User).filter(User.id == user_id, User.company_id == company_id).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return _serialize_user(user)


@app.put("/api/admin/companies/{company_id}/users/{user_id}/password", status_code=204)
def admin_change_company_user_password(
    company_id: int, user_id: int, body: ChangePasswordRequest, request: Request, db: Session = Depends(get_db)
):
    _require_superadmin(request, db)
    user = db.query(User).filter(User.id == user_id, User.company_id == company_id).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    user.hashed_password = _hash_password(body.new_password)
    db.commit()


@app.delete("/api/admin/companies/{company_id}/users/{user_id}", status_code=204)
def admin_delete_company_user(company_id: int, user_id: int, request: Request, db: Session = Depends(get_db)):
    _require_superadmin(request, db)
    user = db.query(User).filter(User.id == user_id, User.company_id == company_id).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    db.delete(user)
    db.commit()


@app.get("/api/admin/companies/{company_id}/acms")
def admin_list_company_acms(company_id: int, request: Request, db: Session = Depends(get_db)):
    _require_superadmin(request, db)
    acms = (
        db.query(ACM)
        .filter(ACM.company_id == company_id, ACM.deleted_at.is_(None))
        .order_by(ACM.fecha_creacion.desc())
        .all()
    )
    result = []
    for acm in acms:
        s = ACMSummary.model_validate(acm)
        s.cantidad_comparables = len(acm.comparables)
        s.owner_username = acm.owner.username if acm.owner else None
        s.requires_approval = _requires_approval(acm)
        result.append(s)
    return result


# ── Admin integration settings ────────────────────────────────────────────────

class GlobalIntegrationSettings(PydanticBase):
    scraper_service_url: Optional[str] = None
    scraper_service_token: Optional[str] = None


@app.get("/api/admin/settings/integrations")
def admin_get_integration_settings(request: Request, db: Session = Depends(get_db)):
    _require_superadmin(request, db)
    raw = _get_scraper_settings(db)
    return GlobalIntegrationSettings(
        scraper_service_url=raw.get("scraper_service_url"),
        scraper_service_token="***" if raw.get("scraper_service_token") else None,
    )


@app.put("/api/admin/settings/integrations")
def admin_update_integration_settings(body: GlobalIntegrationSettings, request: Request, db: Session = Depends(get_db)):
    _require_superadmin(request, db)
    if body.scraper_service_url is not None:
        _save_platform_setting(db, "scraper_service_url", body.scraper_service_url.strip())
    if body.scraper_service_token is not None and body.scraper_service_token != "***":
        _save_platform_setting(db, "scraper_service_token", body.scraper_service_token.strip())
    return admin_get_integration_settings(request, db)


@app.get("/api/admin/settings/integrations/status")
async def admin_integration_status(request: Request, db: Session = Depends(get_db)):
    _require_superadmin(request, db)
    raw = _get_scraper_settings(db)
    scraper_url = (raw.get("scraper_service_url") or "").strip()

    connected = False
    if scraper_url:
        try:
            token = raw.get("scraper_service_token", "")
            headers = {"Authorization": f"Bearer {token}"} if token else {}
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"{scraper_url}/health", headers=headers)
            connected = r.status_code == 200
        except Exception:
            connected = False

    return {
        "connected": connected,
        "scraper_url": scraper_url or None,
        "sources": ["zonaprop", "argenprop", "mercadolibre"],
    }


# --- Legacy Zonaprop parser (kept for scraper microservice — not used by main app) ---

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-AR,es;q=0.9",
}


_TIPO_MAP = {
    "departamento": "Departamento",
    "casa": "Casa",
    "ph": "PH",
    "local": "Local",
    "local comercial": "Local",
}


def _parse_zonaprop_html(html: str) -> dict:
    """Parse Zonaprop SSR pages (no __NEXT_DATA__). Uses JSON-LD + inline dataLayerInfo."""
    soup = BeautifulSoup(html, "html.parser")
    result: dict = {}

    # --- 1. JSON-LD: address, surface, rooms, type, publication date ---
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            d = json.loads(script.string or "")
        except Exception:
            continue
        schema_type = d.get("@type", "")
        if schema_type not in ("Apartment", "House", "SingleFamilyResidence", "RealEstateListing"):
            continue

        # Address
        addr = d.get("address", {})
        street = addr.get("streetAddress", "").strip()
        region = addr.get("addressRegion", "").strip()
        if street:
            result["direccion"] = f"{street}, {region}".strip(", ") if region else street

        # Surface (floorSize = total covered)
        floor_size = d.get("floorSize", {})
        if isinstance(floor_size, dict) and floor_size.get("value"):
            result["superficie_cubierta"] = float(floor_size["value"])

        # Property type
        raw_type = schema_type.lower()
        if raw_type in ("house", "singlefamilyresidence"):
            result["tipo"] = "Casa"
        elif raw_type == "apartment":
            result["tipo"] = "Departamento"

        # Publication date → days on market
        for key in ("datePosted", "datePublished", "uploadDate"):
            pub_str = d.get(key)
            if isinstance(pub_str, str):
                try:
                    pub = datetime.fromisoformat(pub_str.replace("Z", "+00:00"))
                    result["dias_mercado"] = max(0, (datetime.now(timezone.utc) - pub).days)
                except Exception:
                    pass
                break

        break  # only use first matching schema

    # --- 2. dataLayerInfo inline JS: price, property type, city ---
    for script in soup.find_all("script"):
        src = script.string or ""
        if "dataLayerInfo" not in src:
            continue
        m = re.search(r"dataLayerInfo\s*=\s*\{([^}]+)\}", src, re.DOTALL)
        if not m:
            continue
        # Parse JS object (single-quoted keys/values) into dict
        pairs = re.findall(r"'([^']+)'\s*:\s*'([^']*)'", m.group(1))
        info = {k.strip(): v.strip() for k, v in pairs}

        # Price from sellPrice: "USD 148600"
        sell = info.get("sellPrice", "")
        if "USD" in sell.upper():
            nums = re.findall(r"\d+", sell.replace(".", "").replace(",", ""))
            for n in nums:
                v = int(n)
                if 1_000 < v < 100_000_000:
                    result["precio"] = v
                    break

        # Property type override (more reliable than JSON-LD @type)
        raw_tipo = info.get("propertyType", "").lower().strip()
        if raw_tipo in _TIPO_MAP:
            result["tipo"] = _TIPO_MAP[raw_tipo]

        # City as fallback address
        city = info.get("city", "").strip()
        if city and "direccion" not in result:
            result["direccion"] = city

        break

    # --- 3. Fallback price from visible span (e.g. "USD 148.600") ---
    if "precio" not in result:
        for span in soup.find_all("span"):
            t = span.get_text(" ", strip=True)
            if re.match(r"USD\s*[\d.,]+", t, re.I):
                nums = re.findall(r"\d+", t.replace(".", "").replace(",", ""))
                for n in nums:
                    v = int(n)
                    if 1_000 < v < 100_000_000:
                        result["precio"] = v
                        break
                if "precio" in result:
                    break

    # --- 4. Feature icons: surface if not in JSON-LD ---
    if "superficie_cubierta" not in result:
        features_section = soup.find(class_=re.compile(r"section-main-features|section-icon-features"))
        if features_section:
            text = features_section.get_text(" ", strip=True)
            m2_cub = re.search(r"(\d+(?:[.,]\d+)?)\s*m²?\s*cub", text, re.I)
            m2_tot = re.search(r"(\d+(?:[.,]\d+)?)\s*m²?\s*tot", text, re.I)
            if m2_cub:
                result["superficie_cubierta"] = float(m2_cub.group(1).replace(",", "."))
            elif m2_tot:
                result["superficie_cubierta"] = float(m2_tot.group(1).replace(",", "."))

    # --- 5. Days on market from "Publicado hace N días/meses" text ---
    if "dias_mercado" not in result:
        antiquity_el = soup.find(string=re.compile(r"Publicado hace", re.I))
        if antiquity_el:
            m = re.search(r"hace\s+(\d+)\s+(día|mes|año)", antiquity_el, re.I)
            if m:
                n, unit = int(m.group(1)), m.group(2).lower()
                if unit.startswith("día"):
                    result["dias_mercado"] = n
                elif unit.startswith("mes"):
                    result["dias_mercado"] = n * 30
                elif unit.startswith("año"):
                    result["dias_mercado"] = n * 365

    # --- 6. Orientation from icon-orientacion ---
    _ORI_MAP = {"n": "Norte", "s": "Sur", "e": "Este", "o": "Oeste", "i": "Interno",
                "norte": "Norte", "sur": "Sur", "este": "Este", "oeste": "Oeste", "interno": "Interno"}
    ori_icon = soup.find("i", class_="icon-orientacion")
    if ori_icon:
        li = ori_icon.find_parent("li")
        raw = li.get_text(strip=True).lower() if li else ""
        if raw in _ORI_MAP:
            result["orientacion"] = _ORI_MAP[raw]

    # --- 7. Antigüedad from icon-antiguedad ---
    ant_icon = soup.find("i", class_="icon-antiguedad")
    if ant_icon:
        li = ant_icon.find_parent("li")
        raw = li.get_text(strip=True) if li else ""
        m = re.search(r"(\d+)", raw)
        if m:
            result["antiguedad"] = int(m.group(1))

    return result


def _parse_next_data(html: str) -> dict:
    """Parse Zonaprop pages that use Next.js __NEXT_DATA__ (newer listing format)."""
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.+?)</script>', html, re.DOTALL)
    if not m:
        return {}
    try:
        data = json.loads(m.group(1))
    except json.JSONDecodeError:
        return {}

    page_props = data.get("props", {}).get("pageProps", {})

    listing = None
    for key in ("listing", "listingData", "posting", "propertyData"):
        c = page_props.get(key)
        if isinstance(c, dict) and c:
            listing = c
            break
    if listing is None:
        initial = page_props.get("initialData", {})
        for key in ("posting", "listing"):
            c = initial.get(key) if isinstance(initial, dict) else None
            if isinstance(c, dict) and c:
                listing = c
                break
    if not listing:
        return {}

    result = {}

    price_obj = listing.get("price") or {}
    if isinstance(price_obj, dict):
        amount = price_obj.get("amount") or price_obj.get("value")
        if amount and price_obj.get("currency", "USD") == "USD":
            result["precio"] = int(float(amount))
    if "precio" not in result:
        for p in (listing.get("priceOperationType") or {}).get("prices", []):
            if isinstance(p, dict) and p.get("currency") == "USD":
                result["precio"] = int(float(p.get("amount", 0)))
                break

    for getter in [
        lambda l: l.get("address"),
        lambda l: (l.get("location") or {}).get("address", {}).get("name"),
        lambda l: (l.get("location") or {}).get("fullLocation"),
        lambda l: l.get("title"),
    ]:
        try:
            v = getter(listing)
            if isinstance(v, str) and v.strip():
                result["direccion"] = v.strip()
                break
        except Exception:
            pass

    for key in ("createdOn", "publishDate", "publicationDate", "createdAt", "listingDate"):
        pub_str = listing.get(key)
        if isinstance(pub_str, str):
            try:
                pub = datetime.fromisoformat(pub_str.replace("Z", "+00:00"))
                result["dias_mercado"] = max(0, (datetime.now(timezone.utc) - pub).days)
                break
            except Exception:
                pass

    return result


async def _fetch_zonaprop(url: str) -> str:  # kept for scraper microservice compatibility
    last_exc: Exception | None = None
    for attempt in range(len(_ZONAPROP_RETRY_DELAYS) + 1):
        try:
            async with httpx.AsyncClient(
                headers=_BROWSER_HEADERS, follow_redirects=True, timeout=10
            ) as client:
                r = await client.get(url)
            if r.status_code in _ZONAPROP_RETRYABLE_STATUSES:
                raise httpx.HTTPStatusError(
                    f"status {r.status_code}", request=r.request, response=r
                )
            r.raise_for_status()
            return r.text
        except httpx.HTTPStatusError as e:
            last_exc = e
        except Exception as e:
            last_exc = e
        if attempt < len(_ZONAPROP_RETRY_DELAYS):
            await asyncio.sleep(_ZONAPROP_RETRY_DELAYS[attempt])
    raise HTTPException(
        422,
        "No pudimos acceder automáticamente a los datos en este momento. "
        "Esto puede deberse a restricciones temporales del sitio. "
        "Podés intentar nuevamente o completar los datos manualmente.",
    )


