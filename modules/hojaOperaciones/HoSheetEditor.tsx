/**
 * Sheet Editor — Main editing area for a single Hoja de Operaciones.
 * Layout replicates the real "HO 952 REV.06" paper format:
 *   Header (3-row table with logo) → Visual Aids + Steps → EPP → Quality Checks → Reaction Plan
 */

import React, { useState, useMemo } from 'react';
import { HojaOperacion, HoStep, PpeItem } from './hojaOperacionesTypes';
import HoPpeSelector from './HoPpeSelector';
import HoStepEditor from './HoStepEditor';
import HoQualityCheckTable from './HoQualityCheckTable';
import HoVisualAidPanel from './HoVisualAidPanel';
import barackLogo from '../../src/assets/barack_logo.png';
import { Shield, ClipboardCheck, AlertTriangle, Camera, ListOrdered, Search, X } from 'lucide-react';
import type { InheritanceStatusMap } from '../../hooks/useInheritanceStatus';

interface Props {
    sheet: HojaOperacion;
    formNumber: string;
    clientName: string;
    onUpdateField: <K extends keyof HojaOperacion>(field: K, value: HojaOperacion[K]) => void;
    onAddStep: () => void;
    onRemoveStep: (stepId: string) => void;
    onUpdateStep: (stepId: string, field: keyof HoStep, value: any) => void;
    onReorderSteps: (fromIndex: number, toIndex: number) => void;
    onTogglePpe: (item: PpeItem) => void;
    onAddVisualAid: (imageData: string, caption: string) => void;
    onRemoveVisualAid: (aidId: string) => void;
    onUpdateVisualAidCaption: (aidId: string, caption: string) => void;
    onUpdateQualityCheckRegistro: (checkId: string, value: string) => void;
    onUpdateReactionPlan: (text: string) => void;
    onUpdateReactionContact: (contact: string) => void;
    readOnly?: boolean;
    stepSearchRef?: React.RefObject<HTMLInputElement | null>;
    /** Set of quality check IDs with broken CP links (for row highlighting). */
    brokenCheckIds?: Set<string>;
    /** Inheritance status map for variant documents (null = not a variant) */
    inheritanceStatusMap?: InheritanceStatusMap | null;
}

const NAVY = '#1e3a5f';

function SectionHeader({ icon, title, color = 'navy' }: { icon: React.ReactNode; title: string; color?: string }) {
    if (color === 'navy') {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 border-b text-xs font-semibold text-white" style={{ background: NAVY }}>
                {icon}
                {title}
            </div>
        );
    }
    const colorClasses: Record<string, string> = {
        red: 'bg-red-50 text-red-800 border-red-200',
        green: 'bg-green-50 text-green-800 border-green-200',
    };
    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-t border-b text-xs font-semibold ${colorClasses[color] || ''}`}>
            {icon}
            {title}
        </div>
    );
}

const HoSheetEditor: React.FC<Props> = ({
    sheet,
    formNumber,
    clientName,
    onUpdateField,
    onAddStep,
    onRemoveStep,
    onUpdateStep,
    onReorderSteps,
    onTogglePpe,
    onAddVisualAid,
    onRemoveVisualAid,
    onUpdateVisualAidCaption,
    onUpdateQualityCheckRegistro,
    onUpdateReactionPlan,
    onUpdateReactionContact,
    readOnly,
    stepSearchRef,
    brokenCheckIds,
    inheritanceStatusMap,
}) => {
    const [stepSearch, setStepSearch] = useState('');

    const filteredSteps = useMemo(() => {
        if (!stepSearch.trim()) return sheet.steps;
        const q = stepSearch.toLowerCase();
        return sheet.steps.filter(s =>
            (s.description || '').toLowerCase().includes(q) ||
            (s.keyPointReason || '').toLowerCase().includes(q)
        );
    }, [sheet.steps, stepSearch]);

    return (
        <div className="max-w-[1200px] mx-auto space-y-3">
            {/* ==================== HEADER (3-row structured table) ==================== */}
            <div className="bg-white border border-gray-300 overflow-hidden rounded">
                <table className="w-full border-collapse">
                    <tbody>
                        {/* Row 0: Logo | Title | HO Number */}
                        <tr>
                            <td className="w-[25%] border border-gray-300 p-2 align-middle">
                                <img src={barackLogo} alt="Barack Mercosul" className="h-10 object-contain" />
                            </td>
                            <td className="w-[45%] border border-gray-300 p-2 text-center align-middle">
                                <div className="text-lg font-bold tracking-wide" style={{ color: NAVY }}>
                                    HOJA DE OPERACIONES
                                </div>
                            </td>
                            <td className="w-[30%] border border-gray-300 p-2 text-right align-middle">
                                <div className="text-[9px] text-gray-500">Form: {formNumber}</div>
                                <div className="text-2xl font-bold" style={{ color: NAVY }}>
                                    {sheet.hoNumber}
                                </div>
                            </td>
                        </tr>

                        {/* Row 1: Op Number | Denomination | Model + Realizo/Aprobo */}
                        <tr>
                            <td className="border border-gray-300 px-2 py-1">
                                <div className="text-[9px] text-gray-500 font-semibold uppercase">N° DE OPERACIÓN</div>
                                <div className="text-xs font-medium">{sheet.operationNumber}</div>
                            </td>
                            <td className="border border-gray-300 px-2 py-1">
                                <div className="text-[9px] text-gray-500 font-semibold uppercase">DENOMINACIÓN DE LA OPERACIÓN</div>
                                <div className="text-xs font-medium">{sheet.operationName}</div>
                            </td>
                            <td className="border border-gray-300 px-2 py-1">
                                <div className="text-[9px] text-gray-500 font-semibold uppercase">MODELO O VEHICULO</div>
                                <input type="text" value={sheet.vehicleModel}
                                    onChange={e => onUpdateField('vehicleModel', e.target.value)}
                                    readOnly={readOnly} placeholder="Ej: Corolla / Hilux" maxLength={100}
                                    className="w-full text-xs px-0 py-0.5 border-0 bg-transparent focus:outline-none" />
                            </td>
                        </tr>

                        {/* Row 1b: Realizo | Aprobo | Fecha | Rev */}
                        <tr>
                            <td className="border border-gray-300 px-2 py-1" colSpan={1}>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <div className="text-[9px] text-gray-500 font-semibold uppercase">Realizo:</div>
                                        <input type="text" value={sheet.preparedBy}
                                            onChange={e => onUpdateField('preparedBy', e.target.value)}
                                            readOnly={readOnly} placeholder="Nombre y apellido" maxLength={80}
                                            className="w-full text-xs px-0 py-0.5 border-0 bg-transparent focus:outline-none" />
                                    </div>
                                    <div>
                                        <div className="text-[9px] text-gray-500 font-semibold uppercase">Aprobo:</div>
                                        <input type="text" value={sheet.approvedBy}
                                            onChange={e => onUpdateField('approvedBy', e.target.value)}
                                            readOnly={readOnly} placeholder="Nombre y apellido" maxLength={80}
                                            className="w-full text-xs px-0 py-0.5 border-0 bg-transparent focus:outline-none" />
                                    </div>
                                </div>
                            </td>
                            <td className="border border-gray-300 px-2 py-1" colSpan={1}>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <div className="text-[9px] text-gray-500 font-semibold uppercase">Fecha:</div>
                                        <input type="date" value={sheet.date}
                                            onChange={e => onUpdateField('date', e.target.value)}
                                            readOnly={readOnly}
                                            className="w-full text-xs px-0 py-0.5 border-0 bg-transparent focus:outline-none" />
                                    </div>
                                    <div>
                                        <div className="text-[9px] text-gray-500 font-semibold uppercase">Rev.</div>
                                        <input type="text" value={sheet.revision}
                                            onChange={e => onUpdateField('revision', e.target.value)}
                                            readOnly={readOnly} placeholder="Ej: 01" maxLength={10}
                                            className="w-full text-xs px-0 py-0.5 border-0 bg-transparent focus:outline-none" />
                                    </div>
                                </div>
                            </td>
                            <td className="border border-gray-300 px-2 py-1 align-middle text-center" colSpan={1}>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                    sheet.status === 'aprobado' ? 'bg-green-500 text-white'
                                    : sheet.status === 'pendienteRevision' ? 'bg-yellow-400 text-yellow-900'
                                    : 'bg-gray-200 text-gray-600'
                                }`}>
                                    {sheet.status === 'aprobado' ? 'APROBADO'
                                    : sheet.status === 'pendienteRevision' ? 'PENDIENTE REV.'
                                    : 'BORRADOR'}
                                </span>
                            </td>
                        </tr>

                        {/* Row 2: Sector | Cod Pieza | Cliente + Puesto */}
                        <tr>
                            <td className="border border-gray-300 px-2 py-1">
                                <div className="text-[9px] text-gray-500 font-semibold uppercase">SECTOR</div>
                                <input type="text" value={sheet.sector}
                                    onChange={e => onUpdateField('sector', e.target.value)}
                                    readOnly={readOnly} placeholder="Ej: INYECCION" maxLength={50}
                                    className="w-full text-xs px-0 py-0.5 border-0 bg-transparent focus:outline-none" />
                            </td>
                            <td className="border border-gray-300 px-2 py-1">
                                <div className="text-[9px] text-gray-500 font-semibold uppercase">COD. DE PIEZA / DESCRIPCIÓN</div>
                                <input type="text" value={sheet.partCodeDescription}
                                    onChange={e => onUpdateField('partCodeDescription', e.target.value)}
                                    readOnly={readOnly} placeholder="Ej: 12345 / Soporte lateral" maxLength={150}
                                    className="w-full text-xs px-0 py-0.5 border-0 bg-transparent focus:outline-none" />
                            </td>
                            <td className="border border-gray-300 px-2 py-1">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <div className="text-[9px] text-gray-500 font-semibold uppercase">Cliente</div>
                                        <input type="text" value={clientName} readOnly
                                            className="w-full text-xs px-0 py-0.5 border-0 bg-transparent text-gray-400"
                                            placeholder="-" />
                                    </div>
                                    <div>
                                        <div className="text-[9px] text-gray-500 font-semibold uppercase">N° Puesto</div>
                                        <input type="text" value={sheet.puestoNumber}
                                            onChange={e => onUpdateField('puestoNumber', e.target.value)}
                                            readOnly={readOnly} placeholder="-" maxLength={20}
                                            className="w-full text-xs px-0 py-0.5 border-0 bg-transparent focus:outline-none" />
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* ==================== BODY: Visual Aids (left 40%) + Steps + PPE (right 60%) ==================== */}
            <div className="grid grid-cols-1 md:grid-cols-[40%_60%] gap-3">
                {/* Visual Aids */}
                <div className="bg-white rounded border border-gray-200 overflow-hidden">
                    <SectionHeader icon={<Camera size={14} />} title="AYUDAS VISUALES" />
                    <div className="p-3">
                        <HoVisualAidPanel
                            aids={sheet.visualAids}
                            onAdd={onAddVisualAid}
                            onRemove={onRemoveVisualAid}
                            onUpdateCaption={onUpdateVisualAidCaption}
                            readOnly={readOnly}
                        />
                    </div>
                </div>

                {/* Steps + PPE */}
                <div className="bg-white rounded border border-gray-200 overflow-hidden">
                    <SectionHeader icon={<ListOrdered size={14} />} title="DESCRIPCIÓN DE LA OPERACIÓN" />
                    {/* Step search bar */}
                    <div className="px-3 pt-2">
                        <div className="relative">
                            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                ref={stepSearchRef}
                                type="text"
                                value={stepSearch}
                                onChange={e => setStepSearch(e.target.value)}
                                placeholder="Buscar paso (Ctrl+F)..."
                                className="w-full pl-6 pr-7 py-1 text-xs border border-gray-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                            {stepSearch && (
                                <button
                                    onClick={() => setStepSearch('')}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                                    title="Limpiar búsqueda"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                        {stepSearch.trim() && (
                            <div className="text-[10px] text-gray-400 mt-0.5 px-1">
                                {filteredSteps.length} de {sheet.steps.length} paso(s)
                            </div>
                        )}
                    </div>
                    <div className="p-3">
                        <HoStepEditor
                            steps={filteredSteps}
                            onAdd={onAddStep}
                            onRemove={onRemoveStep}
                            onUpdate={onUpdateStep}
                            onReorder={onReorderSteps}
                            readOnly={readOnly}
                            disableDrag={!!stepSearch.trim()}
                            highlightQuery={stepSearch}
                            inheritanceStatusMap={inheritanceStatusMap}
                        />
                        {stepSearch.trim() && (
                            <p className="text-[11px] text-amber-600 px-2 py-1">
                                Reordenamiento deshabilitado durante la búsqueda. Limpie el filtro para reordenar.
                            </p>
                        )}
                    </div>

                    {/* EPP inside right column, bottom */}
                    <div className="border-t border-gray-200">
                        <SectionHeader icon={<Shield size={14} />} title="ELEMENTOS DE SEGURIDAD" />
                        <div className="p-3">
                            <HoPpeSelector
                                selected={sheet.safetyElements}
                                onToggle={onTogglePpe}
                                readOnly={readOnly}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ==================== QUALITY CHECKS ==================== */}
            <div className="bg-white rounded border border-gray-200 overflow-hidden">
                <SectionHeader icon={<ClipboardCheck size={14} />} title="CICLO DE CONTROL" color="green" />
                <div className="px-3 pt-1 pb-0">
                    <span className="text-[10px] text-gray-500 italic">Referencia: OP - Operador de Produccion</span>
                </div>
                <div className="p-3 pt-1">
                    <HoQualityCheckTable
                        checks={sheet.qualityChecks}
                        onUpdateRegistro={onUpdateQualityCheckRegistro}
                        readOnly={readOnly}
                        brokenCheckIds={brokenCheckIds}
                    />
                </div>
            </div>

            {/* ==================== REACTION PLAN ==================== */}
            <div className="bg-white rounded border border-gray-200 overflow-hidden">
                <SectionHeader icon={<AlertTriangle size={14} />} title="PLAN DE REACCION ANTE NO CONFORME" color="red" />
                <div className="p-3 space-y-2">
                    <textarea
                        value={sheet.reactionPlanText}
                        onChange={e => onUpdateReactionPlan(e.target.value)}
                        readOnly={readOnly}
                        rows={4}
                        placeholder="Describir las acciones a tomar ante una no conformidad..."
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 font-bold text-red-700 uppercase placeholder:font-normal placeholder:normal-case placeholder:text-gray-300"
                    />
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] text-gray-500 uppercase">Contacto:</label>
                        <input
                            type="text"
                            value={sheet.reactionContact}
                            onChange={e => onUpdateReactionContact(e.target.value)}
                            readOnly={readOnly}
                            placeholder="Ej: Supervisor / Lider de celda"
                            className={`flex-1 px-2 py-1 text-xs border rounded focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none ${
                                sheet.reactionPlanText.trim() && !sheet.reactionContact.trim()
                                    ? 'border-amber-400 bg-amber-50'
                                    : 'border-gray-200'
                            }`}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(HoSheetEditor);
