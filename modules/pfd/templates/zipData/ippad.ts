/**
 * Zip template data — IP PAD PATAGONIA / VW.
 * Copied verbatim from the standalone Google AI Studio flowchart app.
 */

import type { ZipNode, ZipHeader, ZipProduct } from '../zipFlowConverter';

export const ippadZip: { header: ZipHeader; products: ZipProduct[]; flow: ZipNode[] } = {
    header: {
        title: 'FLUJOGRAMA PRELIMINAR IP PAD',
        documentCode: 'P-IP-001/PRE',
        revision: 'PRELIMINAR',
        date: '08/04/2026',
        preparedBy: 'FACUNDO SANTORO',
        reviewedBy: 'CARLOS BAPTISTA',
        project: 'PATAGONIA',
        client: 'VW',
    },
    products: [
        { code: '2HC.858.417.B FAM', level: 'L1', description: 'PLATE ASM-I/P CTR OTLT AIR', version: 'IP PAD - LOW VERSION' },
        { code: '2HC.858.417.C GKX', level: 'L2', description: 'PLATE ASM-I/P CTR OTLT AIR', version: 'IP PAD - HIGH VERSION' },
        { code: '2HC.858.417.C GKN', level: 'L3', description: 'PLATE ASM-I/P CTR OTLT AIR', version: 'IP PAD - HIGH VERSION' },
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
        { type: 'transfer', description: 'TRASLADO DE ADHESIVO A LÍNEA', branchSide: { type: 'connector', text: 'A', description: 'ADHESIVO' } },
        { type: 'transfer', description: 'TRASLADO DE COMPONENTES A LÍNEA', branchSide: { type: 'connector', text: 'B', description: 'CLIPS, LOGO, TORNILLOS, DIFUSOR' } },
        {
            branches: [
                [
                    { type: 'transfer', description: 'TRASLADO A CORTE' },
                    { stepId: '30', type: 'operation', description: 'CORTE' },
                    { type: 'storage', description: 'WIP - VINILO CORTADO' },
                    { type: 'transfer', description: 'TRASLADO A COSTURA' },
                    { stepId: '40', type: 'operation', description: 'COSTURA' },
                    { type: 'storage', description: 'WIP - FUNDA COSIDA' },
                ],
                [
                    { type: 'transfer', description: 'TRASLADO A INYECCION PLASTICA' },
                    { stepId: '20', type: 'operation', description: 'INYECCION DE PIEZAS PLASTICAS' },
                    { type: 'storage', description: 'WIP - SUSTRATOS PLASTICOS' },
                    { type: 'transfer', description: 'TRASLADO A INYECCION DE POLIURETANO' },
                    { stepId: '50', type: 'operation', description: 'INYECCION PU' },
                    { type: 'storage', description: 'WIP - SUSTRATO PLASTICO + ESPUMA PU' },
                ],
            ],
        },
        { type: 'transfer', description: 'TRASLADO A SECTOR DE ADHESIVADO' },
        { stepId: '70', type: 'operation', description: 'ADHESIVADO', incomingConnector: 'A' },
        { stepId: '80', type: 'operation', description: 'CONTROL DE CALIDAD ADHESIVADO' },
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
                    { stepId: '81', type: 'operation', description: 'RETRABAJO DE ADHESIVADO' },
                    { type: 'transfer', description: 'TRASLADO A OP 80', rework: { targetId: '80', label: 'RETRABAJO (A OP. 80)' } },
                ],
            },
        },
        { type: 'transfer', description: 'TRASLADO A SECTOR DE TAPIZADO' },
        { type: 'storage', description: 'WIP - PIEZA ADHESIVADA' },
        { stepId: '90', type: 'operation', description: 'ALINEACION DE COSTURA (PRE-FIXING)' },
        { stepId: '100', type: 'operation', description: 'WRAPPING + EDGE FOLDING' },
        { stepId: '110', type: 'operation', description: 'SOLDADURA CON ULTRASONIDO Y ENSAMBLE', incomingConnector: 'B' },
        { stepId: '120', type: 'operation', description: 'TERMINACION' },
        { stepId: '130', type: 'operation', description: 'CONTROL FINAL DE CALIDAD' },
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
                    { stepId: '140', type: 'operation', description: 'RETRABAJO DE PRODUCTO TERMINADO' },
                    { type: 'transfer', description: 'TRASLADO A OP 130', rework: { targetId: '130', label: 'RETRABAJO (A OP. 130)' } },
                ],
            },
        },
        { type: 'transfer', description: 'TRASLADO A SECTOR DE PRODUCTO TERMINADO' },
        { type: 'storage', description: 'WIP - PIEZA TERMINADA' },
        { stepId: '150', type: 'operation', description: 'EMBALAJE DE PRODUCTO TERMINADO' },
        { type: 'transfer', description: 'TRASLADO A SECTOR DE ALMACENAMIENTO' },
        { type: 'storage', description: 'ALMACENADO FINAL DE PRODUCTO TERMINADO' },
    ],
};
