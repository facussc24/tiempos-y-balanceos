/**
 * timeoutGuard.mjs — un comando que se corto por timeout NO es evidencia (hook PostToolUse y
 * PostToolUseFailure con matcher Bash|PowerShell).
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
 *
 * CABLEADO (30/09/2026): settings.json llama a ESTE archivo con `node`, sin el envoltorio bash de
 * timeout-guard.sh. Corrio ~21.000 veces en septiembre y aviso 1: cada corrida pagaba un bash
 * (msys) + dos subshells + un grep antes de llegar a decir "no pasa nada". Ahora es un solo node y
 * el camino comun (el 99,99 %) es UN regex sobre el payload crudo y afuera, sin parsear el JSON ni
 * leer el canon. El regex de esa compuerta es el mismo grep que hacia el .sh (ver COMPUERTA) y es
 * mas ancho que el de `evaluarTimeout` a proposito: la compuerta solo decide si vale la pena mirar.
 * Nunca bloquea (el comando ya corrio) y nunca falla ruidoso: exit 0 siempre.
 * timeout-guard.sh queda como la misma cosa por bash (lo usan sus tests y se puede llamar suelto).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
/** Las dos frases con que Claude Code corta un Bash, sin anclar: si el crudo ni las nombra, no hay nada que mirar. */
export const COMPUERTA = /Command timed out after|Command did not complete within/;

let _canon = null;
/** El canon se lee la primera vez que hace falta: el camino comun no lo necesita. */
export function canon() {
  if (!_canon) _canon = JSON.parse(fs.readFileSync(path.join(AQUI, 'cierreCanon.data.json'), 'utf8')).timeout;
  return _canon;
}

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
export function evaluarTimeout(payload, cfg = canon()) {
  const m = textoDelResultado(payload).match(new RegExp(cfg.re, 'i'));
  if (!m) return null;
  const comando = String(payload?.tool_input?.command ?? '').replace(/\s+/g, ' ').trim().slice(0, 160) || '(comando no legible)';
  return { frase: m[0], mensaje: cfg.mensaje.replace('{comando}', comando) };
}

const esDirecto = Boolean(process.argv[1] && /timeoutGuard\.mjs$/i.test(process.argv[1]));
if (esDirecto) {
  try {
    let crudo = '';
    try { crudo = fs.readFileSync(0, 'utf8'); } catch { crudo = ''; }
    if (COMPUERTA.test(crudo)) {
      let payload = {};
      try { payload = JSON.parse(crudo || '{}'); } catch { payload = {}; }
      const r = evaluarTimeout(payload);
      if (r) {
        const evento = /^PostToolUse(Failure)?$/.test(String(payload.hook_event_name)) ? payload.hook_event_name : 'PostToolUse';
        process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: evento, additionalContext: r.mensaje } })}\n`);
      }
    }
  } catch { /* un guardian de aviso que falla no hace ruido: el comando ya corrio */ }
  process.exit(0);
}
