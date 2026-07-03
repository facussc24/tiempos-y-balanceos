/**
 * Document Registry Types
 *
 * Unified type for listing documents across all modules (AMFE, Control Plan).
 */

export type DocumentType = 'amfe' | 'controlPlan';

export interface DocumentRegistryEntry {
    /** Unique document ID (from the source repository) */
    id: string;
    /** Document type */
    type: DocumentType;
    /** Human-readable name/title */
    name: string;
    /** Part number */
    partNumber: string;
    /** Part name/description */
    partName: string;
    /** Client name */
    client: string;
    /** Responsible person */
    responsible: string;
    /** Number of items/operations/steps in the document */
    itemCount: number;
    /** Last update timestamp (ISO string) */
    updatedAt: string;
    /** Email of user who created the document */
    createdBy?: string;
    /** Email of user who last modified the document */
    updatedBy?: string;
    /** Linked AMFE project name (for CP) */
    linkedAmfeProject?: string;
    /** Additional type-specific metadata */
    meta?: Record<string, string | number>;
}

/** Type labels and colors for UI */
export const DOCUMENT_TYPE_CONFIG: Record<DocumentType, {
    label: string;
    shortLabel: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: string; // lucide icon name
}> = {
    amfe: {
        label: 'AMFE VDA',
        shortLabel: 'AMFE',
        color: 'text-orange-700',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        icon: 'ShieldAlert',
    },
    controlPlan: {
        label: 'Plan de Control',
        shortLabel: 'CP',
        color: 'text-green-700',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        icon: 'ClipboardCheck',
    },
};
