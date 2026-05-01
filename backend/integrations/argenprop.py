import httpx
from fastapi import HTTPException

from .base import BaseAdapter


class ArgenpropAdapter(BaseAdapter):
    def can_handle(self, url: str) -> bool:
        return "argenprop.com" in url

    async def extract(self, url: str, settings: dict) -> dict:
        scraper_url = settings.get("scraper_service_url")
        if not scraper_url:
            raise HTTPException(
                503,
                "El scraper no está configurado. "
                "Contactá al administrador de la plataforma.",
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
            raise HTTPException(502, f"Scraper de Argenprop no disponible: {e}")
