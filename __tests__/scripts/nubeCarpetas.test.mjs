/**
 * Canon de carpetas de la nube (mudanza del 17/10/2026, encargo E261017-012b): `scripts/_lib/nubeCarpetas.data.json`.
 *
 * Una sola regla para encontrar cada carpeta del asistente en la biblioteca de Ingenieria: la ruta NUEVA (adentro de
 * «ASISTENTE INGENIERIA») si existe; si no, la primera VIEJA que exista; si no hay ninguna, la nueva. Aca se prueba,
 * con una biblioteca de mentira en una carpeta temporal y en las dos direcciones (layout viejo -> la vieja, layout nuevo
 * -> la nueva, las dos -> gana la nueva):
 *   - la funcion de Node (`resolverCarpeta`, `carpetaNube`, `buscarNube`) y su gemela de Python (`nube_carpetas.py`);
 *   - cada programa que toque en esta tanda: el aviso de pedidos, `_mails.py`, `puerta.py`, los tres publicadores y el
 *     hook cerebro-guard (su lista embebida contra el canon; sus casos de punta a punta viven en cerebro-guard.test.sh);
 *   - `_nubeMudar.mjs`: el plan, y mover-y-verificar en verde y en rojo (un archivo que se pierde, uno sin subir, un
 *     destino que ya existe) sin tocar la nube.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readFileSync, renameSync, unlinkSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
    CANON_CARPETAS, CARPETA_UNICA, resolverCarpeta, carpetaNube, buscarNube, entradaCarpeta, ORGANIZACION,
} from '../../scripts/_lib/nubeRutas.mjs';
import { planMudanza, moverYVerificar, contar, comparar, largoSharePoint, escribirLeemes } from '../../scripts/_nubeMudar.mjs';
import { plan as planInstalar } from '../../tools/instalar_mi_pc/publicar.mjs';
import { plan as planMailsPc } from '../../tools/claude-area/mails_pc/publicar.mjs';
import { carpetaDe } from '../../tools/claude-area/mejoras/publicar.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TMP = mkdtempSync(join(tmpdir(), 'nube-carpetas-'));
afterAll(() => { try { rmSync(TMP, { recursive: true, force: true }); } catch { /* temporal */ } });

let n = 0;
/** Un HOME de mentira con su biblioteca; devuelve { home, bib }. */
function casa() {
    const home = join(TMP, `casa${n++}`);
    const bib = join(home, ORGANIZACION, 'Ingeniería y Proyecto - General');
    mkdirSync(join(bib, 'INGENIERIA BARACK (NUNCA BORRAR)'), { recursive: true });
    return { home, bib };
}
const crear = (...p) => { mkdirSync(join(...p), { recursive: true }); return join(...p); };
const vieja0 = (clave) => entradaCarpeta(clave).viejas[0];
const nueva = (clave) => entradaCarpeta(clave).nueva;
const python = (args, env = {}) => spawnSync('python', args, { encoding: 'utf8', env: { ...process.env, ...env } });

describe('el canon', () => {
    it('cada carpeta va adentro de la carpeta unica, y ningun nombre NUEVO lleva la palabra Claude', () => {
        expect(CARPETA_UNICA).toBe('ASISTENTE INGENIERIA');
        for (const c of CANON_CARPETAS.carpetas) {
            expect(c.nueva[0], c.clave).toBe(CARPETA_UNICA);
            // un tramo con la palabra solo vale si es el nombre VIEJO de esa carpeta, conservado adentro de 9- VIEJO
            const viejosUltimos = c.viejas.map((t) => t[t.length - 1]);
            for (const t of c.nueva) if (/claude/i.test(t)) expect(viejosUltimos, `${c.clave}: ${t}`).toContain(t);
            if (c.nueva.some((t) => /claude/i.test(t))) expect(c.nueva[1], c.clave).toBe('9- VIEJO (no usar)');
        }
    });
    it('las claves son unicas, y las partes de adentro (buzon, mails) van antes que su carpeta de afuera', () => {
        const claves = CANON_CARPETAS.carpetas.map((c) => c.clave);
        expect(new Set(claves).size).toBe(claves.length);
        const i = (k) => claves.indexOf(k);
        expect(i('buzon')).toBeLessThan(i('area_vieja'));
        expect(i('mails')).toBeLessThan(i('barack_vieja'));
    });
});

describe('resolverCarpeta (Node) y resolver_carpeta (Python): nueva si existe, si no la vieja', () => {
    for (const c of CANON_CARPETAS.carpetas) {
        it(`${c.clave}: vieja sola -> vieja · nueva sola -> nueva · las dos -> nueva · ninguna -> nueva`, () => {
            const casos = [
                ['vieja', [c.viejas[0]], join(...c.viejas[0])],
                ['nueva', [c.nueva], join(...c.nueva)],
                ['nueva', [c.viejas[0], c.nueva], join(...c.nueva)],
                ['ninguna', [], join(...c.nueva)],
            ];
            for (const [cual, crearTramos, esperada] of casos) {
                const { bib } = casa();
                for (const t of crearTramos) crear(bib, ...t);
                const r = resolverCarpeta(c.clave, bib);
                expect([r.cual, r.ruta], `${c.clave} ${cual}`).toEqual([cual, join(bib, esperada)]);
                const py = python([join(RAIZ, 'scripts', '_lib', 'nube_carpetas.py'), c.clave, bib]);
                expect(py.status, py.stderr).toBe(0);
                expect(JSON.parse(py.stdout), `python ${c.clave} ${cual}`).toEqual({ ruta: join(bib, esperada), cual });
            }
        });
    }
    it('una segunda vieja (el nombre de antes de la cuarentena) tambien se encuentra', () => {
        const { bib } = casa();
        const v2 = entradaCarpeta('mails').viejas[1];
        crear(bib, ...v2);
        expect(resolverCarpeta('mails', bib)).toMatchObject({ cual: 'vieja', ruta: join(bib, ...v2) });
    });
    it('carpetaNube y buscarNube (la memoria) por el HOME, en las dos direcciones', () => {
        const a = casa(); crear(a.bib, ...vieja0('facundo'));
        expect(buscarNube(a.home, {})).toBe(join(a.bib, ...vieja0('facundo')));
        const b = casa(); crear(b.bib, ...nueva('facundo')); crear(b.bib, ...vieja0('facundo'));
        expect(buscarNube(b.home, {})).toBe(join(b.bib, ...nueva('facundo')));
        expect(carpetaNube('pedidos', b.home)).toBe(join(b.bib, ...nueva('pedidos')));   // ninguna -> la nueva
    });
});

describe('cada programa, en las dos direcciones', () => {
    it('aviso de pedidos (hook pedidos-pendientes): lee la carpeta vieja y la nueva', () => {
        const pedido = 'PEDIDO 90 - probar la mudanza - 17-10-2026.txt';
        const cuerpo = 'PARA: PC principal\nDE: notebook 17/10/2026 20:00\n\nQUE HACER: nada\n';
        for (const lugar of ['vieja', 'nueva']) {
            const { home, bib } = casa();
            const dir = crear(bib, ...(lugar === 'vieja' ? vieja0('pedidos') : nueva('pedidos')));
            writeFileSync(join(dir, pedido), cuerpo, 'utf8');
            const r = spawnSync(process.execPath, [join(RAIZ, 'scripts', '_lib', 'pedidosPendientes.mjs'), '--hook'], {
                input: '{}', encoding: 'utf8',
                env: { ...process.env, USERPROFILE: home, HOME: home, BARACK_PC: 'principal', COMPUTERNAME: 'DESKTOP-14JG95B', BARACK_FACUNDO: '' },
            });
            expect(r.stdout, lugar).toMatch(/PEDIDO 90 - probar la mudanza/);
        }
    });
    it('_mails.py: la carpeta de mails del equipo, nueva primero y la vieja como respaldo', () => {
        const prog = `import sys, importlib.util; sys.argv=['x']; spec=importlib.util.spec_from_file_location('m', r'${join(RAIZ, 'scripts', '_mails.py')}'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m); import json; print(json.dumps(m._carpetas_equipo()))`;
        for (const lugar of ['vieja', 'nueva', 'las2']) {
            const { home, bib } = casa();
            if (lugar !== 'nueva') crear(bib, ...vieja0('mails'), '_entrada');
            if (lugar !== 'vieja') crear(bib, ...nueva('mails'), '_entrada');
            // sin BARACK_MAIL_EQUIPO en el entorno (con esa variable el programa no busca: usa la que le dan)
            const env = Object.fromEntries(Object.entries({ ...process.env, USERPROFILE: home, HOME: home }).filter(([k]) => k !== 'BARACK_MAIL_EQUIPO'));
            const r2 = spawnSync('python', ['-c', prog], { encoding: 'utf8', env });
            expect(r2.status, r2.stderr).toBe(0);
            const out = JSON.parse(r2.stdout.trim().split('\n').pop());
            const esperada = lugar === 'vieja' ? join(bib, ...vieja0('mails')) : join(bib, ...nueva('mails'));
            expect(out[0], lugar).toBe(esperada);
        }
    });
    it('puerta.py: el respaldo de la memoria, en la vieja y en la nueva', () => {
        const prog = `import sys, importlib.util; sys.argv=['x']; spec=importlib.util.spec_from_file_location('p', r'${join(RAIZ, 'tools', 'claude-area', 'puerta.py')}'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m); print(m.RESPALDO)`;
        for (const lugar of ['vieja', 'nueva']) {
            const { home, bib } = casa();
            crear(bib, ...(lugar === 'vieja' ? vieja0('facundo') : nueva('facundo')));
            const r = python(['-c', prog], { USERPROFILE: home, HOME: home });
            expect(r.status, r.stderr).toBe(0);
            expect(r.stdout.trim(), lugar).toBe(join(bib, ...(lugar === 'vieja' ? vieja0('facundo') : nueva('facundo')), 'repo-privado'));
        }
    });
    it('los tres publicadores publican donde esta la carpeta (vieja o nueva) y, sin ninguna, en la nueva', () => {
        for (const lugar of ['vieja', 'nueva', 'ninguna']) {
            const { bib } = casa();
            if (lugar !== 'ninguna') {
                crear(bib, ...(lugar === 'vieja' ? vieja0('instalar') : nueva('instalar')));
                crear(bib, ...(lugar === 'vieja' ? vieja0('equipo') : nueva('equipo')));
            }
            const base = join(bib, ...(lugar === 'vieja' ? vieja0('instalar') : nueva('instalar')));
            expect(planInstalar(bib).every((p) => p.destino.startsWith(base + '\\') || p.destino.startsWith(base + '/')), lugar).toBe(true);
            expect(planMailsPc(bib).every((p) => p.destino.startsWith(join(base, '2- Mails de Calidad'))), lugar).toBe(true);
            expect(carpetaDe(bib, { nombre: 'Carlos Baptista' }), lugar).toBe(join(bib, ...(lugar === 'vieja' ? vieja0('equipo') : nueva('equipo')), 'Carlos Baptista'));
        }
    });
    it('hook cerebro-guard: sus dos nombres son los del canon, en ese orden (los casos de punta a punta, en su .test.sh)', () => {
        const sh = readFileSync(join(RAIZ, '.claude', 'hooks', 'cerebro-guard.sh'), 'utf8');
        const leer = (v) => (sh.match(new RegExp(`^${v}="([^"]*)"$`, 'm')) || [])[1];
        expect(leer('NUBE_FACUNDO_NUEVA')).toBe(nueva('facundo').join('/'));
        expect(leer('NUBE_FACUNDO_VIEJA')).toBe(vieja0('facundo').join('/'));
        const t = spawnSync('bash', [join(RAIZ, '.claude', 'hooks', 'cerebro-guard.test.sh')], { encoding: 'utf8' });
        expect(t.status, t.stdout + t.stderr).toBe(0);
    }, 120000);   // corre un .sh de 17 casos: con la PC cargada pasa de los 5 s de vitest
});

describe('detector de firma (firmaIA.data.json): la carpeta nueva de la memoria exenta SOLO en la biblioteca', () => {
    const casos = [
        [true, 'C:\\Users\\x\\BARACK ARGENTINA SRL\\Ingeniería y Proyecto - General\\ASISTENTE INGENIERIA\\5- FACUNDO (memoria y configuracion)\\claude-memoria\\a.md'],
        [true, 'C:\\Users\\x\\BARACK ARGENTINA SRL\\Ingenieria y Proyecto - General\\ASISTENTE INGENIERIA\\5- FACUNDO (memoria y configuracion)\\LEEME.txt'],
        [false, 'Y:\\BARACK\\ASISTENTE INGENIERIA\\5- FACUNDO (memoria y configuracion)\\x.docx'],
        [false, 'C:\\Users\\x\\Desktop\\ASISTENTE INGENIERIA\\5- FACUNDO (memoria y configuracion)\\x.docx'],
        [false, 'C:\\Users\\x\\BARACK ARGENTINA SRL\\Ingeniería y Proyecto - General\\ASISTENTE INGENIERIA\\1- INSTALAR (doble clic)\\x.docx'],
    ];
    it('Node (rutaExcluida) y Python (ruta_excluida), en las dos direcciones', async () => {
        const { rutaExcluida } = await import('../../scripts/_lib/firmaIA.mjs');
        for (const [esperado, ruta] of casos) expect(rutaExcluida(ruta), ruta).toBe(esperado);
        const prog = `import sys, json; sys.path.insert(0, r'${join(RAIZ, 'scripts', '_lib')}'); import firmaIA; print(json.dumps([firmaIA.ruta_excluida(r) for r in json.loads(sys.argv[1])]))`;
        const r = python(['-c', prog, JSON.stringify(casos.map((c) => c[1]))]);
        expect(r.status, r.stderr).toBe(0);
        expect(JSON.parse(r.stdout)).toEqual(casos.map((c) => c[0]));
    });
});

describe('_nubeMudar.mjs (sin tocar la nube)', () => {
    /** Una biblioteca con el layout VIEJO completo y unos archivos adentro. */
    function bibVieja() {
        const { bib } = casa();
        for (const c of CANON_CARPETAS.carpetas) {
            const d = crear(bib, ...c.viejas[0]);
            writeFileSync(join(d, `${c.clave}.txt`), `contenido de ${c.clave}`);
        }
        return bib;
    }
    it('el plan: todo «mover» con el layout viejo; despues de mover todo, nada', () => {
        const bib = bibVieja();
        const p = planMudanza(bib);
        expect(p.map((f) => f.estado)).toEqual(CANON_CARPETAS.carpetas.map(() => 'mover'));
        for (const f of p) {
            const r = moverYVerificar(f);
            expect(r.ok, `${f.clave}: ${r.motivo}`).toBe(true);
            expect(r.antes).toEqual(r.despues);
        }
        expect(planMudanza(bib).map((f) => f.estado)).toEqual(CANON_CARPETAS.carpetas.map(() => 'ya_movida'));
        // la raiz queda sin ninguna carpeta vieja: solo la carpeta unica (y la de Ingenieria)
        expect(readdirSync(bib).sort()).toEqual(['ASISTENTE INGENIERIA', 'INGENIERIA BARACK (NUNCA BORRAR)']);
        // el buzon se movio aparte y no quedo adentro del area vieja
        expect(existsSync(join(bib, ...nueva('area_vieja'), '4- BUZON'))).toBe(false);
        expect(existsSync(join(bib, ...nueva('buzon'), 'buzon.txt'))).toBe(true);
    });
    it('ROJO: si al mover se pierde un archivo, para y lo nombra', () => {
        const bib = bibVieja();
        const f = planMudanza(bib).find((x) => x.clave === 'facundo');
        const renombrarQuePierde = (a, b) => { renameSync(a, b); unlinkSync(join(b, 'facundo.txt')); };
        const r = moverYVerificar(f, { renombrar: renombrarQuePierde });
        expect(r.ok).toBe(false);
        expect(r.motivo).toMatch(/no coincide/);
        expect(r.diferencias.faltan).toEqual(['facundo.txt']);
    });
    it('ROJO: con algo sin subir no mueve; con el destino ya creado tampoco; las dos a la vez frenan en el plan', () => {
        const bib = bibVieja();
        const f = planMudanza(bib).find((x) => x.clave === 'equipo');
        expect(moverYVerificar(f, { sinSubirAhora: () => 3 })).toMatchObject({ ok: false, motivo: expect.stringMatching(/3 archivo\(s\) sin subir/) });
        expect(moverYVerificar(f, { sinSubirAhora: () => null })).toMatchObject({ ok: false, motivo: expect.stringMatching(/no se pudo medir/) });
        expect(existsSync(f.origen)).toBe(true);
        crear(f.destino);
        expect(planMudanza(bib).find((x) => x.clave === 'equipo').estado).toBe('las_dos');
        expect(moverYVerificar(f)).toMatchObject({ ok: false, motivo: expect.stringMatching(/ya existe/) });
    });
    it('los LEEME: crea los que faltan, al que ya existe le agrega los cinco renglones ARRIBA sin perder nada, y no repite', () => {
        const bib = bibVieja();
        for (const f of planMudanza(bib)) expect(moverYVerificar(f).ok).toBe(true);
        const orden = JSON.parse(readFileSync(join(RAIZ, 'scripts', '_lib', 'nubeOrden.data.json'), 'utf8'));
        const d5 = orden.destinos.find((d) => d.id === '5');
        const leeme5 = join(bib, CARPETA_UNICA, d5.nombre, 'LEEME.txt');
        writeFileSync(leeme5, 'INSTRUCCIONES VIEJAS\r\nrenglon 2\r\n', 'utf8');
        const r = escribirLeemes(bib, orden);
        expect(r).toHaveLength(orden.destinos.length + 1);
        expect(r.filter((x) => x.accion === 'creado')).toHaveLength(orden.destinos.length);
        expect(r.find((x) => x.ruta === leeme5).accion).toBe('agregado arriba');
        const t = readFileSync(leeme5, 'utf8');
        expect(t.startsWith(d5.leeme[0])).toBe(true);
        expect(t).toContain('INSTRUCCIONES VIEJAS\r\nrenglon 2');
        expect(escribirLeemes(bib, orden).every((x) => x.accion === 'ya estaba')).toBe(true);
        const raiz = readFileSync(join(bib, CARPETA_UNICA, 'LEEME.txt'), 'utf8').split('\r\n').filter(Boolean);
        expect(raiz).toHaveLength(5);
        expect(raiz[0]).toMatch(/^ASISTENTE INGENIERIA: /);
    });
    it('contar no cuenta los archivos de sistema de OneDrive; comparar ve tamaños distintos; el largo en SharePoint suma el prefijo', () => {
        const { bib } = casa();
        const d = crear(bib, 'x', 'y');
        writeFileSync(join(d, 'a.txt'), '12345');
        writeFileSync(join(d, 'desktop.ini'), 'x');
        const c1 = contar(join(bib, 'x'));
        expect([c1.archivos, c1.carpetas, c1.bytes]).toEqual([1, 1, 5]);
        writeFileSync(join(d, 'a.txt'), '123');
        expect(comparar(c1, contar(join(bib, 'x'))).cambian).toEqual([join('y', 'a.txt')]);
        expect(largoSharePoint('ASISTENTE INGENIERIA\\5- X', 'a\\b.txt')).toBe((CANON_CARPETAS.sharepoint_prefijo + 'ASISTENTE INGENIERIA/5- X/a/b.txt').length);
    });
});
