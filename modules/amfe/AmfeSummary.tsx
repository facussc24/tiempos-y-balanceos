/**
 * AMFE Summary Dashboard
 *
 * Collapsible panel showing AP distribution, action status, critical items,
 * and coverage KPIs for the current AMFE document.
 *
 * Data model: stats iterate over causes within each failure.
 * Severity comes from the parent failure; O, D, AP, status from each cause.
 */

import React, { useMemo } from 'react';
import { AmfeDocument, ActionPriority, AmfeFailure, AmfeCause } from './amfeTypes';
import { getDocumentCompletionErrors, ApHComplianceError, getSoftLimitWarnings } from './amfeValidation';
import { AlertTriangle, CheckCircle, Clock, XCircle, BarChart3, ShieldAlert, ShieldCheck } from 'lucide-react';

interface Props {
    data: AmfeDocument;
}

interface SummaryStats {
    totalOps: number;
    totalFailures: number;
    totalCauses: number;
    apH: number;
    apM: number;
    apL: number;
    apNone: number;
    statusPendiente: number;
    statusEnProceso: number;
    statusCompletado: number;
    statusCancelado: number;
    statusEmpty: number;
    criticalItems: { opName: string; failDescription: string; causeText: string; ap: string }[];
    coveragePercent: number;
}

interface CauseWithContext {
    opName: string;
    failure: AmfeFailure;
    cause: AmfeCause;
}

function computeStats(data: AmfeDocument): SummaryStats {
    const causeRows: CauseWithContext[] = [];
    let totalFailures = 0;

    for (const op of data.operations) {
        for (const we of op.workElements) {
            for (const func of we.functions) {
                for (const fail of func.failures) {
                    totalFailures++;
                    for (const cause of fail.causes) {
                        causeRows.push({ opName: op.name, failure: fail, cause });
                    }
                }
            }
        }
    }

    const totalCauses = causeRows.length;
    const apH = causeRows.filter(r => r.cause.ap === ActionPriority.HIGH).length;
    const apM = causeRows.filter(r => r.cause.ap === ActionPriority.MEDIUM).length;
    const apL = causeRows.filter(r => r.cause.ap === ActionPriority.LOW).length;

    const statusPendiente = causeRows.filter(r => r.cause.status === 'Pendiente').length;
    const statusEnProceso = causeRows.filter(r => r.cause.status === 'En Proceso').length;
    const statusCompletado = causeRows.filter(r => r.cause.status === 'Completado').length;
    const statusCancelado = causeRows.filter(r => r.cause.status === 'Cancelado').length;

    const criticalItems = causeRows
        .filter(r => r.cause.ap === ActionPriority.HIGH && r.cause.status !== 'Completado' && r.cause.status !== 'Cancelado')
        .map(r => ({
            opName: r.opName,
            failDescription: r.failure.description,
            causeText: r.cause.cause,
            ap: r.cause.ap as string,
        }))
        .slice(0, 10);

    // Coverage: a cause has complete S/O/D if parent severity + cause O + cause D are all valid
    const withCompleteSod = causeRows.filter(r => {
        const s = Number(r.failure.severity);
        const o = Number(r.cause.occurrence);
        const d = Number(r.cause.detection);
        return !isNaN(s) && s >= 1 && !isNaN(o) && o >= 1 && !isNaN(d) && d >= 1;
    }).length;

    return {
        totalOps: data.operations.length,
        totalFailures,
        totalCauses,
        apH, apM, apL,
        apNone: totalCauses - apH - apM - apL,
        statusPendiente, statusEnProceso, statusCompletado, statusCancelado,
        statusEmpty: totalCauses - statusPendiente - statusEnProceso - statusCompletado - statusCancelado,
        criticalItems,
        coveragePercent: totalCauses > 0 ? Math.round((withCompleteSod / totalCauses) * 100) : 0,
    };
}

const AmfeSummary: React.FC<Props> = ({ data }) => {
    const stats = useMemo(() => computeStats(data), [data]);
    const complianceErrors = useMemo(() => getDocumentCompletionErrors(data), [data]);
    const softLimitWarnings = useMemo(() => getSoftLimitWarnings(data), [data]);

    const apTotal = stats.apH + stats.apM + stats.apL;
    const apBarWidth = (count: number) => apTotal > 0 ? `${(count / apTotal) * 100}%` : '0%';

    // N1: AP=M compliance — AIAG-VDA requires documented justification when no actions are taken
    const apMCompliance = useMemo(() => {
        const apMCauses: { opName: string; weName: string; failDescription: string; causeText: string; causeId: string }[] = [];
        for (const op of data.operations) {
            for (const we of op.workElements) {
                for (const func of we.functions) {
                    for (const fail of func.failures) {
                        for (const cause of fail.causes) {
                            if (cause.ap === ActionPriority.MEDIUM) {
                                const hasActions = !!(cause.preventionAction || cause.detectionAction);
                                const hasJustification = !!cause.observations?.trim();
                                if (!hasActions && !hasJustification) {
                                    apMCauses.push({
                                        opName: op.name,
                                        weName: we.name,
                                        failDescription: fail.description,
                                        causeText: cause.cause,
                                        causeId: cause.id,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
        return { total: stats.apM, withoutJustification: apMCauses, count: apMCauses.length };
    }, [data, stats.apM]);

    return (
        <div className="bg-white border-b border-gray-200 shadow-sm">
            <div className="max-w-[1800px] mx-auto p-4">
                <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="text-blue-600" size={16} />
                    <h3 className="text-sm font-bold text-gray-800">Resumen AMFE</h3>
                    <span className="text-[10px] text-gray-400">{stats.totalOps} {stats.totalOps === 1 ? 'operacion' : 'operaciones'} | {stats.totalFailures} {stats.totalFailures === 1 ? 'falla' : 'fallas'} | {stats.totalCauses} {stats.totalCauses === 1 ? 'causa' : 'causas'}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* AP Distribution */}
                    <div className="border border-gray-200 rounded-lg p-3">
                        <h4 className="text-xs font-bold text-gray-600 mb-2">Distribucion AP</h4>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold w-6 text-center bg-red-500 text-white rounded px-1">H</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                    <div className="bg-red-500 h-full rounded-full transition-all" style={{ width: apBarWidth(stats.apH) }} />
                                </div>
                                <span className="text-xs font-bold text-gray-700 w-8 text-right">{stats.apH}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold w-6 text-center bg-yellow-400 text-black rounded px-1">M</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                    <div className="bg-yellow-400 h-full rounded-full transition-all" style={{ width: apBarWidth(stats.apM) }} />
                                </div>
                                <span className="text-xs font-bold text-gray-700 w-8 text-right">{stats.apM}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold w-6 text-center bg-green-500 text-white rounded px-1">L</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                    <div className="bg-green-500 h-full rounded-full transition-all" style={{ width: apBarWidth(stats.apL) }} />
                                </div>
                                <span className="text-xs font-bold text-gray-700 w-8 text-right">{stats.apL}</span>
                            </div>
                        </div>
                        {stats.apNone > 0 && (
                            <p className="text-[10px] text-gray-400 mt-1">{stats.apNone} sin AP (S/O/D incompletos)</p>
                        )}
                        <div className="mt-2 text-[10px] text-gray-500">
                            Cobertura S/O/D: <strong className={stats.coveragePercent === 100 ? 'text-green-600' : 'text-orange-600'}>{stats.coveragePercent}%</strong>
                        </div>
                    </div>

                    {/* Action Status */}
                    <div className="border border-gray-200 rounded-lg p-3">
                        <h4 className="text-xs font-bold text-gray-600 mb-2">Estado de Acciones</h4>
                        <div className="grid grid-cols-1 gap-1.5">
                            <div className="flex items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <Clock size={12} className="text-orange-500 flex-shrink-0" />
                                    <span className="text-xs truncate">Pendiente</span>
                                </div>
                                <span className="text-xs font-bold text-orange-600 flex-shrink-0">{stats.statusPendiente}</span>
                            </div>
                            <div className="flex items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <Clock size={12} className="text-blue-500 animate-pulse flex-shrink-0" />
                                    <span className="text-xs truncate">En Proceso</span>
                                </div>
                                <span className="text-xs font-bold text-blue-600 flex-shrink-0">{stats.statusEnProceso}</span>
                            </div>
                            <div className="flex items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                                    <span className="text-xs truncate">Completado</span>
                                </div>
                                <span className="text-xs font-bold text-green-600 flex-shrink-0">{stats.statusCompletado}</span>
                            </div>
                            <div className="flex items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <XCircle size={12} className="text-gray-400 flex-shrink-0" />
                                    <span className="text-xs truncate">Cancelado</span>
                                </div>
                                <span className="text-xs font-bold text-gray-500 flex-shrink-0">{stats.statusCancelado}</span>
                            </div>
                        </div>
                        {stats.statusEmpty > 0 && (
                            <p className="text-[10px] text-gray-400 mt-2">{stats.statusEmpty} {stats.statusEmpty === 1 ? 'causa' : 'causas'} sin estado asignado</p>
                        )}
                    </div>

                    {/* Critical Items */}
                    <div className="border border-gray-200 rounded-lg p-3">
                        <h4 className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1">
                            <AlertTriangle size={12} className="text-red-500" />
                            Items Criticos (AP=H abiertos)
                        </h4>
                        {stats.criticalItems.length === 0 ? (
                            <p className="text-xs text-green-600 mt-2">Sin items criticos abiertos</p>
                        ) : (
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                {stats.criticalItems.map((item, i) => (
                                    <div key={i} className="flex items-start gap-1.5 text-[10px]">
                                        <span className="bg-red-500 text-white rounded px-1 font-bold flex-shrink-0">H</span>
                                        <div className="min-w-0">
                                            <span className="text-gray-500">{item.opName}:</span>{' '}
                                            <span className="font-medium text-gray-800 break-words">{item.failDescription || '(sin descripcion)'}</span>
                                            {item.causeText && (
                                                <span className="text-gray-400 break-words"> - {item.causeText}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Compliance Section */}
                <div className={`mt-3 border rounded-lg p-3 ${complianceErrors.length > 0 ? 'border-red-300 bg-red-50/50' : 'border-green-300 bg-green-50/50'}`}>
                    <h4 className="text-xs font-bold flex items-center gap-1.5 mb-2">
                        {complianceErrors.length > 0 ? (
                            <>
                                <ShieldAlert size={14} className="text-red-500" />
                                <span className="text-red-700">Compliance AIAG-VDA: {complianceErrors.length} causa{complianceErrors.length !== 1 ? 's' : ''} AP=H sin optimizacion completa</span>
                            </>
                        ) : (
                            <>
                                <ShieldCheck size={14} className="text-green-600" />
                                <span className="text-green-700">Compliance AIAG-VDA: Todas las causas AP=H tienen acciones asignadas</span>
                            </>
                        )}
                    </h4>
                    {complianceErrors.length > 0 && (
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                            {complianceErrors.slice(0, 15).map((err, i) => {
                                const missingLabels = err.missing.map(m =>
                                    m === 'actions' ? 'acciones' : m === 'responsible' ? 'responsable' : 'fecha objetivo'
                                );
                                return (
                                    <div key={err.causeId} className="flex items-start gap-1.5 text-[10px]">
                                        <span className="bg-red-500 text-white rounded px-1 font-bold flex-shrink-0">H</span>
                                        <div className="min-w-0">
                                            <span className="text-gray-500">{err.opName} → {err.weName}:</span>{' '}
                                            <span className="font-medium text-gray-800">{err.failDescription}</span>
                                            <span className="text-gray-400"> - {err.causeText}</span>
                                            <span className="text-red-600 font-semibold ml-1">(falta: {missingLabels.join(', ')})</span>
                                        </div>
                                    </div>
                                );
                            })}
                            {complianceErrors.length > 15 && (
                                <p className="text-[10px] text-red-500">...y {complianceErrors.length - 15} mas</p>
                            )}
                        </div>
                    )}
                </div>

                {/* AP=M Compliance Sub-banner */}
                {apMCompliance.total > 0 && (
                    <div className={`mt-3 border rounded-lg p-3 ${apMCompliance.count > 0 ? 'border-amber-300 bg-amber-50/50' : 'border-green-300 bg-green-50/50'}`}>
                        <h4 className="text-xs font-bold flex items-center gap-1.5 mb-1">
                            {apMCompliance.count > 0 ? (
                                <>
                                    <AlertTriangle size={14} className="text-amber-500" />
                                    <span className="text-amber-700">AP=M: {apMCompliance.count} causa{apMCompliance.count !== 1 ? 's' : ''} sin acciones ni justificacion documentada</span>
                                </>
                            ) : (
                                <>
                                    <ShieldCheck size={14} className="text-green-600" />
                                    <span className="text-green-700">AP=M: Todas las {apMCompliance.total} causas tienen acciones o justificacion</span>
                                </>
                            )}
                        </h4>
                        {apMCompliance.count > 0 && (
                            <>
                                <p className="text-[10px] text-amber-600 mb-1.5">AIAG-VDA: si no se toman acciones, es obligatorio documentar una justificacion tecnica en Observaciones.</p>
                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {apMCompliance.withoutJustification.slice(0, 10).map((item) => (
                                        <div key={item.causeId} className="flex items-start gap-1.5 text-[10px]">
                                            <span className="bg-yellow-400 text-black rounded px-1 font-bold flex-shrink-0">M</span>
                                            <div className="min-w-0">
                                                <span className="text-gray-500">{item.opName} → {item.weName}:</span>{' '}
                                                <span className="font-medium text-gray-800">{item.failDescription}</span>
                                                {item.causeText && <span className="text-gray-400"> - {item.causeText}</span>}
                                            </div>
                                        </div>
                                    ))}
                                    {apMCompliance.count > 10 && (
                                        <p className="text-[10px] text-amber-500">...y {apMCompliance.count - 10} mas</p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Soft Limit Warnings */}
                {softLimitWarnings.length > 0 && (
                    <div className="mt-3 border rounded-lg p-3 border-amber-300 bg-amber-50/50">
                        <h4 className="text-xs font-bold flex items-center gap-1.5 mb-2">
                            <AlertTriangle size={14} className="text-amber-500" />
                            <span className="text-amber-700">Recomendaciones de tamano ({softLimitWarnings.length})</span>
                        </h4>
                        <div className="space-y-1">
                            {softLimitWarnings.map((w, i) => (
                                <p key={i} className="text-[10px] text-amber-700">{w}</p>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AmfeSummary;
