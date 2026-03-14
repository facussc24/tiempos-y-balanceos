/**
 * Revision Repository
 *
 * CRUD for document revision snapshots stored in the document_revisions table.
 *
 * @module revisionRepository
 */

import type { DocumentModule } from '../revisionUtils';
export type { DocumentModule };
import { getDatabase } from '../database';
import { logger } from '../logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RevisionListItem {
    revisionLevel: string;
    description: string;
    revisedBy: string;
    parentRevisionLevel: string;
    createdAt: string;
}

interface RevisionRow {
    revision_level: string;
    description: string;
    revised_by: string;
    parent_revision_level: string;
    created_at: string;
}

interface SnapshotRow {
    snapshot_data: string;
}

interface LatestRow {
    revision_level: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Save a new revision snapshot.
 */
export async function saveRevision(
    module: DocumentModule,
    docId: string,
    level: string,
    description: string,
    revisedBy: string,
    snapshotData: string,
    snapshotChecksum?: string,
    parentLevel?: string,
): Promise<boolean> {
    try {
        const db = await getDatabase();
        await db.execute(
            `INSERT INTO document_revisions
             (module, document_id, revision_level, description, revised_by, snapshot_data, snapshot_checksum, parent_revision_level)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [module, docId, level, description, revisedBy, snapshotData, snapshotChecksum ?? null, parentLevel ?? ''],
        );
        return true;
    } catch (err) {
        logger.error('RevisionRepo', `Failed to save revision ${level} for ${module}/${docId}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/**
 * List all revisions for a document (newest first). Does NOT include snapshot_data.
 */
export async function listRevisions(
    module: DocumentModule,
    docId: string,
): Promise<RevisionListItem[]> {
    try {
        const db = await getDatabase();
        const rows = await db.select<RevisionRow>(
            `SELECT revision_level, description, revised_by, parent_revision_level, created_at
             FROM document_revisions
             WHERE module = ? AND document_id = ?
             ORDER BY created_at DESC`,
            [module, docId],
        );

        return rows.map(r => ({
            revisionLevel: r.revision_level,
            description: r.description,
            revisedBy: r.revised_by,
            parentRevisionLevel: r.parent_revision_level,
            createdAt: r.created_at,
        }));
    } catch (err) {
        logger.error('RevisionRepo', `Failed to list revisions for ${module}/${docId}`, {}, err instanceof Error ? err : undefined);
        return [];
    }
}

/**
 * Load the snapshot JSON for a specific revision level.
 * Returns the snapshot string or null if not found.
 */
export async function loadRevisionSnapshot(
    module: DocumentModule,
    docId: string,
    level: string,
): Promise<string | null> {
    try {
        const db = await getDatabase();
        const rows = await db.select<SnapshotRow>(
            `SELECT snapshot_data
             FROM document_revisions
             WHERE module = ? AND document_id = ? AND revision_level = ?`,
            [module, docId, level],
        );
        return rows.length > 0 ? rows[0].snapshot_data : null;
    } catch (err) {
        logger.error('RevisionRepo', `Failed to load snapshot ${level} for ${module}/${docId}`, {}, err instanceof Error ? err : undefined);
        return null;
    }
}

/**
 * Get the latest revision level for a document.
 * Returns 'A' if no revisions are found.
 */
export async function getLatestRevisionLevel(
    module: DocumentModule,
    docId: string,
): Promise<string> {
    try {
        const db = await getDatabase();
        const rows = await db.select<LatestRow>(
            `SELECT revision_level
             FROM document_revisions
             WHERE module = ? AND document_id = ?
             ORDER BY created_at DESC
             LIMIT 1`,
            [module, docId],
        );
        return rows.length > 0 ? rows[0].revision_level : 'A';
    } catch (err) {
        logger.error('RevisionRepo', `Failed to get latest revision for ${module}/${docId}`, {}, err instanceof Error ? err : undefined);
        return 'A';
    }
}
