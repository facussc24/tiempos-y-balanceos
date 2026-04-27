// Reemplaza CMM 3D por controles validos. Confirmado por Fak 2026-04-27.
// Opcion A: "Verificacion dimensional con calibre + plantilla, inicio y fin de turno"
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const APPLY = process.argv.includes('--apply');

const envText = readFileSync('C:/Users/FacundoS-PC/dev/BarackMercosul/.env.local', 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const REPLACEMENTS = [
  {
    old: 'Capability CMM 3D validado + patron dimensional',
    new: 'Plantilla dimensional validada al setup + plan de calibracion de calibre',
    label: 'CMM 3D PREV -> plantilla + calibracion',
  },
  {
    old: 'CMM 3D o calibre, 5 piezas por lote',
    new: 'Verificacion dimensional con calibre + plantilla, inicio y fin de turno',
    label: 'CMM 3D DET -> calibre + plantilla, inicio y fin de turno',
  },
];

// Buscar todos los AMFE/CP/HO afectados dinamicamente
const TABLES = ['amfe_documents', 'cp_documents', 'ho_documents'];
let total = 0;
const summary = [];

for (const tbl of TABLES) {
  const { data: rows } = await sb.from(tbl).select('id, data');
  for (const row of rows) {
    let dataObj = row.data;
    if (typeof dataObj === 'string') dataObj = JSON.parse(dataObj);
    let raw = JSON.stringify(dataObj);
    let docCount = 0;
    const details = [];
    for (const r of REPLACEMENTS) {
      const escaped = r.old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'g');
      const matches = raw.match(re);
      if (matches) {
        raw = raw.replace(re, r.new);
        docCount += matches.length;
        details.push(`    [${matches.length}x] ${r.label}`);
      }
    }
    if (docCount > 0) {
      summary.push({ tbl, id: row.id, count: docCount, details });
      total += docCount;
      if (APPLY) {
        const newData = JSON.parse(raw);
        const { error } = await sb.from(tbl).update({ data: newData }).eq('id', row.id);
        if (error) { console.error(`FAIL ${tbl} ${row.id}: ${error.message}`); continue; }
      }
    }
  }
}

console.log(`\n${APPLY ? '✓ APPLIED' : '🔍 DRY-RUN'} — total: ${total}`);
for (const s of summary) {
  console.log(`\n  ${s.tbl} ${s.id.slice(0,8)} — ${s.count} fix:`);
  for (const d of s.details) console.log(d);
}
if (!APPLY) console.log('\n→ Ejecuta con --apply para escribir.');
