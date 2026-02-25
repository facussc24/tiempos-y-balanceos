/**
 * CuringBar - Visual component for injection/curing process visualization
 * 
 * Shows the time breakdown for injection molding processes:
 * - Gray background bar: Total curing time (chemical constraint)
 * - Green segments: Internal operations (performed during curing)
 * - Orange segments: External operations (performed after curing)
 * 
 * @module components/charts/CuringBar
 * @version 1.0.0 - Phase 3 Completion
 */
import React from 'react';
import { formatNumber } from '../../utils';

export interface CuringOperation {
    name: string;
    type: 'internal' | 'external';
    time: number;
}

export interface CuringBarProps {
    /** Total curing/chemical time in seconds */
    curingTime: number;
    /** Injection time (mold closing + filling) in seconds */
    injectionTime: number;
    /** Manual operations during/after curing */
    operations: CuringOperation[];
    /** Takt time for comparison line */
    taktTime: number;
    /** Height of the bar in pixels */
    height?: number;
    /** Whether to show compact version */
    compact?: boolean;
}

/**
 * Calculate if internal operations exceed curing time (warning state)
 */
export const calculateCuringStatus = (
    curingTime: number,
    operations: CuringOperation[]
): { internalTotal: number; externalTotal: number; isOverloaded: boolean; freeTime: number } => {
    const internalTotal = operations
        .filter(op => op.type === 'internal')
        .reduce((sum, op) => sum + op.time, 0);

    const externalTotal = operations
        .filter(op => op.type === 'external')
        .reduce((sum, op) => sum + op.time, 0);

    const freeTime = curingTime - internalTotal;
    const isOverloaded = internalTotal > curingTime;

    return { internalTotal, externalTotal, isOverloaded, freeTime };
};

export const CuringBar: React.FC<CuringBarProps> = ({
    curingTime,
    injectionTime,
    operations,
    taktTime,
    height = 120,
    compact = false
}) => {
    const status = calculateCuringStatus(curingTime, operations);
    const totalRealCycle = Math.max(curingTime, status.internalTotal) + status.externalTotal;
    const maxTime = Math.max(taktTime, totalRealCycle) * 1.1; // 10% margin for visualization

    // Calculate heights as percentages
    const curingHeight = (curingTime / maxTime) * 100;
    const internalHeight = (status.internalTotal / maxTime) * 100;
    const externalHeight = (status.externalTotal / maxTime) * 100;
    const taktLinePosition = (taktTime / maxTime) * 100;

    const internalOps = operations.filter(op => op.type === 'internal');
    const externalOps = operations.filter(op => op.type === 'external');

    if (compact) {
        return (
            <div className="flex items-center gap-2 text-xs">
                <div
                    className={`w-3 h-3 rounded ${status.isOverloaded ? 'bg-red-400' : 'bg-slate-400'}`}
                    title={`Curado: ${formatNumber(curingTime)}s`}
                />
                <span className="text-slate-600">
                    {formatNumber(curingTime)}s curado
                </span>
                {status.isOverloaded && (
                    <span className="text-red-500 font-medium">⚠️ Sobrecarga</span>
                )}
            </div>
        );
    }

    return (
        <div className="relative" style={{ height }}>
            {/* Takt Line Reference */}
            <div
                className="absolute w-full border-t-2 border-red-500 border-dashed z-20"
                style={{ bottom: `${taktLinePosition}%` }}
            >
                <span className="absolute -top-4 right-0 text-[10px] text-red-500 font-medium">
                    Takt {formatNumber(taktTime)}s
                </span>
            </div>

            {/* Bar Container */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-center">
                <div className="relative w-16">

                    {/* Curing Background (Gray) */}
                    <div
                        className={`absolute bottom-0 w-full rounded-t transition-all ${status.isOverloaded
                                ? 'bg-gradient-to-t from-red-200 to-red-100 border-2 border-red-300'
                                : 'bg-gradient-to-t from-slate-300 to-slate-200'
                            }`}
                        style={{ height: `${curingHeight}%` }}
                        title={`Tiempo de Curado: ${formatNumber(curingTime)}s`}
                    >
                        {/* Curado label */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[9px] font-bold text-slate-500 rotate-90 whitespace-nowrap">
                                CURADO
                            </span>
                        </div>
                    </div>

                    {/* Internal Operations (Green, stacked inside curing) */}
                    <div
                        className="absolute bottom-0 w-full flex flex-col-reverse"
                        style={{ height: `${curingHeight}%` }}
                    >
                        {internalOps.map((op, idx) => {
                            const opHeight = (op.time / curingTime) * 100;
                            return (
                                <div
                                    key={`internal-${idx}`}
                                    className="w-full bg-emerald-400/80 border-b border-emerald-500 flex items-center justify-center overflow-hidden"
                                    style={{ height: `${Math.min(opHeight, 100)}%` }}
                                    title={`${op.name}: ${formatNumber(op.time)}s (interno)`}
                                >
                                    <span className="text-[8px] text-emerald-800 font-medium truncate px-1">
                                        {op.name}
                                    </span>
                                </div>
                            );
                        })}

                        {/* Free time indicator */}
                        {status.freeTime > 0 && (
                            <div
                                className="w-full flex items-center justify-center"
                                style={{ height: `${(status.freeTime / curingTime) * 100}%` }}
                            >
                                <span className="text-[8px] text-slate-400">
                                    {formatNumber(status.freeTime)}s libre
                                </span>
                            </div>
                        )}
                    </div>

                    {/* External Operations (Orange, above curing) */}
                    <div
                        className="absolute w-full flex flex-col-reverse"
                        style={{ bottom: `${curingHeight}%` }}
                    >
                        {externalOps.map((op, idx) => {
                            const opHeight = (op.time / maxTime) * 100;
                            return (
                                <div
                                    key={`external-${idx}`}
                                    className="w-full bg-amber-400 border-b border-amber-500 flex items-center justify-center overflow-hidden"
                                    style={{ height: opHeight }}
                                    title={`${op.name}: ${formatNumber(op.time)}s (externo)`}
                                >
                                    <span className="text-[8px] text-amber-800 font-medium truncate px-1">
                                        {op.name}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="absolute bottom-0 left-0 text-[9px] space-y-0.5">
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-slate-300 rounded"></div>
                    <span className="text-slate-500">Curado</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-emerald-400 rounded"></div>
                    <span className="text-slate-500">Interno</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-amber-400 rounded"></div>
                    <span className="text-slate-500">Externo</span>
                </div>
            </div>

            {/* Summary */}
            <div className="absolute top-0 right-0 text-right text-[10px]">
                <div className="text-slate-600">
                    Ciclo Real: <span className="font-bold">{formatNumber(totalRealCycle)}s</span>
                </div>
                {status.isOverloaded && (
                    <div className="text-red-500 font-medium">
                        ⚠️ Ops Internas exceden curado
                    </div>
                )}
            </div>
        </div>
    );
};

export default CuringBar;
