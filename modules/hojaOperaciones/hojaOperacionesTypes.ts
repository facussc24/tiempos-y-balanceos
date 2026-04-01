/**
 * Hoja de Operaciones (Work Instruction) Type Definitions
 *
 * Per IATF 16949 clause 8.5.1.2 — visual instructions for the operator.
 * Consumes data from AMFE (CC/SC symbols) and Control Plan (quality checks).
 *
 * Structure: HoDocument → HojaOperacion[] (one sheet per AMFE operation)
 *
 * Sections per sheet (IATF 8.5.1.2):
 *   A. Identification (header)
 *   B. Safety & PPE
 *   C. Process Steps (the "How")
 *   D. Quality Verification (from CP)
 *   E. Reaction Plan
 *   F. Visual Aids
 *   G. Metadata
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// PPE / SAFETY ELEMENTS
// ============================================================================

/** Predefined PPE items matching ISO mandatory safety pictograms used by the company. */
export type PpeItem =
    | 'anteojos'
    | 'guantes'
    | 'zapatos'
    | 'proteccionAuditiva'
    | 'delantal'
    | 'respirador';

/** PPE catalog with display labels and icon filenames. */
export const PPE_CATALOG: { id: PpeItem; label: string; iconFile: string }[] = [
    { id: 'anteojos',           label: 'Anteojos de seguridad',  iconFile: 'anteojos.png' },
    { id: 'guantes',            label: 'Guantes',                iconFile: 'guantes.png' },
    { id: 'zapatos',            label: 'Zapatos de seguridad',   iconFile: 'zapatos.jpg' },
    { id: 'proteccionAuditiva', label: 'Proteccion auditiva',    iconFile: 'proteccionAuditiva.png' },
    { id: 'delantal',           label: 'Ropa de proteccion',     iconFile: 'delantal.png' },
    { id: 'respirador',         label: 'Respirador',             iconFile: 'respirador.jpg' },
];

// ============================================================================
// HAZARD WARNINGS
// ============================================================================

/** @deprecated Hazard warnings removed from UI. Kept for backward compatibility with saved documents. */
export type HazardWarning =
    | 'superficieCaliente'
    | 'puntoAtrapamiento'
    | 'altoVoltaje'
    | 'materialQuimico'
    | 'cargaPesada'
    | 'ruido'
    | 'caida'
    | 'cortante';

/** @deprecated Not shown in UI. Kept for normalizer backward compatibility. */
export const HAZARD_CATALOG: { id: HazardWarning; label: string }[] = [
    { id: 'superficieCaliente', label: 'Superficie caliente' },
    { id: 'puntoAtrapamiento',  label: 'Punto de atrapamiento' },
    { id: 'altoVoltaje',        label: 'Alto voltaje' },
    { id: 'materialQuimico',    label: 'Material quimico' },
    { id: 'cargaPesada',        label: 'Carga pesada' },
    { id: 'ruido',              label: 'Ruido elevado' },
    { id: 'caida',              label: 'Riesgo de caida' },
    { id: 'cortante',           label: 'Elemento cortante' },
];

// ============================================================================
// OPERATION STEP — Section C
// ============================================================================

/**
 * A single numbered step in the "Descripcion de la Operacion" section.
 * Per TWI (Training Within Industry): each step has a Key Point explaining
 * the "trick" or critical detail for doing it right and safely.
 */
export interface HoStep {
    id: string;
    stepNumber: number;
    description: string;
    /** Mark as key/critical step — shown bold/highlighted in PDF. */
    isKeyPoint: boolean;
    /** Reason for the key point (per TWI: Why is this important?). */
    keyPointReason: string;
    /** Optional link to a visual aid for this specific step. */
    visualAidId?: string;
}

// ============================================================================
// QUALITY CHECK — Section D (projection of CP onto operator screen)
// ============================================================================

/**
 * A quality verification item derived from the Control Plan.
 * Per NotebookLM/AIAG: the WI "consumes" CP data — it doesn't create it.
 *
 * Fields are read-only except `registro` (which log/form to record in).
 */
export interface HoQualityCheck {
    id: string;
    /** What to measure — productCharacteristic or processCharacteristic from CP. */
    characteristic: string;
    /** Specification/tolerance — from CP, read-only in WI. */
    specification: string;
    /** Evaluation technique/gage — from CP. */
    evaluationTechnique: string;
    /** Sample frequency — from CP (e.g. "100%", "5 pcs/hora"). */
    frequency: string;
    /** Control method — from CP (becomes "task title" in WI). */
    controlMethod: string;
    /** Reaction plan action — from CP (what to do if NOK). */
    reactionAction: string;
    /** Reaction plan contact — from CP (who to notify). */
    reactionContact: string;
    /** CC/SC symbol — from CP specialCharClass. MUST appear visually per IATF. */
    specialCharSymbol: string;
    /** User-editable: which log/form to record results in. */
    registro: string;
    /** Source CP item ID for traceability. */
    cpItemId?: string;
    /** True when the CP source for this QC no longer exists after regeneration. */
    orphaned?: boolean;
}

// ============================================================================
// VISUAL AID — Section F
// ============================================================================

/**
 * A visual aid image for the operation sheet.
 * Per IATF 8.5.1.2: visual standards are a requirement, not optional.
 */
export interface HoVisualAid {
    id: string;
    /** Base64-encoded image data. */
    imageData: string;
    /** Caption/description shown below the image. */
    caption: string;
    /** Sort order for display (0 = first). */
    order: number;
}

// ============================================================================
// HOJA DE OPERACIONES — One sheet per operation
// ============================================================================

/** Document status for revision control. */
export type HoStatus = 'borrador' | 'aprobado' | 'pendienteRevision';

/** One Hoja de Operaciones sheet, tied to a single AMFE operation. */
export interface HojaOperacion {
    id: string;

    // --- A. Identification (linked to AMFE) ---
    amfeOperationId: string;
    operationNumber: string;
    operationName: string;
    hoNumber: string;
    sector: string;
    puestoNumber: string;
    vehicleModel: string;
    partCodeDescription: string;

    // --- B. Safety & PPE ---
    safetyElements: PpeItem[];
    hazardWarnings: HazardWarning[];

    // --- C. Process Steps ---
    steps: HoStep[];

    // --- D. Quality Verification (from CP) ---
    qualityChecks: HoQualityCheck[];

    // --- E. Reaction Plan ---
    reactionPlanText: string;
    reactionContact: string;

    // --- F. Visual Aids ---
    visualAids: HoVisualAid[];

    // --- G. Metadata ---
    preparedBy: string;
    approvedBy: string;
    date: string;
    revision: string;
    status: HoStatus;
    /** True when the AMFE operation for this sheet no longer exists after regeneration. */
    orphaned?: boolean;
}

// ============================================================================
// DOCUMENT (collection of all HO sheets)
// ============================================================================

/** Header metadata for the HO document collection. */
export interface HoDocumentHeader {
    formNumber: string;
    organization: string;
    client: string;
    partNumber: string;
    partDescription: string;
    /** Applicable part numbers (one per line) for product family documents. */
    applicableParts: string;
    linkedAmfeProject: string;
    linkedCpProject: string;
}

/** Top-level HO document: header + array of per-operation sheets. */
export interface HoDocument {
    header: HoDocumentHeader;
    sheets: HojaOperacion[];
}

// ============================================================================
// DEFAULTS & FACTORIES
// ============================================================================

export const EMPTY_HO_HEADER: HoDocumentHeader = {
    formNumber: 'I-IN-002.4-R01',
    organization: '',
    client: '',
    partNumber: '',
    partDescription: '',
    applicableParts: '',
    linkedAmfeProject: '',
    linkedCpProject: '',
};

export const EMPTY_HO_DOCUMENT: HoDocument = {
    header: { ...EMPTY_HO_HEADER },
    sheets: [],
};

export const DEFAULT_REACTION_PLAN_TEXT =
    'SI DETECTA "PRODUCTO" O "PROCESO" NO CONFORME:\n' +
    'DETENGA LA OPERACION\n' +
    'NOTIFIQUE DE INMEDIATO A SU LIDER O SUPERVISOR\n' +
    'ESPERE LA DEFINICION DEL LIDER O SUPERVISOR';

/** Create a blank HojaOperacion for a given AMFE operation. */
export function createEmptyHoSheet(
    amfeOpId: string,
    opNumber: string,
    opName: string,
): HojaOperacion {
    return {
        id: uuidv4(),
        amfeOperationId: amfeOpId,
        operationNumber: opNumber,
        operationName: opName,
        hoNumber: `HO-${opNumber}`,
        sector: '',
        puestoNumber: '',
        vehicleModel: '',
        partCodeDescription: '',
        safetyElements: [],
        hazardWarnings: [],
        steps: [],
        qualityChecks: [],
        reactionPlanText: DEFAULT_REACTION_PLAN_TEXT,
        reactionContact: '',
        visualAids: [],
        preparedBy: '',
        approvedBy: '',
        date: new Date().toISOString().split('T')[0],
        revision: 'A',
        status: 'borrador',
    };
}

/** Create a blank step with the given number. */
export function createEmptyStep(stepNumber: number): HoStep {
    return {
        id: uuidv4(),
        stepNumber,
        description: '',
        isKeyPoint: false,
        keyPointReason: '',
    };
}

// ============================================================================
// NORMALIZER (backward compatibility)
// ============================================================================

/** Normalize a loaded document by filling missing fields with defaults. */
export function normalizeHoDocument(raw: any): HoDocument {
    const header: HoDocumentHeader = {
        ...EMPTY_HO_HEADER,
        ...(raw.header || {}),
    };

    const sheets: HojaOperacion[] = (raw.sheets || []).map((s: any) => ({
        id: s.id || uuidv4(),
        amfeOperationId: s.amfeOperationId || '',
        operationNumber: s.operationNumber || '',
        operationName: s.operationName || '',
        hoNumber: s.hoNumber || '',
        sector: s.sector || '',
        puestoNumber: s.puestoNumber || '',
        vehicleModel: s.vehicleModel || '',
        partCodeDescription: s.partCodeDescription || '',
        safetyElements: Array.isArray(s.safetyElements) ? s.safetyElements : [],
        hazardWarnings: Array.isArray(s.hazardWarnings) ? s.hazardWarnings : [],
        steps: (s.steps || []).map((st: any) => ({
            id: st.id || uuidv4(),
            stepNumber: st.stepNumber ?? 1,
            description: st.description || '',
            isKeyPoint: st.isKeyPoint || false,
            keyPointReason: st.keyPointReason || '',
            visualAidId: st.visualAidId,
        })),
        qualityChecks: (s.qualityChecks || []).map((qc: any) => ({
            id: qc.id || uuidv4(),
            characteristic: qc.characteristic || '',
            specification: qc.specification || '',
            evaluationTechnique: qc.evaluationTechnique || '',
            frequency: qc.frequency || '',
            controlMethod: qc.controlMethod || '',
            reactionAction: qc.reactionAction || '',
            reactionContact: qc.reactionContact || '',
            specialCharSymbol: qc.specialCharSymbol || '',
            registro: qc.registro || '',
            cpItemId: qc.cpItemId,
            orphaned: qc.orphaned || false,
        })),
        reactionPlanText: s.reactionPlanText ?? DEFAULT_REACTION_PLAN_TEXT,
        reactionContact: s.reactionContact || '',
        visualAids: (s.visualAids || []).map((v: any) => ({
            id: v.id || uuidv4(),
            imageData: v.imageData || '',
            caption: v.caption || '',
            order: v.order ?? 0,
        })),
        preparedBy: s.preparedBy || '',
        approvedBy: s.approvedBy || '',
        date: s.date || '',
        revision: s.revision || '',
        status: s.status || 'borrador',
        orphaned: s.orphaned || false,
    }));

    return { header, sheets };
}
