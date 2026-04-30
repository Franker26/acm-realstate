import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getACM, getResultado, updateComparable } from '../api.js'
import { useWizard, WizardNav } from '../App.jsx'
import Tooltip from '../components/Tooltip.jsx'

const BASE_FACTORS = [
  {
    key: 'factor_antiguedad',
    label: 'Antigüedad',
    tooltip: 'Ajusta por diferencia de antigüedad entre la comparable y el sujeto. Cada 10 años de diferencia aplica ±5%.',
  },
  {
    key: 'factor_estado',
    label: 'Estado',
    tooltip: 'Compara el estado de conservación: Refaccionado > Standard > A refaccionar. Una categoría de diferencia aplica ±10%.',
  },
  {
    key: 'factor_calidad',
    label: 'Calidad',
    tooltip: 'Ajusta por diferencia en calidad constructiva: Superior, Standard o Inferior. Una categoría de diferencia aplica ±10%.',
  },
  {
    key: 'factor_superficie',
    label: 'Superficie',
    tooltip: 'Ajusta por economías de escala: unidades más grandes tienden a valer menos por m². Se aplica sobre la superficie homogeneizada (cubierta + 0.5×semi + 0.3×desc). Máximo ±30%.',
  },
  {
    key: 'factor_piso',
    label: 'Piso',
    tooltip: 'Ajusta por diferencia de piso. Cada nivel de diferencia aplica ±1.5%. Pisos más altos generalmente valen más.',
  },
  {
    key: 'factor_orientacion',
    label: 'Orientación',
    tooltip: 'Norte > Sur ≈ Este ≈ Oeste > Interno. Si la comparable es interna aplica +10%. Si es sur vs norte del sujeto aplica +5%.',
  },
  {
    key: 'factor_distribucion',
    label: 'Distribución',
    tooltip: 'Penaliza si la comparable tiene distribución Regular vs Buena del sujeto. Aplica ±5%.',
  },
  {
    key: 'factor_oferta',
    label: 'Oferta',
    tooltip: 'Descuenta el precio de oferta típico: ×0.90 si lleva menos de 1 año en mercado, ×0.88 si lleva más de 1 año.',
  },
  {
    key: 'factor_oportunidad',
    label: 'Oportunidad',
    tooltip: 'Si la comparable es una oportunidad de mercado (precio competitivo), se aplica ×0.95 adicional al precio publicado.',
  },
]

const ADV_FACTORS = [
  {
    key: 'factor_cochera',
    label: 'Cochera',
    tooltip: 'Ajusta si existe diferencia en cochera entre comparable y sujeto. ±5% por presencia/ausencia.',
  },
  {
    key: 'factor_pileta',
    label: 'Pileta',
    tooltip: 'Ajusta si existe diferencia en pileta entre comparable y sujeto. ±8% por presencia/ausencia.',
  },
  {
    key: 'factor_luminosidad',
    label: 'Luminosidad',
    tooltip: 'Ajuste manual libre por luminosidad. Sin valor por defecto; dejá en 1.000 si no aplica.',
  },
  {
    key: 'factor_vistas',
    label: 'Vistas',
    tooltip: 'Ajuste manual libre por calidad de vistas. Sin valor por defecto; dejá en 1.000 si no aplica.',
  },
  {
    key: 'factor_amenities',
    label: 'Amenities',
    tooltip: 'Ajuste manual libre por amenities del edificio (gym, sum, coworking, etc). Sin valor por defecto.',
  },
]

const ALL_FACTORS = [...BASE_FACTORS, ...ADV_FACTORS]

const MIN_SLIDER = 70
const MAX_SLIDER = 130
const CENTER = 100

function sliderToFactor(v) { return v / 100 }
function factorToSlider(f) {
  return Math.round(Math.max(MIN_SLIDER, Math.min(MAX_SLIDER, f * 100)))
}

function getTrackStyle(sliderVal) {
  const range = MAX_SLIDER - MIN_SLIDER
  const centerPct = ((CENTER - MIN_SLIDER) / range) * 100
  const fillPct   = ((sliderVal - MIN_SLIDER) / range) * 100
  const t = Math.abs(sliderVal - CENTER) / (range / 2)

  if (sliderVal === CENTER) return { background: '#e0e0e0' }

  if (sliderVal < CENTER) {
    const h = 210, s = Math.round(50 + t * 40), l = Math.round(55 - t * 15)
    const color = `hsl(${h},${s}%,${l}%)`
    return {
      background: `linear-gradient(to right,
        #f0f0f0 0%, #f0f0f0 ${fillPct}%,
        ${color} ${fillPct}%, ${color} ${centerPct}%,
        #e0e0e0 ${centerPct}%, #e0e0e0 100%)`,
    }
  }
  const h = 25, s = Math.round(60 + t * 40), l = Math.round(58 - t * 18)
  const color = `hsl(${h},${s}%,${l}%)`
  return {
    background: `linear-gradient(to right,
      #e0e0e0 0%, #e0e0e0 ${centerPct}%,
      ${color} ${centerPct}%, ${color} ${fillPct}%,
      #f0f0f0 ${fillPct}%, #f0f0f0 100%)`,
  }
}

function pctLabel(sliderVal) {
  const d = sliderVal - CENTER
  if (d === 0) return <span style={{ color: '#999', fontWeight: 500 }}>0%</span>
  const color = d > 0 ? '#e65100' : '#1565c0'
  return <span style={{ color, fontWeight: 700 }}>{d > 0 ? '+' : ''}{d}%</span>
}

function getContext(factorKey, comp, acm) {
  switch (factorKey) {
    case 'factor_antiguedad':
      if (comp.antiguedad != null && acm.antiguedad != null)
        return `Comp: ${comp.antiguedad}a · Sujeto: ${acm.antiguedad}a`
      return null
    case 'factor_estado':
      if (comp.estado && acm.estado) return `Comp: ${comp.estado} · Sujeto: ${acm.estado}`
      return null
    case 'factor_calidad':
      if (comp.calidad && acm.calidad) return `Comp: ${comp.calidad} · Sujeto: ${acm.calidad}`
      return null
    case 'factor_superficie': {
      const cH = (comp.superficie_cubierta + 0.5*(comp.superficie_semicubierta||0) + 0.3*(comp.superficie_descubierta||0)).toFixed(1)
      const aH = (acm.superficie_cubierta + 0.5*(acm.superficie_semicubierta||0) + 0.3*(acm.superficie_descubierta||0)).toFixed(1)
      return `Comp: ${cH} m² · Sujeto: ${aH} m²`
    }
    case 'factor_piso':
      if (comp.piso != null && acm.piso != null)
        return `Comp: piso ${comp.piso} · Sujeto: piso ${acm.piso}`
      return null
    case 'factor_orientacion':
      if (comp.orientacion && acm.orientacion)
        return `Comp: ${comp.orientacion} · Sujeto: ${acm.orientacion}`
      return null
    case 'factor_distribucion':
      if (comp.distribucion && acm.distribucion)
        return `Comp: ${comp.distribucion} · Sujeto: ${acm.distribucion}`
      return null
    case 'factor_oferta':
      return comp.dias_mercado != null ? `${comp.dias_mercado} días en mercado` : null
    case 'factor_oportunidad':
      return comp.oportunidad_mercado ? 'Precio competitivo' : 'Precio normal'
    case 'factor_cochera':
      return `Comp: ${comp.cochera ? 'con' : 'sin'} cochera · Sujeto: ${acm.cochera ? 'con' : 'sin'} cochera`
    case 'factor_pileta':
      return `Comp: ${comp.pileta ? 'con' : 'sin'} pileta · Sujeto: ${acm.pileta ? 'con' : 'sin'} pileta`
    default:
      return null
  }
}

function FactorSlider({ factorKey, label, tooltip, value, recommendation, context, onChange }) {
  const sliderVal = factorToSlider(value)
  const range = MAX_SLIDER - MIN_SLIDER
  const recPct = recommendation != null
    ? ((factorToSlider(recommendation) - MIN_SLIDER) / range) * 100
    : null

  return (
    <div className="factor-row">
      <span className="factor-row-label">
        {label}
        {tooltip && (
          <Tooltip text={tooltip}>
            <span className="factor-help">?</span>
          </Tooltip>
        )}
      </span>
      <div className="factor-row-track-wrap">
        <div className="factor-row-track">
          <input
            type="range"
            min={MIN_SLIDER}
            max={MAX_SLIDER}
            step={1}
            value={sliderVal}
            onChange={(e) => onChange(factorKey, sliderToFactor(Number(e.target.value)))}
            style={getTrackStyle(sliderVal)}
            className="factor-slider"
          />
        </div>
        {recPct != null && (
          <div className="rec-bar">
            <div
              className="rec-needle"
              style={{ left: `${recPct}%` }}
              title={`Recomendado por sistema: ${recommendation.toFixed(3)} (${Math.round((recommendation-1)*100) >= 0 ? '+' : ''}${Math.round((recommendation-1)*100)}%)`}
            />
          </div>
        )}
        {context && <div className="factor-context">{context}</div>}
      </div>
      <span className="factor-row-pct">{pctLabel(sliderVal)}</span>
      <span className="factor-row-val">{value.toFixed(3)}</span>
    </div>
  )
}

function factorTotal(factors, visibleFactors) {
  return visibleFactors.reduce((prod, f) => prod * (factors[f.key] ?? 1), 1)
}

function totalBadgeStyle(total) {
  const dev = Math.abs(total - 1)
  if (dev < 0.03) return { background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7' }
  if (dev < 0.10) return { background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' }
  return { background: '#fce4ec', color: '#c62828', border: '1px solid #ef9a9a' }
}

function ComparableCard({ comp, acm, factors, recommendations, advancedMode, onChange }) {
  const precioM2 = comp.precio_m2_publicado ?? (comp.precio / comp.superficie_cubierta)
  const visibleFactors = advancedMode ? ALL_FACTORS : BASE_FACTORS
  const total = factorTotal(factors, visibleFactors)
  const ajustado = precioM2 * total
  const style = totalBadgeStyle(total)

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, color: '#1a3a5c', fontSize: 15 }}>
            {comp.direccion || comp.url?.slice(0, 50) || `Comparable #${comp.id}`}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {comp.superficie_cubierta} m² · USD {comp.precio.toLocaleString('es-AR')} ·{' '}
            <strong>USD {Math.round(precioM2).toLocaleString('es-AR')}/m² pub.</strong>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
          <div style={{ ...style, borderRadius: 6, padding: '4px 10px', fontSize: 13, marginBottom: 3 }}>
            ×{total.toFixed(3)}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a3a5c' }}>
            USD {Math.round(ajustado).toLocaleString('es-AR')}/m²
          </div>
        </div>
      </div>

      <div className="factor-grid">
        {visibleFactors.map((f) => (
          <FactorSlider
            key={f.key}
            factorKey={f.key}
            label={f.label}
            tooltip={f.tooltip}
            value={factors[f.key] ?? 1}
            recommendation={recommendations?.[f.key]}
            context={getContext(f.key, comp, acm)}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  )
}

export default function AplicarPonderadores() {
  const { id } = useParams()
  const [acm, setAcm] = useState(null)
  const [comparables, setComparables] = useState([])
  const [factorMap, setFactorMap] = useState({})
  const [recommendMap, setRecommendMap] = useState({})
  const [advancedMode, setAdvancedMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const { dispatch } = useWizard()
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([getACM(id), getResultado(id).catch(() => null)])
      .then(([acmData, resultado]) => {
        setAcm(acmData)
        setComparables(acmData.comparables)
        dispatch({ type: 'SET_ACM_ID', payload: acmData.id })

        const initial = {}
        const recoms = {}
        for (const comp of acmData.comparables) {
          const computed = resultado?.comparables?.find((r) => r.id === comp.id)?.detalle_factores ?? {}
          recoms[comp.id] = computed
          initial[comp.id] = {}
          for (const f of ALL_FACTORS) {
            initial[comp.id][f.key] = comp[f.key] ?? computed[f.key] ?? 1
          }
        }
        setFactorMap(initial)
        setRecommendMap(recoms)

        const hasActiveAdv = acmData.comparables.some(comp =>
          ADV_FACTORS.some(f => {
            const v = comp[f.key]
            return v != null && Math.abs(v - 1) > 0.001
          })
        )
        if (hasActiveAdv) setAdvancedMode(true)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  function handleChange(compId, factorKey, value) {
    setFactorMap((prev) => ({
      ...prev,
      [compId]: { ...prev[compId], [factorKey]: value },
    }))
  }

  async function handleCalcular() {
    setSaving(true)
    setError(null)
    try {
      for (const comp of comparables) {
        await updateComparable(id, comp.id, factorMap[comp.id] || {})
      }
      navigate(`/acm/${id}/step/4`)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p style={{ padding: 24 }}>Cargando...</p>

  return (
    <div>
      <WizardNav currentStep={3} />
      <div className="step-header">
        <span className="page-eyebrow">Paso 3</span>
        <h1>Ponderadores de ajuste</h1>
        <p>
          Cada barra ajusta el precio de la comparable para equipararla a la sujeto.
          Centro = sin ajuste. <span style={{ color: '#e65100', fontWeight: 600 }}>Naranja</span> = comparable vale
          menos (se sube su precio). <span style={{ color: '#1565c0', fontWeight: 600 }}>Azul</span> = vale más (se baja).
          La <span style={{ fontWeight: 600 }}>aguja azul</span> indica el valor recomendado por el sistema.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="workflow-toolbar">
        <div className="workflow-toolbar__group">
          <span className="workflow-toolbar__label">Modo</span>
          <button
            className={`btn btn-sm ${advancedMode ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              if (advancedMode) {
                const hasActive = comparables.some(comp =>
                  ADV_FACTORS.some(f => Math.abs((factorMap[comp.id]?.[f.key] ?? 1) - 1) > 0.001)
                )
                if (hasActive) {
                  if (!window.confirm(
                    'Hay factores avanzados activos. Desactivar el modo avanzado los reseteará a 1.000 en todas las comparables. ¿Continuar?'
                  )) return
                  setFactorMap(prev => {
                    const next = { ...prev }
                    for (const comp of comparables) {
                      next[comp.id] = { ...next[comp.id] }
                      for (const f of ADV_FACTORS) next[comp.id][f.key] = 1
                    }
                    return next
                  })
                }
              }
              setAdvancedMode(v => !v)
            }}
          >
            {advancedMode ? 'Modo avanzado activo' : 'Activar modo avanzado'}
          </button>
        </div>
      </div>

      {advancedMode && (
        <div className="alert alert-info" style={{ marginBottom: 12, fontSize: 12 }}>
          Factores adicionales habilitados: cochera, pileta, luminosidad, vistas y amenities.
        </div>
      )}

      {comparables.map((comp) => (
        <ComparableCard
          key={comp.id}
          comp={comp}
          acm={acm}
          factors={factorMap[comp.id] || {}}
          recommendations={recommendMap[comp.id] || {}}
          advancedMode={advancedMode}
          onChange={(factorKey, value) => handleChange(comp.id, factorKey, value)}
        />
      ))}

      <div className="btn-group">
        <button className="btn btn-secondary" onClick={() => navigate(`/acm/${id}/step/2`)}>← Paso 2</button>
        <button className="btn btn-primary" onClick={handleCalcular} disabled={saving}>
          {saving && <span className="spinner" />}
          Calcular resultados →
        </button>
      </div>
    </div>
  )
}
