import React from 'react';
import { Layers, Plus, AlertTriangle, ClipboardPaste, ListTodo, Link2 } from 'lucide-react';
import { ProjectData } from '../types';
import { Card } from '../components/ui/Card';
import { EmptyState, EMPTY_STATE_PRESETS } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/modals/ConfirmModal';
import { CavityCalculator } from './CavityCalculator';
import { ManualCapacityCalculator } from './ManualCapacityCalculator';

// New Modular Imports
import { useTaskManager } from '../hooks/useTaskManager';
import { TaskTable } from './task/TaskTable';
import { SectorManagementModal } from './task/modals/SectorManagementModal';
import { PasteModal } from './task/modals/PasteModal';
import { DocumentationModal } from './task/modals/DocumentationModal';
import { CreateVariantModal } from './task/modals/CreateVariantModal'; // V9.0: Product Inheritance
import { ZoningConstraintsModal } from './balancing/components/ZoningConstraintsModal'; // FIX 3
import { usePlantAssets } from '../hooks/usePlantAssets'; // V4.0 Asset Registry
import { isTauri } from '../utils/unified_fs'; // V9.0: For variant creation
import { logger } from '../utils/logger';

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
        pasteTargetTaskId, setPasteTargetTaskId,
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

    // Task deletion confirmation
    const [pendingDeleteTaskId, setPendingDeleteTaskId] = React.useState<string | null>(null);
    const pendingDeleteTask = pendingDeleteTaskId ? data.tasks.find(t => t.id === pendingDeleteTaskId) : null;

    // Mejora 2: Ref para focus en input ID
    const newTaskIdRef = React.useRef<HTMLInputElement>(null);



    // V9.0: Handler for creating a variant
    const handleCreateVariant = async (variantName: string, parentRelPath: string): Promise<boolean> => {
        // Mejora 1: Prevenir doble-click
        if (isCreatingVariant) return false;
        setIsCreatingVariant(true);

        if (!isTauri()) {
            logger.error('TaskManager', 'Variant creation requires Tauri mode');
            setIsCreatingVariant(false);
            return false;
        }

        try {
            const tauriFs = await import('../utils/tauri_fs');

            // Create child project structure with minimal data
            const childProject: Partial<typeof data> = {
                meta: {
                    ...data.meta,
                    name: variantName,
                    date: new Date().toISOString(),
                    parentPath: './master.json', // Relative to child location
                },
                tasks: [], // No tasks - inherits from parent
                taskOverrides: [], // Start with empty overrides
                assignments: [],
                stationConfigs: [],
                shifts: [], // Inherit from parent at runtime
                sectors: [], // Inherit from parent at runtime
            };

            // Save to same directory as current file
            // This is a simplified version - in production would use rootHandle
            const sanitizedName = variantName.replace(/[^a-zA-Z0-9_-]/g, '_');
            const variantPath = `${sanitizedName}.json`;

            const success = await tauriFs.writeTextFile(
                variantPath,
                JSON.stringify(childProject, null, 2)
            );

            return success;
        } catch (err) {
            logger.error('TaskManager', 'Failed to create variant', {}, err instanceof Error ? err : undefined);
            return false;
        } finally {
            setIsCreatingVariant(false);
        }
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
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <CavityCalculator
                            task={calcTask}
                            projectTasks={data.tasks}
                            shifts={data.shifts}
                            dailyDemand={data.meta.dailyDemand}
                            activeShifts={data.meta.activeShifts}
                            oee={data.meta.manualOEE}
                            onClose={() => setCalcTask(null)}
                            onApply={applyInjectionParams}
                        />
                    </div>
                )}

                {calcTask && calcTask.executionMode !== 'injection' && (
                    <ManualCapacityCalculator
                        task={calcTask}
                        shifts={data.shifts}
                        dailyDemand={data.meta.dailyDemand}
                        activeShifts={data.meta.activeShifts}
                        oee={data.meta.manualOEE}
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
                    <div className="flex gap-2">
                        <button onClick={() => setIsSectorModalOpen(true)} className="text-sm text-slate-600 hover:text-blue-600 border border-slate-300 px-3 py-1.5 rounded-lg bg-white flex items-center gap-2 shadow-sm transition-colors">
                            <Layers size={14} /> Gestionar Sectores
                        </button>
                        <button onClick={sortByWeight} className="text-sm text-blue-600 hover:text-blue-800 font-medium bg-blue-50 hover:bg-blue-100 border border-blue-100 px-3 py-1.5 rounded-lg shadow-sm transition-colors">
                            Ordenar por Prioridad
                        </button>
                        {/* FIX 3: Zoning Constraints Button */}
                        <button
                            onClick={() => setIsZoningModalOpen(true)}
                            className="text-sm text-amber-600 hover:text-amber-800 font-medium bg-amber-50 hover:bg-amber-100 border border-amber-100 px-3 py-1.5 rounded-lg shadow-sm transition-colors flex items-center gap-1"
                            title="Gestionar Restricciones de Zonificación"
                        >
                            <Link2 size={14} />
                            Restricciones
                            {(data.zoningConstraints?.length || 0) > 0 && (
                                <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                    {data.zoningConstraints?.length}
                                </span>
                            )}
                        </button>
                        {/* V9.0: Create Variant Button */}
                        {data.tasks.length > 0 && (
                            <button
                                onClick={() => setIsVariantModalOpen(true)}
                                className="text-sm text-purple-600 hover:text-purple-800 font-medium bg-purple-50 hover:bg-purple-100 border border-purple-100 px-3 py-1.5 rounded-lg shadow-sm transition-colors flex items-center gap-1"
                                title="Crear variante heredando tareas de este producto"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M6 3v12M18 9a3 3 0 100 6M6 15a3 3 0 100 6M18 15l-6-6M12 9L6 15" />
                                </svg>
                                Crear Variante
                            </button>
                        )}
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
                                        label: 'Crear Primera Tarea',
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
                                className="border border-slate-300 p-2.5 w-32 bg-white text-slate-900 font-mono font-bold rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400"
                                placeholder="A1"
                            />
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
                                    <span>Sin máquinas →</span>
                                    <a
                                        href="#plant"
                                        className="text-blue-600 hover:underline font-medium"
                                        title="Ir a Configuración de Planta"
                                    >
                                        Configurar
                                    </a>
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
    } catch (e: any) {
        return <div className="p-4 bg-red-100 text-red-800 border border-red-300 rounded">
            <strong>CRITICAL ERROR in TaskManager:</strong> {e.message}
            <pre className="text-xs mt-2">{e.stack}</pre>
        </div>;
    }
};
