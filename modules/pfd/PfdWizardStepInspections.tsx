/**
 * PFD Wizard Step 3 — "Inspecciones y Rechazos"
 *
 * Shows included operations in order with "+" buttons between them
 * to insert inspection annotation points. Each inspection has:
 * - Description input
 * - Reject disposition dropdown (none, rework, scrap, sort)
 * - Conditional fields based on disposition
 * - Delete button
 */

import React, { useCallback, useMemo } from 'react';
import { Plus, X, ArrowDown, CornerDownLeft, Trash2, Sparkles } from 'lucide-react';
import type { AmfeDocument, AmfeOperation } from '../amfe/amfeTypes';
import type {
    PfdWizardAnnotations,
    PfdInspectionAnnotation,
} from './pfdWizardTypes';
import type { RejectDisposition } from './pfdTypes';
import { PfdSymbol } from './PfdSymbols';

interface WizardStepProps {
    amfeDoc: AmfeDocument;
    annotations: PfdWizardAnnotations;
    onUpdateAnnotations: (annotations: PfdWizardAnnotations) => void;
}

/** Disposition labels for dropdown */
const DISPOSITION_OPTIONS: { value: RejectDisposition; label: string }[] = [
    { value: 'none', label: 'Ninguna' },
    { value: 'rework', label: 'Retrabajo' },
    { value: 'scrap', label: 'Descarte' },
    { value: 'sort', label: 'Seleccion' },
];

/** Get included operations in AMFE order */
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

/** Get inspections after a given operation ID */
function getInspectionsAfter(
    inspections: PfdInspectionAnnotation[],
    operationId: string,
): PfdInspectionAnnotation[] {
    return inspections.filter((i) => i.afterOperationId === operationId);
}

const PfdWizardStepInspections: React.FC<WizardStepProps> = ({
    amfeDoc,
    annotations,
    onUpdateAnnotations,
}) => {
    const includedOps = useMemo(
        () => getIncludedOps(amfeDoc, annotations),
        [amfeDoc, annotations],
    );

    /** Get step numbers for rework return dropdown */
    const stepNumbers = useMemo(
        () => includedOps.map((op) => op.opNumber),
        [includedOps],
    );

    /** Add a new inspection after a given operation */
    const addInspection = useCallback(
        (afterOperationId: string) => {
            const newInspection: PfdInspectionAnnotation = {
                id: crypto.randomUUID(),
                afterOperationId,
                description: '',
                rejectDisposition: 'none',
                reworkReturnStep: '',
                scrapDescription: '',
            };
            onUpdateAnnotations({
                ...annotations,
                inspections: [...annotations.inspections, newInspection],
            });
        },
        [annotations, onUpdateAnnotations],
    );

    /** Remove an inspection by ID */
    const removeInspection = useCallback(
        (inspId: string) => {
            onUpdateAnnotations({
                ...annotations,
                inspections: annotations.inspections.filter((i) => i.id !== inspId),
            });
        },
        [annotations, onUpdateAnnotations],
    );

    /** Update an inspection field */
    const updateInspection = useCallback(
        (inspId: string, patch: Partial<PfdInspectionAnnotation>) => {
            const updated = annotations.inspections.map((i) =>
                i.id === inspId ? { ...i, ...patch } : i,
            );
            onUpdateAnnotations({ ...annotations, inspections: updated });
        },
        [annotations, onUpdateAnnotations],
    );

    /** Render a single inspection card */
    const renderInspectionCard = (insp: PfdInspectionAnnotation) => (
        <div
            key={insp.id}
            className="ml-8 border-2 border-emerald-300 bg-emerald-50 rounded-lg p-3 space-y-2"
        >
            <div className="flex items-start gap-2">
                <PfdSymbol type="inspection" size={18} className="mt-0.5 shrink-0" />
                {insp.autoDetected && (
                    <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 bg-purple-100 border border-purple-300 rounded-full shrink-0 mt-0.5"
                        title="Auto-detectada desde operación AMFE"
                    >
                        <Sparkles size={10} />
                        Auto
                    </span>
                )}
                <div className="flex-1 space-y-2">
                    {/* Description */}
                    <input
                        type="text"
                        value={insp.description}
                        onChange={(e) =>
                            updateInspection(insp.id, { description: e.target.value })
                        }
                        placeholder="Descripción de la inspección..."
                        className="w-full text-sm px-2 py-1.5 border border-emerald-200 rounded focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300"
                        maxLength={200}
                    />

                    {/* Disposition dropdown */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-1.5 text-xs text-gray-600">
                            <span className="font-medium">Disposicion:</span>
                            <select
                                value={insp.rejectDisposition}
                                onChange={(e) =>
                                    updateInspection(insp.id, {
                                        rejectDisposition: e.target.value as RejectDisposition,
                                        // Clear conditional fields on change
                                        reworkReturnStep:
                                            e.target.value === 'rework'
                                                ? insp.reworkReturnStep
                                                : '',
                                        scrapDescription:
                                            e.target.value === 'scrap' || e.target.value === 'sort'
                                                ? insp.scrapDescription
                                                : '',
                                    })
                                }
                                className="text-sm px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300"
                            >
                                {DISPOSITION_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        {/* Rework: return step dropdown */}
                        {insp.rejectDisposition === 'rework' && (
                            <label className="flex items-center gap-1.5 text-xs text-gray-600">
                                <CornerDownLeft size={12} className="text-amber-500" />
                                <span className="font-medium">Retorno a:</span>
                                <select
                                    value={insp.reworkReturnStep}
                                    onChange={(e) =>
                                        updateInspection(insp.id, {
                                            reworkReturnStep: e.target.value,
                                        })
                                    }
                                    className="text-sm px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300"
                                >
                                    <option value="">Seleccionar...</option>
                                    {stepNumbers.map((sn) => (
                                        <option key={sn} value={`OP ${sn}`}>
                                            OP {sn}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}

                        {/* Scrap/Sort: criteria description */}
                        {(insp.rejectDisposition === 'scrap' ||
                            insp.rejectDisposition === 'sort') && (
                            <input
                                type="text"
                                value={insp.scrapDescription}
                                onChange={(e) =>
                                    updateInspection(insp.id, {
                                        scrapDescription: e.target.value,
                                    })
                                }
                                placeholder={
                                    insp.rejectDisposition === 'scrap'
                                        ? 'Criterio de descarte...'
                                        : 'Criterio de seleccion...'
                                }
                                className="flex-1 text-sm px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300"
                                maxLength={200}
                            />
                        )}
                    </div>
                </div>

                {/* Delete button */}
                <button
                    type="button"
                    onClick={() => removeInspection(insp.id)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0"
                    title="Eliminar inspección"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );

    /** Render the "+" add inspection button */
    const renderAddButton = (afterOpId: string) => (
        <div className="flex justify-center py-1">
            <button
                type="button"
                onClick={() => addInspection(afterOpId)}
                className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full hover:bg-emerald-100 hover:border-emerald-400 transition-all"
                title="Agregar inspección después de esta operación"
            >
                <Plus size={14} />
                Inspección
            </button>
        </div>
    );

    return (
        <div className="space-y-1">
            {/* Header explanation */}
            <p className="text-sm text-gray-500 mb-3">
                Las inspecciones marcadas con{' '}
                <span className="inline-flex items-center gap-0.5 text-purple-600 font-medium">
                    <Sparkles size={12} /> Auto
                </span>{' '}
                fueron detectadas del AMFE. Usá el botón{' '}
                <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium">
                    <Plus size={12} /> Inspección
                </span>{' '}
                para agregar más.
            </p>

            {includedOps.length === 0 && (
                <div className="text-center text-gray-400 py-8 text-sm">
                    No hay operaciones incluidas.
                </div>
            )}

            {/* Mini flow with inspection insertion points */}
            <div className="space-y-0">
                {includedOps.map((op, index) => {
                    const inspectionsAfter = getInspectionsAfter(
                        annotations.inspections,
                        op.id,
                    );

                    return (
                        <React.Fragment key={op.id}>
                            {/* Flow arrow between operations */}
                            {index > 0 && (
                                <div className="flex justify-center py-0.5">
                                    <ArrowDown size={14} className="text-cyan-400" />
                                </div>
                            )}

                            {/* Operation card (compact) */}
                            <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-white">
                                <PfdSymbol type={op.stepType} size={18} />
                                <span className="font-mono text-xs font-bold text-gray-500">
                                    OP {op.opNumber}
                                </span>
                                <span className="text-sm text-gray-700 truncate">
                                    {op.name || '(Sin nombre)'}
                                </span>
                                <span className="ml-auto text-[10px] text-gray-400">
                                    {inspectionsAfter.length > 0 &&
                                        `${inspectionsAfter.length} insp.`}
                                </span>
                            </div>

                            {/* Existing inspections after this operation */}
                            {inspectionsAfter.map((insp) => (
                                <React.Fragment key={insp.id}>
                                    <div className="flex justify-center py-0.5">
                                        <ArrowDown size={12} className="text-emerald-400" />
                                    </div>
                                    {renderInspectionCard(insp)}
                                </React.Fragment>
                            ))}

                            {/* Add inspection button */}
                            {renderAddButton(op.id)}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Summary */}
            <div className="text-xs text-gray-400 text-center pt-2">
                {annotations.inspections.length} inspeccion
                {annotations.inspections.length !== 1 ? 'es' : ''} definida
                {annotations.inspections.length !== 1 ? 's' : ''}
                {annotations.inspections.some(i => i.autoDetected) && (
                    <span className="text-purple-400">
                        {' '}({annotations.inspections.filter(i => i.autoDetected).length} auto-detectada
                        {annotations.inspections.filter(i => i.autoDetected).length !== 1 ? 's' : ''})
                    </span>
                )}
            </div>
        </div>
    );
};

export default PfdWizardStepInspections;
