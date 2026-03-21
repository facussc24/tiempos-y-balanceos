#!/usr/bin/env node
/**
 * update-cp-frequencies.mjs
 *
 * Replaces ALL time-based frequencies in Control Plans with event-based
 * plant frequencies. The plant does NOT use timer-based inspections —
 * all inspections are by EVENTS: shift start, shift end, lot change,
 * every lot, 100%.
 *
 * Usage:
 *   cd BarackMercosul && node scripts/update-cp-frequencies.mjs
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';

// ---------------------------------------------------------------------------
// Classification: determine control type from item fields
// ---------------------------------------------------------------------------

function classifyControlType(item) {
  const desc = (item.processDescription || '').toLowerCase();
  const method = (item.controlMethod || '').toLowerCase();
  const eval_ = (item.evaluationTechnique || '').toLowerCase();
  const prodChar = (item.productCharacteristic || '').toLowerCase();
  const procChar = (item.processCharacteristic || '').toLowerCase();
  const chars = prodChar + ' ' + procChar;
  const freq = (item.sampleFrequency || '').toLowerCase();

  // Reception (OP 10 materials)
  if (/recep|entrega/i.test(desc) || /recepcion|certificado.*proveedor|remito/i.test(method))
    return 'reception';

  // Packaging (embalaje)
  if (/embalaje/i.test(desc) || /identificacion.*vwa|etiqueta.*pt|cantidad.*caja|trazabilidad|apilado/i.test(chars) || /check.*embalaje|check.*vda|verificacion.*etiqueta/i.test(method))
    return 'packaging';

  // Layout test
  if (/layout|test de lay/i.test(desc) || /auditoria/i.test(freq) || /combustib|fmvss/i.test(chars))
    return 'layout_test';

  // Setup verification
  if (/set.?up|hoja de set/i.test(method) || /set.?up de maquina|parametros? de? maquina/i.test(chars))
    return 'setup';

  // Destructive test
  if (/ensayo|destruc|dinamometro/i.test(method) || /ensayo|destruc|traccion|pelado/i.test(eval_) || /resistencia.*costura|resistencia.*soldadura|adherencia/i.test(chars))
    return 'destructive';

  // Process parameter (machine params, temperature, pressure, etc.)
  if (/temperatura|presion|caudal|velocidad|crema|poka.yoke|relacion|tiempo.*ciclo|poliol|isocianato/i.test(chars) && /spc|sensor|monitor|display|parametro|set.?up|hoja/i.test(method))
    return 'process_param';

  // Dimensional
  if (/dimensional|gauge|calibre|medicion|planilla.*dimen/i.test(method) || /dimension|contorno.*corte|forma.*3d|cotas/i.test(chars))
    return 'dimensional';

  // Visual (default for most remaining)
  return 'visual';
}

// ---------------------------------------------------------------------------
// Determine new event-based frequency
// ---------------------------------------------------------------------------

function getEventFrequency(item, controlType) {
  const cls = (item.specialCharClass || '').toUpperCase();
  const currentFreq = (item.sampleFrequency || '').toLowerCase();

  // === KEEP EXISTING EVENT-BASED FREQUENCIES ===

  // Reception -> normalize to "Cada recepcion"
  if (controlType === 'reception') return 'Cada recepcion';

  // Packaging -> normalize but keep container type
  if (controlType === 'packaging') {
    if (/pallet/i.test(currentFreq)) return 'Cada pallet';
    if (/contenedor|cont\./i.test(currentFreq)) return 'Cada contenedor';
    return 'Cada caja';
  }

  // Layout test -> keep
  if (controlType === 'layout_test') return 'Auditoria de Producto';

  // Setup -> keep existing if it's the "intervencion mecanica" form
  if (controlType === 'setup') {
    if (/intervencion/i.test(currentFreq)) return item.sampleFrequency; // keep as-is
    return 'Inicio de turno';
  }

  // Already compound event-based (headrest costura) -> keep
  if (/inicio y fin de turno.*100%.*lote/i.test(currentFreq) || /100%.*lote.*inicio y fin/i.test(currentFreq))
    return item.sampleFrequency; // keep as-is

  // === APPLY CC/SC RULES ===

  if (cls === 'CC') {
    if (controlType === 'destructive') return '1 por lote + inicio y fin de turno';
    return '100%'; // visual, dimensional, process_param
  }

  if (cls === 'SC') {
    if (controlType === 'visual') return 'Inicio y fin de turno';
    if (controlType === 'dimensional') return 'Inicio y fin de turno';
    if (controlType === 'process_param') return 'Cada lote / cambio de setup';
    if (controlType === 'destructive') return 'Cada lote';
    return 'Inicio y fin de turno'; // default SC
  }

  // === UNCLASSIFIED ===
  if (controlType === 'process_param') return 'Inicio de turno';
  return 'Cada lote'; // default for unclassified: visual, dimensional, destructive
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== CP Frequency Updater: Time-based -> Event-based ===\n');

  await initSupabase();

  // 1. Fetch all CP documents
  const rows = await selectSql('SELECT id, data FROM cp_documents');
  console.log(`\nFound ${rows.length} CP documents.\n`);

  let totalChanged = 0;
  let totalItems = 0;
  let cpsChanged = 0;
  const allChanges = [];
  const freqDistribution = {};

  for (const row of rows) {
    let cpData;
    try {
      cpData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    } catch (e) {
      console.error(`  ERROR parsing CP ${row.id}: ${e.message}`);
      continue;
    }

    const projectName = cpData.projectName || cpData.partName || row.id;
    const items = cpData.items || [];
    const changes = [];

    for (const item of items) {
      totalItems++;
      const controlType = classifyControlType(item);
      const newFreq = getEventFrequency(item, controlType);
      const oldFreq = item.sampleFrequency || '';

      // Track frequency distribution (use new freq)
      freqDistribution[newFreq] = (freqDistribution[newFreq] || 0) + 1;

      if (newFreq !== oldFreq) {
        const cls = (item.specialCharClass || '-').toUpperCase();
        const opDesc = item.processDescription || item.operationNumber || '?';
        const charDesc = item.productCharacteristic || item.processCharacteristic || '?';
        changes.push({
          cls,
          opDesc: opDesc.substring(0, 40),
          charDesc: charDesc.substring(0, 40),
          oldFreq,
          newFreq,
          controlType,
        });

        item.sampleFrequency = newFreq;

        // Normalize sampleSize for 100%
        if (newFreq === '100%') {
          item.sampleSize = '100%';
        }
      }
    }

    if (changes.length > 0) {
      cpsChanged++;
      totalChanged += changes.length;
      allChanges.push({ projectName, changes });

      // Serialize and update
      const jsonStr = JSON.stringify(cpData);
      await execSql(
        `UPDATE cp_documents SET data = ?, updated_at = datetime('now') WHERE id = ?`,
        [jsonStr, row.id]
      );
    }
  }

  // === Print report ===
  console.log('\n' + '='.repeat(70));
  console.log('CHANGE REPORT');
  console.log('='.repeat(70));

  for (const { projectName, changes } of allChanges) {
    console.log(`\n=== CP: ${projectName} ===`);
    for (const c of changes) {
      console.log(`  [${c.cls.padEnd(2)}] ${c.opDesc.padEnd(42)} | "${c.oldFreq}" -> "${c.newFreq}" (type: ${c.controlType})`);
    }
  }

  console.log(`\nTotal: ${totalChanged} items changed across ${cpsChanged} CPs (of ${rows.length} total CPs, ${totalItems} total items)`);

  // === Frequency distribution ===
  console.log('\n' + '='.repeat(70));
  console.log('FINAL FREQUENCY DISTRIBUTION');
  console.log('='.repeat(70));

  const sortedFreqs = Object.entries(freqDistribution).sort((a, b) => b[1] - a[1]);
  for (const [freq, count] of sortedFreqs) {
    console.log(`  ${freq.padEnd(50)} : ${count} items`);
  }

  // === Banned frequency check ===
  console.log('\n' + '='.repeat(70));
  console.log('BANNED FREQUENCY CHECK');
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

  // Re-fetch all CPs to verify
  const verifyRows = await selectSql('SELECT id, data FROM cp_documents');
  let bannedFound = false;

  for (const pattern of bannedPatterns) {
    let matchCount = 0;
    for (const row of verifyRows) {
      let cpData;
      try {
        cpData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      } catch { continue; }

      for (const item of (cpData.items || [])) {
        const freq = (item.sampleFrequency || '').toLowerCase();
        if (freq.includes(pattern)) {
          matchCount++;
        }
      }
    }
    const status = matchCount === 0 ? '\u2713' : '\u2717 FOUND!';
    console.log(`  "${pattern}": ${matchCount} matches ${status}`);
    if (matchCount > 0) bannedFound = true;
  }

  if (bannedFound) {
    console.log('\n  WARNING: Some banned frequencies still present!');
  } else {
    console.log('\n  All banned frequencies eliminated successfully.');
  }

  close();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
