/**
 * SupabaseAdapter — primeros tests directos del unico adapter de DB que corre
 * en produccion (hasta 2026-08-07 tenia cero cobertura).
 *
 * El contrato central que se fija aca: execute() descarta el DDL y el INSERT a
 * schema_version, por lo tanto runMigrations() JAMAS puede correr contra Supabase.
 * Si corre, la version registrada nunca avanza (quedo en 12 desde 2026-03-17) y
 * los bloques DML se re-ejecutan en cada arranque — el bloque 13 pisaba la fase
 * de todos los Planes de Control a 'preLaunch' cada vez que se abria la app.
 */

vi.mock('../../utils/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const rpc = vi.fn();
vi.mock('../../utils/supabaseClient', () => ({
    supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

import { SupabaseAdapter, getDatabase, closeDatabase } from '../../utils/database';
import { getDbHealth, clearDbReadError } from '../../utils/dbHealth';

describe('SupabaseAdapter', () => {
    beforeEach(() => {
        rpc.mockReset();
        rpc.mockResolvedValue({ data: null, error: null });
    });

    describe('execute() — que descarta y que ejecuta', () => {
        it('descarta DDL sin llamar a Supabase', async () => {
            const db = new SupabaseAdapter({ rpc });
            const res = await db.execute('CREATE TABLE IF NOT EXISTS foo (id TEXT PRIMARY KEY)');
            expect(rpc).not.toHaveBeenCalled();
            expect(res).toEqual({ rowsAffected: 0, lastInsertId: 0 });
        });

        it('descarta el INSERT a schema_version — la razon por la que las migraciones no pueden correr aca', async () => {
            const db = new SupabaseAdapter({ rpc });
            await db.execute(
                'INSERT OR REPLACE INTO schema_version (version, description) VALUES (?, ?)',
                [13, 'Set phase to preLaunch for all CP documents'],
            );
            expect(rpc).not.toHaveBeenCalled();
        });

        it('el DML real si llega a exec_sql_write con los parametros inlineados', async () => {
            rpc.mockResolvedValue({ data: { rows_affected: 1 }, error: null });
            const db = new SupabaseAdapter({ rpc });
            const res = await db.execute(
                'UPDATE cp_documents SET phase = ? WHERE id = ?',
                ['production', 'cp-123'],
            );
            expect(rpc).toHaveBeenCalledTimes(1);
            const [fn, args] = rpc.mock.calls[0] as [string, { query: string }];
            expect(fn).toBe('exec_sql_write');
            expect(args.query).toContain("'production'");
            expect(args.query).toContain("'cp-123'");
            expect(res.rowsAffected).toBe(1);
        });

        it('convierte INSERT OR REPLACE en upsert ON CONFLICT', async () => {
            rpc.mockResolvedValue({ data: { rows_affected: 1 }, error: null });
            const db = new SupabaseAdapter({ rpc });
            await db.execute(
                'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
                ['theme', 'dark'],
            );
            const [, args] = rpc.mock.calls[0] as [string, { query: string }];
            expect(args.query).toContain('ON CONFLICT (key) DO UPDATE SET');
            expect(args.query).not.toMatch(/INSERT\s+OR\s+REPLACE/i);
        });
    });

    describe('select() — una lectura fallida no puede parecer "0 filas"', () => {
        beforeEach(() => {
            clearDbReadError();
        });

        it('lanza el error en vez de devolver lista vacia, y lo reporta a dbHealth', async () => {
            rpc.mockResolvedValue({ data: null, error: { message: 'permission denied for table amfe_documents' } });
            const db = new SupabaseAdapter({ rpc });
            await expect(db.select('SELECT * FROM amfe_documents')).rejects.toThrow(
                'DB select failed: permission denied for table amfe_documents',
            );
            expect(getDbHealth().lastReadError).toContain('permission denied');
        });

        it('una lectura exitosa limpia el estado de error', async () => {
            rpc.mockResolvedValueOnce({ data: null, error: { message: 'timeout' } });
            const db = new SupabaseAdapter({ rpc });
            await expect(db.select('SELECT * FROM products')).rejects.toThrow('DB select failed: timeout');
            expect(getDbHealth().lastReadError).toBe('timeout');

            rpc.mockResolvedValueOnce({ data: [{ id: 1 }], error: null });
            const rows = await db.select('SELECT * FROM products');
            expect(rows).toEqual([{ id: 1 }]);
            expect(getDbHealth().lastReadError).toBeNull();
        });
    });

    describe('arranque de la app (regresion 2026-08-07)', () => {
        it('inicializar el adapter de Supabase NO dispara ningun SQL: las migraciones no corren', async () => {
            // closeDatabase limpia el singleton y los flags HMR/test, forzando
            // el camino real de initializeAdapter() con el supabaseClient mockeado.
            await closeDatabase();
            try {
                const db = await getDatabase();
                expect(db).toBeInstanceOf(SupabaseAdapter);
                // Antes del fix esto fallaba: runMigrations() leia MAX(version) via
                // exec_sql_read y despues ejecutaba el UPDATE destructivo del bloque 13
                // via exec_sql_write. El arranque tiene que ser silencioso.
                expect(rpc).not.toHaveBeenCalled();
            } finally {
                await closeDatabase();
            }
        });
    });
});
