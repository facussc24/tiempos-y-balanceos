/**
 * Fix: rellena focusElementFunction / operationFunction VACIOS en OPs con WEs
 * para AMFE-HF-PAT y AMFE-HRC-PAT.
 *
 * Regla aplicada (AIAG-VDA 2019 + .claude/rules/amfe.md):
 *   "Es la MISMA para todas las operaciones del mismo AMFE."
 *
 * Estrategia:
 *   - Para cada AMFE, detectar el valor canonico (el que mas OPs del mismo
 *     documento tienen no-vacio) de FEF y de OPF.
 *   - Rellenar SOLO campos vacios con ese canonico.
 *   - NUNCA sobrescribir un valor existente (aunque sea "viejo" o distinto).
 *
 * NO inventa texto. Copia de otras OPs del MISMO documento.
 *
 * Uso:
 *   node scripts/_fillHeadrestOpFunctions.mjs           # dry-run, imprime diff
 *   node scripts/_fillHeadrestOpFunctions.mjs --apply   # ejecuta
 *
 * Gate: runWithValidation bloquea si introduce issues criticos nuevos.
 */
import {
  connectSupabase,
  parseData,
  saveAmfe,
} from './_lib/amfeIo.mjs';
import {
  parseSafeArgs,
  logChange,
  finish,
  runWithValidation,
} from './_lib/dryRunGuard.mjs';

const TARGETS = ['AMFE-HF-PAT', 'AMFE-HRC-PAT'];

function pickCanonical(ops, field) {
  // Devuelve el texto que aparece en la mayoria de OPs del documento.
  const counts = new Map();
  for (const op of ops) {
    const v = (op?.[field] || '').trim();
    if (!v) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  if (counts.size === 0) return null;
  // argmax
  let best = null;
  let bestCount = 0;
  for (const [v, c] of counts.entries()) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return { value: best, count: bestCount };
}

function planForDoc(doc, amfeNumber) {
  const ops = doc?.operations || [];
  const canonFef = pickCanonical(ops, 'focusElementFunction');
  const canonOpf = pickCanonical(ops, 'operationFunction');

  const updates = [];
  for (const op of ops) {
    const hasWE = (op.workElements || []).length > 0;
    if (!hasWE) continue; // solo OPs que tienen WEs (las vacias son otra historia)
    const num = op.opNumber || op.operationNumber;
    const nm = op.name || op.operationName;
    const fefEmpty = !(op.focusElementFunction || '').trim();
    const opfEmpty = !(op.operationFunction || '').trim();
    if (fefEmpty && canonFef) {
      updates.push({
        op,
        opNumber: num,
        opName: nm,
        field: 'focusElementFunction',
        newValue: canonFef.value,
      });
    }
    if (opfEmpty && canonOpf) {
      updates.push({
        op,
        opNumber: num,
        opName: nm,
        field: 'operationFunction',
        newValue: canonOpf.value,
      });
    }
  }
  return { canonFef, canonOpf, updates };
}

function applyUpdatesInPlace(doc, updates) {
  // Muta el doc directamente (updates.op es referencia al objeto en doc.operations)
  for (const u of updates) {
    u.op[u.field] = u.newValue;
  }
}

async function main() {
  const { apply } = parseSafeArgs();
  const sb = await connectSupabase();

  const { data: rows, error } = await sb
    .from('amfe_documents')
    .select('id, amfe_number, data')
    .in('amfe_number', TARGETS);
  if (error) throw new Error('Select failed: ' + error.message);

  const plan = [];

  for (const row of rows) {
    const before = parseData(row.data);
    if (!before) {
      console.log(`[${row.amfe_number}] parse failed, skip`);
      continue;
    }
    const { canonFef, canonOpf, updates } = planForDoc(before, row.amfe_number);

    console.log(
      `\n[${row.amfe_number}] canonical FEF: ${canonFef ? canonFef.count + ' OPs' : 'NONE'} | canonical OPF: ${canonOpf ? canonOpf.count + ' OPs' : 'NONE'}`
    );

    if (updates.length === 0) {
      console.log(`  Sin campos vacios a rellenar — nada que hacer.`);
      continue;
    }

    for (const u of updates) {
      logChange(apply, `${row.amfe_number} OP ${u.opNumber} (${u.opName}) · set ${u.field}`, {
        before: '<VACIO>',
        after: u.newValue,
      });
    }

    // Construir el after aplicando los updates sobre una copia profunda
    const after = JSON.parse(JSON.stringify(before));
    // Localizar las OPs equivalentes en el after y aplicar
    const afterUpdates = updates.map((u) => {
      const afterOp = (after.operations || []).find((o) => {
        const n = o.opNumber || o.operationNumber;
        return String(n) === String(u.opNumber);
      });
      return { ...u, op: afterOp };
    });
    applyUpdatesInPlace(after, afterUpdates);

    plan.push({
      id: row.id,
      amfeNumber: row.amfe_number,
      productName: row.amfe_number,
      before,
      after,
    });
  }

  if (plan.length === 0) {
    console.log('\nNo hay cambios. Saliendo.');
    finish(apply);
    return;
  }

  await runWithValidation(plan, apply, async () => {
    for (const change of plan) {
      await saveAmfe(sb, change.id, change.after, {
        expectedAmfeNumber: change.amfeNumber,
      });
      console.log(`  ✓ saved ${change.amfeNumber}`);
    }
  });

  finish(apply);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
