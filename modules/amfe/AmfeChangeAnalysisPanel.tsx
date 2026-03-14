/**
 * AMFE Change Analysis Panel
 *
 * Free-text chat UI where the user describes a process change
 * and receives an AI-generated impact analysis report.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Send, Loader2, AlertTriangle, ArrowUp, ArrowDown, Minus, Sparkles, Plus } from 'lucide-react';
import { AmfeDocument } from './amfeTypes';
import { analyzeProcessChange, ChangeImpactReport, AffectedItem } from './amfeChangeAnalysis';
import { GeminiError } from '../../utils/geminiClient';

interface AmfeChangeAnalysisPanelProps {
    doc: AmfeDocument;
    onClose: () => void;
}

const RISK_CHANGE_LABELS: Record<AffectedItem['riskChange'], { label: string; color: string; icon: React.ReactNode }> = {
    increased: { label: 'Aumentó', color: 'text-red-600', icon: <ArrowUp size={14} /> },
    decreased: { label: 'Disminuyó', color: 'text-green-600', icon: <ArrowDown size={14} /> },
    unchanged: { label: 'Sin cambio', color: 'text-gray-500', icon: <Minus size={14} /> },
    new_risk: { label: 'Nuevo riesgo', color: 'text-orange-600', icon: <Plus size={14} /> },
};

const AmfeChangeAnalysisPanel: React.FC<AmfeChangeAnalysisPanelProps> = ({ doc, onClose }) => {
    const [description, setDescription] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [report, setReport] = useState<ChangeImpactReport | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);
    const abortRef = useRef<AbortController | null>(null);

    const handleAnalyze = useCallback(async () => {
        if (!description.trim() || isAnalyzing) return;

        setIsAnalyzing(true);
        setError(null);
        setReport(null);

        abortRef.current = new AbortController();

        try {
            const result = await analyzeProcessChange(
                description.trim(),
                doc,
                abortRef.current.signal,
            );
            setReport(result);
        } catch (err) {
            if (err instanceof GeminiError) {
                switch (err.code) {
                    case 'NO_KEY':
                        setError('No hay API key configurada. Abrí el Copiloto IA con el botón del toolbar.');
                        break;
                    case 'TIMEOUT':
                        setError('La solicitud tardó demasiado. Intentá de nuevo.');
                        break;
                    case 'RATE_LIMIT':
                        setError('Límite de solicitudes alcanzado. Esperá unos minutos.');
                        break;
                    case 'PARSE_ERROR':
                        setError(err.message);
                        break;
                    default:
                        setError(`Error: ${err.message}`);
                }
            } else {
                setError('Error inesperado al analizar el cambio.');
            }
        } finally {
            setIsAnalyzing(false);
            abortRef.current = null;
        }
    }, [description, doc, isAnalyzing]);

    const handleCancel = useCallback(() => {
        if (abortRef.current) {
            abortRef.current.abort();
        }
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleAnalyze();
        }
    }, [handleAnalyze]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
            <div role="dialog" aria-modal="true" aria-labelledby="change-analysis-title" className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200">
                    <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Sparkles size={18} className="text-purple-600" />
                    </div>
                    <div className="flex-1">
                        <h2 id="change-analysis-title" className="text-sm font-semibold text-gray-800">Análisis de Impacto por Cambio</h2>
                        <p className="text-xs text-gray-500">Describí el cambio de proceso y la IA analizará el impacto en el AMFE</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded hover:bg-gray-100 transition" title="Cerrar analisis" aria-label="Cerrar analisis">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {/* Input area */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            ¿Qué cambió en el proceso?
                        </label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ej: Se reemplazó la soldadora MIG por una laser. Los parámetros de corriente ya no aplican y se necesita calibración óptica..."
                            className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none transition"
                            rows={4}
                            disabled={isAnalyzing}
                        />
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-400">Ctrl+Enter para analizar</span>
                            <button
                                onClick={isAnalyzing ? handleCancel : handleAnalyze}
                                disabled={!isAnalyzing && !description.trim()}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition ${
                                    isAnalyzing
                                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                        : 'bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed'
                                }`}
                            >
                                {isAnalyzing ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Cancelar
                                    </>
                                ) : (
                                    <>
                                        <Send size={14} />
                                        Analizar
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                            <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-red-700">{error}</p>
                        </div>
                    )}

                    {/* Report */}
                    {report && (
                        <div className="space-y-4">
                            {/* Summary */}
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                <h3 className="text-xs font-semibold text-purple-800 mb-1">Resumen</h3>
                                <p className="text-sm text-purple-900">{report.summary}</p>
                            </div>

                            {/* Affected Items */}
                            {report.affectedItems.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-semibold text-gray-700 mb-2">
                                        Items Afectados ({report.affectedItems.length})
                                    </h3>
                                    <div className="space-y-2">
                                        {report.affectedItems.map((item, i) => {
                                            const risk = RISK_CHANGE_LABELS[item.riskChange];
                                            return (
                                                <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs font-medium text-gray-800">
                                                            {item.operationName}
                                                        </span>
                                                        {item.currentAP && (
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                                                item.currentAP === 'H' ? 'bg-red-100 text-red-700' :
                                                                item.currentAP === 'M' ? 'bg-yellow-100 text-yellow-700' :
                                                                'bg-green-100 text-green-700'
                                                            }`}>
                                                                AP={item.currentAP}
                                                            </span>
                                                        )}
                                                        <span className={`flex items-center gap-0.5 text-[10px] font-medium ${risk.color}`}>
                                                            {risk.icon} {risk.label}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-600">{item.failureDescription}</p>
                                                    {item.recommendation && (
                                                        <p className="text-xs text-blue-700 mt-1 bg-blue-50 px-2 py-1 rounded">
                                                            → {item.recommendation}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* New Risks */}
                            {report.newRisks.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-semibold text-orange-700 mb-2">
                                        Nuevos Riesgos ({report.newRisks.length})
                                    </h3>
                                    <ul className="space-y-1">
                                        {report.newRisks.map((risk, i) => (
                                            <li key={i} className="flex items-start gap-2 text-xs text-orange-800 bg-orange-50 p-2 rounded">
                                                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                                                {risk}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Suggested Actions */}
                            {report.suggestedActions.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-semibold text-green-700 mb-2">
                                        Acciones Sugeridas ({report.suggestedActions.length})
                                    </h3>
                                    <ul className="space-y-1">
                                        {report.suggestedActions.map((action, i) => (
                                            <li key={i} className="text-xs text-green-800 bg-green-50 p-2 rounded">
                                                {i + 1}. {action}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* No impact */}
                            {report.affectedItems.length === 0 && report.newRisks.length === 0 && (
                                <div className="text-center py-4 text-gray-400 text-xs">
                                    La IA no identificó impacto directo en el AMFE actual.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AmfeChangeAnalysisPanel;
