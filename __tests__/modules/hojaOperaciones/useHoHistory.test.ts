import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHoHistory } from '../../../modules/hojaOperaciones/useHoHistory';
import type { HoDocument } from '../../../modules/hojaOperaciones/hojaOperacionesTypes';
import { EMPTY_HO_HEADER } from '../../../modules/hojaOperaciones/hojaOperacionesTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockHoDoc(partDescription: string): HoDocument {
    return {
        header: { ...EMPTY_HO_HEADER, partDescription },
        sheets: [],
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useHoHistory', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('starts with canUndo=false', () => {
        const { result } = renderHook(() => useHoHistory(mockHoDoc('init')));
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(false);
    });

    it('records changes and undo returns previous', () => {
        const d1 = mockHoDoc('v1');
        const d2 = mockHoDoc('v2');
        const { result, rerender } = renderHook(
            ({ data }) => useHoHistory(data),
            { initialProps: { data: d1 } },
        );

        rerender({ data: d2 });
        act(() => { vi.advanceTimersByTime(600); });
        expect(result.current.canUndo).toBe(true);

        let undone: HoDocument | null = null;
        act(() => { undone = result.current.undo(); });
        expect(undone!.header.partDescription).toBe('v1');
    });

    it('redo works after undo', () => {
        const d1 = mockHoDoc('v1');
        const d2 = mockHoDoc('v2');
        const { result, rerender } = renderHook(
            ({ data }) => useHoHistory(data),
            { initialProps: { data: d1 } },
        );

        rerender({ data: d2 });
        act(() => { vi.advanceTimersByTime(600); });
        act(() => { result.current.undo(); });
        expect(result.current.canRedo).toBe(true);

        let redone: HoDocument | null = null;
        act(() => { redone = result.current.redo(); });
        expect(redone!.header.partDescription).toBe('v2');
    });

    it('resetHistory clears all stacks', () => {
        const d1 = mockHoDoc('v1');
        const d2 = mockHoDoc('v2');
        const dReset = mockHoDoc('reset');
        const { result, rerender } = renderHook(
            ({ data }) => useHoHistory(data),
            { initialProps: { data: d1 } },
        );

        rerender({ data: d2 });
        act(() => { vi.advanceTimersByTime(600); });

        act(() => { result.current.resetHistory(dReset); });
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(false);
    });

    it('flushPending commits pending snapshot', () => {
        const d1 = mockHoDoc('v1');
        const d2 = mockHoDoc('v2');
        const { result, rerender } = renderHook(
            ({ data }) => useHoHistory(data),
            { initialProps: { data: d1 } },
        );

        rerender({ data: d2 });
        act(() => { result.current.flushPending(); });

        expect(result.current.canUndo).toBe(true);
        let undone: HoDocument | null = null;
        act(() => { undone = result.current.undo(); });
        expect(undone!.header.partDescription).toBe('v1');
    });

    it('undoCount and redoCount track correctly', () => {
        const d1 = mockHoDoc('v1');
        const d2 = mockHoDoc('v2');
        const d3 = mockHoDoc('v3');
        const { result, rerender } = renderHook(
            ({ data }) => useHoHistory(data),
            { initialProps: { data: d1 } },
        );

        rerender({ data: d2 });
        act(() => { vi.advanceTimersByTime(600); });
        rerender({ data: d3 });
        act(() => { vi.advanceTimersByTime(600); });

        expect(result.current.undoCount).toBe(2);
        expect(result.current.redoCount).toBe(0);

        act(() => { result.current.undo(); });
        expect(result.current.undoCount).toBe(1);
        expect(result.current.redoCount).toBe(1);
    });
});
