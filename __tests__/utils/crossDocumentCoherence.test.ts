/**
 * Tests for Cross-Document Coherence Check
 *
 * Verifies consistency checking across PFD, AMFE, CP, and HO documents.
 */

import { runCoherenceCheck } from '../../utils/crossDocumentCoherence';
import type { PfdDocument, PfdStep } from '../../modules/pfd/pfdTypes';
import type { AmfeDocument, AmfeOperation } from '../../modules/amfe/amfeTypes';
import type { ControlPlanDocument, ControlPlanItem } from '../../modules/controlPlan/controlPlanTypes';
import type { HoDocument, HojaOperacion, HoQualityCheck } from '../../modules/hojaOperaciones/hojaOperacionesTypes';

// ============================================================================
// FIXTURES
// ============================================================================

function makePfdDoc(steps: Partial<PfdStep>[]): PfdDocument {
    return {
        id: 'pfd-1',
        header: {
            partNumber: 'TEST-001', partName: 'Test Part', engineeringChangeLevel: '',
            modelYear: '', documentNumber: '', revisionLevel: 'A', revisionDate: '',
            companyName: '', plantLocation: '', supplierCode: '', customerName: '',
            coreTeam: '', keyContact: '', processPhase: '', preparedBy: '',
            preparedDate: '', approvedBy: '', approvedDate: '',
        },
        steps: steps.map((s, i) => ({
            id: s.id || `step-${i}`,
            stepNumber: s.stepNumber || `OP ${(i + 1) * 10}`,
            stepType: s.stepType || 'operation',
            description: s.description || `Operacion ${i + 1}`,
            machineDeviceTool: '', productCharacteristic: '', productSpecialChar: 'none',
            processCharacteristic: '', processSpecialChar: 'none', reference: '',
            department: '', notes: '', isRework: false, isExternalProcess: false,
            reworkReturnStep: '', rejectDisposition: 'none', scrapDescription: '',
            branchId: '', branchLabel: '',
            linkedAmfeOperationId: s.linkedAmfeOperationId,
            ...s,
        })) as PfdStep[],
        createdAt: '', updatedAt: '',
    };
}

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
            linkedPfdStepId: op.linkedPfdStepId,
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

function makeHoDoc(sheets: Partial<HojaOperacion>[]): HoDocument {
    return {
        header: {
            formNumber: '', organization: '', client: '',
            partNumber: '', partDescription: '', applicableParts: '',
            linkedAmfeProject: '', linkedCpProject: '',
        },
        sheets: sheets.map((s, i) => ({
            id: s.id || `ho-sheet-${i}`,
            amfeOperationId: s.amfeOperationId || '',
            operationNumber: s.operationNumber || `${(i + 1) * 10}`,
            operationName: s.operationName || `OPERACION ${(i + 1) * 10}`,
            hoNumber: '', sector: '', puestoNumber: '', vehicleModel: '',
            partCodeDescription: '', safetyElements: [], hazardWarnings: [],
            steps: [], qualityChecks: s.qualityChecks || [],
            reactionPlanText: '', reactionContact: '', visualAids: [],
            preparedBy: '', approvedBy: '', date: '', revision: '',
            status: 'borrador',
            ...s,
        })) as HojaOperacion[],
    };
}

function makeQualityCheck(overrides: Partial<HoQualityCheck> = {}): HoQualityCheck {
    return {
        id: overrides.id || `qc-${Math.random().toString(36).slice(2, 8)}`,
        characteristic: overrides.characteristic || 'Caracteristica test',
        specification: '', evaluationTechnique: '', frequency: '',
        controlMethod: '', reactionAction: '',
        reactionContact: overrides.reactionContact || '',
        specialCharSymbol: '', registro: '',
        cpItemId: overrides.cpItemId,
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

        const result = runCoherenceCheck(null, amfe, cp, null);
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

        const result = runCoherenceCheck(null, amfe, cp, null);
        const brokenLinkIssues = result.issues.filter(
            i => i.category === 'amfe-cp' && i.message.includes('amfeFailureId')
        );
        expect(brokenLinkIssues.length).toBe(0);
    });
});

describe('C2: CP → HO coherence', () => {
    it('detects CP items without HO coverage', () => {
        const cp = makeCpDoc([{
            id: 'cp-1', processStepNumber: '10', processDescription: 'COSTURA',
            productCharacteristic: 'Costura vista',
            reactionPlanOwner: 'Operador de produccion',
        }]);
        const ho = makeHoDoc([{
            operationNumber: '10', operationName: 'COSTURA',
            qualityChecks: [], // no QC covering cp-1
        }]);

        const result = runCoherenceCheck(null, null, cp, ho);
        const gapIssues = result.issues.filter(
            i => i.category === 'cp-ho' && i.message.includes('sin cobertura en HO')
        );
        expect(gapIssues.length).toBe(1);
        expect(gapIssues[0].severity).toBe('warning');
    });

    it('detects reactionContact mismatch', () => {
        const cp = makeCpDoc([{
            id: 'cp-1', processStepNumber: '10', processDescription: 'COSTURA',
            productCharacteristic: 'Costura vista',
            reactionPlanOwner: 'Inspector de Calidad',
        }]);
        const ho = makeHoDoc([{
            operationNumber: '10', operationName: 'COSTURA',
            qualityChecks: [makeQualityCheck({
                cpItemId: 'cp-1',
                characteristic: 'Costura vista',
                reactionContact: 'Operador de produccion', // different from CP
            })],
        }]);

        const result = runCoherenceCheck(null, null, cp, ho);
        const mismatchIssues = result.issues.filter(
            i => i.category === 'cp-ho' && i.message.includes('responsable difiere')
        );
        expect(mismatchIssues.length).toBe(1);
        expect(mismatchIssues[0].severity).toBe('warning');
    });

    it('detects HO qcItem with broken cpItemId', () => {
        const cp = makeCpDoc([{
            id: 'cp-real', processStepNumber: '10', processDescription: 'COSTURA',
        }]);
        const ho = makeHoDoc([{
            operationNumber: '10', operationName: 'COSTURA',
            qualityChecks: [makeQualityCheck({
                cpItemId: 'nonexistent-cp-id',
                characteristic: 'Test',
            })],
        }]);

        const result = runCoherenceCheck(null, null, cp, ho);
        const brokenIssues = result.issues.filter(
            i => i.category === 'cp-ho' && i.message.includes('item CP inexistente')
        );
        expect(brokenIssues.length).toBe(1);
        expect(brokenIssues[0].severity).toBe('error');
    });
});

describe('C3: PFD ↔ AMFE coherence', () => {
    it('detects AMFE operation without PFD link', () => {
        const pfd = makePfdDoc([{ id: 'step-1', stepNumber: 'OP 10', description: 'RECEPCION' }]);
        const amfe = makeAmfeDoc([{
            id: 'op-1', opNumber: '10', name: 'RECEPCION',
            linkedPfdStepId: undefined, // no link
        }]);

        const result = runCoherenceCheck(pfd, amfe, null, null);
        const noLinkIssues = result.issues.filter(
            i => i.category === 'pfd-amfe' && i.message.includes('sin vinculo a PFD')
        );
        expect(noLinkIssues.length).toBe(1);
        expect(noLinkIssues[0].severity).toBe('info');
    });

    it('detects PFD operation step without matching AMFE operation', () => {
        const pfd = makePfdDoc([
            { id: 'step-1', stepNumber: 'OP 10', stepType: 'operation', description: 'RECEPCION' },
            { id: 'step-2', stepNumber: 'OP 20', stepType: 'operation', description: 'COSTURA' },
        ]);
        // AMFE only has OP 10, missing OP 20
        const amfe = makeAmfeDoc([{
            id: 'op-1', opNumber: 'OP 10', name: 'RECEPCION',
            linkedPfdStepId: 'step-1',
        }]);

        const result = runCoherenceCheck(pfd, amfe, null, null);
        const missingAmfeIssues = result.issues.filter(
            i => i.category === 'pfd-amfe' && i.message.includes('sin operacion en AMFE')
        );
        expect(missingAmfeIssues.length).toBe(1);
        expect(missingAmfeIssues[0].severity).toBe('warning');
    });

    it('detects broken PFD → AMFE link', () => {
        const pfd = makePfdDoc([{
            id: 'step-1', stepNumber: 'OP 10', description: 'RECEPCION',
            linkedAmfeOperationId: 'nonexistent-amfe-op',
        }]);
        const amfe = makeAmfeDoc([{
            id: 'op-1', opNumber: '10', name: 'RECEPCION',
            linkedPfdStepId: 'step-1',
        }]);

        const result = runCoherenceCheck(pfd, amfe, null, null);
        const brokenLinkIssues = result.issues.filter(
            i => i.category === 'pfd-amfe' && i.message.includes('link AMFE roto')
        );
        expect(brokenLinkIssues.length).toBe(1);
        expect(brokenLinkIssues[0].severity).toBe('error');
    });
});

describe('C4: Operation names', () => {
    it('warns when names differ across documents', () => {
        const pfd = makePfdDoc([{
            stepNumber: '10', description: 'RECEPCION DE MATERIA PRIMA',
        }]);
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'RECEPCION MATERIALES' }]);

        const result = runCoherenceCheck(pfd, amfe, null, null);
        const nameIssues = result.issues.filter(i => i.category === 'op-names');
        expect(nameIssues.length).toBe(1);
        expect(nameIssues[0].severity).toBe('warning');
        expect(nameIssues[0].message).toContain('OP 10');
    });

    it('passes when names match (case-insensitive, whitespace-normalized)', () => {
        const pfd = makePfdDoc([{
            stepNumber: '10', description: 'RECEPCION DE MATERIA PRIMA',
        }]);
        const amfe = makeAmfeDoc([{
            opNumber: '10', name: 'Recepcion de Materia Prima',
        }]);

        const result = runCoherenceCheck(pfd, amfe, null, null);
        const nameIssues = result.issues.filter(i => i.category === 'op-names');
        expect(nameIssues.length).toBe(0);
    });

    it('compares across all 4 documents', () => {
        const pfd = makePfdDoc([{ stepNumber: '10', description: 'COSTURA' }]);
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'COSTURA' }]);
        const cp = makeCpDoc([{ processStepNumber: '10', processDescription: 'COSTURA FINAL' }]); // different
        const ho = makeHoDoc([{ operationNumber: '10', operationName: 'COSTURA' }]);

        const result = runCoherenceCheck(pfd, amfe, cp, ho);
        const nameIssues = result.issues.filter(i => i.category === 'op-names');
        expect(nameIssues.length).toBe(1);
    });
});

describe('Summary calculation', () => {
    it('returns green when no issues', () => {
        const result = runCoherenceCheck(null, null, null, null);
        expect(result.summary.status).toBe('green');
        expect(result.summary.errors).toBe(0);
        expect(result.summary.warnings).toBe(0);
        expect(result.summary.infos).toBe(0);
    });

    it('returns yellow when only warnings', () => {
        const cp = makeCpDoc([{
            id: 'cp-1', processStepNumber: '10', processDescription: 'COSTURA',
            productCharacteristic: 'Test', reactionPlanOwner: 'Operador de produccion',
        }]);
        const ho = makeHoDoc([{
            operationNumber: '10', operationName: 'COSTURA',
            qualityChecks: [], // gap → warning
        }]);

        const result = runCoherenceCheck(null, null, cp, ho);
        expect(result.summary.status).toBe('yellow');
        expect(result.summary.warnings).toBeGreaterThan(0);
        expect(result.summary.errors).toBe(0);
    });

    it('returns red when errors present', () => {
        const cp = makeCpDoc([{ id: 'cp-1', processStepNumber: '10' }]);
        const ho = makeHoDoc([{
            operationNumber: '10', operationName: 'COSTURA',
            qualityChecks: [makeQualityCheck({ cpItemId: 'nonexistent' })],
        }]);

        const result = runCoherenceCheck(null, null, cp, ho);
        expect(result.summary.status).toBe('red');
        expect(result.summary.errors).toBeGreaterThan(0);
    });
});

describe('Null document handling', () => {
    it('handles all null docs gracefully', () => {
        const result = runCoherenceCheck(null, null, null, null);
        expect(result.issues).toEqual([]);
        expect(result.summary.status).toBe('green');
    });

    it('handles partial null docs (only AMFE)', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'RECEPCION' }]);
        const result = runCoherenceCheck(null, amfe, null, null);
        // No cross-doc comparisons possible, only op-names with 1 entry → no issues
        expect(result.summary.status).toBe('green');
    });

    it('handles partial null docs (AMFE + CP)', () => {
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

        const result = runCoherenceCheck(null, amfe, cp, null);
        // Should not crash, should run AMFE→CP checks
        expect(result).toBeDefined();
        expect(result.summary).toBeDefined();
    });
});
