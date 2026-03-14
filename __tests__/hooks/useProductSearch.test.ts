/**
 * Tests for useProductSearch hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProductSearch } from '../../hooks/useProductSearch';

// Mock the repository
vi.mock('../../utils/repositories/productRepository', () => ({
    listProducts: vi.fn().mockResolvedValue([]),
    listCustomerLines: vi.fn().mockResolvedValue([
        { id: 1, code: '020', name: 'PWA', productCount: 165, isAutomotive: true, active: true, createdAt: '' },
        { id: 2, code: '095', name: 'VOLKSWAGEN', productCount: 122, isAutomotive: true, active: true, createdAt: '' },
    ]),
}));

import { listProducts, listCustomerLines } from '../../utils/repositories/productRepository';

const mockProduct = (codigo: string, desc: string, linea = 'PWA') => ({
    id: 1, codigo, descripcion: desc, lineaCode: '020', lineaName: linea,
    active: true, createdAt: '', updatedAt: '',
});

describe('useProductSearch', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // Reset mocks fully (including once queues) then restore defaults
        vi.mocked(listProducts).mockReset().mockResolvedValue([]);
        vi.mocked(listCustomerLines).mockReset().mockResolvedValue([
            { id: 1, code: '020', name: 'PWA', productCount: 165, isAutomotive: true, active: true, createdAt: '' },
            { id: 2, code: '095', name: 'VOLKSWAGEN', productCount: 122, isAutomotive: true, active: true, createdAt: '' },
        ]);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('loads customer lines on mount', async () => {
        const { result } = renderHook(() => useProductSearch());
        // Flush the async effect
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        expect(listCustomerLines).toHaveBeenCalledTimes(1);
        expect(result.current.customerLines).toHaveLength(2);
        expect(result.current.customerLines[0].name).toBe('PWA');
    });

    it('starts with empty query and results', () => {
        const { result } = renderHook(() => useProductSearch());
        expect(result.current.query).toBe('');
        expect(result.current.results).toEqual([]);
        expect(result.current.isLoading).toBe(false);
    });

    it('does not search with less than 2 characters', async () => {
        const { result } = renderHook(() => useProductSearch());
        act(() => { result.current.setQuery('a'); });
        await act(async () => { await vi.advanceTimersByTimeAsync(300); });
        expect(listProducts).not.toHaveBeenCalled();
        expect(result.current.results).toEqual([]);
    });

    it('searches after debounce delay with 2+ chars', async () => {
        const products = [mockProduct('40-001', 'Pieza A')];
        vi.mocked(listProducts).mockResolvedValueOnce(products);

        const { result } = renderHook(() => useProductSearch());
        act(() => { result.current.setQuery('40-'); });

        // Before debounce
        expect(result.current.isLoading).toBe(true);
        expect(listProducts).not.toHaveBeenCalled();

        // After debounce (200ms default)
        await act(async () => { await vi.advanceTimersByTimeAsync(200); });
        expect(listProducts).toHaveBeenCalledWith({
            search: '40-',
            lineaCode: undefined,
            limit: 30,
            activeOnly: true,
        });
        expect(result.current.results).toEqual(products);
        expect(result.current.isLoading).toBe(false);
    });

    it('uses custom debounce delay', async () => {
        vi.mocked(listProducts).mockResolvedValueOnce([]);

        const { result } = renderHook(() => useProductSearch({ debounceMs: 500 }));
        act(() => { result.current.setQuery('test'); });

        await act(async () => { await vi.advanceTimersByTimeAsync(200); });
        expect(listProducts).not.toHaveBeenCalled();

        await act(async () => { await vi.advanceTimersByTimeAsync(300); });
        expect(listProducts).toHaveBeenCalled();
    });

    it('uses custom limit', async () => {
        vi.mocked(listProducts).mockResolvedValueOnce([]);

        const { result } = renderHook(() => useProductSearch({ limit: 10 }));
        act(() => { result.current.setQuery('test'); });
        await act(async () => { await vi.advanceTimersByTimeAsync(200); });

        expect(listProducts).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
    });

    it('filters by selected line', async () => {
        vi.mocked(listProducts).mockResolvedValue([]);

        const { result } = renderHook(() => useProductSearch());
        act(() => { result.current.setSelectedLine('020'); });
        act(() => { result.current.setQuery('pieza'); });
        await act(async () => { await vi.advanceTimersByTimeAsync(200); });

        expect(listProducts).toHaveBeenCalledWith(expect.objectContaining({
            lineaCode: '020',
            search: 'pieza',
        }));
    });

    it('passes undefined lineaCode when no line selected', async () => {
        vi.mocked(listProducts).mockResolvedValue([]);

        const { result } = renderHook(() => useProductSearch());
        act(() => { result.current.setQuery('pieza'); });
        await act(async () => { await vi.advanceTimersByTimeAsync(200); });

        expect(listProducts).toHaveBeenCalledWith(expect.objectContaining({
            lineaCode: undefined,
        }));
    });

    it('cancels stale searches (latest wins)', async () => {
        const second = [mockProduct('B', 'Second')];
        // Only one call will actually happen (the first timer gets cancelled)
        vi.mocked(listProducts).mockResolvedValueOnce(second);

        const { result } = renderHook(() => useProductSearch({ debounceMs: 100 }));

        act(() => { result.current.setQuery('fi'); });
        await act(async () => { await vi.advanceTimersByTimeAsync(50); });
        // Second search before first debounce fires — cancels the first timer
        act(() => { result.current.setQuery('se'); });
        await act(async () => { await vi.advanceTimersByTimeAsync(100); });

        // Only ONE call should have been made (with the latest query)
        expect(listProducts).toHaveBeenCalledTimes(1);
        expect(listProducts).toHaveBeenCalledWith(expect.objectContaining({ search: 'se' }));
        expect(result.current.results).toEqual(second);
    });

    it('clearSearch resets state', async () => {
        vi.mocked(listProducts).mockResolvedValueOnce([mockProduct('X', 'Test')]);

        const { result } = renderHook(() => useProductSearch());
        act(() => { result.current.setQuery('test'); });
        await act(async () => { await vi.advanceTimersByTimeAsync(200); });
        expect(result.current.results).toHaveLength(1);

        act(() => { result.current.clearSearch(); });
        expect(result.current.query).toBe('');
        expect(result.current.results).toEqual([]);
        expect(result.current.isLoading).toBe(false);
    });

    it('handles search errors gracefully', async () => {
        vi.mocked(listProducts).mockRejectedValueOnce(new Error('DB error'));

        const { result } = renderHook(() => useProductSearch());
        act(() => { result.current.setQuery('error'); });
        await act(async () => { await vi.advanceTimersByTimeAsync(200); });

        expect(result.current.results).toEqual([]);
        expect(result.current.isLoading).toBe(false);
    });

    it('handles listCustomerLines error gracefully', async () => {
        vi.mocked(listCustomerLines).mockRejectedValueOnce(new Error('fail'));

        const { result } = renderHook(() => useProductSearch());
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        // Should not crash, just have empty lines
        expect(result.current.customerLines).toEqual([]);
    });

    it('re-searches when selectedLine changes', async () => {
        vi.mocked(listProducts).mockResolvedValue([]);

        const { result } = renderHook(() => useProductSearch());

        // First search with no line filter
        act(() => { result.current.setQuery('pieza'); });
        await act(async () => { await vi.advanceTimersByTimeAsync(200); });
        expect(listProducts).toHaveBeenCalledTimes(1);

        // Change line → should trigger new search
        act(() => { result.current.setSelectedLine('095'); });
        await act(async () => { await vi.advanceTimersByTimeAsync(200); });
        expect(listProducts).toHaveBeenCalledTimes(2);
        expect(listProducts).toHaveBeenLastCalledWith(expect.objectContaining({
            lineaCode: '095',
        }));
    });

    it('accepts initial lineaCode option', () => {
        const { result } = renderHook(() => useProductSearch({ lineaCode: '020' }));
        expect(result.current.selectedLine).toBe('020');
    });

    it('clears results when query drops below minimum', async () => {
        vi.mocked(listProducts).mockResolvedValueOnce([mockProduct('X', 'Y')]);

        const { result } = renderHook(() => useProductSearch());
        act(() => { result.current.setQuery('test'); });
        await act(async () => { await vi.advanceTimersByTimeAsync(200); });
        expect(result.current.results).toHaveLength(1);

        act(() => { result.current.setQuery('t'); });
        // Results should clear immediately (no debounce needed)
        expect(result.current.results).toEqual([]);
        expect(result.current.isLoading).toBe(false);
    });
});
