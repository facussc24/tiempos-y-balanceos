/**
 * Load Insert AMFE — All missing operations from AMFE_INSERT_Rev.txt
 *
 * AMFE ID: 7cfe2db7-9e5a-4b46-804d-76194557c581
 * Project: VWA/PATAGONIA/INSERT
 *
 * Current state: Only OP 5 (RECEPCION) with 15 causes.
 * This script adds 12 operations parsed from the TXT:
 *   OP 15: PREPARACION DE CORTE
 *   OP 20: CORTE DE COMPONENTES
 *   OP 25: CONTROL CON MYLAR
 *   OP 50: COSTURA CNC
 *   OP 60: TROQUELADO DE ESPUMA
 *   OP 70: INYECCION DE PIEZAS PLASTICAS
 *   OP 90: ADHESIVADO
 *   OP 91: INSPECCION DE PIEZA ADHESIVADA
 *   OP 103: REPROCESO FALTA DE ADHESIVO
 *   OP 110: CONTROL FINAL DE CALIDAD
 *   OP 111: CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME
 *   OP 120: EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO
 *
 * Skipped (WIP storage, per rules):
 *   OP 30, OP 61, OP 71, OP 81, OP 92
 *
 * Skipped (already loaded):
 *   OP 10 (RECEPCION) — already exists as OP 5
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

// ── Common focusElementFunction (same for all INSERT ops) ───────────
const FOCUS_ELEM_FUNC =
  'Interno: Proveer piezas cortadas y ensambladas conformes a especificaciones dimensionales y de apariencia / ' +
  'Cliente: Permitir ensamble en panel de puerta sin interferencias / ' +
  'Usr. Final: Garantizar apariencia estetica y funcionalidad del interior de puerta';


// ═══════════════════════════════════════════════════════════════════════
// OPERATION DEFINITIONS — Parsed from AMFE_INSERT_Rev.txt
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
            8,
            'Perdida de material (scrap)',
            'Imposibilidad de ensamblar la pieza, potencial paro de linea',
            'Posible ruido o falla estetica',
            [
              mkCause(
                'Parametros de corte mal ingresados en maquina',
                8, 7, 10,
                'Medicion de la primera capa usando la regla metalica fija como referencia. Uso de la primera capa como plantilla para alinear las capas subsecuentes',
                'No se realiza una medicion del pano una vez cortado',
                'SC'
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
    mkWE('Mylar de control', 'Material', [
      mkFunction(
        'Asegurar la trazabilidad univoca y la clasificacion correcta del producto (conforme y no conforme)',
        '',
        []
      ),
    ]),
  ]
);

// ── OP 20: CORTE DE COMPONENTES ─────────────────────────────────────
const op20 = mkOp(20, 'CORTE DE COMPONENTES', FOCUS_ELEM_FUNC,
  'Lograr el contorno/forma geometrica del patron conforme al mylar. Utilizar los panos previamente cortados en maquina de corte automatico. Cortar y obtener componentes de las piezas con su forma y dimensiones exactas',
  [
    mkWE('Maquina de corte', 'Machine', [
      mkFunction(
        'Fijar el material al area de trabajo mediante vacio. Cortar el material con cuchilla segun programa',
        '',
        [
          mkFailure(
            'Desviacion en el corte de los pliegos',
            7,
            'Retrabajo',
            'Parada de linea entre una hora y un turno de produccion completo',
            'Degradacion de la funcion secundaria del vehiculo',
            [
              mkCause(
                'Parametros de corte mal ingresados',
                7, 3, 7,
                'La maquina alinea y corta automaticamente el vinilo/tela',
                'Set up de lanzamiento / Regla / Inspeccion visual',
                ''
              ),
              mkCause(
                'Falla en la maquina de corte',
                7, 6, 8,
                'Instructivo para colocar correctamente tension y velocidad de rollo',
                'Inspeccion visual',
                'SC'
              ),
            ]
          ),
          mkFailure(
            'Material incorrecto cargado en maquina',
            8,
            '100% del material cortado es scrap por material incorrecto',
            'Parada de linea mayor a un turno de produccion completo. Paro de envios',
            'Degradacion de la funcion primaria del vehiculo',
            [
              mkCause(
                'Falta de verificacion del codigo de material antes del corte',
                8, 5, 6,
                'Orden automatica del sistema: el sistema emite la orden con los datos correctos',
                'Inspeccion visual (hoja vs. etiqueta): el operario compara visualmente la etiqueta del rollo contra la planilla de mesa',
                'SC'
              ),
              mkCause(
                'Vinilo mal identificado / seleccion incorrecta del material',
                8, 6, 7,
                'Etiquetado estandar (logistica): procedimiento de identificacion en almacen',
                'Inspeccion visual de atributos: el operador verifica color/grano, no solo la etiqueta',
                'SC'
              ),
            ]
          ),
        ]
      ),
    ]),
    mkWE('Operador de produccion', 'Man', [
      mkFunction(
        'Utilizar los panos previamente cortados de un rollo en maquina de corte automatico. Cortar y obtener componentes de las piezas con su forma y dimensiones exactas',
        '',
        [
          mkFailure(
            'Contaminacion del material durante el corte o almacenamiento en el area',
            5,
            'Retrabajo de una porcion de la produccion',
            'Menos del 10% de los productos afectados, requiere clasificacion adicional',
            'Defecto visual moderado en apariencia o vibracion',
            [
              mkCause(
                'Ambiente de trabajo con polvo o particulas',
                5, 3, 6,
                'Procedimientos de limpieza periodica en el area de corte',
                'Inspeccion visual (el operador verifica visualmente el material antes/durante el proceso)',
                ''
              ),
            ]
          ),
          mkFailure(
            'Corte incompleto o irregular',
            7,
            'Una porcion de la produccion tiene que ser descartada (scrap)',
            'Parada de linea entre una hora y un turno de produccion completo',
            'Degradacion de la funcion secundaria del vehiculo',
            [
              mkCause(
                'Desgaste de la cuchilla de corte',
                7, 5, 7,
                'Cambio de cuchillas por calendario u horas de uso',
                'Verificacion de cuchilla en set up de lanzamiento',
                'SC'
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

// ── OP 25: CONTROL CON MYLAR ────────────────────────────────────────
const op25 = mkOp(25, 'CONTROL CON MYLAR', FOCUS_ELEM_FUNC,
  'Asegurar la conformidad dimensional del contorno cortado',
  [
    mkWE('Mylar de control', 'Measurement', [
      mkFunction(
        'Asegurar la verificacion rapida y precisa de la geometria y el contorno del corte conforme a las tolerancias especificas',
        '',
        [
          mkFailure(
            'Omision de la operacion de inspeccion',
            8,
            'Generacion de scrap',
            'Parada de linea de produccion (menor a una hora) o necesidad de incorporar procesos adicionales de clasificacion de productos defectuosos',
            'Perdida de la funcion secundaria del vehiculo',
            [
              mkCause(
                'Operador de produccion omite la tarea de verificacion visual',
                8, 6, 9,
                'Instruccion/checklist de set up',
                'Auditorias internas',
                'SC'
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

// ── OP 50: COSTURA CNC ──────────────────────────────────────────────
const op50 = mkOp(50, 'COSTURA CNC', FOCUS_ELEM_FUNC,
  'Unir piezas de tela (segun especificacion de costura); y obtener ensamble sin scrap o reprocesos',
  [
    mkWE('Maquina de costura CNC', 'Machine', [
      mkFunction(
        'Ejecutar patron de costura segun programa. Controlar tension de hilo y posicion de plantilla',
        '',
        [
          mkFailure(
            'Falla en el sensor de deteccion de plantilla o suciedad en el lector',
            8,
            '100% de la produccion es descartada (scrap)',
            'Parada de linea mayor a un turno completo',
            'Perdida de la funcion primaria del vehiculo. Muy objetiva la apariencia, vibracion o ruidos',
            [
              mkCause(
                'Maquina: perdida de presion de aire',
                8, 4, 8,
                'Control preventivo del filtro de aire',
                'Detectar fugas: usar el oido para hallar perdidas neumaticas',
                'SC'
              ),
              mkCause(
                'Metodo: falta de definicion de topes fisicos o guias en la mesa de carga',
                8, 4, 8,
                'La maquina cuenta con topes fisicos - Hoja de proceso / ayudas visuales',
                'Puesta a punto (set-up) / Auditoria de proceso',
                ''
              ),
            ]
          ),
          mkFailure(
            'Ruptura o enredo del hilo (superior o inferior) o costura incompleta/saltada',
            8,
            '100% de la produccion tiene que ser descartada (scrap) o requiere retrabajo fuera de linea',
            'Parada de linea mayor a un turno de produccion completo',
            'Perdida de la funcion primaria del vehiculo. Muy objetiva la apariencia, vibracion o ruidos',
            [
              mkCause(
                'Mano de obra: el operador instalo incorrectamente el hilo inferior. O el operador dejo un exceso de hilo (mas de 6 cm) al inicio o al final del ciclo de costura',
                8, 7, 8,
                'Hoja de operaciones / ayudas visuales',
                'Puesta a punto (set-up) / Plan de control',
                'SC'
              ),
              mkCause(
                'Maquina: falla en el sistema de tension electronica del hilo / falla o desajuste de la cuchilla del sistema de corte automatico de hilo / falta de lubricacion en el gancho o guias',
                8, 4, 8,
                'Mantenimiento preventivo planificado',
                'Prueba inicial (setup)',
                'SC'
              ),
              mkCause(
                'Materiales: aguja inadecuada para el grosor del material',
                8, 5, 8,
                'Hoja de proceso indica que aguja se debe utilizar',
                'Control de recepcion / certificados de calidad / puesta a punto (set up)',
                'SC'
              ),
              mkCause(
                'Metodo: el procedimiento de instalacion/ajuste de tension es ambiguo o no esta documentado claramente',
                8, 7, 9,
                'Hoja de operaciones',
                'Puesta a punto (set-up) / Auditoria de proceso',
                'SC'
              ),
            ]
          ),
          mkFailure(
            'Patron de costura (programa) cargado no coincide con la plantilla fisica instalada',
            8,
            '100% de la produccion tiene que ser descartada (scrap) debido a que la costura se realiza en la ubicacion incorrecta',
            'Parada de linea mayor a un turno de produccion completo',
            'Perdida de la funcion primaria del vehiculo. Muy objetiva la apariencia, vibracion o ruidos',
            [
              mkCause(
                'Mano de obra: el operador ingresa el codigo manualmente en lugar de usar el escaner',
                8, 7, 8,
                'Hoja de operaciones',
                'Plan de control / puesta a punto (set-up)',
                'SC'
              ),
              mkCause(
                'Maquina (software): fallo de la interfaz HMI o software: la maquina ejecuta un patron predeterminado o un programa antiguo a pesar de que el operador selecciono el programa correcto',
                8, 4, 8,
                'Mantenimiento preventivo',
                'Puesta a punto (set-up)',
                'SC'
              ),
              mkCause(
                'Maquina (sensor): el sensor que deberia validar la presencia y el tipo de plantilla esta descalibrado o no funciona correctamente, permitiendo el inicio del ciclo',
                8, 4, 4,
                'Plan de limpieza / mantenimiento (limpieza de lentes/sensores)',
                'Prueba de error (pasar una plantilla incorrecta para ver si la maquina la rechaza)',
                ''
              ),
              mkCause(
                'Metodo: el procedimiento de set-up no exige una verificacion cruzada clara y documentada (ej., lista de verificacion o doble verificacion) entre el codigo del patron y el codigo de la plantilla',
                8, 7, 9,
                'Hoja de proceso',
                'Auditoria de proceso',
                'SC'
              ),
            ]
          ),
          mkFailure(
            'Fallo o degradacion del componente de la maquina debido a suciedad, friccion o desgaste prematuro',
            8,
            '100% de la produccion tiene que ser descartada (scrap) por fallas mecanicas que causan costuras fuera de especificacion. O desvio del proceso primario con reduccion de velocidad o mano de obra adicional',
            'Parada de linea mayor a un turno de produccion completo. O parada de linea menor a una hora',
            'Perdida de la funcion primaria del vehiculo. Degradacion de la funcion primaria del vehiculo',
            [
              mkCause(
                'Mano de obra: el operador (o personal de mantenimiento) omite o realiza incorrectamente el procedimiento de limpieza/lubricacion al finalizar el turno',
                8, 7, 9,
                'Ayudas visuales',
                'Auditoria de 5S',
                'SC'
              ),
              mkCause(
                'Maquina: fallo en los indicadores de mantenimiento (p. ej., contadores de ciclo) que deberian recordar la necesidad de lubricacion o reemplazo de piezas',
                8, 4, 8,
                'Mantenimiento preventivo',
                'Visual humano',
                'SC'
              ),
              mkCause(
                'Materiales: el aceite/lubricante utilizado no es el especificado o esta contaminado, lo que genera friccion o corrosion a largo plazo',
                8, 4, 8,
                'Gestion de proveedores y especificacion tecnica del insumo',
                'Recepcion de materiales / identificacion: etiquetado claro del envase antes del uso',
                'SC'
              ),
              mkCause(
                'Metodo: el procedimiento de mantenimiento preventivo/limpieza es inadecuado o no documenta la frecuencia y el tipo de lubricante requerido',
                8, 7, 9,
                'Instructivo general de mantenimiento (I-MT-001): documento mandatorio que define que, como y cuando lubricar',
                'Auditoria de proceso',
                'SC'
              ),
            ]
          ),
        ]
      ),
    ]),
    mkWE('Operador de produccion', 'Man', [
      mkFunction(
        'Colocacion de material dentro de la plantilla. Operador de costura CNC',
        '',
        [
          mkFailure(
            'Colocacion de material dentro de la plantilla con pliegues o tension desigual',
            8,
            '100% de la produccion es descartada (scrap)',
            'Parada de linea mayor a un turno completo',
            'Perdida de la funcion primaria del vehiculo',
            [
              mkCause(
                'Colocacion de material dentro de la plantilla con pliegues o tension desigual',
                8, 7, 8,
                'Hoja de proceso / ayudas visuales',
                'Puesta a punto (set-up) / Plan de control',
                'SC'
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
    mkWE('Piquete', 'Material', [
      mkFunction(
        'Eliminar/cortar hilos sobrantes, rebabas textiles o pequenas imperfecciones alrededor de las uniones de costura',
        '',
        []
      ),
    ]),
  ]
);

// ── OP 60: TROQUELADO DE ESPUMA ─────────────────────────────────────
const op60 = mkOp(60, 'TROQUELADO DE ESPUMA', FOCUS_ELEM_FUNC,
  'Proveer piezas troqueladas de espuma conformes a especificacion (dimensiones y geometria) a la siguiente etapa de la linea, sin generar scrap o reparaciones, y dentro del tiempo de ciclo determinado',
  [
    mkWE('Troqueladora puente', 'Machine', [
      mkFunction(
        'Aplicar la fuerza y precision de corte para formar la pieza. Generar la geometria/contorno final de la pieza troquelada, respetando las tolerancias dimensionales y la cantidad de capas',
        '',
        [
          mkFailure(
            'Parte ensamblada con material incorrecto',
            8,
            '100% de la produccion tiene que ser scrapeada',
            'Parada de linea entre una hora y un turno de produccion completo. Paro de envios',
            'Degradacion de la funcion primaria del vehiculo',
            [
              mkCause(
                'Operario selecciona material incorrecto',
                8, 5, 8,
                'La instruccion de proceso y la lista de materiales detallan que material utilizar / identificacion con codigo correcto correspondiente',
                'Inspeccion humana visual / set up de lanzamiento',
                'SC'
              ),
            ]
          ),
          mkFailure(
            'Material fuera de posicion',
            8,
            '100% de la produccion tiene que ser scrapeada',
            'Parada de linea entre una hora y un turno de produccion completo',
            'Degradacion de la funcion primaria del vehiculo',
            [
              mkCause(
                'Operario no alinea la pieza con la referencia visual',
                8, 6, 8,
                'Marcas visuales para posicionado',
                'Control visual de posicionado',
                'SC'
              ),
            ]
          ),
          mkFailure(
            'Troquel/herramental incorrecto en la maquina',
            7,
            'Una porcion de la produccion tiene que ser scrapeada',
            'Parada de linea entre una hora y un turno de produccion completo. Posible paro de envios',
            'Degradacion de la funcion primaria del vehiculo',
            [
              mkCause(
                'Operario selecciona troquel equivocado',
                7, 6, 8,
                'Identificacion correcta de troqueles y codificacion colocada en HO (documentacion/instruccion)',
                'Control visual de troquel a utilizar segun HO (inspeccion humana)',
                'SC'
              ),
            ]
          ),
          mkFailure(
            'Fallo en la conformacion de la pieza',
            8,
            '100% de la produccion tiene que ser scrapeada',
            'Parada de linea entre una hora y un turno de produccion completo',
            'Perdida de la funcion primaria del vehiculo',
            [
              mkCause(
                'Desgaste o dano del utillaje/troquel',
                8, 3, 8,
                'Mantenimiento preventivo y predictivo del troquel',
                'Inspeccion visual 100% de la pieza',
                ''
              ),
            ]
          ),
        ]
      ),
    ]),
    mkWE('Operador de produccion', 'Man', [
      mkFunction(
        'Posicionar el componente y accionar el ciclo de la maquina troqueladora conforme a la instruccion',
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

// ── OP 70: INYECCION DE PIEZAS PLASTICAS ────────────────────────────
const op70 = mkOp(70, 'INYECCION DE PIEZAS PLASTICAS', FOCUS_ELEM_FUNC,
  'Fabricar la pieza plastica cumpliendo con las especificaciones dimensionales y de apariencia, dentro del tiempo de ciclo establecido, sin generar scrap, rebabas ni necesidad de retrabajos posteriores',
  [
    mkWE('Maquina inyectora de plastico', 'Machine', [
      mkFunction(
        'Inyectar el material en el molde controlando los parametros de proceso (presion, temperatura, tiempo) para garantizar el llenado y enfriamiento correcto segun la ficha tecnica',
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
                8, 5, 7,
                'Monitoreo automatico de presion y mantenimiento preventivo con calibracion periodica de sensores',
                'Deteccion automatica de llenado incompleto',
                'SC'
              ),
              mkCause(
                'Temperatura de fusion del material demasiado baja',
                8, 4, 8,
                'Mantenimiento y calibracion del sistema termico. Verificacion estandar de la configuracion de potencia',
                'Verificacion visual y dimensional de aprobacion de la primera pieza tras el set-up o cambio de turno, realizada por el operador/calidad',
                'SC'
              ),
              mkCause(
                'Parametros de inyeccion configurados incorrectamente',
                8, 5, 8,
                'Instruccion de set-up estandarizada (Plan de Control / Hoja de Proceso) que detalla los valores nominales y rangos de tolerancia para todos los parametros criticos (presion, temperatura, tiempos, velocidad)',
                'Aprobacion de la primera pieza (first piece approval): inspeccion de los parametros de la maquina y verificacion dimensional de la pieza por personal de calidad/supervision antes de liberar la produccion',
                'SC'
              ),
              mkCause(
                'Sensores de la maquina descalibrados',
                8, 4, 7,
                'Mantenimiento preventivo y calibracion de sensores de la maquina para asegurar que la lectura de los parametros es precisa',
                'Monitoreo automatico de parametros',
                ''
              ),
            ]
          ),
          mkFailure(
            'Omision de la operacion de inspeccion dimensional de cotas index',
            8,
            'Una porcion de la produccion requiere retrabajo fuera de linea',
            'Se desencadena un plan de reaccion importante',
            'Degradacion de la funcion secundaria',
            [
              mkCause(
                'Operador omite la verificacion dimensional de la cota index',
                8, 7, 9,
                'Lista de verificacion (checklist) para asegurar que el paso se incluya al inicio del turno',
                'Auditoria de proceso',
                'SC'
              ),
              mkCause(
                'Instruccion de trabajo ambigua sobre la frecuencia o la metodologia de la inspeccion de la cota index',
                8, 5, 9,
                'Las hojas de proceso describen el metodo operativo y las pautas de control del plan de control, elaboradas por el equipo de diseno e implementacion',
                'Cada dos meses se verifica una pieza con su documentacion; las diferencias se registran como no conformidades internas',
                'SC'
              ),
            ]
          ),
          mkFailure(
            'Rebaba excesiva / exceso de material',
            7,
            'Una porcion de la produccion requiere retrabajo fuera de linea y aceptada',
            'Parada de linea de produccion menor a una hora',
            'Perdida de la funcion secundaria del vehiculo',
            [
              mkCause(
                'Fuerza de cierre insuficiente',
                7, 5, 3,
                'Mantenimiento preventivo (MP) programado de la unidad de cierre / instruccion de set-up detallada para configuracion de clamping force',
                'Monitoreo automatico de presion de cierre (primario) / inspeccion dimensional manual por muestreo (secundario)',
                ''
              ),
              mkCause(
                'Molde o cavidad contaminada con material residual',
                7, 5, 8,
                'Procedimiento de limpieza y purga estandarizado para la cavidad y linea de particion del molde antes de cada set-up o despues de interrupciones',
                'Inspeccion visual por parte del operador de la cavidad',
                ''
              ),
              mkCause(
                'Desgaste del molde (linea de particion)',
                7, 3, 8,
                'Mantenimiento preventivo del molde para verificar el correcto sellado de la linea de particion',
                'Inspeccion visual por parte del operador de la cavidad',
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

// ── OP 90: ADHESIVADO ───────────────────────────────────────────────
const op90 = mkOp(90, 'ADHESIVADO', FOCUS_ELEM_FUNC,
  'Entregar la pieza inyectada y adhesivada sin defectos, sin necesidad de reprocesos o scrap, dentro del tiempo de ciclo. Aplicar adhesivo y unir piezas, logrando una adhesion completa y uniforme',
  [
    mkWE('Pistola de adhesivado', 'Machine', [
      mkFunction(
        'Aplicar adhesivo de forma uniforme y controlada',
        '',
        [
          mkFailure(
            'Adhesion insuficiente o fuera de especificacion',
            8,
            'Scrap (100% de la produccion debe ser descartada)',
            'Parada de linea de ensamblaje en el cliente',
            'Degradacion de la funcion primaria del vehiculo / reclamo de aspecto',
            [
              mkCause(
                'Uso de adhesivo o reticulante vencido/degradado (mala gestion de materiales)',
                8, 4, 5,
                'Set-up de lanzamiento: verificacion manual de fechas de caducidad',
                'Gestion de stock (FIFO)',
                'SC'
              ),
              mkCause(
                'Proporcion de mezcla incorrecta',
                8, 7, 8,
                'Hoja de proceso detalla como realizar la mezcla correctamente',
                'Inspeccion visual: el operador mira la mezcla',
                'SC'
              ),
              mkCause(
                'Exceso o falta de adhesivo',
                8, 7, 8,
                'Instrucciones de proceso: documento estandar',
                'Pieza patron e inspeccion visual: comparacion visual contra muestra limite',
                'SC'
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

// ── OP 91: INSPECCION DE PIEZA ADHESIVADA ───────────────────────────
const op91 = mkOp(91, 'INSPECCION DE PIEZA ADHESIVADA', FOCUS_ELEM_FUNC,
  'Verificar la conformidad de la adhesion y la caracteristica visual del producto, segun requisitos/especificacion',
  [
    mkWE('Operador de produccion', 'Man', [
      mkFunction(
        'Tomar pieza adhesivada, inspeccionar criterios visuales y colocar en scrap o medio OK',
        '',
        [
          mkFailure(
            'Adhesion insuficiente o fuera de especificacion no detectada',
            8,
            'Scrap (100% de la produccion debe ser descartada)',
            'Parada de linea de ensamblaje en el cliente',
            'Degradacion de la funcion primaria del vehiculo / reclamo de aspecto',
            [
              mkCause(
                'Uso de adhesivo o reticulante vencido/degradado (mala gestion de materiales)',
                8, 4, 5,
                'Set-up de lanzamiento: verificacion manual de fechas de caducidad',
                'Gestion de stock (FIFO)',
                'SC'
              ),
              mkCause(
                'Proporcion de mezcla incorrecta',
                8, 7, 8,
                'Hoja de proceso detalla como realizar la mezcla correctamente',
                'Inspeccion visual: el operador mira la mezcla',
                'SC'
              ),
              mkCause(
                'Exceso o falta de adhesivo',
                8, 7, 8,
                'Instrucciones de proceso: documento estandar',
                'Pieza patron e inspeccion visual: comparacion visual contra muestra limite',
                'SC'
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

// ── OP 103: REPROCESO FALTA DE ADHESIVO ─────────────────────────────
const op103 = mkOp(103, 'REPROCESO FALTA DE ADHESIVO', FOCUS_ELEM_FUNC,
  'Restaurar la conformidad del componente (sustrato/vinilo) eliminando el defecto detectado, asegurando que cumpla las especificaciones originales para continuar al siguiente paso de manufactura sin generar scrap ni cuellos de botella. Restituir la capa de adhesivo en las areas del sustrato donde estaba ausente, asegurando la cobertura y el gramaje segun la especificacion original',
  [
    mkWE('Operador de calidad', 'Man', [
      mkFunction(
        'Aplicar adhesivo en las areas omitidas utilizando la herramienta asignada (brocha/pistola), garantizando la continuidad de la capa adhesiva y la limpieza de la pieza',
        '',
        [
          mkFailure(
            'Falta de adhesivo / cobertura incompleta',
            8,
            'Scrap del 100%',
            'Paro de linea / problemas de ensamble',
            'Apariencia / ruido',
            [
              mkCause(
                'Omision por fatiga o distraccion: el operador olvida aplicar adhesivo en una seccion especifica (ej. esquinas o bordes) por falta de ayudas visuales',
                8, 6, 8,
                'Instrucciones de proceso y ayudas visuales disponibles en el puesto',
                'Inspeccion de calidad',
                'SC'
              ),
              mkCause(
                'Instruccion deficiente: la hoja de operacion estandar (SOS) de reproceso no especifica el patron de recorrido',
                8, 4, 8,
                'La hoja de instruccion detalla el metodo de aplicacion y el patron de recorrido',
                'Inspeccion de calidad',
                'SC'
              ),
              mkCause(
                'La herramienta manual no carga suficiente adhesivo o el adhesivo en el recipiente se seco parcialmente',
                8, 4, 8,
                'La pistola de adhesivado evita que se seque el adhesivo y carga una cantidad suficiente',
                'Inspeccion de calidad',
                ''
              ),
            ]
          ),
          mkFailure(
            'Exceso de adhesivo / se aplica adhesivo donde no corresponde',
            6,
            'Retrabajo en linea',
            'El exceso de pegamento interfiere con los clips o puntos de fijacion del IP a la carroceria',
            'Vibracion, ruidos o aspecto',
            [
              mkCause(
                'Sobre-procesamiento: el operador aplica doble capa creyendo erroneamente que mas es mejor para asegurar el pegado',
                6, 5, 8,
                'La instruccion detalla que no se debe aplicar mas de 1 vez el adhesivo',
                'Inspeccion de calidad',
                'SC'
              ),
              mkCause(
                'No existe una plantilla o mascara de proteccion para tapar zonas donde no lleva adhesivo durante el reproceso manual',
                6, 7, 8,
                'Instrucciones de proceso detallan donde aplicar el adhesivo',
                'Inspeccion de calidad',
                'SC'
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

// ── OP 110: CONTROL FINAL DE CALIDAD ────────────────────────────────
const op110 = mkOp(110, 'CONTROL FINAL DE CALIDAD', FOCUS_ELEM_FUNC,
  'Asegurar la conformidad del producto terminado (segun el plan de control); y prevenir el escape de piezas no conformes de la planta. Verificar/confirmar la conformidad del producto terminado (segun plan de control)',
  [
    mkWE('Operador de calidad', 'Man', [
      mkFunction(
        'Verificar/inspeccionar producto (segun plan de control/especificaciones)',
        '',
        [
          mkFailure(
            'Vinilo despegado',
            8,
            'SCRAP',
            'Rechazo de piezas',
            'Reclamo de apariencia',
            [
              mkCause(
                'Falta / ausencia de adhesivo',
                8, 4, 8,
                'Hojas de operaciones / ayudas visuales',
                'Visual',
                'SC'
              ),
            ]
          ),
          mkFailure(
            'Aprobacion de pieza no conforme',
            5,
            'Una porcion de la produccion requiere retrabajo fuera de linea y aceptada',
            'Producto defectuoso desencadena un plan de reaccion importante',
            'Degradacion de la funcion secundaria del vehiculo',
            [
              mkCause(
                'Omision o error en la ejecucion de la verificacion',
                5, 5, 8,
                'Lista de verificacion (checklist) y mantenimiento/calibracion de instrumentos',
                'Auditoria de proceso y verificacion manual/visual',
                'SC'
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
    mkWE('Lapicera', 'Material', [
      mkFunction(
        'Registrar informacion de trazabilidad o clasificacion de forma clara y permanente',
        '',
        []
      ),
    ]),
    mkWE('Bolsas plasticas', 'Material', [
      mkFunction(
        'Proteger semiterminados y contener producto durante el transporte interno dentro de la planta',
        '',
        []
      ),
    ]),
  ]
);

// ── OP 111: CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME ─────
const op111 = mkOp(111, 'CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME', FOCUS_ELEM_FUNC,
  'Segregar producto (conforme y no conforme) segun plan de control; y prevenir el escape (y la mezcla) de piezas no conformes. Clasificar producto (conforme / no conforme) y segregar producto (al contenedor/ubicacion correspondiente)',
  [
    mkWE('Operador de calidad', 'Man', [
      mkFunction(
        'Identificar/clasificar producto (conforme y no conforme) y segregar producto (al contenedor de destino)',
        '',
        [
          mkFailure(
            'Pieza no conforme (NC) es clasificada como conforme (OK) (aprobar una parte mala)',
            8,
            'Fuerte posibilidad de incorporar procesos adicionales de clasificacion de productos defectuosos',
            'Parada de linea mayor a un turno de produccion completo o resulta en la suspension de envios',
            'Perdida de la funcion primaria del vehiculo necesaria para la conduccion normal',
            [
              mkCause(
                'Operador coloca pieza no conforme (NC) en el contenedor de embalaje/OK por error',
                8, 8, 8,
                'Instruccion visual',
                'Inspeccion visual',
                'SC'
              ),
              mkCause(
                'Contenedores de producto conforme (OK) y no conforme (NC) no estan claramente diferenciados o rotulados, provocando que el operador mezcle los destinos',
                8, 8, 8,
                'Instruccion visual',
                'Inspeccion visual',
                'SC'
              ),
              mkCause(
                'Instruccion de trabajo del puesto de clasificacion y segregacion es ambigua respecto al destino final de las piezas',
                8, 8, 8,
                'Instruccion visual',
                'Inspeccion visual',
                'SC'
              ),
            ]
          ),
          mkFailure(
            'Mezcla de producto no conforme (NC) con producto conforme (OK) en el contenedor de embalaje (contaminacion)',
            8,
            'Fuerte posibilidad de incorporar procesos adicionales de clasificacion de productos defectuosos',
            'Parada de linea entre una hora y un turno de produccion completo. Tambien podria requerir reparacion o reemplazo en el campo',
            'Perdida de la funcion primaria del vehiculo',
            [
              mkCause(
                'Operador coloca piezas NC en el contenedor de OK por error de distraccion. Contenedores no estan fisicamente separados o claramente identificados (falta de rotulos o diferenciacion por color). El proceso de traslado no esta disenado para evitar la proximidad y el traslape de los contenedores OK y NC',
                8, 7, 8,
                'Instruccion visual',
                'Inspeccion visual',
                'SC'
              ),
            ]
          ),
          mkFailure(
            'Etiqueta o tarjeta de identificacion de scrap/retrabajo omitida',
            8,
            'Fuerte posibilidad de incorporar procesos adicionales de clasificacion de productos defectuosos',
            'Parada de linea (potencial)',
            'Perdida de la funcion primaria del vehiculo (potencial)',
            [
              mkCause(
                'Operador omite el paso de identificacion. Insumos de identificacion no disponibles: no hay etiquetas/tarjetas preimpresas o la lapicera para escribir la informacion de scrap no funciona. El procedimiento de segregacion no requiere la colocacion de la tarjeta/etiqueta antes de la colocacion en el contenedor NC, permitiendo la omision del paso',
                8, 1, 8,
                'Instruccion visual',
                'Inspeccion visual',
                'SC'
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
    mkWE('Etiquetas blancas 100x60mm', 'Material', [
      mkFunction(
        'Identificar producto/kit. Asegurar trazabilidad',
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

// ── OP 120: EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO ─────────────
const op120 = mkOp(120, 'EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO', FOCUS_ELEM_FUNC,
  'Mantener/asegurar la integridad fisica y la conformidad del producto (al protegerlo de danos y contaminacion); y establecer/garantizar la trazabilidad y conteo exacto de las piezas. Obtener producto conforme, correctamente contenido y protegido (en bolsas/embalaje), y con trazabilidad establecida (etiquetas)',
  [
    mkWE('Operador de calidad', 'Man', [
      mkFunction(
        'Identificar/clasificar producto (conforme y no conforme) y segregar producto (al contenedor de destino)',
        '',
        [
          mkFailure(
            'Pieza deformada por mal posicionamiento en el embalaje',
            8,
            'Dano permanente en la espuma o en la costura',
            'Paro de linea temporal o devolucion del lote',
            'Defecto notorio y disconformidad inmediata',
            [
              mkCause(
                'Mal posicionamiento / sin separadores',
                8, 3, 8,
                'Uso de separadores, bandejas o estructuras que mantienen la forma del producto durante el embalaje y almacenaje',
                'Inspeccion visual del operador (al momento de ubicar)',
                ''
              ),
            ]
          ),
          mkFailure(
            'Colocacion de mayor o menor cantidad de piezas por medio',
            4,
            '100% produccion requiere retrabajo en estacion',
            'Plan de reaccion importante por desvio de cantidad (stock incorrecto, paro leve)',
            'El error se corrige antes de llegar al usuario',
            [
              mkCause(
                'Falta de control en la cantidad cargada por medio debido a ausencia de guia visual o desatencion del operador',
                4, 3, 6,
                'Estandar visual con foto de referencia indicando la cantidad por medio, visible en el puesto de trabajo',
                'Verificacion visual del medio completo antes del cierre',
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
    mkWE('Etiquetas blancas 100x60mm', 'Material', [
      mkFunction(
        'Identificar producto/kit. Asegurar trazabilidad',
        '',
        []
      ),
    ]),
    mkWE('Bolsas plasticas', 'Material', [
      mkFunction(
        'Proteger semiterminados y contener producto durante el transporte interno dentro de la planta',
        '',
        []
      ),
    ]),
  ]
);


// ═══════════════════════════════════════════════════════════════════════
// MAIN — Fetch, backup, add operations, save, verify
// ═══════════════════════════════════════════════════════════════════════

const AMFE_ID = '7cfe2db7-9e5a-4b46-804d-76194557c581';

console.log('=== Loading Insert AMFE operations ===');

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
const backupDir = new URL(`../backups/insert-load-${ts}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
mkdirSync(backupDir, { recursive: true });
writeFileSync(`${backupDir}/amfe_before.json`, JSON.stringify(amfeData, null, 2));
console.log(`\nBackup saved to: ${backupDir}/amfe_before.json`);

// ── Deep clone for modification ─────────────────────────────────────
const data = JSON.parse(JSON.stringify(amfeData));

// ── Collect new operations ──────────────────────────────────────────
const newOps = [op15, op20, op25, op50, op60, op70, op90, op91, op103, op110, op111, op120];

// Check that none of the new op numbers already exist
const existingOpNums = new Set(
  data.operations.map(op => String(op.operationNumber || op.opNumber))
);

for (const newOp of newOps) {
  if (existingOpNums.has(newOp.opNumber)) {
    console.error(`ERROR: OP ${newOp.opNumber} already exists in AMFE! Skipping.`);
    continue;
  }
  data.operations.push(newOp);
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

// Verify all new ops exist
for (const newOp of newOps) {
  const found = verifyDoc.data.operations.find(op =>
    String(op.operationNumber || op.opNumber) === newOp.opNumber
  );
  if (found) {
    console.log(`  VERIFIED: OP ${newOp.opNumber} exists`);
  } else {
    console.error(`  ERROR: OP ${newOp.opNumber} NOT FOUND after save!`);
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
console.log(`New operations added: ${data.operations.length - amfeData.operations.length}`);
console.log(`Total causes: ${totalCauses}`);
console.log('\nSkipped WIP storage ops: 30, 61, 71, 81, 92 (Almacenamiento en medios WIP)');
console.log('Skipped OP 10 (already loaded as OP 5 RECEPCION)');
console.log('\nDone. Run `node scripts/_backup.mjs` next.');
process.exit(0);
