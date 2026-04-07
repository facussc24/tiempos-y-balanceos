/**
 * Hojas de Operaciones Repository
 *
 * CRUD for HO documents.
 * Replaces: HO filesystem JSON persistence.
 */

import type { HoDocument } from '../../modules/hojaOperaciones/hojaOperacionesTypes';
import { normalizeHoDocument } from '../../modules/hojaOperaciones/hojaOperacionesTypes';
import { getDatabase } from '../database';
import { logger } from '../logger';
import { getCurrentUserEmail } from '../currentUser';
import { generateChecksum } from '../crypto';
import { scheduleBackup } from '../backupService';

export interface HoDocumentListItem {
    id: string;
    form_number: string;
    organization: string;
    client: string;
    part_number: string;
    part_description: string;
    linked_amfe_project: string;
    linked_cp_project: string;
    sheet_count: number;
    created_at: string;
    updated_at: string;
    created_by?: string;
    updated_by?: string;
}

/**
 * List all HO documents (metadata only).
 */
export async function listHoDocuments(): Promise<HoDocumentListItem[]> {
    try {
        const db = await getDatabase();
        return await db.select<HoDocumentListItem>(
            `SELECT id, form_number, organization, client, part_number, part_description,
                    linked_amfe_project, linked_cp_project, sheet_count, created_at, updated_at
             FROM ho_documents ORDER BY updated_at DESC`
        );
    } catch (err) {
        logger.error('HoRepo', 'Failed to list documents', {}, err instanceof Error ? err : undefined);
        return [];
    }
}

/**
 * List distinct client names from HO documents.
 */
async function listHoClients(): Promise<string[]> {
    try {
        const db = await getDatabase();
        const rows = await db.select<{ client: string }>(
            `SELECT DISTINCT client FROM ho_documents WHERE client != '' ORDER BY client`
        );
        return rows.map(r => r.client);
    } catch (err) {
        logger.error('HoRepo', 'Failed to list clients', {}, err instanceof Error ? err : undefined);
        return [];
    }
}

/**
 * List HO documents filtered by client.
 */
async function listHoByClient(client: string): Promise<HoDocumentListItem[]> {
    try {
        const db = await getDatabase();
        return await db.select<HoDocumentListItem>(
            `SELECT id, form_number, organization, client, part_number, part_description,
                    linked_amfe_project, linked_cp_project, sheet_count, created_at, updated_at
             FROM ho_documents WHERE client = ? ORDER BY updated_at DESC`,
            [client]
        );
    } catch (err) {
        logger.error('HoRepo', 'Failed to list documents by client', {}, err instanceof Error ? err : undefined);
        return [];
    }
}

/**
 * Load an HO document by ID.
 */
export async function loadHoDocument(id: string): Promise<HoDocument | null> {
    try {
        const db = await getDatabase();
        const rows = await db.select<{ data: string }>(
            'SELECT data FROM ho_documents WHERE id = ?',
            [id]
        );
        if (rows.length === 0) return null;
        const raw = JSON.parse(rows[0].data);
        return normalizeHoDocument(raw);
    } catch (err) {
        logger.error('HoRepo', `Failed to load document ${id}`, {}, err instanceof Error ? err : undefined);
        return null;
    }
}

/**
 * Load HO document by linked AMFE project name.
 */
export async function loadHoByAmfeProject(amfeProject: string): Promise<{ id: string; doc: HoDocument } | null> {
    try {
        const db = await getDatabase();
        const rows = await db.select<{ id: string; data: string }>(
            'SELECT id, data FROM ho_documents WHERE linked_amfe_project = ?',
            [amfeProject]
        );
        if (rows.length === 0) return null;
        const raw = JSON.parse(rows[0].data);
        return { id: rows[0].id, doc: normalizeHoDocument(raw) };
    } catch (err) {
        logger.error('HoRepo', `Failed to load by AMFE project: ${amfeProject}`, {}, err instanceof Error ? err : undefined);
        return null;
    }
}

/**
 * Save an HO document (insert or update).
 */
export async function saveHoDocument(id: string, doc: HoDocument, linkedAmfeId?: string, linkedCpId?: string): Promise<boolean> {
    try {
        const db = await getDatabase();
        const data = JSON.stringify(doc);
        const checksum = await generateChecksum(data);
        const h = doc.header;

        await db.execute(
            `INSERT OR REPLACE INTO ho_documents
             (id, form_number, organization, client, part_number, part_description,
              linked_amfe_project, linked_cp_project, linked_amfe_id, linked_cp_id,
              sheet_count, created_at, updated_at,
              data, checksum)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                     COALESCE((SELECT created_at FROM ho_documents WHERE id = ?), datetime('now')),
                     datetime('now'),
                     ?, ?)`,
            [
                id, h.formNumber || 'I-IN-002.4-R01', h.organization || '',
                h.client || '', h.partNumber || '', h.partDescription || '',
                h.linkedAmfeProject || '', h.linkedCpProject || '',
                linkedAmfeId ?? null, linkedCpId ?? null,
                doc.sheets.length, id,
                data, checksum,
            ]
        );
        scheduleBackup();
        return true;
    } catch (err) {
        logger.error('HoRepo', `Failed to save document ${id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/**
 * Delete an HO document (with soft-delete to trash).
 */
export async function deleteHoDocument(id: string): Promise<boolean> {
    try {
        const db = await getDatabase();

        // Soft-delete: save to trash before hard delete
        try {
            await db.execute(
                `INSERT OR REPLACE INTO deleted_documents (id, doc_type, project_name, data, deleted_at, deleted_by)
                 SELECT id, 'ho', linked_amfe_project, data, datetime('now'), ?
                 FROM ho_documents WHERE id = ?`,
                [getCurrentUserEmail(), id]
            );
            logger.info('HoRepo', `Document ${id} saved to trash before deletion`);
        } catch (trashErr) {
            logger.warn('HoRepo', `Failed to save document ${id} to trash, proceeding with delete`, {}, trashErr instanceof Error ? trashErr : undefined);
        }

        await db.execute('DELETE FROM ho_documents WHERE id = ?', [id]);
        return true;
    } catch (err) {
        logger.error('HoRepo', `Failed to delete document ${id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}
