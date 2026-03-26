#!/usr/bin/env node
/**
 * fix-add-flamabilidad-pwa.mjs
 *
 * Adds flamabilidad failure/control/check to Telas Termoformadas (PWA product):
 *   1. AMFE (AMFE-PWA-113): New failure in Op 10 "RECEPCION DE MATERIA PRIMA"
 *   2. CP (CP-TELAS-TERMO-001): New item for Op 10 flamabilidad
 *   3. HO (TERMOFORMADAS): New qualityCheck in sheet Op 10
 *
 * Usage: node scripts/fix-add-flamabilidad-pwa.mjs
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
import { createHash, randomUUID } from 'crypto';

function parseData(row) { return typeof row.data === 'string' ? JSON.parse(row.data) : row.data; }

async function updateDoc(table, id, data) {
  const jsonStr = JSON.stringify(data).replace(/'/g, "''");
  const checksum = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  await execSql(`UPDATE ${table} SET data = '${jsonStr}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${id}'`);
}

async function main() {
  await initSupabase();

  // =========================================================================
  // 1. AMFE — AMFE-PWA-113 (Telas Termoformadas)
  // =========================================================================
  console.log('\n=== AMFE: Adding flamabilidad to AMFE-PWA-113 ===');

  const amfeRows = await selectSql(`SELECT id, data FROM amfe_documents WHERE amfe_number = 'AMFE-PWA-113'`);
  if (amfeRows.length === 0) throw new Error('AMFE-PWA-113 not found');
  const amfeRow = amfeRows[0];
  const amfeData = parseData(amfeRow);

  // Find Op 10 "RECEPCION DE MATERIA PRIMA"
  const op10 = amfeData.operations.find(op => op.opNumber === '10');
  if (!op10) throw new Error('Op 10 not found in AMFE-PWA-113');
  console.log(`  Found Op 10: "${op10.name}"`);

  // Find first workElement with functions (prefer Machine, fallback to any)
  let targetWe = op10.workElements.find(we => we.type === 'Machine' && we.functions?.length > 0);
  if (!targetWe) targetWe = op10.workElements.find(we => we.functions?.length > 0);
  if (!targetWe) throw new Error('No workElement with functions in Op 10');
  console.log(`  Found workElement: type="${targetWe.type}" name="${targetWe.name}"`);

  const firstFn = targetWe.functions[0];
  console.log(`  Found function: "${firstFn.description}"`);

  // Generate IDs for cross-linking
  const failureId = randomUUID();
  const causeId = randomUUID();

  // Add failure
  const newFailure = {
    id: failureId,
    description: "Material no cumple requisito de flamabilidad segun norma del cliente",
    effectLocal: "Material incumple flamabilidad",
    effectNextLevel: "Material no cumple norma de seguridad del vehiculo",
    effectEndUser: "Riesgo de seguridad ante incendio en vehiculo",
    severity: 10,
    severityLocal: "",
    severityNextLevel: "",
    severityEndUser: "",
    causes: [{
      id: causeId,
      cause: "Material fuera de especificacion requerida",
      preventionControl: "Certificado de flamabilidad del proveedor segun requisito PWA",
      detectionControl: "Verificacion documental en recepcion",
      occurrence: 2,
      detection: 3,
      ap: "M",
      characteristicNumber: "",
      specialChar: "CC",
      filterCode: "",
      preventionAction: "",
      detectionAction: "",
      responsible: "Carlos Baptista (Ingeniería)",
      targetDate: "2026-07-01",
      status: "Pendiente",
      actionTaken: "",
      completionDate: "",
      severityNew: "",
      occurrenceNew: "",
      detectionNew: "",
      apNew: "",
      observations: ""
    }]
  };

  firstFn.failures.push(newFailure);
  console.log(`  Added failure "${newFailure.description}" (id: ${failureId})`);
  console.log(`  With cause id: ${causeId}`);

  await updateDoc('amfe_documents', amfeRow.id, amfeData);
  console.log('  AMFE saved.');

  // =========================================================================
  // 2. CP — CP-TELAS-TERMO-001
  // =========================================================================
  console.log('\n=== CP: Adding flamabilidad item to CP-TELAS-TERMO-001 ===');

  const cpRows = await selectSql(`SELECT id, data FROM cp_documents WHERE control_plan_number = 'CP-TELAS-TERMO-001'`);
  if (cpRows.length === 0) throw new Error('CP-TELAS-TERMO-001 not found');
  const cpRow = cpRows[0];
  const cpData = parseData(cpRow);

  const cpItemId = randomUUID();

  const newCpItem = {
    id: cpItemId,
    processStepNumber: "10",
    processDescription: "RECEPCION DE MATERIA PRIMA",
    machineDeviceTool: "N/A",
    characteristicNumber: "",
    productCharacteristic: "Flamabilidad del material",
    processCharacteristic: "",
    specialCharClass: "CC",
    specification: "Segun requisito de flamabilidad PWA (norma especifica pendiente de confirmar)",
    evaluationTechnique: "Certificado de laboratorio",
    sampleSize: "1 certificado",
    sampleFrequency: "Cada recepcion",
    controlMethod: "Ensayo de flamabilidad segun norma y certificado de proveedor",
    reactionPlan: "Detener linea. Segregar producto sospechoso. Escalar a Gerencia de Calidad. Segun P-10/I. P-14.",
    reactionPlanOwner: "Recepcion de materiales",
    controlProcedure: "P-14.",
    amfeCauseIds: [causeId],
    amfeFailureId: failureId,
    amfeFailureIds: [failureId],
    amfeAp: "M",
    amfeSeverity: 10,
    operationCategory: "recepcion"
  };

  cpData.items.push(newCpItem);
  console.log(`  Added CP item "${newCpItem.productCharacteristic}" (id: ${cpItemId})`);

  await updateDoc('cp_documents', cpRow.id, cpData);
  console.log('  CP saved.');

  // =========================================================================
  // 3. HO — Telas Termoformadas (part_description matching /TERMOFORMADAS/i)
  // =========================================================================
  console.log('\n=== HO: Adding flamabilidad qualityCheck ===');

  const hoRows = await selectSql(`SELECT id, data, part_description FROM ho_documents WHERE part_description ILIKE '%TERMOFORMADAS%'`);
  if (hoRows.length === 0) throw new Error('HO for TERMOFORMADAS not found');
  const hoRow = hoRows[0];
  const hoData = parseData(hoRow);
  console.log(`  Found HO: "${hoRow.part_description}" (id: ${hoRow.id})`);

  // Find sheet for Op 10
  const sheet10 = hoData.sheets.find(s => s.operationNumber === '10');
  if (!sheet10) throw new Error('Sheet Op 10 not found in HO TERMOFORMADAS');
  console.log(`  Found sheet Op 10: "${sheet10.operationName}"`);

  const newQc = {
    id: randomUUID(),
    cpItemId: cpItemId,
    characteristic: "Flamabilidad del material",
    specification: "Segun requisito de flamabilidad PWA",
    evaluationTechnique: "Certificado de laboratorio",
    frequency: "Cada recepcion",
    controlMethod: "Ensayo de flamabilidad segun norma y certificado de proveedor",
    reactionAction: "Detener linea. Segregar. Segun P-10/I. P-14.",
    reactionContact: "Recepcion de materiales",
    specialCharSymbol: "CC",
    registro: "",
  };

  sheet10.qualityChecks.push(newQc);
  console.log(`  Added QC "${newQc.characteristic}" linked to CP item ${cpItemId}`);

  await updateDoc('ho_documents', hoRow.id, hoData);
  console.log('  HO saved.');

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n=== DONE ===');
  console.log(`  AMFE failure id: ${failureId}`);
  console.log(`  AMFE cause id:   ${causeId}`);
  console.log(`  CP item id:      ${cpItemId}`);
  console.log(`  HO QC id:        ${newQc.id}`);

  close();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
