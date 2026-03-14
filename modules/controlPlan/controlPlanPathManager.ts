/**
 * Control Plan Path Manager
 *
 * Backward-compatible API for Control Plan document CRUD.
 * Delegates to SQLite via cpRepository (primary source of truth).
 * Filesystem is used as optional backup and for transparent migration
 * of legacy JSON files into SQLite on first load.
 *
 * Pattern follows amfePathManager.ts.
 */

import { ControlPlanDocument } from './controlPlanTypes';
import {
    listCpDocuments,
    loadCpByProjectName,
    saveCpDocument,
    deleteCpByProjectName,
} from '../../utils/repositories/cpRepository';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

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
// Filesystem helpers (web-safe stubs)
// TODO: Implement via Supabase Storage if needed
// ============================================================================

/**
 * No-op stub: filesystem backup not available in web mode.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function fsBackup(_name: string, _doc: ControlPlanDocument): Promise<void> {
    // TODO: Implement via Supabase Storage if needed
}

/**
 * No-op stub: filesystem migration load not available in web mode.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function fsLoad(_name: string): Promise<ControlPlanDocument | null> {
    // TODO: Implement via Supabase Storage if needed
    return null;
}

/**
 * No-op stub: filesystem directory listing not available in web mode.
 */
async function fsList(): Promise<ControlPlanProjectInfo[]> {
    // TODO: Implement via Supabase Storage if needed
    return [];
}

/**
 * No-op stub: filesystem delete not available in web mode.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function fsDelete(_name: string): Promise<void> {
    // TODO: Implement via Supabase Storage if needed
}

// ============================================================================
// CRUD Operations — delegate to cpRepository, filesystem as backup
// ============================================================================

/**
 * List all Control Plan projects.
 * Primary: SQLite via cpRepository.
 * Merges filesystem entries that are not yet in SQLite (transparent migration).
 */
export async function listControlPlanProjects(): Promise<ControlPlanProjectInfo[]> {
    try {
        // Primary: SQLite
        const dbEntries = await listCpDocuments();
        const projects: ControlPlanProjectInfo[] = dbEntries.map(e => ({
            name: e.project_name,
            filename: `${e.project_name}.json`,
            path: `${_cpBasePath}\\${e.project_name}.json`,
            header: {
                partName: e.part_name,
                client: e.client,
                phase: e.phase,
                linkedAmfeProject: e.linked_amfe_project,
            },
        }));

        // Merge filesystem entries not yet in SQLite (migration scenario)
        const dbNames = new Set(dbEntries.map(e => e.project_name));
        const fsEntries = await fsList();
        for (const fsEntry of fsEntries) {
            if (!dbNames.has(fsEntry.name)) {
                projects.push(fsEntry);
            }
        }

        return projects;
    } catch (err) {
        logger.error('CpPath', 'Error listing projects', {}, err instanceof Error ? err : undefined);
        return [];
    }
}

/**
 * Load a Control Plan document.
 * Primary: SQLite via cpRepository.
 * Fallback: filesystem (transparent migration to SQLite on first load).
 */
export async function loadControlPlan(name: string): Promise<ControlPlanDocument | null> {
    try {
        // Primary: load from SQLite
        const result = await loadCpByProjectName(name);
        if (result) {
            return result.doc;
        }

        // Fallback: load from filesystem (migration)
        const fsDoc = await fsLoad(name);
        if (fsDoc) {
            logger.info('CpPath', `Migrating "${name}" from filesystem to SQLite`);
            // Migrate to SQLite transparently
            const id = uuidv4();
            await saveCpDocument(id, name, fsDoc);
            return fsDoc;
        }

        return null;
    } catch (err) {
        logger.error('CpPath', 'Error loading CP', {}, err instanceof Error ? err : undefined);
        return null;
    }
}

/**
 * Save a Control Plan document.
 * Primary: SQLite via cpRepository.
 * Also writes filesystem backup (best-effort).
 */
export async function saveControlPlan(name: string, data: ControlPlanDocument): Promise<boolean> {
    try {
        // Check if this project already exists in SQLite
        const existing = await loadCpByProjectName(name);
        const id = existing?.id ?? uuidv4();

        const success = await saveCpDocument(id, name, data);
        if (!success) {
            logger.error('CpPath', 'Failed to save to SQLite');
            return false;
        }

        // Best-effort filesystem backup
        await fsBackup(name, data);

        return true;
    } catch (err) {
        logger.error('CpPath', 'Save failed', {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/**
 * Delete a Control Plan document.
 * Deletes from SQLite and also attempts filesystem cleanup.
 */
export async function deleteControlPlan(name: string): Promise<boolean> {
    try {
        const success = await deleteCpByProjectName(name);
        if (!success) {
            logger.error('CpPath', 'Failed to delete from SQLite');
            return false;
        }

        // Best-effort filesystem cleanup
        await fsDelete(name);

        return true;
    } catch (err) {
        logger.error('CpPath', 'Delete failed', {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/**
 * Check if the CP path (SQLite) is accessible.
 * SQLite is always available; filesystem check is not available in web mode.
 * TODO: Implement via Supabase Storage if needed
 */
export async function isCpPathAccessible(): Promise<boolean> {
    // SQLite is always accessible in web mode
    return true;
}
