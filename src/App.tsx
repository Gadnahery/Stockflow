import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { ensureSeedData } from './lib/db'
import { startSyncLoop, processOutbox, startRealtime, pullMissing } from './lib/sync'
import { usePosStore } from './store/posStore'
import { RequireAuth } from './components/RequireAuth'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/auth/LoginPage'
import SignupPage from './pages/auth/SignupPage'
import PosPage from './pages/PosPage'
import LandingPage from './pages/LandingPage'
import MarketingLayout from './marketing/MarketingLayout'

const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'))
const OnboardingPage = lazy(() => import('./pages/auth/OnboardingPage'))
const AcceptInvitePage = lazy(() => import('./pages/auth/AcceptInvitePage'))
const AccountPage = lazy(() => import('./pages/auth/AccountPage'))
const HelpPage = lazy(() => import('./pages/HelpPage'))
const BillingPage = lazy(() => import('./pages/BillingPage'))
const BranchesPage = lazy(() => import('./pages/BranchesPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const ProductsPage = lazy(() => import('./pages/ProductsPage'))
const CustomersPage = lazy(() => import('./pages/CustomersPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const MorePage = lazy(() => import('./pages/MorePage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const ShiftsPage = lazy(() => import('./pages/ShiftsPage'))
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'))
const SuppliersPage = lazy(() => import('./pages/SuppliersPage'))
const StockAdjustmentPage = lazy(() => import('./pages/StockAdjustmentPage'))
const RestaurantTablesPage = lazy(() => import('./pages/RestaurantTablesPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const SalesPage = lazy(() => import('./pages/SalesPage'))
const ExportPage = lazy(() => import('./pages/ExportPage'))
const ImportPage = lazy(() => import('./pages/ImportPage'))
const SyncStatusPage = lazy(() => import('./pages/SyncStatusPage'))
const AuditPage = lazy(() => import('./pages/AuditPage'))
const FeaturesPage = lazy(() => import('./pages/marketing/FeaturesPage'))
const PricingPage = lazy(() => import('./pages/marketing/PricingPage'))
const AboutPage = lazy(() => import('./pages/marketing/AboutPage'))
const ContactPage = lazy(() => import('./pages/marketing/ContactPage'))
const PrivacyPage = lazy(() => import('./pages/marketing/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/marketing/TermsPage'))
const ResourcesPage = lazy(() => import('./pages/marketing/ResourcesPage'))
const ArticlePage = lazy(() => import('./pages/marketing/ArticlePage'))
const IndustryPage = lazy(() => import('./pages/marketing/IndustryPage'))
const NotFoundPage = lazy(() => import('./pages/marketing/NotFoundPage'))

function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-[14px] text-ink-secondary">
      Loading…
    </div>
  )
}

function App() {
  const location = useLocation()
  const setOnline = usePosStore((s) => s.setOnline)
  const refreshPendingSync = usePosStore((s) => s.refreshPendingSync)

  useEffect(() => {
    const publicOnlyRoutes = ['/', '/login', '/signup', '/forgot-password', '/reset-password', '/accept-invite']
    if (publicOnlyRoutes.includes(location.pathname)) return

    ensureSeedData().then(() => refreshPendingSync())

    const onOnline = () => {
      setOnline(true)
      window.dispatchEvent(new CustomEvent('sf-connectivity', { detail: { online: true } }))
      void processOutbox()
        .then(() => refreshPendingSync())
        .then(() => pullMissing().catch(() => 0))
        .catch(() => {})
    }
    const onOffline = () => {
      setOnline(false)
      window.dispatchEvent(new CustomEvent('sf-connectivity', { detail: { online: false } }))
    }

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
  }, [location.pathname, setOnline, refreshPendingSync])

  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      {/* Public marketing — SEO entry points */}
      <Route path="/" element={<LandingPage />} />
      <Route element={<MarketingLayout />}>
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/resources/:slug" element={<ArticlePage />} />
        <Route path="/industries/:slug" element={<IndustryPage />} />
      </Route>

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
        <Route path="/pos" element={<PosPage />} />
        <Route path="/home" element={<DashboardPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
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
        <Route path="/tables" element={<RestaurantTablesPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/sync" element={<SyncStatusPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/branches" element={<BranchesPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/billing" element={<BillingPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  )
}

export default App
