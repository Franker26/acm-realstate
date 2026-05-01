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
    "oficina": "Local",
}

_ORI_MAP = {
    "norte": "Norte", "sur": "Sur", "este": "Este", "oeste": "Oeste", "interno": "Interno",
    "n": "Norte", "s": "Sur", "e": "Este", "o": "Oeste",
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
    listing = None
    for key in ("listing", "ficha", "property", "propertyData", "posting"):
        c = page_props.get(key)
        if isinstance(c, dict) and c:
            listing = c
            break

    if not listing:
        return {}

    result = {}

    # Price
    for price_key in ("price", "precio", "priceUSD"):
        p = listing.get(price_key)
        if isinstance(p, dict):
            amt = p.get("amount") or p.get("value")
            cur = p.get("currency", "USD")
            if amt and cur == "USD":
                result["precio"] = int(float(amt))
                break
        elif isinstance(p, (int, float)) and p > 0:
            result["precio"] = int(p)
            break

    # Address
    for addr_key in ("address", "direccion", "fullAddress", "location"):
        v = listing.get(addr_key)
        if isinstance(v, str) and v.strip():
            result["direccion"] = v.strip()
            break
        if isinstance(v, dict):
            parts = [v.get("street", ""), v.get("neighborhood", ""), v.get("city", "")]
            joined = ", ".join(p for p in parts if p)
            if joined:
                result["direccion"] = joined
                break

    # Surface
    for sup_key in ("coveredArea", "totalArea", "superficieCubierta", "superficie"):
        v = listing.get(sup_key)
        if v:
            try:
                result["superficie_cubierta"] = float(re.sub(r"[^\d.]", "", str(v)))
                break
            except (ValueError, TypeError):
                pass

    # Type
    for tipo_key in ("propertyType", "tipo", "type"):
        v = listing.get(tipo_key)
        if isinstance(v, str):
            mapped = _TIPO_MAP.get(v.lower().strip())
            if mapped:
                result["tipo"] = mapped
                break

    # Days on market
    for date_key in ("publicationDate", "createdAt", "publishedAt", "fechaPublicacion"):
        pub_str = listing.get(date_key)
        if isinstance(pub_str, str):
            try:
                pub = datetime.fromisoformat(pub_str.replace("Z", "+00:00"))
                result["dias_mercado"] = max(0, (datetime.now(timezone.utc) - pub).days)
                break
            except Exception:
                pass

    return result


def _parse_html(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    result: dict = {}

    # JSON-LD
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            d = json.loads(script.string or "")
        except Exception:
            continue
        schema_type = d.get("@type", "")
        if schema_type not in ("Apartment", "House", "SingleFamilyResidence", "RealEstateListing"):
            continue

        addr = d.get("address", {})
        street = addr.get("streetAddress", "").strip()
        region = addr.get("addressRegion", "").strip()
        if street:
            result["direccion"] = f"{street}, {region}".strip(", ") if region else street

        floor_size = d.get("floorSize", {})
        if isinstance(floor_size, dict) and floor_size.get("value"):
            result["superficie_cubierta"] = float(floor_size["value"])

        raw_type = schema_type.lower()
        if raw_type in ("house", "singlefamilyresidence"):
            result["tipo"] = "Casa"
        elif raw_type == "apartment":
            result["tipo"] = "Departamento"

        for key in ("datePosted", "datePublished", "uploadDate"):
            pub_str = d.get(key)
            if isinstance(pub_str, str):
                try:
                    pub = datetime.fromisoformat(pub_str.replace("Z", "+00:00"))
                    result["dias_mercado"] = max(0, (datetime.now(timezone.utc) - pub).days)
                except Exception:
                    pass
                break
        break

    # Price from visible elements
    if "precio" not in result:
        for el in soup.find_all(class_=re.compile(r"price|precio", re.I)):
            t = el.get_text(" ", strip=True)
            if re.search(r"USD\s*[\d.,]+", t, re.I):
                nums = re.findall(r"\d+", t.replace(".", "").replace(",", ""))
                for n in nums:
                    v = int(n)
                    if 1_000 < v < 100_000_000:
                        result["precio"] = v
                        break
            if "precio" in result:
                break

    # Surface from text patterns
    if "superficie_cubierta" not in result:
        text = soup.get_text(" ", strip=True)
        m2_cub = re.search(r"(\d+(?:[.,]\d+)?)\s*m²?\s*cub", text, re.I)
        m2_tot = re.search(r"(\d+(?:[.,]\d+)?)\s*m²?\s*tot", text, re.I)
        if m2_cub:
            result["superficie_cubierta"] = float(m2_cub.group(1).replace(",", "."))
        elif m2_tot:
            result["superficie_cubierta"] = float(m2_tot.group(1).replace(",", "."))

    # Orientation
    text = soup.get_text(" ", strip=True)
    for raw, mapped in _ORI_MAP.items():
        if re.search(rf"\borienta(?:ción|cion)\s*:?\s*{raw}\b", text, re.I):
            result["orientacion"] = mapped
            break

    return result


class ArgenpropSource(BaseSource):
    @staticmethod
    def can_handle(url: str) -> bool:
        return "argenprop.com" in url

    async def extract(self, url: str, client: httpx.AsyncClient) -> dict:
        try:
            r = await client.get(url)
            r.raise_for_status()
        except Exception as e:
            raise HTTPException(502, f"Error al acceder a Argenprop: {e}")

        result = _parse_next_data(r.text)
        if not result:
            result = _parse_html(r.text)
        if not result:
            raise HTTPException(422, "No se pudieron extraer datos de Argenprop")
        return result
