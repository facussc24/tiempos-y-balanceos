/**
 * Lean Dashboard - Traffic Light Summary
 * Phase 4.5: Usability and Reporting
 * 
 * Shows 3 traffic light indicators for quick system health overview:
 * 1. Flujo (VSM) - Value-added percentage
 * 2. Inventario (Kanban) - Stock dimensioning status
 * 3. Capacidad (Heijunka) - Production leveling feasibility
 */

import React from 'react';
import {
    Activity,
    Package,
    Grid3X3,
    CheckCircle,
    AlertTriangle,
    XCircle,
    X,
    BarChart3,
    Gauge
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface DashboardMetrics {
    /** VSM Value-Added percentage (0-100) */
    valueAddedPercent: number;
    /** Whether Kanban has been calculated */
    kanbanCalculated: boolean;
    /** Kanban stock coverage ratio (actual / ideal) */
    kanbanCoverageRatio: number;
    /** Whether Heijunka has been calculated */
    heijunkaCalculated: boolean;
    /** Heijunka feasibility (all products fit in pitch) */
    heijunkaFeasible: boolean;
    /** Pitch vs Route time ratio (routeTime / pitch) - lower is better */
    routeTimeRatio?: number;
}

interface TrafficLightStatus {
    color: 'green' | 'yellow' | 'red' | 'gray';
    label: string;
    message: string;
}

interface LeanDashboardProps {
    metrics: DashboardMetrics;
    isModal?: boolean;
    onClose?: () => void;
}

// ============================================================================
// STATUS CALCULATION FUNCTIONS
// ============================================================================

function getVSMStatus(valueAddedPercent: number): TrafficLightStatus {
    if (valueAddedPercent >= 25) {
        return {
            color: 'green',
            label: 'Eficiente',
            message: `${valueAddedPercent.toFixed(0)}% de valor agregado - Flujo optimizado`
        };
    } else if (valueAddedPercent >= 10) {
        return {
            color: 'yellow',
            label: 'Mejorable',
            message: `${valueAddedPercent.toFixed(0)}% de valor agregado - Oportunidades de mejora`
        };
    } else if (valueAddedPercent > 0) {
        return {
            color: 'red',
            label: 'Crítico',
            message: `${valueAddedPercent.toFixed(0)}% de valor agregado - Alto desperdicio`
        };
    } else {
        return {
            color: 'gray',
            label: 'Sin datos',
            message: 'Generar VSM para ver métricas de flujo'
        };
    }
}

function getKanbanStatus(calculated: boolean, coverageRatio: number): TrafficLightStatus {
    if (!calculated) {
        return {
            color: 'gray',
            label: 'Sin calcular',
            message: 'Configurar Kanban para dimensionar inventarios'
        };
    }

    if (coverageRatio <= 1) {
        return {
            color: 'green',
            label: 'Óptimo',
            message: 'Inventario dimensionado correctamente'
        };
    } else if (coverageRatio <= 2) {
        return {
            color: 'yellow',
            label: 'Exceso leve',
            message: `Inventario ${((coverageRatio - 1) * 100).toFixed(0)}% sobre el ideal`
        };
    } else {
        return {
            color: 'red',
            label: 'Exceso crítico',
            message: `Inventario ${((coverageRatio - 1) * 100).toFixed(0)}% sobre el ideal - Reducir stock`
        };
    }
}

function getHeijunkaStatus(
    calculated: boolean,
    feasible: boolean,
    routeTimeRatio?: number
): TrafficLightStatus {
    if (!calculated) {
        return {
            color: 'gray',
            label: 'Sin calcular',
            message: 'Abrir Heijunka Box para nivelar producción'
        };
    }

    if (!feasible) {
        return {
            color: 'red',
            label: 'Cuello de botella',
            message: 'Ciclos exceden el Pitch - Ajustar capacidad'
        };
    }

    if (routeTimeRatio !== undefined && routeTimeRatio > 1) {
        return {
            color: 'red',
            label: 'Ruta insostenible',
            message: 'Mizusumashi no alcanza a completar la ruta'
        };
    }

    if (routeTimeRatio !== undefined && routeTimeRatio > 0.9) {
        return {
            color: 'yellow',
            label: 'Ajustado',
            message: 'Ruta logística muy cercana al pitch'
        };
    }

    return {
        color: 'green',
        label: 'Nivelado',
        message: 'Producción correctamente balanceada'
    };
}

// ============================================================================
// TRAFFIC LIGHT COMPONENT
// ============================================================================

const TrafficLight: React.FC<{
    title: string;
    icon: React.ReactNode;
    status: TrafficLightStatus;
}> = ({ title, icon, status }) => {
    const colorClasses = {
        green: 'bg-green-500 shadow-green-300',
        yellow: 'bg-amber-400 shadow-amber-200',
        red: 'bg-red-500 shadow-red-300',
        gray: 'bg-gray-400 shadow-gray-200'
    };

    const bgClasses = {
        green: 'bg-green-50 border-green-200',
        yellow: 'bg-amber-50 border-amber-200',
        red: 'bg-red-50 border-red-200',
        gray: 'bg-gray-50 border-gray-200'
    };

    const iconClasses = {
        green: 'text-green-600',
        yellow: 'text-amber-600',
        red: 'text-red-600',
        gray: 'text-gray-500'
    };

    return (
        <div className={`rounded-xl border-2 p-5 transition-all hover:shadow-lg ${bgClasses[status.color]}`}>
            <div className="flex items-start gap-4">
                {/* Traffic Light Indicator */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${colorClasses[status.color]}`}>
                    {status.color === 'green' && <CheckCircle className="w-6 h-6 text-white" />}
                    {status.color === 'yellow' && <AlertTriangle className="w-6 h-6 text-white" />}
                    {status.color === 'red' && <XCircle className="w-6 h-6 text-white" />}
                    {status.color === 'gray' && <Gauge className="w-6 h-6 text-white" />}
                </div>

                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`${iconClasses[status.color]}`}>{icon}</span>
                        <h3 className="font-bold text-gray-800">{title}</h3>
                    </div>
                    <div className={`text-lg font-semibold ${iconClasses[status.color]}`}>
                        {status.label}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                        {status.message}
                    </p>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const LeanDashboard: React.FC<LeanDashboardProps> = ({
    metrics,
    isModal = false,
    onClose
}) => {
    const vsmStatus = getVSMStatus(metrics.valueAddedPercent);
    const kanbanStatus = getKanbanStatus(metrics.kanbanCalculated, metrics.kanbanCoverageRatio);
    const heijunkaStatus = getHeijunkaStatus(
        metrics.heijunkaCalculated,
        metrics.heijunkaFeasible,
        metrics.routeTimeRatio
    );

    // Overall system health
    const statusCounts = [vsmStatus, kanbanStatus, heijunkaStatus].reduce(
        (acc, s) => {
            acc[s.color]++;
            return acc;
        },
        { green: 0, yellow: 0, red: 0, gray: 0 }
    );

    const overallHealth = statusCounts.red > 0
        ? 'Requiere atención'
        : statusCounts.yellow > 0
            ? 'Mejorable'
            : statusCounts.green === 3
                ? 'Óptimo'
                : 'Configurar';

    const content = (
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <BarChart3 className="w-7 h-7 text-white" />
                    <div>
                        <h2 className="text-xl font-bold text-white">Panel de Control Lean</h2>
                        <p className="text-slate-300 text-sm">Estado del sistema • {new Date().toLocaleDateString('es-ES')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className={`px-4 py-2 rounded-lg font-semibold text-sm ${overallHealth === 'Óptimo' ? 'bg-green-500 text-white' :
                            overallHealth === 'Mejorable' ? 'bg-amber-400 text-gray-900' :
                                overallHealth === 'Requiere atención' ? 'bg-red-500 text-white' :
                                    'bg-gray-500 text-white'
                        }`}>
                        {overallHealth}
                    </div>
                    {isModal && onClose && (
                        <button
                            onClick={onClose}
                            className="text-white/70 hover:text-white transition-colors"
                        >
                            <X size={24} />
                        </button>
                    )}
                </div>
            </div>

            {/* Traffic Lights Grid */}
            <div className="p-6">
                <div className="grid md:grid-cols-3 gap-4">
                    <TrafficLight
                        title="Flujo (VSM)"
                        icon={<Activity size={20} />}
                        status={vsmStatus}
                    />
                    <TrafficLight
                        title="Inventario (Kanban)"
                        icon={<Package size={20} />}
                        status={kanbanStatus}
                    />
                    <TrafficLight
                        title="Capacidad (Heijunka)"
                        icon={<Grid3X3 size={20} />}
                        status={heijunkaStatus}
                    />
                </div>

                {/* Legend */}
                <div className="mt-6 pt-4 border-t flex flex-wrap gap-6 justify-center text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-500" />
                        <span>Óptimo</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-amber-400" />
                        <span>Mejorable</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-red-500" />
                        <span>Requiere atención</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-gray-400" />
                        <span>Sin configurar</span>
                    </div>
                </div>
            </div>
        </div>
    );

    if (isModal) {
        return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                <div className="max-w-4xl w-full animate-in slide-in-from-bottom-4 duration-300">
                    {content}
                </div>
            </div>
        );
    }

    return content;
};

export default LeanDashboard;
