/**
 * Tests for crossDocumentAlerts — mocks crossDocRepository.
 */

const mockGetPendingAlerts = vi.fn();

vi.mock('../../utils/repositories/crossDocRepository', () => ({
    getPendingAlerts: (...args: unknown[]) => mockGetPendingAlerts(...args),
}));

vi.mock('../../utils/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
    detectCrossDocAlerts,
    getDownstreamTargets,
    APQP_CASCADE,
    type CrossDocAlert,
} from '../../utils/crossDocumentAlerts';
import type { DocumentModule } from '../../utils/revisionUtils';

describe('crossDocumentAlerts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // APQP_CASCADE
    // -----------------------------------------------------------------------

    describe('APQP_CASCADE', () => {
        it('should have 3 cascade entries', () => {
            expect(APQP_CASCADE).toHaveLength(3);
        });

        it('should define PFD as source for AMFE', () => {
            const pfdEntry = APQP_CASCADE.find(c => c.source === 'pfd');
            expect(pfdEntry).toBeDefined();
            expect(pfdEntry!.targets).toEqual(['amfe']);
        });

        it('should define AMFE as source for CP, HO, and PFD', () => {
            const amfeEntry = APQP_CASCADE.find(c => c.source === 'amfe');
            expect(amfeEntry).toBeDefined();
            expect(amfeEntry!.targets).toContain('cp');
            expect(amfeEntry!.targets).toContain('ho');
            expect(amfeEntry!.targets).toContain('pfd');
        });

        it('should define CP as source for HO', () => {
            const cpEntry = APQP_CASCADE.find(c => c.source === 'cp');
            expect(cpEntry).toBeDefined();
            expect(cpEntry!.targets).toEqual(['ho']);
        });
    });

    // -----------------------------------------------------------------------
    // getDownstreamTargets
    // -----------------------------------------------------------------------

    describe('getDownstreamTargets', () => {
        it('should return [amfe] for pfd', () => {
            expect(getDownstreamTargets('pfd')).toEqual(['amfe']);
        });

        it('should return [cp, ho, pfd] for amfe', () => {
            expect(getDownstreamTargets('amfe')).toEqual(['cp', 'ho', 'pfd']);
        });

        it('should return [ho] for cp', () => {
            expect(getDownstreamTargets('cp')).toEqual(['ho']);
        });

        it('should return empty array for ho (no downstream)', () => {
            expect(getDownstreamTargets('ho')).toEqual([]);
        });
    });

    // -----------------------------------------------------------------------
    // detectCrossDocAlerts
    // -----------------------------------------------------------------------

    describe('detectCrossDocAlerts', () => {
        it('should return empty array when no pending alerts', async () => {
            mockGetPendingAlerts.mockResolvedValueOnce([]);
            const alerts = await detectCrossDocAlerts('cp', 'cp-doc-1');
            expect(alerts).toEqual([]);
            expect(mockGetPendingAlerts).toHaveBeenCalledWith('cp', 'cp-doc-1');
        });

        it('should map pending checks to CrossDocAlert objects', async () => {
            mockGetPendingAlerts.mockResolvedValueOnce([
                {
                    id: 1,
                    sourceModule: 'amfe',
                    sourceDocId: 'amfe-doc-1',
                    targetModule: 'cp',
                    targetDocId: 'cp-doc-1',
                    sourceRevision: 'B',
                    sourceUpdated: '2026-03-01T00:00:00Z',
                    acknowledgedAt: null,
                },
            ]);

            const alerts = await detectCrossDocAlerts('cp', 'cp-doc-1');
            expect(alerts).toHaveLength(1);
            expect(alerts[0].severity).toBe('warning');
            expect(alerts[0].code).toBe('CROSS_DOC_AMFE_CHANGED');
            expect(alerts[0].sourceModule).toBe('amfe');
            expect(alerts[0].sourceDocId).toBe('amfe-doc-1');
            expect(alerts[0].sourceRevision).toBe('B');
        });

        it('should include Spanish message with module name and revision', async () => {
            mockGetPendingAlerts.mockResolvedValueOnce([
                {
                    id: 2,
                    sourceModule: 'pfd',
                    sourceDocId: 'pfd-doc-1',
                    targetModule: 'amfe',
                    targetDocId: 'amfe-doc-1',
                    sourceRevision: 'C',
                    sourceUpdated: '2026-03-02',
                    acknowledgedAt: null,
                },
            ]);

            const alerts = await detectCrossDocAlerts('amfe', 'amfe-doc-1');
            expect(alerts[0].message).toContain('Diagrama de Flujo (PFD)');
            expect(alerts[0].message).toContain('Rev. C');
        });

        it('should handle multiple pending alerts', async () => {
            mockGetPendingAlerts.mockResolvedValueOnce([
                {
                    id: 1,
                    sourceModule: 'amfe',
                    sourceDocId: 'amfe-1',
                    targetModule: 'ho',
                    targetDocId: 'ho-1',
                    sourceRevision: 'B',
                    sourceUpdated: '2026-01-01',
                    acknowledgedAt: null,
                },
                {
                    id: 2,
                    sourceModule: 'cp',
                    sourceDocId: 'cp-1',
                    targetModule: 'ho',
                    targetDocId: 'ho-1',
                    sourceRevision: 'D',
                    sourceUpdated: '2026-02-01',
                    acknowledgedAt: null,
                },
            ]);

            const alerts = await detectCrossDocAlerts('ho', 'ho-1');
            expect(alerts).toHaveLength(2);
            expect(alerts[0].code).toBe('CROSS_DOC_AMFE_CHANGED');
            expect(alerts[1].code).toBe('CROSS_DOC_CP_CHANGED');
        });

        it('should use AMFE display name in message', async () => {
            mockGetPendingAlerts.mockResolvedValueOnce([
                {
                    id: 1,
                    sourceModule: 'amfe',
                    sourceDocId: 'a1',
                    targetModule: 'cp',
                    targetDocId: 'c1',
                    sourceRevision: 'A',
                    sourceUpdated: '2026-01-01',
                    acknowledgedAt: null,
                },
            ]);
            const alerts = await detectCrossDocAlerts('cp', 'c1');
            expect(alerts[0].message).toContain('AMFE');
        });

        it('should use Plan de Control display name for cp source', async () => {
            mockGetPendingAlerts.mockResolvedValueOnce([
                {
                    id: 1,
                    sourceModule: 'cp',
                    sourceDocId: 'c1',
                    targetModule: 'ho',
                    targetDocId: 'h1',
                    sourceRevision: 'B',
                    sourceUpdated: '2026-01-01',
                    acknowledgedAt: null,
                },
            ]);
            const alerts = await detectCrossDocAlerts('ho', 'h1');
            expect(alerts[0].message).toContain('Plan de Control');
        });

        it('should use Hoja de Operaciones display name for ho source', async () => {
            mockGetPendingAlerts.mockResolvedValueOnce([
                {
                    id: 1,
                    sourceModule: 'ho',
                    sourceDocId: 'h1',
                    targetModule: 'amfe',
                    targetDocId: 'a1',
                    sourceRevision: 'A',
                    sourceUpdated: '2026-01-01',
                    acknowledgedAt: null,
                },
            ]);
            const alerts = await detectCrossDocAlerts('amfe', 'a1');
            expect(alerts[0].message).toContain('Hoja de Operaciones');
        });

        it('should return empty array on error', async () => {
            mockGetPendingAlerts.mockRejectedValueOnce(new Error('DB error'));
            const alerts = await detectCrossDocAlerts('cp', 'cp-1');
            expect(alerts).toEqual([]);
        });
    });
});
