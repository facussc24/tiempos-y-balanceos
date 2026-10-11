/**
 * controlCanon.mjs — como se IDENTIFICA un control (de un AMFE o de un plan de control).
 *
 * Fuente unica: `planControlCanon.data.json`. Lo usan el validador de AMFE
 * (`amfeValidator.mjs`, aviso DETECCION_GENERICA) y el cruce AMFE <-> plan
 * (`planControlAmfe.mjs`, gate 8): los dos tienen que decir lo mismo del mismo texto. Fak,
 * 10/10/2026: *"los detectivos del amfe no coinciden con los del plan de control o los amfes de hoy
 * tienen controles medio inventados o genericos"*.
 *
 * Un control se identifica por un codigo de calibracion (MC + 3 cifras) o por un termino EXACTO
 * del catalogo. El texto libre nunca decide. Lo que el catalogo no tiene no se agrega solo:
 * `fuera_del_catalogo` lista lo que un control NOMBRA y todavia no esta catalogado (panel, alarma,
 * sensor, ensayo), para no confundirlo con una inspeccion visual pelada.
 *
 * Este modulo no importa nada del repo (ni el validador ni el plan): asi lo pueden importar los dos.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CANON = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'planControlCanon.data.json'), 'utf8'));

const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/\s+/g, ' ').trim();

/** Codigos de instrumento de la casa (cronograma de calibracion): MC + 3 cifras (MC167, MC184, MC212, MC406). Otro formato no se reconoce: limite conocido. */
const RE_INSTRUMENTO = /\bMC\s?-?\s?(\d{3})\b/i;
export const codigoInstrumento = (texto) => { const m = String(texto ?? '').match(RE_INSTRUMENTO); return m ? `MC${m[1]}` : ''; };

/** El termino aparece como palabra(s) entera(s) en el texto. */
function contieneTermino(textoNorm, termino) {
  const t = norm(termino).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Z0-9])${t}([^A-Z0-9]|$)`).test(textoNorm);
}

/**
 * Lo que identifica al control en un texto: { codigo, tipos[], referencias[], clase } o null.
 * `codigo` = MC### si lo trae; `tipos` = los instrumentos del canon que nombra (el termino mas
 * largo primero: «contra calibre» es CALIBRE_DE_CONTROL y no ademas CALIBRE); `referencias` = los
 * terminos de una clase no identificable (pieza patron). Un control con solo una referencia, o
 * con un comodin («Calibre / Instrumento») y sin codigo, NO es identificable.
 */
export function instrumentoDe(texto, canon = CANON) {
  let t = norm(texto);
  if (!t) return null;
  const codigo = codigoInstrumento(texto);
  const terminos = canon.instrumentos.flatMap((i) => i.terminos.map((x) => ({ id: i.id, clase: i.clase, x: norm(x) }))).sort((a, b) => b.x.length - a.x.length);
  const tipos = []; const otros = [];
  for (const term of terminos) {
    if (!contieneTermino(t, term.x)) continue;
    t = t.split(term.x).join(' ');
    const lista = canon.clases_identificables.includes(term.clase) ? tipos : otros;
    if (!lista.includes(term.id)) lista.push(term.id);
  }
  if (!codigo && !tipos.length && !otros.length) return null;
  const comodin = (canon.no_identifica || []).find((x) => contieneTermino(norm(texto), x));
  if (comodin && !codigo) return { codigo: '', tipos: [], referencias: [...otros, ...tipos].sort(), clase: 'referencia', comodin };
  return { codigo, tipos: tipos.sort(), referencias: otros.sort(), clase: codigo || tipos.length ? 'instrumento' : 'referencia' };
}
/** true si el control tiene instrumento identificable (codigo o termino de una clase identificable). */
export const esIdentificable = (ins) => !!ins && ins.clase === 'instrumento';

/** Frecuencias que el texto trae, por termino exacto del canon (puede haber mas de una). */
export function frecuenciasDe(texto, canon = CANON) {
  const t = norm(texto);
  return canon.frecuencias.filter((f) => f.terminos.some((x) => contieneTermino(t, x))).map((f) => f.id);
}

/** Lo que el control nombra y el catalogo todavia no tiene (panel, alarma, sensor, ensayo): ids del canon. */
export function fueraDelCatalogoDe(texto, canon = CANON) {
  const t = norm(texto);
  return (canon.fuera_del_catalogo || []).filter((f) => f.terminos.some((x) => contieneTermino(t, x))).map((f) => f.id);
}

/**
 * Clasifica el texto de un control de deteccion. Es el MISMO criterio del gate 8 del plan de control:
 *   - 'vacio'              sin texto (o "-"): lo avisa DETECCION_SIN_CONTROL_DECLARADO, no esto
 *   - 'declarado_inexistente' «Sin ...» / «No hay ...»: la ausencia declarada (convencion de la casa), no un control
 *   - 'identificado'       trae un codigo MC### o un instrumento del catalogo
 *   - 'fuera_del_catalogo' nombra un medio (panel, alarma, sensor, ensayo) que el catalogo no tiene
 *   - 'generico'           nada de lo anterior: «Inspeccion visual», «Visual», «Inspeccion de calidad»
 */
export function clasificarControl(texto, canon = CANON) {
  const limpio = String(texto ?? '').trim();
  const ins = instrumentoDe(limpio, canon);
  const frecuencias = frecuenciasDe(limpio, canon);
  const fuera = fueraDelCatalogoDe(limpio, canon);
  const t = norm(limpio);
  const empiezaCon = (p) => t === norm(p) || new RegExp(`^${norm(p)}([^A-Z0-9]|$)`).test(t);
  const noExiste = (canon.no_existe_prefijos || []).some(empiezaCon) && !(canon.no_existe_excepciones || []).some(empiezaCon);
  const clase = !limpio || /^[-—–]+$/.test(limpio) ? 'vacio'
    : noExiste ? 'declarado_inexistente'
    : esIdentificable(ins) ? 'identificado'
    : fuera.length ? 'fuera_del_catalogo'
    : 'generico';
  return { clase, instrumento: ins, frecuencias, fuera, referencias: ins?.referencias || [] };
}
