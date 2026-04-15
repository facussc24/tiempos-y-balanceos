/**
 * Migration: Create Medios Calculator tables in Supabase.
 * Run: node scripts/migrate-medios-tables.mjs
 *
 * Idempotent — safe to run multiple times (uses IF NOT EXISTS).
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

const SQL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS medios_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    utilization_rate REAL DEFAULT 0.55,
    available_m2 REAL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
  )`,
  `CREATE TABLE IF NOT EXISTS medios_container_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    length_mm INTEGER NOT NULL,
    width_mm INTEGER NOT NULL,
    height_mm INTEGER NOT NULL,
    weight_ref_kg REAL,
    max_stacking INTEGER DEFAULT 1,
    default_pcs INTEGER,
    created_by UUID
  )`,
  `CREATE TABLE IF NOT EXISTS medios_pieces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES medios_projects(id) ON DELETE CASCADE,
    piece_code TEXT NOT NULL,
    description TEXT DEFAULT '',
    family TEXT DEFAULT '',
    client TEXT DEFAULT '',
    stage TEXT DEFAULT '',
    daily_demand INTEGER NOT NULL DEFAULT 0,
    lead_time_days REAL NOT NULL DEFAULT 0,
    safety_pct REAL DEFAULT 0.15,
    container_type_id UUID REFERENCES medios_container_types(id),
    pcs_per_container INTEGER NOT NULL DEFAULT 1,
    product_id UUID,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  // RLS policies (permissive — authenticated users can do everything)
  `ALTER TABLE medios_projects ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE medios_container_types ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE medios_pieces ENABLE ROW LEVEL SECURITY`,
];

const POLICIES = [
  { table: 'medios_projects', name: 'medios_projects_all', def: `FOR ALL TO authenticated USING (true) WITH CHECK (true)` },
  { table: 'medios_container_types', name: 'medios_ct_all', def: `FOR ALL TO authenticated USING (true) WITH CHECK (true)` },
  { table: 'medios_pieces', name: 'medios_pieces_all', def: `FOR ALL TO authenticated USING (true) WITH CHECK (true)` },
];

async function run() {
  console.log('Creating medios tables...');

  for (const sql of SQL_STATEMENTS) {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).single();
    if (error) {
      // Try direct approach if exec_sql RPC not available
      console.warn(`  RPC exec_sql not available, trying REST...`);
      const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({ sql_query: sql }),
      });
      if (!res.ok) {
        console.error(`  Failed: ${sql.slice(0, 60)}...`, await res.text());
      } else {
        console.log(`  OK: ${sql.slice(0, 60)}...`);
      }
    } else {
      console.log(`  OK: ${sql.slice(0, 60)}...`);
    }
  }

  // Create policies (ignore errors if they already exist)
  for (const p of POLICIES) {
    const sql = `CREATE POLICY "${p.name}" ON ${p.table} ${p.def}`;
    const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({ sql_query: sql }),
    });
    if (res.ok) {
      console.log(`  Policy OK: ${p.name}`);
    } else {
      const text = await res.text();
      if (text.includes('already exists')) {
        console.log(`  Policy already exists: ${p.name}`);
      } else {
        console.warn(`  Policy warning: ${p.name}`, text.slice(0, 100));
      }
    }
  }

  // Verify tables exist by trying to select from them
  console.log('\nVerification:');
  for (const table of ['medios_projects', 'medios_container_types', 'medios_pieces']) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.error(`  ${table}: FAILED — ${error.message}`);
    } else {
      console.log(`  ${table}: OK`);
    }
  }

  console.log('\nDone.');
}

run().catch(console.error);
