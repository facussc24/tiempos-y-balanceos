/**
 * loadIpPadsPfd.mjs
 *
 * Carga el PFD (Diagrama de Flujo del Proceso) de TRIM ASM-UPR WRAPPING (IP PADs Patagonia).
 * Producto NUEVO — Cliente: VWA. Proyecto: PATAGONIA.
 *
 * Operaciones base extraidas del AMFE (OP 10 a OP 130, 13 operaciones).
 * Ademas agrega pasos intermedios: transportes, decisiones, segregacion.
 *
 * Usage:
 *   node scripts/loadIpPadsPfd.mjs           # dry-run (default)
 *   node scripts/loadIpPadsPfd.mjs --apply   # write to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

// ─── Config ─────────────────────────────────────────────────────────────────
const DRY_RUN = !process.argv.includes('--apply');
const ENV_PATH = 'C:/Users/FacundoS-PC/dev/BarackMercosul/.env.local';
const DOC_ID = 'pfd-ippads-trim-asm-upr-wrapping';

// ─── Supabase connection ────────────────────────────────────────────────────
const envText = readFileSync(ENV_PATH, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// ─── Helpers ────────────────────────────────────────────────────────────────
const uid = () => randomUUID();

function makeStep(stepNumber, stepType, description, opts = {}) {
  return {
    id: uid(),
    stepNumber,
    stepType,
    description,
    machineDeviceTool: opts.machineDeviceTool || '',
    productCharacteristic: opts.productCharacteristic || '',
    productSpecialChar: opts.productSpecialChar || 'none',
    processCharacteristic: opts.processCharacteristic || '',
    processSpecialChar: opts.processSpecialChar || 'none',
    reference: opts.reference || '',
    department: opts.department || 'Producción',
    notes: opts.notes || '',
    isRework: opts.isRework || false,
    isExternalProcess: opts.isExternalProcess || false,
    reworkReturnStep: opts.reworkReturnStep || '',
    rejectDisposition: opts.rejectDisposition || 'none',
    scrapDescription: opts.scrapDescription || '',
    branchId: opts.branchId || '',
    branchLabel: opts.branchLabel || '',
  };
}

// ─── PFD Header ─────────────────────────────────────────────────────────────
const header = {
  partNumber: '',
  partName: 'TRIM ASM-UPR WRAPPING',
  engineeringChangeLevel: '',
  modelYear: '2025',
  documentNumber: 'PFD-IPPADS-001',
  revisionLevel: 'A',
  revisionDate: '2025-03-25',
  processPhase: 'pre-launch',
  companyName: 'BARACK MERCOSUL',
  plantLocation: 'Hurlingham, Buenos Aires',
  supplierCode: '',
  customerName: 'VWA',
  coreTeam: 'Paulo Centurión (Ingeniería), Manuel Meszaros (Calidad), Leonardo Lattanzi (Producción)',
  keyContact: 'F. Santoro',
  preparedBy: 'F. Santoro',
  preparedDate: '2025-03-25',
  approvedBy: '',
  approvedDate: '',
  linkedAmfeProject: 'VWA/PATAGONIA/IP_PADS',
};

// ─── PFD Steps ──────────────────────────────────────────────────────────────
// Build steps: 13 AMFE operations + transport/decision/segregation intermediates

const steps = [
  // ── OP 10: RECEPCION ──
  makeStep('OP 10', 'storage', 'RECEPCION DE MATERIA PRIMA', {
    productCharacteristic: 'Certificado de calidad, estado del material',
    processCharacteristic: 'Condiciones de almacenamiento',
    rejectDisposition: 'scrap',
    scrapDescription: 'Material no conforme → Rechazo a proveedor',
  }),

  // Decision after reception
  makeStep('10a', 'decision', 'MATERIAL CONFORME?', {
    rejectDisposition: 'scrap',
    scrapDescription: 'NO → Reclamo de calidad al proveedor',
  }),

  // Segregation on NO
  makeStep('10b', 'operation', 'CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME', {
    rejectDisposition: 'scrap',
    scrapDescription: 'Segregar material rechazado',
    notes: 'Camino NO de decisión',
  }),

  // Transport to cutting sector
  makeStep('10c', 'transport', 'TRASLADO: MATERIA PRIMA A SECTOR DE CORTE', {}),

  // ── OP 20: CORTE DEL VINILO / TELA ──
  makeStep('OP 20', 'operation', 'CORTE DEL VINILO / TELA', {
    machineDeviceTool: 'BMA090 / BMA089',
    productCharacteristic: 'Dimensiones de corte',
    processCharacteristic: 'Set up de máquina de corte',
    rejectDisposition: 'scrap',
    scrapDescription: 'Pieza fuera de dimensión → Scrap',
  }),

  // ── OP 30: COSTURA UNION ──
  makeStep('OP 30', 'operation', 'COSTURA UNION', {
    machineDeviceTool: 'Máquina de coser',
    productCharacteristic: 'Resistencia y alineación de costura',
    processCharacteristic: 'Tensión de hilo, velocidad de costura',
    rejectDisposition: 'rework',
    scrapDescription: '',
    reworkReturnStep: 'OP 30',
  }),

  // ── OP 40: COSTURA VISTA ──
  makeStep('OP 40', 'operation', 'COSTURA VISTA', {
    machineDeviceTool: 'Máquina de coser',
    productCharacteristic: 'Aspecto visual de costura, alineación',
    processCharacteristic: 'Tensión de hilo, velocidad de costura',
    rejectDisposition: 'rework',
    scrapDescription: '',
    reworkReturnStep: 'OP 40',
  }),

  // ── OP 50: REFILADO DE FUNDA TERMINADA ──
  makeStep('OP 50', 'operation', 'REFILADO DE FUNDA TERMINADA', {
    machineDeviceTool: 'Tijera de refilado',
    productCharacteristic: 'Ausencia de material sobrante',
    processCharacteristic: '',
    rejectDisposition: 'rework',
    scrapDescription: '',
    reworkReturnStep: 'OP 50',
  }),

  // Transport to adhesivado sector
  makeStep('50a', 'transport', 'TRASLADO: FUNDAS A SECTOR DE ADHESIVADO', {}),

  // ── OP 60: ADHESIVADO DE PIEZAS PLASTICAS ──
  makeStep('OP 60', 'operation', 'ADHESIVADO DE PIEZAS PLASTICAS', {
    machineDeviceTool: 'Pistola de adhesivado',
    productCharacteristic: 'Adhesión correcta de piezas plásticas',
    processCharacteristic: 'Temperatura y presión de adhesivo',
    rejectDisposition: 'rework',
    scrapDescription: '',
    reworkReturnStep: 'OP 60',
  }),

  // ── OP 70: ADHESIVADO DE VINILO ──
  makeStep('OP 70', 'operation', 'ADHESIVADO DE VINILO', {
    machineDeviceTool: 'Pistola de adhesivado, Rodillo',
    productCharacteristic: 'Adhesión uniforme del vinilo',
    processCharacteristic: 'Temperatura y presión de adhesivo',
    rejectDisposition: 'rework',
    scrapDescription: '',
    reworkReturnStep: 'OP 70',
  }),

  // ── OP 80: CONTROL DE CALIDAD (inspection) ──
  makeStep('OP 80', 'inspection', 'CONTROL DE CALIDAD', {
    productCharacteristic: 'Aspecto visual, costura, adhesivado',
    processCharacteristic: '',
    rejectDisposition: 'rework',
    scrapDescription: '',
  }),

  // Decision after OP 80
  makeStep('80a', 'decision', 'PRODUCTO CONFORME?', {
    rejectDisposition: 'rework',
    scrapDescription: 'NO → Retrabajo o scrap según defecto',
  }),

  // Segregation on NO
  makeStep('80b', 'operation', 'CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME', {
    rejectDisposition: 'rework',
    scrapDescription: 'Segregar producto, evaluar retrabajo/scrap',
    notes: 'Camino NO de decisión',
  }),

  // Transport to tapizado sector
  makeStep('80c', 'transport', 'TRASLADO: PIEZAS APROBADAS A SECTOR DE TAPIZADO', {}),

  // ── OP 90: TAPIZADO SEMIAUTOMATICO ──
  makeStep('OP 90', 'operation', 'TAPIZADO SEMIAUTOMATICO', {
    machineDeviceTool: 'Máquina de tapizado',
    productCharacteristic: 'Tensión de tapizado, ausencia de arrugas',
    processCharacteristic: 'Presión de máquina, ciclo de tapizado',
    rejectDisposition: 'rework',
    scrapDescription: '',
    reworkReturnStep: 'OP 90',
  }),

  // ── OP 100: VIROLADO / REFILADO ──
  makeStep('OP 100', 'operation', 'VIROLADO / REFILADO', {
    machineDeviceTool: 'Tijera, pistola de calor, cutter',
    productCharacteristic: 'Bordes refilados, virolas correctas',
    processCharacteristic: 'Temperatura de pistola de calor',
    rejectDisposition: 'rework',
    scrapDescription: '',
    reworkReturnStep: 'OP 100',
  }),

  // ── OP 110: TERMINACION ──
  makeStep('OP 110', 'operation', 'TERMINACION', {
    machineDeviceTool: 'Herramientas manuales, pistola de ultrasonido',
    productCharacteristic: 'Acabado final, fijaciones',
    processCharacteristic: 'Frecuencia de ultrasonido',
    rejectDisposition: 'rework',
    scrapDescription: '',
    reworkReturnStep: 'OP 110',
  }),

  // ── OP 120: CONTROL FINAL DE CALIDAD (corrected name per PFD rules) ──
  makeStep('OP 120', 'inspection', 'CONTROL FINAL DE CALIDAD', {
    productCharacteristic: 'Aspecto general, dimensiones, funcionalidad',
    processCharacteristic: '',
    rejectDisposition: 'rework',
    scrapDescription: '',
  }),

  // Decision after final inspection
  makeStep('120a', 'decision', 'PRODUCTO CONFORME?', {
    rejectDisposition: 'rework',
    scrapDescription: 'NO → Retrabajo o scrap según defecto',
  }),

  // Segregation on NO
  makeStep('120b', 'operation', 'CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME', {
    rejectDisposition: 'scrap',
    scrapDescription: 'Segregar producto no conforme',
    notes: 'Camino NO de decisión',
  }),

  // Transport to packaging
  makeStep('120c', 'transport', 'TRASLADO: PRODUCTO APROBADO A SECTOR DE EMBALAJE', {}),

  // ── OP 130: EMBALAJE ──
  makeStep('OP 130', 'operation', 'EMBALAJE', {
    machineDeviceTool: '',
    productCharacteristic: 'Embalaje correcto, etiquetado',
    processCharacteristic: '',
    rejectDisposition: 'none',
    scrapDescription: '',
  }),
];

// ─── Build document ─────────────────────────────────────────────────────────
const now = new Date().toISOString();
const pfdData = {
  header,
  steps,
};

const docId = DOC_ID;
const checksum = createHash('md5').update(JSON.stringify(pfdData)).digest('hex');

const row = {
  id: docId,
  part_number: header.partNumber || '',
  part_name: header.partName,
  document_number: header.documentNumber,
  revision_level: header.revisionLevel,
  revision_date: header.revisionDate,
  customer_name: header.customerName,
  step_count: steps.length,
  data: pfdData,  // Pass as OBJECT — NEVER JSON.stringify (see database.md)
  checksum,
};

// ─── Summary ────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════════');
console.log('  PFD: TRIM ASM-UPR WRAPPING (IP PADs Patagonia)');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Document ID:    ${docId}`);
console.log(`  Document #:     ${header.documentNumber}`);
console.log(`  Part name:      ${header.partName}`);
console.log(`  Customer:       ${header.customerName}`);
console.log(`  Revision:       ${header.revisionLevel} (${header.revisionDate})`);
console.log(`  Linked AMFE:    ${header.linkedAmfeProject}`);
console.log(`  Total steps:    ${steps.length}`);
console.log('');

// Step breakdown
const typeCounts = {};
for (const s of steps) {
  typeCounts[s.stepType] = (typeCounts[s.stepType] || 0) + 1;
}
console.log('  Step breakdown:');
for (const [t, c] of Object.entries(typeCounts)) {
  console.log(`    ${t}: ${c}`);
}
console.log('');

// List all steps
console.log('  Steps:');
for (const s of steps) {
  const icon = { storage: '▽', operation: '□', inspection: '◇', transport: '→', decision: '◊' }[s.stepType] || '?';
  console.log(`    ${icon} ${s.stepNumber.padEnd(8)} ${s.description}`);
}
console.log('');
console.log(`  Mode: ${DRY_RUN ? 'DRY-RUN (use --apply to write)' : 'APPLY'}`);
console.log('═══════════════════════════════════════════════════════════════');

if (DRY_RUN) {
  console.log('\n✓ Dry-run complete. Use --apply to write to Supabase.');
  process.exit(0);
}

// ─── Auth ───────────────────────────────────────────────────────────────────
const { error: authErr } = await sb.auth.signInWithPassword({
  email: env.VITE_AUTO_LOGIN_EMAIL,
  password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (authErr) {
  console.error('Auth failed:', authErr.message);
  process.exit(1);
}
console.log('\n✓ Authenticated');

// ─── Check if document already exists ───────────────────────────────────────
const { data: existing, error: fetchErr } = await sb
  .from('pfd_documents')
  .select('id')
  .eq('id', docId)
  .maybeSingle();

if (fetchErr) {
  console.error('Fetch error:', fetchErr.message);
  process.exit(1);
}

let writeResult;
if (existing) {
  console.log(`  ↻ Document exists, updating...`);
  writeResult = await sb
    .from('pfd_documents')
    .update(row)
    .eq('id', docId);
} else {
  console.log(`  + Inserting new document...`);
  writeResult = await sb
    .from('pfd_documents')
    .insert(row);
}

if (writeResult.error) {
  console.error('Write error:', writeResult.error.message);
  process.exit(1);
}
console.log('✓ Document written to Supabase');

// ─── Verify no double-serialization ─────────────────────────────────────────
const { data: verify, error: verifyErr } = await sb
  .from('pfd_documents')
  .select('id, data, step_count')
  .eq('id', docId)
  .single();

if (verifyErr) {
  console.error('Verify error:', verifyErr.message);
  process.exit(1);
}

// The `data` column is TEXT in Supabase, so it comes back as a string.
// Parse it once — if it parses to an object with header+steps, the data is correct.
// If after parsing it's STILL a string, that means double-serialization occurred.
let parsed = verify.data;
if (typeof parsed === 'string') {
  try { parsed = JSON.parse(parsed); } catch { /* leave as-is */ }
}

const isObject = typeof parsed === 'object' && parsed !== null;
const hasSteps = Array.isArray(parsed?.steps);
const stepCount = parsed?.steps?.length ?? 0;
const hasHeader = typeof parsed?.header === 'object';

// Double-serialization check: if after one parse it's still a string, something is wrong
const isDoubleSerialized = typeof parsed === 'string';

console.log('\n─── Post-write verification ───');
console.log(`  raw typeof data:  ${typeof verify.data} (TEXT column → expected string)`);
console.log(`  parsed to object: ${isObject ? '✓' : '✗ FAILED'}`);
console.log(`  double-serial:    ${isDoubleSerialized ? '✗ YES — BAD!' : '✓ No'}`);
console.log(`  data.header:      ${hasHeader ? '✓ object' : '✗ MISSING'}`);
console.log(`  data.steps:       ${hasSteps ? '✓ array' : '✗ NOT ARRAY'}`);
console.log(`  steps count:      ${stepCount} (expected ${steps.length}) ${stepCount === steps.length ? '✓' : '✗ MISMATCH'}`);
console.log(`  step_count col:   ${verify.step_count} ${verify.step_count === steps.length ? '✓' : '✗ MISMATCH'}`);

if (isDoubleSerialized || !isObject || !hasSteps || stepCount !== steps.length) {
  console.error('\n✗ VERIFICATION FAILED — data integrity issue!');
  process.exit(1);
}

console.log('\n✓ All verifications passed. PFD loaded successfully.');
