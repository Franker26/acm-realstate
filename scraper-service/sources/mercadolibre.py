import json
import re
from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup
from fastapi import HTTPException

from .base import BaseSource

_TIPO_MAP = {
    "departamento": "Departamento",
    "casa": "Casa",
    "ph": "PH",
    "local": "Local",
    "local comercial": "Local",
}

_ORI_MAP = {
    "norte": "Norte", "sur": "Sur", "este": "Este", "oeste": "Oeste", "interno": "Interno",
}


def _parse_html(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    result: dict = {}

    # JSON-LD schema
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            d = json.loads(script.string or "")
        except Exception:
            continue
        schema_type = d.get("@type", "")
        if schema_type not in ("Product", "Apartment", "House", "RealEstateListing"):
            continue

        offers = d.get("offers", {})
        if isinstance(offers, dict):
            price = offers.get("price")
            currency = offers.get("priceCurrency", "USD")
            if price and currency == "USD":
                try:
                    result["precio"] = int(float(price))
                except (ValueError, TypeError):
                    pass

        addr = d.get("address", {})
        if isinstance(addr, dict):
            street = addr.get("streetAddress", "").strip()
            region = addr.get("addressRegion", "").strip()
            if street:
                result["direccion"] = f"{street}, {region}".strip(", ") if region else street

        for key in ("datePosted", "datePublished"):
            pub_str = d.get(key)
            if isinstance(pub_str, str):
                try:
                    pub = datetime.fromisoformat(pub_str.replace("Z", "+00:00"))
                    result["dias_mercado"] = max(0, (datetime.now(timezone.utc) - pub).days)
                except Exception:
                    pass
                break
        break

    # Price from page elements
    if "precio" not in result:
        for el in soup.find_all(class_=re.compile(r"price|precio|andes-money", re.I)):
            t = el.get_text(" ", strip=True)
            if re.search(r"USD\s*[\d.,]+|U\$S\s*[\d.,]+", t, re.I):
                nums = re.findall(r"\d+", t.replace(".", "").replace(",", ""))
                for n in nums:
                    v = int(n)
                    if 1_000 < v < 100_000_000:
                        result["precio"] = v
                        break
            if "precio" in result:
                break

    # Location from breadcrumb or address elements
    if "direccion" not in result:
        for el in soup.find_all(class_=re.compile(r"location|address|ubicacion", re.I)):
            t = el.get_text(" ", strip=True)
            if t and len(t) > 5:
                result["direccion"] = t
                break

    # Surface from attributes table
    text = soup.get_text(" ", strip=True)
    m2_cub = re.search(r"(\d+(?:[.,]\d+)?)\s*m²?\s*(?:cubiertos?|cubier)", text, re.I)
    m2_tot = re.search(r"(\d+(?:[.,]\d+)?)\s*m²?\s*(?:totales?|total)", text, re.I)
    if m2_cub:
        result["superficie_cubierta"] = float(m2_cub.group(1).replace(",", "."))
    elif m2_tot:
        result["superficie_cubierta"] = float(m2_tot.group(1).replace(",", "."))

    # Property type
    for raw, mapped in _TIPO_MAP.items():
        if re.search(rf"\b{re.escape(raw)}\b", text, re.I):
            result["tipo"] = mapped
            break

    # Orientation
    for raw, mapped in _ORI_MAP.items():
        if re.search(rf"\borienta(?:ción|cion)\b.*\b{raw}\b", text, re.I):
            result["orientacion"] = mapped
            break

    # Antigüedad
    m_ant = re.search(r"(\d+)\s*años?\s*de\s*antigüedad", text, re.I)
    if m_ant:
        result["antiguedad"] = int(m_ant.group(1))

    return result


class MercadoLibreSource(BaseSource):
    @staticmethod
    def can_handle(url: str) -> bool:
        return "mercadolibre.com.ar" in url or (
            "mercadolibre.com" in url and "MLA" in url
        )

    async def extract(self, url: str, client: httpx.AsyncClient) -> dict:
        try:
            r = await client.get(url)
            r.raise_for_status()
        except Exception as e:
            raise HTTPException(502, f"Error al acceder a MercadoLibre: {e}")

        result = _parse_html(r.text)
        if not result:
            raise HTTPException(422, "No se pudieron extraer datos de MercadoLibre")
        return result
