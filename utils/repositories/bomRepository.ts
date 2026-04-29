/**
 * BOM Repository — CRUD para documentos BOM (Lista de Materiales).
 *
 * Patron analogo a amfeRepository / cpRepository / hoRepository:
 * - Documento JSONB en columna `data`
 * - Metadata desnormalizada en columnas para queries rapidas (cliente, familia, status)
 * - INSERT OR REPLACE para upsert
 */

import type { BomDocument, BomRegistryEntry, BomLifecycleStatus } from '../../modules/bom/bomTypes';
import { createEmptyBomDoc } from '../../modules/bom/bomInitialData';
import { getDatabase } from '../database';
import { logger } from '../logger';
import { getCurrentUserEmail } from '../currentUser';
import { generateChecksum } from '../crypto';
import { scheduleBackup } from '../backupService';

// ---------------------------------------------------------------------------
// Normalizacion (previene crashes al leer JSON parseado)
// ---------------------------------------------------------------------------

function normalizeBomDoc(doc: BomDocument): void {
    const defaults = createEmptyBomDoc();
    if (!doc.header) doc.header = { ...defaults.header };
    for (const key of Object.keys(defaults.header) as (keyof typeof defaults.header)[]) {
        if (doc.header[key] == null) {
            (doc.header as unknown as Record<string, string>)[key] = defaults.header[key];
        }
    }
    if (typeof doc.imagenProducto !== 'string') doc.imagenProducto = '';
    if (!Array.isArray(doc.groups)) doc.groups = [];
    for (const g of doc.groups) {
        if (!Array.isArray(g.items)) g.items = [];
        for (const item of g.items) {
            item.numero = item.numero ?? '';
            item.codigoInterno = item.codigoInterno ?? '';
            item.codigoProveedor = item.codigoProveedor ?? '';
            item.descripcion = item.descripcion ?? '';
            item.consumo = item.consumo ?? '';
            item.unidad = item.unidad ?? '';
            item.proveedor = item.proveedor ?? '';
            item.imagen = item.imagen ?? '';
            item.leaderX = typeof item.leaderX === 'number' ? item.leaderX : 0;
            item.leaderY = typeof item.leaderY === 'number' ? item.leaderY : 0;
            item.observaciones = item.observaciones ?? '';
        }
    }
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export function computeBomStats(doc: BomDocument): { itemCount: number; groupCount: number } {
    let itemCount = 0;
    let groupCount = 0;
    for (const g of doc.groups) {
        if (g.items.length > 0) {
            groupCount++;
            itemCount += g.items.length;
        }
    }
    return { itemCount, groupCount };
}

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

export interface BomDocumentRow {
    id: string;
    bom_number: string;
    part_number: string;
    descripcion: string;
    cliente: string;
    proyecto: string;
    familia: string;
    family_id: number | null;
    revision: string;
    status: BomLifecycleStatus;
    item_count: number;
    group_count: number;
    fecha_emision: string;
    elaborado_por: string;
    aprobado_por: string;
    created_at: string;
    updated_at: string;
    created_by: string;
    updated_by: string;
    data: string;
    checksum: string | null;
}

function rowToEntry(r: BomDocumentRow): BomRegistryEntry {
    return {
        id: r.id,
        bomNumber: r.bom_number,
        partNumber: r.part_number,
        descripcion: r.descripcion,
        cliente: r.cliente,
        proyecto: r.proyecto,
        familia: r.familia,
        revision: r.revision,
        status: r.status,
        itemCount: r.item_count,
        groupCount: r.group_count,
        fechaEmision: r.fecha_emision,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        createdBy: r.created_by ?? '',
        updatedBy: r.updated_by ?? '',
    };
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listBomDocuments(): Promise<BomRegistryEntry[]> {
    try {
        const db = await getDatabase();
        const rows = await db.select<BomDocumentRow>(
            `SELECT id, bom_number, part_number, descripcion, cliente, proyecto, familia,
                    family_id, revision, status, item_count, group_count, fecha_emision,
                    elaborado_por, aprobado_por,
                    created_at, updated_at, created_by, updated_by
             FROM bom_documents ORDER BY updated_at DESC`
        );
        return rows.map(rowToEntry);
    } catch (err) {
        logger.error('BomRepo', 'Failed to list documents', {}, err instanceof Error ? err : undefined);
        return [];
    }
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

export async function loadBomDocument(id: string): Promise<{ doc: BomDocument; meta: BomRegistryEntry } | null> {
    try {
        const db = await getDatabase();
        const rows = await db.select<BomDocumentRow>(
            'SELECT * FROM bom_documents WHERE id = ?',
            [id]
        );
        if (rows.length === 0) return null;
        const r = rows[0];
        const doc = JSON.parse(r.data) as BomDocument;
        normalizeBomDoc(doc);
        return { doc, meta: rowToEntry(r) };
    } catch (err) {
        logger.error('BomRepo', `Failed to load document ${id}`, {}, err instanceof Error ? err : undefined);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Save (insert or update)
// ---------------------------------------------------------------------------

export async function saveBomDocument(
    id: string,
    bomNumber: string,
    doc: BomDocument,
    status: BomLifecycleStatus = 'draft',
    familyId: number | null = null,
): Promise<boolean> {
    try {
        const db = await getDatabase();
        const data = JSON.stringify(doc);
        const checksum = await generateChecksum(data);
        const stats = computeBomStats(doc);
        const h = doc.header;
        const byEmail = getCurrentUserEmail();

        await db.execute(
            `INSERT OR REPLACE INTO bom_documents
             (id, bom_number, part_number, descripcion, cliente, proyecto, familia,
              family_id, revision, status, item_count, group_count,
              fecha_emision, elaborado_por, aprobado_por,
              created_at, updated_at, created_by, updated_by,
              data, checksum)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                     COALESCE((SELECT created_at FROM bom_documents WHERE id = ?), datetime('now')),
                     datetime('now'),
                     COALESCE((SELECT created_by FROM bom_documents WHERE id = ?), ?),
                     ?, ?, ?)`,
            [
                id, bomNumber,
                h.partNumber || '', h.descripcion || '',
                h.cliente || '', h.proyecto || '', h.familia || '',
                familyId,
                h.revision || 'A', status,
                stats.itemCount, stats.groupCount,
                h.fechaEmision || '', h.elaboradoPor || '', h.aprobadoPor || '',
                id, id, byEmail,
                byEmail,
                data, checksum,
            ]
        );
        scheduleBackup();
        return true;
    } catch (err) {
        logger.error('BomRepo', `Failed to save document ${id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteBomDocument(id: string): Promise<boolean> {
    try {
        const db = await getDatabase();
        await db.execute('DELETE FROM bom_documents WHERE id = ?', [id]);
        return true;
    } catch (err) {
        logger.error('BomRepo', `Failed to delete document ${id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}
