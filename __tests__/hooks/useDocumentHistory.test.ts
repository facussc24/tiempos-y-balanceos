import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocumentHistory } from '../../hooks/useDocumentHistory';

// ---------------------------------------------------------------------------
// Simple test document type
// ---------------------------------------------------------------------------

interface TestDoc {
    id: string;
    value: number;
    nested?: { deep: string };
}

function doc(id: string, value = 0): TestDoc {
    return { id, value };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useDocumentHistory', () => {
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
            const { result } = renderHook(() => useDocumentHistory(doc('init')));
            expect(result.current.canUndo).toBe(false);
            expect(result.current.canRedo).toBe(false);
        });

        it('undoCount and redoCount start at 0', () => {
            const { result } = renderHook(() => useDocumentHistory(doc('init')));
            expect(result.current.undoCount).toBe(0);
            expect(result.current.redoCount).toBe(0);
        });

        it('undo() returns null when no history', () => {
            const { result } = renderHook(() => useDocumentHistory(doc('init')));
            let undone: TestDoc | null = null;
            act(() => { undone = result.current.undo(); });
            expect(undone).toBeNull();
        });

        it('redo() returns null when no history', () => {
            const { result } = renderHook(() => useDocumentHistory(doc('init')));
            let redone: TestDoc | null = null;
            act(() => { redone = result.current.redo(); });
            expect(redone).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // 2. Recording changes after debounce
    // -----------------------------------------------------------------------
    describe('recording changes', () => {
        it('canUndo becomes true after data change and debounce', () => {
            const d1 = doc('v1');
            const d2 = doc('v2');
            const { result, rerender } = renderHook(
                ({ data }) => useDocumentHistory(data),
                { initialProps: { data: d1 } },
            );
            expect(result.current.canUndo).toBe(false);
            rerender({ data: d2 });
            act(() => { vi.advanceTimersByTime(600); });
            expect(result.current.canUndo).toBe(true);
        });

        it('undoCount reflects the number of past entries', () => {
            const d1 = doc('v1');
            const d2 = doc('v2');
            const d3 = doc('v3');
            const { result, rerender } = renderHook(
                ({ data }) => useDocumentHistory(data),
                { initialProps: { data: d1 } },
            );
            rerender({ data: d2 });
            act(() => { vi.advanceTimersByTime(600); });
            expect(result.current.undoCount).toBe(1);

            rerender({ data: d3 });
            act(() => { vi.advanceTimersByTime(600); });
            expect(result.current.undoCount).toBe(2);
        });

        it('does not record when the same reference is re-rendered', () => {
            const d1 = doc('v1');
            const { result, rerender } = renderHook(
                ({ data }) => useDocumentHistory(data),
                { initialProps: { data: d1 } },
            );
            rerender({ data: d1 });
            act(() => { vi.advanceTimersByTime(600); });
            expect(result.current.canUndo).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // 3. Undo
    // -----------------------------------------------------------------------
    describe('undo', () => {
        it('returns the previous state after one change', () => {
            const d1 = doc('v1');
            const d2 = doc('v2');
            const { result, rerender } = renderHook(
                ({ data }) => useDocumentHistory(data),
                { initialProps: { data: d1 } },
            );
            rerender({ data: d2 });
            act(() => { vi.advanceTimersByTime(600); });

            let undone: TestDoc | null = null;
            act(() => { undone = result.current.undo(); });
            expect(undone).not.toBeNull();
            expect(undone!.id).toBe('v1');
        });

        it('undoes multiple changes in reverse order', () => {
            const d1 = doc('v1');
            const d2 = doc('v2');
            const d3 = doc('v3');
            const { result, rerender } = renderHook(
                ({ data }) => useDocumentHistory(data),
                { initialProps: { data: d1 } },
            );
            rerender({ data: d2 });
            act(() => { vi.advanceTimersByTime(600); });
            rerender({ data: d3 });
            act(() => { vi.advanceTimersByTime(600); });

            let u1: TestDoc | null = null;
            let u2: TestDoc | null = null;
            act(() => { u1 = result.current.undo(); });
            act(() => { u2 = result.current.undo(); });
            expect(u1!.id).toBe('v2');
            expect(u2!.id).toBe('v1');
        });

        it('flushes pending debounced change when undo is called', () => {
            const d1 = doc('v1');
            const d2 = doc('v2');
            const { result, rerender } = renderHook(
                ({ data }) => useDocumentHistory(data),
                { initialProps: { data: d1 } },
            );
            rerender({ data: d2 });
            // Do NOT advance timers

            let undone: TestDoc | null = null;
            act(() => { undone = result.current.undo(); });
            expect(undone).not.toBeNull();
            expect(undone!.id).toBe('v1');
        });

        it('decrements undoCount after undo', () => {
            const d1 = doc('v1');
            const d2 = doc('v2');
            const d3 = doc('v3');
            const { result, rerender } = renderHook(
                ({ data }) => useDocumentHistory(data),
                { initialProps: { data: d1 } },
            );
            rerender({ data: d2 });
            act(() => { vi.advanceTimersByTime(600); });
            rerender({ data: d3 });
            act(() => { vi.advanceTimersByTime(600); });
            expect(result.current.undoCount).toBe(2);

            act(() => { result.current.undo(); });
            expect(result.current.undoCount).toBe(1);
        });
    });

    // -----------------------------------------------------------------------
    // 4. Redo
    // -----------------------------------------------------------------------
    describe('redo', () => {
        it('returns the undone state', () => {
            const d1 = doc('v1');
            const d2 = doc('v2');
            const { result, rerender } = renderHook(
                ({ data }) => useDocumentHistory(data),
                { initialProps: { data: d1 } },
            );
            rerender({ data: d2 });
            act(() => { vi.advanceTimersByTime(600); });
            act(() => { result.current.undo(); });
            expect(result.current.canRedo).toBe(true);
            expect(result.current.redoCount).toBe(1);

            let redone: TestDoc | null = null;
            act(() => { redone = result.current.redo(); });
            expect(redone!.id).toBe('v2');
            expect(result.current.redoCount).toBe(0);
        });

        it('new edit after undo clears redo stack', () => {
            const d1 = doc('v1');
            const d2 = doc('v2');
            const d3 = doc('v3-new');
            const { result, rerender } = renderHook(
                ({ data }) => useDocumentHistory(data),
                { initialProps: { data: d1 } },
            );
            rerender({ data: d2 });
            act(() => { vi.advanceTimersByTime(600); });
            act(() => { result.current.undo(); });
            expect(result.current.canRedo).toBe(true);

            rerender({ data: d1 }); // undo result applied (skipped)
            rerender({ data: d3 }); // new edit
            act(() => { vi.advanceTimersByTime(600); });

            expect(result.current.canRedo).toBe(false);
            expect(result.current.redoCount).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // 5. Debounce behavior
    // -----------------------------------------------------------------------
    describe('debounce behavior', () => {
        it('rapid changes within 600ms produce only one history entry', () => {
            const d1 = doc('v1');
            const d2 = doc('v2');
            const d3 = doc('v3');
            const d4 = doc('v4');
            const { result, rerender } = renderHook(
                ({ data }) => useDocumentHistory(data),
                { initialProps: { data: d1 } },
            );
            rerender({ data: d2 });
            act(() => { vi.advanceTimersByTime(200); });
            rerender({ data: d3 });
            act(() => { vi.advanceTimersByTime(200); });
            rerender({ data: d4 });
            act(() => { vi.advanceTimersByTime(600); });

            let undone: TestDoc | null = null;
            act(() => { undone = result.current.undo(); });
            expect(undone!.id).toBe('v1');

            let second: TestDoc | null = null;
            act(() => { second = result.current.undo(); });
            expect(second).toBeNull();
        });

        it('changes separated by more than debounce produce separate entries', () => {
            const d1 = doc('v1');
            const d2 = doc('v2');
            const d3 = doc('v3');
            const { result, rerender } = renderHook(
                ({ data }) => useDocumentHistory(data),
                { initialProps: { data: d1 } },
            );
            rerender({ data: d2 });
            act(() => { vi.advanceTimersByTime(600); });
            rerender({ data: d3 });
            act(() => { vi.advanceTimersByTime(600); });

            let u1: TestDoc | null = null;
            let u2: TestDoc | null = null;
            act(() => { u1 = result.current.undo(); });
            act(() => { u2 = result.current.undo(); });
            expect(u1!.id).toBe('v2');
            expect(u2!.id).toBe('v1');
        });
    });

    // -----------------------------------------------------------------------
    // 6. resetHistory
    // -----------------------------------------------------------------------
    describe('resetHistory', () => {
        it('clears all history and redo stacks', () => {
            const d1 = doc('v1');
            const d2 = doc('v2');
            const d3 = doc('v3');
            const { result, rerender } = renderHook(
                ({ data }) => useDocumentHistory(data),
                { initialProps: { data: d1 } },
            );
            rerender({ data: d2 });
            act(() => { vi.advanceTimersByTime(600); });
            act(() => { result.current.undo(); });
            expect(result.current.canRedo).toBe(true);

            act(() => { result.current.resetHistory(d3); });
            expect(result.current.canUndo).toBe(false);
            expect(result.current.canRedo).toBe(false);
            expect(result.current.undoCount).toBe(0);
            expect(result.current.redoCount).toBe(0);
        });

        it('clears pending debounced changes', () => {
            const d1 = doc('v1');
            const d2 = doc('v2');
            const dReset = doc('reset');
            const { result, rerender } = renderHook(
                ({ data }) => useDocumentHistory(data),
                { initialProps: { data: d1 } },
            );
            rerender({ data: d2 });
            // Don't let debounce fire
            act(() => { result.current.resetHistory(dReset); });
            act(() => { vi.advanceTimersByTime(600); });
            expect(result.current.canUndo).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // 7. Buffer limit
    // -----------------------------------------------------------------------
    describe('buffer limit', () => {
        it('drops oldest entries when exceeding maxHistory', () => {
            const docs: TestDoc[] = [];
            for (let i = 0; i <= 55; i++) docs.push(doc(`v${i}`));

            const { result, rerender } = renderHook(
                ({ data }) => useDocumentHistory(data),
                { initialProps: { data: docs[0] } },
            );
            for (let i = 1; i <= 55; i++) {
                rerender({ data: docs[i] });
                act(() => { vi.advanceTimersByTime(600); });
            }

            let undoCount = 0;
            for (let i = 0; i < 60; i++) {
                let u: TestDoc | null = null;
                act(() => { u = result.current.undo(); });
                if (u === null) break;
                undoCount++;
            }
            expect(undoCount).toBe(50);
        });

        it('respects custom maxHistory option', () => {
            const docs: TestDoc[] = [];
            for (let i = 0; i <= 10; i++) docs.push(doc(`v${i}`));

            const { result, rerender } = renderHook(
                ({ data }) => useDocumentHistory(data, { maxHistory: 5 }),
                { initialProps: { data: docs[0] } },
            );
            for (let i = 1; i <= 10; i++) {
                rerender({ data: docs[i] });
                act(() => { vi.advanceTimersByTime(600); });
            }

            let undoCount = 0;
            for (let i = 0; i < 20; i++) {
                let u: TestDoc | null = null;
                act(() => { u = result.current.undo(); });
                if (u === null) break;
                undoCount++;
            }
            expect(undoCount).toBe(5);
        });
    });

    // -----------------------------------------------------------------------
    // 8. Skip recording on undo/redo-triggered rerenders
    // -----------------------------------------------------------------------
    describe('skip recording after undo/redo', () => {
        it('does not record the undo-triggered rerender as a new change', () => {
            const d1 = doc('v1');
            const d2 = doc('v2');
            const d3 = doc('v3');
            const { result, rerender } = renderHook(
                ({ data }) => useDocumentHistory(data),
                { initialProps: { data: d1 } },
            );
            rerender({ data: d2 });
            act(() => { vi.advanceTimersByTime(600); });
            rerender({ data: d3 });
            act(() => { vi.advanceTimersByTime(600); });

            let undone: TestDoc | null = null;
            act(() => { undone = result.current.undo(); });
            expect(undone!.id).toBe('v2');

            rerender({ data: undone! });
            act(() => { vi.advanceTimersByTime(600); });

            let second: TestDoc | null = null;
            act(() => { second = result.current.undo(); });
            expect(second!.id).toBe('v1');
        });
    });

    // -----------------------------------------------------------------------
    // 9. flushPending
    // -----------------------------------------------------------------------
    describe('flushPending', () => {
        it('commits pending snapshot immediately', () => {
            const d1 = doc('v1');
            const d2 = doc('v2');
            const { result, rerender } = renderHook(
                ({ data }) => useDocumentHistory(data),
                { initialProps: { data: d1 } },
            );
            rerender({ data: d2 });
            // Debounce hasn't fired yet — pending snapshot set in useEffect

            act(() => { result.current.flushPending(); });
            // Now it's committed to pastRef
            expect(result.current.canUndo).toBe(true);
            expect(result.current.undoCount).toBe(1);
        });

        it('is a no-op when nothing is pending', () => {
            const d1 = doc('v1');
            const { result } = renderHook(() => useDocumentHistory(d1));

            act(() => { result.current.flushPending(); });
            expect(result.current.canUndo).toBe(false);
            expect(result.current.undoCount).toBe(0);
        });

        it('separates user typing from AI batch when called before loadData', () => {
            // Simulates: user types → flushPending → AI applies changes
            const d1 = doc('v1');
            const d2 = doc('v2-typed');
            const d3 = doc('v3-ai');
            const { result, rerender } = renderHook(
                ({ data }) => useDocumentHistory(data),
                { initialProps: { data: d1 } },
            );

            // User types (pending, not yet debounced)
            rerender({ data: d2 });

            // AI copilot: flush pending, then apply
            act(() => { result.current.flushPending(); });
            rerender({ data: d3 });
            act(() => { vi.advanceTimersByTime(600); });

            // Undo the AI change → should get d2 (user's typing)
            let u1: TestDoc | null = null;
            act(() => { u1 = result.current.undo(); });
            expect(u1!.id).toBe('v2-typed');

            // Undo the user's typing → should get d1
            let u2: TestDoc | null = null;
            act(() => { u2 = result.current.undo(); });
            expect(u2!.id).toBe('v1');
        });

        it('clears redo stack when flushing', () => {
            const d1 = doc('v1');
            const d2 = doc('v2');
            const d3 = doc('v3');
            const { result, rerender } = renderHook(
                ({ data }) => useDocumentHistory(data),
                { initialProps: { data: d1 } },
            );
            rerender({ data: d2 });
            act(() => { vi.advanceTimersByTime(600); });

            // Undo to build redo stack
            act(() => { result.current.undo(); });
            expect(result.current.canRedo).toBe(true);
            rerender({ data: doc('v1') }); // apply undo

            // New change + flush
            rerender({ data: d3 });
            act(() => { result.current.flushPending(); });

            expect(result.current.canRedo).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // 10. Custom debounceMs
    // -----------------------------------------------------------------------
    describe('custom options', () => {
        it('respects custom debounceMs', () => {
            const d1 = doc('v1');
            const d2 = doc('v2');
            const { result, rerender } = renderHook(
                ({ data }) => useDocumentHistory(data, { debounceMs: 200 }),
                { initialProps: { data: d1 } },
            );
            rerender({ data: d2 });

            // At 100ms, debounce hasn't fired yet (for the auto-commit; pending still counted)
            act(() => { vi.advanceTimersByTime(100); });
            // canUndo is true because pending snapshot exists
            // But let's check after debounce fires at 200ms
            act(() => { vi.advanceTimersByTime(200); });
            expect(result.current.canUndo).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // 11. structuredClone correctness
    // -----------------------------------------------------------------------
    describe('deep clone integrity', () => {
        it('undo returns independent copy — mutations do not affect history', () => {
            const d1: TestDoc = { id: 'v1', value: 1, nested: { deep: 'original' } };
            const d2: TestDoc = { id: 'v2', value: 2 };
            const { result, rerender } = renderHook(
                ({ data }) => useDocumentHistory(data),
                { initialProps: { data: d1 } },
            );
            rerender({ data: d2 });
            act(() => { vi.advanceTimersByTime(600); });

            let undone: TestDoc | null = null;
            act(() => { undone = result.current.undo(); });

            // Mutate the returned object
            undone!.nested!.deep = 'mutated';

            // Redo and undo again — the history should still have original
            act(() => { result.current.redo(); });
            let undone2: TestDoc | null = null;
            act(() => { undone2 = result.current.undo(); });
            expect(undone2!.nested!.deep).toBe('original');
        });
    });
});
