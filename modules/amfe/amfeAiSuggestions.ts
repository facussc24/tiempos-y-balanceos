/**
 * AMFE AI Suggestions Service
 *
 * Builds contextual prompts for Google Gemini and parses responses
 * into Suggestion[] format. Designed to work alongside the local
 * pattern-matching engine (amfeSuggestionEngine.ts).
 *
 * System prompt enforces AIAG-VDA methodology and 6M structure.
 */

import { queryGemini, GeminiError } from '../../utils/geminiClient';
import { logger } from '../../utils/logger';
import { SuggestionField, SuggestionContext, Suggestion } from './amfeSuggestionEngine';

// ============================================================================
// SYSTEM PROMPT (AIAG-VDA compliant, Spanish)
// ============================================================================

const SYSTEM_PROMPT = `Eres un experto en AMFE (PFMEA) segun AIAG-VDA para manufactura automotriz.

REGLAS:
1. Responde UNICAMENTE con un array JSON de 5 strings. Sin explicaciones ni markdown.
2. Cada sugerencia: concisa (max 80 chars), tecnica, especifica al contexto.
3. NO repitas ni sugieras variantes de lo que YA EXISTE.
4. Usa terminologia de manufactura automotriz en espanol.

ESCALA DE SEVERIDAD AIAG-VDA:
- S=1-3: Efecto menor, sin impacto en seguridad ni regulacion
- S=4-6: Efecto moderado, posible degradacion de rendimiento
- S=7-8: Efecto alto, posible parada de linea o reclamo de cliente
- S=9-10: Efecto critico, impacta seguridad del usuario o incumplimiento regulatorio

RIGOR DE CONTROLES SEGUN RIESGO:
- S>=9: Controles a prueba de error (Poka-Yoke), inspeccion 100%, ensayos destructivos
- S=7-8: Controles estadisticos (SPC), muestreo frecuente, calibracion rigurosa
- S<=6: Controles estandar, muestreo periodico, inspeccion visual

ESTRUCTURA 6M - CAUSAS TIPICAS:
- Machine: Desgaste, descalibracion, falla de componentes, parametros fuera de rango
- Man: Falta de capacitacion, fatiga, error de procedimiento, distraccion
- Material: Variacion de proveedor, contaminacion, humedad, propiedades fuera de spec
- Method: Instruccion desactualizada, secuencia incorrecta, parametro no validado
- Environment: Temperatura, humedad, contaminacion ambiental, vibraciones
- Measurement: Instrumento descalibrado, MSA inadecuado, resolucion insuficiente

EJEMPLOS POR PROCESO:
Soldadura: cordon incompleto, porosidad, salpicaduras, distorsion termica | Controles: ensayo ultrasonido, cambio preventivo electrodo, receta parametros bloqueada
Ensamble: torque fuera de spec, componente faltante, pieza incorrecta | Controles: Poka-Yoke geometrico, monitoreo electronico torque, kitting
Pintura: espesura fuera de rango, descuelgue, burbujas por humedad | Controles: medicion espesura, control T/HR con alarma, test adherencia cross-hatch
Mecanizado: dimension fuera tolerancia, rugosidad deficiente | Controles: CMM, rugosimetro, primera pieza, contador vida util herramienta
Inyeccion: rechupe, short shot, burbujas por humedad resina | Controles: receta bloqueada, sensor temperatura molde, medicion humedad material
Inspeccion: no deteccion de defecto, inspeccion incompleta | Controles: muestras limite, auditoria escalonada, MSA R&R

FORMATO: ["sugerencia 1","sugerencia 2","sugerencia 3","sugerencia 4","sugerencia 5"]`;

// ============================================================================
// PROMPT BUILDERS (one per field type)
// ============================================================================

/** Adds anti-context clause to avoid suggesting values that already exist in the AMFE */
function antiContext(ctx: SuggestionContext): string {
    if (!ctx.existingValues?.length) return '';
    const existing = ctx.existingValues.filter(v => v.trim()).slice(0, 10).join(', ');
    if (!existing) return '';
    return `\nYA EXISTEN estos valores en el AMFE, NO los repitas ni sugeras variantes similares: ${existing}`;
}

/** Process-specific vocabulary hint injected into prompts when category is known */
export function processVocabHint(category?: string): string {
    if (!category) return '';
    const hints: Record<string, string> = {
        soldadura: '\nPROCESO: Soldadura. Vocabulario: cordon, electrodo, gas protector, voltaje/corriente, fixture, porosidad, salpicadura, penetracion, ZAC.',
        ensamble: '\nPROCESO: Ensamble. Vocabulario: torque, sujetador, Poka-Yoke, kitting, scanner, fixture, secuencia, componente.',
        pintura: '\nPROCESO: Pintura. Vocabulario: espesura, boquilla, cabina, HVAC, viscosidad, catalizador, adherencia, cross-hatch, descuelgue.',
        mecanizado: '\nPROCESO: Mecanizado CNC. Vocabulario: herramienta de corte, offset, avance, RPM, rugosidad, CMM, tolerancia, programa CNC.',
        inyeccion: '\nPROCESO: Inyeccion Plastica. Vocabulario: presion compactacion, temperatura masa, molde, atemperador, rechupe, short shot, resina, punto de rocio.',
        inspeccion: '\nPROCESO: Inspeccion. Vocabulario: muestreo, MSA, R&R, patron, limite maestro, frecuencia, plan de control, galga pasa/no-pasa.',
        corte: '\nPROCESO: Corte. Vocabulario: filo, cizalla, sierra cinta, disco, rebaba, ancho de corte, escuadra, avance, refrigerante.',
        estampado: '\nPROCESO: Estampado. Vocabulario: troquel, prensa, tonelaje, paso, tira, rebaba, deformacion, matriz, banda.',
        plegado: '\nPROCESO: Plegado. Vocabulario: punzon, dado V, angulo, radio de curvatura, retorno elastico, longitud desarrollo, prensa plegadora.',
        tratamiento_termico: '\nPROCESO: Tratamiento Termico. Vocabulario: horno, temple, revenido, dureza HRC, profundidad de capa, atmosfera, velocidad enfriamiento.',
        recubrimiento: '\nPROCESO: Recubrimiento. Vocabulario: espesor capa, adherencia, cuba, densidad corriente, concentracion, tiempo inmersion, pasivado.',
        acabado: '\nPROCESO: Acabado. Vocabulario: rugosidad Ra, grano abrasivo, velocidad periferica, refrigerante, tolerancia dimensional, cilindricidad.',
        conformado: '\nPROCESO: Conformado. Vocabulario: reduccion de area, dado, lubricante, velocidad traccion, calibre, limite elastico.',
        fundicion: '\nPROCESO: Fundicion. Vocabulario: colada, molde, temperatura fusion, arena, macho, rechupe, porosidad, sistema llenado.',
        corte_termico: '\nPROCESO: Corte Termico. Vocabulario: laser, plasma, boquilla, gas asistencia, kerf, ZAC, potencia, velocidad corte.',
        pretratamiento: '\nPROCESO: Pretratamiento. Vocabulario: desengrase, fosfatizado, decapado, enjuague, concentracion, temperatura bano, tiempo exposicion.',
    };
    return hints[category] || '';
}

/** Severity-driven rigor hint for control fields */
export function severityHint(severity?: number): string {
    if (!severity || severity === 0) return '';
    if (severity >= 9) return `\nS=${severity} (CRITICO): Sugiere controles robustos (Poka-Yoke, 100%, ensayos).`;
    if (severity >= 7) return `\nS=${severity} (ALTO): Sugiere controles estadisticos y muestreo frecuente.`;
    return `\nS=${severity} (MODERADO/BAJO): Controles estandar son aceptables.`;
}

/** Occurrence-driven hint for prevention controls */
export function occurrenceHint(occurrence?: number): string {
    if (!occurrence || occurrence === 0) return '';
    if (occurrence >= 8) return `\nO=${occurrence} (MUY ALTA): Causa muy frecuente. Priorizar eliminacion de causa raiz, Poka-Yoke, automatizacion.`;
    if (occurrence >= 5) return `\nO=${occurrence} (MODERADA): Causa recurrente. Sugiere mejoras de proceso, mantenimiento preventivo, capacitacion reforzada.`;
    if (occurrence >= 3) return `\nO=${occurrence} (BAJA): Causa ocasional. Controles preventivos estandar son adecuados.`;
    return `\nO=${occurrence} (MUY BAJA): Causa rara. Mantenimiento basico suficiente.`;
}

/** Detection-driven hint for detection controls */
export function detectionHint(detection?: number): string {
    if (!detection || detection === 0) return '';
    if (detection >= 8) return `\nD=${detection} (DETECCION DIFICIL): Sugiere metodos de deteccion automaticos, sensores, inspeccion 100%, ensayos funcionales.`;
    if (detection >= 5) return `\nD=${detection} (DETECCION MODERADA): Sugiere muestreo estadistico (SPC), auditorias frecuentes, checklists obligatorios.`;
    if (detection >= 3) return `\nD=${detection} (DETECCION BUENA): Controles actuales adecuados. Verificar que se mantengan.`;
    return `\nD=${detection} (DETECCION CASI SEGURA): Metodo de deteccion robusto existente.`;
}

const FIELD_PROMPTS: Record<SuggestionField, (ctx: SuggestionContext, input: string) => string> = {
    failureDescription: (ctx, input) =>
        `Operacion: ${ctx.operationName || 'proceso industrial'}
Elemento (${ctx.workElementType || '6M'}): ${ctx.workElementName || 'general'}
Funcion: ${ctx.functionDescription || 'no especificada'}${ctx.functionRequirements ? '\nRequisito: ' + ctx.functionRequirements : ''}
Escribe: MODO DE FALLA (como puede fallar la funcion). Lleva: "${input}"
El modo de falla es el NEGATIVO de la funcion — describe QUE sale mal, no POR QUE.
EJEMPLOS:
- Funcion "Aplicar cordon soldadura" → ["Cordon incompleto","Porosidad en cordon","Penetracion insuficiente","Salpicaduras excesivas","Distorsion termica"]
- Funcion "Aplicar torque especificado" → ["Torque por debajo de especificacion","Torque por encima de especificacion","Sujetador no apretado","Rosca danada","Angulo de giro incorrecto"]${processVocabHint(ctx.operationCategory)}${antiContext(ctx)}`,

    cause: (ctx, input) =>
        `Operacion: ${ctx.operationName || 'proceso industrial'}
Elemento (${ctx.workElementType || '6M'}): ${ctx.workElementName || 'general'}
Modo de falla: ${ctx.failureDescription || 'no especificado'}${ctx.effectsContext ? '\nEfectos: ' + ctx.effectsContext.substring(0, 100) : ''}
Escribe: CAUSA RAIZ (${ctx.workElementType || 'general'}). Lleva: "${input}"
La causa debe ser la RAZON POR LA CUAL el modo de falla ocurre, especifica al tipo 6M ${ctx.workElementType || ''}.
EJEMPLOS:
- Falla "Porosidad en cordon" + Machine → ["Caudal de gas protector insuficiente","Boquilla obstruida por salpicaduras","Voltaje de arco fuera de parametro"]
- Falla "Torque fuera de spec" + Man → ["Operador no capacitado en procedimiento","Fatiga por turno extendido","Secuencia de apriete incorrecta"]${severityHint(ctx.severity)}${processVocabHint(ctx.operationCategory)}${antiContext(ctx)}`,

    preventionControl: (ctx, input) =>
        `Operacion: ${ctx.operationName || 'proceso industrial'}
Elemento (${ctx.workElementType || '6M'}): ${ctx.workElementName || 'general'}
Modo de falla: ${ctx.failureDescription || 'no especificado'}
Causa: ${ctx.causeText || 'no especificada'}
Escribe: CONTROL PREVENTIVO (accion que EVITA que la causa ocurra). Lleva: "${input}"
TIPOS DE CONTROL PREVENTIVO (de mayor a menor efectividad):
1. Elimina causa: diseno robusto, Poka-Yoke (ej: sensor que bloquea arranque)
2. Reduce ocurrencia: mantenimiento preventivo, parametros bloqueados en receta
3. Detecta causa temprano: alarma antes de producir falla (ej: monitor caudal gas)
Especifica QUIEN, CUANDO, FRECUENCIA.
EJEMPLOS:
- Causa "Caudal gas insuficiente" → ["Verificacion caudal gas cada turno con caudalimetro","Mantenimiento preventivo regulador cada 500h","Alarma automatica caudal < 12 L/min"]
- Causa "Operador no capacitado" → ["Capacitacion certificada antes de operar estacion","Matriz de habilidades actualizada mensualmente"]${severityHint(ctx.severity)}${occurrenceHint(ctx.occurrence)}${processVocabHint(ctx.operationCategory)}${antiContext(ctx)}`,

    detectionControl: (ctx, input) =>
        `Operacion: ${ctx.operationName || 'proceso industrial'}
Elemento (${ctx.workElementType || '6M'}): ${ctx.workElementName || 'general'}
Modo de falla: ${ctx.failureDescription || 'no especificado'}
Causa: ${ctx.causeText || 'no especificada'}
Escribe: CONTROL DETECCION (metodo para DETECTAR la falla/causa ANTES de llegar al cliente). Lleva: "${input}"
TIPOS DE DETECCION (de mayor a menor efectividad):
1. Automatico: sensor inline, vision artificial, Poka-Yoke → D=2-3
2. Semiautomatico: SPC, muestreo estadistico con criterio → D=4-6
3. Manual: inspeccion visual, checklist, auditoria → D=7-8
Especifica METODO, FRECUENCIA, CRITERIO.
EJEMPLOS:
- Falla "Porosidad en cordon" → ["Ensayo ultrasonido 100% en estacion siguiente","Inspeccion visual con patron cada 50 piezas","Radiografia lote segun plan de muestreo"]
- Falla "Torque fuera de spec" → ["Torquimetro electronico con registro automatico","Verificacion con llave dinamometrica cada 20 piezas"]${severityHint(ctx.severity)}${detectionHint(ctx.detection)}${processVocabHint(ctx.operationCategory)}${antiContext(ctx)}`,

    effectLocal: (ctx, input) =>
        `Operacion: ${ctx.operationName || 'proceso industrial'}
Modo de falla: ${ctx.failureDescription || 'no especificado'}
Funcion: ${ctx.functionDescription || 'no especificada'}
Escribe: EFECTO LOCAL (consecuencia en la propia estacion/planta). Lleva: "${input}"
EJEMPLOS:
- Falla "Porosidad en cordon" → ["Retrabajo de soldadura","Scrap de pieza soldada","Parada de linea para ajuste parametros","Incremento tiempo ciclo por re-inspeccion"]
- Falla "Torque fuera de spec" → ["Retrabajo manual de apriete","Scrap de componente danado","Demora en liberacion de lote"]${processVocabHint(ctx.operationCategory)}${antiContext(ctx)}`,

    effectNextLevel: (ctx, input) =>
        `Operacion: ${ctx.operationName || 'proceso industrial'}
Modo de falla: ${ctx.failureDescription || 'no especificado'}
Funcion: ${ctx.functionDescription || 'no especificada'}
Escribe: EFECTO EN PLANTA CLIENTE (consecuencia aguas abajo en la cadena). Lleva: "${input}"
EJEMPLOS:
- Falla "Porosidad" → ["Rechazo de lote en recepcion","Sorting en planta cliente","Reclamo formal 8D","Parada de linea de ensamble cliente"]
- Falla "Torque fuera de spec" → ["Falla en ensayo funcional del cliente","Devolucion de lote completo","Contencion y seleccion en almacen cliente"]${processVocabHint(ctx.operationCategory)}${antiContext(ctx)}`,

    effectEndUser: (ctx, input) =>
        `Operacion: ${ctx.operationName || 'proceso industrial'}
Modo de falla: ${ctx.failureDescription || 'no especificado'}
Funcion: ${ctx.functionDescription || 'no especificada'}
Escribe: EFECTO USUARIO FINAL (consecuencia para quien usa el producto). Lleva: "${input}"
EJEMPLOS:
- Falla "Porosidad soldadura" → ["Rotura de union en servicio","Fuga de fluido por soldadura porosa","Falla estructural bajo carga"]
- Falla "Torque fuera de spec" → ["Aflojamiento en servicio con vibracion","Ruido/vibracion anormal","Perdida de funcion del sistema fijado"]${processVocabHint(ctx.operationCategory)}${antiContext(ctx)}`,
};

// ============================================================================
// MAIN QUERY FUNCTION
// ============================================================================

/**
 * Get AI suggestions for a specific AMFE field.
 * Returns Suggestion[] with source="IA Gemini".
 * Returns empty array on any error (graceful degradation).
 */
export async function getAiSuggestions(
    field: SuggestionField,
    context: SuggestionContext,
    currentText: string,
    signal?: AbortSignal,
): Promise<Suggestion[]> {
    // Don't query for very short input
    if (!currentText || currentText.trim().length < 3) return [];

    const promptBuilder = FIELD_PROMPTS[field];
    if (!promptBuilder) return [];

    const userPrompt = promptBuilder(context, currentText.trim());

    try {
        const result = await queryGemini(SYSTEM_PROMPT, userPrompt, 10000, signal);

        // Check if aborted while waiting
        if (signal?.aborted) return [];

        return parseGeminiResponse(result.text, currentText);
    } catch (error) {
        // Graceful degradation: AI failure = no AI suggestions, local still works
        if (error instanceof GeminiError) {
            logger.warn('AI Suggestions', `${error.code}: ${error.message}`);
        }
        return [];
    }
}

// ============================================================================
// RESPONSE PARSER
// ============================================================================

/**
 * Parse Gemini's JSON response into Suggestion[].
 * Handles various edge cases in LLM output.
 */
function parseGeminiResponse(text: string, currentText: string): Suggestion[] {
    try {
        // Clean up common LLM artifacts
        let cleaned = text.trim();

        // Remove markdown code blocks if present
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        }

        // Try to find JSON array in the response
        const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
        if (!arrayMatch) return [];

        const parsed = JSON.parse(arrayMatch[0]);

        if (!Array.isArray(parsed)) return [];

        const currentLower = currentText.toLowerCase().trim();

        return parsed
            .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            .filter(item => item.toLowerCase().trim() !== currentLower) // Don't suggest exact match
            .slice(0, 5)
            .map(text => ({
                text: text.trim(),
                source: 'IA Gemini',
                frequency: 1,
            }));
    } catch {
        logger.warn('AI Suggestions', 'Failed to parse Gemini response');
        return [];
    }
}
