// __tests__/scripts/cierreGuardFirmaCache.test.mjs
// @vitest-environment node
/**
 * Chequeo 9 del cierre (firma de IA en los documentos del turno): cada documento se revisa UNA vez y despues se usa
 * lo guardado mientras no cambie (12/10/2026). Se prueba con un detector inyectado (para contar cuantas veces corre)
 * y una vez con el detector de verdad (python) sobre un CSV que dice «Claude».
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { correrDetectorFirma, REPO, ARGS_DETECTOR } from '../../scripts/_lib/cierreGuard.mjs';

let raiz; let n = 0;
beforeAll(() => { raiz = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-firma-'))); });
afterAll(() => { try { fs.rmSync(raiz, { recursive: true, force: true }); } catch { /* temporal */ } });

function caso() {
  const dir = path.join(raiz, `c${++n}`);
  fs.mkdirSync(dir, { recursive: true });
  const env = { CIERRE_ESTADO_DIR: path.join(dir, 'estado') };
  const doc = (nombre, txt) => { const f = path.join(dir, nombre); fs.writeFileSync(f, txt); return f; };
  return { dir, env, doc };
}
// un detector de mentira: marca BLOQUEANTE a los que dicen "claude" y cuenta lo que se le pide
function detector() {
  const pedidos = [];
  const crudo = (rutas) => { pedidos.push([...rutas]); return rutas.filter((r) => /claude/i.test(fs.readFileSync(r, 'utf8'))).map((r) => ({ archivo: r, nivel: 'BLOQUEANTE', lugar: 'contenido', texto: 'Claude' })); };
  return { pedidos, crudo };
}

describe('firma: cada documento se revisa una vez', () => {
  it('verde: la segunda vez no corre el detector y devuelve lo mismo (el bloqueante sigue frenando)', () => {
    const c = caso(); const d = detector();
    const a = c.doc('a.csv', 'CREADO POR;F.Santoro'); const b = c.doc('b.csv', 'CREADO POR;Claude');
    const r1 = correrDetectorFirma([a, b], REPO, { env: c.env, crudo: d.crudo });
    const r2 = correrDetectorFirma([a, b], REPO, { env: c.env, crudo: d.crudo });
    expect(d.pedidos).toEqual([[a, b]]);
    expect(r2).toEqual(r1);
    expect(r2).toHaveLength(1);
    expect(r2[0].archivo).toBe(b);
  });

  it('rojo: un documento que cambia (tamaño o fecha) se vuelve a revisar, solo ese', () => {
    const c = caso(); const d = detector();
    const a = c.doc('a.csv', 'CREADO POR;F.Santoro'); const b = c.doc('b.csv', 'nada');
    correrDetectorFirma([a, b], REPO, { env: c.env, crudo: d.crudo });
    fs.writeFileSync(a, 'CREADO POR;Claude para Excel');
    const r = correrDetectorFirma([a, b], REPO, { env: c.env, crudo: d.crudo });
    expect(d.pedidos[1]).toEqual([a]);
    expect(r.map((x) => x.archivo)).toEqual([a]);
  });

  it('rojo: si el detector no corrio (tope, error) no se guarda nada y la vez siguiente se revisa', () => {
    const c = caso(); const d = detector();
    const a = c.doc('a.csv', 'CREADO POR;Claude');
    expect(correrDetectorFirma([a], REPO, { env: c.env, crudo: () => null })).toEqual([]);
    expect(correrDetectorFirma([a], REPO, { env: c.env, crudo: d.crudo })).toHaveLength(1);
    expect(d.pedidos).toHaveLength(1);
  });

  it('rojo: un hallazgo que no se puede atribuir a una ruta pedida no deja guardado un «limpio» falso', () => {
    const c = caso(); const d = detector();
    const a = c.doc('a.csv', 'CREADO POR;Claude');
    const raro = () => [{ archivo: 'C:\\otro\\lado.csv', nivel: 'BLOQUEANTE' }];
    expect(correrDetectorFirma([a], REPO, { env: c.env, crudo: raro })).toHaveLength(1);
    expect(correrDetectorFirma([a], REPO, { env: c.env, crudo: d.crudo })).toHaveLength(1);
    expect(d.pedidos).toHaveLength(1);                     // la segunda corrio: no habia nada guardado
  });

  it('verde: el hallazgo de un adjunto («mail.msg → adjunto x.xlsx») es del .msg pedido y se guarda con el', () => {
    const c = caso();
    const m = c.doc('borrador.msg', 'x');
    let veces = 0;
    const crudo = (rutas) => { veces++; return [{ archivo: `${rutas[0]} → adjunto Codigos.xlsx`, nivel: 'BLOQUEANTE', lugar: 'xl/webextensions/webextension1.xml' }]; };
    const r1 = correrDetectorFirma([m], REPO, { env: c.env, crudo });
    const r2 = correrDetectorFirma([m], REPO, { env: c.env, crudo });
    expect(veces).toBe(1);
    expect(r2).toEqual(r1);
    expect(r2).toHaveLength(1);
  });

  it('rojo: si cambia el detector o su canon, se revisa todo de nuevo', () => {
    const c = caso(); const d = detector();
    const repo = path.join(c.dir, 'repo');
    fs.mkdirSync(path.join(repo, 'scripts', '_lib'), { recursive: true });
    for (const f of ['_sinFirmaIA.py', '_lib/firmaIA.py', '_lib/firmaIA.data.json']) fs.writeFileSync(path.join(repo, 'scripts', f), 'v1');
    const a = c.doc('a.csv', 'nada');
    correrDetectorFirma([a], repo, { env: c.env, crudo: d.crudo });
    fs.writeFileSync(path.join(repo, 'scripts', '_lib', 'firmaIA.data.json'), 'v2 con otra palabra');
    correrDetectorFirma([a], repo, { env: c.env, crudo: d.crudo });
    expect(d.pedidos).toHaveLength(2);
  });

  it('adentro de vitest sin carpeta propia no guarda: corre siempre', () => {
    const c = caso(); const d = detector();
    const a = c.doc('a.csv', 'x');
    correrDetectorFirma([a], REPO, { env: { VITEST: 'true' }, crudo: d.crudo });
    correrDetectorFirma([a], REPO, { env: { VITEST: 'true' }, crudo: d.crudo });
    expect(d.pedidos).toHaveLength(2);
  });

  it('con el detector de verdad: un CSV con «Claude» frena las dos veces, y la segunda no corre python', () => {
    const c = caso();
    const a = c.doc('listado.csv', 'CODIGO;CREADO POR\n1;Claude\n');
    const t0 = performance.now();
    const r1 = correrDetectorFirma([a], REPO, { env: c.env });
    const t1 = performance.now();
    const r2 = correrDetectorFirma([a], REPO, { env: c.env });
    const t2 = performance.now();
    expect(r1.filter((h) => h.nivel === 'BLOQUEANTE').length).toBeGreaterThan(0);
    expect(r2).toEqual(r1);
    expect(t2 - t1).toBeLessThan((t1 - t0) / 2);
  }, 60_000);
});

// Auditor 12/10/2026: los casos que el primer juego no veia (mutantes vivos: clave sin fecha, version con solo el canon o
// sin fecha, version sin las opciones) y los dos falsos verdes medidos (archivo bloqueado en un cierre, python sin PyMuPDF).
describe('firma: lo guardado no tapa lo que hoy frenaria', () => {
  it('rojo: el mismo tamaño con otra fecha se vuelve a revisar', () => {
    const c = caso(); const d = detector();
    const a = c.doc('a.csv', 'AUTOR;Fulano');
    correrDetectorFirma([a], REPO, { env: c.env, crudo: d.crudo });
    const t = fs.statSync(a).mtime;
    fs.writeFileSync(a, 'AUTOR;Claude');
    fs.utimesSync(a, t, new Date(t.getTime() + 10_000));
    expect(correrDetectorFirma([a], REPO, { env: c.env, crudo: d.crudo })).toHaveLength(1);
    expect(d.pedidos).toHaveLength(2);
  });

  for (const f of ['_sinFirmaIA.py', '_lib/firmaIA.py']) {
    it(`rojo: si cambia ${f} (mismo tamaño, otra fecha) se revisa todo de nuevo`, () => {
      const c = caso(); const d = detector();
      const repo = path.join(c.dir, 'repo');
      fs.mkdirSync(path.join(repo, 'scripts', '_lib'), { recursive: true });
      for (const g of ['_sinFirmaIA.py', '_lib/firmaIA.py', '_lib/firmaIA.data.json']) fs.writeFileSync(path.join(repo, 'scripts', g), 'v1');
      const a = c.doc('a.csv', 'nada');
      correrDetectorFirma([a], repo, { env: c.env, crudo: d.crudo });
      const p = path.join(repo, 'scripts', f);
      const t = fs.statSync(p).mtime;
      fs.writeFileSync(p, 'v2');
      fs.utimesSync(p, t, new Date(t.getTime() + 10_000));
      correrDetectorFirma([a], repo, { env: c.env, crudo: d.crudo });
      expect(d.pedidos).toHaveLength(2);
    });
  }

  it('rojo: si cambian las opciones del detector (p. ej. --logo-bloquea) se revisa todo de nuevo', () => {
    const c = caso(); const d = detector();
    const a = c.doc('a.csv', 'nada');
    correrDetectorFirma([a], REPO, { env: c.env, crudo: d.crudo });
    correrDetectorFirma([a], REPO, { env: c.env, crudo: d.crudo, args: [...ARGS_DETECTOR, '--logo-bloquea'] });
    expect(d.pedidos).toHaveLength(2);
  });

  it('rojo: un documento que el detector no pudo mirar entero (ilegible, revision-parcial) no se guarda', () => {
    const c = caso();
    const a = c.doc('a.csv', 'x'); const b = c.doc('b.csv', 'y');
    let veces = 0;
    const crudo = (rutas) => { veces++; return veces === 1 ? [{ archivo: a, nivel: 'AVISO', regla: 'ilegible' }, { archivo: b, nivel: 'AVISO', regla: 'revision-parcial' }] : []; };
    expect(correrDetectorFirma([a, b], REPO, { env: c.env, crudo })).toEqual([]);   // el aviso no sale del cierre
    correrDetectorFirma([a, b], REPO, { env: c.env, crudo });
    expect(veces).toBe(2);
  });

  it.skipIf(process.platform !== 'win32')('con el detector de verdad: un CSV con «Claude» abierto por otro programa en un cierre frena en el siguiente', async () => {
    const c = caso();
    const f = c.doc('listado_bloqueado.csv', 'CODIGO;CREADO POR\n1;Claude\n');
    const ps = spawn('powershell', ['-NoProfile', '-Command',
      `$fs=[System.IO.File]::Open('${f}','Open','ReadWrite','None'); Write-Output 'LOCK'; Start-Sleep -Seconds 6; $fs.Close()`]);
    let s = ''; ps.stdout.on('data', (x) => { s += x; });
    const fin = new Promise((r) => ps.on('exit', r));
    while (!s.includes('LOCK')) await new Promise((r) => setTimeout(r, 100));
    correrDetectorFirma([f], REPO, { env: c.env });            // bloqueado: el detector no lo puede leer
    await fin;
    expect(correrDetectorFirma([f], REPO, { env: c.env }).filter((h) => h.nivel === 'BLOQUEANTE').length).toBeGreaterThan(0);
  }, 60_000);

  it('con el detector de verdad: un cierre con el python sin PyMuPDF no deja el PDF como limpio', () => {
    const c = caso();
    const pdf = path.join(c.dir, 'informe.pdf');
    execFileSync('python', ['-c', 'import sys, fitz; d = fitz.open(); d.new_page().insert_text((72, 72), "Hoja preparada por Claude"); d.save(sys.argv[1], deflate=True)', pdf]);
    expect(fs.readFileSync(pdf).includes('Claude')).toBe(false);   // el texto va comprimido: los bytes solos no lo ven
    const shim = path.join(c.dir, 'shim'); fs.mkdirSync(shim);
    fs.writeFileSync(path.join(shim, 'fitz.py'), 'raise ImportError("PyMuPDF roto")\n');
    const antes = process.env.PYTHONPATH;
    process.env.PYTHONPATH = shim;
    try { correrDetectorFirma([pdf], REPO, { env: c.env }); } finally { if (antes === undefined) delete process.env.PYTHONPATH; else process.env.PYTHONPATH = antes; }
    expect(correrDetectorFirma([pdf], REPO, { env: c.env }).filter((h) => h.nivel === 'BLOQUEANTE').length).toBeGreaterThan(0);
  }, 60_000);
});
