// READ-ONLY: inspeccionar operaciones de Headrest para verificar si es PU o plastica
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => {
    const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()];
  })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { data: docs } = await sb.from('amfe_documents').select('amfe_number, data').in('amfe_number', ['AMFE-HF-PAT','AMFE-HRC-PAT','AMFE-HRO-PAT','AMFE-ARM-PAT']);

for (const d of docs) {
  const data = typeof d.data === 'string' ? JSON.parse(d.data) : d.data;
  console.log(`\n===== ${d.amfe_number} =====`);
  for (const op of data.operations || []) {
    const opName = (op.name || op.operationName || '').toUpperCase();
    const opNum = op.opNumber || op.operationNumber;
    if (opName.includes('INYECC') || opName.includes('SUSTRATO') || opName.includes('PU') || opName.includes('ESPUMA')) {
      console.log(`\n  >>> OP ${opNum}: ${op.name || op.operationName}`);
      const firstWe = (op.workElements || [])[0];
      if (firstWe) {
        console.log(`      Primer WE [${firstWe.type}]: ${firstWe.name}`);
        const fns = firstWe.functions || [];
        const firstFail = fns[0]?.failures?.[0];
        if (firstFail) {
          console.log(`      Primera falla: "${firstFail.description || firstFail.failureMode || ''}"`);
          const firstCause = firstFail.causes?.[0];
          if (firstCause) {
            console.log(`      Primera causa: "${firstCause.description || firstCause.cause || ''}"`);
          }
        }
      }
      console.log(`      Total WEs: ${(op.workElements || []).length}, types: ${(op.workElements||[]).map(w=>w.type).join(',')}`);
    }
  }
}
process.exit(0);
