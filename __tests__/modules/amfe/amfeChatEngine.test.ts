import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    buildChatPrompt,
    parseChatResponse,
    executeChatActions,
    resolveOperation,
    resolveWorkElement,
    resolveFunction,
    resolveFailure,
    resolveCause,
    ChatAction,
} from '../../../modules/amfe/amfeChatEngine';
import { AmfeDocument, createEmptyCause } from '../../../modules/amfe/amfeTypes';
import { GeminiError } from '../../../utils/geminiClient';

// ---------------------------------------------------------------------------
// Mock queryGeminiChat for sendChatMessage tests
// ---------------------------------------------------------------------------

vi.mock('../../../utils/geminiClient', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../utils/geminiClient')>();
    return {
        ...actual,
        queryGeminiChat: vi.fn(),
    };
});

vi.mock('../../../modules/amfe/amfeChangeAnalysis', () => ({
    serializeAmfeCompact: vi.fn((doc: any) =>
        doc.operations.length > 0 ? JSON.stringify({ ops: doc.operations.length }) : null,
    ),
}));

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

function makeFullDoc(causeOverrides: Record<string, any> = {}, failOverrides: Record<string, any> = {}): AmfeDocument {
    return makeDoc([{
        id: 'op-1', opNumber: '10', name: 'Soldadura MIG',
        workElements: [{
            id: 'we-1', type: 'Machine', name: 'Robot ZAC',
            functions: [{
                id: 'func-1', description: 'Aplicar cordón de soldadura', requirements: 'ISO 5817',
                failures: [{
                    id: 'fail-1', description: 'Porosidad en cordón',
                    effectLocal: 'Retrabajo', effectNextLevel: 'Rechazo', effectEndUser: 'Falla',
                    severity: 8, ...failOverrides,
                    causes: [makeCause({
                        id: 'cause-1', cause: 'Gas insuficiente',
                        preventionControl: 'Caudal meter', detectionControl: 'Visual',
                        occurrence: 4, detection: 6, ap: 'M', ...causeOverrides,
                    })],
                }],
            }],
        }],
    }]);
}

// ============================================================================
// parseChatResponse
// ============================================================================

describe('parseChatResponse', () => {
    it('parses valid JSON', () => {
        const text = JSON.stringify({
            message: 'Voy a agregar una falla',
            actions: [{ action: 'addFailure', path: { opName: 'Sold' }, data: { description: 'Poro', severity: 8 } }],
            questions: [],
        });
        const result = parseChatResponse(text);
        expect(result.message).toBe('Voy a agregar una falla');
        expect(result.actions).toHaveLength(1);
        expect(result.actions[0].action).toBe('addFailure');
        expect(result.actions[0].data.severity).toBe(8);
    });

    it('strips markdown code blocks', () => {
        const text = '```json\n' + JSON.stringify({
            message: 'OK', actions: [], questions: [],
        }) + '\n```';
        const result = parseChatResponse(text);
        expect(result.message).toBe('OK');
    });

    it('extracts JSON from surrounding text', () => {
        const json = JSON.stringify({ message: 'Found', actions: [], questions: [] });
        const text = `Here is the result:\n${json}\nDone.`;
        const result = parseChatResponse(text);
        expect(result.message).toBe('Found');
    });

    it('defaults missing fields', () => {
        const text = JSON.stringify({ message: 'Hi' });
        const result = parseChatResponse(text);
        expect(result.actions).toEqual([]);
        expect(result.questions).toEqual([]);
    });

    it('defaults non-string message to empty', () => {
        const text = JSON.stringify({ message: 123, actions: [], questions: [] });
        const result = parseChatResponse(text);
        expect(result.message).toBe('');
    });

    it('filters invalid actions', () => {
        const text = JSON.stringify({
            message: 'OK',
            actions: [
                { action: 'addOp', path: {}, data: {} },
                null,
                'invalid',
                { noAction: true },
            ],
            questions: [],
        });
        const result = parseChatResponse(text);
        expect(result.actions).toHaveLength(1);
    });

    it('filters non-string and empty questions', () => {
        const text = JSON.stringify({
            message: 'OK', actions: [],
            questions: ['Valid?', '', 42, null, 'Also valid?'],
        });
        const result = parseChatResponse(text);
        expect(result.questions).toEqual(['Valid?', 'Also valid?']);
    });

    it('clamps severity to 1-10', () => {
        const text = JSON.stringify({
            message: 'OK',
            actions: [{ action: 'addFailure', path: {}, data: { severity: 15 } }],
            questions: [],
        });
        const result = parseChatResponse(text);
        expect(result.actions[0].data.severity).toBe(10);
    });

    it('clamps occurrence min to 1', () => {
        const text = JSON.stringify({
            message: 'OK',
            actions: [{ action: 'addCause', path: {}, data: { occurrence: 0 } }],
            questions: [],
        });
        const result = parseChatResponse(text);
        expect(result.actions[0].data.occurrence).toBe(1);
    });

    it('clamps detection min to 1', () => {
        const text = JSON.stringify({
            message: 'OK',
            actions: [{ action: 'updateCause', path: {}, data: { detection: -3 } }],
            questions: [],
        });
        const result = parseChatResponse(text);
        expect(result.actions[0].data.detection).toBe(1);
    });

    it('rounds S/O/D floats', () => {
        const text = JSON.stringify({
            message: 'OK',
            actions: [{ action: 'addCause', path: {}, data: { occurrence: 4.7 } }],
            questions: [],
        });
        const result = parseChatResponse(text);
        expect(result.actions[0].data.occurrence).toBe(5);
    });

    it('throws PARSE_ERROR on non-JSON text', () => {
        expect(() => parseChatResponse('Hello world, no JSON here!')).toThrow(GeminiError);
        try { parseChatResponse('No JSON'); } catch (e: any) {
            expect(e.code).toBe('PARSE_ERROR');
        }
    });

    it('throws PARSE_ERROR on invalid JSON', () => {
        expect(() => parseChatResponse('{ broken: json }')).toThrow(GeminiError);
    });

    it('sanitizes path fields to strings', () => {
        const text = JSON.stringify({
            message: 'OK',
            actions: [{ action: 'addCause', path: { opName: 123, weType: true }, data: {} }],
            questions: [],
        });
        const result = parseChatResponse(text);
        expect(result.actions[0].path.opName).toBe('123');
        expect(result.actions[0].path.weType).toBe('true');
    });

    it('skips null/undefined data values', () => {
        const text = JSON.stringify({
            message: 'OK',
            actions: [{ action: 'addOp', path: {}, data: { name: 'X', foo: null, bar: undefined } }],
            questions: [],
        });
        const result = parseChatResponse(text);
        expect(result.actions[0].data).toEqual({ name: 'X' });
    });
});

// ============================================================================
// buildChatPrompt
// ============================================================================

describe('buildChatPrompt', () => {
    it('includes AMFE data for non-empty doc', () => {
        const doc = makeFullDoc();
        const prompt = buildChatPrompt(doc);
        expect(prompt).toContain('"ops":1');
        expect(prompt).toContain('AMFE ACTUAL');
    });

    it('uses fallback text for empty doc', () => {
        const prompt = buildChatPrompt(emptyDoc);
        expect(prompt).toContain('AMFE vacio');
    });

    it('contains action descriptions', () => {
        const prompt = buildChatPrompt(emptyDoc);
        expect(prompt).toContain('addOperation');
        expect(prompt).toContain('addCause');
        expect(prompt).toContain('updateFailure');
    });

    it('contains AIAG-VDA scale info', () => {
        const prompt = buildChatPrompt(emptyDoc);
        expect(prompt).toContain('Severidad');
        expect(prompt).toContain('Ocurrencia');
        expect(prompt).toContain('Deteccion');
    });

    it('contains JSON format template', () => {
        const prompt = buildChatPrompt(emptyDoc);
        expect(prompt).toContain('"message"');
        expect(prompt).toContain('"actions"');
        expect(prompt).toContain('"questions"');
    });
});

// ============================================================================
// Entity resolution
// ============================================================================

describe('resolveOperation', () => {
    const doc = makeDoc([
        { id: 'op-1', opNumber: '10', name: 'Soldadura MIG', workElements: [] },
        { id: 'op-2', opNumber: '20', name: 'Pintura', workElements: [] },
        { id: 'op-3', opNumber: '30', name: 'Ensamble Final', workElements: [] },
    ]);

    it('finds by exact name', () => {
        expect(resolveOperation(doc, 'Pintura')?.id).toBe('op-2');
    });

    it('finds by substring (case-insensitive)', () => {
        expect(resolveOperation(doc, 'soldadura')?.id).toBe('op-1');
    });

    it('finds by opNumber', () => {
        expect(resolveOperation(doc, '30')?.id).toBe('op-3');
    });

    it('returns null for no match', () => {
        expect(resolveOperation(doc, 'Mecanizado')).toBeNull();
    });

    it('returns null for undefined', () => {
        expect(resolveOperation(doc, undefined)).toBeNull();
    });

    it('prefers exact name over substring', () => {
        const doc2 = makeDoc([
            { id: 'op-a', opNumber: '10', name: 'Soldadura', workElements: [] },
            { id: 'op-b', opNumber: '20', name: 'Soldadura MIG', workElements: [] },
        ]);
        expect(resolveOperation(doc2, 'Soldadura')?.id).toBe('op-a');
    });
});

describe('resolveWorkElement', () => {
    const op = {
        id: 'op-1', opNumber: '10', name: 'Soldadura',
        workElements: [
            { id: 'we-1', type: 'Machine' as const, name: 'Robot', functions: [] },
            { id: 'we-2', type: 'Man' as const, name: 'Operador', functions: [] },
            { id: 'we-3', type: 'Machine' as const, name: 'Equipo auxiliar', functions: [] },
        ],
    };

    it('returns first WE when no filter given', () => {
        expect(resolveWorkElement(op)?.id).toBe('we-1');
    });

    it('filters by type', () => {
        expect(resolveWorkElement(op, 'Man')?.id).toBe('we-2');
    });

    it('filters by type and name', () => {
        expect(resolveWorkElement(op, 'Machine', 'auxiliar')?.id).toBe('we-3');
    });

    it('returns first of type if name not matched', () => {
        expect(resolveWorkElement(op, 'Machine', 'Nonexistent')?.id).toBe('we-1');
    });

    it('returns null for empty workElements', () => {
        const emptyOp = { id: 'op', opNumber: '1', name: 'X', workElements: [] };
        expect(resolveWorkElement(emptyOp)).toBeNull();
    });
});

describe('resolveFunction', () => {
    const we = {
        id: 'we-1', type: 'Machine' as const, name: 'Robot',
        functions: [
            { id: 'f-1', description: 'Aplicar cordón', requirements: '', failures: [] },
            { id: 'f-2', description: 'Posicionar pieza', requirements: '', failures: [] },
        ],
    };

    it('finds by description substring', () => {
        expect(resolveFunction(we, 'cordón')?.id).toBe('f-1');
    });

    it('returns first function when no desc given', () => {
        expect(resolveFunction(we)?.id).toBe('f-1');
    });

    it('returns null when funcDesc given but no match (no silent fallback)', () => {
        expect(resolveFunction(we, 'nonexistent')).toBeNull();
    });
});

describe('resolveFailure', () => {
    const func = {
        id: 'f-1', description: 'Aplicar cordón', requirements: '',
        failures: [
            { id: 'fail-1', description: 'Porosidad', effectLocal: '', effectNextLevel: '', effectEndUser: '', severity: 8, causes: [] },
            { id: 'fail-2', description: 'Falta de fusión', effectLocal: '', effectNextLevel: '', effectEndUser: '', severity: 7, causes: [] },
        ],
    };

    it('finds by substring', () => {
        expect(resolveFailure(func, 'fusión')?.id).toBe('fail-2');
    });

    it('returns first failure when no desc given', () => {
        expect(resolveFailure(func)?.id).toBe('fail-1');
    });

    it('returns null when desc has no match', () => {
        expect(resolveFailure(func, 'nonexistent')).toBeNull();
    });
});

describe('resolveCause', () => {
    const cause1 = makeCause({ id: 'c-1', cause: 'Gas insuficiente' });
    const cause2 = makeCause({ id: 'c-2', cause: 'Parámetros incorrectos' });
    const fail = {
        id: 'fail-1', description: 'Porosidad',
        effectLocal: '', effectNextLevel: '', effectEndUser: '',
        severity: 8, causes: [cause1, cause2],
    };

    it('finds by substring', () => {
        expect(resolveCause(fail, 'Parámetros')?.id).toBe('c-2');
    });

    it('returns first cause when no desc given', () => {
        expect(resolveCause(fail)?.id).toBe('c-1');
    });

    it('returns null when no match', () => {
        expect(resolveCause(fail, 'nonexistent')).toBeNull();
    });
});

// ============================================================================
// executeChatActions — ADD operations
// ============================================================================

describe('executeChatActions — add', () => {
    it('adds an operation', () => {
        const action: ChatAction = {
            action: 'addOperation', path: {},
            data: { opNumber: '50', name: 'Mecanizado' },
        };
        const result = executeChatActions([action], emptyDoc);
        expect(result.applied).toBe(1);
        expect(result.newDoc.operations).toHaveLength(1);
        expect(result.newDoc.operations[0].name).toBe('Mecanizado');
        expect(result.newDoc.operations[0].opNumber).toBe('50');
        expect(result.newDoc.operations[0].id).toBeTruthy();
        expect(result.created).toHaveLength(1);
    });

    it('adds a work element to existing operation', () => {
        const doc = makeDoc([{ id: 'op-1', opNumber: '10', name: 'Soldadura', workElements: [] }]);
        const action: ChatAction = {
            action: 'addWorkElement',
            path: { opName: 'Soldadura' },
            data: { type: 'Machine', name: 'Robot ZAC' },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(1);
        expect(result.newDoc.operations[0].workElements).toHaveLength(1);
        expect(result.newDoc.operations[0].workElements[0].type).toBe('Machine');
    });

    it('defaults invalid WE type to Machine', () => {
        const doc = makeDoc([{ id: 'op-1', opNumber: '10', name: 'Soldadura', workElements: [] }]);
        const action: ChatAction = {
            action: 'addWorkElement',
            path: { opName: 'Soldadura' },
            data: { type: 'InvalidType', name: 'Test' },
        };
        const result = executeChatActions([action], doc);
        expect(result.newDoc.operations[0].workElements[0].type).toBe('Machine');
    });

    it('adds a function to existing WE', () => {
        const doc = makeDoc([{
            id: 'op-1', opNumber: '10', name: 'Soldadura',
            workElements: [{ id: 'we-1', type: 'Machine', name: 'Robot', functions: [] }],
        }]);
        const action: ChatAction = {
            action: 'addFunction',
            path: { opName: 'Soldadura', weType: 'Machine' },
            data: { description: 'Aplicar cordón', requirements: 'ISO 5817' },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(1);
        expect(result.newDoc.operations[0].workElements[0].functions).toHaveLength(1);
    });

    it('adds a failure mode with severity', () => {
        const doc = makeDoc([{
            id: 'op-1', opNumber: '10', name: 'Soldadura',
            workElements: [{
                id: 'we-1', type: 'Machine', name: 'Robot',
                functions: [{ id: 'f-1', description: 'Aplicar cordón', requirements: '', failures: [] }],
            }],
        }]);
        const action: ChatAction = {
            action: 'addFailure',
            path: { opName: 'Soldadura', weType: 'Machine', funcDesc: 'cordón' },
            data: { description: 'Porosidad', severity: 8, effectLocal: 'Retrabajo' },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(1);
        const fail = result.newDoc.operations[0].workElements[0].functions[0].failures[0];
        expect(fail.description).toBe('Porosidad');
        expect(fail.severity).toBe(8);
        expect(fail.effectLocal).toBe('Retrabajo');
    });

    it('adds a cause with auto-AP calculation', () => {
        const doc = makeFullDoc();
        const action: ChatAction = {
            action: 'addCause',
            path: { opName: 'Soldadura', weType: 'Machine', funcDesc: 'cordón', failDesc: 'Porosidad' },
            data: { cause: 'Boquilla obstruida', occurrence: 5, detection: 7, preventionControl: 'Limpieza diaria' },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(1);
        const causes = result.newDoc.operations[0].workElements[0].functions[0].failures[0].causes;
        expect(causes).toHaveLength(2);
        const newCause = causes[1];
        expect(newCause.cause).toBe('Boquilla obstruida');
        expect(newCause.occurrence).toBe(5);
        expect(newCause.detection).toBe(7);
        expect(newCause.preventionControl).toBe('Limpieza diaria');
        // AP should be auto-calculated (S=8, O=5, D=7)
        expect(newCause.ap).toBeTruthy();
    });

    it('executes multiple add actions in sequence', () => {
        const actions: ChatAction[] = [
            { action: 'addOperation', path: {}, data: { opNumber: '10', name: 'Soldadura' } },
            { action: 'addWorkElement', path: { opName: 'Soldadura' }, data: { type: 'Machine', name: 'Robot' } },
            { action: 'addFunction', path: { opName: 'Soldadura', weType: 'Machine' }, data: { description: 'Aplicar' } },
        ];
        const result = executeChatActions(actions, emptyDoc);
        expect(result.applied).toBe(3);
        expect(result.created).toHaveLength(3);
        expect(result.errors).toHaveLength(0);
        expect(result.newDoc.operations[0].workElements[0].functions[0].description).toBe('Aplicar');
    });

    it('does not mutate the original document', () => {
        const doc = makeFullDoc();
        const originalOpsCount = doc.operations.length;
        const action: ChatAction = {
            action: 'addOperation', path: {}, data: { opNumber: '99', name: 'Nuevo' },
        };
        const result = executeChatActions([action], doc);
        expect(doc.operations.length).toBe(originalOpsCount);
        expect(result.newDoc.operations.length).toBe(originalOpsCount + 1);
    });
});

// ============================================================================
// executeChatActions — UPDATE operations
// ============================================================================

describe('executeChatActions — update', () => {
    it('updates operation name', () => {
        const doc = makeFullDoc();
        const action: ChatAction = {
            action: 'updateOperation',
            path: { opName: 'Soldadura' },
            data: { name: 'Soldadura TIG' },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(1);
        expect(result.newDoc.operations[0].name).toBe('Soldadura TIG');
        expect(result.modified).toHaveLength(1);
    });

    it('updates work element name', () => {
        const doc = makeFullDoc();
        const action: ChatAction = {
            action: 'updateWorkElement',
            path: { opName: 'Soldadura', weType: 'Machine' },
            data: { name: 'Robot KUKA' },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(1);
        expect(result.newDoc.operations[0].workElements[0].name).toBe('Robot KUKA');
    });

    it('updates function description and requirements', () => {
        const doc = makeFullDoc();
        const action: ChatAction = {
            action: 'updateFunction',
            path: { opName: 'Soldadura', weType: 'Machine', funcDesc: 'cordón' },
            data: { description: 'Aplicar cordón continuo', requirements: 'ISO 5817 Clase B' },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(1);
        expect(result.newDoc.operations[0].workElements[0].functions[0].description).toBe('Aplicar cordón continuo');
        expect(result.newDoc.operations[0].workElements[0].functions[0].requirements).toBe('ISO 5817 Clase B');
    });

    it('updates failure severity and cascades AP to causes', () => {
        const doc = makeFullDoc({ occurrence: 4, detection: 6 });
        const action: ChatAction = {
            action: 'updateFailure',
            path: { opName: 'Soldadura', weType: 'Machine', funcDesc: 'cordón', failDesc: 'Porosidad' },
            data: { severity: 10 },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(1);
        const fail = result.newDoc.operations[0].workElements[0].functions[0].failures[0];
        expect(fail.severity).toBe(10);
        // AP recalculated for all causes (S=10, O=4, D=6)
        expect(fail.causes[0].ap).toBeTruthy();
    });

    it('updates cause occurrence and recalculates AP', () => {
        const doc = makeFullDoc();
        const action: ChatAction = {
            action: 'updateCause',
            path: { opName: 'Soldadura', weType: 'Machine', funcDesc: 'cordón', failDesc: 'Porosidad', causeDesc: 'Gas' },
            data: { occurrence: 8 },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(1);
        const cause = result.newDoc.operations[0].workElements[0].functions[0].failures[0].causes[0];
        expect(cause.occurrence).toBe(8);
        expect(cause.ap).toBeTruthy();
    });

    it('updates cause string fields', () => {
        const doc = makeFullDoc();
        const action: ChatAction = {
            action: 'updateCause',
            path: { opName: 'Soldadura', weType: 'Machine', funcDesc: 'cordón', failDesc: 'Porosidad', causeDesc: 'Gas' },
            data: { responsible: 'Juan', targetDate: '2025-06-01', status: 'Pendiente' },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(1);
        const cause = result.newDoc.operations[0].workElements[0].functions[0].failures[0].causes[0];
        expect(cause.responsible).toBe('Juan');
        expect(cause.targetDate).toBe('2025-06-01');
        expect(cause.status).toBe('Pendiente');
    });

    it('updates failure effects', () => {
        const doc = makeFullDoc();
        const action: ChatAction = {
            action: 'updateFailure',
            path: { opName: 'Soldadura', weType: 'Machine', funcDesc: 'cordón', failDesc: 'Porosidad' },
            data: { effectLocal: 'Retrabajo masivo', effectEndUser: 'Falla estructural' },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(1);
        const fail = result.newDoc.operations[0].workElements[0].functions[0].failures[0];
        expect(fail.effectLocal).toBe('Retrabajo masivo');
        expect(fail.effectEndUser).toBe('Falla estructural');
    });
});

// ============================================================================
// executeChatActions — error handling
// ============================================================================

describe('executeChatActions — errors', () => {
    it('reports error for missing operation', () => {
        const action: ChatAction = {
            action: 'addWorkElement',
            path: { opName: 'Nonexistent' },
            data: { type: 'Machine', name: 'Robot' },
        };
        const result = executeChatActions([action], emptyDoc);
        expect(result.applied).toBe(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Nonexistent');
    });

    it('reports error for missing WE on add function', () => {
        const doc = makeDoc([{ id: 'op-1', opNumber: '10', name: 'Soldadura', workElements: [] }]);
        const action: ChatAction = {
            action: 'addFunction',
            path: { opName: 'Soldadura', weType: 'Man' },
            data: { description: 'Test' },
        };
        const result = executeChatActions([action], doc);
        expect(result.errors).toHaveLength(1);
    });

    it('reports error for unknown action', () => {
        const action = { action: 'deleteEverything' as any, path: {}, data: {} };
        const result = executeChatActions([action], emptyDoc);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('desconocida');
    });

    it('continues executing after partial error', () => {
        const doc = makeDoc([{ id: 'op-1', opNumber: '10', name: 'Soldadura', workElements: [] }]);
        const actions: ChatAction[] = [
            { action: 'addWorkElement', path: { opName: 'Nonexistent' }, data: { type: 'Machine', name: 'R' } },
            { action: 'addOperation', path: {}, data: { opNumber: '20', name: 'Pintura' } },
        ];
        const result = executeChatActions(actions, doc);
        expect(result.applied).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.newDoc.operations).toHaveLength(2);
    });

    it('error on update non-existent cause', () => {
        const doc = makeFullDoc();
        const action: ChatAction = {
            action: 'updateCause',
            path: { opName: 'Soldadura', weType: 'Machine', funcDesc: 'cordón', failDesc: 'Porosidad', causeDesc: 'Nonexistent' },
            data: { occurrence: 5 },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('causa');
    });

    it('error on update non-existent failure', () => {
        const doc = makeFullDoc();
        const action: ChatAction = {
            action: 'updateFailure',
            path: { opName: 'Soldadura', weType: 'Machine', funcDesc: 'cordón', failDesc: 'Nonexistent' },
            data: { severity: 5 },
        };
        const result = executeChatActions([action], doc);
        expect(result.errors).toHaveLength(1);
    });

    it('no changes when update has no matching fields', () => {
        const doc = makeFullDoc();
        const action: ChatAction = {
            action: 'updateOperation',
            path: { opName: 'Soldadura' },
            data: { unknownField: 'value' },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(0);
        expect(result.modified).toHaveLength(0);
    });

    it('error when failure not found for addCause', () => {
        const doc = makeDoc([{
            id: 'op-1', opNumber: '10', name: 'Soldadura',
            workElements: [{
                id: 'we-1', type: 'Machine', name: 'Robot',
                functions: [{ id: 'f-1', description: 'Aplicar', requirements: '', failures: [] }],
            }],
        }]);
        const action: ChatAction = {
            action: 'addCause',
            path: { opName: 'Soldadura', weType: 'Machine', funcDesc: 'Aplicar', failDesc: 'NoExiste' },
            data: { cause: 'Test' },
        };
        const result = executeChatActions([action], doc);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('modo de falla');
    });
});

// ============================================================================
// sendChatMessage (integration with mocked queryGeminiChat)
// ============================================================================

describe('sendChatMessage', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('orchestrates query, parse, and returns response + history', async () => {
        const mockResponse = JSON.stringify({
            message: 'Agregando falla',
            actions: [{ action: 'addFailure', path: { opName: 'Soldadura' }, data: { description: 'Poro' } }],
            questions: [],
        });

        const { queryGeminiChat } = await import('../../../utils/geminiClient');
        vi.mocked(queryGeminiChat).mockResolvedValue({ text: mockResponse });

        const { sendChatMessage } = await import('../../../modules/amfe/amfeChatEngine');

        const doc = makeFullDoc();
        const { response, history } = await sendChatMessage('Agregá una falla', doc, []);

        expect(response.message).toBe('Agregando falla');
        expect(response.actions).toHaveLength(1);
        expect(history).toHaveLength(2); // user + assistant
        expect(history[0].role).toBe('user');
        expect(history[1].role).toBe('assistant');
    });

    it('appends to existing history', async () => {
        const mockResponse = JSON.stringify({ message: 'OK', actions: [], questions: [] });

        const { queryGeminiChat } = await import('../../../utils/geminiClient');
        vi.mocked(queryGeminiChat).mockResolvedValue({ text: mockResponse });

        const { sendChatMessage } = await import('../../../modules/amfe/amfeChatEngine');

        const existingHistory = [
            { role: 'user' as const, content: 'first' },
            { role: 'assistant' as const, content: '{"message":"hi","actions":[],"questions":[]}' },
        ];
        const doc = makeFullDoc();
        const { history } = await sendChatMessage('second', doc, existingHistory);

        expect(history).toHaveLength(4);
        expect(history[2].content).toBe('second');
    });

    it('passes signal to queryGeminiChat', async () => {
        const mockResponse = JSON.stringify({ message: 'OK', actions: [], questions: [] });

        const { queryGeminiChat } = await import('../../../utils/geminiClient');
        vi.mocked(queryGeminiChat).mockResolvedValue({ text: mockResponse });

        const { sendChatMessage } = await import('../../../modules/amfe/amfeChatEngine');

        const controller = new AbortController();
        await sendChatMessage('test', emptyDoc, [], controller.signal);

        expect(queryGeminiChat).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(Array),
            60000,
            controller.signal,
        );
    });
});

// ============================================================================
// Round 5 A3: HTML guard in parseChatResponse
// ============================================================================

describe('parseChatResponse — HTML guard (Round 5)', () => {
    it('throws PARSE_ERROR for HTML starting with <', () => {
        expect(() => parseChatResponse('<html><body>Error</body></html>')).toThrow(GeminiError);
        try { parseChatResponse('<div>Rate limited</div>'); } catch (e: any) {
            expect(e.code).toBe('PARSE_ERROR');
            expect(e.message).toContain('HTML');
        }
    });

    it('throws PARSE_ERROR for DOCTYPE', () => {
        expect(() => parseChatResponse('<!DOCTYPE html><html></html>')).toThrow(GeminiError);
        try { parseChatResponse('<!DOCTYPE html>'); } catch (e: any) {
            expect(e.code).toBe('PARSE_ERROR');
        }
    });

    it('does not reject valid JSON that contains HTML in values', () => {
        const text = JSON.stringify({
            message: 'Response with <b>bold</b>',
            actions: [],
            questions: [],
        });
        const result = parseChatResponse(text);
        expect(result.message).toContain('<b>bold</b>');
    });
});

// ============================================================================
// Round 5 A4: Duplicate detection in addOperation
// ============================================================================

describe('executeChatActions — duplicate detection (Round 5)', () => {
    it('rejects adding operation with duplicate name', () => {
        const doc = makeDoc([{ id: 'op-1', opNumber: '10', name: 'Soldadura MIG', workElements: [] }]);
        const action: ChatAction = {
            action: 'addOperation', path: {},
            data: { opNumber: '50', name: 'Soldadura MIG' },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Ya existe');
        expect(result.newDoc.operations).toHaveLength(1);
    });

    it('rejects adding operation with duplicate name (case-insensitive)', () => {
        const doc = makeDoc([{ id: 'op-1', opNumber: '10', name: 'Soldadura MIG', workElements: [] }]);
        const action: ChatAction = {
            action: 'addOperation', path: {},
            data: { opNumber: '50', name: 'soldadura mig' },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(0);
        expect(result.errors).toHaveLength(1);
    });

    it('rejects adding operation with duplicate opNumber', () => {
        const doc = makeDoc([{ id: 'op-1', opNumber: '10', name: 'Soldadura MIG', workElements: [] }]);
        const action: ChatAction = {
            action: 'addOperation', path: {},
            data: { opNumber: '10', name: 'Otro Proceso' },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(0);
        expect(result.errors[0]).toContain('Ya existe');
    });

    it('allows adding operation with different name and opNumber', () => {
        const doc = makeDoc([{ id: 'op-1', opNumber: '10', name: 'Soldadura MIG', workElements: [] }]);
        const action: ChatAction = {
            action: 'addOperation', path: {},
            data: { opNumber: '20', name: 'Pintura' },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(1);
        expect(result.newDoc.operations).toHaveLength(2);
    });
});

// ============================================================================
// Round 5 B3: AP compliance warnings in addCause
// ============================================================================

describe('executeChatActions — AP warnings (Round 5)', () => {
    it('includes AP level in created message', () => {
        const doc = makeFullDoc();
        const action: ChatAction = {
            action: 'addCause',
            path: { opName: 'Soldadura', weType: 'Machine', funcDesc: 'cordón', failDesc: 'Porosidad' },
            data: { cause: 'Boquilla obstruida', occurrence: 5, detection: 7 },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(1);
        // Created message should contain AP= something
        expect(result.created.some(c => c.includes('AP='))).toBe(true);
    });

    it('warns when AP=H and no actions defined', () => {
        const doc = makeFullDoc();
        const action: ChatAction = {
            action: 'addCause',
            path: { opName: 'Soldadura', weType: 'Machine', funcDesc: 'cordón', failDesc: 'Porosidad' },
            // S=8, O=8, D=8 → AP should be H
            data: { cause: 'Causa critica sin acciones', occurrence: 8, detection: 8 },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(1);
        // Should have a warning about AP=Alto requiring actions (in warnings, not errors)
        expect(result.warnings.some(w => w.includes('AP=Alto') || w.includes('acciones'))).toBe(true);
        expect(result.errors.filter(e => e.includes('AP=Alto'))).toHaveLength(0);
    });

    it('does not warn when AP=H but actions are defined', () => {
        const doc = makeFullDoc();
        const action: ChatAction = {
            action: 'addCause',
            path: { opName: 'Soldadura', weType: 'Machine', funcDesc: 'cordón', failDesc: 'Porosidad' },
            data: {
                cause: 'Causa con accion',
                occurrence: 8, detection: 8,
                preventionAction: 'Implementar Poka-Yoke',
            },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(1);
        // No AP warning since preventionAction is defined
        expect(result.warnings.filter(w => w.includes('AP=Alto'))).toHaveLength(0);
    });
});

// ============================================================================
// Audit R8: Empty name/opNumber rejection (Fix 1.2)
// ============================================================================

describe('executeChatActions — empty name rejection (Audit R8)', () => {
    it('rejects addOperation with empty name AND empty opNumber', () => {
        const action: ChatAction = {
            action: 'addOperation', path: {},
            data: { name: '', opNumber: '' },
        };
        const result = executeChatActions([action], emptyDoc);
        expect(result.applied).toBe(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Se requiere');
    });

    it('rejects addOperation with whitespace-only name AND opNumber', () => {
        const action: ChatAction = {
            action: 'addOperation', path: {},
            data: { name: '   ', opNumber: '  ' },
        };
        const result = executeChatActions([action], emptyDoc);
        expect(result.applied).toBe(0);
        expect(result.errors).toHaveLength(1);
    });

    it('allows addOperation with empty name but valid opNumber', () => {
        const action: ChatAction = {
            action: 'addOperation', path: {},
            data: { name: '', opNumber: '10' },
        };
        const result = executeChatActions([action], emptyDoc);
        expect(result.applied).toBe(1);
        expect(result.newDoc.operations).toHaveLength(1);
    });

    it('allows addOperation with valid name but empty opNumber', () => {
        const action: ChatAction = {
            action: 'addOperation', path: {},
            data: { name: 'Soldadura', opNumber: '' },
        };
        const result = executeChatActions([action], emptyDoc);
        expect(result.applied).toBe(1);
    });
});

// ============================================================================
// Audit R8: Whitespace collapse in normalize (Fix 1.6)
// ============================================================================

describe('executeChatActions — whitespace collapse (Audit R8)', () => {
    it('matches operation name with extra whitespace', () => {
        const doc = makeDoc([{ id: 'op-1', opNumber: '10', name: 'Soldadura MIG', workElements: [] }]);
        const action: ChatAction = {
            action: 'addWorkElement',
            path: { opName: 'Soldadura  MIG' }, // extra space
            data: { type: 'Machine', name: 'Robot' },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(1);
    });

    it('detects duplicates despite whitespace differences', () => {
        const doc = makeDoc([{ id: 'op-1', opNumber: '10', name: 'Soldadura  MIG', workElements: [] }]);
        const action: ChatAction = {
            action: 'addOperation', path: {},
            data: { name: 'Soldadura MIG', opNumber: '20' },
        };
        const result = executeChatActions([action], doc);
        expect(result.applied).toBe(0);
        expect(result.errors[0]).toContain('Ya existe');
    });
});
