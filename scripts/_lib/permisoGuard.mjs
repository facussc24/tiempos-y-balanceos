/**
 * permisoGuard.mjs — cuando Fak dejo a Claude trabajando solo HASTA UNA HORA y no esta en la ventana, un cartel de
 * permiso de la app no lo va a tocar nadie: se contesta solo con «no», y el pedido queda anotado para cuando vuelva.
 *
 * Por que existe (cola P41; el si de Fak es del 09/10/2026 16:55): el 04/10/2026 cuatro conversaciones estuvieron 55
 * minutos esperando un cartel de permiso («que no vuelva a pasar eso de perder 55 minutos»).
 *
 * Como corre: hook `permiso-guard.sh`, evento PermissionRequest de Claude Code (corre cuando la app esta por mostrar
 * un cartel de permiso; doc oficial https://code.claude.com/docs/en/hooks, leida el 10/10/2026 contra la 2.1.293).
 *   entrada (stdin): { session_id, transcript_path, permission_mode, hook_event_name, tool_name, tool_input, agent_id? }
 *   salida para negar (stdout): { hookSpecificOutput: { hookEventName: 'PermissionRequest',
 *                                  decision: { behavior: 'deny', message } } }
 *   sin salida: la app sigue como siempre (muestra el cartel). El codigo de salida 2 NO hace nada en este evento.
 *
 * Que decide:
 *   - sin una hora vigente para ESA sesion (horaGuard.vigente) ............ nada
 *   - la herramienta es una PREGUNTA a Fak (canon `no_decide`) ............ nada
 *   - Fak escribio en esa sesion hace menos de `presencia_minutos` ........ nada (esta: que vea el cartel)
 *   - si no ............ deny + un renglon en «Lo que necesita a Fak» de la lista de la tanda
 * NUNCA contesta allow: el lado seguro con Fak ausente es no habilitar nada.
 *
 * Si algo se rompe: antes de saber si hay una hora vigente, no decide (la app muestra el cartel como siempre);
 * despues de saberlo, niega igual con un motivo generico (no decidir ahi es dejar el cartel colgado, que es lo que
 * este control existe para evitar). Siempre sale con 0 y deja una linea en ~/.claude/.permiso-guard.log: un control
 * que falla sin avisar esta apagado. Cada corrida deja su linea ahi: asi se mide si el evento llega de verdad.
 *
 * Limites conocidos:
 *   - En modo «omitir permisos» la app casi no muestra carteles, asi que el evento casi no corre: esto sirve para las
 *     sesiones en modo normal, automatico o aceptar ediciones, y para las que no pueden mostrar un cartel.
 *   - El hook corre UNA vez, cuando aparece el cartel. Si Fak escribio hace menos de `presencia_minutos` y ya se fue,
 *     ese cartel espera como antes (lo ve `_colgados.mjs`).
 *   - El candado de la lista es entre corridas de este hook. Otra sesion que edita la lista con sus herramientas no
 *     lo mira: si las dos guardan en el mismo instante, gana la ultima. El renglon queda siempre en el registro.
 *   - Esta cableado en el settings de ESTE repo: una sesion abierta en otra carpeta no lo tiene.
 *
 *   node scripts/_lib/permisoGuard.mjs --hook       # stdin: JSON de PermissionRequest
 *   node scripts/_lib/permisoGuard.mjs --registro   # las ultimas lineas del registro
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vigente, colasDe, mensajeDeFakEn, enLocal, aFecha } from './horaGuard.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const CANON = JSON.parse(fs.readFileSync(path.join(AQUI, 'permisoCanon.data.json'), 'utf8'));
export const MARCA = CANON.marca;
const SECCION_RE = new RegExp(CANON.seccion_re, 'i');
const NO_DECIDE = new Set(CANON.no_decide.map((s) => String(s).toLowerCase()));
const TAPADO = '«tapado»';

export const rutaRegistro = (home = os.homedir()) => path.join(home, '.claude', '.permiso-guard.log');

/**
 * Una linea en el registro. No tira nunca: si no se puede escribir, no hay donde decirlo.
 * Columnas: hora · NIEGA|no_decide|ERROR · motivo · sesion (8) · modo · herramienta · resumen · lista
 */
export function registrar(campos, { home, ahora = new Date() } = {}) {
  try {
    const p = rutaRegistro(home);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const linea = [enLocal(ahora), ...campos.map((c) => String(c ?? '').replace(/[\t\r\n]+/g, ' ').slice(0, 400))].join('\t');
    fs.appendFileSync(p, `${linea}\n`, 'utf8');
    return true;
  } catch { return false; }
}

/** Cuantos permisos nego este hook a esa sesion en los ultimos minutos (del registro). Si no se puede leer, 0. */
export function negadasRecientes(sesion, { home, ahora = new Date(), minutos = CANON.ventana_repetidos_min } = {}) {
  try {
    const s8 = String(sesion || '').slice(0, 8);
    return fs.readFileSync(rutaRegistro(home), 'utf8').split('\n').slice(-400).filter((l) => {
      const c = l.split('\t');
      if (c[1] !== 'NIEGA' || c[3] !== s8) return false;
      const d = aFecha(c[0]);
      const hace = d ? ahora.getTime() - d.getTime() : NaN;
      return hace <= minutos * 60000 && hace >= -60000;
    }).length;
  } catch { return 0; }
}

// ---------------------------------------------------------------------------------------------
// 1. El resumen del pedido: una linea, corta y sin secretos (la lista vive en un repo publico)
// ---------------------------------------------------------------------------------------------

/** Cuanto del pedido se mira para armar el resumen. Las expresiones de abajo tardan al cuadrado con un tramo largo
 *  sin espacios (medido 10/10/2026: 100.000 caracteres, 5 s; 200.000, mas de 20 s y el hook se cortaba dejando el
 *  cartel colgado). Con 1.000 tardan menos de 1 ms, y el resumen final es de 200. */
export const TOPE_CRUDO = 1000;
/** Un nombre de archivo o un id largo (palabras cortas unidas por _ o -) no es una clave: no se tapa. */
const esNombre = (s) => { const p = s.split(/[_-]+/).filter(Boolean); return p.length >= 3 && p.every((x) => x.length <= 20); };

/** Tapa lo que tiene forma de clave. Es una red, no una garantia: por eso el resumen ademas se recorta, de un
 *  comando va solo el primer renglon, y lo que se anota son pedidos que NO corrieron. */
export function taparSecretos(texto) {
  return String(texto ?? '').slice(0, TOPE_CRUDO * 4)
    .replace(/\b(AIza[0-9A-Za-z_-]{35}|[rs]k_(?:live|test)_[A-Za-z0-9]{16,}|glpat-[A-Za-z0-9_-]{20,})/g, TAPADO)
    // «-u usuario:clave», «--user usuario:clave», «sshpass -p clave», «mysql -pclave», «net use … clave /user:»
    .replace(/((?:\s-u\s*|--user[\s=])[^\s:"']+:)[^\s"']+/g, `$1${TAPADO}`)
    .replace(/(\bsshpass\s+-p\s*)\S+/gi, `$1${TAPADO}`)
    .replace(/(\b(?:mysql|mysqldump|mariadb|plink|pscp)\b[^|;&\n]{0,200}?\s-(?:pw|p)\s?)([^\s-]\S*)/g, `$1${TAPADO}`)
    .replace(/(\bnet\s+use\s+\S+\s+\S+\s+)(?!\/)(\S+)/gi, `$1${TAPADO}`)
    .replace(/(ConvertTo-SecureString\s+(?:-String\s+)?)("[^"]*"|'[^']*'|\S+)/gi, `$1${TAPADO}`)
    .replace(/(\b(?:Authorization|X-Auth[\w-]*|X-Api-Key|Cookie)\s*:\s*)(?:(Token|Bearer|Basic)\s+)?[^\s"']+/gi, `$1${TAPADO}`)
    // usuario:clave@ en una direccion, y lo que viene despues del «?» (ahi viajan los tokens)
    .replace(/(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, `$1${TAPADO}@`)
    .replace(/(\bhttps?:\/\/[^\s?#"'`]+)\?[^\s"'`]*/gi, '$1?…')
    // claves con prefijo conocido
    .replace(/\b(sk-ant-[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|xox[abprs]-[A-Za-z0-9-]{10,})/g, TAPADO)
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(\.[A-Za-z0-9_-]+)?/g, TAPADO)
    // «Authorization: Bearer xxx», «Basic xxx»
    .replace(/\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, `$1 ${TAPADO}`)
    // VARIABLE_CON_KEY=valor, y «password: valor», «--token valor», «clave = "valor"»
    // (la palabra va al final del nombre o antes de un «_»: «--max-tokens=» y «PWD=» no son claves)
    .replace(/\b([A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PASS|CLAVE|CREDENTIALS|AUTH)(?:_[A-Za-z0-9_]*)?)(\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s"';&|]+)/gi, `$1$2${TAPADO}`)
    .replace(/(["']?\b(?:password|passwd|pass|pwd|clave|contrase[nñ]a|secret|secreto|client_secret|token|access_?token|refresh_?token|api[_-]?key|authorization)\b["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s"';&|,}]+)/gi, `$1${TAPADO}`)
    .replace(/(--?(?:password|passwd|pass|pwd|token|api[_-]?key|secret|clave)(?:\s+|=))("[^"]*"|'[^']*'|[^\s"';&|]+)/gi, `$1${TAPADO}`)
    // una tira larga sin espacios ni separadores de ruta: casi siempre una clave o un hash (un nombre de archivo no)
    .replace(/(?<![A-Za-z0-9+_=-])[A-Za-z0-9+_=-]{40,}(?![A-Za-z0-9+_=-])/g, (m) => (esNombre(m) ? m : TAPADO));
}

/** Lo que se pedia, en una linea: el comando, el archivo, la direccion o los campos del pedido. Nunca el contenido. */
export function resumenDe(payload = {}, tope = CANON.tope_resumen) {
  const t = payload && typeof payload.tool_input === 'object' && payload.tool_input ? payload.tool_input : {};
  const s = (v) => (typeof v === 'string' ? v : '');
  // de un comando va solo el primer renglon: lo que sigue suele ser el contenido de un archivo que se escribe (heredoc)
  const comando = s(t.command).replace(/^\s+/, '').split(/\r?\n/)[0];
  let crudo = (comando || s(t.file_path) || s(t.notebook_path) || s(t.url) || s(t.path) || s(t.pattern)).slice(0, TOPE_CRUDO);
  if (!crudo) {
    // una herramienta que no conozco (un MCP): los nombres de sus campos y los valores cortos de una palabra;
    // un texto libre (un mensaje, un prompt) no va a la lista
    crudo = Object.entries(t).slice(0, 6).map(([k, v]) => {
      if (v == null) return `${k}=`;
      if (typeof v === 'string') return /\s/.test(v.trim()) || v.length > 60 ? `${k}=(texto)` : `${k}=${v}`;
      if (typeof v === 'number' || typeof v === 'boolean') return `${k}=${v}`;
      return `${k}=(${Array.isArray(v) ? 'lista' : 'objeto'})`;
    }).join(' ');
  }
  const limpio = taparSecretos(crudo).replace(/[`\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return limpio.length > tope ? `${limpio.slice(0, tope)}…` : limpio;
}

// ---------------------------------------------------------------------------------------------
// 2. ¿Fak esta en la ventana?
// ---------------------------------------------------------------------------------------------

/**
 * La ultima señal de que Fak estuvo en ESA ventana: un mensaje que escribio (la regla de horaGuard: no un aviso, no
 * otra sesion, no una tarea programada), la respuesta a una pregunta (AskUserQuestion) o un corte suyo (Esc).
 * Auditor 10/10/2026: con solo el mensaje escrito, contestar una pregunta hacia 30 s daba «ausente»; en la sesion
 * 829f7135, 3 de sus 4 respuestas llegaron a 7, 9 y 77 minutos de su ultimo mensaje.
 * Lee SOLO el final del registro (el primer tramo, 8 MB): lo que este mas atras tiene mas de 3 minutos casi seguro,
 * y leer un registro de 294 MB entero costaba 2,7 s y 1,1 GB de memoria.
 * @returns {{ texto: string, ms: number, que: 'mensaje'|'respuesta'|'corte' } | null}
 */
export function ultimaSenalDeFak(transcriptPath) {
  for (const lineas of colasDe(transcriptPath)) {
    for (let k = lineas.length - 1; k >= 0; k--) {
      const l = lineas[k];
      if (!l) continue;
      const m = mensajeDeFakEn(l);
      if (m && Number.isFinite(m.ms)) return { ...m, que: 'mensaje' };
      const respuesta = l.includes('"toolUseResult":{"questions"') && l.includes('"answers"');
      const corte = l.includes('[Request interrupted by user');
      if (!respuesta && !corte) continue;
      let j = null; try { j = JSON.parse(l); } catch { continue; }
      if (j.type !== 'user' || j.isSidechain) continue;
      const ms = typeof j.timestamp === 'string' ? Date.parse(j.timestamp) : NaN;
      if (Number.isFinite(ms)) return { texto: respuesta ? '(contestó una pregunta)' : '(cortó el turno)', ms, que: respuesta ? 'respuesta' : 'corte' };
    }
    break;                                                    // solo el primer tramo
  }
  return null;
}

/**
 * Presente = su ultima señal en el registro de esa sesion (no un aviso, no otra sesion, no una tarea
 * programada: lo filtra horaGuard) tiene menos de `presencia_minutos`. Sin registro, sin mensaje suyo o si el
 * registro no se puede leer: ausente (no se sabe que este, y con una hora fijada lo esperable es que no).
 */
export function fakPresente(transcriptPath, { ahora = new Date(), minutos = CANON.presencia_minutos, leer = ultimaSenalDeFak } = {}) {
  if (!transcriptPath) return { presente: false, motivo: 'sin_registro' };
  let u = null;
  try { u = (leer || ultimaSenalDeFak)(transcriptPath); } catch { u = null; }
  if (!u || !u.texto || !Number.isFinite(u.ms)) return { presente: false, motivo: 'sin_mensaje_de_fak' };
  const hace = ahora.getTime() - u.ms;
  return hace >= 0 && hace < minutos * 60000 ? { presente: true, motivo: 'escribio_hace_poco', hace_ms: hace } : { presente: false, motivo: 'hace_rato', hace_ms: hace };
}

// ---------------------------------------------------------------------------------------------
// 3. El renglon en «Lo que necesita a Fak» de la lista
// ---------------------------------------------------------------------------------------------

/** Espera sin girar en vacio (el hook es un proceso corto y sincronico). */
const dormir = (ms) => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { /* sin espera */ } };
const CANDADO_VIEJO_MS = 10000;
/**
 * Candado entre dos corridas de ESTE hook sobre la misma lista (dos carteles a la vez, o un subagente y la sesion):
 * sin el, las dos leen, las dos escriben y un renglon se pierde. Si en 2 segundos no se consigue, se escribe igual:
 * peor es no anotar.
 */
function conCandado(lista, fn) {
  const candado = `${lista}.permiso.lock`;
  let fd = null;
  for (let i = 0; i < 40 && fd === null; i++) {
    try { fd = fs.openSync(candado, 'wx'); } catch {
      try { if (Math.abs(Date.now() - fs.statSync(candado).mtimeMs) > CANDADO_VIEJO_MS) fs.unlinkSync(candado); } catch { /* otro lo saco */ }
      dormir(50);
    }
  }
  try { return fn(); } finally {
    if (fd !== null) { try { fs.closeSync(fd); } catch { /* nada */ } try { fs.unlinkSync(candado); } catch { /* nada */ } }
  }
}

/**
 * Agrega `renglon` al final de la seccion «Lo que necesita a Fak» de `lista` (si no existe, la crea al final).
 * `clave` identifica el pedido (herramienta + resumen): si ya hay un renglon con esa clave, no se repite.
 * @returns {{ ok: boolean, como: 'agregado'|'ya_estaba'|'tope'|'sin_lista'|'error', error?: string }}
 */
export function anotarEnLista(lista, renglon, opciones = {}) {
  if (!lista || !fs.existsSync(lista)) return { ok: false, como: 'sin_lista' };
  return conCandado(lista, () => anotarSinCandado(lista, renglon, opciones));
}
function anotarSinCandado(lista, renglon, { clave = renglon, tope = CANON.tope_renglones } = {}) {
  let texto = '';
  try { texto = fs.readFileSync(lista, 'utf8'); } catch (e) { return { ok: false, como: 'sin_lista', error: String((e && e.code) || e) }; }
  const fin = texto.includes('\r\n') ? '\r\n' : '\n';
  const lineas = texto.split(/\r?\n/);
  const desde = lineas.findIndex((l) => SECCION_RE.test(l));
  let nuevas = null;
  if (desde < 0) {
    while (lineas.length && lineas[lineas.length - 1].trim() === '') lineas.pop();
    nuevas = [...(lineas.length ? [...lineas, ''] : []), CANON.seccion_titulo, '', renglon, ''];
  } else {
    let hasta = lineas.findIndex((l, i) => i > desde && /^##\s/.test(l));
    if (hasta < 0) hasta = lineas.length;
    const seccion = lineas.slice(desde + 1, hasta);
    // «ya estaba» vale solo contra un cartel ABIERTO: uno tachado o con [x] ya se atendio, y el mismo pedido de nuevo
    // es un pendiente nuevo (auditor 10/10/2026: decia «quedo anotado» y el unico renglon era el viejo, cerrado)
    const carteles = seccion.filter((l) => /^\s*[-*]\s+\*\*Cartel negado /.test(l));
    if (carteles.some((l) => l.includes(clave))) return { ok: true, como: 'ya_estaba' };
    if (carteles.length >= tope) return { ok: false, como: 'tope' };
    let ultimo = hasta - 1;
    while (ultimo > desde && lineas[ultimo].trim() === '') ultimo--;
    nuevas = [...lineas.slice(0, ultimo + 1), ...(ultimo === desde ? [''] : []), renglon, ...lineas.slice(ultimo + 1)];
    if (hasta === lineas.length && nuevas[nuevas.length - 1].trim() !== '') nuevas.push('');
  }
  const salida = nuevas.join(fin);
  const tmp = `${lista}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.permiso.tmp`;
  try {
    fs.writeFileSync(tmp, salida, 'utf8');                      // si esto falla (disco lleno) la lista no se toca
    try { fs.renameSync(tmp, lista); } catch (e) {
      try { fs.unlinkSync(tmp); } catch { /* nada */ }
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(e && e.code)) throw e;
      fs.writeFileSync(lista, salida, 'utf8');                  // el archivo abierto en otro programa no deja renombrar
    }
    return { ok: true, como: 'agregado' };
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch { /* nada */ }
    return { ok: false, como: 'error', error: String((e && e.message) || e) };
  }
}

/** El renglon y su clave. La clave no lleva la hora: el mismo pedido repetido no suma renglones. */
export function renglonDe(payload, { ahora = new Date() } = {}) {
  // el nombre de la herramienta y la sesion van fuera del code span: solo letras, numeros, _ y - (nada de Markdown)
  const herramienta = String(payload.tool_name || '').replace(/[^A-Za-z0-9_.-]+/g, '').slice(0, 80);
  const resumen = resumenDe(payload);
  const clave = `· ${herramienta}: \`${resumen}\``;
  const dia = `${String(ahora.getDate()).padStart(2, '0')}/${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  const sesion = String(payload.session_id || '').replace(/[^A-Za-z0-9_-]+/g, '').slice(0, 8);
  return { herramienta, resumen, clave, renglon: `- **Cartel negado ${dia} ${enLocal(ahora).slice(11)}** ${clave} · sesión ${sesion}${payload.agent_id ? ', un subagente' : ''}; no había nadie en la ventana` };
}

// ---------------------------------------------------------------------------------------------
// 4. La decision
// ---------------------------------------------------------------------------------------------

/** Lo que NO se hace con un permiso negado: el «no» es de Fak ausente, no un obstaculo a rodear. */
export const NO_ESQUIVAR = 'No reintentes lo mismo, no lo consigas con otra herramienta ni con otro comando que haga lo mismo, y no toques la configuración de permisos: eso espera a Fak. Pasá a lo que sigue en la lista que no necesite ese permiso.';
const salidaDeny = (mensaje) => ({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'deny', message: mensaje } } });
const esPregunta = (nombre) => NO_DECIDE.has(String(nombre || '').trim().toLowerCase());

/**
 * @returns {{ niega: boolean, motivo: string, salida?: object, anotado?: object, herramienta?: string, resumen?: string, van?: number }}
 *   niega=false: el hook no emite nada y la app sigue como siempre.
 */
export function decidir(payload, deps = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { niega: false, motivo: 'json_roto' };
  if (payload.hook_event_name && payload.hook_event_name !== 'PermissionRequest') return { niega: false, motivo: 'otro_evento' };
  if (typeof payload.tool_name !== 'string' || !payload.tool_name.trim()) return { niega: false, motivo: 'sin_herramienta' };
  const ahora = deps.ahora || new Date();
  const e = vigente(payload.session_id, { ahora, home: deps.home });
  if (!e) return { niega: false, motivo: 'sin_hora' };
  const { herramienta, resumen, clave, renglon } = renglonDe(payload, { ahora });
  if (esPregunta(payload.tool_name)) return { niega: false, motivo: 'es_una_pregunta', herramienta, resumen };
  const pres = fakPresente(payload.transcript_path, { ahora, leer: deps.ultimoDeFak });
  if (pres.presente) return { niega: false, motivo: 'fak_presente', herramienta, resumen };
  const anotado = anotarEnLista(e.lista, renglon, { clave });
  const donde = anotado.ok
    ? `Quedó anotado en «Lo que necesita a Fak» de ${e.lista}.`
    : `No lo pude anotar en la lista (${anotado.como === 'sin_lista' ? 'la hora fijada no tiene un archivo de lista' : anotado.como === 'tope' ? 'ya hay muchos carteles negados anotados' : 'no se pudo escribir'}): anotalo vos en «Lo que necesita a Fak», con la herramienta y lo que pedía.`;
  const van = negadasRecientes(payload.session_id, { home: deps.home, ahora }) + 1;
  const repetido = van >= CANON.aviso_repetidos ? ` Ya van ${van} permisos negados en ${CANON.ventana_repetidos_min} minutos en esta sesión: dejá de intentar cosas que piden permiso y pasá a un trabajo que no lo necesite.` : '';
  const mensaje = `${MARCA} No hay nadie en la ventana: Fak pidió trabajar hasta las ${e.hasta} y este permiso (${herramienta}) no lo va a aprobar nadie ahora, así que se contesta «no» en vez de quedar esperando. ${donde} ${NO_ESQUIVAR}${repetido}`;
  return { niega: true, motivo: 'nadie_en_la_ventana', anotado, herramienta, resumen, van, salida: salidaDeny(mensaje) };
}

/** Corre el hook sobre el texto crudo de stdin. Devuelve lo que hay que imprimir ('' = nada). No tira nunca. */
export function correr(crudo, deps = {}) {
  let j = null;
  try { j = JSON.parse(crudo); } catch { j = null; }
  const obj = j && typeof j === 'object' && !Array.isArray(j) ? j : null;
  const sesion = obj ? String(obj.session_id || '').slice(0, 8) : '';
  try {
    const ahora = deps.ahora || new Date();
    const r = decidir(j, { ...deps, ahora });
    registrar([r.niega ? 'NIEGA' : 'no_decide', r.motivo, sesion, obj ? obj.permission_mode : '', r.herramienta || (obj && obj.tool_name) || '', r.resumen || '', r.anotado ? `lista:${r.anotado.como}` : ''], { home: deps.home, ahora });
    return r.niega ? JSON.stringify(r.salida) : '';
  } catch (e) {
    // Se rompio. Si para ESA sesion hay una hora vigente y no es una pregunta, no decidir es dejar el cartel colgado:
    // se niega igual, con un motivo generico. Si no se puede saber si hay hora, no se decide.
    let hora = null;
    try { hora = obj && typeof obj.tool_name === 'string' && obj.tool_name.trim() && !esPregunta(obj.tool_name) ? vigente(obj.session_id, { home: deps.home }) : null; } catch { hora = null; }
    registrar(['ERROR', hora ? 'se_rompio_niega_igual' : 'se_rompio', sesion, '', (obj && obj.tool_name) || '', String((e && e.stack) || e)], { home: deps.home });
    if (!hora) return '';
    return JSON.stringify(salidaDeny(`${MARCA} No hay nadie en la ventana: Fak pidió trabajar hasta las ${hora.hasta} y este permiso no lo va a aprobar nadie ahora. El control falló al anotarlo: anotalo vos en «Lo que necesita a Fak» de la lista, con la herramienta y lo que pedía. ${NO_ESQUIVAR}`));
  }
}

// ---------------------------------------------------------------------------------------------
// Linea de comandos
// ---------------------------------------------------------------------------------------------

// realpath de los dos lados: con el repo detras de un enlace (junction, subst) la comparacion por texto daba falso y
// el hook salia sin decidir y sin dejar linea
const real = (p) => { try { return fs.realpathSync.native(p); } catch { return path.resolve(p); } };
const comoScript = process.argv[1] && real(process.argv[1]).toLowerCase() === real(fileURLToPath(import.meta.url)).toLowerCase();
if (comoScript) {
  if (process.argv.includes('--hook')) {
    let raw = '';
    process.stdin.setEncoding('utf8');                         // un caracter partido entre dos tramos no se rompe
    process.stdin.on('data', (d) => { raw += d; });
    process.stdin.on('end', () => { const out = correr(raw); if (out) process.stdout.write(out); process.exitCode = 0; });
    process.stdin.on('error', () => { registrar(['ERROR', 'sin_stdin', '', '', '', '']); process.exitCode = 0; });
  } else if (process.argv.includes('--registro')) {
    try { console.log(fs.readFileSync(rutaRegistro(), 'utf8').trimEnd().split('\n').slice(-40).join('\n')); } catch { console.log('El registro está vacío: el hook todavía no corrió en esta PC.'); }
  } else {
    console.log('uso: --hook (stdin: JSON de PermissionRequest) | --registro');
  }
}
