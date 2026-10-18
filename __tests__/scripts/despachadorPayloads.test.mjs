/**
 * La prueba de antes de fundir algo que toque los guardianes (codigo-madre.md; tanda 15): el despachador con los seis
 * pedidos conocidos da 2 2 2 2 0 0, corrido con un HOME aparte (con el real gastaria un permiso de un solo uso de Fak).
 * Corre en cada suite: un guardian roto que llegue al push frena aca.
 */
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { correrPayloads, ESPERADO } from '../../scripts/_despachadorPayloads.mjs';

const RAIZ = resolve(fileURLToPath(import.meta.url), '../../..');

describe('despachador de guardianes con los seis pedidos conocidos', () => {
  it('frena los cuatro peligrosos y deja pasar los dos aflojes (2 2 2 2 0 0)', () => {
    expect(correrPayloads(RAIZ)).toEqual(ESPERADO);
  }, 240000);
});
