-- Optional: ensure products can be scoped per branch (idempotent)
ALTER TABLE products ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS products_business_branch_idx ON products (business_id, branch_id);

-- Null branch_id = shared catalogue product
COMMENT ON COLUMN products.branch_id IS 'Null = shared across branches; set = belongs only to that branch (isolated catalogue mode)';
