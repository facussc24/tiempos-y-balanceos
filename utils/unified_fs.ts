/**
 * Unified File System Module
 * 
 * This module provides a unified API that automatically uses:
 * - Tauri native filesystem when running as desktop app
 * - Web File System Access API when running in Chrome/Edge
 * - SQLite fallback for other browsers
 * 
 * @module unified_fs
 */

import { ProjectData, FSItem, INITIAL_PROJECT } from '../types';
import { incrementVersion } from '../utils';
import * as tauriFs from './tauri_fs';
import { logger } from './logger';

// Re-export environment detection
export const isTauri = tauriFs.isTauri;
export const hasFileSystemAccess = tauriFs.hasFileSystemAccess;

// Re-export primitive operations for ProjectExplorer
export const pickFolder = tauriFs.pickFolder;
export const readDir = tauriFs.readDir;
export const createDir = tauriFs.createDir;
export const writeTextFile = tauriFs.writeTextFile;
export const readTextFile = tauriFs.readTextFile;
export const remove = tauriFs.remove;

// ============================================================================
// INITIALIZATION
// ============================================================================

let isInitialized = false;
let currentProjectId: string | null = null;

/**
 * Initialize the unified file system
 * Call this once on app startup
 */
export const initFileSystem = async (): Promise<void> => {
    if (isInitialized) return;

    if (tauriFs.isTauri()) {
        const success = await tauriFs.initTauriModules();
        if (success) {
            logger.info('UnifiedFS', 'Running in Tauri mode');
            // Ensure projects directory exists
            const projectsDir = await tauriFs.getProjectsDir();
            if (projectsDir) {
                await tauriFs.ensureDir(projectsDir);
            }
        }
    } else if (hasFileSystemAccess()) {
        logger.info('UnifiedFS', 'Running in Web mode with File System Access API');
    } else {
        logger.info('UnifiedFS', 'Running in Web mode with SQLite only');
    }

    isInitialized = true;
};

// ============================================================================
// PROJECT OPERATIONS (Unified API)
// ============================================================================

/**
 * Get the current storage mode
 */
export const getStorageMode = (): 'tauri' | 'filesystem' | 'sqlite' => {
    if (tauriFs.isTauri()) return 'tauri';
    if (hasFileSystemAccess()) return 'filesystem';
    return 'sqlite';
};

/**
 * List all projects (from internal storage in Tauri mode)
 */
export const listProjects = async (): Promise<Array<{ id: string; name: string; lastModified: number }>> => {
    if (tauriFs.isTauri()) {
        return await tauriFs.listProjectsInAppData();
    }

    // In web mode, projects come from SQLite (handled by repositories)
    return [];
};

/**
 * Create a new project
 */
export const createProject = async (name: string): Promise<{ id: string; data: ProjectData } | null> => {
    const projectId = `project_${Date.now()}`;
    const newData: ProjectData = {
        ...INITIAL_PROJECT,
        id: parseInt(projectId.split('_')[1]) || Date.now(),
        meta: {
            ...INITIAL_PROJECT.meta,
            name,
            version: '1.0.0',
            date: new Date().toISOString().split('T')[0]
        },
        lastModified: Date.now()
    };

    if (tauriFs.isTauri()) {
        const success = await tauriFs.saveProjectToAppData(projectId, newData);
        if (success) {
            currentProjectId = projectId;
            return { id: projectId, data: newData };
        }
        return null;
    }

    // In web mode, return the data and let repositories handle persistence
    return { id: projectId, data: newData };
};

/**
 * Load a project by ID
 */
export const loadProject = async (projectId: string): Promise<ProjectData | null> => {
    if (tauriFs.isTauri()) {
        const data = await tauriFs.loadProjectFromAppData(projectId);
        if (data) {
            currentProjectId = projectId;
        }
        return data;
    }

    // In web mode, projects are loaded via db.ts
    return null;
};

/**
 * Save the current project
 */
export const saveProject = async (data: ProjectData): Promise<boolean> => {
    if (tauriFs.isTauri() && currentProjectId) {
        // Increment version
        const newData = {
            ...data,
            meta: {
                ...data.meta,
                version: incrementVersion(data.meta.version)
            },
            lastModified: Date.now()
        };

        return await tauriFs.saveProjectToAppData(currentProjectId, newData);
    }

    // In web mode, saving is handled by db.ts or utils/webFsHelpers.ts
    return false;
};

/**
 * Delete a project
 */
export const deleteProject = async (projectId: string): Promise<boolean> => {
    if (tauriFs.isTauri()) {
        return await tauriFs.deleteProjectFromAppData(projectId);
    }

    return false;
};

/**
 * Set the current project ID (for tracking which project is open)
 */
export const setCurrentProject = (projectId: string | null): void => {
    currentProjectId = projectId;
};

// ============================================================================
// MEDIA OPERATIONS (Unified API)
// ============================================================================

/**
 * Save a media file for a task
 * Returns the relative path to the saved file
 */
export const saveTaskMedia = async (file: File, taskId: string): Promise<string | null> => {
    if (tauriFs.isTauri() && currentProjectId) {
        return await tauriFs.saveMediaFile(currentProjectId, taskId, file);
    }

    // In web mode with filesystem, this is handled by utils/webFsHelpers.ts
    // Return null to indicate fallback is needed
    return null;
};

/**
 * Load a media file and return as blob URL
 */
export const loadTaskMedia = async (mediaRef: string): Promise<string | null> => {
    if (tauriFs.isTauri() && currentProjectId) {
        return await tauriFs.loadMediaFile(currentProjectId, mediaRef);
    }

    return null;
};

// ============================================================================
// DIALOG OPERATIONS (Unified API)
// ============================================================================

/**
 * Show a confirmation dialog
 */
export const confirm = async (title: string, message: string): Promise<boolean> => {
    if (tauriFs.isTauri()) {
        return await tauriFs.confirmDialog(title, message);
    }
    return window.confirm(message);
};

/**
 * Show an alert dialog
 */
export const alert = async (title: string, message: string): Promise<void> => {
    if (tauriFs.isTauri()) {
        await tauriFs.alertDialog(title, message);
        return;
    }
    window.alert(message);
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get application info for display
 */
export const getAppInfo = (): { mode: string; version: string } => {
    const mode = getStorageMode();
    const modeLabels = {
        tauri: 'Desktop App',
        filesystem: 'Web (Connected)',
        sqlite: 'Web (Local)'
    };

    return {
        mode: modeLabels[mode],
        version: '1.0.0'
    };
};
