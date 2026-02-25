/**
 * AMFE Change Impact Analysis
 *
 * Sends a free-text process change description to Gemini,
 * along with a compact serialization of the current AMFE document,
 * and returns a structured impact report identifying affected items
 * and recommended actions.
 */

import { queryGemini, GeminiError, GeminiErrorCode } from '../../utils/geminiClient';
import { AmfeDocument, AmfeOperation, AmfeCause, ActionPriority } from './amfeTypes';

// ============================================================================
// TYPES
// ============================================================================

export interface AffectedItem {
    operationName: string;
    failureDescription: string;
    currentAP: string;
    riskChange: 'increased' | 'decreased' | 'unchanged' | 'new_risk';
    recommendation: string;
}

export interface ChangeImpactReport {
    summary: string;
    affectedItems: AffectedItem[];
    newRisks: string[];
    suggestedActions: string[];
}

// ============================================================================
// AMFE SERIALIZATION (compact, fits in prompt)
// ============================================================================

interface CompactCause {
    cause: string;
    prevention: string;
    detection: string;
    o: number | string;
    d: number | string;
    ap: string;
}

interface CompactFailure {
    mode: string;
    effectLocal: string;
    effectEndUser: string;
    s: number | string;
    causes: CompactCause[];
}

interface CompactOp {
    op: string;
    elements: {
        type: string;
        name: string;
        functions: {
            func: string;
            failures: CompactFailure[];
        }[];
    }[];
}

/**
 * Serialize an AmfeDocument to a compact JSON string for the AI prompt.
 * Strips UUIDs, empty fields, and metadata to minimize token usage.
 * Returns null if document is empty.
 */
export function serializeAmfeCompact(doc: AmfeDocument): string | null {
    if (!doc.operations.length) return null;

    const ops: CompactOp[] = doc.operations.map(op => ({
        op: op.name || op.opNumber || 'Sin nombre',
        elements: op.workElements.map(we => ({
            type: we.type,
            name: we.name || '',
            functions: we.functions.map(fn => ({
                func: fn.description || '',
                failures: fn.failures.map(f => ({
                    mode: f.description || '',
                    effectLocal: f.effectLocal || '',
                    effectEndUser: f.effectEndUser || '',
                    s: f.severity || '',
                    causes: f.causes
                        .filter(c => c.cause || c.preventionControl || c.detectionControl)
                        .map(c => ({
                            cause: c.cause || '',
                            prevention: c.preventionControl || '',
                            detection: c.detectionControl || '',
                            o: c.occurrence || '',
                            d: c.detection || '',
                            ap: String(c.ap || ''),
                        })),
                })).filter(f => f.mode || f.causes.length > 0),
            })).filter(fn => fn.func || fn.failures.length > 0),
        })).filter(el => el.functions.length > 0),
    })).filter(op => op.elements.length > 0);

    if (ops.length === 0) return null;

    return JSON.stringify(ops);
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const CHANGE_ANALYSIS_SYSTEM_PROMPT = `Eres un experto en AMFE de procesos (PFMEA) segun AIAG-VDA para manufactura automotriz.

Tu tarea: Dado un cambio de proceso descrito por el usuario y el AMFE actual, analiza el impacto del cambio.

ESCALA AIAG-VDA:
- Severidad (S): 1=sin efecto, 2-3=menor, 4-6=moderado, 7-8=alto (parada de linea), 9-10=critico (seguridad/regulatorio)
- Ocurrencia (O): 1=improbable, 2-3=baja, 4-6=moderada, 7-8=alta, 9-10=muy alta
- Deteccion (D): 1=casi segura, 2-3=alta, 4-6=moderada, 7-8=baja, 9-10=casi imposible
- AP: H=prioridad alta, M=media, L=baja

INSTRUCCIONES:
1. Identifica que operaciones, modos de falla y causas del AMFE actual se ven afectados por el cambio.
2. Para cada item afectado, indica si el riesgo AUMENTO, DISMINUYO o NO CAMBIO.
3. Identifica NUEVOS riesgos que el cambio introduce y no estaban en el AMFE.
4. Sugiere acciones concretas (nuevos controles, revisiones de S/O/D, nuevas causas a agregar).

FORMATO DE RESPUESTA: JSON estricto, sin markdown ni explicaciones adicionales:
{
  "summary": "Resumen de 1-2 oraciones del impacto general",
  "affectedItems": [
    {
      "operationName": "nombre de la operacion afectada",
      "failureDescription": "modo de falla afectado",
      "currentAP": "H/M/L actual",
      "riskChange": "increased|decreased|unchanged|new_risk",
      "recommendation": "accion recomendada especifica"
    }
  ],
  "newRisks": ["riesgo nuevo 1", "riesgo nuevo 2"],
  "suggestedActions": ["accion sugerida 1", "accion sugerida 2"]
}`;

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze the impact of a process change on the current AMFE.
 *
 * @param changeDescription - Free text describing what changed
 * @param currentAmfe - The current AmfeDocument
 * @param signal - Optional AbortSignal for cancellation
 * @returns ChangeImpactReport with affected items and recommendations
 * @throws GeminiError on API failures
 */
export async function analyzeProcessChange(
    changeDescription: string,
    currentAmfe: AmfeDocument,
    signal?: AbortSignal,
): Promise<ChangeImpactReport> {
    if (!changeDescription.trim()) {
        throw new GeminiError('La descripcion del cambio no puede estar vacia', 'PARSE_ERROR' as GeminiErrorCode);
    }

    const serialized = serializeAmfeCompact(currentAmfe);
    if (!serialized) {
        throw new GeminiError('El AMFE esta vacio. Agregue operaciones antes de analizar cambios.', 'PARSE_ERROR' as GeminiErrorCode);
    }

    const userPrompt = `CAMBIO DE PROCESO:
${changeDescription.trim()}

AMFE ACTUAL:
${serialized}

Analiza el impacto del cambio sobre el AMFE. Responde SOLO con JSON.`;

    const result = await queryGemini(
        CHANGE_ANALYSIS_SYSTEM_PROMPT,
        userPrompt,
        30000, // 30s timeout for complex analysis
        signal,
    );

    return parseChangeAnalysisResponse(result.text);
}

// ============================================================================
// RESPONSE PARSER
// ============================================================================

/**
 * Parse Gemini's JSON response into a ChangeImpactReport.
 * Handles common LLM output quirks.
 */
export function parseChangeAnalysisResponse(text: string): ChangeImpactReport {
    let cleaned = text.trim();

    // Remove markdown code blocks
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    // Find JSON object in response
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!objMatch) {
        throw new GeminiError('No se pudo parsear la respuesta de la IA', 'PARSE_ERROR' as GeminiErrorCode);
    }

    try {
        const parsed = JSON.parse(objMatch[0]);

        // Validate structure
        const report: ChangeImpactReport = {
            summary: typeof parsed.summary === 'string' ? parsed.summary : 'No se pudo generar un resumen.',
            affectedItems: Array.isArray(parsed.affectedItems)
                ? parsed.affectedItems
                    .filter((item: any) => item && typeof item === 'object')
                    .map((item: any) => ({
                        operationName: String(item.operationName || ''),
                        failureDescription: String(item.failureDescription || ''),
                        currentAP: String(item.currentAP || ''),
                        riskChange: validateRiskChange(item.riskChange),
                        recommendation: String(item.recommendation || ''),
                    }))
                : [],
            newRisks: Array.isArray(parsed.newRisks)
                ? parsed.newRisks.filter((r: any) => typeof r === 'string' && r.trim()).map(String)
                : [],
            suggestedActions: Array.isArray(parsed.suggestedActions)
                ? parsed.suggestedActions.filter((a: any) => typeof a === 'string' && a.trim()).map(String)
                : [],
        };

        return report;
    } catch {
        throw new GeminiError('Respuesta de la IA no es JSON valido', 'PARSE_ERROR' as GeminiErrorCode);
    }
}

function validateRiskChange(value: any): AffectedItem['riskChange'] {
    const valid = ['increased', 'decreased', 'unchanged', 'new_risk'];
    return valid.includes(value) ? value : 'unchanged';
}
