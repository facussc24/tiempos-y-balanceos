// Tests de los hooks que NO pasan por guardianes.mjs: cada uno con al menos un caso ROJO
// (bloquea / deja su marca) y uno VERDE (deja pasar). Hasta el 05/09/2026 estos siete no
// tenian test en ninguna direccion, y entre ellos estan los que corren el backup, los que
// frenan una escritura irreversible en Supabase y el techo de subagentes.
//
// Se corren como los corre Claude Code: `bash <hook>` con el JSON por stdin, en un TMPDIR /
// HOME / repo git temporales para no tocar los flags reales de la maquina.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';

const RAIZ = process.cwd();
const HOOKS = path.join(RAIZ, '.claude', 'hooks');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-varios-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

/** bash de Git acepta rutas Windows, pero con barras normales no hay que pensar en escapes. */
const posix = (p) => p.replace(/\\/g, '/');
const ahora = () => Math.floor(Date.now() / 1000);

function hook(nombre, payload, { env = {}, cwd = RAIZ, stdin, ruta } = {}) {
  const r = spawnSync('bash', [ruta ?? path.join(HOOKS, nombre)], {
    input: stdin ?? JSON.stringify(payload),
    encoding: 'utf8',
    cwd,
    env: { ...process.env, ...env },
  });
  return { exit: r.status, out: r.stdout ?? '', err: r.stderr ?? '' };
}

function repoGit(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], {
    cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  git('init', '-q');
  return git;
}

// ───────────────────────────────────────────────────── mcp-write-gate: lo irreversible pide backup
describe('mcp-write-gate.sh — lo irreversible sobre documentos APQP pide un backup de menos de 1 h', () => {
  const dir = path.join(TMP, 'mcp');
  fs.mkdirSync(dir, { recursive: true });
  const FLAG = path.join(dir, 'claude-backup-ok.flag');
  const LOG = path.join(dir, 'claude-mcp-write-gate.log');
  const env = { TMPDIR: posix(dir), BARACK_BACKUP_OK: '' };
  const sql = (query) => ({ tool_name: 'mcp__supabase__execute_sql', tool_input: { query } });
  const correr = (query, extra = {}) => hook('mcp-write-gate.sh', sql(query), { env: { ...env, ...extra } });
  beforeEach(() => { fs.rmSync(FLAG, { force: true }); fs.rmSync(LOG, { force: true }); });

  it('ROJO: DELETE, UPDATE de la columna data, TRUNCATE y DROP sin backup → 2 con el motivo', () => {
    const r = correr("DELETE FROM amfe_documents WHERE id = 'x'");
    expect(r.exit).toBe(2);
    expect(r.err).toMatch(/BLOQUEADO por mcp-write-gate/);
    expect(r.err).toMatch(/DELETE de documentos/);
    expect(r.err).toMatch(/node scripts\/_backup\.mjs/);
    expect(correr("UPDATE public.cp_documents SET data = '{}' WHERE id = 'x'").err).toMatch(/UPDATE de la columna data/);
    expect(correr('TRUNCATE ho_documents').exit).toBe(2);
    expect(correr('DROP TABLE pfd_documents').exit).toBe(2);
    // El comentario no esconde el verbo.
    expect(correr("-- solo miro\nDELETE FROM amfe_documents WHERE id = 'x'").exit).toBe(2);
  });

  it('VERDE: SELECT, INSERT y un UPDATE de metadata pasan sin decir nada', () => {
    for (const q of [
      'SELECT id, updated_at FROM amfe_documents',
      "INSERT INTO amfe_documents (id) VALUES ('x')",
      "UPDATE amfe_documents SET updated_at = now() WHERE id = 'x'",
      "DELETE FROM projects WHERE id = 'x'",   // no es un documento APQP
    ]) {
      const r = correr(q);
      expect(r.exit, q).toBe(0);
      expect(r.err, q).toBe('');
    }
  });

  it('con backup de hace 5 min pasa y lo dice; con uno de hace 2 h bloquea diciendo la edad', () => {
    fs.writeFileSync(FLAG, String(ahora() - 300));
    const fresco = correr("DELETE FROM amfe_documents WHERE id = 'x'");
    expect(fresco.exit).toBe(0);
    expect(fresco.err).toMatch(/backup verificado hace 5 min/);
    fs.writeFileSync(FLAG, String(ahora() - 7200));
    const viejo = correr("DELETE FROM amfe_documents WHERE id = 'x'");
    expect(viejo.exit).toBe(2);
    expect(viejo.err).toMatch(/hace 120 min/);
  });

  it('el override BARACK_BACKUP_OK es explicito: pasa, lo dice y queda en el log', () => {
    const r = correr("DELETE FROM amfe_documents WHERE id = 'x'", { BARACK_BACKUP_OK: 'prueba del test' });
    expect(r.exit).toBe(0);
    expect(r.err).toMatch(/override activo/);
    expect(fs.readFileSync(LOG, 'utf8')).toMatch(/prueba del test/);
  });

  it('FAIL-CLOSED: un payload ilegible con un DELETE adentro bloquea igual', () => {
    const r = hook('mcp-write-gate.sh', null, {
      env, stdin: '{"tool_name":"mcp__supabase__execute_sql","tool_input":{"query":"DELETE FROM amfe_documents WHERE 1=1"',
    });
    expect(r.exit).toBe(2);
    expect(r.err).toMatch(/payload no parseable/);
  });
});

// ─────────────────────────────────────── supabase-write-flag: observa y marca la sesion que ESCRIBIO
describe('supabase-write-flag.sh — siempre exit 0; deja el flag solo si la sesion ESCRIBIO', () => {
  const dir = path.join(TMP, 'swf');
  fs.mkdirSync(dir, { recursive: true });
  const FLAG = path.join(dir, 'claude-supabase-write.flag');
  const env = { TMPDIR: posix(dir) };
  const correr = (payload) => hook('supabase-write-flag.sh', payload, { env });
  const sql = (query) => ({ tool_name: 'mcp__supabase__execute_sql', tool_input: { query } });
  beforeEach(() => fs.rmSync(FLAG, { force: true }));

  it('ROJO (deja marca): UPDATE, un DELETE despues de ; y apply_migration', () => {
    expect(correr(sql("UPDATE amfe_documents SET data = '{}' WHERE id = 'x'")).exit).toBe(0);
    expect(fs.existsSync(FLAG)).toBe(true);
    fs.rmSync(FLAG);
    correr(sql('SELECT 1; DELETE FROM cp_documents'));
    expect(fs.existsSync(FLAG)).toBe(true);
    fs.rmSync(FLAG);
    correr({ tool_name: 'mcp__supabase__apply_migration', tool_input: { name: 'x', query: 'create table t (id int)' } });
    expect(fs.existsSync(FLAG)).toBe(true);
  });

  it('VERDE (sin marca): un SELECT que menciona updated_at / created_at no es una escritura', () => {
    const r = correr(sql('SELECT id, updated_at, created_at FROM amfe_documents ORDER BY updated_at'));
    expect(r.exit).toBe(0);
    expect(r.err).toBe('');
    expect(fs.existsSync(FLAG)).toBe(false);
  });
});

// ───────────────────────────────── dev-server-guard (Stop): recuerda el preview si se toco la APP
describe('dev-server-guard.sh (Stop) — recuerda el preview solo si se toco codigo de la APP y nadie escucha', () => {
  const repo = path.join(TMP, 'app');
  const git = repoGit(repo);
  fs.mkdirSync(path.join(repo, '.claude'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'scripts'), { recursive: true });
  // Puerto que no escucha nadie: asi el chequeo (1) no tapa el (2).
  fs.writeFileSync(path.join(repo, '.claude', 'launch.json'), JSON.stringify({ configurations: [{ name: 'dev', port: 65001 }] }));
  const APP = path.join(repo, 'App.tsx');
  const SCRIPT = path.join(repo, 'scripts', 'x.ts');
  fs.writeFileSync(APP, 'export const a = 1;\n');
  fs.writeFileSync(SCRIPT, 'export const b = 1;\n');
  git('add', 'App.tsx', 'scripts/x.ts', '.claude/launch.json');
  git('commit', '-q', '-m', 'init');
  const correr = () => hook('dev-server-guard.sh', {}, { cwd: repo });
  beforeEach(() => { fs.writeFileSync(APP, 'export const a = 1;\n'); fs.writeFileSync(SCRIPT, 'export const b = 1;\n'); });

  it('ROJO: App.tsx modificado y nadie en el puerto → 2 nombrando el archivo y el puerto', () => {
    fs.appendFileSync(APP, 'export const c = 2;\n');
    const r = correr();
    expect(r.exit).toBe(2);
    expect(r.err).toMatch(/puerto 65001/);
    expect(r.err).toMatch(/App\.tsx/);
  });

  it('VERDE: solo scripts/ modificado, o nada modificado → 0 sin ruido', () => {
    fs.appendFileSync(SCRIPT, 'export const d = 2;\n');
    const soloScripts = correr();
    expect(soloScripts.exit).toBe(0);
    expect(soloScripts.err).toBe('');
    fs.writeFileSync(SCRIPT, 'export const b = 1;\n');
    expect(correr().exit).toBe(0);
  });
});

// ───────────────────────────────────────────── pregunta-guard (AskUserQuestion): solo aviso
describe('pregunta-guard.sh (AskUserQuestion) — recordatorio por additionalContext, nunca bloquea', () => {
  it('exit 0 y el JSON con el recordatorio; con payload ilegible tambien 0', () => {
    const r = hook('pregunta-guard.sh', { tool_name: 'AskUserQuestion', tool_input: { questions: [] } });
    expect(r.exit).toBe(0);
    const ctx = JSON.parse(r.out).hookSpecificOutput;
    expect(ctx.hookEventName).toBe('PreToolUse');
    expect(ctx.additionalContext).toMatch(/PREGUNTA-GUARD/);
    expect(ctx.additionalContext).toMatch(/Lo que ya tengo/);
    expect(hook('pregunta-guard.sh', null, { stdin: '{roto' }).exit).toBe(0);
  });
});

// ─────────────────────────────────────────────── cierre-guard (Stop): wrapper de cierreGuard.mjs
describe('cierre-guard.sh (Stop) — el wrapper llega a cierreGuard.mjs con el JSON del Stop', () => {
  const transcript = path.join(TMP, 'transcript-vacio.jsonl');
  fs.writeFileSync(transcript, '');
  const stop = (last_assistant_message, extra = {}) => hook('cierre-guard.sh', {
    hook_event_name: 'Stop', stop_hook_active: false, transcript_path: posix(transcript), last_assistant_message, ...extra,
  });

  it('ROJO: el turno termina pidiendo permiso para mi propio trabajo → 2 con el motivo', () => {
    const r = stop('Tengo el script listo y probado en dry-run. ¿Arranco?');
    expect(r.exit).toBe(2);
    expect(r.err.length).toBeGreaterThan(20);
  });

  it('VERDE: stop_hook_active (segundo Stop del turno) y un mensaje que sigue trabajando → 0', () => {
    expect(stop('¿Arranco?', { stop_hook_active: true }).exit).toBe(0);
    const r = stop('Sigo con el paso 3: corriendo los tests del modulo.');
    expect(r.exit).toBe(0);
    expect(r.err).toBe('');
  });
});

// ──────────────────────────── supabase-guard: corre el backup ANTES de un .mjs destructivo
describe('supabase-guard.sh — corre _backup.mjs ANTES de un .mjs destructivo; si el backup falla, bloquea', () => {
  const repo = path.join(TMP, 'supa');
  repoGit(repo);
  fs.mkdirSync(path.join(repo, 'scripts'), { recursive: true });
  const backupQueSale = (codigo) => fs.writeFileSync(
    path.join(repo, 'scripts', '_backup.mjs'),
    `process.stdout.write('backup falso, sale ${codigo}\\n'); process.exit(${codigo});\n`,
  );
  const correr = (command) => hook('supabase-guard.sh', { tool_name: 'Bash', tool_input: { command } }, { cwd: repo });

  it('ROJO: el backup falla → 2 "BACKUP FALLO" (scripts/_fix*, _sync* y cualquier .mjs con --apply)', () => {
    backupQueSale(1);
    const r = correr('node scripts/_fixX.mjs --apply');
    expect(r.exit).toBe(2);
    expect(r.err).toMatch(/BACKUP FALLO/);
    expect(correr('node scripts/_syncAlgo.mjs').exit).toBe(2);
    expect(correr('npx tsx scripts/loQueSea.mjs --apply').exit).toBe(2);
  });

  it('VERDE: backup OK → 0 diciendo "backup OK"; mencionar el script en un commit o auditar no dispara', () => {
    backupQueSale(0);
    const ok = correr('node scripts/_fixX.mjs --apply');
    expect(ok.exit).toBe(0);
    expect(ok.err).toMatch(/backup OK/);
    backupQueSale(1);   // a partir de aca, si dispara, se nota
    for (const cmd of ['git commit -m "fix: scripts/_fixX.mjs --apply"', 'node scripts/_auditAll.mjs --summary', 'cat scripts/_fixX.mjs']) {
      const r = correr(cmd);
      expect(r.exit, cmd).toBe(0);
      expect(r.err, cmd).toBe('');
    }
  });

  it('por el despachador: la marca que deja node dispara supabase-guard.sh y su exit manda', () => {
    const payload = { tool_name: 'Bash', tool_input: { command: 'node scripts/_fixX.mjs --apply' } };
    backupQueSale(1);
    const rojo = hook('_dispatcher.sh', payload, { cwd: repo });
    expect(rojo.exit).toBe(2);
    expect(rojo.err).toMatch(/BACKUP FALLO/);
    backupQueSale(0);
    const verde = hook('_dispatcher.sh', payload, { cwd: repo });
    expect(verde.exit).toBe(0);
    expect(verde.err).toMatch(/backup OK/);
  });
});

// ─────────────────────────────── agentes-guard (~/.claude/hooks): techo duro de 5 subagentes
const AGENTES = path.join(os.homedir(), '.claude', 'hooks', 'agentes-guard.sh');
describe.skipIf(!fs.existsSync(AGENTES))('agentes-guard.sh (global) — techo de 5 subagentes en 10 min, Workflow denegado', () => {
  const home = path.join(TMP, 'home');
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  const archivo = (n) => path.join(home, '.claude', n);
  const correr = (tool_name) => hook(null, { tool_name, tool_input: {} }, { ruta: AGENTES, env: { HOME: posix(home) } });
  beforeEach(() => { for (const n of ['.agent-spawns.log', '.agent-limit', '.workflow-ok']) fs.rmSync(archivo(n), { force: true }); });

  it('ROJO: Workflow siempre; el sexto Agent dentro de la ventana', () => {
    const wf = correr('Workflow');
    expect(wf.exit).toBe(2);
    expect(wf.err).toMatch(/Workflow esta deshabilitada/);
    for (let i = 0; i < 5; i++) expect(correr('Agent').exit, `spawn ${i + 1}`).toBe(0);
    const sexto = correr('Task');
    expect(sexto.exit).toBe(2);
    expect(sexto.err).toMatch(/techo de subagentes alcanzado \(5\/5/);
  });

  it('VERDE: los escapes de Fak — .agent-limit=0 apaga el techo; .workflow-ok habilita UN Workflow', () => {
    fs.writeFileSync(archivo('.agent-limit'), '0');
    for (let i = 0; i < 7; i++) expect(correr('Agent').exit).toBe(0);
    fs.rmSync(archivo('.agent-limit'));
    fs.writeFileSync(archivo('.workflow-ok'), '');
    expect(correr('Workflow').exit).toBe(0);
    expect(fs.existsSync(archivo('.workflow-ok'))).toBe(false);   // se consumio
    expect(correr('Workflow').exit).toBe(2);
  });
});
