/**
 * syncIpPadFromInjectionMaster.mjs
 *
 * Sincroniza SOLO la operacion de inyeccion del AMFE del IP PAD (VWA-PAT-IPPADS-001)
 * con el AMFE Maestro de Inyeccion (4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c, family 15).
 *
 * Estrategia conservadora (ver briefing de Fak):
 *   - Solo toca la OP de inyeccion del IP PAD.
 *   - Preserva: id de op, opNumber, name/operationName, linkedPfdStepId.
 *   - Actualiza focusElementFunction al del maestro (mas completo 3 perspectivas).
 *   - Work Elements:
 *       * IP PAD tiene 1 WE "Inyectora". Se fusiona con "Inyectora (maquina principal)"
 *         del maestro: conserva id del WE del IP PAD, conserva id de cada failure del
 *         IP PAD cuando haya match con el maestro, y copia efectos/controles/causas
 *         desde el maestro.
 *       * Failures que existen en IP PAD y no en el maestro se PRESERVAN tal cual.
 *       * Failures que existen en el maestro pero no en el IP PAD se AGREGAN.
 *       * Los otros 9 WEs del maestro (Molde, Refrig tornillo, Colorante, Dossier,
 *         Arranque, Setup, Autocontrol, Instrumentos, Aire comprimido) se AGREGAN
 *         tal cual con UUIDs frescos.
 *   - Causas nuevas tienen AP calculado por la tabla oficial (calculateAP) — NUNCA S*O*D.
 *   - NO asigna CC/SC. NO inventa acciones (pone placeholder si AP=H sin accion).
 *   - data es TEXT en Supabase: JSON.parse al leer, JSON.stringify al escribir.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

// ── Supabase connection ─────────────────────────────────────────────────────
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
const IPPAD_AMFE_NUMBER = 'VWA-PAT-IPPADS-001';

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

/**
 * Normaliza una descripcion de failure para matching entre IP PAD y maestro.
 * Quita acentos, pasa a minuscula, saca parentesis y puntuacion, colapsa espacios.
 * Luego aplica sinonimos conocidos (rebabas == rebarbas, quemados == quemaduras, etc.)
 */
function normalizeFailure(desc) {
  if (!desc) return '';
  let s = String(desc)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/\([^)]*\)/g, ' ') // quitar contenido entre parentesis
    .replace(/[\/,\.;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // sinonimos y stemming basico
  s = s.replace(/\brebarbas?\b/g, 'rebabas');
  s = s.replace(/\bquemados?\b/g, 'quemaduras');
  s = s.replace(/\bponto\b/g, 'punto');
  // singularizar para matching mas robusto
  s = s.replace(/\bpiezas\b/g, 'pieza');
  s = s.replace(/\bmarcas\b/g, 'marca');
  s = s.replace(/\brayas\b/g, 'raya');
  return s;
}

/**
 * Busca si dos descripciones normalizadas "matchean" para fusion.
 * Considera match si una esta contenida en la otra o comparten un set grande de palabras clave.
 */
function failuresMatch(ipPadDesc, masterDesc) {
  const a = normalizeFailure(ipPadDesc);
  const b = normalizeFailure(masterDesc);
  if (!a || !b) return false;
  if (a === b) return true;
  // Containment bidireccional con al menos 4 palabras comunes o la mas corta incluida
  const aw = new Set(a.split(' ').filter(w => w.length >= 3));
  const bw = new Set(b.split(' ').filter(w => w.length >= 3));
  const common = [...aw].filter(w => bw.has(w));
  const shorter = aw.size <= bw.size ? aw : bw;
  // si la mayoria de la descripcion mas corta matchea con la otra
  if (shorter.size > 0 && common.length / shorter.size >= 0.6 && common.length >= 2) return true;
  return false;
}

/**
 * Recomputa el AP de una cause a partir de S/O/D y respeta alias duales.
 */
function ensureCauseConsistency(cause) {
  const s = Number(cause.severity);
  const o = Number(cause.occurrence);
  const d = Number(cause.detection);
  const ap = calculateAP(s, o, d);
  cause.actionPriority = ap;
  cause.ap = ap;
  // aliases duales
  if (cause.cause && !cause.description) cause.description = cause.cause;
  if (cause.description && !cause.cause) cause.cause = cause.description;
  // placeholder accion si AP=H y no hay accion
  if (ap === 'H' && !cause.preventionAction && !cause.detectionAction) {
    cause.preventionAction = 'Pendiente definicion equipo APQP';
  }
  // defaults de campos que pueden faltar
  if (cause.specialChar === undefined) cause.specialChar = '';
  if (cause.characteristicNumber === undefined) cause.characteristicNumber = '';
  if (cause.filterCode === undefined) cause.filterCode = '';
  if (cause.responsible === undefined) cause.responsible = '';
  if (cause.targetDate === undefined) cause.targetDate = '';
  if (cause.status === undefined) cause.status = '';
  if (cause.actionTaken === undefined) cause.actionTaken = '';
  if (cause.completionDate === undefined) cause.completionDate = '';
  if (cause.severityNew === undefined) cause.severityNew = '';
  if (cause.occurrenceNew === undefined) cause.occurrenceNew = '';
  if (cause.detectionNew === undefined) cause.detectionNew = '';
  if (cause.apNew === undefined) cause.apNew = '';
  if (cause.observations === undefined) cause.observations = '';
  return cause;
}

/**
 * Regenera UUIDs recursivamente en un objeto de work element / function / failure / cause.
 * Usado para clonar items del maestro al IP PAD sin compartir ids.
 */
function regenIds(obj) {
  if (obj && typeof obj === 'object') {
    if ('id' in obj) obj.id = randomUUID();
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (Array.isArray(v)) v.forEach(regenIds);
      else if (v && typeof v === 'object') regenIds(v);
    }
  }
  return obj;
}

/**
 * Clona un item via JSON y regenera sus ids.
 */
function cloneWithFreshIds(item) {
  return regenIds(JSON.parse(JSON.stringify(item)));
}

/** Cuenta causas/AP distribution de una operacion. */
function statsForOp(op) {
  let wes = 0, failures = 0, causes = 0;
  const ap = { H: 0, M: 0, L: 0, other: 0 };
  for (const we of op?.workElements || []) {
    wes++;
    for (const fn of we.functions || []) {
      for (const f of fn.failures || []) {
        failures++;
        for (const c of f.causes || []) {
          causes++;
          const a = c.actionPriority || c.ap || '';
          if (a === 'H' || a === 'M' || a === 'L') ap[a]++;
          else ap.other++;
        }
      }
    }
  }
  return { wes, failures, causes, ap };
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n══════════════════════════════════════════════════════════');
console.log('  SYNC IP PAD INJECTION ← INJECTION MASTER');
console.log('══════════════════════════════════════════════════════════\n');

// 1. Leer maestro
console.log('[1/5] Leyendo AMFE Maestro de Inyeccion...');
const { data: masterDoc, error: masterErr } = await sb
  .from('amfe_documents')
  .select('id, amfe_number, data')
  .eq('id', MASTER_DOC_ID)
  .single();
if (masterErr) { console.error('ERROR leyendo maestro:', masterErr); process.exit(1); }
const masterData = typeof masterDoc.data === 'string' ? JSON.parse(masterDoc.data) : masterDoc.data;
console.log(`      Maestro: ${masterDoc.amfe_number} (${masterData.operations.length} ops)`);

const masterOp20 = masterData.operations.find(o => (o.opNumber || o.operationNumber) === '20');
if (!masterOp20) {
  console.error('ERROR: maestro no tiene OP 20');
  process.exit(1);
}
const masterInjectora = masterOp20.workElements.find(we => /inyectora/i.test(we.name) && /maquina/i.test(we.name));
if (!masterInjectora) {
  console.error('ERROR: no encontre WE "Inyectora (maquina principal)" en maestro OP 20');
  process.exit(1);
}
console.log(`      Maestro OP 20 WEs: ${masterOp20.workElements.length}`);
console.log(`      Maestro focusElementFunction: ${masterOp20.focusElementFunction?.slice(0, 80)}...`);

// 2. Leer IP PAD
console.log('\n[2/5] Leyendo AMFE IP PAD...');
const { data: ippadDoc, error: ippadErr } = await sb
  .from('amfe_documents')
  .select('id, amfe_number, data')
  .eq('amfe_number', IPPAD_AMFE_NUMBER)
  .single();
if (ippadErr) { console.error('ERROR leyendo IP PAD:', ippadErr); process.exit(1); }
const ippadData = typeof ippadDoc.data === 'string' ? JSON.parse(ippadDoc.data) : ippadDoc.data;
console.log(`      IP PAD: ${ippadDoc.amfe_number} (id=${ippadDoc.id})`);
console.log(`      Operaciones: ${ippadData.operations.length}`);

// 3. Identificar OP de inyeccion
const injectionOps = ippadData.operations.filter(op => {
  const name = (op.name || op.operationName || '').toLowerCase();
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /inyecc/.test(normalized);
});
if (injectionOps.length === 0) {
  console.error('BLOQUEADOR: el IP PAD no tiene ninguna operacion de inyeccion. NO se hizo ningun cambio.');
  process.exit(2);
}
if (injectionOps.length > 1) {
  console.warn(`      ADVERTENCIA: IP PAD tiene ${injectionOps.length} ops de inyeccion. Se procesaran todas.`);
}
const totalOpsBefore = ippadData.operations.length;

// 4. Por cada op de inyeccion matched, aplicar el merge
for (const ippadOp of injectionOps) {
  const opNum = ippadOp.opNumber || ippadOp.operationNumber;
  const opName = ippadOp.name || ippadOp.operationName;
  console.log(`\n[3/5] Procesando OP ${opNum} "${opName}"...`);

  const beforeStats = statsForOp(ippadOp);
  console.log(`      ANTES: ${beforeStats.wes} WE, ${beforeStats.failures} failures, ${beforeStats.causes} causas, AP H=${beforeStats.ap.H} M=${beforeStats.ap.M} L=${beforeStats.ap.L}`);

  // ── 4.a. focusElementFunction actualizado al maestro
  ippadOp.focusElementFunction = masterOp20.focusElementFunction;

  // ── 4.b. localizar WE Inyectora del IP PAD
  // El IP PAD usa "Inyectora" (simple). Buscar cualquier WE cuyo nombre contenga "inyectora".
  let ippadInjectoraWE = ippadOp.workElements.find(we => /inyectora/i.test(we.name || ''));
  if (!ippadInjectoraWE) {
    console.warn('      WARNING: IP PAD OP inyeccion no tiene WE "Inyectora". Se creara vacio y se fusionara.');
    ippadInjectoraWE = {
      id: randomUUID(),
      name: 'Inyectora',
      type: 'Machine',
      functions: [
        {
          id: randomUUID(),
          description: 'Inyectar piezas plasticas conformes segun especificacion',
          functionDescription: 'Inyectar piezas plasticas conformes segun especificacion',
          requirements: '',
          failures: [],
        },
      ],
    };
    ippadOp.workElements.push(ippadInjectoraWE);
  }

  // Asegurar aliases del WE
  if (ippadInjectoraWE.description && !ippadInjectoraWE.name) ippadInjectoraWE.name = ippadInjectoraWE.description;

  // Asegurar 1 function con failures[]
  if (!ippadInjectoraWE.functions || ippadInjectoraWE.functions.length === 0) {
    ippadInjectoraWE.functions = [{
      id: randomUUID(),
      description: 'Inyectar piezas plasticas conformes segun especificacion',
      functionDescription: 'Inyectar piezas plasticas conformes segun especificacion',
      requirements: '',
      failures: [],
    }];
  }
  const ippadInjectoraFn = ippadInjectoraWE.functions[0];
  if (!Array.isArray(ippadInjectoraFn.failures)) ippadInjectoraFn.failures = [];

  // Dedup previo: si el sync se corrio antes y quedaron duplicados dentro del IP PAD,
  // eliminar failures duplicadas dejando la primera ocurrencia (idempotencia).
  // Aqui se usa matching MAS ESTRICTO (exact normalized o misma raiz),
  // para no eliminar failures distintas por accidente.
  function isSameFailure(a, b) {
    const na = normalizeFailure(a);
    const nb = normalizeFailure(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    // containment estricto de la mas corta en la mas larga (>= 2 palabras significativas)
    const wordsA = na.split(' ').filter(w => w.length >= 4);
    const wordsB = nb.split(' ').filter(w => w.length >= 4);
    if (wordsA.length < 2 || wordsB.length < 2) return false;
    // la mas corta debe estar casi completamente contenida
    const shorter = wordsA.length <= wordsB.length ? wordsA : wordsB;
    const longer = wordsA.length <= wordsB.length ? wordsB : wordsA;
    const longerSet = new Set(longer);
    const matched = shorter.filter(w => longerSet.has(w)).length;
    // requerimos que TODAS las palabras significativas de la mas corta esten en la mas larga
    // Y que las palabras comunes representen el nucleo del defecto (no solo "pieza inyectada")
    if (matched !== shorter.length) return false;
    // excluir stop-like matches: solo "pieza", "inyectada", "molde", "proceso" no alcanzan
    const stopWords = new Set(['pieza', 'piezas', 'inyectada', 'inyectadas', 'inyectado', 'molde', 'proceso', 'material', 'materia', 'prima']);
    const distinctive = shorter.filter(w => !stopWords.has(w));
    return distinctive.length >= 1;
  }
  const dedupedFailures = [];
  for (const f of ippadInjectoraFn.failures) {
    const isDup = dedupedFailures.some(kept => isSameFailure(kept.description, f.description));
    if (!isDup) dedupedFailures.push(f);
  }
  if (dedupedFailures.length !== ippadInjectoraFn.failures.length) {
    console.log(`      Dedup previo: eliminadas ${ippadInjectoraFn.failures.length - dedupedFailures.length} failures duplicadas dentro del IP PAD`);
  }
  ippadInjectoraFn.failures = dedupedFailures;

  // Tambien dedup de WEs por nombre (misma razon: idempotencia si se re-corre)
  const seenWeNames = new Set();
  ippadOp.workElements = ippadOp.workElements.filter(we => {
    const n = (we.name || '').toLowerCase().trim();
    if (!n || seenWeNames.has(n)) return false;
    seenWeNames.add(n);
    return true;
  });

  // Tomar todas las failures del maestro Inyectora
  const masterInjectoraFn = masterInjectora.functions?.[0];
  const masterFailures = masterInjectoraFn?.failures || [];

  // Preparar listado para reporte
  const mergedList = [];     // matches
  const preservedList = [];  // solo IP PAD
  const addedList = [];      // solo maestro

  // ── 4.c. para cada failure del IP PAD, buscar match en maestro
  // Si matchea: reemplazar effectLocal/NextLevel/EndUser + causas del maestro.
  //   Pero conservar el id de la failure del IP PAD.
  //   Las causas del maestro se clonan con ids frescos.
  // Si no matchea: queda intacta (preservada).
  const matchedMasterIds = new Set();
  const updatedIpPadFailures = ippadInjectoraFn.failures.map(ippadFailure => {
    const match = masterFailures.find(mf => !matchedMasterIds.has(mf.id) && failuresMatch(ippadFailure.description, mf.description));
    if (match) {
      matchedMasterIds.add(match.id);
      mergedList.push({ ipPad: ippadFailure.description, master: match.description });
      // Fusionar: conservar id del IP PAD, copiar todo lo demas del maestro.
      const clonedCauses = (match.causes || []).map(c => {
        const fresh = cloneWithFreshIds(c);
        return ensureCauseConsistency(fresh);
      });
      return {
        ...ippadFailure,
        description: ippadFailure.description, // conservar texto original IP PAD
        effectLocal: match.effectLocal,
        effectNextLevel: match.effectNextLevel,
        effectEndUser: match.effectEndUser,
        causes: clonedCauses,
      };
    } else {
      preservedList.push(ippadFailure.description);
      // Preservar failure: solo recomputar AP de sus causas existentes (consistencia)
      if (Array.isArray(ippadFailure.causes)) {
        ippadFailure.causes = ippadFailure.causes.map(ensureCauseConsistency);
      }
      return ippadFailure;
    }
  });

  // ── 4.d. agregar failures del maestro que no matchearon con ninguna del IP PAD
  for (const mf of masterFailures) {
    if (!matchedMasterIds.has(mf.id)) {
      const clonedFailure = cloneWithFreshIds(mf);
      if (Array.isArray(clonedFailure.causes)) {
        clonedFailure.causes = clonedFailure.causes.map(ensureCauseConsistency);
      }
      updatedIpPadFailures.push(clonedFailure);
      addedList.push(mf.description);
    }
  }

  ippadInjectoraFn.failures = updatedIpPadFailures;

  // Actualizar nombre/descripcion de function al del maestro (si el del IP PAD es el generico simple)
  if (masterInjectoraFn?.description) {
    ippadInjectoraFn.description = masterInjectoraFn.description;
    ippadInjectoraFn.functionDescription = masterInjectoraFn.description;
  }

  // ── 4.e. agregar los OTROS WEs del maestro (todos menos Inyectora maquina principal)
  const existingWENames = new Set(ippadOp.workElements.map(we => (we.name || '').toLowerCase()));
  const addedWEs = [];
  for (const masterWE of masterOp20.workElements) {
    if (masterWE.id === masterInjectora.id) continue; // ese ya se fusiono
    const lname = (masterWE.name || '').toLowerCase();
    if (existingWENames.has(lname)) continue; // ya existe con mismo nombre — no duplicar
    const cloned = cloneWithFreshIds(masterWE);
    // recomputar AP de todas las causas clonadas
    for (const fn of cloned.functions || []) {
      for (const f of fn.failures || []) {
        if (Array.isArray(f.causes)) f.causes = f.causes.map(ensureCauseConsistency);
      }
    }
    ippadOp.workElements.push(cloned);
    addedWEs.push(masterWE.name);
  }

  const afterStats = statsForOp(ippadOp);
  console.log(`      DESPUES: ${afterStats.wes} WE, ${afterStats.failures} failures, ${afterStats.causes} causas, AP H=${afterStats.ap.H} M=${afterStats.ap.M} L=${afterStats.ap.L}`);

  console.log('\n      ── FAILURES FUSIONADAS (match IP PAD ↔ Maestro) ──');
  mergedList.forEach(m => console.log(`        * "${m.ipPad}" ⇄ "${m.master}"`));
  console.log('\n      ── FAILURES PRESERVADAS (solo IP PAD, no en maestro) ──');
  preservedList.forEach(p => console.log(`        * "${p}"`));
  console.log('\n      ── FAILURES AGREGADAS (solo en maestro, nuevas en IP PAD) ──');
  addedList.forEach(a => console.log(`        * "${a}"`));
  console.log('\n      ── WEs NUEVOS AGREGADOS DEL MAESTRO ──');
  addedWEs.forEach(w => console.log(`        + ${w}`));
}

// 5. Guardar
console.log('\n[4/5] Guardando IP PAD actualizado en Supabase...');
if (ippadData.operations.length !== totalOpsBefore) {
  console.error(`ERROR SAFETY: operations.length cambio (${totalOpsBefore} → ${ippadData.operations.length}). Abortando sin guardar.`);
  process.exit(3);
}

// data es TEXT en Supabase → JSON.stringify
const newDataText = JSON.stringify(ippadData);
const { error: upErr } = await sb
  .from('amfe_documents')
  .update({ data: newDataText })
  .eq('id', ippadDoc.id);
if (upErr) { console.error('ERROR update:', upErr); process.exit(1); }

// 6. Verificacion post-update
console.log('\n[5/5] Verificando post-update...');
const { data: verifyDoc, error: vErr } = await sb
  .from('amfe_documents')
  .select('id, data')
  .eq('id', ippadDoc.id)
  .single();
if (vErr) { console.error('ERROR verify:', vErr); process.exit(1); }

console.log(`      typeof data: ${typeof verifyDoc.data} (esperado: string, porque columna es TEXT)`);
let parsed;
try {
  parsed = typeof verifyDoc.data === 'string' ? JSON.parse(verifyDoc.data) : verifyDoc.data;
  console.log('      JSON.parse: OK');
} catch (e) {
  console.error('ERROR: JSON.parse fallo:', e.message);
  process.exit(1);
}
console.log(`      operations.length: ${parsed.operations.length} (esperado: ${totalOpsBefore})`);
if (parsed.operations.length !== totalOpsBefore) {
  console.error('ERROR: operations.length no coincide');
  process.exit(1);
}

const verifyInjOps = parsed.operations.filter(op => {
  const name = (op.name || op.operationName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /inyecc/.test(name);
});
for (const vOp of verifyInjOps) {
  const s = statsForOp(vOp);
  const opNum = vOp.opNumber || vOp.operationNumber;
  const opName = vOp.name || vOp.operationName;
  console.log(`      OP ${opNum} "${opName}": ${s.wes} WEs, ${s.failures} failures, ${s.causes} causas`);
  if (s.wes < 10) {
    console.warn(`      WARNING: se esperaban >= 10 WEs, hay ${s.wes}`);
  } else {
    console.log(`      OK: >= 10 WEs`);
  }
}

console.log('\n══════════════════════════════════════════════════════════');
console.log('  SYNC COMPLETADO');
console.log('══════════════════════════════════════════════════════════\n');

process.exit(0);
