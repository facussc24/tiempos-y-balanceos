/**
 * _anotarVitest.mjs — deja el rojo de vitest en las ANOTACIONES del job.
 *
 * POR QUE EXISTE (13/09/2026). Un rojo del CI que no se puede leer desde donde trabajo
 * obliga a adivinar, y el de vitest es INTERMITENTE (4 de los ultimos 20 runs, todos en
 * commits que solo tocan docs), asi que adivinar es lo peor de los dos mundos: ni se
 * reproduce ni se lee. Los tres caminos que parecian resolverlo no resuelven:
 *
 *   - El LOG del job pide cuenta de GitHub, aunque el repo sea publico ("Sign in to view
 *     logs").
 *   - El SUMMARY del job tampoco se ve sin sesion — el 11/09 se escribio el paso del
 *     workflow creyendo que si, y abierto el run sin login no se renderiza.
 *   - `--reporter=github-actions` anota los asserts que fallan, pero dejo el job con CERO
 *     anotaciones las dos veces que hubo rojo (11 y 13/09): una corrida que muere de otra
 *     forma (worker caido, import roto, suite que no carga) no pasa por ese camino.
 *
 * Lo unico que la API devuelve SIN auth es `/repos/{o}/{r}/check-runs/{job_id}/annotations`.
 * Por eso esto imprime `::error::` propios: son anotaciones que no dependen del reporter.
 *
 * SIN SHEBANG a proposito (convencion de scripts/, ver convencionesScripts.test.mjs): Vitest
 * inlinea los modulos y `new vm.Script()` no acepta `#!`. La primera version de este archivo
 * lo tenia y volteo la suite entera EN CI --con cache tibio local pasaba--, o sea que el
 * script escrito para leer el rojo salio rojo por un motivo que solo se veia alla.
 *
 * Uso:  node scripts/_anotarVitest.mjs /tmp/vitest.log
 * Sale SIEMPRE con 0: corre dentro de un `if: failure()` y no tiene que tapar el rojo
 * verdadero con uno propio.
 */
import fs from 'node:fs';

const TOPE_ANOTACIONES = 20;
const TOPE_CHARS = 900;
const CUPO_POR_GRUPO = 6;
const ANSI = /\[[0-9;]*[A-Za-z]/g;

/**
 * RUIDO: lineas que NOMBRAN un error sin ser el error. En la primera corrida real el script
 * saco 10 anotaciones y 8 eran esto: `[2026-09-13T03:07:49.244Z] [WARN] [adminRepository]
 * is_admin RPC failed { error: 'TypeError: fetch failed' }` -- un console.warn de otro test,
 * con un fetch que ese test maneja, capturado solo porque adentro del JSON dice "TypeError".
 * Un cupo de 20 lleno de eso deja el fallo de verdad AFUERA.
 */
const RUIDO = [
  /^\[\d{4}-\d{2}-\d{2}T/,              // el logger de la app: [ISO] [WARN] [modulo] ...
  /^(?:stdout|stderr)\s*\|/,            // los bloques de consola que vitest re-imprime
  /^error:\s*['"]/,                     // el `error: 'TypeError: ...'` suelto de un objeto
  /^\s*at\s/,                           // stack: dice donde, no que
];

/**
 * Los grupos van EN ORDEN DE UTILIDAD y cada uno tiene cupo propio, para que 20 lineas de
 * un grupo no dejen sin lugar al resto: primero que archivo, despues por que, despues
 * cuantos, y al final el detalle.
 */
const GRUPOS = [
  { nombre: 'suite', re: /^FAIL\b/ },
  { nombre: 'motivo', re: /^(?:AssertionError|TypeError|ReferenceError|SyntaxError|RangeError|Error|Caused by)\b[:\s]/ },
  { nombre: 'cuenta', re: /^(?:Tests|Test Files)\s{2}/ },
  { nombre: 'test', re: /^(?:×|✕)\s/ },
  { nombre: 'otro', re: /(?:hook|Test) timed out|Serialized Error|Unhandled (?:Error|Rejection)|Failed Suites/ },
];

/**
 * Los titulos que anuncian un rojo que NO es un assert. La linea del titulo sola no dice
 * nada — lo que importa viene abajo.
 *
 * 21/09/2026: el CI quedo rojo con los 4.333 tests EN VERDE y 281 archivos pasando; lo unico
 * legible sin cuenta de GitHub fueron cuatro anotaciones: "Unhandled Rejection", "Unhandled
 * Errors" y los dos conteos. El cuerpo —que es donde esta la respuesta— se perdio: no empieza
 * con `Error:` ni con `AssertionError`, asi que no caia en ningun grupo, y sus lineas `at ...`
 * las descarta RUIDO. Dos sesiones distintas pasaron una hora adivinando.
 */
const TITULOS_SIN_ASSERT = /Unhandled (?:Error|Rejection)|Failed Suites|Serialized Error/;
const LINEAS_DE_CONTEXTO = 4;

const limpiar = (s) => s.replace(ANSI, '').replace(/\r/g, '').trim();

/** Anotacion de GitHub: una sola linea, y el `%` escapado DESPUES de cortar (cortar */
/*  despues de escapar puede partir un `%25` al medio y dejar un `%2` colgando). */
export const paraAnotacion = (s) => s.slice(0, TOPE_CHARS).replace(/%/g, '%25');

/** Una linea del reporter github-actions: el runner ya la convirtio en anotacion. */
const esDelReporter = (l) => l.startsWith('::');

export function lineasDelRojo(texto, tope = TOPE_ANOTACIONES) {
  const crudas = String(texto ?? '').split(/\n/).map(limpiar).filter(Boolean)
    .filter((l) => !esDelReporter(l));

  // Lo que sigue a un titulo sin assert se guarda ANTES de filtrar el ruido: ahi el `at ...`
  // es justamente el dato (que worker, que archivo), no relleno.
  const contexto = [];
  for (let i = 0; i < crudas.length; i++) {
    if (!TITULOS_SIN_ASSERT.test(crudas[i])) continue;
    for (const l of crudas.slice(i + 1, i + 1 + LINEAS_DE_CONTEXTO)) {
      if (!TITULOS_SIN_ASSERT.test(l) && !/^[⎯─—-]+$/.test(l)) contexto.push(l);
    }
  }

  const lineas = crudas.filter((l) => !RUIDO.some((r) => r.test(l)));

  const porGrupo = new Map([...GRUPOS.map((g) => [g.nombre, []]), ['contexto', contexto]]);
  const vistas = new Set();
  for (const l of lineas) {
    const g = GRUPOS.find((x) => x.re.test(l));
    if (!g || vistas.has(l)) continue;   // vitest repite el FAIL en el resumen
    vistas.add(l);
    porGrupo.get(g.nombre).push(l);
  }

  // `contexto` va con los primeros: sin el, un rojo que no sale de un assert deja el titulo
  // y nada mas. Se deduplica contra lo que ya entro por su grupo.
  const orden = ['suite', 'motivo', 'contexto', 'cuenta', 'test', 'otro'];
  const out = [];
  const meter = (l) => { if (!out.includes(l) && out.length < tope) out.push(l); };
  for (const n of orden) for (const l of (porGrupo.get(n) ?? []).slice(0, CUPO_POR_GRUPO)) meter(l);
  for (const n of orden) for (const l of (porGrupo.get(n) ?? []).slice(CUPO_POR_GRUPO)) meter(l);

  // Un log que no matchea ningun grupo NO puede quedar sin anotacion: ahi es justamente
  // cuando no tengo idea de que paso. Van las ultimas lineas, que es lo que se mira a mano.
  if (!out.length) out.push(...lineas.slice(-10));
  return out.slice(0, tope);
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

if (process.argv[1]?.endsWith('_anotarVitest.mjs')) main();
