from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, computed_field, field_validator

from models import (
    CalidadPropiedad, Distribucion, EstadoPropiedad, Orientacion, TipoPropiedad
)


class PropertyBase(BaseModel):
    tipo: TipoPropiedad
    superficie_cubierta: float
    superficie_semicubierta: Optional[float] = None
    superficie_descubierta: Optional[float] = None
    piso: Optional[int] = None
    antiguedad: Optional[int] = None
    orientacion: Optional[Orientacion] = None
    estado: Optional[EstadoPropiedad] = None
    calidad: Optional[CalidadPropiedad] = None
    cochera: bool = False
    pileta: bool = False
    distribucion: Optional[Distribucion] = None

    @field_validator("superficie_cubierta")
    @classmethod
    def superficie_positiva(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("superficie_cubierta debe ser mayor a 0")
        return v

    @computed_field
    @property
    def superficie_homogeneizada(self) -> float:
        return (
            self.superficie_cubierta
            + 0.5 * (self.superficie_semicubierta or 0)
            + 0.3 * (self.superficie_descubierta or 0)
        )


class ACMCreate(PropertyBase):
    nombre: str
    notas: Optional[str] = None
    direccion: str


class ACMUpdate(BaseModel):
    nombre: Optional[str] = None
    notas: Optional[str] = None
    direccion: Optional[str] = None
    tipo: Optional[TipoPropiedad] = None
    superficie_cubierta: Optional[float] = None
    superficie_semicubierta: Optional[float] = None
    superficie_descubierta: Optional[float] = None
    piso: Optional[int] = None
    antiguedad: Optional[int] = None
    orientacion: Optional[Orientacion] = None
    estado: Optional[EstadoPropiedad] = None
    calidad: Optional[CalidadPropiedad] = None
    cochera: Optional[bool] = None
    pileta: Optional[bool] = None
    distribucion: Optional[Distribucion] = None


class ComparableCreate(PropertyBase):
    direccion: Optional[str] = None
    url: Optional[str] = None
    precio: float
    dias_mercado: Optional[int] = None
    oportunidad_mercado: bool = False


class ComparableUpdate(BaseModel):
    direccion: Optional[str] = None
    url: Optional[str] = None
    precio: Optional[float] = None
    dias_mercado: Optional[int] = None
    oportunidad_mercado: Optional[bool] = None
    tipo: Optional[TipoPropiedad] = None
    superficie_cubierta: Optional[float] = None
    superficie_semicubierta: Optional[float] = None
    superficie_descubierta: Optional[float] = None
    piso: Optional[int] = None
    antiguedad: Optional[int] = None
    orientacion: Optional[Orientacion] = None
    estado: Optional[EstadoPropiedad] = None
    calidad: Optional[CalidadPropiedad] = None
    cochera: Optional[bool] = None
    pileta: Optional[bool] = None
    distribucion: Optional[Distribucion] = None
    # Factores base
    factor_antiguedad: Optional[float] = None
    factor_estado: Optional[float] = None
    factor_calidad: Optional[float] = None
    factor_superficie: Optional[float] = None
    factor_piso: Optional[float] = None
    factor_orientacion: Optional[float] = None
    factor_distribucion: Optional[float] = None
    factor_oferta: Optional[float] = None
    factor_oportunidad: Optional[float] = None
    # Factores avanzados
    factor_cochera: Optional[float] = None
    factor_pileta: Optional[float] = None
    factor_luminosidad: Optional[float] = None
    factor_vistas: Optional[float] = None
    factor_amenities: Optional[float] = None


class ComparableRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    acm_id: int
    url: Optional[str]
    precio: float
    dias_mercado: Optional[int]
    oportunidad_mercado: bool
    direccion: Optional[str]
    tipo: Optional[TipoPropiedad]
    superficie_cubierta: float
    superficie_semicubierta: Optional[float]
    superficie_descubierta: Optional[float]
    piso: Optional[int]
    antiguedad: Optional[int]
    orientacion: Optional[Orientacion]
    estado: Optional[EstadoPropiedad]
    calidad: Optional[CalidadPropiedad]
    cochera: bool
    pileta: bool
    distribucion: Optional[Distribucion]
    # Factores base
    factor_antiguedad: Optional[float]
    factor_estado: Optional[float]
    factor_calidad: Optional[float]
    factor_superficie: Optional[float]
    factor_piso: Optional[float]
    factor_orientacion: Optional[float]
    factor_distribucion: Optional[float]
    factor_oferta: Optional[float]
    factor_oportunidad: Optional[float]
    # Factores avanzados
    factor_cochera: Optional[float]
    factor_pileta: Optional[float]
    factor_luminosidad: Optional[float]
    factor_vistas: Optional[float]
    factor_amenities: Optional[float]
    # Calculados
    precio_m2_publicado: Optional[float] = None
    precio_ajustado_m2: Optional[float] = None

    @computed_field
    @property
    def superficie_homogeneizada(self) -> float:
        return (
            self.superficie_cubierta
            + 0.5 * (self.superficie_semicubierta or 0)
            + 0.3 * (self.superficie_descubierta or 0)
        )


class ACMRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    fecha_creacion: datetime
    notas: Optional[str]
    direccion: str
    tipo: TipoPropiedad
    superficie_cubierta: float
    superficie_semicubierta: Optional[float]
    superficie_descubierta: Optional[float]
    piso: Optional[int]
    antiguedad: Optional[int]
    orientacion: Optional[Orientacion]
    estado: Optional[EstadoPropiedad]
    calidad: Optional[CalidadPropiedad]
    cochera: bool
    pileta: bool
    distribucion: Optional[Distribucion]
    comparables: list[ComparableRead] = []

    @computed_field
    @property
    def superficie_homogeneizada(self) -> float:
        return (
            self.superficie_cubierta
            + 0.5 * (self.superficie_semicubierta or 0)
            + 0.3 * (self.superficie_descubierta or 0)
        )


class ACMSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    fecha_creacion: datetime
    direccion: str
    cantidad_comparables: int = 0


class ComparableResultado(BaseModel):
    id: int
    direccion: Optional[str]
    url: Optional[str]
    precio: float
    precio_m2_publicado: float
    factor_total: float
    precio_ajustado_m2: float
    detalle_factores: dict


class ResultadoResponse(BaseModel):
    acm_id: int
    mean_ajustado: float
    median_ajustado: float
    std_ajustado: float
    min_ajustado: float
    max_ajustado: float
    valor_estimado_sujeto: float
    comparables: list[ComparableResultado]


class PdfRequest(BaseModel):
    chart_image_b64: Optional[str] = None


class PonderadoresDefaults(BaseModel):
    antiguedad_por_decada: float
    estado_a_refaccionar: float
    calidad_superior: float
    calidad_inferior: float
    superficie_por_decima: float
    piso_por_nivel: float
    orientacion_sur_vs_norte: float
    orientacion_interno: float
    distribucion_mala: float
    oferta_mas_de_un_anio: float
    oferta_menos_de_un_anio: float
    oportunidad_mercado: float
    cochera: float
    pileta: float
