/**
 * Zip template data — INYECCIÓN PLÁSTICA (sector inyección genérico).
 * Copied verbatim from the standalone Google AI Studio flowchart app.
 */

import type { ZipNode, ZipHeader, ZipProduct } from '../zipFlowConverter';

export const inyeccionZip: { header: ZipHeader; products: ZipProduct[]; flow: ZipNode[] } = {
    header: {
        title: 'FLUJOGRAMA DE PROCESO SECTOR INYECCIÓN',
        documentCode: 'P-INJ-001/PRE',
        revision: 'PRELIMINAR',
        date: '24/04/2026',
        preparedBy: 'FACUNDO SANTORO',
        reviewedBy: 'CARLOS BAPTISTA',
        project: 'INYECCIÓN PLÁSTICA',
        client: 'VOLKSWAGEN',
    },
    products: [
        { code: 'GEN-INJ-001', level: 'L1', description: 'PIEZAS INYECTADAS GENÉRICAS', version: 'TODAS' },
    ],
    flow: [
        { stepId: '10', type: 'operation', description: 'LLENADO DE CAJONES CON MATERIA PRIMA (A LA ESPERA AL PIE DE MÁQUINA)' },
        { stepId: '20', type: 'operation', description: 'INICIO Y SELECCIÓN DE PIEZA' },
        { stepId: '30', type: 'operation', description: 'INYECCIÓN DE MUESTRAS (5 PIEZAS)' },
        { stepId: '40', type: 'op-ins', description: 'LIBERACIÓN DE PRIMERA PIEZA' },
        {
            type: 'condition',
            labelCondition: '¿LIBERACIÓN OK?',
            labelDown: 'SI',
            branchSide: {
                labelNode: 'NO',
                sequence: [
                    { type: 'terminal', text: 'SCRAP' },
                    { stepId: '41', type: 'operation', description: 'AJUSTE', rework: { targetId: '30', label: 'REINYECCIÓN' } },
                ],
            },
        },
        { stepId: '50', type: 'operation', description: 'PRODUCCIÓN EN SERIE' },
        { stepId: '60', type: 'op-ins', description: 'CONTROL DE CALIDAD EN INYECCIÓN' },
        {
            type: 'condition',
            labelCondition: '¿PRODUCTO OK?',
            labelDown: 'SI',
            branchSide: { type: 'terminal', text: 'SCRAP', labelNode: 'NO' },
        },
        { type: 'transfer', description: 'TRASLADO' },
        { type: 'storage', description: 'ALMACENAMIENTO DE PRODUCTO SEMITERMINADO' },
    ],
};
