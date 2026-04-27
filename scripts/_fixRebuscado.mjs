// Reemplaza 5 frases rebuscadas detectadas en audit 2026-04-27.
// Confirmado por Fak. Aplica regla amfe.md "Maximo 8-10 palabras".
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

// Pares old → new exactos. Orden: mas larga primero (asi no rompe los combinados).
// String match (no regex). Las combinadas con " / " caen automaticamente al matchear el prefijo.
const REPLACEMENTS = [
  // 1. "guia coser" — 5 variantes
  ['Guía física en la máquina de coser y ajuste validado del pie y avance, junto con puesta a punto estandarizado para asegurar alineación de la costura decorativa.', 'Guía física en máquina + setup validado del pie y avance.'],
  ['Guía física en la máquina de coser y ajuste validado del pie y avance, junto con setup estandarizado para asegurar alineación de la costura decorativa.', 'Guía física en máquina + setup validado del pie y avance.'],
  ['Guia fisica en la maquina de coser y ajuste validado del pie y avance, junto con setup estandarizado para asegurar alineacion de la costura decorativa', 'Guía física en máquina + setup validado del pie y avance'],

  // 2. "limpieza purga" — 3 variantes (mas larga primero)
  ['Procedimiento de limpieza y purga estandarizado para la cavidad y línea de partición del molde', 'Limpieza y purga del molde según instructivo'],
  ['Procedimiento de limpieza y purga estandarizado para la cavidad y linea de particion del molde', 'Limpieza y purga del molde según instructivo'],
  ['Procedimiento de limpieza y purga estandarizado para la cavidad', 'Limpieza y purga del molde según instructivo'],

  // 3. "puesta a punto" — 3 variantes (mas larga primero)
  ['Instrucción de Puesta a punto Estandarizada (Plan de Control / Hoja de Proceso) que detalla valores nominales y rangos de tolerancia', 'Setup con valores nominales + rangos de tolerancia'],
  ['Instrucción de Puesta a punto Estandarizada detallando valores nominales y rangos', 'Setup con valores nominales + rangos de tolerancia'],
  ['Instruccion de Puesta a punto Estandarizada (Plan de Control / Hoja de Proceso)', 'Setup según Plan de Control + Hoja de Proceso'],

  // 4. "monitoreo presion" — 1 variante simple (las combinadas se cubren via #3 tambien)
  ['Monitoreo automatico de presion y mantenimiento preventivo con calibracion periodica de sensores', 'Sensor de presión con alarma + plan de calibración'],

  // 5. "contenedores OK/NC"
  ['Estandarización y diferenciación física de contenedores OK/NC', 'Contenedores OK/NC identificados con cartelería'],
];

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
    for (const [oldStr, newStr] of REPLACEMENTS) {
      // String match (split + join), no regex — exacto
      const parts = raw.split(oldStr);
      if (parts.length > 1) {
        const n = parts.length - 1;
        raw = parts.join(newStr);
        docCount += n;
        details.push(`    [${n}x] "${oldStr.slice(0,50)}..." → "${newStr.slice(0,50)}"`);
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
