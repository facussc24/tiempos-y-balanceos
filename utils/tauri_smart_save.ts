/**
 * Tauri Smart Save — Web stub
 *
 * In the web/Supabase version, all persistence is handled by the repositories
 * via Supabase. This module provides no-op stubs for backward compatibility.
 *
 * @module tauri_smart_save
 */

import type { ProjectData } from '../types';
import { logger } from './logger';

export interface SmartSaveOptions {
    skipLock?: boolean;
    skipBackup?: boolean;
    silent?: boolean;
}

export interface SmartSaveResult {
    success: boolean;
    error?: string;
    path?: string;
}

/**
 * Smart save with locks and atomic writes.
 * No-op in web mode — use projectRepository.saveProject() instead.
 * Signature matches legacy Tauri call: (filePath, directoryHandle, data).
 */
export async function smartSaveProjectTauri(
    _path: string,
    _directoryHandle: string,
    data: ProjectData,
    _options?: SmartSaveOptions
): Promise<ProjectData> {
    logger.warn('TauriSmartSave', 'smartSaveProjectTauri called in web mode — no-op');
    return data;
}

/**
 * Quick save without lock acquisition.
 * No-op in web mode — use projectRepository.saveProject() instead.
 */
export async function quickSaveTauri(
    _path: string,
    _data: ProjectData
): Promise<boolean> {
    logger.warn('TauriSmartSave', 'quickSaveTauri called in web mode — no-op');
    return false;
}

/**
 * Acquire a file lock.
 * No-op in web mode.
 */
export async function acquireFileLock(_path: string): Promise<boolean> {
    return false;
}

/**
 * Release a file lock.
 * No-op in web mode.
 */
export async function releaseFileLock(_path: string): Promise<void> {
    // No-op
}

/**
 * Check if a file is locked by another process.
 * Always returns false in web mode.
 */
export async function isFileLocked(_path: string): Promise<boolean> {
    return false;
}

/**
 * Run a promise with a timeout.
 * In web mode this is a real implementation used by tests.
 */
export async function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    label = 'operation'
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
        promise.then(
            (v) => { clearTimeout(timer); resolve(v); },
            (e) => { clearTimeout(timer); reject(e); }
        );
    });
}
