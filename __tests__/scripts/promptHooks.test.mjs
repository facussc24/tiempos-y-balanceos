// El hook fusionado de UserPromptSubmit (cola P10) y la pieza "caracteristicas especiales" que salio del .sh inline.
// Sin red, sin Supabase: piezas dobles. Las piezas REALES las exige promptHooks.gate.test.mjs (aparte, para que un
// contrato que falta no tape estos verdes).
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cargarPiezas, esPrograma, parsearPayload } from '../../scripts/_lib/hookComun.mjs';
import { SEPARADOR, correr, textoDe } from '../../scripts/_lib/promptHooks.mjs';
import { atender, esAvisoAutomatico } from '../../scripts/_lib/caracteristicasEspecialesPrompt.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');   // con jsdom, `new URL` no da una URL de Node
const HOOKS = path.join(RAIZ, '.claude', 'hooks');
const pieza = (nombre, fn) => ({ nombre, fn });
const canon = { prompt_disparadores: [{ regex: '\\bcc\\b|caracteristica' }], recordatorio: ['R1', 'R2'] };
const MENSAJE_CC = 'esta caracteristica especial es CC o SC? mira el I-AC-005';
/** Corre un .sh de hooks con el payload por stdin; la medicion apagada (una prueba no es una corrida). */
const correrSh = (sh, payload) => spawnSync('bash', [path.join(HOOKS, sh)], { input: JSON.stringify(payload), encoding: 'utf8', env: { ...process.env, CLAUDE_HOOKS_TIEMPOS: 'off' } });

describe('caracteristicasEspecialesPrompt.atender (lo que hacia el .sh inline)', () => {
  it('VERDE: el mensaje nombra el tema -> el recordatorio', () => expect(atender({ prompt: 'esta CC es critica?' }, { canon })).toBe('R1\nR2'));
  it('ROJO: no lo nombra -> nada', () => expect(atender({ prompt: 'hola' }, { canon })).toBe(''));
  it('ROJO: un aviso automatico no es Fak, aunque nombre el tema', () => {
    expect(esAvisoAutomatico('<task-notification>x')).toBe(true);
    expect(atender({ prompt: ' <task-notification> cc critica' }, { canon })).toBe('');
  });
  it('ROJO: canon ilegible -> avisa por stderr y no inyecta', () => {
    const avisos = [];
    expect(atender({ prompt: 'CC' }, { canon: null, avisar: (m) => avisos.push(m) })).toBe('');
    expect(avisos.join('')).toMatch(/ilegible/);
  });
});

describe('textoDe', () => {
  it('acepta texto, objeto y el JSON de un hook', () => {
    expect(textoDe('hola ')).toBe('hola');
    expect(textoDe({ additionalContext: 'a' })).toBe('a');
    expect(textoDe(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: 'b' } }))).toBe('b');
  });
  it('nada -> vacio', () => { for (const v of [null, undefined, '', {}, 7, false]) expect(textoDe(v)).toBe(''); });
});

describe('promptHooks.correr', () => {
  it('VERDE: junta las piezas en orden, sobre el MISMO payload, en un solo JSON', async () => {
    const vistos = [];
    const piezas = [pieza('a', (p) => { vistos.push(p); return '[A] uno'; }), pieza('b', () => ''), pieza('c', async (p) => { vistos.push(p); return { additionalContext: '[C] tres' }; })];
    const payload = { prompt: 'x' };
    const out = await correr(payload, piezas);
    expect(out).toEqual({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: `[A] uno${SEPARADOR}[C] tres` } });
    expect(vistos).toHaveLength(2); expect(vistos.every((p) => p === payload)).toBe(true);   // leido una vez, compartido
  });
  it('ROJO: ninguna habla -> null (el hook no imprime nada)', async () => expect(await correr({}, [pieza('a', () => ''), pieza('b', () => null)])).toBeNull());
  it('ROJO: una pieza que tira no tumba a las demas, y avisa', async () => {
    const avisos = [];
    const out = await correr({}, [pieza('rota', () => { throw new Error('boom'); }), pieza('b', () => 'B')], { avisar: (m) => avisos.push(m) });
    expect(out.hookSpecificOutput.additionalContext).toBe('B');
    expect(avisos.join('')).toMatch(/rota fallo: boom/);
  });
});

describe('hookComun', () => {
  it('parsearPayload: JSON, o el texto crudo como prompt', () => {
    expect(parsearPayload('{"prompt":"a"}')).toEqual({ prompt: 'a' });
    expect(parsearPayload('crudo')).toEqual({ prompt: 'crudo' });
  });
  it('esPrograma: es el archivo que node arranco (en Windows sin importar la caja ni la forma /c/ del bash de Git)', () => {
    const yo = fileURLToPath(import.meta.url);
    expect(esPrograma(import.meta.url, yo)).toBe(true);
    expect(esPrograma(import.meta.url, path.join(path.dirname(yo), 'otro.mjs'))).toBe(false);
    expect(esPrograma(import.meta.url, '')).toBe(false);
    if (process.platform === 'win32' && /^[A-Za-z]:\\/.test(yo)) {
      expect(esPrograma(import.meta.url, yo.toLowerCase())).toBe(true);
      expect(esPrograma(import.meta.url, `/${yo[0].toLowerCase()}/${yo.slice(3).replace(/\\/g, '/')}`)).toBe(true);
    }
  });
  it('VERDE: cargarPiezas carga la que existe', async () => {
    const piezas = await cargarPiezas([{ nombre: 'x', modulo: 'm', exportacion: 'f' }], { importar: async () => ({ f: () => 'ok' }), avisar: () => {} });
    expect(piezas).toHaveLength(1); expect(piezas[0].fn()).toBe('ok');
  });
  it('ROJO: la que no exporta queda apagada con aviso; las otras cargan', async () => {
    const avisos = [];
    const tabla = [{ nombre: 'x', modulo: 'm', exportacion: 'noExiste' }, { nombre: 'y', modulo: 'm', exportacion: 'f' }];
    const piezas = await cargarPiezas(tabla, { importar: async () => ({ f: () => 1 }), avisar: (m) => avisos.push(m) });
    expect(piezas.map((p) => p.nombre)).toEqual(['y']); expect(avisos.join('')).toMatch(/x apagada: no exporta noExiste/);
  });
});

describe('prompt-hooks.sh', () => {
  it('VERDE: un mensaje que nombra CC/SC sale con el recordatorio, en un solo JSON', () => {
    const r = correrSh('prompt-hooks.sh', { session_id: 'test-prompt-hooks', cwd: RAIZ, prompt: MENSAJE_CC });
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
    expect(out.hookSpecificOutput.additionalContext.length).toBeGreaterThan(20);
  });
  it('ROJO: un aviso automatico no recibe el recordatorio', () => {
    const r = correrSh('prompt-hooks.sh', { session_id: 'test-prompt-hooks', cwd: RAIZ, prompt: '<task-notification> CC SC I-AC-005' });
    expect(r.status).toBe(0);
    expect(r.stdout).not.toMatch(/I-AC-005/);
  });
});

describe('caracteristicas-especiales-prompt.sh (wrapper suelto del modulo; cableado hasta C2)', () => {
  it('VERDE: el mismo JSON de siempre, nada por stderr', () => {
    const r = correrSh('caracteristicas-especiales-prompt.sh', { session_id: 'test-ce-prompt', prompt: MENSAJE_CC });
    expect(r.status).toBe(0); expect(r.stderr).toBe('');
    const out = JSON.parse(r.stdout);
    expect(out.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
    expect(out.hookSpecificOutput.additionalContext.length).toBeGreaterThan(20);
  });
  it('ROJO: sin el tema no imprime nada', () => {
    const r = correrSh('caracteristicas-especiales-prompt.sh', { prompt: 'hola' });
    expect(r.status).toBe(0); expect(r.stdout).toBe(''); expect(r.stderr).toBe('');
  });
});
