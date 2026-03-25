/**
 * PFD Templates — Quick-start templates for new documents
 *
 * C3-U3: Provides a basic process flow template so users
 * don't start from a blank slate.
 */

import { PfdStep, PfdHeader, createEmptyStep, EMPTY_PFD_HEADER } from './pfdTypes';

/**
 * Template result that can optionally include pre-filled header data.
 * Used by PATAGONIA template to load a complete document with real data.
 */
export interface PfdTemplateResult {
    steps: PfdStep[];
    header?: Partial<PfdHeader>;
}

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
/**
 * PATAGONIA Tapizado Template — VW automotive upholstery process.
 * Matches I-IN-002/III flow diagram: receiving → cut → sew/die-cut/inject → foam → adhesive → upholster → pack.
 * Includes 3 parallel branches (Costura, Troquelado, Inyeccion) and rework loops.
 */
export function createPatagoniaTapizadoTemplate(): PfdTemplateResult {
    const header: Partial<PfdHeader> = {
        partName: 'INSERTO PATAGONIA',
        partNumber: 'N 227 a N 403',
        customerName: 'VWA',
        modelYear: 'PATAGONIA',
        companyName: 'BARACK MERCOSUL',
        plantLocation: 'PLANTA HURLINGHAM',
        documentNumber: 'PFD-PAT-001',
        coreTeam: 'Ing. Calidad, Ing. Manufactura, Sup. Costura, Sup. Tapizado',
        processPhase: 'production',
        revisionLevel: 'A',
        revisionDate: new Date().toISOString().split('T')[0],
        applicableParts: 'Insertos de Puerta Delanteros\nN 227 — INSERTO PTA. DEL. IZQ. L0\nN 392 — INSERTO PTA. DEL. DER. L0\nN 389 — INSERTO PTA. DEL. IZQ. L1\nN 393 — INSERTO PTA. DEL. DER. L1\nInsertos de Puerta Traseros\nN 396 — INSERTO PTA. TRAS. IZQ. L0\nN 400 — INSERTO PTA. TRAS. DER. L0\nN 397 — INSERTO PTA. TRAS. IZQ. L1\nN 401 — INSERTO PTA. TRAS. DER. L1',
    };

    const steps: PfdStep[] = [
        // OP 10 — Recepción de materia prima
        {
            ...createEmptyStep('OP 10'),
            stepType: 'storage',
            description: 'Recepción de materia prima',
            productSpecialChar: 'SC',
            department: 'Almacén',
        },
        {
            ...createEmptyStep(''),
            stepType: 'inspection',
            description: 'Inspección de materia prima',
            department: 'Calidad',
        },
        {
            ...createEmptyStep(''),
            stepType: 'decision',
            description: 'Liberación de materia prima (OK/NOK)',
            department: 'Calidad',
            rejectDisposition: 'sort',
            scrapDescription: 'Reclamo de calidad al proveedor',
        },
        {
            ...createEmptyStep(''),
            stepType: 'transport',
            description: 'Traslado: material aprobado a almacén temporal (FIFO)',
        },

        // OP 15 — Preparación de corte
        {
            ...createEmptyStep('OP 15'),
            stepType: 'operation',
            description: 'Preparación de corte',
            department: 'Corte',
        },
        {
            ...createEmptyStep(''),
            stepType: 'transport',
            description: 'Traslado: vinilos y telas a sector de mesa de corte',
        },

        // OP 20 — Cortar componentes
        {
            ...createEmptyStep('OP 20'),
            stepType: 'operation',
            description: 'Cortar componentes',
            machineDeviceTool: 'Mesa de corte',
            department: 'Corte',
        },

        // OP 25 — Control con Mylar
        {
            ...createEmptyStep('OP 25'),
            stepType: 'combined',
            description: 'Control con Mylar',
            department: 'Calidad',
        },
        {
            ...createEmptyStep(''),
            stepType: 'decision',
            description: 'Aprobación dimensional (OK/NOK)',
            department: 'Calidad',
            rejectDisposition: 'scrap',
            scrapDescription: 'Componente fuera de tolerancia',
        },

        // ═══ BRANCH A: Costura ═══
        {
            ...createEmptyStep('OP 30'),
            stepType: 'storage',
            description: 'Almacenamiento en medios WIP',
            branchId: 'A',
            branchLabel: 'Costura',
            department: 'Costura',
        },
        {
            ...createEmptyStep(''),
            stepType: 'transport',
            description: 'Traslado: kits de componentes a sector de costura',
            branchId: 'A',
            branchLabel: 'Costura',
        },
        {
            ...createEmptyStep('OP 40'),
            stepType: 'operation',
            description: 'Refilado',
            branchId: 'A',
            branchLabel: 'Costura',
            department: 'Costura',
        },
        {
            ...createEmptyStep('OP 50'),
            stepType: 'operation',
            description: 'Costura en máquina CNC',
            machineDeviceTool: 'Máquina de costura CNC doble aguja',
            branchId: 'A',
            branchLabel: 'Costura',
            department: 'Costura',
        },
        {
            ...createEmptyStep('OP 51'),
            stepType: 'storage',
            description: 'Almacenamiento en medios WIP',
            branchId: 'A',
            branchLabel: 'Costura',
        },

        // ═══ BRANCH B: Troquelado ═══
        {
            ...createEmptyStep(''),
            stepType: 'transport',
            description: 'Traslado: espumas a sector de troquelado',
            branchId: 'B',
            branchLabel: 'Troquelado',
        },
        {
            ...createEmptyStep('OP 60'),
            stepType: 'operation',
            description: 'Troquelado',
            machineDeviceTool: 'Troqueladora',
            branchId: 'B',
            branchLabel: 'Troquelado',
            department: 'Troquelado',
        },
        {
            ...createEmptyStep('OP 61'),
            stepType: 'storage',
            description: 'Almacenamiento en medios WIP',
            branchId: 'B',
            branchLabel: 'Troquelado',
        },

        // ═══ BRANCH C: Inyección ═══
        {
            ...createEmptyStep(''),
            stepType: 'transport',
            description: 'Traslado: materia prima a sector de inyección plástica',
            branchId: 'C',
            branchLabel: 'Inyección',
        },
        {
            ...createEmptyStep('OP 70'),
            stepType: 'operation',
            description: 'Inyección de piezas plásticas',
            machineDeviceTool: 'Inyectora plástica',
            branchId: 'C',
            branchLabel: 'Inyección',
            department: 'Inyección',
        },
        {
            ...createEmptyStep('OP 71'),
            stepType: 'storage',
            description: 'Almacenamiento en medios WIP',
            branchId: 'C',
            branchLabel: 'Inyección',
        },

        // ═══ CONVERGENCIA: Flujo principal ═══
        {
            ...createEmptyStep(''),
            stepType: 'transport',
            description: 'Traslado: piezas troqueladas y sustrato a sector de prearmado',
        },
        {
            ...createEmptyStep('OP 80'),
            stepType: 'operation',
            description: 'Prearmado de espuma',
            department: 'Prearmado',
        },
        {
            ...createEmptyStep('OP 81'),
            stepType: 'storage',
            description: 'Almacenamiento en medios WIP',
        },
        {
            ...createEmptyStep(''),
            stepType: 'transport',
            description: 'Traslado: semiterminados cosidos y pieza prearmada al sector de adhesivado',
        },

        // OP 90 — Adhesivado
        {
            ...createEmptyStep('OP 90'),
            stepType: 'operation',
            description: 'Adhesivado',
            department: 'Adhesivado',
        },

        // OP 91 — Inspección de pieza adhesivada
        {
            ...createEmptyStep('OP 91'),
            stepType: 'combined',
            description: 'Inspección de pieza adhesivada',
            department: 'Calidad',
        },
        {
            ...createEmptyStep(''),
            stepType: 'decision',
            description: 'Verificación de adhesivado (OK/NOK)',
            department: 'Calidad',
            rejectDisposition: 'rework',
        },

        // OP 103 — Reproceso (loop back a OP 91 para re-inspección)
        {
            ...createEmptyStep('OP 103'),
            stepType: 'operation',
            description: 'Reproceso: falta de adhesivo / puntada floja',
            department: 'Adhesivado',
            isRework: true,
            processSpecialChar: 'SC',
            rejectDisposition: 'scrap',
            scrapDescription: 'Pieza irrecuperable',
            reworkReturnStep: 'OP 91',
        },

        // OP 92 — WIP
        {
            ...createEmptyStep('OP 92'),
            stepType: 'storage',
            description: 'Almacenamiento en medios WIP',
        },
        {
            ...createEmptyStep(''),
            stepType: 'transport',
            description: 'Traslado: pieza prearmada al sector de tapizado',
        },

        // OP 100 — Tapizado semiautomático
        {
            ...createEmptyStep('OP 100'),
            stepType: 'operation',
            description: 'Tapizado semiautomático',
            machineDeviceTool: 'Máquina de tapizado semiautomática',
            department: 'Tapizado',
        },

        // OP 105 — Refilado post-tapizado
        {
            ...createEmptyStep('OP 105'),
            stepType: 'operation',
            description: 'Refilado post-tapizado',
            department: 'Tapizado',
        },

        // OP 110 — Control final de calidad
        {
            ...createEmptyStep('OP 110'),
            stepType: 'inspection',
            description: 'Control final de calidad',
            productSpecialChar: 'SC',
            department: 'Calidad',
        },
        {
            ...createEmptyStep('OP 111'),
            stepType: 'decision',
            description: 'Clasificación y segregación de producto no conforme',
            rejectDisposition: 'scrap',
            scrapDescription: 'Pieza irrecuperable',
        },

        // OP 120 — Embalaje
        {
            ...createEmptyStep(''),
            stepType: 'transport',
            description: 'Traslado a sector de producto terminado',
        },
        {
            ...createEmptyStep('OP 120'),
            stepType: 'operation',
            description: 'Embalaje y etiquetado de producto terminado',
            department: 'Expedición',
        },
        {
            ...createEmptyStep(''),
            stepType: 'transport',
            description: 'Traslado a sector de almacenamiento',
        },

        // Almacenamiento final
        {
            ...createEmptyStep(''),
            stepType: 'storage',
            description: 'Almacenamiento: producto terminado (FIFO)',
            department: 'Almacén',
        },
    ];

    return { header, steps };
}

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
