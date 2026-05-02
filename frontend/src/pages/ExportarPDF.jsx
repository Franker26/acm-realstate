import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getACM, getACMMap, getBrandingSettings } from '../api.js'
import { useWizard, WizardNav } from '../App.jsx'

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtUSD(n) {
  return n != null ? `USD ${Math.round(n).toLocaleString('es-AR')}` : '—'
}
function fmtM2(n) {
  return n != null ? `USD ${Math.round(n).toLocaleString('es-AR')}/m²` : '—'
}
function fmtFactor(n) {
  if (n == null) return '—'
  return n.toFixed(3)
}

function hexToRgb(hex) {
  const h = (hex || '#1a3a5c').replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function lighten([r, g, b], t = 0.88) {
  return [Math.round(r + (255 - r) * t), Math.round(g + (255 - g) * t), Math.round(b + (255 - b) * t)]
}

// ── Factor labels ─────────────────────────────────────────────────────────────

const FACTOR_LABELS = {
  factor_antiguedad:   'Antigüedad',
  factor_estado:       'Estado',
  factor_calidad:      'Calidad',
  factor_superficie:   'Superficie',
  factor_piso:         'Piso',
  factor_orientacion:  'Orientación',
  factor_distribucion: 'Distribución',
  factor_oferta:       'Oferta',
  factor_oportunidad:  'Oportunidad',
  factor_cochera:      'Cochera',
  factor_pileta:       'Pileta',
  factor_luminosidad:  'Luminosidad',
  factor_vistas:       'Vistas',
  factor_amenities:    'Amenities',
}

const FACTOR_LABELS_SHORT = {
  factor_antiguedad:   'Antig.',
  factor_estado:       'Estado',
  factor_calidad:      'Calidad',
  factor_superficie:   'Sup.',
  factor_piso:         'Piso',
  factor_orientacion:  'Orient.',
  factor_distribucion: 'Distrib.',
  factor_oferta:       'Oferta',
  factor_oportunidad:  'Oport.',
  factor_cochera:      'Cochera',
  factor_pileta:       'Pileta',
  factor_luminosidad:  'Lumin.',
  factor_vistas:       'Vistas',
  factor_amenities:    'Amenities',
}

// ── PDF builder ───────────────────────────────────────────────────────────────

const W = 210
const H = 297
const M = 14
const BW = W - 2 * M

export function buildPDF(acm, resultado, chartB64, branding, mapB64) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const primary = branding?.primary_color || '#1a3a5c'
  const appName = branding?.app_name || 'ACM Real Estate'
  const [pr, pg, pb] = hexToRgb(primary)
  const [lr, lg, lb] = lighten([pr, pg, pb], 0.88)
  const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })

  // ── Helpers ────────────────────────────────────────────────────────────────

  function pageHeader(title) {
    doc.setFillColor(pr, pg, pb)
    doc.rect(0, 0, W, 14, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.text(appName, M, 9.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text('Análisis Comparativo de Mercado', W - M, 9.5, { align: 'right' })

    doc.setFillColor(lr, lg, lb)
    doc.rect(0, 14, W, 11, 'F')
    doc.setTextColor(pr, pg, pb)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(title.toUpperCase(), M, 22)

    return 31
  }

  function sectionBar(y, title) {
    doc.setFillColor(pr, pg, pb)
    doc.rect(M, y, BW, 6, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text(title.toUpperCase(), M + 3, y + 4.2)
    return y + 8.5
  }

  function field(x, y, label, value) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(140, 140, 140)
    doc.text(label.toUpperCase(), x, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(30, 30, 30)
    doc.text(String(value ?? '—'), x, y + 4.2)
  }

  // ── PAGE 1: Cover ──────────────────────────────────────────────────────────

  // Hero band
  doc.setFillColor(pr, pg, pb)
  doc.rect(0, 0, W, 110, 'F')

  // Accent stripe
  doc.setFillColor(lr, lg, lb)
  doc.rect(0, 107, W, 5, 'F')

  // Title
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.text('ANÁLISIS COMPARATIVO', W / 2, 40, { align: 'center' })
  doc.setFontSize(24)
  doc.text('DE MERCADO', W / 2, 56, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(200, 215, 240)
  doc.text('INFORME DE TASACIÓN', W / 2, 68, { align: 'center' })

  // Thin divider line in hero
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.25)
  doc.line(M + 25, 76, W - M - 25, 76)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(180, 200, 235)
  doc.text(appName, W / 2, 85, { align: 'center' })
  doc.text(today, W / 2, 93, { align: 'center' })

  // Property name & address
  doc.setTextColor(pr, pg, pb)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  const nombre = acm.nombre || `ACM #${acm.id}`
  const nombreLines = doc.splitTextToSize(nombre, BW - 20)
  doc.text(nombreLines, W / 2, 127, { align: 'center' })

  const nameBlockH = nombreLines.length * 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(90, 90, 90)
  doc.text(acm.direccion || '', W / 2, 127 + nameBlockH, { align: 'center' })

  // Divider
  doc.setDrawColor(pr, pg, pb)
  doc.setLineWidth(0.4)
  doc.line(M + 35, 140 + nameBlockH, W - M - 35, 140 + nameBlockH)

  // Summary pills
  const pillY = 147 + nameBlockH
  const pillW = 54
  const pillH = 22
  const pillGap = 5
  const pills = [
    { label: 'Tipo de propiedad', value: acm.tipo || '—' },
    { label: 'Superficie cubierta', value: acm.superficie_cubierta ? `${acm.superficie_cubierta} m²` : '—' },
    { label: 'Comparables', value: resultado?.comparables?.length ?? '—' },
  ]
  const pillsW = pills.length * pillW + (pills.length - 1) * pillGap
  const pillStartX = (W - pillsW) / 2

  pills.forEach(({ label, value }, i) => {
    const px = pillStartX + i * (pillW + pillGap)
    doc.setFillColor(lr, lg, lb)
    doc.roundedRect(px, pillY, pillW, pillH, 2, 2, 'F')
    doc.setDrawColor(pr, pg, pb)
    doc.setLineWidth(0.2)
    doc.roundedRect(px, pillY, pillW, pillH, 2, 2, 'S')
    doc.setTextColor(pr, pg, pb)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.text(label.toUpperCase(), px + pillW / 2, pillY + 6.5, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.text(String(value), px + pillW / 2, pillY + 16, { align: 'center' })
  })

  // Valor estimado highlight box
  if (resultado?.valor_estimado_sujeto != null) {
    const boxY = pillY + pillH + 8
    doc.setFillColor(pr, pg, pb)
    doc.roundedRect(M + 35, boxY, BW - 70, 26, 3, 3, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text('VALOR ESTIMADO', W / 2, boxY + 8, { align: 'center' })
    doc.setFontSize(15)
    doc.text(fmtUSD(resultado.valor_estimado_sujeto), W / 2, boxY + 20, { align: 'center' })
  }

  // Bottom strip
  doc.setFillColor(245, 247, 250)
  doc.rect(0, H - 22, W, 22, 'F')
  doc.setDrawColor(224, 228, 236)
  doc.setLineWidth(0.25)
  doc.line(0, H - 22, W, H - 22)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text('Confidencial — uso exclusivo del destinatario', M, H - 13)
  doc.text(`Generado el ${today}`, W - M, H - 13, { align: 'right' })
  if (resultado) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(pr, pg, pb)
    doc.text(`Rango: ${fmtM2(resultado.min_ajustado)} — ${fmtM2(resultado.max_ajustado)}`, M, H - 7)
  }

  // ── PAGE 2: Subject + Map ──────────────────────────────────────────────────

  doc.addPage()
  let y = pageHeader('Propiedad Sujeto')

  y = sectionBar(y, 'Ficha de la propiedad')
  y += 2

  const fieldData = [
    ['Tipo', acm.tipo],
    ['Sup. cubierta', acm.superficie_cubierta ? `${acm.superficie_cubierta} m²` : null],
    ['Sup. semicubierta', acm.superficie_semicubierta ? `${acm.superficie_semicubierta} m²` : null],
    ['Sup. descubierta', acm.superficie_descubierta ? `${acm.superficie_descubierta} m²` : null],
    ['Piso', acm.piso != null ? acm.piso : null],
    ['Antigüedad', acm.antiguedad != null ? `${acm.antiguedad} años` : null],
    ['Orientación', acm.orientacion],
    ['Estado', acm.estado],
    ['Calidad', acm.calidad],
    ['Distribución', acm.distribucion],
    ['Cochera', acm.cochera ? 'Sí' : 'No'],
    ['Pileta', acm.pileta ? 'Sí' : 'No'],
  ]

  const nCols = 4
  const colW = BW / nCols
  const rowH = 11
  const gridRows = Math.ceil(fieldData.length / nCols)

  doc.setFillColor(248, 249, 252)
  doc.rect(M, y, BW, gridRows * rowH + 3, 'F')
  doc.setDrawColor(224, 228, 236)
  doc.setLineWidth(0.2)
  doc.rect(M, y, BW, gridRows * rowH + 3, 'S')

  // Column dividers
  for (let c = 1; c < nCols; c++) {
    doc.setDrawColor(224, 228, 236)
    doc.setLineWidth(0.15)
    doc.line(M + c * colW, y, M + c * colW, y + gridRows * rowH + 3)
  }

  fieldData.forEach(([label, value], i) => {
    const col = i % nCols
    const row = Math.floor(i / nCols)
    field(M + col * colW + 4, y + 4 + row * rowH, label, value)
  })

  y += gridRows * rowH + 7

  // Dirección completa
  y = sectionBar(y, 'Dirección')
  y += 2
  doc.setFillColor(248, 249, 252)
  doc.rect(M, y, BW, 10, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(30, 30, 30)
  doc.text(acm.direccion || '—', M + 4, y + 6.5)
  y += 14

  // Notes
  if (acm.notas) {
    y = sectionBar(y, 'Observaciones')
    y += 2
    doc.setFillColor(255, 253, 235)
    doc.setDrawColor(245, 200, 50)
    doc.setLineWidth(0.3)
    const notasLines = doc.splitTextToSize(acm.notas, BW - 10)
    const notasH = notasLines.length * 4.5 + 7
    doc.rect(M, y, BW, notasH, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(80, 65, 0)
    doc.text(notasLines, M + 4, y + 6)
    y += notasH + 6
  }

  // Map
  if (mapB64) {
    y = sectionBar(y, 'Ubicación — Propiedad sujeto y comparables')
    y += 2
    const mapH = Math.min(80, H - y - 22)
    if (mapH > 30) {
      doc.addImage(mapB64, 'PNG', M, y, BW, mapH)
      y += mapH + 4

      // Legend
      doc.setFillColor(pr, pg, pb)
      doc.circle(M + 4, y + 2.5, 3, 'F')
      doc.setFillColor(255, 255, 255)
      doc.circle(M + 4, y + 2.5, 1.5, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(50, 50, 50)
      doc.text('Propiedad sujeto', M + 10, y + 4)

      doc.setFillColor(232, 93, 4)
      doc.circle(M + 58, y + 2.5, 2.5, 'F')
      doc.setFillColor(255, 255, 255)
      doc.circle(M + 58, y + 2.5, 1.2, 'F')
      doc.text('Comparable', M + 64, y + 4)
    }
  }

  // ── PAGE 3: Comparables ────────────────────────────────────────────────────

  doc.addPage()
  y = pageHeader('Comparables')

  // Badge
  doc.setFillColor(lr, lg, lb)
  doc.roundedRect(M, y, 68, 9, 2, 2, 'F')
  doc.setTextColor(pr, pg, pb)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text(
    `${resultado.comparables.length} propiedades analizadas`,
    M + 4, y + 6.3
  )
  y += 13

  // Join acm.comparables (all fields) with resultado.comparables (prices + factors)
  const compById = {}
  ;(acm.comparables || []).forEach(c => { compById[c.id] = c })

  const compRows = resultado.comparables.map((rc, idx) => {
    const c = compById[rc.id] || {}
    return [
      idx + 1,
      rc.direccion || rc.url?.replace(/^https?:\/\/(www\.)?/, '').slice(0, 35) || '—',
      c.superficie_cubierta != null ? `${c.superficie_cubierta} m²` : '—',
      fmtUSD(rc.precio),
      fmtM2(rc.precio_m2_publicado),
      c.dias_mercado != null ? String(c.dias_mercado) : '—',
      c.antiguedad != null ? `${c.antiguedad} a` : '—',
      c.piso != null ? String(c.piso) : '—',
      c.estado || '—',
      c.calidad || '—',
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [['#', 'Dirección', 'Sup.', 'Precio', 'USD/m² pub.', 'Días', 'Antig.', 'Piso', 'Estado', 'Calidad']],
    body: compRows,
    styles: { fontSize: 7.5, cellPadding: [2.5, 2] },
    headStyles: { fillColor: [pr, pg, pb], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 43 },
      2: { cellWidth: 16, halign: 'right' },
      3: { cellWidth: 23, halign: 'right' },
      4: { cellWidth: 23, halign: 'right' },
      5: { cellWidth: 13, halign: 'center' },
      6: { cellWidth: 13, halign: 'center' },
      7: { cellWidth: 10, halign: 'center' },
      8: { cellWidth: 18 },
      9: { cellWidth: 15 },
    },
    margin: { left: M, right: M },
  })

  // Table note
  const afterTable = doc.lastAutoTable?.finalY ?? y + 40
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(150, 150, 150)
  doc.text('* Días = días en el mercado · Antig. = antigüedad en años · Sup. = superficie cubierta', M, afterTable + 5)

  // ── PAGE 4: Ponderadores ───────────────────────────────────────────────────

  doc.addPage()
  y = pageHeader('Ponderadores Aplicados')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(85, 85, 85)
  doc.text(
    'Los factores de homogeneización ajustan el precio publicado de cada comparable para equipararlo ' +
    'con las características de la propiedad sujeto. Valores > 1 favorecen al sujeto; < 1 lo desfavorecen.',
    M, y, { maxWidth: BW }
  )
  y += 14

  // Active factors: those where at least one comparable has value ≠ 1.0
  const allFactorKeys = Object.keys(FACTOR_LABELS)
  const activeFactors = allFactorKeys.filter(key =>
    resultado.comparables.some(rc => {
      const v = rc.detalle_factores?.[key]
      return v != null && Math.abs(v - 1.0) > 0.0005
    })
  )

  const ponderHead = [
    '#',
    'Comparable',
    ...activeFactors.map(k => FACTOR_LABELS_SHORT[k]),
    'Factor\nTotal',
    'USD/m²\najust.',
  ]

  const ponderRows = resultado.comparables.map((rc, idx) => {
    const df = rc.detalle_factores || {}
    return [
      idx + 1,
      rc.direccion?.slice(0, 30) || `Comparable ${idx + 1}`,
      ...activeFactors.map(k => fmtFactor(df[k] ?? 1.0)),
      fmtFactor(rc.factor_total),
      fmtUSD(rc.precio_ajustado_m2),
    ]
  })

  // Dynamic column widths for factor columns
  const fixedW = 8 + 40 + 16 + 22  // #, comparable, total, ajust
  const factorColW = activeFactors.length > 0
    ? Math.max(9, Math.floor((BW - fixedW) / activeFactors.length))
    : 12

  const ponderColStyles = {
    0: { cellWidth: 8, halign: 'center' },
    1: { cellWidth: 40 },
    [activeFactors.length + 2]: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
    [activeFactors.length + 3]: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
  }
  activeFactors.forEach((_, i) => {
    ponderColStyles[i + 2] = { cellWidth: factorColW, halign: 'center' }
  })

  autoTable(doc, {
    startY: y,
    head: [ponderHead],
    body: ponderRows,
    styles: { fontSize: 6.5, cellPadding: [2, 1.5] },
    headStyles: { fillColor: [pr, pg, pb], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5, halign: 'center' },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    columnStyles: ponderColStyles,
    didParseCell(data) {
      if (data.section !== 'body') return
      const isFactorCol = data.column.index >= 2 && data.column.index < activeFactors.length + 2
      if (!isFactorCol) return
      const val = parseFloat(data.cell.raw)
      if (isNaN(val)) return
      if (val > 1.0005) {
        data.cell.styles.textColor = [20, 120, 50]
        data.cell.styles.fontStyle = 'bold'
      } else if (val < 0.9995) {
        data.cell.styles.textColor = [180, 30, 30]
        data.cell.styles.fontStyle = 'bold'
      }
    },
    margin: { left: M, right: M },
  })

  // Color legend
  const legendY = doc.lastAutoTable?.finalY ?? y + 60
  doc.setFillColor(230, 245, 235)
  doc.roundedRect(M, legendY + 4, 55, 8, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(20, 120, 50)
  doc.text('Verde = factor > 1 (favorable al sujeto)', M + 3, legendY + 9.5)

  doc.setFillColor(250, 230, 230)
  doc.roundedRect(M + 58, legendY + 4, 55, 8, 1.5, 1.5, 'F')
  doc.setTextColor(180, 30, 30)
  doc.text('Rojo = factor < 1 (desfavorable al sujeto)', M + 61, legendY + 9.5)

  // ── PAGE 5: Resultados ─────────────────────────────────────────────────────

  doc.addPage()
  y = pageHeader('Resultados de la Tasación')

  // KPI grid (3 × 2)
  const kpiItems = [
    { label: 'Precio/m² promedio ajustado', value: fmtM2(resultado.mean_ajustado), highlight: false },
    { label: 'Mediana ajustada', value: fmtM2(resultado.median_ajustado), highlight: false },
    { label: 'Desviación estándar', value: `± ${fmtM2(resultado.std_ajustado)}`, highlight: false },
    { label: 'Mínimo ajustado', value: fmtM2(resultado.min_ajustado), highlight: false },
    { label: 'Máximo ajustado', value: fmtM2(resultado.max_ajustado), highlight: false },
    { label: 'VALOR ESTIMADO TOTAL', value: fmtUSD(resultado.valor_estimado_sujeto), highlight: true },
  ]

  const kpiCols = 3
  const kpiW = (BW - (kpiCols - 1) * 3) / kpiCols
  const kpiH = 22

  kpiItems.forEach(({ label, value, highlight }, i) => {
    const col = i % kpiCols
    const row = Math.floor(i / kpiCols)
    const kx = M + col * (kpiW + 3)
    const ky = y + row * (kpiH + 3)

    if (highlight) {
      doc.setFillColor(pr, pg, pb)
      doc.roundedRect(kx, ky, kpiW, kpiH, 2, 2, 'F')
      doc.setTextColor(255, 255, 255)
    } else {
      doc.setFillColor(lr, lg, lb)
      doc.roundedRect(kx, ky, kpiW, kpiH, 2, 2, 'F')
      doc.setTextColor(pr, pg, pb)
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.text(label.toUpperCase(), kx + kpiW / 2, ky + 6.5, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(highlight ? 11.5 : 9.5)
    doc.text(value, kx + kpiW / 2, ky + 16.5, { align: 'center' })
  })

  y += 2 * (kpiH + 3) + 8

  // Chart
  if (chartB64) {
    y = sectionBar(y, 'Distribución de precios ajustados por m²')
    y += 2
    const chartH = 65
    const spaceLeft = H - y - 22
    if (spaceLeft < chartH + 10) {
      doc.addPage()
      y = pageHeader('Gráfico de Precios') + 2
    }
    doc.addImage(chartB64, 'PNG', M, y, BW, chartH)
    y += chartH + 8
  }

  // Conclusion box
  const concH = 32
  if (y + concH > H - 22) {
    doc.addPage()
    y = 22
  }
  doc.setFillColor(pr, pg, pb)
  doc.roundedRect(M, y, BW, concH, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('CONCLUSIÓN', W / 2, y + 9, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  const sup = (acm.superficie_cubierta || 0)
    + 0.5 * (acm.superficie_semicubierta || 0)
    + 0.3 * (acm.superficie_descubierta || 0)
  const conclusion =
    `Tras analizar ${resultado.comparables.length} comparable${resultado.comparables.length !== 1 ? 's' : ''} en el mercado, ` +
    `el precio estimado por m² es de ${fmtM2(resultado.mean_ajustado)}, ` +
    (sup > 0
      ? `lo que resulta en un valor total estimado de ${fmtUSD(resultado.valor_estimado_sujeto)} ` +
        `para una superficie homogeneizada de ${Math.round(sup)} m².`
      : `resultando en un valor total estimado de ${fmtUSD(resultado.valor_estimado_sujeto)}.`)
  const concLines = doc.splitTextToSize(conclusion, BW - 16)
  doc.text(concLines, W / 2, y + 18, { align: 'center' })

  // ── Footer on all pages (skip cover) ──────────────────────────────────────

  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 2; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(224, 228, 236)
    doc.setLineWidth(0.2)
    doc.line(M, H - 9, W - M, H - 9)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(165, 165, 165)
    doc.text(`${appName} · ${nombre} · ${today}`, M, H - 5)
    doc.text(`Pág. ${i}/${pageCount}`, W - M, H - 5, { align: 'right' })
  }

  return doc
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExportarPDF() {
  const { id } = useParams()
  const { state, chartRef } = useWizard()
  const navigate = useNavigate()

  const [acm, setAcm] = useState(null)
  const [branding, setBranding] = useState(null)
  const [mapB64, setMapB64] = useState(null)
  const [mapLoading, setMapLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const resultado = state.resultado
  const blockedByApproval = acm?.requires_approval && acm?.approval_status !== 'Aprobado'

  useEffect(() => {
    getACM(id).then(setAcm).catch(e => setError(e.message))
    getBrandingSettings().then(setBranding).catch(() => {})
  }, [id])

  // Pre-fetch map as soon as component mounts so it's ready when user clicks
  useEffect(() => {
    setMapLoading(true)
    getACMMap(id)
      .then(data => setMapB64(data.map_image))
      .catch(() => setMapB64(null))
      .finally(() => setMapLoading(false))
  }, [id])

  async function handleDownload() {
    if (blockedByApproval || !resultado || !acm) return
    setGenerating(true)
    setError(null)
    setSuccess(false)
    try {
      const chartB64 = chartRef.current?.getBase64?.() || null
      const doc = buildPDF(acm, resultado, chartB64, branding, mapB64)
      doc.save(`acm_${id}.pdf`)
      setSuccess(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  function fmtUSDLocal(n) {
    return n != null ? `USD ${Math.round(n).toLocaleString('es-AR')}` : '—'
  }

  return (
    <div>
      <WizardNav currentStep={5} />

      <div className="step-header">
        <h1>Exportar Informe PDF</h1>
        <p>Informe profesional con ficha, mapa, ponderadores y resultados de la tasación.</p>
      </div>

      {!resultado && (
        <div className="alert alert-error">
          No hay resultados calculados. Volvé al paso 4.
        </div>
      )}

      {resultado && (
        <div className="card">
          <h2>Resumen</h2>

          {blockedByApproval && (
            <div className="alert alert-error">
              Esta tasación requiere aprobación antes de exportar.
              {acm?.approval_comments?.length > 0 && (
                <div className="pdf-approval-comments">
                  {acm.approval_comments.map(c => (
                    <div key={c.id}><strong>{c.section}:</strong> {c.message}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="pdf-summary-grid">
            <div className="pdf-summary-card">
              <div className="pdf-summary-card__label">Promedio ajustado</div>
              <div className="pdf-summary-card__value">
                {fmtUSDLocal(resultado.mean_ajustado)}<span>/m²</span>
              </div>
            </div>
            <div className="pdf-summary-card">
              <div className="pdf-summary-card__label">Rango</div>
              <div className="pdf-summary-card__text">
                {fmtUSDLocal(resultado.min_ajustado)} — {fmtUSDLocal(resultado.max_ajustado)}
              </div>
            </div>
            <div className="pdf-summary-card">
              <div className="pdf-summary-card__label">Valor estimado</div>
              <div className="pdf-summary-card__value">{fmtUSDLocal(resultado.valor_estimado_sujeto)}</div>
            </div>
          </div>

          <div className="pdf-summary-note" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            {mapLoading ? (
              <span style={{ fontSize: 13, color: '#888' }}>
                <span className="spinner" style={{ width: 14, height: 14, marginRight: 6 }} />
                Generando mapa de ubicaciones…
              </span>
            ) : mapB64 ? (
              <span style={{ fontSize: 13, color: '#22c55e' }}>✓ Mapa de ubicaciones listo</span>
            ) : (
              <span style={{ fontSize: 13, color: '#f59e0b' }}>⚠ Mapa no disponible (se incluirá sin mapa)</span>
            )}
          </div>

          <p className="pdf-summary-note" style={{ marginTop: 8 }}>
            El informe incluye: portada, ficha del sujeto, mapa de ubicaciones, tabla de comparables,
            ponderadores detallados y resultados de la tasación.
          </p>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">PDF descargado correctamente.</div>}

          <button
            className="btn btn-primary"
            onClick={handleDownload}
            disabled={generating || blockedByApproval || mapLoading}
          >
            {generating && <span className="spinner" />}
            {generating
              ? 'Generando PDF…'
              : mapLoading
                ? 'Preparando mapa…'
                : blockedByApproval
                  ? 'Pendiente de aprobación'
                  : 'Descargar PDF profesional'}
          </button>
        </div>
      )}

      <div className="btn-group">
        <button className="btn btn-secondary" onClick={() => navigate(`/acm/${id}/step/4`)}>
          ← Paso 4
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          Ir al inicio
        </button>
      </div>
    </div>
  )
}
