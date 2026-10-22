/**
 * Corre el selftest de `scripts/_planControlLimpio.py` desde la suite, para que CI lo ejecute (tanda 12, 17/10/2026).
 *
 * El chequeo mira el plan de control que se entrega como lo miro Fak el 15/10/2026 (LECCIONES 15/10; skill
 * planes-de-control §5, puntos 3 a 6): la D sola y no D/TLD, una marca por celda, y si el plan se rearmo entero,
 * sin amarillo ni notas (y sin TBD si va como definitivo). Desde el 22/10/2026, ademas, una medida no se controla
 * "Visual" y un control visual no se escribe con terminos ambiguos (mail de Agustin Aguayo, Calidad). El selftest arma planes chicos en .xlsx con openpyxl (el
 * CI lo instala) y prueba cada codigo en ROJO y en VERDE. Mismo criterio que arbExcelSelftest.test.mjs: NUNCA skip
 * si falta python.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', '_planControlLimpio.py');

describe('_planControlLimpio.py --selftest (el plan de control limpio de Fak, 15/10/2026)', () => {
  it('cada codigo da ROJO donde debe y VERDE donde no', () => {
    const out = execFileSync('python', [SCRIPT, '--selftest'], {
      encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    expect(out).toContain('selftest planControlLimpio: todo verde');
    expect(out).not.toMatch(/^ {2}MAL/m);
    // los casos que importan, por nombre: si alguien los borra, este test se entera
    expect(out).toMatch(/ok {2}D\/TLD en CLASIF\. +esperado=1/);
    expect(out).toMatch(/ok {2}dos SC en una celda +esperado=1/);
    expect(out).toMatch(/ok {2}amarillo en la tabla, rearmado +esperado=1/);
    expect(out).toMatch(/ok {2}amarillo en la tabla, correccion de pocas celdas +esperado=0/);
    expect(out).toMatch(/ok {2}limpio con banner amarillo de la plantilla, definitivo +esperado=0/);
    expect(out).toMatch(/ok {2}TBD, definitivo +esperado=1/);
    // mail de Agustin Aguayo (Calidad, 22/10/2026) sobre el plan del APB trasero: lo que marco y lo que dejo pasar
    expect(out).toMatch(/ok {2}Aguayo: las 7 filas que dejo en blanco +esperado=0/);
    expect(out).toMatch(/ok {2}Aguayo: cinta 75 mm visual sin tolerancia +esperado=1/);
    expect(out).toMatch(/ok {2}Aguayo: funcionamiento abre y cierra +esperado=1/);
    expect(out).toMatch(/ok {2}cinta medida con regla y tolerancia +esperado=0/);
    // auditoria independiente del 22/10: los arreglos a medias de la cinta frenan y el texto de Calidad solo avisa
    expect(out).toMatch(/ok {2}cinta con tolerancia TBD y control visual +esperado=1/);
    expect(out).toMatch(/ok {2}cinta con muestra patron: una muestra no mide +esperado=1/);
    expect(out).toMatch(/ok {2}cinta con regla pero sin tolerancia +esperado=1/);
    expect(out).toMatch(/ok {2}Aguayo en una correccion de pocas celdas: avisa, no frena +esperado=0/);
    expect(out).toMatch(/ok {2}recepcion: la caracteristica va en PROCESO/);
    expect(out).toMatch(/ok {2}medida no: 100 x 60 según ficha/);
    // ronda 2: la celda amarilla (nuestra) frena tambien en una correccion; el titulo del hilo no es un torque
    expect(out).toMatch(/ok {2}correccion de pocas celdas: la celda amarilla \(nuestra\) frena +esperado=1/);
    expect(out).toMatch(/ok {2}medida no: hilo 30\/3Nm/);
    expect(out).toMatch(/ok {2}tolerancia si: 1,8 mm a 2,5 mm/);
    expect((out.match(/^ {2}ok {2}/gm) || []).length).toBe(64);
  });
});
