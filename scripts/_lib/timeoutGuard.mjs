/**
 * timeoutGuard.mjs — un comando que se corto por timeout NO es evidencia (hook timeout-guard.sh,
 * PostToolUse y PostToolUseFailure con matcher Bash|PowerShell).
 *
 * Origen (A2 del plan del 10/09/2026): el 08/09 un `find` sobre Y: se corto por timeout, lo lei
 * como "no existe", cree de cero el anexo I-AC-012.1 y el mail salio con el dato falso; el anexo
 * estaba en el servidor desde 2011. La leccion ya estaba escrita (LECCIONES 08/09) y se repitio
 * igual: texto no frena nada. Esto deja el aviso en el contexto en el momento exacto en que
 * llega el resultado cortado, como additionalContext (no bloquea: el comando ya corrio).
 *
 * Tolerante al formato: PostToolUse trae `tool_response` (objeto con stdout/stderr o texto) y
 * PostToolUseFailure trae `error`; se miran los dos y algun alias mas. NO se mira `tool_input`:
 * un `grep "timed out"` no es un timeout. Frases y mensaje en cierreCanon.data.json (`timeout`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const CANON = JSON.parse(fs.readFileSync(path.join(AQUI, 'cierreCanon.data.json'), 'utf8')).timeout;

/** Todo lo que el payload trae como RESULTADO del comando, en un solo texto. */
export function textoDelResultado(payload) {
  const partes = [];
  for (const k of ['tool_response', 'tool_result', 'error', 'result', 'output']) {
    const v = payload?.[k];
    if (v === undefined || v === null) continue;
    partes.push(typeof v === 'string' ? v : JSON.stringify(v));
  }
  return partes.join('\n');
}

/** null si el resultado no es un timeout; si lo es, la frase que lo delata y el aviso armado. */
export function evaluarTimeout(payload, cfg = CANON) {
  const m = textoDelResultado(payload).match(new RegExp(cfg.re, 'i'));
  if (!m) return null;
  const comando = String(payload?.tool_input?.command ?? '').replace(/\s+/g, ' ').trim().slice(0, 160) || '(comando no legible)';
  return { frase: m[0], mensaje: cfg.mensaje.replace('{comando}', comando) };
}

const esDirecto = Boolean(process.argv[1] && /timeoutGuard\.mjs$/i.test(process.argv[1]));
if (esDirecto) {
  let payload = {};
  try { payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { payload = {}; }
  const r = evaluarTimeout(payload);
  if (r) {
    const evento = /^PostToolUse(Failure)?$/.test(String(payload.hook_event_name)) ? payload.hook_event_name : 'PostToolUse';
    process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: evento, additionalContext: r.mensaje } })}\n`);
  }
  process.exit(0);
}
