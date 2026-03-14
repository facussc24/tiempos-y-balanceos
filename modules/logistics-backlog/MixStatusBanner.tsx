/**
 * MixStatusBanner - V4.8 Phase 27 (UX Polish)
 * 
 * Banner showing overall line status at a glance:
 * ✓ Viable | ⚠️ Tight | ✗ Not Viable
 * + User-friendly tooltips explaining metrics
 */
import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

interface MixStatusBannerProps {
    isViable: boolean;
    isTight: boolean;  // Saturación > 95%
    personas: number;
    taktTime: number;
    saturacion: number;
}

export const MixStatusBanner: React.FC<MixStatusBannerProps> = ({
    isViable,
    isTight,
    personas,
    taktTime: rawTaktTime,
    saturacion: rawSaturacion
}) => {
    // FIX: Guard against NaN/Infinity propagating to .toFixed() calls
    const taktTime = Number.isFinite(rawTaktTime) ? rawTaktTime : 0;
    const saturacion = Number.isFinite(rawSaturacion) ? rawSaturacion : 0;
    // Determine status
    const status = !isViable ? 'error' : isTight ? 'warning' : 'success';

    const statusConfig = {
        success: {
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            text: 'text-emerald-700',
            icon: <CheckCircle size={20} />,
            label: 'Línea Viable'
        },
        warning: {
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            text: 'text-amber-700',
            icon: <AlertTriangle size={20} />,
            label: 'Línea Ajustada'
        },
        error: {
            bg: 'bg-red-50',
            border: 'border-red-200',
            text: 'text-red-700',
            icon: <XCircle size={20} />,
            label: 'No Viable'
        }
    };

    const config = statusConfig[status];

    return (
        <div className={`${config.bg} ${config.border} border rounded-xl p-4 animate-in fade-in duration-500`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className={config.text}>{config.icon}</span>
                    <span className={`font-semibold ${config.text}`}>{config.label}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-600">
                    <span><strong>{personas}</strong> Personas</span>
                    <span className="text-slate-300">•</span>

                    {/* V4.8: Takt with tooltip */}
                    <span
                        className="group relative cursor-help flex items-center gap-1"
                        title="Tu cliente compra una pieza cada X segundos"
                    >
                        Takt: <strong>{taktTime.toFixed(1)}s</strong>
                        <Info size={12} className="text-slate-400 group-hover:text-blue-500" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
                            🎯 Tu cliente compra 1 pieza cada <strong>{taktTime.toFixed(1)}s</strong>
                        </span>
                    </span>

                    <span className="text-slate-300">•</span>

                    {/* V4.8: Carga with tooltip */}
                    <span
                        className="group relative cursor-help flex items-center gap-1"
                        title="Porcentaje de uso de la capacidad disponible"
                    >
                        Carga: <strong>{saturacion.toFixed(0)}%</strong>
                        <Info size={12} className="text-slate-400 group-hover:text-blue-500" />
                        <span className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
                            ⚡ Utilizando el <strong>{saturacion.toFixed(0)}%</strong> de tu capacidad
                        </span>
                    </span>
                </div>
            </div>
        </div>
    );
};

