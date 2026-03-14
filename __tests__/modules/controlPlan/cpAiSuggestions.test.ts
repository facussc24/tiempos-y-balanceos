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

import {
    getCpAiSuggestions,
    parseCpGeminiResponse,
    SYSTEM_PROMPT,
    FIELD_PROMPTS,
} from '../../../modules/controlPlan/cpAiSuggestions';
import type { CpSuggestionField, CpSuggestionContext } from '../../../modules/controlPlan/cpSuggestionTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_CONTEXT: CpSuggestionContext = {
    processDescription: 'Soldadura MIG',
    machineDeviceTool: 'Robot Fanuc R-2000',
    productCharacteristic: 'Cordon soldadura sin porosidad',
    processCharacteristic: 'Voltaje/Corriente dentro de parametros',
    amfeAp: 'H',
    amfeSeverity: 9,
    phase: 'production',
    operationCategory: 'soldadura',
};

function mockGeminiResponse(text: string) {
    mockQueryGemini.mockResolvedValue({ text, cached: false });
}

// ---------------------------------------------------------------------------
// SYSTEM_PROMPT tests
// ---------------------------------------------------------------------------

describe('CP SYSTEM_PROMPT', () => {
    it('contains AIAG Control Plan reference', () => {
        expect(SYSTEM_PROMPT).toContain('Plan de Control');
        expect(SYSTEM_PROMPT).toContain('AIAG');
    });

    it('contains AP rules', () => {
        expect(SYSTEM_PROMPT).toContain('AP Alto (H)');
        expect(SYSTEM_PROMPT).toContain('AP Medio (M)');
        expect(SYSTEM_PROMPT).toContain('AP Bajo (L)');
    });

    it('contains severity-based reaction plan rules', () => {
        expect(SYSTEM_PROMPT).toContain('S>=9');
        expect(SYSTEM_PROMPT).toContain('Detener línea');
    });

    it('contains technical vocabulary', () => {
        expect(SYSTEM_PROMPT).toContain('Poka-Yoke');
        expect(SYSTEM_PROMPT).toContain('SPC');
        expect(SYSTEM_PROMPT).toContain('CMM');
        expect(SYSTEM_PROMPT).toContain('MSA');
    });

    it('contains AMFE-CP relationship reference', () => {
        expect(SYSTEM_PROMPT).toContain('AMFE');
        expect(SYSTEM_PROMPT).toContain('Paso 5');
    });

    it('specifies JSON response format', () => {
        expect(SYSTEM_PROMPT).toContain('array JSON');
        expect(SYSTEM_PROMPT).toContain('5 strings');
    });
});

// ---------------------------------------------------------------------------
// FIELD_PROMPTS tests
// ---------------------------------------------------------------------------

describe('FIELD_PROMPTS', () => {
    describe('controlMethod', () => {
        it('includes process description and machine', () => {
            const prompt = FIELD_PROMPTS.controlMethod(BASE_CONTEXT, 'Receta');
            expect(prompt).toContain('Soldadura MIG');
            expect(prompt).toContain('Robot Fanuc');
        });

        it('includes AP hint for high AP', () => {
            const prompt = FIELD_PROMPTS.controlMethod(BASE_CONTEXT, 'Receta');
            expect(prompt).toContain('AP=ALTO');
        });

        it('includes severity hint', () => {
            const prompt = FIELD_PROMPTS.controlMethod(BASE_CONTEXT, 'Receta');
            expect(prompt).toContain('S=9');
            expect(prompt).toContain('CRITICO');
        });

        it('includes process vocabulary for soldadura', () => {
            const prompt = FIELD_PROMPTS.controlMethod(BASE_CONTEXT, 'Receta');
            expect(prompt).toContain('Soldadura');
            expect(prompt).toContain('electrodo');
        });

        it('includes specification when provided', () => {
            const ctx = { ...BASE_CONTEXT, specification: 'Torque 25±2 Nm' };
            const prompt = FIELD_PROMPTS.controlMethod(ctx, 'Torque');
            expect(prompt).toContain('Torque 25±2 Nm');
        });

        it('includes anti-context to avoid duplicates', () => {
            const ctx = { ...BASE_CONTEXT, existingValues: ['Poka-Yoke geometrico'] };
            const prompt = FIELD_PROMPTS.controlMethod(ctx, 'Control');
            expect(prompt).toContain('Poka-Yoke geometrico');
            expect(prompt).toContain('NO los repitas');
        });
    });

    describe('evaluationTechnique', () => {
        it('includes product characteristic', () => {
            const prompt = FIELD_PROMPTS.evaluationTechnique(BASE_CONTEXT, 'CMM');
            expect(prompt).toContain('Cordon soldadura sin porosidad');
        });

        it('includes existing control method for cross-field context', () => {
            const ctx = { ...BASE_CONTEXT, controlMethod: 'Receta PLC bloqueada' };
            const prompt = FIELD_PROMPTS.evaluationTechnique(ctx, 'Inspec');
            expect(prompt).toContain('Receta PLC bloqueada');
        });

        it('references detection origin from AMFE', () => {
            const prompt = FIELD_PROMPTS.evaluationTechnique(BASE_CONTEXT, 'Ultrasonido');
            expect(prompt).toContain('Detección');
        });
    });

    describe('sampleSize', () => {
        it('includes AP-based rules', () => {
            const prompt = FIELD_PROMPTS.sampleSize(BASE_CONTEXT, '100');
            expect(prompt).toContain('AP=H');
            expect(prompt).toContain('100%');
        });

        it('includes phase hint for safeLaunch', () => {
            const ctx = { ...BASE_CONTEXT, phase: 'safeLaunch' };
            const prompt = FIELD_PROMPTS.sampleSize(ctx, '100');
            expect(prompt).toContain('Safe Launch');
        });

        it('mentions SPC for medium AP', () => {
            const prompt = FIELD_PROMPTS.sampleSize(BASE_CONTEXT, 'muestreo');
            expect(prompt).toContain('SPC');
            expect(prompt).toContain('5 piezas');
        });
    });

    describe('sampleFrequency', () => {
        it('includes AP-based frequency rules', () => {
            const prompt = FIELD_PROMPTS.sampleFrequency(BASE_CONTEXT, 'Cada');
            expect(prompt).toContain('Cada pieza');
            expect(prompt).toContain('Cada hora');
        });

        it('includes phase hint', () => {
            const ctx = { ...BASE_CONTEXT, phase: 'safeLaunch' };
            const prompt = FIELD_PROMPTS.sampleFrequency(ctx, 'Cada');
            expect(prompt).toContain('Safe Launch');
        });

        it('includes control method context', () => {
            const ctx = { ...BASE_CONTEXT, controlMethod: 'Vision artificial inline' };
            const prompt = FIELD_PROMPTS.sampleFrequency(ctx, 'Continuo');
            expect(prompt).toContain('Vision artificial inline');
        });
    });

    describe('reactionPlan', () => {
        it('includes severity-based rules', () => {
            const prompt = FIELD_PROMPTS.reactionPlan(BASE_CONTEXT, 'Detener');
            expect(prompt).toContain('S>=9');
            expect(prompt).toContain('Detener línea');
        });

        it('includes CC/SC classification', () => {
            const ctx = { ...BASE_CONTEXT, specialCharClass: 'CC' };
            const prompt = FIELD_PROMPTS.reactionPlan(ctx, 'Detener');
            expect(prompt).toContain('CC');
        });

        it('includes moderate severity guidance', () => {
            const ctx = { ...BASE_CONTEXT, amfeSeverity: 5 };
            const prompt = FIELD_PROMPTS.reactionPlan(ctx, 'Ajustar');
            expect(prompt).toContain('MODERADO');
        });
    });
});

// ---------------------------------------------------------------------------
// getCpAiSuggestions tests
// ---------------------------------------------------------------------------

describe('getCpAiSuggestions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns empty array for input shorter than 2 chars', async () => {
        const result = await getCpAiSuggestions('controlMethod', BASE_CONTEXT, 'a');
        expect(result).toEqual([]);
        expect(mockQueryGemini).not.toHaveBeenCalled();
    });

    it('returns empty array for empty input', async () => {
        const result = await getCpAiSuggestions('controlMethod', BASE_CONTEXT, '');
        expect(result).toEqual([]);
    });

    it('parses valid JSON array response', async () => {
        mockGeminiResponse('["Receta PLC bloqueada","Poka-Yoke geometrico","Verificacion caudal gas"]');
        const result = await getCpAiSuggestions('controlMethod', BASE_CONTEXT, 'Receta');
        expect(result).toHaveLength(3);
        expect(result[0].text).toBe('Receta PLC bloqueada');
        expect(result[0].source).toBe('IA Gemini');
    });

    it('handles markdown-wrapped JSON response', async () => {
        mockGeminiResponse('```json\n["SPC carta X-R","CMM 100%"]\n```');
        const result = await getCpAiSuggestions('evaluationTechnique', BASE_CONTEXT, 'SPC');
        expect(result).toHaveLength(2);
        expect(result[0].text).toBe('SPC carta X-R');
    });

    it('filters out exact match of current text', async () => {
        mockGeminiResponse('["100%","5 piezas","100%"]');
        const result = await getCpAiSuggestions('sampleSize', BASE_CONTEXT, '100%');
        expect(result.every(s => s.text !== '100%')).toBe(true);
    });

    it('limits to 5 suggestions', async () => {
        mockGeminiResponse('["a","b","c","d","e","f","g"]');
        const result = await getCpAiSuggestions('controlMethod', BASE_CONTEXT, 'control');
        expect(result.length).toBeLessThanOrEqual(5);
    });

    it('returns empty on Gemini error (graceful degradation)', async () => {
        const { GeminiError } = await import('../../../utils/geminiClient');
        mockQueryGemini.mockRejectedValue(new GeminiError('No key', 'NO_KEY'));
        const result = await getCpAiSuggestions('controlMethod', BASE_CONTEXT, 'Receta bloq');
        expect(result).toEqual([]);
    });

    it('returns empty when aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        const result = await getCpAiSuggestions('controlMethod', BASE_CONTEXT, 'Receta bloq', controller.signal);
        expect(result).toEqual([]);
    });

    it('calls queryGemini with correct system prompt', async () => {
        mockGeminiResponse('["test"]');
        await getCpAiSuggestions('controlMethod', BASE_CONTEXT, 'Receta bloqueada');
        expect(mockQueryGemini).toHaveBeenCalledTimes(1);
        const [systemPrompt] = mockQueryGemini.mock.calls[0];
        expect(systemPrompt).toContain('Plan de Control');
        expect(systemPrompt).toContain('AIAG');
    });

    it('returns empty for invalid field', async () => {
        const result = await getCpAiSuggestions('invalidField' as CpSuggestionField, BASE_CONTEXT, 'test');
        expect(result).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// parseCpGeminiResponse tests
// ---------------------------------------------------------------------------

describe('parseCpGeminiResponse', () => {
    it('parses clean JSON array', () => {
        const result = parseCpGeminiResponse('["a","b","c"]', 'test');
        expect(result).toHaveLength(3);
        expect(result[0].text).toBe('a');
        expect(result[0].source).toBe('IA Gemini');
    });

    it('returns empty for non-array response', () => {
        expect(parseCpGeminiResponse('{"key": "value"}', 'test')).toEqual([]);
    });

    it('returns empty for plain text response', () => {
        expect(parseCpGeminiResponse('No puedo ayudar', 'test')).toEqual([]);
    });

    it('filters empty strings', () => {
        const result = parseCpGeminiResponse('["a","","  ","b"]', 'test');
        expect(result).toHaveLength(2);
    });

    it('trims whitespace from suggestions', () => {
        const result = parseCpGeminiResponse('["  CMM 100%  "]', 'test');
        expect(result[0].text).toBe('CMM 100%');
    });

    it('handles markdown code blocks', () => {
        const result = parseCpGeminiResponse('```json\n["a","b"]\n```', 'test');
        expect(result).toHaveLength(2);
    });

    it('filters non-string items', () => {
        const result = parseCpGeminiResponse('[123, "valid", null, true]', 'test');
        expect(result).toHaveLength(1);
        expect(result[0].text).toBe('valid');
    });

    it('extracts text from object responses (Gemini edge case)', () => {
        const response = JSON.stringify([
            { text: 'Poka-Yoke geometrico' },
            'CMM 100%',
            { suggestion: 'SPC carta X-R' },
            { value: 'Vision artificial' },
            { unrelated: 'ignored' },
        ]);
        const result = parseCpGeminiResponse(response, 'test');
        expect(result).toHaveLength(4);
        expect(result[0].text).toBe('Poka-Yoke geometrico');
        expect(result[1].text).toBe('CMM 100%');
        expect(result[2].text).toBe('SPC carta X-R');
        expect(result[3].text).toBe('Vision artificial');
    });

    it('filters objects without recognized text fields', () => {
        const response = JSON.stringify([
            { name: 'not recognized' },
            { id: 123, label: 'also not' },
        ]);
        const result = parseCpGeminiResponse(response, 'test');
        expect(result).toHaveLength(0);
    });
});
