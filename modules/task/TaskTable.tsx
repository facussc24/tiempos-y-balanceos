import React, { useState, useMemo, useCallback } from 'react';
import { Task, Sector, ProductModel, MachineType } from '../../types';
import { formatNumber } from '../../utils/formatting';
import { Video, Trash2, Hash, ChevronDown, ChevronRight, PieChart, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { DependencySelector } from './components/DependencySelector';
import { TimeInputCell } from './components/TimeInputCell';
import { isOutlier } from '../../utils/math';
import { parsePositiveInt, parseTaskTime } from '../../utils/validation';
import { Tooltip } from '../../components/ui/Tooltip';

interface TaskTableProps {
    tasks: Task[];
    sectorsList: Sector[];
    machinesList?: MachineType[]; // V4.0: Optional machine catalog
    activeModels: ProductModel[]; // v2.0
    collapsedSectors: Set<string>;
    toggleSectorCollapse: (sectorId: string) => void;
    sectorBulkInputs: Record<string, string>;
    onHandleBulkSectorInput: (sectorId: string, value: string) => void;
    onApplyBulkSectorQuantity: (sectorId: string) => void;

    // Task Actions
    onUpdateFairTimeParams: (taskId: string, field: keyof Task, value: Task[keyof Task]) => void;
    onTaskSectorChange: (taskId: string, sectorId: string) => void;
    onTaskMachineChange?: (taskId: string, machineId: string) => void; // V4.0
    onDependencyChange: (taskId: string, preds: string[]) => void;
    onModeChange: (taskId: string, mode: 'manual' | 'machine' | 'injection') => void;
    onConcurrentChange: (taskId: string, concurrentId: string) => void;
    onUpdateTime: (taskId: string, timeIndex: number, value: number | null) => void;
    onToggleIgnored: (taskId: string, timeIndex: number) => void;
    onSetCalcTask: (task: Task) => void;
    onUpdateManualStdDev: (taskId: string, value: string) => void;
    onRemoveTask: (taskId: string) => void;
    onOpenPasteModal: (taskId: string) => void;
    onAddSamples: (taskId: string) => void;
    onRemoveSample: (taskId: string) => void;
    onOpenDocModal: (task: Task) => void;
    // v2.1 MMALBP Handlers
    onToggleTaskModelApplicability: (taskId: string, modelId: string) => void;
}

export const TaskTable: React.FC<TaskTableProps> = ({
    tasks,
    sectorsList,
    machinesList = [], // V4.0: Default to empty
    activeModels,
    collapsedSectors,
    toggleSectorCollapse,
    sectorBulkInputs,
    onHandleBulkSectorInput,
    onApplyBulkSectorQuantity,
    onUpdateFairTimeParams,
    onTaskSectorChange,
    onTaskMachineChange,
    onDependencyChange,
    onModeChange,
    onConcurrentChange,
    onUpdateTime,
    onToggleIgnored,
    onSetCalcTask,
    onUpdateManualStdDev,
    onRemoveTask,
    onOpenPasteModal,
    onAddSamples,
    onRemoveSample,
    onOpenDocModal,
    onToggleTaskModelApplicability
}) => {
    // v2.0 Expanded Rows State
    const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

    const toggleRow = useCallback((taskId: string) => {
        setExpandedTasks(prev => {
            const newSet = new Set(prev);
            if (newSet.has(taskId)) newSet.delete(taskId);
            else newSet.add(taskId);
            return newSet;
        });
    }, []);

    // Memoized grouping of tasks by sector
    const tasksBySector = useMemo(() => {
        const grouped: Record<string, Task[]> = {};
        sectorsList.forEach(s => grouped[s.id] = []);
        grouped['general'] = [];
        tasks.forEach(t => {
            const key = t.sectorId && grouped[t.sectorId] ? t.sectorId : 'general';
            grouped[key].push(t);
        });
        return grouped;
    }, [tasks, sectorsList]);

    // Memoize machine/injection tasks for "concurrent with" dropdowns (avoids O(N) filter per row)
    const machineTasks = useMemo(() =>
        tasks.filter(t => t.executionMode === 'machine' || t.executionMode === 'injection'),
        [tasks]
    );

    const renderTaskRow = (task: Task) => {
        // Refinement: Only flag outliers if we have enough samples (N >= 3) to establish a trend
        const isMachine = task.executionMode === 'machine' || task.executionMode === 'injection';
        const isInternal = task.isMachineInternal;

        const isExpanded = expandedTasks.has(task.id);
        const hasModels = activeModels && activeModels.length > 1;

        return (
            <React.Fragment key={task.id}>
                <tr className={`hover:bg-blue-50/40 transition-colors group ${isInternal ? 'bg-slate-50/50' : ''}`}>
                    <td className="px-4 py-3 align-top">
                        <div className="flex flex-col gap-1.5">
                            <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 border border-slate-200 text-[10px] w-fit rounded-md">{task.id}</span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => onOpenDocModal(task)}
                                    className={`p-1.5 rounded-md border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all ${task.mediaRef ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-blue-600 bg-white'}`}
                                    title="Documentación / Video"
                                >
                                    <Video size={12} />
                                </button>
                                {/* MMALBP Expansion Toggle */}
                                {hasModels && (
                                    <button
                                        onClick={() => toggleRow(task.id)}
                                        className={`p-1.5 rounded-md border transition-all ${isExpanded ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50'}`}
                                        title="Mix de Productos: Configurar Aplicabilidad"
                                    >
                                        <PieChart size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                        <div className="flex flex-col gap-2">
                            <input
                                className="w-full bg-transparent border-b border-slate-200 hover:border-slate-400 focus:border-blue-500 outline-none text-xs font-bold text-slate-800 transition-all placeholder-slate-400 py-1"
                                value={task.description}
                                onChange={(e) => onUpdateFairTimeParams(task.id, 'description', e.target.value)}
                                placeholder="Descripción de la tarea..."
                            />
                            <div className="flex flex-wrap gap-2 items-center">
                                <select
                                    className="text-[10px] bg-white border border-slate-200 focus:border-blue-500 rounded-md px-1.5 py-0.5 text-slate-700 font-bold outline-none"
                                    value={task.sectorId || ""}
                                    onChange={(e) => onTaskSectorChange(task.id, e.target.value)}
                                >
                                    <option value="">General</option>
                                    {sectorsList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>

                                {/* V4.0: Machine Selector (only shown when sector is selected and machines exist) */}
                                {task.sectorId && machinesList.length > 0 && onTaskMachineChange && (
                                    <select
                                        className={`text-[10px] border rounded-md px-1.5 py-0.5 font-bold outline-none ${task.requiredMachineId ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-white border-slate-200 text-slate-500'}`}
                                        value={task.requiredMachineId || ""}
                                        onChange={(e) => onTaskMachineChange(task.id, e.target.value)}
                                        title="Máquina requerida (V4)"
                                    >
                                        <option value="">Sin Máquina</option>
                                        {machinesList
                                            .filter(m => m.sectorId === task.sectorId)
                                            .map(m => <option key={m.id} value={m.id}>{m.name}</option>)
                                        }
                                    </select>
                                )}

                                {/* Dependency Selector */}
                                <div className="min-w-[120px]">
                                    <DependencySelector
                                        currentTaskId={task.id}
                                        allTasks={tasks}
                                        predecessors={task.predecessors}
                                        onChange={(preds) => onDependencyChange(task.id, preds)}
                                    />
                                </div>
                            </div>
                        </div>
                    </td>
                    <td className="px-4 py-3 align-top text-center">
                        <div className="flex flex-col gap-2 items-center">
                            <div className="flex bg-slate-100 p-0.5 rounded-lg gap-0.5">
                                <button
                                    onClick={() => onModeChange(task.id, 'manual')}
                                    className={`px-2.5 py-1 text-[10px] font-bold transition-all min-w-[44px] rounded-md ${task.executionMode === 'manual' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white'}`}
                                    title="Tarea manual - operador trabaja solo"
                                >
                                    Manual
                                </button>
                                <button
                                    onClick={() => onModeChange(task.id, 'machine')}
                                    className={`px-2.5 py-1 text-[10px] font-bold transition-all min-w-[44px] rounded-md ${task.executionMode === 'machine' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white'}`}
                                    title="Máquina automática (tapizado, etc.)"
                                >
                                    Máq.
                                </button>
                                <button
                                    onClick={() => onModeChange(task.id, 'injection')}
                                    className={`px-2.5 py-1 text-[10px] font-bold transition-all min-w-[44px] rounded-md ${task.executionMode === 'injection' ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white'}`}
                                    title="Inyectora con ciclo automático"
                                >
                                    Inyec.
                                </button>
                            </div>

                            {/* Concurrent Machine Binding - for tasks done DURING machine cycle */}
                            {task.executionMode === 'manual' && (
                                <div className="flex flex-col items-center gap-1">
                                    <select
                                        className={`text-[10px] w-28 border rounded-md px-1.5 py-0.5 font-bold outline-none ${task.concurrentWith ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-400'}`}
                                        value={task.concurrentWith || ""}
                                        onChange={(e) => onConcurrentChange(task.id, e.target.value)}
                                        title="Si esta tarea se hace MIENTRAS una máquina trabaja, seleccioná la máquina"
                                    >
                                        <option value="">Independiente</option>
                                        {machineTasks.filter(t => t.id !== task.id).map(m => (
                                            <option key={m.id} value={m.id}>Durante: {m.id}</option>
                                        ))}
                                    </select>
                                    {task.concurrentWith && (
                                        <span className="text-[8px] text-indigo-600 font-medium">
                                            Se hace durante ciclo máq.
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </td>
                    <td className="px-4 py-3 align-top text-center">
                        <input
                            type="number"
                            min="1"
                            className="w-12 border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-md text-center text-xs py-1 outline-none text-slate-800 font-bold"
                            value={task.cycleQuantity || 1}
                            onChange={(e) => {
                                onUpdateFairTimeParams(task.id, 'cycleQuantity', parsePositiveInt(e.target.value, 1));
                            }}
                        />
                    </td>
                    <td className="px-4 py-3 align-top">
                        {/* Visual Grouping Container for Times */}
                        <div className="flex flex-wrap justify-center gap-2 bg-slate-50 p-2 border border-dashed border-slate-200 rounded-lg hover:border-slate-300 transition-all">
                            {task.times.map((time, idx) => (
                                <TimeInputCell
                                    key={idx}
                                    value={time}
                                    onChange={(val) => {
                                        const validated = parseTaskTime(val, 0);
                                        onUpdateTime(task.id, idx, validated);
                                    }}
                                    isIgnored={task.ignoredTimeIndices?.includes(idx) || false}
                                    isOutlier={time !== null && isOutlier(time, task.averageTime, task.stdDev)}
                                    onToggleIgnore={() => onToggleIgnored(task.id, idx)}
                                    disabled={false}
                                />
                            ))}
                        </div>
                        {task.executionMode !== 'injection' && (
                            <div className="flex justify-center gap-2 mt-2">
                                <button onClick={() => onOpenPasteModal(task.id)} className="px-3 py-1 text-xs bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-slate-300 font-medium transition-all">Pegar</button>
                                {task.times.length < 10 && <button onClick={() => onAddSamples(task.id)} className="px-3 py-1 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md hover:bg-emerald-100 hover:border-emerald-300 font-medium transition-all" title="Agregar una medición de cronómetro">+ Medición</button>}
                                {task.times.length > 3 && <button onClick={() => onRemoveSample(task.id)} className="px-3 py-1 text-xs bg-red-50 border border-red-200 text-red-600 rounded-md hover:bg-red-100 hover:border-red-300 font-medium transition-all" title="Quitar última medición">- Medición</button>}
                            </div>
                        )}
                    </td>
                    <td className="px-4 py-3 align-top text-center font-mono text-xs font-bold text-slate-400">
                        {(() => {
                            const activeSamples = task.times.filter((t, idx) => t !== null && t > 0 && !(task.ignoredTimeIndices || []).includes(idx)).length;
                            const required = task.requiredSamples || 0;
                            const showBadge = !isMachine && required > 0;
                            const isSufficient = showBadge && activeSamples >= required;
                            const isClose = showBadge && !isSufficient && activeSamples >= required * 0.7;
                            const isInsufficient = showBadge && !isSufficient && !isClose;

                            return (
                                <div className="flex flex-col items-center gap-1">
                                    <div className="flex items-center gap-1.5">
                                        <span>{activeSamples}</span>
                                        {isSufficient && (
                                            <Tooltip content={`Muestras suficientes: ${activeSamples} de ${required} requeridas (95% confianza, 5% error)`}>
                                                <CheckCircle2 size={14} className="text-emerald-500" />
                                            </Tooltip>
                                        )}
                                        {isClose && (
                                            <Tooltip content={`Cerca del mínimo: ${activeSamples} de ${required} requeridas (95% confianza, 5% error)`}>
                                                <AlertTriangle size={14} className="text-amber-500" />
                                            </Tooltip>
                                        )}
                                        {isInsufficient && (
                                            <Tooltip content={`Muestras insuficientes: ${activeSamples} de ${required} requeridas (95% confianza, 5% error)`}>
                                                <XCircle size={14} className="text-red-400" />
                                            </Tooltip>
                                        )}
                                    </div>
                                    {showBadge && (
                                        <span className={`text-[8px] font-bold ${isSufficient ? 'text-emerald-600' : isClose ? 'text-amber-600' : 'text-red-400'}`}>
                                            N={required}
                                        </span>
                                    )}
                                    {hasModels && (
                                        <span className="text-[8px] text-blue-500 font-medium" title="Tiempo ponderado por mix de modelos">∑ Mix</span>
                                    )}
                                </div>
                            );
                        })()}
                    </td>
                    <td className="px-4 py-3 align-top text-center">
                        {isMachine ? (
                            <span className="text-xs font-bold text-slate-300">-</span>
                        ) : (
                            <div className="flex flex-col items-center gap-1">
                                {/* Rating Input with Dynamic Styling */}
                                <div className="flex items-center justify-center">
                                    {/* Dynamic Icon based on Rating */}
                                    <div
                                        className={`h-[28px] w-7 flex items-center justify-center border border-slate-200 border-r-0 rounded-l-md text-sm ${task.ratingFactor < 90 ? 'bg-blue-50' :
                                            task.ratingFactor > 110 ? 'bg-orange-50' :
                                                'bg-green-50'
                                            }`}
                                        title={
                                            task.ratingFactor < 90 ? 'Operario Lento: El tiempo se reducirá para normalizar' :
                                                task.ratingFactor > 110 ? 'Operario Rápido: El tiempo se aumentará para normalizar' :
                                                    'Ritmo Normal: Sin ajuste significativo'
                                        }
                                    >
                                        {task.ratingFactor < 90 ? '🐢' : task.ratingFactor > 110 ? '🐇' : '🚶'}
                                    </div>
                                    <input
                                        className={`w-12 border border-slate-200 border-l-0 border-r-0 focus:border-blue-500 text-center text-xs py-1 focus:outline-none font-bold transition-colors ${task.ratingFactor < 80 || task.ratingFactor > 120 ? 'bg-red-50 text-red-700' :
                                            task.ratingFactor < 90 || task.ratingFactor > 110 ? 'bg-amber-50 text-amber-700' :
                                                'bg-green-50 text-green-700'
                                            }`}
                                        value={task.ratingFactor}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const num = val === '' ? 0 : parseInt(val);
                                            onUpdateFairTimeParams(task.id, 'ratingFactor', isNaN(num) ? 0 : num);
                                        }}
                                        title="Factor de ritmo del operario cronometrado (80-120% típico)"
                                    />
                                    <div className="bg-slate-700 text-white font-bold text-[10px] h-[28px] flex items-center px-1.5 border border-slate-700 rounded-r-md">
                                        %
                                    </div>
                                </div>
                                {/* Mini feedback label */}
                                <span className={`text-[8px] font-bold uppercase ${task.ratingFactor < 90 ? 'text-blue-600' :
                                    task.ratingFactor > 110 ? 'text-orange-600' :
                                        'text-green-600'
                                    }`}>
                                    {task.ratingFactor < 90 ? 'Lento' : task.ratingFactor > 110 ? 'Rápido' : 'Normal'}
                                </span>
                            </div>
                        )}
                    </td>
                    {/* Fatigue column REMOVED (v10.1) — fatigue is now managed globally from Panel de Control */}
                    <td className="px-4 py-3 align-top">
                        <div className="flex flex-col gap-1 items-end">
                            <span className="font-bold text-sm text-slate-800 bg-slate-100 px-2.5 py-1 border border-slate-200 rounded-md">
                                {formatNumber(task.standardTime)}s
                            </span>
                            {/* Mix Definition Indicator */}
                            {(hasModels) && (
                                <span className="text-[9px] bg-blue-100 text-blue-700 px-1 font-bold border border-blue-200 rounded">
                                    Ponderado
                                </span>
                            )}
                            {isMachine ? (
                                <button
                                    onClick={() => onSetCalcTask(task)}
                                    className={`text-[9px] flex items-center gap-1 px-1.5 py-0.5 border rounded-md font-bold uppercase transition-all ${task.executionMode === 'injection' ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}
                                    title={task.executionMode === 'injection' ? 'Calcular cavidades y ciclo de inyección' : 'Calcular tiempo de ciclo máquina'}
                                    aria-label={task.executionMode === 'injection' ? 'Calcular cavidades' : 'Calcular ciclo máquina'}
                                >
                                    <Hash size={10} /> {task.executionMode === 'injection' ? 'Cavidades' : 'Calc'}
                                </button>
                            ) : (
                                <div className="flex items-center gap-1 text-[10px] text-slate-400 group/std">
                                    <span>σ:</span>
                                    <input
                                        className="w-12 border border-slate-200 bg-white text-center rounded-md hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all font-mono font-bold"
                                        value={formatNumber(task.stdDev || 0, 2)}
                                        onChange={(e) => onUpdateManualStdDev(task.id, e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                    </td>
                    <td className="px-4 py-3 align-top text-center">
                        <button
                            onClick={() => onRemoveTask(task.id)}
                            className="text-slate-400 p-2 rounded-lg border border-transparent hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition-all"
                        >
                            <Trash2 size={16} />
                        </button>
                    </td>
                </tr>

                {/* EXPANDED ROW FOR MIX APPLICABILITY (v2.1) */}
                {isExpanded && hasModels && (
                    <tr className="bg-slate-50 border-b border-slate-200">
                        <td colSpan={10} className="px-4 py-3 bg-blue-50/30">
                            <div className="flex flex-col gap-2">
                                <h4 className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
                                    <PieChart size={14} /> Aplicabilidad por Modelo (¿Incluye esta tarea?)
                                </h4>
                                <div className="flex flex-wrap gap-4">
                                    {activeModels.map(model => {
                                        // Default to TRUE (Undefined = True)
                                        const isApplicable = task.modelApplicability?.[model.id] !== false;
                                        return (
                                            <div
                                                key={model.id}
                                                className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all select-none ${isApplicable ? 'bg-white border-blue-300 shadow-sm' : 'bg-slate-100 border-slate-200 opacity-60 grayscale'}`}
                                                onClick={() => onToggleTaskModelApplicability(task.id, model.id)}
                                            >
                                                {/* Visual Checkbox */}
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isApplicable ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-400'}`}>
                                                    {isApplicable && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
                                                </div>

                                                <div className="flex flex-col">
                                                    <label
                                                        className="text-[10px] font-bold uppercase tracking-wider truncate flex items-center gap-1 cursor-pointer"
                                                        style={{ color: isApplicable ? model.color : '#94a3b8' }}
                                                    >
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isApplicable ? model.color : '#cbd5e1' }}></div>
                                                        {model.name}
                                                    </label>
                                                    <span className="text-[9px] font-medium text-slate-400">
                                                        {((model.percentage || 0) * 100).toFixed(0)}% del Mix
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </td>
                    </tr>
                )}
            </React.Fragment>
        );
    };

    return (
        <div className="space-y-6">
            <div className="overflow-x-auto rounded-xl border border-slate-200 min-h-[400px] shadow-sm">
                <table className="min-w-full text-xs lg:text-sm divide-y divide-slate-100">
                    <thead className="bg-slate-800 text-white">
                        <tr>
                            <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-[10px] w-16">ID</th>
                            <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-[10px] min-w-[200px]">Descripción & Info</th>
                            <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-[10px] w-32">Modo Ejecución</th>
                            <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-[10px] w-16">
                                <div className="flex items-center justify-center gap-1">
                                    Pzs/Ciclo
                                    <Tooltip content="Cantidad de unidades producidas por cada ciclo cronometrado (ej: 2 mangas por vez)." className="text-slate-400" />
                                </div>
                            </th>
                            <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-[10px] min-w-[320px]">Tomas de Tiempo (s)</th>
                            <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-[10px] w-20">Muestras</th>
                            <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-[10px] w-20">
                                <div className="flex items-center justify-center gap-1">
                                    Valoración
                                    <Tooltip content="Ritmo del operario cronometrado. 100%=Normal. <100%=Lento (tiempo se reduce). >100%=Rápido (tiempo se aumenta). Fórmula: Tiempo Normal = Observado × Rating/100" className="text-slate-400" />
                                </div>
                            </th>
                            {/* Fatigue column REMOVED (v10.1) — managed globally from Panel de Control */}
                            <th className="px-4 py-3 text-right font-bold uppercase tracking-wider text-[10px] w-32">
                                <div className="flex items-center justify-end gap-1">
                                    Tiempo Std
                                    <Tooltip content="Tiempo final calculado: (Tiempo Promedio × Valoración) × (1 + Fatiga Panel de Control)." className="text-slate-400" />
                                </div>
                            </th>
                            <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-[10px] w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {/* GENERAL TASKS */}
                        {tasksBySector['general'].map(renderTaskRow)}

                        {/* SECTORS */}
                        {sectorsList.map(sector => (
                            <React.Fragment key={sector.id}>
                                <tr className="bg-slate-50 relative">
                                    {/* COLOR STRIP */}
                                    <td colSpan={10} className="px-4 py-3 border-y border-slate-200" style={{ borderLeft: `4px solid ${sector.color}` }}>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => toggleSectorCollapse(sector.id)}
                                                className="p-1.5 bg-white border border-slate-200 rounded-md hover:bg-slate-100 hover:border-slate-300 transition-all"
                                            >
                                                {collapsedSectors.has(sector.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                            </button>

                                            <div className="flex items-baseline gap-2">
                                                <span className="font-bold text-base text-slate-800 uppercase tracking-tight">{sector.name}</span>
                                                <span className="text-xs font-medium text-slate-500">({tasksBySector[sector.id].length} tareas)</span>
                                            </div>

                                            {/* OEE Badge */}
                                            <div className="ml-2 px-2.5 py-0.5 bg-slate-800 text-emerald-400 font-mono text-xs font-bold rounded-md">
                                                OEE: {(sector.targetOee || 0.85) * 100}%
                                            </div>

                                            <div className="ml-auto flex items-center gap-2">
                                                <input
                                                    className="w-20 border border-slate-200 bg-white p-1.5 text-xs font-bold text-center rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                                                    placeholder="Pzs/Ciclo"
                                                    value={sectorBulkInputs[sector.id] || ""}
                                                    onChange={e => onHandleBulkSectorInput(sector.id, e.target.value)}
                                                />
                                                <button
                                                    onClick={() => onApplyBulkSectorQuantity(sector.id)}
                                                    className="text-[10px] bg-white border border-slate-200 px-3 py-1.5 font-bold uppercase tracking-wide rounded-md hover:bg-slate-50 hover:border-slate-300 transition-all"
                                                >
                                                    Aplicar a Todo
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                                {!collapsedSectors.has(sector.id) && tasksBySector[sector.id].map(renderTaskRow)}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
