import re
import time

import httpx
from fastapi import HTTPException

from .base import BaseAdapter

_TOKEN_CACHE: dict = {}  # { (app_id, secret): (token, expires_at) }

_TIPO_MAP = {
    "Departamentos": "Departamento",
    "Casas": "Casa",
    "PHs": "PH",
    "Locales comerciales": "Local",
    "local_commercial": "Local",
    "apartment": "Departamento",
    "house": "Casa",
    "ph": "PH",
}

_ORI_MAP = {
    "Norte": "Norte", "Sur": "Sur", "Este": "Este",
    "Oeste": "Oeste", "Interno": "Interno",
    "north": "Norte", "south": "Sur", "east": "Este",
    "west": "Oeste", "internal": "Interno",
}


def _extract_item_id(url: str) -> str | None:
    m = re.search(r"(MLA\d+)", url)
    return m.group(1) if m else None


async def _get_token(app_id: str, secret: str) -> str:
    key = (app_id, secret)
    cached = _TOKEN_CACHE.get(key)
    if cached and time.time() < cached[1] - 60:
        return cached[0]

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            "https://api.mercadolibre.com/oauth/token",
            data={
                "grant_type": "client_credentials",
                "client_id": app_id,
                "client_secret": secret,
            },
        )
    if r.status_code != 200:
        raise HTTPException(502, f"No se pudo autenticar con MercadoLibre: {r.text}")

    data = r.json()
    token = data["access_token"]
    expires_at = time.time() + data.get("expires_in", 21600)
    _TOKEN_CACHE[key] = (token, expires_at)
    return token


def _attr(attributes: list, name: str):
    for a in attributes:
        if a.get("id") == name or a.get("name") == name:
            v = a.get("value_name") or a.get("value_struct")
            return v
    return None


def _parse_item(item: dict) -> dict:
    result: dict = {}
    attrs = item.get("attributes", [])

    # Price (USD only)
    price = item.get("price")
    currency = item.get("currency_id", "")
    if price and currency == "USD":
        result["precio"] = int(price)

    # Address
    location = item.get("location", {})
    parts = [
        location.get("address_line", ""),
        location.get("neighborhood", {}).get("name", ""),
        location.get("city", {}).get("name", ""),
    ]
    address = ", ".join(p for p in parts if p)
    if address:
        result["direccion"] = address

    # Property type
    category = item.get("category_id", "")
    for raw, mapped in _TIPO_MAP.items():
        if raw.lower() in category.lower() or raw.lower() in item.get("title", "").lower():
            result["tipo"] = mapped
            break

    raw_tipo = _attr(attrs, "PROPERTY_TYPE")
    if raw_tipo and raw_tipo in _TIPO_MAP:
        result["tipo"] = _TIPO_MAP[raw_tipo]

    # Superficie cubierta
    sup_cub = _attr(attrs, "COVERED_AREA") or _attr(attrs, "TOTAL_AREA")
    if sup_cub:
        try:
            if isinstance(sup_cub, dict):
                result["superficie_cubierta"] = float(sup_cub.get("value", 0))
            else:
                result["superficie_cubierta"] = float(re.sub(r"[^\d.]", "", str(sup_cub)))
        except (ValueError, TypeError):
            pass

    # Superficie descubierta (terreno)
    sup_desc = _attr(attrs, "UNCOVERED_AREA") or _attr(attrs, "LOT_AREA")
    if sup_desc:
        try:
            if isinstance(sup_desc, dict):
                result["superficie_descubierta"] = float(sup_desc.get("value", 0))
            else:
                result["superficie_descubierta"] = float(re.sub(r"[^\d.]", "", str(sup_desc)))
        except (ValueError, TypeError):
            pass

    # Antigüedad
    antiguedad = _attr(attrs, "PROPERTY_AGE")
    if antiguedad:
        try:
            result["antiguedad"] = int(re.sub(r"[^\d]", "", str(antiguedad)))
        except (ValueError, TypeError):
            pass

    # Orientación
    ori = _attr(attrs, "ORIENTATION")
    if ori and ori in _ORI_MAP:
        result["orientacion"] = _ORI_MAP[ori]

    return result


class MercadoLibreAdapter(BaseAdapter):
    def can_handle(self, url: str) -> bool:
        return "mercadolibre.com.ar" in url or "mercadolibre.com" in url

    async def extract(self, url: str, settings: dict) -> dict:
        app_id = settings.get("ml_app_id")
        secret = settings.get("ml_app_secret")
        if not app_id or not secret:
            raise HTTPException(
                503,
                "Las credenciales de MercadoLibre no están configuradas. "
                "Ingresalas en Configuración → Integraciones.",
            )

        item_id = _extract_item_id(url)
        if not item_id:
            raise HTTPException(400, "No se encontró un ID de publicación válido en la URL.")

        token = await _get_token(app_id, secret)

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
