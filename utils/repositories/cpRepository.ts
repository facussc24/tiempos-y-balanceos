/**
 * Control Plan Repository
 *
 * CRUD for Control Plan documents.
 * Replaces: CP filesystem JSON persistence.
 */

import type { ControlPlanDocument } from '../../modules/controlPlan/controlPlanTypes';
import { getDatabase } from '../database';
import { logger } from '../logger';
import { generateChecksum } from '../crypto';

export interface CpDocumentListItem {
    id: string;
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
}

/**
 * List all CP documents (metadata only).
 */
export async function listCpDocuments(): Promise<CpDocumentListItem[]> {
    try {
        const db = await getDatabase();
        return await db.select<CpDocumentListItem>(
            `SELECT id, control_plan_number, phase, part_number, part_name, organization,
                    client, responsible, revision, linked_amfe_project, linked_amfe_id,
                    item_count, created_at, updated_at
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
        return JSON.parse(rows[0].data) as ControlPlanDocument;
    } catch (err) {
        logger.error('CpRepo', `Failed to load document ${id}`, {}, err instanceof Error ? err : undefined);
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
        return { id: rows[0].id, doc: JSON.parse(rows[0].data) as ControlPlanDocument };
    } catch (err) {
        logger.error('CpRepo', `Failed to load by AMFE project: ${amfeProject}`, {}, err instanceof Error ? err : undefined);
        return null;
    }
}

/**
 * Save a CP document (insert or update).
 */
export async function saveCpDocument(id: string, doc: ControlPlanDocument, linkedAmfeId?: string): Promise<boolean> {
    try {
        const db = await getDatabase();
        const data = JSON.stringify(doc);
        const checksum = await generateChecksum(data);
        const h = doc.header;

        await db.execute(
            `INSERT OR REPLACE INTO cp_documents
             (id, control_plan_number, phase, part_number, part_name, organization,
              client, responsible, revision, linked_amfe_project, linked_amfe_id,
              item_count, updated_at, data, checksum)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)`,
            [
                id, h.controlPlanNumber || '', h.phase || 'production',
                h.partNumber || '', h.partName || '', h.organization || '',
                h.client || '', h.responsible || '', h.revision || '',
                h.linkedAmfeProject || '', linkedAmfeId ?? null,
                doc.items.length, data, checksum,
            ]
        );
        return true;
    } catch (err) {
        logger.error('CpRepo', `Failed to save document ${id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/**
 * Delete a CP document.
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
