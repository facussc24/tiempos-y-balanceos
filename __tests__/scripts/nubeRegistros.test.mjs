import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
    carpetasDeRegistros, subirRegistros, contarRegistros, leerSettings, avisoLimpieza, PATRON_REGISTROS, SUBCARPETA_REGISTROS,
} from '../../scripts/_lib/nubeRegistros.mjs';

let raiz;
beforeAll(() => {
    raiz = mkdtempSync(join(tmpdir(), 'nube-registros-'));
    for (const n of ['C--Dev-BarackMercosul', 'C--Dev-BarackMercosul-wt-cola', 'C--Users-Fak-otro', 'C--Users-Fak-AppData-Local-Temp-claude-x-scratchpad', 'C--Users-Fak-AppData-Local-Temp', 'C--Users-Fak-Documents-estudio', 'D--KIT-ESTUDIO-CLAUDE']) {
        mkdirSync(join(raiz, 'projects', n), { recursive: true });
    }
    writeFileSync(join(raiz, 'projects', 'C--Dev-BarackMercosul.txt'), 'mismo nombre pero no es carpeta');
    mkdirSync(join(raiz, 'vacia'));
});
afterAll(() => rmSync(raiz, { recursive: true, force: true }));

describe('carpetasDeRegistros', () => {
    it('verde: toma TODAS las carpetas (repo, worktree y charlas sin carpeta) con su ruta local', () => {
        const c = carpetasDeRegistros(join(raiz, 'projects'));
        expect(c.map((x) => x.nombre).sort()).toEqual(['C--Dev-BarackMercosul', 'C--Dev-BarackMercosul-wt-cola', 'C--Users-Fak-otro']);
        const principal = c.find((x) => x.nombre === 'C--Dev-BarackMercosul');
        expect(principal.local).toBe(join(raiz, 'projects', 'C--Dev-BarackMercosul'));
    });
    it('rojo: temporales, estudio y un archivo suelto quedan afuera', () => {
        const nombres = carpetasDeRegistros(join(raiz, 'projects')).map((x) => x.nombre);
        for (const n of ['C--Users-Fak-AppData-Local-Temp-claude-x-scratchpad', 'C--Users-Fak-AppData-Local-Temp', 'C--Users-Fak-Documents-estudio', 'D--KIT-ESTUDIO-CLAUDE']) expect(nombres).not.toContain(n);
        expect(nombres).not.toContain('C--Dev-BarackMercosul.txt');
    });
    it('rojo: projects ilegible da null (no una lista vacia); vacia de verdad da []', () => {
        expect(carpetasDeRegistros(join(raiz, 'no-existe'))).toBeNull();
        expect(carpetasDeRegistros(join(raiz, 'vacia'))).toEqual([]);
    });
});

describe('contarRegistros', () => {
    it('verde: cuenta solo los .jsonl de cada carpeta', () => {
        const leer = (d) => (d === 'a' ? ['1.jsonl', '2.JSONL', 'memory', 'x.txt'] : ['3.jsonl']);
        expect(contarRegistros([{ local: 'a' }, { local: 'b' }], leer)).toBe(3);
    });
    it('rojo: una carpeta ilegible cuenta 0 y no corta la cuenta; sin carpetas da 0', () => {
        const leer = (d) => { if (d === 'mala') throw new Error('EPERM'); return ['1.jsonl']; };
        expect(contarRegistros([{ local: 'mala' }, { local: 'b' }], leer)).toBe(1);
        expect(contarRegistros(null)).toBe(0);
    });
});

/** Robocopy de mentira: anota las llamadas y devuelve lo que se le diga por origen. */
function robocopyFalso(respuestas = {}) {
    const fn = (origen, destino, opts) => {
        fn.llamadas.push({ origen, destino, opts });
        return respuestas[origen] || { archivos: 1, err: null };
    };
    fn.llamadas = [];
    return fn;
}

describe('subirRegistros', () => {
    const base = tmpdir();
    const nube = join(base, 'Claude Fak');
    const carpetas = [
        { nombre: 'C--Dev-BarackMercosul', local: join(base, 'projects', 'C--Dev-BarackMercosul') },
        { nombre: 'C--Dev-BarackMercosul-wt', local: join(base, 'projects', 'C--Dev-BarackMercosul-wt') },
    ];
    it('verde: una pierna PC -> nube por carpeta, solo *.jsonl, sin espejo; dry-run sin mkdir', () => {
        const rc = robocopyFalso();
        const creadas = [];
        const r = subirRegistros({ carpetas, nube, robocopy: rc, aplicar: false, mkdir: (p) => creadas.push(p) });
        expect(rc.llamadas).toHaveLength(2);
        rc.llamadas.forEach((l, i) => {
            expect(l.origen).toBe(carpetas[i].local);
            expect(l.destino).toBe(join(nube, SUBCARPETA_REGISTROS, carpetas[i].nombre));
            expect(l.opts).toEqual({ direccion: 'intercambiar', listar: true, soloArchivo: PATRON_REGISTROS });
        });
        expect(creadas).toEqual([]);
        expect(r).toMatchObject({ archivos: 2, fallos: 0 });
    });
    it('rojo: nunca baja a la PC ni usa espejo; con --aplicar crea el destino y copia de verdad', () => {
        const rc = robocopyFalso();
        const creadas = [];
        subirRegistros({ carpetas, nube, robocopy: rc, aplicar: true, mkdir: (p) => creadas.push(p) });
        for (const l of rc.llamadas) {
            expect(l.destino.startsWith(join(base, 'projects'))).toBe(false);
            expect(l.opts.direccion).not.toBe('subir');
            expect(l.opts.listar).toBe(false);
        }
        expect(creadas).toEqual(carpetas.map((c) => join(nube, SUBCARPETA_REGISTROS, c.nombre)));
    });
    it('rojo: un robocopy que falla cuenta como fallo y queda en su linea, no se traga', () => {
        const rc = robocopyFalso({ [carpetas[1].local]: { archivos: 0, err: 'ERROR 32 archivo en uso' } });
        const r = subirRegistros({ carpetas, nube, robocopy: rc, aplicar: false, mkdir: () => {} });
        expect(r.fallos).toBe(1);
        expect(r.resultados[0].err).toBeNull();
        expect(r.resultados[1].err).toMatch(/ERROR 32/);
    });
});

describe('avisoLimpieza / leerSettings', () => {
    it('verde: 90 o mas no avisa', () => {
        expect(avisoLimpieza({ cleanupPeriodDays: 90 })).toBeNull();
        expect(avisoLimpieza({ cleanupPeriodDays: 365, otraClave: true })).toBeNull();
    });
    it('rojo: falta, es menor, no es numero o no se pudo leer -> aviso que nombra 30 y 90', () => {
        expect(avisoLimpieza({})).toMatch(/30 dias.*90/);
        expect(avisoLimpieza({ cleanupPeriodDays: 30 })).toMatch(/30.*90/);
        expect(avisoLimpieza({ cleanupPeriodDays: '90' })).toMatch(/"90".*90 o mas/);
        expect(avisoLimpieza({ cleanupPeriodDays: NaN })).toMatch(/90 o mas/);
        expect(avisoLimpieza(null)).toMatch(/no pude leer/);
    });
    it('leerSettings: JSON valido se lee; roto o inexistente da null', () => {
        const ok = join(raiz, 'settings.json');
        writeFileSync(ok, '{"cleanupPeriodDays": 90}');
        expect(leerSettings(ok)).toEqual({ cleanupPeriodDays: 90 });
        const roto = join(raiz, 'roto.json');
        writeFileSync(roto, '{"cleanupPeriodDays": ');
        expect(leerSettings(roto)).toBeNull();
        expect(leerSettings(join(raiz, 'nada.json'))).toBeNull();
    });
});
