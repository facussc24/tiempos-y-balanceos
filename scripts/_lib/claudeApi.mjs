/**
 * claudeApi.mjs — la UNICA puerta del repo a la API de Anthropic (los creditos del plan Max).
 *
 * POR QUE EXISTE (08/10/2026). El plan Max trae creditos para la API ($100 el Max 5x, $200 el Max
 * 20x) que vencen al final de cada CICLO DE FACTURACION (no el dia 1 del mes) y NO se pueden gastar
 * en Claude Code: solo se gastan con una clave de API de la organizacion vinculada al plan
 * (platform.claude.com, "Promotional credits"). Lo que Fak hace en Claude Code sigue saliendo del
 * plan, no de aca. Este modulo
 * concentra lo que hace falta para que los scripts del repo los usen bien y sin sorpresas:
 *   - los modelos y sus roles (Opus orquesta y sintetiza; Sonnet implementa; Haiku hace volumen;
 *     Fable solo para deliberar a pedido), con los precios OFICIALES para calcular el gasto;
 *   - la clave (ANTHROPIC_API_KEY, del entorno o de .env.local; nunca se imprime);
 *   - el armado del pedido: cache de prompt, esfuerzo, salida en JSON con esquema y el fallback
 *     del lado del servidor cuando un clasificador rechaza (no existe para Haiku);
 *   - el ledger de gasto en .sgc-cache/api/ledger_AAAA-MM.jsonl (fuera de git; se escribe solo por
 *     escrituraSegura.mjs) y el semaforo contra el presupuesto del CICLO de facturacion
 *     (BARACK_API_PRESUPUESTO_USD, por defecto 170 = el credito del Max 20x con 15 % de colchon;
 *     BARACK_API_CICLO_DIA = dia del mes en que se renueva, por defecto 1) y el tope de gasto de UNA
 *     corrida de la noche (BARACK_API_TOPE_CORRIDA_USD, por defecto 8);
 *   - lotes (Message Batches, mitad de precio) y el patron orquestador-workers (mapaReduce).
 *
 * CANDADOS. Este modulo NO toca Supabase, ni el arb, ni Outlook: habla con la API y escribe el
 * ledger. Un rechazo (stop_reason "refusal"), una salida cortada por max_tokens o un JSON que no
 * parsea se tiran como ErrorApi: el que llama decide, nunca se sigue con una respuesta a medias.
 *
 * Fuentes: platform.claude.com/docs/en/about-claude/pricing (leida el 08/10/2026),
 * platform.claude.com/docs/en/about-claude/api-credits-for-subscribers y el skill claude-api.
 *
 * Uso (desde otro script):
 *   import { crearCliente, llamar, MODELOS } from './_lib/claudeApi.mjs';
 *   const cliente = crearCliente();                       // tira ErrorApi 'sin_clave' si falta la clave
 *   const r = await llamar(cliente, { modelo: 'haiku', usuario: 'Responde OK', maxTokens: 50, tarea: 'prueba' });
 *   r.texto, r.costoUsd, r.usage
 *
 * Lo puro (precios, armado del pedido, interpretacion de la respuesta, ledger) no necesita red y
 * se prueba en __tests__/scripts/claudeApi.test.mjs con un cliente de mentira.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { agregarSeguro } from './escrituraSegura.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');

/** Donde queda el ledger y el estado de la API. Fuera de git (.sgc-cache/ esta en .gitignore). */
export const DIR_API = process.env.BARACK_API_DIR || path.join(RAIZ, '.sgc-cache', 'api');

// ─────────────────────────────────────────────────────────────────────────────
// Modelos, roles y precios
// ─────────────────────────────────────────────────────────────────────────────

/** Alias cortos -> id exacto del modelo (los ids van completos, sin fecha). */
export const MODELOS = Object.freeze({
  opus: 'claude-opus-5-5',
  sonnet: 'claude-sonnet-5-5',
  haiku: 'claude-haiku-5-5',
  fable: 'claude-fable-5-1',
});

/**
 * Quien hace que (arquitectura orquestador-workers, "Building Effective Agents" de Anthropic):
 * Opus decide, revisa y sintetiza; Sonnet escribe y revisa documentos; Haiku lee volumen barato;
 * Fable solo cuando hace falta deliberar de verdad (cuesta 2,5x Opus).
 */
export const ROLES = Object.freeze({
  orquestador: MODELOS.opus,
  revisor: MODELOS.sonnet,
  volumen: MODELOS.haiku,
  deliberador: MODELOS.fable,
});

/**
 * USD por millon de tokens — tabla oficial, leida el 08/10/2026. Si cambia, se cambia ACA y el
 * ledger de ahi en mas sale con el precio nuevo (lo ya registrado conserva el suyo).
 * Haiku 5.5 cobra mas caro los pedidos de mas de 100.000 tokens (`masDe100k`).
 */
export const PRECIOS = Object.freeze({
  'claude-opus-5-5': { entrada: 4, salida: 20, cacheLectura: 0.20, cacheEscritura5m: 5, cacheEscritura1h: 8 },
  'claude-sonnet-5-5': { entrada: 2, salida: 10, cacheLectura: 0.10, cacheEscritura5m: 2.5, cacheEscritura1h: 4 },
  'claude-haiku-5-5': {
    entrada: 0.10, salida: 0.50, cacheLectura: 0.01, cacheEscritura5m: 0.125, cacheEscritura1h: 0.20,
    masDe100k: { entrada: 0.50, salida: 2.50, cacheLectura: 0.05, cacheEscritura5m: 0.625, cacheEscritura1h: 1 },
  },
  'claude-fable-5-1': { entrada: 10, salida: 50, cacheLectura: 0.25, cacheEscritura5m: 12.5, cacheEscritura1h: 20 },
});

/** Los lotes (Message Batches) cobran la mitad en entrada y salida. */
export const DESCUENTO_LOTE = 0.5;

/** Cabecera beta del fallback "default" (el servidor elige el modelo segun el motivo del rechazo). */
export const BETA_FALLBACK = 'server-side-fallback-2026-07-01';

/** Error propio: `tipo` dice que paso (sin_clave | rechazo | truncado | json | modelo | lote | api). */
export class ErrorApi extends Error {
  constructor(tipo, mensaje, detalle = {}) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.tipo = tipo;
    Object.assign(this, detalle);
  }
}

/** 'haiku' -> 'claude-haiku-5-5'; un id completo pasa tal cual; otra cosa es error. */
export function resolverModelo(modelo) {
  const m = String(modelo ?? '').trim();
  if (MODELOS[m]) return MODELOS[m];
  if (PRECIOS[m]) return m;
  throw new ErrorApi('modelo', `modelo desconocido: "${modelo}". Vale uno de ${Object.keys(MODELOS).join(', ')} o su id completo.`);
}

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Cuanto costo una respuesta, en USD, a partir de su `usage`. Separa la escritura de cache de 5
 * minutos de la de 1 hora (usage.cache_creation) y aplica la tarifa larga de Haiku si el pedido
 * paso los 100.000 tokens. `lote` aplica el 50 % de los Message Batches.
 */
export function costoUsd(modelo, usage, { lote = false } = {}) {
  const id = resolverModelo(modelo);
  const u = usage || {};
  const entrada = n(u.input_tokens);
  const salida = n(u.output_tokens);
  const lectura = n(u.cache_read_input_tokens);
  const esc = u.cache_creation || {};
  const esc1h = n(esc.ephemeral_1h_input_tokens);
  const esc5m = esc.ephemeral_5m_input_tokens != null
    ? n(esc.ephemeral_5m_input_tokens)
    : Math.max(0, n(u.cache_creation_input_tokens) - esc1h);
  let p = PRECIOS[id];
  if (p.masDe100k && entrada + lectura + esc5m + esc1h > 100000) p = p.masDe100k;
  let usd = (entrada * p.entrada + salida * p.salida + lectura * p.cacheLectura
    + esc5m * p.cacheEscritura5m + esc1h * p.cacheEscritura1h) / 1e6;
  if (lote) usd *= DESCUENTO_LOTE;
  return Math.round(usd * 1e6) / 1e6;
}

/** Estimacion ANTES de llamar: tokens de entrada y una salida supuesta. Para `--simular`. */
export function estimarUsd(modelo, { entrada = 0, salida = 0, lote = false } = {}) {
  return costoUsd(modelo, { input_tokens: entrada, output_tokens: salida }, { lote });
}

// ─────────────────────────────────────────────────────────────────────────────
// La clave y el cliente
// ─────────────────────────────────────────────────────────────────────────────

/** Lee un .env como diccionario (misma forma que loadEnv de amfeIo: lineas clave=valor, # comenta). */
export function leerEnv(ruta) {
  let texto;
  try { texto = fs.readFileSync(ruta, 'utf8'); } catch { return {}; }
  const env = {};
  for (const l of texto.split('\n')) {
    const linea = l.replace(/\r$/, '');
    if (!linea.includes('=') || linea.trimStart().startsWith('#')) continue;
    const i = linea.indexOf('=');
    env[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
  }
  return env;
}

export const MENSAJE_SIN_CLAVE = [
  'Falta la clave de la API de Anthropic (ANTHROPIC_API_KEY).',
  'Como se consigue (lo hace Fak, una sola vez):',
  '  1. En claude.ai: Configuracion > Facturacion > "API credits" > Vincular organizacion (la del plan Max).',
  '  2. En platform.claude.com, en esa organizacion: API Keys > crear una clave.',
  '  3. En la terminal del repo:  node scripts/_claude.mjs --pegar-clave  (abre un cuadro; se pega ahi y va directo a .env.local, sin pasar por el chat).',
  'Con eso los scripts gastan los creditos del mes; Claude Code sigue igual, no usa esta clave.',
].join('\n');

/** 'AAAAMMDD' local de una fecha (para comparar vencimientos sin horas ni zonas). */
const aaaammdd = (f) => `${f.getFullYear()}${p2(f.getMonth() + 1)}${p2(f.getDate())}`;

/**
 * La clave activa, con su origen. Desde el 09/10/2026 puede haber mas de una: ademas de
 * `ANTHROPIC_API_KEY` (la principal, la del plan de Fak), lineas `ANTHROPIC_API_KEY_HASTA_AAAAMMDD=...`
 * con claves prestadas que vencen ese dia (la del dueno de la empresa, $100 hasta el 20/10/2026).
 * Regla: se gasta primero la que vence antes, mientras no haya vencido; vencida, se sigue con la
 * principal sin tocar nada. El entorno (`ANTHROPIC_API_KEY`) le gana a todo, como siempre.
 * Devuelve { clave, origen: 'entorno'|'secundaria'|'principal'|null, hasta: 'AAAAMMDD'|null }.
 * NUNCA se imprime ni se loguea la clave (el secretos-guard frena los comandos que la leerian).
 */
export function claveActiva({ env = process.env, archivoEnv = path.join(RAIZ, '.env.local'), hoy = new Date() } = {}) {
  const directa = String(env.ANTHROPIC_API_KEY ?? '').trim();
  if (directa) return { clave: directa, origen: 'entorno', hasta: null };
  const local = leerEnv(archivoEnv);
  const limite = aaaammdd(hoy);
  const prestadas = Object.entries(local)
    .map(([k, v]) => ({ m: /^ANTHROPIC_API_KEY_HASTA_(\d{8})$/.exec(k), clave: String(v ?? '').trim() }))
    .filter((x) => x.m && x.clave && x.m[1] >= limite)
    .map((x) => ({ clave: x.clave, hasta: x.m[1] }))
    .sort((a, b) => a.hasta.localeCompare(b.hasta));
  if (prestadas.length) return { clave: prestadas[0].clave, origen: 'secundaria', hasta: prestadas[0].hasta };
  const principal = String(local.ANTHROPIC_API_KEY ?? '').trim();
  return principal ? { clave: principal, origen: 'principal', hasta: null } : { clave: null, origen: null, hasta: null };
}

/** La clave: del entorno, o de .env.local (la prestada vigente primero). Devuelve null si no hay. */
export function leerClave(opciones = {}) {
  return claveActiva(opciones).clave;
}

/**
 * El cliente del SDK oficial. Tira ErrorApi 'sin_clave' con las instrucciones si no hay clave.
 * `timeoutMs` alto porque las revisiones largas con Opus pueden tardar minutos.
 */
export function crearCliente({ apiKey, timeoutMs = 10 * 60 * 1000, maxRetries = 3, env = process.env } = {}) {
  const clave = apiKey ?? leerClave({ env });
  if (!clave) throw new ErrorApi('sin_clave', MENSAJE_SIN_CLAVE);
  return new Anthropic({ apiKey: clave, timeout: timeoutMs, maxRetries });
}

// ─────────────────────────────────────────────────────────────────────────────
// Armar el pedido (puro) e interpretar la respuesta (puro)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Arma los parametros de un pedido a /v1/messages. No llama a nada.
 *
 *   modelo     'opus' | 'sonnet' | 'haiku' | 'fable' | id completo
 *   system     texto o lista de bloques {type:'text', text}; estable y adelante, para el cache
 *   usuario    el mensaje del usuario (texto o bloques), o `mensajes` ya armados
 *   maxTokens  por defecto 16000 (una respuesta cortada por el tope es un error, no un resultado)
 *   effort     'low'|'medium'|'high'|'xhigh'|'max' (Opus 5.5 arranca en medium: se pone explicito)
 *   cacheTtl   '5m' | '1h' | null — marca el ULTIMO bloque del system para que se reuse entre pedidos
 *              (el minimo cacheable es 512 tokens; un system mas corto no se cachea y no pasa nada)
 *   schema     JSON Schema (objeto) -> la respuesta sale como JSON valido de esa forma
 *   fallbacks  true/false; por defecto true salvo Haiku, que no lo tiene. Con true el pedido va con
 *              la beta del fallback "default": si un clasificador rechaza, el servidor reintenta en
 *              otro modelo en vez de devolver el rechazo.
 *
 * El `thinking` se omite: en los cuatro modelos es adaptativo por defecto y el esfuerzo lo gobierna.
 */
export function armarParametros({
  modelo, system, usuario, mensajes, maxTokens = 16000, effort, cacheTtl = null, schema, fallbacks,
} = {}) {
  const id = resolverModelo(modelo);
  if (!mensajes && usuario == null) throw new ErrorApi('api', 'armarParametros: falta `usuario` o `mensajes`');
  const params = {
    model: id,
    max_tokens: maxTokens,
    messages: mensajes ?? [{ role: 'user', content: usuario }],
  };
  if (system) {
    const bloques = (Array.isArray(system) ? system : [{ type: 'text', text: String(system) }])
      .map((b) => ({ ...b }));
    if (cacheTtl && bloques.length) {
      bloques[bloques.length - 1].cache_control = cacheTtl === '1h' ? { type: 'ephemeral', ttl: '1h' } : { type: 'ephemeral' };
    }
    params.system = bloques;
  }
  const salida = {};
  if (effort) salida.effort = effort;
  if (schema) salida.format = { type: 'json_schema', schema };
  if (Object.keys(salida).length) params.output_config = salida;

  const betas = [];
  const conFallback = fallbacks ?? (id !== MODELOS.haiku);
  if (conFallback && id !== MODELOS.haiku) {
    params.fallbacks = 'default';
    betas.push(BETA_FALLBACK);
  }
  return { params, betas, conSchema: !!schema };
}

/**
 * De la respuesta cruda a lo que usan los scripts: texto, JSON (si se pidio esquema), usage,
 * costo. No tira: deja `rechazo`, `truncado` o `jsonInvalido` para que `llamar` decida.
 */
export function interpretarRespuesta(res, { modelo, conSchema = false, lote = false, duracionMs = 0 } = {}) {
  const contenido = Array.isArray(res?.content) ? res.content : [];
  const texto = contenido.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n').trim();
  const usage = res?.usage || {};
  // El servidor puede contestar con un id que la tabla no conoce (09/10/2026: un pedido a Opus volvio como
  // "claude-opus-4-8" por el fallback del servidor y resolverModelo() tiraba DESPUES de pagar, sin ledger).
  // Se cobra como el modelo pedido y el id real queda en `modeloRespuesta` para que se vea.
  let idModelo;
  try { idModelo = resolverModelo(res?.model || modelo); } catch { idModelo = resolverModelo(modelo); }
  const r = {
    id: res?.id ?? null,
    modelo: idModelo,
    modeloRespuesta: res?.model ?? null,
    stopReason: res?.stop_reason ?? null,
    texto,
    json: null,
    usage,
    costoUsd: costoUsd(idModelo, usage, { lote }),
    duracionMs,
    rechazo: null,
    truncado: res?.stop_reason === 'max_tokens',
    jsonInvalido: false,
    fallback: contenido.filter((b) => b && b.type === 'fallback').map((b) => `${b.from?.model ?? '?'} -> ${b.to?.model ?? '?'}`),
  };
  if (res?.stop_reason === 'refusal') {
    r.rechazo = { categoria: res?.stop_details?.category ?? null, explicacion: res?.stop_details?.explanation ?? null };
  }
  if (conSchema && !r.rechazo && !r.truncado) {
    try { r.json = JSON.parse(texto); } catch { r.jsonInvalido = true; }
  }
  return r;
}

/** Tira ErrorApi si la respuesta no sirve (rechazo, cortada, JSON invalido). Devuelve la misma respuesta si sirve. */
export function exigirRespuestaUtil(r, { tarea = '' } = {}) {
  const donde = tarea ? ` (${tarea})` : '';
  if (r.rechazo) {
    throw new ErrorApi('rechazo', `la API rechazo el pedido${donde}: categoria ${r.rechazo.categoria ?? 'sin categoria'}. No se sigue con una respuesta vacia.`, { respuesta: r });
  }
  if (r.truncado) {
    throw new ErrorApi('truncado', `la respuesta se corto por max_tokens${donde}: subir maxTokens en vez de usar un resultado a medias.`, { respuesta: r });
  }
  if (r.jsonInvalido) {
    throw new ErrorApi('json', `la respuesta no es el JSON pedido${donde}.`, { respuesta: r });
  }
  return r;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ledger de gasto y presupuesto
// ─────────────────────────────────────────────────────────────────────────────

const p2 = (x) => String(x).padStart(2, '0');
/** 'AAAA-MM' en hora LOCAL (los creditos y el dia de Fak son locales; UTC corre un dia a la noche). */
export const mesLocal = (f = new Date()) => `${f.getFullYear()}-${p2(f.getMonth() + 1)}`;
/** ISO local sin zona: '2026-10-08 02:14:03'. */
export const selloLocal = (f = new Date()) => `${f.getFullYear()}-${p2(f.getMonth() + 1)}-${p2(f.getDate())} ${p2(f.getHours())}:${p2(f.getMinutes())}:${p2(f.getSeconds())}`;

export const rutaLedger = (mes = mesLocal(), dir = DIR_API) => path.join(dir, `ledger_${mes}.jsonl`);

/** Agrega una linea al ledger del mes. Devuelve la entrada escrita. */
export function registrarGasto(r, { tarea = '', lote = false, dir = DIR_API, ahora = new Date() } = {}) {
  const u = r.usage || {};
  const entrada = {
    ts: selloLocal(ahora),
    tarea: String(tarea || 'sin-tarea'),
    modelo: r.modelo,
    lote: !!lote,
    entrada: n(u.input_tokens),
    salida: n(u.output_tokens),
    cacheLectura: n(u.cache_read_input_tokens),
    cacheEscritura: n(u.cache_creation_input_tokens),
    costoUsd: r.costoUsd,
    duracionMs: r.duracionMs ?? 0,
    id: r.id ?? null,
    ...(r.fallback && r.fallback.length ? { fallback: r.fallback } : {}),
  };
  // por la puerta segura: el ledger solo puede caer en .sgc-cache (o en la carpeta de BARACK_API_DIR)
  agregarSeguro(rutaLedger(mesLocal(ahora), dir), `${JSON.stringify(entrada)}\n`);
  return entrada;
}

/** Las entradas del ledger de un mes ([] si no hay). Una linea rota se saltea, no tumba la lectura. */
export function leerLedger(mes = mesLocal(), dir = DIR_API) {
  const ruta = rutaLedger(mes, dir);
  if (!fs.existsSync(ruta)) return [];
  const out = [];
  for (const l of fs.readFileSync(ruta, 'utf8').split('\n')) {
    if (!l.trim()) continue;
    try { out.push(JSON.parse(l)); } catch { /* linea rota: se saltea */ }
  }
  return out;
}

/** Totales de un conjunto de entradas: por modelo y por tarea. */
export function resumenLedger(entradas) {
  const r = { llamadas: entradas.length, totalUsd: 0, porModelo: {}, porTarea: {}, desde: null, hasta: null };
  for (const e of entradas) {
    const usd = n(e.costoUsd);
    r.totalUsd += usd;
    const m = (r.porModelo[e.modelo] ||= { llamadas: 0, usd: 0, entrada: 0, salida: 0, cacheLectura: 0 });
    m.llamadas++; m.usd += usd; m.entrada += n(e.entrada); m.salida += n(e.salida); m.cacheLectura += n(e.cacheLectura);
    const t = (r.porTarea[e.tarea || 'sin-tarea'] ||= { llamadas: 0, usd: 0 });
    t.llamadas++; t.usd += usd;
    if (e.ts && (!r.desde || e.ts < r.desde)) r.desde = e.ts;
    if (e.ts && (!r.hasta || e.ts > r.hasta)) r.hasta = e.ts;
  }
  r.totalUsd = Math.round(r.totalUsd * 1e4) / 1e4;
  for (const m of Object.values(r.porModelo)) m.usd = Math.round(m.usd * 1e4) / 1e4;
  for (const t of Object.values(r.porTarea)) t.usd = Math.round(t.usd * 1e4) / 1e4;
  return r;
}

/** Credito del Max 20x ($200 por ciclo) menos 15 % de colchon: las estimaciones de costo tienen +/-30 %. */
export const PRESUPUESTO_DEFECTO_USD = 170;
/** Lo que puede gastar UNA corrida de la noche antes de frenar los pasos que faltan (3 a 5 veces lo normal). */
export const TOPE_CORRIDA_DEFECTO_USD = 8;

const positivo = (v, defecto) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : defecto; };

/** El presupuesto del ciclo en USD: BARACK_API_PRESUPUESTO_USD, o 170 (el credito del Max 20x con colchon). */
export function presupuestoMensualUsd(env = process.env) {
  return positivo(env.BARACK_API_PRESUPUESTO_USD, PRESUPUESTO_DEFECTO_USD);
}

/**
 * El tope de gasto de UNA corrida de la noche: BARACK_API_TOPE_CORRIDA_USD, o 8. Lo lee _nocturno.mjs
 * antes de cada paso. Es aparte del tope del ciclo: este corta una corrida que se descontrola (un bucle,
 * un lote enorme) el mismo dia, no a fin de mes.
 */
export function topeCorridaUsd(env = process.env) {
  return positivo(env.BARACK_API_TOPE_CORRIDA_USD, TOPE_CORRIDA_DEFECTO_USD);
}

/**
 * El dia del mes en que se renueva el ciclo de facturacion: BARACK_API_CICLO_DIA (1 a 31). Sin la
 * variable, o con un valor que no es un dia, 1 (= el mes calendario). Los creditos del plan vencen al
 * final de CADA CICLO, que no empieza el 1 salvo que el plan se haya contratado ese dia.
 */
export function cicloDia(env = process.env) {
  const crudo = String(env.BARACK_API_CICLO_DIA ?? '').trim();
  if (!/^\d{1,2}$/.test(crudo)) return 1;
  const v = Number(crudo);
  return v >= 1 && v <= 31 ? v : 1;
}

const diasDelMes = (anio, mes0) => new Date(anio, mes0 + 1, 0).getDate();
/** Medianoche local del `dia` de ese mes; si el mes es mas corto (31 en febrero), su ultimo dia. */
const inicioEn = (anio, mes0, dia) => new Date(anio, mes0, Math.min(dia, diasDelMes(anio, mes0)));
const diaIso = (f) => `${f.getFullYear()}-${p2(f.getMonth() + 1)}-${p2(f.getDate())}`;
const ddmm = (f) => `${p2(f.getDate())}/${p2(f.getMonth() + 1)}`;

/**
 * El ciclo de facturacion que contiene a `fecha` cuando se renueva el dia `dia`:
 *   { dia, mes: 'AAAA-MM' (el mes en que arranca), desde, hasta (ultimo dia incluido), proximo (primer
 *     dia del ciclo siguiente), texto: 'ciclo del 07/09 al 06/10' }
 * Con dia = 1 es el mes calendario. Un gasto del 28/09 y uno del 03/10 caen en el mismo ciclo si se
 * renueva el 7. Fechas LOCALES: despues de las 21:00 el dia UTC ya es el siguiente.
 */
export function cicloDe(fecha = new Date(), dia = 1) {
  const d = Number.isInteger(dia) && dia >= 1 && dia <= 31 ? dia : 1;
  let desde = inicioEn(fecha.getFullYear(), fecha.getMonth(), d);
  if (fecha < desde) desde = inicioEn(fecha.getFullYear(), fecha.getMonth() - 1, d);
  const proximo = inicioEn(desde.getFullYear(), desde.getMonth() + 1, d);
  const hasta = new Date(proximo.getFullYear(), proximo.getMonth(), proximo.getDate() - 1);
  return {
    dia: d, mes: diaIso(desde).slice(0, 7), desde: diaIso(desde), hasta: diaIso(hasta), proximo: diaIso(proximo),
    texto: `ciclo del ${ddmm(desde)} al ${ddmm(hasta)}`,
  };
}

/**
 * Las entradas del ledger que caen en un ciclo. El ledger se parte por MES CALENDARIO (un archivo por
 * mes, ledger_AAAA-MM.jsonl: el nombre no cambia aunque cambie el dia del ciclo), asi que un ciclo que
 * arranca el 7 lee los dos archivos que toca y se queda con las entradas cuya fecha (`ts`) cae adentro.
 */
export function leerLedgerCiclo(ciclo, dir = DIR_API) {
  const meses = [...new Set([ciclo.desde.slice(0, 7), ciclo.hasta.slice(0, 7)])];
  return meses.flatMap((m) => leerLedger(m, dir)).filter((e) => {
    const dia = String(e?.ts ?? '').slice(0, 10);
    return dia >= ciclo.desde && dia < ciclo.proximo;
  });
}

/**
 * Semaforo del ciclo: verde (< 80 %), amarillo (80-99 %), rojo (100 % o mas). Es monitoreo pasivo,
 * no un freno por llamada: el unico que frena es el job nocturno antes de ARRANCAR si esta en rojo.
 */
export function estadoPresupuesto({ gastadoUsd = 0, presupuestoUsd = PRESUPUESTO_DEFECTO_USD } = {}) {
  const porcentaje = presupuestoUsd > 0 ? Math.round((gastadoUsd / presupuestoUsd) * 1000) / 10 : 0;
  const semaforo = porcentaje >= 100 ? 'rojo' : porcentaje >= 80 ? 'amarillo' : 'verde';
  return { gastadoUsd: Math.round(gastadoUsd * 100) / 100, presupuestoUsd, porcentaje, semaforo };
}

/**
 * El semaforo del CICLO de facturacion leyendo el ledger real. Sin `mes`, el ciclo que contiene a
 * `ahora`; con `mes` ('AAAA-MM'), el ciclo que ARRANCA en ese mes (con el dia en 1, el mes calendario).
 * Se llama "del mes" por historia: lo usan _preauditarAmfe, _nocturno y _claude.
 */
export function presupuestoDelMes({ mes = null, dir = DIR_API, env = process.env, ahora = new Date() } = {}) {
  const dia = cicloDia(env);
  let ciclo;
  if (mes) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(mes));
    if (!m || +m[2] < 1 || +m[2] > 12) throw new ErrorApi('api', `presupuestoDelMes: el mes va como AAAA-MM, no "${mes}"`);
    ciclo = cicloDe(inicioEn(+m[1], +m[2] - 1, dia), dia);
  } else {
    ciclo = cicloDe(ahora, dia);
  }
  const gastadoUsd = resumenLedger(leerLedgerCiclo(ciclo, dir)).totalUsd;
  return { mes: ciclo.mes, ciclo, ...estadoPresupuesto({ gastadoUsd, presupuestoUsd: presupuestoMensualUsd(env) }) };
}

/** '$1,23' con coma decimal, como lo lee Fak. */
export const usd = (x) => `$${(Math.round(n(x) * 100) / 100).toFixed(2).replace('.', ',')}`;

// ─────────────────────────────────────────────────────────────────────────────
// Llamar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un pedido y su respuesta interpretada. Registra el gasto en el ledger (salvo `registrar:false`).
 * Tira ErrorApi si la respuesta no sirve, salvo `tolerar:true` (devuelve la respuesta con el
 * `rechazo` / `truncado` / `jsonInvalido` adentro).
 */
export async function llamar(cliente, opciones = {}) {
  const { tarea = '', registrar = true, tolerar = false, dirLedger = DIR_API, ahora } = opciones;
  const { params, betas, conSchema } = armarParametros(opciones);
  const t0 = Date.now();
  let res;
  try {
    res = await cliente.beta.messages.create(betas.length ? { ...params, betas } : params);
  } catch (e) {
    throw new ErrorApi('api', `la API fallo${tarea ? ` (${tarea})` : ''}: ${e?.status ? `HTTP ${e.status} ` : ''}${e?.message ?? e}`, { causa: e });
  }
  const r = interpretarRespuesta(res, { modelo: params.model, conSchema, duracionMs: Date.now() - t0 });
  if (registrar) registrarGasto(r, { tarea, dir: dirLedger, ahora: ahora ?? new Date() });
  return tolerar ? r : exigirRespuestaUtil(r, { tarea });
}

/**
 * Igual que llamar(), pero por STREAMING: para respuestas largas (miles de tokens de salida) la conexion
 * sin streaming se corta a los ~10 min con "Request timed out" aunque el cliente tenga un timeout mayor
 * (medido el 09/10/2026 con Opus y 32.000-64.000 tokens de salida, timeout de 40 min). El texto se junta
 * al final (`finalMessage()`): nada se usa a medias, mismo ledger, mismos errores que llamar().
 */
export async function llamarLargo(cliente, opciones = {}) {
  const { tarea = '', registrar = true, tolerar = false, dirLedger = DIR_API, ahora } = opciones;
  const { params, betas, conSchema } = armarParametros(opciones);
  const t0 = Date.now();
  let res;
  try {
    const stream = cliente.beta.messages.stream(betas.length ? { ...params, betas } : params);
    res = await stream.finalMessage();
  } catch (e) {
    throw new ErrorApi('api', `la API fallo${tarea ? ` (${tarea})` : ''}: ${e?.status ? `HTTP ${e.status} ` : ''}${e?.message ?? e}`, { causa: e });
  }
  const r = interpretarRespuesta(res, { modelo: params.model, conSchema, duracionMs: Date.now() - t0 });
  if (registrar) registrarGasto(r, { tarea, dir: dirLedger, ahora: ahora ?? new Date() });
  return tolerar ? r : exigirRespuestaUtil(r, { tarea });
}

/** Cuantos tokens de entrada tiene un pedido, SIN gastar (count_tokens es gratis). */
export async function contarTokens(cliente, opciones = {}) {
  const { params } = armarParametros({ ...opciones, fallbacks: false });
  const pedido = { model: params.model, messages: params.messages };
  if (params.system) pedido.system = params.system;
  const r = await cliente.messages.countTokens(pedido);
  return n(r?.input_tokens);
}

/** ¿La clave anda y ve los modelos? Devuelve { ok, detalle } sin tirar (para --check). */
export async function verificarAcceso(cliente) {
  try {
    const m = await cliente.models.retrieve(MODELOS.haiku);
    return { ok: true, detalle: `la API responde (${m?.display_name || m?.id || MODELOS.haiku})` };
  } catch (e) {
    const status = e?.status ? `HTTP ${e.status}` : (e?.name || 'error');
    const pista = e?.status === 401 ? 'la clave no es valida o no es de esta organizacion'
      : e?.status === 403 ? 'la clave no tiene permiso'
        : /credit balance/i.test(String(e?.message)) ? 'la organizacion no tiene saldo: faltan los creditos del plan o se agotaron'
          : String(e?.message ?? e).slice(0, 200);
    return { ok: false, detalle: `${status}: ${pista}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Paralelo acotado, lotes y orquestador-workers
// ─────────────────────────────────────────────────────────────────────────────

/** Corre `fn(item, i)` sobre todos los items con a lo sumo `n` a la vez. Devuelve los resultados en orden. */
export async function enParalelo(items, n, fn) {
  const lista = [...items];
  const out = new Array(lista.length);
  let i = 0;
  const trabajador = async () => {
    while (i < lista.length) {
      const k = i++;
      out[k] = await fn(lista[k], k);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, lista.length)) }, trabajador));
  return out;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Un lote de pedidos por Message Batches (mitad de precio; no apura: suele tardar minutos, puede
 * tardar horas). `pedidos`: [{ id, ...opciones de armarParametros }]. Espera hasta `timeoutMs`;
 * si el lote no termino, tira ErrorApi 'lote' con `loteId` para recogerlo despues con recogerLote.
 * Los lotes no aceptan `fallbacks`: se arma sin.
 */
export async function lote(cliente, pedidos, { tarea = '', esperarMs = 30000, timeoutMs = 55 * 60 * 1000, dirLedger = DIR_API, ahora } = {}) {
  if (!pedidos.length) return { loteId: null, resultados: {} };
  const ids = new Set();
  const requests = pedidos.map((p) => {
    if (!p.id || ids.has(p.id)) throw new ErrorApi('lote', `cada pedido del lote lleva un id unico: "${p.id}"`);
    ids.add(p.id);
    const { params } = armarParametros({ ...p, fallbacks: false });
    return { custom_id: String(p.id), params };
  });
  let b;
  try { b = await cliente.messages.batches.create({ requests }); } catch (e) {
    throw new ErrorApi('api', `no se pudo crear el lote${tarea ? ` (${tarea})` : ''}: ${e?.message ?? e}`, { causa: e });
  }
  const t0 = Date.now();
  while (b.processing_status !== 'ended') {
    if (Date.now() - t0 > timeoutMs) {
      throw new ErrorApi('lote', `el lote ${b.id} sigue en curso despues de ${Math.round(timeoutMs / 60000)} min: recogerlo despues con recogerLote.`, { loteId: b.id });
    }
    await dormir(esperarMs);
    b = await cliente.messages.batches.retrieve(b.id);
  }
  const conSchema = Object.fromEntries(pedidos.map((p) => [String(p.id), !!p.schema]));
  const modelos = Object.fromEntries(pedidos.map((p) => [String(p.id), resolverModelo(p.modelo)]));
  const resultados = await recogerLote(cliente, b.id, { tarea, conSchema, modelos, dirLedger, ahora });
  return { loteId: b.id, resultados };
}

/**
 * Los resultados de un lote ya terminado, por id de pedido: { [id]: respuesta | { error } }.
 * Registra el gasto de cada respuesta como lote.
 */
export async function recogerLote(cliente, loteId, { tarea = '', conSchema = {}, modelos = {}, dirLedger = DIR_API, ahora } = {}) {
  const resultados = {};
  for await (const r of await cliente.messages.batches.results(loteId)) {
    const id = String(r.custom_id);
    if (r.result?.type === 'succeeded') {
      const resp = interpretarRespuesta(r.result.message, { modelo: modelos[id] || r.result.message?.model, conSchema: !!conSchema[id], lote: true });
      registrarGasto(resp, { tarea, lote: true, dir: dirLedger, ahora: ahora ?? new Date() });
      resultados[id] = resp;
    } else {
      resultados[id] = { error: r.result?.type || 'sin resultado', detalle: r.result?.error?.message ?? r.result?.error?.type ?? null };
    }
  }
  return resultados;
}

/**
 * Orquestador-workers como flujo (no como agente suelto): los workers (Sonnet o Haiku) hacen cada
 * item en paralelo acotado; el reductor (Opus) recibe lo que volvio y sintetiza. Es el patron de
 * "Building Effective Agents" aplicado a lo que hace falta aca: pasos conocidos, sin bucles.
 *
 *   worker:   { modelo, system, armar(item) -> { usuario|mensajes, maxTokens, effort, schema } }
 *   reductor: { modelo (Opus por defecto), system, armar(trabajos) -> {...} }  (opcional)
 *   trabajos: [{ item, respuesta }] o [{ item, error }] — un worker que falla no tumba el resto.
 */
export async function mapaReduce(cliente, { items, worker, reductor, concurrencia = 3, tarea = '', dirLedger = DIR_API }) {
  const trabajos = await enParalelo(items, concurrencia, async (item) => {
    try {
      const respuesta = await llamar(cliente, { modelo: worker.modelo || ROLES.revisor, system: worker.system, cacheTtl: worker.cacheTtl ?? '5m', ...worker.armar(item), tarea: `${tarea}:worker`, dirLedger });
      return { item, respuesta };
    } catch (e) {
      return { item, error: e };
    }
  });
  let reduccion = null;
  if (reductor) {
    reduccion = await llamar(cliente, { modelo: reductor.modelo || ROLES.orquestador, system: reductor.system, ...reductor.armar(trabajos), tarea: `${tarea}:reductor`, dirLedger });
  }
  return { trabajos, reduccion };
}
