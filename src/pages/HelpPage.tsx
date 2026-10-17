import Screen from '../components/ui/Screen'
import { useI18n } from '../i18n/I18nContext'

export default function HelpPage() {
  const { t } = useI18n()
  return (
    <Screen title={t('help.title')} subtitle={t('help.sub')}>
      <div className="space-y-4 md:max-w-lg pb-8">
        <div className="bg-white rounded-[22px] shadow-card p-5 space-y-3">
          <h2 className="text-[16px] font-semibold">{t('help.gettingStarted')}</h2>
          <ol className="list-decimal pl-5 text-[15px] text-ink-secondary space-y-2">
            <li>{t('help.signupVerify')}</li>
            <li>Create your business on the onboarding screen.</li>
            <li>Add products (or import CSV), then start selling on POS.</li>
            <li>Invite staff from Users when you are ready.</li>
          </ol>
        </div>
        <div className="bg-white rounded-[22px] shadow-card p-5 space-y-2">
          <h2 className="text-[16px] font-semibold">Offline</h2>
          <p className="text-[15px] text-ink-secondary">
            Sales and stock changes are saved on this device and sync when you are back online.
            Never block checkout on the network.
          </p>
        </div>
        <div className="bg-white rounded-[22px] shadow-card p-5 space-y-2">
          <h2 className="text-[16px] font-semibold">Contact</h2>
          <p className="text-[15px] text-ink-secondary">
            For support, email your account admin or the StockFlow operator for your organisation.
          </p>
          <p className="text-[13px] text-ink-muted">App version 1.0.0 · Phase 1 auth</p>
        </div>
      </div>
          <div className="mt-8 rounded-[18px] border border-border bg-white p-5 text-[14px] text-ink-secondary leading-relaxed">
        <strong className="text-ink">TRA / VFD:</strong> Settings → Tax &amp; fiscal stores your TIN and can issue sequential FS receipt numbers.
        Live VFD hardware integration is reserved until a certified path is available — StockFlow does not claim TRA approval for device signing yet.
      </div>
    </Screen>
  )
}
