/**
 * StandardWorkCard Component - Printable Mizusumashi Route Card
 * Phase 3: Lean Logistics Suite
 * 
 * Displays a printable "Standard Work" card for the water spider
 * showing the schedule of stops with arrival times.
 */

import React from 'react';
import { Clock, Route, AlertTriangle, Printer, Box, ArrowRight } from 'lucide-react';
import { MizusumashiResult, formatRouteTime } from './mizusumashiLogic';

interface StandardWorkCardProps {
    /** Route name */
    routeName: string;
    /** Calculated mizusumashi result */
    result: MizusumashiResult;
    /** Optional: Show print button */
    showPrintButton?: boolean;
    /** Optional: Compact mode for embedding */
    compact?: boolean;
}

export const StandardWorkCard: React.FC<StandardWorkCardProps> = ({
    routeName,
    result,
    showPrintButton = true,
    compact = false
}) => {
    const handlePrint = () => {
        window.print();
    };

    // Alert styling based on feasibility
    const getStatusStyle = () => {
        if (result.isRouteFeasible) {
            return result.utilizationPercent <= 80
                ? 'bg-green-100 text-green-800 border-green-300'
                : 'bg-amber-100 text-amber-800 border-amber-300';
        }
        return 'bg-red-100 text-red-800 border-red-300';
    };

    const getStatusIcon = () => {
        if (result.isRouteFeasible) {
            return result.utilizationPercent <= 80 ? '✅' : '⚠️';
        }
        return '🔴';
    };

    return (
        <div className={`bg-white border-2 border-gray-300 rounded-lg shadow-lg print:shadow-none print:border-black ${compact ? 'p-3' : 'p-6'}`}>
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-gray-300 pb-4 mb-4 print:border-black">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center print:bg-gray-100">
                        <Route className="w-6 h-6 text-orange-600 print:text-black" />
                    </div>
                    <div>
                        <h2 className={`font-bold text-gray-800 ${compact ? 'text-lg' : 'text-xl'}`}>
                            🚚 RUTA ESTÁNDAR MIZUSUMASHI
                        </h2>
                        <p className="text-gray-600">{routeName}</p>
                    </div>
                </div>

                {showPrintButton && (
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors print:hidden"
                    >
                        <Printer size={18} />
                        Imprimir
                    </button>
                )}
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-3 text-center print:bg-gray-50">
                    <div className="text-xs text-blue-600 print:text-gray-600 uppercase tracking-wide">
                        Pitch Objetivo
                    </div>
                    <div className={`font-bold text-blue-700 print:text-black ${compact ? 'text-xl' : 'text-2xl'}`}>
                        {formatRouteTime(result.pitchMinutes)}
                    </div>
                </div>

                <div className="bg-orange-50 rounded-lg p-3 text-center print:bg-gray-50">
                    <div className="text-xs text-orange-600 print:text-gray-600 uppercase tracking-wide">
                        Tiempo Ciclo
                    </div>
                    <div className={`font-bold text-orange-700 print:text-black ${compact ? 'text-xl' : 'text-2xl'}`}>
                        {formatRouteTime(result.routeTimeMinutes)}
                    </div>
                </div>

                <div className={`rounded-lg p-3 text-center border ${getStatusStyle()}`}>
                    <div className="text-xs uppercase tracking-wide">
                        Estado
                    </div>
                    <div className={`font-bold ${compact ? 'text-xl' : 'text-2xl'}`}>
                        {getStatusIcon()} {result.utilizationPercent.toFixed(0)}%
                    </div>
                </div>
            </div>

            {/* Schedule */}
            <div className="mb-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-3">
                    <Clock size={18} className="text-orange-600 print:text-black" />
                    HORARIO DE PASOS
                </h3>

                <div className="border-2 border-gray-200 rounded-lg overflow-hidden print:border-black">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 print:bg-gray-200">
                            <tr>
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Hora</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Parada</th>
                                <th className="px-3 py-2 text-center font-semibold text-gray-700">Cajas</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.schedule.map((item, index) => (
                                <tr
                                    key={index}
                                    className={`border-t border-gray-200 ${index === result.schedule.length - 1
                                            ? 'bg-orange-50 print:bg-gray-100'
                                            : ''
                                        }`}
                                >
                                    <td className="px-3 py-2 font-mono font-semibold text-gray-800">
                                        {item.arrivalTime}
                                    </td>
                                    <td className="px-3 py-2 text-gray-700">
                                        {item.stationName}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {item.boxCount > 0 && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded print:bg-gray-200 print:text-black">
                                                <Box size={12} />
                                                {item.boxCount}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-gray-600 text-xs">
                                        {item.action}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Validation Alert */}
            {!result.isRouteFeasible && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-3 flex items-start gap-3 print:bg-white print:border-black">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5 print:text-black" />
                    <div>
                        <p className="font-medium text-red-800 print:text-black">
                            {result.validation.message}
                        </p>
                        {result.validation.suggestions.length > 0 && (
                            <ul className="mt-1 text-sm text-red-700 print:text-black">
                                {result.validation.suggestions.map((s, i) => (
                                    <li key={i}>• {s}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500 print:border-black">
                <div>
                    Generado: {new Date().toLocaleDateString('es-AR')} {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="flex items-center gap-1">
                    <ArrowRight size={12} />
                    Repetir ciclo cada {formatRouteTime(result.pitchMinutes)}
                </div>
            </div>
        </div>
    );
};
