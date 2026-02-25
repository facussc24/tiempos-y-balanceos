import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { ProjectData, INITIAL_PROJECT } from '../types';

function makeProject(overrides: Partial<ProjectData['meta']> = {}): ProjectData {
    return {
        ...JSON.parse(JSON.stringify(INITIAL_PROJECT)),
        meta: { ...JSON.parse(JSON.stringify(INITIAL_PROJECT.meta)), ...overrides },
    };
}

describe('useUndoRedo', () => {
    let baseProject: ProjectData;

    beforeEach(() => {
        baseProject = makeProject();
    });

    it('should initialize with no undo/redo available', () => {
        const { result } = renderHook(() => useUndoRedo(baseProject));

        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(false);
        expect(result.current.undoCount).toBe(0);
        expect(result.current.redoCount).toBe(0);
    });

    it('should allow undo after pushing a new state', () => {
        const { result } = renderHook(() => useUndoRedo(baseProject));

        const modified = makeProject({ name: 'Modified' });
        act(() => {
            result.current.pushState(modified);
        });

        expect(result.current.canUndo).toBe(true);
        expect(result.current.undoCount).toBe(1);
        expect(result.current.canRedo).toBe(false);
    });

    it('should restore previous state on undo', () => {
        const { result } = renderHook(() => useUndoRedo(baseProject));

        const modified = makeProject({ name: 'Modified' });
        act(() => {
            result.current.pushState(modified);
        });

        let undoResult: ReturnType<typeof result.current.undo>;
        act(() => {
            undoResult = result.current.undo();
        });

        expect(undoResult!.state).not.toBeNull();
        expect((undoResult!.state as any)?.meta?.name).toBe('Nuevo Proyecto');
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(true);
    });

    it('should restore undone state on redo', () => {
        const { result } = renderHook(() => useUndoRedo(baseProject));

        const modified = makeProject({ name: 'Modified' });
        act(() => {
            result.current.pushState(modified);
        });

        act(() => {
            result.current.undo();
        });

        let redoResult: ReturnType<typeof result.current.redo>;
        act(() => {
            redoResult = result.current.redo();
        });

        expect(redoResult!.state).not.toBeNull();
        expect((redoResult!.state as any)?.meta?.name).toBe('Modified');
        expect(result.current.canRedo).toBe(false);
        expect(result.current.canUndo).toBe(true);
    });

    it('should clear redo stack when pushing a new state after undo', () => {
        const { result } = renderHook(() => useUndoRedo(baseProject));

        act(() => {
            result.current.pushState(makeProject({ name: 'State A' }));
        });
        act(() => {
            result.current.pushState(makeProject({ name: 'State B' }));
        });

        // Undo to State A
        act(() => {
            result.current.undo();
        });
        expect(result.current.canRedo).toBe(true);

        // Push new state - should clear redo
        act(() => {
            result.current.pushState(makeProject({ name: 'State C' }));
        });
        expect(result.current.canRedo).toBe(false);
    });

    it('should not push duplicate states', () => {
        const { result } = renderHook(() => useUndoRedo(baseProject));

        // Push the same state twice (no meaningful change)
        act(() => {
            result.current.pushState(baseProject);
        });

        expect(result.current.undoCount).toBe(0);
        expect(result.current.canUndo).toBe(false);
    });

    it('should respect maxHistory limit', () => {
        const maxHistory = 3;
        const { result } = renderHook(() => useUndoRedo(baseProject, maxHistory));

        // Push more states than maxHistory
        for (let i = 0; i < 5; i++) {
            act(() => {
                result.current.pushState(makeProject({ name: `State ${i}` }));
            });
        }

        // Should be capped at maxHistory
        expect(result.current.undoCount).toBeLessThanOrEqual(maxHistory);
    });

    it('should return null state when undoing with empty history', () => {
        const { result } = renderHook(() => useUndoRedo(baseProject));

        let undoResult: ReturnType<typeof result.current.undo>;
        act(() => {
            undoResult = result.current.undo();
        });

        expect(undoResult!.state).toBeNull();
    });

    it('should return null state when redoing with empty future', () => {
        const { result } = renderHook(() => useUndoRedo(baseProject));

        let redoResult: ReturnType<typeof result.current.redo>;
        act(() => {
            redoResult = result.current.redo();
        });

        expect(redoResult!.state).toBeNull();
    });

    it('should reset history completely', () => {
        const { result } = renderHook(() => useUndoRedo(baseProject));

        act(() => {
            result.current.pushState(makeProject({ name: 'A' }));
        });
        act(() => {
            result.current.pushState(makeProject({ name: 'B' }));
        });

        expect(result.current.undoCount).toBe(2);

        const freshProject = makeProject({ name: 'Fresh' });
        act(() => {
            result.current.resetHistory(freshProject);
        });

        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(false);
        expect(result.current.undoCount).toBe(0);
        expect(result.current.redoCount).toBe(0);
    });

    it('should preserve context through undo/redo cycles', () => {
        const { result } = renderHook(() => useUndoRedo(baseProject));

        act(() => {
            result.current.pushState(
                makeProject({ name: 'Tasks change' }),
                { tab: 'tasks', description: 'Added task' }
            );
        });

        let undoResult: ReturnType<typeof result.current.undo>;
        act(() => {
            undoResult = result.current.undo();
        });

        // The context returned should be from the undone action
        expect(undoResult!.context?.tab).toBe('tasks');
        expect(undoResult!.context?.description).toBe('Added task');
    });

    it('should handle multiple undo operations in sequence', () => {
        const { result } = renderHook(() => useUndoRedo(baseProject));

        act(() => { result.current.pushState(makeProject({ name: 'A' })); });
        act(() => { result.current.pushState(makeProject({ name: 'B' })); });
        act(() => { result.current.pushState(makeProject({ name: 'C' })); });

        expect(result.current.undoCount).toBe(3);

        act(() => { result.current.undo(); });
        expect(result.current.undoCount).toBe(2);
        expect(result.current.redoCount).toBe(1);

        act(() => { result.current.undo(); });
        expect(result.current.undoCount).toBe(1);
        expect(result.current.redoCount).toBe(2);

        act(() => { result.current.undo(); });
        expect(result.current.undoCount).toBe(0);
        expect(result.current.redoCount).toBe(3);
        expect(result.current.canUndo).toBe(false);
    });
});
