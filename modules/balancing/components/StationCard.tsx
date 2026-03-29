import React from 'react';
import { Settings, Lock, X, Bot, Split, AlertTriangle, Cpu, Users, XCircle, CheckCircle2 } from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ProjectData, MachineType, Task, Sector } from '../../../types';
import { formatNumber } from '../../../utils';

interface StationCardProps {
    st: {
        id: number;
        time: number;
        limit: number;
        replicas: number;
        oee: number;
        tasks: string[];
        sectorId?: string;
        rawEffectiveTime?: number; // Total time before dividing by replicas
    };
    sectorsList: Sector[];
    draggedTask: string | null;
    isOverload: boolean;
    data: ProjectData;
    nominalSeconds?: number; // Takt time for tooltip
    effectiveSeconds?: number; // Takt × OEE for OEE zone coloring
    onUpdateReplicas: (id: number, delta: number) => void;
    onOpenConfig: (id: number, oee: number) => void;
    onUnassignTask: (taskId: string) => void;
    // V4.1: RC-ALBP Resource Visualization
    machineType?: MachineType | null; // Machine assigned to this station
    hasResourceDeficit?: boolean; // True if station is in deficit mode
    // Live Drag Preview
    dragPreview?: {
        stationId: number;
        previewTime: number;
        previewSaturation: number;
        delta: number;
        wouldOverload: boolean;
    } | null;
}

const DraggableStationTask: React.FC<{
    t: Task;
    formatNumber: (n: number) => string;
    onUnassignTask: (id: string) => void;
}> = React.memo(({ t, formatNumber, onUnassignTask }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: t.id,
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 999 : undefined,
    };

    const isMachine = t.executionMode === 'machine' || t.executionMode === 'injection';
    const isConcurrent = !!t.concurrentWith;
    const isAbsorbed = t.isMachineInternal; // RC1: Internal tasks absorbed during curing

    let bgClass = "bg-slate-50 border-slate-200 text-slate-700";
    if (isMachine) bgClass = "bg-purple-50 border-purple-200 text-purple-700";
    if (isConcurrent) bgClass = "bg-emerald-50 border-emerald-200 text-emerald-700 border-dashed";
    // RC1: Absorbed tasks get special styling
    if (isAbsorbed) bgClass = "bg-cyan-50 border-cyan-300 text-cyan-700 border-dotted";

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`group relative border px-3 py-1.5 rounded text-xs font-medium cursor-grab active:cursor-grabbing hover:shadow-sm flex items-center gap-2 ${bgClass} ${isDragging ? 'opacity-50' : ''}`}
            title={isAbsorbed ? `↺ ${formatNumber(t.standardTime || t.averageTime)}s absorbido durante ciclo máquina` : undefined}
            aria-label={`Tarea ${t.id}, ${formatNumber(t.standardTime || t.averageTime)} segundos. Arrastrar para reasignar.`}
            aria-roledescription="elemento arrastrable"
        >
            <div className="flex flex-col">
                <span className="font-bold font-mono">{t.id}</span>
                <span className="text-[9px] opacity-70">
                    {/* RC1: Show absorption indicator for internal tasks */}
                    {isAbsorbed && <span className="text-cyan-600">↺ </span>}
                    {formatNumber(t.standardTime || t.averageTime)}s
                    {isAbsorbed && <span className="text-cyan-500 ml-0.5">(abs)</span>}
                </span>
            </div>
            {isMachine && <Bot size={12} className="opacity-50" />}
            {isConcurrent && <Split size={12} className="opacity-50" />}

            <button
                onClick={(e) => {
                    e.stopPropagation(); // Prevent drag start when clicking remove
                    onUnassignTask(t.id);
                }}
                aria-label={`Desasignar tarea ${t.id}`}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 absolute -top-2 -right-2 bg-white rounded-full p-0.5 border border-slate-200 text-slate-400 hover:text-red-500 shadow-sm transition-opacity"
            >
                <X size={12} />
            </button>
        </div>
    );
});
DraggableStationTask.displayName = 'DraggableStationTask';

export const StationCard: React.FC<StationCardProps> = React.memo(({
    st, sectorsList, draggedTask, isOverload, data, nominalSeconds, effectiveSeconds,
    onUpdateReplicas, onOpenConfig, onUnassignTask,
    machineType, hasResourceDeficit, dragPreview
}) => {
    const stationSector = sectorsList.find(s => s.id === st.sectorId);
    const { setNodeRef, isOver } = useDroppable({
        id: `station-${st.id}`, // specific ID to prevent collision with tasks
    });

    // Phase 28: Parallel Station Visual Indicators
    const isParallel = st.replicas > 1;
    const rawTime = st.rawEffectiveTime || (st.time * st.replicas);

    // FIX 9: Calculate saturation considering replicas
    // Saturation = (Effective Time) / (Replicas × Limit) × 100
    // Since st.time is already divided by replicas, saturation = st.time / st.limit
    const saturationPercent = st.limit > 0 ? (st.time / st.limit) * 100 : 0;

    // OEE Risk Zone: In nominal mode, station exceeds OEE limit but stays within Takt
    const isNominalMode = data.meta.capacityLimitMode === 'nominal';
    const isInOeeRiskZone = isNominalMode && effectiveSeconds && st.time > effectiveSeconds && !isOverload;

    // Build tooltip parts, join with ' | ' since \n doesn't render in HTML title
    const parallelTooltipParts = isParallel
        ? [
            `${st.replicas} operarios en paralelo`,
            `Total: ${formatNumber(rawTime)}s ÷ ${st.replicas} = ${formatNumber(st.time)}s/ciclo`,
            `Saturación: ${formatNumber(saturationPercent)}%`,
            ...(nominalSeconds ? [`Takt: ${formatNumber(nominalSeconds)}s`] : [])
        ]
        : [];
    const parallelTooltip = parallelTooltipParts.join(' | ');

    // V4.1: Determine card styling based on deficit status
    const deficitStyles = hasResourceDeficit
        ? 'border-red-400 bg-red-50/30 shadow-red-100'
        : '';

    // Phase 28: Orange styling for parallel stations
    const parallelStyles = isParallel && !hasResourceDeficit
        ? 'border-amber-400 bg-amber-50/20 ring-2 ring-amber-100'
        : '';

    return (
        <div
            ref={setNodeRef}
            aria-label={`Estación ${st.id}, ${formatNumber(st.time)} segundos, ${st.tasks.length} tareas asignadas${isOverload ? ', sobrecargada' : ''}`}
            aria-roledescription="zona de destino"
            className={`border rounded-xl p-4 transition-all relative ${isOver ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200' : (draggedTask ? 'border-slate-300 bg-slate-50/50' : 'border-slate-200 bg-white')} ${isOverload ? 'shadow-red-100 border-red-200' : 'shadow-sm'} ${deficitStyles} ${parallelStyles}`}
            style={{ borderLeftColor: stationSector?.color || undefined, borderLeftWidth: stationSector ? 4 : 1 }}
            title={parallelTooltip}
        >
            {/* Phase 28: Parallel Station Badge */}
            {isParallel && (
                <div
                    className="absolute -top-2 left-2 flex items-center gap-1 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-sm cursor-help"
                    title={parallelTooltip}
                >
                    <Users size={10} />
                    ×{st.replicas} Ops
                </div>
            )}

            {/* V4.1: Resource Deficit Warning Banner */}
            {hasResourceDeficit && (
                <div className="absolute -top-2 right-2 flex items-center gap-1 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-sm">
                    <AlertTriangle size={10} />
                    DÉFICIT
                </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="bg-slate-800 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shadow-sm">{st.id}</div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-800 text-sm">Estación {st.id}</h4>
                            {stationSector && (
                                <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: stationSector.color }}>
                                    {stationSector.name}
                                </span>
                            )}
                            {/* V4.1: ResourceBadge - Machine Type */}
                            {machineType && (
                                <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${hasResourceDeficit ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-amber-100 text-amber-700 border border-amber-300'}`}
                                    title={`Requiere: ${machineType.name} (${machineType.availableUnits ?? machineType.quantity ?? 0} disponibles)`}
                                >
                                    <Cpu size={10} />
                                    {machineType.name.substring(0, 8)}
                                </span>
                            )}
                            {/* Injection badge: show if any task is injection mode */}
                            {st.tasks.some(tid => {
                                const t = data.tasks.find(x => x.id === tid);
                                return t?.executionMode === 'injection';
                            }) && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-300" title="Estación con tarea de inyección">
                                    Inj
                                </span>
                            )}
                            <div className="flex items-center border border-slate-200 rounded overflow-hidden">
                                <button onClick={() => onUpdateReplicas(st.id, -1)} className="px-1.5 hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition" disabled={st.replicas <= 1} title="Reducir operarios" aria-label="Reducir operarios">-</button>
                                <span className="px-2 text-xs font-mono font-bold bg-slate-50" title="Operarios en Paralelo (Multi-manning)">{st.replicas}</span>
                                <button onClick={() => onUpdateReplicas(st.id, 1)} className="px-1.5 hover:bg-slate-100 text-slate-500 transition" title="Agregar operario" aria-label="Agregar operario">+</button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                            <span>OEE: {formatNumber(st.oee * 100)}%</span>
                            {data.meta.useSectorOEE ? (
                                <span title="Bloqueado por Sector"><Lock size={10} className="text-purple-400" /></span>
                            ) : !data.meta.useManualOEE && (
                                <button onClick={() => onOpenConfig(st.id, st.oee)} className="text-slate-400 hover:text-blue-600" aria-label={`Configurar OEE de estación ${st.id}`}><Settings size={12} /></button>
                            )}
                        </div>
                    </div>
                </div>
                <div className={`text-right ${isOverload ? 'text-red-600' : 'text-slate-700'}`}>
                    <div className="text-2xl font-mono font-bold leading-none">{formatNumber(st.time)}s</div>
                    <div className="text-[10px] text-slate-400 mt-1">
                        Límite: <span className="font-medium">{formatNumber(st.limit)}s</span>
                    </div>
                    {/* FIX 9: Show saturation percentage */}
                    <div className={`text-[10px] font-bold mt-0.5 ${isOverload ? 'text-red-500' : isInOeeRiskZone ? 'text-amber-600' : saturationPercent > 90 ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {formatNumber(saturationPercent)}% saturación
                        {isInOeeRiskZone && <span className="ml-1 inline-flex items-center gap-0.5"><AlertTriangle size={10} /> OEE</span>}
                    </div>
                </div>
            </div>

            {/* Micro-Gantt Visual - FIX 9: Color based on saturation, not just overload */}
            <div className="flex h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-4 relative">
                <div
                    className={`h-full transition-all ${isOverload ? 'bg-red-500' : isInOeeRiskZone ? 'bg-amber-500' : saturationPercent > 90 ? 'bg-amber-400' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, saturationPercent)}%` }}
                    title={`Saturación: ${formatNumber(saturationPercent)}%${isInOeeRiskZone ? ' (Excede límite OEE)' : ''}`}
                ></div>
                {/* Drag Preview: ghost bar showing projected fill */}
                {dragPreview && dragPreview.delta > 0 && (
                    <div
                        className={`h-full opacity-50 ${dragPreview.wouldOverload ? 'bg-red-400' : dragPreview.previewSaturation > 90 ? 'bg-amber-300' : 'bg-blue-300'}`}
                        style={{ width: `${Math.min(100 - Math.min(100, saturationPercent), (dragPreview.delta / (st.limit || 1)) * 100)}%` }}
                    ></div>
                )}
            </div>

            {/* Live Drag Preview Overlay */}
            {dragPreview && (
                <div className={`mb-3 px-3 py-2 rounded-lg border-2 text-xs font-bold flex items-center justify-between animate-in fade-in duration-150 ${
                    dragPreview.wouldOverload
                        ? 'bg-red-50 border-red-300 text-red-700'
                        : dragPreview.previewSaturation > 90
                            ? 'bg-amber-50 border-amber-300 text-amber-700'
                            : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                }`}>
                    <span>+{formatNumber(dragPreview.delta)}s</span>
                    <span>{formatNumber(dragPreview.previewSaturation)}% saturación</span>
                    <span className="inline-flex items-center gap-1">{dragPreview.wouldOverload ? <><XCircle size={12} /> Excede Takt</> : dragPreview.previewSaturation > 90 ? <><AlertTriangle size={12} /> Alta carga</> : <><CheckCircle2 size={12} /> OK</>}</span>
                </div>
            )}

            {/* Task List */}
            <div className="flex flex-wrap gap-2 min-h-[40px]">
                {st.tasks.map(tid => {
                    const t = data.tasks.find(x => x.id === tid);
                    if (!t) return null;

                    return (
                        <DraggableStationTask
                            key={t.id}
                            t={t}
                            formatNumber={formatNumber}
                            onUnassignTask={onUnassignTask}
                        />
                    );
                })}
                {st.tasks.length === 0 && (
                    <div className="w-full text-center text-xs text-slate-300 border-2 border-dashed border-slate-100 rounded py-2">
                        Arrastrá tareas acá
                    </div>
                )}
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison to prevent unnecessary re-renders
    return (
        prevProps.st.id === nextProps.st.id &&
        prevProps.st.time === nextProps.st.time &&
        prevProps.st.limit === nextProps.st.limit &&
        prevProps.st.replicas === nextProps.st.replicas &&
        prevProps.st.oee === nextProps.st.oee &&
        prevProps.st.tasks.length === nextProps.st.tasks.length &&
        prevProps.st.tasks.every((t, i) => t === nextProps.st.tasks[i]) &&
        prevProps.data.tasks === nextProps.data.tasks &&
        prevProps.isOverload === nextProps.isOverload &&
        prevProps.draggedTask === nextProps.draggedTask &&
        prevProps.data.meta.useSectorOEE === nextProps.data.meta.useSectorOEE &&
        prevProps.data.meta.useManualOEE === nextProps.data.meta.useManualOEE &&
        prevProps.data.meta.capacityLimitMode === nextProps.data.meta.capacityLimitMode &&
        prevProps.effectiveSeconds === nextProps.effectiveSeconds &&
        prevProps.dragPreview?.stationId === nextProps.dragPreview?.stationId &&
        prevProps.dragPreview?.previewTime === nextProps.dragPreview?.previewTime
    );
});
StationCard.displayName = 'StationCard';
