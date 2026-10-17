/**
 * Tests del programita (scripts/_programita.mjs y scripts/_lib/programita.mjs, tanda 6, 17/10/2026), en las dos
 * direcciones y con la forma REAL de los registros (copiada de los de esta PC el 17/10):
 *  · ROJO: mails.log con «codigo 4 … outlook_cerrado» (el de las 10:37 del 17/10, que para Windows terminó con 0),
 *    un renglón roto, un RESULTADO: ERROR, una tarea atrasada, la nube con archivos sin subir, el detector que avisa.
 *  · VERDE: «codigo 0 … resultado ok», «RESULTADO OK», la nube sin pendientes, una impresión corriendo.
 *  · De punta a punta: el programa corriendo de verdad (su vuelta de 30 s) pasa una tarea a verde en menos de un
 *    minuto después de que su registro anota una corrida buena, y a rojo cuando el registro se rompe.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  armarTarea, estadoSesion, html, leerMails, leerNocheTarea, leerNube, leerResultado, leerSeguimiento, leerSelftest,
} from '../../scripts/_lib/programita.mjs';

const dos = (n) => String(n).padStart(2, '0');
const local = (ms, seg = true) => { const d = new Date(ms); return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())} ${dos(d.getHours())}:${dos(d.getMinutes())}${seg ? `:${dos(d.getSeconds())}` : ''}`; };
const AHORA = new Date(2026, 9, 17, 11, 0).getTime();
const OK_MAILS = (ms) => `${local(ms)} codigo 0 {"resultado":"ok","pc":"DESKTOP-14JG95B","escrito":"x","casillas":[{"casilla":"f.santoro@barackmercosul.com","resultado":"ok","revisados":52,"nuevos":2}],"omitidas":[]}`;
const OUTLOOK_CERRADO = (ms) => `${local(ms)} codigo 4 {"resultado":"outlook_cerrado","pc":"DESKTOP-14JG95B","detalle":"Outlook clasico no esta abierto"}`;

describe('las tareas: el color sale de SU registro', () => {
  it('mails: código 0 y resultado ok → verde, con los mails nuevos', () => {
    const r = leerMails(OK_MAILS(AHORA - 60000));
    expect(r.color).toBe('verde');
    expect(r.detalle).toBe('2 mails nuevos');
  });
  it('mails: el caso real del 17/10 10:37 (código 4, Outlook cerrado) → rojo con su motivo', () => {
    const r = leerMails(`${OK_MAILS(AHORA - 3 * 3600000)}\n${OUTLOOK_CERRADO(AHORA - 20 * 60000)}\n`);
    expect(r.color).toBe('rojo');
    expect(r.detalle).toBe('Outlook clasico no esta abierto');
  });
  it('mails: un renglón roto → rojo; registro que no existe → gris «sin dato», nunca verde', () => {
    expect(leerMails(`${OK_MAILS(AHORA)}\n2026-10-17 11:00:00 codigo 0 {"resultado":"ok",`).color).toBe('rojo');
    expect(leerMails('').color).toBe('rojo');
    expect(leerMails(null).color).toBe('gris');
  });
  it('RESULTADO OK → verde; RESULTADO: ERROR → rojo; PARCIAL → ámbar; sin ningún resultado → rojo', () => {
    expect(leerResultado('2026-10-17 09:41  inicio\n2026-10-17 09:41  RESULTADO OK\n', AHORA).color).toBe('verde');
    const e = leerResultado('2026-10-17 08:32  RESULTADO: ERROR (codigo 1) — si dice ENOTFOUND…\n', AHORA);
    expect(e.color).toBe('rojo');
    expect(e.detalle).toMatch(/codigo 1/);
    expect(leerResultado('2026-10-17 08:32  RESULTADO: PARCIAL — el buzon no estaba entero\n', AHORA).color).toBe('ambar');
    expect(leerResultado('2026-10-17 08:32  inicio\n', AHORA - 3600000).color).toBe('rojo');
  });
  it('una corrida que empezó después del último resultado y escribe hace poco → «corriendo»', () => {
    const r = leerResultado(`2026-10-17 09:41  RESULTADO OK\n${local(AHORA - 2 * 60000, false)}  inicio\n`, AHORA);
    expect(r.palabra).toBe('corriendo');
  });
  it('la noche que no arrancó por el tope de la API → ámbar «API gastada», no verde', () => {
    const r = leerNocheTarea(JSON.stringify({ inicio: '2026-10-17 06:30:17', pasos: [], noArranco: 'presupuesto del ciclo en rojo: $263.62 de $170.' }), null);
    expect(r.color).toBe('ambar');
    expect(r.palabra).toMatch(/gastada/);
  });
  it('atrasada: el último resultado bueno tiene más del doble de su intervalo → rojo', () => {
    const def = { nombre: 'Barack - mis mails a la nube', para_fak: 'Mis mails suben a la nube', cada_minutos: 120 };
    const viejo = armarTarea(def, leerMails(OK_MAILS(AHORA - 5 * 3600000)), { estado: 'Ready' }, AHORA);
    expect(viejo.color).toBe('rojo');
    expect(viejo.avisos.join(' ')).toMatch(/atrasada/);
    const nuevo = armarTarea(def, leerMails(OK_MAILS(AHORA - 30 * 60000)), { estado: 'Ready' }, AHORA);
    expect(nuevo.color).toBe('verde');
    expect(armarTarea(def, leerMails(OK_MAILS(AHORA - 60000)), { estado: 'Disabled' }, AHORA).palabra).toBe('apagada');
  });
});

describe('la nube, la impresora, las skills y las sesiones', () => {
  it('nube: salida 0 → «subió todo»; salida 1 con pendientes → rojo con el número (el 17/10: 46, 52,1 MB)', () => {
    expect(leerNube({ codigo: 0, texto: 'SUBIO TODO', cuandoMs: AHORA }).color).toBe('verde');
    const r = leerNube({ codigo: 1, texto: '11:01:25  pendientes de subir: 46 (52,1 MB)\r\n   08/12 05:56  0 MB  \\a\\b.jpg\r\n', cuandoMs: AHORA });
    expect(r.color).toBe('rojo');
    expect(r.detalle).toBe('46 archivo(s) sin subir (52,1 MB)');
    expect(r.ejemplos).toHaveLength(1);
    expect(leerNube(null).color).toBe('gris');
  });
  it('impresora: imprimiendo con el detector; alarma → rojo; terminada → gris «no imprime»', () => {
    const corre = '11:44:49 RUNNING etapa 0 capa 85/102 97 % faltan 2 min filamento 1 error 0 hms [] | detector exito 0.224 falla 1.588';
    const r = leerSeguimiento(corre, AHORA - 30000, AHORA);
    expect(r.color).toBe('verde');
    expect(r.detalle).toMatch(/capa 85 de 102/);
    expect(r.detalle).toMatch(/0,22/);
    expect(leerSeguimiento(`${corre} | ALARMA DEL DETECTOR`, AHORA - 30000, AHORA).color).toBe('rojo');
    const fin = leerSeguimiento('13:29:49 FINISH etapa 255 capa 93/93 100 % faltan 0 min filamento 255 error 0 hms []', AHORA - 86400000, AHORA);
    expect(fin.palabra).toBe('no imprime');
    // un RUNNING viejo (el seguimiento se cortó) no es «imprimiendo»
    expect(leerSeguimiento(corre, AHORA - 3600000, AHORA).palabra).toBe('no imprime');
  });
  it('skills: sin comandos → «sin selftest» (cad-design), nunca verde; falla → rojo', () => {
    expect(leerSelftest({ skill: 'cad-design', para_fak: 'Diseño 3D', comandos: [] }, null).palabra).toBe('sin selftest');
    expect(leerSelftest({ skill: 'x', comandos: [['py']] }, { ok: false, resumen: '3 fallan', cuandoMs: AHORA }).color).toBe('rojo');
    expect(leerSelftest({ skill: 'x', comandos: [['py']] }, { ok: true, resumen: '0 fallan', cuandoMs: AHORA }).color).toBe('verde');
  });
  it('sesiones: trabajando → «corriendo»; herramienta sin resultado → rojo; esperando a Fak → ámbar', () => {
    const app = { title: 'Hija', lastActivityAt: AHORA - 600000, postTurnSummary: { status_category: 'blocked' } };
    expect(estadoSesion(app, { estado: 'trabajando', ultimoMs: AHORA - 30000 }, AHORA).palabra).toBe('corriendo');
    expect(estadoSesion(app, { estado: 'trabajando', ultimoMs: AHORA - 30000 }, AHORA).ultimaMs).toBe(AHORA - 30000);
    expect(estadoSesion(app, { estado: 'espera_herramienta', quietaMin: 25 }, AHORA).color).toBe('rojo');
    expect(estadoSesion(app, { estado: 'termino' }, AHORA).palabra).toBe('espera algo tuyo');
  });
  it('la página lleva el logo arriba, la hora de cada dato y cuenta los rojos', () => {
    const t = armarTarea({ nombre: 'Barack - mis mails a la nube', para_fak: 'Mis mails suben a la nube', cada_minutos: 120 }, leerMails(OUTLOOK_CERRADO(AHORA - 60000)), null, AHORA);
    const pag = html({ ahora: AHORA, refresco: 30, logo: 'logo.png', sesionesHoras: 12, selftestsHoras: 6, sesiones: [], tareas: [t], nube: leerNube(null), nubePcs: [], impresora: leerSeguimiento(null, null, AHORA), selftests: [] });
    expect(pag).toMatch(/<header><img src="logo\.png"/);
    expect(pag).toMatch(/http-equiv="refresh" content="30"/);
    expect(pag).toMatch(/1 cosa en rojo/);
    expect(pag).toMatch(/sáb 17\/10 10:59/);
    expect(pag).not.toMatch(/claude/i);
  });
});

// ── De punta a punta: el programa de verdad, con su vuelta de 30 s ─────────────────────────────────────────────
describe('de punta a punta (el programa corriendo)', () => {
  let tmp; let hijo; let mails; let pagina;
  const colorDeMails = () => {
    const h = fs.existsSync(pagina) ? fs.readFileSync(pagina, 'utf8') : '';
    const fila = /<tr><td><b>Mis mails suben a la nube<\/b>[\s\S]*?<\/tr>/.exec(h);
    return fila ? (/class="est (\w+)"/.exec(fila[0]) || [])[1] : null;
  };
  const esperar = async (color, topeMs) => {
    const t0 = Date.now();
    while (Date.now() - t0 < topeMs) {
      if (colorDeMails() === color) return Date.now() - t0;
      await new Promise((r) => setTimeout(r, 500));
    }
    return null;
  };
  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'programita-'));
    fs.mkdirSync(path.join(tmp, 'local', 'BarackMailsFak'), { recursive: true });
    mails = path.join(tmp, 'local', 'BarackMailsFak', 'mails.log');
    fs.writeFileSync(mails, `${OUTLOOK_CERRADO(Date.now() - 60000)}\n`);
    pagina = path.join(tmp, 'salida', 'tareas.html');
    const env = { ...process.env, LOCALAPPDATA: path.join(tmp, 'local'), APPDATA: path.join(tmp, 'roaming'), USERPROFILE: tmp, HOME: tmp };
    hijo = spawn(process.execPath, [path.resolve('scripts/_programita.mjs'), '--sin-abrir', '--sin-medir', '--sin-windows', '--sin-sesiones', '--repo', tmp, '--salida', path.join(tmp, 'salida')], { env, stdio: 'ignore' });
    expect(await esperar('rojo', 20000)).not.toBeNull();
  }, 40000);
  afterAll(() => { hijo?.kill(); fs.rmSync(tmp, { recursive: true, force: true }); });

  it('una corrida buena anotada en el registro sale en verde en menos de un minuto', async () => {
    fs.appendFileSync(mails, `${OK_MAILS(Date.now())}\n`);
    const ms = await esperar('verde', 60000);
    expect(ms).not.toBeNull();
    expect(ms).toBeLessThan(60000);
  }, 70000);

  it('un registro roto sale en rojo en menos de un minuto', async () => {
    fs.appendFileSync(mails, `${local(Date.now())} codigo 0 {"resultado":"ok",\n`);
    const ms = await esperar('rojo', 60000);
    expect(ms).not.toBeNull();
    expect(ms).toBeLessThan(60000);
  }, 70000);
});
