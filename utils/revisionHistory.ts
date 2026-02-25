/**
 * Revision History Utility
 * 
 * Parses the Obsoletos folder to extract version history.
 * Provides functions to list, preview, and restore revisions.
 * 
 * @module revisionHistory
 */

import * as tauriFs from './tauri_fs';
import { ProjectData } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface RevisionInfo {
    filename: string;
    path: string;
    projectName: string;
    version: string;
    timestamp: Date;
    timestampStr: string;
    sizeBytes?: number;
}

export interface RevisionParseResult {
    revisions: RevisionInfo[];
    errors: string[];
}

// ============================================================================
// PARSING
// ============================================================================

/**
 * Parse filename to extract revision info
 * Expected format: ProjectName_1.0.0_2024-12-14T10-30-00-000Z.json
 */
export function parseRevisionFilename(filename: string): RevisionInfo | null {
    // Remove .json extension
    if (!filename.endsWith('.json')) return null;
    const baseName = filename.slice(0, -5);

    // Split by underscore - last part is timestamp, second-to-last is version
    const parts = baseName.split('_');
    if (parts.length < 3) return null;

    const timestampStr = parts.pop()!;
    const version = parts.pop()!;
    const projectName = parts.join('_');

    // Parse timestamp (ISO format with dashes instead of colons)
    const isoTimestamp = timestampStr
        .replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, ':$1:$2.$3Z')
        .replace(/T(\d{2})-/, 'T$1:');

    const timestamp = new Date(isoTimestamp);
    if (isNaN(timestamp.getTime())) {
        // Try simpler parsing
        return null;
    }

    return {
        filename,
        path: '', // Set by caller
        projectName,
        version,
        timestamp,
        timestampStr: timestamp.toLocaleString('es-AR', {
            dateStyle: 'medium',
            timeStyle: 'short'
        })
    };
}

/**
 * List all revisions in the Obsoletos folder
 */
export async function listRevisions(obsoletosPath: string): Promise<RevisionParseResult> {
    const revisions: RevisionInfo[] = [];
    const errors: string[] = [];

    try {
        const entries = await tauriFs.readDir(obsoletosPath);

        for (const entry of entries) {
            if (!entry.isDirectory && entry.name.endsWith('.json')) {
                const parsed = parseRevisionFilename(entry.name);
                if (parsed) {
                    parsed.path = entry.path;
                    revisions.push(parsed);
                } else {
                    errors.push(`Could not parse: ${entry.name}`);
                }
            }
        }

        // Sort by timestamp, newest first
        revisions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    } catch (err) {
        errors.push(`Error reading Obsoletos folder: ${err}`);
    }

    return { revisions, errors };
}

/**
 * Load a revision for preview (without fully loading into app)
 */
export async function loadRevisionPreview(revisionPath: string): Promise<{
    data: ProjectData | null;
    error?: string;
}> {
    try {
        const content = await tauriFs.readTextFile(revisionPath);
        if (!content) {
            return { data: null, error: 'Could not read file' };
        }

        const data = JSON.parse(content) as ProjectData;
        return { data };
    } catch (err) {
        return { data: null, error: `Parse error: ${err}` };
    }
}

/**
 * Restore a revision as the current project file
 * Creates a backup of current file first
 */
export async function restoreRevision(
    revisionPath: string,
    currentFilePath: string,
    obsoletosPath: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // 1. Read revision content
        const revisionContent = await tauriFs.readTextFile(revisionPath);
        if (!revisionContent) {
            return { success: false, error: 'Could not read revision file' };
        }

        // 2. Read current file for backup
        const currentContent = await tauriFs.readTextFile(currentFilePath);

        // 3. Create backup of current file
        if (currentContent) {
            const currentData = JSON.parse(currentContent) as ProjectData;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = `${currentData.meta.name || 'project'}_${currentData.meta.version || '0.0.0'}_${timestamp}.json`;
            await tauriFs.writeTextFile(`${obsoletosPath}/${backupName}`, currentContent);
        }

        // 4. Parse revision and increment version
        const revisionData = JSON.parse(revisionContent) as ProjectData;
        const restoredData: ProjectData = {
            ...revisionData,
            meta: {
                ...revisionData.meta,
                version: `${revisionData.meta.version}-restored`,
                modifiedBy: `Restaurado el ${new Date().toLocaleString('es-AR')}`
            },
            lastModified: Date.now()
        };

        // 5. Write restored data to current file
        const { fileHandle: _, directoryHandle: __, _loadedTimestamp: ___, _checksum: ____, ...serializableData } = restoredData;
        await tauriFs.writeTextFile(currentFilePath, JSON.stringify(serializableData, null, 2));

        return { success: true };
    } catch (err) {
        return { success: false, error: `Restore failed: ${err}` };
    }
}

// ============================================================================
// UTILITY
// ============================================================================

/**
 * Get Obsoletos folder path from project directory
 */
export function getObsoletosPath(projectDirPath: string): string {
    return `${projectDirPath}/Obsoletos`;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
