/**
 * AMFE Audit Panel
 *
 * Shows deterministic audit results + optional AI review.
 * Issues displayed sorted by severity (critical → warning → info).
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
    X, AlertTriangle, AlertCircle, Info, Shield, Loader2,
    Sparkles, ChevronDown, ChevronUp, CheckCircle2,
} from 'lucide-react';
import { AmfeDocument } from './amfeTypes';
import { runAudit, requestAiReview, AuditReport, AuditIssue, AiReviewResult, AuditSeverity } from './amfeAudit';
import { GeminiError } from '../../utils/geminiClient';

interface AmfeAuditPanelProps {
    doc: AmfeDocument;
    onClose: () => void;
}

const SEVERITY_CONFIG: Record<AuditSeverity, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
    critical: {
        icon: <AlertCircle size={14} />,
        color: 'text-red-600',
        bg: 'bg-red-50 border-red-200',
        label: 'Crítico',
    },
    warning: {
        icon: <AlertTriangle size={14} />,
        color: 'text-yellow-600',
        bg: 'bg-yellow-50 border-yellow-200',
        label: 'Advertencia',
    },
    info: {
        icon: <Info size={14} />,
        color: 'text-blue-500',
        bg: 'bg-blue-50 border-blue-200',
        label: 'Info',
    },
};

const AmfeAuditPanel: React.FC<AmfeAuditPanelProps> = ({ doc, onClose }) => {
    const report = useMemo(() => runAudit(doc), [doc]);
    const [aiReview, setAiReview] = useState<AiReviewResult | null>(null);
    const [isLoadingAi, setIsLoadingAi] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['AP Alto', 'Controles']));
    const abortRef = useRef<AbortController | null>(null);

    const handleAiReview = useCallback(async () => {
        if (isLoadingAi) {
            abortRef.current?.abort();
            return;
        }

        setIsLoadingAi(true);
        setAiError(null);
        abortRef.current = new AbortController();

        try {
            const result = await requestAiReview(doc, abortRef.current.signal);
            setAiReview(result);
        } catch (err) {
            if (err instanceof GeminiError) {
                switch (err.code) {
                    case 'NO_KEY':
                        setAiError('No hay API key configurada. Abrí el Copiloto IA con el botón del toolbar.');
                        break;
                    case 'TIMEOUT':
                        setAiError('La solicitud tardó demasiado. Intentá de nuevo.');
                        break;
                    default:
                        setAiError(err.message);
                }
            } else {
                setAiError('Error inesperado en la revisión IA.');
            }
        } finally {
            setIsLoadingAi(false);
            abortRef.current = null;
        }
    }, [doc, isLoadingAi]);

    // Group issues by category
    const groupedIssues = useMemo(() => {
        const groups: Record<string, AuditIssue[]> = {};
        for (const issue of report.issues) {
            if (!groups[issue.category]) groups[issue.category] = [];
            groups[issue.category].push(issue);
        }
        return groups;
    }, [report.issues]);

    const toggleCategory = useCallback((cat: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
    }, []);

    const scoreColor = report.score >= 80 ? 'text-green-600' : report.score >= 50 ? 'text-yellow-600' : 'text-red-600';
    const scoreBg = report.score >= 80 ? 'bg-green-50' : report.score >= 50 ? 'bg-yellow-50' : 'bg-red-50';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-2xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200">
                    <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Shield size={18} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-sm font-semibold text-gray-800">Auditoría del AMFE</h2>
                        <p className="text-xs text-gray-500">Verificación de completitud y calidad</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {/* Score + Summary */}
                    <div className="flex items-center gap-4">
                        <div className={`w-20 h-20 rounded-xl ${scoreBg} flex flex-col items-center justify-center`}>
                            <span className={`text-2xl font-bold ${scoreColor}`}>{report.score}</span>
                            <span className="text-[10px] text-gray-500">/ 100</span>
                        </div>
                        <div className="flex-1 grid grid-cols-3 gap-2">
                            <div className="bg-red-50 rounded-lg p-2 text-center">
                                <span className="text-lg font-bold text-red-600">{report.critical}</span>
                                <p className="text-[10px] text-red-500">Críticos</p>
                            </div>
                            <div className="bg-yellow-50 rounded-lg p-2 text-center">
                                <span className="text-lg font-bold text-yellow-600">{report.warnings}</span>
                                <p className="text-[10px] text-yellow-500">Advertencias</p>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-2 text-center">
                                <span className="text-lg font-bold text-blue-500">{report.info}</span>
                                <p className="text-[10px] text-blue-400">Info</p>
                            </div>
                        </div>
                    </div>

                    {/* No issues */}
                    {report.issues.length === 0 && (
                        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
                            <CheckCircle2 size={20} className="text-green-600" />
                            <div>
                                <p className="text-sm font-medium text-green-800">AMFE sin problemas detectados</p>
                                <p className="text-xs text-green-600">Todos los checks determinísticos pasaron correctamente.</p>
                            </div>
                        </div>
                    )}

                    {/* Issues grouped by category */}
                    {Object.entries(groupedIssues).map(([category, issues]) => {
                        const isExpanded = expandedCategories.has(category);
                        const maxSeverity = issues[0]?.severity || 'info';
                        const config = SEVERITY_CONFIG[maxSeverity];

                        return (
                            <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                                <button
                                    onClick={() => toggleCategory(category)}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition text-left"
                                >
                                    <span className={config.color}>{config.icon}</span>
                                    <span className="text-xs font-semibold text-gray-700 flex-1">{category}</span>
                                    <span className="text-[10px] text-gray-400">{issues.length} issue{issues.length !== 1 ? 's' : ''}</span>
                                    {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                                </button>
                                {isExpanded && (
                                    <div className="divide-y divide-gray-100">
                                        {issues.map((issue, i) => {
                                            const sc = SEVERITY_CONFIG[issue.severity];
                                            return (
                                                <div key={i} className={`px-3 py-2 ${sc.bg} border-l-2`}>
                                                    <div className="flex items-start gap-2">
                                                        <span className={`${sc.color} mt-0.5`}>{sc.icon}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs text-gray-800">{issue.message}</p>
                                                            <p className="text-[10px] text-gray-500 truncate" title={issue.location}>
                                                                📍 {issue.location}
                                                            </p>
                                                            {issue.suggestion && (
                                                                <p className="text-[10px] text-blue-600 mt-0.5">
                                                                    💡 {issue.suggestion}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* AI Review Section */}
                    <div className="border-t border-gray-200 pt-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Sparkles size={14} className="text-purple-500" />
                                <span className="text-xs font-semibold text-gray-700">Revisión IA (opcional)</span>
                            </div>
                            <button
                                onClick={handleAiReview}
                                disabled={isLoadingAi && !abortRef.current}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                    isLoadingAi
                                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                }`}
                            >
                                {isLoadingAi ? (
                                    <>
                                        <Loader2 size={12} className="animate-spin" />
                                        Cancelar
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={12} />
                                        {aiReview ? 'Revisar de nuevo' : 'Pedir revisión IA'}
                                    </>
                                )}
                            </button>
                        </div>

                        {aiError && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-3">
                                <p className="text-xs text-red-700">{aiError}</p>
                            </div>
                        )}

                        {aiReview && (
                            <div className="space-y-3">
                                {aiReview.missingFailureModes.length > 0 && (
                                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                        <h4 className="text-xs font-semibold text-orange-800 mb-1">
                                            Modos de Falla Faltantes
                                        </h4>
                                        <ul className="space-y-1">
                                            {aiReview.missingFailureModes.map((m, i) => (
                                                <li key={i} className="text-xs text-orange-700">• {m}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {aiReview.controlGaps.length > 0 && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                        <h4 className="text-xs font-semibold text-yellow-800 mb-1">
                                            Brechas en Controles
                                        </h4>
                                        <ul className="space-y-1">
                                            {aiReview.controlGaps.map((g, i) => (
                                                <li key={i} className="text-xs text-yellow-700">• {g}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {aiReview.generalObservations.length > 0 && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                        <h4 className="text-xs font-semibold text-blue-800 mb-1">
                                            Observaciones Generales
                                        </h4>
                                        <ul className="space-y-1">
                                            {aiReview.generalObservations.map((o, i) => (
                                                <li key={i} className="text-xs text-blue-700">• {o}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {aiReview.missingFailureModes.length === 0 &&
                                 aiReview.controlGaps.length === 0 &&
                                 aiReview.generalObservations.length === 0 && (
                                    <p className="text-xs text-gray-400 text-center py-2">
                                        La IA no encontró observaciones adicionales.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AmfeAuditPanel;
