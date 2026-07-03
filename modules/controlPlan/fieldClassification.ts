/**
 * Field Classification: Inherited vs Local
 *
 * Defines which fields on CP items come from upstream documents (AMFE → CP)
 * and which are local user-entered data.
 *
 * - Inherited fields: updated automatically when regenerating from AMFE/CP.
 * - Local fields: NEVER overwritten on regeneration (user data preserved).
 *
 * This classification is used by the merge functions in controlPlanGenerator.ts
 * to preserve manual edits during regeneration.
 *
 * Note: `autoFilledFields[]` is orthogonal to this classification. A field can
 * be "local" (not overwritten by inherited data) AND have an auto-suggested value
 * (listed in autoFilledFields). The merge rule is:
 *   - If a local field has a value AND is NOT in autoFilledFields → preserve it.
 *   - If a local field is in autoFilledFields or empty → update with new suggestion.
 */

import type { ControlPlanItem } from './controlPlanTypes';

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
