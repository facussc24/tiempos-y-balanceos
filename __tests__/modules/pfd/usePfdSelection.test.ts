import { renderHook, act } from '@testing-library/react';
import { usePfdSelection } from '../../../modules/pfd/usePfdSelection';
import type { PfdStep } from '../../../modules/pfd/pfdTypes';
import { createEmptyStep } from '../../../modules/pfd/pfdTypes';

function makeStep(overrides?: Partial<PfdStep>): PfdStep {
    return { ...createEmptyStep(), stepNumber: 'OP 10', description: 'Test', ...overrides };
}

describe('usePfdSelection', () => {
    const step1 = makeStep({ id: 'step-1', stepNumber: 'OP 10' });
    const step2 = makeStep({ id: 'step-2', stepNumber: 'OP 20' });
    const step3 = makeStep({ id: 'step-3', stepNumber: 'OP 30' });
    const steps = [step1, step2, step3];

    it('initial state: selectedStepId is null', () => {
        const { result } = renderHook(() =>
            usePfdSelection({ steps })
        );
        expect(result.current.selectedStepId).toBeNull();
    });

    it('selectStep sets the selected step', () => {
        const { result } = renderHook(() =>
            usePfdSelection({ steps })
        );
        act(() => {
            result.current.selectStep('step-2');
        });
        expect(result.current.selectedStepId).toBe('step-2');
    });

    it('selectStep(null) deselects', () => {
        const { result } = renderHook(() =>
            usePfdSelection({ steps })
        );
        act(() => {
            result.current.selectStep('step-1');
        });
        expect(result.current.selectedStepId).toBe('step-1');
        act(() => {
            result.current.selectStep(null);
        });
        expect(result.current.selectedStepId).toBeNull();
    });

    it('ArrowDown selects first step when nothing selected', () => {
        const { result } = renderHook(() =>
            usePfdSelection({ steps })
        );
        act(() => {
            result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        });
        expect(result.current.selectedStepId).toBe('step-1');
    });

    it('ArrowDown moves to next step', () => {
        const { result } = renderHook(() =>
            usePfdSelection({ steps })
        );
        act(() => {
            result.current.selectStep('step-1');
        });
        act(() => {
            result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        });
        expect(result.current.selectedStepId).toBe('step-2');
    });

    it('ArrowUp moves to previous step', () => {
        const { result } = renderHook(() =>
            usePfdSelection({ steps })
        );
        act(() => {
            result.current.selectStep('step-2');
        });
        act(() => {
            result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        });
        expect(result.current.selectedStepId).toBe('step-1');
    });

    it('ArrowUp at first step stays at first', () => {
        const { result } = renderHook(() =>
            usePfdSelection({ steps })
        );
        act(() => {
            result.current.selectStep('step-1');
        });
        act(() => {
            result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        });
        expect(result.current.selectedStepId).toBe('step-1');
    });

    it('ArrowDown at last step stays at last', () => {
        const { result } = renderHook(() =>
            usePfdSelection({ steps })
        );
        act(() => {
            result.current.selectStep('step-3');
        });
        act(() => {
            result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        });
        expect(result.current.selectedStepId).toBe('step-3');
    });

    it('Escape deselects', () => {
        const { result } = renderHook(() =>
            usePfdSelection({ steps })
        );
        act(() => {
            result.current.selectStep('step-2');
        });
        expect(result.current.selectedStepId).toBe('step-2');
        act(() => {
            result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
        });
        expect(result.current.selectedStepId).toBeNull();
    });

    it('Delete calls onRemoveStep with selected step', () => {
        const onRemoveStep = vi.fn();
        const { result } = renderHook(() =>
            usePfdSelection({ steps, onRemoveStep })
        );
        act(() => {
            result.current.selectStep('step-2');
        });
        act(() => {
            result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'Delete' }));
        });
        expect(onRemoveStep).toHaveBeenCalledWith('step-2');
    });

    it('Delete does nothing when nothing selected', () => {
        const onRemoveStep = vi.fn();
        const { result } = renderHook(() =>
            usePfdSelection({ steps, onRemoveStep })
        );
        act(() => {
            result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'Delete' }));
        });
        expect(onRemoveStep).not.toHaveBeenCalled();
    });
});
