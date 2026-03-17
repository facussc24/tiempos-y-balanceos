/**
 * Control Plan Generator
 *
 * Generates Control Plan items from an AMFE document per AIAG-VDA CP 1st Ed 2024.
 *
 * Key rules (validated via NotebookLM, 70 AIAG-VDA sources):
 * - Granularity = per CHARACTERISTIC (not per cause)
 * - AMFE Cause → CP Process Characteristic row (prevention control → control method)
 * - AMFE Failure Mode → CP Product Characteristic row (detection control → evaluation technique)
 * - CP 2024 PROHIBITS mixing product and process characteristics in the same row
 * - Dedup: same cause+prevention → 1 process row; same failure+detection → 1 product row
 * - specification: inferred from failure/cause keywords (heuristic)
 * - reactionPlanOwner: inferred from severity + AP + operation category
 * - evaluationTechnique (process rows): inferred from detection control
 */

import { v4 as uuidv4 } from 'uuid';
import {
    AmfeDocument, AmfeOperation, AmfeWorkElement,
    AmfeFunction, AmfeFailure, AmfeCause,
} from '../amfe/amfeTypes';
import { PfdDocument } from '../pfd/pfdTypes';
import { ControlPlanItem, ControlPlanHeader, ControlPlanDocument, ControlPlanPhase, EMPTY_CP_HEADER } from './controlPlanTypes';
import { getControlPlanDefaults, inferSpecification, inferReactionPlanOwner } from './controlPlanDefaults';
import { inferOperationCategory } from '../../utils/processCategory';

// ============================================================================
// TYPES
// ============================================================================

/** Result of generating Control Plan items, including any warnings. */
export interface GenerationResult {
    items: ControlPlanItem[];
    warnings: string[];
}

/** Internal: a qualifying cause with its full AMFE context. */
interface QualifyingCause {
    op: AmfeOperation;
    we: AmfeWorkElement;
    func: AmfeFunction;
    fail: AmfeFailure;
    cause: AmfeCause;
    severity: number;
    autoSpecialChar: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Normalize text for dedup key comparison: lowercase, trim, collapse whitespace. */
function normalizeForKey(s: string): string {
    return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Build dedup key for process rows: opNumber + cause text + prevention control. */
function buildProcessKey(opNumber: string, causeText: string, preventionControl: string): string {
    return JSON.stringify([normalizeForKey(opNumber), normalizeForKey(causeText), normalizeForKey(preventionControl)]);
}

/** Build dedup key for product rows: opNumber + failure description + detection control. */
function buildProductKey(opNumber: string, failDesc: string, detectionControl: string): string {
    return JSON.stringify([normalizeForKey(opNumber), normalizeForKey(failDesc), normalizeForKey(detectionControl)]);
}

/** Pick highest AP from a group: H > M > L. */
function pickHighestAp(group: QualifyingCause[]): 'H' | 'M' | 'L' {
    if (group.some(g => g.cause.ap === 'H')) return 'H';
    if (group.some(g => g.cause.ap === 'M')) return 'M';
    return 'L';
}

/** Pick most restrictive specialChar from a group: CC > SC > explicit > ''. */
function pickMostRestrictive(group: QualifyingCause[]): string {
    let best = '';
    for (const g of group) {
        const sc = g.autoSpecialChar;
        if (sc === 'CC') return 'CC';
        if (sc === 'SC' && best !== 'CC') best = 'SC';
        else if (sc && !best) best = sc;
    }
    return best;
}

/** Pick first non-empty characteristicNumber from a group. */
function pickCharacteristicNumber(group: QualifyingCause[]): string {
    for (const g of group) {
        if (g.cause.characteristicNumber?.trim()) return g.cause.characteristicNumber;
    }
    return '';
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate Control Plan items from AMFE causes with AP=H, AP=M, or SC/CC.
 *
 * Per AIAG-VDA CP 1st Ed 2024 + IATF 16949 §8.3.3.3:
 * - Each AMFE cause generates a PROCESS characteristic row (cause → parameter to control)
 * - Each AMFE failure mode generates a PRODUCT characteristic row (failure → defect to detect)
 * - Dedup groups identical process rows and identical product rows
 * - Product and process characteristics are NEVER mixed in the same row
 * - SC/CC characteristics (S≥5) MUST be included regardless of AP level
 */
export function generateItemsFromAmfe(
    amfeDoc: AmfeDocument,
    phase: ControlPlanPhase = 'production'
): GenerationResult {
    const items: ControlPlanItem[] = [];
    const warnings: string[] = [];
    let totalCauses = 0;

    // ─── PHASE 1: Collect all qualifying causes with context ───
    const qualifying: QualifyingCause[] = [];

    // FIX: Guard against undefined/null operations from corrupted or partially-loaded data
    for (const op of (amfeDoc?.operations ?? [])) {
        for (const we of (op.workElements ?? [])) {
            for (const func of (we.functions ?? [])) {
                for (const fail of (func.failures ?? [])) {
                    for (const cause of (fail.causes ?? [])) {
                        totalCauses++;

                        const severity = Number(fail.severity) || 0;
                        const autoSpecialChar = cause.specialChar
                            || (severity >= 9 ? 'CC' : severity >= 5 ? 'SC' : '');

                        // IATF 16949 §8.3.3.3: SC/CC characteristics MUST be in CP
                        // regardless of AP level. Include AP=L causes if they have SC/CC.
                        // Skip empty/invalid AP and AP=L without SC/CC.
                        if (cause.ap !== 'H' && cause.ap !== 'M') {
                            if (cause.ap !== 'L' || !autoSpecialChar) continue;
                        }

                        qualifying.push({ op, we, func, fail, cause, severity, autoSpecialChar });
                    }
                }
            }
        }
    }

    // ─── PHASE 2: Group into PROCESS rows ───
    // Key: opNumber || cause.cause || preventionControl
    const processGroups = new Map<string, QualifyingCause[]>();

    for (const q of qualifying) {
        const key = buildProcessKey(q.op.opNumber, q.cause.cause, q.cause.preventionControl);
        const group = processGroups.get(key) || [];
        group.push(q);
        processGroups.set(key, group);
    }

    for (const [, group] of processGroups) {
        // FIX: Defensive guard — skip empty groups (should never happen by construction,
        // but prevents group[0] crash and Math.max(...[]) returning -Infinity)
        if (group.length === 0) continue;
        const rep = group[0];
        const validSeverities = group.map(g => g.severity).filter(Number.isFinite);
        const highestSeverity = validSeverities.length > 0 ? Math.max(...validSeverities) : 1;
        const highestAp = pickHighestAp(group);
        const bestSpecialChar = pickMostRestrictive(group);

        const defaults = getControlPlanDefaults({
            ap: highestAp,
            severity: highestSeverity,
            phase,
        });

        const opCategory = inferOperationCategory(rep.op.name) || '';
        // AIAG-VDA: specification for process rows should only be set when a specific
        // keyword is recognized — do NOT use a generic fallback (spec comes from engineering design)
        const specProcessRaw = inferSpecification('process', '', rep.cause.cause || '');
        const specProcess = specProcessRaw === 'Según instrucción de proceso' ? '' : specProcessRaw;
        const ownerProcess = inferReactionPlanOwner(highestSeverity, highestAp, opCategory);
        // AIAG-VDA: evaluationTechnique is for product rows (detection), NOT process rows (prevention)
        const processAutoFilled = [...defaults.autoFilledFields];
        if (specProcess) processAutoFilled.push('specification');
        if (ownerProcess) processAutoFilled.push('reactionPlanOwner');

        items.push({
            id: uuidv4(),
            processStepNumber: rep.op.opNumber,
            processDescription: rep.op.name,
            machineDeviceTool: rep.we.name || '',
            characteristicNumber: pickCharacteristicNumber(group),
            productCharacteristic: '',                           // EMPTY for process rows
            processCharacteristic: rep.cause.cause || '',        // cause = process parameter
            specialCharClass: bestSpecialChar,
            specification: specProcess,
            evaluationTechnique: '',                             // EMPTY for process rows (AIAG-VDA)
            sampleSize: defaults.sampleSize,
            sampleFrequency: defaults.sampleFrequency,
            controlMethod: rep.cause.preventionControl || '',    // prevention control
            reactionPlan: defaults.reactionPlan,
            reactionPlanOwner: ownerProcess,
            controlProcedure: '',
            autoFilledFields: processAutoFilled,
            amfeAp: highestAp,
            amfeSeverity: highestSeverity,
            operationCategory: opCategory,
            amfeCauseIds: [...new Set(group.map(g => g.cause.id))],
            amfeFailureId: rep.fail.id,
            amfeFailureIds: [...new Set(group.map(g => g.fail.id))],
        });
    }

    // ─── PHASE 3: Group into PRODUCT rows ───
    // Key: opNumber || fail.description || detectionControl
    const productGroups = new Map<string, QualifyingCause[]>();

    for (const q of qualifying) {
        const key = buildProductKey(q.op.opNumber, q.fail.description, q.cause.detectionControl);
        const group = productGroups.get(key) || [];
        group.push(q);
        productGroups.set(key, group);
    }

    for (const [, group] of productGroups) {
        if (group.length === 0) continue; // FIX: Same defensive guard as process groups
        const rep = group[0];
        const validSevs = group.map(g => g.severity).filter(Number.isFinite);
        const highestSeverity = validSevs.length > 0 ? Math.max(...validSevs) : 1;
        const highestAp = pickHighestAp(group);
        const bestSpecialChar = pickMostRestrictive(group);

        const defaults = getControlPlanDefaults({
            ap: highestAp,
            severity: highestSeverity,
            phase,
        });

        const opCatProd = inferOperationCategory(rep.op.name) || '';
        const specProduct = inferSpecification('product', rep.fail.description || '', '');
        const ownerProduct = inferReactionPlanOwner(highestSeverity, highestAp, opCatProd);
        const productAutoFilled = [...defaults.autoFilledFields];
        if (specProduct) productAutoFilled.push('specification');
        if (ownerProduct) productAutoFilled.push('reactionPlanOwner');

        items.push({
            id: uuidv4(),
            processStepNumber: rep.op.opNumber,
            processDescription: rep.op.name,
            machineDeviceTool: rep.we.name || '',
            characteristicNumber: pickCharacteristicNumber(group),
            productCharacteristic: rep.fail.description || '',   // failure mode = product defect
            processCharacteristic: '',                           // EMPTY for product rows
            specialCharClass: bestSpecialChar,
            specification: specProduct,
            evaluationTechnique: rep.cause.detectionControl || '', // detection control
            sampleSize: defaults.sampleSize,
            sampleFrequency: defaults.sampleFrequency,
            controlMethod: '',                                   // EMPTY for product rows
            reactionPlan: defaults.reactionPlan,
            reactionPlanOwner: ownerProduct,
            controlProcedure: '',
            autoFilledFields: productAutoFilled,
            amfeAp: highestAp,
            amfeSeverity: highestSeverity,
            operationCategory: opCatProd,
            amfeCauseIds: [...new Set(group.map(g => g.cause.id))],
            amfeFailureId: rep.fail.id,
            amfeFailureIds: [...new Set(group.map(g => g.fail.id))],
        });
    }

    // ─── PHASE 4: Sort ───
    items.sort((a, b) => {
        const numA = parseInt(a.processStepNumber) || 0;
        const numB = parseInt(b.processStepNumber) || 0;
        if (numA !== numB) return numA - numB;
        // Within same operation: process rows first, then product rows
        const typeA = a.processCharacteristic ? 0 : 1;
        const typeB = b.processCharacteristic ? 0 : 1;
        return typeA - typeB;
    });

    // ─── PHASE 5: Warnings ───
    if (items.length === 0) {
        if (totalCauses === 0) {
            warnings.push('El AMFE no tiene causas definidas. Agregue operaciones, fallas y causas primero.');
        } else {
            warnings.push(`No se encontraron causas con AP Alto o Medio en el AMFE. Ninguna de las ${totalCauses} causa(s) tiene prioridad suficiente.`);
        }
    } else {
        // Clean summary: total counts
        const processRowCount = items.filter(i => !!i.processCharacteristic).length;
        const productRowCount = items.filter(i => !!i.productCharacteristic && !i.processCharacteristic).length;
        const opCount = new Set(items.map(i => i.processStepNumber)).size;
        const scCcCount = qualifying.filter(q => q.cause.ap !== 'H' && q.cause.ap !== 'M').length;
        const apHmCount = qualifying.length - scCcCount;
        const scCcNote = scCcCount > 0 ? ` + ${scCcCount} SC/CC` : '';
        warnings.push(
            `Plan de Control generado: ${items.length} ítems (${processRowCount} de proceso + ${productRowCount} de producto) en ${opCount} operación(es), a partir de ${apHmCount} causa(s) AP Alto/Medio${scCcNote}.`
        );
    }

    return { items, warnings };
}

/**
 * Generate a full Control Plan document from an AMFE document.
 * Pre-fills header with AMFE header data and auto-fills item defaults.
 */
export function generateControlPlanFromAmfe(
    amfeDoc: AmfeDocument,
    amfeProjectName: string
): { document: ControlPlanDocument; warnings: string[] } {
    const header: ControlPlanHeader = {
        ...EMPTY_CP_HEADER,
        partNumber: amfeDoc.header.partNumber || '',
        latestChangeLevel: amfeDoc.header.revision || '',
        partName: amfeDoc.header.subject || '',
        organization: amfeDoc.header.organization || '',
        client: amfeDoc.header.client || '',
        responsible: amfeDoc.header.processResponsible || amfeDoc.header.responsible || '',
        approvedBy: amfeDoc.header.approvedBy || '',
        coreTeam: amfeDoc.header.team || '',
        applicableParts: amfeDoc.header.applicableParts || '',
        linkedAmfeProject: amfeProjectName,
        date: new Date().toISOString().split('T')[0],
    };

    const { items, warnings } = generateItemsFromAmfe(amfeDoc, header.phase);

    return { document: { header, items }, warnings };
}

/**
 * Link PFD steps to CP items through AMFE operation traceability.
 * For each PFD step that has `linkedAmfeOperationId`, find the CP items
 * whose processStepNumber matches the AMFE operation's opNumber,
 * and set `linkedCpItemIds` on the PFD step.
 */
export function linkPfdToCp(
    pfdDoc: PfdDocument,
    cpItems: ControlPlanItem[],
    amfeOps: AmfeOperation[],
): PfdDocument {
    // Build map: AMFE op ID → opNumber
    const opIdToNumber = new Map<string, string>();
    for (const op of amfeOps) {
        opIdToNumber.set(op.id, op.opNumber);
    }

    // Build map: normalized opNumber → list of CP item IDs
    const opNumberToCpIds = new Map<string, string[]>();
    for (const item of cpItems) {
        const normalized = (item.processStepNumber || '').toLowerCase().trim();
        if (!normalized) continue;
        const existing = opNumberToCpIds.get(normalized) || [];
        existing.push(item.id);
        opNumberToCpIds.set(normalized, existing);
    }

    // Update PFD steps
    const updatedSteps = pfdDoc.steps.map(step => {
        if (!step.linkedAmfeOperationId) return step;

        const amfeOpNumber = opIdToNumber.get(step.linkedAmfeOperationId);
        if (!amfeOpNumber) return step;

        const normalized = amfeOpNumber.toLowerCase().trim();
        const cpIds = opNumberToCpIds.get(normalized) || [];

        if (cpIds.length === 0) return step;

        return { ...step, linkedCpItemIds: cpIds };
    });

    return {
        ...pfdDoc,
        steps: updatedSteps,
        updatedAt: new Date().toISOString(),
    };
}
