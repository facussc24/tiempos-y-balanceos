/**
 * Elimina WEs con name="TBD" donde la categoria M no aplica al paso
 * (regla AIAG-VDA: si una M no aplica, omitir el WE; regla amfe-placeholder-last-resort
 * step 8).
 *
 * Casos identificados por Fak 2026-05-14:
 *  - ENFUNDADO Machine (HF-PAT, HRC-PAT, HRO-PAT): operacion manual sin maquina
 *  - INSERCION DE VARILLA Machine (HF-PAT, HRC-PAT, HRO-PAT): manual sin maquina
 *  - REPROCESO Environment (150): sin condicion ambiental especifica
 *
 * Antes de eliminar: si el WE tiene failures, moverlos al primer WE valido de
 * la misma OP. Si no hay otro WE, dejar el WE pero con TBD.
 *
 * Uso:
 *   node scripts/_omitTbdWesNotApplicable.mjs            # dry-run
 *   node scripts/_omitTbdWesNotApplicable.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { apply } = parseSafeArgs();

const { data: rows, error } = await sb.from('amfe_documents').select('id, amfe_number, project_name, data');
if (error) { console.error(error); process.exit(2); }

function normalize(s) {
  return (s || '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const allPlans = [];
let totalEliminated = 0, totalFailuresMoved = 0;

for (const row of rows || []) {
  const before = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  if (!before || !Array.isArray(before.operations)) continue;
  const after = JSON.parse(JSON.stringify(before));

  let changes = 0;

  for (const op of after.operations) {
    const opNumber = parseInt(op.opNumber || op.operationNumber);
    const opName = normalize(op.name || op.operationName || '');

    // Determinar si esta OP/WE.type debe omitirse
    const weToRemoveIdx = [];
    for (let wi = 0; wi < (op.workElements || []).length; wi++) {
      const we = op.workElements[wi];
      const weName = normalize(we.name || we.description || '');
      const weType = we.type || '';
      if (weName !== 'tbd') continue;

      let shouldOmit = false;
      let reason = '';
      if (weType === 'Machine' && (opName.includes('enfundado') || opName.includes('insercion de varilla') || opName.includes('insercion'))) {
        shouldOmit = true;
        reason = 'operacion manual sin maquina';
      }
      if (weType === 'Environment' && opName.includes('reproceso')) {
        shouldOmit = true;
        reason = 'reproceso sin condicion ambiental especifica';
      }
      if (!shouldOmit) continue;

      // Verificar failures dentro del WE
      const totalFailures = (we.functions || []).reduce((acc, fn) => acc + (fn.failures || []).length, 0);

      if (totalFailures > 0) {
        // Si hay otro WE valido en la misma OP, mover failures alli y eliminar este
        const dstWe = op.workElements.find((w, idx) => idx !== wi && normalize(w.name || '') !== 'tbd');
        if (dstWe) {
          if (!Array.isArray(dstWe.functions) || dstWe.functions.length === 0) {
            dstWe.functions = [{ description: 'Pendiente definicion', failures: [] }];
          }
          if (!Array.isArray(dstWe.functions[0].failures)) dstWe.functions[0].failures = [];
          for (const fn of (we.functions || [])) {
            for (const fm of (fn.failures || [])) {
              dstWe.functions[0].failures.push(fm);
              totalFailuresMoved++;
            }
          }
          console.log(`  ${row.amfe_number} OP ${opNumber}: movidos ${totalFailures} failures de WE[${wi}] (${weType}) -> WE "${dstWe.name}" (${dstWe.type})`);
          console.log(`  ${row.amfe_number} OP ${opNumber}: ELIMINAR WE[${wi}] (${weType}) — ${reason}`);
          weToRemoveIdx.push(wi);
          totalEliminated++;
          changes++;
          continue;
        }
        // No hay otro WE valido. En vez de eliminar (dejaria EMPTY_OP), reconvertir
        // el WE a type=Man con nombre real (la operacion es realizada por operador).
        let newType = 'Man';
        let newName = 'Operador de produccion';
        if (opName.includes('enfundado')) newName = 'Operador de tapizado';
        else if (opName.includes('insercion de varilla')) newName = 'Operador de insercion de varilla';
        else if (opName.includes('insercion')) newName = 'Operador de insercion';
        // Reproceso environment caso: NO aplica reconvertir, mantener
        if (weType === 'Environment') {
          console.warn(`  ${row.amfe_number} OP ${opNumber}: WE[${wi}] Environment con ${totalFailures} failures y sin otro WE — NO eliminar, mantener TBD`);
          continue;
        }
        we.type = newType;
        we.name = newName;
        we.description = newName;
        we._autoFilled = Array.from(new Set([...(we._autoFilled || []), 'name', 'type']));
        console.log(`  ${row.amfe_number} OP ${opNumber}: RECONVERTIR WE[${wi}] ${weType} -> ${newType} "${newName}" (${totalFailures} failures preservados)`);
        changes++;
        continue;
      }

      // Sin failures: eliminar limpio
      console.log(`  ${row.amfe_number} OP ${opNumber}: ELIMINAR WE[${wi}] (${weType}) — ${reason} (sin failures)`);
      weToRemoveIdx.push(wi);
      totalEliminated++;
      changes++;
    }

    // Eliminar en orden inverso
    for (const idx of weToRemoveIdx.sort((a, b) => b - a)) {
      op.workElements.splice(idx, 1);
    }
  }

  if (changes === 0) continue;
  allPlans.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name || '', before, after });
}

console.log(`\n=== Resumen ===`);
console.log(`WEs eliminados:        ${totalEliminated}`);
console.log(`Failures movidos:      ${totalFailuresMoved}`);
console.log(`AMFEs afectados:       ${allPlans.length}`);

if (allPlans.length === 0) {
  console.log('Nada que aplicar.');
  process.exit(0);
}

await runWithValidation(allPlans, apply, async () => {
  for (const p of allPlans) {
    const { error: upErr } = await sb.from('amfe_documents')
      .update({ data: p.after, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (upErr) { console.error(`Error update ${p.amfeNumber}:`, upErr); process.exit(2); }
    console.log(`Aplicado: ${p.amfeNumber}`);
  }
}, { allowNewCritical: true });
