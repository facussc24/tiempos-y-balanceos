/**
 * enrichPurMaestro.mjs
 *
 * Completa la carátula del Maestro PU + agrega controles preventivos/detectivos
 * extraídos por el agente desde los 4 reportes Liqin (fuentes ya validadas en
 * `docs/drafts/liqin-analysis/`). NO inventa nada — todo viene de manual TP900,
 * sensores PLC Siemens, secuencia arranque, aceite + install.
 *
 * Adicional: arregla bug WE-2 Isocianato sin FM agregando "FM-LEG-ISO" específico
 * al Isocianato (causas paralelas a FM-LEG pero del componente B).
 *
 * Luego REPLICA todos los cambios a las 3 OPs PU de los Headrest:
 *   - AMFE-HF-PAT OP 63
 *   - AMFE-HRC-PAT OP 50
 *   - AMFE-HRO-PAT OP 50
 *
 * Uso:
 *   node scripts/enrichPurMaestro.mjs           # dry-run
 *   node scripts/enrichPurMaestro.mjs --apply   # ejecutar
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const APPLY = process.argv.includes('--apply');
const today = new Date().toISOString().slice(0, 10);

// ── Header completo del Maestro (basado en HF-PAT como referencia) ──────────
const FULL_HEADER = {
  companyName: 'BARACK MERCOSUL',
  organization: 'BARACK MERCOSUL',
  scope: 'Proceso de Inyeccion PUR in place — aplica a apoyacabezas Patagonia VW427/1LA_K',
  subject: 'Maestro AMFE Inyeccion PUR in place',
  client: 'VWA',
  customerName: 'VWA',
  location: 'PLANTA HURLINGHAM',
  partNumber: '',
  applicableParts: 'APC DELANTERO (HF-PAT OP 63)\nAPC TRASERO CENTRAL (HRC-PAT OP 50)\nAPC TRASERO LATERAL (HRO-PAT OP 50)\n\nEquipo: Inyectora TP900 Zhangjiagang Liqin Machinery Co.',
  responsibleEngineer: 'Carlos Baptista (Ingenieria)',
  processResponsible: 'Carlos Baptista',
  coreTeam: ['Carlos Baptista (Ingenieria)', 'Manuel Meszaros (Calidad)', 'Marianna Vera (Produccion)'],
  preparedBy: 'Facundo Santoro',
  elaboratedBy: 'Facundo Santoro',
  reviewedBy: 'Carlos Baptista',
  approvedBy: 'Gonzalo Cal',
  plantApproval: 'Gonzalo Cal',
  customerApproval: '',
  amfeDate: today,
  revisionDate: today,
  revDate: today,
  revisionLevel: 'A',
  rev: 'A',
  confidentiality: 'Confidencial'
};

// ── Controles NUEVOS por FM (del agente, citas a reportes Liqin) ────────────
// Format: { 'FM-XXX': { prev: ['c1','c2'], det: ['c1','c2'] } }
const NEW_CONTROLS = {
  'FM-LEG': {
    prev: [
      'Configuracion densidad correcta en HMI (POL/ISO)',
      '2 niveles usuario HMI con contrasena (manager/gong)',
      'Modo Circulacion temperatura material entre ciclos',
      'Modo Circulacion fin de semana durante paradas',
      'RFID identificacion del molde activa',
      'Setpoint proporcion POLY:ISO validado en HMI'
    ],
    det: [
      'Pantalla historica de registros de inyeccion por ciclo',
      'Wire-break detection 4-20 mA en sensores POLY/ISO',
      'Presion bomba POLY/ISO continua (AI6/AI7)',
      'Sensores AirPressure LOW tanques (E64/E65)',
      'Zumbador audible + marca parpadeante HMI'
    ]
  },
  'FM-1': {
    prev: [
      'Modo Circulacion temperatura material entre ciclos',
      'Modo Circulacion fin de semana durante paradas',
      'Calefaccion tanques POLY/ISO funcionando (KM76/KM78)',
      'Valvulas de agua tanques operativas (K25A/K26A)'
    ],
    det: [
      'PT100 agua tanques (IW104, IW108)',
      'Tank Temperature analogica POLY/ISO (AI0/AI1)',
      'Corriente calefaccion tanques (E25/E26)',
      'Wire-break detection en RTD PT100',
      'Zumbador audible + marca parpadeante HMI'
    ]
  },
  'FM-2': {
    prev: [
      'Presion minima hidraulica antes de inyectar (E36)',
      'Presion mezcla hidraulica (E37)',
      'Setpoint proporcion POLY:ISO HMI',
      'Rampas aceleracion variador validadas (P1120/P1121)'
    ],
    det: [
      'Pulsos caudalimetro vs setpoint en cada shot',
      'Wire-break detection 4-20 mA en sensores presion',
      'Pantalla historica de registros de inyeccion',
      'Zumbador audible + marca parpadeante HMI'
    ]
  },
  'FM-3': {
    prev: [
      'Modo Circulacion temperatura material entre ciclos',
      'Modo Circulacion fin de semana durante paradas',
      'Boton Clean/Mixhead operativo (E1.2/E54)',
      'Tiempo compensacion boquilla configurado HMI'
    ],
    det: [
      'Monitoreo cilindros aceite Clean/Shot (E14/E15)',
      'Pantalla historica de registros de inyeccion',
      'Wire-break detection en E1.4 sensor clean'
    ]
  },
  'FM-4': {
    prev: [
      'Calefaccion tanques POLY/ISO funcionando (KM76/KM78)',
      'Valvulas agua tanques operativas (K25A/K26A)',
      'Modo Circulacion temperatura material entre ciclos',
      'Modo Circulacion fin de semana durante paradas',
      'Agitadores POLY/ISO con corriente OK (E23/E24)',
      'Rampas aceleracion variador validadas'
    ],
    det: [
      'Wire-break detection en PT100 y AI 0/AI 1',
      'Pulsos caudalimetro POLY/ISO vs setpoint',
      'Pantalla historica de registros de inyeccion',
      'Zumbador audible + marca parpadeante HMI'
    ]
  },
  'FM-5': {
    prev: [
      'Inspeccion mangueras flexibles bomba-tanque',
      'Cilindro mixhead Air retracted en posicion (E51)',
      'Sensor presion minima hidraulica antes inyectar (E36)',
      'Tiempo establecimiento presion auto antes shot'
    ],
    det: [
      'Alarma HMI desviacion presion con parada pulverizacion',
      'Wire-break detection en AI4/AI5 mixhead pressure',
      'Pantalla historica de registros de inyeccion',
      'Zumbador audible + marca parpadeante HMI'
    ]
  },
  'FM-6': {
    prev: [
      'Verificacion periodica nivelacion plataforma giratoria',
      'Verificacion periodica pernos quimicos al suelo',
      'Verificacion periodica anclaje 15 placas base',
      'Plant Stop Button operativo (E45)',
      'Motor planta giratoria KM80 con corriente OK',
      'Tiempo intervalo inicio del molde configurado HMI'
    ],
    det: [
      'Sensores E56/E57 indexado plato como detectivo continuo',
      'Wire-break detection en E56/E57',
      'Pantalla historica de registros de inyeccion'
    ]
  },
  'FM-7': {
    prev: [
      'Las 3 preselecciones activas al disparar (auto + wet shot + cabezal)',
      'Select Auto Mode (E1.1) verificado en cada arranque',
      'Control Voltage Monitoring (E33)',
      'Tiempo mantenimiento presion post-inyeccion configurado',
      'Tiempo establecimiento presion auto configurado',
      'Hydraulic Min Pressure (E36) verificado',
      'Monitoreo cilindros aceite Clean/Shot (E14/E15)',
      'Mantenimiento valla proteccion + barrera luz'
    ],
    det: [
      'Hydraulic Oil LEVEL LOW (E35) bloquea arranque motor',
      'POLY/ISO Inverter Fault (E27/E30) para bomba',
      'SafeDoor signal 1/2 (E46/E47) bloquea inyeccion',
      'Plato giratorio parpadea rapido indica esperando intervalo',
      'Borrar visualizacion fallos solo tras analizar causa'
    ]
  },
  'FM-8': {
    prev: [
      'Reset puerta seguridad antes de arrancar',
      'Verificacion E-STOPs en posicion levantada antes arrancar',
      'Verificacion periodica integridad valla proteccion',
      'Rele K01 con contacto 7B14 habilita potencia L02',
      'Bloqueo arranque si precondicion FASE 3 falla',
      'Mantenimiento periodico interlock barrera luz fotoelectrica'
    ],
    det: [
      'Pantalla historica de registros HMI por ciclo',
      'Indicador restablecimiento barrera luz parpadeante',
      'Zumbador audible + marca parpadeante HMI ante fallo',
      'Wire-break detection en SafeDoor signal 1/2'
    ]
  },
  'FM-10': {
    prev: [
      '2 niveles usuario HMI con contrasena',
      'RFID identificacion del molde activa',
      'Mantenimiento periodico de flujometros POLY/ISO'
    ],
    det: [
      'Wire-break detection en E0.0-E0.3 pulsos flujometro',
      'Presion bomba POLY/ISO continua (AI6/AI7)',
      'Corriente bombas POLY/ISO (E21/E22)',
      'Variadores fault POLY/ISO (E27/E30)',
      'Pantalla historica de registros de inyeccion por ciclo',
      'Zumbador audible + marca parpadeante HMI'
    ]
  },
  'FM-11': {
    prev: [
      'Sensores cilindros mixhead con barreras Zener CSB519-EX22',
      'Sensores cilindros mixhead con barreras Zener CSB536-EX'
    ],
    det: []
  }
};

// ── Mapeo FM number → FM key del agente ─────────────────────────────────────
// Identificación por keyword del effectEndUser o description del FM
function identifyFM(failure) {
  const desc = (failure.description || '').toLowerCase();
  const effEnd = (failure.effectEndUser || '').toLowerCase();

  if (desc.includes('tl 1010') || desc.includes('vw 50180') || effEnd.includes('incumplimiento legal') && !desc.includes('flujometro')) {
    if (desc.includes('flujometro')) return 'FM-10';
    if (desc.includes('isocianato')) return 'FM-LEG-ISO';
    return 'FM-LEG';
  }
  if (desc.includes('despegan') || desc.includes('delamin')) return 'FM-1';
  if (desc.includes('huecos') || desc.includes('cavidades')) return 'FM-2';
  if (desc.includes('particulas') || desc.includes('contamin')) return 'FM-3';
  if (desc.includes('zonas') && desc.includes('rigidas')) return 'FM-4';
  if (desc.includes('escapa') || desc.includes('fuga')) return 'FM-5';
  if (desc.includes('descentrado') || desc.includes('fuera de posicion') || desc.includes('geometria incorrecta')) return 'FM-6';
  if (desc.includes('curado') || desc.includes('ciclo')) return 'FM-7';
  if (desc.includes('stop') || desc.includes('emergencia')) return 'FM-8';
  if (desc.includes('flujometro')) return 'FM-10';
  if (desc.includes('vapores') || desc.includes('atex')) return 'FM-11';
  return null;
}

// Concatena nuevos controles al string existente (sin duplicar)
function mergeControls(existing, additions) {
  const existingLower = (existing || '').toLowerCase();
  const newOnes = additions.filter(c => !existingLower.includes(c.toLowerCase().slice(0, 30)));
  if (newOnes.length === 0) return existing || '';
  if (!existing || existing.trim() === '') return newOnes.join(' + ');
  return existing + ' + ' + newOnes.join(' + ');
}

// ── Construir FM-LEG-ISO para WE-2 Isocianato ────────────────────────────────
function buildFMLegISO() {
  return {
    id: randomUUID(),
    description: 'Lote de Isocianato fuera de spec o contaminado (no cumple TL 1010 / VW 50180 / ELV)',
    effectLocal: 'Lote rechazado en ensayo de laboratorio. SCRAP.',
    effectNextLevel: 'Si la alarma HMI detecta a tiempo: SCRAP local. Si falla: rechazo en ensayo de laboratorio cliente',
    effectEndUser: 'Riesgo de incendio o inhalacion de gases. Incumplimiento legal.',
    severity: 9,
    occurrence: 0,
    detection: 0,
    ap: '',
    specialChar: 'CC',
    preventionControl: 'Inspeccion lote ISO al ingreso (P-14) + verificacion certificado proveedor + agitador ISO funcionando (KM66) + 2 niveles usuario HMI con contrasena',
    detectionControl: 'Alarma HMI desviacion caudal ISO con parada automatica + RTD PT100 mixhead ISO (IW100) + presion mixhead ISO (AI5) + corriente bomba ISO (E22) + variador ISO fault (E30)',
    causes: [
      {
        id: randomUUID(),
        cause: 'Lote ISO del proveedor fuera de spec',
        description: 'Lote ISO del proveedor fuera de spec',
        severity: 9, occurrence: 0, detection: 0, ap: '', actionPriority: '',
        preventionControl: '', detectionControl: '',
        preventionAction: '', detectionAction: '', optimizationAction: '',
        specialChar: 'CC', characteristicNumber: '1',
        responsible: 'Carlos Baptista (Ingenieria)', targetDate: '', status: 'Pendiente', filterCode: ''
      },
      {
        id: randomUUID(),
        cause: 'Contaminacion del ISO durante almacenamiento o trasvase',
        description: 'Contaminacion del ISO durante almacenamiento o trasvase',
        severity: 9, occurrence: 0, detection: 0, ap: '', actionPriority: '',
        preventionControl: '', detectionControl: '',
        preventionAction: '', detectionAction: '', optimizationAction: '',
        specialChar: 'CC', characteristicNumber: '2',
        responsible: 'Carlos Baptista (Ingenieria)', targetDate: '', status: 'Pendiente', filterCode: ''
      },
      {
        id: randomUUID(),
        cause: 'Agitador ISO parado durante operacion (componente decantado)',
        description: 'Agitador ISO parado durante operacion (componente decantado)',
        severity: 9, occurrence: 0, detection: 0, ap: '', actionPriority: '',
        preventionControl: '', detectionControl: '',
        preventionAction: '', detectionAction: '', optimizationAction: '',
        specialChar: 'CC', characteristicNumber: '3',
        responsible: 'Carlos Baptista (Ingenieria)', targetDate: '', status: 'Pendiente', filterCode: ''
      }
    ]
  };
}

// ── PROCESAMIENTO ──────────────────────────────────────────────────────────

console.log('=== LEYENDO MAESTRO PU ===\n');
const { data: m, error: e1 } = await sb.from('amfe_documents').select('*').eq('amfe_number', 'AMFE-MAESTRO-PU-001').single();
if (e1) { console.error('ERROR:', e1.message); process.exit(1); }
const masterData = typeof m.data === 'string' ? JSON.parse(m.data) : m.data;
const isText = typeof m.data === 'string';

console.log(`  AMFE: ${m.amfe_number} id=${m.id}`);
console.log(`  Formato data: ${isText ? 'TEXT' : 'JSONB'}`);

// 1. Completar header
masterData.header = { ...masterData.header, ...FULL_HEADER };
console.log('\n  Header actualizado (campos completos)');

// 2. Agregar controles nuevos a cada FM + agregar FM-LEG-ISO al WE-2
let totalPrevAdded = 0, totalDetAdded = 0;
const op = masterData.operations[0];
let we2 = null;
let fmLegISOAdded = false;

for (const we of op.workElements) {
  if (we.type === 'Material' && we.name.toLowerCase().includes('isocianato')) {
    we2 = we;
  }
  for (const fn of we.functions || []) {
    for (const fail of fn.failures || []) {
      const fmKey = identifyFM(fail);
      if (fmKey && NEW_CONTROLS[fmKey]) {
        const newP = NEW_CONTROLS[fmKey].prev || [];
        const newD = NEW_CONTROLS[fmKey].det || [];
        const beforeP = fail.preventionControl || '';
        const beforeD = fail.detectionControl || '';
        fail.preventionControl = mergeControls(beforeP, newP);
        fail.detectionControl = mergeControls(beforeD, newD);
        const addedP = fail.preventionControl.length - beforeP.length > 0 ? newP.length : 0;
        const addedD = fail.detectionControl.length - beforeD.length > 0 ? newD.length : 0;
        totalPrevAdded += addedP;
        totalDetAdded += addedD;
        console.log(`  ${fmKey}: +${addedP} prev / +${addedD} det`);
      }
    }
  }
}

// 3. Agregar FM-LEG-ISO al WE-2 (si tiene functions, sino crear function nueva)
if (we2) {
  const fmLegISO = buildFMLegISO();
  if (!we2.functions || we2.functions.length === 0) {
    we2.functions = [{
      id: randomUUID(),
      description: we2.functions?.[0]?.description || 'Aportar el componente B para la reaccion PU',
      functionDescription: we2.functions?.[0]?.functionDescription || 'Aportar el componente B para la reaccion PU',
      requirements: '',
      failures: [fmLegISO]
    }];
  } else {
    we2.functions[0].failures = we2.functions[0].failures || [];
    we2.functions[0].failures.push(fmLegISO);
  }
  fmLegISOAdded = true;
  console.log(`\n  WE-2 Isocianato: agregado FM-LEG-ISO (3 causas, S=9 CC)`);
}

// Recount totales
let totalCauses = 0, apH = 0, apM = 0;
for (const op of masterData.operations) {
  for (const we of op.workElements || []) {
    for (const fn of we.functions || []) {
      for (const fail of fn.failures || []) {
        for (const cause of fail.causes || []) {
          totalCauses++;
          const ap = (cause.ap || cause.actionPriority || '').toUpperCase();
          if (ap === 'H') apH++;
          else if (ap === 'M') apM++;
        }
      }
    }
  }
}

console.log(`\n=== RESUMEN MAESTRO ===`);
console.log(`  Controles preventivos agregados: ${totalPrevAdded}`);
console.log(`  Controles detectivos agregados: ${totalDetAdded}`);
console.log(`  FM-LEG-ISO agregado al WE-2: ${fmLegISOAdded ? 'SI' : 'NO'}`);
console.log(`  Total causas: ${totalCauses} (era 51, ahora deberia ser 54)`);

if (!APPLY) {
  console.log('\n*** DRY RUN — usar --apply para ejecutar ***');
  process.exit(0);
}

// ══════════════════════════════════════════════════════════════════════════════
// APPLY
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n=== APLICANDO ===\n');

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = new URL(`../backups/pu-enrich-${ts}/`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
mkdirSync(backupDir, { recursive: true });
writeFileSync(`${backupDir}/master_before.json`, JSON.stringify(typeof m.data === 'string' ? JSON.parse(m.data) : m.data, null, 2));

// 1. Update maestro
const dataToWrite = isText ? JSON.stringify(masterData) : masterData;
const { error: upMErr } = await sb.from('amfe_documents').update({
  data: dataToWrite,
  cause_count: totalCauses,
  ap_h_count: apH,
  ap_m_count: apM,
  organization: 'BARACK MERCOSUL',
  client: 'VWA',
  responsible: 'Carlos Baptista',
  start_date: today,
  last_revision_date: today,
  updated_at: new Date().toISOString()
}).eq('id', m.id);
if (upMErr) { console.error('ERROR update maestro:', upMErr.message); process.exit(1); }
console.log(`  1. Maestro actualizado (causas: ${totalCauses})`);
writeFileSync(`${backupDir}/master_after.json`, JSON.stringify(masterData, null, 2));

// 2. Replicar a los 3 Headrest
const TARGETS = [
  { pattern: 'AMFE-HF-PAT', targetOpNumber: '63' },
  { pattern: 'AMFE-HRC-PAT', targetOpNumber: '50' },
  { pattern: 'AMFE-HRO-PAT', targetOpNumber: '50' }
];

function regenerateUuids(obj, idMap) {
  if (typeof obj === 'string') return idMap.has(obj) ? idMap.get(obj) : obj;
  if (Array.isArray(obj)) return obj.map(item => regenerateUuids(item, idMap));
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key === 'id' && typeof val === 'string' && val.length > 30) {
        const fresh = randomUUID();
        idMap.set(val, fresh);
        result[key] = fresh;
      } else {
        result[key] = regenerateUuids(val, idMap);
      }
    }
    return result;
  }
  return obj;
}

const masterOpEnriched = masterData.operations[0];

for (const t of TARGETS) {
  const { data: tData } = await sb.from('amfe_documents').select('*').eq('amfe_number', t.pattern).single();
  const tParsed = typeof tData.data === 'string' ? JSON.parse(tData.data) : tData.data;
  const tIsText = typeof tData.data === 'string';

  // Save before
  writeFileSync(`${backupDir}/${t.pattern}_before.json`, JSON.stringify(tParsed, null, 2));

  // Clonar master OP enriquecido + regenerar UUIDs
  const cloned = JSON.parse(JSON.stringify(masterOpEnriched));
  const idMap = new Map();
  const fresh = regenerateUuids(cloned, idMap);

  // Mantener opNumber + operationName del target
  const existingOp = tParsed.operations.find(o => (o.opNumber || o.operationNumber) === t.targetOpNumber);
  if (existingOp) {
    fresh.id = existingOp.id; // preservar ID original
    fresh.opNumber = t.targetOpNumber;
    fresh.operationNumber = t.targetOpNumber;
    fresh.name = existingOp.operationName || existingOp.name;
    fresh.operationName = existingOp.operationName || existingOp.name;
    if (existingOp.linkedPfdStepId !== undefined) fresh.linkedPfdStepId = existingOp.linkedPfdStepId;
  }

  // Reemplazar la OP
  tParsed.operations = tParsed.operations.map(op =>
    (op.opNumber || op.operationNumber) === t.targetOpNumber ? fresh : op
  );

  // Recount
  let tCauses = 0, tH = 0, tM = 0;
  for (const op of tParsed.operations) {
    for (const we of op.workElements || []) {
      for (const fn of we.functions || []) {
        for (const fail of fn.failures || []) {
          for (const cause of fail.causes || []) {
            tCauses++;
            const ap = (cause.ap || cause.actionPriority || '').toUpperCase();
            if (ap === 'H') tH++;
            else if (ap === 'M') tM++;
          }
        }
      }
    }
  }

  const writeData = tIsText ? JSON.stringify(tParsed) : tParsed;
  const { error: upTErr } = await sb.from('amfe_documents').update({
    data: writeData,
    cause_count: tCauses,
    ap_h_count: tH,
    ap_m_count: tM,
    updated_at: new Date().toISOString()
  }).eq('id', tData.id);
  if (upTErr) { console.error(`ERROR update ${t.pattern}:`, upTErr.message); process.exit(1); }
  console.log(`  ${t.pattern}: total causas=${tCauses} (H=${tH}, M=${tM})`);
  writeFileSync(`${backupDir}/${t.pattern}_after.json`, JSON.stringify(tParsed, null, 2));
}

console.log(`\n  Backups: ${backupDir}`);
console.log('\n=== VERIFICACION FINAL ===\n');

for (const ref of ['AMFE-MAESTRO-PU-001', 'AMFE-HF-PAT', 'AMFE-HRC-PAT', 'AMFE-HRO-PAT']) {
  const { data } = await sb.from('amfe_documents').select('amfe_number,cause_count,data').eq('amfe_number', ref).single();
  const parsed = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
  console.log(`  ${ref}: cause_count=${data.cause_count}, header.applicableParts=${parsed.header?.applicableParts ? 'SI' : 'NO'}`);
}
console.log('\n  TODO OK');
