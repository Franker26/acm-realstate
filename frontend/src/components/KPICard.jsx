import React from 'react'
import Tooltip from './Tooltip.jsx'

export default function KPICard({ label, value, unit, highlight, tooltip, sub }) {
  return (
    <div className={`kpi-card${highlight ? ' highlight' : ''}`}>
      <div className="kpi-value">{value}</div>
      {unit && <div className="kpi-unit">{unit}</div>}
      {sub && <div className="kpi-sub">{sub}</div>}
      <div className="kpi-label">
        {label}
        {tooltip && (
          <Tooltip text={tooltip}>
            <span className="kpi-help">?</span>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
