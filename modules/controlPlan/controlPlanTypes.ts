/**
 * Control Plan Type Definitions
 *
 * AIAG format Control Plan with 15 standard columns.
 * Linked to AMFE via characteristicNumber and process step.
 *
 * Phases: Pre-Launch | Production
 */

import { v4 as uuidv4 } from 'uuid';

/** Control Plan phases per AIAG standard. */
export type ControlPlanPhase = 'preLaunch' | 'production';

export const CONTROL_PLAN_PHASES: { value: ControlPlanPhase; label: string }[] = [
    { value: 'preLaunch', label: 'Pre-Lanzamiento' },
    { value: 'production', label: 'Producción' },
];

/** Header metadata for a Control Plan document. */
export interface ControlPlanHeader {
    controlPlanNumber: string;
    phase: ControlPlanPhase;
    partNumber: string;
    latestChangeLevel: string;
    partName: string;
    /** Applicable part numbers (one per line) for product family documents. */
    applicableParts: string;
    organization: string;
    supplier: string;
    supplierCode: string;
    keyContactPhone: string;
    date: string;
    revision: string;
    responsible: string;
    /** Engineering approval (e.g. Carlos Baptista). NOT plant approval — see plantApproval. */
    approvedBy: string;
    /** Plant/supplier approval (e.g. Gonzalo Cal). Separate from engineering approvedBy. */
    plantApproval: string;
    client: string;
    coreTeam: string;
    customerApproval: string;
    otherApproval: string;
    linkedAmfeProject: string;
}

/** A single row/item in the Control Plan table (AIAG standard columns). */
export interface ControlPlanItem {
    id: string;
    processStepNumber: string;
    processDescription: string;
    machineDeviceTool: string;
    /** Component or material being controlled (e.g. "Espuma PUR", "Tela/Vinilo"). Mainly for Recepcion MP. */
    componentMaterial: string;
    characteristicNumber: string;
    productCharacteristic: string;
    processCharacteristic: string;
    specialCharClass: string;
    specification: string;
    evaluationTechnique: string;
    sampleSize: string;
    sampleFrequency: string;
    controlMethod: string;
    reactionPlan: string;
    /** Reaction Plan Owner — required field per CP 1st Ed 2024. Must be a specific person/role on the floor. */
    reactionPlanOwner: string;
    /** Reference to applicable procedure/work instruction (e.g. "P-REC-001", "IT-TAP-002"). */
    controlProcedure: string;
    /** Tracks which fields were auto-filled by the generator so the UI can mark them as suggestions. */
    autoFilledFields?: string[];
    /** AMFE AP level at time of generation (for AI suggestion context) */
    amfeAp?: 'H' | 'M' | 'L' | '';
    /** AMFE Severity at time of generation (for AI suggestion context) */
    amfeSeverity?: number;
    /** Process operation category inferred from processDescription */
    operationCategory?: string;
    /** AMFE cause IDs that contributed to this CP row (for traceability back to source) */
    amfeCauseIds?: string[];
    /** AMFE failure ID that contributed to this CP row (for product rows) */
    amfeFailureId?: string;
    /** AMFE failure IDs when multiple failures are grouped into one CP row */
    amfeFailureIds?: string[];
}

/** Top-level Control Plan document. */
export interface ControlPlanDocument {
    header: ControlPlanHeader;
    items: ControlPlanItem[];
}

/** Default empty header. */
export const EMPTY_CP_HEADER: ControlPlanHeader = {
    controlPlanNumber: '',
    phase: 'preLaunch',
    partNumber: '',
    latestChangeLevel: '',
    partName: '',
    applicableParts: '',
    organization: '',
    supplier: '',
    supplierCode: '',
    keyContactPhone: '',
    date: '',
    revision: '',
    responsible: '',
    approvedBy: '',
    plantApproval: '',
    client: '',
    coreTeam: '',
    customerApproval: '',
    otherApproval: '',
    linkedAmfeProject: '',
};

/** Default empty document. */
export const EMPTY_CP_DOCUMENT: ControlPlanDocument = {
    header: { ...EMPTY_CP_HEADER },
    items: [],
};

/** Column definition with optional required flag for visual indicators. */
export interface CPColumnDef {
    key: keyof ControlPlanItem;
    label: string;
    width: string;
    required?: boolean;
}

/**
 * Column definitions for the Control Plan table (14 AIAG standard + 1 extra).
 * Columna adicional "Componente/Material" (AIAG CP 2024 Cap 1.1 permite columnas extra).
 * Se usa para identificar a qué material aplica cada control, especialmente en Recepción MP.
 */
export const CP_COLUMNS: CPColumnDef[] = [
    // Proceso (4)
    { key: 'processStepNumber',     label: 'Nro. Parte/Proceso',                 width: '80px', required: true },
    { key: 'componentMaterial',     label: 'Comp./Material',                     width: '100px' },
    { key: 'processDescription',    label: 'Descripción Proceso/Operación',      width: '170px', required: true },
    { key: 'machineDeviceTool',     label: 'Máquina/Dispositivo/Herram.',        width: '140px' },
    // Características (4)
    { key: 'characteristicNumber',  label: 'Nro.',                               width: '60px' },
    { key: 'productCharacteristic', label: 'Producto',                           width: '150px', required: true },
    { key: 'processCharacteristic', label: 'Proceso',                            width: '150px' },
    { key: 'specialCharClass',      label: 'Clasif. Caract. Esp.',              width: '80px' },
    // Métodos (7)
    { key: 'specification',         label: 'Espec./Tolerancia Producto/Proceso', width: '160px' },
    { key: 'evaluationTechnique',   label: 'Técnica Evaluación/Medición',        width: '140px' },
    { key: 'sampleSize',            label: 'Tamaño Muestra',                     width: '90px', required: true },
    { key: 'sampleFrequency',       label: 'Frecuencia',                         width: '90px' },
    { key: 'controlMethod',         label: 'Método Control',                     width: '140px', required: true },
    { key: 'reactionPlan',          label: 'Plan Reacción',                      width: '160px', required: true },
    { key: 'reactionPlanOwner',     label: 'Responsable Reacción',               width: '120px', required: true },
    { key: 'controlProcedure',      label: 'Plan Reacción ante Descontrol',      width: '160px' },
];

/** AIAG standard column groups for the sticky header. */
export const CP_COLUMN_GROUPS: { label: string; colSpan: number }[] = [
    { label: 'Proceso',          colSpan: 4 },
    { label: 'Características',  colSpan: 4 },
    { label: 'Métodos',          colSpan: 8 },
];

/** Term definition for tooltip display */
export interface CpTerm {
    term: string;
    definition: string;
}

/** AIAG CP 1st Ed 2024 — Column definitions with tooltips */
export const CP_COLUMN_TERMS: Record<string, CpTerm> = {
    processStepNumber: {
        term: 'Número de Parte/Proceso',
        definition: 'Número de referencia del paso del proceso, generalmente tomado del diagrama de flujo.',
    },
    processDescription: {
        term: 'Descripción del Proceso/Operación',
        definition: 'Descripción de todos los pasos del proceso/operación del diagrama de flujo.',
    },
    machineDeviceTool: {
        term: 'Máquina/Dispositivo/Herramienta',
        definition: 'Equipo, máquina, dispositivo o herramienta utilizada en cada operación del proceso.',
    },
    characteristicNumber: {
        term: 'Número de Característica',
        definition: 'Número de referencia cruzada con documentos aplicables (plano, AMFE).',
    },
    productCharacteristic: {
        term: 'Característica de Producto',
        definition: 'Propiedades o dimensiones del producto que se miden después de completar el proceso.',
    },
    processCharacteristic: {
        term: 'Característica de Proceso',
        definition: 'Variables del proceso con relación causa-efecto con la característica de producto.',
    },
    specialCharClass: {
        term: 'Clasificación Caract. Especial',
        definition: 'CC = Crítica para el cliente. SC = Significativa. PTC = Pass-Through (sin modificación en planta). Clasificación per IATF 16949 / CP-1 2024.',
    },
    specification: {
        term: 'Especificación/Tolerancia',
        definition: 'Rango de aceptación del producto/proceso según especificación de ingeniería.',
    },
    evaluationTechnique: {
        term: 'Técnica de Evaluación/Medición',
        definition: 'Sistema de medición utilizado (calibre, CMM, visual, gage R&R, etc.).',
    },
    sampleSize: {
        term: 'Tamaño de Muestra',
        definition: 'Cantidad de piezas a inspeccionar por cada evento de muestreo.',
    },
    sampleFrequency: {
        term: 'Frecuencia de Muestreo',
        definition: 'Periodicidad del muestreo (cada pieza, cada hora, inicio de turno, etc.).',
    },
    controlMethod: {
        term: 'Método de Control',
        definition: 'Método de prevención o detección (Poka-Yoke, SPC, checklist, inspección visual, etc.).',
    },
    reactionPlan: {
        term: 'Plan de Reacción',
        definition: 'Acciones correctivas cuando se detecta producto no conforme o variación fuera de control.',
    },
    reactionPlanOwner: {
        term: 'Responsable Plan Reacción',
        definition: 'Persona o rol responsable de ejecutar el plan de reacción en piso. Obligatorio per CP 2024.',
    },
    controlProcedure: {
        term: 'Plan Reacción ante Descontrol',
        definition: 'Referencia al procedimiento SGC aplicable ante descontrol del proceso (ej: P-09/I, P-10/I, P-14).',
    },
};

/**
 * Normalize a loaded document by filling missing fields with defaults.
 * Ensures backward compatibility when fields are added or removed.
 */
export function normalizeControlPlanDocument(raw: any): ControlPlanDocument {
    const rawHeader = raw.header || {};
    // Backward compat: merge old split customer approval fields into single field
    let customerApproval = rawHeader.customerApproval || '';
    if (!customerApproval && (rawHeader.customerEngApproval || rawHeader.customerQualityApproval)) {
        const parts = [rawHeader.customerEngApproval, rawHeader.customerQualityApproval].filter(Boolean);
        customerApproval = parts.join(' / ');
    }
    const header: ControlPlanHeader = {
        ...EMPTY_CP_HEADER,
        ...rawHeader,
        customerApproval,
        phase: CONTROL_PLAN_PHASES.some(p => p.value === rawHeader.phase)
            ? rawHeader.phase
            : 'production',
    };
    // Remove legacy fields that may have spread in
    delete (header as any).customerEngApproval;
    delete (header as any).customerQualityApproval;

    const items: ControlPlanItem[] = (raw.items || []).map((item: any) => ({
        id: item.id || uuidv4(),
        processStepNumber: item.processStepNumber || '',
        processDescription: item.processDescription || '',
        machineDeviceTool: item.machineDeviceTool || '',
        componentMaterial: item.componentMaterial || '',
        characteristicNumber: item.characteristicNumber || '',
        productCharacteristic: item.productCharacteristic || '',
        processCharacteristic: item.processCharacteristic || '',
        specialCharClass: item.specialCharClass || '',
        specification: item.specification || '',
        evaluationTechnique: item.evaluationTechnique || '',
        sampleSize: item.sampleSize || '',
        sampleFrequency: item.sampleFrequency || '',
        controlMethod: item.controlMethod || '',
        reactionPlan: item.reactionPlan || '',
        reactionPlanOwner: item.reactionPlanOwner || '',
        controlProcedure: item.controlProcedure || '',
        autoFilledFields: item.autoFilledFields,
        amfeAp: item.amfeAp || '',
        amfeSeverity: item.amfeSeverity ?? undefined,
        operationCategory: item.operationCategory || '',
        amfeCauseIds: item.amfeCauseIds,
        amfeFailureId: item.amfeFailureId,
        amfeFailureIds: item.amfeFailureIds,
    }));

    return { header, items };
}
