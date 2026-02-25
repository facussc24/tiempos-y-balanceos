/**
 * AMFE Undo/Redo History Hook
 *
 * Maintains a circular buffer of AmfeDocument snapshots.
 * Non-intrusively wraps useAmfe — observes amfe.data changes
 * and calls amfe.loadData to restore previous states.
 *
 * Debounces rapid changes (typing) to avoid filling the buffer
 * with intermediate states.
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { AmfeDocument } from './amfeTypes';

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 600;

export interface AmfeHistoryControls {
    undo: () => AmfeDocument | null;
    redo: () => AmfeDocument | null;
    canUndo: boolean;
    canRedo: boolean;
    /** Call when loading a project or importing — resets history completely */
    resetHistory: (doc: AmfeDocument) => void;
}

/**
 * Track undo/redo history for an AmfeDocument.
 *
 * @param currentData - The live AmfeDocument from useAmfe
 * @returns Controls for undo/redo + reset
 *
 * Usage in AmfeApp:
 *   const amfe = useAmfe();
 *   const history = useAmfeHistory(amfe.data);
 *   // On undo: const prev = history.undo(); if (prev) amfe.loadData(prev);
 */
export function useAmfeHistory(currentData: AmfeDocument): AmfeHistoryControls {
    // History stack: past states (not including current)
    const pastRef = useRef<AmfeDocument[]>([]);
    // Future stack for redo
    const futureRef = useRef<AmfeDocument[]>([]);

    // We need a ref to track the "last committed" state to detect real changes
    const lastCommittedRef = useRef<AmfeDocument>(currentData);
    // Debounce timer
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Flag to skip recording when we ourselves triggered a loadData (undo/redo)
    const skipNextRef = useRef(false);
    // Snapshot captured at debounce start (the state BEFORE the rapid edits began)
    const pendingSnapshotRef = useRef<AmfeDocument | null>(null);

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

        // Check if data actually changed (reference equality is fine since useAmfe creates new objects)
        if (currentData === lastCommittedRef.current) return;

        // Capture the snapshot to push (the state BEFORE this change)
        // On first change in a burst, save the "before" state
        if (!pendingSnapshotRef.current) {
            pendingSnapshotRef.current = lastCommittedRef.current;
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
                // Push to past
                pastRef.current = [...pastRef.current, snapshot].slice(-MAX_HISTORY);
                // Any new edit clears redo stack
                futureRef.current = [];
                pendingSnapshotRef.current = null;
                triggerUpdate();
            }
        }, DEBOUNCE_MS);
    }, [currentData, triggerUpdate]);

    // Flush pending snapshot on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    const undo = useCallback((): AmfeDocument | null => {
        // Flush any pending debounced change first
        if (pendingSnapshotRef.current) {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            pastRef.current = [...pastRef.current, pendingSnapshotRef.current].slice(-MAX_HISTORY);
            pendingSnapshotRef.current = null;
        }

        if (pastRef.current.length === 0) return null;

        const previous = pastRef.current[pastRef.current.length - 1];
        pastRef.current = pastRef.current.slice(0, -1);

        // Push current state to future for redo
        futureRef.current = [...futureRef.current, lastCommittedRef.current];

        // Mark that the next data change should be skipped (it's our undo)
        skipNextRef.current = true;
        lastCommittedRef.current = previous;

        triggerUpdate();
        return previous;
    }, [triggerUpdate]);

    const redo = useCallback((): AmfeDocument | null => {
        if (futureRef.current.length === 0) return null;

        const next = futureRef.current[futureRef.current.length - 1];
        futureRef.current = futureRef.current.slice(0, -1);

        // Push current state to past
        pastRef.current = [...pastRef.current, lastCommittedRef.current].slice(-MAX_HISTORY);

        // Mark skip
        skipNextRef.current = true;
        lastCommittedRef.current = next;

        triggerUpdate();
        return next;
    }, [triggerUpdate]);

    const resetHistory = useCallback((doc: AmfeDocument) => {
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
        resetHistory,
    };
}
