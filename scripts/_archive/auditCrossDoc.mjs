/**
 * Cross-Document Audit — CP, HO, PFD
 * Connects to Supabase and checks for data quality issues.
 *
 * CP checks:
 *   - CC/SC items with empty reactionPlanOwner
 *   - Items with both productCharacteristic AND processCharacteristic (B3 violation)
 *   - Generic specifications ("TBD", "Segun especificacion", empty)
 *
 * HO checks:
 *   - preparedBy, approvedBy, sector empty/undefined
 *   - reactionContact missing when reactionPlanText exists
 *
 * PFD checks:
 *   - steps array missing or empty
 *   - step names violating standard naming conventions
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ── Connect to Supabase ──────────────────────────────────────────────
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({
  email: env.VITE_AUTO_LOGIN_EMAIL,
  password: env.VITE_AUTO_LOGIN_PASSWORD,
});

// ── Helpers ──────────────────────────────────────────────────────────
const SEVERITY = { blocker: 'BLOCKER', warning: 'WARNING' };

function isEmpty(val) {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string' && val.trim() === '') return true;
  return false;
}

function isGenericSpec(spec) {
  if (isEmpty(spec)) return true;
  const lower = (spec || '').toLowerCase().trim();
  const generics = [
    'tbd',
    'segun especificacion',
    'según especificación',
    'conforme a especificacion',
    'conforme a especificación',
    'a definir',
    'por definir',
    'n/a',
    'na',
    '-',
    '.',
    'ver amfe',
  ];
  return generics.includes(lower);
}

// Standard PFD step name patterns (from .claude/rules/pfd.md)
const STANDARD_STEP_NAMES = [
  'RECEPCION DE MATERIA PRIMA',
  'ALMACENAMIENTO',
  'TRASLADO',
  'CONTROL FINAL DE CALIDAD',
  'EMBALAJE',
  'PRODUCTO CONFORME',
  'MATERIAL CONFORME',
  'CLASIFICACION Y SEGREGACION',
];

function checkStepNameConvention(name) {
  if (isEmpty(name)) return 'Step name is empty';
  const upper = name.toUpperCase().trim();

  // Check for English names (should be Spanish)
  const englishPatterns = [
    /\bEDGE FOLDING\b/i,
    /\bTRIMMING\b/i,
    /\bSEWING\b/i,
    /\bCUTTING\b/i,
    /\bINSPECTION\b/i,
    /\bPACKAGING\b/i,
    /\bSTORAGE\b/i,
    /\bTRANSPORT\b/i,
    /\bASSEMBLY\b/i,
    /\bWELDING\b/i,
    /\bINJECTION\b/i,
    /\bRECEIVING\b/i,
  ];
  for (const pat of englishPatterns) {
    if (pat.test(upper)) return `English term found: "${name}"`;
  }

  // Check for "RECEPCIONAR" variant (should be "RECEPCION DE MATERIA PRIMA")
  if (/RECEPCIONAR/.test(upper)) return `Use "RECEPCION DE MATERIA PRIMA" instead of "${name}"`;

  // Check for "INSPECCION FINAL" variant (should be "CONTROL FINAL DE CALIDAD")
  if (/INSPECCION FINAL/.test(upper)) return `Use "CONTROL FINAL DE CALIDAD" instead of "${name}"`;

  // Check for placeholders / garbage
  if (/^\$\d/.test(name) || /^\d+$/.test(name.trim()))
    return `Placeholder/garbage step name: "${name}"`;

  return null; // OK
}

// ── Fetch data ───────────────────────────────────────────────────────
console.log('Fetching documents from Supabase...\n');

const [cpRes, hoRes, pfdRes] = await Promise.all([
  sb.from('cp_documents').select('*'),
  sb.from('ho_documents').select('*'),
  sb.from('pfd_documents').select('*'),
]);

if (cpRes.error) console.error('CP fetch error:', cpRes.error.message);
if (hoRes.error) console.error('HO fetch error:', hoRes.error.message);
if (pfdRes.error) console.error('PFD fetch error:', pfdRes.error.message);

const cpDocs = (cpRes.data || []).map(d => ({
  ...d,
  data: typeof d.data === 'string' ? JSON.parse(d.data) : d.data,
}));
const hoDocs = (hoRes.data || []).map(d => ({
  ...d,
  data: typeof d.data === 'string' ? JSON.parse(d.data) : d.data,
}));
const pfdDocs = (pfdRes.data || []).map(d => ({
  ...d,
  data: typeof d.data === 'string' ? JSON.parse(d.data) : d.data,
}));

// ── CP AUDIT ─────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════');
console.log('  CP DOCUMENTS AUDIT');
console.log('═══════════════════════════════════════════════════════════');

const cpIssues = [];

for (const doc of cpDocs) {
  const docName = doc.data?.header?.partName || doc.name || doc.id;
  const items = doc.data?.items || [];

  if (!Array.isArray(items) || items.length === 0) {
    cpIssues.push({
      doc: docName,
      docId: doc.id,
      severity: SEVERITY.blocker,
      rule: 'ITEMS_MISSING',
      detail: 'CP document has no items array or items is empty',
    });
    continue;
  }

  for (const item of items) {
    const itemLabel = `OP ${item.processStepNumber || '?'} - "${(item.characteristic || item.productCharacteristic || item.processCharacteristic || '').substring(0, 50)}"`;

    // Check 1: CC/SC items with empty reactionPlanOwner
    if (
      (item.classification === 'CC' || item.classification === 'SC') &&
      isEmpty(item.reactionPlanOwner)
    ) {
      cpIssues.push({
        doc: docName,
        docId: doc.id,
        severity: SEVERITY.blocker,
        rule: 'CC_SC_NO_REACTION_OWNER',
        detail: `${item.classification} item missing reactionPlanOwner: ${itemLabel}`,
      });
    }

    // Check 2: Both productCharacteristic AND processCharacteristic filled (B3)
    if (!isEmpty(item.productCharacteristic) && !isEmpty(item.processCharacteristic)) {
      cpIssues.push({
        doc: docName,
        docId: doc.id,
        severity: SEVERITY.blocker,
        rule: 'B3_BOTH_CHARS',
        detail: `Both product AND process characteristic filled: ${itemLabel}`,
      });
    }

    // Check 3: Generic specifications
    if (isGenericSpec(item.specification)) {
      cpIssues.push({
        doc: docName,
        docId: doc.id,
        severity: SEVERITY.warning,
        rule: 'GENERIC_SPEC',
        detail: `Generic/empty specification "${item.specification || '(empty)'}": ${itemLabel}`,
      });
    }
  }
}

const cpBlockers = cpIssues.filter(i => i.severity === SEVERITY.blocker);
const cpWarnings = cpIssues.filter(i => i.severity === SEVERITY.warning);

console.log(`\n  Total CP docs: ${cpDocs.length}`);
console.log(`  Total items across all CPs: ${cpDocs.reduce((sum, d) => sum + (d.data?.items?.length || 0), 0)}`);
console.log(`  Issues found: ${cpIssues.length} (${cpBlockers.length} blockers, ${cpWarnings.length} warnings)`);

if (cpIssues.length > 0) {
  console.log('\n  ── CP Issues Detail ──');
  for (const issue of cpIssues) {
    const icon = issue.severity === SEVERITY.blocker ? 'X' : '!';
    console.log(`  [${icon}] [${issue.severity}] [${issue.rule}] ${issue.doc}`);
    console.log(`       ${issue.detail}`);
  }
}

// ── HO AUDIT ─────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════');
console.log('  HO DOCUMENTS AUDIT');
console.log('═══════════════════════════════════════════════════════════');

const hoIssues = [];

for (const doc of hoDocs) {
  const docName = doc.data?.header?.partDescription || doc.name || doc.id;
  const header = doc.data?.header || {};
  const sheets = doc.data?.sheets || [];

  // Check 1: preparedBy empty
  if (isEmpty(header.preparedBy)) {
    hoIssues.push({
      doc: docName,
      docId: doc.id,
      severity: SEVERITY.blocker,
      rule: 'HEADER_PREPARED_BY',
      detail: 'preparedBy is empty/undefined in header',
    });
  }

  // Check 2: approvedBy empty
  if (isEmpty(header.approvedBy)) {
    hoIssues.push({
      doc: docName,
      docId: doc.id,
      severity: SEVERITY.blocker,
      rule: 'HEADER_APPROVED_BY',
      detail: 'approvedBy is empty/undefined in header',
    });
  }

  // Check 3: sector empty (check both header.sector and sheet-level sector)
  if (isEmpty(header.sector)) {
    // Some HOs put sector in individual sheets rather than header
    const sheetsWithoutSector = sheets.filter(s => isEmpty(s.sector));
    if (sheetsWithoutSector.length === sheets.length) {
      hoIssues.push({
        doc: docName,
        docId: doc.id,
        severity: SEVERITY.warning,
        rule: 'HEADER_SECTOR',
        detail: 'sector is empty/undefined in header and all sheets',
      });
    }
  }

  // Check 4: reactionContact when reactionPlanText exists (check qcItems in sheets)
  for (const sheet of sheets) {
    const sheetLabel = `Sheet ${sheet.hoNumber || sheet.operationNumber || '?'}`;
    const qcItems = sheet.qcItems || [];
    for (const qc of qcItems) {
      // If reactionPlan exists but responsible is missing
      if (!isEmpty(qc.reactionPlan) && isEmpty(qc.responsible)) {
        hoIssues.push({
          doc: docName,
          docId: doc.id,
          severity: SEVERITY.blocker,
          rule: 'REACTION_NO_CONTACT',
          detail: `${sheetLabel}: qcItem has reactionPlan but no responsible — char: "${(qc.characteristic || '').substring(0, 40)}"`,
        });
      }
    }
  }
}

const hoBlockers = hoIssues.filter(i => i.severity === SEVERITY.blocker);
const hoWarnings = hoIssues.filter(i => i.severity === SEVERITY.warning);

console.log(`\n  Total HO docs: ${hoDocs.length}`);
console.log(`  Total sheets across all HOs: ${hoDocs.reduce((sum, d) => sum + (d.data?.sheets?.length || 0), 0)}`);
console.log(`  Issues found: ${hoIssues.length} (${hoBlockers.length} blockers, ${hoWarnings.length} warnings)`);

if (hoIssues.length > 0) {
  console.log('\n  ── HO Issues Detail ──');
  for (const issue of hoIssues) {
    const icon = issue.severity === SEVERITY.blocker ? 'X' : '!';
    console.log(`  [${icon}] [${issue.severity}] [${issue.rule}] ${issue.doc}`);
    console.log(`       ${issue.detail}`);
  }
}

// ── PFD AUDIT ────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════');
console.log('  PFD DOCUMENTS AUDIT');
console.log('═══════════════════════════════════════════════════════════');

const pfdIssues = [];

for (const doc of pfdDocs) {
  const docName = doc.data?.header?.partName || doc.name || doc.id;
  const steps = doc.data?.steps;

  // Check 1: steps array exists and has entries
  if (!Array.isArray(steps) || steps.length === 0) {
    pfdIssues.push({
      doc: docName,
      docId: doc.id,
      severity: SEVERITY.blocker,
      rule: 'STEPS_MISSING',
      detail: 'PFD document has no steps array or steps is empty',
    });
    continue;
  }

  // Check 2: step names match standard naming conventions
  for (const step of steps) {
    const problem = checkStepNameConvention(step.name);
    if (problem) {
      pfdIssues.push({
        doc: docName,
        docId: doc.id,
        severity: SEVERITY.warning,
        rule: 'STEP_NAME_CONVENTION',
        detail: `Step ${step.stepNumber || '?'}: ${problem}`,
      });
    }
  }
}

const pfdBlockers = pfdIssues.filter(i => i.severity === SEVERITY.blocker);
const pfdWarnings = pfdIssues.filter(i => i.severity === SEVERITY.warning);

console.log(`\n  Total PFD docs: ${pfdDocs.length}`);
console.log(`  Total steps across all PFDs: ${pfdDocs.reduce((sum, d) => sum + (Array.isArray(d.data?.steps) ? d.data.steps.length : 0), 0)}`);
console.log(`  Issues found: ${pfdIssues.length} (${pfdBlockers.length} blockers, ${pfdWarnings.length} warnings)`);

if (pfdIssues.length > 0) {
  console.log('\n  ── PFD Issues Detail ──');
  for (const issue of pfdIssues) {
    const icon = issue.severity === SEVERITY.blocker ? 'X' : '!';
    console.log(`  [${icon}] [${issue.severity}] [${issue.rule}] ${issue.doc}`);
    console.log(`       ${issue.detail}`);
  }
}

// ── SUMMARY ──────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════');
console.log('  AUDIT SUMMARY');
console.log('═══════════════════════════════════════════════════════════');

const totalBlockers = cpBlockers.length + hoBlockers.length + pfdBlockers.length;
const totalWarnings = cpWarnings.length + hoWarnings.length + pfdWarnings.length;
const totalIssues = totalBlockers + totalWarnings;

console.log(`
  +----------+------+----------+----------+--------+
  | DocType  | Docs | Blockers | Warnings | Total  |
  +----------+------+----------+----------+--------+
  | CP       | ${String(cpDocs.length).padStart(4)} | ${String(cpBlockers.length).padStart(8)} | ${String(cpWarnings.length).padStart(8)} | ${String(cpIssues.length).padStart(6)} |
  | HO       | ${String(hoDocs.length).padStart(4)} | ${String(hoBlockers.length).padStart(8)} | ${String(hoWarnings.length).padStart(8)} | ${String(hoIssues.length).padStart(6)} |
  | PFD      | ${String(pfdDocs.length).padStart(4)} | ${String(pfdBlockers.length).padStart(8)} | ${String(pfdWarnings.length).padStart(8)} | ${String(pfdIssues.length).padStart(6)} |
  +----------+------+----------+----------+--------+
  | TOTAL    | ${String(cpDocs.length + hoDocs.length + pfdDocs.length).padStart(4)} | ${String(totalBlockers).padStart(8)} | ${String(totalWarnings).padStart(8)} | ${String(totalIssues).padStart(6)} |
  +----------+------+----------+----------+--------+
`);

if (totalBlockers > 0) {
  console.log(`  ** ${totalBlockers} BLOCKER(S) require immediate attention. **\n`);
}
if (totalIssues === 0) {
  console.log('  All documents passed audit checks.\n');
}

process.exit(totalBlockers > 0 ? 1 : 0);
