import React, { useState, useMemo } from 'react';
import { ProjectData, Task, FatigueCategory, InjectionParams } from '../types';
import { calculateTaskWeights, parseCSVLine, syncSuccessors } from '../utils';
import { detectPrecedenceCycles } from '../core/balancing/detectCycles';
import { toast } from '../components/ui/Toast';

/** Calculate the next sequential task ID based on existing tasks (e.g., A1 → A2 → A3). */
const getNextTaskId = (tasks: Task[]): string => {
    if (tasks.length === 0) return 'A1';
    const lastId = tasks[tasks.length - 1].id;
    const match = lastId.match(/^([A-Z]+)(\d+)$/);
    if (match) return match[1] + (parseInt(match[2]) + 1);
    return 'A' + (tasks.length + 1);
};

export const useTaskManager = (data: ProjectData, updateData: (data: ProjectData) => void) => {
    const [calcTask, setCalcTask] = useState<Task | null>(null);
    const [docTask, setDocTask] = useState<Task | null>(null);
    const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
    const [pasteTargetTaskId, setPasteTargetTaskId] = useState<string | null>(null);
    const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);

    const [newTaskID, setNewTaskID] = useState(() => getNextTaskId(data.tasks));
    const [newTaskDesc, setNewTaskDesc] = useState("");
    const [newTaskSectorId, setNewTaskSectorId] = useState(""); // Sector for new task creation

    const [collapsedSectors, setCollapsedSectors] = useState<Set<string>>(new Set());
    const [sectorBulkInputs, setSectorBulkInputs] = useState<Record<string, string>>({});

    const cycleError = useMemo(() => {
        const cycles = detectPrecedenceCycles(data.tasks);
        return cycles.length > 0 ? cycles : null;
    }, [data.tasks]);

    // --- CRUD OPERATIONS ---

    const addTask = () => {
        if (!newTaskID.trim()) {
            toast.warning('ID Requerido', 'Ingresá un identificador para la tarea (ej: A1)');
            return;
        }
        if (data.tasks.some(t => t.id === newTaskID)) {
            toast.warning('ID Duplicado', 'Ya existe una tarea con este identificador');
            return;
        }
        const newTask: Task = {
            id: newTaskID,
            description: newTaskDesc,
            times: [null, null, null, null, null],
            averageTime: 0,
            standardTime: 0,
            ratingFactor: 100,
            fatigueCategory: 'none',
            predecessors: [],
            successors: [],
            positionalWeight: 0,
            calculatedSuccessorSum: 0,
            stdDev: 0,
            executionMode: 'manual',
            sectorId: newTaskSectorId || undefined // Apply selected sector
        };

        const updatedTasks = calculateTaskWeights([...data.tasks, newTask], data.meta.activeModels || [], data.meta.fatigueCompensation);
        updateData({ ...data, tasks: updatedTasks });
        setNewTaskID(getNextTaskId([...data.tasks, newTask]));
        setNewTaskDesc("");
    };

    const removeTask = (id: string) => {
        const filteredTasks = data.tasks.filter(t => t.id !== id);
        const cleanedTasks = filteredTasks.map(t => ({
            ...t,
            predecessors: t.predecessors.filter(p => p !== id),
            successors: t.successors.filter(s => s !== id),
            concurrentWith: t.concurrentWith === id ? null : t.concurrentWith
        }));
        const cleanedAssignments = data.assignments.filter(a => a.taskId !== id);
        const cleanedZoning = (data.zoningConstraints || []).filter(c => c.taskA !== id && c.taskB !== id);
        updateData({ ...data, tasks: calculateTaskWeights(cleanedTasks, data.meta.activeModels || [], data.meta.fatigueCompensation), assignments: cleanedAssignments, zoningConstraints: cleanedZoning });
    };

    // BUG-03 FIX: Improved validation without 'as any' cast
    const updateTime = (taskId: string, index: number, numVal: number | null) => {
        const newTasks = data.tasks.map(t => {
            if (t.id === taskId) {
                const newTimes = [...t.times];
                // Robust validation: check for null, finite, not-NaN, and non-negative
                let validatedValue: number | null = null;
                if (numVal !== null && Number.isFinite(numVal) && !Number.isNaN(numVal)) {
                    validatedValue = Math.max(0, numVal); // Don't allow negative times
                }
                newTimes[index] = validatedValue;
                return { ...t, times: newTimes };
            }
            return t;
        });
        updateData({ ...data, tasks: calculateTaskWeights(newTasks, data.meta.activeModels || [], data.meta.fatigueCompensation) });
    };

    const addSamples = (taskId: string) => {
        const newTasks = data.tasks.map(t => t.id === taskId ? { ...t, times: [...t.times, null] } : t);
        updateData({ ...data, tasks: newTasks });
    };

    const removeSample = (taskId: string) => {
        const newTasks = data.tasks.map(t => {
            if (t.id === taskId && t.times.length > 1) {
                const newTimes = [...t.times];
                newTimes.pop();
                return { ...t, times: newTimes };
            }
            return t;
        });
        updateData({ ...data, tasks: calculateTaskWeights(newTasks, data.meta.activeModels || [], data.meta.fatigueCompensation) });
    };

    const toggleIgnored = (taskId: string, index: number) => {
        const newTasks = data.tasks.map(t => {
            if (t.id === taskId) {
                const currentIgnored = t.ignoredTimeIndices || [];
                const newIgnored = currentIgnored.includes(index)
                    ? currentIgnored.filter(i => i !== index)
                    : [...currentIgnored, index];
                return { ...t, ignoredTimeIndices: newIgnored };
            }
            return t;
        });
        updateData({ ...data, tasks: calculateTaskWeights(newTasks, data.meta.activeModels || [], data.meta.fatigueCompensation) });
    };

    const updateFairTimeParams = (taskId: string, field: keyof Task, value: Task[keyof Task]) => {
        const newTasks = data.tasks.map(t => t.id === taskId ? { ...t, [field]: value } : t);
        updateData({ ...data, tasks: calculateTaskWeights(newTasks, data.meta.activeModels || [], data.meta.fatigueCompensation) });
    };

    const updateManualStdDev = (taskId: string, value: string) => {
        const num = parseFloat(value.replace(',', '.'));
        const safeNum = isNaN(num) ? 0 : Math.max(0, num); // stdDev cannot be negative
        const newTasks = data.tasks.map(t => t.id === taskId ? { ...t, stdDev: safeNum } : t);
        updateData({ ...data, tasks: calculateTaskWeights(newTasks, data.meta.activeModels || [], data.meta.fatigueCompensation) });
    };


    // v2.1 MMALBP: Toggle Model Applicability
    const toggleTaskModelApplicability = (taskId: string, modelId: string) => {
        const newTasks = data.tasks.map(t => {
            if (t.id === taskId) {
                const currentFn = t.modelApplicability?.[modelId];
                // If undefined, it defaults to true, so toggle means becomes FALSE.
                // If true, becomes false. If false, becomes true.
                const newStatus = currentFn === undefined ? false : !currentFn;

                const newApplicability = { ...(t.modelApplicability || {}), [modelId]: newStatus };

                return {
                    ...t,
                    modelApplicability: newApplicability
                    // Note: averageTime is recalculated by calculateTaskWeights
                };
            }
            return t;
        });
        updateData({ ...data, tasks: calculateTaskWeights(newTasks, data.meta.activeModels || [], data.meta.fatigueCompensation) });
    };

    const handleDependencyChange = (taskId: string, preds: string[]) => {
        const newTasks = data.tasks.map(t => t.id === taskId ? { ...t, predecessors: preds } : t);
        const tasksWithSuccsUpdated = syncSuccessors(newTasks);
        updateData({ ...data, tasks: calculateTaskWeights(tasksWithSuccsUpdated, data.meta.activeModels || [], data.meta.fatigueCompensation) });
    };

    const sortByWeight = () => {
        // FIX: Guard against NaN in positionalWeight causing non-deterministic sort
        const sorted = [...data.tasks].sort((a, b) => {
            const aw = Number.isFinite(a.positionalWeight) ? a.positionalWeight : 0;
            const bw = Number.isFinite(b.positionalWeight) ? b.positionalWeight : 0;
            return bw - aw;
        });
        updateData({ ...data, tasks: sorted });
    };

    // --- SECTOR LOGIC ---
    const toggleSectorCollapse = (sectorId: string) => {
        const newSet = new Set(collapsedSectors);
        if (newSet.has(sectorId)) newSet.delete(sectorId);
        else newSet.add(sectorId);
        setCollapsedSectors(newSet);
    };

    const handleTaskSectorChange = (taskId: string, sectorId: string) => {
        const newTasks = data.tasks.map(t => t.id === taskId ? { ...t, sectorId: sectorId || undefined } : t);
        updateData({ ...data, tasks: newTasks });
    };

    // V4.2 RC-ALBP: Handler for machine assignment
    const handleTaskMachineChange = (taskId: string, machineId: string) => {
        const newTasks = data.tasks.map(t =>
            t.id === taskId
                ? { ...t, requiredMachineId: machineId || undefined }
                : t
        );
        updateData({ ...data, tasks: newTasks });
    };

    const handleBulkSectorInput = (sectorId: string, val: string) => {
        setSectorBulkInputs({ ...sectorBulkInputs, [sectorId]: val });
    };

    const applyBulkSectorQuantity = (sectorId: string) => {
        const val = parseInt(sectorBulkInputs[sectorId]);
        if (isNaN(val) || val <= 0) return;
        const newTasks = data.tasks.map(t => {
            if (t.sectorId === sectorId) return { ...t, cycleQuantity: val };
            return t;
        });
        updateData({ ...data, tasks: calculateTaskWeights(newTasks, data.meta.activeModels || [], data.meta.fatigueCompensation) });
    };

    // --- MODAL TRIGGERS ---
    const openPasteModal = (taskId: string) => {
        setPasteTargetTaskId(taskId);
        setIsPasteModalOpen(true);
    };

    const openDocModal = (task: Task) => {
        setDocTask(task);
    };

    // --- CALCULATORS ---
    const handleModeChange = (taskId: string, mode: 'manual' | 'machine' | 'injection') => {
        const newTasks = data.tasks.map(t => {
            if (t.id === taskId) {
                return {
                    ...t,
                    executionMode: mode,
                    ratingFactor: (mode === 'machine' || mode === 'injection') ? 100 : t.ratingFactor,
                    fatigueCategory: (mode === 'machine' || mode === 'injection') ? ('low' as FatigueCategory) : t.fatigueCategory
                };
            }
            return t;
        });
        updateData({ ...data, tasks: calculateTaskWeights(newTasks, data.meta.activeModels || [], data.meta.fatigueCompensation) });
    };

    const handleConcurrentChange = (taskId: string, machineId: string) => {
        const newTasks = data.tasks.map(t => t.id === taskId ? {
            ...t,
            concurrentWith: machineId || null,
            // Strict Binding: If linked to machine, IT IS INTERNAL (Ghost Task). If removed, it is not.
            isMachineInternal: !!machineId
        } : t);
        updateData({ ...data, tasks: calculateTaskWeights(newTasks, data.meta.activeModels || [], data.meta.fatigueCompensation) });
    };

    // --- CALC APPLY Handlers ---
    const applyInjectionParams = (params: InjectionParams, calculatedCycle: number) => {
        if (!calcTask) return;
        const updatedTasks = data.tasks.map(t => {
            if (t.id === calcTask.id) {
                const currentLength = t.times.length > 5 ? t.times.length : 5;
                const newTimes = Array(currentLength).fill(calculatedCycle);
                return {
                    ...t,
                    cycleQuantity: params.optimalCavities,
                    injectionParams: { ...params, realCycle: calculatedCycle / (params.optimalCavities || 1) },
                    times: newTimes,
                    ignoredTimeIndices: []
                };
            }
            return t;
        });
        updateData({ ...data, tasks: calculateTaskWeights(updatedTasks, data.meta.activeModels || [], data.meta.fatigueCompensation) });
    };

    const applyManualParams = (updates: Partial<Task>) => {
        if (!calcTask) return;
        const updatedTasks = data.tasks.map(t => {
            if (t.id === calcTask.id) {
                return { ...t, ...updates };
            }
            return t;
        });
        updateData({ ...data, tasks: calculateTaskWeights(updatedTasks, data.meta.activeModels || [], data.meta.fatigueCompensation) });
    };


    return {
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
    };
};
