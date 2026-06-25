/**
 * Fix Top Roll AMFE — Set focusElementFunction on all 10 operations
 * Same value for all OPs (AIAG-VDA: es la función del PRODUCTO, no de la operación)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

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
const { data: doc } = await sb.from('amfe_documents').select('data').eq('id', AMFE_ID).single();
let d = doc.data;
if (typeof d === 'string') d = JSON.parse(d);

const FEF = 'Interno: Proveer acabado estetico al panel de puerta mediante tapizado de vinilo sobre sustrato plastico inyectado / Cliente: Ensamble en panel de puerta con ajuste dimensional correcto / Usr. Final: Acabado visual y tactil del interior de la puerta del vehiculo';

let updated = 0;
for (const op of d.operations) {
  op.focusElementFunction = FEF;
  updated++;
  console.log('OP ' + (op.opNumber || op.operationNumber) + ': focusElementFunction SET');
}

const { error } = await sb.from('amfe_documents').update({ data: d }).eq('id', AMFE_ID);
if (error) { console.error(error); process.exit(1); }
console.log(`\nUpdated ${updated} operations. Saved.`);
