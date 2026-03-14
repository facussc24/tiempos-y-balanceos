/**
 * Document Registry Types
 *
 * Unified type for listing documents across all modules
 * (AMFE, Control Plan, PFD, Hojas de Operaciones).
 */

export type DocumentType = 'amfe' | 'controlPlan' | 'pfd' | 'hojaOperaciones';

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
    /** Linked AMFE project name (for CP and HO) */
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
    pfd: {
        label: 'Diagrama de Flujo',
        shortLabel: 'PFD',
        color: 'text-cyan-700',
        bgColor: 'bg-cyan-50',
        borderColor: 'border-cyan-200',
        icon: 'GitBranch',
    },
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
    hojaOperaciones: {
        label: 'Hoja de Operaciones',
        shortLabel: 'HO',
        color: 'text-indigo-700',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-200',
        icon: 'FileText',
    },
};
