/**
 * Sync Manifest — Tracks exported document versions on the network drive
 *
 * The manifest file (_sync_manifest.json) lives at the root of the export
 * base path (e.g. Y:\INGENIERIA\_sync_manifest.json). It records which
 * documents have been exported, at what revision level, and from which PC.
 *
 * Used for:
 * - Duplicate prevention: skip re-exporting same revision
 * - Version conflict detection: detect newer revisions exported from other PCs
 * - Audit trail: who exported what and when
 *
 * @module syncManifest
 */

import { logger } from './logger';
import { isTauri } from './unified_fs';
import { isPathAccessible } from './storageManager';
import { getExportBasePath, UNC_EXPORT_FALLBACK, buildManifestPath } from './exportPathManager';
import type { ExportDocModule } from './exportPathManager';

// ============================================================================
// Types
// ============================================================================

export interface SyncManifestEntry {
    module: ExportDocModule;
    documentId: string;
    client: string;
    piece: string;
    pieceName: string;
    revisionLevel: string;
    filenames: string[];      // Excel + PDF filenames
    exportedAt: string;       // ISO timestamp
    exportedBy: string;       // PC hostname
}

export interface SyncManifest {
    version: 1;
    lastUpdated: string;
    entries: Record<string, SyncManifestEntry>; // key = `${module}:${documentId}`
}

export interface VersionConflict {
    module: ExportDocModule;
    documentId: string;
    localRevision: string;
    remoteRevision: string;
    exportedBy: string;
    exportedAt: string;
}

// ============================================================================
// Constants
// ============================================================================

const EMPTY_MANIFEST: SyncManifest = {
    version: 1,
    lastUpdated: new Date().toISOString(),
    entries: {},
};

// ============================================================================
// Manifest Key
// ============================================================================

/**
 * Build the unique key for a manifest entry.
 */
export function buildManifestKey(module: ExportDocModule, documentId: string): string {
    return `${module}:${documentId}`;
}

// ============================================================================
// Read Manifest
// ============================================================================

/**
 * Read the sync manifest from the export base path.
 * Returns empty manifest if file doesn't exist or can't be read.
 */
export async function readManifest(basePath?: string): Promise<SyncManifest> {
    if (!isTauri()) return { ...EMPTY_MANIFEST, entries: {} };

    try {
        const resolvedBase = basePath ?? await resolveAvailableBase();
        if (!resolvedBase) return { ...EMPTY_MANIFEST, entries: {} };

        const manifestPath = buildManifestPath(resolvedBase);
        const fs = await import('./unified_fs');

        try {
            const content = await fs.readTextFile(manifestPath) ?? '';
            const parsed = JSON.parse(content) as SyncManifest;

            // Basic validation
            if (parsed.version !== 1 || typeof parsed.entries !== 'object') {
                logger.warn('SyncManifest', 'Invalid manifest format, returning empty');
                return { ...EMPTY_MANIFEST, entries: {} };
            }

            return parsed;
        } catch {
            // File doesn't exist yet — that's fine
            return { ...EMPTY_MANIFEST, entries: {} };
        }
    } catch (err) {
        logger.error('SyncManifest', 'Failed to read manifest', {},
            err instanceof Error ? err : undefined);
        return { ...EMPTY_MANIFEST, entries: {} };
    }
}

// ============================================================================
// Write Manifest
// ============================================================================

/**
 * Write the sync manifest to the export base path.
 * Creates the file if it doesn't exist.
 */
export async function writeManifest(manifest: SyncManifest, basePath?: string): Promise<boolean> {
    if (!isTauri()) return false;

    try {
        const resolvedBase = basePath ?? await resolveAvailableBase();
        if (!resolvedBase) return false;

        const manifestPath = buildManifestPath(resolvedBase);
        const fs = await import('./unified_fs');

        manifest.lastUpdated = new Date().toISOString();
        const content = JSON.stringify(manifest, null, 2);
        await fs.writeFile(manifestPath, new TextEncoder().encode(content));

        return true;
    } catch (err) {
        logger.error('SyncManifest', 'Failed to write manifest', {},
            err instanceof Error ? err : undefined);
        return false;
    }
}

// ============================================================================
// Update Entry
// ============================================================================

/**
 * Update or create a manifest entry after a successful export.
 * Reads the current manifest, updates the entry, and writes back.
 *
 * @returns true if manifest was updated successfully
 */
export async function updateManifestEntry(
    module: ExportDocModule,
    documentId: string,
    client: string,
    piece: string,
    pieceName: string,
    revisionLevel: string,
    filenames: string[],
    basePath?: string,
): Promise<boolean> {
    if (!documentId) return false; // Can't track without an ID

    try {
        const resolvedBase = basePath ?? await resolveAvailableBase();
        if (!resolvedBase) return false;

        const manifest = await readManifest(resolvedBase);
        const key = buildManifestKey(module, documentId);

        manifest.entries[key] = {
            module,
            documentId,
            client,
            piece,
            pieceName,
            revisionLevel,
            filenames,
            exportedAt: new Date().toISOString(),
            exportedBy: getHostname(),
        };

        return await writeManifest(manifest, resolvedBase);
    } catch (err) {
        logger.error('SyncManifest', 'Failed to update manifest entry', {},
            err instanceof Error ? err : undefined);
        return false;
    }
}

// ============================================================================
// Duplicate Detection
// ============================================================================

/**
 * Check if a document at the given revision has already been exported.
 * Used to prevent writing identical files twice.
 *
 * @returns true if the same revision was already exported (skip export)
 */
export async function isDuplicateExport(
    module: ExportDocModule,
    documentId: string,
    revisionLevel: string,
    basePath?: string,
): Promise<boolean> {
    if (!documentId) return false;

    try {
        const resolvedBase = basePath ?? await resolveAvailableBase();
        if (!resolvedBase) return false;

        const manifest = await readManifest(resolvedBase);
        const key = buildManifestKey(module, documentId);
        const entry = manifest.entries[key];

        if (!entry) return false;
        return entry.revisionLevel === revisionLevel;
    } catch {
        // If we can't check, assume not duplicate (safer to re-export)
        return false;
    }
}

// ============================================================================
// Version Conflict Detection
// ============================================================================

/**
 * Compare local document revision levels against the manifest on Y:.
 * Returns a list of documents where the network has a newer revision.
 *
 * @param localVersions — Map of `${module}:${documentId}` → local revision level
 * @returns List of conflicts where remote is newer than local
 */
export async function detectVersionConflicts(
    localVersions: Map<string, { module: ExportDocModule; documentId: string; revisionLevel: string }>,
    basePath?: string,
): Promise<VersionConflict[]> {
    if (!isTauri() || localVersions.size === 0) return [];

    try {
        const resolvedBase = basePath ?? await resolveAvailableBase();
        if (!resolvedBase) return [];

        const manifest = await readManifest(resolvedBase);
        const { isNewerRevision } = await import('./revisionUtils');
        const conflicts: VersionConflict[] = [];

        for (const [key, local] of localVersions) {
            const remote = manifest.entries[key];
            if (!remote) continue;

            // If remote revision is newer than local, that's a conflict
            if (isNewerRevision(remote.revisionLevel, local.revisionLevel)) {
                conflicts.push({
                    module: local.module,
                    documentId: local.documentId,
                    localRevision: local.revisionLevel,
                    remoteRevision: remote.revisionLevel,
                    exportedBy: remote.exportedBy,
                    exportedAt: remote.exportedAt,
                });
            }
        }

        return conflicts;
    } catch (err) {
        logger.error('SyncManifest', 'Failed to detect version conflicts', {},
            err instanceof Error ? err : undefined);
        return [];
    }
}

/**
 * Get the manifest entry for a specific document.
 * Useful for checking what revision is on the network.
 */
export async function getManifestEntry(
    module: ExportDocModule,
    documentId: string,
    basePath?: string,
): Promise<SyncManifestEntry | null> {
    try {
        const resolvedBase = basePath ?? await resolveAvailableBase();
        if (!resolvedBase) return null;

        const manifest = await readManifest(resolvedBase);
        const key = buildManifestKey(module, documentId);
        return manifest.entries[key] || null;
    } catch {
        return null;
    }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Resolve the first available base path (configured → Y: → UNC).
 */
async function resolveAvailableBase(): Promise<string | null> {
    const configured = await getExportBasePath();
    if (await isPathAccessible(configured, 2000)) return configured;
    if (await isPathAccessible(UNC_EXPORT_FALLBACK, 3000)) return UNC_EXPORT_FALLBACK;
    return null;
}

/**
 * Get the hostname of the current PC.
 * Falls back to 'unknown' if not available.
 */
function getHostname(): string {
    try {
        // In Tauri, we can try to get the hostname from environment
        // This is a best-effort approach
        if (typeof globalThis !== 'undefined' && 'navigator' in globalThis) {
            // Use a combination of identifiers for uniqueness
            return globalThis.navigator?.userAgent?.match(/Windows NT [^;)]+/)?.[0] || 'PC';
        }
        return 'PC';
    } catch {
        return 'PC';
    }
}

// Export for testing
export { getHostname as _getHostname };
