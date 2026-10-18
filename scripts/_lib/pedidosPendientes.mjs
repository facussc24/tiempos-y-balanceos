/**
 * pedidosPendientes.mjs — los PEDIDO N de la carpeta FACUNDO de la nube de Ingenieria que estan dirigidos a ESTA PC y
 * todavia no tienen su «listo». Tanda 1.7 del plan del sistema (16/10/2026).
 *
 * Fak, 16/10/2026 10:55, con la captura de su PC principal que decia «todavia no lo encuentro» (el PEDIDO 8 estaba escrito
 * desde las 09:56): *«el Claude de mi PC principal no sabe como se comunican mis 2 notebooks»*. El canal existe desde el
 * 09/10 (memoria reference_canal_entre_pcs_pedidos_facundo) pero ninguna sesion lo miraba al arrancar.
 *
 * Como se lee un pedido (formato real de la carpeta, copiado tal cual):
 *   - archivo `PEDIDO N - <que> - <dd-mm-aaaa>.txt`; primer renglon `PEDIDO N PARA TU CLAUDE (PC principal) - fecha hora`
 *     o `PEDIDO N PARA LA SESION DE LA NOTEBOOK DE CALIDAD (CATA) - fecha hora`; segundo renglon `Lo escribio la sesion
 *     de <origen>, a pedido de Fak.`
 *   - hecho: `PEDIDO N - listo <que>.txt` (la marca cierra SOLO su numero: «PEDIDO 6 - listo» no cierra al 5).
 *   - reemplazado: primer renglon con `*** REEMPLAZADO ***` (no se hace; no se nombra).
 *   - sin numero (los de antes del 14/10, cuando no habia numeracion ni marca «listo»): NO se nombran. No hay forma de
 *     cerrarlos y se dieron por hechos en el chat de esos dias (auditor 16/10, H1).
 *   - destino que no se entiende: se nombra en las DOS PC, con la aclaracion, antes que perderlo (auditor 16/10, H5).
 *   - que PC soy: COMPUTERNAME contra `pc_principal` del canon; cualquier otro nombre es una notebook. Un pedido «para la
 *     notebook» que nombra a CATA le llega solo a la PC que se llama CATA; uno sin nombre, a cualquier notebook (H6).
 *   - los numerados de antes de `listo_desde` (cuando no se dejaba marca) van en UN solo renglon.
 *
 * Uso:
 *   node scripts/_lib/pedidosPendientes.mjs --hook     imprime los renglones (nada si no hay); siempre sale con 0.
 *   BARACK_FACUNDO=<carpeta> y BARACK_PC=principal|notebook: para las pruebas (y para mirar la carpeta de otra PC).
 * Lo llama el hook GLOBAL ~/.claude/hooks/pedidos-pendientes.sh (SessionStart) con copia en .claude/hooks/.
 * Limites conocidos: un pedido cuyo «que» empiece con la palabra «listo» se leeria como marca; el renglon dice que no
 * hay marca «listo», no que el trabajo no se hizo. Tests: __tests__/scripts/pedidosPendientes.test.mjs.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buscarBiblioteca, resolverCarpeta } from './nubeRutas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const CANON = JSON.parse(fs.readFileSync(path.join(AQUI, 'pedidosCanon.data.json'), 'utf8'));
export const MARCA = CANON.marca;

const RE_PEDIDO = /^PEDIDO\b.*\.txt$/i;
const RE_NUMERO = /^PEDIDO\s+(\d+[a-z]?(?:\s+de\s+\d+)?)\b/i;
const RE_LISTO = /^PEDIDO\s+(\d+[a-z]?(?:\s+de\s+\d+)?)\s*-?\s*listo\b/i;
const RE_FECHA_NOMBRE = /(\d{2})-(\d{2})-(\d{4})\.txt$/i;
const RE_FECHA_HORA = /(\d{2})\/(\d{2})\/(\d{4})\s*(?:~\s*)?(\d{1,2}:\d{2})?/;

const normalizar = (n) => String(n).toLowerCase().replace(/\s+/g, ' ').trim();
const fechaCorta = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
const horaOrden = (h) => (h ? h.padStart(5, '0') : '');

/** 'principal' si el nombre de maquina es el de la PC principal del canon; si no, 'notebook'. */
export function quienSoy(nombreMaquina = process.env.COMPUTERNAME || os.hostname()) {
  const n = String(nombreMaquina || '').trim().toUpperCase();
  return CANON.pc_principal.some((x) => String(x).toUpperCase() === n) ? 'principal' : 'notebook';
}

/**
 * A quien va un pedido, por su primer renglon.
 * @returns {{a: 'principal'|'notebook'|'todos'|'reemplazado', notebook: string|null}} `notebook` es el nombre que el
 *   encabezado le da a la notebook (CATA) o null si no la nombra; `todos` = no se entiende: se nombra en las dos PC.
 */
export function destinoDe(primerRenglon) {
  const l = String(primerRenglon || '');
  if (/REEMPLAZADO/i.test(l)) return { a: 'reemplazado', notebook: null };
  if (/PC\s+principal|\ben\s+tu\s+PC\b|TU\s+CLAUDE|PC\s+de\s+Fak/i.test(l)) return { a: 'principal', notebook: null };
  if (/NOTEBOOK|\(CATA\)/i.test(l)) return { a: 'notebook', notebook: /\bCATA\b/i.test(l) ? 'CATA' : null };
  return { a: 'todos', notebook: null };
}

/** Quien lo escribio, por el segundo renglon: 'CATA', 'la PC principal' o ''. */
export function origenDe(segundoRenglon) {
  const l = String(segundoRenglon || '');
  if (/notebook de Calidad|\(CATA\)|\bCATA\b/i.test(l)) return 'CATA';
  if (/PC\s+principal|PC\s+de\s+Fak/i.test(l)) return 'la PC principal';
  return '';
}

/** Lo que el nombre del archivo dice del pedido: `PEDIDO 8 - mail a Luca - IMDS Upper Trim 16-10-2026.txt` -> `mail a Luca - IMDS Upper Trim`. */
export function queDe(nombre) {
  return String(nombre).replace(/\.txt$/i, '')
    .replace(/^PEDIDO\s+(\d+[a-z]?(?:\s+de\s+\d+)?)?\s*-?\s*/i, '')
    .replace(/\s*-?\s*\d{2}-\d{2}-\d{4}\s*$/, '').trim();
}

/** Un archivo PEDIDO leido: numero, si es la marca «listo» (y de cual), destino, origen, fecha (ISO) y hora. */
export function leerPedido(nombre, cabecera = []) {
  const [l1 = '', l2 = ''] = cabecera;
  const num = (nombre.match(RE_NUMERO) || [])[1];
  const listo = nombre.match(RE_LISTO);
  const fn = nombre.match(RE_FECHA_NOMBRE);
  const fh = l1.match(RE_FECHA_HORA);
  const fecha = fn ? `${fn[3]}-${fn[2]}-${fn[1]}` : fh ? `${fh[3]}-${fh[2]}-${fh[1]}` : null;
  const d = destinoDe(l1);
  return {
    nombre, que: queDe(nombre),
    numero: num ? normalizar(num) : null,
    esListo: !!listo, listoDe: listo ? normalizar(listo[1]) : null,
    destino: d.a, notebook: d.notebook, origen: origenDe(l2),
    fecha, hora: fh && fh[4] ? fh[4] : null,
  };
}

const esParaMi = (p, pc, nombre) => {
  if (p.destino === 'todos') return true;
  if (p.destino !== pc) return false;
  if (pc !== 'notebook' || !p.notebook || !nombre) return true;
  return p.notebook.toUpperCase() === String(nombre).toUpperCase();
};

/**
 * Funcion pura: que renglones le llegan a la sesion de ESTA PC.
 * @param {{archivos: {nombre: string, cabecera?: string[]}[], pc: 'principal'|'notebook', nombre?: string}} o
 *   `nombre` es el COMPUTERNAME (para que un pedido «para CATA» no le llegue a la otra notebook).
 * @returns {{lineas: string[], nuevos: object[], viejos: object[]}}
 */
export function pedidosPendientes({ archivos, pc, nombre = '', carpeta = CANON.carpeta_nombre }) {
  // cada archivo puede traer la carpeta donde esta (con las dos carpetas, la nueva y la vieja, se leen las dos)
  const pedidos = (archivos || []).filter((a) => RE_PEDIDO.test(a.nombre)).map((a) => ({ ...leerPedido(a.nombre, a.cabecera || []), carpeta: a.carpeta }));
  const listos = new Set(pedidos.filter((p) => p.esListo).map((p) => p.listoDe));
  // Sin numero no hay forma de cerrarlo (son los de antes del 14/10, hechos en su momento): no se nombran.
  const abiertos = pedidos.filter((p) => !p.esListo && p.numero && !listos.has(p.numero) && esParaMi(p, pc, nombre));
  const desde = CANON.listo_desde;
  const orden = (a, b) => `${a.fecha || ''} ${horaOrden(a.hora)}`.localeCompare(`${b.fecha || ''} ${horaOrden(b.hora)}`);
  const nuevos = abiertos.filter((p) => !p.fecha || p.fecha >= desde).sort(orden);
  const viejos = abiertos.filter((p) => !nuevos.includes(p)).sort(orden);
  const lineas = [];
  for (const p of nuevos) {
    const cuando = [p.origen ? `de ${p.origen}` : '', `${fechaCorta(p.fecha)}${p.hora ? ` ${p.hora}` : ''}`.trim()].filter(Boolean).join(', ');
    const aclaracion = p.destino === 'todos' ? ' [el encabezado no dice para que PC es: mirarlo]' : '';
    lineas.push(`${MARCA} Hay un pedido para esta PC sin su «listo»: PEDIDO ${p.numero} - ${p.que}${cuando ? ` (${cuando})` : ''}${aclaracion}. ` +
      `Esta en la carpeta ${p.carpeta || carpeta} de la nube de Ingenieria; si ya se hizo o cuando se haga, dejar «PEDIDO ${p.numero} - listo <que>.txt» ahi mismo.`);
  }
  if (viejos.length) {
    const etiqueta = (p) => `PEDIDO ${p.numero} (${p.que})`;
    lineas.push(`${MARCA} Ademas hay ${viejos.length} pedido(s) para esta PC sin marca «listo» de antes del ${fechaCorta(desde)} ` +
      `(cuando todavia no se dejaba): ${viejos.map(etiqueta).join(', ')}. Si ya se hicieron, dejarles su «listo» una vez y esto deja de salir.`);
  }
  return { lineas, nuevos, viejos };
}

/** Los primeros renglones de un archivo de texto; UTF-8 o UTF-16 (BOM FF FE) — un pedido escrito desde PowerShell. */
export function primerosRenglones(ruta, n = 2) {
  try {
    const b = fs.readFileSync(ruta);
    const t = (b.length >= 2 && b[0] === 0xFF && b[1] === 0xFE) ? b.subarray(2).toString('utf16le') : b.toString('utf8').replace(/^﻿/, '');
    return t.split(/\r?\n/).slice(0, n);
  } catch { return []; }
}

/** Lee la carpeta real (o BARACK_FACUNDO) y devuelve los renglones para esta PC; [] si la nube no esta. */
export function renglonesDeLaCarpeta({ carpeta = process.env.BARACK_FACUNDO, pc = process.env.BARACK_PC || quienSoy(), nombre = process.env.COMPUTERNAME || os.hostname() } = {}) {
  // [ruta, nombre que dice el aviso] de cada carpeta que se lee
  let dirs = carpeta ? [[carpeta, undefined]] : null;
  if (!dirs) {
    const bib = buscarBiblioteca();
    if (!bib) return [];
    // Desde la mudanza del 17/10/2026 la carpeta FACUNDO vive entera en «ASISTENTE INGENIERIA\6- PEDIDOS ENTRE PC
    // (FACUNDO)» (clave «pedidos» del canon de carpetas). Se leen la nueva Y la vieja si estan las dos: una PC que todavia
    // no tiene el codigo nuevo (CATA hasta su git pull) deja sus pedidos en la vieja, y no se pueden perder (auditor
    // ronda 3, 18/10). Cada aviso nombra la carpeta donde esta su pedido.
    const r = resolverCarpeta(CANON.carpeta_clave, bib);
    dirs = [r.nueva, ...r.viejas].filter((d) => { try { return fs.statSync(d).isDirectory(); } catch { return false; } })
      .map((d) => [d, path.relative(bib, d)]);
  }
  const archivos = [];
  for (const [dir, nombreCarpeta] of dirs) {
    let nombres;
    try { nombres = fs.readdirSync(dir); } catch { continue; }
    for (const n of nombres) if (RE_PEDIDO.test(n)) archivos.push({ nombre: n, cabecera: primerosRenglones(path.join(dir, n)), carpeta: nombreCarpeta });
  }
  return pedidosPendientes({ archivos, pc: pc === 'notebook' ? 'notebook' : 'principal', nombre }).lineas;
}

const esPrincipal = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal && process.argv.includes('--hook')) {
  try {
    const lineas = renglonesDeLaCarpeta();
    if (lineas.length) process.stdout.write(`${lineas.join('\n')}\n`);
  } catch { /* un aviso de arranque nunca frena una sesion */ }
  process.exit(0);
}
