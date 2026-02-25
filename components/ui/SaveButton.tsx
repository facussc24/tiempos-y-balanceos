/**
 * SaveButton Component
 * 
 * Enhanced save button with clear visual states:
 * - Idle: Normal save button
 * - Saving: Shows spinner and "Guardando..."
 * - Saved: Shows checkmark and "Guardado" for 2 seconds
 * - Error: Shows error state briefly
 * 
 * @module SaveButton
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Save, Loader2, Check, AlertCircle, Lock } from 'lucide-react';
import { logger } from '../../utils/logger';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface SaveButtonProps {
    onSave: () => Promise<void> | void;
    disabled?: boolean;
    isLocked?: boolean;
    lockOwner?: string;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
}

/**
 * SaveButton Component with enhanced feedback
 */
export const SaveButton: React.FC<SaveButtonProps> = ({
    onSave,
    disabled = false,
    isLocked = false,
    lockOwner,
    className = '',
    size = 'md',
    showLabel = true
}) => {
    const [state, setState] = useState<SaveState>('idle');
    const [lastSaved, setLastSaved] = useState<string | null>(null);

    // Reset saved state after 2 seconds
    useEffect(() => {
        if (state === 'saved') {
            const timer = setTimeout(() => setState('idle'), 2000);
            return () => clearTimeout(timer);
        }
        if (state === 'error') {
            const timer = setTimeout(() => setState('idle'), 3000);
            return () => clearTimeout(timer);
        }
    }, [state]);

    const handleClick = useCallback(async () => {
        if (disabled || isLocked || state === 'saving') return;

        setState('saving');
        try {
            await onSave();
            setState('saved');
            setLastSaved(new Date().toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit'
            }));
        } catch (error) {
            setState('error');
            logger.error('SaveButton', 'Save error', {}, error instanceof Error ? error : undefined);
        }
    }, [onSave, disabled, isLocked, state]);

    // Size configurations
    const sizes = {
        sm: {
            padding: 'px-3 py-1.5',
            text: 'text-xs',
            icon: 14,
            gap: 'gap-1.5'
        },
        md: {
            padding: 'px-4 py-2',
            text: 'text-sm',
            icon: 16,
            gap: 'gap-2'
        },
        lg: {
            padding: 'px-5 py-2.5',
            text: 'text-base',
            icon: 18,
            gap: 'gap-2'
        }
    };

    const sizeConfig = sizes[size];

    // State configurations
    const stateConfigs: Record<SaveState, {
        bg: string;
        text: string;
        icon: React.ReactNode;
        label: string;
        animation?: string;
    }> = {
        idle: {
            bg: 'bg-blue-600 hover:bg-blue-700 hover:shadow-md hover:-translate-y-0.5',
            text: 'text-white',
            icon: <Save size={sizeConfig.icon} />,
            label: 'Guardar'
        },
        saving: {
            bg: 'bg-blue-500',
            text: 'text-white',
            icon: <Loader2 size={sizeConfig.icon} className="animate-spin" />,
            label: 'Guardando...',
            animation: 'cursor-wait'
        },
        saved: {
            bg: 'bg-emerald-500',
            text: 'text-white',
            icon: <Check size={sizeConfig.icon} />,
            label: 'Guardado',
            animation: 'animate-in zoom-in-95'
        },
        error: {
            bg: 'bg-red-500',
            text: 'text-white',
            icon: <AlertCircle size={sizeConfig.icon} />,
            label: 'Error',
            animation: 'animate-shake'
        }
    };

    // Locked state overrides
    if (isLocked) {
        return (
            <button
                disabled
                className={`${sizeConfig.padding} ${sizeConfig.gap} ${sizeConfig.text} 
                    bg-slate-300 text-slate-500 rounded-lg flex items-center cursor-not-allowed
                    ${className}`}
                title={lockOwner ? `Bloqueado por ${lockOwner}` : 'Proyecto bloqueado'}
            >
                <Lock size={sizeConfig.icon} />
                {showLabel && <span>Bloqueado</span>}
            </button>
        );
    }

    const config = stateConfigs[state];

    return (
        <div className="relative">
            <button
                onClick={handleClick}
                disabled={disabled || state === 'saving'}
                className={`${sizeConfig.padding} ${sizeConfig.gap} ${sizeConfig.text}
                    ${config.bg} ${config.text} 
                    rounded-lg flex items-center font-medium shadow-sm
                    transition-all duration-200 active:scale-95
                    disabled:opacity-60 disabled:cursor-not-allowed
                    ${config.animation || ''}
                    ${className}`}
            >
                {config.icon}
                {showLabel && <span>{config.label}</span>}
            </button>

            {/* Last saved tooltip */}
            {lastSaved && state === 'idle' && (
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 
                    text-[10px] text-slate-400 whitespace-nowrap animate-in fade-in duration-300">
                    Último: {lastSaved}
                </span>
            )}
        </div>
    );
};

/**
 * Simple hook for save state management
 * Use this when you need more control over the save process
 */
export function useSaveState() {
    const [state, setState] = useState<SaveState>('idle');
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    const startSaving = () => setState('saving');

    const markSaved = () => {
        setState('saved');
        setLastSaved(new Date());
        setTimeout(() => setState('idle'), 2000);
    };

    const markError = () => {
        setState('error');
        setTimeout(() => setState('idle'), 3000);
    };

    const reset = () => setState('idle');

    return {
        state,
        lastSaved,
        isSaving: state === 'saving',
        startSaving,
        markSaved,
        markError,
        reset
    };
}

export default SaveButton;
