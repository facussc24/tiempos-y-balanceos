/**
 * Zip template data — Modelo BASE Reglamentario (genérico).
 * Copied verbatim from the standalone Google AI Studio flowchart app.
 */

import type { ZipNode, ZipHeader, ZipProduct } from '../zipFlowConverter';

export const baseZip: { header: ZipHeader; products: ZipProduct[]; flow: ZipNode[] } = {
    header: {
        title: 'FLUJOGRAMA DE PROCESO MODELO BASE REGLAMENTARIO',
        documentCode: 'P-BASE-001/PRE',
        revision: 'PRELIMINAR',
        date: '08/04/2026',
        preparedBy: 'INGENIERIA',
        reviewedBy: 'CALIDAD',
        project: 'ESTANDAR',
        client: 'GENERAL',
    },
    products: [
        { code: 'MOD.001', level: 'L1', description: 'PIEZA BASE', version: 'VERSION ESTANDAR' },
    ],
    flow: [
        { stepId: '10', type: 'operation', description: 'RECEPCIÓN Y PREPARADO' },
        { type: 'transfer', description: 'TRASLADO A ESTACIÓN DE ENSAMBLE' },
        { stepId: '20', type: 'operation', description: 'OPERACIÓN PRINCIPAL' },
        { stepId: '30', type: 'operation', description: 'CONTROL DE CALIDAD OBLIGATORIO' },
        {
            type: 'condition',
            labelCondition: '¿PRODUCTO OK?',
            labelDown: 'SI',
            branchSide: {
                labelNode: 'NO',
                sequence: [
                    {
                        type: 'condition',
                        labelCondition: '¿SE PUEDE RETRABAJAR?',
                        labelDown: 'SI',
                        branchSide: { labelNode: 'NO', type: 'terminal', text: 'SCRAP' },
                    },
                    { stepId: '31', type: 'operation', description: 'RETRABAJO DE PIEZA' },
                    { type: 'transfer', description: 'TRASLADO A OP 30', rework: { targetId: '30', label: 'RETRABAJO (A OP. 30)' } },
                ],
            },
        },
        { type: 'transfer', description: 'TRASLADO A SECTOR BIFURCADO' },
        { type: 'storage', description: 'WIP - PIEZA ESPERANDO ENSAMBLE' },
        {
            branches: [
                [
                    { type: 'transfer', description: 'TRASLADO BIFURCACIÓN IZQUIERDA' },
                    { stepId: '40', type: 'operation', description: 'OPERACIÓN PARALELA A' },
                ],
                [
                    { type: 'transfer', description: 'TRASLADO BIFURCACIÓN DERECHA' },
                    { stepId: '50', type: 'operation', description: 'OPERACIÓN PARALELA B' },
                ],
            ],
        },
        { type: 'transfer', description: 'TRASLADO A ENSAMBLE FINAL' },
        { stepId: '60', type: 'operation', description: 'ENSAMBLE DE COMPONENTES' },
        { type: 'storage', description: 'ALMACENADO FINAL DE PRODUCTO TERMINADO' },
    ],
};
