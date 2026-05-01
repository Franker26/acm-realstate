import json
import re
from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup
from fastapi import HTTPException

from .base import BaseSource
from . import browser as _browser

_TIPO_MAP = {
    "departamento": "Departamento",
    "casa": "Casa",
    "ph": "PH",
    "local": "Local",
    "local comercial": "Local",
}

_ORI_MAP = {
    "n": "Norte", "s": "Sur", "e": "Este", "o": "Oeste", "i": "Interno",
    "norte": "Norte", "sur": "Sur", "este": "Este", "oeste": "Oeste", "interno": "Interno",
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


def _parse_html(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    result: dict = {}

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

    for script in soup.find_all("script"):
        src = script.string or ""
        if "dataLayerInfo" not in src:
            continue
        m = re.search(r"dataLayerInfo\s*=\s*\{([^}]+)\}", src, re.DOTALL)
        if not m:
            continue
        pairs = re.findall(r"'([^']+)'\s*:\s*'([^']*)'", m.group(1))
        info = {k.strip(): v.strip() for k, v in pairs}

        sell = info.get("sellPrice", "")
        if "USD" in sell.upper():
            nums = re.findall(r"\d+", sell.replace(".", "").replace(",", ""))
            for n in nums:
                v = int(n)
                if 1_000 < v < 100_000_000:
                    result["precio"] = v
                    break

        raw_tipo = info.get("propertyType", "").lower().strip()
        if raw_tipo in _TIPO_MAP:
            result["tipo"] = _TIPO_MAP[raw_tipo]

        city = info.get("city", "").strip()
        if city and "direccion" not in result:
            result["direccion"] = city
        break

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

    if "superficie_cubierta" not in result:
        section = soup.find(class_=re.compile(r"section-main-features|section-icon-features"))
        if section:
            text = section.get_text(" ", strip=True)
            m2_cub = re.search(r"(\d+(?:[.,]\d+)?)\s*m²?\s*cub", text, re.I)
            m2_tot = re.search(r"(\d+(?:[.,]\d+)?)\s*m²?\s*tot", text, re.I)
            if m2_cub:
                result["superficie_cubierta"] = float(m2_cub.group(1).replace(",", "."))
            elif m2_tot:
                result["superficie_cubierta"] = float(m2_tot.group(1).replace(",", "."))

    if "dias_mercado" not in result:
        el = soup.find(string=re.compile(r"Publicado hace", re.I))
        if el:
            m = re.search(r"hace\s+(\d+)\s+(día|mes|año)", el, re.I)
            if m:
                n, unit = int(m.group(1)), m.group(2).lower()
                if unit.startswith("día"):
                    result["dias_mercado"] = n
                elif unit.startswith("mes"):
                    result["dias_mercado"] = n * 30
                elif unit.startswith("año"):
                    result["dias_mercado"] = n * 365

    ori_icon = soup.find("i", class_="icon-orientacion")
    if ori_icon:
        li = ori_icon.find_parent("li")
        raw = li.get_text(strip=True).lower() if li else ""
        if raw in _ORI_MAP:
            result["orientacion"] = _ORI_MAP[raw]

    ant_icon = soup.find("i", class_="icon-antiguedad")
    if ant_icon:
        li = ant_icon.find_parent("li")
        raw = li.get_text(strip=True) if li else ""
        m = re.search(r"(\d+)", raw)
        if m:
            result["antiguedad"] = int(m.group(1))

    return result


class ZonapropSource(BaseSource):
    @staticmethod
    def can_handle(url: str) -> bool:
        return "zonaprop.com.ar" in url

    async def extract(self, url: str, client: httpx.AsyncClient) -> dict:
        html: str | None = None
        try:
            r = await client.get(url)
            if r.status_code == 403:
                # Bot detection — fall back to headless browser
                html = await _browser.fetch_rendered(url)
            else:
                r.raise_for_status()
                html = r.text
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(502, f"Error al acceder a Zonaprop: {e}")

        result = _parse_next_data(html)
        if not result:
            result = _parse_html(html)
        if not result:
            raise HTTPException(422, "No se pudieron extraer datos de Zonaprop")
        return result
