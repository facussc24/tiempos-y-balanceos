/**
 * Restaura controles preventivos/detectivos de inyeccion PU en MAESTRO-PU-001
 * + los 3 Headrest (HF-PAT, HRC-PAT, HRO-PAT) OP 63/50 INYECCION DE PU.
 *
 * Source: docs/drafts/MAESTRO_PU_IN_PLACE_DRAFT_v4.md (firmado por Leonardo,
 * 2026-05-26, 11 FMs originales con sensores reales).
 *
 * Estrategia: para cada failure, matchear su description con keywords del
 * FM correspondiente y asignar prev+det simplificado MANTENIENDO los equipos
 * y sensores (PT100, flujometros, alarmas, variadores, etc.) pero quitando
 * jerga PLC (tags I/O AI4/AI5, E21/E22, IW96, AQW0, modelos SINAMICS G120,
 * KM65, ES-FA-9AA, variables POL1=1, anglicismos HMI/shot/setpoint).
 *
 * NO inventa. Textos vienen del draft v4 validado por Leonardo (regla
 * amfe-no-inventar-controles: "COPIAR acciones que Fak o el equipo dicten
 * textualmente"). Solo simplifico la redaccion para operario E16/E17.
 *
 * Uso:
 *   node scripts/_restorePuControlsFromDraftV4.mjs            # dry-run
 *   node scripts/_restorePuControlsFromDraftV4.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

// FM library: keyword en failure.description -> {prev, det} simplificados
// Orden importa: las keywords mas especificas van PRIMERO (primer match gana)
const FM_LIBRARY = [
  {
    code: 'FM-10',
    keywords: [
      'flujometro desviado', 'flujómetro desviado', 'caudal desviado',
      'desviacion de caudal', 'desviación de caudal',
      'mide caudal incorrecto', 'caudal incorrecto', 'flujometro poly', 'flujometro iso',
    ],
    prev: 'Calibracion periodica de flujometros de poliol e isocianato',
    det: 'Alarma de desviacion de caudal con parada automatica',
  },
  {
    code: 'FM-11',
    keywords: ['vapores', 'atex', 'explosividad', 'gases inflamables', 'concentracion de vapores'],
    prev: '-',
    det: '-',
  },
  {
    code: 'FM-LEG',
    keywords: [
      'norma legal', 'tl 1010', 'vw 50180', 'flamabilidad', 'voc',
      'eu 2000/53', 'anexo ii', 'incumplimiento legal',
      'lote de isocianato fuera de spec', 'no cumple tl', 'no cumple vw',
    ],
    prev: 'Calibracion periodica de flujometros de poliol e isocianato. Verificacion de consigna de densidad y proporcion en panel. Agitadores de tanques funcionando',
    det: 'Alarma de desviacion de caudal con parada automatica. Sensores PT100 en cabezal. Sensor de presion en cabezal. Monitoreo de corriente de bombas',
  },
  {
    code: 'FM-1',
    keywords: [
      'delaminacion', 'delaminación', 'despegado de capas',
      'capas se despegan', 'capas funda', 'capas se separan',
      'funda/espuma/sustrato', 'se despegan entre si', 'separacion entre capas',
    ],
    prev: 'Consigna de temperatura de poliol, isocianato y agua de tanques en panel, con bloqueo de inyeccion hasta alcanzar consigna',
    det: 'Sensores PT100 en cabezal mezclador con lectura continua de temperatura',
  },
  {
    code: 'FM-2',
    keywords: [
      'huecos', 'burbujas', 'porosidad', 'cavidades en espuma', 'vacio en espuma',
      'cavidades vacias', 'cavidades vacías', 'espuma con cavidades',
      'queda con cavidades', 'vacios dentro de la espuma',
    ],
    prev: 'Sensor de presion de bombas. Sensor de presion de aire de linea. Sensor de nivel de aceite hidraulico. Verificacion de posicion del cilindro antes del ciclo',
    det: 'Alarma de desviacion de presion con parada automatica. Sensor de nivel de tanques con corte de recarga si baja',
  },
  {
    code: 'FM-3',
    keywords: ['contaminacion', 'contaminación', 'suciedad', 'particulas extranas', 'partículas extrañas'],
    prev: 'Agitadores de tanques funcionando. Purga automatica del cabezal entre ciclos',
    det: 'Sensor de confirmacion de purga ejecutada',
  },
  {
    code: 'FM-4',
    keywords: [
      'zonas duras', 'rigidez excesiva', 'dureza alta', 'zona dura',
      'zonas rigidas', 'zonas rígidas', 'zonas localizadas mas rigidas',
      'zonas localizadas rigidas', 'mas rigidas que el resto',
    ],
    prev: 'Consigna de temperatura en panel con bloqueo. Sincronizacion de variadores. Chiller verificado al arranque',
    det: 'Sensores PT100 en cabezal y tanques de agua. Monitoreo de corriente de calefaccion',
  },
  {
    code: 'FM-5',
    keywords: [
      'fuga de pu', 'fuga pur', 'fuga de mezcla', 'perdida de material', 'pérdida de material',
      'mezcla pu se escapa', 'mezcla se escapa', 'escape de mezcla',
      'pu se escapa del molde', 'mezcla escapa del molde',
    ],
    prev: 'Verificacion de posicion del cilindro antes del ciclo. Sensor de sobrepresion de bombas. Plataforma giratoria nivelada con anclajes verificados',
    det: 'Monitoreo de presion durante el ciclo — caida brusca indica fuga. Inspeccion visual al desmoldeo',
  },
  {
    code: 'FM-6',
    keywords: [
      'posicion fuera de spec', 'forma fuera de spec', 'dimensional nok',
      'pieza deformada', 'fuera de tolerancia dimensional',
      'descentrado', 'geometria incorrecta', 'geometria fuera',
      'apoyacabezas descentrado', 'queda descentrado',
    ],
    prev: 'Sensores de posicion del plato rotativo. Chiller verificado. Anclaje de placas base verificado. Identificacion RFID del molde',
    det: '-',
  },
  {
    code: 'FM-7',
    keywords: [
      'ciclo incompleto', 'tiempo de presion', 'tiempo presion inadecuado',
      'tiempo de presurizacion', 'pieza incompleta',
      'ciclo se interrumpe', 'ciclo interrumpe', 'ciclo de inyeccion se interrumpe',
      'ciclo de inyeccion/curado se interrumpe', 'interrupcion de ciclo',
      'no se completa correctamente', 'inyeccion/curado se interrumpe',
    ],
    prev: 'Doble via de cierre de ciclo. Deteccion de cable roto. Modulo de seguridad',
    det: 'Alarma de temperatura de aceite. Alarma de tiempo maximo de presurizacion. Pantalla historica de registros. Zumbador y marca parpadeante en panel',
  },
  {
    code: 'FM-8',
    keywords: [
      'riesgo operario', 'stop de emergencia', 'atrapamiento', 'aplastamiento',
      'operario no acciona el stop', 'no acciona el stop', 'no acciona stop',
      'ante emergencia', 'operario no acciona',
    ],
    prev: 'Modulo de seguridad con E-STOPs en serie. Puertas con interbloqueo. Barrera de luz. Procedimiento de rearme',
    det: '-',
  },
];

function normalize(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function detectFm(failureDesc) {
  const n = normalize(failureDesc);
  for (const fm of FM_LIBRARY) {
    for (const kw of fm.keywords) {
      if (n.includes(normalize(kw))) return fm;
    }
  }
  return null;
}

function isInjectionPuOp(opName) {
  const n = normalize(opName);
  return (n.includes('inyeccion') && (n.includes('pu') || n.includes('pur'))) ||
         /\bpu\b/.test(n) || /\bpur\b/.test(n) || n.includes('espumado') || n.includes('inyeccion de pu');
}

// ─────────────────────────────────────────────────────────────────────────────

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { apply } = parseSafeArgs();

const TARGETS = ['AMFE-MAESTRO-PU-001', 'AMFE-HF-PAT', 'AMFE-HRC-PAT', 'AMFE-HRO-PAT'];
const { data: rows, error } = await sb.from('amfe_documents')
  .select('id, amfe_number, project_name, data')
  .in('amfe_number', TARGETS);
if (error) { console.error(error); process.exit(2); }

const allPlans = [];
const summary = { causes: 0, byFm: {} };

for (const row of rows || []) {
  const before = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  if (!before || !Array.isArray(before.operations)) continue;
  const after = JSON.parse(JSON.stringify(before));

  let changes = 0;

  for (const op of after.operations) {
    const opName = op.name || op.operationName || '';
    // En MAESTRO-PU-001 es OP 10 (toda la OP). En Headrest es la OP de inyeccion PU.
    const opNumber = parseInt(op.opNumber || op.operationNumber);
    const isMaster = (row.amfe_number === 'AMFE-MAESTRO-PU-001');
    const isPuOp = isMaster || isInjectionPuOp(opName);
    if (!isPuOp) continue;

    for (const we of op.workElements || []) {
      for (const fn of we.functions || []) {
        for (const fm of fn.failures || []) {
          const fmDesc = fm.description || fm.failureMode || '';
          const matched = detectFm(fmDesc);
          if (!matched) continue;

          for (const c of fm.causes || []) {
            // En OP de PU + MAESTRO-PU-001 / Headrest, el draft v4 es fuente de
            // verdad. Sobreescribir el control actual con el simplificado del FM
            // matcheado. EXCEPCION: si el control fue editado manualmente por
            // Fak/equipo (NO tiene 'preventionControl'/'detectionControl' en
            // _autoFilled), preservar.
            const af = Array.isArray(c._autoFilled) ? c._autoFilled : (c._autoFilled ? [c._autoFilled] : []);
            const prevWasAuto = af.includes('preventionControl');
            const detWasAuto = af.includes('detectionControl');
            const prev = (c.preventionControl || '').trim();
            const det = (c.detectionControl || '').trim();
            let changedHere = false;
            // Reglas:
            //  - Vacio o "-" o "_-": sobreescribir siempre
            //  - Auto-llenado previo (por _fillTbdControlsFromCanon.mjs): sobreescribir
            //  - Texto editado por Fak/equipo: PRESERVAR
            const shouldOverridePrev = prev === '' || prev === '-' || prev === '_-' || prevWasAuto;
            const shouldOverrideDet  = det  === '' || det  === '-' || det  === '_-' || detWasAuto;
            if (shouldOverridePrev) {
              c.preventionControl = matched.prev;
              changedHere = true;
            }
            if (shouldOverrideDet) {
              c.detectionControl = matched.det;
              changedHere = true;
            }
            if (changedHere) {
              c._autoFilled = Array.from(new Set([...af, 'preventionControl', 'detectionControl']));
              summary.causes++;
              summary.byFm[matched.code] = (summary.byFm[matched.code] || 0) + 1;
              changes++;
            }
          }

          console.log(`  [${row.amfe_number}] OP ${opNumber} FM "${fmDesc.substring(0, 60)}" -> ${matched.code}`);
        }
      }
    }
  }

  if (changes === 0) continue;
  allPlans.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name || '', before, after });
}

console.log(`\n=== Resumen ===`);
console.log(`Causas actualizadas:  ${summary.causes}`);
console.log(`Por FM:`);
for (const [code, count] of Object.entries(summary.byFm)) {
  console.log(`  ${code}: ${count}`);
}
console.log(`AMFEs afectados:      ${allPlans.length}`);

if (allPlans.length === 0) { console.log('Nada que aplicar.'); process.exit(0); }

await runWithValidation(allPlans, apply, async () => {
  for (const p of allPlans) {
    const { error: upErr } = await sb.from('amfe_documents')
      .update({ data: p.after, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (upErr) { console.error(`Error update ${p.amfeNumber}:`, upErr); process.exit(2); }
    console.log(`Aplicado: ${p.amfeNumber}`);
  }
}, { allowNewCritical: true });
