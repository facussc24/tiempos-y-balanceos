/**
 * UndoRedoControls - UI Controls for Undo/Redo
 * 
 * Displays undo/redo buttons in the header with state info.
 * 
 * @module UndoRedoControls
 * @version 1.0.0
 */

import React from 'react';
import { Undo2, Redo2 } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface UndoRedoControlsProps {
    /** Whether undo is available */
    canUndo: boolean;
    /** Whether redo is available */
    canRedo: boolean;
    /** Number of undo steps available */
    undoCount: number;
    /** Number of redo steps available */
    redoCount: number;
    /** Handler for undo action */
    onUndo: () => void;
    /** Handler for redo action */
    onRedo: () => void;
}

/**
 * UndoRedoControls Component
 */
export const UndoRedoControls: React.FC<UndoRedoControlsProps> = ({
    canUndo,
    canRedo,
    undoCount,
    redoCount,
    onUndo,
    onRedo
}) => {
    return (
        <div className="flex items-center gap-1">
            {/* Undo Button */}
            <Tooltip content={`Deshacer (Ctrl+Z) ${undoCount > 0 ? `• ${undoCount} pasos` : ''}`}>
                <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    data-shortcut="Ctrl+Z"
                    className={`
                        p-2 rounded-lg transition-all
                        ${canUndo
                            ? 'text-slate-600 hover:text-blue-600 hover:bg-blue-50 active:scale-95'
                            : 'text-slate-300 cursor-not-allowed'
                        }
                    `}
                    aria-label="Deshacer"
                >
                    <Undo2 size={18} />
                </button>
            </Tooltip>

            {/* Redo Button */}
            <Tooltip content={`Rehacer (Ctrl+Y) ${redoCount > 0 ? `• ${redoCount} pasos` : ''}`}>
                <button
                    onClick={onRedo}
                    disabled={!canRedo}
                    data-shortcut="Ctrl+Y"
                    className={`
                        p-2 rounded-lg transition-all
                        ${canRedo
                            ? 'text-slate-600 hover:text-blue-600 hover:bg-blue-50 active:scale-95'
                            : 'text-slate-300 cursor-not-allowed'
                        }
                    `}
                    aria-label="Rehacer"
                >
                    <Redo2 size={18} />
                </button>
            </Tooltip>
        </div>
    );
};

export default UndoRedoControls;
