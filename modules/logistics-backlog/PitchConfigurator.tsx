/**
 * PitchConfigurator - V4.8 UX Redesign
 * 
 * Assisted Pitch selector following expert recommendation:
 * - Shows calculated "Theoretical Pitch"
 * - User selects "Operative Pitch" from standard intervals
 * - Validates against Mizusumashi cycle time
 * - Shows warning if selected pitch is too short
 */
import React from 'react';
import {
    Truck,
    Clock,
    AlertTriangle,
    CheckCircle,
    Info
} from 'lucide-react';
import { InfoTooltip, LEAN_TOOLTIPS } from '../../components/ui/InfoTooltip';

interface PitchConfiguratorProps {
    /** Takt time in seconds */
    taktTime: number;
    /** Quantity per package/container */
    packageQuantity: number;
    /** Currently selected pitch in minutes */
    selectedPitch: number;
    /** Callback when pitch changes */
    onPitchChange: (pitchMinutes: number) => void;
    /** Optional: Mizusumashi cycle time in minutes (for validation) */
    mizusumashiCycleTime?: number;
    /** Disable the selector */
    disabled?: boolean;
}

// Standard pitch intervals (per expert recommendation)
const PITCH_OPTIONS = [15, 20, 30, 60];

const PitchConfigurator: React.FC<PitchConfiguratorProps> = ({
    taktTime,
    packageQuantity,
    selectedPitch,
    onPitchChange,
    mizusumashiCycleTime,
    disabled = false
}) => {
    // Calculate theoretical pitch: Takt × Package Quantity
    // FIX: Guard against NaN/Infinity from invalid taktTime propagating to .toFixed() calls
    const safeTaktTime = Number.isFinite(taktTime) ? taktTime : 0;
    const theoreticalPitchSeconds = safeTaktTime * packageQuantity;
    const theoreticalPitchMinutes = theoreticalPitchSeconds / 60;

    // Find recommended pitch (next standard interval >= theoretical)
    const recommendedPitch = PITCH_OPTIONS.find(p => p >= theoreticalPitchMinutes) || 60;

    // Validation
    const isBelowTheoretical = selectedPitch < theoreticalPitchMinutes;
    const isBelowMizusumashi = mizusumashiCycleTime && selectedPitch < mizusumashiCycleTime;
    const hasWarning = isBelowTheoretical || isBelowMizusumashi;

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-100 rounded-lg">
                    <Truck size={20} className="text-indigo-600" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <InfoTooltip
                            term="Pitch"
                            simple={LEAN_TOOLTIPS.pitch.simple}
                            formula={LEAN_TOOLTIPS.pitch.formula}
                            inline={false}
                        />
                    </h3>
                    <p className="text-xs text-slate-500">
                        Cada cuántos minutos pasa el Mizusumashi (carretillero)
                    </p>
                </div>
            </div>

            {/* Theoretical Pitch Display */}
            <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600 flex items-center gap-1">
                        <Clock size={14} />
                        Pitch Teórico (calculado)
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                        {theoreticalPitchMinutes.toFixed(1)} min
                    </span>
                </div>
                <p className="text-xs text-slate-500">
                    = Takt ({safeTaktTime.toFixed(1)}s) × Cantidad Paquete ({packageQuantity} pz) / 60
                </p>
            </div>

            {/* Pitch Selector */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Pitch Operativo (seleccioná uno)
                </label>
                <div className="grid grid-cols-4 gap-2">
                    {PITCH_OPTIONS.map((pitch) => {
                        const isSelected = selectedPitch === pitch;
                        const isRecommended = pitch === recommendedPitch;
                        const isTooShort = pitch < theoreticalPitchMinutes;

                        return (
                            <button
                                key={pitch}
                                onClick={() => onPitchChange(pitch)}
                                disabled={disabled}
                                className={`
                                    relative px-4 py-3 rounded-lg border-2 transition-all
                                    ${isSelected
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                        : 'border-slate-200 hover:border-slate-300 text-slate-600'}
                                    ${isTooShort && !isSelected ? 'opacity-60' : ''}
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                `}
                            >
                                <span className="font-bold">{pitch}</span>
                                <span className="text-xs ml-1">min</span>

                                {/* Recommended badge */}
                                {isRecommended && (
                                    <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                                        ✓
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Validation Warnings */}
            {hasWarning && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-amber-800">
                            ⚠️ Riesgo de Desabastecimiento
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                            {isBelowMizusumashi && mizusumashiCycleTime
                                ? `El Mizusumashi tarda ${mizusumashiCycleTime} minutos en su ruta. Con un Pitch de ${selectedPitch} min, no va a llegar a tiempo.`
                                : `El Pitch seleccionado (${selectedPitch} min) es menor al teórico (${theoreticalPitchMinutes.toFixed(1)} min). Esto puede romper el flujo.`
                            }
                        </p>
                    </div>
                </div>
            )}

            {/* Success State */}
            {!hasWarning && selectedPitch > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                    <CheckCircle size={18} className="text-emerald-500" />
                    <p className="text-sm text-emerald-700">
                        ✓ Pitch válido: el Mizusumashi pasará cada {selectedPitch} minutos
                    </p>
                </div>
            )}

            {/* Info Box */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <div className="flex items-start gap-2">
                    <Info size={14} className="text-blue-500 mt-0.5" />
                    <p className="text-xs text-blue-700">
                        <strong>Tip:</strong> El Pitch debe ser igual o mayor al tiempo que tarda
                        tu carretillero en dar una vuelta completa. Si es menor, la línea se va a quedar
                        sin material.
                    </p>
                </div>
            </div>
        </div>
    );
};
