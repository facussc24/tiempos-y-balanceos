/**
 * forbiddenContent.mjs — Candado anti-invento para AMFEs.
 *
 * Convierte en codigo EJECUTABLE las reglas que hoy viven solo en prosa:
 *   - .claude/rules/amfe-no-inventar-controles.md (inventos confirmados + diccionario peninsular)
 *   - .claude/rules/amfe.md (tabla "Vocabulario Claude prohibido" + frecuencias inventadas)
 *
 * Motivacion (plan wise-jumping-island, 2026-06-26): la falla #1 de Claude en este
 * proyecto es INVENTAR contenido (controles/equipos/vocabulario que Barack no usa).
 * 2478 inventos detectados a mano en 10 incidentes. Las reglas decian "no inventar"
 * pero NADA lo frenaba. Este modulo se engancha al validador (amfeValidator.mjs) que
 * ya bloquea --apply, asi que un invento NUEVO no puede entrar a Supabase.
 *
 * FUENTE UNICA: las listas viven en core/amfe/forbiddenContent.data.json (mismo patron
 * que genericLabels.mjs <-> core/amfe/genericLabels.data.json). NO duplicar listas aca.
 *
 * Severidades graduadas (clave para no generar fricción — ver plan):
 *   - forbidden (CRITICAL): equipos inexistentes en Barack + espanolismos peninsulares.
 *     Son known-bad con ~0 falsos positivos -> bloquean.
 *   - warnings (WARNING): frases-Claude + frecuencias arbitrarias. Casi siempre malo,
 *     pero a veces legitimo -> solo flag para revision humana.
 *
 * API:
 *   - scanForbidden(text): { forbidden: [{term, kind}], warnings: [{term, kind}] }
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { normalize } from './genericLabels.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', '..', 'core', 'amfe', 'forbiddenContent.data.json');

const _data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));

export const FORBIDDEN_EQUIPMENT_PHRASES = _data.FORBIDDEN_EQUIPMENT_PHRASES || [];
export const PENINSULAR_TERMS = _data.PENINSULAR_TERMS || [];
export const ENGLISH_RANDOM_TERMS = _data.ENGLISH_RANDOM_TERMS || [];
export const CLAUDE_PHRASES = _data.CLAUDE_PHRASES || [];
export const ARBITRARY_FREQUENCY_PATTERNS = _data.ARBITRARY_FREQUENCY_PATTERNS || [];

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Pre-normalizar para matching rapido y deterministico.
// Equipo y frases-Claude: substring sobre texto normalizado (multi-palabra => bajo FP).
const _equipNorm = FORBIDDEN_EQUIPMENT_PHRASES.map(p => ({ raw: p, n: normalize(p) }));
const _claudeNorm = CLAUDE_PHRASES.map(p => ({ raw: p, n: normalize(p) }));
// Peninsular: word-boundary para NO matchear dentro de otra palabra
// (ej: "coger" NO debe disparar dentro de "recoger"; "raton" NO dentro de "ratones").
const _peninsularRe = PENINSULAR_TERMS.map(t => ({
    raw: t,
    re: new RegExp(`\\b${escapeRegex(normalize(t))}\\b`),
}));
// Ingles random (Fak 19/08/2026): word-boundary igual que peninsular — "rattle" no debe
// disparar dentro de otra palabra, y las frases multi-palabra matchean enteras.
// Espaciado FLEXIBLE alrededor de "&", "/" y entre palabras: "Gap&Flush" y "Torque / Push"
// tienen que caer igual que la forma tipeada en el JSON (hallazgo del auditor, 19/08).
const _englishRe = ENGLISH_RANDOM_TERMS.map(t => {
    const pat = escapeRegex(normalize(t))
        .replace(/\s*&\s*/g, '\\s*&\\s*')
        .replace(/\s*\/\s*/g, '\\s*\\/\\s*')
        .replace(/ +/g, '\\s+');
    return { raw: t, re: new RegExp(`\\b${pat}\\b`) };
});
// Frecuencias: regex sobre texto normalizado (sin tildes, lowercase).
const _freqRe = ARBITRARY_FREQUENCY_PATTERNS.map(p => ({ raw: p, re: new RegExp(p, 'i') }));

/**
 * Escanea un texto buscando contenido inventado / vocabulario prohibido.
 *
 * @param {string} text - cualquier campo de control/funcion/accion del AMFE.
 * @returns {{ forbidden: Array<{term:string, kind:string}>,
 *             warnings: Array<{term:string, kind:string}> }}
 *   forbidden -> debe bloquear (CRITICAL). warnings -> flag (WARNING).
 */
export function scanForbidden(text) {
    const forbidden = [];
    const warnings = [];
    const raw = text == null ? '' : String(text);
    if (!raw.trim()) return { forbidden, warnings };
    const n = normalize(raw);

    for (const { raw: term, n: tn } of _equipNorm) {
        if (tn && n.includes(tn)) {
            forbidden.push({ term, kind: 'equipo inexistente en Barack' });
        }
    }
    for (const { raw: term, re } of _peninsularRe) {
        if (re.test(n)) {
            forbidden.push({ term, kind: 'espanolismo peninsular' });
        }
    }
    for (const { raw: term, re } of _englishRe) {
        if (re.test(n)) {
            forbidden.push({ term, kind: 'ingles random (no se entiende en planta)' });
        }
    }
    for (const { raw: term, n: tn } of _claudeNorm) {
        if (tn && n.includes(tn)) {
            warnings.push({ term, kind: 'vocabulario Claude' });
        }
    }
    for (const { re } of _freqRe) {
        const m = re.exec(n);
        if (m) {
            warnings.push({ term: m[0].trim(), kind: 'frecuencia inventada' });
        }
    }
    return { forbidden, warnings };
}
