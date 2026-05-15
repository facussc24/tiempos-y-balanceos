/**
 * FUENTE ÚNICA TS — sincronizado con `scripts/_lib/genericLabels.mjs` vía `core/amfe/genericLabels.data.json`.
 *
 * Misma data que el .mjs, tipada para uso en módulo TS (UI runtime amfeValidation.ts, etc.).
 *
 * Reglas fuente: .claude/rules/amfe-funciones-3-niveles.md, amfe-leer-contenido-antes-de-renumerar.md
 * NO duplicar las listas aquí — siempre leer del JSON shared.
 */
import data from './genericLabels.data.json';

export type WeType = 'Machine' | 'Man' | 'Material' | 'Method' | 'Measurement' | 'Environment';

export const GENERIC_LABELS: ReadonlyArray<string> = data.GENERIC_LABELS;
export const TYPE_TRANSLATION: Record<string, string[]> = data.TYPE_TRANSLATION;
export const MIN_FN_DESCRIPTION_LENGTH: number = data.MIN_FN_DESCRIPTION_LENGTH;
export const KEYWORD_OP_TAGS: ReadonlyArray<{ keywords: string[]; validOpTags: string[] }> = data.KEYWORD_OP_TAGS;
export const MATERIAL_NAME_FOREIGN_TYPE_PATTERNS = data.MATERIAL_NAME_FOREIGN_TYPE_PATTERNS;

/**
 * Normaliza un string: trim + lowercase + NFD (saca tildes).
 */
export function normalize(s: string | null | undefined): string {
    return (s || '').toString().trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const _NORMALIZED_LABELS = new Set(GENERIC_LABELS.map(normalize));

/**
 * Detecta si un string es etiqueta 6M genérica pura (sin recurso real).
 */
export function isGeneric6MLabel(s: string | null | undefined): boolean {
    const n = normalize(s);
    if (!n) return false;
    return _NORMALIZED_LABELS.has(n);
}

export interface WeTypeClassification {
    ok: boolean;
    issue?: string;
}

/**
 * Detecta si WE.name coincide con WE.type traducido o si type no corresponde al name.
 */
export function classifyWeNameVsType(name: string | null | undefined, type: string | null | undefined): WeTypeClassification {
    if (!name || !type) return { ok: true };
    const nName = normalize(name);
    const variants = (TYPE_TRANSLATION[type] || [normalize(type)]).map(normalize);
    if (variants.includes(nName)) {
        return { ok: false, issue: `WE.name "${name}" es copia del WE.type "${type}" traducido` };
    }
    const patterns = MATERIAL_NAME_FOREIGN_TYPE_PATTERNS as Record<string, string[]>;
    const checkPattern = (rule: string, expectedType: string, actualType: string) => {
        if (actualType !== expectedType) return null;
        for (const kw of patterns[rule] || []) {
            if (nName.includes(normalize(kw))) return rule;
        }
        return null;
    };
    const hit = checkPattern('MaterialShouldBeMachine', 'Material', type)
             || checkPattern('MachineShouldBeMethod', 'Machine', type)
             || checkPattern('MaterialShouldBeMeasurement', 'Material', type);
    if (hit) {
        return { ok: false, issue: `WE.name "${name}" no corresponde a WE.type "${type}" (patrón: ${hit})` };
    }
    return { ok: true };
}

export interface TextDescriptiveResult {
    ok: boolean;
    reason?: string;
}

/**
 * Detecta si un texto es descriptivo (longitud mínima + heurísticas suaves).
 */
export function isTextDescriptive(text: string | null | undefined, minLen: number = MIN_FN_DESCRIPTION_LENGTH): TextDescriptiveResult {
    const trimmed = (text || '').trim();
    if (trimmed.length < minLen) {
        return { ok: false, reason: `Longitud ${trimmed.length} < ${minLen} caracteres` };
    }
    if (trimmed === trimmed.toUpperCase() && trimmed.split(/\s+/).length < 4) {
        return { ok: false, reason: 'Texto en mayúsculas y muy corto, parece etiqueta' };
    }
    return { ok: true };
}

/**
 * Extrae número de OP "foreign" en WE.name (residuo de renumeración).
 */
export function extractForeignOpNumber(weName: string | null | undefined, currentOpNumber: number | string): number | null {
    if (!weName) return null;
    const m = /\bop\s*(\d{1,3})\b/i.exec(weName);
    if (!m) return null;
    const found = parseInt(m[1], 10);
    return found !== Number(currentOpNumber) ? found : null;
}
