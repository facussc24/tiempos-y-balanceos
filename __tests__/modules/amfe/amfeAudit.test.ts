import { describe, it, expect } from 'vitest';
import { runAudit, parseAiReviewResponse, AuditReport } from '../../../modules/amfe/amfeAudit';
import { AmfeDocument, createEmptyCause, ActionPriority } from '../../../modules/amfe/amfeTypes';
import { GeminiError } from '../../../utils/geminiClient';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const emptyHeader = {
    organization: '', location: '', client: '', modelYear: '',
    subject: '', startDate: '', revDate: '', team: '',
    amfeNumber: '', responsible: '', confidentiality: '',
    partNumber: '', processResponsible: '', revision: '',
    approvedBy: '', scope: '', applicableParts: '',
};

const emptyDoc: AmfeDocument = { header: emptyHeader, operations: [] };

function makeDoc(ops: any[]): AmfeDocument {
    return { header: emptyHeader, operations: ops };
}

function makeCause(overrides: Record<string, any> = {}) {
    return { ...createEmptyCause(), ...overrides };
}

function makeMinimalOp(overrides: Record<string, any> = {}) {
    return {
        id: 'op-1',
        opNumber: '10',
        name: 'Soldadura',
        workElements: [],
        ...overrides,
    };
}

function makeFullDoc(causeOverrides: Record<string, any> = {}, failOverrides: Record<string, any> = {}): AmfeDocument {
    return makeDoc([{
        id: 'op-1',
        opNumber: '10',
        name: 'Soldadura',
        workElements: [
            {
                id: 'we-1', type: 'Machine', name: 'Robot MIG',
                functions: [{
                    id: 'fn-1', description: 'Unir piezas', requirements: '',
                    failures: [{
                        id: 'fail-1',
                        description: 'Falta de fusion',
                        effectLocal: 'Retrabajo', effectNextLevel: 'Rechazo', effectEndUser: 'Falla en servicio',
                        severity: 8,
                        causes: [makeCause({
                            cause: 'Corriente baja',
                            occurrence: 4, detection: 3,
                            ap: ActionPriority.MEDIUM,
                            preventionControl: 'SPC en parametros',
                            detectionControl: 'Ultrasonido 100%',
                            ...causeOverrides,
                        })],
                        ...failOverrides,
                    }],
                }],
            },
            {
                id: 'we-2', type: 'Man', name: 'Operador',
                functions: [{
                    id: 'fn-2', description: 'Posicionar piezas', requirements: '',
                    failures: [{
                        id: 'fail-2',
                        description: 'Desalineacion',
                        effectLocal: 'Defecto', effectNextLevel: '', effectEndUser: '',
                        severity: 5,
                        causes: [makeCause({
                            cause: 'Falta de referencia',
                            occurrence: 3, detection: 2,
                            ap: ActionPriority.LOW,
                            preventionControl: 'Poka-yoke',
                            detectionControl: 'Galga',
                        })],
                    }],
                }],
            },
        ],
    }]);
}

// ============================================================================
// runAudit
// ============================================================================

describe('runAudit', () => {
    // ----- Empty document -----
    it('empty doc returns 1 info issue and score 99', () => {
        const report = runAudit(emptyDoc);
        expect(report.issues).toHaveLength(1);
        expect(report.issues[0].severity).toBe('info');
        expect(report.score).toBe(99);
        expect(report.critical).toBe(0);
        expect(report.warnings).toBe(0);
        expect(report.info).toBe(1);
    });

    // ----- Operation with no work elements -----
    it('operation with no work elements produces a warning', () => {
        const doc = makeDoc([makeMinimalOp()]);
        const report = runAudit(doc);
        expect(report.warnings).toBeGreaterThanOrEqual(1);
        const issue = report.issues.find(i => i.message.includes('sin elementos de trabajo'));
        expect(issue).toBeDefined();
        expect(issue!.severity).toBe('warning');
    });

    // ----- Op with only 1 6M type -----
    it('operation with only one 6M type produces info about low coverage', () => {
        const doc = makeDoc([{
            ...makeMinimalOp(),
            workElements: [{
                id: 'we-1', type: 'Machine', name: 'Robot',
                functions: [{
                    id: 'fn-1', description: 'Func', requirements: '',
                    failures: [{
                        id: 'f-1', description: 'Falla', effectLocal: '', effectNextLevel: '', effectEndUser: '',
                        severity: 5, causes: [makeCause({ cause: 'C1', occurrence: 3, detection: 3 })],
                    }],
                }],
            }],
        }]);
        const report = runAudit(doc);
        const issue = report.issues.find(i => i.category === '6M Cobertura');
        expect(issue).toBeDefined();
        expect(issue!.severity).toBe('info');
    });

    // ----- Function with no failures -----
    it('function with no failure modes produces a warning', () => {
        const doc = makeDoc([{
            ...makeMinimalOp(),
            workElements: [
                {
                    id: 'we-1', type: 'Machine', name: 'Robot',
                    functions: [{ id: 'fn-1', description: 'Func', requirements: '', failures: [] }],
                },
                {
                    id: 'we-2', type: 'Man', name: 'Op',
                    functions: [{ id: 'fn-2', description: 'Func2', requirements: '', failures: [
                        { id: 'f-1', description: 'Falla', effectLocal: '', effectNextLevel: '', effectEndUser: '',
                          severity: 5, causes: [makeCause({ cause: 'c', occurrence: 2, detection: 2 })] },
                    ] }],
                },
            ],
        }]);
        const report = runAudit(doc);
        const issue = report.issues.find(i => i.message.includes('sin modos de falla'));
        expect(issue).toBeDefined();
        expect(issue!.severity).toBe('warning');
    });

    // ----- Failure with no description -----
    it('failure with no description produces a warning', () => {
        const doc = makeFullDoc({}, { description: '' });
        const report = runAudit(doc);
        const issue = report.issues.find(i => i.message.includes('sin descripción') && i.category === 'Completitud');
        expect(issue).toBeDefined();
        expect(issue!.severity).toBe('warning');
    });

    // ----- Severity not assigned -----
    it('severity not assigned (S=0) produces a warning', () => {
        const doc = makeFullDoc({}, { severity: 0 });
        const report = runAudit(doc);
        const issue = report.issues.find(i => i.message.includes('Severidad'));
        expect(issue).toBeDefined();
        expect(issue!.severity).toBe('warning');
    });

    // ----- Failure with no causes -----
    it('failure with no causes produces a warning', () => {
        const doc = makeDoc([{
            ...makeMinimalOp(),
            workElements: [
                {
                    id: 'we-1', type: 'Machine', name: 'Robot',
                    functions: [{
                        id: 'fn-1', description: 'Func', requirements: '',
                        failures: [{
                            id: 'f-1', description: 'Falla', effectLocal: '', effectNextLevel: '', effectEndUser: '',
                            severity: 5, causes: [],
                        }],
                    }],
                },
                {
                    id: 'we-2', type: 'Man', name: 'Op',
                    functions: [{ id: 'fn-2', description: 'F2', requirements: '', failures: [
                        { id: 'f-2', description: 'F', effectLocal: '', effectNextLevel: '', effectEndUser: '',
                          severity: 3, causes: [makeCause({ cause: 'c', occurrence: 2, detection: 2 })] },
                    ] }],
                },
            ],
        }]);
        const report = runAudit(doc);
        const issue = report.issues.find(i => i.message.includes('sin causas'));
        expect(issue).toBeDefined();
        expect(issue!.severity).toBe('warning');
    });

    // ----- AP=H without preventive/detective actions -----
    it('AP=H without preventive or detective actions produces critical issue', () => {
        const doc = makeFullDoc({
            ap: ActionPriority.HIGH,
            preventionAction: '',
            detectionAction: '',
            responsible: 'Juan',
            targetDate: '2025-06-01',
        });
        const report = runAudit(doc);
        const issue = report.issues.find(i => i.message.includes('sin acciones preventivas'));
        expect(issue).toBeDefined();
        expect(issue!.severity).toBe('critical');
    });

    // ----- AP=H without responsible -----
    it('AP=H without responsible produces critical issue', () => {
        const doc = makeFullDoc({
            ap: ActionPriority.HIGH,
            preventionAction: 'Accion',
            detectionAction: 'Deteccion',
            responsible: '',
            targetDate: '2025-06-01',
        });
        const report = runAudit(doc);
        const issue = report.issues.find(i => i.message.includes('sin responsable'));
        expect(issue).toBeDefined();
        expect(issue!.severity).toBe('critical');
    });

    // ----- AP=H without target date -----
    it('AP=H without target date produces critical issue', () => {
        const doc = makeFullDoc({
            ap: ActionPriority.HIGH,
            preventionAction: 'Accion',
            detectionAction: 'Deteccion',
            responsible: 'Juan',
            targetDate: '',
        });
        const report = runAudit(doc);
        const issue = report.issues.find(i => i.message.includes('sin fecha objetivo'));
        expect(issue).toBeDefined();
        expect(issue!.severity).toBe('critical');
    });

    // ----- O>6 without prevention control -----
    it('O>6 without prevention control produces a warning', () => {
        const doc = makeFullDoc({
            cause: 'Alta ocurrencia',
            occurrence: 7,
            detection: 3,
            preventionControl: '',
        }, { severity: 5 });
        const report = runAudit(doc);
        const issue = report.issues.find(i => i.message.includes('sin control preventivo'));
        expect(issue).toBeDefined();
        expect(issue!.severity).toBe('warning');
    });

    // ----- D>6 without detection control -----
    it('D>6 without detection control produces a warning', () => {
        const doc = makeFullDoc({
            cause: 'Baja deteccion',
            occurrence: 3,
            detection: 8,
            detectionControl: '',
        }, { severity: 5 });
        const report = runAudit(doc);
        const issue = report.issues.find(i => i.message.includes('sin control de deteccion'));
        expect(issue).toBeDefined();
        expect(issue!.severity).toBe('warning');
    });

    // ----- Generic control with S>=8 -----
    it('generic control "inspeccion visual" with S>=8 produces a warning', () => {
        const doc = makeFullDoc({
            preventionControl: 'inspeccion visual',
        }, { severity: 9 });
        const report = runAudit(doc);
        const issue = report.issues.find(i => i.message.includes('Control genérico'));
        expect(issue).toBeDefined();
        expect(issue!.severity).toBe('warning');
    });

    it('generic control "autocontrol" with S>=8 produces a warning', () => {
        const doc = makeFullDoc({
            detectionControl: 'autocontrol',
        }, { severity: 8 });
        const report = runAudit(doc);
        const issue = report.issues.find(i => i.message.includes('Control genérico'));
        expect(issue).toBeDefined();
    });

    // ----- Cause with text but O=0 or D=0 -----
    it('cause with text but O=0 produces info about unassigned occurrence', () => {
        const doc = makeFullDoc({
            cause: 'Causa definida',
            occurrence: 0,
            detection: 5,
        });
        const report = runAudit(doc);
        const issue = report.issues.find(i => i.message.includes('Ocurrencia (O) no asignada'));
        expect(issue).toBeDefined();
        expect(issue!.severity).toBe('info');
    });

    it('cause with text but D=0 produces info about unassigned detection', () => {
        const doc = makeFullDoc({
            cause: 'Causa definida',
            occurrence: 5,
            detection: 0,
        });
        const report = runAudit(doc);
        const issue = report.issues.find(i => i.message.includes('Deteccion (D) no asignada'));
        expect(issue).toBeDefined();
        expect(issue!.severity).toBe('info');
    });

    // ----- Score calculation -----
    it('score = 100 - critical*15 - warning*5 - info*1', () => {
        // AP=H with all three missing: 3 critical issues, plus other structural issues
        const doc = makeFullDoc({
            ap: ActionPriority.HIGH,
            preventionAction: '',
            detectionAction: '',
            responsible: '',
            targetDate: '',
        });
        const report = runAudit(doc);
        const expected = Math.max(0, 100 - report.critical * 15 - report.warnings * 5 - report.info * 1);
        expect(report.score).toBe(expected);
    });

    it('score never goes below 0', () => {
        // Create a doc with many issues to push score below 0
        const ops = Array.from({ length: 10 }, (_, i) => ({
            id: `op-${i}`,
            opNumber: `${i}`,
            name: `Op${i}`,
            workElements: [{
                id: `we-${i}`, type: 'Machine' as const, name: `M${i}`,
                functions: [{
                    id: `fn-${i}`, description: `F${i}`, requirements: '',
                    failures: [{
                        id: `fail-${i}`, description: '', effectLocal: '', effectNextLevel: '', effectEndUser: '',
                        severity: 0, causes: [makeCause({ ap: ActionPriority.HIGH })],
                    }],
                }],
            }],
        }));
        const doc = makeDoc(ops);
        const report = runAudit(doc);
        expect(report.score).toBeGreaterThanOrEqual(0);
    });

    // ----- Issues sorted by severity -----
    it('issues are sorted by severity: critical first, then warning, then info', () => {
        const doc = makeFullDoc({
            ap: ActionPriority.HIGH,
            preventionAction: '',
            detectionAction: '',
            responsible: '',
            targetDate: '',
            cause: 'Causa',
            occurrence: 0,
            detection: 0,
        });
        const report = runAudit(doc);
        // Verify ordering: all critical before all warning before all info
        let lastOrder = -1;
        const orderMap = { critical: 0, warning: 1, info: 2 } as const;
        for (const issue of report.issues) {
            const order = orderMap[issue.severity];
            expect(order).toBeGreaterThanOrEqual(lastOrder);
            lastOrder = order;
        }
    });

    // ----- Well-formed doc -----
    it('well-formed doc with proper controls yields high score and no critical issues', () => {
        const doc = makeFullDoc();
        const report = runAudit(doc);
        expect(report.critical).toBe(0);
        expect(report.score).toBeGreaterThanOrEqual(80);
    });

    // ----- Report has timestamp -----
    it('report includes a timestamp', () => {
        const before = Date.now();
        const report = runAudit(emptyDoc);
        const after = Date.now();
        expect(report.timestamp).toBeGreaterThanOrEqual(before);
        expect(report.timestamp).toBeLessThanOrEqual(after);
    });

    // ----- Operation without name falls back to opNumber -----
    it('uses opNumber when operation name is empty', () => {
        const doc = makeDoc([{
            id: 'op-1', opNumber: '20', name: '',
            workElements: [],
        }]);
        const report = runAudit(doc);
        const issue = report.issues.find(i => i.location === '20');
        expect(issue).toBeDefined();
    });
});

// ============================================================================
// parseAiReviewResponse
// ============================================================================

describe('parseAiReviewResponse', () => {
    it('parses valid JSON into AiReviewResult', () => {
        const json = JSON.stringify({
            missingFailureModes: ['modo1', 'modo2'],
            controlGaps: ['gap1'],
            generalObservations: ['obs1'],
        });
        const result = parseAiReviewResponse(json);
        expect(result.missingFailureModes).toEqual(['modo1', 'modo2']);
        expect(result.controlGaps).toEqual(['gap1']);
        expect(result.generalObservations).toEqual(['obs1']);
    });

    it('strips markdown code fences and parses JSON', () => {
        const wrapped = '```json\n{"missingFailureModes":["a"],"controlGaps":[],"generalObservations":["b"]}\n```';
        const result = parseAiReviewResponse(wrapped);
        expect(result.missingFailureModes).toEqual(['a']);
        expect(result.generalObservations).toEqual(['b']);
    });

    it('handles code fences without json language tag', () => {
        const wrapped = '```\n{"missingFailureModes":[],"controlGaps":["c"],"generalObservations":[]}\n```';
        const result = parseAiReviewResponse(wrapped);
        expect(result.controlGaps).toEqual(['c']);
    });

    it('throws GeminiError on invalid JSON', () => {
        expect(() => parseAiReviewResponse('not json at all'))
            .toThrow(GeminiError);
    });

    it('throws GeminiError when no JSON object is present', () => {
        expect(() => parseAiReviewResponse('[1,2,3]'))
            .toThrow(GeminiError);
    });

    it('defaults non-array fields to empty arrays', () => {
        const json = JSON.stringify({
            missingFailureModes: 'not an array',
            controlGaps: 42,
            generalObservations: null,
        });
        const result = parseAiReviewResponse(json);
        expect(result.missingFailureModes).toEqual([]);
        expect(result.controlGaps).toEqual([]);
        expect(result.generalObservations).toEqual([]);
    });

    it('truncates arrays to max 5 items', () => {
        const json = JSON.stringify({
            missingFailureModes: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
            controlGaps: [],
            generalObservations: [],
        });
        const result = parseAiReviewResponse(json);
        expect(result.missingFailureModes).toHaveLength(5);
    });

    it('extracts JSON object from surrounding text', () => {
        const text = 'Here is my review:\n{"missingFailureModes":["x"],"controlGaps":[],"generalObservations":[]}\nEnd.';
        const result = parseAiReviewResponse(text);
        expect(result.missingFailureModes).toEqual(['x']);
    });
});
