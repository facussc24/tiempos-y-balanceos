import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface AnalysisReasoningProps {
    isViable: boolean;
    sectors: Array<{
        name: string;
        required: number;
        available: number;
        saturation: number;
    }>;
    taktTime: number;
}

export const AnalysisReasoning: React.FC<AnalysisReasoningProps> = ({ isViable, sectors }) => {
    // Determine the primary reason for the status
    const criticalSectors = sectors.filter(s => s.available < s.required);
    const tightSectors = sectors.filter(s => s.saturation > 95 && s.available >= s.required);
    const lowSectors = sectors.filter(s => s.saturation < 60);

    return (
        <div className={`rounded-xl p-5 border ${isViable ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <h3 className={`flex items-center gap-2 font-bold mb-3 ${isViable ? 'text-emerald-800' : 'text-red-800'}`}>
                {isViable ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                {isViable ? 'Diagnóstico: Balanceo Viable' : 'Diagnóstico: No Viable'}
            </h3>

            <div className="space-y-3 text-sm">
                {!isViable && criticalSectors.length > 0 && (
                    <div className="bg-white/60 p-3 rounded-lg">
                        <p className="font-semibold text-red-700 mb-2">🔴 Causas de No Viabilidad:</p>
                        <ul className="list-disc pl-5 space-y-2 text-red-600">
                            {criticalSectors.map((s, i) => {
                                // Dynamic NLG Logic
                                const isMachineDeficit = s.available < s.required;
                                const isTaktViolation = (s.saturation > 100);

                                return (
                                    <li key={i}>
                                        {isTaktViolation ? (
                                            <>
                                                <strong>Restricción de Takt en {s.name}:</strong> La carga de trabajo ({s.saturation.toFixed(0)}%) supera físicamente el tiempo disponible.
                                                <em> Solución: Dividir tareas o agregar máquinas paralelas.</em>
                                            </>
                                        ) : isMachineDeficit ? (
                                            <>
                                                <strong>Déficit de Activos en {s.name}:</strong> Se requieren <strong>{s.required}</strong> máquinas/puestos, pero solo hay <strong>{s.available}</strong> configuradas en planta.
                                            </>
                                        ) : (
                                            <>Problema de capacidad en {s.name}.</>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                {isViable && tightSectors.length > 0 && (
                    <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-100">
                        <p className="font-semibold text-amber-700">⚠️ Riesgo de Cuello de Botella:</p>
                        <ul className="list-disc pl-5 mt-1 space-y-1 text-amber-700">
                            {tightSectors.map((s, i) => (
                                <li key={i}>
                                    <strong>{s.name}</strong> está al <strong>{s.saturation.toFixed(0)}%</strong> de su capacidad. Cualquier variabilidad generará paradas.
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {lowSectors.length > 0 && (
                    <div className="bg-blue-50/60 p-3 rounded-lg border border-blue-100">
                        <p className="font-semibold text-blue-700">💡 Oportunidad de Optimización:</p>
                        <ul className="list-disc pl-5 mt-1 space-y-1 text-blue-700">
                            {lowSectors.map((s, i) => (
                                <li key={i}>
                                    <strong>{s.name}</strong> tiene baja carga ({s.saturation.toFixed(0)}%). Considerar mover personal o asignar tareas de Mizusumashi.
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {isViable && criticalSectors.length === 0 && tightSectors.length === 0 && (
                    <p className="text-emerald-700">
                        El balanceo cubre la demanda sin exceder la capacidad instalada en ningún sector. El flujo debería ser estable.
                    </p>
                )}
            </div>
        </div>
    );
};
