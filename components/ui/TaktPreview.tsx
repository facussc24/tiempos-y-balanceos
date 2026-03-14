/**
 * TaktPreview - Real-time Takt Time Calculator Preview
 * 
 * Shows live calculation of Takt Time as user modifies configuration.
 * Provides immediate feedback on how changes affect production rhythm.
 * 
 * @module components/ui/TaktPreview
 * @version 1.0.0 - Phase 1 Completion
 */
import React, { useMemo } from 'react';
import { Clock, TrendingDown, AlertTriangle, Settings } from 'lucide-react';
import { Shift } from '../../types';
import { calculateTaktTime, calculateShiftNetMinutes } from '../../core/balancing/simulation';
import { formatTime } from '../../modules/flow-simulator/flowUtils';

export interface TaktPreviewProps {
    /** Array of shift configurations */
    shifts: Shift[];
    /** Number of active shifts (1-3) */
    activeShifts: number;
    /** Daily demand in pieces */
    dailyDemand: number;
    /** OEE factor (0-1) */
    oee: number;
    /** Optional setup loss percentage (0-0.20) */
    setupLossPercent?: number;
    /** Show compact version */
    compact?: boolean;
}

export interface TaktPreviewResult {
    totalAvailableMinutes: number;
    netAvailableMinutes: number;
    nominalTaktSeconds: number;
    effectiveTaktSeconds: number;
    setupLossApplied: number;
    hasSetupLoss: boolean;
}

/**
 * Format minutes to hours and minutes
 */
const formatHoursMinutes = (minutes: number): string => {
    if (minutes <= 0) return '—';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours === 0) return `${mins} min`;
    return `${hours}h ${mins}m`;
};

export const TaktPreview: React.FC<TaktPreviewProps> = ({
    shifts,
    activeShifts,
    dailyDemand,
    oee,
    setupLossPercent = 0,
    compact = false
}) => {
    const result = useMemo((): TaktPreviewResult => {
        if (!shifts || shifts.length === 0 || activeShifts <= 0) {
            return {
                totalAvailableMinutes: 0,
                netAvailableMinutes: 0,
                nominalTaktSeconds: 0,
                effectiveTaktSeconds: 0,
                setupLossApplied: 0,
                hasSetupLoss: false
            };
        }

        const taktResult = calculateTaktTime(shifts, activeShifts, dailyDemand, oee, setupLossPercent);

        return {
            totalAvailableMinutes: taktResult.totalAvailableMinutes,
            netAvailableMinutes: taktResult.netAvailableMinutes,
            nominalTaktSeconds: taktResult.nominalSeconds,
            effectiveTaktSeconds: taktResult.effectiveSeconds,
            setupLossApplied: taktResult.setupLossApplied,
            hasSetupLoss: setupLossPercent > 0
        };
    }, [shifts, activeShifts, dailyDemand, oee, setupLossPercent]);

    const isValid = dailyDemand > 0 && result.totalAvailableMinutes > 0;

    if (compact) {
        return (
            <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-gray-600">Takt:</span>
                <span className="font-medium text-blue-600">
                    {isValid ? formatTime(result.effectiveTaktSeconds) : '—'}
                </span>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
            <div className="flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-800">Preview de Takt Time</h3>
            </div>

            {!isValid ? (
                <div className="flex items-center gap-2 text-amber-600 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Configura demanda y turnos para calcular</span>
                </div>
            ) : (
                <div className="space-y-2">
                    {/* Available Time */}
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Tiempo disponible:</span>
                        <span className="font-medium">
                            {formatHoursMinutes(result.totalAvailableMinutes)} netas
                        </span>
                    </div>

                    {/* Demand */}
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Demanda:</span>
                        <span className="font-medium">
                            {dailyDemand.toLocaleString()} piezas
                        </span>
                    </div>

                    <div className="border-t border-blue-200 my-2" />

                    {/* Nominal Takt */}
                    <div className="flex justify-between items-center">
                        <span className="text-gray-600 text-sm">Takt Nominal:</span>
                        <span className="font-semibold text-lg text-gray-800">
                            {formatTime(result.nominalTaktSeconds)}
                        </span>
                    </div>

                    {/* Effective Takt (with OEE) */}
                    <div className="flex justify-between items-center bg-blue-100 rounded px-2 py-1">
                        <span className="text-blue-700 text-sm font-medium">
                            Takt Efectivo (OEE {(oee * 100).toFixed(0)}%):
                        </span>
                        <span className="font-bold text-xl text-blue-700">
                            {formatTime(result.effectiveTaktSeconds)}
                        </span>
                    </div>

                    {/* Setup Loss Warning */}
                    {result.hasSetupLoss && (
                        <div className="flex items-center gap-2 text-amber-600 text-sm mt-2">
                            <Settings className="w-4 h-4" />
                            <span>
                                Setup Loss ({(result.setupLossApplied * 100).toFixed(0)}%):
                                reduce tiempo disponible a {formatHoursMinutes(result.netAvailableMinutes)}
                            </span>
                        </div>
                    )}

                    {/* Interpretation help */}
                    <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-blue-100">
                        💡 Si una estación tarda más de {formatTime(result.effectiveTaktSeconds)},
                        es cuello de botella.
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaktPreview;
