/**
 * CuringTimeContainer - V4.8 Phase 27 (Curado Químico)
 * 
 * Visual container for assigning manual tasks inside/outside curing time.
 * Expert's "Opción A": Drag tasks into a visual bar representing curing time.
 * 
 * Logic:
 * - If task is INSIDE the curing bar → isMachineInternal = true (absorbed)
 * - If task is OUTSIDE → isMachineInternal = false (adds to cycle)
 * - If internal tasks EXCEED curing time → bar turns red (operator bottleneck)
 * 
 * Formula: T_Ciclo = Max(T_Curado, Σ T_Interna) + Σ T_Externa
 */
import React, { useState, useMemo } from 'react';
import {
    FlaskConical,
    Clock,
    AlertTriangle,
    CheckCircle,
    MoveVertical,
    ArrowDown
} from 'lucide-react';

interface ManualTask {
    id: string;
    description: string;
    time: number;  // seconds
    isInternal: boolean;  // true = during curing
}

interface CuringTimeContainerProps {
    curingTime: number;  // Total curing time in seconds
    manualTasks: ManualTask[];
    onTaskToggle: (taskId: string, isInternal: boolean) => void;
    onCuringTimeChange?: (newTime: number) => void;
    disabled?: boolean;
}

const CuringTimeContainer: React.FC<CuringTimeContainerProps> = ({
    curingTime,
    manualTasks,
    onTaskToggle,
    onCuringTimeChange,
    disabled = false
}) => {
    const [isDragging, setIsDragging] = useState<string | null>(null);

    // Calculate totals
    const { internalTasks, externalTasks, totalInternal, totalExternal, isOverflowing, effectiveCycle } = useMemo(() => {
        const internal = manualTasks.filter(t => t.isInternal);
        const external = manualTasks.filter(t => !t.isInternal);
        const totalInt = internal.reduce((sum, t) => sum + t.time, 0);
        const totalExt = external.reduce((sum, t) => sum + t.time, 0);

        // Formula: Cycle = Max(Curing, Internal) + External
        const cycle = Math.max(curingTime, totalInt) + totalExt;

        return {
            internalTasks: internal,
            externalTasks: external,
            totalInternal: totalInt,
            totalExternal: totalExt,
            isOverflowing: totalInt > curingTime,
            effectiveCycle: cycle
        };
    }, [manualTasks, curingTime]);

    // Bar fill percentage (capped at 100% for visual)
    // FIX: Guard against curingTime === 0 to prevent Infinity in CSS width.
    // When curingTime is 0, internal tasks have no curing window to absorb into.
    const internalFillPercent = curingTime > 0
        ? Math.min((totalInternal / curingTime) * 100, 100)
        : (totalInternal > 0 ? 100 : 0);
    const overflowPercent = curingTime > 0 && totalInternal > curingTime
        ? ((totalInternal - curingTime) / curingTime) * 100
        : 0;

    const handleDragStart = (taskId: string) => {
        if (!disabled) setIsDragging(taskId);
    };

    const handleDrop = (isInternalZone: boolean) => {
        if (isDragging && !disabled) {
            onTaskToggle(isDragging, isInternalZone);
            setIsDragging(null);
        }
    };

    const formatTime = (seconds: number): string => {
        // FIX: Guard against NaN bypassing >= comparison and reaching .toFixed()
        if (!Number.isFinite(seconds)) return '0s';
        if (seconds >= 60) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
        }
        return `${seconds.toFixed(0)}s`;
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-100 rounded-lg">
                        <FlaskConical size={20} className="text-amber-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-700">Curado Químico</h3>
                        <p className="text-xs text-slate-500">Arrastrá las tareas dentro o fuera del curado</p>
                    </div>
                </div>

                {/* Curing Time Input */}
                <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-600">Tiempo Curado:</label>
                    <input
                        type="number"
                        value={curingTime}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            onCuringTimeChange?.(isNaN(val) || val < 0 ? 0 : val);
                        }}
                        disabled={disabled || !onCuringTimeChange}
                        className="w-20 px-2 py-1 border border-slate-200 rounded text-center text-sm"
                        min={1}
                    />
                    <span className="text-sm text-slate-500">seg</span>
                </div>
            </div>

            {/* Visual Container */}
            <div className="space-y-3">
                {/* Curing Time Bar (Internal Zone) */}
                <div
                    className={`
                        relative h-24 rounded-lg border-2 border-dashed transition-all
                        ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-slate-50'}
                        ${isOverflowing ? 'border-red-300 bg-red-50' : ''}
                    `}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(true)}
                    aria-label="Zona de tareas internas — se ejecutan durante el curado"
                >
                    {/* Fill Bar */}
                    <div
                        className={`absolute inset-y-0 left-0 rounded-l-lg transition-all ${isOverflowing ? 'bg-red-200' : 'bg-amber-200'
                            }`}
                        style={{ width: `${internalFillPercent}%` }}
                    />

                    {/* Overflow indicator */}
                    {isOverflowing && (
                        <div
                            className="absolute inset-y-0 right-0 bg-red-400 opacity-50"
                            style={{ width: `${Math.min(overflowPercent, 20)}%` }}
                        />
                    )}

                    {/* Content */}
                    <div className="relative z-10 h-full p-3 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
                                <Clock size={12} /> Tiempo de Curado ({formatTime(curingTime)})
                            </span>
                            {isOverflowing ? (
                                <span className="text-xs text-red-600 flex items-center gap-1">
                                    <AlertTriangle size={12} />
                                    Operario es cuello de botella
                                </span>
                            ) : (
                                <span className="text-xs text-emerald-600 flex items-center gap-1">
                                    <CheckCircle size={12} />
                                    Tareas absorbidas
                                </span>
                            )}
                        </div>

                        {/* Internal Tasks */}
                        <div className="flex flex-wrap gap-1">
                            {internalTasks.map(task => (
                                <div
                                    key={task.id}
                                    draggable={!disabled}
                                    onDragStart={() => handleDragStart(task.id)}
                                    onClick={() => !disabled && onTaskToggle(task.id, false)}
                                    onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onTaskToggle(task.id, false); } }}
                                    tabIndex={disabled ? -1 : 0}
                                    role="button"
                                    aria-label={`${task.description}, ${formatTime(task.time)}, tarea interna. Clic o Enter para mover a externa`}
                                    className={`
                                        px-2 py-1 rounded text-xs font-medium cursor-move
                                        ${isOverflowing ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}
                                        hover:shadow-md transition-shadow focus:ring-2 focus:ring-blue-400 outline-none
                                    `}
                                >
                                    {task.description} ({formatTime(task.time)})
                                </div>
                            ))}
                            {internalTasks.length === 0 && (
                                <span className="text-xs text-slate-400 italic">
                                    Arrastrá tareas aquí → se ejecutan DURANTE el curado
                                </span>
                            )}
                        </div>

                        <div className="text-xs text-slate-500">
                            Total interno: {formatTime(totalInternal)} / {formatTime(curingTime)}
                        </div>
                    </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                    <ArrowDown size={20} className="text-slate-400" />
                </div>

                {/* External Zone */}
                <div
                    className={`
                        relative min-h-16 rounded-lg border-2 border-dashed p-3 transition-all
                        ${isDragging ? 'border-purple-400 bg-purple-50' : 'border-slate-300 bg-white'}
                    `}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(false)}
                    aria-label="Zona de tareas externas — agregan tiempo al ciclo"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
                            <MoveVertical size={12} /> Tareas Externas (máquina parada)
                        </span>
                        <span className="text-xs text-purple-600">
                            Agregan al ciclo: +{formatTime(totalExternal)}
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                        {externalTasks.map(task => (
                            <div
                                key={task.id}
                                draggable={!disabled}
                                onDragStart={() => handleDragStart(task.id)}
                                onClick={() => !disabled && onTaskToggle(task.id, true)}
                                onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onTaskToggle(task.id, true); } }}
                                tabIndex={disabled ? -1 : 0}
                                role="button"
                                aria-label={`${task.description}, ${formatTime(task.time)}, tarea externa. Clic o Enter para mover a interna`}
                                className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700 cursor-move hover:shadow-md transition-shadow focus:ring-2 focus:ring-blue-400 outline-none"
                            >
                                {task.description} ({formatTime(task.time)})
                            </div>
                        ))}
                        {externalTasks.length === 0 && (
                            <span className="text-xs text-slate-400 italic">
                                Tareas aquí agregan tiempo al ciclo
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Summary */}
            <div className={`mt-4 p-3 rounded-lg ${isOverflowing ? 'bg-red-50' : 'bg-emerald-50'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {isOverflowing ? (
                            <AlertTriangle size={18} className="text-red-500" />
                        ) : (
                            <CheckCircle size={18} className="text-emerald-500" />
                        )}
                        <span className={`font-medium ${isOverflowing ? 'text-red-700' : 'text-emerald-700'}`}>
                            Tiempo de Ciclo Efectivo
                        </span>
                    </div>
                    <span className={`text-lg font-bold ${isOverflowing ? 'text-red-700' : 'text-emerald-700'}`}>
                        {formatTime(effectiveCycle)}
                    </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                    Fórmula: Max({formatTime(curingTime)}, {formatTime(totalInternal)}) + {formatTime(totalExternal)} = {formatTime(effectiveCycle)}
                </p>
            </div>
        </div>
    );
};

/**
 * Helper: Apply curing logic to calculate effective cycle time
 */
function calculateCuringCycleTime(
    curingTime: number,
    internalTasksTime: number,
    externalTasksTime: number
): { effectiveCycle: number; isOperatorBottleneck: boolean } {
    const bottleneck = internalTasksTime > curingTime;
    const effectiveCycle = Math.max(curingTime, internalTasksTime) + externalTasksTime;

    return {
        effectiveCycle,
        isOperatorBottleneck: bottleneck
    };
}
