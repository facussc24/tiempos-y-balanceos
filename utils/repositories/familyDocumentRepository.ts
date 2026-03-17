/**
 * Family Document Repository
 *
 * CRUD for family documents — links documents (AMFE, CP, HO, PFD) to product
 * families as master or variant instances. Tracks overrides and change proposals
 * for master-to-variant inheritance.
 */

import { getDatabase } from '../database';
import { logger } from '../logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FamilyDocument {
    id: number;
    familyId: number;
    module: string;
    documentId: string;
    isMaster: boolean;
    sourceMasterId: number | null;
    productId: number | null;
    createdAt: string;
}

export interface FamilyDocumentOverride {
    id: number;
    familyDocId: number;
    itemType: string;
    itemId: string;
    overrideType: string;
    overrideData: string | null;
    createdAt: string;
}

export interface ChangeProposal {
    id: number;
    familyId: number;
    module: string;
    masterDocId: string;
    targetFamilyDocId: number;
    changeType: string;
    itemType: string;
    itemId: string;
    oldData: string | null;
    newData: string | null;
    status: string;
    resolvedBy: string | null;
    resolvedAt: string | null;
    createdAt: string;
}

interface FamilyDocumentRow {
    id: number;
    family_id: number;
    module: string;
    document_id: string;
    is_master: number;
    source_master_id: number | null;
    product_id: number | null;
    created_at: string;
}

interface FamilyDocumentOverrideRow {
    id: number;
    family_doc_id: number;
    item_type: string;
    item_id: string;
    override_type: string;
    override_data: string | null;
    created_at: string;
}

interface ChangeProposalRow {
    id: number;
    family_id: number;
    module: string;
    master_doc_id: string;
    target_family_doc_id: number;
    change_type: string;
    item_type: string;
    item_id: string;
    old_data: string | null;
    new_data: string | null;
    status: string;
    resolved_by: string | null;
    resolved_at: string | null;
    created_at: string;
}

// ---------------------------------------------------------------------------
// Row converters
// ---------------------------------------------------------------------------

function rowToFamilyDocument(row: FamilyDocumentRow): FamilyDocument {
    return {
        id: row.id,
        familyId: row.family_id,
        module: row.module,
        documentId: row.document_id,
        isMaster: row.is_master === 1,
        sourceMasterId: row.source_master_id ?? null,
        productId: row.product_id ?? null,
        createdAt: row.created_at,
    };
}

function rowToOverride(row: FamilyDocumentOverrideRow): FamilyDocumentOverride {
    return {
        id: row.id,
        familyDocId: row.family_doc_id,
        itemType: row.item_type,
        itemId: row.item_id,
        overrideType: row.override_type,
        overrideData: row.override_data ?? null,
        createdAt: row.created_at,
    };
}

function rowToProposal(row: ChangeProposalRow): ChangeProposal {
    return {
        id: row.id,
        familyId: row.family_id,
        module: row.module,
        masterDocId: row.master_doc_id,
        targetFamilyDocId: row.target_family_doc_id,
        changeType: row.change_type,
        itemType: row.item_type,
        itemId: row.item_id,
        oldData: row.old_data ?? null,
        newData: row.new_data ?? null,
        status: row.status,
        resolvedBy: row.resolved_by ?? null,
        resolvedAt: row.resolved_at ?? null,
        createdAt: row.created_at,
    };
}

// ---------------------------------------------------------------------------
// Family Documents CRUD
// ---------------------------------------------------------------------------

/**
 * List all documents linked to a family.
 */
export async function listFamilyDocuments(familyId: number): Promise<FamilyDocument[]> {
    const db = await getDatabase();
    const rows = await db.select<FamilyDocumentRow>(
        `SELECT * FROM family_documents WHERE family_id = ? ORDER BY module, created_at`,
        [familyId]
    );
    return rows.map(rowToFamilyDocument);
}

/**
 * Get the master document for a family + module combination.
 */
export async function getFamilyMasterDocument(familyId: number, module: string): Promise<FamilyDocument | null> {
    const db = await getDatabase();
    const rows = await db.select<FamilyDocumentRow>(
        `SELECT * FROM family_documents WHERE family_id = ? AND module = ? AND is_master = 1`,
        [familyId, module]
    );
    return rows.length > 0 ? rowToFamilyDocument(rows[0]) : null;
}

/**
 * Get all variant documents for a family + module (excludes master).
 */
export async function getVariantDocuments(familyId: number, module: string): Promise<FamilyDocument[]> {
    const db = await getDatabase();
    const rows = await db.select<FamilyDocumentRow>(
        `SELECT * FROM family_documents WHERE family_id = ? AND module = ? AND is_master = 0 ORDER BY created_at`,
        [familyId, module]
    );
    return rows.map(rowToFamilyDocument);
}

/**
 * Link a document to a family. Returns the inserted ID.
 */
export async function linkDocumentToFamily(params: {
    familyId: number;
    module: string;
    documentId: string;
    isMaster: boolean;
    sourceMasterId?: number;
    productId?: number;
}): Promise<number> {
    const db = await getDatabase();
    const result = await db.execute(
        `INSERT OR IGNORE INTO family_documents (family_id, module, document_id, is_master, source_master_id, product_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            params.familyId,
            params.module,
            params.documentId,
            params.isMaster ? 1 : 0,
            params.sourceMasterId ?? null,
            params.productId ?? null,
        ]
    );
    logger.info('FamilyDocumentRepository', 'Document linked to family', {
        familyId: params.familyId,
        module: params.module,
        documentId: params.documentId,
        isMaster: params.isMaster,
        id: result.lastInsertId,
    });
    return result.lastInsertId;
}

/**
 * Unlink a document from a family.
 */
export async function unlinkDocumentFromFamily(id: number): Promise<void> {
    const db = await getDatabase();
    await db.execute('DELETE FROM family_documents WHERE id = ?', [id]);
    logger.info('FamilyDocumentRepository', 'Document unlinked from family', { id });
}

/**
 * Get family info for a specific document (by document_id).
 */
export async function getDocumentFamilyInfo(documentId: string): Promise<FamilyDocument | null> {
    const db = await getDatabase();
    const rows = await db.select<FamilyDocumentRow>(
        `SELECT * FROM family_documents WHERE document_id = ?`,
        [documentId]
    );
    return rows.length > 0 ? rowToFamilyDocument(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Overrides CRUD
// ---------------------------------------------------------------------------

/**
 * List all overrides for a family document.
 */
export async function listOverrides(familyDocId: number): Promise<FamilyDocumentOverride[]> {
    const db = await getDatabase();
    const rows = await db.select<FamilyDocumentOverrideRow>(
        `SELECT * FROM family_document_overrides WHERE family_doc_id = ? ORDER BY created_at`,
        [familyDocId]
    );
    return rows.map(rowToOverride);
}

/**
 * Add an override record for a variant document. Returns the inserted ID.
 */
export async function addOverride(params: {
    familyDocId: number;
    itemType: string;
    itemId: string;
    overrideType: string;
    overrideData?: string;
}): Promise<number> {
    const db = await getDatabase();
    const result = await db.execute(
        `INSERT INTO family_document_overrides (family_doc_id, item_type, item_id, override_type, override_data)
         VALUES (?, ?, ?, ?, ?)`,
        [
            params.familyDocId,
            params.itemType,
            params.itemId,
            params.overrideType,
            params.overrideData ?? null,
        ]
    );
    logger.info('FamilyDocumentRepository', 'Override added', {
        familyDocId: params.familyDocId,
        itemType: params.itemType,
        itemId: params.itemId,
        id: result.lastInsertId,
    });
    return result.lastInsertId;
}

/**
 * Remove an override record.
 */
export async function removeOverride(id: number): Promise<void> {
    const db = await getDatabase();
    await db.execute('DELETE FROM family_document_overrides WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Change Proposals CRUD
// ---------------------------------------------------------------------------

/**
 * List pending change proposals for a variant document.
 */
export async function listPendingProposals(targetFamilyDocId: number): Promise<ChangeProposal[]> {
    const db = await getDatabase();
    const rows = await db.select<ChangeProposalRow>(
        `SELECT * FROM family_change_proposals WHERE target_family_doc_id = ? AND status = 'pending' ORDER BY created_at`,
        [targetFamilyDocId]
    );
    return rows.map(rowToProposal);
}

/**
 * Create a change proposal. Returns the inserted ID.
 */
export async function createProposal(params: {
    familyId: number;
    module: string;
    masterDocId: string;
    targetFamilyDocId: number;
    changeType: string;
    itemType: string;
    itemId: string;
    oldData?: string;
    newData?: string;
}): Promise<number> {
    const db = await getDatabase();
    const result = await db.execute(
        `INSERT INTO family_change_proposals (family_id, module, master_doc_id, target_family_doc_id, change_type, item_type, item_id, old_data, new_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            params.familyId,
            params.module,
            params.masterDocId,
            params.targetFamilyDocId,
            params.changeType,
            params.itemType,
            params.itemId,
            params.oldData ?? null,
            params.newData ?? null,
        ]
    );
    logger.info('FamilyDocumentRepository', 'Change proposal created', {
        familyId: params.familyId,
        module: params.module,
        targetFamilyDocId: params.targetFamilyDocId,
        id: result.lastInsertId,
    });
    return result.lastInsertId;
}

/**
 * Resolve a change proposal (accept or reject).
 */
export async function resolveProposal(id: number, status: 'accepted' | 'rejected', resolvedBy: string): Promise<void> {
    const db = await getDatabase();
    await db.execute(
        `UPDATE family_change_proposals SET status = ?, resolved_by = ?, resolved_at = datetime('now') WHERE id = ?`,
        [status, resolvedBy, id]
    );
    logger.info('FamilyDocumentRepository', 'Proposal resolved', { id, status, resolvedBy });
}

/**
 * Get total count of pending proposals for a family.
 */
export async function getPendingProposalCount(familyId: number): Promise<number> {
    const db = await getDatabase();
    const rows = await db.select<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM family_change_proposals WHERE family_id = ? AND status = 'pending'`,
        [familyId]
    );
    return rows[0]?.cnt ?? 0;
}
