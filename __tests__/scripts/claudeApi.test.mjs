// @vitest-environment node
/**
 * Tests de scripts/_lib/claudeApi.mjs — la unica puerta del repo a la API de Anthropic.
 *
 * Sin red y sin mocks de modulo: el cliente es un objeto falso con la misma forma que el del SDK
 * ({ beta: { messages: { create } } }), y el ledger va a una carpeta temporal. Tiene que pasar en el
 * CI (ubuntu, Node 20) sin .env.local ni clave: nada de esto llama a la API de verdad.
 *
 * Lo que mas importa: el costo sale de la tabla OFICIAL (el informe del 07/10 tenia mal Sonnet y los
 * cache reads), y una respuesta que no sirve (rechazo, cortada, JSON roto) TIRA en vez de seguir.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as A from '../../scripts/_lib/claudeApi.mjs';

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudeapi-test-')); });
afterEach(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

const respuesta = (extra = {}) => ({
  id: 'msg_1', model: 'claude-sonnet-5-5', stop_reason: 'end_turn',
  content: [{ type: 'text', text: '{"hallazgos":[]}' }],
  usage: { input_tokens: 1000, output_tokens: 200 },
  ...extra,
});
const clienteFalso = (res, registro = []) => ({
  beta: { messages: { create: async (p) => { registro.push(p); return typeof res === 'function' ? res(p) : res; } } },
});

describe('claudeApi · costo con la tabla oficial', () => {
  it('Opus 5.5: entrada, salida, lectura de cache y escritura de 5 min y de 1 h, cada una a su precio', () => {
    const u = { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 2000, cache_creation: { ephemeral_5m_input_tokens: 1000, ephemeral_1h_input_tokens: 1000 } };
    // 1000*4 + 500*20 + 2000*0.20 + 1000*5 + 1000*8 = 27.400 por millon
    expect(A.costoUsd('opus', u)).toBeCloseTo(0.0274, 6);
  });

  it('sin el desglose, la escritura de cache se cobra como de 5 minutos', () => {
    expect(A.costoUsd('sonnet', { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 1e6 })).toBeCloseTo(2.5, 6);
  });

  it('Haiku 5.5: tarifa corta hasta 100K tokens y larga por encima', () => {
    expect(A.costoUsd('haiku', { input_tokens: 50000, output_tokens: 1000 })).toBeCloseTo(0.0055, 6);
    expect(A.costoUsd('haiku', { input_tokens: 150000, output_tokens: 1000 })).toBeCloseTo(0.0775, 6);
  });

  it('Sonnet 5.5 es $2/$10 (no $3/$15 como decia el informe) y el lote cobra la mitad', () => {
    expect(A.costoUsd('sonnet', { input_tokens: 1e6, output_tokens: 1e6 })).toBeCloseTo(12, 6);
    expect(A.costoUsd('sonnet', { input_tokens: 1e6, output_tokens: 1e6 }, { lote: true })).toBeCloseTo(6, 6);
    expect(A.PRECIOS['claude-opus-5-5'].cacheLectura).toBe(0.20);
    expect(A.PRECIOS['claude-sonnet-5-5'].cacheLectura).toBe(0.10);
  });

  it('un modelo desconocido es error, no un costo cero', () => {
    expect(() => A.costoUsd('gpt', {})).toThrow(/modelo desconocido/);
    expect(A.resolverModelo('claude-haiku-5-5')).toBe('claude-haiku-5-5');
  });

  it('estimarUsd y usd con coma', () => {
    expect(A.estimarUsd('sonnet', { entrada: 100000, salida: 4000 })).toBeCloseTo(0.24, 6);
    expect(A.usd(1.234)).toBe('$1,23');
    expect(A.usd(0)).toBe('$0,00');
  });
});

describe('claudeApi · armar el pedido (puro)', () => {
  it('cache en el ULTIMO bloque del system, con el ttl pedido', () => {
    const { params } = A.armarParametros({ modelo: 'sonnet', system: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }], usuario: 'x', cacheTtl: '5m' });
    expect(params.system[0].cache_control).toBeUndefined();
    expect(params.system[1].cache_control).toEqual({ type: 'ephemeral' });
    const largo = A.armarParametros({ modelo: 'opus', system: 'texto', usuario: 'x', cacheTtl: '1h' });
    expect(largo.params.system).toEqual([{ type: 'text', text: 'texto', cache_control: { type: 'ephemeral', ttl: '1h' } }]);
  });

  it('effort y esquema van en output_config; sin thinking (adaptativo por defecto)', () => {
    const schema = { type: 'object', properties: {}, additionalProperties: false };
    const { params, conSchema } = A.armarParametros({ modelo: 'opus', usuario: 'x', effort: 'high', schema });
    expect(params.output_config).toEqual({ effort: 'high', format: { type: 'json_schema', schema } });
    expect(params.thinking).toBeUndefined();
    expect(conSchema).toBe(true);
    expect(params.max_tokens).toBe(16000);
  });

  it('Opus y Sonnet llevan el fallback del servidor con su beta; Haiku no lo tiene', () => {
    const opus = A.armarParametros({ modelo: 'opus', usuario: 'x' });
    expect(opus.params.fallbacks).toBe('default');
    expect(opus.betas).toEqual([A.BETA_FALLBACK]);
    const haiku = A.armarParametros({ modelo: 'haiku', usuario: 'x', fallbacks: true });
    expect(haiku.params.fallbacks).toBeUndefined();
    expect(haiku.betas).toEqual([]);
  });

  it('sin mensaje es error', () => {
    expect(() => A.armarParametros({ modelo: 'opus' })).toThrow(/falta `usuario`/);
  });
});

describe('claudeApi · interpretar la respuesta (puro)', () => {
  it('texto, JSON y costo', () => {
    const r = A.interpretarRespuesta(respuesta(), { conSchema: true });
    expect(r.texto).toBe('{"hallazgos":[]}');
    expect(r.json).toEqual({ hallazgos: [] });
    expect(r.costoUsd).toBeCloseTo((1000 * 2 + 200 * 10) / 1e6, 8);
    expect(r.rechazo).toBeNull();
  });

  it('refusal -> rechazo con su categoria; max_tokens -> truncado; JSON roto -> jsonInvalido', () => {
    const rech = A.interpretarRespuesta(respuesta({ stop_reason: 'refusal', stop_details: { category: 'cyber', explanation: 'x' }, content: [] }), { conSchema: true });
    expect(rech.rechazo).toEqual({ categoria: 'cyber', explicacion: 'x' });
    expect(rech.json).toBeNull();
    const cort = A.interpretarRespuesta(respuesta({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"hall' }] }), { conSchema: true });
    expect(cort.truncado).toBe(true);
    expect(cort.json).toBeNull();
    const roto = A.interpretarRespuesta(respuesta({ content: [{ type: 'text', text: 'no es json' }] }), { conSchema: true });
    expect(roto.jsonInvalido).toBe(true);
  });

  it('exigirRespuestaUtil: ROJO tira en los tres casos, VERDE devuelve la misma respuesta', () => {
    const base = A.interpretarRespuesta(respuesta(), { conSchema: true });
    expect(A.exigirRespuestaUtil(base)).toBe(base);
    expect(() => A.exigirRespuestaUtil({ ...base, rechazo: { categoria: 'bio' } })).toThrow(/rechazo/);
    expect(() => A.exigirRespuestaUtil({ ...base, truncado: true })).toThrow(/max_tokens/);
    expect(() => A.exigirRespuestaUtil({ ...base, jsonInvalido: true })).toThrow(/JSON/);
  });
});

describe('claudeApi · ledger y presupuesto', () => {
  it('registrarGasto -> leerLedger -> resumenLedger, y una linea rota no tumba la lectura', () => {
    const ahora = new Date(2026, 9, 8, 6, 31, 0);
    const r1 = { modelo: 'claude-sonnet-5-5', usage: { input_tokens: 1000, output_tokens: 100 }, costoUsd: 0.003, id: 'a' };
    const r2 = { modelo: 'claude-opus-5-5', usage: { input_tokens: 2000, output_tokens: 300 }, costoUsd: 0.014, id: 'b' };
    A.registrarGasto(r1, { tarea: 'preauditoria:revisor', dir, ahora });
    A.registrarGasto(r2, { tarea: 'preauditoria:refutador', dir, ahora });
    fs.appendFileSync(A.rutaLedger('2026-10', dir), '{roto\n');
    const entradas = A.leerLedger('2026-10', dir);
    expect(entradas).toHaveLength(2);
    expect(entradas[0].ts).toBe('2026-10-08 06:31:00');
    const res = A.resumenLedger(entradas);
    expect(res.llamadas).toBe(2);
    expect(res.totalUsd).toBeCloseTo(0.017, 6);
    expect(res.porModelo['claude-opus-5-5'].entrada).toBe(2000);
    expect(res.porTarea['preauditoria:revisor'].llamadas).toBe(1);
    expect(A.leerLedger('2026-11', dir)).toEqual([]);
  });

  it('semaforo verde / amarillo / rojo', () => {
    expect(A.estadoPresupuesto({ gastadoUsd: 10, presupuestoUsd: 100 }).semaforo).toBe('verde');
    expect(A.estadoPresupuesto({ gastadoUsd: 85, presupuestoUsd: 100 }).semaforo).toBe('amarillo');
    expect(A.estadoPresupuesto({ gastadoUsd: 100, presupuestoUsd: 100 }).semaforo).toBe('rojo');
    expect(A.presupuestoMensualUsd({ BARACK_API_PRESUPUESTO_USD: '200' })).toBe(200);
    expect(A.presupuestoMensualUsd({})).toBe(100);
  });

  it('presupuestoDelMes lee el ledger real del mes', () => {
    A.registrarGasto({ modelo: 'claude-opus-5-5', usage: {}, costoUsd: 90 }, { dir, ahora: new Date(2026, 9, 1) });
    const p = A.presupuestoDelMes({ mes: '2026-10', dir, env: {} });
    expect(p).toMatchObject({ mes: '2026-10', gastadoUsd: 90, semaforo: 'amarillo' });
  });

  it('fechas locales: mesLocal y selloLocal no se corren a UTC', () => {
    const f = new Date(2026, 9, 31, 23, 30, 5);
    expect(A.mesLocal(f)).toBe('2026-10');
    expect(A.selloLocal(f)).toBe('2026-10-31 23:30:05');
  });
});

describe('claudeApi · la clave', () => {
  it('leerClave: del entorno primero, si no de .env; nunca inventa una', () => {
    const env = path.join(dir, '.env.prueba');
    fs.writeFileSync(env, '# comentario\r\nVITE_X=1\r\nANTHROPIC_API_KEY=sk-ant-prueba\r\n');
    expect(A.leerClave({ env: {}, archivoEnv: env })).toBe('sk-ant-prueba');
    expect(A.leerClave({ env: { ANTHROPIC_API_KEY: 'sk-ant-entorno' }, archivoEnv: env })).toBe('sk-ant-entorno');
    expect(A.leerClave({ env: {}, archivoEnv: path.join(dir, 'no-existe') })).toBeNull();
    fs.writeFileSync(env, 'ANTHROPIC_API_KEY=\n');
    expect(A.leerClave({ env: {}, archivoEnv: env })).toBeNull();
  });

  it('el mensaje sin clave dice los tres pasos y el comando para pegarla', () => {
    expect(A.MENSAJE_SIN_CLAVE).toMatch(/Vincular organizacion/);
    expect(A.MENSAJE_SIN_CLAVE).toMatch(/--pegar-clave/);
  });
});

describe('claudeApi · llamar con un cliente falso', () => {
  it('manda los parametros armados (con la beta), devuelve el JSON y anota el gasto', async () => {
    const registro = [];
    const r = await A.llamar(clienteFalso(respuesta(), registro), { modelo: 'sonnet', usuario: 'x', schema: { type: 'object' }, tarea: 'prueba', dirLedger: dir, ahora: new Date(2026, 9, 8) });
    expect(registro[0].model).toBe('claude-sonnet-5-5');
    expect(registro[0].betas).toEqual([A.BETA_FALLBACK]);
    expect(r.json).toEqual({ hallazgos: [] });
    expect(A.leerLedger('2026-10', dir)).toHaveLength(1);
  });

  it('un rechazo TIRA (y igual queda anotado: se cobro); con tolerar devuelve la respuesta', async () => {
    const rech = respuesta({ stop_reason: 'refusal', stop_details: { category: 'cyber' }, content: [] });
    await expect(A.llamar(clienteFalso(rech), { modelo: 'opus', usuario: 'x', dirLedger: dir })).rejects.toMatchObject({ tipo: 'rechazo' });
    const t = await A.llamar(clienteFalso(rech), { modelo: 'opus', usuario: 'x', dirLedger: dir, tolerar: true });
    expect(t.rechazo.categoria).toBe('cyber');
    expect(A.leerLedger(A.mesLocal(), dir)).toHaveLength(2);
  });

  it('un error de red sale como ErrorApi "api"', async () => {
    const roto = { beta: { messages: { create: async () => { throw Object.assign(new Error('se corto'), { status: 529 }); } } } };
    await expect(A.llamar(roto, { modelo: 'haiku', usuario: 'x', registrar: false })).rejects.toMatchObject({ tipo: 'api', message: expect.stringMatching(/HTTP 529/) });
  });
});

describe('claudeApi · paralelo acotado y lotes', () => {
  it('enParalelo nunca pasa el tope y devuelve en orden', async () => {
    let enCurso = 0;
    let maximo = 0;
    const out = await A.enParalelo([1, 2, 3, 4, 5, 6, 7], 3, async (x) => {
      enCurso++; maximo = Math.max(maximo, enCurso);
      await new Promise((r) => setTimeout(r, 5 + (x % 3) * 3));
      enCurso--;
      return x * 10;
    });
    expect(maximo).toBeLessThanOrEqual(3);
    expect(out).toEqual([10, 20, 30, 40, 50, 60, 70]);
  });

  it('lote: espera a que termine (al segundo retrieve), recoge por id y cobra la mitad', async () => {
    let consultas = 0;
    const cliente = {
      messages: {
        batches: {
          create: async ({ requests }) => { expect(requests.map((r) => r.custom_id)).toEqual(['a', 'b']); expect(requests[0].params.fallbacks).toBeUndefined(); return { id: 'lote_1', processing_status: 'in_progress' }; },
          retrieve: async () => { consultas++; return { id: 'lote_1', processing_status: consultas >= 2 ? 'ended' : 'in_progress' }; },
          results: async () => (async function* gen() {
            yield { custom_id: 'b', result: { type: 'errored', error: { message: 'mal' } } };
            yield { custom_id: 'a', result: { type: 'succeeded', message: respuesta({ model: 'claude-haiku-5-5', content: [{ type: 'text', text: '{"ok":true}' }], usage: { input_tokens: 1e6, output_tokens: 0 } }) } };
          })(),
        },
      },
    };
    const { loteId, resultados } = await A.lote(cliente, [
      { id: 'a', modelo: 'haiku', usuario: 'x', schema: { type: 'object' } },
      { id: 'b', modelo: 'haiku', usuario: 'y' },
    ], { esperarMs: 1, dirLedger: dir });
    expect(loteId).toBe('lote_1');
    expect(consultas).toBe(2);
    expect(resultados.a.json).toEqual({ ok: true });
    expect(resultados.a.costoUsd).toBeCloseTo(0.25, 6);   // 1M de entrada de Haiku (tarifa de mas de 100K: $0,50) a mitad de precio
    expect(resultados.b.error).toBe('errored');
    expect(A.leerLedger(A.mesLocal(), dir)[0].lote).toBe(true);
  });

  it('un lote con ids repetidos no se manda', async () => {
    await expect(A.lote({}, [{ id: 'a', modelo: 'haiku', usuario: 'x' }, { id: 'a', modelo: 'haiku', usuario: 'y' }])).rejects.toMatchObject({ tipo: 'lote' });
  });
});
