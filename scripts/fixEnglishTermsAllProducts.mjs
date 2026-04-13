/**
 * fixEnglishTermsAllProducts.mjs
 *
 * Busca y corrige terminos en ingles ("gauge", "pattern board") y pellets redundantes
 * en TODOS los amfe_documents y cp_documents de Supabase, no solo los maestros.
 *
 * Esto propaga las mismas correcciones del maestro a todos los productos que recibieron
 * esos terminos via sync scripts anteriores.
 *
 * Uso:
 *   node scripts/fixEnglishTermsAllProducts.mjs          # dry-run
 *   node scripts/fixEnglishTermsAllProducts.mjs --apply   # aplica cambios
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

// ── Supabase connection ─────────────────────────────────────────────────────
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const APPLY = process.argv.includes('--apply');

// ── Same replacements as fixEnglishTermsMasters.mjs ─────────────────────────
const TEXT_REPLACEMENTS = [
  ['Calibre / gauge dimensional calibrado', 'Calibre dimensional calibrado'],
  ['calibre / gauge dimensional calibrado', 'Calibre dimensional calibrado'],
  ['Calibre / gauge dimensional', 'Calibre dimensional'],
  ['calibre / gauge dimensional', 'Calibre dimensional'],
  ['Calibre / gauge', 'Calibre'],
  ['calibre / gauge', 'calibre'],
  ['Control dimensional con gauge', 'Control dimensional con calibre'],
  ['Control con gauge', 'Control con calibre'],
  ['Cinta métrica / gauge', 'Cinta métrica'],
  ['Cinta metrica / gauge', 'Cinta metrica'],
  // Standalone gauge variants
  ['Gauge + termocupla', 'Calibre + termocupla'],
  ['Gauge', 'Calibre'],
  // pattern board
  ['del pattern board', 'de la muestra patron'],
  ['del Pattern board', 'de la muestra patron'],
  ['el pattern board', 'la muestra patron'],
  ['el Pattern board', 'la muestra patron'],
  ['Pattern board', 'Muestra patron'],
  ['pattern board', 'muestra patron'],
];

const PELLET_RENAMES = [
  'Pellet virgen (materia prima directa)',
  'Pellet termoplastico (todos los tipos)',
  'Pellet virgen',
];
const PELLET_TARGET = 'Pellet termoplastico estandar (PP / PE)';

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function applyTextReplacements(str) {
  let result = str;
  for (const [find, replace] of TEXT_REPLACEMENTS) {
    const regex = new RegExp(escapeRegex(find), 'g');
    result = result.replace(regex, replace);
  }
  return result;
}

function applyPelletRename(str) {
  for (const old of PELLET_RENAMES) {
    if (str === old) return PELLET_TARGET;
  }
  return str;
}

function walkAndFix(obj, path, changes) {
  if (typeof obj === 'string') {
    let fixed = applyTextReplacements(obj);
    if (fixed !== obj) {
      changes.push({ path, old: obj, new: fixed });
    }
    return fixed;
  }
  if (Array.isArray(obj)) {
    return obj.map((item, i) => walkAndFix(item, `${path}[${i}]`, changes));
  }
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key === 'componentMaterial' && typeof val === 'string') {
        let fixed = applyPelletRename(val);
        fixed = applyTextReplacements(fixed);
        if (fixed !== val) {
          changes.push({ path: `${path}.${key}`, old: val, new: fixed });
        }
        result[key] = fixed;
      } else {
        result[key] = walkAndFix(val, `${path}.${key}`, changes);
      }
    }
    return result;
  }
  return obj;
}

// ── Skip master documents (already fixed) ───────────────────────────────────
const MASTER_CP_ID = '81b60cdd-1296-4821-a348-a8e3c2433b0d';
const MASTER_AMFE_ID = '4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c';

// ── SCAN ALL DOCUMENTS ──────────────────────────────────────────────────────
const ENGLISH_TERMS_REGEX = /gauge|pattern board|Pellet virgen|Pellet termoplastico \(todos/i;

async function scanAndFix(table, idField, nameField) {
  const { data: rows, error } = await sb.from(table).select(`id, ${nameField}, data`);
  if (error) { console.error(`ERROR reading ${table}:`, error.message); return []; }

  const affected = [];
  for (const row of rows) {
    if (row.id === MASTER_CP_ID || row.id === MASTER_AMFE_ID) continue;

    const dataStr = typeof row.data === 'string' ? row.data : JSON.stringify(row.data);
    if (!ENGLISH_TERMS_REGEX.test(dataStr)) continue;

    const parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    const changes = [];
    const fixed = walkAndFix(parsed, 'data', changes);

    if (changes.length > 0) {
      affected.push({ id: row.id, name: row[nameField], changes, fixed, originalData: row.data });
    }
  }
  return affected;
}

console.log('=== ESCANEANDO TODOS LOS DOCUMENTOS ===\n');

const cpAffected = await scanAndFix('cp_documents', 'id', 'control_plan_number');
const amfeAffected = await scanAndFix('amfe_documents', 'id', 'amfe_number');

console.log(`CP documents afectados: ${cpAffected.length}`);
for (const doc of cpAffected) {
  console.log(`\n  ${doc.name} (${doc.id}): ${doc.changes.length} cambios`);
  for (const c of doc.changes) {
    console.log(`    ${c.path}`);
    console.log(`      OLD: "${c.old}"`);
    console.log(`      NEW: "${c.new}"`);
  }
}

console.log(`\nAMFE documents afectados: ${amfeAffected.length}`);
for (const doc of amfeAffected) {
  console.log(`\n  ${doc.name} (${doc.id}): ${doc.changes.length} cambios`);
  for (const c of doc.changes) {
    console.log(`    ${c.path}`);
    console.log(`      OLD: "${c.old}"`);
    console.log(`      NEW: "${c.new}"`);
  }
}

const totalDocs = cpAffected.length + amfeAffected.length;
const totalChanges = cpAffected.reduce((s, d) => s + d.changes.length, 0) + amfeAffected.reduce((s, d) => s + d.changes.length, 0);
console.log(`\n=== RESUMEN: ${totalChanges} cambios en ${totalDocs} documentos ===`);

if (totalChanges === 0) {
  console.log('\nNo se encontraron terminos en ingles en documentos de productos. Todo limpio.');
  process.exit(0);
}

if (!APPLY) {
  console.log('\n*** DRY RUN — usar --apply para escribir en Supabase ***');
  process.exit(0);
}

// ── APPLY ───────────────────────────────────────────────────────────────────
console.log('\n=== APLICANDO CAMBIOS ===\n');

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = new URL(`../backups/fix-english-products-${ts}/`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
mkdirSync(backupDir, { recursive: true });

for (const doc of cpAffected) {
  const toWrite = typeof doc.originalData === 'string' ? JSON.stringify(doc.fixed) : doc.fixed;
  const { error } = await sb.from('cp_documents').update({ data: toWrite, updated_at: new Date().toISOString() }).eq('id', doc.id);
  if (error) { console.error(`ERROR writing CP ${doc.name}:`, error.message); continue; }
  console.log(`  CP ${doc.name} actualizado OK (${doc.changes.length} cambios)`);
}

for (const doc of amfeAffected) {
  const toWrite = typeof doc.originalData === 'string' ? JSON.stringify(doc.fixed) : doc.fixed;
  const { error } = await sb.from('amfe_documents').update({ data: toWrite, updated_at: new Date().toISOString() }).eq('id', doc.id);
  if (error) { console.error(`ERROR writing AMFE ${doc.name}:`, error.message); continue; }
  console.log(`  AMFE ${doc.name} actualizado OK (${doc.changes.length} cambios)`);
}

// ── VERIFICATION ────────────────────────────────────────────────────────────
console.log('\n=== VERIFICACION POST-ESCRITURA ===\n');

const { data: allCps } = await sb.from('cp_documents').select('id, control_plan_number, data');
const { data: allAmfes } = await sb.from('amfe_documents').select('id, amfe_number, data');

let remaining = 0;
for (const row of [...allCps, ...allAmfes]) {
  const str = typeof row.data === 'string' ? row.data : JSON.stringify(row.data);
  const gaugeCount = (str.match(/gauge/gi) || []).length;
  const pbCount = (str.match(/pattern board/gi) || []).length;
  if (gaugeCount > 0 || pbCount > 0) {
    const name = row.control_plan_number || row.amfe_number;
    console.log(`  ATENCION: ${name} todavia tiene gauge=${gaugeCount}, pattern_board=${pbCount}`);
    remaining += gaugeCount + pbCount;
  }
}

if (remaining === 0) {
  console.log('  VERIFICACION OK — 0 terminos en ingles en toda la base de datos');
} else {
  console.log(`  ATENCION — quedan ${remaining} instancias por corregir`);
}

writeFileSync(`${backupDir}/summary.json`, JSON.stringify({
  timestamp: ts,
  cpDocsFixed: cpAffected.map(d => ({ id: d.id, name: d.name, changes: d.changes.length })),
  amfeDocsFixed: amfeAffected.map(d => ({ id: d.id, name: d.name, changes: d.changes.length })),
  remainingTerms: remaining
}, null, 2));
console.log(`\n  Resumen guardado en: ${backupDir}/summary.json`);
