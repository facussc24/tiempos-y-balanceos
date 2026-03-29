/**
 * CrossDocAlertBanner — Amber banner showing pending cross-document alerts
 *
 * Displays when upstream documents (APQP cascade) have been revised
 * and this document may need updating.
 *
 * @module CrossDocAlertBanner
 */

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { CrossDocAlert } from '../../utils/crossDocumentAlerts';

interface CrossDocAlertBannerProps {
    alerts: CrossDocAlert[];
    onDismiss: (alert: CrossDocAlert) => void;
    onDismissAll: () => void;
}

export const CrossDocAlertBanner: React.FC<CrossDocAlertBannerProps> = ({
    alerts,
    onDismiss,
    onDismissAll,
}) => {
    if (alerts.length === 0) return null;

    return (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 no-print animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    {alerts.map((alert) => (
                        <div key={`${alert.sourceModule}-${alert.sourceDocId}`} className="flex items-center gap-2 text-xs text-amber-800">
                            <span className="flex-1">{alert.message}</span>
                            <button
                                onClick={() => onDismiss(alert)}
                                className="text-amber-400 hover:text-amber-600 p-0.5 rounded transition flex-shrink-0"
                                title="Descartar alerta"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>
                {alerts.length > 1 && (
                    <button
                        onClick={onDismissAll}
                        className="text-[10px] text-amber-600 hover:text-amber-800 font-medium whitespace-nowrap flex-shrink-0"
                    >
                        Descartar todas
                    </button>
                )}
            </div>
        </div>
    );
};

export default CrossDocAlertBanner;
