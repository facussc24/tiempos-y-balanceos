/**
 * Flowchart Document Repository
 *
 * CRUD for process flow diagrams generated via JSON.
 */

import type { FlowchartDocument } from '../../modules/flowchart/flowchartTypes';
import { getDatabase } from '../database';
import { logger } from '../logger';

/**
 * Ensures the required schema exists for Flowchart documents.
 * This safely bypasses database.ts schema_version to avoid polluting migrations
 * while maintaining the correct SQLite schema structure.
 */
async function ensureSchema() {
    try {
        const db = await getDatabase();
        await db.execute(`
            CREATE TABLE IF NOT EXISTS flowchart_documents (
                id TEXT PRIMARY KEY,
                linked_amfe_project TEXT UNIQUE NOT NULL,
                data TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        `);
    } catch (err) {
        logger.error('FlowchartRepo', 'Failed to ensure schema', {}, err instanceof Error ? err : undefined);
    }
}

/**
 * Load a Flowchart document by its associated AMFE project.
 */
export async function loadFlowchartByAmfeProject(amfeProject: string): Promise<FlowchartDocument | null> {
    try {
        await ensureSchema();
        const db = await getDatabase();
        const rows = await db.select<{ data: string }>(
            'SELECT data FROM flowchart_documents WHERE linked_amfe_project = ?',
            [amfeProject]
        );
        
        if (rows.length === 0) return null;
        return JSON.parse(rows[0].data) as FlowchartDocument;
    } catch (err) {
        logger.error('FlowchartRepo', `Failed to load by AMFE project: ${amfeProject}`, {}, err instanceof Error ? err : undefined);
        return null;
    }
}

/**
 * Save a Flowchart document (insert or replace).
 */
export async function saveFlowchartDocument(doc: FlowchartDocument): Promise<boolean> {
    try {
        await ensureSchema();
        const db = await getDatabase();
        const data = JSON.stringify(doc);
        
        await db.execute(
            `INSERT OR REPLACE INTO flowchart_documents
             (id, linked_amfe_project, data, created_at, updated_at)
             VALUES (?, ?, ?, 
                     COALESCE((SELECT created_at FROM flowchart_documents WHERE linked_amfe_project = ?), datetime('now')),
                     datetime('now'))`,
            [doc.id, doc.linkedAmfeProject, data, doc.linkedAmfeProject]
        );
        return true;
    } catch (err) {
        logger.error('FlowchartRepo', `Failed to save Flowchart document ${doc.id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}
