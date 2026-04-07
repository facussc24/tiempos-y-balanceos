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
import { getCurrentUserEmail } from '../currentUser';


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
 * List distinct client names from CP documents.
 */
export async function listCpClients(): Promise<string[]> {
    try {
        const db = await getDatabase();
        const rows = await db.select<{ client: string }>(
            `SELECT DISTINCT client FROM cp_documents WHERE client != '' ORDER BY client`
        );
        return rows.map(r => r.client);
    } catch (err) {
        logger.error('CpRepo', 'Failed to list clients', {}, err instanceof Error ? err : undefined);
        return [];
    }
}

/**
 * List CP documents filtered by client.
 */
export async function listCpByClient(client: string): Promise<CpDocumentListItem[]> {
    try {
        const db = await getDatabase();
        return await db.select<CpDocumentListItem>(
            `SELECT id, project_name, control_plan_number, phase, part_number, part_name,
                    organization, client, responsible, revision, linked_amfe_project,
                    linked_amfe_id, item_count, created_at, updated_at
             FROM cp_documents WHERE client = ? ORDER BY updated_at DESC`,
            [client]
        );
    } catch (err) {
        logger.error('CpRepo', 'Failed to list documents by client', {}, err instanceof Error ? err : undefined);
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
    linkedAmfeId?: string,
    modifiedBy?: { email: string; type: 'user' | 'ai' },
): Promise<boolean> {
    try {
        const db = await getDatabase();
        const data = JSON.stringify(doc);
        const checksum = await generateChecksum(data);
        const h = doc.header;
        const byEmail = modifiedBy?.email || getCurrentUserEmail();
        const byType = modifiedBy?.type || 'user';

        await db.execute(
            `INSERT OR REPLACE INTO cp_documents
             (id, project_name, control_plan_number, phase, part_number, part_name,
              organization, client, responsible, revision, linked_amfe_project,
              linked_amfe_id, item_count,
              created_at, updated_at, created_by, updated_by, modified_by_type,
              data, checksum)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                     COALESCE((SELECT created_at FROM cp_documents WHERE id = ?), datetime('now')),
                     datetime('now'),
                     COALESCE((SELECT created_by FROM cp_documents WHERE id = ?), ?),
                     ?, ?,
                     ?, ?)`,
            [
                id, projectName, h.controlPlanNumber || '', h.phase || 'preLaunch',
                h.partNumber || '', h.partName || '', h.organization || '',
                h.client || '', h.responsible || '', h.revision || '',
                h.linkedAmfeProject || '', linkedAmfeId ?? null,
                doc.items.length,
                id, id, byEmail,
                byEmail, byType,
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
 * Delete a CP document by ID (with soft-delete to trash).
 */
async function deleteCpDocument(id: string): Promise<boolean> {
    try {
        const db = await getDatabase();

        // Soft-delete: save to trash before hard delete
        try {
            await db.execute(
                `INSERT OR REPLACE INTO deleted_documents (id, doc_type, project_name, data, deleted_at, deleted_by)
                 SELECT id, 'cp', project_name, data, datetime('now'), ?
                 FROM cp_documents WHERE id = ?`,
                [getCurrentUserEmail(), id]
            );
            logger.info('CpRepo', `Document ${id} saved to trash before deletion`);
        } catch (trashErr) {
            logger.warn('CpRepo', `Failed to save document ${id} to trash, proceeding with delete`, {}, trashErr instanceof Error ? trashErr : undefined);
        }

        await db.execute('DELETE FROM cp_documents WHERE id = ?', [id]);
        return true;
    } catch (err) {
        logger.error('CpRepo', `Failed to delete document ${id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/**
 * Delete a CP document by project name (with soft-delete to trash).
 */
export async function deleteCpByProjectName(projectName: string): Promise<boolean> {
    try {
        const db = await getDatabase();

        // Soft-delete: save to trash before hard delete
        try {
            await db.execute(
                `INSERT OR REPLACE INTO deleted_documents (id, doc_type, project_name, data, deleted_at, deleted_by)
                 SELECT id, 'cp', project_name, data, datetime('now'), ?
                 FROM cp_documents WHERE project_name = ?`,
                [getCurrentUserEmail(), projectName]
            );
            logger.info('CpRepo', `CP document(s) for project '${projectName}' saved to trash before deletion`);
        } catch (trashErr) {
            logger.warn('CpRepo', `Failed to save CP document(s) for project '${projectName}' to trash, proceeding with delete`, {}, trashErr instanceof Error ? trashErr : undefined);
        }

        await db.execute('DELETE FROM cp_documents WHERE project_name = ?', [projectName]);
        return true;
    } catch (err) {
        logger.error('CpRepo', `Failed to delete document by name: ${projectName}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

// ---------------------------------------------------------------------------
// Validated save wrapper (for AI-driven modifications)
// ---------------------------------------------------------------------------

import type { AmfeDocument } from '../../modules/amfe/amfeTypes';
import { validateCpAgainstAmfe } from '../../modules/controlPlan/cpCrossValidation';
import type { SaveValidationResult } from './validationTypes';

/**
 * Validate a CP document against its linked AMFE, then save only if no errors.
 * Warnings are returned but do NOT block save.
 *
 * Existing `saveCpDocument()` is NOT modified — this is a new wrapper.
 */
export async function validateAndSaveCpDocument(
    id: string,
    projectName: string,
    doc: ControlPlanDocument,
    linkedAmfeId?: string,
    amfeDoc?: AmfeDocument,
): Promise<SaveValidationResult & { saved: boolean }> {
    const issues = validateCpAgainstAmfe(doc, amfeDoc);
    const errors = issues.filter(i => i.severity === 'error').map(i => i.message);
    const warnings = issues.filter(i => i.severity === 'warning').map(i => i.message);

    if (errors.length > 0) {
        return { valid: false, errors, warnings, saved: false };
    }

    const saved = await saveCpDocument(id, projectName, doc, linkedAmfeId);
    return { valid: true, errors: [], warnings, saved };
}
