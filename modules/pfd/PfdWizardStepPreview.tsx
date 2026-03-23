/**
 * PFD Wizard Step 4 — "Vista Previa"
 *
 * Shows a preview of the PFD that will be generated, including:
 * - Summary stats box (steps, operations, transports, inspections, branches)
 * - A compact vertical flow preview with step symbols
 * - Warnings list (if any)
 */

import React, { useMemo } from 'react';
import { BarChart3, AlertTriangle, ArrowDown } from 'lucide-react';
import type { AmfeDocument } from '../amfe/amfeTypes';
import type { PfdWizardAnnotations } from './pfdWizardTypes';
import { getBranchColor } from './pfdTypes';
import { PfdSymbol } from './PfdSymbols';
import { generateSmartPfd } from './pfdSmartGenerator';

interface WizardStepPreviewProps {
    amfeDoc: AmfeDocument;
    annotations: PfdWizardAnnotations;
    onUpdateAnnotations: (annotations: PfdWizardAnnotations) => void;
    warnings: string[];
}

const PfdWizardStepPreview: React.FC<WizardStepPreviewProps> = ({
    amfeDoc,
    annotations,
    warnings,
}) => {
    /** Generate preview PFD on-the-fly (memoized) */
    const preview = useMemo(
        () => generateSmartPfd(amfeDoc, '', annotations),
        [amfeDoc, annotations],
    );

    const steps = preview.document.steps;

    /** Compute summary stats */
    const stats = useMemo(() => {
        const opCount = steps.filter(
            (s) => s.stepType === 'operation' || s.stepType === 'combined',
        ).length;
        const transportCount = steps.filter((s) => s.stepType === 'transport').length;
        const inspectionCount = steps.filter((s) => s.stepType === 'inspection').length;
        const storageCount = steps.filter((s) => s.stepType === 'storage').length;
        const branchCount = new Set(
            steps.filter((s) => s.branchId).map((s) => s.branchId),
        ).size;

        return { opCount, transportCount, inspectionCount, storageCount, branchCount };
    }, [steps]);

    /** Merge wizard-level warnings with generator warnings */
    const allWarnings = useMemo(() => {
        const combined = [...warnings];
        // Add generator warnings that aren't the summary line
        for (const w of preview.warnings) {
            if (!w.startsWith('Flujograma generado:') && !combined.includes(w)) {
                combined.push(w);
            }
        }
        return combined;
    }, [warnings, preview.warnings]);

    return (
        <div className="space-y-4">
            {/* Summary stats box */}
            <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                    <BarChart3 size={16} className="text-cyan-600" />
                    <h4 className="text-sm font-semibold text-cyan-800">
                        Resumen del flujograma
                    </h4>
                </div>
                <p className="text-sm text-cyan-700">
                    Se generarán{' '}
                    <span className="font-bold">{steps.length} pasos</span>:
                    {' '}{stats.opCount} {stats.opCount !== 1 ? 'operaciones' : 'operación'}
                    {stats.transportCount > 0 && (
                        <>, {stats.transportCount} transporte{stats.transportCount !== 1 ? 's' : ''}</>
                    )}
                    {stats.inspectionCount > 0 && (
                        <>, {stats.inspectionCount} {stats.inspectionCount !== 1 ? 'inspecciones' : 'inspección'}</>
                    )}
                    {stats.storageCount > 0 && (
                        <>, {stats.storageCount} almacenamiento{stats.storageCount !== 1 ? 's' : ''}</>
                    )}
                    {stats.branchCount > 0 && (
                        <>, {stats.branchCount} {stats.branchCount !== 1 ? 'líneas paralelas' : 'línea paralela'}</>
                    )}
                    .
                </p>
            </div>

            {/* Warnings */}
            {allWarnings.length > 0 && (
                <div className="space-y-1">
                    {allWarnings.map((w, i) => (
                        <div
                            key={i}
                            className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg"
                        >
                            <AlertTriangle
                                size={14}
                                className="text-amber-500 mt-0.5 shrink-0"
                            />
                            <span className="text-xs text-amber-700">{w}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Mini flow preview */}
            {steps.length > 0 ? (
                <div className="border border-gray-200 rounded-lg p-4 bg-white max-h-[400px] overflow-y-auto">
                    <div className="flex flex-col items-center gap-0">
                        {steps.map((step, index) => {
                            const branchColor = step.branchId
                                ? getBranchColor(step.branchId)
                                : null;

                            return (
                                <React.Fragment key={step.id}>
                                    {/* Arrow between steps */}
                                    {index > 0 && (
                                        <div className="py-0.5">
                                            <ArrowDown
                                                size={12}
                                                className="text-cyan-400"
                                            />
                                        </div>
                                    )}

                                    {/* Step card */}
                                    <div
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all w-full max-w-md ${
                                            branchColor
                                                ? `${branchColor.bg} ${branchColor.border}`
                                                : 'border-gray-200 bg-white'
                                        }`}
                                    >
                                        <PfdSymbol type={step.stepType} size={16} />
                                        <span className="font-mono text-[10px] font-bold text-gray-500">
                                            {step.stepNumber}
                                        </span>
                                        <span className="text-xs text-gray-700 truncate flex-1">
                                            {step.description}
                                        </span>
                                        {step.branchId && (
                                            <span
                                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                                    branchColor?.badge || ''
                                                }`}
                                            >
                                                {step.branchLabel || `Linea ${step.branchId}`}
                                            </span>
                                        )}
                                        {step.isExternalProcess && (
                                            <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1 rounded">
                                                EXT
                                            </span>
                                        )}
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="text-center text-gray-400 py-8 text-sm border border-gray-200 rounded-lg">
                    No se generaron pasos. Verifica las operaciones incluidas.
                </div>
            )}
        </div>
    );
};

export default PfdWizardStepPreview;
