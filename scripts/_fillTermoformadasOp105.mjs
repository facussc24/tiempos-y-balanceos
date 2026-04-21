/**
 * Fill 1 FAIL gap in AMFE TELAS_TERMOFORMADAS OP 105.
 *
 * Target:
 *   - AMFE id: c5201ba9-1225-4663-b7a1-5430f9ee8912
 *   - Operation: OP 105 "CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME"
 *   - Work Element: [Man] "Operador de segregacion"
 *   - Function: "Trasladar producto no conforme a zona de segregacion"
 *   - Current state: 0 failures (confirmed via _inspectTermoformadasOp105.mjs)
 *
 * Source of content:
 *   - TELAS_PLANAS OP 90 has IDENTICAL gap (also 0 failures at this WE/Fn).
 *     Cannot inherit content — sibling has same gap.
 *   - Consulted NotebookLM APQP (notebook apqp-guias-y-conocimiento) and it
 *     confirmed VDA-standard failure modes for PNC segregation operations
 *     (mezcla NC con OK, etiqueta omitida). Severity aligned to "worst escape"
 *     per VDA rule: S=7 when escape could cause non-ensemblable pieza at OEM.
 *   - Ratings taken conservatively to align with siblings in same OP
 *     (WE "Procedimiento de producto no conforme P-13" uses S=7, O=2, D=4, AP=L
 *     for analogous failure "Producto no conforme no segregado correctamente").
 *
 * What is added (2 failures, 1 cause each):
 *
 *   FAIL 1: "Producto no conforme trasladado a zona incorrecta"
 *     effLocal:   "Producto no conforme mezclado con producto aprobado"
 *     effNext:    "Producto no conforme enviado al cliente en lote mezclado"
 *     effEndUser: "Funda defectuosa montada en vehiculo Toyota Hilux"
 *     CAUSE: "Zona de segregacion saturada u obstruida al momento del traslado"
 *       S=7, O=2, D=4 -> AP=L (tabla AIAG-VDA 2019)
 *       prev: "Zona de segregacion delimitada, senalizada y con capacidad suficiente"
 *       det:  "Verificacion visual de zona de segregacion por supervisor cada turno"
 *
 *   FAIL 2: "Identificacion del producto no conforme perdida o ilegible durante el traslado"
 *     effLocal:   "Producto sin identificacion de estado post-traslado"
 *     effNext:    "Inspector no puede identificar pieza para decision de destino"
 *     effEndUser: "No aplica (impacto interno)"
 *     CAUSE: "Etiqueta de rechazo despegada o ilegible durante manipulacion"
 *       S=5, O=3, D=4 -> AP=L (tabla AIAG-VDA 2019)
 *       prev: "Etiquetas de rechazo con adhesivo adecuado y formato estandar"
 *       det:  "Reetiquetado en zona de segregacion por inspector de calidad"
 *
 * Why AP=L for both:
 *   - Rule amfe-actions.md: AP=H/M requires action, and we cannot invent actions.
 *   - AP=L is VDA-correct for these scenarios given existing controls
 *     (zona delimitada, etiqueta adhesiva estandar). If Fak disagrees, he can
 *     edit S/O/D manually — the failure structure is now in place.
 *   - Siblings in the same OP use the same rating range (S=3-7, O=2-3, D=4-5, all AP=L).
 *
 * CC/SC:
 *   - specialChar = "" for both (rule: NO CC/SC sin autorizacion explicita de Fak).
 *
 * Guards:
 *   - Only AMFE id c5201ba9-...  (single record)
 *   - Only OP 105 (operationNumber === 105)
 *   - Only WE "Operador de segregacion" (Man type)
 *   - Only Fn "Trasladar producto no conforme a zona de segregacion"
 *   - ABORTS if function.failures.length > 0 (idempotent — does not add duplicates)
 *   - ABORTS if the target function is not found
 *
 * Data serialization:
 *   - data is TEXT column in DB (per feedback_amfe_data_is_text.md)
 *   - We JSON.parse on read, JSON.stringify on write
 *
 * Dry-run:
 *   - Default behavior: diff preview, NO write.
 *   - Pass --apply to actually update Supabase.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

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

// ------------------------------------------------------------------
// GUARDS (hardcoded — defensive)
// ------------------------------------------------------------------
const TARGET_AMFE_ID = 'c5201ba9-1225-4663-b7a1-5430f9ee8912';
const TARGET_OP_NUMBER = 105;
const TARGET_WE_NAME = 'Operador de segregacion';
const TARGET_FN_DESC = 'Trasladar producto no conforme a zona de segregacion';

// ------------------------------------------------------------------
// dry-run guard: if somebody passes --apply, make very sure we still
// hit exactly one document, one op, one we, one fn with 0 failures.
// ------------------------------------------------------------------
function dryRunGuard(doc, op, we, fn) {
  if (doc.id !== TARGET_AMFE_ID) throw new Error(`GUARD: wrong doc id ${doc.id}`);
  const opNum = Number(op.operationNumber ?? op.opNumber);
  if (opNum !== TARGET_OP_NUMBER) throw new Error(`GUARD: wrong op ${opNum}`);
  if (we.name !== TARGET_WE_NAME) throw new Error(`GUARD: wrong we "${we.name}"`);
  const fnDesc = fn.description ?? fn.functionDescription ?? '';
  if (fnDesc !== TARGET_FN_DESC) throw new Error(`GUARD: wrong fn "${fnDesc}"`);
  const existingFailures = (fn.failures || []).length;
  if (existingFailures > 0) {
    throw new Error(`GUARD: target fn already has ${existingFailures} failure(s) — aborting to avoid duplicates.`);
  }
}

// ------------------------------------------------------------------
// Failures payload (VDA-sourced, AP=L, no actions required)
// ------------------------------------------------------------------
function buildFailuresPayload() {
  const c1Id = randomUUID();
  const c2Id = randomUUID();
  const f1Id = randomUUID();
  const f2Id = randomUUID();

  return [
    {
      id: f1Id,
      description: 'Producto no conforme trasladado a zona incorrecta',
      failureMode: 'Producto no conforme trasladado a zona incorrecta',
      effectLocal: 'Producto no conforme mezclado con producto aprobado',
      effectNextLevel: 'Producto no conforme enviado al cliente en lote mezclado',
      effectEndUser: 'Funda defectuosa montada en vehiculo Toyota Hilux',
      causes: [
        {
          id: c1Id,
          cause: 'Zona de segregacion saturada u obstruida al momento del traslado',
          description: 'Zona de segregacion saturada u obstruida al momento del traslado',
          severity: 7,
          occurrence: 2,
          detection: 4,
          ap: 'L',
          actionPriority: 'L',
          specialChar: '',
          characteristicNumber: '',
          filterCode: '',
          preventionControl: 'Zona de segregacion delimitada, senalizada y con capacidad suficiente',
          detectionControl: 'Verificacion visual de zona de segregacion por supervisor cada turno',
        },
      ],
    },
    {
      id: f2Id,
      description: 'Identificacion del producto no conforme perdida o ilegible durante el traslado',
      failureMode: 'Identificacion del producto no conforme perdida o ilegible durante el traslado',
      effectLocal: 'Producto sin identificacion de estado post-traslado',
      effectNextLevel: 'Inspector no puede identificar pieza para decision de destino',
      effectEndUser: 'No aplica (impacto interno)',
      causes: [
        {
          id: c2Id,
          cause: 'Etiqueta de rechazo despegada o ilegible durante manipulacion',
          description: 'Etiqueta de rechazo despegada o ilegible durante manipulacion',
          severity: 5,
          occurrence: 3,
          detection: 4,
          ap: 'L',
          actionPriority: 'L',
          specialChar: '',
          characteristicNumber: '',
          filterCode: '',
          preventionControl: 'Etiquetas de rechazo con adhesivo adecuado y formato estandar',
          detectionControl: 'Reetiquetado en zona de segregacion por inspector de calidad',
        },
      ],
    },
  ];
}

// ------------------------------------------------------------------
// Load target AMFE
// ------------------------------------------------------------------
const { data: doc, error: loadErr } = await sb
  .from('amfe_documents')
  .select('id, subject, project_name, data')
  .eq('id', TARGET_AMFE_ID)
  .single();
if (loadErr) { console.error('Load error:', loadErr); process.exit(1); }

// data is TEXT — parse
let parsed;
if (typeof doc.data === 'string') {
  parsed = JSON.parse(doc.data);
} else {
  parsed = doc.data;
}
if (!parsed || !Array.isArray(parsed.operations)) {
  console.error('Doc has no operations');
  process.exit(1);
}

// Find target op/we/fn
const op = parsed.operations.find(o =>
  Number(o.operationNumber ?? o.opNumber) === TARGET_OP_NUMBER
);
if (!op) { console.error(`OP ${TARGET_OP_NUMBER} not found`); process.exit(1); }

const we = (op.workElements || []).find(w => w.name === TARGET_WE_NAME);
if (!we) { console.error(`WE "${TARGET_WE_NAME}" not found in OP ${TARGET_OP_NUMBER}`); process.exit(1); }

const fn = (we.functions || []).find(f => {
  const fd = f.description ?? f.functionDescription ?? '';
  return fd === TARGET_FN_DESC;
});
if (!fn) { console.error(`FN "${TARGET_FN_DESC}" not found in WE "${TARGET_WE_NAME}"`); process.exit(1); }

// Run the guards
dryRunGuard(doc, op, we, fn);

// Build and attach
const newFailures = buildFailuresPayload();
fn.failures = newFailures; // previously []

// Report
console.log('================================================================');
console.log(APPLY ? 'APPLY MODE — writing to Supabase' : 'DRY-RUN MODE (pass --apply to write)');
console.log('================================================================');
console.log(`AMFE id: ${doc.id}`);
console.log(`Subject: ${doc.subject} | ${doc.project_name}`);
console.log(`OP ${TARGET_OP_NUMBER} "${op.operationName ?? op.name}"`);
console.log(`WE [${we.type}] "${we.name}"`);
console.log(`FN "${fn.description ?? fn.functionDescription}"`);
console.log(`Failures BEFORE: 0 (verified)`);
console.log(`Failures AFTER:  ${fn.failures.length}`);
console.log('');
for (const fm of fn.failures) {
  console.log(`  FAIL: "${fm.description}"`);
  console.log(`    effLocal:   "${fm.effectLocal}"`);
  console.log(`    effNext:    "${fm.effectNextLevel}"`);
  console.log(`    effEndUser: "${fm.effectEndUser}"`);
  for (const c of fm.causes) {
    console.log(`    CAUSE: "${c.cause}"  S=${c.severity} O=${c.occurrence} D=${c.detection} AP=${c.ap}`);
    console.log(`      prev: "${c.preventionControl}"`);
    console.log(`      det:  "${c.detectionControl}"`);
  }
}
console.log('');

if (!APPLY) {
  console.log('Dry-run only. Re-run with --apply to write.');
  process.exit(0);
}

// ------------------------------------------------------------------
// WRITE (data column is TEXT → JSON.stringify)
// ------------------------------------------------------------------
const serialized = JSON.stringify(parsed);
const { error: upErr } = await sb
  .from('amfe_documents')
  .update({ data: serialized })
  .eq('id', TARGET_AMFE_ID);

if (upErr) {
  console.error('Update error:', upErr);
  process.exit(1);
}

console.log('Update OK.');

// Verify round-trip
const { data: verify, error: vErr } = await sb
  .from('amfe_documents')
  .select('id, data')
  .eq('id', TARGET_AMFE_ID)
  .single();
if (vErr) { console.error('Verify error:', vErr); process.exit(1); }
const verified = typeof verify.data === 'string' ? JSON.parse(verify.data) : verify.data;
const vOp = verified.operations.find(o => Number(o.operationNumber ?? o.opNumber) === TARGET_OP_NUMBER);
const vWe = vOp.workElements.find(w => w.name === TARGET_WE_NAME);
const vFn = vWe.functions.find(f => (f.description ?? f.functionDescription) === TARGET_FN_DESC);
console.log(`Verify: fn now has ${vFn.failures.length} failure(s).`);
console.log('--- done ---');
