import { renderHook, act } from '@testing-library/react';
import { usePfdDocument } from '../../../modules/pfd/usePfdDocument';
import { createEmptyStep, PfdStep } from '../../../modules/pfd/pfdTypes';

describe('usePfdDocument', () => {
    describe('updateMultipleSteps', () => {
        it('should update multiple steps in a single call', () => {
            const { result } = renderHook(() => usePfdDocument());

            // Add some steps
            act(() => {
                result.current.setSteps([
                    { ...createEmptyStep('OP 10'), description: 'Step 1', branchId: 'A', branchLabel: 'Old' },
                    { ...createEmptyStep('OP 20'), description: 'Step 2', branchId: 'A', branchLabel: 'Old' },
                    { ...createEmptyStep('OP 30'), description: 'Step 3', branchId: '', branchLabel: '' },
                ]);
            });

            const steps = result.current.data.steps;
            const updates = [
                { stepId: steps[0].id, field: 'branchLabel' as keyof PfdStep, value: 'New Label' },
                { stepId: steps[1].id, field: 'branchLabel' as keyof PfdStep, value: 'New Label' },
            ];

            act(() => {
                result.current.updateMultipleSteps(updates);
            });

            expect(result.current.data.steps[0].branchLabel).toBe('New Label');
            expect(result.current.data.steps[1].branchLabel).toBe('New Label');
            expect(result.current.data.steps[2].branchLabel).toBe(''); // Unchanged
        });

        it('should create only one undo entry for multiple step updates', () => {
            const { result } = renderHook(() => usePfdDocument());

            act(() => {
                result.current.setSteps([
                    { ...createEmptyStep('OP 10'), description: 'Step 1', branchId: 'A', branchLabel: 'Old' },
                    { ...createEmptyStep('OP 20'), description: 'Step 2', branchId: 'A', branchLabel: 'Old' },
                    { ...createEmptyStep('OP 30'), description: 'Step 3', branchId: 'A', branchLabel: 'Old' },
                ]);
            });

            const steps = result.current.data.steps;

            // Update all three steps at once
            act(() => {
                result.current.updateMultipleSteps([
                    { stepId: steps[0].id, field: 'branchLabel' as keyof PfdStep, value: 'New' },
                    { stepId: steps[1].id, field: 'branchLabel' as keyof PfdStep, value: 'New' },
                    { stepId: steps[2].id, field: 'branchLabel' as keyof PfdStep, value: 'New' },
                ]);
            });

            // All three should be updated
            expect(result.current.data.steps[0].branchLabel).toBe('New');
            expect(result.current.data.steps[1].branchLabel).toBe('New');
            expect(result.current.data.steps[2].branchLabel).toBe('New');

            // One undo should restore ALL three steps to 'Old'
            act(() => {
                result.current.undo();
            });

            expect(result.current.data.steps[0].branchLabel).toBe('Old');
            expect(result.current.data.steps[1].branchLabel).toBe('Old');
            expect(result.current.data.steps[2].branchLabel).toBe('Old');
        });

        it('should not modify steps not in the updates list', () => {
            const { result } = renderHook(() => usePfdDocument());

            act(() => {
                result.current.setSteps([
                    { ...createEmptyStep('OP 10'), description: 'Step 1' },
                    { ...createEmptyStep('OP 20'), description: 'Step 2' },
                ]);
            });

            const steps = result.current.data.steps;

            act(() => {
                result.current.updateMultipleSteps([
                    { stepId: steps[0].id, field: 'description' as keyof PfdStep, value: 'Updated' },
                ]);
            });

            expect(result.current.data.steps[0].description).toBe('Updated');
            expect(result.current.data.steps[1].description).toBe('Step 2');
        });
    });

    describe('renumber', () => {
        it('should assign sequential OP numbers', () => {
            const { result } = renderHook(() => usePfdDocument());

            act(() => {
                result.current.setSteps([
                    { ...createEmptyStep('OP 10'), stepType: 'storage', description: 'Recepción' },
                    { ...createEmptyStep('OP 25'), stepType: 'operation', description: 'Op 1' },
                    { ...createEmptyStep('OP 45'), stepType: 'operation', description: 'Op 2' },
                    { ...createEmptyStep('OP 90'), stepType: 'storage', description: 'Envío' },
                ]);
            });

            act(() => {
                result.current.renumber();
            });

            expect(result.current.data.steps[0].stepNumber).toBe('REC');
            expect(result.current.data.steps[1].stepNumber).toBe('OP 10');
            expect(result.current.data.steps[2].stepNumber).toBe('OP 20');
            expect(result.current.data.steps[3].stepNumber).toBe('ENV');
        });

        it('should keep transport stepNumber empty', () => {
            const { result } = renderHook(() => usePfdDocument());

            act(() => {
                result.current.setSteps([
                    { ...createEmptyStep('OP 10'), stepType: 'storage', description: 'Recepción' },
                    { ...createEmptyStep('OP 15'), stepType: 'transport', description: 'Transporte' },
                    { ...createEmptyStep('OP 20'), stepType: 'operation', description: 'Op 1' },
                    { ...createEmptyStep('OP 50'), stepType: 'storage', description: 'Envío' },
                ]);
            });

            act(() => {
                result.current.renumber();
            });

            expect(result.current.data.steps[1].stepNumber).toBe('');
            expect(result.current.data.steps[1].stepType).toBe('transport');
        });

        it('should keep first storage as REC and last as ENV', () => {
            const { result } = renderHook(() => usePfdDocument());

            act(() => {
                result.current.setSteps([
                    { ...createEmptyStep('OP 10'), stepType: 'storage', description: 'Recepción' },
                    { ...createEmptyStep('OP 20'), stepType: 'operation', description: 'Op 1' },
                    { ...createEmptyStep('OP 30'), stepType: 'storage', description: 'Envío' },
                ]);
            });

            act(() => {
                result.current.renumber();
            });

            expect(result.current.data.steps[0].stepNumber).toBe('REC');
            expect(result.current.data.steps[2].stepNumber).toBe('ENV');
        });

        it('should be undoable', () => {
            const { result } = renderHook(() => usePfdDocument());

            act(() => {
                result.current.setSteps([
                    { ...createEmptyStep('OP 10'), stepType: 'storage', description: 'Recepción' },
                    { ...createEmptyStep('OP 25'), stepType: 'operation', description: 'Op 1' },
                    { ...createEmptyStep('OP 50'), stepType: 'storage', description: 'Envío' },
                ]);
            });

            const originalNumbers = result.current.data.steps.map(s => s.stepNumber);

            act(() => {
                result.current.renumber();
            });

            // After renumber, numbers are different
            expect(result.current.data.steps.map(s => s.stepNumber)).not.toEqual(originalNumbers);

            // Undo should restore original numbers
            act(() => {
                result.current.undo();
            });

            expect(result.current.data.steps.map(s => s.stepNumber)).toEqual(originalNumbers);
        });
    });
});
