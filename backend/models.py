import enum
import os
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String, create_engine
)
from sqlalchemy.orm import DeclarativeBase, relationship, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////data/acm.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class TipoPropiedad(str, enum.Enum):
    departamento = "Departamento"
    casa = "Casa"
    ph = "PH"
    local = "Local"


class Orientacion(str, enum.Enum):
    norte = "Norte"
    sur = "Sur"
    este = "Este"
    oeste = "Oeste"
    interno = "Interno"


class EstadoPropiedad(str, enum.Enum):
    refaccionado = "Refaccionado"
    standard = "Standard"
    a_refaccionar = "A refaccionar"


class CalidadPropiedad(str, enum.Enum):
    superior = "Superior"
    standard = "Standard"
    inferior = "Inferior"


class Distribucion(str, enum.Enum):
    buena = "Buena"
    regular = "Regular"


class StageACM(str, enum.Enum):
    borrador = "Borrador"
    en_progreso = "En progreso"
    finalizado = "Finalizado"


class ACM(Base):
    __tablename__ = "acm"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    notas = Column(String, nullable=True)

    direccion = Column(String, nullable=False)
    tipo = Column(Enum(TipoPropiedad), nullable=False)
    superficie_cubierta = Column(Float, nullable=False)
    superficie_semicubierta = Column(Float, nullable=True)
    superficie_descubierta = Column(Float, nullable=True)
    piso = Column(Integer, nullable=True)
    antiguedad = Column(Integer, nullable=True)
    orientacion = Column(Enum(Orientacion), nullable=True)
    estado = Column(Enum(EstadoPropiedad), nullable=True)
    calidad = Column(Enum(CalidadPropiedad), nullable=True)
    cochera = Column(Boolean, default=False)
    pileta = Column(Boolean, default=False)
    distribucion = Column(Enum(Distribucion), nullable=True)

    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    stage = Column(Enum(StageACM), nullable=True, default=StageACM.borrador)

    comparables = relationship("Comparable", back_populates="acm", cascade="all, delete-orphan")
    owner = relationship("User", back_populates="acms")


class Comparable(Base):
    __tablename__ = "comparable"

    id = Column(Integer, primary_key=True, index=True)
    acm_id = Column(Integer, ForeignKey("acm.id"), nullable=False)

    url = Column(String, nullable=True)
    precio = Column(Float, nullable=False)
    dias_mercado = Column(Integer, nullable=True)
    oportunidad_mercado = Column(Boolean, default=False)

    direccion = Column(String, nullable=True)
    tipo = Column(Enum(TipoPropiedad), nullable=True)
    superficie_cubierta = Column(Float, nullable=False)
    superficie_semicubierta = Column(Float, nullable=True)
    superficie_descubierta = Column(Float, nullable=True)
    piso = Column(Integer, nullable=True)
    antiguedad = Column(Integer, nullable=True)
    orientacion = Column(Enum(Orientacion), nullable=True)
    estado = Column(Enum(EstadoPropiedad), nullable=True)
    calidad = Column(Enum(CalidadPropiedad), nullable=True)
    cochera = Column(Boolean, default=False)
    pileta = Column(Boolean, default=False)
    distribucion = Column(Enum(Distribucion), nullable=True)

    # Factores base (auto-calculados, override manual)
    factor_antiguedad = Column(Float, nullable=True)
    factor_estado = Column(Float, nullable=True)
    factor_calidad = Column(Float, nullable=True)
    factor_superficie = Column(Float, nullable=True)
    factor_piso = Column(Float, nullable=True)
    factor_orientacion = Column(Float, nullable=True)
    factor_distribucion = Column(Float, nullable=True)
    factor_oferta = Column(Float, nullable=True)
    factor_oportunidad = Column(Float, nullable=True)

    # Factores avanzados
    factor_cochera = Column(Float, nullable=True)
    factor_pileta = Column(Float, nullable=True)
    factor_luminosidad = Column(Float, nullable=True)
    factor_vistas = Column(Float, nullable=True)
    factor_amenities = Column(Float, nullable=True)

    acm = relationship("ACM", back_populates="comparables")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)

    acms = relationship("ACM", back_populates="owner")
