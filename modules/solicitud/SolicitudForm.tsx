/**
 * SolicitudForm — Main form component
 *
 * White card layout with amber accents, printable-friendly.
 * Displays header metadata, type selector, conditional fields,
 * PPAP notice for insumos, and observations.
 */

import React from 'react';
import { Package, ShoppingCart, AlertTriangle, FileText } from 'lucide-react';
import type {
    SolicitudDocument,
    SolicitudTipo,
    SolicitudHeader,
    SolicitudProducto,
    SolicitudInsumo,
} from './solicitudTypes';
import {
    DEPARTAMENTOS,
    UNIDADES_MEDIDA,
    SGC_FORM_NUMBER,
    DEFAULT_REVISION,
} from './solicitudTypes';
import barackLogo from '../../src/assets/barack_logo.png';

interface SolicitudFormProps {
    doc: SolicitudDocument;
    onUpdateHeader: (partial: Partial<SolicitudHeader>) => void;
    onUpdateProducto: (partial: Partial<SolicitudProducto>) => void;
    onUpdateInsumo: (partial: Partial<SolicitudInsumo>) => void;
    onSwitchTipo: (tipo: SolicitudTipo) => void;
    onSetObservaciones: (text: string) => void;
    readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Shared input styles
// ---------------------------------------------------------------------------

const inputBase = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition disabled:bg-gray-50 disabled:text-gray-500';
const labelBase = 'block text-xs font-semibold text-gray-600 mb-1';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SolicitudForm: React.FC<SolicitudFormProps> = ({
    doc,
    onUpdateHeader,
    onUpdateProducto,
    onUpdateInsumo,
    onSwitchTipo,
    onSetObservaciones,
    readOnly = false,
}) => {
    const { header, tipo, producto, insumo, observaciones } = doc;

    return (
        <div className="bg-white shadow-lg rounded-lg border border-gray-200 max-w-4xl mx-auto">
            {/* ---- HEADER ---- */}
            <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <img
                            src={barackLogo}
                            alt="Barack Mercosul"
                            className="h-12 w-auto object-contain"
                        />
                        <div>
                            <h1 className="text-base font-bold text-gray-800 tracking-wide uppercase">
                                Solicitud de Generación de Código
                            </h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {SGC_FORM_NUMBER} Rev. {DEFAULT_REVISION}
                            </p>
                        </div>
                    </div>
                    <FileText size={28} className="text-amber-500 opacity-60" />
                </div>
            </div>

            {/* ---- METADATA GRID ---- */}
            <div className="px-6 py-4 border-b border-gray-100">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Nro Solicitud */}
                    <div>
                        <label className={labelBase}>Nro. Solicitud</label>
                        <input
                            type="text"
                            value={header.solicitudNumber || '(auto)'}
                            readOnly
                            className={`${inputBase} bg-gray-50 text-gray-500 cursor-not-allowed`}
                        />
                    </div>

                    {/* Fecha */}
                    <div>
                        <label className={labelBase}>Fecha</label>
                        <input
                            type="date"
                            value={header.fechaSolicitud}
                            onChange={e => onUpdateHeader({ fechaSolicitud: e.target.value })}
                            disabled={readOnly}
                            className={inputBase}
                        />
                    </div>

                    {/* Solicitante */}
                    <div>
                        <label className={labelBase}>Solicitante</label>
                        <input
                            type="text"
                            placeholder="Nombre y apellido"
                            value={header.solicitante}
                            onChange={e => onUpdateHeader({ solicitante: e.target.value })}
                            disabled={readOnly}
                            className={inputBase}
                        />
                    </div>

                    {/* Area / Departamento */}
                    <div>
                        <label className={labelBase}>Área / Departamento</label>
                        <select
                            value={header.areaDepartamento}
                            onChange={e => onUpdateHeader({ areaDepartamento: e.target.value })}
                            disabled={readOnly}
                            className={inputBase}
                        >
                            <option value="">-- Seleccionar --</option>
                            {DEPARTAMENTOS.map(dep => (
                                <option key={dep} value={dep}>{dep}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* ---- TYPE SELECTOR ---- */}
            <div className="px-6 py-4 border-b border-gray-100">
                <label className={`${labelBase} mb-2`}>Tipo de Solicitud</label>
                <div className="flex gap-4">
                    <button
                        type="button"
                        onClick={() => !readOnly && onSwitchTipo('producto')}
                        disabled={readOnly}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition ${
                            tipo === 'producto'
                                ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm'
                                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                        <Package size={18} className={tipo === 'producto' ? 'text-amber-600' : 'text-gray-400'} />
                        Producto
                    </button>

                    <button
                        type="button"
                        onClick={() => !readOnly && onSwitchTipo('insumo')}
                        disabled={readOnly}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition ${
                            tipo === 'insumo'
                                ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm'
                                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                        <ShoppingCart size={18} className={tipo === 'insumo' ? 'text-amber-600' : 'text-gray-400'} />
                        Insumo
                    </button>
                </div>
            </div>

            {/* ---- CONDITIONAL FIELDS: PRODUCTO ---- */}
            {tipo === 'producto' && producto && (
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Package size={14} />
                        Datos del Producto
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className={labelBase}>Código</label>
                            <input
                                type="text"
                                placeholder="Código del producto"
                                value={producto.codigo}
                                onChange={e => onUpdateProducto({ codigo: e.target.value })}
                                disabled={readOnly}
                                className={inputBase}
                            />
                        </div>
                        <div>
                            <label className={labelBase}>Descripción</label>
                            <input
                                type="text"
                                placeholder="Descripción del producto"
                                value={producto.descripcion}
                                onChange={e => onUpdateProducto({ descripcion: e.target.value })}
                                disabled={readOnly}
                                className={inputBase}
                            />
                        </div>
                        <div>
                            <label className={labelBase}>Cliente</label>
                            <input
                                type="text"
                                placeholder="Nombre del cliente"
                                value={producto.cliente}
                                onChange={e => onUpdateProducto({ cliente: e.target.value })}
                                disabled={readOnly}
                                className={inputBase}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ---- CONDITIONAL FIELDS: INSUMO ---- */}
            {tipo === 'insumo' && insumo && (
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <ShoppingCart size={14} />
                        Datos del Insumo
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className={labelBase}>Código</label>
                            <input
                                type="text"
                                placeholder="Código del insumo"
                                value={insumo.codigo}
                                onChange={e => onUpdateInsumo({ codigo: e.target.value })}
                                disabled={readOnly}
                                className={inputBase}
                            />
                        </div>
                        <div>
                            <label className={labelBase}>Descripción</label>
                            <input
                                type="text"
                                placeholder="Descripción del insumo"
                                value={insumo.descripcion}
                                onChange={e => onUpdateInsumo({ descripcion: e.target.value })}
                                disabled={readOnly}
                                className={inputBase}
                            />
                        </div>
                        <div>
                            <label className={labelBase}>Unidad de Medida</label>
                            <select
                                value={insumo.unidadMedida}
                                onChange={e => onUpdateInsumo({ unidadMedida: e.target.value as SolicitudInsumo['unidadMedida'] })}
                                disabled={readOnly}
                                className={inputBase}
                            >
                                {UNIDADES_MEDIDA.map(um => (
                                    <option key={um.value} value={um.value}>{um.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Checkbox: requiere generacion interna */}
                    <div className="mt-4">
                        <label className="flex items-start gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={insumo.requiereGeneracionInterna}
                                onChange={e => onUpdateInsumo({ requiereGeneracionInterna: e.target.checked })}
                                disabled={readOnly}
                                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-400"
                            />
                            <span className="text-sm text-gray-700">
                                El código de proveedor no existe, se requiere generación interna
                            </span>
                        </label>
                    </div>
                </div>
            )}

            {/* ---- PPAP NOTICE (insumos only) ---- */}
            {tipo === 'insumo' && (
                <div className="px-6 py-4 border-b border-gray-100">
                    <div className="border-2 border-amber-400 bg-amber-50 rounded-lg px-4 py-3">
                        <div className="flex items-start gap-2">
                            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-amber-800">
                                    Aviso PPAP - Insumos
                                </p>
                                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                                    Para insumos nuevos que afecten la calidad del producto, se requiere
                                    aprobación de partes de producción (PPAP) según procedimiento P-09.1.
                                    Consulte con Calidad antes de solicitar la generación del código si
                                    el insumo será utilizado en procesos productivos.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ---- OBSERVACIONES ---- */}
            <div className="px-6 py-4 border-b border-gray-100">
                <label className={labelBase}>Observaciones</label>
                <textarea
                    placeholder="Notas adicionales, justificación, referencias..."
                    value={observaciones}
                    onChange={e => onSetObservaciones(e.target.value)}
                    disabled={readOnly}
                    rows={3}
                    className={`${inputBase} resize-none`}
                />
            </div>

            {/* ---- FOOTER ---- */}
            <div className="px-6 py-3 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">
                    Documento Interno - Barack Mercosul
                </p>
            </div>
        </div>
    );
};

export default SolicitudForm;
