/**
 * correccionD7.test.mjs — D7 (tanda 9, pieza 8): ¿la leccion sirvio? `reapariciones()` cuenta por categoria de
 * correccion los mensajes de Fak antes y despues de una fecha, por semana. Mensajes reales de CASOS (correccionGuard).
 */
import { reapariciones, CASOS } from '../../scripts/_lib/correccionGuard.mjs';

const fila = (t, ts) => ({ ses: 's', t, ts });

describe('reapariciones', () => {
  it('una correccion que sigue apareciendo despues de la fecha se cuenta en los dos lados (la leccion no sirvio)', () => {
    const filas = [
      fila(CASOS.rojos[0], '2026-09-20T10:00:00Z'), fila(CASOS.rojos[0], '2026-09-27T10:00:00Z'),
      fila(CASOS.rojos[0], '2026-10-05T10:00:00Z'), fila(CASOS.rojos[0], '2026-10-12T10:00:00Z'),
    ];
    const r = reapariciones(filas, '2026-10-02');
    expect(r.mensajes).toEqual({ antes: 2, despues: 2 });
    const c = r.categorias.find((x) => x.categoria === 'no_entendiste');
    expect(c).toMatchObject({ antes: 2, despues: 2 });
    expect(c.porSemanaDespues).toBeGreaterThanOrEqual(c.porSemanaAntes);
  });
  it('una correccion que desaparece despues de la fecha da 0 despues; los mensajes verdes y las filas sin fecha no cuentan', () => {
    const filas = [
      fila(CASOS.rojos[4], '2026-09-20T10:00:00Z'),
      fila(CASOS.verdes[5], '2026-10-05T10:00:00Z'),
      { ses: 's', t: CASOS.rojos[4] },
    ];
    const r = reapariciones(filas, '2026-10-02');
    expect(r.mensajes).toEqual({ antes: 1, despues: 1 });
    expect(r.categorias.every((x) => x.despues === 0)).toBe(true);
    expect(r.categorias.some((x) => x.antes === 1)).toBe(true);
  });
});
