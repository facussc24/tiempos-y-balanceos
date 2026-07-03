/**
 * rebuildInjectionMaster.mjs
 *
 * Reconstruye AMFE-MAESTRO-INY-001 (family id=15 "Proceso de Inyeccion Plastica")
 * document_id: 4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c
 *
 * Problema del maestro actual:
 *  - OP 10 y OP 30 son shells vacios (1 WE sin failures)
 *  - OP 20 tiene contenido real pero 1 solo WE "Machine: Inyectora"
 *  - Controls genericos, effects genericos, sin cobertura 6M
 *
 * Reconstruccion:
 *  - OP 10 RECEPCION Y PREPARACION DE MATERIA PRIMA — 6M completo
 *  - OP 20 INYECCION — 6M completo, preserva modos de falla y S/O/D del maestro actual
 *  - OP 30 CONTROL DIMENSIONAL POST-INYECCION Y CORTE DE COLADA — 6M completo
 *
 * Reglas aplicadas:
 *  - Regla 1M por linea (cada WE es UN item 6M)
 *  - Efectos VDA 3 niveles diferenciados por tipo de defecto
 *  - Controles diferenciados por tipo de defecto (no genericos)
 *  - Jerarquia de prevencion (sensor > poka-yoke > instruccion > capacitacion)
 *  - Tabla AP oficial (calculateAP) — NUNCA S*O*D
 *  - Aliases duales (opNumber/operationNumber, name/operationName, ap/actionPriority, cause/description)
 *  - UUIDs frescos en cada item
 *  - focusElementFunction 3 perspectivas consistente en todas las ops
 *  - NO inventar acciones (solo Fak las define)
 *  - NO asignar CC/SC sin autorizacion explicita
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

const MASTER_DOC_ID = '4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c';

// ── Tabla AP oficial (copia de modules/amfe/apTable.ts) ─────────────────────
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
  if (Number.isNaN(s) || Number.isNaN(o) || Number.isNaN(d)) return '';
  const sInt = Math.round(s), oInt = Math.round(o), dInt = Math.round(d);
  if (sInt < 1 || sInt > 10 || oInt < 1 || oInt > 10 || dInt < 1 || dInt > 10) return '';
  return apRule(sInt, oInt, dInt);
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const FOCUS_FUNCTION =
  'Interno: Conformar la pieza plastica segun especificaciones dimensionales, funcionales y de apariencia / ' +
  'Cliente: Montar el componente en el modulo del vehiculo sin interferencias / ' +
  'Usuario final: Funcionalidad, apariencia, seguridad y durabilidad en el habitaculo';

/**
 * Crea una causa completa con aliases duales y AP calculado por tabla oficial.
 */
function mkCause({
  description,
  severity,
  occurrence,
  detection,
  preventionControl,
  detectionControl,
  preventionAction = '',
  detectionAction = '',
  specialChar = '',
  characteristicNumber = '',
  filterCode = '',
  responsible = '',
  targetDate = '',
  status = '',
}) {
  const ap = calculateAP(severity, occurrence, detection);
  // Si AP=H y no hay accion -> poner placeholder (regla: NUNCA inventar accion)
  const prevAct = ap === 'H' && !preventionAction ? 'Pendiente definicion equipo APQP' : preventionAction;
  return {
    id: randomUUID(),
    // aliases duales
    description,
    cause: description,
    severity,
    occurrence,
    detection,
    actionPriority: ap,
    ap,
    preventionControl,
    detectionControl,
    preventionAction: prevAct,
    detectionAction,
    specialChar,
    characteristicNumber,
    filterCode,
    responsible,
    targetDate,
    status,
    actionTaken: '',
    completionDate: '',
    severityNew: '',
    occurrenceNew: '',
    detectionNew: '',
    apNew: '',
    observations: '',
  };
}

/** Crea un modo de falla con efectos 3 niveles VDA. */
function mkFailure({ description, effectLocal, effectNextLevel, effectEndUser, causes }) {
  return {
    id: randomUUID(),
    description,
    effectLocal,
    effectNextLevel,
    effectEndUser,
    causes,
  };
}

/** Crea una funcion (function) con aliases duales. */
function mkFunction({ description, requirements = '', failures }) {
  return {
    id: randomUUID(),
    description,
    functionDescription: description,
    requirements,
    failures,
  };
}

/** Crea un Work Element (6M item). */
function mkWE({ name, type, functions }) {
  return {
    id: randomUUID(),
    name,
    type,
    functions,
  };
}

/** Crea una AmfeOperation con aliases duales. */
function mkOperation({ opNumber, name, operationFunction, workElements }) {
  return {
    id: randomUUID(),
    opNumber,
    operationNumber: opNumber,
    name,
    operationName: name,
    focusElementFunction: FOCUS_FUNCTION,
    operationFunction,
    workElements,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// OP 10 — RECEPCION Y PREPARACION DE MATERIA PRIMA
// ═══════════════════════════════════════════════════════════════════════════

const op10 = mkOperation({
  opNumber: '10',
  name: 'RECEPCION Y PREPARACION DE MATERIA PRIMA',
  operationFunction:
    'Recepcionar pellet virgen con certificado, secar material higroscopico a temperatura y tiempo segun especificacion, y alimentar la tolva de la inyectora',
  workElements: [
    // ── Machine: Tolva secadora ──────────────────────────────
    mkWE({
      name: 'Tolva secadora / Deshumidificador',
      type: 'Machine',
      functions: [
        mkFunction({
          description: 'Secar pellet higroscopico (ABS/PC/PA/PET) a temperatura y tiempo validados para eliminar humedad residual',
          requirements: 'Temperatura segun especificacion de material (ABS 80C, PC 120C, PET 120-150C). Tiempo 2-6 horas.',
          failures: [
            mkFailure({
              description: 'Temperatura de tolva secadora fuera de rango especificado',
              effectLocal: 'Pellet mal secado, humedad residual en material cargado a maquina',
              effectNextLevel: 'En OP 20 aparecen defectos: ampollas, rafagas plateadas, quemado interno en la pieza',
              effectEndUser: 'Apariencia superficial NOK, posible delaminacion o degradacion estructural en servicio',
              causes: [
                mkCause({
                  description: 'Resistencia electrica degradada / sensor de temperatura descalibrado en la tolva secadora',
                  severity: 6,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Plan de mantenimiento preventivo de tolva secadora (calibracion sensor y verificacion resistencia)',
                  detectionControl: 'Verificacion de temperatura en panel de la tolva al arranque de turno y registro en ficha de proceso',
                }),
                mkCause({
                  description: 'Setpoint de temperatura cargado incorrectamente para el material a secar',
                  severity: 6,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Tabla de parametros de secado por material visible en el puesto + verificacion por el operador al arranque',
                  detectionControl: 'Verificacion cruzada con lider de produccion al cambio de material',
                }),
              ],
            }),
            mkFailure({
              description: 'Tiempo de secado insuficiente (material cargado a maquina antes de completar ciclo)',
              effectLocal: 'Humedad residual en pellet al ingreso del tornillo',
              effectNextLevel: 'Defectos de humedad en pieza inyectada (rafagas, burbujas, quemado interno)',
              effectEndUser: 'Apariencia NOK, riesgo de degradacion del material a largo plazo',
              causes: [
                mkCause({
                  description: 'Carga anticipada de material a la tolba de maquina sin respetar tiempo minimo de secado',
                  severity: 6,
                  occurrence: 3,
                  detection: 6,
                  preventionControl: 'Procedimiento de arranque con cronometraje del ciclo de secado + etiqueta de inicio de secado visible en la tolva',
                  detectionControl: 'Registro de hora de inicio/fin de secado por lote en ficha de proceso',
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // ── Machine: Aspirador / sistema de alimentacion ─────────
    mkWE({
      name: 'Aspirador / Sistema de alimentacion de pellet',
      type: 'Machine',
      functions: [
        mkFunction({
          description: 'Transportar pellet desde el bolson al pie de maquina hacia la tolva de la inyectora sin contaminar ni interrumpir flujo',
          failures: [
            mkFailure({
              description: 'Alimentacion intermitente o interrumpida del aspirador',
              effectLocal: 'Tolva de maquina queda parcialmente vacia, riesgo de pieza incompleta',
              effectNextLevel: 'OP 20 produce piezas con llenado insuficiente (scrap)',
              effectEndUser: 'Pieza no montable en el modulo del vehiculo',
              causes: [
                mkCause({
                  description: 'Filtro del aspirador tapado por polvo o particulas acumuladas',
                  severity: 5,
                  occurrence: 3,
                  detection: 4,
                  preventionControl: 'Plan de limpieza/soplado de filtro de aspirador al arranque de turno',
                  detectionControl: 'Verificacion visual del filtro al arranque y alarma de nivel bajo en tolva',
                }),
                mkCause({
                  description: 'Presion de aire comprimido baja o inestable en el circuito de aspiracion',
                  severity: 5,
                  occurrence: 2,
                  detection: 4,
                  preventionControl: 'Verificacion de presion de red de aire comprimido al arranque',
                  detectionControl: 'Manometro de referencia en el circuito del aspirador',
                }),
              ],
            }),
            mkFailure({
              description: 'Contaminacion del pellet por particulas externas (polvo, residuos)',
              effectLocal: 'Pellet contaminado cargado en tolva',
              effectNextLevel: 'Puntos negros / inclusiones visibles en la pieza inyectada (scrap)',
              effectEndUser: 'Apariencia superficial NOK, rechazo cliente',
              causes: [
                mkCause({
                  description: 'Filtro del aspirador roto o mal instalado permitiendo paso de particulas',
                  severity: 6,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Inspeccion del filtro al arranque, reemplazo segun plan de mantenimiento',
                  detectionControl: 'Inspeccion visual del pellet en tolva al recargar',
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // ── Material: Pellet virgen ──────────────────────────────
    mkWE({
      name: 'Pellet virgen (materia prima directa)',
      type: 'Material',
      functions: [
        mkFunction({
          description: 'Proveer materia prima conforme a especificacion del cliente (tipo de polimero, lote certificado, sin reciclado)',
          failures: [
            mkFailure({
              description: 'Material entregado no corresponde al especificado en la orden de compra',
              effectLocal: 'Lote incorrecto almacenado como si fuera el correcto',
              effectNextLevel: 'Al usarlo en OP 20, defectos masivos por parametros incompatibles (rebabas, mal flujo, mala adhesion)',
              effectEndUser: 'Propiedades mecanicas NOK, posible falla estructural del componente en servicio',
              causes: [
                mkCause({
                  description: 'Error de proveedor en la identificacion del lote o del material',
                  severity: 7,
                  occurrence: 2,
                  detection: 5,
                  preventionControl: 'Inspeccion documental del certificado del proveedor segun procedimiento P-14 antes de aceptar el lote',
                  detectionControl: 'Verificacion cruzada de etiqueta del bolson vs certificado vs orden de compra',
                }),
              ],
            }),
            mkFailure({
              description: 'Certificado del proveedor faltante, ilegible o no conforme',
              effectLocal: 'Lote sin trazabilidad documental',
              effectNextLevel: 'Material no liberado para produccion, segregado',
              effectEndUser: 'Sin impacto directo si se detecta en recepcion; si no se detecta, riesgo de no conformidad con el cliente',
              causes: [
                mkCause({
                  description: 'Proveedor omitio envio de certificado o certificado no coincide con el lote fisico',
                  severity: 6,
                  occurrence: 2,
                  detection: 4,
                  preventionControl: 'Procedimiento P-14: no aceptar lote sin certificado valido. Segregar s/ P-09/I si falta',
                  detectionControl: 'Checklist de recepcion verificado por recepcionista de materiales',
                }),
              ],
            }),
            mkFailure({
              description: 'Lote contaminado con material ajeno o humedad ambiente excesiva antes de entrar a la tolva secadora',
              effectLocal: 'Pellet con contaminantes o humedad elevada',
              effectNextLevel: 'Defectos de apariencia o dimensional en OP 20',
              effectEndUser: 'Apariencia NOK, posible degradacion en servicio',
              causes: [
                mkCause({
                  description: 'Bolson/octabin danado durante transporte o almacenado en ambiente humedo',
                  severity: 6,
                  occurrence: 2,
                  detection: 5,
                  preventionControl: 'Inspeccion visual del bolson al recibir (integridad, sellado) + almacenamiento en zona seca',
                  detectionControl: 'Inspeccion visual del pellet antes de cargarlo al secador',
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // ── Method: Procedimiento de recepcion y registro ────────
    mkWE({
      name: 'Procedimiento de recepcion y registro de lote (P-14)',
      type: 'Method',
      functions: [
        mkFunction({
          description: 'Asegurar trazabilidad del lote entrante y verificacion del certificado del proveedor antes de liberar material a produccion',
          failures: [
            mkFailure({
              description: 'Lote ingresado a produccion sin registrar trazabilidad',
              effectLocal: 'Imposibilidad de rastrear el lote ante una no conformidad posterior',
              effectNextLevel: 'Si hay un defecto en produccion, no se puede segregar por lote',
              effectEndUser: 'Campana de retorno amplia por falta de trazabilidad',
              causes: [
                mkCause({
                  description: 'Paso de registro omitido en el procedimiento de recepcion',
                  severity: 6,
                  occurrence: 2,
                  detection: 4,
                  preventionControl: 'Checklist de recepcion P-14 con firma obligatoria del recepcionista',
                  detectionControl: 'Auditoria periodica de trazabilidad por Calidad',
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // ── Man: Operador de recepcion ───────────────────────────
    mkWE({
      name: 'Operador/Recepcionista de materiales',
      type: 'Man',
      functions: [
        mkFunction({
          description: 'Verificar el lote entrante contra orden de compra y certificado, y registrar en el sistema de trazabilidad',
          failures: [
            mkFailure({
              description: 'Error humano al registrar datos del lote (lote, fecha, material)',
              effectLocal: 'Trazabilidad incorrecta en el sistema',
              effectNextLevel: 'Ante no conformidad, se segrega el lote equivocado',
              effectEndUser: 'Posible entrega de producto con material no conforme al cliente',
              causes: [
                mkCause({
                  description: 'Ingreso manual de datos sin verificacion cruzada',
                  severity: 6,
                  occurrence: 3,
                  detection: 5,
                  preventionControl: 'Doble verificacion con lider de recepcion en el registro de lote',
                  detectionControl: 'Auditoria periodica de trazabilidad',
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // ── Measurement: Medicion temperatura/tiempo de secado ───
    mkWE({
      name: 'Instrumentos de medicion de temperatura y tiempo de secado',
      type: 'Measurement',
      functions: [
        mkFunction({
          description: 'Asegurar que la medicion de temperatura y tiempo de secado sea precisa antes de liberar pellet a la tolva de maquina',
          failures: [
            mkFailure({
              description: 'Lectura de temperatura de secado incorrecta por sensor descalibrado',
              effectLocal: 'Ciclo de secado ejecutado con temperatura falsa',
              effectNextLevel: 'Humedad residual no detectada -> defectos en pieza inyectada',
              effectEndUser: 'Apariencia o resistencia NOK',
              causes: [
                mkCause({
                  description: 'Sensor de temperatura de tolva secadora fuera de plan de calibracion',
                  severity: 6,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Plan de calibracion periodica del sensor de temperatura de la tolva secadora',
                  detectionControl: 'Verificacion cruzada con termometro patron en calibracion programada',
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ],
});

// ═══════════════════════════════════════════════════════════════════════════
// OP 20 — INYECCION
// ═══════════════════════════════════════════════════════════════════════════
//
// Diferenciaciones de efectos por tipo de defecto (aplicadas abajo):
//
//  Dimensional NOK -> scrap, rechazo metrologia, interferencia ensamble
//  Rebabas leves -> retrabajo in-station, inspeccion final, apariencia NOK
//  Quemaduras -> scrap, ajuste parametros y rearranque, rechazo cliente
//  Falta de llenado -> scrap, ajuste velocidad/presion, no montable
//  Chupados -> retrabajo/scrap si visible, ajuste compactacion, apariencia NOK
//  Color NOK -> scrap, ajuste colorante/purga, rechazo visual
//  Humedad -> scrap o rearranque, reajuste secado, apariencia NOK
//  Peso NOK -> rechazo dimensional, ajuste dosificacion, riesgo estructural
//  Rayas/marcas -> retrabajo o scrap, ajuste robot/molde, apariencia NOK
//  Deformada -> scrap, ajuste enfriamiento, no montable
//
// Controles de prevencion diferenciados segun jerarquia:
//   - Refrigeracion garganta -> "Verificacion de caudal al arranque" (minimo)
//   - Parametros -> "Dossier validado + panel con alarmas"
//   - Molde -> "Plan de mantto preventivo por golpes/horas + procedimiento limpieza al bajar"
//   - Material incorrecto -> "Certificado proveedor + verificacion lote"
//
// Controles de deteccion diferenciados por tipo de defecto:
//   - Dimensional -> Calibre/gauge muestreo
//   - Rebabas/flashes -> Inspeccion visual 100% + muestra maestra
//   - Quemaduras -> Inspeccion visual 100% con pattern board
//   - Color NOK -> Comparacion con muestra maestra bajo luz controlada
//   - Humedad -> Verificacion previa de T/tiempo en tolva secadora
//   - Contaminacion -> Filtro aspirador + certificado proveedor
//
// S/O/D se mantienen calibrados (S=5-6 defectos apariencia, S=6 dimensional, O=2, D=6-8)
// ═══════════════════════════════════════════════════════════════════════════

const op20 = mkOperation({
  opNumber: '20',
  name: 'INYECCION',
  operationFunction:
    'Inyectar pieza plastica segun parametros validados del dossier, con molde en condicion y refrigeracion correcta del tornillo y del molde',
  workElements: [
    // ── Machine: Inyectora (maquina principal) ───────────────
    mkWE({
      name: 'Inyectora (maquina principal)',
      type: 'Machine',
      functions: [
        mkFunction({
          description: 'Inyectar pieza plastica cumpliendo parametros de proceso (temperatura, presion, velocidad, fuerza de cierre, tiempo de compactacion)',
          failures: [
            mkFailure({
              description: 'Pieza incompleta (llenado insuficiente)',
              effectLocal: 'Scrap de pieza (no recuperable, pieza sin material en zona de cavidad)',
              effectNextLevel: 'Ajuste de velocidad o presion de inyeccion y rearranque de lote',
              effectEndUser: 'Pieza no montable en el modulo del vehiculo (bloqueo de ensamble en cliente)',
              causes: [
                mkCause({
                  description: 'Parametros de proceso desajustados / inestabilidad de la maquina de inyeccion',
                  severity: 6,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Dossier de parametros validado + panel de la inyectora con alarmas configuradas por zona',
                  detectionControl: 'Inspeccion visual 100% + comparacion con muestra maestra de pieza OK',
                }),
                mkCause({
                  description: 'Punto de inyeccion (gate) obstruido en el molde',
                  severity: 6,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Procedimiento de limpieza del molde al bajarlo + plan de mantenimiento preventivo',
                  detectionControl: 'Inspeccion visual de la primera pieza de cada arranque + autocontrol 100%',
                }),
                mkCause({
                  description: 'Volumen de inyeccion demasiado bajo (dosificacion corta) respecto al tamano de pieza',
                  severity: 6,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Dossier de parametros validado con volumen de dosificacion especifico por molde',
                  detectionControl: 'Verificacion de pieza en primer disparo + autocontrol visual 100%',
                }),
                mkCause({
                  description: 'Presion de inyeccion insuficiente durante el llenado',
                  severity: 6,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Dossier de parametros validado + panel con alarmas de presion minima',
                  detectionControl: 'Monitoreo de presion en panel durante produccion + inspeccion visual 100%',
                }),
              ],
            }),
            mkFailure({
              description: 'Rebabas (flashes) en pieza inyectada',
              effectLocal: 'Retrabajo in-station (corte de rebaba por el operador en el puesto)',
              effectNextLevel: 'Inspeccion final detecta y libera si la rebaba fue corregida; si no, segrega el lote',
              effectEndUser: 'Apariencia superficial NOK si la rebaba no se detecta o corrige correctamente',
              causes: [
                mkCause({
                  description: 'Parametros de proceso desajustados (presion de mantenimiento alta, temperatura alta)',
                  severity: 5,
                  occurrence: 2,
                  detection: 7,
                  preventionControl: 'Dossier de parametros validado con rangos maximos de presion de segunda presion',
                  detectionControl: 'Inspeccion visual 100% + calibre de referencia en linea de junta para rebabas criticas',
                }),
                mkCause({
                  description: 'Fuerza de cierre insuficiente para el area proyectada de la pieza',
                  severity: 5,
                  occurrence: 2,
                  detection: 7,
                  preventionControl: 'Dossier de parametros con fuerza de cierre minima validada por molde',
                  detectionControl: 'Verificacion de parametro en panel al arranque + inspeccion visual 100%',
                }),
                mkCause({
                  description: 'Linea de junta del molde danada o desgastada permitiendo fuga de material',
                  severity: 6,
                  occurrence: 2,
                  detection: 7,
                  preventionControl: 'Plan de mantenimiento preventivo de molde por golpes/horas (revision linea de junta)',
                  detectionControl: 'Inspeccion visual del molde en cambio + inspeccion visual 100% de pieza',
                }),
              ],
            }),
            mkFailure({
              description: 'Pieza deformada (alabeo / distorsion geometrica)',
              effectLocal: 'Scrap de pieza (deformacion permanente no recuperable)',
              effectNextLevel: 'Ajuste de tiempo de enfriamiento o de refrigeracion del molde y rearranque',
              effectEndUser: 'Pieza no montable o con Gap & Flush NOK en el modulo del vehiculo',
              causes: [
                mkCause({
                  description: 'Parametros de enfriamiento desajustados (tiempo o temperatura de molde)',
                  severity: 6,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Dossier de parametros validado con tiempo de enfriamiento por molde',
                  detectionControl: 'Inspeccion visual 100% + comparacion con muestra maestra en plantilla de control',
                }),
                mkCause({
                  description: 'Tiempo de compactacion (segunda presion) insuficiente',
                  severity: 6,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Dossier de parametros validado con tiempo de compactacion por molde',
                  detectionControl: 'Monitoreo en panel + inspeccion visual 100% de la pieza',
                }),
                mkCause({
                  description: 'Tiempo de enfriamiento insuficiente antes del desmoldeo',
                  severity: 6,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Dossier de parametros validado + panel con alarma si ciclo se acorta',
                  detectionControl: 'Inspeccion visual 100% + comparacion con muestra maestra',
                }),
              ],
            }),
            mkFailure({
              description: 'Quemaduras en pieza inyectada',
              effectLocal: 'Scrap de pieza (marca oscura no recuperable por retrabajo)',
              effectNextLevel: 'Ajuste de temperatura / tiempo y arranque de nuevo lote',
              effectEndUser: 'Apariencia critica NOK, rechazo cliente',
              causes: [
                mkCause({
                  description: 'Parametros de proceso desajustados (temperatura del fundido excesiva, velocidad alta)',
                  severity: 5,
                  occurrence: 2,
                  detection: 7,
                  preventionControl: 'Dossier de parametros con limites maximos de temperatura por zona',
                  detectionControl: 'Inspeccion visual 100% con pattern board de defectos (quemaduras)',
                }),
                mkCause({
                  description: 'Obstruccion o insuficiencia de venteo de aire en el molde (gases atrapados)',
                  severity: 5,
                  occurrence: 2,
                  detection: 7,
                  preventionControl: 'Procedimiento de limpieza de molde al bajarlo (limpieza de venteos)',
                  detectionControl: 'Inspeccion visual 100% con pattern board de defectos',
                }),
              ],
            }),
            mkFailure({
              description: 'Chupados (rechupes / sink marks) en pieza inyectada',
              effectLocal: 'Retrabajo de inspeccion; scrap si el chupado es visible en zona estetica',
              effectNextLevel: 'Ajuste de compactacion (segunda presion) y reinicio',
              effectEndUser: 'Apariencia superficial NOK en zona visible del habitaculo',
              causes: [
                mkCause({
                  description: 'Presion de compactacion (segunda presion) baja',
                  severity: 5,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Dossier de parametros validado con rango de segunda presion',
                  detectionControl: 'Inspeccion visual 100% + muestra maestra de referencia',
                }),
                mkCause({
                  description: 'Tiempo de compactacion bajo respecto al espesor de la pieza',
                  severity: 5,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Dossier de parametros validado con tiempo de compactacion por molde',
                  detectionControl: 'Inspeccion visual 100% + muestra maestra',
                }),
                mkCause({
                  description: 'Punto de inyeccion (gate) reducido causando caida de presion',
                  severity: 5,
                  occurrence: 2,
                  detection: 7,
                  preventionControl: 'Plan de mantenimiento preventivo de molde (verificacion gates)',
                  detectionControl: 'Inspeccion visual 100% con pattern board',
                }),
              ],
            }),
            mkFailure({
              description: 'Dimensional NOK (fuera de tolerancia en medida critica)',
              effectLocal: 'Scrap de pieza (no recuperable)',
              effectNextLevel: 'Rechazo en laboratorio de metrologia, ajuste de parametros y arranque de nuevo lote',
              effectEndUser: 'Interferencia en ensamble en cliente, posible Gap & Flush NOK',
              causes: [
                mkCause({
                  description: 'Parametros de proceso desajustados afectando contraccion de la pieza',
                  severity: 6,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Dossier de parametros validado + panel con alarmas por zona',
                  detectionControl: 'Calibre / gauge de control dimensional por muestreo segun plan de control',
                }),
                mkCause({
                  description: 'Equipo de refrigeracion del molde averiado (flujo o temperatura de agua fuera de rango)',
                  severity: 6,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Plan de mantenimiento preventivo del chiller / sistema de refrigeracion de moldes',
                  detectionControl: 'Verificacion de flujo y temperatura al arranque + calibre de control por muestreo',
                }),
                mkCause({
                  description: 'Contraccion anormal por enfriamiento desigual del molde',
                  severity: 6,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Dossier con tiempo de enfriamiento validado + plan de mantenimiento de canales de refrigeracion del molde',
                  detectionControl: 'Calibre / gauge de control dimensional por muestreo',
                }),
              ],
            }),
            mkFailure({
              description: 'Color no conforme en pieza inyectada',
              effectLocal: 'Scrap de pieza (no recuperable por tincion)',
              effectNextLevel: 'Purga del husillo y ajuste de masterbatch, rearranque',
              effectEndUser: 'Apariencia visual NOK, rechazo cliente por diferencia de color visible',
              causes: [
                mkCause({
                  description: 'Parametros de proceso desajustados (temperatura baja de fusion del colorante)',
                  severity: 6,
                  occurrence: 2,
                  detection: 4,
                  preventionControl: 'Dossier de parametros validado con temperatura minima para fusion correcta del colorante',
                  detectionControl: 'Comparacion con muestra maestra de color bajo luz controlada (cabina D65)',
                }),
                mkCause({
                  description: 'Mezcla residual con materia prima de la produccion anterior (purga del husillo incompleta)',
                  severity: 6,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Procedimiento de purga del husillo al cambio de color o material',
                  detectionControl: 'Verificacion de color de las primeras piezas del arranque contra muestra maestra',
                }),
              ],
            }),
            mkFailure({
              description: 'Peso NOK en pieza inyectada (fuera de rango)',
              effectLocal: 'Rechazo de la pieza, scrap',
              effectNextLevel: 'Ajuste de dosificacion en el dossier y rearranque',
              effectEndUser: 'Indicador de riesgo estructural (material faltante o en exceso)',
              causes: [
                mkCause({
                  description: 'Parametros de dosificacion desajustados (volumen o velocidad de dosificacion)',
                  severity: 5,
                  occurrence: 2,
                  detection: 7,
                  preventionControl: 'Dossier de parametros validado + panel con alarma de dosificacion fuera de rango',
                  detectionControl: 'Balanza de pesaje por muestreo de piezas segun plan de control',
                }),
              ],
            }),
            mkFailure({
              description: 'Rayas / marcas en la superficie de la pieza',
              effectLocal: 'Retrabajo in-station si es leve; scrap si marca profunda',
              effectNextLevel: 'Ajuste de robot de desmoldeo o revision del molde',
              effectEndUser: 'Apariencia superficial NOK en zona visible',
              causes: [
                mkCause({
                  description: 'Desgaste o desajuste del robot de desmoldeo raspando la pieza al retirarla del molde',
                  severity: 6,
                  occurrence: 2,
                  detection: 7,
                  preventionControl: 'Plan de mantenimiento preventivo del robot (verificacion de tomas, recorrido, velocidades)',
                  detectionControl: 'Inspeccion visual 100% con pattern board de defectos',
                }),
                mkCause({
                  description: 'Linea de junta del molde danada generando marca en la pieza al desmoldear',
                  severity: 6,
                  occurrence: 2,
                  detection: 7,
                  preventionControl: 'Plan de mantenimiento preventivo del molde (linea de junta) por golpes/horas',
                  detectionControl: 'Inspeccion visual 100% + muestra maestra',
                }),
                // NOTA: la causa original "Error del operador por falta de formacion" se reemplaza
                // por una causa VALIDA (IATF 16949 asume operario capacitado) — ver rule amfe.md
                mkCause({
                  description: 'Instruccion de trabajo de desmoldeo incompleta o no disponible en el puesto al momento del arranque',
                  severity: 6,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Instruccion de trabajo visible en el puesto + procedimiento de arranque con verificacion de documentacion',
                  detectionControl: 'Inspeccion visual 100% + comparacion con muestra maestra',
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // ── Machine: Molde (dispositivo critico) ─────────────────
    mkWE({
      name: 'Molde (dispositivo critico)',
      type: 'Machine',
      functions: [
        mkFunction({
          description: 'Formar la pieza con geometria correcta, linea de junta estanca, venteo adecuado y expulsion sin dano',
          failures: [
            mkFailure({
              description: 'Linea de junta del molde desgastada o danada permitiendo escape de material',
              effectLocal: 'Rebabas en pieza (retrabajo in-station o scrap)',
              effectNextLevel: 'Correcion offline del molde o reemplazo de inserto de linea de junta',
              effectEndUser: 'Apariencia NOK si no se detecta en el puesto',
              causes: [
                mkCause({
                  description: 'Desgaste natural por cantidad de golpes acumulados sin mantenimiento preventivo',
                  severity: 6,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Plan de mantenimiento preventivo del molde por golpes/horas (contador de ciclos)',
                  detectionControl: 'Inspeccion visual del molde al cambiarlo + inspeccion visual 100% de la pieza',
                }),
              ],
            }),
            mkFailure({
              description: 'Canales de refrigeracion del molde obstruidos (oxido, sarro)',
              effectLocal: 'Enfriamiento desigual, deformacion o dimensional NOK',
              effectNextLevel: 'Molde fuera de linea para limpieza/soplado interno de canales',
              effectEndUser: 'Apariencia o dimensional NOK',
              causes: [
                mkCause({
                  description: 'Procedimiento de soplado de canales al bajar molde no ejecutado (agua residual causa oxidacion)',
                  severity: 6,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Procedimiento de limpieza al bajar molde: soplado de canales con aire comprimido (obligatorio en check list)',
                  detectionControl: 'Verificacion visual de flujo de refrigeracion al montar molde + inspeccion de pieza',
                }),
              ],
            }),
            mkFailure({
              description: 'Expulsores rotos o desgastados',
              effectLocal: 'Pieza no se desmoldea correctamente (posible marca o dano)',
              effectNextLevel: 'Molde fuera de linea para reemplazo de expulsores',
              effectEndUser: 'Apariencia NOK (marcas) o pieza danada',
              causes: [
                mkCause({
                  description: 'Falta de inspeccion periodica de expulsores en el plan de mantenimiento',
                  severity: 5,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Plan de mantenimiento preventivo: revision de expulsores por golpes/horas',
                  detectionControl: 'Inspeccion visual del molde al cambio + inspeccion visual 100% de la pieza',
                }),
              ],
            }),
            mkFailure({
              description: 'Orificios de venteo del molde tapados',
              effectLocal: 'Gases atrapados generan quemaduras en la pieza',
              effectNextLevel: 'Molde fuera de linea para limpieza de venteos',
              effectEndUser: 'Apariencia NOK con marcas de quemado',
              causes: [
                mkCause({
                  description: 'Procedimiento de limpieza de venteos al bajar molde no ejecutado',
                  severity: 5,
                  occurrence: 2,
                  detection: 7,
                  preventionControl: 'Procedimiento de limpieza al bajar molde: limpieza de venteos (obligatorio en check list)',
                  detectionControl: 'Inspeccion visual 100% con pattern board para quemaduras',
                }),
              ],
            }),
            mkFailure({
              description: 'Insertos o machos del molde danados',
              effectLocal: 'Geometria interna de la pieza NOK',
              effectNextLevel: 'Molde fuera de linea para reemplazo de inserto',
              effectEndUser: 'Dimensional NOK, pieza no montable',
              causes: [
                mkCause({
                  description: 'Impacto durante cambio de molde o desgaste acumulado sin revision',
                  severity: 6,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Procedimiento de cambio de molde con inspeccion de insertos + plan de mantto preventivo',
                  detectionControl: 'Inspeccion del molde al cambio + calibre / gauge dimensional de la pieza',
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // ── Machine: Sistema refrigeracion del tornillo ──────────
    mkWE({
      name: 'Sistema de refrigeracion del tornillo (garganta / zona de alimentacion)',
      type: 'Machine',
      functions: [
        mkFunction({
          description: 'Mantener el pellet en estado solido en la garganta del tornillo hasta alcanzar la zona de plastificacion',
          failures: [
            mkFailure({
              description: 'Boca de alimentacion del tornillo atascada por pasta de material fundido prematuramente',
              effectLocal: 'Flujo de pellet interrumpido, ciclo abortado',
              effectNextLevel: 'Parada de maquina para limpieza del tornillo / garganta',
              effectEndUser: 'Sin impacto si se detecta y corrige en produccion; scrap de piezas afectadas',
              causes: [
                mkCause({
                  description: 'Refrigeracion de garganta fallando (bomba de agua, obstruccion en circuito, perdida de caudal)',
                  severity: 6,
                  occurrence: 3,
                  detection: 5,
                  preventionControl: 'Verificacion manual de flujo y temperatura de garganta al arranque de maquina + plan de mantenimiento del chiller',
                  detectionControl: 'Monitoreo en panel de inyectora durante produccion',
                }),
                mkCause({
                  description: 'Flujo de agua insuficiente por filtro tapado en circuito de refrigeracion de garganta',
                  severity: 6,
                  occurrence: 2,
                  detection: 5,
                  preventionControl: 'Plan de mantenimiento del circuito de refrigeracion (limpieza/reemplazo de filtros)',
                  detectionControl: 'Verificacion manual de caudal al arranque + alarma de temperatura en panel',
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // ── Material: Colorante masterbatch (indirecto de proceso)
    mkWE({
      name: 'Colorante masterbatch (material indirecto de proceso)',
      type: 'Material',
      functions: [
        mkFunction({
          description: 'Tenir la pieza al color especificado por el cliente cuando se mezcla con el pellet base',
          failures: [
            mkFailure({
              description: 'Ratio de mezcla de colorante incorrecto respecto a especificacion',
              effectLocal: 'Color de pieza fuera de rango vs muestra maestra (scrap)',
              effectNextLevel: 'Ajuste del dosificador de colorante y purga del husillo',
              effectEndUser: 'Apariencia NOK, rechazo cliente por diferencia visible',
              causes: [
                mkCause({
                  description: 'Dosificador de colorante desajustado o fuera de calibracion',
                  severity: 6,
                  occurrence: 2,
                  detection: 5,
                  preventionControl: 'Plan de calibracion periodica del dosificador de colorante + verificacion de ratio al cambio de lote',
                  detectionControl: 'Comparacion del primer disparo con muestra maestra de color bajo luz controlada',
                }),
              ],
            }),
            mkFailure({
              description: 'Lote de colorante contaminado o fuera de especificacion del proveedor',
              effectLocal: 'Color fuera de tolerancia o defectos superficiales por contaminante',
              effectNextLevel: 'Segregacion del lote de colorante y purga del husillo',
              effectEndUser: 'Apariencia NOK, rechazo cliente',
              causes: [
                mkCause({
                  description: 'Falla de proveedor en el certificado del colorante (lote mezclado o contaminado)',
                  severity: 6,
                  occurrence: 2,
                  detection: 5,
                  preventionControl: 'Inspeccion documental del certificado del proveedor de colorante antes de usar el lote',
                  detectionControl: 'Comparacion con muestra maestra bajo luz controlada al cambio de lote',
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // ── Method: Dossier de parametros de proceso ─────────────
    mkWE({
      name: 'Dossier de parametros de proceso',
      type: 'Method',
      functions: [
        mkFunction({
          description: 'Proveer los parametros validados (temperatura por zona, presion, velocidad, tiempo, fuerza cierre) para cada producto',
          failures: [
            mkFailure({
              description: 'Parametros de otro producto cargados por error en la inyectora',
              effectLocal: 'Primera pieza fuera de especificacion (rebabas, chupados, dimensional)',
              effectNextLevel: 'Scrap de piezas iniciales, ajuste y rearranque',
              effectEndUser: 'Si no se detecta: riesgo de enviar lote completo no conforme',
              causes: [
                mkCause({
                  description: 'Setup incorrecto: operador carga parametros de un producto anterior al cambio de molde',
                  severity: 6,
                  occurrence: 3,
                  detection: 5,
                  preventionControl: 'Procedimiento de arranque con verificacion explicita del dossier vs producto + firma de liberacion',
                  detectionControl: 'Inspeccion de primera pieza (First Off Inspection) con aprobacion por lider de produccion',
                }),
              ],
            }),
            mkFailure({
              description: 'Dossier desactualizado respecto a la version validada por el equipo APQP',
              effectLocal: 'Parametros obsoletos aplicados al ciclo',
              effectNextLevel: 'Defectos sistematicos hasta actualizar el dossier',
              effectEndUser: 'Riesgo de lote completo con defecto oculto',
              causes: [
                mkCause({
                  description: 'Gestion documental del dossier sin control de revision',
                  severity: 6,
                  occurrence: 2,
                  detection: 5,
                  preventionControl: 'Procedimiento P-05 de control de documentos con revision periodica del dossier',
                  detectionControl: 'Auditoria periodica de dossier en produccion por Calidad',
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // ── Method: Procedimiento de arranque de inyeccion ───────
    mkWE({
      name: 'Procedimiento de arranque de fabricacion inyeccion',
      type: 'Method',
      functions: [
        mkFunction({
          description: 'Asegurar el setup correcto al inicio del turno o al cambio de molde (parametros, refrigeracion, molde limpio, dossier correcto)',
          failures: [
            mkFailure({
              description: 'Pasos criticos del procedimiento de arranque omitidos',
              effectLocal: 'Setup incompleto, falla en primer disparo',
              effectNextLevel: 'Scrap de piezas iniciales hasta estabilizar el proceso',
              effectEndUser: 'Sin impacto si se detecta en arranque; riesgo si pasa inadvertido',
              causes: [
                mkCause({
                  description: 'Checklist de arranque no utilizado o firmado sin verificacion real',
                  severity: 6,
                  occurrence: 3,
                  detection: 5,
                  preventionControl: 'Checklist de arranque con firma del operador Y del lider + aprobacion de primera pieza antes de liberar',
                  detectionControl: 'Auditoria periodica de arranques por Calidad',
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // ── Man: Operador (setup y verificacion primer disparo) ──
    mkWE({
      name: 'Operador de inyectora (setup y verificacion primer disparo)',
      type: 'Man',
      functions: [
        mkFunction({
          description: 'Validar los parametros al arranque y verificar conformidad de la primera pieza antes de liberar la produccion',
          failures: [
            mkFailure({
              description: 'Primera pieza no verificada contra muestra maestra antes de liberar produccion',
              effectLocal: 'Arranque de produccion con defecto no detectado',
              effectNextLevel: 'Produccion de lote con defecto hasta inspeccion final',
              effectEndUser: 'Riesgo de lote completo con defecto enviado al cliente',
              causes: [
                mkCause({
                  description: 'Instruccion de trabajo de verificacion de primera pieza no disponible o poco clara en el puesto',
                  severity: 6,
                  occurrence: 3,
                  detection: 5,
                  preventionControl: 'Instruccion de trabajo con foto del check + aprobacion del lider de produccion para liberar',
                  detectionControl: 'Verificacion del registro de liberacion de primera pieza por el lider',
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // ── Man: Operador (autocontrol durante produccion) ───────
    mkWE({
      name: 'Operador de inyectora (autocontrol 100% durante produccion)',
      type: 'Man',
      functions: [
        mkFunction({
          description: 'Inspeccion visual al 100% de cada pieza inyectada con comparacion contra muestra maestra y pattern board',
          failures: [
            mkFailure({
              description: 'Omision de inspeccion visual durante produccion',
              effectLocal: 'Defecto no detectado sale de la estacion',
              effectNextLevel: 'Pieza defectuosa llega a OP 30 control dimensional',
              effectEndUser: 'Riesgo de enviar defecto al cliente si tampoco se detecta en control final',
              causes: [
                mkCause({
                  description: 'Instruccion de trabajo de autocontrol no visible o incompleta en el puesto',
                  severity: 6,
                  occurrence: 3,
                  detection: 5,
                  preventionControl: 'Instruccion de trabajo de autocontrol visible en el puesto + muestra maestra + pattern board',
                  detectionControl: 'Control final en OP 30 con calibre y pattern board',
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // ── Measurement: Instrumentos de medicion ────────────────
    mkWE({
      name: 'Instrumentos de medicion (calibre, termometros, manometros)',
      type: 'Measurement',
      functions: [
        mkFunction({
          description: 'Medir parametros del proceso y dimensiones de pieza con precision conforme al plan de control',
          failures: [
            mkFailure({
              description: 'Lectura incorrecta por instrumento descalibrado',
              effectLocal: 'Decision de liberacion basada en medicion falsa',
              effectNextLevel: 'Pieza defectuosa liberada o pieza conforme rechazada',
              effectEndUser: 'Riesgo de enviar producto no conforme al cliente',
              causes: [
                mkCause({
                  description: 'Instrumento fuera del plan de calibracion periodica',
                  severity: 6,
                  occurrence: 2,
                  detection: 5,
                  preventionControl: 'Plan de calibracion periodica de todos los instrumentos de medicion (etiqueta con fecha de proxima calibracion)',
                  detectionControl: 'Verificacion periodica vs patron + bloqueo de uso si etiqueta vencida',
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // ── Environment: Aire comprimido filtrado ────────────────
    mkWE({
      name: 'Aire comprimido filtrado (servicio)',
      type: 'Environment',
      functions: [
        mkFunction({
          description: 'Proveer aire comprimido filtrado y seco para aspirador, sopletado de molde y venteo',
          failures: [
            mkFailure({
              description: 'Aire comprimido contaminado con agua o aceite',
              effectLocal: 'Contaminacion de pellet o del molde durante sopletado',
              effectNextLevel: 'Defectos de apariencia en pieza (manchas, inclusiones)',
              effectEndUser: 'Apariencia NOK',
              causes: [
                mkCause({
                  description: 'Filtro/secador del aire comprimido saturado sin purgar',
                  severity: 5,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Plan de purga periodica de filtros/secadores de la red de aire comprimido',
                  detectionControl: 'Verificacion visual del filtro al arranque + inspeccion de la pieza',
                }),
                mkCause({
                  description: 'Presion de red de aire comprimido baja afectando sopletado y aspiracion',
                  severity: 5,
                  occurrence: 2,
                  detection: 4,
                  preventionControl: 'Verificacion de presion de red al arranque del turno',
                  detectionControl: 'Manometro de referencia en el punto de uso',
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ],
});

// ═══════════════════════════════════════════════════════════════════════════
// OP 30 — CONTROL DIMENSIONAL POST-INYECCION Y CORTE DE COLADA
// ═══════════════════════════════════════════════════════════════════════════

const op30 = mkOperation({
  opNumber: '30',
  name: 'CONTROL DIMENSIONAL POST-INYECCION Y CORTE DE COLADA',
  operationFunction:
    'Inspeccion visual 100% de la pieza saliente, corte de colada (runner) sin dejar rebaba en la pieza, y verificacion dimensional por muestreo segun plan de control',
  workElements: [
    // ── Machine: Mesa / banco de control ─────────────────────
    mkWE({
      name: 'Mesa / banco de control post-inyeccion',
      type: 'Machine',
      functions: [
        mkFunction({
          description: 'Proveer superficie estable y bien iluminada para el control visual y dimensional de la pieza',
          failures: [
            mkFailure({
              description: 'Iluminacion insuficiente en el banco de control',
              effectLocal: 'Defectos visuales leves no detectados por el operador',
              effectNextLevel: 'Pieza defectuosa liberada a embalaje',
              effectEndUser: 'Apariencia NOK detectada por el cliente',
              causes: [
                mkCause({
                  description: 'Lumina rota o LED degradado sin reemplazo',
                  severity: 5,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Plan de mantenimiento de puesto de trabajo (verificacion mensual de iluminacion)',
                  detectionControl: 'Verificacion visual al arranque del puesto',
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // ── Method: Procedimiento de control visual y dimensional
    mkWE({
      name: 'Procedimiento de control visual y dimensional',
      type: 'Method',
      functions: [
        mkFunction({
          description: 'Secuencia de verificacion de la pieza: apariencia, dimensiones criticas, muestra maestra, liberacion o rechazo',
          failures: [
            mkFailure({
              description: 'Paso del procedimiento de control omitido o mal ejecutado',
              effectLocal: 'Defecto no detectado en el control',
              effectNextLevel: 'Pieza defectuosa enviada a embalaje',
              effectEndUser: 'Riesgo de enviar defecto al cliente',
              causes: [
                mkCause({
                  description: 'Instruccion de trabajo del procedimiento de control incompleta o no actualizada',
                  severity: 6,
                  occurrence: 3,
                  detection: 5,
                  preventionControl: 'Instruccion de trabajo visible en el puesto con muestras maestras y pattern board',
                  detectionControl: 'Auditoria periodica del puesto de control por Calidad',
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // ── Method: Procedimiento de corte de colada (runner) ────
    mkWE({
      name: 'Procedimiento de corte de colada (runner)',
      type: 'Method',
      functions: [
        mkFunction({
          description: 'Retirar el sistema de alimentacion (runner) sin dejar rebaba residual ni bebedero visible en el punto de gate de la pieza',
          failures: [
            mkFailure({
              description: 'Rebaba residual o bebedero visible en el punto de inyeccion (gate)',
              effectLocal: 'Retrabajo in-station de corte adicional',
              effectNextLevel: 'Pieza rechazada en inspeccion final si no se retrabajo',
              effectEndUser: 'Apariencia NOK si esta en zona visible',
              causes: [
                mkCause({
                  description: 'Instruccion de trabajo del corte de colada incompleta o sin imagen de referencia',
                  severity: 5,
                  occurrence: 3,
                  detection: 5,
                  preventionControl: 'Instruccion de trabajo con imagen de corte correcto vs incorrecto en el puesto',
                  detectionControl: 'Inspeccion visual 100% del area de gate despues del corte',
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // ── Man: Operador de control ─────────────────────────────
    mkWE({
      name: 'Operador de control post-inyeccion',
      type: 'Man',
      functions: [
        mkFunction({
          description: 'Inspeccionar al 100% las piezas salientes de la inyectora, liberar o rechazar segun criterio del plan de control',
          failures: [
            mkFailure({
              description: 'Omision de defecto visible durante la inspeccion 100%',
              effectLocal: 'Pieza defectuosa liberada al siguiente sector',
              effectNextLevel: 'Rechazo en control final o en cliente',
              effectEndUser: 'Apariencia o dimensional NOK en el vehiculo',
              causes: [
                mkCause({
                  description: 'Criterio de aceptacion/rechazo no claro por falta de muestras maestras actualizadas en el puesto',
                  severity: 6,
                  occurrence: 3,
                  detection: 5,
                  preventionControl: 'Muestras maestras + pattern board actualizados en el puesto con revision periodica',
                  detectionControl: 'Auditoria periodica del puesto por Calidad + control final independiente',
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // ── Measurement: Calibre / gauge dimensional ─────────────
    mkWE({
      name: 'Calibre / gauge dimensional',
      type: 'Measurement',
      functions: [
        mkFunction({
          description: 'Verificar cumplimiento de tolerancias criticas de la pieza segun plano o plan de control',
          failures: [
            mkFailure({
              description: 'Calibre danado o desgastado dando lecturas incorrectas',
              effectLocal: 'Pieza liberada o rechazada en base a medicion falsa',
              effectNextLevel: 'Pieza no conforme pasa al cliente o pieza conforme rechazada por error',
              effectEndUser: 'Interferencia en ensamble si la pieza no conforme llega al cliente',
              causes: [
                mkCause({
                  description: 'Calibre fuera del plan de calibracion periodica',
                  severity: 6,
                  occurrence: 2,
                  detection: 5,
                  preventionControl: 'Plan de calibracion periodica del calibre con etiqueta de proxima calibracion',
                  detectionControl: 'Verificacion diaria contra patron al arranque del turno',
                }),
                mkCause({
                  description: 'Golpe o impacto del calibre sin reporte al metrologo',
                  severity: 6,
                  occurrence: 2,
                  detection: 6,
                  preventionControl: 'Procedimiento de gestion de instrumentos: reporte obligatorio de impactos',
                  detectionControl: 'Verificacion contra patron antes del uso',
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // ── Measurement: Pattern board de defectos tipicos ───────
    mkWE({
      name: 'Pattern board de defectos tipicos',
      type: 'Measurement',
      functions: [
        mkFunction({
          description: 'Proveer referencia visual al operador para identificar defectos tipicos (rebabas, quemaduras, chupados, rayas)',
          failures: [
            mkFailure({
              description: 'Pattern board desactualizado o no disponible en el puesto',
              effectLocal: 'Operador sin referencia visual clara para decidir aceptacion/rechazo',
              effectNextLevel: 'Defecto borderline no detectado pasa a inspeccion final',
              effectEndUser: 'Apariencia NOK si el defecto llega al cliente',
              causes: [
                mkCause({
                  description: 'Gestion del pattern board sin responsable ni periodicidad de revision',
                  severity: 5,
                  occurrence: 3,
                  detection: 5,
                  preventionControl: 'Procedimiento de gestion de patrones visuales con responsable y revision periodica por Calidad',
                  detectionControl: 'Auditoria periodica del puesto por Calidad',
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ],
});

// ═══════════════════════════════════════════════════════════════════════════
// Actualizar el documento en Supabase
// ═══════════════════════════════════════════════════════════════════════════

console.log('1. Leyendo documento maestro actual...');
const { data: currentDoc, error: readErr } = await sb
  .from('amfe_documents')
  .select('id, amfe_number, data')
  .eq('id', MASTER_DOC_ID)
  .single();

if (readErr) {
  console.error('ERROR leyendo maestro:', readErr);
  process.exit(1);
}
console.log(`   OK: ${currentDoc.amfe_number}`);

// IMPORTANTE: la columna `data` en amfe_documents es TEXT (no JSONB).
// El repositorio de la app hace JSON.parse/JSON.stringify. Si se le pasa un objeto
// al .update(), se guarda como un "objeto de caracteres" ({"0":"{","1":"\"",...}) al
// spread-ear el string original. SOLUCION: parsear al leer y stringify al guardar.
// Helper: loads header from backup (fallback)
function loadHeaderFromBackup() {
  const backupPath = new URL('../backups/2026-04-10T23-37-17/amfe_documents.json', import.meta.url)
    .pathname.replace(/^\/([A-Z]:)/, '$1');
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
  const backupDoc = backup.find(d => d.id === MASTER_DOC_ID);
  if (!backupDoc) throw new Error('Backup no contiene el maestro.');
  return backupDoc.data;
}

// Helper: detecta estado char-indexed ({0:"{",1:"\"",...}) — corrupcion por spread de string
function isCharIndexed(obj) {
  if (typeof obj !== 'object' || obj === null) return false;
  const keys = Object.keys(obj);
  if (keys.length < 5) return false;
  return keys[0] === '0' && keys[1] === '1' &&
    typeof obj[0] === 'string' && obj[0].length === 1;
}

let currentData;
let needsBackupFallback = false;

if (typeof currentDoc.data === 'string') {
  try {
    const parsed = JSON.parse(currentDoc.data);
    if (isCharIndexed(parsed)) {
      console.log('   Detectado estado corrupto char-indexed en string-parsed. Reparando desde backup.');
      needsBackupFallback = true;
    } else if (!parsed.header || !parsed.operations) {
      console.log(`   data parseado carece de header/operations (keys: ${Object.keys(parsed).join(',')}). Reparando desde backup.`);
      needsBackupFallback = true;
    } else {
      currentData = parsed;
    }
  } catch (e) {
    console.log('   data no es JSON valido. Reparando desde backup:', e.message);
    needsBackupFallback = true;
  }
} else if (typeof currentDoc.data === 'object' && currentDoc.data !== null) {
  if (isCharIndexed(currentDoc.data)) {
    console.log('   Detectado estado corrupto char-indexed (objeto). Reparando desde backup.');
    needsBackupFallback = true;
  } else {
    currentData = currentDoc.data;
  }
} else {
  console.log('   data null o tipo inesperado. Reparando desde backup.');
  needsBackupFallback = true;
}

if (needsBackupFallback) {
  currentData = loadHeaderFromBackup();
  console.log('   Header restaurado desde backup 2026-04-10T23-37-17.');
}

if (!currentData.header) {
  console.error('ERROR: no se pudo obtener header valido. Abort.');
  process.exit(1);
}

// Preservar el header, actualizar revDate y revision
const newData = {
  ...currentData,
  header: {
    ...currentData.header,
    revDate: '2026-04-10',
    revision: 'B',
  },
  operations: [op10, op20, op30],
};

console.log('2. Actualizando documento con reconstruccion 6M completa...');
// IMPORTANTE: stringify porque la columna es TEXT, no JSONB
const { error: updErr } = await sb
  .from('amfe_documents')
  .update({ data: JSON.stringify(newData) })
  .eq('id', MASTER_DOC_ID);

if (updErr) {
  console.error('ERROR actualizando maestro:', updErr);
  process.exit(1);
}
console.log('   OK: update ejecutado');

// Verificacion post-update obligatoria
console.log('3. Verificacion post-update...');
const { data: verifyDoc, error: verifyErr } = await sb
  .from('amfe_documents')
  .select('id, data')
  .eq('id', MASTER_DOC_ID)
  .single();

if (verifyErr) {
  console.error('ERROR verificando:', verifyErr);
  process.exit(1);
}

// El repositorio usa TEXT + JSON.parse. Esperamos string serializado valido.
const rawData = verifyDoc.data;
let verifiedData;
if (typeof rawData === 'string') {
  try {
    verifiedData = JSON.parse(rawData);
  } catch (e) {
    console.error('ERROR: data no es JSON parseable post-update.', e.message);
    process.exit(1);
  }
} else if (typeof rawData === 'object' && rawData !== null) {
  verifiedData = rawData;
} else {
  console.error(`ERROR: data tipo inesperado (${typeof rawData})`);
  process.exit(1);
}

// Verificar que no sea char-indexed (corrupcion del spread)
const vkeys = Object.keys(verifiedData);
if (vkeys.length > 0 && vkeys[0] === '0' && typeof verifiedData[0] === 'string' && verifiedData[0].length === 1) {
  console.error('ERROR: data esta char-indexed (corrupcion). Abort.');
  process.exit(1);
}

if (typeof verifiedData !== 'object' || verifiedData === null) {
  console.error(`ERROR: data parseado no es objeto.`);
  process.exit(1);
}

if (!Array.isArray(verifiedData.operations)) {
  console.error('ERROR: data.operations no es array.');
  process.exit(1);
}

// Contar elementos
let weCount = 0, fnCount = 0, fmCount = 0, causeCount = 0;
const apDist = { H: 0, M: 0, L: 0, '': 0 };
const opSummary = [];

for (const op of verifiedData.operations) {
  const opLine = `OP ${op.operationNumber || op.opNumber} ${op.operationName || op.name}:`;
  const weList = [];
  for (const we of (op.workElements || [])) {
    weCount++;
    weList.push(`${we.type}: ${we.name}`);
    for (const fn of (we.functions || [])) {
      fnCount++;
      for (const fm of (fn.failures || [])) {
        fmCount++;
        for (const cause of (fm.causes || [])) {
          causeCount++;
          const ap = cause.actionPriority || cause.ap || '';
          apDist[ap] = (apDist[ap] || 0) + 1;
        }
      }
    }
  }
  opSummary.push({ line: opLine, weList });
}

console.log('\n═══════════════════════════════════════════════════');
console.log('VERIFICACION POST-UPDATE');
console.log('═══════════════════════════════════════════════════');
console.log(`  typeof data:        ${typeof verifiedData}   ${typeof verifiedData === 'object' ? 'OK' : 'FAIL'}`);
console.log(`  data.operations:    Array[${verifiedData.operations.length}]`);
console.log(`  Work Elements:      ${weCount}`);
console.log(`  Functions:          ${fnCount}`);
console.log(`  Failure Modes:      ${fmCount}`);
console.log(`  Causes:             ${causeCount}`);
console.log(`  AP distribucion:    H=${apDist.H}  M=${apDist.M}  L=${apDist.L}${apDist[''] ? '  (invalid='+apDist['']+')' : ''}`);
console.log('');
console.log('RESUMEN POR OPERACION');
console.log('─────────────────────────────────────────────────────');
for (const { line, weList } of opSummary) {
  console.log(line);
  weList.forEach(w => console.log(`  - ${w}`));
  console.log('');
}
console.log('Listo.');
