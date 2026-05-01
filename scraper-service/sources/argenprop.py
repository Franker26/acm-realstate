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
    "oficina": "Local",
}

# Cardinal + intercardinal → closest cardinal supported by the app
_ORI_MAP = {
    "n": "Norte", "norte": "Norte",
    "s": "Sur", "sur": "Sur",
    "e": "Este", "este": "Este",
    "o": "Oeste", "oeste": "Oeste",
    "ne": "Norte", "no": "Norte", "noreste": "Norte", "noroeste": "Norte",
    "se": "Sur", "so": "Sur", "sureste": "Sur", "suroeste": "Sur",
    "interno": "Interno",
}


def _parse_hidden_input(soup: BeautifulSoup) -> dict:
    """Parse the GA hidden input which carries structured listing metadata."""
    inp = soup.find("input", {"data-price": True})
    if not inp:
        return {}

    result: dict = {}

    # Price + currency — only capture USD prices (skip ARS rentals)
    price_raw = inp.get("data-price", "").strip()
    currency = inp.get("data-moneda", "").strip()
    if price_raw:
        try:
            price = int(float(price_raw))
            if price > 0:
                result["precio"] = price
                result["_currency"] = "USD" if currency.upper() == "USD" else "ARS"
        except (ValueError, TypeError):
            pass

    # Property type
    tipo_raw = inp.get("data-tipo-propiedad", "").lower().strip()
    if tipo_raw in _TIPO_MAP:
        result["tipo"] = _TIPO_MAP[tipo_raw]

    # Location components for fallback address
    barrio = inp.get("data-barrio", "")
    localidad = inp.get("data-localidad", "")
    if barrio:
        result["_barrio"] = barrio
    if localidad:
        result["_localidad"] = localidad

    return result


def _parse_features_section(soup: BeautifulSoup) -> dict:
    """Parse .property-features elements which contain key: value characteristic pairs."""
    result: dict = {}

    features_text = " ".join(
        el.get_text(" ", strip=True)
        for el in soup.find_all(class_="property-features")
    )

    # Antigüedad
    m = re.search(r"Antig[uü]edad\s*:?\s*(\d+)", features_text, re.I)
    if m:
        result["antiguedad"] = int(m.group(1))

    # Orientación — compass or intercardinal abbreviation
    m = re.search(r"Orientaci[oó]n\s*:?\s*([A-Za-z]+)", features_text, re.I)
    if m:
        ori_key = m.group(1).strip().lower()
        mapped = _ORI_MAP.get(ori_key)
        if mapped:
            result["orientacion"] = mapped

    # Surface covered
    m = re.search(r"Sup\.?\s*Cubierta\s*:?\s*([\d.,]+)", features_text, re.I)
    if m:
        result["superficie_cubierta"] = float(m.group(1).replace(",", "."))

    # Surface semi-covered and total to derive uncovered
    m_semi = re.search(r"Sup\.?\s*Semicubierta\s*:?\s*([\d.,]+)", features_text, re.I)
    if m_semi:
        result["superficie_semicubierta"] = float(m_semi.group(1).replace(",", "."))

    m_tot = re.search(r"Sup\.?\s*Total\s*:?\s*([\d.,]+)", features_text, re.I)
    m_cub = re.search(r"Sup\.?\s*Cubierta\s*:?\s*([\d.,]+)", features_text, re.I)
    if m_tot and m_cub:
        tot = float(m_tot.group(1).replace(",", "."))
        cub = float(m_cub.group(1).replace(",", "."))
        semi = result.get("superficie_semicubierta", 0)
        uncovered = round(tot - cub - semi, 1)
        if uncovered > 0:
            result["superficie_descubierta"] = uncovered

    # Floor number (piso)
    m = re.search(r"Piso\s*:?\s*(\d+)", features_text, re.I)
    if m:
        result["piso"] = int(m.group(1))

    # Cochera
    if re.search(r"\bCochera\b", features_text, re.I):
        result["cochera"] = True

    # Pileta / piscina
    if re.search(r"\b(Pileta|Piscina)\b", features_text, re.I):
        result["pileta"] = True

    return result


def _parse_ldjson(soup: BeautifulSoup) -> dict:
    """Parse JSON-LD scripts for address, surface, type, and publication date."""
    result: dict = {}
    upload_date = None

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            d = json.loads(script.string or "")
        except Exception:
            continue

        schema_type = d.get("@type", "")

        if schema_type in ("Apartment", "House", "SingleFamilyResidence", "RealEstateListing"):
            # Address
            if "direccion" not in result:
                addr = d.get("address", {})
                street = addr.get("streetAddress", "").strip()
                region = addr.get("addressRegion", "").strip()
                if street:
                    result["direccion"] = f"{street}, {region}".strip(", ") if region else street

            # Surface
            if "superficie_cubierta" not in result:
                floor_size = d.get("floorSize", {})
                if isinstance(floor_size, dict) and floor_size.get("value"):
                    try:
                        result["superficie_cubierta"] = float(floor_size["value"])
                    except (ValueError, TypeError):
                        pass

            # Type
            if "tipo" not in result:
                raw = schema_type.lower()
                if raw == "apartment":
                    result["tipo"] = "Departamento"
                elif raw in ("house", "singlefamilyresidence"):
                    result["tipo"] = "Casa"

            # Publication date
            for key in ("datePosted", "datePublished", "uploadDate"):
                if d.get(key):
                    upload_date = d[key]
                    break

        elif schema_type == "VideoObject" and not upload_date:
            # Argenprop puts the listing publication date in the VideoObject
            if d.get("uploadDate"):
                upload_date = d["uploadDate"]

    # Days on market from publication date
    if upload_date and "dias_mercado" not in result:
        try:
            pub = datetime.fromisoformat(upload_date.replace("Z", "+00:00"))
            result["dias_mercado"] = max(0, (datetime.now(timezone.utc) - pub).days)
        except Exception:
            pass

    return result


def _parse_price_html(soup: BeautifulSoup) -> dict:
    """Fallback: scrape visible price element from the DOM."""
    result: dict = {}

    # Argenprop shows price in .titlebar__price or [class*="price"]
    for sel in (".titlebar__price", "[class*='price']"):
        for el in soup.select(sel):
            text = el.get_text(" ", strip=True)
            # USD price
            m = re.search(r"USD\s*([\d.,]+)", text, re.I)
            if m:
                try:
                    val = int(float(m.group(1).replace(".", "").replace(",", "")))
                    if 1_000 < val < 100_000_000:
                        result["precio"] = val
                        result["_currency"] = "USD"
                        return result
                except (ValueError, TypeError):
                    pass
            # ARS price
            m = re.search(r"\$\s*([\d.,]+)", text)
            if m:
                try:
                    val = int(float(m.group(1).replace(".", "").replace(",", "")))
                    if 1_000 < val < 100_000_000:
                        result["precio"] = val
                        result["_currency"] = "ARS"
                        return result
                except (ValueError, TypeError):
                    pass

    return result


class ArgenpropSource(BaseSource):
    @staticmethod
    def can_handle(url: str) -> bool:
        return "argenprop.com" in url

    async def extract(self, url: str, client: httpx.AsyncClient) -> dict:
        try:
            r = await client.get(url)
            if r.status_code == 403:
                html = await _browser.fetch_rendered(url)
            else:
                r.raise_for_status()
                html = r.text
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(502, f"Error al acceder a Argenprop: {e}")

        soup = BeautifulSoup(html, "html.parser")

        # Merge all parsers — more specific wins
        result: dict = {}
        result.update(_parse_ldjson(soup))
        result.update(_parse_features_section(soup))

        # Hidden input for price + tipo (highest fidelity source)
        hidden = _parse_hidden_input(soup)
        if "precio" not in result and "precio" in hidden:
            result["precio"] = hidden["precio"]
            result["_currency"] = hidden.get("_currency", "ARS")
        if "tipo" not in result and "tipo" in hidden:
            result["tipo"] = hidden["tipo"]

        # Price HTML fallback
        if "precio" not in result:
            result.update(_parse_price_html(soup))

        # Fallback address from hidden input location
        if "direccion" not in result:
            barrio = hidden.get("_barrio", "")
            localidad = hidden.get("_localidad", "")
            if barrio:
                result["direccion"] = f"{barrio}, {localidad}".strip(", ")

        # Strip internal keys
        result.pop("_barrio", None)
        result.pop("_localidad", None)
        result.pop("_currency", None)

        if not result:
            raise HTTPException(422, "No se pudieron extraer datos de Argenprop")

        return result
