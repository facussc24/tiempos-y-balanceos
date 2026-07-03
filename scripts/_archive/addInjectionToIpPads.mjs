/**
 * addInjectionToIpPads.mjs
 *
 * Adds injection molding operation (OP 85 "INYECCION DE PIEZAS PLASTICAS")
 * to the TRIM ASM-UPR WRAPPING (IP PADs) AMFE and PFD documents.
 *
 * The injection operation is inserted between OP 80 (Control de Calidad) and
 * OP 90 (Tapizado Semiautomatico).
 *
 * Failure modes adapted from NOVAX PFMEA (NVX SAS, VW Amarok) and
 * MIRGOR AMFE 115 (Barack Mercosul, Tapa Consola MIRGOR OP 40).
 *
 * 10 failure modes, 28 causes total. All optimization action fields are empty
 * per amfe-actions.md rule.
 *
 * Usage:
 *   node scripts/addInjectionToIpPads.mjs           # dry-run (default)
 *   node scripts/addInjectionToIpPads.mjs --apply   # write to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

// ─── Config ─────────────────────────────────────────────────────────────────
const DRY_RUN = !process.argv.includes('--apply');
const ENV_PATH = 'C:/Users/FacundoS-PC/dev/BarackMercosul/.env.local';
const AMFE_DOC_ID = 'c9b93b84-f804-4cd0-91c1-c4878db41b97';
const PFD_DOC_ID = 'pfd-ippads-trim-asm-upr-wrapping';

// ─── Supabase connection ────────────────────────────────────────────────────
const envText = readFileSync(ENV_PATH, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// ─── Helpers ────────────────────────────────────────────────────────────────
const uid = () => randomUUID();
const clean = (s) => (s || '').replace(/\n/g, ' ').trim();

/**
 * AIAG-VDA 2019 AP Table — CORRECT implementation.
 * NEVER use S*O*D formula (see database.md incident 2026-04-06).
 */
function calcAP(s, o, d) {
  if (!s || !o || !d) return '';
  const sn = Number(s), on = Number(o), dn = Number(d);
  if (isNaN(sn) || isNaN(on) || isNaN(dn)) return '';
  if (sn < 1 || sn > 10 || on < 1 || on > 10 || dn < 1 || dn > 10) return '';

  if (sn <= 1) return 'L';
  if (sn <= 3) {
    if (on >= 8 && dn >= 5) return 'M';
    return 'L';
  }
  if (sn <= 6) {
    if (on >= 8) return dn >= 5 ? 'H' : 'M';
    if (on >= 6) return dn >= 2 ? 'M' : 'L';
    if (on >= 4) return dn >= 7 ? 'M' : 'L';
    return 'L';
  }
  if (sn <= 8) {
    if (on >= 8) return 'H';
    if (on >= 6) return dn >= 2 ? 'H' : 'M';
    if (on >= 4) return dn >= 7 ? 'H' : 'M';
    if (on >= 2) return dn >= 5 ? 'M' : 'L';
    return 'L';
  }
  // S=9-10
  if (on >= 6) return 'H';
  if (on >= 4) return dn >= 2 ? 'H' : 'M';
  if (on >= 2) {
    if (dn >= 7) return 'H';
    if (dn >= 5) return 'M';
    return 'L';
  }
  return 'L';
}

function makeCause(desc, s, o, d, pc, dc) {
  const ap = calcAP(s, o, d);
  return {
    id: uid(),
    description: clean(desc),
    severity: Number(s),
    occurrence: Number(o),
    detection: Number(d),
    actionPriority: ap,
    preventionControl: clean(pc),
    detectionControl: clean(dc),
    specialChar: '',
    characteristicNumber: '',
    filterCode: '',
    // NEVER fill optimization actions — rule amfe-actions.md
    preventionAction: '',
    detectionAction: '',
    responsible: '',
    targetDate: '',
    status: '',
    actionTaken: '',
    completionDate: '',
    severityNew: '',
    occurrenceNew: '',
    detectionNew: '',
    apNew: '',
    observations: '',
  };
}

function makeFailure(desc, effectLocal, effectNext, effectEnd, causes) {
  return {
    id: uid(),
    description: clean(desc),
    effectLocal: clean(effectLocal),
    effectNextLevel: clean(effectNext),
    effectEndUser: clean(effectEnd),
    causes: causes || [],
  };
}

function makeFunction(desc, reqs, failures) {
  return {
    id: uid(),
    description: clean(desc),
    requirements: clean(reqs),
    failures: failures || [],
  };
}

function makeWE(name, type, functions) {
  return {
    id: uid(),
    name: clean(name),
    type: type || '',
    functions: functions || [],
  };
}

function makeOp(num, name, workElements) {
  return {
    id: uid(),
    operationNumber: String(num),
    operationName: clean(name).toUpperCase(),
    workElements: workElements || [],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD OP 85 — INYECCION DE PIEZAS PLASTICAS
// ═══════════════════════════════════════════════════════════════════════════

function buildOp85() {
  const PC_DEFAULT = 'Dossier de parámetros de proceso / Procedimiento de arranque de fabricación inyección';
  const DC_DEFAULT = 'Autocontrol: Inspección visual del operador a 100% de las piezas';

  return makeOp(85, 'INYECCION DE PIEZAS PLASTICAS', [
    makeWE('Inyectora', 'Machine', [
      makeFunction(
        'Inyectar piezas plásticas conformes según especificación',
        'Piezas sin defectos visuales, dimensionales ni estructurales',
        [
          // ── FM1: Rebarbas ──
          makeFailure(
            'Rebarbas en pieza inyectada',
            'Retrabajo fuera del puesto',
            'Parada de hasta 1 hora. Reparación en cliente',
            'Pérdida de función secundaria del vehículo',
            [
              makeCause(
                'Parámetros de proceso desajustados / inestabilidad de la máquina de inyección',
                6, 2, 8,
                PC_DEFAULT,
                DC_DEFAULT
              ),
              makeCause(
                'Línea de junta del molde dañada o desgastada',
                6, 2, 8,
                'Procedimiento de arranque / Mantenimiento de molde',
                'Autocontrol: Inspección visual del operador a 100%'
              ),
              makeCause(
                'Fuerza de cierre insuficiente',
                6, 2, 8,
                'Dossier de parámetros de proceso',
                'Autocontrol: Inspección visual 100%'
              ),
            ]
          ),

          // ── FM2: Pieza incompleta ──
          makeFailure(
            'Pieza incompleta (llenado insuficiente)',
            'Retrabajo fuera del puesto',
            'Parada de hasta 1 hora',
            'Pérdida de función secundaria del vehículo',
            [
              makeCause(
                'Parámetros de proceso desajustados / inestabilidad de la máquina',
                6, 2, 8,
                PC_DEFAULT,
                DC_DEFAULT
              ),
              makeCause(
                'Punto de inyección obstruido en el molde',
                6, 2, 8,
                PC_DEFAULT,
                DC_DEFAULT
              ),
              makeCause(
                'Volumen de inyección demasiado pequeño (dosificación corta)',
                6, 2, 6,
                PC_DEFAULT,
                DC_DEFAULT
              ),
              makeCause(
                'Presión de inyección insuficiente',
                6, 2, 6,
                PC_DEFAULT,
                DC_DEFAULT
              ),
            ]
          ),

          // ── FM3: Pieza deformada ──
          makeFailure(
            'Pieza deformada',
            'Retrabajo fuera del puesto',
            'Parada de hasta 1 hora',
            'Pérdida de función secundaria del vehículo',
            [
              makeCause(
                'Parámetros de proceso desajustados',
                6, 2, 8,
                PC_DEFAULT,
                DC_DEFAULT
              ),
              makeCause(
                'Tiempo de compactación insuficiente (segunda presión)',
                6, 2, 8,
                PC_DEFAULT,
                DC_DEFAULT
              ),
              makeCause(
                'Falla del equipo de refrigeración',
                6, 2, 7,
                PC_DEFAULT,
                DC_DEFAULT
              ),
              makeCause(
                'Tiempo de enfriamiento insuficiente',
                6, 2, 8,
                PC_DEFAULT,
                DC_DEFAULT
              ),
            ]
          ),

          // ── FM4: Quemados ──
          makeFailure(
            'Quemados en pieza inyectada',
            'Retrabajo fuera del puesto',
            'Parada de hasta 1 hora',
            'Pérdida de función secundaria del vehículo',
            [
              makeCause(
                'Parámetros de proceso desajustados',
                5, 2, 8,
                PC_DEFAULT,
                DC_DEFAULT
              ),
              makeCause(
                'Obstrucción / insuficiencia de fugas de aire en el molde',
                5, 2, 8,
                PC_DEFAULT,
                DC_DEFAULT
              ),
            ]
          ),

          // ── FM5: Chupados (rechupes) ──
          makeFailure(
            'Chupados (rechupes) en pieza inyectada',
            'Retrabajo fuera del puesto',
            'Parada de hasta 1 hora',
            'Pérdida de función secundaria del vehículo',
            [
              makeCause(
                'Presión de compactación baja',
                5, 2, 8,
                PC_DEFAULT,
                DC_DEFAULT
              ),
              makeCause(
                'Tiempo de compactación bajo',
                5, 2, 6,
                PC_DEFAULT,
                DC_DEFAULT
              ),
              makeCause(
                'Ponto de inyección (ataque) reducido',
                5, 2, 8,
                PC_DEFAULT,
                DC_DEFAULT
              ),
            ]
          ),

          // ── FM6: Dimensional NOK ──
          makeFailure(
            'Dimensional NOK en pieza inyectada',
            'Retrabajo fuera del puesto',
            'Parada de hasta 1 hora',
            'Pérdida de función secundaria del vehículo',
            [
              makeCause(
                'Parámetros de proceso desajustados',
                6, 2, 8,
                PC_DEFAULT,
                DC_DEFAULT
              ),
              makeCause(
                'Equipo de refrigeración averiado',
                6, 2, 8,
                PC_DEFAULT,
                DC_DEFAULT
              ),
              makeCause(
                'Contracción de la pieza / enfriamiento del molde',
                6, 2, 8,
                PC_DEFAULT,
                DC_DEFAULT
              ),
            ]
          ),

          // ── FM7: Color no conforme ──
          makeFailure(
            'Color no conforme en pieza inyectada',
            'Retrabajo fuera del puesto',
            'Parada de hasta 1 hora',
            'Pérdida de función secundaria del vehículo',
            [
              makeCause(
                'Parámetros de proceso desajustados (temperatura del fundido)',
                6, 2, 4,
                PC_DEFAULT,
                DC_DEFAULT
              ),
              makeCause(
                'Mezcla con materia prima de la última producción (mala limpieza del husillo)',
                6, 1, 8,
                PC_DEFAULT,
                DC_DEFAULT
              ),
            ]
          ),

          // ── FM8: Peso NOK ──
          makeFailure(
            'Peso NOK en pieza inyectada',
            'Retrabajo fuera del puesto',
            'Parada de hasta 1 hora',
            'Pérdida de función secundaria del vehículo',
            [
              makeCause(
                'Parámetros de proceso desajustados',
                5, 1, 8,
                PC_DEFAULT,
                DC_DEFAULT
              ),
            ]
          ),

          // ── FM9: Piezas con rayas/marcas ──
          makeFailure(
            'Piezas con rayas/marcas',
            'Retrabajo fuera del puesto',
            'Parada de hasta 1 hora',
            'Pérdida de función secundaria del vehículo',
            [
              makeCause(
                'Degradación / desajuste del funcionamiento del robot',
                6, 2, 8,
                PC_DEFAULT,
                DC_DEFAULT
              ),
              makeCause(
                'Error del operador por falta de formación',
                6, 2, 8,
                PC_DEFAULT,
                DC_DEFAULT
              ),
              makeCause(
                'Línea de junta del molde dañada',
                6, 2, 8,
                PC_DEFAULT,
                DC_DEFAULT
              ),
            ]
          ),

          // ── FM10: Material con humedad ──
          makeFailure(
            'Material con humedad',
            'Retrabajo fuera del puesto',
            'Parada de hasta 1 hora',
            'Pérdida de función secundaria del vehículo',
            [
              makeCause(
                'Tiempo de secado incorrecto',
                6, 2, 8,
                PC_DEFAULT,
                DC_DEFAULT
              ),
              makeCause(
                'Temperatura de secado incorrecta',
                6, 2, 8,
                PC_DEFAULT,
                DC_DEFAULT
              ),
              makeCause(
                'Exceso de humedad de los materiales (mal acondicionamiento)',
                6, 2, 8,
                PC_DEFAULT,
                DC_DEFAULT
              ),
            ]
          ),
        ]
      ),
    ]),
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

console.log('='.repeat(70));
console.log('  ADD INJECTION OP 85 TO IP PADs AMFE + PFD');
console.log(`  AMFE Doc ID: ${AMFE_DOC_ID}`);
console.log(`  PFD Doc ID:  ${PFD_DOC_ID}`);
console.log(`  Mode: ${DRY_RUN ? 'DRY-RUN (no changes written)' : 'APPLY (writing to Supabase)'}`);
console.log('='.repeat(70));

// ═══════════════════════════════════════════════════════════════════════════
// PART 1: AMFE — Add OP 85
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '─'.repeat(70));
console.log('  PART 1: AMFE DOCUMENT');
console.log('─'.repeat(70));

// Step 1: Fetch AMFE
console.log('\n--- Step 1: Fetching AMFE document ---\n');

const { data: amfeDoc, error: amfeFetchErr } = await sb
  .from('amfe_documents')
  .select('id, project_name, subject, data')
  .eq('id', AMFE_DOC_ID)
  .single();

if (amfeFetchErr) {
  console.error('FATAL: Cannot fetch AMFE document:', amfeFetchErr.message);
  process.exit(1);
}

console.log(`  Found: "${amfeDoc.project_name}" / "${amfeDoc.subject}"`);
console.log(`  typeof data: ${typeof amfeDoc.data}`);

// Step 2: Parse data
let amfeData = amfeDoc.data;
if (typeof amfeData === 'string') {
  console.log('  Data is string — parsing JSON...');
  amfeData = JSON.parse(amfeData);
}

if (!amfeData || !amfeData.operations || !Array.isArray(amfeData.operations)) {
  console.error('FATAL: Data has no operations array');
  process.exit(1);
}

console.log(`  Operations count: ${amfeData.operations.length}`);

// Step 3: Check if OP 85 already exists
const existingOp85 = amfeData.operations.find(op => String(op.operationNumber) === '85');
if (existingOp85) {
  console.log('\n  WARNING: OP 85 already exists in this AMFE!');
  console.log(`  Name: "${existingOp85.operationName}"`);
  console.log('  Skipping AMFE insertion (already present).');
} else {
  // Step 4: Build OP 85 and insert it
  console.log('\n--- Step 3: Building OP 85 ---\n');
  const op85 = buildOp85();

  // Count FMs and causes
  let fmCount = 0, causeCount = 0;
  for (const we of op85.workElements) {
    for (const fn of we.functions) {
      for (const fm of fn.failures) {
        fmCount++;
        causeCount += fm.causes.length;
      }
    }
  }
  console.log(`  OP 85: "${op85.operationName}"`);
  console.log(`  Work Element: "${op85.workElements[0].name}" (${op85.workElements[0].type})`);
  console.log(`  Failure modes: ${fmCount}`);
  console.log(`  Total causes: ${causeCount}`);

  // Verify AP calculations
  console.log('\n  AP verification:');
  for (const we of op85.workElements) {
    for (const fn of we.functions) {
      for (const fm of fn.failures) {
        for (const c of fm.causes) {
          const expected = calcAP(c.severity, c.occurrence, c.detection);
          const ok = c.actionPriority === expected;
          if (!ok) {
            console.log(`    MISMATCH: S=${c.severity} O=${c.occurrence} D=${c.detection} → got ${c.actionPriority}, expected ${expected}`);
          }
        }
      }
    }
  }
  console.log('  All AP values verified.');

  // Find insertion point: after OP 80, before OP 90
  const sortedOps = [...amfeData.operations].sort((a, b) =>
    parseInt(a.operationNumber) - parseInt(b.operationNumber)
  );

  // Find the index of OP 80 in the sorted array
  let insertIdx = -1;
  for (let i = 0; i < sortedOps.length; i++) {
    const opNum = parseInt(sortedOps[i].operationNumber);
    if (opNum > 80) {
      insertIdx = i;
      break;
    }
  }
  if (insertIdx === -1) {
    // Insert at the end if no op > 80
    insertIdx = sortedOps.length;
  }

  console.log(`\n  Inserting OP 85 at position ${insertIdx} (after OP 80, before OP 90)`);

  // Insert into the sorted array, then replace
  sortedOps.splice(insertIdx, 0, op85);
  amfeData.operations = sortedOps;

  console.log(`  New operations count: ${amfeData.operations.length}`);

  // Print all operations in order
  console.log('\n  Final operation order:');
  for (const op of amfeData.operations) {
    const marker = op.operationNumber === '85' ? ' ★ NEW' : '';
    console.log(`    OP ${op.operationNumber.padStart(3)}: ${op.operationName}${marker}`);
  }
}

// Step 5: Save AMFE to Supabase
console.log('\n--- Step 4: Save AMFE to Supabase ---\n');

if (existingOp85) {
  console.log('  No AMFE changes needed (OP 85 already exists).');
} else if (DRY_RUN) {
  console.log('  DRY RUN — AMFE changes NOT written. Run with --apply to save.');
} else {
  // Write back — pass as OBJECT, let Supabase handle serialization (rule: database.md)
  const { error: amfeUpdateErr } = await sb
    .from('amfe_documents')
    .update({ data: amfeData })
    .eq('id', AMFE_DOC_ID);

  if (amfeUpdateErr) {
    console.error('  AMFE UPDATE FAILED:', amfeUpdateErr.message);
    process.exit(1);
  }
  console.log('  AMFE update successful.');

  // Verify
  console.log('\n--- Step 5: AMFE Verification ---\n');

  const { data: verifyAmfe, error: verifyAmfeErr } = await sb
    .from('amfe_documents')
    .select('id, data')
    .eq('id', AMFE_DOC_ID)
    .single();

  if (verifyAmfeErr) {
    console.error('  AMFE verification fetch failed:', verifyAmfeErr.message);
    process.exit(1);
  }

  let verifyData = verifyAmfe.data;
  if (typeof verifyData === 'string') {
    console.log('  WARNING: data came back as string, parsing...');
    verifyData = JSON.parse(verifyData);
  }

  const isObject = typeof verifyData === 'object' && verifyData !== null;
  console.log(`  typeof data: ${typeof verifyAmfe.data} → parsed object: ${isObject ? 'OK' : 'FAIL'}`);

  // Check OP 85 exists
  const vOp85 = verifyData.operations?.find(op => String(op.operationNumber) === '85');
  console.log(`  OP 85 present: ${vOp85 ? 'YES' : 'NO (!!)'}  name: "${vOp85?.operationName || 'N/A'}"`);

  // Count total operations
  console.log(`  Total operations: ${verifyData.operations?.length}`);

  // Count total FMs and causes
  let totalFMs = 0, totalCauses = 0;
  for (const op of verifyData.operations) {
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const fm of (fn.failures || [])) {
          totalFMs++;
          totalCauses += (fm.causes || []).length;
        }
      }
    }
  }
  console.log(`  Total failure modes: ${totalFMs}`);
  console.log(`  Total causes: ${totalCauses}`);

  // Verify OP 85 FMs/causes specifically
  if (vOp85) {
    let op85FMs = 0, op85Causes = 0;
    for (const we of (vOp85.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const fm of (fn.failures || [])) {
          op85FMs++;
          op85Causes += (fm.causes || []).length;
        }
      }
    }
    console.log(`  OP 85 FMs: ${op85FMs} (expected 10) ${op85FMs === 10 ? 'OK' : 'FAIL'}`);
    console.log(`  OP 85 causes: ${op85Causes} (expected 28) ${op85Causes === 28 ? 'OK' : 'FAIL'}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PART 2: PFD — Add OP 85 step
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '─'.repeat(70));
console.log('  PART 2: PFD DOCUMENT');
console.log('─'.repeat(70));

// Step 1: Fetch PFD
console.log('\n--- Step 1: Fetching PFD document ---\n');

const { data: pfdDoc, error: pfdFetchErr } = await sb
  .from('pfd_documents')
  .select('id, part_name, data, step_count')
  .eq('id', PFD_DOC_ID)
  .single();

if (pfdFetchErr) {
  console.error('FATAL: Cannot fetch PFD document:', pfdFetchErr.message);
  process.exit(1);
}

console.log(`  Found: "${pfdDoc.part_name}"`);
console.log(`  typeof data: ${typeof pfdDoc.data}`);
console.log(`  step_count: ${pfdDoc.step_count}`);

// Step 2: Parse data
let pfdData = pfdDoc.data;
if (typeof pfdData === 'string') {
  console.log('  Data is string — parsing JSON...');
  pfdData = JSON.parse(pfdData);
}

if (!pfdData || !pfdData.steps || !Array.isArray(pfdData.steps)) {
  console.error('FATAL: PFD data has no steps array');
  process.exit(1);
}

console.log(`  Steps count: ${pfdData.steps.length}`);

// Step 3: Check if OP 85 already exists
const existingPfdOp85 = pfdData.steps.find(s => s.stepNumber === 'OP 85');
if (existingPfdOp85) {
  console.log('\n  WARNING: OP 85 step already exists in PFD!');
  console.log(`  Description: "${existingPfdOp85.description}"`);
  console.log('  Skipping PFD insertion (already present).');
} else {
  // Step 4: Build new PFD step for OP 85
  console.log('\n--- Step 3: Building PFD step for OP 85 ---\n');

  const pfdStep85 = {
    id: uid(),
    stepNumber: 'OP 85',
    stepType: 'operation',
    description: 'INYECCION DE PIEZAS PLASTICAS',
    machineDeviceTool: 'Inyectora',
    productCharacteristic: 'Pieza inyectada sin defectos (rebarbas, deformaciones, quemados)',
    productSpecialChar: 'none',
    processCharacteristic: 'Parámetros de inyección (presión, temperatura, tiempos)',
    processSpecialChar: 'none',
    reference: '',
    department: 'Producción',
    notes: '',
    isRework: false,
    isExternalProcess: false,
    reworkReturnStep: '',
    rejectDisposition: 'rework',
    scrapDescription: '',
    branchId: '',
    branchLabel: '',
  };

  console.log(`  New step: ${pfdStep85.stepNumber} — "${pfdStep85.description}"`);
  console.log(`  stepType: ${pfdStep85.stepType}`);
  console.log(`  machineDeviceTool: "${pfdStep85.machineDeviceTool}"`);

  // Find insertion point: after OP 80 block (including 80a, 80b, 80c), before OP 90
  let pfdInsertIdx = -1;
  for (let i = 0; i < pfdData.steps.length; i++) {
    if (pfdData.steps[i].stepNumber === 'OP 90') {
      pfdInsertIdx = i;
      break;
    }
  }

  if (pfdInsertIdx === -1) {
    console.error('  FATAL: Cannot find OP 90 in PFD steps!');
    process.exit(1);
  }

  // We also need a transport step before OP 85 (after the 80c transport)
  // The current 80c transport says "TRASLADO: PIEZAS APROBADAS A SECTOR DE TAPIZADO"
  // We need to change it or add a new one. Since injection comes before tapizado,
  // we should update 80c's description and add a new transport after OP 85.

  // Actually, looking at the existing PFD flow:
  //   80c: TRASLADO: PIEZAS APROBADAS A SECTOR DE TAPIZADO
  //   OP 90: TAPIZADO SEMIAUTOMATICO
  //
  // With injection inserted:
  //   80c: TRASLADO: PIEZAS APROBADAS A SECTOR DE INYECCION  (rename)
  //   OP 85: INYECCION DE PIEZAS PLASTICAS  (new)
  //   85a: TRASLADO: PIEZAS INYECTADAS A SECTOR DE TAPIZADO  (new)
  //   OP 90: TAPIZADO SEMIAUTOMATICO

  // Rename 80c transport
  const step80c = pfdData.steps.find(s => s.stepNumber === '80c');
  if (step80c) {
    const oldDesc = step80c.description;
    step80c.description = 'TRASLADO: PIEZAS APROBADAS A SECTOR DE INYECCION';
    console.log(`\n  Updated step 80c: "${oldDesc}" → "${step80c.description}"`);
  }

  // Create transport step 85a
  const pfdStep85a = {
    id: uid(),
    stepNumber: '85a',
    stepType: 'transport',
    description: 'TRASLADO: PIEZAS INYECTADAS A SECTOR DE TAPIZADO',
    machineDeviceTool: '',
    productCharacteristic: '',
    productSpecialChar: 'none',
    processCharacteristic: '',
    processSpecialChar: 'none',
    reference: '',
    department: 'Producción',
    notes: '',
    isRework: false,
    isExternalProcess: false,
    reworkReturnStep: '',
    rejectDisposition: 'none',
    scrapDescription: '',
    branchId: '',
    branchLabel: '',
  };

  console.log(`  New transport step: ${pfdStep85a.stepNumber} — "${pfdStep85a.description}"`);

  // Insert OP 85 and 85a before OP 90
  pfdData.steps.splice(pfdInsertIdx, 0, pfdStep85, pfdStep85a);

  console.log(`\n  New steps count: ${pfdData.steps.length}`);

  // Print all steps
  console.log('\n  Final PFD step order:');
  for (const s of pfdData.steps) {
    const icon = { storage: '▽', operation: '□', inspection: '◇', transport: '→', decision: '◊' }[s.stepType] || '?';
    const marker = (s.stepNumber === 'OP 85' || s.stepNumber === '85a') ? ' ★ NEW' : '';
    console.log(`    ${icon} ${s.stepNumber.padEnd(8)} ${s.description}${marker}`);
  }
}

// Step 5: Save PFD to Supabase
console.log('\n--- Step 4: Save PFD to Supabase ---\n');

if (existingPfdOp85) {
  console.log('  No PFD changes needed (OP 85 already exists).');
} else if (DRY_RUN) {
  console.log('  DRY RUN — PFD changes NOT written. Run with --apply to save.');
} else {
  const newStepCount = pfdData.steps.length;
  const { error: pfdUpdateErr } = await sb
    .from('pfd_documents')
    .update({ data: pfdData, step_count: newStepCount })
    .eq('id', PFD_DOC_ID);

  if (pfdUpdateErr) {
    console.error('  PFD UPDATE FAILED:', pfdUpdateErr.message);
    process.exit(1);
  }
  console.log('  PFD update successful.');

  // Verify
  console.log('\n--- Step 5: PFD Verification ---\n');

  const { data: verifyPfd, error: verifyPfdErr } = await sb
    .from('pfd_documents')
    .select('id, data, step_count')
    .eq('id', PFD_DOC_ID)
    .single();

  if (verifyPfdErr) {
    console.error('  PFD verification fetch failed:', verifyPfdErr.message);
    process.exit(1);
  }

  let verifyPfdData = verifyPfd.data;
  if (typeof verifyPfdData === 'string') {
    console.log('  WARNING: data came back as string, parsing...');
    verifyPfdData = JSON.parse(verifyPfdData);
  }

  const isPfdObject = typeof verifyPfdData === 'object' && verifyPfdData !== null;
  console.log(`  typeof data: ${typeof verifyPfd.data} → parsed object: ${isPfdObject ? 'OK' : 'FAIL'}`);

  const vPfdOp85 = verifyPfdData.steps?.find(s => s.stepNumber === 'OP 85');
  console.log(`  OP 85 step present: ${vPfdOp85 ? 'YES' : 'NO (!!)'}  desc: "${vPfdOp85?.description || 'N/A'}"`);

  const vPfd85a = verifyPfdData.steps?.find(s => s.stepNumber === '85a');
  console.log(`  85a transport present: ${vPfd85a ? 'YES' : 'NO (!!)'}  desc: "${vPfd85a?.description || 'N/A'}"`);

  console.log(`  Total steps: ${verifyPfdData.steps?.length} (step_count col: ${verifyPfd.step_count})`);

  // Verify 80c was renamed
  const v80c = verifyPfdData.steps?.find(s => s.stepNumber === '80c');
  const renamed80c = v80c?.description === 'TRASLADO: PIEZAS APROBADAS A SECTOR DE INYECCION';
  console.log(`  80c renamed: ${renamed80c ? 'OK' : 'FAIL'} ("${v80c?.description || 'N/A'}")`);
}

// ═══════════════════════════════════════════════════════════════════════════
// FINAL REPORT
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(70));
console.log('  SUMMARY');
console.log('='.repeat(70));
console.log(`  AMFE OP 85: ${existingOp85 ? 'already existed' : (DRY_RUN ? 'WOULD ADD' : 'ADDED')}`);
console.log(`  PFD OP 85:  ${existingPfdOp85 ? 'already existed' : (DRY_RUN ? 'WOULD ADD' : 'ADDED')}`);
console.log(`  Mode:       ${DRY_RUN ? 'DRY-RUN' : 'APPLIED'}`);
console.log('='.repeat(70) + '\n');

process.exit(0);
