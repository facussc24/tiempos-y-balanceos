/**
 * KanbanCalculator Component - Visual Supermarket Dimensioning Tool
 * Phase 2: Lean Logistics Suite
 * 
 * This modal allows users to calculate the optimal number of containers
 * for a supermarket/buffer point, with visual shelf representation.
 * 
 * Features:
 * - Inputs: Replenishment time, pieces per container, safety margin
 * - Output: Number K with visual shelf (Green/Yellow/Red zones)
 * - Auto-inherits demand from Takt Time
 */

import React, { useState, useMemo } from 'react';

// FIX: Safe parseFloat that returns fallback instead of NaN (NaN || 0 returns NaN, not 0!)
const safeParseFloat = (v: string, fallback = 0): number => { const n = parseFloat(v); return isNaN(n) ? fallback : n; };
import { X, Package, Calculator, AlertTriangle, Check, Info, Clock, Box, ChevronDown } from 'lucide-react';
import {
    calculateKanban,
    convertToHours,
    formatKanbanDisplay,
    KanbanResult,
    calculateTotalLeadTime,
    LeadTimeBreakdown
} from './kanbanLogic';
import {
    getAllContainers,
    getContainerById,
    calculateContainersPerPallet,
    formatDimensions,
    getCategoryColor
} from './vdaContainerLibrary';

interface KanbanCalculatorProps {
    /** Item name (e.g., "Botones", "Ejes") */
    itemName?: string;
    /** Daily demand from project (pieces/day) */
    dailyDemand: number;
    /** Shift hours per day (for demand/hour calculation) */
    shiftHoursPerDay: number;
    /** Current actual inventory in pieces (from VSM) */
    currentInventory?: number;
    /** Container capacity default */
    defaultContainerCapacity?: number;
    /** Called when user saves the configuration */
    onSave: (result: KanbanResult & {
        itemName: string;
        replenishmentTime: number;
        replenishmentUnit: 'minutes' | 'hours' | 'days';
        containerCapacity: number;
        safetyMargin: number;
    }) => void;
    /** Close handler */
    onClose: () => void;
}

export const KanbanCalculator: React.FC<KanbanCalculatorProps> = ({
    itemName: initialItemName = '',
    dailyDemand,
    shiftHoursPerDay,
    currentInventory = 0,
    defaultContainerCapacity = 50,
    onSave,
    onClose
}) => {
    // Form state
    const [itemName, setItemName] = useState(initialItemName);
    const [replenishmentTime, setReplenishmentTime] = useState(4);
    const [replenishmentUnit, setReplenishmentUnit] = useState<'minutes' | 'hours' | 'days'>('hours');
    const [containerCapacity, setContainerCapacity] = useState(defaultContainerCapacity);
    const [safetyMargin, setSafetyMargin] = useState(15); // Percentage

    // v2.1: VDA Container Selection
    const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
    const selectedContainer = selectedContainerId ? getContainerById(selectedContainerId) : null;
    const availableContainers = getAllContainers();

    // v2.0: New options
    const [applyPlusOneRule, setApplyPlusOneRule] = useState(true); // Default: true

    // v2.0: Lead Time Avanzado (desglosado)
    const [showAdvancedLeadTime, setShowAdvancedLeadTime] = useState(false);
    const [orderProcessingHours, setOrderProcessingHours] = useState(0.5);
    const [supplierTravelHours, setSupplierTravelHours] = useState(2);
    const [receptionHours, setReceptionHours] = useState(0.5);
    const [qualityInspectionHours, setQualityInspectionHours] = useState(0.5);
    const [putawayHours, setPutawayHours] = useState(0.5);

    // Manual demand input for when project demand is not configured
    const [manualDemandPerHour, setManualDemandPerHour] = useState<number | null>(null);

    // Calculate demand per hour - use manual if project demand is 0
    const effectiveShiftHours = shiftHoursPerDay > 0 ? shiftHoursPerDay : 8;
    const projectDemandPerHour = dailyDemand > 0 ? dailyDemand / effectiveShiftHours : 0;
    const demandPerHour = manualDemandPerHour !== null ? manualDemandPerHour : projectDemandPerHour;
    const hasDemandConfigured = demandPerHour > 0;

    // Calculate Kanban
    const kanbanResult = useMemo(() => {
        // Usar Lead Time simple o desglosado
        let effectiveLeadTimeHours: number;
        let leadTimeBreakdown: LeadTimeBreakdown | undefined;

        if (showAdvancedLeadTime) {
            leadTimeBreakdown = {
                orderProcessingHours,
                supplierTravelHours,
                receptionHours,
                qualityInspectionHours,
                putawayHours
            };
            effectiveLeadTimeHours = calculateTotalLeadTime(leadTimeBreakdown);
        } else {
            effectiveLeadTimeHours = convertToHours(replenishmentTime, replenishmentUnit);
        }

        return calculateKanban({
            demandPerHour: hasDemandConfigured ? demandPerHour : 100, // Default to 100/hr for preview
            replenishmentTimeHours: effectiveLeadTimeHours,
            safetyMargin: safetyMargin / 100, // Convert % to decimal
            containerCapacity,
            currentInventory,
            applyPlusOneRule,
            leadTimeBreakdown  // v2.0: Pasar el desglose si está disponible
        });
    }, [demandPerHour, hasDemandConfigured, replenishmentTime, replenishmentUnit, safetyMargin, containerCapacity, currentInventory, applyPlusOneRule, showAdvancedLeadTime, orderProcessingHours, supplierTravelHours, receptionHours, qualityInspectionHours, putawayHours]);

    // Format for display
    const display = useMemo(() =>
        formatKanbanDisplay(kanbanResult),
        [kanbanResult]
    );

    // Handle save
    const handleSave = () => {
        onSave({
            ...kanbanResult,
            itemName,
            replenishmentTime,
            replenishmentUnit,
            containerCapacity,
            safetyMargin: safetyMargin / 100
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-modal-backdrop animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Calculator className="w-6 h-6 text-white" />
                        <div>
                            <h2 className="text-xl font-bold text-white">Calculadora Kanban</h2>
                            <p className="text-emerald-100 text-sm">Dimensionar Supermercado</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/70 hover:text-white transition-colors"
                        title="Cerrar" aria-label="Cerrar calculadora kanban"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Left Column: Inputs */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <Package size={18} className="text-emerald-600" />
                                Configuración
                            </h3>

                            {/* Item Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nombre del Ítem
                                </label>
                                <input
                                    type="text"
                                    value={itemName}
                                    onChange={e => setItemName(e.target.value)}
                                    placeholder="Ej: Botones, Tela, Ejes..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>

                            {/* Replenishment Time - Simple mode */}
                            {!showAdvancedLeadTime && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Tiempo de Reposición
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            min={1}
                                            value={replenishmentTime}
                                            onChange={e => setReplenishmentTime(parseInt(e.target.value) || 1)}
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                        />
                                        <select
                                            value={replenishmentUnit}
                                            onChange={e => setReplenishmentUnit(e.target.value as 'minutes' | 'hours' | 'days')}
                                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                        >
                                            <option value="minutes">Minutos</option>
                                            <option value="hours">Horas</option>
                                            <option value="days">Días</option>
                                        </select>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        ¿Cuánto tarda el almacén en traer más material?
                                    </p>
                                </div>
                            )}

                            {/* v2.0: Lead Time Avanzado - Desglosado */}
                            <div className="border border-indigo-200 rounded-lg overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setShowAdvancedLeadTime(!showAdvancedLeadTime)}
                                    className={`w-full px-3 py-2 flex items-center justify-between text-sm font-medium transition-colors ${showAdvancedLeadTime
                                        ? 'bg-indigo-100 text-indigo-800'
                                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                        }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <Clock size={16} />
                                        Lead Time Avanzado
                                    </span>
                                    <span className="text-xs">
                                        {showAdvancedLeadTime ? '▲ Ocultar' : '▼ Desglosar'}
                                    </span>
                                </button>

                                {showAdvancedLeadTime && (
                                    <div className="p-3 bg-indigo-50/50 space-y-3">
                                        <p className="text-xs text-indigo-600 mb-2">
                                            El Lead Time NO es solo el viaje. Incluye todas las etapas:
                                        </p>

                                        {/* Orden Processing */}
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-gray-600 w-28">Procesar orden</label>
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.5}
                                                value={orderProcessingHours}
                                                onChange={e => setOrderProcessingHours(safeParseFloat(e.target.value))}
                                                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                                            />
                                            <span className="text-xs text-gray-500">hrs</span>
                                        </div>

                                        {/* Supplier Travel */}
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-gray-600 w-28">Viaje proveedor</label>
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.5}
                                                value={supplierTravelHours}
                                                onChange={e => setSupplierTravelHours(safeParseFloat(e.target.value))}
                                                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                                            />
                                            <span className="text-xs text-gray-500">hrs</span>
                                        </div>

                                        {/* Reception */}
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-gray-600 w-28">Recepción</label>
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.5}
                                                value={receptionHours}
                                                onChange={e => setReceptionHours(safeParseFloat(e.target.value))}
                                                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                                            />
                                            <span className="text-xs text-gray-500">hrs</span>
                                        </div>

                                        {/* Quality Inspection */}
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-gray-600 w-28">Inspección</label>
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.5}
                                                value={qualityInspectionHours}
                                                onChange={e => setQualityInspectionHours(safeParseFloat(e.target.value))}
                                                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                                            />
                                            <span className="text-xs text-gray-500">hrs</span>
                                        </div>

                                        {/* Putaway */}
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-gray-600 w-28">Acomodo</label>
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.5}
                                                value={putawayHours}
                                                onChange={e => setPutawayHours(safeParseFloat(e.target.value))}
                                                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                                            />
                                            <span className="text-xs text-gray-500">hrs</span>
                                        </div>

                                        {/* Total */}
                                        <div className="flex items-center justify-between pt-2 border-t border-indigo-200">
                                            <span className="text-sm font-medium text-indigo-800">Lead Time Total:</span>
                                            <span className="text-sm font-bold text-indigo-700">
                                                {(orderProcessingHours + supplierTravelHours + receptionHours + qualityInspectionHours + putawayHours).toFixed(1)} horas
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* v2.1: VDA Container Selector */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                    <Package size={16} className="text-teal-600" />
                                    Tipo de Contenedor (VDA/KLT)
                                </label>
                                <div className="relative">
                                    <select
                                        value={selectedContainerId || ''}
                                        onChange={e => {
                                            const id = e.target.value || null;
                                            setSelectedContainerId(id);
                                            // Auto-fill capacity when selecting a VDA container
                                            if (id && id !== 'CUSTOM') {
                                                const container = getContainerById(id);
                                                if (container) {
                                                    setContainerCapacity(container.defaultCapacity);
                                                }
                                            }
                                        }}
                                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 appearance-none bg-white"
                                    >
                                        <option value="">Seleccionar contenedor...</option>
                                        {availableContainers.map(container => (
                                            <option key={container.id} value={container.id}>
                                                {container.name} {container.category !== 'custom' ? `(${container.defaultCapacity} pz)` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                                {/* Container info hint */}
                                {selectedContainer && selectedContainer.category !== 'custom' && (
                                    <div className="mt-2 flex items-center justify-between text-xs">
                                        <span className={`px-2 py-0.5 rounded border ${getCategoryColor(selectedContainer.category)}`}>
                                            {formatDimensions(selectedContainer)}
                                        </span>
                                        <span className="text-teal-600 font-medium">
                                            📦 {calculateContainersPerPallet(selectedContainer)} por pallet EUR
                                        </span>
                                    </div>
                                )}
                                {selectedContainer && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {selectedContainer.description}
                                    </p>
                                )}
                            </div>

                            {/* Container Capacity */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Piezas por Caja
                                    {selectedContainer && selectedContainer.category !== 'custom' && (
                                        <span className="text-xs text-gray-400 ml-2">(ajustable)</span>
                                    )}
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={containerCapacity}
                                    onChange={e => setContainerCapacity(parseInt(e.target.value) || 1)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                />
                                {selectedContainer && selectedContainer.category !== 'custom' && containerCapacity !== selectedContainer.defaultCapacity && (
                                    <p className="text-xs text-amber-600 mt-1">
                                        ⚠️ Valor modificado (default: {selectedContainer.defaultCapacity})
                                    </p>
                                )}
                            </div>

                            {/* Safety Margin Slider */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Margen de Seguridad: {safetyMargin}%
                                </label>
                                <input
                                    type="range"
                                    min={0}
                                    max={50}
                                    value={safetyMargin}
                                    onChange={e => setSafetyMargin(parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                />
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>0%</span>
                                    <span>25%</span>
                                    <span>50%</span>
                                </div>
                            </div>

                            {/* v2.0: Plus One Rule Toggle */}
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="text-sm font-medium text-emerald-800">
                                            Regla del +1
                                        </label>
                                        <p className="text-xs text-emerald-600">
                                            Agrega un cajón extra para continuidad
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setApplyPlusOneRule(!applyPlusOneRule)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${applyPlusOneRule ? 'bg-emerald-600' : 'bg-gray-300'
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${applyPlusOneRule ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>
                            </div>

                            {/* Inherited Data Info or Manual Input */}
                            {hasDemandConfigured ? (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                                    <div className="flex items-start gap-2">
                                        <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                                        <div className="text-blue-700">
                                            <p><strong>Demanda:</strong> {demandPerHour.toFixed(1)} pz/hora</p>
                                            <p className="text-xs text-blue-600 mt-1">
                                                (Heredado del Takt Time: {dailyDemand} pz/día)
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                        <div className="text-amber-700 w-full">
                                            <p className="font-medium">Demanda no configurada</p>
                                            <p className="text-xs mb-2">Ingresa la demanda manualmente o configura el Takt en el proyecto.</p>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    placeholder="pz/hora"
                                                    value={manualDemandPerHour || ''}
                                                    onChange={e => setManualDemandPerHour(parseInt(e.target.value) || null)}
                                                    className="flex-1 px-2 py-1 border border-amber-300 rounded text-sm focus:ring-2 focus:ring-amber-400"
                                                />
                                                <span className="text-xs text-amber-600">pz/hora</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Column: Results */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <Box size={18} className="text-emerald-600" />
                                Resultado
                            </h3>

                            {/* Big K Number */}
                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl p-6 text-center">
                                <div className="text-6xl font-bold text-emerald-700">
                                    {kanbanResult.kanbanCount}
                                </div>
                                <div className="text-emerald-600 font-medium">
                                    {kanbanResult.kanbanCount === 1 ? 'Caja' : 'Cajas'} Kanban
                                </div>
                                {/* v2.0: Mostrar transparencia del cálculo */}
                                {kanbanResult.plusOneApplied && (
                                    <div className="text-xs text-emerald-500 mt-2 bg-emerald-100 rounded-full px-3 py-1 inline-block">
                                        = {kanbanResult.baseCount} base + 1 continuidad
                                    </div>
                                )}
                                <div className="text-sm text-gray-600 mt-2">
                                    = {kanbanResult.totalPieces} piezas
                                </div>
                            </div>

                            {/* Visual Shelf - Green/Yellow/Red Zones */}
                            <div className="space-y-2">
                                <div className="text-sm font-medium text-gray-700">Estantería Visual</div>
                                <div className="flex gap-1 h-16">
                                    {Array.from({ length: kanbanResult.kanbanCount }, (_, i) => {
                                        const binNumber = i + 1;
                                        let color = 'bg-green-400';
                                        let zone = 'Verde';

                                        if (binNumber <= kanbanResult.reorderPoint) {
                                            color = 'bg-red-400';
                                            zone = 'Rojo';
                                        } else if (binNumber <= Math.ceil(kanbanResult.kanbanCount * 0.7)) {
                                            color = 'bg-yellow-400';
                                            zone = 'Amarillo';
                                        }

                                        return (
                                            <div
                                                key={i}
                                                className={`flex-1 ${color} rounded transition-all hover:scale-105 cursor-help`}
                                                title={`Caja ${binNumber} - Zona ${zone}`}
                                            />
                                        );
                                    })}
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-red-600 font-medium">
                                        🔴 Reponer ≤{kanbanResult.reorderPoint}
                                    </span>
                                    <span className="text-green-600 font-medium">
                                        🟢 OK
                                    </span>
                                </div>
                            </div>

                            {/* Metrics */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <div className="text-gray-500">Punto de Reorden</div>
                                    <div className="font-semibold text-red-600">
                                        ≤ {kanbanResult.reorderPoint} cajas
                                    </div>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <div className="text-gray-500">Stock de Seguridad</div>
                                    <div className="font-semibold text-amber-600">
                                        {kanbanResult.safetyStockQty} piezas
                                    </div>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                                    <div className="text-gray-500 flex items-center gap-1">
                                        <Clock size={14} />
                                        Cobertura
                                    </div>
                                    <div className="font-semibold text-teal-600">
                                        {display.coverageDisplay}
                                    </div>
                                </div>
                            </div>

                            {/* Overstock Warning */}
                            {kanbanResult.isOverstock && currentInventory > 0 && (
                                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-2">
                                    <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm">
                                        <p className="font-medium text-amber-800">Exceso de Inventario</p>
                                        <p className="text-amber-700">
                                            Actual: {currentInventory} pz | Ideal: {kanbanResult.totalPieces} pz
                                        </p>
                                        <p className="text-amber-600 text-xs mt-1">
                                            Oportunidad de reducción: {kanbanResult.overstockPieces} piezas (Muda)
                                        </p>
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
                        className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        <Check size={18} />
                        Guardar Configuración
                    </button>
                </div>
            </div>
        </div>
    );
};
