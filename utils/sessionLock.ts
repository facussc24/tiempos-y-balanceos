/**
 * Session Lock Utility
 * 
 * Prevents concurrent editing of the same project across multiple browser tabs.
 * Uses localStorage for lease management and BroadcastChannel for coordination.
 * 
 * @module sessionLock
 */

import { logger } from './logger';

const LOCK_PREFIX = '_barack_lock_';
// V4.1: Updated to 90 seconds for robustness  
const LEASE_DURATION_MS = 90000; // 90 seconds lease
const HEARTBEAT_INTERVAL_MS = 30000; // V4.1: Refresh lease every 30 seconds
const CHANNEL_NAME = 'barack_mercosul_session';

interface LockInfo {
    tabId: string;
    timestamp: number;
    projectId: string | number;
    lockedBy?: string; // V4.1: Human-readable name for READ-ONLY banner
}

// Generate unique tab ID
const TAB_ID = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

let heartbeatInterval: number | null = null;
let currentLockedProject: string | number | null = null;
let channel: BroadcastChannel | null = null;

/**
 * Initialize the session lock system
 * Call once on app startup
 */
export function initSessionLock(): void {
    if (channel) return; // Already initialized

    channel = new BroadcastChannel(CHANNEL_NAME);

    channel.onmessage = (event) => {
        const { type, tabId, projectId } = event.data;

        if (type === 'LOCK_REQUEST' && projectId === currentLockedProject && tabId !== TAB_ID) {
            // Another tab is requesting our lock - respond with ownership claim
            channel?.postMessage({
                type: 'LOCK_CLAIMED',
                tabId: TAB_ID,
                projectId: currentLockedProject
            });
        }

        if (type === 'LOCK_RELEASED' && projectId === currentLockedProject) {
            // The lock holder released it
            logger.debug('SessionLock', 'Lock released by another tab');
        }
    };

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (currentLockedProject) {
            releaseLock(currentLockedProject);
        }
    });

    // Also handle visibility changes (tab hidden = potential stale lock)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && currentLockedProject) {
            // Reduce lease duration when tab is hidden
            refreshLease(currentLockedProject);
        }
    });
}

/**
 * Attempt to acquire a lock on a project
 * @returns Object with success status and optional conflict info
 */
export function acquireLock(projectId: string | number): {
    success: boolean;
    conflictInfo?: { tabId: string; age: number; lockedBy?: string }
} {
    const lockKey = `${LOCK_PREFIX}${projectId}`;
    const now = Date.now();

    // Check for existing lock
    const existingLock = localStorage.getItem(lockKey);

    if (existingLock) {
        try {
            const lockInfo: LockInfo = JSON.parse(existingLock);
            const lockAge = now - lockInfo.timestamp;

            // Check if lock is still valid (not expired)
            if (lockAge < LEASE_DURATION_MS && lockInfo.tabId !== TAB_ID) {
                // Lock is held by another tab and not expired
                return {
                    success: false,
                    conflictInfo: {
                        tabId: lockInfo.tabId,
                        age: lockAge,
                        lockedBy: lockInfo.lockedBy // V4.1: Include user name
                    }
                };
            }

            // Lock is expired or ours - we can take it
        } catch {
            // Invalid lock data - we can take it
        }
    }

    // Acquire the lock
    const newLock: LockInfo = {
        tabId: TAB_ID,
        timestamp: now,
        projectId: String(projectId)
    };

    localStorage.setItem(lockKey, JSON.stringify(newLock));
    currentLockedProject = projectId;

    // Start heartbeat to maintain lease
    startHeartbeat(projectId);

    // Notify other tabs
    channel?.postMessage({
        type: 'LOCK_ACQUIRED',
        tabId: TAB_ID,
        projectId
    });

    logger.debug('SessionLock', `Lock acquired for project: ${projectId}`);
    return { success: true };
}

/**
 * Force acquire a lock (take over from another tab)
 */
export function forceLock(projectId: string | number): void {
    const lockKey = `${LOCK_PREFIX}${projectId}`;

    // Notify current holder
    channel?.postMessage({
        type: 'LOCK_FORCED',
        tabId: TAB_ID,
        projectId
    });

    // Take the lock
    const newLock: LockInfo = {
        tabId: TAB_ID,
        timestamp: Date.now(),
        projectId: String(projectId)
    };

    localStorage.setItem(lockKey, JSON.stringify(newLock));
    currentLockedProject = projectId;
    startHeartbeat(projectId);

    logger.warn('SessionLock', `Lock forcefully acquired for project: ${projectId}`);
}

/**
 * Release the lock on a project
 */
export function releaseLock(projectId: string | number): void {
    const lockKey = `${LOCK_PREFIX}${projectId}`;

    // Only release if we own it
    const existingLock = localStorage.getItem(lockKey);
    if (existingLock) {
        try {
            const lockInfo: LockInfo = JSON.parse(existingLock);
            if (lockInfo.tabId === TAB_ID) {
                localStorage.removeItem(lockKey);

                channel?.postMessage({
                    type: 'LOCK_RELEASED',
                    tabId: TAB_ID,
                    projectId
                });

                logger.debug('SessionLock', `Lock released for project: ${projectId}`);
            }
        } catch {
            // Invalid lock data - remove it anyway
            localStorage.removeItem(lockKey);
        }
    }

    stopHeartbeat();
    currentLockedProject = null;
}

/**
 * Refresh the lease on current lock
 * V4.1: Exported as refreshLock for use by heartbeat hook
 */
export function refreshLock(projectId: string | number): void {
    const lockKey = `${LOCK_PREFIX}${projectId}`;

    const existingLock = localStorage.getItem(lockKey);
    if (existingLock) {
        try {
            const lockInfo: LockInfo = JSON.parse(existingLock);
            if (lockInfo.tabId === TAB_ID) {
                lockInfo.timestamp = Date.now();
                localStorage.setItem(lockKey, JSON.stringify(lockInfo));
            }
        } catch {
            // Invalid lock data
        }
    }
}

// Alias for internal use
const refreshLease = refreshLock;

/**
 * Start heartbeat to maintain lock lease
 */
function startHeartbeat(projectId: string | number): void {
    stopHeartbeat(); // Clear any existing heartbeat

    heartbeatInterval = window.setInterval(() => {
        refreshLease(projectId);
    }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Stop the heartbeat
 */
function stopHeartbeat(): void {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

/**
 * Check if we currently hold the lock for a project
 */
export function hasLock(projectId: string | number): boolean {
    const lockKey = `${LOCK_PREFIX}${projectId}`;
    const existingLock = localStorage.getItem(lockKey);

    if (!existingLock) return false;

    try {
        const lockInfo: LockInfo = JSON.parse(existingLock);
        return lockInfo.tabId === TAB_ID &&
            (Date.now() - lockInfo.timestamp) < LEASE_DURATION_MS;
    } catch {
        return false;
    }
}

/**
 * Get current tab ID (useful for debugging)
 */
export function getTabId(): string {
    return TAB_ID;
}

/**
 * Subscribe to lock events
 * V4.1: Added lockedBy for READ-ONLY banner
 */
export function onLockEvent(
    callback: (event: { type: string; projectId: string | number; lockedBy?: string }) => void
): () => void {
    if (!channel) {
        initSessionLock();
    }

    const handler = (event: MessageEvent) => {
        // FIX: Validate message and pass lockedBy for READ-ONLY banner
        const data = event.data;
        if (!data || typeof data !== 'object' || !data.type) return;
        callback({
            type: data.type,
            projectId: data.projectId,
            lockedBy: data.lockedBy
        });
    };

    channel?.addEventListener('message', handler);

    // Return unsubscribe function
    return () => {
        channel?.removeEventListener('message', handler);
    };
}
