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
import { agregarSeguro, escribirSeguro } from './escrituraSegura.mjs';

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

/** Error propio: `tipo` dice que paso (sin_clave | rechazo | truncado | json | modelo | lote | adjunto | api). */
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
/**
 * Marca "esta prestada ya no tiene saldo": un archivo en DIR_API (la noche puede escribirlo: pasa por escrituraSegura).
 * 11/10/2026: la prestada de $100 se agota en medio de una tanda y, sin la marca, hasta su fecha de vencimiento
 * TODAS las llamadas fallaban con "credit balance is too low" aunque la principal tuviera saldo.
 */
const archivoAgotada = (hasta, dir) => path.join(dir, `prestada_agotada_${hasta}`);

/**
 * Prestadas que NO vencen: se recargan solas un dia fijo de cada mes. Clave = el AAAAMMDD con que se pego la linea
 * `ANTHROPIC_API_KEY_HASTA_AAAAMMDD`; valor = el dia del mes en que se renueva. Dato de Fak, 20/10/2026: la del dueño
 * *"no vencida mañana, se renuevan todos los meses"*, *"da por vencida pero se equivoca, es un error, usala igual"*.
 * Hasta ese dia el codigo la daba por muerta desde el 21/10 y la marca de agotada se borraba a mano cada 20.
 */
export const RENUEVA_PRESTADAS = Object.freeze({ 20261020: 20 });

/** El inicio (00:00 local) de la ultima renovacion de una prestada renovable, o null si no se renueva. */
export function ultimaRenovacion(hasta, hoy = new Date(), renueva = RENUEVA_PRESTADAS) {
  const dia = Number(renueva[hasta]);
  if (!(dia >= 1 && dia <= 31)) return null;
  const diaDe = (a, m) => Math.min(dia, new Date(a, m + 1, 0).getDate());   // un 31 en un mes de 30 cae en el ultimo dia
  let a = hoy.getFullYear(); let m = hoy.getMonth();
  if (hoy.getDate() < diaDe(a, m)) { m -= 1; if (m < 0) { m = 11; a -= 1; } }
  return new Date(a, m, diaDe(a, m));
}

/** ¿La prestada sigue vigente hoy? Una renovable, siempre; las demas, hasta su dia (inclusive). */
export function prestadaVigente(hasta, hoy = new Date(), renueva = RENUEVA_PRESTADAS) {
  return renueva[hasta] != null || hasta >= aaaammdd(hoy);
}

/**
 * Sin saldo = hay marca. En una renovable la marca vale solo si es de DESPUES de la ultima renovacion: la del ciclo
 * anterior se ignora sola (sin borrarla), y si se vuelve a agotar se marca de nuevo.
 */
export function prestadaAgotada(hasta, { dir = DIR_API, hoy = new Date(), renueva = RENUEVA_PRESTADAS } = {}) {
  const ruta = archivoAgotada(hasta, dir);
  if (!fs.existsSync(ruta)) return false;
  const desde = ultimaRenovacion(hasta, hoy, renueva);
  if (!desde) return true;
  return fs.statSync(ruta).mtime >= desde;
}
export function marcarPrestadaAgotada(hasta, { dir = DIR_API, ahora = new Date() } = {}) {
  agregarSeguro(archivoAgotada(hasta, dir), `${selloLocal(ahora)} sin saldo (credit balance is too low)\n`);
}

/** Todas las prestadas de .env.local, vencidas o no, marcadas o no: [{ clave, hasta }]. Para saber si una clave ES una prestada. */
export function clavesPrestadas({ archivoEnv = path.join(RAIZ, '.env.local') } = {}) {
  const local = leerEnv(archivoEnv);
  return Object.entries(local)
    .map(([k, v]) => ({ m: /^ANTHROPIC_API_KEY_HASTA_(\d{8})$/.exec(k), clave: String(v ?? '').trim() }))
    .filter((x) => x.m && x.clave)
    .map((x) => ({ clave: x.clave, hasta: x.m[1] }));
}

export function claveActiva({ env = process.env, archivoEnv = path.join(RAIZ, '.env.local'), hoy = new Date(), dirMarcas = DIR_API, renueva = RENUEVA_PRESTADAS } = {}) {
  const directa = String(env.ANTHROPIC_API_KEY ?? '').trim();
  if (directa) return { clave: directa, origen: 'entorno', hasta: null };
  const local = leerEnv(archivoEnv);
  const prestadas = Object.entries(local)
    .map(([k, v]) => ({ m: /^ANTHROPIC_API_KEY_HASTA_(\d{8})$/.exec(k), clave: String(v ?? '').trim() }))
    .filter((x) => x.m && x.clave && prestadaVigente(x.m[1], hoy, renueva) && !prestadaAgotada(x.m[1], { dir: dirMarcas, hoy, renueva }))
    .map((x) => ({ clave: x.clave, hasta: x.m[1] }))
    .sort((a, b) => a.hasta.localeCompare(b.hasta));
  if (prestadas.length) return { clave: prestadas[0].clave, origen: 'secundaria', hasta: prestadas[0].hasta };
  const principal = String(local.ANTHROPIC_API_KEY ?? '').trim();
  return principal ? { clave: principal, origen: 'principal', hasta: null } : { clave: null, origen: null, hasta: null };
}

/**
 * Con que clave se pago un pedido, como ETIQUETA para el ledger: 'prestada-AAAAMMDD', 'principal' o 'entorno'.
 * Nunca la clave. null si no se reconoce (un cliente de prueba). Pedido de Fak, 11/10/2026: el gasto separado por
 * clave ("disponible, gastado, y separar entre cada api"); hasta ese dia el ledger no decia quien pagaba.
 */
export function etiquetaClave(apiKey, { env = process.env, archivoEnv = path.join(RAIZ, '.env.local') } = {}) {
  const clave = String(apiKey ?? '').trim();
  if (!clave) return null;
  const prestada = clavesPrestadas({ archivoEnv }).find((p) => p.clave === clave);
  if (prestada) return `prestada-${prestada.hasta}`;
  if (String(leerEnv(archivoEnv).ANTHROPIC_API_KEY ?? '').trim() === clave) return 'principal';
  if (String(env.ANTHROPIC_API_KEY ?? '').trim() === clave) return 'entorno';
  return null;
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
// PDFs y fotos en el pedido (tanda 13, item 14, 17/10/2026)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hasta el 17/10/2026 la puerta solo mandaba texto: la API no podia leer el manual escaneado del AIAG-VDA (las escalas
 * O/D siguen saliendo del borrador 2017) ni una hoja de proceso impresa (informe B del 15/10, punto 4). Un PDF va como
 * bloque `document` y una foto como bloque `image`, los dos en base64 y ADELANTE del texto del pedido (skill claude-api,
 * «Document & File Input» y «Vision»). Topes, de la doc oficial (platform.claude.com/docs/en/build-with-claude/pdf-support,
 * leida el 17/10/2026, tabla «Check PDF requirements»): «Maximum request size 32 MB», «Maximum pages per request 600 (100
 * when the request's context window is under 1M tokens)», «Format: Standard PDF (no passwords/encryption)», y «Both
 * limits are on the entire request payload»: las 600 paginas son de TODO el pedido, no de cada PDF. Los cuatro modelos
 * de la casa tienen contexto de 1M (tabla «Current Models» de la skill claude-api, cache del 06/10/2026), asi que va 600.
 * El costo de un adjunto NO sale de contar caracteres: se mide con contarTokens() (count_tokens, gratis) antes de
 * pagar, como hace `_apiTarea.mjs`. Lo que esta seccion lee del disco es solo el archivo que se le pasa.
 */
export const TIPOS_ADJUNTO = Object.freeze({
  '.pdf': { bloque: 'document', media: 'application/pdf' },
  '.png': { bloque: 'image', media: 'image/png' },
  '.jpg': { bloque: 'image', media: 'image/jpeg' },
  '.jpeg': { bloque: 'image', media: 'image/jpeg' },
  '.gif': { bloque: 'image', media: 'image/gif' },
  '.webp': { bloque: 'image', media: 'image/webp' },
});
export const TOPE_PEDIDO_BYTES = 32 * 1024 * 1024;
export const TOPE_PAGINAS_PDF = 600;

/** Los primeros bytes de cada tipo: un archivo que se llama .pdf y no es un PDF no se manda (se pagaria por nada). */
const FIRMA_ADJUNTO = {
  'application/pdf': (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
  'image/png': (b) => b[0] === 0x89 && b.subarray(1, 4).toString('latin1') === 'PNG',
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/gif': (b) => b.subarray(0, 4).toString('latin1') === 'GIF8',
  'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
};

/**
 * Paginas de un PDF contando los objetos `/Type /Page` (no `/Pages`). Es aproximado: un PDF que guarda sus objetos
 * comprimidos puede dar 0, y 0 no frena (el costo real lo dice count_tokens); uno con revisiones agregadas al final
 * puede contar de mas (frena de mas, nunca de menos). Sirve para frenar ANTES un pedido de mas de 600 paginas.
 */
export function paginasPdf(buf) {
  const m = Buffer.from(buf).toString('latin1').match(/\/Type\s*\/Page(?![A-Za-z])/g);
  return m ? m.length : 0;
}

/**
 * Un archivo -> { bloque, ruta, bytes, paginas }. Tira ErrorApi 'adjunto' si no es PDF ni foto, si por dentro no es lo
 * que dice su nombre, o si el PDF pasa las 600 paginas. `leer` se cambia en los tests.
 */
export function bloqueAdjunto(ruta, { leer = (p) => fs.readFileSync(p) } = {}) {
  const ext = path.extname(String(ruta ?? '')).toLowerCase();
  const tipo = TIPOS_ADJUNTO[ext];
  if (!tipo) {
    throw new ErrorApi('adjunto', `no se manda "${ruta}" como PDF o foto: van ${Object.keys(TIPOS_ADJUNTO).join(', ')}. Un texto va dentro del mensaje.`);
  }
  const buf = Buffer.from(leer(ruta));
  if (!FIRMA_ADJUNTO[tipo.media](buf)) throw new ErrorApi('adjunto', `"${ruta}" se llama ${ext} y por dentro no es ${tipo.media}: no se manda`);
  const paginas = tipo.bloque === 'document' ? paginasPdf(buf) : null;
  if (paginas > TOPE_PAGINAS_PDF) throw new ErrorApi('adjunto', `"${ruta}" tiene ${paginas} paginas: la API toma hasta ${TOPE_PAGINAS_PDF} por pedido (partirlo antes)`);
  if (tipo.bloque === 'document' && /\/Encrypt\b/.test(buf.toString('latin1'))) {
    throw new ErrorApi('adjunto', `"${ruta}" es un PDF con contraseña o cifrado: la API no lo toma (guardarlo sin proteccion antes)`);
  }
  return {
    bloque: { type: tipo.bloque, source: { type: 'base64', media_type: tipo.media, data: buf.toString('base64') } },
    ruta: String(ruta), bytes: buf.length, paginas,
  };
}

/**
 * El contenido del mensaje del usuario con los PDF y las fotos ADELANTE y el texto al final. `usuario` es texto o una
 * lista de bloques. Tira si todo junto (en base64) pasa los 32 MB que acepta un pedido.
 */
export function contenidoConAdjuntos(usuario, rutas = [], opciones = {}) {
  const adjuntos = rutas.map((r) => bloqueAdjunto(r, opciones));
  const paginas = adjuntos.reduce((s, a) => s + (a.paginas || 0), 0);
  if (paginas > TOPE_PAGINAS_PDF) {
    throw new ErrorApi('adjunto', `los PDF del pedido suman ${paginas} paginas: la API toma hasta ${TOPE_PAGINAS_PDF} en todo el pedido (mandarlos en pedidos separados)`);
  }
  const texto = Array.isArray(usuario) ? usuario : [{ type: 'text', text: String(usuario ?? '') }];
  const total = adjuntos.reduce((s, a) => s + a.bloque.source.data.length, 0) + Buffer.byteLength(JSON.stringify(texto));
  if (total > TOPE_PEDIDO_BYTES) {
    throw new ErrorApi('adjunto', `los adjuntos suman ${(total / 1024 / 1024).toFixed(1).replace('.', ',')} MB ya pasados a base64: la API acepta hasta 32 MB por pedido (mandarlos en pedidos separados)`);
  }
  return [...adjuntos.map((a) => a.bloque), ...texto];
}

// ─────────────────────────────────────────────────────────────────────────────
// Armar el pedido (puro) e interpretar la respuesta (puro)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Arma los parametros de un pedido a /v1/messages. No llama a nada.
 *
 *   modelo     'opus' | 'sonnet' | 'haiku' | 'fable' | id completo
 *   system     texto o lista de bloques {type:'text', text}; estable y adelante, para el cache
 *   usuario    el mensaje del usuario (texto o bloques), o `mensajes` ya armados. Con PDFs o fotos:
 *              `usuario: contenidoConAdjuntos(texto, [rutas])` (los bloques van adelante del texto)
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
 *
 * REVISADO CONTRA LA GUIA DE MIGRACION A LOS 5.x (skill claude-api, `shared/model-migration.md`, 17/10/2026, tanda 5):
 *   - Nunca se manda `thinking` (Opus 5.5 y Sonnet 5.5 dan 400 con `disabled`; los cuatro dan 400 con `budget_tokens`),
 *     ni `temperature` / `top_p` / `top_k` (400 fuera del default en Fable 5.1, Sonnet 5.5 y Haiku 5.5), ni
 *     `tool_choice` forzado (400 en Fable 5.1, Opus 5.5 y Sonnet 5.5, tambien en count_tokens y Batches), ni un
 *     ultimo mensaje del asistente (el prefill da 400 en los cuatro: se frena aca, antes de mandar).
 *   - El fallback del servidor va en su forma `'default'` con la cabecera `-2026-07-01` en Opus, Sonnet y Fable (para
 *     Sonnet 5.5 es la unica forma); Haiku 5.5 no tiene fallback del servidor; los lotes no lo aceptan (lote() lo saca).
 *   - Un solo `cache_control`, en el ULTIMO bloque del system: en estos pedidos de una vuelta el system es lo que se
 *     repite y el usuario cambia; el cache automatico de arriba cachearia el mensaje del usuario y pagaria la escritura
 *     sin lecturas. (El agente por API, que si repite la charla, lleva dos marcas: 1 h en el system y 5 min en el
 *     ultimo mensaje del usuario, que avanza cada vuelta: agenteApi.marcarCache.)
 *   - `max_tokens`: el tokenizador de los 5.x da ~30 % mas tokens, pero los topes de la noche ya corrieron con los
 *     modelos 5.x: en el ledger del 09 al 17/10 la salida maxima de la noche fue 2.814 tokens (disparo, Haiku, 17/10)
 *     contra topes de 4.000 a 16.000. Los que se cortaron (32.000 y 128.000) fueron borradores largos por
 *     `_apiTarea.mjs`, no la noche.
 *   - Preserved thinking: aca cada pedido es de UNA vuelta (no se reenvian bloques de pensamiento). El unico que arma
 *     historial es el agente por API, y lo hace agregando `res.content` entero, sin editar turnos viejos (mover
 *     `cache_control` no cuenta como edicion, segun la guia). La medicion con reenvios cuesta plata: no se corrio.
 */
/**
 * FABLE SOLO SI FAK LO PIDE PARA ESA TAREA (api-claude.md §2; tanda 5 pieza 7, 17/10/2026). En la ola del 11/10 Fable
 * fue el 55 % del gasto (US$ 144,78 de 262,93) y hasta este dia la puerta no lo controlaba: cualquier llamada con
 * `modelo: 'fable'` pasaba y la sintesis de _apiLotes.mjs lo usaba por defecto. Ahora un pedido a Fable lleva
 * `pedidoFable`: la frase de Fak que lo pidio, con su fecha (`Fak 17/10 10:05: "usa fable para la sintesis"`). Sin
 * eso se frena ANTES de mandar (tambien el conteo de tokens y los lotes), y con eso la frase queda en la linea del
 * ledger. El codigo no puede saber si la frase es real: lo que asegura es que nadie llegue a Fable sin escribirla.
 */
export const LARGO_MIN_PEDIDO_FABLE = 12;
/** La frase para el ledger si el pedido ES a Fable (id resuelto); null si es otro modelo. */
export const fraseFableDe = (modelo, pedidoFable) => (resolverModelo(modelo) === MODELOS.fable ? exigirPedidoFable(MODELOS.fable, pedidoFable) : null);
export function exigirPedidoFable(id, pedidoFable) {
  if (id !== MODELOS.fable) return null;
  const frase = String(pedidoFable ?? '').replace(/\s+/g, ' ').trim();
  if (frase.length < LARGO_MIN_PEDIDO_FABLE) {
    throw new ErrorApi('fable', 'Fable por la API va solo si Fak lo pidio para esta tarea (api-claude.md §2): falta `pedidoFable` con su frase y su fecha (en los comandos, --fable-pedido "Fak dd/mm hh:mm: <lo que dijo>"). Si no lo pidio, va con Opus.');
  }
  return frase.slice(0, 200);
}

/**
 * ¿El ultimo mensaje es un prefill? Un turno del asistente hecho SOLO de texto (string o bloques `text`). El turno que
 * el agente reenvia tal cual despues de un `pause_turn` trae bloques de herramientas del servidor y no es prefill.
 */
export function esPrefill(mensajes) {
  if (!Array.isArray(mensajes) || !mensajes.length) return false;
  const u = mensajes[mensajes.length - 1];
  if (u?.role !== 'assistant') return false;
  if (typeof u.content === 'string') return true;
  return Array.isArray(u.content) && u.content.length > 0 && u.content.every((b) => b?.type === 'text');
}

export function armarParametros({
  modelo, system, usuario, mensajes, maxTokens = 16000, effort, cacheTtl = null, schema, fallbacks, pedidoFable,
} = {}) {
  const id = resolverModelo(modelo);
  exigirPedidoFable(id, pedidoFable);
  if (!mensajes && usuario == null) throw new ErrorApi('api', 'armarParametros: falta `usuario` o `mensajes`');
  if (esPrefill(mensajes)) {
    throw new ErrorApi('api', 'armarParametros: el ultimo mensaje es texto del asistente (prefill): los modelos 5.x lo rechazan con 400. Pedir el formato con `schema` o en el system.');
  }
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

/**
 * Agrega una linea al ledger del mes. Devuelve la entrada escrita. `clave`: la etiqueta de etiquetaClave() (quien
 * pago); sin ella la linea no lleva el campo. Despues deja al dia el resumen por clave (saldo.json); si ese resumen
 * falla, el gasto ya quedo anotado y no se pierde.
 */
export function registrarGasto(r, { tarea = '', lote = false, dir = DIR_API, ahora = new Date(), clave = null, pedidoFable = null } = {}) {
  const u = r.usage || {};
  // un pedido a Fable deja en el ledger la frase de Fak que lo autorizo (tanda 5). Quien llama la pasa solo si PIDIO
  // Fable (fraseFableDe): asi queda aunque el fallback del servidor haya contestado con otro modelo
  const fraseFable = pedidoFable ? String(pedidoFable).replace(/\s+/g, ' ').trim().slice(0, 200) : '';
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
    // solo una etiqueta de etiquetaClave(): cualquier otro texto no se escribe (si alguien pasara la clave misma, no queda)
    ...(RE_ETIQUETA_CLAVE.test(String(clave ?? '')) ? { clave: String(clave) } : {}),
    ...(fraseFable ? { pedidoFable: fraseFable } : {}),
  };
  // por la puerta segura: el ledger solo puede caer en .sgc-cache (o en la carpeta de BARACK_API_DIR)
  agregarSeguro(rutaLedger(mesLocal(ahora), dir), `${JSON.stringify(entrada)}\n`);
  try { escribirSaldo({ dir, ahora }); } catch { /* el resumen se rehace en la proxima llamada o con --check */ }
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

/** Credito de API que trae el plan por ciclo: $200 el Max 20x (api-claude.md §1). BARACK_API_CREDITO_USD lo cambia. */
export const CREDITO_PLAN_USD = 200;
export const creditoPlanUsd = (env = process.env) => positivo(env.BARACK_API_CREDITO_USD, CREDITO_PLAN_USD);

/**
 * Lo que traia cada clave prestada cuando se pego, por su fecha de vencimiento (dato de Fak, 09/10/2026: la del dueno
 * de la empresa, $100 hasta el 20/10). Solo acota el reparto ESTIMADO: una prestada agotada no pudo pagar mas de lo
 * que tenia, asi que lo que la hora le atribuye de mas es de la clave del plan.
 */
export const CREDITO_PRESTADAS_USD = { 20261020: 100 };

/**
 * Los pedidos de ANTES de que el ledger anotara la clave (el ultimo es del 11/10/2026 03:50; desde `c2e18522` todos la
 * anotan): quien los pago queda FIJO aca. Antes se deducia de las marcas de «agotada» que hubiera en la carpeta, y
 * borrar la marca de una prestada recargada (lo que manda api-claude.md §2) o que apareciera otra prestada movia el
 * reparto de estos pedidos viejos (auditor, 11/10/2026: de 37 de saldo a 0 o a 193). La prestada de $100 se uso desde
 * que el codigo conocio una segunda clave (`3d49cc82`, 09/10 22:16:31) hasta que quedo sin saldo (11/10 02:21:34); lo
 * anterior y lo posterior lo pago la clave del plan.
 */
export const REPARTO_SIN_ETIQUETA = [{ desde: '2026-10-09 22:16:31', hasta: '2026-10-11 02:21:34', clave: 'prestada-20261020' }];

/** Las etiquetas que escribe etiquetaClave(): lo unico que entra al campo `clave` del ledger (nunca un texto libre). */
const RE_ETIQUETA_CLAVE = /^(principal|entorno|prestada-\d{8})$/;

export const rutaSaldo = (dir = DIR_API) => path.join(dir, 'saldo.json');
const RE_MARCA_AGOTADA = /^prestada_agotada_(\d{8})$/;

/** Las prestadas marcadas sin saldo en `dir`: [{ hasta, cuando: 'AAAA-MM-DD HH:MM:SS' | null }] (la hora de la primera marca). */
function marcasDeAgotada(dir) {
  let nombres = [];
  try { nombres = fs.readdirSync(dir); } catch { return []; }
  return nombres.map((nombre) => RE_MARCA_AGOTADA.exec(nombre)).filter(Boolean).map((m) => {
    let cuando = null;
    try { cuando = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.exec(fs.readFileSync(path.join(dir, m[0]), 'utf8'))?.[0] ?? null; } catch { /* sin hora */ }
    return { hasta: m[1], cuando };
  }).sort((a, b) => a.hasta.localeCompare(b.hasta));
}

/**
 * El gasto del ciclo separado por clave, para mostrarle a Fak "gastado / quedan" (11/10/2026):
 *   { actualizado, ciclo: { desde, hasta, proximo, texto }, estimado,
 *     claves: [{ nombre: 'principal', gastadoUsd, creditoUsd, quedanUsd },
 *              { nombre: 'prestada', hasta: 'AAAAMMDD', gastadoUsd, agotada, vencida }, { nombre: 'entorno', gastadoUsd }] }
 * Cada linea del ledger dice quien pago (`clave`). Las de antes del 11/10/2026 no lo dicen: se reparten con la tabla
 * fija REPARTO_SIN_ETIQUETA (el tramo en que se uso la prestada; el resto, a la principal), no con las marcas que haya, y
 * `estimado` queda en true. `quedanUsd` es el credito del plan menos lo anotado aca: una cuenta del ledger, NO el
 * saldo que muestra Anthropic (ese no se puede leer con la clave).
 */
export function saldoPorClave({ dir = DIR_API, env = process.env, ahora = new Date(), creditoPrestadas = CREDITO_PRESTADAS_USD, repartoViejo = REPARTO_SIN_ETIQUETA, renueva = RENUEVA_PRESTADAS } = {}) {
  const ciclo = cicloDe(ahora, cicloDia(env));
  const marcas = marcasDeAgotada(dir);
  const gastado = new Map();
  const sinEtiqueta = new Map();   // lo repartido por la tabla de arriba, por clave: solo eso es estimado
  let estimado = false;
  for (const e of leerLedgerCiclo(ciclo, dir)) {
    let nombre = RE_ETIQUETA_CLAVE.test(String(e.clave ?? '')) ? e.clave : null;
    if (!nombre) {
      estimado = true;
      const ts = String(e.ts ?? '');
      nombre = repartoViejo.find((x) => ts >= x.desde && ts <= x.hasta)?.clave ?? 'principal';
      sinEtiqueta.set(nombre, (sinEtiqueta.get(nombre) ?? 0) + n(e.costoUsd));
    }
    gastado.set(nombre, (gastado.get(nombre) ?? 0) + n(e.costoUsd));
  }
  const r2 = (x) => Math.round(x * 100) / 100;
  // El reparto por hora es grueso (un pedido se anota cuando TERMINA): si a una prestada le atribuye mas de lo que
  // traia, el sobrante lo pago la clave del plan. Sin este tope «quedan» salia de mas (11/10/2026: 102,17 contra los 100
  // de la prestada). El tope mira SOLO lo repartido sin etiqueta: lo que una linea etiquetada dice no se mueve (una
  // prestada recargada puede pasar de su primer credito).
  for (const [k, repartido] of sinEtiqueta) {
    const m = /^prestada-(\d{8})$/.exec(k);
    const tope = m ? Number(creditoPrestadas?.[m[1]]) : NaN;
    if (Number.isFinite(tope) && tope >= 0 && repartido > tope) {
      gastado.set(k, gastado.get(k) - (repartido - tope));
      gastado.set('principal', (gastado.get('principal') ?? 0) + (repartido - tope));
    }
  }
  const credito = creditoPlanUsd(env);
  const dePrincipal = gastado.get('principal') ?? 0;
  const claves = [{ nombre: 'principal', gastadoUsd: r2(dePrincipal), creditoUsd: credito, quedanUsd: r2(Math.max(0, credito - dePrincipal)) }];
  const prestadas = new Set(marcas.map((m) => m.hasta));
  for (const k of gastado.keys()) { const m = /^prestada-(\d{8})$/.exec(k); if (m) prestadas.add(m[1]); }
  for (const hasta of [...prestadas].sort()) {
    // una renovable no vence y su marca de agotada vale solo en el ciclo en que se puso (prestadaAgotada)
    claves.push({ nombre: 'prestada', hasta, gastadoUsd: r2(gastado.get(`prestada-${hasta}`) ?? 0), agotada: prestadaAgotada(hasta, { dir, hoy: ahora, renueva }), vencida: !prestadaVigente(hasta, ahora, renueva) });
  }
  for (const [k, v] of gastado) if (k !== 'principal' && !/^prestada-\d{8}$/.test(k)) claves.push({ nombre: k, gastadoUsd: r2(v) });
  return { actualizado: selloLocal(ahora), ciclo: { desde: ciclo.desde, hasta: ciclo.hasta, proximo: ciclo.proximo, texto: ciclo.texto }, estimado, claves };
}

/** Deja el resumen por clave en saldo.json (por la puerta segura). Lo lee la banda del tablero. */
export function escribirSaldo(opciones = {}) {
  const s = saldoPorClave(opciones);
  escribirSeguro(rutaSaldo(opciones.dir ?? DIR_API), `${JSON.stringify(s, null, 2)}\n`);
  return s;
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
const RE_SIN_SALDO = /credit balance is too low/i;
/** Clave vieja -> cliente de reemplazo, en ESTE proceso: la primera llamada que cae por saldo cambia la clave para todas las que siguen. */
const reemplazos = new Map();
const clienteVigente = (cliente) => (cliente?.apiKey && reemplazos.get(cliente.apiKey)) || cliente;

/**
 * Corre `fn(cliente)`. Si la API contesta 400 "credit balance is too low" y la clave del cliente es una PRESTADA,
 * la marca agotada, arma un cliente con la clave que sigue (otra prestada o la principal) y reintenta UNA vez.
 * Con la clave del entorno o la principal no hay a donde ir: el error sube como siempre.
 * `respaldo`: { env, archivoEnv, dirMarcas, crear(clave) -> cliente } para los tests; por defecto, lo real.
 * 11/10/2026 02:15: la prestada se agoto en medio de 12 pedidos; el primero que fallaba era count_tokens, que no
 * pasaba por aca, y el cliente viejo seguia en uso: por eso el reemplazo vale para todas las llamadas del proceso.
 */
async function conRespaldoDeClave(clienteDado, fn, { tarea = '', respaldo = {} } = {}) {
  const cliente = clienteVigente(clienteDado);
  try {
    return await fn(cliente);
  } catch (e) {
    if (!(e?.status === 400 && RE_SIN_SALDO.test(String(e?.message ?? '')))) throw e;
    // Sin la clave del cliente a la vista no se marca nada (fallar al lado seguro: auditor Opus 03:00, punto 8).
    if (!cliente.apiKey) throw e;
    const { env = process.env, archivoEnv, dirMarcas = DIR_API, crear } = respaldo;
    const op = { env, ...(archivoEnv ? { archivoEnv } : {}), dirMarcas };
    // La clave del cliente tiene que ser UNA prestada (marcada o no): con varios pedidos en paralelo, o con otro proceso
    // que ya dejo la marca, la activa de ahora ya es la principal y los pedidos en vuelo con la prestada se caian igual
    // (auditor Opus 03:00, punto 1). La del entorno o la principal no tienen a donde ir.
    const prestada = clavesPrestadas(op).find((p) => p.clave === cliente.apiKey);
    if (!prestada) throw e;
    if (!prestadaAgotada(prestada.hasta, { dir: dirMarcas })) marcarPrestadaAgotada(prestada.hasta, { dir: dirMarcas });
    const siguiente = claveActiva(op);
    if (!siguiente.clave || siguiente.clave === cliente.apiKey) throw e;
    let nuevo = reemplazos.get(cliente.apiKey);
    if (!nuevo || nuevo.apiKey !== siguiente.clave) {
      console.error(`clave prestada (hasta ${prestada.hasta}) sin saldo${tarea ? ` (${tarea})` : ''}: sigo con la ${siguiente.origen}`);
      nuevo = (crear ?? ((clave) => new Anthropic({ apiKey: clave, timeout: cliente.timeout, maxRetries: cliente.maxRetries })))(siguiente.clave);
      reemplazos.set(cliente.apiKey, nuevo);
    }
    return fn(nuevo);
  }
}

export async function llamar(cliente, opciones = {}) {
  const { tarea = '', registrar = true, tolerar = false, dirLedger = DIR_API, ahora, respaldoClave } = opciones;
  const { params, betas, conSchema } = armarParametros(opciones);
  const t0 = Date.now();
  let res;
  let usado = null;   // el cliente que contesto: si la prestada se quedo sin saldo, es el de reemplazo
  try {
    res = await conRespaldoDeClave(cliente, (c) => { usado = c; return c.beta.messages.create(betas.length ? { ...params, betas } : params); }, { tarea, respaldo: respaldoClave });
  } catch (e) {
    throw new ErrorApi('api', `la API fallo${tarea ? ` (${tarea})` : ''}: ${e?.status ? `HTTP ${e.status} ` : ''}${e?.message ?? e}`, { causa: e });
  }
  const r = interpretarRespuesta(res, { modelo: params.model, conSchema, duracionMs: Date.now() - t0 });
  if (registrar) registrarGasto(r, { tarea, dir: dirLedger, ahora: ahora ?? new Date(), clave: etiquetaClave(usado?.apiKey, respaldoClave ?? {}), pedidoFable: fraseFableDe(params.model, opciones.pedidoFable) });
  return tolerar ? r : exigirRespuestaUtil(r, { tarea });
}

/**
 * Igual que llamar(), pero por STREAMING: para respuestas largas (miles de tokens de salida) la conexion
 * sin streaming se corta a los ~10 min con "Request timed out" aunque el cliente tenga un timeout mayor
 * (medido el 09/10/2026 con Opus y 32.000-64.000 tokens de salida, timeout de 40 min). El texto se junta
 * al final (`finalMessage()`): nada se usa a medias, mismo ledger, mismos errores que llamar().
 */
export async function llamarLargo(cliente, opciones = {}) {
  const { tarea = '', registrar = true, tolerar = false, dirLedger = DIR_API, ahora, respaldoClave } = opciones;
  const { params, betas, conSchema } = armarParametros(opciones);
  const t0 = Date.now();
  let res;
  let usado = null;
  try {
    res = await conRespaldoDeClave(cliente, (c) => { usado = c; return c.beta.messages.stream(betas.length ? { ...params, betas } : params).finalMessage(); }, { tarea, respaldo: respaldoClave });
  } catch (e) {
    throw new ErrorApi('api', `la API fallo${tarea ? ` (${tarea})` : ''}: ${e?.status ? `HTTP ${e.status} ` : ''}${e?.message ?? e}`, { causa: e });
  }
  const r = interpretarRespuesta(res, { modelo: params.model, conSchema, duracionMs: Date.now() - t0 });
  if (registrar) registrarGasto(r, { tarea, dir: dirLedger, ahora: ahora ?? new Date(), clave: etiquetaClave(usado?.apiKey, respaldoClave ?? {}), pedidoFable: fraseFableDe(params.model, opciones.pedidoFable) });
  return tolerar ? r : exigirRespuestaUtil(r, { tarea });
}

/** Cuantos tokens de entrada tiene un pedido, SIN gastar (count_tokens es gratis). */
export async function contarTokens(cliente, opciones = {}) {
  const { params } = armarParametros({ ...opciones, fallbacks: false });
  const pedido = { model: params.model, messages: params.messages };
  if (params.system) pedido.system = params.system;
  // Tambien con respaldo: es gratis, pero sin saldo contesta el mismo 400 y era lo primero que fallaba (11/10/2026).
  const r = await conRespaldoDeClave(cliente, (c) => c.messages.countTokens(pedido), { tarea: 'count_tokens', respaldo: opciones.respaldoClave });
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

/**
 * Corre `fn(item, i)` sobre todos los items con a lo sumo `n` a la vez. Devuelve los resultados en orden.
 * Si un `fn` tira, ningun trabajador toma un item NUEVO, los que ya estaban en curso terminan (ya se estan
 * pagando) y recien ahi sube el PRIMER error (09/10/2026, cola H18: con `Promise.all` pelado el error subia
 * enseguida pero los otros trabajadores seguian tomando items y pagando llamadas que nadie esperaba).
 */
export async function enParalelo(items, n, fn) {
  const lista = [...items];
  const out = new Array(lista.length);
  let i = 0;
  let fallo = null;                            // { error } del primero que tiro
  const trabajador = async () => {
    while (!fallo && i < lista.length) {
      const k = i++;
      try { out[k] = await fn(lista[k], k); } catch (e) { fallo ??= { error: e }; }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, lista.length)) }, trabajador));
  if (fallo) throw fallo.error;
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
  const creado = await crearLote(cliente, pedidos, { tarea });
  await esperarLote(cliente, creado.lote, { esperarMs, timeoutMs });
  const resultados = await recogerLote(cliente, creado.loteId, { tarea, conSchema: creado.conSchema, modelos: creado.modelos, pedidoFableDe: creado.pedidoFableDe, dirLedger, ahora });
  return { loteId: creado.loteId, resultados };
}

/** El `custom_id` de un pedido de lote: 1 a 64 caracteres, letras, numeros, `_` y `-` (doc de Message Batches). */
export const RE_CUSTOM_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Crea el lote y vuelve ENSEGUIDA, sin esperar (tanda 5, 17/10/2026): quien lo crea guarda `loteId` en disco antes de
 * esperar, asi un proceso que se cae en el medio no deja un lote pagado que nadie puede recoger. `lote()` es esto +
 * esperarLote + recogerLote. Devuelve { loteId, lote (el objeto del SDK), conSchema, modelos } — los dos ultimos, por
 * id de pedido, son lo que recogerLote necesita para interpretar y cobrar cada respuesta.
 */
export async function crearLote(cliente, pedidos, { tarea = '' } = {}) {
  if (!pedidos.length) throw new ErrorApi('lote', 'un lote sin pedidos no se manda');
  const ids = new Set();
  const requests = pedidos.map((p) => {
    if (!p.id || ids.has(p.id)) throw new ErrorApi('lote', `cada pedido del lote lleva un id unico: "${p.id}"`);
    if (!RE_CUSTOM_ID.test(String(p.id))) throw new ErrorApi('lote', `el id "${p.id}" no sirve como custom_id (1 a 64 caracteres: letras, numeros, _ y -)`);
    ids.add(p.id);
    const { params } = armarParametros({ ...p, fallbacks: false });
    return { custom_id: String(p.id), params };
  });
  let b;
  try { b = await cliente.messages.batches.create({ requests }); } catch (e) {
    throw new ErrorApi('api', `no se pudo crear el lote${tarea ? ` (${tarea})` : ''}: ${e?.message ?? e}`, { causa: e });
  }
  return {
    loteId: b.id,
    lote: b,
    conSchema: Object.fromEntries(pedidos.map((p) => [String(p.id), !!p.schema])),
    modelos: Object.fromEntries(pedidos.map((p) => [String(p.id), resolverModelo(p.modelo)])),
    // la frase de Fak de cada pedido a Fable (armarParametros ya la exigio): va al ledger al recoger
    pedidoFableDe: Object.fromEntries(pedidos.map((p) => [String(p.id), fraseFableDe(p.modelo, p.pedidoFable)]).filter(([, f]) => f)),
  };
}

/**
 * Espera a que el lote termine (`processing_status` 'ended'). Pasado `timeoutMs` tira ErrorApi 'lote' con `loteId`:
 * el lote sigue vivo del lado de Anthropic (vence a las 24 h) y se recoge despues. Devuelve el objeto final del lote.
 */
export async function esperarLote(cliente, loteOId, { esperarMs = 30000, timeoutMs = 55 * 60 * 1000 } = {}) {
  let b = typeof loteOId === 'string' ? await cliente.messages.batches.retrieve(loteOId) : loteOId;
  const t0 = Date.now();
  while (b.processing_status !== 'ended') {
    if (Date.now() - t0 > timeoutMs) {
      throw new ErrorApi('lote', `el lote ${b.id} sigue en curso despues de ${Math.round(timeoutMs / 60000)} min: recogerlo despues con recogerLote.`, { loteId: b.id });
    }
    await dormir(esperarMs);
    b = await cliente.messages.batches.retrieve(b.id);
  }
  return b;
}

/**
 * Los resultados de un lote ya terminado, por id de pedido: { [id]: respuesta | { error } }.
 * Registra el gasto de cada respuesta como lote. `tareaDe` ({ [id]: tarea }) anota cada pedido con su propio nombre en
 * el ledger (sin eso todos caen bajo `tarea` y no se pueden comparar dos lotes, p. ej. el mismo en high y en medium).
 */
export async function recogerLote(cliente, loteId, { tarea = '', tareaDe = {}, conSchema = {}, modelos = {}, pedidoFableDe = {}, dirLedger = DIR_API, ahora } = {}) {
  const resultados = {};
  for await (const r of await cliente.messages.batches.results(loteId)) {
    const id = String(r.custom_id);
    if (r.result?.type === 'succeeded') {
      const resp = interpretarRespuesta(r.result.message, { modelo: modelos[id] || r.result.message?.model, conSchema: !!conSchema[id], lote: true });
      registrarGasto(resp, { tarea: tareaDe[id] || tarea, lote: true, dir: dirLedger, ahora: ahora ?? new Date(), clave: etiquetaClave(cliente?.apiKey), pedidoFable: pedidoFableDe[id] ?? null });
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
