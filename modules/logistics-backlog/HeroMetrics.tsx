/**
 * HeroMetrics - V4.4 Simplified UX
 * 
 * The 3 key numbers displayed prominently
 */
import React from 'react';
import { Users, Clock, Activity } from 'lucide-react';

interface HeroMetricsProps {
    personas: number;
    taktTime: number;
    saturacion: number;
}

export const HeroMetrics: React.FC<HeroMetricsProps> = ({
    personas,
    taktTime,
    saturacion
}) => {
    // Color for saturación
    const getSaturacionColor = () => {
        if (saturacion > 95) return 'text-red-600';
        if (saturacion > 85) return 'text-emerald-600';
        return 'text-amber-600';
    };

    return (
        <div className="grid grid-cols-3 gap-4 animate-in fade-in duration-500 delay-100">
            {/* Personas */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-center mb-2">
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <Users size={24} className="text-blue-600" />
                    </div>
                </div>
                <p className="text-4xl font-bold text-slate-800">{personas}</p>
                <p className="text-sm text-slate-500 mt-1">Personas necesarias</p>
            </div>

            {/* Takt */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-center mb-2">
                    <div className="p-2 bg-slate-50 rounded-lg">
                        <Clock size={24} className="text-slate-600" />
                    </div>
                </div>
                <p className="text-4xl font-bold text-slate-800">{taktTime.toFixed(1)}s</p>
                <p className="text-sm text-slate-500 mt-1">Ritmo por pieza</p>
            </div>

            {/* Saturación */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-center mb-2">
                    <div className="p-2 bg-slate-50 rounded-lg">
                        <Activity size={24} className="text-slate-600" />
                    </div>
                </div>
                <p className={`text-4xl font-bold ${getSaturacionColor()}`}>{saturacion.toFixed(0)}%</p>
                <p className="text-sm text-slate-500 mt-1">Carga promedio</p>
            </div>
        </div>
    );
};
