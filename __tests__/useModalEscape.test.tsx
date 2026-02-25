import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useModalEscape } from '../hooks/useModalEscape';

describe('useModalEscape', () => {
    it('should call onClose when Escape is pressed and modal is open', () => {
        const onClose = vi.fn();
        renderHook(() => useModalEscape(true, onClose));

        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        document.dispatchEvent(event);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should NOT call onClose when Escape is pressed and modal is closed', () => {
        const onClose = vi.fn();
        renderHook(() => useModalEscape(false, onClose));

        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        document.dispatchEvent(event);

        expect(onClose).not.toHaveBeenCalled();
    });

    it('should NOT call onClose for non-Escape keys', () => {
        const onClose = vi.fn();
        renderHook(() => useModalEscape(true, onClose));

        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        document.dispatchEvent(event);

        expect(onClose).not.toHaveBeenCalled();
    });

    it('should attach/detach listener when isOpen changes', () => {
        const onClose = vi.fn();
        const { rerender } = renderHook(
            ({ isOpen }) => useModalEscape(isOpen, onClose),
            { initialProps: { isOpen: true } }
        );

        // Should respond when open
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(onClose).toHaveBeenCalledTimes(1);

        // Close modal
        rerender({ isOpen: false });

        // Should not respond when closed
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(onClose).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should prevent default on Escape key', () => {
        const onClose = vi.fn();
        renderHook(() => useModalEscape(true, onClose));

        const event = new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
            cancelable: true,
        });
        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
    });
});
