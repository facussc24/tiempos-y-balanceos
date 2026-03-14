/**
 * HoHeaderForm — Collapsible header for standalone HO documents.
 * Provides ProductSelector for part number selection and auto-fills
 * client, partDescription, and applicableParts from the product catalog.
 *
 * Only shown in standalone mode (not when embedded in AMFE).
 */

import React, { useCallback, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { HoDocumentHeader } from './hojaOperacionesTypes';
import ProductSelector from '../../components/ui/ProductSelector';
import type { ProductSelection } from '../../components/ui/ProductSelector';
import { resolveApplicableParts } from '../../utils/productFamilyAutoFill';

interface Props {
    header: HoDocumentHeader;
    onUpdateHeader: (field: keyof HoDocumentHeader, value: string) => void;
    readOnly?: boolean;
}

const inputClass = "w-full border border-gray-300 bg-gray-50 p-1.5 rounded text-sm focus:ring-2 focus:ring-slate-100 focus:border-slate-400 outline-none transition";
const labelClass = "block text-[11px] font-medium text-gray-600 mb-0.5";

const HoHeaderForm: React.FC<Props> = ({ header, onUpdateHeader, readOnly }) => {
    const [collapsed, setCollapsed] = useState(true);

    const handleProductSelect = useCallback((sel: ProductSelection) => {
        onUpdateHeader('partNumber', sel.codigo);
        onUpdateHeader('partDescription', sel.descripcion);
        onUpdateHeader('client', sel.lineaName);

        // Auto-fill applicableParts with family members (or line siblings)
        if (sel.isFromCatalog && sel.lineaCode) {
            resolveApplicableParts(sel.codigo, sel.lineaCode)
                .then(parts => {
                    if (parts) onUpdateHeader('applicableParts', parts);
                })
                .catch(() => {});
        }
    }, [onUpdateHeader]);

    const headerSummary = [
        header.partNumber && `Pieza: ${header.partNumber}`,
        header.partDescription,
        header.client && `Cliente: ${header.client}`,
    ].filter(Boolean).join('  |  ') || 'Sin datos del encabezado';

    return (
        <div className="bg-white border-b border-gray-200">
            <button
                onClick={() => setCollapsed(v => !v)}
                className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-slate-50/50 transition"
                title={collapsed ? 'Expandir encabezado' : 'Colapsar encabezado'}
            >
                {collapsed ? <ChevronRight size={16} className="text-slate-600" /> : <ChevronDown size={16} className="text-slate-600" />}
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Encabezado</span>
                <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{header.formNumber}</span>
                {collapsed && <span className="text-xs text-gray-500 ml-2 truncate" title={headerSummary}>{headerSummary}</span>}
            </button>

            {!collapsed && (
                <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-2">
                    {/* Part Number (with ProductSelector) */}
                    <div>
                        <label className={labelClass}>Nro. Pieza</label>
                        <ProductSelector
                            name="partNumber"
                            value={header.partNumber}
                            onProductSelect={handleProductSelect}
                            onTextChange={(val) => onUpdateHeader('partNumber', val)}
                            readOnly={readOnly}
                            placeholder="Buscar o escribir nro. pieza..."
                            maxLength={50}
                        />
                    </div>

                    {/* Part Description */}
                    <div>
                        <label className={labelClass}>Descripción</label>
                        <input
                            type="text"
                            value={header.partDescription}
                            onChange={e => onUpdateHeader('partDescription', e.target.value)}
                            readOnly={readOnly}
                            className={inputClass}
                            placeholder="Descripción del producto"
                            maxLength={200}
                        />
                    </div>

                    {/* Client */}
                    <div>
                        <label className={labelClass}>Cliente</label>
                        <input
                            type="text"
                            value={header.client}
                            onChange={e => onUpdateHeader('client', e.target.value)}
                            readOnly={readOnly}
                            className={inputClass}
                            placeholder="Nombre del cliente"
                            maxLength={100}
                        />
                    </div>

                    {/* Organization */}
                    <div>
                        <label className={labelClass}>Organización</label>
                        <input
                            type="text"
                            value={header.organization}
                            onChange={e => onUpdateHeader('organization', e.target.value)}
                            readOnly={readOnly}
                            className={inputClass}
                            placeholder="Organización"
                            maxLength={100}
                        />
                    </div>

                    {/* Applicable Parts (full width) */}
                    <div className="col-span-2">
                        <label className={labelClass}>Piezas Aplicables (familia)</label>
                        <textarea
                            value={header.applicableParts}
                            onChange={e => onUpdateHeader('applicableParts', e.target.value)}
                            readOnly={readOnly}
                            className={`${inputClass} resize-none`}
                            rows={2}
                            placeholder="Una pieza por línea (se completa automáticamente al seleccionar producto)"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default HoHeaderForm;
