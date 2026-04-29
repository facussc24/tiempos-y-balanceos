/**
 * BOM (Bill of Materials / Lista de Materiales) — Type Definitions
 *
 * Modelo basado en el formato estandar Barack Mercosul observado en PPAP CLIENTES
 * (VW Patagonia, PWA Toyota Telas Planas, NOVAX Tapizadas Puerta).
 *
 * Estructura visual de referencia:
 * - Cada documento = 1 ficha de BOM por part number
 * - Items agrupados por categoria de material (PLASTICO, FUNDA, SUSTRATO, etc.)
 * - Cada item con: numero, codigo interno, codigo proveedor, descripcion,
 *   consumo, unidad, proveedor, thumbnail
 * - Imagen del producto al lado con leaders numerados que matchean los items
 */

import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Categorias de material (orden estandar Barack)
// ---------------------------------------------------------------------------

export type BomCategory =
    | 'PLASTICO'
    | 'FUNDA'
    | 'SUSTRATO'
    | 'ADHESIVO_RETICULANTE'
    | 'ETIQUETA'
    | 'CARTON'
    | 'PRIMER'
    | 'FILM'
    | 'OTROS';

export const BOM_CATEGORIES: BomCategory[] = [
    'PLASTICO',
    'FUNDA',
    'SUSTRATO',
    'ADHESIVO_RETICULANTE',
    'ETIQUETA',
    'CARTON',
    'PRIMER',
    'FILM',
    'OTROS',
];

/** Label visible en UI (espanol Argentina). */
export const BOM_CATEGORY_LABEL: Record<BomCategory, string> = {
    PLASTICO: 'PLASTICO',
    FUNDA: 'FUNDA',
    SUSTRATO: 'SUSTRATO',
    ADHESIVO_RETICULANTE: 'ADHESIVO / RETICULANTE',
    ETIQUETA: 'ETIQUETA',
    CARTON: 'CARTON',
    PRIMER: 'PRIMER',
    FILM: 'FILM',
    OTROS: 'OTROS',
};

// ---------------------------------------------------------------------------
// Unidades estandar (las observadas en BOMs Barack del servidor)
// ---------------------------------------------------------------------------

export type BomUnit = 'KG' | 'ML' | 'UN' | 'MT' | 'MT2' | 'ROLL' | 'L' | '';

export const BOM_UNITS: BomUnit[] = ['KG', 'ML', 'UN', 'MT', 'MT2', 'ROLL', 'L'];

// ---------------------------------------------------------------------------
// Item — 1 fila de la tabla BOM
// ---------------------------------------------------------------------------

export interface BomItem {
    id: string;
    /** Numero secuencial dentro del BOM (matchea leader en imagen producto). */
    numero: string;
    /** Codigo interno Barack. */
    codigoInterno: string;
    /** Codigo del proveedor. */
    codigoProveedor: string;
    /** Descripcion / plano del componente. */
    descripcion: string;
    /** Consumo por pieza (string para preservar formato decimal: "0,04" o "0.000063"). */
    consumo: string;
    /** Unidad de medida. */
    unidad: BomUnit;
    /** Nombre del proveedor. */
    proveedor: string;
    /** Thumbnail base64 del componente (puede estar vacio). */
    imagen: string;
    /** Posicion X (0-100 %) del numero leader sobre la imagen del producto. */
    leaderX: number;
    /** Posicion Y (0-100 %) del numero leader sobre la imagen del producto. */
    leaderY: number;
    /** Observaciones libres. */
    observaciones: string;
}

export function createEmptyBomItem(numero: string = ''): BomItem {
    return {
        id: uuidv4(),
        numero,
        codigoInterno: '',
        codigoProveedor: '',
        descripcion: '',
        consumo: '',
        unidad: '',
        proveedor: '',
        imagen: '',
        leaderX: 0,
        leaderY: 0,
        observaciones: '',
    };
}

// ---------------------------------------------------------------------------
// Group — agrupacion por categoria de material
// ---------------------------------------------------------------------------

export interface BomGroup {
    id: string;
    categoria: BomCategory;
    items: BomItem[];
}

export function createEmptyBomGroup(categoria: BomCategory): BomGroup {
    return {
        id: uuidv4(),
        categoria,
        items: [],
    };
}

// ---------------------------------------------------------------------------
// Header — metadata de la ficha BOM
// ---------------------------------------------------------------------------

export interface BomHeader {
    organization: string;
    bomNumber: string;
    /** Part number del producto (ej: "2HT.857.115 YZM"). */
    partNumber: string;
    /** Descripcion del producto (ej: "IP Decorative Trim (Titan Black Narbe) COMFORT"). */
    descripcion: string;
    /** Cliente: VW, PWA, NOVAX, etc. */
    cliente: string;
    /** Proyecto del cliente (ej: "VW427-1LA_K-PATAGONIA"). */
    proyecto: string;
    /** Familia Barack (ej: "IP PAD", "Insert", "Armrest"). */
    familia: string;
    /** Revision IATF (A, B, C). */
    revision: string;
    fechaEmision: string;
    elaboradoPor: string;
    aprobadoPor: string;
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export type BomLifecycleStatus = 'draft' | 'inReview' | 'approved' | 'archived';

export interface BomDocument {
    header: BomHeader;
    /** Imagen grande del producto (base64). Sobre ella se dibujan los leaders numerados. */
    imagenProducto: string;
    groups: BomGroup[];
}

// ---------------------------------------------------------------------------
// Registry / list entry
// ---------------------------------------------------------------------------

export interface BomRegistryEntry {
    id: string;
    bomNumber: string;
    partNumber: string;
    descripcion: string;
    cliente: string;
    proyecto: string;
    familia: string;
    revision: string;
    status: BomLifecycleStatus;
    itemCount: number;
    groupCount: number;
    fechaEmision: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    updatedBy: string;
}
