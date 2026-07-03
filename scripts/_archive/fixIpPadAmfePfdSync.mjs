/**
 * fixIpPadAmfePfdSync.mjs
 *
 * Transforma el AMFE del IP PAD para que matchee con el PFD preliminar nuevo.
 * NO empieza de 0 — reutiliza todos los WEs, failures y causes existentes.
 *
 * Transformaciones:
 * - OP 10 RECEPCION: mantener
 * - OP 85 INYECCION → mover a OP 20, renombrar
 * - OP 20 CORTE → renumerar a OP 30, renombrar
 * - OP 30+40 COSTURA UNION+VISTA → fusionar en OP 40 COSTURA
 * - CREAR OP 50 TROQUELADO DE ESPUMAS
 * - CREAR OP 60 ENSAMBLE SUSTRATO + ESPUMA
 * - OP 60+70 ADHESIVADO PLAST+VINILO → fusionar en OP 70 ADHESIVADO
 * - CREAR OP 80 ALINEACION DE COSTURA (PRE-FIXING)
 * - CREAR OP 90 WRAPPING + EDGE FOLDING
 * - CREAR OP 100 SOLDADURA CON ULTRASONIDO
 * - OP 110 TERMINACION: mantener
 * - OP 120 CONTROL FINAL: enriquecer con patron Top Roll
 * - OP 130 EMBALAJE → renumerar a OP 120
 * - ELIMINAR: OP 50 REFILADO, OP 80 CONTROL CALIDAD, OP 90 TAPIZADO, OP 100 VIROLADO
 *
 * Usage:
 *   node scripts/fixIpPadAmfePfdSync.mjs           # dry-run
 *   node scripts/fixIpPadAmfePfdSync.mjs --apply   # write
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID, createHash } from 'crypto';

const DRY_RUN = process.argv.indexOf('--apply') < 0;
const ENV_PATH = 'C:/Users/FacundoS-PC/dev/BarackMercosul/.env.local';
const IPPAD_ID = 'c9b93b84-f804-4cd0-91c1-c4878db41b97';
const TOPROLL_ID = '78eaa89b-ad0b-4342-9046-ab2e9b14d3b3';

const envText = readFileSync(ENV_PATH, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(function(l){return l.includes('=') && l.charAt(0) !== '#';})
    .map(function(l){ var i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const uid = function(){ return randomUUID(); };

// ─── AP Table (official, from apTable.ts) ────────────────────────────────────
const AP_TABLE = {
  '2-2': { 2:'L',3:'L',4:'L',5:'L',6:'L',7:'L',8:'L',9:'L',10:'L' },
  '2-3': { 2:'L',3:'L',4:'L',5:'L',6:'L',7:'L',8:'L',9:'L',10:'L' },
  '2-4': { 2:'L',3:'L',4:'L',5:'L',6:'L',7:'L',8:'L',9:'M',10:'M' },
  '2-5': { 2:'L',3:'L',4:'L',5:'L',6:'L',7:'M',8:'M',9:'M',10:'M' },
  '2-6': { 2:'L',3:'L',4:'L',5:'L',6:'M',7:'M',8:'M',9:'M',10:'H' },
  '2-7': { 2:'L',3:'L',4:'L',5:'M',6:'M',7:'M',8:'H',9:'H',10:'H' },
  '2-8': { 2:'L',3:'L',4:'M',5:'M',6:'M',7:'H',8:'H',9:'H',10:'H' },
  '2-9': { 2:'L',3:'M',4:'M',5:'M',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '2-10':{ 2:'M',3:'M',4:'M',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '3-2': { 2:'L',3:'L',4:'L',5:'L',6:'L',7:'L',8:'L',9:'L',10:'L' },
  '3-3': { 2:'L',3:'L',4:'L',5:'L',6:'L',7:'L',8:'L',9:'M',10:'M' },
  '3-4': { 2:'L',3:'L',4:'L',5:'L',6:'L',7:'M',8:'M',9:'M',10:'M' },
  '3-5': { 2:'L',3:'L',4:'L',5:'L',6:'M',7:'M',8:'M',9:'M',10:'H' },
  '3-6': { 2:'L',3:'L',4:'L',5:'M',6:'M',7:'M',8:'H',9:'H',10:'H' },
  '3-7': { 2:'L',3:'L',4:'M',5:'M',6:'M',7:'H',8:'H',9:'H',10:'H' },
  '3-8': { 2:'L',3:'M',4:'M',5:'M',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '3-9': { 2:'M',3:'M',4:'M',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '3-10':{ 2:'M',3:'M',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '4-2': { 2:'L',3:'L',4:'L',5:'L',6:'L',7:'L',8:'L',9:'M',10:'M' },
  '4-3': { 2:'L',3:'L',4:'L',5:'L',6:'L',7:'M',8:'M',9:'M',10:'M' },
  '4-4': { 2:'L',3:'L',4:'L',5:'L',6:'M',7:'M',8:'M',9:'M',10:'H' },
  '4-5': { 2:'L',3:'L',4:'L',5:'M',6:'M',7:'M',8:'H',9:'H',10:'H' },
  '4-6': { 2:'L',3:'L',4:'M',5:'M',6:'M',7:'H',8:'H',9:'H',10:'H' },
  '4-7': { 2:'L',3:'M',4:'M',5:'M',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '4-8': { 2:'M',3:'M',4:'M',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '4-9': { 2:'M',3:'M',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '4-10':{ 2:'M',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '5-2': { 2:'L',3:'L',4:'L',5:'L',6:'L',7:'M',8:'M',9:'M',10:'M' },
  '5-3': { 2:'L',3:'L',4:'L',5:'L',6:'M',7:'M',8:'M',9:'M',10:'H' },
  '5-4': { 2:'L',3:'L',4:'L',5:'M',6:'M',7:'M',8:'H',9:'H',10:'H' },
  '5-5': { 2:'L',3:'L',4:'M',5:'M',6:'M',7:'H',8:'H',9:'H',10:'H' },
  '5-6': { 2:'L',3:'M',4:'M',5:'M',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '5-7': { 2:'M',3:'M',4:'M',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '5-8': { 2:'M',3:'M',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '5-9': { 2:'M',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '5-10':{ 2:'H',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '6-2': { 2:'L',3:'L',4:'L',5:'L',6:'M',7:'M',8:'M',9:'M',10:'H' },
  '6-3': { 2:'L',3:'L',4:'L',5:'M',6:'M',7:'M',8:'H',9:'H',10:'H' },
  '6-4': { 2:'L',3:'L',4:'M',5:'M',6:'M',7:'H',8:'H',9:'H',10:'H' },
  '6-5': { 2:'L',3:'M',4:'M',5:'M',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '6-6': { 2:'M',3:'M',4:'M',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '6-7': { 2:'M',3:'M',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '6-8': { 2:'M',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '6-9': { 2:'H',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '6-10':{ 2:'H',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '7-2': { 2:'L',3:'L',4:'L',5:'M',6:'M',7:'M',8:'H',9:'H',10:'H' },
  '7-3': { 2:'L',3:'L',4:'M',5:'M',6:'M',7:'H',8:'H',9:'H',10:'H' },
  '7-4': { 2:'L',3:'M',4:'M',5:'M',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '7-5': { 2:'M',3:'M',4:'M',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '7-6': { 2:'M',3:'M',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '7-7': { 2:'M',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '7-8': { 2:'H',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '7-9': { 2:'H',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '7-10':{ 2:'H',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '8-2': { 2:'L',3:'L',4:'M',5:'M',6:'M',7:'H',8:'H',9:'H',10:'H' },
  '8-3': { 2:'L',3:'M',4:'M',5:'M',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '8-4': { 2:'M',3:'M',4:'M',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '8-5': { 2:'M',3:'M',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '8-6': { 2:'M',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '8-7': { 2:'H',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '8-8': { 2:'H',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '8-9': { 2:'H',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '8-10':{ 2:'H',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '9-2': { 2:'L',3:'M',4:'M',5:'M',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '9-3': { 2:'M',3:'M',4:'M',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '9-4': { 2:'M',3:'M',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '9-5': { 2:'M',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '9-6': { 2:'H',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '9-7': { 2:'H',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '9-8': { 2:'H',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '9-9': { 2:'H',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '9-10':{ 2:'H',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '10-2':{ 2:'M',3:'M',4:'M',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '10-3':{ 2:'M',3:'M',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '10-4':{ 2:'M',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '10-5':{ 2:'H',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '10-6':{ 2:'H',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '10-7':{ 2:'H',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '10-8':{ 2:'H',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '10-9':{ 2:'H',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
  '10-10':{2:'H',3:'H',4:'H',5:'H',6:'H',7:'H',8:'H',9:'H',10:'H' },
};

function calcAP(s, o, d) {
  if (s < 2 || o < 2 || d < 2) return 'L';
  var key = s + '-' + o;
  var row = AP_TABLE[key];
  if (row) return row[d] || 'L';
  return 'L';
}

// ─── Helper: create a minimal new operation ─────────────────────────────────
function makeNewOp(opNum, opName, focusFn) {
  return {
    id: uid(),
    operationNumber: String(opNum),
    operationName: opName,
    focusElementFunction: focusFn || '',
    linkedPfdStepId: '',
    workElements: [],
  };
}

function makeWE(desc) {
  return { id: uid(), description: desc, functions: [] };
}

function makeFn(desc) {
  return { id: uid(), description: desc, failures: [] };
}

function makeFail(desc, effectLocal, effectNext, effectEnd) {
  return {
    id: uid(), description: desc,
    effectLocal: effectLocal || '', effectNextLevel: effectNext || '', effectEndUser: effectEnd || '',
    causes: [],
  };
}

function makeCause(desc, s, o, d, opts) {
  opts = opts || {};
  return {
    id: uid(), description: desc,
    severity: s, occurrence: o, detection: d,
    actionPriority: calcAP(s, o, d),
    preventionControl: opts.prev || '', detectionControl: opts.det || '',
    preventionAction: '', detectionAction: '',
    responsible: '', targetDate: '', status: '',
    characteristicNumber: '', specialChar: '', filterCode: '',
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  // Auth
  var authRes = await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
  if (authRes.error) { console.error('Auth failed:', authRes.error.message); process.exit(1); }
  console.log('Authenticated');

  // Load IP PAD AMFE
  var ipRes = await sb.from('amfe_documents').select('*').eq('id', IPPAD_ID).single();
  if (ipRes.error) { console.error('Load IP PAD failed:', ipRes.error.message); process.exit(1); }
  var ipDoc = ipRes.data;
  var d = ipDoc.data;
  if (typeof d === 'string') try { d = JSON.parse(d); } catch(e) {}

  // Load Top Roll AMFE (for Control Final template)
  var trRes = await sb.from('amfe_documents').select('data').eq('id', TOPROLL_ID).single();
  var trData = trRes.data.data;
  if (typeof trData === 'string') try { trData = JSON.parse(trData); } catch(e) {}

  console.log('\n=== AMFE actual: ' + (d.operations || []).length + ' operaciones ===');
  var oldOps = d.operations || [];
  var opMap = {};
  oldOps.forEach(function(op) { opMap[op.operationNumber] = op; });

  // Helper to find old op
  function getOp(num) { return opMap[String(num)]; }

  // ─── Build new operations array ────────────────────────────────────────
  var newOps = [];
  var focusFn = oldOps[0] && oldOps[0].focusElementFunction ? oldOps[0].focusElementFunction : '';

  // OP 10: RECEPCION - keep as is
  var op10 = getOp(10);
  if (op10) { op10.operationName = 'RECEPCION DE MATERIA PRIMA'; newOps.push(op10); }

  // OP 20: INYECCION - move from OP 85
  var op85 = getOp(85);
  if (op85) {
    op85.operationNumber = '20';
    op85.operationName = 'INYECCION';
    op85.id = uid(); // new id for new position
    newOps.push(op85);
  }

  // OP 30: CORTE - move from old OP 20
  var op20old = getOp(20);
  if (op20old) {
    op20old.operationNumber = '30';
    op20old.operationName = 'CORTE';
    op20old.id = uid();
    newOps.push(op20old);
  }

  // OP 40: COSTURA - merge old OP 30 (COSTURA UNION) + OP 40 (COSTURA VISTA)
  var op30old = getOp(30);
  var op40old = getOp(40);
  if (op30old || op40old) {
    var mergedCostura = {
      id: uid(),
      operationNumber: '40',
      operationName: 'COSTURA',
      focusElementFunction: focusFn,
      linkedPfdStepId: '',
      workElements: [],
    };
    if (op30old) mergedCostura.workElements = mergedCostura.workElements.concat(op30old.workElements || []);
    if (op40old) mergedCostura.workElements = mergedCostura.workElements.concat(op40old.workElements || []);
    newOps.push(mergedCostura);
  }

  // OP 50: TROQUELADO DE ESPUMAS - NEW
  var op50new = makeNewOp(50, 'TROQUELADO DE ESPUMAS', focusFn);
  var we50machine = makeWE('Maquina: Troqueladora');
  var fn50 = makeFn('Troquelar espuma PU Foam a dimension correcta');
  var fail50dim = makeFail('Espuma fuera de dimension',
    'Pieza troquelada no cumple tolerancia dimensional',
    'Ensamble sustrato-espuma desalineado',
    'Confort reducido o bulto perceptible al tacto');
  fail50dim.causes.push(makeCause('Desgaste de matriz de troquelado', 5, 4, 5, { prev: 'Plan de mantenimiento preventivo de matrices', det: 'Inspeccion visual dimensional post-troquelado' }));
  fn50.failures.push(fail50dim);
  we50machine.functions.push(fn50);
  op50new.workElements.push(we50machine);

  var we50man = makeWE('Mano de obra: Operador de troquelado');
  var fn50man = makeFn('Cargar espuma correcta en troqueladora');
  var fail50mat = makeFail('Espuma de tipo o espesor incorrecto cargada',
    'Pieza con espesor inadecuado',
    'Ensamble con gap o exceso de material',
    'Confort alterado, posible Squeak & Rattle');
  fail50mat.causes.push(makeCause('Operador selecciona rollo de espuma equivocado', 5, 3, 5, { prev: 'Identificacion visual de rollos por color/codigo', det: 'Verificacion de espesor con calibre post-troquelado' }));
  fn50man.failures.push(fail50mat);
  we50man.functions.push(fn50man);
  op50new.workElements.push(we50man);
  newOps.push(op50new);

  // OP 60: ENSAMBLE SUSTRATO + ESPUMA - NEW
  var op60new = makeNewOp(60, 'ENSAMBLE SUSTRATO + ESPUMA', focusFn);
  var we60machine = makeWE('Maquina: Dispositivo de ensamble');
  var fn60 = makeFn('Unir sustrato inyectado con espuma troquelada');
  var fail60 = makeFail('Desalineacion sustrato-espuma',
    'Piezas mal posicionadas en dispositivo',
    'Adhesivado posterior sobre superficie desalineada',
    'Bulto o deformacion visible en pieza terminada');
  fail60.causes.push(makeCause('Dispositivo de ensamble descentrado o desgastado', 5, 3, 5, { prev: 'Verificacion de dispositivo al inicio de turno', det: 'Inspeccion visual de alineacion post-ensamble' }));
  fn60.failures.push(fail60);
  we60machine.functions.push(fn60);
  op60new.workElements.push(we60machine);
  newOps.push(op60new);

  // OP 70: ADHESIVADO - merge old OP 60 + OP 70
  var op60old = getOp(60);
  var op70old = getOp(70);
  if (op60old || op70old) {
    var mergedAdh = {
      id: uid(),
      operationNumber: '70',
      operationName: 'ADHESIVADO',
      focusElementFunction: focusFn,
      linkedPfdStepId: '',
      workElements: [],
    };
    if (op60old) mergedAdh.workElements = mergedAdh.workElements.concat(op60old.workElements || []);
    if (op70old) mergedAdh.workElements = mergedAdh.workElements.concat(op70old.workElements || []);
    newOps.push(mergedAdh);
  }

  // OP 80: ALINEACION DE COSTURA (PRE-FIXING) - NEW
  var op80new = makeNewOp(80, 'ALINEACION DE COSTURA (PRE-FIXING)', focusFn);
  var we80 = makeWE('Maquina: Dispositivo de pre-fixing');
  var fn80 = makeFn('Alinear costura del vinilo sobre sustrato');
  var fail80 = makeFail('Costura desalineada respecto al sustrato',
    'Costura no centrada en la pieza',
    'Wrapping posterior con tension despareja',
    'Defecto estetico visible (costura torcida)');
  fail80.causes.push(makeCause('Posicionamiento incorrecto de la funda en dispositivo', 5, 4, 5, { prev: 'Instruccion de trabajo con fotos de posicionamiento', det: 'Autocontrol visual de alineacion' }));
  fn80.failures.push(fail80);
  we80.functions.push(fn80);
  op80new.workElements.push(we80);
  newOps.push(op80new);

  // OP 90: WRAPPING + EDGE FOLDING - NEW
  var op90new = makeNewOp(90, 'WRAPPING + EDGE FOLDING', focusFn);
  var we90 = makeWE('Maquina: Dispositivo de wrapping');
  var fn90 = makeFn('Plegar bordes del vinilo sobre sustrato');
  var fail90 = makeFail('Borde del vinilo no plegado correctamente (arruga o despegue)',
    'Vinilo no adhiere en zona de borde',
    'Borde se despega durante manipuleo posterior',
    'Desprendimiento de borde visible, pieza rechazada por cliente');
  fail90.causes.push(makeCause('Temperatura o presion del dispositivo fuera de rango', 5, 4, 5, { prev: 'Set up de parametros al inicio de turno', det: 'Inspeccion visual 100% de bordes plegados' }));
  fn90.failures.push(fail90);
  we90.functions.push(fn90);
  op90new.workElements.push(we90);
  newOps.push(op90new);

  // OP 100: SOLDADURA CON ULTRASONIDO - NEW
  var op100new = makeNewOp(100, 'SOLDADURA CON ULTRASONIDO', focusFn);
  var we100 = makeWE('Maquina: Dispositivo de ultrasonido');
  var fn100 = makeFn('Soldar componentes mediante ultrasonido');
  var fail100 = makeFail('Soldadura incompleta o debil',
    'Union no alcanza resistencia especificada',
    'Pieza se desarma durante ensamble en linea VW',
    'Desprendimiento de componente en campo, reclamo de garantia');
  fail100.causes.push(makeCause('Frecuencia o presion de ultrasonido fuera de parametro', 7, 3, 4, { prev: 'Verificacion de parametros con patrón de referencia', det: 'Ensayo de resistencia de soldadura (destructivo muestral)' }));
  fn100.failures.push(fail100);
  we100.functions.push(fn100);
  op100new.workElements.push(we100);
  newOps.push(op100new);

  // OP 110: TERMINACION - keep
  var op110 = getOp(110);
  if (op110) { op110.operationName = 'TERMINACION'; newOps.push(op110); }

  // CONTROL FINAL DE CALIDAD - enrich with Top Roll pattern (no OP number in PFD, but keep in AMFE for coverage)
  var op120old = getOp(120);
  var trCtrl = (trData.operations || []).find(function(o){ return o.operationName && o.operationName.indexOf('CONTROL FINAL') >= 0; });

  // Build enriched control final
  var ctrlFinal = {
    id: uid(),
    operationNumber: '125', // between 120(embalaje) — actually lets think... PFD has no OP# for this. But AMFE needs one. Use 115 (between 110 Terminacion and 120 Embalaje)
    operationName: 'CONTROL FINAL DE CALIDAD',
    focusElementFunction: focusFn,
    linkedPfdStepId: '',
    workElements: [],
  };
  // Actually, lets use OP 115 since it sits between Terminacion (110) and Embalaje (120)
  ctrlFinal.operationNumber = '115';

  // Keep old Control Final WEs if any
  if (op120old && op120old.workElements) {
    ctrlFinal.workElements = ctrlFinal.workElements.concat(op120old.workElements);
  }

  // Add enrichment: failures from Top Roll control final (adapted to IP PAD)
  // Only add if current control final has very few failures
  var currentFailCount = 0;
  ctrlFinal.workElements.forEach(function(we) {
    (we.functions || []).forEach(function(fn) {
      currentFailCount += (fn.failures || []).length;
    });
  });

  if (currentFailCount < 3) {
    // Add more WEs with failures
    var we_ctrl_visual = makeWE('Metodo: Inspeccion visual final');
    var fn_ctrl = makeFn('Detectar defectos esteticos y funcionales antes de embalaje');

    var fail_nc = makeFail('Pieza NO CONFORME no detectada (rayado, mancha, arruga)',
      'Defecto estetico pasa desapercibido en inspeccion',
      'Pieza defectuosa llega a embalaje y se envia al cliente',
      'Reclamo de calidad del cliente VW, posible paro de linea');
    fail_nc.causes.push(makeCause('Fatiga visual del inspector por jornada prolongada', 5, 5, 7, { prev: 'Rotacion de inspectores cada 2 horas', det: 'Auditoria de producto por Lider de Produccion' }));
    fn_ctrl.failures.push(fail_nc);

    var fail_id = makeFail('Pieza identificada incorrectamente (etiqueta equivocada)',
      'Etiqueta no corresponde a la variante inspeccionada',
      'Pieza enviada con identificacion erronea, conforme a PN equivocado',
      'Vehiculo con pieza de version incorrecta, reclamo de campo');
    fail_id.causes.push(makeCause('Inspector toma etiqueta de lote anterior', 7, 2, 3, { prev: 'Procedimiento de limpieza de etiquetas al cambio de lote', det: 'Verificacion cruzada etiqueta vs pieza fisica' }));
    fn_ctrl.failures.push(fail_id);

    var fail_transport = makeFail('Pieza con dano de manipuleo/transporte interno',
      'Rayadura o marca generada entre estaciones',
      'Pieza con dano cosmetico llega a embalaje',
      'Defecto estetico visible, rechazo del cliente');
    fail_transport.causes.push(makeCause('Separadores o protecciones insuficientes en medios de transporte', 5, 4, 6, { prev: 'Medios de transporte con separadores dedicados', det: 'Inspeccion visual de superficies expuestas' }));
    fn_ctrl.failures.push(fail_transport);

    we_ctrl_visual.functions.push(fn_ctrl);
    ctrlFinal.workElements.push(we_ctrl_visual);
  }
  newOps.push(ctrlFinal);

  // OP 120: EMBALAJE - move from old OP 130
  var op130 = getOp(130);
  if (op130) {
    op130.operationNumber = '120';
    op130.operationName = 'EMBALAJE DE PRODUCTO TERMINADO';
    op130.id = uid();
    newOps.push(op130);
  }

  // ─── Summary ────────────────────────────────────────────────────────────
  console.log('\n=== TRANSFORMACION ===');
  console.log('Operaciones antes:', oldOps.length);
  console.log('Operaciones despues:', newOps.length);
  console.log('\nNuevo flujo:');
  newOps.forEach(function(op) {
    var weCount = (op.workElements || []).length;
    var fc = 0, cc = 0;
    (op.workElements || []).forEach(function(we) {
      (we.functions || []).forEach(function(fn) {
        fc += (fn.failures || []).length;
        (fn.failures || []).forEach(function(f) { cc += (f.causes || []).length; });
      });
    });
    console.log('  OP ' + op.operationNumber + ' : ' + op.operationName + ' | WEs:' + weCount + ' F:' + fc + ' C:' + cc);
  });

  // Ops eliminated
  var eliminated = ['50', '80', '90', '100'];
  console.log('\nEliminadas:');
  eliminated.forEach(function(num) {
    var old = getOp(num);
    if (old) console.log('  OP ' + num + ' : ' + old.operationName + ' (datos preservados en operaciones fusionadas o no aplican al PFD nuevo)');
  });

  console.log('\nMode:', DRY_RUN ? 'DRY-RUN' : 'APPLY');

  if (DRY_RUN) {
    console.log('\nDry-run complete. Use --apply to write.');
    process.exit(0);
  }

  // ─── Write ────────────────────────────────────────────────────────────
  d.operations = newOps;

  // Recalc metadata
  var totalCauses = 0;
  var apHCount = 0, apMCount = 0;
  newOps.forEach(function(op) {
    (op.workElements || []).forEach(function(we) {
      (we.functions || []).forEach(function(fn) {
        (fn.failures || []).forEach(function(f) {
          (f.causes || []).forEach(function(c) {
            totalCauses++;
            if (c.actionPriority === 'H') apHCount++;
            if (c.actionPriority === 'M') apMCount++;
          });
        });
      });
    });
  });

  var updateRow = {
    data: d,
    operation_count: newOps.length,
    cause_count: totalCauses,
    ap_h_count: apHCount,
    ap_m_count: apMCount,
  };

  var writeRes = await sb.from('amfe_documents').update(updateRow).eq('id', IPPAD_ID);
  if (writeRes.error) { console.error('Write failed:', writeRes.error.message); process.exit(1); }
  console.log('Document updated');

  // Verify
  var verRes = await sb.from('amfe_documents').select('id, data, operation_count, cause_count').eq('id', IPPAD_ID).single();
  var vd = verRes.data.data;
  if (typeof vd === 'string') try { vd = JSON.parse(vd); } catch(e) {}

  var vOps = (vd.operations || []).length;
  var vCauses = verRes.data.cause_count;
  console.log('\nVerification:');
  console.log('  ops:', vOps + '/' + newOps.length, vOps === newOps.length ? 'OK' : 'MISMATCH');
  console.log('  causes:', vCauses);
  console.log('  double-serial:', typeof vd === 'string' ? 'BAD' : 'No');

  console.log('\nAMFE IP PAD transformado exitosamente.');
}

main().catch(function(err) { console.error(err); process.exit(1); });
