/**
 * Gate 3b (23/10/2026): `bambu_red.py --imprimir --apply` lanza sola la vigilancia con `--detector`. Lanza los tests de
 * Python de la skill impresion-3d-bambu (tests/test_detector_por_defecto.py, casos B1-B9 de casos_gates_3a_3b.md) por
 * subproceso, con el Python del sistema.
 *
 * Falla real (20/10/2026 18:36, Fak: «olvido tuyo? imperdonable... evitar que suceda en el futuro»): la vigilancia de
 * la Bambu se lanzo sin --detector; --imprimir solo imprimia el comando y --seguir lo dejaba apagado por defecto.
 *
 * Todo en seco: la impresora de juguete y un lanzador que anota; nunca habla con la impresora real. ~2 min.
 * Sin `python` en el PATH se saltea.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKILL = path.join(RAIZ, '.claude', 'skills', 'impresion-3d-bambu');
const TESTS = path.join(SKILL, 'tests');
const hayPython = spawnSync('python', ['--version'], { encoding: 'utf8' }).status === 0;

describe('la vigilancia de la Bambu va con el detector por defecto (gate 3b)', () => {
  it('existen el test de Python y el canon con la decision de noche', () => {
    expect(existsSync(path.join(TESTS, 'test_detector_por_defecto.py'))).toBe(true);
    const canon = JSON.parse(readFileSync(path.join(SKILL, 'scripts', 'detectorCanon.data.json'), 'utf8'));
    expect(canon.por_defecto).toBe('detector');
    expect(canon.de_noche).toBe('solo-medir');
    expect(canon.revisar).toBe('2026-10-30');
  });

  it.skipIf(!hayPython)('casos B1-B9 contra la impresora de juguete', () => {
    const r = spawnSync('python', ['-m', 'unittest', 'test_detector_por_defecto'], {
      cwd: TESTS, encoding: 'utf8', timeout: 400_000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    const salida = `${r.stdout || ''}${r.stderr || ''}`;
    expect(salida).toMatch(/\nOK/);
    expect(r.status, salida.slice(-3000)).toBe(0);
  }, 410_000);
});
