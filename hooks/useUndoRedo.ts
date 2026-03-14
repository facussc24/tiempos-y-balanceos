/**
 * useUndoRedo Hook
 * 
 * Provides undo/redo functionality for project state management.
 * Maintains a history stack of previous states with configurable limit.
 * 
 * @module useUndoRedo
 * @version 2.0.0 - Added Context Awareness
 */

import { useState, useCallback, useRef } from 'react';
import { ProjectData } from '../types';

export interface UndoContext {
    tab?: string;
    description?: string;
}

interface HistoryItem<T> {
    data: T;
    context?: UndoContext;
    timestamp: number;
}

interface UndoRedoState<T> {
    /** Stack of past states (for undo) */
    past: HistoryItem<T>[];
    /** Current state */
    present: HistoryItem<T>;
    /** Stack of future states (for redo) */
    future: HistoryItem<T>[];
}

interface UndoResult<T> {
    state: T | null;
    context?: UndoContext;
}

interface UndoRedoResult<T> {
    /** Whether undo is available */
    canUndo: boolean;
    /** Whether redo is available */
    canRedo: boolean;
    /** Number of undo steps available */
    undoCount: number;
    /** Number of redo steps available */
    redoCount: number;
    /** Perform undo operation */
    undo: () => UndoResult<T>;
    /** Perform redo operation */
    redo: () => UndoResult<T>;
    /** Push a new state to history */
    pushState: (newState: T, context?: UndoContext) => void;
    /** Reset history (e.g., when loading new project) */
    resetHistory: (initialState: T) => void;
    /** Get description of last change (if available) */
    lastChangeDescription: string | null;
}

// Fields to track for meaningful state changes
const TRACKED_FIELDS: (keyof ProjectData)[] = [
    'tasks',
    'assignments',
    'stationConfigs',
    'sectors',
    'shifts',
    'meta',
    'vsmExternalNodes',
    'vsmInfoFlows',
    'plantConfig'
];

/**
 * Create a lightweight snapshot of the relevant project data
 */
function createSnapshot(data: ProjectData): Partial<ProjectData> {
    const snapshot = {} as Partial<ProjectData>;
    TRACKED_FIELDS.forEach(field => {
        if (data[field] !== undefined) {
            // Deep clone the tracked fields
            (snapshot as Record<string, unknown>)[field] = JSON.parse(JSON.stringify(data[field]));
        }
    });
    return snapshot;
}

/**
 * Check if two states are meaningfully different
 */
function hasChanged(prev: Partial<ProjectData>, next: Partial<ProjectData>): boolean {
    return JSON.stringify(prev) !== JSON.stringify(next);
}

/**
 * Hook for managing undo/redo state
 * 
 * @param initialState - Initial project data
 * @param maxHistory - Maximum number of states to keep in history (default: 50)
 */
export function useUndoRedo(
    initialState: ProjectData,
    maxHistory: number = 50
): UndoRedoResult<Partial<ProjectData>> {
    const [state, setState] = useState<UndoRedoState<Partial<ProjectData>>>({
        past: [],
        present: {
            data: createSnapshot(initialState),
            timestamp: Date.now()
        },
        future: []
    });

    const lastChangeRef = useRef<string | null>(null);

    const canUndo = state.past.length > 0;
    const canRedo = state.future.length > 0;

    const undo = useCallback((): UndoResult<Partial<ProjectData>> => {
        if (state.past.length === 0) return { state: null };

        const previousWrapper = state.past[state.past.length - 1];
        const newPast = state.past.slice(0, -1);

        setState({
            past: newPast,
            present: previousWrapper,
            future: [state.present, ...state.future]
        });

        lastChangeRef.current = 'Deshacer';

        // Return previous state AND the context associated with the *restored* state (or the undone action)
        // Ideally we want the context of where the "undone" change happened to navigate there.
        // The change that is being undone is represented by the transition from 'previousWrapper' to 'state.present'.
        // So the context we care about (where the change happened) is stored in 'state.present.context'.
        // FIX: Deep-clone before returning to prevent shared references from corrupting history
        // if downstream code mutates nested objects on the returned state
        return {
            state: JSON.parse(JSON.stringify(previousWrapper.data)),
            context: state.present.context
        };
    }, [state]);

    const redo = useCallback((): UndoResult<Partial<ProjectData>> => {
        if (state.future.length === 0) return { state: null };

        const nextWrapper = state.future[0];
        const newFuture = state.future.slice(1);

        setState({
            past: [...state.past, state.present],
            present: nextWrapper,
            future: newFuture
        });

        lastChangeRef.current = 'Rehacer';

        // FIX: Deep-clone before returning to prevent shared references from corrupting history
        return {
            state: JSON.parse(JSON.stringify(nextWrapper.data)),
            context: nextWrapper.context
        };
    }, [state]);

    const pushState = useCallback((newState: ProjectData, context?: UndoContext) => {
        const newSnapshot = createSnapshot(newState);

        setState(prev => {
            // Only push if state actually changed (compare against fresh prev, not stale closure)
            if (!hasChanged(prev.present.data, newSnapshot)) {
                return prev;
            }

            // Update the CURRENT state wrapper with the new data/context
            const inputWrapper: HistoryItem<Partial<ProjectData>> = {
                data: newSnapshot,
                context: context,
                timestamp: Date.now()
            };

            // FIX: Use slice instead of shift to avoid in-place mutation
            let newPast = [...prev.past, prev.present];
            // Limit history size
            if (newPast.length > maxHistory) {
                newPast = newPast.slice(newPast.length - maxHistory);
            }

            return {
                past: newPast,
                present: inputWrapper,
                future: [] // Clear redo stack on new action
            };
        });

        lastChangeRef.current = null;
    }, [maxHistory]);

    const resetHistory = useCallback((initialState: ProjectData) => {
        setState({
            past: [],
            present: {
                data: createSnapshot(initialState),
                timestamp: Date.now()
            },
            future: []
        });
        lastChangeRef.current = null;
    }, []);

    return {
        canUndo,
        canRedo,
        undoCount: state.past.length,
        redoCount: state.future.length,
        undo,
        redo,
        pushState,
        resetHistory,
        lastChangeDescription: lastChangeRef.current
    };
}

export default useUndoRedo;
