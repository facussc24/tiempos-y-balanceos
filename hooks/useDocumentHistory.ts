/**
 * Generic Document Undo/Redo History Hook
 *
 * Maintains a circular buffer of document snapshots of type T.
 * Observes changes to currentData and records snapshots after a debounce window.
 *
 * Extracted from useAmfeHistory / useCpHistory to eliminate code duplication.
 * All modules (AMFE, CP, HO) share this single implementation.
 *
 * Uses structuredClone() for 2-4x faster deep cloning than JSON round-trip.
 */

import { useRef, useCallback, useState, useEffect } from 'react';

const DEFAULT_MAX_HISTORY = 50;
const DEFAULT_DEBOUNCE_MS = 600;

export interface DocumentHistoryControls<T> {
    undo: () => T | null;
    redo: () => T | null;
    canUndo: boolean;
    canRedo: boolean;
    /** Number of states available to undo */
    undoCount: number;
    /** Number of states available to redo */
    redoCount: number;
    /** Call when loading a project or importing — resets history completely */
    resetHistory: (doc: T) => void;
    /**
     * Immediately commit any pending debounced snapshot.
     * Call before batch operations (e.g. AI copilot Apply) so the pre-batch
     * state is captured as a separate undo step.
     */
    flushPending: () => void;
}

export interface DocumentHistoryOptions {
    maxHistory?: number;
    debounceMs?: number;
}

/**
 * Track undo/redo history for a document of type T.
 *
 * @param currentData - The live document state
 * @param options - Optional maxHistory and debounceMs overrides
 * @returns Controls for undo/redo, reset, and flush
 *
 * Usage:
 *   const state = useMyModule();
 *   const history = useDocumentHistory(state.data);
 *   // On undo: const prev = history.undo(); if (prev) state.loadData(prev);
 */
export function useDocumentHistory<T>(
    currentData: T,
    options?: DocumentHistoryOptions,
): DocumentHistoryControls<T> {
    const maxHistory = options?.maxHistory ?? DEFAULT_MAX_HISTORY;
    const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;

    // History stack: past states (not including current)
    const pastRef = useRef<T[]>([]);
    // Future stack for redo
    const futureRef = useRef<T[]>([]);

    // Track the "last committed" state to detect real changes
    const lastCommittedRef = useRef<T>(currentData);
    // Debounce timer
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Flag to skip recording when we ourselves triggered a loadData (undo/redo)
    const skipNextRef = useRef(false);
    // Snapshot captured at debounce start (the state BEFORE the rapid edits began)
    const pendingSnapshotRef = useRef<T | null>(null);

    // Force re-render when canUndo/canRedo change
    const [, forceUpdate] = useState(0);
    const triggerUpdate = useCallback(() => forceUpdate(n => n + 1), []);

    // Observe changes to currentData
    useEffect(() => {
        // If this change was triggered by undo/redo, skip recording
        if (skipNextRef.current) {
            skipNextRef.current = false;
            lastCommittedRef.current = currentData;
            return;
        }

        // Check if data actually changed (reference equality)
        if (currentData === lastCommittedRef.current) return;

        // Capture the snapshot to push (the state BEFORE this change)
        // On first change in a burst, save the "before" state
        if (!pendingSnapshotRef.current) {
            pendingSnapshotRef.current = structuredClone(lastCommittedRef.current);
        }

        // Clear previous debounce
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Update last committed to track the latest
        lastCommittedRef.current = currentData;

        // Schedule commit after debounce
        debounceTimerRef.current = setTimeout(() => {
            const snapshot = pendingSnapshotRef.current;
            if (snapshot) {
                pastRef.current = [...pastRef.current, snapshot].slice(-maxHistory);
                // Any new edit clears redo stack
                futureRef.current = [];
                pendingSnapshotRef.current = null;
                triggerUpdate();
            }
        }, debounceMs);
    }, [currentData, triggerUpdate, maxHistory, debounceMs]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    const flushPending = useCallback(() => {
        if (pendingSnapshotRef.current) {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            pastRef.current = [...pastRef.current, pendingSnapshotRef.current].slice(-maxHistory);
            futureRef.current = [];
            pendingSnapshotRef.current = null;
            triggerUpdate();
        }
    }, [maxHistory, triggerUpdate]);

    const undo = useCallback((): T | null => {
        // Flush any pending debounced change first
        if (pendingSnapshotRef.current) {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            pastRef.current = [...pastRef.current, pendingSnapshotRef.current].slice(-maxHistory);
            pendingSnapshotRef.current = null;
        }

        if (pastRef.current.length === 0) return null;

        const previous = pastRef.current[pastRef.current.length - 1];
        pastRef.current = pastRef.current.slice(0, -1);

        // Push current state to future for redo
        futureRef.current = [...futureRef.current, structuredClone(lastCommittedRef.current)];

        // Mark that the next data change should be skipped (it's our undo)
        skipNextRef.current = true;
        // Clone so caller mutations don't corrupt internal lastCommitted tracking
        lastCommittedRef.current = structuredClone(previous);

        triggerUpdate();
        return previous;
    }, [triggerUpdate, maxHistory]);

    const redo = useCallback((): T | null => {
        if (futureRef.current.length === 0) return null;

        const next = futureRef.current[futureRef.current.length - 1];
        futureRef.current = futureRef.current.slice(0, -1);

        // Push current state to past
        pastRef.current = [...pastRef.current, structuredClone(lastCommittedRef.current)].slice(-maxHistory);

        // Mark skip
        skipNextRef.current = true;
        // Clone so caller mutations don't corrupt internal lastCommitted tracking
        lastCommittedRef.current = structuredClone(next);

        triggerUpdate();
        return next;
    }, [triggerUpdate, maxHistory]);

    const resetHistory = useCallback((doc: T) => {
        pastRef.current = [];
        futureRef.current = [];
        pendingSnapshotRef.current = null;
        lastCommittedRef.current = doc;
        skipNextRef.current = true;
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        triggerUpdate();
    }, [triggerUpdate]);

    return {
        undo,
        redo,
        canUndo: pastRef.current.length > 0 || pendingSnapshotRef.current !== null,
        canRedo: futureRef.current.length > 0,
        undoCount: pastRef.current.length + (pendingSnapshotRef.current ? 1 : 0),
        redoCount: futureRef.current.length,
        resetHistory,
        flushPending,
    };
}
