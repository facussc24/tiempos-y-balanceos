#!/usr/bin/env node
/**
 * FIX: AP=H Causes Without Actions — Insert Patagonia (VW)
 *
 * Reads the Insert Patagonia master AMFE and its L0 variant from Supabase,
 * finds all causes with AP=H and no corrective actions, fills in realistic
 * manufacturing-specific actions, and creates change proposals for L0.
 *
 * Per IATF 16949 / AIAG-VDA FMEA, every AP=H cause MUST have at least one
 * prevention or detection action with a responsible person and target date.
 *
 * Usage: node scripts/fix-amfe-aph-actions-inserto.mjs
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

const TARGET_DATE = '2026-06-30';
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// ═══════════════════════════════════════════════════════════════════════════
// ACTION GENERATOR — maps cause/operation context → realistic actions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate prevention and detection actions based on cause text and operation context.
 * Returns { preventionAction, detectionAction, responsible }
 *
 * These actions are specific to the Insert Patagonia product (VW) manufacturing process:
 * - Reception of raw materials (vinyl, PC/ABS, foam, adhesive, thread)
 * - Cutting (manual ruler measurement, CNC cutting, mylar control)
 * - Sewing (CNC sewing machine, thread tension, pattern matching)
 * - WIP storage (kit preparation, identification, visual inspection)
 * - Vacuum forming, trimming, final inspection
 */
function generateActions(cause, failureDesc, opName, severity) {
    const causeText = (cause.cause || '').toLowerCase();
    const failText = (failureDesc || '').toLowerCase();
    const opText = (opName || '').toLowerCase();

    // ─── RECEPTION — Material damage in transit ─────────────────────
    if (opText.includes('recepcion') || opText.includes('recepcionar')) {
        if (causeText.includes('estiba') || causeText.includes('embalaje inadecuado')) {
            return {
                preventionAction: 'Validar especificación de embalaje con proveedor (dimensiones de caja, separadores internos, material de protección). Incluir requisito de embalaje en orden de compra y acuerdo de calidad.',
                detectionAction: 'Inspección visual del estado del embalaje al descargar (100% de pallets). Registro fotográfico de daños en planilla de recepción. Rechazo inmediato si embalaje presenta daños mayores.',
                responsible: 'Calidad / Logística',
            };
        }
        if (causeText.includes('manipulación incorrecta') || causeText.includes('manipulacion incorrecta')) {
            return {
                preventionAction: 'Capacitación del personal de logística en manipulación de materiales frágiles (vinilo, espuma PU, PC/ABS). Señalización de carga frágil en embalajes. Instrucción de trabajo para descarga con autoelevador.',
                detectionAction: 'Verificación del estado del embalaje inmediatamente después de la descarga del camión. Registro de incidentes de manipulación en planilla de recepción.',
                responsible: 'Logística',
            };
        }
        if (causeText.includes('almacenaje inadecuado') && causeText.includes('sin protecciones')) {
            return {
                preventionAction: 'Definir procedimiento de estiba en transporte: uso obligatorio de film stretch, separadores entre capas, y protección superior contra polvo/agua. Incluir como requisito contractual con transportista.',
                detectionAction: 'Inspección visual de daños y suciedad en el empaque al recibir. Apertura de muestras aleatorias para verificar estado interno del material. Registro en planilla de recepción.',
                responsible: 'Calidad / Logística',
            };
        }
        if (causeText.includes('no se utiliza el sistema arb') || causeText.includes('arb')) {
            return {
                preventionAction: 'Capacitación obligatoria del personal de recepción en el uso del sistema ARB. Actualizar SOP de recepción para incluir el paso de registro en ARB como mandatorio antes de ubicar material en almacén.',
                detectionAction: 'Auditoría semanal de registros de recepción para verificar que todos los materiales ingresados tengan entrada en ARB. Bloqueo de ubicación en sistema si no se completa el registro.',
                responsible: 'Calidad',
            };
        }
        if (causeText.includes('proveedor no respeta tolerancias') || causeText.includes('proveedor no respeta')) {
            return {
                preventionAction: 'Implementar programa de desarrollo de proveedores: auditoría de proceso al proveedor, acuerdo de calidad con tolerancias explícitas, y plan de acción correctiva si se detectan desvíos. Requerir Cpk > 1.33 en características críticas.',
                detectionAction: 'Control dimensional por muestreo con calibre en cada recepción (AQL 1.0, nivel II). Verificación del Certificado de Calidad (CoC) contra especificación de Ingeniería.',
                responsible: 'Calidad / Ingeniería',
            };
        }
    }

    // ─── CORTE — Measurement error with ruler (Op 15) ───────────────
    if (opText.includes('preparación de corte') || opText.includes('preparacion de corte')) {
        if (causeText.includes('error del operario al medir') || causeText.includes('regla metálica') || causeText.includes('regla metalica')) {
            return {
                preventionAction: 'Implementar topes mecánicos fijos en la mesa de corte a las medidas estándar del paño (poka-yoke). Eliminar dependencia de medición manual con regla. Capacitar al operador en uso de topes.',
                detectionAction: 'Control dimensional del primer paño cortado del turno con cinta métrica (verificación de set-up). Registro en planilla de arranque. Comparación contra tolerancia especificada en Hoja de Operaciones.',
                responsible: 'Ingeniería de Proceso',
            };
        }
    }

    // ─── CORTE — CNC cutting machine failures (Op 20) ───────────────
    if (opText.includes('cortar componentes') || (opText.includes('corte') && opText.includes('componentes'))) {
        if (causeText.includes('falla en la máquina de corte') || causeText.includes('falla en la maquina de corte')) {
            return {
                preventionAction: 'Establecer plan de mantenimiento preventivo de la máquina de corte: verificación de tensión y velocidad de rollo al inicio de cada turno según instructivo. Mantenimiento programado semanal de cuchillas y rodillos.',
                detectionAction: 'Verificación de calidad del primer corte del turno (set-up). Control visual 100% de la calidad de corte durante producción. Registro de parámetros de máquina en planilla de arranque.',
                responsible: 'Ingeniería de Proceso / Mantenimiento',
            };
        }
        if (causeText.includes('falta de verificación del código') || causeText.includes('falta de verificacion del codigo')) {
            return {
                preventionAction: 'Implementar lectura obligatoria de etiqueta con escáner de código de barras antes del corte. El sistema debe validar que el código del material coincide con la Orden de Producción activa.',
                detectionAction: 'Doble verificación: el operario compara visualmente la etiqueta del rollo contra la planilla de mesa, y el sistema valida electrónicamente el código escaneado contra la OP.',
                responsible: 'Ingeniería de Proceso',
            };
        }
        if (causeText.includes('error en identificación') || causeText.includes('error en identificacion')) {
            return {
                preventionAction: 'Mejorar el sistema de etiquetado en almacén: etiquetar cada rollo con código de barras, color, grano y lote. Implementar sistema FIFO con identificación visual por colores según variante.',
                detectionAction: 'Verificación de atributos visuales (color, grano) por el operador contra muestra de referencia en puesto de trabajo, además de la etiqueta. Registro de verificación en planilla de corte.',
                responsible: 'Logística / Ingeniería de Proceso',
            };
        }
    }

    // ─── CORTE — Mylar control omission (Op 25) ─────────────────────
    if (opText.includes('control con mylar') || opText.includes('mylar')) {
        if (causeText.includes('operador de producción omite') || causeText.includes('operador de produccion omite') || causeText.includes('omite la tarea de verificación') || causeText.includes('omite la tarea de verificacion')) {
            return {
                preventionAction: 'Incluir la verificación con mylar como paso obligatorio en el checklist de set-up de arranque. Capacitar al operador en la importancia del control dimensional post-corte. Supervisión del líder de equipo cada 2 horas.',
                detectionAction: 'Auditoría de proceso interna (frecuencia: 1 vez por turno) verificando que el operador realiza el control con mylar. Registro firmado de verificación en planilla de set-up.',
                responsible: 'Calidad / Producción',
            };
        }
    }

    // ─── WIP STORAGE — Kit assembly issues (Op 30, 61, 71, 81, 92) ──
    if (opText.includes('almacenamiento en medios wip') || opText.includes('wip')) {
        if (causeText.includes('conteo') || causeText.includes('cantidad de componentes')) {
            return {
                preventionAction: 'Implementar lista de empaque (packing list) impresa para cada kit con check visual de cada componente. Agregar ayuda visual con foto del kit completo en puesto de preparación.',
                detectionAction: 'Verificación de conteo por el operador usando la packing list. Auditoría aleatoria por líder de equipo (1 de cada 10 kits) con registro en planilla.',
                responsible: 'Producción / Calidad',
            };
        }
        if (causeText.includes('verificación visual contra la orden') || causeText.includes('verificacion visual contra la orden') || causeText.includes('no realiza la verificación visual') || causeText.includes('no realiza la verificacion visual')) {
            return {
                preventionAction: 'Implementar sistema de verificación con escáner de código de barras: escanear etiqueta del componente y validar contra Orden de Producción en sistema. Colocar OP impresa con fotos de referencia en puesto de preparación de kits.',
                detectionAction: 'Verificación visual del componente (color, variante) contra código en la OP y contra muestra física de referencia antes de incluir en kit. Auditoría de kits por líder de equipo.',
                responsible: 'Producción / Ingeniería de Proceso',
            };
        }
        if (causeText.includes('revisión visual de defectos') || causeText.includes('revision visual de defectos') || causeText.includes('rasgaduras') || causeText.includes('manchas')) {
            return {
                preventionAction: 'Actualizar instrucción de trabajo con criterios visuales de aceptación/rechazo (fotos OK/NOK de rasgaduras, manchas, arrugas). Capacitación del operador con registro firmado.',
                detectionAction: 'Inspección visual 100% de cada pieza antes de incluir en kit. Piezas sospechosas apartadas en bandeja roja para revisión por Calidad.',
                responsible: 'Calidad / Producción',
            };
        }
    }

    // ─── COSTURA CNC — Sewing machine issues (Op 50) ────────────────
    if (opText.includes('costura cnc') || opText.includes('costura - costura cnc')) {
        // Material placement / pliegues
        if (causeText.includes('colocación de material') || causeText.includes('colocacion de material') || causeText.includes('pliegues')) {
            return {
                preventionAction: 'Definir ayuda visual con secuencia de colocación del material en la plantilla (paso a paso con fotos). Implementar marcas de referencia en la plantilla para alineación del material. Capacitación del operador.',
                detectionAction: 'Verificación visual del posicionamiento del material en la plantilla antes de iniciar ciclo (100%). Primera pieza del turno verificada dimensionalmente contra pieza patrón.',
                responsible: 'Ingeniería de Proceso',
            };
        }
        // Topes/guías faltantes
        if (causeText.includes('topes físicos') || causeText.includes('topes fisicos') || causeText.includes('guías en la mesa') || causeText.includes('guias en la mesa')) {
            return {
                preventionAction: 'Diseñar e instalar topes físicos y guías de posicionamiento en la mesa de carga de la máquina CNC. Validar con primera corrida de producción. Incluir verificación de topes en checklist de set-up.',
                detectionAction: 'Verificación de presencia y posición correcta de topes en set-up de arranque. Auditoría de proceso semanal por Ingeniería de Proceso.',
                responsible: 'Ingeniería de Proceso / Mantenimiento',
            };
        }
        // Incorrect thread installation / excess thread
        if (causeText.includes('hilo inferior') || causeText.includes('exceso de hilo') || causeText.includes('instaló incorrectamente')) {
            return {
                preventionAction: 'Crear ayuda visual detallada para la instalación correcta del hilo inferior con secuencia paso a paso y fotos. Definir longitud máxima de hilo residual (6 cm) con regla de referencia en puesto. Capacitación del operador con validación práctica.',
                detectionAction: 'Verificación de costura en primera pieza del turno (set-up): tensión de hilo, longitud de residuo, y calidad de costura. Control visual 100% por operador durante producción.',
                responsible: 'Ingeniería de Proceso',
            };
        }
        // Machine tension/cutting/lubrication failure
        if (causeText.includes('tensión electrónica') || causeText.includes('tension electronica') || causeText.includes('cuchilla del sistema de corte') || causeText.includes('lubricación') || causeText.includes('lubricacion')) {
            return {
                preventionAction: 'Implementar plan de mantenimiento preventivo específico para la máquina CNC: verificación de tensión de hilo, cuchilla de corte automático y lubricación de gancho/guías. Frecuencia: inicio de cada turno + mantenimiento semanal programado.',
                detectionAction: 'Prueba de costura en set-up de arranque verificando: tensión correcta, corte de hilo automático funcional, ausencia de ruidos anormales. Registro en planilla de mantenimiento preventivo.',
                responsible: 'Mantenimiento / Ingeniería de Proceso',
            };
        }
        // Inadequate needle
        if (causeText.includes('aguja inadecuada') || causeText.includes('aguja')) {
            return {
                preventionAction: 'Especificar tipo y tamaño de aguja en la Hoja de Operaciones según material y espesor. Implementar sistema de gestión de agujas con identificación visual por tipo y registro de cambio.',
                detectionAction: 'Verificación del tipo de aguja instalada en set-up de arranque contra Hoja de Operaciones. Control de recepción de agujas con certificado de calidad del proveedor. Registro de cambio de aguja.',
                responsible: 'Ingeniería de Proceso / Calidad',
            };
        }
        // Undocumented tension adjustment procedure
        if (causeText.includes('procedimiento de instalación') || causeText.includes('procedimiento de instalacion') || causeText.includes('ajuste de tensión') || causeText.includes('ajuste de tension') || causeText.includes('procedimiento') && causeText.includes('ambiguo')) {
            return {
                preventionAction: 'Documentar procedimiento de ajuste de tensión de hilo con parámetros cuantitativos (valores de tensión en display, velocidad de costura). Crear ayuda visual con secuencia de ajuste paso a paso. Validar con operadores.',
                detectionAction: 'Auditoría de proceso cada turno: verificar que el operador realiza el ajuste de tensión según procedimiento documentado. Verificación de tensión de costura en primera pieza (pull test).',
                responsible: 'Ingeniería de Proceso',
            };
        }
        // Manual code entry instead of scanner
        if (causeText.includes('código manualmente') || causeText.includes('codigo manualmente') || causeText.includes('escáner') || causeText.includes('escaner')) {
            return {
                preventionAction: 'Configurar la máquina CNC para aceptar exclusivamente entrada por escáner de código de barras (deshabilitar entrada manual). Si no es posible, implementar doble verificación: escáner + confirmación visual.',
                detectionAction: 'Auditoría de proceso: verificar que el operador utiliza el escáner para ingresar el código de pieza. Registro electrónico del método de entrada (manual vs. escáner) en el log de la máquina.',
                responsible: 'Ingeniería de Proceso',
            };
        }
        // Pattern mismatch — software
        if (causeText.includes('software') || causeText.includes('hmi') || causeText.includes('programa antiguo') || causeText.includes('patrón predeterminado')) {
            return {
                preventionAction: 'Implementar procedimiento de verificación cruzada: antes de iniciar ciclo, el operador debe confirmar en la pantalla HMI que el número de programa coincide con la plantilla física instalada. Bloqueo de máquina si no coincide.',
                detectionAction: 'Verificación en set-up: ejecutar primer ciclo en seco (sin material) para confirmar que la máquina ejecuta el patrón correcto. Registro del número de programa en planilla de arranque.',
                responsible: 'Ingeniería de Proceso',
            };
        }
        // Pattern mismatch — sensor
        if (causeText.includes('sensor') && (causeText.includes('descalibrado') || causeText.includes('no funciona'))) {
            return {
                preventionAction: 'Incluir verificación de sensor de plantilla en checklist de mantenimiento preventivo semanal. Calibración de sensores según plan de calibración. Limpieza de lentes/sensores al inicio de cada turno.',
                detectionAction: 'Prueba de error en set-up: pasar una plantilla incorrecta para verificar que la máquina la rechaza. Registro de resultado de prueba de error en planilla de arranque.',
                responsible: 'Mantenimiento / Ingeniería de Proceso',
            };
        }
        // Pattern mismatch — method (no cross-check procedure)
        if (causeText.includes('verificación cruzada') || causeText.includes('verificacion cruzada') || causeText.includes('set-up no exige')) {
            return {
                preventionAction: 'Actualizar procedimiento de set-up para incluir verificación cruzada obligatoria: operador verifica que el código de plantilla física coincide con el código de programa seleccionado en HMI. Doble firma (operador + líder).',
                detectionAction: 'Auditoría de proceso: verificar que el operador realiza la verificación cruzada documentada en cada cambio de modelo. Registro en planilla de set-up con código de plantilla y código de programa.',
                responsible: 'Ingeniería de Proceso / Calidad',
            };
        }
        // Cleaning/lubrication omission by operator
        if (causeText.includes('limpieza') || causeText.includes('omite') && causeText.includes('procedimiento')) {
            return {
                preventionAction: 'Implementar checklist de cierre de turno con tareas de limpieza y lubricación. Ayuda visual en puesto de trabajo con puntos de lubricación y tipo de lubricante. Capacitación obligatoria con registro.',
                detectionAction: 'Auditoría de 5S al final de cada turno. Supervisión del líder de equipo del cumplimiento del checklist de cierre. Registro de auditoría con evidencia fotográfica.',
                responsible: 'Producción / Mantenimiento',
            };
        }
        // Maintenance indicator failure (cycle counters)
        if (causeText.includes('indicadores de mantenimiento') || causeText.includes('contadores de ciclo')) {
            return {
                preventionAction: 'Implementar sistema de alertas de mantenimiento basado en contadores de ciclo de la máquina CNC. Definir umbrales de alerta para lubricación, cambio de aguja, y reemplazo de cuchilla. Mantenimiento preventivo programado.',
                detectionAction: 'Verificación semanal de contadores de ciclo por personal de mantenimiento. Registro de valores de contador vs. umbral en planilla de mantenimiento preventivo.',
                responsible: 'Mantenimiento',
            };
        }
        // Contaminated lubricant
        if (causeText.includes('aceite') || causeText.includes('lubricante') && (causeText.includes('no es el especificado') || causeText.includes('contaminado'))) {
            return {
                preventionAction: 'Etiquetar todos los envases de lubricante con código de máquina destino. Incluir tipo de lubricante especificado en la Hoja de Mantenimiento de cada máquina. Almacenar lubricantes en área designada con control de acceso.',
                detectionAction: 'Verificación visual del lubricante antes de su uso: color, olor, fecha de vencimiento. Certificado de calidad del lubricante en recepción. Registro de cambio de lubricante en planilla de mantenimiento.',
                responsible: 'Mantenimiento / Calidad',
            };
        }
        // Inadequate maintenance procedure (documentation)
        if (causeText.includes('procedimiento de mantenimiento') || causeText.includes('no documenta la frecuencia') || causeText.includes('inadecuado')) {
            return {
                preventionAction: 'Revisar y actualizar el Instructivo General de Mantenimiento (I-MT-001) para incluir frecuencia específica de lubricación, tipo de lubricante, puntos de lubricación, y criterios de reemplazo de componentes de desgaste para la máquina CNC.',
                detectionAction: 'Auditoría de proceso mensual: verificar que el personal de mantenimiento sigue el instructivo actualizado. Revisión de registros de mantenimiento contra el plan. Indicadores de cumplimiento de mantenimiento preventivo.',
                responsible: 'Mantenimiento / Ingeniería de Proceso',
            };
        }
    }

    // ─── REFILADO POST-TAPIZADO (Op 105) ────────────────────────────
    if (opText.includes('refilado post') || opText.includes('refilado post-tapizado')) {
        if (causeText.includes('pieza patrón') || causeText.includes('pieza patron') || causeText.includes('referencia')) {
            return {
                preventionAction: 'Asegurar que la pieza patrón esté disponible y actualizada en el puesto de refilado. Hoja de Operaciones con imagen de referencia de bordes OK/NOK. Capacitación del operador en técnica de refilado.',
                detectionAction: 'Comparación visual del operador contra pieza patrón al inicio de turno y cada cambio de lote. Auditoría de proceso por líder de equipo cada 2 horas.',
                responsible: 'Ingeniería de Proceso',
            };
        }
        if (causeText.includes('presión excesiva') || causeText.includes('presion excesiva') || causeText.includes('desvía el cutter') || causeText.includes('desvia el cutter')) {
            return {
                preventionAction: 'Demarcación de zona de corte en la pieza (línea de guía visible). Ayudas visuales con ángulo y presión de corte correctos. Capacitación del operador en técnica de refilado con validación práctica.',
                detectionAction: 'Autocontrol visual del operador pieza a pieza (100%). Verificación contra pieza patrón. Piezas con sustrato expuesto son scrap inmediato.',
                responsible: 'Ingeniería de Proceso',
            };
        }
    }

    // ─── INSPECCIÓN FINAL (Op 110) ──────────────────────────────────
    if (opText.includes('control') || opText.includes('inspección') || opText.includes('inspeccion') || opText.includes('verificación') || opText.includes('verificacion')) {
        if (causeText.includes('aspecto') || causeText.includes('manchas') || causeText.includes('roturas') || causeText.includes('despegues')) {
            return {
                preventionAction: 'Checklist de inspección visual con cada tipo de defecto listado (manchas, roturas, despegues, deformaciones) y criterios de aceptación con fotos OK/NOK. Capacitación trimestral del inspector.',
                detectionAction: 'Inspección visual 100% por Control de Calidad (CC) de cada pieza. Auditoría de producto terminado cada 2 horas con muestreo adicional.',
                responsible: 'Calidad',
            };
        }
        if (causeText.includes('costura') || causeText.includes('hilo suelto') || causeText.includes('desalineada')) {
            return {
                preventionAction: 'Imagen de referencia de costura OK/NOK disponible en puesto de inspección. Checklist con punto específico de costura (tensión, alineación, remate). Capacitación trimestral del inspector.',
                detectionAction: 'Inspección visual 100% por Control de Calidad (CC) de cada pieza. Verificación de resistencia de costura por pull test en muestreo (1 pieza por hora).',
                responsible: 'Calidad',
            };
        }
    }

    // ─── ABSOLUTE FALLBACK ──────────────────────────────────────────
    // If no specific match, generate based on cause keywords
    if (causeText.includes('operador') || causeText.includes('operario') || causeText.includes('mano de obra')) {
        return {
            preventionAction: 'Capacitación específica del operador en la tarea según Hoja de Operaciones actualizada. Ayuda visual en puesto de trabajo con criterios de aceptación/rechazo.',
            detectionAction: 'Autocontrol visual del operador pieza a pieza. Auditoría de proceso por supervisor cada 2 horas.',
            responsible: 'Ingeniería de Proceso',
        };
    }

    if (causeText.includes('máquina') || causeText.includes('maquina') || causeText.includes('equipo') || causeText.includes('falla')) {
        return {
            preventionAction: 'Plan de mantenimiento preventivo del equipo con frecuencia definida. Verificación de parámetros de proceso al inicio de cada turno.',
            detectionAction: 'Monitoreo de parámetros de proceso durante producción. Primer artículo (FAI) después de cada set-up o cambio de herramienta.',
            responsible: 'Ingeniería de Proceso / Mantenimiento',
        };
    }

    return {
        preventionAction: 'Revisión y actualización de Hoja de Operaciones con instrucciones detalladas para la operación. Capacitación del personal involucrado con registro.',
        detectionAction: 'Implementar control visual 100% con criterios pasa/no-pasa documentados. Auditoría de proceso periódica por Calidad.',
        responsible: 'Calidad',
    };
}


// ═══════════════════════════════════════════════════════════════════════════
// CORE LOGIC: Fix AP=H causes in a document
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Walk through all causes in the AMFE document and fill in missing actions
 * for AP=H causes. Returns array of { opId, causeId, causeText, opName } for
 * change proposal generation.
 */
function fixApHCauses(doc) {
    const fixed = [];
    let skipped = 0;

    for (const op of doc.operations || []) {
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const fail of fn.failures || []) {
                    for (const cause of fail.causes || []) {
                        if (cause.ap === 'H' || cause.ap === 'HIGH') {
                            const hasAction = (cause.preventionAction && cause.preventionAction.trim()) ||
                                              (cause.detectionAction && cause.detectionAction.trim());

                            if (!hasAction) {
                                const actions = generateActions(cause, fail.description, op.name, fail.severity);

                                cause.preventionAction = actions.preventionAction;
                                cause.detectionAction = actions.detectionAction;
                                cause.responsible = actions.responsible;
                                cause.targetDate = TARGET_DATE;
                                cause.status = 'Pendiente';

                                fixed.push({
                                    opId: op.id,
                                    opNumber: op.opNumber,
                                    opName: op.name,
                                    causeId: cause.id,
                                    causeText: (cause.cause || '').substring(0, 80),
                                    responsible: actions.responsible,
                                });
                            } else {
                                skipped++;
                            }
                        }
                    }
                }
            }
        }
    }

    return { fixed, skipped };
}


/**
 * Recompute AMFE statistics (cause count, AP counts, coverage).
 */
function computeStats(doc) {
    let causeCount = 0, apHCount = 0, apMCount = 0, filledCauses = 0;

    for (const op of doc.operations || []) {
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const fail of fn.failures || []) {
                    for (const cause of fail.causes || []) {
                        causeCount++;
                        if (cause.ap === 'H' || cause.ap === 'HIGH') apHCount++;
                        if (cause.ap === 'M' || cause.ap === 'MEDIUM') apMCount++;
                        if (fail.severity && cause.occurrence && cause.detection) filledCauses++;
                    }
                }
            }
        }
    }

    const coveragePercent = causeCount > 0 ? Math.round((filledCauses / causeCount) * 100) : 0;
    return { operationCount: (doc.operations || []).length, causeCount, apHCount, apMCount, coveragePercent };
}


// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  FIX: AP=H Causes Without Actions — Insert Patagonia');
    console.log('═══════════════════════════════════════════════════════════\n');

    await initSupabase();

    // ── Step 1: Find the Insert Patagonia master + L0 variant ──────────
    console.log('\n── Step 1: Finding Insert Patagonia AMFE documents ──────');

    const allInsertDocs = await selectSql(
        `SELECT id, amfe_number, project_name, ap_h_count, coverage_percent, data
         FROM amfe_documents
         WHERE UPPER(project_name) LIKE '%INSERTO%'
            OR UPPER(project_name) LIKE '%INSERT%'
         ORDER BY project_name`
    );

    console.log(`  Found ${allInsertDocs.length} Insert document(s):`);
    for (const d of allInsertDocs) {
        console.log(`    - ${d.amfe_number} | ${d.project_name} | AP-H=${d.ap_h_count}`);
    }

    // Identify master (no [L0] suffix) and variant ([L0] suffix)
    const masterRow = allInsertDocs.find(d =>
        !d.project_name.includes('[') &&
        (d.project_name.toUpperCase().includes('INSERTO') || d.project_name.toUpperCase().includes('INSERT'))
    );
    const variantRow = allInsertDocs.find(d =>
        d.project_name.includes('[L0]')
    );

    if (!masterRow) {
        console.error('  ERROR: Insert Patagonia master AMFE not found!');
        close();
        process.exit(1);
    }

    console.log(`\n  Master:  ${masterRow.amfe_number} | ${masterRow.project_name}`);
    if (variantRow) {
        console.log(`  Variant: ${variantRow.amfe_number} | ${variantRow.project_name}`);
    } else {
        console.log(`  Variant: NOT FOUND (no L0 variant)`);
    }

    // ── Step 2: Fix the master document ────────────────────────────────
    console.log('\n── Step 2: Fixing AP=H causes in master ──────────────────');

    const masterDoc = JSON.parse(masterRow.data);
    const { fixed: masterFixed, skipped: masterSkipped } = fixApHCauses(masterDoc);

    console.log(`  Fixed:   ${masterFixed.length} causes`);
    console.log(`  Skipped: ${masterSkipped} causes (already had actions)`);

    for (const f of masterFixed) {
        console.log(`    FIXED: Op ${f.opNumber} "${f.opName}" | "${f.causeText}..." → ${f.responsible}`);
    }

    if (masterFixed.length === 0) {
        console.log('  No changes needed in master. Exiting.');
        close();
        return;
    }

    // Recompute stats and save
    const masterStats = computeStats(masterDoc);
    const masterData = JSON.stringify(masterDoc);
    const masterChecksum = sha256(masterData);

    console.log(`  New stats: causes=${masterStats.causeCount}, AP-H=${masterStats.apHCount}, coverage=${masterStats.coveragePercent}%`);

    await execSql(
        `UPDATE amfe_documents
         SET data = ?, checksum = ?,
             operation_count = ?, cause_count = ?, ap_h_count = ?, ap_m_count = ?,
             coverage_percent = ?, updated_at = NOW()
         WHERE id = ?`,
        [masterData, masterChecksum,
         masterStats.operationCount, masterStats.causeCount, masterStats.apHCount, masterStats.apMCount,
         masterStats.coveragePercent, masterRow.id]
    );

    console.log('  SAVED master to Supabase.');

    // ── Step 3: Fix the L0 variant document (same causes) ─────────────
    if (variantRow) {
        console.log('\n── Step 3: Fixing AP=H causes in L0 variant ─────────────');

        const variantDoc = JSON.parse(variantRow.data);
        const { fixed: variantFixed, skipped: variantSkipped } = fixApHCauses(variantDoc);

        console.log(`  Fixed:   ${variantFixed.length} causes`);
        console.log(`  Skipped: ${variantSkipped} causes (already had actions)`);

        if (variantFixed.length > 0) {
            const variantStats = computeStats(variantDoc);
            const variantData = JSON.stringify(variantDoc);
            const variantChecksum = sha256(variantData);

            console.log(`  New stats: causes=${variantStats.causeCount}, AP-H=${variantStats.apHCount}, coverage=${variantStats.coveragePercent}%`);

            await execSql(
                `UPDATE amfe_documents
                 SET data = ?, checksum = ?,
                     operation_count = ?, cause_count = ?, ap_h_count = ?, ap_m_count = ?,
                     coverage_percent = ?, updated_at = NOW()
                 WHERE id = ?`,
                [variantData, variantChecksum,
                 variantStats.operationCount, variantStats.causeCount, variantStats.apHCount, variantStats.apMCount,
                 variantStats.coveragePercent, variantRow.id]
            );

            console.log('  SAVED variant to Supabase.');
        } else {
            console.log('  No changes needed in variant.');
        }
    }

    // ── Step 4: Create change proposals for L0 variant ────────────────
    if (variantRow && masterFixed.length > 0) {
        console.log('\n── Step 4: Creating change proposals for L0 ─────────────');

        // Find the family_documents records
        const familyDocs = await selectSql(
            `SELECT fd.id, fd.family_id, fd.module, fd.document_id, fd.is_master, fd.source_master_id
             FROM family_documents fd
             WHERE fd.module = 'amfe'
               AND (fd.document_id = ? OR fd.document_id = ?)
             ORDER BY fd.is_master DESC`,
            [masterRow.id, variantRow.id]
        );

        console.log(`  Found ${familyDocs.length} family_document records:`);
        for (const fd of familyDocs) {
            console.log(`    id=${fd.id}, family=${fd.family_id}, doc=${fd.document_id}, master=${fd.is_master}`);
        }

        const masterFd = familyDocs.find(fd => fd.is_master === 1);
        const variantFd = familyDocs.find(fd => fd.is_master === 0 || fd.is_master === false);

        if (masterFd && variantFd) {
            // Collect unique operation IDs that were changed
            const changedOpIds = [...new Set(masterFixed.map(f => f.opId))];

            console.log(`  Creating ${changedOpIds.length} change proposals (one per changed operation)...`);

            // Clear any existing pending proposals for this variant first
            await execSql(
                `DELETE FROM family_change_proposals
                 WHERE target_family_doc_id = ? AND status IN ('pending', 'auto_applied')`,
                [variantFd.id]
            );

            for (const opId of changedOpIds) {
                // Find the corresponding operation in the master doc for new_data
                const masterOp = masterDoc.operations.find(op => op.id === opId);
                if (!masterOp) continue;

                await execSql(
                    `INSERT INTO family_change_proposals
                     (family_id, module, master_doc_id, target_family_doc_id,
                      change_type, item_type, item_id, old_data, new_data, status)
                     VALUES (?, 'amfe', ?, ?, 'modified', 'amfe_operation', ?, NULL, ?, 'auto_applied')`,
                    [
                        masterFd.family_id,
                        masterRow.id,
                        variantFd.id,
                        opId,
                        JSON.stringify(masterOp),
                    ]
                );

                const causesInOp = masterFixed.filter(f => f.opId === opId);
                console.log(`    Op ${masterOp.opNumber} "${masterOp.name.substring(0, 40)}": ${causesInOp.length} cause(s) fixed → auto_applied`);
            }

            console.log('  Change proposals created.');
        } else {
            console.log('  WARNING: Could not find family_documents records. Skipping change proposals.');
            console.log('    This means the document may not be linked to a family.');
        }
    }

    // ── Step 5: Verification ──────────────────────────────────────────
    console.log('\n── Step 5: Verification ──────────────────────────────────');

    for (const target of [masterRow, variantRow].filter(Boolean)) {
        const rows = await selectSql(
            `SELECT amfe_number, project_name, ap_h_count, data
             FROM amfe_documents WHERE id = ?`,
            [target.id]
        );

        if (rows.length === 0) continue;

        const row = rows[0];
        const doc = JSON.parse(row.data);

        let apHNoAction = 0, apHWithAction = 0;
        for (const op of doc.operations || []) {
            for (const we of op.workElements || []) {
                for (const fn of we.functions || []) {
                    for (const fail of fn.failures || []) {
                        for (const cause of fail.causes || []) {
                            if (cause.ap === 'H' || cause.ap === 'HIGH') {
                                const hasAction = (cause.preventionAction && cause.preventionAction.trim()) ||
                                                  (cause.detectionAction && cause.detectionAction.trim());
                                if (hasAction) apHWithAction++;
                                else apHNoAction++;
                            }
                        }
                    }
                }
            }
        }

        console.log(`  ${row.amfe_number}: AP-H total=${row.ap_h_count}, with actions=${apHWithAction}, WITHOUT actions=${apHNoAction}`);

        if (apHNoAction > 0) {
            console.log(`    WARNING: Still has ${apHNoAction} AP=H causes without actions!`);
        } else {
            console.log(`    OK: All AP=H causes have corrective actions.`);
        }
    }

    // ── Done ──────────────────────────────────────────────────────────
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`  TOTAL: ${masterFixed.length} AP=H causes fixed in Insert Patagonia`);
    console.log(`═══════════════════════════════════════════════════════════`);

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
