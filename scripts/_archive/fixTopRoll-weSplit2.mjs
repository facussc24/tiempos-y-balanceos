/**
 * Fix Top Roll AMFE — Split remaining 9 grouped WEs (Mano de Obra + Medio Ambiente)
 * Confirmed by AIAG-VDA auditor: "Operador / Líder" MUST be 2 separate WEs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const AMFE_ID = '78eaa89b-ad0b-4342-9046-ab2e9b14d3b3';

const { data: doc, error: fetchErr } = await sb
  .from('amfe_documents')
  .select('*')
  .eq('id', AMFE_ID)
  .single();
if (fetchErr) { console.error('Fetch error:', fetchErr.message); process.exit(1); }

let amfeData = doc.data;
if (typeof amfeData === 'string') amfeData = JSON.parse(amfeData);

// Backup
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = new URL(`../backups/toproll-weSplit2-${ts}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
mkdirSync(backupDir, { recursive: true });
writeFileSync(`${backupDir}/amfe_before.json`, JSON.stringify(amfeData, null, 2));
console.log(`Backup: ${backupDir}/amfe_before.json`);

const data = JSON.parse(JSON.stringify(amfeData));

// Clone helper
function cloneWithNewIds(obj) {
  const clone = JSON.parse(JSON.stringify(obj));
  clone.id = randomUUID();
  if (clone.failures) {
    for (const f of clone.failures) {
      f.id = randomUUID();
      if (f.causes) for (const c of f.causes) c.id = randomUUID();
    }
  }
  return clone;
}

// Count causes in a WE
function countWeCauses(we) {
  let t = 0;
  for (const fn of (we.functions||[])) for (const f of (fn.failures||[])) t += (f.causes||[]).length;
  return t;
}

let totalSplits = 0;

for (const op of data.operations) {
  const opNum = op.opNumber || op.operationNumber;
  const opName = op.name || op.operationName;

  // Scan for WEs with " / " in name
  let i = 0;
  while (i < (op.workElements || []).length) {
    const we = op.workElements[i];
    const weName = we.name || '';

    if (!weName.includes(' / ')) {
      i++;
      continue;
    }

    // Split by " / "
    const parts = weName.split(' / ').map(s => s.trim()).filter(s => s.length > 0);
    if (parts.length < 2) { i++; continue; }

    const weType = we.type;
    const hasCauses = countWeCauses(we) > 0;

    console.log(`\nOP ${opNum} ${opName}:`);
    console.log(`  Splitting: "${weName}" [${weType}] -> ${parts.length} WEs (causes: ${hasCauses ? 'YES' : 'NO'})`);

    // Create N new WEs
    const newWEs = parts.map(partName => {
      const newWe = {
        id: randomUUID(),
        name: partName,
        type: weType,
        functions: []
      };

      // Clone functions to each child
      for (const fn of (we.functions || [])) {
        newWe.functions.push(cloneWithNewIds(fn));
      }

      console.log(`    + "${partName}" [${weType}] (${newWe.functions.length} functions cloned)`);
      return newWe;
    });

    // Replace grouped WE with individual ones
    op.workElements.splice(i, 1, ...newWEs);
    totalSplits++;

    // Skip past the newly inserted WEs
    i += newWEs.length;
  }
}

console.log(`\n=== Total splits: ${totalSplits} ===`);

// Count final causes
let finalCauses = 0;
for (const op of data.operations) {
  for (const we of (op.workElements||[])) finalCauses += countWeCauses(we);
}
console.log(`Final cause count: ${finalCauses}`);

// Verify no more " / " in WE names
let remaining = 0;
for (const op of data.operations) {
  for (const we of (op.workElements||[])) {
    if ((we.name||'').includes(' / ')) {
      console.log(`  STILL GROUPED: OP ${op.opNumber||op.operationNumber} WE "${we.name}"`);
      remaining++;
    }
  }
}
console.log(`Remaining grouped WEs: ${remaining}`);

// Save
const { error: updateErr } = await sb
  .from('amfe_documents')
  .update({ data: data, cause_count: finalCauses })
  .eq('id', AMFE_ID);
if (updateErr) { console.error('Save error:', updateErr.message); process.exit(1); }
console.log('Saved to Supabase.');

// Verify
const { data: v } = await sb.from('amfe_documents').select('data').eq('id', AMFE_ID).single();
let vd = v.data;
if (typeof vd === 'string') vd = JSON.parse(vd);
console.log(`Verified: ${vd.operations.length} ops`);

// Summary
writeFileSync(`${backupDir}/amfe_after.json`, JSON.stringify(data, null, 2));
console.log('\nFinal state:');
for (const op of data.operations) {
  const n = op.opNumber || op.operationNumber;
  const nm = op.name || op.operationName;
  console.log(`  OP ${n}: ${nm} (${(op.workElements||[]).length} WEs)`);
}
console.log('\nDone.');
process.exit(0);
