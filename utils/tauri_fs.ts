/**
 * Tauri File System Module — Web stub
 *
 * This module used to provide Tauri native filesystem operations.
 * In the web/Supabase version all filesystem operations are either
 * no-ops, browser-based downloads, or handled by Supabase Storage.
 *
 * All exports maintain the same API signatures so existing imports compile
 * without changes. Functions that cannot be implemented in web just return
 * null/false/empty and log a warning.
 *
 * @module tauri_fs
 */

import { logger } from './logger';
import type { ProjectData, FSItem } from '../types';

// ---------------------------------------------------------------------------
// Environment detection — always web in this build
// ---------------------------------------------------------------------------

export const isTauri = (): boolean => false;
export const hasFileSystemAccess = (): boolean =>
    typeof window !== 'undefined' && 'showOpenFilePicker' in window;

// ---------------------------------------------------------------------------
// Tauri module init (no-ops)
// ---------------------------------------------------------------------------

export const initTauriModules = async (): Promise<boolean> => false;
export const ensureTauriFs = async (): Promise<boolean> => false;
export const ensureTauriDialog = async (): Promise<boolean> => false;
export const ensureTauriPath = async (): Promise<boolean> => false;

// ---------------------------------------------------------------------------
// Path utilities
// ---------------------------------------------------------------------------

export const getAppDataDir = async (): Promise<string | null> => null;
export const getProjectsDir = async (): Promise<string | null> => null;
export const ensureDir = async (_path: string): Promise<boolean> => false;

// ---------------------------------------------------------------------------
// Dialog operations (browser-native fallbacks)
// ---------------------------------------------------------------------------

export const pickFolder = async (): Promise<string | null> => null;
export const pickProjectFile = async (): Promise<string | null> => null;

export const pickSaveLocation = async (_defaultName?: string, _filters?: unknown[]): Promise<string | null> => null;

export const confirmDialog = async (_title: string, message: string): Promise<boolean> =>
    window.confirm(message);

export const alertDialog = async (_title: string, message: string): Promise<void> =>
    window.alert(message);

// ---------------------------------------------------------------------------
// File operations (no-ops in web)
// ---------------------------------------------------------------------------

export const readTextFile = async (_path: string): Promise<string | null> => {
    logger.warn('TauriFs', 'readTextFile called in web mode — no filesystem access');
    return null;
};

export const writeTextFile = async (_path: string, _content: string): Promise<boolean> => {
    logger.warn('TauriFs', 'writeTextFile called in web mode — no filesystem access');
    return false;
};

export const readBinaryFile = async (_path: string): Promise<Uint8Array | null> => null;

export const writeBinaryFile = async (_path: string, _data: Uint8Array): Promise<boolean> => false;

/** Alias for writeBinaryFile — write raw bytes to a path. */
export const writeFile = async (_path: string, _data: Uint8Array | string): Promise<boolean> => false;

export const exists = async (_path: string): Promise<boolean> => false;

export const remove = async (_path: string, _options?: { recursive?: boolean }): Promise<boolean> => false;

export const copyFile = async (_src: string, _dst: string): Promise<boolean> => false;

export const rename = async (_src: string, _dst: string): Promise<boolean> => false;

export const readDir = async (_path: string): Promise<FSItem[]> => [];

export const createDir = async (_path: string): Promise<boolean> => false;

// ---------------------------------------------------------------------------
// Project-specific operations (handled by repository in web mode)
// ---------------------------------------------------------------------------

export const saveProjectToAppData = async (_id: string, _data: ProjectData): Promise<boolean> => false;

export const loadProjectFromAppData = async (_id: string): Promise<ProjectData | null> => null;

export const listProjectsInAppData = async (): Promise<Array<{ id: string; name: string; lastModified: number }>> => [];

export const deleteProjectFromAppData = async (_id: string): Promise<boolean> => false;

// ---------------------------------------------------------------------------
// Media operations (no-op — use Supabase Storage instead)
// ---------------------------------------------------------------------------

export const saveMediaFile = async (_projectId: string, _taskId: string, _file: File): Promise<string | null> => null;

export const loadMediaFile = async (_projectId: string, _mediaRef: string): Promise<string | null> => null;

// ---------------------------------------------------------------------------
// Export / Import operations
// ---------------------------------------------------------------------------

export const exportProject = async (_path: string, _data: ProjectData): Promise<boolean> => false;

export const importProject = async (_path: string): Promise<ProjectData | null> => null;

// ---------------------------------------------------------------------------
// Security validation
// ---------------------------------------------------------------------------

export const isSecurePath = (_path: string): boolean => false;
