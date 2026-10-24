// Banco 3D (evals/banco3d): contrato de las tareas, archivos nombrados, corrector de voladizos sin tocar y corrida real.
// La corrida de `correr.py --solo 01_porta_bulon` tardo 184 s el 23/10/2026 (mas de 120 s): corre solo con BANCO3D_LENTO=1.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import YAML from 'yaml';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BANCO = join(RAIZ, 'evals', 'banco3d');
const EJ = join(BANCO, 'ejercicios');
// sha256 de chequeo_voladizos2.py (copia byte a byte del control del 22/10, CARPETA/banco3d-material).
const SHA_VOLADIZOS2 = '08a234e0aa20b2d798b1daca4c9ca275315d38b365b136a079df0edeebd3b09b';
const PY = process.env.BANCO3D_PY || 'C:/Dev/BarackMercosul/.venv-cad/Scripts/python.exe';

const tareas = readdirSync(EJ)
  .filter((d) => existsSync(join(EJ, d, 'tarea.yaml')))
  .map((d) => ({ dir: d, t: YAML.parse(readFileSync(join(EJ, d, 'tarea.yaml'), 'utf8')) }));

const noVacio = (v) => (typeof v === 'string' ? v.trim().length > 0 : v && typeof v === 'object' && Object.keys(v).length > 0);

describe('banco3d: contrato de tarea.yaml', () => {
  it('hay al menos un ejercicio', () => {
    expect(tareas.length).toBeGreaterThan(0);
  });
  for (const { dir, t } of tareas) {
    describe(dir, () => {
      it('tiene los campos del contrato', () => {
        for (const campo of ['id', 'nombre', 'falla_real', 'pedido', 'piezas', 'controles', 'formatos', 'notas']) {
          expect(t, `${dir}: falta ${campo}`).toHaveProperty(campo);
        }
        expect(t.id).toBe(dir);
        expect(noVacio(t.falla_real)).toBe(true);
        expect(noVacio(t.pedido)).toBe(true);
        expect(Array.isArray(t.formatos) && t.formatos.length > 0).toBe(true);
        for (const f of t.formatos) expect(['stl', 'step']).toContain(f);
      });
      it('piezas: una BIEN, mutantes MAL con su falla, y cada archivo existe', () => {
        expect(Array.isArray(t.piezas)).toBe(true);
        const bien = t.piezas.filter((p) => p.archivo === 'bien.py');
        const mal = t.piezas.filter((p) => /^mal_\d+_.+\.py$/.test(p.archivo));
        expect(bien.length).toBe(1);
        expect(mal.length).toBeGreaterThanOrEqual(1);
        expect(bien.length + mal.length).toBe(t.piezas.length);
        for (const p of t.piezas) {
          // sin_respuesta: no hay resultado real que diga si esta bien o mal; se corre, se informa y no cuenta.
          expect(['verde', 'rojo', 'sin_respuesta']).toContain(p.esperado);
          expect(existsSync(join(EJ, dir, p.archivo)), `${dir}/${p.archivo} no existe`).toBe(true);
          if (p.esperado === 'rojo') expect(noVacio(p.falla), `${dir}/${p.archivo} sin falla`).toBe(true);
          if (p.esperado === 'sin_respuesta') expect(noVacio(p.nota), `${dir}/${p.archivo} sin nota`).toBe(true);
          if (p.archivo.startsWith('mal_')) expect(p.esperado, `${dir}/${p.archivo}`).not.toBe('verde');
        }
        expect(bien[0].esperado).toBe('verde');
        expect(mal.filter((p) => p.esperado === 'rojo').length, `${dir}: ningun mutante cuenta`).toBeGreaterThanOrEqual(1);
      });
      it('controles: nombre y, si dice que existe, el corrector esta en correctores/', () => {
        expect(Array.isArray(t.controles) && t.controles.length > 0).toBe(true);
        for (const c of t.controles) {
          const nombre = typeof c === 'string' ? c : c.nombre;
          expect(noVacio(nombre)).toBe(true);
          const existe = typeof c === 'string' ? true : c.existe !== false;
          if (existe) expect(existsSync(join(BANCO, 'correctores', `${nombre}.py`)), `falta correctores/${nombre}.py`).toBe(true);
        }
      });
    });
  }
});

describe('banco3d: corrector de voladizos', () => {
  it('chequeo_voladizos2.py es la copia byte a byte del 22/10', () => {
    const sha = createHash('sha256').update(readFileSync(join(BANCO, 'correctores', 'chequeo_voladizos2.py'))).digest('hex');
    expect(sha).toBe(SHA_VOLADIZOS2);
  });
  it('estan el envoltorio voladizos.py y correr.py', () => {
    expect(existsSync(join(BANCO, 'correctores', 'voladizos.py'))).toBe(true);
    expect(existsSync(join(BANCO, 'correr.py'))).toBe(true);
  });
});

describe('banco3d: corrida real (lenta, BANCO3D_LENTO=1)', () => {
  it.skipIf(process.env.BANCO3D_LENTO !== '1')(
    'correr.py --solo 01_porta_bulon termina y escribe un scores',
    () => {
      const antes = Date.now();
      const r = spawnSync(PY, ['-I', join(BANCO, 'correr.py'), '--solo', '01_porta_bulon'], { encoding: 'utf8', timeout: 900000 });
      expect(r.status, r.stderr).toBe(0);
      expect(r.stdout).toMatch(/BANCO 3D: caza \d+ de \d+ mutantes/);
      const scores = readdirSync(join(BANCO, 'scores'))
        .filter((f) => /^\d{4}-\d{2}-\d{2}_\d{4,6}\.json$/.test(f))
        .map((f) => join(BANCO, 'scores', f))
        .filter((f) => statSync(f).mtimeMs >= antes - 1000);
      expect(scores.length).toBeGreaterThan(0);
      const datos = JSON.parse(readFileSync(scores[0], 'utf8'));
      expect(datos.ejercicios).toHaveProperty('01_porta_bulon');
      expect(existsSync(join(BANCO, 'scores', 'run_meta.json'))).toBe(true);
    },
    900000,
  );
});

// 5d (24/10/2026): un ejercicio con respuesta conocida (el examen de muestra CATIA V5 Associate, ejercicio 13) declara las
// masas tres veces: en `preguntas`, en `masas_esperadas_g` de la BIEN y en el `--esperado` del corrector masa_esperada.
// Si una se corrige y las otras no, el banco mide contra un numero y el yaml documenta otro. Lo pidieron el constructor
// y el revisor del 5d: los tres lugares dicen lo mismo, con los mismos nombres (q3..q6).
describe('banco3d: ejercicios con respuesta conocida (masas declaradas tres veces)', () => {
  const conPreguntas = tareas.filter(({ t }) => t.preguntas && typeof t.preguntas === 'object');
  it('hay al menos uno (el 13, examen CATIA Associate)', () => {
    expect(conPreguntas.map((x) => x.dir)).toContain('13_examen_catia_associate');
  });
  for (const { dir, t } of conPreguntas) {
    it(`${dir}: preguntas, masas_esperadas_g de la BIEN y --esperado del corrector coinciden nombre por nombre`, () => {
      const dePreguntas = Object.fromEntries(Object.entries(t.preguntas).map(([q, p]) => [q, Number(p.masa_esperada_g)]));
      const bien = (t.piezas || []).find((p) => p.esperado === 'verde');
      expect(bien, 'la BIEN').toBeTruthy();
      const deBien = Object.fromEntries(Object.entries(bien.masas_esperadas_g || {}).map(([q, m]) => [q, Number(m)]));
      const control = (t.controles || []).find((c) => c.nombre === 'masa_esperada');
      expect(control, 'el control masa_esperada').toBeTruthy();
      const i = control.opciones.indexOf('--esperado');
      expect(i, '--esperado en las opciones').toBeGreaterThanOrEqual(0);
      const deControl = Object.fromEntries(control.opciones[i + 1].split(',').map((par) => {
        const [q, m] = par.split('=');
        return [q.trim(), Number(m)];
      }));
      expect(Object.keys(dePreguntas).sort()).toEqual(['q3', 'q4', 'q5', 'q6']);
      expect(deBien).toEqual(dePreguntas);
      expect(deControl).toEqual(dePreguntas);
      for (const m of Object.values(dePreguntas)) expect(Number.isFinite(m) && m > 0, `masa ${m}`).toBe(true);
    });
  }
});
