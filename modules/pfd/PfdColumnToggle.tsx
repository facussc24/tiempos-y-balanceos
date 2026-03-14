/**
 * PfdColumnToggle — Row of toggle pills for column group visibility
 *
 * Each pill represents a column group. Active pills have cyan styling,
 * inactive pills are gray. Essential group shows a lock icon and is not clickable.
 * Reset button at the end restores defaults.
 */

import React from 'react';
import { Lock, RotateCcw } from 'lucide-react';
import type { PfdColumnGroup } from './pfdTypes';
import { PFD_COLUMN_GROUPS, PFD_COLUMNS } from './pfdTypes';

interface PfdColumnToggleProps {
    visibleGroups: Record<PfdColumnGroup, boolean>;
    onToggle: (groupId: PfdColumnGroup) => void;
    onReset: () => void;
}

const PfdColumnToggle: React.FC<PfdColumnToggleProps> = ({ visibleGroups, onToggle, onReset }) => {
    return (
        <div className="flex items-center gap-1.5 flex-wrap" role="toolbar" aria-label="Visibilidad de columnas">
            {PFD_COLUMN_GROUPS.map(group => {
                const isActive = visibleGroups[group.id];
                const isEssential = group.id === 'essential';
                const columnCount = PFD_COLUMNS.filter(c => c.group === group.id).length;

                return (
                    <button
                        key={group.id}
                        onClick={() => !isEssential && onToggle(group.id)}
                        disabled={isEssential}
                        className={`
                            inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                            transition-colors border
                            ${isEssential
                                ? 'bg-cyan-100 text-cyan-800 border-cyan-300 cursor-default'
                                : isActive
                                    ? 'bg-cyan-50 text-cyan-700 border-cyan-300 hover:bg-cyan-100'
                                    : 'bg-gray-50 text-gray-500 border-gray-300 hover:bg-gray-100'
                            }
                        `}
                        title={group.description}
                        aria-pressed={isActive}
                        aria-label={`${group.label} (${columnCount} columnas)`}
                    >
                        {isEssential && <Lock size={11} className="text-cyan-600" />}
                        <span>{group.label}</span>
                        <span className={`text-[10px] ${isActive ? 'text-cyan-500' : 'text-gray-400'}`}>
                            {columnCount}
                        </span>
                    </button>
                );
            })}
            <button
                onClick={onReset}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-300"
                title="Restablecer visibilidad por defecto"
                aria-label="Restablecer columnas"
            >
                <RotateCcw size={11} />
                <span>Restablecer</span>
            </button>
        </div>
    );
};

export default PfdColumnToggle;
