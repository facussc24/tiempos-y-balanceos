import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock cpAiSuggestions
// ---------------------------------------------------------------------------

const mockGetCpAiSuggestions = vi.fn();

vi.mock('../../../modules/controlPlan/cpAiSuggestions', () => ({
    getCpAiSuggestions: (...args: any[]) => mockGetCpAiSuggestions(...args),
}));

import { queryCpSuggestions, createCpQueryFn } from '../../../modules/controlPlan/cpSuggestionEngine';
import type { CpSuggestionContext } from '../../../modules/controlPlan/cpSuggestionTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_CONTEXT: CpSuggestionContext = {
    processDescription: 'Ensamble Final',
    amfeAp: 'M',
    amfeSeverity: 7,
    phase: 'production',
};

// ---------------------------------------------------------------------------
// queryCpSuggestions tests
// ---------------------------------------------------------------------------

describe('queryCpSuggestions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns empty ai=null when aiEnabled is false', () => {
        const onUpdate = vi.fn();
        queryCpSuggestions('controlMethod', BASE_CONTEXT, 'test', false, onUpdate);
        expect(onUpdate).toHaveBeenCalledWith({
            local: [],
            ai: null,
            aiLoading: false,
        });
        expect(mockGetCpAiSuggestions).not.toHaveBeenCalled();
    });

    it('returns empty ai=[] when input is too short', () => {
        const onUpdate = vi.fn();
        queryCpSuggestions('controlMethod', BASE_CONTEXT, 'a', true, onUpdate);
        expect(onUpdate).toHaveBeenCalledWith({
            local: [],
            ai: [],
            aiLoading: false,
        });
        expect(mockGetCpAiSuggestions).not.toHaveBeenCalled();
    });

    it('returns empty ai=[] when input is empty', () => {
        const onUpdate = vi.fn();
        queryCpSuggestions('controlMethod', BASE_CONTEXT, '', true, onUpdate);
        expect(onUpdate).toHaveBeenCalledWith({
            local: [],
            ai: [],
            aiLoading: false,
        });
    });

    it('fires AI query and returns loading then results', async () => {
        const aiResults = [{ text: 'Receta PLC', source: 'IA Gemini', frequency: 1 }];
        mockGetCpAiSuggestions.mockResolvedValue(aiResults);

        const onUpdate = vi.fn();
        queryCpSuggestions('controlMethod', BASE_CONTEXT, 'Receta', true, onUpdate);

        // First call: loading
        expect(onUpdate).toHaveBeenCalledWith({
            local: [],
            ai: null,
            aiLoading: true,
        });

        // Wait for async AI result
        await vi.waitFor(() => {
            expect(onUpdate).toHaveBeenCalledTimes(2);
        });

        // Second call: results
        expect(onUpdate).toHaveBeenLastCalledWith({
            local: [],
            ai: aiResults,
            aiLoading: false,
        });
    });

    it('does not call onUpdate after abort', async () => {
        mockGetCpAiSuggestions.mockImplementation(() =>
            new Promise(resolve => setTimeout(() => resolve([{ text: 'late', source: 'IA Gemini', frequency: 1 }]), 50))
        );

        const onUpdate = vi.fn();
        const controller = queryCpSuggestions('controlMethod', BASE_CONTEXT, 'Receta', true, onUpdate);

        // Abort immediately
        controller.abort();

        // Wait a bit to ensure the promise resolves
        await new Promise(r => setTimeout(r, 100));

        // Should only have the loading call, not the results
        expect(onUpdate).toHaveBeenCalledTimes(1); // only loading
    });

    it('returns empty ai on AI error', async () => {
        mockGetCpAiSuggestions.mockRejectedValue(new Error('Network error'));

        const onUpdate = vi.fn();
        queryCpSuggestions('controlMethod', BASE_CONTEXT, 'Receta', true, onUpdate);

        await vi.waitFor(() => {
            expect(onUpdate).toHaveBeenCalledTimes(2);
        });

        expect(onUpdate).toHaveBeenLastCalledWith({
            local: [],
            ai: [],
            aiLoading: false,
        });
    });

    it('uses existingLocal when provided', () => {
        const existingLocal = [{ text: 'existing', source: 'local', frequency: 5 }];
        const onUpdate = vi.fn();
        queryCpSuggestions('controlMethod', BASE_CONTEXT, 'x', true, onUpdate, existingLocal);
        expect(onUpdate).toHaveBeenCalledWith({
            local: existingLocal,
            ai: [],
            aiLoading: false,
        });
    });
});

// ---------------------------------------------------------------------------
// createCpQueryFn tests
// ---------------------------------------------------------------------------

describe('createCpQueryFn', () => {
    it('returns a function that calls queryCpSuggestions', async () => {
        const aiResults = [{ text: 'SPC carta X-R', source: 'IA Gemini', frequency: 1 }];
        mockGetCpAiSuggestions.mockResolvedValue(aiResults);

        const queryFn = createCpQueryFn('evaluationTechnique', BASE_CONTEXT);
        const onUpdate = vi.fn();
        queryFn('SPC', true, onUpdate);

        expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ aiLoading: true }));
    });
});
