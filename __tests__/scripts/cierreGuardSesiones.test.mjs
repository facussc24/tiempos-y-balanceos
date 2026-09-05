// cierre-guard · los dos falsos positivos del 05/09/2026 (Ola 3), en rojo y en verde:
//   1. `git commit -F <scratchpad>/commit.txt` se contaba como "entregaste algo afuera del repo"
//      (la ruta del scratchpad vive en Temp y matcheaba `cp|copy|-F` + una ruta de afuera).
//   2. "hay N archivo(s) sin commitear" contaba lo sucio de OTRA sesion que trabajaba en el
//      mismo repo (guardianes.mjs, documentacion-oficial.md). Ahora, con transcript, solo
//      cuenta lo que ESTA sesion escribio con Write/Edit.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluarToolUse, rutaRelativaAlRepo, escribioFueraEnEsteTurno, decidir, REPO } from '../../scripts/_lib/cierreGuard.mjs';

const SCR = 'C:\\Users\\FACUND~1\\AppData\\Local\\Temp\\claude\\C--Dev-BarackMercosul\\e0a735af\\scratchpad';
const repoWin = REPO.replace(/\//g, '\\');
const repoGitBash = `/${repoWin[0].toLowerCase()}/${repoWin.slice(3).replace(/\\/g, '/')}`;

describe('cierre-guard · scratchpad no es "afuera" (falso positivo 1)', () => {
  it('VERDE: un commit con el mensaje en el scratchpad, o copiar dentro del scratchpad, no entrega nada', () => {
    expect(evaluarToolUse({ name: 'Bash', input: { command: `git commit -F "${SCR}\\commit1.txt"` } })).toBe(null);
    expect(evaluarToolUse({ name: 'Bash', input: { command: `cp "${SCR}\\informe.md" "${SCR}\\copia.md"` } })).toBe(null);
  });
  it('ROJO: copiar al Escritorio sigue siendo entrega afuera, venga o no del scratchpad', () => {
    expect(evaluarToolUse({ name: 'Bash', input: { command: 'cp dist/informe.pdf "C:\\Users\\FacundoS-PC\\Desktop\\tarea\\informe.pdf"' } })).toMatch(/Desktop/);
    // el ejemplo que devuelve se corta a 120 caracteres: con la ruta larga del scratchpad
    // adelante, "Desktop" queda afuera del texto; lo que importa es que NO sea null.
    expect(evaluarToolUse({ name: 'Bash', input: { command: `cp "${SCR}\\x.pdf" "C:\\Users\\FacundoS-PC\\Desktop\\x.pdf"` } })).toMatch(/^Bash: cp /);
  });
});

describe('cierre-guard · pendientes solo de ESTA sesion (falso positivo 2)', () => {
  it('rutaRelativaAlRepo: Write/Edit dentro del repo (Windows o Git Bash) → relativa con /; afuera o Bash → null', () => {
    expect(rutaRelativaAlRepo({ name: 'Write', input: { file_path: `${repoWin}\\scripts\\_lib\\x.mjs` } })).toBe('scripts/_lib/x.mjs');
    expect(rutaRelativaAlRepo({ name: 'Edit', input: { file_path: `${repoWin.replace(/\\/g, '/')}/CLAUDE.md` } })).toBe('CLAUDE.md');
    // la forma /c/Dev/... solo existe en Git Bash de Windows; en el runner Linux REPO no tiene letra de unidad
    if (process.platform === 'win32') expect(rutaRelativaAlRepo({ name: 'Edit', input: { file_path: `${repoGitBash}/docs/x.md` } })).toBe('docs/x.md');
    expect(rutaRelativaAlRepo({ name: 'Write', input: { file_path: 'C:\\Users\\x\\Desktop\\a.md' } })).toBe(null);
    expect(rutaRelativaAlRepo({ name: 'Bash', input: { command: 'echo' } })).toBe(null);
  });

  it('escribioFueraEnEsteTurno junta los tocados de TODA la sesion y no toma el scratchpad como entrega', async () => {
    const f = path.join(os.tmpdir(), `cg-sesiones-${process.pid}-${Date.now()}.jsonl`);
    const l = (o) => JSON.stringify(o);
    fs.writeFileSync(f, [
      l({ type: 'user', message: { content: 'arranca' } }),
      l({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: `${repoWin}\\scripts\\x.mjs`, content: '' } }] } }),
      l({ type: 'user', message: { content: 'segui' } }),
      l({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: `git commit -F "${SCR}\\c.txt"` } }] } }),
      l({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: `${repoWin}\\CLAUDE.md`, old_string: 'a', new_string: 'b' } }] } }),
    ].join('\n') + '\n');
    try {
      const r = await escribioFueraEnEsteTurno(f);
      expect(r.fuera).toBe(false);
      expect([...r.tocados].sort()).toEqual(['CLAUDE.md', 'scripts/x.mjs']);
    } finally { fs.unlinkSync(f); }
  });

  it('ROJO sigue rojo: un Write al Escritorio despues del ultimo mensaje de Fak es entrega afuera', async () => {
    const f = path.join(os.tmpdir(), `cg-sesiones-rojo-${process.pid}-${Date.now()}.jsonl`);
    const l = (o) => JSON.stringify(o);
    fs.writeFileSync(f, [
      l({ type: 'user', message: { content: 'hace el informe' } }),
      l({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: 'C:\\Users\\FacundoS-PC\\Desktop\\tarea\\informe.md', content: '' } }] } }),
    ].join('\n') + '\n');
    try {
      const r = await escribioFueraEnEsteTurno(f);
      expect(r.fuera).toBe(true);
      expect(r.ejemplo).toMatch(/Desktop/);
    } finally { fs.unlinkSync(f); }
  });

  it('decidir le pasa los tocados al relevador de pendientes (y null si no hubo transcript)', async () => {
    let recibido = 'no-llamado';
    const base = { session_id: 's-sesiones', last_assistant_message: 'Listo, commiteado y pusheado.' };
    const deps = { pendientes: (t) => { recibido = t; return []; }, enCooldown: () => false, marcar: () => {} };
    expect((await decidir(base, { ...deps, fueraEnEsteTurno: async () => ({ fuera: false, tocados: new Set(['scripts/a.mjs']) }) })).ok).toBe(true);
    expect([...recibido]).toEqual(['scripts/a.mjs']);
    expect((await decidir(base, { ...deps, fueraEnEsteTurno: async () => ({ fuera: false }) })).ok).toBe(true);
    expect(recibido).toBe(null);
  });
});
