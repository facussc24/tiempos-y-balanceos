import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// 0. Listar todos los AMFE para encontrar IP PAD
const { data: allAmfe, error: errAll } = await sb.from('amfe_documents').select('id, project_name, customer_name');
console.log('=== Todos los AMFE ===');
if (errAll) console.log('ERROR allAmfe:', errAll);
console.log('count:', (allAmfe || []).length);
for (const a of allAmfe || []) {
  console.log(`  ${a.project_name} | ${a.customer_name} | ${a.id}`);
}

// 1. AMFE IP PAD - por id conocido
const { data: amfe, error: errAmfe } = await sb.from('amfe_documents')
  .select('id, project_name, data')
  .eq('id', 'c9b93b84-f804-4cd0-91c1-c4878db41b97')
  .maybeSingle();
if (errAmfe) {
  console.log('ERROR amfe:', errAmfe);
  process.exit(1);
}
if (!amfe) {
  console.log('AMFE c9b93b84 NO encontrado');
  process.exit(1);
}
const d = typeof amfe.data === 'string' ? JSON.parse(amfe.data) : amfe.data;
console.log('=== AMFE IP PAD ===');
console.log('doc_id:', amfe.id);
console.log('customer:', amfe.customer_name);
console.log('applicableParts:', JSON.stringify(d.applicableParts || d.header?.applicableParts || 'NOT SET'));
console.log('header.partNumber:', d.header?.partNumber);
console.log('header.productName:', d.header?.productName);
console.log('header.revision:', d.header?.revision);

// Also look at OP 40 failures
const op40 = (d.operations || []).find(op => (op.opNumber || op.operationNumber) == 40);
if (op40) {
  console.log('\n=== OP 40 detalle ===');
  console.log('WorkElements:', op40.workElements?.length || 0);
  for (const we of (op40.workElements || [])) {
    console.log(`  [${we.type}] ${we.name}`);
    for (const fn of (we.functions || [])) {
      console.log(`    fn: ${(fn.description || fn.functionDescription || '').substring(0, 100)}`);
      for (const fm of (fn.failures || [])) {
        console.log(`      FM: ${(fm.description || fm.failureMode || '').substring(0, 80)}`);
        console.log(`         causes: ${(fm.causes || []).length}`);
      }
    }
  }
}

// 2. Familias con "ip pad" / "ippad" / "patagonia"
console.log('\n=== product_families (filtradas) ===');
const { data: fams, error: ef } = await sb.from('product_families')
  .select('*')
  .or('family_name.ilike.%ip pad%,family_name.ilike.%ippad%,family_name.ilike.%ip_pad%');
if (ef) console.log('err fams filter:', ef);
console.log('IP PAD families:', JSON.stringify(fams, null, 2));

const { data: famsAll, error: efAll } = await sb.from('product_families').select('*');
if (efAll) console.log('err famsAll:', efAll);
console.log('\nTotal families:', famsAll?.length);
console.log('All names:', famsAll?.map(f => f.family_name).join(' | '));

// 3. Products con PNs IP PAD
console.log('\n=== products (PNs IP PAD) ===');
const pns = ['2HC.858.417.B FAM', '2HC.858.417.C GKK', '2HC.858.417.C GKN', '2HC.858.417.D'];
for (const pn of pns) {
  const { data: p, error: ep } = await sb.from('products').select('*').eq('part_number', pn);
  if (ep) { console.log(`err ${pn}:`, ep); continue; }
  console.log(`  ${pn}:`, p && p.length ? JSON.stringify(p[0]) : 'NOT FOUND');
}

// 4. CP + HO + PFD existentes para IP PAD
console.log('\n=== docs existentes IP PAD ===');
const { data: cps } = await sb.from('cp_documents').select('id, project_name, cp_number').ilike('project_name', '%IP_PAD%');
console.log('CP:', cps);
const { data: hos } = await sb.from('ho_documents').select('id, project_name').ilike('project_name', '%IP_PAD%');
console.log('HO:', hos);
const { data: pfds } = await sb.from('pfd_documents').select('id, project_name').ilike('project_name', '%IP_PAD%');
console.log('PFD:', pfds);
