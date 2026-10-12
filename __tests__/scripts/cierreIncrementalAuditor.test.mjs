// __tests__/scripts/cierreIncrementalAuditor.test.mjs
// @vitest-environment node
/**
 * Los 7 casos que pidio el auditor Opus del 12/10/2026 (.sgc-cache/auditorias/P9_C1_auditor_2026-10-12.md) para la
 * lectura de a tramos: cada uno mata un mutante que la suite del autor dejaba vivo (M1 a M7), y R1 (no guardar si el
 * codigo cambio con el proceso andando).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import v8 from 'node:v8';
import { relevarTranscript } from '../../scripts/_lib/cierreGuard.mjs';
import { relevarIncremental, ultimaLectura, versionCodigo, codigoCambioAlCorrer } from '../../scripts/_lib/cierreIncremental.mjs';

const T = (min) => new Date(Date.UTC(2026, 9, 12, 12, 0) + min * 60000).toISOString();
const MS = (min) => Date.parse(T(min));
const fak = (min, texto) => ({ type: 'user', timestamp: T(min), message: { role: 'user', content: texto } });
const uso = (min, id, name, input) => ({ type: 'assistant', timestamp: T(min), message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } });
const res = (min, id) => ({ type: 'user', timestamp: T(min), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } });
const renglones = (filas) => filas.map((f) => `${JSON.stringify(f)}\n`).join('');

let raiz; let n = 0;
beforeAll(() => { raiz = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-c1aud-'))); });
afterAll(() => { try { fs.rmSync(raiz, { recursive: true, force: true }); } catch { /* temporal */ } });

function caso() {
  const dir = path.join(raiz, `c${++n}`);
  const repo = path.join(dir, 'repo');
  fs.mkdirSync(repo, { recursive: true });
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
  return { ...ultimaLectura(), r: b };
}

describe('auditor 12/10 · version del codigo (M1) y R1', () => {
  const armar = (nombre, data) => {
    const d = path.join(raiz, nombre); fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'a.mjs'), 'export const a = 1;');
    fs.writeFileSync(path.join(d, 'x.data.json'), data);
    const fija = new Date('2026-10-01T10:00:00Z');
    for (const f of fs.readdirSync(d)) fs.utimesSync(path.join(d, f), fija, fija);
    return d;
  };
  it('M1: cambia el tamaño de un .data.json -> otra version; un .x.mjs agregado no la cambia; una copia identica da la misma', () => {
    const a = armar('v-a', '{"a":1}'); const b = armar('v-b', '{"a":12}'); const c = armar('v-c', '{"a":1}');
    expect(versionCodigo(a)).not.toBe(versionCodigo(b));
    expect(versionCodigo(c)).toBe(versionCodigo(a));
    const d = armar('v-d', '{"a":1}');
    fs.writeFileSync(path.join(d, '.oraculo.mjs'), 'x');
    expect(versionCodigo(d)).toBe(versionCodigo(a));
  });
  it('R1: un archivo de hace una hora no cuenta como cambio; uno tocado ahora, si', () => {
    const viejo = armar('r1-viejo', '{}');
    expect(codigoCambioAlCorrer(viejo, Date.now())).toBe(false);
    const nuevo = armar('r1-nuevo', '{}');
    const ahora = new Date();
    fs.utimesSync(path.join(nuevo, 'a.mjs'), ahora, ahora);
    expect(codigoCambioAlCorrer(nuevo, Date.now() - 1000)).toBe(true);
  });
});

describe('auditor 12/10 · lo guardado (M2 a M5)', () => {
  it('M2: un cambio en el ULTIMO renglon ya leido (mismo largo) se ve por la huella de la cola', async () => {
    const c = caso();
    const filas = [fak(0, 'arranca')];
    for (let i = 0; i < 60; i++) filas.push(uso(1, `w${i}`, 'Write', { file_path: path.join(c.repo, `zz-${String(i).padStart(3, '0')}.md`), content: 'x'.repeat(200) }));
    fs.writeFileSync(c.tp, renglones(filas));
    expect(fs.statSync(c.tp).size).toBeGreaterThan(12 * 1024);
    await igual(c);
    fs.writeFileSync(c.tp, fs.readFileSync(c.tp, 'utf8').replace('zz-059.md', 'yy-059.md') + renglones([fak(5, 'sigue')]));
    const u = await igual(c);
    expect(u.motivo).toBe('un archivo cambio lo ya leido');
  });

  it('M3: un renglon que hace tirar a la pasada (un null adentro del contenido) cae a la completa, con el mismo resultado', async () => {
    const c = caso();
    fs.writeFileSync(c.tp, renglones([fak(0, 'arranca')]));
    const s = c.sub('agent-roto');
    const roto = { type: 'assistant', timestamp: T(2), message: { role: 'assistant', content: [null, { type: 'tool_use', id: 'x', name: 'Write', input: { file_path: path.join(c.repo, 'b.md'), content: 'x' } }] } };
    fs.writeFileSync(s, renglones([uso(1, 'a', 'Write', { file_path: path.join(c.repo, 'a.md'), content: 'x' }), roto, uso(3, 'c', 'Write', { file_path: path.join(c.repo, 'c.md'), content: 'x' })]));
    const u = await igual(c);
    expect(u.motivo).toMatch(/^error:/);
    expect([...u.r.tocados]).toContain('a.md');
    expect([...u.r.tocados]).not.toContain('c.md');
  });

  it('M4: lo guardado con otra version no se usa', async () => {
    const c = caso();
    fs.writeFileSync(c.tp, renglones([fak(0, 'arranca')]));
    await igual(c);
    const f = path.join(c.env.CIERRE_ESTADO_DIR, fs.readdirSync(c.env.CIERRE_ESTADO_DIR).find((x) => x.endsWith('.bin')));
    const d = v8.deserialize(fs.readFileSync(f)); d.version = 'otra';
    fs.writeFileSync(f, v8.serialize(d));
    const u = await igual(c);
    expect(u).toMatchObject({ modo: 'completa', motivo: 'estado de otra version' });
  });

  it('M5: el renglon pendiente reescrito con el mismo largo y otra fecha se vuelve a leer', async () => {
    const c = caso();
    const pend = (nombre) => JSON.stringify(uso(1, 'w', 'Write', { file_path: path.join(c.repo, nombre), content: 'x' }));
    const base = renglones([fak(0, 'arranca')]);
    fs.writeFileSync(c.tp, base + pend('aaaa.md'));
    await igual(c);
    fs.writeFileSync(c.tp, base + pend('bbbb.md'));
    const despues = new Date(Date.now() + 10_000);
    fs.utimesSync(c.tp, despues, despues);
    const u = await igual(c);
    expect([...u.r.tocados]).toContain('bbbb.md');
  });
});

describe('auditor 12/10 · semantica de a tramos (M6, M7)', () => {
  it('M6: una mirada abierta de un subagente sobrevive a un mensaje de Fak que llega en el cierre siguiente', async () => {
    const c = caso();
    fs.writeFileSync(c.tp, renglones([fak(0, 'arranca')]));
    const s = c.sub('agent-a1');
    fs.writeFileSync(s, renglones([uso(5, 'r1', 'Read', { file_path: 'C:\\x\\hoja.pdf' })]));
    await igual(c);
    fs.appendFileSync(c.tp, renglones([fak(10, 'y la hoja?')]));
    fs.appendFileSync(s, renglones([res(12, 'r1')]));
    const u = await igual(c);
    expect(u.r.miradas).toEqual([{ txt: 'c:/x/hoja.pdf', ts: MS(12), esRead: true }]);
  });

  it('M7: los subagentes no corren el contador de los entregables del principal', async () => {
    const c = caso();
    fs.writeFileSync(c.tp, renglones([fak(0, 'armalos'), uso(1, 'w1', 'Write', { file_path: 'D:\\Entregas\\uno.pdf', content: 'x' })]));
    fs.writeFileSync(c.sub('agent-a1'), renglones([uso(1, 'b1', 'Bash', { command: 'ls' })]));
    await igual(c);
    fs.appendFileSync(c.tp, renglones([uso(2, 'w2', 'Write', { file_path: 'D:\\Entregas\\dos.pdf', content: 'x' })]));
    const u = await igual(c);
    const dos = u.r.entregables.find((e) => /dos\.pdf$/i.test(e.nombre));
    expect(dos).toBeTruthy();
    expect(dos.escritoEn).toBe(2);
  });
});
