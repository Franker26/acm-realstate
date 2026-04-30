import httpx
from fastapi import HTTPException

from .base import BaseAdapter

_SCRAPER_SERVICE_TOKEN_KEY = "scraper_service_token"


class ZonapropAdapter(BaseAdapter):
    def can_handle(self, url: str) -> bool:
        return "zonaprop.com.ar" in url

    async def extract(self, url: str, settings: dict) -> dict:
        scraper_url = settings.get("scraper_service_url")
        if not scraper_url:
            raise HTTPException(
                503,
                "El scraper de Zonaprop no está configurado. "
                "Ingresá la URL del microservicio en Configuración → Integraciones.",
            )
        token = settings.get("scraper_service_token", "")
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(f"{scraper_url}/extract", json={"url": url}, headers=headers)
            if r.status_code == 200:
                return r.json()
            raise HTTPException(r.status_code, r.text)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(502, f"Scraper de Zonaprop no disponible: {e}")
