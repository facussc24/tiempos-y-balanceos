/**
 * LinkValidationPanel — Shows PFD ↔ AMFE broken link summary with resolve actions
 *
 * Displays broken links in both directions and allows the user to:
 * - Unlink (clear the broken reference)
 * - Re-link (select a new target from a dropdown)
 *
 * @module LinkValidationPanel
 */

import React, { useState } from 'react';
import { AlertTriangle, Unlink, Link2, X, ChevronDown } from 'lucide-react';
import type { PfdAmfeLinkValidationResult, BrokenPfdLink, BrokenAmfeLink } from '../../utils/pfdAmfeLinkValidation';

interface LinkValidationPanelProps {
    validation: PfdAmfeLinkValidationResult;
    /** Which module is hosting this panel */
    context: 'pfd' | 'amfe';
    /** Unlink a PFD step */
    onUnlinkPfdStep?: (stepId: string) => void;
    /** Unlink an AMFE operation */
    onUnlinkAmfeOp?: (operationId: string) => void;
    /** Re-link a PFD step to a new AMFE operation */
    onRelinkPfdStep?: (stepId: string, newAmfeOpId: string) => void;
    /** Re-link an AMFE operation to a new PFD step */
    onRelinkAmfeOp?: (operationId: string, newPfdStepId: string) => void;
    /** AMFE operation candidates for re-linking */
    amfeCandidates?: { id: string; label: string }[];
    /** PFD step candidates for re-linking */
    pfdCandidates?: { id: string; label: string }[];
    /** Close the panel */
    onClose: () => void;
}

export const LinkValidationPanel: React.FC<LinkValidationPanelProps> = ({
    validation,
    context,
    onUnlinkPfdStep,
    onUnlinkAmfeOp,
    onRelinkPfdStep,
    onRelinkAmfeOp,
    amfeCandidates = [],
    pfdCandidates = [],
    onClose,
}) => {
    if (validation.totalBroken === 0) return null;

    const showPfdSection = validation.brokenPfdLinks.length > 0;
    const showAmfeSection = validation.brokenAmfeLinks.length > 0;

    return (
        <div className="bg-white shadow-lg rounded border border-orange-300 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-orange-500" />
                    Vínculos PFD ↔ AMFE rotos
                    <span className="text-xs font-normal text-orange-600 ml-1">
                        ({validation.totalBroken} inconsistencia{validation.totalBroken !== 1 ? 's' : ''})
                    </span>
                </h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" title="Cerrar" aria-label="Cerrar panel de vínculos">
                    <X size={14} />
                </button>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {showPfdSection && (
                    <div>
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            Pasos PFD → AMFE inexistente
                        </p>
                        <div className="space-y-1.5">
                            {validation.brokenPfdLinks.map(link => (
                                <BrokenPfdLinkRow
                                    key={link.stepId}
                                    link={link}
                                    canResolve={context === 'pfd'}
                                    onUnlink={onUnlinkPfdStep}
                                    onRelink={onRelinkPfdStep}
                                    candidates={amfeCandidates}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {showAmfeSection && (
                    <div>
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            Operaciones AMFE → PFD inexistente
                        </p>
                        <div className="space-y-1.5">
                            {validation.brokenAmfeLinks.map(link => (
                                <BrokenAmfeLinkRow
                                    key={link.operationId}
                                    link={link}
                                    canResolve={context === 'amfe'}
                                    onUnlink={onUnlinkAmfeOp}
                                    onRelink={onRelinkAmfeOp}
                                    candidates={pfdCandidates}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Row components
// ---------------------------------------------------------------------------

const BrokenPfdLinkRow: React.FC<{
    link: BrokenPfdLink;
    canResolve: boolean;
    onUnlink?: (stepId: string) => void;
    onRelink?: (stepId: string, newAmfeOpId: string) => void;
    candidates: { id: string; label: string }[];
}> = ({ link, canResolve, onUnlink, onRelink, candidates }) => {
    const [showRelink, setShowRelink] = useState(false);

    return (
        <div className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg border bg-orange-50 border-orange-200 text-orange-800">
            <AlertTriangle size={13} className="text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
                <span className="font-medium">{link.stepNumber || '(sin nº)'}</span>
                {' — '}
                <span>{link.stepDescription || '(sin descripción)'}</span>
                <span className="block text-[10px] text-orange-500 mt-0.5">
                    Apunta a operación AMFE inexistente
                </span>

                {showRelink && candidates.length > 0 && (
                    <select
                        className="mt-1 w-full text-[11px] border border-orange-300 rounded px-1.5 py-1 bg-white"
                        defaultValue=""
                        onChange={e => {
                            if (e.target.value && onRelink) {
                                onRelink(link.stepId, e.target.value);
                                setShowRelink(false);
                            }
                        }}
                    >
                        <option value="" disabled>Seleccionar operación AMFE...</option>
                        {candidates.map(c => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                    </select>
                )}
            </div>

            {canResolve && (
                <div className="flex gap-1 flex-shrink-0">
                    <button
                        onClick={() => onUnlink?.(link.stepId)}
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
            )}
        </div>
    );
};

const BrokenAmfeLinkRow: React.FC<{
    link: BrokenAmfeLink;
    canResolve: boolean;
    onUnlink?: (operationId: string) => void;
    onRelink?: (operationId: string, newPfdStepId: string) => void;
    candidates: { id: string; label: string }[];
}> = ({ link, canResolve, onUnlink, onRelink, candidates }) => {
    const [showRelink, setShowRelink] = useState(false);

    return (
        <div className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg border bg-orange-50 border-orange-200 text-orange-800">
            <AlertTriangle size={13} className="text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
                <span className="font-medium">{link.opNumber || '(sin nº)'}</span>
                {' — '}
                <span>{link.operationName || '(sin nombre)'}</span>
                <span className="block text-[10px] text-orange-500 mt-0.5">
                    Apunta a paso PFD inexistente
                </span>

                {showRelink && candidates.length > 0 && (
                    <select
                        className="mt-1 w-full text-[11px] border border-orange-300 rounded px-1.5 py-1 bg-white"
                        defaultValue=""
                        onChange={e => {
                            if (e.target.value && onRelink) {
                                onRelink(link.operationId, e.target.value);
                                setShowRelink(false);
                            }
                        }}
                    >
                        <option value="" disabled>Seleccionar paso PFD...</option>
                        {candidates.map(c => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                    </select>
                )}
            </div>

            {canResolve && (
                <div className="flex gap-1 flex-shrink-0">
                    <button
                        onClick={() => onUnlink?.(link.operationId)}
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
            )}
        </div>
    );
};

export default LinkValidationPanel;
