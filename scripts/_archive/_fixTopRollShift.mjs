/**
 * Fix Top Roll — shift +10 con Number() explicito.
 * OP 5 -> 10, otros: n + 10.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

function shift(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return n;
  return num === 5 ? 10 : num + 10;
}

// AMFE-TR-PAT
{
  const { data } = await sb.from('amfe_documents').select('*').eq('amfe_number', 'AMFE-TR-PAT').single();
  const p = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
  for (const op of p.operations || []) {
    const old = Number(op.opNumber ?? op.operationNumber);
    const nu = shift(old);
    op.opNumber = nu;
    op.operationNumber = nu;
    console.log(`OP ${old} -> OP ${nu} (${op.name || op.operationName})`);
  }
  p.operations.sort((a, b) => a.opNumber - b.opNumber);
  const { error } = await sb.from('amfe_documents').update({ data: p }).eq('id', data.id);
  console.log('Save AMFE-TR-PAT:', error?.message || 'OK');
}

// PFD-TOPROLL-001
{
  const { data } = await sb.from('pfd_documents').select('*').eq('document_number', 'PFD-TOPROLL-001').single();
  const p = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
  for (const s of p.steps || []) {
    const old = s.opNumber;
    if (typeof old === 'number' || (typeof old === 'string' && /^\d+$/.test(old))) {
      s.opNumber = shift(old);
      console.log(`PFD OP ${old} -> OP ${s.opNumber}`);
    }
  }
  const { error } = await sb.from('pfd_documents').update({ data: p }).eq('id', data.id);
  console.log('Save PFD-TOPROLL-001:', error?.message || 'OK');
}

// Verificar
const { data: verif } = await sb.from('amfe_documents').select('data').eq('amfe_number', 'AMFE-TR-PAT').single();
const pv = typeof verif.data === 'string' ? JSON.parse(verif.data) : verif.data;
console.log('\n=== Verif AMFE-TR-PAT ===');
for (const op of pv.operations) console.log('  OP', op.opNumber, op.name || op.operationName);
process.exit(0);
