-- StockFlow Billing v2: provider-neutral records with server-only writes.
-- No plan is seeded until the business owner confirms pricing. Existing sales/payment data is untouched.

create table if not exists public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  amount_tzs numeric(12,2) not null check (amount_tzs > 0),
  interval text not null default 'month' check (interval in ('month', 'year')),
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  plan_id uuid not null references public.billing_plans(id),
  status text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'cancelled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan_id uuid not null references public.billing_plans(id),
  amount_tzs numeric(12,2) not null check (amount_tzs > 0),
  currency text not null default 'TZS' check (currency = 'TZS'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled')),
  issued_at timestamptz not null default now(),
  due_at timestamptz,
  paid_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists billing_invoices_business_created_idx
  on public.billing_invoices (business_id, created_at desc);

create table if not exists public.billing_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.billing_invoices(id) on delete cascade,
  provider text not null,
  provider_reference text unique,
  amount_tzs numeric(12,2) not null check (amount_tzs > 0),
  phone text,
  status text not null default 'initiated' check (status in ('initiated', 'pending', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  confirmed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists billing_payment_attempts_invoice_idx
  on public.billing_payment_attempts (invoice_id, requested_at desc);

alter table public.billing_plans enable row level security;
alter table public.business_subscriptions enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.billing_payment_attempts enable row level security;

drop policy if exists billing_plans_active_read on public.billing_plans;
create policy billing_plans_active_read on public.billing_plans
  for select to authenticated using (is_active = true);

drop policy if exists business_subscriptions_member_read on public.business_subscriptions;
create policy business_subscriptions_member_read on public.business_subscriptions
  for select to authenticated using (
    exists (select 1 from public.business_members m
      where m.business_id = business_subscriptions.business_id
        and m.user_id = auth.uid() and m.status = 'active')
  );

drop policy if exists billing_invoices_member_read on public.billing_invoices;
create policy billing_invoices_member_read on public.billing_invoices
  for select to authenticated using (
    exists (select 1 from public.business_members m
      where m.business_id = billing_invoices.business_id
        and m.user_id = auth.uid() and m.status = 'active')
  );

drop policy if exists billing_payment_attempts_member_read on public.billing_payment_attempts;
create policy billing_payment_attempts_member_read on public.billing_payment_attempts
  for select to authenticated using (
    exists (select 1 from public.billing_invoices i
      join public.business_members m on m.business_id = i.business_id
      where i.id = billing_payment_attempts.invoice_id
        and m.user_id = auth.uid() and m.status = 'active')
  );

-- Replace the old create_business function so new workspaces no longer receive
-- trial/subscription metadata. Keep all existing workspace setup behavior.
create or replace function public.create_business(
  p_name text,
  p_phone text default null,
  p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_biz uuid;
  v_branch uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.business_members where user_id = v_uid and status = 'active') then
    raise exception 'User already belongs to a business';
  end if;

  insert into public.businesses (name)
  values (p_name)
  returning id into v_biz;

  insert into public.branches (business_id, name, code)
  values (v_biz, 'Main', 'MAIN')
  returning id into v_branch;

  insert into public.warehouses (business_id, branch_id, name)
  values (v_biz, v_branch, 'Main warehouse')
  on conflict do nothing;

  insert into public.business_members (
    business_id, user_id, role, permissions, branch_ids, status, accepted_at, display_name
  ) values (
    v_biz, v_uid, 'owner',
    array[
      'CREATE_SALE','VOID_SALE','REFUND_SALE','CHANGE_PRICE','APPLY_DISCOUNT',
      'ADJUST_STOCK','VIEW_PROFIT','EXPORT_DATA','MANAGE_USERS','MANAGE_PRODUCTS',
      'MANAGE_CUSTOMERS','MANAGE_SUPPLIERS','VIEW_REPORTS','MANAGE_SHIFTS','MANAGE_SETTINGS'
    ],
    array[v_branch], 'active', now(),
    (select full_name from public.profiles where id = v_uid)
  );

  insert into public.app_settings (
    id, business_id, business_name, business_phone, business_address,
    currency, tax_rate, tax_inclusive, offline_window_hours
  ) values (
    'main-' || v_biz::text, v_biz, p_name, p_phone, p_address, 'TZS', 18, true, 72
  ) on conflict (id) do nothing;

  return v_biz;
end;
$$;


-- Atomic, idempotent settlement. The caller must verify the provider payment first.
create or replace function public.finalize_billing_payment(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.billing_payment_attempts%rowtype;
  v_invoice public.billing_invoices%rowtype;
  v_plan public.billing_plans%rowtype;
  v_period_end timestamptz;
  v_period_start timestamptz;
  v_now timestamptz := now();
begin
  select * into v_attempt
  from public.billing_payment_attempts
  where id = p_attempt_id
  for update;

  if not found then raise exception 'Payment attempt not found'; end if;

  select * into v_invoice
  from public.billing_invoices
  where id = v_attempt.invoice_id
  for update;

  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.status = 'paid' then
    return jsonb_build_object('success', true, 'status', 'paid', 'invoice_number', v_invoice.invoice_number, 'already_processed', true);
  end if;
  if v_attempt.amount_tzs <> v_invoice.amount_tzs then raise exception 'Payment amount does not match invoice'; end if;

  select * into v_plan from public.billing_plans where id = v_invoice.plan_id;
  if not found then raise exception 'Billing plan not found'; end if;

  select current_period_end into v_period_end
  from public.business_subscriptions
  where business_id = v_invoice.business_id
  for update;

  v_period_start := greatest(v_now, coalesce(v_period_end, v_now));
  if v_plan.interval = 'year' then
    v_period_end := v_period_start + interval '1 year';
  else
    v_period_end := v_period_start + interval '1 month';
  end if;

  insert into public.business_subscriptions (
    business_id, plan_id, status, current_period_start, current_period_end, updated_at
  ) values (
    v_invoice.business_id, v_invoice.plan_id, 'active', v_period_start, v_period_end, v_now
  )
  on conflict (business_id) do update set
    plan_id = excluded.plan_id,
    status = 'active',
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    updated_at = excluded.updated_at;

  update public.billing_payment_attempts
  set status = 'completed', confirmed_at = v_now
  where id = v_attempt.id;

  update public.billing_invoices
  set status = 'paid', paid_at = v_now
  where id = v_invoice.id;

  return jsonb_build_object('success', true, 'status', 'paid', 'invoice_number', v_invoice.invoice_number, 'paid_at', v_now);
end;
$$;

revoke all on function public.finalize_billing_payment(uuid) from public, anon, authenticated;
grant execute on function public.finalize_billing_payment(uuid) to service_role;
