/**
 * Control Plan AI Suggestions Service
 *
 * Builds contextual prompts for Google Gemini specifically for Plan de Control
 * fields, following AIAG CP 1st Edition (2024) standard.
 *
 * Priority (validated via NotebookLM with 45 AIAG-VDA sources):
 * - controlMethod + evaluationTechnique: Valor MAXIMO (direct AMFE Step 5 mapping)
 * - sampleSize + sampleFrequency: Valor ALTO (AP-based rules)
 * - reactionPlan: Valor MEDIO (severity-based library)
 */

import { queryGemini, GeminiError } from '../../utils/geminiClient';
import { processVocabHint, severityHint } from '../amfe/amfeAiSuggestions';
import { CpSuggestionField, CpSuggestionContext } from './cpSuggestionTypes';
import { logger } from '../../utils/logger';

/** Suggestion item compatible with SuggestionPopover */
export interface CpSuggestion {
    text: string;
    source: string;
    frequency: number;
}

// ============================================================================
// SYSTEM PROMPT (AIAG CP 1st Ed 2024 compliant, Spanish)
// ============================================================================

export const SYSTEM_PROMPT = `Eres un experto en Plan de Control según AIAG (1ra Edición 2024) para manufactura automotriz.

REGLAS:
1. Responde UNICAMENTE con un array JSON de 5 strings. Sin explicaciones ni markdown.
2. Cada sugerencia: concisa (max 80 chars), técnica, específica al contexto.
3. NO repitas ni sugieras variantes de lo que YA EXISTE.
4. Usa terminología de manufactura automotriz en español.

RELACIÓN AMFE → PLAN DE CONTROL:
- El Plan de Control DERIVA del AMFE (IATF 16949, cláusula 8.5.1.1)
- Controles de Prevención del AMFE (Paso 5) → Método de Control del CP
- Controles de Detección del AMFE (Paso 5) → Técnica de Evaluación del CP
- La Prioridad de Acción (AP) determina la rigurosidad del control

REGLAS POR NIVEL DE AP:
- AP Alto (H): Riesgo inaceptable. 100% inspección o Poka-Yoke. Frecuencia continua.
- AP Medio (M): Riesgo moderado. Muestreo estadístico (SPC). Frecuencia por hora o turno.
- AP Bajo (L): Riesgo aceptable. Controles estándar, auditorías. Frecuencia por turno o inicio.

REGLAS POR SEVERIDAD PARA PLAN DE REACCIÓN:
- S>=9: Detener línea, escalar a gerencia, segregar producto, paro de envío
- S=7-8: Contener producto sospechoso, verificar últimas N piezas, corregir proceso
- S=4-6: Ajustar proceso, reinspeccionar lote, registrar hallazgo
- S<4: Monitorear, registrar tendencia, acción si se repite

VOCABULARIO TÉCNICO:
Control: Poka-Yoke, SPC, carta X-R, carta p, receta bloqueada PLC, sensor inline
Evaluación: CMM, calibre pasa/no-pasa, torquímetro, rugosímetro, MSA R&R, visión artificial
Muestreo: 100%, 5 piezas consecutivas, 1 pieza por contenedor, AQL, skip-lot
Frecuencia: Cada pieza, continuo, cada hora, cambio turno, inicio producción, First Off
Reacción: Detener línea, contener, segregar, escalar, reinspeccionar, ajustar parámetros

FORMATO: ["sugerencia 1","sugerencia 2","sugerencia 3","sugerencia 4","sugerencia 5"]`;

// ============================================================================
// PROMPT HELPERS
// ============================================================================

function antiContext(ctx: CpSuggestionContext): string {
    if (!ctx.existingValues?.length) return '';
    const existing = ctx.existingValues.filter(v => v.trim()).slice(0, 10).join(', ');
    if (!existing) return '';
    return `\nYA EXISTEN estos valores, NO los repitas: ${existing}`;
}

function apHint(ap?: string): string {
    if (!ap) return '';
    if (ap === 'H') return '\nAP=ALTO: Controles robustos obligatorios (100%, Poka-Yoke, automatico).';
    if (ap === 'M') return '\nAP=MEDIO: Controles estadisticos recomendados (SPC, muestreo frecuente).';
    if (ap === 'L') return '\nAP=BAJO: Controles estandar aceptables (auditoria, first-off).';
    return '';
}

function phaseHint(phase?: string): string {
    if (!phase) return '';
    if (phase === 'safeLaunch') return '\nFASE: Safe Launch. Controles mas estrictos temporalmente (100% hasta validar proceso).';
    if (phase === 'prototype') return '\nFASE: Prototipo. Enfocarse en validación de diseño y proceso.';
    if (phase === 'preLaunch') return '\nFASE: Pre-Lanzamiento. Verificar que controles de serie están implementados.';
    return '';
}

// ============================================================================
// FIELD PROMPTS (one per CP field type)
// ============================================================================

export const FIELD_PROMPTS: Record<CpSuggestionField, (ctx: CpSuggestionContext, input: string) => string> = {
    controlMethod: (ctx, input) =>
        `Proceso: ${ctx.processDescription || 'proceso industrial'}
Máquina/Herramienta: ${ctx.machineDeviceTool || 'general'}
Característica Producto: ${ctx.productCharacteristic || 'no especificada'}
Característica Proceso: ${ctx.processCharacteristic || 'no especificada'}${ctx.specification ? '\nEspecificación: ' + ctx.specification : ''}
Escribe: MÉTODO DE CONTROL (cómo se controla el proceso para PREVENIR la falla). Lleva: "${input}"
El método de control viene del Control de Prevención del AMFE (Paso 5).
Debe ser una instrucción operativa clara para el piso de planta.
EJEMPLOS:
- Soldadura: ["Receta parámetros bloqueada en PLC","Verificación caudal gas con caudalímetro cada turno","Poka-Yoke geométrico en fixture de posicionamiento"]
- Ensamble: ["Torquímetro electrónico con programa de secuencia","Hoja verificación arranque (start-up checklist)","Scanner lectura código barras para verificar componente"]${apHint(ctx.amfeAp)}${severityHint(ctx.amfeSeverity)}${processVocabHint(ctx.operationCategory)}${antiContext(ctx)}`,

    evaluationTechnique: (ctx, input) =>
        `Proceso: ${ctx.processDescription || 'proceso industrial'}
Máquina/Herramienta: ${ctx.machineDeviceTool || 'general'}
Característica Producto: ${ctx.productCharacteristic || 'no especificada'}${ctx.specification ? '\nEspecificación: ' + ctx.specification : ''}${ctx.controlMethod ? '\nMétodo Control actual: ' + ctx.controlMethod : ''}
Escribe: TÉCNICA DE EVALUACIÓN/MEDICIÓN (cómo se MIDE o DETECTA si está OK). Lleva: "${input}"
La técnica de evaluación viene del Control de Detección del AMFE (Paso 5).
Debe incluir el instrumento/método y criterio de aceptación.
EJEMPLOS:
- Dimensional: ["CMM 100% en estación automática","Calibre pasa/no-pasa verificado con MSA","Comparador óptico con programa patrón"]
- Proceso: ["SPC carta X-R (Cp/Cpk >= 1.67)","Torquímetro electrónico con registro digital","Visión artificial con cámara inline"]${apHint(ctx.amfeAp)}${severityHint(ctx.amfeSeverity)}${processVocabHint(ctx.operationCategory)}${antiContext(ctx)}`,

    sampleSize: (ctx, input) =>
        `Proceso: ${ctx.processDescription || 'proceso industrial'}
Característica: ${ctx.productCharacteristic || ctx.processCharacteristic || 'general'}${ctx.controlMethod ? '\nMétodo Control: ' + ctx.controlMethod : ''}${ctx.evaluationTechnique ? '\nTécnica Evaluación: ' + ctx.evaluationTechnique : ''}
Escribe: TAMAÑO DE MUESTRA (cuántas piezas inspeccionar). Lleva: "${input}"
REGLAS AIAG POR AP:
- AP=H o S>=9: "100%" (inspección completa, Poka-Yoke)
- AP=M: "5 piezas consecutivas" (muestreo estadístico SPC)
- AP=L: "1 pieza" o "3 piezas" (muestreo reducido)
- Safe Launch: "100%" independientemente del AP
Si el control es automático (visión, sensor, PLC): "100%" siempre.
EJEMPLOS: ["100%","5 piezas consecutivas","1 pieza por contenedor","3 piezas primer off","n=5 (SPC)"]${apHint(ctx.amfeAp)}${phaseHint(ctx.phase)}${antiContext(ctx)}`,

    sampleFrequency: (ctx, input) =>
        `Proceso: ${ctx.processDescription || 'proceso industrial'}
Característica: ${ctx.productCharacteristic || ctx.processCharacteristic || 'general'}${ctx.controlMethod ? '\nMétodo Control: ' + ctx.controlMethod : ''}
Escribe: FRECUENCIA DE MUESTREO (cada cuánto se inspecciona). Lleva: "${input}"
REGLAS AIAG POR AP:
- AP=H: "Cada pieza" o "Continuo" (si hay sensor inline)
- AP=M: "Cada hora", "Cada cambio de turno", "Cada 500 piezas"
- AP=L: "Una vez por turno", "Inicio de turno (First Off)", "Cambio de lote"
- Safe Launch: "Cada pieza" o "Cada hora" (temporalmente más estricto)
Si es SPC: frecuencia de subgrupo (ej: "Cada hora, n=5").
EJEMPLOS: ["Cada pieza","Continuo (sensor inline)","Cada hora","Cada cambio de turno","Inicio producción (First Off)","Cada 500 piezas","Cada lote"]${apHint(ctx.amfeAp)}${phaseHint(ctx.phase)}${antiContext(ctx)}`,

    reactionPlan: (ctx, input) =>
        `Proceso: ${ctx.processDescription || 'proceso industrial'}
Característica: ${ctx.productCharacteristic || ctx.processCharacteristic || 'general'}
Clasificación: ${ctx.specialCharClass || 'no clasificada'}
Escribe: PLAN DE REACCIÓN (qué hacer cuando se detecta una no conformidad). Lleva: "${input}"
El plan de reacción se alinea con la Severidad del AMFE:
- S>=9 (Crítico): "Detener línea. Escalar a gerencia. Segregar producto. Paro de envío."
- S=7-8 (Alto): "Contener producto sospechoso. Verificar últimas N piezas. Corregir proceso."
- S=4-6 (Moderado): "Ajustar proceso. Reinspeccionar lote. Registrar en sistema calidad."
- S<4 (Bajo): "Registrar hallazgo. Monitorear tendencia. Acción si se repite."
Incluir: acción inmediata + contención + escalamiento si aplica.
EJEMPLOS:
- CC (S>=9): ["Detener línea. Segregar lote. Notificar supervisor e ingeniería. Reinspección 100% retroactiva."]
- SC (S=7-8): ["Contener producto sospechoso en área roja. Verificar últimas 50 piezas. Ajustar parámetros."]${severityHint(ctx.amfeSeverity)}${processVocabHint(ctx.operationCategory)}${antiContext(ctx)}`,
};

// ============================================================================
// MAIN QUERY FUNCTION
// ============================================================================

/**
 * Get AI suggestions for a specific Control Plan field.
 * Returns CpSuggestion[] with source="Gemini".
 * Returns empty array on any error (graceful degradation).
 */
export async function getCpAiSuggestions(
    field: CpSuggestionField,
    context: CpSuggestionContext,
    currentText: string,
    signal?: AbortSignal,
): Promise<CpSuggestion[]> {
    if (!currentText || currentText.trim().length < 2) return [];

    const promptBuilder = FIELD_PROMPTS[field];
    if (!promptBuilder) return [];

    const userPrompt = promptBuilder(context, currentText.trim());

    try {
        const result = await queryGemini(SYSTEM_PROMPT, userPrompt, 10000, signal);

        if (signal?.aborted) return [];

        return parseCpGeminiResponse(result.text, currentText);
    } catch (error) {
        if (error instanceof GeminiError) {
            logger.warn('CP AI Suggestions', `${error.code}: ${error.message}`);
        }
        return [];
    }
}

// ============================================================================
// RESPONSE PARSER
// ============================================================================

/**
 * Parse Gemini's JSON response into CpSuggestion[].
 * Handles various edge cases in LLM output.
 */
export function parseCpGeminiResponse(text: string, currentText: string): CpSuggestion[] {
    try {
        let cleaned = text.trim();

        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        }

        const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
        if (!arrayMatch) return [];

        const parsed = JSON.parse(arrayMatch[0]);
        if (!Array.isArray(parsed)) return [];

        const currentLower = currentText.toLowerCase().trim();

        // FIX: Gemini sometimes returns objects like [{text: "..."}, ...] instead of
        // plain strings. Extract .text or .suggestion fields from object responses
        // to avoid silently discarding valid suggestions (aligned with AMFE parser).
        return parsed
            .map(item => {
                if (typeof item === 'string') return item;
                if (item && typeof item === 'object') {
                    if (typeof item.text === 'string') return item.text;
                    if (typeof item.suggestion === 'string') return item.suggestion;
                    if (typeof item.value === 'string') return item.value;
                }
                return null;
            })
            .filter((item): item is string => item !== null && item.trim().length > 0)
            .filter(item => item.toLowerCase().trim() !== currentLower)
            .slice(0, 5)
            .map(text => ({
                text: text.trim(),
                source: 'IA Gemini',
                frequency: 1,
            }));
    } catch {
        logger.warn('CP AI Suggestions', 'Failed to parse Gemini response');
        return [];
    }
}
