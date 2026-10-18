/**
 * _despachadorPayloads.mjs — la prueba de antes de fundir algo que toque guardianes.mjs o un hook: el despachador de
 * guardianes con los seis pedidos conocidos de `__tests__/scripts/despachadorPayloadsConocidos.jsonl` (cuatro peligrosos
 * que tienen que frenar y dos aflojes pedidos que tienen que pasar). Regla `codigo-madre.md`; tanda 15, 18/10/2026.
 *
 * Corre con un HOME APARTE (y USERPROFILE, que es el que mira node en Windows): dos de los pedidos escriben el listado
 * maestro, y con el HOME real la prueba GASTA el permiso de un solo uso `.apqp-listado-ok` que Fak haya dejado y ademas
 * da un falso «2 0 2 2 0 0» (auditor de la tanda 15, I2).
 *
 *   node scripts/_despachadorPayloads.mjs [--raiz <checkout>]     sale 0 si da 2 2 2 2 0 0; 1 si no
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ESPERADO = [2, 2, 2, 2, 0, 0];

/** Los codigos de salida, uno por pedido. `null` = bash no corrio o se corto por tiempo (no es un 0 ni un 2). */
export function correrPayloads(raiz) {
  const home = mkdtempSync(join(tmpdir(), 'despachador-payloads-'));
  try {
    mkdirSync(join(home, '.claude'), { recursive: true });
    const env = { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_PROJECT_DIR: raiz };
    const lineas = readFileSync(join(raiz, '__tests__', 'scripts', 'despachadorPayloadsConocidos.jsonl'), 'utf8').split(/\r?\n/).filter((l) => l.trim());
    return lineas.map((l) => spawnSync('bash', [join(raiz, '.claude', 'hooks', '_dispatcher.sh')], { input: l, env, encoding: 'utf8', timeout: 60000 }).status);
  } finally {
    rmSync(home, { recursive: true, force: true }); // el HOME de la prueba es de la prueba: no queda nada en %TEMP%
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const i = process.argv.indexOf('--raiz');
  const raiz = resolve(i >= 0 ? process.argv[i + 1] : join(dirname(fileURLToPath(import.meta.url)), '..'));
  const salidas = correrPayloads(raiz);
  const ok = salidas.length === ESPERADO.length && salidas.every((s, k) => s === ESPERADO[k]);
  if (salidas.includes(null)) console.log('ojo: algun pedido no corrio (bash no esta, o se corto por tiempo): eso no es un verde');
  console.log(`despachador de ${raiz}: ${salidas.join(' ')} (esperado ${ESPERADO.join(' ')}) → ${ok ? 'OK' : 'NO SE FUNDE'}`);
  process.exit(ok ? 0 : 1);
}
