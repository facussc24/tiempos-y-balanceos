/**
 * Zip template data — APOYACABEZAS (Headrest) PATAGONIA / VWA.
 * Copied verbatim from the standalone Google AI Studio flowchart app.
 */

import type { ZipNode, ZipHeader, ZipProduct } from '../zipFlowConverter';

export const apoyacabezasZip: { header: ZipHeader; products: ZipProduct[]; flow: ZipNode[] } = {
    header: {
        title: 'FLUJOGRAMA DE PROCESO APOYACABEZAS',
        documentCode: 'P-APO-001/PRE',
        revision: 'PRELIMINAR',
        date: '04/05/2026',
        preparedBy: 'FACUNDO SANTORO',
        reviewedBy: 'CARLOS BAPTISTA',
        project: 'PATAGONIA',
        client: 'VWA',
    },
    products: [
        { code: '2HC.885.900', level: 'L0', description: 'REAR HEADREST, CENTER', version: 'PVC' },
        { code: '2HC.885.900.A', level: 'L1', description: 'REAR HEADREST, CENTER', version: 'FABRIC + PVC' },
        { code: '2HC.885.900.B', level: 'L2', description: 'REAR HEADREST, CENTER', version: 'LEATHER + PVC' },
        { code: '2HC.885.900.C', level: 'L3', description: 'REAR HEADREST, CENTER', version: 'LEATHER + PVC' },
        { code: '2HC.885.901', level: 'L0', description: 'REAR HEADREST, OUTER', version: 'PVC' },
        { code: '2HC.885.901.A', level: 'L1', description: 'REAR HEADREST, OUTER', version: 'FABRIC + PVC' },
        { code: '2HC.885.901.B', level: 'L2', description: 'REAR HEADREST, OUTER', version: 'LEATHER + PVC' },
        { code: '2HC.885.901.C', level: 'L3', description: 'REAR HEADREST, OUTER', version: 'LEATHER + PVC' },
        { code: '2HC.881.901', level: 'L0', description: 'FRONT HEADREST, PASSENGER / DRIVER', version: 'PVC' },
        { code: '2HC.881.901.A', level: 'L1', description: 'FRONT HEADREST, PASSENGER / DRIVER', version: 'FABRIC + PVC' },
        { code: '2HC.881.901.B', level: 'L2', description: 'FRONT HEADREST, PASSENGER / DRIVER', version: 'LEATHER + PVC' },
        { code: '2HC.881.901.C', level: 'L3', description: 'FRONT HEADREST, PASSENGER / DRIVER', version: 'LEATHER + PVC' },
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
        { type: 'transfer', description: 'TRASLADO A CORTE' },
        { stepId: '20', type: 'operation', description: 'CORTE DE PANELES' },
        { stepId: '25', type: 'op-ins', description: 'CONTROL CON PLANTILLA MYLAR' },
        {
            type: 'condition',
            labelCondition: '¿CORTE OK?',
            labelDown: 'SI',
            branchSide: { labelNode: 'NO', type: 'terminal', text: 'SCRAP' },
        },
        { type: 'transfer', description: 'TRASLADO A COSTURA' },
        { stepId: '30', type: 'operation', description: 'COSTURA UNIÓN' },
        { stepId: '40', type: 'operation', description: 'COSTURA SEGUNDA ETAPA' },
        { type: 'transfer', description: 'TRASLADO A INYECCIÓN DE PU' },
        { stepId: '50', type: 'operation', description: 'INYECCIÓN DE PU' },
        { type: 'transfer', description: 'TRASLADO A SECTOR DE TAPIZADO' },
        { stepId: '60', type: 'operation', description: 'ENFUNDADO' },
        { stepId: '70', type: 'operation', description: 'INSERCIÓN DE VARILLA' },
        { type: 'transfer', description: 'TRASLADO A MURO DE CALIDAD' },
        { stepId: '80', type: 'op-ins', description: 'CONTROL FINAL DE CALIDAD' },
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
                    { stepId: '90', type: 'operation', description: 'REPROCESO: ELIMINACIÓN DE HILO SOBRANTE' },
                    { stepId: '91', type: 'operation', description: 'REPROCESO: PUNTADA FLOJA' },
                    { stepId: '92', type: 'operation', description: 'REPROCESO: ELIMINACIÓN DE ARRUGAS EN HORNO' },
                    { stepId: '93', type: 'operation', description: 'RETOQUE MENOR O RE-ETIQUETADO' },
                    {
                        type: 'condition',
                        labelCondition: '¿REPROCESO OK?',
                        labelDown: 'SI',
                        branchSide: { labelNode: 'NO', type: 'terminal', text: 'SCRAP' },
                    },
                    { type: 'transfer', description: 'RE-ENTRADA AL FLUJO PRINCIPAL', rework: { targetId: '80', label: 'VERIFICAR OP. 80' } },
                ],
            },
        },
        { type: 'transfer', description: 'TRASLADO A EMBALAJE' },
        { stepId: '100', type: 'operation', description: 'EMBALAJE Y ETIQUETADO PT' },
        { type: 'transfer', description: 'TRASLADO A ALMACÉN' },
        { type: 'storage', description: 'ALMACENADO FINAL DE PRODUCTO TERMINADO' },
    ],
};
