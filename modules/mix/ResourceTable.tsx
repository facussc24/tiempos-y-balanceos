/**
 * ResourceTable - V4.7 Phase 27 Enhanced
 * 
 * Table format with machine count and formula explanations:
 * | Recurso | Máq. | TW | Takt | Cálculo | Puestos | Sat. |
 */
import React from 'react';
import { Users, Calculator } from 'lucide-react';

interface ResourceRow {
    name: string;
    weightedTime: number;  // TW in seconds
    taktTime: number;
    theoreticalCalc: number;  // TW / Takt
    required: number;  // Ceiling of theoretical (machines/puestos)
    saturation: number;  // percentage
    available?: number; // Available machines (optional)
}

interface ResourceTableProps {
    rows: ResourceRow[];
    totalPersonas: number;
    avgSaturation: number;
    taktTime?: number; // For formula explanation
    totalDemand?: number; // For formula explanation
}

export const ResourceTable: React.FC<ResourceTableProps> = ({
    rows,
    avgSaturation,
    taktTime,
    totalDemand
}) => {
    // Status color logic (semaforo)
    const getStatusColor = (sat: number) => {
        if (sat > 95) return { bg: 'bg-red-50', text: 'text-red-600', icon: '🔴' };
        if (sat > 85) return { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: '🟢' };
        return { bg: 'bg-amber-50', text: 'text-amber-600', icon: '🟡' };
    };

    const totalWeightedTime = rows.reduce((sum, r) => sum + (r.weightedTime || 0), 0);
    const totalMaquinas = rows.reduce((sum, r) => sum + (r.required || 0), 0);

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-in fade-in duration-500">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                    <Users size={18} className="text-blue-600" />
                    <h3 className="font-semibold text-slate-700">Tabla de Recursos</h3>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Recurso</th>
                            <th className="text-center px-2 py-2 font-semibold text-slate-600 bg-blue-50">Máq.</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-600">TW (s)</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-600">Takt (s)</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-600">Cálculo</th>
                            <th className="text-center px-3 py-2 font-semibold text-slate-600">Sat.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => {
                            const status = getStatusColor(row.saturation || 0);
                            const hasDeficit = row.available !== undefined && row.required > row.available;
                            return (
                                <tr
                                    key={idx}
                                    className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${hasDeficit ? 'bg-red-50' : ''}`}
                                >
                                    <td className="px-3 py-2 font-medium text-slate-700">
                                        {idx + 1}. {row.name}
                                    </td>
                                    <td className="px-2 py-2 text-center bg-blue-50/50">
                                        <span className={`font-bold ${hasDeficit ? 'text-red-600' : 'text-blue-600'}`}>
                                            {row.required || 0}
                                        </span>
                                        {row.available !== undefined && (
                                            <span className="text-[10px] text-slate-400 block">
                                                /{row.available}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-600 font-mono text-xs">
                                        {(row.weightedTime || 0).toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-600 font-mono text-xs">
                                        {(row.taktTime || 0).toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-600 font-mono text-xs">
                                        {(row.theoreticalCalc || 0).toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <span className={`font-medium text-xs ${status.text}`}>
                                                {(row.saturation || 0).toFixed(0)}%
                                            </span>
                                            <span className="text-xs">{status.icon}</span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot className="bg-slate-100 font-semibold">
                        <tr>
                            <td className="px-3 py-2 text-slate-700">TOTAL</td>
                            <td className="px-2 py-2 text-center bg-blue-100">
                                <span className="font-bold text-blue-700">{totalMaquinas}</span>
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600 font-mono text-xs">
                                {totalWeightedTime.toFixed(1)}
                            </td>
                            <td className="px-3 py-2"></td>
                            <td className="px-3 py-2"></td>
                            <td className="px-3 py-2 text-center">
                                <span className={`font-bold text-xs ${avgSaturation > 85 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {(avgSaturation || 0).toFixed(0)}%
                                </span>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Formula Explanation */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
                <div className="flex items-start gap-2">
                    <Calculator size={14} className="text-slate-400 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                        <p><strong>Fórmulas:</strong></p>
                        <p>• <strong>Takt</strong> = Tiempo Disponible / Demanda
                            {taktTime && totalDemand && (
                                <span className="text-slate-400 ml-1">
                                    = {(taktTime * totalDemand).toFixed(0)}s / {totalDemand}pz = {taktTime.toFixed(2)}s
                                </span>
                            )}
                        </p>
                        <p>• <strong>Cálculo</strong> = TW / Takt (teórico sin redondear)</p>
                        <p>• <strong>Máq.</strong> = ⌈Cálculo⌉ (redondeado hacia arriba)</p>
                        <p>• <strong>TW</strong> = Σ(T_modelo × %mix) (tiempo ponderado por demanda)</p>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 text-xs text-slate-500 flex gap-4 justify-center">
                <span>🟡 &lt;85%: Subutilizado</span>
                <span>🟢 85-95%: Óptimo</span>
                <span>🔴 &gt;95%: Riesgo</span>
            </div>
        </div>
    );
};
