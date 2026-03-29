/**
 * RouteEditor Component - Mizusumashi Route Configuration
 * Phase 3: Lean Logistics Suite
 * 
 * Allows users to design water spider routes by selecting stops,
 * entering walk/handling times, and validating against pitch.
 */

import React, { useState, useMemo } from 'react';
import {
    X,
    Plus,
    Trash2,
    Clock,
    Route,
    Check,
    ChevronUp,
    ChevronDown,
    Package,
    Footprints
} from 'lucide-react';
import {
    calculateMizusumashi,
    formatRouteTime,
    RouteStop,
    MizusumashiResult,
    calculateLoopInventory,
    validateFrequency,
    calculatePitch,
    calculateWalkTimeFromDistance
} from './mizusumashiLogic';
import { RouteCanvas } from './RouteCanvas';

interface Station {
    id: number;
    name: string;
    kanbanBoxes?: number; // From Kanban config
}

interface RouteEditorProps {
    /** Available stations from VSM */
    stations: Station[];
    /** Takt time in seconds */
    taktTimeSeconds: number;
    /** Pieces per container from Kanban */
    packOutQuantity: number;
    /** Existing route if editing */
    existingStops?: RouteStop[];
    /** Called when route is saved */
    onSave: (stops: RouteStop[], result: MizusumashiResult) => void;
    /** Close handler */
    onClose: () => void;
}

export const RouteEditor: React.FC<RouteEditorProps> = ({
    stations,
    taktTimeSeconds,
    packOutQuantity,
    existingStops = [],
    onSave,
    onClose
}) => {
    // Route stops state
    const [stops, setStops] = useState<RouteStop[]>(
        existingStops.length > 0 ? existingStops : []
    );

    // Start time
    const [startTime, setStartTime] = useState('08:00');

    // v2.0: Milk Run Frequency
    const [milkRunFrequency, setMilkRunFrequency] = useState(30); // Default 30 min

    // Calculate results
    const result = useMemo(() =>
        calculateMizusumashi(taktTimeSeconds, packOutQuantity, stops, startTime),
        [taktTimeSeconds, packOutQuantity, stops, startTime]
    );

    // v2.0: Calculate Loop Inventory
    const loopResult = useMemo(() =>
        calculateLoopInventory(milkRunFrequency, taktTimeSeconds, packOutQuantity),
        [milkRunFrequency, taktTimeSeconds, packOutQuantity]
    );

    // v2.0: Validate Frequency
    const frequencyValidation = useMemo(() => {
        const pitchMinutes = calculatePitch(taktTimeSeconds, packOutQuantity);
        return validateFrequency(milkRunFrequency, pitchMinutes);
    }, [milkRunFrequency, taktTimeSeconds, packOutQuantity]);

    // Add stop
    const handleAddStop = (station: Station) => {
        if (stops.some(s => s.stationId === station.id)) return; // Already added

        setStops([...stops, {
            stationId: station.id,
            stationName: station.name,
            walkTimeSeconds: 60, // Default 1 min walk
            handlingTimeSeconds: 30, // Default 30 sec handling
            boxCount: station.kanbanBoxes || 1
        }]);
    };

    // Remove stop
    const handleRemoveStop = (stationId: number) => {
        setStops(stops.filter(s => s.stationId !== stationId));
    };

    // Update stop
    const handleUpdateStop = (stationId: number, updates: Partial<RouteStop>) => {
        setStops(stops.map(s =>
            s.stationId === stationId ? { ...s, ...updates } : s
        ));
    };

    // Move stop up/down
    const handleMoveStop = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= stops.length) return;

        const newStops = [...stops];
        [newStops[index], newStops[newIndex]] = [newStops[newIndex], newStops[index]];
        setStops(newStops);
    };

    // Handle save
    const handleSave = () => {
        onSave(stops, result);
    };

    // Available stations (not yet added)
    const availableStations = stations.filter(
        s => !stops.some(stop => stop.stationId === s.id)
    );

    // Alert color based on validation
    const getAlertColor = () => {
        switch (result.validation.alertLevel) {
            case 'ok': return 'bg-green-100 border-green-300 text-green-800';
            case 'warning': return 'bg-amber-100 border-amber-300 text-amber-800';
            case 'critical': return 'bg-red-100 border-red-300 text-red-800';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-600 to-amber-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Route className="w-6 h-6 text-white" />
                        <div>
                            <h2 className="text-xl font-bold text-white">Editor de Ruta Mizusumashi</h2>
                            <p className="text-orange-100 text-sm">Diseñar ruta del tren logístico</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/70 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    {/* v3.0: Visual Route Canvas */}
                    <RouteCanvas
                        stations={stations}
                        stops={stops}
                        pitchMinutes={result.pitchMinutes}
                        utilizationPercent={result.utilizationPercent}
                        alertLevel={result.validation.alertLevel}
                        onAddStop={(stationId) => {
                            const station = stations.find(s => s.id === stationId);
                            if (station) handleAddStop(station);
                        }}
                    />

                    <div className="grid lg:grid-cols-3 gap-6 mt-4">
                        {/* Left Column: Station Selector */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <Package size={18} className="text-orange-600" />
                                Estaciones Disponibles
                            </h3>

                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {availableStations.length > 0 ? (
                                    availableStations.map(station => (
                                        <button
                                            key={station.id}
                                            onClick={() => handleAddStop(station)}
                                            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-300 rounded-lg transition-colors"
                                        >
                                            <span className="font-medium text-gray-700">{station.name}</span>
                                            <Plus size={18} className="text-orange-500" />
                                        </button>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-500 italic">
                                        Todas las estaciones agregadas
                                    </p>
                                )}
                            </div>

                            {/* Pitch Info */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                                <p className="font-medium text-blue-800">⏱️ Pitch Objetivo</p>
                                <p className="text-2xl font-bold text-blue-700">
                                    {result.pitchMinutes > 0
                                        ? formatRouteTime(result.pitchMinutes)
                                        : 'No configurado'}
                                </p>
                                <p className="text-xs text-blue-600 mt-1">
                                    Takt: {(taktTimeSeconds / 60).toFixed(1)} min × {packOutQuantity} pz/caja
                                </p>
                            </div>

                            {/* Start Time */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Hora de Inicio
                                </label>
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={e => setStartTime(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                                />
                            </div>

                            {/* v2.0: Milk Run Frequency */}
                            <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
                                <label className="block text-sm font-medium text-violet-800 mb-2">
                                    🚚 Frecuencia del Milk Run
                                </label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="number"
                                        min={5}
                                        max={120}
                                        value={milkRunFrequency}
                                        onChange={e => setMilkRunFrequency(parseInt(e.target.value) || 30)}
                                        className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 ${frequencyValidation.isValid
                                            ? 'border-violet-300'
                                            : 'border-amber-400 bg-amber-50'
                                            }`}
                                    />
                                    <span className="text-sm text-violet-600">min</span>
                                </div>

                                {/* Validation Warning */}
                                {!frequencyValidation.isValid && frequencyValidation.warning && (
                                    <p className="text-xs text-amber-600 mt-2">
                                        ⚠️ {frequencyValidation.warning}
                                    </p>
                                )}

                                {/* Suggested Frequencies */}
                                {frequencyValidation.suggestedFrequencies.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-xs text-violet-600 mb-1">Frecuencias sugeridas:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {frequencyValidation.suggestedFrequencies.slice(0, 6).map(f => (
                                                <button
                                                    key={f}
                                                    type="button"
                                                    onClick={() => setMilkRunFrequency(f)}
                                                    className={`px-2 py-1 text-xs rounded ${f === milkRunFrequency
                                                        ? 'bg-violet-600 text-white'
                                                        : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                                                        }`}
                                                >
                                                    {f} min
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* v2.0: Loop Inventory Result */}
                            {loopResult.totalLoopBoxes > 0 && (
                                <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 rounded-lg p-3">
                                    <p className="text-sm font-medium text-teal-800 mb-2">
                                        📦 Inventario en Loop
                                    </p>
                                    <div className="text-3xl font-bold text-teal-700 mb-2">
                                        {loopResult.totalLoopBoxes} cajas
                                    </div>
                                    <div className="grid grid-cols-3 gap-1 text-xs">
                                        <div className="text-center bg-teal-100 rounded p-1">
                                            <div className="font-medium text-teal-700">{loopResult.boxesInLine}</div>
                                            <div className="text-teal-600">En línea</div>
                                        </div>
                                        <div className="text-center bg-amber-100 rounded p-1">
                                            <div className="font-medium text-amber-700">{loopResult.boxesInTransit}</div>
                                            <div className="text-amber-600">Tránsito</div>
                                        </div>
                                        <div className="text-center bg-blue-100 rounded p-1">
                                            <div className="font-medium text-blue-700">{loopResult.safetyBox}</div>
                                            <div className="text-blue-600">Seguridad</div>
                                        </div>
                                    </div>

                                    {/* Inventory Alert */}
                                    {loopResult.inventoryAlert && (
                                        <div className={`mt-2 p-2 rounded text-xs ${loopResult.inventoryAlert.level === 'critical'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-amber-100 text-amber-700'
                                            }`}>
                                            {loopResult.inventoryAlert.message}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Middle Column: Route Stops */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <Footprints size={18} className="text-orange-600" />
                                Paradas de la Ruta ({stops.length})
                            </h3>

                            {stops.length === 0 ? (
                                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                    <Route size={32} className="mx-auto text-gray-400 mb-2" />
                                    <p className="text-gray-500">
                                        Selecciona estaciones para<br />construir la ruta
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {stops.map((stop, index) => (
                                        <div
                                            key={stop.stationId}
                                            className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-medium text-gray-800">
                                                    {index + 1}. {stop.stationName}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleMoveStop(index, 'up')}
                                                        disabled={index === 0}
                                                        className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                                    >
                                                        <ChevronUp size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleMoveStop(index, 'down')}
                                                        disabled={index === stops.length - 1}
                                                        className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                                    >
                                                        <ChevronDown size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveStop(stop.stationId)}
                                                        className="p-1.5 hover:bg-red-100 text-red-500 rounded"
                                                        title="Eliminar parada"
                                                        aria-label="Eliminar parada"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-4 gap-2 text-sm">
                                                <div>
                                                    <label className="text-xs text-gray-500">Distancia (m)</label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        placeholder="Opcional"
                                                        value={stop.distanceMeters ?? ''}
                                                        onChange={e => {
                                                            const distance = parseInt(e.target.value) || 0;
                                                            // Auto-calculate walk time from distance
                                                            const walkTime = calculateWalkTimeFromDistance(distance);
                                                            handleUpdateStop(stop.stationId, {
                                                                distanceMeters: distance > 0 ? distance : undefined,
                                                                walkTimeSeconds: distance > 0 ? walkTime : stop.walkTimeSeconds
                                                            });
                                                        }}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500">Caminata (seg)</label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={stop.walkTimeSeconds}
                                                        onChange={e => handleUpdateStop(stop.stationId, {
                                                            walkTimeSeconds: parseInt(e.target.value) || 0,
                                                            distanceMeters: undefined // Clear distance when manually editing time
                                                        })}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500">Manipul. (seg)</label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={stop.handlingTimeSeconds}
                                                        onChange={e => handleUpdateStop(stop.stationId, {
                                                            handlingTimeSeconds: parseInt(e.target.value) || 0
                                                        })}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500">Cajas</label>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={stop.boxCount}
                                                        onChange={e => handleUpdateStop(stop.stationId, {
                                                            boxCount: parseInt(e.target.value) || 1
                                                        })}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Right Column: Results */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <Clock size={18} className="text-orange-600" />
                                Análisis de Ruta
                            </h3>

                            {/* Time Comparison */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-xl p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="text-center">
                                        <div className="text-xs text-gray-500">Tiempo Ruta</div>
                                        <div className="text-2xl font-bold text-orange-700">
                                            {formatRouteTime(result.routeTimeMinutes)}
                                        </div>
                                    </div>
                                    <div className="text-2xl text-gray-400">/</div>
                                    <div className="text-center">
                                        <div className="text-xs text-gray-500">Pitch</div>
                                        <div className="text-2xl font-bold text-blue-700">
                                            {formatRouteTime(result.pitchMinutes)}
                                        </div>
                                    </div>
                                </div>

                                {/* Utilization Bar */}
                                <div className="mb-2">
                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                        <span>Ocupación</span>
                                        <span>{result.utilizationPercent.toFixed(0)}%</span>
                                    </div>
                                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all ${result.utilizationPercent <= 70 ? 'bg-green-500' :
                                                result.utilizationPercent <= 90 ? 'bg-amber-500' :
                                                    result.utilizationPercent <= 100 ? 'bg-orange-500' :
                                                        'bg-red-500'
                                                }`}
                                            style={{ width: `${Math.min(100, result.utilizationPercent)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Validation Message */}
                            <div className={`rounded-lg p-3 border ${getAlertColor()}`}>
                                <p className="font-medium">{result.validation.message}</p>
                                {result.validation.suggestions.length > 0 && (
                                    <ul className="mt-2 text-sm space-y-1">
                                        {result.validation.suggestions.map((s, i) => (
                                            <li key={i}>• {s}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {/* Mizusumashis Needed */}
                            {result.mizusumashisNeeded > 1 && (
                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm">
                                    <p className="font-medium text-purple-800">
                                        👷 Mizusumashis Necesarios
                                    </p>
                                    <p className="text-3xl font-bold text-purple-700">
                                        {result.mizusumashisNeeded}
                                    </p>
                                </div>
                            )}

                            {/* Schedule Preview */}
                            {result.schedule.length > 0 && (
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-sm font-medium text-gray-700 mb-2">
                                        Vista Previa Horario
                                    </p>
                                    <div className="space-y-1 text-xs font-mono">
                                        {result.schedule.slice(0, 5).map((item, i) => (
                                            <div key={i} className="flex justify-between">
                                                <span className="text-gray-500">{item.arrivalTime}</span>
                                                <span className="text-gray-700 truncate ml-2" title={item.stationName}>{item.stationName}</span>
                                            </div>
                                        ))}
                                        {result.schedule.length > 5 && (
                                            <div className="text-gray-400">...</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t flex justify-between">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={stops.length === 0}
                        className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Check size={18} />
                        Guardar Ruta
                    </button>
                </div>
            </div>
        </div>
    );
};
