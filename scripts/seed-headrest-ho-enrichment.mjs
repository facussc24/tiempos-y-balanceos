#!/usr/bin/env node
/**
 * SEED: Headrest HO Enrichment — Parse SET UP PDFs and enrich HO sheets
 *
 * Reads setup parameters from PDF text extracts and enriches the stub HO sheets
 * for 3 master headrest HO documents:
 *   1. Headrest Front L0 (5233c6b6-57c8-41cd-b7c2-f110a55b0bac)
 *   2. Headrest Rear Center L0 (2503aeb5-eade-4da3-a850-021b177c26f1)
 *   3. Headrest Rear Outer L0 (04e76a66-ea9b-4cc9-ae10-2537918113d4)
 *
 * Setup sources:
 *   - Mesa de Corte (telas + vinilos) → Op 20 "Corte" sheets
 *   - Costura APC AMAROK/TAOS → Op 30 "Costura Union" sheets
 *
 * Usage: node scripts/seed-headrest-ho-enrichment.mjs
 */

import { createHash, randomUUID } from 'crypto';
import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';

// ─── Helpers ────────────────────────────────────────────────────────────────

const uuid = () => randomUUID();
const sha256 = (str) => createHash('sha256').update(str).digest('hex');

const DEFAULT_REACTION_PLAN =
    'SI DETECTA "PRODUCTO" O "PROCESO" NO CONFORME:\n' +
    'DETENGA LA OPERACION\n' +
    'NOTIFIQUE DE INMEDIATO A SU LIDER O SUPERVISOR\n' +
    'ESPERE LA DEFINICION DEL LIDER O SUPERVISOR';

// ─── Master HO IDs ──────────────────────────────────────────────────────────

const MASTER_HO_IDS = [
    '5233c6b6-57c8-41cd-b7c2-f110a55b0bac', // Headrest Front L0
    '2503aeb5-eade-4da3-a850-021b177c26f1', // Headrest Rear Center L0
    '04e76a66-ea9b-4cc9-ae10-2537918113d4', // Headrest Rear Outer L0
];

// ═════════════════════════════════════════════════════════════════════════════
// SETUP DATA — Parsed from PDF text extracts
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Steps and quality checks derived from:
 *   SETUP_SET_UP_Mesa_de_corte_-_OK_vinilos.txt
 *   SETUP_SET_UP_Mesa_de_corte_-_OK_telas.txt
 *
 * These apply to Operation 20 "Corte de Vinilo" in headrest HOs.
 */
function buildCorteSteps() {
    return [
        {
            id: uuid(),
            stepNumber: 1,
            description: 'Verificar cantidad de capas de material segun estandarizacion de tizada.',
            isKeyPoint: true,
            keyPointReason: 'Cantidad incorrecta de capas afecta dimensiones y calidad del corte',
        },
        {
            id: uuid(),
            stepNumber: 2,
            description: 'Controlar el correcto alineado entre los pilones de punzonado.',
            isKeyPoint: true,
            keyPointReason: 'Alineacion incorrecta genera piezas fuera de tolerancia',
        },
        {
            id: uuid(),
            stepNumber: 3,
            description: 'Configurar parametros de mesa de corte: LARGO, VELOCIDAD y TENSION segun instructivo del programa de corte.',
            isKeyPoint: true,
            keyPointReason: 'Parametros incorrectos producen cortes defectuosos o fuera de especificacion',
        },
        {
            id: uuid(),
            stepNumber: 4,
            description: 'Verificar orden y limpieza del lugar de trabajo.',
            isKeyPoint: false,
            keyPointReason: '',
        },
        {
            id: uuid(),
            stepNumber: 5,
            description: 'Verificar estado de mesa de corte: funcionamiento general OK.',
            isKeyPoint: false,
            keyPointReason: '',
        },
        {
            id: uuid(),
            stepNumber: 6,
            description: 'Controlar cuchilla de corte con calibre. Minimo 4 mm de filo disponible.',
            isKeyPoint: true,
            keyPointReason: 'Cuchilla desgastada genera cortes irregulares y peligro de rotura de material',
        },
        {
            id: uuid(),
            stepNumber: 7,
            description: 'Verificar funcionamiento del vacio de la mesa de corte (visual y auditivo).',
            isKeyPoint: true,
            keyPointReason: 'Sin vacio las capas se mueven durante el corte produciendo piezas defectuosas',
        },
        {
            id: uuid(),
            stepNumber: 8,
            description: 'Inspeccionar que funcione el soplador de cuchilla.',
            isKeyPoint: false,
            keyPointReason: '',
        },
        {
            id: uuid(),
            stepNumber: 9,
            description: 'Verificar codigo/nombre del programa de corte segun producto a fabricar.',
            isKeyPoint: true,
            keyPointReason: 'Programa incorrecto produce piezas equivocadas o de dimensiones incorrectas',
        },
        {
            id: uuid(),
            stepNumber: 10,
            description: 'Verificar disponibilidad de medios para producir: existentes y en buen estado.',
            isKeyPoint: false,
            keyPointReason: '',
        },
        {
            id: uuid(),
            stepNumber: 11,
            description: 'Verificar identificacion de medios y que etiquetas y medio de no conforme esten disponibles en puesto.',
            isKeyPoint: false,
            keyPointReason: '',
        },
        {
            id: uuid(),
            stepNumber: 12,
            description: 'Registrar numero de lote/OP. Verificar primera pieza OK y documentar cantidades de piezas de puesta a punto.',
            isKeyPoint: true,
            keyPointReason: 'Trazabilidad del lote y liberacion de primera pieza son requisito IATF',
        },
        {
            id: uuid(),
            stepNumber: 13,
            description: 'Realizar control de forma de pieza cortada con Mylar (segun Part Number). Comparar contra pieza patron.',
            isKeyPoint: true,
            keyPointReason: 'Control dimensional contra patron asegura conformidad de la pieza',
        },
        {
            id: uuid(),
            stepNumber: 14,
            description: 'Firmar y dejar en el puesto la pieza de referencia (1a pieza OK).',
            isKeyPoint: true,
            keyPointReason: 'Pieza de referencia visible permite comparacion continua durante produccion',
        },
    ];
}

function buildCorteQualityChecks() {
    return [
        {
            id: uuid(),
            characteristic: 'Cantidad de capas de material',
            specification: 'Segun estandarizacion de tizada',
            evaluationTechnique: 'Visual',
            frequency: 'Inicio de turno / Cambio version',
            controlMethod: 'Verificacion visual contra instructivo de tizada',
            reactionAction: DEFAULT_REACTION_PLAN,
            reactionContact: 'Lider / Inspector de calidad',
            specialCharSymbol: '',
            registro: 'Planilla de SET UP mesa de corte',
        },
        {
            id: uuid(),
            characteristic: 'Parametros de corte: LARGO, VELOCIDAD, TENSION',
            specification: 'Segun instructivo de programa de corte',
            evaluationTechnique: 'Visual / Lectura de parametros',
            frequency: 'Inicio de turno / Cambio version',
            controlMethod: 'Verificacion de parametros en panel de control vs instructivo',
            reactionAction: DEFAULT_REACTION_PLAN,
            reactionContact: 'Lider / Inspector de calidad',
            specialCharSymbol: '',
            registro: 'Planilla de SET UP mesa de corte',
        },
        {
            id: uuid(),
            characteristic: 'Estado de cuchilla de corte',
            specification: 'Minimo 4 mm de filo disponible',
            evaluationTechnique: 'Calibre',
            frequency: 'Inicio de turno / Post-mantenimiento',
            controlMethod: 'Medicion con calibre',
            reactionAction: DEFAULT_REACTION_PLAN,
            reactionContact: 'Lider / Mantenimiento',
            specialCharSymbol: '',
            registro: 'Planilla de SET UP mesa de corte',
        },
        {
            id: uuid(),
            characteristic: 'Funcionamiento del vacio de mesa de corte',
            specification: 'Funcionamiento correcto OK/NOK',
            evaluationTechnique: 'Visual / Auditivo',
            frequency: 'Inicio de turno / Corte de energia',
            controlMethod: 'Verificacion de succion y sonido del motor de vacio',
            reactionAction: DEFAULT_REACTION_PLAN,
            reactionContact: 'Lider / Mantenimiento',
            specialCharSymbol: '',
            registro: 'Planilla de SET UP mesa de corte',
        },
        {
            id: uuid(),
            characteristic: 'Codigo/nombre del programa de corte',
            specification: 'Segun programa de corte del producto',
            evaluationTechnique: 'Visual',
            frequency: 'Inicio de turno / Cambio version',
            controlMethod: 'Verificacion visual en pantalla de CNC',
            reactionAction: DEFAULT_REACTION_PLAN,
            reactionContact: 'Lider / Inspector de calidad',
            specialCharSymbol: 'SC',
            registro: 'Planilla de SET UP mesa de corte',
        },
        {
            id: uuid(),
            characteristic: 'Control de forma de pieza cortada contra Mylar/pieza patron',
            specification: 'Conforme a pieza patron — forma y dimensiones OK',
            evaluationTechnique: 'Visual / Mylar',
            frequency: 'Primera pieza + cada cambio version',
            controlMethod: 'Superposicion con Mylar (plantilla) segun Part Number',
            reactionAction: DEFAULT_REACTION_PLAN,
            reactionContact: 'Inspector de calidad',
            specialCharSymbol: 'SC',
            registro: 'Planilla 1a pieza OK',
        },
        {
            id: uuid(),
            characteristic: 'Primera pieza OK — todos los items validados',
            specification: 'Cumple con todos los parametros',
            evaluationTechnique: 'Visual / Inspector de calidad',
            frequency: 'Inicio de turno / Cambio version / Post-mantenimiento',
            controlMethod: 'Liberacion firmada por Inspector de calidad',
            reactionAction: DEFAULT_REACTION_PLAN,
            reactionContact: 'Inspector de calidad',
            specialCharSymbol: '',
            registro: 'Planilla 1a pieza OK',
        },
    ];
}

/**
 * Steps and quality checks derived from:
 *   SETUP_SET_UP_Costura_APC_AMAROK_-_TAOS_V2.txt
 *   SETUP_SET_UP_Costura_APC_AMAROK_-_TAOS_...V2.txt (TAOS variant)
 *
 * APC = Apoyacabezas (Headrest). These apply to Operation 30 "Costura Union" in headrest HOs.
 */
function buildCosturaSteps() {
    return [
        {
            id: uuid(),
            stepNumber: 1,
            description: 'Controlar estado general de la maquina de costura: verificar funcionamiento sin fallas.',
            isKeyPoint: false,
            keyPointReason: '',
        },
        {
            id: uuid(),
            stepNumber: 2,
            description: 'Controlar tension del hilo segun Hoja de Operaciones.',
            isKeyPoint: true,
            keyPointReason: 'Tension incorrecta produce costura floja o rotura de hilo',
        },
        {
            id: uuid(),
            stepNumber: 3,
            description: 'Controlar nivel de aceite de la maquina. Verificar que no haya perdidas.',
            isKeyPoint: true,
            keyPointReason: 'Perdida de aceite contamina las piezas y genera scrap',
        },
        {
            id: uuid(),
            stepNumber: 4,
            description: 'Encender maquina y verificar que prende correctamente.',
            isKeyPoint: false,
            keyPointReason: '',
        },
        {
            id: uuid(),
            stepNumber: 5,
            description: 'Verificar encendido de luz del puesto de trabajo.',
            isKeyPoint: false,
            keyPointReason: '',
        },
        {
            id: uuid(),
            stepNumber: 6,
            description: 'Verificar estado del pedal: funcionamiento sin fallas.',
            isKeyPoint: false,
            keyPointReason: '',
        },
        {
            id: uuid(),
            stepNumber: 7,
            description: 'Controlar estado del pie de la maquina de costura.',
            isKeyPoint: false,
            keyPointReason: '',
        },
        {
            id: uuid(),
            stepNumber: 8,
            description: 'Controlar aguja: verificar que no este rota ni danada. Reemplazar si es necesario segun Hoja de Operaciones.',
            isKeyPoint: true,
            keyPointReason: 'Aguja rota o danada produce defectos de costura y riesgo de contaminacion por fragmento metalico',
        },
        {
            id: uuid(),
            stepNumber: 9,
            description: 'Verificar disponibilidad de medios para producir: existentes y en buen estado. Verificar medio de no conforme en puesto.',
            isKeyPoint: false,
            keyPointReason: '',
        },
        {
            id: uuid(),
            stepNumber: 10,
            description: 'Registrar numero de orden de trabajo (OT)/lote. Verificar realizacion de 1a pieza OK.',
            isKeyPoint: true,
            keyPointReason: 'Trazabilidad del lote y liberacion de primera pieza son requisito IATF',
        },
        {
            id: uuid(),
            stepNumber: 11,
            description: 'Verificar puesto limpio y ordenado. Retirar materiales de produccion anterior.',
            isKeyPoint: false,
            keyPointReason: '',
        },
        {
            id: uuid(),
            stepNumber: 12,
            description: 'Verificar disponibilidad de Hoja de proceso, Pautas de embalaje, y Hoja de situaciones inusuales en el puesto.',
            isKeyPoint: true,
            keyPointReason: 'Documentacion de proceso en puesto es requisito IATF 8.5.1.2',
        },
        {
            id: uuid(),
            stepNumber: 13,
            description: 'Controlar margen de costura general: 8 mm (+1/-1 mm para vinilo, +2/-2 mm para tela).',
            isKeyPoint: true,
            keyPointReason: 'Margen fuera de tolerancia produce defectos de apariencia y riesgo de descosido',
        },
        {
            id: uuid(),
            stepNumber: 14,
            description: 'Controlar longitud de puntada: COSTURA PLASTICO 5 puntadas en 25mm +/- 1mm, COSTURA UNION 4 puntadas en 16mm +/- 1mm, COSTURA VISTA 4 puntadas en 16mm +/- 1mm.',
            isKeyPoint: true,
            keyPointReason: 'Longitud de puntada fuera de especificacion afecta resistencia y apariencia de costura',
        },
        {
            id: uuid(),
            stepNumber: 15,
            description: 'Controlar margen de costura de vistas: 4 mm +/- 1 mm.',
            isKeyPoint: true,
            keyPointReason: 'Margen de vista fuera de tolerancia es defecto visual en pieza terminada',
        },
        {
            id: uuid(),
            stepNumber: 16,
            description: 'Verificar refilado: 5 mm +/- 1 mm.',
            isKeyPoint: true,
            keyPointReason: 'Refilado excesivo o insuficiente afecta enfundado y apariencia',
        },
        {
            id: uuid(),
            stepNumber: 17,
            description: 'Control de aspecto general de la costura. Verificar: sin puntada salteada, sin manchas, sin roturas de material, sin hilo corrido.',
            isKeyPoint: true,
            keyPointReason: 'Defectos de aspecto son rechazados por el cliente',
        },
        {
            id: uuid(),
            stepNumber: 18,
            description: 'Verificar proyeccion de hilo: por cara B (extremos de funda) es admisible. Por cara A NO permitido.',
            isKeyPoint: true,
            keyPointReason: 'Hilo visible por cara A es defecto de apariencia rechazo directo',
        },
        {
            id: uuid(),
            stepNumber: 19,
            description: 'Inspeccionar: sin pinzas, sin arrugas, sin costuras expuestas, sin costura floja.',
            isKeyPoint: true,
            keyPointReason: 'Defectos estructurales afectan montabilidad y apariencia',
        },
        {
            id: uuid(),
            stepNumber: 20,
            description: 'Verificar existencia de pieza patron en puesto. Realizar y firmar 1a pieza OK.',
            isKeyPoint: true,
            keyPointReason: 'Pieza patron es referencia continua; 1a pieza OK valida el setup completo',
        },
        {
            id: uuid(),
            stepNumber: 21,
            description: 'Verificar EPP: elementos de proteccion personal correspondientes existentes y en buen estado.',
            isKeyPoint: false,
            keyPointReason: '',
        },
    ];
}

function buildCosturaQualityChecks() {
    return [
        {
            id: uuid(),
            characteristic: 'Tension del hilo de costura',
            specification: 'Segun Hoja de Operaciones del producto',
            evaluationTechnique: 'Visual / Operador',
            frequency: 'Inicio de turno / Cambio de bobina / Post-mantenimiento',
            controlMethod: 'Verificacion contra parametro indicado en HO',
            reactionAction: DEFAULT_REACTION_PLAN,
            reactionContact: 'Lider / Inspector de calidad',
            specialCharSymbol: '',
            registro: 'Planilla SET UP Costura APC',
        },
        {
            id: uuid(),
            characteristic: 'Estado de aguja (roturas / danadas)',
            specification: 'Sin roturas ni danos, segun Hoja de Operaciones',
            evaluationTechnique: 'Visual',
            frequency: 'Inicio de turno / Cambio de bobina / Post-mantenimiento',
            controlMethod: 'Inspeccion visual de aguja',
            reactionAction: DEFAULT_REACTION_PLAN,
            reactionContact: 'Lider / Mantenimiento',
            specialCharSymbol: '',
            registro: 'Planilla SET UP Costura APC',
        },
        {
            id: uuid(),
            characteristic: 'Nivel de aceite de maquina (perdidas)',
            specification: 'Nivel correcto, sin perdidas visibles',
            evaluationTechnique: 'Visual',
            frequency: 'Inicio de turno',
            controlMethod: 'Verificacion visual del nivel y ausencia de perdidas',
            reactionAction: DEFAULT_REACTION_PLAN,
            reactionContact: 'Lider / Mantenimiento',
            specialCharSymbol: '',
            registro: 'Planilla SET UP Costura APC',
        },
        {
            id: uuid(),
            characteristic: 'Margen de costura general (vinilo)',
            specification: '8 mm +1/-1 mm',
            evaluationTechnique: 'Visual / Regla',
            frequency: 'Primera pieza + muestreo continuo',
            controlMethod: 'Medicion con regla o calibre sobre pieza cosida',
            reactionAction: DEFAULT_REACTION_PLAN,
            reactionContact: 'Inspector de calidad',
            specialCharSymbol: 'SC',
            registro: 'Registro de Control (RC)',
        },
        {
            id: uuid(),
            characteristic: 'Margen de costura general (tela)',
            specification: '8 mm +2/-2 mm',
            evaluationTechnique: 'Visual / Regla',
            frequency: 'Primera pieza + muestreo continuo',
            controlMethod: 'Medicion con regla o calibre sobre pieza cosida',
            reactionAction: DEFAULT_REACTION_PLAN,
            reactionContact: 'Inspector de calidad',
            specialCharSymbol: 'SC',
            registro: 'Registro de Control (RC)',
        },
        {
            id: uuid(),
            characteristic: 'Longitud de puntada — Costura PLASTICO',
            specification: '5 puntadas en 25 mm +/- 1 mm',
            evaluationTechnique: 'Visual / Regla',
            frequency: 'Primera pieza + muestreo continuo',
            controlMethod: 'Conteo de puntadas en 25mm con regla',
            reactionAction: DEFAULT_REACTION_PLAN,
            reactionContact: 'Inspector de calidad',
            specialCharSymbol: 'SC',
            registro: 'Registro de Control (RC)',
        },
        {
            id: uuid(),
            characteristic: 'Longitud de puntada — Costura UNION',
            specification: '4 puntadas en 16 mm +/- 1 mm',
            evaluationTechnique: 'Visual / Regla',
            frequency: 'Primera pieza + muestreo continuo',
            controlMethod: 'Conteo de puntadas en 16mm con regla',
            reactionAction: DEFAULT_REACTION_PLAN,
            reactionContact: 'Inspector de calidad',
            specialCharSymbol: 'SC',
            registro: 'Registro de Control (RC)',
        },
        {
            id: uuid(),
            characteristic: 'Longitud de puntada — Costura VISTA',
            specification: '4 puntadas en 16 mm +/- 1 mm',
            evaluationTechnique: 'Visual / Regla',
            frequency: 'Primera pieza + muestreo continuo',
            controlMethod: 'Conteo de puntadas en 16mm con regla',
            reactionAction: DEFAULT_REACTION_PLAN,
            reactionContact: 'Inspector de calidad',
            specialCharSymbol: 'SC',
            registro: 'Registro de Control (RC)',
        },
        {
            id: uuid(),
            characteristic: 'Margen de costura de vistas',
            specification: '4 mm +/- 1 mm',
            evaluationTechnique: 'Visual / Regla',
            frequency: 'Primera pieza + muestreo continuo',
            controlMethod: 'Medicion con regla sobre costura vista',
            reactionAction: DEFAULT_REACTION_PLAN,
            reactionContact: 'Inspector de calidad',
            specialCharSymbol: 'SC',
            registro: 'Registro de Control (RC)',
        },
        {
            id: uuid(),
            characteristic: 'Refilado',
            specification: '5 mm +/- 1 mm',
            evaluationTechnique: 'Visual / Regla',
            frequency: 'Primera pieza + muestreo continuo',
            controlMethod: 'Medicion del margen de refilado con regla',
            reactionAction: DEFAULT_REACTION_PLAN,
            reactionContact: 'Inspector de calidad',
            specialCharSymbol: '',
            registro: 'Registro de Control (RC)',
        },
        {
            id: uuid(),
            characteristic: 'Aspecto de costura: puntada salteada, manchas, roturas, hilo corrido',
            specification: 'Sin defectos visibles',
            evaluationTechnique: 'Visual',
            frequency: '100% cada pieza',
            controlMethod: 'Inspeccion visual 100% cara A y B',
            reactionAction: DEFAULT_REACTION_PLAN,
            reactionContact: 'Inspector de calidad',
            specialCharSymbol: '',
            registro: 'Registro de Control (RC)',
        },
        {
            id: uuid(),
            characteristic: 'Proyeccion de hilo por cara A',
            specification: 'No permitido por cara A. Admisible por cara B (extremos funda)',
            evaluationTechnique: 'Visual',
            frequency: '100% cada pieza',
            controlMethod: 'Inspeccion visual cara A — rechazo si hay proyeccion',
            reactionAction: DEFAULT_REACTION_PLAN,
            reactionContact: 'Inspector de calidad',
            specialCharSymbol: 'SC',
            registro: 'Registro de Control (RC)',
        },
        {
            id: uuid(),
            characteristic: 'Pinzas, arrugas, costuras expuestas, costura floja',
            specification: 'Sin defectos — costura firme y limpia',
            evaluationTechnique: 'Visual',
            frequency: '100% cada pieza',
            controlMethod: 'Inspeccion visual y tactil de la funda cosida',
            reactionAction: DEFAULT_REACTION_PLAN,
            reactionContact: 'Inspector de calidad',
            specialCharSymbol: '',
            registro: 'Registro de Control (RC)',
        },
        {
            id: uuid(),
            characteristic: 'Primera pieza OK — todos los items validados',
            specification: 'Cumple con todos los parametros del SET UP',
            evaluationTechnique: 'Visual / Inspector de calidad',
            frequency: 'Inicio de turno / Cambio version / Cambio de bobina / Post-mantenimiento',
            controlMethod: 'Liberacion firmada por Inspector de calidad',
            reactionAction: DEFAULT_REACTION_PLAN,
            reactionContact: 'Inspector de calidad',
            specialCharSymbol: '',
            registro: 'Planilla 1a pieza OK',
        },
    ];
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('================================================================');
    console.log('  SEED: Headrest HO Enrichment from SET UP PDFs');
    console.log('================================================================\n');

    await initSupabase();

    for (const hoId of MASTER_HO_IDS) {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`  Processing HO: ${hoId}`);
        console.log(`${'─'.repeat(60)}`);

        // Fetch current document
        const rows = await selectSql(
            `SELECT id, data, part_description, linked_amfe_project FROM ho_documents WHERE id = '${hoId}'`
        );
        if (rows.length === 0) {
            console.log(`  ERROR: HO document not found: ${hoId}`);
            continue;
        }

        const row = rows[0];
        const doc = JSON.parse(row.data);
        console.log(`  Part: ${row.part_description}`);
        console.log(`  Project: ${row.linked_amfe_project}`);
        console.log(`  Sheets: ${doc.sheets?.length}`);

        let enrichedCount = 0;

        for (const sheet of doc.sheets) {
            const opName = (sheet.operationName || '').toLowerCase();
            const opNum = sheet.operationNumber;

            // ─── Match Op 20: Corte ────────────────────────────────────────
            if (opNum === '20' && opName.includes('corte')) {
                console.log(`\n    Enriching Op ${opNum}: ${sheet.operationName}`);

                // Replace stub steps with real setup steps
                sheet.steps = buildCorteSteps();
                sheet.qualityChecks = buildCorteQualityChecks();

                // Update sector and safety elements
                sheet.sector = 'Mesa de Corte';
                sheet.safetyElements = ['anteojos', 'guantes', 'zapatos', 'proteccionAuditiva'];
                sheet.status = 'borrador';

                console.log(`      Steps: ${sheet.steps.length}`);
                console.log(`      Quality Checks: ${sheet.qualityChecks.length}`);
                enrichedCount++;
            }

            // ─── Match Op 30: Costura Union ────────────────────────────────
            if (opNum === '30' && opName.includes('costura')) {
                console.log(`\n    Enriching Op ${opNum}: ${sheet.operationName}`);

                // Replace stub steps with real setup steps
                sheet.steps = buildCosturaSteps();
                sheet.qualityChecks = buildCosturaQualityChecks();

                // Update sector and safety elements
                sheet.sector = 'Costura Apoyacabezas';
                sheet.safetyElements = ['anteojos', 'guantes', 'zapatos'];
                sheet.status = 'borrador';

                console.log(`      Steps: ${sheet.steps.length}`);
                console.log(`      Quality Checks: ${sheet.qualityChecks.length}`);
                enrichedCount++;
            }
        }

        if (enrichedCount === 0) {
            console.log('  No matching operations found to enrich.');
            continue;
        }

        // Save updated document
        const updatedJson = JSON.stringify(doc);
        const updatedChecksum = sha256(updatedJson);

        await execSql(
            `UPDATE ho_documents SET data = ?, checksum = ?, sheet_count = ?, updated_at = datetime('now') WHERE id = ?`,
            [updatedJson, updatedChecksum, doc.sheets.length, hoId]
        );
        console.log(`\n    SAVED: ${enrichedCount} sheets enriched, checksum=${updatedChecksum.slice(0, 12)}...`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Now propagate to variant HOs (L1/L2/L3)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n\n================================================================');
    console.log('  Propagating enrichment to variant HO documents...');
    console.log('================================================================\n');

    const VARIANT_PROJECTS = [
        { masterProject: 'VWA/PATAGONIA/HEADREST_FRONT',    pattern: 'VWA/PATAGONIA/HEADREST_FRONT [L%]' },
        { masterProject: 'VWA/PATAGONIA/HEADREST_REAR_CEN', pattern: 'VWA/PATAGONIA/HEADREST_REAR_CEN [L%]' },
        { masterProject: 'VWA/PATAGONIA/HEADREST_REAR_OUT', pattern: 'VWA/PATAGONIA/HEADREST_REAR_OUT [L%]' },
    ];

    for (const vp of VARIANT_PROJECTS) {
        // Get master document
        const masterRows = await selectSql(
            `SELECT data FROM ho_documents WHERE linked_amfe_project = '${vp.masterProject}' AND linked_amfe_project NOT LIKE '%[%'`
        );
        if (masterRows.length === 0) {
            console.log(`  Master not found for ${vp.masterProject}`);
            continue;
        }

        const masterDoc = JSON.parse(masterRows[0].data);

        // Find the enriched sheets from master
        const masterCorteSheet = masterDoc.sheets.find(s => s.operationNumber === '20');
        const masterCosturaSheet = masterDoc.sheets.find(s => s.operationNumber === '30');

        // Get variant documents
        const variantRows = await selectSql(
            `SELECT id, data, linked_amfe_project FROM ho_documents WHERE linked_amfe_project LIKE '${vp.pattern}'`
        );

        console.log(`  Master: ${vp.masterProject} → ${variantRows.length} variants`);

        for (const vr of variantRows) {
            const varDoc = JSON.parse(vr.data);
            let varEnriched = 0;

            for (const sheet of varDoc.sheets) {
                // Enrich Op 20 in variant from master
                if (sheet.operationNumber === '20' && masterCorteSheet) {
                    // Replace steps and QCs with new UUIDs (clone from master pattern)
                    sheet.steps = buildCorteSteps(); // fresh UUIDs
                    sheet.qualityChecks = buildCorteQualityChecks();
                    sheet.sector = masterCorteSheet.sector;
                    sheet.safetyElements = [...masterCorteSheet.safetyElements];
                    sheet.status = 'borrador';
                    varEnriched++;
                }

                // Enrich Op 30 in variant from master
                if (sheet.operationNumber === '30' && masterCosturaSheet) {
                    sheet.steps = buildCosturaSteps();
                    sheet.qualityChecks = buildCosturaQualityChecks();
                    sheet.sector = masterCosturaSheet.sector;
                    sheet.safetyElements = [...masterCosturaSheet.safetyElements];
                    sheet.status = 'borrador';
                    varEnriched++;
                }
            }

            if (varEnriched > 0) {
                const varJson = JSON.stringify(varDoc);
                const varChecksum = sha256(varJson);
                await execSql(
                    `UPDATE ho_documents SET data = ?, checksum = ?, sheet_count = ?, updated_at = datetime('now') WHERE id = ?`,
                    [varJson, varChecksum, varDoc.sheets.length, vr.id]
                );
                console.log(`    ${vr.linked_amfe_project}: ${varEnriched} sheets enriched`);
            }
        }
    }

    console.log('\n================================================================');
    console.log('  DONE — Headrest HO enrichment complete');
    console.log('================================================================\n');

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
