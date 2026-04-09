/**
 * Fix Armrest AMFE — Cleanup: split WEs, fix types, set FEF, sync metadata
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({email:env.VITE_AUTO_LOGIN_EMAIL,password:env.VITE_AUTO_LOGIN_PASSWORD});

const ID = '5268704d-30ae-48f3-ad05-8402a6ded7fe';
const {data:doc} = await sb.from('amfe_documents').select('data').eq('id',ID).single();
let amfeData = doc.data;
if (typeof amfeData === 'string') amfeData = JSON.parse(amfeData);

const ts = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const bkDir = new URL(`../backups/armrest-cleanup-${ts}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1');
mkdirSync(bkDir,{recursive:true});
writeFileSync(`${bkDir}/before.json`, JSON.stringify(amfeData,null,2));

const data = JSON.parse(JSON.stringify(amfeData));

function cloneWithNewIds(obj) {
  const c = JSON.parse(JSON.stringify(obj));
  c.id = randomUUID();
  if (c.failures) for (const f of c.failures) { f.id=randomUUID(); if(f.causes) for(const cc of f.causes) cc.id=randomUUID(); }
  return c;
}

// === TASK 1: Split grouped WEs ===
console.log('=== TASK 1: Split grouped WEs ===');
let splits = 0;
for (const op of data.operations) {
  let i = 0;
  while (i < (op.workElements||[]).length) {
    const we = op.workElements[i];
    const nm = we.name || '';
    if (!nm.includes(' / ')) { i++; continue; }
    const parts = nm.split(' / ').map(s=>s.trim()).filter(s=>s.length>0);
    if (parts.length<2) { i++; continue; }
    const newWEs = parts.map(p => {
      const nwe = { id:randomUUID(), name:p, type:we.type, functions:[] };
      for (const fn of (we.functions||[])) nwe.functions.push(cloneWithNewIds(fn));
      return nwe;
    });
    console.log(`  OP ${op.opNumber||op.operationNumber}: "${nm}" -> ${parts.length} WEs`);
    op.workElements.splice(i, 1, ...newWEs);
    splits++;
    i += newWEs.length;
  }
}
console.log(`Total splits: ${splits}`);

// === TASK 2: Fix WE types (spanish -> english) ===
console.log('\n=== TASK 2: Fix WE types ===');
const typeMap = { 'maquina':'Machine', 'mano de obra':'Man', 'metodo':'Method', 'material':'Material', 'medio ambiente':'Environment', 'medicion':'Measurement' };
let typeFixes = 0;
for (const op of data.operations) {
  for (const we of (op.workElements||[])) {
    const lower = (we.type||'').toLowerCase();
    if (typeMap[lower] && we.type !== typeMap[lower]) {
      console.log(`  OP ${op.opNumber||op.operationNumber}: "${we.name}" ${we.type} -> ${typeMap[lower]}`);
      we.type = typeMap[lower];
      typeFixes++;
    }
    // Fix measurement instruments
    const nm = (we.name||'').toLowerCase();
    if ((nm.includes('calibre') || nm.includes('micr') || nm.includes('probeta')) && we.type !== 'Measurement') {
      console.log(`  OP ${op.opNumber||op.operationNumber}: "${we.name}" ${we.type} -> Measurement`);
      we.type = 'Measurement';
      typeFixes++;
    }
  }
}
console.log(`Type fixes: ${typeFixes}`);

// === TASK 3: Set focusElementFunction ===
console.log('\n=== TASK 3: Set focusElementFunction ===');
const FEF = 'Interno: Proveer pieza tapizada y ensamblada conforme a especificaciones dimensionales y de apariencia / Cliente: Permitir ensamble del apoyabrazos de puerta sin interferencias en linea VW / Usr. Final: Confort ergonomico y apariencia estetica del apoyabrazos de puerta del vehiculo';
for (const op of data.operations) op.focusElementFunction = FEF;
console.log(`Set on ${data.operations.length} operations`);

// === TASK 4: Sort operations by number ===
data.operations.sort((a,b) => parseInt(a.opNumber||a.operationNumber) - parseInt(b.opNumber||b.operationNumber));

// === TASK 5: Save ===
let totalCauses = 0;
for (const op of data.operations) for (const we of (op.workElements||[])) for (const fn of (we.functions||[])) for (const f of (fn.failures||[])) totalCauses += (f.causes||[]).length;

console.log(`\n=== Saving: ${data.operations.length} ops, ${totalCauses} causes ===`);
const {error} = await sb.from('amfe_documents').update({ data:data, operation_count:data.operations.length, cause_count:totalCauses }).eq('id',ID);
if (error) { console.error(error); process.exit(1); }

writeFileSync(`${bkDir}/after.json`, JSON.stringify(data,null,2));

// Verify
let grouped = 0;
for (const op of data.operations) for (const we of (op.workElements||[])) if ((we.name||'').includes(' / ')) grouped++;
console.log('Remaining grouped WEs:', grouped);

for (const op of data.operations) {
  console.log(`  OP ${op.opNumber||op.operationNumber}: ${op.name||op.operationName} (${(op.workElements||[]).length} WEs)`);
}
console.log('Done.');
