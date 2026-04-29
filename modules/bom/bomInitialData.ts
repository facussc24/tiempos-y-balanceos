/**
 * BOM Initial Data
 *
 * Factory para crear documentos BOM en blanco. Cada call genera UUIDs frescos
 * para evitar referencias compartidas entre instancias.
 */

import { BomDocument, createEmptyBomVariant } from './bomTypes';

/**
 * Crea un BOM vacio con UNA variante invisible (name="").
 * Si el producto tiene variantes (ej: Top Roll FR/RR), el usuario agrega mas.
 */
export function createEmptyBomDoc(): BomDocument {
    return {
        header: {
            organization: 'BARACK MERCOSUL',
            bomNumber: '',
            partNumber: '',
            descripcion: '',
            cliente: '',
            proyecto: '',
            familia: '',
            revision: 'A',
            fechaEmision: '',
            elaboradoPor: '',
            aprobadoPor: '',
        },
        imagenProducto: '',
        variants: [createEmptyBomVariant('')],
    };
}
