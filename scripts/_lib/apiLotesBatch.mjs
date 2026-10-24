/**
 * apiLotesBatch.mjs — las auditorias por lotes de scripts/_apiLotes.mjs, por Message Batches (mitad de precio).
 *
 * POR QUE (tanda 5 del plan del sistema, 17/10/2026). Las 283 llamadas del 09 al 11/10 fueron pedido por pedido a
 * precio completo (`lote:false` en todo el ledger) aunque la puerta ya sabia hacer Batch. Una auditoria de 70 archivos
 * en 14 lotes cuesta US$ 14,45 con Opus y US$ 7,23 en Batch (informe afuera_api_y_gemini.md §B.3). El precio de la
 * mitad es la espera: casi todos los lotes terminan en menos de 1 hora y vencen a las 24 h (doc de Message Batches).
 * Por eso esto NO sirve para lo que alguien espera mirando: es para auditorias que se leen despues.
 *
 * Dos candados, porque un lote se paga al crearse y se cobra al recogerse:
 *   1. El id del lote se guarda en `<salidaDir>/_lote.json` APENAS se crea, antes de esperar: si el proceso se cae,
 *      `_apiLotes.mjs <jobs.json> --recoger` lo recoge despues.
 *   2. Recoger se hace UNA vez: recogerLote() anota cada respuesta en el ledger, asi que recoger dos veces duplicaria
 *      el gasto. `_lote.json` marca `recogiendo` antes de leer los resultados y `recogido` al terminar; una segunda
 *      recogida se rechaza (con `forzar` pasa, sabiendo que el ledger queda doble).
 *
 * Una respuesta vencida (`expired`), con error o cancelada no se guarda: queda listada para relanzar. Una cortada por
 * max_tokens se tira, salvo `guardarCortada` en el job (misma regla que _apiTarea.mjs --guardar-cortada).
 * Todo con el cliente inyectado: los tests usan uno falso y no llaman a la API.
 */
import fs from 'node:fs';
import path from 'node:path';
import { crearLote, recogerLote, selloLocal, DIR_API, ErrorApi, RE_CUSTOM_ID } from './claudeApi.mjs';
import { armarMensaje, leerAdjuntos, leerTextoSeguro, validarSalida, EFFORTS } from '../_apiTarea.mjs';

export const ARCHIVO_LOTE = '_lote.json';
/** Sin el problema del streaming (un lote no tiene conexion abierta), el tope de salida sube: con 32.000 se cortaron 16 respuestas el 11/10. */
export const MAX_TOKENS_LOTE = 64000;
export const HORAS_VENCE = 24;

export const rutaLote = (salidaDir) => path.join(salidaDir, ARCHIVO_LOTE);

/** El aviso que escribe el freno del ciclo de claudeApi.mjs (frenoDelCiclo) al pasar el 60 o el 85 % del tope de una clave. */
export const RE_AVISO_TOPE = /^aviso: la API va por el (\d+) % del tope del ciclo \(.* para la clave ([\w-]+);.*$/;

/**
 * Los avisos del freno del ciclo que un `_apiTarea.mjs` hijo dejo en su salida y que esta corrida todavia no mostro
 * (23/10/2026). `_apiLotes.mjs` sin --lote corre cada job como proceso aparte y solo mostraba la salida de los que
 * fallaban: el aviso de un hijo que salio bien se perdia, y con N hijos saldria N veces. Uno por clave y por umbral (60
 * u 85) en toda la corrida: `vistos` es uno solo para todos los hijos. Puro.
 */
export function avisosNuevosDelFreno(salida, vistos) {
  const nuevos = [];
  for (const l of String(salida ?? '').split(/\r?\n/)) {
    const m = RE_AVISO_TOPE.exec(l.trim());
    if (!m) continue;
    const umbral = Number(m[1]) >= 85 ? 85 : 60;
    if (vistos.has(`${m[2]}|${umbral}`)) continue;
    vistos.add(`${m[2]}|60`);
    if (umbral === 85) vistos.add(`${m[2]}|85`);
    nuevos.push(l.trim());
  }
  return nuevos;
}

/** Escribe un archivo de una vez (a .tmp y se renombra): un _lote.json a medias seria un lote que nadie puede recoger. */
function escribirAtomico(ruta, texto) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const tmp = `${ruta}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, texto, 'utf8');
  fs.renameSync(tmp, ruta);
}

export function leerEstadoLote(salidaDir) {
  const ruta = rutaLote(salidaDir);
  if (!fs.existsSync(ruta)) return null;
  try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch (e) {
    throw new ErrorApi('lote', `${ruta} no se puede leer (${e.message}): no se adivina el lote, se mira a mano`);
  }
}

const guardarEstado = (salidaDir, estado) => escribirAtomico(rutaLote(salidaDir), `${JSON.stringify(estado, null, 2)}\n`);

/** El custom_id de un job: su `tarea`. Si no sirve como id (caracteres o largo), se frena antes de pagar. */
export function idDeTarea(tarea) {
  const id = String(tarea ?? '').trim();
  if (!RE_CUSTOM_ID.test(id)) throw new ErrorApi('lote', `la tarea "${tarea}" no sirve como id del lote (1 a 64 caracteres: letras, numeros, _ y -)`);
  return id;
}

/**
 * De los jobs del runner a los pedidos del lote, con los mismos candados que _apiTarea.mjs (sin secretos, sin
 * adjuntos de mas de 2 MB, la salida validada antes de pagar). Puro salvo leer los archivos de entrada.
 * job: { tarea, pedido, adjuntos, modelo, effort, maxTokens, guardarCortada, sistema, pedidoFable (solo con Fable) }
 */
export function armarPedidosLote(jobs, { raiz = process.cwd(), salidaDir } = {}) {
  if (!salidaDir) throw new ErrorApi('lote', 'falta salidaDir');
  const vistos = new Set();
  return jobs.map((job) => {
    const id = idDeTarea(job.tarea);
    if (vistos.has(id)) throw new ErrorApi('lote', `dos jobs con la misma tarea "${id}"`);
    vistos.add(id);
    const effort = job.effort || 'high';
    if (!EFFORTS.includes(effort)) throw new ErrorApi('lote', `effort "${effort}" en ${id}: va con ${EFFORTS.join('|')}`);
    const pedido = leerTextoSeguro(job.pedido, { raiz, que: 'pedido' });
    const adjuntos = leerAdjuntos(job.adjuntos || [], { raiz });
    const system = job.sistema ? leerTextoSeguro(job.sistema, { raiz, que: 'system' }) : undefined;
    const salida = path.join(salidaDir, `${id}.md`);
    validarSalida(salida, { raiz, entradas: [job.pedido, ...(job.adjuntos || []), ...(job.sistema ? [job.sistema] : [])] });
    return {
      id,
      tarea: id,
      salida,
      guardarCortada: Boolean(job.guardarCortada),
      opciones: {
        modelo: job.modelo || 'opus',
        effort,
        usuario: armarMensaje({ pedido, adjuntos }),
        system,
        cacheTtl: system ? '1h' : null,   // en lote el contexto compartido se cachea 1 h (doc de Batches)
        maxTokens: Number(job.maxTokens) || MAX_TOKENS_LOTE,
        // Fable solo con la frase de Fak (la exige armarParametros al crear el lote; va al ledger al recoger)
        ...(job.pedidoFable ? { pedidoFable: job.pedidoFable } : {}),
      },
    };
  });
}

/**
 * Crea el lote y deja `_lote.json` escrito ANTES de volver. Si en la carpeta hay un lote sin recoger, no manda otro:
 * serian dos lotes pagados con las mismas salidas.
 */
export async function mandarLote(cliente, { jobs, salidaDir, raiz = process.cwd(), tarea = 'lotes', ahora = new Date() }) {
  const previo = leerEstadoLote(salidaDir);
  if (previo && !previo.recogido) {
    throw new ErrorApi('lote', `en ${salidaDir} hay un lote sin recoger (${previo.loteId}, creado ${previo.creado}): recogerlo con --recoger antes de mandar otro`);
  }
  const pedidos = armarPedidosLote(jobs, { raiz, salidaDir });
  const creado = await crearLote(cliente, pedidos.map((p) => ({ id: p.id, ...p.opciones })), { tarea });
  const estado = {
    loteId: creado.loteId,
    tarea,
    creado: selloLocal(ahora),
    creadoMs: ahora.getTime(),
    pedidos: pedidos.map((p) => ({ id: p.id, salida: p.salida, modelo: creado.modelos[p.id], effort: p.opciones.effort, maxTokens: p.opciones.maxTokens, guardarCortada: p.guardarCortada })),
    modelos: creado.modelos,
    conSchema: creado.conSchema,
    pedidoFableDe: creado.pedidoFableDe,
    recogiendo: null,
    recogido: null,
  };
  try {
    guardarEstado(salidaDir, estado);
  } catch (e) {
    // el lote ya esta creado (y se va a cobrar): su id tiene que quedar a la vista para recogerlo a mano (auditor 17/10)
    throw new ErrorApi('lote', `el lote ${creado.loteId} se creo pero no pude escribir ${rutaLote(salidaDir)} (${e.message}): anotar ese id y recogerlo a mano con recogerLote`, { loteId: creado.loteId });
  }
  return { estado, lote: creado.lote };
}

/**
 * Recoge el lote guardado en `<salidaDir>/_lote.json`, si ya termino. Devuelve:
 *   { estado: 'en_curso', horas, aviso }                         el lote sigue: volver a correr --recoger mas tarde
 *   { estado: 'recogido', filas: [{ id, resultado, detalle }], costoUsd, relanzar: [ids] }
 * resultado de cada fila: ok · cortada (guardada con aviso) · cortada_tirada · rechazo · vencido · error · cancelado · sin_resultado
 */
export async function recogerGuardado(cliente, { salidaDir, ahora = new Date(), forzar = false, dirLedger = DIR_API } = {}) {
  const estado = leerEstadoLote(salidaDir);
  if (!estado) throw new ErrorApi('lote', `no hay ${ARCHIVO_LOTE} en ${salidaDir}: no hay lote que recoger`);
  if ((estado.recogido || estado.recogiendo) && !forzar) {
    const cuando = estado.recogido || estado.recogiendo;
    const como = estado.recogido ? 'ya se recogio' : 'una recogida anterior se corto a mitad';
    throw new ErrorApi('lote', `el lote ${estado.loteId} ${como} (${cuando}): sus gastos ya estan en el ledger y recogerlo otra vez los duplica (--forzar si hace falta igual)`);
  }
  const b = await cliente.messages.batches.retrieve(estado.loteId);
  const horas = Math.round(((ahora.getTime() - Number(estado.creadoMs)) / 3600000) * 10) / 10;
  if (b.processing_status !== 'ended') {
    const aviso = horas >= HORAS_VENCE
      ? `lleva ${horas} h: pasadas las 24 h Anthropic lo cierra y lo que falte vuelve como vencido`
      : `lleva ${horas} h (casi todos terminan en menos de 1 h; vence a las 24 h)`;
    return { estado: 'en_curso', horas, aviso, loteId: estado.loteId };
  }
  guardarEstado(salidaDir, { ...estado, recogiendo: selloLocal(ahora) });
  // cada pedido con su nombre en el ledger, como `sesion:<tarea>` igual que _apiTarea.mjs (y con su effort, para medir)
  const tareaDe = Object.fromEntries(estado.pedidos.map((p) => [p.id, `sesion:${p.id}${p.effort ? `@${p.effort}` : ''}`]));
  const resultados = await recogerLote(cliente, estado.loteId, { tarea: estado.tarea, tareaDe, conSchema: estado.conSchema || {}, modelos: estado.modelos || {}, pedidoFableDe: estado.pedidoFableDe || {}, dirLedger, ahora });
  const filas = [];
  let costoUsd = 0;
  for (const p of estado.pedidos) {
    const r = resultados[p.id];
    if (!r) { filas.push({ id: p.id, resultado: 'sin_resultado', detalle: 'el lote no trajo este pedido' }); continue; }
    if (r.error) {
      const resultado = r.error === 'expired' ? 'vencido' : r.error === 'canceled' ? 'cancelado' : 'error';
      filas.push({ id: p.id, resultado, detalle: r.detalle ?? r.error });
      continue;
    }
    costoUsd += Number(r.costoUsd) || 0;
    if (r.rechazo) { filas.push({ id: p.id, resultado: 'rechazo', detalle: `categoria ${r.rechazo.categoria ?? 'sin categoria'}`, costoUsd: r.costoUsd }); continue; }
    if (r.truncado && !p.guardarCortada) {
      filas.push({ id: p.id, resultado: 'cortada_tirada', detalle: `cortada por max_tokens (${p.maxTokens}): no se guarda; relanzar con mas maxTokens o guardarCortada`, costoUsd: r.costoUsd });
      continue;
    }
    const aviso = r.truncado
      ? `> ⚠ RESPUESTA CORTADA por max_tokens (${Number(p.maxTokens).toLocaleString('es-AR')} tokens de salida, ${r.usage?.output_tokens ?? '?'} usados): falta el final.\n\n`
      : '';
    escribirAtomico(p.salida, `${aviso}${r.texto.endsWith('\n') ? r.texto : `${r.texto}\n`}`);
    filas.push({ id: p.id, resultado: r.truncado ? 'cortada' : 'ok', detalle: `${r.usage?.input_tokens ?? 0} entrada / ${r.usage?.output_tokens ?? 0} salida`, costoUsd: r.costoUsd, salida: p.salida });
  }
  costoUsd = Math.round(costoUsd * 1e6) / 1e6;
  const relanzar = filas.filter((f) => !['ok', 'cortada'].includes(f.resultado)).map((f) => f.id);
  guardarEstado(salidaDir, { ...estado, recogiendo: estado.recogiendo ?? selloLocal(ahora), recogido: selloLocal(ahora), filas, costoUsd, relanzar });
  return { estado: 'recogido', filas, costoUsd, relanzar, loteId: estado.loteId };
}
