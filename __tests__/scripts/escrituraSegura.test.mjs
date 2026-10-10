// @vitest-environment node
/**
 * Tests de scripts/_lib/escrituraSegura.mjs — el candado 1 de la noche de Claude hecho codigo:
 * lo que la noche escribe solo cae en carpetas ignoradas por git.
 *
 * Se prueba en las dos direcciones: el VERDE (las carpetas permitidas escriben) y el ROJO (una ruta del
 * repo que NO esta ignorada, un `..` que sale, una ruta fuera del repo, una variable de entorno que
 * intenta abrir el repo entero) tiene que tirar ANTES de crear ningun archivo. Todo con `env` explicito
 * para que un BARACK_* de otro test no se meta en la lista, y sin rutas de un sistema operativo.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  escribirSeguro, agregarSeguro, rutaPermitida, carpetasPermitidas, VARIABLES_DE_CARPETA,
} from '../../scripts/_lib/escrituraSegura.mjs';

const RAIZ = path.resolve(fileURLToPath(import.meta.url), '../../..');
const dentro = (...partes) => path.join(RAIZ, ...partes);

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'escritura-segura-')); });
afterEach(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temp */ } });

describe('escrituraSegura · que rutas deja pasar', () => {
  it('VERDE: las tres carpetas ignoradas del repo', () => {
    for (const ruta of [
      dentro('.claude', 'state', 'nocturno.json'),
      dentro('.sgc-cache', 'api', 'ledger_2026-10.jsonl'),
      dentro('.sgc-cache', 'x-seguimiento', 'resumen.md'),
      dentro('reports', 'staging', 'PREAUDITORIA_AMFE_20261008.md'),
    ]) {
      expect(rutaPermitida(ruta, { env: {} }), ruta).toMatchObject({ ok: true });
    }
  });

  it('ROJO: una ruta versionada del repo, un `..` que sale, un prefijo parecido y la carpeta misma', () => {
    for (const ruta of [
      dentro('scripts', 'x.mjs'),
      dentro('docs', 'nota.md'),
      dentro('.claude', 'rules', 'api-claude.md'),
      dentro('.claude', 'state', '..', '..', 'scripts', 'x.mjs'),
      dentro('.sgc-cacheX', 'x.txt'),                 // startsWith diria que si
      dentro('reports', 'otro', 'x.md'),
      dentro('.sgc-cache'),                            // la carpeta no es un archivo
      '',
    ]) {
      const r = rutaPermitida(ruta, { env: {} });
      expect(r.ok, `"${ruta}" no tendria que pasar`).toBe(false);
      expect(r.motivo.length).toBeGreaterThan(5);
    }
  });

  it('ROJO: una ruta fuera del repo tampoco, salvo que una variable BARACK_*_DIR la nombre', () => {
    const fuera = path.join(tmp, 'afuera', 'x.txt');
    expect(rutaPermitida(fuera, { env: {} }).ok).toBe(false);
    for (const v of VARIABLES_DE_CARPETA) {
      expect(rutaPermitida(fuera, { env: { [v]: path.join(tmp, 'afuera') } }), v).toMatchObject({ ok: true, base: v });
    }
    // la variable con otra carpeta no habilita esta
    expect(rutaPermitida(fuera, { env: { BARACK_API_DIR: path.join(tmp, 'otra') } }).ok).toBe(false);
  });

  it('una variable que abriria el repo entero se ignora (raiz del disco, el repo, quien lo contiene, una carpeta versionada)', () => {
    const peligrosas = [path.parse(RAIZ).root, RAIZ, path.dirname(RAIZ), dentro('scripts'), dentro('docs'), dentro('.claude')];
    for (const p of peligrosas) {
      const lista = carpetasPermitidas({ env: { BARACK_API_DIR: p } });
      expect(lista.some((c) => c.origen === 'BARACK_API_DIR'), `BARACK_API_DIR=${p}`).toBe(false);
      expect(rutaPermitida(dentro('scripts', 'x.mjs'), { env: { BARACK_API_DIR: p } }).ok, `BARACK_API_DIR=${p}`).toBe(false);
    }
    // adentro de una carpeta ignorada SI sirve (mover el cache dentro de .sgc-cache)
    expect(carpetasPermitidas({ env: { BARACK_API_DIR: dentro('.sgc-cache', 'otra') } }).some((c) => c.origen === 'BARACK_API_DIR')).toBe(true);
  });

  it('el entorno se lee en CADA llamada (no al importar)', () => {
    const ruta = path.join(tmp, 'x.txt');             // carpeta nueva: ninguna variable de afuera la nombra
    const previo = process.env.BARACK_API_DIR;
    try {
      delete process.env.BARACK_API_DIR;
      expect(rutaPermitida(ruta).ok).toBe(false);
      process.env.BARACK_API_DIR = tmp;
      expect(rutaPermitida(ruta).ok).toBe(true);
      delete process.env.BARACK_API_DIR;
      expect(rutaPermitida(ruta).ok).toBe(false);
    } finally {
      if (previo === undefined) delete process.env.BARACK_API_DIR; else process.env.BARACK_API_DIR = previo;
    }
  });

  it('un enlace dentro de una carpeta permitida que sale hacia afuera no es una puerta', () => {
    const base = path.join(tmp, 'base');
    const afuera = path.join(tmp, 'afuera');
    fs.mkdirSync(base); fs.mkdirSync(afuera);
    try { fs.symlinkSync(afuera, path.join(base, 'salida'), 'junction'); } catch { return; /* sin permiso para enlaces: no se puede armar el caso */ }
    const env = { BARACK_API_DIR: base };
    expect(rutaPermitida(path.join(base, 'normal', 'x.txt'), { env }).ok).toBe(true);
    const r = rutaPermitida(path.join(base, 'salida', 'x.txt'), { env });
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/enlace/);
  });

  // H16 (09/10/2026): en Windows el repo tiene nombre corto 8.3 (en esta PC C:\Dev\BARACK~1) y el realpathSync
  // comun de Node no lo expande: una variable que nombrara el repo por ese nombre pasaba por "carpeta de afuera".
  // En Linux (el CI) no hay nombres cortos: el caso no se puede armar y el test no corre.
  const nombreCorto = (() => {
    if (process.platform !== 'win32') return null;
    try {
      const salida = execSync(`cmd /c dir /x "${path.dirname(RAIZ)}"`, { encoding: 'utf8', windowsHide: true });
      const linea = salida.split(/\r?\n/).find((l) => l.trimEnd().endsWith(` ${path.basename(RAIZ)}`));
      const partes = linea ? linea.trim().split(/\s+/) : [];
      const corto = partes.length >= 2 ? partes[partes.length - 2] : '';
      return /~\d/.test(corto) ? path.join(path.dirname(RAIZ), corto) : null;
    } catch { return null; }
  })();

  it.skipIf(!nombreCorto)('ROJO: el repo nombrado por su nombre corto 8.3 no abre ni el repo ni una carpeta versionada', () => {
    for (const v of [nombreCorto, path.join(nombreCorto, 'scripts')]) {
      const env = { BARACK_API_DIR: v };
      expect(carpetasPermitidas({ env }).map((c) => c.origen), v).not.toContain('BARACK_API_DIR');
      expect(rutaPermitida(path.join(nombreCorto, 'scripts', 'x.mjs'), { env }).ok, v).toBe(false);
    }
  });

  // El auditor del 09/10 encontro la misma puerta por el recurso administrativo de la propia PC (\\localhost\C$\...):
  // realpathSync.native lo devuelve tal cual y la comparacion por ruta no lo veia. Solo si ese recurso se puede abrir.
  const porRecurso = (() => {
    if (process.platform !== 'win32' || !/^[A-Za-z]:\\/.test(RAIZ)) return null;
    const unc = `\\\\localhost\\${RAIZ[0]}$${RAIZ.slice(2)}`;
    try { return fs.existsSync(path.join(unc, 'package.json')) ? unc : null; } catch { return null; }
  })();

  it.skipIf(!porRecurso)('ROJO: el repo nombrado por \\\\localhost\\C$ no abre ni el repo ni una carpeta versionada', () => {
    for (const v of [porRecurso, path.join(porRecurso, 'scripts'), path.join(porRecurso, '.sgc-cache')]) {
      const env = { BARACK_API_DIR: v };
      expect(carpetasPermitidas({ env }).map((c) => c.origen), v).not.toContain('BARACK_API_DIR');
    }
    expect(rutaPermitida(path.join(porRecurso, 'scripts', 'x.mjs'), { env: { BARACK_API_DIR: path.join(porRecurso, 'scripts') } }).ok).toBe(false);
  });

  it('VERDE: una carpeta temporal de afuera sigue permitida (por la ruta larga y por la que da el sistema)', () => {
    const env = { BARACK_API_DIR: tmp };
    expect(carpetasPermitidas({ env }).map((c) => c.origen)).toContain('BARACK_API_DIR');
    expect(rutaPermitida(path.join(tmp, 'sub', 'x.json'), { env }).ok).toBe(true);
  });

  it.skipIf(!nombreCorto)('VERDE: por el nombre corto, una carpeta ignorada del repo sigue permitida', () => {
    expect(rutaPermitida(path.join(nombreCorto, '.sgc-cache', 'api', 'x.json'), { env: {} }).ok).toBe(true);
    const env = { BARACK_API_DIR: path.join(nombreCorto, '.sgc-cache', 'api') };
    expect(carpetasPermitidas({ env }).map((c) => c.origen)).toContain('BARACK_API_DIR');
  });
});

describe('escrituraSegura · escribir de verdad', () => {
  it('VERDE: escribe atomico (sin .tmp), pisa lo anterior y crea las carpetas que faltan', () => {
    const env = { BARACK_PREAUDITORIA_DIR: tmp };
    const ruta = path.join(tmp, 'estado', 'sub', 'estado.json');
    escribirSeguro(ruta, 'uno', { env });
    escribirSeguro(ruta, 'dos', { env });
    expect(fs.readFileSync(ruta, 'utf8')).toBe('dos');
    expect(fs.readdirSync(path.dirname(ruta)).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('VERDE: agregarSeguro suma al final', () => {
    const env = { BARACK_API_DIR: tmp };
    const ruta = path.join(tmp, 'nocturno.log');
    agregarSeguro(ruta, 'a\n', { env });
    agregarSeguro(ruta, 'b\n', { env });
    expect(fs.readFileSync(ruta, 'utf8')).toBe('a\nb\n');
  });

  it('ROJO: una ruta del repo o de afuera tira un error claro y no crea nada', () => {
    const fuera = path.join(tmp, 'no', 'creada', 'x.txt');
    expect(() => escribirSeguro(fuera, 'x', { env: {} })).toThrow(/escrituraSegura: no escribo en/);
    expect(() => agregarSeguro(fuera, 'x', { env: {} })).toThrow(/no escribo en/);
    expect(fs.existsSync(path.join(tmp, 'no'))).toBe(false);
    const delRepo = dentro('scripts', '_prueba_escritura_segura.mjs');
    expect(() => escribirSeguro(delRepo, 'x', { env: {} })).toThrow(/ignoradas por git/);
    expect(fs.existsSync(delRepo)).toBe(false);
    expect(fs.existsSync(`${delRepo}.tmp`)).toBe(false);
  });

  it('con una raiz de mentira: .sgc-cache de esa raiz si, su carpeta de codigo no', () => {
    const raiz = path.join(tmp, 'repo');
    fs.mkdirSync(raiz);
    escribirSeguro(path.join(raiz, '.sgc-cache', 'api', 'a.txt'), 'ok', { env: {}, raiz });
    expect(fs.readFileSync(path.join(raiz, '.sgc-cache', 'api', 'a.txt'), 'utf8')).toBe('ok');
    expect(() => escribirSeguro(path.join(raiz, 'src', 'a.txt'), 'no', { env: {}, raiz })).toThrow(/no escribo en/);
    expect(fs.existsSync(path.join(raiz, 'src'))).toBe(false);
  });
});
