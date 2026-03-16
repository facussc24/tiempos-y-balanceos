/**
 * AMFE Registry Type Definitions
 *
 * Centralized index of all AMFE documents with lifecycle status,
 * revision history, and summary statistics.
 * Required by IATF 16949 for traceability and audit compliance.
 */

/** Lifecycle status for an AMFE document. */
export type AmfeLifecycleStatus = 'draft' | 'inReview' | 'approved' | 'archived';

export const LIFECYCLE_STATUS_LABELS: Record<AmfeLifecycleStatus, string> = {
    draft: 'Borrador',
    inReview: 'En Revision',
    approved: 'Aprobado',
    archived: 'Archivado',
};

export const LIFECYCLE_STATUS_COLORS: Record<AmfeLifecycleStatus, string> = {
    draft: 'bg-gray-200 text-gray-700',
    inReview: 'bg-blue-100 text-blue-700',
    approved: 'bg-green-100 text-green-700',
    archived: 'bg-slate-100 text-slate-500',
};

/** A single revision entry in the AMFE's history. */
export interface AmfeRevisionEntry {
    date: string;
    reason: string;
    revisedBy: string;
    description: string;
}

/** An entry in the AMFE registry - summary info about one AMFE document. */
export interface AmfeRegistryEntry {
    id: string;
    amfeNumber: string;          // AMFE-001, AMFE-002...
    projectName: string;         // JSON filename without extension
    status: AmfeLifecycleStatus;
    // Header summary
    subject: string;
    client: string;
    partNumber: string;
    responsible: string;
    // Dates
    startDate: string;
    lastRevisionDate: string;
    // Summary stats (updated on save)
    operationCount: number;
    causeCount: number;
    apHCount: number;
    apMCount: number;
    coveragePercent: number;     // % of causes with complete S/O/D
    // Revision history
    revisions: AmfeRevisionEntry[];
    // Timestamps
    createdAt: string;
    updatedAt: string;
    // Audit
    createdBy?: string;
    updatedBy?: string;
}

/** The top-level registry document, stored as _registry.json. */
export interface AmfeRegistry {
    entries: AmfeRegistryEntry[];
    lastUpdated: string;
    nextNumber: number;         // Auto-increment for AMFE number
}

/** Create a fresh empty registry (avoids stale timestamps from module-load time). */
export function createEmptyRegistry(): AmfeRegistry {
    return {
        entries: [],
        lastUpdated: new Date().toISOString(),
        nextNumber: 1,
    };
}

/** @deprecated Use createEmptyRegistry() instead */
export const EMPTY_REGISTRY: AmfeRegistry = createEmptyRegistry();
