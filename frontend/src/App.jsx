import React, { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  applyTheme,
  getSavedColor,
  getSavedLogo,
  getSavedAppName,
  syncBranding,
} from './theme.js'
import NuevaTasacion from './pages/NuevaTasacion.jsx'
import TipoACM from './pages/TipoACM.jsx'
import AgregarComparables from './pages/AgregarComparables.jsx'
import AplicarPonderadores from './pages/AplicarPonderadores.jsx'
import ResultadosDashboard from './pages/ResultadosDashboard.jsx'
import ExportarPDF from './pages/ExportarPDF.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Settings from './pages/Settings.jsx'
import Approvals from './pages/Approvals.jsx'
import MlCallback from './pages/MlCallback.jsx'
import { getBrandingSettings, getCurrentUser, loginUser } from './api.js'

// --- Auth ---

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('acm_user')) } catch { return null }
  })

  useEffect(() => {
    const token = localStorage.getItem('acm_token')
    if (!token) return
    getCurrentUser()
      .then((nextUser) => {
        localStorage.setItem('acm_user', JSON.stringify(nextUser))
        setUser(nextUser)
      })
      .catch(() => {
        localStorage.removeItem('acm_token')
        localStorage.removeItem('acm_user')
        setUser(null)
      })
  }, [])

  async function login(username, password) {
    const data = await loginUser(username, password)
    localStorage.setItem('acm_token', data.access_token)
    const u = {
      username: data.username,
      is_admin: data.is_admin,
      is_approver: data.is_approver,
      needs_approval: data.needs_approval,
    }
    localStorage.setItem('acm_user', JSON.stringify(u))
    setUser(u)
  }

  async function refreshUser() {
    const nextUser = await getCurrentUser()
    localStorage.setItem('acm_user', JSON.stringify(nextUser))
    setUser(nextUser)
    return nextUser
  }

  function logout() {
    localStorage.removeItem('acm_token')
    localStorage.removeItem('acm_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser }}>
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
  const location = useLocation()
  const navigate = useNavigate()
  const [logo, setLogo] = useState(() => getSavedLogo())
  const [appName, setAppName] = useState(() => getSavedAppName())
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  if (location.pathname === '/login') return null

  const navItems = [
    { to: '/', label: 'Tablero', visible: true },
    { to: '/approvals', label: 'Aprobaciones', visible: user?.is_approver },
    { to: '/settings', label: 'Configuración', visible: Boolean(user) },
  ].filter((item) => item.visible)

  return (
    <header className="app-header">
      <div className="app-header__shell">
        <div className="app-header__left">
          <Link to="/" className="app-title">
            <span className="app-title__mark">
              {logo ? (
                <img src={logo} alt="logo" className="app-title__logo" />
              ) : (
                <span className="app-title__glyph">R</span>
              )}
            </span>
            <span>
              <span className="app-title__name">{appName}</span>
              <span className="app-title__meta">Workspace de tasaciones</span>
            </span>
          </Link>
        </div>

        {user && (
          <>
            <button
              type="button"
              className={`header-menu-toggle${mobileMenuOpen ? ' is-open' : ''}`}
              aria-label="Abrir navegación"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((current) => !current)}
            >
              <span />
              <span />
              <span />
            </button>

            <div className={`app-header__right${mobileMenuOpen ? ' is-open' : ''}`}>
            <nav className="header-nav" aria-label="Principal">
              {navItems.map((item) => {
                const isActive = item.to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.to)
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`header-link${isActive ? ' header-link--active' : ''}`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            <div className="header-user">
              <div className="header-user__avatar">
                {user.username.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="header-user__name">{user.username}</div>
                <div className="header-user__role">
                  {user.is_approver ? 'Admin approver' : user.is_admin ? 'Admin' : 'Usuario'}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="header-logout"
            >
              Salir
            </button>
            </div>
          </>
        )}
      </div>
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
      <Route path="/approvals" element={<PrivateRoute><Approvals /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
      <Route path="/ml-callback" element={<MlCallback />} />
    </Routes>
  )
}

export default function App() {
  useEffect(() => {
    applyTheme(getSavedColor())
    getBrandingSettings()
      .then((branding) => {
        syncBranding(branding)
        applyTheme(branding.primary_color)
        window.dispatchEvent(new Event('acm_theme_changed'))
      })
      .catch(() => {})
  }, [])

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
