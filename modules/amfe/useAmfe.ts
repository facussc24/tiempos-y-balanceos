/**
 * AMFE Core State Management Hook
 *
 * Manages the entire AMFE document state with CRUD operations for the
 * 5-level hierarchy: Operation → WorkElement (6M) → Function → Failure → Cause.
 *
 * Features:
 * - Auto-calculates AP (Action Priority) when S/O/D values change
 * - Severity changes on a Failure cascade AP recalculation to all its Causes
 * - Deep clone duplication at every hierarchy level
 * - Immutable state updates via React useState
 */

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AmfeDocument, AmfeOperation, AmfeWorkElement, AmfeFunction, AmfeFailure, AmfeCause, AmfeHeaderData, WorkElementType, createEmptyCause } from './amfeTypes';
import { createEmptyAmfeDoc } from './amfeInitialData';
import { calculateAP } from './apTable';
import { deepCloneOperation, deepCloneFunction, deepCloneFailure, deepCloneCause } from './amfeUtils';

export const useAmfe = () => {
    const [data, setData] = useState<AmfeDocument>(() => createEmptyAmfeDoc());

    /** Reset the AMFE document to a blank state. */
    const resetData = useCallback(() => setData(createEmptyAmfeDoc()), []);

    /** Replace the entire AMFE document (used for import/load). */
    const loadData = useCallback((newData: AmfeDocument) => setData(newData), []);

    /** Update a single field in the document header. */
    const updateHeader = useCallback((field: keyof AmfeHeaderData, value: string) => {
        setData(prev => ({
            ...prev,
            header: { ...prev.header, [field]: value }
        }));
    }, []);

    // --- HIERARCHY CRUD ---

    /** Add a new empty operation to the end of the list. */
    const addOperation = useCallback(() => {
        const newOp: AmfeOperation = {
            id: uuidv4(),
            opNumber: "",
            name: "",
            workElements: []
        };
        setData(prev => ({ ...prev, operations: [...prev.operations, newOp] }));
    }, []);

    /** Update a field on an operation by ID. */
    const updateOp = useCallback((id: string, field: keyof AmfeOperation, value: any) => {
        setData(prev => ({
            ...prev,
            operations: prev.operations.map(op => op.id === id ? { ...op, [field]: value } : op)
        }));
    }, []);

    /** Remove an operation and all its children. */
    const deleteOp = useCallback((id: string) => {
        setData(prev => ({ ...prev, operations: prev.operations.filter(op => op.id !== id) }));
    }, []);

    /** Add a new 6M work element to an operation. */
    const addWorkElement = useCallback((opId: string, type: WorkElementType = 'Machine') => {
        const newWE: AmfeWorkElement = {
            id: uuidv4(),
            type,
            name: "",
            functions: []
        };
        setData(prev => ({
            ...prev,
            operations: prev.operations.map(op => {
                if (op.id !== opId) return op;
                return { ...op, workElements: [...op.workElements, newWE] };
            })
        }));
    }, []);

    /** Update a field on a work element by ID. */
    const updateWorkElement = useCallback((opId: string, weId: string, field: keyof AmfeWorkElement, value: any) => {
        setData(prev => ({
            ...prev,
            operations: prev.operations.map(op => {
                if (op.id !== opId) return op;
                return {
                    ...op,
                    workElements: op.workElements.map(we => we.id === weId ? { ...we, [field]: value } : we)
                };
            })
        }));
    }, []);

    /** Remove a work element and all its children. */
    const deleteWorkElement = useCallback((opId: string, weId: string) => {
        setData(prev => ({
            ...prev,
            operations: prev.operations.map(op => {
                if (op.id !== opId) return op;
                return { ...op, workElements: op.workElements.filter(we => we.id !== weId) };
            })
        }));
    }, []);

    /** Add a new function to a work element. */
    const addFunction = useCallback((opId: string, weId: string) => {
        const newFunc: AmfeFunction = {
            id: uuidv4(),
            description: "",
            requirements: "",
            failures: []
        };
        setData(prev => ({
            ...prev,
            operations: prev.operations.map(op => {
                if (op.id !== opId) return op;
                return {
                    ...op,
                    workElements: op.workElements.map(we => {
                        if (we.id !== weId) return we;
                        return { ...we, functions: [...we.functions, newFunc] };
                    })
                };
            })
        }));
    }, []);

    /** Update a field on a function by ID. */
    const updateFunction = useCallback((opId: string, weId: string, funcId: string, field: keyof AmfeFunction, value: any) => {
        setData(prev => ({
            ...prev,
            operations: prev.operations.map(op => {
                if (op.id !== opId) return op;
                return {
                    ...op,
                    workElements: op.workElements.map(we => {
                        if (we.id !== weId) return we;
                        return {
                            ...we,
                            functions: we.functions.map(f => f.id === funcId ? { ...f, [field]: value } : f)
                        };
                    })
                };
            })
        }));
    }, []);

    /** Remove a function and all its failures. */
    const deleteFunction = useCallback((opId: string, weId: string, funcId: string) => {
        setData(prev => ({
            ...prev,
            operations: prev.operations.map(op => {
                if (op.id !== opId) return op;
                return {
                    ...op,
                    workElements: op.workElements.map(we => {
                        if (we.id !== weId) return we;
                        return { ...we, functions: we.functions.filter(f => f.id !== funcId) };
                    })
                };
            })
        }));
    }, []);

    /** Add a new failure (mode) to a function — starts with empty causes. */
    const addFailure = useCallback((opId: string, weId: string, funcId: string) => {
        const newFailure: AmfeFailure = {
            id: uuidv4(),
            description: "",
            effectLocal: "", effectNextLevel: "", effectEndUser: "",
            severity: "",
            causes: [],
        };
        setData(prev => ({
            ...prev,
            operations: prev.operations.map(op => {
                if (op.id !== opId) return op;
                return {
                    ...op,
                    workElements: op.workElements.map(we => {
                        if (we.id !== weId) return we;
                        return {
                            ...we,
                            functions: we.functions.map(f => {
                                if (f.id !== funcId) return f;
                                return { ...f, failures: [...f.failures, newFailure] };
                            })
                        };
                    })
                };
            })
        }));
    }, []);

    /**
     * Update a field on a failure (mode-level: description, effects, severity).
     * When severity changes, cascade AP recalculation to ALL child causes.
     */
    const updateFailure = useCallback((opId: string, weId: string, funcId: string, failId: string, field: keyof AmfeFailure, value: any) => {
        setData(prev => ({
            ...prev,
            operations: prev.operations.map(op => {
                if (op.id !== opId) return op;
                return {
                    ...op,
                    workElements: op.workElements.map(we => {
                        if (we.id !== weId) return we;
                        return {
                            ...we,
                            functions: we.functions.map(f => {
                                if (f.id !== funcId) return f;
                                return {
                                    ...f,
                                    failures: f.failures.map(fail => {
                                        if (fail.id !== failId) return fail;
                                        const updated = { ...fail, [field]: value };

                                        // When per-level severity changes, auto-compute MAX and cascade AP
                                        if (field === 'severityLocal' || field === 'severityNextLevel' || field === 'severityEndUser') {
                                            const sL = Number(updated.severityLocal) || 0;
                                            const sN = Number(updated.severityNextLevel) || 0;
                                            const sE = Number(updated.severityEndUser) || 0;
                                            const maxS = Math.max(sL, sN, sE);
                                            updated.severity = maxS >= 1 ? maxS : '';
                                            updated.causes = updated.causes.map(cause => ({
                                                ...cause,
                                                ap: calculateAP(maxS, Number(cause.occurrence), Number(cause.detection)),
                                            }));
                                        }

                                        // When severity changes directly, recalculate AP for ALL causes
                                        if (field === 'severity') {
                                            const newS = Number(value);
                                            updated.causes = updated.causes.map(cause => ({
                                                ...cause,
                                                ap: calculateAP(newS, Number(cause.occurrence), Number(cause.detection)),
                                            }));
                                        }

                                        return updated;
                                    })
                                };
                            })
                        };
                    })
                };
            })
        }));
    }, []);

    /** Remove a single failure. */
    const deleteFailure = useCallback((opId: string, weId: string, funcId: string, failId: string) => {
        setData(prev => ({
            ...prev,
            operations: prev.operations.map(op => {
                if (op.id !== opId) return op;
                return {
                    ...op,
                    workElements: op.workElements.map(we => {
                        if (we.id !== weId) return we;
                        return {
                            ...we,
                            functions: we.functions.map(f => {
                                if (f.id !== funcId) return f;
                                return { ...f, failures: f.failures.filter(fail => fail.id !== failId) };
                            })
                        };
                    })
                };
            })
        }));
    }, []);

    // --- CAUSE CRUD ---

    /** Add a new empty cause to a failure. */
    const addCause = useCallback((opId: string, weId: string, funcId: string, failId: string) => {
        const newCause = createEmptyCause();
        setData(prev => ({
            ...prev,
            operations: prev.operations.map(op => {
                if (op.id !== opId) return op;
                return {
                    ...op,
                    workElements: op.workElements.map(we => {
                        if (we.id !== weId) return we;
                        return {
                            ...we,
                            functions: we.functions.map(f => {
                                if (f.id !== funcId) return f;
                                return {
                                    ...f,
                                    failures: f.failures.map(fail => {
                                        if (fail.id !== failId) return fail;
                                        return { ...fail, causes: [...fail.causes, newCause] };
                                    })
                                };
                            })
                        };
                    })
                };
            })
        }));
    }, []);

    /**
     * Update a field on a cause. Auto-recalculates AP when O or D change,
     * using the parent failure's severity.
     */
    const updateCause = useCallback((opId: string, weId: string, funcId: string, failId: string, causeId: string, field: keyof AmfeCause, value: any) => {
        setData(prev => ({
            ...prev,
            operations: prev.operations.map(op => {
                if (op.id !== opId) return op;
                return {
                    ...op,
                    workElements: op.workElements.map(we => {
                        if (we.id !== weId) return we;
                        return {
                            ...we,
                            functions: we.functions.map(f => {
                                if (f.id !== funcId) return f;
                                return {
                                    ...f,
                                    failures: f.failures.map(fail => {
                                        if (fail.id !== failId) return fail;
                                        return {
                                            ...fail,
                                            causes: fail.causes.map(cause => {
                                                if (cause.id !== causeId) return cause;
                                                const updated = { ...cause, [field]: value };

                                                // Auto-calculate AP when O or D changes
                                                if (field === 'occurrence' || field === 'detection') {
                                                    updated.ap = calculateAP(
                                                        Number(fail.severity),
                                                        Number(updated.occurrence),
                                                        Number(updated.detection)
                                                    );
                                                }

                                                // Auto-calculate apNew when new S, O or D changes
                                                if (field === 'severityNew' || field === 'occurrenceNew' || field === 'detectionNew') {
                                                    updated.apNew = calculateAP(
                                                        Number(updated.severityNew),
                                                        Number(updated.occurrenceNew),
                                                        Number(updated.detectionNew)
                                                    );
                                                }

                                                return updated;
                                            })
                                        };
                                    })
                                };
                            })
                        };
                    })
                };
            })
        }));
    }, []);

    /** Remove a single cause from a failure. */
    const deleteCause = useCallback((opId: string, weId: string, funcId: string, failId: string, causeId: string) => {
        setData(prev => ({
            ...prev,
            operations: prev.operations.map(op => {
                if (op.id !== opId) return op;
                return {
                    ...op,
                    workElements: op.workElements.map(we => {
                        if (we.id !== weId) return we;
                        return {
                            ...we,
                            functions: we.functions.map(f => {
                                if (f.id !== funcId) return f;
                                return {
                                    ...f,
                                    failures: f.failures.map(fail => {
                                        if (fail.id !== failId) return fail;
                                        return { ...fail, causes: fail.causes.filter(c => c.id !== causeId) };
                                    })
                                };
                            })
                        };
                    })
                };
            })
        }));
    }, []);

    /** Duplicate a cause with a new UUID. */
    const duplicateCause = useCallback((opId: string, weId: string, funcId: string, failId: string, causeId: string) => {
        setData(prev => ({
            ...prev,
            operations: prev.operations.map(op => {
                if (op.id !== opId) return op;
                return {
                    ...op,
                    workElements: op.workElements.map(we => {
                        if (we.id !== weId) return we;
                        return {
                            ...we,
                            functions: we.functions.map(f => {
                                if (f.id !== funcId) return f;
                                return {
                                    ...f,
                                    failures: f.failures.map(fail => {
                                        if (fail.id !== failId) return fail;
                                        const causeToClone = fail.causes.find(c => c.id === causeId);
                                        if (!causeToClone) return fail;
                                        const newCause = deepCloneCause(causeToClone);
                                        newCause.cause = `${causeToClone.cause} (Copia)`;
                                        return { ...fail, causes: [...fail.causes, newCause] };
                                    })
                                };
                            })
                        };
                    })
                };
            })
        }));
    }, []);

    // --- DUPLICATION ---

    /** Duplicate an operation with deep-cloned UUIDs at every level. */
    const duplicateOperation = useCallback((opId: string) => {
        setData(prev => ({
            ...prev,
            operations: (() => {
                const opToClone = prev.operations.find(op => op.id === opId);
                if (!opToClone) return prev.operations;
                const newOp = deepCloneOperation(opToClone);
                newOp.name = `${opToClone.name} (Copia)`;
                return [...prev.operations, newOp];
            })()
        }));
    }, []);

    /** Duplicate a function with deep-cloned UUIDs. */
    const duplicateFunction = useCallback((opId: string, weId: string, funcId: string) => {
        setData(prev => ({
            ...prev,
            operations: prev.operations.map(op => {
                if (op.id !== opId) return op;
                return {
                    ...op,
                    workElements: op.workElements.map(we => {
                        if (we.id !== weId) return we;
                        return {
                            ...we,
                            functions: (() => {
                                const funcToClone = we.functions.find(f => f.id === funcId);
                                if (!funcToClone) return we.functions;
                                const newFunc = deepCloneFunction(funcToClone);
                                newFunc.description = `${funcToClone.description} (Copia)`;
                                return [...we.functions, newFunc];
                            })()
                        };
                    })
                };
            })
        }));
    }, []);

    /** Duplicate a single failure with new UUIDs for failure and all causes. */
    const duplicateFailure = useCallback((opId: string, weId: string, funcId: string, failId: string) => {
        setData(prev => ({
            ...prev,
            operations: prev.operations.map(op => {
                if (op.id !== opId) return op;
                return {
                    ...op,
                    workElements: op.workElements.map(we => {
                        if (we.id !== weId) return we;
                        return {
                            ...we,
                            functions: we.functions.map(f => {
                                if (f.id !== funcId) return f;
                                const failToClone = f.failures.find(fail => fail.id === failId);
                                if (!failToClone) return f;
                                const newFail = deepCloneFailure(failToClone);
                                newFail.description = `${failToClone.description} (Copia)`;
                                return { ...f, failures: [...f.failures, newFail] };
                            })
                        };
                    })
                };
            })
        }));
    }, []);

    /** Move an operation up or down in the list. */
    const moveOperation = useCallback((opId: string, direction: 'up' | 'down') => {
        setData(prev => {
            const ops = [...prev.operations];
            const index = ops.findIndex(op => op.id === opId);
            if (index === -1) return prev;
            const newIndex = direction === 'up' ? index - 1 : index + 1;
            if (newIndex < 0 || newIndex >= ops.length) return prev;
            [ops[index], ops[newIndex]] = [ops[newIndex], ops[index]];
            return { ...prev, operations: ops };
        });
    }, []);

    return {
        data,
        resetData,
        loadData,
        updateHeader,

        // CRUD
        addOperation, updateOp, deleteOp,
        addWorkElement, updateWorkElement, deleteWorkElement,
        addFunction, updateFunction, deleteFunction,
        addFailure, updateFailure, deleteFailure,
        addCause, updateCause, deleteCause,

        // DUPLICATION
        duplicateOperation,
        duplicateFunction,
        duplicateFailure,
        duplicateCause,

        // REORDER
        moveOperation
    };
};
