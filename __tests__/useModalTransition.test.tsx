import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalTransition } from '../hooks/useModalTransition';

describe('useModalTransition', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should render and not be closing when isOpen is true', () => {
        const { result } = renderHook(() => useModalTransition(true, 200));

        expect(result.current.shouldRender).toBe(true);
        expect(result.current.isClosing).toBe(false);
    });

    it('should start closing animation when isOpen becomes false', () => {
        const { result, rerender } = renderHook(
            ({ isOpen }) => useModalTransition(isOpen, 200),
            { initialProps: { isOpen: true } }
        );

        // Close the modal
        rerender({ isOpen: false });

        // Should still render (for animation) but be in closing state
        expect(result.current.shouldRender).toBe(true);
        expect(result.current.isClosing).toBe(true);
    });

    it('should stop rendering after the animation duration', () => {
        const { result, rerender } = renderHook(
            ({ isOpen }) => useModalTransition(isOpen, 200),
            { initialProps: { isOpen: true } }
        );

        rerender({ isOpen: false });

        // Before timeout: still rendering and closing
        expect(result.current.shouldRender).toBe(true);
        expect(result.current.isClosing).toBe(true);

        // After timeout
        act(() => {
            vi.advanceTimersByTime(200);
        });

        expect(result.current.shouldRender).toBe(false);
        expect(result.current.isClosing).toBe(false);
    });

    it('should cancel close animation if reopened before duration ends', () => {
        const { result, rerender } = renderHook(
            ({ isOpen }) => useModalTransition(isOpen, 200),
            { initialProps: { isOpen: true } }
        );

        // Start closing
        rerender({ isOpen: false });
        expect(result.current.isClosing).toBe(true);

        // Reopen before animation finishes
        act(() => {
            vi.advanceTimersByTime(100); // Only half the duration
        });
        rerender({ isOpen: true });

        expect(result.current.shouldRender).toBe(true);
        expect(result.current.isClosing).toBe(false);

        // Advancing past original timer shouldn't affect anything
        act(() => {
            vi.advanceTimersByTime(200);
        });
        expect(result.current.shouldRender).toBe(true);
        expect(result.current.isClosing).toBe(false);
    });

    it('should not render initially when starting closed', () => {
        const { result } = renderHook(() => useModalTransition(false, 200));

        // When starting closed, the closing animation fires but from initial state
        // After the timer, shouldRender becomes false
        act(() => {
            vi.advanceTimersByTime(200);
        });

        expect(result.current.shouldRender).toBe(false);
    });

    it('should work with custom duration', () => {
        const { result, rerender } = renderHook(
            ({ isOpen }) => useModalTransition(isOpen, 500),
            { initialProps: { isOpen: true } }
        );

        rerender({ isOpen: false });

        act(() => {
            vi.advanceTimersByTime(200);
        });
        // Still rendering with 500ms duration
        expect(result.current.shouldRender).toBe(true);

        act(() => {
            vi.advanceTimersByTime(300);
        });
        expect(result.current.shouldRender).toBe(false);
    });
});
