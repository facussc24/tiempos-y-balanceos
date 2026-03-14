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
 * Default configuration using the user's specified network paths.
 * The mapped drive letter (Y:) can break when Windows loses the network mapping
 * (sleep, reboot, VPN reconnect). The UNC fallback ensures the app always connects.
 */
export const DEFAULT_PATH_CONFIG: PathConfig = {
    basePath: 'Y:\\INGENIERIA\\Datos Software',
    dataFolder: '01_DATA',
    mediaFolder: '02_MEDIA',
    docsFolder: '03_DOCS',
    reportsFolder: '04_REPORTES',
};

/**
 * UNC fallback path — same folder as basePath but via direct network name.
 * Used when the mapped drive letter (Y:) is unavailable.
 */
export const UNC_FALLBACK_BASE_PATH = '\\\\server\\compartido\\INGENIERIA\\Datos Software';

/**
 * Legacy paths — for backward compatibility with data saved before the reorganization.
 * resolveBasePath() will try these if the new path doesn't exist yet.
 */
export const LEGACY_BASE_PATH = 'Y:\\Ingenieria\\Documentacion Gestion Ingenieria\\15. Tiempos\\Software';
export const LEGACY_UNC_FALLBACK = '\\\\server\\compartido\\Ingenieria\\Documentacion Gestion Ingenieria\\15. Tiempos\\Software';

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
            try {
                currentConfig = { ...DEFAULT_PATH_CONFIG, ...JSON.parse(stored) };
            } catch {
                // Corrupted localStorage entry — reset to defaults
                localStorage.removeItem('path_config');
            }
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
        const contentTypes: ContentType[] = ['data', 'media'];

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

/**
 * Resolve the best available base path at runtime.
 * Tries the mapped drive (Y:\...) first, then falls back to UNC (\\server\...).
 * Updates currentConfig.basePath in-place so all subsequent path operations use it.
 *
 * Why: Windows frequently loses mapped drive letters after sleep, reboot, or VPN
 * reconnect. The UNC path works as long as the network is reachable. This makes
 * the app resilient to drive mapping issues on any PC.
 */
// Cache for resolved base path (avoids repeated network checks)
let resolvedBasePathCache: { path: string; resolvedAt: number } | null = null;
const RESOLVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function resolveBasePath(): Promise<string> {
    if (!isTauri()) return currentConfig.basePath;

    // Return cached result if still valid
    if (resolvedBasePathCache && (Date.now() - resolvedBasePathCache.resolvedAt) < RESOLVE_CACHE_TTL_MS) {
        return resolvedBasePathCache.path;
    }

    try {
        const tauriFs = await import('./tauri_fs');

        const checkPath = async (path: string, timeout: number): Promise<boolean> => {
            return Promise.race([
                tauriFs.exists(path),
                new Promise<boolean>((_, reject) => setTimeout(() => reject(false), timeout))
            ]).catch(() => false);
        };

        // Priority order (highest to lowest)
        const candidates = [
            { path: currentConfig.basePath, label: 'primary' },
            { path: UNC_FALLBACK_BASE_PATH, label: 'UNC' },
            { path: LEGACY_BASE_PATH, label: 'legacy' },
            { path: LEGACY_UNC_FALLBACK, label: 'legacy UNC' },
        ];

        // Check ALL paths in parallel with a global 5s timeout
        const results = await Promise.race([
            Promise.allSettled(
                candidates.map(c => checkPath(c.path, 3000).then(ok => ({ ...c, ok })))
            ),
            new Promise<PromiseSettledResult<{ path: string; label: string; ok: boolean }>[]>(
                resolve => setTimeout(() => resolve(candidates.map(c => ({
                    status: 'fulfilled' as const,
                    value: { ...c, ok: false },
                }))), 5000)
            ),
        ]);

        // Pick the first accessible path in priority order
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.ok) {
                const chosen = result.value;
                if (chosen.path !== currentConfig.basePath) {
                    logger.info('PathManager', `Using ${chosen.label} path`, { path: chosen.path });
                    currentConfig.basePath = chosen.path;
                }
                resolvedBasePathCache = { path: chosen.path, resolvedAt: Date.now() };
                return chosen.path;
            }
        }

        // None accessible — keep current and let caller handle
        logger.warn('PathManager', 'No path accessible');
        resolvedBasePathCache = { path: currentConfig.basePath, resolvedAt: Date.now() };
        return currentConfig.basePath;
    } catch (e) {
        logger.error('PathManager', 'Error resolving base path', {}, e instanceof Error ? e : undefined);
        return currentConfig.basePath;
    }
}

// Initialize config on module load
loadPathConfig();
