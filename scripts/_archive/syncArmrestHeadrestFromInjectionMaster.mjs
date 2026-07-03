/**
 * syncArmrestHeadrestFromInjectionMaster.mjs
 *
 * Sincroniza las operaciones de inyeccion plastica (termoplastico) de:
 *   - Armrest Door Panel (OP 60 "INYECCION DE PIEZAS PLASTICAS")
 *   - Headrest Front    (OP 40 "INYECCION DE SUSTRATO")
 *   - Headrest Rear Center (OP 40 "INYECCION DE SUSTRATO")
 *   - Headrest Rear Outer  (OP 40 "INYECCION DE SUSTRATO")
 *
 * con el AMFE Maestro de Inyeccion (document_id 4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c,
 * family_id 15).
 *
 * REGLAS CRITICAS:
 *  - "INYECCION PU" del Armrest (poliuretano) NO es inyeccion plastica.
 *    Se EXCLUYE explicitamente del merge. Solo se reporta como SKIP.
 *  - Solo se actualiza el WE "Machine: Inyectora" (fusion de failures por descripcion).
 *    Otras WEs del producto se preservan.
 *  - Se preservan: op.id, opNumber, operationNumber, name, operationName, linkedPfdStepId,
 *    focusElementFunction y operationFunction si ya existen en el producto.
 *  - Failures solo en el producto -> se preservan (con su id original).
 *  - Failures solo en el maestro -> se agregan con UUIDs frescos.
 *  - Failures en ambos -> se usa la version del maestro (effectLocal/NextLevel/EndUser
 *    y causes con controles diferenciados), pero se preserva el id de la failure
 *    existente en el producto.
 *  - Si el producto tiene <3 WEs en la op matched, se agregan los WEs del maestro
 *    que le falten (comparacion por tipo + nombre normalizado). Si tiene >=3 WEs,
 *    solo se fusiona el WE "Machine: Inyectora".
 *  - AP se calcula con tabla oficial (calculateAP, copia de modules/amfe/apTable.ts).
 *    NUNCA con formula S*O*D.
 *  - NO inventar acciones. Si una causa del maestro tiene AP=H sin accion,
 *    se agrega placeholder "Pendiente definicion equipo APQP".
 *  - NO cambiar headers, CC/SC ni nombres de operaciones.
 *  - NO tocar CP/HO/PFD.
 *  - amfe_documents.data es TEXT: JSON.parse al leer, JSON.stringify al escribir.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

// ── Supabase connection ───────────────────────────────────────────────
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
  { id: '5268704d-30ae-48f3-ad05-8402a6ded7fe', label: 'Armrest Door Panel' },
  { id: '10eaebce-ad87-4035-9343-3e20e4ee0fc9', label: 'Headrest Front' },
  { id: 'e9320798-ceaa-4623-97e9-92200b5234b6', label: 'Headrest Rear Center' },
  { id: 'beda6d47-30ae-4d5f-81e0-468be8950014', label: 'Headrest Rear Outer' },
];

// ── Tabla AP oficial (copia de modules/amfe/apTable.ts) ──────────────
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
  if (s == null || o == null || d == null) return '';
  if (Number.isNaN(s) || Number.isNaN(o) || Number.isNaN(d)) return '';
  const sInt = Math.round(s), oInt = Math.round(o), dInt = Math.round(d);
  if (sInt < 1 || sInt > 10 || oInt < 1 || oInt > 10 || dInt < 1 || dInt > 10) return '';
  return apRule(sInt, oInt, dInt);
}

// ── Normalizacion ─────────────────────────────────────────────────────
function norm(s) {
  if (typeof s !== 'string') return '';
  return s.toUpperCase().trim().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function parseData(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return null; } }
  if (typeof raw === 'object') return raw;
  return null;
}

// ── Clasificacion de operaciones ──────────────────────────────────────
const TARGET_OP_NAMES_NORM = new Set([
  'INYECCION DE PIEZAS PLASTICAS',
  'INYECCION DE SUSTRATO',
]);

function classifyOperation(opName) {
  const n = norm(opName);
  if (!n) return 'skip-empty';
  if (TARGET_OP_NAMES_NORM.has(n)) return 'match-plastic';
  if (n.includes('PU') || n.includes('POLIURETANO')) return 'skip-pu';
  if (n.includes('INYECCION') || n.includes('INYECTAR')) return 'skip-other-injection';
  return 'skip-unrelated';
}

// ── Clone helpers con aliases duales ─────────────────────────────────
function cloneCauseFromMaster(masterCause) {
  const s = masterCause.severity;
  const o = masterCause.occurrence;
  const d = masterCause.detection;
  const ap = calculateAP(s, o, d);
  const description = masterCause.description ?? masterCause.cause ?? '';
  const prevAct = ap === 'H'
    ? (masterCause.preventionAction || 'Pendiente definicion equipo APQP')
    : (masterCause.preventionAction || '');
  return {
    id: randomUUID(),
    description,
    cause: description,
    severity: s,
    occurrence: o,
    detection: d,
    actionPriority: ap,
    ap,
    preventionControl: masterCause.preventionControl || '',
    detectionControl: masterCause.detectionControl || '',
    preventionAction: prevAct,
    detectionAction: masterCause.detectionAction || '',
    specialChar: masterCause.specialChar || '',
    characteristicNumber: masterCause.characteristicNumber || '',
    filterCode: masterCause.filterCode || '',
    responsible: masterCause.responsible || '',
    targetDate: masterCause.targetDate || '',
    status: masterCause.status || '',
    actionTaken: masterCause.actionTaken || '',
    completionDate: masterCause.completionDate || '',
    severityNew: masterCause.severityNew || '',
    occurrenceNew: masterCause.occurrenceNew || '',
    detectionNew: masterCause.detectionNew || '',
    apNew: masterCause.apNew || '',
    observations: masterCause.observations || '',
    recommendedAction: masterCause.recommendedAction || '',
  };
}

function cloneFailureFromMaster(masterFailure, preservedId = null) {
  return {
    id: preservedId || randomUUID(),
    description: masterFailure.description,
    effectLocal: masterFailure.effectLocal || '',
    effectNextLevel: masterFailure.effectNextLevel || '',
    effectEndUser: masterFailure.effectEndUser || '',
    causes: (masterFailure.causes || []).map(cloneCauseFromMaster),
  };
}

function cloneFunctionFromMaster(masterFn) {
  const desc = masterFn.description ?? masterFn.functionDescription ?? '';
  return {
    id: randomUUID(),
    description: desc,
    functionDescription: desc,
    requirements: masterFn.requirements || '',
    failures: (masterFn.failures || []).map(f => cloneFailureFromMaster(f)),
  };
}

function cloneWeFromMaster(masterWE) {
  return {
    id: randomUUID(),
    name: masterWE.name,
    type: masterWE.type,
    functions: (masterWE.functions || []).map(cloneFunctionFromMaster),
  };
}

// ── Recalcular AP en causes existentes del producto ──────────────────
function recomputeAp(cause) {
  const s = cause.severity;
  const o = cause.occurrence;
  const d = cause.detection;
  const ap = calculateAP(s, o, d);
  return { ...cause, actionPriority: ap, ap };
}

// ── Matching de failures por descripcion normalizada ─────────────────
function buildFailureIndex(failures) {
  const idx = new Map();
  for (const f of failures) idx.set(norm(f.description), f);
  return idx;
}

// ── Merge del WE "Machine: Inyectora" ────────────────────────────────
// masterWE = master "Machine: Inyectora (maquina principal)"
// productWE = product WE con nombre matching "Machine: Inyectora" (o similar)
function mergeInjectoraWe(productWE, masterWE, report) {
  // El WE master tiene 1 solo function con todas las failures.
  // El WE product puede tener 1 function tambien. Asumimos 1 function.
  const masterFn = (masterWE.functions || [])[0];
  if (!masterFn) return productWE;

  // Encontrar (o crear) la function del producto
  let productFn;
  if (!productWE.functions || productWE.functions.length === 0) {
    productFn = cloneFunctionFromMaster(masterFn);
    productFn.failures = []; // las failures las manejamos abajo
    return {
      ...productWE,
      functions: [productFn],
    };
  } else {
    productFn = productWE.functions[0];
  }

  const productFailures = productFn.failures || [];
  const masterFailures = masterFn.failures || [];

  const productByDesc = buildFailureIndex(productFailures);
  const masterByDesc = buildFailureIndex(masterFailures);

  const mergedFailures = [];
  const merged = []; // report lista
  const preserved = [];
  const added = [];

  // Iteramos sobre failures del master para definir orden canonico
  for (const mf of masterFailures) {
    const key = norm(mf.description);
    const pf = productByDesc.get(key);
    if (pf) {
      // Fusionar: usar effects/causes del master, preservar id del producto
      const fused = cloneFailureFromMaster(mf, pf.id);
      mergedFailures.push(fused);
      merged.push(mf.description);
    } else {
      // Solo en master -> agregar con UUIDs frescos
      const added1 = cloneFailureFromMaster(mf);
      mergedFailures.push(added1);
      added.push(mf.description);
    }
  }

  // Failures solo en producto: preservarlas al final (con AP recalculado)
  for (const pf of productFailures) {
    const key = norm(pf.description);
    if (!masterByDesc.has(key)) {
      const preservedFailure = {
        ...pf,
        causes: (pf.causes || []).map(recomputeAp),
      };
      mergedFailures.push(preservedFailure);
      preserved.push(pf.description);
    }
  }

  report.merged.push(...merged);
  report.preserved.push(...preserved);
  report.added.push(...added);

  return {
    ...productWE,
    functions: [{
      ...productFn,
      failures: mergedFailures,
    }],
  };
}

// ── Matching del WE "Machine: Inyectora" en product ──────────────────
// El producto puede tener:
//  - "Machine: Inyectora"
//  - "Machine: Maquina inyectora de plastico"  (Armrest)
// Normalizamos y buscamos que contenga "INYECTORA".
function findInjectoraWe(workElements) {
  for (let i = 0; i < workElements.length; i++) {
    const we = workElements[i];
    const type = norm(we.type);
    const name = norm(we.name);
    if ((type === 'MACHINE') && (name.includes('INYECTORA') || name.includes('MAQUINA INYECTORA'))) {
      return { we, index: i };
    }
  }
  return null;
}

// ── Matching de WEs del master que le faltan al producto ─────────────
function buildWeKey(we) {
  return `${norm(we.type)}::${norm(we.name)}`;
}

function mergeOperation(productOp, masterOp, report) {
  const productWEs = productOp.workElements || [];
  const masterWEs = masterOp.workElements || [];

  const beforeWes = productWEs.length;
  const beforeFailures = productWEs.reduce((acc, we) => acc + (we.functions || [])
    .reduce((a, fn) => a + (fn.failures || []).length, 0), 0);

  // 1. Merge WE "Machine: Inyectora"
  const injHit = findInjectoraWe(productWEs);
  const masterInyectora = masterWEs.find(w => norm(w.type) === 'MACHINE' && norm(w.name).includes('INYECTORA'));

  const newWEs = [];
  for (let i = 0; i < productWEs.length; i++) {
    if (injHit && i === injHit.index && masterInyectora) {
      const merged = mergeInjectoraWe(productWEs[i], masterInyectora, report);
      newWEs.push(merged);
    } else {
      // Preservar WE sin tocar (incluyendo recomputar AP de causas existentes)
      const pwe = productWEs[i];
      const functions = (pwe.functions || []).map(fn => ({
        ...fn,
        failures: (fn.failures || []).map(f => ({
          ...f,
          causes: (f.causes || []).map(recomputeAp),
        })),
      }));
      newWEs.push({ ...pwe, functions });
    }
  }

  // Si no habia WE inyectora, agregarlo del master (se considera agregado total)
  if (!injHit && masterInyectora) {
    const cloned = cloneWeFromMaster(masterInyectora);
    newWEs.push(cloned);
    report.addedWEs.push(`${masterInyectora.type}: ${masterInyectora.name}`);
    // Sus failures se cuentan como added
    for (const fn of (masterInyectora.functions || [])) {
      for (const f of (fn.failures || [])) report.added.push(f.description);
    }
  }

  // 2. Si el producto tiene <3 WEs, agregar los demas WEs del master que falten
  if (beforeWes < 3) {
    const existingKeys = new Set(newWEs.map(buildWeKey));
    for (const mwe of masterWEs) {
      // Saltar el inyectora WE del master (ya procesado)
      if (norm(mwe.type) === 'MACHINE' && norm(mwe.name).includes('INYECTORA')) continue;
      const key = buildWeKey(mwe);
      if (!existingKeys.has(key)) {
        const cloned = cloneWeFromMaster(mwe);
        newWEs.push(cloned);
        existingKeys.add(key);
        report.addedWEs.push(`${mwe.type}: ${mwe.name}`);
        // sus failures se cuentan como added
        for (const fn of (mwe.functions || [])) {
          for (const f of (fn.failures || [])) report.added.push(f.description);
        }
      }
    }
  }

  const afterFailures = newWEs.reduce((acc, we) => acc + (we.functions || [])
    .reduce((a, fn) => a + (fn.failures || []).length, 0), 0);

  report.beforeWes = beforeWes;
  report.afterWes = newWEs.length;
  report.beforeFailures = beforeFailures;
  report.afterFailures = afterFailures;

  return {
    ...productOp,
    workElements: newWEs,
  };
}

// ── Distribucion AP ──────────────────────────────────────────────────
function apDistribution(operations) {
  const dist = { H: 0, M: 0, L: 0, '': 0 };
  for (const op of operations) {
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const fm of (fn.failures || [])) {
          for (const c of (fm.causes || [])) {
            const ap = c.actionPriority || c.ap || '';
            dist[ap] = (dist[ap] || 0) + 1;
          }
        }
      }
    }
  }
  return dist;
}

// ── Flujo principal ──────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════');
console.log(' SYNC ARMREST + HEADRESTS FROM INJECTION MASTER');
console.log('══════════════════════════════════════════════════════════\n');

// 1. Leer master
console.log('1. Leyendo AMFE Maestro de Inyeccion...');
const { data: masterRow, error: masterErr } = await sb
  .from('amfe_documents')
  .select('id, data')
  .eq('id', MASTER_DOC_ID)
  .single();
if (masterErr) { console.error('ERROR leyendo master:', masterErr); process.exit(1); }
const masterData = parseData(masterRow.data);
if (!masterData || !Array.isArray(masterData.operations)) {
  console.error('ERROR: master invalido'); process.exit(1);
}
const masterOp20 = masterData.operations.find(o => norm(o.operationName ?? o.name) === 'INYECCION');
if (!masterOp20) { console.error('ERROR: master OP 20 INYECCION no encontrada'); process.exit(1); }
console.log(`   OK. master OP INYECCION tiene ${masterOp20.workElements?.length || 0} WEs.`);

// 2. Procesar cada target
const globalReports = [];

for (const target of TARGETS) {
  console.log(`\n──────────────────────────────────────────`);
  console.log(`Procesando: ${target.label}`);
  console.log(`──────────────────────────────────────────`);

  const { data: row, error } = await sb
    .from('amfe_documents')
    .select('id, subject, project_name, data')
    .eq('id', target.id)
    .single();
  if (error) { console.error(`ERROR leyendo ${target.label}:`, error); continue; }

  const doc = parseData(row.data);
  if (!doc || !Array.isArray(doc.operations)) {
    console.error(`ERROR: data invalida en ${target.label}`);
    continue;
  }

  const beforeDist = apDistribution(doc.operations);
  const matchedOps = [];
  const skippedOps = [];

  const newOperations = doc.operations.map(op => {
    const name = op.operationName ?? op.name ?? '';
    const cls = classifyOperation(name);

    if (cls === 'match-plastic') {
      const opReport = {
        opNumber: op.operationNumber ?? op.opNumber,
        name,
        merged: [],
        preserved: [],
        added: [],
        addedWEs: [],
        beforeWes: 0, afterWes: 0,
        beforeFailures: 0, afterFailures: 0,
      };
      const newOp = mergeOperation(op, masterOp20, opReport);
      matchedOps.push(opReport);
      return newOp;
    }

    if (cls === 'skip-pu') {
      skippedOps.push({ name, reason: 'INYECCION PU (poliuretano) — proceso distinto al maestro de inyeccion plastica' });
    } else if (cls === 'skip-other-injection') {
      skippedOps.push({ name, reason: 'Operacion de inyeccion pero no matchea con nombres oficiales del maestro' });
    }
    // skip-unrelated y skip-empty: no se reportan (son todas las demas ops del amfe)
    return op;
  });

  const newDoc = { ...doc, operations: newOperations };
  const afterDist = apDistribution(newDoc.operations);

  // 3. Escribir
  console.log(`   Operaciones matched: ${matchedOps.length}`);
  for (const m of matchedOps) {
    console.log(`     OP ${m.opNumber} "${m.name}"`);
    console.log(`       WEs: ${m.beforeWes} -> ${m.afterWes}`);
    console.log(`       Failures: ${m.beforeFailures} -> ${m.afterFailures}`);
    console.log(`       Fusionadas: ${m.merged.length}, Preservadas: ${m.preserved.length}, Agregadas: ${m.added.length}`);
    if (m.addedWEs.length) {
      console.log(`       WEs agregadas:`);
      for (const we of m.addedWEs) console.log(`         + ${we}`);
    }
  }
  console.log(`   Operaciones SKIP: ${skippedOps.length}`);
  for (const s of skippedOps) {
    console.log(`     - "${s.name}"   [${s.reason}]`);
  }
  console.log(`   AP antes:   H=${beforeDist.H} M=${beforeDist.M} L=${beforeDist.L} (inval=${beforeDist['']})`);
  console.log(`   AP despues: H=${afterDist.H} M=${afterDist.M} L=${afterDist.L} (inval=${afterDist['']})`);

  console.log(`   Actualizando ${target.label} en Supabase...`);
  const { error: updErr } = await sb
    .from('amfe_documents')
    .update({ data: JSON.stringify(newDoc) })
    .eq('id', target.id);
  if (updErr) {
    console.error(`   ERROR actualizando ${target.label}:`, updErr);
    continue;
  }

  // 4. Verificacion post-update
  const { data: verifyRow, error: vErr } = await sb
    .from('amfe_documents')
    .select('data')
    .eq('id', target.id)
    .single();
  if (vErr) { console.error(`   ERROR verificando ${target.label}:`, vErr); continue; }
  const verifiedData = parseData(verifyRow.data);
  const vkeys = verifiedData ? Object.keys(verifiedData) : [];
  const charIndexed = vkeys.length > 0 && vkeys[0] === '0' && typeof verifiedData[0] === 'string' && verifiedData[0].length === 1;
  if (charIndexed) { console.error(`   ERROR: data char-indexed post-update en ${target.label}`); continue; }
  if (!verifiedData || !Array.isArray(verifiedData.operations)) {
    console.error(`   ERROR: data invalida post-update en ${target.label}`);
    continue;
  }
  const verifiedMatched = verifiedData.operations.filter(o => TARGET_OP_NAMES_NORM.has(norm(o.operationName ?? o.name)));
  console.log(`   VERIFICADO: typeof data=${typeof verifiedData}, operations=${verifiedData.operations.length}, matched ops=${verifiedMatched.length}`);

  globalReports.push({
    target: target.label,
    id: target.id,
    subject: row.subject,
    matchedOps,
    skippedOps,
    beforeDist,
    afterDist,
    verified: true,
  });
}

// ── Reporte final ────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════');
console.log(' REPORTE FINAL');
console.log('══════════════════════════════════════════════════════════\n');

for (const r of globalReports) {
  console.log(`[${r.target}]`);
  console.log(`  id:      ${r.id}`);
  console.log(`  subject: ${r.subject}`);
  for (const m of r.matchedOps) {
    console.log(`  OP ${m.opNumber} ${m.name}`);
    console.log(`     WEs ${m.beforeWes}->${m.afterWes}, failures ${m.beforeFailures}->${m.afterFailures}`);
    console.log(`     Fusionadas (${m.merged.length}):`);
    for (const x of m.merged) console.log(`       ~ ${x}`);
    console.log(`     Preservadas (${m.preserved.length}):`);
    for (const x of m.preserved) console.log(`       = ${x}`);
    console.log(`     Agregadas del maestro (${m.added.length}):`);
    for (const x of m.added) console.log(`       + ${x}`);
    if (m.addedWEs.length) {
      console.log(`     WEs agregadas del maestro:`);
      for (const x of m.addedWEs) console.log(`       + ${x}`);
    }
  }
  if (r.skippedOps.length) {
    console.log(`  Operaciones SKIP:`);
    for (const s of r.skippedOps) {
      console.log(`    - "${s.name}"  [${s.reason}]`);
    }
  }
  console.log(`  AP antes:   H=${r.beforeDist.H} M=${r.beforeDist.M} L=${r.beforeDist.L}`);
  console.log(`  AP despues: H=${r.afterDist.H} M=${r.afterDist.M} L=${r.afterDist.L}`);
  console.log(`  Verificado: ${r.verified ? 'OK' : 'FAIL'}`);
  console.log('');
}

console.log('CONFIRMACION: "INYECCION PU" del Armrest fue EXCLUIDA del merge (proceso de poliuretano, NO inyeccion plastica).');
console.log('\nListo.');
