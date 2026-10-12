// GATE del cableado de Stop (cola P10, plan §6.4): cierre-guard y hora-guard exponen correrStop(payload) -> {rc, stderr}
// sin leer stdin ni salir del proceso, y en el segundo Stop del mismo turno (stop_hook_active) las dos dejan pasar sin
// tirar. Mientras este archivo este rojo, stop-hooks.sh NO se cablea. Aparte de stopHooks.test.mjs por el mismo motivo
// que promptHooks.gate.test.mjs.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cargarPiezas } from '../../scripts/_lib/hookComun.mjs';
import { PIEZAS_REALES, correr } from '../../scripts/_lib/stopHooks.mjs';

describe('GATE stopHooks: las piezas reales', () => {
  it('cierre-guard y hora-guard exponen correrStop (si falla, al modulo nombrado le falta ese export)', async () => {
    const avisos = [];
    const piezas = await cargarPiezas(PIEZAS_REALES, { avisar: (m) => avisos.push(m) });
    expect(avisos).toEqual([]);
    expect(piezas.map((p) => p.nombre)).toEqual(['cierre-guard', 'hora-guard']);
  });
  it('segundo Stop del mismo turno: las dos corren, ninguna tira, rc 0 y sin mensaje', async () => {
    const piezas = await cargarPiezas(PIEZAS_REALES, { avisar: () => {} });
    const log = [];
    const r = await correr({ session_id: 'gate-stop-hooks', stop_hook_active: true, last_assistant_message: 'Listo.' }, piezas, { registrar: (o) => log.push(o) });
    expect(log).toEqual([]);
    expect(r).toEqual({ rc: 0, stderr: '' });
  }, 30000);
});

// Lo que faltaba para poder cablearlo (auditor, 11/10/2026): que el .sh FRENE de verdad (exit 2 con el aviso por
// stderr), y que siga frenando con los dos modulos de apoyo rotos (T1: con el import estatico salia con 1 y el turno
// terminaba sin el control del cierre ni el de la hora).
describe('stop-hooks.sh: el camino real (bash -> node)', () => {
  const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const correrSh = (sh, payload, cwd) => spawnSync('bash', [sh], { input: JSON.stringify(payload), encoding: 'utf8', cwd, env: { ...process.env, CLAUDE_HOOKS_TIEMPOS: 'off' } });
  /** Una copia minima: el .sh, stopHooks.mjs tal cual, y dos piezas de mentira (una frena, la otra deja pasar). */
  function copiaMinima({ romper = [] } = {}) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stop-hooks-'));
    fs.mkdirSync(path.join(tmp, '.claude', 'hooks'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'scripts', '_lib'), { recursive: true });
    fs.copyFileSync(path.join(RAIZ, '.claude', 'hooks', 'stop-hooks.sh'), path.join(tmp, '.claude', 'hooks', 'stop-hooks.sh'));
    for (const f of ['stopHooks.mjs', 'hookComun.mjs', 'hooksTiempos.mjs']) fs.copyFileSync(path.join(RAIZ, 'scripts', '_lib', f), path.join(tmp, 'scripts', '_lib', f));
    fs.writeFileSync(path.join(tmp, 'scripts', '_lib', 'cierreGuard.mjs'), "export const correrStop = async () => ({ rc: 2, stderr: 'FRENO DEL CIERRE' });\n");
    fs.writeFileSync(path.join(tmp, 'scripts', '_lib', 'horaGuard.mjs'), 'export const correrStop = async () => ({ rc: 0, stderr: \'\' });\n');
    for (const f of romper) fs.writeFileSync(path.join(tmp, 'scripts', '_lib', f), 'export const = ;\n');
    return tmp;
  }
  it('ROJO: una pieza que frena sale por el .sh con exit 2 y su aviso por stderr', () => {
    const tmp = copiaMinima();
    const r = correrSh(path.join(tmp, '.claude', 'hooks', 'stop-hooks.sh'), { hook_event_name: 'Stop', session_id: 'gate-sh', stop_hook_active: false }, tmp);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('FRENO DEL CIERRE');
  }, 30000);
  it.each([[['hooksTiempos.mjs']], [['hookComun.mjs']], [['hooksTiempos.mjs', 'hookComun.mjs']]])('ROJO: con %j roto sigue frenando (antes salia con 1 y el turno terminaba)', (romper) => {
    const tmp = copiaMinima({ romper });
    const r = correrSh(path.join(tmp, '.claude', 'hooks', 'stop-hooks.sh'), { hook_event_name: 'Stop', session_id: 'gate-sh-roto', stop_hook_active: false }, tmp);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('FRENO DEL CIERRE');
  }, 30000);
  // R12 del auditor: el medidor carga pero no trae `anotar`, o `anotar` tira, y ademas una pieza tira: la otra decide igual
  it.each([
    ['sin exportar anotar', 'export const otraCosa = 1;\n'],
    ['con un anotar que tira', "export function anotar() { throw new Error('disco lleno'); }\n"],
  ])('ROJO: con hooksTiempos.mjs %s y una pieza que tira, la otra frena igual', (nombre, medidor) => {
    const tmp = copiaMinima();
    fs.writeFileSync(path.join(tmp, 'scripts', '_lib', 'hooksTiempos.mjs'), medidor);
    fs.writeFileSync(path.join(tmp, 'scripts', '_lib', 'cierreGuard.mjs'), "export const correrStop = async () => { throw new Error('canon roto'); };\n");
    fs.writeFileSync(path.join(tmp, 'scripts', '_lib', 'horaGuard.mjs'), "export const correrStop = async () => ({ rc: 2, stderr: 'FRENO DE LA HORA' });\n");
    const r = correrSh(path.join(tmp, '.claude', 'hooks', 'stop-hooks.sh'), { hook_event_name: 'Stop', session_id: 'gate-sh-r12', stop_hook_active: false }, tmp);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('FRENO DE LA HORA');
  }, 30000);
  it('VERDE: si ninguna pieza frena sale con 0 y sin texto', () => {
    const tmp = copiaMinima();
    fs.writeFileSync(path.join(tmp, 'scripts', '_lib', 'cierreGuard.mjs'), "export const correrStop = async () => ({ rc: 0, stderr: '' });\n");
    const r = correrSh(path.join(tmp, '.claude', 'hooks', 'stop-hooks.sh'), { hook_event_name: 'Stop', session_id: 'gate-sh-verde' }, tmp);
    expect(r.status).toBe(0);
    expect(r.stderr).toBe('');
  }, 30000);
});
