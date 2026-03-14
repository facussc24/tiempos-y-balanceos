/**
 * Tests for useRevisionControl hook
 */

import { renderHook, act } from '@testing-library/react';
import { useRevisionControl } from '../../hooks/useRevisionControl';

// --- Mocks ---

const mockSaveRevision = vi.fn().mockResolvedValue(true);
const mockListRevisions = vi.fn().mockResolvedValue([]);
const mockLoadRevisionSnapshot = vi.fn().mockResolvedValue(null);
const mockUpsertCrossDocCheck = vi.fn().mockResolvedValue(undefined);
const mockGenerateChecksum = vi.fn().mockResolvedValue('abc123');

vi.mock('../../utils/repositories/revisionRepository', () => ({
    saveRevision: (...args: unknown[]) => mockSaveRevision(...args),
    listRevisions: (...args: unknown[]) => mockListRevisions(...args),
    loadRevisionSnapshot: (...args: unknown[]) => mockLoadRevisionSnapshot(...args),
    getLatestRevisionLevel: vi.fn().mockResolvedValue('A'),
}));

vi.mock('../../utils/repositories/crossDocRepository', () => ({
    upsertCrossDocCheck: (...args: unknown[]) => mockUpsertCrossDocCheck(...args),
}));

vi.mock('../../utils/crossDocumentAlerts', () => ({
    detectCrossDocAlerts: vi.fn().mockResolvedValue([]),
    getDownstreamTargets: vi.fn().mockImplementation((mod: string) => {
        if (mod === 'amfe') return ['cp', 'ho', 'pfd'];
        if (mod === 'pfd') return ['amfe'];
        if (mod === 'cp') return ['ho'];
        return [];
    }),
    APQP_CASCADE: [
        { source: 'pfd', targets: ['amfe'] },
        { source: 'amfe', targets: ['cp', 'ho', 'pfd'] },
        { source: 'cp', targets: ['ho'] },
    ],
}));

vi.mock('../../utils/crypto', () => ({
    generateChecksum: (...args: unknown[]) => mockGenerateChecksum(...args),
}));

vi.mock('../../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// --- Tests ---

describe('useRevisionControl', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockListRevisions.mockResolvedValue([]);
    });

    it('loads revisions on mount when documentId is provided', async () => {
        const mockRevisions = [
            { revisionLevel: 'A', description: 'Initial', revisedBy: 'Test', parentRevisionLevel: '', createdAt: '2026-01-01' },
        ];
        mockListRevisions.mockResolvedValue(mockRevisions);

        const { result } = renderHook(() =>
            useRevisionControl({
                module: 'amfe',
                documentId: 'doc-1',
                currentData: { header: {} },
                currentRevisionLevel: 'A',
            }),
        );

        // Wait for the async effect
        await vi.waitFor(() => {
            expect(result.current.revisions).toHaveLength(1);
        });

        expect(mockListRevisions).toHaveBeenCalledWith('amfe', 'doc-1');
        expect(result.current.revisions[0].revisionLevel).toBe('A');
    });

    it('does not load revisions when documentId is null', () => {
        const { result } = renderHook(() =>
            useRevisionControl({
                module: 'amfe',
                documentId: null,
                currentData: {},
                currentRevisionLevel: 'A',
            }),
        );

        expect(result.current.revisions).toHaveLength(0);
        expect(mockListRevisions).not.toHaveBeenCalled();
    });

    it('handleNewRevision opens the prompt modal', () => {
        const { result } = renderHook(() =>
            useRevisionControl({
                module: 'amfe',
                documentId: 'doc-1',
                currentData: {},
                currentRevisionLevel: 'A',
            }),
        );

        expect(result.current.showRevisionPrompt).toBe(false);

        act(() => {
            result.current.handleNewRevision();
        });

        expect(result.current.showRevisionPrompt).toBe(true);
    });

    it('confirmRevision saves snapshot, increments level, and returns new level', async () => {
        const onRevisionCreated = vi.fn();
        mockListRevisions.mockResolvedValue([]);
        mockSaveRevision.mockResolvedValue(true);

        const { result } = renderHook(() =>
            useRevisionControl({
                module: 'amfe',
                documentId: 'doc-1',
                currentData: { header: { revision: 'A' } },
                currentRevisionLevel: 'A',
                onRevisionCreated,
            }),
        );

        let newLevel: string | null = null;
        await act(async () => {
            newLevel = await result.current.confirmRevision('Changed the process', 'John');
        });

        expect(newLevel).toBe('B');
        expect(mockGenerateChecksum).toHaveBeenCalled();
        expect(mockSaveRevision).toHaveBeenCalledWith(
            'amfe',
            'doc-1',
            'A',
            'Changed the process',
            'John',
            expect.any(String),
            'abc123',
            '',
        );
        expect(onRevisionCreated).toHaveBeenCalledWith('B');
        expect(result.current.showRevisionPrompt).toBe(false);
    });

    it('confirmRevision notifies downstream documents', async () => {
        mockSaveRevision.mockResolvedValue(true);
        mockListRevisions.mockResolvedValue([]);

        const linkedDocuments = [
            { module: 'cp' as const, docId: 'cp-1' },
            { module: 'ho' as const, docId: 'ho-1' },
        ];

        const { result } = renderHook(() =>
            useRevisionControl({
                module: 'amfe',
                documentId: 'doc-1',
                currentData: {},
                currentRevisionLevel: 'A',
                linkedDocuments,
            }),
        );

        await act(async () => {
            await result.current.confirmRevision('Updated operations', 'Jane');
        });

        // Should notify cp and ho (both are downstream of amfe)
        expect(mockUpsertCrossDocCheck).toHaveBeenCalledTimes(2);
        expect(mockUpsertCrossDocCheck).toHaveBeenCalledWith(
            'amfe', 'doc-1', 'cp', 'cp-1', 'B', expect.any(String),
        );
        expect(mockUpsertCrossDocCheck).toHaveBeenCalledWith(
            'amfe', 'doc-1', 'ho', 'ho-1', 'B', expect.any(String),
        );
    });

    it('confirmRevision returns null when documentId is null', async () => {
        const { result } = renderHook(() =>
            useRevisionControl({
                module: 'amfe',
                documentId: null,
                currentData: {},
                currentRevisionLevel: 'A',
            }),
        );

        let newLevel: string | null = null;
        await act(async () => {
            newLevel = await result.current.confirmRevision('test', 'user');
        });

        expect(newLevel).toBeNull();
        expect(mockSaveRevision).not.toHaveBeenCalled();
    });

    it('confirmRevision returns null when save fails', async () => {
        mockSaveRevision.mockResolvedValue(false);

        const { result } = renderHook(() =>
            useRevisionControl({
                module: 'amfe',
                documentId: 'doc-1',
                currentData: {},
                currentRevisionLevel: 'A',
            }),
        );

        let newLevel: string | null = null;
        await act(async () => {
            newLevel = await result.current.confirmRevision('test', 'user');
        });

        expect(newLevel).toBeNull();
    });

    it('loadSnapshot returns parsed JSON', async () => {
        const snapshotData = JSON.stringify({ header: { revision: 'A' }, operations: [] });
        mockLoadRevisionSnapshot.mockResolvedValue(snapshotData);

        const { result } = renderHook(() =>
            useRevisionControl({
                module: 'amfe',
                documentId: 'doc-1',
                currentData: {},
                currentRevisionLevel: 'B',
            }),
        );

        let snapshot: unknown = null;
        await act(async () => {
            snapshot = await result.current.loadSnapshot('A');
        });

        expect(snapshot).toEqual({ header: { revision: 'A' }, operations: [] });
        expect(mockLoadRevisionSnapshot).toHaveBeenCalledWith('amfe', 'doc-1', 'A');
    });

    it('loadSnapshot returns null when not found', async () => {
        mockLoadRevisionSnapshot.mockResolvedValue(null);

        const { result } = renderHook(() =>
            useRevisionControl({
                module: 'amfe',
                documentId: 'doc-1',
                currentData: {},
                currentRevisionLevel: 'B',
            }),
        );

        let snapshot: unknown = 'sentinel';
        await act(async () => {
            snapshot = await result.current.loadSnapshot('Z');
        });

        expect(snapshot).toBeNull();
    });

    it('setShowRevisionHistory toggles history panel state', () => {
        const { result } = renderHook(() =>
            useRevisionControl({
                module: 'pfd',
                documentId: 'pfd-1',
                currentData: {},
                currentRevisionLevel: 'A',
            }),
        );

        expect(result.current.showRevisionHistory).toBe(false);

        act(() => {
            result.current.setShowRevisionHistory(true);
        });

        expect(result.current.showRevisionHistory).toBe(true);
    });
});
