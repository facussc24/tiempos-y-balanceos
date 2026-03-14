/**
 * AlertCenter Component
 * 
 * Consolidates multiple alerts into a single collapsible component
 * to reduce visual noise and alert fatigue.
 * 
 * Features:
 * - Shows only the most critical alert by default
 * - Badge counter shows remaining alerts
 * - Expandable to see all alerts
 * - Alerts are prioritized by severity
 * 
 * @module AlertCenter
 * @version 1.0.0
 */

import React, { useState, useMemo } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, X, AlertCircle, Info } from 'lucide-react';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface Alert {
    id: string;
    severity: AlertSeverity;
    title: string;
    message: React.ReactNode;
    details?: React.ReactNode;
    icon?: React.ReactNode;
    action?: {
        label: string;
        onClick: () => void;
    };
}

interface AlertCenterProps {
    alerts: Alert[];
    maxVisible?: number;
    className?: string;
    onDismiss?: (id: string) => void;
}

/**
 * Severity configuration for styling
 */
const SEVERITY_CONFIG: Record<AlertSeverity, {
    bgColor: string;
    borderColor: string;
    iconColor: string;
    textColor: string;
    badgeColor: string;
    priority: number;
}> = {
    critical: {
        bgColor: 'bg-red-50',
        borderColor: 'border-red-500',
        iconColor: 'text-red-500',
        textColor: 'text-red-800',
        badgeColor: 'bg-red-500 text-white',
        priority: 3
    },
    warning: {
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-500',
        iconColor: 'text-amber-500',
        textColor: 'text-amber-800',
        badgeColor: 'bg-amber-500 text-white',
        priority: 2
    },
    info: {
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-500',
        iconColor: 'text-blue-500',
        textColor: 'text-blue-800',
        badgeColor: 'bg-blue-500 text-white',
        priority: 1
    }
};

/**
 * Get default icon for severity
 */
function getDefaultIcon(severity: AlertSeverity, size = 24) {
    switch (severity) {
        case 'critical':
            return <AlertTriangle size={size} />;
        case 'warning':
            return <AlertCircle size={size} />;
        case 'info':
            return <Info size={size} />;
    }
}

/**
 * Single Alert Row Component
 */
const AlertRow: React.FC<{
    alert: Alert;
    isExpanded: boolean;
    onDismiss?: () => void;
}> = ({ alert, isExpanded, onDismiss }) => {
    const config = SEVERITY_CONFIG[alert.severity];

    return (
        <div className={`${config.bgColor} border-l-4 ${config.borderColor} p-4 rounded-r shadow-sm hover:shadow-md transition-all duration-200`}>
            <div className="flex items-start gap-3">
                <div className={`${config.iconColor} mt-0.5 flex-shrink-0`}>
                    {alert.icon || getDefaultIcon(alert.severity)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className={`font-bold ${config.textColor} text-base`}>
                            {alert.title}
                        </h3>
                        {onDismiss && (
                            <button
                                onClick={onDismiss}
                                className={`${config.textColor} opacity-50 hover:opacity-100 transition-opacity p-1 rounded`}
                                title="Descartar"
                                aria-label={`Descartar alerta: ${alert.title}`}
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    <div className={`text-sm ${config.textColor} opacity-90 mt-1`}>
                        {alert.message}
                    </div>
                    {isExpanded && alert.details && (
                        <div className={`mt-3 pt-3 border-t border-current/10 ${config.textColor} text-sm`}>
                            {alert.details}
                        </div>
                    )}
                    {alert.action && (
                        <button
                            onClick={alert.action.onClick}
                            className={`mt-3 px-3 py-1.5 text-xs font-semibold rounded-lg ${config.bgColor} ${config.textColor} border ${config.borderColor} hover:brightness-95 transition-all`}
                        >
                            {alert.action.label}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

/**
 * AlertCenter Component
 */
export const AlertCenter: React.FC<AlertCenterProps> = ({
    alerts,
    maxVisible = 1,
    className = '',
    onDismiss
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Sort alerts by severity (critical first)
    const sortedAlerts = useMemo(() => {
        return [...alerts].sort((a, b) =>
            SEVERITY_CONFIG[b.severity].priority - SEVERITY_CONFIG[a.severity].priority
        );
    }, [alerts]);

    // If no alerts, render nothing
    if (sortedAlerts.length === 0) {
        return null;
    }

    // Alerts to display
    const visibleAlerts = isExpanded ? sortedAlerts : sortedAlerts.slice(0, maxVisible);
    const hiddenCount = sortedAlerts.length - maxVisible;
    const hasMore = hiddenCount > 0;

    // Get highest severity for the expand button styling
    const highestSeverity = sortedAlerts[0]?.severity || 'info';
    const highestConfig = SEVERITY_CONFIG[highestSeverity];

    return (
        <div className={`space-y-2 ${className}`}>
            {/* Visible Alerts */}
            {visibleAlerts.map((alert, index) => (
                <div
                    key={alert.id}
                    className="animate-in slide-in-from-top-2"
                    style={{ animationDelay: `${index * 50}ms` }}
                >
                    <AlertRow
                        alert={alert}
                        isExpanded={isExpanded}
                        onDismiss={onDismiss ? () => onDismiss(alert.id) : undefined}
                    />
                </div>
            ))}

            {/* Expand/Collapse Button */}
            {hasMore && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg border-2 border-dashed transition-all ${isExpanded
                        ? 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100'
                        : `${highestConfig.bgColor} ${highestConfig.borderColor} ${highestConfig.textColor} hover:brightness-95`
                        }`}
                >
                    {isExpanded ? (
                        <>
                            <ChevronUp size={16} />
                            <span className="text-sm font-medium">Ocultar alertas</span>
                        </>
                    ) : (
                        <>
                            <span className={`${highestConfig.badgeColor} text-xs font-bold px-2 py-0.5 rounded-full`}>
                                +{hiddenCount}
                            </span>
                            <span className="text-sm font-medium">
                                {hiddenCount === 1 ? 'Otra alerta' : `Otras ${hiddenCount} alertas`}
                            </span>
                            <ChevronDown size={16} />
                        </>
                    )}
                </button>
            )}
        </div>
    );
};

export default AlertCenter;
