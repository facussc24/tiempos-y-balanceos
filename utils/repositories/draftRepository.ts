/**
 * Draft Repository
 *
 * Unified draft storage for all modules.
 * Replaces: 4 separate IndexedDB databases (amfe_storage, controlplan_storage, ho_storage, BarackMercosulDB).
 */

import { getDatabase } from '../database';
import { logger } from '../logger';

export type DraftModule = 'project' | 'amfe' | 'cp' | 'ho' | 'pfd';

/**
 * Save a draft (upsert by module + key).
 */
export async function saveDraft(module: DraftModule, documentKey: string, data: unknown): Promise<void> {
    try {
        const db = await getDatabase();
        const json = JSON.stringify(data);
        await db.execute(
            `INSERT OR REPLACE INTO drafts (module, document_key, data, updated_at)
             VALUES (?, ?, ?, datetime('now'))`,
            [module, documentKey, json]
        );
    } catch (err) {
        logger.error('DraftRepo', `Failed to save draft ${module}/${documentKey}`, {}, err instanceof Error ? err : undefined);
    }
}

/**
 * Load a draft by module + key.
 */
export async function loadDraft<T = unknown>(module: DraftModule, documentKey: string): Promise<T | null> {
    try {
        const db = await getDatabase();
        const rows = await db.select<{ data: string }>(
            'SELECT data FROM drafts WHERE module = ? AND document_key = ?',
            [module, documentKey]
        );
        if (rows.length === 0) return null;
        return JSON.parse(rows[0].data) as T;
    } catch (err) {
        logger.warn('DraftRepo', `Failed to load draft ${module}/${documentKey}`, { error: String(err) });
        return null;
    }
}

/**
 * Delete a draft.
 */
export async function deleteDraft(module: DraftModule, documentKey: string): Promise<void> {
    try {
        const db = await getDatabase();
        await db.execute(
            'DELETE FROM drafts WHERE module = ? AND document_key = ?',
            [module, documentKey]
        );
    } catch (err) {
        logger.warn('DraftRepo', `Failed to delete draft ${module}/${documentKey}`, { error: String(err) });
    }
}

/**
 * List all draft keys for a module.
 */
export async function listDraftKeys(module: DraftModule): Promise<string[]> {
    try {
        const db = await getDatabase();
        const rows = await db.select<{ document_key: string }>(
            'SELECT document_key FROM drafts WHERE module = ? ORDER BY updated_at DESC',
            [module]
        );
        return rows.map(r => r.document_key);
    } catch (err) {
        logger.warn('DraftRepo', `Failed to list drafts for ${module}`, { error: String(err) });
        return [];
    }
}

/**
 * Delete all drafts for a module.
 */
export async function clearDrafts(module: DraftModule): Promise<void> {
    try {
        const db = await getDatabase();
        await db.execute('DELETE FROM drafts WHERE module = ?', [module]);
    } catch (err) {
        logger.warn('DraftRepo', `Failed to clear drafts for ${module}`, { error: String(err) });
    }
}
