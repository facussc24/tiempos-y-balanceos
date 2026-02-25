/**
 * AMFE Impact Analysis
 *
 * Scans the AMFE registry to find documents linked to a specific library operation.
 * Generates impact reports showing which AMFEs would be affected by a library change.
 * Supports selective sync with automatic revision history entries (IATF 16949 Paso 7).
 *
 * Flow:
 * 1. User updates a library operation
 * 2. scanLinkedAmfes() finds all AMFEs referencing that library op
 * 3. User selects which AMFEs to sync
 * 4. syncAmfeWithLibrary() applies merge + auto-generates revision entry
 */

import { AmfeDocument, AmfeOperation } from './amfeTypes';
import { AmfeLibraryOperation } from './amfeLibraryTypes';
import { AmfeRegistryEntry, AmfeRevisionEntry } from './amfeRegistryTypes';
import { mergeWithLibrary } from './amfeLibraryMerge';

/** Info about a linked AMFE found during impact scan. */
export interface LinkedAmfeInfo {
    /** Registry entry (summary info) */
    registryEntry: AmfeRegistryEntry;
    /** Which operations in this AMFE link to the library op */
    linkedOperationNames: string[];
    /** Number of linked operations */
    linkedOperationCount: number;
}

/** Result of scanning for linked AMFEs. */
export interface ImpactScanResult {
    /** Library operation that was modified */
    libraryOpId: string;
    libraryOpName: string;
    /** AMFEs that reference this library operation */
    linkedAmfes: LinkedAmfeInfo[];
    /** Total count of linked AMFEs */
    totalLinked: number;
}

/**
 * Scan loaded AMFEs to find which ones reference a given library operation.
 * This does NOT load AMFEs from disk - it works with pre-loaded data.
 *
 * @param libraryOpId - The ID of the library operation that was modified
 * @param libraryOpName - Display name for the report
 * @param amfeDocs - Map of projectName -> loaded AmfeDocument
 * @param registryEntries - All registry entries for name/status lookup
 */
export function scanLinkedAmfes(
    libraryOpId: string,
    libraryOpName: string,
    amfeDocs: Map<string, AmfeDocument>,
    registryEntries: AmfeRegistryEntry[],
): ImpactScanResult {
    const linkedAmfes: LinkedAmfeInfo[] = [];

    for (const [projectName, doc] of amfeDocs) {
        const linkedOps = doc.operations.filter(op => op.linkedLibraryOpId === libraryOpId);
        if (linkedOps.length === 0) continue;

        const registryEntry = registryEntries.find(e => e.projectName === projectName);
        if (!registryEntry) continue;

        linkedAmfes.push({
            registryEntry,
            linkedOperationNames: linkedOps.map(op => `${op.opNumber} - ${op.name}`),
            linkedOperationCount: linkedOps.length,
        });
    }

    return {
        libraryOpId,
        libraryOpName,
        linkedAmfes,
        totalLinked: linkedAmfes.length,
    };
}

/** Result of syncing a single AMFE with its library update. */
export interface SyncResult {
    projectName: string;
    /** Updated operations (merged with library) */
    updatedOperations: AmfeOperation[];
    /** Number of operations that were merged */
    mergedCount: number;
    /** Auto-generated revision entry for audit trail */
    revisionEntry: AmfeRevisionEntry;
    /** Whether the AMFE has a linked Control Plan that needs attention */
    hasLinkedControlPlan: boolean;
}

/**
 * Apply a library operation update to a single AMFE document.
 * Merges all linked operations and generates a revision history entry.
 *
 * @param doc - The AMFE document to update
 * @param projectName - Project name for the revision entry
 * @param libOp - The updated library operation
 * @param syncAuthor - Who triggered the sync (for audit trail)
 */
export function syncAmfeWithLibrary(
    doc: AmfeDocument,
    projectName: string,
    libOp: AmfeLibraryOperation,
    syncAuthor: string = 'Sistema',
): SyncResult {
    let mergedCount = 0;
    const mergeDetails: string[] = [];

    const updatedOperations = doc.operations.map(op => {
        if (op.linkedLibraryOpId !== libOp.id) return op;

        const merged = mergeWithLibrary(op, libOp);
        if (!merged) return op;

        mergedCount++;

        // Compute what changed for the revision description
        const newWEs = merged.workElements.length - op.workElements.length;
        const newFailures = countFailures(merged) - countFailures(op);
        const newCauses = countCauses(merged) - countCauses(op);

        const parts: string[] = [];
        if (newWEs > 0) parts.push(`${newWEs} nuevo(s) elemento(s) de trabajo`);
        if (newFailures > 0) parts.push(`${newFailures} nueva(s) falla(s)`);
        if (newCauses > 0) parts.push(`${newCauses} nueva(s) causa(s)`);
        if (parts.length === 0) parts.push('controles actualizados');

        mergeDetails.push(`Op ${op.opNumber}: ${parts.join(', ')}`);
        return merged;
    });

    // Build revision entry (IATF 16949 Paso 7 - Documentation of Results)
    const today = new Date().toISOString().split('T')[0];
    const detailText = mergeDetails.length > 0
        ? mergeDetails.join('; ')
        : 'sin cambios detectados';

    const revisionEntry: AmfeRevisionEntry = {
        date: today,
        reason: 'Sincronizacion de Biblioteca',
        revisedBy: `${syncAuthor} (Sync Biblioteca)`,
        description: `Sincronizacion con operacion de biblioteca "${libOp.name}" (v${libOp.version}). Cambios: ${detailText}.`,
    };

    // Check if AMFE has linked Control Plan (header field if exists)
    const hasLinkedControlPlan = !!((doc.header as unknown as Record<string, unknown>).linkedControlPlan);

    return {
        projectName,
        updatedOperations,
        mergedCount,
        revisionEntry,
        hasLinkedControlPlan,
    };
}

/**
 * Generate a summary message for a batch sync operation.
 */
export function generateSyncSummary(results: SyncResult[]): string {
    const totalMerged = results.reduce((sum, r) => sum + r.mergedCount, 0);
    const amfesUpdated = results.filter(r => r.mergedCount > 0).length;
    const cpAttention = results.filter(r => r.hasLinkedControlPlan).length;

    const parts = [`Se actualizaron ${amfesUpdated} AMFE(s) con ${totalMerged} operacion(es) sincronizada(s).`];

    if (cpAttention > 0) {
        parts.push(`${cpAttention} AMFE(s) tienen Plan de Control vinculado que requiere atencion.`);
    }

    return parts.join(' ');
}

// --- Helpers ---

function countFailures(op: AmfeOperation): number {
    return op.workElements.reduce(
        (sum, we) => sum + we.functions.reduce(
            (s2, f) => s2 + f.failures.length, 0
        ), 0
    );
}

function countCauses(op: AmfeOperation): number {
    return op.workElements.reduce(
        (sum, we) => sum + we.functions.reduce(
            (s2, f) => s2 + f.failures.reduce(
                (s3, fl) => s3 + fl.causes.length, 0
            ), 0
        ), 0
    );
}
