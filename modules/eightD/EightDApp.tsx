/**
 * EightDApp - Main 8D Report Module
 *
 * Global 8D (G8D) methodology: D0-D8 disciplines for structured
 * problem solving per Ford/AIAG/VDA standard.
 *
 * Two views: "list" (report listing) and "edit" (step-by-step editor).
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
    EightDReport,
    D_STEPS,
    FISH_CATEGORIES,
    URGENCY_OPTIONS,
    STATUS_OPTIONS,
    createEmptyReport,
    type FishboneData,
    type PcaAction,
    type ActionStatus,
    type FishCategoryId,
} from './eightDTypes';
import * as eightDRepository from '../../utils/repositories/eightDRepository';
import { exportEightDToExcel } from './eightDExcelExport';
import { exportFieldSheetPdf } from './eightDFieldSheetPdf';
import { logger } from '../../utils/logger';
import { ModuleErrorBoundary } from '../../components/ui/ModuleErrorBoundary';

// ---------------------------------------------------------------------------
// Progress calculation
// ---------------------------------------------------------------------------

function calculateProgress(r: EightDReport): number {
    const checks = [
        // D0
        !!r.d0.symptom.trim(),
        !!r.d0.era.trim(),
        // D1
        !!r.d1.leader.trim(),
        // D2
        !!r.d2.what.trim(),
        !!r.d2.where.trim(),
        !!r.d2.isNotWhat.trim(),
        // D3
        !!r.d3.actions.trim(),
        !!r.d3.verification.trim(),
        // D4
        !!r.d4.rootCause.trim(),
        !!r.d4.escapePoint.trim(),
        // D5
        !!(r.d5.actions[0]?.action?.trim()),
        !!r.d5.escapeAction.trim(),
        // D6
        !!r.d6.validation.trim(),
        !!r.d6.icaRemoved.trim(),
        // D7
        !!r.d7.prevention.trim(),
        !!r.d7.fmeaUpdated.trim(),
        // D8
        !!r.d8.lessons.trim(),
    ];
    const filled = checks.filter(Boolean).length;
    return Math.round((filled / checks.length) * 100);
}

// ---------------------------------------------------------------------------
// Step info tips
// ---------------------------------------------------------------------------

const STEP_TIPS: Record<string, string> = {
    d0: 'Registrar el sintoma tal como lo percibe el cliente. La ERA es una accion inmediata para proteger al cliente mientras se investiga.',
    d1: 'Formar un equipo multifuncional con conocimiento del producto y proceso. El Champion es quien tiene autoridad para asignar recursos.',
    d2: 'Usar la tecnica 5W2H y el analisis Es/No Es para acotar el problema. Ser especifico y basarse en datos.',
    d3: 'Las acciones interinas (ICA) protegen al cliente AHORA. No son la solucion final, se retiran en D6.',
    d4: 'Usar Ishikawa 6M para generar hipotesis y 5 Por Que para llegar a la causa raiz. Identificar tambien el Punto de Escape (donde el sistema debio detectar el problema).',
    d5: 'Definir PCAs tanto para la causa raiz como para el punto de escape. Verificar que cada PCA realmente elimina la causa.',
    d6: 'Implementar las PCAs, retirar las ICAs (D3) y validar con datos de produccion que el problema no reaparece.',
    d7: 'Actualizar FMEA, Plan de Control e Instrucciones de Trabajo. Desplegar horizontalmente a productos/procesos similares.',
    d8: 'Documentar lecciones aprendidas y reconocer al equipo. Obtener aprobacion del cliente si aplica.',
};

// ---------------------------------------------------------------------------
// Urgency badge colors
// ---------------------------------------------------------------------------

const URGENCY_COLORS: Record<string, string> = {
    baja: 'bg-green-600/20 text-green-400 border-green-600/40',
    media: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/40',
    alta: 'bg-orange-600/20 text-orange-400 border-orange-600/40',
    critica: 'bg-red-600/20 text-red-400 border-red-600/40',
};

const STATUS_COLORS: Record<string, string> = {
    abierto: 'bg-blue-600/20 text-blue-400 border-blue-600/40',
    en_proceso: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/40',
    cerrado: 'bg-green-600/20 text-green-400 border-green-600/40',
};

// ---------------------------------------------------------------------------
// Inline FishboneDiagram component
// ---------------------------------------------------------------------------

const FISH_BORDER_COLORS: Record<FishCategoryId, string> = {
    mano_obra: 'border-orange-500',
    maquina: 'border-blue-500',
    material: 'border-emerald-500',
    metodo: 'border-purple-500',
    medio_amb: 'border-yellow-500',
    medicion: 'border-rose-500',
};

const FISH_TEXT_COLORS: Record<FishCategoryId, string> = {
    mano_obra: 'text-orange-400',
    maquina: 'text-blue-400',
    material: 'text-emerald-400',
    metodo: 'text-purple-400',
    medio_amb: 'text-yellow-400',
    medicion: 'text-rose-400',
};

interface FishboneDiagramProps {
    data: FishboneData;
    onChange: (data: FishboneData) => void;
}

function FishboneDiagram({ data, onChange }: FishboneDiagramProps) {
    const handleCauseChange = useCallback(
        (catId: FishCategoryId, idx: number, value: string) => {
            const updated = { ...data };
            updated[catId] = [...updated[catId]];
            updated[catId][idx] = value;
            onChange(updated);
        },
        [data, onChange],
    );

    const handleAddCause = useCallback(
        (catId: FishCategoryId) => {
            const updated = { ...data };
            updated[catId] = [...updated[catId], ''];
            onChange(updated);
        },
        [data, onChange],
    );

    const handleRemoveCause = useCallback(
        (catId: FishCategoryId, idx: number) => {
            if (data[catId].length <= 1) return;
            const updated = { ...data };
            updated[catId] = updated[catId].filter((_, i) => i !== idx);
            onChange(updated);
        },
        [data, onChange],
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {FISH_CATEGORIES.map((cat) => (
                <div
                    key={cat.id}
                    className={`bg-slate-800 border-l-4 ${FISH_BORDER_COLORS[cat.id]} rounded-lg p-3`}
                >
                    <h4 className={`text-sm font-semibold mb-2 ${FISH_TEXT_COLORS[cat.id]}`}>
                        {cat.label}
                    </h4>
                    <div className="space-y-1.5">
                        {data[cat.id].map((cause, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                                <input
                                    type="text"
                                    value={cause}
                                    onChange={(e) => handleCauseChange(cat.id, idx, e.target.value)}
                                    placeholder={`Causa ${idx + 1}...`}
                                    className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleRemoveCause(cat.id, idx)}
                                    className="text-slate-500 hover:text-red-400 text-xs px-1 shrink-0"
                                    title="Quitar causa"
                                >
                                    -
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => handleAddCause(cat.id)}
                        className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                    >
                        + Agregar causa
                    </button>
                </div>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Reusable form helpers
// ---------------------------------------------------------------------------

interface FieldProps {
    label: string;
    children: React.ReactNode;
    className?: string;
}

function Field({ label, children, className = '' }: FieldProps) {
    return (
        <label className={`block ${className}`}>
            <span className="block text-xs font-medium text-slate-400 mb-1">{label}</span>
            {children}
        </label>
    );
}

const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none';
const textareaCls = `${inputCls} resize-y`;
const selectCls = inputCls;

// ---------------------------------------------------------------------------
// Step content renderers
// ---------------------------------------------------------------------------

interface StepProps {
    report: EightDReport;
    onChange: (patch: Partial<EightDReport>) => void;
}

function StepD0({ report, onChange }: StepProps) {
    const d = report.d0;
    const up = (patch: Partial<typeof d>) => onChange({ d0: { ...d, ...patch } });
    return (
        <div className="space-y-4">
            <Field label="Sintoma (descripcion del problema como lo reporta el cliente)">
                <textarea rows={3} className={textareaCls} value={d.symptom} onChange={(e) => up({ symptom: e.target.value })} placeholder="Describir el sintoma tal como fue reportado..." />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Urgencia">
                    <select className={selectCls} value={d.urgency} onChange={(e) => up({ urgency: e.target.value as any })}>
                        {URGENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </Field>
                <Field label="Cliente">
                    <input className={inputCls} value={d.client} onChange={(e) => up({ client: e.target.value })} placeholder="Nombre del cliente..." />
                </Field>
            </div>
            <div className="border-t border-slate-700 pt-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">ERA - Accion de Respuesta de Emergencia</h4>
                <Field label="Descripcion de la ERA">
                    <textarea rows={3} className={textareaCls} value={d.era} onChange={(e) => up({ era: e.target.value })} placeholder="Accion inmediata para proteger al cliente..." />
                </Field>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <Field label="Responsable ERA">
                        <input className={inputCls} value={d.eraResponsible} onChange={(e) => up({ eraResponsible: e.target.value })} />
                    </Field>
                    <Field label="Fecha ERA">
                        <input type="date" className={inputCls} value={d.eraDate} onChange={(e) => up({ eraDate: e.target.value })} />
                    </Field>
                </div>
                <Field label="Verificacion de eficacia ERA" className="mt-3">
                    <textarea rows={2} className={textareaCls} value={d.eraVerification} onChange={(e) => up({ eraVerification: e.target.value })} placeholder="Como se verifico que la ERA fue efectiva..." />
                </Field>
            </div>
            <Field label="Requiere 8D completo?">
                <select className={selectCls} value={d.needsFull8D} onChange={(e) => up({ needsFull8D: e.target.value })}>
                    <option value="">-- Seleccionar --</option>
                    <option value="Si">Si</option>
                    <option value="No">No</option>
                    <option value="Evaluar">Evaluar</option>
                </select>
            </Field>
        </div>
    );
}

function StepD1({ report, onChange }: StepProps) {
    const d = report.d1;
    const up = (patch: Partial<typeof d>) => onChange({ d1: { ...d, ...patch } });
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Lider del equipo">
                    <input className={inputCls} value={d.leader} onChange={(e) => up({ leader: e.target.value })} placeholder="Nombre del lider..." />
                </Field>
                <Field label="Champion (sponsor)">
                    <input className={inputCls} value={d.champion} onChange={(e) => up({ champion: e.target.value })} placeholder="Persona con autoridad para asignar recursos..." />
                </Field>
            </div>
            <Field label="Miembros del equipo (uno por linea)">
                <textarea rows={5} className={textareaCls} value={d.members} onChange={(e) => up({ members: e.target.value })} placeholder="Nombre - Area&#10;Nombre - Area&#10;..." />
            </Field>
        </div>
    );
}

function StepD2({ report, onChange }: StepProps) {
    const d = report.d2;
    const up = (patch: Partial<typeof d>) => onChange({ d2: { ...d, ...patch } });
    return (
        <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-300">Analisis 5W2H - Es / No Es</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="QUE ES (What IS)">
                    <textarea rows={2} className={textareaCls} value={d.what} onChange={(e) => up({ what: e.target.value })} placeholder="Que defecto/problema se observo..." />
                </Field>
                <Field label="QUE NO ES (What IS NOT)">
                    <textarea rows={2} className={textareaCls} value={d.isNotWhat} onChange={(e) => up({ isNotWhat: e.target.value })} placeholder="Que defectos similares NO se observaron..." />
                </Field>
                <Field label="DONDE ES (Where IS)">
                    <textarea rows={2} className={textareaCls} value={d.where} onChange={(e) => up({ where: e.target.value })} placeholder="Donde se detecto el problema..." />
                </Field>
                <Field label="DONDE NO ES (Where IS NOT)">
                    <textarea rows={2} className={textareaCls} value={d.isNotWhere} onChange={(e) => up({ isNotWhere: e.target.value })} placeholder="Donde NO se detecto..." />
                </Field>
                <Field label="CUANDO ES (When IS)">
                    <textarea rows={2} className={textareaCls} value={d.when} onChange={(e) => up({ when: e.target.value })} placeholder="Cuando aparecio el problema..." />
                </Field>
                <Field label="CUANDO NO ES (When IS NOT)">
                    <textarea rows={2} className={textareaCls} value={d.isNotWhen} onChange={(e) => up({ isNotWhen: e.target.value })} placeholder="Cuando NO aparecio..." />
                </Field>
                <Field label="CUANTO ES (How Many IS)">
                    <textarea rows={2} className={textareaCls} value={d.howMany} onChange={(e) => up({ howMany: e.target.value })} placeholder="Cantidad afectada, tasa de defecto..." />
                </Field>
                <Field label="CUANTO NO ES (How Many IS NOT)">
                    <textarea rows={2} className={textareaCls} value={d.isNotHowMany} onChange={(e) => up({ isNotHowMany: e.target.value })} placeholder="Que cantidad NO esta afectada..." />
                </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="QUIEN (Who)">
                    <input className={inputCls} value={d.who} onChange={(e) => up({ who: e.target.value })} placeholder="Quien detecto / esta involucrado..." />
                </Field>
                <Field label="Numero de parte">
                    <input className={inputCls} value={d.partNumber} onChange={(e) => up({ partNumber: e.target.value })} placeholder="Part number afectado..." />
                </Field>
                <Field label="Como se detecto">
                    <input className={inputCls} value={d.howDetected} onChange={(e) => up({ howDetected: e.target.value })} placeholder="Inspeccion, reclamo, etc." />
                </Field>
            </div>
            {/* Barack: Figura modo de falla en AMFE */}
            <div className="border-t border-slate-700 pt-4">
                <Field label="Figura modo de falla en AMFE">
                    <select className={selectCls} value={d.figuraModoDeFallaEnAmfe || ''} onChange={(e) => up({ figuraModoDeFallaEnAmfe: e.target.value as 'si' | 'no' | '' })}>
                        <option value="">-- Seleccionar --</option>
                        <option value="si">Si</option>
                        <option value="no">No</option>
                    </select>
                </Field>
            </div>
        </div>
    );
}

function StepD3({ report, onChange }: StepProps) {
    const d = report.d3;
    const up = (patch: Partial<typeof d>) => onChange({ d3: { ...d, ...patch } });
    const containment = d.containment || {
        potentialStock: '', potentialRetrabajo: '', potentialScrap: '',
        potentialExpedicion: '', potentialTransito: '', potentialCliente: '',
        encontradoStock: '', encontradoRetrabajo: '', encontradoScrap: '',
        encontradoExpedicion: '', encontradoTransito: '', encontradoCliente: '',
    };
    const upC = (patch: Partial<typeof containment>) => up({ containment: { ...containment, ...patch } });

    return (
        <div className="space-y-4">
            <Field label="Acciones de contencion interina (ICA)">
                <textarea rows={4} className={textareaCls} value={d.actions} onChange={(e) => up({ actions: e.target.value })} placeholder="Describir las acciones interinas implementadas para proteger al cliente..." />
            </Field>
            <Field label="Verificacion de eficacia ICA">
                <textarea rows={3} className={textareaCls} value={d.verification} onChange={(e) => up({ verification: e.target.value })} placeholder="Como se verifico que la ICA es efectiva..." />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Responsable">
                    <input className={inputCls} value={d.responsible} onChange={(e) => up({ responsible: e.target.value })} />
                </Field>
                <Field label="Fecha">
                    <input type="date" className={inputCls} value={d.date} onChange={(e) => up({ date: e.target.value })} />
                </Field>
                <Field label="Estado">
                    <select className={selectCls} value={d.status} onChange={(e) => up({ status: e.target.value as ActionStatus })}>
                        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </Field>
            </div>

            {/* Barack: Containment location table */}
            <div className="border-t border-slate-700 pt-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Ubicacion de Contencion</h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs border border-slate-700">
                        <thead>
                            <tr className="bg-slate-800 text-slate-400">
                                <th className="border border-slate-700 px-2 py-1 text-left"></th>
                                <th className="border border-slate-700 px-2 py-1">Stock</th>
                                <th className="border border-slate-700 px-2 py-1">Retrabajo</th>
                                <th className="border border-slate-700 px-2 py-1">Scrap</th>
                                <th className="border border-slate-700 px-2 py-1">Expedicion</th>
                                <th className="border border-slate-700 px-2 py-1">Transito</th>
                                <th className="border border-slate-700 px-2 py-1">Cliente</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-slate-700 px-2 py-1 text-slate-400 font-medium bg-slate-800/50">Potencial</td>
                                <td className="border border-slate-700 p-0.5"><input className={inputCls + ' !text-xs !px-1 !py-0.5'} value={containment.potentialStock} onChange={(e) => upC({ potentialStock: e.target.value })} /></td>
                                <td className="border border-slate-700 p-0.5"><input className={inputCls + ' !text-xs !px-1 !py-0.5'} value={containment.potentialRetrabajo} onChange={(e) => upC({ potentialRetrabajo: e.target.value })} /></td>
                                <td className="border border-slate-700 p-0.5"><input className={inputCls + ' !text-xs !px-1 !py-0.5'} value={containment.potentialScrap} onChange={(e) => upC({ potentialScrap: e.target.value })} /></td>
                                <td className="border border-slate-700 p-0.5"><input className={inputCls + ' !text-xs !px-1 !py-0.5'} value={containment.potentialExpedicion} onChange={(e) => upC({ potentialExpedicion: e.target.value })} /></td>
                                <td className="border border-slate-700 p-0.5"><input className={inputCls + ' !text-xs !px-1 !py-0.5'} value={containment.potentialTransito} onChange={(e) => upC({ potentialTransito: e.target.value })} /></td>
                                <td className="border border-slate-700 p-0.5"><input className={inputCls + ' !text-xs !px-1 !py-0.5'} value={containment.potentialCliente} onChange={(e) => upC({ potentialCliente: e.target.value })} /></td>
                            </tr>
                            <tr>
                                <td className="border border-slate-700 px-2 py-1 text-slate-400 font-medium bg-slate-800/50">Encontrado</td>
                                <td className="border border-slate-700 p-0.5"><input className={inputCls + ' !text-xs !px-1 !py-0.5'} value={containment.encontradoStock} onChange={(e) => upC({ encontradoStock: e.target.value })} /></td>
                                <td className="border border-slate-700 p-0.5"><input className={inputCls + ' !text-xs !px-1 !py-0.5'} value={containment.encontradoRetrabajo} onChange={(e) => upC({ encontradoRetrabajo: e.target.value })} /></td>
                                <td className="border border-slate-700 p-0.5"><input className={inputCls + ' !text-xs !px-1 !py-0.5'} value={containment.encontradoScrap} onChange={(e) => upC({ encontradoScrap: e.target.value })} /></td>
                                <td className="border border-slate-700 p-0.5"><input className={inputCls + ' !text-xs !px-1 !py-0.5'} value={containment.encontradoExpedicion} onChange={(e) => upC({ encontradoExpedicion: e.target.value })} /></td>
                                <td className="border border-slate-700 p-0.5"><input className={inputCls + ' !text-xs !px-1 !py-0.5'} value={containment.encontradoTransito} onChange={(e) => upC({ encontradoTransito: e.target.value })} /></td>
                                <td className="border border-slate-700 p-0.5"><input className={inputCls + ' !text-xs !px-1 !py-0.5'} value={containment.encontradoCliente} onChange={(e) => upC({ encontradoCliente: e.target.value })} /></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Additional Barack D3 fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Responsable verificacion">
                    <input className={inputCls} value={d.verificationResponsible || ''} onChange={(e) => up({ verificationResponsible: e.target.value })} />
                </Field>
                <Field label="% Efectividad">
                    <input className={inputCls} value={d.effectPercentage || ''} onChange={(e) => up({ effectPercentage: e.target.value })} placeholder="Ej: 95%" />
                </Field>
                <Field label="Fecha implementacion">
                    <input type="date" className={inputCls} value={d.implementationDate || ''} onChange={(e) => up({ implementationDate: e.target.value })} />
                </Field>
            </div>
        </div>
    );
}

function StepD4({ report, onChange }: StepProps) {
    const d = report.d4;
    const up = (patch: Partial<typeof d>) => onChange({ d4: { ...d, ...patch } });

    const handleFiveWhyChange = useCallback(
        (idx: number, value: string) => {
            const updated = [...d.fiveWhy];
            updated[idx] = value;
            up({ fiveWhy: updated });
        },
        [d.fiveWhy, up],
    );

    return (
        <div className="space-y-6">
            <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Diagrama de Ishikawa (6M)</h4>
                <FishboneDiagram data={d.fishbone} onChange={(fishbone) => up({ fishbone })} />
            </div>

            <div className="border-t border-slate-700 pt-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">5 Por Que</h4>
                <div className="space-y-2">
                    {d.fiveWhy.map((why, idx) => (
                        <Field key={idx} label={`Por que ${idx + 1}?`}>
                            <input className={inputCls} value={why} onChange={(e) => handleFiveWhyChange(idx, e.target.value)} placeholder={`Respuesta ${idx + 1}...`} />
                        </Field>
                    ))}
                </div>
            </div>

            <div className="border-t border-slate-700 pt-4 space-y-4">
                <Field label="Causa raiz determinada">
                    <textarea rows={3} className={textareaCls} value={d.rootCause} onChange={(e) => up({ rootCause: e.target.value })} placeholder="Causa raiz validada con datos..." />
                </Field>
                <Field label="Verificacion de causa raiz">
                    <textarea rows={2} className={textareaCls} value={d.rootCauseVerification} onChange={(e) => up({ rootCauseVerification: e.target.value })} placeholder="Como se verifico que esta es la causa raiz real..." />
                </Field>
            </div>

            <div className="border-t border-slate-700 pt-4 space-y-4">
                <h4 className="text-sm font-semibold text-slate-300">Punto de Escape (G8D)</h4>
                <Field label="Punto de escape">
                    <textarea rows={2} className={textareaCls} value={d.escapePoint} onChange={(e) => up({ escapePoint: e.target.value })} placeholder="Donde el sistema de control debio detectar el problema y no lo hizo..." />
                </Field>
                <Field label="Por que escapo?">
                    <textarea rows={2} className={textareaCls} value={d.escapeWhy} onChange={(e) => up({ escapeWhy: e.target.value })} placeholder="Por que el control existente no detecto el problema..." />
                </Field>
            </div>

            {/* Barack: 5 Por Que - No Deteccion (escape point root cause) */}
            <div className="border-t border-slate-700 pt-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">4.1 Causa Raiz de la No Deteccion - 5 Por Que</h4>
                <div className="space-y-2">
                    {(d.fiveWhyEscape || ['', '', '', '', '']).map((why, idx) => (
                        <Field key={`esc-${idx}`} label={`Por que ${idx + 1}? (No Deteccion)`}>
                            <input
                                className={inputCls}
                                value={why}
                                onChange={(e) => {
                                    const updated = [...(d.fiveWhyEscape || ['', '', '', '', ''])];
                                    updated[idx] = e.target.value;
                                    up({ fiveWhyEscape: updated });
                                }}
                                placeholder={`Respuesta ${idx + 1} - por que no se detecto...`}
                            />
                        </Field>
                    ))}
                </div>
            </div>
        </div>
    );
}

function StepD5({ report, onChange }: StepProps) {
    const d = report.d5;
    const up = (patch: Partial<typeof d>) => onChange({ d5: { ...d, ...patch } });

    const handlePcaChange = useCallback(
        (idx: number, patch: Partial<PcaAction>) => {
            const updated = d.actions.map((a, i) => (i === idx ? { ...a, ...patch } : a));
            up({ actions: updated });
        },
        [d.actions, up],
    );

    const addPca = useCallback(() => {
        up({ actions: [...d.actions, { action: '', responsible: '', deadline: '', status: 'pendiente' as ActionStatus }] });
    }, [d.actions, up]);

    const removePca = useCallback(
        (idx: number) => {
            if (d.actions.length <= 1) return;
            up({ actions: d.actions.filter((_, i) => i !== idx) });
        },
        [d.actions, up],
    );

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-300">Acciones Correctivas Permanentes (PCA)</h4>
                    <button type="button" onClick={addPca} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-md">
                        + Agregar PCA
                    </button>
                </div>
                <div className="space-y-3">
                    {d.actions.map((pca, idx) => (
                        <div key={idx} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-400">PCA {idx + 1}</span>
                                {d.actions.length > 1 && (
                                    <button type="button" onClick={() => removePca(idx)} className="text-xs text-red-400 hover:text-red-300">
                                        Quitar
                                    </button>
                                )}
                            </div>
                            <Field label="Accion">
                                <textarea rows={2} className={textareaCls} value={pca.action} onChange={(e) => handlePcaChange(idx, { action: e.target.value })} placeholder="Describir la accion correctiva permanente..." />
                            </Field>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                                <Field label="Responsable">
                                    <input className={inputCls} value={pca.responsible} onChange={(e) => handlePcaChange(idx, { responsible: e.target.value })} />
                                </Field>
                                <Field label="Fecha limite">
                                    <input type="date" className={inputCls} value={pca.deadline} onChange={(e) => handlePcaChange(idx, { deadline: e.target.value })} />
                                </Field>
                                <Field label="Estado">
                                    <select className={selectCls} value={pca.status} onChange={(e) => handlePcaChange(idx, { status: e.target.value as ActionStatus })}>
                                        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </Field>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="border-t border-slate-700 pt-4 space-y-4">
                <h4 className="text-sm font-semibold text-slate-300">Accion sobre Punto de Escape</h4>
                <Field label="Accion correctiva para el punto de escape">
                    <textarea rows={2} className={textareaCls} value={d.escapeAction} onChange={(e) => up({ escapeAction: e.target.value })} placeholder="Que se hara para cerrar el punto de escape..." />
                </Field>
                <Field label="Responsable escape">
                    <input className={inputCls} value={d.escapeResponsible} onChange={(e) => up({ escapeResponsible: e.target.value })} />
                </Field>
            </div>

            <div className="border-t border-slate-700 pt-4 space-y-4">
                <Field label="Evaluacion de riesgo">
                    <textarea rows={2} className={textareaCls} value={d.riskAssessment} onChange={(e) => up({ riskAssessment: e.target.value })} placeholder="Analisis de riesgo de implementar las PCAs..." />
                </Field>
                <Field label="Metodo de verificacion">
                    <textarea rows={2} className={textareaCls} value={d.verificationMethod} onChange={(e) => up({ verificationMethod: e.target.value })} placeholder="Como se verificara que las PCAs son efectivas..." />
                </Field>
            </div>
        </div>
    );
}

function StepD6({ report, onChange }: StepProps) {
    const d = report.d6;
    const up = (patch: Partial<typeof d>) => onChange({ d6: { ...d, ...patch } });
    return (
        <div className="space-y-4">
            <Field label="Validacion de PCAs implementadas">
                <textarea rows={3} className={textareaCls} value={d.validation} onChange={(e) => up({ validation: e.target.value })} placeholder="Resultados de la validacion con datos de produccion..." />
            </Field>
            <Field label="Evidencia objetiva">
                <textarea rows={3} className={textareaCls} value={d.evidence} onChange={(e) => up({ evidence: e.target.value })} placeholder="Datos, graficos, mediciones que demuestran la eficacia..." />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Periodo de validacion">
                    <input className={inputCls} value={d.validationPeriod} onChange={(e) => up({ validationPeriod: e.target.value })} placeholder="Ej: 30 dias, 1000 piezas..." />
                </Field>
                <Field label="ICA retirada?">
                    <input className={inputCls} value={d.icaRemoved} onChange={(e) => up({ icaRemoved: e.target.value })} placeholder="Si/No - fecha de retiro..." />
                </Field>
                <Field label="Efectiva?">
                    <select className={selectCls} value={d.effective} onChange={(e) => up({ effective: e.target.value })}>
                        <option value="">-- Seleccionar --</option>
                        <option value="Si">Si</option>
                        <option value="Parcial">Parcial</option>
                        <option value="No">No</option>
                    </select>
                </Field>
            </div>
        </div>
    );
}

function StepD7({ report, onChange }: StepProps) {
    const d = report.d7;
    const up = (patch: Partial<typeof d>) => onChange({ d7: { ...d, ...patch } });
    const docs = d.affectedDocs || {
        amfe: false, controlPlan: false, hojaProceso: false, ayudasVisuales: false,
        idMaterial: false, estructura: false, papp: false, procedimientos: false,
    };
    const upDoc = (key: keyof typeof docs) => {
        up({ affectedDocs: { ...docs, [key]: !docs[key] } });
    };

    return (
        <div className="space-y-4">
            <Field label="Acciones de prevencion de recurrencia">
                <textarea rows={3} className={textareaCls} value={d.prevention} onChange={(e) => up({ prevention: e.target.value })} placeholder="Que cambios sistemicos se implementaron para evitar que el problema vuelva a ocurrir..." />
            </Field>

            {/* Barack: Affected documents checkboxes (7.1) */}
            <div className="border-t border-slate-700 pt-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">7.1 Documentos Afectados</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {([
                        ['amfe', 'AMFE'],
                        ['controlPlan', 'Plan de Control'],
                        ['hojaProceso', 'Hojas de Proceso'],
                        ['ayudasVisuales', 'Ayudas Visuales'],
                        ['idMaterial', 'ID Material'],
                        ['estructura', 'Estructura'],
                        ['papp', 'PAPP'],
                        ['procedimientos', 'Procedimientos'],
                    ] as [keyof typeof docs, string][]).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={docs[key]}
                                onChange={() => upDoc(key)}
                                className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                            />
                            {label}
                        </label>
                    ))}
                </div>
            </div>

            <Field label="FMEA actualizado">
                <textarea rows={2} className={textareaCls} value={d.fmeaUpdated} onChange={(e) => up({ fmeaUpdated: e.target.value })} placeholder="Que se actualizo en el AMFE (operacion, modo de falla, causa, AP)..." />
            </Field>
            <Field label="Plan de Control actualizado">
                <textarea rows={2} className={textareaCls} value={d.controlPlanUpdated} onChange={(e) => up({ controlPlanUpdated: e.target.value })} placeholder="Que controles se agregaron o modificaron en el CP..." />
            </Field>
            <Field label="Instrucciones de trabajo actualizadas">
                <textarea rows={2} className={textareaCls} value={d.workInstructions} onChange={(e) => up({ workInstructions: e.target.value })} placeholder="Que HO/IT se modificaron..." />
            </Field>
            <Field label="Otros documentos modificados">
                <textarea rows={2} className={textareaCls} value={d.otherDocs} onChange={(e) => up({ otherDocs: e.target.value })} placeholder="Otros documentos del SGC actualizados..." />
            </Field>
            <Field label="Despliegue horizontal a productos/procesos similares">
                <textarea rows={3} className={textareaCls} value={d.horizontalDeployment} onChange={(e) => up({ horizontalDeployment: e.target.value })} placeholder="Que otros productos o procesos similares fueron evaluados y que acciones se tomaron en ellos..." />
            </Field>

            {/* Barack: Action responsibility */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-700 pt-4">
                <Field label="Responsable de la accion">
                    <input className={inputCls} value={d.actionResponsible || ''} onChange={(e) => up({ actionResponsible: e.target.value })} />
                </Field>
                <Field label="Fecha">
                    <input type="date" className={inputCls} value={d.actionDate || ''} onChange={(e) => up({ actionDate: e.target.value })} />
                </Field>
            </div>
        </div>
    );
}

function StepD8({ report, onChange }: StepProps) {
    const d = report.d8;
    const up = (patch: Partial<typeof d>) => onChange({ d8: { ...d, ...patch } });
    return (
        <div className="space-y-4">
            <Field label="Lecciones aprendidas">
                <textarea rows={4} className={textareaCls} value={d.lessons} onChange={(e) => up({ lessons: e.target.value })} placeholder="Que aprendimos de este problema? Que hariamos diferente?..." />
            </Field>
            <Field label="Reconocimiento al equipo">
                <textarea rows={3} className={textareaCls} value={d.recognition} onChange={(e) => up({ recognition: e.target.value })} placeholder="Reconocer la contribucion del equipo..." />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Fecha de cierre">
                    <input type="date" className={inputCls} value={d.closedDate} onChange={(e) => up({ closedDate: e.target.value })} />
                </Field>
                <Field label="Aprobacion del cliente">
                    <input className={inputCls} value={d.customerApproval} onChange={(e) => up({ customerApproval: e.target.value })} placeholder="Si/No - referencia..." />
                </Field>
                <Field label="Fecha verificacion eficacia">
                    <input type="date" className={inputCls} value={d.effectivenessCheckDate} onChange={(e) => up({ effectivenessCheckDate: e.target.value })} />
                </Field>
            </div>
        </div>
    );
}

// Map step index to renderer
const STEP_RENDERERS: Record<number, React.FC<StepProps>> = {
    0: StepD0,
    1: StepD1,
    2: StepD2,
    3: StepD3,
    4: StepD4,
    5: StepD5,
    6: StepD6,
    7: StepD7,
    8: StepD8,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface EightDAppProps {
    onBackToLanding: () => void;
}

function EightDAppInner({ onBackToLanding }: EightDAppProps) {
    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    const [reports, setReports] = useState<EightDReport[]>([]);
    const [view, setView] = useState<'list' | 'edit'>('list');
    const [currentReport, setCurrentReport] = useState<EightDReport | null>(null);
    const [activeStep, setActiveStep] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);

    // -----------------------------------------------------------------------
    // Persistence (load on mount)
    // -----------------------------------------------------------------------
    useEffect(() => {
        let cancelled = false;
        eightDRepository.getAll().then(rows => {
            if (cancelled) return;
            return Promise.all(rows.map(r => eightDRepository.getById(r.id)));
        }).then(reports => {
            if (cancelled || !reports) return;
            setReports(reports.filter((r): r is EightDReport => r !== null));
            setLoaded(true);
        }).catch(err => {
            logger.error('EightD', 'Failed to load reports', {}, err instanceof Error ? err : undefined);
            setLoaded(true);
        });
        return () => { cancelled = true; };
    }, []);

    // -----------------------------------------------------------------------
    // CRUD callbacks
    // -----------------------------------------------------------------------
    const handleCreate = useCallback(async () => {
        try {
            const number = await eightDRepository.getNextReportNumber();
            const report = createEmptyReport();
            report.reportNumber = number;
            await eightDRepository.save(report);
            setReports(prev => [report, ...prev]);
            setCurrentReport(report);
            setActiveStep(0);
            setView('edit');
            logger.info('8D', 'Created new report', { id: report.id, number: report.reportNumber });
        } catch (err) {
            logger.error('EightD', 'Failed to create report', {}, err instanceof Error ? err : undefined);
        }
    }, []);

    const handleSelect = useCallback((report: EightDReport) => {
        setCurrentReport({ ...report });
        setActiveStep(report.currentStep);
        setView('edit');
    }, []);

    const handleDelete = useCallback(async (id: string) => {
        try {
            await eightDRepository.deleteReport(id);
            setReports(prev => prev.filter(r => r.id !== id));
            setDeleteConfirmId(null);
            if (currentReport?.id === id) {
                setCurrentReport(null);
                setView('list');
            }
            logger.info('8D', 'Deleted report', { id });
        } catch (err) {
            logger.error('EightD', 'Failed to delete report', {}, err instanceof Error ? err : undefined);
        }
    }, [currentReport?.id]);

    const handleReportChange = useCallback((patch: Partial<EightDReport>) => {
        setCurrentReport((prev) => {
            if (!prev) return prev;
            return { ...prev, ...patch, updatedAt: new Date().toISOString() };
        });
    }, []);

    const handleSave = useCallback(async () => {
        if (!currentReport) return;
        try {
            const updated = { ...currentReport, currentStep: activeStep, updatedAt: new Date().toISOString() };
            await eightDRepository.save(updated);
            setReports(prev => {
                const idx = prev.findIndex(r => r.id === updated.id);
                if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = updated;
                    return next;
                }
                return [updated, ...prev];
            });
            setCurrentReport(updated);
            logger.info('8D', 'Saved report', { id: updated.id });
        } catch (err) {
            logger.error('EightD', 'Failed to save report', {}, err instanceof Error ? err : undefined);
        }
    }, [currentReport, activeStep]);

    const handleBackToList = useCallback(() => {
        if (currentReport) {
            handleSave();
        }
        setView('list');
        setCurrentReport(null);
    }, [currentReport, handleSave]);

    // -----------------------------------------------------------------------
    // Filtering
    // -----------------------------------------------------------------------
    const filteredReports = useMemo(() => {
        if (!searchTerm.trim()) return reports;
        const term = searchTerm.toLowerCase();
        return reports.filter(
            (r) =>
                r.reportNumber.toLowerCase().includes(term) ||
                r.title.toLowerCase().includes(term) ||
                r.d2.partNumber.toLowerCase().includes(term) ||
                r.d1.leader.toLowerCase().includes(term) ||
                r.d0.client.toLowerCase().includes(term),
        );
    }, [reports, searchTerm]);

    // -----------------------------------------------------------------------
    // Progress
    // -----------------------------------------------------------------------
    const progress = useMemo(() => (currentReport ? calculateProgress(currentReport) : 0), [currentReport]);

    // -----------------------------------------------------------------------
    // Step navigation
    // -----------------------------------------------------------------------
    const handlePrev = useCallback(() => setActiveStep((s) => Math.max(0, s - 1)), []);
    const handleNext = useCallback(() => setActiveStep((s) => Math.min(D_STEPS.length - 1, s + 1)), []);

    // -----------------------------------------------------------------------
    // Render - List view
    // -----------------------------------------------------------------------
    if (view === 'list') {
        return (
            <div className="min-h-screen bg-slate-900 text-slate-100">
                {/* Header */}
                <div className="border-b border-slate-700 bg-slate-800/50">
                    <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onBackToLanding}
                                className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
                            >
                                Volver
                            </button>
                            <h1 className="text-xl font-bold text-slate-100">Reportes 8D</h1>
                        </div>
                        <button
                            onClick={handleCreate}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            Nuevo 8D
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="max-w-7xl mx-auto px-4 pt-4">
                    <input
                        className={`${inputCls} max-w-md`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por numero, titulo, parte, lider o cliente..."
                    />
                </div>

                {/* Report list */}
                <div className="max-w-7xl mx-auto px-4 py-4">
                    {filteredReports.length === 0 ? (
                        <div className="text-center py-16 text-slate-500">
                            {reports.length === 0
                                ? 'No hay reportes 8D. Haga clic en "Nuevo 8D" para crear uno.'
                                : 'No se encontraron reportes con ese criterio de busqueda.'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-700 text-left text-xs text-slate-400 uppercase tracking-wider">
                                        <th className="pb-2 pr-4">Numero</th>
                                        <th className="pb-2 pr-4">Titulo</th>
                                        <th className="pb-2 pr-4">Urgencia</th>
                                        <th className="pb-2 pr-4">Estado</th>
                                        <th className="pb-2 pr-4">Parte</th>
                                        <th className="pb-2 pr-4">Fecha</th>
                                        <th className="pb-2 pr-4">Lider</th>
                                        <th className="pb-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredReports.map((r) => (
                                        <tr
                                            key={r.id}
                                            className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors"
                                            onClick={() => handleSelect(r)}
                                        >
                                            <td className="py-3 pr-4 font-mono text-blue-400">{r.reportNumber || '--'}</td>
                                            <td className="py-3 pr-4 text-slate-200 max-w-[200px] truncate">{r.title || '(Sin titulo)'}</td>
                                            <td className="py-3 pr-4">
                                                <span className={`text-xs px-2 py-0.5 rounded border ${URGENCY_COLORS[r.d0.urgency]}`}>
                                                    {r.d0.urgency}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-4">
                                                <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[r.status]}`}>
                                                    {r.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-4 font-mono text-xs text-slate-400">{r.d2.partNumber || '--'}</td>
                                            <td className="py-3 pr-4 text-xs text-slate-400">
                                                {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '--'}
                                            </td>
                                            <td className="py-3 pr-4 text-slate-300">{r.d1.leader || '--'}</td>
                                            <td className="py-3 text-right">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteConfirmId(r.id);
                                                    }}
                                                    className="text-xs text-slate-500 hover:text-red-400 transition-colors px-2 py-1"
                                                >
                                                    Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Delete confirmation */}
                {deleteConfirmId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-sm mx-4 shadow-xl">
                            <h3 className="text-lg font-semibold text-slate-100 mb-2">Confirmar eliminacion</h3>
                            <p className="text-sm text-slate-400 mb-4">
                                Esta accion no se puede deshacer. Se eliminara el reporte 8D permanentemente.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => handleDelete(deleteConfirmId)}
                                    className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // -----------------------------------------------------------------------
    // Render - Edit view
    // -----------------------------------------------------------------------
    if (!currentReport) return null;

    const StepRenderer = STEP_RENDERERS[activeStep];
    const currentStepDef = D_STEPS[activeStep];
    const stepTip = STEP_TIPS[currentStepDef.id];

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100">
            {/* Header */}
            <div className="border-b border-slate-700 bg-slate-800/50">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between mb-3">
                        <button
                            onClick={handleBackToList}
                            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
                        >
                            Volver a lista
                        </button>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-mono">{currentReport.reportNumber}</span>
                            <button
                                onClick={handleSave}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>

                    {/* Title */}
                    <input
                        className="w-full bg-transparent border-none text-xl font-bold text-slate-100 placeholder-slate-600 focus:outline-none mb-3"
                        value={currentReport.title}
                        onChange={(e) => handleReportChange({ title: e.target.value })}
                        placeholder="Titulo del reporte 8D..."
                    />

                    {/* Barack header fields */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                        <Field label="Vehiculo">
                            <input className={inputCls} value={currentReport.vehicle} onChange={(e) => handleReportChange({ vehicle: e.target.value })} placeholder="Ej: Taos" />
                        </Field>
                        <Field label="Modelo">
                            <input className={inputCls} value={currentReport.model} onChange={(e) => handleReportChange({ model: e.target.value })} placeholder="Ej: 2026" />
                        </Field>
                        <Field label="Planta">
                            <input className={inputCls} value={currentReport.plant} onChange={(e) => handleReportChange({ plant: e.target.value })} placeholder="Ej: Pacheco" />
                        </Field>
                        <Field label="Nombre pieza">
                            <input className={inputCls} value={currentReport.partName} onChange={(e) => handleReportChange({ partName: e.target.value })} placeholder="Ej: Insert" />
                        </Field>
                        <Field label="N° Referencia">
                            <input className={inputCls} value={currentReport.referenceNumber} onChange={(e) => handleReportChange({ referenceNumber: e.target.value })} placeholder="Ej: N 227" />
                        </Field>
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-3 mb-3">
                        <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                            <div
                                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <span className="text-xs text-slate-400 font-mono w-10 text-right">{progress}%</span>
                    </div>

                    {/* Step tabs */}
                    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-600">
                        {D_STEPS.map((step, idx) => (
                            <button
                                key={step.id}
                                onClick={() => setActiveStep(idx)}
                                className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                    idx === activeStep
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
                                }`}
                            >
                                {step.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Step content */}
            <div className="max-w-5xl mx-auto px-4 py-6">
                {/* Step title and description */}
                <div className="mb-4">
                    <h2 className="text-lg font-bold text-slate-100">
                        {currentStepDef.label}: {currentStepDef.title}
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">{currentStepDef.desc}</p>
                </div>

                {/* Info tip */}
                {stepTip && (
                    <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-3 mb-6 text-xs text-slate-400 leading-relaxed">
                        {stepTip}
                    </div>
                )}

                {/* Step form */}
                {StepRenderer && <StepRenderer report={currentReport} onChange={handleReportChange} />}

                {/* Navigation */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-700">
                    <button
                        onClick={handlePrev}
                        disabled={activeStep === 0}
                        className="px-4 py-2 text-sm rounded-md bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        Anterior
                    </button>
                    <span className="text-xs text-slate-500">
                        Paso {activeStep + 1} de {D_STEPS.length}
                    </span>
                    <button
                        onClick={handleNext}
                        disabled={activeStep === D_STEPS.length - 1}
                        className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        Siguiente
                    </button>
                </div>

                {/* Export buttons */}
                <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-700">
                    <button
                        onClick={async () => {
                            try {
                                await exportEightDToExcel(currentReport);
                            } catch (err) {
                                logger.error('EightD', 'Excel export failed', {}, err instanceof Error ? err : undefined);
                            }
                        }}
                        className="px-4 py-2 text-sm rounded-md bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                    >
                        Exportar Excel
                    </button>
                    <button
                        onClick={async () => {
                            try {
                                await exportFieldSheetPdf(currentReport || undefined);
                            } catch (err) {
                                logger.error('EightD', 'PDF export failed', {}, err instanceof Error ? err : undefined);
                            }
                        }}
                        className="px-4 py-2 text-sm rounded-md bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                    >
                        PDF Hoja de Campo
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Wrapped export with error boundary
// ---------------------------------------------------------------------------

export default function EightDApp({ onBackToLanding }: EightDAppProps) {
    return (
        <ModuleErrorBoundary moduleName="8D Report" onNavigateHome={onBackToLanding}>
            <EightDAppInner onBackToLanding={onBackToLanding} />
        </ModuleErrorBoundary>
    );
}
