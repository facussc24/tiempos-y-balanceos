/**
 * fixRemainingEnglish.mjs
 *
 * Limpia terminos en ingles restantes en maestros de inyeccion y logistica:
 *   - "(runner)" "(gate)" "(flashes)" "(sink marks)" "(setup)" — parenteticos
 *   - "gate" "runner" "Setup" "flashes" "sink marks" — standalone
 *
 * Uso:
 *   node scripts/fixRemainingEnglish.mjs          # dry-run
 *   node scripts/fixRemainingEnglish.mjs --apply   # aplica
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const APPLY = process.argv.includes('--apply');

// Replacements: ordered longest first, case-sensitive
const REPLACEMENTS = [
  // Parenthetical English — remove entirely
  [' (rechupes / sink marks)', ''],
  [' (flashes)', ''],
  [' (runner)', ''],
  [' (gate)', ''],
  [' (verificacion gates)', ''],
  [' (setup y verificacion primer disparo)', ''],
  // Standalone compound phrases
  ['punto de gate', 'punto de inyeccion'],
  ['area de gate', 'area del punto de inyeccion'],
  ['del gate', 'del punto de inyeccion'],
  ['sink marks', 'rechupes'],
  ['Sink marks', 'Rechupes'],
  // Standalone single words
  ['Setup incorrecto', 'Puesta a punto incorrecta'],
  ['Setup incompleto', 'Puesta a punto incompleta'],
  ['el setup', 'la puesta a punto'],
  ['gates', 'puntos de inyeccion'],
  ['gate', 'punto de inyeccion'],
  ['flashes', 'rebabas'],
  ['runner', 'colada'],
  ['Setup', 'Puesta a punto'],
  ['setup', 'puesta a punto'],
];

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function applyReplacements(str) {
  let result = str;
  for (const [find, replace] of REPLACEMENTS) {
    result = result.replace(new RegExp(escapeRegex(find), 'g'), replace);
  }
  return result;
}

function walkAndFix(obj, path, changes) {
  if (typeof obj === 'string') {
    const fixed = applyReplacements(obj);
    if (fixed !== obj) changes.push({ path, old: obj, new: fixed });
    return fixed;
  }
  if (Array.isArray(obj)) return obj.map((v, i) => walkAndFix(v, `${path}[${i}]`, changes));
  if (obj && typeof obj === 'object') {
    const r = {};
    for (const [k, v] of Object.entries(obj)) r[k] = walkAndFix(v, `${path}.${k}`, changes);
    return r;
  }
  return obj;
}

// Scan ALL amfe and cp documents
const DOCS = [
  { table: 'amfe_documents', nameCol: 'amfe_number' },
  { table: 'cp_documents', nameCol: 'control_plan_number' },
];

let totalChanges = 0;
const allAffected = [];

for (const { table, nameCol } of DOCS) {
  const { data: rows, error } = await sb.from(table).select(`id, ${nameCol}, data`);
  if (error) { console.error(`ERROR reading ${table}:`, error.message); continue; }

  for (const row of rows) {
    const dataStr = typeof row.data === 'string' ? row.data : JSON.stringify(row.data);
    // Quick check if any English term exists
    if (!/runner|gate|flash|sink mark|Setup|setup/i.test(dataStr)) continue;

    const parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    const changes = [];
    const fixed = walkAndFix(parsed, 'data', changes);

    if (changes.length > 0) {
      const name = row[nameCol] || row.id;
      console.log(`\n${table} — ${name}: ${changes.length} cambios`);
      for (const c of changes) {
        console.log(`  ${c.path}`);
        console.log(`    OLD: "${c.old.slice(0, 120)}"`);
        console.log(`    NEW: "${c.new.slice(0, 120)}"`);
      }
      totalChanges += changes.length;
      allAffected.push({ table, id: row.id, name, changes, fixed, originalData: row.data });
    }
  }
}

console.log(`\n=== TOTAL: ${totalChanges} cambios en ${allAffected.length} documentos ===`);

if (totalChanges === 0) { console.log('Nada que corregir.'); process.exit(0); }
if (!APPLY) { console.log('\n*** DRY RUN — usar --apply ***'); process.exit(0); }

// APPLY
console.log('\n=== APLICANDO ===\n');
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = new URL(`../backups/fix-english2-${ts}/`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
mkdirSync(backupDir, { recursive: true });

for (const doc of allAffected) {
  const toWrite = typeof doc.originalData === 'string' ? JSON.stringify(doc.fixed) : doc.fixed;
  const { error } = await sb.from(doc.table).update({ data: toWrite, updated_at: new Date().toISOString() }).eq('id', doc.id);
  if (error) { console.error(`ERROR ${doc.name}:`, error.message); continue; }
  console.log(`  ${doc.name} OK (${doc.changes.length} cambios)`);
}

// Verify
console.log('\n=== VERIFICACION ===');
let remaining = 0;
for (const { table } of DOCS) {
  const { data: rows } = await sb.from(table).select('id, data');
  for (const row of rows) {
    const str = typeof row.data === 'string' ? row.data : JSON.stringify(row.data);
    const m = str.match(/\b(?:runner|gate|flash(?:es)?|sink marks?|Setup|setup)\b/g);
    if (m) { console.log(`  QUEDAN: ${row.id} → ${m.join(', ')}`); remaining += m.length; }
  }
}
console.log(remaining === 0 ? '  LIMPIO — 0 terminos en ingles' : `  ATENCION: ${remaining} restantes`);
