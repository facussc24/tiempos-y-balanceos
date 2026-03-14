/**
 * PFD Wizard Step 1 — "Revisar Operaciones"
 *
 * Shows a card per AMFE operation with:
 * - Symbol picker for step type override
 * - Machine/device (read-only from work elements)
 * - Max severity badge
 * - External process checkbox
 * - Include/exclude toggle
 *
 * Global toggles: transport steps and bookend (receiving/shipping) steps.
 */

import React, { useCallback } from 'react';
import { Truck, Package, AlertTriangle } from 'lucide-react';
import type { AmfeDocument } from '../amfe/amfeTypes';
import type { PfdWizardAnnotations, PfdOperationAnnotation } from './pfdWizardTypes';
import type { PfdStepType, TransportMode } from './pfdTypes';
import { PfdSymbol } from './PfdSymbols';
import PfdSymbolPicker from './PfdSymbolPicker';
import { extractMachine, getMaxSeverity } from './pfdGenerator';

interface WizardStepProps {
    amfeDoc: AmfeDocument;
    annotations: PfdWizardAnnotations;
    onUpdateAnnotations: (annotations: PfdWizardAnnotations) => void;
}

/** Severity badge color by value */
function severityBadge(severity: number): { bg: string; text: string; border: string } {
    if (severity >= 9) return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' };
    if (severity >= 7) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' };
    return { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' };
}

const PfdWizardStepOps: React.FC<WizardStepProps> = ({ amfeDoc, annotations, onUpdateAnnotations }) => {
    const operations = amfeDoc.operations || [];

    /** Find annotation for a given operation ID */
    const getAnnotation = useCallback(
        (opId: string): PfdOperationAnnotation | undefined =>
            annotations.operations.find((a) => a.operationId === opId),
        [annotations.operations],
    );

    /** Update a single operation annotation field */
    const updateOpAnnotation = useCallback(
        (opId: string, patch: Partial<PfdOperationAnnotation>) => {
            const updated = annotations.operations.map((a) =>
                a.operationId === opId ? { ...a, ...patch } : a,
            );
            onUpdateAnnotations({ ...annotations, operations: updated });
        },
        [annotations, onUpdateAnnotations],
    );

    /** Change transport mode */
    const setTransportMode = useCallback((mode: TransportMode) => {
        onUpdateAnnotations({ ...annotations, transportMode: mode });
    }, [annotations, onUpdateAnnotations]);

    /** Toggle global bookend steps */
    const toggleBookend = useCallback(() => {
        onUpdateAnnotations({ ...annotations, addBookendSteps: !annotations.addBookendSteps });
    }, [annotations, onUpdateAnnotations]);

    return (
        <div className="space-y-4">
            {/* Global toggles */}
            <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg space-y-3">
                {/* Transport mode selector */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Truck size={16} className="text-cyan-600" />
                        <span className="text-sm font-medium text-cyan-800">Pasos de transporte</span>
                    </div>
                    <div className="flex flex-wrap gap-2 ml-6">
                        {([
                            { value: 'cross-sector' as TransportMode, label: 'Solo entre sectores', desc: 'Recomendado — AIAG / ASME' },
                            { value: 'all' as TransportMode, label: 'Todos los pasos', desc: 'Transporte antes de cada operación' },
                            { value: 'none' as TransportMode, label: 'Ninguno', desc: 'Sin pasos de transporte' },
                        ]).map(opt => (
                            <label
                                key={opt.value}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                                    annotations.transportMode === opt.value
                                        ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm'
                                        : 'bg-white text-cyan-800 border-cyan-200 hover:border-cyan-400'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="transportMode"
                                    value={opt.value}
                                    checked={annotations.transportMode === opt.value}
                                    onChange={() => setTransportMode(opt.value)}
                                    className="sr-only"
                                />
                                <span className="font-medium">{opt.label}</span>
                            </label>
                        ))}
                    </div>
                    {annotations.transportMode === 'cross-sector' && (
                        <p className="text-xs text-cyan-600 ml-6 mt-1">
                            Per ASME Y15.3: transporte solo entre áreas de trabajo separadas.
                        </p>
                    )}
                </div>
                {/* Bookend toggle */}
                <label className="flex items-center gap-2 text-sm text-cyan-800 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={annotations.addBookendSteps}
                        onChange={toggleBookend}
                        className="rounded border-cyan-400 text-cyan-600 focus:ring-cyan-500"
                    />
                    <Package size={16} className="text-cyan-600" />
                    Agregar recepcion y envio
                </label>
            </div>

            {/* Operation cards */}
            {operations.length === 0 && (
                <div className="text-center text-gray-400 py-8 text-sm">
                    El AMFE no tiene operaciones definidas.
                </div>
            )}

            <div className="space-y-2">
                {operations.map((op) => {
                    const ann = getAnnotation(op.id);
                    if (!ann) return null;

                    const machine = extractMachine(op.workElements);
                    const maxSev = getMaxSeverity(op.workElements);
                    const sevStyle = severityBadge(maxSev);
                    const included = ann.included;

                    return (
                        <div
                            key={op.id}
                            className={`border rounded-lg p-3 transition-all ${
                                included
                                    ? 'border-gray-200 bg-white'
                                    : 'border-gray-100 bg-gray-50 opacity-60'
                            }`}
                        >
                            {/* Top row: symbol picker, name, include toggle */}
                            <div className="flex items-center gap-3">
                                <PfdSymbolPicker
                                    value={ann.stepType}
                                    onChange={(value: PfdStepType) =>
                                        updateOpAnnotation(op.id, { stepType: value })
                                    }
                                    disabled={!included}
                                />

                                <div className="flex-1 min-w-0">
                                    <span className="font-mono text-xs font-bold text-gray-500 mr-2">
                                        OP {op.opNumber}
                                    </span>
                                    <span className="text-sm font-medium text-gray-800 truncate">
                                        {op.name || '(Sin nombre)'}
                                    </span>
                                </div>

                                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={included}
                                        onChange={() =>
                                            updateOpAnnotation(op.id, { included: !included })
                                        }
                                        className="rounded border-cyan-400 text-cyan-600 focus:ring-cyan-500"
                                    />
                                    <span className={included ? 'text-cyan-700' : 'text-gray-400'}>
                                        Incluir
                                    </span>
                                </label>
                            </div>

                            {/* Bottom row: machine, severity, external */}
                            <div className="flex items-center gap-4 mt-2 ml-12">
                                {machine && (
                                    <span className="text-xs text-gray-500">
                                        <span className="font-medium text-gray-600">Maquina:</span>{' '}
                                        {machine}
                                    </span>
                                )}

                                {maxSev > 0 && (
                                    <span
                                        className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded border ${sevStyle.bg} ${sevStyle.text} ${sevStyle.border}`}
                                    >
                                        Severidad: {maxSev}
                                        {maxSev >= 7 && (
                                            <AlertTriangle
                                                size={12}
                                                className={maxSev >= 9 ? 'text-red-500' : 'text-amber-500'}
                                            />
                                        )}
                                    </span>
                                )}

                                <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none ml-auto">
                                    <input
                                        type="checkbox"
                                        checked={ann.isExternal}
                                        onChange={() =>
                                            updateOpAnnotation(op.id, { isExternal: !ann.isExternal })
                                        }
                                        disabled={!included}
                                        className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                                    />
                                    <span className="text-gray-500">Proceso externo</span>
                                </label>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PfdWizardStepOps;
