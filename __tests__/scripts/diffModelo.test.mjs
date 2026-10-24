/**
 * diff_modelo.py (propuesta 4 / P9 del informe 3D, 24/10/2026): una correccion cambia SOLO lo que se pidio.
 * Con el Python del 3D: el autotest propio separa el agujero que se mueve adentro de la zona (verde) del que se mueve
 * afuera (rojo), y un archivo que no existe sale NO MEDIDO (2), nunca verde. Los casos con piezas estan en el banco 3D
 * (evals/banco3d/ejercicios/23_correccion_lo_demas_no_cambio).
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIFF = join(RAIZ, '.claude', 'skills', 'cad-design', 'scripts', 'diff_modelo.py');
const PY = process.env.BANCO3D_PY || 'C:/Dev/BarackMercosul/.venv-cad/Scripts/python.exe';
const HAY_PY = existsSync(PY);
const correr = (args) => spawnSync(PY, ['-I', DIFF, ...args], {
  encoding: 'utf8', timeout: 300000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
});

describe('diff_modelo.py: archivos', () => {
  it('existe el control y su corrector del banco', () => {
    expect(existsSync(DIFF)).toBe(true);
    expect(existsSync(join(RAIZ, 'evals', 'banco3d', 'correctores', 'lo_demas_no_cambio.py'))).toBe(true);
  });
});

describe.skipIf(!HAY_PY)('diff_modelo.py por subproceso (Python del 3D)', () => {
  it('el autotest separa BIEN de MAL (exit 0)', () => {
    const r = correr(['--autotest']);
    expect(r.status, (r.stdout || '') + (r.stderr || '')).toBe(0);
    expect(r.stdout).toMatch(/AUTOTEST OK/);
  }, 300000);
  it('un archivo que no existe: NO MEDIDO (exit 2), nunca verde', () => {
    const r = correr([join(RAIZ, 'no_existe_a.step'), join(RAIZ, 'no_existe_b.step')]);
    expect(r.status, (r.stdout || '') + (r.stderr || '')).toBe(2);
    expect(r.stdout).toMatch(/NO MEDIDO/);
  }, 300000);
});
