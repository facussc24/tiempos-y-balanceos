
import React, { useState } from 'react';
import { ProjectData, Sector, OeeLog } from '../types';
import { Card, Badge } from '../components/ui/Card';
import { Activity, Save, History, AlertOctagon, ArrowRight, Calculator } from 'lucide-react';
import { formatNumber, parseNumberInput } from '../utils';
import { toast } from '../components/ui/Toast';

interface Props {
    data: ProjectData;
    updateData: (data: ProjectData) => void;
}

export const OeeDetail: React.FC<Props> = ({ data, updateData }) => {
    const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);

    // Form State
    const [plannedTime, setPlannedTime] = useState("");
    const [downtime, setDowntime] = useState("");
    const [maxCapacity, setMaxCapacity] = useState(""); // U/h
    const [totalProduced, setTotalProduced] = useState("");
    const [goodProduced, setGoodProduced] = useState("");

    const [analyst, setAnalyst] = useState("");
    const [batchId, setBatchId] = useState("");
    const [comments, setComments] = useState("");

    const sectors = data.sectors || [];
    const activeSector = sectors.find(s => s.id === selectedSectorId);

    // Live Calculations
    const pt = parseNumberInput(plannedTime);
    const dt = parseNumberInput(downtime);
    const maxCap = parseNumberInput(maxCapacity);
    const totalP = parseNumberInput(totalProduced);
    const goodP = parseNumberInput(goodProduced);

    const operatingTime = Math.max(0, pt - dt);

    // Availability = Operating / Planned
    const avail = pt > 0 ? operatingTime / pt : 0;

    // Performance = Total Produced / (Operating Time Hours * Max Capacity U/h)
    const perf = (operatingTime > 0 && maxCap > 0) ? totalP / ((operatingTime / 60) * maxCap) : 0;

    // Quality = Good / Total
    const qual = totalP > 0 ? goodP / totalP : 0;

    const oee = avail * perf * qual;

    const handleSectorSelect = (id: string) => {
        setSelectedSectorId(id);
        const sector = sectors.find(s => s.id === id);
        if (sector && sector.lastLog) {
            // Pre-fill with last known data
            setPlannedTime(sector.lastLog.plannedTime.toString());
            setDowntime(sector.lastLog.downtime.toString());
            setMaxCapacity(sector.lastLog.maxCapacity.toString());
            setTotalProduced(sector.lastLog.totalProduced.toString());
            setGoodProduced(sector.lastLog.goodProduced.toString());
            setAnalyst(sector.lastLog.analyst);
        } else {
            // Reset
            setPlannedTime(""); setDowntime(""); setMaxCapacity("");
            setTotalProduced(""); setGoodProduced(""); setAnalyst("");
            setBatchId(""); setComments("");
        }
    };

    const handleSaveLog = () => {
        if (!activeSector) return;

        const newLog: OeeLog = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
            analyst: analyst || "Ingeniero",
            batchId: batchId || "-",
            comments: comments || "",
            plannedTime: pt,
            downtime: dt,
            maxCapacity: maxCap,
            totalProduced: totalP,
            goodProduced: goodP,
            availability: avail,
            performance: perf,
            quality: qual,
            finalOee: oee
        };

        const updatedSectors = sectors.map(s => {
            if (s.id === activeSector.id) {
                return {
                    ...s,
                    targetOee: oee, // Update active target
                    lastLog: newLog,
                    history: [newLog, ...(s.history || [])]
                };
            }
            return s;
        });

        updateData({ ...data, sectors: updatedSectors });
        toast.success('OEE Actualizado', `Registrado para el sector ${activeSector.name}`);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">

            {/* SIDEBAR: SECTOR LIST */}
            <Card title="Sectores" className="lg:col-span-1 h-full overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {sectors.length === 0 && <p className="text-sm text-slate-400 p-4">No hay sectores definidos. Vaya a "Tareas" para crear uno.</p>}
                    {sectors.map(s => (
                        <button
                            key={s.id}
                            onClick={() => handleSectorSelect(s.id)}
                            className={`w-full text-left p-3 rounded-lg border transition-all flex justify-between items-center ${selectedSectorId === s.id ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-white border-slate-200 hover:border-blue-200'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }}></div>
                                <div>
                                    <div className="font-bold text-slate-700 text-sm">{s.name}</div>
                                    {s.targetOee !== undefined ? (
                                        <span className="text-xs text-emerald-600 font-mono font-bold">OEE: {formatNumber(s.targetOee * 100)}%</span>
                                    ) : (
                                        <span className="text-xs text-slate-400">Sin validar</span>
                                    )}
                                </div>
                            </div>
                            <ArrowRight size={16} className={`text-slate-300 ${selectedSectorId === s.id ? 'text-blue-500' : ''}`} />
                        </button>
                    ))}
                </div>
            </Card>

            {/* MAIN CONTENT */}
            <div className="lg:col-span-3 h-full overflow-y-auto pr-2">
                {!activeSector ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                        <Activity size={48} className="mb-4 opacity-50" />
                        <p>Seleccione un Sector para validar su OEE</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                                <span className="w-4 h-8 rounded-full" style={{ backgroundColor: activeSector.color }}></span>
                                Validación OEE: {activeSector.name}
                            </h2>
                            {activeSector.targetOee !== undefined && (
                                <Badge color="green">OEE Validado: {formatNumber(activeSector.targetOee * 100)}%</Badge>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* INPUT FORM */}
                            <Card title="Datos de Prueba Piloto" className="border-blue-100 shadow-sm">
                                {/* METADATA */}
                                <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-slate-50 rounded border border-slate-200">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Analista</label>
                                        <input className="w-full bg-white border border-slate-300 rounded p-1 text-sm" value={analyst} onChange={e => setAnalyst(e.target.value)} placeholder="Nombre" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Lote / ID</label>
                                        <input className="w-full bg-white border border-slate-300 rounded p-1 text-sm" value={batchId} onChange={e => setBatchId(e.target.value)} placeholder="#Lote" />
                                    </div>
                                </div>

                                {/* FACTORS */}
                                <div className="space-y-6">
                                    {/* Availability */}
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1">Disponibilidad</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs text-slate-500">Tiempo Planificado (min)</label>
                                                <input type="number" className="w-full border border-slate-300 rounded p-2" value={plannedTime} onChange={e => setPlannedTime(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500">Tiempo Inactivo (min)</label>
                                                <input type="number" className="w-full border border-slate-300 rounded p-2" value={downtime} onChange={e => setDowntime(e.target.value)} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Performance */}
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1">Rendimiento</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs text-slate-500">Capacidad Máx (U/h)</label>
                                                <input type="number" className="w-full border border-slate-300 rounded p-2" value={maxCapacity} onChange={e => setMaxCapacity(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500">Producción Real (U)</label>
                                                <input type="number" className="w-full border border-slate-300 rounded p-2" value={totalProduced} onChange={e => setTotalProduced(e.target.value)} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quality */}
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1">Calidad (FTQ)</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <label className="text-xs text-slate-500">Piezas Buenas (OK)</label>
                                                <input type="number" className="w-full border border-slate-300 rounded p-2" value={goodProduced} onChange={e => setGoodProduced(e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Observaciones</label>
                                    <textarea className="w-full border border-slate-300 rounded p-2 text-sm h-20" value={comments} onChange={e => setComments(e.target.value)} placeholder="Condiciones de la prueba..."></textarea>
                                </div>

                                <button onClick={handleSaveLog} className="w-full mt-4 bg-blue-600 text-white py-2 rounded font-bold shadow hover:bg-blue-700 flex items-center justify-center gap-2">
                                    <Save size={18} /> Guardar y Aplicar OEE
                                </button>
                            </Card>

                            {/* RESULTS PANEL */}
                            <div className="space-y-6">
                                <Card className="bg-slate-900 text-white border-none shadow-xl">
                                    <div className="text-center py-4">
                                        <div className="text-sm text-slate-400 uppercase font-bold tracking-wider mb-2">OEE Calculado</div>
                                        <div className={`text-5xl font-black ${oee < 0.65 ? 'text-red-400' : oee < 0.85 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                            {formatNumber(oee * 100)}%
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center text-xs border-t border-white/10 pt-4">
                                        <div>
                                            <div className="text-slate-400">Disponibilidad</div>
                                            <div className="font-bold text-lg">{formatNumber(avail * 100, 1)}%</div>
                                        </div>
                                        <div className="border-l border-white/10">
                                            <div className="text-slate-400">Rendimiento</div>
                                            <div className="font-bold text-lg">{formatNumber(perf * 100, 1)}%</div>
                                        </div>
                                        <div className="border-l border-white/10">
                                            <div className="text-slate-400">Calidad</div>
                                            <div className="font-bold text-lg">{formatNumber(qual * 100, 1)}%</div>
                                        </div>
                                    </div>
                                </Card>

                                {/* HISTORY */}
                                <Card title="Historial de Auditoría" className="overflow-hidden flex flex-col max-h-96">
                                    <div className="overflow-y-auto pr-2 space-y-3 flex-1">
                                        {(!activeSector.history || activeSector.history.length === 0) && (
                                            <p className="text-sm text-slate-400 italic text-center py-4">Sin registros anteriores.</p>
                                        )}
                                        {activeSector.history?.map(log => (
                                            <div key={log.id} className="text-xs p-3 bg-slate-50 rounded border border-slate-200">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-bold text-slate-700">{new Date(log.timestamp).toLocaleDateString()}</span>
                                                    <Badge color="blue">{formatNumber(log.finalOee * 100, 1)}%</Badge>
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-500 mb-2">
                                                    <span>Analista: {log.analyst}</span>
                                                    <span>Lote: {log.batchId}</span>
                                                </div>
                                                <div className="grid grid-cols-3 gap-1 text-[10px] text-center font-mono bg-white p-1 rounded border border-slate-100">
                                                    <span>D: {formatNumber(log.availability * 100, 0)}%</span>
                                                    <span>R: {formatNumber(log.performance * 100, 0)}%</span>
                                                    <span>C: {formatNumber(log.quality * 100, 0)}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
