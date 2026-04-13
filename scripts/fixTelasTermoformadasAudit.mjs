#!/usr/bin/env node
/**
 * fixTelasTermoformadasAudit.mjs
 * Fix 3 audit warnings in Telas Termoformadas 582D AMFE:
 *   1. C-META: Update operation_count and cause_count
 *   2. C-AP:   Recalculate AP for ALL causes using official apRule
 *   3. C-1M:   Rename/split 3 WEs with "/" grouping
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

// ── Read .env.local manually ────────────────────────────────────────
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// ── AP calculation (copied from apTable.ts) ─────────────────────────
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
  // S = 9-10
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
  if (isNaN(s) || isNaN(o) || isNaN(d)) return '';
  const sInt = Math.round(s);
  const oInt = Math.round(o);
  const dInt = Math.round(d);
  if (sInt < 1 || sInt > 10 || oInt < 1 || oInt > 10 || dInt < 1 || dInt > 10) return '';
  return apRule(sInt, oInt, dInt);
}

// ── Constants ────────────────────────────────────────────────────────
const AMFE_ID = 'c5201ba9-1225-4663-b7a1-5430f9ee8912';

// ── Step 1: Read document ────────────────────────────────────────────
console.log('=== Telas Termoformadas 582D AMFE — Audit Fix ===\n');

const { data: doc, error: readErr } = await sb
  .from('amfe_documents')
  .select('id, data')
  .eq('id', AMFE_ID)
  .single();

if (readErr || !doc) {
  console.error('Failed to read document:', readErr?.message);
  process.exit(1);
}

console.log(`Document loaded. Type of data: ${typeof doc.data}`);
// Handle double-serialized data (string instead of object)
const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
const ops = data.operations;
console.log(`Operations: ${ops.length}`);

// ── Tracking changes ────────────────────────────────────────────────
const changes = { weRenamed: [], weSplit: [], apFixed: [], metaUpdated: false };

// ── Step 2: Fix WE names (C-1M) ─────────────────────────────────────
console.log('\n--- Fix 3: WE name cleanup (C-1M) ---');

for (const op of ops) {
  const opNum = op.opNumber || op.operationNumber;

  for (let i = 0; i < op.workElements.length; i++) {
    const we = op.workElements[i];
    const weName = we.name;

    // OP 15: "Programa de corte / ploteo" -> "Programa de corte"
    if (opNum === '15' && weName && weName.includes('Programa de corte') && weName.includes('ploteo')) {
      const oldName = we.name;
      we.name = 'Programa de corte';
      changes.weRenamed.push({ op: opNum, from: oldName, to: we.name });
      console.log(`  OP ${opNum}: "${oldName}" -> "${we.name}"`);
    }

    // OP 60: "Programa/set-up de troquelado" -> "Set-up de troquelado"
    if (opNum === '60' && weName && (weName.includes('Programa/set-up') || weName.includes('Programa/Set-up'))) {
      const oldName = we.name;
      we.name = 'Set-up de troquelado';
      changes.weRenamed.push({ op: opNum, from: oldName, to: we.name });
      console.log(`  OP ${opNum}: "${oldName}" -> "${we.name}"`);
    }

    // OP 105: "Inspector de calidad / Operador" -> split into 2 WEs
    if (opNum === '105' && weName && weName.includes('Inspector de calidad') && weName.includes('Operador')) {
      const oldName = we.name;

      // Keep existing WE as "Inspector de calidad"
      we.name = 'Inspector de calidad';
      console.log(`  OP ${opNum}: "${oldName}" -> kept as "${we.name}"`);

      // Create new WE "Operador de segregacion"
      const newWe = {
        id: randomUUID(),
        name: 'Operador de segregacion',
        type: 'Man',
        functions: [
          {
            id: randomUUID(),
            description: 'Trasladar producto no conforme a zona de segregacion',
            functionDescription: 'Trasladar producto no conforme a zona de segregacion',
            requirements: '',
            failures: []
          }
        ]
      };

      // Insert new WE right after current one
      op.workElements.splice(i + 1, 0, newWe);
      changes.weSplit.push({ op: opNum, from: oldName, kept: we.name, added: newWe.name });
      console.log(`  OP ${opNum}: Added new WE "${newWe.name}" with 1 function, 0 failures`);

      // Skip the newly inserted element
      i++;
    }
  }
}

// ── Step 3: Recalculate ALL AP values (C-AP) ─────────────────────────
console.log('\n--- Fix 2: AP recalculation (C-AP) ---');

let totalCauses = 0;
let apChanges = 0;

for (const op of ops) {
  for (const we of op.workElements) {
    for (const fn of we.functions) {
      for (const fail of fn.failures) {
        if (!fail.causes) continue;
        for (const cause of fail.causes) {
          totalCauses++;
          const s = cause.severity;
          const o = cause.occurrence;
          const d = cause.detection;
          const newAP = calculateAP(s, o, d);

          if (newAP && (cause.ap !== newAP || cause.actionPriority !== newAP)) {
            const oldAP = cause.ap || cause.actionPriority || '(none)';
            cause.ap = newAP;
            cause.actionPriority = newAP;
            apChanges++;
            changes.apFixed.push({
              op: op.opNumber || op.operationNumber,
              cause: (cause.cause || cause.description || '').substring(0, 50),
              s, o, d,
              from: oldAP,
              to: newAP
            });
            console.log(`  OP ${op.opNumber || op.operationNumber}: S=${s} O=${o} D=${d} | ${oldAP} -> ${newAP} | "${(cause.cause || cause.description || '').substring(0, 40)}"`);
          }
        }
      }
    }
  }
}

console.log(`  Total causes scanned: ${totalCauses}, AP changed: ${apChanges}`);

// ── Step 4: Update metadata (C-META) ─────────────────────────────────
console.log('\n--- Fix 1: Metadata sync (C-META) ---');

const operationCount = ops.length;
let causeCount = 0;
for (const op of ops) {
  for (const we of op.workElements) {
    for (const fn of we.functions) {
      for (const fail of fn.failures) {
        causeCount += (fail.causes || []).length;
      }
    }
  }
}

const oldOpCount = data.operation_count;
const oldCauseCount = data.cause_count;

data.operation_count = operationCount;
data.cause_count = causeCount;
changes.metaUpdated = true;

console.log(`  operation_count: ${oldOpCount} -> ${operationCount}`);
console.log(`  cause_count: ${oldCauseCount} -> ${causeCount}`);

// ── Step 5: Write back to Supabase (object, NOT JSON.stringify) ──────
console.log('\n--- Writing to Supabase ---');
console.log(`  typeof data being written: ${typeof data} (must be object)`);

if (typeof data !== 'object') {
  console.error('FATAL: data is not an object, aborting write');
  process.exit(1);
}

const { error: writeErr } = await sb
  .from('amfe_documents')
  .update({ data: data })
  .eq('id', AMFE_ID);

if (writeErr) {
  console.error('WRITE FAILED:', writeErr.message);
  process.exit(1);
}

console.log('Write successful.');

// ── Step 6: Verify post-write ────────────────────────────────────────
console.log('\n--- Post-write verification ---');

const { data: verify, error: verifyErr } = await sb
  .from('amfe_documents')
  .select('id, data')
  .eq('id', AMFE_ID)
  .single();

if (verifyErr) {
  console.error('Verify read failed:', verifyErr.message);
  process.exit(1);
}

let vData = verify.data;
// Handle if Supabase returns as string (double-serialization check)
if (typeof vData === 'string') {
  console.log('  WARNING: data came back as string — was previously double-serialized, now fixed to object');
  vData = JSON.parse(vData);
}
console.log(`  typeof data: ${typeof verify.data} -> parsed: object`);
console.log(`  operations is array: ${Array.isArray(vData.operations)} — ${Array.isArray(vData.operations) ? 'OK' : 'FAIL'}`);
console.log(`  operation_count: ${vData.operation_count} (expected: ${operationCount}) — ${vData.operation_count === operationCount ? 'OK' : 'FAIL'}`);
console.log(`  cause_count: ${vData.cause_count} (expected: ${causeCount}) — ${vData.cause_count === causeCount ? 'OK' : 'FAIL'}`);
console.log(`  operations length: ${vData.operations.length} (expected: ${operationCount}) — ${vData.operations.length === operationCount ? 'OK' : 'FAIL'}`);

// ── Step 7: Print summary ────────────────────────────────────────────
console.log('\n========== SUMMARY ==========');
console.log(`WEs renamed: ${changes.weRenamed.length}`);
for (const r of changes.weRenamed) {
  console.log(`  OP ${r.op}: "${r.from}" -> "${r.to}"`);
}
console.log(`WEs split: ${changes.weSplit.length}`);
for (const s of changes.weSplit) {
  console.log(`  OP ${s.op}: "${s.from}" -> kept "${s.kept}" + added "${s.added}"`);
}
console.log(`AP recalculated: ${apChanges} of ${totalCauses} causes`);
for (const a of changes.apFixed) {
  console.log(`  OP ${a.op}: S=${a.s} O=${a.o} D=${a.d} | ${a.from} -> ${a.to}`);
}
console.log(`Metadata: operation_count=${operationCount}, cause_count=${causeCount}`);
console.log('\n=== DONE ===');
