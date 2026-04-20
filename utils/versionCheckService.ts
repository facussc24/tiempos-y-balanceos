/**
 * Version Check Service
 *
 * Historically compared local SQLite revision levels against the Y: drive
 * manifest to detect newer exports from other PCs. The web build uses
 * Supabase as the single source of truth, so this is a no-op stub.
 *
 * @module versionCheckService
 */

import type { VersionConflict } from './syncManifest';
import type { ExportDocModule } from './exportPathManager';

// ============================================================================
// Types
// ============================================================================

export interface VersionCheckResult {
    conflicts: VersionConflict[];
    checkedAt: string;
    checkedCount: number;
}

export interface DocumentRegistry {
    amfe: string[];
    cp: string[];
    ho: string[];
    pfd: string[];
    solicitud: string[];
}

// ============================================================================
// Public API — Web-mode stubs
// ============================================================================

export async function checkForNewerVersions(
    _registry: DocumentRegistry,
): Promise<VersionCheckResult> {
    return {
        conflicts: [],
        checkedAt: new Date().toISOString(),
        checkedCount: 0,
    };
}

export async function checkSingleDocument(
    _module: ExportDocModule,
    _documentId: string,
    _localRevisionLevel: string,
): Promise<VersionConflict | null> {
    return null;
}
