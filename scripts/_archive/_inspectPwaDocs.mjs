/**
 * Deep inspect OP 10 causes in both PWA AMFEs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = 'C:/Users/FacundoS-PC/dev/BarackMercosul/.env.local';
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

async function fetchData(table, id) {
  const { data } = await sb.from(table).select('data').eq('id', id).single();
  let d = data.data;
  if (typeof d === 'string') d = JSON.parse(d);
  return d;
}

function dumpCauses(op) {
  const opNum = op.opNumber || op.operationNumber;
  const opName = op.name || op.operationName;
  console.log(`\n  OP ${opNum} "${opName}":`);
  for (const we of (op.workElements || [])) {
    console.log(`    WE: "${we.name||we.description}" [${we.type}]`);
    for (const fn of (we.functions || [])) {
      console.log(`      FN: "${fn.description||fn.functionDescription}"`);
      for (const fm of (fn.failures || [])) {
        const fmDesc = fm.description || fm.failure || fm.failureDescription || '?';
        for (const c of (fm.causes || [])) {
          const cause = c.cause || c.description || '?';
          const effEnd = fm.effectEndUser || fm.effectFinal || '';
          console.log(`        CAUSE: S=${c.severity} O=${c.occurrence} D=${c.detection} AP=${c.ap||c.actionPriority} CC="${c.specialChar}" | fm="${fmDesc}" | cause="${cause.substring(0,80)}" | effEnd="${effEnd.substring(0,60)}"`);
        }
      }
    }
  }
}

// AMFE Termoformadas — OP 10 deep
console.log('\n══ AMFE TERMOFORMADAS OP 10 ══');
const amfeT = await fetchData('amfe_documents', 'c5201ba9-1225-4663-b7a1-5430f9ee8912');
const op10T = (amfeT.operations||[]).find(op => (op.opNumber||op.operationNumber) === '10');
if (op10T) dumpCauses(op10T);

// AMFE Telas Planas — OP 10 deep
console.log('\n══ AMFE TELAS PLANAS OP 10 ══');
const amfeP = await fetchData('amfe_documents', '57011560-d4c1-4a8a-83f0-ed37a2bab1d5');
const op10P = (amfeP.operations||[]).find(op => (op.opNumber||op.operationNumber) === '10');
if (op10P) dumpCauses(op10P);

// CP items for flamabilidad - full detail
console.log('\n══ CP TERMOFORMADAS — flamabilidad item ══');
const cpTData = await fetchData('cp_documents', '85fd046d-a3bd-4de1-a9f9-d2fd51466999');
const flamItemsT = (cpTData.items||[]).filter(i => /flamab/i.test(JSON.stringify(i)));
console.log('Items count total:', (cpTData.items||[]).length);
for (const i of flamItemsT) {
  console.log('  Item id:', i.id);
  console.log('  specialChar:', i.specialChar);
  console.log('  specialCharacteristic:', i.specialCharacteristic);
  console.log('  productCharacteristic:', i.productCharacteristic);
  console.log('  processCharacteristic:', i.processCharacteristic);
  console.log('  processStepNumber:', i.processStepNumber);
  console.log('  amfeSeverity:', i.amfeSeverity);
  console.log('  amfeAp:', i.amfeAp);
}

console.log('\n══ CP TELAS PLANAS — flamabilidad item ══');
const cpPData = await fetchData('cp_documents', '332bcdda-a7d8-4d28-a41d-3961472ccb0e');
const flamItemsP = (cpPData.items||[]).filter(i => /flamab/i.test(JSON.stringify(i)));
console.log('Items count total:', (cpPData.items||[]).length);
for (const i of flamItemsP) {
  console.log('  Item id:', i.id);
  console.log('  specialChar:', i.specialChar);
  console.log('  productCharacteristic:', i.productCharacteristic);
  console.log('  processCharacteristic:', i.processCharacteristic);
  console.log('  processStepNumber:', i.processStepNumber);
  console.log('  amfeSeverity:', i.amfeSeverity);
}

// Op names in AMFE Termoformadas - check if naming is correct
console.log('\n══ OP NAMES AMFE TERMOFORMADAS ══');
for (const op of (amfeT.operations||[])) {
  console.log(`  OP ${op.opNumber||op.operationNumber} "${op.name||op.operationName}"`);
}

process.exit(0);
