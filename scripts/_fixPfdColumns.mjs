// Fix: sincronizar columnas metadata de pfd_documents con data.header para los 2 PFDs recien generados
// Las columnas part_number, part_name, customer_name, step_count, document_number, revision_level se usan en UI listing
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// Todos los PFDs - sincronizar columnas con header
const { data: pfds } = await sb.from('pfd_documents').select('id, data, step_count, part_name');

for (const p of pfds || []) {
  const d = typeof p.data === 'string' ? JSON.parse(p.data) : p.data;
  const h = d.header || {};
  const stepCount = (d.steps || []).length;
  const update = {
    part_number: h.partNumber || '',
    part_name: h.partName || '',
    document_number: h.documentNumber || '',
    revision_level: h.revisionLevel || 'A',
    revision_date: h.revisionDate || '',
    customer_name: h.customerName || '',
    step_count: stepCount,
  };
  const needs = p.step_count !== stepCount || !p.part_name;
  if (!needs) { console.log(`  OK: ${p.id} (${p.part_name} - ${p.step_count} pasos)`); continue; }
  const { error } = await sb.from('pfd_documents').update(update).eq('id', p.id);
  if (error) { console.error(`  ${p.id}: ${error.message}`); continue; }
  console.log(`  FIX: ${p.id} -> ${update.part_name} (${update.step_count} pasos, ${update.customer_name})`);
}
process.exit(0);
