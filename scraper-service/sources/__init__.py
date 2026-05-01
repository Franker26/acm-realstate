from fastapi import HTTPException

from .argenprop import ArgenpropSource
from .mercadolibre import MercadoLibreSource
from .zonaprop import ZonapropSource

_SOURCES = [
    ZonapropSource(),
    ArgenpropSource(),
    MercadoLibreSource(),
]

SUPPORTED_SOURCES = ["zonaprop", "argenprop", "mercadolibre"]


async def extract(url: str, client) -> dict:
    for source in _SOURCES:
        if source.can_handle(url):
            return await source.extract(url, client)
    raise HTTPException(400, f"No hay soporte de scraping para esta URL.")
