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

function norm(s) {
  if (typeof s !== 'string') return '';
  return s.toUpperCase().trim().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

const targets = [
  { id: '10eaebce-ad87-4035-9343-3e20e4ee0fc9', label: 'Headrest Front OP 40' },
  { id: '5268704d-30ae-48f3-ad05-8402a6ded7fe', label: 'Armrest OP 60' },
];

for (const t of targets) {
  console.log(`\n═══ ${t.label} ═══`);
  const { data: row } = await sb.from('amfe_documents').select('data').eq('id', t.id).single();
  const d = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  for (const op of d.operations) {
    const n = op.operationName ?? op.name ?? '';
    const nn = norm(n);
    if (!nn.includes('INYECCION')) continue;
    if (nn.includes('PU')) { console.log(`  SKIP (PU): ${n}`); continue; }
    console.log(`  OP ${op.operationNumber ?? op.opNumber} ${n}`);
    console.log(`  focusElementFunction: ${op.focusElementFunction ?? '(none)'}`);
    console.log(`  operationFunction: ${op.operationFunction ?? '(none)'}`);
    console.log(`  linkedPfdStepId: ${op.linkedPfdStepId ?? '(none)'}`);
    for (const we of (op.workElements || [])) {
      console.log(`    WE [${we.type}] ${we.name}`);
      for (const fn of (we.functions || [])) {
        console.log(`      fn: ${fn.description || fn.functionDescription || '(no desc)'}`);
        for (const fm of (fn.failures || [])) {
          console.log(`        FM: ${fm.description}`);
          console.log(`           effectLocal:     ${fm.effectLocal || '(empty)'}`);
          console.log(`           effectNextLevel: ${fm.effectNextLevel || '(empty)'}`);
          console.log(`           effectEndUser:   ${fm.effectEndUser || '(empty)'}`);
          for (const c of (fm.causes || [])) {
            console.log(`           - S=${c.severity} O=${c.occurrence} D=${c.detection} AP=${c.actionPriority || c.ap}  ${c.description || c.cause}`);
          }
        }
      }
    }
  }
}
