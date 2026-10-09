-- Applied to project yyuwbqvonylgjrlmvwjj via Supabase connector.
-- 1. App uses 'refunded' sales; allow it
alter table public.sales drop constraint if exists sales_status_check;
alter table public.sales add constraint sales_status_check check (status in ('completed','voided','refunded','held'));

-- 2. Product photo storage (public read; uploads from the POS)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists product_images_public_read on storage.objects;
drop policy if exists product_images_insert on storage.objects;
drop policy if exists product_images_update on storage.objects;
create policy product_images_public_read on storage.objects for select using (bucket_id = 'product-images');
create policy product_images_insert on storage.objects for insert with check (bucket_id = 'product-images');
create policy product_images_update on storage.objects for update using (bucket_id = 'product-images') with check (bucket_id = 'product-images');

-- 3. Indexes
create index if not exists sale_items_sale_id_idx on public.sale_items (sale_id);
create index if not exists sale_items_product_id_idx on public.sale_items (product_id);
create index if not exists sales_business_created_idx on public.sales (business_id, created_at desc);
create index if not exists products_business_idx on public.products (business_id);
create index if not exists customers_business_idx on public.customers (business_id);
create index if not exists payments_sale_id_idx on public.payments (sale_id);
create index if not exists stock_movements_product_idx on public.stock_movements (product_id);
