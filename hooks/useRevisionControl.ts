/**
 * useRevisionControl — Hook for managing document revisions
 *
 * Provides revision creation workflow, history listing, and snapshot loading.
 * Notifies downstream documents via cross-doc checks on revision creation.
 *
 * @module useRevisionControl
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { DocumentModule } from '../utils/revisionUtils';
import { getNextRevisionLevel } from '../utils/revisionUtils';
import {
    saveRevision,
    listRevisions,
    loadRevisionSnapshot,
    type RevisionListItem,
} from '../utils/repositories/revisionRepository';
import { upsertCrossDocCheck } from '../utils/repositories/crossDocRepository';
import { getDownstreamTargets } from '../utils/crossDocumentAlerts';
import { generateChecksum } from '../utils/crypto';
import { logger } from '../utils/logger';
import { createServerBackup } from '../utils/backupService';

interface UseRevisionControlParams {
    module: DocumentModule;
    documentId: string | null;
    currentData: unknown;
    currentRevisionLevel: string;
    revisedBy?: string;
    onRevisionCreated?: (newLevel: string) => void;
    linkedDocuments?: { module: DocumentModule; docId: string }[];
}

interface UseRevisionControlReturn {
    handleNewRevision: () => void;
    revisions: RevisionListItem[];
    loadSnapshot: (level: string) => Promise<unknown>;
    isLoading: boolean;
    showRevisionPrompt: boolean;
    setShowRevisionPrompt: (v: boolean) => void;
    showRevisionHistory: boolean;
    setShowRevisionHistory: (v: boolean) => void;
    confirmRevision: (description: string, revisedBy: string) => Promise<string | null>;
}

export function useRevisionControl(params: UseRevisionControlParams): UseRevisionControlReturn {
    const {
        module,
        documentId,
        currentData,
        currentRevisionLevel,
        onRevisionCreated,
        linkedDocuments,
    } = params;

    const [showRevisionPrompt, setShowRevisionPrompt] = useState(false);
    const [showRevisionHistory, setShowRevisionHistory] = useState(false);
    const [revisions, setRevisions] = useState<RevisionListItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    // FIX: Mutex ref to prevent duplicate revisions from rapid clicks
    const savingRevisionRef = useRef(false);

    // Load revisions list on mount and when documentId changes
    useEffect(() => {
        if (!documentId) {
            setRevisions([]);
            return;
        }

        let cancelled = false;
        setIsLoading(true);
        listRevisions(module, documentId)
            .then(list => {
                if (!cancelled) setRevisions(list);
            })
            .catch(err => {
                logger.error('useRevisionControl', 'Failed to load revisions', {}, err instanceof Error ? err : undefined);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => { cancelled = true; };
    }, [module, documentId]);

    const handleNewRevision = useCallback(() => {
        setShowRevisionPrompt(true);
    }, []);

    const confirmRevision = useCallback(async (description: string, revisedBy: string): Promise<string | null> => {
        if (!documentId) return null;
        // FIX: Mutex to prevent duplicate revisions from rapid double-clicks
        if (savingRevisionRef.current) return null;
        savingRevisionRef.current = true;

        setIsLoading(true);
        try {
            // 1. Snapshot current data
            const snapshotData = JSON.stringify(currentData);

            // 2. Generate checksum
            const checksum = await generateChecksum(snapshotData);

            // 3. Save snapshot (parentLevel = most recent existing revision for traceability)
            const parentLevel = revisions[0]?.revisionLevel || '';
            const saved = await saveRevision(
                module,
                documentId,
                currentRevisionLevel,
                description,
                revisedBy,
                snapshotData,
                checksum,
                parentLevel,
            );
            if (!saved) {
                // FIX: Include module/doc context for debuggability
                logger.error('useRevisionControl', `Failed to save revision ${currentRevisionLevel} for ${module}/${documentId}`);
                return null;
            }

            // 4. Compute next level
            const nextLevel = getNextRevisionLevel(currentRevisionLevel);

            // 5. Notify parent to update the doc's revision level
            onRevisionCreated?.(nextLevel);

            // 6. Notify downstream docs via cross-doc checks
            const now = new Date().toISOString();
            const targets = linkedDocuments ?? [];
            const downstreamModules = getDownstreamTargets(module);

            for (const target of targets) {
                if (downstreamModules.includes(target.module)) {
                    await upsertCrossDocCheck(
                        module,
                        documentId,
                        target.module,
                        target.docId,
                        nextLevel,
                        now,
                    );
                }
            }

            // 7. Refresh revisions list
            const updated = await listRevisions(module, documentId);
            setRevisions(updated);

            // 7c. Server backup (fire-and-forget, never blocks revision)
            // This is the ONLY moment we write to the server — formal milestone.
            // Normal saves only backup locally (30-sec debounce).
            createServerBackup()
                .then(path => {
                    if (path) {
                        logger.info('useRevisionControl', 'Server backup on revision ✓');
                    }
                })
                .catch(() => { /* silencioso — la revisión ya se guardó */ });

            // 8. Close modal
            setShowRevisionPrompt(false);

            logger.info('useRevisionControl', `Revision ${currentRevisionLevel} created, advancing to ${nextLevel}`);

            // 9. Return new level
            return nextLevel;
        } catch (err) {
            logger.error('useRevisionControl', 'Error creating revision', {}, err instanceof Error ? err : undefined);
            return null;
        } finally {
            savingRevisionRef.current = false;
            setIsLoading(false);
        }
    }, [documentId, currentData, currentRevisionLevel, module, onRevisionCreated, linkedDocuments, revisions]);

    const loadSnapshotFn = useCallback(async (level: string): Promise<unknown> => {
        if (!documentId) return null;

        try {
            const raw = await loadRevisionSnapshot(module, documentId, level);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (err) {
            logger.error('useRevisionControl', `Failed to load snapshot for ${level}`, {}, err instanceof Error ? err : undefined);
            return null;
        }
    }, [module, documentId]);

    return {
        handleNewRevision,
        revisions,
        loadSnapshot: loadSnapshotFn,
        isLoading,
        showRevisionPrompt,
        setShowRevisionPrompt,
        showRevisionHistory,
        setShowRevisionHistory,
        confirmRevision,
    };
}
