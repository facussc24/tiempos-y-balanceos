import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (hoisted before imports)
// ---------------------------------------------------------------------------

vi.mock('../../../utils/repositories/settingsRepository', () => ({
    getSetting: vi.fn().mockResolvedValue([]),
    setSetting: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../modules/solicitud/solicitudServerManager', () => ({
    isSolicitudServerAvailable: vi.fn().mockResolvedValue(true),
    ensureSolicitudFolder: vi.fn().mockResolvedValue({ success: true, folderPath: 'Y:\\test', adjuntosPath: 'Y:\\test\\adjuntos' }),
    moveSolicitudToObsoletos: vi.fn().mockResolvedValue(true),
    syncSolicitudToServer: vi.fn().mockResolvedValue({ success: true, folderPath: 'Y:\\test', pdfCopied: true }),
}));

vi.mock('../../../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
    enqueueOp,
    getPendingOps,
    removeOp,
    updateOpError,
    getPendingOpCount,
    processPendingOps,
} from '../../../modules/solicitud/solicitudPendingOps';
import type { PendingOperation } from '../../../modules/solicitud/solicitudPendingOps';
import { getSetting, setSetting } from '../../../utils/repositories/settingsRepository';
import {
    isSolicitudServerAvailable,
    ensureSolicitudFolder,
    moveSolicitudToObsoletos,
    syncSolicitudToServer,
} from '../../../modules/solicitud/solicitudServerManager';
import type { SolicitudDocument } from '../../../modules/solicitud/solicitudTypes';
import { createEmptySolicitud } from '../../../modules/solicitud/solicitudTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockGetSetting = getSetting as ReturnType<typeof vi.fn>;
const mockSetSetting = setSetting as ReturnType<typeof vi.fn>;
const mockServerAvailable = isSolicitudServerAvailable as ReturnType<typeof vi.fn>;
const mockEnsureFolder = ensureSolicitudFolder as ReturnType<typeof vi.fn>;
const mockMoveToObsoletos = moveSolicitudToObsoletos as ReturnType<typeof vi.fn>;
const mockSyncToServer = syncSolicitudToServer as ReturnType<typeof vi.fn>;

function makePendingOp(overrides: Partial<PendingOperation> = {}): PendingOperation {
    return {
        id: 'op-1',
        type: 'createFolder',
        solicitudId: 'sol-1',
        payload: {},
        createdAt: '2026-03-01T00:00:00.000Z',
        retryCount: 0,
        ...overrides,
    };
}

function makeSolicitudDoc(): SolicitudDocument {
    return createEmptySolicitud('producto');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('solicitudPendingOps', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetSetting.mockResolvedValue([]);
        mockSetSetting.mockResolvedValue(undefined);
        mockServerAvailable.mockResolvedValue(true);
        mockEnsureFolder.mockResolvedValue({ success: true, folderPath: 'Y:\\test', adjuntosPath: 'Y:\\test\\adjuntos' });
        mockMoveToObsoletos.mockResolvedValue(true);
        mockSyncToServer.mockResolvedValue({ success: true, folderPath: 'Y:\\test', pdfCopied: true });
    });

    // -----------------------------------------------------------------------
    // enqueueOp
    // -----------------------------------------------------------------------

    describe('enqueueOp', () => {
        it('adds an operation to an empty queue and persists it', async () => {
            await enqueueOp('createFolder', 'sol-1', { doc: makeSolicitudDoc() });

            expect(mockSetSetting).toHaveBeenCalledTimes(1);
            const savedQueue = mockSetSetting.mock.calls[0][1] as PendingOperation[];
            expect(savedQueue).toHaveLength(1);
            expect(savedQueue[0].type).toBe('createFolder');
            expect(savedQueue[0].solicitudId).toBe('sol-1');
            expect(savedQueue[0].retryCount).toBe(0);
        });

        it('appends to an existing queue', async () => {
            const existing = makePendingOp({ id: 'existing-op' });
            mockGetSetting.mockResolvedValue([existing]);

            await enqueueOp('moveToObsoletos', 'sol-2');

            const savedQueue = mockSetSetting.mock.calls[0][1] as PendingOperation[];
            expect(savedQueue).toHaveLength(2);
            expect(savedQueue[0].id).toBe('existing-op');
            expect(savedQueue[1].type).toBe('moveToObsoletos');
        });

        it('generates an id and sets correct fields', async () => {
            await enqueueOp('exportPdf', 'sol-99', { extra: 42 });

            const savedQueue = mockSetSetting.mock.calls[0][1] as PendingOperation[];
            expect(savedQueue).toHaveLength(1);
            const op = savedQueue[0];
            expect(op.id).toBeTruthy();
            expect(typeof op.id).toBe('string');
            expect(op.type).toBe('exportPdf');
            expect(op.solicitudId).toBe('sol-99');
            expect(op.payload).toEqual({ extra: 42 });
            expect(op.retryCount).toBe(0);
            expect(op.createdAt).toBeTruthy();
        });
    });

    // -----------------------------------------------------------------------
    // getPendingOps
    // -----------------------------------------------------------------------

    describe('getPendingOps', () => {
        it('returns empty array when no ops are stored', async () => {
            mockGetSetting.mockResolvedValue(null);
            const ops = await getPendingOps();
            expect(ops).toEqual([]);
        });

        it('returns stored operations', async () => {
            const ops = [makePendingOp(), makePendingOp({ id: 'op-2' })];
            mockGetSetting.mockResolvedValue(ops);

            const result = await getPendingOps();
            expect(result).toHaveLength(2);
        });

        it('returns empty array on getSetting error', async () => {
            mockGetSetting.mockRejectedValue(new Error('DB read error'));
            const ops = await getPendingOps();
            expect(ops).toEqual([]);
        });
    });

    // -----------------------------------------------------------------------
    // removeOp
    // -----------------------------------------------------------------------

    describe('removeOp', () => {
        it('removes the operation with the given id', async () => {
            const ops = [makePendingOp({ id: 'op-1' }), makePendingOp({ id: 'op-2' })];
            mockGetSetting.mockResolvedValue(ops);

            await removeOp('op-1');

            const savedQueue = mockSetSetting.mock.calls[0][1] as PendingOperation[];
            expect(savedQueue).toHaveLength(1);
            expect(savedQueue[0].id).toBe('op-2');
        });

        it('does not write if id is not found', async () => {
            const ops = [makePendingOp({ id: 'op-1' })];
            mockGetSetting.mockResolvedValue(ops);

            await removeOp('nonexistent');

            expect(mockSetSetting).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // updateOpError
    // -----------------------------------------------------------------------

    describe('updateOpError', () => {
        it('increments retryCount and sets lastError', async () => {
            const ops = [makePendingOp({ id: 'op-1', retryCount: 1 })];
            mockGetSetting.mockResolvedValue(ops);

            await updateOpError('op-1', 'Network timeout');

            const savedQueue = mockSetSetting.mock.calls[0][1] as PendingOperation[];
            expect(savedQueue[0].retryCount).toBe(2);
            expect(savedQueue[0].lastError).toBe('Network timeout');
        });

        it('does nothing if op id is not found', async () => {
            mockGetSetting.mockResolvedValue([makePendingOp()]);

            await updateOpError('nonexistent', 'some error');

            expect(mockSetSetting).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // getPendingOpCount
    // -----------------------------------------------------------------------

    describe('getPendingOpCount', () => {
        it('returns 0 for empty queue', async () => {
            mockGetSetting.mockResolvedValue([]);
            expect(await getPendingOpCount()).toBe(0);
        });

        it('returns correct count', async () => {
            mockGetSetting.mockResolvedValue([makePendingOp(), makePendingOp({ id: 'op-2' }), makePendingOp({ id: 'op-3' })]);
            expect(await getPendingOpCount()).toBe(3);
        });
    });

    // -----------------------------------------------------------------------
    // processPendingOps
    // -----------------------------------------------------------------------

    describe('processPendingOps', () => {
        it('returns {0,0} when queue is empty', async () => {
            mockGetSetting.mockResolvedValue([]);
            const result = await processPendingOps();
            expect(result).toEqual({ processed: 0, failed: 0 });
            // Should not even check server availability
            expect(mockServerAvailable).not.toHaveBeenCalled();
        });

        it('skips processing when server is unavailable', async () => {
            const ops = [makePendingOp({ id: 'op-1', payload: { doc: makeSolicitudDoc() } })];
            mockGetSetting.mockResolvedValue(ops);
            mockServerAvailable.mockResolvedValue(false);

            const result = await processPendingOps();

            expect(result).toEqual({ processed: 0, failed: 1 });
            expect(mockEnsureFolder).not.toHaveBeenCalled();
        });

        it('processes createFolder op successfully and removes it', async () => {
            const doc = makeSolicitudDoc();
            const ops = [makePendingOp({ id: 'op-1', type: 'createFolder', payload: { doc } })];
            mockGetSetting.mockResolvedValue(ops);

            const result = await processPendingOps();

            expect(result).toEqual({ processed: 1, failed: 0 });
            expect(mockEnsureFolder).toHaveBeenCalledWith(doc);
            // Queue should be empty after processing
            const savedQueue = mockSetSetting.mock.calls[0][1] as PendingOperation[];
            expect(savedQueue).toHaveLength(0);
        });

        it('processes moveToObsoletos op successfully', async () => {
            const doc = makeSolicitudDoc();
            const ops = [makePendingOp({ id: 'op-1', type: 'moveToObsoletos', payload: { doc } })];
            mockGetSetting.mockResolvedValue(ops);

            const result = await processPendingOps();

            expect(result).toEqual({ processed: 1, failed: 0 });
            expect(mockMoveToObsoletos).toHaveBeenCalledWith(doc);
        });

        it('processes exportPdf op via syncSolicitudToServer', async () => {
            const doc = makeSolicitudDoc();
            const ops = [makePendingOp({ id: 'op-1', type: 'exportPdf', payload: { doc } })];
            mockGetSetting.mockResolvedValue(ops);

            const result = await processPendingOps();

            expect(result).toEqual({ processed: 1, failed: 0 });
            expect(mockSyncToServer).toHaveBeenCalledWith(doc);
        });

        it('treats updateIndex as a no-op success', async () => {
            const ops = [makePendingOp({ id: 'op-1', type: 'updateIndex' })];
            mockGetSetting.mockResolvedValue(ops);

            const result = await processPendingOps();

            expect(result).toEqual({ processed: 1, failed: 0 });
        });

        it('discards operations that exceed MAX_RETRY_COUNT (5)', async () => {
            const ops = [makePendingOp({ id: 'op-1', retryCount: 5, lastError: 'old error' })];
            mockGetSetting.mockResolvedValue(ops);

            const result = await processPendingOps();

            expect(result).toEqual({ processed: 0, failed: 1 });
            // Op should still be removed from the queue (discarded)
            const savedQueue = mockSetSetting.mock.calls[0][1] as PendingOperation[];
            expect(savedQueue).toHaveLength(0);
        });

        it('increments retryCount on failed op and keeps it in queue', async () => {
            const doc = makeSolicitudDoc();
            const ops = [makePendingOp({ id: 'op-1', type: 'createFolder', retryCount: 2, payload: { doc } })];
            mockGetSetting.mockResolvedValue(ops);
            mockEnsureFolder.mockResolvedValue({ success: false, folderPath: '', adjuntosPath: '', error: 'fail' });

            const result = await processPendingOps();

            expect(result).toEqual({ processed: 0, failed: 1 });
            const savedQueue = mockSetSetting.mock.calls[0][1] as PendingOperation[];
            expect(savedQueue).toHaveLength(1);
            expect(savedQueue[0].retryCount).toBe(3);
            expect(savedQueue[0].lastError).toBe('Operation returned false');
        });

        it('handles exceptions thrown during executeOp', async () => {
            const doc = makeSolicitudDoc();
            const ops = [makePendingOp({ id: 'op-1', type: 'createFolder', payload: { doc } })];
            mockGetSetting.mockResolvedValue(ops);
            mockEnsureFolder.mockRejectedValue(new Error('Network crash'));

            const result = await processPendingOps();

            expect(result).toEqual({ processed: 0, failed: 1 });
            const savedQueue = mockSetSetting.mock.calls[0][1] as PendingOperation[];
            expect(savedQueue).toHaveLength(1);
            expect(savedQueue[0].retryCount).toBe(1);
            expect(savedQueue[0].lastError).toBe('Network crash');
        });

        it('fails createFolder op when doc payload is missing', async () => {
            const ops = [makePendingOp({ id: 'op-1', type: 'createFolder', payload: {} })];
            mockGetSetting.mockResolvedValue(ops);

            const result = await processPendingOps();

            expect(result).toEqual({ processed: 0, failed: 1 });
            expect(mockEnsureFolder).not.toHaveBeenCalled();
        });
    });
});
