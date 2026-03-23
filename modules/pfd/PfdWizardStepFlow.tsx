/**
 * PFD Wizard Step 2 — "Organizar Flujo"
 *
 * Lane assignment for parallel branches. Users assign included operations
 * to "Principal" (main flow) or one of 4 parallel branches (A, B, C, D).
 *
 * Each operation shows its symbol and clickable branch pills.
 * Below the operation list, active branches get editable label inputs.
 */

import React, { useCallback, useMemo } from 'react';
import { GitBranch } from 'lucide-react';
import type { AmfeDocument, AmfeOperation } from '../amfe/amfeTypes';
import type {
    PfdWizardAnnotations,
    PfdBranchGroup,
} from './pfdWizardTypes';
import { BRANCH_IDS } from './pfdWizardTypes';
import { BRANCH_COLORS, getBranchColor } from './pfdTypes';
import { PfdSymbol } from './PfdSymbols';

interface WizardStepProps {
    amfeDoc: AmfeDocument;
    annotations: PfdWizardAnnotations;
    onUpdateAnnotations: (annotations: PfdWizardAnnotations) => void;
}

/** Get included operations with their resolved annotation step type */
function getIncludedOps(
    amfeDoc: AmfeDocument,
    annotations: PfdWizardAnnotations,
): (AmfeOperation & { stepType: string })[] {
    const ops = amfeDoc.operations || [];
    return ops
        .filter((op) => {
            const ann = annotations.operations.find((a) => a.operationId === op.id);
            return ann ? ann.included : true;
        })
        .map((op) => {
            const ann = annotations.operations.find((a) => a.operationId === op.id);
            return { ...op, stepType: ann?.stepType || 'operation' };
        });
}

/** Find the branch ID assigned to an operation, or '' for main flow */
function getAssignedBranch(branches: PfdBranchGroup[], opId: string): string {
    for (const branch of branches) {
        if (branch.operationIds.includes(opId)) return branch.branchId;
    }
    return '';
}

/** Get all active branch IDs (those that have at least one operation) */
function getActiveBranchIds(branches: PfdBranchGroup[]): string[] {
    return branches
        .filter((b) => b.operationIds.length > 0)
        .map((b) => b.branchId);
}

const PfdWizardStepFlow: React.FC<WizardStepProps> = ({ amfeDoc, annotations, onUpdateAnnotations }) => {
    const includedOps = useMemo(
        () => getIncludedOps(amfeDoc, annotations),
        [amfeDoc, annotations],
    );

    const activeBranches = useMemo(
        () => getActiveBranchIds(annotations.branches),
        [annotations.branches],
    );

    /**
     * Assign an operation to a branch (or remove from all branches for "Principal").
     */
    const assignBranch = useCallback(
        (opId: string, branchId: string) => {
            let newBranches = annotations.branches.map((b) => ({
                ...b,
                operationIds: b.operationIds.filter((id) => id !== opId),
            }));

            if (branchId) {
                // Find or create the branch group
                const existing = newBranches.find((b) => b.branchId === branchId);
                if (existing) {
                    existing.operationIds = [...existing.operationIds, opId];
                } else {
                    newBranches.push({
                        branchId,
                        branchLabel: `Linea ${branchId}`,
                        operationIds: [opId],
                    });
                }
            }

            // Remove empty branch groups
            newBranches = newBranches.filter((b) => b.operationIds.length > 0);

            onUpdateAnnotations({ ...annotations, branches: newBranches });
        },
        [annotations, onUpdateAnnotations],
    );

    /** Update the label for a branch */
    const updateBranchLabel = useCallback(
        (branchId: string, label: string) => {
            const newBranches = annotations.branches.map((b) =>
                b.branchId === branchId ? { ...b, branchLabel: label } : b,
            );
            onUpdateAnnotations({ ...annotations, branches: newBranches });
        },
        [annotations, onUpdateAnnotations],
    );

    return (
        <div className="space-y-4">
            {/* Header explanation */}
            <div className="flex items-start gap-2 p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
                <GitBranch size={18} className="text-cyan-600 mt-0.5 shrink-0" />
                <p className="text-sm text-cyan-800">
                    Asigna operaciones a líneas paralelas. Las operaciones no asignadas
                    quedan en el flujo principal.
                </p>
            </div>

            {/* Operation list with branch pills */}
            {includedOps.length === 0 && (
                <div className="text-center text-gray-400 py-8 text-sm">
                    No hay operaciones incluidas.
                </div>
            )}

            <div className="space-y-2">
                {includedOps.map((op) => {
                    const currentBranch = getAssignedBranch(annotations.branches, op.id);

                    return (
                        <div
                            key={op.id}
                            className="flex items-center gap-3 border border-gray-200 rounded-lg p-3 bg-white"
                        >
                            {/* Operation info */}
                            <PfdSymbol type={op.stepType} size={20} />
                            <div className="min-w-0 flex-1">
                                <span className="font-mono text-xs font-bold text-gray-500 mr-1.5">
                                    OP {op.opNumber}
                                </span>
                                <span className="text-sm text-gray-700 truncate">
                                    {op.name || '(Sin nombre)'}
                                </span>
                            </div>

                            {/* Branch pills */}
                            <div className="flex items-center gap-1 shrink-0">
                                {/* Principal pill */}
                                <button
                                    type="button"
                                    onClick={() => assignBranch(op.id, '')}
                                    className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-all ${
                                        !currentBranch
                                            ? 'bg-cyan-100 text-cyan-700 border-cyan-400 ring-1 ring-cyan-300'
                                            : 'bg-white text-gray-500 border-gray-200 hover:border-cyan-300 hover:text-cyan-600'
                                    }`}
                                >
                                    Principal
                                </button>

                                {/* Branch pills */}
                                {BRANCH_IDS.map((bid) => {
                                    const color = getBranchColor(bid);
                                    const isActive = currentBranch === bid;

                                    return (
                                        <button
                                            key={bid}
                                            type="button"
                                            onClick={() => assignBranch(op.id, bid)}
                                            className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-all ${
                                                isActive
                                                    ? `${color.badge} border ring-1`
                                                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                                            }`}
                                        >
                                            Linea {bid}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Active branch labels */}
            {activeBranches.length > 0 && (
                <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Etiquetas de líneas paralelas
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                        {activeBranches.map((bid) => {
                            const branch = annotations.branches.find(
                                (b) => b.branchId === bid,
                            );
                            const color = getBranchColor(bid);

                            return (
                                <div key={bid} className="flex items-center gap-2">
                                    <span
                                        className={`text-xs font-bold px-2 py-0.5 rounded border ${color.badge}`}
                                    >
                                        Linea {bid}
                                    </span>
                                    <input
                                        type="text"
                                        value={branch?.branchLabel || ''}
                                        onChange={(e) =>
                                            updateBranchLabel(bid, e.target.value)
                                        }
                                        placeholder={`Nombre linea ${bid}...`}
                                        className={`flex-1 text-sm px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300 ${color.text}`}
                                        maxLength={60}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Summary */}
            <div className="text-xs text-gray-400 text-center pt-2">
                {includedOps.length} operaciones incluidas
                {activeBranches.length > 0 &&
                    ` \u00B7 ${activeBranches.length} linea${activeBranches.length > 1 ? 's' : ''} paralela${activeBranches.length > 1 ? 's' : ''}`}
            </div>
        </div>
    );
};

export default PfdWizardStepFlow;
