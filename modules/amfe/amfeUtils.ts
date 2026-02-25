/**
 * AMFE Utility Functions
 *
 * Deep clone helpers for AMFE hierarchy duplication.
 * Each clone generates new UUIDs at every level to prevent shared references.
 */

import { v4 as uuidv4 } from 'uuid';
import { AmfeOperation, AmfeWorkElement, AmfeFunction, AmfeFailure, AmfeCause } from './amfeTypes';

/**
 * Deep clone a cause with a new UUID.
 */
export function deepCloneCause(cause: AmfeCause): AmfeCause {
    return { ...cause, id: uuidv4() };
}

/**
 * Deep clone a failure with new UUIDs for the failure and all its causes.
 */
export function deepCloneFailure(failure: AmfeFailure): AmfeFailure {
    return {
        ...failure,
        id: uuidv4(),
        causes: failure.causes.map(deepCloneCause),
    };
}

/**
 * Deep clone a function with new UUIDs for the function, all its failures, and all causes.
 */
export function deepCloneFunction(func: AmfeFunction): AmfeFunction {
    return {
        ...func,
        id: uuidv4(),
        failures: func.failures.map(deepCloneFailure),
    };
}

/**
 * Deep clone a work element with new UUIDs for the element, its functions, failures, and causes.
 */
export function deepCloneWorkElement(we: AmfeWorkElement): AmfeWorkElement {
    return {
        ...we,
        id: uuidv4(),
        functions: we.functions.map(deepCloneFunction),
    };
}

/**
 * Deep clone an operation with new UUIDs at every level of the hierarchy.
 */
export function deepCloneOperation(op: AmfeOperation): AmfeOperation {
    return {
        ...op,
        id: uuidv4(),
        workElements: op.workElements.map(deepCloneWorkElement),
    };
}
