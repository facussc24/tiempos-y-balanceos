/**
 * RevisionHistoryPanel — Collapsible timeline of document revisions
 *
 * Shows each revision with badge, date, description, and who revised.
 * Provides a "Ver snapshot" button per entry.
 *
 * @module RevisionHistoryPanel
 */

import React from 'react';
import { History, Eye, ChevronDown, ChevronUp, ArrowLeftRight } from 'lucide-react';
import type { RevisionListItem } from '../../utils/repositories/revisionRepository';
import { formatRevisionLabel } from '../../utils/revisionUtils';

interface RevisionHistoryPanelProps {
    revisions: RevisionListItem[];
    onViewSnapshot: (level: string) => void;
    onCompare?: (levelA: string, levelB: string) => void;
    isOpen: boolean;
    onToggle: () => void;
}

export const RevisionHistoryPanel: React.FC<RevisionHistoryPanelProps> = ({
    revisions,
    onViewSnapshot,
    onCompare,
    isOpen,
    onToggle,
}) => {
    const formatDate = (iso: string): string => {
        try {
            const d = new Date(iso);
            return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch {
            return iso;
        }
    };

    return (
        <div className="bg-white border-b border-gray-200 no-print">
            {/* Header */}
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
            >
                <History size={14} className="text-indigo-500" />
                <span>Historial de Revisiones</span>
                <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {revisions.length}
                </span>
                <div className="flex-1" />
                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* Timeline (most recent first) */}
            <div
                className="overflow-hidden transition-all duration-200 ease-out"
                style={{ maxHeight: isOpen ? '15rem' : '0px', opacity: isOpen ? 1 : 0 }}
            >
                <div className="px-4 pb-3 max-h-60 overflow-y-auto">
                    {revisions.length === 0 ? (
                        <p className="text-xs text-gray-400 py-3 text-center">Sin revisiones anteriores</p>
                    ) : (
                        <div className="space-y-2">
                            {revisions.map((rev, i) => (
                                <div
                                    key={rev.revisionLevel}
                                    className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0"
                                >
                                    {/* Revision badge */}
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${
                                        i === 0
                                            ? 'bg-indigo-100 text-indigo-700'
                                            : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {formatRevisionLabel(rev.revisionLevel)}
                                    </span>

                                    {/* Details */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-gray-700">{rev.description}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-gray-400">{formatDate(rev.createdAt)}</span>
                                            {rev.revisedBy && (
                                                <span className="text-[10px] text-gray-400">por {rev.revisedBy}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* View snapshot */}
                                    <button
                                        onClick={() => onViewSnapshot(rev.revisionLevel)}
                                        className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 font-medium px-2 py-1 rounded hover:bg-indigo-50 transition flex-shrink-0"
                                        title={`Ver snapshot de ${formatRevisionLabel(rev.revisionLevel)}`}
                                    >
                                        <Eye size={12} />
                                        <span>Ver</span>
                                    </button>

                                    {/* Compare with next (older) revision */}
                                    {onCompare && i < revisions.length - 1 && (
                                        <button
                                            onClick={() => onCompare(rev.revisionLevel, revisions[i + 1].revisionLevel)}
                                            className="flex items-center gap-1 text-[10px] text-amber-500 hover:text-amber-700 font-medium px-2 py-1 rounded hover:bg-amber-50 transition flex-shrink-0"
                                            title={`Comparar ${formatRevisionLabel(rev.revisionLevel)} con ${formatRevisionLabel(revisions[i + 1].revisionLevel)}`}
                                        >
                                            <ArrowLeftRight size={12} />
                                            <span>Comparar</span>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RevisionHistoryPanel;
