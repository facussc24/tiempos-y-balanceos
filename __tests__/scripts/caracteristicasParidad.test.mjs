/**
 * H43 (cola, 24/10/2026): paridad entre las dos copias del criterio de caracteristicas especiales, la de la app
 * (modules/amfe/specialChars.ts) y la de los scripts (scripts/_lib/amfeValidator.mjs). Las dos leen la misma fuente
 * (core/amfe/caracteristicasEspeciales.data.json), pero cada test probaba solo su copia: si una se desvia de la otra, la
 * app y el validador dirian cosas distintas de la misma causa. Regla: caracteristicas-especiales.md (CC = S 9-10;
 * SC = S 5-8 y O >= 4). Se prueba la grilla entera S 1-10 x O 1-10 mas los bordes raros (0, vacio, texto, decimales).
 */
import { describe, it, expect } from 'vitest';
import { nivelPorCriterio as nivelApp, esSinMarca as sinMarcaApp } from '../../modules/amfe/specialChars';
import { nivelPorCriterio as nivelScript, esSinMarca as sinMarcaScript } from '../../scripts/_lib/amfeValidator.mjs';

describe('H43 · nivelPorCriterio: la app y el validador dan lo mismo en toda la grilla S x O', () => {
  it('S 1-10 x O 1-10: 100 celdas iguales, y el criterio de la regla se cumple', () => {
    for (let s = 1; s <= 10; s++) {
      for (let o = 1; o <= 10; o++) {
        const a = nivelApp(s, o);
        const b = nivelScript(s, o);
        expect(b, `S=${s} O=${o}`).toBe(a);
        const esperado = s >= 9 ? 'CRITICA' : (s >= 5 && s <= 8 && o >= 4) ? 'SIGNIFICATIVA' : null;
        expect(a, `S=${s} O=${o} contra la regla`).toBe(esperado);
      }
    }
  });
  it('bordes: 0, vacio, texto, decimales y numeros como texto dan lo mismo en las dos copias', () => {
    const casos = [[0, 5], [null, 4], [undefined, undefined], ['', ''], ['9', '1'], ['8', '4'], ['8', '3'], [8.5, 4], [4.99, 10], ['abc', 4], [9, 'x'], [-1, 4], [11, 1]];
    for (const [s, o] of casos) expect(nivelScript(s, o), `S=${s} O=${o}`).toBe(nivelApp(s, o));
  });
});

describe('H43 · esSinMarca: la app y el validador leen igual una celda sin caracteristica', () => {
  it('"-", "—", "N/A", vacio y espacios son sin marca en las dos; una sigla real no', () => {
    for (const v of ['-', '—', 'N/A', 'n/a', '', '   ', null, undefined, 'CC', 'SC', 'D/TLD', 'W', 'x']) {
      expect(sinMarcaScript(v), JSON.stringify(v)).toBe(sinMarcaApp(v));
    }
    expect(sinMarcaApp('-')).toBe(true);
    expect(sinMarcaApp('CC')).toBe(false);
  });
});
