import React from 'react'
import { ErrorState } from './ErrorState.jsx'

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled application error', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.assign('/')
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          code="500"
          technicalMessage={this.state.error?.message}
          actions={[
            { label: 'Recargar pagina', onClick: this.handleReload },
            { label: 'Volver al tablero', onClick: this.handleGoHome, variant: 'secondary' },
          ]}
        />
      )
    }

    return this.props.children
  }
}
