import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSavedAppName } from '../theme.js'

const ERROR_PRESETS = {
  '401': {
    eyebrow: 'Acceso pendiente',
    status: 'Autenticacion requerida',
    title: 'Necesitas volver a iniciar sesion',
    description: 'La sesion que intentaste usar ya no esta disponible o no alcanza para abrir esta vista.',
    detail: 'Volve a autenticarte para recuperar el contexto y continuar con tu flujo de trabajo.',
    cues: ['Verificando credenciales...', 'Actualizando permisos...', 'Preparando acceso seguro...'],
    hints: ['Tu sesion pudo haber expirado.', 'Si venis desde un link guardado, proba volver a entrar desde el login.'],
  },
  '403': {
    eyebrow: 'Acceso restringido',
    status: 'Permisos insuficientes',
    title: 'Esta pantalla esta fuera de tu alcance',
    description: 'Tu usuario no tiene permisos para operar en esta seccion del workspace.',
    detail: 'Si deberias poder verla, revisa el rol asignado o pedi acceso al administrador.',
    cues: ['Revisando permisos...', 'Validando rol activo...', 'Protegiendo el workspace...'],
    hints: ['Los permisos pueden variar entre workspace operativo, admin y approver.', 'Volver al tablero te devuelve a una zona segura del producto.'],
  },
  '404': {
    eyebrow: 'Error de navegacion',
    status: 'Ruta no encontrada',
    title: 'Esta pantalla se perdio del mapa',
    description: 'La ruta que abriste no existe, cambio de lugar o ya no forma parte del recorrido principal de la app.',
    detail: 'Te dejamos accesos rapidos para volver al tablero, relanzar el flujo o reintentar desde el login.',
    cues: ['Buscando la ruta...', 'Rearmando recorrido...', 'Sincronizando destino...'],
    hints: ['Puede tratarse de un link viejo o mal escrito.', 'Si llegaste desde un favorito del navegador, conviene actualizarlo.'],
  },
  '500': {
    eyebrow: 'Error interno',
    status: 'Fallo inesperado',
    title: 'Algo se rompio en medio del proceso',
    description: 'La app encontro un error imprevisto y no pudo terminar de renderizar esta experiencia.',
    detail: 'Recargar suele alcanzar para recuperarse. Si vuelve a pasar, comparti el contexto del flujo para revisarlo.',
    cues: ['Recomponiendo estado...', 'Recuperando sesion visual...', 'Intentando estabilizar la vista...'],
    hints: ['Puede venir de datos incompletos o de una condicion no contemplada.', 'Recargar la pagina fuerza una nueva inicializacion del frontend.'],
  },
  '503': {
    eyebrow: 'Servicio momentaneamente no disponible',
    status: 'Dependencia ocupada',
    title: 'La operacion esta en pausa',
    description: 'Uno de los servicios de apoyo no esta respondiendo como esperamos, asi que frenamos antes de darte datos inconsistentes.',
    detail: 'En unos minutos deberia normalizarse. Mientras tanto podes volver al tablero o reintentar la accion.',
    cues: ['Consultando servicios...', 'Esperando respuesta...', 'Reintentando conexion...'],
    hints: ['Puede afectar integraciones, cargas o calculos pesados.', 'No hace falta rehacer todo el flujo si todavia no cerraste la sesion.'],
  },
}

function ActionButton({ action }) {
  const className = `btn ${action.variant === 'secondary' ? 'btn-secondary' : 'btn-primary'} error-experience__action`
  if (action.to) {
    return (
      <Link className={className} to={action.to}>
        {action.label}
      </Link>
    )
  }
  return (
    <button type="button" className={className} onClick={action.onClick}>
      {action.label}
    </button>
  )
}

export function ErrorState({
  code = '404',
  config,
  actions = [],
  technicalMessage,
}) {
  const preset = ERROR_PRESETS[code] || ERROR_PRESETS['500']
  const content = { ...preset, ...config }
  const appName = useMemo(() => getSavedAppName(), [])
  const [cueIndex, setCueIndex] = useState(0)

  useEffect(() => {
    if (!content.cues?.length) return undefined
    const timerId = window.setInterval(() => {
      setCueIndex((current) => (current + 1) % content.cues.length)
    }, 1800)
    return () => window.clearInterval(timerId)
  }, [content.cues])

  return (
    <section className="error-experience" aria-labelledby={`error-title-${code}`}>
      <div className="error-experience__backdrop" aria-hidden="true">
        <span className="error-experience__glow error-experience__glow--primary" />
        <span className="error-experience__glow error-experience__glow--accent" />
      </div>

      <div className="error-experience__card">
        <div className="error-experience__visual" aria-hidden="true">
          <div className="error-experience__constellation">
            <span />
            <span />
            <span />
          </div>

          <div className="error-experience__code-stack">
            <div className="error-experience__code-chip">{content.status}</div>
            <div className="error-experience__code-display">{code}</div>
            <div className="error-experience__signal">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="error-experience__mini-panel">
            <div className="error-experience__mini-panel-head">
              <span />
              <span />
            </div>
            <div className="error-experience__mini-panel-body">
              <div className="error-experience__mini-line error-experience__mini-line--strong" />
              <div className="error-experience__mini-line" />
              <div className="error-experience__mini-line error-experience__mini-line--short" />
            </div>
          </div>

          <div className="error-experience__pulse-copy">{content.cues?.[cueIndex]}</div>
        </div>

        <div className="error-experience__content">
          <span className="error-experience__eyebrow">{content.eyebrow}</span>
          <h1 id={`error-title-${code}`} className="error-experience__title">{content.title}</h1>
          <p className="error-experience__description">{content.description}</p>
          <p className="error-experience__detail">{content.detail}</p>

          {content.hints?.length ? (
            <div className="error-experience__hints">
              {content.hints.map((hint) => (
                <article key={hint} className="error-experience__hint">
                  <span className="error-experience__hint-dot" />
                  <p>{hint}</p>
                </article>
              ))}
            </div>
          ) : null}

          {technicalMessage ? (
            <div className="error-experience__technical">
              <span>Detalle tecnico</span>
              <strong>{technicalMessage}</strong>
            </div>
          ) : null}

          {actions.length ? (
            <div className="error-experience__actions">
              {actions.map((action) => (
                <ActionButton key={action.label} action={action} />
              ))}
            </div>
          ) : null}

          <div className="error-experience__footer">
            <span>{appName}</span>
            <strong>Workspace de continuidad operativa</strong>
          </div>
        </div>
      </div>
    </section>
  )
}
