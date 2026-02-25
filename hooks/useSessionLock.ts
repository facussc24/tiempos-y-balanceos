// hooks/useSessionLock.ts
/**
 * Hook for managing session locks to prevent concurrent editing.
 * V4.1: Added heartbeat pattern and READ-ONLY mode degradation.
 * Extracted from App.tsx to reduce component complexity.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { ProjectData } from '../types';
import {
    initSessionLock,
    acquireLock as acquireSessionLock,
    releaseLock,
    forceLock as forceSessionLock,
    onLockEvent,
    refreshLock as refreshSessionLock
} from '../utils/sessionLock';
import { logger } from '../utils/logger';

// V4.1: Heartbeat interval for lock refresh (30 seconds)
const HEARTBEAT_INTERVAL_MS = 30000;

interface LockConflict {
    projectId: string | number;
    lockedBy?: string; // V4.1: Name of user who has the lock
}

interface UseSessionLockResult {
    lockConflict: LockConflict | null;
    handleForceLock: () => void;
    handleCancelLock: () => void;
    tryAcquireLock: (loadedData: ProjectData) => boolean;
    // V4.1: READ-ONLY mode support
    isReadOnly: boolean;
    lockOwner: string | null;
}

export function useSessionLock(
    projectId: number | undefined,
    onLockAcquired: (data: ProjectData) => void
): UseSessionLockResult {
    const [lockConflict, setLockConflict] = useState<LockConflict | null>(null);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [lockOwner, setLockOwner] = useState<string | null>(null);
    const pendingLoadRef = useRef<ProjectData | null>(null);
    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Initialize session lock and listen for events
    // H-04 Fix: Clean up previous heartbeat FIRST when projectId changes
    useEffect(() => {
        // H-04 Fix: Clear any existing heartbeat before starting new one
        // This prevents interval leaks when switching projects
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
        }

        initSessionLock();

        const unsubscribe = onLockEvent((event) => {
            if (event.type === 'LOCK_FORCED' && projectId && String(event.projectId) === String(projectId)) {
                // V4.1: Degrade to READ-ONLY mode when lock is taken
                setIsReadOnly(true);
                setLockOwner(event.lockedBy || 'otro usuario');
            }
        });

        return () => {
            unsubscribe();
            // Clear heartbeat on unmount
            if (heartbeatRef.current) {
                clearInterval(heartbeatRef.current);
                heartbeatRef.current = null;
            }
            if (projectId) {
                releaseLock(projectId);
            }
        };
    }, [projectId]);

    // V4.1: Start heartbeat to refresh lock periodically
    const startHeartbeat = useCallback((id: string | number) => {
        // Clear any existing heartbeat
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
        }

        // Start new heartbeat
        heartbeatRef.current = setInterval(() => {
            try {
                refreshSessionLock(id);
                logger.debug('SessionLock', 'Heartbeat: lock refreshed', { lockId: id });
            } catch (e) {
                logger.warn('SessionLock', 'Heartbeat failed', { error: e instanceof Error ? e.message : String(e) });
            }
        }, HEARTBEAT_INTERVAL_MS);
    }, []);

    // Try to acquire a lock when loading a project
    const tryAcquireLock = useCallback((loadedData: ProjectData): boolean => {
        const id = loadedData.id || loadedData.meta.name;
        const lockResult = acquireSessionLock(id);

        if (!lockResult.success && lockResult.conflictInfo) {
            setLockConflict({
                projectId: id,
                lockedBy: lockResult.conflictInfo.lockedBy
            });
            // V4.1: Set READ-ONLY mode and continue loading (Soft Fail)
            setIsReadOnly(true);
            setLockOwner(lockResult.conflictInfo.lockedBy || 'otro usuario');
            // Store data temporarily for force-load scenario
            pendingLoadRef.current = loadedData;
            return false;
        }

        // V4.1: Lock acquired successfully - start heartbeat
        setIsReadOnly(false);
        setLockOwner(null);
        startHeartbeat(id);
        return true;
    }, [startHeartbeat]);

    // Force acquire the lock, overriding other sessions
    const handleForceLock = useCallback(() => {
        if (!lockConflict) return;

        forceSessionLock(lockConflict.projectId);
        const pendingData = pendingLoadRef.current;

        // V4.1: Exit READ-ONLY mode and start heartbeat
        setIsReadOnly(false);
        setLockOwner(null);
        startHeartbeat(lockConflict.projectId);

        if (pendingData) {
            // Apply v2.0 migration for activeModels
            if (!pendingData.meta.activeModels || pendingData.meta.activeModels.length === 0) {
                pendingData.meta.activeModels = [
                    { id: 'default', name: 'Modelo Estándar', percentage: 1.0, color: '#3b82f6' }
                ];
            }
            onLockAcquired(pendingData);

            pendingLoadRef.current = null;
        }
        setLockConflict(null);
    }, [lockConflict, onLockAcquired, startHeartbeat]);

    // Cancel the lock acquisition attempt
    const handleCancelLock = useCallback(() => {
        setLockConflict(null);
        // V4.1: Stay in READ-ONLY mode if cancelled
        pendingLoadRef.current = null;
    }, []);

    return {
        lockConflict,
        handleForceLock,
        handleCancelLock,
        tryAcquireLock,
        // V4.1: READ-ONLY mode exports
        isReadOnly,
        lockOwner
    };
}
