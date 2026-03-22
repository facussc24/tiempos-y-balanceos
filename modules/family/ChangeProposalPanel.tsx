/**
 * ChangeProposalPanel — UI panel for accepting/rejecting change proposals
 * from master documents in variant documents.
 *
 * Shows a collapsible card with pending proposals, diff preview,
 * and accept/reject controls.
 *
 * @module ChangeProposalPanel
 */

import React, { useState, useMemo } from 'react';
import {
    GitMerge,
    RefreshCw,
    Plus,
    Minus,
    Check,
    X,
    CheckCheck,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    Loader2,
} from 'lucide-react';
import { useChangeProposals } from './hooks/useChangeProposals';
import { toast } from '../../components/ui/Toast';
import type { ChangeProposal } from '../../utils/repositories/familyDocumentRepository';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChangeProposalPanelProps {
    documentId: string;
    /** Callback when proposals change (for parent to refresh) */
    onProposalsChanged?: () => void;
}

// ---------------------------------------------------------------------------
// Change type configuration
// ---------------------------------------------------------------------------

const CHANGE_TYPE_CONFIG: Record<string, {
    label: string;
    description: string;
    bg: string;
    text: string;
    border: string;
    icon: React.ReactNode;
}> = {
    modified: {
        label: 'Modificado',
        description: '',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        icon: <RefreshCw size={12} />,
    },
    added: {
        label: 'Agregado',
        description: '(nuevo item del maestro)',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        icon: <Plus size={12} />,
    },
    removed: {
        label: 'Eliminado',
        description: '(el maestro elimino este item)',
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        icon: <Minus size={12} />,
    },
};

const DEFAULT_CHANGE_CONFIG = {
    label: 'Cambio',
    description: '',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    icon: <RefreshCw size={12} />,
};

// ---------------------------------------------------------------------------
// Diff rendering helper
// ---------------------------------------------------------------------------

interface DiffField {
    field: string;
    oldValue: string;
    newValue: string;
}

function renderDiffPreview(
    oldData: string | null,
    newData: string | null
): React.ReactNode {
    if (!oldData && !newData) return null;

    const changedFields = getDiffFields(oldData, newData);

    if (changedFields.length === 0) return null;

    const MAX_FIELDS = 5;
    const displayed = changedFields.slice(0, MAX_FIELDS);
    const remaining = changedFields.length - MAX_FIELDS;

    return (
        <div className="bg-white rounded border border-slate-200 p-2 text-xs font-mono mt-2">
            {displayed.map((diff, idx) => (
                <div key={idx} className={idx > 0 ? 'mt-1.5 pt-1.5 border-t border-slate-100' : ''}>
                    <div className="text-slate-500 font-medium mb-0.5">
                        Campo: {diff.field}
                    </div>
                    {diff.oldValue && (
                        <div className="text-red-600 line-through truncate">
                            &minus; {diff.oldValue}
                        </div>
                    )}
                    {diff.newValue && (
                        <div className="text-emerald-600 truncate">
                            + {diff.newValue}
                        </div>
                    )}
                </div>
            ))}
            {remaining > 0 && (
                <div className="text-slate-400 mt-1.5 text-[10px]">
                    +{remaining} campo{remaining > 1 ? 's' : ''} mas
                </div>
            )}
        </div>
    );
}

/**
 * Parse old/new JSON data and return list of changed fields.
 * Exported for testing.
 */
export function getDiffFields(
    oldData: string | null,
    newData: string | null
): DiffField[] {
    const fields: DiffField[] = [];

    let oldObj: Record<string, unknown> = {};
    let newObj: Record<string, unknown> = {};

    try {
        if (oldData) oldObj = JSON.parse(oldData);
    } catch {
        // If oldData is not valid JSON, treat as a single value
        if (oldData) oldObj = { value: oldData };
    }

    try {
        if (newData) newObj = JSON.parse(newData);
    } catch {
        if (newData) newObj = { value: newData };
    }

    // Collect all keys from both objects
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    for (const key of allKeys) {
        const oldVal = oldObj[key];
        const newVal = newObj[key];
        const oldStr = oldVal !== undefined && oldVal !== null ? String(oldVal) : '';
        const newStr = newVal !== undefined && newVal !== null ? String(newVal) : '';

        if (oldStr !== newStr) {
            fields.push({
                field: key,
                oldValue: oldStr,
                newValue: newStr,
            });
        }
    }

    return fields;
}

// ---------------------------------------------------------------------------
// Proposal Card sub-component
// ---------------------------------------------------------------------------

interface ProposalCardProps {
    proposal: ChangeProposal;
    onAccept: () => void;
    onReject: () => void;
    accepting: boolean;
    rejecting: boolean;
}

function ProposalCard({ proposal, onAccept, onReject, accepting, rejecting }: ProposalCardProps) {
    const config = CHANGE_TYPE_CONFIG[proposal.changeType] ?? DEFAULT_CHANGE_CONFIG;
    const isActioning = accepting || rejecting;

    return (
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-3" data-testid={`proposal-card-${proposal.id}`}>
            {/* Change type badge + item type */}
            <div className="flex items-center gap-2 flex-wrap">
                <span
                    className={`
                        inline-flex items-center gap-1 px-2 py-0.5
                        rounded-md text-[10px] font-bold uppercase tracking-wide
                        border ${config.bg} ${config.text} ${config.border}
                    `.trim().replace(/\s+/g, ' ')}
                >
                    {config.icon}
                    {config.label}
                </span>
                <span className="text-xs font-medium text-slate-700">
                    {proposal.itemType}
                </span>
            </div>

            {/* Description for added/removed */}
            {config.description && (
                <p className="text-[11px] text-slate-500 mt-1">{config.description}</p>
            )}

            {/* Diff preview */}
            {proposal.changeType === 'modified' && renderDiffPreview(proposal.oldData, proposal.newData)}

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-3">
                <button
                    onClick={onAccept}
                    disabled={isActioning}
                    className="
                        inline-flex items-center gap-1.5
                        bg-emerald-600 text-white hover:bg-emerald-700
                        text-xs px-3 py-1.5 rounded-lg font-medium
                        transition-all duration-150
                        disabled:opacity-50 disabled:cursor-not-allowed
                    "
                    data-testid={`accept-btn-${proposal.id}`}
                >
                    {accepting ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : (
                        <Check size={14} />
                    )}
                    Aceptar
                </button>
                <button
                    onClick={onReject}
                    disabled={isActioning}
                    className="
                        inline-flex items-center gap-1.5
                        bg-slate-100 text-slate-700 hover:bg-slate-200
                        text-xs px-3 py-1.5 rounded-lg font-medium
                        transition-all duration-150
                        disabled:opacity-50 disabled:cursor-not-allowed
                    "
                    data-testid={`reject-btn-${proposal.id}`}
                >
                    {rejecting ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : (
                        <X size={14} />
                    )}
                    Rechazar
                </button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const ChangeProposalPanel: React.FC<ChangeProposalPanelProps> = ({
    documentId,
    onProposalsChanged,
}) => {
    const {
        proposals,
        pendingCount,
        loading,
        acceptProposal,
        rejectProposal,
        acceptAll,
    } = useChangeProposals(documentId);

    // Expanded by default when there are proposals, collapsed otherwise
    const [expanded, setExpanded] = useState<boolean | null>(null);
    const isExpanded = expanded ?? pendingCount > 0;

    // Track which proposals are being actioned
    const [acceptingIds, setAcceptingIds] = useState<Set<number>>(new Set());
    const [rejectingIds, setRejectingIds] = useState<Set<number>>(new Set());
    const [acceptingAll, setAcceptingAll] = useState(false);

    // Memoized sorted proposals
    const sortedProposals = useMemo(() => {
        return [...proposals].sort((a, b) => {
            // Sort: added first, then modified, then removed
            const order: Record<string, number> = { added: 0, modified: 1, removed: 2 };
            const aOrder = order[a.changeType] ?? 1;
            const bOrder = order[b.changeType] ?? 1;
            return aOrder - bOrder;
        });
    }, [proposals]);

    const handleAccept = async (proposalId: number) => {
        setAcceptingIds(prev => new Set(prev).add(proposalId));
        try {
            await acceptProposal(proposalId);
            toast.success('Propuesta aceptada', 'El cambio del maestro fue aplicado');
            onProposalsChanged?.();
        } finally {
            setAcceptingIds(prev => {
                const next = new Set(prev);
                next.delete(proposalId);
                return next;
            });
        }
    };

    const handleReject = async (proposalId: number) => {
        setRejectingIds(prev => new Set(prev).add(proposalId));
        try {
            await rejectProposal(proposalId);
            toast.info('Propuesta rechazada', 'El cambio del maestro fue rechazado');
            onProposalsChanged?.();
        } finally {
            setRejectingIds(prev => {
                const next = new Set(prev);
                next.delete(proposalId);
                return next;
            });
        }
    };

    const handleAcceptAll = async () => {
        setAcceptingAll(true);
        try {
            await acceptAll();
            toast.success(
                'Todas las propuestas aceptadas',
                `Se aplicaron ${pendingCount} cambios del maestro`
            );
            onProposalsChanged?.();
        } finally {
            setAcceptingAll(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/60">
            {/* Collapsible Header */}
            <button
                onClick={() => setExpanded(!isExpanded)}
                className="
                    w-full flex items-center gap-2 px-4 py-3
                    hover:bg-slate-50/50 transition-colors duration-150
                    rounded-t-xl
                "
                aria-expanded={isExpanded}
                data-testid="change-proposal-header"
                title="Alternar propuestas de cambio"
            >
                {isExpanded ? (
                    <ChevronDown size={16} className="text-slate-500 flex-shrink-0" />
                ) : (
                    <ChevronRight size={16} className="text-slate-500 flex-shrink-0" />
                )}
                <GitMerge size={16} className="text-slate-600 flex-shrink-0" />
                <span className="text-sm font-bold text-slate-800">
                    Cambios del maestro
                </span>
                {pendingCount > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
                    </span>
                )}
                {loading && (
                    <Loader2 size={14} className="animate-spin text-slate-400 ml-auto" />
                )}
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-100">
                    {/* Loading state */}
                    {loading && proposals.length === 0 && (
                        <div className="flex items-center justify-center py-6 gap-2" role="status" aria-live="polite">
                            <Loader2 size={20} className="animate-spin text-blue-500" />
                            <span className="text-sm text-slate-500">Cargando propuestas...</span>
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && pendingCount === 0 && (
                        <div className="flex flex-col items-center justify-center py-6 gap-2" data-testid="empty-state">
                            <CheckCircle size={24} className="text-emerald-400" />
                            <span className="text-sm text-slate-500">Sin cambios pendientes del maestro</span>
                        </div>
                    )}

                    {/* Proposals list */}
                    {pendingCount > 0 && (
                        <div className="mt-3 space-y-3">
                            {/* Accept All button */}
                            <div>
                                <button
                                    onClick={handleAcceptAll}
                                    disabled={acceptingAll}
                                    className="
                                        inline-flex items-center gap-1.5
                                        bg-blue-600 text-white hover:bg-blue-700
                                        text-xs px-3 py-1.5 rounded-lg font-medium
                                        transition-all duration-150
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                    "
                                    data-testid="accept-all-btn"
                                >
                                    {acceptingAll ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <CheckCheck size={14} />
                                    )}
                                    Aceptar todos
                                </button>
                            </div>

                            {/* Proposal cards */}
                            {sortedProposals.map(proposal => (
                                <ProposalCard
                                    key={proposal.id}
                                    proposal={proposal}
                                    onAccept={() => handleAccept(proposal.id)}
                                    onReject={() => handleReject(proposal.id)}
                                    accepting={acceptingIds.has(proposal.id) || acceptingAll}
                                    rejecting={rejectingIds.has(proposal.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ChangeProposalPanel;
