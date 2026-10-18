/**
 * numeracionAmfe — las tres funciones que leen los numeros de operacion de un AMFE, sacadas tal cual de
 * _verificarNumeracion.mjs el 18/10/2026 (las usa tambien la ficha por pieza). Antes no tenian test propio.
 */
import { describe, it, expect } from 'vitest';
import { numerosDe, expandirRango, cubiertosPorNombre } from '../../scripts/_lib/numeracionAmfe.mjs';

describe('numeracionAmfe', () => {
  it('un rango del numero («70-71») cubre los dos; basura o un rango al reves no inventa nada', () => {
    expect(expandirRango('70-71')).toEqual(['70', '71']);
    expect(expandirRango('103-2')).toEqual(['103-2']);
    expect(expandirRango('10')).toEqual(['10']);
  });
  it('el nombre que declara lo que agrupa («OP 20-27 CORTE») cubre esas operaciones', () => {
    expect(cubiertosPorNombre('OP 20-23 CORTE DE VINILO')).toEqual(['20', '21', '22', '23']);
    expect(cubiertosPorNombre('OP 30 / 32-34 COSTURA UNION')).toEqual(['30', '32', '33', '34']);
    expect(cubiertosPorNombre('COSTURA EN MAQUINA CNC')).toEqual([]);
  });
  it('numerosDe junta numero, alias y rangos sin repetir', () => {
    const doc = { operations: [{ opNumber: '10', name: 'RECEPCION' }, { operationNumber: '70-71', name: 'INYECCION' }, { opNumber: '20', name: 'OP 20-21 CORTE' }] };
    expect(numerosDe(doc)).toEqual(['10', '70', '71', '20', '21']);
  });
});
