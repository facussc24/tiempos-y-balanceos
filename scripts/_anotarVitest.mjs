#!/usr/bin/env node
/**
 * _anotarVitest.mjs — deja el rojo de vitest en las ANOTACIONES del job.
 *
 * POR QUE EXISTE (13/09/2026). Un rojo del CI que no se puede leer desde donde trabajo
 * obliga a adivinar, y el de vitest es INTERMITENTE (4 de los ultimos 20 runs, todos en
 * commits que solo tocan docs), asi que adivinar es lo peor de los dos mundos: ni se
 * reproduce ni se lee. Los dos caminos que parecian resolverlo no resuelven:
 *
 *   - El LOG del job pide cuenta de GitHub, aunque el repo sea publico ("Sign in to view
 *     logs").
 *   - El SUMMARY del job tampoco se ve sin sesion — el 11/09 se escribio el paso del
 *     workflow creyendo que si, y abierto el run sin login no se renderiza.
 *   - `--reporter=github-actions` anota los asserts que fallan, pero dejo el job con CERO
 *     anotaciones las dos veces que hubo rojo (11 y 13/09): una corrida que muere de otra
 *     forma (worker caido, import roto, timeout del proceso) no pasa por ese camino.
 *
 * Lo unico que la API devuelve SIN auth es `/repos/{o}/{r}/check-runs/{job_id}/annotations`.
 * Por eso esto imprime `::error::` propios: son anotaciones que no dependen del reporter.
 *
 * Uso:  node scripts/_anotarVitest.mjs /tmp/vitest.log
 * Sale SIEMPRE con 0: corre dentro de un `if: failure()` y no tiene que tapar el rojo
 * verdadero con uno propio.
 */
import fs from 'node:fs';

const TOPE_ANOTACIONES = 20;
const TOPE_CHARS = 900;
const ANSI = /\[[0-9;]*[A-Za-z]/g;

/** Las lineas que dicen QUE fallo. En orden de utilidad, no de aparicion. */
const PATRONES = [
  /^\s*FAIL\b/,                    // FAIL  __tests__/x.test.ts > caso
  /^\s*(?:×|✕)\s/,                 // el test puntual
  /AssertionError|TypeError|ReferenceError|SyntaxError/,
  /^\s*(?:Error|Caused by):/,
  /Unhandled (?:Error|Rejection)/,
  /^\s*(?:Tests|Test Files)\s{2}/, // el resumen: cuantos y de que tipo
  /Serialized Error|hook timed out|Test timed out/,
];

const limpiar = (s) => s.replace(ANSI, '').replace(/\r/g, '').trimEnd();

/** Anotacion de GitHub: `%` se escapa, y el mensaje va en una sola linea. */
const paraAnotacion = (s) => s.replace(/%/g, '%25').slice(0, TOPE_CHARS);

export function lineasDelRojo(texto, tope = TOPE_ANOTACIONES) {
  const lineas = String(texto ?? '').split(/\n/).map(limpiar).filter((l) => l.trim());
  const vistas = new Set();
  const out = [];
  for (const l of lineas) {
    // Las `::error file=...::` son del reporter github-actions: el runner ya las convirtio
    // en anotaciones. Reanotarlas las escapa dos veces y llena el job de ruido ilegible.
    if (l.startsWith('::')) continue;
    if (!PATRONES.some((p) => p.test(l))) continue;
    const k = l.trim();
    if (vistas.has(k)) continue;      // vitest repite el FAIL en el resumen
    vistas.add(k);
    out.push(k);
    if (out.length >= tope) break;
  }
  // Un log que no matchea ningun patron NO puede quedar sin anotacion: ahi es justamente
  // cuando no tengo idea de que paso. Van las ultimas lineas, que es lo que se mira a mano.
  if (!out.length) {
    for (const l of lineas.slice(-10)) out.push(l.trim());
  }
  return out;
}

function main() {
  const ruta = process.argv[2] || '/tmp/vitest.log';
  let texto = '';
  try {
    texto = fs.readFileSync(ruta, 'utf8');
  } catch (e) {
    console.log(`::error title=vitest::no se pudo leer el log (${ruta}): ${e.message}`);
    return;
  }
  const lineas = lineasDelRojo(texto);
  for (const l of lineas) console.log(`::error title=vitest::${paraAnotacion(l)}`);
  console.log(`[_anotarVitest] ${lineas.length} anotacion(es) desde ${ruta}`);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`
    || process.argv[1]?.endsWith('_anotarVitest.mjs')) {
  main();
}
