/**
 * Tests de scripts/_cierreSesion.mjs — el checklist de fin de sesion.
 *
 * Se ejercen las funciones puras: la evaluacion de cada paso y el veredicto.
 * Los relevadores (git real, npm run build, OneDrive) no se testean aca: lo que
 * importa fijar es la LOGICA de decision — cuando un paso bloquea, cuando avisa
 * y cuando no aplica — porque un checklist que decide mal es peor que ninguno.
 */
import { describe, it, expect } from 'vitest';
import {
    carpetaTemporal, leerEpochFlag, clasificarPorcelain,
    evaluarGit, evaluarBackup, evaluarLecciones, veredicto,
    LECCIONES_AVISO, LECCIONES_TOPE,
} from '../../scripts/_cierreSesion.mjs';

describe('carpetaTemporal', () => {
    it('prefiere TMPDIR, despues TEMP, despues TMP, y cae a /tmp', () => {
        expect(carpetaTemporal({ TMPDIR: 'a', TEMP: 'b', TMP: 'c' })).toBe('a');
        expect(carpetaTemporal({ TEMP: 'b', TMP: 'c' })).toBe('b');
        expect(carpetaTemporal({ TMP: 'c' })).toBe('c');
        expect(carpetaTemporal({})).toBe('/tmp');
    });
});

describe('leerEpochFlag', () => {
    it('lee el epoch de la primera linea (formato de _backup.mjs: epoch + ruta)', () => {
        expect(leerEpochFlag('1756500000\nC:\\ruta\\al\\backup\n')).toBe(1756500000);
        expect(leerEpochFlag('1756500000')).toBe(1756500000);
    });
    it('devuelve null ante basura, vacio o cero — un flag ilegible no es evidencia', () => {
        expect(leerEpochFlag('')).toBeNull();
        expect(leerEpochFlag('no-un-numero')).toBeNull();
        expect(leerEpochFlag('0')).toBeNull();
        expect(leerEpochFlag(null)).toBeNull();
    });
});

describe('clasificarPorcelain', () => {
    it('separa tracked de untracked y excluye scratchpad/deps/build/lock', () => {
        const salida = [
            ' M scripts/_cierreSesion.mjs',
            'A  docs/nuevo.md',
            '?? notas-sueltas.md',
            '?? scratchpad/tmp.md',
            ' M node_modules/x/index.js',
            ' M package-lock.json',
            '?? dist/index.html',
        ].join('\n');
        const r = clasificarPorcelain(salida);
        expect(r.versionados).toEqual(['scripts/_cierreSesion.mjs', 'docs/nuevo.md']);
        expect(r.sinVersionar).toEqual(['notas-sueltas.md']);
    });
    it('salida vacia = arbol limpio, no un error', () => {
        expect(clasificarPorcelain('')).toEqual({ versionados: [], sinVersionar: [] });
    });
});

describe('evaluarGit', () => {
    const base = { versionados: [], sinVersionar: [], sinPush: 0, sinUpstream: false, sinLlegarAMain: null, rama: 'main' };
    it('cambios versionados sin commitear BLOQUEAN', () => {
        const r = evaluarGit({ ...base, versionados: ['a.ts'] });
        expect(r.estado).toBe('falta');
        expect(r.detalle).toContain('a.ts');
    });
    it('commits sin pushear BLOQUEAN: Fak prueba en produccion, no en local', () => {
        expect(evaluarGit({ ...base, sinPush: 2 }).estado).toBe('falta');
    });
    it('rama sin upstream con commits que main no tiene BLOQUEA (hallazgo auditor 30/08)', () => {
        const r = evaluarGit({ ...base, sinUpstream: true, sinLlegarAMain: 1 });
        expect(r.estado).toBe('falta');
        expect(r.detalle).toContain('origin/main');
    });
    it('rama sin upstream pero con todo ya en main = ok', () => {
        expect(evaluarGit({ ...base, sinUpstream: true, sinLlegarAMain: 0 }).estado).toBe('ok');
    });
    it('rama sin upstream y sin poder comparar contra main solo avisa (no inventa un veredicto)', () => {
        expect(evaluarGit({ ...base, sinUpstream: true, sinLlegarAMain: null }).estado).toBe('aviso');
    });
    it('untracked sueltos avisan pero no bloquean: puede ser material a decidir', () => {
        expect(evaluarGit({ ...base, sinVersionar: ['x.md'] }).estado).toBe('aviso');
    });
    it('limpio y al dia = ok', () => {
        expect(evaluarGit(base).estado).toBe('ok');
    });
    it('lo versionado manda sobre el push: primero se commitea, despues se mide el push', () => {
        expect(evaluarGit({ ...base, versionados: ['a.ts'], sinPush: 3 }).estado).toBe('falta');
    });
});

describe('evaluarBackup', () => {
    it('sin escritura Supabase el paso no aplica', () => {
        expect(evaluarBackup({ escritura: null, backup: 1756500000 }).estado).toBe('no-aplica');
    });
    it('escritura sin ningun backup valido BLOQUEA', () => {
        expect(evaluarBackup({ escritura: 1756500000, backup: null }).estado).toBe('falta');
    });
    it('un backup ANTERIOR a la escritura no la cubre — la regla es temporal, no de calendario', () => {
        const r = evaluarBackup({ escritura: 1756500000, backup: 1756400000 });
        expect(r.estado).toBe('falta');
        expect(r.detalle).toContain('ANTERIOR');
    });
    it('backup posterior a la escritura = cubierta', () => {
        expect(evaluarBackup({ escritura: 1756500000, backup: 1756500001 }).estado).toBe('ok');
    });
});

describe('evaluarLecciones', () => {
    it('bajo el aviso de 26 KB = ok', () => {
        expect(evaluarLecciones(LECCIONES_AVISO - 1).estado).toBe('ok');
    });
    it('pasado el aviso BLOQUEA: al aviso se CONSOLIDA, no se sigue acumulando', () => {
        const r = evaluarLecciones(LECCIONES_AVISO + 1);
        expect(r.estado).toBe('falta');
        expect(r.detalle).toContain('CONSOLIDACION');
    });
    it('pasado el tope duro de 28 KB tambien bloquea, con mensaje propio', () => {
        expect(evaluarLecciones(LECCIONES_TOPE + 1).estado).toBe('falta');
        expect(evaluarLecciones(LECCIONES_TOPE + 1).detalle).toContain('tope');
    });
    it('archivo ilegible avisa en vez de mentir un ok', () => {
        expect(evaluarLecciones(null).estado).toBe('aviso');
    });
});

describe('veredicto', () => {
    it('cualquier "falta" hace fallar el cierre (exit 1)', () => {
        expect(veredicto([{ estado: 'ok' }, { estado: 'falta' }, { estado: 'aviso' }])).toBe(1);
    });
    it('avisos, manuales y no-aplica no bloquean (exit 0)', () => {
        expect(veredicto([{ estado: 'ok' }, { estado: 'aviso' }, { estado: 'manual' }, { estado: 'no-aplica' }])).toBe(0);
    });
    it('lista vacia no bloquea', () => {
        expect(veredicto([])).toBe(0);
    });
});
