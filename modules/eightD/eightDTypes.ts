/**
 * 8D Report Types
 *
 * Global 8D (G8D) methodology — Ford/AIAG/VDA standard.
 * D0-D8: 9 disciplines including ERA, Escape Point, and Horizontal Deployment.
 *
 * Validated against:
 * - ASQ Eight Disciplines (asq.org)
 * - Ford G8D methodology
 * - VDA 8D problem solving
 * - QRQC gemba data collection (Nissan)
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const FISH_CATEGORIES = [
    { id: 'mano_obra', label: 'Mano de Obra', color: '#E85D3A', icon: 'Users' },
    { id: 'maquina', label: 'Maquina', color: '#2E86DE', icon: 'Cog' },
    { id: 'material', label: 'Material', color: '#10AC84', icon: 'Package' },
    { id: 'metodo', label: 'Metodo', color: '#8854D0', icon: 'ClipboardList' },
    { id: 'medio_amb', label: 'Medio Ambiente', color: '#F7B731', icon: 'Thermometer' },
    { id: 'medicion', label: 'Medicion', color: '#FC5C65', icon: 'Ruler' },
] as const;

export type FishCategoryId = typeof FISH_CATEGORIES[number]['id'];

export const D_STEPS = [
    { id: 'd0', label: 'D0', title: 'Preparacion y ERA', desc: 'Sintoma inicial, urgencia y acciones de respuesta de emergencia (ERA)' },
    { id: 'd1', label: 'D1', title: 'Equipo', desc: 'Equipo multifuncional con conocimiento del producto/proceso' },
    { id: 'd2', label: 'D2', title: 'Descripcion del Problema', desc: '5W2H + Analisis Es / No Es' },
    { id: 'd3', label: 'D3', title: 'Contencion Interina (ICA)', desc: 'Acciones interinas para aislar el problema del cliente' },
    { id: 'd4', label: 'D4', title: 'Causa Raiz y Punto de Escape', desc: 'Ishikawa 6M + 5 Por Que + Punto de Escape (G8D)' },
    { id: 'd5', label: 'D5', title: 'Acciones Correctivas Permanentes', desc: 'PCAs para causa raiz Y punto de escape, verificadas pre-implementacion' },
    { id: 'd6', label: 'D6', title: 'Implementar y Validar PCAs', desc: 'Implementar, retirar ICA, validar con datos de produccion' },
    { id: 'd7', label: 'D7', title: 'Prevencion de Recurrencia', desc: 'FMEA, Plan de Control, Instrucciones de Trabajo, despliegue horizontal' },
    { id: 'd8', label: 'D8', title: 'Cierre y Reconocimiento', desc: 'Felicitar al equipo, documentar lecciones aprendidas' },
] as const;

export type DStepId = typeof D_STEPS[number]['id'];

export type UrgencyLevel = 'baja' | 'media' | 'alta' | 'critica';
export type ActionStatus = 'pendiente' | 'en_proceso' | 'cerrado';
export type EightDStatus = 'abierto' | 'en_proceso' | 'cerrado';

export const URGENCY_OPTIONS = [
    { value: 'baja' as const, label: 'Baja', color: '#10AC84' },
    { value: 'media' as const, label: 'Media', color: '#F7B731' },
    { value: 'alta' as const, label: 'Alta', color: '#E85D3A' },
    { value: 'critica' as const, label: 'Critica', color: '#FC5C65' },
];

export const STATUS_OPTIONS: { value: ActionStatus; label: string }[] = [
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'en_proceso', label: 'En Proceso' },
    { value: 'cerrado', label: 'Cerrado' },
];

// ---------------------------------------------------------------------------
// D-step data interfaces
// ---------------------------------------------------------------------------

/** D0: Preparacion y ERA (Emergency Response Action) — G8D gateway */
export interface EightD_D0 {
    symptom: string;
    urgency: UrgencyLevel;
    client: string;
    era: string;
    eraResponsible: string;
    eraDate: string;
    eraVerification: string;
    needsFull8D: string;
}

/** D1: Equipo multifuncional */
export interface EightD_D1 {
    leader: string;
    champion: string;
    members: string;
}

/** D2: Descripcion del Problema — 5W2H + Es/No Es */
export interface EightD_D2 {
    what: string;
    where: string;
    when: string;
    who: string;
    howMany: string;
    howDetected: string;
    partNumber: string;
    isNotWhat: string;
    isNotWhere: string;
    isNotWhen: string;
    isNotHowMany: string;
    /** Whether the failure mode appears in the AMFE (Barack format) */
    figuraModoDeFallaEnAmfe: 'si' | 'no' | '';
}

/** D3: Contencion Interina (ICA) */
export interface EightD_D3 {
    actions: string;
    responsible: string;
    date: string;
    status: ActionStatus;
    verification: string;
    /** Containment location tracking (Barack format) */
    containment: {
        potentialStock: string;
        potentialRetrabajo: string;
        potentialScrap: string;
        potentialExpedicion: string;
        potentialTransito: string;
        potentialCliente: string;
        encontradoStock: string;
        encontradoRetrabajo: string;
        encontradoScrap: string;
        encontradoExpedicion: string;
        encontradoTransito: string;
        encontradoCliente: string;
    };
    verificationResponsible: string;
    effectPercentage: string;
    implementationDate: string;
}

/** Fishbone data: category ID → array of cause strings */
export type FishboneData = Record<FishCategoryId, string[]>;

/** D4: Causa Raiz y Punto de Escape */
export interface EightD_D4 {
    fishbone: FishboneData;
    fiveWhy: string[];
    rootCause: string;
    rootCauseVerification: string;
    escapePoint: string;
    escapeWhy: string;
    /** 5 Por Que for escape point / non-detection (Barack format: "4.1 Causa Raiz de la No Deteccion") */
    fiveWhyEscape: string[];
}

/** PCA (Permanent Corrective Action) item */
export interface PcaAction {
    action: string;
    responsible: string;
    deadline: string;
    status: ActionStatus;
}

/** D5: Acciones Correctivas Permanentes (PCAs) */
export interface EightD_D5 {
    actions: PcaAction[];
    escapeAction: string;
    escapeResponsible: string;
    riskAssessment: string;
    verificationMethod: string;
    /** Verification text and effect percentage per action (Barack format) */
    verificationText: string;
    effectPercentage: string;
}

/** D6: Implementacion y Validacion */
export interface EightD_D6 {
    validation: string;
    evidence: string;
    validationPeriod: string;
    icaRemoved: string;
    effective: string;
    /** Implementation date and responsible (Barack format) */
    implementationDate: string;
    responsible: string;
}

/** D7: Prevencion de Recurrencia */
export interface EightD_D7 {
    prevention: string;
    fmeaUpdated: string;
    controlPlanUpdated: string;
    workInstructions: string;
    otherDocs: string;
    horizontalDeployment: string;
    /** Document checkboxes (Barack format: 7.1) */
    affectedDocs: {
        amfe: boolean;
        controlPlan: boolean;
        hojaProceso: boolean;
        ayudasVisuales: boolean;
        idMaterial: boolean;
        estructura: boolean;
        papp: boolean;
        procedimientos: boolean;
    };
    /** Action responsibility and date (Barack format) */
    actionResponsible: string;
    actionDate: string;
}

/** D8: Cierre y Reconocimiento */
export interface EightD_D8 {
    lessons: string;
    recognition: string;
    closedDate: string;
    customerApproval: string;
    effectivenessCheckDate: string;
    /** Barack format fields */
    verificationDate: string;
    verifiedBy: string;
    elaboratedBy: string;
}

// ---------------------------------------------------------------------------
// Full 8D Document
// ---------------------------------------------------------------------------

export interface EightDReport {
    id: string;
    reportNumber: string;
    title: string;
    status: EightDStatus;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    updatedBy: string;
    currentStep: number;
    /** Vehicle/model info (Barack format header) */
    vehicle: string;
    model: string;
    plant: string;
    partName: string;
    referenceNumber: string;
    d0: EightD_D0;
    d1: EightD_D1;
    d2: EightD_D2;
    d3: EightD_D3;
    d4: EightD_D4;
    d5: EightD_D5;
    d6: EightD_D6;
    d7: EightD_D7;
    d8: EightD_D8;
}

// ---------------------------------------------------------------------------
// Field Data Collection Sheet (Hoja de Campo)
// ---------------------------------------------------------------------------

/**
 * Hoja de Campo — Pre-8D field data collection.
 *
 * Based on Genchi Genbutsu (Toyota), QRQC gemba data (Nissan),
 * and ASQ Check Sheet methodology. Feeds into D0 and D2.
 */
export interface FieldDataSheet {
    /** Date/time of gemba visit */
    date: string;
    /** Shift (turno) */
    shift: string;
    /** Line / station where problem observed */
    lineStation: string;
    /** Product / part number affected */
    partNumber: string;
    /** Who collected the data */
    recorder: string;
    /** Free-text description of what was observed (facts, not interpretations) */
    problemObserved: string;
    /** Defect count observed */
    defectCount: string;
    /** Sample size / batch size */
    sampleSize: string;
    /** People interviewed (name, role, key statement) */
    interviews: string;
    /** Measurements taken (dimension, tool, values) */
    measurements: string;
    /** Environmental conditions (temp, humidity, lighting) */
    environmentalConditions: string;
    /** Timeline of events */
    timeline: string;
    /** Immediate actions already taken on the floor */
    immediateActions: string;
    /** Material/equipment lot numbers, machine IDs */
    materialEquipment: string;
    /** Photo references / evidence notes */
    photoReferences: string;
    /** Additional notes */
    notes: string;
}

// ---------------------------------------------------------------------------
// Row type for database listing
// ---------------------------------------------------------------------------

export interface EightDDocumentRow {
    id: string;
    report_number: string;
    title: string;
    status: EightDStatus;
    urgency: UrgencyLevel;
    client: string;
    part_number: string;
    leader: string;
    root_cause: string;
    created_at: string;
    updated_at: string;
    created_by: string;
    updated_by: string;
    data: string;
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

export function createEmptyFishbone(): FishboneData {
    return {
        mano_obra: [''],
        maquina: [''],
        material: [''],
        metodo: [''],
        medio_amb: [''],
        medicion: [''],
    };
}

export function createEmptyReport(): EightDReport {
    const now = new Date().toISOString();
    return {
        id: crypto.randomUUID(),
        reportNumber: '',
        title: '',
        status: 'abierto',
        createdAt: now,
        updatedAt: now,
        createdBy: '',
        updatedBy: '',
        currentStep: 0,
        vehicle: '',
        model: '',
        plant: '',
        partName: '',
        referenceNumber: '',
        d0: {
            symptom: '', urgency: 'media', client: '',
            era: '', eraResponsible: '', eraDate: '',
            eraVerification: '', needsFull8D: '',
        },
        d1: { leader: '', champion: '', members: '' },
        d2: {
            what: '', where: '', when: '', who: '',
            howMany: '', howDetected: '', partNumber: '',
            isNotWhat: '', isNotWhere: '', isNotWhen: '', isNotHowMany: '',
            figuraModoDeFallaEnAmfe: '',
        },
        d3: {
            actions: '', responsible: '', date: '', status: 'pendiente', verification: '',
            containment: {
                potentialStock: '', potentialRetrabajo: '', potentialScrap: '',
                potentialExpedicion: '', potentialTransito: '', potentialCliente: '',
                encontradoStock: '', encontradoRetrabajo: '', encontradoScrap: '',
                encontradoExpedicion: '', encontradoTransito: '', encontradoCliente: '',
            },
            verificationResponsible: '', effectPercentage: '', implementationDate: '',
        },
        d4: {
            fishbone: createEmptyFishbone(),
            fiveWhy: ['', '', '', '', ''],
            rootCause: '', rootCauseVerification: '',
            escapePoint: '', escapeWhy: '',
            fiveWhyEscape: ['', '', '', '', ''],
        },
        d5: {
            actions: [{ action: '', responsible: '', deadline: '', status: 'pendiente' }],
            escapeAction: '', escapeResponsible: '',
            riskAssessment: '', verificationMethod: '',
            verificationText: '', effectPercentage: '',
        },
        d6: {
            validation: '', evidence: '', validationPeriod: '', icaRemoved: '', effective: '',
            implementationDate: '', responsible: '',
        },
        d7: {
            prevention: '', fmeaUpdated: '', controlPlanUpdated: '',
            workInstructions: '', otherDocs: '', horizontalDeployment: '',
            affectedDocs: {
                amfe: false, controlPlan: false, hojaProceso: false, ayudasVisuales: false,
                idMaterial: false, estructura: false, papp: false, procedimientos: false,
            },
            actionResponsible: '', actionDate: '',
        },
        d8: {
            lessons: '', recognition: '', closedDate: '', customerApproval: '', effectivenessCheckDate: '',
            verificationDate: '', verifiedBy: '', elaboratedBy: '',
        },
    };
}

export function createEmptyFieldDataSheet(): FieldDataSheet {
    return {
        date: '', shift: '', lineStation: '', partNumber: '',
        recorder: '', problemObserved: '', defectCount: '',
        sampleSize: '', interviews: '', measurements: '',
        environmentalConditions: '', timeline: '',
        immediateActions: '', materialEquipment: '',
        photoReferences: '', notes: '',
    };
}
