/**
 * ConfirmModal - Reusable Confirmation Modal
 * 
 * Standard component for confirming destructive actions throughout the app.
 * Supports danger, warning, and info variants with appropriate styling.
 * 
 * @module ConfirmModal
 * @version 1.1.0 - Added focus trap and ARIA improvements (H-07)
 */
import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Trash2, Info, X, Loader2 } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useModalTransition } from '../../hooks/useModalTransition';

export interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
    /** If set, user must type this exact text to enable the confirm button (for high-risk bulk actions) */
    requireTextConfirm?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'danger',
    isLoading = false,
    requireTextConfirm
}) => {
    // Animation state
    const { shouldRender, isClosing } = useModalTransition(isOpen, 200);

    // A11y: Focus trap to keep Tab navigation within modal
    const modalRef = useFocusTrap(isOpen);
    const cancelButtonRef = useRef<HTMLButtonElement>(null);

    // Type-to-confirm state for high-risk actions
    const [typedConfirm, setTypedConfirm] = useState('');
    const textConfirmMatches = !requireTextConfirm || typedConfirm === requireTextConfirm;

    // Reset typed text whenever the modal closes. Wrapping onClose avoids
    // the setState-in-effect anti-pattern (react-hooks/set-state-in-effect).
    const handleClose = React.useCallback(() => {
        setTypedConfirm('');
        onClose();
    }, [onClose]);

    // A11y: Auto-focus cancel button when modal opens
    useEffect(() => {
        if (isOpen) {
            // Small delay to ensure DOM is ready
            const timer = setTimeout(() => {
                cancelButtonRef.current?.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !isLoading) {
                handleClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, isLoading, handleClose]);

    if (!shouldRender) return null;

    // Variant styles
    const variantStyles = {
        danger: {
            iconBg: 'bg-red-100',
            iconColor: 'text-red-600',
            buttonBg: 'bg-red-600 hover:bg-red-700',
            Icon: Trash2
        },
        warning: {
            iconBg: 'bg-amber-100',
            iconColor: 'text-amber-600',
            buttonBg: 'bg-amber-600 hover:bg-amber-700',
            Icon: AlertTriangle
        },
        info: {
            iconBg: 'bg-blue-100',
            iconColor: 'text-blue-600',
            buttonBg: 'bg-blue-600 hover:bg-blue-700',
            Icon: Info
        }
    };

    const { iconBg, iconColor, buttonBg, Icon } = variantStyles[variant];

    return (
        <div className={`fixed inset-0 z-modal-backdrop flex items-center justify-center ${isClosing ? 'pointer-events-none' : ''}`}>
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100 animate-in fade-in duration-200'}`}
                onClick={!isLoading ? handleClose : undefined}
            />

            {/* Modal */}
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-modal-title"
                aria-describedby="confirm-modal-message"
                className={`relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden outline-none transition-all duration-200 ${isClosing ? 'scale-95 opacity-0' : 'animate-scale-in'}`}
            >
                {/* Close button */}
                <button
                    onClick={handleClose}
                    disabled={isLoading}
                    className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Cerrar" aria-label="Cerrar"
                >
                    <X size={20} />
                </button>

                <div className="p-6">
                    {/* Icon */}
                    <div className={`w-14 h-14 ${iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
                        <Icon size={28} className={iconColor} />
                    </div>

                    {/* Title */}
                    <h2 id="confirm-modal-title" className="text-xl font-bold text-slate-800 text-center mb-2">
                        {title}
                    </h2>

                    {/* Message */}
                    <p id="confirm-modal-message" className="text-slate-600 text-center mb-6 whitespace-pre-line">
                        {message}
                    </p>

                    {/* Type-to-confirm input for high-risk actions */}
                    {requireTextConfirm && (
                        <div className="mb-4">
                            <label htmlFor="confirm-modal-text-input" className="block text-sm text-slate-500 mb-1.5">
                                Escribi <span className="font-mono font-bold text-red-600">{requireTextConfirm}</span> para confirmar:
                            </label>
                            <input
                                id="confirm-modal-text-input"
                                type="text"
                                value={typedConfirm}
                                onChange={e => setTypedConfirm(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none"
                                placeholder={requireTextConfirm}
                                autoComplete="off"
                                spellCheck={false}
                            />
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            ref={cancelButtonRef}
                            onClick={handleClose}
                            disabled={isLoading}
                            className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 outline-none"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isLoading || !textConfirmMatches}
                            className={`flex-1 px-4 py-2.5 ${buttonBg} text-white font-medium rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:ring-2 focus:ring-offset-2 focus:ring-red-400 outline-none`}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>Procesando...</span>
                                </>
                            ) : (
                                confirmText
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
