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
    countLinkedDocuments,
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

export function getAmfeBasePath(): string {
    return _amfeBasePath;
}

export function setAmfeBasePath(path: string): void {
    _amfeBasePath = path;
}

export async function initAmfeBasePath(): Promise<void> {
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
            return e.projectName.startsWith(prefix);
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
    return loadAmfe(projectName);
}

export async function deleteAmfeHierarchical(client: string, project: string, name: string): Promise<boolean> {
    const projectName = buildAmfePath(client, project, name);
    return deleteAmfe(projectName);
}

export async function deleteAmfeProject(client: string, project: string): Promise<boolean> {
    const entries = await listAmfeDocuments();
    const prefix = `${client}/${project}/`;
    const ids = entries.filter(e => e.projectName.startsWith(prefix)).map(e => e.id);
    if (ids.length === 0) return true;
    return deleteAmfeDocumentsBatch(ids);
}

export async function deleteAmfeClient(client: string): Promise<boolean> {
    const entries = await listAmfeDocuments();
    const ids = entries.filter(e => e.client === client).map(e => e.id);
    if (ids.length === 0) return true;
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
 * Repair flat project_names by rebuilding the hierarchy from client + subject.
 * Called at startup to normalize any malformed entries.
 *
 * Example: project_name="INSERTO" with client="VWA" and subject="INSERTO"
 *          → checks if "VWA/???/INSERTO" already exists
 *          → if yes, the flat entry is a duplicate → DELETE it
 *          → if no, normalize to "VWA/(Sin proyecto)/INSERTO"
 */
export async function normalizeProjectNames(): Promise<number> {
    const entries = await listAmfeDocuments();
    let repaired = 0;

    for (const entry of entries) {
        if (entry.projectName.includes('/')) continue; // already hierarchical

        const flatName = entry.projectName;
        const client = entry.client || '(Sin cliente)';

        // Check if a hierarchical entry already exists for this study name
        const duplicate = entries.find(other =>
            other.id !== entry.id &&
            other.client === entry.client &&
            other.projectName.includes('/') &&
            other.projectName.endsWith(`/${flatName}`)
        );

        if (duplicate) {
            // Flat entry is a duplicate of a hierarchical one → delete the flat entry
            logger.warn('AMFE', `Deleting duplicate flat entry "${flatName}" (id=${entry.id}) — hierarchical version exists: "${duplicate.projectName}"`);
            await deleteAmfeDocument(entry.id);
            repaired++;
        } else {
            // No hierarchical version exists — rebuild the path
            const project = '(Sin proyecto)';
            const newProjectName = buildAmfePath(client, project, flatName);
            logger.info('AMFE', `Normalizing flat project_name: "${flatName}" → "${newProjectName}"`);

            // Load full document to re-save with corrected project_name
            const fullDoc = await loadAmfeByProjectName(flatName);
            if (fullDoc) {
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
        }
    }

    if (repaired > 0) {
        logger.info('AMFE', `Normalized ${repaired} flat project name(s)`);
    }
    return repaired;
}
