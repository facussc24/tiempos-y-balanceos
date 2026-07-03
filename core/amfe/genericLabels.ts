/**
 * FUENTE ÚNICA TS — sincronizado con `scripts/_lib/genericLabels.mjs` vía `core/amfe/genericLabels.data.json`.
 *
 * Misma data que el .mjs, tipada para uso en módulo TS (UI runtime amfeValidation.ts, etc.).
 *
 * Reglas fuente: .claude/rules/amfe.md §7-§10 + skill amfe-domain
 * NO duplicar las listas aquí — siempre leer del JSON shared.
 */
import data from './genericLabels.data.json';

export type WeType = 'Machine' | 'Man' | 'Material' | 'Method' | 'Measurement' | 'Environment';

export const GENERIC_LABELS: ReadonlyArray<string> = data.GENERIC_LABELS;
export const TYPE_TRANSLATION: Record<string, string[]> = data.TYPE_TRANSLATION;
export const MIN_FN_DESCRIPTION_LENGTH: number = data.MIN_FN_DESCRIPTION_LENGTH;
export const KEYWORD_OP_TAGS: ReadonlyArray<{ keywords: string[]; validOpTags: string[] }> = data.KEYWORD_OP_TAGS;
export const MATERIAL_NAME_FOREIGN_TYPE_PATTERNS = data.MATERIAL_NAME_FOREIGN_TYPE_PATTERNS;
export const VERB_WHITELIST: ReadonlyArray<string> = (data as any).VERB_WHITELIST || [];
export interface OpNameSemanticRule {
    _comment?: string;
    opNameContains: string[];
    opFnMustNotContain?: string[];
    opFnMustContainAny?: string[];
}
export const OP_NAME_SEMANTIC_DICT: ReadonlyArray<OpNameSemanticRule> = (data as any).OP_NAME_SEMANTIC_DICT || [];

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
    // Cast via unknown porque el JSON incluye un campo `_comment: string` (doc inline)
    // junto a las reglas reales (string[]). TS2352 lo flaggeaba como mismatch directo;
    // unknown lo permite. Acceso por clave concreta sigue typed via fallback `|| []`.
    const patterns = MATERIAL_NAME_FOREIGN_TYPE_PATTERNS as unknown as Record<string, string[]>;
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

const _NORMALIZED_VERB_WHITELIST = new Set(VERB_WHITELIST.map(normalize));

/**
 * Detecta si un texto comienza con verbo en infinitivo / gerundio o pertenece a la VERB_WHITELIST.
 * Heurística: normaliza NFD+lowercase+trim, toma la primera palabra.
 * True si termina en -ar/-er/-ir/-ando/-iendo o está en VERB_WHITELIST.
 */
export function startsWithVerb(text: string | null | undefined): boolean {
    const n = normalize(text);
    if (!n) return false;
    const first = n.split(/\s+/)[0];
    if (!first) return false;
    if (_NORMALIZED_VERB_WHITELIST.has(first)) return true;
    // Sufijos verbales en español
    if (/(?:ar|er|ir)$/.test(first) && first.length >= 4) return true;
    if (/(?:ando|iendo)$/.test(first) && first.length >= 5) return true;
    return false;
}

/**
 * True si text está en mayúsculas (sin minúsculas, ignorando acentos/spaces) Y tiene <= maxWords palabras.
 * Casos: "COSTURA UNION", "ESPUMADO", "CORTE DE PANELES".
 */
export function isAllCapsShort(text: string | null | undefined, maxWords: number = 4): boolean {
    const trimmed = (text || '').trim();
    if (!trimmed) return false;
    // Normalizar acentos para chequeo de mayúsculas (Á y A son iguales para fines de "all caps")
    const noAccent = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // No debe contener minúsculas latinas
    if (/[a-z]/.test(noAccent)) return false;
    // Debe contener al menos una letra (descartar texto solo numérico/símbolos)
    if (!/[A-Z]/.test(noAccent)) return false;
    const words = trimmed.split(/\s+/).filter(Boolean);
    return words.length <= maxWords;
}

export interface OpFunctionSemanticResult {
    ok: boolean;
    mismatch?: string;
}

/**
 * Detecta mismatch semántico entre OP name y operationFunction según OP_NAME_SEMANTIC_DICT.
 * - Si una regla aplica (opName contiene una keyword de opNameContains) Y opFnMustNotContain matchea → mismatch.
 * - Si una regla aplica Y opFnMustContainAny no tiene ninguno → mismatch.
 */
export function detectOpFunctionSemanticMismatch(
    opName: string | null | undefined,
    opFunction: string | null | undefined,
): OpFunctionSemanticResult {
    const nName = normalize(opName);
    const nFn = normalize(opFunction);
    if (!nName) return { ok: true };

    for (const rule of OP_NAME_SEMANTIC_DICT) {
        const opNameMatches = (rule.opNameContains || []).some(kw => {
            const k = normalize(kw);
            return k.length > 0 && nName.includes(k);
        });
        if (!opNameMatches) continue;

        // Regla aplica. Evaluar must-not-contain
        if (rule.opFnMustNotContain && rule.opFnMustNotContain.length > 0) {
            const hit = rule.opFnMustNotContain.find(kw => {
                const k = normalize(kw);
                return k.length > 0 && nFn.includes(k);
            });
            if (hit) {
                return {
                    ok: false,
                    mismatch: `OP "${opName}" no debería contener "${hit}" en su función (regla: ${(rule.opNameContains || []).join('/')} → no ${(rule.opFnMustNotContain || []).join('/')})`,
                };
            }
        }

        // Evaluar must-contain-any
        if (rule.opFnMustContainAny && rule.opFnMustContainAny.length > 0) {
            const anyHit = rule.opFnMustContainAny.some(kw => {
                const k = normalize(kw);
                return k.length > 0 && nFn.includes(k);
            });
            if (!anyHit) {
                return {
                    ok: false,
                    mismatch: `OP "${opName}" debería contener alguno de [${(rule.opFnMustContainAny || []).join(', ')}] en su función`,
                };
            }
        }
    }
    return { ok: true };
}

/**
 * Devuelve los tags válidos asociados a una OP según KEYWORD_OP_TAGS.
 * Portado de scripts/_auditWePlaceholdersAndAllocation.mjs:55-71 a una versión data-driven.
 */
export function getOpTags(opName: string | null | undefined): string[] {
    const n = normalize(opName);
    if (!n) return [];
    const tagSet = new Set<string>();
    for (const rule of KEYWORD_OP_TAGS) {
        for (const kw of rule.keywords || []) {
            const k = normalize(kw);
            if (k && n.includes(k)) {
                for (const t of rule.validOpTags || []) tagSet.add(t);
                break;
            }
        }
    }
    return Array.from(tagSet);
}

export interface MisallocatedKeyword {
    keyword: string;
    expectedOpTags: readonly string[];
}

/**
 * Detecta keywords del failure.description que están misallocated en una OP.
 * Portado literal de scripts/_auditWePlaceholdersAndAllocation.mjs:73-101.
 * Mantiene la guardia "ambiguo → no marcar".
 */
export function detectMisallocatedKeyword(
    failureDesc: string | null | undefined,
    opTags: string[],
): MisallocatedKeyword[] {
    const n = normalize(failureDesc);
    if (!n) return [];
    const matchedRules: { keyword: string; validOpTags: string[] }[] = [];
    for (const rule of KEYWORD_OP_TAGS) {
        for (const kw of rule.keywords || []) {
            const k = normalize(kw);
            if (k && n.includes(k)) {
                matchedRules.push({ keyword: kw, validOpTags: rule.validOpTags });
                break;
            }
        }
    }
    if (matchedRules.length === 0) return [];

    // Si alguna regla matcheada ES coherente con la OP actual → failure está OK
    const anyCoherent = matchedRules.some(r => r.validOpTags.some(t => opTags.includes(t)));
    if (anyCoherent) return [];

    // Si hay 2+ reglas incompatibles entre sí (ambiguo), NO marcar
    if (matchedRules.length >= 2) {
        const allShare = matchedRules.every(r =>
            matchedRules[0].validOpTags.some(t => r.validOpTags.includes(t)),
        );
        if (!allShare) return []; // ambiguo → no marcar
    }

    return [{ keyword: matchedRules[0].keyword, expectedOpTags: matchedRules[0].validOpTags }];
}
