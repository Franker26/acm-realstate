import re
import time

import httpx
from fastapi import HTTPException

from .base import BaseAdapter

_TIPO_MAP = {
    "apartment": "Departamento",
    "house": "Casa",
    "ph": "PH",
    "local_commercial": "Local",
    "Departamentos": "Departamento",
    "Casas": "Casa",
    "PHs": "PH",
    "Locales comerciales": "Local",
}

_ORI_MAP = {
    "Norte": "Norte", "Sur": "Sur", "Este": "Este",
    "Oeste": "Oeste", "Interno": "Interno",
    "north": "Norte", "south": "Sur", "east": "Este",
    "west": "Oeste", "internal": "Interno",
}


def _extract_item_id(url: str) -> str | None:
    m = re.search(r"MLA-?(\d+)", url)
    return f"MLA{m.group(1)}" if m else None


async def _get_valid_token(settings: dict) -> str:
    access_token = settings.get("ml_access_token")
    expires_at = float(settings.get("ml_token_expires_at") or 0)

    if access_token and time.time() < expires_at - 60:
        return access_token

    refresh_token = settings.get("ml_refresh_token")
    app_id = settings.get("ml_app_id")
    secret = settings.get("ml_app_secret")

    if not refresh_token:
        raise HTTPException(
            503,
            "No hay sesión de MercadoLibre activa. "
            "Conectá tu cuenta desde Configuración → Integraciones.",
        )
    if not app_id or not secret:
        raise HTTPException(
            503,
            "Credenciales de MercadoLibre no configuradas. "
            "Completá App ID y Secret en Configuración → Integraciones.",
        )

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            "https://api.mercadolibre.com/oauth/token",
            data={
                "grant_type": "refresh_token",
                "client_id": app_id,
                "client_secret": secret,
                "refresh_token": refresh_token,
            },
        )

    if r.status_code != 200:
        raise HTTPException(
            503,
            "La sesión de MercadoLibre expiró. "
            "Reconectá tu cuenta desde Configuración → Integraciones.",
        )

    data = r.json()
    new_token = data["access_token"]
    new_refresh = data.get("refresh_token", refresh_token)
    new_expires = time.time() + data.get("expires_in", 21600)

    save = settings.get("_save_setting")
    if save:
        save("ml_access_token", new_token)
        save("ml_refresh_token", new_refresh)
        save("ml_token_expires_at", str(new_expires))

    return new_token


def _attr(attributes: list, name: str):
    for a in attributes:
        if a.get("id") == name or a.get("name") == name:
            return a.get("value_name") or a.get("value_struct")
    return None


def _parse_item(item: dict) -> dict:
    result: dict = {}
    attrs = item.get("attributes", [])

    price = item.get("price")
    currency = item.get("currency_id", "")
    if price and currency == "USD":
        result["precio"] = int(price)

    location = item.get("location", {})
    parts = [
        location.get("address_line", ""),
        location.get("neighborhood", {}).get("name", ""),
        location.get("city", {}).get("name", ""),
    ]
    address = ", ".join(p for p in parts if p)
    if address:
        result["direccion"] = address

    raw_tipo = _attr(attrs, "PROPERTY_TYPE")
    if raw_tipo and raw_tipo in _TIPO_MAP:
        result["tipo"] = _TIPO_MAP[raw_tipo]
    else:
        for raw, mapped in _TIPO_MAP.items():
            if raw.lower() in item.get("title", "").lower():
                result["tipo"] = mapped
                break

    sup_cub = _attr(attrs, "COVERED_AREA") or _attr(attrs, "TOTAL_AREA")
    if sup_cub:
        try:
            result["superficie_cubierta"] = float(
                sup_cub.get("value", 0) if isinstance(sup_cub, dict)
                else re.sub(r"[^\d.]", "", str(sup_cub))
            )
        except (ValueError, TypeError):
            pass

    sup_desc = _attr(attrs, "UNCOVERED_AREA") or _attr(attrs, "LOT_AREA")
    if sup_desc:
        try:
            result["superficie_descubierta"] = float(
                sup_desc.get("value", 0) if isinstance(sup_desc, dict)
                else re.sub(r"[^\d.]", "", str(sup_desc))
            )
        except (ValueError, TypeError):
            pass

    antiguedad = _attr(attrs, "PROPERTY_AGE")
    if antiguedad:
        try:
            result["antiguedad"] = int(re.sub(r"[^\d]", "", str(antiguedad)))
        except (ValueError, TypeError):
            pass

    ori = _attr(attrs, "ORIENTATION")
    if ori and ori in _ORI_MAP:
        result["orientacion"] = _ORI_MAP[ori]

    return result


class MercadoLibreAdapter(BaseAdapter):
    def can_handle(self, url: str) -> bool:
        return "mercadolibre.com.ar" in url or "mercadolibre.com" in url

    async def extract(self, url: str, settings: dict) -> dict:
        item_id = _extract_item_id(url)
        if not item_id:
            raise HTTPException(400, "No se encontró un ID de publicación válido en la URL.")

        token = await _get_valid_token(settings)

        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"https://api.mercadolibre.com/items/{item_id}",
                headers={"Authorization": f"Bearer {token}"},
            )

        if r.status_code == 404:
            raise HTTPException(404, "Publicación no encontrada en MercadoLibre.")
        if r.status_code != 200:
            raise HTTPException(r.status_code, f"Error de MercadoLibre API: {r.text}")

        result = _parse_item(r.json())
        if not result:
            raise HTTPException(422, "No se pudieron extraer datos de la publicación.")
        return result
