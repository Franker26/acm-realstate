import React, { createContext, useContext, useReducer, useRef } from 'react'
import { BrowserRouter, Link, Route, Routes, useNavigate } from 'react-router-dom'
import NuevaTasacion from './pages/NuevaTasacion.jsx'
import TipoACM from './pages/TipoACM.jsx'
import AgregarComparables from './pages/AgregarComparables.jsx'
import AplicarPonderadores from './pages/AplicarPonderadores.jsx'
import ResultadosDashboard from './pages/ResultadosDashboard.jsx'
import ExportarPDF from './pages/ExportarPDF.jsx'
import Home from './pages/Home.jsx'

const initialState = {
  acmId: null,
  comparables: [],
  resultado: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ACM_ID':
      return { ...state, acmId: action.payload }
    case 'SET_COMPARABLES':
      return { ...state, comparables: action.payload }
    case 'SET_RESULTADO':
      return { ...state, resultado: action.payload }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

export const WizardContext = createContext(null)

export function useWizard() {
  return useContext(WizardContext)
}

function WizardProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const chartRef = useRef(null)
  return (
    <WizardContext.Provider value={{ state, dispatch, chartRef }}>
      {children}
    </WizardContext.Provider>
  )
}

const STEPS = [
  { num: 1, label: 'Sujeto' },
  { num: 2, label: 'Comparables' },
  { num: 3, label: 'Ponderadores' },
  { num: 4, label: 'Resultados' },
  { num: 5, label: 'Exportar PDF' },
]

function WizardNavInner({ currentStep }) {
  const { state } = useWizard()
  const navigate = useNavigate()
  const acmId = state.acmId

  function goToStep(num) {
    if (!acmId) return
    if (num === 1) navigate(`/acm/${acmId}/step/1`)
    else navigate(`/acm/${acmId}/step/${num}`)
  }

  return (
    <nav className="wizard-nav">
      {STEPS.map((s) => {
        const isDone = currentStep > s.num
        const isActive = currentStep === s.num
        const isClickable = acmId && s.num !== currentStep && s.num <= currentStep + 1
        return (
          <div
            key={s.num}
            className={`wizard-step${isActive ? ' active' : ''}${isDone ? ' done' : ''}${isClickable ? ' clickable' : ''}`}
            onClick={() => isClickable && goToStep(s.num)}
            title={isClickable ? `Ir al paso ${s.num}` : undefined}
          >
            <span className="step-num">{isDone ? '✓' : s.num}</span>
            <span className="step-label">{s.label}</span>
          </div>
        )
      })}
    </nav>
  )
}

export function WizardNav({ currentStep }) {
  return <WizardNavInner currentStep={currentStep} />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/acm/tipo" element={<TipoACM />} />
      <Route path="/acm/new" element={<NuevaTasacion />} />
      <Route path="/acm/:id/step/1" element={<NuevaTasacion />} />
      <Route path="/acm/:id/step/2" element={<AgregarComparables />} />
      <Route path="/acm/:id/step/3" element={<AplicarPonderadores />} />
      <Route path="/acm/:id/step/4" element={<ResultadosDashboard />} />
      <Route path="/acm/:id/step/5" element={<ExportarPDF />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <WizardProvider>
        <header className="app-header">
          <Link to="/" className="app-title">ACM Real Estate</Link>
        </header>
        <main className="app-main">
          <AppRoutes />
        </main>
      </WizardProvider>
    </BrowserRouter>
  )
}
