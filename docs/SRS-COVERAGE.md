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
| Users / permissions | 🟡 | Granular permissions + PIN; Supabase Auth + server-side enforcement pending |
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
RLS still has permissive `dev_all_*` policies because login is a local PIN. Move to Supabase Auth and drop them before production (§13, §32).
