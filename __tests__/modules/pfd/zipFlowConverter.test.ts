import { describe, it, expect } from 'vitest';
import {
    zipFlowToPfdSteps,
    zipHeaderToPfdHeader,
    type ZipNode,
} from '../../../modules/pfd/templates/zipFlowConverter';
import {
    loadZipTemplate,
    ZIP_TEMPLATES_META,
    type ZipTemplateId,
} from '../../../modules/pfd/templates';

describe('zipFlowConverter — converter unit tests', () => {
    it('produces 2 steps with second one having rejectDisposition=scrap for op + condition+terminal SCRAP', () => {
        const flow: ZipNode[] = [
            { stepId: '10', type: 'operation', description: 'OP UNO' },
            {
                type: 'condition',
                labelCondition: '¿OK?',
                labelDown: 'SI',
                branchSide: { labelNode: 'NO', type: 'terminal', text: 'SCRAP' },
            },
        ];

        const steps = zipFlowToPfdSteps(flow);
        expect(steps).toHaveLength(2);
        expect(steps[0].stepType).toBe('operation');
        expect(steps[0].stepNumber).toBe('OP 10');
        expect(steps[0].description).toBe('OP UNO');
        expect(steps[1].stepType).toBe('decision');
        expect(steps[1].rejectDisposition).toBe('scrap');
        expect(steps[1].scrapDescription).toBe('SCRAP');
    });

    it('maps zip types to PfdStep types correctly', () => {
        const flow: ZipNode[] = [
            { type: 'operation', description: 'A' },
            { type: 'op-ins', description: 'B' },
            { type: 'transfer', description: 'C' },
            { type: 'storage', description: 'D' },
            { type: 'inspection', description: 'E' },
        ];
        const steps = zipFlowToPfdSteps(flow);
        expect(steps[0].stepType).toBe('operation');
        expect(steps[1].stepType).toBe('combined');
        expect(steps[2].stepType).toBe('transport');
        expect(steps[3].stepType).toBe('storage');
        expect(steps[4].stepType).toBe('inspection');
    });

    it('handles rework metadata on a transfer node', () => {
        const flow: ZipNode[] = [
            { type: 'transfer', description: 'BACK', rework: { targetId: '80', label: 'RETRABAJO (A OP. 80)' } },
        ];
        const steps = zipFlowToPfdSteps(flow);
        expect(steps).toHaveLength(1);
        expect(steps[0].isRework).toBe(true);
        expect(steps[0].reworkReturnStep).toBe('OP 80');
        expect(steps[0].rejectDisposition).toBe('rework');
        expect(steps[0].notes).toContain('RETRABAJO');
    });

    it('flattens parallel branches with branchId A and B', () => {
        const flow: ZipNode[] = [
            {
                branches: [
                    [
                        { stepId: '20', type: 'operation', description: 'A1' },
                        { stepId: '21', type: 'operation', description: 'A2' },
                    ],
                    [
                        { stepId: '30', type: 'operation', description: 'B1' },
                    ],
                ],
            },
        ];
        const steps = zipFlowToPfdSteps(flow);
        expect(steps).toHaveLength(3);
        expect(steps[0].branchId).toBe('A');
        expect(steps[1].branchId).toBe('A');
        expect(steps[2].branchId).toBe('B');
    });

    it('annotates incomingConnector in notes', () => {
        const flow: ZipNode[] = [
            { stepId: '70', type: 'operation', description: 'ADHESIVADO', incomingConnector: 'A' },
        ];
        const steps = zipFlowToPfdSteps(flow);
        expect(steps[0].notes).toContain('Recibe conector A');
    });
});

describe('zipFlowConverter — header converter', () => {
    it('maps zip header fields to PfdHeader correctly', () => {
        const header = {
            title: 'FLUJOGRAMA DE PROCESO X',
            documentCode: 'P-X-001/PRE',
            revision: 'PRELIMINAR',
            date: '24/04/2026',
            preparedBy: 'FACUNDO SANTORO',
            reviewedBy: 'CARLOS BAPTISTA',
            project: 'PROYECTO X',
            client: 'VWA',
        };
        const products = [
            { code: 'CODE-001', level: 'L1', description: 'D', version: 'V' },
            { code: 'CODE-002', level: 'L2', description: 'D2', version: 'V2' },
        ];
        const out = zipHeaderToPfdHeader(header, products);
        expect(out.partName).toBe('FLUJOGRAMA DE PROCESO X');
        expect(out.documentNumber).toBe('P-X-001/PRE');
        expect(out.partNumber).toBe('CODE-001');
        expect(out.applicableParts).toBe('CODE-001 / CODE-002');
        expect(out.customerName).toBe('VWA');
        expect(out.preparedBy).toBe('FACUNDO SANTORO');
        expect(out.approvedBy).toBe('CARLOS BAPTISTA');
        expect(out.companyName).toBe('Barack Mercosul');
        expect(out.processPhase).toBe('pre-launch');
        expect(out.revisionDate).toBe('2026-04-24');
    });

    it('returns empty defaults when header is undefined', () => {
        const out = zipHeaderToPfdHeader(undefined, undefined);
        expect(out.partName).toBe('');
        expect(out.companyName).toBe('Barack Mercosul');
        expect(out.applicableParts).toBe('');
    });
});

describe('zipFlowConverter — full templates load', () => {
    const ids: ZipTemplateId[] = ['inyeccion', 'apoyacabezas', 'ippad', 'armrest', 'base'];

    it.each(ids)('template %s loads without throwing and produces non-empty steps', (id) => {
        expect(() => loadZipTemplate(id)).not.toThrow();
        const result = loadZipTemplate(id);
        expect(result.steps.length).toBeGreaterThan(0);
        expect(result.header).toBeDefined();
    });

    it('inyeccion has at least 1 step with stepType=operation', () => {
        const { steps } = loadZipTemplate('inyeccion');
        expect(steps.some((s) => s.stepType === 'operation')).toBe(true);
    });

    it('apoyacabezas has at least 1 step with stepType=decision', () => {
        const { steps } = loadZipTemplate('apoyacabezas');
        expect(steps.some((s) => s.stepType === 'decision')).toBe(true);
    });

    it('ippad has at least 2 steps with distinct branchId (parallel branches)', () => {
        const { steps } = loadZipTemplate('ippad');
        const branchIds = new Set(steps.map((s) => s.branchId).filter(Boolean));
        expect(branchIds.size).toBeGreaterThanOrEqual(2);
    });

    it('armrest has at least 2 steps with distinct branchId (parallel branches)', () => {
        const { steps } = loadZipTemplate('armrest');
        const branchIds = new Set(steps.map((s) => s.branchId).filter(Boolean));
        expect(branchIds.size).toBeGreaterThanOrEqual(2);
    });

    it('base has at least 1 step with isRework=true', () => {
        const { steps } = loadZipTemplate('base');
        expect(steps.some((s) => s.isRework)).toBe(true);
    });

    it('ZIP_TEMPLATES_META has entries for all 5 ids with positive stepCount', () => {
        expect(ZIP_TEMPLATES_META).toHaveLength(5);
        for (const meta of ZIP_TEMPLATES_META) {
            expect(meta.stepCount).toBeGreaterThan(0);
        }
    });
});
