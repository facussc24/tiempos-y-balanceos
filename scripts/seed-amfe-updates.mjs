// ─── AMFE INSERTO: Updates based on HO PDF analysis (2026-03-09) ────────────
// Adds:
//   1. New Op 105: REFILADO POST-TAPIZADO (from HO PDF Op 40)
//   2. Patches for Op 10: material-specific identification failures
//   3. Patches for Op 100: temperature control cause
//   4. Patches for Op 110: CC upgrade for ASPECTO and COSTURA
// ─────────────────────────────────────────────────────────────────────────────

import { mkCause, mkFailure, mkFunc, mkWE, mkOp, uuid } from './seed-amfe-inserto.mjs';

// ─── NEW Operation 105: REFILADO POST-TAPIZADO ──────────────────────────────
// Source: HO PDF Op 40 — trimming excess vinyl/material after vacuum forming
// This is DIFFERENT from Op 40 (Costura-Refilado) which trims during sewing.

export const op105 = mkOp(105, 'REFILADO POST-TAPIZADO', [
    mkWE('Man', 'Operador de producción', [
        {
            desc: 'Realizar el refilado completo de la pieza tapizada, eliminando bordes y material sobrante. Verificar conformidad contra pieza patrón.',
            req: 'Obtener pieza tapizada con bordes limpios y dimensiones conformes a la pieza patrón',
            failures: [
                {
                    desc: 'Refilado incompleto o con exceso de material sobrante',
                    efLocal: 'Retrabajo en línea o scrap si el vinilo se daña',
                    efClient: 'Pieza no encastra correctamente en el panel de puerta',
                    efUser: 'Defecto estético visible, posible despegue posterior',
                    S: 7,
                    causes: [
                        {
                            cause: 'Operador no sigue la referencia de la pieza patrón al refilar',
                            prev: 'Pieza patrón disponible junto al puesto de trabajo. Hoja de Operaciones con imagen de referencia del refilado correcto.',
                            det: 'Comparación visual contra pieza patrón al inicio de turno y cada cambio de lote',
                            O: 6, D: 6, ap: 'H', sc: 'SC',
                        },
                        {
                            cause: 'Cutter desafilado que produce corte irregular o rasgadura del vinilo',
                            prev: 'Procedimiento de cambio de cuchilla cada turno o al detectar desgaste',
                            det: 'Inspección visual de la calidad de corte en las primeras piezas del turno (set-up)',
                            O: 5, D: 6, ap: 'M', sc: 'SC',
                        },
                    ],
                },
                {
                    desc: 'Corte excesivo: vinilo cortado más allá del límite, dejando sustrato plástico expuesto',
                    efLocal: 'Scrap irrecuperable de la pieza',
                    efClient: 'Pieza rechazada en recepción por defecto visual grave',
                    efUser: 'Defecto estético inaceptable',
                    S: 8,
                    causes: [
                        {
                            cause: 'Operador aplica presión excesiva o desvía el cutter de la línea de corte',
                            prev: 'Ayudas visuales con zona de corte demarcada. Capacitación del operador en técnica de refilado.',
                            det: 'Autocontrol visual del operador pieza a pieza (100%)',
                            O: 4, D: 6, ap: 'H', sc: 'SC',
                        },
                    ],
                },
                {
                    desc: 'Daño al vinilo durante el refilado (rasgadura, marca de cutter)',
                    efLocal: 'Scrap de la pieza',
                    efClient: 'Rechazo en auditoría de recepción',
                    efUser: 'Defecto estético visible',
                    S: 8,
                    causes: [
                        {
                            cause: 'Manipulación incorrecta de la pieza sobre la mesa de refilado',
                            prev: 'Superficie de mesa protegida. Instrucción de apoyo correcto de la pieza.',
                            det: 'Autocontrol visual del operador (100%)',
                            O: 3, D: 6, ap: 'M', sc: 'SC',
                        },
                    ],
                },
            ],
        },
    ]),
    mkWE('Machine', 'Mesa de refilado / Cutter manual', [
        {
            desc: 'Proporcionar superficie de trabajo adecuada y herramienta de corte afilada',
            failures: [],
        },
    ]),
    mkWE('Method', 'Hoja de operaciones / Ayudas visuales / Pieza patrón', [
        {
            desc: 'Definir el método de refilado con referencia visual y pieza patrón de comparación',
            failures: [],
        },
    ]),
    mkWE('Material', 'Cutter / Cuchillas de repuesto', []),
    mkWE('Environment', 'Iluminación/Ruido - Ley 19587', []),
]);

// ─── PATCH: Op 10 — New failure for material-specific identification ────────
// Source: HO PDF Op 10 quality checks — 7 specific materials to verify

export const op10_materialIdentificationFailure = mkFailure({
    desc: 'Material recibido con identificación incorrecta o no verificada (código, lote, color, fecha de vencimiento)',
    efLocal: 'Ingreso de material incorrecto al proceso productivo. Potencial scrap del lote completo.',
    efClient: 'Producto terminado con material incorrecto. Parada de línea.',
    efUser: 'Falla estética (color incorrecto) o funcional (material incorrecto)',
    S: 8,
    causes: [
        {
            cause: 'No se verifica color del Hilo Needle thread Linanhyl según variante (Jet Black / Alpe Gray)',
            prev: 'Planilla de recepción con identificación de variante y color requerido por OP. Etiqueta del proveedor con color claramente indicado.',
            det: 'Verificación visual y documental del operador en cada recepción contra planilla de recepción',
            O: 5, D: 5, ap: 'M', sc: 'SC',
        },
        {
            cause: 'No se verifica fecha de vencimiento del adhesivo SikaMelt® 171IMG (SIKA)',
            prev: 'Planilla de recepción incluye campo obligatorio de fecha de vencimiento. Sistema FIFO en almacén.',
            det: 'Verificación visual y documental del operador en cada recepción contra planilla de recepción',
            O: 5, D: 5, ap: 'M', sc: 'SC',
        },
        {
            cause: 'No se verifica identificación de la cinta Tessa 52110 1500mm x 200m (TESA)',
            prev: 'Planilla de recepción con código y dimensión requerida. Etiqueta del proveedor verificable.',
            det: 'Verificación visual y documental del operador en cada recepción contra planilla de recepción',
            O: 4, D: 5, ap: 'M', sc: '',
        },
        {
            cause: 'No se verifica color/estado del Vinilo PVC 1mm+3mm PU (SANSUY) según variante (Titan Black / Platinium)',
            prev: 'Planilla de recepción con variante y color requerido por OP. Muestras de referencia de color disponibles.',
            det: 'Verificación visual y documental del operador en cada recepción contra planilla de recepción',
            O: 5, D: 5, ap: 'M', sc: 'SC',
        },
        {
            cause: 'No se verifica lote del PC/ABS CYCOLOY™ LG9000 (SABIC)',
            prev: 'Planilla de recepción con campo obligatorio de lote. Certificado de calidad del proveedor.',
            det: 'Verificación visual y documental del operador en cada recepción contra planilla de recepción',
            O: 4, D: 5, ap: 'M', sc: 'SC',
        },
        {
            cause: 'No se verifica identificación del PU FOAM 35Kg/m3 + 3mm (Sponge layer)',
            prev: 'Planilla de recepción con densidad y espesor requerido. Etiqueta del proveedor verificable.',
            det: 'Verificación visual y documental del operador en cada recepción contra planilla de recepción',
            O: 4, D: 5, ap: 'M', sc: '',
        },
    ],
});

// New function to inject into Op 10 > Method work element
export const op10_materialIdFunction = mkFunc({
    desc: 'Verificar la identidad específica de cada material recibido (código, lote, color, fecha de vencimiento) contra la planilla de recepción',
    req: 'Cada material debe ser verificado individualmente antes de su ingreso al almacén',
    failures: [op10_materialIdentificationFailure],
});

// ─── PATCH: Op 100 — New cause for temperature control ──────────────────────
// Source: HO PDF Op 30 — "Verificación de temperatura en vinilo y sustrato"

export const op100_temperatureCause = mkCause({
    cause: 'Temperatura del vinilo o sustrato fuera de rango operativo (verificación con termómetro infrarrojo no realizada o resultado NOK)',
    prev: 'Control de temperatura con termómetro infrarrojo cada 2 horas según set-up. Rango operativo definido en Hoja de Operaciones.',
    det: 'Registro de temperatura en planilla de set-up. Calidad verifica frecuencialmente cada 2 horas.',
    O: 5, D: 5, ap: 'M', sc: 'SC',
});

// This cause should be added to Op 100 > Machine > first function > failure "Se coloca mal el vinilo" (S=8)
// because incorrect temperature causes poor adhesion → same effect as misplaced vinyl.

// ─── PATCH: Op 100 — New failure for machine parameters ─────────────────────
// Source: HO PDF Op 30 — "Verificación de parámetros de máquina (tiempos de ciclo)"

export const op100_parameterFailure = mkFailure({
    desc: 'Parámetros de máquina fuera de especificación (tiempos de ciclo, temperatura, presión de vacío)',
    efLocal: 'Adhesión deficiente del vinilo al sustrato. Scrap o retrabajo.',
    efClient: 'Potencial despegue del vinilo en servicio. Parada de línea.',
    efUser: 'Despegue del tapizado, defecto estético grave',
    S: 8,
    causes: [
        {
            cause: 'Tiempos de ciclo no verificados al inicio de turno según display de máquina',
            prev: 'Set-up de lanzamiento obligatorio: verificación de tiempos de ciclo en display de máquina al inicio de cada turno',
            det: 'Timer / Display de máquina. Operador registra parámetros en planilla de set-up.',
            O: 4, D: 4, ap: 'H', sc: 'SC',
        },
        op100_temperatureCause,
    ],
});

// ─── PATCH: Op 110 — Upgrade to CC for ASPECTO and COSTURA ─────────────────
// Source: HO PDF Op 50 — ASPECTO and COSTURA are controlled by CC (Control de Calidad)
// The HO marks these as CC-level checks (every piece, by quality control)

export const op110_aspectFailure = mkFailure({
    desc: 'Defecto de aspecto no detectado en inspección final (manchas, roturas, despegues, deformaciones)',
    efLocal: 'Pieza NC llega al embalaje. Potencial contaminación del lote.',
    efClient: 'Rechazo en auditoría de recepción. Parada de línea.',
    efUser: 'Defecto estético inaceptable para el usuario final',
    S: 9,
    causes: [
        {
            cause: 'Inspector omite la verificación visual completa de aspecto (manchas, roturas, despegues, deformaciones)',
            prev: 'Checklist de inspección con cada defecto listado. Capacitación en criterios de aceptación/rechazo.',
            det: 'Inspección visual 100% por Control de Calidad (CC). Cada pieza.',
            O: 4, D: 4, ap: 'H', sc: 'CC',
        },
    ],
});

export const op110_costuraFailure = mkFailure({
    desc: 'Defecto de costura no detectado en inspección final (costura saltada, rota, desalineada, hilo suelto)',
    efLocal: 'Pieza NC llega al embalaje. Potencial contaminación del lote.',
    efClient: 'Rechazo en auditoría de recepción. Parada de línea.',
    efUser: 'Defecto funcional y estético: costura se abre en uso',
    S: 9,
    causes: [
        {
            cause: 'Inspector omite la verificación de costura y bordes según imagen de referencia',
            prev: 'Imagen de referencia de costura OK/NOK disponible en puesto de inspección. Checklist con punto específico de costura.',
            det: 'Inspección visual 100% por Control de Calidad (CC). Cada pieza.',
            O: 4, D: 4, ap: 'H', sc: 'CC',
        },
    ],
});

// ─── APPLICATOR FUNCTION ────────────────────────────────────────────────────
// Patches existing operations in-place after import

/**
 * Apply all HO-derived updates to the AMFE operations array.
 * Mutates the operations in-place.
 * Returns the new Op 105 to be spliced into the array.
 */
export function applyAmfeUpdates(allOperations) {
    const changes = [];

    // ── Patch Op 10: add material identification function ────────────────
    const op10 = allOperations.find(op => op.opNumber === '10');
    if (op10) {
        const methodWE = op10.workElements.find(we => we.type === 'Method');
        if (methodWE) {
            methodWE.functions.push(op10_materialIdFunction);
            changes.push('Op 10: Added material-specific identification failure (7 materials, 6 causes)');
        }
    }

    // ── Patch Op 100: add parameter/temperature failure ─────────────────
    const op100 = allOperations.find(op => op.opNumber === '100');
    if (op100) {
        const machineWE = op100.workElements.find(we => we.type === 'Machine');
        if (machineWE && machineWE.functions.length > 0) {
            machineWE.functions[0].failures.push(op100_parameterFailure);
            changes.push('Op 100: Added parameter/temperature verification failure (2 causes: tiempos de ciclo + temperatura)');
        }
    }

    // ── Patch Op 110: add CC-level ASPECTO and COSTURA failures ─────────
    const op110 = allOperations.find(op => op.opNumber === '110');
    if (op110) {
        const manWE = op110.workElements.find(we => we.type === 'Man');
        if (manWE && manWE.functions.length > 0) {
            manWE.functions[0].failures.push(op110_aspectFailure);
            manWE.functions[0].failures.push(op110_costuraFailure);
            changes.push('Op 110: Added ASPECTO failure (CC, S=9) and COSTURA failure (CC, S=9)');
        }
    }

    // ── Insert Op 105 in correct position ───────────────────────────────
    const idx120 = allOperations.findIndex(op => parseInt(op.opNumber) > 103);
    if (idx120 >= 0) {
        allOperations.splice(idx120, 0, op105);
        changes.push('Op 105: NEW — REFILADO POST-TAPIZADO (3 failures, 4 causes)');
    } else {
        allOperations.push(op105);
        changes.push('Op 105: NEW — REFILADO POST-TAPIZADO (3 failures, 4 causes) [appended]');
    }

    return changes;
}
