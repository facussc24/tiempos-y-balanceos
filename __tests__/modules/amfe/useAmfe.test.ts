import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAmfe } from '../../../modules/amfe/useAmfe';

describe('useAmfe', () => {
    describe('initialization', () => {
        it('starts with an empty document', () => {
            const { result } = renderHook(() => useAmfe());
            expect(result.current.data.operations).toHaveLength(0);
            expect(result.current.data.header.organization).toBe('BARACK MERCOSUL');
        });
    });

    describe('resetData', () => {
        it('resets to a blank document', () => {
            const { result } = renderHook(() => useAmfe());
            act(() => result.current.addOperation());
            expect(result.current.data.operations).toHaveLength(1);
            act(() => result.current.resetData());
            expect(result.current.data.operations).toHaveLength(0);
        });
    });

    describe('loadData', () => {
        it('replaces the entire document', () => {
            const { result } = renderHook(() => useAmfe());
            const newDoc = {
                header: { ...result.current.data.header, subject: 'Loaded' },
                operations: [],
            };
            act(() => result.current.loadData(newDoc));
            expect(result.current.data.header.subject).toBe('Loaded');
        });
    });

    describe('updateHeader', () => {
        it('updates a single header field', () => {
            const { result } = renderHook(() => useAmfe());
            act(() => result.current.updateHeader('client', 'Toyota'));
            expect(result.current.data.header.client).toBe('Toyota');
        });
    });

    describe('Operation CRUD', () => {
        it('adds an operation', () => {
            const { result } = renderHook(() => useAmfe());
            act(() => result.current.addOperation());
            expect(result.current.data.operations).toHaveLength(1);
            expect(result.current.data.operations[0].id).toBeTruthy();
        });

        it('updates an operation field', () => {
            const { result } = renderHook(() => useAmfe());
            act(() => result.current.addOperation());
            const opId = result.current.data.operations[0].id;
            act(() => result.current.updateOp(opId, 'name', 'Soldadura'));
            expect(result.current.data.operations[0].name).toBe('Soldadura');
        });

        it('deletes an operation', () => {
            const { result } = renderHook(() => useAmfe());
            act(() => result.current.addOperation());
            const opId = result.current.data.operations[0].id;
            act(() => result.current.deleteOp(opId));
            expect(result.current.data.operations).toHaveLength(0);
        });
    });

    describe('WorkElement CRUD', () => {
        it('adds a work element to an operation', () => {
            const { result } = renderHook(() => useAmfe());
            act(() => result.current.addOperation());
            const opId = result.current.data.operations[0].id;
            act(() => result.current.addWorkElement(opId, 'Machine'));
            expect(result.current.data.operations[0].workElements).toHaveLength(1);
            expect(result.current.data.operations[0].workElements[0].type).toBe('Machine');
        });

        it('updates a work element', () => {
            const { result } = renderHook(() => useAmfe());
            act(() => result.current.addOperation());
            const opId = result.current.data.operations[0].id;
            act(() => result.current.addWorkElement(opId, 'Man'));
            const weId = result.current.data.operations[0].workElements[0].id;
            act(() => result.current.updateWorkElement(opId, weId, 'name', 'Operador'));
            expect(result.current.data.operations[0].workElements[0].name).toBe('Operador');
        });

        it('deletes a work element', () => {
            const { result } = renderHook(() => useAmfe());
            act(() => result.current.addOperation());
            const opId = result.current.data.operations[0].id;
            act(() => result.current.addWorkElement(opId, 'Machine'));
            const weId = result.current.data.operations[0].workElements[0].id;
            act(() => result.current.deleteWorkElement(opId, weId));
            expect(result.current.data.operations[0].workElements).toHaveLength(0);
        });

        it('defaults to Machine type', () => {
            const { result } = renderHook(() => useAmfe());
            act(() => result.current.addOperation());
            const opId = result.current.data.operations[0].id;
            act(() => result.current.addWorkElement(opId));
            expect(result.current.data.operations[0].workElements[0].type).toBe('Machine');
        });
    });

    describe('Function CRUD', () => {
        const setupWithWE = () => {
            const { result } = renderHook(() => useAmfe());
            act(() => result.current.addOperation());
            const opId = result.current.data.operations[0].id;
            act(() => result.current.addWorkElement(opId, 'Machine'));
            const weId = result.current.data.operations[0].workElements[0].id;
            return { result, opId, weId };
        };

        it('adds a function', () => {
            const { result, opId, weId } = setupWithWE();
            act(() => result.current.addFunction(opId, weId));
            const funcs = result.current.data.operations[0].workElements[0].functions;
            expect(funcs).toHaveLength(1);
            expect(funcs[0].failures).toHaveLength(0);
        });

        it('updates a function', () => {
            const { result, opId, weId } = setupWithWE();
            act(() => result.current.addFunction(opId, weId));
            const funcId = result.current.data.operations[0].workElements[0].functions[0].id;
            act(() => result.current.updateFunction(opId, weId, funcId, 'description', 'Mantener Temp'));
            expect(result.current.data.operations[0].workElements[0].functions[0].description).toBe('Mantener Temp');
        });

        it('deletes a function', () => {
            const { result, opId, weId } = setupWithWE();
            act(() => result.current.addFunction(opId, weId));
            const funcId = result.current.data.operations[0].workElements[0].functions[0].id;
            act(() => result.current.deleteFunction(opId, weId, funcId));
            expect(result.current.data.operations[0].workElements[0].functions).toHaveLength(0);
        });
    });

    describe('Failure CRUD', () => {
        const setupWithFunc = () => {
            const { result } = renderHook(() => useAmfe());
            act(() => result.current.addOperation());
            const opId = result.current.data.operations[0].id;
            act(() => result.current.addWorkElement(opId, 'Machine'));
            const weId = result.current.data.operations[0].workElements[0].id;
            act(() => result.current.addFunction(opId, weId));
            const funcId = result.current.data.operations[0].workElements[0].functions[0].id;
            return { result, opId, weId, funcId };
        };

        it('adds a failure with empty causes array', () => {
            const { result, opId, weId, funcId } = setupWithFunc();
            act(() => result.current.addFailure(opId, weId, funcId));
            const failures = result.current.data.operations[0].workElements[0].functions[0].failures;
            expect(failures).toHaveLength(1);
            expect(failures[0].causes).toEqual([]);
        });

        it('updates a failure field', () => {
            const { result, opId, weId, funcId } = setupWithFunc();
            act(() => result.current.addFailure(opId, weId, funcId));
            const failId = result.current.data.operations[0].workElements[0].functions[0].failures[0].id;
            act(() => result.current.updateFailure(opId, weId, funcId, failId, 'description', 'No suelda'));
            expect(result.current.data.operations[0].workElements[0].functions[0].failures[0].description).toBe('No suelda');
        });

        it('deletes a failure', () => {
            const { result, opId, weId, funcId } = setupWithFunc();
            act(() => result.current.addFailure(opId, weId, funcId));
            const failId = result.current.data.operations[0].workElements[0].functions[0].failures[0].id;
            act(() => result.current.deleteFailure(opId, weId, funcId, failId));
            expect(result.current.data.operations[0].workElements[0].functions[0].failures).toHaveLength(0);
        });
    });

    describe('Cause CRUD', () => {
        const setupWithFailure = () => {
            const { result } = renderHook(() => useAmfe());
            act(() => result.current.addOperation());
            const opId = result.current.data.operations[0].id;
            act(() => result.current.addWorkElement(opId, 'Machine'));
            const weId = result.current.data.operations[0].workElements[0].id;
            act(() => result.current.addFunction(opId, weId));
            const funcId = result.current.data.operations[0].workElements[0].functions[0].id;
            act(() => result.current.addFailure(opId, weId, funcId));
            const failId = result.current.data.operations[0].workElements[0].functions[0].failures[0].id;
            return { result, opId, weId, funcId, failId };
        };

        const getFailure = (result: any) =>
            result.current.data.operations[0].workElements[0].functions[0].failures[0];

        it('adds a cause to a failure', () => {
            const { result, opId, weId, funcId, failId } = setupWithFailure();
            act(() => result.current.addCause(opId, weId, funcId, failId));
            expect(getFailure(result).causes).toHaveLength(1);
            expect(getFailure(result).causes[0].cause).toBe('');
        });

        it('updates a cause field', () => {
            const { result, opId, weId, funcId, failId } = setupWithFailure();
            act(() => result.current.addCause(opId, weId, funcId, failId));
            const causeId = getFailure(result).causes[0].id;
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'cause', 'Electrodo gastado'));
            expect(getFailure(result).causes[0].cause).toBe('Electrodo gastado');
        });

        it('deletes a cause', () => {
            const { result, opId, weId, funcId, failId } = setupWithFailure();
            act(() => result.current.addCause(opId, weId, funcId, failId));
            const causeId = getFailure(result).causes[0].id;
            act(() => result.current.deleteCause(opId, weId, funcId, failId, causeId));
            expect(getFailure(result).causes).toHaveLength(0);
        });

        it('duplicates a cause with new ID', () => {
            const { result, opId, weId, funcId, failId } = setupWithFailure();
            act(() => result.current.addCause(opId, weId, funcId, failId));
            const causeId = getFailure(result).causes[0].id;
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'cause', 'Causa 1'));
            act(() => result.current.duplicateCause(opId, weId, funcId, failId, causeId));
            expect(getFailure(result).causes).toHaveLength(2);
            expect(getFailure(result).causes[1].id).not.toBe(causeId);
            expect(getFailure(result).causes[1].cause).toBe('Causa 1 (Copia)');
        });

        it('supports multiple causes per failure', () => {
            const { result, opId, weId, funcId, failId } = setupWithFailure();
            act(() => result.current.addCause(opId, weId, funcId, failId));
            act(() => result.current.addCause(opId, weId, funcId, failId));
            act(() => result.current.addCause(opId, weId, funcId, failId));
            expect(getFailure(result).causes).toHaveLength(3);
            // Each cause should have a unique ID
            const ids = getFailure(result).causes.map((c: any) => c.id);
            expect(new Set(ids).size).toBe(3);
        });
    });

    describe('AP auto-calculation (cause-level)', () => {
        const setupWithCause = () => {
            const { result } = renderHook(() => useAmfe());
            act(() => result.current.addOperation());
            const opId = result.current.data.operations[0].id;
            act(() => result.current.addWorkElement(opId, 'Machine'));
            const weId = result.current.data.operations[0].workElements[0].id;
            act(() => result.current.addFunction(opId, weId));
            const funcId = result.current.data.operations[0].workElements[0].functions[0].id;
            act(() => result.current.addFailure(opId, weId, funcId));
            const failId = result.current.data.operations[0].workElements[0].functions[0].failures[0].id;
            act(() => result.current.addCause(opId, weId, funcId, failId));
            const causeId = result.current.data.operations[0].workElements[0].functions[0].failures[0].causes[0].id;
            return { result, opId, weId, funcId, failId, causeId };
        };

        const getCause = (result: any) =>
            result.current.data.operations[0].workElements[0].functions[0].failures[0].causes[0];

        it('calculates AP on cause when S is on failure and O/D on cause', () => {
            const { result, opId, weId, funcId, failId, causeId } = setupWithCause();
            act(() => result.current.updateFailure(opId, weId, funcId, failId, 'severity', 10));
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'occurrence', 5));
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'detection', 5));
            expect(getCause(result).ap).toBe('H');
        });

        it('recalculates AP on all causes when severity changes', () => {
            const { result, opId, weId, funcId, failId, causeId } = setupWithCause();
            // Set up first cause with O/D
            act(() => result.current.updateFailure(opId, weId, funcId, failId, 'severity', 10));
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'occurrence', 5));
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'detection', 5));
            expect(getCause(result).ap).toBe('H');

            // Add a second cause with O/D
            act(() => result.current.addCause(opId, weId, funcId, failId));
            const cause2Id = result.current.data.operations[0].workElements[0].functions[0].failures[0].causes[1].id;
            act(() => result.current.updateCause(opId, weId, funcId, failId, cause2Id, 'occurrence', 5));
            act(() => result.current.updateCause(opId, weId, funcId, failId, cause2Id, 'detection', 5));

            // Change severity to 1 -> both causes should recalculate AP
            act(() => result.current.updateFailure(opId, weId, funcId, failId, 'severity', 1));
            const causes = result.current.data.operations[0].workElements[0].functions[0].failures[0].causes;
            expect(causes[0].ap).toBe('L');
            expect(causes[1].ap).toBe('L');
        });

        it('calculates apNew when new O/D change on cause', () => {
            const { result, opId, weId, funcId, failId, causeId } = setupWithCause();
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'severityNew', 1));
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'occurrenceNew', 1));
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'detectionNew', 1));
            expect(getCause(result).apNew).toBe('L');
        });

        it('returns empty AP when not all S/O/D are set', () => {
            const { result, opId, weId, funcId, failId, causeId } = setupWithCause();
            act(() => result.current.updateFailure(opId, weId, funcId, failId, 'severity', 5));
            // O and D still empty -> AP stays empty
            expect(getCause(result).ap).toBe('');
        });
    });

    describe('Duplication', () => {
        it('duplicates an operation with new IDs', () => {
            const { result } = renderHook(() => useAmfe());
            act(() => result.current.addOperation());
            const opId = result.current.data.operations[0].id;
            act(() => result.current.updateOp(opId, 'name', 'Original'));
            act(() => result.current.addWorkElement(opId, 'Machine'));

            act(() => result.current.duplicateOperation(opId));
            expect(result.current.data.operations).toHaveLength(2);

            const original = result.current.data.operations[0];
            const clone = result.current.data.operations[1];
            expect(clone.id).not.toBe(original.id);
            expect(clone.name).toBe('Original (Copia)');
            expect(clone.workElements[0].id).not.toBe(original.workElements[0].id);
        });

        it('duplicates a function with new IDs', () => {
            const { result } = renderHook(() => useAmfe());
            act(() => result.current.addOperation());
            const opId = result.current.data.operations[0].id;
            act(() => result.current.addWorkElement(opId, 'Machine'));
            const weId = result.current.data.operations[0].workElements[0].id;
            act(() => result.current.addFunction(opId, weId));
            const funcId = result.current.data.operations[0].workElements[0].functions[0].id;
            act(() => result.current.updateFunction(opId, weId, funcId, 'description', 'Func 1'));

            act(() => result.current.duplicateFunction(opId, weId, funcId));
            const funcs = result.current.data.operations[0].workElements[0].functions;
            expect(funcs).toHaveLength(2);
            expect(funcs[1].id).not.toBe(funcs[0].id);
            expect(funcs[1].description).toBe('Func 1 (Copia)');
        });

        it('duplicates a failure with a new ID', () => {
            const { result } = renderHook(() => useAmfe());
            act(() => result.current.addOperation());
            const opId = result.current.data.operations[0].id;
            act(() => result.current.addWorkElement(opId, 'Machine'));
            const weId = result.current.data.operations[0].workElements[0].id;
            act(() => result.current.addFunction(opId, weId));
            const funcId = result.current.data.operations[0].workElements[0].functions[0].id;
            act(() => result.current.addFailure(opId, weId, funcId));
            const failId = result.current.data.operations[0].workElements[0].functions[0].failures[0].id;
            act(() => result.current.updateFailure(opId, weId, funcId, failId, 'description', 'Falla 1'));

            act(() => result.current.duplicateFailure(opId, weId, funcId, failId));
            const failures = result.current.data.operations[0].workElements[0].functions[0].failures;
            expect(failures).toHaveLength(2);
            expect(failures[1].id).not.toBe(failures[0].id);
            expect(failures[1].description).toBe('Falla 1 (Copia)');
        });

        it('editing duplicated operation does not affect original', () => {
            const { result } = renderHook(() => useAmfe());
            act(() => result.current.addOperation());
            const opId = result.current.data.operations[0].id;
            act(() => result.current.updateOp(opId, 'name', 'Original'));
            act(() => result.current.addWorkElement(opId, 'Machine'));

            act(() => result.current.duplicateOperation(opId));
            const cloneId = result.current.data.operations[1].id;
            act(() => result.current.updateOp(cloneId, 'name', 'Modified Clone'));

            expect(result.current.data.operations[0].name).toBe('Original');
            expect(result.current.data.operations[1].name).toBe('Modified Clone');
        });
    });

    describe('severity auto-max from 3 effect levels', () => {
        /** Helper: build a hook with a failure that has one cause */
        const setupWithCause = () => {
            const { result } = renderHook(() => useAmfe());
            act(() => result.current.addOperation());
            const opId = result.current.data.operations[0].id;
            act(() => result.current.addWorkElement(opId));
            const weId = result.current.data.operations[0].workElements[0].id;
            act(() => result.current.addFunction(opId, weId));
            const funcId = result.current.data.operations[0].workElements[0].functions[0].id;
            act(() => result.current.addFailure(opId, weId, funcId));
            const failId = result.current.data.operations[0].workElements[0].functions[0].failures[0].id;
            act(() => result.current.addCause(opId, weId, funcId, failId));
            const causeId = result.current.data.operations[0].workElements[0].functions[0].failures[0].causes[0].id;
            // Set O and D on the cause so AP can be calculated
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'occurrence', 5));
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'detection', 4));
            return { result, opId, weId, funcId, failId, causeId };
        };

        it('computes severity as MAX of 3 sub-severity levels', () => {
            const { result, opId, weId, funcId, failId } = setupWithCause();
            act(() => result.current.updateFailure(opId, weId, funcId, failId, 'severityLocal', 3));
            act(() => result.current.updateFailure(opId, weId, funcId, failId, 'severityNextLevel', 7));
            act(() => result.current.updateFailure(opId, weId, funcId, failId, 'severityEndUser', 5));

            const fail = result.current.data.operations[0].workElements[0].functions[0].failures[0];
            expect(fail.severity).toBe(7); // MAX(3, 7, 5) = 7
        });

        it('cascades AP recalculation when sub-severity changes', () => {
            const { result, opId, weId, funcId, failId } = setupWithCause();
            // Set a high severity to trigger AP=H
            act(() => result.current.updateFailure(opId, weId, funcId, failId, 'severityEndUser', 9));

            const fail = result.current.data.operations[0].workElements[0].functions[0].failures[0];
            expect(fail.severity).toBe(9);
            // With S=9, O=5, D=4 → AP should be H (from AP table)
            expect(fail.causes[0].ap).toBe('H');
        });

        it('manual severity override still works independently', () => {
            const { result, opId, weId, funcId, failId } = setupWithCause();
            // Set direct severity (not via sub-levels)
            act(() => result.current.updateFailure(opId, weId, funcId, failId, 'severity', 8));

            const fail = result.current.data.operations[0].workElements[0].functions[0].failures[0];
            expect(fail.severity).toBe(8);
            // AP recalculated with S=8, O=5, D=4
            expect(fail.causes[0].ap).toBeTruthy(); // Should have a valid AP
        });

        it('clears severity and AP when all sub-severities cleared', () => {
            const { result, opId, weId, funcId, failId } = setupWithCause();
            // Set sub-severities first
            act(() => result.current.updateFailure(opId, weId, funcId, failId, 'severityLocal', 5));
            act(() => result.current.updateFailure(opId, weId, funcId, failId, 'severityNextLevel', 8));
            act(() => result.current.updateFailure(opId, weId, funcId, failId, 'severityEndUser', 3));
            let fail = result.current.data.operations[0].workElements[0].functions[0].failures[0];
            expect(fail.severity).toBe(8);
            expect(fail.causes[0].ap).toBeTruthy();

            // Now clear all sub-severities
            act(() => result.current.updateFailure(opId, weId, funcId, failId, 'severityLocal', ''));
            act(() => result.current.updateFailure(opId, weId, funcId, failId, 'severityNextLevel', ''));
            act(() => result.current.updateFailure(opId, weId, funcId, failId, 'severityEndUser', ''));

            fail = result.current.data.operations[0].workElements[0].functions[0].failures[0];
            expect(fail.severity).toBe('');
            expect(fail.causes[0].ap).toBe('');
        });

        it('restores severity and AP when sub-severity re-entered after clearing', () => {
            const { result, opId, weId, funcId, failId } = setupWithCause();
            // Set and clear sub-severities
            act(() => result.current.updateFailure(opId, weId, funcId, failId, 'severityEndUser', 9));
            act(() => result.current.updateFailure(opId, weId, funcId, failId, 'severityEndUser', ''));
            let fail = result.current.data.operations[0].workElements[0].functions[0].failures[0];
            expect(fail.severity).toBe('');

            // Re-enter a sub-severity
            act(() => result.current.updateFailure(opId, weId, funcId, failId, 'severityLocal', 7));
            fail = result.current.data.operations[0].workElements[0].functions[0].failures[0];
            expect(fail.severity).toBe(7);
            expect(fail.causes[0].ap).toBeTruthy();
        });
    });

    describe('Step 6: Optimization Fields (apNew)', () => {
        const setupWithCauseForStep6 = () => {
            const { result } = renderHook(() => useAmfe());
            act(() => result.current.addOperation());
            const opId = result.current.data.operations[0].id;
            act(() => result.current.addWorkElement(opId, 'Machine'));
            const weId = result.current.data.operations[0].workElements[0].id;
            act(() => result.current.addFunction(opId, weId));
            const funcId = result.current.data.operations[0].workElements[0].functions[0].id;
            act(() => result.current.addFailure(opId, weId, funcId));
            const failId = result.current.data.operations[0].workElements[0].functions[0].failures[0].id;
            act(() => result.current.addCause(opId, weId, funcId, failId));
            const causeId = result.current.data.operations[0].workElements[0].functions[0].failures[0].causes[0].id;
            return { result, opId, weId, funcId, failId, causeId };
        };

        it('recalculates apNew when severityNew changes', () => {
            const { result, opId, weId, funcId, failId, causeId } = setupWithCauseForStep6();
            // Set O_new and D_new first
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'occurrenceNew', 8));
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'detectionNew', 7));
            // Now set S_new — apNew should update
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'severityNew', 9));

            const cause = result.current.data.operations[0].workElements[0].functions[0].failures[0].causes[0];
            expect(cause.apNew).toBe('H'); // S=9, O=8, D=7 → H
        });

        it('calculates apNew with all three new S/O/D fields', () => {
            const { result, opId, weId, funcId, failId, causeId } = setupWithCauseForStep6();
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'severityNew', 3));
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'occurrenceNew', 2));
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'detectionNew', 2));

            const cause = result.current.data.operations[0].workElements[0].functions[0].failures[0].causes[0];
            expect(cause.apNew).toBe('L'); // Low severity, low O, low D → L
        });

        it('returns empty apNew with partial values', () => {
            const { result, opId, weId, funcId, failId, causeId } = setupWithCauseForStep6();
            // Only set severityNew, leave O and D empty
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'severityNew', 8));

            const cause = result.current.data.operations[0].workElements[0].functions[0].failures[0].causes[0];
            expect(cause.apNew).toBe(''); // Missing O and D → empty
        });

        it('apNew is independent of main ap', () => {
            const { result, opId, weId, funcId, failId, causeId } = setupWithCauseForStep6();
            // Set main severity and cause O/D for main AP
            act(() => result.current.updateFailure(opId, weId, funcId, failId, 'severity', 9));
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'occurrence', 8));
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'detection', 7));
            // Set new (lower) values
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'severityNew', 3));
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'occurrenceNew', 2));
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'detectionNew', 2));

            const cause = result.current.data.operations[0].workElements[0].functions[0].failures[0].causes[0];
            expect(cause.ap).toBe('H');  // Main AP still high
            expect(cause.apNew).toBe('L'); // New AP is low (improvement)
        });

        it('handles apNew edge case S=10 O=10 D=10', () => {
            const { result, opId, weId, funcId, failId, causeId } = setupWithCauseForStep6();
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'severityNew', 10));
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'occurrenceNew', 10));
            act(() => result.current.updateCause(opId, weId, funcId, failId, causeId, 'detectionNew', 10));

            const cause = result.current.data.operations[0].workElements[0].functions[0].failures[0].causes[0];
            expect(cause.apNew).toBe('H');
        });
    });
});
