import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAmfeConfirm } from '../../../modules/amfe/useAmfeConfirm';

describe('useAmfeConfirm', () => {
    it('starts with modal closed', () => {
        const { result } = renderHook(() => useAmfeConfirm());
        expect(result.current.confirmState.isOpen).toBe(false);
    });

    it('opens modal on requestConfirm', async () => {
        const { result } = renderHook(() => useAmfeConfirm());

        let resolvedValue: boolean | undefined;
        act(() => {
            result.current.requestConfirm({
                title: 'Eliminar',
                message: '¿Seguro?',
            }).then(v => { resolvedValue = v; });
        });

        expect(result.current.confirmState.isOpen).toBe(true);
        expect(result.current.confirmState.title).toBe('Eliminar');
        expect(result.current.confirmState.message).toBe('¿Seguro?');
    });

    it('resolves true on handleConfirm', async () => {
        const { result } = renderHook(() => useAmfeConfirm());

        let resolvedValue: boolean | undefined;
        act(() => {
            result.current.requestConfirm({
                title: 'Test',
                message: 'Test',
            }).then(v => { resolvedValue = v; });
        });

        await act(async () => {
            result.current.handleConfirm();
        });

        expect(resolvedValue).toBe(true);
        expect(result.current.confirmState.isOpen).toBe(false);
    });

    it('resolves false on handleCancel', async () => {
        const { result } = renderHook(() => useAmfeConfirm());

        let resolvedValue: boolean | undefined;
        act(() => {
            result.current.requestConfirm({
                title: 'Test',
                message: 'Test',
            }).then(v => { resolvedValue = v; });
        });

        await act(async () => {
            result.current.handleCancel();
        });

        expect(resolvedValue).toBe(false);
        expect(result.current.confirmState.isOpen).toBe(false);
    });

    it('uses default variant and confirmText', () => {
        const { result } = renderHook(() => useAmfeConfirm());

        act(() => {
            result.current.requestConfirm({
                title: 'Test',
                message: 'Test',
            });
        });

        expect(result.current.confirmState.variant).toBe('danger');
        expect(result.current.confirmState.confirmText).toBe('Confirmar');
    });

    it('respects custom variant and confirmText', () => {
        const { result } = renderHook(() => useAmfeConfirm());

        act(() => {
            result.current.requestConfirm({
                title: 'Warning',
                message: 'Unsaved',
                variant: 'warning',
                confirmText: 'Continuar',
            });
        });

        expect(result.current.confirmState.variant).toBe('warning');
        expect(result.current.confirmState.confirmText).toBe('Continuar');
    });
});
