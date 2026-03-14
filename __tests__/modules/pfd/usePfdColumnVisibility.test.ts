import { renderHook, act } from '@testing-library/react';
import { usePfdColumnVisibility } from '../../../modules/pfd/usePfdColumnVisibility';
import { createEmptyStep, PFD_COLUMN_GROUPS, PFD_COLUMNS } from '../../../modules/pfd/pfdTypes';
import type { PfdStep, PfdColumnGroup } from '../../../modules/pfd/pfdTypes';

const STORAGE_KEY = 'pfd_column_visibility';

function makeStep(overrides?: Partial<PfdStep>): PfdStep {
    return { ...createEmptyStep(), ...overrides };
}

describe('usePfdColumnVisibility', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('default visibility', () => {
        it('should match PFD_COLUMN_GROUPS defaults when no steps trigger autoShow', () => {
            const steps: PfdStep[] = [makeStep()];
            const { result } = renderHook(() => usePfdColumnVisibility(steps));

            for (const group of PFD_COLUMN_GROUPS) {
                if (group.id === 'essential') {
                    expect(result.current.visibleGroups[group.id]).toBe(true);
                } else if (group.autoShow) {
                    // autoShow with no matching steps should return false
                    expect(result.current.visibleGroups[group.id]).toBe(group.autoShow(steps));
                } else {
                    expect(result.current.visibleGroups[group.id]).toBe(group.defaultVisible);
                }
            }
        });

        it('should have essential always visible', () => {
            const { result } = renderHook(() => usePfdColumnVisibility([]));
            expect(result.current.visibleGroups.essential).toBe(true);
        });

        it('should have equipment visible by default', () => {
            const { result } = renderHook(() => usePfdColumnVisibility([]));
            expect(result.current.visibleGroups.equipment).toBe(true);
        });

        it('should have characteristics visible by default', () => {
            const { result } = renderHook(() => usePfdColumnVisibility([]));
            expect(result.current.visibleGroups.characteristics).toBe(true);
        });

        it('should have reference hidden by default', () => {
            const { result } = renderHook(() => usePfdColumnVisibility([]));
            expect(result.current.visibleGroups.reference).toBe(false);
        });
    });

    describe('essential group protection', () => {
        it('should not toggle essential off', () => {
            const { result } = renderHook(() => usePfdColumnVisibility([]));
            act(() => {
                result.current.toggleGroup('essential');
            });
            expect(result.current.visibleGroups.essential).toBe(true);
        });
    });

    describe('toggle behavior', () => {
        it('should toggle a group on/off', () => {
            const { result } = renderHook(() => usePfdColumnVisibility([]));
            // Equipment is on by default
            expect(result.current.visibleGroups.equipment).toBe(true);

            act(() => {
                result.current.toggleGroup('equipment');
            });
            expect(result.current.visibleGroups.equipment).toBe(false);

            act(() => {
                result.current.toggleGroup('equipment');
            });
            expect(result.current.visibleGroups.equipment).toBe(true);
        });

        it('should toggle a hidden group on', () => {
            const { result } = renderHook(() => usePfdColumnVisibility([]));
            // Reference is off by default
            expect(result.current.visibleGroups.reference).toBe(false);

            act(() => {
                result.current.toggleGroup('reference');
            });
            expect(result.current.visibleGroups.reference).toBe(true);
        });
    });

    describe('localStorage persistence', () => {
        it('should persist toggled state to localStorage', () => {
            const { result } = renderHook(() => usePfdColumnVisibility([]));
            act(() => {
                result.current.toggleGroup('equipment');
            });

            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            expect(stored.equipment).toBe(false);
        });

        it('should load persisted state on mount', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ reference: true }));
            const { result } = renderHook(() => usePfdColumnVisibility([]));
            expect(result.current.visibleGroups.reference).toBe(true);
        });

        it('should handle corrupted localStorage gracefully', () => {
            localStorage.setItem(STORAGE_KEY, 'not-json{{{');
            const { result } = renderHook(() => usePfdColumnVisibility([]));
            // Should fall back to defaults without crashing
            expect(result.current.visibleGroups.essential).toBe(true);
        });
    });

    describe('autoShow', () => {
        it('should activate flow group when steps have branchId', () => {
            const steps = [makeStep({ branchId: 'A' })];
            const { result } = renderHook(() => usePfdColumnVisibility(steps));
            expect(result.current.visibleGroups.flow).toBe(true);
        });

        it('should not activate flow group when no steps have branchId', () => {
            const steps = [makeStep({ branchId: '' })];
            const { result } = renderHook(() => usePfdColumnVisibility(steps));
            expect(result.current.visibleGroups.flow).toBe(false);
        });

        it('should activate disposition group when steps have rejectDisposition', () => {
            const steps = [makeStep({ rejectDisposition: 'scrap' })];
            const { result } = renderHook(() => usePfdColumnVisibility(steps));
            expect(result.current.visibleGroups.disposition).toBe(true);
        });

        it('should activate disposition group when steps have isExternalProcess', () => {
            const steps = [makeStep({ isExternalProcess: true })];
            const { result } = renderHook(() => usePfdColumnVisibility(steps));
            expect(result.current.visibleGroups.disposition).toBe(true);
        });

        it('should not activate disposition group when no matching steps', () => {
            const steps = [makeStep({ rejectDisposition: 'none', isExternalProcess: false })];
            const { result } = renderHook(() => usePfdColumnVisibility(steps));
            expect(result.current.visibleGroups.disposition).toBe(false);
        });
    });

    describe('user override vs autoShow', () => {
        it('should user override take precedence over autoShow (hide despite data)', () => {
            // Steps would trigger autoShow for flow
            const steps = [makeStep({ branchId: 'A' })];
            const { result } = renderHook(() => usePfdColumnVisibility(steps));

            // Flow should be auto-shown
            expect(result.current.visibleGroups.flow).toBe(true);

            // User toggles it off
            act(() => {
                result.current.toggleGroup('flow');
            });
            expect(result.current.visibleGroups.flow).toBe(false);
        });

        it('should user override take precedence over autoShow (show despite no data)', () => {
            const steps = [makeStep({ branchId: '' })];
            const { result } = renderHook(() => usePfdColumnVisibility(steps));

            // Flow should be hidden (no data)
            expect(result.current.visibleGroups.flow).toBe(false);

            // User toggles it on
            act(() => {
                result.current.toggleGroup('flow');
            });
            expect(result.current.visibleGroups.flow).toBe(true);
        });
    });

    describe('resetToDefaults', () => {
        it('should clear all overrides', () => {
            const { result } = renderHook(() => usePfdColumnVisibility([]));

            // Toggle some groups
            act(() => {
                result.current.toggleGroup('equipment');
                result.current.toggleGroup('reference');
            });
            expect(result.current.visibleGroups.equipment).toBe(false);
            expect(result.current.visibleGroups.reference).toBe(true);

            // Reset
            act(() => {
                result.current.resetToDefaults();
            });
            expect(result.current.visibleGroups.equipment).toBe(true);
            expect(result.current.visibleGroups.reference).toBe(false);
        });

        it('should remove localStorage entry', () => {
            const { result } = renderHook(() => usePfdColumnVisibility([]));
            act(() => {
                result.current.toggleGroup('equipment');
            });
            expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();

            act(() => {
                result.current.resetToDefaults();
            });
            expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
        });
    });

    describe('visibleColumns', () => {
        it('should return only columns from visible groups', () => {
            const { result } = renderHook(() => usePfdColumnVisibility([]));
            const visibleKeys = result.current.visibleColumns.map(c => c.key);

            // Essential columns should always be present
            expect(visibleKeys).toContain('stepNumber');
            expect(visibleKeys).toContain('stepType');
            expect(visibleKeys).toContain('description');

            // Equipment is visible by default
            expect(visibleKeys).toContain('machineDeviceTool');

            // Reference is hidden by default
            expect(visibleKeys).not.toContain('reference');
            expect(visibleKeys).not.toContain('department');
            expect(visibleKeys).not.toContain('notes');
        });

        it('should update visibleColumns when a group is toggled', () => {
            const { result } = renderHook(() => usePfdColumnVisibility([]));

            act(() => {
                result.current.toggleGroup('reference');
            });

            const visibleKeys = result.current.visibleColumns.map(c => c.key);
            expect(visibleKeys).toContain('reference');
            expect(visibleKeys).toContain('department');
            expect(visibleKeys).toContain('notes');
        });

        it('should include all PFD_COLUMNS when all groups are visible', () => {
            const { result } = renderHook(() => usePfdColumnVisibility([]));

            // Toggle on all hidden groups
            act(() => {
                result.current.toggleGroup('flow');
                result.current.toggleGroup('reference');
                result.current.toggleGroup('disposition');
            });

            expect(result.current.visibleColumns).toHaveLength(PFD_COLUMNS.length);
        });
    });
});
