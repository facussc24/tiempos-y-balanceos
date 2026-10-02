/**
 * amfeAutoria.mjs — lo comun a los generadores de un AMFE NUEVO (scripts/_crearAmfe*.mjs).
 *
 * Por que existe: el 172, el 173 y el 174 se escribieron cada uno con sus propios constructores
 * y sus propios chequeos, copiados y pegados. Lo que hizo que el 174 (Upper Trim, 01-02/10/2026)
 * saliera bien no fue la redaccion: fueron los chequeos que frenan solos lo que Fak y el auditor
 * de cliente marcaron una vez. Aca quedan para que el proximo generador nazca con ellos:
 *
 *   - las operaciones del AMFE son las del flujograma, EN SU ORDEN y con su nombre;
 *   - la S vive en el EFECTO y el AP se calcula (nunca se pasa a mano);
 *   - un control que dice que no existe ("Sin ...", "No hay ...") lleva O=10 o D=10;
 *   - un efecto que dice scrap no puede quedar en la banda de retrabajo (S < 7);
 *   - los tres niveles de funcion son distintos;
 *   - los materiales de la recepcion son los de la BOM del arb, renglon por renglon, y al
 *     reves: ningun material del AMFE que la BOM no tenga.
 *
 * No reemplaza a amfeValidator.mjs (ese corre sobre TODOS los AMFE, al guardar): esto es mas
 * estricto y solo para un documento que se esta escribiendo de cero. Metodo completo: skill
 * `pieza-nueva-flujograma-amfe`. Tests en las dos direcciones: __tests__/scripts/amfeAutoria.test.mjs.
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { calculateAP } from './amfeIo.mjs';
import { nivelPorCriterio } from './amfeValidator.mjs';

// ---------------------------------------------------------------------------
// Constructores
// ---------------------------------------------------------------------------

/**
 * Devuelve { causa, falla, funcion, we, operacion } con ids estables entre corridas
 * (`<prefijo>-0001`...): el gate identifica cada hallazgo por el id de su operacion.
 * @param {{prefijo: string, foco: string}} opts foco = funcion del item (nivel 1, amfe.md §8),
 *   identica en todas las operaciones.
 */
export function crearConstructores({ prefijo, foco }) {
  if (!prefijo || !foco) throw new Error('crearConstructores: faltan prefijo y foco');
  let n = 0;
  const id = () => `${prefijo}-${String(++n).padStart(4, '0')}`;

  function causa(descripcion, prevControl, O, detControl, D) {
    return {
      id: id(),
      cause: descripcion,
      description: descripcion,
      preventionControl: prevControl,
      preventiveControl: prevControl,
      detectionControl: detControl,
      occurrence: O,
      detection: D,
    };
  }

  /** La S sale del EFECTO (`ef.s`) y el AP se calcula. Un AP=H sin accion va con la celda vacia. */
  function falla(descripcion, ef, causas) {
    if (!ef || typeof ef.s !== 'number') throw new Error(`falla "${descripcion}": el efecto no trae su S`);
    for (const c of causas) {
      const ap = calculateAP(ef.s, c.occurrence, c.detection);
      c.ap = ap;
      c.actionPriority = ap;
    }
    return {
      id: id(),
      description: descripcion,
      failureMode: descripcion,
      severity: ef.s,
      effectLocal: ef.local,
      effectNextLevel: ef.next,
      effectEndUser: ef.end,
      causes: causas,
    };
  }

  function funcion(descripcion, requisitos, fallas) {
    return { id: id(), description: descripcion, functionDescription: descripcion, requirements: requisitos, failures: fallas };
  }

  function we(type, name, funciones) {
    return { id: id(), name, type, functions: funciones };
  }

  function operacion(numero, nombre, funcionOperacion, workElements) {
    return {
      id: id(), opNumber: numero, operationNumber: numero,
      name: nombre, operationName: nombre,
      operationFunction: funcionOperacion, focusElementFunction: foco,
      workElements,
    };
  }

  return { causa, falla, funcion, we, operacion };
}

// ---------------------------------------------------------------------------
// El flujograma manda la secuencia (regla no-pfd-no-ho)
// ---------------------------------------------------------------------------

export const sinAcentos = (s) => String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();

const ramasDe = (p) => (Array.isArray(p.branches) ? p.branches : Object.values(p.branches || {}))
  .map((rama) => (Array.isArray(rama) ? rama : rama.sequence || []));

/**
 * Pasos numerados del flujograma en orden de lectura (rama por rama, el reproceso despues de
 * su control). Un almacenado con numero (el WIP del corte) no es una operacion con AMFE.
 * Una operacion dibujada en dos ramas paralelas sale dos veces: el que compara deduplica.
 * @param {object} flujo el JSON de tools/flowchart/data/<clave>.json
 * @returns {{n: string, nombre: string}[]}
 */
export function pasosDelFlujograma(flujo) {
  const pasos = [];
  (function juntar(seq) {
    for (const p of seq || []) {
      if (p.stepId && p.type !== 'storage') pasos.push(p);
      if (p.branchSide?.stepId && p.branchSide.type !== 'storage') pasos.push(p.branchSide);
      if (p.branchSide?.sequence) juntar(p.branchSide.sequence);
      for (const rama of ramasDe(p)) juntar(rama);
    }
  })(flujo.flow);
  return pasos.map((p) => ({ n: String(p.stepId), nombre: sinAcentos(p.description) }));
}

/**
 * El ORDEN del flujograma se mira camino por camino: dentro de una misma secuencia (el flujo
 * principal, o una rama) los numeros tienen que crecer. Entre ramas paralelas no hay orden:
 * la casa dibuja a veces primero la rama del numero mas alto (155 y 157), y eso esta bien.
 * Lo que no puede pasar es una 41 dibujada ANTES de la 40 en el mismo camino.
 * @returns {string[]} errores
 */
export function ordenDelFlujograma(flujo) {
  const errores = [];
  (function recorrer(seq, piso) {
    let ultimo = piso;
    for (const p of seq || []) {
      const n = p.stepId ? Number(p.stepId) : NaN;
      if (!Number.isNaN(n)) {
        if (ultimo !== null && n <= ultimo) errores.push(`en el flujograma la ${p.stepId} esta dibujada despues de la ${ultimo} en el mismo camino`);
        ultimo = n;
      }
      if (p.branchSide?.sequence) recorrer(p.branchSide.sequence, ultimo);
      for (const rama of ramasDe(p)) recorrer(rama, ultimo);
    }
  })(flujo.flow, null);
  return errores;
}

// ---------------------------------------------------------------------------
// Chequeos de autoria
// ---------------------------------------------------------------------------

// Las formas en que un control dice que NO EXISTE, en las dos columnas. "Sin" cuenta solo
// seguido de lo que falta ("Sin plan de control..."): "Sin contacto: sensor con interlock" es
// un control de verdad. Vacio, un guion o "Ninguno" tambien son "no existe".
const NO_EXISTE = /^(sin (control|plan|registro|ensayo|muestra|metodo|verificacion|deteccion|inspeccion|medicion|criterio|prevencion)|no hay |no existe|ningun[oa]?\b|no se (detecta|controla|verifica)|-*$)/i;
export const controlQueNoExiste = (texto) => NO_EXISTE.test(sinAcentos(String(texto ?? '')).trim());

// Un efecto que manda la pieza o el material a scrap. "Sin generar scrap" no cuenta.
const diceScrap = (texto) => /\bscrap\b|se descarta|descarte de/i.test(
  String(texto ?? '').replace(/\b(sin|no)\s+(generar?\s+|se\s+genera\s+|hay\s+)?scrap/gi, ''),
);

/**
 * @param {object} doc el AMFE armado
 * @param {object} [opts]
 * @param {object} [opts.flujograma] JSON del flujograma: las operaciones tienen que ser las suyas
 * @param {{texto: string, o: number}} [opts.controlDeConducta] el control preventivo que depende
 *   del operario y la O que lleva SIEMPRE (el mismo control no puede valer distinto en dos filas)
 * @returns {{errores: string[], stats: object, candidatas: object[], sinPrevencion: string[], sinDeteccion: string[]}}
 */
export function chequeosDeAutoria(doc, opts = {}) {
  const { flujograma = null, controlDeConducta = null } = opts;
  const errores = [];
  const candidatas = [];
  const sinPrevencion = [];
  const sinDeteccion = [];
  const apCount = {};
  let nWE = 0, nFn = 0, nFM = 0, nCausas = 0;

  for (const op of doc.operations) {
    if (!op.workElements.length) errores.push(`OP${op.opNumber} sin work elements`);
    if (op.operationFunction === op.focusElementFunction) errores.push(`OP${op.opNumber}: la funcion de la operacion es igual a la del elemento foco`);
    for (const w of op.workElements) {
      nWE++;
      for (const f of w.functions) {
        nFn++;
        if (f.description === op.operationFunction) errores.push(`OP${op.opNumber}/${w.name}: la funcion del elemento es igual a la de la operacion`);
        if (!f.failures.length) errores.push(`OP${op.opNumber}/${w.name}: funcion sin fallas`);
        for (const fm of f.failures) {
          nFM++;
          if (!fm.effectLocal || !fm.effectNextLevel || !fm.effectEndUser) errores.push(`OP${op.opNumber}: modo de falla sin los 3 efectos: ${fm.description}`);
          if (!fm.causes.length) errores.push(`OP${op.opNumber}: modo de falla sin causas: ${fm.description}`);
          for (const c of fm.causes) {
            nCausas++;
            if (!c.ap) errores.push(`OP${op.opNumber}: causa sin AP: ${c.description}`);
            else apCount[c.ap] = (apCount[c.ap] || 0) + 1;
            if (c.ap && c.ap !== calculateAP(fm.severity, c.occurrence, c.detection)) errores.push(`OP${op.opNumber}: el AP de la causa no es el de la tabla: ${c.description}`);
            if (/error de oper|error del oper|error humano|capacitaci/i.test(`${c.description} ${c.preventiveControl}`)) errores.push(`OP${op.opNumber}: causa o control de "error de operario / capacitacion": ${c.description}`);
            if (controlQueNoExiste(c.preventiveControl) && c.occurrence !== 10) errores.push(`OP${op.opNumber}: una prevencion que no existe lleva O=10 y tiene ${c.occurrence}: ${c.preventiveControl}`);
            if (controlDeConducta && c.preventiveControl === controlDeConducta.texto && c.occurrence !== controlDeConducta.o) errores.push(`OP${op.opNumber}: el control de conducta lleva O=${controlDeConducta.o} y tiene ${c.occurrence}`);
            if (controlQueNoExiste(c.detectionControl) && c.detection !== 10) errores.push(`OP${op.opNumber}: una deteccion que no existe lleva D=10 y tiene ${c.detection}: ${c.detectionControl}`);
            if (controlQueNoExiste(c.preventiveControl)) sinPrevencion.push(`OP ${op.opNumber} · ${fm.description}`);
            if (c.detection === 10) sinDeteccion.push(`OP ${op.opNumber} · ${fm.description}`);
            const nivel = nivelPorCriterio(fm.severity, c.occurrence);
            if (nivel) candidatas.push({ op: op.opNumber, fm: fm.description, s: fm.severity, o: c.occurrence, nivel });
          }
        }
      }
    }
  }
  if (/\bTBD\b/i.test(JSON.stringify(doc))) errores.push('hay un TBD en el documento');

  // Las operaciones del AMFE son las del flujograma: las mismas (una operacion dibujada en dos
  // ramas cuenta una vez), con su nombre, en orden creciente en el AMFE y sin que el
  // flujograma dibuje un numero mayor antes que uno menor en el mismo camino. Un AMFE nuevo
  // lleva una operacion por fila: las filas agrupadas ("80-82") de documentos viejos no entran.
  if (flujograma) {
    const delFlujo = pasosDelFlujograma(flujograma);
    const mias = doc.operations.map((o) => ({ n: String(o.opNumber), nombre: o.name }));
    const numerosFlujo = [...new Set(delFlujo.map((x) => x.n))].sort((a, b) => Number(a) - Number(b));
    const numerosMios = mias.map((x) => x.n);
    if (JSON.stringify(numerosFlujo) !== JSON.stringify(numerosMios)) {
      errores.push(`las operaciones no son las del flujograma, o no estan en su orden: flujograma ${numerosFlujo.join(',')} / AMFE ${numerosMios.join(',')}`);
    }
    errores.push(...ordenDelFlujograma(flujograma));
    for (const f of delFlujo) {
      const m = mias.find((x) => x.n === f.n);
      if (m && sinAcentos(m.nombre) !== f.nombre) errores.push(`OP ${f.n}: el flujograma dice "${f.nombre}" y el AMFE "${m.nombre}"`);
    }
  }

  // Un efecto que manda a SCRAP no puede quedar en la banda de retrabajo (amfe.md §13: S=6
  // para abajo son bandas de retrabajo; si el efecto dice scrap, va 7 u 8). Se mira el efecto
  // en la planta y en el cliente.
  for (const op of doc.operations) for (const w of op.workElements) for (const f of w.functions) for (const fm of f.failures) {
    if (fm.severity < 7 && (diceScrap(fm.effectLocal) || diceScrap(fm.effectNextLevel))) {
      errores.push(`OP${op.opNumber}: "${fm.description}" dice scrap en su efecto y tiene S=${fm.severity}`);
    }
  }

  return { errores, stats: { nWE, nFn, nFM, nCausas, apCount }, candidatas, sinPrevencion, sinDeteccion };
}

// ---------------------------------------------------------------------------
// Los materiales del AMFE son los de la BOM del arb
// ---------------------------------------------------------------------------

export const EXPORT_BOM_ARB = 'C:/tmp/RELACIONES.TXT';

/**
 * Lee del export del arb (RELACIONES.TXT, latin-1, tabulado) la BOM de cada producto.
 * Una lista vacia nunca puede significar "no pude leer": sin archivo, o con un producto sin
 * ningun renglon, tira un error que dice cual.
 * @param {string[]} productos codigos de producto terminado
 * @param {string} [ruta]
 * @returns {{lineas: {producto: string, codigo: string, descripcion: string}[], fecha: Date}}
 */
export function leerBomDelArb(productos, ruta = EXPORT_BOM_ARB) {
  if (!existsSync(ruta)) throw new Error(`no esta el export de la BOM del arb (${ruta}): exportarlo con "python scripts/_arbVer.py export"`);
  return { lineas: parsearBom(readFileSync(ruta, 'latin1'), productos), fecha: statSync(ruta).mtime };
}

/**
 * El parseo, separado de la lectura para poder probarlo con texto.
 *
 * El export trae la BOM a varios niveles. El primer nivel va en las columnas 0-7 con el
 * producto en la columna 0. Un semielaborado (una funda, un corte, un troquelado) se abre en
 * los renglones que siguen, con la columna 0 VACIA y el bloque corrido: el padre en la primera
 * columna con dato, el codigo dos columnas despues y la descripcion tres. Lo que el AMFE
 * recibe y controla son los insumos de ULTIMO nivel, asi que se devuelven las HOJAS: un codigo
 * que despues se abre en sus componentes es intermedio y no se devuelve.
 * (La primera version leia solo el primer nivel: en una pieza con funda no veia el hilo ni el
 * vinilo, y daba verde con el AMFE vacio. Auditoria de cierre del 02/10/2026.)
 */
export function parsearBom(texto, productos) {
  const todas = [];
  let actual = null;
  for (const renglon of texto.split(/\r?\n/)) {
    const c = renglon.split('\t').map((x) => x.trim());
    if (c[0]) {
      actual = c[0];
      if (productos.includes(actual) && c.length >= 4) todas.push({ producto: actual, padre: null, codigo: c[2], descripcion: c[3] });
      continue;
    }
    if (!actual || !productos.includes(actual)) continue;
    const k = c.findIndex((x) => x !== '');
    if (k < 1 || !c[k + 2]) continue;                       // renglon en blanco
    todas.push({ producto: actual, padre: c[k], codigo: c[k + 2], descripcion: c[k + 3] || '' });
  }
  for (const p of productos) {
    if (!todas.some((l) => l.producto === p)) throw new Error(`el export del arb no trae ningun renglon de ${p}: o el codigo esta mal o el export esta cortado`);
  }
  const seAbre = new Set(todas.filter((l) => l.padre).map((l) => `${l.producto}|${l.padre}`));
  return todas
    .filter((l) => !seAbre.has(`${l.producto}|${l.codigo}`))
    .map(({ producto, codigo, descripcion }) => ({ producto, codigo, descripcion }));
}

/**
 * Cruza, en las dos direcciones, la BOM del arb con los materiales de la operacion de recepcion.
 * @param {object} args
 * @param {object} args.doc el AMFE armado
 * @param {{producto: string, codigo: string, descripcion: string}[]} args.bom
 * @param {Record<string, string | {fuera: string}>} args.cobertura por cada codigo de insumo de
 *   la BOM: el NOMBRE EXACTO del elemento Material de la recepcion que lo cubre, o
 *   `{ fuera: 'donde se trata y por que' }` si a proposito no va en la recepcion (la etiqueta).
 * @param {string} [args.opRecepcion='10']
 * @returns {string[]} errores (vacio = cierra)
 */
export function materialesContraBom({ doc, bom, cobertura, opRecepcion = '10' }) {
  const errores = [];
  const op = doc.operations.find((o) => String(o.opNumber) === String(opRecepcion));
  if (!op) return [`no hay operacion ${opRecepcion} donde buscar los materiales`];
  if (!bom.length) return ['la BOM del arb vino vacia: no se puede cruzar'];
  // "Material" es el unico tipo valido del esquema; se compara sin mayusculas para que un
  // tipo mal escrito no saque al elemento del cruce en silencio.
  const materiales = op.workElements.filter((w) => /^material$/i.test(String(w.type))).map((w) => w.name);
  const codigosBom = [...new Set(bom.map((l) => l.codigo))];
  const usados = new Set();

  for (const codigo of codigosBom) {
    const destino = cobertura[codigo];
    const desc = bom.find((l) => l.codigo === codigo).descripcion;
    if (destino === undefined || destino === null) { errores.push(`la BOM del arb tiene ${codigo} (${desc}) y el AMFE no dice donde lo trata`); continue; }
    if (typeof destino === 'object') {
      if (!destino.fuera) errores.push(`${codigo}: la cobertura no dice ni el material ni por que queda fuera`);
      continue;
    }
    if (!materiales.includes(destino)) errores.push(`${codigo} (${desc}) apunta a "${destino}", que no es un material de la OP ${opRecepcion}`);
    else usados.add(destino);
  }
  for (const codigo of Object.keys(cobertura)) {
    if (!codigosBom.includes(codigo)) errores.push(`la cobertura nombra ${codigo}, que ya no esta en la BOM del arb`);
  }
  for (const m of materiales) {
    if (!usados.has(m)) errores.push(`la OP ${opRecepcion} tiene el material "${m}" y ningun renglon de la BOM del arb lo respalda`);
  }
  return errores;
}
