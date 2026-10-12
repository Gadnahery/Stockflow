-- Allow sales upsert retries (INSERT + UPDATE) for cashiers
drop policy if exists sales_update on public.sales;
create policy sales_update on public.sales
  for update to authenticated
  using (
    has_permission(business_id, 'CREATE_SALE')
    or has_permission(business_id, 'VOID_SALE')
    or has_permission(business_id, 'REFUND_SALE')
  )
  with check (
    has_permission(business_id, 'CREATE_SALE')
    or has_permission(business_id, 'VOID_SALE')
    or has_permission(business_id, 'REFUND_SALE')
  );

drop policy if exists sale_items_update on public.sale_items;
create policy sale_items_update on public.sale_items
  for update to authenticated
  using (has_permission(business_id, 'CREATE_SALE'))
  with check (has_permission(business_id, 'CREATE_SALE'));
