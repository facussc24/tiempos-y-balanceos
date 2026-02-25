import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCpHistory } from '../../../modules/controlPlan/useCpHistory';
import { ControlPlanDocument, EMPTY_CP_DOCUMENT } from '../../../modules/controlPlan/controlPlanTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a distinguishable ControlPlanDocument with a unique partName */
function mockCpDoc(partName: string): ControlPlanDocument {
    return {
        header: { ...EMPTY_CP_DOCUMENT.header, partName },
        items: [],
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCpHistory', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // -----------------------------------------------------------------------
    // 1. Initial state
    // -----------------------------------------------------------------------
    describe('initial state', () => {
        it('starts with canUndo=false and canRedo=false', () => {
            const doc = mockCpDoc('initial');
            const { result } = renderHook(() => useCpHistory(doc));

            expect(result.current.canUndo).toBe(false);
            expect(result.current.canRedo).toBe(false);
        });

        it('undo() returns null when no history', () => {
            const doc = mockCpDoc('initial');
            const { result } = renderHook(() => useCpHistory(doc));

            let undone: ControlPlanDocument | null = null;
            act(() => {
                undone = result.current.undo();
            });

            expect(undone).toBeNull();
        });

        it('redo() returns null when no history', () => {
            const doc = mockCpDoc('initial');
            const { result } = renderHook(() => useCpHistory(doc));

            let redone: ControlPlanDocument | null = null;
            act(() => {
                redone = result.current.redo();
            });

            expect(redone).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // 2. Recording changes after debounce
    // -----------------------------------------------------------------------
    describe('recording changes', () => {
        it('canUndo becomes true after data change and debounce', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            expect(result.current.canUndo).toBe(false);

            rerender({ data: doc2 });

            act(() => {
                vi.advanceTimersByTime(600);
            });

            expect(result.current.canUndo).toBe(true);
        });

        it('does not record when the same reference is re-rendered', () => {
            const doc1 = mockCpDoc('v1');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc1 });

            act(() => {
                vi.advanceTimersByTime(600);
            });

            expect(result.current.canUndo).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // 3. Undo
    // -----------------------------------------------------------------------
    describe('undo', () => {
        it('returns the previous state after one change', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => {
                vi.advanceTimersByTime(600);
            });

            let undone: ControlPlanDocument | null = null;
            act(() => {
                undone = result.current.undo();
            });

            expect(undone).not.toBeNull();
            expect(undone!.header.partName).toBe('v1');
        });

        it('returns null when nothing left to undo', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => {
                vi.advanceTimersByTime(600);
            });

            act(() => {
                result.current.undo();
            });

            let secondUndo: ControlPlanDocument | null = null;
            act(() => {
                secondUndo = result.current.undo();
            });

            expect(secondUndo).toBeNull();
        });

        it('undoes multiple changes in reverse order', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');
            const doc3 = mockCpDoc('v3');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            rerender({ data: doc3 });
            act(() => { vi.advanceTimersByTime(600); });

            let first: ControlPlanDocument | null = null;
            act(() => { first = result.current.undo(); });
            expect(first!.header.partName).toBe('v2');

            let second: ControlPlanDocument | null = null;
            act(() => { second = result.current.undo(); });
            expect(second!.header.partName).toBe('v1');

            let third: ControlPlanDocument | null = null;
            act(() => { third = result.current.undo(); });
            expect(third).toBeNull();
        });

        it('canUndo becomes false after undoing everything', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            act(() => { result.current.undo(); });

            expect(result.current.canUndo).toBe(false);
        });

        it('flushes pending debounced change when undo is called', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });

            let undone: ControlPlanDocument | null = null;
            act(() => { undone = result.current.undo(); });

            expect(undone).not.toBeNull();
            expect(undone!.header.partName).toBe('v1');
        });
    });

    // -----------------------------------------------------------------------
    // 4. Redo
    // -----------------------------------------------------------------------
    describe('redo', () => {
        it('returns the undone state after undo', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            act(() => { result.current.undo(); });

            expect(result.current.canRedo).toBe(true);

            let redone: ControlPlanDocument | null = null;
            act(() => { redone = result.current.redo(); });

            expect(redone).not.toBeNull();
            expect(redone!.header.partName).toBe('v2');
        });

        it('returns null when nothing to redo', () => {
            const doc1 = mockCpDoc('v1');
            const { result } = renderHook(() => useCpHistory(doc1));

            let redone: ControlPlanDocument | null = null;
            act(() => { redone = result.current.redo(); });

            expect(redone).toBeNull();
            expect(result.current.canRedo).toBe(false);
        });

        it('canRedo becomes false after redoing everything', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            act(() => { result.current.undo(); });
            act(() => { result.current.redo(); });

            expect(result.current.canRedo).toBe(false);
        });

        it('supports multiple undo/redo in sequence', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');
            const doc3 = mockCpDoc('v3');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            rerender({ data: doc3 });
            act(() => { vi.advanceTimersByTime(600); });

            let u1: ControlPlanDocument | null = null;
            let u2: ControlPlanDocument | null = null;
            act(() => { u1 = result.current.undo(); });
            act(() => { u2 = result.current.undo(); });

            expect(u1!.header.partName).toBe('v2');
            expect(u2!.header.partName).toBe('v1');

            let r1: ControlPlanDocument | null = null;
            let r2: ControlPlanDocument | null = null;
            act(() => { r1 = result.current.redo(); });
            act(() => { r2 = result.current.redo(); });

            expect(r1!.header.partName).toBe('v2');
            expect(r2!.header.partName).toBe('v3');
        });
    });

    // -----------------------------------------------------------------------
    // 5. Redo stack clearing
    // -----------------------------------------------------------------------
    describe('redo stack clearing', () => {
        it('clears redo stack when a new edit is made after undo', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');
            const doc3 = mockCpDoc('v3-new');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            act(() => { result.current.undo(); });
            expect(result.current.canRedo).toBe(true);

            rerender({ data: doc1 }); // undo result applied (skipped)
            rerender({ data: doc3 }); // new edit

            act(() => { vi.advanceTimersByTime(600); });

            expect(result.current.canRedo).toBe(false);

            let redone: ControlPlanDocument | null = null;
            act(() => { redone = result.current.redo(); });
            expect(redone).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // 6. Debounce behavior
    // -----------------------------------------------------------------------
    describe('debounce behavior', () => {
        it('rapid changes within 600ms produce only one history entry', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');
            const doc3 = mockCpDoc('v3');
            const doc4 = mockCpDoc('v4');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(200); });

            rerender({ data: doc3 });
            act(() => { vi.advanceTimersByTime(200); });

            rerender({ data: doc4 });
            act(() => { vi.advanceTimersByTime(200); });

            act(() => { vi.advanceTimersByTime(600); });

            let undone: ControlPlanDocument | null = null;
            act(() => { undone = result.current.undo(); });
            expect(undone!.header.partName).toBe('v1');

            let second: ControlPlanDocument | null = null;
            act(() => { second = result.current.undo(); });
            expect(second).toBeNull();
        });

        it('changes separated by more than 600ms produce separate entries', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');
            const doc3 = mockCpDoc('v3');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            rerender({ data: doc3 });
            act(() => { vi.advanceTimersByTime(600); });

            let u1: ControlPlanDocument | null = null;
            let u2: ControlPlanDocument | null = null;
            act(() => { u1 = result.current.undo(); });
            act(() => { u2 = result.current.undo(); });

            expect(u1!.header.partName).toBe('v2');
            expect(u2!.header.partName).toBe('v1');
        });

        it('debounce resets when a new change arrives within the window', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');
            const doc3 = mockCpDoc('v3');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(500); });

            rerender({ data: doc3 });
            act(() => { vi.advanceTimersByTime(600); });

            let undone: ControlPlanDocument | null = null;
            act(() => { undone = result.current.undo(); });
            expect(undone!.header.partName).toBe('v1');

            let second: ControlPlanDocument | null = null;
            act(() => { second = result.current.undo(); });
            expect(second).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // 7. resetHistory
    // -----------------------------------------------------------------------
    describe('resetHistory', () => {
        it('clears all history and redo stacks', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');
            const doc3 = mockCpDoc('v3');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            act(() => { result.current.undo(); });
            expect(result.current.canRedo).toBe(true);

            act(() => { result.current.resetHistory(doc3); });

            expect(result.current.canUndo).toBe(false);
            expect(result.current.canRedo).toBe(false);
        });

        it('after reset, new changes build fresh history', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');
            const docReset = mockCpDoc('reset');
            const doc3 = mockCpDoc('v3');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            act(() => { result.current.resetHistory(docReset); });

            rerender({ data: docReset });

            rerender({ data: doc3 });
            act(() => { vi.advanceTimersByTime(600); });

            let undone: ControlPlanDocument | null = null;
            act(() => { undone = result.current.undo(); });

            expect(undone!.header.partName).toBe('reset');
        });

        it('clears pending debounced changes', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');
            const docReset = mockCpDoc('reset');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });

            act(() => { result.current.resetHistory(docReset); });

            act(() => { vi.advanceTimersByTime(600); });

            expect(result.current.canUndo).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // 8. Buffer limit (MAX_HISTORY = 50)
    // -----------------------------------------------------------------------
    describe('buffer limit', () => {
        it('drops oldest entries when exceeding 50 items', () => {
            const docs: ControlPlanDocument[] = [];
            for (let i = 0; i <= 55; i++) {
                docs.push(mockCpDoc(`v${i}`));
            }

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: docs[0] } },
            );

            for (let i = 1; i <= 55; i++) {
                rerender({ data: docs[i] });
                act(() => { vi.advanceTimersByTime(600); });
            }

            let undoCount = 0;
            let lastUndone: ControlPlanDocument | null = null;
            for (let i = 0; i < 60; i++) {
                let u: ControlPlanDocument | null = null;
                act(() => { u = result.current.undo(); });
                if (u === null) break;
                lastUndone = u;
                undoCount++;
            }

            expect(undoCount).toBe(50);
            expect(lastUndone!.header.partName).toBe('v5');
        });
    });

    // -----------------------------------------------------------------------
    // 9. Skip recording after undo/redo
    // -----------------------------------------------------------------------
    describe('skip recording after undo/redo', () => {
        it('does not record the undo-triggered rerender as a new change', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');
            const doc3 = mockCpDoc('v3');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            rerender({ data: doc3 });
            act(() => { vi.advanceTimersByTime(600); });

            let undone: ControlPlanDocument | null = null;
            act(() => { undone = result.current.undo(); });
            expect(undone!.header.partName).toBe('v2');

            rerender({ data: undone! });

            act(() => { vi.advanceTimersByTime(600); });

            let second: ControlPlanDocument | null = null;
            act(() => { second = result.current.undo(); });
            expect(second!.header.partName).toBe('v1');
        });

        it('does not record the redo-triggered rerender as a new change', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            let undone: ControlPlanDocument | null = null;
            act(() => { undone = result.current.undo(); });

            rerender({ data: undone! });

            let redone: ControlPlanDocument | null = null;
            act(() => { redone = result.current.redo(); });

            rerender({ data: redone! });
            act(() => { vi.advanceTimersByTime(600); });

            expect(result.current.canUndo).toBe(true);
            expect(result.current.canRedo).toBe(false);

            let final: ControlPlanDocument | null = null;
            act(() => { final = result.current.undo(); });
            expect(final!.header.partName).toBe('v1');
        });
    });

    // -----------------------------------------------------------------------
    // 10. Edge cases
    // -----------------------------------------------------------------------
    describe('edge cases', () => {
        it('undo immediately after change without debounce flush still works', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');
            const doc3 = mockCpDoc('v3');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            rerender({ data: doc3 });

            let undone: ControlPlanDocument | null = null;
            act(() => { undone = result.current.undo(); });
            expect(undone!.header.partName).toBe('v2');

            let second: ControlPlanDocument | null = null;
            act(() => { second = result.current.undo(); });
            expect(second!.header.partName).toBe('v1');
        });

        it('canUndo reflects pending snapshot after undo flushes it', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });

            let undone: ControlPlanDocument | null = null;
            act(() => { undone = result.current.undo(); });
            expect(undone).not.toBeNull();
            expect(undone!.header.partName).toBe('v1');
        });

        it('multiple resets do not break history', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');
            const doc3 = mockCpDoc('v3');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            act(() => { result.current.resetHistory(doc2); });
            rerender({ data: doc2 });

            act(() => { result.current.resetHistory(doc3); });
            rerender({ data: doc3 });

            expect(result.current.canUndo).toBe(false);
            expect(result.current.canRedo).toBe(false);
        });

        it('undo then new change then undo works correctly', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');
            const doc3 = mockCpDoc('v3');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            act(() => { result.current.undo(); });
            rerender({ data: mockCpDoc('v1') });

            rerender({ data: doc3 });
            act(() => { vi.advanceTimersByTime(600); });

            let undone: ControlPlanDocument | null = null;
            act(() => { undone = result.current.undo(); });
            expect(undone!.header.partName).toBe('v1');

            expect(result.current.canRedo).toBe(true);
        });

        it('redo after redo returns null correctly', () => {
            const doc1 = mockCpDoc('v1');
            const doc2 = mockCpDoc('v2');

            const { result, rerender } = renderHook(
                ({ data }) => useCpHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            act(() => { result.current.undo(); });

            let r1: ControlPlanDocument | null = null;
            act(() => { r1 = result.current.redo(); });
            expect(r1).not.toBeNull();

            let r2: ControlPlanDocument | null = null;
            act(() => { r2 = result.current.redo(); });
            expect(r2).toBeNull();
        });
    });
});
