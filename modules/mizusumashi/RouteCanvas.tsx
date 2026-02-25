/**
 * RouteCanvas Component - Visual SVG Route Editor
 * 
 * Canvas SVG para dibujar rutas de Milk Run visualmente:
 * - Nodos de estaciones posicionados en grid
 * - Conexiones click-and-drag entre nodos
 * - Línea punteada con etiqueta de Pitch
 * - Barra de saturación del tren con colores
 */

import React, { useMemo } from 'react';
import { RouteStop } from './mizusumashiLogic';

interface Station {
    id: number;
    name: string;
}

interface RouteCanvasProps {
    /** Available stations */
    stations: Station[];

    /** Current route stops */
    stops: RouteStop[];

    /** Pitch in minutes (for label) */
    pitchMinutes: number;

    /** Route utilization (0-100+) */
    utilizationPercent: number;

    /** Alert level from validateRoute() */
    alertLevel: 'ok' | 'warning' | 'critical';

    /** Called when user clicks to add station */
    onAddStop?: (stationId: number) => void;
}

// Position stations in a flow layout
const CANVAS_WIDTH = 760;
const CANVAS_HEIGHT = 300;
const NODE_RADIUS = 35;
const WAREHOUSE_X = 60;
const WAREHOUSE_Y = 150;

export const RouteCanvas: React.FC<RouteCanvasProps> = ({
    stations,
    stops,
    pitchMinutes,
    utilizationPercent,
    alertLevel,
    onAddStop
}) => {
    // Calculate node positions in a horizontal flow
    const nodePositions = useMemo(() => {
        const positions: Record<number | string, { x: number; y: number }> = {
            warehouse: { x: WAREHOUSE_X, y: WAREHOUSE_Y }
        };

        const stationCount = stations.length;
        const availableWidth = CANVAS_WIDTH - 200; // Leave margin for warehouse
        const spacing = Math.min(120, availableWidth / (stationCount + 1));

        stations.forEach((station, index) => {
            positions[station.id] = {
                x: 180 + index * spacing,
                y: WAREHOUSE_Y + (index % 2 === 0 ? -50 : 50) // Stagger vertically
            };
        });

        return positions;
    }, [stations]);

    // Build path from stops
    const routePath = useMemo(() => {
        if (stops.length === 0) return '';

        const points: string[] = [`M ${WAREHOUSE_X} ${WAREHOUSE_Y}`];

        stops.forEach(stop => {
            const pos = nodePositions[stop.stationId];
            if (pos) {
                points.push(`L ${pos.x} ${pos.y}`);
            }
        });

        // Return to warehouse
        points.push(`L ${WAREHOUSE_X} ${WAREHOUSE_Y}`);

        return points.join(' ');
    }, [stops, nodePositions]);

    // Get color based on alert level
    const getAlertColor = () => {
        switch (alertLevel) {
            case 'ok': return '#22c55e';
            case 'warning': return '#f59e0b';
            case 'critical': return '#ef4444';
        }
    };

    // Saturation bar color
    const saturationColor = utilizationPercent <= 70
        ? '#22c55e'
        : utilizationPercent <= 90
            ? '#f59e0b'
            : utilizationPercent <= 100
                ? '#fb923c'
                : '#ef4444';

    return (
        <div className="route-canvas-container bg-slate-50 rounded-lg border border-slate-200 p-4">
            {/* Pitch Label */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-600">🚚 Ruta Logística</span>
                    {stops.length > 0 && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                            Cada {pitchMinutes.toFixed(0)} min
                        </span>
                    )}
                </div>

                {/* Saturation Bar */}
                {stops.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Saturación:</span>
                        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full transition-all duration-300"
                                style={{
                                    width: `${Math.min(100, utilizationPercent)}%`,
                                    backgroundColor: saturationColor
                                }}
                            />
                        </div>
                        <span
                            className="text-xs font-bold"
                            style={{ color: saturationColor }}
                        >
                            {utilizationPercent.toFixed(0)}%
                        </span>
                    </div>
                )}
            </div>

            {/* SVG Canvas */}
            <svg
                width="100%"
                height="260"
                viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
                className="bg-white rounded-lg border border-slate-100"
            >
                {/* Grid Lines (subtle) */}
                <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f1f5f9" strokeWidth="1" />
                    </pattern>

                    {/* Arrow marker */}
                    <marker
                        id="arrowhead"
                        markerWidth="10"
                        markerHeight="7"
                        refX="9"
                        refY="3.5"
                        orient="auto"
                    >
                        <polygon
                            points="0 0, 10 3.5, 0 7"
                            fill={getAlertColor()}
                        />
                    </marker>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Route Path (dashed line) */}
                {routePath && (
                    <path
                        d={routePath}
                        fill="none"
                        stroke={getAlertColor()}
                        strokeWidth="3"
                        strokeDasharray="8 4"
                        markerEnd="url(#arrowhead)"
                        className="transition-all duration-300"
                    />
                )}

                {/* Warehouse Node */}
                <g transform={`translate(${WAREHOUSE_X}, ${WAREHOUSE_Y})`}>
                    <circle
                        r={NODE_RADIUS}
                        fill="#1e40af"
                        stroke="#1e3a8a"
                        strokeWidth="3"
                    />
                    <text
                        y="5"
                        textAnchor="middle"
                        fill="white"
                        fontSize="20"
                    >
                        🏭
                    </text>
                    <text
                        y={NODE_RADIUS + 18}
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize="10"
                        fontWeight="600"
                    >
                        Almacén
                    </text>
                </g>

                {/* Station Nodes */}
                {stations.map((station, index) => {
                    const pos = nodePositions[station.id];
                    const isInRoute = stops.some(s => s.stationId === station.id);
                    const stopOrder = stops.findIndex(s => s.stationId === station.id) + 1;

                    return (
                        <g
                            key={station.id}
                            transform={`translate(${pos.x}, ${pos.y})`}
                            onClick={() => !isInRoute && onAddStop?.(station.id)}
                            style={{ cursor: !isInRoute ? 'pointer' : 'default' }}
                        >
                            <circle
                                r={NODE_RADIUS - 5}
                                fill={isInRoute ? '#f0fdf4' : '#f8fafc'}
                                stroke={isInRoute ? '#22c55e' : '#cbd5e1'}
                                strokeWidth={isInRoute ? 3 : 2}
                                className="transition-all duration-200 hover:stroke-teal-500"
                            />

                            {/* Station icon */}
                            <text
                                y="5"
                                textAnchor="middle"
                                fill={isInRoute ? '#166534' : '#64748b'}
                                fontSize="16"
                            >
                                📦
                            </text>

                            {/* Station name */}
                            <text
                                y={NODE_RADIUS + 12}
                                textAnchor="middle"
                                fill="#64748b"
                                fontSize="9"
                                fontWeight="500"
                            >
                                {station.name.length > 12
                                    ? station.name.substring(0, 12) + '...'
                                    : station.name
                                }
                            </text>

                            {/* Route order badge */}
                            {isInRoute && (
                                <g transform={`translate(${NODE_RADIUS - 10}, ${-NODE_RADIUS + 10})`}>
                                    <circle r="10" fill="#22c55e" />
                                    <text
                                        y="4"
                                        textAnchor="middle"
                                        fill="white"
                                        fontSize="11"
                                        fontWeight="bold"
                                    >
                                        {stopOrder}
                                    </text>
                                </g>
                            )}

                            {/* Add indicator for available stations */}
                            {!isInRoute && (
                                <g transform={`translate(${NODE_RADIUS - 10}, ${-NODE_RADIUS + 10})`}>
                                    <circle r="8" fill="#94a3b8" className="opacity-50" />
                                    <text
                                        y="4"
                                        textAnchor="middle"
                                        fill="white"
                                        fontSize="10"
                                    >
                                        +
                                    </text>
                                </g>
                            )}
                        </g>
                    );
                })}

                {/* Empty state */}
                {stops.length === 0 && (
                    <text
                        x={CANVAS_WIDTH / 2}
                        y={CANVAS_HEIGHT - 30}
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize="12"
                    >
                        Click en las estaciones para agregar a la ruta
                    </text>
                )}
            </svg>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-green-500 block" style={{ borderStyle: 'dashed' }}></span>
                    OK
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-amber-500 block" style={{ borderStyle: 'dashed' }}></span>
                    Ajustado
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-red-500 block" style={{ borderStyle: 'dashed' }}></span>
                    Excede Pitch
                </span>
            </div>
        </div>
    );
};

export default RouteCanvas;
