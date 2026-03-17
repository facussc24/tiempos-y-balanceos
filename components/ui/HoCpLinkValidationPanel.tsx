/**
 * HoCpLinkValidationPanel — Shows HO → CP broken link summary with resolve actions
 *
 * Displays quality checks whose cpItemId points to a non-existent CP item,
 * and allows the user to unlink or re-link each one.
 *
 * @module HoCpLinkValidationPanel
 */

import React, { useState } from 'react';
import { AlertTriangle, Unlink, Link2, X } from 'lucide-react';
import type { HoCpLinkValidationResult, BrokenHoCpLink } from '../../utils/hoCpLinkValidation';

interface HoCpLinkValidationPanelProps {
    validation: HoCpLinkValidationResult;
    onUnlinkCheck: (sheetId: string, checkId: string) => void;
    onRelinkCheck: (sheetId: string, checkId: string, newCpItemId: string) => void;
    cpCandidates: { id: string; label: string }[];
    onClose: () => void;
}

export const HoCpLinkValidationPanel: React.FC<HoCpLinkValidationPanelProps> = ({
    validation,
    onUnlinkCheck,
    onRelinkCheck,
    cpCandidates,
    onClose,
}) => {
    if (validation.totalBroken === 0) return null;

    return (
        <div className="bg-white shadow-lg rounded border border-orange-300 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-orange-500" />
                    Vínculos HO → CP rotos
                    <span className="text-xs font-normal text-orange-600 ml-1">
                        ({validation.totalBroken} referencia{validation.totalBroken !== 1 ? 's' : ''} a ítems CP inexistentes)
                    </span>
                </h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" title="Cerrar" aria-label="Cerrar panel de vínculos HO-CP">
                    <X size={14} />
                </button>
            </div>

            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {validation.brokenLinks.map(link => (
                    <BrokenHoCpLinkRow
                        key={`${link.sheetId}-${link.checkId}`}
                        link={link}
                        onUnlink={onUnlinkCheck}
                        onRelink={onRelinkCheck}
                        candidates={cpCandidates}
                    />
                ))}
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

const BrokenHoCpLinkRow: React.FC<{
    link: BrokenHoCpLink;
    onUnlink: (sheetId: string, checkId: string) => void;
    onRelink: (sheetId: string, checkId: string, newCpItemId: string) => void;
    candidates: { id: string; label: string }[];
}> = ({ link, onUnlink, onRelink, candidates }) => {
    const [showRelink, setShowRelink] = useState(false);

    return (
        <div className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg border bg-orange-50 border-orange-200 text-orange-800">
            <AlertTriangle size={13} className="text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
                <span className="font-medium">{link.sheetName || '(sin nombre)'}</span>
                {' — '}
                <span>{link.characteristic || '(sin característica)'}</span>
                <span className="block text-[10px] text-orange-500 mt-0.5">
                    Apunta a ítem CP inexistente
                </span>

                {showRelink && candidates.length > 0 && (
                    <select
                        className="mt-1 w-full text-[11px] border border-orange-300 rounded px-1.5 py-1 bg-white"
                        defaultValue=""
                        onChange={e => {
                            if (e.target.value) {
                                onRelink(link.sheetId, link.checkId, e.target.value);
                                setShowRelink(false);
                            }
                        }}
                    >
                        <option value="" disabled>Seleccionar ítem CP...</option>
                        {candidates.map(c => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                    </select>
                )}
            </div>

            <div className="flex gap-1 flex-shrink-0">
                <button
                    onClick={() => onUnlink(link.sheetId, link.checkId)}
                    className="p-1 rounded text-orange-500 hover:bg-orange-100 transition"
                    title="Desvincular"
                >
                    <Unlink size={13} />
                </button>
                <button
                    onClick={() => setShowRelink(!showRelink)}
                    className="p-1 rounded text-orange-500 hover:bg-orange-100 transition"
                    title="Revincular"
                >
                    <Link2 size={13} />
                </button>
            </div>
        </div>
    );
};

export default HoCpLinkValidationPanel;
