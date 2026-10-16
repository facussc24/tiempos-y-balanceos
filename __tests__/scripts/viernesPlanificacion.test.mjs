// Viernes de planificacion (Fak, 15/10/2026: "que el lo sepa y me lo sugiera"; no es tarea programada).
// En las dos direcciones: el aviso sale un viernes en una sesion nueva que abrio Fak, y calla otro dia, en una sesion
// lanzada por otra o por el reloj, sin registro de la app, en un resume y la segunda vez del mismo viernes.
// Los registros de la app son de mentira (APPDATA en una carpeta temporal), con la forma medida el 16/10/2026 en
// %APPDATA%\Claude\claude-code-sessions: `spawnedFrom` en la hija de la tanda 10, `scheduledTaskId` en las del reloj.
import { describe, it, expect, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as V from '../../scripts/_lib/viernesPlanificacion.mjs';

// El caso por bash corre el arranque entero (cerebro, seguimientos, hilos, novedades, vigia): decimas solo, mas con la
// PC cargada. El tope es por carga, no por logica (mismo criterio que hooksVarios).
vi.setConfig({ testTimeout: 60_000 });

const RAIZ = process.cwd();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'viernes-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

const VIERNES = new Date(2026, 9, 16, 10, 0);    // vie 16/10/2026 10:00, hora de la PC
const JUEVES = new Date(2026, 9, 15, 10, 0);
const VIERNES_NOCHE = new Date(2026, 9, 16, 22, 30); // en UTC ya es sabado: tiene que seguir siendo viernes

let n = 0;
/** Un APPDATA de mentira con el registro de una sesion (o sin ninguno). */
function appdata(registro) {
  const base = path.join(TMP, `app-${n++}`);
  const dir = path.join(base, 'Claude', 'claude-code-sessions', 'cuenta', 'org');
  fs.mkdirSync(dir, { recursive: true });
  if (registro) fs.writeFileSync(path.join(dir, `${registro.sessionId}.json`), JSON.stringify(registro));
  return base;
}
const ABIERTA_POR_FAK = { sessionId: 'local_aaaaaaaa-1111-2222-3333-444444444444', cliSessionId: 'cli-fak', title: 'Plan sistema' };
const HIJA = { sessionId: 'local_bbbbbbbb-1111-2222-3333-444444444444', cliSessionId: 'cli-hija', spawnedFrom: { sessionId: 'local_aaaaaaaa-1111-2222-3333-444444444444', taskId: 'task_e1bbf120', title: 'Tanda 10' } };
const RELOJ = { sessionId: 'local_cccccccc-1111-2222-3333-444444444444', cliSessionId: 'cli-reloj', scheduledTaskId: 'seguimiento-reunion-amfe' };
const inicio = (session_id) => ({ hook_event_name: 'SessionStart', source: 'startup', session_id });

describe('viernesPlanificacion — la decision', () => {
  const env = (reg) => ({ APPDATA: appdata(reg), CLAUDE_CODE_HOST_SESSION_ID: reg ? reg.sessionId : '' });
  const decide = (ahora, reg, extra = {}) => {
    const e = { ...env(reg), ...(extra.env || {}) };
    const encontrado = V.buscarRegistro({ env: e, cliId: extra.cliId ?? null, ahora });
    return V.decidir({ ahora, payload: extra.payload ?? inicio(reg ? reg.cliSessionId : 'x'), env: e, encontrado, ultimoAviso: extra.ultimoAviso ?? null });
  };

  it('VERDE: un viernes, sesion nueva que abrio Fak -> avisa', () => {
    const d = decide(VIERNES, ABIERTA_POR_FAK);
    expect(d.avisar).toBe(true);
    expect(d.motivo).toMatch(/la abrió Fak/);
  });
  it('VERDE: viernes a las 22:30 de la PC (sabado en UTC) sigue siendo viernes', () => {
    expect(V.esViernes(VIERNES_NOCHE)).toBe(true);
    expect(decide(VIERNES_NOCHE, ABIERTA_POR_FAK).avisar).toBe(true);
  });
  it('ROJO: otro dia -> calla', () => {
    expect(decide(JUEVES, ABIERTA_POR_FAK)).toEqual({ avisar: false, motivo: 'no es viernes' });
  });
  it('ROJO: sesion lanzada por otra (spawnedFrom) -> calla', () => {
    const d = decide(VIERNES, HIJA);
    expect(d.avisar).toBe(false);
    expect(d.motivo).toMatch(/otra sesión/);
  });
  it('ROJO: sesion lanzada por el reloj (scheduledTaskId o CLAUDE_CODE_HOST_SCHEDULED_RUN) -> calla', () => {
    expect(decide(VIERNES, RELOJ).avisar).toBe(false);
    expect(decide(VIERNES, ABIERTA_POR_FAK, { env: { CLAUDE_CODE_HOST_SCHEDULED_RUN: '1' } }).avisar).toBe(false);
  });
  it('ROJO: la ficha de la app es de otra charla (un claude lanzado desde una sesion de Fak hereda su id de la app) -> calla', () => {
    const d = decide(VIERNES, ABIERTA_POR_FAK, { payload: inicio('cli-de-otra-charla') });
    expect(d.avisar).toBe(false);
    expect(d.motivo).toMatch(/otra charla/);
    // una ficha que todavia no trae su id de charla no se compara: no calla por eso
    const sinId = { ...ABIERTA_POR_FAK }; delete sinId.cliSessionId;
    expect(decide(VIERNES, sinId, { payload: inicio('cli-cualquiera') }).avisar).toBe(true);
  });
  it('ROJO: sin registro de la app -> calla (ante la duda)', () => {
    const d = decide(VIERNES, null, { cliId: 'cli-que-no-esta' });
    expect(d.avisar).toBe(false);
    expect(d.motivo).toMatch(/ante la duda/);
  });
  it('ROJO: un resume, un clear o un arranque sin source -> calla', () => {
    for (const source of ['resume', 'clear', 'compact', undefined]) {
      expect(decide(VIERNES, ABIERTA_POR_FAK, { payload: { hook_event_name: 'SessionStart', source, session_id: 'cli-fak' } }).avisar).toBe(false);
    }
  });
  it('ROJO: la segunda sesion del mismo viernes -> calla; el viernes siguiente vuelve', () => {
    expect(decide(VIERNES, ABIERTA_POR_FAK, { ultimoAviso: '2026-10-16' }).avisar).toBe(false);
    expect(decide(new Date(2026, 9, 23, 9, 0), ABIERTA_POR_FAK, { ultimoAviso: '2026-10-16' }).avisar).toBe(true);
  });
  it('sin CLAUDE_CODE_HOST_SESSION_ID busca por cliSessionId entre las fichas recientes', () => {
    const e = { APPDATA: appdata(ABIERTA_POR_FAK) };
    expect(V.buscarRegistro({ env: e, cliId: 'cli-fak', ahora: new Date() })).toMatchObject({ por: 'cli' });
    expect(V.buscarRegistro({ env: e, cliId: 'otra', ahora: new Date() })).toBeNull();
    // con un id de la app que no tiene ficha, prueba por el id de la charla, que tiene que coincidir exacto
    const sinFicha = { ...e, CLAUDE_CODE_HOST_SESSION_ID: 'local_dddddddd-1111-2222-3333-444444444444' };
    expect(V.buscarRegistro({ env: sinFicha, cliId: 'cli-fak' })).toMatchObject({ por: 'cli' });
    expect(V.buscarRegistro({ env: sinFicha, cliId: 'cli-ajena' })).toBeNull();
  });
  it('el aviso nombra los 4 numeros con las fechas de la semana, la plantilla de la nube y que decide Fak', () => {
    const t = V.aviso(VIERNES);
    expect(t.startsWith(V.MARCA)).toBe(true);
    expect(t).toContain('node scripts/_cuatroNumeros.mjs --desde 2026-10-09 --hasta 2026-10-16');
    expect(t).toContain('00_encargo_equipo.md');
    expect(t).toContain('Propongo:');
    expect(t).toContain('no es tarea programada');
    expect(t).not.toMatch(/\n/);   // un solo renglon
  });
  it('la fecha de prueba solo vale adentro de vitest', () => {
    expect(V.ahoraDe({ VIERNES_HOY_PRUEBA: '2026-10-16T10:00', VITEST: 'true' }).getDate()).toBe(16);
    const real = V.ahoraDe({ VIERNES_HOY_PRUEBA: '2001-01-05T10:00' });
    expect(real.getFullYear()).toBeGreaterThan(2001);
  });
});

describe('viernesPlanificacion — por el arranque de sesion de verdad (bash -> session-start-context.sh inicio)', () => {
  const casa = () => { const h = path.join(TMP, `casa-${n++}`); fs.mkdirSync(path.join(h, '.claude'), { recursive: true }); return h; };
  function arranque({ reg, fecha, home = casa(), source = 'startup' }) {
    const env = { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_PROJECT_DIR: RAIZ, APPDATA: appdata(reg), VITEST: 'true', VIERNES_HOY_PRUEBA: fecha, CLAUDE_CODE_HOST_SESSION_ID: reg ? reg.sessionId : '' };
    delete env.CLAUDE_CODE_HOST_SCHEDULED_RUN;
    const r = spawnSync('bash', [path.join(RAIZ, '.claude', 'hooks', 'session-start-context.sh'), 'inicio'],
      { input: JSON.stringify({ hook_event_name: 'SessionStart', source, session_id: reg ? reg.cliSessionId : 'x' }), encoding: 'utf8', env });
    return { exit: r.status, out: r.stdout ?? '', home };
  }

  it('VERDE: viernes y la abrio Fak -> el renglon llega; ROJO: el segundo arranque del mismo viernes calla', () => {
    const a = arranque({ reg: ABIERTA_POR_FAK, fecha: '2026-10-16T10:00' });
    expect(a.exit).toBe(0);
    expect(a.out).toContain(V.MARCA);
    expect(fs.readFileSync(path.join(a.home, '.claude', '.viernes-planificacion'), 'utf8').trim()).toBe('2026-10-16');
    expect(fs.readFileSync(path.join(a.home, '.claude', '.viernes-planificacion.log'), 'utf8')).toMatch(/AVISO la abrió Fak/);
    const b = arranque({ reg: ABIERTA_POR_FAK, fecha: '2026-10-16T14:00', home: a.home });
    expect(b.exit).toBe(0);
    expect(b.out).not.toContain(V.MARCA);
  });
  it('ROJO: un jueves no dice nada ni deja marca', () => {
    const a = arranque({ reg: ABIERTA_POR_FAK, fecha: '2026-10-15T10:00' });
    expect(a.exit).toBe(0);
    expect(a.out).not.toContain(V.MARCA);
    expect(fs.existsSync(path.join(a.home, '.claude', '.viernes-planificacion'))).toBe(false);
  });
  it('ROJO: un viernes, en una sesion lanzada por otra -> calla y lo anota', () => {
    const a = arranque({ reg: HIJA, fecha: '2026-10-16T10:00' });
    expect(a.exit).toBe(0);
    expect(a.out).not.toContain(V.MARCA);
    expect(fs.readFileSync(path.join(a.home, '.claude', '.viernes-planificacion.log'), 'utf8')).toMatch(/calla la lanzó otra sesión/);
  });
  it('el hook llama al aviso del viernes despues del cerebro', () => {
    const sh = fs.readFileSync(path.join(RAIZ, '.claude', 'hooks', 'session-start-context.sh'), 'utf8');
    const cerebro = sh.indexOf('cerebro-guard.sh" 2>/dev/null');
    const viernes = sh.indexOf('scripts/_lib/viernesPlanificacion.mjs" --hook');
    expect(cerebro).toBeGreaterThan(0);
    expect(viernes).toBeGreaterThan(cerebro);
  });
});
