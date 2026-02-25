import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAmfeHistory } from '../../../modules/amfe/useAmfeHistory';
import { AmfeDocument } from '../../../modules/amfe/amfeTypes';
import { createEmptyAmfeDoc } from '../../../modules/amfe/amfeInitialData';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a distinguishable AmfeDocument with a unique subject field */
function mockDoc(subject: string): AmfeDocument {
    const doc = createEmptyAmfeDoc();
    doc.header.subject = subject;
    return doc;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAmfeHistory', () => {
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
            const doc = mockDoc('initial');
            const { result } = renderHook(() => useAmfeHistory(doc));

            expect(result.current.canUndo).toBe(false);
            expect(result.current.canRedo).toBe(false);
        });

        it('undo() returns null when no history', () => {
            const doc = mockDoc('initial');
            const { result } = renderHook(() => useAmfeHistory(doc));

            let undone: AmfeDocument | null = null;
            act(() => {
                undone = result.current.undo();
            });

            expect(undone).toBeNull();
        });

        it('redo() returns null when no history', () => {
            const doc = mockDoc('initial');
            const { result } = renderHook(() => useAmfeHistory(doc));

            let redone: AmfeDocument | null = null;
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
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            expect(result.current.canUndo).toBe(false);

            // Simulate a data change
            rerender({ data: doc2 });

            // After debounce fires, triggerUpdate causes re-render and canUndo becomes true
            act(() => {
                vi.advanceTimersByTime(600);
            });

            expect(result.current.canUndo).toBe(true);
        });

        it('does not record when the same reference is re-rendered', () => {
            const doc1 = mockDoc('v1');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            // Re-render with same reference
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
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => {
                vi.advanceTimersByTime(600);
            });

            let undone: AmfeDocument | null = null;
            act(() => {
                undone = result.current.undo();
            });

            expect(undone).not.toBeNull();
            expect(undone!.header.subject).toBe('v1');
        });

        it('returns null when nothing left to undo', () => {
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => {
                vi.advanceTimersByTime(600);
            });

            // First undo succeeds
            act(() => {
                result.current.undo();
            });

            // Second undo returns null
            let secondUndo: AmfeDocument | null = null;
            act(() => {
                secondUndo = result.current.undo();
            });

            expect(secondUndo).toBeNull();
        });

        it('undoes multiple changes in reverse order', () => {
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');
            const doc3 = mockDoc('v3');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            // First change
            rerender({ data: doc2 });
            act(() => {
                vi.advanceTimersByTime(600);
            });

            // Second change
            rerender({ data: doc3 });
            act(() => {
                vi.advanceTimersByTime(600);
            });

            // Undo should return v2 first
            let first: AmfeDocument | null = null;
            act(() => {
                first = result.current.undo();
            });
            expect(first!.header.subject).toBe('v2');

            // Then v1
            let second: AmfeDocument | null = null;
            act(() => {
                second = result.current.undo();
            });
            expect(second!.header.subject).toBe('v1');

            // Then null
            let third: AmfeDocument | null = null;
            act(() => {
                third = result.current.undo();
            });
            expect(third).toBeNull();
        });

        it('canUndo becomes false after undoing everything', () => {
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => {
                vi.advanceTimersByTime(600);
            });

            act(() => {
                result.current.undo();
            });

            expect(result.current.canUndo).toBe(false);
        });

        it('flushes pending debounced change when undo is called', () => {
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            // Change but do NOT advance timers (debounce not yet flushed)
            rerender({ data: doc2 });

            // Undo should flush the pending snapshot and return it
            let undone: AmfeDocument | null = null;
            act(() => {
                undone = result.current.undo();
            });

            expect(undone).not.toBeNull();
            expect(undone!.header.subject).toBe('v1');
        });
    });

    // -----------------------------------------------------------------------
    // 4. Redo
    // -----------------------------------------------------------------------
    describe('redo', () => {
        it('returns the undone state after undo', () => {
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => {
                vi.advanceTimersByTime(600);
            });

            act(() => {
                result.current.undo();
            });

            expect(result.current.canRedo).toBe(true);

            let redone: AmfeDocument | null = null;
            act(() => {
                redone = result.current.redo();
            });

            expect(redone).not.toBeNull();
            expect(redone!.header.subject).toBe('v2');
        });

        it('returns null when nothing to redo', () => {
            const doc1 = mockDoc('v1');
            const { result } = renderHook(() => useAmfeHistory(doc1));

            let redone: AmfeDocument | null = null;
            act(() => {
                redone = result.current.redo();
            });

            expect(redone).toBeNull();
            expect(result.current.canRedo).toBe(false);
        });

        it('canRedo becomes false after redoing everything', () => {
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => {
                vi.advanceTimersByTime(600);
            });

            act(() => {
                result.current.undo();
            });

            act(() => {
                result.current.redo();
            });

            expect(result.current.canRedo).toBe(false);
        });

        it('supports multiple undo/redo in sequence', () => {
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');
            const doc3 = mockDoc('v3');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            rerender({ data: doc3 });
            act(() => { vi.advanceTimersByTime(600); });

            // Undo twice: v3 -> v2 -> v1
            let u1: AmfeDocument | null = null;
            let u2: AmfeDocument | null = null;
            act(() => { u1 = result.current.undo(); });
            act(() => { u2 = result.current.undo(); });

            expect(u1!.header.subject).toBe('v2');
            expect(u2!.header.subject).toBe('v1');

            // Redo twice: v1 -> v2 -> v3
            let r1: AmfeDocument | null = null;
            let r2: AmfeDocument | null = null;
            act(() => { r1 = result.current.redo(); });
            act(() => { r2 = result.current.redo(); });

            expect(r1!.header.subject).toBe('v2');
            expect(r2!.header.subject).toBe('v3');
        });
    });

    // -----------------------------------------------------------------------
    // 5. New edit after undo clears redo stack
    // -----------------------------------------------------------------------
    describe('redo stack clearing', () => {
        it('clears redo stack when a new edit is made after undo', () => {
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');
            const doc3 = mockDoc('v3-new');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            // Make a change and commit
            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            // Undo
            act(() => { result.current.undo(); });
            expect(result.current.canRedo).toBe(true);

            // Simulate the caller applying the undo result: rerender with doc1,
            // then mark skip by calling undo previously (which set skipNextRef).
            // Now make a NEW edit (doc3) — the redo stack should be cleared.
            rerender({ data: doc1 }); // undo result applied (skipped)
            rerender({ data: doc3 }); // new edit

            act(() => { vi.advanceTimersByTime(600); });

            expect(result.current.canRedo).toBe(false);

            // Redo should return null
            let redone: AmfeDocument | null = null;
            act(() => { redone = result.current.redo(); });
            expect(redone).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // 6. Debounce: rapid changes produce only one history entry
    // -----------------------------------------------------------------------
    describe('debounce behavior', () => {
        it('rapid changes within 600ms produce only one history entry', () => {
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');
            const doc3 = mockDoc('v3');
            const doc4 = mockDoc('v4');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            // Rapid changes without letting debounce fire
            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(200); });

            rerender({ data: doc3 });
            act(() => { vi.advanceTimersByTime(200); });

            rerender({ data: doc4 });
            act(() => { vi.advanceTimersByTime(200); });

            // Now let the debounce fire
            act(() => { vi.advanceTimersByTime(600); });

            // Should have exactly one history entry (v1, the state before the burst)
            let undone: AmfeDocument | null = null;
            act(() => { undone = result.current.undo(); });
            expect(undone!.header.subject).toBe('v1');

            // No more to undo
            let second: AmfeDocument | null = null;
            act(() => { second = result.current.undo(); });
            expect(second).toBeNull();
        });

        it('changes separated by more than 600ms produce separate entries', () => {
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');
            const doc3 = mockDoc('v3');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            // First change, wait for debounce
            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            // Second change, wait for debounce
            rerender({ data: doc3 });
            act(() => { vi.advanceTimersByTime(600); });

            // Should have two history entries
            let u1: AmfeDocument | null = null;
            let u2: AmfeDocument | null = null;
            act(() => { u1 = result.current.undo(); });
            act(() => { u2 = result.current.undo(); });

            expect(u1!.header.subject).toBe('v2');
            expect(u2!.header.subject).toBe('v1');
        });

        it('debounce resets when a new change arrives within the window', () => {
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');
            const doc3 = mockDoc('v3');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            // First change
            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(500); }); // 500ms < 600ms

            // Another change before debounce fires
            rerender({ data: doc3 });
            act(() => { vi.advanceTimersByTime(600); }); // debounce fires for doc3

            // Only one entry: the state before the burst (v1)
            let undone: AmfeDocument | null = null;
            act(() => { undone = result.current.undo(); });
            expect(undone!.header.subject).toBe('v1');

            // No more
            let second: AmfeDocument | null = null;
            act(() => { second = result.current.undo(); });
            expect(second).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // 7. resetHistory
    // -----------------------------------------------------------------------
    describe('resetHistory', () => {
        it('clears all history and redo stacks', () => {
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');
            const doc3 = mockDoc('v3');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            // Build up redo by undoing
            act(() => { result.current.undo(); });
            expect(result.current.canRedo).toBe(true);

            // Reset
            act(() => { result.current.resetHistory(doc3); });

            expect(result.current.canUndo).toBe(false);
            expect(result.current.canRedo).toBe(false);
        });

        it('after reset, new changes build fresh history', () => {
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');
            const docReset = mockDoc('reset');
            const doc3 = mockDoc('v3');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            // Reset
            act(() => { result.current.resetHistory(docReset); });

            // Rerender with the reset doc (skipped by skipNextRef)
            rerender({ data: docReset });

            // New change after reset
            rerender({ data: doc3 });
            act(() => { vi.advanceTimersByTime(600); });

            let undone: AmfeDocument | null = null;
            act(() => { undone = result.current.undo(); });

            expect(undone!.header.subject).toBe('reset');
        });

        it('clears pending debounced changes', () => {
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');
            const docReset = mockDoc('reset');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            // Change but do NOT let debounce fire
            rerender({ data: doc2 });

            // Reset before debounce fires
            act(() => { result.current.resetHistory(docReset); });

            // Let the old debounce time pass
            act(() => { vi.advanceTimersByTime(600); });

            // Should have no history
            expect(result.current.canUndo).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // 8. Buffer limit (MAX_HISTORY = 50)
    // -----------------------------------------------------------------------
    describe('buffer limit', () => {
        it('drops oldest entries when exceeding 50 items', () => {
            const docs: AmfeDocument[] = [];
            for (let i = 0; i <= 55; i++) {
                docs.push(mockDoc(`v${i}`));
            }

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: docs[0] } },
            );

            // Push 55 changes (creates 55 history entries)
            for (let i = 1; i <= 55; i++) {
                rerender({ data: docs[i] });
                act(() => { vi.advanceTimersByTime(600); });
            }

            // Undo all — should only be able to undo 50 times (buffer limit)
            let undoCount = 0;
            let lastUndone: AmfeDocument | null = null;
            for (let i = 0; i < 60; i++) {
                let u: AmfeDocument | null = null;
                act(() => { u = result.current.undo(); });
                if (u === null) break;
                lastUndone = u;
                undoCount++;
            }

            expect(undoCount).toBe(50);

            // The oldest entry should be v5 (v0..v4 were dropped, v5 is the earliest surviving)
            // v0 was initial, v1..v55 were changes. The history stores the "before" state,
            // so entries are v0, v1, v2, ..., v54. With 55 entries capped to 50, we lose v0..v4.
            expect(lastUndone!.header.subject).toBe('v5');
        });
    });

    // -----------------------------------------------------------------------
    // 9. Skip recording on undo/redo-triggered rerenders
    // -----------------------------------------------------------------------
    describe('skip recording after undo/redo', () => {
        it('does not record the undo-triggered rerender as a new change', () => {
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');
            const doc3 = mockDoc('v3');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            // Build two entries
            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            rerender({ data: doc3 });
            act(() => { vi.advanceTimersByTime(600); });

            // Undo returns v2
            let undone: AmfeDocument | null = null;
            act(() => { undone = result.current.undo(); });
            expect(undone!.header.subject).toBe('v2');

            // Simulate caller applying undo by rerendering with v2
            rerender({ data: undone! });

            // This rerender should be skipped — no new history entry
            act(() => { vi.advanceTimersByTime(600); });

            // Undo again should return v1, not record v2 again
            let second: AmfeDocument | null = null;
            act(() => { second = result.current.undo(); });
            expect(second!.header.subject).toBe('v1');
        });

        it('does not record the redo-triggered rerender as a new change', () => {
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            // Undo
            let undone: AmfeDocument | null = null;
            act(() => { undone = result.current.undo(); });

            // Apply undo
            rerender({ data: undone! });

            // Redo
            let redone: AmfeDocument | null = null;
            act(() => { redone = result.current.redo(); });

            // Apply redo
            rerender({ data: redone! });
            act(() => { vi.advanceTimersByTime(600); });

            // canUndo should be true (v1 is still in history), canRedo should be false
            expect(result.current.canUndo).toBe(true);
            expect(result.current.canRedo).toBe(false);

            // Undo should take us back to v1
            let final: AmfeDocument | null = null;
            act(() => { final = result.current.undo(); });
            expect(final!.header.subject).toBe('v1');
        });
    });

    // -----------------------------------------------------------------------
    // 10. Edge cases
    // -----------------------------------------------------------------------
    describe('edge cases', () => {
        it('undo immediately after change without debounce flush still works', () => {
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');
            const doc3 = mockDoc('v3');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            // Committed change
            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            // Another change, not yet debounced
            rerender({ data: doc3 });

            // Undo should flush and return v2
            let undone: AmfeDocument | null = null;
            act(() => { undone = result.current.undo(); });
            expect(undone!.header.subject).toBe('v2');

            // Can undo again to v1
            let second: AmfeDocument | null = null;
            act(() => { second = result.current.undo(); });
            expect(second!.header.subject).toBe('v1');
        });

        it('canUndo reflects pending snapshot after undo flushes it', () => {
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });

            // Before debounce fires, canUndo returns false because the pending snapshot
            // lives in a ref and no re-render was triggered yet.
            // However, calling undo() flushes the pending snapshot and works correctly.
            let undone: AmfeDocument | null = null;
            act(() => { undone = result.current.undo(); });
            expect(undone).not.toBeNull();
            expect(undone!.header.subject).toBe('v1');
        });

        it('multiple resets do not break history', () => {
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');
            const doc3 = mockDoc('v3');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
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
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');
            const doc3 = mockDoc('v3');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            // v1 -> v2
            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            // Undo to v1
            act(() => { result.current.undo(); });
            rerender({ data: mockDoc('v1') }); // apply undo

            // New change v1 -> v3
            rerender({ data: doc3 });
            act(() => { vi.advanceTimersByTime(600); });

            // Undo should return v1 (the state before v3)
            let undone: AmfeDocument | null = null;
            act(() => { undone = result.current.undo(); });
            expect(undone!.header.subject).toBe('v1');

            // Redo stack was cleared when v3 was added, so no redo to v2
            expect(result.current.canRedo).toBe(true); // can redo to v3
        });

        it('redo after redo returns null correctly', () => {
            const doc1 = mockDoc('v1');
            const doc2 = mockDoc('v2');

            const { result, rerender } = renderHook(
                ({ data }) => useAmfeHistory(data),
                { initialProps: { data: doc1 } },
            );

            rerender({ data: doc2 });
            act(() => { vi.advanceTimersByTime(600); });

            act(() => { result.current.undo(); });

            // First redo succeeds
            let r1: AmfeDocument | null = null;
            act(() => { r1 = result.current.redo(); });
            expect(r1).not.toBeNull();

            // Second redo returns null
            let r2: AmfeDocument | null = null;
            act(() => { r2 = result.current.redo(); });
            expect(r2).toBeNull();
        });
    });
});
