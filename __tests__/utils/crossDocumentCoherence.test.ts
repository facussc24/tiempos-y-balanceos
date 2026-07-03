/**
 * Tests for Cross-Document Coherence Check
 *
 * Verifies consistency checking between AMFE and CP documents.
 */

import { runCoherenceCheck } from '../../utils/crossDocumentCoherence';
import type { AmfeDocument, AmfeOperation } from '../../modules/amfe/amfeTypes';
import type { ControlPlanDocument, ControlPlanItem } from '../../modules/controlPlan/controlPlanTypes';

// ============================================================================
// FIXTURES
// ============================================================================

function makeAmfeDoc(operations: Partial<AmfeOperation>[]): AmfeDocument {
    return {
        header: {
            organization: '', location: '', client: '', modelYear: '',
            subject: '', startDate: '', revDate: '', team: '', amfeNumber: '',
            responsible: '', confidentiality: '', partNumber: '',
            processResponsible: '', revision: '', approvedBy: '', scope: '',
            applicableParts: '',
        },
        operations: operations.map((op, i) => ({
            id: op.id || `amfe-op-${i}`,
            opNumber: op.opNumber || `${(i + 1) * 10}`,
            name: op.name || `OPERACION ${(i + 1) * 10}`,
            workElements: op.workElements || [],
            ...op,
        })) as AmfeOperation[],
    };
}

function makeCpDoc(items: Partial<ControlPlanItem>[]): ControlPlanDocument {
    return {
        header: {
            controlPlanNumber: '', phase: 'production', partNumber: '',
            latestChangeLevel: '', partName: '', applicableParts: '',
            organization: '', supplier: '', supplierCode: '',
            keyContactPhone: '', date: '', revision: '', responsible: '',
            approvedBy: '', plantApproval: '', client: '', coreTeam: '',
            customerApproval: '', otherApproval: '', linkedAmfeProject: '',
        },
        items: items.map((item, i) => ({
            id: item.id || `cp-item-${i}`,
            processStepNumber: item.processStepNumber || `${(i + 1) * 10}`,
            processDescription: item.processDescription || `OPERACION ${(i + 1) * 10}`,
            machineDeviceTool: '', componentMaterial: '', characteristicNumber: '',
            productCharacteristic: item.productCharacteristic || '',
            processCharacteristic: item.processCharacteristic || '',
            specialCharClass: '', specification: '', evaluationTechnique: '',
            sampleSize: '', sampleFrequency: '', controlMethod: '',
            reactionPlan: '', reactionPlanOwner: item.reactionPlanOwner || 'Operador de produccion',
            controlProcedure: '',
            amfeFailureId: item.amfeFailureId,
            ...item,
        })) as ControlPlanItem[],
    };
}

// ============================================================================
// TESTS
// ============================================================================

describe('C1: AMFE → CP coherence', () => {
    it('detects CP item with broken amfeFailureId', () => {
        const amfe = makeAmfeDoc([{
            id: 'op-1', opNumber: '10', name: 'RECEPCION',
            workElements: [{
                id: 'we-1', type: 'Machine', name: 'Mesa',
                functions: [{
                    id: 'fn-1', description: 'Recibir', requirements: '',
                    failures: [{
                        id: 'fail-1', description: 'Material incorrecto',
                        effectLocal: '', effectNextLevel: '', effectEndUser: '',
                        severity: 5, causes: [],
                    }],
                }],
            }],
        }]);
        const cp = makeCpDoc([{
            processStepNumber: '10', processDescription: 'RECEPCION',
            amfeFailureId: 'nonexistent-failure-id',
            productCharacteristic: 'Material',
        }]);

        const result = runCoherenceCheck(amfe, cp);
        const brokenLinkIssues = result.issues.filter(
            i => i.category === 'amfe-cp' && i.message.includes('amfeFailureId')
        );
        expect(brokenLinkIssues.length).toBe(1);
        expect(brokenLinkIssues[0].severity).toBe('error');
    });

    it('passes when all amfeFailureId links are valid', () => {
        const amfe = makeAmfeDoc([{
            id: 'op-1', opNumber: '10', name: 'RECEPCION',
            workElements: [{
                id: 'we-1', type: 'Machine', name: 'Mesa',
                functions: [{
                    id: 'fn-1', description: 'Recibir', requirements: '',
                    failures: [{
                        id: 'fail-real', description: 'Material incorrecto',
                        effectLocal: '', effectNextLevel: '', effectEndUser: '',
                        severity: 5, causes: [],
                    }],
                }],
            }],
        }]);
        const cp = makeCpDoc([{
            processStepNumber: '10', processDescription: 'RECEPCION',
            amfeFailureId: 'fail-real',
            productCharacteristic: 'Material',
        }]);

        const result = runCoherenceCheck(amfe, cp);
        const brokenLinkIssues = result.issues.filter(
            i => i.category === 'amfe-cp' && i.message.includes('amfeFailureId')
        );
        expect(brokenLinkIssues.length).toBe(0);
    });
});

describe('C2: Operation names', () => {
    it('warns when names differ between AMFE and CP', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'RECEPCION MATERIALES' }]);
        const cp = makeCpDoc([{ processStepNumber: '10', processDescription: 'RECEPCION DE MATERIA PRIMA' }]);

        const result = runCoherenceCheck(amfe, cp);
        const nameIssues = result.issues.filter(i => i.category === 'op-names');
        expect(nameIssues.length).toBe(1);
        expect(nameIssues[0].severity).toBe('warning');
        expect(nameIssues[0].message).toContain('OP 10');
    });

    it('passes when names match (case-insensitive, whitespace-normalized)', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'Recepcion de Materia Prima' }]);
        const cp = makeCpDoc([{ processStepNumber: '10', processDescription: 'RECEPCION DE MATERIA PRIMA' }]);

        const result = runCoherenceCheck(amfe, cp);
        const nameIssues = result.issues.filter(i => i.category === 'op-names');
        expect(nameIssues.length).toBe(0);
    });
});

describe('Summary calculation', () => {
    it('returns green when no issues', () => {
        const result = runCoherenceCheck(null, null);
        expect(result.summary.status).toBe('green');
        expect(result.summary.errors).toBe(0);
        expect(result.summary.warnings).toBe(0);
        expect(result.summary.infos).toBe(0);
    });

    it('returns yellow when only warnings', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'COSTURA' }]);
        const cp = makeCpDoc([{ processStepNumber: '10', processDescription: 'COSTURA FINAL' }]); // name mismatch → warning

        const result = runCoherenceCheck(amfe, cp);
        expect(result.summary.status).toBe('yellow');
        expect(result.summary.warnings).toBeGreaterThan(0);
        expect(result.summary.errors).toBe(0);
    });

    it('returns red when errors present', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'COSTURA' }]);
        const cp = makeCpDoc([{
            processStepNumber: '10', processDescription: 'COSTURA',
            amfeFailureId: 'nonexistent',
        }]);

        const result = runCoherenceCheck(amfe, cp);
        expect(result.summary.status).toBe('red');
        expect(result.summary.errors).toBeGreaterThan(0);
    });
});

describe('Null document handling', () => {
    it('handles all null docs gracefully', () => {
        const result = runCoherenceCheck(null, null);
        expect(result.issues).toEqual([]);
        expect(result.summary.status).toBe('green');
    });

    it('handles partial null docs (only AMFE)', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'RECEPCION' }]);
        const result = runCoherenceCheck(amfe, null);
        // No cross-doc comparisons possible, only op-names with 1 entry → no issues
        expect(result.summary.status).toBe('green');
    });

    it('handles AMFE + CP with valid link', () => {
        const amfe = makeAmfeDoc([{
            opNumber: '10', name: 'RECEPCION',
            workElements: [{
                id: 'we-1', type: 'Machine', name: 'Mesa',
                functions: [{
                    id: 'fn-1', description: 'Recibir', requirements: '',
                    failures: [{
                        id: 'fail-1', description: 'Defecto',
                        effectLocal: 'L', effectNextLevel: 'N', effectEndUser: 'E',
                        severity: 5, causes: [],
                    }],
                }],
            }],
        }]);
        const cp = makeCpDoc([{
            processStepNumber: '10', processDescription: 'RECEPCION',
            amfeFailureId: 'fail-1', // valid link
        }]);

        const result = runCoherenceCheck(amfe, cp);
        // Should not crash, should run AMFE→CP checks
        expect(result).toBeDefined();
        expect(result.summary).toBeDefined();
    });
});
