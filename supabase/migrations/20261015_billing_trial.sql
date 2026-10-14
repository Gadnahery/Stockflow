-- Add a non-blocking 7-day trial to Billing v2.
alter table public.business_subscriptions
  add column if not exists trial_ends_at timestamptz;

alter table public.business_subscriptions
  drop constraint if exists business_subscriptions_status_check;

alter table public.business_subscriptions
  add constraint business_subscriptions_status_check
  check (status in ('trialing', 'pending', 'active', 'past_due', 'cancelled'));

create index if not exists business_subscriptions_trial_end_idx
  on public.business_subscriptions (trial_ends_at)
  where status = 'trialing';
