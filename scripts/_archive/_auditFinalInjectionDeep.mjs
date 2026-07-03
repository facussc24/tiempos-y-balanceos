/**
 * Deep checks for the 2 flags from _auditFinalInjection.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const MASTER_AMFE_ID = '4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c';
const MASTER_CP_ID = '81b60cdd-1296-4821-a348-a8e3c2433b0d';

function norm(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// ── A3.2 deep dive: look at ALL humedad-related causes in OP10 ─────────────
const { data: masterRow } = await sb.from('amfe_documents').select('data').eq('id', MASTER_AMFE_ID).single();
const masterDoc = JSON.parse(masterRow.data);

console.log('===== A3.2 DEEP: all OP10 causes with humedad/secado in failure or cause text =====');
for (const op of masterDoc.operations) {
  if (String(op.operationNumber || op.opNumber) !== '10') continue;
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const fm of (fn.failures || [])) {
        const fdn = norm(fm.description);
        for (const c of (fm.causes || [])) {
          const cdn = norm(c.description || c.cause);
          const matchesFail = fdn.includes('humedad') || fdn.includes('secado insuficiente') || fdn.includes('absorcion de humedad');
          const matchesCause = cdn.includes('humedad') || cdn.includes('secado insuficiente') || cdn.includes('absorcion de humedad');
          if (matchesFail || matchesCause) {
            console.log(`  failure: "${fm.description.slice(0, 80)}"`);
            console.log(`  cause  : "${(c.description||c.cause||'').slice(0, 80)}"`);
            console.log(`  S=${c.severity} O=${c.occurrence} D=${c.detection} AP=${c.ap}  (matchFail=${matchesFail} matchCause=${matchesCause})`);
            console.log('');
          }
        }
      }
    }
  }
}

// ── C1.b deep dive: show ALL items with their field presence ────────────────
console.log('\n===== C1.b DEEP: check CP items core fields =====');
const { data: cpRow } = await sb.from('cp_documents').select('data').eq('id', MASTER_CP_ID).single();
const cpData = typeof cpRow.data === 'string' ? JSON.parse(cpRow.data) : cpRow.data;
const items = cpData.items || [];
console.log(`Total items: ${items.length}`);
console.log('');
let i = 0;
for (const it of items) {
  i++;
  const miss = [];
  if (!it.processStepNumber) miss.push('processStepNumber');
  if (!it.characteristic) miss.push('characteristic');
  if (!it.reactionPlanOwner) miss.push('reactionPlanOwner');
  const label = (it.characteristic || it.processCharacteristic || it.productCharacteristic || '(none)').slice(0, 60);
  if (miss.length > 0) {
    console.log(`  [${i}] MISSING: ${miss.join(', ')}`);
    console.log(`      label: "${label}"`);
    console.log(`      processStepNumber: ${JSON.stringify(it.processStepNumber)}`);
    console.log(`      characteristic: ${JSON.stringify(it.characteristic)}`);
    console.log(`      processCharacteristic: ${JSON.stringify((it.processCharacteristic||'').slice(0,40))}`);
    console.log(`      productCharacteristic: ${JSON.stringify((it.productCharacteristic||'').slice(0,40))}`);
    console.log(`      reactionPlanOwner: ${JSON.stringify(it.reactionPlanOwner)}`);
  }
}

// The "characteristic" field may not be the real field name — check what fields exist
console.log('\n===== CP item keys (first item) =====');
if (items[0]) {
  console.log(Object.keys(items[0]).sort().join('\n'));
}
