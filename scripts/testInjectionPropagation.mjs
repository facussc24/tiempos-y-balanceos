/**
 * testInjectionPropagation.mjs
 *
 * End-to-end test of cross-family propagation: when the Injection Master AMFE
 * (family id=15, "Proceso de Inyeccion Plastica") is touched, every other
 * AMFE document whose operations match any of the master's operation names
 * should receive a cross_doc_checks alert.
 *
 * Flow:
 *   1. Connect to Supabase.
 *   2. Read master AMFE (JSON.parse data).
 *   3. Snapshot pre-existing cross_doc_checks (to know what to leave alone).
 *   4. Apply a cosmetic header tweak (subject + " [TEST]"); persist.
 *   5. Re-run the cross-family scan replicating the TS logic.
 *   6. Count created rows; list affected doc subjects + matched op names.
 *   7. REVERT the header change back to the original (JSON round-trip).
 *   8. DELETE any cross_doc_checks rows created during this run so the
 *      database is left exactly as it was.
 *   9. Print a report.
 *
 * Important invariants:
 *  - amfe_documents.data is stored as TEXT in Supabase. Always
 *    JSON.parse on read / JSON.stringify on write.
 *  - The script never modifies any other amfe_document than the master,
 *    and only toggles the header.subject briefly.
 *  - If the script errors out mid-run, manual cleanup may be needed:
 *    the alert rows it creates use source_module='amfe', source_doc_id=MASTER
 *    and target_module='amfe'.
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
await sb.auth.signInWithPassword({
  email: env.VITE_AUTO_LOGIN_EMAIL,
  password: env.VITE_AUTO_LOGIN_PASSWORD,
});

const MASTER_DOC_ID = '4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c';
const FAMILY_NAME = 'Proceso de Inyeccion Plastica';
const TEST_MARKER = ' [TEST]';

// ── Normalization helpers (mirror core/inheritance/changePropagation.ts) ───
function normalizeOperationName(raw) {
  if (typeof raw !== 'string') return '';
  return raw.toUpperCase().trim().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

const SUBSTRING_STOPWORDS = new Set(['DE', 'Y', 'DEL', 'LA', 'EL', 'EN', 'A', 'O']);

function containsWholeWord(haystack, needle) {
  if (!haystack || !needle) return false;
  if (haystack === needle) return true;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`);
  return re.test(haystack);
}

function matchOperationName(targetNormName, masterNormNames) {
  if (!targetNormName) return null;
  // Rule 1: exact
  for (const master of masterNormNames) {
    if (master === targetNormName) return master;
  }
  // Rule 2: master as full-token substring of target
  for (const master of masterNormNames) {
    if (!master || master.length < 6) continue;
    if (SUBSTRING_STOPWORDS.has(master)) continue;
    if (containsWholeWord(targetNormName, master)) return master;
  }
  return null;
}

function extractMasterOps(doc) {
  if (!doc || !Array.isArray(doc.operations)) return [];
  const set = new Set();
  for (const op of doc.operations) {
    const raw = op.name ?? op.operationName ?? '';
    const n = normalizeOperationName(raw);
    if (n) set.add(n);
  }
  return [...set];
}

function parseAmfeData(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  if (typeof raw === 'object') return raw;
  return null;
}

// ── 1. Read master ─────────────────────────────────────────────────────────
console.log('\n=== TEST CROSS-FAMILY PROPAGATION: INJECTION MASTER ===\n');
console.log('1. Reading master AMFE...');
const { data: masterRow, error: masterErr } = await sb
  .from('amfe_documents')
  .select('id, subject, data')
  .eq('id', MASTER_DOC_ID)
  .single();
if (masterErr) { console.error('ERROR leyendo master:', masterErr); process.exit(1); }

const rawDataType = typeof masterRow.data;
const masterData = parseAmfeData(masterRow.data);
if (!masterData || !masterData.header) {
  console.error('ERROR: master.data invalido o sin header');
  process.exit(1);
}
const originalSubject = masterData.header.subject || '';
console.log(`   id=${MASTER_DOC_ID}`);
console.log(`   data column type: ${rawDataType}`);
console.log(`   original subject: "${originalSubject}"`);
const masterOps = extractMasterOps(masterData);
console.log(`   master operation names (normalized): ${JSON.stringify(masterOps)}`);

// ── 2. Snapshot pre-existing cross_doc_checks for this source ─────────────
console.log('\n2. Snapshot pre-existing cross_doc_checks for this master...');
const { data: preExisting, error: preErr } = await sb
  .from('cross_doc_checks')
  .select('id, source_module, source_doc_id, target_module, target_doc_id')
  .eq('source_module', 'amfe')
  .eq('source_doc_id', MASTER_DOC_ID);
if (preErr) { console.error('ERROR snapshot pre-existing:', preErr); process.exit(1); }
const preIds = new Set((preExisting || []).map(r => r.id));
console.log(`   pre-existing rows: ${preIds.size}`);

// ── 3. Apply cosmetic header tweak + save ──────────────────────────────────
console.log('\n3. Applying cosmetic header tweak...');
const testedSubject = originalSubject.endsWith(TEST_MARKER)
  ? originalSubject
  : originalSubject + TEST_MARKER;
const newDataWithTest = {
  ...masterData,
  header: { ...masterData.header, subject: testedSubject },
};
const { error: upd1Err } = await sb
  .from('amfe_documents')
  .update({ data: JSON.stringify(newDataWithTest) })
  .eq('id', MASTER_DOC_ID);
if (upd1Err) { console.error('ERROR updating master:', upd1Err); process.exit(1); }
console.log(`   subject is now: "${testedSubject}"`);

// ── 4. Scan all other amfe docs and match ─────────────────────────────────
console.log('\n4. Scanning all other amfe_documents...');
const { data: allOthers, error: othersErr } = await sb
  .from('amfe_documents')
  .select('id, subject, project_name, data')
  .neq('id', MASTER_DOC_ID);
if (othersErr) { console.error('ERROR reading others:', othersErr); process.exit(1); }
console.log(`   docs to scan: ${allOthers.length}`);

const matchesPerDoc = [];
for (const row of allOthers) {
  const doc = parseAmfeData(row.data);
  if (!doc || !Array.isArray(doc.operations)) continue;
  const matchedRaw = new Set();
  for (const op of doc.operations) {
    const rawName = op.name ?? op.operationName ?? '';
    const norm = normalizeOperationName(rawName);
    const hit = matchOperationName(norm, masterOps);
    if (hit) matchedRaw.add(rawName.toString().trim());
  }
  if (matchedRaw.size > 0) {
    matchesPerDoc.push({
      id: row.id,
      subject: row.subject || row.project_name || row.id,
      matched: [...matchedRaw],
    });
  }
}
console.log(`   docs affected: ${matchesPerDoc.length}`);
for (const m of matchesPerDoc) {
  console.log(`     - ${m.subject}  [${m.id}]`);
  for (const op of m.matched) {
    console.log(`         matched op: "${op}"`);
  }
}

// ── 5. Insert cross_doc_checks rows (one per affected doc) ─────────────────
console.log('\n5. Inserting cross_doc_checks rows...');
const sourceRevision = newDataWithTest.header.revision || 'A';
const sourceUpdated = new Date().toISOString();
let created = 0;
for (const m of matchesPerDoc) {
  // Upsert logic: try insert; on conflict, update. Supabase JS client upsert:
  const { error: insErr } = await sb
    .from('cross_doc_checks')
    .upsert(
      {
        source_module: 'amfe',
        source_doc_id: MASTER_DOC_ID,
        target_module: 'amfe',
        target_doc_id: m.id,
        source_revision: sourceRevision,
        source_updated: sourceUpdated,
        acknowledged_at: null,
      },
      { onConflict: 'source_module,source_doc_id,target_module,target_doc_id' },
    );
  if (insErr) {
    console.log(`   WARN insert for ${m.id} failed: ${insErr.message}`);
  } else {
    created++;
  }
}
console.log(`   rows upserted: ${created}`);

// ── 6. Count current cross_doc_checks for this master ─────────────────────
console.log('\n6. Current cross_doc_checks rows for this master:');
const { data: nowRows, error: nowErr } = await sb
  .from('cross_doc_checks')
  .select('id, target_doc_id')
  .eq('source_module', 'amfe')
  .eq('source_doc_id', MASTER_DOC_ID);
if (nowErr) { console.error('ERROR counting:', nowErr); process.exit(1); }
console.log(`   total rows: ${nowRows.length} (pre-existing: ${preIds.size}, new: ${nowRows.length - preIds.size})`);

// ── 7. Revert the master header change ─────────────────────────────────────
console.log('\n7. Reverting master header change...');
const revertedData = {
  ...newDataWithTest,
  header: { ...newDataWithTest.header, subject: originalSubject },
};
const { error: upd2Err } = await sb
  .from('amfe_documents')
  .update({ data: JSON.stringify(revertedData) })
  .eq('id', MASTER_DOC_ID);
if (upd2Err) { console.error('ERROR reverting master:', upd2Err); process.exit(1); }

// ── Verify revert ─────────────────────────────────────────────────────────
const { data: verifyRow, error: vErr } = await sb
  .from('amfe_documents')
  .select('data')
  .eq('id', MASTER_DOC_ID)
  .single();
if (vErr) { console.error('ERROR verifying:', vErr); process.exit(1); }
const verifiedData = parseAmfeData(verifyRow.data);
const revertOk = verifiedData?.header?.subject === originalSubject;
console.log(`   revert verified: ${revertOk ? 'OK' : 'FAIL'} (subject="${verifiedData?.header?.subject}")`);
if (!revertOk) {
  console.error('CRITICAL: revert failed, master may be in inconsistent state!');
}

// ── 8. Delete cross_doc_checks rows created during this run ───────────────
console.log('\n8. Deleting cross_doc_checks rows created by this test...');
const newRowIds = (nowRows || [])
  .filter(r => !preIds.has(r.id))
  .map(r => r.id);
console.log(`   new row ids to delete: ${newRowIds.length}`);
if (newRowIds.length > 0) {
  const { error: delErr } = await sb
    .from('cross_doc_checks')
    .delete()
    .in('id', newRowIds);
  if (delErr) { console.error('ERROR deleting alerts:', delErr); process.exit(1); }
  console.log(`   deleted ${newRowIds.length} rows`);
} else {
  console.log('   nothing new to delete');
}

// ── Final state check ─────────────────────────────────────────────────────
const { data: finalRows } = await sb
  .from('cross_doc_checks')
  .select('id')
  .eq('source_module', 'amfe')
  .eq('source_doc_id', MASTER_DOC_ID);
console.log(`\n9. Final cross_doc_checks rows for this master: ${(finalRows || []).length} (expected: ${preIds.size})`);

// ── Summary ───────────────────────────────────────────────────────────────
console.log('\n=== SUMMARY ===');
console.log(`scanned docs:    ${allOthers.length}`);
console.log(`affected docs:   ${matchesPerDoc.length}`);
console.log(`alerts created:  ${created}`);
console.log(`revert OK:       ${revertOk}`);
console.log(`cleanup OK:      ${(finalRows || []).length === preIds.size}`);
console.log('affected subjects:');
for (const m of matchesPerDoc) {
  console.log(`  - ${m.subject}`);
}
console.log('\nDONE.\n');

if (!revertOk || (finalRows || []).length !== preIds.size) {
  process.exit(2);
}
