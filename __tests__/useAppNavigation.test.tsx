import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppNavigation } from '../hooks/useAppNavigation';

describe('useAppNavigation', () => {
    let originalHash: string;

    beforeEach(() => {
        originalHash = window.location.hash;
        window.location.hash = '';
        localStorage.clear();
    });

    afterEach(() => {
        window.location.hash = originalHash;
    });

    it('should default to dashboard tab', () => {
        const { result } = renderHook(() => useAppNavigation());
        expect(result.current.activeTab).toBe('dashboard');
    });

    it('should accept a custom default tab', () => {
        const { result } = renderHook(() => useAppNavigation({ defaultTab: 'tasks' }));
        expect(result.current.activeTab).toBe('tasks');
    });

    it('should navigate to a specific tab', () => {
        const { result } = renderHook(() => useAppNavigation());

        act(() => {
            result.current.setActiveTab('balance');
        });

        expect(result.current.activeTab).toBe('balance');
    });

    it('should provide convenience navigation methods', () => {
        const { result } = renderHook(() => useAppNavigation());

        act(() => {
            result.current.navigateToPanel();
        });
        expect(result.current.activeTab).toBe('panel');

        act(() => {
            result.current.navigateToDashboard();
        });
        expect(result.current.activeTab).toBe('dashboard');
    });

    it('should sync tab to URL hash when ready', () => {
        const { result } = renderHook(() => useAppNavigation({ isReady: true }));

        act(() => {
            result.current.setActiveTab('vsm');
        });

        expect(window.location.hash).toBe('#vsm');
    });

    it('should NOT sync tab to URL hash when not ready', () => {
        window.location.hash = '';
        renderHook(() => useAppNavigation({ isReady: false, defaultTab: 'tasks' }));

        // Hash should remain empty since isReady is false
        expect(window.location.hash).toBe('');
    });

    it('should read initial tab from URL hash', () => {
        window.location.hash = '#balance';

        const { result } = renderHook(() => useAppNavigation());
        expect(result.current.activeTab).toBe('balance');
    });

    it('should ignore invalid hash values', () => {
        window.location.hash = '#invalidtab';

        const { result } = renderHook(() => useAppNavigation());
        // Should fall back to default
        expect(result.current.activeTab).toBe('dashboard');
    });

    it('should expose VALID_TABS list', () => {
        const { result } = renderHook(() => useAppNavigation());

        expect(result.current.VALID_TABS).toContain('dashboard');
        expect(result.current.VALID_TABS).toContain('tasks');
        expect(result.current.VALID_TABS).toContain('balance');
        expect(result.current.VALID_TABS).toContain('vsm');
        expect(result.current.VALID_TABS).toContain('summary');
    });

    it('should persist active tab to localStorage', () => {
        const { result } = renderHook(() => useAppNavigation({ isReady: true }));

        act(() => {
            result.current.setActiveTab('oee');
        });

        expect(localStorage.getItem('optiline_tab')).toBe('oee');
    });

    it('should respond to hashchange events', async () => {
        const { result } = renderHook(() => useAppNavigation());

        act(() => {
            window.location.hash = '#tasks';
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        });

        expect(result.current.activeTab).toBe('tasks');
    });
});
