/**
 * Export Health Check
 *
 * Historically validated/repaired the Y:\INGENIERIA folder structure on the
 * Tauri desktop build. The web build has no local filesystem, so the public
 * API is kept as no-op stubs.
 *
 * @module exportHealthCheck
 */

import type { ExportDocModule } from './exportPathManager';

// ============================================================================
// Types
// ============================================================================

export interface HealthCheckResult {
    healthy: boolean;
    accessible: boolean;
    resolvedBasePath: string | null;
    missing: MissingFolder[];
    message: string;
}

export interface MissingFolder {
    module: ExportDocModule;
    folderName: string;
    expectedPath: string;
}

export interface RepairResult {
    created: string[];
    errors: Array<{ path: string; error: string }>;
}

// ============================================================================
// Public API — Web-mode stubs
// ============================================================================

export async function validateExportStructure(_basePath?: string): Promise<HealthCheckResult> {
    return {
        healthy: true,
        accessible: false,
        resolvedBasePath: null,
        missing: [],
        message: 'Modo web — validación de estructura no aplica',
    };
}

export async function repairExportStructure(
    _missing: MissingFolder[],
    _basePath?: string,
): Promise<RepairResult> {
    return { created: [], errors: [] };
}

export async function runExportHealthCheck(): Promise<HealthCheckResult> {
    return validateExportStructure();
}

export async function validateAndRepair(): Promise<RepairResult> {
    return { created: [], errors: [] };
}
