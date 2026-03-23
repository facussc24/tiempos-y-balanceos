import React, { useMemo, useCallback } from 'react';
import { LayoutList, ChevronDown, ChevronUp } from 'lucide-react';
import { AmfeHeaderData } from './amfeTypes';
import ProductSelector from '../../components/ui/ProductSelector';
import type { ProductSelection } from '../../components/ui/ProductSelector';
import { resolveApplicableParts } from '../../utils/productFamilyAutoFill';

interface AmfeHeaderFormProps {
    header: AmfeHeaderData;
    onHeaderChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
    headerCollapsed: boolean;
    onToggleCollapsed: () => void;
    readOnly?: boolean;
    /** Called when a product is selected from the catalog — auto-fills partNumber + client */
    onProductSelect?: (fields: Partial<AmfeHeaderData>) => void;
}

const INPUT_CLASS = "w-full border border-gray-300 bg-gray-50 p-2 rounded focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition";
const INPUT_READONLY_CLASS = "w-full border border-gray-200 bg-gray-100 p-2 rounded outline-none text-gray-700 cursor-default";
const REQUIRED_FIELDS = [
    'organization', 'location', 'client', 'modelYear', 'subject', 'startDate', 'revDate',
    'team', 'amfeNumber', 'responsible', 'processResponsible', 'confidentiality', 'partNumber',
] as const;

const RequiredMark = () => <span className="text-red-500 ml-0.5">*</span>;

const AmfeHeaderForm: React.FC<AmfeHeaderFormProps> = ({
    header,
    onHeaderChange,
    headerCollapsed,
    onToggleCollapsed,
    readOnly,
    onProductSelect,
}) => {
    const handleProductSelect = useCallback((sel: ProductSelection) => {
        // Immediate auto-fill: partNumber + client + scope
        const fields: Partial<AmfeHeaderData> = {
            partNumber: sel.codigo,
            client: sel.lineaName,
        };
        if (sel.isFromCatalog && sel.descripcion) {
            fields.scope = `${sel.descripcion} — ${sel.lineaName}`;
        }
        onProductSelect?.(fields);

        // Async: fill applicableParts with family members (or line siblings as fallback)
        if (sel.isFromCatalog && sel.lineaCode) {
            resolveApplicableParts(sel.codigo, sel.lineaCode)
                .then(parts => {
                    if (parts) onProductSelect?.({ applicableParts: parts });
                })
                .catch(() => { /* silently fail — optional enrichment */ });
        }
    }, [onProductSelect]);
    const hasEmptyRequiredHeaders = useMemo(() => {
        return REQUIRED_FIELDS.some(f => !header[f]);
    }, [header]);

    const getInputClass = useCallback((field: string) => {
        if (readOnly) return INPUT_READONLY_CLASS;
        const isRequired = (REQUIRED_FIELDS as readonly string[]).includes(field);
        const isEmpty = !header[field as keyof typeof header];
        return isRequired && isEmpty
            ? `${INPUT_CLASS} border-l-2 border-l-amber-400`
            : INPUT_CLASS;
    }, [header, readOnly]);

    const inputClass = readOnly ? INPUT_READONLY_CLASS : INPUT_CLASS;
    const handleChange = readOnly ? undefined : onHeaderChange;

    return (
        <div className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-[1800px] mx-auto">
                {/* Collapsed summary / toggle bar */}
                <button
                    onClick={onToggleCollapsed}
                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition text-left"
                >
                    <LayoutList className="text-blue-600 flex-shrink-0" size={16} />
                    <span className="text-xs font-bold text-gray-700">Datos del Proyecto</span>
                    {headerCollapsed && (
                        <div className="flex items-center gap-3 ml-2 text-[11px] text-gray-500 truncate flex-1 min-w-0">
                            <span className="truncate" title={header.amfeNumber || 'Nro. AMFE'}>{header.amfeNumber || <span className="text-gray-300 italic">Nro. AMFE</span>}</span>
                            <span className="text-gray-300">|</span>
                            <span className="truncate" title={header.organization || 'Organización'}>{header.organization || <span className="text-gray-300 italic">Organización</span>}</span>
                            <span className="text-gray-300">|</span>
                            <span className="truncate" title={header.client || 'Cliente'}>{header.client || <span className="text-gray-300 italic">Cliente</span>}</span>
                            <span className="text-gray-300">|</span>
                            <span className="truncate" title={header.subject || 'Tema'}>{header.subject || <span className="text-gray-300 italic">Tema</span>}</span>
                            <span className="text-gray-300">|</span>
                            <span className="truncate" title={header.partNumber || 'Nro. Pieza'}>{header.partNumber || <span className="text-gray-300 italic">Nro. Pieza</span>}</span>
                            <span className="text-gray-300">|</span>
                            <span className="truncate" title={header.responsible || 'Responsable'}>{header.responsible || <span className="text-gray-300 italic">Responsable</span>}</span>
                            {header.applicableParts?.trim() && (<>
                                <span className="text-gray-300">|</span>
                                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0">Familia</span>
                            </>)}
                        </div>
                    )}
                    {hasEmptyRequiredHeaders && headerCollapsed && (
                        <span className="flex-shrink-0" title="Campos obligatorios vacíos">
                            <span className="block w-2 h-2 rounded-full bg-amber-400" aria-hidden="true" />
                            <span className="sr-only">Campos obligatorios vacíos</span>
                        </span>
                    )}
                    {headerCollapsed ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronUp size={14} className="text-gray-400 flex-shrink-0" />}
                </button>

                {/* Expanded form */}
                {!headerCollapsed && (
                <div className="px-4 pb-4 pt-1">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                    <div>
                        <label className="block text-gray-500 font-bold mb-1">Organización<RequiredMark /></label>
                        <input name="organization" value={header.organization} onChange={handleChange} readOnly={readOnly} placeholder="Nombre de la empresa" maxLength={100} className={getInputClass('organization')} />
                    </div>
                    <div>
                        <label className="block text-gray-500 font-bold mb-1">Ubicación<RequiredMark /></label>
                        <input name="location" value={header.location} onChange={handleChange} readOnly={readOnly} placeholder="Planta / Ciudad" maxLength={100} className={getInputClass('location')} />
                    </div>
                    <div>
                        <label className="block text-gray-500 font-bold mb-1">Cliente<RequiredMark /></label>
                        <input name="client" value={header.client} onChange={handleChange} readOnly={readOnly} placeholder="Nombre del cliente" maxLength={100} className={getInputClass('client')} />
                    </div>
                    <div>
                        <label className="block text-gray-500 font-bold mb-1">Modelo/Año<RequiredMark /></label>
                        <input name="modelYear" value={header.modelYear} onChange={handleChange} readOnly={readOnly} placeholder="Ej: 2026 / Plataforma X" maxLength={100} className={getInputClass('modelYear')} />
                    </div>
                    <div>
                        <label className="block text-gray-500 font-bold mb-1">Tema / Proyecto<RequiredMark /></label>
                        <input name="subject" value={header.subject} onChange={handleChange} readOnly={readOnly} placeholder="Proceso o pieza analizada" maxLength={150} className={getInputClass('subject')} />
                    </div>
                    <div>
                        <label className="block text-gray-500 font-bold mb-1">Nro. Pieza<RequiredMark /></label>
                        <ProductSelector
                            name="partNumber"
                            value={header.partNumber}
                            onProductSelect={handleProductSelect}
                            onTextChange={(val) => {
                                const synth = { target: { name: 'partNumber', value: val } } as React.ChangeEvent<HTMLInputElement>;
                                handleChange?.(synth);
                            }}
                            readOnly={readOnly}
                            placeholder="Buscar o escribir nro. pieza..."
                            maxLength={50}
                        />
                    </div>
                    <div>
                        <label className="block text-gray-500 font-bold mb-1">Fecha Inicio<RequiredMark /></label>
                        <input name="startDate" type="date" value={header.startDate} onChange={handleChange} readOnly={readOnly} className={getInputClass('startDate')} />
                    </div>
                    <div>
                        <label className="block text-gray-500 font-bold mb-1">Fecha Revisión<RequiredMark /></label>
                        <input name="revDate" type="date" value={header.revDate} onChange={handleChange} readOnly={readOnly} className={getInputClass('revDate')} />
                    </div>
                    <div>
                        <label className="block text-gray-500 font-bold mb-1">Nro. AMFE<RequiredMark /></label>
                        <input name="amfeNumber" value={header.amfeNumber} onChange={handleChange} readOnly={readOnly} placeholder="Ej: AMFE-2026-001" maxLength={30} className={getInputClass('amfeNumber')} />
                    </div>
                    <div>
                        <label className="block text-gray-500 font-bold mb-1">Responsable AMFE<RequiredMark /></label>
                        <input name="responsible" value={header.responsible} onChange={handleChange} readOnly={readOnly} placeholder="Nombre del responsable" maxLength={80} className={getInputClass('responsible')} />
                    </div>
                    <div>
                        <label className="block text-gray-500 font-bold mb-1">Resp. del Proceso<RequiredMark /></label>
                        <input name="processResponsible" value={header.processResponsible} onChange={handleChange} readOnly={readOnly} placeholder="Dueño del proceso" maxLength={80} className={getInputClass('processResponsible')} />
                    </div>
                    <div>
                        <label className="block text-gray-500 font-bold mb-1">Equipo Multifuncional<RequiredMark /></label>
                        <input name="team" value={header.team} onChange={handleChange} readOnly={readOnly} placeholder="Miembros del equipo" maxLength={300} className={getInputClass('team')} />
                    </div>
                    <div>
                        <label className="block text-gray-500 font-bold mb-1">Revisión</label>
                        <input name="revision" value={header.revision} onChange={handleChange} readOnly={readOnly} placeholder="Ej: Rev. A" maxLength={20} className={inputClass} />
                    </div>
                    <div>
                        <label className="block text-gray-500 font-bold mb-1">Confidencialidad<RequiredMark /></label>
                        {readOnly ? (
                            <input name="confidentiality" value={header.confidentiality} readOnly className={INPUT_READONLY_CLASS} />
                        ) : (
                            <select name="confidentiality" value={header.confidentiality} onChange={handleChange} className={getInputClass('confidentiality')}>
                                <option value="">Seleccionar...</option>
                                <option value="Confidencial">Confidencial</option>
                                <option value="Interno">Interno</option>
                                <option value="Publico">Público</option>
                            </select>
                        )}
                    </div>
                    <div>
                        <label className="block text-gray-500 font-bold mb-1">Aprobado por</label>
                        <input name="approvedBy" value={header.approvedBy} onChange={handleChange} readOnly={readOnly} placeholder="Nombre del aprobador" maxLength={80} className={inputClass} />
                    </div>
                    <div>
                        <label className="block text-gray-500 font-bold mb-1">Alcance / Familia</label>
                        <input name="scope" value={header.scope} onChange={handleChange} readOnly={readOnly} placeholder="Ej: Familia espejos retrovisores izq/der" maxLength={200} className={inputClass} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-gray-500 font-bold mb-1">Piezas Aplicables</label>
                        <textarea name="applicableParts" value={header.applicableParts || ''} onChange={handleChange} readOnly={readOnly} rows={2} placeholder="Listar nros de pieza cubiertos (uno por línea). Dejar vacío si es pieza única." className={inputClass + ' resize-y'} />
                        <p className="text-[10px] text-gray-400 mt-0.5">Para Family FMEA (AIAG-VDA): listar todas las piezas similares que cubre este análisis.</p>
                    </div>
                </div>
                </div>
                )}
            </div>
        </div>
    );
};

export default AmfeHeaderForm;
