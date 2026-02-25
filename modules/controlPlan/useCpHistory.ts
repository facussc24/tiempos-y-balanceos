/**
 * Control Plan Undo/Redo History Hook
 *
 * Maintains a circular buffer of ControlPlanDocument snapshots.
 * Non-intrusively wraps useControlPlan — observes cp.data changes
 * and calls cp.loadData to restore previous states.
 *
 * Debounces rapid changes (typing) to avoid filling the buffer
 * with intermediate states.
 *
 * Port of useAmfeHistory.ts with ControlPlanDocument types.
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { ControlPlanDocument } from './controlPlanTypes';

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 600;

export interface CpHistoryControls {
    undo: () => ControlPlanDocument | null;
    redo: () => ControlPlanDocument | null;
    canUndo: boolean;
    canRedo: boolean;
    /** Call when loading a project or importing — resets history completely */
    resetHistory: (doc: ControlPlanDocument) => void;
}

/**
 * Track undo/redo history for a ControlPlanDocument.
 *
 * @param currentData - The live ControlPlanDocument from useControlPlan
 * @returns Controls for undo/redo + reset
 *
 * Usage in ControlPlanApp:
 *   const cp = useControlPlan();
 *   const history = useCpHistory(cp.data);
 *   // On undo: const prev = history.undo(); if (prev) cp.loadData(prev);
 */
export function useCpHistory(currentData: ControlPlanDocument): CpHistoryControls {
    // History stack: past states (not including current)
    const pastRef = useRef<ControlPlanDocument[]>([]);
    // Future stack for redo
    const futureRef = useRef<ControlPlanDocument[]>([]);

    // We need a ref to track the "last committed" state to detect real changes
    const lastCommittedRef = useRef<ControlPlanDocument>(currentData);
    // Debounce timer
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Flag to skip recording when we ourselves triggered a loadData (undo/redo)
    const skipNextRef = useRef(false);
    // Snapshot captured at debounce start (the state BEFORE the rapid edits began)
    const pendingSnapshotRef = useRef<ControlPlanDocument | null>(null);

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

        // Check if data actually changed (reference equality is fine since useControlPlan creates new objects)
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

    const undo = useCallback((): ControlPlanDocument | null => {
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

    const redo = useCallback((): ControlPlanDocument | null => {
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

    const resetHistory = useCallback((doc: ControlPlanDocument) => {
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
