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
  crearCliente, llamar, contarTokens, estimarUsd, resolverModelo, usd, MENSAJE_SIN_CLAVE, ErrorApi,
} from './_lib/claudeApi.mjs';

export const TOPE_ADJUNTO_BYTES = 2 * 1024 * 1024;
export const EFFORTS = ['low', 'medium', 'high', 'xhigh'];
const SECRETO_RE = /(^|[\\/])(\.env(\.[\w.-]+)?|\.qr-secret)$/i;

/** true si la ruta es un archivo de secretos: esos no se mandan nunca. */
export function esSecreto(ruta) {
  return SECRETO_RE.test(String(ruta ?? '').trim());
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
    if (esSecreto(r)) throw new ErrorApi('api', `no se manda un archivo de secretos: ${r}`);
    const abs = path.resolve(raiz, r);
    if (!fs.existsSync(abs)) throw new ErrorApi('api', `no existe el adjunto ${r}`);
    const bytes = fs.statSync(abs).size;
    if (bytes > TOPE_ADJUNTO_BYTES) throw new ErrorApi('api', `el adjunto ${r} pesa ${Math.round(bytes / 1024)} KB: el tope son ${TOPE_ADJUNTO_BYTES / 1024 / 1024} MB (recortalo antes)`);
    return { ruta: path.relative(raiz, abs).replace(/\\/g, '/'), texto: fs.readFileSync(abs, 'utf8') };
  });
}

const USO = 'uso: node scripts/_apiTarea.mjs --tarea <nombre> --pedido <archivo.md> [--adjunto <ruta>]... --salida <archivo> [--modelo opus|sonnet|haiku|fable] [--effort low|medium|high|xhigh] [--sistema <archivo>] [--max-tokens N] [--estimar]';

export function leerArgumentos(argv) {
  const CON_VALOR = ['--tarea', '--pedido', '--adjunto', '--salida', '--modelo', '--effort', '--sistema', '--max-tokens', '--timeout-min'];
  const op = { adjuntos: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--estimar') { op.estimar = true; continue; }
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
  const pedido = fs.readFileSync(path.resolve(op.pedido), 'utf8');
  const adjuntos = leerAdjuntos(op.adjuntos);
  const usuario = armarMensaje({ pedido, adjuntos });
  const system = op.sistema ? fs.readFileSync(path.resolve(op.sistema), 'utf8') : undefined;
  const comun = { modelo: op.modelo, effort: op.effort, usuario, system, cacheTtl: system ? '5m' : null, maxTokens: op.maxTokens };
  const cliente = crearCliente({ timeoutMs: op.timeoutMin * 60 * 1000 });

  const entrada = await contarTokens(cliente, comun);
  const techo = estimarUsd(op.modelo, { entrada, salida: op.maxTokens });
  const tipico = estimarUsd(op.modelo, { entrada, salida: Math.min(op.maxTokens, 6000) });
  console.log(`${op.tarea}: ${resolverModelo(op.modelo)} ${op.effort} · entrada ${entrada.toLocaleString('es-AR')} tokens · ${adjuntos.length} adjunto(s) · costo estimado ${usd(tipico)} (tope ${usd(techo)} si llena los ${op.maxTokens} tokens de salida)`);
  if (op.estimar) return 0;

  const r = await llamar(cliente, { ...comun, tarea: `sesion:${op.tarea}` });
  const salida = path.resolve(op.salida);
  fs.mkdirSync(path.dirname(salida), { recursive: true });
  fs.writeFileSync(salida, r.texto.endsWith('\n') ? r.texto : `${r.texto}\n`, 'utf8');
  console.log(`Respuesta guardada en ${path.relative(process.cwd(), salida)} (${r.texto.length.toLocaleString('es-AR')} caracteres) · costo real ${usd(r.costoUsd)} · ${r.usage.input_tokens ?? 0} entrada / ${r.usage.output_tokens ?? 0} salida · ${Math.round(r.duracionMs / 1000)} s${r.fallback?.length ? ` · fallback ${r.fallback.join(', ')}` : ''}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((c) => process.exit(c)).catch((e) => {
    if (e instanceof ErrorApi && e.tipo === 'sin_clave') { console.error(MENSAJE_SIN_CLAVE); process.exit(3); }
    console.error(`Fallo: ${e?.message ?? e}`);
    process.exit(1);
  });
}
