/**
 * AMFE Undo/Redo History Hook
 *
 * Thin wrapper over the generic useDocumentHistory<T> hook.
 * Preserves the original API so existing consumers (AmfeApp, tests) work unchanged.
 */

import { useDocumentHistory, type DocumentHistoryControls } from '../../hooks/useDocumentHistory';
import { AmfeDocument } from './amfeTypes';

export type AmfeHistoryControls = DocumentHistoryControls<AmfeDocument>;

/**
 * Track undo/redo history for an AmfeDocument.
 *
 * @param currentData - The live AmfeDocument from useAmfe
 * @returns Controls for undo/redo + reset + flushPending
 *
 * Usage in AmfeApp:
 *   const amfe = useAmfe();
 *   const history = useAmfeHistory(amfe.data);
 *   // On undo: const prev = history.undo(); if (prev) amfe.loadData(prev);
 */
export function useAmfeHistory(currentData: AmfeDocument): AmfeHistoryControls {
    return useDocumentHistory<AmfeDocument>(currentData);
}
