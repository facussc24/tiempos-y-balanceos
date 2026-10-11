// GATE del cableado de UserPromptSubmit (cola P10, plan §3.1): las cuatro piezas reales exponen el contrato que
// promptHooks.mjs espera (atender / atenderPrompt), sobre un mensaje inocente ninguna tira ni habla, y en el .sh con un
// mensaje de explicar sale UN solo JSON y nada por stderr (ninguna pieza escribe sola a stdout). Mientras este archivo
// este rojo, prompt-hooks.sh NO se cablea. Va aparte de promptHooks.test.mjs para que un contrato que falta no tape los
// tests del orquestador (dobles), que tienen que seguir verdes.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cargarPiezas } from '../../scripts/_lib/hookComun.mjs';
import { PIEZAS_REALES, correr } from '../../scripts/_lib/promptHooks.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');   // con jsdom, `new URL` no da una URL de Node
const SH = path.join(RAIZ, '.claude', 'hooks', 'prompt-hooks.sh');

describe('GATE promptHooks: las piezas reales', () => {
  it('las cuatro cargan con el export del contrato (si falla, al modulo nombrado le falta ese export)', async () => {
    const avisos = [];
    const piezas = await cargarPiezas(PIEZAS_REALES, { avisar: (m) => avisos.push(m) });
    expect(avisos).toEqual([]);
    expect(piezas.map((p) => p.nombre)).toEqual(PIEZAS_REALES.map((p) => p.nombre));
  });
  it('sobre un mensaje inocente ninguna tira y ninguna habla', async () => {
    const piezas = await cargarPiezas(PIEZAS_REALES, { avisar: () => {} });
    const avisos = [];
    const out = await correr({ session_id: 'gate-prompt-hooks', hook_event_name: 'UserPromptSubmit', cwd: RAIZ, prompt: 'hola, como va?' }, piezas, { avisar: (m) => avisos.push(m) });
    expect(avisos).toEqual([]);
    expect(out).toBeNull();
  }, 30000);
  it('prompt-hooks.sh con un mensaje de explicar: exit 0, UN solo JSON con el aviso, nada por stderr', () => {
    const r = spawnSync('bash', [SH], { input: JSON.stringify({ session_id: 'gate-prompt-hooks-sh', hook_event_name: 'UserPromptSubmit', cwd: RAIZ, prompt: 'no entiendo, explicame mejor' }), encoding: 'utf8', env: { ...process.env, CLAUDE_HOOKS_TIEMPOS: 'off' } });
    expect(r.status).toBe(0);
    expect(r.stderr).toBe('');
    const out = JSON.parse(r.stdout);
    expect(out.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
    expect(out.hookSpecificOutput.additionalContext).toMatch(/explicar/i);
  }, 30000);
  // Con un modulo roto el .sh no puede quedar mudo con 0 (nadie se enteraria de que los cuatro avisos se apagaron) ni
  // salir con 2 (en UserPromptSubmit el 2 BORRA el mensaje de Fak): sale con 1, que la app muestra como error del hook.
  it.each([
    ['un error de sintaxis', 'export const = ;\n'],
    ['un modulo que sale con 2', 'process.exit(2);\n'],
    ['un modulo que tira', 'throw new Error("roto");\n'],
  ])('prompt-hooks.sh con %s en promptHooks.mjs sale con 1, nunca con 0 ni con 2', (nombre, roto) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-hooks-roto-'));
    fs.mkdirSync(path.join(tmp, '.claude', 'hooks'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'scripts', '_lib'), { recursive: true });
    fs.copyFileSync(SH, path.join(tmp, '.claude', 'hooks', 'prompt-hooks.sh'));
    fs.writeFileSync(path.join(tmp, 'scripts', '_lib', 'promptHooks.mjs'), roto);
    const r = spawnSync('bash', [path.join(tmp, '.claude', 'hooks', 'prompt-hooks.sh')], { input: JSON.stringify({ session_id: 'gate-prompt-hooks-roto', hook_event_name: 'UserPromptSubmit', cwd: tmp, prompt: 'hola' }), encoding: 'utf8', env: { ...process.env, CLAUDE_HOOKS_TIEMPOS: 'off' } });
    expect(r.status).toBe(1);
    expect(r.stdout).toBe('');
  }, 30000);
  it('prompt-hooks.sh sin el modulo en el disco deja pasar con 0 (un checkout a medias no rompe cada mensaje)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-hooks-sin-'));
    fs.mkdirSync(path.join(tmp, '.claude', 'hooks'), { recursive: true });
    fs.copyFileSync(SH, path.join(tmp, '.claude', 'hooks', 'prompt-hooks.sh'));
    const r = spawnSync('bash', [path.join(tmp, '.claude', 'hooks', 'prompt-hooks.sh')], { input: '{}', encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  }, 30000);
});
