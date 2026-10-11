/**
 * _apiTarea.mjs — le manda a la API de Claude (los creditos del plan Max) un pedido con archivos adjuntos
 * y guarda la respuesta en un archivo. Es el puente para hacer POR LA API lo que no necesita herramientas:
 * revisar un diff, sintetizar informes, redactar un borrador, clasificar textos. Fak, 09/10/2026: *"durante
 * esta sesion quiero que uses todo lo posible la API... para no consumirle los tokens del plan"*.
 *
 * Uso:
 *   node scripts/_apiTarea.mjs --tarea <nombre> --pedido <archivo.md> [--adjunto <ruta>]... --salida <archivo>
 *                              [--modelo opus|sonnet|haiku|fable] [--effort low|medium|high|xhigh]
 *                              [--sistema <archivo>] [--max-tokens N] [--timeout-min N] [--estimar]
 *
 *   --timeout-min cuanto se espera la respuesta (30 por defecto: una salida larga de Opus pasa los 10 min)
 *   --pedido     el texto del pedido (un .md con las instrucciones); va tal cual como mensaje del usuario
 *   --adjunto    cada archivo va adentro del mensaje, entre <archivo ruta="..."> y </archivo>; varios, en orden
 *   --salida     donde se guarda el texto de la respuesta (crea la carpeta si falta)
 *   --sistema    un archivo con el system prompt (opcional; se cachea 5 min por si se repite)
 *   --estimar    cuenta los tokens de entrada (count_tokens es gratis) y dice cuanto costaria; no llama
 *
 * Lo que NO hace: no manda un archivo de secretos (.env*, .qr-secret) ni uno de mas de 2 MB, no imprime la
 * clave, no escribe en ningun lado salvo --salida. Cada llamada queda en el ledger como `sesion:<tarea>`
 * (`node scripts/_claude.mjs --ledger`). La unica puerta a la API sigue siendo scripts/_lib/claudeApi.mjs
 * (regla api-claude.md). Sale con 0 ok · 1 fallo · 2 argumento · 3 falta la clave.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  crearCliente, llamarLargo, contarTokens, estimarUsd, resolverModelo, usd, MENSAJE_SIN_CLAVE, ErrorApi, exigirRespuestaUtil,
} from './_lib/claudeApi.mjs';

export const TOPE_ADJUNTO_BYTES = 2 * 1024 * 1024;
export const EFFORTS = ['low', 'medium', 'high', 'xhigh'];
const SECRETO_RE = /(^|[\\/])(\.env(\.[\w.-]+)?|\.qr-secret)$/i;

/**
 * La ruta REAL que se va a abrir: sin barra final, sin `::$DATA`, sin nombre corto 8.3 ni enlaces
 * (`realpathSync.native`). El candado mira ESTO, no el texto del argumento (auditor 09/10/2026: con
 * `.env.local/`, `.env.local::$DATA` o `ENV~1.LOC` el chequeo por texto dejaba pasar la clave).
 */
export function rutaReal(ruta, { raiz = process.cwd() } = {}) {
  const limpia = String(ruta ?? '').trim().replace(/::\$DATA$/i, '');
  const abs = path.resolve(raiz, limpia);
  try { return fs.realpathSync.native(abs); } catch { return abs; }
}

/** true si la ruta (la real, y tambien el texto tal cual) es un archivo de secretos: esos no se mandan nunca. */
export function esSecreto(ruta, opciones = {}) {
  const texto = String(ruta ?? '').trim().replace(/::\$DATA$/i, '').replace(/[\\/]+\.?$/, '');
  return SECRETO_RE.test(path.basename(rutaReal(ruta, opciones))) || SECRETO_RE.test(texto);
}

/** Lee un archivo de texto que va a la API (el pedido, el system) con el mismo candado que los adjuntos. */
export function leerTextoSeguro(ruta, { raiz = process.cwd(), que = 'archivo' } = {}) {
  if (esSecreto(ruta, { raiz })) throw new ErrorApi('api', `no se manda un archivo de secretos como ${que}: ${ruta}`);
  const real = rutaReal(ruta, { raiz });
  if (!fs.existsSync(real) || fs.statSync(real).isDirectory()) throw new ErrorApi('api', `no existe el ${que} ${ruta}`);
  return fs.readFileSync(real, 'utf8');
}

/** La salida se valida ANTES de pagar: ni una carpeta, ni un secreto, ni uno de los archivos que entran. */
export function validarSalida(ruta, { raiz = process.cwd(), entradas = [] } = {}) {
  const real = rutaReal(ruta, { raiz });
  if (esSecreto(ruta, { raiz })) throw new ErrorApi('api', `--salida no puede ser un archivo de secretos: ${ruta}`);
  if (fs.existsSync(real) && fs.statSync(real).isDirectory()) throw new ErrorApi('api', `--salida es una carpeta, tiene que ser un archivo: ${ruta}`);
  const mismos = entradas.map((e) => rutaReal(e, { raiz }).toLowerCase());
  if (mismos.includes(real.toLowerCase())) throw new ErrorApi('api', `--salida no puede pisar un archivo que entra al pedido: ${ruta}`);
  return real;
}

/**
 * Arma el mensaje del usuario: el pedido, y debajo cada adjunto entre etiquetas con su ruta relativa
 * (para que el modelo pueda citar `archivo:linea`). Puro: no lee disco.
 */
export function armarMensaje({ pedido, adjuntos = [] }) {
  const partes = [String(pedido ?? '').trim()];
  if (adjuntos.length) {
    partes.push('', `--- ${adjuntos.length} archivo(s) adjunto(s) ---`);
    for (const { ruta, texto } of adjuntos) {
      partes.push('', `<archivo ruta="${ruta}">`, String(texto ?? '').replace(/\r\n/g, '\n'), '</archivo>');
    }
  }
  return partes.join('\n');
}

/** Lee los adjuntos con sus candados. Tira con el motivo si uno no se puede mandar. */
export function leerAdjuntos(rutas, { raiz = process.cwd() } = {}) {
  return rutas.map((r) => {
    if (esSecreto(r, { raiz })) throw new ErrorApi('api', `no se manda un archivo de secretos: ${r}`);
    const abs = rutaReal(r, { raiz });
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) throw new ErrorApi('api', `no existe el adjunto ${r}`);
    const bytes = fs.statSync(abs).size;
    if (bytes > TOPE_ADJUNTO_BYTES) throw new ErrorApi('api', `el adjunto ${r} pesa ${Math.round(bytes / 1024)} KB: el tope son ${TOPE_ADJUNTO_BYTES / 1024 / 1024} MB (recortalo antes)`);
    return { ruta: path.relative(rutaReal(raiz), abs).replace(/\\/g, '/'), texto: fs.readFileSync(abs, 'utf8') };
  });
}

const USO = 'uso: node scripts/_apiTarea.mjs --tarea <nombre> --pedido <archivo.md> [--adjunto <ruta>]... --salida <archivo> [--modelo opus|sonnet|haiku|fable] [--effort low|medium|high|xhigh] [--sistema <archivo>] [--max-tokens N] [--guardar-cortada] [--estimar]';

export function leerArgumentos(argv) {
  const CON_VALOR = ['--tarea', '--pedido', '--adjunto', '--salida', '--modelo', '--effort', '--sistema', '--max-tokens', '--timeout-min'];
  const op = { adjuntos: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--estimar') { op.estimar = true; continue; }
    // Por defecto una respuesta cortada por max_tokens se tira (regla api-claude.md §2). Con esta bandera se
    // GUARDA con un aviso arriba: el 11/10/2026 tres borradores de codigo ($4,96) se cortaron en 32.000 tokens
    // y se perdieron enteros; un borrador a medias se puede completar, uno tirado no.
    if (a === '--guardar-cortada') { op.guardarCortada = true; continue; }
    if (CON_VALOR.includes(a) && i + 1 < argv.length) {
      const v = argv[++i];
      if (a === '--adjunto') op.adjuntos.push(v); else op[a.slice(2)] = v;
      continue;
    }
    throw new ErrorApi('api', `no conozco el argumento ${a}. No hago nada.\n${USO}`);
  }
  if (!op.tarea || !op.pedido || (!op.salida && !op.estimar)) throw new ErrorApi('api', `faltan --tarea, --pedido o --salida.\n${USO}`);
  op.modelo = op.modelo || 'opus';
  resolverModelo(op.modelo);
  op.effort = op.effort || 'high';
  if (!EFFORTS.includes(op.effort)) throw new ErrorApi('api', `--effort va con ${EFFORTS.join('|')} (max nunca se pide: regla techo-agentes.md)`);
  op.maxTokens = op['max-tokens'] ? Number(op['max-tokens']) : 32000;
  if (!Number.isInteger(op.maxTokens) || op.maxTokens < 256) throw new ErrorApi('api', '--max-tokens tiene que ser un entero (>= 256)');
  // Una respuesta larga de Opus tarda mas de los 10 min que espera crearCliente() por defecto (09/10/2026:
  // "Request timed out" con 40.000 tokens de salida). 30 min por defecto; se puede subir.
  op.timeoutMin = op['timeout-min'] ? Number(op['timeout-min']) : 30;
  if (!Number.isInteger(op.timeoutMin) || op.timeoutMin < 1 || op.timeoutMin > 120) throw new ErrorApi('api', '--timeout-min tiene que ser un entero entre 1 y 120');
  return op;
}

async function main(argv) {
  let op;
  try { op = leerArgumentos(argv); } catch (e) { console.error(e.message); return 2; }
  const pedido = leerTextoSeguro(op.pedido, { que: 'pedido' });
  const adjuntos = leerAdjuntos(op.adjuntos);
  const usuario = armarMensaje({ pedido, adjuntos });
  const system = op.sistema ? leerTextoSeguro(op.sistema, { que: 'system' }) : undefined;
  const salida = op.estimar ? null : validarSalida(op.salida, { entradas: [op.pedido, ...op.adjuntos, ...(op.sistema ? [op.sistema] : [])] });
  // fallbacks: false — un pedido a Opus tiene que volver de Opus; el 09/10/2026 el fallback del servidor
  // devolvio "claude-opus-4-8" y el trabajo se perdio. Un rechazo es un error y se ve, no se tapa con otro modelo.
  const comun = { modelo: op.modelo, effort: op.effort, usuario, system, cacheTtl: system ? '5m' : null, maxTokens: op.maxTokens, fallbacks: false };
  const cliente = crearCliente({ timeoutMs: op.timeoutMin * 60 * 1000 });

  const entrada = await contarTokens(cliente, comun);
  const techo = estimarUsd(op.modelo, { entrada, salida: op.maxTokens });
  const tipico = estimarUsd(op.modelo, { entrada, salida: Math.min(op.maxTokens, 6000) });
  console.log(`${op.tarea}: ${resolverModelo(op.modelo)} ${op.effort} · entrada ${entrada.toLocaleString('es-AR')} tokens · ${adjuntos.length} adjunto(s) · costo estimado ${usd(tipico)} (tope ${usd(techo)} si llena los ${op.maxTokens} tokens de salida)`);
  if (op.estimar) return 0;

  // Por streaming: sin streaming la conexion se corta a los ~10 min aunque el timeout sea mayor (09/10/2026).
  const r = await llamarLargo(cliente, { ...comun, tarea: `sesion:${op.tarea}`, tolerar: Boolean(op.guardarCortada) });
  // Con --guardar-cortada solo se tolera el corte por max_tokens: un rechazo sigue siendo un error (respuesta vacia).
  if (op.guardarCortada && r.rechazo) exigirRespuestaUtil(r, { tarea: `sesion:${op.tarea}` });
  fs.mkdirSync(path.dirname(salida), { recursive: true });
  const aviso = r.truncado
    ? `> ⚠ RESPUESTA CORTADA por max_tokens (${op.maxTokens.toLocaleString('es-AR')} tokens de salida, ${r.usage.output_tokens ?? '?'} usados): falta el final. Pedir la continuacion o subir --max-tokens.\n\n`
    : '';
  fs.writeFileSync(salida, `${aviso}${r.texto.endsWith('\n') ? r.texto : `${r.texto}\n`}`, 'utf8');
  if (r.truncado) console.log(`CORTADA por max_tokens (${op.tarea}): se guardo a medias en ${path.relative(process.cwd(), salida)}${r.texto.trim() ? '' : ' (SIN TEXTO: el corte cayo mientras pensaba)'}`);
  console.log(`Respuesta guardada en ${path.relative(process.cwd(), salida)} (${r.texto.length.toLocaleString('es-AR')} caracteres) · costo real ${usd(r.costoUsd)} · ${r.usage.input_tokens ?? 0} entrada / ${r.usage.output_tokens ?? 0} salida · ${Math.round(r.duracionMs / 1000)} s${r.fallback?.length ? ` · fallback ${r.fallback.join(', ')}` : ''}${r.modeloRespuesta && r.modeloRespuesta !== r.modelo ? ` · OJO: contesto ${r.modeloRespuesta}` : ''}`);
  // Una respuesta cortada guardada sale con 4, no con 0: quien lanza lotes y mira solo el codigo se entera (auditor Opus 03:00).
  return r.truncado ? 4 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((c) => process.exit(c)).catch((e) => {
    if (e instanceof ErrorApi && e.tipo === 'sin_clave') { console.error(MENSAJE_SIN_CLAVE); process.exit(3); }
    console.error(`Fallo: ${e?.message ?? e}`);
    process.exit(1);
  });
}
