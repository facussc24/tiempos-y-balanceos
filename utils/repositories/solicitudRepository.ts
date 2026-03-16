/**
 * Solicitud Document Repository
 *
 * CRUD for solicitud_documents table.
 */

import type { SolicitudDocument, SolicitudListItem } from '../../modules/solicitud/solicitudTypes';
import { normalizeSolicitud } from '../../modules/solicitud/solicitudTypes';
import { getDatabase } from '../database';
import { logger } from '../logger';
import { generateChecksum } from '../crypto';
import { scheduleBackup } from '../backupService';
import { getCurrentUserEmail } from '../currentUser';

/**
 * List all solicitud documents (metadata only).
 */
export async function listSolicitudes(): Promise<SolicitudListItem[]> {
    try {
        const db = await getDatabase();
        return await db.select<SolicitudListItem>(
            `SELECT id, solicitud_number, tipo, codigo, descripcion, solicitante,
                    area_departamento, status, fecha_solicitud, updated_at,
                    created_by, updated_by,
                    server_folder_path, attachment_count
             FROM solicitud_documents ORDER BY updated_at DESC`
        );
    } catch (err) {
        logger.error('SolicitudRepo', 'Failed to list documents', {}, err instanceof Error ? err : undefined);
        return [];
    }
}

/**
 * Load a solicitud document by ID.
 */
export async function loadSolicitud(id: string): Promise<SolicitudDocument | null> {
    try {
        const db = await getDatabase();
        const rows = await db.select<{ data: string }>(
            'SELECT data FROM solicitud_documents WHERE id = ?',
            [id]
        );
        if (rows.length === 0) return null;
        const doc = JSON.parse(rows[0].data) as SolicitudDocument;
        return normalizeSolicitud(doc);
    } catch (err) {
        logger.error('SolicitudRepo', `Failed to load document ${id}`, {}, err instanceof Error ? err : undefined);
        return null;
    }
}

/**
 * Save a solicitud document (insert or update).
 */
export async function saveSolicitud(id: string, doc: SolicitudDocument): Promise<boolean> {
    try {
        const db = await getDatabase();
        const data = JSON.stringify(doc);
        const checksum = await generateChecksum(data);
        const h = doc.header;

        const codigo = doc.tipo === 'producto'
            ? (doc.producto?.codigo || '')
            : (doc.insumo?.codigo || '');
        const descripcion = doc.tipo === 'producto'
            ? (doc.producto?.descripcion || '')
            : (doc.insumo?.descripcion || '');

        await db.execute(
            `INSERT OR REPLACE INTO solicitud_documents
             (id, solicitud_number, tipo, codigo, descripcion, solicitante,
              area_departamento, status, fecha_solicitud, created_at, updated_at,
              created_by, updated_by, data, checksum,
              server_folder_path, attachment_count)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,
                     COALESCE((SELECT created_at FROM solicitud_documents WHERE id = ?), datetime('now')),
                     datetime('now'),
                     COALESCE((SELECT created_by FROM solicitud_documents WHERE id = ?), ?),
                     ?,
                     ?, ?, ?, ?)`,
            [
                id, h.solicitudNumber || '', doc.tipo || '', codigo, descripcion,
                h.solicitante || '', h.areaDepartamento || '', doc.status || '',
                h.fechaSolicitud || '', id,
                id, getCurrentUserEmail(),
                getCurrentUserEmail(),
                data, checksum,
                doc.serverFolderPath || '', doc.attachments?.length || 0,
            ]
        );
        scheduleBackup();
        return true;
    } catch (err) {
        logger.error('SolicitudRepo', `Failed to save document ${id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/**
 * Delete a solicitud document.
 */
export async function deleteSolicitud(id: string): Promise<boolean> {
    try {
        const db = await getDatabase();
        await db.execute('DELETE FROM solicitud_documents WHERE id = ?', [id]);
        return true;
    } catch (err) {
        logger.error('SolicitudRepo', `Failed to delete document ${id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/**
 * Get the next solicitud number in SGC-NNN format.
 * Queries MAX solicitud_number, parses the numeric part, increments, and pads to 3 digits.
 */
export async function getNextSolicitudNumber(): Promise<string> {
    try {
        const db = await getDatabase();
        const rows = await db.select<{ max_num: string | null }>(
            'SELECT MAX(solicitud_number) as max_num FROM solicitud_documents'
        );
        const maxNum = rows[0]?.max_num;
        if (!maxNum) return 'SGC-001';

        const match = maxNum.match(/SGC-(\d+)/);
        if (!match) return 'SGC-001';

        const next = parseInt(match[1], 10) + 1;
        const padded = String(next).padStart(3, '0');
        return `SGC-${padded}`;
    } catch (err) {
        logger.error('SolicitudRepo', 'Failed to get next solicitud number', {}, err instanceof Error ? err : undefined);
        return 'SGC-001';
    }
}
