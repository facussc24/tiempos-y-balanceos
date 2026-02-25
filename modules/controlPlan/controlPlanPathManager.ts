/**
 * Control Plan Path Manager
 *
 * Persistence for Control Plan documents on the network drive.
 * Default path: Y:\Ingenieria\Documentacion Gestion Ingenieria\19. Plan de Control
 *
 * Now uses configurable base path (via settingsStore) and atomic saves
 * (temp → verify → rename) matching amfePathManager pattern.
 */

import { readTextFile, writeTextFile, readDir, mkdir, remove, exists, rename } from '@tauri-apps/plugin-fs';
import { ControlPlanDocument, normalizeControlPlanDocument } from './controlPlanTypes';
import { logger } from '../../utils/logger';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CP_BASE_PATH = 'Y:\\Ingenieria\\Documentacion Gestion Ingenieria\\19. Plan de Control';

/** Runtime override (set via setCpBasePath) */
let _cpBasePath: string = DEFAULT_CP_BASE_PATH;

/**
 * Get the current CP base path.
 */
export function getCpBasePath(): string {
    return _cpBasePath;
}

/**
 * Set the CP base path at runtime.
 */
export function setCpBasePath(path: string): void {
    _cpBasePath = path || DEFAULT_CP_BASE_PATH;
}

/**
 * Initialize CP base path from settings store.
 * Call once on app startup.
 */
export async function initCpBasePath(): Promise<void> {
    try {
        const { loadSettings } = await import('../../utils/settingsStore');
        const settings = await loadSettings();
        if (settings.cpBasePath) {
            _cpBasePath = settings.cpBasePath;
        }
    } catch {
        // Fallback to default
    }
}

// ============================================================================
// Types
// ============================================================================

export interface ControlPlanProjectInfo {
    name: string;
    filename: string;
    path: string;
    header?: {
        partName?: string;
        client?: string;
        phase?: string;
        linkedAmfeProject?: string;
    };
}

// ============================================================================
// Helpers
// ============================================================================

async function ensureCpDir(): Promise<boolean> {
    try {
        const dirExists = await exists(_cpBasePath);
        if (!dirExists) {
            await mkdir(_cpBasePath, { recursive: true });
        }
        return true;
    } catch (err) {
        logger.error('[ControlPlan] Error ensuring directory:', err);
        return false;
    }
}

// ============================================================================
// CRUD Operations
// ============================================================================

export async function listControlPlanProjects(): Promise<ControlPlanProjectInfo[]> {
    try {
        await ensureCpDir();
        const entries = await readDir(_cpBasePath);
        const projects: ControlPlanProjectInfo[] = [];

        // Cleanup orphaned temp files from interrupted saves
        for (const entry of entries) {
            if (entry.name?.endsWith('.tmp.json')) {
                try { await remove(`${_cpBasePath}\\${entry.name}`); } catch { /* ignore */ }
            }
        }

        for (const entry of entries) {
            if (entry.name && entry.name.endsWith('.json') && !entry.name.endsWith('.tmp.json')) {
                const name = entry.name.replace('.json', '');
                const filePath = `${_cpBasePath}\\${entry.name}`;

                let header: any = {};
                try {
                    const content = await readTextFile(filePath);
                    const parsed = JSON.parse(content);
                    header = parsed.header || {};
                } catch { /* skip corrupted files */ }

                projects.push({
                    name,
                    filename: entry.name,
                    path: filePath,
                    header: {
                        partName: header.partName || '',
                        client: header.client || '',
                        phase: header.phase || '',
                        linkedAmfeProject: header.linkedAmfeProject || '',
                    },
                });
            }
        }

        return projects;
    } catch (err) {
        logger.error('[ControlPlan] Error listing projects:', err);
        return [];
    }
}

export async function loadControlPlan(name: string): Promise<ControlPlanDocument | null> {
    try {
        const filePath = `${_cpBasePath}\\${name}.json`;
        const content = await readTextFile(filePath);
        return normalizeControlPlanDocument(JSON.parse(content));
    } catch (err) {
        logger.error('[ControlPlan] Error loading:', err);
        return null;
    }
}

/**
 * Save a Control Plan document using atomic write (temp → verify → rename).
 * Prevents data corruption if the write is interrupted (e.g. network failure).
 */
export async function saveControlPlan(name: string, data: ControlPlanDocument): Promise<boolean> {
    try {
        await ensureCpDir();
        const filePath = `${_cpBasePath}\\${name}.json`;
        const tempPath = `${_cpBasePath}\\${name}.tmp.json`;
        const content = JSON.stringify(data, null, 2);

        // Step 1: Write to temp file
        await writeTextFile(tempPath, content);

        // Step 2: Verify temp file is valid JSON
        try {
            const verification = await readTextFile(tempPath);
            JSON.parse(verification); // throws if corrupted
        } catch (verifyErr) {
            logger.error('[ControlPlan] Temp file verification failed, aborting save:', verifyErr);
            try { await remove(tempPath); } catch { /* cleanup best-effort */ }
            return false;
        }

        // Step 3: Atomic rename temp → final
        try {
            await rename(tempPath, filePath);
        } catch {
            // Fallback: some filesystems don't support rename-over-existing
            // Write directly (less safe but better than failing)
            await writeTextFile(filePath, content);
            try { await remove(tempPath); } catch { /* cleanup */ }
        }

        return true;
    } catch (err) {
        logger.error('[ControlPlan] Error saving:', err);
        return false;
    }
}

export async function deleteControlPlan(name: string): Promise<boolean> {
    try {
        const filePath = `${_cpBasePath}\\${name}.json`;
        await remove(filePath);
        return true;
    } catch (err) {
        logger.error('[ControlPlan] Error deleting:', err);
        return false;
    }
}

export async function isCpPathAccessible(): Promise<boolean> {
    try {
        return await exists(_cpBasePath);
    } catch {
        return false;
    }
}
