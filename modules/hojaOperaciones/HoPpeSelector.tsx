/**
 * PPE Selector — Circular ISO pictogram icons for safety elements.
 * Per IATF 8.5.1.2: PPE must be shown visually on the work instruction.
 * Uses real ISO mandatory sign images (blue circles).
 */

import React from 'react';
import { PpeItem, PPE_CATALOG } from './hojaOperacionesTypes';
import { PPE_IMAGES } from '../../src/assets/ppe';
import { Check } from 'lucide-react';

interface Props {
    selected: PpeItem[];
    onToggle: (item: PpeItem) => void;
    readOnly?: boolean;
}

const HoPpeSelector: React.FC<Props> = ({ selected, onToggle, readOnly }) => {
    return (
        <div className="flex items-center gap-3 flex-wrap">
            {PPE_CATALOG.map(ppe => {
                const isSelected = selected.includes(ppe.id);
                const imgSrc = PPE_IMAGES[ppe.id];
                return (
                    <button
                        key={ppe.id}
                        type="button"
                        disabled={readOnly}
                        onClick={() => onToggle(ppe.id)}
                        title={ppe.label}
                        aria-pressed={isSelected}
                        aria-label={`${ppe.label}${isSelected ? ' (seleccionado)' : ''}`}
                        className={`
                            relative w-12 h-12 rounded-full border-2 overflow-hidden transition-all
                            ${isSelected
                                ? 'border-blue-600 ring-2 ring-blue-300 shadow-md opacity-100'
                                : 'border-gray-300 opacity-40 hover:opacity-70 hover:border-blue-400'}
                            ${readOnly ? 'cursor-default' : 'cursor-pointer'}
                        `}
                    >
                        <img
                            src={imgSrc}
                            alt={ppe.label}
                            className="w-full h-full object-cover"
                            draggable={false}
                        />
                        {isSelected && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center border border-white">
                                <Check size={10} className="text-white" strokeWidth={3} />
                            </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default HoPpeSelector;
