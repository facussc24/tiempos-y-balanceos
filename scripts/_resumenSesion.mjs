/**
 * _resumenSesion.mjs — una página Markdown con la línea de tiempo de UNA sesión de Claude Code para Fak:
 * qué pidió, qué archivos se tocaron (Edit, Write, MultiEdit, NotebookEdit), qué skills se cargaron y qué
 * commits salieron ese día según `git log`. Mecánico, local, sin API y sin red: lee el .jsonl del
 * transcript con el lector de `_lib/transcriptsFak.mjs` y corre `git log` en el repo. Fila HOY-18d.
 *
 * La idea (índice con los pedidos y los commits) es de simonw/claude-code-transcripts (Apache-2.0). Su
 * opción de subir la página a GitHub NO se toma: la página queda en `.sgc-cache/`, que no se versiona.
 *
 * EL CONTROL de la fila: todos los archivos de los commits del día tienen que estar entre los que la
 * sesión tocó. Con `--cotejar` el proceso sale con código 2 si no se cumple.
 *
 * Uso:
 *   node scripts/_resumenSesion.mjs                        # la sesión con más pedidos de Fak de HOY
 *   node scripts/_resumenSesion.mjs --fecha 2026-10-09     # ídem para ese día (hora de la PC)
 *   node scripts/_resumenSesion.mjs --sesion 3f2a          # por prefijo del id (busca en lo tocado desde --fecha)
 *   node scripts/_resumenSesion.mjs --archivo <ruta.jsonl> # un transcript puntual
 *   --salida <ruta.md>   dónde escribir (por defecto .sgc-cache/resumen-sesion/<día>_<id8>.md)
 *   --cotejar            código de salida 2 si algún commit del día tiene archivos que la sesión no tocó
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  RAIZ_REPO, cargarNoEsDeFak, carpetasDelRepo, listarJsonl, lineasInteresantes, lineaInteresa,
  nuevaSesion, procesarObjeto,
} from './_lib/transcriptsFak.mjs';

/** Herramientas que tocan un archivo y la clave de `input` donde viene la ruta. */
export const HERRAMIENTAS_ARCHIVO = Object.freeze({
  Edit: 'file_path', Write: 'file_path', MultiEdit: 'file_path', NotebookEdit: 'notebook_path',
});
export const LARGO_PEDIDO = 160;
export const CARPETA_SALIDA = path.join(RAIZ_REPO, '.sgc-cache', 'resumen-sesion');
const SEP = '\x1f'; // separador del formato de git log: no aparece en un asunto de commit

// ── Prefiltro y eventos (puros) ──────────────────────────────────────────────

const MARCA_ASISTENTE = Buffer.from('"type":"assistant"');
const MARCA_TOOL_USE = Buffer.from('"type":"tool_use"');

/**
 * Suma a `lineaInteresa` las líneas de asistente con algún `tool_use`: ahí están Edit, Write y Bash. Es
 * solo un prefiltro; lo que cuenta se decide después del JSON.parse en `eventosDeHerramienta`.
 */
export function lineaInteresaResumen(linea) {
  if (lineaInteresa(linea)) return true;
  if (typeof linea === 'string') return linea.includes('"type":"assistant"') && linea.includes('"type":"tool_use"');
  return linea.includes(MARCA_ASISTENTE) && linea.includes(MARCA_TOOL_USE);
}

/** Los eventos de una línea de asistente: archivos tocados y `git commit` corridos por Bash. */
export function eventosDeHerramienta(obj) {
  if (!obj || obj.type !== 'assistant' || obj.isSidechain) return [];
  const bloques = Array.isArray(obj.message?.content) ? obj.message.content : [];
  const fecha = typeof obj.timestamp === 'string' ? obj.timestamp : null;
  const out = [];
  for (const b of bloques) {
    if (!b || b.type !== 'tool_use' || typeof b.name !== 'string') continue;
    const clave = HERRAMIENTAS_ARCHIVO[b.name];
    const ruta = clave ? b.input?.[clave] : null;
    if (typeof ruta === 'string' && ruta.trim()) {
      out.push({ fecha, tipo: 'archivo', herramienta: b.name, ruta: ruta.trim(), id: b.id ?? null });
    } else if (b.name === 'Bash' && typeof b.input?.command === 'string' && /\bgit\s+commit\b/.test(b.input.command)) {
      // solo la primera línea: el mensaje suele venir en un heredoc largo y eso ya lo da git log
      out.push({ fecha, tipo: 'git', comando: b.input.command.split('\n')[0].slice(0, 120), id: b.id ?? null });
    }
  }
  return out;
}

/**
 * Lee UN transcript en una sola pasada. Pedidos y cargas salen de `procesarObjeto` (el mismo lector que
 * transcriptsFak); los eventos de herramienta, de `eventosDeHerramienta`. `vistos` evita contar dos veces lo
 * que un resume repite. Devuelve { sesion, ruta, cwd, mensajes, cargas, eventos, lineas }.
 */
export async function leerSesion(ruta, { noEsDeFak, vistos = new Set() } = {}) {
  const est = nuevaSesion(path.basename(ruta, '.jsonl'));
  let idFijado = false;
  let cwd = null;
  const mensajes = [];
  const cargas = [];
  const eventos = [];
  const cuenta = { lineas: 0 };
  for await (const linea of lineasInteresantes(ruta, cuenta, lineaInteresaResumen)) {
    let obj;
    try { obj = JSON.parse(linea); } catch { continue; }
    if (!idFijado && typeof obj.sessionId === 'string') { est.id = obj.sessionId; idFijado = true; }
    if (!cwd && typeof obj.cwd === 'string' && obj.cwd) cwd = obj.cwd; // base de las rutas absolutas (vale en worktrees)
    const r = procesarObjeto(est, obj, { noEsDeFak, vistos });
    if (r.mensaje) mensajes.push(r.mensaje);
    cargas.push(...r.cargas);
    for (const ev of eventosDeHerramienta(obj)) {
      const clave = ev.id ? `t:${ev.id}` : null;
      if (clave) { if (vistos.has(clave)) continue; vistos.add(clave); }
      eventos.push(ev);
    }
  }
  return { sesion: est.id, ruta, cwd, mensajes, cargas, eventos, lineas: cuenta.lineas };
}

// ── Fechas (hora de la PC salvo que se pase `tz`; los tests pasan 'UTC') ─────

/** 'YYYY-MM-DD': 'en-CA' escribe así la fecha, el formato de la cola y de git. */
export const diaLocal = (iso, tz) => {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t) : null;
};
/** 'HH:mm' en 24 h: 'en-GB' lo escribe así sin ambigüedad; los dígitos no tienen idioma. */
export const horaLocal = (iso, tz) => {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(t) : '--:--';
};

// ── git log del día ──────────────────────────────────────────────────────────

const validarDia = (dia) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dia))) throw new Error(`fecha inválida: ${dia} (esperaba YYYY-MM-DD)`);
  return String(dia);
};

/** Las 0:00 de ese día en hora de la PC: corte de mtime para no abrir transcripts viejos. */
export function inicioDelDia(dia) {
  const [y, m, d] = validarDia(dia).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** `--all` porque los commits de un worktree pueden estar en una rama todavía no mezclada. */
export function argumentosGitLog(dia) {
  const d = validarDia(dia);
  // sin zona horaria: git toma la hora de la PC, la misma con la que se eligió el día
  return ['log', '--all', `--since=${d} 00:00:00`, `--until=${d} 23:59:59`, `--format=%h${SEP}%aI${SEP}%s`, '--name-only', '--no-color'];
}

/** Parsea `git log --format=%h␟%aI␟%s --name-only` a [{ hash, fecha, asunto, archivos }] por fecha ascendente. */
export function parsearGitLog(texto) {
  const commits = [];
  let actual = null;
  for (const cruda of String(texto ?? '').split(/\r?\n/)) {
    const l = cruda.trim();
    if (!l) continue;
    if (l.includes(SEP)) {
      const [hash, fecha, ...asunto] = l.split(SEP);
      actual = { hash, fecha, asunto: asunto.join(SEP), archivos: [] };
      commits.push(actual);
    } else if (actual) actual.archivos.push(l);
  }
  return commits.sort((a, b) => (Date.parse(a.fecha) || 0) - (Date.parse(b.fecha) || 0));
}

export const ejecutarGit = (args, cwd = RAIZ_REPO) => execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
export const commitsDelDia = (dia, { ejecutar = ejecutarGit } = {}) => parsearGitLog(ejecutar(argumentosGitLog(dia)));

// ── Rutas y cotejo (puros) ───────────────────────────────────────────────────

/** Ruta relativa a `base` con barras '/', como la escribe git; si está afuera de `base` queda como vino. */
export function relativaA(ruta, base) {
  const r = String(ruta ?? '').replace(/\\/g, '/');
  const b = String(base ?? '').replace(/\\/g, '/').replace(/\/+$/, '');
  return b && r.toLowerCase().startsWith(`${b.toLowerCase()}/`) ? r.slice(b.length + 1) : r;
}

/** Agrupa los eventos 'archivo' por ruta relativa: [{ ruta, veces, primera, ultima, herramientas }]. */
export function resumirArchivos(eventos, base) {
  const porRuta = new Map();
  for (const e of eventos) {
    if (e.tipo !== 'archivo') continue;
    const ruta = relativaA(e.ruta, base);
    const k = ruta.toLowerCase(); // Windows no distingue mayúsculas en nombres de archivo
    const r = porRuta.get(k) ?? { ruta, veces: 0, primera: e.fecha, ultima: e.fecha, herramientas: new Set() };
    r.veces++;
    r.herramientas.add(e.herramienta);
    if (e.fecha && (!r.primera || e.fecha < r.primera)) r.primera = e.fecha;
    if (e.fecha && (!r.ultima || e.fecha > r.ultima)) r.ultima = e.fecha;
    porRuta.set(k, r);
  }
  return [...porRuta.values()].map((r) => ({ ...r, herramientas: [...r.herramientas] })).sort((a, b) => a.ruta.localeCompare(b.ruta));
}

/**
 * EL CONTROL de la fila: cada commit del día tiene todos sus archivos entre los que la sesión tocó. Devuelve
 * { ok, commits: [{ ...commit, faltan }], soloEnSesion }. `soloEnSesion` (tocado sin commit) informa, no falla.
 */
export function cotejarConGit(archivosSesion, commits) {
  const enSesion = new Set(archivosSesion.map((a) => a.toLowerCase()));
  const enGit = new Set();
  const conFaltantes = commits.map((c) => {
    for (const a of c.archivos) enGit.add(a.toLowerCase());
    return { ...c, faltan: c.archivos.filter((a) => !enSesion.has(a.toLowerCase())) };
  });
  return {
    ok: conFaltantes.every((c) => c.faltan.length === 0),
    commits: conFaltantes,
    soloEnSesion: archivosSesion.filter((a) => !enGit.has(a.toLowerCase())),
  };
}

// ── La página ────────────────────────────────────────────────────────────────

const celda = (t) => String(t ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
const recortar = (t, n = LARGO_PEDIDO) => { const c = celda(t); return c.length > n ? `${c.slice(0, n - 1)}…` : c; };
const porFecha = (a, b) => (Date.parse(a.fecha) || 0) - (Date.parse(b.fecha) || 0);

/** Arma el Markdown. Todo sale de los datos: no hay relato, es una tabla por orden de hora. */
export function armarPagina({ sesion, ruta, cwd, dia, mensajes, cargas, eventos, commits, tz }) {
  const base = cwd || RAIZ_REPO;
  const archivos = resumirArchivos(eventos, base);
  const cotejo = cotejarConGit(archivos.map((a) => a.ruta), commits);
  const filas = [
    ...mensajes.map((m) => ({ fecha: m.fecha, que: 'Fak pidió', detalle: recortar(m.texto) })),
    ...cargas.map((c) => ({ fecha: c.fecha, que: 'Cargó skill', detalle: c.nombre })),
    ...eventos.map((e) => (e.tipo === 'archivo'
      ? { fecha: e.fecha, que: e.herramienta, detalle: `\`${relativaA(e.ruta, base)}\`` }
      : { fecha: e.fecha, que: 'Corrió', detalle: `\`${celda(e.comando)}\`` })),
    ...cotejo.commits.map((c) => ({
      fecha: c.fecha, que: 'Commit',
      detalle: `${c.hash} ${celda(c.asunto)}${c.faltan.length ? ` ⚠ archivos que esta sesión no tocó: ${c.faltan.join(', ')}` : ''}`,
    })),
  ].sort(porFecha);
  const h = (iso) => horaLocal(iso, tz);
  const L = [`# Sesión \`${sesion}\` · ${dia}`, ''];
  L.push(`- Transcript: \`${ruta}\``, `- Carpeta de trabajo: \`${base}\``);
  L.push(`- ${mensajes.length} pedidos de Fak · ${archivos.length} archivos tocados · ${commits.length} commits del día en git`, '');
  L.push('## Línea de tiempo', '', '| Hora | Qué | Detalle |', '|---|---|---|');
  for (const f of filas) L.push(`| ${h(f.fecha)} | ${f.que} | ${f.detalle} |`);
  if (!filas.length) L.push('| | | (sin mensajes de Fak ni archivos tocados) |');
  L.push('', '## Archivos tocados', '', '| Archivo | Veces | Con | Primera | Última |', '|---|---|---|---|---|');
  for (const a of archivos) L.push(`| \`${a.ruta}\` | ${a.veces} | ${a.herramientas.join(', ')} | ${h(a.primera)} | ${h(a.ultima)} |`);
  if (!archivos.length) L.push('| (ninguno) | | | | |');
  L.push('', `## Commits del día (git log, ${dia})`, '', '| Hora | Commit | Asunto | Archivos |', '|---|---|---|---|');
  for (const c of cotejo.commits) L.push(`| ${h(c.fecha)} | ${c.hash} | ${celda(c.asunto)} | ${c.archivos.map((a) => `\`${a}\``).join(', ')} |`);
  if (!commits.length) L.push('| (ninguno) | | | |');
  L.push('', '## Cotejo con git', '');
  const malos = cotejo.commits.filter((c) => c.faltan.length);
  if (!commits.length) L.push('– Sin commits del día en git: nada que cotejar.');
  else if (cotejo.ok) L.push(`✔ Los ${commits.length} commit(s) del día tienen todos sus archivos entre los tocados por la sesión.`);
  else L.push(`✘ ${malos.length} commit(s) con archivos que esta sesión no tocó (¿otra sesión, o un cambio a mano?): ${malos.map((c) => c.hash).join(', ')}.`);
  if (cotejo.soloEnSesion.length) L.push('', `Tocados sin commit del día: ${cotejo.soloEnSesion.map((a) => `\`${a}\``).join(', ')}.`);
  L.push('');
  return { pagina: L.join('\n'), cotejo, archivos, filas };
}

/** De una sesión leída a la página: el día es el pedido o el del último dato con fecha; pide los commits. */
export function resumirSesion(leida, { dia = null, ejecutar = ejecutarGit, tz } = {}) {
  const ultimo = leida.mensajes.at(-1) ?? leida.eventos.at(-1) ?? null;
  const diaFinal = dia ?? (ultimo ? diaLocal(ultimo.fecha, tz) : null);
  if (!diaFinal) throw new Error(`la sesión ${leida.sesion} no tiene fechas: no sé de qué día pedir el git log`);
  const commits = commitsDelDia(diaFinal, { ejecutar });
  return { dia: diaFinal, ...armarPagina({ ...leida, dia: diaFinal, commits, tz }) };
}

/** La sesión pedida por prefijo de id o, si no, la que más pedidos de Fak tiene en `dia`. */
export function elegirSesion(sesiones, { sesion = null, dia = null, tz } = {}) {
  if (sesion) return sesiones.find((s) => String(s.sesion).startsWith(sesion)) ?? null;
  if (!dia) return sesiones[0] ?? null;
  const conDia = sesiones
    .map((s) => ({ s, n: s.mensajes.filter((m) => diaLocal(m.fecha, tz) === dia).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  return conDia[0]?.s ?? null;
}

export function parsearArgs(argv) {
  const a = { fecha: null, sesion: null, archivo: null, salida: null, cotejar: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--cotejar') a.cotejar = true;
    else if (['--fecha', '--sesion', '--archivo', '--salida'].includes(k)) { a[k.slice(2)] = argv[++i] ?? null; }
    else throw new Error(`argumento desconocido: ${k}`);
  }
  return a;
}

/** Devuelve el código de salida. Todo lo que toca disco o git entra inyectable para probarlo sin git real. */
export async function main(argv = process.argv.slice(2), { ejecutar = ejecutarGit, hoy = new Date(), tz, consola = console, noEsDeFak = null } = {}) {
  const args = parsearArgs(argv);
  const diaPedido = args.fecha ?? (args.archivo ? null : diaLocal(hoy.toISOString(), tz));
  const lista = noEsDeFak ?? cargarNoEsDeFak();
  const vistos = new Set();
  const rutas = args.archivo
    ? [path.resolve(args.archivo)]
    : listarJsonl(carpetasDelRepo(), { desde: inicioDelDia(diaPedido) }).map((a) => a.ruta);
  const sesiones = [];
  for (const r of rutas) sesiones.push(await leerSesion(r, { noEsDeFak: lista, vistos }));
  const elegida = elegirSesion(sesiones, { sesion: args.sesion, dia: args.archivo ? null : diaPedido, tz });
  if (!elegida) {
    consola.error(`No encontré una sesión${args.sesion ? ` que empiece con ${args.sesion}` : ''} con pedidos de Fak el ${diaPedido} (${sesiones.length} transcripts mirados).`);
    return 1;
  }
  const r = resumirSesion(elegida, { dia: diaPedido, ejecutar, tz });
  const salida = args.salida ? path.resolve(args.salida) : path.join(CARPETA_SALIDA, `${r.dia}_${String(elegida.sesion).slice(0, 8)}.md`);
  fs.mkdirSync(path.dirname(salida), { recursive: true });
  fs.writeFileSync(salida, r.pagina, 'utf8');
  consola.log(`Página: ${salida}`);
  consola.log(`${elegida.mensajes.length} pedidos · ${r.archivos.length} archivos · ${r.cotejo.commits.length} commits · cotejo ${r.cotejo.ok ? 'OK' : 'FALLA'}`);
  if (sesiones.length > 1) consola.log(`Otras sesiones vistas: ${sesiones.filter((s) => s !== elegida).map((s) => String(s.sesion).slice(0, 8)).join(', ')}`);
  return args.cotejar && !r.cotejo.ok ? 2 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((c) => { process.exitCode = c; }, (e) => { console.error(e?.message ?? e); process.exitCode = 1; });
}
