import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'

const BUTTONS = [
  ['C', '±', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['0', '.', '='],
]

function calculate(a, op, b) {
  const x = parseFloat(a)
  const y = parseFloat(b)
  if (op === '+') return x + y
  if (op === '−') return x - y
  if (op === '×') return x * y
  if (op === '÷') return y !== 0 ? x / y : 'Error'
  return b
}

export default function FloatingCalculator() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [display, setDisplay] = useState('0')
  const [stored, setStored] = useState(null)
  const [operator, setOperator] = useState(null)
  const [waitingNext, setWaitingNext] = useState(false)

  const hiddenPaths = ['/login', '/admin']
  if (hiddenPaths.some((p) => location.pathname === p || location.pathname.startsWith('/admin/'))) {
    return null
  }

  function handleButton(label) {
    if (label === 'C') {
      setDisplay('0')
      setStored(null)
      setOperator(null)
      setWaitingNext(false)
      return
    }

    if (label === '±') {
      setDisplay((d) => String(parseFloat(d) * -1))
      return
    }

    if (label === '%') {
      setDisplay((d) => String(parseFloat(d) / 100))
      return
    }

    if (['+', '−', '×', '÷'].includes(label)) {
      setStored(display)
      setOperator(label)
      setWaitingNext(true)
      return
    }

    if (label === '=') {
      if (operator && stored !== null) {
        const result = calculate(stored, operator, display)
        const rounded = typeof result === 'number'
          ? parseFloat(result.toFixed(10)).toString()
          : result
        setDisplay(rounded)
        setStored(null)
        setOperator(null)
        setWaitingNext(false)
      }
      return
    }

    if (label === '.') {
      if (waitingNext) {
        setDisplay('0.')
        setWaitingNext(false)
        return
      }
      if (!display.includes('.')) setDisplay((d) => d + '.')
      return
    }

    // Digit
    if (waitingNext) {
      setDisplay(label)
      setWaitingNext(false)
    } else {
      setDisplay((d) => (d === '0' ? label : d.length < 12 ? d + label : d))
    }
  }

  return (
    <div className="float-calc-wrap">
      <button
        type="button"
        className={`float-calc-toggle${open ? ' is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Calculadora"
        aria-label="Abrir calculadora"
      >
        <span className="float-calc-toggle__icon">⌗</span>
      </button>

      {open && (
        <div className="float-calc">
          <div className="float-calc__display">
            {operator && stored !== null && (
              <span className="float-calc__expr">{stored} {operator}</span>
            )}
            <span className="float-calc__value">{display}</span>
          </div>
          <div className="float-calc__buttons">
            {BUTTONS.map((row, ri) => (
              <div key={ri} className="float-calc__row">
                {row.map((btn) => (
                  <button
                    key={btn}
                    type="button"
                    className={`float-calc__btn${
                      ['+', '−', '×', '÷'].includes(btn) ? ' float-calc__btn--op' :
                      btn === '=' ? ' float-calc__btn--eq' :
                      btn === 'C' ? ' float-calc__btn--clear' :
                      btn === '0' ? ' float-calc__btn--zero' : ''
                    }`}
                    onClick={() => handleButton(btn)}
                  >
                    {btn}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
