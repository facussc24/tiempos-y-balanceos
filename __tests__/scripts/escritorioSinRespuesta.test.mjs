/**
 * La seccion PEDIDOS SIN RESPUESTA del relevador del Escritorio (Ola 4, item 16, 05/09/2026).
 *
 * _escritorio.mjs no decide nada: corre `python scripts/_mails.py --sin-respuesta --json` sobre
 * el cache que le digan (BARACK_MAIL_CACHE) y cruza el resultado con los nombres de las tareas
 * con la MISMA funcion del barrido (cruzarMailsConTareas). Lo que se prueba aca:
 *   - el pedido viejo sin carpeta sale marcado SIN CARPETA; el que matchea una tarea, no;
 *   - el contestado por Fak no aparece;
 *   - si el cache no existe o python falla, la seccion avisa y devuelve null sin tumbar nada.
 * Mismo criterio que mailsSelftest.test.mjs: nunca skip si falta python (CI lo instala).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { relevarSinRespuesta } from '../../scripts/_escritorio.mjs';

let dir, jsonl;
// Fecha LOCAL (no toISOString, que es UTC): _mails.py cuenta los dias desde date.today() local, y
// despues de las 21:00 de Argentina el dia UTC ya es el siguiente (el 05/09 a las 21:30 dio 13 en vez de 14).
const hace = (d) => { const f = new Date(Date.now() - d * 86400000); const p = (n) => String(n).padStart(2, '0');
    return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())} 10:00`; };
const ENT = 'f.santoro@barackmercosul.com / Bandeja de entrada';
const ENV = 'f.santoro@barackmercosul.com / Elementos enviados';
const mail = (id, carpeta, fecha, de, asunto, para = 'Facundo Santoro') => JSON.stringify({
  id, carpeta, fecha, de, de_mail: de === 'Facundo Santoro' ? 'f.santoro@barackmercosul.com' : 'x@x.com',
  para, cc: '', asunto, adjuntos: [], cuerpo: '',
});

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'escritorio-sinresp-'));
  jsonl = path.join(dir, 'mails.jsonl');
  fs.writeFileSync(jsonl, [
    mail('1', ENT, hace(14), 'Pablo Gamboa', 'Alta codigos 21-9694/95'),          // sin respuesta, sin carpeta
    mail('2', ENT, hace(12), 'Carlos Baptista', 'Dispositivo de adhesivado Insert'), // sin respuesta, CON carpeta
    mail('3', ENT, hace(9), 'Leo Lattanzi', 'Medios carton'),
    mail('4', ENV, hace(8), 'Facundo Santoro', 'RE: Medios carton', 'Leo Lattanzi'), // contestado
    mail('5', ENT, hace(1), 'Federico Kipersain', 'BOM IP Pad'),                    // reciente
  ].join('\n') + '\n');
});
afterAll(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* */ } });

const capturar = (fn) => {
  const lineas = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((s = '') => lineas.push(String(s)));
  try { return { res: fn(), out: lineas.join('\n') }; } finally { spy.mockRestore(); }
};

describe('relevarSinRespuesta', () => {
  it('marca SIN CARPETA al pedido que no matchea ninguna tarea, y no al que si; el contestado no aparece', () => {
    const { res, out } = capturar(() => relevarSinRespuesta(jsonl, { nombresTareas: ['Dispositivo adhesivado insert Patagonia', 'Gancho mochila'] }));
    expect(Array.isArray(res)).toBe(true);
    expect(res.map((p) => p.hilo)).toEqual(['alta codigos 21 9694 95', 'dispositivo de adhesivado insert']);
    expect(res[0]).toMatchObject({ dias: 14, sinCarpeta: true, estado: 'sin respuesta' });
    expect(res[1]).toMatchObject({ dias: 12, sinCarpeta: false });
    expect(out).toMatch(/PEDIDOS SIN RESPUESTA/);
    expect(out).toMatch(/14 d.*Pablo Gamboa.*Alta codigos 21-9694\/95.*SIN CARPETA/);
    expect(out).toMatch(/12 d.*Carlos Baptista.*\(tiene carpeta\)/);
    expect(out).not.toMatch(/Medios carton/);
    expect(out).not.toMatch(/BOM IP Pad/);
    expect(out).toMatch(/1 sin carpeta de 2/);
  });

  it('--dias se respeta: con 20 dias no queda ninguno y lo dice', () => {
    const { res, out } = capturar(() => relevarSinRespuesta(jsonl, { dias: 20 }));
    expect(res).toEqual([]);
    expect(out).toMatch(/\(ninguno:/);
  });

  it('sin cache: avisa y devuelve null, no revienta', () => {
    const { res, out } = capturar(() => relevarSinRespuesta(path.join(dir, 'no-existe', 'mails.jsonl')));
    expect(res).toBeNull();
    expect(out).toMatch(/No pude correr|cache vacio|Correlo a mano/);
  });
});
