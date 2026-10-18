/**
 * El canon de firma (`scripts/_lib/firmaIA.data.json`) lo compila Python (`firmaIA.py`) y lo leen tambien programas en
 * JavaScript (`flujogramaCanon.mjs`). Todo patron tiene que compilar en JS con las mismas banderas, salvo los marcados
 * `solo_python` (el rango de emojis del aviso humanizer-titulo-emoji no compila en JS sin la bandera u). Tanda 15,
 * revision por API del 18/10: el primer lector JS que compilara el canon entero se caia.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(import.meta.url), '../../..');
const CANON = JSON.parse(readFileSync(join(RAIZ, 'scripts/_lib/firmaIA.data.json'), 'utf8'));

describe('canon de firma: los patrones compilan en JavaScript', () => {
  for (const nivel of ['bloqueante', 'aviso']) {
    for (const p of CANON[nivel]) {
      it(`${nivel} ${p.id}${p.solo_python ? ' (solo Python: se salta)' : ''}`, () => {
        if (p.solo_python) return;
        // Python acepta (?<!...) y \b igual que JS; la bandera i es la de Python cuando no distingue mayusculas
        expect(() => new RegExp(p.re, p.distingue_mayusculas ? '' : 'i')).not.toThrow();
      });
    }
  }
  it('lo marcado solo_python de verdad no compila en JS (si compila, sobra la marca)', () => {
    for (const p of CANON.aviso.filter((x) => x.solo_python)) expect(() => new RegExp(p.re, 'i')).toThrow();
  });
});
