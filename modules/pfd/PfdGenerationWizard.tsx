/**
 * PFD Generation Wizard — 4-step modal for generating PFD from AMFE.
 *
 * Steps:
 *  1. Revisar Operaciones — adjust step types, toggle external, include/exclude
 *  2. Organizar Flujo — assign operations to parallel branches/lanes
 *  3. Inspecciones — insert inspection points between operations
 *  4. Vista Previa — preview generated flow + summary
 *
 * Cyan/teal theme consistent with the PFD module.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, ClipboardList, GitBranch, Search, Eye, Wand2 } from 'lucide-react';
import type { AmfeDocument } from '../amfe/amfeTypes';
import type { PfdDocument } from './pfdTypes';
import type { PfdWizardAnnotations } from './pfdWizardTypes';
import { createDefaultAnnotations } from './pfdWizardTypes';
import { buildOperationAnnotations, autoDetectInspections, generateSmartPfd } from './pfdSmartGenerator';
import PfdWizardStepOps from './PfdWizardStepOps';
import PfdWizardStepFlow from './PfdWizardStepFlow';
import PfdWizardStepInspections from './PfdWizardStepInspections';
import PfdWizardStepPreview from './PfdWizardStepPreview';

// ============================================================================
// TYPES
// ============================================================================

interface PfdGenerationWizardProps {
    amfeDoc: AmfeDocument;
    projectName: string;
    isOpen: boolean;
    onComplete: (pfdDoc: PfdDocument) => void;
    onCancel: () => void;
}

export interface WizardStepProps {
    amfeDoc: AmfeDocument;
    annotations: PfdWizardAnnotations;
    onUpdateAnnotations: (annotations: PfdWizardAnnotations) => void;
}

export interface WizardStepPreviewProps extends WizardStepProps {
    warnings: string[];
}

// ============================================================================
// STEP METADATA
// ============================================================================

const WIZARD_STEPS = [
    { title: 'Revisar Operaciones', description: 'Ajusta los tipos de paso y marca procesos externos', icon: ClipboardList },
    { title: 'Organizar Flujo', description: 'Asigna operaciones a lineas paralelas si las hay', icon: GitBranch },
    { title: 'Inspecciones', description: 'Inserta puntos de inspeccion y rutas de rechazo', icon: Search },
    { title: 'Vista Previa', description: 'Revisa el flujo generado antes de confirmar', icon: Eye },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const PfdGenerationWizard: React.FC<PfdGenerationWizardProps> = ({
    amfeDoc,
    projectName,
    isOpen,
    onComplete,
    onCancel,
}) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [annotations, setAnnotations] = useState<PfdWizardAnnotations>(() => {
        const ops = buildOperationAnnotations(amfeDoc);
        const autoInspections = autoDetectInspections(amfeDoc);
        return { ...createDefaultAnnotations(), operations: ops, inspections: autoInspections };
    });
    const [warnings, setWarnings] = useState<string[]>([]);
    const modalRef = useRef<HTMLDivElement>(null);

    // Reset state when wizard opens with a new AMFE doc
    useEffect(() => {
        if (isOpen) {
            const ops = buildOperationAnnotations(amfeDoc);
            const autoInspections = autoDetectInspections(amfeDoc);
            setAnnotations({ ...createDefaultAnnotations(), operations: ops, inspections: autoInspections });
            setCurrentStep(0);
            setWarnings([]);
        }
    }, [isOpen, amfeDoc]);

    // Keyboard: Escape closes wizard
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onCancel]);

    // Focus trap: focus modal on open
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => modalRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const handleUpdateAnnotations = useCallback((updated: PfdWizardAnnotations) => {
        setAnnotations(updated);
    }, []);

    const handleNext = useCallback(() => {
        if (currentStep < WIZARD_STEPS.length - 1) {
            setCurrentStep((s) => s + 1);
        }
    }, [currentStep]);

    const handleBack = useCallback(() => {
        if (currentStep > 0) {
            setCurrentStep((s) => s - 1);
        }
    }, [currentStep]);

    const handleGoToStep = useCallback((step: number) => {
        if (step >= 0 && step < WIZARD_STEPS.length) {
            setCurrentStep(step);
        }
    }, []);

    const handleGenerate = useCallback(() => {
        const result = generateSmartPfd(amfeDoc, projectName, annotations);
        setWarnings(result.warnings);
        onComplete(result.document);
    }, [amfeDoc, projectName, annotations, onComplete]);

    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onCancel();
        }
    }, [onCancel]);

    if (!isOpen) return null;

    const isLastStep = currentStep === WIZARD_STEPS.length - 1;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={handleBackdropClick}
        >
            <div
                ref={modalRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="pfd-wizard-title"
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col overflow-hidden outline-none max-h-[90vh] animate-in zoom-in-95 duration-200"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-cyan-600 to-teal-600 text-white">
                    <div>
                        <h2 id="pfd-wizard-title" className="text-lg font-bold flex items-center gap-2">
                            <Wand2 size={20} />
                            Generar Flujograma desde AMFE
                        </h2>
                        <p className="text-cyan-100 text-sm mt-0.5">
                            {amfeDoc.operations?.length || 0} operaciones disponibles
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        aria-label="Cerrar wizard"
                        className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X size={22} />
                    </button>
                </div>

                {/* Progress bar */}
                <div className="flex items-center justify-center gap-0 px-6 py-4 bg-gray-50 border-b border-gray-200">
                    {WIZARD_STEPS.map((step, idx) => {
                        const Icon = step.icon;
                        const isCompleted = idx < currentStep;
                        const isActive = idx === currentStep;
                        const isPending = idx > currentStep;

                        return (
                            <React.Fragment key={idx}>
                                {/* Step circle */}
                                <button
                                    onClick={() => handleGoToStep(idx)}
                                    className={`flex flex-col items-center gap-1.5 group transition-all ${
                                        isPending ? 'cursor-pointer' : 'cursor-pointer'
                                    }`}
                                    title={step.title}
                                >
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                            isActive
                                                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-200 ring-4 ring-cyan-100'
                                                : isCompleted
                                                    ? 'bg-cyan-600 text-white'
                                                    : 'bg-gray-200 text-gray-400 group-hover:bg-gray-300'
                                        }`}
                                    >
                                        <Icon size={18} />
                                    </div>
                                    <span
                                        className={`text-xs font-medium whitespace-nowrap transition-colors ${
                                            isActive
                                                ? 'text-cyan-700'
                                                : isCompleted
                                                    ? 'text-cyan-600'
                                                    : 'text-gray-400 group-hover:text-gray-500'
                                        }`}
                                    >
                                        {step.title}
                                    </span>
                                </button>

                                {/* Connector line */}
                                {idx < WIZARD_STEPS.length - 1 && (
                                    <div
                                        className={`flex-1 h-0.5 mx-2 mt-[-18px] transition-colors ${
                                            idx < currentStep ? 'bg-cyan-500' : 'bg-gray-200'
                                        }`}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Step title + description */}
                <div className="px-6 pt-4 pb-2">
                    <h3 className="text-base font-semibold text-gray-800">
                        Paso {currentStep + 1}: {WIZARD_STEPS[currentStep].title}
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {WIZARD_STEPS[currentStep].description}
                    </p>
                </div>

                {/* Step content */}
                <div className="flex-1 overflow-y-auto px-6 pb-4 min-h-[400px]">
                    {currentStep === 0 && (
                        <PfdWizardStepOps
                            amfeDoc={amfeDoc}
                            annotations={annotations}
                            onUpdateAnnotations={handleUpdateAnnotations}
                        />
                    )}
                    {currentStep === 1 && (
                        <PfdWizardStepFlow
                            amfeDoc={amfeDoc}
                            annotations={annotations}
                            onUpdateAnnotations={handleUpdateAnnotations}
                        />
                    )}
                    {currentStep === 2 && (
                        <PfdWizardStepInspections
                            amfeDoc={amfeDoc}
                            annotations={annotations}
                            onUpdateAnnotations={handleUpdateAnnotations}
                        />
                    )}
                    {currentStep === 3 && (
                        <PfdWizardStepPreview
                            amfeDoc={amfeDoc}
                            annotations={annotations}
                            onUpdateAnnotations={handleUpdateAnnotations}
                            warnings={warnings}
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
                    {/* Left: Cancel */}
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium transition-colors"
                    >
                        Cancelar
                    </button>

                    {/* Right: Back + Next/Generate */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleBack}
                            disabled={currentStep === 0}
                            className="flex items-center gap-1.5 px-4 py-2 text-gray-600 hover:text-gray-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={16} />
                            Anterior
                        </button>

                        {isLastStep ? (
                            <button
                                onClick={handleGenerate}
                                className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 text-white rounded-lg font-bold hover:bg-cyan-700 transition-colors shadow-sm shadow-cyan-200 active:scale-95"
                            >
                                <Wand2 size={16} />
                                Generar Flujograma
                            </button>
                        ) : (
                            <button
                                onClick={handleNext}
                                className="flex items-center gap-1.5 px-5 py-2.5 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 transition-colors shadow-sm active:scale-95"
                            >
                                Siguiente
                                <ChevronRight size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PfdGenerationWizard;
