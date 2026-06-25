/**
 * _insertAmfe3.mjs — Inserta el AMFE-3 (de tmp/amfe3.data.min.json) en Supabase.
 * Lee credenciales de env (SUPA_URL, SUPA_ANON). Intenta sesion authenticated via signUp
 * (la policy authenticated_all_amfe_documents exige rol authenticated). Si no hay sesion,
 * sale con codigo 2 (NO_AUTH) para fallback por MCP. data se guarda como TEXT (string).
 * Verifica round-trip (longitud + parse + counts). NO doble-serializa.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const SUPA_URL = process.env.SUPA_URL, ANON = process.env.SUPA_ANON;
if (!SUPA_URL || !ANON) { console.log('FALTAN ENV SUPA_URL/SUPA_ANON'); process.exit(1); }
const out = rel => new URL(rel, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const dataStr = readFileSync(out('../tmp/amfe3.data.min.json'), 'utf8');
const meta = JSON.parse(readFileSync(out('../tmp/amfe3.meta.json'), 'utf8'));

const sb = createClient(SUPA_URL, ANON);

// ── insert directo via anon (politica RLS temporal tmp_anon_amfe_load creada via MCP) ──
console.log('Usando anon directo (politica RLS temporal).');

// ── guard: no duplicar AMFE-3 ──
const dup = await sb.from('amfe_documents').select('id').eq('amfe_number', 'AMFE-3');
if (dup.error) { console.log('SELECT dup error:', dup.error.message); process.exit(3); }
if (dup.data?.length) { console.log('YA EXISTE AMFE-3:', JSON.stringify(dup.data)); process.exit(3); }

// ── insert (data como TEXT string, sin doble serializar) ──
const row = {
    id: meta.id, amfe_number: 'AMFE-3', project_name: meta.project_name,
    subject: '', client: 'PWA', part_number: meta.part_number, responsible: 'Carlos Baptista',
    organization: 'BARACK MERCOSUL', status: 'draft',
    operation_count: meta.operation_count, cause_count: meta.cause_count,
    ap_h_count: meta.ap_h_count, ap_m_count: meta.ap_m_count,
    start_date: '24/06/2026', last_revision_date: '24/06/2026', revision_level: 'A',
    data: dataStr, revisions: '[]', checksum: '',
};
const ins = await sb.from('amfe_documents').insert(row);
if (ins.error) { console.log('INSERT ERROR:', ins.error.message); process.exit(4); }

// ── verify round-trip ──
const v = await sb.from('amfe_documents')
    .select('id,amfe_number,operation_count,cause_count,ap_h_count,ap_m_count,data')
    .eq('id', meta.id).single();
if (v.error) { console.log('VERIFY error:', v.error.message); process.exit(5); }
const isStr = typeof v.data.data === 'string';
const lenMatch = isStr && v.data.data.length === dataStr.length;
let ops = -1, cc = -1;
try { const p = JSON.parse(v.data.data); ops = p.operations.length; cc = p.operations.reduce((a, o) => a + o.workElements.reduce((b, w) => b + w.functions.reduce((c, f) => c + f.failures.reduce((d, fm) => d + fm.causes.length, 0), 0), 0), 0); } catch (e) { console.log('PARSE FAIL', e.message); }
console.log('=== VERIFY ===');
console.log('id:', v.data.id, '| amfe:', v.data.amfe_number);
console.log('data typeof string:', isStr, '| len server:', v.data.data.length, 'local:', dataStr.length, 'MATCH:', lenMatch);
console.log('ops:', ops, '| causas(jsonb):', cc, '| col cause_count:', v.data.cause_count, '| ap_h:', v.data.ap_h_count, '| ap_m:', v.data.ap_m_count);
console.log(lenMatch && ops === meta.operation_count && cc === meta.cause_count ? 'INSERT_OK' : 'INSERT_MISMATCH');
