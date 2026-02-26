/**
 * PFD Templates — Quick-start templates for new documents
 *
 * C3-U3: Provides a basic process flow template so users
 * don't start from a blank slate.
 */

import { PfdStep, createEmptyStep } from './pfdTypes';

/**
 * Basic manufacturing process template (8 steps).
 * Follows AIAG recommendation: starts with receiving, ends with shipping.
 * C5-N2: Transport steps between operations per AIAG APQP §3.1 (material flow).
 */
export function createBasicProcessTemplate(): PfdStep[] {
    return [
        {
            ...createEmptyStep('OP 10'),
            stepType: 'storage',
            description: 'Recepción de materia prima',
        },
        {
            ...createEmptyStep('OP 15'),
            stepType: 'transport',
            description: 'Transporte a línea de producción',
        },
        {
            ...createEmptyStep('OP 20'),
            stepType: 'operation',
            description: '',
        },
        {
            ...createEmptyStep('OP 25'),
            stepType: 'transport',
            description: 'Transporte a inspección',
        },
        {
            ...createEmptyStep('OP 30'),
            stepType: 'inspection',
            description: 'Inspección final',
        },
        {
            ...createEmptyStep('OP 35'),
            stepType: 'transport',
            description: 'Transporte a embalaje',
        },
        {
            ...createEmptyStep('OP 40'),
            stepType: 'operation',
            description: 'Embalaje',
        },
        {
            ...createEmptyStep('OP 50'),
            stepType: 'storage',
            description: 'Almacenamiento y envío al cliente',
        },
    ];
}

/**
 * C4-U3: Automotive manufacturing process template (14 steps).
 * More detailed template for typical metalworking/machining processes
 * common at Barack Mercosul (stamping, welding, assembly, etc.).
 * C5-N2: Transport steps between key transitions per AIAG APQP §3.1.
 * C9-N1: Includes parallel flow example (2 lines converging at assembly).
 */
export function createManufacturingProcessTemplate(): PfdStep[] {
    return [
        {
            ...createEmptyStep('OP 10'),
            stepType: 'storage',
            description: 'Recepción e inspección de materia prima',
        },
        {
            ...createEmptyStep('OP 15'),
            stepType: 'transport',
            description: 'Transporte a líneas de producción',
        },
        // C9-N1: Parallel flow — Línea A (Mecanizado)
        {
            ...createEmptyStep('OP 20'),
            stepType: 'operation',
            description: 'Corte / Preparación de material',
            branchId: 'A',
            branchLabel: 'Mecanizado',
        },
        {
            ...createEmptyStep('OP 30'),
            stepType: 'operation',
            description: 'Mecanizado principal',
            branchId: 'A',
            branchLabel: 'Mecanizado',
        },
        // C9-N1: Parallel flow — Línea B (Soldadura)
        {
            ...createEmptyStep('OP 25'),
            stepType: 'operation',
            description: 'Soldadura de componentes',
            branchId: 'B',
            branchLabel: 'Soldadura',
        },
        {
            ...createEmptyStep('OP 35'),
            stepType: 'combined',
            description: 'Inspección de soldadura',
            branchId: 'B',
            branchLabel: 'Soldadura',
            rejectDisposition: 'scrap',
            scrapDescription: 'Defecto de soldadura irreparable',
        },
        // Convergence
        {
            ...createEmptyStep('OP 40'),
            stepType: 'operation',
            description: 'Ensamble de componentes',
        },
        {
            ...createEmptyStep('OP 50'),
            stepType: 'operation',
            description: 'Tratamiento superficial / Acabado',
        },
        {
            ...createEmptyStep('OP 60'),
            stepType: 'inspection',
            description: 'Inspección final y liberación',
            rejectDisposition: 'rework',
            reworkReturnStep: 'OP 50',
            isRework: true,
        },
        {
            ...createEmptyStep('OP 65'),
            stepType: 'transport',
            description: 'Transporte a embalaje',
            department: 'Expedición',
        },
        {
            ...createEmptyStep('OP 70'),
            stepType: 'operation',
            description: 'Embalaje e identificación',
        },
        {
            ...createEmptyStep('OP 80'),
            stepType: 'storage',
            description: 'Almacenamiento y envío al cliente',
        },
    ];
}
