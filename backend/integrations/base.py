from abc import ABC, abstractmethod


class BaseAdapter(ABC):
    """Each integration implements this interface."""

    @abstractmethod
    def can_handle(self, url: str) -> bool:
        """Return True if this adapter handles the given URL."""

    @abstractmethod
    async def extract(self, url: str, settings: dict) -> dict:
        """
        Fetch and parse property data from the URL.
        settings: dict of integration-specific credentials/config from DB.
        Returns a dict with any subset of:
          precio, direccion, superficie_cubierta, superficie_descubierta,
          tipo, antiguedad, orientacion, dias_mercado
        Raises HTTPException on failure.
        """
