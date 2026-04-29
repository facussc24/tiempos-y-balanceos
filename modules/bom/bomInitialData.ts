/**
 * BOM Initial Data
 *
 * Factory para crear documentos BOM en blanco. Cada call genera UUIDs frescos
 * para evitar referencias compartidas entre instancias.
 */

import { BomDocument, BOM_CATEGORIES, createEmptyBomGroup } from './bomTypes';

/**
 * Crea un BOM vacio con todos los grupos de categoria pre-creados pero sin items.
 * Asi el usuario ve la estructura completa y solo agrega items donde corresponde.
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
        groups: BOM_CATEGORIES.map(cat => createEmptyBomGroup(cat)),
    };
}
