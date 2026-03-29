/**
 * Cross-Document Transaction Wrapper
 *
 * Provides atomic multi-document saves using BEGIN/COMMIT/ROLLBACK.
 * Use when modifying AMFE + CP + HO together to ensure all-or-nothing.
 *
 * @example
 * ```typescript
 * await withTransaction(async (db) => {
 *   await saveAmfeDocument(...);
 *   await saveCpDocument(...);
 *   await saveHoDocument(...);
 * });
 * ```
 */

import { getDatabase, type DbAdapter } from './database';
import { logger } from './logger';

/**
 * Execute a function inside a database transaction.
 * If the function succeeds, changes are committed.
 * If it throws, changes are rolled back and the error is re-thrown.
 */
export async function withTransaction<T>(
    fn: (db: DbAdapter) => Promise<T>,
): Promise<T> {
    const db = await getDatabase();
    await db.execute('BEGIN TRANSACTION', []);
    try {
        const result = await fn(db);
        await db.execute('COMMIT', []);
        return result;
    } catch (err) {
        try {
            await db.execute('ROLLBACK', []);
        } catch { /* best-effort rollback */ }
        logger.error('Transaction', 'Rolled back', {}, err instanceof Error ? err : undefined);
        throw err;
    }
}
