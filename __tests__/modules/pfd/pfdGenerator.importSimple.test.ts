/**
 * Tests for importPfdOpsFromAmfe — simplified PFD import from AMFE document.
 *
 * Only imports operation numbers + descriptions; everything else empty for manual filling.
 */
import { describe, it, expect, vi } from 'vitest';
import { importPfdOpsFromAmfe } from '../../../modules/pfd/pfdGenerator';
import type { AmfeDocument, AmfeOperation } from '../../../modules/amfe/amfeTypes';

// Stable UUID for snapshot-free assertions
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-123' });

// ============================================================================
// HELPERS
// ============================================================================

function makeOperation(overrides: Partial<AmfeOperation> = {}): AmfeOperation {
    return {
        id: `op-${overrides.opNumber || 'default'}`,
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
            scope: '',
            applicableParts: '',
        },
        operations,
    };
}

// ============================================================================
// TESTS
// ============================================================================

describe('importPfdOpsFromAmfe', () => {
    it('returns empty steps with warning when AMFE has no operations', () => {
        const result = importPfdOpsFromAmfe(makeAmfeDoc([]), 'Proyecto Test');

        expect(result.document.steps).toHaveLength(0);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('no tiene operaciones definidas');
    });

    it('creates one step for a single AMFE operation', () => {
        const op = makeOperation({ id: 'op-1', opNumber: '10', name: 'Soldadura MIG' });
        const result = importPfdOpsFromAmfe(makeAmfeDoc([op]), 'Proyecto Test');

        expect(result.document.steps).toHaveLength(1);
        expect(result.document.steps[0].stepNumber).toBe('OP 10');
        expect(result.document.steps[0].description).toBe('Soldadura MIG');
    });

    it('creates correct count and order for multiple operations', () => {
        const ops = [
            makeOperation({ id: 'op-1', opNumber: '10', name: 'Corte' }),
            makeOperation({ id: 'op-2', opNumber: '20', name: 'Soldadura' }),
            makeOperation({ id: 'op-3', opNumber: '30', name: 'Inspección' }),
        ];
        const result = importPfdOpsFromAmfe(makeAmfeDoc(ops), 'Proyecto Test');

        expect(result.document.steps).toHaveLength(3);
        expect(result.document.steps[0].description).toBe('Corte');
        expect(result.document.steps[1].description).toBe('Soldadura');
        expect(result.document.steps[2].description).toBe('Inspección');
    });

    it('uses fallback description when operation name is empty', () => {
        const op = makeOperation({ id: 'op-1', opNumber: '10', name: '' });
        const result = importPfdOpsFromAmfe(makeAmfeDoc([op]), 'Proyecto Test');

        expect(result.document.steps[0].description).toBe('Operación 10');
    });

    it('uses "OP ??" when operation opNumber is empty', () => {
        const op = makeOperation({ id: 'op-1', opNumber: '', name: 'Soldadura' });
        const result = importPfdOpsFromAmfe(makeAmfeDoc([op]), 'Proyecto Test');

        expect(result.document.steps[0].stepNumber).toBe('OP ??');
    });

    it('sets all steps to stepType "operation"', () => {
        const ops = [
            makeOperation({ id: 'op-1', opNumber: '10', name: 'Inspección visual' }),
            makeOperation({ id: 'op-2', opNumber: '20', name: 'Almacenamiento' }),
        ];
        const result = importPfdOpsFromAmfe(makeAmfeDoc(ops), 'Proyecto Test');

        for (const step of result.document.steps) {
            expect(step.stepType).toBe('operation');
        }
    });

    it('leaves machineDeviceTool empty for all steps', () => {
        const ops = [
            makeOperation({ id: 'op-1', opNumber: '10', name: 'Soldadura MIG' }),
            makeOperation({ id: 'op-2', opNumber: '20', name: 'Mecanizado CNC' }),
        ];
        const result = importPfdOpsFromAmfe(makeAmfeDoc(ops), 'Proyecto Test');

        for (const step of result.document.steps) {
            expect(step.machineDeviceTool).toBe('');
        }
    });

    it('sets "none" for productSpecialChar and processSpecialChar', () => {
        const op = makeOperation({ id: 'op-1', opNumber: '10', name: 'Soldadura' });
        const result = importPfdOpsFromAmfe(makeAmfeDoc([op]), 'Proyecto Test');

        expect(result.document.steps[0].productSpecialChar).toBe('none');
        expect(result.document.steps[0].processSpecialChar).toBe('none');
    });

    it('populates header from AMFE header data', () => {
        const result = importPfdOpsFromAmfe(makeAmfeDoc([
            makeOperation({ id: 'op-1' }),
        ]), 'Proyecto Test');

        const header = result.document.header;
        expect(header.partNumber).toBe('P-12345');
        expect(header.partName).toBe('Pieza Test');
        expect(header.customerName).toBe('VWA');
        expect(header.companyName).toBe('Barack Mercosul');
        expect(header.linkedAmfeId).toBe('Proyecto Test');
    });

    it('sets linkedAmfeOperationId correctly for each step', () => {
        const ops = [
            makeOperation({ id: 'alpha-id', opNumber: '10', name: 'Op A' }),
            makeOperation({ id: 'beta-id', opNumber: '20', name: 'Op B' }),
        ];
        const result = importPfdOpsFromAmfe(makeAmfeDoc(ops), 'Proyecto Test');

        expect(result.document.steps[0].linkedAmfeOperationId).toBe('alpha-id');
        expect(result.document.steps[1].linkedAmfeOperationId).toBe('beta-id');
    });

    it('includes summary warning with import count', () => {
        const ops = [
            makeOperation({ id: 'op-1', opNumber: '10', name: 'Op A' }),
            makeOperation({ id: 'op-2', opNumber: '20', name: 'Op B' }),
        ];
        const result = importPfdOpsFromAmfe(makeAmfeDoc(ops), 'Proyecto Test');

        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('Importadas 2 operaciones del AMFE');
        expect(result.warnings[0]).toContain('Completá manualmente');
    });
});
