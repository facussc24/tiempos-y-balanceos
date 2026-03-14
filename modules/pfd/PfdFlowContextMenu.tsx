/**
 * PFD Flow Context Menu — Right-click menu for step operations
 *
 * Appears at mouse coordinates on right-click on a step in the flow editor.
 * Provides insert, duplicate, move, delete, and change-type operations.
 * Cyan theme matching the PFD module.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Plus, Copy, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import type { PfdStep, PfdStepType } from './pfdTypes';
import { PFD_STEP_TYPES } from './pfdTypes';
import { PfdSymbol } from './PfdSymbols';

export interface PfdFlowContextMenuProps {
    isOpen: boolean;
    position: { x: number; y: number };
    step: PfdStep | null;
    stepIndex: number;
    totalSteps: number;
    onClose: () => void;
    onInsertBefore: () => void;
    onInsertAfter: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onChangeType: (type: PfdStepType) => void;
}

const PfdFlowContextMenu: React.FC<PfdFlowContextMenuProps> = ({
    isOpen,
    position,
    step,
    stepIndex,
    totalSteps,
    onClose,
    onInsertBefore,
    onInsertAfter,
    onDelete,
    onDuplicate,
    onMoveUp,
    onMoveDown,
    onChangeType,
}) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [showTypeSubmenu, setShowTypeSubmenu] = useState(false);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        // Delay attachment to avoid immediate close from the same right-click
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Reset submenu state when menu closes
    useEffect(() => {
        if (!isOpen) {
            setShowTypeSubmenu(false);
        }
    }, [isOpen]);

    if (!isOpen || !step) return null;

    const isFirst = stepIndex === 0;
    const isLast = stepIndex === totalSteps - 1;

    const menuItemClass = 'flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 cursor-pointer transition-colors w-full text-left';
    const disabledClass = 'flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 cursor-not-allowed w-full text-left';
    const separatorClass = 'border-t border-gray-100 my-1';

    return (
        <div
            ref={menuRef}
            className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[200px]"
            style={{ left: position.x, top: position.y }}
            role="menu"
            aria-label="Menú contextual de paso"
        >
            {/* Insert before */}
            <button
                className={menuItemClass}
                onClick={() => { onInsertBefore(); onClose(); }}
                role="menuitem"
            >
                <Plus size={14} className="text-cyan-500" />
                Insertar paso arriba
            </button>

            {/* Insert after */}
            <button
                className={menuItemClass}
                onClick={() => { onInsertAfter(); onClose(); }}
                role="menuitem"
            >
                <Plus size={14} className="text-cyan-500" />
                Insertar paso abajo
            </button>

            <div className={separatorClass} role="separator" />

            {/* Change type — submenu trigger */}
            <div className="relative">
                <button
                    className={menuItemClass}
                    onMouseEnter={() => setShowTypeSubmenu(true)}
                    onClick={() => setShowTypeSubmenu(!showTypeSubmenu)}
                    role="menuitem"
                    aria-haspopup="true"
                    aria-expanded={showTypeSubmenu}
                >
                    <PfdSymbol type={step.stepType} size={14} />
                    <span className="flex-1">Cambiar tipo</span>
                    <span className="text-gray-400 text-[10px] ml-2">{'>'}</span>
                </button>

                {/* Type submenu */}
                {showTypeSubmenu && (
                    <div
                        className="absolute left-full top-0 ml-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px] z-50"
                        role="menu"
                        aria-label="Tipos de paso"
                        onMouseLeave={() => setShowTypeSubmenu(false)}
                    >
                        {PFD_STEP_TYPES.map(({ value, label }) => (
                            <button
                                key={value}
                                className={`${menuItemClass} ${step.stepType === value ? 'bg-cyan-50 text-cyan-700 font-semibold' : ''}`}
                                onClick={() => { onChangeType(value); onClose(); }}
                                role="menuitem"
                            >
                                <PfdSymbol type={value} size={14} />
                                {label}
                                {step.stepType === value && (
                                    <span className="ml-auto text-cyan-500 text-[10px]">actual</span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className={separatorClass} role="separator" />

            {/* Duplicate */}
            <button
                className={menuItemClass}
                onClick={() => { onDuplicate(); onClose(); }}
                role="menuitem"
            >
                <Copy size={14} className="text-gray-400" />
                Duplicar
            </button>

            {/* Move up */}
            <button
                className={isFirst ? disabledClass : menuItemClass}
                onClick={() => { if (!isFirst) { onMoveUp(); onClose(); } }}
                disabled={isFirst}
                role="menuitem"
                aria-disabled={isFirst}
            >
                <ArrowUp size={14} className={isFirst ? 'text-gray-300' : 'text-gray-400'} />
                Mover arriba
            </button>

            {/* Move down */}
            <button
                className={isLast ? disabledClass : menuItemClass}
                onClick={() => { if (!isLast) { onMoveDown(); onClose(); } }}
                disabled={isLast}
                role="menuitem"
                aria-disabled={isLast}
            >
                <ArrowDown size={14} className={isLast ? 'text-gray-300' : 'text-gray-400'} />
                Mover abajo
            </button>

            <div className={separatorClass} role="separator" />

            {/* Delete */}
            <button
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer transition-colors w-full text-left"
                onClick={() => { onDelete(); onClose(); }}
                role="menuitem"
            >
                <Trash2 size={14} className="text-red-400" />
                Eliminar
            </button>
        </div>
    );
};

export default PfdFlowContextMenu;
