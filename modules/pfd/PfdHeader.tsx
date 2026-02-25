/**
 * PFD Header — Collapsible metadata editor
 *
 * C3-V1: Compact 2x2 layout (Producto+Documento / Organizacion+Aprobaciones).
 * Cyan/teal color theme.
 */

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { PfdHeader as PfdHeaderType } from './pfdTypes';

interface Props {
    header: PfdHeaderType;
    onChange: (field: keyof PfdHeaderType, value: string) => void;
    collapsed: boolean;
    onToggleCollapse: () => void;
    readOnly?: boolean;
}

const inputClass = "w-full border border-gray-300 bg-gray-50 p-1.5 rounded text-sm focus:ring-2 focus:ring-cyan-100 focus:border-cyan-400 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed";
const labelClass = "block text-[11px] font-medium text-gray-600 mb-0.5";

const PfdHeaderComponent: React.FC<Props> = ({ header, onChange, collapsed, onToggleCollapse, readOnly }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.name as keyof PfdHeaderType, e.target.value);
    };

    const headerSummary = [
        header.partNumber && `Pieza: ${header.partNumber}`,
        header.partName,
        header.customerName && `Cliente: ${header.customerName}`,
        header.documentNumber && `Doc: ${header.documentNumber}`,
        header.revisionLevel && `Rev. ${header.revisionLevel}`,
    ].filter(Boolean).join('  |  ') || 'Sin datos del documento';

    return (
        <div className="bg-white border-b border-gray-200">
            <button
                onClick={onToggleCollapse}
                className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-cyan-50/50 transition"
            >
                {collapsed ? <ChevronRight size={16} className="text-cyan-600" /> : <ChevronDown size={16} className="text-cyan-600" />}
                <span className="text-xs font-semibold text-cyan-700 uppercase tracking-wider">Encabezado</span>
                <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">I-AC-005.1</span>
                {collapsed && <span className="text-xs text-gray-500 ml-2 truncate">{headerSummary}</span>}
            </button>

            {!collapsed && (
                <div className="px-4 pb-3">
                    <div className="grid grid-cols-2 gap-3">
                        <fieldset className="border border-gray-200 rounded-lg p-2.5">
                            <legend className="text-[11px] font-semibold text-cyan-700 px-1.5">Identificación del Producto</legend>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={labelClass}>Nº de Pieza</label>
                                    <input name="partNumber" value={header.partNumber} onChange={handleChange} className={inputClass} disabled={readOnly} />
                                </div>
                                <div>
                                    <label className={labelClass}>Nombre de la Pieza</label>
                                    <input name="partName" value={header.partName} onChange={handleChange} className={inputClass} disabled={readOnly} />
                                </div>
                                <div>
                                    <label className={labelClass}>Nivel de Cambio Ing.</label>
                                    <input name="engineeringChangeLevel" value={header.engineeringChangeLevel} onChange={handleChange} className={inputClass} disabled={readOnly} />
                                </div>
                                <div>
                                    <label className={labelClass}>Modelo / Año</label>
                                    <input name="modelYear" value={header.modelYear} onChange={handleChange} className={inputClass} disabled={readOnly} />
                                </div>
                            </div>
                        </fieldset>

                        <fieldset className="border border-gray-200 rounded-lg p-2.5">
                            <legend className="text-[11px] font-semibold text-cyan-700 px-1.5">Control del Documento</legend>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className={labelClass}>Nº de Documento</label>
                                    <input name="documentNumber" value={header.documentNumber} onChange={handleChange} className={inputClass} disabled={readOnly} />
                                </div>
                                <div>
                                    <label className={labelClass}>Revisión</label>
                                    <input name="revisionLevel" value={header.revisionLevel} onChange={handleChange} className={inputClass} disabled={readOnly} />
                                </div>
                                <div>
                                    <label className={labelClass}>Fecha de Revisión</label>
                                    <input name="revisionDate" type="date" value={header.revisionDate} onChange={handleChange} className={inputClass} disabled={readOnly} />
                                </div>
                            </div>
                        </fieldset>

                        <fieldset className="border border-gray-200 rounded-lg p-2.5">
                            <legend className="text-[11px] font-semibold text-cyan-700 px-1.5">Organización</legend>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className={labelClass}>Empresa</label>
                                    <input name="companyName" value={header.companyName} onChange={handleChange} className={inputClass} disabled={readOnly} />
                                </div>
                                <div>
                                    <label className={labelClass}>Planta</label>
                                    <input name="plantLocation" value={header.plantLocation} onChange={handleChange} className={inputClass} disabled={readOnly} />
                                </div>
                                <div>
                                    <label className={labelClass}>Código Proveedor</label>
                                    <input name="supplierCode" value={header.supplierCode} onChange={handleChange} className={inputClass} disabled={readOnly} />
                                </div>
                                <div>
                                    <label className={labelClass}>Cliente</label>
                                    <input name="customerName" value={header.customerName} onChange={handleChange} className={inputClass} disabled={readOnly} />
                                </div>
                                <div>
                                    <label className={labelClass}>Equipo Multifuncional</label>
                                    <input name="coreTeam" value={header.coreTeam} onChange={handleChange} className={inputClass} disabled={readOnly} />
                                </div>
                                <div>
                                    <label className={labelClass}>Contacto Clave</label>
                                    <input name="keyContact" value={header.keyContact} onChange={handleChange} className={inputClass} disabled={readOnly} />
                                </div>
                            </div>
                        </fieldset>

                        <fieldset className="border border-gray-200 rounded-lg p-2.5">
                            <legend className="text-[11px] font-semibold text-cyan-700 px-1.5">Aprobaciones</legend>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={labelClass}>Elaboró</label>
                                    <input name="preparedBy" value={header.preparedBy} onChange={handleChange} className={inputClass} disabled={readOnly} />
                                </div>
                                <div>
                                    <label className={labelClass}>Fecha Elaboración</label>
                                    <input name="preparedDate" type="date" value={header.preparedDate} onChange={handleChange} className={inputClass} disabled={readOnly} />
                                </div>
                                <div>
                                    <label className={labelClass}>Aprobó</label>
                                    <input name="approvedBy" value={header.approvedBy} onChange={handleChange} className={inputClass} disabled={readOnly} />
                                </div>
                                <div>
                                    <label className={labelClass}>Fecha Aprobación</label>
                                    <input name="approvedDate" type="date" value={header.approvedDate} onChange={handleChange} className={inputClass} disabled={readOnly} />
                                </div>
                            </div>
                        </fieldset>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PfdHeaderComponent;
