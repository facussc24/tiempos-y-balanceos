#!/usr/bin/env node
/**
 * Script C — Fix Insert severity + effects, Top Roll duplicate, Telas Termo Control Final
 * 1. Insert Op 100: S=10 → S=4 for "El operador intenta quitar la pieza"
 * 2. Insert Op 111: fill effectNextLevel + effectEndUser
 * 3. Top Roll Op 50: remove duplicate "Despegue parcial del material (Delaminacion)"
 * 4. Telas Termoformadas: add Control Final (Op 80) copying from Planas
 */
import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
import { createHash, randomUUID } from 'crypto';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

function parseData(row) { return typeof row.data === 'string' ? JSON.parse(row.data) : row.data; }

async function updateDoc(table, id, data, extraCols = '') {
  const jsonStr = JSON.stringify(data).replace(/'/g, "''");
  const cs = sha256(JSON.stringify(data));
  await execSql(`UPDATE ${table} SET data = '${jsonStr}', checksum = '${cs}'${extraCols}, updated_at = NOW() WHERE id = '${id}'`);
}

// Deep clone with new UUIDs
function cloneWithNewIds(obj) {
  const str = JSON.stringify(obj);
  // Replace all UUIDs with new ones
  const uuidMap = new Map();
  const result = str.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, (match) => {
    if (!uuidMap.has(match)) {
      uuidMap.set(match, randomUUID());
    }
    return uuidMap.get(match);
  });
  return { data: JSON.parse(result), uuidMap };
}

// AP calculation helper (simplified VDA table)
function calcAp(s, o, d) {
  if (s >= 9) {
    if (o >= 4 || d >= 4) return 'H';
    return 'M';
  }
  if (s >= 7) {
    if (o >= 4 && d >= 4) return 'H';
    if (o >= 3 || d >= 5) return 'M';
    return 'L';
  }
  if (s >= 5) {
    if (o >= 5 && d >= 5) return 'H';
    if (o >= 4 || d >= 5) return 'M';
    return 'L';
  }
  // S <= 4
  return 'L';
}

async function main() {
  await initSupabase();

  // ═══════════════════════════════════════════════════════════════
  // 1. INSERT Op 100: S=10 → S=4
  // ═══════════════════════════════════════════════════════════════
  console.log('\n=== 1. Insert Op 100: S=10 → S=4 ===');
  const [insertAmfe] = await selectSql("SELECT id, data FROM amfe_documents WHERE amfe_number = 'AMFE-00001'");
  const insertData = parseData(insertAmfe);

  const op100 = insertData.operations.find(op => op.opNumber === '100');
  if (!op100) throw new Error('Op 100 not found');

  let fixed100 = false;
  for (const we of op100.workElements) {
    for (const fn of (we.functions || [])) {
      for (const f of (fn.failures || [])) {
        if (f.id === '5485fdac-c740-4b87-a911-2d565faa0f6d' || /intenta quitar/i.test(f.description)) {
          if (f.severity === 10) {
            f.severity = 4;
            // Recalculate AP for all causes
            for (const c of (f.causes || [])) {
              c.ap = calcAp(4, c.occurrence, c.detection);
              console.log(`  Cause "${c.cause.slice(0,40)}": S=4, O=${c.occurrence}, D=${c.detection} → AP=${c.ap}`);
            }
            console.log(`  Fixed: "${f.description.slice(0,60)}" S=10 → S=4`);
            fixed100 = true;
          } else {
            console.log(`  Already S=${f.severity}, skipping`);
          }
        }
      }
    }
  }
  if (!fixed100) console.log('  WARNING: Target failure not found or already fixed');

  // ═══════════════════════════════════════════════════════════════
  // 2. INSERT Op 111: fill empty effects
  // ═══════════════════════════════════════════════════════════════
  console.log('\n=== 2. Insert Op 111: fill effects ===');
  const op111 = insertData.operations.find(op => op.opNumber === '111');
  if (!op111) throw new Error('Op 111 not found');

  let fixed111 = false;
  for (const we of op111.workElements) {
    for (const fn of (we.functions || [])) {
      for (const f of (fn.failures || [])) {
        if (f.id === '5134869c-ca0a-458e-8eee-4aec9d83dcbb' || /etiqueta.*descarte.*retrabajo/i.test(f.description)) {
          if (!f.effectNextLevel || f.effectNextLevel.trim() === '') {
            f.effectNextLevel = "Pieza NC puede mezclarse con producto OK en el contenedor de embalaje";
            console.log(`  Filled effectNextLevel`);
            fixed111 = true;
          }
          if (!f.effectEndUser || f.effectEndUser.trim() === '') {
            f.effectEndUser = "No afecta directamente al usuario final";
            console.log(`  Filled effectEndUser`);
            fixed111 = true;
          }
          if (!fixed111) console.log(`  Effects already filled, skipping`);
        }
      }
    }
  }
  if (!fixed111) console.log('  WARNING: Target failure not found or already fixed');

  // Save Insert AMFE
  await updateDoc('amfe_documents', insertAmfe.id, insertData);
  console.log('  Insert AMFE saved');

  // ═══════════════════════════════════════════════════════════════
  // 3. TOP ROLL Op 50: remove duplicate "Despegue parcial"
  // ═══════════════════════════════════════════════════════════════
  console.log('\n=== 3. Top Roll Op 50: remove duplicate ===');
  const [trAmfe] = await selectSql("SELECT id, data FROM amfe_documents WHERE amfe_number = 'AMFE-TOPROLL-001'");
  const trData = parseData(trAmfe);

  const op50 = trData.operations.find(op => op.opNumber === '50');
  if (!op50) throw new Error('Op 50 not found in Top Roll');

  let removed = false;
  for (const we of op50.workElements) {
    for (const fn of (we.functions || [])) {
      const before = (fn.failures || []).length;
      // Find duplicates with same description
      const seen = new Set();
      fn.failures = (fn.failures || []).filter(f => {
        const key = f.description;
        if (seen.has(key)) {
          console.log(`  Removed duplicate: "${f.description}" (id=${f.id.slice(0,12)})`);
          removed = true;
          return false;
        }
        seen.add(key);
        return true;
      });
      if ((fn.failures || []).length !== before) {
        console.log(`  Failures: ${before} → ${fn.failures.length}`);
      }
    }
  }
  if (!removed) console.log('  No duplicates found');

  await updateDoc('amfe_documents', trAmfe.id, trData);
  console.log('  Top Roll AMFE saved');

  // ═══════════════════════════════════════════════════════════════
  // 4. TELAS TERMOFORMADAS: Add Control Final (Op 80)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n=== 4. Telas Termoformadas: Add Control Final ===');

  // Get Planas AMFE Op 80 as template
  const [planasAmfe] = await selectSql("SELECT id, data FROM amfe_documents WHERE amfe_number = 'AMFE-PWA-112'");
  const planasData = parseData(planasAmfe);
  const planasOp80 = planasData.operations.find(op => op.opNumber === '80');
  if (!planasOp80) throw new Error('Planas Op 80 not found');

  // Get Termoformadas AMFE
  const [termoAmfe] = await selectSql("SELECT id, data FROM amfe_documents WHERE amfe_number = 'AMFE-PWA-113'");
  const termoAmfeData = parseData(termoAmfe);

  // Check if already exists
  const existingOp = termoAmfeData.operations.find(op => op.opNumber === '80' || /control.*final/i.test(op.name || ''));
  if (existingOp) {
    console.log(`  SKIP AMFE: Control Final already exists as Op ${existingOp.opNumber}`);
  } else {
    // Clone Op 80 with new IDs
    const { data: newOp, uuidMap: amfeUuidMap } = cloneWithNewIds(planasOp80);
    termoAmfeData.operations.push(newOp);
    console.log(`  Added AMFE Op 80 "CONTROL FINAL DE CALIDAD" with ${amfeUuidMap.size} new UUIDs`);

    await updateDoc('amfe_documents', termoAmfe.id, termoAmfeData,
      `, operation_count = ${termoAmfeData.operations.length}`);
    console.log('  Termoformadas AMFE saved');
  }

  // Get Planas CP Op 80 items as template
  const [planasCp] = await selectSql("SELECT id, data FROM cp_documents WHERE control_plan_number = 'CP-TELAS-PLANAS-001'");
  const planasCpData = parseData(planasCp);
  const planasCp80Items = planasCpData.items.filter(i => i.processStepNumber === '80');

  // Get Termoformadas CP
  const cpRows = await selectSql("SELECT id, data, control_plan_number FROM cp_documents WHERE control_plan_number ILIKE '%TERMO%'");
  if (cpRows.length === 0) throw new Error('Termoformadas CP not found');
  const termoCpRow = cpRows[0];
  const termoCpData = parseData(termoCpRow);

  // Check if already exists
  const existingCpItems = termoCpData.items.filter(i => i.processStepNumber === '80');
  if (existingCpItems.length > 0) {
    console.log(`  SKIP CP: Op 80 items already exist (${existingCpItems.length} items)`);
  } else {
    // Clone each CP item with new IDs
    for (const item of planasCp80Items) {
      const { data: newItem } = cloneWithNewIds(item);
      // Clear AMFE links (they'll be different for Termoformadas)
      newItem.amfeCauseIds = [];
      newItem.amfeFailureId = "";
      newItem.amfeFailureIds = [];
      termoCpData.items.push(newItem);
    }
    console.log(`  Added ${planasCp80Items.length} CP items for Op 80`);

    await updateDoc('cp_documents', termoCpRow.id, termoCpData, `, item_count = ${termoCpData.items.length}`);
    console.log('  Termoformadas CP saved');
  }

  // Get Planas HO Op 80 sheet as template
  const [planasHo] = await selectSql("SELECT id, data FROM ho_documents WHERE part_description ILIKE '%planas%'");
  if (!planasHo) throw new Error('Planas HO not found');
  const planasHoData = parseData(planasHo);
  const planasSheet80 = planasHoData.sheets.find(s => s.operationNumber === '80');

  // Get Termoformadas HO
  const [termoHo] = await selectSql("SELECT id, data FROM ho_documents WHERE part_description ILIKE '%termoform%'");
  if (!termoHo) throw new Error('Termoformadas HO not found');
  const termoHoData = parseData(termoHo);

  // Check if already exists
  const existingSheet = termoHoData.sheets.find(s => s.operationNumber === '80' || /control.*final/i.test(s.operationName || ''));
  if (existingSheet) {
    console.log(`  SKIP HO: Sheet Op 80 already exists`);
  } else if (planasSheet80) {
    // Clone sheet with new IDs
    const { data: newSheet } = cloneWithNewIds(planasSheet80);
    // Clear cpItemId links (they're different)
    for (const qc of (newSheet.qualityChecks || [])) {
      qc.cpItemId = "";
    }
    termoHoData.sheets.push(newSheet);
    console.log(`  Added HO sheet Op 80 "CONTROL FINAL DE CALIDAD"`);

    await updateDoc('ho_documents', termoHo.id, termoHoData, `, sheet_count = ${termoHoData.sheets.length}`);
    console.log('  Termoformadas HO saved');
  } else {
    console.log('  WARNING: Planas HO sheet Op 80 not found as template');
  }

  console.log('\n=== Script C complete ===');
  close();
}

main().catch(e => { console.error('FATAL:', e); close(); process.exit(1); });
