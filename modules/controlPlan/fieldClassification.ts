/**
 * Field Classification: Inherited vs Local
 *
 * Defines which fields on CP items and HO quality checks come from upstream
 * documents (AMFE → CP, CP → HO) and which are local user-entered data.
 *
 * - Inherited fields: updated automatically when regenerating from AMFE/CP.
 * - Local fields: NEVER overwritten on regeneration (user data preserved).
 *
 * This classification is used by the merge functions in controlPlanGenerator.ts
 * and hojaOperacionesGenerator.ts to preserve manual edits during regeneration.
 *
 * Note: `autoFilledFields[]` is orthogonal to this classification. A field can
 * be "local" (not overwritten by inherited data) AND have an auto-suggested value
 * (listed in autoFilledFields). The merge rule is:
 *   - If a local field has a value AND is NOT in autoFilledFields → preserve it.
 *   - If a local field is in autoFilledFields or empty → update with new suggestion.
 */

import type { ControlPlanItem } from './controlPlanTypes';
import type { HoQualityCheck, HojaOperacion } from '../hojaOperaciones/hojaOperacionesTypes';

// ============================================================================
// CP FIELD CLASSIFICATION
// ============================================================================

/** Fields updated from AMFE on CP regeneration. */
export const CP_INHERITED_FIELDS: readonly (keyof ControlPlanItem)[] = [
    'processStepNumber',
    'processDescription',
    'productCharacteristic',
    'processCharacteristic',
    'specialCharClass',
    'characteristicNumber',
    'amfeFailureId',
    'amfeSeverity',
    'amfeAp',
    'amfeCauseIds',
    'amfeFailureIds',
    'operationCategory',
    'machineDeviceTool',
] as const;

/** Fields entered by the user — NEVER overwritten on regeneration. */
export const CP_LOCAL_FIELDS: readonly (keyof ControlPlanItem)[] = [
    'specification',
    'sampleSize',
    'sampleFrequency',
    'evaluationTechnique',
    'reactionPlan',
    'reactionPlanOwner',
    'componentMaterial',
    'controlMethod',
    'controlProcedure',
] as const;

/** Quick lookup set for inherited fields. */
export const CP_INHERITED_SET = new Set<string>(CP_INHERITED_FIELDS);

/** Quick lookup set for local fields. */
export const CP_LOCAL_SET = new Set<string>(CP_LOCAL_FIELDS);

// ============================================================================
// HO QUALITY CHECK FIELD CLASSIFICATION
// ============================================================================

/** HO QC fields updated from CP on HO regeneration. */
export const HO_QC_INHERITED_FIELDS: readonly (keyof HoQualityCheck)[] = [
    'characteristic',
    'specification',
    'evaluationTechnique',
    'frequency',
    'controlMethod',
    'reactionAction',
    'reactionContact',
    'specialCharSymbol',
    'cpItemId',
] as const;

/** HO QC fields entered by the user — NEVER overwritten. */
export const HO_QC_LOCAL_FIELDS: readonly (keyof HoQualityCheck)[] = [
    'registro',
] as const;

/** Quick lookup set for HO QC inherited fields. */
export const HO_QC_INHERITED_SET = new Set<string>(HO_QC_INHERITED_FIELDS);

// ============================================================================
// HO SHEET FIELD CLASSIFICATION
// ============================================================================

/** HO sheet fields updated from AMFE/CP on regeneration. */
export const HO_SHEET_INHERITED_FIELDS: readonly (keyof HojaOperacion)[] = [
    'amfeOperationId',
    'operationNumber',
    'operationName',
    'hoNumber',
    'partCodeDescription',
    'vehicleModel',
    'reactionContact',
] as const;

/** HO sheet fields entered by the user — NEVER overwritten. */
export const HO_SHEET_LOCAL_FIELDS: readonly (keyof HojaOperacion)[] = [
    'steps',
    'visualAids',
    'safetyElements',
    'hazardWarnings',
    'sector',
    'puestoNumber',
    'preparedBy',
    'approvedBy',
    'date',
    'revision',
    'status',
    'reactionPlanText',
] as const;

/** Quick lookup set for HO sheet inherited fields. */
export const HO_SHEET_INHERITED_SET = new Set<string>(HO_SHEET_INHERITED_FIELDS);
