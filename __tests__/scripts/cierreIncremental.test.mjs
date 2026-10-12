// __tests__/scripts/cierreIncremental.test.mjs
// @vitest-environment node
/**
 * Plan P9, C1: la lectura de a tramos del registro (scripts/_lib/cierreIncremental.mjs) da lo MISMO que la pasada
 * completa (`relevarTranscript`) en cada cierre, y cuando lo guardado no sirve vuelve a la completa.
 * La prueba sobre registros reales es scripts/_cierreIncrementalIgualdad.mjs (en el CI no hay registros).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { relevarTranscript } from '../../scripts/_lib/cierreGuard.mjs';
import { relevarIncremental, ultimaLectura, dirEstado } from '../../scripts/_lib/cierreIncremental.mjs';

const T = (min) => new Date(Date.UTC(2026, 9, 12, 12, 0) + min * 60000).toISOString();
const fak = (min, texto) => ({ type: 'user', timestamp: T(min), message: { role: 'user', content: texto } });
const uso = (min, id, name, input) => ({ type: 'assistant', timestamp: T(min), message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } });
const res = (min, id, extra = {}) => ({ type: 'user', timestamp: T(min), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok', ...extra }] } });
const renglones = (filas) => filas.map((f) => `${JSON.stringify(f)}\n`).join('');

let raiz; let n = 0;
beforeAll(() => { raiz = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-c1-'))); });
afterAll(() => { try { fs.rmSync(raiz, { recursive: true, force: true }); } catch { /* temporal */ } });

function caso() {
  const dir = path.join(raiz, `c${++n}`);
  fs.mkdirSync(path.join(dir, 'repo'), { recursive: true });
  const repo = path.join(dir, 'repo');
  const tp = path.join(dir, 'ses.jsonl');
  const env = { ...process.env, CIERRE_ESTADO_DIR: path.join(dir, 'estado') };
  const sub = (nombre) => { const d = path.join(dir, 'ses', 'subagents'); fs.mkdirSync(d, { recursive: true }); return path.join(d, `${nombre}.jsonl`); };
  return { dir, repo, tp, env, sub };
}
const plano = (r) => JSON.stringify(r, (k, v) => (v instanceof Set ? [...v].sort() : v === Infinity ? 'Inf' : v));
async function igual(c) {
  const a = await relevarTranscript(c.tp, { repo: c.repo });
  const b = await relevarIncremental(c.tp, { repo: c.repo, env: c.env });
  expect(plano(b)).toBe(plano(a));
  return ultimaLectura();
}

const turno1 = [fak(0, 'armame la hoja'), uso(1, 'w1', 'Write', { file_path: 'D:\\Entregas\\hoja.pdf', content: 'x' }), res(1, 'w1')];
const turno2 = [fak(10, 'y revisala'), uso(11, 'r1', 'Read', { file_path: 'D:\\Entregas\\hoja.pdf' }), res(11, 'r1'),
  uso(12, 'b1', 'Bash', { command: 'python scripts/gen.py' })];
const turno3 = [res(13, 'b1'), fak(20, 'gracias')];

describe('C1 · de a tramos = completa', () => {
  it('verde: la primera lee entero, la segunda no lee nada, y crecer de a turnos da lo mismo en cada cierre', async () => {
    const c = caso();
    fs.writeFileSync(c.tp, renglones(turno1));
    expect((await igual(c)).motivo).toBe('sin estado');
    const u = await igual(c);
    expect(u).toMatchObject({ modo: 'incremental', bytes: 0 });
    fs.appendFileSync(c.tp, renglones(turno2));
    expect((await igual(c)).modo).toBe('incremental');
    fs.appendFileSync(c.tp, renglones(turno3));
    const u3 = await igual(c);
    expect(u3.modo).toBe('incremental');
    expect(u3.bytes).toBe(Buffer.byteLength(renglones(turno3)));   // solo lo nuevo, en bytes
  });

  it('verde: un renglon a medio escribir no se guarda; uno entero sin su \\n cuenta igual que en la completa', async () => {
    const c = caso();
    fs.writeFileSync(c.tp, renglones(turno1));
    await igual(c);
    const ultimo = JSON.stringify(fak(30, 'esto es lo último que escribió Fak'));
    fs.appendFileSync(c.tp, ultimo.slice(0, 25));                    // cortado: no es JSON
    await igual(c);
    fs.appendFileSync(c.tp, ultimo.slice(25));                       // entero, sin \n
    const r = await relevarIncremental(c.tp, { repo: c.repo, env: c.env });
    expect(r.ultimoMensajeFak).toBe('esto es lo último que escribió Fak');
    await igual(c);
    fs.appendFileSync(c.tp, `\n${renglones([uso(31, 'x1', 'Read', { file_path: 'C:\\a.pdf' })])}`);
    expect((await igual(c)).modo).toBe('incremental');
  });

  it('verde: tildes y ñ (bytes y no caracteres) no corren el corte', async () => {
    const c = caso();
    fs.writeFileSync(c.tp, renglones([fak(0, 'acá va la señal: ñandú, camión, pingüino'), ...turno1.slice(1)]));
    await igual(c);
    fs.appendFileSync(c.tp, renglones([fak(5, 'otra más con tildes: corrección')]));
    expect((await igual(c)).modo).toBe('incremental');
  });

  it('verde: un subagente que aparece despues, y otro que crece, se leen de a tramos', async () => {
    const c = caso();
    fs.writeFileSync(c.tp, renglones(turno1));
    await igual(c);
    const s1 = c.sub('agent-a1');
    fs.writeFileSync(s1, renglones([uso(2, 's1', 'Write', { file_path: path.join(c.repo, 'nota.md'), content: 'x' }), res(2, 's1')]));
    expect((await igual(c)).modo).toBe('incremental');
    fs.appendFileSync(s1, renglones([uso(3, 's2', 'Read', { file_path: 'C:\\x\\hoja.pdf' })]));
    fs.appendFileSync(c.tp, renglones(turno2));
    await igual(c);
    fs.appendFileSync(s1, renglones([res(14, 's2')]));
    expect((await igual(c)).modo).toBe('incremental');
  });
});

describe('C1 · cuando lo guardado no sirve, la completa', () => {
  it('rojo: el registro achica (compactacion) -> de cero', async () => {
    const c = caso();
    fs.writeFileSync(c.tp, renglones([...turno1, ...turno2]));
    await igual(c);
    fs.writeFileSync(c.tp, renglones(turno1));
    expect(await igual(c)).toMatchObject({ modo: 'completa', motivo: 'un archivo achico' });
  });

  it('rojo: cambia lo ya leido con el mismo largo (otra sesion con el mismo id) -> de cero', async () => {
    const c = caso();
    fs.writeFileSync(c.tp, renglones([fak(0, 'hola uno'), ...turno1.slice(1)]));
    await igual(c);
    const otro = renglones([fak(0, 'hola dos'), ...turno1.slice(1)]);
    fs.writeFileSync(c.tp, `${otro}${renglones([fak(9, 'sigue')])}`);
    expect(await igual(c)).toMatchObject({ modo: 'completa', motivo: 'un archivo cambio lo ya leido' });
  });

  it('rojo: desaparece un subagente ya leido -> de cero', async () => {
    const c = caso();
    fs.writeFileSync(c.tp, renglones(turno1));
    const s1 = c.sub('agent-a1');
    fs.writeFileSync(s1, renglones([uso(2, 's1', 'Write', { file_path: path.join(c.repo, 'nota.md'), content: 'x' }), res(2, 's1')]));
    await igual(c);
    fs.unlinkSync(s1);
    expect(await igual(c)).toMatchObject({ modo: 'completa', motivo: 'desaparecio un archivo' });
  });

  it('rojo: lo guardado esta roto -> completa, y la vez siguiente vuelve a ir de a tramos', async () => {
    const c = caso();
    fs.writeFileSync(c.tp, renglones(turno1));
    await igual(c);
    for (const f of fs.readdirSync(c.env.CIERRE_ESTADO_DIR)) fs.writeFileSync(path.join(c.env.CIERRE_ESTADO_DIR, f), 'basura');
    expect((await igual(c)).modo).toBe('completa');
    expect((await igual(c)).modo).toBe('incremental');
  });

  it('rojo: con el archivo OFF no se usa lo guardado', async () => {
    const c = caso();
    fs.writeFileSync(c.tp, renglones(turno1));
    await igual(c);
    fs.writeFileSync(path.join(c.env.CIERRE_ESTADO_DIR, 'OFF'), '');
    expect(await igual(c)).toMatchObject({ modo: 'completa', motivo: 'OFF' });
  });

  it('el mismo registro con otro repo no comparte estado (los tocados son relativos al repo)', async () => {
    const c = caso();
    fs.writeFileSync(c.tp, renglones([fak(0, 'x'), uso(1, 'w', 'Write', { file_path: path.join(c.repo, 'a.md'), content: 'x' }), res(1, 'w')]));
    await igual(c);
    const otro = { ...c, repo: path.join(c.dir, 'otro') };
    fs.mkdirSync(otro.repo, { recursive: true });
    expect((await igual(otro)).motivo).toBe('sin estado');
  });

  it('sin registro, o adentro de vitest sin carpeta propia, no guarda nada', async () => {
    expect(dirEstado({ VITEST: 'true' })).toBe(null);
    expect(dirEstado({ VITEST: 'true', CIERRE_ESTADO_DIR: 'off' })).toBe(null);
    expect(dirEstado({ CIERRE_ESTADO_DIR: 'C:\\x' })).toBe('C:\\x');
    expect(dirEstado({})).toBe(path.join(os.tmpdir(), 'claude-cierre-guard'));
    expect(await relevarIncremental('', {})).toEqual({ fuera: false });
    expect(await relevarIncremental(path.join(raiz, 'no-existe.jsonl'), { env: { CIERRE_ESTADO_DIR: path.join(raiz, 'e') } })).toEqual({ fuera: false });
  });
});
