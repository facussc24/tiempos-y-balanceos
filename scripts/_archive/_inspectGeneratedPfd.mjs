// READ-ONLY: mostrar contenido completo del PFD recién generado de Top Roll
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const pfdId = process.argv[2] || 'b2b881b4-cb7c-473d-9a2f-2caf36ead62f';
const { data } = await sb.from('pfd_documents').select('id, data').eq('id', pfdId).single();
if (!data) { console.log('Not found'); process.exit(1); }
const d = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
console.log(`=== PFD ${pfdId} ===`);
console.log(`Part number: ${d.header?.partNumber || '-'}`);
console.log(`Part name: ${d.header?.partName || '-'}`);
console.log(`Customer: ${d.header?.customerName || '-'}`);
console.log(`Linked AMFE: ${d.header?.linkedAmfeId || '-'}`);
console.log(`\n${d.steps.length} steps:`);
for (const s of d.steps) {
  const cc = s.productSpecialChar !== 'none' ? ` [P:${s.productSpecialChar}]` : '';
  const pc = s.processSpecialChar !== 'none' ? ` [Pr:${s.processSpecialChar}]` : '';
  const dept = s.department ? ` @${s.department}` : '';
  const mach = s.machineDeviceTool ? ` (${s.machineDeviceTool.slice(0,30)})` : '';
  console.log(`  [${s.stepNumber||'—'}] ${s.stepType.padEnd(10)} ${s.description.slice(0,55)}${mach}${dept}${cc}${pc}`);
}
process.exit(0);
