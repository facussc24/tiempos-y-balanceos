import React from 'react';
import { HelpCircle, Droplets } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, LabelList, Cell } from 'recharts';
import { Card } from '../../components/ui/Card';
import { formatNumber } from '../../utils';
import { ProjectData } from '../../types';
import { EducationalTooltip } from '../../components/ui/EducationalTooltip';
import { CuringBar } from '../../components/charts/CuringBar';

interface Props {
    saturationData: any[];
    nominalSeconds: number;
    effectiveSeconds: number;
    yAxisDomainMax: number;
    data: ProjectData;
}

// Custom Tooltip for better visibility and formatting
const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-xs z-50">
                <p className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-1">{label}</p>
                <div className="space-y-1.5">
                    {payload.map((entry: any, index: number) => {
                        let labelText = entry.name;
                        let valueText = `${formatNumber(entry.value)}s`;
                        let color = entry.color;
                        let extraInfo = null;

                        // Custom Logic for Display Names and Colors
                        if (entry.dataKey === 'withinLimit') {
                            const replicas = entry.payload.replicas;
                            const raw = entry.payload.rawEffective;
                            const sector = entry.payload.sectorName;

                            labelText = `Ciclo [${sector}]`;
                            if (replicas > 1) {
                                valueText = `${formatNumber(entry.value)}s`;
                                extraInfo = `(Real: ${formatNumber(raw)}s / ${replicas} op)`;
                            }
                        } else if (entry.dataKey === 'idle') {
                            labelText = 'Capacidad Disponible';
                            // FORCE DARK COLOR for visibility (Fixes "white text" issue)
                            color = '#64748b'; // slate-500
                        } else if (entry.dataKey === 'overload') {
                            labelText = 'Sobrecarga';
                        } else if (entry.dataKey === 'absorbed') {
                            labelText = 'Absorbido (Concurrente)';
                        }

                        // Filter out zero values unless it's the main cycle bar
                        if (entry.value <= 0.01 && entry.dataKey !== 'withinLimit') return null;

                        return (
                            <div key={index} className="flex flex-col">
                                <div className="flex items-center gap-2 justify-between min-w-[180px]">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: color }}></div>
                                        <span className="text-slate-600 font-medium">{labelText}:</span>
                                    </div>
                                    <span className="font-bold text-slate-800">{valueText}</span>
                                </div>
                                {extraInfo && (
                                    <div className="pl-4 text-[10px] text-slate-400 font-mono text-right">
                                        {extraInfo}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
    return null;
};

export const BalancingChart: React.FC<Props> = ({ saturationData, nominalSeconds, effectiveSeconds, yAxisDomainMax, data }) => {
    return (
        <Card
            title="Saturación y Balanceo"
            className="border-indigo-100 shadow-md"
            actions={
                <div className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded-full border border-slate-100">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Takt Time</span>
                    <EducationalTooltip termKey="TAKT_TIME" iconSize={14} />
                    <span className="text-slate-300">|</span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Saturación</span>
                    <EducationalTooltip termKey="SATURATION" iconSize={14} />
                </div>
            }
        >
            {/* SECTOR LEGEND */}
            <div className="flex gap-4 mb-4 px-4 overflow-x-auto pb-2">
                {data.sectors?.map(s => (
                    <div key={s.id} className="flex items-center gap-2 text-xs whitespace-nowrap">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }}></div>
                        <span className="text-slate-600 font-medium">{s.name}</span>
                    </div>
                ))}
            </div>

            <div className="h-64 w-full" style={{ minHeight: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={saturationData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis
                            width={50}
                            label={{ value: 'Tiempo Ciclo (seg)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#64748b', fontSize: 12 } }}
                            domain={[0, yAxisDomainMax]}
                            tickFormatter={(val) => Math.round(val).toString()}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                        />

                        <Tooltip content={<CustomChartTooltip />} />
                        <Legend verticalAlign="top" height={36} />

                        <ReferenceLine
                            y={nominalSeconds}
                            stroke="#dc2626"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            label={{ value: 'Takt Nominal', position: 'insideTopRight', fill: '#dc2626', fontSize: 12, fontWeight: 'bold' }}
                        />

                        {/* GLOBAL LIMIT LINE (Only if not using Sector Mode) */}
                        {!data.meta.useSectorOEE && (
                            <ReferenceLine
                                y={effectiveSeconds}
                                stroke="#10b981"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                label={{ value: 'Límite OEE', position: 'insideTopLeft', fill: '#10b981', fontSize: 12, fontWeight: 'bold' }}
                            />
                        )}

                        {/* If using Sector Mode, visualize station limits individually */}
                        {data.meta.useSectorOEE && (
                            <Line type="step" dataKey="limit" stroke="#a855f7" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={false} name="Límite Sector" />
                        )}

                        <Bar dataKey="withinLimit" stackId="a" name="Tiempo Ciclo (Output)" barSize={50}>
                            {saturationData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.barColor} />
                            ))}
                        </Bar>
                        <Bar
                            dataKey="idle"
                            stackId="a"
                            name="Tiempo Ocioso (Desperdicio)"
                            fill="#f1f5f9"
                            stroke="#94a3b8"
                            strokeDasharray="3 3"
                            barSize={50}
                        >
                            <LabelList
                                dataKey="idle"
                                position="center"
                                formatter={(val: number) => val > 0.5 ? `${formatNumber(val)}s (Libre)` : ''}
                                style={{ fontSize: '10px', fill: '#64748b', fontWeight: 'bold' }}
                            />
                        </Bar>
                        <Bar dataKey="overload" stackId="a" name="Sobrecarga" fill="#ef4444" barSize={50} />
                        <Bar dataKey="absorbed" stackId="a" name="T. Absorbido (Concurrente)" fill="#10b981" fillOpacity={0.2} stroke="#10b981" strokeDasharray="2 2" barSize={50} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* V4.1: Twin Bars - Operator vs Machine Time Visualization */}
            {saturationData.some(d => d.machineTime > 0) && (
                <div className="mt-6 pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-bold text-slate-600 uppercase">Tiempo Operario vs Máquina</span>
                        <div className="flex gap-3 text-[10px] text-slate-500">
                            <span className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-blue-500"></div>
                                Operario
                            </span>
                            <span className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-purple-500"></div>
                                Máquina
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-4 overflow-x-auto py-2">
                        {saturationData.map((st, idx) => {
                            const maxTime = Math.max(st.operatorTime || 0, st.machineTime || 0, nominalSeconds);
                            const opHeight = maxTime > 0 ? ((st.operatorTime || 0) / maxTime) * 100 : 0;
                            const machHeight = maxTime > 0 ? ((st.machineTime || 0) / maxTime) * 100 : 0;
                            const taktHeight = maxTime > 0 ? (nominalSeconds / maxTime) * 100 : 0;

                            // Determine constraint: who is the bottleneck?
                            const isOperatorConstrained = (st.operatorTime || 0) > (st.machineTime || 0);

                            return (
                                <div key={idx} className="flex flex-col items-center min-w-[60px]">
                                    {/* Bars container */}
                                    <div className="relative h-20 flex gap-1 items-end">
                                        {/* Takt line */}
                                        <div
                                            className="absolute w-full border-t-2 border-red-500 border-dashed"
                                            style={{ bottom: `${taktHeight}%` }}
                                        ></div>
                                        {/* Operator bar */}
                                        <div
                                            className={`w-5 rounded-t transition-all ${isOperatorConstrained ? 'bg-blue-600' : 'bg-blue-400'}`}
                                            style={{ height: `${opHeight}%` }}
                                            title={`Operario: ${formatNumber(st.operatorTime || 0)}s`}
                                        ></div>
                                        {/* Machine bar */}
                                        <div
                                            className={`w-5 rounded-t transition-all ${!isOperatorConstrained && (st.machineTime || 0) > 0 ? 'bg-purple-600' : 'bg-purple-400'}`}
                                            style={{ height: `${machHeight}%` }}
                                            title={`Máquina: ${formatNumber(st.machineTime || 0)}s`}
                                        ></div>
                                    </div>
                                    {/* Labels */}
                                    <span className="text-[9px] text-slate-500 mt-1">{st.name}</span>
                                    <div className="flex gap-1 text-[8px] text-slate-400">
                                        <span className="text-blue-600">{formatNumber(st.operatorTime || 0)}</span>
                                        <span>/</span>
                                        <span className="text-purple-600">{formatNumber(st.machineTime || 0)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 italic">
                        💡 Si Azul &gt; Violeta: Operario es cuello de botella. Si Violeta &gt; Azul: Máquina define el ciclo (operario espera).
                    </p>
                </div>
            )}

            {/* Phase 3: Curing Time Visualization for Injection Stations */}
            {saturationData.some(d => d.curingTime > 0) && (
                <div className="mt-6 pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-2 mb-3">
                        <Droplets size={16} className="text-slate-500" />
                        <span className="text-xs font-bold text-slate-600 uppercase">Estaciones de Inyección - Visualización de Curado</span>
                        <div className="flex gap-3 ml-4 text-[10px] text-slate-500">
                            <span className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-slate-300"></div>
                                Curado
                            </span>
                            <span className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-emerald-400"></div>
                                Ops Internas
                            </span>
                            <span className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-amber-400"></div>
                                Ops Externas
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-6 overflow-x-auto py-2">
                        {saturationData.filter(st => st.curingTime > 0).map((st, idx) => (
                            <div key={idx} className="flex flex-col items-center min-w-[100px]">
                                <CuringBar
                                    curingTime={st.curingTime}
                                    injectionTime={st.injectionTime || 0}
                                    operations={st.curingOperations || []}
                                    taktTime={nominalSeconds}
                                    height={100}
                                    compact={false}
                                />
                                <span className="text-[10px] text-slate-600 font-medium mt-1">{st.name}</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 italic">
                        💡 Las operaciones internas (verde) se realizan durante el curado. Si exceden el tiempo de curado, aparece alerta.
                    </p>
                </div>
            )}
        </Card>
    );
};
