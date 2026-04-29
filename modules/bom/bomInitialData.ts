/**
 * BOM Initial Data
 *
 * Factory para crear documentos BOM en blanco. Cada call genera UUIDs frescos
 * para evitar referencias compartidas entre instancias.
 */

import { BomDocument } from './bomTypes';

/**
 * Crea un BOM vacio sin categorias predeterminadas.
 * Cada producto lleva materiales distintos — el usuario agrega solo lo que corresponde.
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
        groups: [],
    };
}
