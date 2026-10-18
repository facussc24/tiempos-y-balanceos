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
  armarTarea, estadoSesion, html, leerArb, leerMails, leerNocheTarea, leerNube, leerResultado, leerSeguimiento, leerSelftest,
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
  it('una corrida que arrancó y se murió sin anotar resultado → rojo, no el verde de la anterior (sync-diario 25/09)', () => {
    const txt = '2026-09-25 08:31  RESULTADO: OK\n2026-09-25 12:56  Outlook expone 3392 items; arranco el sync\n';
    const r = leerResultado(txt, new Date(2026, 8, 25, 16, 11).getTime());
    expect(r.color).toBe('rojo');
    expect(r.detalle).toMatch(/no anotó ningún resultado/);
  });
  it('el renglón «backups/ ocupa N MB» pegado al resultado no es una corrida nueva (ni en el mismo minuto ni en el siguiente)', () => {
    for (const min of ['45', '46']) {
      const txt = `2026-10-12 08:45  RESULTADO: OK\n2026-10-12 08:${min}  backups/ ocupa 800 MB\n`;
      expect(leerResultado(txt, new Date(2026, 9, 12, 8, 50).getTime()).palabra).toBe('terminó bien');
    }
  });
  it('arb: el latido manda; «sin red al servidor» → rojo aunque Windows diga 0; abierto → «disponible»; sin latir → rojo', () => {
    const lat = (ms, paso) => { const d = new Date(ms); return `${dos(d.getDate())}/${dos(d.getMonth() + 1)} ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}  pid 10864  ${paso}`; };
    const roto = leerArb(lat(AHORA - 60000, 'abriendo el arb'), '17/10 10:59:28  vigilante: sin red al servidor; reintento en el proximo chequeo', AHORA);
    expect(roto.color).toBe('rojo');
    expect(leerArb(lat(AHORA - 60000, 'arb abierto: nada que hacer'), null, AHORA).palabra).toBe('disponible');
    expect(leerArb(lat(AHORA - 40 * 60000, 'arb abierto: nada que hacer'), null, AHORA).color).toBe('rojo');
    expect(leerArb(null, null, AHORA).color).toBe('gris');
    // ronda 2 del auditor: la falla queda debajo de otro renglón (hoy 17/10: «Fak usando la PC» encima del «sin red»;
    // el 08/10: el login trabado con «abriendo» encima): manda la última falla sin un «login OK» después
    const sinRed = ['17/10 11:29:28  vigilante: sin red al servidor; reintento en el proximo chequeo', '17/10 11:35:02  vigilante: arb cerrado pero Fak esta usando la PC; espero'];
    expect(leerArb(lat(AHORA - 60000, 'Fak usando la PC'), sinRed, AHORA).color).toBe('rojo');
    const login = ['08/10 13:05:11  aviso (silencioso): No pude escribir en "Inicio de Sesion": otra ventana le saco el frente.', '08/10 13:08:12  vigilante: el arb esta en el login; lo abro'];
    expect(leerArb(lat(AHORA - 60000, 'abriendo el arb'), login, AHORA).color).toBe('rojo');
    const volvio = [...sinRed, '17/10 11:40:00  login OK'];
    expect(leerArb(lat(AHORA - 60000, 'abriendo el arb'), volvio, AHORA).color).toBe('verde');
  });
  it('la noche que no arrancó por el tope de la API → ámbar «API gastada», no verde', () => {
    const r = leerNocheTarea(JSON.stringify({ inicio: '2026-10-17 06:30:17', pasos: [], noArranco: 'presupuesto del ciclo en rojo: $263.62 de $170.' }), null);
    expect(r.color).toBe('ambar');
    expect(r.palabra).toMatch(/gastada/);
  });
  it('atrasada: el último resultado bueno tiene más del doble de su intervalo → rojo', () => {
    const def = { nombre: 'Barack - mis mails a la nube', para_fak: 'Mis mails suben a la nube', atrasada_si_pasan_minutos: 255, cuando_corre: 'cada 2 h' };
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
  it('impresora: el formato de hoy, con fecha y zona adelante (bambu_red.py desde el 16/10), se lee igual', () => {
    const iso = '2026-10-17T11:44:49-03:00 RUNNING etapa 0 capa 85/102 97 % faltan 2 min filamento 1 error 0 hms []';
    const r = leerSeguimiento(`${iso} | detector exito 0.224 falla 1.588`, AHORA - 30000, AHORA);
    expect(r.palabra).toBe('imprimiendo');
    expect(r.detalle).toMatch(/capa 85 de 102/);
    expect(leerSeguimiento(`${iso} | detector exito 0.61 falla 0.52 | ALARMA DEL DETECTOR`, AHORA - 30000, AHORA).color).toBe('rojo');
    // la vigilancia sale con 11 sin escribir SALIDA: a los 8 y a los 30 min la alarma sigue en rojo (ronda 2 del auditor)
    for (const min of [8, 30]) expect(leerSeguimiento(`${iso} | detector exito 0.61 falla 0.52 | ALARMA DEL DETECTOR`, AHORA - min * 60000, AHORA).color).toBe('rojo');
    // en pausa la vigilancia escribe cada 300 s: a los 6 min sigue «en pausa», no salta a «no imprime»
    expect(leerSeguimiento(iso.replace('RUNNING', 'PAUSE'), AHORA - 6 * 60000, AHORA).palabra).toBe('en pausa');
    const sinCon = `${iso}\n2026-10-17T11:50:02-03:00 SIN CONEXION desde las 11:46 (sigo buscandola por su serie)`;
    expect(leerSeguimiento(sinCon, AHORA - 60000, AHORA).palabra).toBe('sin conexión');
    expect(leerSeguimiento(`${iso}\n2026-10-17T11:58:00-03:00 SALIDA 3: 15 min sin avanzar`, AHORA - 60000, AHORA).color).toBe('rojo');
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
    // el nombre real de la tarea de Windows dice «Claude»: la página muestra solo la frase para Fak (revisor-pedido 17/10)
    const noche = armarTarea({ nombre: 'Barack - Noche de Claude (API)', para_fak: 'La noche: el trabajo automático con la API', cada_minutos: 1440 }, leerNocheTarea(null, null), null, AHORA);
    const ok = leerSelftest({ skill: 'hojas-de-proceso', para_fak: 'Hojas de proceso', comandos: [['py']] }, { ok: true, resumen: '0 fallan', cuandoMs: AHORA });
    expect(ok.palabra).toBe('disponible');
    // un título de sesión de Fak con el nombre del asistente (4 de 7 días, auditor 17/10) tampoco lo deja ver
    const ses = estadoSesion({ title: 'Plan sistema Claude Barack', lastActivityAt: AHORA, scheduledTaskId: 'sesion-sistema-claude-fase2' }, null, AHORA);
    const pag = html({ ahora: AHORA, refresco: 30, logo: 'logo.png', sesionesHoras: 12, selftestsHoras: 6, sesiones: [ses], tareas: [t, noche], nube: leerNube(null), nubePcs: [], impresora: leerSeguimiento(null, null, AHORA), selftests: [ok] });
    expect(pag).toMatch(/<header><img src="logo\.png"/);
    expect(pag).toMatch(/http-equiv="refresh" content="30"/);
    expect(pag).toMatch(/1 cosa en rojo/);
    expect(pag).toMatch(/sáb 17\/10 10:59/);
    expect(pag).not.toMatch(/claude/i);
    // tanda 16: el tema de la casa, «mucho más 2D y mucho más serio» — la letra y los colores salen de tema.json, sin
    // esquinas redondeadas en las secciones ni en la foto
    expect(pag).toMatch(/font-family:"Calibri"/);
    expect(pag).toMatch(/--acento:#44546A/);
    expect(pag).not.toMatch(/border-radius:(6|8)px/);
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
