/**
 * Document Lock Repository
 *
 * Manages cross-user edit locks for APQP documents (AMFE, CP, PFD, HO).
 * Uses a TTL-based lease pattern: locks expire after 2 minutes unless
 * refreshed by a heartbeat.
 *
 * Timestamps are computed in JS (not SQL) for adapter compatibility.
 *
 * @module documentLockRepository
 */

import { getDatabase } from '../database';
import { logger } from '../logger';
import { getCurrentUserEmail } from '../currentUser';

const LOCK_TTL_MS = 120_000; // 2 minutes

export type LockableDocType = 'amfe' | 'cp' | 'pfd' | 'ho';

export interface DocumentLockInfo {
    documentId: string;
    documentType: LockableDocType;
    lockedBy: string;
    lockedAt: string;
    expiresAt: string;
}

/** Compute an ISO timestamp N ms from now. */
function futureIso(offsetMs: number): string {
    return new Date(Date.now() + offsetMs).toISOString();
}

function nowIso(): string {
    return new Date().toISOString();
}

/**
 * Check if another user holds an active lock on a document.
 * Returns the other user's email, or null if no conflict.
 */
export async function checkDocumentLock(
    documentId: string,
    documentType: LockableDocType,
): Promise<string | null> {
    const currentUser = getCurrentUserEmail();
    if (!currentUser || !documentId) return null;

    try {
        const db = await getDatabase();
        const rows = await db.select<{ locked_by: string }>(
            `SELECT locked_by FROM document_locks
             WHERE document_id = ? AND document_type = ?
               AND locked_by != ? AND expires_at > ?`,
            [documentId, documentType, currentUser, nowIso()],
        );
        return rows.length > 0 ? rows[0].locked_by : null;
    } catch (err) {
        logger.warn('DocumentLock', 'Failed to check lock', { documentId, documentType, error: String(err) });
        return null;
    }
}

/**
 * Acquire a lock on a document for the current user.
 * If another user holds an active lock, returns their email (non-blocking).
 * Our lock is always written — the warning is advisory only.
 */
export async function acquireDocumentLock(
    documentId: string,
    documentType: LockableDocType,
): Promise<string | null> {
    const currentUser = getCurrentUserEmail();
    if (!currentUser || !documentId) return null;

    try {
        // Check for existing lock by another user
        const otherUser = await checkDocumentLock(documentId, documentType);

        // Write our lock (INSERT OR REPLACE)
        const db = await getDatabase();
        await db.execute(
            `INSERT OR REPLACE INTO document_locks
                (document_id, document_type, locked_by, locked_at, expires_at)
             VALUES (?, ?, ?, ?, ?)`,
            [documentId, documentType, currentUser, nowIso(), futureIso(LOCK_TTL_MS)],
        );

        if (otherUser) {
            logger.info('DocumentLock', `Lock acquired with warning: ${otherUser} was editing`, { documentId, documentType });
        } else {
            logger.debug('DocumentLock', 'Lock acquired', { documentId, documentType });
        }

        return otherUser;
    } catch (err) {
        logger.warn('DocumentLock', 'Failed to acquire lock', { documentId, documentType, error: String(err) });
        return null;
    }
}

/**
 * Refresh the lock lease (called by heartbeat every 30s).
 */
export async function refreshDocumentLock(
    documentId: string,
    documentType: LockableDocType,
): Promise<void> {
    const currentUser = getCurrentUserEmail();
    if (!currentUser || !documentId) return;

    try {
        const db = await getDatabase();
        await db.execute(
            `UPDATE document_locks SET expires_at = ?
             WHERE document_id = ? AND document_type = ? AND locked_by = ?`,
            [futureIso(LOCK_TTL_MS), documentId, documentType, currentUser],
        );
    } catch (err) {
        logger.warn('DocumentLock', 'Failed to refresh lock', { error: String(err) });
    }
}

/**
 * Release the lock when the user closes the document.
 */
export async function releaseDocumentLock(
    documentId: string,
    documentType: LockableDocType,
): Promise<void> {
    const currentUser = getCurrentUserEmail();
    if (!currentUser || !documentId) return;

    try {
        const db = await getDatabase();
        await db.execute(
            `DELETE FROM document_locks
             WHERE document_id = ? AND document_type = ? AND locked_by = ?`,
            [documentId, documentType, currentUser],
        );
        logger.debug('DocumentLock', 'Lock released', { documentId, documentType });
    } catch (err) {
        logger.warn('DocumentLock', 'Failed to release lock', { error: String(err) });
    }
}

/**
 * Clean up expired locks (maintenance, called periodically).
 */
export async function cleanExpiredLocks(): Promise<void> {
    try {
        const db = await getDatabase();
        await db.execute(
            `DELETE FROM document_locks WHERE expires_at <= ?`,
            [nowIso()],
        );
    } catch (err) {
        logger.warn('DocumentLock', 'Failed to clean expired locks', { error: String(err) });
    }
}
