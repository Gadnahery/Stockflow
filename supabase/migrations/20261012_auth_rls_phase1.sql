-- Phase 1: Real auth, membership, RLS (drop dev_all_*), create_business RPC
-- Idempotent — safe to re-run.

-- ─────────────────────────────────────────────────────────────
-- 1. Extend business_members
-- ─────────────────────────────────────────────────────────────
alter table public.business_members
  add column if not exists permissions text[] not null default '{}',
  add column if not exists branch_ids uuid[] not null default '{}',
  add column if not exists status text not null default 'active'
    check (status in ('active','invited','suspended','removed')),
  add column if not exists invited_by uuid,
  add column if not exists invited_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists pin_hash text,
  add column if not exists last_seen_at timestamptz,
  add column if not exists display_name text;

-- role defaults already exist; ensure known values
-- owner | manager | cashier | storekeeper | accountant | waiter | auditor

create index if not exists business_members_user_idx on public.business_members (user_id);
create index if not exists business_members_biz_idx on public.business_members (business_id);

-- ─────────────────────────────────────────────────────────────
-- 2. Extend profiles
-- ─────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists phone text,
  add column if not exists preferred_language text default 'en',
  add column if not exists mfa_enabled boolean not null default false;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 3. Extend staff_members (PIN-only till users, no auth.users)
-- ─────────────────────────────────────────────────────────────
alter table public.staff_members
  add column if not exists permissions text[] not null default '{}',
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists failed_pin_attempts int not null default 0,
  add column if not exists locked_until timestamptz;

-- ─────────────────────────────────────────────────────────────
-- 4. Extend terminals / device registration
-- ─────────────────────────────────────────────────────────────
alter table public.terminals
  add column if not exists last_seen_at timestamptz,
  add column if not exists status text not null default 'active'
    check (status in ('active','revoked','pending')),
  add column if not exists user_agent text,
  add column if not exists label text;

-- ─────────────────────────────────────────────────────────────
-- 5. Invites table
-- ─────────────────────────────────────────────────────────────
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  role text not null default 'cashier',
  permissions text[] not null default '{}',
  branch_ids uuid[] not null default '{}',
  token text not null unique,
  invited_by uuid references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invites_token_idx on public.invites (token);
create index if not exists invites_email_idx on public.invites (email);

-- ─────────────────────────────────────────────────────────────
-- 6. Helper: is_member_of (already exists; keep search_path)
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_member_of(biz uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = biz
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

-- Member role helper
create or replace function public.member_role(biz uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role from public.business_members m
  where m.business_id = biz and m.user_id = auth.uid() and m.status = 'active'
  limit 1;
$$;

-- Has permission helper (owner always true)
create or replace function public.has_permission(biz uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = biz
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (
        m.role = 'owner'
        or perm = any(m.permissions)
      )
  );
$$;

revoke all on function public.is_member_of(uuid) from public, anon;
revoke all on function public.member_role(uuid) from public, anon;
revoke all on function public.has_permission(uuid, text) from public, anon;
grant execute on function public.is_member_of(uuid) to authenticated;
grant execute on function public.member_role(uuid) to authenticated;
grant execute on function public.has_permission(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 7. create_business RPC (first signup → business + branch + owner)
-- ─────────────────────────────────────────────────────────────
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

  -- owner membership with full permissions
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

  -- seed app_settings (id is text PK)
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

revoke all on function public.create_business(text, text, text) from public, anon;
grant execute on function public.create_business(text, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 8. Accept invite RPC
-- ─────────────────────────────────────────────────────────────
create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_inv from public.invites
  where token = p_token and accepted_at is null and expires_at > now()
  for update;

  if not found then
    raise exception 'Invalid or expired invite';
  end if;

  insert into public.business_members (
    business_id, user_id, role, permissions, branch_ids, status, invited_by, invited_at, accepted_at, display_name
  ) values (
    v_inv.business_id,
    v_uid,
    v_inv.role,
    v_inv.permissions,
    v_inv.branch_ids,
    'active',
    v_inv.invited_by,
    v_inv.created_at,
    now(),
    (select full_name from public.profiles where id = v_uid)
  )
  on conflict do nothing;

  update public.invites set accepted_at = now() where id = v_inv.id;

  return v_inv.business_id;
end;
$$;

revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 9. DROP every dev_all_* policy
-- ─────────────────────────────────────────────────────────────
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and policyname like 'dev_all_%'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Drop overly-permissive demo read policies
drop policy if exists branches_public_read_demo on public.branches;
drop policy if exists businesses_public_read_demo on public.businesses;
drop policy if exists categories_public_read_demo on public.categories;

-- ─────────────────────────────────────────────────────────────
-- 10. RLS policies (member-scoped)
-- ─────────────────────────────────────────────────────────────

-- businesses
drop policy if exists businesses_select_member on public.businesses;
create policy businesses_select_member on public.businesses
  for select to authenticated
  using (is_member_of(id));

drop policy if exists businesses_update_owner on public.businesses;
create policy businesses_update_owner on public.businesses
  for update to authenticated
  using (member_role(id) = 'owner')
  with check (member_role(id) = 'owner');

-- business_members
drop policy if exists members_select on public.business_members;
create policy members_select on public.business_members
  for select to authenticated
  using (is_member_of(business_id) or user_id = auth.uid());

drop policy if exists members_manage on public.business_members;
create policy members_manage on public.business_members
  for all to authenticated
  using (has_permission(business_id, 'MANAGE_USERS'))
  with check (has_permission(business_id, 'MANAGE_USERS'));

-- profiles: own row
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());

-- Generic pattern for business-scoped tables
-- products
drop policy if exists products_member on public.products;
drop policy if exists products_select on public.products;
drop policy if exists products_write on public.products;
create policy products_select on public.products
  for select to authenticated using (is_member_of(business_id));
create policy products_write on public.products
  for all to authenticated
  using (has_permission(business_id, 'MANAGE_PRODUCTS') or has_permission(business_id, 'CREATE_SALE'))
  with check (has_permission(business_id, 'MANAGE_PRODUCTS') or has_permission(business_id, 'CREATE_SALE'));

-- customers
drop policy if exists customers_member on public.customers;
drop policy if exists customers_select on public.customers;
drop policy if exists customers_write on public.customers;
create policy customers_select on public.customers
  for select to authenticated using (is_member_of(business_id));
create policy customers_write on public.customers
  for all to authenticated
  using (has_permission(business_id, 'MANAGE_CUSTOMERS') or has_permission(business_id, 'CREATE_SALE'))
  with check (has_permission(business_id, 'MANAGE_CUSTOMERS') or has_permission(business_id, 'CREATE_SALE'));

-- suppliers
drop policy if exists suppliers_member on public.suppliers;
drop policy if exists suppliers_select on public.suppliers;
drop policy if exists suppliers_write on public.suppliers;
create policy suppliers_select on public.suppliers
  for select to authenticated using (is_member_of(business_id));
create policy suppliers_write on public.suppliers
  for all to authenticated
  using (has_permission(business_id, 'MANAGE_SUPPLIERS'))
  with check (has_permission(business_id, 'MANAGE_SUPPLIERS'));

-- sales + sale_items + payments — cashiers can insert, limited update
drop policy if exists sales_member on public.sales;
drop policy if exists sales_select on public.sales;
drop policy if exists sales_insert on public.sales;
drop policy if exists sales_update on public.sales;
create policy sales_select on public.sales
  for select to authenticated using (is_member_of(business_id));
create policy sales_insert on public.sales
  for insert to authenticated
  with check (has_permission(business_id, 'CREATE_SALE'));
create policy sales_update on public.sales
  for update to authenticated
  using (has_permission(business_id, 'VOID_SALE') or has_permission(business_id, 'REFUND_SALE'))
  with check (has_permission(business_id, 'VOID_SALE') or has_permission(business_id, 'REFUND_SALE'));

drop policy if exists sale_items_member on public.sale_items;
drop policy if exists sale_items_select on public.sale_items;
drop policy if exists sale_items_insert on public.sale_items;
create policy sale_items_select on public.sale_items
  for select to authenticated using (is_member_of(business_id));
create policy sale_items_insert on public.sale_items
  for insert to authenticated
  with check (has_permission(business_id, 'CREATE_SALE'));
-- allow delete for idempotent re-upload of items during sync
create policy sale_items_delete on public.sale_items
  for delete to authenticated
  using (has_permission(business_id, 'CREATE_SALE'));

drop policy if exists payments_member on public.payments;
drop policy if exists payments_select on public.payments;
drop policy if exists payments_insert on public.payments;
create policy payments_select on public.payments
  for select to authenticated using (is_member_of(business_id));
create policy payments_insert on public.payments
  for insert to authenticated
  with check (has_permission(business_id, 'CREATE_SALE'));

-- stock_movements
drop policy if exists stock_movements_member on public.stock_movements;
drop policy if exists stock_movements_select on public.stock_movements;
drop policy if exists stock_movements_insert on public.stock_movements;
create policy stock_movements_select on public.stock_movements
  for select to authenticated using (is_member_of(business_id));
create policy stock_movements_insert on public.stock_movements
  for insert to authenticated
  with check (
    has_permission(business_id, 'ADJUST_STOCK')
    or has_permission(business_id, 'CREATE_SALE')
    or has_permission(business_id, 'MANAGE_PRODUCTS')
  );

-- expenses
drop policy if exists expenses_member on public.expenses;
drop policy if exists expenses_select on public.expenses;
drop policy if exists expenses_write on public.expenses;
create policy expenses_select on public.expenses
  for select to authenticated using (is_member_of(business_id));
create policy expenses_write on public.expenses
  for all to authenticated
  using (is_member_of(business_id))
  with check (is_member_of(business_id));

-- cash_sessions / shifts
drop policy if exists cash_sessions_member on public.cash_sessions;
drop policy if exists cash_sessions_select on public.cash_sessions;
drop policy if exists cash_sessions_write on public.cash_sessions;
create policy cash_sessions_select on public.cash_sessions
  for select to authenticated using (is_member_of(business_id));
create policy cash_sessions_write on public.cash_sessions
  for all to authenticated
  using (has_permission(business_id, 'MANAGE_SHIFTS') or is_member_of(business_id))
  with check (has_permission(business_id, 'MANAGE_SHIFTS') or is_member_of(business_id));

-- purchases
drop policy if exists purchases_member on public.purchases;
drop policy if exists purchases_select on public.purchases;
drop policy if exists purchases_write on public.purchases;
create policy purchases_select on public.purchases
  for select to authenticated using (is_member_of(business_id));
create policy purchases_write on public.purchases
  for all to authenticated
  using (has_permission(business_id, 'MANAGE_SUPPLIERS'))
  with check (has_permission(business_id, 'MANAGE_SUPPLIERS'));

-- app_settings
drop policy if exists app_settings_member on public.app_settings;
drop policy if exists app_settings_select on public.app_settings;
drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_select on public.app_settings
  for select to authenticated using (is_member_of(business_id));
create policy app_settings_write on public.app_settings
  for all to authenticated
  using (has_permission(business_id, 'MANAGE_SETTINGS'))
  with check (has_permission(business_id, 'MANAGE_SETTINGS'));

-- audit_logs: insert + select only
drop policy if exists audit_logs_insert on public.audit_logs;
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated using (is_member_of(business_id));
create policy audit_logs_insert on public.audit_logs
  for insert to authenticated
  with check (is_member_of(business_id));
-- no update/delete policies → forbidden

-- categories, branches, warehouses, terminals, staff, sync_ack, invites
drop policy if exists categories_member on public.categories;
create policy categories_select on public.categories
  for select to authenticated using (is_member_of(business_id));
create policy categories_write on public.categories
  for all to authenticated
  using (has_permission(business_id, 'MANAGE_PRODUCTS'))
  with check (has_permission(business_id, 'MANAGE_PRODUCTS'));

drop policy if exists branches_member on public.branches;
create policy branches_select on public.branches
  for select to authenticated using (is_member_of(business_id));
create policy branches_write on public.branches
  for all to authenticated
  using (member_role(business_id) in ('owner','manager'))
  with check (member_role(business_id) in ('owner','manager'));

drop policy if exists warehouses_member on public.warehouses;
create policy warehouses_select on public.warehouses
  for select to authenticated using (is_member_of(business_id));
create policy warehouses_write on public.warehouses
  for all to authenticated
  using (member_role(business_id) in ('owner','manager'))
  with check (member_role(business_id) in ('owner','manager'));

drop policy if exists terminals_member on public.terminals;
create policy terminals_select on public.terminals
  for select to authenticated using (is_member_of(business_id));
create policy terminals_write on public.terminals
  for all to authenticated
  using (is_member_of(business_id))
  with check (is_member_of(business_id));

drop policy if exists staff_member_all on public.staff_members;
create policy staff_select on public.staff_members
  for select to authenticated using (is_member_of(business_id));
create policy staff_write on public.staff_members
  for all to authenticated
  using (has_permission(business_id, 'MANAGE_USERS'))
  with check (has_permission(business_id, 'MANAGE_USERS'));

drop policy if exists sync_ack_member on public.sync_acknowledgements;
create policy sync_ack_all on public.sync_acknowledgements
  for all to authenticated
  using (is_member_of(business_id))
  with check (is_member_of(business_id));

alter table public.invites enable row level security;
create policy invites_select on public.invites
  for select to authenticated
  using (is_member_of(business_id) or email = (select email from public.profiles where id = auth.uid()));
create policy invites_write on public.invites
  for all to authenticated
  using (has_permission(business_id, 'MANAGE_USERS'))
  with check (has_permission(business_id, 'MANAGE_USERS'));

-- ─────────────────────────────────────────────────────────────
-- 11. Ensure RLS is enabled on all tenant tables
-- ─────────────────────────────────────────────────────────────
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.profiles enable row level security;
alter table public.branches enable row level security;
alter table public.warehouses enable row level security;
alter table public.terminals enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;
alter table public.stock_movements enable row level security;
alter table public.expenses enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.purchases enable row level security;
alter table public.app_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.categories enable row level security;
alter table public.staff_members enable row level security;
alter table public.sync_acknowledgements enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 12. Storage: product-images scoped by path prefix business_id/
-- ─────────────────────────────────────────────────────────────
drop policy if exists product_images_public_read on storage.objects;
drop policy if exists product_images_insert on storage.objects;
drop policy if exists product_images_update on storage.objects;
drop policy if exists product_images_delete on storage.objects;

create policy product_images_public_read on storage.objects
  for select using (bucket_id = 'product-images');

create policy product_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and is_member_of((storage.foldername(name))[1]::uuid)
  );

create policy product_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-images'
    and is_member_of((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'product-images'
    and is_member_of((storage.foldername(name))[1]::uuid)
  );

create policy product_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and is_member_of((storage.foldername(name))[1]::uuid)
  );

-- ─────────────────────────────────────────────────────────────
-- 13. Audit immutability trigger
-- ─────────────────────────────────────────────────────────────
create or replace function public.forbid_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;

drop trigger if exists audit_no_update on public.audit_logs;
drop trigger if exists audit_no_delete on public.audit_logs;
create trigger audit_no_update before update on public.audit_logs
  for each row execute function public.forbid_audit_mutation();
create trigger audit_no_delete before delete on public.audit_logs
  for each row execute function public.forbid_audit_mutation();
