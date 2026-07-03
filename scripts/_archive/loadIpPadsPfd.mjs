/**
 * loadIpPadsPfd_v2.mjs
 *
 * PFD PRELIMINAR - IP PAD Patagonia (PL1/PL2/PL3 - PVC tapizado)
 * 3 ramas paralelas: A (Sustrato), B (Cobertura PVC), C (Espuma)
 *
 * Elaborado por: Facundo Santoro
 * Aprobado por: Leonardo Lattanzi
 * Fecha: 2026-04-08
 *
 * Usage:
 *   node scripts/loadIpPadsPfd_v2.mjs           # dry-run (default)
 *   node scripts/loadIpPadsPfd_v2.mjs --apply   # write to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID, createHash } from 'crypto';

const DRY_RUN = !process.argv.includes('--apply');
const ENV_PATH = 'C:/Users/FacundoS-PC/dev/BarackMercosul/.env.local';
const DOC_ID = 'pfd-ippads-trim-asm-upr-wrapping';

const envText = readFileSync(ENV_PATH, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const uid = () => randomUUID();

function makeStep(sn, st, desc, opts = {}) {
  return {
    id: uid(), stepNumber: sn, stepType: st, description: desc,
    machineDeviceTool: opts.mdt || '', productCharacteristic: opts.pc || '',
    productSpecialChar: opts.psc || 'none', processCharacteristic: opts.prc || '',
    processSpecialChar: opts.prsc || 'none', reference: opts.ref || '',
    department: opts.dept || '', notes: opts.notes || '',
    isRework: opts.isRework || false, isExternalProcess: false,
    reworkReturnStep: opts.rrs || '', rejectDisposition: opts.rd || 'none',
    scrapDescription: opts.sd || '', branchId: opts.bid || '', branchLabel: opts.bl || '',
  };
}

const header = {
  partNumber: '2HC.858.417.B FAM',
  partName: 'IP PAD',
  engineeringChangeLevel: '',
  modelYear: 'PATAGONIA',
  documentNumber: 'PFD-IPPAD-001',
  revisionLevel: 'A',
  revisionDate: '2026-04-08',
  processPhase: 'pre-launch',
  companyName: 'BARACK MERCOSUL',
  plantLocation: 'Hurlingham, Buenos Aires',
  supplierCode: '',
  customerName: 'VWA',
  coreTeam: 'Paulo Centurion (Ingenieria), Manuel Meszaros (Calidad), Leonardo Lattanzi (Produccion)',
  keyContact: 'F. Santoro',
  preparedBy: 'Facundo Santoro',
  preparedDate: '2026-04-08',
  approvedBy: 'Leonardo Lattanzi',
  approvedDate: '2026-04-08',
  applicableParts: 'PL1: 2HC.858.417.B FAM (IP PAD - LOW VERSION)\nPL2: 2HC.858.417.C GKK (IP PAD - HIGH VERSION)\nPL3: 2HC.858.417.C GKN (IP PAD - HIGH VERSION)',
  linkedAmfeProject: 'VWA/PATAGONIA/IP_PADS',
};

const steps = [
  // MAIN - Recepcion
  makeStep('OP 10', 'storage', 'RECEPCION DE MATERIA PRIMA', { dept: 'Recepcion', pc: 'Certificado de calidad, estado del material', rd: 'scrap', sd: 'Material no conforme - Rechazo a proveedor' }),
  makeStep('', 'decision', 'MATERIAL CONFORME?', { dept: 'Recepcion', rd: 'scrap', sd: 'NO - Reclamo de calidad al proveedor' }),
  makeStep('', 'storage', 'ALMACENAMIENTO DE MATERIA PRIMA', { dept: 'Almacen' }),

  // RAMA A - Sustrato (Inyeccion)
  makeStep('', 'transport', 'TRASLADO: MATERIAL A SECTOR DE INYECCION', { bid: 'A', bl: 'Sustrato', dept: 'Inyeccion' }),
  makeStep('OP 20', 'operation', 'INYECCION', { bid: 'A', bl: 'Sustrato', dept: 'Inyeccion', mdt: 'Inyectora', pc: 'Dimensiones del sustrato, integridad estructural', prc: 'Temperatura, presion, ciclo de inyeccion' }),
  makeStep('', 'storage', 'ALMACENAMIENTO EN MEDIOS WIP', { bid: 'A', bl: 'Sustrato', dept: 'Inyeccion' }),

  // RAMA B - Cobertura PVC (Corte + Costura)
  makeStep('', 'transport', 'TRASLADO: VINILO A SECTOR DE CORTE', { bid: 'B', bl: 'Cobertura PVC', dept: 'Corte' }),
  makeStep('OP 30', 'operation', 'CORTE', { bid: 'B', bl: 'Cobertura PVC', dept: 'Corte', mdt: 'Maquina de corte', pc: 'Dimensiones de corte del vinilo', prc: 'Set up de maquina de corte' }),
  makeStep('', 'transport', 'TRASLADO: PIEZAS CORTADAS A SECTOR DE COSTURA', { bid: 'B', bl: 'Cobertura PVC', dept: 'Costura' }),
  makeStep('OP 40', 'operation', 'COSTURA', { bid: 'B', bl: 'Cobertura PVC', dept: 'Costura', mdt: 'Maquina de coser', pc: 'Resistencia y alineacion de costura', prc: 'Tension de hilo, velocidad de costura' }),
  makeStep('', 'storage', 'ALMACENAMIENTO EN MEDIOS WIP', { bid: 'B', bl: 'Cobertura PVC', dept: 'Costura' }),

  // RAMA C - Espuma (Troquelado)
  makeStep('', 'transport', 'TRASLADO: ESPUMA A SECTOR DE TROQUELADO', { bid: 'C', bl: 'Espuma', dept: 'Troquelado' }),
  makeStep('OP 50', 'operation', 'TROQUELADO DE ESPUMAS', { bid: 'C', bl: 'Espuma', dept: 'Troquelado', mdt: 'Troqueladora', pc: 'Dimensiones de espuma troquelada', prc: 'Presion de troquelado, filo de matriz' }),
  makeStep('', 'storage', 'ALMACENAMIENTO EN MEDIOS WIP', { bid: 'C', bl: 'Espuma', dept: 'Troquelado' }),

  // MERGE - Flujo principal
  makeStep('OP 60', 'operation', 'ENSAMBLE SUSTRATO + ESPUMA', { dept: 'Ensamble', mdt: 'Dispositivo de ensamble', pc: 'Union correcta sustrato-espuma', prc: 'Alineacion de componentes' }),
  makeStep('', 'transport', 'TRASLADO: MATERIAL ADHESIVO DESDE ALMACEN MP', { dept: 'Adhesivado', notes: 'KD: Material adhesivo directo desde almacen de materia prima' }),
  makeStep('OP 70', 'operation', 'ADHESIVADO', { dept: 'Adhesivado', mdt: 'Pistola de adhesivado', pc: 'Adhesion uniforme de cobertura PVC', prc: 'Temperatura y presion de adhesivo', rd: 'rework', rrs: 'OP 70' }),
  makeStep('', 'inspection', 'CONTROL DE CALIDAD', { dept: 'Calidad', pc: 'Aspecto visual, adhesion, costura' }),
  makeStep('', 'decision', 'PRODUCTO CONFORME?', { dept: 'Calidad', rd: 'rework', sd: 'NO - Retrabajo' }),

  // POST-ADHESIVADO
  makeStep('OP 80', 'operation', 'ALINEACION DE COSTURA (PRE-FIXING)', { dept: 'Terminacion', mdt: 'Dispositivo de pre-fixing', pc: 'Alineacion correcta de costura sobre sustrato' }),
  makeStep('OP 90', 'operation', 'WRAPPING + EDGE FOLDING', { dept: 'Terminacion', mdt: 'Dispositivo de wrapping', pc: 'Plegado de bordes correcto, ausencia de arrugas' }),
  makeStep('OP 100', 'operation', 'SOLDADURA CON ULTRASONIDO', { dept: 'Terminacion', mdt: 'Dispositivo de ultrasonido', pc: 'Soldadura correcta, resistencia de union', prc: 'Frecuencia y presion de ultrasonido' }),
  makeStep('OP 110', 'operation', 'TERMINACION', { dept: 'Terminacion', mdt: 'Herramientas manuales', pc: 'Acabado final, fijaciones correctas' }),

  // Control final + embalaje
  makeStep('', 'inspection', 'CONTROL FINAL DE CALIDAD', { dept: 'Calidad', pc: 'Aspecto general, dimensiones, funcionalidad' }),
  makeStep('', 'decision', 'PRODUCTO CONFORME?', { dept: 'Calidad', rd: 'scrap', sd: 'NO - Clasificacion y segregacion de PNC' }),
  makeStep('', 'operation', 'CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME', { dept: 'Calidad', rd: 'scrap', notes: 'Camino NO de decision final' }),
  makeStep('', 'transport', 'TRASLADO: PRODUCTO APROBADO A SECTOR DE EMBALAJE', { dept: 'Embalaje' }),
  makeStep('OP 120', 'operation', 'EMBALAJE DE PRODUCTO TERMINADO', { dept: 'Embalaje', pc: 'Embalaje correcto, etiquetado' }),
  makeStep('', 'storage', 'ALMACENAMIENTO DE PRODUCTO TERMINADO', { dept: 'Almacen PT' }),
];

// Build + summary
const pfdData = { header, steps };
const checksum = createHash('md5').update(JSON.stringify(pfdData)).digest('hex');
const row = { id: DOC_ID, part_number: header.partNumber, part_name: header.partName, document_number: header.documentNumber, revision_level: header.revisionLevel, revision_date: header.revisionDate, customer_name: header.customerName, step_count: steps.length, data: pfdData, checksum };

console.log('PFD PRELIMINAR: IP PAD Patagonia (3 ramas paralelas)');
console.log('Part:', header.partName, '|', header.partNumber);
console.log('Steps:', steps.length);

for (const s of steps) {
  const i = {storage:'V',operation:'O',inspection:'I',transport:'>',decision:'?'}[s.stepType]||'x';
  const br = s.branchId ? '['+s.branchId+']' : '   ';
  console.log(' ', i, br, (s.stepNumber||'').padEnd(7), s.description);
}

console.log('\nMode:', DRY_RUN ? 'DRY-RUN (--apply to write)' : 'APPLY');
if (DRY_RUN) { console.log('\nDry-run complete.'); process.exit(0); }

// Auth + Write
const { error: authErr } = await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }
console.log('\nAuthenticated');

const { data: existing } = await sb.from('pfd_documents').select('id').eq('id', DOC_ID).maybeSingle();
const wr = existing
  ? await sb.from('pfd_documents').update(row).eq('id', DOC_ID)
  : await sb.from('pfd_documents').insert(row);
if (wr.error) { console.error('Write error:', wr.error.message); process.exit(1); }
console.log('Document', existing ? 'updated' : 'inserted');

// Verify
const { data: v, error: ve } = await sb.from('pfd_documents').select('id, data, step_count').eq('id', DOC_ID).single();
if (ve) { console.error('Verify error:', ve.message); process.exit(1); }
let p = v.data;
if (typeof p === 'string') { try { p = JSON.parse(p); } catch { /* noop */ } }
const isObj = typeof p === 'object' && p !== null;
const isArr = Array.isArray(p?.steps);
const cnt = p?.steps?.length ?? 0;
const dbl = typeof p === 'string';
const brs = [...new Set((p?.steps||[]).filter(s=>s.branchId).map(s=>s.branchId))];
console.log('\nVerification:');
console.log('  object:', isObj?'OK':'FAIL', '| double-serial:', dbl?'BAD':'No', '| steps:', cnt+'/'+steps.length, cnt===steps.length?'OK':'MISMATCH');
console.log('  branches:', brs.join(','), '(expect A,B,C)', brs.length===3?'OK':'FAIL');
if (dbl || !isObj || !isArr || cnt !== steps.length || brs.length !== 3) { console.error('\nVERIFICATION FAILED'); process.exit(1); }
console.log('\nPFD PRELIMINAR IP PAD cargado con 3 ramas paralelas.');
