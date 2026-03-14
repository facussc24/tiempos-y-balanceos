/**
 * PromptModal - Reusable Input Prompt Modal
 * 
 * Standard component for getting text input from users.
 * Replaces native prompt() dialogs with consistent modern UI.
 * 
 * @module PromptModal
 * @version 1.0.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Loader2 } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface PromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (value: string) => void;
    title: string;
    message: string;
    placeholder?: string;
    defaultValue?: string;
    submitText?: string;
    cancelText?: string;
    isLoading?: boolean;
    required?: boolean;
}

export const PromptModal: React.FC<PromptModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    title,
    message,
    placeholder = '',
    defaultValue = '',
    submitText = 'Aceptar',
    cancelText = 'Cancelar',
    isLoading = false,
    required = false
}) => {
    const [inputValue, setInputValue] = useState(defaultValue);
    const inputRef = useRef<HTMLInputElement>(null);
    const modalRef = useFocusTrap(isOpen);

    // Reset input value when modal opens
    useEffect(() => {
        if (isOpen) {
            setInputValue(defaultValue);
            // Focus input after modal animation
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, defaultValue]);

    // Handle Escape key and Enter key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen || isLoading) return;

            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'Enter') {
                handleSubmit();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isLoading, inputValue, required, onClose, onSubmit]);

    const handleSubmit = () => {
        if (required && !inputValue.trim()) {
            inputRef.current?.focus();
            return;
        }
        onSubmit(inputValue);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
                onClick={!isLoading ? onClose : undefined}
            />

            {/* Modal */}
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="prompt-modal-title"
                aria-describedby="prompt-modal-message"
                className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 animate-fade-in-up overflow-hidden"
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    disabled={isLoading}
                    aria-label="Cerrar"
                    className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <X size={20} />
                </button>

                <div className="p-6">
                    {/* Icon */}
                    <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MessageSquare size={28} className="text-blue-600" />
                    </div>

                    {/* Title */}
                    <h2 id="prompt-modal-title" className="text-xl font-bold text-slate-800 text-center mb-2">
                        {title}
                    </h2>

                    {/* Message */}
                    <p id="prompt-modal-message" className="text-slate-600 text-center mb-4 whitespace-pre-line">
                        {message}
                    </p>

                    {/* Input */}
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={placeholder}
                        disabled={isLoading}
                        aria-label={title}
                        aria-required={required}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all mb-6 disabled:opacity-50 disabled:bg-slate-50"
                    />

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isLoading || (required && !inputValue.trim())}
                            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>Procesando...</span>
                                </>
                            ) : (
                                submitText
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PromptModal;
