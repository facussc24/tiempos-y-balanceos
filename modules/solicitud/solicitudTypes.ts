/**
 * Solicitud de Generacion de Codigo — Types
 *
 * Data model for code generation requests (products and supplies).
 */

// ---------------------------------------------------------------------------
// Enums / literals
// ---------------------------------------------------------------------------

/** Type of code being requested */
export type SolicitudTipo = 'producto' | 'insumo';

/** Status of the solicitud */
export type SolicitudStatus = 'borrador' | 'enviada' | 'aprobada' | 'rechazada' | 'obsoleta';

/** Unidad de medida for insumos */
export type UnidadMedida = 'kg' | 'lt' | 'mt' | 'un' | 'par' | 'rollo' | 'caja' | 'otro';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** SGC Form number for this document */
export const SGC_FORM_NUMBER = 'F-ING-001';

/** Default revision level */
export const DEFAULT_REVISION = 'A';

/** Available departments */
export const DEPARTAMENTOS = [
    'Ingenieria',
    'Calidad',
    'Produccion',
    'Logistica',
    'Mantenimiento',
    'Compras',
    'Administracion',
] as const;

/** Unidades de medida options */
export const UNIDADES_MEDIDA: readonly { value: UnidadMedida; label: string }[] = [
    { value: 'kg', label: 'Kilogramo (kg)' },
    { value: 'lt', label: 'Litro (lt)' },
    { value: 'mt', label: 'Metro (mt)' },
    { value: 'un', label: 'Unidad (un)' },
    { value: 'par', label: 'Par' },
    { value: 'rollo', label: 'Rollo' },
    { value: 'caja', label: 'Caja' },
    { value: 'otro', label: 'Otro' },
] as const;

/** Default base path for server folder management */
export const DEFAULT_SOLICITUD_BASE_PATH = 'Y:\\Ingenieria\\Solicitudes de Codigo';

/** Blocked attachment file extensions (security) */
export const BLOCKED_ATTACHMENT_EXTENSIONS = [
    'exe', 'bat', 'cmd', 'msi', 'ps1', 'vbs', 'wsf', 'scr', 'com', 'pif',
] as const;

/** Max file size per attachment: 50 MB */
export const MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024;

/** Max total attachments size: 200 MB */
export const MAX_TOTAL_ATTACHMENTS_BYTES = 200 * 1024 * 1024;

/** Status display labels and colors */
export const STATUS_CONFIG: Record<SolicitudStatus, { label: string; color: string; bg: string }> = {
    borrador: { label: 'Borrador', color: 'text-slate-500', bg: 'bg-slate-100' },
    enviada: { label: 'Enviada', color: 'text-blue-600', bg: 'bg-blue-50' },
    aprobada: { label: 'Aprobada', color: 'text-green-600', bg: 'bg-green-50' },
    rechazada: { label: 'Rechazada', color: 'text-red-600', bg: 'bg-red-50' },
    obsoleta: { label: 'Obsoleta', color: 'text-gray-500', bg: 'bg-gray-200' },
};

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

/** Header/metadata for a Solicitud */
export interface SolicitudHeader {
    /** Auto-generated sequential number: SGC-001, SGC-002, etc. */
    solicitudNumber: string;
    /** Date of request (YYYY-MM-DD) */
    fechaSolicitud: string;
    /** Requester name */
    solicitante: string;
    /** Department/area */
    areaDepartamento: string;
    /** Form number (internal document control) */
    formNumber: string;
    /** Revision level */
    revision: string;
}

/** Producto-specific fields */
export interface SolicitudProducto {
    codigo: string;
    descripcion: string;
    cliente: string;
}

/** File attachment metadata (files stored on server, only metadata in SQLite) */
export interface SolicitudAttachment {
    fileName: string;
    fileSize: number;
    fileType: string;
    /** Path relative to solicitud folder, e.g. "adjuntos/plano.pdf" */
    relativePath: string;
    uploadedAt: string;
    uploadedBy: string;
}

/** Insumo-specific fields */
export interface SolicitudInsumo {
    codigo: string;
    descripcion: string;
    unidadMedida: UnidadMedida;
    /** Supplier code doesn't exist, internal generation required */
    requiereGeneracionInterna: boolean;
}

/** Full Solicitud document */
export interface SolicitudDocument {
    id: string;
    tipo: SolicitudTipo;
    header: SolicitudHeader;
    producto: SolicitudProducto | null;
    insumo: SolicitudInsumo | null;
    /** Optional notes/observations */
    observaciones: string;
    /** Status tracking */
    status: SolicitudStatus;
    createdAt: string;
    updatedAt: string;
    /** Full path to the server folder (set after first server sync) */
    serverFolderPath: string | null;
    /** Metadata for attached files */
    attachments: SolicitudAttachment[];
    /** ISO timestamp of last successful server sync */
    lastServerSync: string | null;
}

/** Lightweight list item for document listing */
export interface SolicitudListItem {
    id: string;
    solicitud_number: string;
    tipo: SolicitudTipo;
    codigo: string;
    descripcion: string;
    solicitante: string;
    area_departamento: string;
    status: SolicitudStatus;
    fecha_solicitud: string;
    updated_at: string;
    server_folder_path: string;
    attachment_count: number;
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function todayIso(): string {
    return new Date().toISOString().split('T')[0];
}

/** Create a new empty Solicitud */
export function createEmptySolicitud(tipo: SolicitudTipo = 'producto'): SolicitudDocument {
    return {
        id: crypto.randomUUID(),
        tipo,
        header: {
            solicitudNumber: '',
            fechaSolicitud: todayIso(),
            solicitante: '',
            areaDepartamento: '',
            formNumber: SGC_FORM_NUMBER,
            revision: DEFAULT_REVISION,
        },
        producto: tipo === 'producto'
            ? { codigo: '', descripcion: '', cliente: '' }
            : null,
        insumo: tipo === 'insumo'
            ? { codigo: '', descripcion: '', unidadMedida: 'un', requiereGeneracionInterna: false }
            : null,
        observaciones: '',
        status: 'borrador',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        serverFolderPath: null,
        attachments: [],
        lastServerSync: null,
    };
}

// ---------------------------------------------------------------------------
// Normalization (backward compat for future schema changes)
// ---------------------------------------------------------------------------

/** Normalize a raw solicitud from DB/JSON, filling missing fields */
export function normalizeSolicitud(raw: Record<string, unknown> | SolicitudDocument): SolicitudDocument {
    const doc = raw as unknown as SolicitudDocument;
    return {
        id: doc.id || crypto.randomUUID(),
        tipo: doc.tipo === 'insumo' ? 'insumo' : 'producto',
        header: {
            solicitudNumber: doc.header?.solicitudNumber || '',
            fechaSolicitud: doc.header?.fechaSolicitud || todayIso(),
            solicitante: doc.header?.solicitante || '',
            areaDepartamento: doc.header?.areaDepartamento || '',
            formNumber: doc.header?.formNumber || SGC_FORM_NUMBER,
            revision: doc.header?.revision || DEFAULT_REVISION,
        },
        producto: doc.tipo === 'producto'
            ? {
                codigo: doc.producto?.codigo || '',
                descripcion: doc.producto?.descripcion || '',
                cliente: doc.producto?.cliente || '',
            }
            : null,
        insumo: doc.tipo === 'insumo'
            ? {
                codigo: doc.insumo?.codigo || '',
                descripcion: doc.insumo?.descripcion || '',
                unidadMedida: doc.insumo?.unidadMedida || 'un',
                requiereGeneracionInterna: doc.insumo?.requiereGeneracionInterna ?? false,
            }
            : null,
        observaciones: doc.observaciones || '',
        status: (['borrador', 'enviada', 'aprobada', 'rechazada', 'obsoleta'] as SolicitudStatus[]).includes(doc.status)
            ? doc.status
            : 'borrador',
        createdAt: doc.createdAt || new Date().toISOString(),
        updatedAt: doc.updatedAt || new Date().toISOString(),
        serverFolderPath: doc.serverFolderPath || null,
        attachments: Array.isArray(doc.attachments) ? doc.attachments : [],
        lastServerSync: doc.lastServerSync || null,
    };
}
