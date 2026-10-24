// @vitest-environment node
/**
 * 6b (viernes 23/10/2026): «no corrio» se VE. El 23/10 a las 06:30 nocturno.json quedo en «no arranco: presupuesto del
 * ciclo en rojo» y ninguna sesion lo dijo; la noche salia con 0 y el estado se pisaba cada dia.
 *   - lineaNoche(): un renglon [NOCHE] si la noche no existe, es vieja (no corrio), no arranco o fallo; '' si corrio bien.
 *   - nocturnoHook.mjs --hook: lo imprime al arrancar la sesion (lo llama session-start-context.sh); siempre sale con 0.
 *   - _nocturno.mjs: si no arranca sale con SALIDA_NO_ARRANCO (6), no con 0; registrarHistorial() agrega una linea por corrida.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { lineaNoche, HORAS_VIEJO, SALIDA_NO_ARRANCO, ARCHIVO_HISTORIAL } from '../../scripts/_lib/nocturno.mjs';

const HOOK = path.resolve('scripts/_lib/nocturnoHook.mjs');
const NOCTURNO = path.resolve('scripts/_nocturno.mjs');
const H = 3600e3;
let dir;
let previo;

const estadoBase = (finMs, extra = {}) => {
  const f = new Date(finMs);
  const p2 = (n) => String(n).padStart(2, '0');
  const fecha = `${f.getFullYear()}-${p2(f.getMonth() + 1)}-${p2(f.getDate())}`;
  return { fecha, inicio: `${fecha} 06:30:00`, fin: `${fecha} 06:30:19`, finMs, pasos: [], costoUsd: 0, noArranco: null, corte: null, lineaTablero: 'Noche de prueba', ...extra };
};
const noArranco = (ahora) => estadoBase(ahora - 2 * H, { noArranco: 'presupuesto del ciclo en rojo (ciclo del 30/09 al 29/10): $372.76 de $170. No arranco (--sin-tope para forzar).', lineaTablero: 'Noche 23/10 06:30 · no arrancó: presupuesto del ciclo en rojo' });
const bien = (ahora) => estadoBase(ahora - 2 * H, { pasos: [{ nombre: 'mails', estado: 'ok', detalle: '3 mails', costoUsd: 0.01 }], costoUsd: 0.01 });

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noche-hook-'));
  previo = process.env.BARACK_API_DIR;
  process.env.BARACK_API_DIR = dir;                    // escrituraSegura habilita esta carpeta para registrarHistorial()
});
afterAll(() => {
  if (previo === undefined) delete process.env.BARACK_API_DIR; else process.env.BARACK_API_DIR = previo;
});

describe('lineaNoche(): que dice al arrancar la sesion', () => {
  const ahora = Date.now();
  it('ROJO: sin estado, estado viejo (la de hoy no corrio), no arranco, o un paso en error / corte / pausa: un renglon [NOCHE] con el por que', () => {
    expect(lineaNoche(null, { ahora })).toMatch(/^\[NOCHE\] .*no existe.*no corrio nunca/);
    const viejo = estadoBase(ahora - (HORAS_VIEJO + 4) * H);
    expect(lineaNoche(viejo, { ahora })).toMatch(/^\[NOCHE\] .*NO CORRIO/);
    expect(lineaNoche(viejo, { ahora })).toContain(viejo.fecha.slice(8, 10));
    const na = lineaNoche(noArranco(ahora), { ahora });
    expect(na).toMatch(/^\[NOCHE\] .*NO ARRANCO: presupuesto del ciclo en rojo/);
    expect(na).toContain(ARCHIVO_HISTORIAL);
    expect(lineaNoche(estadoBase(ahora - H, { pasos: [{ nombre: 'preauditoria', estado: 'error', detalle: 'Supabase no contesto' }] }), { ahora })).toMatch(/^\[NOCHE\] .*con problemas/);
    expect(lineaNoche(estadoBase(ahora - H, { corte: { motivo: 'tope', detalle: 'tope por corrida' } }), { ahora })).toMatch(/^\[NOCHE\] .*se corto sola \(tope por corrida\)/);
    expect(lineaNoche(estadoBase(ahora - H, { finMs: undefined }), { ahora })).toMatch(/^\[NOCHE\] .*no trae la hora/);
  });
  it('VERDE: la noche de hoy corrio bien: nada (el detalle lo da --estado); un semanal "saltado" porque no tocaba tampoco es problema', () => {
    expect(lineaNoche(bien(ahora), { ahora })).toBe('');
    expect(lineaNoche(estadoBase(ahora - H, { pasos: [{ nombre: 'novedades', estado: 'saltado', detalle: 'no tocaba' }] }), { ahora })).toBe('');
  });
  it('cada renglon es UNO solo y corto (cabe en el contexto del arranque)', () => {
    for (const e of [null, estadoBase(ahora - 40 * H), noArranco(ahora)]) {
      const l = lineaNoche(e, { ahora });
      expect(l).not.toContain('\n');
      expect(l.length).toBeLessThan(420);
    }
  });
});

describe('nocturnoHook.mjs --hook: lo que imprime el arranque de la sesion', () => {
  const correr = (ruta) => spawnSync(process.execPath, [HOOK, '--hook'], { encoding: 'utf8', env: { ...process.env, BARACK_NOCTURNO_ESTADO: ruta } });
  it('ROJO: estado «no arranco» o archivo inexistente o roto: imprime [NOCHE]; VERDE: noche que corrio bien: no imprime nada. Siempre exit 0', () => {
    const ahora = Date.now();
    const malo = path.join(dir, 'malo.json'); fs.writeFileSync(malo, JSON.stringify(noArranco(ahora)));
    const bueno = path.join(dir, 'bueno.json'); fs.writeFileSync(bueno, JSON.stringify(bien(ahora)));
    const roto = path.join(dir, 'roto.json'); fs.writeFileSync(roto, '{"fecha": ');
    let r = correr(malo);
    expect(r.status).toBe(0); expect(r.stdout).toMatch(/^\[NOCHE\] .*NO ARRANCO/);
    r = correr(path.join(dir, 'no-existe.json'));
    expect(r.status).toBe(0); expect(r.stdout).toMatch(/^\[NOCHE\] .*no existe/);
    r = correr(roto);
    expect(r.status).toBe(0); expect(r.stdout).toMatch(/^\[NOCHE\] .*no se puede leer/);
    r = correr(bueno);
    expect(r.status).toBe(0); expect(r.stdout).toBe('');
  });
});

describe('_nocturno.mjs: una noche que no arranca se nota', () => {
  it('ROJO: con el presupuesto del ciclo en rojo, --simular sale con SALIDA_NO_ARRANCO (6), no con 0, y dice por que', () => {
    const apiDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noche-api-'));
    const f = new Date();
    const p2 = (n) => String(n).padStart(2, '0');
    const hoy = `${f.getFullYear()}-${p2(f.getMonth() + 1)}-${p2(f.getDate())}`;
    const linea = { ts: `${hoy} 03:00:00`, tarea: 'prueba', modelo: 'claude-haiku-5-5', lote: false, entrada: 1, salida: 1, cacheLectura: 0, cacheEscritura: 0, costoUsd: 50, duracionMs: 1, id: 'prueba', clave: 'principal' };
    fs.writeFileSync(path.join(apiDir, `ledger_${hoy.slice(0, 7)}.jsonl`), `${JSON.stringify(linea)}\n`);
    const r = spawnSync(process.execPath, [NOCTURNO, '--simular'], {
      encoding: 'utf8', timeout: 120000,
      env: { ...process.env, BARACK_API_DIR: apiDir, BARACK_API_PRESUPUESTO_USD: '10', BARACK_API_CICLO_DIA: '1' },
    });
    expect(r.status, r.stderr).toBe(SALIDA_NO_ARRANCO);
    expect(SALIDA_NO_ARRANCO).not.toBe(0);
    expect(r.stdout).toMatch(/rojo/);
  });
  it('--estado sale con 0 y dice cuantas corridas hay en el historial', () => {
    const r = spawnSync(process.execPath, [NOCTURNO, '--estado'], { encoding: 'utf8', timeout: 120000 });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/historial: \d+ corrida\(s\) en .*nocturno-historial\.jsonl/);
  });
});

describe('registrarHistorial(): el historial se AGREGA, el estado se pisa', () => {
  it('dos corridas quedan como dos lineas JSON, en orden, la primera intacta', async () => {
    const { registrarHistorial } = await import('../../scripts/_nocturno.mjs');
    const ruta = path.join(dir, ARCHIVO_HISTORIAL);
    const a = noArranco(Date.now() - 24 * H);
    const b = bien(Date.now());
    registrarHistorial(a, ruta);
    registrarHistorial(b, ruta);
    const lineas = fs.readFileSync(ruta, 'utf8').split('\n').filter(Boolean);
    expect(lineas).toHaveLength(2);
    expect(JSON.parse(lineas[0])).toEqual(a);
    expect(JSON.parse(lineas[1])).toEqual(b);
  });
});
