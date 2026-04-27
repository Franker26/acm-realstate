import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { generatePDF } from '../api.js'
import { useWizard, WizardNav } from '../App.jsx'

function fmt(n) {
  return n != null ? `USD ${Math.round(n).toLocaleString('es-AR')}` : '—'
}

export default function ExportarPDF() {
  const { id } = useParams()
  const { state, chartRef } = useWizard()
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const resultado = state.resultado

  async function handleDownload() {
    setGenerating(true)
    setError(null)
    setSuccess(false)
    try {
      const chartB64 = chartRef.current?.getBase64() || null
      await generatePDF(id, chartB64)
      setSuccess(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      <WizardNav currentStep={5} />
      <div className="step-header">
        <h1>Exportar Informe PDF</h1>
        <p>Descargá el informe completo del ACM en formato PDF.</p>
      </div>

      {!resultado && (
        <div className="alert alert-error">
          No hay resultados calculados. Volvé al paso 4.
        </div>
      )}

      {resultado && (
        <div className="card">
          <h2>Resumen de resultados</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Promedio ajustado</div>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1a3a5c' }}>{fmt(resultado.mean_ajustado)}<span style={{ fontSize: 12 }}>/m²</span></div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Rango</div>
              <div style={{ fontSize: 14, color: '#333' }}>
                {fmt(resultado.min_ajustado)} — {fmt(resultado.max_ajustado)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Valor estimado sujeto</div>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1a3a5c' }}>{fmt(resultado.valor_estimado_sujeto)}</div>
            </div>
          </div>

          <p style={{ fontSize: 13, color: '#555', marginBottom: 16 }}>
            El PDF incluye la ficha de la propiedad sujeto, la tabla de comparables con sus ponderadores,
            los KPIs de la tasación y el gráfico de precios ajustados.
          </p>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">PDF descargado correctamente.</div>}

          <button className="btn btn-primary" onClick={handleDownload} disabled={generating}>
            {generating && <span className="spinner" />}
            {generating ? 'Generando PDF...' : 'Descargar PDF'}
          </button>
        </div>
      )}

      <div className="btn-group">
        <button className="btn btn-secondary" onClick={() => navigate(`/acm/${id}/step/4`)}>← Paso 4</button>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>Ir al inicio</button>
      </div>
    </div>
  )
}
