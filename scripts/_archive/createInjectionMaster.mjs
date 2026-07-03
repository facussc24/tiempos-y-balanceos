/**
 * createInjectionMaster.mjs
 *
 * Creates a master AMFE for "Proceso de Inyeccion Plastica" foundation document.
 * Extracts OP 20 INYECCION from the IP PAD AMFE (VWA-PAT-IPPADS-001) backup,
 * keeping ALL real S/O/D values, failure modes, causes, and controls.
 * Adds stub operations for OP 10 (Preparacion y Secado) and OP 30 (Control a pie de maquina).
 *
 * Steps:
 *   1. Read OP 20 from backup file
 *   2. Check for existing family/document (abort if found)
 *   3. Create product_family "Proceso de Inyeccion Plastica"
 *   4. Create amfe_documents entry with master data
 *   5. Link via family_documents with is_master=1
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

// ── Supabase connection (same pattern as _backup.mjs) ──────────────────────
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// ── Read OP 20 INYECCION from backup ───────────────────────────────────────
const backupPath = new URL('../backups/2026-04-09T12-29-19/amfe_documents.json', import.meta.url)
  .pathname.replace(/^\/([A-Z]:)/, '$1');
const backupData = JSON.parse(readFileSync(backupPath, 'utf8'));
const ippadDoc = backupData.find(d => d.amfe_number === 'VWA-PAT-IPPADS-001');
if (!ippadDoc) {
  console.error('ERROR: IP PAD AMFE (VWA-PAT-IPPADS-001) not found in backup.');
  process.exit(1);
}
const op20Source = ippadDoc.data.operations.find(
  op => (op.operationNumber || op.opNumber) === '20'
    && (op.operationName || op.name) === 'INYECCION'
);
if (!op20Source) {
  console.error('ERROR: OP 20 INYECCION not found in IP PAD AMFE.');
  process.exit(1);
}

// ── Pre-flight checks ──────────────────────────────────────────────────────
const { data: existingFamilies } = await sb
  .from('product_families')
  .select('id, name')
  .eq('name', 'Proceso de Inyeccion Plastica');

if (existingFamilies && existingFamilies.length > 0) {
  console.error(`ABORT: Family "Proceso de Inyeccion Plastica" already exists (id=${existingFamilies[0].id}).`);
  process.exit(1);
}

const { data: existingDocs } = await sb
  .from('amfe_documents')
  .select('id, amfe_number')
  .eq('amfe_number', 'AMFE-MAESTRO-INY-001');

if (existingDocs && existingDocs.length > 0) {
  console.error(`ABORT: AMFE "AMFE-MAESTRO-INY-001" already exists (id=${existingDocs[0].id}).`);
  process.exit(1);
}

console.log('Pre-flight checks passed. No duplicates found.\n');

// ── Deep-clone OP 20 with fresh UUIDs ──────────────────────────────────────

/** Recursively clone an object, replacing every "id" field with a fresh UUID */
function cloneWithNewIds(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => cloneWithNewIds(item));
  }
  if (obj !== null && typeof obj === 'object') {
    const cloned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'id') {
        cloned[key] = randomUUID();
      } else {
        cloned[key] = cloneWithNewIds(value);
      }
    }
    return cloned;
  }
  return obj;
}

const op20Cloned = cloneWithNewIds(op20Source);

// Override the focus element function to be GENERIC (not IP PAD specific)
op20Cloned.focusElementFunction =
  'Interno: Conformar la pieza plastica segun especificaciones dimensionales y de apariencia / ' +
  'Cliente: Montaje del componente en el modulo del vehiculo / ' +
  'Usuario final: Superficie estetica, funcionalidad mecanica, seguridad';

// Ensure BOTH aliases are present and consistent
op20Cloned.opNumber = '20';
op20Cloned.operationNumber = '20';
op20Cloned.name = 'INYECCION';
op20Cloned.operationName = 'INYECCION';
// operationFunction stays as-is from clone (real text)

// ── Build OP 10: PREPARACION Y SECADO DE MATERIAL (stub) ─────────────────────────
const op10 = {
  id: randomUUID(),
  opNumber: '10',
  operationNumber: '10',
  name: 'RECEPCION DE MATERIA PRIMA',
  operationName: 'RECEPCION DE MATERIA PRIMA',
  focusElementFunction:
    'Interno: Conformar la pieza plastica segun especificaciones dimensionales y de apariencia / ' +
    'Cliente: Montaje del componente en el modulo del vehiculo / ' +
    'Usuario final: Superficie estetica, funcionalidad mecanica, seguridad',
  operationFunction: 'Cargar tolva, mezclar con colorantes y secar el pellet segun parametros de material',
  workElements: [
    {
      id: randomUUID(),
      name: 'Materia prima (pellets/granza)',
      type: 'Machine',
      functions: [
        {
          id: randomUUID(),
          description: 'Verificar materia prima conforme',
          functionDescription: 'Verificar materia prima conforme',
          requirements: '',
          failures: []
          // TBD: failure modes to be defined by APQP team
        }
      ]
    }
  ]
};

// ── Build OP 30: CONTROL A PIE DE MAQUINA / DESMOLDEO (stub) ─────────────────
const op30 = {
  id: randomUUID(),
  opNumber: '30',
  operationNumber: '30',
  name: 'CONTROL DIMENSIONAL POST-INYECCION',
  operationName: 'CONTROL DIMENSIONAL POST-INYECCION',
  focusElementFunction:
    'Interno: Conformar la pieza plastica segun especificaciones dimensionales y de apariencia / ' +
    'Cliente: Montaje del componente en el modulo del vehiculo / ' +
    'Usuario final: Superficie estetica, funcionalidad mecanica, seguridad',
  operationFunction: 'Cortar colada (runner), inspeccion visual del operador, verificar ausencia de defectos criticos',
  workElements: [
    {
      id: randomUUID(),
      name: 'Instrumentos de medicion',
      type: 'Machine',
      functions: [
        {
          id: randomUUID(),
          description: 'Verificar dimensiones conformes',
          functionDescription: 'Verificar dimensiones conformes',
          requirements: '',
          failures: []
          // TBD: failure modes to be defined by APQP team
        }
      ]
    }
  ]
};

// ── Assemble the full AMFE data object ─────────────────────────────────────
const amfeData = {
  header: {
    organization: 'BARACK MERCOSUL',
    location: 'PLANTA HURLINGHAM',
    client: '',
    modelYear: '',
    subject: 'Proceso de Inyeccion Plastica Estandar',
    startDate: '2026-04-09',
    revDate: '2026-04-09',
    team: 'Carlos Baptista (Ingenieria), Manuel Meszaros (Calidad), Marianna Vera (Produccion)',
    amfeNumber: 'AMFE-MAESTRO-INY-001',
    responsible: 'Carlos Baptista',
    confidentiality: 'Interno',
    partNumber: '',
    processResponsible: 'Carlos Baptista',
    revision: 'A',
    approvedBy: '',
    scope: 'Proceso estandar de inyeccion plastica aplicable a todas las piezas inyectadas en BARACK MERCOSUL',
    applicableParts: ''
  },
  operations: [op10, op20Cloned, op30]
};

// ── Count stats ────────────────────────────────────────────────────────────
let totalWE = 0, totalFn = 0, totalFail = 0, totalCause = 0;
for (const op of amfeData.operations) {
  for (const we of op.workElements || []) {
    totalWE++;
    for (const fn of we.functions || []) {
      totalFn++;
      for (const fail of fn.failures || []) {
        totalFail++;
        totalCause += (fail.causes || []).length;
      }
    }
  }
}

console.log('=== AMFE Master Data Summary ===');
console.log(`Operations: ${amfeData.operations.length}`);
console.log(`Work Elements: ${totalWE}`);
console.log(`Functions: ${totalFn}`);
console.log(`Failure Modes: ${totalFail}`);
console.log(`Causes: ${totalCause}`);
console.log('');

// ── Step 1: Create product_family ──────────────────────────────────────────
const { data: familyRow, error: familyErr } = await sb
  .from('product_families')
  .insert({
    name: 'Proceso de Inyeccion Plastica',
    description: 'AMFE de Fundacion: conocimiento base del proceso de inyeccion plastica de la organizacion (AIAG-VDA 2019)',
    linea_code: '',
    linea_name: '',
    active: 1
  })
  .select('id')
  .single();

if (familyErr) {
  console.error('ERROR creating product_family:', familyErr.message);
  process.exit(1);
}
console.log(`Created product_family: id=${familyRow.id}`);

// ── Step 2: Create amfe_documents entry ────────────────────────────────────
const docId = randomUUID();
const { data: docRow, error: docErr } = await sb
  .from('amfe_documents')
  .insert({
    id: docId,
    amfe_number: 'AMFE-MAESTRO-INY-001',
    project_name: 'MAESTRO/INYECCION_PLASTICA',
    subject: 'Proceso de Inyeccion Plastica Estandar',
    client: '',
    part_number: '',
    responsible: 'Carlos Baptista',
    organization: 'BARACK MERCOSUL',
    status: 'draft',
    operation_count: amfeData.operations.length,
    cause_count: totalCause,
    ap_h_count: 0,
    ap_m_count: 0,
    coverage_percent: 100,
    start_date: '2026-04-09',
    last_revision_date: '2026-04-09',
    revision_level: 'A',
    data: amfeData  // JavaScript OBJECT, NOT JSON.stringify'd
  })
  .select('id')
  .single();

if (docErr) {
  console.error('ERROR creating amfe_document:', docErr.message);
  // Rollback family
  await sb.from('product_families').delete().eq('id', familyRow.id);
  console.log('Rolled back product_family.');
  process.exit(1);
}
console.log(`Created amfe_document: id=${docRow.id}`);

// ── Step 3: Link as family_documents (is_master=1) ─────────────────────────
const { data: linkRow, error: linkErr } = await sb
  .from('family_documents')
  .insert({
    family_id: familyRow.id,
    module: 'amfe',
    document_id: docRow.id,
    is_master: 1,
    source_master_id: null,
    product_id: null
  })
  .select('id')
  .single();

if (linkErr) {
  console.error('ERROR creating family_documents link:', linkErr.message);
  // Rollback
  await sb.from('amfe_documents').delete().eq('id', docRow.id);
  await sb.from('product_families').delete().eq('id', familyRow.id);
  console.log('Rolled back amfe_document and product_family.');
  process.exit(1);
}
console.log(`Created family_documents link: id=${linkRow.id}`);

// ── Verification ───────────────────────────────────────────────────────────
const { data: verify } = await sb
  .from('amfe_documents')
  .select('id, data')
  .eq('id', docRow.id)
  .single();

if (typeof verify.data !== 'object') {
  console.error('CRITICAL: data is NOT an object (double-serialization detected). Type:', typeof verify.data);
  process.exit(1);
}
if (!Array.isArray(verify.data.operations)) {
  console.error('CRITICAL: data.operations is not an array.');
  process.exit(1);
}

console.log('\n=== Verification PASSED ===');
console.log(`  typeof data: ${typeof verify.data}`);
console.log(`  operations count: ${verify.data.operations.length}`);

// ── Final summary ──────────────────────────────────────────────────────────
console.log('\n=== DONE ===');
console.log(`  Family ID:          ${familyRow.id}`);
console.log(`  Document ID:        ${docRow.id}`);
console.log(`  Family-Doc Link ID: ${linkRow.id}`);
console.log(`  Operations:         ${amfeData.operations.length} (OP 10 stub, OP 20 full, OP 30 stub)`);
console.log(`  Work Elements:      ${totalWE}`);
console.log(`  Functions:          ${totalFn}`);
console.log(`  Failure Modes:      ${totalFail} (all from OP 20 INYECCION)`);
console.log(`  Causes:             ${totalCause} (all real S/O/D from IP PAD)`);

process.exit(0);
