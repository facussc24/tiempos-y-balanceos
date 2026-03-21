#!/usr/bin/env node
/**
 * update-ho-frequencies.mjs
 *
 * Syncs HO (Hoja de Operaciones) quality check frequency snapshots
 * with the updated CP (Control Plan) frequencies.
 *
 * Two strategies:
 *   1. cpItemId match — look up the CP item and copy sampleFrequency
 *   2. Heuristic fallback — for QCs without cpItemId, classify and assign
 *
 * Usage:
 *   cd BarackMercosul && node scripts/update-ho-frequencies.mjs
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';

// ---------------------------------------------------------------------------
// Classification heuristic (mirrors CP script, adapted for HO QC fields)
// ---------------------------------------------------------------------------

function classifyQcControlType(qc) {
  const char_ = (qc.characteristic || '').toLowerCase();
  const method = (qc.controlMethod || '').toLowerCase();
  const eval_ = (qc.evaluationTechnique || '').toLowerCase();
  const freq = (qc.frequency || '').toLowerCase();

  // Reception
  if (/recepcion|entrega|certificado.*proveedor|remito/i.test(method)) return 'reception';

  // Packaging
  if (/embalaje/i.test(char_) || /identificacion|etiqueta|trazabilidad|apilado|cantidad.*caja/i.test(char_) || /check.*embalaje|check.*vda/i.test(method)) return 'packaging';

  // Layout test
  if (/layout|auditoria/i.test(freq) || /combustib|fmvss/i.test(char_)) return 'layout_test';

  // Setup
  if (/set.?up|hoja de set/i.test(method) || /set.?up de maquina|parametros? de? maquina/i.test(char_)) return 'setup';

  // Destructive
  if (/ensayo|destruc|dinamometro/i.test(method) || /ensayo|destruc|traccion|pelado/i.test(eval_) || /resistencia|adherencia/i.test(char_)) return 'destructive';

  // Process param
  if (/temperatura|presion|caudal|velocidad|crema|poka.yoke|relacion|poliol|isocianato/i.test(char_) && /spc|sensor|monitor|display|parametro/i.test(method)) return 'process_param';

  // Dimensional
  if (/dimensional|gauge|calibre|medicion|planilla.*dimen/i.test(method) || /dimension|contorno|forma.*3d/i.test(char_)) return 'dimensional';

  return 'visual';
}

function getEventFrequency(cls, controlType, currentFreq) {
  // Keep existing compound event-based
  if (/inicio y fin de turno.*100%.*lote/i.test(currentFreq)) return currentFreq;
  if (/intervencion/i.test(currentFreq)) return currentFreq;

  if (controlType === 'reception') return 'Cada recepcion';
  if (controlType === 'packaging') {
    if (/pallet/i.test(currentFreq)) return 'Cada pallet';
    if (/contenedor|cont\./i.test(currentFreq)) return 'Cada contenedor';
    return 'Cada caja';
  }
  if (controlType === 'layout_test') return 'Auditoria de Producto';
  if (controlType === 'setup') return 'Inicio de turno';

  if (cls === 'CC') {
    if (controlType === 'destructive') return '1 por lote + inicio y fin de turno';
    return '100%';
  }
  if (cls === 'SC') {
    if (controlType === 'visual') return 'Inicio y fin de turno';
    if (controlType === 'dimensional') return 'Inicio y fin de turno';
    if (controlType === 'process_param') return 'Cada lote / cambio de setup';
    if (controlType === 'destructive') return 'Cada lote';
    return 'Inicio y fin de turno';
  }

  // Unclassified
  if (controlType === 'process_param') return 'Inicio de turno';
  return 'Cada lote';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== HO Frequency Sync: Match CP snapshots ===\n');

  await initSupabase();

  // ------------------------------------------------------------------
  // 1. Build CP item map: cpItemId -> sampleFrequency
  // ------------------------------------------------------------------
  console.log('Loading CP documents...');
  const cpRows = await selectSql('SELECT id, data FROM cp_documents');
  console.log(`  Found ${cpRows.length} CP documents.`);

  const cpFreqMap = new Map(); // cpItem.id -> sampleFrequency

  for (const row of cpRows) {
    let cpData;
    try {
      cpData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    } catch (e) {
      console.error(`  ERROR parsing CP ${row.id}: ${e.message}`);
      continue;
    }
    for (const item of (cpData.items || [])) {
      if (item.id) {
        cpFreqMap.set(item.id, item.sampleFrequency || '');
      }
    }
  }
  console.log(`  Built CP item map: ${cpFreqMap.size} items.\n`);

  // ------------------------------------------------------------------
  // 2. Load all HO documents
  // ------------------------------------------------------------------
  console.log('Loading HO documents...');
  const hoRows = await selectSql('SELECT id, data FROM ho_documents');
  console.log(`  Found ${hoRows.length} HO documents.\n`);

  let totalQcsUpdated = 0;
  let viaCpMatch = 0;
  let viaHeuristic = 0;
  let hosUpdated = 0;
  const allChanges = [];

  // ------------------------------------------------------------------
  // 3. Process each HO
  // ------------------------------------------------------------------
  for (const row of hoRows) {
    let hoData;
    try {
      hoData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    } catch (e) {
      console.error(`  ERROR parsing HO ${row.id}: ${e.message}`);
      continue;
    }

    // Resolve a display name for the HO
    const projectName = hoData.header?.partDescription
      || hoData.header?.partNumber
      || row.id;
    const sheets = hoData.sheets || [];
    const docChanges = [];

    for (const sheet of sheets) {
      const sheetName = sheet.operationName
        ? `OP ${sheet.operationNumber} ${sheet.operationName}`
        : sheet.hoNumber || sheet.id;

      for (const qc of (sheet.qualityChecks || [])) {
        const oldFreq = qc.frequency || '';
        let newFreq = null;
        let method = null;

        // Strategy A: cpItemId match
        if (qc.cpItemId && cpFreqMap.has(qc.cpItemId)) {
          const cpFreq = cpFreqMap.get(qc.cpItemId);
          if (cpFreq !== oldFreq) {
            newFreq = cpFreq;
            method = 'cpItemId match';
          }
        }

        // Strategy B: heuristic (only if no cpItemId or cpItemId not found)
        if (newFreq === null && !qc.cpItemId) {
          const cls = (qc.specialCharSymbol || '').toUpperCase();
          const controlType = classifyQcControlType(qc);
          const heuristicFreq = getEventFrequency(cls, controlType, oldFreq);
          if (heuristicFreq !== oldFreq) {
            newFreq = heuristicFreq;
            method = `heuristic (${controlType})`;
          }
        }

        if (newFreq !== null) {
          qc.frequency = newFreq;
          totalQcsUpdated++;
          if (method === 'cpItemId match') viaCpMatch++;
          else viaHeuristic++;

          const charDesc = (qc.characteristic || '?').substring(0, 50);
          docChanges.push({
            sheetName,
            charDesc,
            oldFreq,
            newFreq,
            method,
          });
        }
      }
    }

    if (docChanges.length > 0) {
      hosUpdated++;
      allChanges.push({ projectName, docChanges });

      // Serialize and update
      const jsonStr = JSON.stringify(hoData);
      await execSql(
        `UPDATE ho_documents SET data = ?, updated_at = datetime('now') WHERE id = ?`,
        [jsonStr, row.id]
      );
    }
  }

  // ------------------------------------------------------------------
  // 4. Print report
  // ------------------------------------------------------------------
  console.log('\n' + '='.repeat(70));
  console.log('CHANGE REPORT');
  console.log('='.repeat(70));

  for (const { projectName, docChanges } of allChanges) {
    console.log(`\n=== HO linked to CP: ${projectName} ===`);
    for (const c of docChanges) {
      console.log(`  Sheet "${c.sheetName}" | QC "${c.charDesc}" | "${c.oldFreq}" -> "${c.newFreq}" (via ${c.method})`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total HO documents updated: ${hosUpdated} of ${hoRows.length}`);
  console.log(`Total QCs updated: ${totalQcsUpdated}`);
  console.log(`  - Via cpItemId match: ${viaCpMatch}`);
  console.log(`  - Via heuristic (no cpItemId): ${viaHeuristic}`);

  // ------------------------------------------------------------------
  // 5. Banned frequency check on HO
  // ------------------------------------------------------------------
  console.log('\n' + '='.repeat(70));
  console.log('BANNED FREQUENCY CHECK (HO)');
  console.log('='.repeat(70));

  const bannedPatterns = [
    'cada hora',
    'cada 2 horas',
    'cada 4 horas',
    'cada turno',
    'cada pieza',
    'por hora',
    'por turno',
    'hourly',
    'every hour',
    'every 2 hours',
    'per shift',
  ];

  // Re-fetch all HO docs to verify
  const verifyRows = await selectSql('SELECT id, data FROM ho_documents');
  let bannedFound = false;

  for (const pattern of bannedPatterns) {
    let matchCount = 0;
    for (const row of verifyRows) {
      let hoData;
      try {
        hoData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      } catch { continue; }

      for (const sheet of (hoData.sheets || [])) {
        for (const qc of (sheet.qualityChecks || [])) {
          const freq = (qc.frequency || '').toLowerCase();
          if (freq.includes(pattern)) {
            matchCount++;
          }
        }
      }
    }
    const status = matchCount === 0 ? '\u2713' : `\u2717 FOUND! (${matchCount})`;
    console.log(`  "${pattern}": ${matchCount} matches ${status}`);
    if (matchCount > 0) bannedFound = true;
  }

  if (bannedFound) {
    console.log('\n  WARNING: Some banned frequencies still present in HO!');
  } else {
    console.log('\n  All banned frequencies eliminated from HO successfully.');
  }

  close();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
