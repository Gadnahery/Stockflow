-- Subscription / 7-day trial + HarakaPay payment orders

alter table public.businesses
  add column if not exists trial_ends_at timestamptz,
  add column if not exists paid_until timestamptz,
  add column if not exists subscription_status text default 'trial',
  add column if not exists last_payment_order_id text,
  add column if not exists last_payment_at timestamptz;

-- Backfill existing businesses: 7-day trial from now if unset
update public.businesses
set
  trial_ends_at = coalesce(trial_ends_at, now() + interval '7 days'),
  subscription_status = coalesce(nullif(subscription_status, ''), 'trial')
where trial_ends_at is null;

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  business_id uuid references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  amount numeric not null default 25000,
  net_amount numeric,
  fee_amount numeric,
  status text not null default 'pending',
  phone text,
  raw jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists payment_orders_business_idx on public.payment_orders (business_id);
create index if not exists payment_orders_status_idx on public.payment_orders (status);

alter table public.payment_orders enable row level security;

drop policy if exists payment_orders_select_member on public.payment_orders;
create policy payment_orders_select_member on public.payment_orders
  for select to authenticated
  using (
    business_id in (
      select business_id from public.business_members
      where user_id = auth.uid() and status = 'active'
    )
  );

drop policy if exists payment_orders_insert_member on public.payment_orders;
create policy payment_orders_insert_member on public.payment_orders
  for insert to authenticated
  with check (
    business_id in (
      select business_id from public.business_members
      where user_id = auth.uid() and status = 'active'
      and role in ('owner', 'admin')
    )
  );

-- New businesses get 7-day trial
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

  insert into public.businesses (name, trial_ends_at, subscription_status)
  values (p_name, now() + interval '7 days', 'trial')
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
    v_biz,
    v_uid,
    'owner',
    array[
      'CREATE_SALE','VOID_SALE','REFUND_SALE','CHANGE_PRICE','APPLY_DISCOUNT',
      'ADJUST_STOCK','VIEW_PROFIT','EXPORT_DATA','MANAGE_USERS','MANAGE_PRODUCTS',
      'MANAGE_CUSTOMERS','MANAGE_SUPPLIERS','VIEW_REPORTS','MANAGE_SHIFTS','MANAGE_SETTINGS'
    ],
    array[v_branch],
    'active',
    now(),
    (select full_name from public.profiles where id = v_uid)
  );

  insert into public.app_settings (id, business_id, business_name, business_phone, business_address, currency, tax_rate, tax_inclusive, offline_window_hours)
  values (
    'main-' || v_biz::text,
    v_biz,
    p_name,
    p_phone,
    p_address,
    'TZS',
    18,
    true,
    72
  )
  on conflict (id) do nothing;

  return v_biz;
end;
$$;

-- Storage bucket for avatars (run in dashboard if storage policies need UI)
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;

-- Industry module flag (SRS §8)
alter table public.businesses
  add column if not exists industry_type text default 'retail';

-- Local settings mirror can stay in Dexie; cloud column for reporting
