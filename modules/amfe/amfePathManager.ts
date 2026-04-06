/**
 * AMFE Path Manager
 *
 * Backward-compatible API for AMFE document CRUD.
 * Delegates to SQLite via amfeRepository.
 *
 * NOTE: Hierarchical path functions (client/project/name) are flattened in SQLite.
 * The project_name column stores the full identifier.
 */

import type { AmfeDocument } from './amfeTypes';
import {
    listAmfeDocuments,
    loadAmfeByProjectName,
    saveAmfeDocument,
    deleteAmfeDocument,
    deleteAmfeDocumentsBatch,
    getNextAmfeNumber,
} from '../../utils/repositories/amfeRepository';
import { loadAppSettings } from '../../utils/repositories/settingsRepository';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface AmfeProjectInfo {
    name: string;
    filename: string;
    lastModified: string;
    client?: string;
    project?: string;
    header?: { subject?: string; client?: string };
}

const DEFAULT_AMFE_BASE = 'Y:\\Ingenieria\\Documentacion Gestion Ingenieria\\18. AMFE VDA';

let _amfeBasePath: string = DEFAULT_AMFE_BASE;

function getAmfeBasePath(): string {
    return _amfeBasePath;
}

function setAmfeBasePath(path: string): void {
    _amfeBasePath = path;
}

async function initAmfeBasePath(): Promise<void> {
    const settings = await loadAppSettings();
    if (settings.amfeBasePath) {
        _amfeBasePath = settings.amfeBasePath;
    }
}

export async function ensureAmfeDir(): Promise<boolean> {
    return true;
}

export async function listAmfeProjects(): Promise<AmfeProjectInfo[]> {
    const entries = await listAmfeDocuments();
    return entries.map(e => ({
        name: e.projectName,
        filename: e.projectName,
        lastModified: e.updatedAt || e.createdAt || '',
        client: e.client,
        header: { subject: e.subject, client: e.client },
    }));
}

export async function loadAmfe(name: string): Promise<AmfeDocument | null> {
    const result = await loadAmfeByProjectName(name);
    return result?.doc ?? null;
}

export async function saveAmfe(name: string, data: AmfeDocument): Promise<boolean> {
    const existing = await loadAmfeByProjectName(name);
    if (existing) {
        return saveAmfeDocument(existing.meta.id, existing.meta.amfeNumber, name, data, existing.meta.status, existing.meta.revisions);
    }
    const nextNum = await getNextAmfeNumber();
    const amfeNumber = `AMFE-${String(nextNum).padStart(3, '0')}`;
    return saveAmfeDocument(uuidv4(), amfeNumber, name, data);
}

export async function deleteAmfe(name: string): Promise<boolean> {
    const existing = await loadAmfeByProjectName(name);
    if (!existing) return false;
    return deleteAmfeDocument(existing.meta.id);
}

export async function isAmfePathAccessible(): Promise<boolean> {
    return true;
}

export async function listAmfeClients(): Promise<string[]> {
    const entries = await listAmfeDocuments();
    const clients = new Set(entries.map(e => e.client).filter(Boolean));
    return Array.from(clients).sort();
}

/**
 * Extract the project segment from a hierarchical project_name.
 * Expected format: "client/project/name". Falls back gracefully for malformed entries.
 */
function extractProject(projectName: string): string {
    const parts = projectName.split('/');
    // Standard hierarchy: "client/project/name" → parts[1]
    if (parts.length >= 3) return parts[1];
    // Two-part: "project/name" → parts[0]
    if (parts.length === 2) return parts[0];
    // Flat name (no slashes) — should not happen in production,
    // but handle gracefully by grouping under "(Sin proyecto)"
    return '(Sin proyecto)';
}

export async function listAmfeClientProjects(client: string): Promise<string[]> {
    const entries = await listAmfeDocuments();
    const projects = new Set(
        entries.filter(e => e.client === client).map(e => extractProject(e.projectName))
    );
    return Array.from(projects).sort();
}

export async function listAmfeStudies(client: string, project: string): Promise<AmfeProjectInfo[]> {
    const entries = await listAmfeDocuments();
    // Strict prefix match: "client/project/" to avoid false positives
    const prefix = `${client}/${project}/`;
    // Also match flat entries grouped under "(Sin proyecto)"
    const isSinProyecto = project === '(Sin proyecto)';

    return entries
        .filter(e => {
            if (e.client !== client) return false;
            // Match flat names (no slashes) OR hierarchical names with "(Sin proyecto)"
            if (isSinProyecto) return !e.projectName.includes('/') || e.projectName.startsWith(prefix);
            // Standard 3-part match
            if (e.projectName.startsWith(prefix)) return true;
            // Handle 2-part paths (e.g. "PWA/TELAS_PLANAS") where extractProject
            // returns parts[0] as the project. When project === parts[0], the prefix
            // "client/project/" won't match "client/name". Match these explicitly.
            const parts = e.projectName.split('/');
            if (parts.length === 2 && parts[0] === client && extractProject(e.projectName) === project) {
                return true;
            }
            return false;
        })
        .map(e => ({
            name: e.projectName.split('/').pop() || e.projectName,
            filename: e.projectName,
            lastModified: e.updatedAt || '',
            client: e.client,
            project,
            header: { subject: e.subject, client: e.client },
        }));
}

export function buildAmfePath(client: string, project: string, name: string): string {
    return `${client}/${project}/${name}`;
}

export async function ensureAmfeHierarchy(_client: string, _project: string): Promise<boolean> {
    return true;
}

export async function saveAmfeHierarchical(client: string, project: string, name: string, data: AmfeDocument): Promise<boolean> {
    const projectName = buildAmfePath(client, project, name);
    return saveAmfe(projectName, data);
}

export async function loadAmfeHierarchical(client: string, project: string, name: string): Promise<AmfeDocument | null> {
    const projectName = buildAmfePath(client, project, name);
    const result = await loadAmfe(projectName);
    if (result) return result;
    // Fallback: try 2-part path "client/name" for entries stored without the project segment
    // (e.g. "PWA/TELAS_PLANAS" instead of "PWA/PWA/TELAS_PLANAS")
    if (client === project) {
        const fallbackName = `${client}/${name}`;
        return loadAmfe(fallbackName);
    }
    return null;
}

export async function deleteAmfeHierarchical(client: string, project: string, name: string): Promise<boolean> {
    const projectName = buildAmfePath(client, project, name);
    const result = await deleteAmfe(projectName);
    if (result) return true;
    // Fallback: try 2-part path for entries stored without the project segment
    if (client === project) {
        const fallbackName = `${client}/${name}`;
        return deleteAmfe(fallbackName);
    }
    return false;
}

export async function deleteAmfeProject(client: string, project: string, options?: { force?: boolean }): Promise<boolean> {
    const entries = await listAmfeDocuments();
    const prefix = `${client}/${project}/`;
    const ids = entries.filter(e => e.projectName.startsWith(prefix)).map(e => e.id);
    if (ids.length === 0) return true;
    logger.warn('AMFE', `deleteAmfeProject: about to delete ${ids.length} document(s) from project "${client}/${project}"`);
    if (ids.length > 1 && !options?.force) {
        throw new Error(
            `Batch delete refused: ${ids.length} documents would be deleted from project "${client}/${project}". ` +
            `Pass { force: true } to confirm bulk deletion.`
        );
    }
    return deleteAmfeDocumentsBatch(ids);
}

export async function deleteAmfeClient(client: string, options?: { force?: boolean }): Promise<boolean> {
    const entries = await listAmfeDocuments();
    const ids = entries.filter(e => e.client === client).map(e => e.id);
    if (ids.length === 0) return true;
    logger.warn('AMFE', `deleteAmfeClient: about to delete ${ids.length} document(s) from client "${client}"`);
    if (ids.length > 1 && !options?.force) {
        throw new Error(
            `Batch delete refused: ${ids.length} documents would be deleted from client "${client}". ` +
            `Pass { force: true } to confirm bulk deletion.`
        );
    }
    return deleteAmfeDocumentsBatch(ids);
}

/** Re-export countLinkedDocuments for use in hooks */
export { countLinkedDocuments } from '../../utils/repositories/amfeRepository';

export async function listLooseAmfeFiles(): Promise<AmfeProjectInfo[]> {
    const entries = await listAmfeDocuments();
    // "Loose" files are those with flat project_name (no '/') — shouldn't exist in production
    return entries
        .filter(e => !e.projectName.includes('/'))
        .map(e => ({
            name: e.projectName,
            filename: e.projectName,
            lastModified: e.updatedAt || '',
            client: e.client,
            header: { subject: e.subject, client: e.client },
        }));
}

/**
 * Repair project_names by rebuilding the hierarchy from document metadata.
 * Called at startup to normalize any malformed entries.
 *
 * Handles two cases:
 * 1. Flat names (no slashes): "INSERTO" → "VWA/Patagonia/INSERTO"
 * 2. "(Sin proyecto)" entries: "VWA/(Sin proyecto)/Patagonia INSERTO" → "VWA/Patagonia/INSERTO"
 *
 * Uses header.modelYear as the project name when available.
 * If the study name starts with the project name, strips it to avoid redundancy.
 */
export async function normalizeProjectNames(): Promise<number> {
    const entries = await listAmfeDocuments();
    let repaired = 0;

    for (const entry of entries) {
        const parts = entry.projectName.split('/');
        const isFlat = !entry.projectName.includes('/');
        const isSinProyecto = parts.length >= 3 && parts[1] === '(Sin proyecto)';

        if (!isFlat && !isSinProyecto) continue; // already has proper hierarchy

        const client = entry.client || '(Sin cliente)';

        // For flat names, check if a hierarchical duplicate already exists
        if (isFlat) {
            const duplicate = entries.find(other =>
                other.id !== entry.id &&
                other.client === entry.client &&
                other.projectName.includes('/') &&
                other.projectName.endsWith(`/${entry.projectName}`)
            );

            if (duplicate) {
                logger.warn('AMFE', `Deleting duplicate flat entry "${entry.projectName}" (id=${entry.id}) — hierarchical version exists: "${duplicate.projectName}"`);
                await deleteAmfeDocument(entry.id);
                repaired++;
                continue;
            }
        }

        // Load full document to get header.modelYear for project name
        const fullDoc = await loadAmfeByProjectName(entry.projectName);
        if (!fullDoc) continue;

        const modelYear = fullDoc.doc.header.modelYear?.trim();
        const currentName = isFlat ? entry.projectName : parts[parts.length - 1];

        let project: string;
        let name: string;

        if (modelYear) {
            project = modelYear;
            // If the name starts with the project name, strip it to avoid redundancy
            // e.g. "Patagonia INSERTO" with modelYear="Patagonia" → name="INSERTO"
            if (currentName.toLowerCase().startsWith(modelYear.toLowerCase())) {
                const stripped = currentName.substring(modelYear.length).replace(/^[\s\-_/]+/, '').trim();
                // Only strip if something meaningful remains
                name = stripped || currentName;
            } else {
                name = currentName;
            }
        } else {
            project = '(Sin proyecto)';
            name = currentName;
        }

        const newProjectName = buildAmfePath(client, project, name);

        if (newProjectName === entry.projectName) continue; // no change needed

        // Check for conflicts with existing entries
        const conflict = entries.find(other =>
            other.id !== entry.id &&
            other.projectName === newProjectName
        );

        if (conflict) {
            logger.warn('AMFE', `Skipping normalization of "${entry.projectName}" — would conflict with existing "${newProjectName}"`);
            continue;
        }

        logger.info('AMFE', `Normalizing project_name: "${entry.projectName}" → "${newProjectName}"`);

        await saveAmfeDocument(
            fullDoc.meta.id,
            fullDoc.meta.amfeNumber,
            newProjectName,
            fullDoc.doc,
            fullDoc.meta.status,
            fullDoc.meta.revisions
        );
        repaired++;
    }

    if (repaired > 0) {
        logger.info('AMFE', `Normalized ${repaired} project name(s)`);
    }
    return repaired;
}

/**
 * Repair hierarchical entries where a project name is misplaced as a suffix
 * in the study name instead of being the project segment.
 *
 * Detects groups of entries under the same client/project where ALL names
 * share a common trailing word. Moves that suffix to the project position.
 *
 * Example: "VWA/2026/Top Roll Patagonia" → "VWA/Patagonia/Top Roll"
 *          "VWA/2026/Insert Patagonia"   → "VWA/Patagonia/Insert"
 *
 * Also strips the client name from study names when appended redundantly:
 *          "PWA/2026/Telas Planas PWA" → "PWA/2026/Telas Planas"
 */
export async function repairMisplacedProjectSuffix(): Promise<number> {
    const entries = await listAmfeDocuments();
    let repaired = 0;

    // Group entries by client + project
    const groups = new Map<string, typeof entries>();
    for (const entry of entries) {
        const parts = entry.projectName.split('/');
        if (parts.length < 3) continue;
        const key = `${parts[0]}/${parts[1]}`;
        const group = groups.get(key) || [];
        group.push(entry);
        groups.set(key, group);
    }

    // Track all target paths to avoid conflicts across groups
    const plannedPaths = new Set(entries.map(e => e.projectName));

    for (const [groupKey, group] of groups) {
        if (group.length < 2) continue;

        const [client, currentProject] = groupKey.split('/');

        // Get the last word of each study name
        const nameData = group.map(e => {
            const name = e.projectName.split('/').pop()!;
            const words = name.trim().split(/\s+/);
            return { entry: e, name, lastWord: words.length > 1 ? words[words.length - 1] : null };
        });

        // Check if all names share the same last word
        const commonSuffix = nameData[0].lastWord;
        if (!commonSuffix) continue;
        if (!nameData.every(d => d.lastWord === commonSuffix)) continue;

        // Determine the new project name:
        // - If suffix matches client name, just strip from names (don't create client/client/...)
        // - If suffix matches current project, just strip from names (redundant in name)
        // - Otherwise, move suffix to become the project
        const suffixIsClient = commonSuffix.toLowerCase() === client.toLowerCase();
        const suffixIsProject = commonSuffix === currentProject;
        const newProject = (suffixIsClient || suffixIsProject) ? currentProject : commonSuffix;

        // Validate all renames before applying
        const renames: Array<{ entry: typeof entries[0]; newPath: string }> = [];
        let canProceed = true;

        for (const { entry, name } of nameData) {
            const strippedName = name.replace(new RegExp(`\\s+${commonSuffix}$`, 'i'), '').trim();
            if (!strippedName) { canProceed = false; break; }

            const newPath = buildAmfePath(client, newProject, strippedName);

            // Check for conflicts
            if (plannedPaths.has(newPath) && !group.some(e => e.projectName === newPath)) {
                canProceed = false;
                break;
            }
            renames.push({ entry, newPath });
        }

        if (!canProceed) continue;

        // Apply renames
        for (const { entry, newPath } of renames) {
            const fullDoc = await loadAmfeByProjectName(entry.projectName);
            if (!fullDoc) continue;

            logger.info('AMFE', `Repairing project path: "${entry.projectName}" → "${newPath}"`);

            await saveAmfeDocument(
                fullDoc.meta.id,
                fullDoc.meta.amfeNumber,
                newPath,
                fullDoc.doc,
                fullDoc.meta.status,
                fullDoc.meta.revisions
            );

            // Update planned paths tracking
            plannedPaths.delete(entry.projectName);
            plannedPaths.add(newPath);
            repaired++;
        }
    }

    if (repaired > 0) {
        logger.info('AMFE', `Repaired ${repaired} misplaced project suffix(es)`);
    }
    return repaired;
}
