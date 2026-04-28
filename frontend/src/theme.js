const THEME_COLOR_KEY = 'acm_theme_color'
const THEME_LOGO_KEY = 'acm_theme_logo'
const THEME_APP_NAME_KEY = 'acm_theme_name'

const DEFAULT_COLOR = '#1a3a5c'

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

function darken(hex, amount = 0.15) {
  let r = parseInt(hex.slice(1, 3), 16)
  let g = parseInt(hex.slice(3, 5), 16)
  let b = parseInt(hex.slice(5, 7), 16)
  r = Math.max(0, Math.round(r * (1 - amount)))
  g = Math.max(0, Math.round(g * (1 - amount)))
  b = Math.max(0, Math.round(b * (1 - amount)))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function lighten(hex, amount = 0.93) {
  let r = parseInt(hex.slice(1, 3), 16)
  let g = parseInt(hex.slice(3, 5), 16)
  let b = parseInt(hex.slice(5, 7), 16)
  r = Math.min(255, Math.round(r + (255 - r) * amount))
  g = Math.min(255, Math.round(g + (255 - g) * amount))
  b = Math.min(255, Math.round(b + (255 - b) * amount))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export function applyTheme(color) {
  const root = document.documentElement
  root.style.setProperty('--primary', color)
  root.style.setProperty('--primary-dark', darken(color))
  root.style.setProperty('--primary-light', lighten(color))
  root.style.setProperty('--primary-rgb', hexToRgb(color))
}

export function getSavedColor() {
  return localStorage.getItem(THEME_COLOR_KEY) || DEFAULT_COLOR
}

export function saveColor(color) {
  localStorage.setItem(THEME_COLOR_KEY, color)
  applyTheme(color)
}

export function getSavedLogo() {
  return localStorage.getItem(THEME_LOGO_KEY) || null
}

export function saveLogo(dataUrl) {
  localStorage.setItem(THEME_LOGO_KEY, dataUrl)
}

export function removeLogo() {
  localStorage.removeItem(THEME_LOGO_KEY)
}

export function getSavedAppName() {
  return localStorage.getItem(THEME_APP_NAME_KEY) || 'ACM Real Estate'
}

export function saveAppName(name) {
  localStorage.setItem(THEME_APP_NAME_KEY, name || 'ACM Real Estate')
}

export function syncBranding({ app_name, primary_color, logo_data_url }) {
  saveAppName(app_name || 'ACM Real Estate')
  saveColor(primary_color || DEFAULT_COLOR)
  if (logo_data_url) saveLogo(logo_data_url)
  else removeLogo()
}

export function getCachedBrandingPayload() {
  return {
    app_name: getSavedAppName(),
    primary_color: getSavedColor(),
    logo_data_url: getSavedLogo(),
  }
}
