import React, { useState, useEffect, useMemo } from 'react';
import { ProjectData, INITIAL_PROJECT, Task } from '../types';
import { Card, Badge } from '../components/ui/Card';
import { calculateTaktTime, formatNumber, calculateTotalEffectiveWorkContent, calculateTotalHeadcount, calculateEffectiveStationTime } from '../utils';
import { parseDemand } from '../utils/validation';
import { AlertTriangle, CheckCircle2, Trash2, Layers, PieChart } from 'lucide-react';
import ProductSelector from '../components/ui/ProductSelector';
import type { ProductSelection } from '../components/ui/ProductSelector';
import { Tooltip } from '../components/ui/Tooltip';
import { toast } from '../components/ui/Toast';

// Hooks
import { useOEELogic } from '../hooks/useOEELogic';
import { useShiftManager } from '../hooks/useShiftManager';

// Sub-components
import { KPIView } from './panel/KPIView';
import { CapacityAnalysis } from './panel/CapacityAnalysis';
import { ShiftStructure } from './panel/ShiftStructure';
import { ModelManagerModal } from './task/modals/ModelManagerModal';

// Phase 1 Completion: New UI Components
import { TaktSemaphore } from '../components/ui/TaktSemaphore';
import TaktPreview from '../components/ui/TaktPreview';

interface Props {
    data: ProjectData;
    updateData: (data: ProjectData) => void;
}

// MEJORA 1: Interface tipada para breakdown de OEE por sector
interface SectorBreakdown {
    id: string;
    name: string;
    color: string;
    count: number;
    time: number;
    oee: number;
    weightPct: number;
}

export const PanelControl: React.FC<Props> = ({ data, updateData }) => {

    const [showResetModal, setShowResetModal] = useState(false);
    const [showModelModal, setShowModelModal] = useState(false);
    // MEJORA 3: Estado para prevenir doble-click y mostrar feedback
    const [isResetting, setIsResetting] = useState(false);

    // Local state for Daily Demand to allow empty input (UX)
    const [dailyDemandInput, setDailyDemandInput] = useState(data.meta.dailyDemand.toString());
    const [piecesPerVehicleInput, setPiecesPerVehicleInput] = useState((data.meta.piecesPerVehicle ?? 1).toString());
    const [vehicleDemandInput, setVehicleDemandInput] = useState('');

    // Business Logic Hooks
    const oeeLogic = useOEELogic(data, updateData);
    const shiftManager = useShiftManager(data, updateData);

    const ppv = data.meta.piecesPerVehicle ?? 1;

    // Sync local state when external data changes
    useEffect(() => {
        setDailyDemandInput(data.meta.dailyDemand.toString());
        // Auto-calculate vehicle demand from pieces demand
        if (ppv > 0) {
            setVehicleDemandInput(Math.round(data.meta.dailyDemand / ppv).toString());
        }
    }, [data.meta.dailyDemand, ppv]);

    useEffect(() => {
        setPiecesPerVehicleInput((data.meta.piecesPerVehicle ?? 1).toString());
    }, [data.meta.piecesPerVehicle]);

    const handleDemandChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setDailyDemandInput(val);

        // Allow empty string transiently (don't update global state to 0 immediately)
        if (val === '') return;

        const num = parseDemand(val);
        oeeLogic.handleMetaChange('dailyDemand', num);
    };

    const handleDemandBlur = () => {
        if (dailyDemandInput === '') {
            setDailyDemandInput(data.meta.dailyDemand.toString());
        }
    };

    const handlePiecesPerVehicleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setPiecesPerVehicleInput(val);
        if (val === '' || isNaN(Number(val))) return;
        const num = Math.max(1, Math.round(Number(val)));
        oeeLogic.handleMetaChange('piecesPerVehicle', num);
    };

    const handleVehicleDemandChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setVehicleDemandInput(val);
        if (val === '' || isNaN(Number(val))) return;
        const vehicles = Math.max(0, Math.round(Number(val)));
        // Bidirectional: update dailyDemand = vehicles × piecesPerVehicle
        const newDemand = vehicles * ppv;
        setDailyDemandInput(newDemand.toString());
        oeeLogic.handleMetaChange('dailyDemand', newDemand);
    };

    const handleVehicleDemandBlur = () => {
        if (vehicleDemandInput === '' && ppv > 0) {
            setVehicleDemandInput(Math.round(data.meta.dailyDemand / ppv).toString());
        }
    };

    const handleResetData = () => {
        // MEJORA 3: Prevenir doble-click y mostrar feedback
        if (isResetting) return;
        setIsResetting(true);

        // Deep copy of INITIAL_PROJECT
        const cleanState = JSON.parse(JSON.stringify(INITIAL_PROJECT));

        // CUSTOM: User wants "Blank/Zero" state, not "Defaults".
        cleanState.meta.dailyDemand = 0;
        cleanState.meta.manualOEE = 0;
        cleanState.meta.name = "";
        cleanState.meta.client = "";
        cleanState.meta.version = "Borrador";

        // Preserve file association so save/auto-save keeps working
        cleanState.fileHandle = data.fileHandle;
        cleanState.directoryHandle = data.directoryHandle;
        cleanState.id = data.id;

        updateData(cleanState);
        toast.success('Proyecto Restablecido', 'Todos los datos han sido eliminados.');
        setIsResetting(false);
        setShowResetModal(false);
    };

    // NEW: Clear only tasks and assignments, keep project configuration
    const handleClearTasks = () => {
        // MEJORA 3: Prevenir doble-click y mostrar feedback
        if (isResetting) return;
        setIsResetting(true);

        updateData({
            ...data,
            tasks: [],
            assignments: [],
            zoningConstraints: [],
            stationConfigs: data.stationConfigs.map(sc => ({
                ...sc,
                effectiveTime: 0,
            })),
        });
        toast.success('Tareas Eliminadas', 'Las tareas y asignaciones han sido limpiadas.');
        setIsResetting(false);
        setShowResetModal(false);
    };

    // --- CALCULATIONS (Controller Layer) ---
    const { nominalSeconds, effectiveSeconds, totalAvailableMinutes } = useMemo(
        () => calculateTaktTime(data.shifts, data.meta.activeShifts, data.meta.dailyDemand, oeeLogic.activeOEE, data.meta.setupLossPercent || 0),
        [data.shifts, data.meta.activeShifts, data.meta.dailyDemand, oeeLogic.activeOEE, data.meta.setupLossPercent]
    );

    const totalEffectiveWork = useMemo(
        () => calculateTotalEffectiveWorkContent(data),
        [data.tasks, data.assignments]
    );
    const totalHeadcount = useMemo(
        () => calculateTotalHeadcount(data),
        [data.meta.configuredStations, data.stationConfigs, data.assignments]
    );
    const realStations = data.meta.configuredStations > 0 ? data.meta.configuredStations : 1;

    // HALLAZGO #1 FIX: Calcular el cuello de botella real (TCR) basado en asignaciones
    // Uses calculateEffectiveStationTime for overlap-aware cycle time (concurrent machine+manual tasks)
    const realCycleTime = useMemo(() => {
        if (!data.assignments || data.assignments.length === 0) return 0;

        const taskMap = new Map(data.tasks.map(t => [t.id, t]));
        const configMap = new Map(data.stationConfigs?.map(sc => [sc.id, sc]) ?? []);

        // Group tasks by station
        const stationTasksMap = new Map<number, Task[]>();
        data.assignments.forEach(a => {
            const task = taskMap.get(a.taskId);
            if (task) {
                if (!stationTasksMap.has(a.stationId)) {
                    stationTasksMap.set(a.stationId, []);
                }
                stationTasksMap.get(a.stationId)!.push(task);
            }
        });

        // Calculate effective time per station using overlap-aware algorithm
        const stationCycles: number[] = [];
        stationTasksMap.forEach((tasks, stationId) => {
            const effectiveTime = calculateEffectiveStationTime(tasks);
            const config = configMap.get(stationId);
            const replicas = config?.replicas || 1;
            stationCycles.push(effectiveTime / replicas);
        });

        if (stationCycles.length === 0) return 0;
        return Math.max(...stationCycles);
    }, [data.assignments, data.tasks, data.stationConfigs]);

    // MEJORA 1: Lógica de breakdown OEE extraída del JSX a useMemo tipado
    const sectorBreakdown = useMemo((): SectorBreakdown[] => {
        if (!data.meta.useSectorOEE) return [];

        let totalStdTime = 0;
        const stats: Record<string, { count: number; time: number; oee: number; name: string; color: string }> = {
            general: { count: 0, time: 0, oee: data.meta.manualOEE, name: 'General (Sin Sector)', color: '#94a3b8' }
        };

        data.sectors.forEach(s => {
            stats[s.id] = { count: 0, time: 0, oee: s.targetOee || data.meta.manualOEE, name: s.name, color: s.color };
        });

        data.tasks.forEach(t => {
            const time = t.standardTime || t.averageTime || 0;
            totalStdTime += time;
            const sId = t.sectorId && stats[t.sectorId] ? t.sectorId : 'general';
            stats[sId].count++;
            stats[sId].time += time;
        });

        const safeTotal = totalStdTime > 0 ? totalStdTime : 1;
        const ids = [...data.sectors.map(s => s.id), ...(stats.general.count > 0 ? ['general'] : [])];

        return ids.map(id => ({
            id,
            ...stats[id],
            weightPct: (stats[id].time / safeTotal) * 100
        })).filter(Boolean) as SectorBreakdown[];
    }, [data.meta.useSectorOEE, data.meta.manualOEE, data.sectors, data.tasks]);

    // Pre-check: any task without sector? (avoid re-scanning in JSX on every render)
    const hasTasksWithoutSector = useMemo(
        () => data.tasks.some(t => !t.sectorId),
        [data.tasks]
    );

    // Efficiency
    const efficiency = (totalHeadcount > 0 && nominalSeconds > 0)
        ? (totalEffectiveWork / (totalHeadcount * nominalSeconds)) * 100
        : 0;

    // FIX: Guard against NaN masking as 'good' status
    let effStatus: 'good' | 'warn' | 'crit' | 'error' = 'good';
    if (!Number.isFinite(efficiency)) effStatus = 'error';
    else if (efficiency > 100) effStatus = 'error';
    else if (efficiency < 75) effStatus = 'crit';
    else if (efficiency < 85) effStatus = 'warn';

    const idealHeadcount = effectiveSeconds > 0 ? Math.ceil(totalEffectiveWork / effectiveSeconds) : 0;

    // Shift Analysis
    const oeeVal = oeeLogic.activeOEE > 0 ? oeeLogic.activeOEE : 1;
    const requiredManHours = (data.meta.dailyDemand * totalEffectiveWork) / oeeVal / 3600;
    const shiftHours = totalAvailableMinutes / 60;
    const totalLineCapacityHours = shiftHours * totalHeadcount;
    const capacityDiff = totalLineCapacityHours - requiredManHours;



    return (
        <div className="space-y-6 relative">

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* General Data Card (Still kept here as it's the main form) */}
                <Card title="Datos Generales" className="lg:col-span-1" actions={
                    <Badge color="blue">{data.meta.version}</Badge>
                }>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Nombre del Proyecto / Pieza</label>
                            <input type="text" className="mt-1 block w-full rounded-md border-slate-300 shadow-sm border p-2 bg-white text-slate-900" value={data.meta.name} onChange={(e) => oeeLogic.handleMetaChange('name', e.target.value)} />
                        </div>



                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Fecha</label>
                                <input type="date" className="mt-1 block w-full rounded-md border-slate-300 shadow-sm border p-2 bg-white text-slate-900" value={data.meta.date} onChange={(e) => oeeLogic.handleMetaChange('date', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Cliente / Producto</label>
                                <div className="mt-1">
                                    <ProductSelector
                                        value={data.meta.client}
                                        onProductSelect={(sel: ProductSelection) => {
                                            oeeLogic.handleMetaChange('client', sel.lineaName);
                                            oeeLogic.handleMetaChange('name', sel.descripcion);
                                        }}
                                        onTextChange={(val) => oeeLogic.handleMetaChange('client', val)}
                                        placeholder="Buscar cliente o producto..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* MMALBP: Mix Configuration Trigger */}
                        <div className="bg-slate-50 p-3 rounded-lg border border-dashed border-slate-300">
                            <div className="flex justify-between items-center">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                        <PieChart size={12} /> Mix de Productos
                                    </label>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {(data.meta.activeModels || []).length} Variante(s) Activas.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowModelModal(true)}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-md border border-blue-200 transition-colors shadow-sm bg-white"
                                >
                                    Configurar
                                </button>
                            </div>
                            {/* Short preview of percentages */}
                            <div className="pt-2 flex gap-1 h-3 mt-1 overflow-hidden rounded-full opacity-80">
                                {(data.meta.activeModels || [{ percentage: 1, color: '#e2e8f0', id: 'd' }]).map(m => (
                                    <div key={m.id} className="h-full" style={{ width: `${m.percentage * 100}%`, backgroundColor: m.color || '#e2e8f0' }} title={`${m.name}: ${(m.percentage * 100).toFixed(0)}%`}></div>
                                ))}
                            </div>
                        </div>

                        {/* Piezas por Vehículo */}
                        <div className="grid grid-cols-3 gap-3 mb-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Pzs por Vehículo</label>
                                <input
                                    type="number"
                                    min="1"
                                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm border p-2 bg-white text-slate-900 text-center font-bold"
                                    value={piecesPerVehicleInput}
                                    onChange={handlePiecesPerVehicleChange}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Demanda (vehículos/día)</label>
                                <input
                                    type="number"
                                    min="0"
                                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm border p-2 bg-white text-blue-700 font-bold text-center"
                                    value={vehicleDemandInput}
                                    onChange={handleVehicleDemandChange}
                                    onBlur={handleVehicleDemandBlur}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Demanda Semanal (pzs)</label>
                                <div className="mt-1 block w-full rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-700 font-mono text-center text-sm font-bold">
                                    {(data.meta.dailyDemand * 5).toLocaleString('es-AR')}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Demanda Diaria (piezas)</label>
                                <input
                                    type="number"
                                    min="0"
                                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm border p-2 bg-white text-slate-900"
                                    value={dailyDemandInput}
                                    onChange={handleDemandChange}
                                    onBlur={handleDemandBlur}
                                />

                                {/* Phase 1: Takt Preview - Real-time feedback */}
                                {data.meta.dailyDemand > 0 && (
                                    <div className="mt-2">
                                        <TaktPreview
                                            shifts={data.shifts}
                                            activeShifts={data.meta.activeShifts}
                                            dailyDemand={data.meta.dailyDemand}
                                            oee={oeeLogic.activeOEE}
                                            setupLossPercent={data.meta.setupLossPercent || 0}
                                            compact={true}
                                        />
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Turnos Activos</label>
                                <select className="mt-1 block w-full rounded-md border-slate-300 shadow-sm border p-2 bg-white text-slate-900" value={data.meta.activeShifts} onChange={(e) => oeeLogic.handleMetaChange('activeShifts', parseInt(e.target.value))}>
                                    <option value={1}>1 Turno</option>
                                    <option value={2}>2 Turnos</option>
                                    <option value={3}>3 Turnos</option>
                                </select>
                                {(data.sectors || []).some(s => s.shiftOverride) && (
                                    <div className="mt-1.5 px-2 py-1 bg-indigo-50 border border-indigo-200 rounded-md text-xs text-indigo-700 font-medium">
                                        {(data.sectors || []).filter(s => s.shiftOverride).length} sector(es) con turnos propios
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* OEE MANAGEMENT (Refactored to use Hook) */}
                        <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                            <div className="col-span-2">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                                        Configuración OEE
                                        <Tooltip content={<><strong>Global:</strong> Mismo % para todo.<br /><strong>Por Sector:</strong> Ponderado según validación real de cada área.</>} />
                                    </label>
                                    <div className="flex bg-slate-100 p-0.5 rounded-lg">
                                        <button
                                            onClick={() => oeeLogic.toggleSectorOEE(false)}
                                            className={`text-[10px] px-3 py-1 rounded-md font-bold transition-all ${!data.meta.useSectorOEE ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Global
                                        </button>
                                        <button
                                            onClick={() => oeeLogic.toggleSectorOEE(true)}
                                            className={`text-[10px] px-3 py-1 rounded-md font-bold transition-all ${data.meta.useSectorOEE ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Por Sector
                                        </button>
                                    </div>
                                </div>

                                <div className="relative mt-2">
                                    <input
                                        type="text"
                                        disabled={data.meta.useSectorOEE}
                                        className={`block w-full rounded-md border shadow-sm p-2 font-bold transition-colors ${data.meta.useSectorOEE ? 'bg-slate-100 text-slate-500 border-slate-300 cursor-not-allowed' : 'bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'}`}
                                        value={data.meta.useSectorOEE ? formatNumber(oeeLogic.weightedOEE * 100) : oeeLogic.oeeInput}
                                        onChange={(e) => oeeLogic.handleOeeChange(e.target.value)}
                                        placeholder="85"
                                    />
                                    <span className={`absolute right-3 top-2.5 text-xs font-bold ${data.meta.useSectorOEE ? 'text-slate-400' : 'text-slate-400'}`}>%</span>
                                </div>

                                {data.meta.useSectorOEE && (
                                    <div className="mt-2 text-[10px] text-purple-700 bg-purple-50 p-2 rounded border border-purple-100 flex items-start gap-2">
                                        <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="font-bold">Promedio Ponderado Activo</p>
                                            <p className="opacity-80">Si el valor es bajo, asegúrese de asignar sus tareas a los sectores correspondientes en la pestaña &ldquo;Tareas&rdquo;.</p>
                                        </div>
                                    </div>
                                )}

                                {/* V8.2: ISO 22400 Warning - Double Penalty Detection */}
                                {data.meta.manualOEE < 1.0 && (data.meta.setupLossPercent || 0) > 0 && (
                                    <div className="mt-2 text-[10px] text-red-700 bg-red-50 p-2 rounded border border-red-200 flex items-start gap-2">
                                        <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="font-bold">⚠️ Doble Penalización Detectada (ISO 22400)</p>
                                            <p className="opacity-80">
                                                Tiene OEE ({(data.meta.manualOEE * 100).toFixed(0)}%) Y Setup Loss ({((data.meta.setupLossPercent || 0) * 100).toFixed(1)}%) activos.
                                                El OEE estándar ya incluye el Setup. {' '}
                                                <button
                                                    onClick={() => oeeLogic.handleMetaChange('setupLossPercent', 0)}
                                                    className="underline font-bold hover:text-red-900"
                                                >
                                                    Eliminar Setup Loss
                                                </button>
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* OEE BREAKDOWN TABLE (New) */}
                            {data.meta.useSectorOEE && (
                                <div className="mt-4 col-span-2">
                                    <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                                        <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
                                            <h5 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                                <Layers size={12} /> Desglose de Impacto
                                            </h5>
                                            <span className="text-[10px] text-slate-500 font-mono">Total: {formatNumber(oeeLogic.weightedOEE * 100)}%</span>
                                        </div>

                                        <div className="p-2 space-y-1">
                                            {/* MEJORA 1: Reemplazado IIFE de 55 líneas con .map() simple */}
                                            {sectorBreakdown.map(st => {
                                                const isInactive = st.count === 0;
                                                return (
                                                    <div key={st.id} className={`flex items-center justify-between text-xs p-1.5 rounded ${isInactive ? 'opacity-50' : 'bg-white border border-slate-100'}`}>
                                                        <div className="flex items-center gap-2 flex-1">
                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: st.color }}></div>
                                                            <span className="font-medium text-slate-700 truncate max-w-[100px]" title={st.name}>{st.name}</span>
                                                            {st.id === 'general' && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded font-bold">ALERTA</span>}
                                                        </div>
                                                        <div className="flex items-center gap-4 text-[10px] text-slate-500 font-mono">
                                                            <div title="Tareas Asignadas">
                                                                <span className="font-bold text-slate-700">{st.count}</span> Tareas
                                                            </div>
                                                            <div title="Objetivo OEE">
                                                                Obj: <span className="font-bold text-blue-600">{(st.oee * 100).toFixed(0)}%</span>
                                                            </div>
                                                            <div title="Peso en el Cálculo Final">
                                                                Peso: <span className={`font-bold ${isInactive ? 'text-slate-400' : 'text-emerald-600'}`}>{st.weightPct.toFixed(1)}%</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Warnings */}
                                    {hasTasksWithoutSector && (
                                        <div className="mt-2 text-[10px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-100 flex items-start gap-2">
                                            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="font-bold">Atención: Tareas sin Sector</p>
                                                <p className="opacity-80">Las tareas &ldquo;General&rdquo; usan el OEE Global. Asigne sectores para mayor precisión.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* CAPACITY LIMIT MODE - Seguro vs Permisivo */}
                        <div className="border-t border-slate-100 pt-4 mt-4">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                    Límite de Capacidad
                                    <Tooltip content={<><strong>🔒 Seguro:</strong> Limita estaciones al Takt × OEE ({formatNumber(effectiveSeconds)}s). Conservador, garantiza producción dentro del turno.<br /><br /><strong>⚡ Permisivo:</strong> Limita al Takt Nominal ({formatNumber(nominalSeconds)}s). Reduce operarios, pero requiere gestionar OEE externamente.</>} />
                                </label>
                                <div className="flex bg-slate-100 p-0.5 rounded-lg">
                                    <button
                                        onClick={() => oeeLogic.handleMetaChange('capacityLimitMode', 'oee')}
                                        className={`text-[10px] px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${(data.meta.capacityLimitMode || 'oee') === 'oee' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        🔒 Seguro
                                    </button>
                                    <button
                                        onClick={() => oeeLogic.handleMetaChange('capacityLimitMode', 'nominal')}
                                        className={`text-[10px] px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${data.meta.capacityLimitMode === 'nominal' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        ⚡ Permisivo
                                    </button>
                                </div>
                            </div>

                            <div className="text-[10px] text-slate-500 font-mono bg-slate-50 px-3 py-1.5 rounded border border-slate-100">
                                Techo: <span className="font-bold text-slate-700">{formatNumber(data.meta.capacityLimitMode === 'nominal' ? nominalSeconds : effectiveSeconds)}s</span>
                                <span className="ml-1">({data.meta.capacityLimitMode === 'nominal' ? 'Takt Nominal' : 'Takt × OEE'})</span>
                            </div>

                            {data.meta.capacityLimitMode === 'nominal' && (
                                <div className="mt-2 text-[10px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-100 flex items-start gap-2">
                                    <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="font-bold">Modo Permisivo Activo</p>
                                        <p className="opacity-80">
                                            Las estaciones pueden cargar hasta {formatNumber(nominalSeconds)}s (Takt bruto).
                                            La producción real dependerá de mantener un OEE ≥ {(oeeLogic.activeOEE * 100).toFixed(0)}%.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* FATIGUE COMPENSATION SECTION (OIT Standard) - v10.0 */}
                        <div className="border-t border-slate-100 pt-4 mt-4">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                    Factor de Fatiga y Necesidades Personales
                                    <Tooltip content={
                                        <>
                                            <strong>Margen de Seguridad OIT</strong><br />
                                            Tiempo adicional para cubrir necesidades personales
                                            (baño, hidratación) y recuperación física básica.<br />
                                            <strong>Recomendado: 10-15%</strong><br /><br />
                                            Aplica a todas las tareas manuales.
                                        </>
                                    } />
                                </label>

                                {/* Toggle Switch */}
                                <button
                                    onClick={() => oeeLogic.handleMetaChange('fatigueCompensation', {
                                        ...(data.meta.fatigueCompensation || { globalPercent: 10 }),
                                        enabled: !(data.meta.fatigueCompensation?.enabled ?? true)
                                    })}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${(data.meta.fatigueCompensation?.enabled ?? true)
                                        ? 'bg-emerald-500'
                                        : 'bg-slate-300'
                                        }`}
                                >
                                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${(data.meta.fatigueCompensation?.enabled ?? true)
                                        ? 'translate-x-5'
                                        : 'translate-x-0'
                                        }`} />
                                </button>
                            </div>

                            {/* Percentage Input */}
                            <div className={`flex items-center gap-2 transition-opacity ${(data.meta.fatigueCompensation?.enabled ?? true) ? '' : 'opacity-50'
                                }`}>
                                <input
                                    type="number"
                                    min="0"
                                    max="30"
                                    disabled={!(data.meta.fatigueCompensation?.enabled ?? true)}
                                    className={`w-20 rounded-md shadow-sm border p-2 text-center font-bold ${(data.meta.fatigueCompensation?.enabled ?? true) ? 'bg-white text-slate-900 border-slate-300' : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'}`}
                                    value={data.meta.fatigueCompensation?.globalPercent ?? 10}
                                    onChange={(e) => oeeLogic.handleMetaChange('fatigueCompensation', {
                                        enabled: data.meta.fatigueCompensation?.enabled ?? true,
                                        globalPercent: Math.max(0, Math.min(30, parseInt(e.target.value) || 0))
                                    })}
                                />
                                <span className="text-sm text-slate-500">% Suplemento Global</span>
                            </div>

                            {/* Info Badge when enabled */}
                            {(data.meta.fatigueCompensation?.enabled ?? true) && (
                                <div className="mt-2 text-[10px] text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-100 flex items-start gap-2">
                                    <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="font-bold">Compensación Activa</p>
                                        <p className="opacity-80">
                                            Todas las tareas manuales recibirán
                                            +{data.meta.fatigueCompensation?.globalPercent ?? 10}% automáticamente.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                {/* KPI View */}
                <KPIView
                    nominalSeconds={nominalSeconds}
                    effectiveSeconds={effectiveSeconds}
                    activeOEE={oeeLogic.activeOEE}
                    efficiency={efficiency}
                    effStatus={effStatus}
                />

                {/* Capacity Analysis */}
                <CapacityAnalysis
                    idealHeadcount={idealHeadcount}
                    totalHeadcount={totalHeadcount}
                    realStations={realStations}
                    requiredManHours={requiredManHours}
                    totalLineCapacityHours={totalLineCapacityHours}
                    capacityDiff={capacityDiff}
                />

                {/* Phase 1 Completion: Capacity Semaphore */}
                <div className="lg:col-span-3">
                    <TaktSemaphore
                        taktTime={nominalSeconds}
                        bottleneckTime={realCycleTime > 0 ? realCycleTime : effectiveSeconds}
                        dailyDemand={data.meta.dailyDemand}
                        availableTimeSeconds={totalAvailableMinutes * 60}
                        compact={false}
                        onAction={() => {
                            // H-08 UX Audit: Actionable guidance for capacity issues
                            // Opens shift configuration for the first active shift
                            const firstShiftId = data.shifts[0]?.id ?? null;
                            shiftManager.setEditingBreaksShiftId(firstShiftId);
                        }}
                        actionLabel="Ajustar Turnos"
                    />
                </div>

                {/* Shift Structure (Spans 3 cols internally but here we wrap or pass props) */}
                {/* Note: In original it was col-span-3. ShiftStructure returns a Card which can accept className? No. */}
                {/* It returns a div relative, then a Card inside. We should wrap it to enforce grid placement. */}
                <div className="lg:col-span-3">
                    <ShiftStructure
                        shifts={data.shifts}
                        activeShifts={data.meta.activeShifts}
                        totalAvailableMinutes={totalAvailableMinutes}
                        onShiftChange={shiftManager.handleShiftChange}
                        onAddBreak={shiftManager.addBreak}
                        onRemoveBreak={shiftManager.removeBreak}
                        onUpdateBreak={shiftManager.updateBreak}
                        editingBreaksShiftId={shiftManager.editingBreaksShiftId}
                        setEditingBreaksShiftId={shiftManager.setEditingBreaksShiftId}
                        sectors={data.sectors}
                        dailyDemand={data.meta.dailyDemand}
                        globalOee={oeeLogic.activeOEE}
                        setupLossPercent={data.meta.setupLossPercent || 0}
                        onSectorShiftChange={(sectorId, activeShiftsVal) => {
                            const newSectors = (data.sectors || []).map(s =>
                                s.id === sectorId
                                    ? { ...s, shiftOverride: activeShiftsVal !== null ? { activeShifts: Math.max(1, Math.min(3, activeShiftsVal)) } : undefined }
                                    : s
                            );
                            updateData({ ...data, sectors: newSectors });
                        }}
                    />
                </div>

                {/* DANGER ZONE - DATA MANAGEMENT */}
                <div className="lg:col-span-3">
                    <Card title="Zona de Gestión de Datos" className="border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between p-2">
                            <div>
                                <h4 className="font-bold text-slate-700">Limpiar o Restablecer</h4>
                                <p className="text-sm text-slate-500">
                                    Elige entre limpiar solo las tareas cargadas o restablecer todo el proyecto.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowResetModal(true)}
                                className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all font-bold shadow-sm"
                            >
                                <Trash2 size={18} /> Gestionar Datos
                            </button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* RESET CONFIRMATION MODAL */}
            {showResetModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border-2 border-slate-200">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-3">
                            <div className="bg-slate-100 p-2 rounded-full">
                                <Trash2 size={24} className="text-slate-600" />
                            </div>
                            <h3 className="font-bold text-slate-900 text-lg">Gestión de Datos</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Option 1: Clear Tasks Only (Safe) */}
                            <div className="border border-blue-200 rounded-lg p-4 hover:bg-blue-50 transition-colors">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <h4 className="font-bold text-blue-800 flex items-center gap-2">
                                            🧹 Limpiar Tareas
                                            <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">RECOMENDADO</span>
                                        </h4>
                                        <p className="text-sm text-slate-600 mt-1">
                                            Borra <strong>únicamente</strong> las tareas cargadas y sus asignaciones.
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            ✓ Mantiene: nombre, cliente, demanda, turnos, OEE, sectores.
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleClearTasks}
                                        disabled={isResetting}
                                        className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-sm transition-all whitespace-nowrap ${isResetting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {isResetting ? 'Procesando...' : 'Limpiar'}
                                    </button>
                                </div>
                            </div>

                            {/* Option 2: Full Reset (Destructive) */}
                            <div className="border border-red-200 rounded-lg p-4 hover:bg-red-50 transition-colors">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <h4 className="font-bold text-red-800 flex items-center gap-2">
                                            <AlertTriangle size={16} /> Restablecer Todo
                                        </h4>
                                        <p className="text-sm text-slate-600 mt-1">
                                            Vuelve el proyecto al estado inicial vacío. <strong>Irreversible.</strong>
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            ⚠️ Borra: tareas, nombre, cliente, demanda, turnos, OEE, sectores, VSM.
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleResetData}
                                        disabled={isResetting}
                                        className={`px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm shadow-sm transition-all whitespace-nowrap ${isResetting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {isResetting ? 'Procesando...' : 'Restablecer'}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setShowResetModal(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-white hover:shadow-sm rounded-lg font-medium text-sm transition-all border border-transparent hover:border-slate-200"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MMALBP: Model Manager Modal */}
            <ModelManagerModal
                isOpen={showModelModal}
                onClose={() => setShowModelModal(false)}
                data={data}
                updateData={updateData}
            />
        </div>
    );
};
