/**
 * SolicitudList — Sidebar list of existing solicitudes
 *
 * Displays a filterable, scrollable list with status badges,
 * tipo indicators, selection highlighting, and per-item delete button.
 */

import React, { useState, useMemo } from 'react';
import { Plus, Search, FileText, Trash2 } from 'lucide-react';
import type { SolicitudListItem } from './solicitudTypes';
import { STATUS_CONFIG } from './solicitudTypes';

interface SolicitudListProps {
    items: SolicitudListItem[];
    selectedId: string;
    onSelect: (id: string) => void;
    onNew: () => void;
    onDelete: (id: string) => void;
}

const SolicitudList: React.FC<SolicitudListProps> = ({
    items,
    selectedId,
    onSelect,
    onNew,
    onDelete,
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    // Filter items by search query (searches numero, codigo, descripcion, solicitante)
    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return items;
        const q = searchQuery.toLowerCase().trim();
        return items.filter(item =>
            item.solicitud_number.toLowerCase().includes(q) ||
            item.codigo.toLowerCase().includes(q) ||
            item.descripcion.toLowerCase().includes(q) ||
            item.solicitante.toLowerCase().includes(q)
        );
    }, [items, searchQuery]);

    return (
        <div className="flex flex-col h-full bg-white border-r border-gray-200">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-gray-700">Solicitudes</h2>
                    <button
                        onClick={onNew}
                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded transition shadow-sm"
                        title="Crear nueva solicitud"
                    >
                        <Plus size={14} />
                        Nueva
                    </button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <FileText size={32} className="text-gray-300 mb-3" />
                        <p className="text-xs text-gray-400 mb-3">
                            {items.length === 0
                                ? 'No hay solicitudes'
                                : 'Sin resultados para la búsqueda'}
                        </p>
                        {items.length === 0 && (
                            <button
                                onClick={onNew}
                                className="text-xs text-amber-600 hover:text-amber-700 font-medium transition"
                            >
                                Crear primera solicitud
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="py-1">
                        {filteredItems.map(item => {
                            const isSelected = item.id === selectedId;
                            const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.borrador;
                            const tipoBadge = item.tipo === 'producto'
                                ? { label: 'Producto', bg: 'bg-blue-50', text: 'text-blue-600' }
                                : { label: 'Insumo', bg: 'bg-purple-50', text: 'text-purple-600' };

                            return (
                                <div
                                    key={item.id}
                                    className={`group relative w-full text-left px-4 py-3 transition border-l-3 cursor-pointer ${
                                        isSelected
                                            ? 'bg-amber-50 border-l-amber-500'
                                            : 'bg-white border-l-transparent hover:bg-gray-50'
                                    }`}
                                    onClick={() => onSelect(item.id)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            onSelect(item.id);
                                        }
                                    }}
                                >
                                    {/* Delete button (visible on hover) */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(item.id);
                                        }}
                                        className="absolute right-2 top-2 p-1 rounded opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
                                        title="Eliminar solicitud"
                                    >
                                        <Trash2 size={12} />
                                    </button>

                                    {/* Row 1: Number + Tipo badge */}
                                    <div className="flex items-center justify-between mb-1 pr-6">
                                        <span className="text-xs font-bold text-gray-700">
                                            {item.solicitud_number || '(sin numero)'}
                                        </span>
                                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${tipoBadge.bg} ${tipoBadge.text}`}>
                                            {tipoBadge.label}
                                        </span>
                                    </div>

                                    {/* Row 2: Codigo + Descripcion */}
                                    <p className="text-xs text-gray-600 truncate" title={[item.codigo, item.descripcion].filter(Boolean).join(' - ')}>
                                        {item.codigo && (
                                            <span className="font-medium">{item.codigo}</span>
                                        )}
                                        {item.codigo && item.descripcion && ' - '}
                                        {item.descripcion
                                            ? item.descripcion.length > 30
                                                ? item.descripcion.slice(0, 30) + '...'
                                                : item.descripcion
                                            : ''}
                                    </p>

                                    {/* Row 3: Solicitante, Fecha, Status */}
                                    <div className="flex items-center justify-between mt-1.5">
                                        <span className="text-[10px] text-gray-400">
                                            {item.solicitante || 'Sin solicitante'}
                                            {item.fecha_solicitud && ` \u00B7 ${item.fecha_solicitud}`}
                                        </span>
                                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusCfg.bg} ${statusCfg.color}`}>
                                            {statusCfg.label}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SolicitudList;
