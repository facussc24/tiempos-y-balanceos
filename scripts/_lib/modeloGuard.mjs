// modeloGuard.mjs — el modelo de una sesion no se cambia a mitad de camino por cuenta propia (tanda 3 del plan del sistema,
// pieza 12, 16/10/2026). CLAUDE.md: «Fable 5.1 para mejoras de codigo importantes, Opus para el resto; no tocar el selector
// por cuenta propia». Con Fable de sesion principal, cambiar a mitad pierde el cache y el razonamiento.
//
// Dos eventos, la misma regla (el cambio lo pide la sesion → hace falta la frase de Fak en su ultimo mensaje):
//   · PreToolUse de `mcp__ccd_session_mgmt__set_session_model`: una sesion que le cambia el modelo a otra (o a si misma).
//     Sin la frase de Fak, frena (exit 2). Sin transcript que leer, frena: es una accion de la sesion.
//   · PreModelSwitch (claude.exe 2.1.299; entrada: from_model, to_model, source = command | picker | sdk): `command`
//     (/model) y `picker` los dispara una persona y pasan siempre. El selector de la app de escritorio manda un
//     `set_model` por el puente, o sea `sdk`, igual que un cambio programatico: por eso con `sdk` se niega SOLO si el
//     transcript muestra que esta sesion pidio cambiar SU PROPIO modelo despues del ultimo mensaje de Fak, y ese mensaje
//     no habla del modelo (hoy la app ni lo permite: queda como red si eso cambia). Si no se puede atribuir, pasa: es Fak.
//     El control que de verdad frena es el PreToolUse de set_session_model.
// La frase de Fak: su ultimo mensaje real (filtro `mensajesDeFak` de mailOkFak.mjs) nombra el modelo o el cambio.
import fs from 'node:fs';
import { mensajesDeFak } from './mailOkFak.mjs';

export const FRASE_MODELO = /\b(?:modelo|opus|fable|sonnet|haiku|selector|ultracode)\b/i;
export const HERRAMIENTA_MODELO = /set_session_model|(?:^|__)set_model$/;
const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** ¿El ultimo mensaje real de Fak habla del modelo? null si el transcript no se puede leer. */
export function fakHabloDelModelo(transcriptPath) {
  const m = transcriptPath ? mensajesDeFak(transcriptPath) : null;
  if (m === null) return null;
  const ultimo = m.reduce((a, x) => (!a || x.ts > a.ts ? x : a), null);
  return Boolean(ultimo && FRASE_MODELO.test(sinTildes(ultimo.texto)));
}

/**
 * ¿Despues del ultimo mensaje de Fak, ESTA sesion pidio cambiar SU PROPIO modelo (una llamada cuyo `session_id` es el de
 * la sesion)? null si no se lee. Auditor Opus 17/10 (TRUE BUG 6): hoy la app no deja que una sesion se cambie el modelo
 * a si misma («Must not be this session», app.asar), asi que un cambio `sdk` casi siempre es el selector de Fak; una
 * llamada que apuntaba a OTRA sesion (una hija) no cuenta. Si la herramienta no aparece en el transcript no se lee nada
 * mas (un transcript de 294 MB costaba 14 s).
 */
export function sesionPidioElCambio(transcriptPath, sessionId = '') {
  let crudo;
  try { crudo = fs.readFileSync(transcriptPath, 'utf8'); } catch { return null; }
  if (!sessionId || !/set_session_model|"set_model"/.test(crudo)) return false;
  const llamadas = [];
  for (const linea of crudo.split('\n')) {
    if (!linea.includes('"tool_use"') || !/set_session_model|set_model/.test(linea)) continue;
    let o;
    try { o = JSON.parse(linea); } catch { continue; }
    if (o.type !== 'assistant') continue;
    const bloques = Array.isArray(o.message?.content) ? o.message.content : [];
    if (bloques.some((b) => b?.type === 'tool_use' && HERRAMIENTA_MODELO.test(String(b.name ?? '')) && String(b.input?.session_id ?? '') === sessionId)) llamadas.push(Date.parse(o.timestamp || ''));
  }
  if (!llamadas.length) return false;
  const desde = (mensajesDeFak(transcriptPath) || []).reduce((a, x) => Math.max(a, x.ts), 0);
  return llamadas.some((t) => t >= desde);
}

const MOTIVO = 'el modelo de una sesion no se cambia por cuenta propia (CLAUDE.md: «no tocar el selector por cuenta propia»; con Fable de sesion principal se pierde el cache y el razonamiento). Hace falta que Fak lo pida en su ultimo mensaje (que nombre el modelo o el cambio); si no, se le pregunta';

/** Veredicto para un payload de hook: { evento, decision: 'deja'|'niega', motivo }. */
export function decidir(p) {
  const evento = String(p?.hook_event_name ?? '');
  const tp = String(p?.transcript_path ?? '');
  if (evento === 'PreModelSwitch') {
    const source = String(p?.source ?? '');
    if (source === 'command' || source === 'picker') return { evento, decision: 'deja', motivo: `lo cambio una persona (${source})` };
    const pidio = sesionPidioElCambio(tp, String(p?.session_id ?? ''));
    if (!pidio) return { evento, decision: 'deja', motivo: pidio === null ? 'sin transcript: no se puede atribuir a la sesion' : 'no salio de una llamada de esta sesion (el selector de la app)' };
    const fak = fakHabloDelModelo(tp);
    return fak ? { evento, decision: 'deja', motivo: 'Fak lo pidio en su ultimo mensaje' } : { evento, decision: 'niega', motivo: MOTIVO };
  }
  if (evento === 'PreToolUse' && HERRAMIENTA_MODELO.test(String(p?.tool_name ?? ''))) {
    const fak = fakHabloDelModelo(tp);
    if (fak) return { evento, decision: 'deja', motivo: 'Fak lo pidio en su ultimo mensaje' };
    return { evento, decision: 'niega', motivo: fak === null ? `${MOTIVO}. No pude leer el transcript para ver lo que pidio Fak` : MOTIVO };
  }
  return { evento, decision: 'deja', motivo: 'no es un cambio de modelo' };
}

/** La salida del hook: PreModelSwitch con su permissionDecision (exit 0); PreToolUse con exit 2 y el motivo. */
export function salida(v, p) {
  if (v.decision !== 'niega') return { exit: 0, stdout: '', stderr: '' };
  if (v.evento === 'PreModelSwitch') {
    return { exit: 0, stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreModelSwitch', permissionDecision: 'deny', permissionDecisionReason: `[MODELO-GUARD] ${v.motivo}.` } }), stderr: '' };
  }
  return { exit: 2, stdout: '', stderr: `[MODELO-GUARD] FRENADO: ${p?.tool_name} cambia el modelo de una sesion y ${v.motivo}.\n` };
}

if (process.argv[1] && /modeloGuard\.mjs$/.test(process.argv[1].replace(/\\/g, '/'))) {
  let s = '';
  try { s = fs.readFileSync(0, 'utf8'); } catch { s = ''; }
  let p = {};
  try { p = JSON.parse(s); } catch { p = {}; }
  const o = salida(decidir(p), p);
  if (o.stdout) process.stdout.write(o.stdout);
  if (o.stderr) process.stderr.write(o.stderr);
  process.exitCode = o.exit;
}
