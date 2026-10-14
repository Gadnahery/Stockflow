-- Branch-scoped product catalogues and consistent seven-day trials/invites.
alter table public.businesses
  add column if not exists trial_ends_at timestamptz,
  add column if not exists paid_until timestamptz,
  add column if not exists subscription_status text not null default 'trial';

update public.businesses
set trial_ends_at = created_at + interval '7 days'
where trial_ends_at is null;

alter table public.products
  add column if not exists branch_id uuid references public.branches(id) on delete set null;

update public.products p
set branch_id = (
  select br.id from public.branches br
  where br.business_id = p.business_id
  order by case when upper(br.code) = 'MAIN' then 0 else 1 end, br.created_at
  limit 1
)
where p.branch_id is null;

create index if not exists products_business_branch_updated_idx
  on public.products (business_id, branch_id, updated_at);

create or replace function public.stockflow_set_product_branch()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.branch_id is null then
    select br.id into new.branch_id from public.branches br
    where br.business_id = new.business_id
    order by case when upper(br.code) = 'MAIN' then 0 else 1 end, br.created_at
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists stockflow_products_default_branch on public.products;
create trigger stockflow_products_default_branch
before insert or update of business_id, branch_id on public.products
for each row execute function public.stockflow_set_product_branch();

create or replace function public.stockflow_enforce_invite_seven_days()
returns trigger language plpgsql set search_path = public
as $$
begin
  new.expires_at := coalesce(new.created_at, now()) + interval '7 days';
  return new;
end;
$$;

drop trigger if exists stockflow_invites_seven_day_expiry on public.invites;
create trigger stockflow_invites_seven_day_expiry
before insert or update of created_at, expires_at on public.invites
for each row execute function public.stockflow_enforce_invite_seven_days();

update public.invites
set expires_at = created_at + interval '7 days'
where expires_at is distinct from created_at + interval '7 days';

create or replace function public.create_business(p_name text, p_phone text default null, p_address text default null)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_biz uuid;
  v_branch uuid;
  v_name text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.business_members where user_id = v_uid and status = 'active') then
    raise exception 'User already belongs to a business';
  end if;

  insert into public.businesses (name, trial_ends_at, subscription_status)
  values (coalesce(nullif(trim(p_name), ''), 'My Store'), now() + interval '7 days', 'trial')
  returning id into v_biz;

  insert into public.branches (business_id, name, code)
  values (v_biz, 'Main', 'MAIN') returning id into v_branch;

  insert into public.warehouses (business_id, branch_id, name)
  values (v_biz, v_branch, 'Main warehouse');

  select coalesce(full_name, split_part(email, '@', 1)) into v_name
  from public.profiles where id = v_uid;
  if v_name is null then v_name := 'Owner'; end if;

  insert into public.business_members (
    business_id, user_id, role, permissions, branch_ids, status, accepted_at, display_name
  ) values (
    v_biz, v_uid, 'business_owner',
    array[
      'CREATE_SALE','VOID_SALE','REFUND_SALE','CHANGE_PRICE','APPLY_DISCOUNT',
      'ADJUST_STOCK','VIEW_PROFIT','EXPORT_DATA','MANAGE_USERS','MANAGE_PRODUCTS',
      'MANAGE_CUSTOMERS','MANAGE_SUPPLIERS','VIEW_REPORTS','MANAGE_SHIFTS','MANAGE_SETTINGS'
    ]::text[],
    array[v_branch], 'active', now(), v_name
  );

  insert into public.app_settings (id, business_id, business_name, business_phone, business_address, currency, tax_rate, tax_inclusive, offline_window_hours)
  values ('main-' || v_biz::text, v_biz, coalesce(nullif(trim(p_name), ''), 'My Store'), p_phone, p_address, 'TZS', 18, true, 72)
  on conflict (id) do nothing;

  return v_biz;
end;
$$;
