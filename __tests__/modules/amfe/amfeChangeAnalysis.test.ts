import { AmfeDocument, createEmptyCause } from '../../../modules/amfe/amfeTypes';
import {
    serializeAmfeCompact,
    parseChangeAnalysisResponse,
    analyzeProcessChange,
} from '../../../modules/amfe/amfeChangeAnalysis';
import { GeminiError } from '../../../utils/geminiClient';

// ---------------------------------------------------------------------------
// Mock geminiClient
// ---------------------------------------------------------------------------
vi.mock('../../../utils/geminiClient', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../utils/geminiClient')>();
    return {
        ...actual,
        queryGemini: vi.fn(),
    };
});

import { queryGemini } from '../../../utils/geminiClient';
const mockQueryGemini = vi.mocked(queryGemini);

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const emptyDoc: AmfeDocument = {
    header: {
        organization: '', location: '', client: '', modelYear: '',
        subject: '', startDate: '', revDate: '', team: '',
        amfeNumber: '', responsible: '', confidentiality: '',
        partNumber: '', processResponsible: '', revision: '',
        approvedBy: '', scope: '',
    },
    operations: [],
};

const docWithEmptyElements: AmfeDocument = {
    header: { ...emptyDoc.header },
    operations: [{
        id: 'op1', opNumber: '10', name: 'Soldadura MIG',
        workElements: [{
            id: 'we1', type: 'Machine', name: 'Soldadora',
            functions: [],
        }],
    }],
};

const sampleDoc: AmfeDocument = {
    header: { ...emptyDoc.header, organization: 'Test Org' },
    operations: [{
        id: 'op1', opNumber: '10', name: 'Soldadura MIG',
        workElements: [{
            id: 'we1', type: 'Machine', name: 'Soldadora',
            functions: [{
                id: 'f1', description: 'Soldar piezas', requirements: '',
                failures: [{
                    id: 'fail1', description: 'Cordon incompleto',
                    effectLocal: 'Retrabajo', effectNextLevel: '', effectEndUser: 'Falla estructural',
                    severity: 8,
                    causes: [{
                        ...createEmptyCause(),
                        id: 'c1', cause: 'Voltaje bajo', preventionControl: 'Receta bloqueada',
                        detectionControl: 'Inspeccion visual', occurrence: 4, detection: 5, ap: 'M',
                    }],
                }],
            }],
        }],
    }],
};

// A valid ChangeImpactReport JSON as Gemini would return
const validReport = {
    summary: 'El cambio afecta la soldadura MIG',
    affectedItems: [{
        operationName: 'Soldadura MIG',
        failureDescription: 'Cordon incompleto',
        currentAP: 'M',
        riskChange: 'increased',
        recommendation: 'Revisar voltaje',
    }],
    newRisks: ['Salpicaduras por nuevo gas'],
    suggestedActions: ['Agregar control de flujo de gas'],
};

// ---------------------------------------------------------------------------
// serializeAmfeCompact
// ---------------------------------------------------------------------------
describe('serializeAmfeCompact', () => {
    it('returns null for a doc with no operations', () => {
        expect(serializeAmfeCompact(emptyDoc)).toBeNull();
    });

    it('returns null for a doc with operations but no usable elements', () => {
        // operations exist but workElements have no functions -> filtered out
        expect(serializeAmfeCompact(docWithEmptyElements)).toBeNull();
    });

    it('serializes a doc with full hierarchy to a JSON string', () => {
        const result = serializeAmfeCompact(sampleDoc);
        expect(result).not.toBeNull();
        const parsed = JSON.parse(result!);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].op).toBe('Soldadura MIG');
        expect(parsed[0].elements[0].type).toBe('Machine');
        expect(parsed[0].elements[0].functions[0].failures[0].mode).toBe('Cordon incompleto');
        expect(parsed[0].elements[0].functions[0].failures[0].causes[0].cause).toBe('Voltaje bajo');
    });

    it('includes severity, occurrence, detection, and AP in output', () => {
        const result = serializeAmfeCompact(sampleDoc);
        const parsed = JSON.parse(result!);
        const failure = parsed[0].elements[0].functions[0].failures[0];
        expect(failure.s).toBe(8);
        const cause = failure.causes[0];
        expect(cause.o).toBe(4);
        expect(cause.d).toBe(5);
        expect(cause.ap).toBe('M');
    });

    it('filters out causes with all empty fields', () => {
        const docWithEmptyCause: AmfeDocument = {
            header: emptyDoc.header,
            operations: [{
                id: 'op1', opNumber: '10', name: 'Op',
                workElements: [{
                    id: 'we1', type: 'Machine', name: 'M',
                    functions: [{
                        id: 'f1', description: 'Func', requirements: '',
                        failures: [{
                            id: 'fail1', description: 'Modo falla',
                            effectLocal: '', effectNextLevel: '', effectEndUser: '',
                            severity: 5,
                            causes: [
                                { ...createEmptyCause(), id: 'empty', cause: '', preventionControl: '', detectionControl: '' },
                                { ...createEmptyCause(), id: 'filled', cause: 'Real cause', preventionControl: '', detectionControl: '' },
                            ],
                        }],
                    }],
                }],
            }],
        };
        const result = serializeAmfeCompact(docWithEmptyCause);
        const parsed = JSON.parse(result!);
        const causes = parsed[0].elements[0].functions[0].failures[0].causes;
        expect(causes).toHaveLength(1);
        expect(causes[0].cause).toBe('Real cause');
    });

    it('filters out failure modes with empty description and no causes', () => {
        const docEmptyFailure: AmfeDocument = {
            header: emptyDoc.header,
            operations: [{
                id: 'op1', opNumber: '10', name: 'Op',
                workElements: [{
                    id: 'we1', type: 'Machine', name: 'M',
                    functions: [{
                        id: 'f1', description: '', requirements: '',
                        failures: [{
                            id: 'fail1', description: '',
                            effectLocal: '', effectNextLevel: '', effectEndUser: '',
                            severity: '',
                            causes: [{ ...createEmptyCause(), id: 'e', cause: '', preventionControl: '', detectionControl: '' }],
                        }],
                    }],
                }],
            }],
        };
        // empty failure description + all causes filtered => failure removed
        // empty function description + no failures => function removed
        // no functions => element removed => op removed => null
        expect(serializeAmfeCompact(docEmptyFailure)).toBeNull();
    });

    it('uses opNumber as fallback when name is empty', () => {
        const docNoName: AmfeDocument = {
            header: emptyDoc.header,
            operations: [{
                id: 'op1', opNumber: '20', name: '',
                workElements: [{
                    id: 'we1', type: 'Man', name: 'Operario',
                    functions: [{
                        id: 'f1', description: 'Ensamblar', requirements: '',
                        failures: [{
                            id: 'fail1', description: 'Faltante',
                            effectLocal: 'Retrabajo', effectNextLevel: '', effectEndUser: '',
                            severity: 3,
                            causes: [{ ...createEmptyCause(), id: 'c1', cause: 'Distraccion' }],
                        }],
                    }],
                }],
            }],
        };
        const result = serializeAmfeCompact(docNoName);
        const parsed = JSON.parse(result!);
        expect(parsed[0].op).toBe('20');
    });
});

// ---------------------------------------------------------------------------
// parseChangeAnalysisResponse
// ---------------------------------------------------------------------------
describe('parseChangeAnalysisResponse', () => {
    it('parses valid JSON into a ChangeImpactReport', () => {
        const report = parseChangeAnalysisResponse(JSON.stringify(validReport));
        expect(report.summary).toBe('El cambio afecta la soldadura MIG');
        expect(report.affectedItems).toHaveLength(1);
        expect(report.affectedItems[0].riskChange).toBe('increased');
        expect(report.newRisks).toHaveLength(1);
        expect(report.suggestedActions).toHaveLength(1);
    });

    it('strips markdown code blocks and parses', () => {
        const wrapped = '```json\n' + JSON.stringify(validReport) + '\n```';
        const report = parseChangeAnalysisResponse(wrapped);
        expect(report.summary).toBe('El cambio afecta la soldadura MIG');
        expect(report.affectedItems).toHaveLength(1);
    });

    it('strips markdown code blocks without language tag', () => {
        const wrapped = '```\n' + JSON.stringify(validReport) + '\n```';
        const report = parseChangeAnalysisResponse(wrapped);
        expect(report.affectedItems).toHaveLength(1);
    });

    it('throws GeminiError with PARSE_ERROR for invalid JSON', () => {
        expect(() => parseChangeAnalysisResponse('not json at all'))
            .toThrow(GeminiError);
        try {
            parseChangeAnalysisResponse('not json at all');
        } catch (e) {
            expect((e as GeminiError).code).toBe('PARSE_ERROR');
        }
    });

    it('throws GeminiError when no JSON object is found', () => {
        expect(() => parseChangeAnalysisResponse('just plain text without braces'))
            .toThrow(GeminiError);
    });

    it('defaults missing fields to empty arrays and fallback summary', () => {
        const minimal = JSON.stringify({});
        const report = parseChangeAnalysisResponse(minimal);
        expect(report.summary).toBe('No se pudo generar un resumen.');
        expect(report.affectedItems).toEqual([]);
        expect(report.newRisks).toEqual([]);
        expect(report.suggestedActions).toEqual([]);
    });

    it('defaults invalid riskChange values to unchanged', () => {
        const json = JSON.stringify({
            summary: 'Test',
            affectedItems: [{
                operationName: 'Op', failureDescription: 'Fail',
                currentAP: 'H', riskChange: 'INVALID_VALUE',
                recommendation: 'Fix it',
            }],
        });
        const report = parseChangeAnalysisResponse(json);
        expect(report.affectedItems[0].riskChange).toBe('unchanged');
    });

    it('handles all valid riskChange values', () => {
        const values = ['increased', 'decreased', 'unchanged', 'new_risk'] as const;
        for (const val of values) {
            const json = JSON.stringify({
                summary: 'Test',
                affectedItems: [{ operationName: 'Op', failureDescription: 'F', currentAP: 'M', riskChange: val, recommendation: '' }],
            });
            const report = parseChangeAnalysisResponse(json);
            expect(report.affectedItems[0].riskChange).toBe(val);
        }
    });

    it('filters out non-object items in affectedItems', () => {
        const json = JSON.stringify({
            summary: 'Test',
            affectedItems: [null, 'string', 42, { operationName: 'Valid', failureDescription: '', currentAP: '', riskChange: 'increased', recommendation: '' }],
        });
        const report = parseChangeAnalysisResponse(json);
        expect(report.affectedItems).toHaveLength(1);
        expect(report.affectedItems[0].operationName).toBe('Valid');
    });

    it('filters out empty strings in newRisks and suggestedActions', () => {
        const json = JSON.stringify({
            summary: 'Test',
            newRisks: ['Real risk', '', '  ', 'Another risk'],
            suggestedActions: ['Action', '', '   '],
        });
        const report = parseChangeAnalysisResponse(json);
        expect(report.newRisks).toEqual(['Real risk', 'Another risk']);
        expect(report.suggestedActions).toEqual(['Action']);
    });

    it('extracts JSON from text with surrounding content', () => {
        const text = 'Here is my analysis:\n' + JSON.stringify(validReport) + '\nHope this helps!';
        const report = parseChangeAnalysisResponse(text);
        expect(report.summary).toBe('El cambio afecta la soldadura MIG');
    });
});

// ---------------------------------------------------------------------------
// analyzeProcessChange
// ---------------------------------------------------------------------------
describe('analyzeProcessChange', () => {
    beforeEach(() => {
        mockQueryGemini.mockReset();
    });

    it('throws on empty description', async () => {
        await expect(analyzeProcessChange('', sampleDoc))
            .rejects.toThrow(GeminiError);
        await expect(analyzeProcessChange('   ', sampleDoc))
            .rejects.toThrow('La descripcion del cambio no puede estar vacia');
    });

    it('throws on empty AMFE document (no operations)', async () => {
        await expect(analyzeProcessChange('Cambio de gas', emptyDoc))
            .rejects.toThrow(GeminiError);
        await expect(analyzeProcessChange('Cambio de gas', emptyDoc))
            .rejects.toThrow('El AMFE esta vacio');
    });

    it('calls queryGemini and returns parsed report on success', async () => {
        mockQueryGemini.mockResolvedValueOnce({
            text: JSON.stringify(validReport),
            cached: false,
        });

        const report = await analyzeProcessChange('Cambio de gas protector', sampleDoc);
        expect(report.summary).toBe('El cambio afecta la soldadura MIG');
        expect(report.affectedItems).toHaveLength(1);
        expect(report.newRisks).toHaveLength(1);
        expect(report.suggestedActions).toHaveLength(1);

        // Verify queryGemini was called with the right arguments
        expect(mockQueryGemini).toHaveBeenCalledTimes(1);
        const [systemPrompt, userPrompt, timeout, signal] = mockQueryGemini.mock.calls[0];
        expect(systemPrompt).toContain('AMFE de procesos');
        expect(userPrompt).toContain('Cambio de gas protector');
        expect(userPrompt).toContain('Soldadura MIG');
        expect(timeout).toBe(30000);
        expect(signal).toBeUndefined();
    });

    it('passes AbortSignal to queryGemini', async () => {
        mockQueryGemini.mockResolvedValueOnce({
            text: JSON.stringify(validReport),
            cached: false,
        });

        const controller = new AbortController();
        await analyzeProcessChange('Cambio', sampleDoc, controller.signal);

        const passedSignal = mockQueryGemini.mock.calls[0][3];
        expect(passedSignal).toBe(controller.signal);
    });

    it('propagates GeminiError from queryGemini', async () => {
        mockQueryGemini.mockRejectedValueOnce(
            new GeminiError('Rate limit exceeded', 'RATE_LIMIT'),
        );

        await expect(analyzeProcessChange('Cambio', sampleDoc))
            .rejects.toThrow('Rate limit exceeded');
    });
});
