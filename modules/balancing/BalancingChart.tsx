import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, LabelList, Cell } from 'recharts';
import { Card } from '../../components/ui/Card';
import { formatNumber } from '../../utils';
import { ProjectData } from '../../types';
import { EducationalTooltip } from '../../components/ui/EducationalTooltip';
import { Eye } from 'lucide-react';

interface Props {
    saturationData: any[];
    nominalSeconds: number;
    effectiveSeconds: number;
    yAxisDomainMax: number;
    data: ProjectData;
    onShowCapacityPreview?: () => void;
}

// Custom Tooltip for better visibility and formatting
const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 border border-slate-200 shadow-md rounded-md text-xs z-50">
                <p className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-1">{label}</p>
                <div className="space-y-1.5">
                    {payload.map((entry: any, index: number) => {
                        let labelText = entry.name;
                        let valueText = `${formatNumber(entry.value)}s`;
                        let color = entry.color;
                        let extraInfo: string | null = null;

                        // Custom Logic for Display Names and Colors
                        if (entry.dataKey === 'withinLimit') {
                            const replicas = entry.payload.replicas;
                            const raw = entry.payload.rawEffective;
                            const sector = entry.payload.sectorName;

                            labelText = `Tiempo de Ciclo [${sector}]`;
                            if (replicas > 1) {
                                valueText = `${formatNumber(entry.value)}s`;
                                extraInfo = `(Total: ${formatNumber(raw)}s ÷ ${replicas} ops)`;
                            }
                        } else if (entry.dataKey === 'idle') {
                            labelText = 'Tiempo Disponible';
                            // FORCE DARK COLOR for visibility (Fixes "white text" issue)
                            color = '#64748b'; // slate-500
                        } else if (entry.dataKey === 'overload') {
                            labelText = 'Sobrecarga';
                        } else if (entry.dataKey === 'absorbed') {
                            labelText = 'Tiempo Concurrente';
                        }

                        // Filter out zero values unless it's the main cycle bar
                        if (entry.value <= 0.01 && entry.dataKey !== 'withinLimit') return null;

                        // Add per-sector Takt info when shift override is active
                        if (entry.dataKey === 'withinLimit' && entry.payload.sectorTakt) {
                            extraInfo = (extraInfo ? extraInfo + ' · ' : '') + `Takt Sector: ${formatNumber(entry.payload.sectorTakt)}s`;
                        }

                        return (
                            <div key={index} className="flex flex-col">
                                <div className="flex items-center gap-2 justify-between min-w-[180px]">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: color }}></div>
                                        <span className="text-slate-600 font-medium">{labelText}:</span>
                                    </div>
                                    <span className="font-bold text-slate-800 tabular-nums">{valueText}</span>
                                </div>
                                {extraInfo && (
                                    <div className="pl-4 text-xs text-slate-400 font-mono text-right">
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

export const BalancingChart: React.FC<Props> = ({ saturationData, nominalSeconds, effectiveSeconds, yAxisDomainMax, data, onShowCapacityPreview }) => {
    return (
        <Card
            title="Saturación y Balanceo"
            className="border-industrial-200 shadow-sm"
            actions={
                <div className="flex items-center gap-2">
                    {onShowCapacityPreview && (
                        <button
                            onClick={onShowCapacityPreview}
                            className="flex items-center gap-1.5 bg-accent text-white px-3 py-1.5 rounded-md hover:bg-blue-800 text-xs font-bold transition-all shadow-sm"
                        >
                            <Eye size={14} />
                            Vista Previa Capacidad
                        </button>
                    )}
                    <div className="bg-slate-50 px-2 py-1 rounded-md border border-slate-100 flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-bold uppercase">Takt Time</span>
                        <EducationalTooltip termKey="TAKT_TIME" iconSize={14} />
                        <span className="text-slate-300">|</span>
                        <span className="text-xs text-slate-500 font-bold uppercase">Saturación</span>
                        <EducationalTooltip termKey="SATURATION" iconSize={14} />
                    </div>
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
                            label={{ value: 'Tiempo (seg)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#64748b', fontSize: 12 } }}
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
                            label={{
                                value: saturationData.some(d => d.sectorTakt) ? 'Takt Proyecto' : 'Takt Nominal',
                                position: 'insideTopRight', fill: '#dc2626', fontSize: 12, fontWeight: 'bold'
                            }}
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

                        {/* Show per-station limit line when sector OEE or sector shift overrides are active */}
                        {(data.meta.useSectorOEE || saturationData.some(d => d.sectorTakt)) && (
                            <Line type="step" dataKey="limit" stroke="#a855f7" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={false} name="Límite Sector" />
                        )}

                        <Bar dataKey="withinLimit" stackId="a" name="Tiempo de Ciclo" barSize={50}>
                            {saturationData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.barColor} />
                            ))}
                        </Bar>
                        <Bar
                            dataKey="idle"
                            stackId="a"
                            name="Tiempo Disponible"
                            fill="#f1f5f9"
                            stroke="#94a3b8"
                            strokeDasharray="3 3"
                            barSize={50}
                        >
                            <LabelList
                                dataKey="idle"
                                position="center"
                                formatter={(val: number) => val > 0.5 ? `${formatNumber(val)}s` : ''}
                                style={{ fontSize: '10px', fill: '#64748b', fontWeight: 'bold' }}
                            />
                        </Bar>
                        {saturationData.some(d => d.overload > 0) && (
                            <Bar dataKey="overload" stackId="a" name="Sobrecarga" fill="#ef4444" barSize={50} />
                        )}
                        {saturationData.some(d => d.replicas > 0 && (d.absorbed / d.replicas) > 0.01) && (
                            <Bar dataKey="absorbed" stackId="a" name="Tiempo Concurrente" fill="#10b981" fillOpacity={0.2} stroke="#10b981" strokeDasharray="2 2" barSize={50} />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

        </Card>
    );
};
