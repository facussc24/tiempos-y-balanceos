/**
 * AMFE Registry Repository
 *
 * CRUD del catalogo maestro de AMFEs (tabla amfe_registry) — espejo del
 * Listado Maestro del SGC. Una fila por AMFE, este o no cargado su contenido:
 * documentId NULL = solo metadata (el contenido vive unicamente en el servidor Y:).
 *
 * No confundir con el registry legacy de modules/amfe/amfeRegistryTypes.ts.
 *
 * @module amfeRegistryRepository
 */

import { getDatabase } from '../database';
import { logger } from '../logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AmfeCatalogEstado = 'Borrador' | 'En revision' | 'Liberado' | 'Obsoleto';
export type AmfeCatalogTipo = 'proceso' | 'maestro' | 'diseno';

/** Entrada del historial de revisiones oficiales (espejo de la hoja "Historial de Revisiones"). */
export interface AmfeCatalogHistorialEntry {
    rev: string;
    date: string;
    description: string;
    solicitante?: string;
    aprobador?: string;
    /** Vinculo a Plan de Control / documento relacionado. */
    vinculo?: string;
}

export interface AmfeCatalogEntry {
    id: string;
    amfeCode: string;
    tipo: AmfeCatalogTipo;
    producto: string;
    partNumber: string;
    cliente: string;
    proyecto: string;
    planta: string;
    estado: AmfeCatalogEstado;
    propietario: string;
    equipo: string;
    fechaCreacion: string;
    revActual: string;
    fechaUltimaRev: string;
    proximaRevision: string;
    serverPath: string;
    documentId: string | null;
    historial: AmfeCatalogHistorialEntry[];
    notas: string;
    createdAt: string;
    updatedAt: string;
}

/** Campos editables al hacer upsert (id/created* los maneja el repo). */
export type AmfeCatalogUpsert = Omit<AmfeCatalogEntry, 'id' | 'createdAt' | 'updatedAt'>;

interface RegistryRow {
    id: string;
    amfe_code: string;
    tipo: string;
    producto: string;
    part_number: string;
    cliente: string;
    proyecto: string;
    planta: string;
    estado: string;
    propietario: string;
    equipo: string;
    fecha_creacion: string;
    rev_actual: string;
    fecha_ultima_rev: string;
    proxima_revision: string;
    server_path: string;
    document_id: string | null;
    historial: string;
    notas: string;
    created_at: string;
    updated_at: string;
}

const ALL_COLUMNS = `id, amfe_code, tipo, producto, part_number, cliente, proyecto, planta,
    estado, propietario, equipo, fecha_creacion, rev_actual, fecha_ultima_rev,
    proxima_revision, server_path, document_id, historial, notas, created_at, updated_at`;

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function parseHistorial(raw: string): AmfeCatalogHistorialEntry[] {
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function rowToEntry(r: RegistryRow): AmfeCatalogEntry {
    return {
        id: r.id,
        amfeCode: r.amfe_code,
        tipo: r.tipo as AmfeCatalogTipo,
        producto: r.producto,
        partNumber: r.part_number,
        cliente: r.cliente,
        proyecto: r.proyecto,
        planta: r.planta,
        estado: r.estado as AmfeCatalogEstado,
        propietario: r.propietario,
        equipo: r.equipo,
        fechaCreacion: r.fecha_creacion,
        revActual: r.rev_actual,
        fechaUltimaRev: r.fecha_ultima_rev,
        proximaRevision: r.proxima_revision,
        serverPath: r.server_path,
        documentId: r.document_id || null,
        historial: parseHistorial(r.historial),
        notas: r.notas,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}

/** Codigos numericos primero (orden numerico), despues alfanumericos (maestros). */
function compareAmfeCodes(a: string, b: string): number {
    const na = Number(a);
    const nb = Number(b);
    const aNum = Number.isFinite(na) && a.trim() !== '';
    const bNum = Number.isFinite(nb) && b.trim() !== '';
    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    return a.localeCompare(b);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Lista el catalogo completo, numericos primero.
 * Devuelve [] ante error (p.ej. si falta la migracion 006 en Supabase).
 */
export async function listRegistry(): Promise<AmfeCatalogEntry[]> {
    try {
        const db = await getDatabase();
        const rows = await db.select<RegistryRow>(
            `SELECT ${ALL_COLUMNS} FROM amfe_registry`,
        );
        return rows.map(rowToEntry).sort((a, b) => compareAmfeCodes(a.amfeCode, b.amfeCode));
    } catch (err) {
        logger.error('AmfeRegistryRepo', 'Failed to list amfe_registry (¿falta la migracion 006_amfe_registry en Supabase?)', {}, err instanceof Error ? err : undefined);
        return [];
    }
}

export async function getByAmfeCode(amfeCode: string): Promise<AmfeCatalogEntry | null> {
    try {
        const db = await getDatabase();
        const rows = await db.select<RegistryRow>(
            `SELECT ${ALL_COLUMNS} FROM amfe_registry WHERE amfe_code = ?`,
            [amfeCode],
        );
        return rows.length > 0 ? rowToEntry(rows[0]) : null;
    } catch (err) {
        logger.error('AmfeRegistryRepo', `Failed to get amfe_registry entry ${amfeCode}`, {}, err instanceof Error ? err : undefined);
        return null;
    }
}

/**
 * Inserta o actualiza una entrada, con clave de negocio amfe_code.
 * Preserva id y created_at/created_by de la fila existente (regla del Listado:
 * si el numero ya existe se sobrescribe la fila, nunca se duplica).
 */
export async function upsertRegistryEntry(
    entry: AmfeCatalogUpsert,
    updatedBy = '',
): Promise<boolean> {
    try {
        const db = await getDatabase();
        const existing = await getByAmfeCode(entry.amfeCode);
        const historialJson = JSON.stringify(entry.historial ?? []);

        if (existing) {
            await db.execute(
                `UPDATE amfe_registry SET
                     tipo = ?, producto = ?, part_number = ?, cliente = ?, proyecto = ?,
                     planta = ?, estado = ?, propietario = ?, equipo = ?, fecha_creacion = ?,
                     rev_actual = ?, fecha_ultima_rev = ?, proxima_revision = ?, server_path = ?,
                     document_id = ?, historial = ?, notas = ?,
                     updated_at = datetime('now'), updated_by = ?
                 WHERE amfe_code = ?`,
                [
                    entry.tipo, entry.producto, entry.partNumber, entry.cliente, entry.proyecto,
                    entry.planta, entry.estado, entry.propietario, entry.equipo, entry.fechaCreacion,
                    entry.revActual, entry.fechaUltimaRev, entry.proximaRevision, entry.serverPath,
                    entry.documentId, historialJson, entry.notas,
                    updatedBy, entry.amfeCode,
                ],
            );
        } else {
            await db.execute(
                `INSERT INTO amfe_registry
                     (id, amfe_code, tipo, producto, part_number, cliente, proyecto, planta,
                      estado, propietario, equipo, fecha_creacion, rev_actual, fecha_ultima_rev,
                      proxima_revision, server_path, document_id, historial, notas,
                      created_by, updated_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    crypto.randomUUID(), entry.amfeCode, entry.tipo, entry.producto, entry.partNumber,
                    entry.cliente, entry.proyecto, entry.planta, entry.estado, entry.propietario,
                    entry.equipo, entry.fechaCreacion, entry.revActual, entry.fechaUltimaRev,
                    entry.proximaRevision, entry.serverPath, entry.documentId, historialJson,
                    entry.notas, updatedBy, updatedBy,
                ],
            );
        }
        return true;
    } catch (err) {
        logger.error('AmfeRegistryRepo', `Failed to upsert amfe_registry entry ${entry.amfeCode}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/** Vincula (o desvincula con null) el documento cargado en amfe_documents. */
export async function linkDocument(
    amfeCode: string,
    documentId: string | null,
    updatedBy = '',
): Promise<boolean> {
    try {
        const db = await getDatabase();
        await db.execute(
            `UPDATE amfe_registry
             SET document_id = ?, updated_at = datetime('now'), updated_by = ?
             WHERE amfe_code = ?`,
            [documentId, updatedBy, amfeCode],
        );
        return true;
    } catch (err) {
        logger.error('AmfeRegistryRepo', `Failed to link document for ${amfeCode}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}
