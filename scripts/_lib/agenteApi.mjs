/**
 * agenteApi.mjs — el bucle del agente por API (diseño AGENTE_POR_API_diseno_opus.md, 11/10/2026).
 *
 * Es puro adrede: el modelo, el ejecutor de herramientas, el guardian, el ledger y el registro entran
 * inyectados, asi la corrida se prueba sin red y sin costo (clienteGuion + ejecutorSeco). Todo freno vive
 * aca, en codigo, nunca en el prompt: una pagina buscada puede traer ordenes (diseño §4).
 *
 *   correrAgente({ cliente, modelo, system, encargo, carpeta, ejecutor, registro, topes, ... })
 *     -> { terminado, corte, paso, gastadoUsd, busquedas, bloqueos, entregable, resumen, mensajes }
 *
 * Herramientas del modelo: leer_archivo · escribir_archivo (solo <carpeta>/trabajo) · correr_comando (lista
 * blanca + guardianes + tope de tiempo + recorte a 4 KB) · leer_pdf · terminar (la unica salida limpia) y
 * web_search del servidor. Lo prohibido vuelve como tool_result con is_error y "No reintentar"; el segundo
 * bloqueo corta. Los topes (pasos, reloj, dolares) se miran ANTES de cada llamada. Un paso = una llamada.
 * No toca claudeApi.mjs: usa armarParametros/interpretarRespuesta/registrarGasto y suma lo que falta encima.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { armarParametros, interpretarRespuesta, resolverModelo, costoUsd, registrarGasto, selloLocal, usd } from './claudeApi.mjs';
import { escribirSeguro, agregarSeguro } from './escrituraSegura.mjs';
import { rutaReal, esSecreto } from '../_apiTarea.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..', '..');

export const TOPES_DEFECTO = Object.freeze({ pasos: 60, minutos: 120, dolares: 6, busquedas: 20 });
export const RECORTE_BYTES = 4096;          // lo que le llega al modelo por resultado: mitad cabeza, mitad cola
export const LECTURA_MAX_BYTES = 20 * 1024;
export const COMANDO_MAX_S = 600;
export const PRECIO_BUSQUEDA_USD = 0.01;    // A VERIFICAR: $10 cada 1.000 busquedas; no esta en PRECIOS
export const CARACTERES_POR_TOKEN = 3.5;    // la misma estimacion que BARACK_TOKENS_POR_CARACTER
export const HERRAMIENTA_BUSQUEDA = 'web_search_20250305'; // A VERIFICAR: el `type` del server tool
export const RECORDATORIO = 'Cerraste el turno sin llamar a terminar(entregable, resumen). Si el trabajo esta hecho, llamala ahora; si no, segui con las herramientas. Otro turno sin terminar corta la corrida.';

/** Un pedido que no se hace: el ejecutor real lo tira cuando el escaneo frena un script antes de correrlo. */
export class Bloqueo extends Error { constructor(m) { super(m); this.name = 'Bloqueo'; } }

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');
const textoDe = (s) => (Array.isArray(s) ? s.map((b) => b?.text ?? '').join('') : String(s ?? ''));
const tokensEntrada = (u = {}) => n(u.input_tokens) + n(u.cache_read_input_tokens) + n(u.cache_creation_input_tokens);

// ── las herramientas que ve el modelo ─────────────────────────────────────────
const S = { type: 'string' };
const N = { type: 'integer' };
const h = (name, description, properties, required) => ({ name, description, input_schema: { type: 'object', properties, required, additionalProperties: false } });

/** `web_search` corre del lado del servidor: nunca llega como tool_use, sus resultados vienen en el content. */
export function armarHerramientas(busquedas = TOPES_DEFECTO.busquedas) {
  return [
    h('leer_archivo', 'Lee un archivo de texto del repo o de la carpeta de trabajo (hasta 20 KB por lectura; desde/hasta son lineas desde 1). Una ruta relativa sale de la carpeta de trabajo.', { ruta: S, desde: N, hasta: N }, ['ruta']),
    h('escribir_archivo', 'Escribe (pisa) un archivo SOLO adentro de la carpeta de trabajo. Mantene notas.md con tu avance.', { ruta: S, texto: S }, ['ruta', 'texto']),
    h('correr_comando', `Corre un comando de bash en la carpeta de trabajo. Lista blanca: ls, cat, grep, head, tail, wc, pwd, git de lectura, python o node sobre un archivo. Sin ; & $ \` < > ni heredoc. La salida llega recortada a ${RECORTE_BYTES} bytes; la completa queda en salidas/.`, { cmd: S, segundos: { ...N, description: `tope de tiempo (120 por defecto, maximo ${COMANDO_MAX_S})` } }, ['cmd']),
    h('leer_pdf', 'Extrae el texto de un PDF (hasta 20 paginas por llamada; sin `paginas`, las primeras 20).', { ruta: S, paginas: { type: 'array', items: N } }, ['ruta']),
    h('terminar', 'La UNICA salida limpia: el entregable (ruta o texto) y un resumen de lo hecho y de lo que quedo pendiente.', { entregable: S, resumen: S }, ['entregable', 'resumen']),
    { type: HERRAMIENTA_BUSQUEDA, name: 'web_search', max_uses: busquedas },
  ];
}

// ── politica (pura) ───────────────────────────────────────────────────────────

/** ¿`ruta` cae ADENTRO de `base`? Compara rutas reales (enlaces, 8.3) y sin distinguir mayusculas (Windows). */
export function dentroDe(ruta, base) {
  const rel = path.relative(rutaReal(base).toLowerCase(), rutaReal(ruta).toLowerCase());
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

const VERBOS = new Set(['ls', 'cat', 'grep', 'head', 'tail', 'wc', 'pwd']);
const GIT_LECTURA = new Set(['status', 'log', 'show', 'diff', 'ls-files', 'grep', 'rev-parse', 'blame', 'branch']);
/**
 * Lista blanca de correr_comando (diseño §4): el motivo si no pasa, null si pasa. Estricta a proposito: comandos
 * simples unidos por | o &&; nada de ; & $ ` < > ni heredoc, porque ahi se esconde cualquier cosa.
 */
export function comandoPermitido(cmd, { carpeta } = {}) {
  const c = String(cmd ?? '');
  if (!c.trim()) return 'comando vacio';
  if (/[;&`$<>\n]|\|\|/.test(c.replace(/&&/g, ' '))) return 'solo comandos simples unidos por | o && (sin ; & $ ` < > ni heredoc)';
  const tramos = [[]];
  for (const t of c.match(/"(?:[^"\\]|\\.)*"|'[^']*'|\S+/g) ?? []) {
    if (t === '|' || t === '&&') tramos.push([]); else tramos[tramos.length - 1].push(t.replace(/^["']|["']$/g, ''));
  }
  for (const p of tramos) {
    if (!p.length) return 'un tramo vacio';
    const secreto = p.find((t) => esSecreto(t));
    if (secreto) return `nombra un archivo de secretos (${secreto})`;
    const v = path.basename(p[0]).toLowerCase().replace(/\.exe$/, '');
    if (VERBOS.has(v)) continue;
    if (v === 'git') { if (!GIT_LECTURA.has(p[1])) return `git ${p[1] ?? ''}: solo lectura (${[...GIT_LECTURA].join(', ')})`; continue; }
    if (/^(python[\d.]*|py|node)$/.test(v)) {
      if (p[1] === '-m') { if (!/^(pytest|unittest)$/.test(p[2] ?? '')) return `${v} -m solo con pytest o unittest`; continue; }
      if (p.some((t, i) => i > 0 && /^(-c|-e|-p|--eval|-)$/.test(t))) return `${v} solo corre un archivo por ruta (sin -c, -e, -p ni stdin)`;
      const script = p.slice(1).find((t) => !t.startsWith('-'));
      if (!script) return `${v} sin script`;
      if (v === 'node' && !/\.(mjs|cjs|js)$/i.test(script)) return 'node solo sobre un .mjs/.js';
      // python del entorno de CAD y node sobre scripts propios: el archivo vive en el repo o en la carpeta de trabajo
      const abs = path.resolve(carpeta ? path.join(carpeta, 'trabajo') : RAIZ, script);
      if (!dentroDe(abs, RAIZ) && !(carpeta && dentroDe(abs, carpeta))) return `${script} no esta en el repo ni en la carpeta de trabajo`;
      continue;
    }
    return `"${v}" no esta en la lista blanca (${[...VERBOS].join(', ')}, git de lectura, python/node sobre un archivo)`;
  }
  return null;
}

const PROHIBIDO = [
  [/supabase/i, 'Supabase'], [/Outlook\.Application|olMailItem|\.Send\s*\(/i, 'Outlook'],
  [/\btaskkill\b|Stop-Process|os\.kill\b|\.kill\s*\(|\bp?kill\b/i, 'matar procesos'],
  [/produc\.exe|\barb\b/i, 'el arb'], [/\\\\[\w.-]+\\|\/\/servidor/i, 'una ruta de red'],
  [/\b(requests|urllib3?|http\.client|httpx|aiohttp|socket|fetch|axios|undici)\b/i, 'salir a la red'],
  [/\.env(\.[\w.-]+)?\b|\.qr-secret|ANTHROPIC_API_KEY/i, 'secretos'], [/\bclaude\s+-p\b|claude\.exe/i, 'lanzar claude'],
];
/** Lo que no puede traer un archivo que el agente escribe o ejecuta (patrones de candadosNocturno + propios). Motivo o null. */
export function escanear(texto) {
  for (const [re, que] of PROHIBIDO) { const m = re.exec(String(texto ?? '')); if (m) return `${que} ("${m[0]}")`; }
  return null;
}

/** Cabeza y cola para el modelo; en el medio, donde esta la salida completa (diseño §2: rinde mas que cambiar de modelo). */
export function recortar(texto, ruta, tope = RECORTE_BYTES) {
  const t = String(texto ?? '');
  const bytes = Buffer.byteLength(t);
  if (bytes <= tope) return t;
  const m = Math.floor(tope / 2);
  return `${t.slice(0, m)}\n[... recortado: ${bytes} bytes en total; la salida completa esta en ${ruta} (leer_archivo por tramos) ...]\n${t.slice(-m)}`;
}

/** Tapa claves, JWT y lineas de .env ANTES de que un texto vaya al modelo o al registro. */
export function tapar(texto) {
  return String(texto ?? '')
    .replace(/sk-ant-[\w-]{8,}/g, 'sk-ant-***')
    .replace(/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{5,}/g, 'JWT***')
    .replace(/^(\s*[\w.-]*(KEY|TOKEN|SECRET|PASSWORD|PASS)[\w.-]*\s*[=:]).*$/gim, '$1 ***');
}

/** El entorno de los procesos hijos, sin la clave ni los secretos de la casa (diseño §4). */
export const entornoLimpio = (env = process.env) => Object.fromEntries(Object.entries(env).filter(([k]) => !/^ANTHROPIC_API_KEY|^SUPABASE|TOKEN|SECRET|PASSWORD/i.test(k)));

/** El motivo del corte si NO hay que hacer la proxima llamada, null si se puede. Puro: se chequea antes de pagar. */
export function chequearTopes(estado, topes, { modelo, maxTokens, ahora }) {
  if (estado.paso >= topes.pasos) return `pasos: ${estado.paso} de ${topes.pasos}`;
  const min = (ahora - estado.inicio) / 60000;
  if (min >= topes.minutos) return `tiempo: ${Math.round(min)} min de ${topes.minutos}`;
  // el proximo turno, estimado por arriba: toda la ultima entrada a precio de cache + max_tokens de salida
  const proximo = costoUsd(modelo, { cache_read_input_tokens: estado.ultimaEntrada, output_tokens: maxTokens });
  if (estado.gastadoUsd + proximo > topes.dolares) return `dolares: ${usd(estado.gastadoUsd)} gastados + ${usd(proximo)} del proximo turno pasan el tope ${usd(topes.dolares)}`;
  return null;
}

/**
 * El guardian de la casa: arma el JSON que ve el hook PreToolUse (tool_name + tool_input + cwd) y corre los
 * guardianes de esa herramienta sin marcar recordatorios. Motivo (primera linea de cada bloqueo) o null.
 */
export async function guardianReal(herramienta, entrada, cwd) {
  const { evaluar } = await import('./guardianes.mjs');
  const { res } = evaluar(JSON.stringify({ tool_name: herramienta, tool_input: entrada, cwd, session_id: 'agente-api' }), { marcar: false });
  return res.bloqueos.length ? res.bloqueos.map((b) => `${b.guardian}: ${b.texto.trim().split('\n')[0]}`).join(' | ') : null;
}

/** La politica de cada herramienta ANTES de ejecutarla: motivo del bloqueo o null. `guardian` es el de la casa o uno inyectado. */
export async function permitir(nombre, entrada, { carpeta, guardian }) {
  const e = entrada && typeof entrada === 'object' ? entrada : {};
  const trabajo = path.join(carpeta, 'trabajo');
  const abs = path.resolve(trabajo, String(e.ruta ?? ''));
  const legible = () => (esSecreto(abs) ? `${e.ruta} es un archivo de secretos` : !dentroDe(abs, RAIZ) && !dentroDe(abs, carpeta) ? `${e.ruta} esta fuera del repo y de la carpeta de trabajo` : null);
  switch (nombre) {
    case 'leer_archivo': return legible();
    case 'leer_pdf': return legible() ?? (Array.isArray(e.paginas) && e.paginas.length > 20 ? 'hasta 20 paginas por lectura' : null);
    case 'escribir_archivo': {
      if (!dentroDe(abs, trabajo)) return `${e.ruta} esta fuera de la carpeta de trabajo (${trabajo})`;
      if (esSecreto(abs)) return `${e.ruta} es un archivo de secretos`;
      const mal = escanear(e.texto);
      return mal ? `el texto trae ${mal}` : guardian('Write', { file_path: abs, content: String(e.texto ?? '') }, trabajo);
    }
    case 'correr_comando': {
      const seg = n(e.segundos ?? 120);
      if (seg <= 0 || seg > COMANDO_MAX_S) return `segundos: entre 1 y ${COMANDO_MAX_S}`;
      return comandoPermitido(e.cmd, { carpeta }) ?? guardian('Bash', { command: String(e.cmd ?? '') }, trabajo);
    }
    case 'terminar': return typeof e.resumen === 'string' && e.resumen.trim() ? null : 'terminar pide un resumen';
    default: return `herramienta desconocida: ${nombre}`;
  }
}

// ── registro: una linea JSONL por paso, la salida completa aparte, mensajes.json al cerrar ───────────────

/** En disco (.sgc-cache/agente/<corrida>/), por la puerta segura. `escribirFs`/`agregarFs` se inyectan en los tests. */
export function registroEnDisco(dir, { escribirFs = escribirSeguro, agregarFs = agregarSeguro } = {}) {
  const lineas = [];
  return {
    dir, lineas,
    agregar(linea) { lineas.push(linea); agregarFs(path.join(dir, 'registro.jsonl'), `${JSON.stringify(linea)}\n`); },
    guardarSalida(paso, k, texto) { const r = path.join(dir, 'salidas', `paso-${paso}-${k}.txt`); escribirFs(r, texto); return r; },
    cerrar(cierre) { escribirFs(path.join(dir, 'mensajes.json'), JSON.stringify(cierre, null, 1)); },
  };
}

/** El mismo contrato, en memoria: para los tests. */
export function registroEnMemoria() {
  const lineas = [], salidas = {};
  return {
    lineas, salidas, cierre: null,
    agregar(linea) { lineas.push(linea); },
    guardarSalida(paso, k, texto) { const r = `memoria:paso-${paso}-${k}`; salidas[r] = texto; return r; },
    cerrar(cierre) { this.cierre = cierre; },
  };
}

// ── dobles para pruebas sin red (los usa --seco y el test) ─────────────────────

let nUso = 0;
/** Un bloque tool_use como el que manda el modelo. */
export const usoDe = (name, input) => ({ type: 'tool_use', id: `toolu_${++nUso}`, name, input });

/** Un cliente que contesta de un guion: `respuestas[i]` = { content, stop_reason?, usage? } del turno i. Anota cada pedido. */
export function clienteGuion(respuestas, usage = { input_tokens: 1000, output_tokens: 200 }) {
  const llamadas = [];
  const create = async (params) => {
    llamadas.push(JSON.parse(JSON.stringify(params)));   // copia (params es JSON puro): el historial se sigue mutando despues
    const r = respuestas[llamadas.length - 1] ?? { stop_reason: 'end_turn', content: [{ type: 'text', text: 'se acabo el guion' }] };
    return { id: `guion-${llamadas.length}`, model: params.model, stop_reason: r.stop_reason ?? 'tool_use', content: r.content, usage: r.usage ?? usage };
  };
  return { llamadas, beta: { messages: { create } }, messages: { create } };
}

/** Un ejecutor que no toca nada: anota el pedido y devuelve un texto de mentira. */
export function ejecutorSeco() {
  const pedidos = [];
  const anota = (herramienta) => async (entrada) => { pedidos.push({ herramienta, entrada }); return { texto: `[seco] ${herramienta} ${JSON.stringify(entrada)}`, codigo: 0 }; };
  return { pedidos, leer_archivo: anota('leer_archivo'), escribir_archivo: anota('escribir_archivo'), correr_comando: anota('correr_comando'), leer_pdf: anota('leer_pdf') };
}

// ── el ejecutor de verdad (Windows 11 + Git Bash + Python) ─────────────────────

const matarArbol = (pid) => {
  // en Windows, taskkill /T mata el arbol del hijo; CATIA abierta por COM no es hija y queda viva (diseño §5)
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
  else try { process.kill(pid, 'SIGKILL'); } catch { /* ya murio */ }
};

/** Corre `cmd` con bash en `cwd`, junta stdout+stderr (hasta 1 MB) y corta a los `segundos` sin dejar procesos colgados. */
export function correrBash(cmd, { cwd, segundos = 120, env = entornoLimpio(), bash = 'bash' } = {}) {
  return new Promise((resolve) => {
    const hijo = spawn(bash, ['-c', String(cmd)], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let salida = '', cortado = false;
    const junta = (d) => { if (salida.length < 1e6) salida += d; };
    hijo.stdout.setEncoding('utf8').on('data', junta);
    hijo.stderr.setEncoding('utf8').on('data', junta);
    const reloj = setTimeout(() => { cortado = true; matarArbol(hijo.pid); }, segundos * 1000);
    hijo.on('error', (e) => { clearTimeout(reloj); resolve({ texto: `no se pudo lanzar ${bash}: ${e.message}`, codigo: 127 }); });
    hijo.on('close', (codigo) => { clearTimeout(reloj); resolve({ texto: cortado ? `${salida}\n[CORTADO a los ${segundos} s: tope de tiempo]` : salida, codigo: cortado ? 124 : (codigo ?? 1) }); });
  });
}

/** El ejecutor real: lee del repo o de la carpeta, escribe por la puerta segura, corre bash con tope y lee PDF con python. */
export function ejecutorReal({ carpeta, env = process.env, escribir = escribirSeguro, python = 'python', bash = 'bash' }) {
  const trabajo = path.join(carpeta, 'trabajo');
  const abs = (r) => path.resolve(trabajo, String(r ?? ''));
  return {
    async leer_archivo({ ruta, desde, hasta }) {
      const lineas = fs.readFileSync(abs(ruta), 'utf8').split('\n');
      const d = Math.max(1, n(desde) || 1), h2 = Math.min(lineas.length, n(hasta) || lineas.length);
      const tramo = lineas.slice(d - 1, h2).join('\n');
      if (Buffer.byteLength(tramo) <= LECTURA_MAX_BYTES) return { texto: tramo, codigo: 0 };
      return { texto: `${tramo.slice(0, LECTURA_MAX_BYTES)}\n[... cortado a ${LECTURA_MAX_BYTES} bytes: el archivo tiene ${lineas.length} lineas, pedi un tramo mas chico con desde/hasta ...]`, codigo: 0 };
    },
    async escribir_archivo({ ruta, texto }) {
      const t = String(texto ?? '');
      escribir(abs(ruta), t);
      return { texto: `escrito ${path.relative(trabajo, abs(ruta))} (${Buffer.byteLength(t)} bytes)`, codigo: 0 };
    },
    async correr_comando({ cmd, segundos }) {
      // lo que el comando va a EJECUTAR se escanea antes: el guardian lee el texto del comando, no lo que hace un .py (diseño §1)
      for (const tok of String(cmd ?? '').match(/[^\s"']+\.(py|mjs|cjs|js|sh)\b/gi) ?? []) {
        if (!fs.existsSync(abs(tok))) continue;
        const mal = escanear(fs.readFileSync(abs(tok), 'utf8'));
        if (mal) throw new Bloqueo(`${tok} trae ${mal}`);
      }
      return correrBash(cmd, { cwd: trabajo, segundos: Math.min(n(segundos) || 120, COMANDO_MAX_S), env: entornoLimpio(env), bash });
    },
    async leer_pdf({ ruta, paginas }) {
      // A VERIFICAR: pypdf en el python de la PC. La imagen de la pagina queda para otro commit.
      const prog = 'import sys,json\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1]);p=json.loads(sys.argv[2]) or range(1,min(len(r.pages),20)+1)\nprint("\\n".join(f"--- pagina {i} de {len(r.pages)} ---\\n"+(r.pages[i-1].extract_text() or "") for i in p))';
      const r = spawnSync(python, ['-c', prog, abs(ruta), JSON.stringify(paginas ?? [])], { encoding: 'utf8', env: entornoLimpio(env), timeout: 120000, windowsHide: true });
      return { texto: r.status === 0 ? r.stdout : `${r.stdout ?? ''}\n${r.stderr ?? ''}`, codigo: r.status ?? 1 };
    },
  };
}

// ── el bucle ──────────────────────────────────────────────────────────────────

/** Cache incremental: una sola marca, en el ultimo bloque del ultimo mensaje de usuario (5 min; el system lleva 1 h). */
function marcarCache(mensajes) {
  for (const m of mensajes) for (const b of (Array.isArray(m.content) ? m.content : [])) delete b.cache_control;
  const u = mensajes[mensajes.length - 1];
  if (u.role === 'user' && Array.isArray(u.content) && u.content.length) u.content[u.content.length - 1].cache_control = { type: 'ephemeral' };
}

/** Ejecuta un tool_use: politica -> ejecutor -> tapador -> salida completa a disco -> recorte para el modelo. Nunca tira. */
async function ejecutarHerramienta(uso, paso, k, ctx) {
  const t0 = ctx.ahora();
  const reg = { k, herramienta: uso.name, entrada: tapar(JSON.stringify(uso.input ?? {})).slice(0, 600), veredicto: 'permitido' };
  const fin = (contenido, esError) => ({ contenido, esError, registro: { ...reg, duracionMs: ctx.ahora() - t0 } });
  const bloqueado = (motivo) => { reg.veredicto = 'bloqueado'; reg.motivo = motivo; return fin(`BLOQUEADO: ${motivo}. No reintentar`, true); };
  try {
    const motivo = await permitir(uso.name, uso.input, ctx);
    if (motivo) return bloqueado(motivo);
    const s = uso.name === 'terminar' ? { texto: 'ok: corrida terminada', codigo: 0 } : await ctx.ejecutor[uso.name](uso.input ?? {});
    const texto = tapar(s?.texto ?? '');
    Object.assign(reg, { codigo: s?.codigo ?? 0, bytes: Buffer.byteLength(texto), sha256: sha256(texto), salida: ctx.registro.guardarSalida(paso, k, texto) });
    return fin(recortar(texto, reg.salida), reg.codigo !== 0);
  } catch (e) {
    if (e instanceof Bloqueo) return bloqueado(e.message);
    reg.veredicto = 'error'; reg.motivo = tapar(e?.message ?? e);
    return fin(`ERROR: ${reg.motivo}`, true);
  }
}

const registrarEnLedger = (r, tarea) => registrarGasto(r, { tarea });

/**
 * Un paso = una llamada al modelo; sus tool_use se ejecutan en orden y los tool_result vuelven en UN mensaje
 * de usuario. `res.content` entra integro al historial (thinking, server_tool_use, web_search_tool_result).
 * `terminado` solo si el modelo llamo a terminar(); si no, `corte` dice por que se paro.
 */
export async function correrAgente({
  cliente, modelo = 'sonnet', effort = 'high', system, encargo, carpeta, corrida = 'sin-nombre', ejecutor, registro,
  topes = {}, maxTokens = 8192, guardian = guardianReal, registrar = registrarEnLedger, ahora = () => Date.now(),
}) {
  const t = { ...TOPES_DEFECTO, ...topes };
  const id = resolverModelo(modelo);
  const mensajes = [{ role: 'user', content: [{ type: 'text', text: String(encargo ?? '') }] }];
  const estado = {
    corrida, modelo: id, paso: 0, gastadoUsd: 0, busquedas: 0, bloqueos: 0, sinTerminar: 0, corte: null, entregable: null, resumen: null,
    inicio: ahora(), ultimaEntrada: Math.ceil((textoDe(system).length + String(encargo ?? '').length) / CARACTERES_POR_TOKEN),
  };
  const ctx = { carpeta, guardian, ejecutor, registro, ahora };
  for (;;) {
    const freno = chequearTopes(estado, t, { modelo: id, maxTokens, ahora: ahora() });
    if (freno) { estado.corte = freno; break; }
    marcarCache(mensajes);
    const { params } = armarParametros({ modelo: id, system, mensajes, maxTokens, effort, cacheTtl: '1h', fallbacks: false });
    params.tools = armarHerramientas(t.busquedas);
    const t0 = ahora();
    let res;
    try { res = await cliente.beta.messages.create(params); } catch (e) { estado.corte = `api: ${tapar(e?.message ?? e)}`; break; }
    const r = interpretarRespuesta(res, { modelo: id, duracionMs: ahora() - t0 });
    const busq = n(r.usage?.server_tool_use?.web_search_requests);
    const costo = Math.round((r.costoUsd + busq * PRECIO_BUSQUEDA_USD) * 1e6) / 1e6;   // costoUsd ignora las busquedas: se suman aca
    estado.paso++; estado.gastadoUsd = Math.round((estado.gastadoUsd + costo) * 1e6) / 1e6; estado.busquedas += busq;
    estado.ultimaEntrada = tokensEntrada(r.usage);
    registrar({ ...r, costoUsd: costo }, `agente:${corrida}`);
    const contenido = Array.isArray(res?.content) ? res.content : [];
    mensajes.push({ role: 'assistant', content: contenido });
    const linea = { n: estado.paso, hora: selloLocal(new Date(ahora())), modelo: r.modeloRespuesta ?? id, stop: r.stopReason, duracionMs: r.duracionMs, busquedas: busq, costoUsd: costo, acumuladoUsd: estado.gastadoUsd, herramientas: [] };
    if (r.rechazo) estado.corte = `rechazo de la API (${r.rechazo.categoria ?? 'sin categoria'})`;
    else if (r.truncado) estado.corte = `respuesta truncada por max_tokens (${maxTokens})`;
    else if (r.stopReason !== 'pause_turn') {   // pause_turn: se reenvia tal cual, sin agregar nada
      const usos = contenido.filter((b) => b?.type === 'tool_use');
      if (!usos.length) {
        if (++estado.sinTerminar >= 2) estado.corte = 'dos end_turn sin terminar()';
        else mensajes.push({ role: 'user', content: [{ type: 'text', text: RECORDATORIO }] });
      } else {
        const resultados = [];
        for (const [i, u] of usos.entries()) {
          const ej = await ejecutarHerramienta(u, estado.paso, i + 1, ctx);
          linea.herramientas.push(ej.registro);
          resultados.push({ type: 'tool_result', tool_use_id: u.id, content: ej.contenido, ...(ej.esError ? { is_error: true } : {}) });
          if (ej.registro.veredicto === 'bloqueado' && ++estado.bloqueos >= 2) estado.corte = 'dos bloqueos del guardian';
          if (u.name === 'terminar' && ej.registro.veredicto === 'permitido') Object.assign(estado, { corte: 'terminado', entregable: u.input?.entregable ?? null, resumen: u.input?.resumen ?? null });
        }
        if (!estado.corte) mensajes.push({ role: 'user', content: resultados });
      }
    }
    registro.agregar(linea);
    if (estado.corte) break;
  }
  estado.duracionMs = ahora() - estado.inicio;
  registro.cerrar?.({ estado, mensajes });
  return { ...estado, mensajes, terminado: estado.corte === 'terminado' };
}
