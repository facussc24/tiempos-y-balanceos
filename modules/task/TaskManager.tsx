import React from 'react';
import { Layers, Plus, AlertTriangle, ListTodo, Link2, ChevronDown, GitBranch } from 'lucide-react';
import { ProjectData } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState, EMPTY_STATE_PRESETS } from '../../components/ui/EmptyState';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { CavityCalculator } from '../CavityCalculator';
import { ManualCapacityCalculator } from '../ManualCapacityCalculator';

// New Modular Imports
import { useTaskManager } from '../../hooks/useTaskManager';
import { TaskTable } from './TaskTable';
import { SectorManagementModal } from './modals/SectorManagementModal';
import { PasteModal } from './modals/PasteModal';
import { DocumentationModal } from './modals/DocumentationModal';
import { CreateVariantModal } from './modals/CreateVariantModal'; // V9.0: Product Inheritance
import { ZoningConstraintsModal } from '../balancing/components/ZoningConstraintsModal'; // FIX 3
import { usePlantAssets } from '../../hooks/usePlantAssets'; // V4.0 Asset Registry
import { logger } from '../../utils/logger';

interface Props {
    data: ProjectData;
    updateData: (data: ProjectData) => void;
    rootHandle: FileSystemDirectoryHandle | string | null; // Handle for Web, string path for Tauri
}

export const TaskManager: React.FC<Props> = ({ data, updateData, rootHandle }) => {
    // Logic extracted to hook
    const {
        // State
        calcTask, setCalcTask,
        docTask, setDocTask,
        isPasteModalOpen, setIsPasteModalOpen,
        pasteTargetTaskId, // setPasteTargetTaskId (unused)
        isSectorModalOpen, setIsSectorModalOpen,
        newTaskID, setNewTaskID,
        newTaskDesc, setNewTaskDesc,
        newTaskSectorId, setNewTaskSectorId,
        collapsedSectors,
        sectorBulkInputs,
        cycleError,

        // Actions
        addTask, removeTask, updateTime, addSamples, removeSample, toggleIgnored,
        updateFairTimeParams, updateManualStdDev, handleDependencyChange, sortByWeight,
        toggleSectorCollapse, handleTaskSectorChange, handleTaskMachineChange, handleBulkSectorInput, applyBulkSectorQuantity,
        openPasteModal, openDocModal, handleModeChange, handleConcurrentChange,
        applyInjectionParams, applyManualParams,
        toggleTaskModelApplicability
    } = useTaskManager(data, updateData);

    // V4.0: Load Global Machines for selection
    const { machines: globalMachines } = usePlantAssets();

    // V9.0: Variant Creation Modal state
    const [isVariantModalOpen, setIsVariantModalOpen] = React.useState(false);
    const [isCreatingVariant, setIsCreatingVariant] = React.useState(false);

    // FIX 3: Zoning Constraints Modal state
    const [isZoningModalOpen, setIsZoningModalOpen] = React.useState(false);

    // Actions dropdown state
    const [showActionsMenu, setShowActionsMenu] = React.useState(false);
    const actionsMenuRef = React.useRef<HTMLDivElement>(null);

    // Close actions menu on click outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
                setShowActionsMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Task deletion confirmation
    const [pendingDeleteTaskId, setPendingDeleteTaskId] = React.useState<string | null>(null);
    const pendingDeleteTask = pendingDeleteTaskId ? data.tasks.find(t => t.id === pendingDeleteTaskId) : null;

    // Mejora 2: Ref para focus en input ID
    const newTaskIdRef = React.useRef<HTMLInputElement>(null);

    // Visual validation: detect duplicate task ID
    const isDuplicateTaskId = newTaskID.trim() !== '' && data.tasks.some(t => t.id === newTaskID);



    // V9.0: Handler for creating a variant
    // Web build: variant creation via filesystem write is disabled. The Mix /
    // Family module handles variant creation via Supabase repositories.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleCreateVariant = async (_variantName: string, _parentRelPath: string): Promise<boolean> => {
        if (isCreatingVariant) return false;
        logger.warn('TaskManager', 'Variant creation via filesystem is disabled in web mode');
        return false;
    };


    try {
        return (
            <div className="space-y-6 relative">
                {/* SECTOR MANAGEMENT MODAL */}
                <SectorManagementModal
                    isOpen={isSectorModalOpen}
                    onClose={() => setIsSectorModalOpen(false)}
                    data={data}
                    updateData={updateData}
                />

                {/* CAVITY / INJECTION CALCULATOR MODAL */}
                {calcTask && calcTask.executionMode === 'injection' && (
                    <CavityCalculator
                        task={calcTask}
                        projectTasks={data.tasks}
                        shifts={data.shifts}
                        dailyDemand={data.meta.dailyDemand}
                        activeShifts={data.meta.activeShifts}
                        oee={data.meta.manualOEE}
                        setupLossPercent={data.meta.setupLossPercent || 0}
                        onClose={() => setCalcTask(null)}
                        onApply={applyInjectionParams}
                    />
                )}

                {calcTask && calcTask.executionMode !== 'injection' && (
                    <ManualCapacityCalculator
                        task={calcTask}
                        shifts={data.shifts}
                        dailyDemand={data.meta.dailyDemand}
                        activeShifts={data.meta.activeShifts}
                        oee={data.meta.manualOEE}
                        setupLossPercent={data.meta.setupLossPercent || 0}
                        onClose={() => setCalcTask(null)}
                        onApply={applyManualParams}
                    />
                )}

                {/* PASTE MODAL */}
                <PasteModal
                    isOpen={isPasteModalOpen}
                    onClose={() => setIsPasteModalOpen(false)}
                    targetTaskId={pasteTargetTaskId}
                    data={data}
                    updateData={updateData}
                />

                {/* DOC MODAL */}
                <DocumentationModal
                    task={docTask}
                    onClose={() => setDocTask(null)}
                    data={data}
                    updateData={updateData}
                    rootHandle={rootHandle}
                />

                {/* V9.0: CREATE VARIANT MODAL */}
                <CreateVariantModal
                    isOpen={isVariantModalOpen}
                    onClose={() => setIsVariantModalOpen(false)}
                    currentProject={data}
                    onCreateVariant={handleCreateVariant}
                />

                {/* FIX 3: ZONING CONSTRAINTS MODAL */}
                <ZoningConstraintsModal
                    isOpen={isZoningModalOpen}
                    onClose={() => setIsZoningModalOpen(false)}
                    data={data}
                    updateData={updateData}
                />

                {/* Task Deletion Confirmation */}
                <ConfirmModal
                    isOpen={!!pendingDeleteTaskId}
                    onClose={() => setPendingDeleteTaskId(null)}
                    onConfirm={() => {
                        if (pendingDeleteTaskId) {
                            removeTask(pendingDeleteTaskId);
                            setPendingDeleteTaskId(null);
                        }
                    }}
                    title="Eliminar Tarea"
                    message={`¿Eliminar la tarea "${pendingDeleteTaskId}"${pendingDeleteTask?.description ? ` (${pendingDeleteTask.description})` : ''}?\n\nEsto también eliminará sus asignaciones y referencias.`}
                    confirmText="Eliminar"
                    variant="danger"
                />

                {/* Task List Table Component */}
                <Card title="Gestión de Tareas y Tiempos" actions={
                    <div className="flex gap-2 items-center">
                        <Button variant="secondary" size="sm" onClick={sortByWeight}>
                            Ordenar por Prioridad
                        </Button>
                        <div ref={actionsMenuRef} className="relative">
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={<ChevronDown size={14} />}
                                iconPosition="right"
                                onClick={() => setShowActionsMenu(!showActionsMenu)}
                            >
                                Más acciones
                            </Button>
                            {showActionsMenu && (
                                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[220px] z-50">
                                    <button
                                        onClick={() => { setIsSectorModalOpen(true); setShowActionsMenu(false); }}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 text-left transition-colors"
                                    >
                                        <Layers size={14} /> Gestionar Sectores
                                    </button>
                                    <button
                                        onClick={() => { setIsZoningModalOpen(true); setShowActionsMenu(false); }}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 text-left transition-colors"
                                    >
                                        <Link2 size={14} />
                                        Restricciones
                                        {(data.zoningConstraints?.length || 0) > 0 && (
                                            <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-auto">
                                                {data.zoningConstraints?.length}
                                            </span>
                                        )}
                                    </button>
                                    {data.tasks.length > 0 && (
                                        <button
                                            onClick={() => { setIsVariantModalOpen(true); setShowActionsMenu(false); }}
                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 text-left transition-colors"
                                        >
                                            <GitBranch size={14} /> Crear Variante
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                }>
                    {cycleError && (
                        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={20} />
                                <strong>Error Crítico:</strong> Dependencia Circular detectada.
                            </div>
                            <div className="text-xs font-mono ml-7">
                                {cycleError.map((cycle, i) => (
                                    <div key={i}>Ciclo: {cycle.join(' → ')}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty State when no tasks */}
                    {data.tasks.length === 0 && (
                        <div className="py-4">
                            <EmptyState
                                icon={ListTodo}
                                title={EMPTY_STATE_PRESETS.noTasks.title}
                                description={EMPTY_STATE_PRESETS.noTasks.description}
                                size="compact"
                                actions={[
                                    {
                                        label: 'Ingresar Primera Tarea',
                                        onClick: () => newTaskIdRef.current?.focus(),
                                        icon: Plus,
                                        variant: 'primary'
                                    }
                                ]}
                            />
                        </div>
                    )}

                    {/* ELEGANT TASK CREATION UI (Consistent with Dashboard) */}
                    <div className="mb-6 flex flex-col md:flex-row gap-4 items-end bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative z-10">
                        {/* Badge Label */}
                        <div className="absolute -top-3 left-4 bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                            Nueva Tarea
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">ID</label>
                            <input
                                ref={newTaskIdRef}
                                value={newTaskID}
                                onChange={e => setNewTaskID(e.target.value.toUpperCase())}
                                aria-invalid={isDuplicateTaskId}
                                className={`border p-2.5 w-32 bg-white font-mono font-bold rounded-lg focus:ring-2 transition-all placeholder:text-slate-400 ${
                                    isDuplicateTaskId
                                        ? 'border-red-400 text-red-700 focus:ring-red-500/20 focus:border-red-500'
                                        : 'border-slate-300 text-slate-900 focus:ring-blue-500 focus:border-blue-500'
                                }`}
                                placeholder="A1"
                            />
                            {isDuplicateTaskId && (
                                <p className="text-[10px] text-red-500 mt-1 font-medium">ID ya existe</p>
                            )}
                        </div>
                        <div className="flex-1 w-full">
                            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Descripción de Operación</label>
                            <input
                                value={newTaskDesc}
                                onChange={e => setNewTaskDesc(e.target.value)}
                                className="border border-slate-300 p-2.5 w-full bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium placeholder:text-slate-400"
                                placeholder="Ej: Coser dobladillo..."
                            />
                        </div>

                        {/* Sector Dropdown */}
                        <div className="w-40 relative">
                            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Sector</label>
                            <select
                                value={newTaskSectorId}
                                onChange={e => setNewTaskSectorId(e.target.value)}
                                className="border border-slate-300 p-2.5 w-full bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all h-[46px]"
                            >
                                <option value="">Sin sector</option>
                                {(data.sectors || []).map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                            {/* Advertencia: Sector sin máquinas - Fail-Safe UX */}
                            {newTaskSectorId && globalMachines.filter(m => m.sectorId === newTaskSectorId).length === 0 && (
                                <div className="absolute -bottom-7 left-0 right-0 flex items-center gap-1 text-[9px] text-amber-600 whitespace-nowrap">
                                    <AlertTriangle size={10} />
                                    <span>Sin máquinas configuradas.</span>
                                    <span className="text-slate-500">Agregalas en Panel de Control → Planta</span>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={addTask}
                            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-md hover:shadow-lg transition-all flex items-center gap-2 h-[46px]"
                        >
                            <Plus size={20} /> Agregar
                        </button>
                    </div>

                    <TaskTable
                        tasks={data.tasks}
                        sectorsList={data.sectors || []}
                        activeModels={data.meta.activeModels || []} // v2.0
                        collapsedSectors={collapsedSectors}
                        sectorBulkInputs={sectorBulkInputs}
                        toggleSectorCollapse={toggleSectorCollapse}
                        onApplyBulkSectorQuantity={applyBulkSectorQuantity}
                        onHandleBulkSectorInput={handleBulkSectorInput}
                        onTaskSectorChange={handleTaskSectorChange}
                        onTaskMachineChange={handleTaskMachineChange}
                        machinesList={globalMachines} // Injected from global config
                        onModeChange={handleModeChange}
                        onConcurrentChange={handleConcurrentChange}
                        onUpdateFairTimeParams={updateFairTimeParams}
                        onUpdateManualStdDev={updateManualStdDev}
                        onUpdateTime={updateTime}
                        onToggleIgnored={toggleIgnored}
                        onAddSamples={addSamples}
                        onRemoveSample={removeSample}
                        onRemoveTask={setPendingDeleteTaskId}
                        onDependencyChange={handleDependencyChange}
                        onOpenPasteModal={openPasteModal}
                        onOpenDocModal={openDocModal}
                        onSetCalcTask={setCalcTask}
                        // v2.1 MMALBP Handlers
                        onToggleTaskModelApplicability={toggleTaskModelApplicability}
                    />
                </Card>
            </div>
        );
    } catch (e: unknown) {
        return <div className="p-4 bg-red-100 text-red-800 border border-red-300 rounded">
            <strong>CRITICAL ERROR in TaskManager:</strong> {e instanceof Error ? e.message : String(e)}
            <pre className="text-xs mt-2">{e instanceof Error ? e.stack : undefined}</pre>
        </div>;
    }
};
