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
import { evaluarToolUse, rutaRelativaAlRepo, rutasRepoEnComando, escribioFueraEnEsteTurno, decidir, REPO } from '../../scripts/_lib/cierreGuard.mjs';

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

// Auditoria independiente del 05/09 sobre este mismo fix: dos bugs reales, confirmados corriendo el codigo.
describe('cierre-guard · C.2: SCRATCH solo exime el arbol REAL del scratchpad', () => {
  it('ROJO: una carpeta de entrega que se llama tmp o scratchpad sigue siendo afuera (Write, Edit y Bash)', () => {
    expect(evaluarToolUse({ name: 'Write', input: { file_path: 'C:\\Users\\FacundoS-PC\\Desktop\\tarea\\tmp\\entrega_final.pdf' } })).toMatch(/Desktop/);
    expect(evaluarToolUse({ name: 'Write', input: { file_path: 'Y:\\BARACK\\CALIDAD\\tmp\\informe_cliente.pdf' } })).toMatch(/informe_cliente/);
    expect(evaluarToolUse({ name: 'Edit', input: { file_path: 'C:\\Users\\FacundoS-PC\\OneDrive - BARACK\\scratchpad\\nota.md' } })).toMatch(/OneDrive/);
    expect(evaluarToolUse({ name: 'Bash', input: { command: 'robocopy dist "Y:\\BARACK\\CALIDAD\\tmp\\carpeta_entrega" /E' } })).toMatch(/^Bash: robocopy/);
  });
  it('VERDE: el scratchpad real (Temp\\claude en Windows, /tmp/claude en Linux) sigue sin ser afuera', () => {
    expect(evaluarToolUse({ name: 'Bash', input: { command: `cp "${SCR}\\a.md" "${SCR}\\b.md"` } })).toBe(null);
    expect(evaluarToolUse({ name: 'Bash', input: { command: 'cp /tmp/claude/C--Dev-BarackMercosul/abc/scratchpad/a.md /tmp/claude/C--Dev-BarackMercosul/abc/scratchpad/b.md' } })).toBe(null);
  });
});

describe('cierre-guard · C.1: lo que la sesion escribio con Bash tambien cuenta como tocado', () => {
  it('rutasRepoEnComando: sed -i, cat >, python, git add (relativas o absolutas de adentro); no URLs, ni `..`, ni afuera', () => {
    expect([...rutasRepoEnComando(`sed -i 's/a/b/' scripts/foo.mjs`)]).toEqual(['scripts/foo.mjs']);
    expect([...rutasRepoEnComando(`cat > docs/x.md <<'EOF'\nimport y from '../../scripts/_lib/y.mjs';\nver https://x.com/a.md\nEOF`)]).toEqual(['docs/x.md']);
    expect([...rutasRepoEnComando(`python scripts/_arb.py --aplicar && git add scripts\\_lib\\z.json ./CLAUDE.md`)].sort()).toEqual(['CLAUDE.md', 'scripts/_arb.py', 'scripts/_lib/z.json']);
    expect([...rutasRepoEnComando(`node "${repoWin}\\scripts\\x.mjs" --json`)]).toEqual(['scripts/x.mjs']);
    expect([...rutasRepoEnComando(`git commit -F "${SCR}\\c.txt" && cp x.pdf "C:\\Users\\x\\Desktop\\x.md" && ls -la && npx vitest run`)]).toEqual([]);
    expect([...rutasRepoEnComando(undefined)]).toEqual([]);
  });

  const transcript = (bloques) => {
    const f = path.join(os.tmpdir(), `cg-c1-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
    const l = (o) => JSON.stringify(o);
    fs.writeFileSync(f, [l({ type: 'user', message: { content: 'dale' } }), ...bloques.map((b) => l({ type: 'assistant', message: { content: [{ type: 'tool_use', ...b }] } }))].join('\n') + '\n');
    return f;
  };

  it('ROJO del auditor: sesion que solo edito con `sed -i` → el archivo esta en tocados (antes: Set vacio → 0 pendientes)', async () => {
    const f = transcript([{ name: 'Bash', input: { command: `sed -i 's/a/b/' scripts/foo.mjs` } }]);
    try {
      const r = await escribioFueraEnEsteTurno(f);
      expect(r.tocados).toBeInstanceOf(Set);
      expect([...r.tocados]).toEqual(['scripts/foo.mjs']);
    } finally { fs.unlinkSync(f); }
  });
  it('sesion que corrio comandos o agentes sin ningun archivo atribuible → tocados null (se cuenta todo lo sucio, como antes)', async () => {
    const f = transcript([{ name: 'Bash', input: { command: 'npm run build && npx vitest run' } }, { name: 'Agent', input: { prompt: 'audita' } }]);
    try { expect((await escribioFueraEnEsteTurno(f)).tocados).toBe(null); } finally { fs.unlinkSync(f); }
  });
  it('sesion que solo leyo (Read/Grep) → Set vacio: cero pendientes propios es lo correcto', async () => {
    const f = transcript([{ name: 'Read', input: { file_path: `${repoWin}\\CLAUDE.md` } }, { name: 'Grep', input: { pattern: 'x' } }]);
    try {
      const r = await escribioFueraEnEsteTurno(f);
      expect(r.tocados).toBeInstanceOf(Set);
      expect(r.tocados.size).toBe(0);
    } finally { fs.unlinkSync(f); }
  });
});
