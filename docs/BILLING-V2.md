# StockFlow Billing v2

## Rollout state

Billing v2 is designed to be non-blocking: billing state must never disable POS, sales, inventory, reports, or access to business data. Workspace access and write permissions continue to come from authenticated membership and role permissions.

The portal is intentionally non-chargeable until at least one active plan is configured in the database. No price is seeded by default because prices must be confirmed before customers can be charged.

## Database setup

Apply `supabase/migrations/20261014_billing_v2.sql` to the configured Supabase project before enabling the portal. The migration creates:

- `billing_plans`: server-managed plan definitions and prices.
- `business_subscriptions`: current plan and billing period.
- `billing_invoices`: immutable amount due and invoice status.
- `billing_payment_attempts`: provider reference, phone, and verification status.

Authenticated users can read only active plans and billing records for a business they belong to. There are no client-side insert/update policies for invoices, subscriptions, or payment attempts; writes use the server-side service role. The settlement RPC locks the invoice and payment attempt so duplicate status checks/webhooks cannot extend a subscription twice.

## Configure a plan

After pricing is approved, an operator with trusted database access can add an active plan. Example structure (replace the values before running):

```sql
insert into public.billing_plans (code, name, description, amount_tzs, interval, features, is_active)
values (
  'standard-monthly',
  'Standard',
  'StockFlow for one business',
  0, -- replace with the approved integer TZS amount before setting is_active=true
  'month',
  '["POS sales", "Inventory", "Reports"]'::jsonb,
  false
);
```

The database rejects zero amounts, so replace the example amount with an approved amount before executing. Keep `is_active=false` until the plan and price are approved. To activate it, update the row through trusted admin tooling.

## Required server environment

Keep these values server-side; never prefix secrets with `VITE_`:

- `HARAKAPAY_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SITE_URL`

The checkout endpoint gets the price from the active plan row; it does not trust a client-provided amount. It verifies the user session and owner/admin membership before creating an invoice and sending a payment prompt. Status checks and webhooks verify the order directly with HarakaPay and compare the provider amount to the invoice before settlement.

## Important limits

- The provider is currently HarakaPay; the schema is provider-neutral so another provider can be added without replacing the billing records.
- This module does not automatically block or make the POS read-only if an invoice expires or payment fails.
- Before production charging, confirm the approved prices, verify the HarakaPay response schema against a sandbox/test order, apply the migration, and test success, failure, duplicate webhook, amount mismatch, and interrupted-network cases.
