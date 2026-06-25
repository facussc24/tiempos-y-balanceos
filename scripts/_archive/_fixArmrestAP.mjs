import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({email:env.VITE_AUTO_LOGIN_EMAIL,password:env.VITE_AUTO_LOGIN_PASSWORD});

function apRule(s,o,d){if(s<=1)return'L';if(s<=3){if(o>=8&&d>=5)return'M';return'L';}if(s<=6){if(o>=8)return d>=5?'H':'M';if(o>=6)return d>=2?'M':'L';if(o>=4)return d>=7?'M':'L';return'L';}if(s<=8){if(o>=8)return'H';if(o>=6)return d>=2?'H':'M';if(o>=4)return d>=7?'H':'M';if(o>=2)return d>=5?'M':'L';return'L';}if(o>=6)return'H';if(o>=4)return d>=2?'H':'M';if(o>=2){if(d>=7)return'H';if(d>=5)return'M';return'L';}return'L';}

const ID = '5268704d-30ae-48f3-ad05-8402a6ded7fe';
const {data:doc} = await sb.from('amfe_documents').select('data').eq('id',ID).single();
let d = doc.data;
if (typeof d === 'string') d = JSON.parse(d);

let fixed = 0;
for (const op of d.operations) {
  for (const we of (op.workElements||[])) {
    for (const fn of (we.functions||[])) {
      for (const f of (fn.failures||[])) {
        for (const c of (f.causes||[])) {
          const s = c.severity, o = c.occurrence, det = c.detection;
          if (s && o && det) {
            const correct = apRule(s, o, det);
            const current = c.ap || c.actionPriority;
            if (current !== correct) {
              console.log(`OP ${op.opNumber||op.operationNumber}: "${(c.cause||c.description||'').slice(0,50)}" S=${s} O=${o} D=${det}: ${current} -> ${correct}`);
              c.ap = correct;
              c.actionPriority = correct;
              fixed++;
            }
          }
        }
      }
    }
  }
}
console.log(`Fixed ${fixed} AP values`);
if (fixed > 0) {
  await sb.from('amfe_documents').update({data:d}).eq('id',ID);
  console.log('Saved.');
}
