/**
 * AMFE Library Merge Logic
 *
 * Handles the inheritance/merge when syncing a linked AMFE operation with its
 * library base operation. Strategy:
 * - Keep all local-only failures (not in base)
 * - Update inherited failures with changes from the base
 * - Add new failures from the base that don't exist locally
 *
 * Data model: failures own effects & severity; causes own O, D, AP, controls, actions.
 * Causes within failures are matched by cause text; merge preserves local risk data.
 */

import { v4 as uuidv4 } from 'uuid';
import { AmfeOperation, AmfeWorkElement, AmfeFunction, AmfeFailure, AmfeCause } from './amfeTypes';
import { AmfeLibraryOperation } from './amfeLibraryTypes';

/**
 * Merge a library base operation into a local AMFE operation.
 *
 * The merge uses work element type + function description as the matching key.
 * Failures are matched by description (failure mode).
 * Causes within failures are matched by cause text.
 *
 * - Base failures not in local -> added (with new IDs)
 * - Local failures not in base -> kept (local-only)
 * - Matching failures -> base fields updated (description, effects),
 *   but local severity is preserved. Causes are merged individually.
 * - Base causes not in local -> added (with new IDs)
 * - Local causes not in base -> kept (local-only)
 * - Matching causes -> base fields updated (cause text, controls),
 *   but local O/D, AP, actions, status are preserved
 */
export function mergeWithLibrary(
    localOp: AmfeOperation,
    baseOp: AmfeLibraryOperation
): AmfeOperation {
    const mergedWEs: AmfeWorkElement[] = [];

    // Index local work elements by type for matching (supports multiple WEs per type)
    const localWeByType = new Map<string, AmfeWorkElement[]>();
    for (const we of localOp.workElements) {
        const list = localWeByType.get(we.type) || [];
        list.push(we);
        localWeByType.set(we.type, list);
    }

    // Process each base work element
    for (const baseWE of baseOp.workElements) {
        const list = localWeByType.get(baseWE.type);
        const localWE = list?.shift();

        if (!localWE) {
            // New WE from base — add with new IDs
            mergedWEs.push(cloneWEWithNewIds(baseWE));
            continue;
        }

        // Merge functions within this work element
        const mergedFuncs = mergeFunctions(localWE.functions, baseWE.functions);
        mergedWEs.push({
            ...localWE,
            functions: mergedFuncs,
        });
    }

    // Keep any local-only work elements (unmatched remaining in each type list)
    for (const list of localWeByType.values()) {
        for (const localWE of list) {
            mergedWEs.push(localWE);
        }
    }

    return {
        ...localOp,
        name: baseOp.name,
        opNumber: localOp.opNumber, // Keep local op number
        workElements: mergedWEs,
    };
}

function mergeFunctions(localFuncs: AmfeFunction[], baseFuncs: AmfeFunction[]): AmfeFunction[] {
    const result: AmfeFunction[] = [];
    const localByDesc = new Map<string, AmfeFunction[]>();
    for (const f of localFuncs) {
        const key = f.description.toLowerCase().trim();
        const list = localByDesc.get(key) || [];
        list.push(f);
        localByDesc.set(key, list);
    }

    for (const baseFunc of baseFuncs) {
        const key = baseFunc.description.toLowerCase().trim();
        const list = localByDesc.get(key);
        const localFunc = list?.shift();

        if (!localFunc) {
            // New function from base
            result.push(cloneFuncWithNewIds(baseFunc));
            continue;
        }

        // Merge failures within this function
        const mergedFails = mergeFailures(localFunc.failures, baseFunc.failures);
        result.push({
            ...localFunc,
            requirements: baseFunc.requirements || localFunc.requirements,
            failures: mergedFails,
        });
    }

    // Keep local-only functions (unmatched remaining in each desc list)
    for (const list of localByDesc.values()) {
        for (const f of list) {
            result.push(f);
        }
    }

    return result;
}

function mergeFailures(localFails: AmfeFailure[], baseFails: AmfeFailure[]): AmfeFailure[] {
    const result: AmfeFailure[] = [];
    const localByDesc = new Map<string, AmfeFailure[]>();
    for (const f of localFails) {
        const key = f.description.toLowerCase().trim();
        const list = localByDesc.get(key) || [];
        list.push(f);
        localByDesc.set(key, list);
    }

    for (const baseFail of baseFails) {
        const key = baseFail.description.toLowerCase().trim();
        const list = localByDesc.get(key);
        const localFail = list?.shift();

        if (!localFail) {
            // New failure from base — add with new IDs (including cause IDs)
            result.push(cloneFailureWithNewIds(baseFail));
            continue;
        }

        // Merge causes within this failure
        const mergedCauses = mergeCauses(localFail.causes || [], baseFail.causes || []);

        // Update base fields but preserve local severity and analysis data
        result.push({
            ...localFail,
            // Update from base (structural/descriptive)
            effectLocal: baseFail.effectLocal || localFail.effectLocal,
            effectNextLevel: baseFail.effectNextLevel || localFail.effectNextLevel,
            effectEndUser: baseFail.effectEndUser || localFail.effectEndUser,
            // Keep local severity unchanged
            // Merged causes
            causes: mergedCauses,
        });
    }

    // Keep local-only failures (unmatched remaining in each desc list)
    for (const list of localByDesc.values()) {
        for (const f of list) {
            result.push(f);
        }
    }

    return result;
}

/**
 * Merge causes within a failure. Matched by cause text (lowercase trimmed).
 * Empty/whitespace-only causes are matched positionally to avoid duplication.
 * Base structural fields (cause, controls) are updated; local risk/action data is preserved.
 */
function mergeCauses(localCauses: AmfeCause[], baseCauses: AmfeCause[]): AmfeCause[] {
    const result: AmfeCause[] = [];
    const localByCause = new Map<string, AmfeCause>();
    const localEmptyCauses: AmfeCause[] = [];

    for (const c of localCauses) {
        const key = c.cause.toLowerCase().trim();
        if (key) {
            localByCause.set(key, c);
        } else {
            localEmptyCauses.push(c);
        }
    }

    let emptyBaseIndex = 0;

    for (const baseCause of baseCauses) {
        const key = baseCause.cause.toLowerCase().trim();

        if (!key) {
            // Match empty causes positionally
            if (emptyBaseIndex < localEmptyCauses.length) {
                result.push({
                    ...localEmptyCauses[emptyBaseIndex],
                    preventionControl: baseCause.preventionControl || localEmptyCauses[emptyBaseIndex].preventionControl,
                    detectionControl: baseCause.detectionControl || localEmptyCauses[emptyBaseIndex].detectionControl,
                });
                emptyBaseIndex++;
            } else {
                result.push({ ...baseCause, id: uuidv4() });
            }
            continue;
        }

        const localCause = localByCause.get(key);

        if (!localCause) {
            // New cause from base — add with new ID
            result.push({ ...baseCause, id: uuidv4() });
            continue;
        }

        // Update base fields but preserve local risk analysis & action data
        result.push({
            ...localCause,
            preventionControl: baseCause.preventionControl || localCause.preventionControl,
            detectionControl: baseCause.detectionControl || localCause.detectionControl,
        });
        localByCause.delete(key);
    }

    // Keep unmatched local empty causes
    for (let i = emptyBaseIndex; i < localEmptyCauses.length; i++) {
        result.push(localEmptyCauses[i]);
    }

    // Keep local-only causes (not in base)
    for (const c of localByCause.values()) {
        result.push(c);
    }

    return result;
}

// --- Clone helpers (new UUIDs at every level, including causes) ---

function cloneWEWithNewIds(we: AmfeWorkElement): AmfeWorkElement {
    return {
        ...we,
        id: uuidv4(),
        functions: we.functions.map(cloneFuncWithNewIds),
    };
}

function cloneFuncWithNewIds(func: AmfeFunction): AmfeFunction {
    return {
        ...func,
        id: uuidv4(),
        failures: func.failures.map(cloneFailureWithNewIds),
    };
}

function cloneFailureWithNewIds(fail: AmfeFailure): AmfeFailure {
    return {
        ...fail,
        id: uuidv4(),
        causes: (fail.causes || []).map(cloneCauseWithNewId),
    };
}

function cloneCauseWithNewId(cause: AmfeCause): AmfeCause {
    return {
        ...cause,
        id: uuidv4(),
    };
}
