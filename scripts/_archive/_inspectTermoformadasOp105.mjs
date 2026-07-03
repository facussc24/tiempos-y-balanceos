/**
 * READ-ONLY inspection: OP 105 of AMFE TELAS_TERMOFORMADAS (id c5201ba9-...)
 *
 * Goal: dump the entire OP 105 "CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME"
 * tree: Work Elements > Functions > Failures > Causes.
 *
 * Also dump OP 90 from AMFE TELAS_PLANAS (id 57011560-...) for comparison,
 * since it's the sibling operation with WE "Operador de segregacion".
 *
 * NO WRITES. NO --apply. NO mutations.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const parseData = (raw) => {
  if (raw == null) return null;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return null; } }
  return (typeof raw === 'object') ? raw : null;
};

const norm = (s) => typeof s === 'string'
  ? s.toUpperCase().trim().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  : '';

const TERMO_ID = 'c5201ba9-1225-4663-b7a1-5430f9ee8912';
const PLANAS_ID = '57011560-d4c1-4a8a-83f0-ed37a2bab1d5';

async function loadAmfe(id) {
  const { data, error } = await sb
    .from('amfe_documents')
    .select('id, subject, project_name, data')
    .eq('id', id)
    .single();
  if (error) { console.error(error); return null; }
  return data;
}

function findOpByNumber(doc, opNum) {
  const d = parseData(doc.data);
  if (!d || !Array.isArray(d.operations)) return null;
  return d.operations.find(op =>
    String(op.operationNumber ?? op.opNumber ?? '') === String(opNum)
  );
}

function findOpBySegregationName(doc) {
  const d = parseData(doc.data);
  if (!d || !Array.isArray(d.operations)) return null;
  return d.operations.find(op => {
    const name = norm(op.operationName ?? op.name ?? '');
    return name.includes('SEGREGACION') || name.includes('NO CONFORME');
  });
}

function dumpOperation(label, op) {
  console.log('================================================================');
  console.log(label);
  console.log('================================================================');
  if (!op) {
    console.log('  (no matching op)');
    return;
  }
  const opNum = op.operationNumber ?? op.opNumber ?? '?';
  const opName = op.operationName ?? op.name ?? '';
  console.log(`OP ${opNum}: "${opName}"`);
  console.log(`focusElementFunction: "${op.focusElementFunction ?? ''}"`);
  console.log(`operationFunction:    "${op.operationFunction ?? ''}"`);
  const wes = op.workElements || [];
  console.log(`workElements: ${wes.length}`);
  for (const we of wes) {
    console.log(`\n  WE [${we.type}] "${we.name}"`);
    const fns = we.functions || [];
    console.log(`    functions: ${fns.length}`);
    for (const fn of fns) {
      const fnDesc = fn.description ?? fn.functionDescription ?? '';
      const failures = fn.failures || [];
      console.log(`    FN: "${fnDesc}"  (failures: ${failures.length})`);
      for (const fm of failures) {
        const fmDesc = fm.description ?? fm.failureMode ?? '';
        const effLocal = fm.effectLocal ?? '';
        const effNext = fm.effectNextLevel ?? '';
        const effEnd = fm.effectEndUser ?? '';
        const causes = fm.causes || [];
        console.log(`      FAIL: "${fmDesc}"`);
        console.log(`        effLocal:   "${effLocal}"`);
        console.log(`        effNext:    "${effNext}"`);
        console.log(`        effEndUser: "${effEnd}"`);
        console.log(`        causes: ${causes.length}`);
        for (const c of causes) {
          const cTxt = c.cause ?? c.description ?? '';
          const S = c.severity ?? '?', O = c.occurrence ?? '?', D = c.detection ?? '?';
          const AP = c.ap ?? c.actionPriority ?? '?';
          const pv = c.preventionControl ?? '';
          const dt = c.detectionControl ?? '';
          console.log(`          · "${cTxt}"  S=${S} O=${O} D=${D} AP=${AP}`);
          console.log(`             prev: "${(pv || '').slice(0, 120)}"`);
          console.log(`             det:  "${(dt || '').slice(0, 120)}"`);
        }
      }
    }
  }
}

// ------------------------------------------------------------------
// TERMOFORMADAS OP 105
// ------------------------------------------------------------------
const termo = await loadAmfe(TERMO_ID);
if (!termo) { console.error('TERMOFORMADAS not found'); process.exit(1); }
console.log(`\nTERMOFORMADAS: ${termo.subject} | ${termo.project_name}\n`);
const opTermo = findOpByNumber(termo, 105) || findOpBySegregationName(termo);
dumpOperation('TELAS_TERMOFORMADAS — OP 105 (segregacion)', opTermo);

// ------------------------------------------------------------------
// TELAS_PLANAS OP 90 (comparison)
// ------------------------------------------------------------------
const planas = await loadAmfe(PLANAS_ID);
if (!planas) { console.error('TELAS_PLANAS not found'); process.exit(1); }
console.log(`\n\nTELAS_PLANAS: ${planas.subject} | ${planas.project_name}\n`);
const opPlanas = findOpByNumber(planas, 90) || findOpBySegregationName(planas);
dumpOperation('TELAS_PLANAS — OP 90 (segregacion, comparison)', opPlanas);

console.log('\n--- done ---');
