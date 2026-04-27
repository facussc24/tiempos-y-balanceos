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
 * - Dedup: same cause → 1 process row; same failure → 1 product row. Multiple controls combined with " / ".
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
import { getControlPlanDefaults, inferSpecification, inferReactionPlanOwner, inferControlProcedure } from './controlPlanDefaults';
import { inferOperationCategory } from '../../utils/processCategory';
import { CP_LOCAL_FIELDS } from './fieldClassification';

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
    return (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Build dedup key for process rows: opNumber + cause text (1 row per characteristic, NOT per control). */
export function buildProcessKey(opNumber: string, causeText: string): string {
    return JSON.stringify([normalizeForKey(opNumber), normalizeForKey(causeText)]);
}

/** Build dedup key for product rows: opNumber + failure description (1 row per characteristic, NOT per control). */
export function buildProductKey(opNumber: string, failDesc: string): string {
    return JSON.stringify([normalizeForKey(opNumber), normalizeForKey(failDesc)]);
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
    // AP=L causes without CC/SC → grouped into 1 generic line per operation (AIAG rule)
    const lowApByOp = new Map<string, QualifyingCause[]>();

    // FIX: Guard against undefined/null operations from corrupted or partially-loaded data
    for (const op of (amfeDoc?.operations ?? [])) {
        for (const we of (op.workElements ?? [])) {
            for (const func of (we.functions ?? [])) {
                for (const fail of (func.failures ?? [])) {
                    for (const cause of (fail.causes ?? [])) {
                        totalCauses++;

                        const severity = Number(fail.severity) || 0;
                        // CC=S≥9 (auto). SC=solo si cause.specialChar explícito del AMFE.
                        const autoSpecialChar = cause.specialChar
                            || (severity >= 9 ? 'CC' : '');

                        // AP=H/M: individual row. AP=L with CC/SC: individual row.
                        if (cause.ap === 'H' || cause.ap === 'M' || (cause.ap === 'L' && autoSpecialChar)) {
                            qualifying.push({ op, we, func, fail, cause, severity, autoSpecialChar });
                        } else if (cause.ap === 'L') {
                            // AP=L without CC/SC: collect for generic grouping per operation
                            const opGroup = lowApByOp.get(op.opNumber) || [];
                            opGroup.push({ op, we, func, fail, cause, severity, autoSpecialChar });
                            lowApByOp.set(op.opNumber, opGroup);
                        }
                        // Skip causes with empty/invalid AP
                    }
                }
            }
        }
    }

    // ─── PHASE 2: Group into PROCESS rows ───
    // Key: opNumber || cause.cause || preventionControl
    const processGroups = new Map<string, QualifyingCause[]>();

    for (const q of qualifying) {
        const key = buildProcessKey(q.op.opNumber, q.cause.cause);
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
        processAutoFilled.push('controlProcedure');

        items.push({
            id: uuidv4(),
            processStepNumber: rep.op.opNumber,
            processDescription: rep.op.name,
            machineDeviceTool: rep.we.name || '',
            componentMaterial: '',
            characteristicNumber: pickCharacteristicNumber(group),
            productCharacteristic: '',                           // EMPTY for process rows
            processCharacteristic: rep.cause.cause || '',        // cause = process parameter
            specialCharClass: bestSpecialChar,
            specification: specProcess,
            evaluationTechnique: '',                             // EMPTY for process rows (AIAG-VDA)
            sampleSize: defaults.sampleSize,
            sampleFrequency: defaults.sampleFrequency,
            controlMethod: [...new Set(group.map(g => (g.cause.preventionControl || '').trim()).filter(Boolean))].join(' / ') || '',
            reactionPlan: defaults.reactionPlan,
            reactionPlanOwner: ownerProcess,
            controlProcedure: inferControlProcedure(opCategory),
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
        const key = buildProductKey(q.op.opNumber, q.fail.description);
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
        productAutoFilled.push('controlProcedure');

        items.push({
            id: uuidv4(),
            processStepNumber: rep.op.opNumber,
            processDescription: rep.op.name,
            machineDeviceTool: rep.we.name || '',
            componentMaterial: '',
            characteristicNumber: pickCharacteristicNumber(group),
            productCharacteristic: rep.fail.description || '',   // failure mode = product defect
            processCharacteristic: '',                           // EMPTY for product rows
            specialCharClass: bestSpecialChar,
            specification: specProduct,
            evaluationTechnique: [...new Set(group.map(g => (g.cause.detectionControl || '').trim()).filter(Boolean))].join(' / ') || '',
            sampleSize: defaults.sampleSize,
            sampleFrequency: defaults.sampleFrequency,
            controlMethod: '',                                   // EMPTY for product rows
            reactionPlan: defaults.reactionPlan,
            reactionPlanOwner: ownerProduct,
            controlProcedure: inferControlProcedure(opCatProd),
            autoFilledFields: productAutoFilled,
            amfeAp: highestAp,
            amfeSeverity: highestSeverity,
            operationCategory: opCatProd,
            amfeCauseIds: [...new Set(group.map(g => g.cause.id))],
            amfeFailureId: rep.fail.id,
            amfeFailureIds: [...new Set(group.map(g => g.fail.id))],
        });
    }

    // ─── PHASE 3.5: Generic lines for AP=L causes (1 per operation) ───
    for (const [opNumber, group] of lowApByOp) {
        if (group.length === 0) continue;
        const rep = group[0];
        const opCategory = inferOperationCategory(rep.op.name) || '';
        const validSevs = group.map(g => g.severity).filter(Number.isFinite);
        const maxSev = validSevs.length > 0 ? Math.max(...validSevs) : 1;

        items.push({
            id: uuidv4(),
            processStepNumber: opNumber,
            processDescription: rep.op.name,
            machineDeviceTool: 'N/A',
            componentMaterial: '',
            characteristicNumber: '',
            productCharacteristic: '',
            processCharacteristic: 'Autocontrol visual general',
            specialCharClass: '',
            specification: 'Según instrucción de trabajo / HO',
            evaluationTechnique: 'Inspección visual',
            sampleSize: '100%',
            sampleFrequency: 'Continuo',
            controlMethod: 'Autocontrol del operador según instrucción de trabajo',
            reactionPlan: 'Contener producto sospechoso. Notificar a Líder. Según P-10/I. P-14.',
            reactionPlanOwner: 'Operador de producción',
            controlProcedure: inferControlProcedure(opCategory),
            autoFilledFields: ['sampleSize', 'sampleFrequency', 'reactionPlan', 'reactionPlanOwner', 'controlProcedure'],
            amfeAp: 'L',
            amfeSeverity: maxSev,
            operationCategory: opCategory,
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
        const lowGrouped = lowApByOp.size;
        const lowNote = lowGrouped > 0 ? ` + ${lowGrouped} línea(s) genérica(s) AP=L` : '';
        warnings.push(
            `Plan de Control generado: ${items.length} ítems (${processRowCount} de proceso + ${productRowCount} de producto) en ${opCount} operación(es), a partir de ${apHmCount} causa(s) AP Alto/Medio${scCcNote}${lowNote}.`
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

        const normalized = (amfeOpNumber || '').toLowerCase().trim();
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

// ============================================================================
// MERGE TYPES
// ============================================================================

export interface CpMergeStats {
    matched: number;
    added: number;
    orphaned: number;
}

export interface CpMergeResult {
    items: ControlPlanItem[];
    stats: CpMergeStats;
    warnings: string[];
}

// ============================================================================
// MERGE: GENERATED + EXISTING
// ============================================================================

/** Check if a value is non-empty (not undefined, null, or blank string). */
function isNonEmpty(value: unknown): boolean {
    return value !== undefined && value !== null && String(value).trim() !== '';
}

/**
 * Merge newly generated CP items with existing (user-edited) CP items.
 *
 * - Matches generated items to existing items by process/product key or fallback indexes.
 * - Preserves user-edited local fields on matched items.
 * - Marks unmatched existing items as orphaned.
 * - Returns merged items sorted by processStepNumber, row type, then orphaned last.
 */
export function mergeGeneratedWithExisting(
    generated: ControlPlanItem[],
    existing: ControlPlanItem[],
): CpMergeResult {
    const stats: CpMergeStats = { matched: 0, added: 0, orphaned: 0 };
    const warnings: string[] = [];
    const resultItems: ControlPlanItem[] = [];

    const cpLocalFieldSet = new Set<string>(CP_LOCAL_FIELDS);

    // ─── Step 1: Build indexes for existing items ───
    const existingByProcessKey = new Map<string, ControlPlanItem>();
    const existingByProductKey = new Map<string, ControlPlanItem>();
    const existingByCauseIds = new Map<string, ControlPlanItem>();
    const existingByFailureId = new Map<string, ControlPlanItem>();

    for (const item of existing) {
        if (item.processCharacteristic) {
            // Process row
            existingByProcessKey.set(
                buildProcessKey(item.processStepNumber, item.processCharacteristic),
                item,
            );
            if (item.amfeCauseIds && item.amfeCauseIds.length > 0) {
                const sortedKey = [...item.amfeCauseIds].sort().join('|');
                existingByCauseIds.set(sortedKey, item);
            }
        }
        if (item.productCharacteristic) {
            // Product row
            existingByProductKey.set(
                buildProductKey(item.processStepNumber, item.productCharacteristic),
                item,
            );
            if (item.amfeFailureId) {
                existingByFailureId.set(item.amfeFailureId, item);
            }
        }
    }

    // ─── Step 2: Track matched existing items ───
    const matchedIds = new Set<string>();

    // ─── Step 3: Match each generated item ───
    for (const genItem of generated) {
        const isProcessRow = !!genItem.processCharacteristic;
        let match: ControlPlanItem | undefined;

        // Primary index lookup
        if (isProcessRow) {
            match = existingByProcessKey.get(
                buildProcessKey(genItem.processStepNumber, genItem.processCharacteristic),
            );
        } else {
            match = existingByProductKey.get(
                buildProductKey(genItem.processStepNumber, genItem.productCharacteristic),
            );
        }

        // Only accept if not already matched
        if (match && matchedIds.has(match.id)) {
            match = undefined;
        }

        // Fallback index lookup
        if (!match) {
            if (isProcessRow) {
                if (genItem.amfeCauseIds && genItem.amfeCauseIds.length > 0) {
                    const sortedKey = [...genItem.amfeCauseIds].sort().join('|');
                    const fallback = existingByCauseIds.get(sortedKey);
                    if (fallback && !matchedIds.has(fallback.id)) {
                        match = fallback;
                    }
                }
            } else {
                if (genItem.amfeFailureId) {
                    const fallback = existingByFailureId.get(genItem.amfeFailureId);
                    if (fallback && !matchedIds.has(fallback.id)) {
                        match = fallback;
                    }
                }
            }
        }

        if (match) {
            // ─── Merge: existing + generated ───
            const merged: ControlPlanItem = { ...match };
            const existingAutoFilled = new Set<string>(match.autoFilledFields || []);
            const existingOverridden = new Set<string>(match.overriddenFields || []);
            const newAutoFilled: string[] = [];
            const genAutoFilled = new Set<string>(genItem.autoFilledFields || []);

            for (const field of Object.keys(genItem) as (keyof ControlPlanItem)[]) {
                if (field === 'id') {
                    // CRITICAL: keep existing id for cpItemId links in HO
                    continue;
                }
                if (field === 'orphaned') {
                    merged.orphaned = false;
                    continue;
                }
                if (field === 'overriddenFields') {
                    // Keep from existing
                    continue;
                }
                if (field === 'autoFilledFields') {
                    // Handled separately below
                    continue;
                }
                if (cpLocalFieldSet.has(field)) {
                    // Local field: check if user edited it
                    if (existingOverridden.has(field)) {
                        // User explicitly overrode this field — preserve existing value
                        continue;
                    }
                    const existingValue = (match as unknown as Record<string, unknown>)[field];
                    if (isNonEmpty(existingValue) && !existingAutoFilled.has(field)) {
                        // User-edited value: preserve it, remove from autoFilledFields
                        continue;
                    }
                    // Auto-filled or empty: use generated value
                    (merged as unknown as Record<string, unknown>)[field] = (genItem as unknown as Record<string, unknown>)[field];
                    if (genAutoFilled.has(field)) {
                        newAutoFilled.push(field);
                    }
                    continue;
                }
                // All other fields (inherited): use generated value
                (merged as unknown as Record<string, unknown>)[field] = (genItem as unknown as Record<string, unknown>)[field];
            }

            // Build final autoFilledFields:
            // - Local fields preserved by user → NOT in autoFilled
            // - Local fields that used generated value → in autoFilled if generated had them
            // - Non-local auto-filled fields from generated → include them
            for (const af of (genItem.autoFilledFields || [])) {
                if (!cpLocalFieldSet.has(af)) {
                    // Non-local auto-filled field from generated
                    if (!newAutoFilled.includes(af)) {
                        newAutoFilled.push(af);
                    }
                }
            }
            merged.autoFilledFields = newAutoFilled.length > 0 ? newAutoFilled : undefined;

            matchedIds.add(match.id);
            resultItems.push(merged);
            stats.matched++;
        } else {
            // No match: new item
            resultItems.push({ ...genItem });
            stats.added++;
        }
    }

    // ─── Step 4: Orphaned existing items ───
    for (const item of existing) {
        if (!matchedIds.has(item.id)) {
            resultItems.push({ ...item, orphaned: true });
            stats.orphaned++;
        }
    }

    // ─── Step 5: Sort ───
    resultItems.sort((a, b) => {
        const numA = parseInt(a.processStepNumber) || 0;
        const numB = parseInt(b.processStepNumber) || 0;
        if (numA !== numB) return numA - numB;

        // Within same operation: process rows first, then product rows
        const typeA = a.processCharacteristic ? 0 : 1;
        const typeB = b.processCharacteristic ? 0 : 1;
        if (typeA !== typeB) return typeA - typeB;

        // Orphaned items last within each operation group
        const orphA = a.orphaned ? 1 : 0;
        const orphB = b.orphaned ? 1 : 0;
        return orphA - orphB;
    });

    // ─── Step 6: Warnings ───
    if (stats.orphaned > 0) {
        warnings.push(`${stats.orphaned} item(s) del CP ya no tienen base en el AMFE (marcados como huérfanos).`);
    }
    warnings.push(`Merge CP: ${stats.matched} actualizados, ${stats.added} nuevos, ${stats.orphaned} huérfanos.`);

    return { items: resultItems, stats, warnings };
}
