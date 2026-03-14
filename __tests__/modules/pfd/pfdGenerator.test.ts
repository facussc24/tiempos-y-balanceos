/**
 * Tests for pfdGenerator — auto-generation of PFD from AMFE document.
 *
 * Covers: basic generation, step type inference, header propagation,
 * data extraction, transport steps, edge cases, and full document structure.
 */
import { describe, it, expect } from 'vitest';
import {
    generatePfdFromAmfe,
    inferStepType,
    PfdGenerationResult,
} from '../../../modules/pfd/pfdGenerator';
import type { AmfeDocument, AmfeOperation, AmfeWorkElement, AmfeFunction, AmfeFailure, AmfeCause } from '../../../modules/amfe/amfeTypes';

// ============================================================================
// HELPERS
// ============================================================================

function makeCause(overrides: Partial<AmfeCause> = {}): AmfeCause {
    return {
        id: crypto.randomUUID(),
        cause: '', preventionControl: '', detectionControl: '',
        occurrence: '', detection: '', ap: '',
        characteristicNumber: '', specialChar: '', filterCode: '',
        preventionAction: '', detectionAction: '',
        responsible: '', targetDate: '', status: '',
        actionTaken: '', completionDate: '',
        severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
        observations: '',
        ...overrides,
    };
}

function makeFailure(overrides: Partial<AmfeFailure> = {}): AmfeFailure {
    return {
        id: crypto.randomUUID(),
        description: '',
        effectLocal: '', effectNextLevel: '', effectEndUser: '',
        severity: 5,
        causes: [],
        ...overrides,
    };
}

function makeWorkElement(overrides: Partial<AmfeWorkElement> = {}): AmfeWorkElement {
    return {
        id: crypto.randomUUID(),
        type: 'Machine',
        name: '',
        functions: [],
        ...overrides,
    };
}

function makeOperation(overrides: Partial<AmfeOperation> = {}): AmfeOperation {
    return {
        id: crypto.randomUUID(),
        opNumber: '10',
        name: 'Operación genérica',
        workElements: [],
        ...overrides,
    };
}

function makeAmfeDoc(operations: AmfeOperation[] = []): AmfeDocument {
    return {
        header: {
            organization: 'Barack Mercosul',
            location: 'Hurlingham',
            client: 'VWA',
            modelYear: '2026',
            subject: 'Pieza Test',
            startDate: '2026-01-01',
            revDate: '2026-03-01',
            team: 'Equipo Calidad',
            amfeNumber: 'AMFE-001',
            responsible: 'Juan Pérez',
            confidentiality: 'Interno',
            partNumber: 'P-12345',
            processResponsible: 'Carlos García',
            revision: 'A',
            approvedBy: 'Director Calidad',
        },
        operations,
    } as AmfeDocument;
}

// ============================================================================
// STEP TYPE INFERENCE
// ============================================================================

describe('inferStepType', () => {
    it('returns "operation" for soldadura', () => {
        expect(inferStepType('Soldadura MIG')).toBe('operation');
    });

    it('returns "inspection" for inspección', () => {
        expect(inferStepType('Inspección dimensional')).toBe('inspection');
    });

    it('returns "inspection" for verificación', () => {
        expect(inferStepType('Verificación visual')).toBe('inspection');
    });

    it('returns "transport" for transporte', () => {
        expect(inferStepType('Transporte a línea')).toBe('transport');
    });

    it('returns "storage" for almacenamiento', () => {
        expect(inferStepType('Almacenamiento MP')).toBe('storage');
    });

    it('returns "storage" for recepción', () => {
        expect(inferStepType('Recepción de material')).toBe('storage');
    });

    it('returns "delay" for secado', () => {
        expect(inferStepType('Secado en horno')).toBe('delay');
    });

    it('returns "delay" for espera', () => {
        expect(inferStepType('Espera de enfriamiento')).toBe('delay');
    });

    it('returns "decision" for selección', () => {
        expect(inferStepType('Selección de componentes')).toBe('decision');
    });

    it('returns "combined" for operation + inspection', () => {
        expect(inferStepType('Soldadura con inspección inline')).toBe('combined');
    });

    it('returns "operation" for empty name', () => {
        expect(inferStepType('')).toBe('operation');
    });

    it('returns "operation" for generic names', () => {
        expect(inferStepType('Prensado de chapa')).toBe('operation');
    });

    // Enhanced inspection patterns (new Spanish patterns)
    it('returns "inspection" for "Control por Mylar"', () => {
        expect(inferStepType('Control por Mylar')).toBe('inspection');
    });

    it('returns "inspection" for "Control de torque"', () => {
        expect(inferStepType('Control de torque')).toBe('inspection');
    });

    it('returns "inspection" for "Control con galga"', () => {
        expect(inferStepType('Control con galga')).toBe('inspection');
    });

    it('returns "inspection" for "Prueba de fuga"', () => {
        expect(inferStepType('Prueba de fuga')).toBe('inspection');
    });

    it('returns "inspection" for "Prueba de estanqueidad"', () => {
        expect(inferStepType('Prueba de estanqueidad')).toBe('inspection');
    });

    it('returns "inspection" for galga tool name', () => {
        expect(inferStepType('Galga pasa/no pasa')).toBe('inspection');
    });

    it('returns "inspection" for mylar tool name', () => {
        expect(inferStepType('Mylar de verificación')).toBe('inspection');
    });

    it('returns "inspection" for "Auditoría de proceso"', () => {
        expect(inferStepType('Auditoría de proceso')).toBe('inspection');
    });

    it('returns "inspection" for "Muestreo estadístico"', () => {
        expect(inferStepType('Muestreo estadístico')).toBe('inspection');
    });

    it('returns "inspection" for "Control visual"', () => {
        expect(inferStepType('Control visual')).toBe('inspection');
    });

    it('returns "inspection" for "Control dimensional"', () => {
        expect(inferStepType('Control dimensional')).toBe('inspection');
    });

    it('returns "combined" for soldadura + prueba', () => {
        expect(inferStepType('Soldadura con prueba de fuga')).toBe('combined');
    });
});

// ============================================================================
// BASIC GENERATION
// ============================================================================

describe('generatePfdFromAmfe — basic generation', () => {
    it('generates bookend storage steps (receiving + shipping)', () => {
        const ops = [makeOperation({ name: 'Corte', opNumber: '10' })];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test');

        const steps = result.document.steps;
        expect(steps[0].stepType).toBe('storage');
        expect(steps[0].description).toContain('Recepción');
        expect(steps[steps.length - 1].stepType).toBe('storage');
        expect(steps[steps.length - 1].description).toContain('envío al cliente');
    });

    it('generates one PFD step per AMFE operation', () => {
        const ops = [
            makeOperation({ name: 'Corte', opNumber: '10', id: 'op1' }),
            makeOperation({ name: 'Soldadura', opNumber: '20', id: 'op2' }),
            makeOperation({ name: 'Inspección final', opNumber: '30', id: 'op3' }),
        ];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'none' });

        // 3 operations + 2 bookends = 5
        const opSteps = result.document.steps.filter(s => s.linkedAmfeOperationId);
        expect(opSteps).toHaveLength(3);
    });

    it('preserves linkedAmfeOperationId for traceability', () => {
        const ops = [
            makeOperation({ name: 'Corte', id: 'my-op-id' }),
        ];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'none' });

        const linked = result.document.steps.find(s => s.linkedAmfeOperationId === 'my-op-id');
        expect(linked).toBeDefined();
        expect(linked!.description).toBe('Corte');
    });

    it('returns warning when AMFE has no operations', () => {
        const result = generatePfdFromAmfe(makeAmfeDoc([]), 'Test');

        expect(result.document.steps).toHaveLength(0);
        expect(result.warnings.some(w => w.includes('no tiene operaciones'))).toBe(true);
    });

    it('generates unique IDs for all steps', () => {
        const ops = [
            makeOperation({ name: 'Corte' }),
            makeOperation({ name: 'Soldadura' }),
            makeOperation({ name: 'Inspección' }),
        ];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test');

        const ids = result.document.steps.map(s => s.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
    });

    it('produces a summary warning with step counts', () => {
        const ops = [
            makeOperation({ name: 'Corte' }),
            makeOperation({ name: 'Soldadura' }),
        ];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test');

        const summary = result.warnings.find(w => w.includes('Flujograma generado'));
        expect(summary).toBeDefined();
        expect(summary).toContain('2 operaciones');
    });
});

// ============================================================================
// HEADER PROPAGATION
// ============================================================================

describe('generatePfdFromAmfe — header propagation', () => {
    const ops = [makeOperation({ name: 'Test op' })];

    it('copies partNumber from AMFE header', () => {
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test');
        expect(result.document.header.partNumber).toBe('P-12345');
    });

    it('copies partName from AMFE subject', () => {
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test');
        expect(result.document.header.partName).toBe('Pieza Test');
    });

    it('copies customerName from AMFE client', () => {
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test');
        expect(result.document.header.customerName).toBe('VWA');
    });

    it('copies coreTeam from AMFE team', () => {
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test');
        expect(result.document.header.coreTeam).toBe('Equipo Calidad');
    });

    it('sets linkedAmfeId to project name', () => {
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'INSERTO');
        expect(result.document.header.linkedAmfeId).toBe('INSERTO');
    });

    it('sets revisionDate to today', () => {
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test');
        const today = new Date().toISOString().split('T')[0];
        expect(result.document.header.revisionDate).toBe(today);
    });
});

// ============================================================================
// DATA EXTRACTION
// ============================================================================

describe('generatePfdFromAmfe — data extraction', () => {
    it('extracts machineDeviceTool from Machine work element', () => {
        const ops = [
            makeOperation({
                name: 'Corte',
                workElements: [
                    makeWorkElement({ type: 'Machine', name: 'Cizalla hidráulica' }),
                    makeWorkElement({ type: 'Man', name: 'Operario' }),
                ],
            }),
        ];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'none' });

        const step = result.document.steps.find(s => s.linkedAmfeOperationId);
        expect(step!.machineDeviceTool).toBe('Cizalla hidráulica');
    });

    it('leaves machineDeviceTool empty when no Machine WE exists', () => {
        const ops = [
            makeOperation({
                name: 'Manual assembly',
                workElements: [
                    makeWorkElement({ type: 'Man', name: 'Operario' }),
                ],
            }),
        ];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'none' });

        const step = result.document.steps.find(s => s.linkedAmfeOperationId);
        expect(step!.machineDeviceTool).toBe('');
    });

    it('sets productSpecialChar to CC when severity >= 9', () => {
        const ops = [
            makeOperation({
                name: 'Torque crítico',
                workElements: [
                    makeWorkElement({
                        type: 'Machine',
                        name: 'Torquímetro',
                        functions: [{
                            id: 'f1',
                            description: 'Aplicar torque',
                            requirements: '',
                            failures: [makeFailure({ severity: 9, description: 'Torque incorrecto' })],
                        }],
                    }),
                ],
            }),
        ];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'none' });

        const step = result.document.steps.find(s => s.linkedAmfeOperationId);
        expect(step!.productSpecialChar).toBe('CC');
    });

    it('sets processSpecialChar from cause specialChar', () => {
        const ops = [
            makeOperation({
                name: 'Soldadura',
                workElements: [
                    makeWorkElement({
                        type: 'Machine',
                        name: 'Robot',
                        functions: [{
                            id: 'f1',
                            description: 'Soldar',
                            requirements: '',
                            failures: [makeFailure({
                                severity: 5,
                                causes: [makeCause({ specialChar: 'SC' })],
                            })],
                        }],
                    }),
                ],
            }),
        ];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'none' });

        const step = result.document.steps.find(s => s.linkedAmfeOperationId);
        expect(step!.processSpecialChar).toBe('SC');
    });

    it('warns when operation has no work elements', () => {
        const ops = [makeOperation({ name: 'Incompleta', workElements: [] })];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test');

        expect(result.warnings.some(w => w.includes('no tiene elementos de trabajo'))).toBe(true);
    });
});

// ============================================================================
// TRANSPORT STEPS
// ============================================================================

describe('generatePfdFromAmfe — transport steps', () => {
    it('inserts transport steps between operations when transportMode=all', () => {
        const ops = [
            makeOperation({ name: 'Corte', opNumber: '10' }),
            makeOperation({ name: 'Soldadura', opNumber: '20' }),
        ];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'all' });

        const transportSteps = result.document.steps.filter(s => s.stepType === 'transport');
        // 2 before operations + 1 to shipping = 3
        expect(transportSteps.length).toBe(3);
    });

    it('does not insert transport steps when transportMode=none', () => {
        const ops = [
            makeOperation({ name: 'Corte', opNumber: '10' }),
            makeOperation({ name: 'Soldadura', opNumber: '20' }),
        ];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'none' });

        const transportSteps = result.document.steps.filter(s => s.stepType === 'transport');
        expect(transportSteps.length).toBe(0);
    });

    it('transport descriptions reference the destination operation', () => {
        const ops = [makeOperation({ name: 'Mecanizado CNC', opNumber: '10' })];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'all' });

        const transport = result.document.steps.find(s =>
            s.stepType === 'transport' && s.description.includes('Mecanizado CNC')
        );
        expect(transport).toBeDefined();
        expect(transport!.description).toBe('Transporte a Mecanizado CNC');
    });

    it('transport to shipping is present at the end', () => {
        const ops = [makeOperation({ name: 'Corte' })];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'all' });

        const steps = result.document.steps;
        const lastTransport = [...steps].reverse().find(s => s.stepType === 'transport');
        expect(lastTransport).toBeDefined();
        expect(lastTransport!.description).toContain('almacenamiento');
    });
});

// ============================================================================
// FULL DOCUMENT
// ============================================================================

describe('generatePfdFromAmfe — full document structure', () => {
    it('returns complete PfdDocument with header and steps', () => {
        const ops = [makeOperation({ name: 'Corte' })];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'PATAGONIA');

        expect(result.document.id).toBeTruthy();
        expect(result.document.header).toBeDefined();
        expect(result.document.header.partNumber).toBe('P-12345');
        expect(result.document.steps.length).toBeGreaterThan(0);
        expect(result.document.createdAt).toBeTruthy();
        expect(result.document.updatedAt).toBeTruthy();
    });

    it('has valid ISO timestamps', () => {
        const ops = [makeOperation({ name: 'Corte' })];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test');

        expect(new Date(result.document.createdAt).getTime()).not.toBeNaN();
        expect(new Date(result.document.updatedAt).getTime()).not.toBeNaN();
    });

    it('operation step numbers preserve AMFE opNumbers', () => {
        const ops = [
            makeOperation({ name: 'Corte', opNumber: '10' }),
            makeOperation({ name: 'Soldadura', opNumber: '20' }),
        ];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'none' });

        const opSteps = result.document.steps.filter(s => s.linkedAmfeOperationId);
        expect(opSteps[0].stepNumber).toBe('OP 10');
        expect(opSteps[1].stepNumber).toBe('OP 20');
    });

    it('bookend steps use REC and ENV identifiers', () => {
        const ops = [makeOperation({ name: 'Corte', opNumber: '10' })];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'none' });

        const steps = result.document.steps;
        expect(steps[0].stepNumber).toBe('REC');
        expect(steps[steps.length - 1].stepNumber).toBe('ENV');
    });

    it('transport steps have empty step numbers', () => {
        const ops = [makeOperation({ name: 'Corte', opNumber: '10' })];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'all' });

        const transportSteps = result.document.steps.filter(s => s.stepType === 'transport');
        expect(transportSteps.length).toBeGreaterThan(0);
        for (const t of transportSteps) {
            expect(t.stepNumber).toBe('');
        }
    });

    it('infers correct step types for mixed operations', () => {
        const ops = [
            makeOperation({ name: 'Corte de chapa' }),
            makeOperation({ name: 'Inspección dimensional' }),
            makeOperation({ name: 'Embalaje final' }),
        ];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'none' });

        const linked = result.document.steps.filter(s => s.linkedAmfeOperationId);
        expect(linked[0].stepType).toBe('operation');
        expect(linked[1].stepType).toBe('inspection');
        expect(linked[2].stepType).toBe('operation');
    });
});

// ============================================================================
// CROSS-SECTOR TRANSPORT (ASME Y15.3 / AIAG)
// ============================================================================

describe('generatePfdFromAmfe — cross-sector transport', () => {
    it('default mode is cross-sector (no options)', () => {
        // Corte→Soldadura are different sectors → transport should be inserted
        const ops = [
            makeOperation({ name: 'Corte de chapa', opNumber: '10' }),
            makeOperation({ name: 'Soldadura MIG', opNumber: '20' }),
        ];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test');

        const transportSteps = result.document.steps.filter(s => s.stepType === 'transport');
        // Almacén→Corte + Corte→Soldadura + Soldadura→Almacén = 3
        expect(transportSteps.length).toBe(3);
    });

    it('does NOT add transport between operations in the same sector', () => {
        // Two operations in the same sector (Soldadura)
        const ops = [
            makeOperation({ name: 'Soldadura MIG', opNumber: '10' }),
            makeOperation({ name: 'Soldadura por puntos', opNumber: '20' }),
        ];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'cross-sector' });

        const transportSteps = result.document.steps.filter(s => s.stepType === 'transport');
        // Almacén→Soldadura + Soldadura→Almacén = 2 (NO transport between the two soldadura ops)
        expect(transportSteps.length).toBe(2);
    });

    it('cross-sector transport description shows origin and destination sectors', () => {
        const ops = [
            makeOperation({ name: 'Corte de chapa', opNumber: '10' }),
            makeOperation({ name: 'Soldadura MIG', opNumber: '20' }),
        ];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'cross-sector' });

        const transportSteps = result.document.steps.filter(s => s.stepType === 'transport');
        expect(transportSteps.some(t => t.description === 'Transporte de Almacén a Corte')).toBe(true);
        expect(transportSteps.some(t => t.description === 'Transporte de Corte a Soldadura')).toBe(true);
        expect(transportSteps.some(t => t.description === 'Transporte de Soldadura a Almacén')).toBe(true);
    });

    it('auto-assigns department field from operation name', () => {
        const ops = [
            makeOperation({ name: 'Soldadura MIG', opNumber: '10' }),
            makeOperation({ name: 'Mecanizado CNC', opNumber: '20' }),
        ];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'none' });

        const linked = result.document.steps.filter(s => s.linkedAmfeOperationId);
        expect(linked[0].department).toBe('Soldadura');
        expect(linked[1].department).toBe('Mecanizado');
    });

    it('bookend steps have Almacén department', () => {
        const ops = [makeOperation({ name: 'Corte', opNumber: '10' })];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'none' });

        const steps = result.document.steps;
        expect(steps[0].department).toBe('Almacén');
        expect(steps[steps.length - 1].department).toBe('Almacén');
    });

    it('adhesivado in same sector as ensamble does NOT generate extra transport', () => {
        const ops = [
            makeOperation({ name: 'Ensamble de componentes', opNumber: '10' }),
            makeOperation({ name: 'Adhesivado de etiqueta', opNumber: '20' }),
            makeOperation({ name: 'Ensamble final', opNumber: '30' }),
        ];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'cross-sector' });

        const transportSteps = result.document.steps.filter(s => s.stepType === 'transport');
        // Almacén→Ensamble + Ensamble→Almacén = 2 (all three ops are in Ensamble)
        expect(transportSteps.length).toBe(2);
    });

    it('handles operations with unknown sector gracefully', () => {
        const ops = [
            makeOperation({ name: 'Proceso especial', opNumber: '10' }),
            makeOperation({ name: 'Soldadura MIG', opNumber: '20' }),
        ];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'cross-sector' });

        // "Proceso especial" has empty department → no cross-sector transport before it
        // But Soldadura has a department and Almacén is prevDepartment → transport added
        const linked = result.document.steps.filter(s => s.linkedAmfeOperationId);
        expect(linked[0].department).toBe('');
        expect(linked[1].department).toBe('Soldadura');
    });

    it('does NOT add final transport when last op is already in Almacén', () => {
        const ops = [
            makeOperation({ name: 'Corte de chapa', opNumber: '10' }),
            makeOperation({ name: 'Almacenamiento temporal', opNumber: '20' }),
        ];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'cross-sector' });

        // Last op is Almacén → no transport to shipping needed
        const steps = result.document.steps;
        const lastBeforeBookend = steps[steps.length - 2]; // step before ENV bookend
        // Should NOT be a transport step from Almacén to Almacén
        if (lastBeforeBookend.stepType === 'transport') {
            expect(lastBeforeBookend.description).not.toContain('de Almacén a Almacén');
        }
    });

    it('costura operations in sequence generate NO inter-operation transports', () => {
        const ops = [
            makeOperation({ name: 'Costura de funda', opNumber: '10' }),
            makeOperation({ name: 'Costura lateral', opNumber: '20' }),
            makeOperation({ name: 'Overlock de borde', opNumber: '30' }),
        ];
        const result = generatePfdFromAmfe(makeAmfeDoc(ops), 'Test', { transportMode: 'cross-sector' });

        const transportSteps = result.document.steps.filter(s => s.stepType === 'transport');
        // Almacén→Costura + Costura→Almacén = 2 (no intra-costura transports)
        expect(transportSteps.length).toBe(2);
        // All ops should have Costura department
        const linked = result.document.steps.filter(s => s.linkedAmfeOperationId);
        for (const step of linked) {
            expect(step.department).toBe('Costura');
        }
    });
});
