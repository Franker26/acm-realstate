import React, { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { applyTheme, getSavedColor, getSavedLogo, getSavedAppName } from './theme.js'
import NuevaTasacion from './pages/NuevaTasacion.jsx'
import TipoACM from './pages/TipoACM.jsx'
import AgregarComparables from './pages/AgregarComparables.jsx'
import AplicarPonderadores from './pages/AplicarPonderadores.jsx'
import ResultadosDashboard from './pages/ResultadosDashboard.jsx'
import ExportarPDF from './pages/ExportarPDF.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Settings from './pages/Settings.jsx'
import { loginUser } from './api.js'

// --- Auth ---

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('acm_user')) } catch { return null }
  })

  async function login(username, password) {
    const data = await loginUser(username, password)
    localStorage.setItem('acm_token', data.access_token)
    const u = { username: data.username, is_admin: data.is_admin }
    localStorage.setItem('acm_user', JSON.stringify(u))
    setUser(u)
  }

  function logout() {
    localStorage.removeItem('acm_token')
    localStorage.removeItem('acm_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

// --- Wizard ---

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

function AppHeader() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [logo, setLogo] = useState(() => getSavedLogo())
  const [appName, setAppName] = useState(() => getSavedAppName())

  useEffect(() => {
    function onStorage(e) {
      if (e.key === 'acm_theme_logo') setLogo(e.newValue)
      if (e.key === 'acm_theme_name') setAppName(e.newValue || 'ACM Real Estate')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Allow Settings to trigger header refresh without cross-tab
  useEffect(() => {
    function onThemeChange() {
      setLogo(getSavedLogo())
      setAppName(getSavedAppName())
    }
    window.addEventListener('acm_theme_changed', onThemeChange)
    return () => window.removeEventListener('acm_theme_changed', onThemeChange)
  }, [])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <header className="app-header">
      <Link to="/" className="app-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {logo && <img src={logo} alt="logo" style={{ height: 28, width: 'auto', borderRadius: 4 }} />}
        <span>{appName}</span>
      </Link>
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
          <span style={{ color: '#b0c4de' }}>{user.username}</span>
          <Link
            to="/settings"
            style={{ color: '#b0c4de', textDecoration: 'none', fontSize: 12 }}
            title="Configuración"
          >
            ⚙
          </Link>
          <button
            onClick={handleLogout}
            style={{ background: 'none', border: '1px solid #b0c4de', color: '#b0c4de', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontSize: 12 }}
          >
            Salir
          </button>
        </div>
      )}
    </header>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
      <Route path="/acm/tipo" element={<PrivateRoute><TipoACM /></PrivateRoute>} />
      <Route path="/acm/new" element={<PrivateRoute><NuevaTasacion /></PrivateRoute>} />
      <Route path="/acm/:id/step/1" element={<PrivateRoute><NuevaTasacion /></PrivateRoute>} />
      <Route path="/acm/:id/step/2" element={<PrivateRoute><AgregarComparables /></PrivateRoute>} />
      <Route path="/acm/:id/step/3" element={<PrivateRoute><AplicarPonderadores /></PrivateRoute>} />
      <Route path="/acm/:id/step/4" element={<PrivateRoute><ResultadosDashboard /></PrivateRoute>} />
      <Route path="/acm/:id/step/5" element={<PrivateRoute><ExportarPDF /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
    </Routes>
  )
}

export default function App() {
  useEffect(() => { applyTheme(getSavedColor()) }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        <WizardProvider>
          <AppHeader />
          <main className="app-main">
            <AppRoutes />
          </main>
        </WizardProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
