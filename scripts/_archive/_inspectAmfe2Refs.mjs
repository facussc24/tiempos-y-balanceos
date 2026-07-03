import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envText = readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
const { data } = await sb.from('amfe_documents').select('data').eq('amfe_number', 'AMFE-2').single();
const p = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
const ops = p.operations || [];
const target = [100, 101, 102, 103, 105, 110, 120];
const models = ops.filter(o => target.includes(o.opNumber ?? o.operationNumber));
for (const op of models) {
  const n = op.opNumber ?? op.operationNumber;
  const name = op.name || op.operationName;
  const wes = op.workElements || [];
  const fn = (op.focusElementFunction || '').slice(0, 140);
  const fallas = wes.flatMap(we => (we.functions || []).flatMap(f => f.failures || [])).length;
  console.log('OP ' + n + ' — ' + name);
  console.log('  fn: ' + fn);
  console.log('  WEs: ' + wes.length + ' | fallas: ' + fallas);
  for (const we of wes) console.log('    ' + we.type + ' — ' + we.name);
}
process.exit(0);
