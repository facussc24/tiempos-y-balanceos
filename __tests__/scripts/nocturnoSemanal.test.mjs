// @vitest-environment node
/**
 * El envoltorio de los pasos semanales de la noche (`semanal()` de scripts/_nocturno.mjs, cola H15).
 *
 * Lo que encontro la auditoria del 09/10/2026: la semana se daba por hecha con solo ver el archivo de salida, y los
 * programas lo escriben tambien cuando todo fallo (sin red, 529): la semana se perdia. Ahora la noche lleva su propio
 * registro y lo anota SOLO cuando el paso salio completo. Se prueba en las dos direcciones con un registro en una
 * carpeta temporal (BARACK_API_DIR la habilita en escrituraSegura): completa -> se anota y la noche siguiente no toca;
 * incompleta o con error -> no se anota y la noche siguiente vuelve a correr.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { semanal } from '../../scripts/_nocturno.mjs';

let dir;
let previo;
let ruta;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturno-semanal-'));
  previo = process.env.BARACK_API_DIR;
  process.env.BARACK_API_DIR = dir;
  ruta = path.join(dir, 'nocturno-semanal.json');
});
afterEach(() => {
  if (previo === undefined) delete process.env.BARACK_API_DIR; else process.env.BARACK_API_DIR = previo;
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
});

const dia = (d) => new Date(2026, 9, d, 6, 30);
const leer = () => { try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { return null; } };

describe('nocturno · semanal() del runner', () => {
  it('VERDE: una corrida completa se anota, y la noche siguiente queda "no toca"', async () => {
    let corridas = 0;
    const paso = (d) => semanal('propuestas', { solo: null, ahora: dia(d), simular: false, ruta }, async () => { corridas += 1; return { detalle: '4 para verificar de 20 revisados', completa: true }; });
    const r1 = await paso(9)();
    expect(r1.detalle).toBe('4 para verificar de 20 revisados');
    expect(leer()).toEqual({ propuestas: '2026-10-09' });
    const r2 = await paso(10)();
    expect(r2).toMatchObject({ saltado: true, detalle: expect.stringMatching(/no toca: la última completa fue hace 1 día \(2026-10-09\)/) });
    expect(corridas).toBe(1);
    // a los 7 dias vuelve a tocar
    await paso(16)();
    expect(corridas).toBe(2);
    expect(leer()).toEqual({ propuestas: '2026-10-16' });
  });

  it('ROJO (el caso de la auditoria): una corrida incompleta NO se anota y la noche siguiente se reintenta', async () => {
    let corridas = 0;
    const paso = (d) => semanal('propuestas', { solo: null, ahora: dia(d), simular: false, ruta }, async () => { corridas += 1; return { detalle: '0 para verificar de 0 revisados · 3 con error', completa: false }; });
    const r = await paso(9)();
    expect(r.detalle).toMatch(/incompleta: se reintenta la próxima noche$/);
    expect(leer()).toBeNull();
    await paso(10)();
    expect(corridas).toBe(2);
  });

  it('ROJO: un paso que tira no anota nada (el error sube a correrPasos)', async () => {
    const paso = semanal('vigilante', { solo: null, ahora: dia(9), simular: false, ruta }, async () => { throw new Error('no se pudo leer la página de precios'); });
    await expect(paso()).rejects.toThrow(/precios/);
    expect(leer()).toBeNull();
  });

  it('simulando no escribe el registro aunque salga completa; --solo fuerza un paso que no tocaba', async () => {
    await semanal('disparo', { solo: null, ahora: dia(9), simular: true, ruta }, async () => ({ detalle: 'x', completa: true }))();
    expect(leer()).toBeNull();
    fs.writeFileSync(ruta, JSON.stringify({ disparo: '2026-10-09' }));
    let corrio = false;
    await semanal('disparo', { solo: 'disparo', ahora: dia(10), simular: false, ruta }, async () => { corrio = true; return { detalle: 'x', completa: true }; })();
    expect(corrio).toBe(true);
    expect(leer()).toEqual({ disparo: '2026-10-10' });
  });
});
