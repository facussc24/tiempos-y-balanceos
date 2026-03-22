/**
 * ProjectTable — Compact, high-performance table for "Mis Proyectos".
 *
 * Columns:
 * 1. Health indicator (colored dot)
 * 2. Producto (name + client)
 * 3. Nº de Parte
 * 4. Fase (Pre-lanzamiento / Producción badge)
 * 5. Tipo (Maestro / Variante)
 * 6. AP=H (red count or green check)
 * 7. Acciones (Abrir →)
 *
 * Features:
 * - Search bar to filter by product name or client
 * - Click any row to open project
 * - REQUIERE ATENCIÓN sorted to top
 */

import React, { useMemo, useState } from 'react';
import {
    Search, ArrowRight, Check, GitMerge, Rocket, Factory, FileSpreadsheet,
} from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import type { ProjectEntry, ProjectHealth } from '../../hooks/useProjectHub';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectTableProps {
    projects: ProjectEntry[];
    onSelectProject: (familyId: number) => void;
    onExportApqp?: (familyId: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CLIENT_DISPLAY_NAMES: Record<string, string> = {
    'VOLKSWAGEN': 'Volkswagen Argentina',
    'VWA': 'Volkswagen Argentina',
    'TOYOTA': 'Toyota Argentina',
    'PWA': 'Toyota Argentina',
};

function normalizeClientName(raw: string): string {
    if (!raw) return '';
    const stripped = raw.replace(/^\d+\s+/, '').trim();
    const upper = stripped.toUpperCase();
    if (CLIENT_DISPLAY_NAMES[upper]) return CLIENT_DISPLAY_NAMES[upper];
    if (stripped !== upper) return stripped;
    return stripped.split(' ').map(w =>
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(' ');
}

function getPrimaryMember(entry: ProjectEntry) {
    return entry.members.find(m => m.isPrimary) ?? entry.members[0] ?? null;
}

// ---------------------------------------------------------------------------
// Health dot
// ---------------------------------------------------------------------------

const HEALTH_DOT: Record<ProjectHealth, { color: string; ring: string; label: string; tooltip: string }> = {
    red: {
        color: 'bg-red-500',
        ring: 'ring-red-500/30',
        label: 'Requiere atención',
        tooltip: 'AP=H sin acciones o propuestas de cambio pendientes',
    },
    yellow: {
        color: 'bg-amber-400',
        ring: 'ring-amber-400/30',
        label: 'Incompleto',
        tooltip: 'Faltan documentos APQP en algún módulo',
    },
    green: {
        color: 'bg-emerald-500',
        ring: 'ring-emerald-500/30',
        label: 'Completo',
        tooltip: 'Todos los documentos presentes, sin pendientes',
    },
};

// ---------------------------------------------------------------------------
// Phase config
// ---------------------------------------------------------------------------

const PHASE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
    preLaunch: { label: 'Pre-lanzamiento', icon: Rocket, color: 'text-blue-300', bg: 'bg-blue-500/15' },
    safeLaunch: { label: 'Safe Launch', icon: Rocket, color: 'text-blue-300', bg: 'bg-blue-500/15' },
    production: { label: 'Producción', icon: Factory, color: 'text-emerald-300', bg: 'bg-emerald-500/15' },
    prototype: { label: 'Prototipo', icon: Rocket, color: 'text-purple-300', bg: 'bg-purple-500/15' },
};

// ---------------------------------------------------------------------------
// Sort: red on top, then yellow, then green. Secondary: alphabetical.
// ---------------------------------------------------------------------------

const HEALTH_ORDER: Record<ProjectHealth, number> = { red: 0, yellow: 1, green: 2 };

function sortProjects(projects: ProjectEntry[]): ProjectEntry[] {
    return [...projects].sort((a, b) => {
        const ha = HEALTH_ORDER[a.health];
        const hb = HEALTH_ORDER[b.health];
        if (ha !== hb) return ha - hb;
        return a.family.name.localeCompare(b.family.name);
    });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ProjectTable: React.FC<ProjectTableProps> = ({ projects, onSelectProject, onExportApqp }) => {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        const sorted = sortProjects(projects);
        if (!search.trim()) return sorted;
        const q = search.trim().toLowerCase();
        return sorted.filter(entry => {
            const primary = getPrimaryMember(entry);
            const rawClient = entry.family.lineaName || primary?.lineaName || primary?.lineaCode || '';
            const client = normalizeClientName(rawClient);
            return (
                entry.family.name.toLowerCase().includes(q) ||
                client.toLowerCase().includes(q) ||
                (primary?.codigo || '').toLowerCase().includes(q)
            );
        });
    }, [projects, search]);

    return (
        <div>
            {/* Search bar */}
            <div className="relative mb-4 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar producto o cliente..."
                    aria-label="Buscar proyectos"
                    className="w-full pl-9 pr-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-sm text-white placeholder-slate-500
                               focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-colors"
                />
            </div>

            {/* Table */}
            <div className="bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-left" role="grid" aria-label="Tabla de proyectos">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-8" aria-label="Estado" />
                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Producto</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Nº de Parte</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Fase</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Tipo</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center w-16">AP=H</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-24">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filtered.map(entry => {
                            const primary = getPrimaryMember(entry);
                            const rawClient = entry.family.lineaName || primary?.lineaName || primary?.lineaCode || '';
                            const clientName = normalizeClientName(rawClient);
                            const partNumber = entry.partNumber || primary?.codigo || '';
                            const healthCfg = HEALTH_DOT[entry.health];
                            const phaseCfg = entry.phase ? PHASE_CONFIG[entry.phase] : null;
                            const apH = entry.kpis.apHUnmitigated;

                            return (
                                <tr
                                    key={entry.family.id}
                                    onClick={() => onSelectProject(entry.family.id)}
                                    tabIndex={0}
                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectProject(entry.family.id); } }}
                                    role="row"
                                    aria-label={`Abrir proyecto ${entry.family.name}`}
                                    className="group cursor-pointer hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:outline-none transition-colors"
                                >
                                    {/* Health dot */}
                                    <td className="px-4 py-3">
                                        <Tooltip content={healthCfg.tooltip}>
                                            <span
                                                className={`inline-block w-2.5 h-2.5 rounded-full ${healthCfg.color} ring-2 ${healthCfg.ring}`}
                                                role="status"
                                                aria-label={healthCfg.label}
                                            />
                                        </Tooltip>
                                    </td>

                                    {/* Producto */}
                                    <td className="px-4 py-3 min-w-0">
                                        <div className="text-sm font-medium text-white truncate max-w-[260px]" title={entry.family.name}>
                                            {entry.family.name}
                                        </div>
                                        {clientName && (
                                            <div className="text-xs text-slate-500 truncate max-w-[260px]">
                                                {clientName}
                                            </div>
                                        )}
                                    </td>

                                    {/* Nº de Parte */}
                                    <td className="px-4 py-3 hidden md:table-cell">
                                        <span className="text-xs text-slate-400 font-mono">
                                            {partNumber || '\u2014'}
                                        </span>
                                    </td>

                                    {/* Fase */}
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                        {phaseCfg ? (
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${phaseCfg.color} ${phaseCfg.bg}`}>
                                                <phaseCfg.icon size={10} />
                                                {phaseCfg.label}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-600">{'\u2014'}</span>
                                        )}
                                    </td>

                                    {/* Tipo */}
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                        {entry.hasMaster ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-300 bg-slate-500/20">
                                                <GitMerge size={10} />
                                                Maestro{entry.variantCount > 0 ? ` +${entry.variantCount}v` : ''}
                                            </span>
                                        ) : entry.variantCount > 0 ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-purple-300 bg-purple-500/15">
                                                <GitMerge size={10} />
                                                Variante
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-600">{'\u2014'}</span>
                                        )}
                                    </td>

                                    {/* AP=H */}
                                    <td className="px-4 py-3 text-center">
                                        {apH > 0 ? (
                                            <Tooltip content="Action Priority = High (Prioridad de Acción Alta)">
                                                <span className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-md text-xs font-bold text-red-400 bg-red-500/15">
                                                    {apH}
                                                </span>
                                            </Tooltip>
                                        ) : (
                                            <Tooltip content="Sin prioridades altas pendientes">
                                                <Check size={14} className="mx-auto text-emerald-500" />
                                            </Tooltip>
                                        )}
                                    </td>

                                    {/* Acciones */}
                                    <td className="px-4 py-3 text-right">
                                        <span className="inline-flex items-center gap-2">
                                            {onExportApqp && (
                                                <Tooltip content="Exportar Paquete APQP">
                                                    <button
                                                        onClick={e => { e.stopPropagation(); onExportApqp(entry.family.id); }}
                                                        className="p-1.5 rounded-md text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                                        aria-label={`Exportar APQP de ${entry.family.name}`}
                                                    >
                                                        <FileSpreadsheet size={14} />
                                                    </button>
                                                </Tooltip>
                                            )}
                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 opacity-50 group-hover:opacity-100 transition-opacity">
                                                Abrir <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                                            </span>
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Empty filtered state */}
                {filtered.length === 0 && search.trim() && (
                    <div className="px-6 py-8 text-center">
                        <p className="text-sm text-slate-500">No se encontraron proyectos para "{search.trim()}"</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export { ProjectTable };
export type { ProjectTableProps };
