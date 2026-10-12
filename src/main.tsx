import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ConfirmProvider } from './components/ui/ConfirmDialog'
import App from './App'
import './index.css'
import { registerServiceWorker, listenForInstallPrompt } from './lib/pwa'

registerServiceWorker()
listenForInstallPrompt()

const isDesktop =
  typeof window !== 'undefined' &&
  (Boolean((window as unknown as { stockflowDesktop?: unknown }).stockflowDesktop) ||
    window.location.protocol === 'file:')

const Router = isDesktop ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <AuthProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </AuthProvider>
    </Router>
  </StrictMode>,
)
