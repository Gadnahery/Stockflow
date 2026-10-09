# StockFlow — Commercial Offline-First POS

Production-ready Point of Sale.

## CRUD Status (complete)

| Module | C | R | U | D |
|--------|---|---|---|---|
| Products | ✅ | ✅ | ✅ | ✅ Deactivate |
| Customers | ✅ | ✅ | ✅ | ✅ |
| Suppliers | ✅ | ✅ | ✅ | ✅ |
| Purchases | ✅ | ✅ | — | — |
| Stock Adjustments | ✅ | ✅ | — | — |
| Sales | ✅ | ✅ | ✅ Void | — |
| Shifts | ✅ | ✅ | ✅ Close | — |
| Expenses | ✅ | ✅ | ✅ | ✅ |
| Users | ✅ | ✅ | ✅ | ✅ Active flag |
| Settings | — | ✅ | ✅ | — |
| Export | — | ✅ CSV | — | — |

## POS capabilities
- Search + barcode scan
- Customer on sale
- Cart discount
- Payment methods: cash, mobile, card, bank
- Tax (inclusive/exclusive)
- Receipt view + print
- Offline + outbox + stock movements
- Void sale (restores stock)

## Design
- Primary `#0066CC` · Canvas `#F5F5F7` · Inter
- Desktop sidebar · Mobile floating translucent bottom nav
- Permission-aware actions

## Demo PINs
- Owner: `0000`
- Cashier: `1234`

## Run
```bash
npm install
npm run dev
```

## Still out of scope (future cloud phase)
- Real-time multi-device cloud sync engine
- SaaS billing / subscriptions
- Multi-branch switching UI
- Restaurant tables / KDS
- Pharmacy batch / expiry
- Fiscal device integration (TRA)
- Desktop EXE (Tauri packaging)

## Backend (Supabase)

Connected project: `yyuwbqvonylgjrlmvwjj.supabase.co`

- Local Dexie remains source of truth while offline
- Outbox events sync to Supabase when online (every 20s + on reconnect)
- Schema extended on existing tables + new: suppliers, stock_movements, cash_sessions, purchases, app_settings
- Default business: Demo Retail Ltd

Env (never commit `.env`):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
