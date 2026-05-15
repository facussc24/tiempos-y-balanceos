/**
 * FUENTE ÚNICA — sincronizado con `core/amfe/genericLabels.ts` vía `core/amfe/genericLabels.data.json`.
 *
 * Exporta heurística canónica de detección de placeholders/genéricos en 6M de AMFEs:
 *   - GENERIC_LABELS: lista de etiquetas 6M puras (machine/maquina/material/etc.)
 *   - TYPE_TRANSLATION: mapping WE.type → variantes normalizadas para detectar copy-paste
 *   - KEYWORD_OP_TAGS: keyword en failure.description → OPs válidas
 *   - MIN_FN_DESCRIPTION_LENGTH: longitud mínima esperada
 *   - MATERIAL_NAME_FOREIGN_TYPE_PATTERNS: patrones de WE.type incorrecto vs name real
 *
 * Funciones expuestas:
 *   - normalize(s): trim + lowercase + NFD (sin tildes)
 *   - isGeneric6MLabel(s): boolean
 *   - classifyWeNameVsType(name, type): { ok, issue?: string }
 *   - isTextDescriptive(text, minLen?): { ok, reason?: string }
 *   - extractForeignOpNumber(weName, currentOp): number | null
 *
 * Reglas fuente: BarackMercosul/.claude/rules/amfe-funciones-3-niveles.md,
 *                amfe-leer-contenido-antes-de-renumerar.md
 * NO duplicar las listas aquí — siempre leer del JSON shared.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', '..', 'core', 'amfe', 'genericLabels.data.json');

const _data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));

export const GENERIC_LABELS = _data.GENERIC_LABELS;
export const TYPE_TRANSLATION = _data.TYPE_TRANSLATION;
export const KEYWORD_OP_TAGS = _data.KEYWORD_OP_TAGS;
export const MIN_FN_DESCRIPTION_LENGTH = _data.MIN_FN_DESCRIPTION_LENGTH;
export const MATERIAL_NAME_FOREIGN_TYPE_PATTERNS = _data.MATERIAL_NAME_FOREIGN_TYPE_PATTERNS;
export const VERB_WHITELIST = _data.VERB_WHITELIST || [];
export const OP_NAME_SEMANTIC_DICT = _data.OP_NAME_SEMANTIC_DICT || [];

/**
 * Normaliza un string: trim + lowercase + NFD (saca tildes).
 * @param {string} s
 * @returns {string}
 */
export function normalize(s) {
  return (s || '').toString().trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const _NORMALIZED_LABELS = new Set(GENERIC_LABELS.map(normalize));

/**
 * Detecta si un string es etiqueta 6M genérica pura (sin recurso real).
 * Match case-insensitive, sin tildes, trim.
 * @param {string} s
 * @returns {boolean}
 */
export function isGeneric6MLabel(s) {
  const n = normalize(s);
  if (!n) return false;
  return _NORMALIZED_LABELS.has(n);
}

/**
 * Detecta si WE.name coincide con WE.type traducido (placeholder copia-pega).
 * Ej: name="Material" + type="Material" → ok:false (es type traducido).
 * @param {string} name
 * @param {string} type
 * @returns {{ ok: boolean, issue?: string }}
 */
export function classifyWeNameVsType(name, type) {
  if (!name || !type) return { ok: true };
  const nName = normalize(name);
  const variants = (TYPE_TRANSLATION[type] || [normalize(type)]).map(normalize);
  if (variants.includes(nName)) {
    return { ok: false, issue: `WE.name "${name}" es copia del WE.type "${type}" traducido` };
  }
  // Adicional: detectar WE.name que no corresponde al type
  const patterns = MATERIAL_NAME_FOREIGN_TYPE_PATTERNS;
  const checkPattern = (rule, expectedType, actualType) => {
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

/**
 * Detecta si un texto es descriptivo (longitud mínima + tiene algún verbo o palabra-clave).
 * NO bloquea por verbo solo, sirve de hint.
 * @param {string} text
 * @param {number} minLen
 * @returns {{ ok: boolean, reason?: string }}
 */
export function isTextDescriptive(text, minLen = MIN_FN_DESCRIPTION_LENGTH) {
  const trimmed = (text || '').trim();
  if (trimmed.length < minLen) {
    return { ok: false, reason: `Longitud ${trimmed.length} < ${minLen} caracteres` };
  }
  // Heurística suave: si es todo MAYÚSCULAS y < 4 palabras, probable etiqueta no descripción
  if (trimmed === trimmed.toUpperCase() && trimmed.split(/\s+/).length < 4) {
    return { ok: false, reason: 'Texto en mayúsculas y muy corto, parece etiqueta' };
  }
  return { ok: true };
}

/**
 * Extrae número de OP "foreign" en WE.name (residuo de renumeración).
 * Ej: weName="Proceso Op 60", currentOp=50 → 60.
 * @param {string} weName
 * @param {number} currentOpNumber
 * @returns {number | null}
 */
export function extractForeignOpNumber(weName, currentOpNumber) {
  if (!weName) return null;
  const m = /\bop\s*(\d{1,3})\b/i.exec(weName);
  if (!m) return null;
  const found = parseInt(m[1]);
  return found !== Number(currentOpNumber) ? found : null;
}

const _NORMALIZED_VERB_WHITELIST = new Set(VERB_WHITELIST.map(normalize));

/**
 * Detecta si un texto comienza con verbo en infinitivo / gerundio o pertenece a la VERB_WHITELIST.
 * @param {string} text
 * @returns {boolean}
 */
export function startsWithVerb(text) {
  const n = normalize(text);
  if (!n) return false;
  const first = n.split(/\s+/)[0];
  if (!first) return false;
  if (_NORMALIZED_VERB_WHITELIST.has(first)) return true;
  if (/(?:ar|er|ir)$/.test(first) && first.length >= 4) return true;
  if (/(?:ando|iendo)$/.test(first) && first.length >= 5) return true;
  return false;
}

/**
 * True si text está en mayúsculas (sin minúsculas, ignorando acentos/spaces) Y tiene <= maxWords palabras.
 * @param {string} text
 * @param {number} maxWords
 * @returns {boolean}
 */
export function isAllCapsShort(text, maxWords = 4) {
  const trimmed = (text || '').trim();
  if (!trimmed) return false;
  const noAccent = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/[a-z]/.test(noAccent)) return false;
  if (!/[A-Z]/.test(noAccent)) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length <= maxWords;
}

/**
 * Detecta mismatch semántico entre OP name y operationFunction según OP_NAME_SEMANTIC_DICT.
 * @param {string} opName
 * @param {string} opFunction
 * @returns {{ ok: boolean, mismatch?: string }}
 */
export function detectOpFunctionSemanticMismatch(opName, opFunction) {
  const nName = normalize(opName);
  const nFn = normalize(opFunction);
  if (!nName) return { ok: true };

  for (const rule of OP_NAME_SEMANTIC_DICT) {
    const opNameMatches = (rule.opNameContains || []).some(kw => {
      const k = normalize(kw);
      return k.length > 0 && nName.includes(k);
    });
    if (!opNameMatches) continue;

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
 * @param {string} opName
 * @returns {string[]}
 */
export function getOpTags(opName) {
  const n = normalize(opName);
  if (!n) return [];
  const tagSet = new Set();
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

/**
 * Detecta keywords del failure.description que están misallocated en una OP.
 * Portado literal de scripts/_auditWePlaceholdersAndAllocation.mjs:73-101.
 * Mantiene la guardia "ambiguo → no marcar".
 * @param {string} failureDesc
 * @param {string[]} opTags
 * @returns {{ keyword: string, expectedOpTags: string[] }[]}
 */
export function detectMisallocatedKeyword(failureDesc, opTags) {
  const n = normalize(failureDesc);
  if (!n) return [];
  const matchedRules = [];
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

  const anyCoherent = matchedRules.some(r => r.validOpTags.some(t => opTags.includes(t)));
  if (anyCoherent) return [];

  if (matchedRules.length >= 2) {
    const allShare = matchedRules.every(r =>
      matchedRules[0].validOpTags.some(t => r.validOpTags.includes(t)),
    );
    if (!allShare) return [];
  }

  return [{ keyword: matchedRules[0].keyword, expectedOpTags: matchedRules[0].validOpTags }];
}
