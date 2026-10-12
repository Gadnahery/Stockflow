# SRS coverage (Commercial POS SRS v1.0)

Status: ✅ done · 🟡 partial · ⬜ not started

## MVP list (SRS §30)
| Requirement | Status | Notes |
|---|---|---|
| Products + barcode (camera scan, generate, duplicates check) | ✅ | Photos, units, categories, margin |
| Sales + payments | ✅ | Cash/mobile/card/bank/**credit**, **split payments** |
| Receipts | ✅ | Print + **WhatsApp/share** |
| Inventory | ✅ | Every change writes a stock movement (incl. product-form edits, imports) |
| Customers + suppliers | ✅ | **Credit limit enforced, balance tracked, record payments** |
| Offline sales | ✅ | Local DB + outbox |
| Synchronization | ✅ | Idempotent upserts, retry, **Sync status screen** (errors/retries), pull from other devices |
| Users / permissions | 🟡 | Supabase Auth + RLS; PIN lock; onboarding; invite-by-email + member list/suspend; Account page; SMTP branding + PIN Edge Function pending |
| Basic reports | ✅ | Period compare, profit, payments, best sellers, categories, stock |
| Subscription basics | ⬜ | Plans/entitlements/billing — Phase 6 |

## Added in this pass
- Hold / resume carts (§5.1)
- Percentage + fixed discounts, gated by `APPLY_DISCOUNT`
- Credit sales & partial payments, customer statements balance (§5.1, §5.5)
- Append-only **audit trail** (§14): voids, discounts, price/cost changes, stock adjustments, customer payments, imports — synced to `audit_logs` (insert/select only)
- CSV **import** with validation + error report (§18)
- Sync visibility and retry history (§6.2)

## Not yet built (roadmap)
- Multi-branch/warehouse, stock transfers, device registration (§7)
- Product variants, multiple barcodes, wholesale/customer pricing, promotions (§5.1, §5.7)
- Quotes, sales orders, refunds/exchanges workflow with approval (voids exist) (§5.1)
- Cash in/out movements and variance approval thresholds (§5.2)
- Purchase orders → goods received → supplier invoices/payments (§5.4)
- Notifications centre, MFA, device authorization (§13, §17)
- SaaS: plans, subscriptions, entitlements/offline tokens, platform admin portal (§15–16)
- Fiscalization (TRA/VFD) — compliance workstream (§12)
- Restaurant / pharmacy / manufacturing modules (§8–10)

## Known security gap
~~RLS still has permissive `dev_all_*` policies~~ **Resolved (Phase 1):** `dev_all_*` policies dropped; member-scoped RLS + `has_permission` / `create_business` / `accept_invite` RPCs applied. Remaining: PIN hash via Edge Function, email SMTP branding, manager-approval PIN override UI.


## Phase 2 design
- iOS ConfirmDialog replaces browser confirm/alert
- Rebuilt on Screen + cards + sheets: Sales, Expenses, Shifts, Suppliers, Stock, Customers, Settings, Export
- Receipt modal restyled (print/share); empty/loading states on lists

## Phase 3 desktop
- Collapsible sidebar (expanded / rail / hidden), ⌘B
- Top bar: title, command palette ⌘K, New sale, lock, account
- Grouped desktop nav (Sell, Inventory, People, Money, Insights, Admin)
- POS cart panel denser widths; F2/F4 shortcuts

## Phase 4 data integrity
- Outbox dead-letter after 12 retries; last push/pull timestamps
- Full pull: products (merge by updated_at), customers, suppliers, sales+items, expenses, stock_movements
- Sale completion queues product_upsert + stock_movement with the sale
- Realtime on products/customers/sales; Sync page force sync + diagnostics

## Phase 5 POS depth
- Stock-capped add-to-cart (cannot exceed available stock)
- USB wedge scanner improved (SKU/barcode, toast feedback)
- Shortcuts: F2 search, F3 hold, F4 pay, Esc close
- Desktop cart: Hold + held count
- Cash touch numpad + quick amounts
- Sale note on receipt
- Banner when no open cash shift

## Phase 7 customers & suppliers depth
- Customers: outstanding credit KPIs, filters (All/Owing/Has limit), detail sheet with balance, collect payment, sales history → receipt
- Customer save/payment queues customer_upsert for sync
- Suppliers: payable total, GRN increases balance, detail sheet with purchases, pay supplier reduces balance

## Phase 8 reports (ERP-style)
- P&L: Revenue − COGS = Gross profit − Expenses = **Net profit** (with margin %)
- Prior-period delta on revenue and net profit
- Payment mix, discounts, voids, credit vs collected
- Expenses by category; best sellers with margin; category mix
- Holdings: stock cost/retail, customer credit outstanding, low-stock link
- Cash shift variance; Explore links to Sales, Expenses, Customers, Inventory

## Phase 9 SaaS / multi-tenant
- Billing page: Free plan, seat usage (10), feature list, future paid notes
- Account: workspace links (plan, team), rename business (owner/settings)
- Soft seat cap on invites; Plan in desktop nav + More
