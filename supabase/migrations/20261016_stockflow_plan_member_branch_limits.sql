-- Enforce StockFlow plan limits in the database as well as the UI.
alter table public.billing_plans
  add column if not exists max_members integer,
  add column if not exists max_branches integer;

update public.billing_plans
set max_members = case code when 'starter-monthly' then 5 when 'growth-monthly' then 15 when 'business-pro-monthly' then 50 else max_members end,
    max_branches = case code when 'starter-monthly' then 1 when 'growth-monthly' then 3 when 'business-pro-monthly' then 9999 else max_branches end,
    features = case code
      when 'starter-monthly' then '["POS sales and receipts","Product and stock management","Customer records","Sales history","Basic reports","Offline use and synchronization","Up to 5 members including the owner","1 branch"]'::jsonb
      when 'growth-monthly' then '["Everything in Starter","Supplier management","Expenses and profit reports","Detailed sales analytics","Stock adjustments","Team accounts and permissions","Up to 15 members including the owner","Up to 3 branches"]'::jsonb
      when 'business-pro-monthly' then '["Everything in Growth","Advanced reports and exports","Multi-branch management","Audit history","Up to 50 members including the owner","Unlimited branches"]'::jsonb
      else features end,
    updated_at = now()
where code in ('starter-monthly','growth-monthly','business-pro-monthly');

create or replace function public.enforce_stockflow_branch_plan_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_limit integer; v_count integer;
begin
  select p.max_branches into v_limit from public.business_subscriptions s join public.billing_plans p on p.id=s.plan_id
  where s.business_id=new.business_id and s.status in ('active','trialing') limit 1;
  if not found then v_limit := 1; end if;
  select count(*) into v_count from public.branches where business_id=new.business_id;
  if v_count >= coalesce(v_limit,1) then raise exception 'Plan branch limit reached. Upgrade your StockFlow plan to add another branch.'; end if;
  return new;
end; $$;

create or replace function public.enforce_stockflow_member_plan_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_limit integer; v_count integer;
begin
  select p.max_members into v_limit from public.business_subscriptions s join public.billing_plans p on p.id=s.plan_id
  where s.business_id=new.business_id and s.status in ('active','trialing') limit 1;
  if not found then v_limit := 5; end if;
  select count(*) into v_count from public.business_members where business_id=new.business_id and status='active';
  if v_count >= coalesce(v_limit,5) then raise exception 'Plan member limit reached. The owner counts as a member; upgrade your StockFlow plan to add another.'; end if;
  return new;
end; $$;

create or replace function public.enforce_stockflow_invite_plan_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_limit integer; v_count integer;
begin
  select p.max_members into v_limit from public.business_subscriptions s join public.billing_plans p on p.id=s.plan_id
  where s.business_id=new.business_id and s.status in ('active','trialing') limit 1;
  if not found then v_limit := 5; end if;
  select count(*) into v_count from public.business_members where business_id=new.business_id and status='active';
  v_count := v_count + (select count(*) from public.invites where business_id=new.business_id and accepted_at is null and expires_at > now());
  if v_count >= coalesce(v_limit,5) then raise exception 'Plan member limit reached. The owner counts as a member; upgrade your StockFlow plan to invite another.'; end if;
  return new;
end; $$;

drop trigger if exists stockflow_branch_plan_limit on public.branches;
create trigger stockflow_branch_plan_limit before insert on public.branches for each row execute function public.enforce_stockflow_branch_plan_limit();
drop trigger if exists stockflow_member_plan_limit on public.business_members;
create trigger stockflow_member_plan_limit before insert on public.business_members for each row execute function public.enforce_stockflow_member_plan_limit();
drop trigger if exists stockflow_invite_plan_limit on public.invites;
create trigger stockflow_invite_plan_limit before insert on public.invites for each row execute function public.enforce_stockflow_invite_plan_limit();
