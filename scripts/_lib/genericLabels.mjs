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
