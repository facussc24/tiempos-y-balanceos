/**
 * Tests de amfeRegistryRepository — catalogo maestro de AMFEs (amfe_registry).
 *
 * Corre contra el InMemoryAdapter REAL (sin mockear getDatabase): cada test
 * arranca con resetDatabaseForTesting() para tener una DB en memoria limpia,
 * igual que __tests__/utils/database.test.ts.
 */

vi.mock('../../../utils/unified_fs', () => ({
    isTauri: vi.fn().mockReturnValue(false),
}));

vi.mock('../../../utils/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { getDatabase, closeDatabase, resetDatabaseForTesting } from '../../../utils/database';
import {
    listRegistry,
    getByAmfeCode,
    upsertRegistryEntry,
    linkDocument,
} from '../../../utils/repositories/amfeRegistryRepository';
import type { AmfeCatalogUpsert } from '../../../utils/repositories/amfeRegistryRepository';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Entrada minima valida del catalogo (datos de test, no reales). */
function makeEntry(overrides: Partial<AmfeCatalogUpsert> = {}): AmfeCatalogUpsert {
    return {
        amfeCode: '128',
        tipo: 'proceso',
        producto: 'Producto Test',
        partNumber: 'PN-TEST-001',
        cliente: 'Cliente Test',
        proyecto: 'Proyecto Test',
        planta: 'Planta Test',
        estado: 'Liberado',
        propietario: 'Responsable Test',
        equipo: 'Equipo Test',
        fechaCreacion: '2024-01-15',
        revActual: 'B',
        fechaUltimaRev: '2026-01-10',
        proximaRevision: '2027-01-10',
        serverPath: 'Y:\\Ingenieria\\13. AMFE\\128 - Producto Test.xlsx',
        documentId: null,
        historial: [],
        notas: '',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('amfeRegistryRepository (InMemoryAdapter)', () => {
    beforeEach(() => {
        resetDatabaseForTesting();
    });

    afterEach(async () => {
        await closeDatabase();
    });

    // -----------------------------------------------------------------------
    // upsertRegistryEntry — insert + mapeo camelCase
    // -----------------------------------------------------------------------

    describe('upsertRegistryEntry (insert)', () => {
        it('inserta una fila nueva y getByAmfeCode la devuelve mapeada a camelCase', async () => {
            const ok = await upsertRegistryEntry(makeEntry(), 'tester');
            expect(ok).toBe(true);

            const entry = await getByAmfeCode('128');
            expect(entry).not.toBeNull();
            expect(entry!.id).toEqual(expect.any(String));
            expect(entry!.id.length).toBeGreaterThan(0);
            expect(entry!.amfeCode).toBe('128');
            expect(entry!.tipo).toBe('proceso');
            expect(entry!.producto).toBe('Producto Test');
            expect(entry!.partNumber).toBe('PN-TEST-001');
            expect(entry!.cliente).toBe('Cliente Test');
            expect(entry!.proyecto).toBe('Proyecto Test');
            expect(entry!.planta).toBe('Planta Test');
            expect(entry!.estado).toBe('Liberado');
            expect(entry!.propietario).toBe('Responsable Test');
            expect(entry!.equipo).toBe('Equipo Test');
            expect(entry!.fechaCreacion).toBe('2024-01-15');
            expect(entry!.revActual).toBe('B');
            expect(entry!.fechaUltimaRev).toBe('2026-01-10');
            expect(entry!.proximaRevision).toBe('2027-01-10');
            expect(entry!.serverPath).toBe('Y:\\Ingenieria\\13. AMFE\\128 - Producto Test.xlsx');
            expect(entry!.documentId).toBeNull();
            expect(entry!.historial).toEqual([]);
            expect(entry!.notas).toBe('');
        });

        it('getByAmfeCode devuelve null si el codigo no existe', async () => {
            const entry = await getByAmfeCode('999');
            expect(entry).toBeNull();
        });

        it('el historial hace round-trip JSON (guardar y leer)', async () => {
            const historial = [
                { rev: 'A', date: '2024-01-15', description: 'Emision inicial', solicitante: 'Solicitante Test' },
                { rev: 'B', date: '2026-01-10', description: 'Cambio de proceso', aprobador: 'Aprobador Test', vinculo: 'CP-128' },
            ];
            await upsertRegistryEntry(makeEntry({ historial }));

            const entry = await getByAmfeCode('128');
            expect(entry!.historial).toEqual(historial);
        });
    });

    // -----------------------------------------------------------------------
    // upsertRegistryEntry — update (clave de negocio amfe_code)
    // -----------------------------------------------------------------------

    describe('upsertRegistryEntry (update de codigo existente)', () => {
        it('actualiza la fila sin duplicar y preserva el id original', async () => {
            await upsertRegistryEntry(makeEntry({ estado: 'Borrador', revActual: 'A', notas: '' }));
            const before = await getByAmfeCode('128');
            expect(before).not.toBeNull();

            const ok = await upsertRegistryEntry(
                makeEntry({ estado: 'Liberado', revActual: 'B', notas: 'paso a rev B' }),
                'tester-2',
            );
            expect(ok).toBe(true);

            // No duplica: sigue habiendo una sola entrada
            const all = await listRegistry();
            expect(all).toHaveLength(1);

            // Actualiza los campos y preserva el id
            const after = await getByAmfeCode('128');
            expect(after!.id).toBe(before!.id);
            expect(after!.estado).toBe('Liberado');
            expect(after!.revActual).toBe('B');
            expect(after!.notas).toBe('paso a rev B');
            // updated_at lo setea el UPDATE con datetime('now')
            expect(after!.updatedAt).toEqual(expect.any(String));
            expect(after!.updatedAt.length).toBeGreaterThan(0);
        });
    });

    // -----------------------------------------------------------------------
    // listRegistry — orden numerico primero, alfanumericos despues
    // -----------------------------------------------------------------------

    describe('listRegistry', () => {
        it('devuelve [] con la tabla vacia', async () => {
            const all = await listRegistry();
            expect(all).toEqual([]);
        });

        it('ordena codigos numericos ascendentes primero y alfanumericos despues', async () => {
            // Insertar desordenado a proposito
            await upsertRegistryEntry(makeEntry({ amfeCode: '161' }));
            await upsertRegistryEntry(makeEntry({ amfeCode: 'M-COSTURA', tipo: 'maestro' }));
            await upsertRegistryEntry(makeEntry({ amfeCode: '99' }));
            await upsertRegistryEntry(makeEntry({ amfeCode: 'A-MAESTRO', tipo: 'maestro' }));
            await upsertRegistryEntry(makeEntry({ amfeCode: '128' }));

            const codes = (await listRegistry()).map(e => e.amfeCode);
            // '99' < '128' numericamente (no alfabeticamente); alfanumericos al final por localeCompare
            expect(codes).toEqual(['99', '128', '161', 'A-MAESTRO', 'M-COSTURA']);
        });
    });

    // -----------------------------------------------------------------------
    // linkDocument — setear y limpiar document_id
    // -----------------------------------------------------------------------

    describe('linkDocument', () => {
        it('setea el document_id y lo limpia con null', async () => {
            await upsertRegistryEntry(makeEntry({ amfeCode: '99', documentId: null }));

            const okLink = await linkDocument('99', 'doc-uuid-test-1', 'tester');
            expect(okLink).toBe(true);
            expect((await getByAmfeCode('99'))!.documentId).toBe('doc-uuid-test-1');

            const okUnlink = await linkDocument('99', null, 'tester');
            expect(okUnlink).toBe(true);
            expect((await getByAmfeCode('99'))!.documentId).toBeNull();
        });

        it('no toca otras filas del catalogo', async () => {
            await upsertRegistryEntry(makeEntry({ amfeCode: '99' }));
            await upsertRegistryEntry(makeEntry({ amfeCode: '128' }));

            await linkDocument('99', 'doc-uuid-test-1');

            expect((await getByAmfeCode('99'))!.documentId).toBe('doc-uuid-test-1');
            expect((await getByAmfeCode('128'))!.documentId).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // Robustez — historial corrupto en la fila
    // -----------------------------------------------------------------------

    describe('historial con JSON invalido', () => {
        it('devuelve historial [] sin romper si la fila tiene JSON invalido', async () => {
            // Insertar crudo, salteando el repositorio (simula fila corrupta)
            const db = await getDatabase();
            await db.execute(
                `INSERT INTO amfe_registry
                     (id, amfe_code, tipo, producto, part_number, cliente, proyecto, planta,
                      estado, propietario, equipo, fecha_creacion, rev_actual, fecha_ultima_rev,
                      proxima_revision, server_path, document_id, historial, notas,
                      created_by, updated_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    'row-corrupta-1', '77', 'proceso', '', '', '', '', '',
                    'Borrador', '', '', '', 'A', '',
                    '', '', null, 'no-json', '',
                    '', '',
                ],
            );

            const entry = await getByAmfeCode('77');
            expect(entry).not.toBeNull();
            expect(entry!.amfeCode).toBe('77');
            expect(entry!.historial).toEqual([]);
        });
    });
});
