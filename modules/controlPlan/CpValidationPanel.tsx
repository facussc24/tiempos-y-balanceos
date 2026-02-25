/**
 * CpValidationPanel - Validation results panel for Control Plan
 *
 * Extracted from ControlPlanApp.tsx to reduce component size.
 * Shows cross-validation issues with AMFE, clickable to jump to items.
 */

import React from 'react';
import { CpValidationIssue } from './cpCrossValidation';
import { ShieldCheck, XCircle, AlertTriangle, Info, X as XIcon } from 'lucide-react';

interface CpValidationPanelProps {
    issues: CpValidationIssue[];
    onClose: () => void;
    onJumpToItem: (itemId?: string) => void;
}

const CpValidationPanel: React.FC<CpValidationPanelProps> = ({ issues, onClose, onJumpToItem }) => {
    return (
        <div className="mt-4 bg-white shadow-lg rounded border border-gray-300 p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <ShieldCheck size={16} className={
                        issues.some(i => i.severity === 'error') ? 'text-red-500'
                        : issues.length > 0 ? 'text-amber-500'
                        : 'text-teal-500'
                    } />
                    Validacion del Plan de Control
                    {issues.length === 0 && <span className="text-teal-600 text-xs font-normal ml-2">Sin problemas detectados</span>}
                </h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
                    <XIcon size={14} />
                </button>
            </div>
            {issues.length > 0 && (
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {issues.map((issue, idx) => {
                        const isClickable = !!issue.itemId;
                        const Tag = isClickable ? 'button' : 'div';
                        return (
                            <Tag key={idx}
                                {...(isClickable ? { onClick: () => onJumpToItem(issue.itemId) } : {})}
                                className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg border w-full text-left transition ${
                                    issue.severity === 'error' ? 'bg-red-50 border-red-200 text-red-800'
                                    : issue.severity === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800'
                                    : 'bg-blue-50 border-blue-200 text-blue-800'
                                } ${isClickable ? 'cursor-pointer hover:brightness-95 hover:shadow-sm' : ''}`}>
                                {issue.severity === 'error' ? <XCircle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
                                : issue.severity === 'warning' ? <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                : <Info size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />}
                                <div>
                                    <span className="font-medium">[{issue.code}]</span> {issue.message}
                                    {isClickable && <span className="ml-1 text-[10px] opacity-60">(click para ir)</span>}
                                </div>
                            </Tag>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default CpValidationPanel;
