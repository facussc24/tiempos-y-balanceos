/**
 * Obrero de CATIA (scripts/catia/obrero.py): la prueba en seco de Python (unittest) dentro de la suite.
 * Corre el obrero de verdad con una COLA 3D temporal: asignado bueno, de otra PC, roto, ejercicio que no existe,
 * poca RAM, CATIA que no arranca (3 intentos) y uno que se pasa del tiempo. No abre CATIA ni necesita pywin32.
 * Se saltea si en esta maquina no esta el Python de .venv-cad.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TESTS = path.join(RAIZ, 'scripts', 'catia', 'tests');
const CANDIDATOS = [
  path.join(RAIZ, '.venv-cad', 'Scripts', 'python.exe'),
  'C:/Dev/BarackMercosul/.venv-cad/Scripts/python.exe',
];
const PY = CANDIDATOS.find((p) => fs.existsSync(p));

describe('obrero de CATIA (prueba en seco)', () => {
  it.skipIf(!PY)('el unittest del obrero pasa entero', () => {
    const r = spawnSync(PY, ['-I', '-m', 'unittest', 'discover', '-s', TESTS], {
      encoding: 'utf-8', timeout: 170_000, env: { ...process.env, PYTHONUTF8: '1' },
    });
    const salida = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
    expect(r.error, salida).toBeUndefined();
    expect(r.status, salida).toBe(0);
    expect(salida).toMatch(/Ran \d+ tests/);
    expect(salida).toMatch(/\nOK/);
  }, 180_000);
});
