// @vitest-environment node
/**
 * Tests de scripts/_lib/apiLotesBatch.mjs — las auditorias por lotes en Message Batches (tanda 5, 17/10/2026).
 *
 * Sin red: el cliente es un objeto falso con la forma del SDK ({ messages: { batches: { create, retrieve, results } } })
 * y el ledger va a una carpeta temporal (BARACK_API_DIR + dirLedger). Nada de esto llama a la API.
 *
 * Lo que mas importa: el id del lote queda en disco ANTES de esperar (un proceso que se cae no deja un lote pagado
 * sin recoger), recoger se hace UNA vez (otra vez duplicaria el ledger), y lo vencido no se guarda: queda para relanzar.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as B from '../../scripts/_lib/apiLotesBatch.mjs';
import * as A from '../../scripts/_lib/claudeApi.mjs';

let dir;
let raiz;
let salidaDir;
let apiDirPrevio;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apilotes-test-'));
  apiDirPrevio = process.env.BARACK_API_DIR;
  process.env.BARACK_API_DIR = dir;
  raiz = path.join(dir, 'repo');
  salidaDir = path.join(dir, 'salidas');
  fs.mkdirSync(raiz, { recursive: true });
  fs.writeFileSync(path.join(raiz, 'pedido.md'), 'Audita estos archivos y lista los hallazgos con archivo:linea.');
  fs.writeFileSync(path.join(raiz, 'a.mjs'), 'export const a = 1;\n');
  fs.writeFileSync(path.join(raiz, 'b.mjs'), 'export const b = 2;\n');
  fs.writeFileSync(path.join(raiz, 'c.mjs'), 'export const c = 3;\n');
});
afterEach(() => {
  if (apiDirPrevio === undefined) delete process.env.BARACK_API_DIR; else process.env.BARACK_API_DIR = apiDirPrevio;
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
});

const jobs = () => [
  { tarea: 'audit-01', pedido: 'pedido.md', adjuntos: ['a.mjs'], modelo: 'opus', effort: 'high' },
  { tarea: 'audit-02', pedido: 'pedido.md', adjuntos: ['b.mjs'], modelo: 'opus', effort: 'medium' },
  { tarea: 'audit-03', pedido: 'pedido.md', adjuntos: ['c.mjs'], modelo: 'opus' },
];

const mensaje = (texto, extra = {}) => ({
  id: `msg_${texto.length}`, model: 'claude-opus-5-5', stop_reason: 'end_turn',
  content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'text', text: texto }],
  usage: { input_tokens: 1_000_000, output_tokens: 100_000 },
  ...extra,
});

/** Un cliente de Batches falso: `estados` es la secuencia de processing_status que devuelve retrieve, y `resultados` lo que trae results. */
function clienteFalso({ estados = ['ended'], resultados = [] } = {}) {
  const llamadas = { create: [], retrieve: 0, results: 0 };
  let i = 0;
  const cliente = {
    messages: {
      batches: {
        create: async (cuerpo) => { llamadas.create.push(cuerpo); return { id: 'msgbatch_1', processing_status: 'in_progress' }; },
        retrieve: async (id) => { llamadas.retrieve++; const s = estados[Math.min(i++, estados.length - 1)]; return { id, processing_status: s }; },
        results: async () => { llamadas.results++; return (async function* gen() { for (const r of resultados) yield r; })(); },
      },
    },
  };
  return { cliente, llamadas };
}

const ledger = () => A.leerLedger(A.mesLocal(), dir);
const AHORA = new Date(2026, 9, 17, 9, 0, 0);

describe('apiLotesBatch · mandar', () => {
  it('crea el lote y deja _lote.json escrito ANTES de esperar (sin un solo retrieve)', async () => {
    const { cliente, llamadas } = clienteFalso();
    const { estado } = await B.mandarLote(cliente, { jobs: jobs(), salidaDir, raiz, tarea: 'audit', ahora: AHORA });
    expect(llamadas.retrieve).toBe(0);
    const enDisco = JSON.parse(fs.readFileSync(path.join(salidaDir, '_lote.json'), 'utf8'));
    expect(enDisco.loteId).toBe('msgbatch_1');
    expect(enDisco.recogido).toBeNull();
    expect(enDisco.pedidos.map((p) => p.id)).toEqual(['audit-01', 'audit-02', 'audit-03']);
    expect(estado.creadoMs).toBe(AHORA.getTime());
    const reqs = llamadas.create[0].requests;
    expect(reqs.map((r) => r.custom_id)).toEqual(['audit-01', 'audit-02', 'audit-03']);
    // los lotes no aceptan el fallback del servidor; el tope de salida sube a 64.000 (con 32.000 se cortaron 16 el 11/10)
    for (const r of reqs) { expect(r.params.fallbacks).toBeUndefined(); expect(r.params.max_tokens).toBe(B.MAX_TOKENS_LOTE); }
    expect(reqs.map((r) => r.params.output_config.effort)).toEqual(['high', 'medium', 'high']);
    expect(reqs[0].params.messages[0].content).toContain('<archivo ruta="a.mjs">');
  });

  it('con un lote sin recoger en la carpeta no manda otro (serian dos lotes pagados)', async () => {
    const { cliente, llamadas } = clienteFalso();
    await B.mandarLote(cliente, { jobs: jobs(), salidaDir, raiz, ahora: AHORA });
    await expect(B.mandarLote(cliente, { jobs: jobs(), salidaDir, raiz, ahora: AHORA })).rejects.toThrow(/sin recoger/);
    expect(llamadas.create).toHaveLength(1);
  });

  it('frena antes de pagar: una tarea que no sirve de id, un adjunto de secretos, dos tareas iguales', async () => {
    const { cliente, llamadas } = clienteFalso();
    await expect(B.mandarLote(cliente, { jobs: [{ tarea: 'con espacio', pedido: 'pedido.md' }], salidaDir, raiz })).rejects.toThrow(/no sirve como id/);
    fs.writeFileSync(path.join(raiz, '.env.local'), 'X=1');
    await expect(B.mandarLote(cliente, { jobs: [{ tarea: 't1', pedido: 'pedido.md', adjuntos: ['.env.local'] }], salidaDir, raiz })).rejects.toThrow(/secretos/);
    await expect(B.mandarLote(cliente, { jobs: [{ tarea: 't1', pedido: 'pedido.md' }, { tarea: 't1', pedido: 'pedido.md' }], salidaDir, raiz })).rejects.toThrow(/misma tarea/);
    expect(llamadas.create).toHaveLength(0);
    expect(fs.existsSync(path.join(salidaDir, '_lote.json'))).toBe(false);
  });

  it('crearLote rechaza un custom_id de mas de 64 caracteres', async () => {
    const { cliente } = clienteFalso();
    await expect(A.crearLote(cliente, [{ id: 'x'.repeat(65), modelo: 'haiku', usuario: 'hola' }])).rejects.toThrow(/custom_id/);
  });
});

describe('apiLotesBatch · recoger', () => {
  const resultadosMixtos = () => [
    { custom_id: 'audit-01', result: { type: 'succeeded', message: mensaje('hallazgo en a.mjs:1') } },
    { custom_id: 'audit-02', result: { type: 'expired' } },
    { custom_id: 'audit-03', result: { type: 'succeeded', message: mensaje('a medias', { stop_reason: 'max_tokens' }) } },
  ];

  it('en curso: no recoge, no toca el ledger, dice cuanto lleva', async () => {
    const { cliente, llamadas } = clienteFalso({ estados: ['in_progress'] });
    await B.mandarLote(cliente, { jobs: jobs(), salidaDir, raiz, ahora: AHORA });
    const r = await B.recogerGuardado(cliente, { salidaDir, ahora: new Date(AHORA.getTime() + 30 * 60000), dirLedger: dir });
    expect(r.estado).toBe('en_curso');
    expect(r.horas).toBe(0.5);
    expect(llamadas.results).toBe(0);
    expect(ledger()).toHaveLength(0);
    // pasadas las 24 h el aviso lo dice
    const tarde = await B.recogerGuardado(cliente, { salidaDir, ahora: new Date(AHORA.getTime() + 25 * 3600000), dirLedger: dir });
    expect(tarde.aviso).toMatch(/24 h/);
  });

  it('terminado: guarda lo bueno, NO guarda lo vencido ni lo cortado, y lo lista para relanzar; cobra la mitad', async () => {
    const { cliente } = clienteFalso({ estados: ['ended'], resultados: resultadosMixtos() });
    await B.mandarLote(cliente, { jobs: jobs(), salidaDir, raiz, ahora: AHORA });
    const r = await B.recogerGuardado(cliente, { salidaDir, ahora: AHORA, dirLedger: dir });
    expect(r.estado).toBe('recogido');
    expect(r.filas.map((f) => [f.id, f.resultado])).toEqual([['audit-01', 'ok'], ['audit-02', 'vencido'], ['audit-03', 'cortada_tirada']]);
    expect(r.relanzar).toEqual(['audit-02', 'audit-03']);
    expect(fs.readFileSync(path.join(salidaDir, 'audit-01.md'), 'utf8')).toBe('hallazgo en a.mjs:1\n');
    expect(fs.existsSync(path.join(salidaDir, 'audit-02.md'))).toBe(false);
    expect(fs.existsSync(path.join(salidaDir, 'audit-03.md'))).toBe(false);
    // dos respuestas pagadas (la cortada tambien se cobro), las dos como lote: 1M entrada + 100k salida de Opus = 4 + 2 = 6, la mitad 3
    const l = ledger();
    expect(l).toHaveLength(2);
    expect(l.every((e) => e.lote === true)).toBe(true);
    // cada pedido con su nombre y su effort: asi se comparan dos lotes iguales en high y en medium
    expect(l.map((e) => e.tarea)).toEqual(['sesion:audit-01@high', 'sesion:audit-03@high']);
    expect(r.costoUsd).toBeCloseTo(6, 6);
    const enDisco = JSON.parse(fs.readFileSync(path.join(salidaDir, '_lote.json'), 'utf8'));
    expect(enDisco.recogido).toBeTruthy();
    expect(enDisco.relanzar).toEqual(['audit-02', 'audit-03']);
  });

  it('una cortada con guardarCortada se guarda con el aviso arriba', async () => {
    const { cliente } = clienteFalso({ resultados: resultadosMixtos() });
    const j = jobs(); j[2].guardarCortada = true;
    await B.mandarLote(cliente, { jobs: j, salidaDir, raiz, ahora: AHORA });
    const r = await B.recogerGuardado(cliente, { salidaDir, ahora: AHORA, dirLedger: dir });
    expect(r.filas[2].resultado).toBe('cortada');
    expect(fs.readFileSync(path.join(salidaDir, 'audit-03.md'), 'utf8')).toMatch(/^> ⚠ RESPUESTA CORTADA/);
  });

  it('recoger dos veces se rechaza: el ledger no se duplica', async () => {
    const { cliente } = clienteFalso({ resultados: resultadosMixtos() });
    await B.mandarLote(cliente, { jobs: jobs(), salidaDir, raiz, ahora: AHORA });
    await B.recogerGuardado(cliente, { salidaDir, ahora: AHORA, dirLedger: dir });
    await expect(B.recogerGuardado(cliente, { salidaDir, ahora: AHORA, dirLedger: dir })).rejects.toThrow(/ya se recogio/);
    expect(ledger()).toHaveLength(2);
    // con --forzar pasa, sabiendo que duplica
    await B.recogerGuardado(cliente, { salidaDir, ahora: AHORA, dirLedger: dir, forzar: true });
    expect(ledger()).toHaveLength(4);
  });

  it('una recogida que se corto a mitad (recogiendo sin recogido) tambien se rechaza', async () => {
    const { cliente } = clienteFalso({ resultados: resultadosMixtos() });
    await B.mandarLote(cliente, { jobs: jobs(), salidaDir, raiz, ahora: AHORA });
    const ruta = path.join(salidaDir, '_lote.json');
    fs.writeFileSync(ruta, JSON.stringify({ ...JSON.parse(fs.readFileSync(ruta, 'utf8')), recogiendo: '2026-10-17 09:01:00' }));
    await expect(B.recogerGuardado(cliente, { salidaDir, ahora: AHORA, dirLedger: dir })).rejects.toThrow(/se corto a mitad/);
  });

  it('sin _lote.json, o con uno roto, no adivina', async () => {
    const { cliente } = clienteFalso();
    await expect(B.recogerGuardado(cliente, { salidaDir, dirLedger: dir })).rejects.toThrow(/no hay lote/);
    fs.mkdirSync(salidaDir, { recursive: true });
    fs.writeFileSync(path.join(salidaDir, '_lote.json'), '{roto');
    await expect(B.recogerGuardado(cliente, { salidaDir, dirLedger: dir })).rejects.toThrow(/no se puede leer/);
  });

  it('un lote que vencio entero: todo para relanzar y nada en el ledger', async () => {
    const vencido = jobs().map((j) => ({ custom_id: j.tarea, result: { type: 'expired' } }));
    const { cliente } = clienteFalso({ resultados: vencido });
    await B.mandarLote(cliente, { jobs: jobs(), salidaDir, raiz, ahora: AHORA });
    const r = await B.recogerGuardado(cliente, { salidaDir, ahora: AHORA, dirLedger: dir });
    expect(r.relanzar).toEqual(['audit-01', 'audit-02', 'audit-03']);
    expect(r.filas.every((f) => f.resultado === 'vencido')).toBe(true);
    expect(ledger()).toHaveLength(0);
    expect(r.costoUsd).toBe(0);
  });
});
