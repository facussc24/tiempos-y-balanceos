/**
 * AMFE VDA Type Definitions
 *
 * 5-level hierarchical data model for AIAG-VDA FMEA:
 * AmfeOperation → AmfeWorkElement (6M) → AmfeFunction → AmfeFailure → AmfeCause
 *
 * Uses Action Priority (AP) instead of RPN for risk assessment.
 * Per VDA standard: Failure Mode owns Effects & Severity; Causes own O, D & AP.
 */

import { v4 as uuidv4 } from 'uuid';

/** Action Priority levels per AIAG-VDA FMEA standard. */
export enum ActionPriority {
    HIGH = 'H',
    MEDIUM = 'M',
    LOW = 'L',
    NONE = ''
}

/** Predefined labels for the 3 effect levels (displayed in single merged column). */
export const EFFECT_LABELS = {
    effectLocal: 'BARACK MERCOSUL',
    effectNextLevel: 'Planta Cliente',
    effectEndUser: 'Usuario Final',
} as const;

/**
 * Level 5: Cause - each failure mode can have multiple causes.
 * Each cause owns its own O, D, AP, controls, and Step 6 optimization fields.
 */
export interface AmfeCause {
    id: string;
    // Step 4: Cause
    cause: string; // Failure Cause (FC) - Why the work element failed?

    // Step 5: Risk Analysis (per cause)
    preventionControl: string; // PC
    detectionControl: string; // DC
    occurrence: number | string; // O
    detection: number | string; // D
    ap: ActionPriority | string; // AP (calculated from parent's S + this O + this D)
    characteristicNumber: string; // Links to Control Plan
    specialChar: string;
    filterCode: string;

    // Step 6: Optimization (per cause)
    preventionAction: string;
    detectionAction: string;
    responsible: string;
    targetDate: string;
    status: string;
    actionTaken: string;
    completionDate: string;
    severityNew: number | string;
    occurrenceNew: number | string;
    detectionNew: number | string;
    apNew: ActionPriority | string;
    observations: string;
}

/** Create a blank AmfeCause with all fields initialized. */
export function createEmptyCause(): AmfeCause {
    return {
        id: uuidv4(),
        cause: '',
        preventionControl: '', detectionControl: '',
        occurrence: '', detection: '', ap: '',
        characteristicNumber: '', specialChar: '', filterCode: '',
        preventionAction: '', detectionAction: '',
        responsible: '', targetDate: '', status: '',
        actionTaken: '', completionDate: '',
        severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
        observations: '',
    };
}

/**
 * Level 4: Failure Mode - owns effects (3 levels) and severity.
 * Contains an array of causes, each with its own risk analysis.
 */
export interface AmfeFailure {
    id: string;
    // Step 4: Failure Analysis — owned by the failure mode
    description: string; // Failure Mode (FM) - The negative of the function
    // AIAG-VDA: 3 levels of failure effects (rendered in 1 merged column)
    effectLocal: string; // Effect at BARACK MERCOSUL (local/internal)
    effectNextLevel: string; // Effect at Planta Cliente (next level)
    effectEndUser: string; // Effect on Usuario Final (end user)
    severity: number | string; // S - max severity across effect levels

    // Per-level severity (AIAG-VDA: severity = MAX of all 3 levels)
    severityLocal?: number | string;     // S for internal/local effect
    severityNextLevel?: number | string; // S for customer plant effect
    severityEndUser?: number | string;   // S for end user effect

    // Causes array (VDA: 1 FM can have N causes)
    causes: AmfeCause[];

    /** @deprecated Use effectLocal/effectNextLevel/effectEndUser instead. Kept for migration from v1. */
    effect?: string;
    /** @deprecated Use causes[].cause instead. Kept for migration. */
    cause?: string;
    /** @deprecated Use causes[].preventionControl instead. */
    preventionControl?: string;
    /** @deprecated Use causes[].detectionControl instead. */
    detectionControl?: string;
    /** @deprecated Use causes[].occurrence instead. */
    occurrence?: number | string;
    /** @deprecated Use causes[].detection instead. */
    detection?: number | string;
    /** @deprecated Use causes[].ap instead. */
    ap?: ActionPriority | string;
    /** @deprecated Use causes[].characteristicNumber instead. */
    characteristicNumber?: string;
    /** @deprecated Use causes[].specialChar instead. */
    specialChar?: string;
    /** @deprecated Use causes[].filterCode instead. */
    filterCode?: string;
    /** @deprecated Use causes[].preventionAction instead. */
    preventionAction?: string;
    /** @deprecated Use causes[].detectionAction instead. */
    detectionAction?: string;
    /** @deprecated Use causes[].responsible instead. */
    responsible?: string;
    /** @deprecated Use causes[].targetDate instead. */
    targetDate?: string;
    /** @deprecated Use causes[].status instead. */
    status?: string;
    /** @deprecated Use causes[].actionTaken instead. */
    actionTaken?: string;
    /** @deprecated Use causes[].completionDate instead. */
    completionDate?: string;
    /** @deprecated Use causes[].severityNew instead. */
    severityNew?: number | string;
    /** @deprecated Use causes[].occurrenceNew instead. */
    occurrenceNew?: number | string;
    /** @deprecated Use causes[].detectionNew instead. */
    detectionNew?: number | string;
    /** @deprecated Use causes[].apNew instead. */
    apNew?: ActionPriority | string;
    /** @deprecated Use causes[].observations instead. */
    observations?: string;
}

/** Level 3: Function - what the work element should do. */
export interface AmfeFunction {
    id: string;
    description: string; // Function description (e.g. "Maintain Temp > 200C")
    requirements: string; // Optional requirements/specs

    failures: AmfeFailure[];
}

/** The 6M categories for process work elements. */
export type WorkElementType = 'Machine' | 'Man' | 'Material' | 'Method' | 'Environment' | 'Measurement';

/** Level 2: Work Element - a 6M component of a process step. */
export interface AmfeWorkElement {
    id: string;
    type: WorkElementType;
    name: string; // e.g. "CNC Machine", "Operator"

    functions: AmfeFunction[];
}

/** Level 1: Operation - a process step in the manufacturing flow. */
export interface AmfeOperation {
    id: string;
    // Step 2: Structure
    opNumber: string; // 1. Item
    name: string; // 2. Step Name / Process Step

    workElements: AmfeWorkElement[];

    // Library inheritance (optional - set when imported from global library)
    linkedLibraryOpId?: string;
}

/** Header metadata for an AMFE document. */
export interface AmfeHeaderData {
    organization: string;
    location: string;
    client: string;
    modelYear: string;
    subject: string;
    startDate: string;
    revDate: string;
    team: string;
    amfeNumber: string;
    responsible: string;
    confidentiality: string;
    // AIAG-VDA additional header fields
    partNumber: string;
    processResponsible: string;
    revision: string;
    approvedBy: string;
    scope: string;
    /** Applicable part numbers (one per line) for Family FMEA (AIAG-VDA). */
    applicableParts: string;
}

/** Top-level AMFE document structure (header + operations). */
export interface AmfeDocument {
    header: AmfeHeaderData;
    operations: AmfeOperation[];
}

/** Valid status options for AMFE failure action tracking */
export const AMFE_STATUS_OPTIONS = ['Pendiente', 'En Proceso', 'Completado', 'Cancelado'] as const;
export type AmfeStatus = typeof AMFE_STATUS_OPTIONS[number] | '';

/** All 6M work element types */
export const WORK_ELEMENT_TYPES: WorkElementType[] = ['Machine', 'Man', 'Material', 'Method', 'Environment', 'Measurement'];

/** Display labels for work element types (Spanish) */
export const WORK_ELEMENT_LABELS: Record<WorkElementType, string> = {
    Machine: 'Máquina',
    Man: 'Mano de Obra',
    Material: 'Material',
    Method: 'Método',
    Environment: 'Medio Ambiente',
    Measurement: 'Medición',
};
