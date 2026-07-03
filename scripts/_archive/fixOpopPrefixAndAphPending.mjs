// Fix 1: "OPOP 10" prefix duplicado en opNumber (Telas Planas PWA)
// Fix 2: Causas AP=H sin accion -> "Pendiente definicion equipo APQP"
//   (regla durable .claude/rules/amfe-aph-pending.md autorizada por Fak 2026-04-20)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => {
    const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()];
  })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const PLACEHOLDER = 'Pendiente definicion equipo APQP';

function hasRealAction(cause) {
  const candidates = [
    cause.optimizationAction,
    cause.preventionAction,
    cause.detectionAction,
    cause.action,
    cause.correctiveAction,
  ];
  for (const c of candidates) {
    if (!c) continue;
    const s = String(c).trim();
    if (s.length < 3) continue;
    if (s.toLowerCase().includes('pendiente defin')) continue;
    if (s.toLowerCase() === 'tbd') continue;
    return true;
  }
  return false;
}

function isApH(cause) {
  const v = cause.ap || cause.actionPriority;
  if (!v) return false;
  const s = String(v).trim().toUpperCase();
  return s === 'H' || s === 'HIGH' || s === 'ALTA';
}

const { data: docs } = await sb.from('amfe_documents').select('id, amfe_number, data');

let opopFixed = 0;
let aphFilled = 0;
let docsModified = 0;

for (const d of docs) {
  const data = typeof d.data === 'string' ? JSON.parse(d.data) : d.data;
  let changed = false;

  // Fix 1: "OPOP" prefix en opNumber / operationNumber
  for (const op of data.operations || []) {
    for (const field of ['opNumber', 'operationNumber']) {
      if (op[field] && /^OPOP\s*/i.test(String(op[field]))) {
        const before = op[field];
        op[field] = String(op[field]).replace(/^OPOP\s*/i, '').trim();
        console.log(`  ${d.amfe_number} OP fix: "${before}" -> "${op[field]}"`);
        opopFixed++;
        changed = true;
      }
    }
  }

  // Fix 2: AP=H sin accion -> placeholder
  for (const op of data.operations || []) {
    for (const we of op.workElements || []) {
      for (const fn of we.functions || []) {
        for (const fail of fn.failures || []) {
          for (const cause of fail.causes || []) {
            if (!isApH(cause)) continue;
            if (hasRealAction(cause)) continue;
            // Auto-fill en MULTIPLES campos que el auditor puede chequear
            if (!cause.optimizationAction || String(cause.optimizationAction).trim().length < 3) {
              cause.optimizationAction = PLACEHOLDER;
            }
            if (!cause.preventionAction || String(cause.preventionAction).trim().length < 3) {
              cause.preventionAction = PLACEHOLDER;
            }
            if (!cause.actionTaken || String(cause.actionTaken).trim().length < 3) {
              cause.actionTaken = PLACEHOLDER;
            }
            // Default responsable/fecha/estado si vacios
            if (!cause.actionResponsible) cause.actionResponsible = 'Equipo APQP';
            if (!cause.actionDueDate) cause.actionDueDate = 'TBD';
            if (!cause.actionStatus) cause.actionStatus = 'Pendiente';
            aphFilled++;
            changed = true;
          }
        }
      }
    }
  }

  if (changed) {
    const { error: upErr } = await sb.from('amfe_documents').update({ data }).eq('id', d.id);
    if (upErr) { console.error(`${d.amfe_number}: ${upErr.message}`); continue; }
    docsModified++;
  }
}

console.log(`\n===== DONE =====`);
console.log(`OPOP prefix fixed: ${opopFixed}`);
console.log(`AP=H causes auto-filled: ${aphFilled}`);
console.log(`Docs modified: ${docsModified}`);
process.exit(0);
