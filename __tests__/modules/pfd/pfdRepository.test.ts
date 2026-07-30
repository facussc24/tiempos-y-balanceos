vi.mock('../../../utils/database', () => {
    const mockDb = {
        select: vi.fn().mockResolvedValue([]),
        execute: vi.fn().mockResolvedValue({ rowsAffected: 1, lastInsertId: 0 }),
    };
    return { getDatabase: vi.fn().mockResolvedValue(mockDb) };
});

vi.mock('../../../utils/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../utils/crypto', () => ({
    generateChecksum: vi.fn().mockResolvedValue('abc123'),
}));

import { listPfdDocuments, loadPfdDocument, savePfdDocument, deletePfdDocument } from '../../../utils/repositories/pfdRepository';
import { getDatabase } from '../../../utils/database';
import { createEmptyPfdDocument } from '../../../modules/pfd/pfdTypes';
import type { PfdDocument } from '../../../modules/pfd/pfdTypes';

describe('pfdRepository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('listPfdDocuments', () => {
        it('should return empty array when no documents', async () => {
            const result = await listPfdDocuments();
            expect(result).toEqual([]);
        });

        it('should call select with correct SQL', async () => {
            await listPfdDocuments();
            const db = await getDatabase();
            expect(db.select).toHaveBeenCalledWith(expect.stringContaining('FROM pfd_documents'));
        });
    });

    describe('loadPfdDocument', () => {
        it('should return null when document not found', async () => {
            const result = await loadPfdDocument('nonexistent');
            expect(result).toBeNull();
        });

        it('should parse JSON data when found', async () => {
            const doc = createEmptyPfdDocument();
            const db = await getDatabase();
            (db.select as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ data: JSON.stringify(doc) }]);
            const result = await loadPfdDocument(doc.id);
            expect(result).not.toBeNull();
            expect(result!.id).toBe(doc.id);
        });

        it('should normalize steps on load — add missing branchId', async () => {
            // Simulate an old-format doc without branchId/branchLabel fields
            const oldDoc: PfdDocument = {
                id: 'old-doc-1',
                header: createEmptyPfdDocument().header,
                steps: [
                    {
                        id: 'step-1',
                        stepNumber: 'OP 10',
                        stepType: 'operation',
                        description: 'Old step',
                        machineDeviceTool: '',
                        productCharacteristic: '',
                        productSpecialChar: 'none',
                        processCharacteristic: '',
                        processSpecialChar: 'none',
                        reference: '',
                        department: '',
                        notes: '',
                        isRework: false,
                        isExternalProcess: false,
                        reworkReturnStep: '',
                        rejectDisposition: 'none',
                        scrapDescription: '',
                        // branchId and branchLabel intentionally MISSING
                    } as unknown as PfdDocument['steps'][0],
                ],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            const db = await getDatabase();
            (db.select as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ data: JSON.stringify(oldDoc) }]);
            const result = await loadPfdDocument('old-doc-1');
            expect(result).not.toBeNull();
            expect(result!.steps[0].branchId).toBe('');
            expect(result!.steps[0].branchLabel).toBe('');
        });

        it('should normalize steps on load — derive rejectDisposition from isRework', async () => {
            const oldDoc: PfdDocument = {
                id: 'old-doc-2',
                header: createEmptyPfdDocument().header,
                steps: [
                    {
                        id: 'step-rw',
                        stepNumber: 'OP 20',
                        stepType: 'operation',
                        description: 'Rework step',
                        machineDeviceTool: '',
                        productCharacteristic: '',
                        productSpecialChar: 'none',
                        processCharacteristic: '',
                        processSpecialChar: 'none',
                        reference: '',
                        department: '',
                        notes: '',
                        isRework: true,
                        isExternalProcess: false,
                        reworkReturnStep: '',
                        // rejectDisposition intentionally MISSING
                    } as unknown as PfdDocument['steps'][0],
                ],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            const db = await getDatabase();
            (db.select as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ data: JSON.stringify(oldDoc) }]);
            const result = await loadPfdDocument('old-doc-2');
            expect(result).not.toBeNull();
            expect(result!.steps[0].rejectDisposition).toBe('rework');
        });
    });

    describe('savePfdDocument', () => {
        it('should return true on success', async () => {
            const doc = createEmptyPfdDocument();
            const result = await savePfdDocument(doc.id, doc);
            expect(result).toBe(true);
        });

        it('should call execute with INSERT OR REPLACE', async () => {
            const doc = createEmptyPfdDocument();
            await savePfdDocument(doc.id, doc);
            const db = await getDatabase();
            expect(db.execute).toHaveBeenCalledWith(
                expect.stringContaining('INSERT OR REPLACE'),
                expect.any(Array)
            );
        });
    });

    describe('deletePfdDocument', () => {
        /**
         * Desde 2026-07-30 el borrado pasa por utils/repositories/trash.ts y tiene
         * 4 pasos: leer la fila, copiarla a deleted_documents, CONFIRMAR que quedo
         * copiada, y solo entonces borrar. Antes el fallo del archivado se degradaba
         * a un warning y el DELETE se ejecutaba igual, o sea borrar era definitivo.
         */

        /** Simula un documento que existe y un archivado que se confirma OK. */
        function mockArchivadoExitoso(db: { select: ReturnType<typeof vi.fn> }) {
            db.select
                .mockResolvedValueOnce([{ id: 'some-id', linked_amfe_project: 'PROY-TEST', data: '{}' }])
                .mockResolvedValueOnce([{ id: 'some-id' }]);
        }

        it('should return true on success', async () => {
            const db = await getDatabase();
            mockArchivadoExitoso(db as never);
            const result = await deletePfdDocument('some-id');
            expect(result).toBe(true);
        });

        it('should call execute with DELETE', async () => {
            const db = await getDatabase();
            mockArchivadoExitoso(db as never);
            await deletePfdDocument('some-id');
            expect(db.execute).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM pfd_documents'),
                ['some-id']
            );
        });

        it('should archive the full original row to the trash BEFORE deleting', async () => {
            const db = await getDatabase();
            mockArchivadoExitoso(db as never);
            await deletePfdDocument('some-id');

            const llamadas = (db.execute as ReturnType<typeof vi.fn>).mock.calls;
            const iArchivado = llamadas.findIndex(([sql]) => String(sql).includes('deleted_documents'));
            const iBorrado = llamadas.findIndex(([sql]) => String(sql).includes('DELETE FROM pfd_documents'));

            expect(iArchivado).toBeGreaterThanOrEqual(0);
            expect(iBorrado).toBeGreaterThanOrEqual(0);
            // El orden importa: archivar y DESPUES borrar, nunca al revés.
            expect(iArchivado).toBeLessThan(iBorrado);

            // row_json tiene que llevar la fila COMPLETA: pfd_documents tiene columnas
            // NOT NULL, asi que un restore desde solo `data` fallaria.
            const [, params] = llamadas[iArchivado] as [string, unknown[]];
            expect(params).toContain('pfd');
            const rowJson = params.find((p) => typeof p === 'string' && String(p).includes('linked_amfe_project'));
            expect(rowJson).toBeDefined();
        });

        it('should NOT delete when the archive cannot be confirmed', async () => {
            const db = await getDatabase();
            // La fila existe, pero la verificacion post-escritura vuelve vacia:
            // el archivado no se pudo confirmar.
            (db.select as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce([{ id: 'some-id', linked_amfe_project: 'PROY-TEST', data: '{}' }])
                .mockResolvedValueOnce([]);

            const result = await deletePfdDocument('some-id');

            expect(result).toBe(false);
            expect(db.execute).not.toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM pfd_documents'),
                expect.anything()
            );
        });

        it('should not issue a DELETE when the document does not exist', async () => {
            const db = await getDatabase();
            // select devuelve [] (no existe, o la lectura fallo). Fallar del lado
            // seguro = no borrar nada.
            const result = await deletePfdDocument('nonexistent');

            expect(result).toBe(true);
            expect(db.execute).not.toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM pfd_documents'),
                expect.anything()
            );
        });
    });
});
