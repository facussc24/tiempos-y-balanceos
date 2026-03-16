/**
 * Control Plan Chat Copilot Engine
 *
 * Core logic for the AI-powered chat that reads and writes Control Plan documents.
 * Uses Gemini 2.5 Flash (free tier). No React dependencies.
 *
 * Architecture mirrors amfeChatEngine.ts, adapted for CP's flat item structure:
 * 1. User sends natural language instruction
 * 2. Gemini analyzes intent + current CP (+ optional linked AMFE) → returns structured JSON actions
 * 3. Executor resolves items by description/index and applies mutations on a deep clone
 * 4. Modified document returned for loadData()
 */

import { queryGeminiChat, GeminiError, ChatMessage } from '../../utils/geminiClient';
import { ControlPlanDocument, ControlPlanItem, ControlPlanHeader } from './controlPlanTypes';
import { getControlPlanDefaults } from './controlPlanDefaults';
import { inferOperationCategory } from '../../utils/processCategory';
import { AmfeDocument } from '../amfe/amfeTypes';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export type CpChatActionType =
    | 'addItem' | 'updateItem' | 'removeItem'
    | 'bulkUpdate' | 'suggestControls' | 'validateCP';

export interface CpChatActionTarget {
    processDescription?: string;
    index?: number;
    filter?: string;
}

export interface CpChatAction {
    action: CpChatActionType;
    target?: CpChatActionTarget;
    data?: Record<string, string | number>;
}

export interface CpChatAIResponse {
    message: string;
    actions: CpChatAction[];
    questions: string[];
}

export interface CpChatExecutionResult {
    applied: number;
    created: string[];
    modified: string[];
    removed: string[];
    warnings: string[];
    errors: string[];
    newDoc: ControlPlanDocument;
}

// Re-export for convenience
export type { ChatMessage };

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

export const CP_CHAT_SYSTEM_PROMPT_TEMPLATE = `Eres un copiloto IA experto en Plan de Control segun AIAG 1ra Edicion (2024) y AIAG-VDA para manufactura automotriz.
El usuario te dara instrucciones en lenguaje natural en español para modificar el Plan de Control actual.

ESTRUCTURA DEL PLAN DE CONTROL (tabla plana, cada fila es un item):
Cada item tiene estos campos editables:
- processStepNumber: Numero de operacion/paso del proceso
- processDescription: Descripcion del proceso/operacion
- machineDeviceTool: Maquina, dispositivo o herramienta
- characteristicNumber: Numero de caracteristica
- productCharacteristic: Caracteristica del producto
- processCharacteristic: Caracteristica del proceso
- specialCharClass: Clasificacion de caracteristica especial (CC, SC, o vacio)
- specification: Especificacion/Tolerancia del producto o proceso
- evaluationTechnique: Tecnica de evaluacion/medicion
- sampleSize: Tamaño de muestra (ej: "100%", "5 piezas", "1 pieza")
- sampleFrequency: Frecuencia de muestreo (ej: "Cada pieza", "Cada hora", "Cada turno")
- controlMethod: Metodo de control (ej: "Poka-Yoke", "SPC carta X-R", "Hoja de registro")
- reactionPlan: Plan de reaccion ante no conformidad
- reactionPlanOwner: Responsable del plan de reaccion (OBLIGATORIO, debe ser rol especifico: "Operador", "Supervisor", "Lider de Linea")

ACCIONES DISPONIBLES:
- addItem: Agregar un item nuevo al CP. data contiene los campos del item.
- updateItem: Modificar un item existente. target.processDescription o target.index (1-based) identifica el item. data contiene los campos a modificar.
- removeItem: Eliminar un item. target.processDescription identifica el item.
- bulkUpdate: Actualizar un campo en multiples items. target.filter describe el filtro (ej: "soldadura", "AP=H"). data contiene el campo y valor.
- suggestControls: Sugerir controlMethod y evaluationTechnique para un item. target identifica el item. El copilot agrega las sugerencias en data.
- validateCP: Ejecutar validaciones internas del CP y retornar warnings.

REGLAS AP (Prioridad de Accion del AMFE vinculado):
- AP=H (Alto): sampleSize="100%", sampleFrequency="Cada pieza", control debe ser Poka-Yoke o inspeccion 100%
- AP=M (Medio): sampleSize="5 piezas", sampleFrequency="Cada hora" o "Cada turno", SPC recomendado
- AP=L (Bajo): muestreo por auditoria, frecuencia por turno o diaria

REGLAS SEVERIDAD para reactionPlan:
- S>=9 (Critico/Seguridad): "Detener linea. Escalar a Gerencia. Segregar producto."
- S=7-8 (Alto): "Contener producto sospechoso. Verificar ultimas N piezas. Corregir proceso."
- S=4-6 (Moderado): "Ajustar proceso. Reinspeccionar ultimo lote."
- S<4 (Bajo): "Registrar y monitorear."

REGLAS CP 2024:
1. reactionPlanOwner es OBLIGATORIO segun CP 2024. Si el usuario no lo especifica, dejar el campo VACIO y advertir que debe completarse manualmente.
2. Si controlMethod contiene "Poka-Yoke", sampleFrequency debe incluir verificacion del dispositivo (ej: "Verificar pieza patron al inicio de turno").
3. specialCharClass CC o SC NUNCA debe eliminarse sin justificacion.

REGLAS DE RESPUESTA:
1. Responde SIEMPRE con JSON estricto. Sin markdown, sin explicaciones fuera del JSON.
2. Si falta info critica, pedila en "questions".
3. Si el usuario dice "todos/todas", genera actions para cada item que aplique.
4. Para buscar items existentes, usa nombres parciales (busqueda case-insensitive).
5. Cuando agregues items, incluye defaults inteligentes basados en AP y severidad si estan disponibles.

FORMATO DE RESPUESTA:
{
  "message": "Descripcion breve de lo que voy a hacer",
  "actions": [
    {
      "action": "addItem",
      "data": {"processDescription": "Soldadura MIG", "controlMethod": "SPC carta X-R", "sampleSize": "5 piezas", "sampleFrequency": "Cada hora", "reactionPlanOwner": "Operador"}
    },
    {
      "action": "updateItem",
      "target": {"processDescription": "Soldadura"},
      "data": {"sampleFrequency": "Cada hora"}
    },
    {
      "action": "bulkUpdate",
      "target": {"filter": "soldadura"},
      "data": {"sampleFrequency": "Cada hora"}
    }
  ],
  "questions": []
}

PLAN DE CONTROL ACTUAL:
{CP_DATA}

{AMFE_CONTEXT}`;

// ============================================================================
// SERIALIZATION
// ============================================================================

/**
 * Serialize a CP document compactly for inclusion in the chat prompt.
 */
export function serializeCpCompact(doc: ControlPlanDocument): string {
    const h = doc.header;
    const lines: string[] = [];

    lines.push(`Pieza: ${h.partName || '(sin nombre)'} | Nro: ${h.partNumber || '-'} | Fase: ${h.phase} | AMFE: ${h.linkedAmfeProject || '(sin vincular)'}`);

    if (doc.items.length === 0) {
        lines.push('(Sin items — Plan de Control vacio)');
        return lines.join('\n');
    }

    lines.push('');
    lines.push('Idx | Proceso | Maquina | Caract.Prod | Caract.Proc | Especificacion | TecnicaEval | MetodoControl | TamMuestra | Frecuencia | PlanReaccion | Responsable | CC/SC | AP');
    lines.push('--- | ------- | ------- | ----------- | ----------- | -------------- | ----------- | ------------- | ---------- | ---------- | ------------ | ----------- | ----- | --');

    doc.items.forEach((item, i) => {
        lines.push(
            `${i + 1} | ${item.processDescription || '-'} | ${item.machineDeviceTool || '-'} | ` +
            `${item.productCharacteristic || '-'} | ${item.processCharacteristic || '-'} | ` +
            `${item.specification || '-'} | ${item.evaluationTechnique || '-'} | ` +
            `${item.controlMethod || '-'} | ` +
            `${item.sampleSize || '-'} | ${item.sampleFrequency || '-'} | ` +
            `${item.reactionPlan || '-'} | ${item.reactionPlanOwner || '(vacio)'} | ` +
            `${item.specialCharClass || '-'} | ${item.amfeAp || '-'}`
        );
    });

    return lines.join('\n');
}

/**
 * Serialize linked AMFE context (causes with AP=H/M) for the CP copilot.
 */
export function serializeAmfeContext(amfeDoc: AmfeDocument): string {
    const causes: string[] = [];

    for (const op of (amfeDoc.operations ?? [])) {
        for (const we of (op.workElements ?? [])) {
            for (const func of (we.functions ?? [])) {
                for (const fail of (func.failures ?? [])) {
                    for (const cause of (fail.causes ?? [])) {
                        if (cause.ap !== 'H' && cause.ap !== 'M') continue;
                        causes.push(
                            `Op: ${op.name} | Falla: ${fail.description} | Causa: ${cause.cause} | ` +
                            `S=${fail.severity} O=${cause.occurrence} D=${cause.detection} AP=${cause.ap} | ` +
                            `Prevencion: ${cause.preventionControl || '-'} | Deteccion: ${cause.detectionControl || '-'}`
                        );
                    }
                }
            }
        }
    }

    if (causes.length === 0) return '';

    return `AMFE VINCULADO (causas AP=H y AP=M):\n${causes.join('\n')}`;
}

// ============================================================================
// PROMPT BUILDER
// ============================================================================

/**
 * Build the system prompt with the current CP and optional AMFE context.
 */
export function buildCpChatPrompt(cpDoc: ControlPlanDocument, amfeDoc?: AmfeDocument): string {
    const cpData = serializeCpCompact(cpDoc);
    const amfeContext = amfeDoc ? serializeAmfeContext(amfeDoc) : '(Sin AMFE vinculado)';
    return CP_CHAT_SYSTEM_PROMPT_TEMPLATE
        .replace('{CP_DATA}', cpData)
        .replace('{AMFE_CONTEXT}', amfeContext);
}

// ============================================================================
// RESPONSE PARSER
// ============================================================================

/**
 * Parse Gemini's response text into a structured CpChatAIResponse.
 */
export function parseCpChatResponse(text: string): CpChatAIResponse {
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

        const response: CpChatAIResponse = {
            message: typeof parsed.message === 'string' ? parsed.message : '',
            actions: Array.isArray(parsed.actions)
                ? parsed.actions
                    .filter((a: any) => a && typeof a === 'object' && typeof a.action === 'string')
                    .map((a: any) => sanitizeCpAction(a))
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

/** Default owner for reaction plan when chat auto-fills an empty field */
const DEFAULT_REACTION_PLAN_OWNER = 'Operador';

const VALID_CP_ACTIONS = new Set<string>([
    'addItem', 'updateItem', 'removeItem', 'bulkUpdate', 'suggestControls', 'validateCP',
]);

/** Sanitize a single CP action */
function sanitizeCpAction(raw: any): CpChatAction {
    const action = VALID_CP_ACTIONS.has(String(raw.action))
        ? (String(raw.action) as CpChatActionType)
        : 'updateItem';

    const target: CpChatActionTarget = {};
    if (raw.target && typeof raw.target === 'object') {
        if (raw.target.processDescription) target.processDescription = String(raw.target.processDescription);
        if (raw.target.index !== undefined && raw.target.index !== null) target.index = Number(raw.target.index);
        if (raw.target.filter) target.filter = String(raw.target.filter);
    }

    const data: Record<string, string | number> = {};
    if (raw.data && typeof raw.data === 'object') {
        for (const [key, val] of Object.entries(raw.data)) {
            if (val === null || val === undefined) continue;
            if (typeof val === 'number') {
                data[key] = val;
            } else {
                data[key] = String(val);
            }
        }
    }

    return { action, target: Object.keys(target).length > 0 ? target : undefined, data: Object.keys(data).length > 0 ? data : undefined };
}

// ============================================================================
// ENTITY RESOLUTION (flat list — by description or index)
// ============================================================================

function normalize(s: string | undefined): string {
    return (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function matchesByName(target: string, query: string): boolean {
    if (!query) return false;
    return normalize(target).includes(normalize(query));
}

/**
 * Resolve a CP item by processDescription (substring) or index (1-based).
 */
export function resolveItem(
    items: ControlPlanItem[],
    target?: CpChatActionTarget,
): ControlPlanItem | null {
    if (!target) return null;

    // By index (1-based from user perspective)
    if (target.index !== undefined && target.index >= 1 && target.index <= items.length) {
        return items[target.index - 1];
    }

    // By processDescription
    if (target.processDescription) {
        const q = normalize(target.processDescription);
        return items.find(item => normalize(item.processDescription) === q)
            || items.find(item => matchesByName(item.processDescription, target.processDescription!))
            || null;
    }

    return null;
}

/**
 * Resolve multiple items matching a filter string.
 * Supports: process name substring, "AP=H", "AP=M", "sin responsable"
 */
export function resolveItemsByFilter(
    items: ControlPlanItem[],
    filter: string,
): ControlPlanItem[] {
    const f = normalize(filter);

    // AP filters
    if (f === 'ap=h' || f === 'ap alto' || f === 'ap high') {
        return items.filter(item => item.amfeAp === 'H');
    }
    if (f === 'ap=m' || f === 'ap medio' || f === 'ap medium') {
        return items.filter(item => item.amfeAp === 'M');
    }

    // Missing owner filter
    if (f.includes('sin responsable') || f.includes('sin owner') || f.includes('owner vacio')) {
        return items.filter(item => !(item.reactionPlanOwner ?? '').trim());
    }

    // CC/SC filter — match if the filter contains 'cc' or 'sc' as a standalone token
    // Use word boundary to avoid false positives (e.g. "inyeccion" contains "cc")
    const ccMatch = /\bcc\b/.test(f);
    const scMatch = /\bsc\b/.test(f);
    if (ccMatch || scMatch) {
        const targets = new Set<string>();
        if (ccMatch) targets.add('cc');
        if (scMatch) targets.add('sc');
        return items.filter(item => targets.has(normalize(item.specialCharClass || '')));
    }

    // Default: substring match on processDescription
    return items.filter(item => matchesByName(item.processDescription, filter));
}

// ============================================================================
// MUTATION EXECUTOR
// ============================================================================

/** Editable fields on a ControlPlanItem */
const EDITABLE_FIELDS = new Set<string>([
    'processStepNumber', 'processDescription', 'machineDeviceTool',
    'characteristicNumber', 'productCharacteristic', 'processCharacteristic',
    'specialCharClass', 'specification', 'evaluationTechnique',
    'sampleSize', 'sampleFrequency', 'controlMethod',
    'reactionPlan', 'reactionPlanOwner',
]);

/**
 * Execute an array of CP chat actions on a deep clone of the document.
 */
export function executeCpChatActions(
    actions: CpChatAction[],
    currentDoc: ControlPlanDocument,
): CpChatExecutionResult {
    const doc: ControlPlanDocument = JSON.parse(JSON.stringify(currentDoc));
    const result: CpChatExecutionResult = {
        applied: 0,
        created: [],
        modified: [],
        removed: [],
        warnings: [],
        errors: [],
        newDoc: doc,
    };

    // Separate remove actions to process them in reverse index order
    // (prevents index corruption when multiple items are removed)
    const removeActions: CpChatAction[] = [];
    const otherActions: CpChatAction[] = [];
    for (const action of actions) {
        if (action.action === 'removeItem') {
            removeActions.push(action);
        } else {
            otherActions.push(action);
        }
    }

    // Execute non-remove actions first
    for (const action of otherActions) {
        try {
            executeOneCpAction(action, doc, result);
        } catch (err: unknown) {
            result.errors.push(`${action.action}: ${err instanceof Error ? err.message : 'Error desconocido'}`);
        }
    }

    // Resolve remove targets and sort by descending index so splices don't shift later targets
    const resolvedRemoves = removeActions
        .map(action => {
            const item = resolveItem(doc.items, action.target);
            const idx = item ? doc.items.indexOf(item) : -1;
            return { action, idx };
        })
        .filter(r => r.idx >= 0)
        .sort((a, b) => b.idx - a.idx);

    for (const { action } of resolvedRemoves) {
        try {
            executeOneCpAction(action, doc, result);
        } catch (err: unknown) {
            result.errors.push(`${action.action}: ${err instanceof Error ? err.message : 'Error desconocido'}`);
        }
    }

    // Report unresolved removes (use pre-resolved set, not re-resolution against mutated array)
    if (resolvedRemoves.length < removeActions.length) {
        const resolvedSet = new Set(resolvedRemoves.map(r => r.action));
        for (const action of removeActions) {
            if (!resolvedSet.has(action)) {
                const desc = action.target?.processDescription || '?';
                result.errors.push(`No se encontró item para eliminar: "${desc}"`);
            }
        }
    }

    return result;
}

function executeOneCpAction(
    action: CpChatAction,
    doc: ControlPlanDocument,
    result: CpChatExecutionResult,
): void {
    switch (action.action) {
        case 'addItem':
            executeAddItem(action, doc, result);
            break;
        case 'updateItem':
            executeUpdateItem(action, doc, result);
            break;
        case 'removeItem':
            executeRemoveItem(action, doc, result);
            break;
        case 'bulkUpdate':
            executeBulkUpdate(action, doc, result);
            break;
        case 'suggestControls':
            // suggestControls is handled as updateItem with suggested fields
            executeUpdateItem(action, doc, result);
            break;
        case 'validateCP':
            executeValidateCP(doc, result);
            break;
        default:
            result.errors.push(`Accion desconocida: ${action.action}`);
    }
}

function executeAddItem(
    action: CpChatAction,
    doc: ControlPlanDocument,
    result: CpChatExecutionResult,
): void {
    const data = action.data || {};

    const processDesc = String(data.processDescription || '');

    // Duplicate detection: skip if exact processDescription + productCharacteristic already exists
    if (processDesc) {
        const productChar = String(data.productCharacteristic || '');
        const exists = doc.items.some(
            item => normalize(item.processDescription) === normalize(processDesc) &&
                normalize(item.productCharacteristic) === normalize(productChar)
        );
        if (exists) {
            result.warnings.push(`Item duplicado: "${processDesc}" con "${productChar}" ya existe`);
            return;
        }
    }

    const newItem: ControlPlanItem = {
        id: uuidv4(),
        processStepNumber: String(data.processStepNumber || ''),
        processDescription: processDesc,
        machineDeviceTool: String(data.machineDeviceTool || ''),
        characteristicNumber: String(data.characteristicNumber || ''),
        productCharacteristic: String(data.productCharacteristic || ''),
        processCharacteristic: String(data.processCharacteristic || ''),
        specialCharClass: String(data.specialCharClass || ''),
        specification: String(data.specification || ''),
        evaluationTechnique: String(data.evaluationTechnique || ''),
        sampleSize: String(data.sampleSize || ''),
        sampleFrequency: String(data.sampleFrequency || ''),
        controlMethod: String(data.controlMethod || ''),
        reactionPlan: String(data.reactionPlan || ''),
        reactionPlanOwner: String(data.reactionPlanOwner || ''),
        operationCategory: processDesc ? (inferOperationCategory(processDesc) || '') : '',
        amfeAp: (['H', 'M', 'L', ''].includes(String(data.amfeAp || '')) ? String(data.amfeAp || '') : '') as ControlPlanItem['amfeAp'],
        amfeSeverity: (() => {
            const raw = data.amfeSeverity;
            const num = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
            return !isNaN(num) && num >= 1 ? Math.max(1, Math.min(10, Math.round(num))) : undefined;
        })(),
    };

    // Poka-Yoke validation
    if (newItem.controlMethod.toLowerCase().includes('poka-yoke') || newItem.controlMethod.toLowerCase().includes('poka yoke')) {
        if (!newItem.sampleFrequency.toLowerCase().includes('verific')) {
            result.warnings.push(`Item "${processDesc}": Método Poka-Yoke requiere frecuencia de verificación del dispositivo`);
        }
    }

    // Warn if reactionPlanOwner is empty (CP 2024 mandatory field — must be filled by user)
    if (!newItem.reactionPlanOwner.trim()) {
        result.warnings.push(`Item "${processDesc}": Falta Responsable del Plan de Reacción (campo obligatorio CP 2024). Completar manualmente.`);
    }

    doc.items.push(newItem);
    result.applied++;
    result.created.push(`Item: ${processDesc || '(nuevo)'}`);
}

function executeUpdateItem(
    action: CpChatAction,
    doc: ControlPlanDocument,
    result: CpChatExecutionResult,
): void {
    const item = resolveItem(doc.items, action.target);
    if (!item) {
        const desc = action.target?.processDescription || action.target?.index || '?';
        result.errors.push(`No se encontró item: "${desc}"`);
        return;
    }

    const data = action.data || {};
    const changes: string[] = [];

    const itemRecord = item as unknown as Record<string, string | number | undefined>;
    for (const [key, val] of Object.entries(data)) {
        if (!EDITABLE_FIELDS.has(key)) continue;
        const strVal = String(val);
        if (itemRecord[key] !== strVal) {
            itemRecord[key] = strVal;
            changes.push(`${key}=${strVal}`);
        }
    }

    // Update operationCategory if processDescription changed
    if (data.processDescription) {
        item.operationCategory = inferOperationCategory(String(data.processDescription)) || '';
    }

    // Poka-Yoke validation
    if (item.controlMethod.toLowerCase().includes('poka-yoke') || item.controlMethod.toLowerCase().includes('poka yoke')) {
        if (!item.sampleFrequency.toLowerCase().includes('verific')) {
            result.warnings.push(`Item "${item.processDescription}": Método Poka-Yoke requiere frecuencia de verificación del dispositivo`);
        }
    }

    if (changes.length > 0) {
        result.applied++;
        result.modified.push(`Item "${item.processDescription}": ${changes.join(', ')}`);
    }
}

function executeRemoveItem(
    action: CpChatAction,
    doc: ControlPlanDocument,
    result: CpChatExecutionResult,
): void {
    const item = resolveItem(doc.items, action.target);
    if (!item) {
        const desc = action.target?.processDescription || '?';
        result.errors.push(`No se encontró item para eliminar: "${desc}"`);
        return;
    }

    // Warn if removing CC/SC item
    if (item.specialCharClass === 'CC' || item.specialCharClass === 'SC') {
        result.warnings.push(`Eliminando item con característica especial ${item.specialCharClass}: "${item.processDescription}"`);
    }

    // Warn if AP=H
    if (item.amfeAp === 'H') {
        result.warnings.push(`Alerta de Riesgo: Estás eliminando un control para un riesgo Alto (H) definido en el AMFE`);
    }

    const idx = doc.items.indexOf(item);
    if (idx >= 0) {
        doc.items.splice(idx, 1);
        result.applied++;
        result.removed.push(`Item: "${item.processDescription}"`);
    }
}

function executeBulkUpdate(
    action: CpChatAction,
    doc: ControlPlanDocument,
    result: CpChatExecutionResult,
): void {
    const filter = action.target?.filter;
    if (!filter) {
        result.errors.push('bulkUpdate requiere target.filter');
        return;
    }

    const matchingItems = resolveItemsByFilter(doc.items, filter);
    if (matchingItems.length === 0) {
        result.errors.push(`No se encontraron items que coincidan con: "${filter}"`);
        return;
    }

    const data = action.data || {};
    let totalChanges = 0;

    for (const item of matchingItems) {
        const changes: string[] = [];
        const rec = item as unknown as Record<string, string | number | undefined>;
        for (const [key, val] of Object.entries(data)) {
            if (!EDITABLE_FIELDS.has(key)) continue;
            const strVal = String(val);
            if (rec[key] !== strVal) {
                rec[key] = strVal;
                changes.push(key);
            }
        }
        if (changes.length > 0) totalChanges++;
    }

    if (totalChanges > 0) {
        result.applied++;
        result.modified.push(`Bulk update: ${totalChanges} item(s) que coinciden con "${filter}"`);
    }
}

function executeValidateCP(
    doc: ControlPlanDocument,
    result: CpChatExecutionResult,
): void {
    const warningsBefore = result.warnings.length;
    // Check missing owners
    const missingOwners = doc.items.filter(item => !item.reactionPlanOwner.trim());
    if (missingOwners.length > 0) {
        result.warnings.push(`${missingOwners.length} item(s) sin Responsable del Plan de Reacción`);
    }

    // Check Poka-Yoke without verification
    for (const item of doc.items) {
        const cm = item.controlMethod.toLowerCase();
        if ((cm.includes('poka-yoke') || cm.includes('poka yoke')) &&
            !item.sampleFrequency.toLowerCase().includes('verific')) {
            result.warnings.push(`Item "${item.processDescription}": Poka-Yoke sin frecuencia de verificación`);
        }
    }

    // Check AP=H items without reaction plan
    for (const item of doc.items) {
        if (item.amfeAp === 'H' && !item.reactionPlan.trim()) {
            result.warnings.push(`Item "${item.processDescription}": AP=H sin plan de reacción definido`);
        }
    }

    // Check empty control methods for AP=H/M
    for (const item of doc.items) {
        if ((item.amfeAp === 'H' || item.amfeAp === 'M') && !item.controlMethod.trim()) {
            result.warnings.push(`Item "${item.processDescription}": AP=${item.amfeAp} sin método de control definido`);
        }
    }

    result.applied++;
    const newWarnings = result.warnings.length - warningsBefore;
    result.modified.push(`Validación ejecutada: ${newWarnings} advertencia(s)`);
}

// ============================================================================
// CHAT ORCHESTRATOR
// ============================================================================

const MAX_HISTORY_TURNS = 10;

/**
 * Send a user message to Gemini and get a structured response.
 * Manages chat history (capped at MAX_HISTORY_TURNS).
 */
export async function sendCpChatMessage(
    userMessage: string,
    cpDoc: ControlPlanDocument,
    chatHistory: ChatMessage[],
    amfeDoc?: AmfeDocument,
    signal?: AbortSignal,
): Promise<{ response: CpChatAIResponse; history: ChatMessage[] }> {
    const systemPrompt = buildCpChatPrompt(cpDoc, amfeDoc);

    // Append user message
    const history = [...chatHistory, { role: 'user' as const, content: userMessage }];

    // Cap history to last N turns
    const maxMessages = MAX_HISTORY_TURNS * 2;
    const trimmedHistory = history.length > maxMessages
        ? history.slice(-maxMessages)
        : history;

    const result = await queryGeminiChat(systemPrompt, trimmedHistory, 60000, signal);

    const response = parseCpChatResponse(result.text);

    // Append assistant response to history
    const updatedHistory = [...trimmedHistory, { role: 'assistant' as const, content: result.text }];

    return { response, history: updatedHistory };
}
