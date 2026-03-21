import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    loadHoDraft,
    listHoDraftKeys,
    deleteHoDraft,
} from '../../../modules/hojaOperaciones/useHoPersistence';
import {
    HoDocument,
    EMPTY_HO_HEADER,
    createEmptyHoSheet,
} from '../../../modules/hojaOperaciones/hojaOperacionesTypes';

// ============================================================================
// MOCK IndexedDB — jsdom doesn't provide a real one
// ============================================================================

// We test the exported utility functions (loadHoDraft, listHoDraftKeys, deleteHoDraft)
// Since jsdom lacks IndexedDB, these tests verify graceful failure behavior.

describe('useHoPersistence – exported utils', () => {
    it('loadHoDraft returns null when IndexedDB unavailable', async () => {
        const result = await loadHoDraft('ho_draft_test');
        expect(result).toBeNull();
    }, 10000);

    it('listHoDraftKeys returns empty array when IndexedDB unavailable', async () => {
        const keys = await listHoDraftKeys();
        expect(keys).toEqual([]);
    });

    it('deleteHoDraft does not throw when IndexedDB unavailable', async () => {
        await expect(deleteHoDraft('ho_draft_test')).resolves.toBeUndefined();
    });
});

// ============================================================================
// HOOK BEHAVIOR (tested via import verification)
// ============================================================================

describe('useHoPersistence – module structure', () => {
    it('exports useHoPersistence hook', async () => {
        const mod = await import('../../../modules/hojaOperaciones/useHoPersistence');
        expect(typeof mod.useHoPersistence).toBe('function');
    });

    it('exports loadHoDraft function', async () => {
        const mod = await import('../../../modules/hojaOperaciones/useHoPersistence');
        expect(typeof mod.loadHoDraft).toBe('function');
    });

    it('exports listHoDraftKeys function', async () => {
        const mod = await import('../../../modules/hojaOperaciones/useHoPersistence');
        expect(typeof mod.listHoDraftKeys).toBe('function');
    });

    it('exports deleteHoDraft function', async () => {
        const mod = await import('../../../modules/hojaOperaciones/useHoPersistence');
        expect(typeof mod.deleteHoDraft).toBe('function');
    });
});
