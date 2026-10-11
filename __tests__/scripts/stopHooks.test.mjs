// El cierre en un solo node (cola P10). Piezas dobles; el .sh se prueba con stop_hook_active.
// Las piezas REALES (cierreGuard, horaGuard) las exige stopHooks.gate.test.mjs.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { correr, normalizar } from '../../scripts/_lib/stopHooks.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');   // con jsdom, `new URL` no da una URL de Node
const SH = path.join(RAIZ, '.claude', 'hooks', 'stop-hooks.sh');
const pieza = (nombre, fn) => ({ nombre, fn });
const sinLog = { registrar: () => {} };

describe('normalizar', () => {
  it('entiende {rc}, {ok}, un numero y nada', () => {
    expect(normalizar({ rc: 2, stderr: ' frena ' })).toEqual({ rc: 2, stderr: 'frena' });
    expect(normalizar({ ok: false, stderr: 'x' })).toEqual({ rc: 2, stderr: 'x' });
    expect(normalizar({ ok: true })).toEqual({ rc: 0, stderr: '' });
    expect(normalizar(2)).toEqual({ rc: 2, stderr: '' });
    for (const v of [0, 1, null, 'texto']) expect(normalizar(v).rc).toBe(0);
  });
});

describe('stopHooks.correr', () => {
  it('VERDE: las dos dejan pasar -> exit 0 sin mensaje', async () => {
    expect(await correr({}, [pieza('cierre', () => ({ rc: 0 })), pieza('hora', () => 0)], sinLog)).toEqual({ rc: 0, stderr: '' });
  });
  it('ROJO: el cierre frena -> exit 2 con su mensaje, y hora-guard CORRE igual (ninguna corta a la otra)', async () => {
    let horaCorrio = false;
    const r = await correr({}, [pieza('cierre', () => ({ rc: 2, stderr: 'CIERRE-GUARD: falta la ruta' })), pieza('hora', () => { horaCorrio = true; return 0; })], sinLog);
    expect(r).toEqual({ rc: 2, stderr: 'CIERRE-GUARD: falta la ruta' }); expect(horaCorrio).toBe(true);
  });
  it('ROJO: las dos frenan -> 2 y los dos mensajes, en ese orden', async () => {
    const r = await correr({}, [pieza('cierre', () => ({ ok: false, stderr: 'A' })), pieza('hora', async () => ({ rc: 2, stderr: 'B' }))], sinLog);
    expect(r).toEqual({ rc: 2, stderr: 'A\n\nB' });
  });
  it('una pieza que tira deja pasar (como su .sh de antes) PERO queda en el log', async () => {
    const log = [];
    const piezas = [pieza('cierre', () => { throw new Error('boom'); }), pieza('hora', () => ({ rc: 2, stderr: 'B' }))];
    const r = await correr({ session_id: 'abcdefgh-1234' }, piezas, { registrar: (o) => log.push(o) });
    expect(r).toEqual({ rc: 2, stderr: 'B' });
    expect(log).toHaveLength(1); expect(log[0]).toMatchObject({ pieza: 'cierre', error: 'boom', sesion: 'abcdefgh' });
  });
});

describe('stop-hooks.sh', () => {
  const payload = { session_id: 'test-stop-hooks', stop_hook_active: true, last_assistant_message: 'Listo.', cwd: RAIZ };
  const correrSh = (env) => spawnSync('bash', [SH], { input: JSON.stringify(payload), encoding: 'utf8', env: { ...process.env, ...env } });
  it('VERDE: segundo Stop del mismo turno -> exit 0; la medicion deja inicio y fin con el mismo id y hook=stop-hooks', () => {
    const reg = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stop-hooks-')), 'tiempos.jsonl');
    expect(correrSh({ CLAUDE_HOOKS_TIEMPOS: reg }).status).toBe(0);
    const ev = fs.readFileSync(reg, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const inicio = ev.find((e) => e.ev === 'inicio'); const fin = ev.find((e) => e.ev === 'fin');
    expect(inicio.hook).toBe('stop-hooks'); expect(fin.hook).toBe('stop-hooks'); expect(fin.id).toBe(inicio.id); expect(fin.rc).toBe(0);
  });
  it('adentro de vitest y sin registro propio la medicion queda apagada: corre igual, exit 0 y bash no se queja', () => {
    const r = correrSh({ CLAUDE_HOOKS_TIEMPOS: '' });
    expect(r.status).toBe(0); expect(r.stderr).toBe('');
  });
});
