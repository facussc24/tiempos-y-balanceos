/**
 * useNetworkHealth
 *
 * Historically polled the Y: drive every 30s to flag offline periods and
 * trigger backup+flush on reconnection (Tauri desktop build). The web build
 * reports always-online because Supabase handles its own connection status.
 *
 * @module useNetworkHealth
 */

import { useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface NetworkHealth {
    isOnline: boolean;
    isChecking: boolean;
    lastOnlineAt: number | null;
    consecutiveFailures: number;
    checkNow: () => Promise<void>;
}

// ============================================================================
// Hook — Web-mode stub
// ============================================================================

export function useNetworkHealth(): NetworkHealth {
    const checkNow = useCallback(async () => { /* no-op in web */ }, []);
    return {
        isOnline: true,
        isChecking: false,
        lastOnlineAt: null,
        consecutiveFailures: 0,
        checkNow,
    };
}
