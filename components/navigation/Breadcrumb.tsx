/**
 * Breadcrumb - Navegación contextual con ruta del proyecto
 * 
 * Muestra la ubicación actual del usuario:
 * Inicio > Cliente > Proyecto > Pieza > Vista Actual
 * 
 * @module Breadcrumb
 * @version 4.2.2
 */
import React from 'react';
import { Home, ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
    label: string;
    onClick?: () => void;
    isActive?: boolean;
}

interface BreadcrumbProps {
    items: BreadcrumbItem[];
    className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = '' }) => {
    if (items.length === 0) return null;

    return (
        <nav className={`flex items-center gap-1 text-sm ${className}`} aria-label="Breadcrumb">
            {items.map((item, index) => (
                <React.Fragment key={index}>
                    {index > 0 && (
                        <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
                    )}
                    {item.onClick && !item.isActive ? (
                        <button
                            onClick={item.onClick}
                            className="px-2 py-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 hover:shadow-sm hover:-translate-y-px rounded transition-all truncate max-w-[200px]"
                            title={item.label}
                        >
                            {index === 0 && <Home size={14} className="inline mr-1 -mt-0.5" />}
                            {item.label}
                        </button>
                    ) : (
                        <span
                            className={`px-2 py-1 truncate max-w-[200px] ${item.isActive
                                ? 'text-slate-800 font-medium'
                                : 'text-slate-500'
                                }`}
                            title={item.label}
                        >
                            {item.label}
                        </span>
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
};
