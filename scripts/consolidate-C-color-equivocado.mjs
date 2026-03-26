#!/usr/bin/env node
/**
 * consolidate-C-color-equivocado.mjs
 *
 * Add failure mode "Ensamblar componente con color equivocado" to OP 10 (Recepcion)
 * in each headrest AMFE master. Also add corresponding CP item and HO qcItem.
 *
 * Targets (3 headrest master positions):
 *   - AMFE: Add failure in Op 10, first workElement, first function
 *   - CP:   Add item for Op 10
 *   - HO:   Add qcItem in Op 10 sheet
 *
 * Usage: node scripts/consolidate-C-color-equivocado.mjs
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
import { createHash, randomUUID } from 'crypto';

const uuid = () => randomUUID();
const sha256 = (str) => createHash('sha256').update(str).digest('hex');

// --- Position Data -----------------------------------------------------------

const POSITIONS = [
  { key: 'FRONT', projectName: 'VWA/PATAGONIA/HEADREST_FRONT' },
  { key: 'REAR_CEN', projectName: 'VWA/PATAGONIA/HEADREST_REAR_CEN' },
  { key: 'REAR_OUT', projectName: 'VWA/PATAGONIA/HEADREST_REAR_OUT' },
];

// --- Helpers -----------------------------------------------------------------

function parseData(doc) {
  return typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
}

function computeChecksum(data) {
  return sha256(JSON.stringify(data));
}

function countCauses(ops) {
  let total = 0, apH = 0, apM = 0;
  for (const op of ops)
    for (const we of (op.workElements || []))
      for (const fn of (we.functions || []))
        for (const fail of (fn.failures || []))
          for (const c of (fail.causes || [])) {
            total++;
            if (c.actionPriority === 'H') apH++;
            else if (c.actionPriority === 'M') apM++;
          }
  return { total, apH, apM };
}

function calcCoverage(ops) {
  let total = 0, covered = 0;
  for (const op of ops)
    for (const we of (op.workElements || []))
      for (const fn of (we.functions || []))
        for (const fail of (fn.failures || []))
          for (const c of (fail.causes || [])) {
            total++;
            if ((c.preventionControl && c.preventionControl !== '-' && c.preventionControl !== 'N/A') ||
                (c.detectionControl && c.detectionControl !== '-' && c.detectionControl !== 'N/A'))
              covered++;
          }
  return total > 0 ? Math.round((covered / total) * 10000) / 100 : 0;
}

// --- Main --------------------------------------------------------------------

async function main() {
  await initSupabase();

  console.log('\n============================================================');
  console.log('  CONSOLIDATE-C: Color Equivocado (Op 10) — AMFE + CP + HO');
  console.log('============================================================');

  let amfeUpdated = 0;
  let cpUpdated = 0;
  let hoUpdated = 0;

  for (const pos of POSITIONS) {
    console.log(`\n  ═══ ${pos.key}: ${pos.projectName} ═══`);

    // =========================================================================
    // 1. AMFE: Add failure in OP 10
    // =========================================================================

    console.log('\n    --- AMFE ---');

    const amfeDocs = await selectSql(
      `SELECT id, data FROM amfe_documents WHERE project_name = '${pos.projectName}'`
    );

    if (amfeDocs.length === 0) {
      console.log('      AMFE: not found');
    } else {
      for (const doc of amfeDocs) {
        const data = parseData(doc);
        const ops = data.operations || [];

        const op10 = ops.find(op => (op.operationNumber || op.opNumber) === '10');
        if (!op10) {
          console.log('      AMFE: Op 10 not found — SKIP');
          continue;
        }

        // Find first workElement -> first function -> failures array
        const we = (op10.workElements || [])[0];
        if (!we) {
          console.log('      AMFE: Op 10 has no workElements — SKIP');
          continue;
        }
        const fn = (we.functions || [])[0];
        if (!fn) {
          console.log('      AMFE: Op 10 first workElement has no functions — SKIP');
          continue;
        }

        // Check if failure already exists
        const alreadyExists = (fn.failures || []).some(
          f => f.description === 'Ensamblar componente con color equivocado'
        );
        if (alreadyExists) {
          console.log('      AMFE: Failure "Ensamblar componente con color equivocado" already exists — SKIP');
          continue;
        }

        // Add new failure
        const newFailure = {
          id: uuid(),
          description: 'Ensamblar componente con color equivocado',
          effectLocal: 'Pieza con componentes de color incorrecto mezclados en lote',
          effectNextLevel: 'Producto terminado con color no conforme, rechazo en inspeccion final',
          effectEndUser: 'Cabezal de color diferente al resto del asiento, reclamo del cliente',
          causes: [{
            id: uuid(),
            description: 'Error en identificacion de color vs Orden de Produccion',
            severity: 7, occurrence: 3, detection: 3, actionPriority: 'L',
            preventionControl: 'Escaneo de codigo de barras vs Orden de Produccion',
            detectionControl: 'Control visual de color en estacion de costura',
            preventionAction: '', detectionAction: '',
            responsible: '', targetDate: '', status: '',
          }]
        };

        fn.failures = [...(fn.failures || []), newFailure];

        // Recalculate stats
        const { total: causeCount, apH, apM } = countCauses(data.operations);
        const coverage = calcCoverage(data.operations);
        const opCount = data.operations.length;

        const checksum = computeChecksum(data);
        const jsonStr = JSON.stringify(data).replace(/'/g, "''");

        await execSql(
          `UPDATE amfe_documents SET data = '${jsonStr}', checksum = '${checksum}', operation_count = ${opCount}, cause_count = ${causeCount}, ap_h_count = ${apH}, ap_m_count = ${apM}, coverage_percent = ${coverage}, updated_at = NOW() WHERE id = '${doc.id}'`
        );

        console.log(`      AMFE: ADDED failure to Op 10 (id=${doc.id.slice(0, 8)}...)`);
        console.log(`        causes: ${causeCount}, apH: ${apH}, apM: ${apM}, coverage: ${coverage}%`);
        amfeUpdated++;
      }
    }

    // =========================================================================
    // 2. CP: Add item in OP 10
    // =========================================================================

    console.log('\n    --- CP ---');

    const cpDocs = await selectSql(
      `SELECT id, data FROM cp_documents WHERE project_name = '${pos.projectName}'`
    );

    if (cpDocs.length === 0) {
      console.log('      CP: not found');
    } else {
      for (const doc of cpDocs) {
        const data = parseData(doc);
        const items = data.items || [];

        // Check if item already exists
        const alreadyExists = items.some(
          it => it.processStepNumber === '10' &&
                it.productCharacteristic === 'Color de componente vs Orden de Produccion'
        );
        if (alreadyExists) {
          console.log('      CP: Color item for Op 10 already exists — SKIP');
          continue;
        }

        const newCpItem = {
          id: uuid(),
          processStepNumber: '10',
          processDescription: 'RECEPCIONAR MATERIA PRIMA',
          machineDeviceTool: 'Escaner de codigo de barras',
          characteristicNumber: '',
          productCharacteristic: 'Color de componente vs Orden de Produccion',
          processCharacteristic: '',
          specialCharClass: '',
          specification: 'Color conforme a Orden de Produccion y codigo de barras',
          evaluationTechnique: 'Escaneo codigo de barras + control visual',
          sampleSize: '100%',
          sampleFrequency: 'Cada componente',
          controlMethod: 'Escaneo automatico + autocontrol visual',
          reactionPlan: 'Segregar lote, notificar s/ P-09/I.',
          reactionPlanOwner: 'Operador de produccion',
          controlProcedure: '',
          autoFilledFields: [],
          amfeAp: 'L',
          amfeSeverity: 7,
          operationCategory: 'recepcion',
          amfeCauseIds: [],
          amfeFailureId: '',
          amfeFailureIds: [],
        };

        data.items = [...items, newCpItem];
        data.items.sort((a, b) => parseFloat(a.processStepNumber) - parseFloat(b.processStepNumber));

        const itemCount = data.items.length;
        const checksum = computeChecksum(data);
        const jsonStr = JSON.stringify(data).replace(/'/g, "''");

        await execSql(
          `UPDATE cp_documents SET data = '${jsonStr}', checksum = '${checksum}', item_count = ${itemCount}, updated_at = NOW() WHERE id = '${doc.id}'`
        );

        console.log(`      CP: ADDED color item for Op 10 (id=${doc.id.slice(0, 8)}...)`);
        console.log(`        items: ${items.length} -> ${itemCount}`);
        cpUpdated++;
      }
    }

    // =========================================================================
    // 3. HO: Add qcItem in OP 10 sheet
    // =========================================================================

    console.log('\n    --- HO ---');

    const hoDocs = await selectSql(
      `SELECT id, data FROM ho_documents WHERE linked_amfe_project = '${pos.projectName}'`
    );

    if (hoDocs.length === 0) {
      console.log('      HO: not found');
    } else {
      for (const doc of hoDocs) {
        const data = parseData(doc);
        const sheets = data.sheets || [];

        const sheet10 = sheets.find(s => s.operationNumber === '10');
        if (!sheet10) {
          console.log('      HO: Op 10 sheet not found — SKIP');
          continue;
        }

        // Check if qcItem already exists
        const qcItems = sheet10.qualityChecks || [];
        const alreadyExists = qcItems.some(
          qc => qc.characteristic === 'Color de componente vs Orden de Produccion'
        );
        if (alreadyExists) {
          console.log('      HO: Color qcItem for Op 10 already exists — SKIP');
          continue;
        }

        const newQcItem = {
          id: uuid(),
          cpItemId: '',
          characteristic: 'Color de componente vs Orden de Produccion',
          controlMethod: 'Escaneo codigo de barras + control visual',
          frequency: 'Cada componente',
          responsible: 'Operador de produccion',
          specification: 'Color conforme a Orden de Produccion',
          reactionPlan: 'Segregar lote, notificar s/ P-09/I.',
        };

        sheet10.qualityChecks = [...qcItems, newQcItem];

        const sheetCount = data.sheets.length;
        const checksum = computeChecksum(data);
        const jsonStr = JSON.stringify(data).replace(/'/g, "''");

        await execSql(
          `UPDATE ho_documents SET data = '${jsonStr}', checksum = '${checksum}', sheet_count = ${sheetCount}, updated_at = NOW() WHERE id = '${doc.id}'`
        );

        console.log(`      HO: ADDED color qcItem to Op 10 sheet (id=${doc.id.slice(0, 8)}...)`);
        console.log(`        qcItems in Op 10: ${qcItems.length} -> ${sheet10.qualityChecks.length}`);
        hoUpdated++;
      }
    }
  }

  // ===========================================================================
  // SUMMARY
  // ===========================================================================

  console.log('\n\n============================================================');
  console.log('  SUMMARY');
  console.log('============================================================');
  console.log(`  AMFE docs updated (failure added):   ${amfeUpdated}`);
  console.log(`  CP docs updated (item added):        ${cpUpdated}`);
  console.log(`  HO docs updated (qcItem added):      ${hoUpdated}`);
  console.log(`  GRAND TOTAL:                         ${amfeUpdated + cpUpdated + hoUpdated} updates`);
  console.log('============================================================\n');

  close();
}

main().catch((err) => {
  console.error('FATAL:', err);
  close();
  process.exit(1);
});
