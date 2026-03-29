/**
 * Cross-User Document Lock Hook
 *
 * Manages document-level edit locks across different users.
 * When another user is editing the same document, shows a warning
 * banner (non-blocking — both users can still edit).
 *
 * Uses a TTL-based lease pattern with heartbeat refresh (30s).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '../utils/logger';

const HEARTBEAT_MS = 30_000; // 30 seconds
const RECHECK_MS = 60_000;   // Re-check for other editors every 60s

type LockableDocType = 'amfe' | 'cp' | 'pfd' | 'ho';

export interface UseDocumentLockResult {
    /** Email of another user editing this document, or null if no conflict */
    otherEditor: string | null;
}

/**
 * Hook to manage cross-user document locks.
 *
 * @param documentId - The document identifier (null = no document open)
 * @param documentType - The document type ('amfe' | 'cp' | 'pfd' | 'ho')
 * @returns otherEditor - email of conflicting user, or null
 */
export function useDocumentLock(
    documentId: string | null,
    documentType: LockableDocType,
): UseDocumentLockResult {
    const [otherEditor, setOtherEditor] = useState<string | null>(null);
    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const recheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const cleanup = useCallback(() => {
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
        }
        if (recheckRef.current) {
            clearInterval(recheckRef.current);
            recheckRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!documentId) {
            setOtherEditor(null);
            return;
        }

        let cancelled = false;

        const run = async () => {
            try {
                const repo = await import('../utils/repositories/documentLockRepository');

                // Acquire lock and check for conflicts
                const conflict = await repo.acquireDocumentLock(documentId, documentType);
                if (!cancelled) setOtherEditor(conflict);

                // Clean expired locks occasionally
                await repo.cleanExpiredLocks();

                if (cancelled) return;

                // Start heartbeat to keep our lock alive
                heartbeatRef.current = setInterval(() => {
                    repo.refreshDocumentLock(documentId, documentType).catch(() => {});
                }, HEARTBEAT_MS);

                // Periodically re-check if another user started editing
                recheckRef.current = setInterval(() => {
                    if (cancelled) return;
                    repo.checkDocumentLock(documentId, documentType)
                        .then(newConflict => { if (!cancelled) setOtherEditor(newConflict); })
                        .catch(() => {});
                }, RECHECK_MS);
            } catch (err) {
                logger.warn('useDocumentLock', 'Failed to initialize lock', { error: String(err) });
            }
        };

        run();

        return () => {
            cancelled = true;
            cleanup();
            // Release lock on unmount (fire-and-forget)
            import('../utils/repositories/documentLockRepository')
                .then(repo => repo.releaseDocumentLock(documentId, documentType))
                .catch(() => {});
        };
    }, [documentId, documentType, cleanup]);

    return { otherEditor };
}
