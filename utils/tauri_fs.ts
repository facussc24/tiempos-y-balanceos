/**
 * Tauri File System Module
 * 
 * This module provides a unified API for file operations that works in both:
 * - Tauri desktop app (uses native filesystem via plugins)
 * - Web browser (falls back to File System Access API or in-memory)
 * 
 * @module tauri_fs
 */

import { ProjectData } from '../types';
import { logger } from './logger';

// ============================================================================
// ENVIRONMENT DETECTION
// ============================================================================

/**
 * Check if running inside Tauri desktop app
 * Tauri v2 uses __TAURI_INTERNALS__, Tauri v1 uses __TAURI__
 */
export const isTauri = (): boolean => {
    if (typeof window === 'undefined') return false;

    // Tauri v2 detection
    if ('__TAURI_INTERNALS__' in window) return true;

    // Tauri v1 fallback
    if ('__TAURI__' in window) return true;

    // Additional check: Tauri IPC
    if ('__TAURI_IPC__' in window) return true;

    return false;
};

/**
 * Check if File System Access API is available (Chrome/Edge)
 */
export const hasFileSystemAccess = (): boolean => {
    return 'showDirectoryPicker' in window;
};

// ============================================================================
// TAURI IMPORTS (Dynamic to avoid errors in web mode)
// ============================================================================

let tauriDialog: typeof import('@tauri-apps/plugin-dialog') | null = null;
let tauriFs: typeof import('@tauri-apps/plugin-fs') | null = null;
let tauriPath: typeof import('@tauri-apps/api/path') | null = null;

/**
 * Initialize Tauri modules (call once on app start)
 */
export const initTauriModules = async (): Promise<boolean> => {
    if (!isTauri()) return false;

    try {
        tauriDialog = await import('@tauri-apps/plugin-dialog');
        tauriFs = await import('@tauri-apps/plugin-fs');
        tauriPath = await import('@tauri-apps/api/path');
        logger.info('TauriFS', 'Modules initialized successfully');
        return true;
    } catch (error) {
        logger.error('TauriFS', 'Failed to initialize modules', { error: error instanceof Error ? error.message : String(error) });
        return false;
    }
};

// ============================================================================
// AUTO-INITIALIZATION HELPERS
// ============================================================================

/**
 * Ensure tauriFs module is initialized before use
 * Returns the module or null if not in Tauri environment
 */
async function ensureTauriFs(): Promise<typeof import('@tauri-apps/plugin-fs') | null> {
    logger.debug('TauriFS', 'ensureTauriFs called', { isTauri: isTauri(), tauriFs: tauriFs ? 'exists' : 'null' });

    if (!isTauri()) {
        logger.debug('TauriFS', 'Not in Tauri, returning null');
        return null;
    }

    if (!tauriFs) {
        logger.debug('TauriFS', 'tauriFs is null, calling initTauriModules');
        const success = await initTauriModules();
        logger.debug('TauriFS', 'initTauriModules result', { success, tauriFs: tauriFs ? 'exists' : 'null' });
    }

    return tauriFs;
}

/**
 * Ensure tauriDialog module is initialized before use
 * Returns the module or null if not in Tauri environment
 */
async function ensureTauriDialog(): Promise<typeof import('@tauri-apps/plugin-dialog') | null> {
    if (!isTauri()) return null;
    if (!tauriDialog) {
        logger.debug('TauriFS', 'Auto-initializing modules for dialog');
        await initTauriModules();
    }
    return tauriDialog;
}

/**
 * Ensure tauriPath module is initialized before use
 * Returns the module or null if not in Tauri environment
 */
async function ensureTauriPath(): Promise<typeof import('@tauri-apps/api/path') | null> {
    if (!isTauri()) return null;
    if (!tauriPath) {
        logger.debug('TauriFS', 'Auto-initializing modules for path');
        await initTauriModules();
    }
    return tauriPath;
}

// ============================================================================
// PATH UTILITIES
// ============================================================================

/**
 * Get the application data directory
 * In Tauri: C:\Users\{User}\AppData\Local\BarackMercosul\
 * In Web: null (uses SQLite instead)
 */
export const getAppDataDir = async (): Promise<string | null> => {
    const path = await ensureTauriPath();
    if (!path) return null;

    try {
        const appData = await path.appLocalDataDir();
        return appData;
    } catch (error) {
        logger.error('TauriFS', 'Failed to get app data dir', { error: error instanceof Error ? error.message : String(error) });
        return null;
    }
};

/**
 * Get the projects directory within app data
 */
export const getProjectsDir = async (): Promise<string | null> => {
    const appData = await getAppDataDir();
    if (!appData) return null;
    return `${appData}projects`;
};

/**
 * Ensure a directory exists, creating it if necessary
 */
export const ensureDir = async (path: string): Promise<boolean> => {
    const fs = await ensureTauriFs();
    if (!fs) return false;

    try {
        const dirExists = await fs.exists(path);
        if (!dirExists) {
            await fs.mkdir(path, { recursive: true });
        }
        return true;
    } catch (error) {
        logger.error('TauriFS', 'Failed to ensure directory', { error: error instanceof Error ? error.message : String(error) });
        return false;
    }
};

// ============================================================================
// DIALOG OPERATIONS
// ============================================================================

/**
 * Open a folder picker dialog
 * Returns the selected folder path or null if cancelled
 */
export const pickFolder = async (): Promise<string | null> => {
    if (!isTauri()) {
        logger.warn('TauriFS', 'Not in Tauri environment, falling back to web API');
        return null;
    }

    // Auto-initialize if needed
    if (!tauriDialog) {
        logger.debug('TauriFS', 'Auto-initializing modules for pickFolder');
        const success = await initTauriModules();
        if (!success || !tauriDialog) {
            logger.error('TauriFS', 'Failed to initialize dialog module');
            return null;
        }
    }

    try {
        const result = await tauriDialog.open({
            directory: true,
            multiple: false,
            title: 'Seleccionar Carpeta de Proyecto'
        });

        const selectedPath = result as string | null;

        // Security validation: Check if folder name is forbidden
        if (selectedPath) {
            const { isForbiddenFolderName } = await import('./fileSystemSecurity');
            // Extract folder name from full path (Windows or Unix)
            const folderName = selectedPath.split(/[/\\]/).filter(Boolean).pop() || '';

            if (isForbiddenFolderName(folderName)) {
                await alertDialog(
                    'Carpeta No Permitida',
                    `⚠️ No se puede usar "${folderName}" por razones de seguridad.\n\n` +
                    'Por favor, cree o seleccione una carpeta específica para proyectos.'
                );
                return null;
            }
        }

        return selectedPath;
    } catch (error) {
        logger.error('TauriFS', 'Folder picker error', { error: error instanceof Error ? error.message : String(error) });
        return null;
    }
};

/**
 * Open a file picker dialog for .barack files
 */
export const pickProjectFile = async (): Promise<string | null> => {
    if (!isTauri() || !tauriDialog) return null;

    try {
        const result = await tauriDialog.open({
            multiple: false,
            title: 'Abrir Proyecto Barack',
            filters: [
                { name: 'Barack Project', extensions: ['barack', 'json'] }
            ]
        });

        return result as string | null;
    } catch (error) {
        logger.error('TauriFS', 'File picker error', { error: error instanceof Error ? error.message : String(error) });
        return null;
    }
};

/**
 * Show a save file dialog
 */
export const pickSaveLocation = async (defaultName: string): Promise<string | null> => {
    if (!isTauri() || !tauriDialog) return null;

    try {
        const result = await tauriDialog.save({
            title: 'Guardar Proyecto',
            defaultPath: defaultName,
            filters: [
                { name: 'Barack Project', extensions: ['barack'] }
            ]
        });

        return result;
    } catch (error) {
        logger.error('TauriFS', 'Save dialog error', { error: error instanceof Error ? error.message : String(error) });
        return null;
    }
};

/**
 * Show a confirmation dialog
 */
export const confirmDialog = async (title: string, message: string): Promise<boolean> => {
    const dialog = await ensureTauriDialog();
    if (!dialog) {
        return window.confirm(message);
    }

    try {
        return await dialog.ask(message, { title, kind: 'warning' });
    } catch (error) {
        return window.confirm(message);
    }
};

/**
 * Show an alert dialog
 */
export const alertDialog = async (title: string, message: string): Promise<void> => {
    const dialog = await ensureTauriDialog();
    if (!dialog) {
        window.alert(message);
        return;
    }

    try {
        await dialog.message(message, { title, kind: 'info' });
    } catch (error) {
        window.alert(message);
    }
};

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Read a text file
 */
export const readTextFile = async (path: string): Promise<string | null> => {
    const fs = await ensureTauriFs();
    if (!fs) return null;

    try {
        const content = await fs.readTextFile(path);
        return content;
    } catch (error) {
        logger.error('TauriFS', 'Failed to read file', { path, error: error instanceof Error ? error.message : String(error) });
        return null;
    }
};

/**
 * Write a text file
 */
export const writeTextFile = async (path: string, content: string): Promise<boolean> => {
    logger.debug('TauriFS', 'writeTextFile called', { path });

    const fs = await ensureTauriFs();
    logger.debug('TauriFS', 'ensureTauriFs result', { result: fs ? 'OK' : 'NULL' });

    if (!fs) {
        logger.error('TauriFS', 'writeTextFile: fs is null', { isTauri: isTauri() });
        return false;
    }

    try {
        logger.debug('TauriFS', 'Calling fs.writeTextFile');
        await fs.writeTextFile(path, content);
        logger.debug('TauriFS', 'writeTextFile SUCCESS', { path });
        return true;
    } catch (error) {
        logger.error('TauriFS', 'writeTextFile FAILED', { path, error: error instanceof Error ? error.message : String(error) });
        return false;
    }
};

/**
 * Read a binary file and return as Uint8Array
 */
export const readBinaryFile = async (path: string): Promise<Uint8Array | null> => {
    const fs = await ensureTauriFs();
    if (!fs) return null;

    try {
        const content = await fs.readFile(path);
        return content;
    } catch (error) {
        logger.error('TauriFS', 'Failed to read binary file', { path, error: error instanceof Error ? error.message : String(error) });
        return null;
    }
};

/**
 * Write a binary file
 */
export const writeBinaryFile = async (path: string, content: Uint8Array): Promise<boolean> => {
    const fs = await ensureTauriFs();
    if (!fs) return false;

    try {
        await fs.writeFile(path, content);
        return true;
    } catch (error) {
        logger.error('TauriFS', 'Failed to write binary file', { path, error: error instanceof Error ? error.message : String(error) });
        return false;
    }
};

/**
 * Check if a file or directory exists
 */
export const exists = async (path: string): Promise<boolean> => {
    const fs = await ensureTauriFs();
    if (!fs) return false;

    try {
        return await fs.exists(path);
    } catch (error) {
        return false;
    }
};

/**
 * Delete a file or directory
 */
export const remove = async (path: string, options?: { recursive?: boolean }): Promise<boolean> => {
    logger.debug('TauriFS', 'remove called', { path, options });
    const fs = await ensureTauriFs();
    if (!fs) {
        logger.error('TauriFS', 'remove failed: fs module not available');
        return false;
    }

    try {
        await fs.remove(path, options);
        logger.debug('TauriFS', 'remove success', { path });
        return true;
    } catch (error) {
        logger.error('TauriFS', 'Failed to remove', { path, error: error instanceof Error ? error.message : String(error) });
        return false;
    }
};

/**
 * Copy a file
 */
export const copyFile = async (from: string, to: string): Promise<boolean> => {
    const fs = await ensureTauriFs();
    if (!fs) return false;

    try {
        await fs.copyFile(from, to);
        return true;
    } catch (error) {
        logger.error('TauriFS', 'Failed to copy file', { from, to, error: error instanceof Error ? error.message : String(error) });
        return false;
    }
};

/**
 * Rename/move a file or directory
 */
export const rename = async (from: string, to: string): Promise<boolean> => {
    const fs = await ensureTauriFs();
    if (!fs) return false;

    try {
        await fs.rename(from, to);
        return true;
    } catch (error) {
        logger.error('TauriFS', 'Failed to rename', { from, to, error: error instanceof Error ? error.message : String(error) });
        return false;
    }
};

// ============================================================================
// DIRECTORY OPERATIONS
// ============================================================================

export interface DirEntry {
    name: string;
    isDirectory: boolean;
    isFile: boolean;
    path: string;
}

/**
 * Read directory contents
 */
export const readDir = async (path: string): Promise<DirEntry[]> => {
    const fs = await ensureTauriFs();
    if (!fs) return [];

    try {
        const entries = await fs.readDir(path);
        return entries.map(entry => ({
            name: entry.name,
            isDirectory: entry.isDirectory,
            isFile: entry.isFile,
            path: `${path}/${entry.name}`
        }));
    } catch (error) {
        logger.error('TauriFS', 'Failed to read directory', { path, error: error instanceof Error ? error.message : String(error) });
        return [];
    }
};

/**
 * Create a directory
 */
export const createDir = async (path: string): Promise<boolean> => {
    const fs = await ensureTauriFs();
    if (!fs) return false;

    try {
        await fs.mkdir(path, { recursive: true });
        return true;
    } catch (error) {
        logger.error('TauriFS', 'Failed to create directory', { path, error: error instanceof Error ? error.message : String(error) });
        return false;
    }
};

// ============================================================================
// PROJECT-SPECIFIC OPERATIONS
// ============================================================================

/**
 * Save a project to internal storage
 */
export const saveProjectToAppData = async (
    projectId: string,
    data: ProjectData
): Promise<boolean> => {
    const projectsDir = await getProjectsDir();
    if (!projectsDir) return false;

    const projectDir = `${projectsDir}/${projectId}`;
    const dataPath = `${projectDir}/data.json`;

    try {
        // Ensure project directory exists
        await ensureDir(projectDir);

        // Remove non-serializable properties
        const { fileHandle, directoryHandle, _loadedTimestamp, _checksum, ...serializableData } = data;

        // Write project data
        const json = JSON.stringify(serializableData, null, 2);
        const success = await writeTextFile(dataPath, json);

        if (success) {
            logger.info('TauriFS', 'Project saved', { projectId });
        }

        return success;
    } catch (error) {
        logger.error('TauriFS', 'Failed to save project', { error: error instanceof Error ? error.message : String(error) });
        return false;
    }
};

/**
 * Load a project from internal storage
 */
export const loadProjectFromAppData = async (projectId: string): Promise<ProjectData | null> => {
    const projectsDir = await getProjectsDir();
    if (!projectsDir) return null;

    const dataPath = `${projectsDir}/${projectId}/data.json`;

    try {
        const json = await readTextFile(dataPath);
        if (!json) return null;

        const data = JSON.parse(json) as ProjectData;
        logger.info('TauriFS', 'Project loaded', { projectId });
        return data;
    } catch (error) {
        logger.error('TauriFS', 'Failed to load project', { error: error instanceof Error ? error.message : String(error) });
        return null;
    }
};

/**
 * List all projects in internal storage
 */
export const listProjectsInAppData = async (): Promise<Array<{ id: string; name: string; lastModified: number }>> => {
    const projectsDir = await getProjectsDir();
    if (!projectsDir) return [];

    try {
        // Ensure projects directory exists
        await ensureDir(projectsDir);

        const entries = await readDir(projectsDir);
        const projects: Array<{ id: string; name: string; lastModified: number }> = [];

        for (const entry of entries) {
            if (entry.isDirectory) {
                const dataPath = `${entry.path}/data.json`;
                const json = await readTextFile(dataPath);
                if (json) {
                    try {
                        const data = JSON.parse(json) as ProjectData;
                        projects.push({
                            id: entry.name,
                            name: data.meta?.name || entry.name,
                            lastModified: data.lastModified || Date.now()
                        });
                    } catch {
                        // Skip invalid project
                    }
                }
            }
        }

        return projects.sort((a, b) => b.lastModified - a.lastModified);
    } catch (error) {
        logger.error('TauriFS', 'Failed to list projects', { error: error instanceof Error ? error.message : String(error) });
        return [];
    }
};

/**
 * Delete a project from internal storage
 */
export const deleteProjectFromAppData = async (projectId: string): Promise<boolean> => {
    const projectsDir = await getProjectsDir();
    if (!projectsDir) return false;

    const projectDir = `${projectsDir}/${projectId}`;

    try {
        const success = await remove(projectDir, { recursive: true });
        if (success) {
            logger.info('TauriFS', 'Project deleted', { projectId });
        }
        return success;
    } catch (error) {
        logger.error('TauriFS', 'Failed to delete project', { error: error instanceof Error ? error.message : String(error) });
        return false;
    }
};

// ============================================================================
// MEDIA OPERATIONS
// ============================================================================

/**
 * Save media file for a task
 */
export const saveMediaFile = async (
    projectId: string,
    taskId: string,
    file: File
): Promise<string | null> => {
    const projectsDir = await getProjectsDir();
    if (!projectsDir) return null;

    const mediaDir = `${projectsDir}/${projectId}/media`;
    const ext = file.name.split('.').pop() || 'dat';
    const filename = `${taskId}_${Date.now()}.${ext}`;
    const filePath = `${mediaDir}/${filename}`;

    try {
        await ensureDir(mediaDir);

        // Read file as ArrayBuffer
        const buffer = await file.arrayBuffer();
        const content = new Uint8Array(buffer);

        const success = await writeBinaryFile(filePath, content);
        if (success) {
            return `media/${filename}`; // Return relative path
        }
        return null;
    } catch (error) {
        logger.error('TauriFS', 'Failed to save media', { error: error instanceof Error ? error.message : String(error) });
        return null;
    }
};

/**
 * Load media file and return as blob URL
 */
export const loadMediaFile = async (
    projectId: string,
    mediaRef: string
): Promise<string | null> => {
    const projectsDir = await getProjectsDir();
    if (!projectsDir || !mediaRef) return null;

    const filePath = `${projectsDir}/${projectId}/${mediaRef}`;

    try {
        const content = await readBinaryFile(filePath);
        if (!content) return null;

        // Determine MIME type from extension
        const ext = mediaRef.split('.').pop()?.toLowerCase() || '';
        const mimeTypes: Record<string, string> = {
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'mov': 'video/quicktime',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif'
        };
        const mimeType = mimeTypes[ext] || 'application/octet-stream';

        // Create blob URL - use buffer.slice() to get a proper ArrayBuffer
        const arrayBuffer = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
        const blob = new Blob([arrayBuffer], { type: mimeType });
        return URL.createObjectURL(blob);
    } catch (error) {
        logger.error('TauriFS', 'Failed to load media', { error: error instanceof Error ? error.message : String(error) });
        return null;
    }
};

// ============================================================================
// EXPORT/IMPORT OPERATIONS
// ============================================================================

/**
 * Export project as .barack file (includes media)
 * Note: This is a simplified version - full implementation would use a ZIP library
 */
export const exportProject = async (projectId: string): Promise<boolean> => {
    const projectsDir = await getProjectsDir();
    if (!projectsDir) {
        await alertDialog('Error', 'No se puede acceder al almacenamiento interno.');
        return false;
    }

    try {
        // Get save location
        const savePath = await pickSaveLocation(`${projectId}.barack`);
        if (!savePath) return false;

        // Read project data
        const data = await loadProjectFromAppData(projectId);
        if (!data) {
            await alertDialog('Error', 'No se pudo leer el proyecto.');
            return false;
        }

        // For now, just export as JSON (full implementation would ZIP with media)
        const json = JSON.stringify(data, null, 2);
        const success = await writeTextFile(savePath, json);

        if (success) {
            await alertDialog('Éxito', `Proyecto exportado a: ${savePath}`);
        }

        return success;
    } catch (error) {
        logger.error('TauriFS', 'Export failed', { error: error instanceof Error ? error.message : String(error) });
        await alertDialog('Error', 'Falló la exportación del proyecto.');
        return false;
    }
};

/**
 * Import project from .barack file
 */
export const importProject = async (): Promise<string | null> => {
    try {
        // Pick file
        const filePath = await pickProjectFile();
        if (!filePath) return null;

        // Read file
        const json = await readTextFile(filePath);
        if (!json) {
            await alertDialog('Error', 'No se pudo leer el archivo.');
            return null;
        }

        // Parse data
        const data = JSON.parse(json) as ProjectData;

        // Generate new project ID
        const projectId = `project_${Date.now()}`;

        // Save to internal storage
        const success = await saveProjectToAppData(projectId, data);

        if (success) {
            await alertDialog('Éxito', `Proyecto "${data.meta?.name}" importado correctamente.`);
            return projectId;
        }

        return null;
    } catch (error) {
        logger.error('TauriFS', 'Import failed', { error: error instanceof Error ? error.message : String(error) });
        await alertDialog('Error', 'Falló la importación del proyecto.');
        return null;
    }
};
