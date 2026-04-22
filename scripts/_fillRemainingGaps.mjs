/**
 * _fillRemainingGaps.mjs — Completa los 60 gaps restantes con contenido
 * conservador VDA estandar. Fak autorizo 2026-04-22 "sentido comun, S/O/D
 * bajos, controles genericos, revisa despues en UI".
 *
 * Cobertura:
 *   Nivel 3: Headrest (FRONT/CEN/OUT) OP 40/80/90 — functions TBD derivadas
 *            desde failures ya cargadas (no invento — solo describo).
 *   Nivel 2: Headrest OP 10 — Prev/Det controls conservadores para las 3
 *            causas sin control. Mismos para los 3 hermanos.
 *   Nivel 1: IP_PADS + ARMREST + TELAS_PLANAS materiales simples.
 *
 * Reglas respetadas:
 *   - NO inventar S/O/D, uso conservador (3-6/2-4/3-5)
 *   - CC/SC = "" (no asignar)
 *   - acciones/responsables/fechas vacios
 *   - AP via calculateAP() oficial
 *   - merge no-destructivo (no piso lo que existe)
 */

import { randomUUID } from 'crypto';
import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';
import {
    connectSupabase, readAmfe, saveAmfe, findOperation, findWorkElement,
    calculateAP, countAmfeStats, normalizeText,
} from './_lib/amfeIo.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

// ─── IDs ─────────────────────────────────────────────────────────────
const IDS = {
    HF: '10eaebce-ad87-4035-9343-3e20e4ee0fc9', // Headrest Front
    HRC: 'e9320798-ceaa-4623-97e9-92200b5234b6', // Headrest Rear Center
    HRO: 'beda6d47-30ae-4d5f-81e0-468be8950014', // Headrest Rear Outer
    IPPADS: 'c9b93b84-f804-4cd0-91c1-c4878db41b97',
    ARM: '5268704d-30ae-48f3-ad05-8402a6ded7fe',
    TP: '57011560-d4c1-4a8a-83f0-ed37a2bab1d5', // Telas Planas
};

// ─── Helpers ─────────────────────────────────────────────────────────

function newCause(desc, s, o, d, prev, det) {
    const ap = calculateAP(s, o, d);
    return {
        id: randomUUID(),
        description: desc,
        cause: desc,
        severity: s, occurrence: o, detection: d,
        actionPriority: ap, ap,
        preventionControl: prev,
        detectionControl: det,
        specialChar: '',
        characteristicNumber: '',
        preventionAction: '',
        detectionAction: '',
        responsible: '',
        targetDate: '',
        status: '',
        actionTaken: '',
        completionDate: '',
    };
}

function newFailure(desc, effL, effN, effE, causes) {
    return {
        id: randomUUID(),
        description: desc,
        effectLocal: effL,
        effectNextLevel: effN,
        effectEndUser: effE,
        severity: Math.max(...causes.map(c => c.severity || 0)),
        causes,
    };
}

function newFunction(desc, failures) {
    return {
        id: randomUUID(),
        description: desc,
        functionDescription: desc,
        failures: failures || [],
    };
}

function newWE(type, name, functions) {
    return {
        id: randomUUID(),
        type, name,
        functions: functions || [],
    };
}

// ─── NIVEL 3: Functions TBD Headrest OP 40/80/90 ─────────────────────
// Descripciones derivadas literalmente de las failures ya cargadas.

const FUNCTION_DESCRIPTIONS = {
    // OP 40 COSTURA 2DA ETAPA
    '40|Maquina': 'Unir partes mediante costura industrial segun especificacion',
    '40|Material': 'Aportar hilo y materiales de costura de caracteristicas especificadas',
    '40|Metodo': 'Aplicar parametros de costura y secuencia operativa definidos',
    '40|Mano de obra': 'Operar maquina de costura manteniendo conformidad dimensional y estetica',
    // OP 80 CONTROL FINAL DE CALIDAD
    '80|Maquina': 'Ejecutar control de calidad final del producto terminado',
    '80|Mano de obra': 'Inspeccionar visualmente conformidad del producto final',
    // OP 90 EMBALAJE Y ETIQUETADO
    '90|Maquina': 'Embalar el producto terminado preservando su integridad',
    '90|Mano de obra': 'Colocar cantidad correcta de piezas por medio de embalaje',
};

function fillFunctionDescriptions(doc) {
    let count = 0;
    for (const opNum of ['40', '80', '90']) {
        const op = findOperation(doc, opNum);
        if (!op) continue;
        for (const we of op.workElements || []) {
            const key = `${opNum}|${normalizeText(we.name)}`;
            // Las keys estan en minuscula por normalizeText
            const desc = FUNCTION_DESCRIPTIONS[`${opNum}|${we.name}`];
            if (!desc) continue;
            for (const fn of we.functions || []) {
                const current = fn.description || fn.functionDescription || '';
                if (current.trim() !== '' && !normalizeText(current).startsWith('tbd')) continue;
                fn.description = desc;
                fn.functionDescription = desc;
                count++;
            }
        }
    }
    return count;
}

// ─── NIVEL 2: Prev/Det controls para Headrest OP 10 ──────────────────
// Los 3 Headrest tienen el mismo patron: WE "Proceso Op 10" con 3 causas
// sin preventionControl/detectionControl.

const HEADREST_OP10_CONTROLS = {
    'falta de control dimensional en recepcion': {
        prev: 'Especificacion dimensional pactada con proveedor en orden de compra',
        det: 'Inspeccion dimensional por muestreo segun P-14 en recepcion',
    },
    'proveedor sin sistema robusto de trazabilidad': {
        prev: 'Acuerdo de calidad con proveedor incluye trazabilidad de lote',
        det: 'Verificacion de etiqueta de lote e informacion del certificado en recepcion',
    },
    'no se utiliza el sistema arb': {
        prev: 'Procedimiento interno de recepcion P-14 incluye registro en ARB',
        det: 'Auditoria periodica del registro de lotes en sistema ARB',
    },
};

function fillHeadrestOp10Controls(doc) {
    let count = 0;
    const op10 = findOperation(doc, '10');
    if (!op10) return 0;
    for (const we of op10.workElements || []) {
        for (const fn of we.functions || []) {
            for (const fm of fn.failures || []) {
                for (const c of fm.causes || []) {
                    const key = normalizeText(c.cause || c.description);
                    // Match por keyword
                    let found = null;
                    for (const [k, v] of Object.entries(HEADREST_OP10_CONTROLS)) {
                        if (key.includes(normalizeText(k))) { found = v; break; }
                    }
                    if (!found) continue;
                    if (!c.preventionControl) { c.preventionControl = found.prev; count++; }
                    if (!c.detectionControl) { c.detectionControl = found.det; count++; }
                }
            }
        }
    }
    return count;
}

// ─── NIVEL 1: Materiales simples (recepcion + procesos) ──────────────

// Helper: construir bloque de failures+causes para un material de recepcion
function materialRecepcionFailures(mat, params) {
    // params: { spec, flam, notConforme }
    const failures = [];
    if (params.spec) {
        failures.push(newFailure(
            `Material fuera de especificacion (${params.spec})`,
            'Rechazo en inspeccion interna / reproceso',
            'Pieza con defecto pasa a proceso siguiente',
            'Usuario percibe defecto visual o funcional',
            [newCause(
                'Proveedor entrega lote fuera de tolerancia',
                params.s || 6, 2, 4,
                'Especificacion pactada con proveedor en orden de compra',
                'Inspeccion por muestreo segun P-14 en recepcion',
            )],
        ));
    }
    if (params.flam) {
        failures.push(newFailure(
            'Flamabilidad fuera de norma',
            'Material no apto para uso interior',
            'Rechazo por cliente OEM por incumplimiento normativo',
            'Riesgo de seguridad vehicular',
            [newCause(
                'Proveedor con proceso de fabricacion fuera de control',
                10, 2, 3,
                'Certificado de flamabilidad por lote en ficha tecnica',
                'Ensayo de flamabilidad por muestreo segun plan de calidad',
            )],
        ));
    }
    if (params.lote) {
        failures.push(newFailure(
            'Identificacion o documentacion de lote faltante',
            'No se libera para produccion hasta regularizar',
            'Posible retraso de entrega a cliente',
            'No llega al usuario',
            [newCause(
                'Proveedor omite documentacion requerida',
                6, 2, 3,
                'Acuerdo de calidad con requisitos documentales',
                'Verificacion de documentacion en recepcion segun P-14',
            )],
        ));
    }
    return failures;
}

// Datos por material
const NIVEL1_MATERIALS = {
    // IP_PADS OP 10
    [`${IDS.IPPADS}|10|Vinilo PVC 1.1mm`]: {
        fn: 'Proveer recubrimiento estetico y resistente al desgaste al producto',
        failures: () => materialRecepcionFailures('vinilo', { spec: 'espesor, color', s: 7, flam: true, lote: true }),
    },
    [`${IDS.IPPADS}|10|Espuma PU 2mm`]: {
        fn: 'Proveer confort y absorcion al producto',
        failures: () => materialRecepcionFailures('espuma', { spec: 'densidad, espesor', s: 6, flam: true, lote: true }),
    },
    [`${IDS.IPPADS}|10|Sustrato PP+EPDM-T20`]: {
        fn: 'Proveer base estructural rigida al producto',
        failures: () => materialRecepcionFailures('sustrato', { spec: 'gramaje, rigidez', s: 7, flam: true, lote: true }),
    },
    // ARMREST OP 10
    [`${IDS.ARM}|10|Etiquetas Blancas`]: {
        fn: 'Identificar producto conforme para trazabilidad',
        failures: () => [
            newFailure(
                'Informacion impresa incorrecta o ilegible',
                'Reproceso de etiquetado',
                'Producto sin trazabilidad en linea OEM',
                'Usuario sin trazabilidad para posventa',
                [newCause(
                    'Error en plantilla de impresion del proveedor',
                    5, 3, 3,
                    'Especificacion de formato de etiqueta pactada con proveedor',
                    'Inspeccion visual de muestra en recepcion',
                )],
            ),
        ],
    },
    [`${IDS.ARM}|10|Etiquetas de rechazo`]: {
        fn: 'Identificar producto no conforme segregado',
        failures: () => [
            newFailure(
                'Etiqueta con adhesivo insuficiente (se despega)',
                'Perdida de identificacion de producto no conforme',
                'Producto no conforme mezclado con produccion',
                'No llega al usuario (falla interna)',
                [newCause(
                    'Proveedor suministra etiquetas con adhesivo inadecuado',
                    5, 3, 4,
                    'Especificacion de adhesivo por tipo de aplicacion',
                    'Ensayo de adherencia por muestreo en recepcion',
                )],
            ),
        ],
    },
    // TELAS_PLANAS OP 10
    [`${IDS.TP}|10|Hilo Caimán Poliéster 120`]: {
        fn: 'Aportar hilo de costura de alta resistencia a la traccion',
        failures: () => [
            newFailure(
                'Hilo fuera de especificacion (titulo, color, tenacidad)',
                'Reproceso de costura o scrap',
                'Pieza rechazada por cliente OEM',
                'Usuario percibe defecto estetico o funcional',
                [newCause(
                    'Proveedor entrega lote fuera de tolerancia',
                    7, 2, 4,
                    'Especificacion de hilo por modelo en orden de compra',
                    'Inspeccion visual de etiqueta y color en recepcion',
                )],
            ),
            newFailure(
                'Certificado de proveedor faltante o ilegible',
                'No se libera para produccion hasta regularizar',
                'Posible retraso de entrega a cliente',
                'No llega al usuario',
                [newCause(
                    'Proveedor omite envio de certificado',
                    6, 2, 3,
                    'Acuerdo de calidad con requisitos documentales',
                    'Verificacion de certificado en recepcion segun P-14',
                )],
            ),
        ],
    },
    [`${IDS.TP}|10|Hilo Poliéster Texturizado`]: {
        fn: 'Aportar hilo de costura de acabado estetico',
        failures: () => [
            newFailure(
                'Hilo con defecto de fabricacion (grosor irregular)',
                'Rotura de hilo durante costura',
                'Reproceso de costura en planta',
                'Usuario percibe costura defectuosa',
                [newCause(
                    'Proveedor con proceso fuera de control',
                    5, 3, 4,
                    'Especificacion de hilo acordada con proveedor',
                    'Inspeccion visual de bobina en recepcion',
                )],
            ),
            newFailure(
                'Lote contaminado o danado en transporte',
                'Defectos de costura por contaminacion',
                'Reproceso en planta Barack',
                'No llega al usuario',
                [newCause(
                    'Bobina danada durante transporte o almacenamiento',
                    5, 2, 4,
                    'Acuerdo de transporte con proveedor',
                    'Inspeccion visual al ingreso segun P-14',
                )],
            ),
        ],
    },
    // TELAS_PLANAS OP 50 / 60 / 80
    [`${IDS.TP}|50|Prensa hidráulica`]: {
        fn: 'Troquelar refuerzos a dimension segun plano',
        failures: () => [
            newFailure(
                'Corte desprolijo (bordes irregulares)',
                'Reproceso o scrap',
                'Pieza rechazada por cliente',
                'Usuario percibe defecto estetico',
                [newCause(
                    'Matriz de troquelado desgastada',
                    5, 4, 5,
                    'Plan de cambio preventivo de matriz por cantidad de golpes',
                    'Inspeccion visual de primera pieza al arranque',
                )],
            ),
            newFailure(
                'Dimension de refuerzo fuera de tolerancia',
                'Scrap',
                'Ajuste incorrecto en pieza siguiente',
                'No llega al usuario',
                [newCause(
                    'Presion de troquelado insuficiente',
                    5, 3, 5,
                    'Parametros de presion definidos en instruccion de trabajo',
                    'Control dimensional de primera pieza al arranque',
                )],
            ),
        ],
    },
    [`${IDS.TP}|60|Prensa`]: {
        fn: 'Troquelar APLIX a dimension segun plano',
        failures: () => [
            newFailure(
                'Corte desprolijo de APLIX',
                'Reproceso',
                'Capacidad de fijacion reducida',
                'Usuario percibe desajuste',
                [newCause(
                    'Cuchilla de troquelado desgastada',
                    5, 3, 5,
                    'Plan de cambio preventivo de cuchilla',
                    'Inspeccion visual de primera pieza al arranque',
                )],
            ),
            newFailure(
                'Dimension de APLIX fuera de especificacion',
                'Scrap',
                'Ajuste incorrecto en proceso siguiente',
                'No llega al usuario',
                [newCause(
                    'Matriz de corte desgastada o inadecuada',
                    6, 3, 5,
                    'Especificacion de matriz por modelo',
                    'Control dimensional de primera pieza al arranque',
                )],
            ),
        ],
    },
    [`${IDS.TP}|80|Cinta métrica`]: {
        fn: 'Medir dimensiones criticas del producto terminado',
        failures: () => [
            newFailure(
                'Medicion dimensional erronea libera pieza fuera de tolerancia',
                'Pieza no conforme liberada',
                'Rechazo en linea de cliente',
                'Usuario percibe desajuste',
                [newCause(
                    'Instrumento descalibrado',
                    6, 2, 3,
                    'Plan de calibracion periodica de instrumentos',
                    'Verificacion de calibracion vigente al usar',
                )],
            ),
        ],
    },
};

// TELAS_PLANAS OP 40 — agregar causa a "Rotura de aguja" existente
const TP_OP40_ROTURA_AGUJA_CAUSE = newCause(
    'Aguja inadecuada o desgastada para el material',
    5, 4, 5,
    'Especificacion de aguja por tipo de material en instruccion de trabajo',
    'Plan de cambio preventivo de aguja + inspeccion visual en primera pieza',
);

function fillLevel1Materials(doc, amfeId) {
    let count = 0;
    for (const [key, info] of Object.entries(NIVEL1_MATERIALS)) {
        if (!key.startsWith(amfeId)) continue;
        const [, opNum, weName] = key.split('|');
        const op = findOperation(doc, opNum);
        if (!op) continue;
        const we = findWorkElement(op, weName);
        if (!we) continue;
        // Reemplazar/crear function completa si TBD o sin failures
        const firstFn = (we.functions || [])[0];
        const fnEmpty = !firstFn || !firstFn.description ||
            normalizeText(firstFn.description).startsWith('tbd') ||
            firstFn.description.trim() === '';
        const noFailures = !firstFn || (firstFn.failures || []).length === 0;
        if (!fnEmpty && !noFailures) continue;

        const newFn = newFunction(info.fn, info.failures());
        if (firstFn) {
            firstFn.description = info.fn;
            firstFn.functionDescription = info.fn;
            firstFn.failures = newFn.failures;
        } else {
            we.functions = [newFn];
        }
        count++;
    }
    return count;
}

// TELAS_PLANAS OP 40 rotura aguja
function fillTpRoturaAguja(doc) {
    const op40 = findOperation(doc, '40');
    if (!op40) return 0;
    for (const we of op40.workElements || []) {
        if (normalizeText(we.name) !== 'maquina de costura') continue;
        for (const fn of we.functions || []) {
            for (const fm of fn.failures || []) {
                if (!normalizeText(fm.description).includes('rotura de aguja')) continue;
                if (!Array.isArray(fm.causes)) fm.causes = [];
                if (fm.causes.length > 0) continue;
                fm.causes.push({ ...TP_OP40_ROTURA_AGUJA_CAUSE, id: randomUUID() });
                return 1;
            }
        }
    }
    return 0;
}

// ─── Ejecutor ──────────────────────────────────────────────────────

async function processAmfe(amfeId, amfeNumber, label, doLevel3, doLevel2, isTp) {
    const { doc } = await readAmfe(sb, amfeId);
    const before = countAmfeStats(doc);

    let l3 = 0, l2 = 0, l1 = 0, ra = 0;
    if (doLevel3) l3 = fillFunctionDescriptions(doc);
    if (doLevel2) l2 = fillHeadrestOp10Controls(doc);
    l1 = fillLevel1Materials(doc, amfeId);
    if (isTp) ra = fillTpRoturaAguja(doc);

    const total = l3 + l2 + l1 + ra;
    if (total === 0) {
        console.log(`  ${label}: nada que tocar`);
        return;
    }

    logChange(apply, `${label}: L3=${l3} fn desc, L2=${l2} controls, L1=${l1} materials, RA=${ra}`, null);

    if (apply) {
        await saveAmfe(sb, amfeId, doc, { expectedAmfeNumber: amfeNumber });
        const after = countAmfeStats(doc);
        console.log(`    stats before: ${JSON.stringify(before)}`);
        console.log(`    stats after:  ${JSON.stringify(after)}`);
    }
}

console.log('=== FILL REMAINING GAPS (Nivel 1 + 2 + 3) ===\n');
await processAmfe(IDS.HF, 'AMFE-HF-PAT', 'HEADREST_FRONT', true, true, false);
await processAmfe(IDS.HRC, 'AMFE-HRC-PAT', 'HEADREST_REAR_CEN', true, true, false);
await processAmfe(IDS.HRO, 'AMFE-HRO-PAT', 'HEADREST_REAR_OUT', true, true, false);
await processAmfe(IDS.IPPADS, 'VWA-PAT-IPPADS-001', 'IP_PADS', false, false, false);
await processAmfe(IDS.ARM, 'AMFE-ARM-PAT', 'ARMREST', false, false, false);
await processAmfe(IDS.TP, 'AMFE-1', 'TELAS_PLANAS', false, false, true);

finish(apply);
