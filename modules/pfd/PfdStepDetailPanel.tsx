/**
 * PFD Step Detail Panel — Side panel showing all editable fields of a PfdStep.
 *
 * Displays when a step is selected in the flow editor. Vertical form layout
 * with sections grouped by field category. ~320px wide, fixed right side.
 */

import React, { useCallback, useEffect } from 'react';
import type { PfdStep, PfdStepType, SpecialCharClass, RejectDisposition } from './pfdTypes';
import { getBranchColor, PFD_STEP_TYPES } from './pfdTypes';
import PfdSymbolPicker from './PfdSymbolPicker';
import { PfdSymbol } from './PfdSymbols';
import { X } from 'lucide-react';

export interface PfdStepDetailPanelProps {
    step: PfdStep | null;
    onUpdateStep: (stepId: string, field: keyof PfdStep, value: string | boolean) => void;
    onBatchUpdateStep?: (stepId: string, updates: Partial<PfdStep>) => void;
    onClose: () => void;
    readOnly?: boolean;
}

const labelClass = 'block text-xs font-medium text-gray-500 mb-1';
const inputClass =
    'w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-white outline-none ' +
    'focus:ring-1 focus:ring-cyan-300 focus:border-cyan-400 transition ' +
    'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed';
const selectClass =
    'w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-white outline-none ' +
    'focus:ring-1 focus:ring-cyan-300 focus:border-cyan-400 transition ' +
    'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed';
const sectionClass = 'flex items-center gap-2 pt-4 pb-1';
const sectionLineClass = 'flex-1 border-t border-gray-200';
const sectionLabelClass = 'text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap';

/** Section divider with centered label */
function SectionDivider({ label }: { label: string }) {
    return (
        <div className={sectionClass}>
            <div className={sectionLineClass} />
            <span className={sectionLabelClass}>{label}</span>
            <div className={sectionLineClass} />
        </div>
    );
}

const PfdStepDetailPanel: React.FC<PfdStepDetailPanelProps> = ({
    step,
    onUpdateStep,
    onBatchUpdateStep,
    onClose,
    readOnly = false,
}) => {
    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const handleFieldChange = useCallback(
        (field: keyof PfdStep) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            if (step) onUpdateStep(step.id, field, e.target.value);
        },
        [step, onUpdateStep],
    );

    const handleSelectChange = useCallback(
        (field: keyof PfdStep) => (e: React.ChangeEvent<HTMLSelectElement>) => {
            if (step) onUpdateStep(step.id, field, e.target.value);
        },
        [step, onUpdateStep],
    );

    const handleCheckboxChange = useCallback(
        (field: keyof PfdStep) => (e: React.ChangeEvent<HTMLInputElement>) => {
            if (step) onUpdateStep(step.id, field, e.target.checked);
        },
        [step, onUpdateStep],
    );

    /** Atomic disposition change: single undo entry for all field updates */
    const handleDispositionChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            if (!step) return;
            const val = e.target.value as RejectDisposition;
            const updates: Partial<PfdStep> = {
                rejectDisposition: val,
                isRework: val === 'rework',
            };
            if (val !== 'rework') updates.reworkReturnStep = '';
            if (val === 'none') updates.scrapDescription = '';

            if (onBatchUpdateStep) {
                onBatchUpdateStep(step.id, updates);
            } else {
                onUpdateStep(step.id, 'rejectDisposition', val);
                onUpdateStep(step.id, 'isRework', val === 'rework');
                if (val !== 'rework') onUpdateStep(step.id, 'reworkReturnStep', '');
                if (val === 'none') onUpdateStep(step.id, 'scrapDescription', '');
            }
        },
        [step, onUpdateStep, onBatchUpdateStep],
    );

    const handleBranchChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            if (!step) return;
            const val = e.target.value;
            if (onBatchUpdateStep) {
                onBatchUpdateStep(step.id, { branchId: val, branchLabel: '' });
            } else {
                onUpdateStep(step.id, 'branchId', val);
                onUpdateStep(step.id, 'branchLabel', '');
            }
        },
        [step, onUpdateStep, onBatchUpdateStep],
    );

    // -- Empty state --
    if (!step) {
        return (
            <div
                className="w-80 h-full bg-white border-l border-gray-200 flex flex-col items-center justify-center px-6 text-center"
                data-testid="detail-panel-empty"
            >
                <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    className="text-gray-300 mb-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M9 9h6M9 13h4" strokeLinecap="round" />
                </svg>
                <p className="text-sm text-gray-400 leading-relaxed">
                    Seleccion&aacute; un paso en el mapa de flujo para ver sus detalles
                </p>
            </div>
        );
    }

    // -- Populated state --
    const stepTypeInfo = PFD_STEP_TYPES.find(t => t.value === step.stepType);
    const branchColor = step.branchId ? getBranchColor(step.branchId) : null;

    return (
        <div
            className="w-80 h-full bg-white border-l border-gray-200 flex flex-col"
            data-testid="detail-panel"
        >
            {/* Header */}
            <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <PfdSymbol type={step.stepType} size={24} />
                    <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-gray-800 truncate" data-testid="detail-panel-title" title={`Paso ${step.stepNumber}`}>
                            Paso {step.stepNumber}
                        </h3>
                        <p className="text-[11px] text-gray-500 truncate" title={stepTypeInfo?.label || step.stepType}>
                            {stepTypeInfo?.label || step.stepType}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition flex-shrink-0"
                    aria-label="Cerrar panel"
                    title="Cerrar"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {/* Step type */}
                <div>
                    <label className={labelClass}>Tipo de Paso</label>
                    <PfdSymbolPicker
                        value={step.stepType}
                        onChange={(v: PfdStepType) => onUpdateStep(step.id, 'stepType', v)}
                        disabled={readOnly}
                    />
                </div>

                {/* Step number */}
                <div>
                    <label className={labelClass}>N.&ordm; de Operaci&oacute;n</label>
                    <input
                        value={step.stepNumber}
                        onChange={handleFieldChange('stepNumber')}
                        className={inputClass}
                        placeholder="OP 10"
                        disabled={readOnly}
                        data-testid="detail-stepNumber"
                    />
                </div>

                {/* Description */}
                <div>
                    <label className={labelClass}>Descripci&oacute;n</label>
                    <textarea
                        value={step.description}
                        onChange={handleFieldChange('description')}
                        className={`${inputClass} resize-none`}
                        rows={3}
                        placeholder="Descripci&oacute;n de la operaci&oacute;n"
                        disabled={readOnly}
                        data-testid="detail-description"
                    />
                </div>

                {/* ─── Equipo ──── */}
                <SectionDivider label="Equipo" />

                <div>
                    <label className={labelClass}>M&aacute;quina / Dispositivo</label>
                    <input
                        value={step.machineDeviceTool}
                        onChange={handleFieldChange('machineDeviceTool')}
                        className={inputClass}
                        placeholder="M&aacute;quina o herramienta"
                        disabled={readOnly}
                        data-testid="detail-machineDeviceTool"
                    />
                </div>

                {/* ─── Caracteristicas ──── */}
                <SectionDivider label="Caracter&iacute;sticas" />

                <div>
                    <label className={labelClass}>Caract. Producto</label>
                    <input
                        value={step.productCharacteristic}
                        onChange={handleFieldChange('productCharacteristic')}
                        className={inputClass}
                        placeholder="Caracter&iacute;stica de producto"
                        disabled={readOnly}
                        data-testid="detail-productCharacteristic"
                    />
                </div>

                <div>
                    <label className={labelClass}>CC/SC Producto</label>
                    <select
                        value={step.productSpecialChar}
                        onChange={handleSelectChange('productSpecialChar')}
                        className={selectClass}
                        disabled={readOnly}
                        aria-label="CC/SC Producto"
                        data-testid="detail-productSpecialChar"
                    >
                        <option value="none">&mdash;</option>
                        <option value="CC">CC</option>
                        <option value="SC">SC</option>
                    </select>
                </div>

                <div>
                    <label className={labelClass}>Caract. Proceso</label>
                    <input
                        value={step.processCharacteristic}
                        onChange={handleFieldChange('processCharacteristic')}
                        className={inputClass}
                        placeholder="Variable de proceso"
                        disabled={readOnly}
                        data-testid="detail-processCharacteristic"
                    />
                </div>

                <div>
                    <label className={labelClass}>CC/SC Proceso</label>
                    <select
                        value={step.processSpecialChar}
                        onChange={handleSelectChange('processSpecialChar')}
                        className={selectClass}
                        disabled={readOnly}
                        aria-label="CC/SC Proceso"
                        data-testid="detail-processSpecialChar"
                    >
                        <option value="none">&mdash;</option>
                        <option value="CC">CC</option>
                        <option value="SC">SC</option>
                    </select>
                </div>

                {/* ─── Flujo Paralelo ──── */}
                <SectionDivider label="Flujo Paralelo" />

                <div>
                    <label className={labelClass}>L&iacute;nea</label>
                    <select
                        value={step.branchId || ''}
                        onChange={handleBranchChange}
                        className={`${selectClass} ${
                            step.branchId && branchColor ? branchColor.border : ''
                        }`}
                        disabled={readOnly}
                        aria-label="L&iacute;nea paralela"
                        data-testid="detail-branchId"
                    >
                        <option value="">&mdash;</option>
                        <option value="A">L&iacute;nea A</option>
                        <option value="B">L&iacute;nea B</option>
                        <option value="C">L&iacute;nea C</option>
                        <option value="D">L&iacute;nea D</option>
                    </select>
                </div>

                {step.branchId && (
                    <div>
                        <label className={labelClass}>Nombre de l&iacute;nea</label>
                        <input
                            value={step.branchLabel || ''}
                            onChange={handleFieldChange('branchLabel')}
                            className={inputClass}
                            placeholder="ej: Soldadura, Mecanizado"
                            disabled={readOnly}
                            data-testid="detail-branchLabel"
                        />
                    </div>
                )}

                {/* ─── Referencia ──── */}
                <SectionDivider label="Referencia" />

                <div>
                    <label className={labelClass}>Referencia</label>
                    <input
                        value={step.reference}
                        onChange={handleFieldChange('reference')}
                        className={inputClass}
                        placeholder="Plano / Especificaci&oacute;n"
                        disabled={readOnly}
                        data-testid="detail-reference"
                    />
                </div>

                <div>
                    <label className={labelClass}>&Aacute;rea</label>
                    <input
                        value={step.department}
                        onChange={handleFieldChange('department')}
                        className={inputClass}
                        placeholder="Departamento / &Aacute;rea"
                        disabled={readOnly}
                        data-testid="detail-department"
                    />
                </div>

                <div>
                    <label className={labelClass}>Tiempo de Ciclo (min)</label>
                    <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={step.cycleTimeMinutes ?? ''}
                        onChange={e => {
                            if (!step || !onBatchUpdateStep) return;
                            const val = e.target.value;
                            onBatchUpdateStep(step.id, { cycleTimeMinutes: val === '' ? undefined : parseFloat(val) });
                        }}
                        className={inputClass}
                        placeholder="Ej: 3.5"
                        disabled={readOnly}
                        data-testid="detail-cycleTime"
                    />
                </div>

                <div>
                    <label className={labelClass}>Notas</label>
                    <input
                        value={step.notes}
                        onChange={handleFieldChange('notes')}
                        className={inputClass}
                        placeholder="Notas adicionales"
                        disabled={readOnly}
                        data-testid="detail-notes"
                    />
                </div>

                {/* ─── Disposicion ──── */}
                <SectionDivider label="Disposici&oacute;n" />

                <div>
                    <label className={labelClass}>Disposici&oacute;n</label>
                    <select
                        value={step.rejectDisposition}
                        onChange={handleDispositionChange}
                        className={selectClass}
                        disabled={readOnly}
                        aria-label="Disposici&oacute;n de rechazo"
                        data-testid="detail-rejectDisposition"
                    >
                        <option value="none">&mdash;</option>
                        <option value="rework">Retrabajo</option>
                        <option value="scrap">Descarte</option>
                        <option value="sort">Selecci&oacute;n</option>
                    </select>
                </div>

                {/* Conditional rework field */}
                {step.rejectDisposition === 'rework' && (
                    <div>
                        <label className={`${labelClass} text-red-500`}>Retorno a</label>
                        <input
                            value={step.reworkReturnStep || ''}
                            onChange={handleFieldChange('reworkReturnStep')}
                            className={`${inputClass} border-red-200 focus:ring-red-300 focus:border-red-400`}
                            placeholder="ej: OP 20"
                            disabled={readOnly}
                            data-testid="detail-reworkReturnStep"
                        />
                    </div>
                )}

                {/* Conditional scrap/sort field */}
                {(step.rejectDisposition === 'scrap' || step.rejectDisposition === 'sort') && (
                    <div>
                        <label className={`${labelClass} ${
                            step.rejectDisposition === 'scrap' ? 'text-orange-600' : 'text-yellow-600'
                        }`}>
                            {step.rejectDisposition === 'scrap' ? 'Motivo del descarte' : 'Criterio de selecci\u00f3n'}
                        </label>
                        <input
                            value={step.scrapDescription || ''}
                            onChange={handleFieldChange('scrapDescription')}
                            className={`${inputClass} ${
                                step.rejectDisposition === 'scrap'
                                    ? 'border-orange-200 focus:ring-orange-300 focus:border-orange-400'
                                    : 'border-yellow-200 focus:ring-yellow-300 focus:border-yellow-400'
                            }`}
                            placeholder={step.rejectDisposition === 'scrap' ? 'Motivo del descarte' : 'Criterio de selecci\u00f3n'}
                            disabled={readOnly}
                            data-testid="detail-scrapDescription"
                        />
                    </div>
                )}

                {/* ─── External process checkbox ──── */}
                <div className="flex items-center gap-2 pt-3 pb-2">
                    <input
                        type="checkbox"
                        checked={step.isExternalProcess}
                        onChange={handleCheckboxChange('isExternalProcess')}
                        disabled={readOnly}
                        className="w-4 h-4 accent-cyan-500 disabled:opacity-50"
                        id="detail-isExternalProcess"
                        data-testid="detail-isExternalProcess"
                    />
                    <label htmlFor="detail-isExternalProcess" className="text-sm text-gray-700">
                        Proceso externo
                    </label>
                </div>
            </div>
        </div>
    );
};

export default PfdStepDetailPanel;
