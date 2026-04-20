/**
 * Reemplaza "F. Santoro" / "Facundo Santoro" / "Facundo Santoro (Calidad)" -> "Carlos Baptista"
 * en TODOS los AMFE y PFD. Fuerza `approvedBy` = "Gonzalo Cal" en AMFE y PFD.
 * No toca CP ni HO (por pedido explicito de Fak, 2026-04-20).
 *
 * Campos tocados:
 *   AMFE:
 *     - row.responsible (columna top-level)
 *     - data.header.responsible, processResponsible, elaboratedBy, reviewedBy, preparedBy, keyContact
 *     - data.header.coreTeam (string o array) — reemplaza y deduplica
 *     - data.header.approvedBy -> "Gonzalo Cal"
 *     - data.header.plantApproval -> "Gonzalo Cal" (idempotente)
 *   PFD:
 *     - data.header.preparedBy, keyContact -> "Carlos Baptista"
 *     - data.header.coreTeam -> reemplaza "Facundo Santoro" con "Carlos Baptista" y dedup
 *     - data.header.approvedBy -> "Gonzalo Cal"
 *
 * Idempotente. Corre sobre Supabase real.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const BAPTISTA = 'Carlos Baptista';
const GONZALO = 'Gonzalo Cal';
// Patron que matchea "F. Santoro", "Facundo Santoro", "Facundo Santoro (Calidad)", "F.Santoro"
const SANTORO_RE = /(F\.?\s*|Facundo\s+)Santoro(\s*\([^)]*\))?/gi;

function replaceSantoroInString(s) {
  if (typeof s !== 'string') return s;
  return s.replace(SANTORO_RE, BAPTISTA);
}

function normalizeCoreTeam(team) {
  // team puede ser string "A, B, C" o array ["A","B","C"]
  let arr;
  if (Array.isArray(team)) arr = team.map(String);
  else if (typeof team === 'string' && team.trim()) arr = team.split(',').map(s => s.trim());
  else return team;

  // reemplazar Santoro -> Baptista en cada item
  arr = arr.map(replaceSantoroInString);
  // dedup preservando orden (comparar normalizando espacios y quitando el role entre parentesis para el key)
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const key = item.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(item); }
  }
  return Array.isArray(team) ? out : out.join(', ');
}

function fixAmfeHeader(h) {
  const out = { ...h };
  const changed = [];
  const SANTORO_FIELDS = ['responsible', 'processResponsible', 'elaboratedBy', 'reviewedBy', 'preparedBy', 'keyContact', 'responsibleEngineer'];
  for (const f of SANTORO_FIELDS) {
    if (typeof out[f] === 'string' && SANTORO_RE.test(out[f])) {
      out[f] = replaceSantoroInString(out[f]);
      changed.push(f);
      SANTORO_RE.lastIndex = 0;
    }
  }
  if (out.coreTeam) {
    const before = Array.isArray(out.coreTeam) ? out.coreTeam.join('|') : String(out.coreTeam);
    out.coreTeam = normalizeCoreTeam(out.coreTeam);
    const after = Array.isArray(out.coreTeam) ? out.coreTeam.join('|') : String(out.coreTeam);
    if (before !== after) changed.push('coreTeam');
  }
  // Aprobacion: siempre Gonzalo Cal en AMFE (regla Fak 2026-04-20)
  if (out.approvedBy !== GONZALO) { out.approvedBy = GONZALO; changed.push('approvedBy->Gonzalo'); }
  if (out.plantApproval !== GONZALO) { out.plantApproval = GONZALO; changed.push('plantApproval->Gonzalo'); }
  // Guard: reviewedBy no puede ser igual a approvedBy
  if (out.reviewedBy === out.approvedBy) {
    out.reviewedBy = BAPTISTA;
    changed.push('reviewedBy<>approvedBy');
  }
  return { header: out, changed };
}

function fixPfdHeader(h) {
  const out = { ...h };
  const changed = [];
  const SANTORO_FIELDS = ['preparedBy', 'keyContact'];
  for (const f of SANTORO_FIELDS) {
    if (typeof out[f] === 'string' && SANTORO_RE.test(out[f])) {
      out[f] = replaceSantoroInString(out[f]);
      changed.push(f);
      SANTORO_RE.lastIndex = 0;
    }
  }
  if (out.coreTeam) {
    const before = Array.isArray(out.coreTeam) ? out.coreTeam.join('|') : String(out.coreTeam);
    out.coreTeam = normalizeCoreTeam(out.coreTeam);
    const after = Array.isArray(out.coreTeam) ? out.coreTeam.join('|') : String(out.coreTeam);
    if (before !== after) changed.push('coreTeam');
  }
  // Aprobador siempre Gonzalo Cal en PFD
  if (out.approvedBy !== GONZALO) { out.approvedBy = GONZALO; changed.push('approvedBy->Gonzalo'); }
  return { header: out, changed };
}

// ============ AMFE ============
console.log('=== AMFE ===');
const { data: amfes, error: amfeErr } = await sb.from('amfe_documents').select('*');
if (amfeErr) throw amfeErr;

let amfeUpdated = 0;
for (const doc of amfes) {
  const parsed = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
  if (!parsed?.header) { console.log(`  - skip ${doc.amfe_number || doc.id.slice(0,8)} (no header)`); continue; }

  const { header, changed } = fixAmfeHeader(parsed.header);
  parsed.header = header;

  // Campo responsible top-level (columna del row, no dentro de data)
  const newResponsible = typeof doc.responsible === 'string' && SANTORO_RE.test(doc.responsible)
    ? replaceSantoroInString(doc.responsible) : doc.responsible;
  SANTORO_RE.lastIndex = 0;
  const responsibleChanged = newResponsible !== doc.responsible;

  if (changed.length === 0 && !responsibleChanged) continue;

  const update = { data: parsed };
  if (responsibleChanged) update.responsible = newResponsible;

  const { error: upErr } = await sb.from('amfe_documents').update(update).eq('id', doc.id);
  if (upErr) { console.log(`  X ${doc.amfe_number || doc.id.slice(0,8)}: ${upErr.message}`); continue; }
  const tag = (doc.amfe_number || doc.id.slice(0,8)).padEnd(30);
  console.log(`  OK ${tag} [${[...changed, ...(responsibleChanged ? ['row.responsible'] : [])].join(', ')}]`);
  amfeUpdated++;
}
console.log(`AMFE actualizados: ${amfeUpdated}/${amfes.length}`);

// ============ PFD ============
console.log('\n=== PFD ===');
const { data: pfds, error: pfdErr } = await sb.from('pfd_documents').select('*');
if (pfdErr) throw pfdErr;

let pfdUpdated = 0;
for (const doc of pfds) {
  const parsed = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
  if (!parsed?.header) { console.log(`  - skip ${doc.document_number || doc.id.slice(0,8)} (no header)`); continue; }

  const { header, changed } = fixPfdHeader(parsed.header);
  if (changed.length === 0) continue;
  parsed.header = header;

  const { error: upErr } = await sb.from('pfd_documents').update({ data: parsed }).eq('id', doc.id);
  if (upErr) { console.log(`  X ${doc.document_number || doc.id.slice(0,8)}: ${upErr.message}`); continue; }
  const tag = (doc.document_number || doc.id.slice(0,8)).padEnd(30);
  console.log(`  OK ${tag} [${changed.join(', ')}]`);
  pfdUpdated++;
}
console.log(`PFD actualizados: ${pfdUpdated}/${pfds.length}`);

// ============ Verificacion ============
console.log('\n=== Verificacion ===');
const { data: verifAmfe } = await sb.from('amfe_documents').select('id, amfe_number, responsible, data');
const { data: verifPfd } = await sb.from('pfd_documents').select('id, document_number, data');
let remaining = 0;

function scanForSantoro(doc, tag) {
  const hits = [];
  function walk(obj, path = '') {
    if (obj === null || obj === undefined) return;
    if (typeof obj === 'string') {
      SANTORO_RE.lastIndex = 0;
      if (SANTORO_RE.test(obj)) hits.push(`${path}="${obj}"`);
      return;
    }
    if (Array.isArray(obj)) { obj.forEach((v, i) => walk(v, `${path}[${i}]`)); return; }
    if (typeof obj === 'object') for (const k of Object.keys(obj)) walk(obj[k], path ? `${path}.${k}` : k);
  }
  walk(doc);
  if (hits.length) { console.log(`  RESTA ${tag}: ${hits.join('; ')}`); remaining += hits.length; }
}

for (const d of verifAmfe) {
  const parsed = typeof d.data === 'string' ? JSON.parse(d.data) : d.data;
  scanForSantoro({ responsible: d.responsible, data: parsed }, d.amfe_number || d.id.slice(0,8));
  // Tambien chequear approvedBy
  const approvedBy = parsed?.header?.approvedBy;
  if (approvedBy !== GONZALO) console.log(`  AMFE ${d.amfe_number}: approvedBy="${approvedBy}" (esperado "${GONZALO}")`);
}
for (const d of verifPfd) {
  const parsed = typeof d.data === 'string' ? JSON.parse(d.data) : d.data;
  scanForSantoro({ data: parsed }, d.document_number || d.id.slice(0,8));
  const approvedBy = parsed?.header?.approvedBy;
  if (approvedBy !== GONZALO) console.log(`  PFD ${d.document_number}: approvedBy="${approvedBy}" (esperado "${GONZALO}")`);
}

console.log(`\nSantoro menciones restantes: ${remaining}`);
console.log(remaining === 0 ? 'OK — Sin Santoro en AMFE/PFD.' : 'REVISAR — aun quedan menciones.');
process.exit(0);
