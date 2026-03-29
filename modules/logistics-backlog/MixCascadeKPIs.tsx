/**
 * MixCascadeKPIs - Decisión en Cascada
 * 
 * Muestra los 3 KPIs principales en orden de prioridad:
 * 1. Viabilidad (¿Es posible?)
 * 2. Recursos (¿Cuánto necesito?)
 * 3. Secuencia (¿Cómo ejecuto?) → Link a Heijunka
 * 
 * Si Viabilidad falla, los otros 2 se deshabilitan visualmente.
 */
import React from 'react';
import {
    CheckCircle,
    XCircle,
    Users,
    ArrowRight,
    Grid3X3,
    AlertTriangle
} from 'lucide-react';

interface MixCascadeKPIsProps {
    isViable: boolean;
    viabilityReason?: string;
    totalHeadcount: number;
    machineDeficit: boolean;
    onGoToHeijunka?: () => void;
}

const MixCascadeKPIs: React.FC<MixCascadeKPIsProps> = ({
    isViable,
    viabilityReason,
    totalHeadcount,
    machineDeficit,
    onGoToHeijunka
}) => {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Main KPI Row */}
            <div className="grid grid-cols-3 divide-x divide-slate-200">

                {/* 1. VIABILIDAD */}
                <div className={`p-5 text-center ${isViable ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                        {isViable ? (
                            <CheckCircle size={28} className="text-emerald-600" />
                        ) : (
                            <XCircle size={28} className="text-red-600" />
                        )}
                    </div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                        Viabilidad
                    </p>
                    <p className={`text-lg font-bold ${isViable ? 'text-emerald-700' : 'text-red-700'}`}>
                        {isViable ? 'VIABLE' : 'NO VIABLE'}
                    </p>
                    {!isViable && viabilityReason && (
                        <p className="text-xs text-red-600 mt-1">{viabilityReason}</p>
                    )}
                </div>

                {/* 2. RECURSOS */}
                <div className={`p-5 text-center transition-opacity ${!isViable ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Users size={28} className={machineDeficit ? 'text-amber-500' : 'text-blue-600'} />
                    </div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                        Recursos
                    </p>
                    <p className="text-2xl font-bold text-slate-800">
                        {totalHeadcount}
                    </p>
                    <p className="text-xs text-slate-500">personas</p>
                    {machineDeficit && isViable && (
                        <div className="flex items-center justify-center gap-1 mt-1 text-amber-600 text-xs">
                            <AlertTriangle size={12} />
                            <span>Déficit máquinas</span>
                        </div>
                    )}
                </div>

                {/* 3. SECUENCIA */}
                <div className={`p-5 text-center transition-opacity ${!isViable ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Grid3X3 size={28} className="text-purple-600" />
                    </div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                        Secuencia
                    </p>
                    {onGoToHeijunka && isViable ? (
                        <button
                            onClick={onGoToHeijunka}
                            className="inline-flex items-center gap-1 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                        >
                            Ver Heijunka
                            <ArrowRight size={14} />
                        </button>
                    ) : (
                        <p className="text-sm text-slate-400">
                            {isViable ? 'Disponible' : 'Resolver viabilidad'}
                        </p>
                    )}
                </div>
            </div>

            {/* Cascade Arrow Indicators (visual connection) */}
            <div className="flex items-center justify-center gap-16 py-2 bg-slate-50 text-slate-300">
                <ArrowRight size={16} />
                <ArrowRight size={16} />
            </div>
        </div>
    );
};
