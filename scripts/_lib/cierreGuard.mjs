/**
 * cierreGuard.mjs — gate de cierre de turno (hook Stop) + gate por bullet de LECCIONES.
 *
 * Nace el 04/09/2026 de medir dos semanas de chats (21/08 → 04/09): 375 turnos terminados en
 * texto, 32 con pedido de permiso para hacer mi propio trabajo y 20 de esos con Fak
 * contestando "hacelo" de alguna forma ("estas esperando que te diga ok nada mas", "no
 * arrancaste ni siquiera?"). Ademas 17 pedidos de "pasame la ruta" y un Stop hook viejo
 * (session-close-guard.sh) que devolvia exit 2 en 115 cierres, uno por turno con git sucio.
 *
 * Tres cosas mide, en este orden, sobre el ULTIMO mensaje del asistente:
 *   1. la COLA (ultimos 500 caracteres) pide permiso  → exit 2 siempre
 *   2. en este turno escribi/copie algo afuera del repo y el texto no dice la RUTA → exit 2
 *   3. el texto DECLARA cierre ("listo", "pusheado") y hay pendientes medibles → exit 2,
 *      una vez cada 20 minutos por sesion (cooldown), para no repetir el mismo texto.
 * Con stop_hook_active=true (segundo Stop del mismo turno) siempre deja pasar: sin loops.
 *
 * Toda frase vive en cierreCanon.data.json con su fuente (incidente + fecha). Una frase nueva
 * se agrega AHI, nunca como regex suelto aca (feedback_heuristicas_lista_canonica_no_regex_parcial).
 * Tests, en las dos direcciones y con textos reales: __tests__/scripts/cierreGuard.test.mjs.
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
// Relevadores (leen el mundo). En los tests se inyectan versiones falsas.
// ---------------------------------------------------------------------------------------

const SCRATCH = /[\\/]Temp[\\/]claude[\\/]|[\\/]scratchpad[\\/]|[\\/]tmp[\\/]/i;

function esRutaFuera(ruta) {
  if (!ruta) return false;
  let r = String(ruta).trim();
  const m = r.match(/^\/([a-z])\/(.*)$/i);           // /c/Dev/x → C:\Dev\x (Git Bash)
  if (m) r = `${m[1].toUpperCase()}:\\${m[2].replace(/\//g, '\\')}`;
  const absoluta = /^[a-z]:[\\/]/i.test(r) || /^\\\\/.test(r);
  if (!absoluta) return false;                       // relativa = dentro del repo
  const norm = r.replace(/\//g, '\\').toLowerCase();
  const repo = REPO.replace(/\//g, '\\').toLowerCase();
  if (norm.startsWith(repo)) return false;
  if (SCRATCH.test(r)) return false;
  return FUERA.some((f) => f.test(r));
}

/** Un tool_use que deja algo afuera del repo: Write/Edit con ruta de afuera, o un Bash que
 *  copia/entrega hacia una ruta de afuera. Devuelve una descripcion corta o null. */
export function evaluarToolUse(bloque) {
  const nombre = bloque?.name || '';
  const input = bloque?.input || {};
  if (/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(nombre)) {
    const ruta = input.file_path || input.notebook_path;
    return esRutaFuera(ruta) ? `${nombre} ${ruta}` : null;
  }
  if (/^(Bash|PowerShell)$/.test(nombre)) {
    const cmd = String(input.command || '');
    if (BASH_ENTREGA.test(cmd) && FUERA.some((f) => f.test(cmd))) return `${nombre}: ${cmd.slice(0, 120)}`;
  }
  return null;
}

function esMensajeRealDeUsuario(obj) {
  if (obj.isMeta) return false;
  const c = obj.message?.content;
  if (typeof c === 'string') return c.trim().length > 0;
  if (Array.isArray(c)) return c.some((b) => b.type === 'text');
  return false;
}

/** Recorre el transcript y se queda con lo que paso DESPUES del ultimo mensaje real de Fak. */
export async function escribioFueraEnEsteTurno(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return { fuera: false };
  let ejemplo = null;
  const rl = readline.createInterface({ input: fs.createReadStream(transcriptPath, 'utf8'), crlfDelay: Infinity });
  for await (const linea of rl) {
    if (!linea.includes('"tool_use"') && !linea.includes('"type":"user"')) continue;
    let obj;
    try { obj = JSON.parse(linea); } catch { continue; }
    if (obj.type === 'user') { if (esMensajeRealDeUsuario(obj)) ejemplo = null; continue; }
    if (obj.type !== 'assistant') continue;
    const bloques = obj.message?.content;
    if (!Array.isArray(bloques)) continue;
    for (const b of bloques) {
      if (b.type !== 'tool_use') continue;
      const e = evaluarToolUse(b);
      if (e) ejemplo = e;
    }
  }
  return ejemplo ? { fuera: true, ejemplo } : { fuera: false };
}

const EXT_CODIGO = /\.(ts|tsx|js|jsx|mjs|css|json|md|py|sh)$/i;

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

/** Pendientes medibles al declarar un cierre. Cada renglon es accionable. */
export function relevarPendientes() {
  const out = [];
  try {
    const st = execSync('git status --porcelain', { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const archivos = st.split(/\r?\n/).filter(Boolean).map((l) => l.slice(3).trim()).filter((a) => EXT_CODIGO.test(a));
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

const archivoCooldown = (sid) => path.join(os.tmpdir(), `claude-cierre-recordado.${String(sid || 'sin-id').replace(/[^\w-]/g, '_')}`);

export function cooldownVigente(sid) {
  try {
    const t = Number(fs.readFileSync(archivoCooldown(sid), 'utf8'));
    return Number.isFinite(t) && (Date.now() / 1000 - t) < CANON.cooldown_recordatorio_seg;
  } catch { return false; }
}

export function marcarRecordatorio(sid) {
  try { fs.writeFileSync(archivoCooldown(sid), String(Math.floor(Date.now() / 1000))); } catch { /* sin marca, se repite: mal menor */ }
}

// ---------------------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------------------

const DEPS_REALES = {
  fueraEnEsteTurno: escribioFueraEnEsteTurno,
  pendientes: relevarPendientes,
  enCooldown: cooldownVigente,
  marcar: marcarRecordatorio,
};

/** @returns {Promise<{ok:boolean, titulo?:string, detalle?:string, motivo?:string}>} */
export async function decidir(payload = {}, deps = {}) {
  const d = { ...DEPS_REALES, ...deps };
  if (payload.stop_hook_active) return { ok: true, motivo: 'stop_hook_active' };
  const texto = String(payload.last_assistant_message ?? '');
  if (!texto.trim()) return { ok: true, motivo: 'sin texto' };

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

  const fuera = await d.fueraEnEsteTurno(payload.transcript_path);
  if (fuera?.fuera && !tieneRuta(texto)) {
    return {
      ok: false,
      titulo: 'CIERRE-GUARD: entregaste algo afuera del repo y el cierre no dice DONDE quedo',
      detalle: `En este turno: ${fuera.ejemplo}.\n`
        + 'El mensaje final arranca con la RUTA completa del entregable (Fak la pidio 17 veces en dos semanas: "pasame la ruta"). Repetilo con la ruta.',
    };
  }

  if (declaraCierre(texto)) {
    const sid = payload.session_id || 'sin-id';
    if (!d.enCooldown(sid)) {
      const pend = d.pendientes() || [];
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
