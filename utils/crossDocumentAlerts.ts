/**
 * Cross-Document Alert Detection
 *
 * Pure detection engine that checks for upstream document changes
 * using the APQP cascade model (PFD → AMFE → CP → HO).
 *
 * @module crossDocumentAlerts
 */

import type { DocumentModule } from './revisionUtils';
import { getPendingAlerts, upsertCrossDocCheck, type CrossDocCheckRow } from './repositories/crossDocRepository';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CrossDocAlert {
    severity: 'warning';
    code: string;
    message: string;
    sourceModule: DocumentModule;
    sourceDocId: string;
    sourceRevision: string;
}

// ---------------------------------------------------------------------------
// APQP Cascade
// ---------------------------------------------------------------------------

/** APQP cascade: who needs to be notified when a module changes */
export const APQP_CASCADE: { source: DocumentModule; targets: DocumentModule[] }[] = [
    { source: 'pfd',  targets: ['amfe'] },
    { source: 'amfe', targets: ['cp', 'ho', 'pfd'] },
    { source: 'cp',   targets: ['ho'] },
];

// ---------------------------------------------------------------------------
// Module display names (Spanish)
// ---------------------------------------------------------------------------

const MODULE_NAMES: Record<DocumentModule, string> = {
    pfd:      'Diagrama de Flujo (PFD)',
    amfe:     'AMFE',
    cp:       'Plan de Control',
    ho:       'Hoja de Operaciones',
    solicitud: 'Solicitud de Cambio',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the downstream targets for a given module from APQP_CASCADE.
 */
export function getDownstreamTargets(sourceModule: DocumentModule): DocumentModule[] {
    const entry = APQP_CASCADE.find(c => c.source === sourceModule);
    return entry ? entry.targets : [];
}

/**
 * Given a module+docId that was just opened, check if any upstream docs changed.
 * Returns an array of user-friendly alerts (in Spanish).
 */
export async function detectCrossDocAlerts(
    currentModule: DocumentModule,
    currentDocId: string,
): Promise<CrossDocAlert[]> {
    try {
        const pending = await getPendingAlerts(currentModule, currentDocId);

        return pending.map((check: CrossDocCheckRow) => {
            const sourceName = MODULE_NAMES[check.sourceModule as DocumentModule] ?? check.sourceModule;
            return {
                severity: 'warning' as const,
                code: `CROSS_DOC_${check.sourceModule.toUpperCase()}_CHANGED`,
                message: `El documento ${sourceName} fue actualizado a Rev. ${check.sourceRevision}. Revise si este documento necesita actualizarse.`,
                sourceModule: check.sourceModule as DocumentModule,
                sourceDocId: check.sourceDocId,
                sourceRevision: check.sourceRevision,
            };
        });
    } catch (err) {
        logger.error('CrossDocAlerts', `Failed to detect alerts for ${currentModule}/${currentDocId}`, {}, err instanceof Error ? err : undefined);
        return [];
    }
}

// ---------------------------------------------------------------------------
// Cross-Family Alerts (process-master AMFE → product AMFEs in other families)
// ---------------------------------------------------------------------------

/**
 * Parameters for creating a cross-family alert entry.
 *
 * NOTE: The current `cross_doc_checks` table schema only has columns for
 * source_module/source_doc_id/target_module/target_doc_id/source_revision/
 * source_updated. The list of matched operation names is logged here but NOT
 * persisted — a later migration can add a `details` JSON column if the UI
 * needs to show which operations matched. For now we emit a single alert per
 * affected document reusing the existing module-level alert mechanism.
 *
 * TODO: add a `details` column to cross_doc_checks to carry matched op names
 * and the originating process-family name (so the UI can differentiate cascade
 * alerts vs. cross-family alerts).
 */
export interface CreateCrossFamilyAlertParams {
    sourceMasterId: string;
    targetDocId: string;
    matchedOperationNames: string[];
    familyName: string;
    sourceRevision: string;
    sourceUpdated: string;
}

/**
 * Insert a cross-family AMFE alert row. Returns true on success, false on
 * failure. Never throws — fire-and-forget safe.
 */
export async function createCrossFamilyAlert(params: CreateCrossFamilyAlertParams): Promise<boolean> {
    try {
        await upsertCrossDocCheck(
            'amfe',
            params.sourceMasterId,
            'amfe',
            params.targetDocId,
            params.sourceRevision,
            params.sourceUpdated,
        );
        logger.info('CrossDocAlerts', 'Cross-family alert created', {
            sourceMasterId: params.sourceMasterId,
            targetDocId: params.targetDocId,
            familyName: params.familyName,
            matchedCount: params.matchedOperationNames.length,
            matched: params.matchedOperationNames,
        });
        return true;
    } catch (err) {
        logger.error(
            'CrossDocAlerts',
            `Failed to create cross-family alert ${params.sourceMasterId}→${params.targetDocId}`,
            { matched: params.matchedOperationNames },
            err instanceof Error ? err : undefined,
        );
        return false;
    }
}
