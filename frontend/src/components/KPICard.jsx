import React from 'react'
import Tooltip from './Tooltip.jsx'

export default function KPICard({ label, value, unit, highlight, tooltip, sub }) {
  return (
    <div className={`kpi-card${highlight ? ' highlight' : ''}`}>
      <div className="kpi-value">{value}</div>
      {unit && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{unit}</div>}
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>{sub}</div>}
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
