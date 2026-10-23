// El molde /mejorar (scripts/_mejorar.mjs): los frenos en las dos direcciones. Viernes 23/10/2026, bloque 5.
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT = path.resolve('scripts/_mejorar.mjs');
let raiz;
const corre = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, MEJORAR_RAIZ: raiz } });
const scores = (f, cazados, mutantes, bienVerde = 7, bien = 7) => { fs.writeFileSync(f, JSON.stringify({ resumen: { cazados, mutantes, bien_en_verde: bienVerde, bien } })); return f; };

beforeEach(() => { raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'mejorar-')); });

describe('_mejorar.mjs: el molde de 7 pasos con freno', () => {
  it('--nuevo crea la carpeta con estado.json (7 pasos sin hacer) y los archivos de los pasos', () => {
    const r = corre('--nuevo', 'el 3D: voladizos sin soporte');
    expect(r.status).toBe(0);
    const carpeta = fs.readdirSync(raiz).map((d) => path.join(raiz, d))[0];
    const e = JSON.parse(fs.readFileSync(path.join(carpeta, 'estado.json'), 'utf8'));
    expect(e.pasos).toHaveLength(7);
    expect(e.pasos.every((p) => !p.hecho)).toBe(true);
    for (const a of ['01_fallas.md', '03_ya_hecho.md', 'PREGUNTAS_FAK.md']) expect(fs.existsSync(path.join(carpeta, a))).toBe(true);
  });

  it('ROJO: el paso 5 (cambio) no se marca sin el 3 y el 4; VERDE: con los dos, pasa', () => {
    corre('--nuevo', 'x');
    const carpeta = fs.readdirSync(raiz).map((d) => path.join(raiz, d))[0];
    const r5 = corre('--carpeta', carpeta, '--paso', '5', '--hecho', '--evidencia', 'gate con test');
    expect(r5.status).toBe(3);
    expect(r5.stdout).toMatch(/FRENO.*paso 5/);
    corre('--carpeta', carpeta, '--paso', '3', '--hecho', '--evidencia', 'cadgenbench, SynthCAD');
    const congelado = scores(path.join(raiz, 'congelado.json'), 14, 15);
    const r4sin = corre('--carpeta', carpeta, '--paso', '4', '--hecho', '--evidencia', 'banco');
    expect(r4sin.status).toBe(3);                       // sin --banco atado, el 4 no se marca
    corre('--carpeta', carpeta, '--banco', congelado);
    expect(corre('--carpeta', carpeta, '--paso', '4', '--hecho', '--evidencia', '14 de 15').status).toBe(0);
    expect(corre('--carpeta', carpeta, '--paso', '5', '--hecho', '--evidencia', 'gate con test').status).toBe(0);
  });

  it('ROJO: el paso 6 frena si el banco no sube o si algo que pasaba deja de pasar; VERDE: si sube sin regresión', () => {
    corre('--nuevo', 'x');
    const carpeta = fs.readdirSync(raiz).map((d) => path.join(raiz, d))[0];
    const congelado = scores(path.join(raiz, 'congelado.json'), 14, 15);
    corre('--carpeta', carpeta, '--banco', congelado);
    for (const [n, ev] of [[1, 'fallas'], [2, 'huecos'], [3, 'a'], [4, 'b'], [5, 'c']]) corre('--carpeta', carpeta, '--paso', String(n), '--hecho', '--evidencia', ev);
    const igual = scores(path.join(raiz, 'igual.json'), 14, 15);
    const baja = scores(path.join(raiz, 'baja.json'), 15, 15, 6);       // caza más pero un BIEN pasó a rojo
    const sube = scores(path.join(raiz, 'sube.json'), 15, 15);
    const rIgual = corre('--carpeta', carpeta, '--paso', '6', '--hecho', '--evidencia', 'medido', '--scores', igual);
    expect(rIgual.status).toBe(3); expect(rIgual.stdout).toMatch(/no sube/);
    const rBaja = corre('--carpeta', carpeta, '--paso', '6', '--hecho', '--evidencia', 'medido', '--scores', baja);
    expect(rBaja.status).toBe(3); expect(rBaja.stdout).toMatch(/deja de pasar/);
    expect(corre('--carpeta', carpeta, '--cerrar').status).toBe(3);      // sin el 6 no se cierra
    const rSube = corre('--carpeta', carpeta, '--paso', '6', '--hecho', '--evidencia', 'medido', '--scores', sube);
    expect(rSube.status).toBe(0); expect(rSube.stdout).toMatch(/15\/15/);
    expect(corre('--carpeta', carpeta, '--cerrar').status).toBe(0);
  });

  it('error de uso (sin --carpeta ni --nuevo) sale con 2, no con 0', () => {
    expect(corre('--estado').status).toBe(2);
  });
});
