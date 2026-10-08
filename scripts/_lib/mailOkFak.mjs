// mailOkFak.mjs — un mail sale SOLO si el ultimo mensaje de Fak llego DESPUES de que el borrador quedo
// armado en su pantalla.
//
// INCIDENTE 08/10/2026: Fak escribio "arma el mail y mandalo"; arme el borrador y lo envie en el mismo
// turno, sin que el lo viera. El link del cuerpo no andaba. Fak: "como enviaste el primero si no te dije
// que lo envies? ... yo siempre reviso los mails"; "fue un error demasiado grave... pone un bloqueante...
// un poco mas estricto". Un "mandalo" escrito ANTES de que exista el borrador no es el OK de ese borrador.
//
// La regla, medible: el borrador lo arma `_prepararMail.py` / `_mailResponder.py` / `_reenviarMail.py`
// (los tres lo abren en pantalla y anotan la hora en `.mail-cache/borradores_claude.json`), y el
// `_mailEnviar.py --enviar` pasa solo si en el transcript hay un mensaje real de Fak POSTERIOR a esa hora.
// No tiene escape: `--forzar` no lo saltea. Si algo no se puede leer, bloquea (falla cerrado): Fak siempre
// puede apretar Enviar el mismo en la ventana que ya tiene abierta.
import fs from 'node:fs';
import path from 'node:path';
import { sinAvisosAdelante, esAutomatico } from './correccionGuard.mjs';

/** Mismo criterio que `clave_asunto()` de _prepararMail.py: sin RE:/RV:/FW:, espacios colapsados, minusculas. */
export function claveAsunto(s) {
  let t = String(s ?? '').trim();
  for (;;) {
    const m = t.match(/^(re|rv|fw|fwd|reenviar)\s*:\s*/i);
    if (!m) break;
    t = t.slice(m[0].length);
  }
  return t.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Lo que pide el comando: null si no es un envio de _mailEnviar.py; si no, { id, buscar }. */
export function pedidoDeEnvio(cmd) {
  const c = String(cmd ?? '');
  if (!/_mailEnviar\.py/.test(c) || !/(^|\s)--enviar\b/.test(c) || /--selftest/.test(c)) return null;
  const arg = (k) => {
    const m = c.match(new RegExp(`${k}\\s+(?:"([^"]*)"|'([^']*)'|(\\S+))`));
    return m ? (m[1] ?? m[2] ?? m[3]) : '';
  };
  return { id: arg('--id'), buscar: arg('--buscar') };
}

const textoDeBloques = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b?.type === 'text').map((b) => b.text || '').join('\n') : '');

/** Epoch ms del ultimo mensaje REAL de Fak en el transcript (el que escribe mientras trabajo, tambien). 0 si no hay. */
export function ultimoMensajeDeFak(transcriptPath) {
  let lineas;
  try { lineas = fs.readFileSync(transcriptPath, 'utf8').split('\n'); } catch { return 0; }
  let ts = 0;
  for (const linea of lineas) {
    if (!linea.includes('"type":"user"') && !linea.includes('"queued_command"')) continue;
    let o;
    try { o = JSON.parse(linea); } catch { continue; }
    let texto = '';
    if (o.type === 'attachment' && o.attachment?.type === 'queued_command' && o.attachment.commandMode === 'prompt') {
      if (o.attachment.origin?.kind && o.attachment.origin.kind !== 'human') continue;
      texto = sinAvisosAdelante(textoDeBloques(o.attachment.prompt));
    } else if (o.type === 'user') {
      if (o.isMeta || o.isCompactSummary) continue;
      if (o.origin?.kind && o.origin.kind !== 'human') continue;
      const bloques = o.message?.content;
      if (Array.isArray(bloques) && bloques.some((b) => b?.type === 'tool_result')) continue;
      texto = sinAvisosAdelante(textoDeBloques(bloques));
    } else continue;
    if (!texto.trim() || esAutomatico(texto)) continue;
    const t = Date.parse(o.timestamp || '');
    if (t > ts) ts = t;
  }
  return ts;
}

/** El borrador del registro al que apunta el pedido (el mas nuevo si hay varios). null si no esta. */
export function borradorDelRegistro(pedido, registro) {
  const lista = Array.isArray(registro) ? registro : [];
  let cand = [];
  if (pedido.id) cand = lista.filter((e) => e.entry_id === pedido.id);
  else if (pedido.buscar) {
    const b = claveAsunto(pedido.buscar);
    cand = b ? lista.filter((e) => String(e.clave || '').includes(b)) : [];
  }
  if (!cand.length) return null;
  return cand.reduce((a, e) => (Number(e.armado_epoch || 0) > Number(a.armado_epoch || 0) ? e : a));
}

/**
 * Veredicto puro. `ultimoFakMs` en epoch ms; `armado_epoch` del registro en epoch SEGUNDOS reales (time.time()
 * de Python). OJO: `guardado_ts` NO sirve aca: Outlook da la hora local leida como UTC, 3 h corrida (08/10/2026,
 * con ese campo el envio del incidente pasaba). Devuelve { ok:true } o { ok:false, motivo }.
 */
export function veredicto({ pedido, ultimoFakMs, registro }) {
  if (!pedido) return { ok: true };
  if (!pedido.id && !pedido.buscar) return { ok: false, motivo: 'el envio no dice que borrador (--id o --buscar)' };
  const b = borradorDelRegistro(pedido, registro);
  if (!b) return { ok: false, motivo: 'ese borrador no lo armo _prepararMail.py / _mailResponder.py / _reenviarMail.py: no hay registro de que Fak lo haya tenido en pantalla' };
  if (!Number(b.armado_epoch)) return { ok: false, motivo: 'ese borrador es de antes de este control y no tiene la hora en que se armo: hay que rearmarlo y mostrarselo a Fak' };
  const armado = Number(b.armado_epoch) * 1000;
  if (!ultimoFakMs) return { ok: false, motivo: 'no pude leer el ultimo mensaje de Fak en el transcript' };
  if (ultimoFakMs <= armado) {
    const hora = (ms) => new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return { ok: false, motivo: `el ultimo mensaje de Fak es de las ${hora(ultimoFakMs)} y el borrador se armo a las ${hora(armado)}: Fak todavia no lo vio` };
  }
  return { ok: true };
}

/** Para el guardian: lee el registro y el transcript y decide. */
export function evaluarEnvio({ cmd, transcriptPath, raizRepo }) {
  const pedido = pedidoDeEnvio(cmd);
  if (!pedido) return { ok: true };
  let registro = [];
  try { registro = JSON.parse(fs.readFileSync(path.join(raizRepo, '.mail-cache', 'borradores_claude.json'), 'utf8')); } catch { registro = []; }
  const ultimoFakMs = transcriptPath ? ultimoMensajeDeFak(transcriptPath) : 0;
  return veredicto({ pedido, ultimoFakMs, registro });
}
