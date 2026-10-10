/**
 * vigilarPrecios.mjs — el vigilante semanal de precios, creditos y retiro de modelos de Anthropic.
 *
 * POR QUE EXISTE (08/10/2026). Los precios de `PRECIOS` (claudeApi.mjs) se copiaron a mano de la
 * tabla oficial, y el informe del 07/10 tenia mal Sonnet y las lecturas de cache (regla
 * `api-claude.md` §1). Esto lo mira una vez por semana, sin modelo y sin gastar un centavo: baja tres
 * paginas oficiales de Anthropic y compara.
 *
 *   pricing           -> los 4 modelos que usamos (Haiku 5.5, Sonnet 5.5, Opus 5.5, Fable 5.1): entrada,
 *                        salida, lectura de cache, escritura de cache de 5 min y de 1 h, por millon de
 *                        tokens (Haiku con sus dos filas segun el largo del pedido) contra `PRECIOS`.
 *   api-credits-...   -> monto del credito por plan (Max 5x, Max 20x, Team), si vence al final del ciclo
 *                        de facturacion y no se acumula, y si cubre Claude Code (la regla dice que NO).
 *   model-deprecations-> si alguno de los 4 modelos esta deprecado/retirado o tiene fecha de retiro.
 *
 * POR QUE MARKDOWN Y NO HTML (probado el 08/10/2026 contra las tres paginas). Con `Accept:
 * text/markdown` el servidor devuelve la pagina como markdown (tambien con el sufijo `.md`):
 *   - pricing pesa 49 KB en markdown y 936 KB en HTML (Next.js);
 *   - el markdown trae tablas planas de GitHub (`| a | b |`); el HTML trae 13 tablas con clases de
 *     utilidades que cambian en cada deploy, encabezado de DOS filas, `rowSpan` en la fila de Haiku,
 *     una descripcion pegada al nombre del modelo ("Claude Opus 5.5 For long-running...") y las
 *     columnas en OTRO orden (Input, Output, 5m, 1h, Hits; el markdown es Input, 5m, 1h, Hits, Output);
 *   - buscar "Claude Opus 5.5" como texto en el HTML cae primero en el menu lateral, no en la tabla.
 * Por eso el parser lee SOLO markdown, mapea las columnas por el NOMBRE del encabezado (nunca por
 * posicion) y si el servidor devuelve HTML es un ERROR (codigo 1), no un plan B.
 *
 * REGLA DE ORO: si la pagina cambia de forma y el parser no encuentra la tabla, o falta un modelo o un
 * campo, es un ERROR (codigo 1), nunca "0 diferencias". Un renglon renombrado y un parser roto no se
 * distinguen desde afuera, y un cero falso es peor que un aviso.
 *
 * CODIGOS DE SALIDA (`codigo` de `correr`): 0 todo igual · 3 hay diferencias o un modelo con retiro ·
 * 1 no se pudo bajar o no se entendio una pagina. Si hay las dos cosas (una pagina con diferencias y
 * otra que no se entendio) gana el 3: un precio cambiado no se tapa con un parser roto en otra pagina;
 * el 1 queda igual en `errores` y se imprime.
 *
 * CANDADOS (los mismos de la noche, `api-claude.md` §3): solo lee de internet y escribe UN JSON, y solo
 * bajo `.sgc-cache` (o la carpeta de BARACK_PRECIOS_DIR, para los tests, siempre que no sea una carpeta
 * del repo fuera de `.sgc-cache`). No toca Supabase, ni el arb, ni Outlook, ni lanza `claude`. Las
 * paginas son DATOS: de ellas se leen numeros y dos frases; ningun texto de la pagina se ejecuta.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRECIOS, selloLocal } from './claudeApi.mjs';
import { escribirSeguro } from './escrituraSegura.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..', '..');
export const DIR_SGC_CACHE = path.join(RAIZ, '.sgc-cache');
/** Donde se guarda el JSON de cada corrida (AAAA-MM-DD.json). */
export const DIR_PRECIOS = path.join(DIR_SGC_CACHE, 'api', 'precios');
/** Donde viven las paginas guardadas que usan `--simular` y los tests. */
export const DIR_FIXTURES = path.join(RAIZ, '__tests__', 'fixtures', 'precios');

export const VERSION_JSON = 1;

export const URLS = Object.freeze({
  pricing: 'https://platform.claude.com/docs/en/about-claude/pricing',
  creditos: 'https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers',
  deprecaciones: 'https://platform.claude.com/docs/en/about-claude/model-deprecations',
});

/** Nombre del archivo guardado de cada pagina (fixtures). */
export const ARCHIVOS_PAGINA = Object.freeze({
  pricing: 'pricing.md',
  creditos: 'creditos.md',
  deprecaciones: 'deprecations.md',
});

/**
 * Lo que sabemos hoy de los creditos, de `api-claude.md` §1 y del encabezado de claudeApi.mjs: $100 el
 * Max 5x, $200 el Max 20x. Team no lo usamos: se informa y se compara contra la corrida anterior.
 */
export const CREDITOS_NUESTROS = Object.freeze({ 'Max 5x': 100, 'Max 20x': 200 });

/** claudeApi.mjs cobra la tarifa larga de Haiku a partir de los 100.000 tokens (costoUsd, `> 100000`). */
export const UMBRAL_NUESTRO = 100000;

export const CAMPOS_PRECIO = Object.freeze(['entrada', 'salida', 'cacheLectura', 'cacheEscritura5m', 'cacheEscritura1h']);

const EPS = 1e-9;
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 20000;

/** Error del vigilante: `tipo` = descarga | formato | tabla | modelo | invariante | ruta | uso. */
export class ErrorVigilante extends Error {
  constructor(tipo, mensaje, detalle = {}) {
    super(mensaje);
    this.name = 'ErrorVigilante';
    this.tipo = tipo;
    Object.assign(this, detalle);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bajar una pagina
// ─────────────────────────────────────────────────────────────────────────────

/** ¿Lo que volvio es markdown de la documentacion (y no HTML)? */
export function esMarkdown(cuerpo, contentType = '') {
  const t = String(cuerpo ?? '');
  if (/<(!doctype|html|body)\b/i.test(t.slice(0, 4000))) return false;
  return /markdown/i.test(String(contentType)) || /^\s*---\s*\r?\n\s*title:/.test(t);
}

/**
 * Baja UNA pagina como markdown. Pide `Accept: text/markdown`; si el servidor contesta HTML o 404/406/415
 * reintenta con el sufijo `.md`. Un error de red, un timeout (20 s) o un 5xx se reintenta una vez.
 * Tira ErrorVigilante('descarga' | 'formato').
 */
export async function bajarPagina(url, { fetchFn = globalThis.fetch, timeoutMs = TIMEOUT_MS, reintentos = 1, maxBytes = MAX_BYTES } = {}) {
  if (typeof fetchFn !== 'function') throw new ErrorVigilante('descarga', 'no hay fetch en este Node (hace falta Node 18 o mas)');
  const candidatas = [url, `${url}.md`];
  let ultimo = 'sin respuesta';
  let devolvioHtml = false;
  const fallaDeRed = (candidata, e) => `${candidata}: ${e?.name === 'TimeoutError' || e?.name === 'AbortError' ? `sin respuesta en ${Math.round(timeoutMs / 1000)} s` : (e?.message ?? e)}`;
  for (const candidata of candidatas) {
    let cayoLaRed = false;
    for (let intento = 0; intento <= reintentos; intento++) {
      cayoLaRed = false;
      let res;
      let cuerpo;
      try {
        res = await fetchFn(candidata, {
          headers: { Accept: 'text/markdown', 'User-Agent': 'barack-vigilar-precios/1' },
          signal: AbortSignal.timeout(timeoutMs),
          redirect: 'follow',
        });
        if (res.status >= 200 && res.status < 300) cuerpo = await res.text(); // el tope de tiempo tambien corre mientras baja el cuerpo
      } catch (e) {
        ultimo = fallaDeRed(candidata, e);
        cayoLaRed = true;
        continue; // error de red o timeout: se reintenta la misma
      }
      if (res.status >= 500 || res.status === 429) { ultimo = `${candidata}: HTTP ${res.status}`; cayoLaRed = true; continue; }
      if (res.status === 404 || res.status === 406 || res.status === 415) { ultimo = `${candidata}: HTTP ${res.status}`; break; }
      if (!res.ok) throw new ErrorVigilante('descarga', `${candidata}: HTTP ${res.status}`);
      if (cuerpo.length > maxBytes) throw new ErrorVigilante('descarga', `${candidata}: la respuesta pesa ${cuerpo.length} caracteres (tope ${maxBytes})`);
      const tipo = res.headers?.get?.('content-type') ?? '';
      if (esMarkdown(cuerpo, tipo)) return { url: candidata, cuerpo, bytes: Buffer.byteLength(cuerpo, 'utf8') };
      devolvioHtml = true;
      ultimo = `${candidata}: el servidor devolvio ${/html/i.test(tipo) || /<(!doctype|html)\b/i.test(cuerpo.slice(0, 4000)) ? 'HTML' : `algo que no es markdown (${tipo || 'sin content-type'})`}`;
      break; // el mismo pedido va a dar lo mismo: probar la otra direccion
    }
    if (cayoLaRed) break; // la red o el servidor andan mal: probar el sufijo .md no ayuda, solo demora
  }
  if (devolvioHtml) throw new ErrorVigilante('formato', `no consegui la pagina en markdown (el parser no lee HTML a proposito, ver el encabezado): ${ultimo}`);
  throw new ErrorVigilante('descarga', `no pude bajar la pagina: ${ultimo}`);
}

/** Baja las tres paginas en paralelo. Devuelve { clave: {url, cuerpo, bytes} | {error, tipo} }. */
export async function bajarPaginas(opciones = {}) {
  const claves = Object.keys(URLS);
  const hechas = await Promise.allSettled(claves.map((k) => bajarPagina(URLS[k], opciones)));
  const out = {};
  claves.forEach((k, i) => {
    out[k] = hechas[i].status === 'fulfilled' ? hechas[i].value : { error: hechas[i].reason?.message ?? String(hechas[i].reason), tipo: hechas[i].reason?.tipo ?? 'descarga' };
  });
  return out;
}

/** Las tres paginas guardadas (para `--simular` y los tests). Si falta una, esa clave trae {error}. */
export function leerFixtures(dir = DIR_FIXTURES) {
  const out = {};
  for (const [k, archivo] of Object.entries(ARCHIVOS_PAGINA)) {
    const ruta = path.join(dir, archivo);
    try {
      const cuerpo = fs.readFileSync(ruta, 'utf8');
      out[k] = { url: `fixture:${archivo}`, cuerpo, bytes: Buffer.byteLength(cuerpo, 'utf8') };
    } catch {
      out[k] = { error: `no esta el fixture ${ruta}: correr una vez node scripts/_guardarFixturesPrecios.mjs`, tipo: 'descarga' };
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tablas de markdown
// ─────────────────────────────────────────────────────────────────────────────

/** Una celda sin links, sin notas al pie (<sup>), sin negritas ni escapes. */
export function limpiarCelda(s) {
  return String(s ?? '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<sup>[\s\S]*?<\/sup>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\\([*_`|~])/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const esFilaTabla = (l) => l.trimStart().startsWith('|');
const esSeparador = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes('|');
const partirFila = (l) => {
  let t = l.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1);
  return t.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
};

/** Todas las tablas de un markdown: [{ linea, encabezado: [celdas], filas: [[celdas]] }] (celdas crudas). */
export function parsearTablasMarkdown(md) {
  const lineas = String(md ?? '').replace(/\r\n?/g, '\n').split('\n');
  const tablas = [];
  let i = 0;
  while (i < lineas.length) {
    if (esFilaTabla(lineas[i]) && i + 1 < lineas.length && esSeparador(lineas[i + 1])) {
      const encabezado = partirFila(lineas[i]);
      const filas = [];
      let j = i + 2;
      while (j < lineas.length && esFilaTabla(lineas[j])) { filas.push(partirFila(lineas[j])); j++; }
      tablas.push({ linea: i + 1, encabezado, filas });
      i = j;
    } else {
      i++;
    }
  }
  return tablas;
}

/** '$12.50 / MTok' -> 12.5. Tira ErrorVigilante('formato') si la celda no tiene esa forma. */
export function parsearPrecioMtok(celda) {
  const t = limpiarCelda(celda);
  const m = /^\$\s*(\d[\d,]*(?:\.\d+)?)\s*(?:\/|per)\s*(?:M|million)\s*(?:Tok|tokens?)\b/i.exec(t);
  if (!m) throw new ErrorVigilante('formato', `celda de precio ilegible: "${t.slice(0, 80)}" (esperaba "$N / MTok")`);
  const v = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(v) || v <= 0) throw new ErrorVigilante('formato', `precio fuera de rango: "${t.slice(0, 80)}"`);
  return v;
}

const mismo = (a, b) => Math.abs(Number(a) - Number(b)) < EPS;
const fmtUsd = (v) => (v == null ? '-' : `$${Number(v)}`);

// ─────────────────────────────────────────────────────────────────────────────
// Pricing
// ─────────────────────────────────────────────────────────────────────────────

/** 'claude-opus-5-5' -> 'Claude Opus 5.5' (como figura en la tabla de precios). */
export function nombrePagina(id) {
  const m = /^claude-([a-z]+)-(\d+(?:-\d+)?)(?:-\d{8})?$/.exec(String(id));
  if (!m) throw new ErrorVigilante('modelo', `no se como se llama en la pagina el modelo "${id}"`);
  return `Claude ${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2].replace('-', '.')}`;
}

// Cada columna de la tabla de precios se identifica por lo que DICE su encabezado, nunca por la posicion.
const ROLES = [
  ['cacheEscritura5m', /\b5\s*-?\s*m(?:in(?:ute)?s?)?\b/i],
  ['cacheEscritura1h', /\b1\s*-?\s*h(?:r|ours?)?\b/i],
  ['cacheLectura', /cache\s*(?:hit|read)|hits?\s+and\s+refresh|refresh/i],
  ['salida', /output/i],
  ['entrada', /input/i],
];

/** { rol: indiceDeColumna } si el encabezado tiene los cinco roles sin repetir; si no, null. */
function mapearColumnas(encabezado) {
  const mapa = {};
  for (let idx = 0; idx < encabezado.length; idx++) {
    const txt = limpiarCelda(encabezado[idx]);
    for (const [rol, re] of ROLES) {
      if (!re.test(txt)) continue;
      if (rol in mapa) return null; // dos columnas para el mismo rol: ambiguo
      mapa[rol] = idx;
      break;
    }
  }
  return ROLES.every(([r]) => r in mapa) ? mapa : null;
}

/** 'Claude Haiku 5.5 (for prompts over 100,000 tokens)' -> { base: 'Claude Haiku 5.5', nota: 'for prompts over ...' } */
function partirNombre(celda) {
  const t = limpiarCelda(celda);
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(t);
  return m ? { base: m[1].trim(), nota: m[2].trim() } : { base: t, nota: '' };
}

/** 'masDe100k' si la nota habla de un pedido LARGO, 'base' si no. */
function tramoDeNota(nota) {
  return /\b(over|more than|above|greater than|exceeding)\b|>\s*\d/i.test(nota) ? 'masDe100k' : 'base';
}

/** El umbral en tokens que dice la nota ('...over 100,000 tokens' -> 100000), o null. */
function umbralDeNota(nota) {
  const m = /(\d[\d,]*)\s*tokens?/i.exec(nota);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

/** Cuantos campos hay que leer de un modelo, segun lo que sabemos hoy (de `PRECIOS`). */
function camposEsperados(p) {
  return CAMPOS_PRECIO.length + (p.masDe100k ? CAMPOS_PRECIO.length : 0);
}

/**
 * Lee de la pagina de pricing los precios de los modelos pedidos.
 * Devuelve { modelos: { [id]: { nombrePagina, base:{...}, masDe100k:{...}|null, umbral:number|null } },
 *            valoresLeidos, filasTabla, avisos }.
 * Tira ErrorVigilante si no hay tabla, si falta un modelo o un campo, o si una celda no se entiende.
 * `avisos` NO tira: son los modelos cuyos numeros no cumplen el orden basico (lectura <= entrada <=
 * escritura 5m <= escritura 1h; entrada <= salida). Puede ser una columna corrida o un precio cambiado
 * solo en una columna; `correr` los suma a `errores` (tipo 'invariante') pero igual compara, para que un
 * precio distinto no quede tapado por el aviso.
 */
export function parsearPrecios(md, ids = Object.keys(PRECIOS)) {
  const tablas = parsearTablasMarkdown(md);
  let elegida = null;
  for (const t of tablas) {
    const mapa = mapearColumnas(t.encabezado);
    if (mapa) { elegida = { t, mapa }; break; }
  }
  if (!elegida) {
    throw new ErrorVigilante('tabla', `no encontre la tabla de precios por modelo (busco una tabla con las columnas de entrada, salida, lectura de cache y escritura de cache de 5 min y de 1 h; la pagina tiene ${tablas.length} tablas y ninguna las trae)`);
  }
  const { t, mapa } = elegida;
  let colModelo = t.encabezado.findIndex((h) => /model/i.test(limpiarCelda(h)));
  if (colModelo < 0) colModelo = 0;

  const modelos = {};
  const avisos = [];
  let valoresLeidos = 0;
  for (const id of ids) {
    const nombre = nombrePagina(id);
    const filas = t.filas.filter((f) => partirNombre(f[colModelo]).base.toLowerCase() === nombre.toLowerCase());
    if (!filas.length) throw new ErrorVigilante('modelo', `el modelo "${nombre}" (${id}) no figura en la tabla de precios: ¿cambio de nombre o la pagina ya no lo lista?`);
    const porTramo = {};
    for (const f of filas) {
      const { nota } = partirNombre(f[colModelo]);
      const tramo = tramoDeNota(nota);
      if (porTramo[tramo]) throw new ErrorVigilante('tabla', `"${nombre}" aparece dos veces como tramo "${tramo}" en la tabla de precios: no se cual es cual`);
      const v = {};
      for (const campo of CAMPOS_PRECIO) {
        if (f[mapa[campo]] == null) throw new ErrorVigilante('tabla', `la fila de "${nombre}" no tiene la columna ${campo}`);
        try { v[campo] = parsearPrecioMtok(f[mapa[campo]]); } catch (e) { throw new ErrorVigilante('formato', `${nombre} · ${campo}: ${e.message}`); }
      }
      if (!(v.cacheLectura <= v.entrada && v.entrada <= v.cacheEscritura5m && v.cacheEscritura5m <= v.cacheEscritura1h && v.entrada <= v.salida)) {
        avisos.push(`los numeros de "${nombre}"${nota ? ` (${nota})` : ''} no cumplen lectura <= entrada <= escritura 5m <= escritura 1h y entrada <= salida (${JSON.stringify(v)}): ¿columnas corridas o un precio cambiado en una sola columna?`);
      }
      porTramo[tramo] = { valores: v, nota };
    }
    if (!porTramo.base) throw new ErrorVigilante('tabla', `"${nombre}" no tiene fila de precio base (solo la de pedidos largos)`);
    const entrada = {
      nombrePagina: nombre,
      base: porTramo.base.valores,
      masDe100k: porTramo.masDe100k ? porTramo.masDe100k.valores : null,
      umbral: porTramo.masDe100k ? umbralDeNota(porTramo.masDe100k.nota) : null,
    };
    modelos[id] = entrada;
    valoresLeidos += CAMPOS_PRECIO.length + (entrada.masDe100k ? CAMPOS_PRECIO.length : 0);
  }
  return { modelos, valoresLeidos, filasTabla: t.filas.length, avisos };
}

/**
 * Compara lo oficial con `PRECIOS`. Cada fila: { seccion:'precios', modelo, campo, nuestro, oficial, estado }.
 * Un tramo que solo existe de un lado (Haiku con tarifa larga y otro modelo sin ella) es DISTINTO.
 * Tira ErrorVigilante('tabla') si la cantidad de valores leidos no es la que dice `PRECIOS`.
 */
export function compararPrecios(oficial, nuestros = PRECIOS) {
  const filas = [];
  let esperados = 0;
  const fila = (modelo, campo, nuestro, of) => filas.push({
    seccion: 'precios', modelo, campo, nuestro, oficial: of,
    estado: nuestro != null && of != null && mismo(nuestro, of) ? 'igual' : 'DISTINTO',
  });
  for (const [id, p] of Object.entries(nuestros)) {
    const o = oficial.modelos?.[id];
    if (!o) throw new ErrorVigilante('modelo', `faltan los precios oficiales de ${id}`);
    esperados += camposEsperados(p);
    for (const campo of CAMPOS_PRECIO) fila(id, campo, p[campo], o.base[campo]);
    if (p.masDe100k || o.masDe100k) {
      for (const campo of CAMPOS_PRECIO) fila(id, `masDe100k.${campo}`, p.masDe100k?.[campo] ?? null, o.masDe100k?.[campo] ?? null);
      fila(id, 'masDe100k.umbralTokens', UMBRAL_NUESTRO, o.umbral);
    }
  }
  const leidos = filas.filter((f) => f.oficial != null && !f.campo.endsWith('umbralTokens')).length;
  if (leidos !== esperados) {
    throw new ErrorVigilante('tabla', `esperaba ${esperados} precios oficiales y lei ${leidos}: falta un campo (o hay un tramo que nosotros no tenemos)`, { filas });
  }
  return filas;
}

// ─────────────────────────────────────────────────────────────────────────────
// Creditos
// ─────────────────────────────────────────────────────────────────────────────

const montoUsd = (txt) => {
  const m = /\$\s*(\d[\d,]*(?:\.\d+)?)/.exec(String(txt));
  return m ? Number(m[1].replace(/,/g, '')) : null;
};

const NOMBRES_PLAN = [
  ['Max 5x', /^max\s*5x$/i],
  ['Max 20x', /^max\s*20x$/i],
  ['Team Standard (por asiento)', /^team\b.*\bstandard\b/i],
  ['Team Premium (por asiento)', /^team\b.*\bpremium\b/i],
];

/**
 * Lee de la pagina de creditos: el monto por plan, el tope del pool de Team (si lo dice), la frase de
 * vencimiento y si cubre Claude Code. Tira ErrorVigilante si no encuentra los montos o el vencimiento.
 */
export function parsearCreditos(md) {
  const tablas = parsearTablasMarkdown(md);
  const texto = String(md ?? '').replace(/\r\n?/g, '\n');

  const tPlanes = tablas.find((t) => t.encabezado.some((h) => /^plan$/i.test(limpiarCelda(h))) && t.encabezado.some((h) => /credit/i.test(limpiarCelda(h))));
  if (!tPlanes) throw new ErrorVigilante('tabla', `no encontre la tabla de montos de credito por plan (busco "Plan | Monthly credit"; la pagina tiene ${tablas.length} tablas)`);
  const montos = {};
  for (const f of tPlanes.filas) {
    const etiqueta = limpiarCelda(f[0]);
    const hallado = NOMBRES_PLAN.find(([, re]) => re.test(etiqueta));
    if (hallado) montos[hallado[0]] = montoUsd(limpiarCelda(f[1]));
  }
  for (const [nombre] of NOMBRES_PLAN) {
    if (montos[nombre] == null) throw new ErrorVigilante('tabla', `la tabla de creditos no trae el monto de "${nombre}"`);
  }

  // El tope del pool de Team: "up to $500 USD (Team, pooled)" en la tabla de resumen, o "capped at $500 USD" al pie.
  let tope = null;
  const mTope = /up to\s*\$\s*(\d[\d,]*)\s*USD[^()\n|]*\(\s*Team/i.exec(texto) || /capped at\s*\$\s*(\d[\d,]*)/i.exec(texto);
  if (mTope) tope = Number(mTope[1].replace(/,/g, ''));

  // El vencimiento: fila "Expiry" de la tabla de resumen y/o la linea "**Expiry.** ..." de "How credits are applied".
  let vencimientoTabla = null;
  for (const t of tablas) {
    const f = t.filas.find((r) => /^expiry$/i.test(limpiarCelda(r[0])));
    if (f && f[1]) { vencimientoTabla = limpiarCelda(f[1]); break; }
  }
  const mFrase = /^\s*[*-]?\s*\*\*Expiry\.\*\*\s*(.+)$/im.exec(texto);
  const vencimientoFrase = mFrase ? limpiarCelda(mFrase[1]) : null;
  if (!vencimientoTabla && !vencimientoFrase) throw new ErrorVigilante('tabla', 'no encontre la frase de vencimiento de los creditos (ni la fila "Expiry" ni la linea "Expiry.")');
  const vencimiento = [vencimientoTabla, vencimientoFrase].filter(Boolean).join(' || ');

  // ¿Cubre Claude Code? Tabla "Product | Covered" con la fila "Claude Code | No"; si no, la fila "Doesn't cover" del resumen.
  let cubreClaudeCode = null;
  for (const t of tablas) {
    const f = t.filas.find((r) => /^claude code$/i.test(limpiarCelda(r[0])));
    if (f && /^(yes|no)$/i.test(limpiarCelda(f[1]))) { cubreClaudeCode = /^yes$/i.test(limpiarCelda(f[1])); break; }
  }
  if (cubreClaudeCode == null) {
    for (const t of tablas) {
      const f = t.filas.find((r) => /^(covers|doesn'?t cover)$/i.test(limpiarCelda(r[0])));
      if (f && /claude code/i.test(limpiarCelda(f[1]))) { cubreClaudeCode = /^covers$/i.test(limpiarCelda(f[0])); break; }
    }
  }
  if (cubreClaudeCode == null) throw new ErrorVigilante('tabla', 'no encontre si los creditos cubren Claude Code (ni la fila "Claude Code" de la tabla de cobertura ni "Doesn\'t cover")');

  return {
    montos,
    teamTope: tope,
    vencimiento,
    venceAlFinalDelCiclo: /billing cycle/i.test(vencimiento),
    // 10/10/2026 (cola H19): la pagina escribe «doesn’t» con apostrofo tipografico (U+2019) y la version
    // anterior solo aceptaba el recto: el vigilante fallaba con ruido (codigo 3).
    sinAcumulacion: /no roll ?over|(?:do(?:es)?(?:n['’]?t| not)|not)\s+roll ?over/i.test(vencimiento),
    cubreClaudeCode,
  };
}

/**
 * Compara los creditos con lo que sabemos. `previo` = la lectura de creditos de la corrida anterior (para
 * lo que no tenemos como dato propio: Team). Cada fila: { seccion:'creditos', campo, nuestro, oficial, estado, ref }.
 */
export function compararCreditos(of, previo = null, nuestros = CREDITOS_NUESTROS) {
  const filas = [];
  const fila = (campo, nuestro, oficial, ref = 'nuestro') => filas.push({
    seccion: 'creditos', campo, nuestro, oficial, ref,
    estado: nuestro == null ? 'informa' : (typeof oficial === 'number' && typeof nuestro === 'number' ? (mismo(nuestro, oficial) ? 'igual' : 'DISTINTO') : (nuestro === oficial ? 'igual' : 'DISTINTO')),
  });
  for (const plan of Object.keys(nuestros)) fila(`${plan} (USD por mes)`, nuestros[plan], of.montos[plan]);
  for (const plan of ['Team Standard (por asiento)', 'Team Premium (por asiento)']) {
    fila(`${plan} (USD por mes)`, previo?.montos?.[plan] ?? null, of.montos[plan], 'anterior');
  }
  fila('Team tope del pool (USD por mes)', previo ? (previo.teamTope ?? null) : null, of.teamTope, 'anterior');
  fila('vence al final del ciclo de facturacion', 'si', of.venceAlFinalDelCiclo ? 'si' : 'no');
  fila('no se acumula (sin rollover)', 'si', of.sinAcumulacion ? 'si' : 'no');
  fila('cubre Claude Code', 'no', of.cubreClaudeCode ? 'si' : 'no');
  return filas;
}

// ─────────────────────────────────────────────────────────────────────────────
// Retiro de modelos
// ─────────────────────────────────────────────────────────────────────────────

const MESES = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

/** 'September 1, 2027' -> '2027-09-01' (o null). */
export function fechaIso(txt) {
  const m = /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/.exec(String(txt ?? ''));
  const mes = m ? MESES[m[1].toLowerCase()] : null;
  return mes ? `${m[3]}-${String(mes).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}` : null;
}

/** 'N/A' | 'Not sooner than <fecha>' | 'To be announced' | '<fecha>' -> { tipo, fecha }. */
export function interpretarRetiro(txt) {
  const t = limpiarCelda(txt);
  if (/^n\/a$/i.test(t) || t === '') return { tipo: 'na', fecha: null };
  const m = /^not sooner than\s+(.+)$/i.exec(t);
  if (m) return { tipo: 'no_antes_de', fecha: fechaIso(m[1]) };
  if (/^to be announced/i.test(t)) return { tipo: 'por_anunciar', fecha: null };
  const f = fechaIso(t);
  return f ? { tipo: 'fecha', fecha: f } : { tipo: 'otro', fecha: null };
}

/**
 * Lee la tabla "Model status" y las tablas de la historia de la pagina de deprecaciones y dice, por cada
 * modelo pedido, si hay una senal de retiro. "Not sooner than ..." (que tienen los 4 modelos activos) NO es
 * un retiro: es el piso de una fecha tentativa. La senal es: estado distinto de Active, "Deprecated"
 * distinto de N/A, una fecha de retiro que no empieza con "Not sooner than", o el id en la historia.
 * Tira ErrorVigilante si no hay tabla de estado o si un modelo pedido no figura.
 */
export function parsearDeprecaciones(md, ids = Object.keys(PRECIOS)) {
  const tablas = parsearTablasMarkdown(md);
  const idx = (enc, re) => enc.findIndex((h) => re.test(limpiarCelda(h)));
  let estado = null;
  for (const t of tablas) {
    const cId = idx(t.encabezado, /api model name/i);
    const cEstado = idx(t.encabezado, /current state/i);
    const cDep = idx(t.encabezado, /^deprecated$/i);
    const cRet = idx(t.encabezado, /retirement/i);
    if (cId >= 0 && cEstado >= 0 && cDep >= 0 && cRet >= 0) { estado = { t, cId, cEstado, cDep, cRet }; break; }
  }
  if (!estado) throw new ErrorVigilante('tabla', `no encontre la tabla de estado de los modelos (busco "API model name | Current state | Deprecated | Tentative retirement date"; la pagina tiene ${tablas.length} tablas)`);

  // Los ids que aparecen en las tablas de la historia ("Deprecated model").
  const enHistoria = new Set();
  for (const t of tablas) {
    const c = idx(t.encabezado, /^deprecated model$/i);
    if (c < 0) continue;
    for (const f of t.filas) enHistoria.add(limpiarCelda(f[c]).toLowerCase());
  }

  const modelos = [];
  for (const id of ids) {
    const f = estado.t.filas.find((r) => limpiarCelda(r[estado.cId]).toLowerCase() === id.toLowerCase());
    if (!f) throw new ErrorVigilante('modelo', `el modelo ${id} no figura en la tabla de estado de la pagina de deprecaciones: ¿cambio de nombre?`);
    const estadoTxt = limpiarCelda(f[estado.cEstado]);
    const deprecado = limpiarCelda(f[estado.cDep]);
    const retiroTxt = limpiarCelda(f[estado.cRet]);
    const ret = interpretarRetiro(retiroTxt);
    const motivos = [];
    if (!/^active$/i.test(estadoTxt)) motivos.push(`estado ${estadoTxt || 'vacio'}`);
    if (!/^n\/a$/i.test(deprecado)) motivos.push(`deprecado ${deprecado}`);
    if (['fecha', 'por_anunciar', 'otro'].includes(ret.tipo)) motivos.push(`retiro ${retiroTxt}`);
    if (enHistoria.has(id.toLowerCase())) motivos.push('figura en la historia de deprecaciones');
    modelos.push({
      id, estado: estadoTxt, deprecado, retiro: retiroTxt, retiroTipo: ret.tipo, retiroFecha: ret.fecha,
      alerta: motivos.length > 0, motivos,
    });
  }
  return { modelos };
}

// ─────────────────────────────────────────────────────────────────────────────
// Donde se escribe (candado)
// ─────────────────────────────────────────────────────────────────────────────

/** El camino real (sin enlaces ni nombres cortos de Windows) del tramo que ya existe; lo que falta se agrega tal cual. */
function realEfectiva(ruta) {
  let actual = path.resolve(ruta);
  const resto = [];
  for (;;) {
    try {
      const real = fs.realpathSync.native(actual);
      return resto.length ? path.join(real, ...resto.reverse()) : real;
    } catch {
      const padre = path.dirname(actual);
      if (padre === actual) return path.resolve(ruta);
      resto.push(path.basename(actual));
      actual = padre;
    }
  }
}

/** ¿`ruta` esta ADENTRO de `base`? Por `path.relative` (un `startsWith` dejaria pasar `.sgc-cache-otro`). */
export function estaAdentro(base, ruta) {
  const b = realEfectiva(base);
  const r = realEfectiva(ruta);
  const rel = path.relative(b, r);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

/**
 * La carpeta donde se guarda el JSON: `.sgc-cache/api/precios`, o BARACK_PRECIOS_DIR (para los tests). Esa
 * variable no puede apuntar a una carpeta del repo que no sea `.sgc-cache`: la noche no escribe en el repo.
 */
export function dirSalida(env = process.env) {
  const v = String(env.BARACK_PRECIOS_DIR ?? '').trim();
  if (!v) return DIR_PRECIOS;
  const dir = path.resolve(v);
  if ((dir === RAIZ || estaAdentro(RAIZ, dir)) && !(dir === DIR_SGC_CACHE || estaAdentro(DIR_SGC_CACHE, dir))) {
    throw new ErrorVigilante('ruta', `BARACK_PRECIOS_DIR apunta a una carpeta del repo fuera de .sgc-cache (${dir}): no escribo ahi`);
  }
  return dir;
}

/** Tira ErrorVigilante('ruta') si `ruta` no esta adentro de `.sgc-cache` ni de la carpeta de BARACK_PRECIOS_DIR. */
export function exigirRutaPermitida(ruta, env = process.env) {
  const permitidas = [DIR_SGC_CACHE];
  const v = String(env.BARACK_PRECIOS_DIR ?? '').trim();
  if (v) permitidas.push(dirSalida(env));
  if (!permitidas.some((base) => estaAdentro(base, ruta))) {
    throw new ErrorVigilante('ruta', `no escribo en ${ruta}: solo se escribe bajo .sgc-cache${v ? ' o BARACK_PRECIOS_DIR' : ''}`);
  }
  return path.resolve(ruta);
}

/**
 * Escribe el JSON de una corrida, atomico y solo en una ruta permitida: primero el chequeo propio (`.sgc-cache` o
 * BARACK_PRECIOS_DIR) y despues la puerta unica de escritura de la noche, `escribirSeguro` (candado 1 de api-claude.md).
 */
export function escribirJsonSeguro(ruta, objeto, { env = process.env } = {}) {
  const destino = exigirRutaPermitida(ruta, env);
  escribirSeguro(destino, `${JSON.stringify(objeto, null, 2)}\n`, { env });
  return destino;
}

// El guardado de paginas como fixtures (la unica escritura en el repo) vive aparte, en
// `vigilarPreciosFixtures.mjs`, y lo corre `scripts/_guardarFixturesPrecios.mjs`: la noche no lo importa.

// ─────────────────────────────────────────────────────────────────────────────
// La corrida
// ─────────────────────────────────────────────────────────────────────────────

const fechaLocal = (ahora) => selloLocal(ahora).slice(0, 10);

/** La lectura de creditos de la corrida anterior (la mas nueva con fecha anterior a `fecha`), o null. */
export function leerCorridaAnterior(dir, fecha) {
  let nombres;
  try { nombres = fs.readdirSync(dir); } catch { return null; }
  const candidatas = nombres.filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n) && n.slice(0, 10) < fecha).sort().reverse();
  for (const n of candidatas) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'));
      if (j?.version === VERSION_JSON && j?.creditos?.ok && j.creditos.oficial?.montos) return { fecha: n.slice(0, 10), creditos: j.creditos.oficial };
    } catch { /* un JSON roto se saltea */ }
  }
  return null;
}

const resumirError = (e) => ({ tipo: e?.tipo ?? 'error', mensaje: String(e?.message ?? e).slice(0, 500) });

/**
 * Una corrida entera. No imprime: devuelve el resultado (la CLI lo muestra). Opciones:
 *   simular   usa las paginas guardadas (fixtures) en vez de bajar; el JSON sale como AAAA-MM-DD.simulado.json
 *   paginas   { pricing, creditos, deprecaciones } ya bajadas (cada una {url,cuerpo,bytes} o {error})
 *   fetchFn   para probar sin red
 *   precios   la tabla nuestra a comparar (por defecto PRECIOS de claudeApi.mjs)
 *   guardar   false = no escribir el JSON
 *   dirSalida carpeta del JSON (tiene que estar bajo .sgc-cache o BARACK_PRECIOS_DIR)
 *   dirFixtures (o BARACK_PRECIOS_FIXTURES, solo lectura), env, ahora
 * Devuelve { codigo, fecha, origen, precios, creditos, deprecaciones, diferencias, errores, rutaJson }.
 */
export async function correr(opciones = {}) {
  const {
    simular = false, fetchFn, precios = PRECIOS, guardar = true, env = process.env, ahora = new Date(),
    // BARACK_PRECIOS_FIXTURES: otra carpeta de paginas guardadas para --simular (SOLO lectura; sirve para probar la CLI).
    dirFixtures = env.BARACK_PRECIOS_FIXTURES ? path.resolve(env.BARACK_PRECIOS_FIXTURES) : DIR_FIXTURES,
  } = opciones;
  const fecha = fechaLocal(ahora);
  const origen = simular ? 'simulado' : 'web';
  const errores = [];
  const diferencias = [];

  let paginas = opciones.paginas;
  if (!paginas) paginas = simular ? leerFixtures(dirFixtures) : await bajarPaginas(fetchFn ? { fetchFn } : {});

  let dir = null;
  let previo = null;
  try {
    dir = opciones.dirSalida ? path.resolve(opciones.dirSalida) : dirSalida(env);
    if (!simular) previo = leerCorridaAnterior(dir, fecha);
  } catch (e) {
    errores.push({ seccion: 'salida', ...resumirError(e) });
  }

  const fuentes = {};
  const seccion = (clave, fn) => {
    const pagina = paginas?.[clave];
    fuentes[clave] = { url: pagina?.url ?? URLS[clave], bytes: pagina?.bytes ?? null };
    if (!pagina || pagina.error) {
      const e = { seccion: clave, tipo: pagina?.tipo ?? 'descarga', mensaje: pagina?.error ?? 'la pagina no se bajo' };
      errores.push(e);
      return { ok: false, error: e.mensaje };
    }
    try {
      return { ok: true, ...fn(pagina.cuerpo) };
    } catch (e) {
      const r = resumirError(e);
      errores.push({ seccion: clave, ...r });
      return { ok: false, error: r.mensaje };
    }
  };

  const secPrecios = seccion('pricing', (md) => {
    const oficial = parsearPrecios(md, Object.keys(precios));
    const filas = compararPrecios(oficial, precios);
    return { oficial, filas };
  });
  for (const aviso of secPrecios.oficial?.avisos ?? []) errores.push({ seccion: 'pricing', tipo: 'invariante', mensaje: aviso.slice(0, 500) });
  const secCreditos = seccion('creditos', (md) => {
    const oficial = parsearCreditos(md);
    const filas = compararCreditos(oficial, previo?.creditos ?? null);
    return { oficial, filas, anterior: previo?.fecha ?? null };
  });
  const secDeprec = seccion('deprecaciones', (md) => {
    const oficial = parsearDeprecaciones(md, Object.keys(precios));
    return { oficial };
  });

  for (const f of secPrecios.filas ?? []) if (f.estado === 'DISTINTO') diferencias.push(f);
  for (const f of secCreditos.filas ?? []) if (f.estado === 'DISTINTO') diferencias.push(f);
  for (const m of secDeprec.oficial?.modelos ?? []) {
    if (m.alerta) diferencias.push({ seccion: 'deprecaciones', modelo: m.id, campo: 'retiro', nuestro: 'sin retiro', oficial: m.motivos.join('; '), estado: 'DISTINTO' });
  }

  const resultado = {
    version: VERSION_JSON,
    fecha,
    generado: selloLocal(ahora),
    origen,
    codigo: diferencias.length ? 3 : (errores.length ? 1 : 0),
    fuentes,
    precios: secPrecios,
    creditos: secCreditos,
    deprecaciones: secDeprec,
    diferencias,
    errores,
    rutaJson: null,
  };

  // Se escribe lo que se pudo leer: si ninguna pagina se entendio no hay nada que guardar.
  const algoLeido = secPrecios.ok || secCreditos.ok || secDeprec.ok;
  if (guardar && dir && algoLeido) {
    try {
      const nombre = simular ? `${fecha}.simulado.json` : `${fecha}.json`;
      resultado.rutaJson = escribirJsonSeguro(path.join(dir, nombre), resultado, { env });
    } catch (e) {
      errores.push({ seccion: 'salida', ...resumirError(e) });
      if (!diferencias.length) resultado.codigo = 1;
    }
  }
  return resultado;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que se ve en la consola
// ─────────────────────────────────────────────────────────────────────────────

function tabla(columnas, filas) {
  const anchos = columnas.map((c, i) => Math.max(c.length, ...filas.map((f) => String(f[i]).length)));
  const linea = (f) => f.map((c, i) => String(c).padEnd(anchos[i])).join('  ').trimEnd();
  return [linea(columnas), anchos.map((a) => '-'.repeat(a)).join('  '), ...filas.map(linea)].join('\n');
}

const valor = (campo, v) => {
  if (v == null) return '-';
  if (typeof v !== 'number') return String(v);
  if (campo.endsWith('umbralTokens')) return String(v);
  return fmtUsd(v);
};

/** El resultado de `correr` como texto de consola (ASCII, sin tildes: la consola de Windows no es UTF-8). */
export function formatearResultado(r) {
  const out = [];
  out.push(`VIGILANTE DE PRECIOS - ${r.fecha} - origen: ${r.origen === 'simulado' ? 'paginas guardadas (--simular)' : 'paginas oficiales de Anthropic'}`);

  out.push('', `PRECIOS (USD por millon de tokens) - ${r.fuentes.pricing?.url ?? URLS.pricing}`);
  if (r.precios.ok) {
    out.push(tabla(['modelo', 'campo', 'nuestro', 'oficial', 'estado'], r.precios.filas.map((f) => [f.modelo, f.campo, valor(f.campo, f.nuestro), valor(f.campo, f.oficial), f.estado])));
  } else {
    out.push(`  NO SE PUDO LEER: ${r.precios.error}`);
  }

  out.push('', `CREDITOS DEL PLAN - ${r.fuentes.creditos?.url ?? URLS.creditos}`);
  if (r.creditos.ok) {
    out.push(tabla(['campo', 'nuestro', 'oficial', 'estado'], r.creditos.filas.map((f) => [
      f.campo,
      f.nuestro == null ? '-' : `${typeof f.nuestro === 'number' ? `$${f.nuestro}` : f.nuestro}${f.ref === 'anterior' ? '*' : ''}`,
      typeof f.oficial === 'number' ? `$${f.oficial}` : (f.oficial ?? '-'),
      f.estado,
    ])));
    out.push(`  frase de vencimiento: "${String(r.creditos.oficial.vencimiento).slice(0, 300)}"`);
    out.push(r.creditos.anterior
      ? `  * = lo que decia la corrida del ${r.creditos.anterior} (no tenemos dato propio de Team)`
      : '  (sin corrida anterior guardada: Team solo se informa, sin comparar)');
  } else {
    out.push(`  NO SE PUDO LEER: ${r.creditos.error}`);
  }

  out.push('', `RETIRO DE MODELOS - ${r.fuentes.deprecaciones?.url ?? URLS.deprecaciones}`);
  if (r.deprecaciones.ok) {
    out.push(tabla(['modelo', 'estado', 'deprecado', 'retiro tentativo', 'resultado'], r.deprecaciones.oficial.modelos.map((m) => [
      m.id, m.estado, m.deprecado, m.retiro, m.alerta ? `RETIRO: ${m.motivos.join('; ')}` : 'sin retiro',
    ])));
  } else {
    out.push(`  NO SE PUDO LEER: ${r.deprecaciones.error}`);
  }

  if (r.errores.length) {
    out.push('', 'ERRORES');
    for (const e of r.errores) out.push(`  - ${e.seccion} (${e.tipo}): ${e.mensaje}`);
  }
  const quePaso = r.codigo === 0 ? 'todo igual'
    : r.codigo === 3 ? `${r.diferencias.length} diferencia(s) o modelo con retiro${r.errores.length ? ` (y ${r.errores.length} error(es) de lectura)` : ''}`
      : 'no se pudo leer o entender alguna pagina: NO es "sin diferencias"';
  out.push('', `RESULTADO: ${quePaso} -> codigo ${r.codigo}${r.rutaJson ? ` - guardado en ${r.rutaJson}` : ''}`);
  return out.join('\n');
}
