/**
 * AMFE Repository
 *
 * CRUD for AMFE VDA documents. Unifies the old registry + individual JSON files.
 * Also handles the global operations library.
 * Replaces: amfePathManager.ts, amfeRegistryManager.ts, amfeLibraryPathManager.ts
 */

import type { AmfeDocument } from '../../modules/amfe/amfeTypes';
import type { AmfeRegistryEntry, AmfeRevisionEntry, AmfeLifecycleStatus } from '../../modules/amfe/amfeRegistryTypes';
import type { AmfeLibrary, AmfeLibraryOperation } from '../../modules/amfe/amfeLibraryTypes';
import { buildSearchableText } from '../../modules/amfe/amfeLibraryTypes';
import { ActionPriority } from '../../modules/amfe/amfeTypes';
import { createEmptyAmfeDoc } from '../../modules/amfe/amfeInitialData';
import { getDatabase } from '../database';
import { logger } from '../logger';
import { getCurrentUserEmail } from '../currentUser';
import { generateChecksum } from '../crypto';
import { scheduleBackup } from '../backupService';

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Data normalization — prevents .trim() crashes on undefined fields
// ---------------------------------------------------------------------------

/** Ensure all string fields exist after JSON.parse to prevent runtime crashes. */
function normalizeAmfeDoc(doc: AmfeDocument): void {
    const defaults = createEmptyAmfeDoc();
    for (const key of Object.keys(defaults.header) as (keyof typeof defaults.header)[]) {
        if (doc.header[key] == null) {
            (doc.header as unknown as Record<string, string>)[key] = defaults.header[key];
        }
    }
    if (!Array.isArray(doc.operations)) doc.operations = [];
    for (const op of doc.operations) {
        op.opNumber = op.opNumber ?? '';
        op.name = op.name ?? '';
        if (!Array.isArray(op.workElements)) op.workElements = [];
        for (const we of op.workElements) {
            we.name = we.name ?? '';
            if (!Array.isArray(we.functions)) we.functions = [];
            for (const fn of we.functions) {
                fn.description = fn.description ?? '';
                if (!Array.isArray(fn.failures)) fn.failures = [];
                for (const fail of fn.failures) {
                    fail.description = fail.description ?? '';
                    fail.effectLocal = fail.effectLocal ?? '';
                    fail.effectNextLevel = fail.effectNextLevel ?? '';
                    fail.effectEndUser = fail.effectEndUser ?? '';
                    if (!Array.isArray(fail.causes)) fail.causes = [];
                    for (const cause of fail.causes) {
                        cause.cause = cause.cause ?? '';
                        cause.preventionControl = cause.preventionControl ?? '';
                        cause.detectionControl = cause.detectionControl ?? '';
                        cause.preventionAction = cause.preventionAction ?? '';
                        cause.detectionAction = cause.detectionAction ?? '';
                        cause.responsible = cause.responsible ?? '';
                        cause.targetDate = cause.targetDate ?? '';
                        cause.status = cause.status ?? '';
                        cause.observations = cause.observations ?? '';
                        cause.ap = cause.ap ?? '';
                        cause.specialChar = cause.specialChar ?? '';
                        cause.characteristicNumber = cause.characteristicNumber ?? '';
                        cause.filterCode = cause.filterCode ?? '';
                        cause.actionTaken = cause.actionTaken ?? '';
                        cause.completionDate = cause.completionDate ?? '';
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// AMFE Document CRUD
// ---------------------------------------------------------------------------

export interface AmfeDocumentRow {
    id: string;
    amfe_number: string;
    project_name: string;
    status: AmfeLifecycleStatus;
    subject: string;
    client: string;
    part_number: string;
    responsible: string;
    organization: string;
    operation_count: number;
    cause_count: number;
    ap_h_count: number;
    ap_m_count: number;
    coverage_percent: number;
    start_date: string;
    last_revision_date: string;
    created_at: string;
    updated_at: string;
    created_by?: string;
    updated_by?: string;
    data: string;
    revisions: string;
    checksum: string | null;
}

export function computeAmfeStats(doc: AmfeDocument): { operationCount: number; causeCount: number; apHCount: number; apMCount: number; coveragePercent: number } {
    let causeCount = 0;
    let apHCount = 0;
    let apMCount = 0;
    let filledCauses = 0;

    for (const op of doc.operations) {
        for (const we of op.workElements) {
            for (const fn of we.functions) {
                for (const fail of fn.failures) {
                    for (const cause of fail.causes) {
                        causeCount++;
                        if (cause.ap === ActionPriority.HIGH || cause.ap === 'H') apHCount++;
                        if (cause.ap === ActionPriority.MEDIUM || cause.ap === 'M') apMCount++;
                        if (fail.severity && cause.occurrence && cause.detection) filledCauses++;
                    }
                }
            }
        }
    }

    return {
        operationCount: doc.operations.length,
        causeCount,
        apHCount,
        apMCount,
        coveragePercent: causeCount > 0 ? Math.round((filledCauses / causeCount) * 100) : 0,
    };
}

/**
 * List all AMFE documents as registry entries (no full data).
 */
export async function listAmfeDocuments(): Promise<AmfeRegistryEntry[]> {
    try {
        const db = await getDatabase();
        const rows = await db.select<AmfeDocumentRow>(
            `SELECT id, amfe_number, project_name, status, subject, client, part_number,
                    responsible, operation_count, cause_count, ap_h_count, ap_m_count,
                    coverage_percent, start_date, last_revision_date, created_at, updated_at,
                    revisions
             FROM amfe_documents ORDER BY updated_at DESC`
        );

        return rows.map(r => {
            let revisions: AmfeRevisionEntry[] = [];
            try {
                revisions = JSON.parse(r.revisions || '[]');
            } catch {
                logger.warn('AmfeRepo', `Corrupted revisions JSON for doc ${r.id}, using empty array`);
            }
            return {
                id: r.id,
                amfeNumber: r.amfe_number,
                projectName: r.project_name,
                status: r.status,
                subject: r.subject,
                client: r.client,
                partNumber: r.part_number,
                responsible: r.responsible,
                operationCount: r.operation_count,
                causeCount: r.cause_count,
                apHCount: r.ap_h_count,
                apMCount: r.ap_m_count,
                coveragePercent: r.coverage_percent,
                startDate: r.start_date,
                lastRevisionDate: r.last_revision_date,
                revisions,
                createdAt: r.created_at,
                updatedAt: r.updated_at,
                createdBy: r.created_by ?? '',
                updatedBy: r.updated_by ?? '',
            };
        });
    } catch (err) {
        logger.error('AmfeRepo', 'Failed to list documents', {}, err instanceof Error ? err : undefined);
        return [];
    }
}

/**
 * Load a full AMFE document by ID.
 */
export async function loadAmfeDocument(id: string): Promise<{ doc: AmfeDocument; meta: AmfeRegistryEntry } | null> {
    try {
        const db = await getDatabase();
        const rows = await db.select<AmfeDocumentRow>(
            'SELECT * FROM amfe_documents WHERE id = ?',
            [id]
        );
        if (rows.length === 0) return null;

        const r = rows[0];
        const doc = JSON.parse(r.data) as AmfeDocument;
        normalizeAmfeDoc(doc);
        const meta: AmfeRegistryEntry = {
            id: r.id,
            amfeNumber: r.amfe_number,
            projectName: r.project_name,
            status: r.status,
            subject: r.subject,
            client: r.client,
            partNumber: r.part_number,
            responsible: r.responsible,
            operationCount: r.operation_count,
            causeCount: r.cause_count,
            apHCount: r.ap_h_count,
            apMCount: r.ap_m_count,
            coveragePercent: r.coverage_percent,
            startDate: r.start_date,
            lastRevisionDate: r.last_revision_date,
            revisions: JSON.parse(r.revisions || '[]'),
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            createdBy: r.created_by ?? '',
            updatedBy: r.updated_by ?? '',
        };

        return { doc, meta };
    } catch (err) {
        logger.error('AmfeRepo', `Failed to load document ${id}`, {}, err instanceof Error ? err : undefined);
        return null;
    }
}

/**
 * Load AMFE document by project name.
 */
export async function loadAmfeByProjectName(projectName: string): Promise<{ doc: AmfeDocument; meta: AmfeRegistryEntry } | null> {
    try {
        const db = await getDatabase();
        const rows = await db.select<AmfeDocumentRow>(
            'SELECT * FROM amfe_documents WHERE project_name = ?',
            [projectName]
        );
        if (rows.length === 0) return null;

        const r = rows[0];
        const doc = JSON.parse(r.data) as AmfeDocument;
        normalizeAmfeDoc(doc);
        const meta: AmfeRegistryEntry = {
            id: r.id,
            amfeNumber: r.amfe_number,
            projectName: r.project_name,
            status: r.status,
            subject: r.subject,
            client: r.client,
            partNumber: r.part_number,
            responsible: r.responsible,
            operationCount: r.operation_count,
            causeCount: r.cause_count,
            apHCount: r.ap_h_count,
            apMCount: r.ap_m_count,
            coveragePercent: r.coverage_percent,
            startDate: r.start_date,
            lastRevisionDate: r.last_revision_date,
            revisions: JSON.parse(r.revisions || '[]'),
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            createdBy: r.created_by ?? '',
            updatedBy: r.updated_by ?? '',
        };
        return { doc, meta };
    } catch (err) {
        logger.error('AmfeRepo', `Failed to load by name: ${projectName}`, {}, err instanceof Error ? err : undefined);
        return null;
    }
}

/**
 * Save an AMFE document (insert or update).
 */
export async function saveAmfeDocument(
    id: string,
    amfeNumber: string,
    projectName: string,
    doc: AmfeDocument,
    status: AmfeLifecycleStatus = 'draft',
    revisions: AmfeRevisionEntry[] = [],
    modifiedBy?: { email: string; type: 'user' | 'ai' },
): Promise<boolean> {
    try {
        const db = await getDatabase();
        const data = JSON.stringify(doc);
        const checksum = await generateChecksum(data);
        const stats = computeAmfeStats(doc);
        const header = doc.header;
        const byEmail = modifiedBy?.email || getCurrentUserEmail();
        const byType = modifiedBy?.type || 'user';

        await db.execute(
            `INSERT OR REPLACE INTO amfe_documents
             (id, amfe_number, project_name, subject, client, part_number, responsible,
              organization, status, operation_count, cause_count, ap_h_count, ap_m_count,
              coverage_percent, start_date, last_revision_date,
              created_at, updated_at, created_by, updated_by, modified_by_type,
              data, revisions, checksum)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                     COALESCE((SELECT created_at FROM amfe_documents WHERE id = ?), datetime('now')),
                     datetime('now'),
                     COALESCE((SELECT created_by FROM amfe_documents WHERE id = ?), ?),
                     ?, ?,
                     ?, ?, ?)`,
            [
                id, amfeNumber, projectName,
                header.subject || '', header.client || '', header.partNumber || '',
                header.responsible || '', header.organization || '', status,
                stats.operationCount, stats.causeCount, stats.apHCount, stats.apMCount,
                stats.coveragePercent, header.startDate || '', header.revDate || '',
                id, id, byEmail,
                byEmail, byType,
                data, JSON.stringify(revisions), checksum,
            ]
        );
        scheduleBackup();
        return true;
    } catch (err) {
        logger.error('AmfeRepo', `Failed to save document ${id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/**
 * Delete an AMFE document (with soft-delete to trash).
 */
export async function deleteAmfeDocument(id: string): Promise<boolean> {
    try {
        const db = await getDatabase();

        // Soft-delete: save to trash before hard delete
        try {
            await db.execute(
                `INSERT OR REPLACE INTO deleted_documents (id, doc_type, project_name, data, deleted_at, deleted_by)
                 SELECT id, 'amfe', project_name, data, datetime('now'), ?
                 FROM amfe_documents WHERE id = ?`,
                [getCurrentUserEmail(), id]
            );
            logger.info('AmfeRepo', `Document ${id} saved to trash before deletion`);
        } catch (trashErr) {
            logger.warn('AmfeRepo', `Failed to save document ${id} to trash, proceeding with delete`, {}, trashErr instanceof Error ? trashErr : undefined);
        }

        await db.execute('DELETE FROM amfe_documents WHERE id = ?', [id]);
        return true;
    } catch (err) {
        logger.error('AmfeRepo', `Failed to delete document ${id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/**
 * Delete multiple AMFE documents in a single transaction (all-or-nothing).
 * Returns true only if ALL deletions succeed.
 */
export async function deleteAmfeDocumentsBatch(ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    try {
        const db = await getDatabase();
        await db.execute('BEGIN TRANSACTION', []);
        try {
            const userEmail = getCurrentUserEmail();
            for (const id of ids) {
                // Soft-delete: save to trash before hard delete
                try {
                    await db.execute(
                        `INSERT OR REPLACE INTO deleted_documents (id, doc_type, project_name, data, deleted_at, deleted_by)
                         SELECT id, 'amfe', project_name, data, datetime('now'), ?
                         FROM amfe_documents WHERE id = ?`,
                        [userEmail, id]
                    );
                } catch (trashErr) {
                    logger.warn('AmfeRepo', `Failed to save document ${id} to trash during batch delete`, {}, trashErr instanceof Error ? trashErr : undefined);
                }
                await db.execute('DELETE FROM amfe_documents WHERE id = ?', [id]);
            }
            await db.execute('COMMIT', []);
            logger.info('AmfeRepo', `Batch-deleted ${ids.length} documents (saved to trash)`);
            return true;
        } catch (innerErr) {
            try { await db.execute('ROLLBACK', []); } catch { /* rollback best-effort */ }
            throw innerErr;
        }
    } catch (err) {
        logger.error('AmfeRepo', `Failed to batch-delete ${ids.length} documents`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/**
 * Count CP and HO documents linked to a given AMFE document.
 * Useful for warning users before deletion about orphaned references.
 */
export async function countLinkedDocuments(amfeId: string): Promise<{ cpCount: number; hoCount: number }> {
    try {
        const db = await getDatabase();
        const cpRows = await db.select<{ count: number }>(
            'SELECT COUNT(*) as count FROM cp_documents WHERE linked_amfe_id = ?', [amfeId]
        );
        const hoRows = await db.select<{ count: number }>(
            'SELECT COUNT(*) as count FROM ho_documents WHERE linked_amfe_id = ?', [amfeId]
        );
        return {
            cpCount: cpRows[0]?.count ?? 0,
            hoCount: hoRows[0]?.count ?? 0,
        };
    } catch (err) {
        logger.error('AmfeRepo', `Failed to count linked docs for ${amfeId}`, {}, err instanceof Error ? err : undefined);
        return { cpCount: 0, hoCount: 0 };
    }
}

/**
 * Update AMFE document status.
 */
export async function updateAmfeStatus(id: string, status: AmfeLifecycleStatus): Promise<boolean> {
    try {
        const db = await getDatabase();
        await db.execute(
            `UPDATE amfe_documents SET status = ?, updated_at = datetime('now') WHERE id = ?`,
            [status, id]
        );
        return true;
    } catch (err) {
        logger.error('AmfeRepo', `Failed to update status for ${id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/**
 * Get the next AMFE number (auto-increment).
 */
export async function getNextAmfeNumber(): Promise<number> {
    try {
        const db = await getDatabase();
        const rows = await db.select<{ max_num: number | null }>(
            `SELECT MAX(CAST(SUBSTR(amfe_number, 6) AS INTEGER)) as max_num FROM amfe_documents`
        );
        return (rows[0]?.max_num ?? 0) + 1;
    } catch {
        return 1;
    }
}

// ---------------------------------------------------------------------------
// AMFE Library CRUD
// ---------------------------------------------------------------------------

/**
 * Load the entire library.
 */
export async function loadLibrary(): Promise<AmfeLibrary> {
    try {
        const db = await getDatabase();
        const rows = await db.select<{ id: string; op_number: string; name: string; category: string; description: string; tags: string; version: number; last_modified: string; data: string }>(
            'SELECT * FROM amfe_library_operations ORDER BY name'
        );

        const operations: AmfeLibraryOperation[] = rows.map(r => {
            const parsed = JSON.parse(r.data);
            return {
                id: r.id,
                opNumber: r.op_number,
                name: r.name,
                category: r.category || undefined,
                description: r.description || undefined,
                tags: JSON.parse(r.tags || '[]'),
                version: r.version,
                lastModified: r.last_modified,
                workElements: parsed.workElements || [],
            };
        });

        return {
            operations,
            lastModified: new Date().toISOString(),
        };
    } catch (err) {
        logger.error('AmfeRepo', 'Failed to load library', {}, err instanceof Error ? err : undefined);
        return { operations: [], lastModified: new Date().toISOString() };
    }
}

/**
 * Save/update a library operation.
 */
export async function saveLibraryOperation(op: AmfeLibraryOperation): Promise<boolean> {
    try {
        const db = await getDatabase();
        const data = JSON.stringify({ workElements: op.workElements });
        const searchText = buildSearchableText(op);

        await db.execute(
            `INSERT OR REPLACE INTO amfe_library_operations
             (id, op_number, name, category, description, tags, version, last_modified, data, search_text)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                op.id, op.opNumber, op.name, op.category || '',
                op.description || '', JSON.stringify(op.tags || []),
                op.version, op.lastModified || new Date().toISOString(),
                data, searchText,
            ]
        );
        return true;
    } catch (err) {
        logger.error('AmfeRepo', `Failed to save library operation ${op.id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/**
 * Save the entire library (batch replace).
 */
export async function saveLibrary(library: AmfeLibrary): Promise<boolean> {
    try {
        const db = await getDatabase();
        await db.execute('BEGIN TRANSACTION', []);
        try {
            // Delete all existing
            await db.execute('DELETE FROM amfe_library_operations', []);
            // Insert all
            for (const op of library.operations) {
                const ok = await saveLibraryOperation(op);
                if (!ok) throw new Error(`Failed to save library operation ${op.id}`);
            }
            await db.execute('COMMIT', []);
        } catch (innerErr) {
            try { await db.execute('ROLLBACK', []); } catch { /* rollback best-effort */ }
            throw innerErr;
        }
        return true;
    } catch (err) {
        logger.error('AmfeRepo', 'Failed to save library', {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/**
 * Delete a library operation.
 */
async function deleteLibraryOperation(id: string): Promise<boolean> {
    try {
        const db = await getDatabase();
        await db.execute('DELETE FROM amfe_library_operations WHERE id = ?', [id]);
        return true;
    } catch (err) {
        logger.error('AmfeRepo', `Failed to delete library operation ${id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/**
 * Search library operations by text.
 */
async function searchLibrary(query: string): Promise<AmfeLibraryOperation[]> {
    try {
        const db = await getDatabase();
        const pattern = `%${query.toLowerCase()}%`;
        const rows = await db.select<{ id: string; op_number: string; name: string; category: string; description: string; tags: string; version: number; last_modified: string; data: string }>(
            'SELECT * FROM amfe_library_operations WHERE search_text LIKE ? ORDER BY name',
            [pattern]
        );

        return rows.map(r => ({
            id: r.id,
            opNumber: r.op_number,
            name: r.name,
            category: r.category || undefined,
            description: r.description || undefined,
            tags: JSON.parse(r.tags || '[]'),
            version: r.version,
            lastModified: r.last_modified,
            workElements: JSON.parse(r.data).workElements || [],
        }));
    } catch (err) {
        logger.error('AmfeRepo', 'Failed to search library', {}, err instanceof Error ? err : undefined);
        return [];
    }
}

// ---------------------------------------------------------------------------
// Validated save wrapper (for AI-driven modifications)
// ---------------------------------------------------------------------------

import { validateAmfeBeforeSave } from '../../modules/amfe/amfeValidation';
import type { SaveValidationResult } from './validationTypes';

/**
 * Validate an AMFE document, then save it only if validation passes.
 * Returns validation result + whether the save was executed.
 *
 * Existing `saveAmfeDocument()` is NOT modified — this is a new wrapper.
 */
export async function validateAndSaveAmfeDocument(
    id: string,
    amfeNumber: string,
    projectName: string,
    doc: AmfeDocument,
    status: AmfeLifecycleStatus = 'draft',
    revisions: AmfeRevisionEntry[] = [],
): Promise<SaveValidationResult & { saved: boolean }> {
    const validation = validateAmfeBeforeSave(doc, status);
    if (!validation.valid) {
        return { ...validation, saved: false };
    }
    const saved = await saveAmfeDocument(id, amfeNumber, projectName, doc, status, revisions);
    return { ...validation, saved };
}
