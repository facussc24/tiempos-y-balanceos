/**
 * Cross-Document Alert Detection
 *
 * Pure detection engine that checks for upstream document changes
 * using the APQP cascade model (PFD → AMFE → CP → HO).
 *
 * @module crossDocumentAlerts
 */

import type { DocumentModule } from './revisionUtils';
import { getPendingAlerts, type CrossDocCheckRow } from './repositories/crossDocRepository';
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
