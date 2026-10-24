/**
 * Control de voladizos ANTES de laminar (gate 3a, 23/10/2026): lanza los tests de Python de la skill
 * impresion-3d-bambu (tests/test_voladizos_3mf.py, casos A0-A12) por subproceso, con el Python del sistema.
 *
 * Falla real (22/10/2026, Fak, dos veces en el dia: «nunca usas soportes... siempre lo mismo»): el porta-bulon de la
 * placa probeta salio con voladizos sin soporte; el control existia y nadie lo corrio antes de laminar.
 *
 * - Siempre: la parte rapida (sin medir: fechas, regla de votos, matriz del 3MF, aviso para imprimir_pieza.py).
 * - Con VOLADIZOS_LENTO=1: todo (mide piezas con el Python del 3D y corre laminar_bambu.py con el laminador de
 *   juguete; ~5 min). Nunca abre Bambu Studio ni manda nada a la impresora.
 * Sin `python` en el PATH se saltea.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TESTS = path.join(RAIZ, '.claude', 'skills', 'impresion-3d-bambu', 'tests');
const hayPython = spawnSync('python', ['--version'], { encoding: 'utf8' }).status === 0;
/** El modulo de test importa en ESTE python? (en la CI de Linux faltan APIs de Windows o dependencias: se saltea diciendo por que). */
function importa(modulo) {
  const r = spawnSync('python', ['-c', `import sys; sys.path.insert(0, ${JSON.stringify(TESTS)}); import ${modulo}`],
    { cwd: TESTS, encoding: 'utf8', timeout: 60_000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  if (r.status !== 0) console.log(`[se saltea] ${modulo} no importa en este python: ${(r.stderr || '').trim().split('\n').at(-1)}`);
  return r.status === 0;
}
// la skill de la Bambu es de Windows (sockets de la impresora, procesos aparte, rutas de OneDrive): en la CI de Linux
// se saltea y se dice; en Windows corre de verdad
const esWindows = process.platform === 'win32';
if (!esWindows) console.log('[se saltea] test_voladizos_3mf: la skill impresion-3d-bambu corre solo en Windows (este es ' + process.platform + ')');
const puede = esWindows && hayPython && importa('test_voladizos_3mf');

function unittest(nombres, timeout) {
  const r = spawnSync('python', ['-m', 'unittest', ...nombres], {
    cwd: TESTS, encoding: 'utf8', timeout, env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  return { status: r.status, salida: `${r.stdout || ''}${r.stderr || ''}` };
}

describe('voladizos antes de laminar (tests de Python de la skill)', () => {
  it('existe el test de Python', () => {
    expect(existsSync(path.join(TESTS, 'test_voladizos_3mf.py'))).toBe(true);
  });

  it.skipIf(!puede)('parte rapida: fechas, votos, matriz del 3MF y aviso de imprimir_pieza', () => {
    const r = unittest(['test_voladizos_3mf.A0Puro', 'test_voladizos_3mf.A12ImprimirPieza'], 120_000);
    expect(r.salida).toMatch(/\nOK/);
    expect(r.status, r.salida).toBe(0);
  }, 130_000);

  it.skipIf(!puede || process.env.VOLADIZOS_LENTO !== '1')('todo, con medicion y laminar_bambu.py (VOLADIZOS_LENTO=1)', () => {
    const r = unittest(['test_voladizos_3mf'], 900_000);
    expect(r.status, r.salida.slice(-3000)).toBe(0);
  }, 910_000);
});
