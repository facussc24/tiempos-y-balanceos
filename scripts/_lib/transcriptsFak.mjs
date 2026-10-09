/**
 * transcriptsFak.mjs — lector en STREAMING de los transcripts de Claude Code de este repo.
 *
 * QUE SACA. De los archivos .jsonl de `~/.claude/projects/` que empiezan con `C--Dev-BarackMercosul` (la
 * carpeta del repo y las de sus worktrees; hoy son ~3,4 GB solo en la principal) devuelve dos cosas:
 *   1. los MENSAJES REALES DE FAK: `{ fecha, sesion, texto, cargas, skillsAntes }`. `cargas` son los
 *      skills que se cargaron en el turno que ese mensaje abrio; `skillsAntes`, los que ya se habian
 *      cargado antes en la misma sesion (un skill ya cargado no se vuelve a cargar: sin eso, un
 *      mensaje que calza con un skill ya cargado pasaria por "debia cargarse y no se cargo").
 *   2. las CARGAS DE SKILLS: `{ fecha, sesion, skill, mensajeAnterior, mismoTurno, siguientes }`. Un
 *      `tool_use` con `name: "Skill"` y su `input.skill`. `mensajeAnterior` es el ultimo mensaje real de
 *      Fak antes de la carga; `mismoTurno` dice si la carga llego en el turno que ese mensaje abrio (si
 *      entre medio entro un aviso de tarea o de un hook, la carga NO la disparo ese mensaje);
 *      `siguientes`, los 3 mensajes reales de Fak que vinieron despues.
 *
 * QUE ES "UN MENSAJE REAL DE FAK". Se usa `origin.kind` cuando el transcript lo trae (`human` si; `peer`,
 * `task-notification` no) y, si falta (los transcripts viejos), las mismas reglas de `esFakReal` de
 * scripts/_tokens.mjs mas la lista UNICA `no_es_de_fak` de correccionCanon.data.json (no hay otra copia
 * de esa lista: si el archivo no se puede leer, esto TIRA, no sigue con una lista inventada). Los avisos
 * `<system-reminder>` se sacan del texto. Quedan afuera las lineas de subagentes (`isSidechain`) y las
 * carpetas `<uuid>/` de cada sesion (en ellas el primer "user" es un encargo, no Fak).
 *
 * VOLUMEN. Se descartan los archivos por `mtime` antes de abrirlos, y cada linea se prefiltra por texto
 * antes del JSON.parse (las lineas de resultados de herramientas son enormes y no sirven). El prefiltro
 * es solo un filtro: lo que cuenta se decide despues de parsear (el `prompt_snapshot` trae el texto
 * `"name":"Skill"` en la lista de herramientas y NO es una carga).
 *
 * Solo LEE. No escribe nada, no abre red, no toca Supabase.
 *
 * Uso:
 *   import { leerTranscripts } from './transcriptsFak.mjs';
 *   const { mensajes, cargas } = await leerTranscripts({ desde: new Date('2026-09-08'), tope: 5000 });
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ_REPO = path.resolve(AQUI, '..', '..');

/** Donde Claude Code guarda los transcripts. */
export const BASE_TRANSCRIPTS = path.join(os.homedir(), '.claude', 'projects');
/** La lista UNICA de "esto no lo escribio Fak". */
export const RUTA_CANON_CORRECCION = path.join(AQUI, 'correccionCanon.data.json');

export const DIAS_POR_DEFECTO = 90;
export const SIGUIENTES_POR_CARGA = 3;

/** 'C:\Dev\BarackMercosul' -> 'C--Dev-BarackMercosul' (asi nombra Claude Code la carpeta de un proyecto). */
export const slugDeRepo = (repo = RAIZ_REPO) => String(repo).replace(/[:\\/]/g, '-');

/**
 * Mensajes que la APP escribe como si fueran de Fak (botones y avisos que entran como turno de usuario con
 * `origin.kind: human`), medidos el 08/10/2026 sobre 1.969 mensajes de 90 dias: "Intentar nuevamente" (el
 * boton de reintentar, 38 veces), "Alcancé mi límite de uso mientras trabajabas..." (13), "The app was quit
 * while you were working..." y el prompt de una tarea programada. No son palabras de Fak y sin sacarlos
 * ensucian la prueba de disparo (un reintento puede caer justo antes de una carga). Candidatos a pasar a la
 * lista `no_es_de_fak` del canon: se suman ACA, sin tocar el canon, hasta que la sesion principal decida.
 */
export const AUTOMATICOS_DE_LA_APP = Object.freeze([
  'Intentar nuevamente', 'Alcancé mi límite de uso', 'Alcance mi limite de uso', 'The app was quit while you were working', '<scheduled-task',
]);

/**
 * Los prefijos de `no_es_de_fak` del canon (la lista UNICA) mas los avisos de la app de arriba. Tira si el
 * canon no se puede leer o viene vacio (no hay lista de repuesto).
 */
export function cargarNoEsDeFak(ruta = RUTA_CANON_CORRECCION) {
  let j;
  try { j = JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch (e) {
    throw new Error(`no puedo leer la lista no_es_de_fak (${ruta}): ${e?.message ?? e}. No sigo con una lista propia.`);
  }
  if (!Array.isArray(j?.no_es_de_fak) || !j.no_es_de_fak.length) throw new Error(`${ruta} no trae la lista no_es_de_fak: no sigo con una lista propia.`);
  return [...j.no_es_de_fak.map(String), ...AUTOMATICOS_DE_LA_APP];
}

/** Las carpetas de transcripts del repo: la principal y las de sus worktrees (`<slug>--claude-worktrees-*`). */
export function carpetasDelRepo({ base = BASE_TRANSCRIPTS, repo = RAIZ_REPO } = {}) {
  const slug = slugDeRepo(repo);
  let nombres = [];
  try { nombres = fs.readdirSync(base); } catch { return []; }
  return nombres
    .filter((n) => n === slug || n.startsWith(`${slug}--claude-worktrees-`))
    .map((n) => path.join(base, n))
    .filter((p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } });
}

/** Los `*.jsonl` del PRIMER nivel de cada carpeta con `mtime >= desde` (las subcarpetas son de subagentes). */
export function listarJsonl(carpetas, { desde = null } = {}) {
  const corte = desde ? new Date(desde).getTime() : 0;
  const out = [];
  for (const carpeta of Array.isArray(carpetas) ? carpetas : [carpetas]) {
    let entradas = [];
    try { entradas = fs.readdirSync(carpeta, { withFileTypes: true }); } catch { continue; }
    for (const e of entradas) {
      if (!e.isFile() || !e.name.endsWith('.jsonl')) continue;
      const ruta = path.join(carpeta, e.name);
      let st;
      try { st = fs.statSync(ruta); } catch { continue; }
      if (st.mtimeMs < corte) continue;
      out.push({ ruta, carpeta, nombre: e.name, mtimeMs: st.mtimeMs, bytes: st.size });
    }
  }
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// Texto de un mensaje (puro)
// ─────────────────────────────────────────────────────────────────────────────

const RE_AVISO = /<system-reminder>[\s\S]*?<\/system-reminder>/g;

/** El texto de un mensaje con los avisos de la app (`<system-reminder>`) sacados. */
export const quitarAvisos = (t) => String(t ?? '').replace(RE_AVISO, ' ').replace(/[ \t]+\n/g, '\n').trim();

/** ¿El texto arranca con alguno de los prefijos (sin mayusculas ni espacios adelante)? */
export const empiezaConAlguno = (texto, prefijos) => {
  const t = texto.trimStart().toLowerCase();
  return prefijos.some((p) => t.startsWith(String(p).toLowerCase()));
};

/** Los bloques de texto de un `message.content` (string o lista), sin los que arrancan como un aviso automatico. */
export function textoDeFak(msg, noEsDeFak) {
  const c = msg?.content;
  const bloques = typeof c === 'string' ? [c]
    : Array.isArray(c) ? c.filter((b) => b && b.type === 'text').map((b) => String(b.text ?? '')) : [];
  const buenos = [];
  for (const b of bloques) {
    const limpio = quitarAvisos(b);
    if (!limpio || empiezaConAlguno(limpio, noEsDeFak)) continue;
    buenos.push(limpio);
  }
  return buenos.join('\n').trim();
}

/** ¿Es un resultado de herramienta (turno de usuario que no es un mensaje)? */
export const esResultadoDeHerramienta = (obj) => Array.isArray(obj?.message?.content) && obj.message.content.some((b) => b && b.type === 'tool_result');

/**
 * ¿Es de Fak? Con `origin.kind` se decide por ahi (solo `human`); sin el, por las reglas de esFakReal
 * (ni meta ni resumen de compactado) mas la lista `no_es_de_fak`. Devuelve el texto o '' si no es de Fak.
 */
export function mensajeDeFak(obj, noEsDeFak) {
  if (!obj || obj.type !== 'user' || obj.isSidechain) return '';
  if (obj.isMeta || obj.isCompactSummary) return '';
  const kind = obj.origin?.kind;
  if (kind !== undefined && kind !== null && kind !== 'human') return '';
  return textoDeFak(obj.message, noEsDeFak);
}

// ─────────────────────────────────────────────────────────────────────────────
// La maquina de estados de UNA sesion (pura: se prueba sin disco)
// ─────────────────────────────────────────────────────────────────────────────

export function nuevaSesion(id) {
  return { id, ultimo: null, actual: null, skillsAntes: new Set(), pendientes: [] };
}

/** Los `tool_use` de nombre Skill de una linea de asistente: [{ id, skill }]. */
export function cargasDeSkill(obj) {
  if (!obj || obj.type !== 'assistant' || obj.isSidechain) return [];
  const bloques = Array.isArray(obj.message?.content) ? obj.message.content : [];
  return bloques
    .filter((b) => b && b.type === 'tool_use' && b.name === 'Skill' && typeof b.input?.skill === 'string' && b.input.skill.trim())
    .map((b) => ({ id: b.id ?? null, skill: b.input.skill.trim().toLowerCase().replace(/^\//, '') }));
}

/** Lo que sale despues del ultimo `:` ('anthropic-skills:xlsx' -> 'xlsx'). */
export const nombreCorto = (skill) => String(skill).split(':').pop();

/**
 * Procesa un objeto ya parseado. Muta `est`. Devuelve { mensaje, cargas } con lo nuevo (o null / []).
 * `vistos` (opcional) es un Set de ids para no contar dos veces lo que un archivo o un resume repite.
 */
export function procesarObjeto(est, obj, { noEsDeFak, siguientes = SIGUIENTES_POR_CARGA, vistos = null } = {}) {
  const salida = { mensaje: null, cargas: [] };
  if (!obj || typeof obj !== 'object' || obj.isSidechain) return salida;
  const fecha = typeof obj.timestamp === 'string' ? obj.timestamp : null;

  if (obj.type === 'user') {
    if (esResultadoDeHerramienta(obj)) return salida;
    const texto = mensajeDeFak(obj, noEsDeFak);
    if (texto) {
      const clave = obj.uuid ? `m:${obj.uuid}` : null;
      if (clave && vistos) { if (vistos.has(clave)) return salida; vistos.add(clave); }
      const mensaje = { fecha, sesion: est.id, texto, cargas: [], skillsAntes: [...est.skillsAntes] };
      est.ultimo = mensaje;
      est.actual = mensaje;
      for (const c of est.pendientes) if (c.siguientes.length < siguientes) c.siguientes.push(texto);
      est.pendientes = est.pendientes.filter((c) => c.siguientes.length < siguientes);
      salida.mensaje = mensaje;
      return salida;
    }
    // otro turno de usuario con texto (aviso de tarea, de hook, resumen de compactado, otra sesion): el
    // turno ya no es el de un mensaje de Fak, y una carga que venga ahora no la disparo el.
    const crudo = typeof obj.message?.content === 'string' ? obj.message.content : JSON.stringify(obj.message?.content ?? '');
    if (quitarAvisos(crudo) || obj.isMeta || obj.isCompactSummary) est.actual = null;
    return salida;
  }

  if (obj.type === 'assistant') {
    for (const c of cargasDeSkill(obj)) {
      const clave = c.id ? `c:${c.id}` : null;
      if (clave && vistos) { if (vistos.has(clave)) continue; vistos.add(clave); }
      const carga = {
        fecha, sesion: est.id, skill: c.skill, nombre: nombreCorto(c.skill),
        mensajeAnterior: est.ultimo ? est.ultimo.texto : null,
        fechaMensajeAnterior: est.ultimo ? est.ultimo.fecha : null,
        mismoTurno: !!(est.actual && est.actual === est.ultimo),
        siguientes: [],
      };
      if (est.actual) est.actual.cargas.push(c.skill);
      est.skillsAntes.add(c.skill);
      est.pendientes.push(carga);
      salida.cargas.push(carga);
    }
  }
  return salida;
}

const MARCA_USUARIO = Buffer.from('"type":"user"');
const MARCA_RESULTADO = Buffer.from('"tool_use_id"');
const MARCA_SKILL = Buffer.from('"name":"Skill","input"');

/** ¿Vale la pena parsear esta linea (string o Buffer)? Solo un prefiltro; la decision real va despues del JSON.parse. */
export function lineaInteresa(linea) {
  if (typeof linea === 'string') {
    if (linea.includes('"name":"Skill","input"')) return true;
    return linea.includes('"type":"user"') && !linea.includes('"tool_use_id"');
  }
  if (linea.includes(MARCA_SKILL)) return true;
  return linea.includes(MARCA_USUARIO) && !linea.includes(MARCA_RESULTADO);
}

/**
 * Recorre un archivo por bloques de bytes (no por readline: con lineas de megas era ~20 veces mas lento,
 * 4 MB/s contra 120-160 MB/s medidos el 08/10/2026) y entrega SOLO las lineas que pasan el prefiltro,
 * ya decodificadas. Parte por el byte 0x0A, que nunca cae adentro de un caracter UTF-8 de varios bytes.
 * `cuenta.lineas` queda con el total de lineas vistas.
 */
export async function* lineasInteresantes(ruta, cuenta = { lineas: 0 }) {
  let resto = null;
  for await (const bloque of fs.createReadStream(ruta, { highWaterMark: 4 << 20 })) {
    const buf = resto && resto.length ? Buffer.concat([resto, bloque]) : bloque;
    let ini = 0;
    let fin = buf.indexOf(10, ini);
    while (fin !== -1) {
      const linea = buf.subarray(ini, fin);
      cuenta.lineas++;
      if (lineaInteresa(linea)) yield linea.toString('utf8');
      ini = fin + 1;
      fin = buf.indexOf(10, ini);
    }
    resto = ini < buf.length ? Buffer.from(buf.subarray(ini)) : null;
  }
  if (resto && resto.length) {
    cuenta.lineas++;
    if (lineaInteresa(resto)) yield resto.toString('utf8');
  }
}

const enRango = (fecha, desdeMs, hastaMs) => {
  if (!fecha) return true;
  const t = Date.parse(fecha);
  if (!Number.isFinite(t)) return true;
  return (desdeMs == null || t >= desdeMs) && (hastaMs == null || t <= hastaMs);
};

/** Lee UN archivo en streaming. Devuelve { mensajes, cargas, lineas }. */
export async function leerArchivo(ruta, { noEsDeFak, desde = null, hasta = null, siguientes = SIGUIENTES_POR_CARGA, vistos = null, sesion = null } = {}) {
  const est = nuevaSesion(sesion || path.basename(ruta, '.jsonl'));
  let idFijado = !!sesion;
  const mensajes = [];
  const cargas = [];
  const cuenta = { lineas: 0 };
  const desdeMs = desde == null ? null : new Date(desde).getTime();
  const hastaMs = hasta == null ? null : new Date(hasta).getTime();
  for await (const linea of lineasInteresantes(ruta, cuenta)) {
    let obj;
    try { obj = JSON.parse(linea); } catch { continue; }
    if (!idFijado && typeof obj.sessionId === 'string') { est.id = obj.sessionId; idFijado = true; }
    const r = procesarObjeto(est, obj, { noEsDeFak, siguientes, vistos });
    if (r.mensaje && enRango(r.mensaje.fecha, desdeMs, hastaMs)) mensajes.push(r.mensaje);
    for (const c of r.cargas) if (enRango(c.fecha, desdeMs, hastaMs)) cargas.push(c);
  }
  return { mensajes, cargas, lineas: cuenta.lineas };
}

/**
 * Lee todo lo que haya desde `desde` (por defecto 90 dias antes de `ahora`), de lo mas nuevo a lo mas
 * viejo, hasta `tope` mensajes. Devuelve { mensajes, cargas, archivos, bytes, lineas, truncado, desde }
 * con mensajes y cargas ordenados por fecha ascendente.
 */
export async function leerTranscripts({
  carpetas, base = BASE_TRANSCRIPTS, repo = RAIZ_REPO, desde, hasta = null, ahora = new Date(),
  tope = 5000, siguientes = SIGUIENTES_POR_CARGA, noEsDeFak, onArchivo = null,
} = {}) {
  const lista = noEsDeFak ?? cargarNoEsDeFak();
  const desdeFecha = desde ? new Date(desde) : new Date(new Date(ahora).getTime() - DIAS_POR_DEFECTO * 86400e3);
  const dirs = carpetas ?? carpetasDelRepo({ base, repo });
  const archivos = listarJsonl(dirs, { desde: desdeFecha });
  const vistos = new Set();
  const mensajes = [];
  const cargas = [];
  let bytes = 0;
  let lineas = 0;
  let leidos = 0;
  let truncado = false;
  for (const a of archivos) {
    if (mensajes.length >= tope) { truncado = true; break; }
    const r = await leerArchivo(a.ruta, { noEsDeFak: lista, desde: desdeFecha, hasta, siguientes, vistos });
    mensajes.push(...r.mensajes);
    cargas.push(...r.cargas);
    bytes += a.bytes;
    lineas += r.lineas;
    leidos++;
    if (onArchivo) onArchivo({ archivo: a.nombre, bytes: a.bytes, mensajes: r.mensajes.length, cargas: r.cargas.length });
  }
  const porFecha = (x, y) => String(x.fecha ?? '').localeCompare(String(y.fecha ?? ''));
  mensajes.sort(porFecha);
  cargas.sort(porFecha);
  return { mensajes, cargas, archivos: leidos, archivosEncontrados: archivos.length, bytes, lineas, truncado, desde: desdeFecha.toISOString() };
}
