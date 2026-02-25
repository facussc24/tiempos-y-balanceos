/**
 * PFD Document State Management Hook
 *
 * Manages the in-memory state of a PFD document.
 * CRUD operations for steps and header updates.
 * Includes undo/redo history (max 20 entries).
 */

import { useState, useCallback, useRef } from 'react';
import {
    PfdDocument,
    PfdStep,
    PfdHeader,
    PfdStepType,
    SpecialCharClass,
    createEmptyStep,
    createEmptyPfdDocument,
    getNextStepNumber,
    normalizePfdStep,
} from './pfdTypes';

const MAX_HISTORY = 20;

export interface UsePfdDocumentResult {
    data: PfdDocument;
    loadData: (doc: PfdDocument) => void;
    resetData: () => void;
    updateHeader: (field: keyof PfdHeader, value: string) => void;
    addStep: () => void;
    insertStepAfter: (stepId: string) => void;
    duplicateStep: (stepId: string) => void;
    removeStep: (stepId: string) => void;
    updateStep: (stepId: string, field: keyof PfdStep, value: string | boolean) => void;
    /** C5-B1: Batch update multiple fields atomically (single undo entry) */
    updateStepFields: (stepId: string, updates: Partial<PfdStep>) => void;
    moveStep: (stepId: string, direction: 'up' | 'down') => void;
    setSteps: (steps: PfdStep[]) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

export function usePfdDocument(): UsePfdDocumentResult {
    const [data, setData] = useState<PfdDocument>(createEmptyPfdDocument());
    const undoStackRef = useRef<PfdDocument[]>([]);
    const redoStackRef = useRef<PfdDocument[]>([]);
    // Force re-render when undo/redo stacks change
    const [, setHistoryVersion] = useState(0);

    /** Set data with history tracking (pushes current state to undo stack) */
    const setDataWithHistory = useCallback((updater: (prev: PfdDocument) => PfdDocument) => {
        setData(prev => {
            const next = updater(prev);
            if (next === prev) return prev; // no-op
            undoStackRef.current.push(prev);
            if (undoStackRef.current.length > MAX_HISTORY) {
                undoStackRef.current.shift();
            }
            redoStackRef.current = [];
            setHistoryVersion(v => v + 1);
            return next;
        });
    }, []);

    const loadData = useCallback((doc: PfdDocument) => {
        undoStackRef.current = [];
        redoStackRef.current = [];
        setHistoryVersion(v => v + 1);
        // C3-N1: Normalize steps for backward compat (old docs without rejectDisposition)
        const normalizedSteps = doc.steps.map(s => normalizePfdStep(s as unknown as Record<string, unknown> & { id: string }));
        setData({ ...doc, steps: normalizedSteps });
    }, []);

    const resetData = useCallback(() => {
        undoStackRef.current = [];
        redoStackRef.current = [];
        setHistoryVersion(v => v + 1);
        setData(createEmptyPfdDocument());
    }, []);

    const updateHeader = useCallback((field: keyof PfdHeader, value: string) => {
        setDataWithHistory(prev => ({
            ...prev,
            header: { ...prev.header, [field]: value },
            updatedAt: new Date().toISOString(),
        }));
    }, [setDataWithHistory]);

    const addStep = useCallback(() => {
        setDataWithHistory(prev => {
            const nextNumber = getNextStepNumber(prev.steps);
            return {
                ...prev,
                steps: [...prev.steps, createEmptyStep(nextNumber)],
                updatedAt: new Date().toISOString(),
            };
        });
    }, [setDataWithHistory]);

    const insertStepAfter = useCallback((stepId: string) => {
        setDataWithHistory(prev => {
            const index = prev.steps.findIndex(s => s.id === stepId);
            if (index === -1) return prev;
            const nextNumber = getNextStepNumber(prev.steps);
            const newStep = createEmptyStep(nextNumber);
            const steps = [...prev.steps];
            steps.splice(index + 1, 0, newStep);
            return { ...prev, steps, updatedAt: new Date().toISOString() };
        });
    }, [setDataWithHistory]);

    const duplicateStep = useCallback((stepId: string) => {
        setDataWithHistory(prev => {
            const index = prev.steps.findIndex(s => s.id === stepId);
            if (index === -1) return prev;
            const source = prev.steps[index];
            const nextNumber = getNextStepNumber(prev.steps);
            const clone: PfdStep = {
                ...source,
                id: crypto.randomUUID(),
                stepNumber: nextNumber,
            };
            const steps = [...prev.steps];
            steps.splice(index + 1, 0, clone);
            return { ...prev, steps, updatedAt: new Date().toISOString() };
        });
    }, [setDataWithHistory]);

    const removeStep = useCallback((stepId: string) => {
        setDataWithHistory(prev => ({
            ...prev,
            steps: prev.steps.filter(s => s.id !== stepId),
            updatedAt: new Date().toISOString(),
        }));
    }, [setDataWithHistory]);

    const updateStep = useCallback((stepId: string, field: keyof PfdStep, value: string | boolean) => {
        setDataWithHistory(prev => ({
            ...prev,
            steps: prev.steps.map(s => {
                if (s.id !== stepId) return s;
                return { ...s, [field]: value };
            }),
            updatedAt: new Date().toISOString(),
        }));
    }, [setDataWithHistory]);

    /** C5-B1: Batch update multiple fields in one undo entry */
    const updateStepFields = useCallback((stepId: string, updates: Partial<PfdStep>) => {
        setDataWithHistory(prev => ({
            ...prev,
            steps: prev.steps.map(s => s.id !== stepId ? s : { ...s, ...updates }),
            updatedAt: new Date().toISOString(),
        }));
    }, [setDataWithHistory]);

    const moveStep = useCallback((stepId: string, direction: 'up' | 'down') => {
        setDataWithHistory(prev => {
            const steps = [...prev.steps];
            const index = steps.findIndex(s => s.id === stepId);
            if (index === -1) return prev;
            const newIndex = direction === 'up' ? index - 1 : index + 1;
            if (newIndex < 0 || newIndex >= steps.length) return prev;
            [steps[index], steps[newIndex]] = [steps[newIndex], steps[index]];
            return { ...prev, steps, updatedAt: new Date().toISOString() };
        });
    }, [setDataWithHistory]);

    const setSteps = useCallback((steps: PfdStep[]) => {
        setDataWithHistory(prev => ({ ...prev, steps, updatedAt: new Date().toISOString() }));
    }, [setDataWithHistory]);

    const undo = useCallback(() => {
        const stack = undoStackRef.current;
        if (stack.length === 0) return;
        setData(prev => {
            const previous = stack.pop()!;
            redoStackRef.current.push(prev);
            setHistoryVersion(v => v + 1);
            return previous;
        });
    }, []);

    const redo = useCallback(() => {
        const stack = redoStackRef.current;
        if (stack.length === 0) return;
        setData(prev => {
            const next = stack.pop()!;
            undoStackRef.current.push(prev);
            setHistoryVersion(v => v + 1);
            return next;
        });
    }, []);

    return {
        data,
        loadData,
        resetData,
        updateHeader,
        addStep,
        insertStepAfter,
        duplicateStep,
        removeStep,
        updateStep,
        updateStepFields,
        moveStep,
        setSteps,
        undo,
        redo,
        canUndo: undoStackRef.current.length > 0,
        canRedo: redoStackRef.current.length > 0,
    };
}
