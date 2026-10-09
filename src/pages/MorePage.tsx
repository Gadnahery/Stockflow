import { useNavigate } from 'react-router-dom'
import {
  Settings, Users, Truck, Wallet, ClipboardList,
  Download, HelpCircle, ChevronRight, LogOut, Package, Receipt
} from 'lucide-react'

const sections = [
  {
    title: 'Operations',
    items: [
      { icon: Receipt, label: 'Sales History', desc: 'View and reprint receipts', to: '/sales' },
      { icon: ClipboardList, label: 'Cash Shifts', desc: 'Open & close till sessions', to: '/shifts' },
      { icon: Truck, label: 'Suppliers & Purchases', desc: 'Manage suppliers and receive stock', to: '/suppliers' },
      { icon: Package, label: 'Stock Adjustments', desc: 'Manual stock changes & history', to: '/stock' },
      { icon: Wallet, label: 'Expenses', desc: 'Record business expenses', to: '/expenses' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { icon: Users, label: 'Users & Permissions', desc: 'Staff accounts and roles', to: '/users' },
      { icon: Settings, label: 'Settings', desc: 'Business, tax, receipts', to: '/settings' },
      { icon: Download, label: 'Export Data', desc: 'Download sales & inventory', to: '/export' },
    ],
  },
  {
    title: 'Support',
    items: [
      { icon: HelpCircle, label: 'Help & Support', desc: 'Guides and contact', to: null },
    ],
  },
]

export default function MorePage() {
  const navigate = useNavigate()

  const lock = () => {
    sessionStorage.removeItem('currentUser')
    navigate('/login')
  }

  return (
    <div className="h-full flex flex-col">
      <header className="px-4 md:px-6 py-4 bg-white border-b border-border shrink-0">
        <h1 className="text-xl font-semibold text-ink">More</h1>
        <p className="text-sm text-ink-secondary">Operations & settings</p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2 px-1">
              {section.title}
            </h2>
            <div className="bg-white rounded-card shadow-card overflow-hidden divide-y divide-border">
              {section.items.map((item) => (
                <button
                  key={item.label}
                  onClick={() => item.to && navigate(item.to)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-surface-secondary/60 transition-smooth disabled:opacity-50"
                  disabled={!item.to}
                >
                  <div className="w-9 h-9 rounded-lg bg-surface-secondary flex items-center justify-center shrink-0">
                    <item.icon size={18} className="text-ink-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink text-sm">{item.label}</p>
                    <p className="text-xs text-ink-muted">{item.desc}</p>
                  </div>
                  {item.to && <ChevronRight size={16} className="text-ink-muted shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={lock}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-button border border-border text-ink-secondary hover:bg-white hover:text-danger transition-smooth"
        >
          <LogOut size={16} />
          Lock Screen
        </button>
      </div>
    </div>
  )
}
