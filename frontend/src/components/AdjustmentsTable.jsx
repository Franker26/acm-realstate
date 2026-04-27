import React from 'react'

const FACTOR_KEYS = [
  { key: 'factor_antiguedad', label: 'Antigüedad' },
  { key: 'factor_estado', label: 'Estado' },
  { key: 'factor_calidad', label: 'Calidad' },
  { key: 'factor_superficie', label: 'Superficie' },
  { key: 'factor_piso', label: 'Piso' },
  { key: 'factor_orientacion', label: 'Orientación' },
  { key: 'factor_distribucion', label: 'Distribución' },
  { key: 'factor_oferta', label: 'Oferta' },
  { key: 'factor_oportunidad', label: 'Oportunidad' },
]

export default function AdjustmentsTable({ comparables, overrides, onChange }) {
  function handleInput(compId, factorKey, value) {
    onChange(compId, factorKey, value === '' ? null : Number(value))
  }

  function getVal(comp, key) {
    const ov = overrides[comp.id]?.[key]
    if (ov !== undefined && ov !== null) return ov
    return comp[key] ?? ''
  }

  return (
    <div className="table-wrapper">
      <table className="pond-table">
        <thead>
          <tr>
            <th>Comparable</th>
            <th>Sup m²</th>
            <th>USD/m² pub.</th>
            {FACTOR_KEYS.map((f) => (
              <th key={f.key}>{f.label}</th>
            ))}
            <th>Factor total</th>
            <th>USD/m² ajust.</th>
          </tr>
        </thead>
        <tbody>
          {comparables.map((comp, i) => {
            const factorTotal = FACTOR_KEYS.reduce((prod, f) => {
              const v = getVal(comp, f.key)
              return prod * (v !== '' && v !== null ? Number(v) : 1)
            }, 1)
            const precioM2 = comp.precio_m2_publicado || comp.precio / comp.superficie_cubierta
            const ajustado = precioM2 * factorTotal
            return (
              <tr key={comp.id}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {comp.direccion || comp.url?.slice(0, 30) || `#${i + 1}`}
                </td>
                <td>{comp.superficie_cubierta}</td>
                <td>{Math.round(precioM2).toLocaleString('es-AR')}</td>
                {FACTOR_KEYS.map((f) => (
                  <td key={f.key}>
                    <input
                      type="number"
                      step="0.001"
                      value={getVal(comp, f.key)}
                      onChange={(e) => handleInput(comp.id, f.key, e.target.value)}
                    />
                  </td>
                ))}
                <td><strong>{factorTotal.toFixed(3)}</strong></td>
                <td><strong>{Math.round(ajustado).toLocaleString('es-AR')}</strong></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
