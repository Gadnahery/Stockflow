import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ensureSeedData } from './lib/db'
import { startSyncLoop, processOutbox } from './lib/sync'
import { usePosStore } from './store/posStore'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
import PosPage from './pages/PosPage'
import ProductsPage from './pages/ProductsPage'
import CustomersPage from './pages/CustomersPage'
import ReportsPage from './pages/ReportsPage'
import MorePage from './pages/MorePage'
import SettingsPage from './pages/SettingsPage'
import ShiftsPage from './pages/ShiftsPage'
import ExpensesPage from './pages/ExpensesPage'
import SuppliersPage from './pages/SuppliersPage'
import StockAdjustmentPage from './pages/StockAdjustmentPage'
import UsersPage from './pages/UsersPage'
import SalesPage from './pages/SalesPage'
import ExportPage from './pages/ExportPage'

function App() {
  const setOnline = usePosStore((s) => s.setOnline)
  const refreshPendingSync = usePosStore((s) => s.refreshPendingSync)

  useEffect(() => {
    ensureSeedData().then(() => refreshPendingSync())

    const onOnline = () => {
      setOnline(true)
      processOutbox().then(() => refreshPendingSync())
    }
    const onOffline = () => setOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    const timer = startSyncLoop(20000)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(timer)
    }
  }, [setOnline, refreshPendingSync])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<PosPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/more" element={<MorePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/shifts" element={<ShiftsPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/stock" element={<StockAdjustmentPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/export" element={<ExportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
