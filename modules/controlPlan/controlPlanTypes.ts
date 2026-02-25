/**
 * Control Plan Type Definitions
 *
 * AIAG format Control Plan with 13 standard columns.
 * Linked to AMFE via characteristicNumber and process step.
 *
 * Phases: Prototype | Pre-Launch | Safe Launch | Production
 */

import { v4 as uuidv4 } from 'uuid';

/** Control Plan phases per AIAG standard. */
export type ControlPlanPhase = 'prototype' | 'preLaunch' | 'safeLaunch' | 'production';

export const CONTROL_PLAN_PHASES: { value: ControlPlanPhase; label: string }[] = [
    { value: 'prototype', label: 'Prototipo' },
    { value: 'preLaunch', label: 'Pre-Lanzamiento' },
    { value: 'safeLaunch', label: 'Safe Launch' },
    { value: 'production', label: 'Produccion' },
];

/** Header metadata for a Control Plan document. */
export interface ControlPlanHeader {
    controlPlanNumber: string;
    phase: ControlPlanPhase;
    partNumber: string;
    latestChangeLevel: string;
    partName: string;
    organization: string;
    supplier: string;
    supplierCode: string;
    keyContactPhone: string;
    date: string;
    revision: string;
    responsible: string;
    approvedBy: string;
    client: string;
    coreTeam: string;
    customerEngApproval: string;
    customerQualityApproval: string;
    otherApproval: string;
    linkedAmfeProject: string;
}

/** A single row/item in the Control Plan table (AIAG standard columns). */
export interface ControlPlanItem {
    id: string;
    processStepNumber: string;
    processDescription: string;
    machineDeviceTool: string;
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
    phase: 'production',
    partNumber: '',
    latestChangeLevel: '',
    partName: '',
    organization: '',
    supplier: '',
    supplierCode: '',
    keyContactPhone: '',
    date: new Date().toISOString().split('T')[0],
    revision: '',
    responsible: '',
    approvedBy: '',
    client: '',
    coreTeam: '',
    customerEngApproval: '',
    customerQualityApproval: '',
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

/** Column definitions for the Control Plan table (13 AIAG standard columns). */
export const CP_COLUMNS: CPColumnDef[] = [
    // Proceso (3)
    { key: 'processStepNumber',     label: 'Nro. Parte/Proceso',                 width: '80px', required: true },
    { key: 'processDescription',    label: 'Descripcion Proceso/Operacion',      width: '170px', required: true },
    { key: 'machineDeviceTool',     label: 'Maquina/Dispositivo/Herram.',        width: '140px' },
    // Caracteristicas (4)
    { key: 'characteristicNumber',  label: 'Nro.',                               width: '60px' },
    { key: 'productCharacteristic', label: 'Producto',                           width: '150px', required: true },
    { key: 'processCharacteristic', label: 'Proceso',                            width: '150px' },
    { key: 'specialCharClass',      label: 'Clasif. Caract. Esp.',              width: '80px' },
    // Metodos (7)
    { key: 'specification',         label: 'Espec./Tolerancia Producto/Proceso', width: '160px' },
    { key: 'evaluationTechnique',   label: 'Tecnica Evaluacion/Medicion',        width: '140px' },
    { key: 'sampleSize',            label: 'Tamaño Muestra',                     width: '90px', required: true },
    { key: 'sampleFrequency',       label: 'Frecuencia',                         width: '90px' },
    { key: 'controlMethod',         label: 'Metodo Control',                     width: '140px', required: true },
    { key: 'reactionPlan',          label: 'Plan Reaccion',                      width: '160px', required: true },
    { key: 'reactionPlanOwner',     label: 'Responsable Reaccion',               width: '120px', required: true },
];

/** AIAG standard column groups for the sticky header. */
export const CP_COLUMN_GROUPS: { label: string; colSpan: number }[] = [
    { label: 'Proceso',          colSpan: 3 },
    { label: 'Caracteristicas',  colSpan: 4 },
    { label: 'Metodos',          colSpan: 7 },
];

/** Term definition for tooltip display */
export interface CpTerm {
    term: string;
    definition: string;
}

/** AIAG CP 1st Ed 2024 — Column definitions with tooltips */
export const CP_COLUMN_TERMS: Record<string, CpTerm> = {
    processStepNumber: {
        term: 'Numero de Parte/Proceso',
        definition: 'Numero de referencia del paso del proceso, generalmente tomado del diagrama de flujo.',
    },
    processDescription: {
        term: 'Descripcion del Proceso/Operacion',
        definition: 'Descripcion de todos los pasos del proceso/operacion del diagrama de flujo.',
    },
    machineDeviceTool: {
        term: 'Maquina/Dispositivo/Herramienta',
        definition: 'Equipo, maquina, dispositivo o herramienta utilizada en cada operacion del proceso.',
    },
    characteristicNumber: {
        term: 'Numero de Caracteristica',
        definition: 'Numero de referencia cruzada con documentos aplicables (plano, AMFE).',
    },
    productCharacteristic: {
        term: 'Caracteristica de Producto',
        definition: 'Propiedades o dimensiones del producto que se miden despues de completar el proceso.',
    },
    processCharacteristic: {
        term: 'Caracteristica de Proceso',
        definition: 'Variables del proceso con relacion causa-efecto con la caracteristica de producto.',
    },
    specialCharClass: {
        term: 'Clasificacion Caract. Especial',
        definition: 'CC = Critica para el cliente. SC = Significativa. Clasificacion per IATF 16949.',
    },
    specification: {
        term: 'Especificacion/Tolerancia',
        definition: 'Rango de aceptacion del producto/proceso segun especificacion de ingenieria.',
    },
    evaluationTechnique: {
        term: 'Tecnica de Evaluacion/Medicion',
        definition: 'Sistema de medicion utilizado (calibre, CMM, visual, gage R&R, etc.).',
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
        term: 'Metodo de Control',
        definition: 'Metodo de prevencion o deteccion (Poka-Yoke, SPC, checklist, inspeccion visual, etc.).',
    },
    reactionPlan: {
        term: 'Plan de Reaccion',
        definition: 'Acciones correctivas cuando se detecta producto no conforme o variacion fuera de control.',
    },
    reactionPlanOwner: {
        term: 'Responsable Plan Reaccion',
        definition: 'Persona o rol responsable de ejecutar el plan de reaccion en piso. Obligatorio per CP 2024.',
    },
};

/**
 * Normalize a loaded document by filling missing fields with defaults.
 * Ensures backward compatibility when fields are added or removed.
 */
export function normalizeControlPlanDocument(raw: any): ControlPlanDocument {
    const header: ControlPlanHeader = {
        ...EMPTY_CP_HEADER,
        ...(raw.header || {}),
        phase: CONTROL_PLAN_PHASES.some(p => p.value === raw.header?.phase)
            ? raw.header.phase
            : 'production',
    };

    const items: ControlPlanItem[] = (raw.items || []).map((item: any) => ({
        id: item.id || uuidv4(),
        processStepNumber: item.processStepNumber || '',
        processDescription: item.processDescription || '',
        machineDeviceTool: item.machineDeviceTool || '',
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
