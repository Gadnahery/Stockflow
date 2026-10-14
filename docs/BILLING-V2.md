# StockFlow Billing v2

## Rollout state

Billing v2 is designed to be non-blocking: billing state must never disable POS, sales, inventory, reports, or access to business data. Workspace access and write permissions continue to come from authenticated membership and role permissions.

The portal uses three configured monthly plans: Starter (TZS 25,000), Growth (TZS 45,000), and Business Pro (TZS 75,000). Review plan features and prices before publicly marketing them; keep a plan inactive if it is not approved.

## Database setup

Apply `supabase/migrations/20261014_billing_v2.sql` to the configured Supabase project before enabling the portal. The migration creates:

- `billing_plans`: server-managed plan definitions and prices.
- `business_subscriptions`: current plan and billing period.
- `billing_invoices`: immutable amount due and invoice status.
- `billing_payment_attempts`: provider reference, phone, and verification status.

Authenticated users can read only active plans and billing records for a business they belong to. There are no client-side insert/update policies for invoices, subscriptions, or payment attempts; writes use the server-side service role. The settlement RPC locks the invoice and payment attempt so duplicate status checks/webhooks cannot extend a subscription twice.

## Configure a plan

Plans are stored in `billing_plans` and can be adjusted by an operator with trusted database access. The active plan codes are `starter-monthly`, `growth-monthly`, and `business-pro-monthly`.

To update plans, use trusted admin tooling and keep the `features` list aligned with features that are actually available in the app.

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
- Configure `HARAKAPAY_API_KEY` only as a server-side Vercel environment variable. If a key has been pasted into chat or source control, rotate it before live use.
- Before production charging, verify the HarakaPay response schema against a test order, and test success, failure, duplicate webhook, amount mismatch, and interrupted-network cases.
