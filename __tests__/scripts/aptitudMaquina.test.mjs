/**
 * Tests de `scripts/_lib/aptitudMaquina.mjs` y `scripts/_aptitudMaquina.mjs` — la cuenta del control estadistico
 * preliminar (I-AC-021) que pedia la tanda 13, item 2.
 *
 * Caso de respuesta conocida (memoria `project_estudio_agujero_insert_patagonia`, 28/07/2026): distancia al borde
 * 12,04 · 13,10 · 13,10 · 13,72 -> 12,99 / 1,68 / 0,70, y «muestra insuficiente». Lo que distingue el caso es el desvio:
 * el muestral (n-1) da 0,70 y el poblacional (n) 0,60. Se prueba en las dos direcciones: con poca muestra NO da limites
 * ni aptitud; con 25 subgrupos estables SI, y un subgrupo corrido lo marca como no estable.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsearValores, resumen, estudio, informe, coma, limitesXR, aptitud, AVISO } from '../../scripts/_lib/aptitudMaquina.mjs';

const RAIZ = resolve(fileURLToPath(import.meta.url), '../../..');
const CLI = resolve(RAIZ, 'scripts/_aptitudMaquina.mjs');
const correr = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: 'utf8' });
const repetir = (grupo, veces) => Array.from({ length: veces }, () => grupo).flat();

describe('aptitud de maquina — el caso conocido del 28/07', () => {
  it('distancia al borde: 12,99 / 1,68 / 0,70 (desvio muestral, no poblacional)', () => {
    const r = resumen(parsearValores('12,04 13,10 13,10 13,72'));
    expect(coma(r.media)).toBe('12,99');
    expect(coma(r.recorrido)).toBe('1,68');
    expect(coma(r.s)).toBe('0,70');
    // el poblacional daria 0,60: si alguien cambia n-1 por n, este test lo ve
    const pobl = Math.sqrt([12.04, 13.1, 13.1, 13.72].reduce((s, x) => s + (x - r.media) ** 2, 0) / 4);
    expect(coma(pobl)).toBe('0,60');
  });

  it('luz de la marca (mismo dia): 3,73 / 0,40 / 0,15', () => {
    const r = resumen(parsearValores('3,57 3,69 3,69 3,71 3,97'));
    expect([coma(r.media), coma(r.recorrido), coma(r.s)]).toEqual(['3,73', '0,40', '0,15']);
  });

  it('con 4 valores dice MUESTRA INSUFICIENTE y no da limites ni aptitud, aunque le pasen tolerancia', () => {
    const e = estudio(parsearValores('12,04 13,10 13,10 13,72'), { lie: 10, lse: 16 });
    expect(e.nivel).toBe('insuficiente');
    expect(e.limites).toBeNull();
    expect(e.aptitud).toBeNull();
    expect(e.avisos.join(' ')).toMatch(/MUESTRA INSUFICIENTE: 4 valores son 0 subgrupo\(s\) de 5[\s\S]*25 subgrupos \(125 piezas\)[\s\S]*desde 8 \(40 piezas\)/);
    const t = informe(e);
    expect(t).toMatch(/promedio 12,99 · recorrido 1,68 · s 0,70/);
    expect(t).toContain(AVISO);
    expect(t).not.toMatch(/PP /);
  });
});

describe('aptitud de maquina — el criterio del I-AC-021', () => {
  const grupo = [9, 10, 10, 10, 11]; // promedio 10, recorrido 2

  it('8 subgrupos: limites TENTATIVOS con A2 y D4 de n = 5, sin PP ni PPK', () => {
    const e = estudio(repetir(grupo, 8), { lie: 6, lse: 14 });
    expect(e.nivel).toBe('tentativo');
    expect(e.limites.xbb).toBeCloseTo(10, 9);
    expect(e.limites.rb).toBeCloseTo(2, 9);
    expect(e.limites.lcsX).toBeCloseTo(10 + 0.577 * 2, 9);
    expect(e.limites.lciX).toBeCloseTo(10 - 0.577 * 2, 9);
    expect(e.limites.lcsR).toBeCloseTo(2.114 * 2, 9);
    expect(e.limites.lciR).toBe(0);
    expect(e.estable).toBe(true);
    expect(e.aptitud).toBeNull();
    expect(e.avisos.join(' ')).toMatch(/LIMITES TENTATIVOS \(8 subgrupos\)[\s\S]*forma consecutiva/);
  });

  it('7 subgrupos todavia es insuficiente (el borde de abajo)', () => {
    expect(estudio(repetir(grupo, 7)).nivel).toBe('insuficiente');
  });

  it('25 subgrupos estables con tolerancia: PP y PPK con el desvio total, contra 1,67', () => {
    const vals = repetir(grupo, 25);
    const s = Math.sqrt((25 * 2) / 124); // cada subgrupo suma 2 de desvios al cuadrado; n-1 = 124
    const e = estudio(vals, { lie: 6, lse: 14 });
    expect(e.nivel).toBe('preliminar');
    expect(e.estable).toBe(true);
    expect(e.aptitud.pp).toBeCloseTo(8 / (6 * s), 9);
    expect(e.aptitud.ppk).toBeCloseTo(4 / (3 * s), 9);
    expect(informe(e)).toMatch(/PP 2,10 llega · PPK 2,10 llega \(el I-AC-021 pide 1,67 o mas\)/);
    expect(e.avisos.join(' ')).toMatch(/normalidad no la verifica[\s\S]*softcep o spc1/);
  });

  it('con la tolerancia cerca, PPK no llega; con una sola tolerancia solo hay PPK', () => {
    const vals = repetir(grupo, 25);
    expect(informe(estudio(vals, { lie: 6, lse: 12 }))).toMatch(/PPK 1,05 NO llega/);
    const uni = estudio(vals, { lse: 12 });
    expect(Number.isNaN(uni.aptitud.pp)).toBe(true);
    expect(uni.aptitud.ppk).toBeCloseTo(2 / (3 * Math.sqrt(50 / 124)), 9);
  });

  it('sin tolerancia no inventa ninguna: lo pide', () => {
    const e = estudio(repetir(grupo, 25));
    expect(e.aptitud).toBeNull();
    expect(e.avisos.join(' ')).toMatch(/Sin tolerancia no se calcula PP ni PPK/);
  });

  it('un subgrupo corrido sale fuera de limites: NO ESTABLE y no se calcula aptitud', () => {
    const vals = [...repetir(grupo, 12), 13, 14, 14, 14, 15, ...repetir(grupo, 12)];
    const e = estudio(vals, { lie: 6, lse: 18 });
    expect(e.nivel).toBe('preliminar');
    expect(e.estable).toBe(false);
    expect(e.limites.fuera).toContainEqual(expect.objectContaining({ subgrupo: 13, que: 'promedio' }));
    expect(e.aptitud).toBeNull();
    expect(e.avisos.join(' ')).toMatch(/PROCESO NO ESTABLE[\s\S]*grupo de trabajo analiza/);
  });

  it('PP y PPK salen de los mismos 25 subgrupos de la carta: un subgrupo 26 corrido no cambia la aptitud y se dice', () => {
    const base = estudio(repetir(grupo, 25), { lie: 6, lse: 14 });
    const conCola = estudio([...repetir(grupo, 25), 4, 4, 16, 16, 4, 3, 17], { lie: 6, lse: 14 });
    expect(conCola.aptitud.pp).toBeCloseTo(base.aptitud.pp, 12);
    expect(conCola.aptitud.ppk).toBeCloseTo(base.aptitud.ppk, 12);
    expect(conCola.resumenAptitud.n).toBe(125);
    expect(conCola.avisos.join(' ')).toMatch(/PP y PPK salen de los 125 valores[\s\S]*los otros 7 no entran/);
  });

  it('con mas de 25 subgrupos los limites salen de los 25 primeros, y lo que sobra se dice', () => {
    const e = estudio([...repetir(grupo, 26), 10, 10]);
    expect(e.subgrupos).toBe(26);
    expect(e.limites.medias).toHaveLength(25);
    expect(e.sobran).toBe(2);
    expect(e.avisos.join(' ')).toMatch(/25 primeros subgrupos[\s\S]*Quedan 2 valor/);
  });

  it('limitesXR y aptitud sueltos: tolerancia al reves es un error; desvio cero lo dice', () => {
    expect(limitesXR([grupo]).xbb).toBe(10);
    expect(() => aptitud({ media: 10, s: 1 }, { lie: 14, lse: 6 })).toThrow(/tiene que ser mayor/);
    expect(aptitud({ media: 10, s: 0 }, { lie: 6, lse: 14 }).motivo).toMatch(/desvio es cero/);
    expect(aptitud({ media: 10, s: 1 }, {})).toBeNull();
  });
});

describe('aptitud de maquina — lectura de los valores', () => {
  it('acepta coma o punto, separados por espacio, punto y coma o renglon', () => {
    expect(parsearValores('12,04;13.10\n13,1  13,72')).toEqual([12.04, 13.1, 13.1, 13.72]);
  });
  it('no adivina: dos comas en un numero o letras son un error', () => {
    expect(() => parsearValores('12,04,13,10')).toThrow(/no entiendo el valor/);
    expect(() => parsearValores('12,04 trece')).toThrow(/no entiendo el valor "trece"/);
    expect(() => parsearValores('  ')).toThrow(/no hay ningun valor/);
  });
});

describe('aptitud de maquina — el comando', () => {
  it('con el caso conocido imprime los tres numeros, la muestra insuficiente y el aviso de que no es el estudio', () => {
    const r = correr('--valores', '12,04 13,10 13,10 13,72');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/promedio 12,99 · recorrido 1,68 · s 0,70/);
    expect(r.stdout).toMatch(/MUESTRA INSUFICIENTE/);
    expect(r.stdout).toContain('Es la cuenta, no el estudio');
  });
  it('frena ante un argumento que no conoce, sin valores o con los dos origenes', () => {
    expect(correr('--valores', '1 2', '--apply').status).toBe(2);
    expect(correr().status).toBe(2);
    expect(correr('--valores', '1 2', '--archivo', 'x.txt').status).toBe(2);
    expect(correr('--valores').status).toBe(2);
    expect(correr('--valores', '1 2', '--lse', 'mucho').status).toBe(2);
    expect(correr('--valores', '1 2', '--lie', '').status).toBe(2); // vacio no es 0
  });
  it('un valor ilegible sale con error 1 y lo dice', () => {
    const r = correr('--valores', '12,04 doce');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/no entiendo el valor "doce"/);
  });
});
