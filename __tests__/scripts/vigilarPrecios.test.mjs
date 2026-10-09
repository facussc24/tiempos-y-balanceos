// @vitest-environment node
/**
 * Tests de scripts/_lib/vigilarPrecios.mjs y scripts/_vigilarPrecios.mjs — el vigilante semanal de
 * precios, creditos y retiro de modelos de Anthropic.
 *
 * Sin red: las paginas son las REALES bajadas el 08/10/2026 (`__tests__/fixtures/precios/*.md`, guardadas
 * con `node scripts/_guardarFixturesPrecios.mjs`) y un `fetch` de mentira. Tiene que pasar en el
 * CI (ubuntu, Node 20) sin internet ni clave.
 *
 * Lo que mas importa, en las dos direcciones:
 *  - con la pagina real, los 4 modelos se leen y coinciden con `PRECIOS` campo por campo (si no, el test
 *    dice cual); con un gemelo al que se le cambia un numero a mano, se detecta la diferencia;
 *  - una pagina SIN la tabla, sin un modelo o sin la fila larga de Haiku es un ERROR (codigo 1), nunca
 *    "0 diferencias";
 *  - el JSON solo se escribe bajo `.sgc-cache` (o la carpeta de BARACK_PRECIOS_DIR).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PRECIOS } from '../../scripts/_lib/claudeApi.mjs';
import * as V from '../../scripts/_lib/vigilarPrecios.mjs';
import { guardarFixture } from '../../scripts/_lib/vigilarPreciosFixtures.mjs';

const RAIZ = V.RAIZ;
const SCRIPT = path.join(RAIZ, 'scripts', '_vigilarPrecios.mjs');
const leer = (nombre) => fs.readFileSync(path.join(V.DIR_FIXTURES, nombre), 'utf8');
const AHORA = new Date(2026, 9, 8, 12, 0, 0); // 8 de octubre de 2026, hora local

const real = () => ({ pricing: leer('pricing.md'), creditos: leer('creditos.md'), deprecaciones: leer('deprecations.md') });
const paginas = (o) => Object.fromEntries(Object.entries(o).map(([k, cuerpo]) => [k, { url: `fixture:${k}`, cuerpo, bytes: cuerpo.length }]));

/** Cambia la PRIMERA linea que empieza con `inicio`; si no la encuentra, o no cambia nada, el test falla. */
function cambiarLinea(md, inicio, fn) {
  let tocada = false;
  const out = md.split('\n').map((l) => {
    if (tocada || !l.startsWith(inicio)) return l;
    tocada = true;
    return fn(l);
  }).join('\n');
  expect(tocada, `no encontre la linea que empieza con "${inicio}"`).toBe(true);
  expect(out, `el gemelo quedo igual al original (${inicio})`).not.toBe(md);
  return out;
}
const sacarLineas = (md, pred) => {
  const out = md.split('\n').filter((l) => !pred(l)).join('\n');
  expect(out, 'no se saco ninguna linea').not.toBe(md);
  return out;
};

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vigilarprecios-test-')); });
afterEach(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temporal */ } });

const envTmp = () => ({ ...process.env, BARACK_PRECIOS_DIR: tmp });
const corrida = (extra = {}) => V.correr({ ahora: AHORA, env: envTmp(), ...extra });

// ─────────────────────────────────────────────────────────────────────────────
describe('vigilarPrecios · la pagina real de hoy contra PRECIOS', () => {
  it('los 4 modelos que usamos son los que se vigilan', () => {
    const ids = Object.keys(PRECIOS);
    for (const id of ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1']) expect(ids).toContain(id);
  });

  it('se leen los 25 precios (4 modelos x 5 campos + los 5 de la tarifa larga de Haiku) y coinciden con PRECIOS, campo por campo', () => {
    const of = V.parsearPrecios(real().pricing);
    expect(of.valoresLeidos).toBe(25);
    for (const [id, p] of Object.entries(PRECIOS)) {
      for (const campo of V.CAMPOS_PRECIO) {
        expect(of.modelos[id].base[campo], `${id} ${campo}: la pagina dice ${of.modelos[id].base[campo]} y PRECIOS ${p[campo]}`).toBeCloseTo(p[campo], 9);
        if (p.masDe100k) {
          expect(of.modelos[id].masDe100k[campo], `${id} masDe100k.${campo}`).toBeCloseTo(p.masDe100k[campo], 9);
        }
      }
    }
    expect(of.modelos['claude-haiku-5-5'].umbral).toBe(V.UMBRAL_NUESTRO);
    expect(of.modelos['claude-opus-5-5'].masDe100k).toBeNull();
  });

  it('compararPrecios no marca nada DISTINTO (y si marca, dice cual)', () => {
    const filas = V.compararPrecios(V.parsearPrecios(real().pricing));
    const malas = filas.filter((f) => f.estado !== 'igual').map((f) => `${f.modelo} ${f.campo}: nuestro ${f.nuestro} / oficial ${f.oficial}`);
    expect(malas, `PRECIOS no coincide con la pagina oficial:\n${malas.join('\n')}`).toEqual([]);
    expect(filas).toHaveLength(26); // 25 precios + el umbral de 100.000 tokens
  });

  it('Opus 5.5 y Sonnet 5.5 no se confunden con Opus 5 y Sonnet 5, ni Fable 5.1 con Fable 5 (la pagina trae las dos)', () => {
    const md = real().pricing;
    expect(md).toMatch(/\| Claude Opus 5 +\|/);
    expect(md).toMatch(/\| Claude Sonnet 5 +\|/);
    expect(md).toMatch(/\| Claude Fable 5 +\|/);
    const of = V.parsearPrecios(md);
    expect(of.modelos['claude-opus-5-5'].base.entrada).toBe(4); // Opus 5 cuesta 5
    expect(of.modelos['claude-sonnet-5-5'].base.cacheLectura).toBeCloseTo(0.1, 9); // Sonnet 5 cuesta 0.20
    expect(of.modelos['claude-fable-5-1'].base.cacheLectura).toBeCloseTo(0.25, 9); // Fable 5 cuesta 1
  });

  it('la nota al pie <sup>1</sup> no se lee como parte del numero', () => {
    expect(V.parsearPrecioMtok('$0.25 / MTok<sup>1</sup>')).toBe(0.25);
    expect(V.parsearPrecioMtok('$12.50 / MTok')).toBe(12.5);
    expect(() => V.parsearPrecioMtok('gratis')).toThrow(V.ErrorVigilante);
    expect(() => V.parsearPrecioMtok('$ / MTok')).toThrow(V.ErrorVigilante);
  });

  it('nombrePagina arma el nombre de la tabla desde el id', () => {
    expect(V.nombrePagina('claude-opus-5-5')).toBe('Claude Opus 5.5');
    expect(V.nombrePagina('claude-haiku-5-5')).toBe('Claude Haiku 5.5');
    expect(V.nombrePagina('claude-fable-5-1')).toBe('Claude Fable 5.1');
    expect(V.nombrePagina('claude-opus-4-5-20251101')).toBe('Claude Opus 4.5');
    expect(() => V.nombrePagina('gpt-5')).toThrow(V.ErrorVigilante);
  });

  it('las columnas se leen por el NOMBRE del encabezado: la misma tabla con otro orden da lo mismo', () => {
    const md = real().pricing;
    const t = V.parsearTablasMarkdown(md).find((x) => x.encabezado.some((h) => /Base input/.test(h)));
    // El orden de la version HTML de la pagina: Input, Output, 5m, 1h, Hits.
    const orden = [0, 1, 5, 2, 3, 4];
    const fila = (celdas) => `| ${orden.map((i) => celdas[i]).join(' | ')} |`;
    const reordenada = ['---', 'title: Pricing', '---', '', fila(t.encabezado), `| ${orden.map(() => '---').join(' | ')} |`, ...t.filas.map(fila)].join('\n');
    expect(reordenada).not.toBe(md);
    expect(V.parsearPrecios(reordenada)).toEqual(V.parsearPrecios(md));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('vigilarPrecios · un precio cambiado a mano se detecta', () => {
  it('Sonnet 5.5 con la salida en $15: codigo 3 y la diferencia nombra modelo, campo, nuestro y oficial', async () => {
    const pricing = cambiarLinea(real().pricing, '| Claude Sonnet 5.5 ', (l) => l.replace(/\$10 \/ MTok(\s*\|\s*)$/, (_, fin) => `$15 / MTok${fin}`));
    const r = await corrida({ paginas: paginas({ ...real(), pricing }) });
    expect(r.codigo).toBe(3);
    expect(r.errores).toEqual([]);
    expect(r.diferencias).toHaveLength(1);
    expect(r.diferencias[0]).toMatchObject({ seccion: 'precios', modelo: 'claude-sonnet-5-5', campo: 'salida', nuestro: 10, oficial: 15, estado: 'DISTINTO' });
  });

  it('Opus 5.5 con la lectura de cache en $0.50 (el error del informe del 07/10): codigo 3', async () => {
    const pricing = cambiarLinea(real().pricing, '| Claude Opus 5.5 ', (l) => l.replace('$0.20 / MTok', '$0.50 / MTok'));
    const r = await corrida({ paginas: paginas({ ...real(), pricing }) });
    expect(r.codigo).toBe(3);
    expect(r.diferencias.map((d) => `${d.modelo} ${d.campo}`)).toEqual(['claude-opus-5-5 cacheLectura']);
  });

  it('Haiku con la tarifa larga cambiada, o con otro umbral: codigo 3', async () => {
    const largo = cambiarLinea(real().pricing, '| Claude Haiku 5.5 (for prompts over', (l) => l.replace('$2.50 / MTok', '$3 / MTok'));
    const r1 = await corrida({ paginas: paginas({ ...real(), pricing: largo }) });
    expect(r1.codigo).toBe(3);
    expect(r1.diferencias.map((d) => d.campo)).toEqual(['masDe100k.salida']);
    const umbral = cambiarLinea(real().pricing, '| Claude Haiku 5.5 (for prompts over', (l) => l.replace('over 100,000 tokens', 'over 200,000 tokens'));
    const r2 = await corrida({ paginas: paginas({ ...real(), pricing: umbral }) });
    expect(r2.codigo).toBe(3);
    expect(r2.diferencias.map((d) => d.campo)).toEqual(['masDe100k.umbralTokens']);
  });

  it('un precio MAS BARATO tambien es diferencia (no solo las subas)', async () => {
    const pricing = cambiarLinea(real().pricing, '| Claude Fable 5.1 ', (l) => l.replace('$50 / MTok', '$25 / MTok'));
    const r = await corrida({ paginas: paginas({ ...real(), pricing }) });
    expect(r.codigo).toBe(3);
    expect(r.diferencias[0]).toMatchObject({ modelo: 'claude-fable-5-1', campo: 'salida', nuestro: 50, oficial: 25 });
  });

  it('una tabla nuestra distinta (PRECIOS gemelo alterado) tambien da 3', async () => {
    const gemelo = JSON.parse(JSON.stringify(PRECIOS));
    gemelo['claude-opus-5-5'].entrada = 5;
    const r = await corrida({ paginas: paginas(real()), precios: gemelo });
    expect(r.codigo).toBe(3);
    expect(r.diferencias[0]).toMatchObject({ modelo: 'claude-opus-5-5', campo: 'entrada', nuestro: 5, oficial: 4 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('vigilarPrecios · si no se entiende la pagina es ERROR (codigo 1), nunca "0 diferencias"', () => {
  it('pagina sin la tabla de precios (el fixture sin_tabla): codigo 1 y el error lo dice', async () => {
    const r = await corrida({ paginas: paginas({ ...real(), pricing: leer('pricing.sin_tabla.md') }) });
    expect(r.codigo).toBe(1);
    expect(r.diferencias).toEqual([]);
    expect(r.precios.ok).toBe(false);
    expect(r.errores[0]).toMatchObject({ seccion: 'pricing', tipo: 'tabla' });
    expect(r.errores[0].mensaje).toMatch(/no encontre la tabla de precios/);
    expect(r.creditos.ok && r.deprecaciones.ok).toBe(true); // las otras dos paginas se leen igual
  });

  it('la tabla con los encabezados cambiados de nombre tampoco se "adivina"', () => {
    const md = real().pricing.replace('Base input tokens', 'Entrada').replace('Output tokens', 'Salida');
    expect(md).not.toBe(real().pricing);
    expect(() => V.parsearPrecios(md)).toThrow(/no encontre la tabla/);
  });

  it('un modelo que desaparece de la tabla (Fable 5.1): codigo 1, no 3', async () => {
    const pricing = sacarLineas(real().pricing, (l) => l.startsWith('| Claude Fable 5.1 '));
    const r = await corrida({ paginas: paginas({ ...real(), pricing }) });
    expect(r.codigo).toBe(1);
    expect(r.errores[0].mensaje).toMatch(/Claude Fable 5\.1/);
  });

  it('Haiku sin la fila de la tarifa larga: codigo 1 (le faltan 5 de los 25 valores)', async () => {
    const pricing = sacarLineas(real().pricing, (l) => l.includes('for prompts over 100,000 tokens'));
    const r = await corrida({ paginas: paginas({ ...real(), pricing }) });
    expect(r.codigo).toBe(1);
    expect(r.errores[0].mensaje).toMatch(/esperaba 25 precios oficiales y lei 20/);
  });

  it('una celda de precio que ya no dice "$N / MTok": codigo 1', async () => {
    const pricing = cambiarLinea(real().pricing, '| Claude Sonnet 5.5 ', (l) => l.replace('$2 / MTok', '2 dolares'));
    const r = await corrida({ paginas: paginas({ ...real(), pricing }) });
    expect(r.codigo).toBe(1);
    expect(r.errores[0].tipo).toBe('formato');
  });

  it('numeros fuera de orden (Opus 5.5 con la entrada en $6, por encima de la escritura de $5): el aviso NO tapa la diferencia, sale 3', async () => {
    const pricing = cambiarLinea(real().pricing, '| Claude Opus 5.5 ', (l) => l.replace('$4 / MTok', '$6 / MTok'));
    const r = await corrida({ paginas: paginas({ ...real(), pricing }) });
    expect(r.codigo).toBe(3);
    expect(r.diferencias[0]).toMatchObject({ modelo: 'claude-opus-5-5', campo: 'entrada', nuestro: 4, oficial: 6 });
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0]).toMatchObject({ seccion: 'pricing', tipo: 'invariante' });
    expect(r.errores[0].mensaje).toMatch(/Claude Opus 5\.5/);
  });

  it('numeros fuera de orden que coinciden con lo nuestro: sin diferencias, pero el aviso deja codigo 1 (no un "todo igual")', async () => {
    const pricing = cambiarLinea(real().pricing, '| Claude Opus 5.5 ', (l) => l.replace('$0.20 / MTok', '$9 / MTok'));
    const gemelo = JSON.parse(JSON.stringify(PRECIOS));
    gemelo['claude-opus-5-5'].cacheLectura = 9;
    const r = await corrida({ paginas: paginas({ ...real(), pricing }), precios: gemelo });
    expect(r.diferencias).toEqual([]);
    expect(r.codigo).toBe(1);
    expect(r.errores[0].tipo).toBe('invariante');
  });

  it('dos filas del mismo modelo y mismo tramo: codigo 1 (no sabe cual es cual)', () => {
    const md = real().pricing;
    const linea = md.split('\n').find((l) => l.startsWith('| Claude Opus 5.5 '));
    expect(() => V.parsearPrecios(md.replace(linea, `${linea}\n${linea}`))).toThrow(/dos veces/);
  });

  it('una pagina que no se bajo cuenta como error aunque las otras esten bien', async () => {
    const r = await corrida({ paginas: { ...paginas(real()), creditos: { error: 'HTTP 503', tipo: 'descarga' } } });
    expect(r.codigo).toBe(1);
    expect(r.creditos.ok).toBe(false);
    expect(r.errores).toEqual([{ seccion: 'creditos', tipo: 'descarga', mensaje: 'HTTP 503' }]);
  });

  it('diferencia en una pagina y error en otra: gana el 3 y el error queda a la vista', async () => {
    const pricing = cambiarLinea(real().pricing, '| Claude Opus 5.5 ', (l) => l.replace(/\$20 \/ MTok(\s*\|\s*)$/, (_, fin) => `$30 / MTok${fin}`));
    const r = await corrida({ paginas: { ...paginas({ ...real(), pricing }), creditos: { error: 'HTTP 503', tipo: 'descarga' } } });
    expect(r.codigo).toBe(3);
    expect(r.errores).toHaveLength(1);
    expect(V.formatearResultado(r)).toMatch(/ERRORES/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('vigilarPrecios · creditos', () => {
  it('lee los montos, el vencimiento y que Claude Code NO esta cubierto', () => {
    const c = V.parsearCreditos(real().creditos);
    expect(c.montos).toEqual({ 'Max 5x': 100, 'Max 20x': 200, 'Team Standard (por asiento)': 20, 'Team Premium (por asiento)': 100 });
    expect(c.teamTope).toBe(500);
    expect(c.venceAlFinalDelCiclo).toBe(true);
    expect(c.sinAcumulacion).toBe(true);
    expect(c.cubreClaudeCode).toBe(false);
    expect(c.vencimiento).toMatch(/billing cycle/);
    expect(c.vencimiento).not.toMatch(/\*\*/);
  });

  it('con la pagina real de hoy no hay ninguna diferencia (Team solo se informa)', () => {
    const filas = V.compararCreditos(V.parsearCreditos(real().creditos));
    expect(filas.filter((f) => f.estado === 'DISTINTO')).toEqual([]);
    expect(filas.filter((f) => f.estado === 'informa').map((f) => f.campo)).toHaveLength(3);
  });

  it('el Max 5x en $150: codigo 3', async () => {
    const creditos = cambiarLinea(real().creditos, '| Max 5x ', (l) => l.replace('$100 USD', '$150 USD'));
    const r = await corrida({ paginas: paginas({ ...real(), creditos }) });
    expect(r.codigo).toBe(3);
    expect(r.diferencias[0]).toMatchObject({ seccion: 'creditos', campo: 'Max 5x (USD por mes)', nuestro: 100, oficial: 150 });
  });

  it('si el credito pasara a vencer por mes calendario (no por ciclo de facturacion): codigo 3', async () => {
    const creditos = real().creditos.replaceAll('billing cycle', 'calendar month');
    expect(creditos).not.toBe(real().creditos);
    const r = await corrida({ paginas: paginas({ ...real(), creditos }) });
    expect(r.codigo).toBe(3);
    expect(r.diferencias.map((d) => d.campo)).toEqual(['vence al final del ciclo de facturacion']);
  });

  it('si el credito pasara a acumularse: codigo 3', async () => {
    const creditos = real().creditos.replace(', with no rollover', ', carried over to the next cycle').replace("and don't roll over", 'and carry over');
    expect(creditos).not.toBe(real().creditos);
    const r = await corrida({ paginas: paginas({ ...real(), creditos }) });
    expect(r.codigo).toBe(3);
    expect(r.diferencias.map((d) => d.campo)).toEqual(['no se acumula (sin rollover)']);
  });

  it('si los creditos pasaran a cubrir Claude Code: codigo 3 (cambiaria la regla api-claude.md)', async () => {
    const creditos = cambiarLinea(real().creditos, '| Claude Code ', (l) => l.replace('| No ', '| Yes'));
    const r = await corrida({ paginas: paginas({ ...real(), creditos }) });
    expect(r.codigo).toBe(3);
    expect(r.diferencias.map((d) => d.campo)).toEqual(['cubre Claude Code']);
  });

  it('sin la frase de vencimiento, o sin la tabla de montos: codigo 1', async () => {
    const sinVence = sacarLineas(real().creditos, (l) => /Expiry/.test(l));
    const r1 = await corrida({ paginas: paginas({ ...real(), creditos: sinVence }) });
    expect(r1.codigo).toBe(1);
    expect(r1.errores[0].mensaje).toMatch(/vencimiento/);
    const sinTabla = sacarLineas(real().creditos, (l) => /^\|/.test(l));
    const r2 = await corrida({ paginas: paginas({ ...real(), creditos: sinTabla }) });
    expect(r2.codigo).toBe(1);
  });

  it('Team se compara contra la corrida anterior: si cambia, codigo 3', () => {
    const c = V.parsearCreditos(real().creditos);
    const igual = V.compararCreditos(c, { montos: { ...c.montos }, teamTope: c.teamTope });
    expect(igual.filter((f) => f.estado === 'DISTINTO')).toEqual([]);
    const otra = V.compararCreditos(c, { montos: { ...c.montos, 'Team Standard (por asiento)': 25 }, teamTope: c.teamTope });
    expect(otra.filter((f) => f.estado === 'DISTINTO').map((f) => f.campo)).toEqual(['Team Standard (por asiento) (USD por mes)']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('vigilarPrecios · retiro de modelos', () => {
  it('con la pagina real de hoy: los 4 estan Active y "Not sooner than ..." NO cuenta como retiro', () => {
    const d = V.parsearDeprecaciones(real().deprecaciones);
    expect(d.modelos.map((m) => m.id).sort()).toEqual(Object.keys(PRECIOS).sort());
    for (const m of d.modelos) {
      expect(m.estado).toBe('Active');
      expect(m.retiroTipo).toBe('no_antes_de');
      expect(m.retiroFecha).toMatch(/^2027-\d\d-\d\d$/);
      expect(m.alerta, `${m.id}: ${m.motivos.join('; ')}`).toBe(false);
    }
  });

  it('la corrida completa con las tres paginas reales de hoy sale con codigo 0 y cero diferencias', async () => {
    const r = await corrida({ paginas: paginas(real()) });
    expect(r.errores).toEqual([]);
    expect(r.diferencias).toEqual([]);
    expect(r.codigo).toBe(0);
  });

  it('Sonnet 5.5 pasado a Deprecated con fecha de retiro: codigo 3', async () => {
    const deprecaciones = cambiarLinea(real().deprecaciones, '| claude-sonnet-5-5 ', () => '| claude-sonnet-5-5 | Deprecated | September 30, 2026 | November 30, 2026 |');
    const r = await corrida({ paginas: paginas({ ...real(), deprecaciones }) });
    expect(r.codigo).toBe(3);
    expect(r.diferencias[0]).toMatchObject({ seccion: 'deprecaciones', modelo: 'claude-sonnet-5-5', estado: 'DISTINTO' });
    expect(r.diferencias[0].oficial).toMatch(/estado Deprecated/);
    expect(r.diferencias[0].oficial).toMatch(/retiro November 30, 2026/);
  });

  it('un modelo todavia Active pero con una fecha de retiro concreta (sin "Not sooner than"): codigo 3', async () => {
    const deprecaciones = cambiarLinea(real().deprecaciones, '| claude-haiku-5-5 ', () => '| claude-haiku-5-5 | Active | N/A | October 7, 2027 |');
    const r = await corrida({ paginas: paginas({ ...real(), deprecaciones }) });
    expect(r.codigo).toBe(3);
    expect(r.diferencias[0].modelo).toBe('claude-haiku-5-5');
  });

  it('un modelo nuestro que aparece en la historia de deprecaciones: codigo 3', async () => {
    const historia = '\n### 2027-01-01: Claude Opus 5.5 model\n\n| Retirement date | Deprecated model | Recommended replacement |\n| --- | --- | --- |\n| March 1, 2028 | `claude-opus-5-5` | `claude-opus-6` |\n';
    const r = await corrida({ paginas: paginas({ ...real(), deprecaciones: real().deprecaciones + historia }) });
    expect(r.codigo).toBe(3);
    expect(r.diferencias[0].oficial).toMatch(/historia de deprecaciones/);
  });

  it('claude-fable-5-1 no se confunde con claude-fable-5 (id exacto)', () => {
    const md = sacarLineas(real().deprecaciones, (l) => l.startsWith('| claude-fable-5-1 '));
    expect(md).toMatch(/\| claude-fable-5 /);
    expect(() => V.parsearDeprecaciones(md)).toThrow(/claude-fable-5-1 no figura/);
  });

  it('sin la tabla de estado, o con un modelo nuestro ausente: codigo 1', async () => {
    const sinTabla = sacarLineas(real().deprecaciones, (l) => l.startsWith('| claude-') && /Active|Retired|Deprecated/.test(l));
    const r = await corrida({ paginas: paginas({ ...real(), deprecaciones: sinTabla }) });
    expect(r.codigo).toBe(1);
    expect(r.deprecaciones.ok).toBe(false);
  });

  it('interpretarRetiro distingue N/A, piso tentativo, fecha cierta y por anunciar', () => {
    expect(V.interpretarRetiro('N/A').tipo).toBe('na');
    expect(V.interpretarRetiro('Not sooner than September 1, 2027')).toEqual({ tipo: 'no_antes_de', fecha: '2027-09-01' });
    expect(V.interpretarRetiro('November 30, 2026')).toEqual({ tipo: 'fecha', fecha: '2026-11-30' });
    expect(V.interpretarRetiro('To be announced').tipo).toBe('por_anunciar');
    expect(V.interpretarRetiro('pronto').tipo).toBe('otro');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('vigilarPrecios · donde se escribe', () => {
  it('rechaza una ruta fuera de .sgc-cache (el repo, el temporal, el padre, y un nombre que solo EMPIEZA igual)', () => {
    const malas = [
      path.join(RAIZ, 'scripts', 'precios.json'),
      path.join(RAIZ, '__tests__', 'fixtures', 'precios', 'x.json'),
      path.join(os.tmpdir(), 'afuera', 'x.json'),
      path.join(V.DIR_SGC_CACHE, '..', 'x.json'),
      `${V.DIR_SGC_CACHE}-otro${path.sep}x.json`,
      path.join(V.DIR_SGC_CACHE, 'api', '..', '..', 'x.json'),
    ];
    for (const m of malas) expect(() => V.exigirRutaPermitida(m, {}), m).toThrow(/solo se escribe bajo \.sgc-cache/);
  });

  it('acepta lo que esta bajo .sgc-cache, y bajo BARACK_PRECIOS_DIR solo cuando esa variable esta', () => {
    expect(() => V.exigirRutaPermitida(path.join(V.DIR_PRECIOS, '2026-10-08.json'), {})).not.toThrow();
    const fuera = path.join(tmp, 'x.json');
    expect(() => V.exigirRutaPermitida(fuera, {})).toThrow(V.ErrorVigilante);
    expect(() => V.exigirRutaPermitida(fuera, { BARACK_PRECIOS_DIR: tmp })).not.toThrow();
    expect(() => V.exigirRutaPermitida(path.join(os.tmpdir(), 'otro', 'x.json'), { BARACK_PRECIOS_DIR: tmp })).toThrow(V.ErrorVigilante);
  });

  it('BARACK_PRECIOS_DIR no puede apuntar a una carpeta del repo que no sea .sgc-cache', () => {
    expect(() => V.dirSalida({ BARACK_PRECIOS_DIR: path.join(RAIZ, 'scripts') })).toThrow(/fuera de \.sgc-cache/);
    expect(() => V.dirSalida({ BARACK_PRECIOS_DIR: RAIZ })).toThrow(/fuera de \.sgc-cache/);
    expect(V.dirSalida({ BARACK_PRECIOS_DIR: path.join(V.DIR_SGC_CACHE, 'prueba') })).toBe(path.join(V.DIR_SGC_CACHE, 'prueba'));
    expect(V.dirSalida({})).toBe(V.DIR_PRECIOS);
  });

  it('escribirJsonSeguro no escribe nada en una ruta rechazada', () => {
    const afuera = path.join(RAIZ, 'scripts', '_no_debe_existir_vigilar.json');
    expect(() => V.escribirJsonSeguro(afuera, { a: 1 }, { env: {} })).toThrow(V.ErrorVigilante);
    expect(fs.existsSync(afuera)).toBe(false);
  });

  it('correr con una carpeta de salida fuera de lo permitido: no escribe, el error queda en errores y el codigo es 1', async () => {
    const afuera = path.join(os.tmpdir(), `vigilar-fuera-${process.pid}`);
    const r = await V.correr({ ahora: AHORA, env: {}, paginas: paginas(real()), dirSalida: afuera });
    expect(r.rutaJson).toBeNull();
    expect(r.errores.map((e) => e.seccion)).toContain('salida');
    expect(r.codigo).toBe(1);
    expect(fs.existsSync(afuera)).toBe(false);
  });

  it('escribe el JSON atomico en la carpeta permitida: se puede leer, trae version y lo leido, y no queda ningun temporal', async () => {
    const r = await corrida({ paginas: paginas(real()) });
    expect(r.rutaJson).toBe(path.join(tmp, '2026-10-08.json'));
    const j = JSON.parse(fs.readFileSync(r.rutaJson, 'utf8'));
    expect(j).toMatchObject({ version: 1, fecha: '2026-10-08', origen: 'web', codigo: 0 });
    expect(j.precios.oficial.modelos['claude-sonnet-5-5'].base.salida).toBe(10);
    expect(j.creditos.oficial.montos['Max 20x']).toBe(200);
    expect(j.deprecaciones.oficial.modelos).toHaveLength(4);
    expect(fs.readdirSync(tmp).filter((n) => n.includes('.tmp-'))).toEqual([]);
  });

  it('--simular escribe AAAA-MM-DD.simulado.json: no pisa ni pasa por la corrida real', async () => {
    const dirFix = path.join(tmp, 'fix');
    fs.mkdirSync(dirFix);
    for (const [k, archivo] of Object.entries(V.ARCHIVOS_PAGINA)) fs.copyFileSync(path.join(V.DIR_FIXTURES, archivo), path.join(dirFix, archivo));
    const r = await corrida({ simular: true, dirFixtures: dirFix });
    expect(r.origen).toBe('simulado');
    expect(r.codigo).toBe(0);
    expect(path.basename(r.rutaJson)).toBe('2026-10-08.simulado.json');
  });

  it('--simular sin fixtures guardados: codigo 1 con el aviso de como guardarlos', async () => {
    const r = await corrida({ simular: true, dirFixtures: path.join(tmp, 'no-existe') });
    expect(r.codigo).toBe(1);
    expect(r.errores[0].mensaje).toMatch(/_guardarFixturesPrecios/);
    expect(r.rutaJson).toBeNull();
  });

  it('guardar:false no escribe nada', async () => {
    const r = await corrida({ paginas: paginas(real()), guardar: false });
    expect(r.rutaJson).toBeNull();
    expect(fs.readdirSync(tmp)).toEqual([]);
  });

  it('guardarFixture solo guarda markdown y solo con una pagina conocida', () => {
    const dir = path.join(tmp, 'fix');
    const ruta = guardarFixture('creditos', real().creditos, { dir });
    expect(fs.readFileSync(ruta, 'utf8')).toBe(real().creditos);
    expect(() => guardarFixture('creditos', '<!doctype html><html></html>', { dir })).toThrow(/no es markdown/);
    expect(() => guardarFixture('otra', real().creditos, { dir })).toThrow(/desconocida/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('vigilarPrecios · la corrida anterior (para lo que no tenemos como dato: Team)', () => {
  const escribirAnterior = (nombre, obj) => fs.writeFileSync(path.join(tmp, nombre), JSON.stringify(obj));

  it('usa la mas nueva ANTERIOR a hoy y se saltea la de hoy, las simuladas, las rotas y las de otra version', () => {
    const buena = { version: 1, creditos: { ok: true, oficial: { montos: { 'Team Standard (por asiento)': 20 }, teamTope: 500 } } };
    escribirAnterior('2026-09-24.json', buena);
    escribirAnterior('2026-10-01.json', { ...buena, version: 99 });
    escribirAnterior('2026-10-02.simulado.json', buena);
    fs.writeFileSync(path.join(tmp, '2026-10-03.json'), '{ roto');
    escribirAnterior('2026-10-08.json', buena); // la de hoy no cuenta
    expect(V.leerCorridaAnterior(tmp, '2026-10-08').fecha).toBe('2026-09-24');
    expect(V.leerCorridaAnterior(path.join(tmp, 'no-existe'), '2026-10-08')).toBeNull();
  });

  it('si Team cambio desde la semana pasada, la corrida da 3', async () => {
    escribirAnterior('2026-10-01.json', { version: 1, creditos: { ok: true, oficial: { montos: { 'Team Standard (por asiento)': 15, 'Team Premium (por asiento)': 100 }, teamTope: 500 } } });
    const r = await corrida({ paginas: paginas(real()) });
    expect(r.codigo).toBe(3);
    expect(r.creditos.anterior).toBe('2026-10-01');
    expect(r.diferencias[0]).toMatchObject({ campo: 'Team Standard (por asiento) (USD por mes)', nuestro: 15, oficial: 20, ref: 'anterior' });
  });

  it('la corrida de hoy deja la lectura para la semana que viene', async () => {
    await corrida({ paginas: paginas(real()) });
    const semanaQueViene = await V.correr({ ahora: new Date(2026, 9, 15, 12), env: envTmp(), paginas: paginas(real()) });
    expect(semanaQueViene.creditos.anterior).toBe('2026-10-08');
    expect(semanaQueViene.codigo).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('vigilarPrecios · bajar las paginas (con un fetch de mentira)', () => {
  const resp = (cuerpo, { status = 200, tipo = 'text/markdown; charset=utf-8' } = {}) => ({
    ok: status >= 200 && status < 300, status, headers: { get: (k) => (k.toLowerCase() === 'content-type' ? tipo : null) }, text: async () => cuerpo,
  });
  const md = '---\ntitle: Pricing\n---\n\n| a | b |\n| - | - |\n| 1 | 2 |\n';

  it('pide markdown, con tope de tiempo, y devuelve el cuerpo', async () => {
    const pedidos = [];
    const fetchFn = async (url, opt) => { pedidos.push({ url, opt }); return resp(md); };
    const r = await V.bajarPagina(V.URLS.pricing, { fetchFn });
    expect(r.cuerpo).toBe(md);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].opt.headers.Accept).toBe('text/markdown');
    expect(pedidos[0].opt.signal).toBeDefined();
  });

  it('si el servidor contesta HTML, prueba con el sufijo .md', async () => {
    const urls = [];
    const fetchFn = async (url) => { urls.push(url); return url.endsWith('.md') ? resp(md) : resp('<!DOCTYPE html><html><body>hola</body></html>', { tipo: 'text/html' }); };
    const r = await V.bajarPagina(V.URLS.pricing, { fetchFn });
    expect(urls).toEqual([V.URLS.pricing, `${V.URLS.pricing}.md`]);
    expect(r.url).toBe(`${V.URLS.pricing}.md`);
  });

  it('si las dos devuelven HTML es un error de formato: no se parsea HTML', async () => {
    const fetchFn = async () => resp('<!DOCTYPE html><html><body>hola</body></html>', { tipo: 'text/html' });
    await expect(V.bajarPagina(V.URLS.pricing, { fetchFn })).rejects.toMatchObject({ name: 'ErrorVigilante', tipo: 'formato' });
  });

  it('un 500 se reintenta una vez; si sigue, es error de descarga', async () => {
    let n = 0;
    const fetchFn = async () => { n++; return resp('', { status: 500 }); };
    await expect(V.bajarPagina(V.URLS.pricing, { fetchFn })).rejects.toMatchObject({ tipo: 'descarga' });
    expect(n).toBe(2);
    let m = 0;
    const flojo = async () => { m++; return m === 1 ? resp('', { status: 503 }) : resp(md); };
    expect((await V.bajarPagina(V.URLS.pricing, { fetchFn: flojo })).cuerpo).toBe(md);
  });

  it('un timeout es error de descarga y lo dice', async () => {
    const fetchFn = async () => { const e = new Error('The operation was aborted due to timeout'); e.name = 'TimeoutError'; throw e; };
    await expect(V.bajarPagina(V.URLS.pricing, { fetchFn, timeoutMs: 20000 })).rejects.toThrow(/sin respuesta en 20 s/);
  });

  it('si el tiempo se acaba mientras baja el cuerpo, tambien es error de descarga (no una excepcion suelta)', async () => {
    const fetchFn = async () => ({
      ok: true, status: 200, headers: { get: () => 'text/markdown' },
      text: async () => { const e = new Error('aborted'); e.name = 'TimeoutError'; throw e; },
    });
    await expect(V.bajarPagina(V.URLS.pricing, { fetchFn, timeoutMs: 20000 })).rejects.toMatchObject({ name: 'ErrorVigilante', tipo: 'descarga', message: expect.stringMatching(/sin respuesta en 20 s/) });
  });

  it('un 404 en las dos direcciones es error de descarga; una respuesta enorme se rechaza', async () => {
    await expect(V.bajarPagina(V.URLS.pricing, { fetchFn: async () => resp('', { status: 404 }) })).rejects.toMatchObject({ tipo: 'descarga' });
    await expect(V.bajarPagina(V.URLS.pricing, { fetchFn: async () => resp(md), maxBytes: 10 })).rejects.toThrow(/tope/);
  });

  it('de punta a punta: las tres paginas por fetch dan codigo 0, y si una cae las otras dos se leen igual', async () => {
    const porUrl = { [V.URLS.pricing]: real().pricing, [V.URLS.creditos]: real().creditos, [V.URLS.deprecaciones]: real().deprecaciones };
    const ok = async (url) => resp(porUrl[url]);
    const r = await corrida({ fetchFn: ok });
    expect(r.codigo).toBe(0);
    expect(r.origen).toBe('web');
    const sinCreditos = async (url) => (url === V.URLS.creditos ? resp('', { status: 500 }) : resp(porUrl[url]));
    const r2 = await V.correr({ ahora: new Date(2026, 9, 9, 12), env: envTmp(), fetchFn: sinCreditos });
    expect(r2.codigo).toBe(1);
    expect(r2.precios.ok && r2.deprecaciones.ok).toBe(true);
    expect(r2.creditos.ok).toBe(false);
    expect(r2.errores[0]).toMatchObject({ seccion: 'creditos', tipo: 'descarga' });
  });

  it('esMarkdown: acepta markdown con el content-type o con el encabezado, rechaza HTML', () => {
    expect(V.esMarkdown('texto', 'text/markdown')).toBe(true);
    expect(V.esMarkdown('---\ntitle: x\n---\n', 'text/plain')).toBe(true);
    expect(V.esMarkdown('<!DOCTYPE html><html>', 'text/markdown')).toBe(false);
    expect(V.esMarkdown('hola', 'text/plain')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('vigilarPrecios · markdown y consola', () => {
  it('parsearTablasMarkdown: encabezado, filas, celdas con \\| y tablas pegadas a texto', () => {
    const t = V.parsearTablasMarkdown('texto\n\n| a | b |\n| :-- | --: |\n| 1 | x \\| y |\n| 2 | z |\n\nfin\n\n| solo |\n|---|\n| uno |');
    expect(t).toHaveLength(2);
    expect(t[0].encabezado).toEqual(['a', 'b']);
    expect(t[0].filas).toEqual([['1', 'x | y'], ['2', 'z']]);
    expect(t[1].filas).toEqual([['uno']]);
  });

  it('limpiarCelda saca links, negritas, notas al pie y escapes', () => {
    expect(V.limpiarCelda('**Max 5x** \\* [ver](https://x.com/a)<sup>1</sup>')).toBe('Max 5x * ver');
  });

  it('formatearResultado muestra la tabla con modelo, campo, nuestro, oficial y estado, y DISTINTO donde hay diferencia', async () => {
    const pricing = cambiarLinea(real().pricing, '| Claude Sonnet 5.5 ', (l) => l.replace(/\$10 \/ MTok(\s*\|\s*)$/, (_, fin) => `$15 / MTok${fin}`));
    const r = await corrida({ paginas: paginas({ ...real(), pricing }) });
    const txt = V.formatearResultado(r);
    expect(txt).toMatch(/modelo\s+campo\s+nuestro\s+oficial\s+estado/);
    expect(txt).toMatch(/claude-sonnet-5-5\s+salida\s+\$10\s+\$15\s+DISTINTO/);
    expect(txt).toMatch(/claude-opus-5-5\s+entrada\s+\$4\s+\$4\s+igual/);
    expect(txt).toMatch(/RESULTADO: 1 diferencia\(s\).*codigo 3/);
    expect(/[^\x00-\x7F]/.test(txt), 'la consola de Windows no lee UTF-8: solo ASCII').toBe(false);
  });

  it('formatearResultado con un error de lectura dice que NO es "sin diferencias"', async () => {
    const r = await corrida({ paginas: paginas({ ...real(), pricing: leer('pricing.sin_tabla.md') }) });
    const txt = V.formatearResultado(r);
    expect(txt).toMatch(/NO SE PUDO LEER/);
    expect(txt).toMatch(/NO es "sin diferencias"/);
    expect(txt).toMatch(/codigo 1/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('_vigilarPrecios.mjs · la linea de comandos', () => {
  const correrCli = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { env: envTmp(), encoding: 'utf8', timeout: 60000 });

  it('--simular con los fixtures de hoy: codigo 0, la tabla y el JSON en la carpeta de prueba', () => {
    const r = correrCli(['--simular']);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/PRECIOS \(USD por millon de tokens\)/);
    expect(r.stdout).toMatch(/RESULTADO: todo igual -> codigo 0/);
    expect(fs.readdirSync(tmp).filter((n) => n.endsWith('.simulado.json'))).toHaveLength(1);
  });

  it('--simular --json imprime SOLO JSON que se puede leer', () => {
    const r = correrCli(['--simular', '--json', '--sin-guardar']);
    expect(r.status, r.stderr).toBe(0);
    const j = JSON.parse(r.stdout);
    expect(j).toMatchObject({ version: 1, origen: 'simulado', codigo: 0 });
    expect(fs.readdirSync(tmp)).toEqual([]);
  });

  it('con un precio distinto en las paginas guardadas sale con codigo 3 y marca DISTINTO', () => {
    const dirFix = path.join(tmp, 'fix');
    fs.mkdirSync(dirFix);
    for (const archivo of Object.values(V.ARCHIVOS_PAGINA)) fs.copyFileSync(path.join(V.DIR_FIXTURES, archivo), path.join(dirFix, archivo));
    const gemelo = cambiarLinea(leer('pricing.md'), '| Claude Sonnet 5.5 ', (l) => l.replace(/\$10 \/ MTok(\s*\|\s*)$/, (_, fin) => `$15 / MTok${fin}`));
    fs.writeFileSync(path.join(dirFix, V.ARCHIVOS_PAGINA.pricing), gemelo);
    const r = spawnSync(process.execPath, [SCRIPT, '--simular'], { env: { ...envTmp(), BARACK_PRECIOS_FIXTURES: dirFix }, encoding: 'utf8', timeout: 60000 });
    expect(r.status, r.stderr).toBe(3);
    expect(r.stdout).toMatch(/claude-sonnet-5-5\s+salida\s+\$10\s+\$15\s+DISTINTO/);
    expect(r.stdout).toMatch(/codigo 3/);
  });

  it('con una pagina guardada sin la tabla sale con codigo 1', () => {
    const dirFix = path.join(tmp, 'fix');
    fs.mkdirSync(dirFix);
    for (const archivo of Object.values(V.ARCHIVOS_PAGINA)) fs.copyFileSync(path.join(V.DIR_FIXTURES, archivo), path.join(dirFix, archivo));
    fs.copyFileSync(path.join(V.DIR_FIXTURES, 'pricing.sin_tabla.md'), path.join(dirFix, V.ARCHIVOS_PAGINA.pricing));
    const r = spawnSync(process.execPath, [SCRIPT, '--simular'], { env: { ...envTmp(), BARACK_PRECIOS_FIXTURES: dirFix }, encoding: 'utf8', timeout: 60000 });
    expect(r.status, r.stderr).toBe(1);
    expect(r.stdout).toMatch(/NO SE PUDO LEER/);
  });

  it('un argumento que no conoce (tambien el viejo --guardar-fixture, hoy un script aparte): codigo 1 y no hace nada', () => {
    const raro = correrCli(['--simulado']);
    expect(raro.status).toBe(1);
    expect(raro.stderr).toMatch(/Argumento que no conozco/);
    const juntos = correrCli(['--simular', '--guardar-fixture']);
    expect(juntos.status).toBe(1);
    expect(juntos.stderr).toMatch(/Argumento que no conozco/);
    expect(fs.readdirSync(tmp)).toEqual([]);
  });

  it('BARACK_PRECIOS_DIR apuntando al repo: codigo 1 y no escribe', () => {
    const r = spawnSync(process.execPath, [SCRIPT, '--simular'], { env: { ...process.env, BARACK_PRECIOS_DIR: path.join(RAIZ, 'scripts') }, encoding: 'utf8', timeout: 60000 });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/fuera de \.sgc-cache/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('vigilarPrecios · candados de la noche (los mismos de candadosNocturno.test.mjs)', () => {
  const ARCHIVOS = ['scripts/_lib/vigilarPrecios.mjs', 'scripts/_vigilarPrecios.mjs'];
  const PROHIBIDOS = [
    { que: 'guardar un documento APQP', re: /\b(saveAmfe|saveCp|saveHo|savePfd)\b/ },
    { que: 'escribir en una tabla', re: /\.(update|insert|upsert|delete)\(/ },
    { que: 'el escritor validado de AMFE', re: /\brunWithValidation\b/ },
    { que: 'matar procesos', re: /\btaskkill\b|Stop-Process/i },
    { que: 'tocar el arb', re: /produc\.exe/i },
    { que: 'mandar mails', re: /_mailEnviar|SendAndReceive/ },
    { que: 'lanzar Claude Code', re: /(spawn|exec)\w*\(\s*['"`]claude\b/ },
    { que: 'conectarse a Supabase', re: /\bconnectSupabase\w*\b|\bcreateClient\b/ },
    { que: 'llamar a la API de Anthropic', re: /@anthropic-ai\/sdk|crearCliente|\bllamar\(/ },
  ];

  it.each(ARCHIVOS)('%s no escribe en tablas, no manda mails, no mata procesos ni lanza claude', (rel) => {
    const texto = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
    const hallados = PROHIBIDOS.filter((p) => p.re.test(texto)).map((p) => p.que);
    expect(hallados, `${rel} tiene: ${hallados.join(', ')}`).toEqual([]);
  });

  it('cada patron caza lo que dice (gemelos rojos)', () => {
    const rojos = {
      'escribir en una tabla': "await sb.from('x').update({ a: 1 })",
      'matar procesos': "spawnSync('taskkill', ['/F'])",
      'lanzar Claude Code': "spawn('claude', ['-p', 'x'])",
      'conectarse a Supabase': 'const sb = createClient(url, key)',
    };
    for (const [que, texto] of Object.entries(rojos)) expect(PROHIBIDOS.find((p) => p.que === que).re.test(texto), que).toBe(true);
  });
});
