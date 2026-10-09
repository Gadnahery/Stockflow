# Supabase

The live schema (businesses, branches, products, sales, sale_items, customers, suppliers,
purchases, expenses, cash_sessions, stock_movements, app_settings, … with `business_id` multi-tenancy)
is managed in the Supabase project itself. The old single-file `schema.sql` was removed because it
described a different (tenant-based) design that the app does not use.

`migrations/` holds the changes made for the app's sync engine (`src/lib/sync.ts`).

Product photos are uploaded to the public `product-images` Storage bucket.

**Security note:** tables still carry permissive `dev_all_*` RLS policies because the POS signs in with a
local PIN, not Supabase Auth. Before handling real customer data, move to Supabase Auth and drop those policies.
