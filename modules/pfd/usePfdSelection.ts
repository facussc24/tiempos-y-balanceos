/**
 * PFD Selection Hook — Step selection and keyboard navigation
 *
 * Manages which step is currently selected in the flow editor and
 * provides keyboard handlers for navigation (arrows), deletion (Delete),
 * deselection (Escape), and focus (Enter).
 *
 * The consumer decides where to attach the keydown handler —
 * this hook does NOT add any event listeners itself.
 */

import { useState, useCallback, useMemo } from 'react';
import type { PfdStep } from './pfdTypes';

export interface UsePfdSelectionParams {
    steps: PfdStep[];
    onInsertAfter?: (stepId: string) => void;
    onRemoveStep?: (stepId: string) => void;
}

export interface UsePfdSelectionReturn {
    selectedStepId: string | null;
    selectStep: (stepId: string | null) => void;
    handleKeyDown: (e: KeyboardEvent) => void;
}

export function usePfdSelection({
    steps,
    onRemoveStep,
}: UsePfdSelectionParams): UsePfdSelectionReturn {
    const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

    const stepIds = useMemo(() => steps.map(s => s.id), [steps]);

    const selectStep = useCallback((stepId: string | null) => {
        setSelectedStepId(stepId);
    }, []);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown': {
                e.preventDefault();
                if (stepIds.length === 0) return;
                if (selectedStepId === null) {
                    // Nothing selected — select first step
                    setSelectedStepId(stepIds[0]);
                } else {
                    const idx = stepIds.indexOf(selectedStepId);
                    if (idx === -1) {
                        setSelectedStepId(stepIds[0]);
                    } else if (idx < stepIds.length - 1) {
                        setSelectedStepId(stepIds[idx + 1]);
                    }
                    // At last step — stay at last
                }
                break;
            }

            case 'ArrowUp': {
                e.preventDefault();
                if (stepIds.length === 0) return;
                if (selectedStepId === null) return;
                const idx = stepIds.indexOf(selectedStepId);
                if (idx > 0) {
                    setSelectedStepId(stepIds[idx - 1]);
                }
                // At first step — stay at first
                break;
            }

            case 'Escape': {
                setSelectedStepId(null);
                break;
            }

            case 'Delete': {
                if (selectedStepId && onRemoveStep) {
                    onRemoveStep(selectedStepId);
                }
                break;
            }

            case 'Enter': {
                if (selectedStepId) {
                    const row = document.querySelector(`[data-step-id="${selectedStepId}"]`);
                    if (row) {
                        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // Focus the detail panel or first input in the row
                        const input = row.querySelector('input, textarea, select') as HTMLElement | null;
                        if (input) input.focus();
                    }
                }
                break;
            }
        }
    }, [selectedStepId, stepIds, onRemoveStep]);

    return {
        selectedStepId,
        selectStep,
        handleKeyDown,
    };
}
