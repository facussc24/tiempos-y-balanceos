/**
 * probarMejora.mjs — la logica de `scripts/_probarMejora.mjs` (regla `.claude/rules/mejora-implementada.md`).
 *
 * Por que existe (02/10/2026): el hook `explicar-prompt` llevaba cinco horas dado de alta, con 41 tests en verde,
 * y el primer mensaje real de Fak que lo necesitaba no recibio nada. Dos causas, y ninguna la veia un test:
 *   - su frase ("hace que sea faicl de entender esta taare") caia en otra senal;
 *   - el mensaje llego con un aviso de la app ADELANTE ("<system-reminder>The user started your suggested
 *     background task…") y todo hook de mensajes lo tomaba por automatico.
 * Fak: "pensa como evitar que cuando te digo que implementes algo realmente lo implementes".
 *
 * Tres cosas mide:
 *   probarMensaje     un mensaje REAL por los hooks de `.claude/settings.json`, en las dos formas en que llega
 *                     (pelado y con el aviso de la app adelante), y despues el cierre del turno (cierre-guard)
 *                     sobre una respuesta comun, sin skill. Es el camino real: bash -> node, con el payload de Claude Code.
 *   sesionesAbiertas  que piezas se cambiaron, si ya estan en el checkout de donde corren los hooks, y si una
 *                     sesion abierta las toma sola o hay que reabrirla.
 *   llego             en los transcripts: cuantos mensajes de Fak DEBIAN recibir un aviso y a cuantos les llego.
 *
 * Medido el 02/10/2026 (queda escrito porque es lo que se le contesta a Fak):
 *   - un hook agregado a `.claude/settings.json` a las 14:54:59 corrio a las 14:55:07 en una sesion abierta hacia
 *     5 horas, y antes de las 14:55:36 en otras cuatro (una abierta el 01/10): las sesiones abiertas lo toman solas;
 *   - una sesion en un worktree corre los hooks del checkout PRINCIPAL (su log de instrucciones se escribe ahi):
 *     un cambio hecho en un worktree no existe para ninguna sesion hasta que llega a ese checkout;
 *   - el listado de skills de una sesion abierta el 01/10 sumo el skill nuevo 21 minutos despues de creado;
 *   - CLAUDE.md y las reglas se cargan al arrancar y al compactar (log de instrucciones: session_start 1.509,
 *     compact 636, path_glob_match 650).
 *
 * No borra nada: lo que necesita en el TEMP lo escribe siempre en la misma carpeta y lo pisa en la corrida siguiente.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { avisoDe } from './explicarGuard.mjs';
import { sinAvisosAdelante } from './correccionGuard.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(AQUI, '..', '..');
const CIERRE = JSON.parse(fs.readFileSync(path.join(AQUI, 'cierreCanon.data.json'), 'utf8'));
const SISTEMA = new RegExp(CIERRE.mejora.sistema_re, 'i');
export const DATOS = JSON.parse(fs.readFileSync(path.join(AQUI, 'mejorasEnPrueba.data.json'), 'utf8'));

/** El aviso que la app le pega adelante al mensaje cuando Fak lanza una tarea sugerida (forma real, 02/10/2026). */
export const AVISO_APP = '<system-reminder>\nThe user started your suggested background task task_00000000 ("tarea sugerida") in a separate local session. It is running independently. You will be notified here when it ends.\n</system-reminder>\n\n';
/** Una respuesta "normal": texto con una tabla, sin skill, sin dibujo, sin pagina y sin declarar cierre. */
export const RESPUESTA_COMUN = 'Es asi:\n\n| Parte | Como esta |\n|---|---|\n| Una | Bien |\n| Otra | Falta |\n\nEso es lo que hay hoy.';

const barras = (p) => String(p).replace(/\\/g, '/');
const nombreDe = (cmd) => cmd.match(/([\w.-]+\.(?:sh|mjs))/)?.[1] || cmd.slice(0, 40);

/** Los comandos de un evento en `.claude/settings.json` de `raiz`, en su orden. */
export function hooksDe(raiz, evento) {
  const s = JSON.parse(fs.readFileSync(path.join(raiz, '.claude', 'settings.json'), 'utf8'));
  return (s.hooks?.[evento] || []).flatMap((g) => (g.hooks || []).filter((h) => h.type === 'command').map((h) => h.command));
}

/** Corre UN comando de hook como lo corre Claude Code: por bash, con el payload por stdin. */
export function correrHook(cmd, payload, raiz, env = {}) {
  const r = spawnSync('bash', ['-c', cmd], {
    input: JSON.stringify(payload), encoding: 'utf8', cwd: raiz, timeout: 60000,
    env: { ...process.env, CLAUDE_PROJECT_DIR: barras(raiz), ...env },
  });
  let contexto = '';
  try { contexto = JSON.parse(r.stdout || '{}')?.hookSpecificOutput?.additionalContext || ''; } catch { contexto = String(r.stdout || '').trim(); }
  return { hook: nombreDe(cmd), status: r.status, contexto, stderr: String(r.stderr || '').trim() };
}

const linea1 = (t) => String(t || '').split('\n')[0].slice(0, 110);

/**
 * Un mensaje real por el camino real. Devuelve:
 *   mensajes  [{ hook, pelado, conAviso, distinto }]: lo que cada hook de mensajes le agrega al contexto
 *   cierre    [{ hook, frena, motivo }]: que hace el cierre-guard con una respuesta comun a ese mensaje
 *   fallas    lo que esta mal sin discusion: un hook que contesta distinto segun venga o no el aviso de la app
 *             adelante, uno que sale con error, o que ninguno devuelva lo que `espera`
 */
export function probarMensaje(mensaje, { raiz = REPO, espera = null, tmp = path.join(os.tmpdir(), 'claude-probar-mejora') } = {}) {
  fs.mkdirSync(tmp, { recursive: true });
  const sid = `prueba-mejora-${process.pid}-${Date.now()}`;
  const fallas = [];
  const base = { hook_event_name: 'UserPromptSubmit', cwd: barras(raiz), transcript_path: '' };
  const env = { CORRECCION_GUARD_DIR: tmp };                  // el estado del guardian de correcciones no se mezcla con el real
  const mensajes = hooksDe(raiz, 'UserPromptSubmit').map((cmd) => {
    const pelado = correrHook(cmd, { ...base, session_id: `${sid}-a`, prompt: mensaje }, raiz, env);
    const conAviso = correrHook(cmd, { ...base, session_id: `${sid}-b`, prompt: AVISO_APP + mensaje }, raiz, env);
    const distinto = pelado.contexto.trim() !== conAviso.contexto.trim();
    if (distinto) fallas.push(`${pelado.hook}: contesta distinto si el mensaje llega con un aviso de la app adelante (pelado: "${linea1(pelado.contexto) || 'nada'}" · con aviso: "${linea1(conAviso.contexto) || 'nada'}")`);
    for (const r of [pelado, conAviso]) if (r.status !== 0 || r.stderr) fallas.push(`${r.hook}: salio con ${r.status}${r.stderr ? ` y escribio por la salida de error: ${linea1(r.stderr)}` : ''}`);
    return { hook: pelado.hook, pelado: pelado.contexto, conAviso: conAviso.contexto, distinto };
  });
  if (espera && !mensajes.some((m) => m.pelado.includes(espera) && m.conAviso.includes(espera))) {
    fallas.push(`ningun hook devolvio "${espera}" para ese mensaje en las dos formas`);
  }

  const transcript = path.join(tmp, 'turno.jsonl');
  const ahora = Date.now();
  fs.writeFileSync(transcript, [
    { type: 'user', timestamp: new Date(ahora).toISOString(), origin: { kind: 'human' }, message: { role: 'user', content: [{ type: 'text', text: AVISO_APP }, { type: 'text', text: mensaje }] } },
    { type: 'assistant', timestamp: new Date(ahora + 1000).toISOString(), message: { content: [{ type: 'text', text: RESPUESTA_COMUN }] } },
  ].map((o) => JSON.stringify(o)).join('\n') + '\n');
  const cierre = hooksDe(raiz, 'Stop').filter((c) => /cierre-guard/.test(c)).map((cmd) => {
    const r = correrHook(cmd, { hook_event_name: 'Stop', session_id: sid, transcript_path: transcript, last_assistant_message: RESPUESTA_COMUN, stop_hook_active: false }, raiz);
    if (r.status !== 0 && r.status !== 2) fallas.push(`${r.hook}: salio con ${r.status}`);
    return { hook: r.hook, frena: r.status === 2, motivo: linea1(r.stderr) };
  });
  return { mensaje, mensajes, cierre, fallas };
}

// ---------------------------------------------------------------------------------------
// Sesiones abiertas: que se cambio, donde corre y quien lo toma solo
// ---------------------------------------------------------------------------------------

function git(raiz, args) {
  try { return execFileSync('git', args, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
}
const lineas = (t) => String(t || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

/** Piezas del sistema que cambian en `raiz`: sin commitear, sin trackear y lo que la rama tiene de mas contra
 *  origin/main; si no hay nada de eso, las del ultimo commit. */
export function piezasCambiadas(raiz = REPO) {
  let archivos = [
    ...lineas(git(raiz, ['diff', '--name-only', 'HEAD'])),
    ...lineas(git(raiz, ['ls-files', '--others', '--exclude-standard'])),
    ...lineas(git(raiz, ['diff', '--name-only', 'origin/main...HEAD'])),
  ];
  if (!archivos.length) archivos = lineas(git(raiz, ['show', '--name-only', '--format=', 'HEAD']));
  return [...new Set(archivos.map(barras))].filter((a) => SISTEMA.test(a)).sort();
}

/** El checkout de donde corren los hooks: el principal, aunque `raiz` sea un worktree. */
export function checkoutPrincipal(raiz = REPO) {
  const comun = git(raiz, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  return comun ? path.dirname(comun) : raiz;
}

const mismoArchivo = (a, b) => { try { return fs.readFileSync(a).equals(fs.readFileSync(b)); } catch { return false; } };

/** Como toma cada pieza una sesion que ya esta abierta. `tienePaths` = la regla declara `paths:`. */
export function claseDe(pieza, tienePaths = false) {
  if (/^\.claude\/hooks\/|^\.claude\/settings\.json$|^scripts\/_lib\//.test(pieza)) return 'sola';
  if (/^\.claude\/(skills|agents|commands)\//.test(pieza)) return 'al-cargar';
  if (/^\.claude\/rules\//.test(pieza) && tienePaths) return 'al-tocar';
  return 'al-arrancar';                                    // CLAUDE.md y las reglas sin `paths:`
}

const TEXTO_CLASE = {
  sola: 'hooks, guardianes y settings.json: una sesion abierta los toma sola, en segundos',
  'al-cargar': 'skills, agentes y comandos: el listado se actualiza solo en una sesion abierta y el texto se lee al cargarlo',
  'al-tocar': 'reglas con `paths:`: entran cuando la sesion toca un archivo de esas rutas; la que ya la cargo sigue con la version vieja hasta compactar',
  'al-arrancar': 'CLAUDE.md y reglas sin `paths:`: entran al arrancar la sesion y al compactar; una sesion abierta sigue con la version vieja',
};

/**
 * Lo que se le dice a Fak. Devuelve { piezas: [{ pieza, clase, enPrincipal }], principal, faltanEnPrincipal,
 * reabrir: [piezas que una sesion abierta no toma sola], texto: [renglones] }.
 */
export function sesionesAbiertas(raiz = REPO, piezas = piezasCambiadas(raiz), principal = checkoutPrincipal(raiz)) {
  const mismo = path.resolve(principal) === path.resolve(raiz);
  const detalle = piezas.map((pieza) => {
    let tienePaths = false;
    if (/^\.claude\/rules\//.test(pieza)) { try { tienePaths = /^---\r?\n[\s\S]*?^paths:/m.test(fs.readFileSync(path.join(raiz, pieza), 'utf8').slice(0, 2000)); } catch { /* borrada */ } }
    return { pieza, clase: claseDe(pieza, tienePaths), enPrincipal: mismo || mismoArchivo(path.join(raiz, pieza), path.join(principal, pieza)) };
  });
  const faltan = detalle.filter((d) => !d.enPrincipal).map((d) => d.pieza);
  const reabrir = detalle.filter((d) => d.clase === 'al-arrancar' || d.clase === 'al-tocar').map((d) => d.pieza);
  const texto = [];
  if (!piezas.length) texto.push('No hay piezas del sistema cambiadas (hooks, skills, reglas, guardianes): no hay nada que avisar.');
  for (const clase of Object.keys(TEXTO_CLASE)) {
    const de = detalle.filter((d) => d.clase === clase).map((d) => d.pieza);
    if (de.length) texto.push(`- ${TEXTO_CLASE[clase]} (${de.length}: ${de.slice(0, 3).join(', ')}${de.length > 3 ? ', …' : ''})`);
  }
  if (faltan.length) texto.push(`OJO: las sesiones corren lo que hay en ${principal}, y ${faltan.length} de ${piezas.length} pieza(s) todavia no estan ahi (${faltan.slice(0, 3).join(', ')}${faltan.length > 3 ? ', …' : ''}). Hasta que el cambio llegue a ese checkout no existe para ninguna sesion, abierta o nueva.`);
  if (piezas.length) {
    texto.push(reabrir.length
      ? `Para Fak: las sesiones abiertas hay que REABRIRLAS para que tomen ${reabrir.slice(0, 3).join(', ')}${reabrir.length > 3 ? ', …' : ''}; el resto lo toman solas.`
      : 'Para Fak: las sesiones abiertas lo toman solas, no hace falta reabrir nada.');
  }
  return { piezas: detalle, principal, faltanEnPrincipal: faltan, reabrir, texto };
}

// ---------------------------------------------------------------------------------------
// ¿Llego? Lo que debia recibir un aviso y lo que lo recibio, en los transcripts
// ---------------------------------------------------------------------------------------

/** Que mensaje DEBE recibir cada aviso, con la logica de hoy. Un aviso sin funcion aca no se puede medir. */
const DEBIA = { 'explicar-prompt': (t) => avisoDe(t) !== null };

const dirProyectos = () => path.join(os.homedir(), '.claude', 'projects');
const NO_ES_FAK = /^\s*(<task-notification|\[SYSTEM NOTIFICATION|Stop hook feedback|<command-|<local-command|\[Request interrupted|<cross-session-message|This session is being continued)/;

/** Los mensajes de Fak de UN transcript, con lo que le llego a cada uno: [{ ts, texto, conAviso, llego }]. */
export async function mensajesConAviso(archivo, { marca }) {
  const out = [];
  let pend = null;
  const rl = readline.createInterface({ input: fs.createReadStream(archivo, 'utf8'), crlfDelay: Infinity });
  for await (const l of rl) {
    if (!l.includes('"type":"user"') && !l.includes('"attachment"')) continue;
    let o; try { o = JSON.parse(l); } catch { continue; }
    if (o.isSidechain) continue;
    const a = o.attachment;
    if (o.type === 'attachment' && a?.type === 'hook_additional_context' && a.hookEvent === 'UserPromptSubmit') {
      const c = Array.isArray(a.content) ? a.content.join('\n') : String(a.content || '');
      if (pend && c.includes(marca)) pend.llego = true;
      continue;
    }
    let crudo = null;
    if (o.type === 'attachment' && a?.type === 'queued_command' && a.commandMode === 'prompt') crudo = String(a.prompt || '');
    else if (o.type === 'user' && !o.isMeta && !o.isCompactSummary && !(o.origin?.kind && o.origin.kind !== 'human')) {
      const c = o.message?.content;
      if (Array.isArray(c) && c.some((b) => b.type === 'tool_result')) continue;
      crudo = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b.type === 'text').map((b) => b.text || '').join('\n') : '';
    }
    if (crudo === null) continue;
    if (pend) { out.push(pend); pend = null; }
    const texto = sinAvisosAdelante(crudo).trim();
    if (!texto || NO_ES_FAK.test(texto)) continue;
    pend = { ts: o.timestamp || '', texto, conAviso: texto.length !== crudo.trim().length, llego: false };
  }
  if (pend) out.push(pend);
  return out;
}

/**
 * Para un aviso de `mejorasEnPrueba.data.json`: en los transcripts del proyecto modificados desde `desde`, cuantos
 * mensajes debian recibirlo y a cuantos les llego. "Debia" se calcula con la misma logica que usa el hook, sobre el
 * mismo texto (sin los avisos de adelante): si el hook corre, las dos cuentas dan igual.
 */
export async function llego(aviso, { proyectos = dirProyectos(), desde = aviso.desde, prefijo = DATOS.proyectos_prefijo } = {}) {
  const debia = DEBIA[aviso.id];
  if (!debia) return { id: aviso.id, medible: false, desde, sesiones: [], debia: 0, llego: 0, faltaron: [] };
  const corte = Date.parse(desde) || 0;
  const sesiones = [];
  let carpetas = [];
  try { carpetas = fs.readdirSync(proyectos).filter((d) => d.startsWith(prefijo)); } catch { /* sin transcripts */ }
  for (const d of carpetas) {
    let archivos = [];
    try { archivos = fs.readdirSync(path.join(proyectos, d)).filter((f) => f.endsWith('.jsonl')); } catch { continue; }
    for (const f of archivos) {
      const p = path.join(proyectos, d, f);
      try { if (fs.statSync(p).mtimeMs < corte) continue; } catch { continue; }
      let ms = [];
      try { ms = await mensajesConAviso(p, { marca: aviso.marca }); } catch { continue; }
      const deFak = ms.filter((m) => String(m.ts) >= desde && debia(m.texto));
      if (deFak.length) sesiones.push({ sesion: f.slice(0, 8), debia: deFak.length, llego: deFak.filter((m) => m.llego).length, faltaron: deFak.filter((m) => !m.llego) });
    }
  }
  const suma = (k) => sesiones.reduce((n, s) => n + s[k], 0);
  return { id: aviso.id, medible: true, desde, sesiones, debia: suma('debia'), llego: suma('llego'), faltaron: sesiones.flatMap((s) => s.faltaron.map((m) => ({ sesion: s.sesion, ...m }))) };
}

/**
 * El paso de `_cierreSesion.mjs`: cada aviso en prueba, medido. Un mensaje de los ultimos `DATOS.dias_falta` dias
 * que debia recibir el aviso y no lo recibio es una FALTA (el hook esta roto hoy); uno mas viejo queda como aviso,
 * para que un caso de hace un mes no deje el cierre en rojo para siempre. Nunca tira.
 */
export async function chequearAvisos({ ahora = Date.now(), ...opts } = {}) {
  try {
    const r = [];
    for (const aviso of DATOS.avisos) r.push(await llego(aviso, opts));
    const faltaron = r.flatMap((x) => x.faltaron);
    const resumen = r.map((x) => (x.medible ? `${x.id}: debia ${x.debia}, llego ${x.llego} (desde ${String(x.desde).slice(0, 10)})` : `${x.id}: sin medidor`)).join(' · ');
    if (faltaron.length) {
      const recientes = faltaron.filter((m) => ahora - (Date.parse(m.ts) || 0) < DATOS.dias_falta * 86400000);
      const ej = recientes[0] || faltaron[0];
      return {
        estado: recientes.length ? 'falta' : 'aviso',
        detalle: `${resumen}\n      no llego: [${ej.sesion} ${String(ej.ts).slice(5, 16)}] "${ej.texto.slice(0, 80)}"${ej.conAviso ? ' (venia con un aviso de la app adelante)' : ''}\n      detalle: node scripts/_probarMejora.mjs --llego`,
      };
    }
    if (r.some((x) => x.medible && x.debia === 0)) return { estado: 'aviso', detalle: `${resumen} — todavia no hubo un mensaje real de Fak que lo dispare: la mejora no se vio funcionar` };
    return { estado: 'ok', detalle: resumen };
  } catch (e) {
    return { estado: 'aviso', detalle: `no se pudo medir: ${String(e.message).split('\n')[0]}` };
  }
}
