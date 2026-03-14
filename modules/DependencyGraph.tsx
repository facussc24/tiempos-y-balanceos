
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ProjectData } from '../types';
import { Card } from '../components/ui/Card';
import { FileDown, ZoomIn, ZoomOut, Move, Maximize, MousePointer2, Network, HelpCircle } from 'lucide-react';
import { formatNumber } from '../utils';
import { toast } from '../components/ui/Toast';

interface GraphState {
    zoom: number;
    pan: { x: number; y: number };
}

interface Props {
    data: ProjectData;
    initialState?: GraphState;
    onStateChange?: (state: GraphState) => void;
}

interface GraphNode {
    id: string;
    description: string;
    time: number;
    level: number; // Logical Depth (Column)
    row: number;   // Vertical Position in Column
    x: number;
    y: number;
    radius: number; // Circle Radius
    parents: string[];
    children: string[];
}

interface GraphEdge {
    from: string;
    to: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export const DependencyGraph: React.FC<Props> = ({ data, initialState, onStateChange }) => {
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);

    // Zoom & Pan State (Initialized from props if available)
    const [zoom, setZoom] = useState(initialState?.zoom || 1);
    const [pan, setPan] = useState(initialState?.pan || { x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    // Sync state back to parent when changed
    useEffect(() => {
        if (onStateChange) {
            onStateChange({ zoom, pan });
        }
    }, [zoom, pan, onStateChange]);

    // Constants - PDM Style
    const NODE_RADIUS = 35;
    const COL_GAP = 180; // Distance between columns (Levels)
    const ROW_GAP = 100;  // Distance between rows
    const PADDING = 100;

    // Interaction Helper
    const activeNode = selectedNode || hoveredNode;

    const handleNodeClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation(); // Prevent bg click
        if (selectedNode === id) {
            setSelectedNode(null); // Toggle off
        } else {
            setSelectedNode(id);
        }
    };

    const handleBgClick = () => {
        setSelectedNode(null);
    };

    // --- ZOOM & PAN HANDLERS ---
    const zoomIn = () => setZoom(z => Math.min(z * 1.2, 3));
    const zoomOut = () => setZoom(z => Math.max(z / 1.2, 0.3));
    const resetView = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    const handlePrint = () => {
        resetView();
        setTimeout(() => {
            try {
                window.print();
            } catch (e) {
                toast.error('Error de Impresión', 'No se pudo imprimir el diagrama');
            }
        }, 100);
    };

    const onMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    };

    const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        setPan({
            x: e.clientX - dragStart.current.x,
            y: e.clientY - dragStart.current.y
        });
    };

    const onMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        } else {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [isDragging]);


    // Layout Algorithm: SWIMLANE / BANDED LAYOUT (By Sector)
    const graph = useMemo(() => {
        const tasks = data.tasks;
        if (tasks.length === 0) return { nodes: [], edges: [], swimlanes: [], viewBox: "0 0 800 600" };

        const nodesMap = new Map<string, GraphNode>();
        const nodeLevels: Record<string, number> = {};

        // 1. Initialize Nodes
        tasks.forEach(t => {
            nodesMap.set(t.id, {
                id: t.id,
                description: t.description,
                time: t.standardTime || t.averageTime,
                level: 0,
                row: 0,
                x: 0,
                y: 0,
                radius: NODE_RADIUS,
                parents: t.predecessors,
                children: []
            });
        });

        // 2. Build Topology
        tasks.forEach(t => {
            t.predecessors.forEach(pId => {
                const parent = nodesMap.get(pId);
                if (parent) parent.children.push(t.id);
            });
        });

        // 3. Level Calculation
        const getLevel = (id: string, visited: Set<string>): number => {
            if (visited.has(id)) return 0;
            if (nodeLevels[id] !== undefined) return nodeLevels[id];

            const t = nodesMap.get(id);
            if (!t || t.parents.length === 0) {
                nodeLevels[id] = 0;
                return 0;
            }

            visited.add(id);
            let maxParentLevel = -1;
            t.parents.forEach(pId => {
                const pLevel = getLevel(pId, visited);
                if (pLevel > maxParentLevel) maxParentLevel = pLevel;
            });
            visited.delete(id);

            nodeLevels[id] = maxParentLevel + 1;
            return maxParentLevel + 1;
        };
        tasks.forEach(t => getLevel(t.id, new Set()));

        // 4. Group into Columns (Layers)
        const layers: GraphNode[][] = [];
        nodesMap.forEach(node => {
            const lvl = nodeLevels[node.id];
            node.level = lvl;
            if (!layers[lvl]) layers[lvl] = [];
            layers[lvl].push(node);
        });

        // 5. SWIMLANES LOGIC
        // A. Identify Sectors Order
        const activeSectorIds = new Set(tasks.map(t => t.sectorId || 'general'));
        // Prioritize defined sectors, then general
        const sortedSectorIds = data.sectors
            .map(s => s.id)
            .filter(id => activeSectorIds.has(id));

        if (activeSectorIds.has('general') || [...activeSectorIds].some(id => !data.sectors.find(s => s.id === id))) {
            if (!sortedSectorIds.includes('general')) sortedSectorIds.push('general');
        }

        const getSector = (taskId: string) => {
            const t = tasks.find(Tk => Tk.id === taskId);
            return t?.sectorId || 'general';
        };

        // B. Calculate Dynamic Band Heights
        const sectorMaxRows: Record<string, number> = {};
        sortedSectorIds.forEach(id => sectorMaxRows[id] = 0);

        layers.forEach(layer => {
            const counts: Record<string, number> = {};
            layer.forEach(node => {
                const sId = getSector(node.id);
                // Map unknown sectors to general if needed, but assuming valid ids
                const validId = sortedSectorIds.includes(sId) ? sId : 'general';
                counts[validId] = (counts[validId] || 0) + 1;
            });
            Object.entries(counts).forEach(([sId, count]) => {
                sectorMaxRows[sId] = Math.max(sectorMaxRows[sId] || 0, count);
            });
        });

        // C. Define Band Coordinates
        const BAND_PADDING_TOP = 40;
        const BAND_PADDING_BOTTOM = 20;
        let currentY = PADDING;
        const swimlanes: { id: string, name: string, y: number, height: number, color: string }[] = [];

        sortedSectorIds.forEach(sId => {
            const rows = Math.max(1, sectorMaxRows[sId] || 1);
            const height = BAND_PADDING_TOP + (rows * ROW_GAP) + BAND_PADDING_BOTTOM;

            const sectorData = data.sectors.find(s => s.id === sId);
            const name = sectorData ? sectorData.name : (sId === 'general' ? 'General / Sin Sector' : sId);
            const color = sectorData ? sectorData.color : '#e2e8f0';

            swimlanes.push({ id: sId, name, y: currentY, height, color });
            currentY += height;
        });

        const totalHeight = currentY;

        // D. Assign Node Coordinates
        layers.forEach((layer, colIdx) => {
            const sectorNodes: Record<string, GraphNode[]> = {};
            layer.forEach(n => {
                const sId = getSector(n.id);
                const validId = sortedSectorIds.includes(sId) ? sId : 'general';
                if (!sectorNodes[validId]) sectorNodes[validId] = [];
                sectorNodes[validId].push(n);
            });

            sortedSectorIds.forEach(sId => {
                const nodes = sectorNodes[sId];
                if (nodes) {
                    nodes.sort((a, b) => a.id.localeCompare(b.id)); // Deterministic Sort
                    const swimlane = swimlanes.find(s => s.id === sId);
                    if (swimlane) {
                        nodes.forEach((node, idx) => {
                            node.x = PADDING + (colIdx * COL_GAP);
                            node.y = swimlane.y + BAND_PADDING_TOP + (idx * ROW_GAP) + (ROW_GAP / 2); // Roughly enter
                        });
                    }
                }
            });
        });

        // 6. ViewBox
        const maxWidth = PADDING * 2 + (layers.length * COL_GAP);
        const maxHeight = totalHeight + PADDING;
        const viewBox = `0 0 ${Math.max(800, maxWidth)} ${Math.max(600, maxHeight)}`;

        // 7. Edges
        const edges: GraphEdge[] = [];
        nodesMap.forEach(node => {
            node.children.forEach(childId => {
                const child = nodesMap.get(childId);
                if (child) {
                    const angle = Math.atan2(child.y - node.y, child.x - node.x);
                    const x1 = node.x + Math.cos(angle) * node.radius;
                    const y1 = node.y + Math.sin(angle) * node.radius;
                    const x2 = child.x - Math.cos(angle) * child.radius;
                    const y2 = child.y - Math.sin(angle) * child.radius;
                    edges.push({ from: node.id, to: childId, x1, y1, x2, y2 });
                }
            });
        });

        return { nodes: Array.from(nodesMap.values()), edges, swimlanes, viewBox };

    }, [data.tasks, data.sectors]);


    // Helper for highlighting
    const relatedNodes = useMemo(() => {
        if (!activeNode) return { ancestors: new Set<string>(), descendants: new Set<string>() };

        const ancestors = new Set<string>();
        const descendants = new Set<string>();

        const findParents = (id: string) => {
            const t = data.tasks.find(x => x.id === id);
            if (!t) return;
            t.predecessors.forEach(p => {
                if (!ancestors.has(p)) {
                    ancestors.add(p);
                    findParents(p);
                }
            });
        };

        const findChildren = (id: string) => {
            const children = data.tasks.filter(t => t.predecessors.includes(id)).map(t => t.id);
            children.forEach(c => {
                if (!descendants.has(c)) {
                    descendants.add(c);
                    findChildren(c);
                }
            });
        };

        findParents(activeNode);
        findChildren(activeNode);

        return { ancestors, descendants };
    }, [activeNode, data.tasks]);

    return (
        <div className="space-y-4">
            <Card title="Mapa de Precedencias (PDM)" actions={
                <div className="flex gap-2 print:hidden">
                    <div className="flex bg-slate-100 rounded p-1 items-center">
                        <button onClick={zoomOut} className="p-1.5 hover:bg-white rounded text-slate-600" title="Alejar" aria-label="Alejar"><ZoomOut size={16} /></button>
                        <span className="text-xs font-mono w-10 text-center">{(zoom * 100).toFixed(0)}%</span>
                        <button onClick={zoomIn} className="p-1.5 hover:bg-white rounded text-slate-600" title="Acercar" aria-label="Acercar"><ZoomIn size={16} /></button>
                        <div className="w-px h-4 bg-slate-300 mx-1"></div>
                        <button onClick={resetView} className="p-1.5 hover:bg-white rounded text-slate-600 text-xs px-2" title="Restablecer vista">Reset</button>
                    </div>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 bg-slate-800 text-white px-3 py-1.5 rounded hover:bg-slate-700 text-sm font-medium transition-colors shadow-sm"
                    >
                        <FileDown size={16} /> Imprimir PDF
                    </button>
                </div>
            }>
                {/* EDUCATIONAL TOOLTIP */}
                <div className="relative group cursor-help mb-4">
                    <div className="flex flex-wrap items-center gap-2 bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm text-blue-800 transition-colors hover:bg-blue-100">
                        <Network size={20} />
                        <p><strong>Diagrama de Red (PDM):</strong> Representación gráfica de la secuencia lógica. <span className="underline decoration-dotted font-medium">¿Qué es esto?</span></p>
                    </div>

                    <div className="absolute top-full left-0 mt-2 w-96 p-4 bg-slate-900 text-white text-xs rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100] font-normal text-left border border-slate-700">
                        <strong className="text-blue-300 block mb-2 text-sm flex items-center gap-2"><Network size={14} /> Precedencia (PDM)</strong>
                        <p className="mb-2 leading-relaxed">Mapa visual que define el orden riguroso de ensamblaje.</p>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="bg-slate-800 p-2 rounded">
                                <span className="block font-bold text-slate-300 mb-1">Nodos (Círculos)</span>
                                Representan las Tareas y su tiempo de ejecución.
                            </div>
                            <div className="bg-slate-800 p-2 rounded">
                                <span className="block font-bold text-slate-300 mb-1">Flechas</span>
                                Indican dependencia obligatoria (A → B).
                            </div>
                        </div>
                        <p className="text-amber-200 font-medium">⚠️ Regla de Oro:</p>
                        <p className="mb-2">Una tarea no puede iniciar hasta que todas sus predecesoras (flechas entrantes) hayan terminado.</p>
                        <div className="text-[10px] text-slate-400 italic border-t border-slate-700 pt-2 mt-2">
                            Este diagrama es la base matemática para calcular el Peso Posicional (RPW) en el balanceo.
                        </div>
                    </div>
                </div>

                <div
                    className={`border border-slate-200 rounded-lg bg-slate-50 overflow-hidden relative print:border-none print:bg-white print:fixed print:inset-0 print:z-50 print:h-screen print:w-screen ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                    style={{ height: '600px' }}
                    onMouseDown={onMouseDown}
                >
                    {/* GRAPH SVG */}
                    {graph.nodes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                            <Network size={40} className="text-slate-300" strokeWidth={1.5} />
                            <p className="font-medium text-slate-500">No hay tareas para mostrar</p>
                            <p className="text-sm text-slate-400">Agrega operaciones en la tabla para visualizar el grafo de dependencias.</p>
                        </div>
                    ) : (
                        <svg
                            width="100%"
                            height="100%"
                            viewBox={graph.viewBox}
                            preserveAspectRatio="xMidYMid meet"
                            onClick={handleBgClick}
                            className="select-none"
                        >
                            <defs>
                                {/* Arrow Marker Definitions */}
                                <marker id="arrow-normal" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                                    <path d="M0,0 L0,6 L9,3 z" fill="#64748b" />
                                </marker>
                                <marker id="arrow-active" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                                    <path d="M0,0 L0,6 L9,3 z" fill="#2563eb" />
                                </marker>
                                <marker id="arrow-ancestor" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                                    <path d="M0,0 L0,6 L9,3 z" fill="#f97316" />
                                </marker>
                            </defs>

                            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                                {/* Swimlanes Backgrounds */}
                                {graph.swimlanes.map(sl => (
                                    <g key={sl.id}>
                                        <rect
                                            x={-1000} // Extra wide to cover pan
                                            y={sl.y}
                                            width={5000}
                                            height={sl.height}
                                            fill={sl.color}
                                            opacity={0.1}
                                        />
                                        <text
                                            x={-50}
                                            y={sl.y + 20}
                                            fill="#64748b"
                                            className="text-xs font-bold uppercase tracking-widest opacity-60 select-none pointer-events-none"
                                        >
                                            {sl.name}
                                        </text>
                                        <line
                                            x1={-1000} y1={sl.y + sl.height}
                                            x2={5000} y2={sl.y + sl.height}
                                            stroke={sl.color}
                                            strokeWidth={1}
                                            strokeDasharray="4 4"
                                            opacity={0.5}
                                        />
                                    </g>
                                ))}

                                {/* Edges */}
                                {graph.edges.map((edge, i) => {
                                    // Highlight logic
                                    const isAncestorPath = relatedNodes.ancestors.has(edge.from) && (relatedNodes.ancestors.has(edge.to) || edge.to === activeNode);
                                    const isDescendantPath = (relatedNodes.descendants.has(edge.to) || edge.to === activeNode) && (relatedNodes.descendants.has(edge.from) || edge.from === activeNode);
                                    const isActivePath = isAncestorPath || isDescendantPath;
                                    const isDimmed = activeNode && !isActivePath;

                                    const strokeColor = isActivePath ? (isAncestorPath ? "#f97316" : "#2563eb") : "#94a3b8";
                                    const markerId = isActivePath ? (isAncestorPath ? "url(#arrow-ancestor)" : "url(#arrow-active)") : "url(#arrow-normal)";

                                    return (
                                        <line
                                            key={`e-${i}`}
                                            x1={edge.x1} y1={edge.y1}
                                            x2={edge.x2} y2={edge.y2}
                                            stroke={strokeColor}
                                            strokeWidth={isActivePath ? 2.5 : 1.5}
                                            markerEnd={markerId}
                                            opacity={isDimmed ? 0.2 : 1}
                                            className="transition-all duration-300"
                                        />
                                    );
                                })}

                                {/* Nodes (Circles) */}
                                {graph.nodes.map(node => {
                                    const isSelected = selectedNode === node.id;
                                    const isHovered = hoveredNode === node.id;
                                    const isAncestor = relatedNodes.ancestors.has(node.id);
                                    const isDescendant = relatedNodes.descendants.has(node.id);
                                    const isDimmed = activeNode && !isSelected && !isHovered && !isAncestor && !isDescendant;

                                    let fillColor = "#ffffff";
                                    let strokeColor = "#334155"; // slate-700
                                    let textColor = "#1e293b"; // slate-800
                                    let strokeWidth = 2;
                                    let shadowFilter = "";

                                    if (isSelected) {
                                        fillColor = "#2563eb"; // blue-600
                                        strokeColor = "#1e40af"; // blue-800
                                        textColor = "#ffffff";
                                        strokeWidth = 3;
                                        shadowFilter = "drop-shadow(0 4px 6px rgb(37 99 235 / 0.4))";
                                    } else if (isAncestor) {
                                        fillColor = "#fff7ed"; // orange-50
                                        strokeColor = "#f97316"; // orange-500
                                    } else if (isDescendant) {
                                        fillColor = "#f0f9ff"; // sky-50
                                        strokeColor = "#0ea5e9"; // sky-500
                                    } else if (isHovered) {
                                        fillColor = "#f8fafc";
                                        strokeColor = "#2563eb";
                                    }

                                    return (
                                        <g
                                            key={node.id}
                                            transform={`translate(${node.x}, ${node.y})`}
                                            onClick={(e) => handleNodeClick(e, node.id)}
                                            onMouseEnter={() => setHoveredNode(node.id)}
                                            onMouseLeave={() => setHoveredNode(null)}
                                            className="cursor-pointer transition-all duration-300"
                                            style={{ opacity: isDimmed ? 0.3 : 1, filter: shadowFilter }}
                                        >
                                            {/* Circle Body */}
                                            <circle
                                                r={node.radius}
                                                fill={fillColor}
                                                stroke={strokeColor}
                                                strokeWidth={strokeWidth}
                                            />

                                            {/* Task ID (Centered) */}
                                            <text
                                                dy="5"
                                                textAnchor="middle"
                                                fill={textColor}
                                                className="font-bold text-lg pointer-events-none select-none"
                                                style={{ fontSize: '16px' }}
                                            >
                                                {node.id}
                                            </text>

                                            {/* Info Tag (Bottom) */}
                                            <g transform={`translate(0, ${node.radius + 14})`}>
                                                <rect x="-40" y="-10" width="80" height="16" rx="4" fill="white" fillOpacity="0.9" />
                                                <text
                                                    textAnchor="middle"
                                                    className="text-[10px] font-mono fill-slate-500 pointer-events-none select-none font-bold"
                                                    dy="2"
                                                >
                                                    {formatNumber(node.time)}s
                                                </text>
                                            </g>

                                            {/* Description Tag (Top - Only on Hover/Select) */}
                                            {(isHovered || isSelected) && (
                                                <g transform={`translate(0, -${node.radius + 18})`}>
                                                    <text
                                                        textAnchor="middle"
                                                        className="text-[10px] font-bold fill-slate-700 pointer-events-none select-none bg-white"
                                                    >
                                                        {node.description.length > 20 ? node.description.substring(0, 18) + '...' : node.description}
                                                    </text>
                                                </g>
                                            )}
                                        </g>
                                    );
                                })}
                            </g>
                        </svg>
                    )}
                </div>
            </Card>
        </div>
    );
};
