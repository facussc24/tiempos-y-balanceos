/**
 * Document Registry Types
 *
 * Unified type for listing documents across all modules (AMFE, Control Plan).
 */

import type { AmfeCatalogEstado } from '../../utils/repositories/amfeRegistryRepository';

export type DocumentType = 'amfe' | 'controlPlan';

export type { AmfeCatalogEstado };

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
    /** Estado SGC segun el catalogo maestro (tabla amfe_registry) */
    estadoSgc?: AmfeCatalogEstado;
    /** Revision vigente segun el catalogo (ej: "C") */
    revActual?: string;
    /** Fecha programada de proxima revision (ISO, del catalogo) */
    proximaRevision?: string;
    /** Ruta del archivo oficial en el servidor Y: */
    serverPath?: string;
    /** Numero de AMFE en el Listado Maestro del SGC */
    amfeCode?: string;
    /**
     * false = figura en el catalogo pero su contenido NO esta cargado en la app
     * (solo existe en el servidor). undefined/true = documento cargado, navegable.
     */
    cargado?: boolean;
    /** Additional type-specific metadata */
    meta?: Record<string, string | number>;
}

/** Badge de estado SGC para UI (colores por estado del catalogo). */
export const ESTADO_SGC_CONFIG: Record<AmfeCatalogEstado, {
    label: string;
    className: string;
}> = {
    'Borrador': {
        label: 'Borrador',
        className: 'bg-gray-100 text-gray-600 border-gray-200',
    },
    'En revision': {
        label: 'En revisión',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    'Liberado': {
        label: 'Liberado',
        className: 'bg-green-50 text-green-700 border-green-200',
    },
    'Obsoleto': {
        label: 'Obsoleto',
        className: 'bg-red-50 text-red-700 border-red-200',
    },
};

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
