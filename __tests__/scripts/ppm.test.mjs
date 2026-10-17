/**
 * ppm.test.mjs — PPM del asistente v0 (tanda 9, pieza 10): las dos columnas nuevas de _cuatroNumeros.mjs.
 */
import { reentregasPorCarpeta, hallazgosRespondidos } from '../../scripts/_lib/ppm.mjs';

describe('reentregasPorCarpeta (el metodo del 15 de 54)', () => {
  it('cuenta sesiones con entregas y las que entregaron una carpeta en 3 turnos de Fak o mas', () => {
    const m = new Map([
      ['a', new Map([['x/y/fotos', new Set([1, 2, 3])]])],           // reentrega
      ['b', new Map([['x/y/pdf', new Set([1, 1])], ['x/y/otra', new Set([2])]])],   // dos carpetas, ninguna en 3 turnos
      ['c', new Map()],                                              // sin entregas
    ]);
    expect(reentregasPorCarpeta(m)).toEqual({ conEntregas: 2, conTres: 1 });
  });
  it('tres entregas de la misma carpeta en el MISMO turno no son reentrega', () => {
    expect(reentregasPorCarpeta(new Map([['a', new Map([['k', new Set([4])]])]]))).toEqual({ conEntregas: 1, conTres: 0 });
  });
});

describe('hallazgosRespondidos', () => {
  it('cuenta la respuesta solo en el renglon del hallazgo; leyendas y tablas sueltas no (nunca mas respuestas que hallazgos)', () => {
    const t1 = 'leyenda: **arreglado / rechazado / a propósito / no importa**\n- [Importante] a.mjs:1 — x · respuesta: arreglado\n- [Nit] b.mjs:2 — y · respuesta: ____\n| h | **a propósito** |';
    const t2 = 'informe viejo sin etiquetas: CRITICO, WARNING';
    const r = hallazgosRespondidos([t1, t2]);
    expect(r).toEqual({ informes: 1, emitidos: 2, respondidos: 1, arreglados: 1 });
    expect(r.respondidos).toBeLessThanOrEqual(r.emitidos);
  });
});
