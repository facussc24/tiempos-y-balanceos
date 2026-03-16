import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    CP_CHAT_SYSTEM_PROMPT_TEMPLATE,
    buildCpChatPrompt,
    serializeCpCompact,
    serializeAmfeContext,
    parseCpChatResponse,
    executeCpChatActions,
    resolveItem,
    resolveItemsByFilter,
    sendCpChatMessage,
    CpChatAction,
} from '../../../modules/controlPlan/cpChatEngine';
import { ControlPlanDocument, ControlPlanItem, EMPTY_CP_HEADER } from '../../../modules/controlPlan/controlPlanTypes';
import { AmfeDocument } from '../../../modules/amfe/amfeTypes';
import { GeminiError } from '../../../utils/geminiClient';

// ============================================================================
// HELPERS
// ============================================================================

function makeItem(overrides?: Partial<ControlPlanItem>): ControlPlanItem {
    return {
        id: 'item-1',
        processStepNumber: '10',
        processDescription: 'Soldadura MIG',
        machineDeviceTool: 'Robot Soldador',
        characteristicNumber: 'C-001',
        productCharacteristic: 'Cordón de soldadura',
        processCharacteristic: 'Corriente de soldadura',
        specialCharClass: 'SC',
        specification: '200-250A',
        evaluationTechnique: 'Inspección visual',
        sampleSize: '5 piezas',
        sampleFrequency: 'Cada hora',
        controlMethod: 'SPC carta X-R',
        reactionPlan: 'Contener producto',
        reactionPlanOwner: 'Operador',
        controlProcedure: '',
        amfeAp: 'H',
        amfeSeverity: 8,
        operationCategory: 'soldadura',
        ...overrides,
    };
}

function makeCpDoc(items?: ControlPlanItem[]): ControlPlanDocument {
    return {
        header: { ...EMPTY_CP_HEADER, partName: 'TestPieza', partNumber: 'PN-100', linkedAmfeProject: 'TestAMFE' },
        items: items || [makeItem()],
    };
}

function makeAmfeDoc(): AmfeDocument {
    return {
        header: {
            organization: 'BARACK', location: 'PLANT', client: 'Client',
            modelYear: '2025', subject: 'Test AMFE', startDate: '2025-01-01',
            revDate: '', team: 'Team', amfeNumber: 'A-001', responsible: 'Resp',
            confidentiality: '-', partNumber: 'PN-100', processResponsible: 'PR',
            revision: 'Rev-A', approvedBy: 'Appr', scope: '', applicableParts: '',
        },
        operations: [{
            id: 'op1', opNumber: '10', name: 'Soldadura MIG',
            workElements: [{
                id: 'we1', type: 'Machine', name: 'Robot Soldador',
                functions: [{
                    id: 'f1', description: 'Soldar piezas', requirements: '',
                    failures: [{
                        id: 'fail1', description: 'No suelda',
                        effectLocal: '', effectNextLevel: '', effectEndUser: 'Pieza defectuosa',
                        severity: 8,
                        causes: [{
                            id: 'c1', cause: 'Electrodo gastado',
                            preventionControl: 'Mantenimiento preventivo',
                            detectionControl: 'Inspección visual 100%',
                            occurrence: 5, detection: 6, ap: 'H',
                            characteristicNumber: 'C-001', specialChar: '', filterCode: '',
                            preventionAction: '', detectionAction: '', responsible: '',
                            targetDate: '', status: '', actionTaken: '', completionDate: '',
                            severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
                            observations: '',
                        }],
                    }],
                }],
            }],
        }],
    };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

describe('CP_CHAT_SYSTEM_PROMPT_TEMPLATE', () => {
    it('contains AIAG CP reference', () => {
        expect(CP_CHAT_SYSTEM_PROMPT_TEMPLATE).toContain('AIAG');
        expect(CP_CHAT_SYSTEM_PROMPT_TEMPLATE).toContain('Plan de Control');
    });

    it('contains action schema', () => {
        expect(CP_CHAT_SYSTEM_PROMPT_TEMPLATE).toContain('addItem');
        expect(CP_CHAT_SYSTEM_PROMPT_TEMPLATE).toContain('updateItem');
        expect(CP_CHAT_SYSTEM_PROMPT_TEMPLATE).toContain('removeItem');
        expect(CP_CHAT_SYSTEM_PROMPT_TEMPLATE).toContain('bulkUpdate');
        expect(CP_CHAT_SYSTEM_PROMPT_TEMPLATE).toContain('suggestControls');
        expect(CP_CHAT_SYSTEM_PROMPT_TEMPLATE).toContain('validateCP');
    });

    it('contains severity rules', () => {
        expect(CP_CHAT_SYSTEM_PROMPT_TEMPLATE).toContain('S>=9');
        expect(CP_CHAT_SYSTEM_PROMPT_TEMPLATE).toContain('S=7-8');
    });

    it('contains AP rules', () => {
        expect(CP_CHAT_SYSTEM_PROMPT_TEMPLATE).toContain('AP=H');
        expect(CP_CHAT_SYSTEM_PROMPT_TEMPLATE).toContain('AP=M');
        expect(CP_CHAT_SYSTEM_PROMPT_TEMPLATE).toContain('AP=L');
    });

    it('contains CP 2024 rules', () => {
        expect(CP_CHAT_SYSTEM_PROMPT_TEMPLATE).toContain('reactionPlanOwner');
        expect(CP_CHAT_SYSTEM_PROMPT_TEMPLATE).toContain('Poka-Yoke');
    });

    it('has placeholders for data injection', () => {
        expect(CP_CHAT_SYSTEM_PROMPT_TEMPLATE).toContain('{CP_DATA}');
        expect(CP_CHAT_SYSTEM_PROMPT_TEMPLATE).toContain('{AMFE_CONTEXT}');
    });
});

// ============================================================================
// SERIALIZATION
// ============================================================================

describe('serializeCpCompact', () => {
    it('serializes header info', () => {
        const doc = makeCpDoc();
        const result = serializeCpCompact(doc);
        expect(result).toContain('TestPieza');
        expect(result).toContain('PN-100');
        expect(result).toContain('TestAMFE');
    });

    it('serializes items as table', () => {
        const doc = makeCpDoc();
        const result = serializeCpCompact(doc);
        expect(result).toContain('Soldadura MIG');
        expect(result).toContain('Robot Soldador');
        expect(result).toContain('SPC carta X-R');
    });

    it('handles empty CP', () => {
        const doc = makeCpDoc([]);
        const result = serializeCpCompact(doc);
        expect(result).toContain('Sin items');
    });
});

describe('serializeAmfeContext', () => {
    it('serializes AMFE causes with AP=H/M', () => {
        const amfe = makeAmfeDoc();
        const result = serializeAmfeContext(amfe);
        expect(result).toContain('Soldadura MIG');
        expect(result).toContain('Electrodo gastado');
        expect(result).toContain('AP=H');
    });

    it('returns empty string when no H/M causes', () => {
        const amfe = makeAmfeDoc();
        amfe.operations[0].workElements[0].functions[0].failures[0].causes[0].ap = 'L';
        const result = serializeAmfeContext(amfe);
        expect(result).toBe('');
    });
});

describe('buildCpChatPrompt', () => {
    it('replaces placeholders', () => {
        const doc = makeCpDoc();
        const result = buildCpChatPrompt(doc);
        expect(result).not.toContain('{CP_DATA}');
        expect(result).not.toContain('{AMFE_CONTEXT}');
        expect(result).toContain('TestPieza');
    });

    it('includes AMFE context when provided', () => {
        const doc = makeCpDoc();
        const amfe = makeAmfeDoc();
        const result = buildCpChatPrompt(doc, amfe);
        expect(result).toContain('AMFE VINCULADO');
        expect(result).toContain('Electrodo gastado');
    });

    it('shows no AMFE when not provided', () => {
        const doc = makeCpDoc();
        const result = buildCpChatPrompt(doc);
        expect(result).toContain('Sin AMFE vinculado');
    });
});

// ============================================================================
// PARSER
// ============================================================================

describe('parseCpChatResponse', () => {
    it('parses valid JSON response', () => {
        const text = '{"message":"Test","actions":[{"action":"addItem","data":{"processDescription":"Test"}}],"questions":[]}';
        const result = parseCpChatResponse(text);
        expect(result.message).toBe('Test');
        expect(result.actions).toHaveLength(1);
        expect(result.actions[0].action).toBe('addItem');
    });

    it('strips markdown code blocks', () => {
        const text = '```json\n{"message":"OK","actions":[],"questions":[]}\n```';
        const result = parseCpChatResponse(text);
        expect(result.message).toBe('OK');
    });

    it('rejects HTML responses', () => {
        expect(() => parseCpChatResponse('<html>Error</html>')).toThrow(GeminiError);
        expect(() => parseCpChatResponse('<!DOCTYPE html>')).toThrow(GeminiError);
    });

    it('throws on non-JSON', () => {
        expect(() => parseCpChatResponse('This is not JSON')).toThrow(GeminiError);
    });

    it('sanitizes unknown action types to updateItem', () => {
        const text = '{"message":"OK","actions":[{"action":"unknownAction","data":{}}],"questions":[]}';
        const result = parseCpChatResponse(text);
        expect(result.actions[0].action).toBe('updateItem');
    });

    it('extracts questions', () => {
        const text = '{"message":"Tengo una duda","actions":[],"questions":["¿Qué severidad tiene?"]}';
        const result = parseCpChatResponse(text);
        expect(result.questions).toEqual(['¿Qué severidad tiene?']);
    });

    it('handles empty actions array', () => {
        const text = '{"message":"No se qué hacer","actions":[],"questions":[]}';
        const result = parseCpChatResponse(text);
        expect(result.actions).toEqual([]);
    });

    it('parses target with processDescription and index', () => {
        const text = '{"message":"OK","actions":[{"action":"updateItem","target":{"processDescription":"Soldadura","index":1},"data":{"sampleSize":"100%"}}],"questions":[]}';
        const result = parseCpChatResponse(text);
        expect(result.actions[0].target?.processDescription).toBe('Soldadura');
        expect(result.actions[0].target?.index).toBe(1);
    });
});

// ============================================================================
// ENTITY RESOLUTION
// ============================================================================

describe('resolveItem', () => {
    const items = [
        makeItem({ id: 'item-1', processDescription: 'Soldadura MIG' }),
        makeItem({ id: 'item-2', processDescription: 'Ensamble Final' }),
        makeItem({ id: 'item-3', processDescription: 'Pintura Electrostática' }),
    ];

    it('resolves by exact processDescription', () => {
        const result = resolveItem(items, { processDescription: 'Soldadura MIG' });
        expect(result?.id).toBe('item-1');
    });

    it('resolves by substring processDescription', () => {
        const result = resolveItem(items, { processDescription: 'soldadura' });
        expect(result?.id).toBe('item-1');
    });

    it('resolves by index (1-based)', () => {
        const result = resolveItem(items, { index: 2 });
        expect(result?.id).toBe('item-2');
    });

    it('returns null for out-of-range index', () => {
        expect(resolveItem(items, { index: 0 })).toBeNull();
        expect(resolveItem(items, { index: 10 })).toBeNull();
    });

    it('returns null when no match', () => {
        const result = resolveItem(items, { processDescription: 'Inyección' });
        expect(result).toBeNull();
    });

    it('returns null with no target', () => {
        expect(resolveItem(items)).toBeNull();
    });

    it('prefers exact match over substring', () => {
        const testItems = [
            makeItem({ id: 'a', processDescription: 'Sold' }),
            makeItem({ id: 'b', processDescription: 'Soldadura MIG' }),
        ];
        const result = resolveItem(testItems, { processDescription: 'Sold' });
        expect(result?.id).toBe('a');
    });
});

describe('resolveItemsByFilter', () => {
    const items = [
        makeItem({ id: '1', processDescription: 'Soldadura MIG', amfeAp: 'H', reactionPlanOwner: 'Operador', specialCharClass: 'CC' }),
        makeItem({ id: '2', processDescription: 'Soldadura TIG', amfeAp: 'M', reactionPlanOwner: '', specialCharClass: 'SC' }),
        makeItem({ id: '3', processDescription: 'Ensamble', amfeAp: 'H', reactionPlanOwner: 'Supervisor', specialCharClass: '' }),
    ];

    it('filters by AP=H', () => {
        const result = resolveItemsByFilter(items, 'AP=H');
        expect(result).toHaveLength(2);
    });

    it('filters by AP=M', () => {
        const result = resolveItemsByFilter(items, 'AP=M');
        expect(result).toHaveLength(1);
    });

    it('filters by "sin responsable"', () => {
        const result = resolveItemsByFilter(items, 'sin responsable');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('2');
    });

    it('filters by CC', () => {
        const result = resolveItemsByFilter(items, 'CC');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('1');
    });

    it('filters by process name substring', () => {
        const result = resolveItemsByFilter(items, 'soldadura');
        expect(result).toHaveLength(2);
    });

    it('returns empty for no match', () => {
        const result = resolveItemsByFilter(items, 'inyección');
        expect(result).toHaveLength(0);
    });

    it('filters CC with extra text like "CC items"', () => {
        const result = resolveItemsByFilter(items, 'CC items');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('1');
    });

    it('filters SC with extra text like "los SC"', () => {
        const result = resolveItemsByFilter(items, 'los SC');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('2');
    });
});

// ============================================================================
// EXECUTE ACTIONS
// ============================================================================

describe('executeCpChatActions: addItem', () => {
    it('adds a new item to the CP', () => {
        const doc = makeCpDoc([]);
        const actions: CpChatAction[] = [
            { action: 'addItem', data: { processDescription: 'Nuevo Proceso', controlMethod: 'SPC', reactionPlanOwner: 'Operador' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.applied).toBe(1);
        expect(result.created).toHaveLength(1);
        expect(result.newDoc.items).toHaveLength(1);
        expect(result.newDoc.items[0].processDescription).toBe('Nuevo Proceso');
    });

    it('detects duplicates', () => {
        const doc = makeCpDoc([makeItem({ processDescription: 'Soldadura MIG', productCharacteristic: 'Cordón' })]);
        const actions: CpChatAction[] = [
            { action: 'addItem', data: { processDescription: 'Soldadura MIG', productCharacteristic: 'Cordón' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.applied).toBe(0);
        expect(result.warnings.some(w => w.includes('duplicado'))).toBe(true);
    });

    it('warns on Poka-Yoke without verification frequency', () => {
        const doc = makeCpDoc([]);
        const actions: CpChatAction[] = [
            { action: 'addItem', data: { processDescription: 'Test', controlMethod: 'Poka-Yoke geométrico', sampleFrequency: 'Cada pieza', reactionPlanOwner: 'Operador' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.applied).toBe(1);
        expect(result.warnings.some(w => w.includes('Poka-Yoke'))).toBe(true);
    });

    it('warns on missing owner', () => {
        const doc = makeCpDoc([]);
        const actions: CpChatAction[] = [
            { action: 'addItem', data: { processDescription: 'Test' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.warnings.some(w => w.includes('Responsable'))).toBe(true);
    });

    it('sets operationCategory from processDescription', () => {
        const doc = makeCpDoc([]);
        const actions: CpChatAction[] = [
            { action: 'addItem', data: { processDescription: 'Soldadura MIG', reactionPlanOwner: 'Op' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.newDoc.items[0].operationCategory).toBe('soldadura');
    });

    it('detects duplicates when productCharacteristic is empty', () => {
        const doc = makeCpDoc([makeItem({ processDescription: 'Ensamble Final', productCharacteristic: '' })]);
        const actions: CpChatAction[] = [
            { action: 'addItem', data: { processDescription: 'Ensamble Final', productCharacteristic: '' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.applied).toBe(0);
        expect(result.warnings.some(w => w.includes('duplicado'))).toBe(true);
    });

    it('reads amfeAp and amfeSeverity from action data', () => {
        const doc = makeCpDoc([]);
        const actions: CpChatAction[] = [
            { action: 'addItem', data: { processDescription: 'Soldadura Punto', amfeAp: 'H', amfeSeverity: 9, reactionPlanOwner: 'Supervisor' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.applied).toBe(1);
        expect(result.newDoc.items[0].amfeAp).toBe('H');
        expect(result.newDoc.items[0].amfeSeverity).toBe(9);
    });

    it('clamps amfeSeverity to 1-10 range', () => {
        const doc = makeCpDoc([]);
        const actions: CpChatAction[] = [
            { action: 'addItem', data: { processDescription: 'Test', amfeSeverity: 15, reactionPlanOwner: 'Op' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.newDoc.items[0].amfeSeverity).toBe(10);
    });

    it('ignores invalid amfeAp values', () => {
        const doc = makeCpDoc([]);
        const actions: CpChatAction[] = [
            { action: 'addItem', data: { processDescription: 'Test', amfeAp: 'INVALID', reactionPlanOwner: 'Op' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.newDoc.items[0].amfeAp).toBe('');
    });

    it('addItem warns when reactionPlanOwner is empty (CP 2024 mandatory)', () => {
        const doc = makeCpDoc([]);
        const actions: CpChatAction[] = [{
            action: 'addItem',
            data: {
                processDescription: 'Soldadura MIG',
                processStepNumber: '10',
                controlMethod: 'SPC',
            },
        }];
        const result = executeCpChatActions(actions, doc);
        expect(result.newDoc.items).toHaveLength(1);
        expect(result.newDoc.items[0].reactionPlanOwner).toBe('');
        expect(result.warnings.some(w => w.includes('Falta Responsable'))).toBe(true);
    });
});

describe('executeCpChatActions: updateItem', () => {
    it('updates a single field', () => {
        const doc = makeCpDoc([makeItem()]);
        const actions: CpChatAction[] = [
            { action: 'updateItem', target: { processDescription: 'Soldadura' }, data: { sampleFrequency: 'Cada turno' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.applied).toBe(1);
        expect(result.newDoc.items[0].sampleFrequency).toBe('Cada turno');
    });

    it('updates multiple fields', () => {
        const doc = makeCpDoc([makeItem()]);
        const actions: CpChatAction[] = [
            { action: 'updateItem', target: { index: 1 }, data: { sampleSize: '100%', sampleFrequency: 'Cada pieza' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.applied).toBe(1);
        expect(result.newDoc.items[0].sampleSize).toBe('100%');
        expect(result.newDoc.items[0].sampleFrequency).toBe('Cada pieza');
    });

    it('errors when item not found', () => {
        const doc = makeCpDoc([makeItem()]);
        const actions: CpChatAction[] = [
            { action: 'updateItem', target: { processDescription: 'Inyección' }, data: { sampleSize: '100%' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.errors).toHaveLength(1);
        expect(result.applied).toBe(0);
    });

    it('ignores non-editable fields', () => {
        const doc = makeCpDoc([makeItem()]);
        const actions: CpChatAction[] = [
            { action: 'updateItem', target: { index: 1 }, data: { id: 'hacked', sampleSize: '100%' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.newDoc.items[0].id).toBe('item-1');
        expect(result.newDoc.items[0].sampleSize).toBe('100%');
    });

    it('updates operationCategory when processDescription changes', () => {
        const doc = makeCpDoc([makeItem()]);
        const actions: CpChatAction[] = [
            { action: 'updateItem', target: { index: 1 }, data: { processDescription: 'Pintura electrostática' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.newDoc.items[0].operationCategory).toBe('pintura');
    });
});

describe('executeCpChatActions: removeItem', () => {
    it('removes an item by description', () => {
        const doc = makeCpDoc([makeItem(), makeItem({ id: 'item-2', processDescription: 'Ensamble' })]);
        const actions: CpChatAction[] = [
            { action: 'removeItem', target: { processDescription: 'Ensamble' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.applied).toBe(1);
        expect(result.removed).toHaveLength(1);
        expect(result.newDoc.items).toHaveLength(1);
    });

    it('warns when removing CC/SC item', () => {
        const doc = makeCpDoc([makeItem({ specialCharClass: 'CC' })]);
        const actions: CpChatAction[] = [
            { action: 'removeItem', target: { processDescription: 'Soldadura' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.warnings.some(w => w.includes('CC'))).toBe(true);
    });

    it('warns when removing AP=H item', () => {
        const doc = makeCpDoc([makeItem({ amfeAp: 'H' })]);
        const actions: CpChatAction[] = [
            { action: 'removeItem', target: { processDescription: 'Soldadura' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.warnings.some(w => w.includes('Alto (H)'))).toBe(true);
    });

    it('errors when item not found', () => {
        const doc = makeCpDoc([makeItem()]);
        const actions: CpChatAction[] = [
            { action: 'removeItem', target: { processDescription: 'Inyección' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.errors).toHaveLength(1);
        expect(result.applied).toBe(0);
    });
});

describe('executeCpChatActions: bulkUpdate', () => {
    it('updates multiple items by filter', () => {
        const doc = makeCpDoc([
            makeItem({ id: '1', processDescription: 'Soldadura MIG', sampleFrequency: 'Cada turno' }),
            makeItem({ id: '2', processDescription: 'Soldadura TIG', sampleFrequency: 'Cada turno' }),
            makeItem({ id: '3', processDescription: 'Ensamble', sampleFrequency: 'Cada turno' }),
        ]);
        const actions: CpChatAction[] = [
            { action: 'bulkUpdate', target: { filter: 'soldadura' }, data: { sampleFrequency: 'Cada hora' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.applied).toBe(1);
        expect(result.modified[0]).toContain('2 item(s)');
        expect(result.newDoc.items[0].sampleFrequency).toBe('Cada hora');
        expect(result.newDoc.items[1].sampleFrequency).toBe('Cada hora');
        expect(result.newDoc.items[2].sampleFrequency).toBe('Cada turno');
    });

    it('filters by AP=H', () => {
        const doc = makeCpDoc([
            makeItem({ id: '1', amfeAp: 'H' }),
            makeItem({ id: '2', amfeAp: 'M' }),
        ]);
        const actions: CpChatAction[] = [
            { action: 'bulkUpdate', target: { filter: 'AP=H' }, data: { sampleSize: '100%' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.newDoc.items[0].sampleSize).toBe('100%');
        expect(result.newDoc.items[1].sampleSize).toBe('5 piezas');
    });

    it('errors when no filter provided', () => {
        const doc = makeCpDoc([makeItem()]);
        const actions: CpChatAction[] = [
            { action: 'bulkUpdate', data: { sampleSize: '100%' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.errors.some(e => e.includes('filter'))).toBe(true);
    });

    it('errors when no items match filter', () => {
        const doc = makeCpDoc([makeItem()]);
        const actions: CpChatAction[] = [
            { action: 'bulkUpdate', target: { filter: 'inyección' }, data: { sampleSize: '100%' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.errors.some(e => e.includes('No se encontraron'))).toBe(true);
    });
});

describe('executeCpChatActions: validateCP', () => {
    it('detects missing owners', () => {
        const doc = makeCpDoc([makeItem({ reactionPlanOwner: '' })]);
        const actions: CpChatAction[] = [{ action: 'validateCP' }];
        const result = executeCpChatActions(actions, doc);
        expect(result.warnings.some(w => w.includes('Responsable'))).toBe(true);
    });

    it('detects Poka-Yoke without verification', () => {
        const doc = makeCpDoc([makeItem({ controlMethod: 'Poka-Yoke', sampleFrequency: 'Cada pieza' })]);
        const actions: CpChatAction[] = [{ action: 'validateCP' }];
        const result = executeCpChatActions(actions, doc);
        expect(result.warnings.some(w => w.includes('Poka-Yoke'))).toBe(true);
    });

    it('detects AP=H without reaction plan', () => {
        const doc = makeCpDoc([makeItem({ amfeAp: 'H', reactionPlan: '' })]);
        const actions: CpChatAction[] = [{ action: 'validateCP' }];
        const result = executeCpChatActions(actions, doc);
        expect(result.warnings.some(w => w.includes('AP=H'))).toBe(true);
    });

    it('detects AP=H without control method', () => {
        const doc = makeCpDoc([makeItem({ amfeAp: 'H', controlMethod: '' })]);
        const actions: CpChatAction[] = [{ action: 'validateCP' }];
        const result = executeCpChatActions(actions, doc);
        expect(result.warnings.some(w => w.includes('sin método de control'))).toBe(true);
    });

    it('reports clean doc', () => {
        const doc = makeCpDoc([makeItem()]);
        const actions: CpChatAction[] = [{ action: 'validateCP' }];
        const result = executeCpChatActions(actions, doc);
        expect(result.applied).toBe(1);
        expect(result.warnings.filter(w => !w.includes('Validación ejecutada'))).toHaveLength(0);
    });
});

describe('executeCpChatActions: mixed actions', () => {
    it('executes multiple actions sequentially', () => {
        const doc = makeCpDoc([makeItem()]);
        const actions: CpChatAction[] = [
            { action: 'addItem', data: { processDescription: 'Ensamble', reactionPlanOwner: 'Op' } },
            { action: 'updateItem', target: { processDescription: 'Soldadura' }, data: { sampleSize: '100%' } },
        ];
        const result = executeCpChatActions(actions, doc);
        expect(result.applied).toBe(2);
        expect(result.newDoc.items).toHaveLength(2);
    });

    it('does not mutate original document', () => {
        const doc = makeCpDoc([makeItem()]);
        const original = JSON.stringify(doc);
        executeCpChatActions([{ action: 'addItem', data: { processDescription: 'New' } }], doc);
        expect(JSON.stringify(doc)).toBe(original);
    });
});

// ============================================================================
// SEND CHAT MESSAGE
// ============================================================================

vi.mock('../../../utils/geminiClient', async (importOriginal) => {
    const original = await importOriginal() as any;
    return {
        ...original,
        queryGeminiChat: vi.fn(),
    };
});

describe('sendCpChatMessage', () => {
    let queryGeminiChat: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        const mod = await import('../../../utils/geminiClient');
        queryGeminiChat = mod.queryGeminiChat as any;
        queryGeminiChat.mockReset();
    });

    it('sends message and parses response', async () => {
        queryGeminiChat.mockResolvedValueOnce({
            text: '{"message":"OK","actions":[{"action":"addItem","data":{"processDescription":"Test","reactionPlanOwner":"Op"}}],"questions":[]}',
        });

        const doc = makeCpDoc([]);
        const { response, history } = await sendCpChatMessage('Agrega un item', doc, []);
        expect(response.message).toBe('OK');
        expect(response.actions).toHaveLength(1);
        expect(history).toHaveLength(2); // user + assistant
    });

    it('passes AMFE context when available', async () => {
        queryGeminiChat.mockResolvedValueOnce({
            text: '{"message":"OK","actions":[],"questions":[]}',
        });

        const doc = makeCpDoc([]);
        const amfe = makeAmfeDoc();
        await sendCpChatMessage('Test', doc, [], amfe);

        const systemPrompt = queryGeminiChat.mock.calls[0][0];
        expect(systemPrompt).toContain('AMFE VINCULADO');
    });

    it('caps history at 10 turns', async () => {
        queryGeminiChat.mockResolvedValueOnce({
            text: '{"message":"OK","actions":[],"questions":[]}',
        });

        // Build 25 messages of history
        const longHistory = Array.from({ length: 25 }, (_, i) => ({
            role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
            content: `Message ${i}`,
        }));

        const doc = makeCpDoc([]);
        await sendCpChatMessage('New msg', doc, longHistory);

        // History passed to Gemini should be trimmed (20 = 10 turns * 2 + 1 new user msg)
        const historyArg = queryGeminiChat.mock.calls[0][1];
        expect(historyArg.length).toBeLessThanOrEqual(21);
    });

    it('throws on Gemini error', async () => {
        queryGeminiChat.mockRejectedValueOnce(new GeminiError('No key', 'NO_KEY'));

        const doc = makeCpDoc([]);
        await expect(sendCpChatMessage('Test', doc, [])).rejects.toThrow(GeminiError);
    });

    it('throws on HTML response', async () => {
        queryGeminiChat.mockResolvedValueOnce({
            text: '<!DOCTYPE html><html>Rate Limit</html>',
        });

        const doc = makeCpDoc([]);
        await expect(sendCpChatMessage('Test', doc, [])).rejects.toThrow(GeminiError);
    });
});

// ============================================================================
// Audit R8: amfeSeverity string parsing (Fix 1.5)
// ============================================================================

describe('executeCpChatActions: amfeSeverity string parsing (Audit R8)', () => {
    it('parses amfeSeverity from string to number', () => {
        const doc = makeCpDoc([]);
        const actions: CpChatAction[] = [{
            action: 'addItem',
            data: { processDescription: 'Test', amfeSeverity: '8' as any, reactionPlanOwner: 'Op' },
        }];
        const result = executeCpChatActions(actions, doc);
        expect(result.applied).toBe(1);
        expect(result.newDoc.items[0].amfeSeverity).toBe(8);
    });

    it('clamps amfeSeverity > 10 to 10', () => {
        const doc = makeCpDoc([]);
        const actions: CpChatAction[] = [{
            action: 'addItem',
            data: { processDescription: 'Test', amfeSeverity: 15 as any, reactionPlanOwner: 'Op' },
        }];
        const result = executeCpChatActions(actions, doc);
        expect(result.newDoc.items[0].amfeSeverity).toBe(10);
    });

    it('clamps amfeSeverity < 1 to undefined', () => {
        const doc = makeCpDoc([]);
        const actions: CpChatAction[] = [{
            action: 'addItem',
            data: { processDescription: 'Test', amfeSeverity: 0 as any, reactionPlanOwner: 'Op' },
        }];
        const result = executeCpChatActions(actions, doc);
        expect(result.newDoc.items[0].amfeSeverity).toBeUndefined();
    });

    it('handles amfeSeverity as float string "7.6" → rounds to 8', () => {
        const doc = makeCpDoc([]);
        const actions: CpChatAction[] = [{
            action: 'addItem',
            data: { processDescription: 'Test', amfeSeverity: '7.6' as any, reactionPlanOwner: 'Op' },
        }];
        const result = executeCpChatActions(actions, doc);
        expect(result.newDoc.items[0].amfeSeverity).toBe(8);
    });
});

// ============================================================================
// Audit R8: Whitespace collapse in resolve (Fix 1.6)
// ============================================================================

describe('executeCpChatActions: whitespace collapse in resolve (Audit R8)', () => {
    it('resolves item by processDescription with extra whitespace', () => {
        const doc = makeCpDoc([makeItem({ processDescription: 'Soldadura  MIG' })]);
        const actions: CpChatAction[] = [{
            action: 'updateItem',
            target: { processDescription: 'Soldadura MIG' },
            data: { sampleSize: '100%' },
        }];
        const result = executeCpChatActions(actions, doc);
        expect(result.applied).toBe(1);
        expect(result.newDoc.items[0].sampleSize).toBe('100%');
    });
});
