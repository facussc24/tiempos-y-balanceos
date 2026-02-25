/**
 * Control Plan Suggestion Types
 *
 * Type definitions for CP-specific AI suggestions.
 * Separate from AMFE suggestion types as CP uses flat item context
 * instead of the hierarchical 6M tree.
 */

/** Fields eligible for AI suggestions in the Control Plan */
export type CpSuggestionField =
    | 'controlMethod'
    | 'evaluationTechnique'
    | 'sampleSize'
    | 'sampleFrequency'
    | 'reactionPlan';

/** Context for CP AI suggestions (derived from ControlPlanItem + header) */
export interface CpSuggestionContext {
    processDescription?: string;
    machineDeviceTool?: string;
    productCharacteristic?: string;
    processCharacteristic?: string;
    specialCharClass?: string;
    specification?: string;
    controlMethod?: string;
    evaluationTechnique?: string;
    amfeAp?: string;
    amfeSeverity?: number;
    phase?: string;
    operationCategory?: string;
    existingValues?: string[];
}

/** Set of CP fields that support AI suggestions */
export const CP_AI_FIELDS = new Set<string>([
    'controlMethod',
    'evaluationTechnique',
    'sampleSize',
    'sampleFrequency',
    'reactionPlan',
]);
