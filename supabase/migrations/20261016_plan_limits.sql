-- StockFlow plan limits and clearer plan entitlements.
-- Existing sales/products are not modified by this migration.
alter table public.billing_plans
  add column if not exists max_members integer not null default 5 check (max_members >= 1),
  add column if not exists max_branches integer not null default 1 check (max_branches >= 1);

update public.billing_plans
set
  max_members = case code
    when 'starter-monthly' then 5
    when 'growth-monthly' then 10
    when 'business-pro-monthly' then 25
    else max_members
  end,
  max_branches = case code
    when 'starter-monthly' then 1
    when 'growth-monthly' then 3
    when 'business-pro-monthly' then 10
    else max_branches
  end,
  description = case code
    when 'starter-monthly' then 'For a single shop getting started'
    when 'growth-monthly' then 'For growing shops with multiple team members and branches'
    when 'business-pro-monthly' then 'For larger operations managing multiple branches'
    else description
  end,
  features = case code
    when 'starter-monthly' then '[
      "POS sales and receipts",
      "Product and stock management",
      "Customer records and sales history",
      "Basic reports",
      "Offline use and synchronization",
      "Up to 5 members including the owner",
      "1 branch"
    ]'::jsonb
    when 'growth-monthly' then '[
      "Everything in Starter",
      "Supplier management",
      "Expenses and profit reports",
      "Detailed sales analytics",
      "Stock adjustments",
      "Up to 10 members including the owner",
      "Up to 3 branches"
    ]'::jsonb
    when 'business-pro-monthly' then '[
      "Everything in Growth",
      "Advanced reports and exports",
      "Audit history",
      "Up to 25 members including the owner",
      "Up to 10 branches"
    ]'::jsonb
    else features
  end,
  updated_at = now()
where code in ('starter-monthly', 'growth-monthly', 'business-pro-monthly');

create or replace function public.stockflow_enforce_plan_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer := 5;
  v_plan_code text;
  v_count integer;
begin
  if new.status is distinct from 'active' then
    return new;
  end if;

  select bp.code, bp.max_members into v_plan_code, v_max
  from public.business_subscriptions bs
  join public.billing_plans bp on bp.id = bs.plan_id
  where bs.business_id = new.business_id
    and bs.status in ('active', 'trialing')
  limit 1;

  v_max := coalesce(v_max, 5);

  select count(*)::integer into v_count
  from public.business_members bm
  where bm.business_id = new.business_id
    and bm.status = 'active'
    and (tg_op <> 'UPDATE' or bm.id <> new.id);

  if v_count >= v_max then
    raise exception 'This plan allows up to % active members, including the owner. Upgrade the plan to add more.', v_max
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists stockflow_plan_member_limit on public.business_members;
create trigger stockflow_plan_member_limit
before insert or update of status, business_id on public.business_members
for each row execute function public.stockflow_enforce_plan_member_limit();

create or replace function public.stockflow_enforce_plan_branch_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer := 1;
  v_count integer;
begin
  select bp.max_branches into v_max
  from public.business_subscriptions bs
  join public.billing_plans bp on bp.id = bs.plan_id
  where bs.business_id = new.business_id
    and bs.status in ('active', 'trialing')
  limit 1;

  v_max := coalesce(v_max, 1);

  select count(*)::integer into v_count
  from public.branches br
  where br.business_id = new.business_id
    and (tg_op <> 'UPDATE' or br.id <> new.id);

  if v_count >= v_max then
    raise exception 'This plan allows up to % branches. Upgrade the plan to add another branch.', v_max
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists stockflow_plan_branch_limit on public.branches;
create trigger stockflow_plan_branch_limit
before insert or update of business_id on public.branches
for each row execute function public.stockflow_enforce_plan_branch_limit();
