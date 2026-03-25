#!/usr/bin/env node
/**
 * COMPLETE SEED: AMFE (updated) + HO + CP + Families — INSERTO PATAGONIA (VW)
 *
 * This script:
 *   1. Loads existing AMFE operations (21 ops from 3 modules)
 *   2. Applies HO-derived updates (new Op 105 + patches for Ops 10, 100, 110)
 *   3. Generates Control Plan with ALL fields filled (no TBD)
 *   4. Creates HO document (22 sheets, 5 with full detail)
 *   5. Creates product families (16 codes, 2 families)
 *   6. Updates the AMFE header with applicableParts
 *   7. Inserts everything into the Supabase PostgreSQL database
 *
 * Usage: node scripts/run-seed-complete-inserto.mjs
 */

import { createHash, randomUUID } from 'crypto';
import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';

// ─── Import data sources ────────────────────────────────────────────────────

import { header, allOperations as ops1, uuid, sha256 } from './seed-amfe-inserto.mjs';
import { ops60to92 } from './seed-ops-60-92.mjs';
import { ops100to120 } from './seed-ops-100-120.mjs';
import { applyAmfeUpdates } from './seed-amfe-updates.mjs';
import { hoDocument, hoSheets, PRODUCT_FAMILIES } from './seed-ho-inserto.mjs';

// ─── Config ─────────────────────────────────────────────────────────────────

const PROJECT_NAME = 'VWA/PATAGONIA/INSERTO';

const APPLICABLE_PARTS = [
    'N 227', 'N 392', 'N 389', 'N 393', 'N 390', 'N 394', 'N 391', 'N 395',
    'N 396', 'N 400', 'N 397', 'N 401', 'N 398', 'N 402', 'N 399', 'N 403',
].join('\n');

// ─── AMFE Assembly ──────────────────────────────────────────────────────────

const allOperations = [...ops1, ...ops60to92, ...ops100to120];
const amfeChanges = applyAmfeUpdates(allOperations);

// Update AMFE header with applicableParts
header.applicableParts = APPLICABLE_PARTS;
header.partNumber = 'N 227 a N 403';
header.revDate = '2026-03-09';

const amfeDoc = { header, operations: allOperations };

// ─── Helpers ────────────────────────────────────────────────────────────────

function countCauses(operations) {
    let total = 0, apH = 0, apM = 0;
    for (const op of operations)
        for (const we of (op.workElements || []))
            for (const func of (we.functions || []))
                for (const fail of (func.failures || []))
                    for (const cause of (fail.causes || [])) {
                        total++;
                        if (cause.ap === 'H') apH++;
                        if (cause.ap === 'M') apM++;
                    }
    return { total, apH, apM };
}

function calcCoverage(operations) {
    let total = 0, covered = 0;
    for (const op of operations)
        for (const we of (op.workElements || []))
            for (const func of (we.functions || []))
                for (const fail of (func.failures || []))
                    for (const cause of (fail.causes || [])) {
                        total++;
                        if ((cause.preventionControl && cause.preventionControl !== '-' && cause.preventionControl !== 'N/A') ||
                            (cause.detectionControl && cause.detectionControl !== '-' && cause.detectionControl !== 'N/A'))
                            covered++;
                    }
    return total > 0 ? Math.round((covered / total) * 10000) / 100 : 0;
}

function inferOpCategory(name) {
    const n = (name || '').toLowerCase();
    if (/sold[au]/i.test(n)) return 'soldadura';
    if (/ensam[bp]l/i.test(n)) return 'ensamble';
    if (/pintu/i.test(n)) return 'pintura';
    if (/mecaniz/i.test(n)) return 'mecanizado';
    if (/inyecci[oó]n/i.test(n)) return 'inyeccion';
    if (/inspec/i.test(n)) return 'inspeccion';
    if (/troquel/i.test(n)) return 'troquelado';
    if (/costur/i.test(n)) return 'costura';
    if (/corte/i.test(n)) return 'corte';
    if (/embala/i.test(n)) return 'embalaje';
    if (/adhesi/i.test(n)) return 'adhesivado';
    if (/tapiz/i.test(n)) return 'tapizado';
    if (/recep/i.test(n)) return 'recepcion';
    if (/refil/i.test(n)) return 'refilado';
    if (/almacen|wip/i.test(n)) return 'almacenamiento';
    if (/reproc/i.test(n)) return 'reproceso';
    if (/clasif|segreg/i.test(n)) return 'clasificacion';
    if (/prearm/i.test(n)) return 'ensamble';
    return '';
}

// ============================================================================
// CONTROL PLAN GENERATOR — ALL FIELDS COMPLETE (no TBD)
// ============================================================================

function generateControlPlan(amfeDoc, phase) {
    const items = [];
    const qualifying = [];

    // Collect all qualifying causes (AP=H, AP=M, or AP=L with SC/CC)
    for (const op of amfeDoc.operations) {
        for (const we of (op.workElements || [])) {
            for (const func of (we.functions || [])) {
                for (const fail of (func.failures || [])) {
                    for (const cause of (fail.causes || [])) {
                        const severity = Number(fail.severity) || 0;
                        const occurrence = Number(cause.occurrence) || 0;
                        // AIAG-VDA 2019: CC=S≥9, SC=S=5-8 AND O≥4
                        const autoSpecialChar = cause.specialChar
                            || (severity >= 9 ? 'CC' : (severity >= 5 && occurrence >= 4) ? 'SC' : '');
                        if (cause.ap !== 'H' && cause.ap !== 'M') {
                            if (cause.ap !== 'L' || !autoSpecialChar) continue;
                        }
                        qualifying.push({ op, we, func, fail, cause, severity, autoSpecialChar });
                    }
                }
            }
        }
    }

    // ── PROCESS rows (grouped by op + cause + prevention) ───────────────
    const processGroups = new Map();
    for (const q of qualifying) {
        const key = JSON.stringify([
            q.op.opNumber,
            (q.cause.cause || '').toLowerCase().trim().replace(/\s+/g, ' '),
            (q.cause.preventionControl || '').toLowerCase().trim().replace(/\s+/g, ' '),
        ]);
        const group = processGroups.get(key) || [];
        group.push(q);
        processGroups.set(key, group);
    }

    for (const [, group] of processGroups) {
        const rep = group[0];
        const highSev = Math.max(...group.map(g => g.severity));
        const highAp = group.some(g => g.cause.ap === 'H') ? 'H' : group.some(g => g.cause.ap === 'M') ? 'M' : 'L';
        let bestSC = '';
        for (const g of group) { if (g.autoSpecialChar === 'CC') { bestSC = 'CC'; break; } if (g.autoSpecialChar === 'SC') bestSC = 'SC'; }

        const { sampleSize, sampleFrequency, reactionPlan, reactionPlanOwner, evaluationTechnique, specification } =
            getCompleteDefaults(highAp, highSev, phase, rep, 'process');

        items.push({
            id: uuid(),
            processStepNumber: rep.op.opNumber,
            processDescription: rep.op.name,
            machineDeviceTool: rep.we.name || '',
            characteristicNumber: group.find(g => g.cause.characteristicNumber?.trim())?.cause.characteristicNumber || '',
            productCharacteristic: '',
            processCharacteristic: rep.cause.cause || '',
            specialCharClass: bestSC,
            specification,
            evaluationTechnique,
            sampleSize,
            sampleFrequency,
            controlMethod: rep.cause.preventionControl || '',
            reactionPlan,
            reactionPlanOwner,
            autoFilledFields: [],
            amfeAp: highAp,
            amfeSeverity: highSev,
            operationCategory: inferOpCategory(rep.op.name),
            amfeCauseIds: [...new Set(group.map(g => g.cause.id))],
            amfeFailureId: rep.fail.id,
            amfeFailureIds: [...new Set(group.map(g => g.fail.id))],
        });
    }

    // ── PRODUCT rows (grouped by op + failure + detection) ──────────────
    const productGroups = new Map();
    for (const q of qualifying) {
        const key = JSON.stringify([
            q.op.opNumber,
            (q.fail.description || '').toLowerCase().trim().replace(/\s+/g, ' '),
            (q.cause.detectionControl || '').toLowerCase().trim().replace(/\s+/g, ' '),
        ]);
        const group = productGroups.get(key) || [];
        group.push(q);
        productGroups.set(key, group);
    }

    for (const [, group] of productGroups) {
        const rep = group[0];
        const highSev = Math.max(...group.map(g => g.severity));
        const highAp = group.some(g => g.cause.ap === 'H') ? 'H' : group.some(g => g.cause.ap === 'M') ? 'M' : 'L';
        let bestSC = '';
        for (const g of group) { if (g.autoSpecialChar === 'CC') { bestSC = 'CC'; break; } if (g.autoSpecialChar === 'SC') bestSC = 'SC'; }

        const { sampleSize, sampleFrequency, reactionPlan, reactionPlanOwner, specification } =
            getCompleteDefaults(highAp, highSev, phase, rep, 'product');

        items.push({
            id: uuid(),
            processStepNumber: rep.op.opNumber,
            processDescription: rep.op.name,
            machineDeviceTool: rep.we.name || '',
            characteristicNumber: group.find(g => g.cause.characteristicNumber?.trim())?.cause.characteristicNumber || '',
            productCharacteristic: rep.fail.description || '',
            processCharacteristic: '',
            specialCharClass: bestSC,
            specification,
            evaluationTechnique: rep.cause.detectionControl || '',
            sampleSize,
            sampleFrequency,
            controlMethod: '',
            reactionPlan,
            reactionPlanOwner,
            autoFilledFields: [],
            amfeAp: highAp,
            amfeSeverity: highSev,
            operationCategory: inferOpCategory(rep.op.name),
            amfeCauseIds: [...new Set(group.map(g => g.cause.id))],
            amfeFailureId: rep.fail.id,
            amfeFailureIds: [...new Set(group.map(g => g.fail.id))],
        });
    }

    // ── Add HO-specific quality checks not covered by AMFE ─────────────
    items.push(...getManualCpItems());

    // Sort by operation number
    items.sort((a, b) => {
        const na = parseInt(a.processStepNumber) || 0;
        const nb = parseInt(b.processStepNumber) || 0;
        if (na !== nb) return na - nb;
        return (a.processCharacteristic ? 0 : 1) - (b.processCharacteristic ? 0 : 1);
    });

    return { items, qualifyingCount: qualifying.length };
}

/**
 * Get COMPLETE defaults — no TBD, all fields filled.
 */
function getCompleteDefaults(ap, severity, phase, rep, rowType) {
    let sampleSize, sampleFrequency, reactionPlan, reactionPlanOwner, evaluationTechnique, specification;

    // ── Sample size & frequency ─────────────────────────────────────────
    if (ap === 'H') {
        sampleSize = '100%';
        sampleFrequency = 'Cada pieza';
    } else if (ap === 'M') {
        if (severity >= 9) {
            sampleSize = '5 piezas';
            sampleFrequency = 'Cada hora';
        } else if (severity >= 7) {
            sampleSize = '5 piezas';
            sampleFrequency = 'Cada 2 horas';
        } else {
            sampleSize = '3 piezas';
            sampleFrequency = 'Cada turno';
        }
    } else {
        if (severity >= 9) {
            sampleSize = '3 piezas';
            sampleFrequency = 'Cada 2 horas';
        } else if (severity >= 5) {
            sampleSize = '1 pieza';
            sampleFrequency = 'Cada turno';
        } else {
            sampleSize = '1 pieza';
            sampleFrequency = 'Inicio de turno';
        }
    }

    // ── Reaction plan based on severity ─────────────────────────────────
    if (severity >= 9) {
        reactionPlan = 'Detener línea. Segregar producto sospechoso. Escalar a Gerencia de Calidad. Contener lote completo.';
    } else if (severity >= 7) {
        reactionPlan = 'Contener producto sospechoso. Verificar últimas N piezas. Ajustar proceso. Notificar a Líder.';
    } else if (severity >= 4) {
        reactionPlan = 'Ajustar proceso. Reinspeccionar último lote. Registrar desvío.';
    } else {
        reactionPlan = 'Registrar desvío. Ajustar en próximo set-up.';
    }

    // ── Reaction plan owner based on severity and operation ─────────────
    const cat = inferOpCategory(rep.op.name);
    if (severity >= 9 || ap === 'H') {
        if (cat === 'inspeccion' || cat === 'clasificacion') {
            reactionPlanOwner = 'Supervisor de Calidad';
        } else {
            reactionPlanOwner = 'Líder de Producción / Calidad';
        }
    } else if (severity >= 7) {
        reactionPlanOwner = 'Líder de Producción';
    } else {
        reactionPlanOwner = 'Operador de Producción';
    }

    // ── Evaluation technique for process rows ───────────────────────────
    evaluationTechnique = '';
    if (rowType === 'process') {
        const det = (rep.cause.detectionControl || '').toLowerCase();
        if (det.includes('visual')) evaluationTechnique = 'Inspección visual';
        else if (det.includes('auditor')) evaluationTechnique = 'Auditoría de proceso';
        else if (det.includes('set') || det.includes('puesta')) evaluationTechnique = 'Verificación de set-up';
        else if (det.includes('dimensional')) evaluationTechnique = 'Control dimensional';
        else if (det.includes('monitor')) evaluationTechnique = 'Monitoreo automático';
        else evaluationTechnique = 'Verificación operativa';
    }

    // ── Specification ───────────────────────────────────────────────────
    specification = '';
    if (rowType === 'product') {
        const failDesc = (rep.fail.description || '').toLowerCase();
        if (failDesc.includes('fuera de medida') || failDesc.includes('dimensional')) specification = 'Según plano / tolerancia dimensional';
        else if (failDesc.includes('contaminación') || failDesc.includes('suciedad')) specification = 'Libre de contaminación visual';
        else if (failDesc.includes('adhesión') || failDesc.includes('adhesivo')) specification = 'Adhesión completa sin despegues';
        else if (failDesc.includes('costura') || failDesc.includes('hilo')) specification = 'Costura continua según especificación';
        else if (failDesc.includes('aspecto') || failDesc.includes('apariencia')) specification = 'Sin defectos visuales';
        else if (failDesc.includes('refilado')) specification = 'Conforme a pieza patrón';
        else if (failDesc.includes('deformad')) specification = 'Sin deformaciones';
        else if (failDesc.includes('identificación') || failDesc.includes('trazabilidad')) specification = 'Identificación completa (código, lote, fecha)';
        else if (failDesc.includes('parámetro') || failDesc.includes('temperatura')) specification = 'Dentro de rango de set-up';
        else specification = 'Conforme a especificación de proceso';
    } else {
        const causeDesc = (rep.cause.cause || '').toLowerCase();
        if (causeDesc.includes('temperatura')) specification = 'Rango de temperatura según set-up';
        else if (causeDesc.includes('tiempo') || causeDesc.includes('ciclo')) specification = 'Tiempos de ciclo según set-up';
        else if (causeDesc.includes('presión')) specification = 'Presión según parámetros de proceso';
        else if (causeDesc.includes('color') || causeDesc.includes('variante')) specification = 'Color/variante según OP';
        else if (causeDesc.includes('vencimiento') || causeDesc.includes('fecha')) specification = 'Dentro de fecha de vigencia';
        else if (causeDesc.includes('cantidad') || causeDesc.includes('conteo')) specification = 'Cantidad según remito/OP';
        else specification = 'Según instrucción de proceso';
    }

    return { sampleSize, sampleFrequency, reactionPlan, reactionPlanOwner, evaluationTechnique, specification };
}

/**
 * Manual CP items from HO quality checks that don't auto-generate from AMFE.
 * These are packaging, labeling, and process parameter checks.
 */
function getManualCpItems() {
    return [
        // Op 100: Temperature check from HO
        {
            id: uuid(),
            processStepNumber: '100',
            processDescription: 'Tapizado - Tapizado semiautomático',
            machineDeviceTool: 'Termómetro infrarrojo',
            characteristicNumber: '',
            productCharacteristic: '',
            processCharacteristic: 'Temperatura de vinilo y sustrato dentro de rango operativo',
            specialCharClass: 'SC',
            specification: 'Rango de temperatura según set-up de proceso',
            evaluationTechnique: 'Termómetro infrarrojo',
            sampleSize: '1 medición',
            sampleFrequency: 'Cada 2 horas',
            controlMethod: 'Medición y registro en planilla de set-up',
            reactionPlan: 'Detener proceso. Verificar temperatura de máquina. Ajustar parámetros. Reiniciar producción tras OK.',
            reactionPlanOwner: 'Calidad / Líder de Producción',
            autoFilledFields: [],
            amfeAp: 'M', amfeSeverity: 8,
            operationCategory: 'tapizado',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
        // Op 100: Machine parameters from HO
        {
            id: uuid(),
            processStepNumber: '100',
            processDescription: 'Tapizado - Tapizado semiautomático',
            machineDeviceTool: 'Timer / Display de máquina',
            characteristicNumber: '',
            productCharacteristic: '',
            processCharacteristic: 'Parámetros de máquina (tiempos de ciclo) conformes a set-up',
            specialCharClass: 'SC',
            specification: 'Tiempos de ciclo según planilla de set-up',
            evaluationTechnique: 'Timer / Display de máquina',
            sampleSize: '1 verificación',
            sampleFrequency: 'Inicio de turno',
            controlMethod: 'Lectura de display y registro en planilla de set-up',
            reactionPlan: 'No iniciar producción hasta corregir parámetros. Notificar a Mantenimiento.',
            reactionPlanOwner: 'Operador de Producción / Mantenimiento',
            autoFilledFields: [],
            amfeAp: 'H', amfeSeverity: 8,
            operationCategory: 'tapizado',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
        // Op 105: Refilado OK from HO
        {
            id: uuid(),
            processStepNumber: '105',
            processDescription: 'REFILADO POST-TAPIZADO',
            machineDeviceTool: 'Mesa de refilado / Cutter / Pieza patrón',
            characteristicNumber: '',
            productCharacteristic: 'Refilado conforme a pieza patrón',
            processCharacteristic: '',
            specialCharClass: 'SC',
            specification: 'Bordes refilados conformes a pieza patrón, sin material sobrante ni corte excesivo',
            evaluationTechnique: 'Comparación visual contra pieza patrón',
            sampleSize: '1 pieza',
            sampleFrequency: 'Inicio de turno / cambio de lote',
            controlMethod: '',
            reactionPlan: 'Contener piezas del lote. Verificar cutter. Refilar nuevamente si es recuperable.',
            reactionPlanOwner: 'Operador de Producción / Líder',
            autoFilledFields: [],
            amfeAp: 'H', amfeSeverity: 8,
            operationCategory: 'refilado',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
        // Op 110: ASPECTO CC from HO
        {
            id: uuid(),
            processStepNumber: '110',
            processDescription: 'Inspección Final - CONTROL FINAL DE CALIDAD',
            machineDeviceTool: 'Puesto de inspección',
            characteristicNumber: '',
            productCharacteristic: 'ASPECTO: Sin manchas, roturas, despegues ni deformaciones',
            processCharacteristic: '',
            specialCharClass: 'CC',
            specification: 'Sin defectos visuales de aspecto según criterio de aceptación',
            evaluationTechnique: 'Inspección visual 100%',
            sampleSize: '100%',
            sampleFrequency: 'Cada pieza',
            controlMethod: '',
            reactionPlan: 'Segregar pieza NC. Contener lote. Notificar a Supervisor de Calidad.',
            reactionPlanOwner: 'Control de Calidad (CC)',
            autoFilledFields: [],
            amfeAp: 'H', amfeSeverity: 9,
            operationCategory: 'inspeccion',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
        // Op 110: COSTURA CC from HO
        {
            id: uuid(),
            processStepNumber: '110',
            processDescription: 'Inspección Final - CONTROL FINAL DE CALIDAD',
            machineDeviceTool: 'Puesto de inspección',
            characteristicNumber: '',
            productCharacteristic: 'COSTURA: Continua, sin saltos ni hilos sueltos',
            processCharacteristic: '',
            specialCharClass: 'CC',
            specification: 'Costura conforme a imagen de referencia, sin saltos, roturas ni hilos sueltos',
            evaluationTechnique: 'Inspección visual 100%',
            sampleSize: '100%',
            sampleFrequency: 'Cada pieza',
            controlMethod: '',
            reactionPlan: 'Segregar pieza NC. Contener lote. Notificar a Supervisor de Calidad.',
            reactionPlanOwner: 'Control de Calidad (CC)',
            autoFilledFields: [],
            amfeAp: 'H', amfeSeverity: 9,
            operationCategory: 'inspeccion',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
        // Op 120: 8 piezas por caja from HO
        {
            id: uuid(),
            processStepNumber: '120',
            processDescription: 'Embalaje - EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO',
            machineDeviceTool: 'Caja 496mm x 634mm x 170mm',
            characteristicNumber: '',
            productCharacteristic: '',
            processCharacteristic: 'Cantidad correcta: 8 piezas por caja',
            specialCharClass: '',
            specification: '8 unidades por caja',
            evaluationTechnique: 'Conteo visual',
            sampleSize: '100%',
            sampleFrequency: 'Cada caja',
            controlMethod: 'Conteo visual antes de cerrar caja',
            reactionPlan: 'Reabrir caja. Contar y ajustar cantidad. Registrar desvío.',
            reactionPlanOwner: 'Operador de Producción',
            autoFilledFields: [],
            amfeAp: 'M', amfeSeverity: 4,
            operationCategory: 'embalaje',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
        // Op 120: 3 cajas por piso from HO
        {
            id: uuid(),
            processStepNumber: '120',
            processDescription: 'Embalaje - EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO',
            machineDeviceTool: 'Pallet',
            characteristicNumber: '',
            productCharacteristic: '',
            processCharacteristic: 'Apilado correcto: 3 cajas/piso, máx. 3 pisos',
            specialCharClass: '',
            specification: '3 cajas por piso, máximo 3 pisos (72 piezas por pallet)',
            evaluationTechnique: 'Visual',
            sampleSize: '100%',
            sampleFrequency: 'Cada pallet',
            controlMethod: 'Verificación visual del apilado',
            reactionPlan: 'Rearmar pallet. Verificar integridad de piezas.',
            reactionPlanOwner: 'Operador de Producción',
            autoFilledFields: [],
            amfeAp: 'M', amfeSeverity: 7,
            operationCategory: 'embalaje',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
        // Op 120: Etiqueta from HO
        {
            id: uuid(),
            processStepNumber: '120',
            processDescription: 'Embalaje - EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO',
            machineDeviceTool: 'Etiquetadora / Manual',
            characteristicNumber: '',
            productCharacteristic: 'Etiqueta de producto terminado presente y correcta',
            processCharacteristic: '',
            specialCharClass: '',
            specification: 'Etiqueta con código de producto, lote, fecha y cantidad correctos',
            evaluationTechnique: 'Visual',
            sampleSize: '100%',
            sampleFrequency: 'Cada caja',
            controlMethod: 'Verificación visual de etiqueta contra OP',
            reactionPlan: 'Corregir etiqueta. Verificar trazabilidad.',
            reactionPlanOwner: 'Operador de Producción',
            autoFilledFields: [],
            amfeAp: 'M', amfeSeverity: 4,
            operationCategory: 'embalaje',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
        // Op 10: Material identification checks from HO (8 materials)
        {
            id: uuid(),
            processStepNumber: '10',
            processDescription: 'RECEPCIONAR MATERIA PRIMA',
            machineDeviceTool: 'Planilla de recepción / Documentación',
            characteristicNumber: '',
            productCharacteristic: '',
            processCharacteristic: 'Identificación correcta de cada material recibido (7 materiales)',
            specialCharClass: 'SC',
            specification: 'Cada material verificado contra planilla: código, lote, color, fecha',
            evaluationTechnique: 'Visual / Documentación',
            sampleSize: '100%',
            sampleFrequency: 'Cada recepción',
            controlMethod: 'Verificación visual y documental contra planilla de recepción',
            reactionPlan: 'Rechazar material no conforme. Identificar como "En espera". Notificar a Calidad.',
            reactionPlanOwner: 'Operador de Producción / Calidad',
            autoFilledFields: [],
            amfeAp: 'M', amfeSeverity: 8,
            operationCategory: 'recepcion',
            amfeCauseIds: [], amfeFailureId: '', amfeFailureIds: [],
        },
    ];
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  SEED COMPLETO: AMFE + HO + CP + FAMILIAS');
    console.log('  INSERTO PATAGONIA (VW) — SUPABASE');
    console.log('═══════════════════════════════════════════════════════════════');

    // ── 0. Connect to Supabase ─────────────────────────────────────────
    await initSupabase();

    // ── 1. AMFE Info ────────────────────────────────────────────────────
    const { total: causeCount, apH, apM } = countCauses(allOperations);
    const coverage = calcCoverage(allOperations);
    const amfeId = uuid();

    console.log('\n── AMFE UPDATES ──');
    for (const change of amfeChanges) console.log(`  + ${change}`);
    console.log(`\n  Total operations: ${allOperations.length}`);
    console.log(`  Total causes: ${causeCount} (H=${apH}, M=${apM})`);
    console.log(`  Coverage: ${coverage}%`);

    // ── 2. Control Plan ─────────────────────────────────────────────────
    const cpId = uuid();
    const cpPhase = 'preLaunch';
    const cpHeader = {
        controlPlanNumber: 'CP-INSERTO-001',
        phase: cpPhase,
        partNumber: 'N 227 a N 403',
        latestChangeLevel: header.revision,
        partName: 'INSERTO TAPIZADO',
        applicableParts: APPLICABLE_PARTS,
        organization: 'BARACK MERCOSUL',
        supplier: '',
        supplierCode: '',
        keyContactPhone: '',
        date: '2026-03-09',
        revision: '1',
        responsible: 'Carlos Baptista',
        approvedBy: 'G.Cal',
        client: 'VWA',
        coreTeam: header.team,
        customerEngApproval: '',
        customerQualityApproval: '',
        otherApproval: '',
        linkedAmfeProject: PROJECT_NAME,
    };

    const { items: cpItems, qualifyingCount } = generateControlPlan(amfeDoc, cpPhase);
    const cpDoc = { header: cpHeader, items: cpItems };

    console.log('\n── CONTROL PLAN ──');
    console.log(`  Items: ${cpItems.length}`);
    console.log(`  From ${qualifyingCount} qualifying AMFE causes`);
    console.log(`  Phase: ${cpPhase}`);

    // ── 3. HO Info ──────────────────────────────────────────────────────
    const hoId = uuid();

    console.log('\n── HOJA DE OPERACIONES ──');
    console.log(`  Sheets: ${hoSheets.length}`);
    const detailed = hoSheets.filter(s => s.steps.length > 0);
    console.log(`  With detail: ${detailed.length} (Ops ${detailed.map(s => s.operationNumber).join(', ')})`);
    console.log(`  Placeholder: ${hoSheets.length - detailed.length}`);

    // ── 4. Families ─────────────────────────────────────────────────────
    console.log('\n── FAMILIAS DE PRODUCTO ──');
    for (const fam of PRODUCT_FAMILIES) {
        console.log(`  ${fam.name}: ${fam.members.length} codigos`);
        for (const m of fam.members) console.log(`    ${m.codigo} - ${m.descripcion}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // DATABASE (Supabase PostgreSQL)
    // ═══════════════════════════════════════════════════════════════════

    console.log(`\n── INSERTING INTO SUPABASE ──`);

    // ── AMFE: Upsert ───────────────────────────────────────────────────
    const amfeDataJson = JSON.stringify(amfeDoc);
    const amfeChecksum = sha256(amfeDataJson);

    // Search by amfe_number OR project_name
    const existingAmfe = await selectSql(
        `SELECT id FROM amfe_documents WHERE amfe_number = ? OR project_name = ?`,
        [header.amfeNumber, PROJECT_NAME]
    );

    if (existingAmfe.length > 0) {
        const existId = existingAmfe[0].id;
        await execSql(`UPDATE amfe_documents SET
            data = ?, checksum = ?, updated_at = datetime('now'),
            project_name = ?,
            operation_count = ?, cause_count = ?, ap_h_count = ?, ap_m_count = ?,
            coverage_percent = ?, last_revision_date = ?, part_number = ?,
            subject = ?, client = ?
            WHERE id = ?`,
            [amfeDataJson, amfeChecksum, PROJECT_NAME,
             allOperations.length, causeCount, apH, apM,
             coverage, '2026-03-09', 'N 227 a N 403', 'INSERTO', 'VWA', existId]);
        console.log(`  + AMFE updated (existing ID: ${existId})`);
    } else {
        await execSql(`INSERT INTO amfe_documents (
            id, amfe_number, project_name, subject, client, part_number,
            responsible, organization, status,
            operation_count, cause_count, ap_h_count, ap_m_count, coverage_percent,
            start_date, last_revision_date, data, checksum)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [amfeId, header.amfeNumber, PROJECT_NAME, 'INSERTO', 'VWA', 'N 227 a N 403',
             header.responsible, header.organization, 'draft',
             allOperations.length, causeCount, apH, apM, coverage,
             header.startDate, '2026-03-09', amfeDataJson, amfeChecksum]);
        console.log(`  + AMFE inserted: ${header.amfeNumber}`);
    }

    // ── Control Plan: Upsert ────────────────────────────────────────────
    const cpDataJson = JSON.stringify(cpDoc);
    const cpChecksum = sha256(cpDataJson);

    const existingCp = await selectSql(
        `SELECT id FROM cp_documents WHERE project_name = ? OR linked_amfe_project = ?`,
        [PROJECT_NAME, PROJECT_NAME]
    );

    if (existingCp.length > 0) {
        const existCpId = existingCp[0].id;
        await execSql(`UPDATE cp_documents SET
            data = ?, checksum = ?, updated_at = datetime('now'),
            item_count = ?, phase = ?, revision = ?, part_number = ?
            WHERE id = ?`,
            [cpDataJson, cpChecksum, cpItems.length, cpPhase, '1', 'N 227 a N 403', existCpId]);
        console.log(`  + CP updated (existing ID: ${existCpId})`);
    } else {
        // Determine the AMFE ID to link — use existing or the one we just created
        const linkedAmfeId = existingAmfe.length > 0 ? existingAmfe[0].id : amfeId;
        await execSql(`INSERT INTO cp_documents (
            id, project_name, control_plan_number, phase,
            part_number, part_name, organization, client,
            responsible, revision, linked_amfe_project, linked_amfe_id,
            item_count, data, checksum)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [cpId, PROJECT_NAME, 'CP-INSERTO-001', cpPhase,
             'N 227 a N 403', 'INSERTO TAPIZADO', 'BARACK MERCOSUL', 'VWA',
             'Carlos Baptista', '1', PROJECT_NAME, linkedAmfeId,
             cpItems.length, cpDataJson, cpChecksum]);
        console.log(`  + CP inserted: CP-INSERTO-001 (${cpItems.length} items)`);
    }

    // ── HO: Upsert ─────────────────────────────────────────────────────
    const hoDataJson = JSON.stringify(hoDocument);
    const hoChecksum = sha256(hoDataJson);

    const existingHo = await selectSql(
        `SELECT id FROM ho_documents WHERE linked_amfe_project = ?`,
        [PROJECT_NAME]
    );

    if (existingHo.length > 0) {
        const existHoId = existingHo[0].id;
        await execSql(`UPDATE ho_documents SET
            data = ?, checksum = ?, updated_at = datetime('now'),
            sheet_count = ?, part_number = ?, part_description = ?
            WHERE id = ?`,
            [hoDataJson, hoChecksum, hoSheets.length, 'INSERTO', 'TAPIZADO INSERT', existHoId]);
        console.log(`  + HO updated (existing ID: ${existHoId})`);
    } else {
        await execSql(`INSERT INTO ho_documents (
            id, form_number, organization, client,
            part_number, part_description,
            linked_amfe_project, linked_cp_project,
            sheet_count, data, checksum)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [hoId, 'I-IN-002.4-R01', 'BARACK MERCOSUL', 'VWA',
             'INSERTO', 'TAPIZADO INSERT',
             PROJECT_NAME, PROJECT_NAME,
             hoSheets.length, hoDataJson, hoChecksum]);
        console.log(`  + HO inserted: HO (${hoSheets.length} sheets)`);
    }

    // ── Families: Upsert ────────────────────────────────────────────────
    // Ensure customer line exists
    await execSql(`INSERT OR IGNORE INTO customer_lines (code, name, product_count, is_automotive)
        VALUES (?, ?, ?, ?)`,
        ['095', '095 VOLKSWAGEN', 16, 1]);

    for (const fam of PRODUCT_FAMILIES) {
        // Check if family exists
        const existFam = await selectSql(
            `SELECT id FROM product_families WHERE name = ?`,
            [fam.name]
        );
        let familyId;

        if (existFam.length > 0) {
            familyId = existFam[0].id;
            console.log(`  + Family "${fam.name}" already exists (ID: ${familyId})`);
        } else {
            const result = await execSql(
                `INSERT INTO product_families (name, description, linea_code, linea_name)
                VALUES (?, ?, ?, ?)`,
                [fam.name, fam.description, fam.lineaCode, fam.lineaName]);
            familyId = result.lastInsertId;
            console.log(`  + Family created: "${fam.name}" (ID: ${familyId})`);
        }

        // Insert products if they don't exist, then link to family
        for (const member of fam.members) {
            await execSql(
                `INSERT OR IGNORE INTO products (codigo, descripcion, linea_code, linea_name)
                VALUES (?, ?, ?, ?)`,
                [member.codigo, member.descripcion, fam.lineaCode, fam.lineaName]);

            const productResult = await selectSql(
                `SELECT id FROM products WHERE codigo = ? AND linea_code = ?`,
                [member.codigo, fam.lineaCode]
            );
            if (productResult.length > 0) {
                const productId = productResult[0].id;
                await execSql(
                    `INSERT OR IGNORE INTO product_family_members (family_id, product_id, is_primary)
                    VALUES (?, ?, ?)`,
                    [familyId, productId, member.codigo === 'N 227' ? 1 : 0]);
            }
        }
        console.log(`  + Family "${fam.name}": ${fam.members.length} products linked`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // VERIFICATION
    // ═══════════════════════════════════════════════════════════════════

    console.log('\n── VERIFICATION ──');

    const amfeCheck = await selectSql(
        `SELECT id, amfe_number, project_name, operation_count, cause_count, ap_h_count, ap_m_count
         FROM amfe_documents WHERE project_name = ?`, [PROJECT_NAME]);
    console.log(`  AMFE: ${amfeCheck.length} document(s)`);
    if (amfeCheck[0]) {
        const a = amfeCheck[0];
        console.log(`    ID: ${a.id}`);
        console.log(`    Number: ${a.amfe_number}`);
        console.log(`    Ops: ${a.operation_count}, Causes: ${a.cause_count} (H=${a.ap_h_count}, M=${a.ap_m_count})`);
    }

    const cpCheck = await selectSql(
        `SELECT id, control_plan_number, item_count, phase
         FROM cp_documents WHERE project_name = ?`, [PROJECT_NAME]);
    console.log(`  CP: ${cpCheck.length} document(s)`);
    if (cpCheck[0]) {
        const c = cpCheck[0];
        console.log(`    ID: ${c.id}`);
        console.log(`    Number: ${c.control_plan_number}, Items: ${c.item_count}, Phase: ${c.phase}`);
    }

    const hoCheck = await selectSql(
        `SELECT id, sheet_count, linked_amfe_project
         FROM ho_documents WHERE linked_amfe_project = ?`, [PROJECT_NAME]);
    console.log(`  HO: ${hoCheck.length} document(s)`);
    if (hoCheck[0]) {
        const h = hoCheck[0];
        console.log(`    ID: ${h.id}`);
        console.log(`    Sheets: ${h.sheet_count}`);
    }

    const famCheck = await selectSql(
        `SELECT pf.id, pf.name, COUNT(pfm.id) as member_count
         FROM product_families pf
         LEFT JOIN product_family_members pfm ON pfm.family_id = pf.id
         GROUP BY pf.id, pf.name`);
    console.log(`  Families: ${famCheck.length}`);
    for (const f of famCheck) {
        console.log(`    "${f.name}": ${f.member_count} members`);
    }

    const productCount = await selectSql(`SELECT COUNT(*) as cnt FROM products WHERE linea_code = '095'`);
    console.log(`  Products (linea 095): ${productCount[0]?.cnt ?? 0}`);

    // ═══════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  RESUMEN DE CAMBIOS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n  AMFE ACTUALIZADO:');
    for (const c of amfeChanges) console.log(`    * ${c}`);
    console.log(`    * Header: applicableParts actualizado con 16 codigos`);
    console.log(`    * Header: partNumber = "N 227 a N 403"`);
    console.log(`    -> ${allOperations.length} operaciones, ${causeCount} causas`);

    console.log('\n  HOJA DE OPERACIONES CREADA:');
    console.log(`    -> ${hoSheets.length} hojas (5 con detalle, ${hoSheets.length - 5} placeholder)`);
    console.log(`    -> Ops con detalle: 10, 100, 105, 110, 120`);
    console.log(`    -> applicableParts: 16 codigos`);

    console.log('\n  PLAN DE CONTROL CREADO:');
    console.log(`    -> ${cpItems.length} items (todos los campos completos)`);
    console.log(`    -> Fase: ${cpPhase}`);
    console.log(`    -> Incluye items manuales de HO: temperatura, parametros, refilado, aspecto CC, costura CC, embalaje`);

    console.log('\n  FAMILIAS DE PRODUCTO:');
    for (const f of PRODUCT_FAMILIES) {
        console.log(`    -> ${f.name}: ${f.members.map(m => m.codigo).join(', ')}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  SEED COMPLETO — AMFE + HO + CP + FAMILIAS (SUPABASE)');
    console.log('═══════════════════════════════════════════════════════════════');

    close();
}

main().catch(err => {
    console.error('\nERROR:', err);
    close();
    process.exit(1);
});
