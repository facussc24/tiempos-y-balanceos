import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock queryGemini
// ---------------------------------------------------------------------------

const mockQueryGemini = vi.fn();

vi.mock('../../../utils/geminiClient', () => ({
    queryGemini: (...args: any[]) => mockQueryGemini(...args),
    GeminiError: class GeminiError extends Error {
        code: string;
        constructor(message: string, code: string) {
            super(message);
            this.name = 'GeminiError';
            this.code = code;
        }
    },
}));

import { getAiSuggestions, processVocabHint, severityHint, occurrenceHint, detectionHint } from '../../../modules/amfe/amfeAiSuggestions';
import { inferOperationCategory } from '../../../modules/amfe/AmfeTableBody';
import type { SuggestionField, SuggestionContext } from '../../../modules/amfe/amfeSuggestionEngine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_CONTEXT: SuggestionContext = {
    operationName: 'Soldadura MIG',
    workElementType: 'Machine',
    workElementName: 'Robot Fanuc',
    failureDescription: 'Porosidad en cordon',
};

function mockGeminiResponse(text: string) {
    mockQueryGemini.mockResolvedValue({ text, cached: false });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getAiSuggestions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns empty array for input shorter than 3 chars', async () => {
        const result = await getAiSuggestions('cause', BASE_CONTEXT, 'ab');
        expect(result).toEqual([]);
        expect(mockQueryGemini).not.toHaveBeenCalled();
    });

    it('returns empty array for empty input', async () => {
        const result = await getAiSuggestions('cause', BASE_CONTEXT, '');
        expect(result).toEqual([]);
    });

    it('parses valid JSON array response', async () => {
        mockGeminiResponse('["Gas insuficiente", "Electrodo desgastado", "Voltaje incorrecto"]');

        const result = await getAiSuggestions('cause', BASE_CONTEXT, 'Gas');

        expect(result).toHaveLength(3);
        expect(result[0].text).toBe('Gas insuficiente');
        expect(result[1].text).toBe('Electrodo desgastado');
        expect(result[2].text).toBe('Voltaje incorrecto');
    });

    it('handles markdown-wrapped JSON response', async () => {
        mockGeminiResponse('```json\n["Sugerencia 1", "Sugerencia 2"]\n```');

        const result = await getAiSuggestions('cause', BASE_CONTEXT, 'Sug');

        expect(result).toHaveLength(2);
        expect(result[0].text).toBe('Sugerencia 1');
    });

    it('returns empty array for malformed JSON', async () => {
        mockGeminiResponse('This is not JSON at all');

        const result = await getAiSuggestions('cause', BASE_CONTEXT, 'test');

        expect(result).toEqual([]);
    });

    it('filters out exact match of current input', async () => {
        mockGeminiResponse('["Gas protector", "gas protector", "Otra causa"]');

        const result = await getAiSuggestions('cause', BASE_CONTEXT, 'Gas protector');

        // Both "Gas protector" and "gas protector" should be filtered (case-insensitive)
        expect(result.every(s => s.text.toLowerCase().trim() !== 'gas protector')).toBe(true);
    });

    it('limits to 5 suggestions maximum', async () => {
        mockGeminiResponse('["A","B","C","D","E","F","G","H"]');

        const result = await getAiSuggestions('cause', BASE_CONTEXT, 'test');

        expect(result.length).toBeLessThanOrEqual(5);
    });

    it('sets source to "IA Gemini" on all suggestions', async () => {
        mockGeminiResponse('["Causa 1", "Causa 2"]');

        const result = await getAiSuggestions('cause', BASE_CONTEXT, 'Cau');

        expect(result.every(s => s.source === 'IA Gemini')).toBe(true);
    });

    it('sets frequency to 1 on all suggestions', async () => {
        mockGeminiResponse('["Causa 1", "Causa 2"]');

        const result = await getAiSuggestions('cause', BASE_CONTEXT, 'Cau');

        expect(result.every(s => s.frequency === 1)).toBe(true);
    });

    it('returns empty array on GeminiError (graceful degradation)', async () => {
        const { GeminiError } = await import('../../../utils/geminiClient');
        mockQueryGemini.mockRejectedValue(new GeminiError('Rate limit', 'RATE_LIMIT'));

        const result = await getAiSuggestions('cause', BASE_CONTEXT, 'test input');

        expect(result).toEqual([]);
    });

    it('passes signal to queryGemini', async () => {
        mockGeminiResponse('["test"]');
        const controller = new AbortController();

        await getAiSuggestions('cause', BASE_CONTEXT, 'test', controller.signal);

        expect(mockQueryGemini).toHaveBeenCalledTimes(1);
        const callArgs = mockQueryGemini.mock.calls[0];
        // 4th argument is signal
        expect(callArgs[3]).toBe(controller.signal);
    });

    it('returns empty when signal is already aborted', async () => {
        mockGeminiResponse('["should not appear"]');
        const controller = new AbortController();
        controller.abort();

        // queryGemini should throw on aborted signal
        mockQueryGemini.mockRejectedValue(new Error('aborted'));

        const result = await getAiSuggestions('cause', BASE_CONTEXT, 'test', controller.signal);

        expect(result).toEqual([]);
    });

    describe('builds correct prompts per field type', () => {
        const fields: SuggestionField[] = [
            'failureDescription', 'cause', 'preventionControl', 'detectionControl',
            'effectLocal', 'effectNextLevel', 'effectEndUser',
        ];

        const fieldKeywords: Record<SuggestionField, string> = {
            failureDescription: 'MODO DE FALLA',
            cause: 'CAUSA RAIZ',
            preventionControl: 'CONTROL PREVENTIVO',
            detectionControl: 'CONTROL DETECCION',
            effectLocal: 'EFECTO LOCAL',
            effectNextLevel: 'EFECTO EN PLANTA CLIENTE',
            effectEndUser: 'EFECTO USUARIO FINAL',
        };

        for (const field of fields) {
            it(`includes "${fieldKeywords[field]}" in prompt for ${field}`, async () => {
                mockGeminiResponse('["test"]');

                await getAiSuggestions(field, BASE_CONTEXT, 'test input');

                expect(mockQueryGemini).toHaveBeenCalledTimes(1);
                const userPrompt = mockQueryGemini.mock.calls[0][1]; // second arg = user prompt
                expect(userPrompt).toContain(fieldKeywords[field]);
            });
        }

        it('includes operation name in prompt', async () => {
            mockGeminiResponse('["test"]');

            await getAiSuggestions('cause', BASE_CONTEXT, 'test');

            const userPrompt = mockQueryGemini.mock.calls[0][1];
            expect(userPrompt).toContain('Soldadura MIG');
        });

        it('includes work element type in prompt', async () => {
            mockGeminiResponse('["test"]');

            await getAiSuggestions('cause', BASE_CONTEXT, 'test');

            const userPrompt = mockQueryGemini.mock.calls[0][1];
            expect(userPrompt).toContain('Machine');
        });

        it('includes failure description in cause prompt', async () => {
            mockGeminiResponse('["test"]');

            await getAiSuggestions('cause', BASE_CONTEXT, 'test');

            const userPrompt = mockQueryGemini.mock.calls[0][1];
            expect(userPrompt).toContain('Porosidad en cordon');
        });
    });

    // -----------------------------------------------------------------------
    // Fase 2K: Enriched prompt content tests
    // -----------------------------------------------------------------------
    describe('enriched prompt content (Fase 2K)', () => {
        const ENRICHED_CONTEXT: SuggestionContext = {
            ...BASE_CONTEXT,
            functionDescription: 'Aplicar cordon de soldadura segun especificacion',
            functionRequirements: 'ISO 3834, penetracion >= 80%',
            severity: 8,
            causeText: 'Gas protector insuficiente',
            effectsContext: 'Pieza no conforme; Reclamo de cliente',
            operationCategory: 'soldadura',
        };

        it('includes functionDescription in failureDescription prompt', async () => {
            mockGeminiResponse('["test"]');
            await getAiSuggestions('failureDescription', ENRICHED_CONTEXT, 'Poros');
            const prompt = mockQueryGemini.mock.calls[0][1];
            expect(prompt).toContain('Aplicar cordon de soldadura segun especificacion');
        });

        it('includes functionRequirements in failureDescription prompt', async () => {
            mockGeminiResponse('["test"]');
            await getAiSuggestions('failureDescription', ENRICHED_CONTEXT, 'Poros');
            const prompt = mockQueryGemini.mock.calls[0][1];
            expect(prompt).toContain('ISO 3834');
        });

        it('includes causeText in preventionControl prompt', async () => {
            mockGeminiResponse('["test"]');
            await getAiSuggestions('preventionControl', ENRICHED_CONTEXT, 'Cambio');
            const prompt = mockQueryGemini.mock.calls[0][1];
            expect(prompt).toContain('Gas protector insuficiente');
        });

        it('includes causeText in detectionControl prompt', async () => {
            mockGeminiResponse('["test"]');
            await getAiSuggestions('detectionControl', ENRICHED_CONTEXT, 'Ensayo');
            const prompt = mockQueryGemini.mock.calls[0][1];
            expect(prompt).toContain('Gas protector insuficiente');
        });

        it('includes severity hint S>=9 in preventionControl prompt', async () => {
            mockGeminiResponse('["test"]');
            const ctx = { ...ENRICHED_CONTEXT, severity: 9 };
            await getAiSuggestions('preventionControl', ctx, 'Control');
            const prompt = mockQueryGemini.mock.calls[0][1];
            expect(prompt).toContain('CRITICO');
        });

        it('includes severity hint S=7-8 in cause prompt', async () => {
            mockGeminiResponse('["test"]');
            await getAiSuggestions('cause', ENRICHED_CONTEXT, 'Desgaste');
            const prompt = mockQueryGemini.mock.calls[0][1];
            expect(prompt).toContain('ALTO');
        });

        it('omits severity hint when severity is undefined', async () => {
            mockGeminiResponse('["test"]');
            const ctx = { ...BASE_CONTEXT, severity: undefined };
            await getAiSuggestions('cause', ctx, 'test');
            const prompt = mockQueryGemini.mock.calls[0][1];
            expect(prompt).not.toContain('CRITICO');
            expect(prompt).not.toContain('ALTO');
            expect(prompt).not.toContain('MODERADO');
        });

        it('includes process vocabulary for soldadura', async () => {
            mockGeminiResponse('["test"]');
            await getAiSuggestions('cause', ENRICHED_CONTEXT, 'Desgaste');
            const prompt = mockQueryGemini.mock.calls[0][1];
            expect(prompt).toContain('Soldadura');
            expect(prompt).toContain('electrodo');
        });

        it('includes process vocabulary for inyeccion', async () => {
            mockGeminiResponse('["test"]');
            const ctx = { ...BASE_CONTEXT, operationCategory: 'inyeccion' };
            await getAiSuggestions('cause', ctx, 'Presion');
            const prompt = mockQueryGemini.mock.calls[0][1];
            expect(prompt).toContain('Inyeccion');
            expect(prompt).toContain('molde');
        });

        it('omits process vocabulary when category is undefined', async () => {
            mockGeminiResponse('["test"]');
            await getAiSuggestions('cause', BASE_CONTEXT, 'test');
            const prompt = mockQueryGemini.mock.calls[0][1];
            expect(prompt).not.toContain('PROCESO:');
        });

        it('includes effectsContext in cause prompt', async () => {
            mockGeminiResponse('["test"]');
            await getAiSuggestions('cause', ENRICHED_CONTEXT, 'Desgaste');
            const prompt = mockQueryGemini.mock.calls[0][1];
            expect(prompt).toContain('Pieza no conforme');
        });
    });

    // -----------------------------------------------------------------------
    // Round 5 B1: Few-shot examples in FIELD_PROMPTS
    // -----------------------------------------------------------------------
    describe('few-shot examples in prompts (Round 5)', () => {
        const fieldsToCheck: SuggestionField[] = [
            'failureDescription', 'cause', 'preventionControl', 'detectionControl',
            'effectLocal', 'effectNextLevel', 'effectEndUser',
        ];

        for (const field of fieldsToCheck) {
            it(`includes EJEMPLOS in ${field} prompt`, async () => {
                mockGeminiResponse('["test"]');
                await getAiSuggestions(field, BASE_CONTEXT, 'test input');
                const userPrompt = mockQueryGemini.mock.calls[0][1];
                expect(userPrompt).toContain('EJEMPLOS');
            });
        }

        it('failureDescription examples mention soldadura context', async () => {
            mockGeminiResponse('["test"]');
            await getAiSuggestions('failureDescription', BASE_CONTEXT, 'Poros');
            const prompt = mockQueryGemini.mock.calls[0][1];
            expect(prompt).toContain('Cordon incompleto');
            expect(prompt).toContain('Porosidad en cordon');
        });

        it('cause examples include 6M-specific patterns', async () => {
            mockGeminiResponse('["test"]');
            await getAiSuggestions('cause', BASE_CONTEXT, 'Desgaste');
            const prompt = mockQueryGemini.mock.calls[0][1];
            expect(prompt).toContain('Machine');
            expect(prompt).toContain('Caudal de gas');
        });

        it('preventionControl examples include frequency/responsibility', async () => {
            mockGeminiResponse('["test"]');
            await getAiSuggestions('preventionControl', BASE_CONTEXT, 'Cambio');
            const prompt = mockQueryGemini.mock.calls[0][1];
            expect(prompt).toContain('cada turno');
        });

        it('detectionControl examples include method/criteria', async () => {
            mockGeminiResponse('["test"]');
            await getAiSuggestions('detectionControl', BASE_CONTEXT, 'Ensayo');
            const prompt = mockQueryGemini.mock.calls[0][1];
            expect(prompt).toContain('ultrasonido');
        });
    });

    // -----------------------------------------------------------------------
    // Round 5 B2: Control type guidance in prevention/detection prompts
    // -----------------------------------------------------------------------
    describe('control type guidance (Round 5)', () => {
        it('preventionControl prompt includes TIPOS DE CONTROL PREVENTIVO', async () => {
            mockGeminiResponse('["test"]');
            await getAiSuggestions('preventionControl', BASE_CONTEXT, 'Control');
            const prompt = mockQueryGemini.mock.calls[0][1];
            expect(prompt).toContain('TIPOS DE CONTROL PREVENTIVO');
            expect(prompt).toContain('Elimina causa');
            expect(prompt).toContain('Reduce ocurrencia');
            expect(prompt).toContain('Detecta causa temprano');
        });

        it('preventionControl prompt includes specificity instruction', async () => {
            mockGeminiResponse('["test"]');
            await getAiSuggestions('preventionControl', BASE_CONTEXT, 'Cambio');
            const prompt = mockQueryGemini.mock.calls[0][1];
            expect(prompt).toContain('QUIEN');
            expect(prompt).toContain('CUANDO');
            expect(prompt).toContain('FRECUENCIA');
        });

        it('detectionControl prompt includes TIPOS DE DETECCION', async () => {
            mockGeminiResponse('["test"]');
            await getAiSuggestions('detectionControl', BASE_CONTEXT, 'Ensayo');
            const prompt = mockQueryGemini.mock.calls[0][1];
            expect(prompt).toContain('TIPOS DE DETECCION');
            expect(prompt).toContain('Automatico');
            expect(prompt).toContain('D=2-3');
            expect(prompt).toContain('Semiautomatico');
            expect(prompt).toContain('D=4-6');
            expect(prompt).toContain('Manual');
            expect(prompt).toContain('D=7-8');
        });

        it('detectionControl prompt includes specificity instruction', async () => {
            mockGeminiResponse('["test"]');
            await getAiSuggestions('detectionControl', BASE_CONTEXT, 'Visual');
            const prompt = mockQueryGemini.mock.calls[0][1];
            expect(prompt).toContain('METODO');
            expect(prompt).toContain('FRECUENCIA');
            expect(prompt).toContain('CRITERIO');
        });
    });
});

// ---------------------------------------------------------------------------
// Fase 2K: Helper function tests
// ---------------------------------------------------------------------------
describe('processVocabHint', () => {
    it('returns soldadura vocab for "soldadura"', () => {
        expect(processVocabHint('soldadura')).toContain('electrodo');
        expect(processVocabHint('soldadura')).toContain('Soldadura');
    });

    it('returns inyeccion vocab for "inyeccion"', () => {
        expect(processVocabHint('inyeccion')).toContain('molde');
        expect(processVocabHint('inyeccion')).toContain('rechupe');
    });

    it('returns empty for undefined', () => {
        expect(processVocabHint(undefined)).toBe('');
    });

    it('returns empty for unknown category', () => {
        expect(processVocabHint('logistica')).toBe('');
    });
});

describe('severityHint', () => {
    it('returns CRITICO for S>=9', () => {
        expect(severityHint(9)).toContain('CRITICO');
        expect(severityHint(10)).toContain('CRITICO');
    });

    it('returns ALTO for S=7-8', () => {
        expect(severityHint(7)).toContain('ALTO');
        expect(severityHint(8)).toContain('ALTO');
    });

    it('returns MODERADO for S<=6', () => {
        expect(severityHint(6)).toContain('MODERADO');
        expect(severityHint(3)).toContain('MODERADO');
    });

    it('returns empty for 0 or undefined', () => {
        expect(severityHint(0)).toBe('');
        expect(severityHint(undefined)).toBe('');
    });
});

describe('occurrenceHint', () => {
    it('returns empty string for undefined', () => {
        expect(occurrenceHint(undefined)).toBe('');
    });

    it('returns empty string for 0', () => {
        expect(occurrenceHint(0)).toBe('');
    });

    it('returns MUY ALTA with Poka-Yoke for O>=8', () => {
        const hint8 = occurrenceHint(8);
        expect(hint8).toContain('MUY ALTA');
        expect(hint8).toContain('Poka-Yoke');
        const hint10 = occurrenceHint(10);
        expect(hint10).toContain('MUY ALTA');
    });

    it('returns MODERADA with mantenimiento preventivo for O=5-7', () => {
        const hint5 = occurrenceHint(5);
        expect(hint5).toContain('MODERADA');
        expect(hint5).toContain('mantenimiento preventivo');
        expect(occurrenceHint(7)).toContain('MODERADA');
    });

    it('returns BAJA with estandar for O=3-4', () => {
        const hint3 = occurrenceHint(3);
        expect(hint3).toContain('BAJA');
        expect(hint3).toContain('estandar');
        expect(occurrenceHint(4)).toContain('BAJA');
    });

    it('returns MUY BAJA with basico for O=1-2', () => {
        const hint1 = occurrenceHint(1);
        expect(hint1).toContain('MUY BAJA');
        expect(hint1).toContain('basico');
        expect(occurrenceHint(2)).toContain('MUY BAJA');
    });
});

describe('detectionHint', () => {
    it('returns empty string for undefined', () => {
        expect(detectionHint(undefined)).toBe('');
    });

    it('returns empty string for 0', () => {
        expect(detectionHint(0)).toBe('');
    });

    it('returns DIFICIL with sensores for D>=8', () => {
        const hint8 = detectionHint(8);
        expect(hint8).toContain('DIFICIL');
        expect(hint8).toContain('sensores');
        const hint10 = detectionHint(10);
        expect(hint10).toContain('DIFICIL');
    });

    it('returns MODERADA with estadistico for D=5-7', () => {
        const hint5 = detectionHint(5);
        expect(hint5).toContain('MODERADA');
        expect(hint5).toContain('estadistico');
        expect(detectionHint(7)).toContain('MODERADA');
    });

    it('returns BUENA for D=3-4', () => {
        expect(detectionHint(3)).toContain('BUENA');
        expect(detectionHint(4)).toContain('BUENA');
    });

    it('returns CASI SEGURA for D=1-2', () => {
        expect(detectionHint(1)).toContain('CASI SEGURA');
        expect(detectionHint(2)).toContain('CASI SEGURA');
    });
});

// ---------------------------------------------------------------------------
// Fase 2K: inferOperationCategory tests
// ---------------------------------------------------------------------------
describe('inferOperationCategory', () => {
    it('returns soldadura for "Soldadura MIG"', () => {
        expect(inferOperationCategory('Soldadura MIG')).toBe('soldadura');
    });

    it('returns ensamble for "Ensamble Final"', () => {
        expect(inferOperationCategory('Ensamble Final')).toBe('ensamble');
    });

    it('returns ensamble for "Montaje de componentes"', () => {
        expect(inferOperationCategory('Montaje de componentes')).toBe('ensamble');
    });

    it('returns pintura for "Pintura Electroforetica"', () => {
        expect(inferOperationCategory('Pintura Electroforetica')).toBe('pintura');
    });

    it('returns mecanizado for "Mecanizado CNC"', () => {
        expect(inferOperationCategory('Mecanizado CNC')).toBe('mecanizado');
    });

    it('returns inyeccion for "Inyeccion de Carcasa"', () => {
        expect(inferOperationCategory('Inyeccion de Carcasa')).toBe('inyeccion');
    });

    it('returns inspeccion for "Inspeccion Final"', () => {
        expect(inferOperationCategory('Inspeccion Final')).toBe('inspeccion');
    });

    it('detects "Logistica" as logistica', () => {
        expect(inferOperationCategory('Logistica')).toBe('logistica');
    });

    it('is case-insensitive', () => {
        expect(inferOperationCategory('SOLDADURA MIG')).toBe('soldadura');
        expect(inferOperationCategory('inyeccion plastica')).toBe('inyeccion');
    });
});
