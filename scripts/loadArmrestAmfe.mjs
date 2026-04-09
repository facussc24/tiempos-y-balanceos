/**
 * Load Armrest Door Panel AMFE — Missing operations + renumber/rename existing
 *
 * AMFE ID: 5268704d-30ae-48f3-ad05-8402a6ded7fe
 * Project: VWA/PATAGONIA/ARMREST_DOOR_PANEL
 *
 * Current state: 6 ops (OP 10-60), 45 causes.
 * Existing ops:
 *   OP 10: RECEPCION             → keep as OP 10
 *   OP 20: CORTE DE VINILO       → renumber to OP 20, rename "CORTE DE COMPONENTES"
 *   OP 30: COSTURA               → renumber to OP 50, rename "COSTURA UNION"
 *   OP 40: TAPIZADO              → renumber to OP 90, rename "TAPIZADO SEMIAUTOMATICO"
 *   OP 50: INSPECCION FINAL      → renumber to OP 100, rename "CONTROL FINAL DE CALIDAD"
 *   OP 60: EMBALAJE              → renumber to OP 110
 *
 * New operations to add (parsed from PDF backup):
 *   OP 15: PREPARACION DE CORTE
 *   OP 25: CONTROL CON MYLAR
 *   OP 40: REFILADO
 *   OP 51: COSTURA DOBLE
 *   OP 60: INYECCION DE PIEZAS PLASTICAS
 *   OP 70: INYECCION PU
 *   OP 72: ENSAMBLE CON SUSTRATO
 *   OP 80: ADHESIVADO
 *   OP 81: INSPECCION DE PIEZA ADHESIVADA
 *   OP 101: CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME
 *   OP 103: REPROCESO: FALTA DE ADHESIVO
 *
 * Skipped (WIP storage, per rules):
 *   OP 30, OP 52, OP 61, OP 71, OP 82
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

// ── Read .env.local manually ────────────────────────────────────────
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// ── AP calculation (copied from apTable.ts) ─────────────────────────
function apRule(s, o, d) {
  if (s <= 1) return 'L';
  if (s <= 3) {
    if (o >= 8 && d >= 5) return 'M';
    return 'L';
  }
  if (s <= 6) {
    if (o >= 8) return d >= 5 ? 'H' : 'M';
    if (o >= 6) return d >= 2 ? 'M' : 'L';
    if (o >= 4) return d >= 7 ? 'M' : 'L';
    return 'L';
  }
  if (s <= 8) {
    if (o >= 8) return 'H';
    if (o >= 6) return d >= 2 ? 'H' : 'M';
    if (o >= 4) return d >= 7 ? 'H' : 'M';
    if (o >= 2) return d >= 5 ? 'M' : 'L';
    return 'L';
  }
  // S = 9-10
  if (o >= 6) return 'H';
  if (o >= 4) return d >= 2 ? 'H' : 'M';
  if (o >= 2) {
    if (d >= 7) return 'H';
    if (d >= 5) return 'M';
    return 'L';
  }
  return 'L';
}

function calculateAP(s, o, d) {
  if (isNaN(s) || isNaN(o) || isNaN(d)) return '';
  const sInt = Math.round(s);
  const oInt = Math.round(o);
  const dInt = Math.round(d);
  if (sInt < 1 || sInt > 10 || oInt < 1 || oInt > 10 || dInt < 1 || dInt > 10) return '';
  return apRule(sInt, oInt, dInt);
}

// ── Helper: Create a cause ──────────────────────────────────────────
function mkCause(desc, s, o, d, prevCtrl, detCtrl, specialChar = '') {
  const ap = calculateAP(s, o, d);
  return {
    id: randomUUID(),
    description: desc,
    cause: desc,
    severity: s,
    occurrence: o,
    detection: d,
    preventionControl: prevCtrl,
    detectionControl: detCtrl,
    ap: ap,
    actionPriority: ap,
    specialChar: specialChar,
    characteristicNumber: '',
    filterCode: '',
    recommendedAction: '',
  };
}

// ── Helper: Create a failure ────────────────────────────────────────
function mkFailure(desc, severity, effectLocal, effectNextLevel, effectEndUser, causes) {
  return {
    id: randomUUID(),
    description: desc,
    severity: severity,
    effectLocal: effectLocal,
    effectNextLevel: effectNextLevel,
    effectEndUser: effectEndUser,
    causes: causes,
  };
}

// ── Helper: Create a function ───────────────────────────────────────
function mkFunction(desc, requirements, failures) {
  return {
    id: randomUUID(),
    description: desc,
    functionDescription: desc,
    requirements: requirements || '',
    failures: failures,
  };
}

// ── Helper: Create a WE ────────────────────────────────────────────
function mkWE(name, type, functions) {
  return {
    id: randomUUID(),
    name: name,
    type: type,
    functions: functions,
  };
}

// ── Helper: Create an operation ─────────────────────────────────────
function mkOp(opNum, opName, focusElemFunc, opFunc, workElements) {
  return {
    id: randomUUID(),
    opNumber: String(opNum),
    operationNumber: String(opNum),
    name: opName,
    operationName: opName,
    focusElementFunction: focusElemFunc,
    operationFunction: opFunc,
    workElements: workElements,
  };
}

// ── Common focusElementFunction (same for all ARMREST ops) ──────────
const FOCUS_ELEM_FUNC =
  'Interno: Proveer pieza tapizada y ensamblada conforme a especificaciones dimensionales y de apariencia / ' +
  'Cliente: Permitir ensamble del apoyabrazos de puerta sin interferencias en linea VW / ' +
  'Usr. Final: Confort ergonomico y apariencia estetica del apoyabrazos de puerta del vehiculo';


// ═══════════════════════════════════════════════════════════════════════
// NEW OPERATION DEFINITIONS — Parsed from AMFE PDF backup
// ═══════════════════════════════════════════════════════════════════════

// ── OP 15: PREPARACION DE CORTE ─────────────────────────────────────
const op15 = mkOp(15, 'PREPARACION DE CORTE', FOCUS_ELEM_FUNC,
  'Proveer material cortado conforme a requerimientos dimensionales y de trazabilidad, con cero scrap y dentro del ciclo de tiempo',
  [
    mkWE('Cortadora de panos', 'Machine', [
      mkFunction(
        'Ejecutar el corte del material de forma constante, pareja y conforme a la longitud requerida',
        '',
        [
          mkFailure(
            'Corte fuera de medida (pano mas corto o mas largo que la especificacion)',
            5,
            'Perdida de material (scrap)',
            'Imposibilidad de ensamblar la pieza correctamente',
            'Retrabajo o falla estetica',
            [
              mkCause(
                'Error del operario al regular la medida con la regla metalica fija',
                5, 5, 6,
                'Medicion de la primera capa usando la regla metalica fija como referencia',
                'Inspeccion visual del primer corte',
                ''
              ),
            ]
          ),
          mkFailure(
            'Contaminacion del material durante la preparacion de corte',
            6,
            'Retrabajo de una porcion de la produccion',
            'Clasificacion adicional de productos',
            'Defecto visual moderado en apariencia',
            [
              mkCause(
                'Ambiente sucio en planta del proveedor o en zona de preparacion',
                6, 6, 6,
                'Instruccion de Trabajo y Auditorias de Calidad',
                'Inspeccion Visual de la pieza y del empaque',
                ''
              ),
              mkCause(
                'Falta de inspeccion al llegar la materia prima',
                6, 6, 6,
                'Instruccion de Trabajo y Auditorias de Calidad',
                'Inspeccion Visual de la pieza y del empaque',
                ''
              ),
            ]
          ),
        ]
      ),
    ]),
    mkWE('Operador de produccion', 'Man', [
      mkFunction(
        'Ajustar el rollo de material con firmeza y estabilidad, configurar parametros de corte en maquina, medir los panos y trasladarlos a mesa de corte',
        '',
        []
      ),
    ]),
    mkWE('Hoja de operaciones', 'Method', [
      mkFunction(
        'Utilizar la Hoja de Operaciones vigente. Definir el plan de reaccion ante un No conforme',
        '',
        []
      ),
    ]),
  ]
);

// ── OP 25: CONTROL CON MYLAR ────────────────────────────────────────
const op25 = mkOp(25, 'CONTROL CON MYLAR', FOCUS_ELEM_FUNC,
  'Verificar la conformidad dimensional del contorno cortado',
  [
    mkWE('Mylar de control', 'Measurement', [
      mkFunction(
        'Asegurar la verificacion rapida y precisa de la geometria y el contorno del corte conforme a las tolerancias especificas',
        '',
        [
          mkFailure(
            'Omitir la operacion de inspeccion',
            5,
            'Generacion de scrap',
            'Parada de linea de produccion (menor a una hora) o necesidad de incorporar procesos adicionales de clasificacion de productos defectuosos',
            'Perdida de la funcion secundaria del vehiculo',
            [
              mkCause(
                'Operador de produccion omite la tarea de verificacion visual',
                5, 3, 9,
                'Instruccion/checklist de set up de verificacion',
                'Auditorias internas',
                ''
              ),
            ]
          ),
        ]
      ),
    ]),
    mkWE('Operador de produccion', 'Man', [
      mkFunction(
        'Colocar la pieza cortada sobre el mylar para la inspeccion dimensional',
        '',
        []
      ),
    ]),
    mkWE('Hoja de operaciones', 'Method', [
      mkFunction(
        'Utilizar la Hoja de Operaciones vigente. Definir el plan de reaccion ante un No conforme',
        '',
        []
      ),
    ]),
  ]
);

// ── OP 40: REFILADO ─────────────────────────────────────────────────
const op40 = mkOp(40, 'REFILADO', FOCUS_ELEM_FUNC,
  'Asegurar un refilado conforme a especificacion de corte, sin generar scrap ni retrabajos',
  [
    mkWE('Maquina refiladora', 'Machine', [
      mkFunction(
        'Generar el contorno refilado con precision segun especificacion',
        '',
        [
          mkFailure(
            'Posicionado de cortes NOK',
            5,
            'Retrabajo en linea',
            'Clasificacion adicional de productos defectuosos',
            'Degradacion de la funcion secundaria del vehiculo',
            [
              mkCause(
                'Operario coloca pieza fuera de posicion en la instruccion de refilado y en la guia del equipo',
                5, 7, 6,
                'Ayudas Visuales y (HO) Instruccion de Proceso',
                'Verificacion de Primera Pieza (Puesta a Punto)',
                ''
              ),
            ]
          ),
          mkFailure(
            'Refilado fuera de especificaciones',
            5,
            'Retrabajo en linea',
            'Clasificacion adicional de productos defectuosos',
            'Degradacion de la funcion secundaria del vehiculo',
            [
              mkCause(
                'Cuchilla desafilada o desgastada',
                5, 6, 6,
                'Mantenimiento Preventivo',
                'Verificacion de Primera Pieza (Puesta a Punto)',
                ''
              ),
            ]
          ),
        ]
      ),
    ]),
    mkWE('Operador de produccion', 'Man', [
      mkFunction(
        'Posicionar el componente y accionar el ciclo de la maquina refiladora conforme a la instruccion',
        '',
        []
      ),
    ]),
    mkWE('Hoja de operaciones', 'Method', [
      mkFunction(
        'Utilizar la Hoja de Operaciones vigente. Definir el plan de reaccion ante un No conforme',
        '',
        []
      ),
    ]),
  ]
);

// ── OP 51: COSTURA DOBLE ────────────────────────────────────────────
const op51 = mkOp(51, 'COSTURA DOBLE', FOCUS_ELEM_FUNC,
  'Realizar la costura decorativa. Premiar la costura decorativa',
  [
    mkWE('Maquina de coser', 'Machine', [
      mkFunction(
        'Ejecutar costura decorativa doble conforme a especificacion',
        '',
        [
          mkFailure(
            'Costura descosida o debil',
            5,
            'Retrabajo fuera de linea',
            'Parada de linea de produccion menor a una hora',
            'Degradacion de la funcion secundaria del vehiculo',
            [
              mkCause(
                'Tension de hilo incorrecta',
                5, 4, 4,
                'Las maquinas poseen regulacion de tension con fijacion de hilo',
                'Inspeccion visual',
                ''
              ),
              mkCause(
                'Puntadas demasiado largas',
                5, 4, 6,
                'Las maquinas poseen regulacion de largo de puntada',
                'Visual',
                ''
              ),
              mkCause(
                'Hilo inadecuado',
                5, 5, 6,
                'Las maquinas poseen regulacion de tension con fijacion de hilo',
                'Visual',
                ''
              ),
            ]
          ),
          mkFailure(
            'Costura desviada o fuera de especificacion',
            5,
            'Retrabajo fuera de linea',
            'Parada de linea de produccion menor a una hora',
            'Degradacion de la funcion secundaria del vehiculo',
            [
              mkCause(
                'Falta de guia en costura',
                5, 4, 4,
                'Las maquinas poseen una guia',
                'Inspeccion visual en linea',
                ''
              ),
              mkCause(
                'Error del operario',
                5, 5, 5,
                'Verificacion visual de la pieza',
                'Uso de plantillas de referencia',
                ''
              ),
            ]
          ),
          mkFailure(
            'Puntadas irregulares o arrugas',
            4,
            'Retrabajo en linea',
            'Clasificacion adicional',
            'Defecto cosmetico menor',
            [
              mkCause(
                'Mala configuracion de la maquina',
                4, 6, 6,
                'Mantenimiento preventivo',
                'Visual',
                ''
              ),
              mkCause(
                'Falta de mantenimiento',
                5, 4, 4,
                'Mantenimiento preventivo',
                'Visual',
                ''
              ),
              mkCause(
                'Agujas inadecuadas',
                5, 3, 6,
                'Mantenimiento preventivo',
                'Inspeccion visual',
                ''
              ),
            ]
          ),
          mkFailure(
            'Rotura del vinilo en la zona de la costura',
            5,
            'Scrap de la pieza',
            'Parada de linea de produccion menor a una hora',
            'Degradacion de la funcion secundaria del vehiculo',
            [
              mkCause(
                'Puntada demasiado apretada',
                5, 2, 6,
                'Regulacion de tension de maquina',
                'Visual',
                ''
              ),
            ]
          ),
          mkFailure(
            'Seleccion incorrecta del hilo',
            5,
            'Scrap de la pieza o retrabajo',
            'Clasificacion adicional de productos',
            'Defecto cosmetico',
            [
              mkCause(
                'Operario selecciona hilo de color o tipo incorrecto',
                5, 3, 6,
                'Instruccion de proceso con especificacion de hilo',
                'Inspeccion visual',
                ''
              ),
            ]
          ),
        ]
      ),
    ]),
    mkWE('Operador de produccion', 'Man', [
      mkFunction(
        'Posicionar la pieza y operar la maquina de costura conforme a instruccion',
        '',
        []
      ),
    ]),
    mkWE('Hoja de operaciones', 'Method', [
      mkFunction(
        'Utilizar la Hoja de Operaciones vigente. Definir el plan de reaccion ante un No conforme',
        '',
        []
      ),
    ]),
  ]
);

// ── OP 60: INYECCION DE PIEZAS PLASTICAS ────────────────────────────
const op60 = mkOp(60, 'INYECCION DE PIEZAS PLASTICAS', FOCUS_ELEM_FUNC,
  'Fabricar la pieza plastica (sustrato) cumpliendo con las especificaciones dimensionales y de apariencia, dentro del tiempo de ciclo establecido, sin generar scrap ni necesidad de retrabajos posteriores',
  [
    mkWE('Maquina inyectora de plastico', 'Machine', [
      mkFunction(
        'Inyectar el material en el molde controlando los parametros de proceso (presion, temperatura, tiempo)',
        '',
        [
          mkFailure(
            'Llenado incompleto de pieza',
            8,
            '100% de la produccion en ese ciclo tiene que ser scrapeada',
            'Parada de linea mayor a un turno de produccion completo o paro de envios',
            'Perdida de la funcion primaria del vehiculo',
            [
              mkCause(
                'Presion de inyeccion configurada fuera de especificacion',
                8, 5, 5,
                'Monitoreo automatico de presion y mantenimiento preventivo con calibracion periodica de sensores',
                'Deteccion automatica de llenado incompleto',
                'SC'
              ),
              mkCause(
                'Temperatura de fusion del material demasiado baja',
                8, 4, 8,
                'Mantenimiento y calibracion del sistema termico. Verificacion estandar de la configuracion de potencia',
                'Verificacion visual y dimensional de aprobacion de la primera pieza tras el set-up o cambio de turno',
                'SC'
              ),
            ]
          ),
          mkFailure(
            'Rebaba excesiva o exceso de material',
            7,
            'Una porcion de la produccion requiere retrabajo fuera de linea y aceptada',
            'Parada de linea de produccion menor a una hora',
            'Perdida de la funcion secundaria del vehiculo',
            [
              mkCause(
                'Fuerza de cierre insuficiente',
                7, 5, 5,
                'Mantenimiento preventivo (MP) programado de la unidad de cierre / instruccion de set-up detallada',
                'Monitoreo automatico de presion de cierre / inspeccion dimensional manual por muestreo',
                'SC'
              ),
              mkCause(
                'Molde o cavidad contaminada con material residual',
                7, 4, 5,
                'Procedimiento de limpieza y purga estandarizado para la cavidad y linea de particion del molde',
                'Inspeccion visual por parte del operador de la cavidad',
                'SC'
              ),
            ]
          ),
          mkFailure(
            'Pieza con deformacion o alabeo',
            7,
            'Una porcion de la produccion tiene que ser scrapeada',
            'Parada de linea entre una hora y un turno de produccion completo',
            'Degradacion de la funcion primaria del vehiculo',
            [
              mkCause(
                'Parametros de inyeccion configurados incorrectamente',
                7, 5, 3,
                'Instruccion de set-up estandarizada que detalla los valores nominales y rangos de tolerancia',
                'Aprobacion de la primera pieza: inspeccion de los parametros de la maquina y verificacion dimensional',
                ''
              ),
            ]
          ),
        ]
      ),
    ]),
    mkWE('Operador de produccion', 'Man', [
      mkFunction(
        'Descargar la pieza y realizar la inspeccion visual al 100% (segun pauta) para segregar defectos como rebabas y/o quemaduras antes del embalaje intermedio',
        '',
        []
      ),
    ]),
    mkWE('Hoja de operaciones', 'Method', [
      mkFunction(
        'Utilizar la Hoja de Operaciones vigente. Definir el plan de reaccion ante un No conforme. Ayudas visuales: mostrar como debe quedar el producto para evitar ciertos defectos',
        '',
        []
      ),
    ]),
  ]
);

// ── OP 70: INYECCION PU ─────────────────────────────────────────────
const op70 = mkOp(70, 'INYECCION PU', FOCUS_ELEM_FUNC,
  'Sobreinyectar la capa de espuma PU sobre la pieza plastica de forma correcta y uniforme',
  [
    mkWE('Inyectora de PUR', 'Machine', [
      mkFunction(
        'Inyectar poliuretano sobre el sustrato plastico asegurando cobertura y espesor uniforme',
        '',
        [
          mkFailure(
            'Vertido incorrecto de mezcla sobre molde',
            5,
            'Scrap de pieza',
            'Retrabajo o clasificacion adicional',
            'Defecto visual o funcional',
            [
              mkCause(
                'Error de operario',
                5, 3, 7,
                'Uso de ayudas visuales / hoja de operaciones',
                'Control visual del operario',
                ''
              ),
            ]
          ),
          mkFailure(
            'Inyeccion incompleta o exceso de material en el molde',
            5,
            'Scrap de pieza o retrabajo',
            'Clasificacion adicional',
            'Defecto dimensional o de apariencia',
            [
              mkCause(
                'Falla de dispositivo',
                5, 2, 7,
                'Plan de mantenimiento segun cronograma',
                'Control visual del operario',
                ''
              ),
            ]
          ),
          mkFailure(
            'Aplicacion de desmoldante no uniforme o fuera de especificacion',
            5,
            'Scrap de pieza',
            'Retrabajo fuera de linea',
            'Degradacion de apariencia',
            [
              mkCause(
                'Error de operario en la aplicacion del desmoldante',
                5, 3, 7,
                'Uso de ayudas visuales / hoja de operaciones',
                'Control visual del operario',
                ''
              ),
            ]
          ),
          mkFailure(
            'Colocar cabeza de referencia fuera de la posicion correcta',
            5,
            'Scrap de pieza',
            'Retrabajo fuera de linea',
            'Degradacion funcional',
            [
              mkCause(
                'Error de operario en la colocacion de la cabeza',
                5, 3, 7,
                'Uso de ayudas visuales / hoja de operaciones',
                'Control visual del operario',
                ''
              ),
            ]
          ),
          mkFailure(
            'Colocacion incorrecta de Material en tanque',
            5,
            'Scrap de pieza',
            'Retrabajo fuera de linea',
            'Degradacion funcional',
            [
              mkCause(
                'Error de operario en la carga de material',
                5, 3, 7,
                'Uso de ayudas visuales / hoja de operaciones',
                'Control visual del operario',
                ''
              ),
            ]
          ),
          mkFailure(
            'Colocar el cabezal fuera de inyeccion y el cache del limpiezas de inyeccion',
            5,
            'Scrap de pieza',
            'Retrabajo fuera de linea',
            'No afecta al trabajo',
            [
              mkCause(
                'Error de operario',
                5, 2, 5,
                'Uso de ayudas visuales / hoja de operaciones',
                'Control visual del operario',
                ''
              ),
            ]
          ),
          mkFailure(
            'Retirar de forma incorrecta la pieza del molde',
            5,
            'Dano en la pieza',
            'Retrabajo fuera de linea',
            'Degradacion de apariencia',
            [
              mkCause(
                'Error de operario al desmoldar',
                5, 3, 7,
                'Uso de ayudas visuales / hoja de operaciones',
                'Control visual del operario',
                ''
              ),
            ]
          ),
          mkFailure(
            'Retirar la pieza antes de los 4 min de curado',
            5,
            'Deformacion de la pieza',
            'Retrabajo fuera de linea',
            'Degradacion de apariencia',
            [
              mkCause(
                'Error de operario en el tiempo de curado',
                5, 3, 7,
                'Hojas de operaciones',
                'Control visual del operario',
                ''
              ),
            ]
          ),
        ]
      ),
    ]),
    mkWE('Operador de produccion', 'Man', [
      mkFunction(
        'Preparar molde, inyectar PU, desmoldar y verificar la pieza conforme a instruccion',
        '',
        []
      ),
    ]),
    mkWE('Hoja de operaciones', 'Method', [
      mkFunction(
        'Utilizar la Hoja de Operaciones vigente. Definir el plan de reaccion ante un No conforme',
        '',
        []
      ),
    ]),
  ]
);

// ── OP 72: ENSAMBLE CON SUSTRATO ────────────────────────────────────
const op72 = mkOp(72, 'ENSAMBLE CON SUSTRATO', FOCUS_ELEM_FUNC,
  'Ensamblar la pieza interior correctamente en el medio de transporte',
  [
    mkWE('Operador de produccion', 'Man', [
      mkFunction(
        'Ensamblar la pieza en el medio de transporte correctamente conforme a disposicion',
        '',
        [
          mkFailure(
            'Cantidad de piezas incorrecta en medio definida',
            5,
            'Retrabajo en linea',
            'Clasificacion adicional',
            'Defecto corregido antes de llegar al usuario',
            [
              mkCause(
                'Error de operario en la cantidad de piezas por medio',
                5, 3, 7,
                'Uso de ayudas visuales / hoja de operaciones',
                'Control visual del operario',
                ''
              ),
            ]
          ),
          mkFailure(
            'Piezas danadas por no respetar disposicion',
            5,
            'Retrabajo en linea',
            'Clasificacion adicional',
            'Defecto de apariencia',
            [
              mkCause(
                'Error de operario en la disposicion de las piezas',
                5, 3, 7,
                'Uso de ayudas visuales / hoja de operaciones',
                'Control visual del operario',
                ''
              ),
            ]
          ),
          mkFailure(
            'Medio equivocado',
            5,
            'Retrabajo en linea',
            'Clasificacion adicional',
            'Defecto de apariencia',
            [
              mkCause(
                'Error de operario en la seleccion de medio',
                5, 2, 7,
                'Uso de ayudas visuales / hoja de operaciones',
                'Control visual del operario',
                ''
              ),
            ]
          ),
        ]
      ),
    ]),
    mkWE('Hoja de operaciones', 'Method', [
      mkFunction(
        'Utilizar la Hoja de Operaciones vigente. Definir el plan de reaccion ante un No conforme',
        '',
        []
      ),
    ]),
  ]
);

// ── OP 80: ADHESIVADO ───────────────────────────────────────────────
const op80 = mkOp(80, 'ADHESIVADO', FOCUS_ELEM_FUNC,
  'Aplicar una adhesion uniforme y completa, logrando una pieza adhesivada sin defectos, sin necesidad de reprocesos o scrap, dentro del tiempo de ciclo',
  [
    mkWE('Pistola de adhesivado', 'Machine', [
      mkFunction(
        'Aplicar adhesivo de forma uniforme y controlada',
        '',
        [
          mkFailure(
            'Adhesion insuficiente o fuera de especificacion',
            6,
            'Scrap (100% de la produccion debe ser descartada)',
            'Parada de linea de ensamblaje en el cliente',
            'Degradacion de la funcion primaria del vehiculo / reclamo de aspecto',
            [
              mkCause(
                'Uso de adhesivo o reticulante vencido/degradado (mala gestion de materiales)',
                6, 4, 5,
                'Puesta a punto y verificacion manual de fechas de caducidad',
                'Gestion de stock (FIFO)',
                ''
              ),
              mkCause(
                'Proporcion de mezcla incorrecta',
                6, 7, 8,
                'Hoja de proceso detalla como realizar la mezcla correctamente',
                'Inspeccion visual: el operador mira la mezcla',
                ''
              ),
              mkCause(
                'Exceso o falta de adhesivo',
                6, 6, 8,
                'Instrucciones de proceso: Documento estandar',
                'Pieza patron e Inspeccion visual: comparacion visual contra muestra limite',
                ''
              ),
            ]
          ),
        ]
      ),
    ]),
    mkWE('Operador de produccion', 'Man', [
      mkFunction(
        'Posicionar el componente y accionar el ciclo de adhesivado conforme a la instruccion',
        '',
        []
      ),
    ]),
    mkWE('Hoja de operaciones', 'Method', [
      mkFunction(
        'Utilizar la Hoja de Operaciones vigente. Definir el plan de reaccion ante un No conforme. Ayudas visuales: mostrar como debe quedar el producto para evitar ciertos defectos',
        '',
        []
      ),
    ]),
  ]
);

// ── OP 81: INSPECCION DE PIEZA ADHESIVADA ───────────────────────────
const op81 = mkOp(81, 'INSPECCION DE PIEZA ADHESIVADA', FOCUS_ELEM_FUNC,
  'Verificar la conformidad de la adhesion y la caracteristica visual del producto, segun requisitos/especificacion',
  [
    mkWE('Operador de produccion', 'Man', [
      mkFunction(
        'Tomar pieza adhesivada, inspeccionar criterios visuales y colocar en scrap o medio OK',
        '',
        [
          mkFailure(
            'Pieza danada (rasgadura en el kit, mancha)',
            5,
            'Retrabajo fuera de linea',
            'Producto defectuoso desencadena un plan de reaccion importante',
            'Degradacion de la funcion secundaria del vehiculo',
            [
              mkCause(
                'El operador no sigue el procedimiento de revision visual establecido en el kit',
                5, 5, 8,
                'Instruccion de revision visual de pieza en el kit',
                'Inspeccion visual de la pieza y del empaque',
                ''
              ),
            ]
          ),
          mkFailure(
            'Adhesion insuficiente o fuera de especificacion no detectada',
            5,
            'Scrap',
            'Parada de linea de ensamblaje en el cliente',
            'Degradacion de la funcion primaria del vehiculo / reclamo de aspecto',
            [
              mkCause(
                'Proporcion de mezcla incorrecta no detectada en esta etapa',
                5, 5, 7,
                'Hoja de proceso detalla como realizar la mezcla correctamente',
                'Inspeccion visual: el operador mira la mezcla',
                ''
              ),
              mkCause(
                'Exceso o falta de adhesivo no detectado en esta etapa',
                5, 5, 8,
                'Instrucciones de proceso: Documento estandar',
                'Pieza patron e Inspeccion visual',
                ''
              ),
            ]
          ),
        ]
      ),
    ]),
    mkWE('Hoja de operaciones', 'Method', [
      mkFunction(
        'Utilizar la Hoja de Operaciones vigente. Definir el plan de reaccion ante un No conforme. Ayudas visuales: mostrar como debe quedar el producto para evitar ciertos defectos',
        '',
        []
      ),
    ]),
  ]
);

// ── OP 101: CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME ─────
const op101 = mkOp(101, 'CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME', FOCUS_ELEM_FUNC,
  'Segregar producto (conforme y no conforme) segun plan de control; y prevenir el escape (y la mezcla) de piezas no conformes. Clasificar producto (conforme / no conforme) y segregar producto (al contenedor/ubicacion correspondiente)',
  [
    mkWE('Operador de calidad', 'Man', [
      mkFunction(
        'Identificar/clasificar producto (conforme y no conforme) y segregar producto (al contenedor de destino)',
        '',
        [
          mkFailure(
            'Pieza no conforme (NC) es clasificada como conforme (OK) (aprobar una parte mala)',
            7,
            'Fuerte posibilidad de incorporar procesos adicionales de clasificacion de productos defectuosos',
            'Parada de linea mayor a un turno de produccion completo o resulta en la suspension de envios',
            'Perdida de la funcion primaria del vehiculo necesaria para la conduccion normal',
            [
              mkCause(
                'Operador coloca pieza no conforme (NC) en el contenedor de embalaje/OK por error',
                7, 5, 8,
                'Instruccion visual',
                'Inspeccion visual',
                'SC'
              ),
              mkCause(
                'Contenedores de producto conforme (OK) y no conforme (NC) no estan claramente diferenciados o rotulados, provocando que el operador mezcle los destinos',
                7, 4, 8,
                'Instruccion visual',
                'Inspeccion visual',
                'SC'
              ),
            ]
          ),
          mkFailure(
            'Mezcla de producto no conforme (NC) con producto conforme (OK) en el contenedor de embalaje (contaminacion)',
            7,
            'Fuerte posibilidad de incorporar procesos adicionales de clasificacion de productos defectuosos',
            'Parada de linea entre una hora y un turno de produccion completo. Tambien podria requerir reparacion o reemplazo en el campo',
            'Perdida de la funcion primaria del vehiculo',
            [
              mkCause(
                'Operador coloca piezas NC en el contenedor de OK por error de distraccion. Contenedores no estan fisicamente separados o claramente identificados',
                7, 5, 8,
                'Instruccion visual',
                'Inspeccion visual',
                'SC'
              ),
            ]
          ),
          mkFailure(
            'Etiqueta o tarjeta de identificacion de scrap/retrabajo omitida',
            4,
            'Fuerte posibilidad de incorporar procesos adicionales de clasificacion de productos defectuosos',
            'Parada de linea (potencial)',
            'Perdida de la funcion primaria del vehiculo (potencial)',
            [
              mkCause(
                'Operador omite el paso de identificacion. Insumos de identificacion no disponibles en el puesto',
                4, 4, 8,
                'En el puesto requiere la colocacion de la etiqueta en el contenedor',
                'Inspeccion Visual',
                ''
              ),
            ]
          ),
        ]
      ),
    ]),
    mkWE('Hoja de operaciones', 'Method', [
      mkFunction(
        'Utilizar la Hoja de Operaciones vigente. Definir el plan de reaccion ante un No conforme',
        '',
        []
      ),
    ]),
    mkWE('Etiquetas de rechazo 100x60mm', 'Material', [
      mkFunction(
        'Identificar producto no conforme para segregacion',
        '',
        []
      ),
    ]),
  ]
);

// ── OP 103: REPROCESO: FALTA DE ADHESIVO ────────────────────────────
const op103 = mkOp(103, 'REPROCESO: FALTA DE ADHESIVO', FOCUS_ELEM_FUNC,
  'Restituir la capa de adhesivo en las areas del sustrato donde estaba ausente, asegurando la cobertura y el gramaje segun la especificacion original. Restaurar la conformidad del componente eliminando el defecto detectado',
  [
    mkWE('Operador de calidad', 'Man', [
      mkFunction(
        'Aplicar adhesivo en las areas omitidas utilizando la herramienta asignada (brocha/pistola), garantizando la continuidad de la capa adhesiva y la limpieza de la pieza',
        '',
        [
          mkFailure(
            'Falta de adhesivo / cobertura incompleta',
            5,
            'Scrap del 100%',
            'Paro de linea / problemas de ensamble',
            'Apariencia / ruido',
            [
              mkCause(
                'Omision por fatiga o distraccion: el operador olvida aplicar adhesivo en una seccion especifica por falta de ayudas visuales',
                5, 5, 8,
                'Instrucciones de proceso y ayudas visuales disponibles en el puesto',
                'Inspeccion de calidad',
                ''
              ),
              mkCause(
                'Instruccion deficiente: la hoja de operacion estandar de reproceso no especifica el patron de recorrido',
                5, 4, 3,
                'La hoja de instruccion detalla el metodo de aplicacion y el patron de recorrido',
                'Inspeccion de calidad',
                ''
              ),
              mkCause(
                'La herramienta manual no carga suficiente adhesivo o el adhesivo en el recipiente se seco parcialmente',
                5, 7, 5,
                'La pistola de adhesivado evita que se seque el adhesivo y carga una cantidad suficiente',
                'Inspeccion de calidad',
                ''
              ),
            ]
          ),
          mkFailure(
            'Exceso de adhesivo / se aplica adhesivo donde no corresponde',
            5,
            'Retrabajo en linea',
            'El exceso de pegamento interfiere con los clips o puntos de fijacion',
            'Vibracion, ruidos o aspecto',
            [
              mkCause(
                'Sobre-procesamiento: el operador aplica doble capa creyendo erroneamente que mas es mejor para asegurar el pegado',
                5, 3, 8,
                'La instruccion detalla que no se debe aplicar mas de 1 vez el adhesivo',
                'Inspeccion de calidad',
                ''
              ),
              mkCause(
                'No existe una plantilla o mascara de proteccion para tapar zonas donde no lleva adhesivo durante el reproceso manual',
                5, 5, 8,
                'Instrucciones de proceso detallan donde aplicar el adhesivo',
                'Inspeccion de calidad',
                ''
              ),
            ]
          ),
          mkFailure(
            'Mezcla de producto NC con Conforme (OK)',
            6,
            'Fuerte posibilidad de incorporar procesos adicionales de clasificacion',
            'Parada de linea o paro de envios',
            'Perdida de la funcion primaria del vehiculo',
            [
              mkCause(
                'Clasificacion y segregacion incorrecta de producto conforme y no conforme',
                6, 5, 8,
                'Hojas de operaciones / ayudas visuales',
                'Visual',
                ''
              ),
              mkCause(
                'Operador coloca piezas NC en el contenedor de OK',
                6, 5, 8,
                'Instruccion Visual',
                'Inspeccion Visual',
                ''
              ),
            ]
          ),
        ]
      ),
    ]),
    mkWE('Hoja de operaciones', 'Method', [
      mkFunction(
        'Utilizar la Hoja de Operaciones vigente. Definir el plan de reaccion ante un No conforme. Ayudas visuales: mostrar como debe quedar el producto para evitar ciertos defectos',
        '',
        []
      ),
    ]),
  ]
);


// ═══════════════════════════════════════════════════════════════════════
// MAIN — Fetch, backup, renumber/rename existing, add new ops, save, verify
// ═══════════════════════════════════════════════════════════════════════

const AMFE_ID = '5268704d-30ae-48f3-ad05-8402a6ded7fe';

console.log('=== Loading Armrest Door Panel AMFE operations ===');

// ── Fetch current AMFE ──────────────────────────────────────────────
const { data: doc, error: fetchErr } = await sb
  .from('amfe_documents')
  .select('*')
  .eq('id', AMFE_ID)
  .single();

if (fetchErr) {
  console.error('ERROR fetching AMFE:', fetchErr.message);
  process.exit(1);
}

// Parse if double-serialized
let amfeData = doc.data;
if (typeof amfeData === 'string') {
  amfeData = JSON.parse(amfeData);
  console.log('WARNING: data was double-serialized string, parsed it.');
}

console.log(`Current state: ${amfeData.operations.length} operations`);
for (const op of amfeData.operations) {
  const opNum = op.operationNumber || op.opNumber;
  const opName = op.operationName || op.name;
  console.log(`  OP ${opNum}: ${opName} (${(op.workElements || []).length} WEs)`);
}

// ── Backup before changes ───────────────────────────────────────────
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = new URL(`../backups/armrest-load-${ts}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
mkdirSync(backupDir, { recursive: true });
writeFileSync(`${backupDir}/amfe_before.json`, JSON.stringify(amfeData, null, 2));
console.log(`\nBackup saved to: ${backupDir}/amfe_before.json`);

// ── Deep clone for modification ─────────────────────────────────────
const data = JSON.parse(JSON.stringify(amfeData));

// ── Set focusElementFunction on ALL existing ops ────────────────────
for (const op of data.operations) {
  op.focusElementFunction = FOCUS_ELEM_FUNC;
  op.operationFunction = op.operationFunction || '';
}

// ── RENUMBER + RENAME existing operations ────────────────────────────
// Map: existingOpNum → { newNum, newName }
const renumberMap = {
  '10': { newNum: '10', newName: 'RECEPCION DE MATERIA PRIMA' },
  '20': { newNum: '20', newName: 'CORTE DE COMPONENTES' },
  '30': { newNum: '50', newName: 'COSTURA UNION' },
  '40': { newNum: '90', newName: 'TAPIZADO SEMIAUTOMATICO' },
  '50': { newNum: '100', newName: 'CONTROL FINAL DE CALIDAD' },
  '60': { newNum: '110', newName: 'EMBALAJE' },
};

console.log('\n=== Renumbering/renaming existing operations ===');
for (const op of data.operations) {
  const currentNum = String(op.operationNumber || op.opNumber);
  const mapping = renumberMap[currentNum];
  if (mapping) {
    const oldName = op.operationName || op.name;
    op.opNumber = mapping.newNum;
    op.operationNumber = mapping.newNum;
    op.name = mapping.newName;
    op.operationName = mapping.newName;
    console.log(`  OP ${currentNum} "${oldName}" → OP ${mapping.newNum} "${mapping.newName}"`);
  }
}

// ── Collect new operations ──────────────────────────────────────────
const newOps = [op15, op25, op40, op51, op60, op70, op72, op80, op81, op101, op103];

// Check that none of the new op numbers already exist
const existingOpNums = new Set(
  data.operations.map(op => String(op.operationNumber || op.opNumber))
);

console.log('\n=== Adding new operations ===');
for (const newOp of newOps) {
  if (existingOpNums.has(newOp.opNumber)) {
    console.error(`ERROR: OP ${newOp.opNumber} already exists in AMFE! Skipping.`);
    continue;
  }
  data.operations.push(newOp);
  existingOpNums.add(newOp.opNumber);
  console.log(`Added OP ${newOp.opNumber}: ${newOp.name}`);
}

// ── Sort operations by number ───────────────────────────────────────
data.operations.sort((a, b) => {
  const numA = parseInt(a.operationNumber || a.opNumber, 10);
  const numB = parseInt(b.operationNumber || b.opNumber, 10);
  return numA - numB;
});

// ── Summary before save ─────────────────────────────────────────────
console.log(`\n=== Operations after adding (${data.operations.length} total) ===`);
let totalCauses = 0;
for (const op of data.operations) {
  const opNum = op.operationNumber || op.opNumber;
  const opName = op.operationName || op.name;
  let opCauses = 0;
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const f of (fn.failures || [])) {
        opCauses += (f.causes || []).length;
      }
    }
  }
  totalCauses += opCauses;
  console.log(`  OP ${opNum}: ${opName} (${(op.workElements || []).length} WEs, ${opCauses} causes)`);
}
console.log(`Total causes across all operations: ${totalCauses}`);

// ── Verify AP calculations ──────────────────────────────────────────
console.log('\n=== Verifying AP calculations ===');
let apErrors = 0;
for (const op of data.operations) {
  for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
      for (const f of (fn.failures || [])) {
        for (const c of (f.causes || [])) {
          if (c.severity && c.occurrence && c.detection) {
            const expected = calculateAP(c.severity, c.occurrence, c.detection);
            const actual = c.ap || c.actionPriority;
            if (expected !== actual) {
              console.error(`  AP MISMATCH: OP ${op.operationNumber} cause "${c.description?.substring(0, 50)}..." — expected=${expected}, got=${actual}`);
              apErrors++;
            }
          }
        }
      }
    }
  }
}
if (apErrors === 0) {
  console.log('  All AP values verified OK');
} else {
  console.error(`  ${apErrors} AP mismatches found!`);
}

// ── Save to Supabase — pass object directly, NEVER JSON.stringify ───
console.log('\n=== Saving to Supabase ===');

const { error: updateErr } = await sb
  .from('amfe_documents')
  .update({ data: data })
  .eq('id', AMFE_ID);

if (updateErr) {
  console.error('ERROR saving:', updateErr.message);
  process.exit(1);
}
console.log('Saved to Supabase successfully.');

// ── Verify typeof data ──────────────────────────────────────────────
const { data: verifyDoc, error: verifyErr } = await sb
  .from('amfe_documents')
  .select('data')
  .eq('id', AMFE_ID)
  .single();

if (verifyErr) {
  console.error('ERROR verifying:', verifyErr.message);
  process.exit(1);
}

if (typeof verifyDoc.data === 'object') {
  console.log('VERIFIED: typeof data === "object"');
} else {
  console.error(`ERROR: typeof data === "${typeof verifyDoc.data}" — DOUBLE SERIALIZED!`);
  process.exit(1);
}

// Check operations array
if (Array.isArray(verifyDoc.data.operations)) {
  console.log(`VERIFIED: data.operations is array with ${verifyDoc.data.operations.length} operations`);
} else {
  console.error('ERROR: data.operations is not an array!');
  process.exit(1);
}

// Verify all expected ops exist
const expectedOps = ['10', '15', '20', '25', '40', '50', '51', '60', '70', '72', '80', '81', '90', '100', '101', '103', '110'];
for (const opNum of expectedOps) {
  const found = verifyDoc.data.operations.find(op =>
    String(op.operationNumber || op.opNumber) === opNum
  );
  if (found) {
    console.log(`  VERIFIED: OP ${opNum} "${found.operationName || found.name}" exists`);
  } else {
    console.error(`  ERROR: OP ${opNum} NOT FOUND after save!`);
  }
}

// Save after state
writeFileSync(`${backupDir}/amfe_after.json`, JSON.stringify(data, null, 2));
console.log(`\nAfter-state saved to: ${backupDir}/amfe_after.json`);

// Final summary
console.log('\n=== FINAL SUMMARY ===');
console.log(`AMFE ID: ${AMFE_ID}`);
console.log(`Operations before: ${amfeData.operations.length}`);
console.log(`Operations after: ${data.operations.length}`);
console.log(`Existing ops renumbered/renamed: ${Object.keys(renumberMap).length}`);
console.log(`New operations added: ${newOps.length}`);
console.log(`Total causes: ${totalCauses}`);
console.log('\nRenumbering applied:');
for (const [oldNum, { newNum, newName }] of Object.entries(renumberMap)) {
  console.log(`  OP ${oldNum} → OP ${newNum} "${newName}"`);
}
console.log('\nSkipped WIP storage ops: 30, 52, 61, 71, 82 (Almacenamiento en medios WIP)');
console.log('\nDone. Run `node scripts/_backup.mjs` next.');
process.exit(0);
