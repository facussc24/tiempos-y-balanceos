/**
 * Tests de `scripts/_lib/nubeSincronizar.mjs` — la logica de `_nube.mjs --sincronizar` (08/10/2026):
 * dos PC de Fak sobre la misma copia de la nube. "Gana el mas nuevo, nada se borra, lo que se pisa
 * se guarda antes".
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    recorrer, planDeIntercambio, resguardarConflictos, estadoConSync, ultimoSyncDe, lineaPlan, selloFecha, TOLERANCIA_MS,
} from '../../scripts/_lib/nubeSincronizar.mjs';

const f = (mtimeMs, size = 10) => ({ mtimeMs, size });
const T0 = Date.parse('2026-10-08T10:00:00Z');
const H = 3600_000;

describe('planDeIntercambio — que baja, que sube, que es conflicto', () => {
    it('lo que solo esta en una punta viaja a la otra; nunca se borra nada', () => {
        const local = new Map([['solo_local.md', f(T0)]]);
        const nube = new Map([['solo_nube.md', f(T0)]]);
        const p = planDeIntercambio({ local, nube, ultimoSync: 0 });
        expect(p.suben).toEqual(['solo_local.md']);
        expect(p.bajan).toEqual(['solo_nube.md']);
        expect(p.conflictos).toEqual([]);
    });

    it('gana el mas nuevo por archivo, en las dos direcciones', () => {
        const local = new Map([['a.md', f(T0 + H)], ['b.md', f(T0)]]);
        const nube = new Map([['a.md', f(T0)], ['b.md', f(T0 + H)]]);
        const p = planDeIntercambio({ local, nube, ultimoSync: T0 + 2 * H });
        expect(p.suben).toEqual(['a.md']);
        expect(p.bajan).toEqual(['b.md']);
        expect(p.conflictos).toEqual([]);   // b local no se edito despues del ultimo sync
    });

    it('CONFLICTO: la nube es mas nueva Y esta PC edito el archivo despues de su ultimo sync', () => {
        // Sync a las 10:00. A las 11:00 esta PC edito la memoria; a las 12:00 la otra PC tambien.
        const local = new Map([['memoria.md', f(T0 + H)]]);
        const nube = new Map([['memoria.md', f(T0 + 2 * H)]]);
        const p = planDeIntercambio({ local, nube, ultimoSync: T0 });
        expect(p.bajan).toEqual(['memoria.md']);
        expect(p.conflictos).toEqual(['memoria.md']);
    });

    it('NO es conflicto si lo local es viejo (anterior al ultimo sync): es la bajada normal', () => {
        const local = new Map([['memoria.md', f(T0 - H)]]);
        const nube = new Map([['memoria.md', f(T0 + H)]]);
        const p = planDeIntercambio({ local, nube, ultimoSync: T0 });
        expect(p.bajan).toEqual(['memoria.md']);
        expect(p.conflictos).toEqual([]);
    });

    it('sin ultimo sync conocido (primera vez), toda bajada que pisa algo local se resguarda: mejor de mas que de menos', () => {
        const local = new Map([['x.md', f(T0)]]);
        const nube = new Map([['x.md', f(T0 + H)]]);
        const p = planDeIntercambio({ local, nube, ultimoSync: 0 });
        expect(p.conflictos).toEqual(['x.md']);
    });

    it('dos relojes que difieren en menos de la tolerancia son el mismo archivo', () => {
        const local = new Map([['igual.md', f(T0)]]);
        const nube = new Map([['igual.md', f(T0 + TOLERANCIA_MS - 1)]]);
        const p = planDeIntercambio({ local, nube, ultimoSync: 0 });
        expect(p.iguales).toBe(1);
        expect(p.bajan).toEqual([]);
        expect(p.suben).toEqual([]);
    });

    it('las listas salen ordenadas por ruta (salida estable para el log)', () => {
        const local = new Map([['z.md', f(T0)], ['a.md', f(T0)]]);
        const p = planDeIntercambio({ local, nube: new Map(), ultimoSync: 0 });
        expect(p.suben).toEqual(['a.md', 'z.md']);
    });
});

describe('recorrer y resguardarConflictos — sobre carpetas temporales', () => {
    let tmp;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nube-sync-')); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    const escribir = (base, rel, texto) => {
        const p = path.join(base, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, texto);
        return p;
    };

    it('recorrer lista archivos con ruta relativa con /, saltea node_modules, __pycache__ y .git', () => {
        const dir = path.join(tmp, 'local');
        escribir(dir, 'a.md', 'a');
        escribir(dir, 'sub/b.md', 'b');
        escribir(dir, 'node_modules/x.js', 'x');
        escribir(dir, '__pycache__/y.pyc', 'y');
        escribir(dir, '.git/HEAD', 'ref');
        const m = recorrer(dir);
        expect([...m.keys()].sort()).toEqual(['a.md', 'sub/b.md']);
        expect(m.get('a.md').size).toBe(1);
        expect(recorrer(path.join(tmp, 'no-existe')).size).toBe(0);
    });

    it('resguardarConflictos copia la version LOCAL a <nube>/_conflictos/<pc>/<sello>/<pieza>/<rel> y no toca el original', () => {
        const local = path.join(tmp, 'local'); const nube = path.join(tmp, 'nube');
        escribir(local, 'memoria/feedback_x.md', 'MI VERSION');
        escribir(nube, 'claude-memoria/feedback_x.md', 'LA DE LA OTRA PC');
        const r = resguardarConflictos({ localDir: path.join(local, 'memoria'), nubeRaiz: nube, pieza: 'memoria', conflictos: ['feedback_x.md'], pc: 'CATA', sello: '2026-10-08_2300' });
        expect(r.fallos).toEqual([]);
        expect(r.guardados).toHaveLength(1);
        const esperado = path.join(nube, '_conflictos', 'CATA', '2026-10-08_2300', 'memoria', 'feedback_x.md');
        expect(fs.readFileSync(esperado, 'utf8')).toBe('MI VERSION');
        expect(fs.readFileSync(path.join(local, 'memoria', 'feedback_x.md'), 'utf8')).toBe('MI VERSION');
        expect(fs.readFileSync(path.join(nube, 'claude-memoria', 'feedback_x.md'), 'utf8')).toBe('LA DE LA OTRA PC');
    });

    it('sin conflictos no crea ninguna carpeta; un archivo que no se puede copiar se anota y no frena a los demas', () => {
        const nube = path.join(tmp, 'nube'); fs.mkdirSync(nube);
        expect(resguardarConflictos({ localDir: tmp, nubeRaiz: nube, pieza: 'p', conflictos: [], pc: 'X' })).toEqual({ guardados: [], fallos: [], carpeta: null });
        expect(fs.existsSync(path.join(nube, '_conflictos'))).toBe(false);
        const local = path.join(tmp, 'local'); escribir(local, 'ok.md', 'ok');
        const r = resguardarConflictos({ localDir: local, nubeRaiz: nube, pieza: 'p', conflictos: ['no-existe.md', 'ok.md'], pc: 'X', sello: 's' });
        expect(r.guardados).toHaveLength(1);
        expect(r.fallos).toHaveLength(1);
        expect(r.fallos[0]).toMatch(/no-existe\.md/);
    });
});

describe('_ESTADO.json por PC', () => {
    it('estadoConSync agrega la PC sin pisar lo que ya habia ni a la otra PC', () => {
        const previo = { fecha: '2026-10-08 09:00', pc: 'DESKTOP-14JG95B', commitRepo: 'abc', por_pc: { CATA: { ultimoSync: '2026-10-08T08:00:00.000Z' } } };
        const e = estadoConSync(previo, { pc: 'DESKTOP-14JG95B', ahora: new Date(T0), archivos: 3, conflictos: 1, commitRepo: 'def' });
        expect(e.fecha).toBe('2026-10-08 09:00');
        expect(e.por_pc.CATA.ultimoSync).toBe('2026-10-08T08:00:00.000Z');
        expect(e.por_pc['DESKTOP-14JG95B']).toEqual({ ultimoSync: new Date(T0).toISOString(), modo: 'sincronizar', archivos: 3, conflictos: 1, commitRepo: 'def' });
        expect(estadoConSync(null, { pc: 'X', ahora: new Date(T0) }).por_pc.X.modo).toBe('sincronizar');
    });

    it('ultimoSyncDe devuelve 0 cuando no hay dato o esta mal escrito', () => {
        expect(ultimoSyncDe(null, 'X')).toBe(0);
        expect(ultimoSyncDe({ por_pc: { X: { ultimoSync: 'ayer' } } }, 'X')).toBe(0);
        expect(ultimoSyncDe({ por_pc: { X: { ultimoSync: new Date(T0).toISOString() } } }, 'X')).toBe(T0);
    });

    it('lineaPlan y selloFecha', () => {
        expect(lineaPlan('memoria', { bajan: ['a'], suben: [], conflictos: ['a'] })).toMatch(/bajan 1 · CONFLICTOS 1/);
        expect(lineaPlan('reglas', { bajan: [], suben: [], conflictos: [] })).toMatch(/al dia/);
        expect(selloFecha(new Date(2026, 9, 8, 23, 5))).toBe('2026-10-08_2305');
    });
});
