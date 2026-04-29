import json
import os
import re
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

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
    ApprovalCommentRead,
    ApprovalReviewRequest,
    BrandingSettings,
    ComparableCreate,
    ComparableRead,
    ComparableResultado,
    ComparableUpdate,
    PonderadoresDefaults,
    ResultadoResponse,
    UserCreate,
    UserRead,
    UserUpdate,
)

_ENUM_NORMALIZATIONS = [
    (
        "acm",
        "stage",
        {
            "Borrador": "borrador",
            "En progreso": "en_progreso",
            "Finalizado": "finalizado",
        },
    ),
    (
        "acm",
        "approval_status",
        {
            "No requerida": "no_requerida",
            "Pendiente": "pendiente",
            "Aprobado": "aprobado",
            "Cambios solicitados": "cambios_solicitados",
        },
    ),
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        for table, column, replacements in _ENUM_NORMALIZATIONS:
            for old_value, new_value in replacements.items():
                conn.execute(
                    text(f"UPDATE {table} SET {column} = :new_value WHERE {column} = :old_value"),
                    {"new_value": new_value, "old_value": old_value},
                )
            conn.commit()
    with SessionLocal() as db:
        for acm in db.query(ACM).all():
            if acm.updated_at is None:
                acm.updated_at = acm.fecha_creacion
            if acm.approval_status is None:
                _mark_acm_pending_if_required(acm)
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
    return {
        "access_token": _create_token(user.username),
        "token_type": "bearer",
        "username": user.username,
        "is_admin": user.is_admin,
        "is_approver": user.is_approver,
        "needs_approval": user.needs_approval,
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


def _serialize_user(user: User) -> UserRead:
    return UserRead(
        id=user.id,
        username=user.username,
        is_admin=user.is_admin,
        is_approver=user.is_approver,
        needs_approval=user.needs_approval,
    )


class ChangePasswordRequest(PydanticBase):
    new_password: str


@app.get("/api/users", response_model=list[UserRead])
def list_users(request: Request, db: Session = Depends(get_db)):
    _require_admin(request, db)
    users = db.query(User).order_by(User.id).all()
    return [_serialize_user(u) for u in users]


@app.post("/api/users", response_model=UserRead, status_code=201)
def create_user(body: UserCreate, request: Request, db: Session = Depends(get_db)):
    _require_admin(request, db)
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(409, f"El usuario '{body.username}' ya existe")
    user = User(
        username=body.username,
        hashed_password=_hash_password(body.password),
        is_admin=body.is_admin,
        is_approver=body.is_approver,
        needs_approval=body.needs_approval,
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
def get_branding_settings(db: Session = Depends(get_db)):
    return _get_branding_settings(db)


@app.put("/api/settings/branding", response_model=BrandingSettings)
def update_branding_settings(
    body: BrandingSettings,
    request: Request,
    db: Session = Depends(get_db),
):
    _require_admin(request, db)
    _save_branding_settings(body, db)
    return _get_branding_settings(db)


def _get_acm_or_404(acm_id: int, db: Session) -> ACM:
    acm = db.query(ACM).filter(ACM.id == acm_id).first()
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
        acm.approval_status = ApprovalStatus.pendiente
        acm.approved_by_id = None
        acm.approved_at = None
    else:
        acm.approval_status = ApprovalStatus.no_requerida
        acm.approved_by_id = None
        acm.approved_at = None


_BRANDING_DEFAULTS = {
    "app_name": "ACM Real Estate",
    "primary_color": "#1a3a5c",
    "logo_data_url": None,
}


def _get_branding_settings(db: Session) -> BrandingSettings:
    payload = {}
    for key, default in _BRANDING_DEFAULTS.items():
        setting = db.query(AppSetting).filter(AppSetting.key == key).first()
        payload[key] = setting.value if setting and setting.value is not None else default
    return BrandingSettings(**payload)


def _save_branding_settings(body: BrandingSettings, db: Session):
    for key, value in body.model_dump().items():
        setting = db.query(AppSetting).filter(AppSetting.key == key).first()
        if not setting:
            setting = AppSetting(key=key)
            db.add(setting)
        setting.value = value
    db.commit()


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
    if not current.is_admin and acm.owner_id != current.id:
        raise HTTPException(403, "Sin acceso a este ACM")


@app.post("/api/acm", response_model=ACMRead, status_code=201)
def create_acm(body: ACMCreate, request: Request, db: Session = Depends(get_db)):
    current = _current_user(request, db)
    acm = ACM(**body.model_dump(exclude=_COMPUTED_FIELDS), owner_id=current.id)
    _mark_acm_pending_if_required(acm)
    db.add(acm)
    db.commit()
    db.refresh(acm)
    return _build_acm_read(acm)


@app.get("/api/acm", response_model=list[ACMSummary])
def list_acms(request: Request, db: Session = Depends(get_db)):
    current = _current_user(request, db)
    query = db.query(ACM).order_by(ACM.fecha_creacion.desc())
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
    db.delete(acm)
    db.commit()


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
    _require_approver(request, db)
    query = (
        db.query(ACM)
        .filter(ACM.approval_status == ApprovalStatus.pendiente)
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


# --- Zonaprop extractor ---

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-AR,es;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
}


def _parse_next_data(html: str) -> dict:
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.+?)</script>', html, re.DOTALL)
    if not m:
        return {}
    try:
        data = json.loads(m.group(1))
    except json.JSONDecodeError:
        return {}

    page_props = data.get("props", {}).get("pageProps", {})

    # Zonaprop wraps the listing under different keys depending on listing type
    listing = None
    for key in ("listing", "listingData", "posting", "propertyData"):
        c = page_props.get(key)
        if isinstance(c, dict) and c:
            listing = c
            break
    if listing is None:
        # Some pages nest it under initialData
        initial = page_props.get("initialData", {})
        for key in ("posting", "listing"):
            c = initial.get(key) if isinstance(initial, dict) else None
            if isinstance(c, dict) and c:
                listing = c
                break
    if not listing:
        return {}

    result = {}

    # Price (USD only)
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

    # Address
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

    # Days on market (from publication date)
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


def _parse_html_fallback(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    result = {}

    for qa in ("price", "PRICE", "posting-price", "POSTING_PRICE"):
        el = soup.find(attrs={"data-qa": qa})
        if el:
            text_content = el.get_text(" ", strip=True)
            # Extract numbers, remove thousands separators
            nums = re.findall(r"[\d]+", text_content.replace(".", "").replace(",", ""))
            for n in nums:
                v = int(n)
                if 1_000 < v < 100_000_000:
                    result["precio"] = v
                    break
            if "precio" in result:
                break

    for qa in ("address", "location", "POSTING_LOCATION", "LOCATION", "posting-title"):
        el = soup.find(attrs={"data-qa": qa})
        if el:
            t = el.get_text(" ", strip=True)
            if t:
                result["direccion"] = t
                break

    return result


class ZonapropExtractRequest(PydanticBase):
    url: str


@app.post("/api/zonaprop/extract")
async def extract_zonaprop(body: ZonapropExtractRequest):
    url = body.url.strip()
    if "zonaprop.com.ar" not in url:
        raise HTTPException(400, "La URL debe ser de zonaprop.com.ar")

    try:
        async with httpx.AsyncClient(headers=_BROWSER_HEADERS, follow_redirects=True, timeout=20) as client:
            r = await client.get(url)
        if r.status_code == 403:
            raise HTTPException(422, "Zonaprop bloqueó el acceso. Intentá de nuevo en unos segundos o ingresá los datos manualmente.")
        r.raise_for_status()
        html = r.text
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(422, f"No se pudo acceder a la URL: {e}")

    result = _parse_next_data(html)
    if not result:
        result = _parse_html_fallback(html)

    if not result:
        raise HTTPException(
            422,
            "No se pudieron extraer datos de la página. Puede estar inactiva o el formato cambió.",
        )

    return result
