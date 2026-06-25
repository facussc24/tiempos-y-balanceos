// Fix PFD: add OP number to Control Final (120) and change Embalaje to OP 130
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('C:/Users/FacundoS-PC/dev/BarackMercosul/.env.local', 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const DOC_ID = 'pfd-ippads-trim-asm-upr-wrapping';

await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
const { data: doc } = await sb.from('pfd_documents').select('data').eq('id', DOC_ID).single();
let d = doc.data;
if (typeof d === 'string') d = JSON.parse(d);

let fixes = 0;
for (const step of d.steps) {
  // Control Final: add OP 120
  if (step.description === 'CONTROL FINAL DE CALIDAD' && step.stepType === 'inspection' && !step.stepNumber) {
    step.stepNumber = 'OP 120';
    step.stepType = 'inspection'; // keep as inspection
    console.log('Control Final -> OP 120');
    fixes++;
  }
  // Embalaje: OP 120 -> OP 130
  if (step.description === 'EMBALAJE DE PRODUCTO TERMINADO' && step.stepNumber === 'OP 120') {
    step.stepNumber = 'OP 130';
    console.log('Embalaje -> OP 130');
    fixes++;
  }
}

console.log('Fixes:', fixes);

// Print all numbered steps
for (const s of d.steps) {
  if (s.stepNumber) console.log(' ', s.stepNumber, ':', s.description);
}

const wr = await sb.from('pfd_documents').update({ data: d, step_count: d.steps.length }).eq('id', DOC_ID);
if (wr.error) { console.error('FAIL:', wr.error.message); process.exit(1); }
console.log('Written');
