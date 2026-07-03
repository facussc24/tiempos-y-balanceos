// READ-ONLY: ver qué PFDs están guardados y a qué productos corresponden
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { data: pfds } = await sb.from('pfd_documents').select('id, data');
console.log(`Total PFDs guardados: ${pfds?.length || 0}\n`);
for (const p of pfds || []) {
  const data = typeof p.data === 'string' ? JSON.parse(p.data) : p.data;
  const pn = data.header?.partName || '(sin partName)';
  const pnum = data.header?.partNumber || '(sin PN)';
  const link = data.header?.linkedAmfeId || data.header?.linkedAmfeProject || '(sin link)';
  const cust = data.header?.customerName || '-';
  const steps = (data.steps || []).length;
  console.log(`  ID: ${p.id}`);
  console.log(`  PartName: ${pn}  |  PN: ${pnum}  |  Cliente: ${cust}`);
  console.log(`  LinkedAmfe: ${link}  |  Steps: ${steps}`);
  console.log();
}

// Ver AMFEs y sus nombres para hacer match
const { data: amfes } = await sb.from('amfe_documents').select('id, amfe_number, data');
console.log(`--- AMFEs para referencia de PFDs faltantes ---`);
for (const a of amfes || []) {
  const data = typeof a.data === 'string' ? JSON.parse(a.data) : a.data;
  const title = data.header?.title || data.header?.productName || data.header?.process || data.projectInfo?.productName || a.amfe_number;
  const opsCount = (data.operations || []).length;
  console.log(`  ${a.amfe_number} (${opsCount} ops) - ${title}`);
}
process.exit(0);
