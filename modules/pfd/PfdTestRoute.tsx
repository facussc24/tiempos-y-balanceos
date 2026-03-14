/**
 * PFD Test Route — Temporary route for testing PFD exports and visuals
 *
 * Loads PfdApp with pre-populated sample data representing a realistic
 * Barack Mercosul manufacturing process (headrest production).
 * Includes parallel flows, rework, scrap, CC/SC, and all 7 step types.
 *
 * TEMPORARY: Remove this file + AppRouter entry when testing is complete.
 */

import React, { useMemo } from 'react';
import PfdApp from './PfdApp';
import type { PfdDocument, PfdStep } from './pfdTypes';
import { createEmptyStep } from './pfdTypes';

interface Props {
    onBackToLanding?: () => void;
}

/** Build sample data: headrest manufacturing process */
function createSamplePfdDocument(): PfdDocument {
    const steps: PfdStep[] = [
        // 1. Receiving
        {
            ...createEmptyStep('REC'),
            stepType: 'storage',
            description: 'Recepción e inspección de materia prima',
            department: 'Almacén',
            notes: 'Tela, espuma PU, alambre, estructura metálica',
            machineDeviceTool: 'Balanza / Calibre',
        },
        // 2. Transport to production
        {
            ...createEmptyStep(''),
            stepType: 'transport',
            description: 'Transporte a líneas de producción',
            department: 'Logística interna',
        },
        // 3. Fabric cutting (operation)
        {
            ...createEmptyStep('OP 10'),
            stepType: 'operation',
            description: 'Corte de tela y material textil',
            machineDeviceTool: 'Cortadora automática CNC',
            productCharacteristic: 'Dimensiones de corte',
            productSpecialChar: 'none',
            processCharacteristic: 'Velocidad de corte',
            processSpecialChar: 'none',
            department: 'Corte',
            reference: 'IT-COR-001',
            cycleTimeMinutes: 2.5,
        },
        // 4. Sewing (operation, CC)
        {
            ...createEmptyStep('OP 20'),
            stepType: 'operation',
            description: 'Costura de funda de apoyacabezas',
            machineDeviceTool: 'Máquina de costura industrial',
            productCharacteristic: 'Resistencia de costura',
            productSpecialChar: 'CC',
            processCharacteristic: 'Tensión de hilo',
            processSpecialChar: 'SC',
            department: 'Costura',
            reference: 'IT-COS-002',
            cycleTimeMinutes: 4,
            linkedAmfeOperationId: 'AMFE-OP-020',
            linkedCpItemIds: ['CP-020-01', 'CP-020-02'],
        },
        // 5. Visual inspection (inspection, rework → OP 20)
        {
            ...createEmptyStep('OP 30'),
            stepType: 'inspection',
            description: 'Inspección visual de costura',
            machineDeviceTool: 'Lupa / Iluminación LED',
            productCharacteristic: 'Aspecto visual, costuras uniformes',
            productSpecialChar: 'SC',
            department: 'Calidad',
            reference: 'PE-INS-003',
            rejectDisposition: 'rework',
            reworkReturnStep: 'OP 20',
            isRework: true,
            notes: 'Rechazar fundas con costuras irregulares o hilos sueltos',
            cycleTimeMinutes: 1.5,
        },
        // 6. Transport to injection
        {
            ...createEmptyStep(''),
            stepType: 'transport',
            description: 'Transporte a sector de inyección',
            department: 'Logística interna',
        },
        // 7. PU Injection (operation, SC) — Branch A
        {
            ...createEmptyStep('OP 40'),
            stepType: 'operation',
            description: 'Inyección de poliuretano (espuma)',
            machineDeviceTool: 'Inyectora PU Cannon A-200',
            productCharacteristic: 'Densidad de espuma',
            productSpecialChar: 'SC',
            processCharacteristic: 'Temperatura molde / Presión inyección',
            processSpecialChar: 'CC',
            department: 'Inyección PU',
            reference: 'IT-INY-004',
            branchId: 'A',
            branchLabel: 'Espuma PU',
            cycleTimeMinutes: 6,
            linkedAmfeOperationId: 'AMFE-OP-040',
            linkedCpItemIds: ['CP-040-01'],
        },
        // 8. Foam curing delay — Branch A
        {
            ...createEmptyStep('OP 45'),
            stepType: 'delay',
            description: 'Curado de espuma (tiempo de reposo)',
            department: 'Inyección PU',
            notes: 'Mínimo 15 minutos a temperatura ambiente',
            branchId: 'A',
            branchLabel: 'Espuma PU',
            cycleTimeMinutes: 15,
        },
        // 9. Wire bending (operation) — Branch B
        {
            ...createEmptyStep('OP 50'),
            stepType: 'operation',
            description: 'Doblado de alambre / estructura metálica',
            machineDeviceTool: 'Dobladora CNC',
            productCharacteristic: 'Ángulo de doblado, longitud',
            productSpecialChar: 'CC',
            processCharacteristic: 'Fuerza de doblado',
            processSpecialChar: 'none',
            department: 'Metálicos',
            reference: 'IT-MET-005',
            branchId: 'B',
            branchLabel: 'Estructura metálica',
            cycleTimeMinutes: 3,
            linkedAmfeOperationId: 'AMFE-OP-050',
            linkedCpItemIds: ['CP-050-01'],
        },
        // 10. Welding inspection (combined, scrap) — Branch B
        {
            ...createEmptyStep('OP 55'),
            stepType: 'combined',
            description: 'Soldadura ultrasónica + inspección',
            machineDeviceTool: 'Soldadora ultrasónica Branson',
            productCharacteristic: 'Resistencia de soldadura',
            productSpecialChar: 'CC',
            processCharacteristic: 'Frecuencia / Amplitud US',
            processSpecialChar: 'SC',
            department: 'Metálicos',
            reference: 'IT-SOL-006',
            branchId: 'B',
            branchLabel: 'Estructura metálica',
            rejectDisposition: 'scrap',
            scrapDescription: 'Soldadura defectuosa irreparable — descartar pieza',
            cycleTimeMinutes: 2,
        },
        // 11. Assembly (operation) — Convergence
        {
            ...createEmptyStep('OP 60'),
            stepType: 'operation',
            description: 'Ensamble de apoyacabezas (espuma + estructura + funda)',
            machineDeviceTool: 'Dispositivo de ensamble manual',
            productCharacteristic: 'Ajuste correcto de componentes',
            productSpecialChar: 'SC',
            department: 'Ensamble',
            reference: 'IT-ENS-007',
            cycleTimeMinutes: 5,
        },
        // 12. Decision gate
        {
            ...createEmptyStep('OP 65'),
            stepType: 'decision',
            description: 'Clasificación por modelo / destino',
            department: 'Ensamble',
            notes: 'Separar por modelo de vehículo y cliente destino',
        },
        // 13. Final inspection (inspection, sort)
        {
            ...createEmptyStep('OP 70'),
            stepType: 'inspection',
            description: 'Inspección final y liberación',
            machineDeviceTool: 'Calibre dimensional / Torquímetro',
            productCharacteristic: 'Dimensiones generales, fuerza de extracción',
            productSpecialChar: 'CC',
            processCharacteristic: 'Método de medición',
            processSpecialChar: 'none',
            department: 'Calidad',
            reference: 'PE-INS-008',
            rejectDisposition: 'sort',
            scrapDescription: 'Seleccionar piezas con desviación dimensional — re-inspeccionar 100%',
            notes: 'Inspección según plan de control vigente',
            cycleTimeMinutes: 3,
            linkedAmfeOperationId: 'AMFE-OP-070',
            linkedCpItemIds: ['CP-070-01', 'CP-070-02', 'CP-070-03'],
        },
        // 14. Transport to packaging
        {
            ...createEmptyStep(''),
            stepType: 'transport',
            description: 'Transporte a embalaje',
            department: 'Expedición',
        },
        // 15. Packaging
        {
            ...createEmptyStep('OP 80'),
            stepType: 'operation',
            description: 'Embalaje e identificación',
            machineDeviceTool: 'Embaladora / Etiquetadora',
            department: 'Expedición',
            reference: 'IT-EMB-009',
            cycleTimeMinutes: 2,
        },
        // 16. Shipping storage
        {
            ...createEmptyStep('ENV'),
            stepType: 'storage',
            description: 'Almacenamiento y envío al cliente',
            department: 'Expedición',
            notes: 'FIFO — máximo 5 días de stock',
        },
    ];

    return {
        id: 'pfd-test-sample-001',
        header: {
            partNumber: 'ZAC-APY-001',
            partName: 'Apoyacabezas Delantero ZAC',
            engineeringChangeLevel: 'Rev. B',
            modelYear: '2025',
            documentNumber: 'PFD-ZAC-001',
            revisionLevel: 'B',
            revisionDate: '2025-11-15',
            companyName: 'Barack Mercosul',
            plantLocation: 'Hurlingham, Buenos Aires',
            supplierCode: 'BM-7842',
            customerName: 'Stellantis Argentina',
            coreTeam: 'Ing. Pérez, Ing. González, Tec. Rodríguez',
            keyContact: 'Ing. Pérez',
            processPhase: 'production',
            preparedBy: 'Ing. M. Pérez',
            preparedDate: '2025-10-01',
            approvedBy: 'Ing. L. González',
            approvedDate: '2025-11-15',
            applicableParts: 'ZAC-APY-001, ZAC-APY-002 (variantes conductor/acompañante)',
            linkedAmfeId: 'AMFE-ZAC-001 Rev.B',
            linkedCpId: 'CP-ZAC-001 Rev.B',
        },
        steps,
        createdAt: '2025-10-01T10:00:00Z',
        updatedAt: '2025-11-15T14:30:00Z',
    };
}

const PfdTestRoute: React.FC<Props> = ({ onBackToLanding }) => {
    const sampleData = useMemo(() => createSamplePfdDocument(), []);

    return (
        <div>
            {/* Test banner */}
            <div className="bg-amber-50 border-b-2 border-amber-300 px-4 py-2 flex items-center justify-between no-print">
                <div className="flex items-center gap-3">
                    <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">TEST</span>
                    <span className="text-xs text-amber-800 font-medium">
                        Ruta temporal de pruebas — Datos de ejemplo: Apoyacabezas ZAC-001
                    </span>
                    <span className="text-[10px] text-amber-600">
                        16 pasos · 2 branches · rework · scrap · sort · CC/SC · 7 tipos de símbolo
                    </span>
                </div>
                {onBackToLanding && (
                    <button
                        onClick={onBackToLanding}
                        className="text-xs text-amber-700 hover:text-amber-900 font-medium px-3 py-1 rounded hover:bg-amber-100 transition"
                    >
                        ← Volver al inicio
                    </button>
                )}
            </div>

            {/* PfdApp with sample data */}
            <PfdApp
                onBackToLanding={onBackToLanding}
                initialData={sampleData}
            />
        </div>
    );
};

export default PfdTestRoute;
