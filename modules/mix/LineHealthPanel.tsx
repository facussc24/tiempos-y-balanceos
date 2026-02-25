/**
 * LineHealthPanel - V4.8 Phase 27
 * 
 * Visual health check panel with 3 traffic light indicators:
 * 1. Demand Compliance (Takt)
 * 2. Technical Resources (Machines)
 * 3. Process Constraint (Chemical Curing)
 */
import React from 'react';
import {
    CheckCircle,
    XCircle,
    AlertTriangle,
    Clock,
    Wrench,
    FlaskConical,
    Lightbulb
} from 'lucide-react';

export interface HealthCheck {
    id: 'demand' | 'machines' | 'chemistry';
    status: 'ok' | 'warning' | 'critical';
    title: string;
    message: string;
    suggestion?: string;
    actionLabel?: string;
    onAction?: () => void;
}

interface LineHealthPanelProps {
    checks: HealthCheck[];
    isViable: boolean;
}

const getStatusIcon = (status: HealthCheck['status']) => {
    switch (status) {
        case 'ok':
            return <CheckCircle size={20} className="text-emerald-500" />;
        case 'warning':
            return <AlertTriangle size={20} className="text-amber-500" />;
        case 'critical':
            return <XCircle size={20} className="text-red-500 animate-pulse" />;
    }
};

const getCheckIcon = (id: HealthCheck['id']) => {
    switch (id) {
        case 'demand':
            return <Clock size={16} />;
        case 'machines':
            return <Wrench size={16} />;
        case 'chemistry':
            return <FlaskConical size={16} />;
    }
};

const getStatusBg = (status: HealthCheck['status']) => {
    switch (status) {
        case 'ok':
            return 'bg-emerald-50 border-emerald-200';
        case 'warning':
            return 'bg-amber-50 border-amber-200';
        case 'critical':
            return 'bg-red-50 border-red-200';
    }
};

const getStatusText = (status: HealthCheck['status']) => {
    switch (status) {
        case 'ok':
            return 'text-emerald-700';
        case 'warning':
            return 'text-amber-700';
        case 'critical':
            return 'text-red-700';
    }
};

export const LineHealthPanel: React.FC<LineHealthPanelProps> = ({
    checks,
    isViable
}) => {
    const criticalCount = checks.filter(c => c.status === 'critical').length;
    const warningCount = checks.filter(c => c.status === 'warning').length;

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Header */}
            <div className={`px-4 py-3 border-b ${isViable ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2">
                    {isViable ? (
                        <CheckCircle size={18} className="text-emerald-600" />
                    ) : (
                        <AlertTriangle size={18} className="text-red-600" />
                    )}
                    <h3 className={`font-semibold ${isViable ? 'text-emerald-700' : 'text-red-700'}`}>
                        {isViable ? 'Línea Viable' : 'Requiere Acción'}
                    </h3>
                </div>
                {!isViable && (
                    <p className="text-xs text-red-600 mt-1">
                        {criticalCount > 0 && `${criticalCount} crítico${criticalCount > 1 ? 's' : ''}`}
                        {criticalCount > 0 && warningCount > 0 && ' • '}
                        {warningCount > 0 && `${warningCount} alerta${warningCount > 1 ? 's' : ''}`}
                    </p>
                )}
            </div>

            {/* Health Checks */}
            <div className="divide-y divide-slate-100">
                {checks.map((check) => (
                    <div
                        key={check.id}
                        className={`p-3 transition-colors ${getStatusBg(check.status)}`}
                    >
                        <div className="flex items-start gap-3">
                            {/* Status Icon */}
                            <div className="mt-0.5">
                                {getStatusIcon(check.status)}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-slate-500 ${getStatusText(check.status)}`}>
                                        {getCheckIcon(check.id)}
                                    </span>
                                    <h4 className={`font-medium text-sm ${getStatusText(check.status)}`}>
                                        {check.title}
                                    </h4>
                                </div>

                                <p className={`text-xs ${getStatusText(check.status)}`}>
                                    {check.message}
                                </p>

                                {/* Suggestion */}
                                {check.suggestion && check.status !== 'ok' && (
                                    <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-600">
                                        <Lightbulb size={12} className="mt-0.5 text-amber-500 shrink-0" />
                                        <span>{check.suggestion}</span>
                                    </div>
                                )}

                                {/* Action Button */}
                                {check.onAction && check.actionLabel && (
                                    <button
                                        onClick={check.onAction}
                                        className="mt-2 text-xs font-medium px-3 py-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                        {check.actionLabel}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer Summary */}
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200">
                <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" /> OK
                    </span>
                    <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-amber-500" /> Alerta
                    </span>
                    <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500" /> Crítico
                    </span>
                </div>
            </div>
        </div>
    );
};

/**
 * Helper function to generate health checks from mix analysis data
 */
export function generateHealthChecks(
    taktTime: number,
    cycleTime: number,
    hasDeficit: boolean,
    deficitMachines: Array<{ name: string; required: number; available: number }>,
    hasCuringViolation: boolean = false,
    curingMessage?: string
): HealthCheck[] {
    const checks: HealthCheck[] = [];

    // 1. Demand Check (Takt vs Cycle Time)
    const demandOk = cycleTime <= taktTime;
    checks.push({
        id: 'demand',
        status: demandOk ? 'ok' : 'critical',
        title: 'Demanda (Takt)',
        message: demandOk
            ? `Ciclo ${cycleTime.toFixed(1)}s ≤ Takt ${taktTime.toFixed(1)}s. Cumples con el cliente.`
            : `Ciclo ${cycleTime.toFixed(1)}s > Takt ${taktTime.toFixed(1)}s. No llegas a tiempo.`,
        suggestion: demandOk ? undefined : 'Divide la estación crítica o agrega un operario.',
    });

    // 2. Machines Check
    checks.push({
        id: 'machines',
        status: hasDeficit ? 'critical' : 'ok',
        title: 'Recursos Técnicos',
        message: hasDeficit
            ? `Faltan máquinas: ${deficitMachines.map(m => `${m.name} (${m.required}/${m.available})`).join(', ')}`
            : 'Inventario de máquinas suficiente.',
        suggestion: hasDeficit ? 'Adquirir equipo o redistribuir carga.' : undefined,
    });

    // 3. Chemistry Check (Curing)
    checks.push({
        id: 'chemistry',
        status: hasCuringViolation ? 'warning' : 'ok',
        title: 'Restricción Química',
        message: hasCuringViolation
            ? (curingMessage || 'El tiempo de curado limita la velocidad.')
            : 'Sin restricciones de proceso químico.',
        suggestion: hasCuringViolation
            ? 'Agregar moldes, no operarios. El curado no se acelera con más gente.'
            : undefined,
    });

    return checks;
}
