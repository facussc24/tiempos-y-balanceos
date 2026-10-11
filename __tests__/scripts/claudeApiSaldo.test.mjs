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
    const s = A.saldoPorClave({ dir, env: ENV, ahora: EL_11 });
    expect(s.estimado).toBe(true);
    expect(s.claves).toEqual([
      { nombre: 'principal', gastadoUsd: 155.89, creditoUsd: 200, quedanUsd: 44.11 },
      { nombre: 'prestada', hasta: '20261020', gastadoUsd: 107.04, agotada: true, vencida: false },
    ]);
  });
  it('sin ninguna marca, una linea sin etiqueta es de la principal (y sigue siendo estimado)', () => {
    ledger('2026-10', [fila('2026-10-10 22:00:00', 12)]);
    const s = A.saldoPorClave({ dir, env: ENV, ahora: EL_11 });
    expect(s.estimado).toBe(true);
    expect(s.claves).toEqual([{ nombre: 'principal', gastadoUsd: 12, creditoUsd: 200, quedanUsd: 188 }]);
  });
  it('lo que queda nunca baja de cero, y solo cuenta el ciclo vigente (el gasto de antes del 30/09 no entra)', () => {
    ledger('2026-09', [fila('2026-09-29 23:00:00', 500, 'principal'), fila('2026-09-30 01:00:00', 20, 'principal')]);
    ledger('2026-10', [fila('2026-10-05 10:00:00', 190, 'principal')]);
    const s = A.saldoPorClave({ dir, env: ENV, ahora: EL_11 });
    expect(s.claves[0]).toEqual({ nombre: 'principal', gastadoUsd: 210, creditoUsd: 200, quedanUsd: 0 });
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
