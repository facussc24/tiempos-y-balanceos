/**
 * AMFE Confirmation Modal State Hook
 *
 * Manages the state for a confirmation modal that replaces window.confirm
 * throughout the AMFE module. Provides a promise-based API so callers
 * can await the user's decision.
 */

import { useState, useCallback, useRef } from 'react';

export interface AmfeConfirmState {
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    confirmText: string;
}

const INITIAL_STATE: AmfeConfirmState = {
    isOpen: false,
    title: '',
    message: '',
    variant: 'danger',
    confirmText: 'Confirmar',
};

/**
 * Hook that provides a promise-based confirm dialog for AMFE operations.
 *
 * Usage:
 * ```
 * const { confirmState, requestConfirm, handleConfirm, handleCancel } = useAmfeConfirm();
 * const ok = await requestConfirm({ title: '...', message: '...' });
 * if (ok) { doSomething(); }
 * ```
 */
export function useAmfeConfirm() {
    const [confirmState, setConfirmState] = useState<AmfeConfirmState>(INITIAL_STATE);
    const resolverRef = useRef<((value: boolean) => void) | null>(null);

    const requestConfirm = useCallback((options: {
        title: string;
        message: string;
        variant?: 'danger' | 'warning' | 'info';
        confirmText?: string;
    }): Promise<boolean> => {
        return new Promise(resolve => {
            resolverRef.current = resolve;
            setConfirmState({
                isOpen: true,
                title: options.title,
                message: options.message,
                variant: options.variant || 'danger',
                confirmText: options.confirmText || 'Confirmar',
            });
        });
    }, []);

    const handleConfirm = useCallback(() => {
        resolverRef.current?.(true);
        resolverRef.current = null;
        setConfirmState(INITIAL_STATE);
    }, []);

    const handleCancel = useCallback(() => {
        resolverRef.current?.(false);
        resolverRef.current = null;
        setConfirmState(INITIAL_STATE);
    }, []);

    return { confirmState, requestConfirm, handleConfirm, handleCancel };
}
