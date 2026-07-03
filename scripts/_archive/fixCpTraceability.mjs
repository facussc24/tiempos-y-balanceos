/**
 * fixCpTraceability.mjs
 *
 * Linkea los items "manuales" del CP Maestro de Inyeccion (sin amfeCauseIds)
 * a causas/failures reales del AMFE Maestro, usando matching heuristico
 * por keywords basado en processCharacteristic / productCharacteristic del CP
 * vs cause.description / failure.description del AMFE.
 *
 * Scope:
 *   - CP:    81b60cdd-1296-4821-a348-a8e3c2433b0d (Maestro Inyeccion)
 *   - AMFE:  4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c (Maestro Inyeccion)
 *
 * Reglas:
 *   - NO modificar items que ya tienen amfeCauseIds con length > 0
 *   - NO regenerar el CP — solo actualizar los 11 items manuales
 *   - NO tocar el AMFE maestro
 *   - NO asignar CC/SC, NO inventar acciones
 *   - Para items matched: quitar 'manualControl' de autoFilledFields,
 *     agregar 'linkedToAmfe', setear amfeCauseIds/amfeFailureId/linkedAmfeOperationId
 *   - Items sin match: dejar amfeCauseIds=[] y agregar notes explicando por que
 *   - La columna data del CP es TEXT: JSON.parse al leer, JSON.stringify al escribir
 *   - amfe_documents.data puede ser object (jsonb) o string — manejar ambos
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

const MASTER_AMFE_ID = '4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c';
const MASTER_CP_ID = '81b60cdd-1296-4821-a348-a8e3c2433b0d';

// ── Helpers ────────────────────────────────────────────────────────────────
function parseData(raw) {
  if (typeof raw === 'string') return JSON.parse(raw);
  if (raw && typeof raw === 'object') return raw;
  throw new Error('data column tiene tipo inesperado: ' + typeof raw);
}

function norm(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAll(text, keywords) {
  return keywords.every(k => text.includes(k));
}

function hasAny(text, keywords) {
  return keywords.some(k => text.includes(k));
}

// ── 1. Leer AMFE y construir indice ───────────────────────────────────────
console.log('1. Leyendo AMFE maestro...');
const { data: amfeRow, error: aErr } = await sb
  .from('amfe_documents')
  .select('id, data')
  .eq('id', MASTER_AMFE_ID)
  .single();
if (aErr || !amfeRow) { console.error('ERROR leyendo AMFE:', aErr); process.exit(1); }

const amfeData = parseData(amfeRow.data);
if (!Array.isArray(amfeData.operations)) {
  console.error('ERROR: amfeData.operations no es array');
  process.exit(1);
}

// Indice: lista plana de causes con contexto para matching
// cada entry: { opNumber, opName, opId, failureId, failureDesc, causeId, causeDesc, allText }
const causeIndex = [];
for (const op of amfeData.operations) {
  const opNumber = String(op.opNumber || op.operationNumber || '');
  const opName = op.name || op.operationName || '';
  const opId = op.id;
  for (const we of (op.workElements || [])) {
    for (const func of (we.functions || [])) {
      for (const fail of (func.failures || [])) {
        const failureDesc = fail.description || '';
        for (const cause of (fail.causes || [])) {
          const causeDesc = cause.cause || cause.description || '';
          const allText = norm(`${causeDesc} ${failureDesc} ${we.name || ''}`);
          causeIndex.push({
            opNumber, opName, opId,
            failureId: fail.id,
            failureDesc,
            causeId: cause.id,
            causeDesc,
            weName: we.name || '',
            weType: we.type || '',
            allText,
            normCause: norm(causeDesc),
            normFail: norm(failureDesc),
          });
        }
      }
    }
  }
}
console.log(`   ${causeIndex.length} causas indexadas del AMFE`);
console.log(`   Operaciones AMFE: ${amfeData.operations.map(o => `${o.opNumber || o.operationNumber}=${o.name || o.operationName}`).join(' | ')}`);

// Indice de operaciones -> id
const opIdByNumber = new Map();
for (const op of amfeData.operations) {
  opIdByNumber.set(String(op.opNumber || op.operationNumber || ''), op.id);
}

// ── 2. Leer CP ─────────────────────────────────────────────────────────────
console.log('\n2. Leyendo CP maestro...');
const { data: cpRow, error: cErr } = await sb
  .from('cp_documents')
  .select('id, data')
  .eq('id', MASTER_CP_ID)
  .single();
if (cErr || !cpRow) { console.error('ERROR leyendo CP:', cErr); process.exit(1); }

const cpData = parseData(cpRow.data);
if (!Array.isArray(cpData.items)) {
  console.error('ERROR: cpData.items no es array');
  process.exit(1);
}
console.log(`   ${cpData.items.length} items totales en CP`);

// Items a procesar: aquellos sin amfeCauseIds O aquellos que fueron linkeados por este mismo script
// en una corrida previa (tienen 'linkedToAmfe' en autoFilledFields). Esto permite re-matching
// cuando se ajustan las reglas de keyword. Items generados por Fase 1-3 del generator original
// NO se tocan (no tienen 'linkedToAmfe' — tienen 'sampleSize', 'reactionPlan', etc.).
const manualItems = cpData.items.filter(it => {
  const noCauseIds = !Array.isArray(it.amfeCauseIds) || it.amfeCauseIds.length === 0;
  const wasLinkedByThisScript = Array.isArray(it.autoFilledFields) && it.autoFilledFields.includes('linkedToAmfe');
  return noCauseIds || wasLinkedByThisScript;
});
console.log(`   ${manualItems.length} items sin amfeCauseIds o previamente linkeados (candidatos a linkear)`);

// ── 3. Matchers por keywords ──────────────────────────────────────────────
// Cada matcher retorna un array de entries del causeIndex que matchean.
// Usamos el processCharacteristic / productCharacteristic del item CP como key.

function matchItem(item) {
  const pc = norm(item.processCharacteristic || '');
  const prodc = norm(item.productCharacteristic || '');
  const key = pc || prodc;
  const opNumber = String(item.processStepNumber || '');
  const machine = norm(item.machineDeviceTool || '');

  // Filtro primario: causas de la misma operacion
  let sameOp = causeIndex.filter(c => c.opNumber === opNumber);

  // Excepcion cross-op: items de mantenimiento/limpieza de molde estan en OP30 del CP
  // pero las causas correspondientes del AMFE estan en OP20 (INYECCION).
  // Para estos, ampliar el pool a OP20.
  const isMoldMaint = hasAny(key, ['molde']) && hasAny(key, ['limpieza', 'mantenimiento', 'preventivo', 'lubricacion']);
  if (isMoldMaint) {
    const op20 = causeIndex.filter(c => c.opNumber === '20');
    sameOp = [...sameOp, ...op20];
  }

  const results = new Set();
  const add = (list) => { for (const c of list) results.add(c); };

  // ─── Reglas por keyword sobre processCharacteristic / productCharacteristic ───

  // Certificado del proveedor / lote
  if (hasAny(key, ['certificado'])) {
    add(sameOp.filter(c =>
      hasAny(c.allText, ['certificado']) ||
      hasAll(c.allText, ['lote', 'proveedor'])
    ));
  }

  // Temperatura de tolva secadora
  if (hasAll(key, ['temperatura']) && hasAny(key, ['tolva', 'secadora', 'secado'])) {
    add(sameOp.filter(c =>
      (hasAny(c.allText, ['temperatura']) && hasAny(c.allText, ['secad', 'tolva'])) ||
      hasAny(c.allText, ['lectura', 'pirometro', 'termometro']) && hasAny(c.allText, ['secad', 'tolva'])
    ));
  }

  // Tiempo de secado
  if (hasAll(key, ['tiempo']) && hasAny(key, ['secado', 'secad'])) {
    add(sameOp.filter(c =>
      hasAll(c.allText, ['tiempo']) && hasAny(c.allText, ['secad']) ||
      hasAny(c.allText, ['humedad']) && hasAny(c.allText, ['residual', 'insuficiente'])
    ));
  }

  // Refrigeracion del tornillo / garganta / boca de alimentacion
  if (hasAny(key, ['refrigeracion']) && hasAny(key, ['tornillo', 'garganta'])) {
    add(sameOp.filter(c =>
      hasAny(c.allText, ['refrigeracion', 'refrigerac']) && hasAny(c.allText, ['tornillo', 'garganta', 'boca']) ||
      hasAll(c.allText, ['boca', 'alimentacion']) ||
      hasAny(c.allText, ['pasta']) && hasAny(c.allText, ['tornillo', 'garganta', 'boca'])
    ));
  }

  // Parametros de proceso vs dossier
  if (hasAny(key, ['parametros', 'parametro']) && hasAny(key, ['dossier', 'proceso'])) {
    add(sameOp.filter(c =>
      hasAny(c.allText, ['dossier']) ||
      hasAll(c.allText, ['parametros', 'producto']) ||
      hasAny(c.allText, ['desactualizado']) ||
      hasAll(c.allText, ['procedimiento', 'arranque']) ||
      hasAll(c.allText, ['otro', 'producto'])
    ));
  }

  // Fuerza de cierre
  if (hasAll(key, ['fuerza', 'cierre'])) {
    add(sameOp.filter(c =>
      hasAll(c.allText, ['fuerza', 'cierre']) ||
      hasAny(c.allText, ['rebaba', 'flash']) && hasAny(c.allText, ['fuerza', 'cierre'])
    ));
  }

  // Filtro de aspiradora / sistema neumatico / aire
  if (hasAll(key, ['filtro'])) {
    add(sameOp.filter(c =>
      hasAny(c.allText, ['filtro']) ||
      hasAll(c.allText, ['aire', 'comprimido']) ||
      hasAny(c.allText, ['aspirador', 'aspiradora']) ||
      hasAny(c.allText, ['contamina']) && hasAny(c.allText, ['material', 'aire'])
    ));
  }

  // Dimensional de pieza
  if (hasAny(prodc, ['dimensional']) || hasAny(key, ['dimensional'])) {
    add(sameOp.filter(c =>
      hasAny(c.allText, ['dimensional']) ||
      hasAll(c.allText, ['fuera', 'medida']) ||
      hasAll(c.allText, ['fuera', 'tolerancia']) ||
      hasAny(c.allText, ['contraccion'])
    ));
  }

  // Inspeccion visual 100% defectos tipicos (pattern board)
  // Cubre rebabas, quemaduras, faltas de llenado, chupados, deformaciones, rayas
  if (hasAny(prodc, ['inspeccion', 'visual', 'defectos'])) {
    add(sameOp.filter(c =>
      hasAny(c.allText, [
        'rebaba', 'flash', 'quemadu', 'chupad', 'rechup', 'sink',
        'deform', 'pieza incompleta', 'falta de llenado', 'falta de llena',
        'raya', 'marca', 'aspecto', 'apariencia', 'color'
      ])
    ));
  }

  // Limpieza de molde al bajarlo — cubre fallas de canales obstruidos y venteos tapados
  if (hasAny(key, ['limpieza']) && hasAny(key, ['molde'])) {
    add(sameOp.filter(c =>
      // causa explicita sobre limpieza/soplado/purga al bajar molde
      hasAny(c.allText, ['soplado', 'limpieza']) && hasAny(c.allText, ['canal', 'venteo', 'molde', 'bajar']) ||
      // failure de canales obstruidos / venteos tapados / oxidacion
      hasAny(c.normFail, ['canal']) && hasAny(c.normFail, ['refriger', 'obstru']) ||
      hasAny(c.normFail, ['venteo']) && hasAny(c.normFail, ['tapad', 'obstru'])
    ));
  }

  // Mantenimiento preventivo de molde — cubre desgaste, expulsores, insertos, linea de junta
  // IMPORTANTE: filtrar solo causas asociadas a failures del molde (no calibre, no rebabas)
  if (hasAny(key, ['mantenimiento', 'preventivo']) && hasAny(key, ['molde'])) {
    const moldFailuresOnly = sameOp.filter(c =>
      // failure relacionado con mold hardware
      hasAny(c.normFail, ['expulsor', 'inserto', 'macho']) ||
      hasAll(c.normFail, ['linea', 'junta']) ||
      (hasAny(c.normFail, ['canal']) && hasAny(c.normFail, ['refriger', 'obstru'])) ||
      (hasAny(c.normFail, ['venteo']) && hasAny(c.normFail, ['tapad', 'obstru']))
    );
    // de esas failures, agregar solo las causas que aluden a mantenimiento/inspeccion/desgaste
    add(moldFailuresOnly.filter(c =>
      hasAny(c.allText, ['mantenimiento', 'preventivo', 'inspeccion periodica', 'golpes acumulados', 'desgaste', 'soplado', 'limpieza'])
    ));
  }

  return [...results];
}

// ── 4. Iterar items manuales y aplicar matches ────────────────────────────
console.log('\n3. Matching items manuales contra causas del AMFE...');

const manualItemIds = new Set(manualItems.map(m => m.id));
const updatedItems = cpData.items.map((item, idx) => {
  // Solo procesar items manuales (sin amfeCauseIds originales o previamente linkeados por este script).
  // Items generados por Fase 1-3 del generator NO se tocan.
  if (!manualItemIds.has(item.id)) {
    return item;
  }

  const matches = matchItem(item);
  const label = item.productCharacteristic || item.processCharacteristic || '(sin caracteristica)';

  if (matches.length === 0) {
    console.log(`  [${idx + 1}] OP${item.processStepNumber} "${label}" — 0 matches`);
    return {
      ...item,
      notes: 'Control complementario sin causa directa en el AMFE — cubre requerimiento de GUIA_INYECCION seccion 10.',
    };
  }

  const causeIds = [...new Set(matches.map(m => m.causeId))];
  const failureIds = [...new Set(matches.map(m => m.failureId))];
  const opId = matches[0].opId || opIdByNumber.get(String(item.processStepNumber));

  // amfeFailureId solo si hay un unico failure matched (match "limpio")
  const amfeFailureId = failureIds.length === 1 ? failureIds[0] : (item.amfeFailureId || undefined);

  // autoFilledFields: quitar manualControl, agregar linkedToAmfe
  const prevAutoFilled = Array.isArray(item.autoFilledFields) ? item.autoFilledFields : [];
  const newAutoFilled = [...new Set([
    ...prevAutoFilled.filter(f => f !== 'manualControl'),
    'linkedToAmfe',
  ])];

  console.log(`  [${idx + 1}] OP${item.processStepNumber} "${label}" — ${matches.length} matches (${causeIds.length} causas, ${failureIds.length} failures)`);
  for (const m of matches.slice(0, 5)) {
    console.log(`       - ${m.causeDesc.slice(0, 70)} | failure: ${m.failureDesc.slice(0, 50)}`);
  }
  if (matches.length > 5) console.log(`       ... y ${matches.length - 5} mas`);

  const updated = {
    ...item,
    amfeCauseIds: causeIds,
    amfeFailureIds: failureIds,
    amfeFailureId,
    linkedAmfeOperationId: opId,
    autoFilledFields: newAutoFilled,
  };
  // limpiar notes si existia de una corrida anterior
  if (updated.notes && updated.notes.includes('sin causa directa en el AMFE')) {
    delete updated.notes;
  }
  return updated;
});

// ── 5. Contar resultados ───────────────────────────────────────────────────
const stillManual = updatedItems.filter(it =>
  (!Array.isArray(it.amfeCauseIds) || it.amfeCauseIds.length === 0)
);
const nowLinked = manualItems.length - stillManual.filter(it =>
  manualItems.some(m => m.id === it.id)
).length;

console.log(`\n   Items manuales totales:       ${manualItems.length}`);
console.log(`   Items matcheados (ahora):     ${nowLinked}`);
console.log(`   Items sin match (con notes):  ${manualItems.length - nowLinked}`);

// ── 6. Guardar CP actualizado ──────────────────────────────────────────────
console.log('\n4. Guardando CP actualizado...');
const newCpData = { ...cpData, items: updatedItems };

const { error: upErr } = await sb
  .from('cp_documents')
  .update({
    data: JSON.stringify(newCpData), // TEXT column
    item_count: updatedItems.length,
  })
  .eq('id', MASTER_CP_ID);

if (upErr) { console.error('ERROR actualizando cp_documents:', upErr); process.exit(1); }
console.log('   OK: CP actualizado');

// ── 7. Verificacion post-update ────────────────────────────────────────────
console.log('\n5. Verificacion post-update...');
const { data: verify, error: vErr } = await sb
  .from('cp_documents')
  .select('id, data')
  .eq('id', MASTER_CP_ID)
  .single();

if (vErr) { console.error('ERROR verificando:', vErr); process.exit(1); }

const verifyData = parseData(verify.data);
if (!Array.isArray(verifyData.items)) {
  console.error('ERROR: verifyData.items no es array');
  process.exit(1);
}

const originalManualIds = new Set(manualItems.map(m => m.id));
const verifyManualItems = verifyData.items.filter(it => originalManualIds.has(it.id));
const verifyLinked = verifyManualItems.filter(it => Array.isArray(it.amfeCauseIds) && it.amfeCauseIds.length > 0);
const verifyWithNotes = verifyManualItems.filter(it => (!Array.isArray(it.amfeCauseIds) || it.amfeCauseIds.length === 0) && it.notes);

console.log('\n═══════════════════════════════════════════════════');
console.log('REPORTE FINAL');
console.log('═══════════════════════════════════════════════════');
console.log(`  Total items CP:                    ${verifyData.items.length}`);
console.log(`  Items manuales originales:         ${manualItems.length}`);
console.log(`  Items manuales ahora linkeados:    ${verifyLinked.length}/${manualItems.length}`);
console.log(`  Items manuales sin link (notes):   ${verifyWithNotes.length}`);

console.log('\nDetalle por item manual:');
for (const m of manualItems) {
  const curr = verifyData.items.find(it => it.id === m.id);
  if (!curr) continue;
  const label = curr.productCharacteristic || curr.processCharacteristic || '(vacio)';
  const linked = Array.isArray(curr.amfeCauseIds) && curr.amfeCauseIds.length > 0;
  const marker = linked ? 'OK ' : 'NO ';
  const info = linked
    ? `${curr.amfeCauseIds.length} causas, failureId=${curr.amfeFailureId ? curr.amfeFailureId.slice(0, 8) : 'n/a'}`
    : (curr.notes ? 'sin match (nota agregada)' : 'sin match');
  console.log(`  ${marker} OP${curr.processStepNumber} "${label.slice(0, 55)}" — ${info}`);
}

if (verifyLinked.length >= 9) {
  console.log('\nPASS: al menos 9/11 items manuales ahora estan linkeados al AMFE.');
} else {
  console.log(`\nWARN: solo ${verifyLinked.length}/11 items matcheados. Revisar reglas de matching.`);
}

console.log('\nDone.');
