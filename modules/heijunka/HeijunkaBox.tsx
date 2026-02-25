/**
 * HeijunkaBox Component - Visual Production Leveling Grid
 * Phase 4: Lean Logistics Suite
 * 
 * Displays a Heijunka box grid with:
 * - Rows: Products/Models
 * - Columns: Time intervals (Pitch-based)
 * - Cells: Quantity to produce with color coding
 */

import React, { useState, useMemo } from 'react';
import {
    X,
    Grid3X3,
    Clock,
    Package,
    AlertTriangle,
    Check,
    Truck,
    Info,
    Printer,
    Download
} from 'lucide-react';
import {
    calculateHeijunka,
    ProductDemand,
    HeijunkaResult,
    HeijunkaSlot,
    getProductColor
} from './heijunkaLogic';
import { exportHeijunkaPlanExcel, validatePitchVsRoute } from './heijunkaExport';

interface HeijunkaBoxProps {
    /** Products with demands */
    products: ProductDemand[];
    /** Available production time in minutes */
    availableMinutes: number;
    /** Pitch from Mizusumashi in minutes */
    pitchMinutes: number;
    /** Start time of production */
    startTime?: string;
    /** Optional: show as modal */
    isModal?: boolean;
    /** Close handler (if modal) */
    onClose?: () => void;
    /** Project name for export */
    projectName?: string;
    /** Route name for export */
    routeName?: string;
    /** Mizusumashi route time in minutes (for validation) */
    mizusumashiRouteTime?: number;
}

export const HeijunkaBox: React.FC<HeijunkaBoxProps> = ({
    products,
    availableMinutes,
    pitchMinutes,
    startTime = '08:00',
    isModal = false,
    onClose,
    projectName = 'Heijunka',
    routeName = 'Ruta Mizusumashi',
    mizusumashiRouteTime
}) => {
    const [selectedSlot, setSelectedSlot] = useState<HeijunkaSlot | null>(null);

    // Calculate Heijunka
    const result = useMemo(() =>
        calculateHeijunka(products, availableMinutes, pitchMinutes, startTime),
        [products, availableMinutes, pitchMinutes, startTime]
    );

    // Validate Pitch vs Mizusumashi Route
    const routeValidation = useMemo(() => {
        if (mizusumashiRouteTime !== undefined) {
            return validatePitchVsRoute(pitchMinutes, mizusumashiRouteTime);
        }
        return null;
    }, [pitchMinutes, mizusumashiRouteTime]);

    // Handle print
    const handlePrint = () => {
        window.print();
    };

    // Handle Excel export
    const handleExport = () => {
        exportHeijunkaPlanExcel(result, projectName, routeName);
    };

    const content = (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between print:bg-purple-600">
                <div className="flex items-center gap-3">
                    <Grid3X3 className="w-6 h-6 text-white" />
                    <div>
                        <h2 className="text-xl font-bold text-white">Caja Heijunka</h2>
                        <p className="text-purple-200 text-sm">Plan de Producción Nivelado</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors print:hidden shadow-md"
                        title="Exportar plan Heijunka a Excel"
                    >
                        <Download size={16} />
                        Exportar Excel
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors print:hidden"
                    >
                        <Printer size={16} />
                        Imprimir
                    </button>
                    {isModal && onClose && (
                        <button
                            onClick={onClose}
                            className="text-white/70 hover:text-white transition-colors print:hidden"
                        >
                            <X size={24} />
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Bar */}
            <div className="bg-purple-50 px-6 py-3 border-b flex flex-wrap gap-4 items-center print:bg-gray-100">
                <div className="flex items-center gap-2">
                    <Clock size={18} className="text-purple-600" />
                    <span className="text-sm text-gray-600">
                        <strong>{result.totalSlots}</strong> intervalos
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Package size={18} className="text-purple-600" />
                    <span className="text-sm text-gray-600">
                        Pitch: <strong>{pitchMinutes} min</strong>
                    </span>
                </div>
                {!result.isFeasible && (
                    <div className="flex items-center gap-2 text-red-600">
                        <AlertTriangle size={18} />
                        <span className="text-sm font-medium">Alertas de capacidad</span>
                    </div>
                )}
                {routeValidation && routeValidation.severity !== 'ok' && (
                    <div className={`flex items-center gap-2 ${routeValidation.severity === 'critical' ? 'text-red-600' : 'text-amber-600'
                        }`}>
                        <Truck size={18} />
                        <span className="text-sm font-medium">
                            {routeValidation.severity === 'critical' ? 'Ruta insostenible' : 'Ruta ajustada'}
                        </span>
                    </div>
                )}
            </div>

            <div className="p-6 overflow-x-auto">
                {/* Heijunka Grid */}
                <div className="min-w-[800px]">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr>
                                <th className="sticky left-0 bg-gray-100 px-3 py-2 text-left font-semibold text-gray-700 border border-gray-200 min-w-[120px]">
                                    Modelo
                                </th>
                                {result.slots.map(slot => (
                                    <th
                                        key={slot.slotIndex}
                                        className="px-2 py-2 text-center font-medium text-gray-600 border border-gray-200 min-w-[60px] bg-gray-50"
                                    >
                                        <div className="text-xs">{slot.startTime}</div>
                                    </th>
                                ))}
                                <th className="px-3 py-2 text-center font-semibold text-gray-700 border border-gray-200 bg-gray-100">
                                    Total
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((product, productIndex) => {
                                const summary = result.productSummaries.find(
                                    s => s.productId === product.productId
                                );
                                const color = product.color || getProductColor(productIndex);

                                return (
                                    <tr key={product.productId}>
                                        {/* Product Name */}
                                        <td
                                            className="sticky left-0 bg-white px-3 py-2 font-medium border border-gray-200"
                                            style={{ borderLeftColor: color, borderLeftWidth: 4 }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: color }}
                                                />
                                                {product.productName}
                                            </div>
                                        </td>

                                        {/* Slot Cells */}
                                        {result.slots.map(slot => {
                                            const assignment = slot.assignments.find(
                                                a => a.productId === product.productId
                                            );
                                            const quantity = assignment?.quantity || 0;

                                            return (
                                                <td
                                                    key={slot.slotIndex}
                                                    className={`px-2 py-2 text-center border border-gray-200 cursor-pointer transition-colors hover:bg-gray-50 ${quantity > 0 ? '' : 'text-gray-300'
                                                        }`}
                                                    style={{
                                                        backgroundColor: quantity > 0
                                                            ? `${color}15`
                                                            : undefined
                                                    }}
                                                    onClick={() => setSelectedSlot(slot)}
                                                    title={`${product.productName}: ${quantity} unidades`}
                                                >
                                                    {quantity > 0 ? quantity : '-'}
                                                </td>
                                            );
                                        })}

                                        {/* Total */}
                                        <td className="px-3 py-2 text-center font-semibold border border-gray-200 bg-gray-50">
                                            {summary?.totalAssigned || 0}
                                        </td>
                                    </tr>
                                );
                            })}

                            {/* Totals Row */}
                            <tr className="bg-gray-100 font-semibold">
                                <td className="sticky left-0 bg-gray-100 px-3 py-2 border border-gray-200">
                                    Total Slot
                                </td>
                                {result.slots.map(slot => (
                                    <td
                                        key={slot.slotIndex}
                                        className="px-2 py-2 text-center border border-gray-200"
                                    >
                                        {slot.totalUnits}
                                    </td>
                                ))}
                                <td className="px-3 py-2 text-center border border-gray-200 text-purple-700">
                                    {result.slots.reduce((sum, s) => sum + s.totalUnits, 0)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Capacity Alerts */}
                {result.capacityAlerts.some(a => a.severity !== 'ok') && (
                    <div className="mt-6 space-y-2">
                        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-amber-500" />
                            Alertas de Capacidad
                        </h3>
                        {result.capacityAlerts
                            .filter(a => a.severity !== 'ok')
                            .map(alert => (
                                <div
                                    key={alert.productId}
                                    className={`p-3 rounded-lg border ${alert.severity === 'critical'
                                        ? 'bg-red-50 border-red-200 text-red-800'
                                        : 'bg-amber-50 border-amber-200 text-amber-800'
                                        }`}
                                >
                                    <p className="font-medium">{alert.productName}</p>
                                    <p className="text-sm">{alert.message}</p>
                                </div>
                            ))}
                    </div>
                )}

                {/* Product Summary Legend */}
                <div className="mt-6 flex flex-wrap gap-4">
                    {result.productSummaries.map(summary => (
                        <div
                            key={summary.productId}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg"
                        >
                            <div
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: summary.color }}
                            />
                            <span className="font-medium">{summary.productName}</span>
                            <span className="text-gray-500">
                                {summary.totalAssigned} pz ({summary.avgPerSlot.toFixed(1)}/slot)
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Slot Detail Modal */}
            {selectedSlot && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 print:hidden">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
                        <div className="bg-purple-600 px-4 py-3 flex items-center justify-between rounded-t-xl">
                            <div className="flex items-center gap-2 text-white">
                                <Truck size={20} />
                                <span className="font-semibold">
                                    Intervalo {selectedSlot.startTime} - {selectedSlot.endTime}
                                </span>
                            </div>
                            <button
                                onClick={() => setSelectedSlot(null)}
                                className="text-white/70 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4">
                            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                                <Package size={16} />
                                Materiales para Mizusumashi
                            </h4>
                            {selectedSlot.materialsToDeliver.length > 0 ? (
                                <ul className="space-y-2">
                                    {selectedSlot.materialsToDeliver.map((mat, i) => (
                                        <li
                                            key={i}
                                            className="flex justify-between items-center p-2 bg-gray-50 rounded"
                                        >
                                            <span className="font-medium">{mat.productName}</span>
                                            <span className="text-gray-600">
                                                {mat.quantity} pz ({mat.boxCount} cajas)
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-500 text-sm">
                                    No hay materiales programados para este intervalo.
                                </p>
                            )}
                            <div className="mt-4 pt-4 border-t text-right">
                                <span className="text-gray-500 text-sm">
                                    Total: <strong className="text-purple-700">{selectedSlot.totalUnits} unidades</strong>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // Render as modal or inline
    if (isModal) {
        return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-in fade-in duration-200 p-4">
                <div className="max-w-6xl w-full max-h-[90vh] overflow-auto animate-in slide-in-from-bottom-4 duration-300">
                    {content}
                </div>
            </div>
        );
    }

    return content;
};
