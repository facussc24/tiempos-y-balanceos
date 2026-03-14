/**
 * ProductSelector
 *
 * Inline combobox for searching and selecting products from the catalog.
 * Allows free-text input (products not in catalog are accepted).
 * Integrated line/customer filter in the dropdown.
 * Family badge shows when a product belongs to a product family.
 *
 * Follows the SuggestionPopover keyboard navigation pattern.
 */

import React, { useState, useRef, useEffect, useCallback, useId, lazy, Suspense } from 'react';
import { Package, Search, X, Loader2, Users } from 'lucide-react';
import { useProductSearch } from '../../hooks/useProductSearch';
import type { Product } from '../../utils/repositories/productRepository';
import { getFamiliesByProductCode } from '../../utils/repositories/familyRepository';

const FamilyManager = lazy(() => import('../modals/FamilyManager'));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProductSelection {
    codigo: string;
    descripcion: string;
    lineaCode: string;
    lineaName: string;
    /** true if picked from catalog, false if user typed free text */
    isFromCatalog: boolean;
    /** Product DB id (for family lookups) */
    productId?: number;
    /** Family members (if product belongs to a family) */
    familyMembers?: Array<{ codigo: string; descripcion: string; isPrimary: boolean }>;
    /** Family name (if product belongs to exactly one family) */
    familyName?: string;
}

export interface ProductSelectorProps {
    /** Current value (part number / codigo) */
    value: string;
    /** Called when user selects a product or finishes typing */
    onProductSelect: (selection: ProductSelection) => void;
    /** Called on every keystroke (for existing onChange handlers) */
    onTextChange?: (value: string) => void;
    /** Placeholder text */
    placeholder?: string;
    /** Read-only mode */
    readOnly?: boolean;
    /** Max length for the input */
    maxLength?: number;
    /** Additional CSS classes for the wrapper */
    className?: string;
    /** Name attribute for form compatibility */
    name?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ProductSelector: React.FC<ProductSelectorProps> = ({
    value,
    onProductSelect,
    onTextChange,
    placeholder = 'Buscar por código o descripción...',
    readOnly = false,
    maxLength = 50,
    className = '',
    name,
}) => {
    const instanceId = useId();
    const listboxId = `product-selector-listbox-${instanceId}`;

    const { query, setQuery, results, isLoading, customerLines, selectedLine, setSelectedLine, clearSearch, setBrowseAll } = useProductSearch();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showFamilyManager, setShowFamilyManager] = useState(false);

    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Sync query with external value when component receives new value
    const prevValueRef = useRef(value);
    useEffect(() => {
        if (value !== prevValueRef.current) {
            prevValueRef.current = value;
            // Don't update query if dropdown is open (user is searching)
            if (!isOpen) {
                setQuery(value);
            }
        }
    }, [value, isOpen, setQuery]);

    // Reset selection when results change
    useEffect(() => {
        setSelectedIndex(0);
    }, [results]);

    // Scroll selected item into view
    useEffect(() => {
        if (!listRef.current || !isOpen) return;
        const items = listRef.current.querySelectorAll('[data-product-item]');
        if (items[selectedIndex] && typeof items[selectedIndex].scrollIntoView === 'function') {
            items[selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex, isOpen]);

    // Click outside closes dropdown
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setBrowseAll(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [setBrowseAll]);

    const handleSelect = useCallback(async (product: Product) => {
        // Look up family for this product
        let familyMembers: ProductSelection['familyMembers'];
        let familyName: string | undefined;

        try {
            const families = await getFamiliesByProductCode(product.codigo, product.lineaCode);
            if (families.length > 0) {
                familyName = families[0].name;
                // Import dynamically to avoid circular deps
                const { getFamilyMembers } = await import('../../utils/repositories/familyRepository');
                const members = await getFamilyMembers(families[0].id);
                familyMembers = members.map(m => ({
                    codigo: m.codigo ?? '',
                    descripcion: m.descripcion ?? '',
                    isPrimary: m.isPrimary,
                }));
            }
        } catch {
            // Family lookup is optional — proceed without it
        }

        onProductSelect({
            codigo: product.codigo,
            descripcion: product.descripcion,
            lineaCode: product.lineaCode,
            lineaName: product.lineaName,
            isFromCatalog: true,
            productId: product.id,
            familyMembers,
            familyName,
        });
        onTextChange?.(product.codigo);
        setQuery(product.codigo);
        prevValueRef.current = product.codigo;
        setIsOpen(false);
        setBrowseAll(false);
    }, [onProductSelect, onTextChange, setQuery, setBrowseAll]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        onTextChange?.(val);
        if (val.length >= 2) {
            setIsOpen(true);
        }
    }, [setQuery, onTextChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!isOpen || results.length === 0) {
            if (e.key === 'ArrowDown' && query.length >= 2 && results.length > 0) {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < results.length) {
                    handleSelect(results[selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                setBrowseAll(false);
                break;
            case 'Tab':
                setIsOpen(false);
                setBrowseAll(false);
                break;
        }
    }, [isOpen, results, selectedIndex, query, handleSelect, setBrowseAll]);

    const handleFocus = useCallback(() => {
        if (query.length >= 2 && results.length > 0 && !readOnly) {
            setIsOpen(true);
        }
    }, [query, results, readOnly]);

    const handleToggle = useCallback(() => {
        if (readOnly) return;
        if (isOpen) {
            setIsOpen(false);
            setBrowseAll(false);
        } else {
            // Enable browse-all mode to show products without min query length
            setBrowseAll(true);
            setIsOpen(true);
            inputRef.current?.focus();
        }
    }, [readOnly, isOpen, setBrowseAll]);

    const handleClear = useCallback(() => {
        clearSearch();
        onTextChange?.('');
        inputRef.current?.focus();
    }, [clearSearch, onTextChange]);

    const showDropdown = isOpen && !readOnly && (results.length > 0 || isLoading);

    return (
        <div ref={wrapperRef} className={`relative ${className}`}>
            {/* Input with icons */}
            <div className="relative">
                <Package size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                    ref={inputRef}
                    name={name}
                    type="text"
                    value={isOpen ? query : value}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={handleFocus}
                    readOnly={readOnly}
                    maxLength={maxLength}
                    placeholder={placeholder}
                    role="combobox"
                    aria-expanded={showDropdown}
                    aria-autocomplete="list"
                    aria-controls={showDropdown ? listboxId : undefined}
                    aria-activedescendant={showDropdown && results.length > 0 ? `${instanceId}-product-option-${selectedIndex}` : undefined}
                    className={`w-full pl-8 pr-16 py-2 border border-gray-300 bg-gray-50 rounded-lg text-sm
                        focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors
                        ${readOnly ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''}
                    `}
                    tabIndex={readOnly ? -1 : 0}
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    {isLoading && (
                        <Loader2 size={14} className="text-blue-400 animate-spin" />
                    )}
                    {value && !readOnly && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            tabIndex={-1}
                            aria-label="Limpiar selección"
                        >
                            <X size={12} />
                        </button>
                    )}
                    {!readOnly && (
                        <button
                            type="button"
                            onClick={handleToggle}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            tabIndex={-1}
                            aria-label="Buscar producto"
                        >
                            <Search size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Dropdown */}
            {showDropdown && (
                <div
                    className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
                    onMouseDown={e => e.preventDefault()}
                >
                    {/* Line filter */}
                    {customerLines.length > 0 && (
                        <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                            <span className="text-[10px] font-medium text-gray-500 whitespace-nowrap">Línea:</span>
                            <select
                                value={selectedLine}
                                onChange={e => setSelectedLine(e.target.value)}
                                className="flex-1 text-[11px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
                                onMouseDown={e => e.stopPropagation()}
                            >
                                <option value="">Todas las líneas</option>
                                {customerLines.map(line => (
                                    <option key={line.code} value={line.code}>
                                        {line.name} ({line.productCount})
                                    </option>
                                ))}
                            </select>
                            {selectedLine && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedLine('')}
                                    className="text-gray-400 hover:text-gray-600"
                                    onMouseDown={e => e.stopPropagation()}
                                >
                                    <X size={10} />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Results list */}
                    <div
                        ref={listRef}
                        role="listbox"
                        id={listboxId}
                        className="max-h-[240px] overflow-y-auto"
                    >
                        {results.map((product, idx) => (
                            <div
                                key={`${product.lineaCode}-${product.codigo}-${idx}`}
                                id={`${instanceId}-product-option-${idx}`}
                                data-product-item
                                role="option"
                                aria-selected={idx === selectedIndex}
                                onClick={() => handleSelect(product)}
                                className={`px-2.5 py-1.5 cursor-pointer transition-colors border-b border-gray-50 last:border-b-0 ${
                                    idx === selectedIndex
                                        ? 'bg-blue-50 text-gray-900'
                                        : 'text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex items-baseline gap-2">
                                    <span className="text-[11px] font-mono font-semibold text-blue-700 shrink-0">
                                        {product.codigo}
                                    </span>
                                    <span className="text-[10px] text-gray-500 truncate">
                                        {product.descripcion}
                                    </span>
                                </div>
                                <div className="text-[9px] text-gray-400 mt-0.5">
                                    {product.lineaName}
                                </div>
                            </div>
                        ))}

                        {isLoading && results.length === 0 && (
                            <div className="px-3 py-4 text-center">
                                <Loader2 size={16} className="text-blue-400 animate-spin mx-auto" />
                                <span className="text-[10px] text-gray-400 mt-1 block">Buscando...</span>
                            </div>
                        )}

                        {!isLoading && results.length === 0 && (
                            <div className="px-3 py-3 text-center">
                                <span className="text-[10px] text-gray-400">
                                    Sin resultados. Puede escribir el número manualmente.
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Footer with hints and family manager link */}
                    <div className="px-2 py-1 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-[8px] text-gray-400">
                            ↑↓ navegar · Enter seleccionar · Esc cerrar
                        </span>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(false);
                                setBrowseAll(false);
                                setShowFamilyManager(true);
                            }}
                            className="flex items-center gap-1 text-[9px] text-purple-500 hover:text-purple-700 transition-colors"
                            onMouseDown={e => e.stopPropagation()}
                        >
                            <Users size={10} />
                            Familias
                        </button>
                    </div>
                </div>
            )}

            {/* Family Manager Modal */}
            {showFamilyManager && (
                <Suspense fallback={null}>
                    <FamilyManager onClose={() => setShowFamilyManager(false)} />
                </Suspense>
            )}
        </div>
    );
};

export default ProductSelector;
