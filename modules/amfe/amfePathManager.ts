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

export async function listAmfeClientProjects(client: string): Promise<string[]> {
    const entries = await listAmfeDocuments();
    const projects = new Set(
        entries.filter(e => e.client === client).map(e => {
            const parts = e.projectName.split('/');
            return parts.length > 1 ? parts[1] : e.projectName;
        })
    );
    return Array.from(projects).sort();
}

export async function listAmfeStudies(client: string, project: string): Promise<AmfeProjectInfo[]> {
    const entries = await listAmfeDocuments();
    return entries
        .filter(e => e.client === client && e.projectName.includes(project))
        .map(e => ({
            name: e.projectName,
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
    let allOk = true;
    for (const e of entries) {
        if (e.projectName.startsWith(prefix)) {
            const ok = await deleteAmfeDocument(e.id);
            if (!ok) allOk = false;
        }
    }
    return allOk;
}

export async function deleteAmfeClient(client: string): Promise<boolean> {
    const entries = await listAmfeDocuments();
    let allOk = true;
    for (const e of entries) {
        if (e.client === client) {
            const ok = await deleteAmfeDocument(e.id);
            if (!ok) allOk = false;
        }
    }
    return allOk;
}

export async function listLooseAmfeFiles(): Promise<AmfeProjectInfo[]> {
    return [];
}
