/**
 * Cleanup decision Fak 2026-05-27:
 *
 * A) Reemplaza "TBD" (incluido "TBD-Leo") por "-" en cualquier campo
 *    (preventionControl, detectionControl, optimizationAction, action,
 *    preventionAction, detectionAction, function.description, WE.name, etc.)
 *
 * B) En optimizationAction, sacar referencias a "Carlos Baptista" y "pendiente"
 *    (cualquier variante). Reemplazar por "-".
 *
 * Fak dijo: "te dije que en optimizacion no ponga nada, sacalo a Carlos Baptista
 * y el estado pendiente". El optimizationAction se mantiene vacio/dash hasta que
 * el equipo APQP defina acciones reales.
 *
 * Uso:
 *   node scripts/_cleanupTbdAndOptAction.mjs            # dry-run
 *   node scripts/_cleanupTbdAndOptAction.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const DASH = '-';

const TBD_REGEX = /^tbd(-\w+)?$/i;  // "TBD", "TBD-Leo", "TBD-Leonardo", etc.
const TBD_CONTAINS = /\btbd(-\w+)?\b/i;
const PENDIENTE = /\bpendiente\b/i;
const CARLOS = /\bcarlos\s+baptista\b/i;

function normalize(s) {
  return (s || '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isTbd(s) {
  const n = normalize(s || '');
  return TBD_REGEX.test(n);
}

function isPendienteOrCarlos(s) {
  if (!s) return false;
  return PENDIENTE.test(s) || CARLOS.test(s);
}

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { apply } = parseSafeArgs();

const { data: rows, error } = await sb.from('amfe_documents').select('id, amfe_number, project_name, data');
if (error) { console.error(error); process.exit(2); }

const allPlans = [];
const summary = { tbdReplaced: 0, pendienteOrCarlos: 0 };

const FIELDS = ['preventionControl', 'detectionControl', 'optimizationAction', 'action', 'preventionAction', 'detectionAction'];

for (const row of rows || []) {
  const before = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  if (!before || !Array.isArray(before.operations)) continue;
  const after = JSON.parse(JSON.stringify(before));

  let changes = 0;

  // Recorrer toda la estructura
  for (const op of after.operations) {
    // 1) WE.name / function.description / failure.description: TBD -> "-"
    for (const we of op.workElements || []) {
      if (isTbd(we.name)) { we.name = DASH; we.description = DASH; summary.tbdReplaced++; changes++; }
      for (const fn of we.functions || []) {
        if (isTbd(fn.description)) { fn.description = DASH; summary.tbdReplaced++; changes++; }
        if (isTbd(fn.functionDescription)) { fn.functionDescription = DASH; summary.tbdReplaced++; changes++; }
        for (const fm of fn.failures || []) {
          if (isTbd(fm.description)) { fm.description = DASH; summary.tbdReplaced++; changes++; }
          if (isTbd(fm.failureMode)) { fm.failureMode = DASH; summary.tbdReplaced++; changes++; }

          // 2) cause: campos varios
          for (const c of fm.causes || []) {
            for (const k of FIELDS) {
              if (isTbd(c[k])) {
                c[k] = DASH;
                summary.tbdReplaced++;
                changes++;
              }
            }
            // B) optimizationAction: si contiene "pendiente" o "Carlos Baptista" -> "-"
            for (const k of ['optimizationAction', 'action', 'preventionAction', 'detectionAction']) {
              if (c[k] && c[k] !== DASH && isPendienteOrCarlos(c[k])) {
                console.log(`  [${row.amfe_number}] OP ${op.opNumber}: ${k} "${c[k].substring(0, 60)}..." -> "-"`);
                c[k] = DASH;
                summary.pendienteOrCarlos++;
                changes++;
              }
            }
            // optimizationActions[] (plural)
            if (Array.isArray(c.optimizationActions)) {
              for (let i = 0; i < c.optimizationActions.length; i++) {
                const item = c.optimizationActions[i];
                if (typeof item === 'string') {
                  if (isTbd(item) || isPendienteOrCarlos(item)) {
                    c.optimizationActions[i] = DASH;
                    summary.tbdReplaced++;
                    changes++;
                  }
                } else if (item && typeof item === 'object' && item.description) {
                  if (isTbd(item.description) || isPendienteOrCarlos(item.description)) {
                    item.description = DASH;
                    summary.tbdReplaced++;
                    changes++;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  if (changes === 0) continue;
  allPlans.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name || '', before, after });
}

console.log(`\n=== Resumen ===`);
console.log(`TBD -> "-":                  ${summary.tbdReplaced}`);
console.log(`pendiente/Carlos -> "-":     ${summary.pendienteOrCarlos}`);
console.log(`AMFEs afectados:             ${allPlans.length}`);

if (allPlans.length === 0) { console.log('Nada que aplicar.'); process.exit(0); }

await runWithValidation(allPlans, apply, async () => {
  for (const p of allPlans) {
    const { error: upErr } = await sb.from('amfe_documents')
      .update({ data: p.after, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (upErr) { console.error(`Error update ${p.amfeNumber}:`, upErr); process.exit(2); }
    console.log(`Aplicado: ${p.amfeNumber}`);
  }
}, { allowNewCritical: true });
