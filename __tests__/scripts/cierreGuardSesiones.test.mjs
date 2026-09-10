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
import {
  evaluarToolUse, rutaRelativaAlRepo, rutasRepoEnComando, escribioFueraEnEsteTurno, decidir, REPO,
  relevarTranscript, archivosTocadosEnSesion, entregablesEnComando, esEntregableFuera,
} from '../../scripts/_lib/cierreGuard.mjs';

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

// ───────────────────────────────────────────── Ola A del 10/09/2026: A4, relevador unico y A1
const DESK = 'C:\\Users\\FacundoS-PC\\Desktop\\tarea';
const l = (o) => JSON.stringify(o);
const asis = (b) => l({ type: 'assistant', message: { content: [{ type: 'tool_use', ...b }] } });
const user = (texto) => l({ type: 'user', message: { content: texto } });
function transcriptDe(lineas, prefijo = 'cg-olaA') {
  const f = path.join(os.tmpdir(), `${prefijo}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
  fs.writeFileSync(f, [...lineas].join('\n') + '\n');
  return f;
}

describe('cierre-guard · A4: el mensaje de un commit y el TEMP del sistema no entregan nada', () => {
  it('VERDE: `git commit -m "…Escritorio…"`, un heredoc de commit que dice Desktop, o una copia al TEMP → null', () => {
    expect(evaluarToolUse({ name: 'Bash', input: { command: 'git commit -m "docs(escritorio): mover el informe al Escritorio y entregar la copia"' } })).toBe(null);
    expect(evaluarToolUse({ name: 'Bash', input: { command: "git commit -F - <<'EOF'\nfeat: copiar al Desktop\n\nentregar en OneDrive\nEOF" } })).toBe(null);
    expect(evaluarToolUse({ name: 'Bash', input: { command: 'cp informe.pdf "C:\\Users\\FacundoS-PC\\AppData\\Local\\Temp\\Ingenieria_informe.pdf"' } })).toBe(null);
  });
  it('ROJO sigue rojo: el mensaje del commit no tapa un cp real al Escritorio en el mismo comando', () => {
    expect(evaluarToolUse({ name: 'Bash', input: { command: `git commit -m "x" && cp informe.pdf "${DESK}\\informe.pdf"` } })).toMatch(/^Bash: git commit/);
  });
});

describe('cierre-guard · relevarTranscript: ultimo mensaje de Fak, subagentes y repo inyectado', () => {
  it('ultimoMensajeFak es lo que ESCRIBIO Fak: los avisos que Claude Code mete como user no cuentan', async () => {
    const f = transcriptDe([
      user('hace el informe corto'),
      asis({ name: 'Write', input: { file_path: `${repoWin}\\docs\\x.md`, content: '' } }),
      user('<system-reminder>\nrecordatorio\n</system-reminder>'),
      user('[SYSTEM NOTIFICATION - NOT USER INPUT]\n<task-notification>listo</task-notification>'),
      l({ type: 'user', message: { content: [{ type: 'tool_result', content: 'ok' }] } }),
    ]);
    try {
      const r = await relevarTranscript(f);
      expect(r.ultimoMensajeFak).toBe('hace el informe corto');
      expect([...r.tocados]).toEqual(['docs/x.md']);
    } finally { fs.unlinkSync(f); }
  });

  it('los Edit de un subagente (<sesion>/subagents/*.jsonl) cuentan como tocados de la sesion', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-sub-'));
    const f = path.join(dir, 'ses.jsonl');
    fs.writeFileSync(f, [user('audita'), asis({ name: 'Agent', input: { prompt: 'audita' } })].join('\n') + '\n');
    fs.mkdirSync(path.join(dir, 'ses', 'subagents'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'ses', 'subagents', 'agent-1.jsonl'), [
      l({ type: 'user', isSidechain: true, message: { content: 'audita' } }),
      l({ type: 'assistant', isSidechain: true, message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: `${repoWin}\\scripts\\sub.mjs`, old_string: 'a', new_string: 'b' } }] } }),
    ].join('\n') + '\n');
    try {
      expect([...(await archivosTocadosEnSesion(f))]).toEqual(['scripts/sub.mjs']);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('con --repo inyectado (repo temporal con nombre corto 8.3, o en forma Git Bash) relativiza igual', async () => {
    const repoTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-repo-'));      // C:\Users\FACUND~1\… en Windows
    const largo = fs.realpathSync.native(repoTmp);
    const f = transcriptDe([
      user('dale'),
      asis({ name: 'Write', input: { file_path: path.join(largo, 'App.tsx'), content: '' } }),
      asis({ name: 'Edit', input: { file_path: path.join(repoTmp, 'x.ts'), old_string: 'a', new_string: 'b' } }),
      asis({ name: 'Write', input: { file_path: `${repoWin}\\CLAUDE.md`, content: '' } }),     // del repo REAL: no es de este
    ]);
    try {
      expect([...(await relevarTranscript(f, { repo: repoTmp })).tocados].sort()).toEqual(['App.tsx', 'x.ts']);
      if (process.platform === 'win32') {
        const gitBash = `/${largo[0].toLowerCase()}/${largo.slice(3).replace(/\\/g, '/')}`;
        expect([...(await relevarTranscript(f, { repo: gitBash })).tocados].sort()).toEqual(['App.tsx', 'x.ts']);
      }
    } finally { fs.unlinkSync(f); fs.rmSync(repoTmp, { recursive: true, force: true }); }
  });
});

describe('cierre-guard · A1: un entregable escrito afuera y nunca abierto no se declara listo', () => {
  const deps = { pendientes: () => [], enCooldown: () => false, marcar: () => {}, yaReclamado: () => false, reclamar: () => {} };
  const cierre = (f, extra = {}) => decidir({ session_id: 's-a1', transcript_path: f, last_assistant_message: `Listo, quedó en ${DESK}\\difusion.pdf.`, ...extra }, deps);

  it('esEntregableFuera: pdf/xlsx/step afuera si; repo, scratchpad, TEMP, .claude y .txt no', () => {
    expect(esEntregableFuera(`${DESK}\\difusion.pdf`)).toBe(true);
    expect(esEntregableFuera('Y:\\BARACK\\CALIDAD\\tabla.xlsx')).toBe(true);
    expect(esEntregableFuera('/c/Users/x/Desktop/carro.step')).toBe(true);
    expect(esEntregableFuera(`${repoWin}\\tools\\flowchart\\.build\\154.png`)).toBe(false);
    expect(esEntregableFuera(`${SCR}\\render.png`)).toBe(false);
    expect(esEntregableFuera('C:\\Users\\FacundoS-PC\\AppData\\Local\\Temp\\x.pdf')).toBe(false);
    expect(esEntregableFuera('C:\\Users\\FacundoS-PC\\.claude\\projects\\p\\memory\\foto.png')).toBe(false);
    expect(esEntregableFuera(`${DESK}\\notas.txt`)).toBe(false);
  });

  it('entregablesEnComando: --out y .save( escriben; cp escribe el destino; fitz/Read miran; un ls no hace nada', () => {
    expect(entregablesEnComando(`python scripts/_pdfBomArb.py --out "${DESK}\\difusion.pdf"`)).toEqual({ escritos: [`${DESK}\\difusion.pdf`], mirados: [] });
    expect(entregablesEnComando(`node scripts/x.mjs > ${DESK}\\tabla.csv`)).toEqual({ escritos: [`${DESK}\\tabla.csv`], mirados: [] });
    expect(entregablesEnComando(`cp "${SCR}\\a.xlsx" "${DESK}\\a.xlsx"`)).toEqual({ escritos: [`${DESK}\\a.xlsx`], mirados: [] });
    expect(entregablesEnComando(`python - <<'EOF'\nimport fitz\nd = fitz.open(r"${DESK}\\difusion.pdf")\nEOF`)).toEqual({ escritos: [], mirados: [`${DESK}\\difusion.pdf`] });
    expect(entregablesEnComando(`python - <<'EOF'\nimport openpyxl\nwb = openpyxl.load_workbook(r"${DESK}\\a.xlsx")\nwb.save(r"${DESK}\\b.xlsx")\nEOF`)).toEqual({ escritos: [`${DESK}\\b.xlsx`], mirados: [`${DESK}\\a.xlsx`] });
    expect(entregablesEnComando(`ls -la "${DESK}\\difusion.pdf"`)).toEqual({ escritos: [], mirados: [] });
    expect(entregablesEnComando(undefined)).toEqual({ escritos: [], mirados: [] });
  });

  it('ROJO: genero el PDF en el Escritorio con --out, nunca lo abri, digo "listo" → bloquea nombrando el archivo', async () => {
    const f = transcriptDe([user('arma la difusion'), asis({ name: 'Bash', input: { command: `python scripts/_pdfBomArb.py --out "${DESK}\\difusion.pdf"` } })]);
    try {
      const r = await relevarTranscript(f);
      expect(r.sinMirar.map((e) => e.nombre)).toEqual(['difusion.pdf']);
      const d = await cierre(f);
      expect(d.ok).toBe(false);
      expect(d.titulo).toMatch(/no lo abriste/);
      expect(d.detalle).toMatch(/difusion\.pdf/);
    } finally { fs.unlinkSync(f); }
  });

  it('ROJO por su motivo: lo mire ANTES de la ultima escritura → sigue sin mirar', async () => {
    const f = transcriptDe([
      user('arma la difusion'),
      asis({ name: 'Bash', input: { command: `python scripts/_pdfBomArb.py --out "${DESK}\\difusion.pdf"` } }),
      asis({ name: 'Read', input: { file_path: `${DESK}\\difusion.pdf` } }),
      asis({ name: 'Bash', input: { command: `python scripts/_pdfBomArb.py --out "${DESK}\\difusion.pdf"` } }),
    ]);
    try { expect((await cierre(f)).ok).toBe(false); } finally { fs.unlinkSync(f); }
  });

  it('VERDE: lo abri despues — con Read, con fitz en un heredoc, con el PNG del render, con Start-Process o con una tool MCP', async () => {
    const escribir = asis({ name: 'Bash', input: { command: `cp "${SCR}\\difusion.pdf" "${DESK}\\difusion.pdf"` } });
    const miradas = [
      asis({ name: 'Read', input: { file_path: `${DESK}\\difusion.pdf` } }),
      asis({ name: 'Bash', input: { command: `python - <<'EOF'\nimport fitz\nfor p in fitz.open(r"${DESK}\\difusion.pdf"): print(p.get_text()[:80])\nEOF` } }),
      asis({ name: 'Read', input: { file_path: `${SCR}\\difusion.png` } }),
      asis({ name: 'PowerShell', input: { command: `Start-Process "${DESK}\\difusion.pdf"` } }),
      asis({ name: 'mcp__pdf-viewer__read_pdf', input: { path: `${DESK}\\difusion.pdf`, pages: '1' } }),
    ];
    for (const mirada of miradas) {
      const f = transcriptDe([user('arma la difusion'), escribir, mirada]);
      try {
        const r = await relevarTranscript(f);
        expect(r.sinMirar, JSON.parse(mirada).message.content[0].name).toEqual([]);
        expect((await cierre(f)).ok).toBe(true);
      } finally { fs.unlinkSync(f); }
    }
  });

  it('VERDE: sin declarar cierre no reclama; en el scratchpad no es entregable; ya reclamado (archivo@escritura) no se repite', async () => {
    const f = transcriptDe([user('arma la difusion'), asis({ name: 'Bash', input: { command: `python scripts/_pdfBomArb.py --out "${DESK}\\difusion.pdf"` } })]);
    const g = transcriptDe([user('arma la difusion'), asis({ name: 'Bash', input: { command: `python scripts/_pdfBomArb.py --out "${SCR}\\difusion.pdf"` } })]);
    try {
      expect((await cierre(f, { last_assistant_message: `Sigo con la tabla; el PDF va quedando en ${DESK}\\difusion.pdf.` })).ok).toBe(true);
      expect((await relevarTranscript(g)).entregables).toEqual([]);
      const reclamos = [];
      const conMemoria = { ...deps, yaReclamado: (sid, k) => reclamos.includes(k), reclamar: (sid, k) => reclamos.push(k) };
      const d1 = await decidir({ session_id: 's-a1', transcript_path: f, last_assistant_message: `Listo, quedó en ${DESK}\\difusion.pdf.` }, conMemoria);
      expect(d1.ok).toBe(false);
      expect(reclamos).toEqual(['difusion.pdf@1']);
      const d2 = await decidir({ session_id: 's-a1', transcript_path: f, last_assistant_message: `Listo, quedó en ${DESK}\\difusion.pdf.` }, conMemoria);
      expect(d2.ok).toBe(true);
    } finally { fs.unlinkSync(f); fs.unlinkSync(g); }
  });
});
