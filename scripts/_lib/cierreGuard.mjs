/**
 * cierreGuard.mjs — gate de cierre de turno (hook Stop) + gate por bullet de LECCIONES.
 *
 * Nace el 04/09/2026 de medir dos semanas de chats (21/08 → 04/09): 375 turnos terminados en
 * texto, 32 con pedido de permiso para hacer mi propio trabajo y 20 de esos con Fak
 * contestando "hacelo" de alguna forma ("estas esperando que te diga ok nada mas", "no
 * arrancaste ni siquiera?"). Ademas 17 pedidos de "pasame la ruta" y un Stop hook viejo
 * (session-close-guard.sh) que devolvia exit 2 en 115 cierres, uno por turno con git sucio.
 * El 10/09/2026 (Ola A) suma dos chequeos, salidos de las 29 sesiones del 02 al 10/09: ~42
 * correcciones de Fak por afirmar o entregar sin abrir el resultado, ~17 por informe largo.
 *
 * Cinco cosas mide, en este orden, sobre el ULTIMO mensaje del asistente:
 *   1. la COLA (ultimos 500 caracteres) pide permiso  → exit 2 siempre
 *   2. en este turno escribi/copie algo afuera del repo y el texto no dice la RUTA → exit 2
 *   3. el texto DECLARA cierre ("listo", "pusheado") y hay pendientes medibles → exit 2,
 *      una vez cada 20 minutos por sesion (cooldown), para no repetir el mismo texto.
 *   4. declara cierre y en la sesion escribi un ENTREGABLE afuera del repo (pdf, xlsx, step…)
 *      que no abri despues de su ultima escritura → exit 2, una vez por (archivo, escritura).
 *   5. declara cierre y el mensaje es un INFORME (mas de 3.000 caracteres, 35 lineas o 2 tablas)
 *      → exit 2, 1x/20 min; exento si Fak pidio el detalle o la sesion esta en modo plan.
 * Con stop_hook_active=true (segundo Stop del mismo turno) siempre deja pasar: sin loops.
 *
 * Toda frase vive en cierreCanon.data.json con su fuente (incidente + fecha). Una frase nueva
 * se agrega AHI, nunca como regex suelto aca (feedback_heuristicas_lista_canonica_no_regex_parcial).
 * Tests, en las dos direcciones y con textos reales: __tests__/scripts/cierreGuard*.test.mjs.
 *
 * El transcript se recorre UNA vez (`relevarTranscript`) y de esa pasada salen los cuatro datos
 * que usan los chequeos 2 a 5: lo entregado afuera, los archivos del repo que ESTA sesion toco
 * (subagentes incluidos: viven en <sesion>/subagents/*.jsonl), los entregables y si se miraron,
 * y el ultimo mensaje de Fak. `archivosTocadosEnSesion` la expone para dev-server-guard.sh.
 *
 * Nota sobre el flag de Supabase: el guard viejo renombraba el flag a `.avisado` al recordarlo.
 * Aca se copia su contenido a `.avisado`, se vacia el flag y se conservan las dos fechas de
 * modificacion, asi _cierreSesion.mjs sigue viendo la misma "ultima escritura".
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { soloLineasDeComando } from './shellTexto.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(AQUI, '..', '..');
export const CANON = JSON.parse(fs.readFileSync(path.join(AQUI, 'cierreCanon.data.json'), 'utf8'));

const rx = (s, flags = 'i') => new RegExp(s, flags);
const PERMISO = CANON.permiso.map((p) => ({ ...p, regex: rx(p.re) }));
const EXCEPCIONES = CANON.excepciones.map((e) => ({ ...e, regex: rx(e.re) }));
const CIERRE = CANON.cierre_declarado.map((s) => rx(s));
const RUTA = CANON.ruta_en_texto.map((s) => rx(s));
const FUERA = CANON.fuera_del_repo.map((s) => rx(s));
const BASH_ENTREGA = rx(CANON.bash_que_entrega);
const SCRATCH = rx(CANON.scratch_re);
const TEMP = rx(CANON.temp_re);
const ENT = CANON.entregables;
const EXT_ENTREGABLE = rx(`\\.(${ENT.extensiones})$`);
const EXCLUIR_ENTREGABLE = rx(ENT.excluir_re);
const SALIDA_ANTES = rx(ENT.salida_antes_re);
const ESCRIBE = rx(ENT.escribe_re);
const MIRA = rx(ENT.mira_re);
const PIDE_DETALLE = rx(CANON.cierre_largo.pide_detalle_re);

/** Sin markdown, sin acentos, espacios colapsados. Conserva mayusculas y los signos ¿?¡!. */
export function normalizar(texto) {
  return String(texto ?? '')
    .replace(/[*_`#>]+/g, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lo que importa es como TERMINA el mensaje: los ultimos `cola_chars` caracteres normalizados. */
export function cola(texto, n = CANON.cola_chars) {
  const t = normalizar(texto);
  return t.length > n ? t.slice(-n) : t;
}

/** ¿La cola pide permiso para hacer mi propio trabajo? Las excepciones ganan (esperar una
 *  accion fisica de Fak, un dato que solo el tiene, el OK de un mail). */
export function evaluarPermiso(texto) {
  const c = cola(texto);
  for (const e of EXCEPCIONES) {
    if (e.regex.test(c)) return { bloquea: false, excepcion: e.re, por: e.por };
  }
  for (const p of PERMISO) {
    const m = c.match(p.regex);
    if (m) return { bloquea: true, patron: p.re, fuente: p.fuente, frase: m[0] };
  }
  return { bloquea: false };
}

export function declaraCierre(texto) {
  const c = cola(texto);
  return CIERRE.some((r) => r.test(c));
}

/** Rutas se buscan en el texto CRUDO (las barras invertidas importan). */
export function tieneRuta(texto) {
  const t = String(texto ?? '');
  return RUTA.some((r) => r.test(t));
}

/** ¿El ultimo mensaje de Fak pide el detalle? Entonces un cierre largo no es un informe no pedido. */
export function pideDetalle(texto) {
  return PIDE_DETALLE.test(normalizar(texto));
}

/** Chequeo 5: ¿el mensaje es un informe? Tablas = bloques de lineas seguidas que arrancan con `|`. */
export function evaluarLargo(texto, cfg = CANON.cierre_largo) {
  const t = String(texto ?? '');
  const lineas = t.split(/\r?\n/);
  let tablas = 0;
  let enTabla = false;
  for (const l of lineas) {
    const es = /^\s*\|/.test(l);
    if (es && !enTabla) tablas++;
    enTabla = es;
  }
  const noVacias = lineas.filter((l) => l.trim()).length;
  const motivos = [];
  if (t.length > cfg.max_chars) motivos.push(`${t.length} caracteres (maximo ${cfg.max_chars})`);
  if (noVacias > cfg.max_lineas) motivos.push(`${noVacias} lineas (maximo ${cfg.max_lineas})`);
  if (tablas > cfg.max_tablas) motivos.push(`${tablas} tablas (maximo ${cfg.max_tablas})`);
  return { largo: motivos.length > 0, chars: t.length, lineas: noVacias, tablas, motivos };
}

// ---------------------------------------------------------------------------------------
// Gate por bullet de docs/LECCIONES_APRENDIDAS.md
// ---------------------------------------------------------------------------------------

/**
 * Un bullet arranca con "- " en columna 0, sigue mientras las lineas vengan indentadas y
 * se corta en una linea en blanco, un titulo o un parrafo. Devuelve los que NO pasan:
 *   - mas de `bullet_max_chars` caracteres (el detalle se gradua, no se recorta)
 *   - dice "graduado a X" y ocupa mas de `graduado_max_lineas` lineas (lo graduado no
 *     conserva su narrativa aca)
 * La cabecera del archivo (Snapshots, Tabla incidente) no cuenta como leccion.
 */
export function evaluarBullets(texto, cfg = CANON.lecciones) {
  const lineas = String(texto ?? '').split(/\r?\n/);
  const bullets = [];
  let actual = null;
  const cerrar = () => { if (actual) { bullets.push(actual); actual = null; } };
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (/^- /.test(l)) { cerrar(); actual = { linea: i + 1, lineas: [l.slice(2)] }; continue; }
    if (actual && /^\s+\S/.test(l)) { actual.lineas.push(l.trim()); continue; }
    cerrar();
  }
  cerrar();

  const graduado = rx(cfg.graduado_re);
  const excluir = /^\*{0,2}(Snapshots|Tabla incidente)/i;
  const malos = [];
  for (const b of bullets) {
    const inicio = b.lineas[0];
    if (excluir.test(inicio)) continue;
    const textoB = b.lineas.join(' ');
    const chars = textoB.length;
    const nLineas = b.lineas.length;
    let motivo = null;
    if (chars > cfg.bullet_max_chars) {
      motivo = `tiene ${chars} caracteres (maximo ${cfg.bullet_max_chars}): el detalle se gradua a memoria/regla/snapshot, no se recorta`;
    } else if (graduado.test(normalizar(textoB)) && nLineas > cfg.graduado_max_lineas) {
      motivo = `dice "graduado a" y ocupa ${nLineas} lineas (maximo ${cfg.graduado_max_lineas}): lo graduado no conserva su narrativa aca`;
    }
    if (motivo) malos.push({ linea: b.linea, inicio: inicio.slice(0, 70), chars, lineas: nLineas, motivo });
  }
  return malos;
}

// ---------------------------------------------------------------------------------------
// Rutas: adentro / afuera del repo, scratchpad, TEMP
// ---------------------------------------------------------------------------------------

/** `/c/Dev/x` (Git Bash) → `C:\Dev\x`. Lo demas queda como vino. */
function aWindows(r) {
  let s = String(r ?? '').trim();
  const m = s.match(/^\/([a-z])\/(.*)$/i);
  if (m) s = `${m[1].toUpperCase()}:\\${m[2].replace(/\//g, '\\')}`;
  return s;
}
/** `C:\x` o `\\server\x` siempre; y `/home/x` cuando el repo tambien arranca en `/`
 *  (el runner del CI es Linux: sin esto toda ruta absoluta se leia como relativa y la
 *  lista de tocados salia vacia). El criterio sale del repo, no de `process.platform`. */
const esAbsoluta = (r, repo = REPO) => /^[a-z]:[\\/]/i.test(r) || /^\\\\/.test(r)
  || (r.startsWith('/') && String(repo ?? '').startsWith('/'));
const rutaLarga = (p) => { try { return fs.realpathSync.native(p); } catch { return p; } };

const repoNormalizado = new Map();
function normRepo(repo) {
  const k = repo ?? REPO;
  if (!repoNormalizado.has(k)) {
    repoNormalizado.set(k, rutaLarga(aWindows(k)).replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase());
  }
  return repoNormalizado.get(k);
}

/** Relativa (con /) si la ruta ABSOLUTA cae dentro del repo, o null. Resuelve nombres cortos 8.3
 *  (`FACUND~1`) solo si hace falta: el repo real no los tiene, los repos temporales de los tests si. */
function dentroDelRepo(rutaWin, repo) {
  const base = normRepo(repo);
  let norm = rutaWin.replace(/\//g, '\\');
  if (!norm.toLowerCase().startsWith(`${base}\\`) && norm.includes('~')) {
    const dir = path.win32.dirname(norm);
    const largo = rutaLarga(dir);
    if (largo !== dir) norm = path.win32.join(largo, path.win32.basename(norm));
  }
  if (!norm.toLowerCase().startsWith(`${base}\\`)) return null;
  return norm.slice(base.length + 1).replace(/\\/g, '/');
}

function esRutaFuera(ruta, repo = REPO) {
  if (!ruta) return false;
  const r = aWindows(ruta);
  if (!esAbsoluta(r, repo)) return false;            // relativa = dentro del repo
  if (dentroDelRepo(r, repo) !== null) return false;
  if (SCRATCH.test(r) || TEMP.test(r)) return false;
  return FUERA.some((f) => f.test(r));
}

/** Un tool_use que deja algo afuera del repo: Write/Edit con ruta de afuera, o un Bash que
 *  copia/entrega hacia una ruta de afuera. Devuelve una descripcion corta o null. */
export function evaluarToolUse(bloque, repo = REPO) {
  const nombre = bloque?.name || '';
  const input = bloque?.input || {};
  if (/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(nombre)) {
    const ruta = input.file_path || input.notebook_path;
    return esRutaFuera(ruta, repo) ? `${nombre} ${ruta}` : null;
  }
  if (/^(Bash|PowerShell)$/.test(nombre)) {
    const cmd = String(input.command || '');
    // Lo que entrega es la LINEA de comando: el cuerpo de un heredoc y el mensaje de un
    // `git commit -m "..."` son prosa (falsos positivos del 05/09 y 10/09). Las rutas del
    // scratchpad y del TEMP se sacan antes de mirar si el comando apunta afuera.
    const linea = soloLineasDeComando(cmd);
    const sinTemp = linea.split(/\s+/).filter((t) => !SCRATCH.test(t) && !TEMP.test(t)).join(' ');
    if (BASH_ENTREGA.test(sinTemp) && FUERA.some((f) => f.test(sinTemp))) return `${nombre}: ${cmd.slice(0, 120)}`;
  }
  return null;
}

/** Ruta repo-relativa (con /) de un Write/Edit DENTRO del repo, o null. */
export function rutaRelativaAlRepo(bloque, repo = REPO) {
  if (!/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(bloque?.name || '')) return null;
  const r = aWindows(bloque.input?.file_path || bloque.input?.notebook_path || '');
  if (!esAbsoluta(r, repo)) return null;
  return dentroDelRepo(r, repo);
}

const EXT_CODIGO = /\.(ts|tsx|js|jsx|mjs|css|json|md|py|sh)$/i;
const RE_TOKEN_RUTA = /^[\w@.\-]+(?:\/[\w@.\-]+)*$/;

/** Rutas del repo que NOMBRA un comando Bash/PowerShell: `sed -i … scripts/x.mjs`, `cat > docs/x.md`,
 *  `python scripts/_arb.py`, `git add a b`. Relativas con extension de codigo, o absolutas dentro
 *  del repo (se relativizan). No mira el disco, asi cuenta tambien lo borrado. Un token que sube
 *  con `..` (imports dentro de un heredoc) no se puede ubicar y se salta; URLs y rutas de afuera
 *  tampoco entran. Sobreincluir es barato: solo cuenta si ademas esta sucio en git. */
export function rutasRepoEnComando(cmd, repo = REPO) {
  const out = new Set();
  for (let t of String(cmd || '').split(/\s+/)) {
    t = t.replace(/^["'`(]+|["'`),;:]+$/g, '');
    if (!t || !EXT_CODIGO.test(t)) continue;
    const rel = rutaRelativaAlRepo({ name: 'Write', input: { file_path: t } }, repo);
    if (rel) { out.add(rel); continue; }
    if (/^[a-z]:[\\/]/i.test(t) || t.startsWith('\\\\') || t.startsWith('/')) continue;   // absoluta, afuera del repo
    const n = t.replace(/\\/g, '/').replace(/^\.\//, '');
    if (!RE_TOKEN_RUTA.test(n) || n.split('/').includes('..')) continue;
    out.add(n);
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// Entregables (chequeo 4): que se escribio afuera y si se miro despues
// ---------------------------------------------------------------------------------------

const nombreBase = (ruta) => aWindows(ruta).replace(/\//g, '\\').replace(/\\+$/, '').split('\\').pop().toLowerCase();
const sinExtension = (n) => n.replace(/\.[^.]+$/, '');
const limpiarToken = (t) => String(t ?? '').replace(/^["'`(]+|["'`),;:]+$/g, '');

/** Ruta absoluta con extension de entregable, afuera del repo, del scratchpad, del TEMP y de las
 *  carpetas internas (`.claude`, caches). No exige que matchee `fuera_del_repo`: un PDF en
 *  cualquier carpeta que no sea el repo es un entregable para alguien. */
export function esEntregableFuera(ruta, repo = REPO) {
  const r = aWindows(limpiarToken(ruta));
  if (!EXT_ENTREGABLE.test(r) || !esAbsoluta(r, repo)) return false;
  if (dentroDelRepo(r, repo) !== null) return false;
  if (SCRATCH.test(r) || TEMP.test(r) || EXCLUIR_ENTREGABLE.test(r)) return false;
  return true;
}

/** Rutas de entregables que nombra un texto de comando, con `salida: true` si vienen detras de un
 *  flag de salida, una redireccion o un `.save(`. Primero las entrecomilladas (pueden tener
 *  espacios: `OneDrive - BARACK`), despues los tokens sueltos. */
function rutasEntregablesEn(texto, repo) {
  const t = String(texto || '');
  const out = [];
  const reComillas = /"([^"\n]+)"|'([^'\n]+)'/g;
  for (const m of t.matchAll(reComillas)) {
    const ruta = m[1] ?? m[2];
    if (!esEntregableFuera(ruta, repo)) continue;
    out.push({ ruta, salida: SALIDA_ANTES.test(t.slice(Math.max(0, m.index - 60), m.index)) });
  }
  const sinComillas = t.replace(reComillas, ' ');
  const tokens = sinComillas.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    let tok = tokens[i];
    let prefijo = '';
    const red = tok.match(/^(>{1,2})(.+)$/);
    if (red) { prefijo = red[1]; tok = red[2]; }
    const igual = tok.match(/^(--?[a-z-]+=)(.+)$/i);
    if (igual) { prefijo = igual[1]; tok = igual[2]; }
    tok = limpiarToken(tok);
    if (!esEntregableFuera(tok, repo)) continue;
    const antes = prefijo || (i > 0 ? `${tokens[i - 1]} ` : '');
    out.push({ ruta: tok, salida: SALIDA_ANTES.test(antes) });
  }
  return out;
}

/** Que entregables ESCRIBE y cuales MIRA un comando. La linea de comando decide lo escrito (sin
 *  cuerpos de heredoc ni mensajes de commit); el texto entero decide lo mirado, porque el
 *  verificador puede vivir dentro de un `python - <<EOF`. */
export function entregablesEnComando(cmd, repo = REPO) {
  const texto = String(cmd || '');
  const linea = soloLineasDeComando(texto);
  const todo = rutasEntregablesEn(texto, repo);
  const escritos = todo.filter((x) => x.salida).map((x) => x.ruta);
  let insumos = todo.filter((x) => !x.salida).map((x) => x.ruta);
  if (BASH_ENTREGA.test(linea)) {
    const enLinea = rutasEntregablesEn(linea, repo).filter((x) => !x.salida).map((x) => x.ruta);
    const destino = enLinea[enLinea.length - 1];
    if (destino) { escritos.push(destino); insumos = insumos.filter((r) => r !== destino); }
    return { escritos, mirados: [] };
  }
  if (MIRA.test(texto)) return { escritos, mirados: insumos };
  if (ESCRIBE.test(texto)) return { escritos: [...escritos, ...insumos], mirados: [] };
  return { escritos, mirados: [] };
}

function registrarEntregables(b, st, repo) {
  const nombre = b.name || '';
  const input = b.input || {};
  const escrito = (ruta) => {
    const k = nombreBase(ruta);
    const e = st.ent.get(k) || { ruta, escritoEn: -1, miradoEn: -1 };
    e.ruta = ruta;
    e.escritoEn = st.seq;
    st.ent.set(k, e);
  };
  const mirado = (k) => {
    const stem = sinExtension(k);
    for (const [n, e] of st.ent) if (n === k || sinExtension(n) === stem) e.miradoEn = st.seq;
  };
  if (/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(nombre)) {
    const ruta = input.file_path || input.notebook_path;
    if (esEntregableFuera(ruta, repo)) escrito(ruta);
  } else if (nombre === 'Read') {
    const r = aWindows(input.file_path || '');
    if (EXT_ENTREGABLE.test(r)) mirado(nombreBase(r));
  } else if (/^(Bash|PowerShell)$/.test(nombre)) {
    const { escritos, mirados } = entregablesEnComando(input.command, repo);
    for (const m of mirados) mirado(nombreBase(m));
    for (const w of escritos) escrito(w);
  } else if (nombre.startsWith('mcp__') && st.ent.size) {
    const j = JSON.stringify(input).toLowerCase();
    for (const [n, e] of st.ent) if (j.includes(n)) e.miradoEn = st.seq;
  }
}

// ---------------------------------------------------------------------------------------
// Relevadores (leen el mundo). En los tests se inyectan versiones falsas.
// ---------------------------------------------------------------------------------------

function textoDeUsuario(obj) {
  const c = obj.message?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.filter((b) => b.type === 'text').map((b) => b.text || '').join('\n');
  return '';
}

// Lo que Claude Code mete como "user" sin que Fak lo haya escrito: avisos de tareas en
// background, system-reminders, salidas de comandos. No cuentan como mensaje de Fak.
const ES_SISTEMA = /^\s*(<system-reminder>|\[SYSTEM NOTIFICATION|<task-notification>|<local-command|<command-(name|message)|<user-prompt-submit-hook|<ide_)/;

function esMensajeRealDeUsuario(obj) {
  if (obj.isMeta) return false;
  const t = textoDeUsuario(obj);
  return t.trim().length > 0 && !ES_SISTEMA.test(t);
}

async function pasada(archivo, st, { completa, repo }) {
  const rl = readline.createInterface({ input: fs.createReadStream(archivo, 'utf8'), crlfDelay: Infinity });
  for await (const linea of rl) {
    if (!linea.includes('"tool_use"') && !linea.includes('"type":"user"')) continue;
    let obj;
    try { obj = JSON.parse(linea); } catch { continue; }
    if (obj.type === 'user') {
      if (completa && esMensajeRealDeUsuario(obj)) { st.ejemplo = null; st.ultimoMensajeFak = textoDeUsuario(obj); }
      continue;
    }
    if (obj.type !== 'assistant') continue;
    const bloques = obj.message?.content;
    if (!Array.isArray(bloques)) continue;
    for (const b of bloques) {
      if (b.type !== 'tool_use') continue;
      st.seq++;
      const rel = rutaRelativaAlRepo(b, repo);
      if (rel) st.tocados.add(rel);
      if (/^(Bash|PowerShell|Agent|Task)$/.test(b.name || '')) {
        st.huboComando = true;
        for (const r of rutasRepoEnComando(b.input?.command, repo)) st.tocados.add(r);
      }
      if (!completa) continue;
      const e = evaluarToolUse(b, repo);
      if (e) st.ejemplo = e;
      registrarEntregables(b, st, repo);
    }
  }
}

/**
 * UNA pasada por el transcript de la sesion (y por los de sus subagentes, que viven en
 * `<sesion>/subagents/*.jsonl` y NO en el transcript principal). Devuelve:
 *   fuera / ejemplo   — algo entregado afuera del repo DESPUES del ultimo mensaje real de Fak
 *   tocados           — Set de rutas repo-relativas que esta sesion escribio (Write/Edit) o
 *                       nombro en un comando (sed -i, cat >, python x.py), subagentes incluidos.
 *                       Con dos sesiones sobre el mismo repo, lo sucio de la otra no es pendiente
 *                       mio (falso positivo del 05/09). Si la sesion corrio comandos o agentes y
 *                       aun asi no se le puede atribuir NINGUN archivo, vuelve null y se cuenta
 *                       todo lo sucio, como antes (auditoria 05/09, C.1).
 *   entregables       — archivos de entrega escritos afuera, con `mirado` (hubo Read, verificador
 *                       o tool MCP sobre ese archivo DESPUES de su ultima escritura)
 *   sinMirar          — los entregables con mirado=false
 *   ultimoMensajeFak  — texto del ultimo mensaje real de Fak (para el chequeo 5)
 */
export async function relevarTranscript(transcriptPath, { repo = REPO } = {}) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return { fuera: false };
  const st = { ejemplo: null, huboComando: false, tocados: new Set(), ultimoMensajeFak: '', ent: new Map(), seq: 0 };
  await pasada(transcriptPath, st, { completa: true, repo });
  const dirSub = path.join(String(transcriptPath).replace(/\.jsonl$/i, ''), 'subagents');
  let subagentes = [];
  try { subagentes = fs.readdirSync(dirSub).filter((f) => /\.jsonl$/i.test(f)); } catch { /* sin subagentes */ }
  for (const f of subagentes) {
    try { await pasada(path.join(dirSub, f), st, { completa: false, repo }); } catch { /* un transcript roto no frena el cierre */ }
  }
  const atribuibles = st.tocados.size > 0 || !st.huboComando ? st.tocados : null;
  const entregables = [...st.ent.entries()].map(([nombre, e]) => ({
    nombre, ruta: e.ruta, escritoEn: e.escritoEn, mirado: e.miradoEn > e.escritoEn,
  }));
  return {
    fuera: Boolean(st.ejemplo),
    ejemplo: st.ejemplo ?? undefined,
    tocados: atribuibles,
    huboComando: st.huboComando,
    entregables,
    sinMirar: entregables.filter((e) => !e.mirado),
    ultimoMensajeFak: st.ultimoMensajeFak,
  };
}

/** Nombre historico del relevador (tests y deps lo siguen usando). */
export const escribioFueraEnEsteTurno = relevarTranscript;

/** Set de rutas repo-relativas que toco ESTA sesion, o null si no se puede atribuir
 *  (sin transcript, o sesion con comandos sin archivo atribuible). Lo usa dev-server-guard.sh
 *  via scripts/_lib/archivosSesion.mjs. */
export async function archivosTocadosEnSesion(transcriptPath, opts) {
  const r = await relevarTranscript(transcriptPath, opts);
  return r.tocados instanceof Set ? r.tocados : null;
}

function flagSupabase() {
  const dir = process.env.TEMP || process.env.TMPDIR || os.tmpdir();
  const flag = path.join(dir, 'claude-supabase-write.flag');
  try {
    if (!fs.existsSync(flag)) return false;
    const contenido = fs.readFileSync(flag, 'utf8');
    if (!contenido.trim()) return false;             // ya avisado en un turno anterior
    const st = fs.statSync(flag);
    const avisado = `${flag}.avisado`;
    fs.writeFileSync(avisado, contenido);
    fs.utimesSync(avisado, st.atime, st.mtime);      // la fecha de la escritura se conserva
    fs.truncateSync(flag, 0);
    fs.utimesSync(flag, st.atime, st.mtime);
    return true;
  } catch { return false; }
}

/** Pendientes medibles al declarar un cierre. Cada renglon es accionable.
 *  `tocados` (Set de rutas repo-relativas que escribio o nombro esta sesion) filtra el git
 *  status: si viene null (sin transcript, o sesion con comandos sin archivo atribuible), se
 *  cuenta todo lo sucio como antes. */
export function relevarPendientes(tocados = null) {
  const out = [];
  try {
    const st = execSync('git status --porcelain', { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    let archivos = st.split(/\r?\n/).filter(Boolean).map((l) => l.slice(3).trim().replace(/^.*-> /, '').replace(/^"|"$/g, '')).filter((a) => EXT_CODIGO.test(a));
    if (tocados instanceof Set) archivos = archivos.filter((a) => tocados.has(a.replace(/\\/g, '/')));
    if (archivos.length) {
      out.push(`hay ${archivos.length} archivo(s) sin commitear (${archivos.slice(0, 4).join(', ')}${archivos.length > 4 ? ', …' : ''}) — regla git-deploy: build + commit por ruta + push`);
    }
  } catch { /* sin git no hay pendiente medible */ }
  if (flagSupabase()) {
    out.push('esta sesion escribio Supabase: node scripts/_backup.mjs si no hay backup posterior (node scripts/_cierreSesion.mjs --sin-build lo mide)');
  }
  try {
    const texto = fs.readFileSync(path.join(REPO, 'docs', 'LECCIONES_APRENDIDAS.md'), 'utf8');
    const bytes = Buffer.byteLength(texto, 'utf8');
    if (bytes > CANON.lecciones.aviso_bytes) {
      out.push(`LECCIONES pesa ${(bytes / 1024).toFixed(1)} KB (aviso ${CANON.lecciones.aviso_bytes / 1024} KB): pasada de consolidacion, no de poda`);
    }
    const malos = evaluarBullets(texto);
    if (malos.length) {
      out.push(`${malos.length} leccion(es) fuera del gate por bullet (l.${malos.slice(0, 3).map((m) => m.linea).join(', l.')}): graduar el detalle a memoria/regla, no recortar frases`);
    }
  } catch { /* sin archivo no hay gate */ }
  return out;
}

// Marcas por sesion en el TEMP: `claude-cierre-recordado.<sid>` (chequeo 3), `.largo` (chequeo 5)
// y `.entregables` (chequeo 4: una linea por `<archivo>@<escritura>` ya reclamado).
const archivoMarca = (sid, clave = '') => path.join(
  os.tmpdir(),
  `claude-cierre-recordado.${String(sid || 'sin-id').replace(/[^\w-]/g, '_')}${clave ? `.${clave}` : ''}`,
);

export function cooldownVigente(sid, clave = '') {
  const seg = clave === 'largo' ? CANON.cierre_largo.cooldown_seg : CANON.cooldown_recordatorio_seg;
  try {
    const t = Number(fs.readFileSync(archivoMarca(sid, clave), 'utf8'));
    return Number.isFinite(t) && (Date.now() / 1000 - t) < seg;
  } catch { return false; }
}

export function marcarRecordatorio(sid, clave = '') {
  try { fs.writeFileSync(archivoMarca(sid, clave), String(Math.floor(Date.now() / 1000))); } catch { /* sin marca, se repite: mal menor */ }
}

export function yaReclamado(sid, clave) {
  try { return fs.readFileSync(archivoMarca(sid, 'entregables'), 'utf8').split(/\r?\n/).includes(clave); } catch { return false; }
}

export function reclamar(sid, clave) {
  try { fs.appendFileSync(archivoMarca(sid, 'entregables'), `${clave}\n`); } catch { /* idem */ }
}

// ---------------------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------------------

const DEPS_REALES = {
  fueraEnEsteTurno: relevarTranscript,
  pendientes: relevarPendientes,
  enCooldown: cooldownVigente,
  marcar: marcarRecordatorio,
  yaReclamado,
  reclamar,
};

/** @returns {Promise<{ok:boolean, titulo?:string, detalle?:string, motivo?:string}>} */
export async function decidir(payload = {}, deps = {}) {
  const d = { ...DEPS_REALES, ...deps };
  if (payload.stop_hook_active) return { ok: true, motivo: 'stop_hook_active' };
  const texto = String(payload.last_assistant_message ?? '');
  if (!texto.trim()) return { ok: true, motivo: 'sin texto' };

  // 1. La cola pide permiso para mi propio trabajo.
  const p = evaluarPermiso(texto);
  if (p.bloquea) {
    return {
      ok: false,
      titulo: 'CIERRE-GUARD: el turno termina pidiendo permiso para hacer tu propio trabajo',
      detalle: `La cola del mensaje dice "${p.frase}". Patron nacido del incidente: ${p.fuente}.\n`
        + 'Regla de la casa (CLAUDE.md): la respuesta es SI. Hacelo ahora y reporta el resultado con la ruta. '
        + 'Si de verdad falta un dato que SOLO Fak tiene, preguntalo con AskUserQuestion y un renglon "Lo que ya tengo:".',
    };
  }

  // 2. Entregue afuera del repo y no digo donde.
  const fuera = await d.fueraEnEsteTurno(payload.transcript_path);
  if (fuera?.fuera && !tieneRuta(texto)) {
    return {
      ok: false,
      titulo: 'CIERRE-GUARD: entregaste algo afuera del repo y el cierre no dice DONDE quedo',
      detalle: `En este turno: ${fuera.ejemplo}.\n`
        + 'El mensaje final arranca con la RUTA completa del entregable (Fak la pidio 17 veces en dos semanas: "pasame la ruta"). Repetilo con la ruta.',
    };
  }

  if (!declaraCierre(texto)) return { ok: true };
  const sid = payload.session_id || 'sin-id';

  // 3. Cierre declarado con pendientes medibles (1x/20 min).
  if (!d.enCooldown(sid)) {
    const pend = d.pendientes(fuera?.tocados ?? null) || [];
    if (pend.length) {
      d.marcar(sid);
      return {
        ok: false,
        titulo: 'CIERRE-GUARD: el mensaje declara cierre y hay pendientes medibles',
        detalle: pend.map((x) => `- ${x}`).join('\n')
          + '\nSi es un cierre real, resolvelos antes de cerrar. Si no lo es, segui: este aviso no se repite por 20 minutos.',
      };
    }
  }

  // 4. Entregable escrito afuera y nunca abierto despues (una vez por archivo y escritura).
  const sinMirar = (fuera?.sinMirar || []).filter((e) => !d.yaReclamado(sid, `${e.nombre}@${e.escritoEn}`));
  if (sinMirar.length) {
    for (const e of sinMirar) d.reclamar(sid, `${e.nombre}@${e.escritoEn}`);
    return {
      ok: false,
      titulo: 'CIERRE-GUARD: escribiste un entregable afuera del repo y no lo abriste despues',
      detalle: `Sin mirar desde su ultima escritura: ${sinMirar.map((e) => e.ruta).join(' · ')}.\n`
        + 'El juez es el archivo que quedo en la carpeta, no el script que lo genero (LECCIONES 03-04/09 y 08/09: '
        + 'el pptx viejo, el margen que no se veia en el HTML, el texto recortado que solo se ve en el PDF). Abrilo antes de decir listo: '
        + 'Read del PDF o de su render, _xlsxAPdf.py para un Excel, _validarDxf.py para un DXF, gate_entregable.py para un 3D. '
        + 'Este aviso sale una vez por archivo y escritura.',
    };
  }

  // 5. El cierre es un informe (exento si Fak pidio el detalle o la sesion esta en modo plan).
  const largo = evaluarLargo(texto);
  if (largo.largo && payload.permission_mode !== 'plan' && !pideDetalle(fuera?.ultimoMensajeFak) && !d.enCooldown(sid, 'largo')) {
    d.marcar(sid, 'largo');
    return {
      ok: false,
      titulo: 'CIERRE-GUARD: el cierre es un informe, y una tarea se cierra en cinco lineas',
      detalle: `El mensaje tiene ${largo.motivos.join(', ')}. Fak, 08/09: "no voy a leer todo eso... podes sintetizar que recomendas".\n`
        + 'El cierre pasa el test de un mail: que recomiendo, el comando o la ruta, y lo que le cambia una decision; el detalle ya vive '
        + 'en el archivo o la memoria (memoria no_hacer_informes). Reescribilo corto. Si Fak pidio el detalle con esas palabras, este aviso '
        + 'no aplica (se lee su ultimo mensaje). No se repite por 20 minutos.',
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------------------
// CLI (hook Stop): lee el JSON por stdin, exit 0 deja terminar, exit 2 devuelve el stderr.
// ---------------------------------------------------------------------------------------

const esDirecto = Boolean(process.argv[1] && /cierreGuard\.mjs$/i.test(process.argv[1]));
if (esDirecto) {
  let payload = {};
  try { payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { payload = {}; }
  decidir(payload)
    .then((r) => {
      if (r.ok) process.exit(0);
      process.stderr.write(`${r.titulo}\n${r.detalle}\n`);
      process.exit(2);
    })
    .catch(() => process.exit(0));                   // un guardian roto no frena el cierre
}
