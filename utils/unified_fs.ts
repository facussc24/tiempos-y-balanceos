/**
 * Unified File System Module — Web version
 *
 * Provides a unified API for file operations that works in the browser.
 * All file I/O is done via browser APIs (File System Access API or download links).
 * Desktop-specific operations are no-op stubs for backward compatibility.
 *
 * @module unified_fs
 */

import { ProjectData, FSItem, INITIAL_PROJECT } from '../types';
import { incrementVersion } from '../utils';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Environment detection — always web in this build
// ---------------------------------------------------------------------------

export const isTauri = (): boolean => false;
const hasFileSystemAccess = (): boolean =>
    typeof window !== 'undefined' && 'showOpenFilePicker' in window;

// ---------------------------------------------------------------------------
// Module init (no-ops in web)
// ---------------------------------------------------------------------------

const initTauriModules = async (): Promise<boolean> => false;
const ensureTauriFs = async (): Promise<boolean> => false;
const ensureTauriDialog = async (): Promise<boolean> => false;
const ensureTauriPath = async (): Promise<boolean> => false;

// ---------------------------------------------------------------------------
// Path utilities
// ---------------------------------------------------------------------------

export const getAppDataDir = async (): Promise<string | null> => null;
export const getProjectsDir = async (): Promise<string | null> => null;

// ---------------------------------------------------------------------------
// Primitive file operations (browser-based)
// ---------------------------------------------------------------------------

/** Pick a folder using File System Access API (Chrome/Edge only). */
export const pickFolder = async (): Promise<string | null> => {
    try {
        if (!hasFileSystemAccess()) return null;
        // @ts-expect-error - showDirectoryPicker is not in all TypeScript lib defs
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        return handle?.name ?? null;
    } catch {
        return null;
    }
};

/** Pick a project file (no-op in web). */
const pickProjectFile = async (): Promise<string | null> => null;

/** Pick a save location (no-op in web). */
const pickSaveLocation = async (_defaultName?: string, _filters?: unknown[]): Promise<string | null> => null;

/** List files/dirs (stub for compatibility). */
export const readDir = async (_path: string): Promise<FSItem[]> => {
    logger.warn('UnifiedFS', 'readDir called in web mode — no filesystem access');
    return [];
};

/** Create directory (no-op in web). */
const createDir = async (_path: string): Promise<boolean> => false;

/** Alias for createDir. */
export const ensureDir = async (_path: string): Promise<boolean> => false;

/** Write text file via browser download. */
export const writeTextFile = async (path: string, content: string): Promise<boolean> => {
    try {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = path.split(/[/\\]/).pop() ?? 'export.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
    } catch (err) {
        logger.error('UnifiedFS', 'writeTextFile failed', {}, err instanceof Error ? err : undefined);
        return false;
    }
};

/** Read text file (no-op, use file input instead). */
export const readTextFile = async (_path: string): Promise<string | null> => {
    logger.warn('UnifiedFS', 'readTextFile called in web mode — use file input instead');
    return null;
};

/** Read binary file (no-op in web). */
export const readBinaryFile = async (_path: string): Promise<Uint8Array | null> => null;

/** Write binary file (no-op in web). */
export const writeBinaryFile = async (_path: string, _data: Uint8Array): Promise<boolean> => false;

/** Write raw bytes or text to a path (no-op in web). */
export const writeFile = async (_path: string, _data: Uint8Array | string): Promise<boolean> => false;

/** Check if a path exists (always false in web). */
export const exists = async (_path: string): Promise<boolean> => false;

/** Remove file (no-op in web). */
export const remove = async (_path: string, _options?: { recursive?: boolean }): Promise<boolean> => false;

/** Copy file (no-op in web). */
export const copyFile = async (_src: string, _dst: string): Promise<boolean> => false;

/** Rename/move file (no-op in web). */
export const rename = async (_src: string, _dst: string): Promise<boolean> => false;

// ---------------------------------------------------------------------------
// Trigger a browser file download
// ---------------------------------------------------------------------------

/** Trigger a browser download for arbitrary data. */
function triggerDownload(filename: string, content: string | Uint8Array, mimeType = 'application/octet-stream'): void {
    const blob = content instanceof Uint8Array
        ? new Blob([content], { type: mimeType })
        : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

let isInitialized = false;
let _currentProjectId: string | null = null;

/**
 * Initialize the unified file system.
 * In web mode, this is a no-op.
 */
export const initFileSystem = async (): Promise<void> => {
    if (isInitialized) return;
    logger.info('UnifiedFS', 'Running in Web mode (Supabase)');
    isInitialized = true;
};

// ---------------------------------------------------------------------------
// Storage mode
// ---------------------------------------------------------------------------

const getStorageMode = (): 'web' => 'web';

// ---------------------------------------------------------------------------
// Project operations (handled by repositories in web mode)
// ---------------------------------------------------------------------------

export const listProjects = async (): Promise<Array<{ id: string; name: string; lastModified: number }>> => {
    // In web mode, projects are loaded via projectRepository
    return [];
};

export const createProject = async (name: string): Promise<{ id: string; data: ProjectData } | null> => {
    const projectId = `project_${Date.now()}`;
    const newData: ProjectData = {
        ...INITIAL_PROJECT,
        id: parseInt(projectId.split('_')[1]) || Date.now(),
        meta: {
            ...INITIAL_PROJECT.meta,
            name,
            version: '1.0.0',
            date: new Date().toISOString().split('T')[0],
        },
        lastModified: Date.now(),
    };
    return { id: projectId, data: newData };
};

export const loadProject = async (_projectId: string): Promise<ProjectData | null> => null;

export const saveProject = async (_data: ProjectData): Promise<boolean> => false;

export const deleteProject = async (_projectId: string): Promise<boolean> => false;

export const setCurrentProject = (projectId: string | null): void => {
    _currentProjectId = projectId;
};

// ---------------------------------------------------------------------------
// Project-specific filesystem operations (no-ops in web)
// ---------------------------------------------------------------------------

const saveProjectToAppData = async (_id: string, _data: ProjectData): Promise<boolean> => false;

const loadProjectFromAppData = async (_id: string): Promise<ProjectData | null> => null;

const listProjectsInAppData = async (): Promise<Array<{ id: string; name: string; lastModified: number }>> => [];

const deleteProjectFromAppData = async (_id: string): Promise<boolean> => false;

// ---------------------------------------------------------------------------
// Media (no-op stubs — use Supabase Storage)
// ---------------------------------------------------------------------------

/** @deprecated Use Supabase Storage for media files. */
const saveTaskMedia = async (_file: File, _taskId: string): Promise<string | null> => null;

/** @deprecated Use Supabase Storage for media files. */
const loadTaskMedia = async (_mediaRef: string): Promise<string | null> => null;

export const saveMediaFile = async (_projectId: string, _taskId: string, _file: File): Promise<string | null> => null;

export const loadMediaFile = async (_projectId: string, _mediaRef: string): Promise<string | null> => null;

// ---------------------------------------------------------------------------
// Export / Import operations (no-ops in web)
// ---------------------------------------------------------------------------

const exportProject = async (_path: string, _data: ProjectData): Promise<boolean> => false;

const importProject = async (_path: string): Promise<ProjectData | null> => null;

// ---------------------------------------------------------------------------
// Dialogs (browser-native)
// ---------------------------------------------------------------------------

const confirm = async (_title: string, message: string): Promise<boolean> =>
    window.confirm(message);

const alert = async (_title: string, message: string): Promise<void> =>
    window.alert(message);

/** Alias for confirm — uses window.confirm. */
const confirmDialog = async (_title: string, message: string): Promise<boolean> =>
    window.confirm(message);

/** Alias for alert — uses window.alert. */
const alertDialog = async (_title: string, message: string): Promise<void> =>
    window.alert(message);

// ---------------------------------------------------------------------------
// Security validation
// ---------------------------------------------------------------------------

const isSecurePath = (_path: string): boolean => false;

// ---------------------------------------------------------------------------
// App info
// ---------------------------------------------------------------------------

export const getAppInfo = (): { mode: string; version: string } => ({
    mode: 'Web App (Supabase)',
    version: '1.0.0',
});

// Keep incrementVersion in scope (imported above for potential future use)
void incrementVersion;
