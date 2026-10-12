-- Allow members to read teammate profiles (for team UI emails/names)
create or replace function public.shares_business_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_members a
    join public.business_members b on a.business_id = b.business_id
    where a.user_id = auth.uid() and a.status = 'active'
      and b.user_id = other and b.status in ('active','suspended','invited')
  );
$$;

revoke all on function public.shares_business_with(uuid) from public, anon;
grant execute on function public.shares_business_with(uuid) to authenticated;

drop policy if exists profiles_select_teammates on public.profiles;
create policy profiles_select_teammates on public.profiles
  for select to authenticated
  using (id = auth.uid() or shares_business_with(id));
