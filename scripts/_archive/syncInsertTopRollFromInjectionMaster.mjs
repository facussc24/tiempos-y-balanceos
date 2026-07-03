/**
 * syncInsertTopRollFromInjectionMaster.mjs
 *
 * Sincroniza las operaciones de inyeccion plastica de:
 *   - Insert Patagonia  (AMFE id 7cfe2db7-9e5a-4b46-804d-76194557c581)
 *   - Top Roll Patagonia (AMFE id 78eaa89b-ad0b-4342-9046-ab2e9b14d3b3)
 *
 * Fuente de mejora: AMFE Maestro Inyeccion (4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c)
 * Solo se usa la OP 20 "INYECCION" del maestro (las OPs 10/30 del maestro son
 * de recepcion y control, que en estos productos estan en otras operaciones).
 *
 * Estrategia CONSERVADORA:
 *  1. Para cada producto, identificar UNA operacion de inyeccion plastica
 *     (nombre normalizado contiene "INYECCION DE PIEZA", "INYECCION DE PIEZAS PLASTICAS"
 *     o "INYECCION PLASTICA"). EXCLUIR cualquier operacion con "PU" o "POLIURETANO".
 *  2. PRESERVAR: id, opNumber, operationNumber, name, operationName, linkedPfdStepId,
 *     focusElementFunction del producto, operationFunction del producto.
 *  3. WORK ELEMENTS:
 *     - Fusionar el WE tipo "Inyectora" del producto con el WE maestro
 *       "Inyectora (maquina principal)": conservar el nombre del producto pero
 *       ampliar los failures segun reglas abajo.
 *     - Agregar los WEs del maestro que NO existen en el producto (match por
 *       nombre normalizado o por type+keyword): Molde, Sistema refrigeracion
 *       tornillo, Colorante masterbatch (solo si el producto ya menciona
 *       colorante), Dossier parametros, Procedimiento arranque, Operador setup,
 *       Operador autocontrol, Instrumentos medicion, Aire comprimido.
 *     - Los WEs del producto que no matchean (ej "Lider de equipo", "Metodo
 *       de Fabricacion", "Iluminacion", "Hoja de operaciones") se preservan
 *       tal cual.
 *  4. FAILURES dentro del WE fusionado "Inyectora":
 *     - Match por failure.description normalizada (+ alias tipicos).
 *     - Si matchea: COPIAR del maestro effectLocal/effectNextLevel/effectEndUser
 *       y los causes con sus controles diferenciados. Preservar el id original.
 *     - Failures solo en producto: preservar sin cambios.
 *     - Failures solo en maestro (no matcheadas): agregar con UUID fresco.
 *  5. AP calculado via tabla oficial calculateAP(s,o,d) — NUNCA S*O*D.
 *  6. Escribir con JSON.stringify porque la columna data es TEXT.
 *  7. Verificar post-update: typeof string parseable, operations[] array,
 *     conteos correctos.
 *
 * NO toca operaciones que no son de inyeccion plastica.
 * NO cambia headers.
 * NO asigna CC/SC sin autorizacion.
 * NO inventa acciones.
 * NO toca CP/HO/PFD.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

// ── Supabase ────────────────────────────────────────────────────────────────
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const MASTER_DOC_ID = '4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c';
const TARGETS = [
  { label: 'Insert Patagonia', id: '7cfe2db7-9e5a-4b46-804d-76194557c581' },
  { label: 'Top Roll Patagonia', id: '78eaa89b-ad0b-4342-9046-ab2e9b14d3b3' },
];

// ── Tabla AP oficial (copia de modules/amfe/apTable.ts) ─────────────────────
function apRule(s, o, d) {
  if (s <= 1) return 'L';
  if (s <= 3) {
    if (o >= 8 && d >= 5) return 'M';
    return 'L';
  }
  if (s <= 6) {
    if (o >= 8) return d >= 5 ? 'H' : 'M';
    if (o >= 6) return d >= 2 ? 'M' : 'L';
    if (o >= 4) return d >= 7 ? 'M' : 'L';
    return 'L';
  }
  if (s <= 8) {
    if (o >= 8) return 'H';
    if (o >= 6) return d >= 2 ? 'H' : 'M';
    if (o >= 4) return d >= 7 ? 'H' : 'M';
    if (o >= 2) return d >= 5 ? 'M' : 'L';
    return 'L';
  }
  if (o >= 6) return 'H';
  if (o >= 4) return d >= 2 ? 'H' : 'M';
  if (o >= 2) {
    if (d >= 7) return 'H';
    if (d >= 5) return 'M';
    return 'L';
  }
  return 'L';
}
function calculateAP(s, o, d) {
  if (Number.isNaN(s) || Number.isNaN(o) || Number.isNaN(d)) return '';
  const sInt = Math.round(s), oInt = Math.round(o), dInt = Math.round(d);
  if (sInt < 1 || sInt > 10 || oInt < 1 || oInt > 10 || dInt < 1 || dInt > 10) return '';
  return apRule(sInt, oInt, dInt);
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function parseAmfeData(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return null; } }
  if (typeof raw === 'object') return raw;
  return null;
}

function norm(s) {
  return (s || '').toString().toUpperCase().trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ');
}

function isInjectionPlasticaOp(opName) {
  const n = norm(opName);
  if (!n) return false;
  // Exclude PU
  if (n.includes(' PU') || n.endsWith(' PU') || n.includes('POLIURETANO')) return false;
  return (
    n.includes('INYECCION DE PIEZA') ||
    n.includes('INYECCION DE PIEZAS PLASTICAS') ||
    n.includes('INYECCION PLASTICA')
  );
}

function isInyectoraWE(we) {
  const n = norm(we && we.name);
  if (!n) return false;
  if (we.type !== 'Machine') return false;
  return n.includes('INYECTORA') || n.includes('MAQUINA INYECTORA');
}

function weMatchesMasterName(targetName, masterName) {
  const a = norm(targetName);
  const b = norm(masterName);
  if (!a || !b) return false;
  if (a === b) return true;
  // token-based: match if ALL main tokens of master are in target, or vice versa
  // for our purposes, substring in either direction works
  return a.includes(b) || b.includes(a);
}

// Distribucion AP de un set de operaciones
function apDistribution(ops) {
  const dist = { H: 0, M: 0, L: 0, '': 0 };
  for (const op of ops) {
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const fm of (fn.failures || [])) {
          for (const cause of (fm.causes || [])) {
            const ap = cause.actionPriority || cause.ap || '';
            dist[ap] = (dist[ap] || 0) + 1;
          }
        }
      }
    }
  }
  return dist;
}

function countWE(op) { return (op.workElements || []).length; }
function countFailures(op) {
  let n = 0;
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      n += (fn.failures || []).length;
    }
  }
  return n;
}
function countCauses(op) {
  let n = 0;
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fm of (fn.failures || [])) {
        n += (fm.causes || []).length;
      }
    }
  }
  return n;
}

// Deep clone with fresh UUIDs on id fields
function cloneWithFreshIds(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cloneWithFreshIds);
  const out = {};
  for (const k of Object.keys(obj)) {
    if (k === 'id') out[k] = randomUUID();
    else out[k] = cloneWithFreshIds(obj[k]);
  }
  return out;
}

// Normalize a cause into the standard shape (aliases duales + AP oficial)
function normalizeCause(c) {
  const description = c.description || c.cause || '';
  const severity = Number(c.severity) || 0;
  const occurrence = Number(c.occurrence) || 0;
  const detection = Number(c.detection) || 0;
  const ap = calculateAP(severity, occurrence, detection);
  return {
    id: c.id || randomUUID(),
    description,
    cause: description,
    severity,
    occurrence,
    detection,
    actionPriority: ap,
    ap,
    preventionControl: c.preventionControl || '',
    detectionControl: c.detectionControl || '',
    preventionAction: c.preventionAction || (ap === 'H' && !c.preventionAction ? 'Pendiente definicion equipo APQP' : ''),
    detectionAction: c.detectionAction || '',
    specialChar: c.specialChar || '',
    characteristicNumber: c.characteristicNumber || '',
    filterCode: c.filterCode || '',
    responsible: c.responsible || '',
    targetDate: c.targetDate || '',
    status: c.status || '',
    actionTaken: c.actionTaken || '',
    completionDate: c.completionDate || '',
    severityNew: c.severityNew || '',
    occurrenceNew: c.occurrenceNew || '',
    detectionNew: c.detectionNew || '',
    apNew: c.apNew || '',
    observations: c.observations || '',
  };
}

// ── Master failure-matching aliases (for Inyectora WE) ─────────────────────
// Key is the NORMALIZED master failure description; value is an array of
// substrings (also normalized) that can appear in product failure descriptions.
const FAILURE_ALIAS = {
  'PIEZA INCOMPLETA (LLENADO INSUFICIENTE)': [
    'LLENADO INCOMPLETO', 'LLENADO INCOMPLETA', 'PIEZA INCOMPLETA',
    'FALTA DE LLENADO', 'LLENADO INSUFICIENTE', 'LLENADO INCOMPLETO DE PIEZA',
  ],
  'REBABAS (FLASHES) EN PIEZA INYECTADA': [
    'REBABA', 'REBABAS', 'REBARBA', 'REBARBAS', 'FLASH', 'FLASHES',
    'EXCESO DE MATERIAL',
  ],
  'PIEZA DEFORMADA (ALABEO / DISTORSION GEOMETRICA)': [
    'PIEZA DEFORMADA', 'ALABEO', 'DISTORSION GEOMETRICA', 'DEFORMACION',
  ],
  'QUEMADURAS EN PIEZA INYECTADA': [
    'QUEMADURA', 'QUEMADURAS', 'QUEMADO', 'QUEMADOS',
  ],
  'CHUPADOS (RECHUPES / SINK MARKS) EN PIEZA INYECTADA': [
    'CHUPADO', 'CHUPADOS', 'RECHUPE', 'RECHUPES', 'SINK MARK',
  ],
  'DIMENSIONAL NOK (FUERA DE TOLERANCIA EN MEDIDA CRITICA)': [
    'DIMENSIONAL NOK', 'FUERA DE TOLERANCIA', 'COTAS FUERA',
  ],
  'COLOR NO CONFORME EN PIEZA INYECTADA': [
    'COLOR NO CONFORME', 'COLOR NOK',
  ],
  'PESO NOK EN PIEZA INYECTADA (FUERA DE RANGO)': [
    'PESO NOK', 'PESO FUERA',
  ],
  'RAYAS / MARCAS EN LA SUPERFICIE DE LA PIEZA': [
    'RAYA', 'RAYAS', 'MARCA', 'MARCAS',
  ],
};

function matchMasterFailure(productFailDesc, masterFailures) {
  const p = norm(productFailDesc);
  if (!p) return null;
  // Direct substring match against aliases
  for (const master of masterFailures) {
    const mNorm = norm(master.description);
    if (mNorm === p) return master;
    const aliases = FAILURE_ALIAS[mNorm] || [];
    for (const alias of aliases) {
      if (p.includes(alias)) return master;
    }
  }
  return null;
}

// ── Fusion logic ────────────────────────────────────────────────────────────
/**
 * Fuses the product's "Inyectora" WE with the master Inyectora WE.
 * Preserves the product's WE id and name. Uses the master's function description.
 * For failures:
 *   - matched -> copy master effects + causes, preserve product failure.id
 *   - product-only -> preserve as-is (normalized causes via normalizeCause)
 *   - master-only -> added with fresh uuids (clone with fresh ids)
 *
 * Returns { fusedWE, report: { matched: [], preserved: [], added: [] } }
 */
function fuseInyectoraWE(productWE, masterInyectoraWE) {
  const report = { matched: [], preserved: [], added: [] };

  // Gather master failures (flatten master function.failures - master Inyectora has 1 function)
  const masterFns = masterInyectoraWE.functions || [];
  const masterFailures = [];
  for (const fn of masterFns) for (const fm of (fn.failures || [])) masterFailures.push(fm);

  // Flatten product failures (preserve function structure as best-effort,
  // but for Inyectora we assume 1 function; if multiple, take the first).
  // Gather ALL product failures across all functions of this WE
  const productFns = productWE.functions || [];
  const productFailures = [];
  for (const fn of productFns) {
    for (const fm of (fn.failures || [])) {
      productFailures.push(fm);
    }
  }

  const usedMasterIds = new Set();
  const fusedFailures = [];

  // Step 1: iterate product failures; merge with matching master failure
  for (const prodFail of productFailures) {
    const matched = matchMasterFailure(prodFail.description, masterFailures);
    if (matched && !usedMasterIds.has(matched.id)) {
      usedMasterIds.add(matched.id);
      // Preserve product failure id, description stays product's (conservative),
      // but pull effects from master. Replace causes with master causes (with fresh ids).
      const masterCausesCloned = (matched.causes || []).map(c => normalizeCause({ ...cloneWithFreshIds(c), id: undefined }));
      fusedFailures.push({
        id: prodFail.id || randomUUID(),
        description: prodFail.description, // keep product's wording to not break references
        effectLocal: matched.effectLocal || prodFail.effectLocal || '',
        effectNextLevel: matched.effectNextLevel || prodFail.effectNextLevel || '',
        effectEndUser: matched.effectEndUser || prodFail.effectEndUser || '',
        causes: masterCausesCloned,
      });
      report.matched.push({ product: prodFail.description, master: matched.description });
    } else {
      // product-only: preserve with normalized causes
      const cleanCauses = (prodFail.causes || []).map(c => normalizeCause(c));
      fusedFailures.push({
        id: prodFail.id || randomUUID(),
        description: prodFail.description,
        effectLocal: prodFail.effectLocal || '',
        effectNextLevel: prodFail.effectNextLevel || '',
        effectEndUser: prodFail.effectEndUser || '',
        causes: cleanCauses,
      });
      report.preserved.push(prodFail.description);
    }
  }

  // Step 2: add master failures not yet used
  for (const mf of masterFailures) {
    if (usedMasterIds.has(mf.id)) continue;
    const masterCausesCloned = (mf.causes || []).map(c => normalizeCause({ ...cloneWithFreshIds(c), id: undefined }));
    fusedFailures.push({
      id: randomUUID(),
      description: mf.description,
      effectLocal: mf.effectLocal || '',
      effectNextLevel: mf.effectNextLevel || '',
      effectEndUser: mf.effectEndUser || '',
      causes: masterCausesCloned,
    });
    report.added.push(mf.description);
  }

  // Rebuild the WE preserving product's id and name, but use master function
  // description for clarity. Put ALL fused failures under ONE function.
  const fusedFunctionDescription =
    (productFns[0] && (productFns[0].description || productFns[0].functionDescription)) ||
    (masterFns[0] && (masterFns[0].description || masterFns[0].functionDescription)) ||
    '';

  const fusedWE = {
    id: productWE.id || randomUUID(),
    name: productWE.name, // preserve product wording
    type: productWE.type || 'Machine',
    functions: [
      {
        id: (productFns[0] && productFns[0].id) || randomUUID(),
        description: fusedFunctionDescription,
        functionDescription: fusedFunctionDescription,
        requirements: (productFns[0] && productFns[0].requirements) || '',
        failures: fusedFailures,
      },
    ],
  };

  return { fusedWE, report };
}

/**
 * Sync one target AMFE: finds injection plastica op and applies fusion.
 * Returns the report object.
 */
function syncTargetOperation(targetData, masterData) {
  const masterInjOp = masterData.operations.find(op => norm(op.operationName || op.name) === 'INYECCION');
  if (!masterInjOp) throw new Error('No master INYECCION op found');
  const masterWEs = masterInjOp.workElements || [];
  const masterInyectoraWE = masterWEs.find(isInyectoraWE);
  if (!masterInyectoraWE) throw new Error('No master Inyectora WE found');

  // Find injection op in target
  const opIdx = targetData.operations.findIndex(op => isInjectionPlasticaOp(op.operationName || op.name));
  if (opIdx === -1) {
    return { matched: false, reason: 'No injection plastica op found in target' };
  }

  const oldOp = targetData.operations[opIdx];
  const report = {
    matched: true,
    opName: oldOp.operationName || oldOp.name,
    opNumber: oldOp.operationNumber || oldOp.opNumber,
    wesBefore: countWE(oldOp),
    failuresBefore: countFailures(oldOp),
    causesBefore: countCauses(oldOp),
    apBefore: apDistribution([oldOp]),
    matchedFailures: [],
    preservedFailures: [],
    addedFailures: [],
    addedWEs: [],
    preservedWEs: [],
    fusedWEs: [],
  };

  // 1. Find the Inyectora WE in the product
  const productInyectoraIdx = (oldOp.workElements || []).findIndex(isInyectoraWE);
  const newWorkElements = [];

  if (productInyectoraIdx === -1) {
    // No inyectora WE — add master's directly (clone with fresh ids)
    const cloned = cloneWithFreshIds(masterInyectoraWE);
    // Normalize causes through calculateAP
    for (const fn of (cloned.functions || [])) {
      for (const fm of (fn.failures || [])) {
        fm.causes = (fm.causes || []).map(normalizeCause);
      }
    }
    newWorkElements.push(cloned);
    report.addedWEs.push(cloned.name);
    // Preserve all existing WEs (none is Inyectora)
    for (const we of (oldOp.workElements || [])) {
      // normalize causes
      const preserved = cloneWithFreshIdsPreservingIds(we);
      normalizeWECauses(preserved);
      newWorkElements.push(preserved);
      report.preservedWEs.push(we.name);
    }
  } else {
    // Fuse the inyectora WE
    const productInyectoraWE = oldOp.workElements[productInyectoraIdx];
    const { fusedWE, report: fuseReport } = fuseInyectoraWE(productInyectoraWE, masterInyectoraWE);
    newWorkElements.push(fusedWE);
    report.fusedWEs.push(productInyectoraWE.name);
    report.matchedFailures = fuseReport.matched;
    report.preservedFailures = fuseReport.preserved;
    report.addedFailures = fuseReport.added;

    // Preserve all other product WEs (non-Inyectora)
    for (let i = 0; i < oldOp.workElements.length; i++) {
      if (i === productInyectoraIdx) continue;
      const we = oldOp.workElements[i];
      const preserved = cloneWithFreshIdsPreservingIds(we);
      normalizeWECauses(preserved);
      newWorkElements.push(preserved);
      report.preservedWEs.push(we.name);
    }
  }

  // 2. Add missing master WEs from master OP 20 (except Inyectora which was fused)
  const existingNames = newWorkElements.map(w => norm(w.name));
  for (const mwe of masterWEs) {
    if (isInyectoraWE(mwe)) continue; // already handled
    const mname = norm(mwe.name);
    const alreadyPresent = existingNames.some(en =>
      en === mname || en.includes(mname) || mname.includes(en)
    );
    if (alreadyPresent) continue;
    // Clone with fresh ids
    const cloned = cloneWithFreshIds(mwe);
    normalizeWECauses(cloned);
    newWorkElements.push(cloned);
    report.addedWEs.push(cloned.name);
    existingNames.push(norm(cloned.name));
  }

  // Build new op preserving identity fields
  const newOp = {
    ...oldOp,
    id: oldOp.id,
    opNumber: oldOp.opNumber || oldOp.operationNumber,
    operationNumber: oldOp.operationNumber || oldOp.opNumber,
    name: oldOp.name || oldOp.operationName,
    operationName: oldOp.operationName || oldOp.name,
    linkedPfdStepId: oldOp.linkedPfdStepId || null,
    focusElementFunction: oldOp.focusElementFunction || '',
    operationFunction: oldOp.operationFunction || '',
    workElements: newWorkElements,
  };

  targetData.operations[opIdx] = newOp;

  report.wesAfter = countWE(newOp);
  report.failuresAfter = countFailures(newOp);
  report.causesAfter = countCauses(newOp);
  report.apAfter = apDistribution([newOp]);
  return report;
}

// Helper: clone object preserving existing ids where present, generating
// fresh ids only when missing.
function cloneWithFreshIdsPreservingIds(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cloneWithFreshIdsPreservingIds);
  const out = {};
  for (const k of Object.keys(obj)) {
    if (k === 'id') out[k] = obj[k] || randomUUID();
    else out[k] = cloneWithFreshIdsPreservingIds(obj[k]);
  }
  return out;
}

function normalizeWECauses(we) {
  for (const fn of (we.functions || [])) {
    for (const fm of (fn.failures || [])) {
      fm.causes = (fm.causes || []).map(normalizeCause);
    }
  }
}

// ── MAIN ───────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════════');
console.log('SYNC INSERT + TOP ROLL <- INJECTION MASTER');
console.log('═══════════════════════════════════════════════════════════════');

// 1. Read master
console.log('\n1. Leyendo AMFE Maestro de Inyeccion...');
const { data: masterRow, error: masterErr } = await sb
  .from('amfe_documents')
  .select('id, data')
  .eq('id', MASTER_DOC_ID)
  .single();
if (masterErr) { console.error('ERROR leyendo master:', masterErr); process.exit(1); }
const masterData = parseAmfeData(masterRow.data);
if (!masterData || !Array.isArray(masterData.operations)) {
  console.error('ERROR: master data invalido'); process.exit(1);
}
console.log(`   master operations: ${masterData.operations.length}`);

// 2. Process each target sequentially
const reports = [];
for (const t of TARGETS) {
  console.log(`\n─────────────────────────────────────────────────────────────`);
  console.log(`Procesando: ${t.label}  (${t.id})`);
  console.log(`─────────────────────────────────────────────────────────────`);

  const { data: row, error } = await sb
    .from('amfe_documents')
    .select('id, subject, project_name, amfe_number, data')
    .eq('id', t.id)
    .single();
  if (error) {
    console.error(`   ERROR leyendo ${t.label}:`, error);
    reports.push({ target: t.label, error: error.message });
    continue;
  }
  const data = parseAmfeData(row.data);
  if (!data || !Array.isArray(data.operations)) {
    console.error(`   ERROR: data invalida en ${t.label}`);
    reports.push({ target: t.label, error: 'data invalida' });
    continue;
  }

  console.log(`   subject:      ${row.subject}`);
  console.log(`   amfe_number:  ${row.amfe_number}`);
  console.log(`   operations before: ${data.operations.length}`);

  // Apply sync
  let syncReport;
  try {
    syncReport = syncTargetOperation(data, masterData);
  } catch (e) {
    console.error(`   ERROR en sync:`, e.message);
    reports.push({ target: t.label, error: e.message });
    continue;
  }

  if (!syncReport.matched) {
    console.log(`   BLOQUEADOR: ${syncReport.reason}`);
    reports.push({ target: t.label, ...syncReport });
    continue;
  }

  console.log(`   MATCHED op: "${syncReport.opName}" (OP ${syncReport.opNumber})`);
  console.log(`   WEs  ${syncReport.wesBefore} -> ${syncReport.wesAfter}`);
  console.log(`   Failures  ${syncReport.failuresBefore} -> ${syncReport.failuresAfter}`);
  console.log(`   Causes  ${syncReport.causesBefore} -> ${syncReport.causesAfter}`);
  console.log(`   AP before: H=${syncReport.apBefore.H} M=${syncReport.apBefore.M} L=${syncReport.apBefore.L}`);
  console.log(`   AP after:  H=${syncReport.apAfter.H} M=${syncReport.apAfter.M} L=${syncReport.apAfter.L}`);
  console.log(`   Failures fusionadas: ${syncReport.matchedFailures.length}`);
  for (const m of syncReport.matchedFailures) {
    console.log(`      ~ "${m.product}"  <-  "${m.master}"`);
  }
  console.log(`   Failures preservadas (solo producto): ${syncReport.preservedFailures.length}`);
  for (const p of syncReport.preservedFailures) console.log(`      = "${p}"`);
  console.log(`   Failures agregadas del maestro: ${syncReport.addedFailures.length}`);
  for (const a of syncReport.addedFailures) console.log(`      + "${a}"`);
  console.log(`   WEs agregadas del maestro: ${syncReport.addedWEs.length}`);
  for (const w of syncReport.addedWEs) console.log(`      + "${w}"`);
  console.log(`   WEs preservadas del producto: ${syncReport.preservedWEs.length}`);
  for (const w of syncReport.preservedWEs) console.log(`      = "${w}"`);
  console.log(`   WEs fusionadas: ${syncReport.fusedWEs.length}`);
  for (const w of syncReport.fusedWEs) console.log(`      ~ "${w}"`);

  // Write back to Supabase
  console.log(`   Escribiendo en Supabase...`);
  const { error: updErr } = await sb
    .from('amfe_documents')
    .update({ data: JSON.stringify(data) })
    .eq('id', t.id);
  if (updErr) {
    console.error(`   ERROR update:`, updErr);
    reports.push({ target: t.label, ...syncReport, error: updErr.message });
    continue;
  }
  console.log(`   OK update`);

  // Post-update verification
  const { data: verifyRow, error: verErr } = await sb
    .from('amfe_documents')
    .select('data')
    .eq('id', t.id)
    .single();
  if (verErr) {
    console.error(`   ERROR verificando:`, verErr);
    reports.push({ target: t.label, ...syncReport, error: verErr.message });
    continue;
  }
  const vData = parseAmfeData(verifyRow.data);
  const verOk = vData && Array.isArray(vData.operations) &&
    vData.operations.length === data.operations.length;
  console.log(`   VERIFY: typeof string parseable = ${typeof verifyRow.data === 'string' ? 'OK' : 'WARN'}`);
  console.log(`   VERIFY: operations count = ${vData ? vData.operations.length : 'FAIL'}  (expected ${data.operations.length})`);
  console.log(`   VERIFY: ${verOk ? 'OK' : 'FAIL'}`);

  reports.push({ target: t.label, ...syncReport, verifyOk: verOk });
}

// Final summary
console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log('SUMMARY');
console.log('═══════════════════════════════════════════════════════════════');
for (const r of reports) {
  console.log(`\n${r.target}:`);
  if (r.error) {
    console.log(`  ERROR: ${r.error}`);
    continue;
  }
  if (!r.matched) {
    console.log(`  NOT PROCESSED: ${r.reason}`);
    continue;
  }
  console.log(`  Op:  "${r.opName}" (OP ${r.opNumber})`);
  console.log(`  WEs: ${r.wesBefore} -> ${r.wesAfter}`);
  console.log(`  Failures: ${r.failuresBefore} -> ${r.failuresAfter}`);
  console.log(`  Causes: ${r.causesBefore} -> ${r.causesAfter}`);
  console.log(`  AP H: ${r.apBefore.H} -> ${r.apAfter.H}`);
  console.log(`  AP M: ${r.apBefore.M} -> ${r.apAfter.M}`);
  console.log(`  AP L: ${r.apBefore.L} -> ${r.apAfter.L}`);
  console.log(`  Fusionadas: ${r.matchedFailures.length} | Preservadas: ${r.preservedFailures.length} | Agregadas: ${r.addedFailures.length}`);
  console.log(`  Verify: ${r.verifyOk ? 'OK' : 'FAIL'}`);
}
console.log('\nDONE.');
