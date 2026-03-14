/**
 * Hoja de Operaciones Undo/Redo History Hook
 *
 * Thin wrapper over the generic useDocumentHistory<T> hook.
 */

import { useDocumentHistory, type DocumentHistoryControls } from '../../hooks/useDocumentHistory';
import type { HoDocument } from './hojaOperacionesTypes';

export type HoHistoryControls = DocumentHistoryControls<HoDocument>;

export function useHoHistory(currentData: HoDocument): HoHistoryControls {
    return useDocumentHistory<HoDocument>(currentData);
}
