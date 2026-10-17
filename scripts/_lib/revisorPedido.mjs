/**
 * revisorPedido.mjs — ¿la sesion que entrego algo a Fak lo paso por el agente revisor-pedido? (tanda 9, pieza 1)
 *
 * Lo lee `_cierreSesion.mjs` del registro de la sesion. La primera semana es AVISO, nunca falta (plan de la tanda,
 * docs/PLAN_METODO_2026-10-16.md: «el revisor nuevo y los bancos avisan la primera semana, no frenan»).
 *
 * Que cuenta como entrega: un `SendUserFile`, un Write/Edit de un documento (.pptx .xlsx .docx .pdf .msg) dentro de
 * `exports\` o de la biblioteca de Ingenieria, o un comando de Bash/PowerShell que nombra uno de esos documentos ahi,
 * siempre de la sesion principal (no de un subagente). Puede contar de mas (un comando que solo lo lee) y no ve un
 * documento que un script arma sin nombrar su ruta en el comando: por eso es aviso, y «no-aplica» no prueba que no hubo
 * entrega. Que cuenta como revisor: una
 * llamada a Agent con `subagent_type: revisor-pedido`, o un `investigador` cuyo prompt trae el cuerpo del revisor
 * («# Revisor contra el pedido»), que es como se calibra mientras la definicion nueva no aparece en la sesion.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DOC = /\.(pptx|xlsx|docx|pdf|msg)$/i;
const LUGAR = /[\\/]exports[\\/]|Ingenier[ií]a y Proyecto/i;

/** Una linea del registro → { entregas: [rutas], revisor: bool } (solo la sesion principal). */
export function senalesDeLinea(linea) {
  const vacio = { entregas: [], revisor: false };
  if (!linea.includes('"tool_use"') || linea.includes('"isSidechain":true')) return vacio;
  let o; try { o = JSON.parse(linea); } catch { return vacio; }
  if (o?.type !== 'assistant' || o.isSidechain) return vacio;
  const out = { entregas: [], revisor: false };
  for (const b of o.message?.content ?? []) {
    if (b?.type !== 'tool_use') continue;
    const inp = b.input ?? {};
    if (b.name === 'SendUserFile' && Array.isArray(inp.files)) out.entregas.push(...inp.files.filter((f) => typeof f === 'string'));
    if ((b.name === 'Write' || b.name === 'Edit') && typeof inp.file_path === 'string' && DOC.test(inp.file_path) && LUGAR.test(inp.file_path)) out.entregas.push(inp.file_path);
    // Auditor 17/10: el caso D2 (mail y Excel armados por scripts) no pasaba por Write ni por SendUserFile y daba
    // «no-aplica». Un comando que nombra un documento en exports\ o en la biblioteca cuenta como entrega; puede contar de
    // mas (un comando que solo lo lee), por eso el paso es un aviso.
    if ((b.name === 'Bash' || b.name === 'PowerShell') && typeof inp.command === 'string') {
      for (const m of inp.command.matchAll(/(?:[A-Za-z]:[\\/]|exports[\\/])[^"'\n|<>]*?\.(?:pptx|xlsx|docx|pdf|msg)\b/gi)) if (LUGAR.test(m[0]) || /^exports[\\/]/i.test(m[0])) out.entregas.push(m[0]);
    }
    if ((b.name === 'Agent' || b.name === 'Task') && (inp.subagent_type === 'revisor-pedido' || String(inp.prompt ?? '').trimStart().startsWith('# Revisor contra el pedido'))) out.revisor = true;
  }
  return out;
}

/** Recorre el registro entero. Devuelve { entregas, revisor, leido }. */
export function relevarRevisorPedido(transcriptPath) {
  let texto;
  try { texto = fs.readFileSync(transcriptPath, 'utf8'); } catch { return { entregas: [], revisor: false, leido: false }; }
  // Auditor 17/10: el revisor vale si corrio DESPUES de la ultima entrega (uno que corrio antes no reviso lo entregado).
  const entregas = new Set(); let ultimaEntrega = -1; let ultimoRevisor = -1; let i = 0;
  for (const l of texto.split('\n')) {
    i += 1;
    if (!l) continue;
    const s = senalesDeLinea(l);
    if (s.entregas.length) { s.entregas.forEach((e) => entregas.add(e)); ultimaEntrega = i; }
    if (s.revisor) ultimoRevisor = i;
  }
  return { entregas: [...entregas], revisor: ultimoRevisor > 0 && ultimoRevisor > ultimaEntrega, leido: true };
}

/** El registro de una sesion por su id, en cualquiera de las carpetas del proyecto (principal o worktree). */
export function registroDeSesion(id, { home = os.homedir() } = {}) {
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(String(id ?? ''))) return null;
  const base = path.join(home, '.claude', 'projects');
  let dirs = [];
  try { dirs = fs.readdirSync(base).filter((d) => d.startsWith('C--Dev-BarackMercosul')); } catch { return null; }
  for (const d of dirs) { const p = path.join(base, d, `${id}.jsonl`); if (fs.existsSync(p)) return p; }
  return null;
}

/** Puro. Nunca 'falta': la primera semana el revisor avisa. */
export function evaluarRevisorPedido({ entregas = [], revisor = false, leido = true } = {}) {
  if (!leido) return { estado: 'aviso', detalle: 'no pude leer el registro de esta sesion (sin CLAUDE_CODE_SESSION_ID o sin el archivo): no se sabe si hubo entregas' };
  if (!entregas.length) return { estado: 'no-aplica', detalle: 'esta sesion no le entrego documentos a Fak (ni SendUserFile ni Write en exports o en la biblioteca)' };
  if (revisor) return { estado: 'ok', detalle: `${entregas.length} entrega(s) y el revisor-pedido corrio en la sesion` };
  return {
    estado: 'aviso',
    detalle: `${entregas.length} entrega(s) y el revisor-pedido no corrio: si era mediano o grande, lanzalo con el pedido textual, la definicion de hecho, el quiz y la ruta (la primera semana avisa, no frena)\n`
      + entregas.slice(0, 4).map((e) => `      · ${e}`).join('\n'),
  };
}
