/**
 * Auto Export Service
 *
 * Historically orchestrated auto-export-on-revision to the Y:\INGENIERIA
 * network drive (Tauri desktop build). The web build has no local
 * filesystem, so autoExportOnRevision is a no-op; exports are still
 * available on demand via the UI's manual export buttons.
 *
 * The notifier API is kept for compatibility with App.tsx callers, even
 * though no events are emitted in web mode.
 *
 * @module autoExportService
 */

import type { ExportDocModule } from './exportPathManager';

// ============================================================================
// Types (kept for external callers / typings)
// ============================================================================

export interface AutoExportResult {
    success: boolean;
    written: number;
    queued: number;
    errors: string[];
}

export type ExportNotifyEvent =
    | { type: 'written'; module: ExportDocModule; filenames: string[]; basePath: string }
    | { type: 'queued'; module: ExportDocModule; count: number }
    | { type: 'duplicate'; module: ExportDocModule; revisionLevel: string }
    | { type: 'error'; module: ExportDocModule; errors: string[] };

export type ExportNotifier = (event: ExportNotifyEvent) => void;

// ============================================================================
// Notifier (kept stateful for API compatibility; never fires in web mode)
// ============================================================================

let exportNotifier: ExportNotifier | null = null;

export function setExportNotifier(notifier: ExportNotifier | null): void {
    exportNotifier = notifier;
}

// Silence unused warning — notifier is kept for API compat only.
void exportNotifier;

// ============================================================================
// Public API — Web-mode stubs
// ============================================================================

/**
 * Auto-export on revision save.
 * Web mode: no-op. Users export manually via the UI buttons.
 */
export async function autoExportOnRevision(
    _module: ExportDocModule,
    _doc: unknown,
    _revisionLevel: string,
    _documentId: string = '',
): Promise<AutoExportResult> {
    return { success: false, written: 0, queued: 0, errors: [] };
}
