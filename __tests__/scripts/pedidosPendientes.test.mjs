// pedidos-pendientes (hook GLOBAL, tanda 1.7 del plan del sistema, 16/10/2026): los PEDIDO N de la carpeta FACUNDO
// de la nube dirigidos a ESTA PC y sin su «listo». Los encabezados de abajo son los REALES de la carpeta al 16/10,
// copiados tal cual (con sus mayusculas y su falta de tildes). Los casos H1, H5, H6, H10 y H11 salen del auditor de ese dia.
import { describe, it, expect, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  pedidosPendientes, leerPedido, quienSoy, destinoDe, origenDe, queDe, renglonesDeLaCarpeta, primerosRenglones, MARCA, CANON,
} from '../../scripts/_lib/pedidosPendientes.mjs';

vi.setConfig({ testTimeout: 60_000 });   // bash -> node en la notebook cargada

const RAIZ = process.cwd();
const HOOK = path.join(RAIZ, '.claude', 'hooks', 'pedidos-pendientes.sh');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pedidos-pendientes-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));
const posix = (p) => p.replace(/\\/g, '/');

const P8 = { nombre: 'PEDIDO 8 - mail a Luca - IMDS Upper Trim 16-10-2026.txt', cabecera: [
  'PEDIDO 8 PARA TU CLAUDE (PC principal) - 16/10/2026',
  'Lo escribio la sesion de la notebook de Calidad (CATA), a pedido de Fak. Desde la notebook NO se'] };
const P8_LISTO = { nombre: 'PEDIDO 8 - listo mail a Luca IMDS Upper Trim.txt', cabecera: [
  'PEDIDO 8 - listo mail a Luca IMDS Upper Trim - 16/10/2026',
  'Enviado desde la PC principal el 16/10/2026 (Enviados, asunto "IMDS Upper Trim").'] };
const P7 = { nombre: 'PEDIDO 7 - BeOn apoyacabezas flujograma Rev A y hojas de proceso - 15-10-2026.txt', cabecera: [
  '*** REEMPLAZADO (15/10/2026 ~16:00) - ESTE PEDIDO NO SE HACE ***',
  'Lo reemplaza el "PEDIDO 7b - BeOn apoyacabezas flujograma, hojas de proceso y fichas de embalaje -'] };
const P7B = { nombre: 'PEDIDO 7b - BeOn apoyacabezas flujograma, hojas de proceso y fichas de embalaje - 15-10-2026.txt', cabecera: [
  'PEDIDO 7b PARA LA SESION DE LA NOTEBOOK DE CALIDAD (CATA) - 15/10/2026 ~16:00',
  'Lo escribio la sesion de la PC principal, a pedido de Fak. REEMPLAZA AL PEDIDO 7 (el 7 no se hace).'] };
const P5 = { nombre: 'PEDIDO 5 - BeOn que revision vio VW de cada documento - 15-10-2026.txt', cabecera: [
  'PEDIDO 5 PARA LA SESION DE LA NOTEBOOK DE CALIDAD (CATA) - 15/10/2026 09:45',
  'Lo escribio la sesion de la PC principal, a pedido de Fak.'] };
const P6_LISTO = { nombre: 'PEDIDO 6 - listo revisiones BeOn.txt', cabecera: [
  'PEDIDO 6 - listo revisiones BeOn - 15/10/2026 10:15',
  'FACUNDO\\BeOn practica 13-10-2026\\BeOn Patagonia - revisiones que vio VW 15-10-2026.txt - terminado 15/10/2026 10:15 (notebook de Calidad CATA)'] };
const P1 = { nombre: 'PEDIDO 1 de 2 - mail a Calidad - todos los IMDS aprobados 14-10-2026.txt', cabecera: [
  'PEDIDO 1 DE 2 PARA TU CLAUDE (PC principal) - 14/10/2026 14:12',
  'Lo escribio la sesion de la notebook de Calidad (CATA), a pedido de Fak. Desde la notebook NO se'] };
const VIEJO = { nombre: 'PEDIDO mail a Manuel - IMDS 09-10-2026.txt', cabecera: [
  'PEDIDO PARA TU CLAUDE (en tu PC): armar y dejar en Borradores un mail a Manuel Meszaros',
  '(gerente de Calidad) pidiendo su OK antes de enviar los IMDS a Volkswagen. NO enviarlo solo.'] };
const AJENO = { nombre: 'Error IMDS - freno de permisos 08-10-2026.md', cabecera: ['PEDIDO PARA TU CLAUDE (PC principal)'] };
// Casos que todavia no existen en la carpeta, para las reglas de destino (H5, H6):
const P9_RARO = { nombre: 'PEDIDO 9 - revisar fichas de embalaje 17-10-2026.txt', cabecera: ['PEDIDO 9 PARA LA PC DE INGENIERIA - 17/10/2026 09:00', 'Lo escribio la sesion de CATA, a pedido de Fak.'] };
const P10_NB = { nombre: 'PEDIDO 10 - bajar videos del telefono 17-10-2026.txt', cabecera: ['PEDIDO 10 PARA LA SESION DE LA NOTEBOOK - 17/10/2026 9:30', 'Lo escribio la sesion de la PC principal, a pedido de Fak.'] };

describe('pedidosPendientes — que PC soy y a quien va cada pedido', () => {
  it('quienSoy: la PC principal del canon (sin importar mayusculas); cualquier otro nombre es una notebook', () => {
    expect(CANON.pc_principal).toContain('DESKTOP-14JG95B');
    expect(quienSoy('DESKTOP-14JG95B')).toBe('principal');
    expect(quienSoy('desktop-14jg95b')).toBe('principal');
    expect(quienSoy('CATA')).toBe('notebook');
    expect(quienSoy('')).toBe('notebook');
  });

  it('destinoDe: las formas reales de «para la PC principal», las de «para la notebook» (con o sin CATA), el REEMPLAZADO y lo que no se entiende', () => {
    expect(destinoDe('PEDIDO 8 PARA TU CLAUDE (PC principal) - 16/10/2026')).toEqual({ a: 'principal', notebook: null });
    expect(destinoDe('PEDIDO PARA TU CLAUDE (en tu PC principal) - 13/10/2026 16:45').a).toBe('principal');
    expect(destinoDe('PEDIDO PARA TU CLAUDE (en tu PC): armar y dejar en Borradores').a).toBe('principal');
    expect(destinoDe('PEDIDO IMDS PATAGONIA - SEGUIR EL ENVIO A VW (desde la PC de Fak)').a).toBe('principal');
    expect(destinoDe('PEDIDO 5 PARA LA SESION DE LA NOTEBOOK DE CALIDAD (CATA) - 15/10/2026 09:45')).toEqual({ a: 'notebook', notebook: 'CATA' });
    expect(destinoDe('PEDIDO IMDS PATAGONIA - PARA SEGUIR EN LA NOTEBOOK DE CALIDAD').a).toBe('notebook');
    expect(destinoDe('PEDIDO 10 PARA LA SESION DE LA NOTEBOOK - 17/10/2026')).toEqual({ a: 'notebook', notebook: null });
    expect(destinoDe('*** REEMPLAZADO (15/10/2026 ~16:00) - ESTE PEDIDO NO SE HACE ***').a).toBe('reemplazado');
    expect(destinoDe('PEDIDO 9 PARA LA PC DE INGENIERIA - 17/10/2026').a).toBe('todos');
    expect(destinoDe('').a).toBe('todos');
  });

  it('origenDe y queDe: quien lo escribio y que pide, sacados del segundo renglon y del nombre', () => {
    expect(origenDe(P8.cabecera[1])).toBe('CATA');
    expect(origenDe(P5.cabecera[1])).toBe('la PC principal');
    expect(origenDe('')).toBe('');
    expect(queDe(P8.nombre)).toBe('mail a Luca - IMDS Upper Trim');
    expect(queDe(P1.nombre)).toBe('mail a Calidad - todos los IMDS aprobados');
    expect(queDe(VIEJO.nombre)).toBe('mail a Manuel - IMDS');
  });

  it('leerPedido: numero («8», «1 de 2», «7b»), fecha del nombre, hora del encabezado y la marca «listo» (con o sin guion)', () => {
    expect(leerPedido(P8.nombre, P8.cabecera)).toMatchObject({ numero: '8', fecha: '2026-10-16', hora: null, destino: 'principal', origen: 'CATA', esListo: false });
    expect(leerPedido(P1.nombre, P1.cabecera)).toMatchObject({ numero: '1 de 2', fecha: '2026-10-14', hora: '14:12' });
    expect(leerPedido(P7B.nombre, P7B.cabecera)).toMatchObject({ numero: '7b', hora: '16:00', destino: 'notebook', notebook: 'CATA' });
    expect(leerPedido(P8_LISTO.nombre, P8_LISTO.cabecera)).toMatchObject({ esListo: true, listoDe: '8' });
    expect(leerPedido(P6_LISTO.nombre, P6_LISTO.cabecera)).toMatchObject({ esListo: true, listoDe: '6' });
    expect(leerPedido('PEDIDO 8 listo mail a Luca.txt', [])).toMatchObject({ esListo: true, listoDe: '8' });   // H10: sin guion tambien
  });
});

describe('pedidosPendientes — los renglones que le llegan a esta PC', () => {
  it('ROJO: el PEDIDO 8 sin su «listo» -> un renglon con la marca, el numero, que pide, de quien y la fecha; dice «sin su listo», no «sin hacer»', () => {
    const { lineas } = pedidosPendientes({ archivos: [P8, AJENO], pc: 'principal' });
    expect(lineas).toHaveLength(1);
    expect(lineas[0]).toContain(MARCA);
    expect(lineas[0]).toContain('sin su «listo»: PEDIDO 8 - mail a Luca - IMDS Upper Trim');
    expect(lineas[0]).toContain('de CATA, 16/10');
    expect(lineas[0]).toContain('«PEDIDO 8 - listo <que>.txt»');
    expect(lineas[0]).not.toContain('sin hacer');
  });

  it('VERDE: con «PEDIDO 8 - listo …» en la carpeta no dice nada; para la otra PC tampoco; sin archivos, nada', () => {
    expect(pedidosPendientes({ archivos: [P8, P8_LISTO], pc: 'principal' }).lineas).toEqual([]);
    expect(pedidosPendientes({ archivos: [P8], pc: 'notebook', nombre: 'CATA' }).lineas).toEqual([]);
    expect(pedidosPendientes({ archivos: [], pc: 'principal' }).lineas).toEqual([]);
  });

  it('un pedido REEMPLAZADO no se nombra; el que lo reemplaza si, en la PC a la que va', () => {
    expect(pedidosPendientes({ archivos: [P7, P7B], pc: 'principal' }).lineas).toEqual([]);
    const nb = pedidosPendientes({ archivos: [P7, P7B], pc: 'notebook', nombre: 'CATA' }).lineas;
    expect(nb).toHaveLength(1);
    expect(nb[0]).toContain('PEDIDO 7b - BeOn apoyacabezas');
    expect(nb[0]).toContain('de la PC principal, 15/10 16:00');
  });

  it('la marca «listo» cierra SOLO su numero: «PEDIDO 6 - listo» no cierra al PEDIDO 5 (caso real del 15/10)', () => {
    const nb = pedidosPendientes({ archivos: [P5, P6_LISTO], pc: 'notebook', nombre: 'CATA' }).lineas;
    expect(nb).toHaveLength(1);
    expect(nb[0]).toContain('PEDIDO 5 -');
  });

  it('H6: un pedido «para CATA» no le llega a la otra notebook; uno «para la notebook» sin nombre le llega a cualquiera', () => {
    expect(pedidosPendientes({ archivos: [P7B], pc: 'notebook', nombre: 'OTRA-NB' }).lineas).toEqual([]);
    expect(pedidosPendientes({ archivos: [P7B], pc: 'notebook', nombre: 'Cata' }).lineas).toHaveLength(1);
    expect(pedidosPendientes({ archivos: [P7B], pc: 'notebook' }).lineas).toHaveLength(1);           // sin nombre: no se filtra
    expect(pedidosPendientes({ archivos: [P10_NB], pc: 'notebook', nombre: 'OTRA-NB' }).lineas).toHaveLength(1);
    expect(pedidosPendientes({ archivos: [P10_NB], pc: 'principal' }).lineas).toEqual([]);
  });

  it('H5: un destino que no se entiende se nombra en las DOS PC con la aclaracion, antes que perderlo', () => {
    for (const pc of ['principal', 'notebook']) {
      const l = pedidosPendientes({ archivos: [P9_RARO], pc, nombre: pc === 'notebook' ? 'CATA' : 'DESKTOP-14JG95B' }).lineas;
      expect(l, pc).toHaveLength(1);
      expect(l[0]).toContain('PEDIDO 9 - revisar fichas de embalaje');
      expect(l[0]).toContain('[el encabezado no dice para que PC es: mirarlo]');
    }
  });

  it('H1: los pedidos SIN numero (antes del 14/10) no se nombran: no hay forma de cerrarlos; los numerados viejos van en UN renglon', () => {
    const { lineas, nuevos, viejos } = pedidosPendientes({ archivos: [P1, VIEJO, P8_LISTO], pc: 'principal' });
    expect(nuevos).toHaveLength(0);
    expect(viejos).toHaveLength(1);
    expect(lineas).toHaveLength(1);
    expect(lineas[0]).toContain('1 pedido(s) para esta PC sin marca «listo» de antes del 15/10');
    expect(lineas[0]).toContain('PEDIDO 1 de 2 (mail a Calidad - todos los IMDS aprobados)');
    expect(lineas[0]).not.toContain('mail a Manuel');
    expect(lineas[0]).not.toContain('Hay un pedido');
    expect(pedidosPendientes({ archivos: [VIEJO], pc: 'principal' }).lineas).toEqual([]);
  });

  it('H11: los pendientes nuevos salen en orden de fecha y hora, y 9:30 va antes que 16:00', () => {
    const nb = pedidosPendientes({ archivos: [P7B, P5, P10_NB], pc: 'notebook', nombre: 'CATA' }).lineas;
    expect(nb.map((l) => l.match(/PEDIDO (\S+) -/)[1])).toEqual(['5', '7b', '10']);
    const dia = pedidosPendientes({ archivos: [
      { nombre: 'PEDIDO 11 - a 17-10-2026.txt', cabecera: ['PEDIDO 11 PARA LA SESION DE LA NOTEBOOK - 17/10/2026 15:00', ''] },
      { nombre: 'PEDIDO 12 - b 17-10-2026.txt', cabecera: ['PEDIDO 12 PARA LA SESION DE LA NOTEBOOK - 17/10/2026 9:30', ''] },
    ], pc: 'notebook' }).lineas;
    expect(dia.map((l) => l.match(/PEDIDO (\S+) -/)[1])).toEqual(['12', '11']);
  });
});

describe('pedidos-pendientes.sh (hook global) — lee la carpeta real y calla si no hay nada', () => {
  const carpeta = path.join(TMP, 'FACUNDO');
  fs.mkdirSync(carpeta, { recursive: true });
  const escribir = (p) => fs.writeFileSync(path.join(carpeta, p.nombre), `${p.cabecera.join('\n')}\n\nQUE HACER: ...\n`, 'utf8');
  const correr = (extra = {}) => spawnSync('bash', [HOOK], {
    input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', cwd: 'C:\\Dev' }),
    encoding: 'utf8', cwd: RAIZ,
    env: { ...process.env, BARACK_REPO: posix(RAIZ), BARACK_FACUNDO: posix(carpeta), BARACK_PC: 'principal', COMPUTERNAME: 'DESKTOP-14JG95B', ...extra },
  });

  it('ROJO: el PEDIDO 8 sin listo -> el renglon por stdout, exit 0', () => {
    escribir(P8); escribir(P7); escribir(P7B); escribir(AJENO);
    const r = correr();
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/\[PEDIDOS\] Hay un pedido para esta PC sin su «listo»: PEDIDO 8 - mail a Luca - IMDS Upper Trim \(de CATA, 16\/10\)/);
    expect(r.stdout.trim().split('\n')).toHaveLength(1);
    expect(renglonesDeLaCarpeta({ carpeta, pc: 'principal' })).toHaveLength(1);
  });

  it('VERDE: con el «listo» no dice nada; CATA ve solo lo suyo (el 7b); la otra notebook no ve el 7b; sin carpeta, nada y exit 0', () => {
    escribir(P8_LISTO);
    expect(correr()).toMatchObject({ status: 0, stdout: '' });
    const nb = correr({ BARACK_PC: 'notebook', COMPUTERNAME: 'CATA' });
    expect(nb.status).toBe(0);
    expect(nb.stdout).toContain('PEDIDO 7b');
    expect(nb.stdout).not.toContain('PEDIDO 8');
    expect(correr({ BARACK_PC: 'notebook', COMPUTERNAME: 'OTRA-NB' })).toMatchObject({ status: 0, stdout: '' });
    expect(correr({ BARACK_FACUNDO: posix(path.join(TMP, 'no-existe')) })).toMatchObject({ status: 0, stdout: '' });
    expect(renglonesDeLaCarpeta({ carpeta: path.join(TMP, 'no-existe'), pc: 'principal' })).toEqual([]);
  });

  it('H5: un pedido escrito en UTF-16 (PowerShell) se lee igual', () => {
    const utf16 = path.join(carpeta, 'PEDIDO 13 - prueba utf16 17-10-2026.txt');
    fs.writeFileSync(utf16, Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from('PEDIDO 13 PARA TU CLAUDE (PC principal) - 17/10/2026 10:00\r\nLo escribio la sesion de CATA.\r\n', 'utf16le')]));
    expect(primerosRenglones(utf16)[0]).toBe('PEDIDO 13 PARA TU CLAUDE (PC principal) - 17/10/2026 10:00');
    const r = correr();
    expect(r.stdout).toContain('PEDIDO 13 - prueba utf16');
    fs.rmSync(utf16, { force: true });
  });
});
