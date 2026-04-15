import React from 'react';
import { Card } from '../../components/ui/Card';
import { Tooltip } from '../../components/ui/Tooltip';
import { formatNumber } from '../../utils';
import { AlertOctagon, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Props {
    nominalSeconds: number;
    effectiveSeconds: number;
    activeOEE: number;
    efficiency: number;
    effStatus: 'good' | 'warn' | 'crit' | 'error';
}

// FIX-4: Get contextual status message
const getStatusMessage = (effStatus: string, efficiency: number): string => {
    if (effStatus === 'error') {
        return '¡CRÍTICO! Imposible cumplir demanda. Agregar recursos.';
    }
    if (effStatus === 'crit') {
        // Low efficiency means idle capacity
        if (efficiency < 70) {
            return 'Capacidad ociosa. Considerar reducir recursos o aumentar demanda.';
        }
        return 'Revisar distribución de carga entre estaciones.';
    }
    if (effStatus === 'warn') {
        return 'Atencion: la carga esta cerca del limite. Monitorear de cerca.';
    }
    return 'Estado operativo normal.';
};

export const KPIView: React.FC<Props> = ({
    nominalSeconds,
    effectiveSeconds,
    activeOEE,
    efficiency,
    effStatus
}) => {
    return (
        <Card title="KPIs de Planta" className="lg:col-span-1">
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-industrial-50 rounded-sm border border-industrial-200">
                    <div className="text-slate-500 text-xs flex items-center gap-1">
                        Ritmo Cliente (Takt Time Objetivo)
                        <Tooltip content="El ritmo (en segundos) que la línea debe seguir exactamente para cumplir la demanda del cliente." />
                    </div>
                    <p className="text-2xl font-semibold text-accent tabular-nums">{formatNumber(nominalSeconds)}s</p>
                </div>
                <div className="p-3 bg-industrial-50 rounded-sm border border-industrial-200">
                    <div className="text-slate-500 text-xs flex items-center gap-1">
                        Ritmo Objetivo
                        <Tooltip content="Es el Takt Time ajustado por el % de OEE. Meta real que la operación debe alcanzar para compensar pérdidas por paradas." />
                    </div>
                    <p className="text-2xl font-semibold text-accent tabular-nums">{formatNumber(effectiveSeconds)}s</p>
                    <p className="text-xs text-industrial-300">c/ OEE {formatNumber(activeOEE * 100)}%</p>
                </div>
                <div className="p-3 bg-industrial-50 rounded-sm border border-industrial-200">
                    {/* FIX-6: Renamed from "Saturación vs Demanda" */}
                    <div className="text-slate-500 text-xs flex items-center gap-1">
                        Uso de Capacidad
                        <Tooltip content="Mide qué tan aprovechada está la capacidad vs demanda. Bajo = Sobredimensionado (capacidad ociosa). Alto = Riesgo de no cumplir." />
                    </div>
                    <p className={`text-xl font-bold ${effStatus === 'error' ? 'text-red-600' : efficiency < 70 ? 'text-amber-600' : 'text-slate-800'}`}>{formatNumber(efficiency)}%</p>
                </div>
            </div>
            <div className={`mt-4 text-xs p-3 rounded border flex items-center gap-2 ${effStatus === 'error' ? 'bg-status-crit-bg border-status-crit text-status-crit' : effStatus === 'crit' ? 'bg-status-warn-bg border-status-warn text-status-warn' : effStatus === 'warn' ? 'bg-status-warn-bg border-status-warn text-status-warn' : 'bg-status-ok-bg border-status-ok text-status-ok'}`}>
                {effStatus === 'error' && <AlertOctagon size={16} />}
                {effStatus === 'crit' && <AlertTriangle size={16} />}
                {effStatus === 'warn' && <AlertTriangle size={16} />}
                {effStatus === 'good' && <CheckCircle2 size={16} />}
                <span>
                    {getStatusMessage(effStatus, efficiency)}
                </span>
            </div>
        </Card>
    );
};
