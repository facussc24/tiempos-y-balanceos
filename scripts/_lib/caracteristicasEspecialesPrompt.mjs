/**
 * caracteristicasEspecialesPrompt.mjs — la pieza "caracteristicas especiales" de UserPromptSubmit, que hasta el
 * 10/10/2026 vivia inline en .claude/hooks/caracteristicas-especiales-prompt.sh (cola P10: pasa a modulo para correr en
 * el mismo node que las otras tres, scripts/_lib/promptHooks.mjs). Misma logica, mismo texto, mismo orden de chequeos.
 *
 * Cuando el mensaje de Fak nombra las caracteristicas especiales (CC/SC, D/TLD, critica, significativa, la sigla, las
 * marcas del flujograma, el I-AC-005) devuelve el criterio canonico, SIN cooldown (pedido textual del 11/09/2026:
 * "siempre que te preguntes, recuerdes todo esto"). Texto y disparadores: core/amfe/caracteristicasEspeciales.data.json,
 * la MISMA fuente del validador, la app y el guard PreToolUse. JSON ilegible: aviso por stderr y nada. Nunca bloquea.
 * Tests: __tests__/scripts/promptHooks.test.mjs (y hooksVarios.test.mjs por el .sh suelto).
 *
 *   printf '%s' "$JSON" | node scripts/_lib/caracteristicasEspecialesPrompt.mjs --hook
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esPrograma, leerStdin, parsearPayload } from './hookComun.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const RUTA_CANON = path.join(RAIZ, 'core', 'amfe', 'caracteristicasEspeciales.data.json');
export const MARCA = '[CARACTERISTICAS-ESPECIALES-PROMPT]';

/** Los avisos automaticos (fin de un agente o de un comando de fondo) llegan como turno de usuario pero no son palabras de Fak. */
export const esAvisoAutomatico = (prompt) => /^\s*<task-notification>|\[SYSTEM NOTIFICATION/.test(String(prompt ?? ''));

/** El canon, o null si no se puede leer o le falta una de las dos listas. */
export function leerCanon(ruta = RUTA_CANON) {
  try {
    const c = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    if (Array.isArray(c?.prompt_disparadores) && Array.isArray(c?.recordatorio)) return c;
  } catch { /* ilegible: abajo se avisa */ }
  return null;
}

/** Contrato de pieza de promptHooks: payload -> texto del additionalContext ('' = nada que decir). */
export function atender(payload, { canon = leerCanon(), avisar = (m) => process.stderr.write(m) } = {}) {
  const prompt = String(payload?.prompt ?? '');
  if (esAvisoAutomatico(prompt)) return '';
  if (!canon) { avisar(`${MARCA} core/amfe/caracteristicasEspeciales.data.json ilegible: el recordatorio quedo apagado.\n`); return ''; }
  if (!canon.prompt_disparadores.some((d) => new RegExp(d.regex, 'i').test(prompt))) return '';
  return canon.recordatorio.join('\n');
}

if (esPrograma(import.meta.url) && process.argv.includes('--hook')) {
  const texto = atender(parsearPayload(await leerStdin()));
  // en Windows el pipe de stdout es asincronico: salir recien cuando se escribio, o la app recibe un JSON cortado
  if (texto) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: texto } }), () => process.exit(0));
}
