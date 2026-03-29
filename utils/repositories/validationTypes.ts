/**
 * Shared types for pre-save validation results.
 */

export interface SaveValidationResult {
    /** Whether the document passes all blocking validations. */
    valid: boolean;
    /** Blocking issues that prevent save. */
    errors: string[];
    /** Non-blocking advisories. */
    warnings: string[];
}
