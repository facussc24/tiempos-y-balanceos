/**
 * Suggestion Popover
 *
 * Autocomplete dropdown that appears below a textarea when the user types.
 * Shows suggestions from the AMFE suggestion engine with source attribution.
 * Supports local pattern-matching suggestions with source attribution.
 * Supports keyboard navigation (Up/Down/Enter/Escape).
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Suggestion } from '../../modules/amfe/amfeSuggestionEngine';
import { Library, FileText } from 'lucide-react';

interface Props {
    localSuggestions: Suggestion[];
    aiSuggestions: Suggestion[] | null; // null = AI disabled/not queried
    aiLoading: boolean;
    onSelect: (text: string) => void;
    visible: boolean;
    onDismiss: () => void;
}

const SuggestionPopover: React.FC<Props> = ({
    localSuggestions,
    aiSuggestions,
    aiLoading,
    onSelect,
    visible,
    onDismiss,
}) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    // All suggestions in a flat list for keyboard navigation
    const allSuggestions = [
        ...localSuggestions,
        ...(aiSuggestions || []),
    ];

    // Reset selection when suggestions change
    useEffect(() => {
        setSelectedIndex(0);
    }, [localSuggestions, aiSuggestions]);

    // Scroll selected item into view
    useEffect(() => {
        if (!listRef.current) return;
        const items = listRef.current.querySelectorAll('[data-suggestion-item]');
        if (items[selectedIndex]) {
            items[selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!visible || allSuggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, allSuggestions.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                if (selectedIndex >= 0 && selectedIndex < allSuggestions.length) {
                    e.preventDefault();
                    onSelect(allSuggestions[selectedIndex].text);
                }
                break;
            case 'Escape':
                e.preventDefault();
                onDismiss();
                break;
        }
    }, [visible, allSuggestions, selectedIndex, onSelect, onDismiss]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    if (!visible || (allSuggestions.length === 0 && !aiLoading)) return null;

    let flatIndex = 0;

    return (
        <div
            ref={listRef}
            className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[240px] overflow-y-auto"
            onMouseDown={e => e.preventDefault()} // prevent blur on click
        >
            {/* Local suggestions section */}
            {localSuggestions.length > 0 && (
                <>
                    {(aiSuggestions !== null || aiLoading) && (
                        <div className="px-2 py-0.5 bg-gray-50 border-b border-gray-100">
                            <span className="text-[8px] font-medium text-gray-500 uppercase tracking-wider">
                                Biblioteca
                            </span>
                        </div>
                    )}
                    {localSuggestions.map((suggestion, idx) => {
                        const currentFlatIndex = flatIndex++;
                        const isLibrary = suggestion.source.startsWith('Biblioteca:');
                        return (
                            <div
                                key={`local-${idx}`}
                                data-suggestion-item
                                onClick={() => onSelect(suggestion.text)}
                                className={`px-2 py-1.5 cursor-pointer transition-colors ${
                                    currentFlatIndex === selectedIndex
                                        ? 'bg-purple-50 text-gray-900'
                                        : 'text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                <div className="text-[10px] leading-tight line-clamp-2">
                                    {suggestion.text}
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                    {isLibrary ? (
                                        <Library size={8} className="text-purple-400" />
                                    ) : (
                                        <FileText size={8} className="text-gray-400" />
                                    )}
                                    <span className="text-[8px] text-gray-400 truncate">
                                        {suggestion.source}
                                    </span>
                                    {suggestion.frequency > 1 && (
                                        <span className="text-[8px] text-gray-300 ml-auto">
                                            x{suggestion.frequency}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </>
            )}

            <div className="px-2 py-1 border-t border-gray-100 text-[8px] text-gray-400 text-center">
                ↑↓ navegar · Enter aceptar · Esc cerrar
            </div>
        </div>
    );
};

export default SuggestionPopover;
