/**
 * unidadesArb.mjs — la UNIDAD de cada insumo del arb: de donde sale y como se compara.
 *
 * POR QUE (plan 04/09/2026, hallazgo H6 → Ola 4): de las 7 correcciones que llegaron de afuera
 * entre julio y septiembre, 4 fueron de unidad de medida (aplix m2→ML, Haartz, P703, folio
 * rollo/m2). La regla ya existia en texto ("la unidad NO se elige, SE BUSCA en el maestro"), pero
 * el validador solo la aplicaba si alguien le pasaba --insumos a mano, y desde el 28/08 el export
 * INSUMOS.TXT de C:\tmp es el listado IMPRESO (sin columna de unidad): .arb-cache/insumos.csv
 * quedo vacio el 01/09 y la regla no se podia ejecutar. Nadie lo noto hasta la auditoria.
 *
 * QUE HACE: junta la unidad del maestro desde lo que haya. La fuente MAS NUEVA que tenga el
 * codigo gana, y el resultado declara cual fue:
 *   - INSUMOS.TXT tabulado (col U.Medida)     el maestro propiamente dicho, si el export es el bueno
 *   - RELACIONES.TXT col Unidad                la llena el arb desde el maestro (0 codigos con 2 unidades)
 *   - .arb-cache/insumos.csv                   lo que escribio _refreshArb.mjs la ultima vez
 *   - .arb-cache/insumos_AAAAMMDD_backup.csv   foto vieja: solo para codigos que las otras no tienen
 * Y detecta el CAMBIO DE ETIQUETA: un codigo que en una foto vieja decia MT2 y hoy dice MTL tiene
 * el consumo cargado en la unidad vieja hasta que alguien lo reconvierta (Haartz, 20/08/2026).
 *
 * Las FAMILIAS de unidad (UN = UNI = UNID; MTS = MTL = ML, metro lineal; MT2 = M2) viven en
 * consumosCanon.data.json `unidades_alias`, medidas contra la poblacion del maestro el 05/09/2026,
 * no elegidas a ojo. Dos grafias de la misma familia no son un error de unidad; dos familias
 * distintas si.
 *
 * Solo lee. No escribe en el arb ni en el cache. Lo usa scripts/_validarConsumos.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const CANON = JSON.parse(fs.readFileSync(path.join(AQUI, 'consumosCanon.data.json'), 'utf8'));
export const RAIZ = path.resolve(AQUI, '..', '..');
export const TMP_ARB = 'C:\\tmp';
export const CACHE_ARB = path.join(RAIZ, '.arb-cache');

const ALIAS = new Map();
for (const [familia, grafias] of Object.entries(CANON.unidades_alias)) {
  if (familia.startsWith('_') || !Array.isArray(grafias)) continue;
  for (const g of grafias) ALIAS.set(String(g).toUpperCase(), familia);
}

// ─────────────────────────────────────────────────────────────── comparar

/** 'UNID' → { crudo: 'UNID', familia: 'UN' }. Desconocida → familia = la misma grafia. Vacia → ''. */
export function normalizarUnidad(u) {
  const crudo = String(u ?? '').trim().toUpperCase().replace(/\.$/, '');
  if (!crudo) return { crudo: '', familia: '' };
  return { crudo, familia: ALIAS.get(crudo) ?? crudo };
}

/** 'igual' | 'grafia' (misma familia, otra grafia) | 'distinta' | 'sin-dato' (alguna vacia). */
export function compararUnidad(a, b) {
  const A = normalizarUnidad(a);
  const B = normalizarUnidad(b);
  if (!A.crudo || !B.crudo) return 'sin-dato';
  if (A.crudo === B.crudo) return 'igual';
  return A.familia === B.familia ? 'grafia' : 'distinta';
}

// ─────────────────────────────────────────────────────────────── parsear

/** Los TXT del arb vienen en cp1252, no en UTF-8 (igual que _refreshArb.mjs). */
const decodificar = (buf) => new TextDecoder('windows-1252').decode(buf);
const esNum = (v) => /^\d+([.,]\d+)?$/.test(v);
const g = (r, i) => (i < r.length ? r[i].trim() : '');
/** En los DATOS de RELACIONES cada nivel del arbol corre +7 columnas (el encabezado miente: +9). */
const OFFSETS = [0, 7, 14, 21];

/** 'tabulado' (el export con columnas, sirve) | 'listado' (el reporte impreso, sin unidad) | 'vacio'. */
export function formatoInsumosTxt(texto) {
  const lineas = String(texto ?? '').split(/\r?\n/).filter((l) => l.trim());
  if (!lineas.length) return 'vacio';
  const tabs = (lineas[0].match(/\t/g) || []).length;
  return tabs >= 4 ? 'tabulado' : 'listado';
}

/** INSUMOS.TXT tabulado: col[2] = codigo, col[5] = unidad (col[0] trae rubro+codigo pegados). */
export function parsearInsumosTxt(texto) {
  const mapa = new Map();
  if (formatoInsumosTxt(texto) !== 'tabulado') return mapa;
  for (const ln of String(texto).split(/\r?\n/).slice(1)) {
    if (!ln.trim()) continue;
    const r = ln.split('\t');
    const cod = g(r, 2);
    if (cod) mapa.set(cod, g(r, 5));
  }
  return mapa;
}

/** CSV `codigo,descripcion,unidad` (el de .arb-cache). Primera y ultima columna: la descripcion puede traer comas. */
export function parsearInsumosCsv(texto) {
  const mapa = new Map();
  const lineas = String(texto ?? '').replace(/^\uFEFF/, '').split(/\r?\n/);
  for (const ln of lineas.slice(1)) {
    if (!ln.trim()) continue;
    const i = ln.indexOf(',');
    const j = ln.lastIndexOf(',');
    if (i < 0 || j <= i) continue;
    const cod = ln.slice(0, i).trim().replace(/^"|"$/g, '');
    const uni = ln.slice(j + 1).trim().replace(/^"|"$/g, '');
    if (cod) mapa.set(cod, uni);
  }
  return mapa;
}

/**
 * RELACIONES.TXT: la unidad que el arb imprime al lado de cada insumo, en cualquier nivel del
 * arbol. Una linea es fila real solo si trae codigo Y cantidad numerica en el mismo bloque: la
 * continuacion de una descripcion partida deja la unidad en la columna de la cantidad y no
 * tiene codigo (mismo discriminador que _refreshArb.mjs; sin el, "AL" y "GR" salian como codigos).
 * @returns {{ mapa: Map<string,string>, dobles: Array<{codigo:string, unidades:string[]}> }}
 */
export function unidadesDeRelaciones(texto) {
  const mapa = new Map();
  const vistas = new Map();
  const anotar = (cod, uni) => {
    if (!cod || !uni) return;
    if (!mapa.has(cod)) mapa.set(cod, uni);
    if (!vistas.has(cod)) vistas.set(cod, new Set());
    vistas.get(cod).add(uni);
  };
  // Fila partida (la descripcion trae un \r en el maestro, ~29 casos, casi todos hilos): la linea
  // del codigo viene SIN unidad ni consumo, y la siguiente es "<resto desc> | <unidad> | <consumo>".
  let pendiente = null;
  for (const ln of String(texto ?? '').split(/\r?\n/).slice(1)) {
    if (!ln.trim()) continue;
    const r = ln.split('\t');
    const traeCodigo = OFFSETS.some((b) => g(r, b + 2) && esNum(g(r, b + 1)));
    if (!traeCodigo) {
      if (pendiente) {
        const [txt, ...resto] = r.map((x) => x.trim()).filter(Boolean);
        const uni = resto.find((v) => !/^[\d.,]+$/.test(v) && v !== txt);
        if (uni) anotar(pendiente, uni);
        pendiente = null;
      }
      continue;
    }
    pendiente = null;
    for (const b of OFFSETS) {
      const cod = g(r, b + 2);
      if (!cod || !esNum(g(r, b + 1))) continue;
      const uni = g(r, b + 4);
      if (uni) anotar(cod, uni);
      else if (!g(r, b + 5)) pendiente = cod; // sin unidad NI consumo: sigue en la linea de abajo
    }
  }
  const dobles = [...vistas].filter(([, s]) => s.size > 1).map(([codigo, s]) => ({ codigo, unidades: [...s] }));
  return { mapa, dobles };
}

// ─────────────────────────────────────────────────────────────── cargar

const fechaDeNombre = (nombre) => {
  const m = String(nombre).match(/(\d{4})(\d{2})(\d{2})/);
  return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`) : null;
};

function fuenteArchivo(ruta, nombre, parsear, { fecha = null, nota = '' } = {}) {
  if (!ruta || !fs.existsSync(ruta)) return null;
  const st = fs.statSync(ruta);
  const buf = fs.readFileSync(ruta);
  const texto = /\.csv$/i.test(ruta) ? buf.toString('utf8') : decodificar(buf);
  const res = parsear(texto);
  const mapa = res instanceof Map ? res : res.mapa;
  return { nombre, ruta, fecha: fecha ?? st.mtime, mapa, codigos: mapa.size, nota, dobles: res.dobles ?? [] };
}

function listarBackups(dir) {
  try { return fs.readdirSync(dir).filter((n) => /^insumos_\d{8}.*\.csv$/i.test(n)); } catch { return []; }
}

/**
 * Junta la unidad del maestro desde todas las fuentes disponibles.
 * `extra` es un archivo pasado a mano (--insumos): INSUMOS tabulado o CSV; gana sobre el resto.
 * @returns {{
 *   mapa: Map<string,{unidad:string, fuente:string, fecha:Date}>,   la mas nueva por codigo
 *   historico: Map<string,Array>,                                    todas, de la mas nueva a la mas vieja
 *   cambios: Array<{codigo, antes, ahora}>,                          codigos cuya FAMILIA de unidad cambio entre fotos
 *   fuentes: Array<{nombre, ruta, fecha, codigos, nota}>,            ordenadas por fecha, la mas nueva primero
 *   avisos: string[]
 * }}
 */
export function cargarMaestroUnidades({ tmpDir = TMP_ARB, cacheDir = CACHE_ARB, extra = null } = {}) {
  const fuentes = [];
  const avisos = [];
  const agregar = (f) => { if (f) fuentes.push(f); return f; };

  if (extra) {
    const esCsv = /\.csv$/i.test(extra);
    const f = agregar(fuenteArchivo(extra, `--insumos ${path.basename(extra)}`, esCsv ? parsearInsumosCsv : parsearInsumosTxt, { fecha: new Date(), nota: 'archivo pasado a mano: gana sobre el resto' }));
    if (f && !f.codigos) avisos.push(`--insumos ${extra}: no le saque ninguna unidad. ¿Es el listado impreso? El export tiene que ser el TABULADO, con columna U.Medida.`);
  }

  const insumosTxt = path.join(tmpDir, 'INSUMOS.TXT');
  if (fs.existsSync(insumosTxt)) {
    const texto = decodificar(fs.readFileSync(insumosTxt));
    if (formatoInsumosTxt(texto) === 'tabulado') agregar(fuenteArchivo(insumosTxt, 'INSUMOS.TXT', parsearInsumosTxt, { nota: 'maestro tabulado' }));
    else avisos.push(`${insumosTxt} es el listado IMPRESO, sin columna de unidad: no sirve como maestro. Re-exportar INSUMOS desde el arb eligiendo el export tabulado.`);
  }

  const rel = agregar(fuenteArchivo(path.join(tmpDir, 'RELACIONES.TXT'), 'RELACIONES.TXT', unidadesDeRelaciones, { nota: 'col Unidad: la llena el arb desde el maestro' }));
  for (const d of rel?.dobles ?? []) avisos.push(`${d.codigo} sale con DOS unidades en RELACIONES (${d.unidades.join(', ')}): mirar el maestro antes de cargar nada con ese codigo.`);

  const cache = fuenteArchivo(path.join(cacheDir, 'insumos.csv'), '.arb-cache/insumos.csv', parsearInsumosCsv, { nota: 'lo que escribio _refreshArb.mjs' });
  if (cache?.codigos) agregar(cache);
  for (const n of listarBackups(cacheDir)) {
    agregar(fuenteArchivo(path.join(cacheDir, n), `.arb-cache/${n}`, parsearInsumosCsv, { fecha: fechaDeNombre(n), nota: 'foto vieja del maestro' }));
  }

  // La fuente mas nueva gana; las demas quedan como historico para ver cambios de etiqueta.
  const orden = [...fuentes].sort((a, b) => (b.fecha?.getTime() ?? 0) - (a.fecha?.getTime() ?? 0));
  const mapa = new Map();
  const historico = new Map();
  for (const f of orden) {
    for (const [cod, uni] of f.mapa) {
      const e = { unidad: uni, fuente: f.nombre, fecha: f.fecha };
      if (!mapa.has(cod)) mapa.set(cod, e);
      if (!historico.has(cod)) historico.set(cod, []);
      historico.get(cod).push(e);
    }
  }
  const cambios = [];
  for (const [codigo, hist] of historico) {
    const ahora = hist[0];
    const antes = hist.find((h) => h.unidad && ahora.unidad && compararUnidad(h.unidad, ahora.unidad) === 'distinta');
    if (antes) cambios.push({ codigo, antes, ahora });
  }
  return { mapa, historico, cambios, fuentes: orden, avisos };
}

export const fechaCorta = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '?');
