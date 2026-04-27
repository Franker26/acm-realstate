import math
from dataclasses import dataclass, field
from typing import Optional

from models import CalidadPropiedad, Distribucion, EstadoPropiedad, Orientacion

DEFAULTS = {
    # Base
    "antiguedad_por_decada": 0.05,
    "estado_a_refaccionar": 0.10,
    "calidad_superior": 0.90,
    "calidad_inferior": 1.10,
    "superficie_por_decima": 0.02,
    "piso_por_nivel": 0.015,
    "orientacion_sur_vs_norte": 0.05,
    "orientacion_interno": 0.10,
    "distribucion_mala": 0.05,
    "oferta_mas_de_un_anio": 0.88,
    "oferta_menos_de_un_anio": 0.90,
    "oportunidad_mercado": 0.95,
    # Avanzados
    "cochera": 0.05,
    "pileta": 0.08,
}


@dataclass
class PropertySnapshot:
    superficie_cubierta: float
    superficie_semicubierta: Optional[float] = None
    superficie_descubierta: Optional[float] = None
    piso: Optional[int] = None
    antiguedad: Optional[int] = None
    orientacion: Optional[str] = None
    estado: Optional[str] = None
    calidad: Optional[str] = None
    distribucion: Optional[str] = None
    cochera: Optional[bool] = None
    pileta: Optional[bool] = None

    @property
    def superficie_homogeneizada(self) -> float:
        return (
            self.superficie_cubierta
            + 0.5 * (self.superficie_semicubierta or 0)
            + 0.3 * (self.superficie_descubierta or 0)
        )


def _factor_antiguedad(subject: PropertySnapshot, comp: PropertySnapshot, defaults: dict) -> float:
    if subject.antiguedad is None or comp.antiguedad is None:
        return 1.0
    diff_decadas = (subject.antiguedad - comp.antiguedad) / 10.0
    return 1.0 + diff_decadas * defaults["antiguedad_por_decada"]


def _factor_estado(subject: PropertySnapshot, comp: PropertySnapshot, defaults: dict) -> float:
    orden = {
        EstadoPropiedad.refaccionado: 2,
        EstadoPropiedad.standard: 1,
        EstadoPropiedad.a_refaccionar: 0,
    }
    if subject.estado is None or comp.estado is None:
        return 1.0
    s = orden.get(subject.estado, 1)
    c = orden.get(comp.estado, 1)
    if c < s:
        return 1.0 + defaults["estado_a_refaccionar"]
    if c > s:
        return 1.0 - defaults["estado_a_refaccionar"]
    return 1.0


def _factor_calidad(subject: PropertySnapshot, comp: PropertySnapshot, defaults: dict) -> float:
    if subject.calidad is None or comp.calidad is None:
        return 1.0
    if comp.calidad == CalidadPropiedad.superior and subject.calidad != CalidadPropiedad.superior:
        return defaults["calidad_superior"]
    if comp.calidad == CalidadPropiedad.inferior and subject.calidad != CalidadPropiedad.inferior:
        return defaults["calidad_inferior"]
    return 1.0


def _factor_superficie(subject: PropertySnapshot, comp: PropertySnapshot, defaults: dict) -> float:
    s_sup = subject.superficie_homogeneizada
    c_sup = comp.superficie_homogeneizada
    if c_sup <= 0:
        return 1.0
    ratio = (s_sup / c_sup) - 1.0
    raw = ratio * 0.2
    return 1.0 + max(-0.30, min(0.30, raw))


def _factor_piso(subject: PropertySnapshot, comp: PropertySnapshot, defaults: dict) -> float:
    if subject.piso is None or comp.piso is None:
        return 1.0
    diff = subject.piso - comp.piso
    return 1.0 + diff * defaults["piso_por_nivel"]


def _factor_orientacion(subject: PropertySnapshot, comp: PropertySnapshot, defaults: dict) -> float:
    if subject.orientacion is None or comp.orientacion is None:
        return 1.0
    if comp.orientacion == Orientacion.interno:
        return 1.0 + defaults["orientacion_interno"]
    if comp.orientacion == Orientacion.sur and subject.orientacion == Orientacion.norte:
        return 1.0 + defaults["orientacion_sur_vs_norte"]
    return 1.0


def _factor_distribucion(subject: PropertySnapshot, comp: PropertySnapshot, defaults: dict) -> float:
    if subject.distribucion is None or comp.distribucion is None:
        return 1.0
    if comp.distribucion == Distribucion.regular and subject.distribucion == Distribucion.buena:
        return 1.0 + defaults["distribucion_mala"]
    return 1.0


def _factor_oferta(dias_mercado: Optional[int], defaults: dict) -> float:
    if dias_mercado is None:
        return 1.0
    if dias_mercado > 365:
        return defaults["oferta_mas_de_un_anio"]
    return defaults["oferta_menos_de_un_anio"]


def _factor_oportunidad(oportunidad: bool, defaults: dict) -> float:
    return defaults["oportunidad_mercado"] if oportunidad else 1.0


def _factor_cochera(subject: PropertySnapshot, comp: PropertySnapshot, defaults: dict) -> float:
    s = bool(subject.cochera)
    c = bool(comp.cochera)
    if s and not c:
        return 1.0 + defaults["cochera"]
    if c and not s:
        return 1.0 - defaults["cochera"]
    return 1.0


def _factor_pileta(subject: PropertySnapshot, comp: PropertySnapshot, defaults: dict) -> float:
    s = bool(subject.pileta)
    c = bool(comp.pileta)
    if s and not c:
        return 1.0 + defaults["pileta"]
    if c and not s:
        return 1.0 - defaults["pileta"]
    return 1.0


def compute_adjusted_price(
    subject: PropertySnapshot,
    comp: PropertySnapshot,
    precio: float,
    dias_mercado: Optional[int],
    oportunidad_mercado: bool = False,
    overrides: Optional[dict] = None,
    defaults: Optional[dict] = None,
) -> dict:
    d = defaults or DEFAULTS
    ov = overrides or {}

    precio_m2 = precio / comp.superficie_cubierta

    def ov_or(key, fn):
        v = ov.get(key)
        return v if v is not None else fn()

    factores = {
        "factor_antiguedad":   ov_or("factor_antiguedad",   lambda: _factor_antiguedad(subject, comp, d)),
        "factor_estado":       ov_or("factor_estado",       lambda: _factor_estado(subject, comp, d)),
        "factor_calidad":      ov_or("factor_calidad",      lambda: _factor_calidad(subject, comp, d)),
        "factor_superficie":   ov_or("factor_superficie",   lambda: _factor_superficie(subject, comp, d)),
        "factor_piso":         ov_or("factor_piso",         lambda: _factor_piso(subject, comp, d)),
        "factor_orientacion":  ov_or("factor_orientacion",  lambda: _factor_orientacion(subject, comp, d)),
        "factor_distribucion": ov_or("factor_distribucion", lambda: _factor_distribucion(subject, comp, d)),
        "factor_oferta":       ov_or("factor_oferta",       lambda: _factor_oferta(dias_mercado, d)),
        "factor_oportunidad":  ov_or("factor_oportunidad",  lambda: _factor_oportunidad(oportunidad_mercado, d)),
        # Avanzados
        "factor_cochera":      ov_or("factor_cochera",      lambda: _factor_cochera(subject, comp, d)),
        "factor_pileta":       ov_or("factor_pileta",       lambda: _factor_pileta(subject, comp, d)),
        "factor_luminosidad":  ov_or("factor_luminosidad",  lambda: 1.0),
        "factor_vistas":       ov_or("factor_vistas",       lambda: 1.0),
        "factor_amenities":    ov_or("factor_amenities",    lambda: 1.0),
    }

    factor_total = math.prod(factores.values())
    precio_ajustado_m2 = precio_m2 * factor_total

    return {
        "precio_m2_publicado": precio_m2,
        "factor_total": factor_total,
        "precio_ajustado_m2": precio_ajustado_m2,
        "detalle_factores": factores,
    }


def compute_kpis(adjusted_prices: list[float], sup_homogeneizada_sujeto: float) -> dict:
    n = len(adjusted_prices)
    if n == 0:
        return {}
    mean = sum(adjusted_prices) / n
    sorted_p = sorted(adjusted_prices)
    mid = n // 2
    median = sorted_p[mid] if n % 2 else (sorted_p[mid - 1] + sorted_p[mid]) / 2
    variance = sum((p - mean) ** 2 for p in adjusted_prices) / n
    std = math.sqrt(variance)
    return {
        "mean_ajustado": mean,
        "median_ajustado": median,
        "std_ajustado": std,
        "min_ajustado": min(adjusted_prices),
        "max_ajustado": max(adjusted_prices),
        "valor_estimado_sujeto": mean * sup_homogeneizada_sujeto,
    }
