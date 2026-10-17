// @vitest-environment node
/**
 * Fable por la API solo si Fak lo pidio para esa tarea (api-claude.md §2; tanda 5 pieza 7, 17/10/2026). En la ola del
 * 11/10 Fable fue el 55 % del gasto y hasta este dia la puerta no lo controlaba: cualquier `modelo: 'fable'` pasaba y la
 * sintesis de _apiLotes.mjs lo usaba por defecto. Se prueba en las dos direcciones: sin la frase se frena ANTES de
 * mandar (tambien el conteo y los lotes); con la frase pasa y queda en la linea del ledger. Sin red.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as A from '../../scripts/_lib/claudeApi.mjs';
import { leerArgumentos as argsTarea } from '../../scripts/_apiTarea.mjs';
import { leerArgumentos as argsAgente } from '../../scripts/_agente.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FRASE = 'Fak 17/10 10:05: "para la sintesis usa fable"';

let dir;
let apiDirPrevio;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudeapi-fable-'));
  apiDirPrevio = process.env.BARACK_API_DIR;
  process.env.BARACK_API_DIR = dir;
});
afterEach(() => {
  if (apiDirPrevio === undefined) delete process.env.BARACK_API_DIR; else process.env.BARACK_API_DIR = apiDirPrevio;
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
});

const respuesta = (model) => ({ id: 'msg_f', model, stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 100, output_tokens: 10 } });
const cliente = (model, registro = []) => ({
  beta: { messages: { create: async (p) => { registro.push(p); return respuesta(model); } } },
  messages: { countTokens: async () => ({ input_tokens: 7 }) },
});
const ledger = () => A.leerLedger(A.mesLocal(), dir);

describe('Fable solo con la frase de Fak · la puerta', () => {
  it('sin frase (o con una de menos de 12 caracteres) se frena antes de armar el pedido; con frase pasa', () => {
    expect(() => A.armarParametros({ modelo: 'fable', usuario: 'x' })).toThrow(/solo si Fak lo pidio/);
    try { A.armarParametros({ modelo: 'fable', usuario: 'x', pedidoFable: 'si' }); } catch (e) { expect(e.tipo).toBe('fable'); }
    expect(() => A.armarParametros({ modelo: 'fable', usuario: 'x', pedidoFable: 'si' })).toThrow();
    expect(() => A.armarParametros({ modelo: 'claude-fable-5-1', usuario: 'x' })).toThrow(/Fable/);
    expect(A.armarParametros({ modelo: 'fable', usuario: 'x', pedidoFable: FRASE }).params.model).toBe('claude-fable-5-1');
    // los demas modelos no piden nada
    expect(() => A.armarParametros({ modelo: 'opus', usuario: 'x' })).not.toThrow();
  });

  it('llamar a Fable sin frase no llega al cliente (cero pedidos, cero ledger)', async () => {
    const reg = [];
    await expect(A.llamar(cliente('claude-fable-5-1', reg), { modelo: 'fable', usuario: 'x', tarea: 't', dirLedger: dir })).rejects.toThrow(/Fable/);
    expect(reg).toHaveLength(0);
    expect(ledger()).toHaveLength(0);
  });

  it('con la frase, la linea del ledger la lleva; en otro modelo el campo no va', async () => {
    await A.llamar(cliente('claude-fable-5-1'), { modelo: 'fable', usuario: 'x', tarea: 'sintesis', pedidoFable: FRASE, dirLedger: dir });
    await A.llamar(cliente('claude-opus-5-5'), { modelo: 'opus', usuario: 'x', tarea: 'otra', pedidoFable: FRASE, dirLedger: dir });
    const [f, o] = ledger();
    expect(f.pedidoFable).toBe(FRASE);
    expect(o.pedidoFable).toBeUndefined();
  });

  it('si se pidio Fable y el fallback del servidor contesto con otro modelo, la frase igual queda', async () => {
    await A.llamarLargo({ beta: { messages: { stream: () => ({ finalMessage: async () => respuesta('claude-opus-5-5') }) } } },
      { modelo: 'fable', usuario: 'x', tarea: 't', pedidoFable: FRASE, dirLedger: dir });
    expect(ledger()[0].pedidoFable).toBe(FRASE);
  });

  it('contar tokens de un pedido a Fable tambien pide la frase', async () => {
    await expect(A.contarTokens(cliente('x'), { modelo: 'fable', usuario: 'x' })).rejects.toThrow(/Fable/);
    expect(await A.contarTokens(cliente('x'), { modelo: 'fable', usuario: 'x', pedidoFable: FRASE })).toBe(7);
  });

  it('un lote con un pedido a Fable sin frase no se crea; con frase, la recogida la anota', async () => {
    let creados = 0;
    const c = {
      messages: {
        batches: {
          create: async () => { creados++; return { id: 'b1', processing_status: 'ended' }; },
          retrieve: async (id) => ({ id, processing_status: 'ended' }),
          results: async () => (async function* g() { yield { custom_id: 'f1', result: { type: 'succeeded', message: respuesta('claude-fable-5-1') } }; })(),
        },
      },
    };
    await expect(A.crearLote(c, [{ id: 'f1', modelo: 'fable', usuario: 'x' }])).rejects.toThrow(/Fable/);
    expect(creados).toBe(0);
    await A.lote(c, [{ id: 'f1', modelo: 'fable', usuario: 'x', pedidoFable: FRASE }], { dirLedger: dir, esperarMs: 1 });
    const l = ledger();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ lote: true, pedidoFable: FRASE });
  });

  it('la frase va al ledger recortada a 200 caracteres y sin saltos de linea', () => {
    const e = A.registrarGasto({ modelo: 'claude-fable-5-1', usage: {}, costoUsd: 0 }, { dir, pedidoFable: `Fak:\n${'x'.repeat(400)}` });
    expect(e.pedidoFable).toHaveLength(200);
    expect(e.pedidoFable).not.toMatch(/\n/);
  });
});

describe('Fable solo con la frase de Fak · los comandos', () => {
  it('_apiTarea.mjs --modelo fable sin --fable-pedido no arranca; con la frase, la lleva', () => {
    const base = ['--tarea', 't', '--pedido', 'p.md', '--salida', 's.md', '--modelo', 'fable'];
    expect(() => argsTarea(base)).toThrow(/Fable/);
    expect(argsTarea([...base, '--fable-pedido', FRASE]).pedidoFable).toBe(FRASE);
    expect(argsTarea(['--tarea', 't', '--pedido', 'p.md', '--salida', 's.md']).pedidoFable).toBeUndefined();
  });

  it('_agente.mjs --modelo fable sin --fable-pedido no arranca; con la frase, la lleva', () => {
    expect(() => argsAgente(['--encargo', 'e.md', '--modelo', 'fable'], {})).toThrow(/Fable/);
    expect(argsAgente(['--encargo', 'e.md', '--modelo', 'fable', '--fable-pedido', FRASE], {}).pedidoFable).toBe(FRASE);
  });

  it('la sintesis de _apiLotes.mjs va con Opus por defecto (era Fable) y pasa la frase si el jobs.json la trae', () => {
    const texto = fs.readFileSync(path.join(RAIZ, 'scripts/_apiLotes.mjs'), 'utf8');
    expect(texto).toMatch(/'--modelo', s\.modelo \|\| 'opus'/);
    expect(texto).not.toMatch(/s\.modelo \|\| 'fable'/);
    expect(texto).toMatch(/if \(s\.pedidoFable\) a\.push\('--fable-pedido', s\.pedidoFable\)/);
  });

  it('_claude.mjs --preguntar con --modelo fable exige --fable-pedido antes de llamar', () => {
    const texto = fs.readFileSync(path.join(RAIZ, 'scripts/_claude.mjs'), 'utf8');
    expect(texto).toMatch(/exigirPedidoFable\(resolverModelo\(op\['--modelo'\]\), op\['--fable-pedido'\]\)/);
  });
});
