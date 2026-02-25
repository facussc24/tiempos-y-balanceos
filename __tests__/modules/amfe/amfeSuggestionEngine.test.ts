import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { buildSuggestionIndex, querySuggestions, queryAllSuggestions, SuggestionIndex, AllSuggestionsResult, Suggestion } from '../../../modules/amfe/amfeSuggestionEngine';
import { AmfeLibraryOperation } from '../../../modules/amfe/amfeLibraryTypes';
import { WorkElementType } from '../../../modules/amfe/amfeTypes';

const BLANK_CAUSE_FIELDS = {
    characteristicNumber: '',
    specialChar: '',
    filterCode: '',
    preventionAction: '',
    detectionAction: '',
    responsible: '',
    targetDate: '',
    status: '',
    actionTaken: '',
    completionDate: '',
    severityNew: '' as string | number,
    occurrenceNew: '' as string | number,
    detectionNew: '' as string | number,
    apNew: '',
    observations: '',
};

function makeLibOp(name: string, weType: WorkElementType, weName: string, failures: { desc: string; cause: string; prevention: string; detection: string }[]): AmfeLibraryOperation {
    return {
        id: `lib-${name}`,
        opNumber: '10',
        name,
        workElements: [{
            id: 'we-1',
            type: weType,
            name: weName,
            functions: [{
                id: 'f-1',
                description: 'Test function',
                requirements: '',
                failures: failures.map((f, i) => ({
                    id: `fl-${i}`,
                    description: f.desc,
                    severity: '7',
                    effectLocal: 'Retrabajo',
                    effectNextLevel: 'Retraso',
                    effectEndUser: 'Falla funcional',
                    causes: [{
                        id: `c-${i}`,
                        cause: f.cause,
                        occurrence: '4',
                        detection: '5',
                        preventionControl: f.prevention,
                        detectionControl: f.detection,
                        ap: 'M',
                        ...BLANK_CAUSE_FIELDS,
                    }],
                })),
            }],
        }],
        lastModified: '2024-01-01T00:00:00.000Z',
        version: 1,
    };
}

describe('buildSuggestionIndex', () => {
    it('indexes library operations', () => {
        const libOps = [
            makeLibOp('Corte Laser', 'Machine', 'Laser CO2', [
                { desc: 'Pieza fuera de dimension', cause: 'Desgaste lente', prevention: 'Limpieza lente cada turno', detection: 'Verificacion dimensional' },
            ]),
        ];

        const index = buildSuggestionIndex(libOps);

        expect(index.failureDescription.length).toBe(1);
        expect(index.failureDescription[0].text).toBe('Pieza fuera de dimension');
        expect(index.failureDescription[0].source).toContain('Biblioteca');
        expect(index.cause.length).toBe(1);
        expect(index.preventionControl.length).toBe(1);
        expect(index.detectionControl.length).toBe(1);
    });

    it('indexes effects', () => {
        const libOps = [
            makeLibOp('Corte', 'Method', 'Corte', [
                { desc: 'Falla', cause: 'C', prevention: 'P', detection: 'D' },
            ]),
        ];

        const index = buildSuggestionIndex(libOps);

        expect(index.effectLocal.length).toBe(1);
        expect(index.effectLocal[0].text).toBe('Retrabajo');
        expect(index.effectNextLevel.length).toBe(1);
        expect(index.effectEndUser.length).toBe(1);
    });

    it('indexes AMFE operations with source name', () => {
        const amfeOps = [{
            sourceName: 'Proyecto ABC',
            ops: [{
                id: 'op-1',
                opNumber: '10',
                name: 'Soldadura',
                workElements: [{
                    id: 'we-1',
                    type: 'Machine' as const,
                    name: 'Robot Soldador',
                    functions: [{
                        id: 'f-1',
                        description: '',
                        requirements: '',
                        failures: [{
                            id: 'fl-1',
                            description: 'Porosidad en cordon',
                            severity: '8',
                            effectLocal: '',
                            effectNextLevel: '',
                            effectEndUser: '',
                            causes: [{
                                id: 'c-1',
                                cause: 'Gas protector insuficiente',
                                occurrence: '3',
                                detection: '4',
                                preventionControl: 'Verificar caudal de gas',
                                detectionControl: 'Inspeccion visual post-soldadura',
                                ap: 'M',
                                ...BLANK_CAUSE_FIELDS,
                            }],
                        }],
                    }],
                }],
            }],
        }];

        const index = buildSuggestionIndex([], amfeOps);

        expect(index.failureDescription[0].source).toContain('AMFE: Proyecto ABC');
        expect(index.cause[0].text).toBe('Gas protector insuficiente');
    });

    it('handles empty inputs', () => {
        const index = buildSuggestionIndex([], []);
        expect(index.failureDescription).toHaveLength(0);
        expect(index.cause).toHaveLength(0);
    });
});

describe('querySuggestions', () => {
    let index: SuggestionIndex;

    beforeAll(() => {
        const libOps = [
            makeLibOp('Corte Laser', 'Machine', 'Laser CO2', [
                { desc: 'Pieza fuera de dimension', cause: 'Desgaste de lente laser', prevention: 'Limpieza de lente cada turno', detection: 'Verificacion dimensional con calibre' },
                { desc: 'Pieza con rebaba excesiva', cause: 'Potencia laser insuficiente', prevention: 'Ajuste potencia laser', detection: 'Inspeccion visual post-corte' },
            ]),
            makeLibOp('Corte Plasma', 'Machine', 'Plasma Hypertherm', [
                { desc: 'Pieza fuera de dimension', cause: 'Desgaste de boquilla plasma', prevention: 'Cambio boquilla cada 500 cortes', detection: 'Verificacion dimensional con calibre' },
            ]),
            makeLibOp('Soldadura MIG', 'Machine', 'Robot Soldador Fanuc', [
                { desc: 'Porosidad en cordon', cause: 'Gas protector insuficiente', prevention: 'Verificar caudal de gas', detection: 'Inspeccion visual' },
                { desc: 'Falta de penetracion', cause: 'Velocidad de avance excesiva', prevention: 'Control de velocidad parametrizado', detection: 'Ensayo destructivo' },
            ]),
        ];
        index = buildSuggestionIndex(libOps);
    });

    it('returns suggestions matching input text', () => {
        const results = querySuggestions(index, 'failureDescription', 'Pieza');
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => r.text.toLowerCase().includes('pieza'))).toBe(true);
    });

    it('deduplicates identical texts', () => {
        const results = querySuggestions(index, 'failureDescription', 'Pieza fuera');
        // "Pieza fuera de dimension" appears in both Corte Laser and Corte Plasma
        const texts = results.map(r => r.text);
        const unique = new Set(texts);
        expect(texts.length).toBe(unique.size);
    });

    it('shows frequency for repeated suggestions', () => {
        const results = querySuggestions(index, 'failureDescription', 'Pieza fuera');
        const match = results.find(r => r.text === 'Pieza fuera de dimension');
        expect(match).toBeTruthy();
        expect(match!.frequency).toBeGreaterThanOrEqual(2); // appears in 2 ops
    });

    it('respects minimum input length', () => {
        const results = querySuggestions(index, 'failureDescription', 'P');
        expect(results).toHaveLength(0);
    });

    it('is case-insensitive', () => {
        const results = querySuggestions(index, 'failureDescription', 'pieza');
        expect(results.length).toBeGreaterThan(0);
    });

    it('ranks context-matching suggestions higher', () => {
        const results = querySuggestions(index, 'cause', 'Desgaste', {
            workElementType: 'Machine',
            workElementName: 'Laser',
        });
        expect(results.length).toBeGreaterThan(0);
        // "Desgaste de lente laser" should rank above "Desgaste de boquilla plasma"
        // because the WE name context matches "Laser"
        expect(results[0].text).toContain('lente laser');
    });

    it('filters by failure context for cause suggestions', () => {
        const results = querySuggestions(index, 'cause', 'Gas', {
            failureDescription: 'Porosidad',
        });
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].text).toContain('Gas protector');
    });

    it('prefers library sources over AMFE sources', () => {
        // Add same text from both sources
        const libOps = [makeLibOp('Op1', 'Machine', 'M1', [
            { desc: 'Falla comun', cause: 'Causa comun', prevention: 'P', detection: 'D' },
        ])];
        const amfeOps = [{
            sourceName: 'Proyecto X',
            ops: [{
                id: 'op-1', opNumber: '10', name: 'Op1',
                workElements: [{
                    id: 'we-1', type: 'Machine' as const, name: 'M1',
                    functions: [{
                        id: 'f-1', description: '', requirements: '',
                        failures: [{
                            id: 'fl-1', description: 'Falla comun', severity: '5',
                            effectLocal: '', effectNextLevel: '', effectEndUser: '',
                            causes: [{
                                id: 'c-1', cause: 'Causa comun', occurrence: '3', detection: '4',
                                preventionControl: '', detectionControl: '', ap: 'M',
                                ...BLANK_CAUSE_FIELDS,
                            }],
                        }],
                    }],
                }],
            }],
        }];

        const combinedIndex = buildSuggestionIndex(libOps, amfeOps);
        const results = querySuggestions(combinedIndex, 'failureDescription', 'Falla com');
        // Should show as coming from library (preferred over AMFE source)
        const match = results.find(r => r.text === 'Falla comun');
        expect(match).toBeTruthy();
        expect(match!.source).toContain('Biblioteca');
    });

    it('returns empty for no matches', () => {
        const results = querySuggestions(index, 'failureDescription', 'xyz no existe');
        expect(results).toHaveLength(0);
    });

    it('does not suggest exact matches of the input', () => {
        const results = querySuggestions(index, 'failureDescription', 'Pieza fuera de dimension');
        const exactMatch = results.find(r => r.text.toLowerCase() === 'pieza fuera de dimension');
        expect(exactMatch).toBeUndefined();
    });

    it('respects limit parameter', () => {
        const results = querySuggestions(index, 'detectionControl', 'Inspec', {}, 1);
        expect(results.length).toBeLessThanOrEqual(1);
    });
});

// ---------------------------------------------------------------------------
// queryAllSuggestions tests
// ---------------------------------------------------------------------------

// Mock AI suggestions module
vi.mock('../../../modules/amfe/amfeAiSuggestions', () => ({
    getAiSuggestions: vi.fn(),
}));

import { getAiSuggestions } from '../../../modules/amfe/amfeAiSuggestions';

describe('queryAllSuggestions', () => {
    let qasIndex: SuggestionIndex;

    beforeAll(() => {
        const libOps = [
            makeLibOp('Soldadura MIG', 'Machine', 'Robot Fanuc', [
                { desc: 'Porosidad en cordon', cause: 'Gas insuficiente', prevention: 'Verificar caudal', detection: 'Inspeccion visual' },
            ]),
        ];
        qasIndex = buildSuggestionIndex(libOps);
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns local-only when aiEnabled=false', () => {
        const updates: AllSuggestionsResult[] = [];
        queryAllSuggestions(
            qasIndex, 'failureDescription', 'Poros', {}, false,
            (result) => updates.push({ ...result }),
        );

        expect(updates).toHaveLength(1);
        expect(updates[0].local.length).toBeGreaterThan(0);
        expect(updates[0].ai).toBeNull();
        expect(updates[0].aiLoading).toBe(false);
        expect(getAiSuggestions).not.toHaveBeenCalled();
    });

    it('fires AI query when aiEnabled=true and input >= 3 chars', async () => {
        vi.mocked(getAiSuggestions).mockResolvedValue([
            { text: 'AI Suggestion 1', source: 'IA Gemini', frequency: 1 },
        ]);

        const updates: AllSuggestionsResult[] = [];
        queryAllSuggestions(
            qasIndex, 'failureDescription', 'Poros', {}, true,
            (result) => updates.push({ ...result }),
        );

        // First update: local + aiLoading=true
        expect(updates).toHaveLength(1);
        expect(updates[0].aiLoading).toBe(true);

        await vi.waitFor(() => {
            expect(updates.length).toBe(2);
        });

        expect(updates[1].aiLoading).toBe(false);
        expect(updates[1].ai).toHaveLength(1);
        expect(updates[1].ai![0].text).toBe('AI Suggestion 1');
    });

    it('deduplicates AI suggestions matching local text', async () => {
        vi.mocked(getAiSuggestions).mockResolvedValue([
            { text: 'Porosidad en cordon', source: 'IA Gemini', frequency: 1 },
            { text: 'Falta de penetracion', source: 'IA Gemini', frequency: 1 },
        ]);

        const updates: AllSuggestionsResult[] = [];
        queryAllSuggestions(
            qasIndex, 'failureDescription', 'Poros', {}, true,
            (result) => updates.push({ ...result }),
        );

        await vi.waitFor(() => expect(updates.length).toBe(2));

        const aiTexts = updates[1].ai!.map(s => s.text);
        expect(aiTexts).not.toContain('Porosidad en cordon');
        expect(aiTexts).toContain('Falta de penetracion');
    });

    it('does not call onUpdate after abort', async () => {
        let resolveAi!: (value: Suggestion[]) => void;
        vi.mocked(getAiSuggestions).mockImplementation(() =>
            new Promise(resolve => { resolveAi = resolve; }),
        );

        const updates: AllSuggestionsResult[] = [];
        const controller = queryAllSuggestions(
            qasIndex, 'failureDescription', 'Poros', {}, true,
            (result) => updates.push({ ...result }),
        );

        expect(updates).toHaveLength(1);
        controller.abort();
        resolveAi([{ text: 'Late', source: 'IA Gemini', frequency: 1 }]);

        await new Promise(r => setTimeout(r, 20));
        expect(updates).toHaveLength(1);
    });

    it('skips AI for input shorter than 3 chars', () => {
        const updates: AllSuggestionsResult[] = [];
        queryAllSuggestions(
            qasIndex, 'failureDescription', 'Po', {}, true,
            (result) => updates.push({ ...result }),
        );

        expect(updates).toHaveLength(1);
        expect(updates[0].ai).toEqual([]);
        expect(updates[0].aiLoading).toBe(false);
        expect(getAiSuggestions).not.toHaveBeenCalled();
    });

    it('returns ai:[] on AI error', async () => {
        vi.mocked(getAiSuggestions).mockRejectedValue(new Error('Network'));

        const updates: AllSuggestionsResult[] = [];
        queryAllSuggestions(
            qasIndex, 'failureDescription', 'Poros', {}, true,
            (result) => updates.push({ ...result }),
        );

        await vi.waitFor(() => expect(updates.length).toBe(2));

        expect(updates[1].ai).toEqual([]);
        expect(updates[1].aiLoading).toBe(false);
    });

    it('uses existingLocal to skip local recomputation', async () => {
        vi.mocked(getAiSuggestions).mockResolvedValue([
            { text: 'AI only', source: 'IA Gemini', frequency: 1 },
        ]);

        const existingLocal: Suggestion[] = [
            { text: 'Pre-computed', source: 'Biblioteca: Test', frequency: 1 },
        ];

        const updates: AllSuggestionsResult[] = [];
        queryAllSuggestions(
            qasIndex, 'failureDescription', 'Poros', {}, true,
            (result) => updates.push({ ...result }),
            existingLocal,
        );

        expect(updates[0].local).toEqual(existingLocal);

        await vi.waitFor(() => expect(updates.length).toBe(2));
        expect(updates[1].local).toEqual(existingLocal);
        expect(updates[1].ai!.length).toBeGreaterThan(0);
    });
});
