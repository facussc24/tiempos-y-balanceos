/**
 * AMFE Chat Copilot Engine
 *
 * Core logic for the AI-powered chat that reads and writes AMFE documents.
 * Uses Gemini 2.5 Flash (free tier). No React dependencies.
 *
 * Architecture:
 * 1. User sends natural language instruction
 * 2. Gemini analyzes intent + current AMFE → returns structured JSON actions
 * 3. Executor resolves entities by name and applies mutations on a deep clone
 * 4. Modified document returned for loadData()
 */

import { queryGeminiChat, GeminiError, ChatMessage } from '../../utils/geminiClient';
import { serializeAmfeCompact } from './amfeChangeAnalysis';
import { calculateAP } from './apTable';
import {
    AmfeDocument, AmfeOperation, AmfeWorkElement, AmfeFunction,
    AmfeFailure, AmfeCause, ActionPriority, WorkElementType,
    createEmptyCause, WORK_ELEMENT_TYPES,
} from './amfeTypes';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export type ChatActionType =
    | 'addOperation' | 'addWorkElement' | 'addFunction' | 'addFailure' | 'addCause'
    | 'updateOperation' | 'updateWorkElement' | 'updateFunction' | 'updateFailure' | 'updateCause';

export interface ChatActionPath {
    opName?: string;
    weType?: string;
    weName?: string;
    funcDesc?: string;
    failDesc?: string;
    causeDesc?: string;
}

export interface ChatAction {
    action: ChatActionType;
    path: ChatActionPath;
    data: Record<string, string | number>;
}

export interface ChatAIResponse {
    message: string;
    actions: ChatAction[];
    questions: string[];
}

export interface ChatExecutionResult {
    applied: number;
    created: string[];
    modified: string[];
    errors: string[];
    warnings: string[];
    newDoc: AmfeDocument;
}

// Re-export for convenience
export type { ChatMessage };

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const CHAT_SYSTEM_PROMPT_TEMPLATE = `Eres un copiloto IA experto en AMFE de procesos (PFMEA) segun AIAG-VDA para manufactura automotriz.
El usuario te dara instrucciones en lenguaje natural en espanol para modificar el AMFE actual.

ESTRUCTURA JERARQUICA DEL AMFE (5 niveles):
1. Operacion (opNumber, name) — un paso del proceso de manufactura
2. Elemento 6M (type, name) — Machine, Man, Material, Method, Environment, Measurement
3. Funcion (description, requirements) — que debe hacer el elemento
4. Modo de Falla (description, effectLocal, effectNextLevel, effectEndUser, severity 1-10)
5. Causa (cause, preventionControl, detectionControl, occurrence 1-10, detection 1-10, responsible, targetDate, status, preventionAction, detectionAction, observations)

ACCIONES DISPONIBLES:
- addOperation: Crear operacion nueva. data: {opNumber, name}
- addWorkElement: Crear elemento 6M. path.opName requerido. data: {type, name}
- addFunction: Crear funcion. path: opName+weType/weName. data: {description, requirements}
- addFailure: Crear modo de falla. path: opName+we+funcDesc. data: {description, effectLocal, effectNextLevel, effectEndUser, severity}
- addCause: Crear causa. path: opName+we+funcDesc+failDesc. data: {cause, preventionControl, detectionControl, occurrence, detection, responsible, targetDate, status, preventionAction, detectionAction}
- updateOperation/updateWorkElement/updateFunction/updateFailure/updateCause: Modificar campos existentes. path identifica la entidad, data contiene los campos a modificar.

ESCALA AIAG-VDA:
- Severidad (S): 1=sin efecto, 4-6=moderado, 7-8=alto, 9-10=critico (seguridad)
- Ocurrencia (O): 1=improbable, 4-6=moderada, 7-8=alta, 9-10=muy alta
- Deteccion (D): 1=casi segura, 4-6=moderada, 7-8=baja, 9-10=imposible
- AP se calcula AUTOMATICAMENTE, NO lo incluyas en data.

REGLAS:
1. Responde SIEMPRE con JSON estricto. Sin markdown, sin explicaciones fuera del JSON.
2. Si falta info critica (ej: no sabes la severidad, no hay contexto suficiente), pedila en "questions".
3. Si el usuario dice "todos/todas", genera multiples actions para cada entidad que aplique.
4. Para encontrar entidades existentes, usa nombres parciales (busqueda case-insensitive).
5. Completa los campos con valores tecnicos apropiados segun AIAG-VDA.
6. Si el usuario habla de agregar algo completo (operacion con fallas y causas), genera TODAS las actions necesarias en secuencia.
7. types de WorkElement validos: Machine, Man, Material, Method, Environment, Measurement

FORMATO DE RESPUESTA:
{
  "message": "Descripcion breve de lo que voy a hacer",
  "actions": [
    {
      "action": "addFailure",
      "path": {"opName": "Soldadura", "weType": "Machine", "funcDesc": "Aplicar cordon"},
      "data": {"description": "Porosidad en cordon", "severity": 8, "effectLocal": "Retrabajo"}
    }
  ],
  "questions": ["Pregunta si falta info"]
}

AMFE ACTUAL:
{AMFE_DATA}`;

// ============================================================================
// PROMPT BUILDER
// ============================================================================

/**
 * Build the system prompt with the current AMFE serialized.
 */
export function buildChatPrompt(doc: AmfeDocument): string {
    const serialized = serializeAmfeCompact(doc);
    const amfeData = serialized || '(AMFE vacio — sin operaciones)';
    return CHAT_SYSTEM_PROMPT_TEMPLATE.replace('{AMFE_DATA}', amfeData);
}

// ============================================================================
// RESPONSE PARSER
// ============================================================================

/**
 * Parse Gemini's response text into a structured ChatAIResponse.
 * Handles markdown code blocks and common LLM output quirks.
 */
export function parseChatResponse(text: string): ChatAIResponse {
    let cleaned = text.trim();

    // Reject HTML responses (rate limiter/proxy error pages)
    if (cleaned.startsWith('<') || cleaned.startsWith('<!DOCTYPE')) {
        throw new GeminiError('Gemini devolvió una respuesta inválida (HTML)', 'PARSE_ERROR');
    }

    // Strip markdown code blocks
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    // Find JSON object
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!objMatch) {
        throw new GeminiError('No se pudo parsear la respuesta de la IA', 'PARSE_ERROR');
    }

    try {
        const parsed = JSON.parse(objMatch[0]);

        const response: ChatAIResponse = {
            message: typeof parsed.message === 'string' ? parsed.message : '',
            actions: Array.isArray(parsed.actions)
                ? parsed.actions
                    .filter((a: any) => a && typeof a === 'object' && typeof a.action === 'string')
                    .map((a: any) => sanitizeAction(a))
                : [],
            questions: Array.isArray(parsed.questions)
                ? parsed.questions.filter((q: any) => typeof q === 'string' && q.trim()).map(String)
                : [],
        };

        return response;
    } catch {
        throw new GeminiError('Respuesta de la IA no es JSON válido', 'PARSE_ERROR');
    }
}

const VALID_ACTION_TYPES = new Set<string>([
    'addOperation', 'addWorkElement', 'addFunction', 'addFailure', 'addCause',
    'updateOperation', 'updateWorkElement', 'updateFunction', 'updateFailure', 'updateCause',
]);

/** Sanitize a single action: validate types, clamp numeric values */
function sanitizeAction(raw: any): ChatAction {
    const rawAction = String(raw.action);
    const action = (VALID_ACTION_TYPES.has(rawAction) ? rawAction : 'updateOperation') as ChatActionType;
    const path: ChatActionPath = {};

    if (raw.path && typeof raw.path === 'object') {
        if (raw.path.opName) path.opName = String(raw.path.opName);
        if (raw.path.weType) path.weType = String(raw.path.weType);
        if (raw.path.weName) path.weName = String(raw.path.weName);
        if (raw.path.funcDesc) path.funcDesc = String(raw.path.funcDesc);
        if (raw.path.failDesc) path.failDesc = String(raw.path.failDesc);
        if (raw.path.causeDesc) path.causeDesc = String(raw.path.causeDesc);
    }

    const SOD_KEYS = new Set(['severity', 'occurrence', 'detection']);
    const data: Record<string, string | number> = {};
    if (raw.data && typeof raw.data === 'object') {
        for (const [key, val] of Object.entries(raw.data)) {
            if (val === null || val === undefined) continue;
            if (typeof val === 'number') {
                // Clamp S/O/D to 1-10
                if (SOD_KEYS.has(key)) {
                    data[key] = Math.max(1, Math.min(10, Math.round(val)));
                } else {
                    data[key] = val;
                }
            } else if (SOD_KEYS.has(key) && typeof val === 'string') {
                // FIX: Gemini sometimes returns S/O/D as strings ("8", "8.5", "+8").
                // Previous regex /^\d+$/ rejected floats like "8.5". Use Number() with
                // isFinite check instead to handle all numeric string formats.
                const parsed = Number(val.trim());
                if (Number.isFinite(parsed)) {
                    data[key] = Math.max(1, Math.min(10, Math.round(parsed)));
                } else {
                    data[key] = val; // Keep original string if not parseable
                }
            } else {
                data[key] = String(val);
            }
        }
    }

    return { action, path, data };
}

// ============================================================================
// ENTITY RESOLUTION (find by name, case-insensitive substring)
// ============================================================================

function normalize(s: string): string {
    return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function matchesByName(target: string, query: string): boolean {
    if (!query) return false;
    return normalize(target).includes(normalize(query));
}

export function resolveOperation(doc: AmfeDocument, opName?: string): AmfeOperation | null {
    if (!opName) return null;
    const q = normalize(opName);
    // Exact name match first, then substring, then opNumber
    return doc.operations.find(op => normalize(op.name) === q)
        || doc.operations.find(op => matchesByName(op.name, opName))
        || doc.operations.find(op => matchesByName(op.opNumber, opName))
        || null;
}

export function resolveWorkElement(op: AmfeOperation, weType?: string, weName?: string): AmfeWorkElement | null {
    if (!weType && !weName) return op.workElements[0] || null;

    let candidates = op.workElements;

    if (weType) {
        const typeMatch = candidates.filter(we => normalize(we.type) === normalize(weType));
        if (typeMatch.length > 0) candidates = typeMatch;
    }

    if (weName) {
        const nameMatch = candidates.find(we => matchesByName(we.name, weName));
        if (nameMatch) return nameMatch;
    }

    return candidates[0] || null;
}

export function resolveFunction(we: AmfeWorkElement, funcDesc?: string): AmfeFunction | null {
    if (!funcDesc) return we.functions[0] || null;
    return we.functions.find(f => matchesByName(f.description, funcDesc))
        || null;
}

export function resolveFailure(func: AmfeFunction, failDesc?: string): AmfeFailure | null {
    if (!failDesc) return func.failures[0] || null;
    return func.failures.find(f => matchesByName(f.description, failDesc))
        || null;
}

export function resolveCause(fail: AmfeFailure, causeDesc?: string): AmfeCause | null {
    if (!causeDesc) return fail.causes[0] || null;
    return fail.causes.find(c => matchesByName(c.cause, causeDesc))
        || null;
}

// ============================================================================
// MUTATION EXECUTOR
// ============================================================================

/**
 * Execute an array of chat actions on a deep clone of the document.
 * Returns the modified document and a summary of changes.
 */
export function executeChatActions(
    actions: ChatAction[],
    currentDoc: AmfeDocument,
): ChatExecutionResult {
    // Deep clone to avoid mutating the original
    const doc: AmfeDocument = JSON.parse(JSON.stringify(currentDoc));
    const result: ChatExecutionResult = {
        applied: 0,
        created: [],
        modified: [],
        errors: [],
        warnings: [],
        newDoc: doc,
    };

    for (const action of actions) {
        try {
            executeOneAction(action, doc, result);
        } catch (err: unknown) {
            result.errors.push(`${action.action}: ${err instanceof Error ? err.message : 'Error desconocido'}`);
        }
    }

    return result;
}

function executeOneAction(action: ChatAction, doc: AmfeDocument, result: ChatExecutionResult): void {
    switch (action.action) {
        case 'addOperation':
            executeAddOperation(action, doc, result);
            break;
        case 'addWorkElement':
            executeAddWorkElement(action, doc, result);
            break;
        case 'addFunction':
            executeAddFunction(action, doc, result);
            break;
        case 'addFailure':
            executeAddFailure(action, doc, result);
            break;
        case 'addCause':
            executeAddCause(action, doc, result);
            break;
        case 'updateOperation':
            executeUpdateOperation(action, doc, result);
            break;
        case 'updateWorkElement':
            executeUpdateWorkElement(action, doc, result);
            break;
        case 'updateFunction':
            executeUpdateFunction(action, doc, result);
            break;
        case 'updateFailure':
            executeUpdateFailure(action, doc, result);
            break;
        case 'updateCause':
            executeUpdateCause(action, doc, result);
            break;
        default:
            result.errors.push(`Acción desconocida: ${action.action}`);
    }
}

// --- ADD operations ---

function executeAddOperation(action: ChatAction, doc: AmfeDocument, result: ChatExecutionResult): void {
    const name = String(action.data.name || '');
    const opNumber = String(action.data.opNumber || '');

    // Reject empty-named operations
    if (!name.trim() && !opNumber.trim()) {
        result.errors.push('addOperation: Se requiere nombre u opNumber');
        return;
    }

    // Duplicate detection
    const existing = doc.operations.find(op =>
        (name && normalize(op.name) === normalize(name))
        || (opNumber && normalize(op.opNumber) === normalize(opNumber))
    );
    if (existing) {
        result.errors.push(`Ya existe la operación "${existing.name}" (${existing.opNumber}). Usa updateOperation para modificarla.`);
        return;
    }

    const op: AmfeOperation = {
        id: uuidv4(),
        opNumber,
        name,
        workElements: [],
    };
    doc.operations.push(op);
    result.applied++;
    result.created.push(`Operación: ${op.name || op.opNumber}`);
}

function executeAddWorkElement(action: ChatAction, doc: AmfeDocument, result: ChatExecutionResult): void {
    const op = resolveOperation(doc, action.path.opName);
    if (!op) {
        result.errors.push(`addWorkElement: No se encontró operación "${action.path.opName}"`);
        return;
    }

    const name = String(action.data.name || '').trim();
    if (!name) {
        result.errors.push('addWorkElement: Se requiere un nombre para el elemento de trabajo');
        return;
    }

    const typeStr = String(action.data.type || 'Machine');
    const type = WORK_ELEMENT_TYPES.includes(typeStr as WorkElementType)
        ? (typeStr as WorkElementType) : 'Machine';

    const we: AmfeWorkElement = {
        id: uuidv4(),
        type,
        name,
        functions: [],
    };
    op.workElements.push(we);
    result.applied++;
    result.created.push(`Elemento ${type}: ${we.name} (en ${op.name})`);
}

function executeAddFunction(action: ChatAction, doc: AmfeDocument, result: ChatExecutionResult): void {
    const op = resolveOperation(doc, action.path.opName);
    if (!op) {
        result.errors.push(`addFunction: No se encontró operación "${action.path.opName}"`);
        return;
    }
    const we = resolveWorkElement(op, action.path.weType, action.path.weName);
    if (!we) {
        result.errors.push(`addFunction: No se encontró elemento en "${op.name}"`);
        return;
    }

    const func: AmfeFunction = {
        id: uuidv4(),
        description: String(action.data.description || ''),
        requirements: String(action.data.requirements || ''),
        failures: [],
    };
    we.functions.push(func);
    result.applied++;
    result.created.push(`Función: ${func.description} (en ${we.name})`);
}

function executeAddFailure(action: ChatAction, doc: AmfeDocument, result: ChatExecutionResult): void {
    const op = resolveOperation(doc, action.path.opName);
    if (!op) {
        result.errors.push(`addFailure: No se encontró operación "${action.path.opName}"`);
        return;
    }
    const we = resolveWorkElement(op, action.path.weType, action.path.weName);
    if (!we) {
        result.errors.push(`addFailure: No se encontró elemento en "${op.name}"`);
        return;
    }
    const func = resolveFunction(we, action.path.funcDesc);
    if (!func) {
        result.errors.push(`addFailure: No se encontró función en "${we.name}"`);
        return;
    }

    const severity = typeof action.data.severity === 'number'
        ? Math.max(1, Math.min(10, action.data.severity)) : '';

    const failure: AmfeFailure = {
        id: uuidv4(),
        description: String(action.data.description || ''),
        effectLocal: String(action.data.effectLocal || ''),
        effectNextLevel: String(action.data.effectNextLevel || ''),
        effectEndUser: String(action.data.effectEndUser || ''),
        severity,
        causes: [],
    };
    func.failures.push(failure);
    result.applied++;
    result.created.push(`Modo de Falla: ${failure.description} (S=${severity || '?'})`);
}

function executeAddCause(action: ChatAction, doc: AmfeDocument, result: ChatExecutionResult): void {
    const op = resolveOperation(doc, action.path.opName);
    if (!op) {
        result.errors.push(`addCause: No se encontró operación "${action.path.opName}"`);
        return;
    }
    const we = resolveWorkElement(op, action.path.weType, action.path.weName);
    if (!we) {
        result.errors.push(`addCause: No se encontró elemento en "${op.name}"`);
        return;
    }
    const func = resolveFunction(we, action.path.funcDesc);
    if (!func) {
        result.errors.push(`addCause: No se encontró función en "${we.name}"`);
        return;
    }
    const fail = resolveFailure(func, action.path.failDesc);
    if (!fail) {
        result.errors.push(`addCause: No se encontró modo de falla "${action.path.failDesc}"`);
        return;
    }

    const cause = createEmptyCause();

    // Apply data fields
    const causeFields = [
        'cause', 'preventionControl', 'detectionControl', 'responsible',
        'targetDate', 'status', 'preventionAction', 'detectionAction', 'observations',
        'characteristicNumber', 'specialChar', 'filterCode',
    ];
    const causeRecord = cause as unknown as Record<string, string | number>;
    for (const field of causeFields) {
        if (action.data[field] !== undefined) {
            causeRecord[field] = String(action.data[field]);
        }
    }

    // Numeric fields
    if (typeof action.data.occurrence === 'number') {
        cause.occurrence = Math.max(1, Math.min(10, action.data.occurrence));
    }
    if (typeof action.data.detection === 'number') {
        cause.detection = Math.max(1, Math.min(10, action.data.detection));
    }

    // Auto-calculate AP
    const s = Number(fail.severity) || 0;
    const o = Number(cause.occurrence) || 0;
    const d = Number(cause.detection) || 0;
    if (s >= 1 && o >= 1 && d >= 1) {
        cause.ap = calculateAP(s, o, d) || '';
    }

    fail.causes.push(cause);
    result.applied++;
    result.created.push(`Causa: ${cause.cause} (O=${cause.occurrence || '?'}, D=${cause.detection || '?'}, AP=${cause.ap || '?'})`);

    // AP compliance warning
    if (cause.ap === 'H' && !cause.preventionAction && !cause.detectionAction) {
        result.warnings.push(`⚠ Causa "${cause.cause}" tiene AP=Alto: requiere acciones de optimización`);
    }
}

// --- UPDATE operations ---

function executeUpdateOperation(action: ChatAction, doc: AmfeDocument, result: ChatExecutionResult): void {
    const op = resolveOperation(doc, action.path.opName);
    if (!op) {
        result.errors.push(`updateOperation: No se encontró operación "${action.path.opName}"`);
        return;
    }

    const updatable = ['opNumber', 'name'];
    const changes: string[] = [];
    const opRecord = op as unknown as Record<string, string>;
    for (const field of updatable) {
        if (action.data[field] !== undefined) {
            opRecord[field] = String(action.data[field]);
            changes.push(`${field}="${action.data[field]}"`);
        }
    }

    if (changes.length > 0) {
        result.applied++;
        result.modified.push(`Op "${op.name}": ${changes.join(', ')}`);
    }
}

function executeUpdateWorkElement(action: ChatAction, doc: AmfeDocument, result: ChatExecutionResult): void {
    const op = resolveOperation(doc, action.path.opName);
    if (!op) {
        result.errors.push(`updateWorkElement: No se encontró operación "${action.path.opName}"`);
        return;
    }
    const we = resolveWorkElement(op, action.path.weType, action.path.weName);
    if (!we) {
        result.errors.push(`updateWorkElement: No se encontró elemento en "${op.name}"`);
        return;
    }

    const changes: string[] = [];
    if (action.data.name !== undefined) {
        we.name = String(action.data.name);
        changes.push(`name="${we.name}"`);
    }
    if (action.data.type !== undefined) {
        const t = String(action.data.type);
        if (WORK_ELEMENT_TYPES.includes(t as WorkElementType)) {
            we.type = t as WorkElementType;
            changes.push(`type="${t}"`);
        }
    }

    if (changes.length > 0) {
        result.applied++;
        result.modified.push(`WE "${we.name}": ${changes.join(', ')}`);
    }
}

function executeUpdateFunction(action: ChatAction, doc: AmfeDocument, result: ChatExecutionResult): void {
    const op = resolveOperation(doc, action.path.opName);
    if (!op) {
        result.errors.push(`updateFunction: No se encontró operación "${action.path.opName}"`);
        return;
    }
    const we = resolveWorkElement(op, action.path.weType, action.path.weName);
    if (!we) {
        result.errors.push(`updateFunction: No se encontró elemento en "${op.name}"`);
        return;
    }
    const func = resolveFunction(we, action.path.funcDesc);
    if (!func) {
        result.errors.push(`updateFunction: No se encontró función`);
        return;
    }

    const changes: string[] = [];
    if (action.data.description !== undefined) {
        func.description = String(action.data.description);
        changes.push(`description="${func.description}"`);
    }
    if (action.data.requirements !== undefined) {
        func.requirements = String(action.data.requirements);
        changes.push(`requirements="${func.requirements}"`);
    }

    if (changes.length > 0) {
        result.applied++;
        result.modified.push(`Función "${func.description}": ${changes.join(', ')}`);
    }
}

function executeUpdateFailure(action: ChatAction, doc: AmfeDocument, result: ChatExecutionResult): void {
    const op = resolveOperation(doc, action.path.opName);
    if (!op) {
        result.errors.push(`updateFailure: No se encontró operación "${action.path.opName}"`);
        return;
    }
    const we = resolveWorkElement(op, action.path.weType, action.path.weName);
    if (!we) {
        result.errors.push(`updateFailure: No se encontró elemento en "${op.name}"`);
        return;
    }
    const func = resolveFunction(we, action.path.funcDesc);
    if (!func) {
        result.errors.push(`updateFailure: No se encontró función`);
        return;
    }
    const fail = resolveFailure(func, action.path.failDesc);
    if (!fail) {
        result.errors.push(`updateFailure: No se encontró modo de falla "${action.path.failDesc}"`);
        return;
    }

    const changes: string[] = [];
    const stringFields = ['description', 'effectLocal', 'effectNextLevel', 'effectEndUser'];
    const failRecord = fail as unknown as Record<string, string | number>;
    for (const field of stringFields) {
        if (action.data[field] !== undefined) {
            failRecord[field] = String(action.data[field]);
            changes.push(`${field}="${action.data[field]}"`);
        }
    }

    if (action.data.severity !== undefined) {
        const sev = typeof action.data.severity === 'number'
            ? Math.max(1, Math.min(10, action.data.severity))
            : Math.max(1, Math.min(10, Number(action.data.severity) || Number(fail.severity) || 1));
        fail.severity = sev;
        changes.push(`severity=${sev}`);

        // Cascade AP recalculation to all causes
        for (const cause of fail.causes) {
            const o = Number(cause.occurrence) || 0;
            const d = Number(cause.detection) || 0;
            if (Number(sev) >= 1 && o >= 1 && d >= 1) {
                cause.ap = calculateAP(Number(sev), o, d) || '';
            }
        }
    }

    if (changes.length > 0) {
        result.applied++;
        result.modified.push(`Falla "${fail.description}": ${changes.join(', ')}`);
    }
}

function executeUpdateCause(action: ChatAction, doc: AmfeDocument, result: ChatExecutionResult): void {
    const op = resolveOperation(doc, action.path.opName);
    if (!op) {
        result.errors.push(`updateCause: No se encontró operación "${action.path.opName}"`);
        return;
    }
    const we = resolveWorkElement(op, action.path.weType, action.path.weName);
    if (!we) {
        result.errors.push(`updateCause: No se encontró elemento en "${op.name}"`);
        return;
    }
    const func = resolveFunction(we, action.path.funcDesc);
    if (!func) {
        result.errors.push(`updateCause: No se encontró función`);
        return;
    }
    const fail = resolveFailure(func, action.path.failDesc);
    if (!fail) {
        result.errors.push(`updateCause: No se encontró modo de falla "${action.path.failDesc}"`);
        return;
    }
    const cause = resolveCause(fail, action.path.causeDesc);
    if (!cause) {
        result.errors.push(`updateCause: No se encontró causa "${action.path.causeDesc}"`);
        return;
    }

    const changes: string[] = [];
    const stringFields = [
        'cause', 'preventionControl', 'detectionControl', 'responsible',
        'targetDate', 'status', 'preventionAction', 'detectionAction', 'observations',
        'characteristicNumber', 'specialChar', 'filterCode',
    ];
    const causeRecord = cause as unknown as Record<string, string | number>;
    for (const field of stringFields) {
        if (action.data[field] !== undefined) {
            causeRecord[field] = String(action.data[field]);
            changes.push(`${field}="${action.data[field]}"`);
        }
    }

    if (action.data.occurrence !== undefined) {
        const rawO = typeof action.data.occurrence === 'number'
            ? action.data.occurrence : Number(action.data.occurrence);
        cause.occurrence = isNaN(rawO) ? cause.occurrence : Math.max(1, Math.min(10, Math.round(rawO)));
        changes.push(`occurrence=${cause.occurrence}`);
    }
    if (action.data.detection !== undefined) {
        const rawD = typeof action.data.detection === 'number'
            ? action.data.detection : Number(action.data.detection);
        cause.detection = isNaN(rawD) ? cause.detection : Math.max(1, Math.min(10, Math.round(rawD)));
        changes.push(`detection=${cause.detection}`);
    }

    // Recalculate AP if O or D changed
    const s = Number(fail.severity) || 0;
    const o = Number(cause.occurrence) || 0;
    const d = Number(cause.detection) || 0;
    if (s >= 1 && o >= 1 && d >= 1) {
        cause.ap = calculateAP(s, o, d) || '';
    }

    if (changes.length > 0) {
        result.applied++;
        result.modified.push(`Causa "${cause.cause}": ${changes.join(', ')}`);
    }
}

// ============================================================================
// CHAT ORCHESTRATOR
// ============================================================================

const MAX_HISTORY_TURNS = 10;

/**
 * Send a user message to Gemini and get a structured response.
 * Manages chat history (capped at MAX_HISTORY_TURNS).
 */
export async function sendChatMessage(
    userMessage: string,
    currentDoc: AmfeDocument,
    chatHistory: ChatMessage[],
    signal?: AbortSignal,
): Promise<{ response: ChatAIResponse; history: ChatMessage[] }> {
    const systemPrompt = buildChatPrompt(currentDoc);

    // Append user message
    const history = [...chatHistory, { role: 'user' as const, content: userMessage }];

    // Cap history to last N turns (N messages = N/2 turns)
    const maxMessages = MAX_HISTORY_TURNS * 2;
    const trimmedHistory = history.length > maxMessages
        ? history.slice(-maxMessages)
        : history;

    const result = await queryGeminiChat(systemPrompt, trimmedHistory, 60000, signal);

    const response = parseChatResponse(result.text);

    // Append assistant response to history
    const updatedHistory = [...trimmedHistory, { role: 'assistant' as const, content: result.text }];

    return { response, history: updatedHistory };
}
