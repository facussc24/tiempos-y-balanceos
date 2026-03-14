/**
 * useNetworkHealth - Real-time network connectivity monitor
 *
 * Periodically pings the shared storage path (Y: drive) to detect
 * connectivity changes. Provides global online/offline status for
 * the UI to display clear indicators.
 *
 * Features:
 * - Polls every 30 seconds (configurable)
 * - Requires 2 consecutive failures before marking offline (avoids flicker)
 * - Auto-triggers backup + export flush on reconnection
 * - Exposes simple boolean state for UI consumption
 *
 * @module useNetworkHealth
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { isPathAccessible, loadStorageSettings } from '../utils/storageManager';
import { getPathConfig } from '../utils/pathManager';
import { isTauri } from '../utils/unified_fs';
import { scheduleBackup } from '../utils/backupService';
import { flushPendingExports } from '../utils/exportSyncWorker';
import { logger } from '../utils/logger';
import { toast } from '../components/ui/Toast';

// ============================================================================
// Types
// ============================================================================

export interface NetworkHealth {
    /** Whether the shared storage (Y: drive) is currently reachable */
    isOnline: boolean;
    /** Whether a connectivity check is currently in progress */
    isChecking: boolean;
    /** Timestamp of the last successful check (null if never checked) */
    lastOnlineAt: number | null;
    /** How many consecutive failures have occurred */
    consecutiveFailures: number;
    /** Manually trigger a connectivity check */
    checkNow: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL_MS = 30_000; // 30 seconds
const CHECK_TIMEOUT_MS = 2_000;  // 2 second timeout per check
const FAILURES_BEFORE_OFFLINE = 2; // Need 2 consecutive failures to mark offline

// ============================================================================
// Hook
// ============================================================================

export function useNetworkHealth(): NetworkHealth {
    const [isOnline, setIsOnline] = useState(true); // Optimistic default
    const [isChecking, setIsChecking] = useState(false);
    const [lastOnlineAt, setLastOnlineAt] = useState<number | null>(null);
    const [consecutiveFailures, setConsecutiveFailures] = useState(0);

    const wasOnlineRef = useRef(true);
    const failCountRef = useRef(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isMountedRef = useRef(true);

    const performCheck = useCallback(async () => {
        if (!isTauri()) return;
        if (!isMountedRef.current) return;

        setIsChecking(true);

        try {
            const settings = await loadStorageSettings();
            const sharedPath = settings.sharedStoragePath || getPathConfig().basePath;

            const accessible = await isPathAccessible(sharedPath, CHECK_TIMEOUT_MS);

            if (!isMountedRef.current) return;

            if (accessible) {
                // SUCCESS
                failCountRef.current = 0;
                setConsecutiveFailures(0);
                setLastOnlineAt(Date.now());

                if (!wasOnlineRef.current) {
                    // TRANSITION: offline -> online
                    wasOnlineRef.current = true;
                    setIsOnline(true);

                    logger.info('NetworkHealth', 'Connection restored');
                    toast.success(
                        'Conexion restaurada',
                        'Sincronizando cambios pendientes...'
                    );

                    // Auto-sync on reconnection (fire and forget)
                    scheduleBackup();
                    flushPendingExports().catch(() => {});
                } else {
                    setIsOnline(true);
                }
            } else {
                // FAILURE
                failCountRef.current += 1;
                setConsecutiveFailures(failCountRef.current);

                if (failCountRef.current >= FAILURES_BEFORE_OFFLINE && wasOnlineRef.current) {
                    // TRANSITION: online -> offline
                    wasOnlineRef.current = false;
                    setIsOnline(false);

                    logger.warn('NetworkHealth', 'Server connection lost', {
                        failures: failCountRef.current,
                        path: sharedPath,
                    });

                    toast.warning(
                        'Sin conexion al servidor',
                        'Tus cambios se guardan localmente. Se sincronizaran cuando vuelva la conexion.'
                    );
                }
            }
        } catch (err) {
            // Check itself threw (shouldn't happen, but be safe)
            failCountRef.current += 1;
            setConsecutiveFailures(failCountRef.current);

            if (failCountRef.current >= FAILURES_BEFORE_OFFLINE) {
                wasOnlineRef.current = false;
                setIsOnline(false);
            }
        } finally {
            if (isMountedRef.current) {
                setIsChecking(false);
            }
        }
    }, []);

    // Start polling on mount
    useEffect(() => {
        isMountedRef.current = true;

        if (!isTauri()) return;

        // Initial check after a short delay (let the app initialize first)
        const initialTimer = setTimeout(() => {
            performCheck();
        }, 3_000);

        // Regular polling
        intervalRef.current = setInterval(performCheck, POLL_INTERVAL_MS);

        return () => {
            isMountedRef.current = false;
            clearTimeout(initialTimer);
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [performCheck]);

    return {
        isOnline,
        isChecking,
        lastOnlineAt,
        consecutiveFailures,
        checkNow: performCheck,
    };
}
