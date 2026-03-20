/**
 * Auto Export Service — Generates exports and writes to Y: drive on revision save
 *
 * Orchestrates:
 * 1. Extract metadata from document (client/piece)
 * 2. Generate Excel + PDF buffers using module-specific generators
 * 3. Write to Y:\INGENIERIA\{MODULE}\{CLIENT}\{PIECE}\
 * 4. If Y: unavailable, queue in pending_exports for later sync
 *
 * @module autoExportService
 */

import { isTauri } from './unified_fs';
import { logger } from './logger';
import {
    type ExportDocModule,
    getExportBasePath,
    extractDocMetadata,
    buildExportFileInfo,
    ensureExportDirs,
    resolveExportBasePath,
} from './exportPathManager';
import { enqueue } from './repositories/pendingExportRepository';
import { isDuplicateExport, updateManifestEntry } from './syncManifest';

// ============================================================================
// Types
// ============================================================================

export interface AutoExportResult {
    success: boolean;
    written: number;
    queued: number;
    errors: string[];
}

/** Event types emitted by auto-export for UI notifications (toasts) */
export type ExportNotifyEvent =
    | { type: 'written'; module: ExportDocModule; filenames: string[]; basePath: string }
    | { type: 'queued'; module: ExportDocModule; count: number }
    | { type: 'duplicate'; module: ExportDocModule; revisionLevel: string }
    | { type: 'error'; module: ExportDocModule; errors: string[] };

export type ExportNotifier = (event: ExportNotifyEvent) => void;

interface ExportItem {
    module: ExportDocModule;
    format: 'xlsx' | 'pdf' | 'svg';
    generate: () => Promise<Uint8Array> | Uint8Array;
}

// ============================================================================
// Notifier
// ============================================================================

let exportNotifier: ExportNotifier | null = null;

/**
 * Register a callback to receive export events (for toast notifications).
 * Call with `null` to unsubscribe.
 */
export function setExportNotifier(notifier: ExportNotifier | null): void {
    exportNotifier = notifier;
}

function notify(event: ExportNotifyEvent): void {
    try {
        exportNotifier?.(event);
    } catch {
        // Never let notification errors break the export pipeline
    }
}

// ============================================================================
// Buffer Generator Registry
// ============================================================================

/**
 * Get the list of exports to generate for a given module.
 * Each module produces Excel + PDF (where applicable).
 */
async function getExportItems(module: ExportDocModule, doc: unknown): Promise<ExportItem[]> {
    const items: ExportItem[] = [];

    switch (module) {
        case 'amfe': {
            const { generateAmfeCompletoBuffer } = await import('../modules/amfe/amfeExcelExport');
            const { generateAmfePdfBuffer } = await import('../modules/amfe/amfePdfExport');
            const typedDoc = doc as import('../modules/amfe/amfeTypes').AmfeDocument;
            items.push(
                { module, format: 'xlsx', generate: () => generateAmfeCompletoBuffer(typedDoc) },
                { module, format: 'pdf', generate: () => generateAmfePdfBuffer(typedDoc) },
            );
            break;
        }
        case 'cp': {
            const { generateCpExcelBuffer } = await import('../modules/controlPlan/controlPlanExcelExport');
            const { generateCpPdfBuffer } = await import('../modules/controlPlan/controlPlanPdfExport');
            const typedDoc = doc as import('../modules/controlPlan/controlPlanTypes').ControlPlanDocument;
            items.push(
                { module, format: 'xlsx', generate: () => generateCpExcelBuffer(typedDoc) },
                { module, format: 'pdf', generate: () => generateCpPdfBuffer(typedDoc) },
            );
            break;
        }
        case 'ho': {
            const { generateHoExcelBuffer } = await import('../modules/hojaOperaciones/hoExcelExport');
            const { generateHoPdfBuffer } = await import('../modules/hojaOperaciones/hojaOperacionesPdfExport');
            const typedDoc = doc as import('../modules/hojaOperaciones/hojaOperacionesTypes').HoDocument;
            items.push(
                { module, format: 'xlsx', generate: () => generateHoExcelBuffer(typedDoc) },
                { module, format: 'pdf', generate: () => generateHoPdfBuffer(typedDoc) },
            );
            break;
        }
        case 'pfd': {
            const { generatePfdSvgBuffer } = await import('../modules/pfd/pfdSvgExport');
            const { generatePfdPdfBuffer } = await import('../modules/pfd/pfdPdfExport');
            const typedDoc = doc as import('../modules/pfd/pfdTypes').PfdDocument;
            items.push(
                { module, format: 'svg', generate: () => generatePfdSvgBuffer(typedDoc) },
                { module, format: 'pdf', generate: () => generatePfdPdfBuffer(typedDoc) },
            );
            break;
        }
        case 'tiempos': {
            const { generateBalancingBuffer } = await import('../modules/balancing/balancingCapacityExcelExport');
            const typedDoc = doc as import('../types').ProjectData;
            items.push(
                { module, format: 'xlsx', generate: () => generateBalancingBuffer(typedDoc) },
            );
            break;
        }
        case 'solicitud': {
            const { generateSolicitudExcelBuffer } = await import('../modules/solicitud/solicitudExcelExport');
            const { generateSolicitudPdfBuffer } = await import('../modules/solicitud/solicitudPdfExport');
            const typedDoc = doc as import('../modules/solicitud/solicitudTypes').SolicitudDocument;
            items.push(
                { module, format: 'xlsx', generate: () => generateSolicitudExcelBuffer(typedDoc) },
                { module, format: 'pdf', generate: () => generateSolicitudPdfBuffer(typedDoc) },
            );
            break;
        }
    }

    return items;
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Auto-export on revision save. Fire-and-forget — never throws.
 *
 * @param module - Document module type
 * @param doc - The document data to export
 * @param revisionLevel - Current revision level (e.g., 'A', 'B')
 * @param documentId - Document ID for queue tracking
 */
export async function autoExportOnRevision(
    module: ExportDocModule,
    doc: unknown,
    revisionLevel: string,
    documentId: string = '',
): Promise<AutoExportResult> {
    const result: AutoExportResult = { success: false, written: 0, queued: 0, errors: [] };

    if (!isTauri()) {
        // Web mode — no filesystem access
        return result;
    }

    try {
        // 1. Extract metadata
        const metadata = extractDocMetadata(module, doc);

        // 2. Resolve base path (try configured, then default, then UNC)
        const basePath = await resolveExportBasePath();
        if (!basePath) {
            // Neither Y: nor UNC available — queue everything
            return await queueAllExports(module, doc, revisionLevel, documentId, metadata);
        }

        // 3. Check for duplicate (same revision already on network)
        if (documentId) {
            const duplicate = await isDuplicateExport(module, documentId, revisionLevel, basePath);
            if (duplicate) {
                logger.info('AutoExport', `Skipped duplicate: ${module}:${documentId} Rev ${revisionLevel}`);
                notify({ type: 'duplicate', module, revisionLevel });
                result.success = true;
                return result;
            }
        }

        // 4. Ensure folder structure exists
        await ensureExportDirs(module, metadata, basePath);

        // 5. Generate and write each export
        const items = await getExportItems(module, doc);
        const fs = await import('./unified_fs');
        const writtenFilenames: string[] = [];

        for (const item of items) {
            try {
                // FIX: Generate buffer once and reuse for both write and queue
                const buffer = await item.generate();
                const fileInfo = buildExportFileInfo(
                    item.module, metadata, revisionLevel, item.format, basePath,
                );

                try {
                    // Ensure directory exists
                    await fs.ensureDir(fileInfo.dir);
                    await fs.writeBinaryFile(fileInfo.fullPath, buffer);

                    result.written++;
                    writtenFilenames.push(fileInfo.filename);
                    logger.info('AutoExport', `Written: ${fileInfo.filename}`, { path: fileInfo.fullPath });
                } catch (writeErr) {
                    // Write failed — queue using the already-generated buffer
                    const errMsg = writeErr instanceof Error ? writeErr.message : String(writeErr);
                    result.errors.push(`${item.format}: ${errMsg}`);

                    try {
                        await enqueue({
                            module: item.module,
                            documentId,
                            revisionLevel,
                            exportFormat: item.format,
                            filename: fileInfo.filename,
                            fileData: buffer,
                            targetDir: fileInfo.dir,
                        });
                        result.queued++;
                    } catch (queueErr) {
                        const qMsg = queueErr instanceof Error ? queueErr.message : String(queueErr);
                        result.errors.push(`Queue ${item.format}: ${qMsg}`);
                    }
                }
            } catch (genErr) {
                // Buffer generation failed — can't write or queue
                const errMsg = genErr instanceof Error ? genErr.message : String(genErr);
                result.errors.push(`Generate ${item.format}: ${errMsg}`);
            }
        }

        // 6. Update sync manifest after successful writes
        if (result.written > 0 && documentId) {
            await updateManifestEntry(
                module, documentId,
                metadata.client, metadata.piece, metadata.pieceName,
                revisionLevel, writtenFilenames, basePath,
            ).catch(err => {
                // Non-critical — log but don't fail the export
                logger.warn('AutoExport', 'Failed to update sync manifest',
                    {}, err instanceof Error ? err : undefined);
            });
        }

        // 7. Notify UI
        if (result.written > 0) {
            notify({ type: 'written', module, filenames: writtenFilenames, basePath });
        }
        if (result.queued > 0) {
            notify({ type: 'queued', module, count: result.queued });
        }
        if (result.errors.length > 0) {
            notify({ type: 'error', module, errors: result.errors });
        }

        result.success = result.written > 0 || result.queued > 0;
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(errMsg);
        logger.error('AutoExport', 'Unexpected error during auto-export', {}, err instanceof Error ? err : undefined);
    }

    return result;
}

// ============================================================================
// Helpers
// ============================================================================


/**
 * Queue all exports when Y: is completely unavailable.
 */
async function queueAllExports(
    module: ExportDocModule,
    doc: unknown,
    revisionLevel: string,
    documentId: string,
    metadata: ReturnType<typeof extractDocMetadata>,
): Promise<AutoExportResult> {
    const result: AutoExportResult = { success: false, written: 0, queued: 0, errors: [] };
    const basePath = await getExportBasePath(); // Use configured path for target_dir

    try {
        const items = await getExportItems(module, doc);
        for (const item of items) {
            try {
                const buffer = await item.generate();
                const fileInfo = buildExportFileInfo(
                    item.module, metadata, revisionLevel, item.format, basePath,
                );
                await enqueue({
                    module: item.module,
                    documentId,
                    revisionLevel,
                    exportFormat: item.format,
                    filename: fileInfo.filename,
                    fileData: buffer,
                    targetDir: fileInfo.dir,
                });
                result.queued++;
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                result.errors.push(`Generate ${item.format}: ${errMsg}`);
            }
        }
        result.success = result.queued > 0;
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(errMsg);
    }

    logger.info('AutoExport', `Queued ${result.queued} exports (Y: unavailable)`);

    if (result.queued > 0) {
        notify({ type: 'queued', module, count: result.queued });
    }
    if (result.errors.length > 0) {
        notify({ type: 'error', module, errors: result.errors });
    }

    return result;
}
