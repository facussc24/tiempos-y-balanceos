/**
 * ProjectCards — Grid of project cards for "Mis Proyectos" landing section.
 *
 * Each card displays:
 * - Family name + client badge
 * - 1 overall health indicator (RED/YELLOW/GREEN)
 * - Phase badge (Pre-lanzamiento / Producción)
 * - Maestro / Variante tag
 * - Actionable KPI: "N acciones pendientes" only when > 0
 */

import React from 'react';
import {
    Package, ArrowRight, AlertTriangle, GitMerge,
    CheckCircle, AlertCircle, Rocket, Factory,
} from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import type { ProjectEntry, ProjectHealth } from '../../hooks/useProjectHub';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectCardsProps {
    projects: ProjectEntry[];
    onSelectProject: (familyId: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CLIENT_DISPLAY_NAMES: Record<string, string> = {
    'VOLKSWAGEN': 'VWA',
    'VWA': 'VWA',
    'TOYOTA': 'Toyota Argentina',
    'PWA': 'Toyota Argentina',
};

export function normalizeClientName(raw: string): string {
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
// Health indicator
// ---------------------------------------------------------------------------

const HEALTH_CONFIG: Record<ProjectHealth, {
    color: string;
    bgColor: string;
    borderColor: string;
    icon: React.ElementType;
    label: string;
    tooltipText: string;
}> = {
    red: {
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        borderColor: 'border-red-500/30',
        icon: AlertCircle,
        label: 'Requiere atención',
        tooltipText: 'AP=H sin acciones o propuestas de cambio pendientes',
    },
    yellow: {
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/20',
        borderColor: 'border-amber-500/30',
        icon: AlertTriangle,
        label: 'Incompleto',
        tooltipText: 'Faltan documentos APQP en algún módulo',
    },
    green: {
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/20',
        borderColor: 'border-emerald-500/30',
        icon: CheckCircle,
        label: 'Completo',
        tooltipText: 'Todos los documentos presentes, sin pendientes',
    },
};

function HealthIndicator({ health }: { health: ProjectHealth }) {
    const cfg = HEALTH_CONFIG[health];
    const Icon = cfg.icon;
    return (
        <Tooltip content={cfg.tooltipText}>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${cfg.bgColor} border ${cfg.borderColor}`}>
                <Icon size={12} className={cfg.color} />
                <span className={`text-[10px] font-bold uppercase tracking-wide ${cfg.color}`}>
                    {cfg.label}
                </span>
            </div>
        </Tooltip>
    );
}

// ---------------------------------------------------------------------------
// Phase badge
// ---------------------------------------------------------------------------

const PHASE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
    preLaunch: { label: 'Pre-lanzamiento', icon: Rocket, color: 'text-blue-300', bg: 'bg-blue-500/15' },
    safeLaunch: { label: 'Safe Launch', icon: Rocket, color: 'text-blue-300', bg: 'bg-blue-500/15' },
    production: { label: 'Producción', icon: Factory, color: 'text-emerald-300', bg: 'bg-emerald-500/15' },
    prototype: { label: 'Prototipo', icon: Rocket, color: 'text-purple-300', bg: 'bg-purple-500/15' },
};

function PhaseBadge({ phase }: { phase: string | null }) {
    if (!phase) return null;
    const cfg = PHASE_CONFIG[phase];
    if (!cfg) return null;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${cfg.color} ${cfg.bg}`}>
            <Icon size={10} />
            {cfg.label}
        </span>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const ProjectCards: React.FC<ProjectCardsProps> = ({ projects, onSelectProject }) => {
    return (
        <nav
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            aria-label="Proyectos por familia de producto"
        >
            {projects.map((entry) => {
                const primary = getPrimaryMember(entry);
                const rawClientName = entry.family.lineaName || primary?.lineaName || primary?.lineaCode || '';
                const clientName = normalizeClientName(rawClientName);
                const partNumber = primary?.codigo || '';
                const actionCount = entry.kpis.apHUnmitigated + entry.kpis.pendingProposals;

                const borderClass = entry.health === 'red'
                    ? 'border-red-500/20 hover:border-red-400/40'
                    : entry.health === 'yellow'
                        ? 'border-amber-500/20 hover:border-amber-400/40'
                        : 'border-emerald-500/20 hover:border-emerald-400/40';

                return (
                    <button
                        key={entry.family.id}
                        onClick={() => onSelectProject(entry.family.id)}
                        aria-label={`Abrir proyecto ${entry.family.name}`}
                        className={`group w-full text-left bg-white/[0.04] backdrop-blur-sm border ${borderClass} rounded-xl p-6
                                   hover:bg-white/[0.07] hover:shadow-lg hover:-translate-y-1
                                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-white/70
                                   transition-all duration-200 cursor-pointer`}
                    >
                        {/* Row 1: Icon + Health indicator */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="bg-blue-500/15 w-11 h-11 rounded-lg flex items-center justify-center">
                                <Package size={22} className="text-blue-400" />
                            </div>
                            <HealthIndicator health={entry.health} />
                        </div>

                        {/* Row 2: Family name */}
                        <h3 className="text-base font-bold text-white mb-1 break-words line-clamp-2" title={entry.family.name}>
                            {entry.family.name}
                        </h3>

                        {/* Row 3: Client + part number */}
                        <p className="text-xs text-slate-400 truncate mb-4" title={`${clientName} · ${partNumber}`}>
                            {clientName}{clientName && partNumber ? ' · ' : ''}{partNumber || '\u2014'}
                        </p>

                        {/* Row 4: Badges (phase + master/variant) */}
                        <div className="flex items-center gap-2 flex-wrap mb-4 min-h-[22px]">
                            <PhaseBadge phase={entry.phase} />
                            {entry.hasMaster && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-300 bg-slate-500/20">
                                    <GitMerge size={10} />
                                    Maestro{entry.variantCount > 0 ? ` + ${entry.variantCount}v` : ''}
                                </span>
                            )}
                            {!entry.hasMaster && entry.variantCount > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-purple-300 bg-purple-500/15">
                                    <GitMerge size={10} />
                                    Variante
                                </span>
                            )}
                        </div>

                        {/* Row 5: Actionable KPI (only if > 0) */}
                        {actionCount > 0 && (
                            <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                                <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />
                                <span className="text-xs font-medium text-red-300">
                                    {actionCount} {actionCount === 1 ? 'acción pendiente' : 'acciones pendientes'}
                                </span>
                            </div>
                        )}

                        {/* CTA */}
                        <div className="flex items-center gap-1 opacity-30 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs font-medium text-blue-400">Abrir proyecto</span>
                            <ArrowRight size={12} className="text-blue-400 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                    </button>
                );
            })}
        </nav>
    );
};

export { ProjectCards };
export type { ProjectCardsProps };
