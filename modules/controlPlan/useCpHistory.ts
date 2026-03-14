/**
 * Control Plan Undo/Redo History Hook
 *
 * Thin wrapper over the generic useDocumentHistory<T> hook.
 * Preserves the original API so existing consumers (ControlPlanApp, tests) work unchanged.
 */

import { useDocumentHistory, type DocumentHistoryControls } from '../../hooks/useDocumentHistory';
import { ControlPlanDocument } from './controlPlanTypes';

export type CpHistoryControls = DocumentHistoryControls<ControlPlanDocument>;

/**
 * Track undo/redo history for a ControlPlanDocument.
 *
 * @param currentData - The live ControlPlanDocument from useControlPlan
 * @returns Controls for undo/redo + reset + flushPending
 *
 * Usage in ControlPlanApp:
 *   const cp = useControlPlan();
 *   const history = useCpHistory(cp.data);
 *   // On undo: const prev = history.undo(); if (prev) cp.loadData(prev);
 */
export function useCpHistory(currentData: ControlPlanDocument): CpHistoryControls {
    return useDocumentHistory<ControlPlanDocument>(currentData);
}
