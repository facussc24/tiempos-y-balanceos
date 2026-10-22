/**
 * Corre el selftest de `scripts/_planControlLimpio.py` desde la suite, para que CI lo ejecute (tanda 12, 17/10/2026).
 *
 * El chequeo mira el plan de control que se entrega como lo miro Fak el 15/10/2026 (LECCIONES 15/10; skill
 * planes-de-control §5, puntos 3 a 6): la D sola y no D/TLD, una marca por celda, y si el plan se rearmo entero,
 * sin amarillo ni notas (y sin TBD si va como definitivo), y nunca un CONFLICTO (22/10/2026). El selftest arma planes chicos en .xlsx con openpyxl (el
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
    // Fak 22/10/2026: un "CONFLICTO: 45 / 35" no sale en ningun plan, tampoco en la version de trabajo (skill §5 punto 8 ter)
    expect(out).toMatch(/ok {2}CONFLICTO, correccion +esperado=1/);
    expect(out).toMatch(/ok {2}CONFLICTO, rearmado \(version de trabajo\) +esperado=1/);
    // Fak 22/10/2026: "lo define Calidad no va... simplemente TBD" (skill §3.6)
    expect(out).toMatch(/ok {2}TBD que dice quien lo define, rearmado +esperado=1/);
    expect(out).toMatch(/ok {2}TBD pelado y TBD con una nota, rearmado +esperado=0/);
    expect(out).toMatch(/ok {2}nota con CONFLICTO, correccion +esperado=1/);
    expect((out.match(/^ {2}ok {2}/gm) || []).length).toBe(17);
  });
});
