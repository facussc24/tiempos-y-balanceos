/**
 * fixTelasTermoformadasPfd.mjs
 *
 * Updates the PFD document for PWA Telas Termoformadas 582D.
 * - Updates header fields (partName, partNumber, companyName, etc.)
 * - Rebuilds the steps array with the correct 29-step flow
 *
 * Usage:
 *   node scripts/fixTelasTermoformadasPfd.mjs           # dry-run (default)
 *   node scripts/fixTelasTermoformadasPfd.mjs --apply   # write to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { randomUUID, createHash } from 'crypto';

const DRY_RUN = !process.argv.includes('--apply');
const ENV_PATH = 'C:/Users/FacundoS-PC/dev/BarackMercosul/.env.local';
const DOC_ID = '80616391-37ba-4b0a-b23b-6802c98fcd60';

// --- Read env ---
const envText = readFileSync(ENV_PATH, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const uid = () => randomUUID();

// --- Step factory ---
function makeStep(sn, st, desc, opts = {}) {
  return {
    id: uid(),
    stepNumber: sn,
    stepType: st,
    description: desc,
    machineDeviceTool: opts.mdt || '',
    productCharacteristic: opts.pc || '',
    productSpecialChar: opts.psc || 'none',
    processCharacteristic: opts.prc || '',
    processSpecialChar: opts.prsc || 'none',
    reference: opts.ref || '',
    department: opts.dept || '',
    notes: opts.notes || '',
    isRework: opts.isRework || false,
    isExternalProcess: false,
    reworkReturnStep: opts.rrs || '',
    rejectDisposition: opts.rd || 'none',
    scrapDescription: opts.sd || '',
    branchId: opts.bid || '',
    branchLabel: opts.bl || '',
    linkedAmfeOperationId: opts.linkedAmfeOpId || '',
  };
}

// --- Header ---
const header = {
  partName: 'TELAS TERMOFORMADAS 582D',
  partNumber: '21-9640 / 21-9641 / 21-9642 / 21-9643',
  engineeringChangeLevel: '',
  modelYear: 'HILUX 582D',
  documentNumber: 'PFD-TT-001',
  revisionLevel: 'A',
  revisionDate: '2026-04-10',
  processPhase: 'pre-launch',
  companyName: 'BARACK MERCOSUL',
  plantLocation: 'Hurlingham, Buenos Aires',
  supplierCode: '',
  customerName: 'PWA',
  coreTeam: 'Carlos Baptista (Ingenieria), Manuel Meszaros (Calidad), Marianna Vera (Produccion)',
  keyContact: 'F. Santoro',
  preparedBy: 'Facundo Santoro',
  preparedDate: '2026-04-10',
  reviewedBy: 'Paulo Centurion',
  approvedBy: 'Carlos Baptista',
  approvedDate: '2026-04-10',
  applicableParts: [
    '21-9640 LH - TELA ASIENTO TERMOFORMADA',
    '21-9641 RH - TELA ASIENTO TERMOFORMADA',
    '21-9642 LH - TELA RESPALDO TERMOFORMADA',
    '21-9643 RH - TELA RESPALDO TERMOFORMADA',
    '304883 - REFUERZO LATERAL RESPALDO LH',
    '304884 - REFUERZO LATERAL RESPALDO RH',
  ].join('\n'),
  linkedAmfeProject: 'PWA/TELAS_TERMOFORMADAS',
};

// --- Steps (29 steps) ---
const steps = [
  // 1. Recepcion
  makeStep('10', 'storage', 'RECEPCION DE MATERIA PRIMA', { dept: 'Recepcion' }),
  // 2. Inspeccion MP
  makeStep('', 'inspection', 'INSPECCION DE MATERIA PRIMA', { dept: 'Calidad' }),
  // 3. Decision MP
  makeStep('', 'decision', 'MATERIAL CONFORME?', { dept: 'Calidad' }),
  // 4. Almacenado MP aprobada
  makeStep('', 'storage', 'ALMACENADO EN SECTOR DE MATERIA PRIMA APROBADA', { dept: 'Almacen' }),
  // 5. Traslado a corte
  makeStep('', 'transport', 'TRASLADO: MATERIAL A SECTOR DE CORTE', { dept: 'Corte' }),
  // 6. Preparacion de corte
  makeStep('15', 'operation', 'PREPARACION DE CORTE', { dept: 'Corte' }),
  // 7. Corte de componentes
  makeStep('20', 'operation', 'CORTE DE COMPONENTES', { dept: 'Corte' }),
  // 8. Control con mylar
  makeStep('25', 'inspection', 'CONTROL CON MYLAR', { dept: 'Calidad' }),
  // 9. Decision pieza conforme
  makeStep('', 'decision', 'PIEZA CONFORME?', { dept: 'Calidad' }),
  // 10. Preparacion de kits
  makeStep('30', 'operation', 'PREPARACION DE KITS DE COMPONENTES', { dept: 'Corte' }),
  // 11. Traslado kits a termoformado
  makeStep('', 'transport', 'TRASLADO: KITS A SECTOR DE TERMOFORMADO', { dept: 'Termoformado' }),
  // 12. Termoformado
  makeStep('40', 'operation', 'TERMOFORMADO DE TELAS', { dept: 'Termoformado' }),
  // 13. Traslado a corte laser
  makeStep('', 'transport', 'TRASLADO: TELAS TERMOFORMADAS A SECTOR DE CORTE LASER', { dept: 'Corte Laser' }),
  // 14. Corte laser
  makeStep('50', 'operation', 'CORTE LASER DE TELAS TERMOFORMADAS', { dept: 'Corte Laser' }),
  // 15. Traslado a troquelado
  makeStep('', 'transport', 'TRASLADO: PIEZAS A SECTOR DE TROQUELADO', { dept: 'Troquelado' }),
  // 16. Troquelado de refuerzos
  makeStep('60', 'operation', 'TROQUELADO DE REFUERZOS', { dept: 'Troquelado' }),
  // 17. Troquelado de aplix
  makeStep('70', 'operation', 'TROQUELADO DE APLIX', { dept: 'Troquelado' }),
  // 18. Traslado a costura
  makeStep('', 'transport', 'TRASLADO: COMPONENTES A SECTOR DE COSTURA', { dept: 'Costura' }),
  // 19. Costura de refuerzos
  makeStep('80', 'operation', 'COSTURA DE REFUERZOS', { dept: 'Costura' }),
  // 20. Aplicacion de aplix
  makeStep('90', 'operation', 'APLICACION DE APLIX', { dept: 'Costura' }),
  // 21. Traslado a control final
  makeStep('', 'transport', 'TRASLADO: PIEZAS A SECTOR DE CONTROL FINAL', { dept: 'Calidad' }),
  // 22. Control final
  makeStep('100', 'inspection', 'CONTROL FINAL DE CALIDAD', { dept: 'Calidad' }),
  // 23. Decision producto conforme
  makeStep('', 'decision', 'PRODUCTO CONFORME?', { dept: 'Calidad' }),
  // 24. Reproceso: hilo sobrante
  makeStep('101', 'operation', 'REPROCESO: ELIMINACION DE HILO SOBRANTE', { dept: 'Costura', isRework: true }),
  // 25. Reproceso: reubicacion aplix
  makeStep('102', 'operation', 'REPROCESO: REUBICACION DE APLIX', { dept: 'Costura', isRework: true }),
  // 26. Reproceso: costura desviada/floja
  makeStep('103', 'operation', 'REPROCESO: CORRECCION DE COSTURA DESVIADA/FLOJA', { dept: 'Costura', isRework: true }),
  // 27. Clasificacion PNC
  makeStep('105', 'operation', 'CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME', { dept: 'Calidad' }),
  // 28. Embalaje
  makeStep('110', 'operation', 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO', { dept: 'Embalaje' }),
  // 29. Almacenamiento PT
  makeStep('120', 'storage', 'ALMACENAMIENTO PRODUCTO TERMINADO', { dept: 'Almacen PT' }),
];

// --- Build document data ---
const pfdData = { header, steps };
const checksum = createHash('md5').update(JSON.stringify(pfdData)).digest('hex');

const row = {
  id: DOC_ID,
  part_number: header.partNumber,
  part_name: header.partName,
  document_number: header.documentNumber,
  revision_level: header.revisionLevel,
  revision_date: header.revisionDate,
  customer_name: header.customerName,
  step_count: steps.length,
  data: pfdData,
  checksum,
};

// --- Summary ---
console.log('PFD UPDATE: Telas Termoformadas 582D (PWA)');
console.log('Doc ID:', DOC_ID);
console.log('Part:', header.partName, '|', header.partNumber);
console.log('Steps:', steps.length);
console.log('');

for (const s of steps) {
  const icon = { storage: 'V', operation: 'O', inspection: 'I', transport: '>', decision: '?' }[s.stepType] || 'x';
  const rw = s.isRework ? ' [REWORK]' : '';
  console.log(' ', icon, (s.stepNumber || '').padEnd(5), s.description + rw);
}

console.log('\nMode:', DRY_RUN ? 'DRY-RUN (--apply to write)' : 'APPLY');
if (DRY_RUN) { console.log('\nDry-run complete.'); process.exit(0); }

// --- Auth ---
const { error: authErr } = await sb.auth.signInWithPassword({
  email: env.VITE_AUTO_LOGIN_EMAIL,
  password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }
console.log('\nAuthenticated');

// --- Read existing for backup ---
const { data: existing, error: readErr } = await sb.from('pfd_documents').select('*').eq('id', DOC_ID).maybeSingle();
if (readErr) { console.error('Read error:', readErr.message); process.exit(1); }
if (!existing) { console.error('Document not found:', DOC_ID); process.exit(1); }

// --- Local backup ---
const backupDir = 'C:/Users/FacundoS-PC/dev/BarackMercosul/backups/pre-fix-telas-termoformadas-pfd';
mkdirSync(backupDir, { recursive: true });
writeFileSync(
  backupDir + '/pfd_telas_termoformadas_backup.json',
  JSON.stringify(existing, null, 2),
  'utf8'
);
console.log('Backup saved to:', backupDir);

// --- Write (update) ---
const { error: writeErr } = await sb.from('pfd_documents').update(row).eq('id', DOC_ID);
if (writeErr) { console.error('Write error:', writeErr.message); process.exit(1); }
console.log('Document updated');

// --- Verify ---
const { data: v, error: ve } = await sb.from('pfd_documents').select('id, data, step_count').eq('id', DOC_ID).single();
if (ve) { console.error('Verify error:', ve.message); process.exit(1); }

let p = v.data;
if (typeof p === 'string') { try { p = JSON.parse(p); } catch { /* noop */ } }

const isObj = typeof p === 'object' && p !== null;
const isArr = Array.isArray(p?.steps);
const cnt = p?.steps?.length ?? 0;
const dbl = typeof p === 'string';

console.log('\nVerification:');
console.log('  object:', isObj ? 'OK' : 'FAIL');
console.log('  double-serial:', dbl ? 'BAD' : 'No (OK)');
console.log('  steps:', cnt + '/' + steps.length, cnt === steps.length ? 'OK' : 'MISMATCH');
console.log('  partName:', p?.header?.partName);
console.log('  partNumber:', p?.header?.partNumber);
console.log('  companyName:', p?.header?.companyName);
console.log('  customerName:', p?.header?.customerName);
console.log('  preparedBy:', p?.header?.preparedBy);
console.log('  reviewedBy:', p?.header?.reviewedBy);
console.log('  approvedBy:', p?.header?.approvedBy);

// Check rework steps
const reworkSteps = (p?.steps || []).filter(s => s.isRework);
console.log('  rework steps:', reworkSteps.length, '(expect 3)', reworkSteps.length === 3 ? 'OK' : 'FAIL');

// Check step types distribution
const typeCounts = {};
for (const s of (p?.steps || [])) {
  typeCounts[s.stepType] = (typeCounts[s.stepType] || 0) + 1;
}
console.log('  type distribution:', JSON.stringify(typeCounts));

if (dbl || !isObj || !isArr || cnt !== steps.length) {
  console.error('\nVERIFICATION FAILED');
  process.exit(1);
}

console.log('\nPFD Telas Termoformadas 582D actualizado correctamente.');
