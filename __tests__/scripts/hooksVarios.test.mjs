// Tests de los hooks que NO pasan por guardianes.mjs: cada uno con al menos un caso ROJO
// (bloquea / deja su marca) y uno VERDE (deja pasar). Hasta el 05/09/2026 estos siete no
// tenian test en ninguna direccion, y entre ellos estan los que corren el backup, los que
// frenan una escritura irreversible en Supabase y el techo de subagentes.
//
// Se corren como los corre Claude Code: `bash <hook>` con el JSON por stdin, en un TMPDIR /
// HOME / repo git temporales para no tocar los flags reales de la maquina.
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';

// Cada caso levanta bash -> node (y agentes-guard, siete veces seguidas). Solos tardan
// decimas; con la suite entera en paralelo en la notebook de Windows pasaron los 15 s del
// config (05/09/2026: 5 timeouts, todos con la maquina cargada por otra sesion). El tope
// es por carga, no por logica: 60 s aca, sin tocar el global.
vi.setConfig({ testTimeout: 60_000 });

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

// ─────────────────────── session-start-context (SessionStart compact): el nucleo trae el idioma
describe('session-start-context.sh (SessionStart) — el nucleo post-compact se emite entero y en espanol', () => {
  it('compact: exit 0, drena el JSON de stdin y el punto 6 pide seguir en espanol rioplatense', () => {
    const r = spawnSync('bash', [path.join(HOOKS, 'session-start-context.sh'), 'compact'], { input: '{"hook_event_name":"SessionStart","source":"compact"}', encoding: 'utf8', cwd: RAIZ });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/POST-COMPACT/);
    expect(r.stdout).toMatch(/^6\. Seguis en espanol rioplatense/m);
    // 11/09/2026: el criterio de caracteristicas especiales sobrevive la compactacion.
    expect(r.stdout).toMatch(/^7\. Caracteristicas especiales/m);
    expect(r.stdout).toMatch(/S 9-10/);
    expect(r.stdout).toMatch(/S 5-8 y O>=4/);
    expect(r.stdout).toMatch(/caracteristicas-especiales\.md/);
    expect(r.stdout.length).toBeLessThan(3000);      // el tope de 10 KB de salida de hook queda lejos
  });

  // 16/10/2026 (tanda 1.6): la ficha de la PC (.claude/pcs/<COMPUTERNAME>.md) se imprime al arrancar si existe.
  const inicio = (env) => spawnSync('bash', [path.join(HOOKS, 'session-start-context.sh'), 'inicio'], {
    input: '{"hook_event_name":"SessionStart","source":"startup"}', encoding: 'utf8', cwd: RAIZ,
    env: { ...process.env, CLAUDE_PROJECT_DIR: posix(RAIZ), ...env },
  });
  it('inicio en CATA: imprime la ficha .claude/pcs/CATA.md (por COMPUTERNAME, sin importar mayusculas)', () => {
    const ficha = fs.readFileSync(path.join(RAIZ, '.claude', 'pcs', 'CATA.md'), 'utf8');
    expect(ficha).toMatch(/^\[PC\] Esta sesion corre en CATA/);
    expect(ficha.length).toBeLessThan(4000);
    for (const nombre of ['CATA', 'Cata']) {
      const r = inicio({ COMPUTERNAME: nombre });
      expect(r.status, r.stderr).toBe(0);
      expect(r.stdout, `COMPUTERNAME=${nombre}`).toContain('[PC] Esta sesion corre en CATA');
      expect(r.stdout).toContain('C:\\Dev\\BarackMercosul');
    }
  });
  it('inicio en una PC sin ficha (la principal, o sin COMPUTERNAME): no imprime ninguna [PC]', () => {
    expect(inicio({ COMPUTERNAME: 'DESKTOP-14JG95B' }).stdout).not.toContain('[PC] Esta sesion corre en');
    expect(inicio({ COMPUTERNAME: '' }).stdout).not.toContain('[PC] Esta sesion corre en');
  });
  it('H8 (auditor 16/10): despues de compactar, la ficha de CATA se vuelve a imprimir junto con el nucleo', () => {
    const r = spawnSync('bash', [path.join(HOOKS, 'session-start-context.sh'), 'compact'], {
      input: '{"hook_event_name":"SessionStart","source":"compact"}', encoding: 'utf8', cwd: RAIZ,
      env: { ...process.env, CLAUDE_PROJECT_DIR: posix(RAIZ), COMPUTERNAME: 'CATA' },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/POST-COMPACT/);
    expect(r.stdout).toContain('[PC] Esta sesion corre en CATA');
    expect(r.stdout.length).toBeLessThan(6000);
  });
  it('6b (23/10/2026): si la ultima noche no arranco, el arranque imprime UN renglon [NOCHE] con el motivo; si corrio bien, nada', () => {
    const dir = fs.mkdtempSync(path.join(TMP, 'noche-'));
    const base = { fecha: '2026-10-23', inicio: '2026-10-23 06:30:19', fin: '2026-10-23 06:30:19', finMs: Date.now() - 3600e3, pasos: [], costoUsd: 0, corte: null };
    const malo = path.join(dir, 'malo.json');
    fs.writeFileSync(malo, JSON.stringify({ ...base, noArranco: 'presupuesto del ciclo en rojo (ciclo del 30/09 al 29/10): $372.76 de $170. No arranco (--sin-tope para forzar).', lineaTablero: 'Noche 23/10 06:30 · no arrancó' }));
    const bueno = path.join(dir, 'bueno.json');
    fs.writeFileSync(bueno, JSON.stringify({ ...base, pasos: [{ nombre: 'mails', estado: 'ok', detalle: '3 mails', costoUsd: 0.01 }], noArranco: null, lineaTablero: 'Noche 23/10 06:30 · mails: 3 mails · $0,01' }));
    const con = inicio({ COMPUTERNAME: 'DESKTOP-14JG95B', BARACK_NOCTURNO_ESTADO: posix(malo) });
    expect(con.status, con.stderr).toBe(0);
    expect(con.stdout).toMatch(/\[NOCHE\] Noche 23\/10 06:30 NO ARRANCO: presupuesto del ciclo en rojo/);
    expect(con.stdout.split('[NOCHE]').length - 1).toBe(1);
    const sin = inicio({ COMPUTERNAME: 'DESKTOP-14JG95B', BARACK_NOCTURNO_ESTADO: posix(bueno) });
    expect(sin.status, sin.stderr).toBe(0);
    expect(sin.stdout).not.toContain('[NOCHE]');
  });
  it('H6 / N1 (auditor 16/10): el aviso «PC nueva» de la ULTIMA sincronizacion se imprime al arrancar; si la ultima dijo que no falta nada (archivo vacio), nada', () => {
    const dir = fs.mkdtempSync(path.join(TMP, 'pcn-'));
    const archivo = path.join(dir, 'pc-nueva.txt');
    fs.writeFileSync(archivo, '[PC NUEVA] A esta PC (PRUEBA) le falta 1 cosa para correr los scripts de la casa: ffmpeg -> winget install Gyan.FFmpeg.\n', 'utf8');
    const con = inicio({ COMPUTERNAME: 'DESKTOP-14JG95B', BARACK_PC_NUEVA_ARCHIVO: posix(archivo) });
    expect(con.stdout).toContain('[PC NUEVA] A esta PC (PRUEBA) le falta 1 cosa');
    expect(con.stdout.split('[PC NUEVA]').length - 1).toBe(1);
    fs.writeFileSync(archivo, '', 'utf8');                                                      // la ultima sincronizacion: nada falta
    expect(inicio({ COMPUTERNAME: 'DESKTOP-14JG95B', BARACK_PC_NUEVA_ARCHIVO: posix(archivo) }).stdout).not.toContain('[PC NUEVA]');
    expect(inicio({ COMPUTERNAME: 'DESKTOP-14JG95B', BARACK_PC_NUEVA_ARCHIVO: posix(path.join(dir, 'no-existe.txt')) }).stdout).not.toContain('[PC NUEVA]');
  });
});

// ──────────── caracteristicas-especiales-prompt (UserPromptSubmit): el criterio cuando Fak lo nombra
describe('caracteristicas-especiales-prompt.sh (UserPromptSubmit) — inyecta el criterio CC/SC sin cooldown, nunca bloquea', () => {
  // Fak, 11/09/2026: "siempre que te preguntes, recuerdes todo esto... me gustan esas memorias
  // pero a veces no las lees". Los disparadores viven en core/amfe/caracteristicasEspeciales.data.json.
  const correr = (prompt) => hook('caracteristicas-especiales-prompt.sh', { hook_event_name: 'UserPromptSubmit', prompt });
  const inyecta = (prompt) => {
    const r = correr(prompt);
    expect(r.exit).toBe(0);
    if (!r.out.trim()) return '';
    const j = JSON.parse(r.out);
    expect(j.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
    return j.hookSpecificOutput.additionalContext;
  };
  it('ROJO (inyecta): "que es TLD", "la sigla", "caracteristicas especiales", "marcas del flujograma", CC/SC', () => {
    for (const p of [
      'nunca entendi si D / TLD van siempre juntos o son cosas distintas',
      'porque seria d tld etc justifica dale',
      'la sigla esa de la costura esta bien?',
      'revisa las caracteristicas especiales del insert',
      'las marcas del flujograma 154 estan alineadas con el amfe?',
      'cc/sc de las 3 piezas para el casillero 17',
      'es critica o significativa esa causa?',
    ]) {
      const texto = inyecta(p);
      expect(texto, p).toMatch(/CARACTERISTICAS ESPECIALES/);
      expect(texto, p).toMatch(/S 9 o 10/);
      expect(texto, p).toMatch(/S 5 a 8 Y O >= 4/);
      expect(texto, p).toMatch(/NUNCA porque otro documento/);
    }
  });
  it('VERDE (vacio): un mensaje que no nombra el tema no recibe nada', () => {
    for (const p of ['arma el mail para Manuel', 'corre el backup y commitea', 'que hora es', 'fijate el consumo de adhesivo del top roll']) {
      expect(inyecta(p), p).toBe('');
    }
  });
  it('sin cooldown: dos mensajes seguidos sobre el tema reciben el texto las dos veces', () => {
    expect(inyecta('que es TLD?')).toMatch(/CARACTERISTICAS ESPECIALES/);
    expect(inyecta('y la W que es?')).toMatch(/CARACTERISTICAS ESPECIALES/);
  });
  it('VERDE (vacio): un aviso automatico que nombra CC/SC no es un mensaje de Fak; el mismo texto sin envoltorio si inyecta', () => {
    // 26/09/2026: el recordatorio entro dos veces sobre avisos de fin de agente que decian "CC/SC".
    const cuerpo = 'El agente termino: revise las CC/SC de las 3 piezas para el casillero 17.';
    expect(inyecta(`<task-notification>\n<status>completed</status>\n<result>${cuerpo}</result>\n</task-notification>`)).toBe('');
    expect(inyecta(`[SYSTEM NOTIFICATION] ${cuerpo}`)).toBe('');
    expect(inyecta(cuerpo)).toMatch(/CARACTERISTICAS ESPECIALES/);
  });
  it('JSON roto por stdin: exit 0 y no rompe el turno', () => {
    const r = hook('caracteristicas-especiales-prompt.sh', null, { stdin: '{no es json' });
    expect(r.exit).toBe(0);
  });
});

// ──────────────── instrucciones-log (InstructionsLoaded): registro de lo que se cargo DE VERDAD
describe('instrucciones-log.sh (InstructionsLoaded) — siempre exit 0; deja una linea TSV por carga', () => {
  const proyecto = path.join(TMP, 'proy');
  fs.mkdirSync(path.join(proyecto, '.claude'), { recursive: true });
  const LOG = path.join(proyecto, '.claude', '.instrucciones-cargadas.log');
  const correr = (payload, extra) => hook('instrucciones-log.sh', payload, { env: { CLAUDE_PROJECT_DIR: posix(proyecto) }, ...extra });
  beforeEach(() => fs.rmSync(LOG, { force: true }));

  it('ROJO (deja marca): CLAUDE.md por session_start y LECCIONES por include quedan en el log con su razon y su ruta', () => {
    const r = correr({ session_id: 'abcdef1234', hook_event_name: 'InstructionsLoaded', file_path: 'C:\\Dev\\BarackMercosul\\CLAUDE.md', load_reason: 'session_start', memory_type: 'Project', trigger: '' });
    expect(r.exit).toBe(0);
    expect(r.out).toBe('');
    correr({ session_id: 'abcdef1234', hook_event_name: 'InstructionsLoaded', file_path: 'C:\\Dev\\BarackMercosul\\docs\\LECCIONES_APRENDIDAS.md', load_reason: 'include' });
    const lineas = fs.readFileSync(LOG, 'utf8').trim().split('\n');
    expect(lineas).toHaveLength(2);
    expect(lineas[0]).toMatch(/\tabcdef12\tsession_start\tProject\tC:\\Dev\\BarackMercosul\\CLAUDE\.md$/);
    expect(lineas[1]).toMatch(/\tinclude\t\tC:\\Dev\\BarackMercosul\\docs\\LECCIONES_APRENDIDAS\.md$/);
  });

  it('VERDE (no rompe nada): un payload ilegible tambien es exit 0 y deja una linea con "?"', () => {
    expect(correr(null, { stdin: '{roto' }).exit).toBe(0);
    expect(fs.readFileSync(LOG, 'utf8')).toMatch(/\t\?\t\t\?$/m);
  });
});

// ───────────────────────────────────────────── pregunta-guard (AskUserQuestion): solo aviso
describe('pregunta-guard.sh (AskUserQuestion) — sin nada que frenar, recordatorio por additionalContext (el bloqueo: preguntaGuard.test.mjs)', () => {
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
  // exports/ de prueba VACIO (HOY-12, 11/10/2026): el hook real barria el exports/ de la PC buscando documentos posteriores al
  // mensaje de Fak (del 02/09: cientos) y el detector en python se comia sus 90 s; el test del chequeo 6 daba rojo por tiempo.
  const exportsVacio = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-exports-vacio-'));
  const stop = (last_assistant_message, extra = {}) => hook('cierre-guard.sh', {
    hook_event_name: 'Stop', stop_hook_active: false, transcript_path: posix(transcript), last_assistant_message, ...extra,
  }, { env: { VITEST: 'true', CIERRE_GUARD_EXPORTS_PRUEBA: exportsVacio } });

  it('ROJO: el turno termina pidiendo permiso para mi propio trabajo → 2 con el motivo', () => {
    const r = stop('Tengo el script listo y probado en dry-run. ¿Arranco?');
    expect(r.exit).toBe(2);
    expect(r.err.length).toBeGreaterThan(20);
  });

  // Hasta el 22/09 el VERDE era "Sigo con el paso 3: corriendo los tests del modulo." con el transcript
  // vacio: nada corria, y un turno que termina asi es el "sigo sigo sigo" que frena el chequeo 6.
  it('VERDE: stop_hook_active (segundo Stop del turno) y un parcial que espera a Fak → 0', () => {
    expect(stop('¿Arranco?', { stop_hook_active: true }).exit).toBe(0);
    const r = stop('Los tests del modulo dan 42 de 42. Espero tu foto de la pieza para el paso 3.');
    expect(r.exit).toBe(0);
    expect(r.err).toBe('');
  });

  it('ROJO (chequeo 6): el turno termina en "Sigo." y no corre nada → 2 con el motivo (e5b1b3cc 21/09 13:24)', () => {
    const r = stop('Me falta el último tramo: convertir eso a la estructura de la app y escribirlo en Supabase. Sigo.');
    expect(r.exit).toBe(2);
    expect(r.err).toMatch(/anunciando trabajo/);
    expect(r.err).toMatch(/sigo sigo sigo/);
  });

  // El texto no usa "termine": declaraCierre lo lee como cierre ("termin[eé]" sin acento) y con el
  // repo sucio el chequeo 3 daria 2 por otro motivo; aca se prueba solo el 6.
  it('VERDE (chequeo 6): "sigo cuando llegue su aviso" con el agente lanzado y sin su aviso de fin → 0', () => {
    const conAgente = path.join(TMP, 'transcript-agente.jsonl');
    fs.writeFileSync(conAgente, [
      JSON.stringify({ type: 'user', timestamp: '2026-09-02T00:50:00.000Z', message: { content: 'cerra la tarea' } }),
      JSON.stringify({ type: 'assistant', timestamp: '2026-09-02T00:59:00.000Z', message: { content: [{ type: 'tool_use', id: 'toolu_aud', name: 'Agent', input: { description: 'Auditar el cierre', prompt: 'audita' } }] } }),
      JSON.stringify({ type: 'user', timestamp: '2026-09-02T00:59:01.000Z', message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_aud', content: 'Async agent launched successfully.' }] }, toolUseResult: { isAsync: true, status: 'async_launched', agentId: 'af2d68113acb20be2' } }),
    ].join('\n') + '\n');
    const r = stop('El auditor está corriendo; sigo cuando llegue su aviso.', { transcript_path: posix(conAgente) });
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

// ─────────────── agentes-guard (~/.claude/hooks): techo de 10 subagentes; el modelo por tarea (08/10); auditoria en Opus
const AGENTES = path.join(os.homedir(), '.claude', 'hooks', 'agentes-guard.sh');
describe.skipIf(!fs.existsSync(AGENTES))('agentes-guard.sh (global) — techo de 10 en 10 min, modelo por tarea, Workflow prendida y contada', () => {
  const home = path.join(TMP, 'home');
  const proyecto = path.join(TMP, 'proyecto-agentes');
  fs.mkdirSync(path.join(home, '.claude', 'agents'), { recursive: true });
  fs.mkdirSync(path.join(proyecto, '.claude', 'agents'), { recursive: true });
  const def = (dir, nombre, cabeza) => fs.writeFileSync(path.join(dir, '.claude', 'agents', `${nombre}.md`),
    `---\nname: ${nombre}\ndescription: prueba\n${cabeza}---\n\ncuerpo con model: opus y effort: max afuera del frontmatter\n`);
  def(home, 'investigador', 'model: sonnet\neffort: xhigh\n');
  def(home, 'en-max', 'model: sonnet\neffort: max\n');
  def(proyecto, 'auditor', 'effort: xhigh\nmodel: opus\nmemory: project\n');
  def(proyecto, 'auditor-cliente', 'model: sonnet\neffort: xhigh\n');   // auditoria final en Sonnet: rojo
  def(proyecto, 'en-opus', 'model: opus\neffort: xhigh\n');
  const archivo = (n) => path.join(home, '.claude', n);
  const env = { HOME: posix(home), CLAUDE_PROJECT_DIR: posix(proyecto) };
  const correr = (tool_name, tool_input = { subagent_type: 'investigador', prompt: 'x' }, extra = {}) =>
    hook(null, { tool_name, tool_input, ...extra }, { ruta: AGENTES, env });
  beforeEach(() => {
    for (const n of ['.agent-spawns.log', '.agent-limit', '.workflow-ok', '.agent-builtin-ok', '.agent-opus-ok']) fs.rmSync(archivo(n), { force: true });
  });

  it('presupuesto por costo (Fak, 08/10): haiku 1 · sonnet 4 · opus 8 · fable 20 puntos; el techo de 10 vale 40 puntos', () => {
    const inv = (model, extra = {}) => correr('Agent', { subagent_type: 'investigador', model, prompt: 'x', ...extra });
    // 3 haiku (3) + sonnet (7) + opus (15) + fable (35): todo pasa
    expect(inv('haiku').exit).toBe(0);
    expect(inv('claude-haiku-5-5').exit).toBe(0);
    expect(inv('haiku').exit).toBe(0);
    expect(inv('sonnet').exit).toBe(0);
    expect(inv('opus').exit).toBe(0);
    expect(inv('fable').exit).toBe(0);
    // ROJO: otro opus (8) pasaria los 40
    const otro = inv('claude-opus-5-5');
    expect(otro.exit).toBe(2);
    expect(otro.err).toMatch(/presupuesto de subagentes agotado \(35\/40 puntos/);
    expect(otro.err).toMatch(/esta llamada pesa 8/);
    // un haiku (1) todavia entra (36); la auditoria final no descuenta; un sonnet llega justo a 40
    expect(inv('haiku').exit).toBe(0);
    expect(correr('Agent', { subagent_type: 'auditor', model: 'opus', prompt: 'x' }).exit).toBe(0);
    expect(inv('sonnet').exit).toBe(0);
    // y el siguiente haiku ya no (41 > 40)
    expect(inv('haiku').exit).toBe(2);
    // el log guarda el peso de cada llamada
    const log = fs.readFileSync(archivo('.agent-spawns.log'), 'utf8').trim().split('\n');
    expect(log.map((l) => l.split(' ')[2])).toEqual(['1', '1', '1', '4', '8', '20', '1', '0', '4']);
  });

  it('el pase de Fak (.agent-opus-ok): Opus y Fable descuentan como Sonnet; vencido a las 13 h se retira', () => {
    const inv = (model) => correr('Agent', { subagent_type: 'investigador', model, prompt: 'x' });
    // sin pase: el sexto opus (48) no entra en 40
    for (let i = 0; i < 5; i++) expect(inv('opus').exit, `opus ${i + 1}`).toBe(0);
    expect(inv('opus').exit).toBe(2);
    // con pase: el mismo sexto opus pesa 4 -> 5x8 ya registrados = 40... el log viejo sigue pesando 8 cada uno,
    // asi que se arranca de nuevo para medir el pase solo
    fs.rmSync(archivo('.agent-spawns.log'), { force: true });
    fs.writeFileSync(archivo('.agent-opus-ok'), '');
    for (let i = 0; i < 10; i++) expect(inv('opus').exit, `opus con pase ${i + 1}`).toBe(0);   // 10 x 4 = 40
    expect(inv('fable').exit).toBe(2);                                                            // 44 > 40
    // ROJO: un pase de hace 13 h no vale y se retira (y el opus vuelve a pesar 8)
    fs.rmSync(archivo('.agent-spawns.log'), { force: true });
    const hace13h = Date.now() / 1000 - 13 * 3600;
    fs.utimesSync(archivo('.agent-opus-ok'), hace13h, hace13h);
    expect(inv('opus').exit).toBe(0);
    expect(fs.existsSync(archivo('.agent-opus-ok'))).toBe(false);
    expect(fs.readFileSync(archivo('.agent-spawns.log'), 'utf8').trim().split(' ')[2]).toBe('8');
  });

  it('buscador (haiku + medium en la definicion) pesa 1 aunque la llamada no diga modelo; una definicion haiku con effort low se rechaza', () => {
    def(home, 'buscador', 'model: haiku\neffort: medium\n');
    def(home, 'haiku-flojo', 'model: haiku\neffort: low\n');
    fs.writeFileSync(archivo('.agent-limit'), '2');   // 8 puntos
    for (let i = 0; i < 8; i++) expect(correr('Agent', { subagent_type: 'buscador', prompt: 'x' }).exit, `buscador ${i + 1}`).toBe(0);
    const noveno = correr('Agent', { subagent_type: 'buscador', prompt: 'x' });
    expect(noveno.exit).toBe(2);
    expect(noveno.err).toMatch(/\(8\/8 puntos/);
    expect(correr('Agent', { subagent_type: 'haiku-flojo', prompt: 'x' }).err).toMatch(/no dice effort: medium, high o xhigh/);
  });

  it('esfuerzo y modelos: la llamada puede bajar el esfuerzo, nunca max; un modelo que no existe se rechaza', () => {
    const inv = (model, extra = {}) => correr('Agent', { subagent_type: 'investigador', model, prompt: 'x', ...extra });
    expect(inv('haiku', { effort: 'medium' }).exit).toBe(0);
    expect(inv('sonnet', { effort: 'low' }).exit).toBe(0);
    expect(inv('sonnet', { effort: 'max' }).err).toMatch(/effort=max/);
    expect(inv('gpt').err).toMatch(/model=gpt/);
    expect(correr('Agent', { subagent_type: 'en-max', model: 'opus', prompt: 'x' }).err).toMatch(/no dice effort: xhigh/);
    expect(correr('Agent', { subagent_type: 'general-purpose', model: 'opus', prompt: 'x' }).exit).toBe(2);
    expect(correr('Agent', { subagent_type: 'auditor', model: 'sonnet', prompt: 'x' }).err).toMatch(/auditoria final y corre en Opus/);
  });

  it('.agent-limit=0 apaga el presupuesto entero (apaga el CONTEO); la regla de esfuerzo sigue', () => {
    fs.writeFileSync(archivo('.agent-limit'), '0');
    for (let i = 0; i < 7; i++) expect(correr('Agent', { subagent_type: 'investigador', model: 'opus', prompt: 'x' }).exit).toBe(0);   // 56 > 40
    expect(correr('Agent', { subagent_type: 'investigador', model: 'opus', effort: 'max', prompt: 'x' }).exit).toBe(2);
  });

  // Workflow prendida (Fak, 16/10; re-prendida el 24/10/2026). La llamada real trae script | scriptPath | name | args,
  // sin model ni effort (esquema de la tool y las 25 llamadas de los registros): el guardian lee el guion. Los payloads
  // de abajo tienen esa forma; un campo model/effort inventado arriba pasaria sin probar nada de una llamada real.
  const guion = (cuerpo) => `export const meta = { name: 'prueba', description: 'prueba del guardian' }\n${cuerpo}`;
  const wf = (cuerpo, extra = {}) => correr('Workflow', { script: guion(cuerpo), ...extra });
  const registro = () => (fs.existsSync(archivo('.agent-spawns.log')) ? fs.readFileSync(archivo('.agent-spawns.log'), 'utf8') : '')
    .split('\n').filter(Boolean).map((l) => l.split(' ').slice(1).join(' '));

  it('ROJO: el undecimo Agent (Sonnet, 4 puntos) dentro de la ventana; con el presupuesto agotado un Workflow se frena igual', () => {
    for (let i = 0; i < 10; i++) expect(correr('Agent').exit, `spawn ${i + 1}`).toBe(0);
    const once = correr('Task');
    expect(once.exit).toBe(2);
    expect(once.err).toMatch(/presupuesto de subagentes agotado \(40\/40 puntos/);
    const w = wf("await agent('revisar', { model: 'haiku' })");
    expect(w.exit).toBe(2);
    expect(w.err).toMatch(/presupuesto de subagentes agotado \(40\/40 puntos/);
    expect(w.err).toMatch(/esta llamada pesa 1/);
    expect(registro().filter((l) => l.startsWith('Workflow'))).toEqual([]);   // frenado no descuenta
  });

  it('VERDE: Workflow pasa y descuenta UNA vez con el modelo mas pesado que declara el guion; sin modelo, como Opus', () => {
    const pesoDe = (cuerpo) => {
      fs.rmSync(archivo('.agent-spawns.log'), { force: true });
      const r = wf(cuerpo);
      expect(r.exit, `${cuerpo}\n${r.err}`).toBe(0);
      expect(r.out, cuerpo).toBe('');                                      // sin aviso P5: eso es para un Sonnet suelto
      return registro().at(-1);
    };
    expect(pesoDe("await agent('a', { model: 'haiku', effort: 'low' })")).toBe('Workflow 1');
    expect(pesoDe("await agent('a', { agentType: 'investigador' })")).toBe('Workflow 4');       // la definicion es sonnet
    expect(pesoDe("await agent('a', { label: 'x' })")).toBe('Workflow 8');                     // hereda la sesion: Opus
    expect(pesoDe('await agent("a", { model: "haiku" }); await agent("b", { model: "claude-opus-5-5", effort: "high" })')).toBe('Workflow 8');
    expect(pesoDe("await agent('a', { model: 'fable', effort: 'xhigh' })")).toBe('Workflow 20');
    expect(pesoDe("await agent('a', { agentType: 'auditor' })")).toBe('Workflow 8');            // adentro de un Workflow no es la auditoria final
    // con el pase de Fak (.agent-opus-ok) Opus y Fable descuentan como Sonnet, igual que en Agent
    fs.writeFileSync(archivo('.agent-opus-ok'), '');
    expect(pesoDe("await agent('a', { model: 'fable' })")).toBe('Workflow 4');
  });

  it('ROJO: Workflow con effort max (comillas simples, dobles o invertidas), un model que no existe o un agentType sin definicion propia o sin xhigh; tambien con .agent-limit=0, y no gasta cupo', () => {
    const casos = [
      ["await agent('a', { effort: 'max' })", /effort 'max'/],
      ['await agent("a", { effort: "max" })', /effort 'max'/],
      ['await agent(`a`, { effort: `max` })', /effort 'max'/],
      ["await agent('a', { model: 'gpt-5' })", /model 'gpt-5'/],
      ["await agent('a', { agentType: 'general-purpose' })", /no tiene definicion propia/],
      ["await agent('a', { agentType: 'en-max' })", /no dice effort: xhigh/],
      ["await agent('a', { agentType: 'en-opus' })", /no dice model: sonnet ni haiku/],
      ["await agent('a', { agentType: 'auditor-cliente' })", /no dice model: opus/],
    ];
    for (const [cuerpo, msj] of casos) {
      const r = wf(cuerpo);
      expect(r.exit, cuerpo).toBe(2);
      expect(r.err, cuerpo).toMatch(/BLOQUEADO \(Workflow\)/);
      expect(r.err, cuerpo).toMatch(msj);
    }
    // .agent-limit=0 apaga el conteo, no la regla de esfuerzo
    fs.writeFileSync(archivo('.agent-limit'), '0');
    expect(wf("await agent('a', { effort: 'max' })").exit).toBe(2);
    expect(wf("await agent('a', { effort: 'xhigh' })").exit).toBe(0);
    expect(registro()).toEqual([]);
  });

  it('el guion tambien se lee del archivo de scriptPath (ruta de Windows con espacio) y de .claude/workflows/<name>.js del proyecto', () => {
    const dir = fs.mkdtempSync(path.join(TMP, 'wf-guion-'));
    const bueno = path.join(dir, 'bueno.js');
    const malo = path.join(dir, 'con max.js');
    fs.writeFileSync(bueno, guion("await agent('a', { model: 'haiku' })"));
    fs.writeFileSync(malo, guion('await agent("a", { effort: "max" })'));
    expect(correr('Workflow', { scriptPath: bueno }).exit).toBe(0);
    expect(registro().at(-1)).toBe('Workflow 1');
    const m = correr('Workflow', { scriptPath: malo });
    expect(m.exit).toBe(2);
    expect(m.err).toMatch(/effort 'max'/);
    const no = correr('Workflow', { scriptPath: path.join(dir, 'no-existe.js') });
    expect(no.exit).toBe(2);
    expect(no.err).toMatch(/No se puede leer el guion/);
    fs.mkdirSync(path.join(proyecto, '.claude', 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(proyecto, '.claude', 'workflows', 'guardado-max.js'), guion("await agent('a', { effort: 'max' })"));
    fs.writeFileSync(path.join(proyecto, '.claude', 'workflows', 'guardado-ok.js'), guion("await agent('a', { agentType: 'investigador', model: 'haiku' })"));
    expect(correr('Workflow', { name: 'guardado-max' }).exit).toBe(2);
    expect(correr('Workflow', { name: 'guardado-ok', args: { rama: 'x' } }).exit).toBe(0);
    expect(registro().at(-1)).toBe('Workflow 4');
  });

  it('VERDE: una operacion sobre una corrida (solo runId: pararla) pasa sin descontar, aun con el presupuesto agotado', () => {
    for (let i = 0; i < 10; i++) expect(correr('Agent').exit).toBe(0);
    expect(correr('Workflow', { runId: 'wf_abc123' }).exit).toBe(0);
    expect(registro().filter((l) => l.startsWith('Workflow'))).toEqual([]);
  });

  it('VERDE: .agent-limit=0 apaga el techo para Agent y para Workflow; un .workflow-ok viejo ya no hace nada (pase retirado el 24/10)', () => {
    fs.writeFileSync(archivo('.agent-limit'), '0');
    for (let i = 0; i < 12; i++) expect(correr('Agent').exit).toBe(0);
    expect(wf("await agent('a', { model: 'fable' })").exit).toBe(0);
    fs.rmSync(archivo('.agent-limit'));
    fs.writeFileSync(archivo('.workflow-ok'), '');
    expect(wf("await agent('a', { effort: 'max' })").exit).toBe(2);   // el pase no salta la regla
    expect(fs.existsSync(archivo('.workflow-ok'))).toBe(true);           // y nadie lo consume
  });

  it('A6 ROJO: un .agent-limit=0 de hace 13 h ya no apaga el guard — el undecimo Agent bloquea y el archivo se retira', () => {
    fs.writeFileSync(archivo('.agent-limit'), '0');
    const hace13h = Date.now() / 1000 - 13 * 3600;
    fs.utimesSync(archivo('.agent-limit'), hace13h, hace13h);
    for (let i = 0; i < 10; i++) expect(correr('Agent').exit, `spawn ${i + 1}`).toBe(0);
    const once = correr('Agent');
    expect(once.exit).toBe(2);
    expect(once.err).toMatch(/presupuesto de subagentes agotado \(40\/40 puntos/);
    expect(fs.existsSync(archivo('.agent-limit'))).toBe(false);
  });

  it('VERDE: pasan los agentes cuya definicion dice model sonnet y effort xhigh (en ~/.claude o en el proyecto)', () => {
    expect(correr('Agent', { subagent_type: 'investigador', prompt: 'x' }).exit).toBe(0);
    expect(correr('Agent', { subagent_type: 'investigador', model: 'sonnet', prompt: 'x' }).exit).toBe(0);
    // la auditoria final corre en Opus (Fak, 30/09/2026)
    expect(correr('Agent', { subagent_type: 'auditor', prompt: 'x' }).exit).toBe(0);
    expect(correr('Agent', { subagent_type: 'auditor', model: 'opus', prompt: 'x' }).exit).toBe(0);
    // un "subagent_type" citado adentro del prompt no confunde al lector del payload
    expect(correr('Agent', { subagent_type: 'investigador', prompt: 'lanzá "subagent_type": "fork"' }).exit).toBe(0);
  });

  it('ROJO: built-in, fork, sin tipo, model desconocido, o definicion sin sonnet/xhigh — y no gastan cupo', () => {
    const casos = [
      [{ subagent_type: 'general-purpose', prompt: 'x' }, /no tiene definicion propia/],
      [{ subagent_type: 'Explore', prompt: 'x' }, /no tiene definicion propia/],
      [{ prompt: 'x' }, /no dice subagent_type/],
      [{ subagent_type: 'fork', prompt: 'x' }, /fork corre en el modelo/],
      [{ subagent_type: 'investigador', model: 'gemini', prompt: 'x' }, /model=gemini/],
      [{ subagent_type: 'en-max', prompt: 'x' }, /no dice effort: xhigh/],
      [{ subagent_type: 'en-opus', prompt: 'x' }, /no dice model: sonnet/],
      [{ subagent_type: 'auditor-cliente', prompt: 'x' }, /no dice model: opus/],
      [{ subagent_type: 'auditor', model: 'sonnet', prompt: 'x' }, /auditoria final y corre en Opus/],
    ];
    for (const [input, msj] of casos) {
      const r = correr('Agent', input);
      expect(r.exit, JSON.stringify(input)).toBe(2);
      expect(r.err).toMatch(msj);
    }
    // el .agent-limit=0 apaga el conteo, no esta regla
    fs.writeFileSync(archivo('.agent-limit'), '0');
    expect(correr('Agent', { subagent_type: 'general-purpose', prompt: 'x' }).exit).toBe(2);
    expect(fs.existsSync(archivo('.agent-spawns.log')) ? fs.readFileSync(archivo('.agent-spawns.log'), 'utf8') : '').toBe('');
  });

  it('pase de sesion: un built-in pasa solo en ESA sesion y con model sonnet explicito', () => {
    fs.writeFileSync(archivo('.agent-builtin-ok'), 'sesion-1\n');
    const gp = (model, session_id) => correr('Agent', { subagent_type: 'general-purpose', prompt: 'x', ...(model ? { model } : {}) }, { session_id });
    expect(gp('sonnet', 'sesion-1').exit).toBe(0);
    expect(gp(undefined, 'sesion-1').err).toMatch(/model sonnet explicito/);
    expect(gp('sonnet', 'sesion-2').exit).toBe(2);
    expect(correr('Agent', { subagent_type: 'fork', model: 'sonnet', prompt: 'x' }, { session_id: 'sesion-1' }).exit).toBe(2);
  });
});
