/**
 * Seed: Load ALL medios data from Excel s.xlsx into Supabase.
 * Creates 2 projects: "Patagonia Abril 2026" (VWA+NOVAX) and "PWA Hilux Abril 2026" (PWA).
 * Fixes container types, pieces, and utilization rate from Excel source of truth.
 *
 * Run: node scripts/seed-medios-complete.mjs
 * IMPORTANT: Run migrate-medios-tables.mjs FIRST.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) { console.error('Missing env vars'); process.exit(1); }

const supabase = createClient(url, key);
await supabase.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// ─── ALL 10 Container Types from Excel ───────────────────────────────────────

const CONTAINER_TYPES = [
  { name: 'Rack Inyeccion 1.2x0.8x1', length_mm: 1200, width_mm: 800, height_mm: 1000, weight_ref_kg: 85, max_stacking: 2, default_pcs: 24 },
  { name: 'Rack Prod. Final (TBD)', length_mm: 1200, width_mm: 800, height_mm: 1000, weight_ref_kg: 85, max_stacking: 2, default_pcs: 12 },
  { name: 'Armrest DP 575x450x350', length_mm: 575, width_mm: 450, height_mm: 350, weight_ref_kg: 25, max_stacking: 2, default_pcs: 12 },
  { name: 'Top Roll 940x460x950', length_mm: 940, width_mm: 460, height_mm: 950, weight_ref_kg: 50, max_stacking: 2, default_pcs: 10 },
  { name: 'IP PAD 600x449x1520', length_mm: 600, width_mm: 449, height_mm: 1520, weight_ref_kg: 40, max_stacking: 1, default_pcs: 9 },
  { name: 'Headrest 1200x1000x760', length_mm: 1200, width_mm: 1000, height_mm: 760, weight_ref_kg: 60, max_stacking: 2, default_pcs: 32 },
  // FIXED: weight was 30 in old seed, Excel says 20. Stacking was 3, Excel says 2.
  { name: 'Insert DP 640x645x200', length_mm: 640, width_mm: 645, height_mm: 200, weight_ref_kg: 20, max_stacking: 2, default_pcs: 6 },
  // NEW: PWA container types
  { name: 'Rack Colapsable 1.67x1.06x0.6', length_mm: 1670, width_mm: 1060, height_mm: 600, weight_ref_kg: 80, max_stacking: 4, default_pcs: 8 },
  { name: 'Rack Colapsable 1.2x1.0x0.6', length_mm: 1200, width_mm: 1000, height_mm: 600, weight_ref_kg: 60, max_stacking: 4, default_pcs: 12 },
  { name: 'KLT 600x400x400', length_mm: 600, width_mm: 400, height_mm: 400, weight_ref_kg: 10, max_stacking: 2, default_pcs: 34 },
];

// ─── Project 1: Patagonia (VWA + NOVAX) — 26 pieces ─────────────────────────

const PATAGONIA_PIECES = [
  // IP PAD — VWA (6 lines, corrected demands from Excel)
  { family: 'IP PAD', piece_code: '66K74.4-1-B', description: 'Esq. IP PAD High - Triple Screen (stock inyeccion)', client: 'VWA', stage: 'WIP', daily_demand: 326, lead_time_days: 5, safety_pct: 0.15, container_name: 'Rack Inyeccion 1.2x0.8x1', pcs_per_container: 20 },
  { family: 'IP PAD', piece_code: '66K74.4-1-B', description: 'Esq. IP PAD High - Triple Screen (stock p/ wrapping)', client: 'VWA', stage: 'Semiterminado', daily_demand: 326, lead_time_days: 3, safety_pct: 0.15, container_name: 'Rack Prod. Final (TBD)', pcs_per_container: 12 },
  { family: 'IP PAD', piece_code: '66K74.4-1-B', description: 'Esq. IP PAD Low - Dual Screen (stock inyeccion)', client: 'VWA', stage: 'WIP', daily_demand: 82, lead_time_days: 5, safety_pct: 0.15, container_name: 'Rack Inyeccion 1.2x0.8x1', pcs_per_container: 20 },
  { family: 'IP PAD', piece_code: '66K74.4-1-B', description: 'Esq. IP PAD Low - Dual Screen (stock p/ wrapping)', client: 'VWA', stage: 'Semiterminado', daily_demand: 82, lead_time_days: 3, safety_pct: 0.15, container_name: 'Rack Prod. Final (TBD)', pcs_per_container: 12 },
  { family: 'IP PAD', piece_code: 'IP-PAD-H', description: 'IP PAD Triple Screen - wrapping [C00694582] (entrega VWA)', client: 'VWA', stage: 'Producto Terminado', daily_demand: 326, lead_time_days: 10, safety_pct: 0.15, container_name: 'IP PAD 600x449x1520', pcs_per_container: 9 },
  { family: 'IP PAD', piece_code: 'IP-PAD-L', description: 'IP PAD Dual Screen - wrapping [C00694583] (entrega VWA)', client: 'VWA', stage: 'Producto Terminado', daily_demand: 82, lead_time_days: 10, safety_pct: 0.15, container_name: 'IP PAD 600x449x1520', pcs_per_container: 9 },

  // TOP ROLL — NOVAX (7 lines)
  { family: 'TOP ROLL', piece_code: '66K74.4-1', description: 'DELANTERO Esq. placa dec. frontal RH/LH (stock inyeccion)', client: 'NOVAX', stage: 'WIP', daily_demand: 700, lead_time_days: 5, safety_pct: 0.15, container_name: 'Rack Inyeccion 1.2x0.8x1', pcs_per_container: 80 },
  { family: 'TOP ROLL', piece_code: '66K74.4-1', description: 'DELANTERO Esq. placa dec. frontal RH/LH (stock p/ tapizado)', client: 'NOVAX', stage: 'Semiterminado', daily_demand: 700, lead_time_days: 3, safety_pct: 0.15, container_name: 'Rack Prod. Final (TBD)', pcs_per_container: 20 },
  { family: 'TOP ROLL', piece_code: '66K74.4-5', description: 'TRASERO Esq. placa dec. RH/LH (stock inyeccion)', client: 'NOVAX', stage: 'WIP', daily_demand: 700, lead_time_days: 5, safety_pct: 0.15, container_name: 'Rack Inyeccion 1.2x0.8x1', pcs_per_container: 80 },
  { family: 'TOP ROLL', piece_code: '66K74.4-5', description: 'TRASERO Esq. placa dec. RH/LH (stock p/ tapizado)', client: 'NOVAX', stage: 'Semiterminado', daily_demand: 700, lead_time_days: 3, safety_pct: 0.15, container_name: 'Rack Prod. Final (TBD)', pcs_per_container: 20 },
  { family: 'TOP ROLL', piece_code: 'TR-01', description: 'TOP ROLL puerta LH/RH - laminado completo (entrega NOVAX)', client: 'NOVAX', stage: 'Producto Terminado', daily_demand: 700, lead_time_days: 10, safety_pct: 0.15, container_name: 'Top Roll 940x460x950', pcs_per_container: 10 },
  { family: 'TOP ROLL', piece_code: 'WC-BRKT-01', description: 'Soporte fijador waterjet - Top Roll Front (molde 1)', client: 'NOVAX', stage: 'WIP', daily_demand: 700, lead_time_days: 5, safety_pct: 0.15, container_name: 'Rack Inyeccion 1.2x0.8x1', pcs_per_container: 80 },
  { family: 'TOP ROLL', piece_code: 'WC-BRKT-05', description: 'Soporte fijador waterjet - Top Roll Trasero (molde 5)', client: 'NOVAX', stage: 'WIP', daily_demand: 700, lead_time_days: 5, safety_pct: 0.15, container_name: 'Rack Inyeccion 1.2x0.8x1', pcs_per_container: 80 },

  // INSERT — NOVAX (5 lines)
  { family: 'INSERT', piece_code: 'INS-DP-01', description: 'INSERT puerta LH/RH - tapizado completo (entrega NOVAX)', client: 'NOVAX', stage: 'Producto Terminado', daily_demand: 700, lead_time_days: 10, safety_pct: 0.15, container_name: 'Insert DP 640x645x200', pcs_per_container: 6 },
  { family: 'INSERT', piece_code: '66K74.4-3', description: 'DELANTERO Esq. panel embutido frontal RH/LH (stock inyeccion)', client: 'NOVAX', stage: 'WIP', daily_demand: 700, lead_time_days: 5, safety_pct: 0.15, container_name: 'Rack Inyeccion 1.2x0.8x1', pcs_per_container: 60 },
  { family: 'INSERT', piece_code: '66K74.4-3', description: 'DELANTERO Esq. panel embutido frontal RH/LH (stock p/ tapizado)', client: 'NOVAX', stage: 'Semiterminado', daily_demand: 700, lead_time_days: 3, safety_pct: 0.15, container_name: 'Rack Prod. Final (TBD)', pcs_per_container: 10 },
  { family: 'INSERT', piece_code: '66K74.4-7', description: 'TRASERO Esq. panel embutido RH/LH (stock inyeccion)', client: 'NOVAX', stage: 'WIP', daily_demand: 700, lead_time_days: 5, safety_pct: 0.15, container_name: 'Rack Inyeccion 1.2x0.8x1', pcs_per_container: 60 },
  { family: 'INSERT', piece_code: '66K74.4-7', description: 'TRASERO Esq. panel embutido RH/LH (stock p/ tapizado)', client: 'NOVAX', stage: 'Semiterminado', daily_demand: 700, lead_time_days: 3, safety_pct: 0.15, container_name: 'Rack Prod. Final (TBD)', pcs_per_container: 10 },

  // ARMREST — NOVAX (5 lines, was missing rear semi + PT)
  { family: 'ARMREST', piece_code: '66K74.4-4', description: 'DELANTERO Esq. apoyabrazos puerta RH/LH (stock inyeccion)', client: 'NOVAX', stage: 'WIP', daily_demand: 700, lead_time_days: 5, safety_pct: 0.15, container_name: 'Rack Inyeccion 1.2x0.8x1', pcs_per_container: 160 },
  { family: 'ARMREST', piece_code: '66K74.4-4', description: 'DELANTERO Esq. apoyabrazos puerta RH/LH (stock p/ tapizado)', client: 'NOVAX', stage: 'Semiterminado', daily_demand: 700, lead_time_days: 3, safety_pct: 0.15, container_name: 'Rack Prod. Final (TBD)', pcs_per_container: 24 },
  { family: 'ARMREST', piece_code: '66K74.4-8', description: 'TRASERO Esq. apoyabrazos puerta RH/LH - molde alt. (stock inyeccion)', client: 'NOVAX', stage: 'WIP', daily_demand: 700, lead_time_days: 5, safety_pct: 0.15, container_name: 'Rack Inyeccion 1.2x0.8x1', pcs_per_container: 160 },
  { family: 'ARMREST', piece_code: '66K74.4-8', description: 'TRASERO Esq. apoyabrazos puerta RH/LH - molde alt. (stock p/ tapizado)', client: 'NOVAX', stage: 'Semiterminado', daily_demand: 700, lead_time_days: 3, safety_pct: 0.15, container_name: 'Rack Prod. Final (TBD)', pcs_per_container: 24 },
  { family: 'ARMREST', piece_code: 'ARM-DP-01', description: 'ARMREST puerta LH/RH - tapizado completo (entrega NOVAX)', client: 'NOVAX', stage: 'Producto Terminado', daily_demand: 700, lead_time_days: 10, safety_pct: 0.15, container_name: 'Armrest DP 575x450x350', pcs_per_container: 12 },

  // HEADREST — VWA (3 lines, completely missing from old seed)
  { family: 'HEADREST', piece_code: '2HC.881.901', description: 'Apoyacabezas delantero (Front HR) - entrega VWA', client: 'VWA', stage: 'Producto Terminado', daily_demand: 710, lead_time_days: 9, safety_pct: 0.15, container_name: 'Headrest 1200x1000x760', pcs_per_container: 32 },
  { family: 'HEADREST', piece_code: '2HC.885.901', description: 'Apoyacabezas trasero lateral (Rear HR Outer) - entrega VWA', client: 'VWA', stage: 'Producto Terminado', daily_demand: 710, lead_time_days: 9, safety_pct: 0.15, container_name: 'Headrest 1200x1000x760', pcs_per_container: 96 },
  { family: 'HEADREST', piece_code: '2HC.885.900', description: 'Apoyacabezas trasero central (Rear HR Center) - entrega VWA', client: 'VWA', stage: 'Producto Terminado', daily_demand: 356, lead_time_days: 9, safety_pct: 0.15, container_name: 'Headrest 1200x1000x760', pcs_per_container: 96 },
];

// ─── Project 2: PWA Hilux — 11 pieces ────────────────────────────────────────

const PWA_PIECES = [
  // DUCTOS — PWA (7 lines)
  { family: 'DUCTOS', piece_code: 'AIR-DUCT-SA1', description: 'Air Duct SubAss1', client: 'PWA', stage: 'Semiterminado', daily_demand: 355, lead_time_days: 10, safety_pct: 0.15, container_name: 'Rack Colapsable 1.67x1.06x0.6', pcs_per_container: 8 },
  { family: 'DUCTOS', piece_code: 'AIR-DUCT-ASS', description: 'Air Duct Ass (Conjunto Completo)', client: 'PWA', stage: 'Producto Terminado', daily_demand: 355, lead_time_days: 10, safety_pct: 0.15, container_name: 'Rack Colapsable 1.67x1.06x0.6', pcs_per_container: 7 },
  { family: 'DUCTOS', piece_code: 'DEF-CTR-ASS', description: 'Defroster Duct Ctr Substrate Ass', client: 'PWA', stage: 'Producto Terminado', daily_demand: 355, lead_time_days: 10, safety_pct: 0.15, container_name: 'Rack Colapsable 1.67x1.06x0.6', pcs_per_container: 15 },
  { family: 'DUCTOS', piece_code: 'AIR-DUCT-SA1-SEP', description: 'Air Duct SubAss1 (Separado)', client: 'PWA', stage: 'Producto Terminado', daily_demand: 355, lead_time_days: 10, safety_pct: 0.15, container_name: 'Rack Colapsable 1.67x1.06x0.6', pcs_per_container: 8 },
  { family: 'DUCTOS', piece_code: 'DEF-CTR-SA1', description: 'Defroster Duct Ctr Substrate SubAss1', client: 'PWA', stage: 'Semiterminado', daily_demand: 355, lead_time_days: 10, safety_pct: 0.15, container_name: 'Rack Colapsable 1.2x1.0x0.6', pcs_per_container: 30 },
  { family: 'DUCTOS', piece_code: 'DEF-RH-LH-SA1', description: 'Defroster Duct RH/LH SubAss1', client: 'PWA', stage: 'Semiterminado', daily_demand: 710, lead_time_days: 10, safety_pct: 0.15, container_name: 'Rack Colapsable 1.2x1.0x0.6', pcs_per_container: 48 },
  { family: 'DUCTOS', piece_code: 'CNSL-AIR-ASS', description: 'Console Air Duct Ass', client: 'PWA', stage: 'Producto Terminado', daily_demand: 355, lead_time_days: 10, safety_pct: 0.15, container_name: 'Rack Colapsable 1.2x1.0x0.6', pcs_per_container: 12 },

  // INSONOS — PWA (4 lines)
  { family: 'INSONOS', piece_code: 'INSONO-CNSL', description: 'Insonos para Panel CNSL_SIDE (LH/RH)', client: 'PWA', stage: 'Producto Terminado', daily_demand: 666, lead_time_days: 10, safety_pct: 0.15, container_name: 'Rack Colapsable 1.2x1.0x0.6', pcs_per_container: 60 },
  { family: 'INSONOS', piece_code: 'FRONT-EXT', description: 'Front Extend Panel (LH/RH)', client: 'PWA', stage: 'Semiterminado', daily_demand: 666, lead_time_days: 10, safety_pct: 0.15, container_name: 'KLT 600x400x400', pcs_per_container: 72 },
  { family: 'INSONOS', piece_code: 'HUSH-PANEL', description: 'Hush Panel', client: 'PWA', stage: 'Semiterminado', daily_demand: 333, lead_time_days: 10, safety_pct: 0.15, container_name: 'KLT 600x400x400', pcs_per_container: 12 },
  { family: 'INSONOS', piece_code: 'INSONO-IP', description: 'Insonno para IP_UPPER_SUBSTRATE', client: 'PWA', stage: 'Semiterminado', daily_demand: 333, lead_time_days: 10, safety_pct: 0.15, container_name: 'KLT 600x400x400', pcs_per_container: 34 },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
  console.log('=== Seed Medios Completo (Excel s.xlsx) ===\n');

  // 1. Upsert container types
  console.log('1. Container types...');
  const ctIds = new Map();

  for (const ct of CONTAINER_TYPES) {
    const { data: existing } = await supabase
      .from('medios_container_types')
      .select('id')
      .eq('name', ct.name)
      .limit(1);

    if (existing && existing.length > 0) {
      // Update existing to fix any wrong values
      await supabase.from('medios_container_types')
        .update({
          length_mm: ct.length_mm,
          width_mm: ct.width_mm,
          height_mm: ct.height_mm,
          weight_ref_kg: ct.weight_ref_kg,
          max_stacking: ct.max_stacking,
          default_pcs: ct.default_pcs,
        })
        .eq('id', existing[0].id);
      ctIds.set(ct.name, existing[0].id);
      console.log(`  [updated] ${ct.name}`);
    } else {
      const { data: created, error } = await supabase
        .from('medios_container_types')
        .insert(ct)
        .select('id')
        .single();
      if (error) { console.error(`  [ERROR] ${ct.name}:`, error.message); continue; }
      ctIds.set(ct.name, created.id);
      console.log(`  [created] ${ct.name} -> ${created.id}`);
    }
  }

  // 2. Delete old project(s) and recreate with correct data
  console.log('\n2. Clean up old projects...');
  const { data: oldProjects } = await supabase
    .from('medios_projects')
    .select('id, name');

  if (oldProjects) {
    for (const p of oldProjects) {
      console.log(`  Deleting old project: "${p.name}" (${p.id})`);
      await supabase.from('medios_pieces').delete().eq('project_id', p.id);
      await supabase.from('medios_projects').delete().eq('id', p.id);
    }
  }

  // 3. Create Patagonia project (utilization 0.70 per Excel)
  console.log('\n3. Creating Patagonia project...');
  const { data: patProject, error: patErr } = await supabase
    .from('medios_projects')
    .insert({
      name: 'Patagonia Abril 2026',
      description: 'Medios logisticos VW Patagonia (VWA + NOVAX) - datos de Excel s.xlsx',
      utilization_rate: 0.70,
      available_m2: null,
    })
    .select()
    .single();

  if (patErr) { console.error('Failed:', patErr.message); return; }
  console.log(`  Project: ${patProject.id}`);

  // 4. Insert Patagonia pieces
  console.log('\n4. Inserting Patagonia pieces (26)...');
  const patRows = PATAGONIA_PIECES.map((p, idx) => ({
    project_id: patProject.id,
    piece_code: p.piece_code,
    description: p.description,
    family: p.family,
    client: p.client,
    stage: p.stage,
    daily_demand: p.daily_demand,
    lead_time_days: p.lead_time_days,
    safety_pct: p.safety_pct,
    container_type_id: ctIds.get(p.container_name) || null,
    pcs_per_container: p.pcs_per_container,
    product_id: null,
    sort_order: idx,
  }));

  const { data: patPieces, error: patPiecesErr } = await supabase
    .from('medios_pieces')
    .insert(patRows)
    .select('id, piece_code, family');

  if (patPiecesErr) { console.error('Failed:', patPiecesErr.message); return; }
  console.log(`  Inserted ${patPieces.length} pieces`);

  // 5. Create PWA Hilux project
  console.log('\n5. Creating PWA Hilux project...');
  const { data: pwaProject, error: pwaErr } = await supabase
    .from('medios_projects')
    .insert({
      name: 'PWA Hilux Abril 2026',
      description: 'Medios logisticos PWA Hilux (Ductos + Insonos) - datos de Excel s.xlsx',
      utilization_rate: 0.70,
      available_m2: null,
    })
    .select()
    .single();

  if (pwaErr) { console.error('Failed:', pwaErr.message); return; }
  console.log(`  Project: ${pwaProject.id}`);

  // 6. Insert PWA pieces
  console.log('\n6. Inserting PWA pieces (11)...');
  const pwaRows = PWA_PIECES.map((p, idx) => ({
    project_id: pwaProject.id,
    piece_code: p.piece_code,
    description: p.description,
    family: p.family,
    client: p.client,
    stage: p.stage,
    daily_demand: p.daily_demand,
    lead_time_days: p.lead_time_days,
    safety_pct: p.safety_pct,
    container_type_id: ctIds.get(p.container_name) || null,
    pcs_per_container: p.pcs_per_container,
    product_id: null,
    sort_order: idx,
  }));

  const { data: pwaPieces, error: pwaPiecesErr } = await supabase
    .from('medios_pieces')
    .insert(pwaRows)
    .select('id, piece_code, family');

  if (pwaPiecesErr) { console.error('Failed:', pwaPiecesErr.message); return; }
  console.log(`  Inserted ${pwaPieces.length} pieces`);

  // 7. Verification
  console.log('\n=== Verification ===');
  const { count: ctCount } = await supabase.from('medios_container_types').select('*', { count: 'exact', head: true });
  const { count: projCount } = await supabase.from('medios_projects').select('*', { count: 'exact', head: true });
  const { count: patCount } = await supabase.from('medios_pieces').select('*', { count: 'exact', head: true }).eq('project_id', patProject.id);
  const { count: pwaCount } = await supabase.from('medios_pieces').select('*', { count: 'exact', head: true }).eq('project_id', pwaProject.id);
  const { count: totalPieces } = await supabase.from('medios_pieces').select('*', { count: 'exact', head: true });

  console.log(`  Container types: ${ctCount} (expected 10)`);
  console.log(`  Projects: ${projCount} (expected 2)`);
  console.log(`  Patagonia pieces: ${patCount} (expected 26)`);
  console.log(`  PWA pieces: ${pwaCount} (expected 11)`);
  console.log(`  Total pieces: ${totalPieces} (expected 37)`);

  const allOk = ctCount === 10 && projCount === 2 && patCount === 26 && pwaCount === 11;
  console.log(`\n  Status: ${allOk ? 'ALL OK' : 'MISMATCH — check data'}`);

  // Print summary by client
  console.log('\n=== Summary by Client ===');
  const { data: allPieces } = await supabase.from('medios_pieces').select('client, daily_demand, family');
  if (allPieces) {
    const byClient = {};
    for (const p of allPieces) {
      byClient[p.client] = (byClient[p.client] || 0) + 1;
    }
    for (const [client, count] of Object.entries(byClient)) {
      console.log(`  ${client}: ${count} pieces`);
    }
  }

  console.log('\nDone.');
}

run().catch(console.error);
