import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { ProjectData, Task } from '../../types';
import { useLineBalancing } from '../../hooks/useLineBalancing';
import { useBalancingAlerts } from '../../hooks/useBalancingAlerts';
import { formatNumber } from '../../utils';
import { BalancingChart } from './BalancingChart';
import { StationCard } from './components/StationCard';
import { UnassignedTaskList } from './components/UnassignedTaskList';
import { OptimizationResultsModal } from './components/OptimizationResultsModal';
import { BalancingMetrics } from './components/BalancingMetrics';
import { ZoningConstraintsModal } from './components/ZoningConstraintsModal';
import { Unlink, TrendingUp, X, ChevronDown, ChevronRight, Info, Plus, AlertTriangle, Minus } from 'lucide-react';
import { Tooltip } from '../../components/ui/Tooltip';
import { AlertCenter } from '../../components/ui/AlertCenter';
import { buildGate3FromProjectData } from '../gate3/gate3FromBalancing';
import { toast } from '../../components/ui/Toast';
import { logger } from '../../utils/logger';
import { SATURATION_WARN } from './balancingConstants';
import { isStationOverloaded } from './balancingHelpers';

interface Props {
    data: ProjectData;
    updateData: (data: ProjectData) => void;
}

export const LineBalancing: React.FC<Props> = ({ data, updateData }) => {
    const {
        // State
        draggedTask,
        configStationId,
        stationOeeInput,
        optimizationResults,
        // showPriorityTable (unused),
        warningState,
        collapsedBoardSectors,
        showClearBalanceConfirm,

        // Data
        nominalSeconds,
        effectiveSeconds,
        configuredStations,
        stationData,
        saturationData,
        yAxisDomainMax,
        unassignedTasks,
        totalHeadcount,
        efficiency,
        efficiencyLine,
        saturationVsTakt,
        realCycleTime,
        machineCycleTime,
        totalManualWork,
        totalIdleTimePerCycle,
        dailyLostHours,
        sectorsList,
        // machinesList (unused),
        machineValidation,

        // Drag Preview
        // dragOverStation (unused),
        dragPreview,

        // Actions
        setConfigStationId,
        setStationOeeInput,
        setOptimizationResults,
        // setShowPriorityTable (unused),
        openStationConfig,
        saveStationConfig,
        updateStationReplicas,
        setStationCount,
        addStation,
        removeEmptyStation,
        emptyStationIds,
        unassignTask,
        clearBalance,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleOptimization,
        applySimulation,
        toggleBoardSectorCollapse,
        performAssignment,
        performBulkAssignment,
        confirmClearBalance,
        cancelClearBalance
    } = useLineBalancing(data, updateData);

    // Close modals on Escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            if (showClearBalanceConfirm) cancelClearBalance();
            else if (configStationId !== null) setConfigStationId(null);
        };
        if (showClearBalanceConfirm || configStationId !== null) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [showClearBalanceConfirm, cancelClearBalance, configStationId, setConfigStationId]);

    // Stable sensor config - avoids recreation on each render
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 }
        })
    );

    const [isExportingExcel, setIsExportingExcel] = useState(false);

    // Zoning Constraints Modal State
    const [showZoningModal, setShowZoningModal] = useState(false);

    const handleExportCapacityExcel = useCallback(async () => {
        if (isExportingExcel) return;
        setIsExportingExcel(true);
        try {
            // Descarga directo el Excel en formato VW (template oficial Gate 3 clonado)
            // Lazy-load xlsx-populate para no inflar el chunk principal
            const { exportGate3Excel } = await import('../gate3/gate3ExcelExport');
            const project = buildGate3FromProjectData(data);
            await exportGate3Excel(project);
            toast.success('Excel exportado', 'Capacidad VW (Gate 3) descargada correctamente.');
        } catch (err) {
            logger.error('LineBalancing', 'Capacity Excel export failed', { error: err instanceof Error ? err.message : String(err) });
            toast.error('Error de exportación', err instanceof Error ? err.message : 'No se pudo exportar Excel.');
        } finally {
            setIsExportingExcel(false);
        }
    }, [data, isExportingExcel]);

    // Mejora 2: Memoize config station lookup to avoid repeated .find() in modal
    const configStation = useMemo(
        () => stationData.find(s => s.id === configStationId),
        [stationData, configStationId]
    );

    // Memoized grouping of stations by sector
    const stationsBySector = useMemo(() => {
        const grouped: Record<string, typeof stationData> = {};
        sectorsList.forEach(s => grouped[s.id] = []);
        grouped['general'] = [];
        stationData.forEach(st => {
            const key = st.sectorId && grouped[st.sectorId] ? st.sectorId : 'general';
            grouped[key].push(st);
        });
        return grouped;
    }, [stationData, sectorsList]);

    // Alerts derived from balancing state (overload / machine deficit / OEE zone).
    // Logic lives in useBalancingAlerts to keep this container slim.
    const balancingAlerts = useBalancingAlerts({
        stationData,
        machineValidation,
        nominalSeconds,
        effectiveSeconds,
        tasks: data.tasks,
        capacityLimitMode: data.meta.capacityLimitMode,
        manualOEE: data.meta.manualOEE,
    });

    const metricsStationData = useMemo(() => {
        const tMap = new Map(data.tasks.map(t => [t.id, t]));
        return stationData.map(st => ({
            id: st.id,
            tasks: st.tasks.map(tid => tMap.get(tid)).filter(Boolean) as Task[],
            effectiveTime: st.time,
            limit: st.limit,
            replicas: st.replicas,
            sectorId: st.sectorId,
        }));
    }, [stationData, data.tasks]);

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="space-y-6 relative">

                {/* Consolidated AlertCenter */}
                <AlertCenter alerts={balancingAlerts} maxVisible={1} />

                {/* ERROR / WARNING MODAL (Concurrency) */}

                {warningState && (
                    <div className="fixed inset-0 bg-black/50 z-modal-backdrop flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
                        <div className="bg-white rounded-md shadow-xl max-w-md w-full overflow-hidden border border-industrial-200">
                            <div className="bg-industrial-50 border-l-4 border-l-status-warn px-6 py-4 border-b border-industrial-200 flex items-center gap-3">
                                <div className="bg-amber-100 p-2 rounded-sm">
                                    <Unlink size={24} className="text-amber-600" />
                                </div>
                                <h3 className="font-bold text-amber-900 text-lg">Vínculo de Concurrencia Roto</h3>
                            </div>
                            <div className="p-6">
                                <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                                    Estás separando la tarea <strong>{warningState.taskDesc}</strong> de su par <strong>{warningState.linkedTaskDesc}</strong>.
                                </p>
                                <div className="bg-red-50 border border-red-100 rounded-md p-3 flex items-center gap-3 mb-6">
                                    <div className="bg-white p-1.5 rounded-sm shadow-sm border border-red-100">
                                        <TrendingUp size={20} className="text-red-500" />
                                    </div>
                                    <div>
                                        <span className="block text-xs font-bold text-red-800 uppercase tracking-wide">Impacto en Ciclo</span>
                                        <span className="text-lg font-bold text-red-600">+{formatNumber(warningState.timePenalty)} seg</span>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 italic text-center">
                                    El tiempo &ldquo;absorbido&rdquo; se convertirá en tiempo real penalizando la eficiencia.
                                </p>
                            </div>
                            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
                                <button onClick={warningState.onCancel} className="px-4 py-2 text-slate-600 hover:bg-white hover:shadow-sm rounded-md font-medium text-sm transition-all border border-transparent hover:border-slate-200">
                                    Cancelar
                                </button>
                                <button onClick={warningState.onConfirm} className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md shadow-md hover:shadow-lg font-bold text-sm transition-all transform active:scale-95">
                                    Confirmar Movimiento
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* NEW: OPTIMIZATION RESULTS MODAL */}
                <OptimizationResultsModal
                    results={optimizationResults}
                    onClose={() => setOptimizationResults(null)}
                    onApply={applySimulation}
                />

                {/* ZONING CONSTRAINTS MODAL */}
                <ZoningConstraintsModal
                    isOpen={showZoningModal}
                    onClose={() => setShowZoningModal(false)}
                    data={data}
                    updateData={updateData}
                />

                {/* CLEAR BALANCE CONFIRMATION MODAL */}
                {showClearBalanceConfirm && (
                    <div className="fixed inset-0 bg-black/50 z-modal-backdrop flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200" onClick={cancelClearBalance}>
                        <div className="bg-white rounded-md shadow-xl max-w-md w-full overflow-hidden border border-industrial-200" onClick={e => e.stopPropagation()}>
                            <div className="bg-industrial-50 border-l-4 border-l-status-crit px-6 py-4 border-b border-industrial-200 flex items-center gap-3">
                                <div className="bg-red-100 p-2 rounded-sm">
                                    <AlertTriangle size={24} className="text-red-600" />
                                </div>
                                <h3 className="font-bold text-red-900 text-lg">¿Limpiar Todo el Balance?</h3>
                            </div>
                            <div className="p-6">
                                <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                                    Esta acción eliminará <strong>todas las asignaciones</strong> de tareas a estaciones y reseteará el conteo de estaciones a 0.
                                </p>
                                <div className="bg-amber-50 border border-amber-100 rounded-md p-3 flex items-center gap-3">
                                    <div className="bg-white p-1.5 rounded-sm shadow-sm border border-amber-100">
                                        <Info size={20} className="text-amber-500" />
                                    </div>
                                    <div className="text-xs text-amber-800">
                                        <strong>Tip:</strong> Esta acción no se puede deshacer. Las tareas volverán a la lista &ldquo;Sin Asignar&rdquo;.
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
                                <button onClick={cancelClearBalance} className="px-4 py-2 text-slate-600 hover:bg-white hover:shadow-sm rounded-md font-medium text-sm transition-all border border-transparent hover:border-slate-200">
                                    Cancelar
                                </button>
                                <button onClick={confirmClearBalance} className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md shadow-md hover:shadow-lg font-bold text-sm transition-all transform active:scale-95">
                                    Sí, Limpiar Todo
                                </button>
                            </div>
                        </div>
                    </div>
                )}


                {/* CONFIG MODAL */}
                {
                    configStationId !== null && (
                        <div className="fixed inset-0 bg-black/50 z-modal-backdrop flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200" onClick={() => setConfigStationId(null)}>
                            <div className="bg-white rounded-md shadow-xl max-w-sm w-full overflow-hidden border border-industrial-200" onClick={e => e.stopPropagation()}>
                                <div className="bg-industrial-50 border-l-4 border-l-accent px-6 py-4 border-b border-industrial-200 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-800">Configurar Estación {configStationId}</h3>
                                    <button onClick={() => setConfigStationId(null)} className="text-slate-400 hover:text-red-500 transition-colors" aria-label="Cerrar">
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">OEE Objetivo (0-1.0)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="1"
                                            value={stationOeeInput}
                                            onChange={(e) => setStationOeeInput(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-center text-lg"
                                            autoFocus
                                        />
                                        <p className="text-xs text-slate-400 mt-2">
                                            Define la eficiencia esperada específica para esta estación.
                                        </p>
                                    </div>

                                    {/* MULTI-MANNING CONTROL (REPLICAS) */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                            Operarios en Paralelo (Réplicas)
                                            <Tooltip content="Número de personas asignadas a una misma estación/máquina para dividir la carga manual (Multi-Manning) y ajustarse al TCR de la máquina." />
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => {
                                                    if (configStation && configStation.replicas > 1) {
                                                        updateStationReplicas(configStationId!, -1);
                                                    }
                                                }}
                                                className="p-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                                            >
                                                <Minus size={18} />
                                            </button>
                                            <div className="flex-1 text-center font-bold text-2xl text-indigo-600">
                                                {configStation?.replicas || 1}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (configStation) {
                                                        updateStationReplicas(configStationId!, 1);
                                                    }
                                                }}
                                                className="p-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                                            >
                                                <Plus size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
                                    <button onClick={() => setConfigStationId(null)} className="text-slate-500 hover:bg-slate-100 px-4 py-2 rounded">Cancelar</button>
                                    <button
                                        onClick={saveStationConfig}
                                        className="bg-accent hover:bg-blue-800 text-white rounded-md px-4 py-2 font-bold shadow-md hover:shadow-lg transition-all"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                {/* METRICS BAR */}
                <BalancingMetrics
                    configuredStations={configuredStations}
                    totalHeadcount={totalHeadcount}
                    efficiency={efficiency}
                    efficiencyLine={efficiencyLine}
                    saturationVsTakt={saturationVsTakt}
                    realCycleTime={realCycleTime}
                    machineCycleTime={machineCycleTime}
                    totalIdleTimePerCycle={totalIdleTimePerCycle}
                    dailyLostHours={dailyLostHours}
                    setStationCount={setStationCount}
                    addStation={addStation}
                    removeEmptyStation={removeEmptyStation}
                    emptyStationIds={emptyStationIds}
                    clearBalance={clearBalance}
                    handleOptimization={handleOptimization}
                    // Phase 5: SALBP mode props
                    balancingMode={data.meta.balancingMode || 'SALBP1'}
                    targetOperators={data.meta.targetOperators || 8}
                    onModeChange={(mode) => updateData({
                        ...data,
                        meta: { ...data.meta, balancingMode: mode }
                    })}
                    onTargetOperatorsChange={(n) => updateData({
                        ...data,
                        meta: { ...data.meta, targetOperators: n }
                    })}
                    balancingObjective={data.meta.balancingObjective || 'MAX_THROUGHPUT'}
                    onObjectiveChange={(obj) => updateData({
                        ...data,
                        meta: { ...data.meta, balancingObjective: obj }
                    })}
                    // Phase 28: Crystal Box + Plan vs Real props
                    nominalTaktTime={nominalSeconds}
                    totalWorkContent={totalManualWork}
                    dailyAvailableTime={nominalSeconds * data.meta.dailyDemand}
                    dailyDemand={data.meta.dailyDemand}
                    stationData={metricsStationData}
                    onOpenZoningConstraints={() => setShowZoningModal(true)}
                    zoningConstraintsCount={(data.zoningConstraints || []).length}
                />

                {/* CHART: SATURATION */}
                <BalancingChart
                    saturationData={saturationData}
                    nominalSeconds={nominalSeconds}
                    effectiveSeconds={effectiveSeconds}
                    yAxisDomainMax={yAxisDomainMax}
                    data={data}
                    onExportCapacityExcel={handleExportCapacityExcel}
                    isExportingExcel={isExportingExcel}
                />

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Unassigned List */}
                    <div className="lg:col-span-1">
                        <UnassignedTaskList
                            unassignedTasks={unassignedTasks}
                            sectorsList={sectorsList}
                            performAssignment={performAssignment}
                            performBulkAssignment={performBulkAssignment}
                        />
                    </div>

                    {/* Workstations - GROUPED BY SECTOR */}
                    <div className="lg:col-span-3 space-y-4 h-[calc(100vh-450px)] overflow-y-auto pr-2 pb-20">
                        {[...sectorsList, { id: 'general', name: 'General / Sin Sector', color: '#64748b' }].map(sector => {
                            const stationsInSector = stationsBySector[sector.id];
                            if (!stationsInSector || stationsInSector.length === 0) return null;

                            const isCollapsed = collapsedBoardSectors.has(sector.id);

                            // Calcular saturación promedio del sector para mostrar alerta
                            const avgSaturation = stationsInSector.reduce((sum, st) => sum + (st.time / st.limit), 0) / stationsInSector.length;
                            const hasHighSaturation = avgSaturation > SATURATION_WARN;
                            const hasOverload = stationsInSector.some(isStationOverloaded);

                            return (
                                <div
                                    key={sector.id}
                                    className={`mb-6 rounded-md border p-4 transition-all ${hasOverload
                                        ? 'border-red-300 bg-red-50/30'
                                        : hasHighSaturation
                                            ? 'border-amber-300 bg-amber-50/30'
                                            : 'border-slate-200 bg-slate-50/30'
                                        }`}
                                    style={{ borderLeftWidth: 6, borderLeftColor: sector.color }}
                                >
                                    {/* Sector Header con Alerta Visual */}
                                    <div
                                        className="flex items-center gap-3 mb-3 pb-2 border-b border-slate-200 cursor-pointer hover:bg-white/50 p-2 rounded-md transition-all"
                                        onClick={() => toggleBoardSectorCollapse(sector.id)}
                                    >
                                        <button className="text-slate-400 hover:text-slate-600" title="Alternar sección">
                                            {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                        </button>
                                        <div
                                            className="w-4 h-4 rounded-sm shadow-md ring-2 ring-white"
                                            style={{ backgroundColor: sector.color }}
                                        />
                                        <h3 className="font-bold text-slate-700 text-base uppercase tracking-wide">{sector.name}</h3>

                                        {/* Badge de cantidad de estaciones */}
                                        <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md">
                                            {stationsInSector.length} {stationsInSector.length === 1 ? 'estación' : 'estaciones'}
                                        </span>

                                        {/* Alerta de Saturación Alta */}
                                        {hasHighSaturation && !hasOverload && (
                                            <span
                                                className="flex items-center gap-1 text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-md border border-amber-300"
                                                title="⚠️ Riesgo por Variabilidad: Saturación promedio >90%. Se recomienda buffer intermedio o reducir carga."
                                            >
                                                <AlertTriangle size={12} />
                                                Saturación Alta ({formatNumber(avgSaturation * 100)}%)
                                            </span>
                                        )}

                                        {/* Alerta de Sobrecarga */}
                                        {hasOverload && (
                                            <span
                                                className="flex items-center gap-1 text-xs font-bold bg-red-100 text-red-700 px-2 py-1 rounded-md border border-red-300"
                                                title="❌ SOBRECARGA: Una o más estaciones exceden el Takt Time. El balanceo NO es factible."
                                            >
                                                <AlertTriangle size={12} />
                                                SOBRECARGA
                                            </span>
                                        )}

                                        {data.meta.useSectorOEE && sector.id !== 'general' && (
                                            <span className="ml-auto text-xs bg-industrial-50 text-industrial-500 px-1.5 py-0.5 rounded border border-industrial-200 font-mono">
                                                OEE: {formatNumber((sector.targetOee || data.meta.manualOEE) * 100)}%
                                            </span>
                                        )}
                                    </div>

                                    {/* Stations Grid dentro del contenedor */}
                                    {!isCollapsed && (
                                        <div className="space-y-4 pl-2">
                                            {stationsInSector.map(st => {
                                                const isOverload = isStationOverloaded(st);
                                                return (
                                                    <StationCard
                                                        key={st.id}
                                                        st={st}
                                                        sectorsList={sectorsList}
                                                        draggedTask={draggedTask}
                                                        isOverload={isOverload}
                                                        data={data}
                                                        effectiveSeconds={effectiveSeconds}
                                                        onUpdateReplicas={updateStationReplicas}
                                                        onOpenConfig={openStationConfig}
                                                        onUnassignTask={unassignTask}
                                                        dragPreview={dragPreview?.stationId === st.id ? dragPreview : null}
                                                    />
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        <button
                            onClick={addStation}
                            className="flex items-center gap-2 bg-accent hover:bg-blue-800 text-white rounded-md px-4 py-2 text-sm font-medium shadow transition-colors mt-4"
                        >
                            <Plus size={20} /> Agregar Nueva Estación
                        </button>
                    </div>
                </div>
            </div >

        </DndContext >
    );
};
