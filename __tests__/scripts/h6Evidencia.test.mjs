// __tests__/scripts/h6Evidencia.test.mjs
import { describe, it, expect } from 'vitest';
import { diferencias } from '../../scripts/_h6Evidencia.mjs';

const TURNO = '2026-10-10T12:00:00.000Z';
const t0 = Date.parse(TURNO);
const nueva = { txt: 'exports/x/ho-1.pdf', ts: t0 + 1000, esRead: true };
const vieja = { txt: 'c:/viejo/v.pdf', ts: t0 - 600000, esRead: true };
const base = () => ({ tocados: new Set(['a.mjs']), turnoTs: TURNO, ventanas: [[2, 3], [1, Infinity]], miradas: [nueva, vieja], sistema: { archivos: ['b', 'a'], probada: true } });
const nuevo = () => ({ tocados: new Set(['a.mjs']), turnoTs: TURNO, ventanas: [[1, Infinity], [2, 3]], miradas: [nueva], sistema: { archivos: ['a', 'b'], probada: true } });

describe('diferencias (evidencia de H6)', () => {
  it('verde: orden y miradas viejas de subagente son de H6, no inesperadas', () => {
    const d = diferencias(base(), nuevo());
    expect(d.campos).toMatchObject({ ventanas: 'orden', 'sistema.archivos': 'orden' });
    expect(d.miradas).toEqual({ recuperadas: 0, descartadas: 1, inesperadas: 0 });
    expect(d.inesperado).toEqual([]);
  });
  it('verde: una mirada del turno que antes faltaba es "recuperada", no inesperada', () => {
    const b = base(); b.miradas = [vieja];
    const d = diferencias(b, nuevo());
    expect(d.miradas.recuperadas).toBe(1);
    expect(d.inesperado).toEqual([]);
  });
  it('rojo: un tocado de más es INESPERADO', () => {
    const nv = nuevo(); nv.tocados.add('b.mjs');
    expect(diferencias(base(), nv).inesperado).toContain('tocados');
  });
  it('rojo: perder una mirada del turno es INESPERADO', () => {
    const nv = nuevo(); nv.miradas = [];
    expect(diferencias(base(), nv).inesperado).toContain('miradas');
  });
});
