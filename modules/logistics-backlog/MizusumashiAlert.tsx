/**
 * MizusumashiAlert - V4.5 Expert-Based Design
 * 
 * Intelligent alert for underutilized workers
 * Suggests reassignment to logistics/support roles
 */
import React from 'react';
import { Lightbulb, ArrowRight } from 'lucide-react';

interface UnderutilizedWorker {
    station: string;
    workerNumber: number;  // e.g., "Operario #2"
    freeTimePercent: number;  // e.g., 92% free time
    suggestion: string;
}

interface MizusumashiAlertProps {
    workers: UnderutilizedWorker[];
}

const MizusumashiAlert: React.FC<MizusumashiAlertProps> = ({
    workers
}) => {
    if (workers.length === 0) return null;

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 animate-in fade-in duration-500">
            <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                    <Lightbulb size={20} className="text-blue-600" />
                </div>
                <div className="flex-1">
                    <h4 className="font-semibold text-blue-800 mb-1">
                        Oportunidad de Optimización
                    </h4>
                    <p className="text-sm text-blue-700 mb-3">
                        Se detectaron operarios con tiempo libre. Considera reasignarlos para mejorar la eficiencia.
                    </p>

                    <div className="space-y-2">
                        {workers.map((w, idx) => (
                            <div key={idx} className="bg-white rounded-lg p-3 border border-blue-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-slate-700">
                                        Operario #{w.workerNumber} de {w.station}
                                    </span>
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                                        {w.freeTimePercent.toFixed(0)}% libre
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <ArrowRight size={14} className="text-blue-500" />
                                    <span>{w.suggestion}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
