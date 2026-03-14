/**
 * Merge Engine
 *
 * Compares two datasets (local vs remote) and produces a MergeResult
 * describing which records are new, updated, conflicting, or unchanged.
 *
 * Used by both manual import (dataExportImport) and folder sync (folderSyncService).
 *
 * Strategy: "last-write-wins" per record, with conflict detection when
 * both sides changed and timestamps are identical.
 */

import { logger } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single table row as stored in the backup/export JSON. */
export interface ExportRecord {
    id: string | number;
    updated_at?: string;
    created_at?: string;
    checksum?: string | null;
    data?: string;
    [key: string]: unknown;
}

/** Full exported dataset (matches backup JSON format). */
export interface ExportDataset {
    version: number;
    appVersion?: string;
    schemaVersion: number;
    createdAt: string;
    deviceId?: string;
    deviceName?: string;
    tables: Record<string, ExportRecord[]>;
}

export interface MergeConflict {
    table: string;
    id: string | number;
    localRecord: ExportRecord;
    remoteRecord: ExportRecord;
    /** Human-readable label, e.g. "AMFE - Asiento" */
    label: string;
}

export interface MergeAction {
    table: string;
    record: ExportRecord;
    /** For updates only: the current local version being replaced. */
    localVersion?: ExportRecord;
}

export interface MergeResult {
    added: MergeAction[];
    updated: MergeAction[];
    conflicts: MergeConflict[];
    skipped: number;
    summary: string;
}

export type ConflictResolution = 'keepLocal' | 'keepRemote' | 'keepBoth';

export interface ResolvedConflict {
    table: string;
    id: string | number;
    resolution: ConflictResolution;
}

// ---------------------------------------------------------------------------
// Table metadata: which column holds the ID and the human-friendly label
// ---------------------------------------------------------------------------

interface TableMeta {
    idCol: string;
    labelCols: string[];
}

const TABLE_META: Record<string, TableMeta> = {
    projects:               { idCol: 'id', labelCols: ['name', 'client'] },
    amfe_documents:         { idCol: 'id', labelCols: ['project_name', 'amfe_number'] },
    amfe_library_operations:{ idCol: 'id', labelCols: ['name', 'op_number'] },
    cp_documents:           { idCol: 'id', labelCols: ['project_name', 'control_plan_number'] },
    ho_documents:           { idCol: 'id', labelCols: ['form_number', 'part_description'] },
    pfd_documents:          { idCol: 'id', labelCols: ['part_name', 'document_number'] },
    solicitud_documents:    { idCol: 'id', labelCols: ['solicitud_number', 'descripcion'] },
    products:               { idCol: 'id', labelCols: ['codigo', 'descripcion'] },
    customer_lines:         { idCol: 'id', labelCols: ['code', 'name'] },
    product_families:       { idCol: 'id', labelCols: ['name'] },
    product_family_members: { idCol: 'id', labelCols: ['family_id', 'product_id'] },
    settings:               { idCol: 'key', labelCols: ['key'] },
};

/** Tables to skip during merge (internal tracking only). */
const SKIP_TABLES = new Set([
    'schema_version',
    'drafts',
    'pending_exports',
    'recent_projects',
    'cross_doc_checks',
    'document_revisions',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRecordId(table: string, record: ExportRecord): string | number {
    const meta = TABLE_META[table];
    const col = meta?.idCol ?? 'id';
    return (record as Record<string, unknown>)[col] as string | number;
}

function getRecordLabel(table: string, record: ExportRecord): string {
    const meta = TABLE_META[table];
    if (!meta) return String(getRecordId(table, record));
    return meta.labelCols
        .map(c => (record as Record<string, unknown>)[c])
        .filter(Boolean)
        .join(' - ') || String(getRecordId(table, record));
}

function parseTimestamp(ts: string | undefined | null): number {
    if (!ts) return 0;
    const d = new Date(ts);
    return isNaN(d.getTime()) ? 0 : d.getTime();
}

function recordsEqual(a: ExportRecord, b: ExportRecord): boolean {
    // Fast path: checksum comparison
    if (a.checksum && b.checksum) return a.checksum === b.checksum;
    // Slow path: compare data blobs
    if (a.data && b.data) return a.data === b.data;
    // Fallback: JSON comparison (excluding timestamps)
    const { updated_at: _a1, created_at: _a2, ...restA } = a;
    const { updated_at: _b1, created_at: _b2, ...restB } = b;
    return JSON.stringify(restA) === JSON.stringify(restB);
}

// ---------------------------------------------------------------------------
// Main merge function
// ---------------------------------------------------------------------------

/**
 * Compare local and remote datasets, producing a list of changes.
 * Does NOT modify any data — the caller decides what to apply.
 */
export function analyzeDatasets(
    local: ExportDataset,
    remote: ExportDataset,
): MergeResult {
    const added: MergeAction[] = [];
    const updated: MergeAction[] = [];
    const conflicts: MergeConflict[] = [];
    let skipped = 0;

    const allTables = new Set([
        ...Object.keys(local.tables),
        ...Object.keys(remote.tables),
    ]);

    for (const table of allTables) {
        if (SKIP_TABLES.has(table)) continue;

        const localRows = local.tables[table] ?? [];
        const remoteRows = remote.tables[table] ?? [];

        // Build local index by ID
        const localIndex = new Map<string | number, ExportRecord>();
        for (const row of localRows) {
            localIndex.set(getRecordId(table, row), row);
        }

        for (const remoteRow of remoteRows) {
            const id = getRecordId(table, remoteRow);
            const localRow = localIndex.get(id);

            if (!localRow) {
                // New record — doesn't exist locally
                added.push({ table, record: remoteRow });
                continue;
            }

            if (recordsEqual(localRow, remoteRow)) {
                // Identical content — skip
                skipped++;
                continue;
            }

            // Content differs — check timestamps
            const localTs = parseTimestamp(localRow.updated_at);
            const remoteTs = parseTimestamp(remoteRow.updated_at);

            if (remoteTs > localTs) {
                // Remote is newer — auto-update
                updated.push({ table, record: remoteRow, localVersion: localRow });
            } else if (localTs > remoteTs) {
                // Local is newer — skip (we already have the latest)
                skipped++;
            } else {
                // Same timestamp but different content — conflict
                conflicts.push({
                    table,
                    id,
                    localRecord: localRow,
                    remoteRecord: remoteRow,
                    label: getRecordLabel(table, remoteRow),
                });
            }
        }
    }

    const parts: string[] = [];
    if (added.length) parts.push(`${added.length} nuevos`);
    if (updated.length) parts.push(`${updated.length} actualizados`);
    if (conflicts.length) parts.push(`${conflicts.length} conflictos`);
    if (skipped) parts.push(`${skipped} sin cambios`);
    const summary = parts.join(', ') || 'Sin cambios';

    logger.info('MergeEngine', 'Analysis complete', { added: added.length, updated: updated.length, conflicts: conflicts.length, skipped });

    return { added, updated, conflicts, skipped, summary };
}

/**
 * Given a MergeResult and user-chosen conflict resolutions,
 * produce the final flat list of records to write into the DB.
 */
export function resolveMerge(
    result: MergeResult,
    resolutions: ResolvedConflict[],
): MergeAction[] {
    const actions: MergeAction[] = [];

    // All "added" go in
    actions.push(...result.added);

    // All "updated" go in (remote was newer)
    actions.push(...result.updated);

    // Apply conflict resolutions
    const resMap = new Map<string, ConflictResolution>();
    for (const r of resolutions) {
        resMap.set(`${r.table}:${r.id}`, r.resolution);
    }

    for (const conflict of result.conflicts) {
        const key = `${conflict.table}:${conflict.id}`;
        const resolution = resMap.get(key) ?? 'keepLocal';

        if (resolution === 'keepRemote') {
            actions.push({ table: conflict.table, record: conflict.remoteRecord });
        } else if (resolution === 'keepBoth') {
            // Create a copy of the remote record with a new ID
            const copy = { ...conflict.remoteRecord };
            const origId = String(conflict.id);
            (copy as Record<string, unknown>).id = `${origId}_imported_${Date.now()}`;
            actions.push({ table: conflict.table, record: copy as ExportRecord });
        }
        // keepLocal = do nothing (keep what we have)
    }

    return actions;
}

// ---------------------------------------------------------------------------
// Utility: count records per table for preview
// ---------------------------------------------------------------------------

export interface TableCount {
    table: string;
    count: number;
}

export function countByTable(dataset: ExportDataset): TableCount[] {
    return Object.entries(dataset.tables)
        .filter(([t]) => !SKIP_TABLES.has(t))
        .map(([table, rows]) => ({ table, count: rows.length }))
        .filter(tc => tc.count > 0);
}

/** Human-friendly table names for the UI. */
export const TABLE_LABELS: Record<string, string> = {
    projects: 'Proyectos (Tiempos)',
    amfe_documents: 'Documentos AMFE',
    amfe_library_operations: 'Biblioteca de Operaciones',
    cp_documents: 'Planes de Control',
    ho_documents: 'Hojas de Operaciones',
    pfd_documents: 'Diagramas de Flujo',
    solicitud_documents: 'Solicitudes de Codigo',
    products: 'Productos',
    customer_lines: 'Lineas de Cliente',
    product_families: 'Familias de Producto',
    product_family_members: 'Miembros de Familia',
    settings: 'Configuracion',
};
