import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const PriceChart = forwardRef(function PriceChart({ comparables, mean }, ref) {
  const chartRef = useRef(null)

  useImperativeHandle(ref, () => ({
    getBase64() {
      if (!chartRef.current) return null
      return chartRef.current.canvas.toDataURL('image/png')
    },
  }))

  const prices = comparables.map((c) => Math.round(c.precio_ajustado_m2 ?? 0))
  const meanRound = mean ? Math.round(mean) : null

  const labels = comparables.map((c, i) => {
    const name = c.direccion || `#${i + 1}`
    return name.length > 22 ? name.slice(0, 20) + '…' : name
  })

  const data = {
    labels,
    datasets: [
      {
        label: 'USD/m² ajustado',
        data: prices,
        backgroundColor: prices.map((p) =>
          meanRound && p >= meanRound
            ? 'rgba(26, 58, 92, 0.85)'
            : 'rgba(26, 58, 92, 0.45)'
        ),
        borderColor: '#1a3a5c',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `USD ${ctx.raw.toLocaleString('es-AR')}/m²`,
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (v) => `USD ${v.toLocaleString('es-AR')}`,
        },
      },
    },
  }

  return (
    <>
      <div className="price-chart-shell">
        <Bar ref={chartRef} data={data} options={options} />
      </div>
      {meanRound && (
        <div className="price-chart-mean">
          — Promedio: USD {meanRound.toLocaleString('es-AR')}/m²
        </div>
      )}
    </>
  )
})

export default PriceChart
