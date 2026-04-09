import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const targets = ['TOP_ROLL', 'INSERT', 'ARMREST_DOOR_PANEL'];
const { data: docs } = await sb.from('amfe_documents').select('id,project_name,data');

for (const target of targets) {
  const doc = docs.find(d => (d.project_name || '').includes(target));
  if (!doc) { console.log('NOT FOUND: ' + target); continue; }

  let data = doc.data;
  if (typeof data === 'string') data = JSON.parse(data);

  console.log('\n========================================');
  console.log('AMFE: ' + target + ' (id=' + doc.id + ')');
  console.log('========================================');

  let emptyFEF = 0, emptyOpFunc = 0, emptyWeFunc = 0, totalOps = 0, totalWEs = 0;

  for (const op of data.operations) {
    totalOps++;
    const n = op.opNumber || op.operationNumber;
    const nm = op.name || op.operationName;
    const fef = op.focusElementFunction || '';
    const opf = op.operationFunction || '';

    const fefStatus = fef ? 'OK (' + fef.substring(0, 50) + '...)' : '*** EMPTY ***';
    const opfStatus = opf ? 'OK (' + opf.substring(0, 50) + '...)' : '*** EMPTY ***';

    if (!fef) emptyFEF++;
    if (!opf) emptyOpFunc++;

    console.log('\n  OP ' + n + ': ' + nm);
    console.log('    focusElementFunction: ' + fefStatus);
    console.log('    operationFunction:    ' + opfStatus);

    for (const we of (op.workElements || [])) {
      totalWEs++;
      let hasFunc = false;
      for (const fn of (we.functions || [])) {
        if (fn.description || fn.functionDescription) { hasFunc = true; break; }
      }
      if (!hasFunc && (we.functions || []).length === 0) {
        emptyWeFunc++;
        console.log('    WE "' + we.name + '" [' + we.type + ']: *** NO FUNCTIONS ***');
      } else if (!hasFunc) {
        let allEmpty = true;
        for (const fn of (we.functions || [])) {
          if ((fn.description || fn.functionDescription || '').trim()) { allEmpty = false; break; }
        }
        if (allEmpty) {
          emptyWeFunc++;
          console.log('    WE "' + we.name + '" [' + we.type + ']: *** EMPTY FUNCTION DESCRIPTIONS ***');
        }
      }
    }
  }

  console.log('\n  --- SUMMARY ' + target + ' ---');
  console.log('  Total OPs: ' + totalOps);
  console.log('  Empty focusElementFunction: ' + emptyFEF + '/' + totalOps + (emptyFEF > 0 ? ' *** BLOCKER ***' : ' OK'));
  console.log('  Empty operationFunction: ' + emptyOpFunc + '/' + totalOps + (emptyOpFunc > 0 ? ' *** BLOCKER ***' : ' OK'));
  console.log('  WEs without functions: ' + emptyWeFunc + '/' + totalWEs + (emptyWeFunc > 0 ? ' *** WARNING ***' : ' OK'));
}
