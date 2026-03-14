/**
 * Version Check Service — Detects newer document versions on the network drive
 *
 * Compares local revision levels (from SQLite) against the sync manifest
 * on Y:\INGENIERIA. When another PC exports a newer revision, this service
 * detects the conflict and returns a list of outdated documents.
 *
 * Used on app startup or when Y: becomes available.
 *
 * @module versionCheckService
 */

import { isTauri } from './unified_fs';
import { logger } from './logger';
import { getLatestRevisionLevel, type DocumentModule } from './repositories/revisionRepository';
import {
    detectVersionConflicts,
    buildManifestKey,
    type VersionConflict,
} from './syncManifest';
import type { ExportDocModule } from './exportPathManager';

// ============================================================================
// Types
// ============================================================================

export interface VersionCheckResult {
    conflicts: VersionConflict[];
    checkedAt: string;
    checkedCount: number;
}

/** Map of module to list of document IDs to check */
export interface DocumentRegistry {
    amfe: string[];
    cp: string[];
    ho: string[];
    pfd: string[];
    solicitud: string[];
}

// ============================================================================
// Module mapping
// ============================================================================

/** Map ExportDocModule to DocumentModule (revisionRepository uses different type) */
const MODULE_MAP: Record<string, DocumentModule> = {
    amfe: 'amfe',
    cp: 'cp',
    ho: 'ho',
    pfd: 'pfd',
    solicitud: 'solicitud',
};

// ============================================================================
// Main Check
// ============================================================================

/**
 * Check all local documents against the network manifest for newer versions.
 *
 * @param registry - Map of module → documentId[] to check
 * @returns List of conflicts where network has newer revision
 */
export async function checkForNewerVersions(
    registry: DocumentRegistry,
): Promise<VersionCheckResult> {
    const result: VersionCheckResult = {
        conflicts: [],
        checkedAt: new Date().toISOString(),
        checkedCount: 0,
    };

    if (!isTauri()) return result;

    try {
        // Build local version map
        const localVersions = new Map<string, {
            module: ExportDocModule;
            documentId: string;
            revisionLevel: string;
        }>();

        for (const [module, docIds] of Object.entries(registry)) {
            const revModule = MODULE_MAP[module];
            if (!revModule) continue;

            for (const docId of docIds) {
                try {
                    const localRev = await getLatestRevisionLevel(revModule, docId);
                    const key = buildManifestKey(module as ExportDocModule, docId);
                    localVersions.set(key, {
                        module: module as ExportDocModule,
                        documentId: docId,
                        revisionLevel: localRev,
                    });
                    result.checkedCount++;
                } catch {
                    // Skip documents we can't read
                }
            }
        }

        if (localVersions.size === 0) return result;

        // Compare against manifest
        result.conflicts = await detectVersionConflicts(localVersions);

        if (result.conflicts.length > 0) {
            logger.info('VersionCheck',
                `Found ${result.conflicts.length} newer version(s) on network`,
                { conflicts: result.conflicts.map(c => `${c.module}:${c.documentId} local=${c.localRevision} remote=${c.remoteRevision}`) },
            );
        }
    } catch (err) {
        logger.error('VersionCheck', 'Failed to check for newer versions', {},
            err instanceof Error ? err : undefined);
    }

    return result;
}

/**
 * Quick check for a single document against the manifest.
 * Useful when opening a document to show inline warning.
 *
 * @returns The conflict if remote is newer, or null
 */
export async function checkSingleDocument(
    module: ExportDocModule,
    documentId: string,
    localRevisionLevel: string,
): Promise<VersionConflict | null> {
    if (!isTauri() || !documentId) return null;

    try {
        const localVersions = new Map([
            [buildManifestKey(module, documentId), {
                module,
                documentId,
                revisionLevel: localRevisionLevel,
            }],
        ]);

        const conflicts = await detectVersionConflicts(localVersions);
        return conflicts.length > 0 ? conflicts[0] : null;
    } catch {
        return null;
    }
}
