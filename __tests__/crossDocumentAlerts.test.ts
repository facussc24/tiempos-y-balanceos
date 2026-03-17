/**
 * Tests for utils/crossDocumentAlerts.ts
 *
 * Covers APQP_CASCADE structure, getDownstreamTargets,
 * and detectCrossDocAlerts with mocked repository.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock dependencies before importing the module
vi.mock('../utils/repositories/crossDocRepository', () => ({
    getPendingAlerts: vi.fn(),
}));

vi.mock('../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import { APQP_CASCADE, getDownstreamTargets, detectCrossDocAlerts } from '../utils/crossDocumentAlerts';
import { getPendingAlerts } from '../utils/repositories/crossDocRepository';

const mockGetPendingAlerts = vi.mocked(getPendingAlerts);

describe('APQP_CASCADE', () => {
    it('defines PFD as source with AMFE as target', () => {
        const pfdEntry = APQP_CASCADE.find(c => c.source === 'pfd');
        expect(pfdEntry).toBeDefined();
        expect(pfdEntry!.targets).toContain('amfe');
    });

    it('defines AMFE as source with CP, HO, and PFD as targets', () => {
        const amfeEntry = APQP_CASCADE.find(c => c.source === 'amfe');
        expect(amfeEntry).toBeDefined();
        expect(amfeEntry!.targets).toEqual(expect.arrayContaining(['cp', 'ho', 'pfd']));
    });

    it('defines CP as source with HO as target', () => {
        const cpEntry = APQP_CASCADE.find(c => c.source === 'cp');
        expect(cpEntry).toBeDefined();
        expect(cpEntry!.targets).toContain('ho');
    });
});

describe('getDownstreamTargets', () => {
    it('returns AMFE for PFD source', () => {
        expect(getDownstreamTargets('pfd')).toContain('amfe');
    });

    it('returns CP, HO, PFD for AMFE source', () => {
        const targets = getDownstreamTargets('amfe');
        expect(targets).toContain('cp');
        expect(targets).toContain('ho');
        expect(targets).toContain('pfd');
    });

    it('returns HO for CP source', () => {
        expect(getDownstreamTargets('cp')).toContain('ho');
    });

    it('returns empty array for HO (no downstream targets)', () => {
        expect(getDownstreamTargets('ho')).toEqual([]);
    });

    it('returns empty array for solicitud (no cascade entry)', () => {
        expect(getDownstreamTargets('solicitud')).toEqual([]);
    });
});

describe('detectCrossDocAlerts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns empty array when no pending alerts exist', async () => {
        mockGetPendingAlerts.mockResolvedValue([]);
        const alerts = await detectCrossDocAlerts('amfe', 'doc-1');
        expect(alerts).toEqual([]);
        expect(mockGetPendingAlerts).toHaveBeenCalledWith('amfe', 'doc-1');
    });

    it('maps pending checks to CrossDocAlert objects with correct fields', async () => {
        mockGetPendingAlerts.mockResolvedValue([
            {
                id: 1,
                sourceModule: 'pfd',
                sourceDocId: 'pfd-42',
                targetModule: 'amfe',
                targetDocId: 'doc-1',
                sourceRevision: 'B',
                sourceUpdated: '2026-03-15T10:00:00Z',
                acknowledgedAt: null,
            },
        ]);

        const alerts = await detectCrossDocAlerts('amfe', 'doc-1');
        expect(alerts).toHaveLength(1);
        expect(alerts[0].severity).toBe('warning');
        expect(alerts[0].code).toBe('CROSS_DOC_PFD_CHANGED');
        expect(alerts[0].sourceModule).toBe('pfd');
        expect(alerts[0].sourceDocId).toBe('pfd-42');
        expect(alerts[0].sourceRevision).toBe('B');
        expect(alerts[0].message).toContain('Diagrama de Flujo (PFD)');
        expect(alerts[0].message).toContain('Rev. B');
    });

    it('handles multiple pending alerts from different sources', async () => {
        mockGetPendingAlerts.mockResolvedValue([
            {
                id: 1,
                sourceModule: 'amfe',
                sourceDocId: 'amfe-1',
                targetModule: 'cp',
                targetDocId: 'cp-1',
                sourceRevision: 'C',
                sourceUpdated: '2026-03-15T10:00:00Z',
                acknowledgedAt: null,
            },
            {
                id: 2,
                sourceModule: 'pfd',
                sourceDocId: 'pfd-1',
                targetModule: 'cp',
                targetDocId: 'cp-1',
                sourceRevision: 'A',
                sourceUpdated: '2026-03-14T08:00:00Z',
                acknowledgedAt: null,
            },
        ]);

        const alerts = await detectCrossDocAlerts('cp', 'cp-1');
        expect(alerts).toHaveLength(2);
        expect(alerts[0].code).toBe('CROSS_DOC_AMFE_CHANGED');
        expect(alerts[1].code).toBe('CROSS_DOC_PFD_CHANGED');
    });

    it('returns empty array and logs error when repository throws', async () => {
        mockGetPendingAlerts.mockRejectedValue(new Error('DB offline'));
        const alerts = await detectCrossDocAlerts('ho', 'ho-5');
        expect(alerts).toEqual([]);
    });
});
