/**
 * createInjectionCpMaster.mjs
 *
 * Crea el Plan de Control Maestro preliminar de Inyeccion Plastica:
 *  - cp_documents: nuevo documento con header + items generados desde el AMFE
 *  - family_documents: link a familia 15 (Proceso de Inyeccion Plastica) module='cp', is_master=1
 *
 * Fuente: AMFE-MAESTRO-INY-001 (document_id 4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c)
 *
 * Reglas aplicadas:
 *  - Filas de proceso (1 por causa AP=H/M o AP=L con CC/SC): processCharacteristic = causa,
 *    productCharacteristic = vacio, evaluationTechnique = vacio (AIAG-VDA prohibido en filas
 *    de prevencion), controlMethod = preventionControl combinado.
 *  - Filas de producto (1 por modo de falla): productCharacteristic = falla, processCharacteristic
 *    = vacio, evaluationTechnique = detectionControl combinado, controlMethod = vacio.
 *  - Fila generica AP=L (1 por operacion).
 *  - + 11 controles manuales especificos de inyeccion (GUIA_INYECCION seccion 10).
 *  - data column es TEXT en Supabase: JSON.stringify al escribir, JSON.parse al leer.
 *  - NUNCA "Visual" en machineDeviceTool (regla CP).
 *  - componentMaterial solo en items de recepcion OP <= 10.
 *  - reactionPlanOwner siempre rol generico (no nombre).
 *  - specialChar siempre vacio (no asignar CC/SC sin autorizacion).
 *  - reactionPlan referencia P-09/I, P-10/I o P-14 segun categoria.
 *  - approvedBy != plantApproval (regla B7 cpPreSaveValidation).
 *  - Pre-existence check antes de insert.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

// ── Supabase connection ────────────────────────────────────────────────────
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const MASTER_AMFE_ID = '4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c';
const FAMILY_ID = 15;
const CP_NUMBER = 'CP-MAESTRO-INY-001';

// ── Pre-existence check ────────────────────────────────────────────────────
console.log('1. Pre-existence check...');

const { data: existingByNumber, error: e1 } = await sb
  .from('cp_documents')
  .select('id, control_plan_number')
  .eq('control_plan_number', CP_NUMBER);

if (e1) { console.error('ERROR query cp_documents:', e1); process.exit(1); }

if (existingByNumber && existingByNumber.length > 0) {
  console.error(`ABORT: Ya existe un cp_document con control_plan_number=${CP_NUMBER}:`, existingByNumber);
  process.exit(1);
}

const { data: existingFamilyLink, error: e2 } = await sb
  .from('family_documents')
  .select('id, family_id, module, document_id, is_master')
  .eq('family_id', FAMILY_ID)
  .eq('module', 'cp');

if (e2) { console.error('ERROR query family_documents:', e2); process.exit(1); }

if (existingFamilyLink && existingFamilyLink.length > 0) {
  console.error(`ABORT: Ya existe un link cp en family_id=${FAMILY_ID}:`, existingFamilyLink);
  process.exit(1);
}

console.log('   OK: no hay duplicados, podemos crear.');

// ── Leer AMFE Maestro ──────────────────────────────────────────────────────
console.log('2. Leyendo AMFE maestro de inyeccion...');

const { data: amfeRow, error: e3 } = await sb
  .from('amfe_documents')
  .select('id, data')
  .eq('id', MASTER_AMFE_ID)
  .single();

if (e3 || !amfeRow) { console.error('ERROR leyendo AMFE maestro:', e3); process.exit(1); }

let amfeData;
const rawData = amfeRow.data;
if (typeof rawData === 'string') {
  amfeData = JSON.parse(rawData);
} else if (typeof rawData === 'object' && rawData !== null) {
  amfeData = rawData;
} else {
  console.error('ERROR: tipo inesperado de data', typeof rawData);
  process.exit(1);
}

if (!Array.isArray(amfeData.operations)) {
  console.error('ERROR: amfeData.operations no es array');
  process.exit(1);
}

console.log(`   OK: AMFE leido. ${amfeData.operations.length} operaciones.`);

// ── Helpers ────────────────────────────────────────────────────────────────
function normalizeForKey(s) {
  return (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function buildProcessKey(opNumber, causeText) {
  return JSON.stringify([normalizeForKey(opNumber), normalizeForKey(causeText)]);
}

function buildProductKey(opNumber, failDesc) {
  return JSON.stringify([normalizeForKey(opNumber), normalizeForKey(failDesc)]);
}

function inferOperationCategory(opName) {
  if (!opName) return '';
  const n = opName.toLowerCase();
  if (/recep|almac/.test(n)) return 'recepcion';
  if (/inyecc|mold/.test(n)) return 'inyeccion';
  if (/inspecc|control.*calidad|control.*dimensional|desmolde|corte.*colada/.test(n)) return 'inspeccion';
  return '';
}

function inferControlProcedure(category) {
  if (!category) return 'Según P-09/I.';
  if (category === 'recepcion' || category === 'almacen') return 'P-14.';
  return 'Según P-09/I.';
}

function inferReactionPlanOwner(severity, ap, category) {
  const cat = (category || '').toLowerCase();
  if (cat === 'recepcion') {
    if (severity >= 9 || ap === 'H') return 'Supervisor de Calidad';
    if (severity >= 7) return 'Inspector de Calidad';
    return 'Recepcion de Materiales';
  }
  if (severity >= 9 || ap === 'H') {
    if (cat === 'inspeccion') return 'Supervisor de Calidad';
    return 'Lider de Produccion / Calidad';
  }
  if (severity >= 7) return 'Lider de Produccion';
  return 'Operador de Produccion';
}

function inferReactionPlan(severity, category) {
  const sgcRef = (category === 'recepcion') ? 's/ P-14' : 's/ P-09/I';
  if (severity >= 9) return `Detener linea, segregar producto, escalar a Gerencia, ${sgcRef}.`;
  if (severity >= 7) return `Contener producto sospechoso, verificar ultimas piezas, corregir proceso ${sgcRef}.`;
  if (severity >= 4) return `Ajustar proceso, reinspeccionar ultimo lote ${sgcRef}.`;
  return `Verificar proceso ${sgcRef}.`;
}

// AIAG: especificacion concreta o vacia (no generica)
function inferSpecProcess(causeText) {
  const d = (causeText || '').toLowerCase();
  if (/temperatura/.test(d)) return 'Rango de temperatura segun dossier de parametros del producto';
  if (/tiempo|ciclo/.test(d)) return 'Tiempos de ciclo segun dossier de parametros';
  if (/presi/.test(d)) return 'Presion segun dossier de parametros';
  if (/refriger/.test(d)) return 'Flujo de agua > 0 L/min, temperatura estable';
  if (/cierre|fuerza/.test(d)) return 'Fuerza de cierre segun dossier del producto';
  if (/secad|humeda|tolva/.test(d)) return 'Tiempo y temperatura de secado segun ficha tecnica del material (ABS 80C/2-4h, PC 120C/2-4h, PET 120-150C/4-6h)';
  if (/dossier|parametr|set.?up/.test(d)) return 'Segun dossier de parametros validado por Ingenieria';
  if (/contamina|filtro/.test(d)) return 'Filtro limpio, sin obstruccion visible';
  if (/molde|sucio|limpieza/.test(d)) return 'Molde limpio, sin restos visibles, sin dano';
  if (/materia.*prima|material|pellet|certificado|proveedor|lote/.test(d)) return 'Certificado del proveedor con lote, tipo de material y fecha';
  if (/color/.test(d)) return 'Color/masterbatch segun OP del producto';
  return 'TBD - referirse al dossier del producto';
}

function inferSpecProduct(failDesc) {
  const d = (failDesc || '').toLowerCase();
  if (/dimensional|fuera.*medida|tolerancia/.test(d)) return 'Tolerancia segun plano del producto (referencia en dossier)';
  if (/rebaba|flash/.test(d)) return 'Sin rebabas visibles, comparar con pieza patron';
  if (/quemadu/.test(d)) return 'Sin quemaduras, comparar con pattern board';
  if (/falta.*llena|llenado|pieza incompleta/.test(d)) return 'Pieza completa segun pieza patron';
  if (/chupad|rechup|sink/.test(d)) return 'Sin rechupes superficiales visibles';
  if (/deform/.test(d)) return 'Sin deformaciones, geometria conforme a plano';
  if (/color|aspecto|apariencia|visual/.test(d)) return 'Color y aspecto conforme a muestra maestra bajo luz controlada';
  if (/contamina|suciedad/.test(d)) return 'Pieza libre de contaminacion visual';
  if (/orifici|tap/.test(d)) return 'Orificios libres y completos segun plano';
  if (/desprend|adhesi/.test(d)) return 'Adhesion completa entre componentes';
  return 'Conforme a pieza patron y plano del producto';
}

// ── Fase 1: Recolectar causas ──────────────────────────────────────────────
console.log('3. Recolectando causas del AMFE...');

const qualifying = [];
const lowApByOp = new Map();
let totalCauses = 0;
const opMap = new Map();

for (const op of (amfeData.operations || [])) {
  const opNumber = op.opNumber || op.operationNumber || '';
  const opName = op.name || op.operationName || '';
  opMap.set(opNumber, { id: op.id, name: opName });

  for (const we of (op.workElements || [])) {
    for (const func of (we.functions || [])) {
      for (const fail of (func.failures || [])) {
        for (const cause of (fail.causes || [])) {
          totalCauses++;
          const severity = Number(fail.severity) || Number(cause.severity) || 0;
          const ap = cause.actionPriority || cause.ap || '';
          const causeText = cause.cause || cause.description || '';
          const autoSpecialChar = ''; // Regla: NO asignar CC/SC sin autorizacion

          const ctx = { op, opNumber, opName, we, func, fail, cause, severity, causeText, ap, autoSpecialChar };

          if (ap === 'H' || ap === 'M') {
            qualifying.push(ctx);
          } else if (ap === 'L') {
            const grp = lowApByOp.get(opNumber) || [];
            grp.push(ctx);
            lowApByOp.set(opNumber, grp);
          }
        }
      }
    }
  }
}

console.log(`   Total causas: ${totalCauses}`);
console.log(`   Calificadas (AP=H/M): ${qualifying.length}`);
console.log(`   AP=L agrupadas: ${[...lowApByOp.values()].reduce((a,g)=>a+g.length,0)} causas en ${lowApByOp.size} ops`);

// ── Fase 2: Filas de PROCESO (prevencion) ──────────────────────────────────
console.log('4. Construyendo filas de PROCESO...');

const items = [];
const processGroups = new Map();

for (const q of qualifying) {
  const key = buildProcessKey(q.opNumber, q.causeText);
  const grp = processGroups.get(key) || [];
  grp.push(q);
  processGroups.set(key, grp);
}

function pickHighestAp(group) {
  if (group.some(g => g.ap === 'H')) return 'H';
  if (group.some(g => g.ap === 'M')) return 'M';
  return 'L';
}

function pickHighestSeverity(group) {
  return group.reduce((m, g) => Math.max(m, g.severity || 0), 0);
}

function pickMachine(opNumber, group) {
  // Buscar el WE tipo Machine de la operacion
  for (const g of group) {
    if (g.we?.type === 'Machine' && g.we.name) return g.we.name;
  }
  // Fallback: si la op es Inyeccion -> "Inyectora"
  const opName = group[0]?.opName || '';
  if (/inyecc/i.test(opName)) return 'Inyectora';
  if (/recep|secad|preparac/i.test(opName)) return 'Tolva secadora / Equipo de recepcion';
  if (/control|desmold|corte/i.test(opName)) return 'Estacion de control de calidad';
  return 'N/A';
}

function pickComponentMaterial(opNumber, group) {
  // Solo para operaciones de recepcion (OP 10)
  if (parseInt(opNumber, 10) > 10) return '';
  // Listar material indirecto/directo presente en el WE si aplica
  const matNames = new Set();
  for (const g of group) {
    if (g.we?.type === 'Material' && g.we.name) matNames.add(g.we.name);
  }
  if (matNames.size === 0) return 'Pellet termoplastico (ABS / PC / PA / PET / PP / PE)';
  return [...matNames].join(' / ');
}

function defaultsByAp(ap, severity) {
  if (ap === 'H') return { sampleSize: '100%', sampleFrequency: '100%' };
  if (ap === 'M') {
    if (severity >= 9) return { sampleSize: '1 pieza', sampleFrequency: 'Inicio y fin de turno' };
    return { sampleSize: '1 pieza', sampleFrequency: 'Cada lote' };
  }
  if (ap === 'L') return { sampleSize: '1 pieza por lote', sampleFrequency: 'Cada lote' };
  return { sampleSize: '', sampleFrequency: '' };
}

for (const [, group] of processGroups) {
  if (group.length === 0) continue;
  const rep = group[0];
  const highestAp = pickHighestAp(group);
  const highestSev = pickHighestSeverity(group);
  const opCategory = inferOperationCategory(rep.opName);
  const defaults = defaultsByAp(highestAp, highestSev);

  const causeIds = [...new Set(group.map(g => g.cause.id))];
  const failureIds = [...new Set(group.map(g => g.fail.id))];
  const controlMethod = [...new Set(group.map(g => (g.cause.preventionControl || '').trim()).filter(Boolean))].join(' / ');

  items.push({
    id: randomUUID(),
    processStepNumber: String(rep.opNumber),
    processDescription: rep.opName,
    machineDeviceTool: pickMachine(rep.opNumber, group),
    componentMaterial: pickComponentMaterial(rep.opNumber, group),
    characteristicNumber: '',
    productCharacteristic: '',
    processCharacteristic: rep.causeText,
    specialCharClass: '',
    specification: inferSpecProcess(rep.causeText),
    evaluationTechnique: '',  // VACIO en filas de proceso (AIAG-VDA)
    sampleSize: defaults.sampleSize,
    sampleFrequency: defaults.sampleFrequency,
    controlMethod: controlMethod || 'TBD - definir control de prevencion con el equipo APQP',
    reactionPlan: inferReactionPlan(highestSev, opCategory),
    reactionPlanOwner: inferReactionPlanOwner(highestSev, highestAp, opCategory),
    controlProcedure: inferControlProcedure(opCategory),
    autoFilledFields: ['sampleSize', 'sampleFrequency', 'reactionPlan', 'reactionPlanOwner', 'controlProcedure', 'specification'],
    amfeAp: highestAp,
    amfeSeverity: highestSev,
    operationCategory: opCategory,
    amfeCauseIds: causeIds,
    amfeFailureId: rep.fail.id,
    amfeFailureIds: failureIds,
  });
}

console.log(`   ${items.length} filas de proceso generadas`);

// ── Fase 3: Filas de PRODUCTO (deteccion) ──────────────────────────────────
console.log('5. Construyendo filas de PRODUCTO...');

const productGroups = new Map();
for (const q of qualifying) {
  const failDesc = q.fail.description || '';
  const key = buildProductKey(q.opNumber, failDesc);
  const grp = productGroups.get(key) || [];
  grp.push(q);
  productGroups.set(key, grp);
}

const beforeProduct = items.length;
for (const [, group] of productGroups) {
  if (group.length === 0) continue;
  const rep = group[0];
  const highestAp = pickHighestAp(group);
  const highestSev = pickHighestSeverity(group);
  const opCategory = inferOperationCategory(rep.opName);
  const defaults = defaultsByAp(highestAp, highestSev);

  const causeIds = [...new Set(group.map(g => g.cause.id))];
  const failureIds = [...new Set(group.map(g => g.fail.id))];
  const detectionTech = [...new Set(group.map(g => (g.cause.detectionControl || '').trim()).filter(Boolean))].join(' / ');

  items.push({
    id: randomUUID(),
    processStepNumber: String(rep.opNumber),
    processDescription: rep.opName,
    machineDeviceTool: pickMachine(rep.opNumber, group),
    componentMaterial: pickComponentMaterial(rep.opNumber, group),
    characteristicNumber: '',
    productCharacteristic: rep.fail.description || '',
    processCharacteristic: '',
    specialCharClass: '',
    specification: inferSpecProduct(rep.fail.description || ''),
    evaluationTechnique: detectionTech || 'TBD - definir tecnica de deteccion con el equipo APQP',
    sampleSize: defaults.sampleSize,
    sampleFrequency: defaults.sampleFrequency,
    controlMethod: '',  // VACIO en filas de producto
    reactionPlan: inferReactionPlan(highestSev, opCategory),
    reactionPlanOwner: inferReactionPlanOwner(highestSev, highestAp, opCategory),
    controlProcedure: inferControlProcedure(opCategory),
    autoFilledFields: ['sampleSize', 'sampleFrequency', 'reactionPlan', 'reactionPlanOwner', 'controlProcedure', 'specification'],
    amfeAp: highestAp,
    amfeSeverity: highestSev,
    operationCategory: opCategory,
    amfeCauseIds: causeIds,
    amfeFailureId: rep.fail.id,
    amfeFailureIds: failureIds,
  });
}

console.log(`   ${items.length - beforeProduct} filas de producto generadas`);

// ── Fase 3.5: Filas genericas AP=L (1 por operacion) ───────────────────────
console.log('6. Generando filas genericas AP=L...');

const beforeGeneric = items.length;
for (const [opNumber, group] of lowApByOp) {
  if (group.length === 0) continue;
  const rep = group[0];
  const opCategory = inferOperationCategory(rep.opName);
  const causeIds = [...new Set(group.map(g => g.cause.id))];
  const failureIds = [...new Set(group.map(g => g.fail.id))];
  const maxSev = pickHighestSeverity(group);

  items.push({
    id: randomUUID(),
    processStepNumber: String(opNumber),
    processDescription: rep.opName,
    machineDeviceTool: pickMachine(opNumber, group),
    componentMaterial: parseInt(opNumber, 10) <= 10 ? pickComponentMaterial(opNumber, group) : '',
    characteristicNumber: '',
    productCharacteristic: '',
    processCharacteristic: 'Autocontrol visual general',
    specialCharClass: '',
    specification: 'Segun instruccion de trabajo / HO de la operacion',
    evaluationTechnique: 'Inspeccion visual',
    sampleSize: '1 pieza por lote',
    sampleFrequency: 'Cada lote',
    controlMethod: 'Autocontrol del operador segun instruccion de trabajo',
    reactionPlan: inferReactionPlan(maxSev, opCategory),
    reactionPlanOwner: 'Operador de Produccion',
    controlProcedure: inferControlProcedure(opCategory),
    autoFilledFields: ['sampleSize', 'sampleFrequency', 'reactionPlan', 'reactionPlanOwner', 'controlProcedure'],
    amfeAp: 'L',
    amfeSeverity: maxSev,
    operationCategory: opCategory,
    amfeCauseIds: causeIds,
    amfeFailureId: rep.fail.id,
    amfeFailureIds: failureIds,
  });
}

console.log(`   ${items.length - beforeGeneric} filas genericas AP=L`);

// ── Items manuales especificos de inyeccion (GUIA_INYECCION seccion 10) ────
console.log('7. Agregando 11 items manuales especificos de inyeccion...');

function findOpName(opNumber) {
  const o = opMap.get(String(opNumber));
  if (o) return o.name;
  if (opNumber === '10') return 'PREPARACION Y SECADO DE MATERIAL';
  if (opNumber === '20') return 'INYECCION';
  if (opNumber === '30') return 'CONTROL A PIE DE MAQUINA / DESMOLDEO';
  return '';
}

const manualItems = [
  // OP 10
  {
    op: '10',
    machine: 'Tolva secadora',
    material: 'Pellet higroscopico (ABS / PC / PA / PET)',
    processChar: 'Temperatura de tolva secadora',
    spec: 'Segun ficha tecnica del material: ABS 80 C / PC 120 C / PA 80 C / PET 120-150 C',
    sampleSize: '1 lectura',
    sampleFrequency: 'Al arranque + cambio de turno',
    controlMethod: 'Lectura de panel de tolva secadora vs ficha del material',
    owner: 'Operador de Produccion',
    severity: 7,
  },
  {
    op: '10',
    machine: 'Tolva secadora',
    material: 'Pellet higroscopico (ABS / PC / PA / PET)',
    processChar: 'Tiempo de secado del pellet',
    spec: 'Segun ficha tecnica del material (2-6 horas segun tipo)',
    sampleSize: '1 lote',
    sampleFrequency: 'Por carga de material',
    controlMethod: 'Cronometraje + registro de carga vs ficha del material',
    owner: 'Operador de Produccion',
    severity: 7,
  },
  {
    op: '10',
    machine: 'Estacion de recepcion de materiales',
    material: 'Pellet termoplastico (todos los tipos)',
    processChar: 'Certificado del proveedor del lote',
    spec: 'Documento del proveedor con lote, tipo de material, fecha de fabricacion y resultados de ensayos',
    sampleSize: '1 documento',
    sampleFrequency: 'Por lote recibido',
    controlMethod: 'Inspeccion documental del certificado en recepcion',
    owner: 'Recepcion de Materiales',
    severity: 8,
    customReaction: 'Segregar lote, notificar a Calidad s/ P-14.',
  },
  // OP 20
  {
    op: '20',
    machine: 'Inyectora',
    material: '',
    processChar: 'Flujo de refrigeracion del tornillo (garganta)',
    spec: 'Flujo > 0 L/min, temperatura del agua estable segun dossier',
    sampleSize: '1 lectura',
    sampleFrequency: 'Al arranque + durante produccion',
    controlMethod: 'Verificacion manual del circuito + lectura de panel',
    owner: 'Operador de Produccion',
    severity: 8,
  },
  {
    op: '20',
    machine: 'Inyectora',
    material: '',
    processChar: 'Parametros de proceso vs dossier del producto',
    spec: 'Parametros conformes al dossier del producto especifico validado por Ingenieria',
    sampleSize: '1 ciclo',
    sampleFrequency: 'Al arranque + cambio de lote',
    controlMethod: 'Comparacion checklist de parametros de panel vs dossier del producto',
    owner: 'Lider de Produccion',
    severity: 7,
  },
  {
    op: '20',
    machine: 'Inyectora',
    material: '',
    processChar: 'Fuerza de cierre de la inyectora',
    spec: 'Fuerza de cierre segun dossier del producto',
    sampleSize: '1 lectura',
    sampleFrequency: 'Al arranque',
    controlMethod: 'Lectura de panel de la inyectora',
    owner: 'Operador de Produccion',
    severity: 7,
  },
  {
    op: '20',
    machine: 'Aspiradora de carga / sistema neumatico',
    material: '',
    processChar: 'Filtro de aspiradora',
    spec: 'Filtro limpio, sin obstruccion visible',
    sampleSize: '1 inspeccion',
    sampleFrequency: 'Al arranque',
    controlMethod: 'Inspeccion visual + soplado del filtro',
    owner: 'Operador de Produccion',
    severity: 5,
  },
  // OP 30
  {
    op: '30',
    machine: 'Calibre / gauge dimensional',
    material: '',
    productChar: 'Dimensional de pieza inyectada',
    spec: 'Tolerancia segun plano del producto (referencia en dossier del producto)',
    evaluationTechnique: 'Calibre / gauge dimensional calibrado',
    sampleSize: 'TBD - muestreo por lote (pendiente definir con Metrologia)',
    sampleFrequency: 'TBD - por lote',
    owner: 'Metrologia',
    severity: 7,
  },
  {
    op: '30',
    machine: 'Estacion de control de calidad',
    material: '',
    productChar: 'Inspeccion visual 100% defectos tipicos',
    spec: 'Sin rebabas, sin quemaduras, sin faltas de llenado, sin chupados, sin dimensional visualmente NOK',
    evaluationTechnique: 'Inspeccion visual con pattern board de defectos tipicos',
    sampleSize: '100%',
    sampleFrequency: 'Cada pieza',
    owner: 'Operador de Produccion',
    severity: 7,
  },
  {
    op: '30',
    machine: 'Estacion de mantenimiento de molde',
    material: '',
    processChar: 'Limpieza de molde al bajarlo',
    spec: 'Limpieza interna (canales de refrigeracion soplados) + externa (superficies) + lubricacion ambas caras + inspeccion visual',
    sampleSize: '1 inspeccion',
    sampleFrequency: 'Al bajar molde',
    controlMethod: 'Checklist de limpieza y lubricacion al bajar molde',
    owner: 'Lider de Produccion',
    severity: 6,
  },
  {
    op: '30',
    machine: 'Plan de mantenimiento de molde',
    material: '',
    processChar: 'Mantenimiento preventivo de molde',
    spec: 'Segun plan de mantenimiento del molde especifico (por contador de golpes / horas)',
    sampleSize: '1 registro',
    sampleFrequency: 'Por contador de golpes / horas',
    controlMethod: 'Registro de golpes / horas vs plan de mantenimiento del molde',
    owner: 'Mantenimiento',
    severity: 7,
  },
];

const beforeManual = items.length;

for (const m of manualItems) {
  const opCategory = inferOperationCategory(findOpName(m.op));
  const reactionPlan = m.customReaction || inferReactionPlan(m.severity, opCategory);

  items.push({
    id: randomUUID(),
    processStepNumber: m.op,
    processDescription: findOpName(m.op),
    machineDeviceTool: m.machine,
    componentMaterial: m.material || '',
    characteristicNumber: '',
    productCharacteristic: m.productChar || '',
    processCharacteristic: m.processChar || '',
    specialCharClass: '',
    specification: m.spec,
    evaluationTechnique: m.productChar ? (m.evaluationTechnique || '') : '',
    sampleSize: m.sampleSize,
    sampleFrequency: m.sampleFrequency,
    controlMethod: m.processChar ? (m.controlMethod || '') : '',
    reactionPlan,
    reactionPlanOwner: m.owner,
    controlProcedure: inferControlProcedure(opCategory),
    autoFilledFields: ['manualControl'],
    amfeAp: '',
    amfeSeverity: m.severity,
    operationCategory: opCategory,
    amfeCauseIds: [],
    amfeFailureId: undefined,
    amfeFailureIds: [],
  });
}

console.log(`   ${items.length - beforeManual} items manuales agregados`);

// ── Fase 4: Ordenar ────────────────────────────────────────────────────────
console.log('8. Ordenando items...');

items.sort((a, b) => {
  const numA = parseInt(a.processStepNumber, 10) || 0;
  const numB = parseInt(b.processStepNumber, 10) || 0;
  if (numA !== numB) return numA - numB;
  // Dentro de la misma operacion: proceso primero, luego producto, luego AP=L generico
  // Manual items se mezclan por su tipo (proceso o producto)
  const typeA = a.processCharacteristic ? 0 : (a.productCharacteristic ? 1 : 2);
  const typeB = b.processCharacteristic ? 0 : (b.productCharacteristic ? 1 : 2);
  return typeA - typeB;
});

// ── Stats finales ───────────────────────────────────────────────────────────
const itemsByOp = {};
const ccCount = items.filter(i => i.specialCharClass === 'CC').length;
const scCount = items.filter(i => i.specialCharClass === 'SC').length;
const stdCount = items.filter(i => !i.specialCharClass).length;

for (const it of items) {
  itemsByOp[it.processStepNumber] = (itemsByOp[it.processStepNumber] || 0) + 1;
}

// ── Build header ────────────────────────────────────────────────────────────
const header = {
  controlPlanNumber: CP_NUMBER,
  phase: 'preLaunch',
  partNumber: '',
  latestChangeLevel: 'A',
  partName: 'Proceso de Inyeccion Plastica - Maestro',
  applicableParts: 'Aplicable a todas las piezas inyectadas termoplasticas en BARACK MERCOSUL',
  organization: 'BARACK MERCOSUL',
  supplier: '',
  supplierCode: '',
  keyContactPhone: '',
  date: '2026-04-10',
  revision: '1',
  responsible: 'Carlos Baptista',
  approvedBy: 'Carlos Baptista',
  plantApproval: 'Gonzalo Cal',
  client: '',
  coreTeam: 'Carlos Baptista (Ingenieria), Manuel Meszaros (Calidad), Marianna Vera (Produccion)',
  customerApproval: '',
  otherApproval: '',
  linkedAmfeProject: 'MAESTRO/INYECCION_PLASTICA',
};

const cpData = { header, items };

// ── Stats AMFE ──────────────────────────────────────────────────────────────
const apHCount = qualifying.filter(q => q.ap === 'H').length;
const apMCount = qualifying.filter(q => q.ap === 'M').length;

console.log('\n═══════════════════════════════════════════════════');
console.log('STATS PRE-INSERT');
console.log('═══════════════════════════════════════════════════');
console.log(`  Total items CP:       ${items.length}`);
console.log(`  Items por operacion:  ${JSON.stringify(itemsByOp)}`);
console.log(`  Items manuales:       ${manualItems.length}`);
console.log(`  AMFE causas totales:  ${totalCauses}`);
console.log(`  AMFE AP=H causas:     ${apHCount}`);
console.log(`  AMFE AP=M causas:     ${apMCount}`);
console.log(`  Clasif CC:            ${ccCount}`);
console.log(`  Clasif SC:            ${scCount}`);
console.log(`  Clasif estandar:      ${stdCount}`);

// ── Insert ──────────────────────────────────────────────────────────────────
const docId = randomUUID();
console.log('\n9. Insertando cp_documents...');
console.log(`   docId: ${docId}`);

const insertPayload = {
  id: docId,
  project_name: 'MAESTRO/INYECCION_PLASTICA',
  control_plan_number: CP_NUMBER,
  phase: 'preLaunch',
  part_number: '',
  part_name: 'Proceso de Inyeccion Plastica - Maestro',
  organization: 'BARACK MERCOSUL',
  client: '',
  responsible: 'Carlos Baptista',
  revision: '1',
  revision_level: 'A',
  last_revision_at: '2026-04-10',
  linked_amfe_project: 'MAESTRO/INYECCION_PLASTICA',
  linked_amfe_id: MASTER_AMFE_ID,
  item_count: items.length,
  data: JSON.stringify(cpData),  // TEXT column
};

const { error: insErr } = await sb
  .from('cp_documents')
  .insert(insertPayload);

if (insErr) {
  console.error('ERROR insertando cp_documents:', insErr);
  process.exit(1);
}
console.log('   OK: cp_documents insertado');

// ── Insert family link ──────────────────────────────────────────────────────
console.log('10. Insertando family_documents link...');

const { data: linkResp, error: linkErr } = await sb
  .from('family_documents')
  .insert({
    family_id: FAMILY_ID,
    module: 'cp',
    document_id: docId,
    is_master: 1,
    source_master_id: null,
    product_id: null,
  })
  .select('id')
  .single();

if (linkErr) {
  console.error('ERROR insertando family_documents:', linkErr);
  process.exit(1);
}
console.log(`   OK: family_documents link id=${linkResp.id}`);

// ── Verificacion post-insert ────────────────────────────────────────────────
console.log('\n11. Verificacion post-insert...');

const { data: verify, error: verifyErr } = await sb
  .from('cp_documents')
  .select('id, control_plan_number, item_count, data')
  .eq('id', docId)
  .single();

if (verifyErr) { console.error('ERROR verificando:', verifyErr); process.exit(1); }

const isString = typeof verify.data === 'string';
let parsed;
try {
  parsed = isString ? JSON.parse(verify.data) : verify.data;
} catch (e) {
  console.error('ERROR: data no parseable', e.message);
  process.exit(1);
}

const itemsArray = Array.isArray(parsed?.items);
const itemsCount = itemsArray ? parsed.items.length : 0;

const { data: linkVerify, error: linkVerifyErr } = await sb
  .from('family_documents')
  .select('id, family_id, module, document_id, is_master')
  .eq('document_id', docId)
  .eq('module', 'cp')
  .single();

if (linkVerifyErr) { console.error('ERROR verificando link:', linkVerifyErr); process.exit(1); }

console.log('═══════════════════════════════════════════════════');
console.log('VERIFICACION');
console.log('═══════════════════════════════════════════════════');
console.log(`  cp_document.id:         ${verify.id}`);
console.log(`  control_plan_number:    ${verify.control_plan_number}`);
console.log(`  item_count (col):       ${verify.item_count}`);
console.log(`  typeof data:            ${typeof verify.data}  ${isString ? 'OK (TEXT)' : 'WARN'}`);
console.log(`  parsed.items isArray:   ${itemsArray ? 'OK' : 'FAIL'}`);
console.log(`  parsed.items.length:    ${itemsCount}`);
console.log(`  family_documents.id:    ${linkVerify.id}`);
console.log(`  family_id:              ${linkVerify.family_id}`);
console.log(`  module:                 ${linkVerify.module}`);
console.log(`  is_master:              ${linkVerify.is_master}`);
console.log('═══════════════════════════════════════════════════');
console.log('\nCP MAESTRO INYECCION CREADO EXITOSAMENTE');
console.log(`  doc_id: ${docId}`);
console.log(`  cp_number: ${CP_NUMBER}`);
console.log(`  family_link_id: ${linkVerify.id}`);
console.log(`  items: ${itemsCount}`);
process.exit(0);
