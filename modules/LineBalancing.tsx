import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { ProjectData, Task } from '../types';
import { useLineBalancing } from '../hooks/useLineBalancing';
import { formatNumber } from '../utils';
import { BalancingChart } from './balancing/BalancingChart';
import { StationCard } from './balancing/components/StationCard';
import { UnassignedTaskList } from './balancing/components/UnassignedTaskList';
import { OptimizationResultsModal } from './balancing/components/OptimizationResultsModal';
import { BalancingMetrics } from './balancing/components/BalancingMetrics';
import { ZoningConstraintsModal } from './balancing/components/ZoningConstraintsModal';
import { Unlink, TrendingUp, X, ChevronDown, ChevronRight, Info, Plus, AlertTriangle, Minus, Layers } from 'lucide-react';
import { Tooltip } from '../components/ui/Tooltip';
import { AlertCenter, Alert } from '../components/ui/AlertCenter';
import { detectOverloadAndRecommend } from '../core/balancing/simulation';
import { buildCapacityPreviewHtml } from './balancing/balancingCapacityPreviewHtml';
import { exportBalancingCapacityExcel } from './balancing/balancingCapacityExcelExport';
import { renderHtmlToPdf } from '../utils/pdfRenderer';
import { getLogoBase64 } from '../src/assets/ppe/ppeBase64';
import { sanitizeFilename } from '../utils/filenameSanitization';
import { toast } from '../components/ui/Toast';
import { logger } from '../utils/logger';

const PdfPreviewModal = React.lazy(() => import('../components/modals/PdfPreviewModal'));

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
        showPriorityTable,
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
        machinesList,
        machineValidation,

        // Drag Preview
        dragOverStation,
        dragPreview,

        // Actions
        setConfigStationId,
        setStationOeeInput,
        setOptimizationResults,
        setShowPriorityTable,
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

    // Capacity Preview state
    const [showCapacityPreview, setShowCapacityPreview] = useState(false);
    const [capacityPreviewHtml, setCapacityPreviewHtml] = useState('');
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [isExportingExcel, setIsExportingExcel] = useState(false);

    // Zoning Constraints Modal State
    const [showZoningModal, setShowZoningModal] = useState(false);

    const handleShowCapacityPreview = useCallback(async () => {
        try {
            const logo = await getLogoBase64();
            const html = buildCapacityPreviewHtml(data, logo);
            setCapacityPreviewHtml(html);
            setShowCapacityPreview(true);
        } catch (err) {
            logger.error('LineBalancing', 'Capacity preview failed', { error: err instanceof Error ? err.message : String(err) });
            toast.error('Error de vista previa', err instanceof Error ? err.message : 'No se pudo generar la vista previa.');
        }
    }, [data]);

    const handleExportCapacityPdf = useCallback(async () => {
        // B8: Export mutex — prevent concurrent PDF + Excel export
        if (isExportingPdf || isExportingExcel) return;
        setIsExportingPdf(true);
        try {
            // B5: Sanitize filename
            const safeName = sanitizeFilename(data.meta.name || 'Capacidad');
            await renderHtmlToPdf(capacityPreviewHtml, {
                filename: `${safeName}_Capacidad_Proceso.pdf`,
                paperSize: 'a3',
                orientation: 'landscape',
            });
            toast.success('PDF exportado', 'Capacidad de proceso descargada correctamente.');
        } catch (err) {
            logger.error('LineBalancing', 'Capacity PDF export failed', { error: err instanceof Error ? err.message : String(err) });
            toast.error('Error de exportación', err instanceof Error ? err.message : 'No se pudo exportar el PDF.');
        } finally {
            setIsExportingPdf(false);
        }
    }, [capacityPreviewHtml, data.meta.name, isExportingPdf, isExportingExcel]);

    const handleExportCapacityExcel = useCallback(async () => {
        // B8: Export mutex — prevent concurrent PDF + Excel export
        if (isExportingPdf || isExportingExcel) return;
        setIsExportingExcel(true);
        try {
            await exportBalancingCapacityExcel(data);
            toast.success('Excel exportado', 'Capacidad de proceso descargada correctamente.');
        } catch (err) {
            logger.error('LineBalancing', 'Capacity Excel export failed', { error: err instanceof Error ? err.message : String(err) });
            toast.error('Error de exportación', err instanceof Error ? err.message : 'No se pudo exportar Excel.');
        } finally {
            setIsExportingExcel(false);
        }
    }, [data, isExportingPdf, isExportingExcel]);

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

    // Build alerts array for AlertCenter
    const balancingAlerts = useMemo<Alert[]>(() => {
        const alerts: Alert[] = [];

        // Alert 1: Overload (Critical)
        const overloadedStations = stationData.filter(st => st.time > st.limit);
        if (overloadedStations.length > 0) {
            alerts.push({
                id: 'overload',
                severity: 'critical',
                title: 'Sobrecarga Detectada',
                message: `${overloadedStations.length} ${overloadedStations.length === 1 ? 'estación excede' : 'estaciones exceden'} el Takt Time (${formatNumber(nominalSeconds)}s).`,
                details: (
                    <ul className="list-disc pl-4 space-y-1 font-medium">
                        {overloadedStations.map(st => {
                            const stationTasks = st.tasks
                                .map(tid => data.tasks.find(t => t.id === tid))
                                .filter(Boolean) as Task[];
                            const info = detectOverloadAndRecommend(
                                { effectiveTime: st.time, limit: st.limit, replicas: st.replicas, tasks: stationTasks },
                                nominalSeconds
                            );
                            const isMachine = info?.bottleneckType === 'machine';
                            return (
                                <li key={st.id}>
                                    Est. {st.id}: <strong>{formatNumber(st.time)}s</strong> vs <strong>{formatNumber(st.limit)}s</strong>
                                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${isMachine ? 'bg-purple-100 text-purple-900' : 'bg-red-100 text-red-900'}`}>
                                        {isMachine ? '🔧' : '👥'} {info?.recommendation}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )
            });
        }

        // Alert 2: Machine Deficit (Warning)
        if (machineValidation.hasDeficit) {
            const deficitMachines = machineValidation.machineBalance.filter(b => b.isDeficit);
            alerts.push({
                id: 'machine-deficit',
                severity: 'warning',
                title: '⚙️ Déficit de Máquinas',
                message: `No hay suficientes máquinas para ${deficitMachines.length} ${deficitMachines.length === 1 ? 'tipo de equipo' : 'tipos de equipos'}.`,
                details: (
                    <ul className="list-disc pl-4 space-y-1 font-medium">
                        {deficitMachines.map(b => (
                            <li key={b.machineId}>
                                <strong>{b.machineName}:</strong> Necesitas {b.consumed}, tienes {b.available}
                                <span className="ml-2 px-2 py-0.5 rounded text-xs font-bold bg-purple-200 text-purple-900">
                                    Faltan {Math.abs(b.balance)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )
            });
        }

        // Alert 3: Machine Conflicts (Warning)
        if (machineValidation.hasConflicts) {
            const conflictStations = machineValidation.stationRequirements.filter(r => r.hasConflict);
            alerts.push({
                id: 'machine-conflict',
                severity: 'warning',
                title: '⚠️ Conflicto de Máquinas',
                message: `${conflictStations.length} ${conflictStations.length === 1 ? 'estación tiene' : 'estaciones tienen'} tareas con máquinas incompatibles.`,
                details: (
                    <ul className="list-disc pl-4 space-y-1 font-medium">
                        {conflictStations.map(r => (
                            <li key={r.stationId}>
                                Estación {r.stationId}: {r.conflictMessage}
                            </li>
                        ))}
                    </ul>
                )
            });
        }

        // Alert 4: OEE Zone Warning (Nominal Mode)
        if (data.meta.capacityLimitMode === 'nominal' && stationData.length > 0) {
            const oeeLimit = effectiveSeconds;
            const oeeRiskStations = stationData.filter(st => st.time > oeeLimit && st.time <= st.limit);
            if (oeeRiskStations.length > 0) {
                alerts.push({
                    id: 'oee-zone-warning',
                    severity: 'warning',
                    title: '⚡ Modo Permisivo — Zona OEE',
                    message: `${oeeRiskStations.length} ${oeeRiskStations.length === 1 ? 'estación supera' : 'estaciones superan'} el límite OEE (${formatNumber(oeeLimit)}s) pero están dentro del Takt (${formatNumber(nominalSeconds)}s).`,
                    details: (
                        <div className="text-xs text-amber-800">
                            <p className="mb-1 font-medium">La producción depende de mantener un OEE real ≥ {(data.meta.manualOEE * 100).toFixed(0)}%.</p>
                            <ul className="list-disc pl-4 space-y-0.5">
                                {oeeRiskStations.map(st => (
                                    <li key={st.id}>Est. {st.id}: <strong>{formatNumber(st.time)}s</strong> (Límite OEE: {formatNumber(oeeLimit)}s)</li>
                                ))}
                            </ul>
                        </div>
                    )
                });
            }
        }

        return alerts;
    }, [stationData, nominalSeconds, effectiveSeconds, machineValidation, data.tasks, data.meta.capacityLimitMode, data.meta.manualOEE]);

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
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
                        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border-2 border-amber-100">
                            <div className="bg-amber-50 px-6 py-4 border-b border-amber-100 flex items-center gap-3">
                                <div className="bg-amber-100 p-2 rounded-full">
                                    <Unlink size={24} className="text-amber-600" />
                                </div>
                                <h3 className="font-bold text-amber-900 text-lg">Vínculo de Concurrencia Roto</h3>
                            </div>
                            <div className="p-6">
                                <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                                    Estás separando la tarea <strong>{warningState.taskDesc}</strong> de su par <strong>{warningState.linkedTaskDesc}</strong>.
                                </p>
                                <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-center gap-3 mb-6">
                                    <div className="bg-white p-1.5 rounded-md shadow-sm border border-red-100">
                                        <TrendingUp size={20} className="text-red-500" />
                                    </div>
                                    <div>
                                        <span className="block text-xs font-bold text-red-800 uppercase tracking-wide">Impacto en Ciclo</span>
                                        <span className="text-lg font-black text-red-600">+{formatNumber(warningState.timePenalty)} seg</span>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 italic text-center">
                                    El tiempo "absorbido" se convertirá en tiempo real penalizando la eficiencia.
                                </p>
                            </div>
                            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
                                <button onClick={warningState.onCancel} className="px-4 py-2 text-slate-600 hover:bg-white hover:shadow-sm rounded-lg font-medium text-sm transition-all border border-transparent hover:border-slate-200">
                                    Cancelar
                                </button>
                                <button onClick={warningState.onConfirm} className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-md hover:shadow-lg font-bold text-sm transition-all transform active:scale-95">
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
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in zoom-in duration-200" onClick={cancelClearBalance}>
                        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border-2 border-red-100" onClick={e => e.stopPropagation()}>
                            <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center gap-3">
                                <div className="bg-red-100 p-2 rounded-full">
                                    <AlertTriangle size={24} className="text-red-600" />
                                </div>
                                <h3 className="font-bold text-red-900 text-lg">¿Limpiar Todo el Balance?</h3>
                            </div>
                            <div className="p-6">
                                <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                                    Esta acción eliminará <strong>todas las asignaciones</strong> de tareas a estaciones y reseteará el conteo de estaciones a 0.
                                </p>
                                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-center gap-3">
                                    <div className="bg-white p-1.5 rounded-md shadow-sm border border-amber-100">
                                        <Info size={20} className="text-amber-500" />
                                    </div>
                                    <div className="text-xs text-amber-800">
                                        <strong>Tip:</strong> Esta acción no se puede deshacer. Las tareas volverán a la lista "Sin Asignar".
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
                                <button onClick={cancelClearBalance} className="px-4 py-2 text-slate-600 hover:bg-white hover:shadow-sm rounded-lg font-medium text-sm transition-all border border-transparent hover:border-slate-200">
                                    Cancelar
                                </button>
                                <button onClick={confirmClearBalance} className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-md hover:shadow-lg font-bold text-sm transition-all transform active:scale-95">
                                    Sí, Limpiar Todo
                                </button>
                            </div>
                        </div>
                    </div>
                )}


                {/* CONFIG MODAL */}
                {
                    configStationId !== null && (
                        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in zoom-in duration-200" onClick={() => setConfigStationId(null)}>
                            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden" onClick={e => e.stopPropagation()}>
                                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
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
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-center text-lg"
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
                                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 font-bold shadow-md hover:shadow-lg transition-all"
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
                    onShowCapacityPreview={handleShowCapacityPreview}
                />

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Unassigned List */}
                    <div className="lg:col-span-1">
                        <UnassignedTaskList
                            unassignedTasks={unassignedTasks}
                            sectorsList={sectorsList}
                            performAssignment={performAssignment}
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
                            const hasHighSaturation = avgSaturation > 0.90;
                            const hasOverload = stationsInSector.some(st => st.time > st.limit);

                            return (
                                <div
                                    key={sector.id}
                                    className={`mb-6 rounded-xl border-2 p-4 transition-all ${hasOverload
                                        ? 'border-red-300 bg-red-50/30'
                                        : hasHighSaturation
                                            ? 'border-amber-300 bg-amber-50/30'
                                            : 'border-slate-200 bg-slate-50/30'
                                        }`}
                                    style={{ borderLeftWidth: 6, borderLeftColor: sector.color }}
                                >
                                    {/* Sector Header con Alerta Visual */}
                                    <div
                                        className="flex items-center gap-3 mb-3 pb-2 border-b border-slate-200 cursor-pointer hover:bg-white/50 p-2 rounded-lg transition-all"
                                        onClick={() => toggleBoardSectorCollapse(sector.id)}
                                    >
                                        <button className="text-slate-400 hover:text-slate-600">
                                            {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                        </button>
                                        <div
                                            className="w-4 h-4 rounded-full shadow-md ring-2 ring-white"
                                            style={{ backgroundColor: sector.color }}
                                        />
                                        <h3 className="font-black text-slate-700 text-base uppercase tracking-wide">{sector.name}</h3>

                                        {/* Badge de cantidad de estaciones */}
                                        <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                                            {stationsInSector.length} {stationsInSector.length === 1 ? 'estación' : 'estaciones'}
                                        </span>

                                        {/* Alerta de Saturación Alta */}
                                        {hasHighSaturation && !hasOverload && (
                                            <span
                                                className="flex items-center gap-1 text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-lg border border-amber-300"
                                                title="⚠️ Riesgo por Variabilidad: Saturación promedio >90%. Se recomienda buffer intermedio o reducir carga."
                                            >
                                                <AlertTriangle size={12} />
                                                Saturación Alta ({formatNumber(avgSaturation * 100)}%)
                                            </span>
                                        )}

                                        {/* Alerta de Sobrecarga */}
                                        {hasOverload && (
                                            <span
                                                className="flex items-center gap-1 text-xs font-bold bg-red-100 text-red-700 px-2 py-1 rounded-lg border border-red-300 animate-pulse"
                                                title="❌ SOBRECARGA: Una o más estaciones exceden el Takt Time. El balanceo NO es factible."
                                            >
                                                <AlertTriangle size={12} />
                                                SOBRECARGA
                                            </span>
                                        )}

                                        {data.meta.useSectorOEE && sector.id !== 'general' && (
                                            <span className="ml-auto text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100 font-mono">
                                                OEE: {formatNumber((sector.targetOee || data.meta.manualOEE) * 100)}%
                                            </span>
                                        )}
                                    </div>

                                    {/* Stations Grid dentro del contenedor */}
                                    {!isCollapsed && (
                                        <div className="space-y-4 pl-2">
                                            {stationsInSector.map(st => {
                                                const isOverload = st.time > st.limit;
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
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow transition-colors font-bold mt-4"
                        >
                            <Plus size={20} /> Agregar Nueva Estación
                        </button>
                    </div>
                </div>
            </div >

            {/* Capacity Preview Modal */}
            {showCapacityPreview && (
                <React.Suspense fallback={null}>
                    <PdfPreviewModal
                        html={capacityPreviewHtml}
                        onExport={handleExportCapacityPdf}
                        onClose={() => { if (!isExportingPdf && !isExportingExcel) setShowCapacityPreview(false); }}
                        isExporting={isExportingPdf}
                        onExportExcel={handleExportCapacityExcel}
                        isExportingExcel={isExportingExcel}
                        title="Capacidad de Producción por Proceso"
                        subtitle={data.meta.name}
                        maxWidth="420mm"
                        themeColor="navy"
                    />
                </React.Suspense>
            )}

        </DndContext >
    );
};
