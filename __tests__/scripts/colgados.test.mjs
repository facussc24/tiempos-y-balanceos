// colgados: lo que lance y lleva 10 minutos quieto a mitad de un turno se MIRA (04/10/2026: cuatro conversaciones del
// examen esperaron 55 minutos un cartel de permiso). Se prueba en las dos direcciones: lo quieto salta, lo que trabaja o
// termino no.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as C from '../../scripts/_lib/colgados.mjs';

const AHORA = Date.parse('2026-10-04T16:30:00.000Z');
const hace = (min) => new Date(AHORA - min * 60000).toISOString();
const linea = (o) => JSON.stringify(o);
const pide = (min, id = 't1', name = 'Glob', input = { path: 'Y:\\BARACK' }) => linea({ type: 'assistant', timestamp: hace(min), message: { stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name, input }] } });
const resultado = (min, id = 't1') => linea({ type: 'user', timestamp: hace(min), message: { content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } });
const cierra = (min) => linea({ type: 'assistant', timestamp: hace(min), message: { stop_reason: 'end_turn', content: [{ type: 'text', text: 'FIN DEL EXAMEN' }] } });
const mensaje = (min, texto = 'seguí') => linea({ type: 'user', timestamp: hace(min), message: { content: texto } });

describe('colgados — el estado de un registro', () => {
  it('QUIETA: pidio una herramienta hace 32 minutos y no tiene resultado (el cartel de permiso del 04/10)', () => {
    const e = C.estadoDe([mensaje(40), pide(32)], AHORA);
    expect(e).toMatchObject({ estado: 'espera_herramienta', quietaMin: 32 });
    expect(e.espera).toContain('Glob');
    expect(e.espera).toContain('BARACK');
  });

  it('QUIETA: llego el resultado de la herramienta hace 15 minutos y el modelo no contesto', () => {
    expect(C.estadoDe([pide(16), resultado(15)], AHORA)).toMatchObject({ estado: 'espera_modelo', quietaMin: 15 });
    expect(C.estadoDe([cierra(60), mensaje(12)], AHORA)).toMatchObject({ estado: 'espera_modelo', quietaMin: 12 });
  });

  it('NO salta: esta trabajando (hace menos de 10 minutos), termino el turno, o la freno la persona', () => {
    expect(C.estadoDe([mensaje(9), pide(3)], AHORA).estado).toBe('trabajando');
    expect(C.estadoDe([pide(50), resultado(49), cierra(48)], AHORA).estado).toBe('termino');
    expect(C.estadoDe([pide(50), linea({ type: 'user', timestamp: hace(20), message: { content: [{ type: 'text', text: '[Request interrupted by user for tool use]' }] } })], AHORA).estado).toBe('termino');
    expect(C.estadoDe([], AHORA).estado).toBe('vacio');
    expect(C.estadoDe(['no es json', '{"type":"otra"}'], AHORA).estado).toBe('vacio');
  });

  it('con dos herramientas pedidas a la vez dice la que quedo sin resultado; y el umbral se puede cambiar', () => {
    const dos = linea({ type: 'assistant', timestamp: hace(30), message: { content: [{ type: 'tool_use', id: 'a', name: 'Read', input: { file_path: 'x.md' } }, { type: 'tool_use', id: 'b', name: 'Glob', input: { path: 'Y:\\' } }] } });
    const e = C.estadoDe([dos, resultado(30, 'a')], AHORA);
    expect(e.estado).toBe('espera_herramienta');
    expect(e.espera).toMatch(/^Glob/);
    expect(C.estadoDe([pide(7)], AHORA, { minutos: 5 }).estado).toBe('espera_herramienta');
  });

  it('repaso con hora: no mira lo que paso despues (asi se repite el caso de las 13:30)', () => {
    const lineas = [pide(32), resultado(5), cierra(4)];
    expect(C.estadoDe(lineas, AHORA).estado).toBe('termino');
    expect(C.estadoDe(lineas, AHORA - 10 * 60000, { hastaMs: AHORA - 10 * 60000 })).toMatchObject({ estado: 'espera_herramienta', quietaMin: 22 });
  });
});

describe('colgados — recorrer las conversaciones y los agentes', () => {
  let raiz;
  beforeAll(() => {
    raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'colgados-'));
    const p = (...x) => path.join(raiz, ...x);
    fs.mkdirSync(p('C--ClaudeBarack-areas-produccion--claude-worktrees-x', 'sesion1', 'subagents'), { recursive: true });
    fs.mkdirSync(p('C--Dev-Otro'), { recursive: true });
    fs.writeFileSync(p('C--ClaudeBarack-areas-produccion--claude-worktrees-x', 'aaaaaaaa-1.jsonl'), [mensaje(40), pide(32)].join('\n'));
    fs.writeFileSync(p('C--ClaudeBarack-areas-produccion--claude-worktrees-x', 'sesion1', 'subagents', 'agent-bbbbbbbb.jsonl'), [pide(20, 'z', 'WebFetch', { url: 'https://x' })].join('\n'));
    fs.writeFileSync(p('C--Dev-Otro', 'cccccccc-3.jsonl'), [pide(50), resultado(49), cierra(48)].join('\n'));
    fs.writeFileSync(p('C--Dev-Otro', 'dddddddd-4.jsonl'), [mensaje(2), pide(1)].join('\n'));
  });
  afterAll(() => { fs.rmSync(raiz, { recursive: true, force: true }); });

  it('lista la conversacion y el agente quietos, del mas viejo al mas nuevo, y no lo que termino o trabaja', () => {
    const l = C.colgados({ raiz, ahoraMs: AHORA });
    expect(l.map((x) => `${x.clase}:${x.id.slice(0, 8)}:${x.quietaMin}`)).toEqual(['conversacion:aaaaaaaa:32', 'agente:agent-bb:20']);
    expect(l[0].texto).toContain('QUIETA hace 32 min');
    expect(l[0].texto).toContain('¿cartel de permiso?');
    expect(l[0].texto).toContain('ClaudeBarack-areas-produccion (copia de trabajo)');
  });

  it('el programa sale con 1 si hay algo para mirar, con 0 si no, y con 2 ante un argumento que no conoce', () => {
    const prog = path.join(process.cwd(), 'scripts', '_colgados.mjs');
    const correr = (...a) => spawnSync(process.execPath, [prog, '--raiz', raiz, ...a], { encoding: 'utf8' });
    const vacia = fs.mkdtempSync(path.join(os.tmpdir(), 'colgados-vacia-'));
    const limpio = spawnSync(process.execPath, [prog, '--raiz', vacia], { encoding: 'utf8' });
    expect(limpio.status).toBe(0);
    expect(limpio.stdout).toContain('nada quieto');
    fs.rmSync(vacia, { recursive: true, force: true });
    // con la hora de hoy los archivos de prueba dicen 2026-10-04: se repasa con --a (hora de esta PC)
    const d = new Date(AHORA);
    const a = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const r = correr('--a', a);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('2 para MIRAR ahora');
    expect(correr('--borrar-todo').status).toBe(2);
    expect(correr('--a', 'ayer').status).toBe(2);
  });
});
