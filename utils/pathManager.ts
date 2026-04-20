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
 * Default configuration using the legacy Y: share labels.
 * Web build does no filesystem probing; this is mostly metadata for exported file
 * paths / display strings.
 */
const DEFAULT_PATH_CONFIG: PathConfig = {
    basePath: 'Y:\\INGENIERIA\\Datos Software',
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
    if (typeof localStorage !== 'undefined') {
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
function loadPathConfig(): void {
    if (typeof localStorage !== 'undefined') {
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
    _client: string,
    _project: string,
    _part: string
): Promise<{ success: boolean; createdPaths: string[]; error?: string }> {
    // Web mode: no real filesystem — Supabase handles persistence.
    return { success: true, createdPaths: [] };
}

// ============================================================================
// Directory Scanning
// ============================================================================

/**
 * List all clients (top-level folders in data directory)
 */
export async function listClients(): Promise<string[]> {
    const { listProjects: listAllProjects } = await import('./repositories/projectRepository');
    const projects = await listAllProjects();
    const clients = [...new Set(projects.map(p => p.client).filter(Boolean))];
    return clients.sort();
}

/**
 * List all projects for a given client
 */
export async function listProjects(client: string): Promise<string[]> {
    const { getProjectsByClient } = await import('./repositories/projectRepository');
    const projects = await getProjectsByClient(client);
    const projectCodes = [...new Set(projects.map(p => p.project_code).filter(Boolean))];
    return projectCodes.sort();
}

/**
 * List all parts for a given client/project
 */
export async function listParts(client: string, project: string): Promise<string[]> {
    const { getProjectsByClient } = await import('./repositories/projectRepository');
    const projects = await getProjectsByClient(client);
    return projects
        .filter(p => p.project_code === project)
        .map(p => p.name)
        .sort();
}

/**
 * V5: Delete a study folder (the part folder)
 * Web mode: no filesystem operations — Supabase handles deletion via repositories.
 */
export async function deleteStudy(_studyPath: string): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: 'Delete not available in web mode' };
}

/**
 * V5: Delete a Project folder (recursively)
 * Web mode: no filesystem operations — Supabase handles deletion via repositories.
 */
export async function deleteProject(_client: string, _project: string): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: 'Delete not available in web mode' };
}

/**
 * V5: Delete a Client folder (recursively)
 * Web mode: no filesystem operations — Supabase handles deletion via repositories.
 */
export async function deleteClient(_client: string): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: 'Delete not available in web mode' };
}

/**
 * Resolve the best available base path.
 * Web mode: returns the configured basePath (no filesystem probing).
 * The UNC/legacy fallback logic only applied to the Tauri desktop build.
 */
export async function resolveBasePath(): Promise<string> {
    return currentConfig.basePath;
}

// Initialize config on module load
loadPathConfig();
