import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/** Prevent pure black screen — show recovery UI on render crashes */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('StockFlow crash', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-full flex flex-col items-center justify-center px-6 bg-[var(--canvas)] text-ink">
          <div className="max-w-sm w-full text-center">
            <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-primary text-white text-xl font-bold flex items-center justify-center">
              SF
            </div>
            <h1 className="text-[20px] font-semibold mb-2">Something went wrong</h1>
            <p className="text-[14px] text-ink-secondary mb-6">
              The app hit an unexpected error. You can reload or clear the local cache and try again.
            </p>
            <button
              type="button"
              className="press w-full h-12 rounded-full bg-primary text-white text-[15px] font-semibold mb-3"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
            <button
              type="button"
              className="press w-full h-12 rounded-full bg-black/10 dark:bg-white/10 text-ink text-[15px] font-semibold"
              onClick={() => {
                try {
                  localStorage.removeItem('sf_pin_locked')
                } catch { /* ignore */ }
                window.location.href = '/login'
              }}
            >
              Go to sign in
            </button>
            <p className="mt-4 text-[11px] text-ink-muted break-all">{this.state.error.message}</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
