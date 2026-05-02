import base64
import io
import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)

SUBJECT_COLOR = "#1a3a5c"
COMP_COLOR = "#e85d04"


def _geocode(geolocator, address: str) -> Optional[tuple]:
    try:
        loc = geolocator.geocode(address, timeout=10)
        if loc:
            return (loc.longitude, loc.latitude)
    except Exception as e:
        logger.warning(f"Geocoding failed for '{address}': {e}")
    return None


def generate_map_image(
    subject_address: str,
    comparable_addresses: list,
    width: int = 760,
    height: int = 340,
) -> Optional[str]:
    """
    Geocode subject + comparables, render a static OSM map, return base64 PNG.
    Returns None if geocoding fails or dependencies are missing.
    """
    try:
        from geopy.geocoders import Nominatim
        from staticmap import StaticMap, CircleMarker
    except ImportError:
        logger.warning("staticmap or geopy not installed — map generation skipped")
        return None

    try:
        geolocator = Nominatim(user_agent="reval-app-acm/1.0 (contact@reval.app)")

        subject_coords = _geocode(geolocator, subject_address)
        if not subject_coords:
            logger.warning(f"Could not geocode subject: {subject_address}")
            return None

        m = StaticMap(
            width,
            height,
            url_template="https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            headers={"User-Agent": "reval-app-acm/1.0"},
        )

        # Comparable markers first (so subject renders on top)
        for addr in comparable_addresses:
            if not addr:
                continue
            time.sleep(1.1)  # Nominatim: 1 request/sec policy
            coords = _geocode(geolocator, addr)
            if coords:
                m.add_marker(CircleMarker(coords, COMP_COLOR, 16))
                m.add_marker(CircleMarker(coords, "white", 8))

        # Subject marker on top (larger, brand color)
        m.add_marker(CircleMarker(subject_coords, SUBJECT_COLOR, 22))
        m.add_marker(CircleMarker(subject_coords, "white", 12))

        image = m.render()
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        buf.seek(0)
        return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"

    except Exception as e:
        logger.error(f"Map generation error: {e}")
        return None
