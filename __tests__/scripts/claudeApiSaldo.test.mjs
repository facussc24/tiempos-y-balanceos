// @vitest-environment node
/**
 * El gasto de la API separado por clave (scripts/_lib/claudeApi.mjs: etiquetaClave, saldoPorClave, saldo.json).
 * Fak, 11/10/2026, mirando la banda del tablero: "los dolares de la api no los entiendo, ¿no era mas facil poner
 * disponible, gastado, y separar entre cada api?". Hasta ese dia el ledger no decia con que clave se pagaba cada pedido.
 * Sin red: clientes falsos y el ledger en una carpeta temporal (BARACK_API_DIR, como claudeApi.test.mjs).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as A from '../../scripts/_lib/claudeApi.mjs';

let dir;
let apiDirPrevio;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudeapi-saldo-'));
  apiDirPrevio = process.env.BARACK_API_DIR;
  process.env.BARACK_API_DIR = dir;
});
afterEach(() => {
  if (apiDirPrevio === undefined) delete process.env.BARACK_API_DIR; else process.env.BARACK_API_DIR = apiDirPrevio;
});

const ENV = { BARACK_API_CICLO_DIA: '30' };                 // el ciclo de la casa: del 30 al 29
const EL_11 = new Date(2026, 9, 11, 12, 0, 0);
const fila = (ts, costoUsd, clave) => JSON.stringify({ ts, tarea: 't', modelo: 'claude-opus-5-5', lote: false, costoUsd, ...(clave ? { clave } : {}) });
const ledger = (mes, filas) => fs.writeFileSync(path.join(dir, `ledger_${mes}.jsonl`), filas.join('\n') + '\n');
const envLocal = (lineas) => { const f = path.join(dir, 'env.local'); fs.writeFileSync(f, lineas.join('\n') + '\n'); return f; };

describe('etiquetaClave: con que clave se pago, sin guardar la clave', () => {
  it('reconoce la prestada, la principal y la del entorno; una desconocida o vacia da null', () => {
    const archivoEnv = envLocal(['ANTHROPIC_API_KEY=sk-ant-principal', 'ANTHROPIC_API_KEY_HASTA_20261020=sk-ant-dueno']);
    expect(A.etiquetaClave('sk-ant-dueno', { env: {}, archivoEnv })).toBe('prestada-20261020');
    expect(A.etiquetaClave('sk-ant-principal', { env: {}, archivoEnv })).toBe('principal');
    expect(A.etiquetaClave('sk-ant-entorno', { env: { ANTHROPIC_API_KEY: 'sk-ant-entorno' }, archivoEnv })).toBe('entorno');
    // la misma clave en el entorno y en .env.local es la principal
    expect(A.etiquetaClave('sk-ant-principal', { env: { ANTHROPIC_API_KEY: 'sk-ant-principal' }, archivoEnv })).toBe('principal');
    expect(A.etiquetaClave('sk-ant-otra', { env: {}, archivoEnv })).toBeNull();
    expect(A.etiquetaClave(undefined, { env: {}, archivoEnv })).toBeNull();
    expect(A.etiquetaClave('', { env: {}, archivoEnv })).toBeNull();
  });
  it('la etiqueta nunca contiene la clave', () => {
    const archivoEnv = envLocal(['ANTHROPIC_API_KEY=sk-ant-principal-SECRETA', 'ANTHROPIC_API_KEY_HASTA_20261020=sk-ant-dueno-SECRETA']);
    for (const k of ['sk-ant-principal-SECRETA', 'sk-ant-dueno-SECRETA']) expect(A.etiquetaClave(k, { env: {}, archivoEnv })).not.toMatch(/SECRETA|sk-ant/);
  });
});

describe('registrarGasto: la linea lleva la etiqueta y deja el resumen al dia', () => {
  it('con `clave` la linea dice quien pago; sin ella no lleva el campo (las dos direcciones)', () => {
    const r = { modelo: 'claude-sonnet-5-5', usage: { input_tokens: 10, output_tokens: 5 }, costoUsd: 1.5, id: 'msg_1' };
    expect(A.registrarGasto(r, { tarea: 'a', dir, ahora: EL_11, clave: 'principal' }).clave).toBe('principal');
    expect('clave' in A.registrarGasto(r, { tarea: 'b', dir, ahora: EL_11 })).toBe(false);
    const lineas = fs.readFileSync(path.join(dir, 'ledger_2026-10.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(lineas.map((l) => l.clave)).toEqual(['principal', undefined]);
    // solo entra una etiqueta: si alguien pasara la clave misma (u otro texto), no queda escrita en ningun lado
    for (const mala of ['sk-ant-SECRETA', 'prestada', 'principal ', 'prestada-2026']) {
      expect('clave' in A.registrarGasto(r, { tarea: 'c', dir, ahora: EL_11, clave: mala })).toBe(false);
    }
    expect(A.registrarGasto(r, { tarea: 'd', dir, ahora: EL_11, clave: 'prestada-20261020' }).clave).toBe('prestada-20261020');
    expect(fs.readFileSync(path.join(dir, 'ledger_2026-10.jsonl'), 'utf8')).not.toContain('SECRETA');
    expect(fs.readFileSync(A.rutaSaldo(dir), 'utf8')).not.toContain('SECRETA');
  });
  it('despues de anotar un gasto, saldo.json existe y suma lo anotado', () => {
    const r = { modelo: 'claude-sonnet-5-5', usage: {}, costoUsd: 2.25, id: 'msg_1' };
    A.registrarGasto(r, { tarea: 'a', dir, ahora: EL_11, clave: 'principal' });
    A.registrarGasto(r, { tarea: 'a', dir, ahora: EL_11, clave: 'principal' });
    const s = JSON.parse(fs.readFileSync(A.rutaSaldo(dir), 'utf8'));
    expect(s.claves.find((c) => c.nombre === 'principal').gastadoUsd).toBe(4.5);
  });
  it('llamar(): la etiqueta sale de la clave del cliente que contesto', async () => {
    const archivoEnv = envLocal(['ANTHROPIC_API_KEY=sk-ant-principal', 'ANTHROPIC_API_KEY_HASTA_20991231=sk-ant-dueno']);
    const res = { id: 'msg_1', model: 'claude-sonnet-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: 'hola' }], usage: { input_tokens: 1000, output_tokens: 200 } };
    const cliente = (apiKey) => ({ apiKey, beta: { messages: { create: async () => res } } });
    const respaldoClave = { env: {}, archivoEnv, dirMarcas: dir };
    await A.llamar(cliente('sk-ant-dueno'), { modelo: 'sonnet', usuario: 'x', tarea: 'p', dirLedger: dir, ahora: EL_11, respaldoClave });
    await A.llamar(cliente('sk-ant-principal'), { modelo: 'sonnet', usuario: 'x', tarea: 'q', dirLedger: dir, ahora: EL_11, respaldoClave });
    await A.llamar({ beta: { messages: { create: async () => res } } }, { modelo: 'sonnet', usuario: 'x', tarea: 'r', dirLedger: dir, ahora: EL_11, respaldoClave });
    const lineas = fs.readFileSync(path.join(dir, 'ledger_2026-10.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(lineas.map((l) => l.clave)).toEqual(['prestada-20991231', 'principal', undefined]);
  });
});

describe('saldoPorClave: gastado y lo que queda, por clave', () => {
  it('con todas las lineas etiquetadas la cuenta es exacta: principal contra el credito del plan, la prestada aparte', () => {
    ledger('2026-10', [fila('2026-10-09 10:00:00', 30, 'prestada-20261020'), fila('2026-10-10 10:00:00', 50.5, 'principal'), fila('2026-10-11 09:00:00', 10, 'principal')]);
    const s = A.saldoPorClave({ dir, env: ENV, ahora: EL_11 });
    expect(s.estimado).toBe(false);
    expect(s.ciclo).toMatchObject({ desde: '2026-09-30', hasta: '2026-10-29', proximo: '2026-10-30' });
    expect(s.claves).toEqual([
      { nombre: 'principal', gastadoUsd: 60.5, creditoUsd: 200, quedanUsd: 139.5 },
      { nombre: 'prestada', hasta: '20261020', gastadoUsd: 30, agotada: false, vencida: false },
    ]);
  });
  it('las lineas viejas (sin etiqueta) se reparten por la hora en que la prestada quedo sin saldo, y lo dice: estimado', () => {
    ledger('2026-10', [fila('2026-10-10 22:00:00', 60), fila('2026-10-11 02:18:48', 47.04), fila('2026-10-11 02:24:26', 155.89)]);
    fs.writeFileSync(path.join(dir, 'prestada_agotada_20261020'), '2026-10-11 02:21:34 sin saldo (credit balance is too low)\n');
    // sin saber cuanto traia la prestada, el reparto queda como lo da la hora
    const crudo = A.saldoPorClave({ dir, env: ENV, ahora: EL_11, creditoPrestadas: {} });
    expect(crudo.estimado).toBe(true);
    expect(crudo.claves).toEqual([
      { nombre: 'principal', gastadoUsd: 155.89, creditoUsd: 200, quedanUsd: 44.11 },
      { nombre: 'prestada', hasta: '20261020', gastadoUsd: 107.04, agotada: true, vencida: false },
    ]);
    // con el dato (traia $100): una prestada agotada no pudo pagar mas de lo que tenia; el sobrante es del plan
    const s = A.saldoPorClave({ dir, env: ENV, ahora: EL_11 });
    expect(A.CREDITO_PRESTADAS_USD[20261020]).toBe(100);
    expect(s.claves).toEqual([
      { nombre: 'principal', gastadoUsd: 162.93, creditoUsd: 200, quedanUsd: 37.07 },
      { nombre: 'prestada', hasta: '20261020', gastadoUsd: 100, agotada: true, vencida: false },
    ]);
    // el total no cambia: se mueve de una clave a la otra
    expect(s.claves[0].gastadoUsd + s.claves[1].gastadoUsd).toBeCloseTo(crudo.claves[0].gastadoUsd + crudo.claves[1].gastadoUsd, 2);
  });
  it('el tope de la prestada no toca nada si lo atribuido es menos de lo que traia, ni cuando las lineas dicen su clave', () => {
    fs.writeFileSync(path.join(dir, 'prestada_agotada_20261020'), '2026-10-11 02:21:34 sin saldo (credit balance is too low)\n');
    ledger('2026-10', [fila('2026-10-10 22:00:00', 60), fila('2026-10-11 03:00:00', 10)]);
    expect(A.saldoPorClave({ dir, env: ENV, ahora: EL_11 }).claves.map((c) => c.gastadoUsd)).toEqual([10, 60]);
    // etiquetadas (cuenta exacta): aunque la prestada figure con mas de 100, no se reparte nada
    ledger('2026-10', [fila('2026-10-10 22:00:00', 130, 'prestada-20261020'), fila('2026-10-11 03:00:00', 10, 'principal')]);
    const exacto = A.saldoPorClave({ dir, env: ENV, ahora: EL_11 });
    expect(exacto.estimado).toBe(false);
    expect(exacto.claves.map((c) => c.gastadoUsd)).toEqual([10, 130]);
  });
  it('una linea sin etiqueta de fuera del tramo de la prestada es de la principal (y sigue siendo estimado)', () => {
    ledger('2026-10', [fila('2026-10-09 15:00:00', 12), fila('2026-10-11 03:50:48', 5)]);   // antes de la segunda clave y despues de agotada
    const s = A.saldoPorClave({ dir, env: ENV, ahora: EL_11 });
    expect(s.estimado).toBe(true);
    expect(s.claves).toEqual([{ nombre: 'principal', gastadoUsd: 17, creditoUsd: 200, quedanUsd: 183 }]);
    // sin tabla de reparto, todo lo no etiquetado es de la principal
    ledger('2026-10', [fila('2026-10-10 22:00:00', 12)]);
    expect(A.saldoPorClave({ dir, env: ENV, ahora: EL_11, repartoViejo: [] }).claves).toEqual([{ nombre: 'principal', gastadoUsd: 12, creditoUsd: 200, quedanUsd: 188 }]);
  });
  // Lo que encontro el auditor el 11/10/2026: el reparto de los pedidos viejos colgaba de las marcas de la carpeta.
  it('el reparto de las lineas viejas NO cambia si se borra la marca, si queda ilegible o si aparece otra prestada', () => {
    const viejas = [fila('2026-10-09 15:00:00', 4.87), fila('2026-10-10 22:00:00', 60), fila('2026-10-11 02:18:48', 42.17), fila('2026-10-11 02:24:26', 155.89)];
    ledger('2026-10', viejas);
    const marca = path.join(dir, 'prestada_agotada_20261020');
    fs.writeFileSync(marca, '2026-10-11 02:21:34 sin saldo (credit balance is too low)\n');
    const plan = (s) => s.claves.find((c) => c.nombre === 'principal');
    const conMarca = A.saldoPorClave({ dir, env: ENV, ahora: EL_11 });
    expect(plan(conMarca)).toEqual({ nombre: 'principal', gastadoUsd: 162.93, creditoUsd: 200, quedanUsd: 37.07 });
    expect(conMarca.claves.find((c) => c.nombre === 'prestada')).toMatchObject({ hasta: '20261020', gastadoUsd: 100, agotada: true });
    // la marca ilegible (vacia)
    fs.writeFileSync(marca, '');
    expect(plan(A.saldoPorClave({ dir, env: ENV, ahora: EL_11 }))).toEqual(plan(conMarca));
    // la marca borrada (recargaron la prestada): los pedidos viejos siguen repartidos igual; ya no figura agotada
    fs.rmSync(marca);
    const sinMarca = A.saldoPorClave({ dir, env: ENV, ahora: EL_11 });
    expect(plan(sinMarca)).toEqual(plan(conMarca));
    expect(sinMarca.claves.find((c) => c.nombre === 'prestada')).toMatchObject({ hasta: '20261020', gastadoUsd: 100, agotada: false });
    // otra prestada que se agota dias despues no se lleva los pedidos viejos
    fs.writeFileSync(path.join(dir, 'prestada_agotada_20261025'), '2026-10-15 10:00:00 sin saldo (credit balance is too low)\n');
    const conOtra = A.saldoPorClave({ dir, env: ENV, ahora: new Date(2026, 9, 16, 12, 0, 0) });
    expect(plan(conOtra)).toEqual(plan(conMarca));
    expect(conOtra.claves.filter((c) => c.nombre === 'prestada').map((c) => [c.hasta, c.gastadoUsd, c.agotada])).toEqual([['20261020', 100, false], ['20261025', 0, true]]);
  });
  it('recargada y vuelta a usar: lo que pago ya etiquetado no se le pasa al plan (el tope mira solo lo repartido sin etiqueta)', () => {
    ledger('2026-10', [fila('2026-10-10 22:00:00', 102.17), fila('2026-10-12 10:00:00', 20, 'prestada-20261020'), fila('2026-10-12 11:00:00', 5, 'principal')]);
    const s = A.saldoPorClave({ dir, env: ENV, ahora: new Date(2026, 9, 13, 12, 0, 0) });
    expect(s.claves).toEqual([
      { nombre: 'principal', gastadoUsd: 7.17, creditoUsd: 200, quedanUsd: 192.83 },
      { nombre: 'prestada', hasta: '20261020', gastadoUsd: 120, agotada: false, vencida: false },
    ]);
  });
  it('una linea con un texto raro en `clave` se trata como sin etiqueta: no abre una clave nueva en el resumen', () => {
    ledger('2026-10', [JSON.stringify({ ts: '2026-10-11 09:00:00', costoUsd: 3, clave: 'sk-ant-algo' }), fila('2026-10-11 09:01:00', 2, 'principal')]);
    const s = A.saldoPorClave({ dir, env: ENV, ahora: EL_11 });
    expect(s.estimado).toBe(true);
    expect(s.claves).toEqual([{ nombre: 'principal', gastadoUsd: 5, creditoUsd: 200, quedanUsd: 195 }]);
    expect(JSON.stringify(s)).not.toContain('sk-ant');
  });
  it('lo que queda nunca baja de cero, y solo cuenta el ciclo vigente (el gasto de antes del 30/09 no entra)', () => {
    ledger('2026-09', [fila('2026-09-29 23:00:00', 500, 'principal'), fila('2026-09-30 01:00:00', 20, 'principal')]);
    ledger('2026-10', [fila('2026-10-05 10:00:00', 190, 'principal')]);
    const s = A.saldoPorClave({ dir, env: ENV, ahora: EL_11 });
    expect(s.claves[0]).toEqual({ nombre: 'principal', gastadoUsd: 210, creditoUsd: 200, quedanUsd: 0 });
  });
  it('la renovable (se recarga el 20): pasada su fecha no figura vencida, y la marca de un ciclo anterior no la deja agotada (las dos direcciones)', () => {
    const el25nov = new Date(2026, 10, 25, 12, 0, 0);
    ledger('2026-11', [fila('2026-11-21 10:00:00', 12, 'prestada-20261020')]);
    const marca = path.join(dir, 'prestada_agotada_20261020');
    fs.writeFileSync(marca, '2026-10-11 02:21:34 sin saldo (credit balance is too low)\n');
    fs.utimesSync(marca, new Date(2026, 9, 11), new Date(2026, 9, 11));
    const viejo = A.saldoPorClave({ dir, env: ENV, ahora: el25nov });
    expect(viejo.claves.find((c) => c.nombre === 'prestada')).toEqual({ nombre: 'prestada', hasta: '20261020', gastadoUsd: 12, agotada: false, vencida: false });
    fs.utimesSync(marca, new Date(2026, 10, 22), new Date(2026, 10, 22));
    const nuevo = A.saldoPorClave({ dir, env: ENV, ahora: el25nov });
    expect(nuevo.claves.find((c) => c.nombre === 'prestada')).toMatchObject({ agotada: true, vencida: false });
    // gemelo: sin la tabla de renovables, la misma prestada el 25/11 figura vencida
    expect(A.saldoPorClave({ dir, env: ENV, ahora: el25nov, renueva: {} }).claves.find((c) => c.nombre === 'prestada').vencida).toBe(true);
  });
  it('una prestada vencida se marca vencida; BARACK_API_CREDITO_USD cambia el credito; la del entorno va aparte', () => {
    ledger('2026-10', [fila('2026-10-02 10:00:00', 5, 'prestada-20261005'), fila('2026-10-08 10:00:00', 7, 'entorno'), fila('2026-10-09 10:00:00', 40, 'principal')]);
    const s = A.saldoPorClave({ dir, env: { ...ENV, BARACK_API_CREDITO_USD: '100' }, ahora: EL_11 });
    expect(s.claves).toEqual([
      { nombre: 'principal', gastadoUsd: 40, creditoUsd: 100, quedanUsd: 60 },
      { nombre: 'prestada', hasta: '20261005', gastadoUsd: 5, agotada: false, vencida: true },
      { nombre: 'entorno', gastadoUsd: 7 },
    ]);
  });
  it('sin ledger no inventa nada: principal en cero con todo el credito', () => {
    const s = A.saldoPorClave({ dir, env: ENV, ahora: EL_11 });
    expect(s.estimado).toBe(false);
    expect(s.claves).toEqual([{ nombre: 'principal', gastadoUsd: 0, creditoUsd: 200, quedanUsd: 200 }]);
  });
  it('escribirSaldo deja en saldo.json lo mismo que devuelve saldoPorClave', () => {
    ledger('2026-10', [fila('2026-10-10 10:00:00', 3, 'principal')]);
    const s = A.escribirSaldo({ dir, env: ENV, ahora: EL_11 });
    expect(JSON.parse(fs.readFileSync(A.rutaSaldo(dir), 'utf8'))).toEqual(s);
  });
});
