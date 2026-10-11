// __tests__/scripts/cierreGuardFirmaExports.test.mjs
// @vitest-environment node
/**
 * HOY-12 (10/10/2026): el cierre-guard que corren los tests no barre el exports/ REAL de la PC.
 *
 * Se prueban dos cosas, en las dos direcciones:
 *   1. El candado de la carpeta de exports de prueba (variable CIERRE_GUARD_EXPORTS_PRUEBA): vale con VITEST puesto y se
 *      ignora sin el. En proceso (`raizExports`, `exportsDelTurno` y `documentosDelTurno` con otra raiz) y por el hook de verdad.
 *   2. El chequeo 9 de punta a punta (bash -> node -> _sinFirmaIA.py), que no tenia test: un CSV con `CREADO POR;Claude`
 *      frena (lo midio la hija 8, 0,8 s) y con F.Santoro pasa.
 * El mensaje de Fak es uno real del 05/10 (cola, HOY-19e). Todo lo "escrito en el turno" vive en carpetas temporales.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { raizExports, exportsDelTurno, documentosDelTurno, cierreNombra, VAR_EXPORTS_PRUEBA, REPO } from '../../scripts/_lib/cierreGuard.mjs';

const HOOK = path.join(REPO, '.claude', 'hooks', 'cierre-guard.sh');
const MENSAJE_FAK = 'revisa que esten compeltas las incompeltas no me srienv';
// un final neutro: ni cierre declarado, ni permiso, ni anuncio, ni ingles (asi solo puede frenar el chequeo 9)
const FINAL = 'La hoja de prueba tiene dos columnas.';
const HORA = 3_600_000;
// una carpeta con nombre de entrega real: `excluir_re` del canon no la saca, y el filtro la ve como `exports/HO_HOY12/`
const CARPETA = 'HO_HOY12';

const carpeta = (pref) => fs.mkdtempSync(path.join(os.tmpdir(), `cg-hoy12-${pref}-`));
const escribir = (raiz, rel, contenido, fecha) => {
  const f = path.join(raiz, ...rel.split('/'));
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, contenido);
  if (fecha) fs.utimesSync(f, fecha, fecha);
  return f;
};
const registro = (ts) => {
  const f = path.join(os.tmpdir(), `cg-hoy12-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
  fs.writeFileSync(f, `${JSON.stringify({ type: 'user', timestamp: ts, origin: { kind: 'human' }, message: { role: 'user', content: MENSAJE_FAK } })}\n`);
  return f;
};
const correrHook = (transcript, env) => spawnSync('bash', [HOOK], {
  input: JSON.stringify({ hook_event_name: 'Stop', session_id: `hoy12-${process.pid}`, transcript_path: transcript, last_assistant_message: FINAL }),
  encoding: 'utf8', env,
});
const conVitest = (dir) => ({ ...process.env, VITEST: 'true', [VAR_EXPORTS_PRUEBA]: dir });
const sinVitest = (dir) => { const e = { ...process.env, [VAR_EXPORTS_PRUEBA]: dir }; delete e.VITEST; return e; };

describe('raizExports: la carpeta de prueba vale solo adentro de vitest', () => {
  const real = path.join(REPO, 'exports');
  it('VERDE: con VITEST y la variable, usa la carpeta de prueba', () => {
    expect(raizExports(REPO, { VITEST: 'true', [VAR_EXPORTS_PRUEBA]: 'C:\\tmp\\x' })).toBe('C:\\tmp\\x');
  });
  it('ROJO: sin VITEST la variable se ignora y se mira <repo>/exports', () => {
    expect(raizExports(REPO, { [VAR_EXPORTS_PRUEBA]: 'C:\\tmp\\x' })).toBe(real);
    expect(raizExports(REPO, {})).toBe(real);
  });
  it('ROJO: con VITEST y la variable vacia o en blanco, tambien <repo>/exports', () => {
    expect(raizExports(REPO, { VITEST: 'true', [VAR_EXPORTS_PRUEBA]: '  ' })).toBe(real);
  });
});

describe('exportsDelTurno y documentosDelTurno con otra raiz', () => {
  it('VERDE: lo escrito en el turno sale como exports/<carpeta>/<archivo> y el cierre lo nombra por la carpeta', () => {
    const raiz = carpeta('exp');
    try {
      const turnoTs = new Date(Date.now() - 5000).toISOString();
      escribir(raiz, `${CARPETA}/HOJA_HOY12_01.pdf`, '%PDF-1.4\n');
      const lista = exportsDelTurno({ turnoTs }, REPO, 5000, raiz);
      expect(lista.map((a) => a.rel)).toEqual([`exports/${CARPETA}/HOJA_HOY12_01.pdf`]);
      expect(cierreNombra(`Quedó en exports/${CARPETA}/.`, lista[0])).toBe(true);
    } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
  });
  it('ROJO: lo de antes del turno no sale, y sin la hora del turno no se barre nada', () => {
    const raiz = carpeta('exp-viejo');
    try {
      // la fecha que cuenta es la mas nueva entre modificacion y CREACION (una copia nace hoy, auditor R4), y utimesSync
      // no cambia la de creacion: el archivo nace ahora y el turno se abre una hora mas tarde
      escribir(raiz, `${CARPETA}/HOJA_VIEJA_01.pdf`, '%PDF-1.4\n');
      expect(exportsDelTurno({ turnoTs: new Date(Date.now() + HORA).toISOString() }, REPO, 5000, raiz)).toEqual([]);
      expect(exportsDelTurno({}, REPO, 5000, raiz)).toEqual([]);
    } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
  });
  it('documentosDelTurno: VERDE ve el CSV del turno en la raiz dada · ROJO sin mensaje de Fak no lista nada', () => {
    const raiz = carpeta('doc');
    try {
      const ts = new Date(Date.now() - 5000).toISOString();
      const f = escribir(raiz, `${CARPETA}/listado.csv`, 'CREADO POR;F.Santoro\n');
      expect(documentosDelTurno({ ultimoMensajeFakTs: ts }, REPO, raiz)).toEqual([f]);
      expect(documentosDelTurno({}, REPO, raiz)).toEqual([]);
    } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
  });
});

describe('chequeo 9 de punta a punta, por el hook de verdad (bash -> node -> _sinFirmaIA.py)', () => {
  // El registro y el CSV van fechados en el FUTURO: asi, si la variable se ignora, el exports/ real de esta PC no
  // tiene nada posterior y el detector ni corre. El rojo del candado no depende de lo que haya en la PC.
  const armar = (contenido) => {
    const raiz = carpeta('e2e');
    escribir(raiz, `${CARPETA}/listado.csv`, contenido, new Date(Date.now() + 2 * HORA));
    return { raiz, transcript: registro(new Date(Date.now() + HORA).toISOString()) };
  };
  const limpiar = ({ raiz, transcript }) => { fs.rmSync(raiz, { recursive: true, force: true }); fs.unlinkSync(transcript); };

  it('ROJO: un CSV con CREADO POR;Claude escrito en el turno frena con exit 2', () => {
    const c = armar('CREADO POR;Claude\n');
    try {
      const r = correrHook(c.transcript, conVitest(c.raiz));
      expect(r.status, r.stderr).toBe(2);
      expect(r.stderr).toMatch(/dice que lo hizo Claude o una IA/);
      expect(r.stderr).toMatch(/listado\.csv/);
    } finally { limpiar(c); }
  }, 60_000);
  it('VERDE: el mismo CSV con CREADO POR;F.Santoro pasa con exit 0', () => {
    const c = armar('CREADO POR;F.Santoro\n');
    try {
      const r = correrHook(c.transcript, conVitest(c.raiz));
      expect(r.status, r.stderr).toBe(0);
    } finally { limpiar(c); }
  }, 60_000);
  it('ROJO del candado: sin VITEST la variable no vale y el CSV con Claude no se ve (exit 0)', () => {
    const c = armar('CREADO POR;Claude\n');
    try {
      const r = correrHook(c.transcript, sinVitest(c.raiz));
      expect(r.status, r.stderr).toBe(0);
      expect(r.stderr).not.toMatch(/dice que lo hizo Claude/);
    } finally { limpiar(c); }
  }, 60_000);
});
