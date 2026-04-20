/**
 * Sync Manifest — Tracks exported document versions on the network drive
 *
 * The manifest (_sync_manifest.json) lived at the root of the Tauri export
 * base path and tracked duplicate exports and remote revision conflicts.
 * The web build has no export-to-shared-drive workflow, so the public API
 * is kept as no-op stubs.
 *
 * @module syncManifest
 */

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
    filenames: string[];
    exportedAt: string;
    exportedBy: string;
}

export interface SyncManifest {
    version: 1;
    lastUpdated: string;
    entries: Record<string, SyncManifestEntry>;
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
// Public API — Web-mode stubs
// ============================================================================

export function buildManifestKey(module: ExportDocModule, documentId: string): string {
    return `${module}:${documentId}`;
}

export async function readManifest(_basePath?: string): Promise<SyncManifest> {
    return { version: 1, lastUpdated: new Date().toISOString(), entries: {} };
}

export async function writeManifest(_manifest: SyncManifest, _basePath?: string): Promise<boolean> {
    return false;
}

export async function updateManifestEntry(
    _module: ExportDocModule,
    _documentId: string,
    _client: string,
    _piece: string,
    _pieceName: string,
    _revisionLevel: string,
    _filenames: string[],
    _basePath?: string,
): Promise<boolean> {
    return false;
}

export async function isDuplicateExport(
    _module: ExportDocModule,
    _documentId: string,
    _revisionLevel: string,
    _basePath?: string,
): Promise<boolean> {
    return false;
}

export async function detectVersionConflicts(
    _localVersions: Map<string, { module: ExportDocModule; documentId: string; revisionLevel: string }>,
    _basePath?: string,
): Promise<VersionConflict[]> {
    return [];
}

export async function getManifestEntry(
    _module: ExportDocModule,
    _documentId: string,
    _basePath?: string,
): Promise<SyncManifestEntry | null> {
    return null;
}

// Export for testing
export function _getHostname(): string {
    return 'PC';
}
