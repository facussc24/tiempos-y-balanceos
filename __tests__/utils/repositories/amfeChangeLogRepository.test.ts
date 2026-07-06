/**
 * Tests de amfeChangeLogRepository — registro de cambios de contenido de un AMFE
 * (tabla amfe_change_log, diff-on-save).
 *
 * Corre contra el InMemoryAdapter REAL (sin mockear getDatabase): cada test
 * arranca con resetDatabaseForTesting() para tener una DB en memoria limpia,
 * igual que amfeRegistryRepository.test.ts.
 *
 * Nota FK: amfe_change_log tiene FK a amfe_documents(id) ON DELETE CASCADE, pero
 * el InMemoryAdapter ignora las FK (acepta DDL como no-op y no valida referencias),
 * asi que no hace falta insertar un amfe_documents dummy.
 */

vi.mock('../../../utils/unified_fs', () => ({
    isTauri: vi.fn().mockReturnValue(false),
}));

vi.mock('../../../utils/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { closeDatabase, resetDatabaseForTesting } from '../../../utils/database';
import {
    appendChanges,
    listPendingChanges,
    countPendingChanges,
    markConsumed,
} from '../../../utils/repositories/amfeChangeLogRepository';
import type { AmfeChangeEntry } from '../../../modules/amfe/amfeChangeDiff';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Entrada de cambio minima valida (datos de test, no reales). */
function makeChange(overrides: Partial<AmfeChangeEntry> = {}): AmfeChangeEntry {
    return {
        scope: 'cause',
        changeType: 'modified',
        opNumber: '30',
        itemLabel: "OP 30 COSTURA / Falla 'X' / Causa 'Y'",
        field: 'occurrence',
        oldValue: '6',
        newValue: '4',
        summary: 'Ocurrencia 6 → 4',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('amfeChangeLogRepository (InMemoryAdapter)', () => {
    beforeEach(() => {
        resetDatabaseForTesting();
    });

    afterEach(async () => {
        await closeDatabase();
    });

    // -----------------------------------------------------------------------
    // 1. appendChanges + listPendingChanges — orden y mapeo camelCase
    // -----------------------------------------------------------------------

    describe('appendChanges + listPendingChanges', () => {
        it('inserta 3 entradas y las lista en orden de insercion, mapeadas a camelCase', async () => {
            const entries: AmfeChangeEntry[] = [
                makeChange({ opNumber: '10', field: 'severity', summary: 'Severidad 5 → 6', scope: 'cause' }),
                makeChange({ opNumber: '20', field: 'occurrence', summary: 'Ocurrencia 6 → 4', changeType: 'modified' }),
                makeChange({ opNumber: '30', field: '', summary: "Agregada causa 'Z'", changeType: 'added' }),
            ];

            const ok = await appendChanges('doc-A', entries, { email: 'tester@barack', type: 'user' });
            expect(ok).toBe(true);

            const pending = await listPendingChanges('doc-A');
            expect(pending).toHaveLength(3);

            // Orden de insercion (created_at ASC, id ASC — el id autoincremental preserva el orden)
            expect(pending.map(p => p.opNumber)).toEqual(['10', '20', '30']);
            expect(pending.map(p => p.summary)).toEqual([
                'Severidad 5 → 6',
                'Ocurrencia 6 → 4',
                "Agregada causa 'Z'",
            ]);

            // Mapeo camelCase de la primera fila
            const first = pending[0];
            expect(first.documentId).toBe('doc-A');
            expect(first.opNumber).toBe('10');
            expect(first.scope).toBe('cause');
            expect(first.changeType).toBe('modified');
            expect(first.field).toBe('severity');
            expect(first.summary).toBe('Severidad 5 → 6');
            expect(first.changedBy).toBe('tester@barack');
            expect(first.changedByType).toBe('user');
            // Pendiente = ninguna revision lo consumio. En Supabase/SQLite la columna
            // es NULL (DEFAULT NULL); el InMemoryAdapter no aplica DEFAULT de columnas
            // para tablas fuera de TABLE_DEFAULTS, asi que llega undefined. Ambos son
            // "sin consumir" — verificamos el invariante (nullish), no la representacion.
            expect(first.consumedInRev == null).toBe(true);

            // La tercera fila conserva su changeType propio
            expect(pending[2].changeType).toBe('added');
        });
    });

    // -----------------------------------------------------------------------
    // 2. appendChanges con [] — no-op
    // -----------------------------------------------------------------------

    describe('appendChanges con lista vacia', () => {
        it('devuelve true y no inserta nada', async () => {
            const ok = await appendChanges('doc-A', []);
            expect(ok).toBe(true);

            expect(await listPendingChanges('doc-A')).toEqual([]);
            expect(await countPendingChanges('doc-A')).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // 3. countPendingChanges — refleja el conteo
    // -----------------------------------------------------------------------

    describe('countPendingChanges', () => {
        it('cuenta las entradas pendientes de un documento', async () => {
            expect(await countPendingChanges('doc-A')).toBe(0);

            await appendChanges('doc-A', [makeChange(), makeChange()]);
            expect(await countPendingChanges('doc-A')).toBe(2);

            await appendChanges('doc-A', [makeChange()]);
            expect(await countPendingChanges('doc-A')).toBe(3);
        });
    });

    // -----------------------------------------------------------------------
    // 4. markConsumed — marca todas las pendientes
    // -----------------------------------------------------------------------

    describe('markConsumed', () => {
        it('marca todas las pendientes de un doc y desaparecen de la lista de pendientes', async () => {
            await appendChanges('doc-A', [makeChange(), makeChange(), makeChange()]);
            expect(await countPendingChanges('doc-A')).toBe(3);

            const ok = await markConsumed('doc-A', 'H');
            expect(ok).toBe(true);

            expect(await listPendingChanges('doc-A')).toEqual([]);
            expect(await countPendingChanges('doc-A')).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // 5. Aislamiento por documentId
    // -----------------------------------------------------------------------

    describe('aislamiento por documentId', () => {
        it('los cambios de un documento no aparecen al listar/contar otro', async () => {
            await appendChanges('doc-A', [makeChange(), makeChange()]);
            await appendChanges('doc-B', [makeChange()]);

            expect(await listPendingChanges('doc-A')).toHaveLength(2);
            expect(await listPendingChanges('doc-B')).toHaveLength(1);
            expect(await countPendingChanges('doc-A')).toBe(2);
            expect(await countPendingChanges('doc-B')).toBe(1);

            // Todas las filas listadas de doc-B pertenecen a doc-B
            const bRows = await listPendingChanges('doc-B');
            expect(bRows.every(r => r.documentId === 'doc-B')).toBe(true);

            // Consumir doc-A no afecta doc-B
            await markConsumed('doc-A', 'H');
            expect(await countPendingChanges('doc-A')).toBe(0);
            expect(await countPendingChanges('doc-B')).toBe(1);
        });
    });
});
