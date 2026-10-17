/**
 * Apply product_batches + store_stock migration to Supabase.
 *
 * Usage (needs DB password or service role via direct Postgres):
 *   DATABASE_URL='postgresql://postgres.[ref]:[PASSWORD]@aws-0-REGION.pooler.supabase.com:6543/postgres' node scripts/apply-batches-migration.mjs
 *
 * Or paste supabase/migrations/20261017_product_batches.sql in the Supabase Dashboard → SQL Editor → Run.
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(join(__dirname, '../supabase/migrations/20261017_product_batches.sql'), 'utf8')

const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
if (!url) {
  console.error('Set DATABASE_URL to your Supabase Postgres connection string.')
  console.error('Or run the SQL file manually in the Supabase SQL Editor.')
  console.log('\n--- SQL ---\n')
  console.log(sql)
  process.exit(1)
}

const { default: pg } = await import('pg').catch(() => ({ default: null }))
if (!pg) {
  console.error('Install pg: npm install pg')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  await client.query(sql)
  console.log('Migration applied successfully.')
} finally {
  await client.end()
}
