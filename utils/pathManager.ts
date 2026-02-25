/**
 * Path Manager - V4.1 Centralized Path Handling
 * 
 * Manages all file system paths for the document management system.
 * Provides utilities for:
 * - Building hierarchical paths (Client/Project/Part)
 * - Scanning existing structure
 * - Ensuring folder creation
 * 
 * @module pathManager
 * @version 4.1.0
 */
import { isTauri } from './unified_fs';
import { logger } from './logger';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Base paths for the document management system
 * These are the root folders on the network drive
 */
export interface PathConfig {
    basePath: string;           // Root folder for all content
    dataFolder: string;         // Subolder for JSON files
    mediaFolder: string;        // Subfolder for videos/images
    docsFolder: string;         // Subfolder for reference documents
    reportsFolder: string;      // Subfolder for generated reports
}

/**
 * Default configuration using the user's specified network paths
 */
export const DEFAULT_PATH_CONFIG: PathConfig = {
    basePath: 'Y:\\Ingenieria\\Documentacion Gestion Ingenieria\\15. Tiempos',
    dataFolder: '01_DATA',
    mediaFolder: '02_MEDIA',
    docsFolder: '03_DOCS',
    reportsFolder: '04_REPORTES',
};

// In-memory config (can be updated at runtime)
let currentConfig: PathConfig = { ...DEFAULT_PATH_CONFIG };

/**
 * Update the path configuration
 */
export function setPathConfig(config: Partial<PathConfig>): void {
    currentConfig = { ...currentConfig, ...config };
    // Persist to localStorage for web mode
    if (!isTauri() && typeof localStorage !== 'undefined') {
        localStorage.setItem('path_config', JSON.stringify(currentConfig));
    }
}

/**
 * Get the current path configuration
 */
export function getPathConfig(): PathConfig {
    return { ...currentConfig };
}

/**
 * Load config from localStorage if available
 */
export function loadPathConfig(): void {
    if (!isTauri() && typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('path_config');
        if (stored) {
            currentConfig = { ...DEFAULT_PATH_CONFIG, ...JSON.parse(stored) };
        }
    }
}

// ============================================================================
// Path Builders
// ============================================================================

export type ContentType = 'data' | 'media' | 'docs' | 'reports';

/**
 * Build a full path for a specific content type and hierarchy
 * 
 * @param type - Type of content (data, media, docs, reports)
 * @param client - Client name (e.g., "TOYOTA")
 * @param project - Project name (e.g., "HILUX_2024")
 * @param part - Part name (e.g., "ASIENTO_CONDUCTOR")
 * @param filename - Optional filename to append
 * @returns Full path string
 * 
 * @example
 * buildPath('data', 'TOYOTA', 'HILUX', 'ASIENTO') 
 * // => "Y:\...\01_DATA\TOYOTA\HILUX\ASIENTO"
 */
export function buildPath(
    type: ContentType,
    client: string,
    project: string,
    part: string,
    filename?: string
): string {
    const folderMap: Record<ContentType, string> = {
        data: currentConfig.dataFolder,
        media: currentConfig.mediaFolder,
        docs: currentConfig.docsFolder,
        reports: currentConfig.reportsFolder,
    };

    const folder = folderMap[type];
    const sanitizedClient = sanitizeName(client);
    const sanitizedProject = sanitizeName(project);
    const sanitizedPart = sanitizeName(part);

    let path = `${currentConfig.basePath}\\${folder}\\${sanitizedClient}\\${sanitizedProject}\\${sanitizedPart}`;

    if (filename) {
        path += `\\${filename}`;
    }

    return path;
}

/**
 * Build the master JSON path for a study
 */
export function buildMasterJsonPath(client: string, project: string, part: string): string {
    return buildPath('data', client, project, part, 'master.json');
}

/**
 * Sanitize a name for use in file paths
 * - Converts to uppercase
 * - Replaces spaces with underscores
 * - Removes invalid characters
 */
export function sanitizeName(name: string): string {
    const sanitized = name
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '')
        .trim();

    return sanitized || 'UNTITLED';
}

// ============================================================================
// Folder Structure Management
// ============================================================================

/**
 * Ensure all required folders exist for a study
 * Creates the complete hierarchy for data, media, and reports
 */
export async function ensureStudyStructure(
    client: string,
    project: string,
    part: string
): Promise<{ success: boolean; createdPaths: string[]; error?: string }> {
    const createdPaths: string[] = [];

    if (!isTauri()) {
        // Web mode - just return success (no real FS)
        return { success: true, createdPaths: [] };
    }

    try {
        const tauriFs = await import('./tauri_fs');

        // Create folders for each content type
        const contentTypes: ContentType[] = ['data', 'media', 'reports'];

        for (const type of contentTypes) {
            const path = buildPath(type, client, project, part);
            await tauriFs.ensureDir(path);
            createdPaths.push(path);
        }

        return { success: true, createdPaths };
    } catch (e) {
        logger.error('PathManager', 'Error creating structure', {}, e instanceof Error ? e : undefined);
        return {
            success: false,
            createdPaths,
            error: e instanceof Error ? e.message : 'Unknown error'
        };
    }
}

// ============================================================================
// Directory Scanning
// ============================================================================

/**
 * List all clients (top-level folders in data directory)
 */
export async function listClients(): Promise<string[]> {
    if (!isTauri()) {
        // Web mode - return demo data
        return ['DEMO_CLIENT'];
    }

    try {
        const tauriFs = await import('./tauri_fs');
        const dataPath = `${currentConfig.basePath}\\${currentConfig.dataFolder}`;

        const exists = await tauriFs.exists(dataPath);
        if (!exists) {
            return [];
        }

        const entries = await tauriFs.readDir(dataPath);
        return entries
            .filter(e => e.isDirectory)
            .map(e => e.name)
            .sort();
    } catch (e) {
        logger.error('PathManager', 'Error listing clients', {}, e instanceof Error ? e : undefined);
        return [];
    }
}

/**
 * List all projects for a given client
 */
export async function listProjects(client: string): Promise<string[]> {
    if (!isTauri()) {
        return ['DEMO_PROJECT'];
    }

    try {
        const tauriFs = await import('./tauri_fs');
        const clientPath = `${currentConfig.basePath}\\${currentConfig.dataFolder}\\${sanitizeName(client)}`;

        const exists = await tauriFs.exists(clientPath);
        if (!exists) {
            return [];
        }

        const entries = await tauriFs.readDir(clientPath);
        return entries
            .filter(e => e.isDirectory)
            .map(e => e.name)
            .sort();
    } catch (e) {
        logger.error('PathManager', 'Error listing projects', {}, e instanceof Error ? e : undefined);
        return [];
    }
}

/**
 * List all parts for a given client/project
 */
export async function listParts(client: string, project: string): Promise<string[]> {
    if (!isTauri()) {
        return ['DEMO_PART'];
    }

    try {
        const tauriFs = await import('./tauri_fs');
        const projectPath = `${currentConfig.basePath}\\${currentConfig.dataFolder}\\${sanitizeName(client)}\\${sanitizeName(project)}`;

        const exists = await tauriFs.exists(projectPath);
        if (!exists) {
            return [];
        }

        const entries = await tauriFs.readDir(projectPath);
        return entries
            .filter(e => e.isDirectory)
            .map(e => e.name)
            .sort();
    } catch (e) {
        logger.error('PathManager', 'Error listing parts', {}, e instanceof Error ? e : undefined);
        return [];
    }
}

/**
 * Check if a study already exists
 */
export async function studyExists(client: string, project: string, part: string): Promise<boolean> {
    if (!isTauri()) {
        return false;
    }

    try {
        const tauriFs = await import('./tauri_fs');
        const masterPath = buildMasterJsonPath(client, project, part);
        return await tauriFs.exists(masterPath);
    } catch {
        return false;
    }
}

/**
 * V5: Delete a study folder (the part folder)
 * @param studyPath - Full path to the study folder (e.g., "Y:\...\01_DATA\CLIENT\PROJECT\PART")
 */
export async function deleteStudy(studyPath: string): Promise<{ success: boolean; error?: string }> {
    if (!isTauri()) {
        return { success: false, error: 'Delete not available in web mode' };
    }

    try {
        const tauriFs = await import('./tauri_fs');

        // Verify path exists
        const exists = await tauriFs.exists(studyPath);
        if (!exists) {
            return { success: false, error: 'Study folder not found' };
        }

        // Remove the folder recursively
        await tauriFs.remove(studyPath, { recursive: true });

        return { success: true };
    } catch (e) {
        logger.error('PathManager', 'Error deleting study', {}, e instanceof Error ? e : undefined);
        return {
            success: false,
            error: e instanceof Error ? e.message : 'Unknown error'
        };
    }
}

/**
 * V5: Delete a Project folder (recursively)
 * @param client - Client name
 * @param project - Project name
 */
export async function deleteProject(client: string, project: string): Promise<{ success: boolean; error?: string }> {
    if (!isTauri()) {
        return { success: false, error: 'Delete not available in web mode' };
    }

    try {
        const tauriFs = await import('./tauri_fs');
        const projectPath = `${currentConfig.basePath}\\${currentConfig.dataFolder}\\${sanitizeName(client)}\\${sanitizeName(project)}`;

        // Verify path exists
        const exists = await tauriFs.exists(projectPath);
        if (!exists) {
            return { success: false, error: 'Project folder not found' };
        }

        // Remove the folder recursively
        await tauriFs.remove(projectPath, { recursive: true });

        return { success: true };
    } catch (e) {
        logger.error('PathManager', 'Error deleting project', {}, e instanceof Error ? e : undefined);
        return {
            success: false,
            error: e instanceof Error ? e.message : 'Unknown error'
        };
    }
}

/**
 * V5: Delete a Client folder (recursively)
 * @param client - Client name
 */
export async function deleteClient(client: string): Promise<{ success: boolean; error?: string }> {
    if (!isTauri()) {
        return { success: false, error: 'Delete not available in web mode' };
    }

    try {
        const tauriFs = await import('./tauri_fs');
        const clientPath = `${currentConfig.basePath}\\${currentConfig.dataFolder}\\${sanitizeName(client)}`;

        // Verify path exists
        const exists = await tauriFs.exists(clientPath);
        if (!exists) {
            return { success: false, error: 'Client folder not found' };
        }

        // Remove the folder recursively
        await tauriFs.remove(clientPath, { recursive: true });

        return { success: true };
    } catch (e) {
        logger.error('PathManager', 'Error deleting client', {}, e instanceof Error ? e : undefined);
        return {
            success: false,
            error: e instanceof Error ? e.message : 'Unknown error'
        };
    }
}

// Initialize config on module load
loadPathConfig();
