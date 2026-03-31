/**
 * CoherencePanel — Semaphore-style panel showing cross-document coherence results.
 *
 * Shows green/yellow/red status with grouped issues by category.
 * Each issue is clickable to navigate to the problematic document/item.
 */

import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import type { CoherenceResult, CoherenceIssue, CoherenceSeverity } from '../../utils/crossDocumentCoherence';

interface Props {
    result: CoherenceResult;
    onNavigate?: (module: 'pfd' | 'amfe' | 'cp' | 'ho', itemId?: string) => void;
    onClose?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
    'amfe-cp': 'AMFE → Plan de Control',
    'cp-ho': 'Plan de Control → Hoja de Operaciones',
    'pfd-amfe': 'PFD ↔ AMFE',
    'op-names': 'Nombres de operaciones',
};

const SEVERITY_CONFIG: Record<CoherenceSeverity, { icon: typeof XCircle; color: string; bg: string }> = {
    error: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    warning: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50' },
};

const STATUS_CONFIG = {
    green: { color: 'bg-green-500', label: 'Todo alineado', textColor: 'text-green-700' },
    yellow: { color: 'bg-yellow-500', label: 'Advertencias detectadas', textColor: 'text-yellow-700' },
    red: { color: 'bg-red-500', label: 'Errores de coherencia', textColor: 'text-red-700' },
};

const CoherencePanel: React.FC<Props> = ({ result, onNavigate, onClose }) => {
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
        new Set(result.summary.status === 'green' ? [] : Object.keys(CATEGORY_LABELS))
    );

    const toggleCategory = (cat: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
    };

    const grouped = new Map<string, CoherenceIssue[]>();
    for (const issue of result.issues) {
        const list = grouped.get(issue.category) || [];
        list.push(issue);
        grouped.set(issue.category, list);
    }

    const statusCfg = STATUS_CONFIG[result.summary.status];

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-[70vh] flex flex-col">
            {/* Header with semaphore */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full ${statusCfg.color}`} />
                    <div>
                        <h3 className="font-semibold text-gray-900">Verificacion de coherencia</h3>
                        <p className={`text-sm ${statusCfg.textColor}`}>{statusCfg.label}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                    {result.summary.errors > 0 && (
                        <span className="text-red-600">{result.summary.errors} error(es)</span>
                    )}
                    {result.summary.warnings > 0 && (
                        <span className="text-yellow-600">{result.summary.warnings} advertencia(s)</span>
                    )}
                    {result.summary.infos > 0 && (
                        <span className="text-blue-500">{result.summary.infos} info(s)</span>
                    )}
                    {onClose && (
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2">
                            <XCircle className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Issue list grouped by category */}
            <div className="overflow-y-auto flex-1">
                {result.issues.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                        <p>Todos los documentos estan alineados.</p>
                    </div>
                ) : (
                    Array.from(grouped.entries()).map(([category, categoryIssues]) => {
                        const isExpanded = expandedCategories.has(category);
                        const catErrors = categoryIssues.filter(i => i.severity === 'error').length;
                        const catWarnings = categoryIssues.filter(i => i.severity === 'warning').length;

                        return (
                            <div key={category} className="border-b border-gray-100 last:border-b-0">
                                <button
                                    onClick={() => toggleCategory(category)}
                                    className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 text-left"
                                >
                                    <div className="flex items-center gap-2">
                                        {isExpanded
                                            ? <ChevronDown className="w-4 h-4 text-gray-400" />
                                            : <ChevronRight className="w-4 h-4 text-gray-400" />
                                        }
                                        <span className="font-medium text-sm text-gray-800">
                                            {CATEGORY_LABELS[category] || category}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        {catErrors > 0 && (
                                            <span className="text-red-600">{catErrors} error(es)</span>
                                        )}
                                        {catWarnings > 0 && (
                                            <span className="text-yellow-600">{catWarnings} adv.</span>
                                        )}
                                        <span className="text-gray-400">{categoryIssues.length} total</span>
                                    </div>
                                </button>
                                {isExpanded && (
                                    <div className="px-4 pb-2">
                                        {categoryIssues.map((issue, idx) => {
                                            const cfg = SEVERITY_CONFIG[issue.severity];
                                            const Icon = cfg.icon;
                                            return (
                                                <div
                                                    key={idx}
                                                    className={`flex items-start gap-2 p-2 rounded text-sm mb-1 ${cfg.bg} ${issue.navigateTo ? 'cursor-pointer hover:opacity-80' : ''}`}
                                                    onClick={() => issue.navigateTo && onNavigate?.(issue.navigateTo.module, issue.navigateTo.itemId)}
                                                >
                                                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.color}`} />
                                                    <span className="text-gray-700 flex-1">{issue.message}</span>
                                                    {issue.navigateTo && (
                                                        <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 text-gray-400" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default CoherencePanel;
