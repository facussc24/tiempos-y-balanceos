#!/usr/bin/env node
/**
 * SEED: PATAGONIA HEADREST (VWA) — 3 positions x (L0 + L1/L2/L3)
 *
 * Creates all APQP documents for 3 headrest families:
 *   1. Headrest Front (Passenger/Driver)
 *   2. Headrest Rear Center
 *   3. Headrest Rear Outer
 *
 * For each position:
 *   - L0 Control Plan (parsed from PDF extract)
 *   - L0 AMFE stub (reverse-engineered from CP operations)
 *   - L0 HO stubs (one sheet per operation)
 *   - Product family
 *   - L1/L2/L3 variant CPs (parsed from PDF extract)
 *   - L1/L2/L3 variant AMFEs and HOs (cloned from L0 master)
 *   - Family document links (master + variants)
 *
 * Usage: node scripts/seed-headrest.mjs
 */

import { createHash, randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';

// ─── Helpers ────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const uuid = () => randomUUID();
const sha256 = (str) => createHash('sha256').update(str).digest('hex');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function regenerateUuids(obj) {
    const idMap = new Map();
    function walk(value, key) {
        if (value === null || value === undefined) return value;
        if (Array.isArray(value)) return value.map(item => walk(item));
        if (typeof value === 'object') {
            const out = {};
            for (const [k, v] of Object.entries(value)) {
                out[k] = walk(v, k);
            }
            return out;
        }
        if (typeof value === 'string' && key === 'id' && UUID_REGEX.test(value)) {
            if (!idMap.has(value)) idMap.set(value, randomUUID());
            return idMap.get(value);
        }
        return value;
    }
    const result = walk(obj);
    return { result, idMap };
}

function inferOpCategory(name) {
    const n = (name || '').toLowerCase();
    if (/recep/i.test(n)) return 'recepcion';
    if (/corte/i.test(n)) return 'corte';
    if (/costur/i.test(n)) return 'costura';
    if (/virol|refil/i.test(n)) return 'refilado';
    if (/ensam/i.test(n)) return 'ensamble';
    if (/espum/i.test(n)) return 'espumado';
    if (/inspec/i.test(n)) return 'inspeccion';
    if (/embala/i.test(n) || /empaque/i.test(n)) return 'embalaje';
    if (/test|lay.*out/i.test(n)) return 'test';
    return '';
}

const DEFAULT_REACTION_PLAN =
    'SI DETECTA "PRODUCTO" O "PROCESO" NO CONFORME:\n' +
    'DETENGA LA OPERACION\n' +
    'NOTIFIQUE DE INMEDIATO A SU LIDER O SUPERVISOR\n' +
    'ESPERE LA DEFINICION DEL LIDER O SUPERVISOR';

// ─── Statistics helpers ─────────────────────────────────────────────────────

function countCauses(operations) {
    let total = 0, apH = 0, apM = 0, apL = 0;
    for (const op of operations)
        for (const we of (op.workElements || []))
            for (const fn of (we.functions || []))
                for (const fail of (fn.failures || []))
                    for (const c of (fail.causes || [])) {
                        total++;
                        if (c.ap === 'H') apH++;
                        else if (c.ap === 'M') apM++;
                        else apL++;
                    }
    return { total, apH, apM, apL };
}

function calcCoverage(operations) {
    let total = 0, covered = 0;
    for (const op of operations)
        for (const we of (op.workElements || []))
            for (const fn of (we.functions || []))
                for (const fail of (fn.failures || []))
                    for (const c of (fail.causes || [])) {
                        total++;
                        if ((c.preventionControl && c.preventionControl !== '-' && c.preventionControl !== 'N/A') ||
                            (c.detectionControl && c.detectionControl !== '-' && c.detectionControl !== 'N/A'))
                            covered++;
                    }
    return total > 0 ? Math.round((covered / total) * 10000) / 100 : 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// POSITION CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════

const POSITIONS = [
    {
        key: 'FRONT',
        projectSuffix: 'HEADREST_FRONT',
        familyName: 'Headrest Front Patagonia',
        familyDesc: 'Cabezal delantero (Passenger / Driver) para plataforma Patagonia VW',
        l0PartNumber: 'XXX.881.900',
        l0Description: 'PATAGONIA - FRONT HEADREST, Passenger / Driver, LO (pvc)',
        l0File: 'PATAGONIA_FRONT_HEADREST_L0_PdC preliminar.txt',
        variantPartNumbers: 'XXX.881.900X / XXX.881.900Y / XXX.881.900Z',
        variantDescription: 'PATAGONIA - FRONT HEADREST, Passenger / Driver, L1/L2/L3',
        variantFile: 'PATAGONIA_FRONT_HEADREST_L1-L2-L3_PdC preliminar.txt',
        foamWeight: '289 +/- 2 gr',
        foamPartNumber: 'XXX.881.931',
        frameCode: 'C00686689 Seat headrest frame',
        hasInsertInAssembly: true, // Front has "Inserto en Funda" in Op 40
        densitySpec: '>= 65 km/m3',
    },
    {
        key: 'REAR_CEN',
        projectSuffix: 'HEADREST_REAR_CEN',
        familyName: 'Headrest Rear Center Patagonia',
        familyDesc: 'Cabezal trasero central para plataforma Patagonia VW',
        l0PartNumber: 'XXX.885.900',
        l0Description: 'PATAGONIA - REAR HEADREST, CENTER, L0 (pvc)',
        l0File: 'PATAGONIA_REAR CEN_HEADREST_L0_PdC preliminar.txt',
        variantPartNumbers: 'XXX.885.900X / XXX.885.900Y / XXX.885.900Z',
        variantDescription: 'PATAGONIA - REAR HEADREST, CENTER, L1/L2/L3',
        variantFile: 'PATAGONIA_REAR CENT_HEADREST_L1-L2-L3_PdC preliminar.txt',
        foamWeight: '289 +/- 2 gr',
        foamPartNumber: 'XXX.855.932',
        frameCode: 'C00683052 FRAME ASM-RR MID HEADREST',
        hasInsertInAssembly: false, // Rear Center: Asta + Enfundado (no Insert)
        densitySpec: '>= 55 km/m3',
    },
    {
        key: 'REAR_OUT',
        projectSuffix: 'HEADREST_REAR_OUT',
        familyName: 'Headrest Rear Outer Patagonia',
        familyDesc: 'Cabezal trasero exterior para plataforma Patagonia VW',
        l0PartNumber: 'XXX.885.901',
        l0Description: 'PATAGONIA - REAR HEADREST, OUTER, LO (pvc)',
        l0File: 'PATAGONIA_REAR OUT_HEADREST_L0_PdC preliminar.txt',
        variantPartNumbers: 'XXX.885.901X / XXX.885.901Y / XXX.885.900Z',
        variantDescription: 'PATAGONIA - REAR HEADREST, OUTER, L1/L2/L3',
        variantFile: 'PATAGONIA_REAR OUT_HEADREST_L1-L2-L3_PdC preliminar.txt',
        foamWeight: '289 +/- 2 gr',
        foamPartNumber: 'XXX.855.931',
        frameCode: 'C00683050 FRANE ASM-RR SI HEADREST',
        hasInsertInAssembly: true, // Rear Outer has "Inserto en Funda" in Op 40
        densitySpec: '>= 55 km/m3',
    },
];

// ═══════════════════════════════════════════════════════════════════════════
// BUILD CP ITEMS FROM STRUCTURED DATA (common structure across all positions)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build L0 Control Plan items for a headrest position.
 * All 3 positions share a near-identical process flow: Op 10 -> 20 -> 30 -> Virolado -> 40 -> 50 -> 60 -> 70 -> 80.
 * The PDF data is noisy text extraction; we hand-build structured items from the parsed data.
 */
function buildL0CpItems(pos) {
    const items = [];

    // ── Op 10: Recepcion ──────────────────────────────────────────────────
    // Component 1: Frame (consigned VWA)
    items.push({
        id: uuid(), processStepNumber: '10', processDescription: 'Recepcion',
        machineDeviceTool: '', characteristicNumber: '1',
        productCharacteristic: 'Tipo de Producto', processCharacteristic: '',
        specialCharClass: '', specification: 'TBD',
        evaluationTechnique: 'Visual identificacion en pieza', sampleSize: '1 muestra', sampleFrequency: 'Por entrega',
        controlMethod: 'P-10/I. Recepcion de materiales. P-14.', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-10/I, P-14',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'recepcion',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });
    items.push({
        id: uuid(), processStepNumber: '10', processDescription: 'Recepcion',
        machineDeviceTool: '', characteristicNumber: '1',
        productCharacteristic: 'Color', processCharacteristic: '',
        specialCharClass: '', specification: 'TBD',
        evaluationTechnique: 'Patron de Aspecto', sampleSize: '1 muestra', sampleFrequency: 'Por entrega',
        controlMethod: 'P-10/I. Recepcion de materiales. P-14.', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-10/I, P-14',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'recepcion',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });
    items.push({
        id: uuid(), processStepNumber: '10', processDescription: 'Recepcion',
        machineDeviceTool: '', characteristicNumber: '1',
        productCharacteristic: 'Dimensional de control', processCharacteristic: '',
        specialCharClass: '', specification: 'Segun informe de control del proveedor',
        evaluationTechnique: 'Certificado del proveedor', sampleSize: 'Segun acuerdo', sampleFrequency: 'Por entrega',
        controlMethod: 'P-10/I. Recepcion de materiales. P-14.', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-10/I, P-14',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'recepcion',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });
    items.push({
        id: uuid(), processStepNumber: '10', processDescription: 'Recepcion',
        machineDeviceTool: '', characteristicNumber: '1',
        productCharacteristic: 'Aspecto', processCharacteristic: '',
        specialCharClass: '', specification: 'Libre de rebaba, marcas de herramental, deformaciones, bordes afilados',
        evaluationTechnique: 'Patron de Aspecto', sampleSize: '1 muestra', sampleFrequency: 'Por entrega',
        controlMethod: 'P-10/I. Recepcion de materiales. P-14.', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-10/I, P-14',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'recepcion',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });

    // Component 2: Vinilo SANSUY
    items.push({
        id: uuid(), processStepNumber: '10', processDescription: 'Recepcion',
        machineDeviceTool: '', characteristicNumber: '2',
        productCharacteristic: 'Espesor', processCharacteristic: '',
        specialCharClass: '', specification: 'min 2,0 - max 2,5',
        evaluationTechnique: 'Medidor de espesor', sampleSize: '1 muestra', sampleFrequency: 'Por entrega',
        controlMethod: 'P-10/I. Recepcion de materiales. P-14.', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-10/I, P-14',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'recepcion',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });
    items.push({
        id: uuid(), processStepNumber: '10', processDescription: 'Recepcion',
        machineDeviceTool: '', characteristicNumber: '2',
        productCharacteristic: 'Control de VINILO - Flamabilidad', processCharacteristic: '',
        specialCharClass: 'SC', specification: '<100 mm/min',
        evaluationTechnique: 'Certificado del proveedor', sampleSize: '1 muestra', sampleFrequency: 'Por entrega',
        controlMethod: 'P-10/I. Recepcion de materiales. P-14.', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-10/I, P-14',
        autoFilledFields: [], amfeAp: 'H', amfeSeverity: 9, operationCategory: 'recepcion',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });
    items.push({
        id: uuid(), processStepNumber: '10', processDescription: 'Recepcion',
        machineDeviceTool: '', characteristicNumber: '2',
        productCharacteristic: 'Control de VINILO - Color', processCharacteristic: '',
        specialCharClass: '', specification: 'Segun patron',
        evaluationTechnique: 'Patron de Aspecto', sampleSize: '1 muestra', sampleFrequency: 'Por entrega',
        controlMethod: 'P-10/I. Recepcion de materiales. P-14.', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-10/I, P-14',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'recepcion',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });
    items.push({
        id: uuid(), processStepNumber: '10', processDescription: 'Recepcion',
        machineDeviceTool: '', characteristicNumber: '2',
        productCharacteristic: 'Gramaje', processCharacteristic: '',
        specialCharClass: '', specification: 'min. 800 - max. 1000 GMS/MT2',
        evaluationTechnique: 'Balanza', sampleSize: '1 muestra', sampleFrequency: 'Por entrega',
        controlMethod: 'P-10/I. Recepcion de materiales. P-14.', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-10/I, P-14',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'recepcion',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });

    // Component 3: Espuma
    items.push({
        id: uuid(), processStepNumber: '10', processDescription: 'Recepcion',
        machineDeviceTool: '', characteristicNumber: '3',
        productCharacteristic: 'Densidad', processCharacteristic: '',
        specialCharClass: '', specification: pos.densitySpec,
        evaluationTechnique: 'Medidor de espesor', sampleSize: '1 muestra', sampleFrequency: 'Por entrega',
        controlMethod: 'P-10/I. Recepcion de materiales. P-14.', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-10/I, P-14',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'recepcion',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });
    items.push({
        id: uuid(), processStepNumber: '10', processDescription: 'Recepcion',
        machineDeviceTool: '', characteristicNumber: '3',
        productCharacteristic: 'Control del Vinilo - Flamabilidad', processCharacteristic: '',
        specialCharClass: 'SC', specification: '<100 mm/min',
        evaluationTechnique: 'Certificado del proveedor', sampleSize: '1 muestra', sampleFrequency: 'Por entrega',
        controlMethod: 'P-10/I. Recepcion de materiales. P-14.', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-10/I, P-14',
        autoFilledFields: [], amfeAp: 'H', amfeSeverity: 9, operationCategory: 'recepcion',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });
    items.push({
        id: uuid(), processStepNumber: '10', processDescription: 'Recepcion',
        machineDeviceTool: '', characteristicNumber: '3',
        productCharacteristic: 'Control Color', processCharacteristic: '',
        specialCharClass: '', specification: 'Segun patron',
        evaluationTechnique: 'Patron de aspecto', sampleSize: '1 muestra', sampleFrequency: 'Por entrega',
        controlMethod: 'P-10/I. Recepcion de materiales. P-14.', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-10/I, P-14',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'recepcion',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });
    items.push({
        id: uuid(), processStepNumber: '10', processDescription: 'Recepcion',
        machineDeviceTool: '', characteristicNumber: '3',
        productCharacteristic: 'Peso', processCharacteristic: '',
        specialCharClass: '', specification: pos.key === 'REAR_OUT' ? '102 g' : (pos.key === 'REAR_CEN' ? '62 gramos' : '289'),
        evaluationTechnique: 'Balanza', sampleSize: '1 muestra', sampleFrequency: 'Por entrega',
        controlMethod: 'P-10/I. Recepcion de materiales. P-14.', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-10/I, P-14',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'recepcion',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });

    // Component 4 (Front) or 4 (Rear): Hilo Union
    const hiloCharNum = pos.key === 'FRONT' ? '5' : '4';
    for (const prop of [
        { char: 'Color', spec: 'Titanschwarz', tech: 'Patron de Aspecto' },
        { char: 'Cantidad de cabos', spec: '30/3', tech: 'Visual manual' },
        { char: 'Articulo', spec: '30/3', tech: 'Etiqueta de producto' },
    ]) {
        items.push({
            id: uuid(), processStepNumber: '10', processDescription: 'Recepcion',
            machineDeviceTool: '', characteristicNumber: hiloCharNum,
            productCharacteristic: prop.char, processCharacteristic: '',
            specialCharClass: '', specification: prop.spec,
            evaluationTechnique: prop.tech, sampleSize: '1 muestra', sampleFrequency: 'Por entrega',
            controlMethod: 'P-10/I. Recepcion de materiales. P-14.', reactionPlan: 'Segun P-09/I.',
            reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-10/I, P-14',
            autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'recepcion',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        });
    }

    // ── Op 20: Corte de Vinilo ────────────────────────────────────────────
    items.push({
        id: uuid(), processStepNumber: '20', processDescription: 'Corte de Vinilo SANSUY PVC (TITAN Black)',
        machineDeviceTool: 'Mesa de corte automatica. BM 149', characteristicNumber: '1',
        productCharacteristic: '', processCharacteristic: 'Set up de Maquina (segun programa)',
        specialCharClass: '', specification: 'Ver hoja de set-up',
        evaluationTechnique: 'Hoja de set-up', sampleSize: '1 Control', sampleFrequency: 'Inicio de turno y despues de cada intervencion mecanica',
        controlMethod: 'Control visual. Set up', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-09/I',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'corte',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });
    items.push({
        id: uuid(), processStepNumber: '20', processDescription: 'Corte de Vinilo SANSUY PVC (TITAN Black)',
        machineDeviceTool: 'Mesa de corte automatica. BM 149', characteristicNumber: '2',
        productCharacteristic: '', processCharacteristic: 'Cantidad de Capas',
        specialCharClass: '', specification: 'TBD',
        evaluationTechnique: 'Control visual', sampleSize: '1 Control', sampleFrequency: 'Inicio de turno',
        controlMethod: 'Registro de Set-up', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-09/I',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'corte',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });
    items.push({
        id: uuid(), processStepNumber: '20', processDescription: 'Corte de Vinilo SANSUY PVC (TITAN Black)',
        machineDeviceTool: 'Mesa de corte automatica. BM 149', characteristicNumber: '3',
        productCharacteristic: '', processCharacteristic: 'Set up de proceso',
        specialCharClass: '', specification: 'Medir cuchilla en el ancho: debe medir 4mm',
        evaluationTechnique: 'Calibre digital', sampleSize: '1 Control', sampleFrequency: 'Inicio de turno',
        controlMethod: 'Registro de Set-up', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-09/I',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'corte',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });
    items.push({
        id: uuid(), processStepNumber: '20', processDescription: 'Corte de Vinilo SANSUY PVC (TITAN Black)',
        machineDeviceTool: 'Mesa de corte automatica. BM 149', characteristicNumber: '4',
        productCharacteristic: 'Dimensional de Corte', processCharacteristic: '',
        specialCharClass: '', specification: 'Segun Myler',
        evaluationTechnique: 'Myler de control', sampleSize: '1 Pieza', sampleFrequency: 'Inicio de turno',
        controlMethod: 'Registro de Set-up', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-09/I',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'corte',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });

    // ── Op 30: Costura Union ──────────────────────────────────────────────
    items.push({
        id: uuid(), processStepNumber: '30', processDescription: 'Operacion Costura Union',
        machineDeviceTool: 'Maquina de coser', characteristicNumber: '1',
        productCharacteristic: '', processCharacteristic: 'Set up de Maquina',
        specialCharClass: '', specification: 'Ver Hoja de set-up',
        evaluationTechnique: 'Hoja de set-up', sampleSize: '1 Control', sampleFrequency: 'Inicio de turno y despues de cada intervencion mecanica',
        controlMethod: 'Control visual. Set up', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-09/I',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'costura',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });

    // Costura appearance checks
    const costuraChecks = [
        { num: '2', char: 'Aguja Correcta', spec: 'Aguja Correcta', tech: 'Visual' },
        { num: '3', char: 'Apariencia - Sin costura salteada', spec: 'Sin costura salteada', tech: 'Visual / Muestra patron' },
        { num: '4', char: 'Apariencia - Sin costura floja / Sin costura deficiente', spec: 'Sin costura floja / Sin costura deficiente', tech: 'Visual / Muestra patron' },
        { num: '5', char: 'Apariencia - Sin arrugas / Sin pliegues', spec: 'Sin arrugas / Sin pliegues', tech: 'Visual / Muestra patron' },
        { num: '6', char: 'Apariencia - Sin falta de costura', spec: 'Sin falta de costura', tech: 'Visual / Muestra patron' },
        { num: '7', char: 'ASPECTO Costura con Hilo', spec: 'largo puntada: 4 mm en 16 mm +/- 1', tech: 'Control visual / Muestra patron' },
    ];
    for (const chk of costuraChecks) {
        items.push({
            id: uuid(), processStepNumber: '30', processDescription: 'Operacion Costura Union',
            machineDeviceTool: 'Maquina de coser', characteristicNumber: chk.num,
            productCharacteristic: chk.char, processCharacteristic: '',
            specialCharClass: '', specification: chk.spec,
            evaluationTechnique: chk.tech, sampleSize: '1 pieza', sampleFrequency: 'Inicio y fin de turno / 100% Por lote',
            controlMethod: 'Registro de control / Autocontrol', reactionPlan: 'Segun P-09/I.',
            reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-09/I',
            autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'costura',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        });
    }

    // Virolado + Refilado
    const viroladoChecks = [
        { num: '8', char: 'Virolado de todo el contorno de la pieza', tech: 'Control visual / Muestra patron' },
        { num: '9', char: 'Pegado correcto de todos los pliegues', tech: 'Control visual / Muestra patron' },
        { num: '10', char: 'Zonas criticas definidas en ayudas visuales despejadas de material excedente', tech: 'Control visual / Muestra patron' },
        { num: '11', char: 'Zonas criticas si exceso de quemado que genere deformaciones en plastico', tech: 'Control visual / Muestra patron' },
        { num: '12', char: 'Sin zonas quemadas de vinilo en cara vista', tech: 'Control visual / Muestra patron' },
    ];
    for (const chk of viroladoChecks) {
        items.push({
            id: uuid(), processStepNumber: '30', processDescription: 'Virolado + Refilado de piezas',
            machineDeviceTool: '', characteristicNumber: chk.num,
            productCharacteristic: chk.char, processCharacteristic: '',
            specialCharClass: '', specification: chk.char,
            evaluationTechnique: chk.tech, sampleSize: '100%', sampleFrequency: 'Por lote',
            controlMethod: 'Autocontrol', reactionPlan: 'Segun P-09/I.',
            reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-09/I',
            autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'refilado',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        });
    }

    // ── Op 40: Ensamble ───────────────────────────────────────────────────
    const op40Name = pos.hasInsertInAssembly ? 'Ensamble Asta + Insert + Enfundado' : 'Ensamble Asta + Enfundado';
    if (pos.hasInsertInAssembly) {
        items.push({
            id: uuid(), processStepNumber: '40', processDescription: op40Name,
            machineDeviceTool: '', characteristicNumber: '1',
            productCharacteristic: 'Correcta colocacion de Inserto en Funda', processCharacteristic: '',
            specialCharClass: '', specification: 'Correcta colocacion',
            evaluationTechnique: 'Control visual / Muestra patron', sampleSize: '100%', sampleFrequency: 'Por lote',
            controlMethod: 'Autocontrol', reactionPlan: 'Segun P-09/I.',
            reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-09/I',
            autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'ensamble',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        });
    }
    items.push({
        id: uuid(), processStepNumber: '40', processDescription: op40Name,
        machineDeviceTool: '', characteristicNumber: pos.hasInsertInAssembly ? '2' : '1',
        productCharacteristic: 'Correcta colocacion de Asta en Funda', processCharacteristic: '',
        specialCharClass: '', specification: 'Correcta colocacion',
        evaluationTechnique: 'Control visual / Muestra patron', sampleSize: '100%', sampleFrequency: 'Por lote',
        controlMethod: 'Autocontrol', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-09/I',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'ensamble',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });
    if (pos.hasInsertInAssembly) {
        items.push({
            id: uuid(), processStepNumber: '40', processDescription: op40Name,
            machineDeviceTool: '', characteristicNumber: '3',
            productCharacteristic: 'Correcta clipar Asta con Inserto en interior de Funda', processCharacteristic: '',
            specialCharClass: '', specification: 'Correcta clipar',
            evaluationTechnique: 'Control visual / Muestra patron', sampleSize: '100%', sampleFrequency: 'Por lote',
            controlMethod: 'Autocontrol', reactionPlan: 'Segun P-09/I.',
            reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-09/I',
            autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'ensamble',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        });
    }
    items.push({
        id: uuid(), processStepNumber: '40', processDescription: op40Name,
        machineDeviceTool: '', characteristicNumber: pos.hasInsertInAssembly ? '4' : '2',
        productCharacteristic: 'Apariencia', processCharacteristic: '',
        specialCharClass: '', specification: 'Sin despegues, cortes, terminacion ok, sin manchas ni marcas',
        evaluationTechnique: 'Visual', sampleSize: '100%', sampleFrequency: 'Por lote',
        controlMethod: 'Autocontrol', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-09/I',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'ensamble',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });

    // ── Op 50: Espumado ───────────────────────────────────────────────────
    items.push({
        id: uuid(), processStepNumber: '50', processDescription: 'Espumado (llenado de molde con mezcla)',
        machineDeviceTool: 'Inyeccion de PU', characteristicNumber: '1',
        productCharacteristic: 'Apariencia', processCharacteristic: '',
        specialCharClass: '', specification: 'Sin marcas, sin rebabas',
        evaluationTechnique: 'Control visual', sampleSize: '100%', sampleFrequency: 'Por lote',
        controlMethod: 'Autocontrol', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-09/I',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'espumado',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });
    items.push({
        id: uuid(), processStepNumber: '50', processDescription: 'Espumado (llenado de molde con mezcla)',
        machineDeviceTool: 'Inyeccion de PU', characteristicNumber: '2',
        productCharacteristic: 'Performance', processCharacteristic: '',
        specialCharClass: '', specification: 'Libre de Rebabas, Libre de atrapes/roturas, Correcto tiempo de curado (180 seg. minimo)',
        evaluationTechnique: 'Segun hoja de operaciones', sampleSize: '100%', sampleFrequency: 'Por lote',
        controlMethod: 'Autocontrol', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-09/I',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'espumado',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });
    items.push({
        id: uuid(), processStepNumber: '50', processDescription: 'Espumado (llenado de molde con mezcla)',
        machineDeviceTool: 'Inyeccion de PU', characteristicNumber: '2',
        productCharacteristic: 'Peso de la pieza', processCharacteristic: '',
        specialCharClass: '', specification: pos.foamWeight,
        evaluationTechnique: 'Balanza analitica', sampleSize: '1 Pieza', sampleFrequency: 'Inicio turno',
        controlMethod: 'Autocontrol', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-09/I',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'espumado',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });

    // Espumado: Process parameters
    const espumadoParams = [
        'Temperatura del molde', 'Tiempo de colada', 'Caudal total', 'Relacion Poliol/Iso',
        'Presion Poliol', 'Presion Iso', 'Tiempo de crema',
        'Posicionar cabezal sobre cada molde (Poka Yoke)',
        'Temperatura de POLIOL e ISO',
    ];
    for (const param of espumadoParams) {
        items.push({
            id: uuid(), processStepNumber: '50', processDescription: 'Espumado (llenado de molde con mezcla)',
            machineDeviceTool: 'Inyeccion de PU', characteristicNumber: '3',
            productCharacteristic: '', processCharacteristic: param,
            specialCharClass: '', specification: 'TBD',
            evaluationTechnique: 'Control visual display controlador', sampleSize: '1 control', sampleFrequency: 'Inicio de turno',
            controlMethod: param.includes('crema') || param.includes('Poka') || param.includes('Temperatura de POLIOL') ? 'Hoja de parametro de molde' : 'Hoja de set-up',
            reactionPlan: 'Segun P-09/I.',
            reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-09/I',
            autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'espumado',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        });
    }

    // ── Op 60: Inspeccion final + Sistema ARB ─────────────────────────────
    items.push({
        id: uuid(), processStepNumber: '60', processDescription: 'Inspeccion final + Sistema ARB',
        machineDeviceTool: 'Calibre de control', characteristicNumber: '1',
        productCharacteristic: 'Apariencia - Control dimensional de piezas terminadas', processCharacteristic: '',
        specialCharClass: '', specification: 'Control dimensional de piezas terminadas',
        evaluationTechnique: 'Calibre de control', sampleSize: '5 piezas por lote de inyeccion de sustrato plastico', sampleFrequency: 'Por lote',
        controlMethod: 'Segun Instructivo medicion de calibre', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Metrologia', controlProcedure: 'P-09/I',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'inspeccion',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });
    items.push({
        id: uuid(), processStepNumber: '60', processDescription: 'Inspeccion final + Sistema ARB',
        machineDeviceTool: '', characteristicNumber: '2',
        productCharacteristic: 'Aspecto', processCharacteristic: '',
        specialCharClass: '', specification: 'Sin despegues, cortes, terminacion ok, sin manchas ni marcas ni abertura',
        evaluationTechnique: 'Visual', sampleSize: '100%', sampleFrequency: 'Por lote',
        controlMethod: 'Autocontrol', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion / Calidad', controlProcedure: 'P-09/I',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'inspeccion',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });
    items.push({
        id: uuid(), processStepNumber: '60', processDescription: 'Inspeccion final + Sistema ARB',
        machineDeviceTool: '', characteristicNumber: '3',
        productCharacteristic: 'Carga en el sistema ARB', processCharacteristic: '',
        specialCharClass: '', specification: 'Cantidad Ok / Cantidad NOK',
        evaluationTechnique: 'Visual', sampleSize: '100%', sampleFrequency: 'Por lote',
        controlMethod: 'Autocontrol', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de Calidad', controlProcedure: 'P-09/I',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'inspeccion',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });

    // ── Op 70: Embalaje ───────────────────────────────────────────────────
    items.push({
        id: uuid(), processStepNumber: '70', processDescription: 'Embalaje',
        machineDeviceTool: 'Medio de embalaje', characteristicNumber: '1',
        productCharacteristic: 'Identificacion', processCharacteristic: '',
        specialCharClass: '', specification: 'Identificacion segun codigo de la pieza',
        evaluationTechnique: 'Visual', sampleSize: '100%', sampleFrequency: 'Por turno',
        controlMethod: 'Autocontrol', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de logistica', controlProcedure: 'P-09/I',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'embalaje',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });
    items.push({
        id: uuid(), processStepNumber: '70', processDescription: 'Embalaje',
        machineDeviceTool: 'Medio de embalaje', characteristicNumber: '2',
        productCharacteristic: 'Cantidad', processCharacteristic: '',
        specialCharClass: '', specification: 'Cantidad por medio = TBD piezas',
        evaluationTechnique: 'Visual', sampleSize: '100%', sampleFrequency: 'Por turno',
        controlMethod: 'Autocontrol', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de logistica', controlProcedure: 'P-09/I',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'embalaje',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });

    // ── Op 80: Test de Layout ─────────────────────────────────────────────
    items.push({
        id: uuid(), processStepNumber: '80', processDescription: 'TEST DE LAY OUT',
        machineDeviceTool: '', characteristicNumber: '1',
        productCharacteristic: 'Horizontal combustibility', processCharacteristic: '',
        specialCharClass: '', specification: '<= 100 mm',
        evaluationTechnique: 'Visual. Camara de Combustion', sampleSize: '1 muestra', sampleFrequency: 'Auditoria de Producto',
        controlMethod: 'Registro de Auditoria', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de calidad', controlProcedure: 'P-09/I',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'test',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });
    items.push({
        id: uuid(), processStepNumber: '80', processDescription: 'TEST DE LAY OUT',
        machineDeviceTool: '', characteristicNumber: '2',
        productCharacteristic: 'Control dimensional completo (idem PPAP proyecto)', processCharacteristic: '',
        specialCharClass: '', specification: 'Segun especificaciones acordadas con el cliente',
        evaluationTechnique: 'Medicion segun Calibre de Control', sampleSize: '30 muestras', sampleFrequency: 'Auditoria de Producto',
        controlMethod: 'Informe de medicion', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Metrologo', controlProcedure: 'P-09/I',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'test',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });

    return items;
}

/**
 * Build L1-L2-L3 CP items. Similar to L0 but with extra materials
 * (Hilo Vista variants, tela variants, Costura Vista operation).
 * Since the PDF covers all 3 levels with the same data, items are identical.
 */
function buildVariantCpItems(pos) {
    // Start with L0 items as base (same reception + process flow)
    const items = buildL0CpItems(pos);

    // Add Costura Vista operation (Op 30.2) - present only in L1/L2/L3
    const costuraVistaChecks = [
        { num: '2', char: 'Apariencia - Sin falta de costura', tech: 'Control visual / Muestra patron' },
        { num: '3', char: 'Sin costura floja / Sin costura deficiente', tech: 'Control visual / Muestra patron' },
        { num: '4', char: 'Sin costura salteada', tech: 'Control visual / Muestra patron' },
        { num: '5', char: 'Paralelismo entre costuras cara vista', tech: 'Control visual / Muestra patron' },
        { num: '6', char: 'Sin arrugas / Sin pliegues', tech: 'Control visual / Muestra patron' },
        { num: '7', char: 'Margen de costura', spec: 'TBD', tech: 'Regla' },
        { num: '8', char: 'Largo de puntada', spec: 'TBD', tech: 'Regla' },
        { num: '9', char: 'Aguja Correcta', spec: 'Aguja Correcta TBD', tech: 'Visual' },
    ];

    // Set up de Maquina for Costura Vista
    items.push({
        id: uuid(), processStepNumber: '30.2', processDescription: 'Operacion Costura Vista',
        machineDeviceTool: 'Maquina de coser. BM 114', characteristicNumber: '1',
        productCharacteristic: '', processCharacteristic: 'Set up de Maquina',
        specialCharClass: '', specification: 'Ver hoja de set-up',
        evaluationTechnique: 'Hoja de set-up', sampleSize: '1 control', sampleFrequency: 'Inicio de turno y despues de cada intervencion mecanica',
        controlMethod: 'Control visual. Set-up', reactionPlan: 'Segun P-09/I.',
        reactionPlanOwner: 'Operador de produccion', controlProcedure: 'P-09/I',
        autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'costura',
        amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
    });

    for (const chk of costuraVistaChecks) {
        items.push({
            id: uuid(), processStepNumber: '30.2', processDescription: 'Operacion Costura Vista',
            machineDeviceTool: 'Maquina de coser. BM 114', characteristicNumber: chk.num,
            productCharacteristic: chk.char, processCharacteristic: '',
            specialCharClass: '', specification: chk.spec || chk.char,
            evaluationTechnique: chk.tech, sampleSize: '1 Pieza', sampleFrequency: 'Inicio y fin de turno / 100% Por lote',
            controlMethod: 'Registro de control / Autocontrol', reactionPlan: 'Segun P-09/I.',
            reactionPlanOwner: 'Operador de produccion / Operador de calidad', controlProcedure: 'P-09/I',
            autoFilledFields: [], amfeAp: '', amfeSeverity: 0, operationCategory: 'costura',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        });
    }

    // Sort by operation number
    items.sort((a, b) => {
        const na = parseFloat(a.processStepNumber) || 0;
        const nb = parseFloat(b.processStepNumber) || 0;
        return na - nb;
    });

    return items;
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD AMFE STUB from CP operations
// ═══════════════════════════════════════════════════════════════════════════

function buildAmfeFromCp(cpItems, pos) {
    // Group CP items by processStepNumber
    const opMap = new Map();
    for (const item of cpItems) {
        const key = item.processStepNumber;
        if (!opMap.has(key)) {
            opMap.set(key, { opNumber: key, name: item.processDescription, items: [] });
        }
        opMap.get(key).items.push(item);
    }

    const operations = [];
    for (const [opNum, opData] of opMap) {
        const workElements = [];
        // Create a Machine work element with the characteristics as failures
        const failures = [];
        for (const cpItem of opData.items) {
            const charName = cpItem.productCharacteristic || cpItem.processCharacteristic || '';
            if (!charName) continue;

            const causes = [];
            if (cpItem.amfeAp === 'H' || cpItem.amfeAp === 'M') {
                causes.push({
                    id: uuid(),
                    cause: `Falla en control de: ${charName}`,
                    preventionControl: cpItem.controlMethod || '',
                    detectionControl: cpItem.evaluationTechnique || '',
                    occurrence: 5, detection: 5,
                    ap: cpItem.amfeAp,
                    characteristicNumber: cpItem.characteristicNumber || '',
                    specialChar: cpItem.specialCharClass || '',
                    filterCode: '',
                    preventionAction: '', detectionAction: '',
                    responsible: '', targetDate: '', status: '',
                    actionTaken: '', completionDate: '',
                    severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
                    observations: '',
                });
            }

            failures.push({
                id: uuid(),
                description: charName,
                effectLocal: 'Potencial scrap / retrabajo',
                effectNextLevel: 'Potencial reclamo',
                effectEndUser: 'Potencial insatisfaccion',
                severity: cpItem.amfeSeverity || 7,
                causes,
            });
        }

        if (failures.length > 0) {
            workElements.push({
                id: uuid(),
                type: 'Machine',
                name: opData.items[0]?.machineDeviceTool || 'Equipo de proceso',
                functions: [{
                    id: uuid(),
                    description: `Ejecutar correctamente ${opData.name}`,
                    requirements: '',
                    failures,
                }],
            });
        }

        // Add stub work elements for 6M
        for (const type of ['Man', 'Method', 'Environment']) {
            workElements.push({
                id: uuid(),
                type,
                name: type === 'Man' ? 'Operador de produccion' : type === 'Method' ? 'Metodo de Fabricacion' : 'Iluminacion / Ley 19587',
                functions: [{
                    id: uuid(),
                    description: type === 'Man' ? 'Supervisar actividades del operario' : type === 'Method' ? 'Utilizar la Hoja de Operaciones vigente' : 'Mantener condiciones de seguridad',
                    requirements: '',
                    failures: [],
                }],
            });
        }

        operations.push({
            id: uuid(),
            opNumber: opNum,
            name: opData.name,
            focusElementFunction: opData.name,
            operationFunction: `Asegurar conformidad en ${opData.name}`,
            workElements,
        });
    }

    return operations;
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD HO STUBS from AMFE operations
// ═══════════════════════════════════════════════════════════════════════════

function buildHoSheets(operations) {
    return operations.map(op => ({
        id: uuid(),
        amfeOperationId: op.id,
        operationNumber: op.opNumber,
        operationName: op.name,
        hoNumber: `HO-HR-${op.opNumber}`,
        sector: 'Produccion',
        puestoNumber: '',
        vehicleModel: 'PATAGONIA',
        partCodeDescription: '',
        safetyElements: ['anteojos', 'guantes', 'zapatos'],
        hazardWarnings: [],
        steps: [{
            id: uuid(),
            stepNumber: 1,
            description: `Ejecutar operacion ${op.opNumber}: ${op.name}`,
            isKeyPoint: false,
            keyPointReason: '',
        }],
        qualityChecks: [],
        reactionPlanText: DEFAULT_REACTION_PLAN,
        reactionContact: 'Lider de Produccion / Calidad',
        visualAids: [],
        preparedBy: '',
        approvedBy: '',
        date: '2025-04-10',
        revision: 'A',
        status: 'borrador',
    }));
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('================================================================');
    console.log('  SEED: PATAGONIA HEADREST (VWA) — 3 positions x 4 levels');
    console.log('================================================================\n');

    await initSupabase();

    // Ensure customer line
    await execSql(`INSERT OR IGNORE INTO customer_lines (code, name, product_count, is_automotive)
        VALUES (?, ?, ?, ?)`, ['095', '095 VOLKSWAGEN', 2, 1]);

    for (const pos of POSITIONS) {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`  POSITION: ${pos.key} — ${pos.familyName}`);
        console.log(`${'='.repeat(70)}`);

        const PROJECT_NAME = `VWA/PATAGONIA/${pos.projectSuffix}`;

        // ═══════════════════════════════════════════════════════════════════
        // STEP 1: Build L0 Control Plan
        // ═══════════════════════════════════════════════════════════════════
        console.log('\n  Step 1: Building L0 Control Plan...');
        const l0CpItems = buildL0CpItems(pos);
        const l0CpDoc = {
            header: {
                controlPlanNumber: `CP-HR-${pos.key}-L0`,
                phase: 'preLaunch',
                partNumber: pos.l0PartNumber,
                latestChangeLevel: 'A',
                partName: pos.l0Description,
                applicableParts: pos.l0PartNumber,
                organization: 'BARACK MERCOSUL',
                supplier: '', supplierCode: '', keyContactPhone: '',
                date: '2025-04-10',
                revision: '0',
                responsible: 'M. Nieve',
                approvedBy: 'M. Meszaros',
                client: 'Volkswagen Argentina',
                coreTeam: 'M. Nieve / M. Meszaros / L. Lattanzi / F. Santoro / G. Cal',
                customerEngApproval: '', customerQualityApproval: '', otherApproval: '',
                linkedAmfeProject: PROJECT_NAME,
            },
            items: l0CpItems,
        };
        console.log(`    ${l0CpItems.length} CP items`);

        // ═══════════════════════════════════════════════════════════════════
        // STEP 2: Build L0 AMFE stub from CP
        // ═══════════════════════════════════════════════════════════════════
        console.log('  Step 2: Building L0 AMFE stub from CP...');
        const l0AmfeOps = buildAmfeFromCp(l0CpItems, pos);
        const l0AmfeDoc = {
            header: {
                organization: 'BARACK MERCOSUL',
                location: 'PLANTA HURLINGHAM',
                client: 'Volkswagen Argentina',
                modelYear: 'PATAGONIA',
                subject: pos.l0Description,
                startDate: '2025-04-10',
                revDate: '2025-04-10',
                team: 'M. Nieve / M. Meszaros / L. Lattanzi / F. Santoro / G. Cal',
                amfeNumber: `AMFE-HR-${pos.key}-L0`,
                responsible: 'M. Nieve',
                confidentiality: '-',
                partNumber: pos.l0PartNumber,
                processResponsible: 'M. Nieve',
                revision: '01',
                approvedBy: 'M. Meszaros',
                scope: pos.l0Description,
                applicableParts: pos.l0PartNumber,
            },
            operations: l0AmfeOps,
        };
        const l0AmfeStats = countCauses(l0AmfeOps);
        const l0AmfeCoverage = calcCoverage(l0AmfeOps);
        console.log(`    ${l0AmfeOps.length} operations, ${l0AmfeStats.total} causes (H=${l0AmfeStats.apH}, M=${l0AmfeStats.apM})`);

        // ═══════════════════════════════════════════════════════════════════
        // STEP 3: Build L0 HO stubs
        // ═══════════════════════════════════════════════════════════════════
        console.log('  Step 3: Building L0 HO stubs...');
        const l0HoSheets = buildHoSheets(l0AmfeOps);
        const l0HoDoc = {
            header: {
                formNumber: 'I-IN-002.4-R01',
                organization: 'BARACK MERCOSUL',
                client: 'Volkswagen Argentina',
                partNumber: pos.l0PartNumber,
                partDescription: pos.l0Description,
                applicableParts: pos.l0PartNumber,
                linkedAmfeProject: PROJECT_NAME,
                linkedCpProject: PROJECT_NAME,
            },
            sheets: l0HoSheets,
        };
        console.log(`    ${l0HoSheets.length} HO sheets`);

        // ═══════════════════════════════════════════════════════════════════
        // STEP 4: Insert L0 documents into Supabase
        // ═══════════════════════════════════════════════════════════════════
        console.log('  Step 4: Inserting L0 documents...');

        // -- L0 AMFE --
        const l0AmfeId = uuid();
        const l0AmfeJson = JSON.stringify(l0AmfeDoc);
        const l0AmfeChecksum = sha256(l0AmfeJson);

        const existAmfe = await selectSql(`SELECT id FROM amfe_documents WHERE project_name = ?`, [PROJECT_NAME]);
        if (existAmfe.length > 0) {
            await execSql(`UPDATE amfe_documents SET data = ?, checksum = ?, updated_at = datetime('now'),
                operation_count = ?, cause_count = ?, ap_h_count = ?, ap_m_count = ?, coverage_percent = ?,
                subject = ?, part_number = ? WHERE id = ?`,
                [l0AmfeJson, l0AmfeChecksum, l0AmfeOps.length, l0AmfeStats.total, l0AmfeStats.apH, l0AmfeStats.apM,
                 l0AmfeCoverage, pos.l0Description, pos.l0PartNumber, existAmfe[0].id]);
            console.log(`    AMFE updated: ${existAmfe[0].id}`);
        } else {
            await execSql(`INSERT INTO amfe_documents (id, amfe_number, project_name, subject, client, part_number,
                responsible, organization, status, operation_count, cause_count, ap_h_count, ap_m_count,
                coverage_percent, start_date, last_revision_date, data, checksum)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [l0AmfeId, `AMFE-HR-${pos.key}-L0`, PROJECT_NAME, pos.l0Description, 'VWA', pos.l0PartNumber,
                 'M. Nieve', 'BARACK MERCOSUL', 'draft',
                 l0AmfeOps.length, l0AmfeStats.total, l0AmfeStats.apH, l0AmfeStats.apM,
                 l0AmfeCoverage, '2025-04-10', '2025-04-10', l0AmfeJson, l0AmfeChecksum]);
            console.log(`    AMFE inserted: AMFE-HR-${pos.key}-L0`);
        }
        const amfeRows = await selectSql(`SELECT id FROM amfe_documents WHERE project_name = ?`, [PROJECT_NAME]);
        const finalAmfeId = amfeRows[0]?.id || l0AmfeId;

        // -- L0 CP --
        const l0CpId = uuid();
        const l0CpJson = JSON.stringify(l0CpDoc);
        const l0CpChecksum = sha256(l0CpJson);

        const existCp = await selectSql(`SELECT id FROM cp_documents WHERE project_name = ?`, [PROJECT_NAME]);
        if (existCp.length > 0) {
            await execSql(`UPDATE cp_documents SET data = ?, checksum = ?, updated_at = datetime('now'),
                item_count = ?, phase = ?, part_number = ?, part_name = ? WHERE id = ?`,
                [l0CpJson, l0CpChecksum, l0CpItems.length, 'preLaunch', pos.l0PartNumber, pos.l0Description, existCp[0].id]);
            console.log(`    CP updated: ${existCp[0].id}`);
        } else {
            await execSql(`INSERT INTO cp_documents (id, project_name, control_plan_number, phase,
                part_number, part_name, organization, client, responsible, revision,
                linked_amfe_project, linked_amfe_id, item_count, data, checksum)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [l0CpId, PROJECT_NAME, `CP-HR-${pos.key}-L0`, 'preLaunch',
                 pos.l0PartNumber, pos.l0Description, 'BARACK MERCOSUL', 'VWA',
                 'M. Nieve', '0', PROJECT_NAME, finalAmfeId,
                 l0CpItems.length, l0CpJson, l0CpChecksum]);
            console.log(`    CP inserted: CP-HR-${pos.key}-L0 (${l0CpItems.length} items)`);
        }
        const cpRows = await selectSql(`SELECT id FROM cp_documents WHERE project_name = ?`, [PROJECT_NAME]);
        const finalCpId = cpRows[0]?.id || l0CpId;

        // -- L0 HO --
        const l0HoId = uuid();
        const l0HoJson = JSON.stringify(l0HoDoc);
        const l0HoChecksum = sha256(l0HoJson);

        const existHo = await selectSql(`SELECT id FROM ho_documents WHERE linked_amfe_project = ?`, [PROJECT_NAME]);
        if (existHo.length > 0) {
            await execSql(`UPDATE ho_documents SET data = ?, checksum = ?, updated_at = datetime('now'),
                sheet_count = ?, part_number = ?, part_description = ? WHERE id = ?`,
                [l0HoJson, l0HoChecksum, l0HoSheets.length, pos.l0PartNumber, pos.l0Description, existHo[0].id]);
            console.log(`    HO updated: ${existHo[0].id}`);
        } else {
            await execSql(`INSERT INTO ho_documents (id, form_number, organization, client,
                part_number, part_description, linked_amfe_project, linked_cp_project,
                sheet_count, data, checksum)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [l0HoId, 'I-IN-002.4-R01', 'BARACK MERCOSUL', 'VWA',
                 pos.l0PartNumber, pos.l0Description,
                 PROJECT_NAME, PROJECT_NAME,
                 l0HoSheets.length, l0HoJson, l0HoChecksum]);
            console.log(`    HO inserted: HO (${l0HoSheets.length} sheets)`);
        }
        const hoRows = await selectSql(`SELECT id FROM ho_documents WHERE linked_amfe_project = ?`, [PROJECT_NAME]);
        const finalHoId = hoRows[0]?.id || l0HoId;

        // ═══════════════════════════════════════════════════════════════════
        // STEP 5: Create product family
        // ═══════════════════════════════════════════════════════════════════
        console.log('  Step 5: Creating product family...');

        const existFam = await selectSql(`SELECT id FROM product_families WHERE name = ?`, [pos.familyName]);
        let familyId;
        if (existFam.length > 0) {
            familyId = existFam[0].id;
            console.log(`    Family already exists (ID: ${familyId})`);
        } else {
            const famResult = await execSql(
                `INSERT INTO product_families (name, description, linea_code, linea_name)
                VALUES (?, ?, ?, ?)`,
                [pos.familyName, pos.familyDesc, 'VWA', 'Volkswagen Argentina']);
            familyId = famResult.lastInsertId;
            console.log(`    Family created: "${pos.familyName}" (ID: ${familyId})`);
        }

        // Link L0 master documents
        const masterDocIds = {};
        for (const { module, documentId, label } of [
            { module: 'amfe', documentId: finalAmfeId, label: 'AMFE' },
            { module: 'cp', documentId: finalCpId, label: 'CP' },
            { module: 'ho', documentId: finalHoId, label: 'HO' },
        ]) {
            const existing = await selectSql(
                `SELECT id FROM family_documents WHERE family_id = ? AND module = ? AND document_id = ?`,
                [familyId, module, documentId]);

            if (existing.length > 0) {
                masterDocIds[module] = existing[0].id;
                console.log(`    ${label}: Already linked as master (fd_id=${existing[0].id})`);
            } else {
                const result = await execSql(
                    `INSERT INTO family_documents (family_id, module, document_id, is_master, source_master_id, product_id)
                     VALUES (?, ?, ?, 1, NULL, NULL) RETURNING id`,
                    [familyId, module, documentId]);
                masterDocIds[module] = result.lastInsertId;
                console.log(`    ${label}: Linked as master (fd_id=${result.lastInsertId})`);
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 6: Create L1/L2/L3 variant documents
        // ═══════════════════════════════════════════════════════════════════
        console.log('  Step 6: Creating L1/L2/L3 variants...');

        const variantCpItems = buildVariantCpItems(pos);

        for (const level of ['L1', 'L2', 'L3']) {
            const varProjectName = `${PROJECT_NAME} [${level}]`;
            console.log(`\n    ── ${level} ──`);

            // -- Variant CP --
            const varCpItems = variantCpItems.map(item => ({ ...item, id: uuid() }));
            const varCpDoc = {
                header: {
                    ...l0CpDoc.header,
                    controlPlanNumber: `CP-HR-${pos.key}-${level}`,
                    partNumber: pos.variantPartNumbers,
                    partName: `${pos.variantDescription} [${level}]`,
                    applicableParts: pos.variantPartNumbers,
                    linkedAmfeProject: varProjectName,
                },
                items: varCpItems,
            };
            const varCpId = uuid();
            const varCpJson = JSON.stringify(varCpDoc);
            const varCpChecksum = sha256(varCpJson);

            const existVarCp = await selectSql(`SELECT id FROM cp_documents WHERE project_name = ?`, [varProjectName]);
            if (existVarCp.length > 0) {
                await execSql(`UPDATE cp_documents SET data = ?, checksum = ?, updated_at = datetime('now'),
                    item_count = ?, part_number = ?, part_name = ? WHERE id = ?`,
                    [varCpJson, varCpChecksum, varCpItems.length, pos.variantPartNumbers,
                     `${pos.variantDescription} [${level}]`, existVarCp[0].id]);
                console.log(`      CP updated: ${existVarCp[0].id}`);
            } else {
                await execSql(`INSERT INTO cp_documents (id, project_name, control_plan_number, phase,
                    part_number, part_name, organization, client, responsible, revision,
                    linked_amfe_project, linked_amfe_id, item_count, data, checksum)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
                    [varCpId, varProjectName, `CP-HR-${pos.key}-${level}`, 'preLaunch',
                     pos.variantPartNumbers, `${pos.variantDescription} [${level}]`,
                     'BARACK MERCOSUL', 'VWA', 'M. Nieve', '0', varProjectName,
                     varCpItems.length, varCpJson, varCpChecksum]);
                console.log(`      CP inserted: CP-HR-${pos.key}-${level} (${varCpItems.length} items)`);
            }
            const varCpRows = await selectSql(`SELECT id FROM cp_documents WHERE project_name = ?`, [varProjectName]);
            const finalVarCpId = varCpRows[0]?.id || varCpId;

            // -- Variant AMFE (clone from L0) --
            const { result: varAmfeDoc } = regenerateUuids(JSON.parse(JSON.stringify(l0AmfeDoc)));
            varAmfeDoc.header.amfeNumber = `AMFE-HR-${pos.key}-${level}`;
            varAmfeDoc.header.subject = `${pos.variantDescription} [${level}]`;
            varAmfeDoc.header.partNumber = pos.variantPartNumbers;
            varAmfeDoc.header.applicableParts = pos.variantPartNumbers;

            const varAmfeId = uuid();
            const varAmfeJson = JSON.stringify(varAmfeDoc);
            const varAmfeChecksum = sha256(varAmfeJson);
            const varAmfeOps = varAmfeDoc.operations || [];
            const varAmfeStats = countCauses(varAmfeOps);
            const varAmfeCoverage = calcCoverage(varAmfeOps);

            const existVarAmfe = await selectSql(`SELECT id FROM amfe_documents WHERE project_name = ?`, [varProjectName]);
            if (existVarAmfe.length > 0) {
                await execSql(`UPDATE amfe_documents SET data = ?, checksum = ?, updated_at = datetime('now'),
                    operation_count = ?, cause_count = ?, ap_h_count = ?, ap_m_count = ?, coverage_percent = ?,
                    subject = ?, part_number = ? WHERE id = ?`,
                    [varAmfeJson, varAmfeChecksum, varAmfeOps.length, varAmfeStats.total, varAmfeStats.apH, varAmfeStats.apM,
                     varAmfeCoverage, `${pos.variantDescription} [${level}]`, pos.variantPartNumbers, existVarAmfe[0].id]);
                console.log(`      AMFE updated: ${existVarAmfe[0].id}`);
            } else {
                await execSql(`INSERT INTO amfe_documents (id, amfe_number, project_name, subject, client, part_number,
                    responsible, organization, status, operation_count, cause_count, ap_h_count, ap_m_count,
                    coverage_percent, start_date, last_revision_date, data, checksum)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [varAmfeId, `AMFE-HR-${pos.key}-${level}`, varProjectName,
                     `${pos.variantDescription} [${level}]`, 'VWA', pos.variantPartNumbers,
                     'M. Nieve', 'BARACK MERCOSUL', 'draft',
                     varAmfeOps.length, varAmfeStats.total, varAmfeStats.apH, varAmfeStats.apM,
                     varAmfeCoverage, '2025-04-10', '2025-04-10', varAmfeJson, varAmfeChecksum]);
                console.log(`      AMFE inserted: AMFE-HR-${pos.key}-${level}`);
            }
            const varAmfeRows = await selectSql(`SELECT id FROM amfe_documents WHERE project_name = ?`, [varProjectName]);
            const finalVarAmfeId = varAmfeRows[0]?.id || varAmfeId;

            // -- Variant HO (clone from L0) --
            const { result: varHoDoc } = regenerateUuids(JSON.parse(JSON.stringify(l0HoDoc)));
            varHoDoc.header.partDescription = `${pos.variantDescription} [${level}]`;
            varHoDoc.header.partNumber = pos.variantPartNumbers;
            varHoDoc.header.applicableParts = pos.variantPartNumbers;
            varHoDoc.header.linkedAmfeProject = varProjectName;
            varHoDoc.header.linkedCpProject = varProjectName;

            const varHoId = uuid();
            const varHoJson = JSON.stringify(varHoDoc);
            const varHoChecksum = sha256(varHoJson);
            const varHoSheets = varHoDoc.sheets || [];

            const existVarHo = await selectSql(`SELECT id FROM ho_documents WHERE linked_amfe_project = ?`, [varProjectName]);
            if (existVarHo.length > 0) {
                await execSql(`UPDATE ho_documents SET data = ?, checksum = ?, updated_at = datetime('now'),
                    sheet_count = ?, part_number = ?, part_description = ? WHERE id = ?`,
                    [varHoJson, varHoChecksum, varHoSheets.length, pos.variantPartNumbers,
                     `${pos.variantDescription} [${level}]`, existVarHo[0].id]);
                console.log(`      HO updated: ${existVarHo[0].id}`);
            } else {
                await execSql(`INSERT INTO ho_documents (id, form_number, organization, client,
                    part_number, part_description, linked_amfe_project, linked_cp_project,
                    sheet_count, data, checksum)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [varHoId, 'I-IN-002.4-R01', 'BARACK MERCOSUL', 'VWA',
                     pos.variantPartNumbers, `${pos.variantDescription} [${level}]`,
                     varProjectName, varProjectName,
                     varHoSheets.length, varHoJson, varHoChecksum]);
                console.log(`      HO inserted: HO (${varHoSheets.length} sheets)`);
            }
            const varHoRows = await selectSql(`SELECT id FROM ho_documents WHERE linked_amfe_project = ?`, [varProjectName]);
            const finalVarHoId = varHoRows[0]?.id || varHoId;

            // ═══════════════════════════════════════════════════════════════
            // STEP 7: Link variant documents to family
            // ═══════════════════════════════════════════════════════════════
            for (const { module, documentId, sourceMasterId, label } of [
                { module: 'amfe', documentId: finalVarAmfeId, sourceMasterId: masterDocIds.amfe, label: 'AMFE' },
                { module: 'cp', documentId: finalVarCpId, sourceMasterId: masterDocIds.cp, label: 'CP' },
                { module: 'ho', documentId: finalVarHoId, sourceMasterId: masterDocIds.ho, label: 'HO' },
            ]) {
                const existing = await selectSql(
                    `SELECT id FROM family_documents WHERE family_id = ? AND module = ? AND document_id = ?`,
                    [familyId, module, documentId]);

                if (existing.length > 0) {
                    console.log(`      ${label} [${level}]: Already linked as variant`);
                } else {
                    const result = await execSql(
                        `INSERT INTO family_documents (family_id, module, document_id, is_master, source_master_id, product_id)
                         VALUES (?, ?, ?, 0, ?, NULL) RETURNING id`,
                        [familyId, module, documentId, sourceMasterId]);
                    console.log(`      ${label} [${level}]: Linked as variant (fd_id=${result.lastInsertId})`);
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // VERIFICATION for this position
        // ═══════════════════════════════════════════════════════════════════
        console.log(`\n  Verification for ${pos.key}:`);

        const famDocCheck = await selectSql(
            `SELECT fd.module, fd.document_id, fd.is_master, fd.source_master_id
             FROM family_documents fd
             JOIN product_families pf ON pf.id = fd.family_id
             WHERE pf.name = ?
             ORDER BY fd.module, fd.is_master DESC`, [pos.familyName]);
        console.log(`    Family docs: ${famDocCheck.length} total`);
        for (const fd of famDocCheck) {
            const role = fd.is_master ? 'MASTER' : 'VARIANT';
            const source = fd.source_master_id ? ` (from master fd_id=${fd.source_master_id})` : '';
            console.log(`      [${fd.module.toUpperCase().padEnd(4)}] ${role.padEnd(7)} doc=${fd.document_id}${source}`);
        }

        const allAmfe = await selectSql(`SELECT project_name, operation_count, cause_count FROM amfe_documents WHERE project_name LIKE ?`, [`${PROJECT_NAME}%`]);
        console.log(`    AMFE docs: ${allAmfe.length}`);
        for (const a of allAmfe) console.log(`      ${a.project_name}: ${a.operation_count} ops, ${a.cause_count} causes`);

        const allCp = await selectSql(`SELECT project_name, item_count FROM cp_documents WHERE project_name LIKE ?`, [`${PROJECT_NAME}%`]);
        console.log(`    CP docs: ${allCp.length}`);
        for (const c of allCp) console.log(`      ${c.project_name}: ${c.item_count} items`);

        const allHo = await selectSql(`SELECT linked_amfe_project, sheet_count FROM ho_documents WHERE linked_amfe_project LIKE ?`, [`${PROJECT_NAME}%`]);
        console.log(`    HO docs: ${allHo.length}`);
        for (const h of allHo) console.log(`      ${h.linked_amfe_project}: ${h.sheet_count} sheets`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n================================================================');
    console.log('  SEED COMPLETO — PATAGONIA HEADREST');
    console.log('================================================================');
    console.log('  3 positions x (L0 + L1 + L2 + L3) = 12 CPs + 12 AMFEs + 12 HOs');
    console.log('  3 product families with master + 3 variants each');
    console.log('================================================================');

    close();
}

main().catch(err => {
    console.error('\nERROR:', err);
    close();
    process.exit(1);
});
