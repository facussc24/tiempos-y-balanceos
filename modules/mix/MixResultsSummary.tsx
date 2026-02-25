/**
 * MixResultsSummary - Resumen simplificado de resultados
 * 
 * Muestra el resultado del cálculo de Mix de forma clara:
 * - Estado (viable/no viable)
 * - Totales de recursos
 * - Resumen en una oración
 * 
 * @module MixResultsSummary
 * @version 2.0.0
 */
import React from 'react';
import { CheckCircle, XCircle, Users, Cog, Clock, BarChart3, HelpCircle } from 'lucide-react';
import { MixSimplifiedResult } from '../../types';

interface MixResultsSummaryProps {
    result: MixSimplifiedResult;
}

export const MixResultsSummary: React.FC<MixResultsSummaryProps> = ({ result }) => {
    return (
        <div className={`rounded-2xl border-2 overflow-hidden mb-6 transition-all ${result.isViable
            ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50 dark:border-emerald-800 dark:from-emerald-950/50 dark:to-green-900/50'
            : 'border-red-300 bg-gradient-to-br from-red-50 to-orange-50 dark:border-red-800 dark:from-red-950/50 dark:to-orange-900/50'
            }`}>
            {/* Header with Status */}
            <div className="px-6 py-5">
                <div className="flex items-center gap-4">
                    {result.isViable ? (
                        <div className="p-3 bg-emerald-100 rounded-xl dark:bg-emerald-900/50">
                            <CheckCircle size={32} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                    ) : (
                        <div className="p-3 bg-red-100 rounded-xl dark:bg-red-900/50">
                            <XCircle size={32} className="text-red-600 dark:text-red-400" />
                        </div>
                    )}

                    <div>
                        <h2 className={`text-xl font-bold ${result.isViable ? 'text-emerald-800 dark:text-emerald-200' : 'text-red-800 dark:text-red-200'
                            }`}>
                            {result.isViable ? '¡Producción Viable!' : 'Recursos Insuficientes'}
                        </h2>
                        <p className={`mt-1 ${result.isViable ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'
                            }`}>
                            {result.summary}
                        </p>
                    </div>
                </div>
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 pb-6">
                <KpiCard
                    icon={<Cog size={24} />}
                    value={result.totalMachines}
                    label="Máquinas"
                    color="blue"
                />
                <KpiCard
                    icon={<Users size={24} />}
                    value={result.totalOperators}
                    label="Operarios"
                    color="indigo"
                />
                <KpiCard
                    icon={<Clock size={24} />}
                    value={`${result.taktTimeSeconds.toFixed(1)}s`}
                    label="Takt Time"
                    color="purple"
                    subtitle="Tiempo por pieza"
                />
                <KpiCard
                    icon={<BarChart3 size={24} />}
                    value={result.sectors.length}
                    label="Sectores"
                    color="slate"
                />
            </div>

            {/* Product Breakdown */}
            {result.productBreakdown.length > 1 && (
                <div className="px-6 pb-6">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">
                        Distribución del Mix:
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                        {result.productBreakdown.map((prod, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-sm dark:bg-slate-800 dark:border-slate-700"
                            >
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: prod.color }}
                                />
                                <span className="font-medium text-slate-700 dark:text-slate-200">
                                    {prod.productName}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400">
                                    {prod.percentage}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* V4.2: Process Constraint Violations (Red - Critical) */}
            {result.processViolations && result.processViolations.length > 0 && (
                <div className="px-6 pb-4">
                    <div className="p-4 bg-red-100 border-2 border-red-400 rounded-xl dark:bg-red-900/30 dark:border-red-800">
                        <h4 className="font-bold text-red-800 dark:text-red-200 mb-2 flex items-center gap-2">
                            🔴 Restricciones Técnicas
                            <span
                                className="text-red-500 dark:text-red-400 cursor-help"
                                title="Estos tiempos son fijos (químicos o físicos). Agregar operarios NO reduce el tiempo. Se necesitan más máquinas o moldes."
                            >
                                <HelpCircle size={16} />
                            </span>
                        </h4>
                        <div className="space-y-2">
                            {result.processViolations.map((v, idx) => (
                                <p key={idx} className="text-red-700 dark:text-red-300 text-sm">
                                    <strong>{v.taskDescription}</strong>: {v.message}
                                    {v.deficit > 0 && (
                                        <span className="ml-2 px-2 py-0.5 bg-red-200 dark:bg-red-900/50 rounded text-xs font-bold">
                                            Déficit: {v.deficit} máquina(s)
                                        </span>
                                    )}
                                </p>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* V4.2: Model-Specific Takt Violations (Amber - Warning) */}
            {result.modelAlerts && result.modelAlerts.filter(a => a.severity === 'critical').length > 0 && (
                <div className="px-6 pb-4">
                    <div className="p-4 bg-amber-100 border-2 border-amber-400 rounded-xl dark:bg-amber-900/30 dark:border-amber-800">
                        <h4 className="font-bold text-amber-800 dark:text-amber-200 mb-2">
                            ⚠️ Modelos que Exceden el Takt (Promedio Engañoso)
                        </h4>
                        <p className="text-amber-700 dark:text-amber-300 text-xs mb-2">
                            El promedio ponderado parece OK, pero estos modelos causarán paros cuando aparezcan:
                        </p>
                        <div className="space-y-1">
                            {result.modelAlerts.filter(a => a.severity === 'critical').map((a, idx) => (
                                <p key={idx} className="text-amber-800 dark:text-amber-200 text-sm">
                                    <strong>{a.modelName}</strong> en tarea "{a.taskDescription}": {a.message}
                                </p>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
                <div className="px-6 pb-6">
                    <div className="space-y-2">
                        {result.warnings.map((warning, idx) => (
                            <div
                                key={idx}
                                className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-200"
                            >
                                {warning}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * KpiCard - Subcomponente para mostrar un KPI
 */
const KpiCard: React.FC<{
    icon: React.ReactNode;
    value: string | number;
    label: string;
    color: 'blue' | 'indigo' | 'purple' | 'slate';
    subtitle?: string;
}> = ({ icon, value, label, color, subtitle }) => {
    const colorClasses = {
        blue: 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300',
        indigo: 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-300',
        purple: 'bg-purple-50 border-purple-200 text-purple-600 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300',
        slate: 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300',
    };

    return (
        <div className={`p-4 rounded-xl border ${colorClasses[color]} flex flex-col items-center text-center transition-colors`}>
            <div className="mb-2 opacity-70">
                {icon}
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">
                {value}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {label}
            </p>
            {subtitle && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {subtitle}
                </p>
            )}
        </div>
    );
};
