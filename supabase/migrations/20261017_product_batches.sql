-- Product batches for FEFO / expiry tracking (idempotent)
CREATE TABLE IF NOT EXISTS product_batches (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  product_id uuid NOT NULL,
  product_name text,
  batch_no text,
  expiry_date date,
  quantity numeric NOT NULL DEFAULT 0,
  location text NOT NULL DEFAULT 'shop' CHECK (location IN ('shop', 'store')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_batches_business_product_idx
  ON product_batches (business_id, product_id);
CREATE INDEX IF NOT EXISTS product_batches_expiry_idx
  ON product_batches (business_id, expiry_date)
  WHERE quantity > 0;

ALTER TABLE products ADD COLUMN IF NOT EXISTS store_stock numeric DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date date;
ALTER TABLE products ADD COLUMN IF NOT EXISTS batch_number text;

-- RLS: members of the business can read/write batches
ALTER TABLE product_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_batches_member_all ON product_batches;
CREATE POLICY product_batches_member_all ON product_batches
  FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM business_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM business_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
