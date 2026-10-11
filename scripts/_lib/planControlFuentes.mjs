/**
 * planControlFuentes.mjs — los LECTORES de las entradas de un plan de control (P6, etapa 1).
 *
 * Por que existe (plan `docs/PLAN_P6_PLANES_DE_CONTROL_2026-10-10.md`, §7.3 y §7.4): la base
 * preliminar de un plan de control se arma desde papeles reales — el flujograma del repo, el AMFE
 * vivo, la hoja de operaciones (HO) en Excel, la BOM del arb y, para compararse, el plan que ya
 * tiene Calidad. Cada lector devuelve lo que el papel DICE, con la celda u hoja de donde salio,
 * para que cada valor del plan lleve su `sourceRef`. Aca no se decide nada: no hay heuristica de
 * texto, no se inventa un valor, no se escribe en ningun lado.
 *
 * Lo que entra y lo que sale:
 *   leerFlujograma(ruta)            -> { sourceId, header, products, pasos:[{ n, nombre, tipo, sigla, loc }] }
 *   leerAmfe(doc, { numeroCasa })   -> { sourceId, header, operations:[{ id, n, numeros, nombre, causas }], causas }
 *   leerHoXlsx(ruta, { doc })       -> { sourceId, doc, hojas:[{ hoja, op, nombre, sector, rev, fecha, pasos, ciclo, texto }] }
 *   leerBomXlsx(ruta, codigos)      -> { sourceId, materiales:[{ codigo, descripcion, unidad, nivel, modulo, productos }] }
 *   leerPlanExistenteXls(ruta, hoja)-> { sourceId, filas:[{ fila, ops, nombre, maquina, ... }] }
 *   leerEntradas(ruta, pieza)       -> el JSON declarado de esa pieza (rutas, fase, tablas de ejemplo)
 *
 * Supabase: este modulo NO se conecta. El AMFE vivo lo trae `scripts/_planControl.mjs` con el
 * cliente de solo lectura (`supabaseSoloLectura.mjs`) y se lo pasa a `leerAmfe()` ya parseado.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { sinAcentos } from './amfeAutoria.mjs';

const require = createRequire(import.meta.url);

/** Una referencia a una celda/hoja de un papel: lo que lleva cada valor del plan. */
export const ref = (sourceId, loc) => ({ sourceId, loc });

/** Texto plano de una celda de ExcelJS (rich text, formulas y fechas incluidos). */
export function textoCelda(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return textoCelda(v.richText.map((t) => t.text).join(''));
    if ('result' in v) return textoCelda(v.result);
    if ('text' in v) return textoCelda(v.text);
    if ('formula' in v || 'sharedFormula' in v) return '';   // formula sin resultado cacheado: no hay dato
    return '';                                               // un objeto que no se reconoce no es un dato
  }
  return String(v).replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Flujograma
// ---------------------------------------------------------------------------

/**
 * Las operaciones del flujograma con su tipo y su marca, en el orden del dibujo. Un `storage`
 * (almacenamiento/WIP) no es una operacion del plan: se devuelve igual, con su tipo, para que
 * el que arma el plan decida (§7.1 gate 1: transporte y almacenamiento sin caracteristica van a
 * la lista, no a una fila forzada).
 */
export function operacionesDelFlujograma(flujo) {
  const pasos = [];
  (function juntar(x, camino) {
    if (Array.isArray(x)) { x.forEach((e, i) => juntar(e, `${camino}[${i}]`)); return; }
    if (!x || typeof x !== 'object') return;
    if (x.stepId) {
      pasos.push({
        n: String(x.stepId),
        nombre: String(x.description || x.text || x.labelCondition || '').trim(),
        tipo: String(x.type || ''),
        sigla: String(x.criticalType || '').trim(),
        loc: `flow${camino}`,
      });
    }
    for (const k of Object.keys(x)) if (k !== 'stepId') juntar(x[k], `${camino}.${k}`);
  })(flujo.flow, '');
  return pasos;
}

export function leerFlujograma(ruta) {
  const flujo = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  const numero = (path.basename(ruta).match(/^(\d+)/) || [])[1] || '';
  return {
    sourceId: `FLUJOGRAMA-${numero}`,
    doc: `${flujo.header?.title || 'Flujograma'} ${numero} Rev. ${flujo.header?.revision || '?'}`,
    revision: flujo.header?.revision || '',
    path: ruta,
    header: flujo.header || {},
    products: flujo.products || [],
    pasos: operacionesDelFlujograma(flujo),
  };
}

// ---------------------------------------------------------------------------
// AMFE (ya parseado: `parseData()` de amfeIo.mjs, o un fixture)
// ---------------------------------------------------------------------------

/** "90-92" -> ["90","91","92"]; "90/92" y "90 y 92" -> ["90","92"]; "41" -> ["41"]. Un rango al reves ("92-90") se endereza. */
export function expandirNumeros(n) {
  const texto = String(n).trim();
  const m = texto.match(/^(\d+)\s*(?:-|–|a|al)\s*(\d+)$/i);
  if (!m) return [...new Set(texto.split(/\s*(?:\/|,|\s+y\s+)\s*/).map((x) => x.trim()).filter(Boolean))];
  const [a, b] = [Number(m[1]), Number(m[2])].sort((x, y) => x - y);
  const out = [];
  for (let i = a; i <= b; i++) out.push(String(i));
  return out;
}

/**
 * El AMFE aplanado: operaciones con sus causas (id, S/O/D, controles, sigla). Lo que el plan
 * COPIA del AMFE es la sigla de la causa vinculada por id; lo que NO toma es una especificacion.
 */
export function leerAmfe(doc, { numeroCasa = '', amfeNumber = '' } = {}) {
  const numero = numeroCasa || doc.header?.amfeNumber || amfeNumber || '?';
  const operations = [];
  const causas = [];
  for (const op of doc.operations || []) {
    const n = String(op.operationNumber ?? op.opNumber ?? '').trim();
    const entrada = { id: op.id, n, numeros: expandirNumeros(n), nombre: String(op.operationName || op.name || ''), causas: [] };
    for (const we of op.workElements || []) {
      for (const fn of we.functions || []) {
        for (const falla of fn.failures || fn.failureModes || []) {
          for (const c of falla.causes || []) {
            const causa = {
              id: c.id,
              op: n,
              opId: op.id,
              elemento: String(we.name || we.description || ''),
              falla: String(falla.description || ''),
              causa: String(c.description || c.cause || ''),
              S: Number(c.severity ?? falla.severity ?? 0),
              O: Number(c.occurrence ?? 0),
              D: Number(c.detection ?? 0),
              preventionControl: String(c.preventionControl || ''),
              detectionControl: String(c.detectionControl || ''),
              specialChar: String(c.specialChar || '').trim(),
              characteristicNumber: String(c.characteristicNumber || '').trim(),
              loc: `op ${n} > ${String(we.name || we.description || '').slice(0, 40)} > ${String(falla.description || '').slice(0, 40)} > causa ${c.id}`,
            };
            entrada.causas.push(causa);
            causas.push(causa);
          }
        }
      }
    }
    operations.push(entrada);
  }
  return {
    sourceId: `AMFE-${numero}`,
    doc: `AMFE ${numero} ${doc.header?.scope || ''} Rev. ${doc.header?.rev || doc.header?.revisionLevel || '?'}`.trim(),
    revision: String(doc.header?.rev || doc.header?.revisionLevel || ''),
    header: doc.header || {},
    operations,
    causas,
  };
}

// ---------------------------------------------------------------------------
// Hoja de operaciones (formulario I-IN-002.4-R01 en Excel: una hoja por operacion)
// ---------------------------------------------------------------------------

const CELDAS_HO = { op: 'B6', nombre: 'E6', sector: 'B8', rev: 'Q8', fecha: 'Q7', numero: 'Q3' };
const SIN_DATO = /^(-+|—|–|\?|tbd|n\/d|s\/d|pendiente(\s*\/\s*tbd)?)$/i;
/** true si el texto de una celda del ciclo de control NO es un dato ("-", "–", "?", "N/D", "S/D", "TBD", "PENDIENTE / TBD"). Un "N/A" SI es un dato: la HO dice que no aplica. */
export const esVacioHo = (t) => !String(t ?? '').trim() || SIN_DATO.test(String(t).trim()) || /PENDIENTE\s*\/\s*TBD/i.test(String(t));
/** true si el item del ciclo de control no es una caracteristica sino la HO remitiendo al plan de control ("Según plan de control", "Según plan de control vigente"). */
export const remiteAlPlan = (t) => /^seg[uú]n (el )?plan de control\b/i.test(String(t ?? '').trim());
/** Lo que, debajo del ciclo de control, ya no es un item (pie de la hoja). */
const FIN_CICLO = /^(referencia:|rev\.?\b|realiz[oó]|aprob[oó]|firma|fecha:)/i;

/**
 * Lee una HO en Excel (una hoja por operacion; `20.1` es la hoja 2 de la operacion 20). De cada
 * hoja saca el cajetin, los pasos y el CICLO DE CONTROL (caracteristica, metodo, resp., frec.,
 * registro), cada item con su celda. No interpreta: un "-" queda como "-" y `esVacioHo()` dice
 * que no es dato.
 */
export async function leerHoXlsx(ruta, { doc = '' } = {}) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ruta);
  const deOperacion = wb.worksheets.filter((ws) => /^\d+(\.\d+)?$/.test(String(ws.name).trim()));
  if (!deOperacion.length) throw new Error(`${ruta}: ninguna hoja se llama como una operacion (10, 20, 20.1...): no es una HO en el formulario I-IN-002.4-R01 (hojas: ${wb.worksheets.map((w) => w.name).join(', ')})`);
  // el numero de la HO se fija ANTES de leer las hojas, para que todos los ids lleven el mismo prefijo
  let numeroHo = doc;
  for (const ws of deOperacion) { if (numeroHo) break; numeroHo = textoCelda(ws.getCell(CELDAS_HO.numero).value).replace(/\s+/g, ''); }
  const sourceId = (numeroHo || 'HO').replace(/\s+/g, '').replace(/^HO-?/, 'HO-');
  const hojas = [];
  for (const ws of deOperacion) {
    const hoja = String(ws.name).trim();
    const op = hoja.split('.')[0];
    const celda = (addr) => textoCelda(ws.getCell(addr).value);
    const nombre = celda(CELDAS_HO.nombre);
    const pasos = [];
    const ciclo = [];
    const textos = [];
    const reaccion = [];
    let filaCiclo = null;
    let finCiclo = false;
    let filaReaccion = null;
    ws.eachRow({ includeEmpty: false }, (row, r) => {
      // una celda combinada (I26:K27) devuelve el valor del master en cada fila que tapa:
      // la fila que no es el master no es un item nuevo
      const cI = row.getCell('I');
      const esclavaI = cI.isMerged && cI.master && cI.master.address !== cI.address;
      const I = esclavaI ? '' : textoCelda(cI.value);
      const J = textoCelda(row.getCell('J').value);
      const cB = row.getCell('B');
      const B = cB.isMerged && cB.master && cB.master.address !== cB.address ? '' : textoCelda(cB.value);   // B27:B28 combinada: un solo renglon
      if (I) textos.push(I);
      if (J) textos.push(J);
      // el bloque PLAN DE REACCION ANTE NO CONFORME vive en la columna B (sus renglones, con su
      // celda) y comparte filas con el ciclo de control de la columna I: se leen los dos
      if (/^PLAN DE REACCI[OÓ]N/i.test(B)) filaReaccion = r;
      else if (filaReaccion && r > filaReaccion && B) reaccion.push({ texto: B, celda: `B${r}` });
      if (esclavaI) return;
      if (/^Caracter[ií]sticas a controlar$/i.test(I)) { filaCiclo = r; return; }
      if (filaCiclo && r > filaCiclo && I && !finCiclo) {
        if (FIN_CICLO.test(I)) { finCiclo = true; return; }
        if (/^CICLO DE CONTROL$/i.test(I)) return;
        ciclo.push({
          id: `${sourceId}/${hoja}/I${r}`,
          hoja, op, fila: r,
          remite: remiteAlPlan(I),
          caracteristica: I,
          metodo: textoCelda(row.getCell('L').value),
          resp: textoCelda(row.getCell('N').value),
          frec: textoCelda(row.getCell('P').value),
          registro: textoCelda(row.getCell('R').value),
        });
        return;
      }
      if (!filaCiclo) {
        if (/^\d+[.)-]?$/.test(I) && J) pasos.push({ n: I.replace(/\D/g, ''), texto: J, celda: `J${r}` });
        else if (/^\d+\s*[.)-]\s*\S/.test(I)) pasos.push({ n: I.match(/^\d+/)[0], texto: I, celda: `I${r}` });
      }
    });
    hojas.push({
      hoja, op, nombre, sector: celda(CELDAS_HO.sector), rev: celda(CELDAS_HO.rev), fecha: celda(CELDAS_HO.fecha),
      pasos, ciclo, reaccion, texto: textos.join(' \n '),
    });
  }
  return { sourceId, doc: sourceId, path: ruta, hojas };
}

/** Las hojas de una operacion (la `20` y sus `20.1`, `20.2`). */
export const hojasDeOp = (ho, op) => (ho?.hojas || []).filter((h) => h.op === String(op));

// ---------------------------------------------------------------------------
// BOM del arb (informe maestro en xlsx, hoja BOM_COMPLETA_FILTRABLE)
// ---------------------------------------------------------------------------

/**
 * Materiales de ultimo nivel de los codigos pedidos, deduplicados por codigo de insumo. Un
 * semielaborado propio (nivel 0 que se abre en .1) queda con `seAbre: true`: no se recibe, se
 * fabrica (lo que se recibe son sus hijos).
 */
export function leerBomXlsx(ruta, codigos, { hoja = 'BOM_COMPLETA_FILTRABLE' } = {}) {
  const X = require('xlsx-js-style');
  const wb = X.readFile(ruta);
  const ws = wb.Sheets[hoja];
  if (!ws) throw new Error(`la BOM ${ruta} no tiene la hoja ${hoja} (tiene: ${wb.SheetNames.join(', ')})`);
  const filas = X.utils.sheet_to_json(ws, { header: 1, defval: null });
  const cab = (filas[0] || []).map((c) => sinAcentos(String(c ?? '')));
  const col = (nombre) => cab.findIndex((c) => c.includes(sinAcentos(nombre)));
  const iProd = col('Codigo Producto'); const iNivel = col('Nivel BOM'); const iCod = col('Codigo Insumo');
  const iDesc = col('Descripcion Insumo'); const iCons = col('Consumo'); const iUni = col('Unidad'); const iMod = col('Modulo ARB');
  if ([iProd, iCod, iDesc, iNivel].some((i) => i < 0)) throw new Error(`la hoja ${hoja} no tiene las columnas esperadas (Codigo Producto, Nivel BOM, Codigo Insumo, Descripcion Insumo)`);
  const quiero = new Set(codigos.map((c) => sinAcentos(c).replace(/\s+/g, '')));
  const porCodigo = new Map();
  let ultimoNivel0 = null;
  filas.slice(1).forEach((f, k) => {
    const prod = sinAcentos(String(f[iProd] ?? '')).replace(/\s+/g, '');
    if (!quiero.has(prod)) { ultimoNivel0 = null; return; }
    const codigo = String(f[iCod] ?? '').trim();
    if (!codigo) return;
    const nivel = String(f[iNivel] ?? '').trim();
    const e = porCodigo.get(codigo) || {
      codigo, descripcion: String(f[iDesc] ?? '').trim(), unidad: String(f[iUni] ?? '').trim(),
      nivel, modulo: String(f[iMod] ?? '').trim(), productos: [], consumos: [], filas: [], seAbre: false, hijos: [],
    };
    e.productos.push(String(f[iProd]).trim());
    e.consumos.push(f[iCons]);
    e.filas.push(k + 2);
    porCodigo.set(codigo, e);
    // el informe lista debajo de un nivel 0 sus componentes en .1: ese nivel 0 se ABRE (es un
    // semielaborado propio, se fabrica, no se recibe); lo que se recibe son sus hijos
    if (nivel === '0') ultimoNivel0 = e;
    else if (nivel.startsWith('.') && ultimoNivel0) { ultimoNivel0.seAbre = true; if (!ultimoNivel0.hijos.includes(codigo)) ultimoNivel0.hijos.push(codigo); }
  });
  const materiales = [...porCodigo.values()];
  for (const p of codigos) {
    if (!materiales.some((m) => m.productos.some((x) => sinAcentos(x).replace(/\s+/g, '') === sinAcentos(p).replace(/\s+/g, '')))) {
      throw new Error(`la BOM ${ruta} no trae ningun renglon de ${p}`);
    }
  }
  return { sourceId: 'BOM-ARB', doc: `BOM ultimo nivel del arb (${path.basename(ruta)}, hoja ${hoja})`, path: ruta, materiales };
}

// ---------------------------------------------------------------------------
// Plan existente de Calidad (.xls, formulario I-AC-005.1)
// ---------------------------------------------------------------------------

const COLS_PC = ['op', 'nombre', 'maquina', 'nro', 'producto', 'proceso', 'clasif', 'spec', 'calibre', 'tam', 'frec', 'metodo', 'resp', 'reaccion'];

/** "Operación 90-93" -> ["90","91","92","93"]; "Operación 10." -> ["10"]; "Recepción" -> []. */
export function opsDeCelda(texto) {
  const m = String(texto ?? '').match(/(\d+(?:\s*(?:-|–|al|a|\/|,|y)\s*\d+)*)/i);
  if (!m) return [];
  // la misma lectura que expandirNumeros: "-", "a", "al" es rango; "/", "," e "y" es lista
  return expandirNumeros(m[1].replace(/\s*(al|a)\s*/i, '-'));
}

/**
 * Las filas del plan de Calidad tal cual estan (una por renglon con contenido), con la operacion
 * arrastrada desde el ultimo "Operación N" leido. Sirve para COMPARAR, nunca como papel de una
 * especificacion (§7.1 gate 4: el plan viejo no es fuente).
 */
export function leerPlanExistenteXls(ruta, { hoja = '' } = {}) {
  const X = require('xlsx-js-style');
  const wb = X.readFile(ruta);
  const nombreHoja = wb.SheetNames.find((n) => sinAcentos(n).includes(sinAcentos(hoja))) || wb.SheetNames[0];
  const ws = wb.Sheets[nombreHoja];
  const filas = X.utils.sheet_to_json(ws, { header: 1, defval: null });
  const iCab = filas.findIndex((f) => sinAcentos(String(f[0] ?? '')).includes('N PIEZA') || sinAcentos(String(f[1] ?? '')).includes('NOMBRE DEL PROCESO'));
  if (iCab < 0) throw new Error(`${ruta} (hoja ${nombreHoja}): no encuentro la cabecera "Nº PIEZA / PROCESO · NOMBRE DEL PROCESO" del formulario I-AC-005.1`);
  const out = [];
  let ops = [];
  let seccion = '';
  filas.forEach((f, k) => {
    if (k <= iCab + 3) return;    // la cabecera ocupa 4 renglones (70-73 en el formulario)
    const celdas = COLS_PC.map((c, i) => String(f[i] ?? '').replace(/\s+/g, ' ').trim());
    if (!celdas.some(Boolean)) return;
    const row = Object.fromEntries(COLS_PC.map((c, i) => [c, celdas[i]]));
    // un renglon con solo la primera celda es un titulo de seccion ("Recepción", "Proceso", "TEST DE
    // LAY OUT"): corta la operacion arrastrada, para que lo de abajo no herede la ultima
    if (row.op && !celdas.slice(1).some(Boolean)) { seccion = row.op; if (!/operaci/i.test(row.op)) { ops = []; return; } }
    // la operacion solo cambia con una celda "Operación N" (o "Operación 90-93"); un "1.0" de la
    // seccion TEST DE LAY OUT no es una operacion
    if (/operaci/i.test(row.op)) ops = opsDeCelda(row.op).length ? opsDeCelda(row.op) : ops;
    out.push({ fila: k + 1, ops: [...ops], seccion, ...row });
  });
  return { sourceId: 'PC-EXISTENTE', doc: `${path.basename(ruta)} (hoja ${nombreHoja})`, path: ruta, hoja: nombreHoja, filas: out };
}

// ---------------------------------------------------------------------------
// Entradas declaradas por pieza
// ---------------------------------------------------------------------------

export const RUTA_ENTRADAS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'planControlEntradas.data.json');

export function leerEntradas(pieza, ruta = RUTA_ENTRADAS) {
  const todas = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  const e = todas[pieza];
  if (!e) throw new Error(`no hay entradas declaradas para la pieza ${pieza} en ${ruta} (hay: ${Object.keys(todas).filter((k) => !k.startsWith('_')).join(', ')})`);
  return e;
}
