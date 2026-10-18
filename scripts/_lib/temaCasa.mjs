/**
 * temaCasa.mjs — carga el tema de lo que entrega Ingenieria (scripts/_lib/tema.json) y verifica el logo por sha256.
 * Gemelo de scripts/_lib/temaCasa.py: si el logo no es el oficial, o no esta, TIRA (no devuelve el tema).
 * core-prohibiciones.md §9: el logo de Barack sale de UN solo archivo. Tanda 16, pieza 3.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ = resolve(AQUI, '..', '..');
export const TEMA_JSON = join(AQUI, 'tema.json');

export const sha256 = (ruta) => createHash('sha256').update(readFileSync(ruta)).digest('hex');

const cache = new Map();

/** El tema con `logo.ruta` absoluta. Tira si el logo no es el oficial. */
export function cargarTema({ rutaTema = TEMA_JSON, raiz = RAIZ } = {}) {
  const clave = `${resolve(rutaTema)}|${resolve(raiz)}`;
  if (cache.has(clave)) return cache.get(clave);
  let tema;
  try { tema = JSON.parse(readFileSync(rutaTema, 'utf8')); } catch (e) { throw new Error(`no pude leer el tema ${rutaTema}: ${e.message}`); }
  const logo = join(raiz, tema.logo.ruta_repo);
  if (!existsSync(logo)) throw new Error(`no esta el logo oficial en ${logo}`);
  const real = sha256(logo);
  if (real !== tema.logo.sha256) throw new Error(`el logo ${logo} NO es el oficial (sha256 ${real.slice(0, 12)}..., el tema dice ${tema.logo.sha256.slice(0, 12)}...)`);
  tema.logo.ruta = logo;
  cache.set(clave, tema);
  return tema;
}

/** Hex con '#' para CSS (ej. '#44546A'). */
export function colorCss(nombre, op) {
  const c = cargarTema(op).colores[nombre];
  if (!c || typeof c !== 'object' || !c.valor) throw new Error(`el tema no tiene el color «${nombre}»`);
  return `#${c.valor}`;
}

/** La letra con sus alternativas, lista para `font-family`. */
export function letraCss(op) {
  const l = cargarTema(op).letra;
  return [l.nombre, ...l.alternativas].map((f) => `"${f}"`).join(',') + ',sans-serif';
}
