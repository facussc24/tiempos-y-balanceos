/**
 * hookComun.mjs — lo que comparten los hooks fusionados (promptHooks.mjs, stopHooks.mjs; cola P10, plan
 * docs/PLAN_P9_P10_HOOKS_INCREMENTAL_2026-10-10.md §2): leer el pedido UNA vez, cargar las piezas por nombre y
 * saber si el archivo corre como programa o fue importado. Test: __tests__/scripts/promptHooks.test.mjs.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ¿`url` (el import.meta.url de un modulo) es el archivo que node arranco? Asi el `--hook` de una pieza no dispara
 * cuando otro modulo la importa. En Windows la letra de unidad llega en distinta caja segun quien armo la ruta (bash
 * de Git, la app) y, si el bash de Git no la convirtio, como /c/Dev/... (el arreglo que ya tenia el .sh inline del 11/09).
 */
export function esPrograma(url, argv1 = process.argv[1]) {
  try {
    let a = String(argv1 || '');
    if (!a) return false;
    if (process.platform === 'win32') a = a.replace(/^\/([a-zA-Z])\//, (m, d) => `${d.toUpperCase()}:/`);
    a = path.resolve(a);
    const b = fileURLToPath(url);
    return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
  } catch { return false; }
}

/** Todo stdin como texto. setEncoding: un tramo cortado a mitad de una tilde no se rompe (con `s += buffer` si). */
export function leerStdin(stream = process.stdin) {
  return new Promise((resolve) => {
    let s = '';
    stream.setEncoding('utf8');
    stream.on('data', (d) => { s += d; });
    stream.on('end', () => resolve(s));
    stream.on('error', () => resolve(s));
  });
}

/** El JSON del hook; si no parsea, el texto entero es el prompt (lo que ya hacia caracteristicas-especiales-prompt.sh). */
export function parsearPayload(s) {
  try { const p = JSON.parse(s); if (p && typeof p === 'object') return p; } catch { /* no era JSON */ }
  return { prompt: String(s ?? '') };
}

/**
 * Carga las piezas de una tabla [{nombre, modulo, exportacion}] y devuelve [{nombre, fn}] con las que cargaron.
 * Una que no carga (archivo roto, export que no esta) queda APAGADA con aviso y el hook sigue con las demas: es lo que
 * pasaba cuando cada una era un proceso y uno fallaba. Que TODAS las reales carguen lo exigen los *.gate.test.mjs.
 */
export async function cargarPiezas(tabla, { importar = (m) => import(new URL(m, import.meta.url).href), avisar = (m) => process.stderr.write(m), marca = '[HOOKS]' } = {}) {
  const piezas = [];
  for (const p of tabla) {
    try {
      const fn = (await importar(p.modulo))?.[p.exportacion];
      if (typeof fn !== 'function') throw new Error(`no exporta ${p.exportacion}`);
      piezas.push({ nombre: p.nombre, fn });
    } catch (e) { avisar(`${marca} pieza ${p.nombre} apagada: ${String(e?.message || e).slice(0, 120)}\n`); }
  }
  return piezas;
}
