// Reemplaza los 4 textos inventados detectados 2026-04-27 por sus equivalentes
// validados (calcados de otros AMFEs Barack que usan controles reales).
//
// Uso:
//   node scripts/_fixInventos.mjs            -> dry-run (muestra cambios, NO escribe)
//   node scripts/_fixInventos.mjs --apply    -> aplica a Supabase
//
// Backup obligatorio previo. Validado por Fak 2026-04-27.

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

// Reemplazos exactos: [old, new, alias_old?]
// Multiples old para cubrir variantes de acentuacion.
const REPLACEMENTS = [
  {
    old: ['Limpieza de molde programada cada 4 hs con hielo seco'],
    new: 'Plan de mantenimiento preventivo de molde con limpieza programada de canales de vacío',
    label: 'hielo seco -> mantto preventivo',
  },
  {
    old: ['Medición por Ultrasonido cada 2 horas', 'Medicion por Ultrasonido cada 2 horas'],
    new: 'Inspección visual de primera pieza post-conformado + verificación de espesor con calibre en zona crítica',
    label: 'ultrasonido cada 2h -> visual + calibre',
  },
  {
    old: ['Medición de ancho con flexómetro al inicio de cada bobina', 'Medicion de ancho con flexometro al inicio de cada bobina'],
    new: 'Verificación de ancho con cinta métrica al inicio de cada bobina',
    label: 'flexómetro -> cinta métrica',
  },
  {
    old: ['Rotacion de inspectores cada 2 horas', 'Rotación de inspectores cada 2 horas'],
    new: 'Catálogo de defectos con fotos de aceptación y rechazo + ayudas visuales en el puesto',
    label: 'rotacion inspectores -> catalogo defectos',
  },
];

const TARGETS = [
  { table: 'amfe_documents', ids: ['78eaa89b-ad0b-4342-9046-ab2e9b14d3b3','c9b93b84-f804-4cd0-91c1-c4878db41b97','c5201ba9-1225-4663-b7a1-5430f9ee8912'] },
  { table: 'cp_documents',   ids: ['69f6daf9-f2aa-49bd-a70a-ff1b02fcec0d'] },
  { table: 'ho_documents',   ids: ['a7201817-ba29-46ec-bd24-3eee05a5a76f'] },
];

// Encuentra HO id real (snapshot tenia a7201817)
const { data: hos } = await sb.from('ho_documents').select('id, data');
TARGETS[2].ids = hos.filter(h => {
  const s = typeof h.data === 'string' ? h.data : JSON.stringify(h.data);
  return s.includes('hielo seco') || s.includes('flexómetro') || s.includes('Ultrasonido cada');
}).map(h => h.id);
console.log('HO ids con inventos:', TARGETS[2].ids);

let totalReplacements = 0;
const summary = [];

for (const tgt of TARGETS) {
  for (const id of tgt.ids) {
    const { data: row, error } = await sb.from(tgt.table).select('data').eq('id', id).single();
    if (error) { console.error(`SKIP ${tgt.table} ${id}: ${error.message}`); continue; }

    // Defensa double-serialization: si data viene como string (JSONB mal-guardado), parsear primero.
    let dataObj = row.data;
    if (typeof dataObj === 'string') {
      console.log(`  WARN ${tgt.table} ${id.slice(0,8)} venia double-serialized — re-parseando.`);
      dataObj = JSON.parse(dataObj);
    }
    let raw = JSON.stringify(dataObj);
    let docReplacements = 0;
    const docDetails = [];

    for (const r of REPLACEMENTS) {
      for (const oldText of r.old) {
        // Escape regex special chars
        const escaped = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(escaped, 'g');
        const matches = raw.match(re);
        if (matches) {
          raw = raw.replace(re, r.new);
          docReplacements += matches.length;
          docDetails.push(`    [${matches.length}x] ${r.label}`);
        }
      }
    }

    if (docReplacements > 0) {
      summary.push({ table: tgt.table, id, replacements: docReplacements, details: docDetails });
      totalReplacements += docReplacements;
      const newData = JSON.parse(raw);

      if (APPLY) {
        const { error: upErr } = await sb.from(tgt.table).update({ data: newData }).eq('id', id);
        if (upErr) { console.error(`FAIL ${tgt.table} ${id}: ${upErr.message}`); continue; }
        // Verify post-write
        const { data: ver } = await sb.from(tgt.table).select('data').eq('id', id).single();
        if (typeof ver.data !== 'object' || ver.data === null) {
          console.warn(`  WARN ${tgt.table} ${id.slice(0,8)} quedo double-serialized — fixDoubleSerializedDocs.mjs lo limpia despues.`);
        }
      }
    }
  }
}

console.log(`\n${APPLY ? '✓ APPLIED' : '🔍 DRY-RUN'} — total replacements: ${totalReplacements}`);
for (const s of summary) {
  console.log(`\n  ${s.table} ${s.id.slice(0,8)} — ${s.replacements} fix:`);
  for (const d of s.details) console.log(d);
}

if (!APPLY) console.log(`\n→ Ejecuta con --apply para escribir a Supabase.`);
