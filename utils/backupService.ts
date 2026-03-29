/**
 * Backup Service — Web stub
 *
 * In the web/Supabase version, backups are handled automatically by Supabase.
 * This module provides no-op stubs so that existing imports continue to compile.
 *
 * TODO: Implement optional export-to-file backup if needed.
 */

import { logger } from './logger';
import type { ExportDataset as MergeExportDataset } from './mergeEngine';
export type { ExportDataset as ExportDataset } from './mergeEngine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BackupInfo {
    path: string;
    filename: string;
    sizeBytes: number;
    createdAt: string;
    isValid: boolean;
}

export interface BackupStats {
    enabled: boolean;
    lastBackupAt: string | null;
    totalBackups: number;
    totalSizeBytes: number;
    backupFolder: string | null;
}

export interface ServerBackupStats {
    available: boolean;
    lastBackupAt: string | null;
    totalBackups: number;
    backupFolder: string | null;
}


// ---------------------------------------------------------------------------
// Local backup (no-op in web)
// ---------------------------------------------------------------------------

export function scheduleBackup(): void { /* no-op */ }

export async function createBackup(): Promise<BackupInfo | null> {
    logger.warn('BackupService', 'createBackup called in web mode — no-op');
    return null;
}

export async function listBackups(): Promise<BackupInfo[]> {
    return [];
}

export async function getBackupStats(): Promise<BackupStats> {
    return { enabled: false, lastBackupAt: null, totalBackups: 0, totalSizeBytes: 0, backupFolder: null };
}

export function isBackupEnabled(): boolean { return false; }

export async function setBackupEnabled(_enabled: boolean): Promise<void> { /* no-op */ }

export async function restoreFromBackup(_backupPath: string): Promise<boolean> {
    logger.warn('BackupService', 'restoreFromBackup called in web mode — no-op');
    return false;
}

// ---------------------------------------------------------------------------
// Server backup (no-op in web)
// ---------------------------------------------------------------------------

export async function writeServerBackup(_dataset: MergeExportDataset): Promise<boolean> { return false; }

export async function createServerBackup(): Promise<boolean> { return false; }

export async function isServerAvailable(): Promise<boolean> { return false; }

export async function getServerBackupStats(): Promise<ServerBackupStats> {
    return { available: false, lastBackupAt: null, totalBackups: 0, backupFolder: null };
}

// ---------------------------------------------------------------------------
// Database snapshot / import (no-op — handled by Supabase)
// ---------------------------------------------------------------------------

export async function snapshotDatabase(): Promise<MergeExportDataset | null> {
    logger.warn('BackupService', 'snapshotDatabase called in web mode — no-op');
    return null;
}

async function writeDatasetToDb(_dataset: MergeExportDataset): Promise<boolean> {
    logger.warn('BackupService', 'writeDatasetToDb called in web mode — no-op');
    return false;
}

// ---------------------------------------------------------------------------
// Server/startup checks (no-op in web)
// ---------------------------------------------------------------------------

async function checkAndOfferRestore(): Promise<null> { return null; }

async function checkForNewerServerData(): Promise<null> { return null; }

export async function exportAllData(): Promise<null> { return null; }
