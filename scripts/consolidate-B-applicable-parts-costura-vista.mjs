#!/usr/bin/env node
/**
 * consolidate-B-applicable-parts-costura-vista.mjs
 *
 * Two goals:
 *   Part 1: Update applicableParts in ALL master headrest docs (AMFE, CP, HO, PFD)
 *           to include all 4 part numbers per position.
 *   Part 2: Add "Costura Vista" operation (Op 35) to AMFE masters.
 *   Part 3: Add "Costura Vista" items (Op 35) to CP masters.
 *   Part 4: Add "Costura Vista" sheet (Op 35) to HO masters.
 *   Part 5: Update PFD step description with conditional text.
 *
 * Usage: node scripts/consolidate-B-applicable-parts-costura-vista.mjs
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
import { createHash, randomUUID } from 'crypto';

const uuid = () => randomUUID();
const sha256 = (str) => createHash('sha256').update(str).digest('hex');

// ─── Position Data ──────────────────────────────────────────────────────────

const POSITIONS = [
  {
    key: 'FRONT',
    projectName: 'VWA/PATAGONIA/HEADREST_FRONT',
    pfdPartNumber: '2HC.881.901',   // PFD table uses part_number col (no project_name)
    applicableParts: '2HC881901 RL1 (Titan Black)\n2HC881901A GFV (Rennes Black)\n2HC881901B GEV (Andino Gray)\n2HC881901C EFG (Dark Slate)',
  },
  {
    key: 'REAR_CEN',
    projectName: 'VWA/PATAGONIA/HEADREST_REAR_CEN',
    pfdPartNumber: '2HC.885.900',
    applicableParts: '2HC885900 RL1 (Titan Black)\n2HC885900A EIF (Rennes Black)\n2HC885900B SIY (Andino Gray)\n2HC885900C SIY (Dark Slate)',
  },
  {
    key: 'REAR_OUT',
    projectName: 'VWA/PATAGONIA/HEADREST_REAR_OUT',
    pfdPartNumber: '2HC.885.901',
    applicableParts: '2HC885901 RL1 (Titan Black)\n2HC885901A GFU (Rennes Black)\n2HC885901B GEQ (Andino Gray)\n2HC885901C DZS (Dark Slate)',
  },
];

const COSTURA_VISTA_COND = '(Aplica solo a L1 Rennes Black, L2 Andino Gray, L3 Dark Slate — NO aplica a L0 Titan Black)';

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  await initSupabase();

  console.log('\n============================================================');
  console.log('  CONSOLIDATE-B: applicableParts + Costura Vista (Op 35)');
  console.log('============================================================');

  let totalUpdated = 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // PART 1: Update applicableParts in ALL master docs
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n--- PART 1: Update applicableParts in ALL master docs --------');

  for (const pos of POSITIONS) {
    console.log(`\n  === ${pos.key}: ${pos.projectName} ===`);
    console.log(`      applicableParts:\n${pos.applicableParts.split('\n').map(l => '        ' + l).join('\n')}`);

    // ── AMFE (by project_name) ──────────────────────────────────────────
    {
      const docs = await selectSql(
        `SELECT id, data FROM amfe_documents WHERE project_name = '${pos.projectName}'`
      );
      for (const doc of docs) {
        const data = parseData(doc);
        const old = data.header?.applicableParts || '(empty)';
        data.header.applicableParts = pos.applicableParts;
        const checksum = computeChecksum(data);
        const jsonStr = JSON.stringify(data).replace(/'/g, "''");
        await execSql(`UPDATE amfe_documents SET data = '${jsonStr}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${doc.id}'`);
        console.log(`      AMFE: UPDATED (id=${doc.id.slice(0, 8)}...) [was: ${old.slice(0, 40)}]`);
        totalUpdated++;
      }
      if (docs.length === 0) console.log('      AMFE: not found');
    }

    // ── CP (by project_name) ────────────────────────────────────────────
    {
      const docs = await selectSql(
        `SELECT id, data FROM cp_documents WHERE project_name = '${pos.projectName}'`
      );
      for (const doc of docs) {
        const data = parseData(doc);
        const old = data.header?.applicableParts || '(empty)';
        data.header.applicableParts = pos.applicableParts;
        const checksum = computeChecksum(data);
        const jsonStr = JSON.stringify(data).replace(/'/g, "''");
        await execSql(`UPDATE cp_documents SET data = '${jsonStr}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${doc.id}'`);
        console.log(`      CP:   UPDATED (id=${doc.id.slice(0, 8)}...) [was: ${old.slice(0, 40)}]`);
        totalUpdated++;
      }
      if (docs.length === 0) console.log('      CP:   not found');
    }

    // ── HO (by linked_amfe_project) ─────────────────────────────────────
    {
      const docs = await selectSql(
        `SELECT id, data FROM ho_documents WHERE linked_amfe_project = '${pos.projectName}'`
      );
      for (const doc of docs) {
        const data = parseData(doc);
        const old = data.header?.applicableParts || '(empty)';
        data.header.applicableParts = pos.applicableParts;
        const checksum = computeChecksum(data);
        const jsonStr = JSON.stringify(data).replace(/'/g, "''");
        await execSql(`UPDATE ho_documents SET data = '${jsonStr}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${doc.id}'`);
        console.log(`      HO:   UPDATED (id=${doc.id.slice(0, 8)}...) [was: ${old.slice(0, 40)}]`);
        totalUpdated++;
      }
      if (docs.length === 0) console.log('      HO:   not found');
    }

    // ── PFD (by part_number — PFD table has no project_name column) ────
    {
      const docs = await selectSql(
        `SELECT id, part_name, data FROM pfd_documents WHERE part_number = '${pos.pfdPartNumber}'`
      );
      for (const doc of docs) {
        const data = parseData(doc);
        const old = data.header?.applicableParts || '(empty)';
        if (data.header) {
          data.header.applicableParts = pos.applicableParts;
        }
        const checksum = computeChecksum(data);
        const jsonStr = JSON.stringify(data).replace(/'/g, "''");
        await execSql(`UPDATE pfd_documents SET data = '${jsonStr}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${doc.id}'`);
        console.log(`      PFD:  UPDATED (id=${doc.id.slice(0, 8)}..., ${doc.part_name}) [was: ${old.slice(0, 40)}]`);
        totalUpdated++;
      }
      if (docs.length === 0) console.log('      PFD:  not found');
    }
  }

  console.log(`\n  Part 1 total updated: ${totalUpdated}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PART 2: Add Costura Vista (Op 35) to AMFE masters
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n\n--- PART 2: Add Costura Vista to AMFE masters ----------------');

  let amfeAdded = 0;

  for (const pos of POSITIONS) {
    console.log(`\n  === ${pos.key} ===`);

    const docs = await selectSql(
      `SELECT id, data FROM amfe_documents WHERE project_name = '${pos.projectName}'`
    );
    if (docs.length === 0) {
      console.log('      AMFE not found');
      continue;
    }

    for (const doc of docs) {
      const data = parseData(doc);
      const ops = data.operations || [];

      // Check if Op 35 already exists
      const existing35 = ops.find(op => op.operationNumber === '35');
      if (existing35) {
        console.log(`      SKIP: Op 35 already exists ("${existing35.operationName.slice(0, 50)}")`);
        continue;
      }

      // Build Costura Vista operation
      const costuraVistaOp = {
        id: uuid(),
        operationNumber: '35',
        operationName: `COSTURA VISTA ${COSTURA_VISTA_COND}`,
        linkedPfdStepId: '',
        workElements: [{
          id: uuid(),
          description: 'Maquina de coser BM 114',
          functions: [{
            id: uuid(),
            description: 'Realizar costura decorativa visible segun patron',
            failures: [
              {
                id: uuid(),
                description: 'Puntada fuera de tolerancia',
                effectLocal: 'Costura no cumple especificacion dimensional',
                effectNextLevel: 'Rechazo en inspeccion final',
                effectEndUser: 'Defecto estetico visible en vehiculo',
                causes: [{
                  id: uuid(),
                  description: 'Set up de maquina incorrecto o desgaste de aguja',
                  severity: 5, occurrence: 3, detection: 4, actionPriority: 'L',
                  preventionControl: 'Hoja de set-up BM 114',
                  detectionControl: 'Autocontrol visual + regla de medicion',
                  preventionAction: '', detectionAction: '',
                  responsible: '', targetDate: '', status: '',
                }]
              },
              {
                id: uuid(),
                description: 'Hilo roto / costura incompleta',
                effectLocal: 'Funda con costura interrumpida',
                effectNextLevel: 'Rechazo en inspeccion final, retrabajo offline',
                effectEndUser: 'Costura visible incompleta, reclamo por aspecto',
                causes: [{
                  id: uuid(),
                  description: 'Tension de hilo incorrecta o hilo defectuoso',
                  severity: 5, occurrence: 3, detection: 4, actionPriority: 'L',
                  preventionControl: 'Control de tension al inicio de turno',
                  detectionControl: 'Autocontrol 100%',
                  preventionAction: '', detectionAction: '',
                  responsible: '', targetDate: '', status: '',
                }]
              },
              {
                id: uuid(),
                description: 'Color de hilo incorrecto',
                effectLocal: 'Funda cosida con hilo que no corresponde al color',
                effectNextLevel: 'Rechazo en inspeccion final',
                effectEndUser: 'Apariencia no conforme, reclamo del cliente',
                causes: [{
                  id: uuid(),
                  description: 'Error en seleccion de hilo vs Orden de Produccion',
                  severity: 5, occurrence: 3, detection: 3, actionPriority: 'L',
                  preventionControl: 'Verificacion de OP antes de iniciar costura',
                  detectionControl: 'Autocontrol visual vs muestra patron',
                  preventionAction: '', detectionAction: '',
                  responsible: '', targetDate: '', status: '',
                }]
              }
            ]
          }]
        }]
      };

      // Add and sort
      data.operations = [...ops, costuraVistaOp];
      data.operations.sort((a, b) => parseFloat(a.operationNumber) - parseFloat(b.operationNumber));

      // Recount stats
      const { total: causeCount, apH, apM } = countCauses(data.operations);
      const coverage = calcCoverage(data.operations);
      const opCount = data.operations.length;

      const checksum = computeChecksum(data);
      const jsonStr = JSON.stringify(data).replace(/'/g, "''");

      await execSql(
        `UPDATE amfe_documents SET data = '${jsonStr}', checksum = '${checksum}', operation_count = ${opCount}, cause_count = ${causeCount}, ap_h_count = ${apH}, ap_m_count = ${apM}, coverage_percent = ${coverage}, updated_at = NOW() WHERE id = '${doc.id}'`
      );

      console.log(`      ADDED Op 35 to AMFE (id=${doc.id.slice(0, 8)}...)`);
      console.log(`        ops: ${ops.length} -> ${opCount}, causes: ${causeCount}, apH: ${apH}, apM: ${apM}, coverage: ${coverage}%`);
      amfeAdded++;
    }
  }

  console.log(`\n  Part 2 AMFE docs updated: ${amfeAdded}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PART 3: Add Costura Vista items (Op 35) to CP masters
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n\n--- PART 3: Add Costura Vista items to CP masters ------------');

  let cpAdded = 0;
  const costuraVistaProcessDesc = `COSTURA VISTA ${COSTURA_VISTA_COND}`;

  for (const pos of POSITIONS) {
    console.log(`\n  === ${pos.key} ===`);

    const docs = await selectSql(
      `SELECT id, data FROM cp_documents WHERE project_name = '${pos.projectName}'`
    );
    if (docs.length === 0) {
      console.log('      CP not found');
      continue;
    }

    for (const doc of docs) {
      const data = parseData(doc);
      const items = data.items || [];

      // Check if Op 35 already exists
      const existing35 = items.filter(it => it.processStepNumber === '35');
      if (existing35.length > 0) {
        console.log(`      SKIP: Op 35 already has ${existing35.length} items in CP`);
        continue;
      }

      const cpCosturaVistaItems = [
        {
          id: uuid(), processStepNumber: '35', processDescription: costuraVistaProcessDesc,
          machineDeviceTool: 'Maquina de coser BM 114', characteristicNumber: '1',
          productCharacteristic: '', processCharacteristic: 'Set up de maquina',
          specialCharClass: '', specification: 'Ver hoja de set-up',
          evaluationTechnique: 'Hoja de set-up', sampleSize: '1 control', sampleFrequency: 'Inicio de turno y despues de cada intervencion mecanica',
          controlMethod: 'Control visual. Set-up', reactionPlan: 'Segun P-09/I.',
          reactionPlanOwner: 'Operador de produccion', controlProcedure: '',
          autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'costura',
          amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
        {
          id: uuid(), processStepNumber: '35', processDescription: costuraVistaProcessDesc,
          machineDeviceTool: 'Maquina de coser BM 114', characteristicNumber: '2',
          productCharacteristic: 'Largo de puntada', processCharacteristic: '',
          specialCharClass: '', specification: 'Segun hoja de set-up BM 114',
          evaluationTechnique: 'Regla', sampleSize: '1 pieza', sampleFrequency: 'Inicio y fin de turno',
          controlMethod: 'Autocontrol + registro', reactionPlan: 'Segun P-09/I.',
          reactionPlanOwner: 'Operador de produccion', controlProcedure: '',
          autoFilledFields: [], amfeAp: 'L', amfeSeverity: 5, operationCategory: 'costura',
          amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
        {
          id: uuid(), processStepNumber: '35', processDescription: costuraVistaProcessDesc,
          machineDeviceTool: 'Maquina de coser BM 114', characteristicNumber: '3',
          productCharacteristic: 'Tension de hilo', processCharacteristic: '',
          specialCharClass: '', specification: 'Segun hoja de set-up BM 114',
          evaluationTechnique: 'Control visual', sampleSize: '1 pieza', sampleFrequency: 'Inicio de turno',
          controlMethod: 'Autocontrol + registro', reactionPlan: 'Segun P-09/I.',
          reactionPlanOwner: 'Operador de produccion', controlProcedure: '',
          autoFilledFields: [], amfeAp: 'L', amfeSeverity: 5, operationCategory: 'costura',
          amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
        {
          id: uuid(), processStepNumber: '35', processDescription: costuraVistaProcessDesc,
          machineDeviceTool: 'Maquina de coser BM 114', characteristicNumber: '4',
          productCharacteristic: 'Color de hilo correcto', processCharacteristic: '',
          specialCharClass: '', specification: 'Color conforme a Orden de Produccion',
          evaluationTechnique: 'Control visual vs muestra patron', sampleSize: '100%', sampleFrequency: 'Cada pieza',
          controlMethod: 'Autocontrol visual', reactionPlan: 'Segun P-09/I.',
          reactionPlanOwner: 'Operador de produccion', controlProcedure: '',
          autoFilledFields: [], amfeAp: 'L', amfeSeverity: 5, operationCategory: 'costura',
          amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
        {
          id: uuid(), processStepNumber: '35', processDescription: costuraVistaProcessDesc,
          machineDeviceTool: 'Maquina de coser BM 114', characteristicNumber: '5',
          productCharacteristic: 'Apariencia general costura vista', processCharacteristic: '',
          specialCharClass: '', specification: 'Sin costura floja, salteada ni arrugas. Muestra patron',
          evaluationTechnique: 'Control visual / Muestra patron', sampleSize: '100%', sampleFrequency: 'Cada pieza',
          controlMethod: 'Autocontrol visual', reactionPlan: 'Segun P-09/I.',
          reactionPlanOwner: 'Operador de produccion', controlProcedure: '',
          autoFilledFields: [], amfeAp: 'L', amfeSeverity: 5, operationCategory: 'costura',
          amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
      ];

      // Add and sort
      data.items = [...items, ...cpCosturaVistaItems];
      data.items.sort((a, b) => parseFloat(a.processStepNumber) - parseFloat(b.processStepNumber));

      const itemCount = data.items.length;
      const checksum = computeChecksum(data);
      const jsonStr = JSON.stringify(data).replace(/'/g, "''");

      await execSql(
        `UPDATE cp_documents SET data = '${jsonStr}', checksum = '${checksum}', item_count = ${itemCount}, updated_at = NOW() WHERE id = '${doc.id}'`
      );

      console.log(`      ADDED 5 items for Op 35 to CP (id=${doc.id.slice(0, 8)}...)`);
      console.log(`        items: ${items.length} -> ${itemCount}`);
      cpAdded++;
    }
  }

  console.log(`\n  Part 3 CP docs updated: ${cpAdded}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PART 4: Add Costura Vista sheet (Op 35) to HO masters
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n\n--- PART 4: Add Costura Vista sheet to HO masters -----------');

  let hoAdded = 0;

  for (const pos of POSITIONS) {
    console.log(`\n  === ${pos.key} ===`);

    const docs = await selectSql(
      `SELECT id, data FROM ho_documents WHERE linked_amfe_project = '${pos.projectName}'`
    );
    if (docs.length === 0) {
      console.log('      HO not found');
      continue;
    }

    for (const doc of docs) {
      const data = parseData(doc);
      const sheets = data.sheets || [];

      // Check if Op 35 sheet already exists
      const existing35 = sheets.find(s => s.operationNumber === '35');
      if (existing35) {
        console.log(`      SKIP: Op 35 sheet already exists ("${existing35.operationName?.slice(0, 50)}")`);
        continue;
      }

      const costuraVistaSheet = {
        id: uuid(),
        hoNumber: 'HO-HR-35',
        operationNumber: '35',
        operationName: `COSTURA VISTA ${COSTURA_VISTA_COND}`,
        linkedCpOperationNumber: '35',
        steps: [
          {
            id: uuid(), stepNumber: 1,
            description: 'ATENCION: Verificar numero de parte en Orden de Produccion. Si es L1/L2/L3 ejecutar costura vista. Si es L0 Titan Black, omitir y pasar a siguiente operacion.',
            keyPoints: [{ text: 'L0 Titan Black = NO costura vista', symbol: '\u2605' }],
            reasons: ['L0 no lleva costura decorativa visible'],
          },
          {
            id: uuid(), stepNumber: 2,
            description: 'Realizar costura decorativa segun patron de costura BM 114',
            keyPoints: [
              { text: 'Verificar largo de puntada con regla', symbol: '\u2605' },
              { text: 'Verificar color de hilo vs muestra patron', symbol: '\u2605' },
            ],
            reasons: ['Asegurar conformidad estetica de costura visible'],
          },
        ],
        qualityChecks: [
          {
            id: uuid(), cpItemId: '',
            characteristic: 'Largo de puntada',
            controlMethod: 'Regla',
            frequency: 'Inicio y fin de turno',
            responsible: 'Operador de produccion',
            specification: 'Segun hoja de set-up BM 114',
            reactionPlan: 'Segun P-09/I.',
          },
          {
            id: uuid(), cpItemId: '',
            characteristic: 'Color de hilo correcto',
            controlMethod: 'Control visual vs muestra patron',
            frequency: 'Cada pieza',
            responsible: 'Operador de produccion',
            specification: 'Color conforme a Orden de Produccion',
            reactionPlan: 'Segun P-09/I.',
          },
          {
            id: uuid(), cpItemId: '',
            characteristic: 'Apariencia general costura vista',
            controlMethod: 'Control visual / Muestra patron',
            frequency: 'Cada pieza',
            responsible: 'Operador de produccion',
            specification: 'Sin costura floja, salteada ni arrugas',
            reactionPlan: 'Segun P-09/I.',
          },
        ],
        safetyElements: ['anteojos', 'proteccion_auditiva'],
        visualAids: [],
        ppe: ['anteojos', 'proteccion_auditiva'],
      };

      // Add and sort
      data.sheets = [...sheets, costuraVistaSheet];
      data.sheets.sort((a, b) => parseFloat(a.operationNumber) - parseFloat(b.operationNumber));

      const sheetCount = data.sheets.length;
      const checksum = computeChecksum(data);
      const jsonStr = JSON.stringify(data).replace(/'/g, "''");

      await execSql(
        `UPDATE ho_documents SET data = '${jsonStr}', checksum = '${checksum}', sheet_count = ${sheetCount}, updated_at = NOW() WHERE id = '${doc.id}'`
      );

      console.log(`      ADDED Op 35 sheet to HO (id=${doc.id.slice(0, 8)}...)`);
      console.log(`        sheets: ${sheets.length} -> ${sheetCount}`);
      hoAdded++;
    }
  }

  console.log(`\n  Part 4 HO docs updated: ${hoAdded}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PART 5: Update PFD Costura Vista step with conditional text
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n\n--- PART 5: Update PFD Costura Vista step description --------');

  let pfdUpdated = 0;

  for (const pos of POSITIONS) {
    console.log(`\n  === ${pos.key} ===`);

    // PFD table has no project_name column — query by part_number
    const docs = await selectSql(
      `SELECT id, part_name, data FROM pfd_documents WHERE part_number = '${pos.pfdPartNumber}'`
    );

    if (docs.length === 0) {
      console.log('      PFD: NOT FOUND');
      continue;
    }

    for (const doc of docs) {
      const data = parseData(doc);
      const steps = data.steps || [];
      let found = false;

      for (const step of steps) {
        const desc = (step.description || step.name || '').toUpperCase();
        if (desc.includes('COSTURA VISTA') && desc.indexOf('APLICA SOLO') === -1) {
          const oldDesc = step.description || step.name;
          // Update description (PFD steps may use 'name' or 'description')
          if (step.description !== undefined) {
            step.description = `COSTURA VISTA ${COSTURA_VISTA_COND}`;
          }
          if (step.name !== undefined) {
            step.name = `COSTURA VISTA ${COSTURA_VISTA_COND}`;
          }
          console.log(`      PFD step updated: "${oldDesc.slice(0, 50)}" -> added conditional text`);
          found = true;
        }
      }

      if (!found) {
        console.log(`      PFD: No "COSTURA VISTA" step found (or already updated) in doc (id=${doc.id.slice(0, 8)}...)`);
        continue;
      }

      const checksum = computeChecksum(data);
      const jsonStr = JSON.stringify(data).replace(/'/g, "''");
      await execSql(
        `UPDATE pfd_documents SET data = '${jsonStr}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${doc.id}'`
      );
      console.log(`      PFD UPDATED (id=${doc.id.slice(0, 8)}...)`);
      pfdUpdated++;
    }
  }

  console.log(`\n  Part 5 PFD docs updated: ${pfdUpdated}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n\n============================================================');
  console.log('  SUMMARY');
  console.log('============================================================');
  console.log(`  Part 1 - applicableParts updated:  ${totalUpdated} docs`);
  console.log(`  Part 2 - AMFE Op 35 added:         ${amfeAdded} docs`);
  console.log(`  Part 3 - CP Op 35 items added:     ${cpAdded} docs`);
  console.log(`  Part 4 - HO Op 35 sheet added:     ${hoAdded} docs`);
  console.log(`  Part 5 - PFD conditional text:     ${pfdUpdated} docs`);
  console.log(`  GRAND TOTAL:                       ${totalUpdated + amfeAdded + cpAdded + hoAdded + pfdUpdated} updates`);
  console.log('============================================================\n');

  close();
}

main().catch((err) => {
  console.error('FATAL:', err);
  close();
  process.exit(1);
});
