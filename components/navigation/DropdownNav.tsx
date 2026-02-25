/**
 * DropdownNav - Menú desplegable para navegación por fases
 * 
 * Agrupa tabs relacionados en un dropdown para reducir la carga cognitiva.
 * 
 * @module DropdownNav
 * @version 4.3.0 - Added arrow key navigation (H-02)
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

export interface NavSubItem {
    id: string;
    label: string;
    icon?: React.ComponentType<{ size?: number }>;
}

interface DropdownNavProps {
    label: string;
    icon: React.ComponentType<{ size?: number }>;
    items: NavSubItem[];
    activeTab: string;
    onNavigate: (tabId: string) => void;
    className?: string;
}

export const DropdownNav: React.FC<DropdownNavProps> = ({
    label,
    icon: Icon,
    items,
    activeTab,
    onNavigate,
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Cerrar al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setFocusedIndex(-1);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Reset focus index when menu closes
    useEffect(() => {
        if (!isOpen) {
            setFocusedIndex(-1);
        }
    }, [isOpen]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
        switch (event.key) {
            case 'Escape':
                event.preventDefault();
                setIsOpen(false);
                buttonRef.current?.focus();
                break;

            case 'ArrowDown':
                event.preventDefault();
                if (!isOpen) {
                    setIsOpen(true);
                    setFocusedIndex(0);
                } else {
                    setFocusedIndex(prev =>
                        prev < items.length - 1 ? prev + 1 : 0
                    );
                }
                break;

            case 'ArrowUp':
                event.preventDefault();
                if (isOpen) {
                    setFocusedIndex(prev =>
                        prev > 0 ? prev - 1 : items.length - 1
                    );
                }
                break;

            case 'Enter':
            case ' ':
                event.preventDefault();
                if (isOpen && focusedIndex >= 0) {
                    onNavigate(items[focusedIndex].id);
                    setIsOpen(false);
                    buttonRef.current?.focus();
                } else if (!isOpen) {
                    setIsOpen(true);
                    setFocusedIndex(0);
                }
                break;

            case 'Tab':
                // Allow Tab to close menu and move focus naturally
                if (isOpen) {
                    setIsOpen(false);
                }
                break;

            case 'Home':
                if (isOpen) {
                    event.preventDefault();
                    setFocusedIndex(0);
                }
                break;

            case 'End':
                if (isOpen) {
                    event.preventDefault();
                    setFocusedIndex(items.length - 1);
                }
                break;
        }
    }, [isOpen, focusedIndex, items, onNavigate]);

    // Determinar si algún item está activo
    const hasActiveChild = items.some(item => item.id === activeTab);

    return (
        <div
            ref={dropdownRef}
            className={`relative ${className}`}
            onKeyDown={handleKeyDown}
        >
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all whitespace-nowrap text-sm font-medium ${hasActiveChild
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-controls={isOpen ? 'dropdown-menu' : undefined}
            >
                <Icon size={18} />
                {label}
                <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div
                    ref={menuRef}
                    id="dropdown-menu"
                    className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[180px] z-50 animate-fade-in"
                    role="menu"
                    aria-activedescendant={focusedIndex >= 0 ? `menu-item-${items[focusedIndex].id}` : undefined}
                >
                    {items.map((item, index) => (
                        <button
                            key={item.id}
                            id={`menu-item-${item.id}`}
                            onClick={() => {
                                onNavigate(item.id);
                                setIsOpen(false);
                            }}
                            onMouseEnter={() => setFocusedIndex(index)}
                            className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors outline-none ${focusedIndex === index
                                    ? 'bg-blue-50 text-blue-600'
                                    : activeTab === item.id
                                        ? 'bg-blue-50/50 text-blue-600 font-medium'
                                        : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            role="menuitem"
                            tabIndex={-1}
                        >
                            {item.icon && <item.icon size={16} />}
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
