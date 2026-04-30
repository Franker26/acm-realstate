from fastapi import HTTPException

from .mercadolibre import MercadoLibreAdapter
from .zonaprop import ZonapropAdapter

_ADAPTERS = [
    ZonapropAdapter(),
    MercadoLibreAdapter(),
]


async def extract(url: str, settings: dict) -> dict:
    """Detect source from URL and delegate to the matching adapter."""
    for adapter in _ADAPTERS:
        if adapter.can_handle(url):
            return await adapter.extract(url, settings)
    raise HTTPException(400, f"No hay integración disponible para esta URL.")
