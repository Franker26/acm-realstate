const SESSION_EXPIRED_MESSAGE = 'Tu sesión venció. Ingresá nuevamente para continuar.'
const GENERIC_ERROR_MESSAGE = 'No pudimos completar esta acción en este momento. Probá de nuevo en unos instantes.'

function normalizeText(value) {
  return String(value || '').trim()
}

function includesAny(text, patterns) {
  return patterns.some((pattern) => text.includes(pattern))
}

export function getFriendlyErrorMessage(error, fallback = GENERIC_ERROR_MESSAGE) {
  const raw = normalizeText(error?.message || error?.detail || error)
  if (!raw) return fallback

  const lower = raw.toLowerCase()

  if (includesAny(lower, ['sesión expirada', 'token inválido', 'token invalido', 'no autenticado'])) {
    return SESSION_EXPIRED_MESSAGE
  }

  if (includesAny(lower, ['usuario o contraseña incorrectos', 'usuario o contrasena incorrectos', 'error de autenticación'])) {
    return 'No pudimos validar tus datos. Revisá usuario y contraseña e intentá nuevamente.'
  }

  if (includesAny(lower, ['acceso restringido', 'acceso de superadmin no permitido'])) {
    return 'Tu perfil no tiene acceso a esta sección desde esta pantalla.'
  }

  if (includesAny(lower, ['sin permisos', 'se requieren permisos', 'sin acceso a este acm'])) {
    return 'No tenés permisos para realizar esta acción.'
  }

  if (includesAny(lower, ['ya existe'])) {
    if (lower.includes('empresa')) return 'Ya existe una empresa con ese nombre.'
    if (lower.includes('usuario')) return 'Ya existe un usuario con ese nombre.'
    return 'Ya existe un registro con esos datos.'
  }

  if (includesAny(lower, ['no encontrado', 'no se encontró'])) {
    if (lower.includes('mapa')) return 'No encontramos esa dirección en el mapa. Probá con una referencia más completa.'
    return 'No encontramos la información que buscabas.'
  }

  if (includesAny(lower, ['step inválido', 'step invalido', 'etapa inválida', 'etapa invalida', 'estado de aprobación inválido'])) {
    return 'No pudimos guardar ese cambio. Probá nuevamente.'
  }

  if (includesAny(lower, ['no podés', 'no podes'])) {
    if (lower.includes('eliminar tu propio usuario')) return 'No podés eliminar tu propio usuario desde esta sección.'
    if (lower.includes('rol de admin')) return 'No podés quitarte el permiso de administrador desde tu propia cuenta.'
    if (lower.includes('rol de approver')) return 'No podés quitarte el permiso de aprobación desde tu propia cuenta.'
    return 'Ese cambio no está permitido en este momento.'
  }

  if (includesAny(lower, ['approver también debe ser admin', 'approver tambien debe ser admin'])) {
    return 'Para asignar permisos de aprobación, ese usuario también debe ser administrador.'
  }

  if (includesAny(lower, ['no se puede eliminar una empresa con usuarios activos'])) {
    return 'No se puede eliminar la empresa mientras tenga usuarios activos.'
  }

  if (includesAny(lower, ['no hay integración disponible', 'no hay soporte de scraping'])) {
    return 'Todavía no podemos leer datos automáticamente desde ese enlace. Podés completar la ficha de forma manual.'
  }

  if (includesAny(lower, ['esta tasación no requiere aprobación', 'esta tasacion no requiere aprobacion'])) {
    return 'Esta tasación no necesita pasar por aprobación.'
  }

  if (includesAny(lower, ['el acm no tiene comparables'])) {
    return 'Necesitás cargar comparables antes de calcular resultados.'
  }

  if (includesAny(lower, ['scraper', 'mercadolibre respondió con error', 'zonaprop respondió con error', 'argenprop respondió con error'])) {
    return 'No pudimos extraer los datos de esa publicación en este momento. Probá nuevamente o cargá la información de forma manual.'
  }

  if (includesAny(lower, ['no pudimos acceder automáticamente a los datos', 'no se pudieron extraer datos'])) {
    return 'No pudimos completar la extracción automática por ahora. Probá otra vez o seguí con la carga manual.'
  }

  if (includesAny(lower, ['failed to fetch', 'networkerror', 'load failed', 'http 500', 'http 502', 'http 503', 'http 504'])) {
    return 'Tuvimos un problema de conexión con el servicio. Probá nuevamente en unos instantes.'
  }

  if (includesAny(lower, ['http 400', 'http 404', 'http 409', 'http 422'])) {
    return fallback
  }

  return fallback
}

export function getFriendlyFieldError(message, fallback = 'Revisá este dato para poder continuar.') {
  const lower = normalizeText(message).toLowerCase()

  if (!lower) return fallback
  if (includesAny(lower, ['requerido', 'required'])) return 'Completá este campo para continuar.'
  if (includesAny(lower, ['debe ser mayor a 0', 'must be greater than 0'])) return 'Ingresá un valor mayor a 0.'

  return message
}

export function getFriendlyOauthError(provider, errorCode) {
  if (!errorCode) return `No pudimos completar la conexión con ${provider}.`
  const lower = String(errorCode).toLowerCase()

  if (includesAny(lower, ['access_denied', 'unauthorized'])) {
    return `La conexión con ${provider} fue cancelada o rechazada.`
  }

  return `No pudimos completar la conexión con ${provider}. Probá nuevamente desde Configuración.`
}

export function getFriendlySuccessMessage(message, fallback = '') {
  const raw = normalizeText(message)
  return raw || fallback
}

export const feedbackDefaults = {
  genericError: GENERIC_ERROR_MESSAGE,
  sessionExpired: SESSION_EXPIRED_MESSAGE,
}
