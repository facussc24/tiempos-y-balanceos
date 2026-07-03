/**
 * recalibrateInjectionMaster.mjs
 *
 * Recalibra S/O/D del AMFE Maestro de Inyeccion segun las observaciones de los auditores
 * (3 auditores coincidieron: demasiado conservador, 0 AP=H / 1 AP=M / 64 AP=L).
 * Fak autorizo recalibrar.
 *
 * Reglas aplicadas (solo a las causas que matchean, NO se tocan las otras):
 *  1. Dimensional NOK (impide montaje VWA): S 6 -> 7
 *  2. Humedad residual / secado insuficiente: O 2 -> 3
 *  3. Boca de alimentacion atascada por refrigeracion del tornillo: D 6 -> 8
 *  4. Material incorrecto / certificado del proveedor: S 6 -> 7
 *  5. Linea de junta desgastada del molde: O 2 -> 3
 *  (Quemaduras/rebabas visibles NO se tocan — apariencia, no funcional)
 *
 * Despues re-propaga los nuevos valores a los 7 productos ya sincronizados por
 * match de causa.description con el maestro.
 *
 * IMPORTANTE (feedback_amfe_data_is_text.md): amfe_documents.data es TEXT,
 * usar JSON.parse / JSON.stringify explicitos.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ── Supabase connection ────────────────────────────────────────────────────
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
const PRODUCT_AMFE_NUMBERS = [
  'VWA-PAT-IPPADS-001',
  'AMFE-INS-PAT',
  'AMFE-TR-PAT',
  'AMFE-ARM-PAT',
  'AMFE-HF-PAT',
  'AMFE-HRC-PAT',
  'AMFE-HRO-PAT',
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

// ── Matching helpers (case insensitive, sin diacriticos) ────────────────────
function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}
function contains(haystack, ...needles) {
  const h = normalize(haystack);
  return needles.some(n => h.includes(normalize(n)));
}

// ── Reglas de recalibracion ─────────────────────────────────────────────────
//
// Cada regla toma el texto del failure + texto de la causa y decide si aplicar
// la bump. Retorna { s, o, d } con los nuevos valores (o los originales si no
// aplica). La regla 5 (quemaduras/rebabas apariencia) NO toca nada.
//
function applyRules(failureDesc, cause) {
  let { severity: s, occurrence: o, detection: d } = cause;
  const appliedReasons = [];

  // Regla 1: Dimensional NOK (impide montaje VWA) — subir S 6 -> 7
  if (
    contains(failureDesc, 'dimensional', 'dimension', 'fuera de tolerancia')
  ) {
    if (s === 6) { s = 7; appliedReasons.push('R1-Dimensional S6->7'); }
  }

  // Regla 2: Humedad residual / secado insuficiente — subir O 2 -> 3
  if (
    contains(failureDesc, 'humedad', 'secado insuficiente', 'absorcion de humedad') ||
    contains(cause.description || cause.cause, 'humedad', 'secado insuficiente', 'absorcion de humedad')
  ) {
    if (o === 2) { o = 3; appliedReasons.push('R2-Humedad O2->3'); }
  }

  // Regla 3: Boca de alimentacion atascada por refrigeracion del tornillo — subir D 6 -> 8
  if (
    contains(failureDesc, 'boca de alimentacion', 'garganta', 'refrigeracion del tornillo', 'pasta de material') ||
    contains(cause.description || cause.cause, 'refrigeracion de garganta', 'refrigeracion del tornillo', 'boca de alimentacion', 'garganta')
  ) {
    if (d === 6) { d = 8; appliedReasons.push('R3-BocaAlim D6->8'); }
  }

  // Regla 4: Material incorrecto / certificado — subir S 6 -> 7
  if (
    contains(failureDesc, 'certificado', 'material entregado no corresponde', 'lote contaminado', 'material incorrecto') ||
    contains(cause.description || cause.cause, 'certificado', 'material incorrecto', 'lote contaminado')
  ) {
    if (s === 6) { s = 7; appliedReasons.push('R4-Certificado S6->7'); }
  }

  // Regla 6: Linea de junta desgastada del molde — subir O 2 -> 3
  if (
    contains(failureDesc, 'linea de junta', 'molde desgastado', 'linea de junta del molde') ||
    contains(cause.description || cause.cause, 'linea de junta', 'molde desgastado')
  ) {
    if (o === 2) { o = 3; appliedReasons.push('R6-LineaJunta O2->3'); }
  }

  return { s, o, d, appliedReasons };
}

// ── Helpers para AP counts ──────────────────────────────────────────────────
function countAP(doc, opFilter = null) {
  const counts = { H: 0, M: 0, L: 0, empty: 0, total: 0 };
  for (const op of doc.operations || []) {
    if (opFilter && !opFilter(op)) continue;
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const fm of (fn.failures || [])) {
          for (const c of (fm.causes || [])) {
            counts.total++;
            const ap = c.ap || c.actionPriority || '';
            if (ap === 'H') counts.H++;
            else if (ap === 'M') counts.M++;
            else if (ap === 'L') counts.L++;
            else counts.empty++;
          }
        }
      }
    }
  }
  return counts;
}

// ── Paso 1: Recalibrar maestro ──────────────────────────────────────────────
console.log('========================================');
console.log('PASO 1: Recalibrar AMFE Maestro Inyeccion');
console.log('========================================');
const { data: masterRow, error: masterErr } = await sb
  .from('amfe_documents')
  .select('id, amfe_number, data')
  .eq('id', MASTER_DOC_ID)
  .single();
if (masterErr) { console.error('Error leyendo maestro:', masterErr); process.exit(1); }
if (typeof masterRow.data !== 'string') {
  console.error(`ERROR: maestro.data es ${typeof masterRow.data}, se esperaba string`);
  process.exit(1);
}
const masterDoc = JSON.parse(masterRow.data);
const masterBefore = countAP(masterDoc);
console.log(`Maestro AP antes: H=${masterBefore.H}  M=${masterBefore.M}  L=${masterBefore.L}  empty=${masterBefore.empty}  total=${masterBefore.total}`);

// Build causeChanges registry: causeId -> {newS, newO, newD, newAP, reason, description}
const causeChanges = new Map();
let modifiedCount = 0;
const modificationsLog = [];

for (const op of masterDoc.operations || []) {
  const opNum = op.operationNumber || op.opNumber;
  if (!['10', '20', '30'].includes(String(opNum))) continue;
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fm of (fn.failures || [])) {
        let maxSeverityInFailure = 0;
        const originalFailureMaxS = Math.max(0, ...(fm.causes || []).map(c => c.severity || 0));
        for (const c of (fm.causes || [])) {
          const { s, o, d, appliedReasons } = applyRules(fm.description || '', c);
          if (s !== c.severity || o !== c.occurrence || d !== c.detection) {
            const oldAP = c.ap || c.actionPriority || '';
            const newAP = calculateAP(s, o, d);

            // Actualizar causa preservando id
            c.severity = s;
            c.occurrence = o;
            c.detection = d;
            c.ap = newAP;
            c.actionPriority = newAP;

            // Si la nueva AP es H o M y preventionAction vacio, poner pendiente
            if ((newAP === 'H' || newAP === 'M') && !(c.preventionAction || '').trim()) {
              c.preventionAction = 'Pendiente definicion equipo APQP';
            }

            causeChanges.set(c.id, {
              description: c.description || c.cause,
              failureDesc: fm.description,
              opNum: String(opNum),
              oldS: c.severity !== s ? null : c.severity, // preserved below
              newS: s, newO: o, newD: d,
              oldAP, newAP,
              reasons: appliedReasons,
            });
            modificationsLog.push({
              causeId: c.id,
              op: String(opNum),
              cause: (c.description || c.cause || '').slice(0, 80),
              s, o, d, ap: newAP,
              reasons: appliedReasons.join(', '),
            });
            modifiedCount++;
          }
          maxSeverityInFailure = Math.max(maxSeverityInFailure, c.severity || 0);
        }
        // Actualizar fm.severity si la S maxima de las causas subio
        if (maxSeverityInFailure > (fm.severity || 0)) {
          fm.severity = maxSeverityInFailure;
        }
      }
    }
  }
}

const masterAfter = countAP(masterDoc);
console.log(`Maestro AP DESPUES: H=${masterAfter.H}  M=${masterAfter.M}  L=${masterAfter.L}  empty=${masterAfter.empty}  total=${masterAfter.total}`);
console.log(`Causas modificadas: ${modifiedCount}`);
console.log();
console.log('Detalle de modificaciones:');
for (const m of modificationsLog) {
  console.log(`  OP${m.op} | S${m.s} O${m.o} D${m.d} AP=${m.ap} | ${m.reasons}`);
  console.log(`    causa: ${m.cause}`);
}
console.log();

// Guardar maestro
const masterJson = JSON.stringify(masterDoc);
const { error: masterUpdErr } = await sb
  .from('amfe_documents')
  .update({ data: masterJson })
  .eq('id', MASTER_DOC_ID);
if (masterUpdErr) { console.error('Error guardando maestro:', masterUpdErr); process.exit(1); }

// Verificar post-save
const { data: verifyMasterRow } = await sb
  .from('amfe_documents')
  .select('data')
  .eq('id', MASTER_DOC_ID)
  .single();
if (typeof verifyMasterRow.data !== 'string') {
  console.error('ERROR: tras guardar, maestro.data no es string');
  process.exit(1);
}
const verifyMasterDoc = JSON.parse(verifyMasterRow.data);
if (!Array.isArray(verifyMasterDoc.operations)) {
  console.error('ERROR: tras guardar, maestro.operations roto');
  process.exit(1);
}
console.log(`OK Maestro guardado + verificado: typeof data === "string" y operations es array (${verifyMasterDoc.operations.length})`);
console.log();

// Build lookup: description normalizada -> nuevos valores
// (usamos description porque entre maestro y producto los ids son distintos — al sincronizar
// se generan nuevos uuids)
const masterCauseByDesc = new Map();
for (const [, change] of causeChanges) {
  const key = normalize(change.description);
  masterCauseByDesc.set(key, change);
}

// ── Paso 2: Re-sincronizar 7 productos ──────────────────────────────────────
console.log('========================================');
console.log('PASO 2: Re-sincronizar 7 productos');
console.log('========================================');

const { data: prodRows, error: prodErr } = await sb
  .from('amfe_documents')
  .select('id, amfe_number, data')
  .in('amfe_number', PRODUCT_AMFE_NUMBERS);
if (prodErr) { console.error('Error leyendo productos:', prodErr); process.exit(1); }
console.log(`Encontrados ${prodRows.length} productos (esperaba ${PRODUCT_AMFE_NUMBERS.length}):`);
for (const p of prodRows) console.log(`  - ${p.amfe_number} (${p.id})`);
console.log();

const productSummaries = [];

for (const prodRow of prodRows) {
  if (typeof prodRow.data !== 'string') {
    console.error(`ERROR: ${prodRow.amfe_number}.data no es string (${typeof prodRow.data})`);
    continue;
  }
  const prodDoc = JSON.parse(prodRow.data);

  // Filtrar ops de INYECCION (NO "PU" o "POLIURETANO")
  const isInjectionOp = (op) => {
    const name = normalize(op.operationName || op.name || '');
    return (name.includes('inyeccion') || name.includes('inyección')) && !name.includes('pu') && !name.includes('poliuretano');
  };

  const beforeCount = countAP(prodDoc, isInjectionOp);

  let prodModified = 0;
  for (const op of prodDoc.operations || []) {
    if (!isInjectionOp(op)) continue;
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const fm of (fn.failures || [])) {
          let maxSeverityInFailure = 0;
          for (const c of (fm.causes || [])) {
            const key = normalize(c.description || c.cause || '');
            const masterChange = masterCauseByDesc.get(key);
            if (masterChange) {
              // Aplicar nuevos valores preservando id del producto
              c.severity = masterChange.newS;
              c.occurrence = masterChange.newO;
              c.detection = masterChange.newD;
              c.ap = masterChange.newAP;
              c.actionPriority = masterChange.newAP;
              if ((masterChange.newAP === 'H' || masterChange.newAP === 'M') && !(c.preventionAction || '').trim()) {
                c.preventionAction = 'Pendiente definicion equipo APQP';
              }
              prodModified++;
            }
            maxSeverityInFailure = Math.max(maxSeverityInFailure, c.severity || 0);
          }
          if (maxSeverityInFailure > (fm.severity || 0)) {
            fm.severity = maxSeverityInFailure;
          }
        }
      }
    }
  }

  const afterCount = countAP(prodDoc, isInjectionOp);

  // Guardar
  const prodJson = JSON.stringify(prodDoc);
  const { error: updErr } = await sb
    .from('amfe_documents')
    .update({ data: prodJson })
    .eq('id', prodRow.id);
  if (updErr) {
    console.error(`Error guardando ${prodRow.amfe_number}:`, updErr);
    continue;
  }

  // Verificar post-save
  const { data: vrow } = await sb.from('amfe_documents').select('data').eq('id', prodRow.id).single();
  const typeOk = typeof vrow.data === 'string';
  let parseOk = false;
  if (typeOk) {
    try {
      const parsed = JSON.parse(vrow.data);
      parseOk = Array.isArray(parsed.operations);
    } catch {}
  }

  productSummaries.push({
    amfe_number: prodRow.amfe_number,
    id: prodRow.id,
    modified: prodModified,
    before: beforeCount,
    after: afterCount,
    typeOk, parseOk,
  });

  console.log(`${prodRow.amfe_number}:`);
  console.log(`  Causas modificadas en OP inyeccion: ${prodModified}`);
  console.log(`  Antes INY: H=${beforeCount.H}  M=${beforeCount.M}  L=${beforeCount.L}  total=${beforeCount.total}`);
  console.log(`  Despues INY: H=${afterCount.H}  M=${afterCount.M}  L=${afterCount.L}  total=${afterCount.total}`);
  console.log(`  Verificacion: typeof data === "string": ${typeOk}  parseable: ${parseOk}`);
  console.log();
}

// ── Reporte final ───────────────────────────────────────────────────────────
console.log('========================================');
console.log('REPORTE FINAL');
console.log('========================================');
console.log();
console.log('MAESTRO:');
console.log(`  Antes:   H=${masterBefore.H}  M=${masterBefore.M}  L=${masterBefore.L}`);
console.log(`  Despues: H=${masterAfter.H}  M=${masterAfter.M}  L=${masterAfter.L}`);
console.log();
console.log('PRODUCTOS (solo OP inyeccion):');
for (const p of productSummaries) {
  console.log(`  ${p.amfe_number}`);
  console.log(`    Antes:   H=${p.before.H}  M=${p.before.M}  L=${p.before.L}  (total=${p.before.total})`);
  console.log(`    Despues: H=${p.after.H}  M=${p.after.M}  L=${p.after.L}  (total=${p.after.total})`);
  console.log(`    Modificadas: ${p.modified}  Verificacion: string=${p.typeOk} parse=${p.parseOk}`);
}
console.log();
console.log('Done.');
