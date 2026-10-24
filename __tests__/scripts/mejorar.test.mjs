// El molde /mejorar (scripts/_mejorar.mjs): los frenos en las dos direcciones. Viernes 23/10/2026, bloque 5.
// Revision Opus del 23/10: los casos nuevos del banco no cuentan como subida, y un scores inventado no vale.
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT = path.resolve('scripts/_mejorar.mjs');
let raiz;
const corre = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, MEJORAR_RAIZ: raiz } });

/** Un scores con la forma de correr.py: `n` mutantes (los primeros `cazados` en rojo) y `bien` piezas BIEN (las primeras `bienVerde` en verde). */
function scores(f, cazados, mutantes, bienVerde = 1, bien = 1, extra = {}) {
  const piezas = {};
  for (let i = 1; i <= mutantes; i++) piezas[`mal_${i}_x.py`] = { esperado: 'rojo', controles: { c: { obtenido: i <= cazados ? 'rojo' : 'verde' } } };
  for (let i = 1; i <= bien; i++) piezas[i === 1 ? 'bien.py' : `bien_${i}.py`] = { esperado: 'verde', controles: { c: { obtenido: i <= bienVerde ? 'verde' : 'rojo' } } };
  const ejercicios = { '01_x': { piezas }, ...extra };
  const todas = Object.values(ejercicios).flatMap((e) => Object.values(e.piezas));
  const resumen = { mutantes: todas.filter((p) => p.esperado === 'rojo').length, cazados: todas.filter((p) => p.esperado === 'rojo' && p.controles.c.obtenido === 'rojo').length,
    bien: todas.filter((p) => p.esperado === 'verde').length, bien_en_verde: todas.filter((p) => p.esperado === 'verde' && p.controles.c.obtenido === 'verde').length };
  fs.writeFileSync(f, JSON.stringify({ resumen, ejercicios }));
  return f;
}
const congeladoEn = (dir, ...a) => { fs.mkdirSync(path.join(dir, 'scores'), { recursive: true }); return scores(path.join(dir, 'scores', 'congelado.json'), ...a); };
const carpetaNueva = () => { corre('--nuevo', 'x'); return fs.readdirSync(raiz).map((d) => path.join(raiz, d)).find((d) => fs.existsSync(path.join(d, 'estado.json'))); };
const hasta5 = (carpeta, congelado) => {
  for (const [n, ev] of [[1, 'fallas'], [2, 'huecos'], [3, 'ya hecho']]) corre('--carpeta', carpeta, '--paso', String(n), '--hecho', '--evidencia', ev);
  corre('--carpeta', carpeta, '--banco', congelado);
  corre('--carpeta', carpeta, '--paso', '4', '--hecho', '--evidencia', 'banco');
  corre('--carpeta', carpeta, '--paso', '5', '--hecho', '--evidencia', 'cambio');
};

beforeEach(() => { raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'mejorar-')); });

describe('_mejorar.mjs: el molde de 7 pasos con freno', () => {
  it('--nuevo crea la carpeta con estado.json (7 pasos sin hacer) y los archivos de los pasos', () => {
    const r = corre('--nuevo', 'el 3D: voladizos sin soporte');
    expect(r.status).toBe(0);
    const carpeta = carpetaNueva();
    const e = JSON.parse(fs.readFileSync(path.join(carpeta, 'estado.json'), 'utf8'));
    expect(e.pasos).toHaveLength(7);
    expect(e.pasos.every((p) => !p.hecho)).toBe(true);
    for (const a of ['01_fallas.md', '03_ya_hecho.md', 'PREGUNTAS_FAK.md']) expect(fs.existsSync(path.join(carpeta, a))).toBe(true);
  });

  it('ROJO: el paso 5 no se marca sin el 3 y el 4; el 4 no se marca sin banco; el banco tiene que ser un scores/congelado.json de correr.py', () => {
    const carpeta = carpetaNueva();
    expect(corre('--carpeta', carpeta, '--paso', '5', '--hecho', '--evidencia', 'gate').status).toBe(3);
    corre('--carpeta', carpeta, '--paso', '3', '--hecho', '--evidencia', 'cadgenbench');
    expect(corre('--carpeta', carpeta, '--paso', '4', '--hecho', '--evidencia', 'banco').status).toBe(3);   // sin --banco
    const otro = path.join(raiz, 'otro.json'); fs.writeFileSync(otro, JSON.stringify({ resumen: { cazados: 99, mutantes: 15 } }));
    expect(corre('--carpeta', carpeta, '--banco', otro).status).toBe(3);                                      // no se llama congelado.json
    const vacio = path.join(raiz, 'scores', 'congelado.json'); fs.mkdirSync(path.dirname(vacio), { recursive: true }); fs.writeFileSync(vacio, '{}');
    expect(corre('--carpeta', carpeta, '--banco', vacio).status).toBe(2);                                     // sin ejercicios ni resumen
    const congelado = congeladoEn(raiz, 14, 15, 7, 7);
    expect(corre('--carpeta', carpeta, '--banco', congelado).status).toBe(0);
    expect(corre('--carpeta', carpeta, '--paso', '4', '--hecho', '--evidencia', '14 de 15').status).toBe(0);
    expect(corre('--carpeta', carpeta, '--paso', '5', '--hecho', '--evidencia', 'gate con test').status).toBe(0);
    expect(corre('--carpeta', carpeta, '--banco', congelado).status).toBe(3);                                 // no se re-ata después del 4
  });

  it('ROJO: el 6 frena si el congelado no sube, si algo que pasaba deja de pasar, si el scores es inventado o si el congelado cambió; VERDE: si sube sobre los congelados', () => {
    const carpeta = carpetaNueva();
    const congelado = congeladoEn(raiz, 14, 15, 7, 7);
    hasta5(carpeta, congelado);
    const igual = scores(path.join(raiz, 'igual.json'), 14, 15, 7, 7);
    const baja = scores(path.join(raiz, 'baja.json'), 15, 15, 6, 7);
    const inventado = path.join(raiz, 'inventado.json'); fs.writeFileSync(inventado, JSON.stringify({ resumen: { cazados: 99, mutantes: 15, bien: 7, bien_en_verde: 7 } }));
    const sube = scores(path.join(raiz, 'sube.json'), 15, 15, 7, 7);
    let r = corre('--carpeta', carpeta, '--paso', '6', '--hecho', '--evidencia', 'medido', '--scores', igual);
    expect(r.status).toBe(3); expect(r.stdout).toMatch(/no sube/);
    r = corre('--carpeta', carpeta, '--paso', '6', '--hecho', '--evidencia', 'medido', '--scores', baja);
    expect(r.status).toBe(3); expect(r.stdout).toMatch(/deja de pasar/);
    r = corre('--carpeta', carpeta, '--paso', '6', '--hecho', '--evidencia', 'medido', '--scores', inventado);
    expect(r.status).toBe(2); expect(r.stderr).toMatch(/no es un scores/);
    expect(corre('--carpeta', carpeta, '--cerrar').status).toBe(3);                                            // sin el 6 no se cierra
    r = corre('--carpeta', carpeta, '--paso', '6', '--hecho', '--evidencia', 'medido', '--scores', sube);
    expect(r.status).toBe(0); expect(r.stdout).toMatch(/cazados 14 → 15/);
    expect(corre('--carpeta', carpeta, '--cerrar').status).toBe(0);
  });

  it('ROJO: un mutante NUEVO que se caza no hace subir el banco (los casos nuevos no cuentan), y un congelado cambiado después del 4 frena', () => {
    const carpeta = carpetaNueva();
    const congelado = congeladoEn(raiz, 14, 15, 7, 7);
    hasta5(carpeta, congelado);
    const conNuevo = scores(path.join(raiz, 'con_nuevo.json'), 14, 15, 7, 7, { '08_nuevo': { piezas: { 'mal_1_t.py': { esperado: 'rojo', controles: { c: { obtenido: 'rojo' } } } } } });
    let r = corre('--carpeta', carpeta, '--paso', '6', '--hecho', '--evidencia', 'medido', '--scores', conNuevo);
    expect(r.status).toBe(3); expect(r.stdout).toMatch(/no sube/); expect(r.stdout).toMatch(/los casos nuevos no cuentan/);
    scores(congelado, 10, 15, 7, 7);                                                                            // alguien pisó el congelado
    r = corre('--carpeta', carpeta, '--paso', '6', '--hecho', '--evidencia', 'medido', '--scores', conNuevo);
    expect(r.status).toBe(3); expect(r.stdout).toMatch(/congelado cambió/);
  });

  it('error de uso (sin --carpeta ni --nuevo) sale con 2, no con 0', () => {
    expect(corre('--estado').status).toBe(2);
  });
});
