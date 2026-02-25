import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCpColumnVisibility, CP_DEFAULT_VISIBILITY } from '../../../modules/controlPlan/useCpColumnVisibility';

describe('useCpColumnVisibility', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('starts with all groups visible by default', () => {
        const { result } = renderHook(() => useCpColumnVisibility());

        expect(result.current.visibility.proceso).toBe(true);
        expect(result.current.visibility.caracteristicas).toBe(true);
        expect(result.current.visibility.metodos).toBe(true);
    });

    it('isDefault is true when all groups are visible', () => {
        const { result } = renderHook(() => useCpColumnVisibility());
        expect(result.current.isDefault).toBe(true);
    });

    it('toggleGroup hides a group', () => {
        const { result } = renderHook(() => useCpColumnVisibility());

        act(() => { result.current.toggleGroup('metodos'); });

        expect(result.current.visibility.metodos).toBe(false);
        expect(result.current.visibility.proceso).toBe(true);
        expect(result.current.visibility.caracteristicas).toBe(true);
    });

    it('toggleGroup shows a hidden group', () => {
        const { result } = renderHook(() => useCpColumnVisibility());

        act(() => { result.current.toggleGroup('metodos'); });
        expect(result.current.visibility.metodos).toBe(false);

        act(() => { result.current.toggleGroup('metodos'); });
        expect(result.current.visibility.metodos).toBe(true);
    });

    it('isDefault becomes false when a group is hidden', () => {
        const { result } = renderHook(() => useCpColumnVisibility());

        act(() => { result.current.toggleGroup('caracteristicas'); });

        expect(result.current.isDefault).toBe(false);
    });

    it('showAll resets to default', () => {
        const { result } = renderHook(() => useCpColumnVisibility());

        act(() => { result.current.toggleGroup('proceso'); });
        act(() => { result.current.toggleGroup('metodos'); });

        expect(result.current.isDefault).toBe(false);

        act(() => { result.current.showAll(); });

        expect(result.current.visibility.proceso).toBe(true);
        expect(result.current.visibility.caracteristicas).toBe(true);
        expect(result.current.visibility.metodos).toBe(true);
        expect(result.current.isDefault).toBe(true);
    });

    it('persists to localStorage', () => {
        const { result } = renderHook(() => useCpColumnVisibility());

        act(() => { result.current.toggleGroup('caracteristicas'); });

        const stored = JSON.parse(localStorage.getItem('cp-column-visibility') || '{}');
        expect(stored.caracteristicas).toBe(false);
        expect(stored.proceso).toBe(true);
    });

    it('loads from localStorage on mount', () => {
        localStorage.setItem('cp-column-visibility', JSON.stringify({
            proceso: true,
            caracteristicas: false,
            metodos: true,
        }));

        const { result } = renderHook(() => useCpColumnVisibility());

        expect(result.current.visibility.caracteristicas).toBe(false);
        expect(result.current.visibility.proceso).toBe(true);
        expect(result.current.visibility.metodos).toBe(true);
    });

    it('handles corrupt localStorage gracefully', () => {
        localStorage.setItem('cp-column-visibility', 'not-json');

        const { result } = renderHook(() => useCpColumnVisibility());

        expect(result.current.visibility).toEqual(CP_DEFAULT_VISIBILITY);
    });

    it('merges partial localStorage with defaults', () => {
        localStorage.setItem('cp-column-visibility', JSON.stringify({ metodos: false }));

        const { result } = renderHook(() => useCpColumnVisibility());

        expect(result.current.visibility.proceso).toBe(true);
        expect(result.current.visibility.caracteristicas).toBe(true);
        expect(result.current.visibility.metodos).toBe(false);
    });
});
