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

export const SYSTEM_PROMPT = `Eres un experto en Plan de Control segun AIAG (1ra Edicion 2024) para manufactura automotriz.

REGLAS:
1. Responde UNICAMENTE con un array JSON de 5 strings. Sin explicaciones ni markdown.
2. Cada sugerencia: concisa (max 80 chars), tecnica, especifica al contexto.
3. NO repitas ni sugieras variantes de lo que YA EXISTE.
4. Usa terminologia de manufactura automotriz en espanol.

RELACION AMFE → PLAN DE CONTROL:
- El Plan de Control DERIVA del AMFE (IATF 16949, clausula 8.5.1.1)
- Controles de Prevencion del AMFE (Paso 5) → Metodo de Control del CP
- Controles de Deteccion del AMFE (Paso 5) → Tecnica de Evaluacion del CP
- La Prioridad de Accion (AP) determina la rigurosidad del control

REGLAS POR NIVEL DE AP:
- AP Alto (H): Riesgo inaceptable. 100% inspeccion o Poka-Yoke. Frecuencia continua.
- AP Medio (M): Riesgo moderado. Muestreo estadistico (SPC). Frecuencia por hora o turno.
- AP Bajo (L): Riesgo aceptable. Controles estandar, auditorias. Frecuencia por turno o inicio.

REGLAS POR SEVERIDAD PARA PLAN DE REACCION:
- S>=9: Detener linea, escalar a gerencia, segregar producto, paro de envio
- S=7-8: Contener producto sospechoso, verificar ultimas N piezas, corregir proceso
- S=4-6: Ajustar proceso, reinspeccionar lote, registrar hallazgo
- S<4: Monitorear, registrar tendencia, accion si se repite

VOCABULARIO TECNICO:
Control: Poka-Yoke, SPC, carta X-R, carta p, receta bloqueada PLC, sensor inline
Evaluacion: CMM, calibre pasa/no-pasa, torquimetro, rugosimetro, MSA R&R, vision artificial
Muestreo: 100%, 5 piezas consecutivas, 1 pieza por contenedor, AQL, skip-lot
Frecuencia: Cada pieza, continuo, cada hora, cambio turno, inicio produccion, First Off
Reaccion: Detener linea, contener, segregar, escalar, reinspeccionar, ajustar parametros

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
    if (phase === 'prototype') return '\nFASE: Prototipo. Enfocarse en validacion de diseno y proceso.';
    if (phase === 'preLaunch') return '\nFASE: Pre-Lanzamiento. Verificar que controles de serie estan implementados.';
    return '';
}

// ============================================================================
// FIELD PROMPTS (one per CP field type)
// ============================================================================

export const FIELD_PROMPTS: Record<CpSuggestionField, (ctx: CpSuggestionContext, input: string) => string> = {
    controlMethod: (ctx, input) =>
        `Proceso: ${ctx.processDescription || 'proceso industrial'}
Maquina/Herramienta: ${ctx.machineDeviceTool || 'general'}
Caracteristica Producto: ${ctx.productCharacteristic || 'no especificada'}
Caracteristica Proceso: ${ctx.processCharacteristic || 'no especificada'}${ctx.specification ? '\nEspecificacion: ' + ctx.specification : ''}
Escribe: METODO DE CONTROL (como se controla el proceso para PREVENIR la falla). Lleva: "${input}"
El metodo de control viene del Control de Prevencion del AMFE (Paso 5).
Debe ser una instruccion operativa clara para el piso de planta.
EJEMPLOS:
- Soldadura: ["Receta parametros bloqueada en PLC","Verificacion caudal gas con caudalimetro cada turno","Poka-Yoke geometrico en fixture de posicionamiento"]
- Ensamble: ["Torquimetro electronico con programa de secuencia","Hoja verificacion arranque (start-up checklist)","Scanner lectura codigo barras para verificar componente"]${apHint(ctx.amfeAp)}${severityHint(ctx.amfeSeverity)}${processVocabHint(ctx.operationCategory)}${antiContext(ctx)}`,

    evaluationTechnique: (ctx, input) =>
        `Proceso: ${ctx.processDescription || 'proceso industrial'}
Maquina/Herramienta: ${ctx.machineDeviceTool || 'general'}
Caracteristica Producto: ${ctx.productCharacteristic || 'no especificada'}${ctx.specification ? '\nEspecificacion: ' + ctx.specification : ''}${ctx.controlMethod ? '\nMetodo Control actual: ' + ctx.controlMethod : ''}
Escribe: TECNICA DE EVALUACION/MEDICION (como se MIDE o DETECTA si esta OK). Lleva: "${input}"
La tecnica de evaluacion viene del Control de Deteccion del AMFE (Paso 5).
Debe incluir el instrumento/metodo y criterio de aceptacion.
EJEMPLOS:
- Dimensional: ["CMM 100% en estacion automatica","Calibre pasa/no-pasa verificado con MSA","Comparador optico con programa patron"]
- Proceso: ["SPC carta X-R (Cp/Cpk >= 1.67)","Torquimetro electronico con registro digital","Vision artificial con camara inline"]${apHint(ctx.amfeAp)}${severityHint(ctx.amfeSeverity)}${processVocabHint(ctx.operationCategory)}${antiContext(ctx)}`,

    sampleSize: (ctx, input) =>
        `Proceso: ${ctx.processDescription || 'proceso industrial'}
Caracteristica: ${ctx.productCharacteristic || ctx.processCharacteristic || 'general'}${ctx.controlMethod ? '\nMetodo Control: ' + ctx.controlMethod : ''}${ctx.evaluationTechnique ? '\nTecnica Evaluacion: ' + ctx.evaluationTechnique : ''}
Escribe: TAMANO DE MUESTRA (cuantas piezas inspeccionar). Lleva: "${input}"
REGLAS AIAG POR AP:
- AP=H o S>=9: "100%" (inspeccion completa, Poka-Yoke)
- AP=M: "5 piezas consecutivas" (muestreo estadistico SPC)
- AP=L: "1 pieza" o "3 piezas" (muestreo reducido)
- Safe Launch: "100%" independientemente del AP
Si el control es automatico (vision, sensor, PLC): "100%" siempre.
EJEMPLOS: ["100%","5 piezas consecutivas","1 pieza por contenedor","3 piezas primer off","n=5 (SPC)"]${apHint(ctx.amfeAp)}${phaseHint(ctx.phase)}${antiContext(ctx)}`,

    sampleFrequency: (ctx, input) =>
        `Proceso: ${ctx.processDescription || 'proceso industrial'}
Caracteristica: ${ctx.productCharacteristic || ctx.processCharacteristic || 'general'}${ctx.controlMethod ? '\nMetodo Control: ' + ctx.controlMethod : ''}
Escribe: FRECUENCIA DE MUESTREO (cada cuanto se inspecciona). Lleva: "${input}"
REGLAS AIAG POR AP:
- AP=H: "Cada pieza" o "Continuo" (si hay sensor inline)
- AP=M: "Cada hora", "Cada cambio de turno", "Cada 500 piezas"
- AP=L: "Una vez por turno", "Inicio de turno (First Off)", "Cambio de lote"
- Safe Launch: "Cada pieza" o "Cada hora" (temporalmente mas estricto)
Si es SPC: frecuencia de subgrupo (ej: "Cada hora, n=5").
EJEMPLOS: ["Cada pieza","Continuo (sensor inline)","Cada hora","Cada cambio de turno","Inicio produccion (First Off)","Cada 500 piezas","Cada lote"]${apHint(ctx.amfeAp)}${phaseHint(ctx.phase)}${antiContext(ctx)}`,

    reactionPlan: (ctx, input) =>
        `Proceso: ${ctx.processDescription || 'proceso industrial'}
Caracteristica: ${ctx.productCharacteristic || ctx.processCharacteristic || 'general'}
Clasificacion: ${ctx.specialCharClass || 'no clasificada'}
Escribe: PLAN DE REACCION (que hacer cuando se detecta una no conformidad). Lleva: "${input}"
El plan de reaccion se alinea con la Severidad del AMFE:
- S>=9 (Critico): "Detener linea. Escalar a gerencia. Segregar producto. Paro de envio."
- S=7-8 (Alto): "Contener producto sospechoso. Verificar ultimas N piezas. Corregir proceso."
- S=4-6 (Moderado): "Ajustar proceso. Reinspeccionar lote. Registrar en sistema calidad."
- S<4 (Bajo): "Registrar hallazgo. Monitorear tendencia. Accion si se repite."
Incluir: accion inmediata + contencion + escalamiento si aplica.
EJEMPLOS:
- CC (S>=9): ["Detener linea. Segregar lote. Notificar supervisor e ingenieria. Reinspeccion 100% retroactiva."]
- SC (S=7-8): ["Contener producto sospechoso en area roja. Verificar ultimas 50 piezas. Ajustar parametros."]${severityHint(ctx.amfeSeverity)}${processVocabHint(ctx.operationCategory)}${antiContext(ctx)}`,
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

        return parsed
            .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
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
