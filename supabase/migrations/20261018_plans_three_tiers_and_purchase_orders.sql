-- Applied to project yyuwbqvonylgjrlmvwjj. Three plans + purchase order document fields.
alter table public.billing_plans add column if not exists extra_branch_price_tzs numeric(12,2) not null default 0;
update public.billing_plans set name='Starter', amount_tzs=25000, max_branches=1, max_members=4, extra_branch_price_tzs=0, description='One shop, up to 4 accounts' where code='starter-monthly';
update public.billing_plans set name='Growth', amount_tzs=45000, max_branches=3, max_members=12, extra_branch_price_tzs=0, description='A shop with up to 3 branches, up to 12 accounts' where code='growth-monthly';
update public.billing_plans set name='Business Pro', amount_tzs=70000, max_branches=5, max_members=15, extra_branch_price_tzs=10000, description='Up to 5 branches and 15 accounts; each extra branch +10,000 TZS' where code='business-pro-monthly';
alter table public.purchases add column if not exists po_number text;
alter table public.purchases add column if not exists expected_date date;
alter table public.purchases add column if not exists delivery_address text;
alter table public.purchases add column if not exists payment_terms text;
alter table public.purchases add column if not exists authorized_by text;
