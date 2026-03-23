#!/usr/bin/env node
import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash, randomUUID } from 'crypto';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

/**
 * Fix Round 1 — Add "Costura Vista" (step 30.2) items to the 3 Headrest L0 CPs.
 *
 * The L1/L2/L3 variants include 9 items for "Operacion Costura Vista" (step 30.2),
 * but the L0 master CPs are missing them entirely.
 *
 * Strategy: clone the 30.2 items from L1 into L0 with new UUIDs,
 * preserving all AMFE traceability fields.
 */

const FAMILIES = [
  { name: 'HEADREST_FRONT',    l0: 'VWA/PATAGONIA/HEADREST_FRONT',    l1: 'VWA/PATAGONIA/HEADREST_FRONT [L1]' },
  { name: 'HEADREST_REAR_CEN', l0: 'VWA/PATAGONIA/HEADREST_REAR_CEN', l1: 'VWA/PATAGONIA/HEADREST_REAR_CEN [L1]' },
  { name: 'HEADREST_REAR_OUT', l0: 'VWA/PATAGONIA/HEADREST_REAR_OUT', l1: 'VWA/PATAGONIA/HEADREST_REAR_OUT [L1]' },
];

function isCosturaVista(item) {
  const desc = (item.processDescription || '').toLowerCase();
  return desc.includes('costura vista');
}

function parseStepNumber(step) {
  const n = parseFloat(String(step));
  return Number.isFinite(n) ? n : 9999;
}

async function main() {
  console.log('=== Fix Round 1: Add Costura Vista items to Headrest L0 CPs ===\n');

  await initSupabase();

  let grandTotalCopied = 0;

  for (const family of FAMILIES) {
    console.log(`\n--- ${family.name} ---`);

    // 1. Read L1 CP
    const l1Rows = await selectSql(
      `SELECT id, data FROM cp_documents WHERE project_name = '${family.l1}'`
    );
    if (l1Rows.length === 0) {
      console.log(`  ERROR: L1 CP not found for project_name="${family.l1}"`);
      continue;
    }
    const l1Data = typeof l1Rows[0].data === 'string' ? JSON.parse(l1Rows[0].data) : l1Rows[0].data;
    const l1Items = l1Data.items || [];

    // 2. Extract Costura Vista items from L1
    const costuraVistaItems = l1Items.filter(isCosturaVista);
    console.log(`  L1 "${family.l1}": ${l1Items.length} total items, ${costuraVistaItems.length} Costura Vista`);

    if (costuraVistaItems.length === 0) {
      console.log(`  SKIP: No Costura Vista items found in L1.`);
      continue;
    }

    // 3. Read L0 CP
    const l0Rows = await selectSql(
      `SELECT id, data FROM cp_documents WHERE project_name = '${family.l0}'`
    );
    if (l0Rows.length === 0) {
      console.log(`  ERROR: L0 CP not found for project_name="${family.l0}"`);
      continue;
    }
    const l0Row = l0Rows[0];
    const l0Data = typeof l0Row.data === 'string' ? JSON.parse(l0Row.data) : l0Row.data;
    const l0Items = l0Data.items || [];
    console.log(`  L0 "${family.l0}": ${l0Items.length} total items`);

    // 4. Check if L0 already has Costura Vista
    const existingCV = l0Items.filter(isCosturaVista);
    if (existingCV.length > 0) {
      console.log(`  SKIP: L0 already has ${existingCV.length} Costura Vista items. No changes needed.`);
      continue;
    }

    // 5. Clone items with new UUIDs
    const cloned = costuraVistaItems.map(item => ({
      ...item,
      id: randomUUID(),
    }));

    console.log(`  Cloning ${cloned.length} Costura Vista items from L1 to L0:`);
    for (const it of cloned) {
      console.log(`    Step ${it.processStepNumber} | ${it.processDescription} | prodChar: ${it.productCharacteristic || '(setup)'} | procChar: ${it.processCharacteristic || '-'}`);
    }

    // 6. Insert cloned items into L0 and sort by step number
    l0Data.items = [...l0Items, ...cloned];
    l0Data.items.sort((a, b) => parseStepNumber(a.processStepNumber) - parseStepNumber(b.processStepNumber));

    // 7. Update in Supabase
    const jsonStr = JSON.stringify(l0Data);
    const checksum = sha256(jsonStr);
    const itemCount = l0Data.items.length;

    await execSql(
      `UPDATE cp_documents SET data = '${jsonStr.replace(/'/g, "''")}', checksum = '${checksum}', item_count = ${itemCount}, updated_at = NOW() WHERE id = '${l0Row.id}'`
    );

    console.log(`  UPDATED: ${l0Items.length} → ${itemCount} items (added ${cloned.length})`);
    console.log(`  Checksum: ${checksum.slice(0, 16)}...`);
    grandTotalCopied += cloned.length;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total Costura Vista items added across all L0 CPs: ${grandTotalCopied}`);

  close();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
