/**
 * _hijaEstado.mjs — dice como ARRANCO una sesion hija (una sesion lanzada desde otra sesion) leyendo los
 * registros, no lo que la hija cuenta de si misma (regla coordinador.md, G6).
 *
 * Por que existe (10/10/2026): dos sesiones lanzadas sin Fak quedaron paradas esperando un clic (la prueba
 * del 09/10 06:39 y la hija de la madrugada del 10/10 a la 01:33: arranco en modo plan y llamo a
 * ExitPlanMode, que espero el clic 3 horas). Nadie lo vio hasta que Fak la abrio. Este control lo ve en los
 * registros en segundos. El 10/10 11:26 cazo a la primera hija del orquestador arrancando en `default`.
 *
 * Que mira:
 *   · el registro de la app (%APPDATA%\Claude\claude-code-sessions\<cuenta>\<org>\<local_id>.json): modelo,
 *     modo de permisos actual, tarea que la lanzo, id de la conversacion (cliSessionId);
 *   · la conversacion (~/.claude/projects/<proyecto>/<cliSessionId>.jsonl): en que modo llego el PRIMER mensaje
 *     (es el modo con el que arranco: un cambio posterior desde afuera no lo cambia), si entro en modo plan
 *     (EnterPlanMode / ExitPlanMode), cuantos turnos lleva, cuando escribio por ultima vez, y si hay una
 *     herramienta sin resultado (una llamada sin tool_result = casi siempre un cartel de permiso, igual que en
 *     _colgados.mjs, pero sin esperar los 10 minutos).
 *
 * Uso:
 *   node scripts/_hijaEstado.mjs <local_id | cliSessionId> [--espera-modo bypassPermissions] [--espera-modelo <id>]
 *                                [--espera-min 2] [--raiz-app <dir>] [--raiz-proyectos <dir>] [--json]
 * Sale con 0 si arranco bien, 1 si hay algo para MIRAR (no esperar), 2 ante un argumento que no conoce.
 * Logica pura exportada (estadoHija) para el test __tests__/scripts/hijaEstado.test.mjs.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const RAIZ_APP = () => path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Claude', 'claude-code-sessions');
export const RAIZ_PROYECTOS = () => path.join(os.homedir(), '.claude', 'projects');

/** Busca un archivo por nombre exacto hasta `prof` niveles abajo de `raiz` (sin seguir mas de lo necesario). */
export function buscarArchivo(raiz, nombre, prof = 3) {
  const pila = [[raiz, 0]];
  while (pila.length) {
    const [dir, d] = pila.pop();
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isFile() && e.name === nombre) return p;
      if (e.isDirectory() && d < prof) pila.push([p, d + 1]);
    }
  }
  return null;
}

/** El registro que la app guarda por sesion (solo los campos que importan aca). */
export function leerRegistroApp(id, raizApp) {
  const f = buscarArchivo(raizApp, `${id}.json`, 3);
  if (!f) return null;
  let d;
  try { d = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
  return {
    archivo: f, cliSessionId: d.cliSessionId ?? null, model: d.model ?? null, permissionMode: d.permissionMode ?? null,
    scheduledTaskId: d.scheduledTaskId ?? null, title: d.title ?? '', lastActivityAt: d.lastActivityAt ?? null, createdAt: d.createdAt ?? null,
  };
}

const textoDe = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b?.type === 'text').map((b) => b.text).join(' ') : '');

/** La conversacion de Claude Code: modo del primer mensaje, modo plan, turnos, pendientes. */
export function leerTranscript(cliSessionId, raizProyectos) {
  const f = buscarArchivo(raizProyectos, `${cliSessionId}.jsonl`, 2);
  if (!f) return null;
  // modoActual: el permissionMode del ULTIMO mensaje user que lo trae (el modo con el que corre HOY; el del
  // primer mensaje dice como arranco). La hija de la madrugada arranco en plan y a las 01:55 Fak la paso a
  // bypass: juzgar sus herramientas pendientes con el modo del primer mensaje la mandaba frenar (auditor 10/10).
  const r = { archivo: f, modoPrimerMensaje: null, modoActual: null, primerMensaje: '', turnosAsistente: 0, mensajesUser: 0, enterPlan: 0, exitPlan: 0, ultimoTs: null, pendientes: [] };
  const usos = new Map();
  const resueltos = new Set();
  for (const linea of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!linea.trim()) continue;
    let d;
    try { d = JSON.parse(linea); } catch { continue; }
    const ts = d.timestamp ? Date.parse(d.timestamp) : null;
    if (ts && !Number.isNaN(ts)) r.ultimoTs = ts;
    const c = d.message?.content;
    if (d.type === 'user') {
      if (typeof d.permissionMode === 'string') r.modoActual = d.permissionMode;
      const esMensaje = typeof c === 'string' || (Array.isArray(c) && c.some((b) => b?.type === 'text'));
      if (esMensaje) {
        r.mensajesUser++;
        if (r.modoPrimerMensaje === null) {
          r.modoPrimerMensaje = d.permissionMode ?? '(sin dato)';
          r.primerMensaje = textoDe(c).replace(/\s+/g, ' ').slice(0, 160);
        }
      }
      if (Array.isArray(c)) for (const b of c) if (b?.type === 'tool_result' && b.tool_use_id) resueltos.add(b.tool_use_id);
    } else if (d.type === 'assistant') {
      r.turnosAsistente++;
      if (Array.isArray(c)) {
        for (const b of c) {
          if (b?.type !== 'tool_use') continue;
          usos.set(b.id, { name: b.name, ts });
          if (b.name === 'EnterPlanMode') r.enterPlan++;
          if (b.name === 'ExitPlanMode') r.exitPlan++;
        }
      }
    }
  }
  for (const [id, u] of usos) if (!resueltos.has(id)) r.pendientes.push({ id, ...u });
  return r;
}

/**
 * El veredicto. `ojos` vacio = arranco bien. Cada OJO dice que mirar, con el dato al lado.
 * `esperaMin`: una herramienta sin resultado hace mas de esos minutos se marca (2 por defecto: un cartel de
 * permiso se ve enseguida; los 10 de _colgados.mjs son para una sesion que trabaja).
 */
export function estadoHija({ id, raizApp = RAIZ_APP(), raizProyectos = RAIZ_PROYECTOS(), esperaModo = 'bypassPermissions', esperaModelo = null, ahoraMs = Date.now(), esperaMin = 2 } = {}) {
  const ojos = [];
  const datos = [];
  const esLocal = /^local_/.test(String(id));
  const app = esLocal ? leerRegistroApp(id, raizApp) : null;
  if (esLocal && !app) ojos.push(`no encuentro el registro de la app para ${id}: todavía no arrancó, o el id está mal`);
  const cli = app?.cliSessionId ?? (esLocal ? null : id);
  if (app) datos.push(`título: ${app.title || '(sin título)'} · modelo (app): ${app.model} · modo (app): ${app.permissionMode} · tarea que la lanzó: ${app.scheduledTaskId ?? 'ninguna'}`);
  const t = cli ? leerTranscript(cli, raizProyectos) : null;
  if (!t) {
    if (cli) ojos.push(`no encuentro la conversación ${cli}.jsonl: todavía no escribió nada (volver a mirar en un minuto)`);
  } else {
    const hace = t.ultimoTs ? Math.round((ahoraMs - t.ultimoTs) / 60000) : null;
    const modoHoy = app?.permissionMode ?? t.modoActual ?? t.modoPrimerMensaje;
    datos.push(`primer mensaje en modo: ${t.modoPrimerMensaje} · modo de hoy: ${modoHoy} · mensajes del asistente: ${t.turnosAsistente} · última escritura: ${hace === null ? '?' : `hace ${hace} min`}`);
    datos.push(`primer mensaje: «${t.primerMensaje}»`);
    if (t.modoPrimerMensaje !== esperaModo) ojos.push(`arrancó en «${t.modoPrimerMensaje}», no en «${esperaModo}»: va a pedir carteles (el modo sale del guardado en la tarea o, si no hay, del settings; NO de la sesión que la lanza, y cambiarlo desde afuera muestra un cartel)`);
    if (t.enterPlan || t.exitPlan) ojos.push(`entró en modo plan (${t.enterPlan} EnterPlanMode, ${t.exitPlan} ExitPlanMode): salir del plan pide un clic de Fak (el encargo va con --lanzada)`);
    // Una herramienta sin resultado: en un modo que pide permiso (default, plan, acceptEdits) es casi siempre
    // un cartel. En bypass no hay carteles para Bash/Edit/Write: una Bash larga (los tests del cierre tardan
    // 17-30 min en esta PC) es trabajo, y solo ExitPlanMode / AskUserQuestion esperan un clic. En bypass se
    // avisa recien a los 15 min, como _colgados.mjs (10) con margen. Se juzga con el modo de HOY, no con el
    // del primer mensaje (la madrugada: plan al arrancar, bypass desde la 01:55).
    const enBypass = modoHoy === 'bypassPermissions';
    const PIDEN_CLIC = new Set(['ExitPlanMode', 'EnterPlanMode', 'AskUserQuestion']);
    for (const p of t.pendientes) {
      const min = p.ts ? (ahoraMs - p.ts) / 60000 : null;
      if (min === null) continue;
      if (PIDEN_CLIC.has(p.name) || !enBypass) {
        if (min >= esperaMin) ojos.push(`herramienta ${p.name} sin resultado hace ${Math.round(min)} min en modo ${modoHoy}: casi seguro espera un cartel; abrir el registro antes de frenarla (stop_session solo si Fak no está y de verdad espera un clic)`);
      } else if (min >= 15) {
        ojos.push(`herramienta ${p.name} sin resultado hace ${Math.round(min)} min en bypass: o es un comando largo (tests) o se colgó; mirar el registro (_colgados.mjs)`);
      } else {
        datos.push(`herramienta ${p.name} en curso hace ${Math.round(min)} min (bypass: trabajo, no cartel)`);
      }
    }
    if (!t.pendientes.length && hace !== null && hace >= 5) datos.push(`quieta hace ${hace} min sin herramienta pendiente: terminó su turno o espera un mensaje (list_events para leer su último renglón)`);
    if (esperaModelo && app && app.model !== esperaModelo) ojos.push(`modelo ${app.model}, no ${esperaModelo} (set_session_model aplica desde el segundo turno de la hija)`);
  }
  return { ok: ojos.length === 0, ojos, datos, app, transcript: t };
}

function main() {
  const CON_VALOR = ['--espera-modo', '--espera-modelo', '--espera-min', '--raiz-app', '--raiz-proyectos'];
  const args = process.argv.slice(2);
  const op = {};
  let id = null;
  for (let i = 0; i < args.length; i++) {
    if (CON_VALOR.includes(args[i]) && i + 1 < args.length) { op[args[i]] = args[++i]; continue; }
    if (args[i] === '--json') { op.json = true; continue; }
    if (!args[i].startsWith('--') && !id) { id = args[i]; continue; }
    console.log(`no conozco el argumento ${args[i]}. No hago nada.\nuso: node scripts/_hijaEstado.mjs <local_id | cliSessionId> [--espera-modo bypassPermissions] [--espera-modelo <id>] [--espera-min 2] [--json]`);
    process.exit(2);
  }
  if (!id) { console.log('falta el id de la sesión hija (local_... de run_scheduled_task / list_sessions, o el id de la conversación).'); process.exit(2); }
  const r = estadoHija({
    id, esperaModo: op['--espera-modo'] || 'bypassPermissions', esperaModelo: op['--espera-modelo'] || null,
    esperaMin: /^\d+$/.test(op['--espera-min'] ?? '') ? Number(op['--espera-min']) : 2,
    raizApp: op['--raiz-app'] || RAIZ_APP(), raizProyectos: op['--raiz-proyectos'] || RAIZ_PROYECTOS(),
  });
  if (op.json) { console.log(JSON.stringify({ ok: r.ok, ojos: r.ojos, datos: r.datos, app: r.app, transcript: r.transcript && { ...r.transcript, pendientes: r.transcript.pendientes } }, null, 2)); process.exit(r.ok ? 0 : 1); }
  console.log(`[HIJA ${String(id).slice(0, 14)}] ${r.ok ? 'ARRANCÓ BIEN' : `${r.ojos.length} para MIRAR`}`);
  for (const d of r.datos) console.log(`  ${d}`);
  for (const o of r.ojos) console.log(`  OJO: ${o}`);
  process.exit(r.ok ? 0 : 1);
}

if (process.argv[1] && /_hijaEstado\.mjs$/.test(process.argv[1])) main();
