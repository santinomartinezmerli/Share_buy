import { Component } from 'react'
import { isChunkLoadError, reloadOnceForNewDeploy } from '../lib/chunkReload'

// Catches render errors (and failed lazy chunks) below it and shows a friendly screen instead of
// a blank page. `resetKey` clears the error when it changes, so the route boundary recovers as
// soon as the user navigates somewhere else. `fullScreen` is for the global boundary, which has
// no layout around it.
class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    if (isChunkLoadError(error)) reloadOnceForNewDeploy()
    else console.error('ErrorBoundary caught:', error)
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  // A failed lazy chunk is cached as failed by React, so re-rendering would fail again: reload instead.
  retry = () => {
    if (isChunkLoadError(this.state.error)) window.location.reload()
    else this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children

    const sizing = this.props.fullScreen ? 'h-dvh' : 'flex-1 py-20'
    return (
      <div className={`flex ${sizing} flex-col items-center justify-center gap-4 px-6 text-center bg-white dark:bg-gray-900 text-gray-900 dark:text-white`}>
        <p className="text-lg font-semibold">Algo salió mal</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No pudimos mostrar esta pantalla. Probá de nuevo o volvé al inicio.
        </p>
        <div className="flex gap-3">
          <button
            onClick={this.retry}
            className="px-4 py-2 rounded-full bg-green-500 text-white text-sm font-medium active:scale-95 transition-transform"
          >
            Reintentar
          </button>
          <button
            onClick={() => window.location.assign('/')}
            className="px-4 py-2 rounded-full border border-gray-300 dark:border-gray-600 text-sm font-medium active:scale-95 transition-transform"
          >
            Ir al inicio
          </button>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
