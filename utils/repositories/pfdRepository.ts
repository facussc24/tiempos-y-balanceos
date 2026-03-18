/**
 * PFD Document Repository
 *
 * CRUD for Process Flow Diagram documents.
 */

import type { PfdDocument, PfdDocumentListItem } from '../../modules/pfd/pfdTypes';
import { normalizePfdStep } from '../../modules/pfd/pfdNormalize';
import { getDatabase } from '../database';
import { logger } from '../logger';
import { generateChecksum } from '../crypto';
import { scheduleBackup } from '../backupService';

/**
 * List all PFD documents (metadata only).
 */
export async function listPfdDocuments(): Promise<PfdDocumentListItem[]> {
    try {
        const db = await getDatabase();
        return await db.select<PfdDocumentListItem>(
            `SELECT id, part_number, part_name, document_number, revision_level,
                    revision_date, customer_name, customer_name AS client, step_count, updated_at
             FROM pfd_documents ORDER BY updated_at DESC`
        );
    } catch (err) {
        logger.error('PfdRepo', 'Failed to list documents', {}, err instanceof Error ? err : undefined);
        return [];
    }
}

/**
 * List distinct client names from PFD documents.
 */
export async function listPfdClients(): Promise<string[]> {
    try {
        const db = await getDatabase();
        const rows = await db.select<{ client: string }>(
            `SELECT DISTINCT customer_name AS client FROM pfd_documents WHERE customer_name != '' ORDER BY customer_name`
        );
        return rows.map(r => r.client);
    } catch (err) {
        logger.error('PfdRepo', 'Failed to list clients', {}, err instanceof Error ? err : undefined);
        return [];
    }
}

/**
 * List PFD documents filtered by client.
 */
export async function listPfdByClient(client: string): Promise<PfdDocumentListItem[]> {
    try {
        const db = await getDatabase();
        return await db.select<PfdDocumentListItem>(
            `SELECT id, part_number, part_name, document_number, revision_level,
                    revision_date, customer_name, customer_name AS client, step_count, updated_at
             FROM pfd_documents WHERE customer_name = ? ORDER BY updated_at DESC`,
            [client]
        );
    } catch (err) {
        logger.error('PfdRepo', 'Failed to list documents by client', {}, err instanceof Error ? err : undefined);
        return [];
    }
}

/**
 * Load a PFD document by ID.
 */
export async function loadPfdDocument(id: string): Promise<PfdDocument | null> {
    try {
        const db = await getDatabase();
        const rows = await db.select<{ data: string }>(
            'SELECT data FROM pfd_documents WHERE id = ?',
            [id]
        );
        if (rows.length === 0) return null;
        const doc = JSON.parse(rows[0].data) as PfdDocument;
        // Normalize steps for backward compat (old docs missing new fields)
        if (doc.steps && Array.isArray(doc.steps)) {
            doc.steps = doc.steps.map(s =>
                normalizePfdStep(s as unknown as Record<string, unknown> & { id: string })
            );
        }
        return doc;
    } catch (err) {
        logger.error('PfdRepo', `Failed to load document ${id}`, {}, err instanceof Error ? err : undefined);
        return null;
    }
}

/**
 * Load a PFD document by linked AMFE project name.
 * Primary: query the linked_amfe_project column.
 * Fallback: scan all PFDs and check header.linkedAmfeProject in JSON data
 * (needed when the column doesn't exist yet, e.g. Supabase before manual migration).
 */
export async function loadPfdByAmfeProject(amfeProject: string): Promise<{ id: string; doc: PfdDocument } | null> {
    try {
        const db = await getDatabase();

        // Primary: column-based query
        let rows: { id: string; data: string }[] = [];
        try {
            rows = await db.select<{ id: string; data: string }>(
                'SELECT id, data FROM pfd_documents WHERE linked_amfe_project = ?',
                [amfeProject]
            );
        } catch {
            // Column may not exist yet (Supabase without manual migration) — continue to fallback
        }

        // Fallback: scan JSON data for linkedAmfeProject in header
        if (rows.length === 0) {
            const allRows = await db.select<{ id: string; data: string }>(
                'SELECT id, data FROM pfd_documents'
            );
            for (const row of allRows) {
                try {
                    const parsed = JSON.parse(row.data);
                    if (parsed.header?.linkedAmfeProject === amfeProject) {
                        rows = [row];
                        break;
                    }
                } catch { /* skip malformed */ }
            }
        }

        if (rows.length === 0) return null;
        const doc = JSON.parse(rows[0].data) as PfdDocument;
        if (doc.steps && Array.isArray(doc.steps)) {
            doc.steps = doc.steps.map(s =>
                normalizePfdStep(s as unknown as Record<string, unknown> & { id: string })
            );
        }
        return { id: rows[0].id, doc };
    } catch (err) {
        logger.error('PfdRepo', `Failed to load by AMFE project: ${amfeProject}`, {}, err instanceof Error ? err : undefined);
        return null;
    }
}

/**
 * Save a PFD document (insert or update).
 */
export async function savePfdDocument(id: string, doc: PfdDocument, client?: string): Promise<boolean> {
    try {
        const db = await getDatabase();
        const data = JSON.stringify(doc);
        const checksum = await generateChecksum(data);
        const h = doc.header;
        // Client: explicit param > header.customerName > ''
        const resolvedClient = client ?? h.customerName ?? '';
        const linkedAmfeProject = h.linkedAmfeProject || '';

        await db.execute(
            `INSERT OR REPLACE INTO pfd_documents
             (id, part_number, part_name, document_number, revision_level,
              revision_date, customer_name, linked_amfe_project, step_count,
              created_at, updated_at,
              data, checksum)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,
                     COALESCE((SELECT created_at FROM pfd_documents WHERE id = ?), datetime('now')),
                     datetime('now'),
                     ?, ?)`,
            [
                id, h.partNumber || '', h.partName || '', h.documentNumber || '',
                h.revisionLevel || 'A', h.revisionDate || '',
                resolvedClient, linkedAmfeProject, doc.steps.length, id,
                data, checksum,
            ]
        );
        scheduleBackup();
        return true;
    } catch (err) {
        logger.error('PfdRepo', `Failed to save document ${id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/**
 * Delete a PFD document.
 */
export async function deletePfdDocument(id: string): Promise<boolean> {
    try {
        const db = await getDatabase();
        await db.execute('DELETE FROM pfd_documents WHERE id = ?', [id]);
        return true;
    } catch (err) {
        logger.error('PfdRepo', `Failed to delete document ${id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}
