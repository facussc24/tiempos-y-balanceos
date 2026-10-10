/**
 * Tests de scripts/_hijaEstado.mjs (10/10/2026): el control de arranque de una sesion hija, en las dos direcciones.
 *
 * ROJOS con la forma REAL de los registros: la hija de la madrugada del 10/10 (primer mensaje con
 * permissionMode "plan" y un ExitPlanMode que espero el clic) y una herramienta sin resultado en un modo que
 * pide permiso (la hija del 10/10 11:26, que arranco en default y se colgo en un curl).
 * VERDE: una hija en bypass, trabajando, sin plan ni pendientes; y la madrugada DESPUES de que Fak la paso a
 * bypass, con un vitest largo corriendo (auditor 10/10: la primera version la mandaba frenar).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { estadoHija, leerTranscript, leerRegistroApp } from '../../scripts/_hijaEstado.mjs';

let raiz;
let raizApp;
let raizProyectos;
const AHORA = Date.parse('2026-10-10T15:00:00.000Z');
const iso = (minAntes) => new Date(AHORA - minAntes * 60000).toISOString();
let n = 0;

function armar({ modo = 'bypassPermissions', modoDespues = null, plan = false, pendienteMin = null, modeloApp = 'claude-opus-5-5', modoApp = 'bypassPermissions', sinApp = false, sinTranscript = false } = {}) {
  n += 1;
  const local = `local_${n.toString().padStart(8, '0')}-aaaa-bbbb-cccc-ddddddddddd${n}`;
  const cli = `cli-${n}-4444-5555-6666`;
  if (!sinApp) {
    fs.writeFileSync(path.join(raizApp, 'cuenta', 'org', `${local}.json`), JSON.stringify({
      sessionId: local, cliSessionId: cli, model: modeloApp, permissionMode: modoApp, scheduledTaskId: 'sesion-prueba', title: `Hija ${n}`, createdAt: AHORA - 600000, lastActivityAt: AHORA - 60000,
    }));
  }
  if (!sinTranscript) {
    const L = [];
    L.push({ type: 'queue-operation', sessionId: cli, timestamp: iso(9) });
    L.push({ type: 'user', permissionMode: modo, timestamp: iso(9), message: { role: 'user', content: `<scheduled-task name="sesion-prueba">\nThis is an automated run.\n\n[ENCARGO E261010-abcd]\nPARA: hija ${n}` } });
    L.push({ type: 'assistant', timestamp: iso(8), message: { role: 'assistant', content: [{ type: 'text', text: 'Leo el encargo.' }, { type: 'tool_use', id: 'tu_1', name: 'Bash', input: { command: 'git log -1' } }] } });
    L.push({ type: 'user', permissionMode: modoDespues ?? modo, timestamp: iso(8), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: 'ok' }] } });
    if (plan) {
      L.push({ type: 'assistant', timestamp: iso(7), message: { role: 'assistant', content: [{ type: 'tool_use', id: 'tu_plan', name: 'ExitPlanMode', input: { plan: 'x' } }] } });
      L.push({ type: 'user', timestamp: iso(7), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_plan', content: 'rejected' }] } });
      L.push({ type: 'assistant', timestamp: iso(6), message: { role: 'assistant', content: [{ type: 'tool_use', id: 'tu_plan2', name: 'ExitPlanMode', input: { plan: 'x' } }] } });
    }
    if (pendienteMin !== null) {
      L.push({ type: 'assistant', timestamp: iso(pendienteMin), message: { role: 'assistant', content: [{ type: 'tool_use', id: 'tu_pend', name: 'Bash', input: { command: 'npm test' } }] } });
    } else {
      L.push({ type: 'assistant', timestamp: iso(1), message: { role: 'assistant', content: [{ type: 'text', text: 'Sigo con la cola.' }] } });
    }
    fs.writeFileSync(path.join(raizProyectos, 'C--Dev-BarackMercosul', `${cli}.jsonl`), L.map((x) => JSON.stringify(x)).join('\n') + '\n');
  }
  return { local, cli };
}

beforeAll(() => {
  raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'hija-estado-'));
  raizApp = path.join(raiz, 'app');
  raizProyectos = path.join(raiz, 'proyectos');
  fs.mkdirSync(path.join(raizApp, 'cuenta', 'org'), { recursive: true });
  fs.mkdirSync(path.join(raizProyectos, 'C--Dev-BarackMercosul'), { recursive: true });
});
afterAll(() => { try { fs.rmSync(raiz, { recursive: true, force: true }); } catch { /* */ } });

describe('estadoHija · VERDE', () => {
  it('una hija lanzada desde bypass, trabajando, sin plan ni herramientas colgadas: ARRANCO BIEN', () => {
    const { local, cli } = armar();
    const r = estadoHija({ id: local, raizApp, raizProyectos, ahoraMs: AHORA });
    expect(r.ok, JSON.stringify(r.ojos)).toBe(true);
    expect(r.app.cliSessionId).toBe(cli);
    expect(r.transcript.modoPrimerMensaje).toBe('bypassPermissions');
    expect(r.transcript.turnosAsistente).toBe(2);
    expect(r.transcript.pendientes).toEqual([]);
    expect(r.datos.join('\n')).toMatch(/modo \(app\): bypassPermissions/);
    expect(r.datos.join('\n')).toMatch(/primer mensaje: «<scheduled-task name="sesion-prueba"> This is an automated run/);
  });

  it('tambien se puede mirar por el id de la conversacion (sin registro de la app)', () => {
    const { cli } = armar();
    const r = estadoHija({ id: cli, raizApp, raizProyectos, ahoraMs: AHORA });
    expect(r.ok).toBe(true);
    expect(r.app).toBeNull();
  });

  it('una herramienta que lleva menos de --espera-min sin resultado no es un OJO (esta trabajando)', () => {
    const { local } = armar({ pendienteMin: 1 });
    expect(estadoHija({ id: local, raizApp, raizProyectos, ahoraMs: AHORA }).ok).toBe(true);
  });
});

describe('estadoHija · ROJO (lo que paso de verdad)', () => {
  it('la hija de la madrugada del 10/10: arranco en plan y llamo dos veces a ExitPlanMode', () => {
    const { local } = armar({ modo: 'plan', plan: true });
    const r = estadoHija({ id: local, raizApp, raizProyectos, ahoraMs: AHORA });
    expect(r.ok).toBe(false);
    expect(r.ojos.some((o) => /arrancó en «plan», no en «bypassPermissions»/.test(o))).toBe(true);
    expect(r.ojos.some((o) => /entró en modo plan \(0 EnterPlanMode, 2 ExitPlanMode\)/.test(o))).toBe(true);
    // ExitPlanMode sin resultado (espera el clic) tambien aparece como herramienta colgada
    expect(r.ojos.some((o) => /ExitPlanMode sin resultado hace 6 min/.test(o))).toBe(true);
  });

  it('en un modo que pide permiso (default), una herramienta sin resultado hace 5 minutos es un cartel: OJO que dice cual y hace cuanto', () => {
    const { local } = armar({ modo: 'default', modoApp: 'default', pendienteMin: 5 });
    const r = estadoHija({ id: local, raizApp, raizProyectos, ahoraMs: AHORA, esperaModo: 'default' });
    expect(r.ok).toBe(false);
    expect(r.ojos).toHaveLength(1);
    expect(r.ojos[0]).toMatch(/herramienta Bash sin resultado hace 5 min/);
  });

  it('en bypass una Bash larga (5 min) es trabajo, no cartel: dato y VERDE; a los 15 min, OJO para mirar el registro', () => {
    const { local } = armar({ pendienteMin: 5 });
    const r = estadoHija({ id: local, raizApp, raizProyectos, ahoraMs: AHORA });
    expect(r.ok, JSON.stringify(r.ojos)).toBe(true);
    expect(r.datos.some((d) => /herramienta Bash en curso hace 5 min \(bypass: trabajo, no cartel\)/.test(d))).toBe(true);
    const { local: l2 } = armar({ pendienteMin: 16 });
    const r2 = estadoHija({ id: l2, raizApp, raizProyectos, ahoraMs: AHORA });
    expect(r2.ok).toBe(false);
    expect(r2.ojos[0]).toMatch(/herramienta Bash sin resultado hace 16 min en bypass/);
  });

  it('en bypass, un ExitPlanMode sin resultado SI es un cartel aunque lleve 2 minutos', () => {
    const { local } = armar({ plan: true });
    const r = estadoHija({ id: local, raizApp, raizProyectos, ahoraMs: AHORA });
    expect(r.ojos.some((o) => /ExitPlanMode sin resultado hace 6 min/.test(o))).toBe(true);
  });

  it('la madrugada DESPUES de pasar a bypass: arranco en plan (OJO), hoy corre en bypass, y un vitest de 5 min NO es cartel (auditor 10/10, TB2)', () => {
    const { local } = armar({ modo: 'plan', modoDespues: 'bypassPermissions', modoApp: 'bypassPermissions', pendienteMin: 5 });
    const r = estadoHija({ id: local, raizApp, raizProyectos, ahoraMs: AHORA });
    expect(r.ojos.some((o) => /arrancó en «plan»/.test(o))).toBe(true);
    expect(r.ojos.some((o) => /sin resultado/.test(o))).toBe(false);
    expect(r.datos.some((d) => /modo de hoy: bypassPermissions/.test(d))).toBe(true);
    expect(r.datos.some((d) => /herramienta Bash en curso hace 5 min \(bypass: trabajo, no cartel\)/.test(d))).toBe(true);
    // sin registro de la app, el modo de hoy sale del ultimo mensaje user que lo trae
    const { cli } = armar({ modo: 'plan', modoDespues: 'bypassPermissions', pendienteMin: 5 });
    const r2 = estadoHija({ id: cli, raizApp, raizProyectos, ahoraMs: AHORA });
    expect(r2.ojos.some((o) => /sin resultado/.test(o))).toBe(false);
  });

  it('quieta 8 minutos sin herramienta pendiente: lo dice como dato (puede haber terminado), no como OJO', () => {
    const { local } = armar();
    // la ultima escritura del fixture es hace 1 min: muevo el reloj 8 minutos
    const r = estadoHija({ id: local, raizApp, raizProyectos, ahoraMs: AHORA + 7 * 60000 });
    expect(r.ok).toBe(true);
    expect(r.datos.some((d) => /quieta hace 8 min sin herramienta pendiente/.test(d))).toBe(true);
  });

  it('modelo distinto del esperado: aviso (set_session_model aplica desde el segundo turno)', () => {
    const { local } = armar({ modeloApp: 'claude-opus-5-5' });
    const r = estadoHija({ id: local, raizApp, raizProyectos, ahoraMs: AHORA, esperaModelo: 'claude-fable-5-1' });
    expect(r.ok).toBe(false);
    expect(r.ojos[0]).toMatch(/modelo claude-opus-5-5, no claude-fable-5-1/);
  });

  it('sin registro de la app, o sin conversacion todavia: lo dice, no inventa', () => {
    const { local } = armar({ sinApp: true });
    const r1 = estadoHija({ id: local, raizApp, raizProyectos, ahoraMs: AHORA });
    expect(r1.ok).toBe(false);
    expect(r1.ojos[0]).toMatch(/no encuentro el registro de la app/);
    const { local: l2 } = armar({ sinTranscript: true });
    const r2 = estadoHija({ id: l2, raizApp, raizProyectos, ahoraMs: AHORA });
    expect(r2.ok).toBe(false);
    expect(r2.ojos[0]).toMatch(/no encuentro la conversación/);
  });
});

describe('lectores', () => {
  it('leerRegistroApp y leerTranscript devuelven null si no esta, y los campos justos si esta', () => {
    expect(leerRegistroApp('local_no-existe', raizApp)).toBeNull();
    expect(leerTranscript('no-existe', raizProyectos)).toBeNull();
    const { local, cli } = armar({ modo: 'acceptEdits' });
    const a = leerRegistroApp(local, raizApp);
    expect(a.model).toBe('claude-opus-5-5');
    expect(a.scheduledTaskId).toBe('sesion-prueba');
    const t = leerTranscript(cli, raizProyectos);
    expect(t.modoPrimerMensaje).toBe('acceptEdits');
    expect(t.mensajesUser).toBe(1);
  });
});
