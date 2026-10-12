import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ensureSeedData } from './lib/db'
import { startSyncLoop, processOutbox, startRealtime, pullMissing } from './lib/sync'
import { usePosStore } from './store/posStore'
import { RequireAuth } from './components/RequireAuth'
import AppShell from './components/layout/AppShell'
import ImportPage from './pages/ImportPage'
import SyncStatusPage from './pages/SyncStatusPage'
import AuditPage from './pages/AuditPage'
import LoginPage from './pages/auth/LoginPage'
import SignupPage from './pages/auth/SignupPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import OnboardingPage from './pages/auth/OnboardingPage'
import AcceptInvitePage from './pages/auth/AcceptInvitePage'
import AccountPage from './pages/auth/AccountPage'
import HelpPage from './pages/HelpPage'
import BillingPage from './pages/BillingPage'
import BranchesPage from './pages/BranchesPage'
import PosPage from './pages/PosPage'
import DashboardPage from './pages/DashboardPage'
import NotificationsPage from './pages/NotificationsPage'
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
      void processOutbox().then(() => {
        refreshPendingSync()
        return pullMissing()
      })
    }
    const onOffline = () => setOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    const timer = startSyncLoop(20000)
    const stopRealtime = startRealtime(() => refreshPendingSync())

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(timer)
      stopRealtime()
    }
  }, [setOnline, refreshPendingSync])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <OnboardingPage />
          </RequireAuth>
        }
      />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<PosPage />} />
        <Route path="home" element={<DashboardPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
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
        <Route path="/import" element={<ImportPage />} />
        <Route path="/sync" element={<SyncStatusPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/branches" element={<BranchesPage />} />
        <Route path="/help" element={<HelpPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
