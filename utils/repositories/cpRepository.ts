/**
 * Control Plan Repository
 *
 * CRUD for Control Plan documents via SQLite.
 * Primary source of truth for CP persistence.
 * Replaces: CP filesystem JSON persistence.
 */

import type { ControlPlanDocument } from '../../modules/controlPlan/controlPlanTypes';
import { normalizeControlPlanDocument } from '../../modules/controlPlan/controlPlanTypes';
import { getDatabase } from '../database';
import { logger } from '../logger';
import { generateChecksum } from '../crypto';
import { scheduleBackup } from '../backupService';


export interface CpDocumentListItem {
    id: string;
    project_name: string;
    control_plan_number: string;
    phase: string;
    part_number: string;
    part_name: string;
    organization: string;
    client: string;
    responsible: string;
    revision: string;
    linked_amfe_project: string;
    linked_amfe_id: string | null;
    item_count: number;
    created_at: string;
    updated_at: string;
    created_by?: string;
    updated_by?: string;
}

/**
 * List all CP documents (metadata only).
 */
export async function listCpDocuments(): Promise<CpDocumentListItem[]> {
    try {
        const db = await getDatabase();
        return await db.select<CpDocumentListItem>(
            `SELECT id, project_name, control_plan_number, phase, part_number, part_name,
                    organization, client, responsible, revision, linked_amfe_project,
                    linked_amfe_id, item_count, created_at, updated_at
             FROM cp_documents ORDER BY updated_at DESC`
        );
    } catch (err) {
        logger.error('CpRepo', 'Failed to list documents', {}, err instanceof Error ? err : undefined);
        return [];
    }
}

/**
 * Load a CP document by ID.
 */
export async function loadCpDocument(id: string): Promise<ControlPlanDocument | null> {
    try {
        const db = await getDatabase();
        const rows = await db.select<{ data: string }>(
            'SELECT data FROM cp_documents WHERE id = ?',
            [id]
        );
        if (rows.length === 0) return null;
        return normalizeControlPlanDocument(JSON.parse(rows[0].data));
    } catch (err) {
        logger.error('CpRepo', `Failed to load document ${id}`, {}, err instanceof Error ? err : undefined);
        return null;
    }
}

/**
 * Load a CP document by project name (the user-facing filename/identifier).
 */
export async function loadCpByProjectName(projectName: string): Promise<{ id: string; doc: ControlPlanDocument } | null> {
    try {
        const db = await getDatabase();
        const rows = await db.select<{ id: string; data: string }>(
            'SELECT id, data FROM cp_documents WHERE project_name = ?',
            [projectName]
        );
        if (rows.length === 0) return null;
        return { id: rows[0].id, doc: normalizeControlPlanDocument(JSON.parse(rows[0].data)) };
    } catch (err) {
        logger.error('CpRepo', `Failed to load by project name: ${projectName}`, {}, err instanceof Error ? err : undefined);
        return null;
    }
}

/**
 * Load a CP document by linked AMFE project name.
 */
export async function loadCpByAmfeProject(amfeProject: string): Promise<{ id: string; doc: ControlPlanDocument } | null> {
    try {
        const db = await getDatabase();
        const rows = await db.select<{ id: string; data: string }>(
            'SELECT id, data FROM cp_documents WHERE linked_amfe_project = ?',
            [amfeProject]
        );
        if (rows.length === 0) return null;
        return { id: rows[0].id, doc: normalizeControlPlanDocument(JSON.parse(rows[0].data)) };
    } catch (err) {
        logger.error('CpRepo', `Failed to load by AMFE project: ${amfeProject}`, {}, err instanceof Error ? err : undefined);
        return null;
    }
}

/**
 * Save a CP document (insert or update).
 * @param id - UUID for the document row
 * @param projectName - User-facing project name (used as lookup key by pathManager)
 * @param doc - The full ControlPlanDocument
 * @param linkedAmfeId - Optional linked AMFE document UUID
 */
export async function saveCpDocument(
    id: string,
    projectName: string,
    doc: ControlPlanDocument,
    linkedAmfeId?: string
): Promise<boolean> {
    try {
        const db = await getDatabase();
        const data = JSON.stringify(doc);
        const checksum = await generateChecksum(data);
        const h = doc.header;

        await db.execute(
            `INSERT OR REPLACE INTO cp_documents
             (id, project_name, control_plan_number, phase, part_number, part_name,
              organization, client, responsible, revision, linked_amfe_project,
              linked_amfe_id, item_count, created_at, updated_at,
              data, checksum)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                     COALESCE((SELECT created_at FROM cp_documents WHERE id = ?), datetime('now')),
                     datetime('now'),
                     ?, ?)`,
            [
                id, projectName, h.controlPlanNumber || '', h.phase || 'production',
                h.partNumber || '', h.partName || '', h.organization || '',
                h.client || '', h.responsible || '', h.revision || '',
                h.linkedAmfeProject || '', linkedAmfeId ?? null,
                doc.items.length, id,
                data, checksum,
            ]
        );
        scheduleBackup();
        return true;
    } catch (err) {
        logger.error('CpRepo', `Failed to save document ${id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/**
 * Delete a CP document by ID.
 */
export async function deleteCpDocument(id: string): Promise<boolean> {
    try {
        const db = await getDatabase();
        await db.execute('DELETE FROM cp_documents WHERE id = ?', [id]);
        return true;
    } catch (err) {
        logger.error('CpRepo', `Failed to delete document ${id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/**
 * Delete a CP document by project name.
 */
export async function deleteCpByProjectName(projectName: string): Promise<boolean> {
    try {
        const db = await getDatabase();
        await db.execute('DELETE FROM cp_documents WHERE project_name = ?', [projectName]);
        return true;
    } catch (err) {
        logger.error('CpRepo', `Failed to delete document by name: ${projectName}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}
