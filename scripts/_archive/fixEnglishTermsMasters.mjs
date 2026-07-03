/**
 * fixEnglishTermsMasters.mjs
 *
 * Corrige terminos en ingles en CP Maestro y AMFE Maestro de Inyeccion:
 *   1. "gauge" → "calibre" en diversas formas
 *   2. "pattern board" → "muestra patron"
 *   3. Consolida 4 variantes de "Pellet" en 2 categorias (AIAG CP 2024 Opcion B):
 *      - "Pellet higroscopico (ABS / PC / PA / PET)" → se mantiene
 *      - "Pellet virgen (materia prima directa)" / "Pellet termoplastico (todos los tipos)" / "Pellet virgen"
 *        → "Pellet termoplastico estandar (PP / PE)"
 *
 * Uso:
 *   node scripts/fixEnglishTermsMasters.mjs          # dry-run (solo reporta)
 *   node scripts/fixEnglishTermsMasters.mjs --apply   # aplica cambios en Supabase
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
const CP_DOC_ID = '81b60cdd-1296-4821-a348-a8e3c2433b0d';
const AMFE_DOC_ID = '4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c';

// ── Reemplazos de texto (ordenados de mas largo a mas corto) ────────────────
// IMPORTANT: These are applied in order. Longer/more-specific matches first.
const TEXT_REPLACEMENTS = [
  // gauge variants (longer first to avoid partial matches)
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
  // pattern board: handle Spanish grammar (del → de la, el → la)
  ['del pattern board', 'de la muestra patron'],
  ['del Pattern board', 'de la muestra patron'],
  ['el pattern board', 'la muestra patron'],
  ['el Pattern board', 'la muestra patron'],
  // pattern board as standalone name (capitalize when at start of value)
  ['Pattern board', 'Muestra patron'],
  ['pattern board', 'muestra patron'],
];

// Pellet consolidation: everything except "Pellet higroscopico" → "Pellet termoplastico estandar (PP / PE)"
const PELLET_RENAMES = [
  'Pellet virgen (materia prima directa)',
  'Pellet termoplastico (todos los tipos)',
  'Pellet virgen',
];
const PELLET_TARGET = 'Pellet termoplastico estandar (PP / PE)';

// ── Helpers ─────────────────────────────────────────────────────────────────
function applyTextReplacements(str) {
  let result = str;
  for (const [find, replace] of TEXT_REPLACEMENTS) {
    // Case-SENSITIVE replacement — each case variant is an explicit entry
    const regex = new RegExp(escapeRegex(find), 'g');
    result = result.replace(regex, replace);
  }
  return result;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyPelletRename(str) {
  let result = str;
  for (const old of PELLET_RENAMES) {
    if (result === old) {
      return PELLET_TARGET;
    }
  }
  return result;
}

/** Recursively walk an object, apply text replacements to all string values.
 *  Returns { modified, changes[] } */
function walkAndFix(obj, path, changes) {
  if (typeof obj === 'string') {
    let fixed = applyTextReplacements(obj);
    if (fixed !== obj) {
      changes.push({ path, old: obj, new: fixed, type: 'text' });
    }
    return fixed;
  }
  if (Array.isArray(obj)) {
    return obj.map((item, i) => walkAndFix(item, `${path}[${i}]`, changes));
  }
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
      // Special handling for componentMaterial: apply pellet rename
      if (key === 'componentMaterial' && typeof val === 'string') {
        let fixed = applyPelletRename(val);
        fixed = applyTextReplacements(fixed);
        if (fixed !== val) {
          changes.push({ path: `${path}.${key}`, old: val, new: fixed, type: 'pellet+text' });
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

// ── PART A: Fix CP Master ───────────────────────────────────────────────────
console.log('=== PART A: CP MAESTRO (CP-MAESTRO-INY-001) ===\n');

const { data: cpRow, error: cpErr } = await sb
  .from('cp_documents')
  .select('id, control_plan_number, item_count, data')
  .eq('id', CP_DOC_ID)
  .single();
if (cpErr) { console.error('ERROR reading CP:', cpErr.message); process.exit(1); }

const cpParsed = typeof cpRow.data === 'string' ? JSON.parse(cpRow.data) : cpRow.data;
console.log(`  Items in CP: ${cpParsed.items.length}`);

const cpChanges = [];
const cpFixed = walkAndFix(cpParsed, 'cp', cpChanges);

console.log(`\n  Cambios encontrados en CP: ${cpChanges.length}`);
for (const c of cpChanges) {
  console.log(`    ${c.path}`);
  console.log(`      OLD: "${c.old}"`);
  console.log(`      NEW: "${c.new}"`);
}

// ── PART B: Fix AMFE Master ─────────────────────────────────────────────────
console.log('\n=== PART B: AMFE MAESTRO (AMFE-MAESTRO-INY-001) ===\n');

const { data: amfeRow, error: amfeErr } = await sb
  .from('amfe_documents')
  .select('id, amfe_number, operation_count, data')
  .eq('id', AMFE_DOC_ID)
  .single();
if (amfeErr) { console.error('ERROR reading AMFE:', amfeErr.message); process.exit(1); }

const amfeParsed = typeof amfeRow.data === 'string' ? JSON.parse(amfeRow.data) : amfeRow.data;
console.log(`  Operations in AMFE: ${amfeParsed.operations.length}`);

const amfeChanges = [];
const amfeFixed = walkAndFix(amfeParsed, 'amfe', amfeChanges);

console.log(`\n  Cambios encontrados en AMFE: ${amfeChanges.length}`);
for (const c of amfeChanges) {
  console.log(`    ${c.path}`);
  console.log(`      OLD: "${c.old}"`);
  console.log(`      NEW: "${c.new}"`);
}

// ── SUMMARY ─────────────────────────────────────────────────────────────────
const totalChanges = cpChanges.length + amfeChanges.length;
console.log(`\n=== RESUMEN: ${totalChanges} cambios totales (CP: ${cpChanges.length}, AMFE: ${amfeChanges.length}) ===`);

if (totalChanges === 0) {
  console.log('\nNo se encontraron terminos en ingles. Nada que corregir.');
  process.exit(0);
}

if (!APPLY) {
  console.log('\n*** DRY RUN — usar --apply para escribir en Supabase ***');
  process.exit(0);
}

// ── APPLY MODE ──────────────────────────────────────────────────────────────
console.log('\n=== APLICANDO CAMBIOS ===\n');

// Backup before writing
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = new URL(`../backups/fix-english-${ts}/`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
mkdirSync(backupDir, { recursive: true });
writeFileSync(`${backupDir}/cp_before.json`, JSON.stringify(cpParsed, null, 2));
writeFileSync(`${backupDir}/amfe_before.json`, JSON.stringify(amfeParsed, null, 2));
console.log(`  Backup guardado en: ${backupDir}`);

// Write CP
if (cpChanges.length > 0) {
  const cpToWrite = typeof cpRow.data === 'string' ? JSON.stringify(cpFixed) : cpFixed;
  const { error: cpWriteErr } = await sb
    .from('cp_documents')
    .update({ data: cpToWrite, updated_at: new Date().toISOString() })
    .eq('id', CP_DOC_ID);
  if (cpWriteErr) { console.error('ERROR writing CP:', cpWriteErr.message); process.exit(1); }
  console.log('  CP Maestro actualizado OK');
}

// Write AMFE
if (amfeChanges.length > 0) {
  const amfeToWrite = typeof amfeRow.data === 'string' ? JSON.stringify(amfeFixed) : amfeFixed;
  const { error: amfeWriteErr } = await sb
    .from('amfe_documents')
    .update({ data: amfeToWrite, updated_at: new Date().toISOString() })
    .eq('id', AMFE_DOC_ID);
  if (amfeWriteErr) { console.error('ERROR writing AMFE:', amfeWriteErr.message); process.exit(1); }
  console.log('  AMFE Maestro actualizado OK');
}

// ── POST-WRITE VERIFICATION ─────────────────────────────────────────────────
console.log('\n=== VERIFICACION POST-ESCRITURA ===\n');

// Re-read and check for remaining English terms
const { data: cpVerify } = await sb.from('cp_documents').select('data').eq('id', CP_DOC_ID).single();
const cpVerifyStr = typeof cpVerify.data === 'string' ? cpVerify.data : JSON.stringify(cpVerify.data);
const gaugeRemaining = (cpVerifyStr.match(/gauge/gi) || []).length;
const patternBoardRemaining = (cpVerifyStr.match(/pattern board/gi) || []).length;
const pelletVirgenRemaining = (cpVerifyStr.match(/Pellet virgen/g) || []).length;
const pelletTodosRemaining = (cpVerifyStr.match(/todos los tipos/g) || []).length;

console.log(`  CP - "gauge" restantes: ${gaugeRemaining}`);
console.log(`  CP - "pattern board" restantes: ${patternBoardRemaining}`);
console.log(`  CP - "Pellet virgen" restantes: ${pelletVirgenRemaining}`);
console.log(`  CP - "todos los tipos" restantes: ${pelletTodosRemaining}`);

const { data: amfeVerify } = await sb.from('amfe_documents').select('data').eq('id', AMFE_DOC_ID).single();
const amfeVerifyStr = typeof amfeVerify.data === 'string' ? amfeVerify.data : JSON.stringify(amfeVerify.data);
const amfePatternRemaining = (amfeVerifyStr.match(/pattern board/gi) || []).length;
console.log(`  AMFE - "pattern board" restantes: ${amfePatternRemaining}`);

// Verify data structure integrity
const cpVerifyParsed = typeof cpVerify.data === 'string' ? JSON.parse(cpVerify.data) : cpVerify.data;
const amfeVerifyParsed = typeof amfeVerify.data === 'string' ? JSON.parse(amfeVerify.data) : amfeVerify.data;
console.log(`\n  CP items post-fix: ${cpVerifyParsed.items.length} (esperado: ${cpParsed.items.length})`);
console.log(`  AMFE ops post-fix: ${amfeVerifyParsed.operations.length} (esperado: ${amfeParsed.operations.length})`);

const allClean = gaugeRemaining === 0 && patternBoardRemaining === 0 && pelletVirgenRemaining === 0 && pelletTodosRemaining === 0 && amfePatternRemaining === 0;
console.log(`\n  ${allClean ? 'VERIFICACION OK — todos los terminos corregidos' : 'ATENCION — quedan terminos por corregir'}`);

// Save after state
writeFileSync(`${backupDir}/cp_after.json`, JSON.stringify(cpVerifyParsed, null, 2));
writeFileSync(`${backupDir}/amfe_after.json`, JSON.stringify(amfeVerifyParsed, null, 2));
console.log(`  Estado post-fix guardado en: ${backupDir}`);
