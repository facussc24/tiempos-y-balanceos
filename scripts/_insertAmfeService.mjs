// Inserta AMFE 128 y 129 en Supabase usando la SERVICE_ROLE key (bypassa RLS, sin login).
// Lee .env.local (VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). Verifica round-trip + md5.
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

let env = {};
try {
  env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
} catch { /* sin .env.local: uso process.env */ }
const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex');

for (const k of ['128', '129']) {
  const doc = JSON.parse(readFileSync(`tmp/amfe${k}.barack.json`, 'utf8'));
  const m = JSON.parse(readFileSync(`tmp/amfe${k}.meta.json`, 'utf8'));
  const dataStr = JSON.stringify(doc);
  // guard: no existe ya
  const { data: ex } = await sb.from('amfe_documents').select('id,amfe_number').eq('amfe_number', k);
  if (ex && ex.length) { console.log(`AMFE ${k} YA EXISTE (id=${ex[0].id}) — salteo (no duplico).`); continue; }
  const row = {
    id: m.id, amfe_number: k, project_name: m.project_name, subject: m.subject, client: 'VWA',
    part_number: m.part_number, responsible: m.responsible, organization: m.organization, status: 'draft',
    operation_count: m.operation_count, cause_count: m.cause_count, ap_h_count: m.ap_h_count, ap_m_count: m.ap_m_count,
    coverage_percent: m.coverage_percent, start_date: m.start_date, last_revision_date: m.last_revision_date,
    revision_level: m.revision_level, data: dataStr, revisions: '[]', checksum: '',
  };
  const { error } = await sb.from('amfe_documents').insert(row);
  if (error) { console.error(`INSERT ${k} FALLO:`, error.message); continue; }
  // verificar
  const { data: v, error: ve } = await sb.from('amfe_documents').select('id,operation_count,cause_count,data').eq('id', m.id).single();
  if (ve || !v) { console.error(`VERIFY ${k} FALLO:`, ve?.message); continue; }
  const back = typeof v.data === 'string' ? v.data : JSON.stringify(v.data);
  const parsed = typeof v.data === 'string' ? JSON.parse(v.data) : v.data;
  const okMd5 = md5(back) === m.data_md5;
  const okArr = Array.isArray(parsed.operations);
  console.log(`AMFE ${k}: INSERT OK id=${m.id} | ops=${v.operation_count} causes=${v.cause_count} | data objeto/array=${okArr} | md5 ${okMd5 ? 'COINCIDE ✓' : '*** DIFIERE ***'}`);
}
console.log('DONE');
