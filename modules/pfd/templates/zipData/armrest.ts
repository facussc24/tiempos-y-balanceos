/**
 * Zip template data — ARMREST DOOR PANEL PATAGONIA / VWA.
 * Copied verbatim from the standalone Google AI Studio flowchart app.
 */

import type { ZipNode, ZipHeader, ZipProduct } from '../zipFlowConverter';

export const armrestZip: { header: ZipHeader; products: ZipProduct[]; flow: ZipNode[] } = {
    header: {
        title: 'FLUJOGRAMA DE PROCESO ARMREST DOOR PANEL',
        documentCode: 'P-ARM-001/PRE',
        revision: 'PRELIMINAR',
        date: '04/05/2026',
        preparedBy: 'FACUNDO SANTORO',
        reviewedBy: 'CARLOS BAPTISTA',
        project: 'PATAGONIA',
        client: 'VWA',
    },
    products: [
        { code: 'N 231', level: 'L1', description: 'ARMREST DOOR PANEL', version: 'STANDARD' },
    ],
    flow: [
        { stepId: '10', type: 'operation', description: 'RECEPCIÓN DE MATERIA PRIMA' },
        { stepId: '11', type: 'op-ins', description: 'CONTROL DE MATERIA PRIMA' },
        {
            type: 'condition',
            labelCondition: '¿MATERIAL OK?',
            labelDown: 'SI',
            branchSide: { labelNode: 'NO', type: 'terminal', text: 'RECLAMO A PROVEEDOR' },
        },
        { type: 'transfer', description: 'TRASLADO: MATERIAL APROBADO A ALMACÉN TEMPORAL (FIFO)' },
        { type: 'storage', description: 'ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA CONTROLADA E IDENTIFICADA' },
        { type: 'transfer', description: 'TRASLADO A LÍNEA DE COSTURA', branchSide: { type: 'connector', text: 'A', description: 'HILOS Y MATERIALES' } },
        { type: 'transfer', description: 'TRASLADO A INYECCION PU', branchSide: { type: 'connector', text: 'B', description: 'ISO Y POLIOL' } },
        {
            branches: [
                [
                    { type: 'transfer', description: 'TRASLADO A CORTE' },
                    { stepId: '15', type: 'operation', description: 'PREPARACION DE CORTE' },
                    { stepId: '20', type: 'operation', description: 'CORTE DE COMPONENTES' },
                    { stepId: '25', type: 'op-ins', description: 'CONTROL CON MYLAR' },
                    {
                        type: 'condition',
                        labelCondition: '¿CORTE OK?',
                        labelDown: 'SI',
                        branchSide: { labelNode: 'NO', type: 'terminal', text: 'SCRAP', direction: 'left' },
                    },
                    { type: 'storage', description: 'WIP - PIEZAS CORTADAS OK' },
                    { type: 'transfer', description: 'TRASLADO A SECTOR DE COSTURA' },
                    { stepId: '40', type: 'operation', description: 'REFILADO' },
                    { stepId: '50', type: 'operation', description: 'COSTURA UNION', incomingConnector: 'A' },
                    { stepId: '51', type: 'operation', description: 'COSTURA DOBLE' },
                    { type: 'storage', description: 'WIP - FUNDA COSIDA APROBADA' },
                ],
                [
                    { type: 'transfer', description: 'TRASLADO A INYECCION PLASTICA' },
                    { stepId: '60', type: 'operation', description: 'INYECCION DE PIEZAS PLASTICAS' },
                    { type: 'storage', description: 'WIP - SUSTRATOS PLASTICOS' },
                    { type: 'transfer', description: 'TRASLADO A INYECCION DE POLIURETANO' },
                    { stepId: '70', type: 'operation', description: 'INYECCION PU', incomingConnector: 'B' },
                    { type: 'storage', description: 'WIP - SUSTRATO PLASTICO + ESPUMA PU' },
                ],
            ],
        },
        { type: 'transfer', description: 'TRASLADO A SECTOR DE ADHESIVADO' },
        { stepId: '80', type: 'operation', description: 'ADHESIVADO' },
        { stepId: '81', type: 'op-ins', description: 'INSPECCION DE PIEZA ADHESIVADA' },
        {
            type: 'condition',
            labelCondition: '¿ADHESIVADO OK?',
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
                    { stepId: '103', type: 'operation', description: 'REPROCESO: FALTA DE ADHESIVO' },
                    { type: 'transfer', description: 'TRASLADO A OP 80', rework: { targetId: '80', label: 'RETRABAJO (A OP. 80)' } },
                ],
            },
        },
        { type: 'storage', description: 'WIP - PIEZA ADHESIVADA OK' },
        { type: 'transfer', description: 'TRASLADO A SECTOR DE TAPIZADO' },
        { stepId: '90', type: 'operation', description: 'TAPIZADO SEMIAUTOMATICO' },
        { type: 'storage', description: 'WIP - PIEZA TAPIZADA' },
        { type: 'transfer', description: 'TRASLADO A CONTROL FINAL' },
        { stepId: '100', type: 'op-ins', description: 'CONTROL FINAL DE CALIDAD' },
        {
            type: 'condition',
            labelCondition: '¿PRODUCTO OK?',
            labelDown: 'SI',
            branchSide: { labelNode: 'NO', type: 'terminal', text: 'SCRAP' },
        },
        { type: 'storage', description: 'WIP - PANEL DE PUERTA ARMREST APROBADO' },
        { type: 'transfer', description: 'TRASLADO A SECTOR DE EMBALAJE' },
        { stepId: '110', type: 'operation', description: 'EMBALAJE' },
        { type: 'transfer', description: 'TRASLADO A ALMACÉN PRODUCTO TERMINADO' },
        { type: 'storage', description: 'ALMACENADO FINAL PT' },
    ],
};
