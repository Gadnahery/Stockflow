import { initTheme } from './lib/theme'
initTheme()
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { I18nProvider } from './i18n/I18nContext'
import { ConfirmProvider } from './components/ui/ConfirmDialog'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'
import { recoverSharedCatalog } from './lib/recoverCatalog'
import { registerServiceWorker, listenForInstallPrompt } from './lib/pwa'

registerServiceWorker()
listenForInstallPrompt()

const isDesktop =
  typeof window !== 'undefined' &&
  (Boolean((window as unknown as { stockflowDesktop?: unknown }).stockflowDesktop) ||
    window.location.protocol === 'file:')

const Router = isDesktop ? HashRouter : BrowserRouter

void recoverSharedCatalog()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Router>
        <I18nProvider>
          <AuthProvider>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
          </AuthProvider>
        </I18nProvider>
      </Router>
    </ErrorBoundary>
  </StrictMode>,
)
