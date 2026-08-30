/**
 * Fix universal de WE.name placeholders + failures mal alocados.
 *
 * Para cada AMFE objetivo:
 *  1. Resuelve WE.name placeholders pobres:
 *     - Si WE tiene 0 failures: ELIMINAR el WE entero
 *     - Si WE tiene failures: renombrar a "Pendiente definicion equipo APQP" (placeholder valido por regla amfe-aph-pending.md)
 *     - Marca cada cambio con _autoFilled flag
 *  2. Mueve failures mal alocados (keyword pertenece a otra OP):
 *     - Encuentra OP destino por tags (canonica del auditor)
 *     - Si encuentra exactamente 1 OP destino: mueve el failure con sus causes intactas
 *     - Si encuentra varias: toma la primera por opNumber asc
 *     - Si no encuentra: deja in-place + log ORPHAN
 *  3. Limpia WE.name con foreign opNumber (residuo de renumeracion):
 *     - Reemplaza con "Pendiente definicion equipo APQP"
 *
 * NO inventa: nombres de maquinas, controles, frecuencias. Solo mueve o elimina.
 *
 * Uso:
 *   node scripts/_fixAmfePlaceholdersAndAllocation.mjs                         # dry-run TODOS los AMFEs
 *   node scripts/_fixAmfePlaceholdersAndAllocation.mjs --filter=HF-PAT         # solo uno (dry-run)
 *   node scripts/_fixAmfePlaceholdersAndAllocation.mjs --filter=HF-PAT --apply
 *   node scripts/_fixAmfePlaceholdersAndAllocation.mjs --apply --allow-new-critical  # full apply
 */
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';
import { connectSupabase } from './_lib/amfeIo.mjs';

const PLACEHOLDER = 'Pendiente definicion equipo APQP';

// ─────────────────────────────────────────────────────────────────────────────
// Heuristicas (compartidas con _auditWePlaceholdersAndAllocation.mjs)
// ─────────────────────────────────────────────────────────────────────────────

const GENERIC_LABELS = [
  'machine', 'maquina', 'maquinas',
  'man', 'mano de obra', 'mano-de-obra',
  'material', 'materiales', 'material indirecto', 'material (indirectos)', 'material (indirecto)',
  'method', 'metodo', 'metodos', 'metodo de fabricacion',
  'measurement', 'medicion', 'mediciones',
  'environment', 'medio ambiente', 'ambiente',
];

const TYPE_TRANSLATION = {
  'machine': ['machine', 'maquina'],
  'man': ['man', 'mano de obra'],
  'material': ['material'],
  'method': ['method', 'metodo'],
  'measurement': ['measurement', 'medicion'],
  'environment': ['environment', 'medio ambiente', 'ambiente'],
};

const KEYWORD_OP_TAGS = [
  { keywords: ['costura', 'costurar', 'costurado', 'puntada', 'atraque'], validOpTags: ['costura'] },
  { keywords: ['corte', 'cortar', 'cortado', 'cuchilla'], validOpTags: ['corte'] },
  { keywords: ['inyeccion', 'inyectar', 'inyectado', 'pur', 'isocianato', 'poliol', 'dosificacion', 'ratio'], validOpTags: ['inyeccion', 'pu', 'espumado'] },
  { keywords: ['embalaje', 'embalado', 'embalar', 'etiqueta producto terminado'], validOpTags: ['embalaje'] },
  { keywords: ['recepcion', 'recibir', 'recibido', 'albaran', 'proveedor mp'], validOpTags: ['recepcion'] },
  { keywords: ['varilla', 'asta funda', 'vinilo reten'], validOpTags: ['varilla', 'insercion'] },
  { keywords: ['enfundar', 'enfundado', 'funda asta', 'pliegue funda'], validOpTags: ['enfundado', 'tapizado'] },
  { keywords: ['mylar', 'plantilla forma', 'control forma'], validOpTags: ['mylar', 'control forma', 'control mylar'] },
  { keywords: ['troquelar', 'troquelado', 'espuma troquelada'], validOpTags: ['troquelado'] },
  { keywords: ['reproceso', 'retrabajo', 're-trabajo'], validOpTags: ['reproceso'] },
  { keywords: ['rebaba pu', 'fuga pu', 'fuga pur'], validOpTags: ['inyeccion', 'pu', 'espumado'] },
];

function normalize(s) {
  return (s || '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function isGenericLabel(s) {
  const n = normalize(s);
  return n && GENERIC_LABELS.map(normalize).includes(n);
}
function nameEqualsType(weName, weType) {
  if (!weName || !weType) return false;
  const variants = TYPE_TRANSLATION[normalize(weType)] || [normalize(weType)];
  return variants.includes(normalize(weName));
}
function isProcessOpPlaceholder(weName) {
  return /^proceso\s+op\s*\d*\s*$/i.test((weName || '').trim());
}
function isPlaceholderPobre(weName, weType) {
  if (!weName) return true;
  if (normalize(weName) === normalize(PLACEHOLDER)) return false; // ya placeholder valido
  return isProcessOpPlaceholder(weName) || isGenericLabel(weName) || nameEqualsType(weName, weType);
}
function hasForeignOpNumber(weName, currentOpNumber) {
  const m = /\bop\s*(\d{1,3})\b/i.exec(weName || '');
  return m && parseInt(m[1]) !== currentOpNumber;
}
function getOpTags(opName) {
  const n = normalize(opName);
  const tags = [];
  if (n.includes('costura')) tags.push('costura');
  if (n.includes('corte')) tags.push('corte');
  if (n.includes('inyeccion') || /\bpu\b/.test(n)) tags.push('inyeccion', 'pu', 'espumado');
  if (n.includes('embalaje')) tags.push('embalaje');
  if (n.includes('recepcion')) tags.push('recepcion');
  if (n.includes('varilla') || n.includes('insercion')) tags.push('varilla', 'insercion');
  if (n.includes('enfundado') || n.includes('tapizado')) tags.push('enfundado', 'tapizado');
  if (n.includes('mylar') || n.includes('control con plantilla')) tags.push('mylar', 'control mylar', 'control forma');
  if (n.includes('troquelado')) tags.push('troquelado');
  if (n.includes('reproceso') || n.includes('retrabajo')) tags.push('reproceso');
  if (n.includes('control final')) tags.push('control final');
  if (n.includes('precinto') || n.includes('bolsa') || n.includes('cierre del molde')) tags.push('inyeccion', 'pu', 'pre-inyeccion');
  return tags;
}
function detectMisallocated(failureDesc, opTags) {
  const n = normalize(failureDesc);
  const matchedRules = [];
  for (const rule of KEYWORD_OP_TAGS) {
    for (const kw of rule.keywords) {
      if (n.includes(normalize(kw))) {
        matchedRules.push({ keyword: kw, validOpTags: rule.validOpTags });
        break;
      }
    }
  }
  if (matchedRules.length === 0) return null;
  const anyCoherent = matchedRules.some(r => r.validOpTags.some(t => opTags.includes(t)));
  if (anyCoherent) return null;  // OP actual cubre al menos una keyword
  if (matchedRules.length >= 2) {
    const allShare = matchedRules.every(r => matchedRules[0].validOpTags.some(t => r.validOpTags.includes(t)));
    if (!allShare) return null;  // ambiguo, no mover
  }
  return { keyword: matchedRules[0].keyword, expectedOpTags: matchedRules[0].validOpTags };
}

function ensureFunctionSlot(op, weType = 'Method') {
  if (!Array.isArray(op.workElements) || op.workElements.length === 0) {
    op.workElements = [{ type: weType, name: PLACEHOLDER, functions: [{ description: PLACEHOLDER, failures: [] }] , _autoFilled: ['name', 'function'] }];
  }
  const we = op.workElements[0];
  if (!Array.isArray(we.functions) || we.functions.length === 0) {
    we.functions = [{ description: PLACEHOLDER, failures: [] }];
  }
  if (!Array.isArray(we.functions[0].failures)) we.functions[0].failures = [];
  return we.functions[0];
}

function findDestinationOp(doc, expectedOpTags) {
  // Devuelve la OP del mismo doc cuya OP tag matchee, ordenadas por opNumber asc
  const candidates = (doc.operations || []).filter(op => {
    const tags = getOpTags(op.name || op.operationName || '');
    return expectedOpTags.some(t => tags.includes(t));
  }).sort((a, b) => parseInt(a.opNumber || a.operationNumber) - parseInt(b.opNumber || b.operationNumber));
  return candidates[0] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Args + Supabase
// ─────────────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const filter = (argv.find(a => a.startsWith('--filter='))?.split('=')[1]) || null;
const allowNewCritical = argv.includes('--allow-new-critical');
const { apply } = parseSafeArgs();

const sb = await connectSupabase();

let q = sb.from('amfe_documents').select('id, amfe_number, project_name, data');
if (filter) q = q.ilike('amfe_number', `%${filter}%`);
const { data: rows, error } = await q;
if (error) { console.error(error); process.exit(2); }

// ─────────────────────────────────────────────────────────────────────────────
// Process each AMFE
// ─────────────────────────────────────────────────────────────────────────────

const allPlans = [];
const summary = { amfes: 0, weElim: 0, weRenamed: 0, failuresMoved: 0, orphans: 0 };

for (const row of rows || []) {
  const before = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  if (!before || !Array.isArray(before.operations)) continue;
  const after = JSON.parse(JSON.stringify(before));

  console.log(`\n--- ${row.amfe_number} (${row.project_name}) ---`);
  let changes = 0;

  // ── Paso 1: Resolver WE.name placeholders + foreign opNumber
  for (const op of after.operations) {
    const opNumber = parseInt(op.opNumber || op.operationNumber);
    const workElements = op.workElements || [];
    const weToRemoveIdx = [];

    for (let wi = 0; wi < workElements.length; wi++) {
      const we = workElements[wi];
      const weName = we.name || we.description || '';
      const weType = we.type || '';

      const pobre = isPlaceholderPobre(weName, weType);
      const foreign = hasForeignOpNumber(weName, opNumber);

      if (!pobre && !foreign) continue;

      // Cuenta failures totales en este WE
      const totalFailures = (we.functions || []).reduce((acc, fn) => acc + (fn.failures || []).length, 0);

      if (totalFailures === 0) {
        // ELIMINAR WE sin failures
        console.log(`  OP ${opNumber}: ELIMINAR WE[${wi}] "${weName}" (sin failures)`);
        weToRemoveIdx.push(wi);
        summary.weElim++;
        changes++;
      } else {
        // RENOMBRAR a placeholder
        console.log(`  OP ${opNumber}: RENOMBRAR WE[${wi}] "${weName}" -> "${PLACEHOLDER}" (${totalFailures} failures preservados)`);
        we.name = PLACEHOLDER;
        we.description = PLACEHOLDER;
        we._autoFilled = Array.from(new Set([...(we._autoFilled || []), 'name']));
        summary.weRenamed++;
        changes++;
      }
    }

    // Remove en orden inverso para no romper indices
    for (const idx of weToRemoveIdx.sort((a, b) => b - a)) {
      op.workElements.splice(idx, 1);
    }
  }

  // ── Paso 2: Mover failures mal alocados
  // Iterar SOBRE COPIA porque vamos a mutar
  const opsSnapshot = after.operations.map(op => ({ op, snapshot: JSON.parse(JSON.stringify(op.workElements || [])) }));

  for (const { op } of opsSnapshot) {
    const opNumber = parseInt(op.opNumber || op.operationNumber);
    const opName = op.name || op.operationName || '';
    const opTags = getOpTags(opName);

    for (let wi = 0; wi < (op.workElements || []).length; wi++) {
      const we = op.workElements[wi];
      for (let fi = 0; fi < (we.functions || []).length; fi++) {
        const fn = we.functions[fi];
        const failuresToMove = [];

        for (let mi = 0; mi < (fn.failures || []).length; mi++) {
          const fm = fn.failures[mi];
          const fmDesc = fm.description || fm.failureMode || '';
          if (!fmDesc) continue;
          const mis = detectMisallocated(fmDesc, opTags);
          if (mis) {
            const dstOp = findDestinationOp(after, mis.expectedOpTags);
            if (dstOp) {
              failuresToMove.push({ idx: mi, fm, dstOp, keyword: mis.keyword });
            } else {
              console.log(`  OP ${opNumber}: ORPHAN failure "${fmDesc.substring(0, 50)}..." (no dst OP encontrada para tags ${mis.expectedOpTags.join('/')})`);
              summary.orphans++;
            }
          }
        }

        // Mover en orden inverso
        for (const m of failuresToMove.sort((a, b) => b.idx - a.idx)) {
          fn.failures.splice(m.idx, 1);
          const dstFn = ensureFunctionSlot(m.dstOp, we.type || 'Method');
          dstFn.failures.push(m.fm);
          const dstNum = parseInt(m.dstOp.opNumber || m.dstOp.operationNumber);
          console.log(`  OP ${opNumber}: MOVER failure "${(m.fm.description || '').substring(0, 50)}..." (keyword="${m.keyword}") -> OP ${dstNum}`);
          summary.failuresMoved++;
          changes++;
        }
      }
    }
  }

  // ── Paso 3: Asegurar que cada OP tenga al menos 1 WE si tiene failures
  // (precaucion contra eliminacion total)
  for (const op of after.operations) {
    const totalFails = (op.workElements || []).reduce((acc, we) => acc + (we.functions || []).reduce((a, fn) => a + (fn.failures || []).length, 0), 0);
    if ((op.workElements || []).length === 0 && totalFails > 0) {
      // No deberia pasar pero por las dudas
      op.workElements = [{ type: 'Method', name: PLACEHOLDER, functions: [{ description: PLACEHOLDER, failures: [] }], _autoFilled: ['name', 'function'] }];
      console.log(`  OP ${op.opNumber || op.operationNumber}: WE de emergencia creado (tenia failures sin WE)`);
    }
  }

  if (changes === 0) {
    console.log('  (sin cambios)');
    continue;
  }

  allPlans.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name || '', before, after });
  summary.amfes++;
}

console.log(`\n=== Resumen ===`);
console.log(`AMFEs con cambios:   ${summary.amfes}`);
console.log(`WEs eliminados:      ${summary.weElim}`);
console.log(`WEs renombrados:     ${summary.weRenamed}`);
console.log(`Failures movidos:    ${summary.failuresMoved}`);
console.log(`Failures orphan:     ${summary.orphans}`);

if (allPlans.length === 0) {
  console.log('Nada que aplicar.');
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate + Commit
// ─────────────────────────────────────────────────────────────────────────────

await runWithValidation(allPlans, apply, async () => {
  for (const p of allPlans) {
    const { error: upErr } = await sb.from('amfe_documents')
      .update({ data: p.after, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (upErr) { console.error(`Error update ${p.amfeNumber}:`, upErr); process.exit(2); }
    console.log(`Aplicado: ${p.amfeNumber}`);
  }
}, { allowNewCritical });
