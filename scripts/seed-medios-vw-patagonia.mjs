/**
 * Seed: Load VW Patagonia medios data from Excel into Supabase.
 * Cross-references with existing APQP product families.
 *
 * Run: node scripts/seed-medios-vw-patagonia.mjs
 *
 * IMPORTANT: Run migrate-medios-tables.mjs FIRST to create the tables.
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

// ─── Container Types ──────────────────────────────────────────────────────────

const CONTAINER_TYPES = [
  { name: 'Rack Inyeccion 1.2x0.8x1', length_mm: 1200, width_mm: 800, height_mm: 1000, weight_ref_kg: 85, max_stacking: 2, default_pcs: 24 },
  { name: 'Rack Prod. Final (TBD)', length_mm: 1200, width_mm: 800, height_mm: 1000, weight_ref_kg: 85, max_stacking: 2, default_pcs: 12 },
  { name: 'Armrest DP 575x450x350', length_mm: 575, width_mm: 450, height_mm: 350, weight_ref_kg: 25, max_stacking: 2, default_pcs: 12 },
  { name: 'Top Roll 940x460x950', length_mm: 940, width_mm: 460, height_mm: 950, weight_ref_kg: 50, max_stacking: 2, default_pcs: 10 },
  { name: 'IP PAD 600x449x1520', length_mm: 600, width_mm: 449, height_mm: 1520, weight_ref_kg: 40, max_stacking: 1, default_pcs: 9 },
  { name: 'Headrest 1200x1000x760', length_mm: 1200, width_mm: 1000, height_mm: 760, weight_ref_kg: 60, max_stacking: 2, default_pcs: 32 },
  { name: 'Insert DP 640x645x200', length_mm: 640, width_mm: 645, height_mm: 200, weight_ref_kg: 30, max_stacking: 3, default_pcs: 6 },
];

// ─── Pieces from Excel ────────────────────────────────────────────────────────
// Data extracted from s.xlsx hoja ① Listado de Piezas
// CORRECTED: Top Roll & Insert APB = NOVAX (not VWA) per Fak's feedback

const PIECES = [
  // IP PAD
  { family: 'IP PAD', piece_code: '66K74.4-1-B', description: 'Upper decorative plate skeleton Front RH', client: 'VWA', stage: 'WIP', daily_demand: 350, lead_time_days: 5, safety_pct: 0.15, container_name: 'Rack Inyeccion 1.2x0.8x1', pcs_per_container: 20 },
  { family: 'IP PAD', piece_code: '66K74.4-1-B', description: 'Upper decorative plate skeleton Front RH (semi)', client: 'VWA', stage: 'Semiterminado', daily_demand: 350, lead_time_days: 3, safety_pct: 0.15, container_name: 'Rack Prod. Final (TBD)', pcs_per_container: 12 },
  { family: 'IP PAD', piece_code: 'IP-PAD-H', description: 'IP PAD Triple Screen - wrapping', client: 'VWA', stage: 'Producto Terminado', daily_demand: 326, lead_time_days: 10, safety_pct: 0.15, container_name: 'IP PAD 600x449x1520', pcs_per_container: 9 },
  { family: 'IP PAD', piece_code: 'IP-PAD-L', description: 'IP PAD Dual Screen - wrapping', client: 'VWA', stage: 'Producto Terminado', daily_demand: 82, lead_time_days: 10, safety_pct: 0.15, container_name: 'IP PAD 600x449x1520', pcs_per_container: 9 },

  // TOP ROLL — client corrected to NOVAX for WIP/Semi
  { family: 'TOP ROLL', piece_code: '66K74.4-1', description: 'DELANTERO Esq. placa dec. frontal RH/LH', client: 'NOVAX', stage: 'WIP', daily_demand: 700, lead_time_days: 5, safety_pct: 0.15, container_name: 'Rack Inyeccion 1.2x0.8x1', pcs_per_container: 80 },
  { family: 'TOP ROLL', piece_code: '66K74.4-1', description: 'DELANTERO Esq. placa dec. frontal RH/LH (semi)', client: 'NOVAX', stage: 'Semiterminado', daily_demand: 700, lead_time_days: 3, safety_pct: 0.15, container_name: 'Rack Prod. Final (TBD)', pcs_per_container: 20 },
  { family: 'TOP ROLL', piece_code: '66K74.4-5', description: 'TRASERO Esq. placa dec. RH/LH', client: 'NOVAX', stage: 'WIP', daily_demand: 700, lead_time_days: 5, safety_pct: 0.15, container_name: 'Rack Inyeccion 1.2x0.8x1', pcs_per_container: 80 },
  { family: 'TOP ROLL', piece_code: '66K74.4-5', description: 'TRASERO Esq. placa dec. RH/LH (semi)', client: 'NOVAX', stage: 'Semiterminado', daily_demand: 700, lead_time_days: 3, safety_pct: 0.15, container_name: 'Rack Prod. Final (TBD)', pcs_per_container: 20 },
  { family: 'TOP ROLL', piece_code: 'TR-01', description: 'TOP ROLL puerta LH/RH - laminado completo', client: 'NOVAX', stage: 'Producto Terminado', daily_demand: 700, lead_time_days: 10, safety_pct: 0.15, container_name: 'Top Roll 940x460x950', pcs_per_container: 10 },

  // TOP ROLL (insumo) — brackets waterjet
  { family: 'TOP ROLL (insumo)', piece_code: 'WC-BRKT-01', description: 'Soporte fijador waterjet - Top Roll Frontal', client: 'NOVAX', stage: 'WIP', daily_demand: 700, lead_time_days: 5, safety_pct: 0.15, container_name: 'Rack Inyeccion 1.2x0.8x1', pcs_per_container: 80 },
  { family: 'TOP ROLL (insumo)', piece_code: 'WC-BRKT-05', description: 'Soporte fijador waterjet - Top Roll Trasero', client: 'NOVAX', stage: 'WIP', daily_demand: 700, lead_time_days: 5, safety_pct: 0.15, container_name: 'Rack Inyeccion 1.2x0.8x1', pcs_per_container: 80 },

  // INSERT — client corrected to NOVAX for WIP/Semi
  { family: 'INSERT', piece_code: 'INS-DP-01', description: 'INSERT puerta LH/RH - tapizado completo', client: 'NOVAX', stage: 'Producto Terminado', daily_demand: 700, lead_time_days: 10, safety_pct: 0.15, container_name: 'Insert DP 640x645x200', pcs_per_container: 6 },
  { family: 'INSERT', piece_code: '66K74.4-3', description: 'DELANTERO Esq. panel embutido frontal RH/LH', client: 'NOVAX', stage: 'WIP', daily_demand: 700, lead_time_days: 5, safety_pct: 0.15, container_name: 'Rack Inyeccion 1.2x0.8x1', pcs_per_container: 60 },
  { family: 'INSERT', piece_code: '66K74.4-3', description: 'DELANTERO Esq. panel embutido frontal RH/LH (semi)', client: 'NOVAX', stage: 'Semiterminado', daily_demand: 700, lead_time_days: 3, safety_pct: 0.15, container_name: 'Rack Prod. Final (TBD)', pcs_per_container: 10 },
  { family: 'INSERT', piece_code: '66K74.4-7', description: 'TRASERO Esq. panel embutido RH/LH', client: 'NOVAX', stage: 'WIP', daily_demand: 700, lead_time_days: 5, safety_pct: 0.15, container_name: 'Rack Inyeccion 1.2x0.8x1', pcs_per_container: 60 },
  { family: 'INSERT', piece_code: '66K74.4-7', description: 'TRASERO Esq. panel embutido RH/LH (semi)', client: 'NOVAX', stage: 'Semiterminado', daily_demand: 700, lead_time_days: 3, safety_pct: 0.15, container_name: 'Rack Prod. Final (TBD)', pcs_per_container: 10 },

  // ARMREST
  { family: 'ARMREST', piece_code: '66K74.4-4', description: 'DELANTERO Esq. apoyabrazos puerta RH/LH', client: 'NOVAX', stage: 'WIP', daily_demand: 700, lead_time_days: 5, safety_pct: 0.15, container_name: 'Rack Inyeccion 1.2x0.8x1', pcs_per_container: 160 },
  { family: 'ARMREST', piece_code: '66K74.4-4', description: 'DELANTERO Esq. apoyabrazos puerta RH/LH (semi)', client: 'NOVAX', stage: 'Semiterminado', daily_demand: 700, lead_time_days: 3, safety_pct: 0.15, container_name: 'Rack Prod. Final (TBD)', pcs_per_container: 24 },
  { family: 'ARMREST', piece_code: '66K74.4-8', description: 'TRASERO Esq. apoyabrazos puerta RH/LH', client: 'NOVAX', stage: 'WIP', daily_demand: 700, lead_time_days: 5, safety_pct: 0.15, container_name: 'Rack Inyeccion 1.2x0.8x1', pcs_per_container: 160 },
];

// ─── Family → APQP product family name mapping ───────────────────────────────

const FAMILY_TO_APQP = {
  'IP PAD': null, // IP PAD doesn't have a product_family in current APQP
  'TOP ROLL': 'Top Roll Patagonia',
  'TOP ROLL (insumo)': 'Top Roll Patagonia',
  'INSERT': 'Insert Patagonia',
  'ARMREST': 'Armrest Door Panel Patagonia',
};

async function run() {
  console.log('=== Seed Medios VW Patagonia ===\n');

  // 1. Check if project already exists
  const { data: existingProjects } = await supabase
    .from('medios_projects')
    .select('id, name')
    .eq('name', 'VW Patagonia Abril 2026');

  if (existingProjects && existingProjects.length > 0) {
    console.log('Project "VW Patagonia Abril 2026" already exists. Skipping seed.');
    console.log('  ID:', existingProjects[0].id);
    return;
  }

  // 2. Upsert container types (by name)
  console.log('Creating container types...');
  const ctIds = new Map();

  for (const ct of CONTAINER_TYPES) {
    // Check if exists
    const { data: existing } = await supabase
      .from('medios_container_types')
      .select('id')
      .eq('name', ct.name)
      .limit(1);

    if (existing && existing.length > 0) {
      ctIds.set(ct.name, existing[0].id);
      console.log(`  [exists] ${ct.name}`);
    } else {
      const { data: created, error } = await supabase
        .from('medios_container_types')
        .insert(ct)
        .select('id')
        .single();
      if (error) {
        console.error(`  [ERROR] ${ct.name}:`, error.message);
        continue;
      }
      ctIds.set(ct.name, created.id);
      console.log(`  [created] ${ct.name} → ${created.id}`);
    }
  }

  // 3. Get APQP product families for cross-reference
  console.log('\nLooking up APQP product families...');
  const familyIds = new Map();
  const { data: families } = await supabase
    .from('product_families')
    .select('id, name');

  if (families) {
    for (const f of families) {
      console.log(`  Found family: ${f.name} (id=${f.id})`);
    }

    // Map medios families to APQP family IDs
    for (const [mediosFam, apqpName] of Object.entries(FAMILY_TO_APQP)) {
      if (!apqpName) continue;
      const match = families.find(f => f.name === apqpName);
      if (match) {
        familyIds.set(mediosFam, match.id);
        console.log(`  Matched: ${mediosFam} → ${apqpName} (family_id=${match.id})`);
      } else {
        console.log(`  No match for: ${mediosFam} → ${apqpName}`);
      }
    }
  }

  // 4. Get products in matched families for product_id linking
  console.log('\nLooking up products in matched families...');
  const productIds = new Map();
  for (const [mediosFam, familyId] of familyIds) {
    const { data: members } = await supabase
      .from('product_family_members')
      .select('product_id, is_primary')
      .eq('family_id', familyId);

    if (members && members.length > 0) {
      // Use primary product if available, else first
      const primary = members.find(m => m.is_primary) ?? members[0];
      productIds.set(mediosFam, primary.product_id);
      console.log(`  ${mediosFam}: product_id=${primary.product_id} (primary=${!!primary.is_primary})`);
    }
  }

  // 5. Create project
  console.log('\nCreating project...');
  const { data: project, error: projErr } = await supabase
    .from('medios_projects')
    .insert({
      name: 'VW Patagonia Abril 2026',
      description: 'Calculadora de medios logisticos para esqueletos plasticos VW Patagonia',
      utilization_rate: 0.55,
      available_m2: null,
    })
    .select()
    .single();

  if (projErr) {
    console.error('Failed to create project:', projErr.message);
    return;
  }
  console.log(`  Project created: ${project.id}`);

  // 6. Create pieces
  console.log('\nCreating pieces...');
  const pieceRows = PIECES.map((p, idx) => ({
    project_id: project.id,
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
    product_id: productIds.get(p.family) || null,
    sort_order: idx,
  }));

  const { data: pieces, error: piecesErr } = await supabase
    .from('medios_pieces')
    .insert(pieceRows)
    .select('id, piece_code, family');

  if (piecesErr) {
    console.error('Failed to create pieces:', piecesErr.message);
    return;
  }

  console.log(`  Created ${pieces.length} pieces`);

  // 7. Verification
  console.log('\n=== Verification ===');
  const { count: ctCount } = await supabase.from('medios_container_types').select('*', { count: 'exact', head: true });
  const { count: pCount } = await supabase.from('medios_pieces').select('*', { count: 'exact', head: true }).eq('project_id', project.id);

  console.log(`  Container types: ${ctCount}`);
  console.log(`  Pieces in project: ${pCount}`);
  console.log(`  Project ID: ${project.id}`);
  console.log('\nDone.');
}

run().catch(console.error);
