/**
 * horaGuard.mjs — cuando Fak deja a Claude trabajando solo HASTA UNA HORA, que Claude no cierre antes.
 *
 * Por que existe (03/10/2026): Fak se fue a las 13:50 con "quedate laburando como minimo hasta esa hora" (las 20).
 * Claude trabajo hasta las 17:10, escribio un resumen y termino el turno. Como nada lo volvio a despertar, quedo
 * parado seis horas ("no te quedaste hasta las 8, decime por que, defendete"). El pedido era POR TIEMPO y se trato
 * como una lista: cuando se acabo la lista, se dio por terminado. Y una sesion no sigue sola: al terminar de contestar
 * queda parada hasta que llega un mensaje, el aviso de algo que quedo corriendo, o un aviso programado (CronCreate).
 *
 * Tres piezas:
 *   1. hora-prompt.sh (UserPromptSubmit): si el mensaje de Fak pone una hora para trabajar ("labura hasta las 8",
 *      "continua hasta manana a las 10am, hasta esa hora no pares", "ponete un cronometro"), avisa lo que hay que
 *      armar ANTES de seguir: fijar la hora, el latido (CronCreate) y la lista de trabajo en un archivo.
 *   2. El estado: ~/.claude/.trabajar-hasta.json, por sesion: hasta cuando, el latido y la lista. Lo escribe Claude
 *      con --fijar / --latido / --terminar (el hook no adivina la hora: "hasta 8" puede ser las 20 de hoy).
 *   3. hora-guard.sh (Stop): frena el cierre del turno si (a) Fak puso una hora y no se fijo ni se dijo
 *      "No aplica trabajar-hasta: ..."; (b) hay una hora vigente y no hay latido registrado; (c) hay una hora vigente
 *      y el mensaje final declara un cierre. Frena una vez por turno (stop_hook_active), como el cierre-guard.
 * Lo que NO hace: no mantiene la sesion despierta (eso es el latido) ni decide que trabajo hacer (eso es la lista).
 *
 *   node scripts/_lib/horaGuard.mjs --hook                 # stdin: JSON de UserPromptSubmit
 *   node scripts/_lib/horaGuard.mjs --stop                 # stdin: JSON de Stop (exit 2 = frena)
 *   node scripts/_lib/horaGuard.mjs --fijar "2026-10-04 10:00" --lista <archivo> [--pedido "..."] [--sesion <id>]
 *   node scripts/_lib/horaGuard.mjs --latido <id del CronCreate> [--sesion <id>]
 *   node scripts/_lib/horaGuard.mjs --terminar --porque "<motivo>" [--sesion <id>]
 *   node scripts/_lib/horaGuard.mjs --estado | --contexto  # lo vigente (--contexto: una linea para el arranque)
 *   node scripts/_lib/horaGuard.mjs --medir <mensajes.jsonl> [--muestra]    # filas {ses,t}
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizar, distancia, esAutomatico, sinAvisosAdelante } from './correccionGuard.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const CANON = JSON.parse(fs.readFileSync(path.join(AQUI, 'horaCanon.data.json'), 'utf8'));
export const MARCA = CANON.marca;
export const NO_APLICA = CANON.no_aplica;
const dosDig = (n) => String(n).padStart(2, '0');

// ---------------------------------------------------------------------------------------------
// 1. ¿El mensaje pone una hora para trabajar?
// ---------------------------------------------------------------------------------------------

/** ¿La palabra `w` es `p` con un error de tipeo? (1 cambio hasta 6 letras, 2 hasta 9, 3 mas largas; trasposicion = 1) */
function parecida(w, p) {
  if (w === p) return true;
  if (w.length < 4 || p.length < 4) return false;
  const tope = p.length <= 6 ? 1 : (p.length <= 9 ? 2 : 3);
  return distancia(w, p, tope) <= tope;
}
const alguna = (w, lista) => lista.some((p) => parecida(w, p));
/** Un verbo de trabajar dicho como pedido: "quedate", "labrua"; no el pasado de un reclamo ("no te quedaste hasta las 8"). */
const esVerbo = (w) => !/ste$/.test(w) && alguna(w, CANON.verbos);
/** El reloj: las palabras cortas van exactas ("croe" es "creo" mal escrito, no "cron"). */
const esReloj = (w) => CANON.reloj.some((p) => (p.length <= 5 ? w === p : parecida(w, p)));

/**
 * Las horas escritas en el texto normalizado, con su posicion (indice de palabra): "8pm", "10am", "a las 20",
 * "hasta 8", "las 21hs", "20:30". Tolera el espacio corrido de Fak ("a ala s8pm", "a als 10am").
 * Devuelve [{ i, hora, minuto, sufijo }] (sufijo: 'am' | 'pm' | 'hs' | '').
 */
export function horasEn(palabras) {
  const out = [];
  palabras.forEach((w, i) => {
    let m = w.match(/^[a-z]{0,3}?(\d{1,2})(?:[:.](\d{2}))?(am|pm|hs|h)$/);          // 8pm · s8pm · 10am · 21hs · 20:30hs
    if (m) { out.push({ i, hora: Number(m[1]), minuto: Number(m[2] || 0), sufijo: m[3] === 'h' ? 'hs' : m[3] }); return; }
    m = w.match(/^(\d{1,2})[:.](\d{2})$/);                                           // 20:30
    if (m) { out.push({ i, hora: Number(m[1]), minuto: Number(m[2]), sufijo: '' }); return; }
    m = w.match(/^(\d{1,2})$/);                                                      // "hasta 8" · "a las 20" · "8 pm"
    if (m) {
      const antes = palabras.slice(Math.max(0, i - 2), i).join(' ');
      const sig = palabras[i + 1] || '';
      const suf = /^(am|pm|hs)$/.test(sig) ? sig : '';
      if (suf || /\b(hasta|las|la|als|ala|alas)$/.test(antes) || /hasta (las|la|als|ala) ?$/.test(antes)) out.push({ i, hora: Number(m[1]), minuto: 0, sufijo: suf });
    }
  });
  return out.filter((h) => h.hora >= 0 && h.hora <= 24 && h.minuto < 60);
}

/**
 * Lo que el mensaje dice sobre trabajar hasta una hora.
 * @returns {{ pide: boolean, horas: Array, manana: boolean, sin_hora: boolean, senales: string[] }}
 *   pide = hay un "hasta <hora | esa hora | manana>" con un verbo de trabajar, un "no pares" o un reloj cerca; o un
 *   "toda la noche / todo el dia" con un verbo de trabajar (sin_hora).
 */
export function pideHasta(texto) {
  const t = normalizar(sinAvisosAdelante(texto));
  const palabras = t.replace(/[¿?¡!.,;()«»"']/g, ' ').split(/\s+/).filter(Boolean);
  const senales = [];
  const V = CANON.ventana_palabras;
  const idxHasta = palabras.map((w, i) => (w === 'hasta' || parecida(w, 'hasta') ? i : -1)).filter((i) => i >= 0);
  const horas = horasEn(palabras);
  const idxManana = palabras.map((w, i) => (alguna(w, CANON.manana) ? i : -1)).filter((i) => i >= 0);
  // "hasta" con algo que dice cuando: una hora, "esa hora", "manana"
  const hastaCuando = idxHasta.filter((h) => {
    const cola = palabras.slice(h + 1, h + 6);
    return horas.some((x) => x.i > h && x.i <= h + 5) || cola.some((w) => alguna(w, CANON.esa_hora)) || cola.some((w) => alguna(w, CANON.manana));
  });
  const idxVerbo = palabras.map((w, i) => (esVerbo(w) ? i : -1)).filter((i) => i >= 0);
  const idxNoPares = palabras.map((w, i) => (alguna(w, CANON.no_pares) && palabras.slice(Math.max(0, i - 3), i).includes('no') ? i : -1)).filter((i) => i >= 0);
  const idxReloj = palabras.map((w, i) => (esReloj(w) ? i : -1)).filter((i) => i >= 0);
  const cerca = (a, lista) => lista.some((b) => Math.abs(a - b) <= V);
  let pide = false;
  for (const h of hastaCuando) {
    if (cerca(h, idxVerbo)) { pide = true; senales.push('verbo+hasta'); }
    if (cerca(h, idxNoPares)) { pide = true; senales.push('no_pares+hasta'); }
    if (cerca(h, idxReloj)) { pide = true; senales.push('reloj+hasta'); }
  }
  // un reloj pedido con una hora cerca, aunque no diga "hasta": "manana a las 10am quiero ver... ponete un cronometro"
  if (!pide && idxReloj.length && horas.some((x) => cerca(x.i, idxReloj) || cerca(x.i, idxVerbo))) { pide = true; senales.push('reloj+hora'); }
  let sinHora = false;
  if (!pide) {
    for (const frase of CANON.largo) {
      const pos = t.indexOf(frase);
      if (pos < 0) continue;
      const i = t.slice(0, pos).split(/\s+/).filter(Boolean).length;
      if (cerca(i, idxVerbo) || cerca(i, idxNoPares)) { pide = true; sinHora = true; senales.push(`largo:${frase}`); }
    }
  }
  return { pide, horas: pide ? horas : [], manana: pide && idxManana.length > 0, sin_hora: sinHora, senales: [...new Set(senales)] };
}

/** ¿El mensaje pide parar? Solo importa con una hora vigente. Palabra suelta al principio o "ya esta, <parar>". */
export function pideParar(texto) {
  const t = normalizar(sinAvisosAdelante(texto));
  const palabras = t.replace(/[¿?¡!.,;()«»"']/g, ' ').split(/\s+/).filter(Boolean);
  // "para" es tambien la preposicion: como pedido de parar vale solo si es la PRIMERA palabra ("para", "para un poco")
  if (palabras.length && CANON.parar.includes(palabras[0]) && palabras[1] !== 'que') return true;
  return /\b(ya esta|deja asi|deja ahi|no sigas|corta aca|para aca|frena aca)\b/.test(t);
}

// ---------------------------------------------------------------------------------------------
// 2. El estado: hasta cuando hay que trabajar, por sesion
// ---------------------------------------------------------------------------------------------

export const rutaEstado = (home = os.homedir()) => path.join(home, '.claude', '.trabajar-hasta.json');

export function leerTodo(home) {
  try { const j = JSON.parse(fs.readFileSync(rutaEstado(home), 'utf8')); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; }
  catch { return {}; }
}
function guardarTodo(todo, home) {
  const p = rutaEstado(home);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(todo, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, p);
}
export const leerEstado = (sesion, home) => (sesion ? leerTodo(home)[sesion] || null : null);

/** "2026-10-04 10:00" (hora local) -> Date, o null. */
export function aFecha(texto) {
  const m = String(texto || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}
export const enLocal = (d) => `${d.getFullYear()}-${dosDig(d.getMonth() + 1)}-${dosDig(d.getDate())} ${dosDig(d.getHours())}:${dosDig(d.getMinutes())}`;

export function fijar({ sesion, hasta, lista = null, pedido = null, ahora = new Date(), home } = {}) {
  const d = hasta instanceof Date ? hasta : aFecha(hasta);
  if (!sesion) return { ok: false, error: 'no se de que sesion es (pasar --sesion <id>)' };
  if (!d) return { ok: false, error: 'la hora va como "AAAA-MM-DD HH:MM" (hora de esta PC)' };
  if (d.getTime() <= ahora.getTime()) return { ok: false, error: `esa hora ya paso (son las ${enLocal(ahora)})` };
  if (d.getTime() - ahora.getTime() > 36 * 3600 * 1000) return { ok: false, error: 'es a mas de 36 horas: revisar la fecha' };
  if (lista && !fs.existsSync(lista)) return { ok: false, error: `no existe el archivo de la lista: ${lista}` };
  const todo = leerTodo(home);
  const previo = todo[sesion] && !todo[sesion].cumplido ? todo[sesion] : {};   // de un pedido ya cerrado no se hereda nada
  todo[sesion] = { hasta: enLocal(d), pedido: pedido || previo.pedido || null, lista: lista ? path.resolve(lista) : (previo.lista || null), latido: previo.latido || null, fijado: enLocal(ahora), fijado_ms: ahora.getTime() };
  guardarTodo(todo, home);
  return { ok: true, estado: todo[sesion] };
}
export function registrarLatido({ sesion, id, home } = {}) {
  const todo = leerTodo(home);
  if (!sesion || !todo[sesion] || todo[sesion].cumplido) return { ok: false, error: 'no hay una hora fijada para esta sesion: primero --fijar' };
  if (!id || !String(id).trim()) return { ok: false, error: 'falta el id del aviso programado (el que devuelve CronCreate)' };
  todo[sesion].latido = String(id).trim();
  guardarTodo(todo, home);
  return { ok: true, estado: todo[sesion] };
}
export function terminar({ sesion, porque = null, ahora = new Date(), home } = {}) {
  const todo = leerTodo(home);
  const e = sesion ? todo[sesion] : null;
  if (!e || e.cumplido) return { ok: true, estado: null, nada: true };
  const vencio = (aFecha(e.hasta) || ahora).getTime() <= ahora.getTime();
  if (!vencio && !(porque && String(porque).trim().length >= 8)) return { ok: false, error: `todavia no son las ${e.hasta}: para terminar antes hace falta --porque "<lo que dijo Fak>"` };
  // No se borra: queda la MARCA de que ese pedido se atendio. El 04/10/2026, al llegar las 10:00, cerre con --terminar y
  // el control de cierre, que ya no encontraba nada, volvio a pedir que fijara la hora del mismo mensaje de Fak.
  todo[sesion] = { cumplido: enLocal(ahora), hasta: e.hasta, pedido: e.pedido || null, fijado: e.fijado || null, fijado_ms: Number.isFinite(e.fijado_ms) ? e.fijado_ms : null, porque: porque || null };
  for (const [s, v] of Object.entries(todo)) {
    if (s !== sesion && v && v.cumplido && aFecha(v.cumplido) && ahora.getTime() - aFecha(v.cumplido).getTime() > DIAS_MARCA * 86400000) delete todo[s];
  }
  guardarTodo(todo, home);
  return { ok: true, estado: e, vencio };
}
/** Cuantos dias se guarda la marca de un pedido ya cumplido de OTRA sesion. */
const DIAS_MARCA = 14;
/** vigente = hay hora fijada, no se cerro y todavia no llego. */
export function vigente(sesion, { ahora = new Date(), home } = {}) {
  const e = leerEstado(sesion, home);
  if (!e || e.cumplido) return null;
  const d = aFecha(e.hasta);
  return d && d.getTime() > ahora.getTime() ? { ...e, fecha: d } : null;
}

/** La sesion a la que le habla un comando suelto: la del transcript mas nuevo de este proyecto. */
export function sesionActual({ cwd = process.cwd(), home = os.homedir() } = {}) {
  try {
    const raiz = path.resolve(AQUI, '..', '..');
    const base = path.join(home, '.claude', 'projects');
    const slug = (p) => p.replace(/[^A-Za-z0-9]/g, '-');
    const carpetas = fs.readdirSync(base).filter((d) => d === slug(raiz) || d === slug(cwd));
    let mejor = null;
    for (const c of carpetas) {
      for (const f of fs.readdirSync(path.join(base, c)).filter((x) => x.endsWith('.jsonl'))) {
        const t = fs.statSync(path.join(base, c, f)).mtimeMs;
        if (!mejor || t > mejor.t) mejor = { t, id: f.replace(/\.jsonl$/, '') };
      }
    }
    return mejor ? mejor.id : null;
  } catch { return null; }
}

// ---------------------------------------------------------------------------------------------
// 3. Los avisos (UserPromptSubmit) y el control de cierre (Stop)
// ---------------------------------------------------------------------------------------------

function leidas(p) {
  if (p.sin_hora) return 'no dice una hora: «toda la noche» / «todo el día»';
  const hs = p.horas.map((h) => `${h.hora}${h.minuto ? `:${dosDig(h.minuto)}` : ''}${h.sufijo ? ` ${h.sufijo}` : ''}`);
  return `${hs.length ? `hora leída: ${hs.join(', ')}` : 'dice «hasta esa hora» o «hasta mañana»'}${p.manana ? ' · nombra «mañana»' : ''}`;
}

/** El aviso para un mensaje de Fak, o null. `estado` = lo vigente de esa sesion (o null). */
export function avisoDe(texto, { estado = null, ahora = new Date() } = {}) {
  if (esAutomatico(texto)) return null;
  // el propio latido (un aviso programado, no Fak) nombra la hora: no es un pedido nuevo
  if (/^\s*LATIDO\b/.test(sinAvisosAdelante(texto))) return null;
  const p = pideHasta(texto);
  if (p.pide && estado) {
    return `${MARCA} Ya hay una hora fijada: trabajar hasta las ${estado.hasta} (lista: ${estado.lista || 'sin archivo'}). Este mensaje de Fak también nombra una hora (${leidas(p)}): si la cambió, volvé a fijarla con --fijar; si es la misma, seguí con la lista y no cierres antes.`;
  }
  if (p.pide) {
    return `${MARCA} Fak te deja trabajando solo hasta una hora (${leidas(p)}; ahora son las ${enLocal(ahora)}). Cuando terminás de contestar quedás PARADO hasta que algo te despierte: sin un aviso programado no hay trabajo. ANTES de seguir con lo que pide:\n`
      + '1. Escribí la lista de trabajo en un archivo: lo que pidió primero, y después qué auditar o mejorar por tu cuenta. El pedido es por TIEMPO, no por lista: cuando se acabe la lista, se le agrega, no se cierra.\n'
      + `2. Fijá la hora: node scripts/_lib/horaGuard.mjs --fijar "AAAA-MM-DD HH:MM" --lista <ese archivo> --pedido "<sus palabras>". Si la hora es ambigua («hasta 8»), es la próxima que tenga sentido con lo que dijo.\n`
      + `3. Armá el latido con CronCreate (cada ${CANON.latido_minutos} minutos, en minutos que no sean :00 ni :30), con un prompt que mande a mirar la hora, leer la lista y seguir; y registralo: node scripts/_lib/horaGuard.mjs --latido <id>.\n`
      + '4. El resumen para Fak va cuando LLEGA la hora, no antes. Mientras tanto, lo hecho se anota en el archivo de la lista. Y nada que le muestre un cartel de aprobación: te quedarías colgado.\n'
      + `Si el mensaje no pide eso, escribí un renglón que empiece con «${NO_APLICA}» y el motivo.`;
  }
  if (estado) {
    if (pideParar(texto)) return `${MARCA} Hay un pedido vigente de trabajar hasta las ${estado.hasta}. Si Fak te está diciendo que pares, terminalo: node scripts/_lib/horaGuard.mjs --terminar --porque "<sus palabras>" y borrá el latido (CronDelete ${estado.latido || '<id>'}). Si no, sigue vigente.`;
    return `${MARCA} Sigue vigente: trabajar hasta las ${estado.hasta} (lista: ${estado.lista || 'sin archivo'}; latido: ${estado.latido || 'SIN ARMAR'}). Contestale a Fak y seguí con la lista; no cierres antes.`;
  }
  return null;
}

export function atender(j, deps = {}) {
  if (!j || typeof j !== 'object' || j.agent_id || j.hook_event_name !== 'UserPromptSubmit') return null;
  try {
    const ahora = deps.ahora || new Date();
    const estado = vigente(j.session_id, { ahora, home: deps.home });
    return avisoDe(typeof j.prompt === 'string' ? j.prompt : '', { estado, ahora });
  } catch { return null; }
}

/** El ultimo mensaje que escribio Fak en el transcript: { texto, ms } (ms = cuando lo mando, o null). Solo lee. */
export function ultimoDeFakConHora(transcriptPath) {
  try {
    const lineas = fs.readFileSync(transcriptPath, 'utf8').split('\n');
    for (let k = lineas.length - 1; k >= 0; k--) {
      if (!lineas[k] || !(lineas[k].includes('"user"') || lineas[k].includes('"queue-operation"') || lineas[k].includes('"queued_command"'))) continue;
      let j = null; try { j = JSON.parse(lineas[k]); } catch { continue; }
      if (j.isSidechain || j.isMeta) continue;
      let c = null;
      // Lo que Fak escribe mientras la sesion esta ocupada no vuelve a aparecer como turno `user`: queda en la cola
      // (`enqueue`) o entra a mitad de turno como adjunto (`queued_command` de origen humano). El 04/10/2026, 66 de sus
      // 110 mensajes de una sesion estaban solo asi, y «podes seguir hasta las 16» fue uno de ellos.
      if (j.type === 'queue-operation') {
        if (j.operation !== 'enqueue') continue;
        c = j.content;
      } else if (j.type === 'attachment') {
        const a = j.attachment || {};
        if (a.type !== 'queued_command' || !(a.humanTurn || (a.origin && a.origin.kind === 'human'))) continue;
        c = Array.isArray(a.prompt) ? a.prompt.filter((b) => b && b.type === 'text').map((b) => b.text || '').join('\n') : a.prompt;
      } else if (j.type === 'user') {
        c = j.message && j.message.content;
        if (Array.isArray(c)) {
          if (c.some((b) => b && b.type === 'tool_result')) continue;
          c = c.filter((b) => b && b.type === 'text').map((b) => b.text || '').join('');
        }
      } else continue;
      if (typeof c !== 'string' || !c.trim() || esAutomatico(c)) continue;
      if (/^\s*LATIDO\b/.test(sinAvisosAdelante(c))) continue;            // el latido es un aviso programado, no Fak
      const ms = typeof j.timestamp === 'string' ? Date.parse(j.timestamp) : NaN;
      return { texto: c, ms: Number.isFinite(ms) ? ms : null };
    }
  } catch { /* sin transcript no se sabe */ }
  return { texto: '', ms: null };
}
/** El ultimo mensaje que escribio Fak en el transcript (texto), o ''. */
export const ultimoDeFak = (transcriptPath) => ultimoDeFakConHora(transcriptPath).texto;

/**
 * ¿Ese mensaje de Fak ya se atendio? Si: hay una hora fijada para la sesion (vigente, vencida o ya cerrada con --terminar)
 * y se fijo DESPUES de que el lo mando. Un mensaje nuevo, posterior a la ultima vez que se fijo, no esta atendido.
 * Sin la hora del mensaje no se puede comparar: vale que haya algo fijado (como antes del 04/10/2026).
 */
export function atendido(estado, msMensaje = null) {
  if (!estado) return false;
  const f = Number.isFinite(estado.fijado_ms) ? estado.fijado_ms : (aFecha(estado.fijado) ? aFecha(estado.fijado).getTime() + 59999 : null);
  if (msMensaje == null || f == null) return true;
  return f >= msMensaje;
}

// «terminé» va CON tilde, sin `\b` detras y cerrando la frase («Terminé.», «ya terminé con todo», «terminé por hoy»):
// en JavaScript `\b` no ve la «é» como letra, asi que `termin[eé]\b` frenaba «cuando termine la suite, sigo» (un aviso de
// que se sigue) y dejaba pasar «Terminé.» (04/10/2026, a la 1:42: el freno me corto un aviso de espera). «Terminé la hoja
// 3 y sigo con la 4» cuenta una parte, no se despide.
const CIERRE_RE = [/\bresumen (final|de la noche|del d[ií]a)\b/i, /\b(qued[oó] (todo )?(hecho|listo|terminado))\b/i, /(?<![\p{L}\d])terminé(?=\s*(?:[.!]|$|con todo|todo\b|por hoy))/iu, /\b(listo por hoy|eso es todo|hasta ac[aá] lleg)/i, /\b(cierro|doy por (cerrad|terminad))/i];
/** ¿El mensaje final se despide como si el trabajo hubiera terminado? */
export const declaraFin = (texto) => { const t = String(texto || ''); return CIERRE_RE.some((r) => r.test(t)); };

/**
 * Decide el Stop. @returns {{ ok: boolean, motivo: string, mensaje?: string }}
 * payload: { session_id, stop_hook_active, last_assistant_message, transcript_path, agent_id }
 */
export function decidirStop(payload = {}, deps = {}) {
  if (!payload || typeof payload !== 'object') return { ok: true, motivo: 'sin_datos' };
  if (payload.agent_id) return { ok: true, motivo: 'es_un_agente' };
  const ahora = deps.ahora || new Date();
  const final = String(payload.last_assistant_message || '');
  const e = vigente(payload.session_id, { ahora, home: deps.home });
  // El latido: Claude Code le pasa al hook los avisos programados vivos de la sesion (`session_crons`). Si ese dato
  // viene, manda el (un latido registrado que ya murio no cuenta); si no viene, vale el que se registro con --latido.
  const crons = Array.isArray(payload.session_crons) ? payload.session_crons : null;
  const hayLatido = crons ? crons.length > 0 : !!(e && e.latido);
  if (e && !hayLatido) {
    // sin latido se frena SIEMPRE (tambien en el segundo intento del mismo turno): cerrar asi es quedar parado. El tope
    // de bloqueos seguidos de Claude Code corta un bucle.
    return { ok: false, motivo: 'sin_latido', mensaje: `${MARCA} Fak pidió trabajar hasta las ${e.hasta} y no hay ningún aviso programado vivo en esta sesión: si cerrás el turno ahora, quedás parado y nadie te despierta. Armalo con CronCreate (cada ${CANON.latido_minutos} minutos, con un prompt que mande a mirar la hora, leer ${e.lista || 'la lista'} y seguir) y registralo: node scripts/_lib/horaGuard.mjs --latido <id>.` };
  }
  if (payload.stop_hook_active) return { ok: true, motivo: 'stop_hook_active' };
  if (e) {
    if (declaraFin(final)) {
      return { ok: false, motivo: 'cierre_antes_de_hora', mensaje: `${MARCA} Son las ${enLocal(ahora)} y Fak pidió trabajar hasta las ${e.hasta}: el mensaje se despide como si hubieras terminado. El pedido es por tiempo, no por lista: abrí ${e.lista || 'la lista'}, agregale lo que sigue (auditar, probar, mejorar) y seguí. El resumen va cuando llega la hora.` };
    }
    return { ok: true, motivo: 'vigente_con_latido' };
  }
  // sin hora fijada: ¿el ultimo mensaje de Fak ponia una y no se atendio?
  const leer = deps.ultimoDeFak || ultimoDeFakConHora;
  const leido = payload.transcript_path ? leer(payload.transcript_path) : '';
  const ultimo = typeof leido === 'string' ? leido : (leido && leido.texto) || '';
  const msUltimo = leido && typeof leido === 'object' && Number.isFinite(leido.ms) ? leido.ms : null;
  if (ultimo && pideHasta(ultimo).pide && !final.includes(NO_APLICA) && !atendido(leerEstado(payload.session_id, deps.home), msUltimo)) {
    return { ok: false, motivo: 'hora_sin_fijar', mensaje: `${MARCA} El último mensaje de Fak pone una hora para trabajar (${leidas(pideHasta(ultimo))}) y no la fijaste. Antes de cerrar el turno: la lista en un archivo, node scripts/_lib/horaGuard.mjs --fijar "AAAA-MM-DD HH:MM" --lista <archivo>, el latido con CronCreate y --latido <id>. Si no pide eso, un renglón que empiece con «${NO_APLICA}» y el motivo.` };
  }
  return { ok: true, motivo: 'nada_vigente' };
}

/** Una linea para el arranque o la compactacion (session-start-context.sh), o ''. */
export function contexto({ sesion = null, ahora = new Date(), home } = {}) {
  const todo = leerTodo(home);
  const vivos = Object.entries(todo).filter(([s, e]) => (!sesion || s === sesion) && !e.cumplido && aFecha(e.hasta) && aFecha(e.hasta).getTime() > ahora.getTime());
  if (!vivos.length) return '';
  return vivos.map(([s, e]) => `${MARCA} Pedido VIGENTE de Fak (sesión ${s.slice(0, 8)}): trabajar sin parar hasta las ${e.hasta}. Lista: ${e.lista || 'sin archivo'}. Latido: ${e.latido || 'SIN ARMAR'} (mirá con CronList que siga vivo; si no está, armalo de nuevo con CronCreate y registralo con --latido). No cierres con un resumen antes de esa hora.`).join('\n');
}

// ---------------------------------------------------------------------------------------------
// Linea de comandos
// ---------------------------------------------------------------------------------------------

function leerStdin(cb) { let raw = ''; process.stdin.on('data', (d) => { raw += d; }); process.stdin.on('end', () => { let j = null; try { j = JSON.parse(raw); } catch { j = null; } cb(j); }); }
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null; };

function medir(ruta) {
  const filas = fs.readFileSync(ruta, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const si = filas.filter((f) => !esAutomatico(f.t) && pideHasta(f.t).pide);
  console.log(`${filas.length} mensajes · ${si.length} piden trabajar hasta una hora`);
  if (process.argv.includes('--muestra')) for (const f of si) { const p = pideHasta(f.t); console.log(`- [${f.ses}] ${p.senales.join(',')} · ${leidas(p)} · ${normalizar(f.t).slice(0, 170)}`); }
}

const comoScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (comoScript) {
  const sesion = arg('--sesion') || sesionActual();
  if (process.argv.includes('--hook')) {
    leerStdin((j) => { const aviso = atender(j); if (aviso) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: aviso } })); });
  } else if (process.argv.includes('--stop')) {
    leerStdin((j) => { let r = { ok: true }; try { r = decidirStop(j || {}); } catch { r = { ok: true }; } if (!r.ok) { process.stderr.write(`${r.mensaje}\n`); process.exit(2); } });
  } else if (process.argv.includes('--fijar')) {
    const r = fijar({ sesion, hasta: arg('--fijar'), lista: arg('--lista'), pedido: arg('--pedido') });
    console.log(r.ok ? `Fijado: trabajar hasta las ${r.estado.hasta} (sesión ${String(sesion).slice(0, 8)}; lista: ${r.estado.lista || 'sin archivo'}; latido: ${r.estado.latido || 'falta: CronCreate y --latido <id>'})` : `✗ ${r.error}`);
    process.exit(r.ok ? 0 : 1);
  } else if (process.argv.includes('--latido')) {
    const r = registrarLatido({ sesion, id: arg('--latido') });
    console.log(r.ok ? `Latido ${r.estado.latido} registrado para trabajar hasta las ${r.estado.hasta}` : `✗ ${r.error}`);
    process.exit(r.ok ? 0 : 1);
  } else if (process.argv.includes('--terminar')) {
    const r = terminar({ sesion, porque: arg('--porque') });
    console.log(r.ok ? (r.nada ? 'No había ninguna hora fijada.' : `Terminado el pedido de trabajar hasta las ${r.estado.hasta}${r.vencio ? ' (ya había llegado la hora)' : ''}. Borrá el latido con CronDelete ${r.estado.latido || ''}.`) : `✗ ${r.error}`);
    process.exit(r.ok ? 0 : 1);
  } else if (process.argv.includes('--contexto-hook')) {
    // SessionStart: solo lo de ESA sesion (el session_id viene en el JSON de stdin); sin id, nada
    leerStdin((j) => { const id = j && typeof j.session_id === 'string' ? j.session_id : null; if (!id) return; const c = contexto({ sesion: id }); if (c) console.log(c); });
  } else if (process.argv.includes('--contexto')) {
    const c = contexto({}); if (c) console.log(c);
  } else if (process.argv.includes('--estado')) {
    const e = leerEstado(sesion); console.log(e ? JSON.stringify({ sesion, ...e }, null, 2) : 'No hay ninguna hora fijada para esta sesión.');
  } else if (process.argv.includes('--medir')) {
    medir(arg('--medir'));
  } else {
    console.log('uso: --hook | --stop | --fijar "AAAA-MM-DD HH:MM" --lista <archivo> [--pedido "..."] | --latido <id> | --terminar --porque "..." | --estado | --contexto | --medir <mensajes.jsonl> [--muestra]');
  }
}
