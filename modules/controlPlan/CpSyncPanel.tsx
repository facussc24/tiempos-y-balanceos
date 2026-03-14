/**
 * CpSyncPanel - AMFE <-> Control Plan Sync Alerts Panel
 *
 * Side panel that displays synchronization alerts between the AMFE
 * and Control Plan. Users can apply suggested changes, dismiss
 * individual alerts, dismiss all, or regenerate the entire CP.
 */

import React, { useEffect, useMemo } from 'react';
import { SyncAlert } from './cpSyncEngine';
import {
    X, Check, AlertTriangle, RefreshCw, ArrowRight,
    Trash2, Plus, Edit3, Shield
} from 'lucide-react';

interface CpSyncPanelProps {
    alerts: SyncAlert[];
    onApplyAlert: (alert: SyncAlert) => void;
    onDismissAlert: (alertId: string) => void;
    onDismissAll: () => void;
    onClose: () => void;
    onRegenerateCp: () => void;
}

// Severity sort order and display config
const SEVERITY_CONFIG: Record<SyncAlert['severity'], {
    order: number;
    label: string;
    dotClass: string;
    bgClass: string;
    borderClass: string;
}> = {
    high: {
        order: 0,
        label: 'Alta',
        dotClass: 'bg-red-500',
        bgClass: 'bg-red-50',
        borderClass: 'border-red-200',
    },
    medium: {
        order: 1,
        label: 'Media',
        dotClass: 'bg-amber-500',
        bgClass: 'bg-amber-50',
        borderClass: 'border-amber-200',
    },
    low: {
        order: 2,
        label: 'Baja',
        dotClass: 'bg-gray-400',
        bgClass: 'bg-gray-50',
        borderClass: 'border-gray-200',
    },
};

/** Icon for the alert type */
function AlertTypeIcon({ type }: { type: SyncAlert['type'] }) {
    switch (type) {
        case 'cause_added':
            return <Plus size={12} className="text-green-500 flex-shrink-0" />;
        case 'cause_removed':
            return <Trash2 size={12} className="text-red-500 flex-shrink-0" />;
        case 'cause_changed':
        case 'severity_changed':
        case 'ap_changed':
        case 'control_changed':
        case 'failure_changed':
            return <Edit3 size={12} className="text-blue-500 flex-shrink-0" />;
        case 'orphan_cause':
            return <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />;
        default:
            return <ArrowRight size={12} className="text-gray-400 flex-shrink-0" />;
    }
}

const CpSyncPanel: React.FC<CpSyncPanelProps> = ({
    alerts,
    onApplyAlert,
    onDismissAlert,
    onDismissAll,
    onClose,
    onRegenerateCp,
}) => {
    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Group alerts by severity
    const groupedAlerts = useMemo(() => {
        const groups: Record<SyncAlert['severity'], SyncAlert[]> = {
            high: [],
            medium: [],
            low: [],
        };
        for (const alert of alerts) {
            groups[alert.severity].push(alert);
        }
        // Return only non-empty groups, ordered high -> medium -> low
        return (['high', 'medium', 'low'] as const)
            .filter(severity => groups[severity].length > 0)
            .map(severity => ({
                severity,
                config: SEVERITY_CONFIG[severity],
                items: groups[severity],
            }));
    }, [alerts]);

    const hasAlerts = alerts.length > 0;

    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
                className="flex-1 bg-black/30 animate-in fade-in duration-150"
                role="presentation"
                onClick={onClose}
            />

            {/* Side Panel */}
            <div className="w-[400px] bg-white shadow-2xl border-l border-gray-200 flex flex-col animate-in slide-in-from-right">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <Shield size={18} className="text-blue-600 flex-shrink-0" />
                        <h2 className="font-bold text-sm text-gray-800 truncate">
                            Sincronización AMFE ↔ CP
                        </h2>
                        {hasAlerts && (
                            <span className="flex-shrink-0 bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                                {alerts.length}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition"
                        title="Cerrar panel"
                        aria-label="Cerrar panel de sincronización"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {!hasAlerts ? (
                        /* Success state: everything in sync */
                        <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
                                <Check size={28} className="text-green-600" />
                            </div>
                            <h3 className="text-sm font-bold text-gray-800 mb-1">
                                Todo sincronizado
                            </h3>
                            <p className="text-xs text-gray-500">
                                AMFE y CP están sincronizados. No hay alertas pendientes.
                            </p>
                        </div>
                    ) : (
                        /* Alert list grouped by severity */
                        <div className="p-3 space-y-4">
                            {groupedAlerts.map(group => (
                                <div key={group.severity}>
                                    {/* Group header */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`w-2.5 h-2.5 rounded-full ${group.config.dotClass}`} />
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                            Severidad {group.config.label}
                                        </span>
                                        <span className="text-[10px] text-gray-400">
                                            ({group.items.length})
                                        </span>
                                    </div>

                                    {/* Alert cards */}
                                    <div className="space-y-2">
                                        {group.items.map(alert => (
                                            <div
                                                key={alert.id}
                                                className={`rounded-lg border p-3 ${group.config.bgClass} ${group.config.borderClass} transition hover:shadow-sm`}
                                            >
                                                {/* Top row: severity dot + operation badge + type icon */}
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${group.config.dotClass}`} />
                                                    <span className="text-[10px] font-mono font-bold bg-white/80 border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                                                        Op {alert.operationNumber}
                                                    </span>
                                                    <AlertTypeIcon type={alert.type} />
                                                </div>

                                                {/* Message */}
                                                <p className="text-xs font-semibold text-gray-800 mb-0.5">
                                                    {alert.message}
                                                </p>

                                                {/* Detail */}
                                                <p className="text-[11px] text-gray-500 mb-1.5">
                                                    {alert.detail}
                                                </p>

                                                {/* Suggested action */}
                                                {alert.suggestedAction && (
                                                    <p className="text-[11px] text-blue-600 italic mb-2 flex items-start gap-1">
                                                        <ArrowRight size={11} className="mt-0.5 flex-shrink-0" />
                                                        {alert.suggestedAction}
                                                    </p>
                                                )}

                                                {/* Action buttons */}
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => onApplyAlert(alert)}
                                                        className="flex items-center gap-1 text-[10px] font-medium text-white bg-green-600 hover:bg-green-700 px-2.5 py-1.5 rounded-md transition"
                                                    >
                                                        <Check size={11} />
                                                        Aplicar
                                                    </button>
                                                    <button
                                                        onClick={() => onDismissAlert(alert.id)}
                                                        className="flex items-center gap-1 text-[10px] font-medium text-gray-600 bg-white hover:bg-gray-100 border border-gray-200 px-2.5 py-1.5 rounded-md transition"
                                                    >
                                                        <X size={11} />
                                                        Ignorar
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer (only shown when there are alerts) */}
                {hasAlerts && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                        <button
                            onClick={onDismissAll}
                            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 border border-gray-200 transition"
                        >
                            <Trash2 size={13} />
                            Ignorar Todas
                        </button>
                        <button
                            onClick={onRegenerateCp}
                            className="flex items-center gap-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg transition font-medium"
                        >
                            <RefreshCw size={13} />
                            Regenerar CP
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CpSyncPanel;
