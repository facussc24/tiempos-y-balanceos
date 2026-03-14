/**
 * PFD Validation
 *
 * 21 validation rules (V1-V21) for Process Flow Diagram documents.
 * Pure functions, no side effects.
 */

import type { PfdDocument, PfdStep } from './pfdTypes';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
    rule: string;
    severity: ValidationSeverity;
    message: string;
    stepId?: string;
}

const MAX_FIELD_LENGTH = 10_000;
const MAX_STEPS_SOFT = 50;

/** Text fields to check for length */
const TEXT_FIELDS: (keyof PfdStep)[] = [
    'stepNumber', 'description', 'machineDeviceTool',
    'productCharacteristic', 'processCharacteristic',
    'reference', 'department', 'notes',
];

/**
 * Validate a PFD document and return issues found.
 */
export function validatePfdDocument(doc: PfdDocument): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // V1: Duplicate step numbers (error)
    const stepNumbers = new Map<string, string>();
    for (const step of doc.steps) {
        const num = step.stepNumber.trim();
        if (num === '') continue;
        if (stepNumbers.has(num)) {
            issues.push({
                rule: 'V1',
                severity: 'error',
                message: `Nº de operación duplicado: "${num}"`,
                stepId: step.id,
            });
        } else {
            stepNumbers.set(num, step.id);
        }
    }

    // V2: Missing description (error)
    for (const step of doc.steps) {
        if (step.description.trim() === '') {
            issues.push({
                rule: 'V2',
                severity: 'error',
                message: `Paso ${step.stepNumber || '(sin nº)'} sin descripción`,
                stepId: step.id,
            });
        }
    }

    // V3: CC/SC without characteristic specified (warning)
    // C16-UX: Clearer messages — spell out CC=Crítica, SC=Significativa
    for (const step of doc.steps) {
        if (step.productSpecialChar !== 'none' && step.productCharacteristic.trim() === '') {
            const charLabel = step.productSpecialChar === 'CC' ? 'Característica Crítica (CC)' : 'Característica Significativa (SC)';
            issues.push({
                rule: 'V3',
                severity: 'warning',
                message: `Paso ${step.stepNumber || '(sin nº)'}: ${charLabel} de producto marcada, pero sin descripción de la característica`,
                stepId: step.id,
            });
        }
        if (step.processSpecialChar !== 'none' && step.processCharacteristic.trim() === '') {
            const charLabel = step.processSpecialChar === 'CC' ? 'Característica Crítica (CC)' : 'Característica Significativa (SC)';
            issues.push({
                rule: 'V3',
                severity: 'warning',
                message: `Paso ${step.stepNumber || '(sin nº)'}: ${charLabel} de proceso marcada, pero sin descripción de la característica`,
                stepId: step.id,
            });
        }
    }

    // V4: Incomplete header (warning)
    const h = doc.header;
    if (!h.partNumber.trim() || !h.partName.trim()) {
        issues.push({
            rule: 'V4',
            severity: 'warning',
            message: 'Encabezado incompleto: falta número o nombre de pieza',
        });
    }
    if (!h.customerName.trim()) {
        issues.push({
            rule: 'V4',
            severity: 'warning',
            message: 'Encabezado incompleto: falta nombre del cliente',
        });
    }
    // V4 extended: AIAG exige nivel de cambio, código proveedor, aprobaciones
    if (!h.engineeringChangeLevel.trim()) {
        issues.push({
            rule: 'V4',
            severity: 'warning',
            message: 'Encabezado: falta nivel de cambio de ingeniería',
        });
    }
    if (!h.supplierCode.trim()) {
        issues.push({
            rule: 'V4',
            severity: 'warning',
            message: 'Encabezado: falta código de proveedor',
        });
    }
    if (!h.preparedBy.trim()) {
        issues.push({
            rule: 'V4',
            severity: 'warning',
            message: 'Encabezado: falta responsable de elaboración (Elaboró)',
        });
    }
    if (!h.approvedBy.trim()) {
        issues.push({
            rule: 'V4',
            severity: 'warning',
            message: 'Encabezado: falta aprobación (Aprobó)',
        });
    }

    // V5: Decision step without notes (info)
    for (const step of doc.steps) {
        if (step.stepType === 'decision' && step.notes.trim() === '') {
            issues.push({
                rule: 'V5',
                severity: 'info',
                message: `Paso ${step.stepNumber || '(sin nº)'}: decisión sin nota explicativa`,
                stepId: step.id,
            });
        }
    }

    // V6: Too many steps (warning)
    if (doc.steps.length > MAX_STEPS_SOFT) {
        issues.push({
            rule: 'V6',
            severity: 'warning',
            message: `El documento tiene ${doc.steps.length} pasos (límite recomendado: ${MAX_STEPS_SOFT})`,
        });
    }

    // V7: Field exceeds max length (error)
    for (const step of doc.steps) {
        for (const field of TEXT_FIELDS) {
            const value = step[field];
            if (typeof value === 'string' && value.length > MAX_FIELD_LENGTH) {
                issues.push({
                    rule: 'V7',
                    severity: 'error',
                    message: `Paso ${step.stepNumber || '(sin nº)'}: campo "${field}" excede ${MAX_FIELD_LENGTH} caracteres`,
                    stepId: step.id,
                });
            }
        }
    }

    // V8: Inspection step without any characteristic (warning)
    for (const step of doc.steps) {
        if (step.stepType === 'inspection' || step.stepType === 'combined') {
            if (step.productCharacteristic.trim() === '' && step.processCharacteristic.trim() === '') {
                issues.push({
                    rule: 'V8',
                    severity: 'warning',
                    message: `Paso ${step.stepNumber || '(sin nº)'}: inspección sin característica de producto ni de proceso definida`,
                    stepId: step.id,
                });
            }
        }
    }

    // V9: First step should be storage/receiving (info — AIAG recommendation)
    if (doc.steps.length > 0 && doc.steps[0].stepType !== 'storage') {
        issues.push({
            rule: 'V9',
            severity: 'info',
            message: 'AIAG recomienda que el flujo inicie con recepción de materia prima (tipo Almacenamiento)',
            stepId: doc.steps[0].id,
        });
    }

    // V10: Last step should be storage/shipping (AIAG recommendation)
    if (doc.steps.length > 1) {
        const lastStep = doc.steps[doc.steps.length - 1];
        if (lastStep.stepType !== 'storage') {
            issues.push({
                rule: 'V10',
                severity: 'info',
                message: 'AIAG recomienda que el flujo termine con almacenamiento final o envío al cliente',
                stepId: lastStep.id,
            });
        }
    }

    // V11: Rework step without return destination
    // C4-B2: check rejectDisposition (canonical post-C3) OR isRework (backward compat)
    for (const step of doc.steps) {
        if ((step.rejectDisposition === 'rework' || step.isRework) && (!step.reworkReturnStep || step.reworkReturnStep.trim() === '')) {
            issues.push({
                rule: 'V11',
                severity: 'warning',
                message: `Paso ${step.stepNumber || '(sin nº)'}: retrabajo sin destino de retorno especificado`,
                stepId: step.id,
            });
        }
    }

    // V12: Scrap/sort without description (C3-N1)
    for (const step of doc.steps) {
        if ((step.rejectDisposition === 'scrap' || step.rejectDisposition === 'sort') &&
            (!step.scrapDescription || step.scrapDescription.trim() === '')) {
            const label = step.rejectDisposition === 'scrap' ? 'descarte' : 'selección';
            issues.push({
                rule: 'V12',
                severity: 'warning',
                message: `Paso ${step.stepNumber || '(sin nº)'}: ${label} sin descripción / criterio`,
                stepId: step.id,
            });
        }
    }

    // V13: Step without operation number (C4-N1 — AIAG APQP requires numbered steps)
    // Transport steps are exempt: they are connectors, not numbered operations
    for (const step of doc.steps) {
        if (step.stepType === 'transport') continue;
        if (step.stepNumber.trim() === '') {
            issues.push({
                rule: 'V13',
                severity: 'warning',
                message: `Paso sin número de operación (descripción: "${step.description.slice(0, 40) || '(vacía)'}")`,
                stepId: step.id,
            });
        }
    }

    // V14: Operation step without machine/device/tool (C4-N2 — AIAG APQP requires equipment ID)
    for (const step of doc.steps) {
        if ((step.stepType === 'operation' || step.stepType === 'combined') && step.machineDeviceTool.trim() === '') {
            issues.push({
                rule: 'V14',
                severity: 'warning',
                message: `Paso ${step.stepNumber || '(sin nº)'}: operación sin máquina/equipo especificado`,
                stepId: step.id,
            });
        }
    }

    // V15: PFD should have at least one inspection/verification point (AIAG APQP §3.1)
    if (doc.steps.length > 2) {
        const hasInspection = doc.steps.some(s =>
            s.stepType === 'inspection' || s.stepType === 'combined'
        );
        if (!hasInspection) {
            issues.push({
                rule: 'V15',
                severity: 'warning',
                message: 'AIAG recomienda al menos un punto de inspección o verificación en el flujo de proceso',
            });
        }
    }

    // V16: Rework return step references an existing step number (IATF 16949 cl 8.5.6)
    for (const step of doc.steps) {
        if (step.rejectDisposition === 'rework' && step.reworkReturnStep && step.reworkReturnStep.trim()) {
            const target = step.reworkReturnStep.trim();
            const exists = doc.steps.some(s => s.stepNumber.trim() === target);
            if (!exists) {
                issues.push({
                    rule: 'V16',
                    severity: 'warning',
                    message: `Paso ${step.stepNumber || '(sin nº)'}: retorno a "${target}" pero ese paso no existe en el flujo`,
                    stepId: step.id,
                });
            }
        }
    }

    // V17: Inspection step without reference or notes (C6-N1 — AIAG APQP §3.1 verification purpose)
    for (const step of doc.steps) {
        if ((step.stepType === 'inspection' || step.stepType === 'combined') &&
            step.reference.trim() === '' && step.notes.trim() === '') {
            issues.push({
                rule: 'V17',
                severity: 'info',
                message: `Paso ${step.stepNumber || '(sin nº)'}: inspección sin referencia ni nota que indique método/criterio`,
                stepId: step.id,
            });
        }
    }

    // V18: Transport step without department/area (C7-N2 — AIAG APQP §3.3 material flow tracking)
    for (const step of doc.steps) {
        if (step.stepType === 'transport' && step.department.trim() === '') {
            issues.push({
                rule: 'V18',
                severity: 'info',
                message: `Paso ${step.stepNumber || '(sin nº)'}: transporte sin área/departamento destino`,
                stepId: step.id,
            });
        }
    }

    // V19: Parallel branch without convergence (C9-N1 — orphaned branches)
    const branchIds = new Set(doc.steps.filter(s => s.branchId).map(s => s.branchId));
    if (branchIds.size > 0) {
        const lastBranchIndex = doc.steps.reduce((max, s, i) => s.branchId ? Math.max(max, i) : max, -1);
        const hasConvergence = lastBranchIndex < doc.steps.length - 1;
        if (!hasConvergence) {
            issues.push({
                rule: 'V19',
                severity: 'warning',
                message: 'Flujo paralelo sin convergencia: no hay pasos en flujo principal después de las líneas paralelas',
            });
        }
    }

    // V20: Branch without label (C9-N1 — helps readability)
    // Fire once per unique branchId, not per step
    const checkedBranches = new Set<string>();
    for (const step of doc.steps) {
        if (step.branchId && !checkedBranches.has(step.branchId)) {
            checkedBranches.add(step.branchId);
            // Check if ANY step on this branch has a label
            const hasLabel = doc.steps.some(
                s => s.branchId === step.branchId && s.branchLabel && s.branchLabel.trim() !== ''
            );
            if (!hasLabel) {
                issues.push({
                    rule: 'V20',
                    severity: 'info',
                    message: `Línea paralela "${step.branchId}" sin nombre descriptivo`,
                    stepId: step.id,
                });
            }
        }
    }

    // V21: Inspection without disposition (C9-N2 — AIAG recommends explicit NG path)
    // C16-UX: Elevated to 'warning' — every inspection must define what happens with rejects (IATF 16949)
    for (const step of doc.steps) {
        if ((step.stepType === 'inspection' || step.stepType === 'combined') && step.rejectDisposition === 'none') {
            issues.push({
                rule: 'V21',
                severity: 'warning',
                message: `Paso ${step.stepNumber || '(sin nº)'}: inspección sin disposición de no conformes — defina retrabajo, descarte o selección`,
                stepId: step.id,
            });
        }
    }

    return issues;
}
