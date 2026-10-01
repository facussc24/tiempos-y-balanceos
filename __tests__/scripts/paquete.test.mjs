/**
 * Tests de `scripts/_paquete.mjs` — la base de Claude que Fak publica en la nube para el equipo de
 * Ingenieria y que cada compañero actualiza (diseño del 30/09/2026).
 *
 * Lo que protege este archivo es lo que le prometimos a Fak:
 *  - la actualizacion NUNCA borra y NUNCA pisa lo que el compañero cambio o agrego: la version nueva
 *    queda al lado como `.fak-nueva` y se anota en `.claude/paquete-pendientes.md`;
 *  - una publicacion a medias (OneDrive todavia bajando) no toca nada, en ninguna de sus formas;
 *  - lo que llega de la nube se lee como DATO: rutas que se salen, hooks y configuracion se rechazan;
 *  - `--publicar` se niega a subir datos personales, claves o rutas de memoria/cache, y escribe
 *    VERSION.json AL FINAL;
 *  - los aportes de los compañeros van a `aportes\<autor>\`, nunca a `contenido\`, pasan por el mismo
 *    filtro de secretos y no pisan un aporte anterior.
 *
 * Todo corre en carpetas temporales: no toca la nube real ni ninguna PC. Los controles se prueban
 * en las dos direcciones (un control que no puede dar rojo esta tan roto como el que no da verde).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as P from '../../scripts/_paquete.mjs';

// Cada caso arma carpetas y hasheaba archivos de verdad (y la linea de comandos lanza `node`): con la
// PC ocupada (otras sesiones, antivirus) 15 s no alcanzan y el rojo seria de la carga, no del codigo.
vi.setConfig({ testTimeout: 120000, hookTimeout: 120000 });

const RAIZ = path.resolve(fileURLToPath(import.meta.url), '../../..');
const SCRIPT = path.join(RAIZ, 'scripts', '_paquete.mjs');
const BARRA = String.fromCharCode(92);

// ---------------------------------------------------------------------------------------------
// Ayudas
// ---------------------------------------------------------------------------------------------

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'paquete-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

const NOIDENT = { usuario: '', pc: '' };
const F = (dia = 1, hora = 10) => new Date(2026, 9, dia, hora, 0, 0);
const dir = (...partes) => { const p = path.join(tmp, ...partes); fs.mkdirSync(p, { recursive: true }); return p; };
const esc = (base, rel, texto) => { const p = path.join(base, ...rel.split('/')); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, texto); return p; };
const leer = (base, rel) => fs.readFileSync(path.join(base, ...rel.split('/')), 'utf8');
const existe = (base, rel) => fs.existsSync(path.join(base, ...rel.split('/')));

/** { ruta relativa: sha256 } de todo lo que hay debajo de `base`. */
function foto(base) {
    const out = {};
    const rec = (d, r) => {
        if (!fs.existsSync(d)) return;
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const rel = r ? `${r}/${e.name}` : e.name;
            if (e.isDirectory()) rec(path.join(d, e.name), rel); else out[rel] = P.sha256Archivo(path.join(d, e.name));
        }
    };
    rec(base, '');
    return out;
}

const V1 = {
    '.claude/skills/docs-x/SKILL.md': '---\nname: docs-x\ndescription: "Mapa de documentos"\n---\n\n# docs-x\n',
    '.claude/skills/docs-x/ref/a.md': 'referencia a\n',
    '.claude/rules/regla.md': '# regla uno\n',
    'scripts/util.mjs': 'export const x = 1;\n',
    'scripts/_lib/dato.json': '{"a":1}\n',
};
const LISTA = {
    incluir: [{ ruta: '.claude/skills/docs-x' }, { ruta: '.claude/rules/regla.md' }, { ruta: 'scripts/util.mjs' }, { ruta: 'scripts/_lib/dato.json' }],
    excluir_nombres: ['__pycache__'],
    excluir_sufijos: ['.pyc', '.fak-nueva'],
    prohibido_contenido: [{ texto: 'FacundoS-PC', motivo: 'nombre de la PC de Fak' }],
};
const LISTA2 = { ...LISTA, incluir: [...LISTA.incluir, { ruta: 'scripts/nuevo.mjs' }] };

function armarOrigen(archivos = V1) {
    const origen = dir('origen');
    for (const [rel, txt] of Object.entries(archivos)) esc(origen, rel, txt);
    return origen;
}
const pub = (origen, nube, lista = LISTA, extra = {}) => P.publicar({ origen, nube, lista, identidad: NOIDENT, ahora: F(1), ...extra });
const act = (destino, nube, extra = {}) => P.actualizar({ destino, nube, ahora: F(2), ...extra });

/** Firma a mano una publicacion (para armar una nube "rara" o maliciosa). */
function firmar(nube, manifiesto) {
    const txt = P.jsonCanonico(manifiesto);
    fs.writeFileSync(path.join(nube, 'MANIFIESTO.json'), txt);
    fs.writeFileSync(path.join(nube, 'VERSION.json'), P.jsonCanonico({
        formato: 1, version: manifiesto.version, fecha: '2026-10-01T10:00:00', archivos: Object.keys(manifiesto.archivos).length, bytes: 0, manifest_sha256: P.sha256(txt),
    }));
}

/** Un escenario tipico: Fak publico la v1 y la PC del compañero ya la instalo. */
function escenarioInstalado() {
    const origen = armarOrigen();
    const nube = dir('nube');
    const pc = dir('pc1');
    expect(pub(origen, nube).estado).toBe('publicado');
    expect(act(pc, nube).estado).toBe('actualizado');
    return { origen, nube, pc };
}

// ---------------------------------------------------------------------------------------------
describe('publicar', () => {
    it('deja contenido, MANIFIESTO, NOVEDADES y VERSION coherentes entre si', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        const r = pub(origen, nube);
        expect(r.estado).toBe('publicado');
        expect(r.version).toBe(1);
        expect(r.nuevos).toHaveLength(5);
        for (const [rel, txt] of Object.entries(V1)) expect(leer(nube, `contenido/${rel}`)).toBe(txt);
        const man = JSON.parse(fs.readFileSync(path.join(nube, 'MANIFIESTO.json'), 'utf8'));
        expect(Object.keys(man.archivos)).toEqual(Object.keys(man.archivos).slice().sort());
        expect(man.archivos['scripts/util.mjs'].sha256).toBe(P.sha256(V1['scripts/util.mjs']));
        const ver = JSON.parse(fs.readFileSync(path.join(nube, 'VERSION.json'), 'utf8'));
        expect(ver.version).toBe(1);
        expect(ver.manifest_sha256).toBe(P.sha256Archivo(path.join(nube, 'MANIFIESTO.json')));
        expect(P.leerPublicacion(nube).estado).toBe('ok');
        expect(leer(nube, 'NOVEDADES.md')).toContain('## Versión 1');
        expect(leer(nube, 'NOVEDADES.md')).toContain('docs-x (nueva)');
    });

    it('VERSION.json se escribe AL FINAL: si se corta la copia, la version publicada no cambia', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube);
        const versionAntes = fs.readFileSync(path.join(nube, 'VERSION.json'), 'utf8');
        const manifiestoAntes = fs.readFileSync(path.join(nube, 'MANIFIESTO.json'), 'utf8');
        // un directorio donde tiene que ir el archivo: la copia falla a mitad de camino
        const trabado = path.join(nube, 'contenido', 'scripts', 'util.mjs');
        fs.rmSync(trabado);
        fs.mkdirSync(trabado);
        esc(origen, 'scripts/util.mjs', 'export const x = 2;\n');
        const r = pub(origen, nube, LISTA, { ahora: F(2) });
        expect(r.estado).toBe('rechazado');
        expect(r.errores.join(' ')).toContain('se cortó la publicación');
        expect(fs.readFileSync(path.join(nube, 'VERSION.json'), 'utf8')).toBe(versionAntes);
        expect(fs.readFileSync(path.join(nube, 'MANIFIESTO.json'), 'utf8')).toBe(manifiestoAntes);
    });

    it('sin cambios no sube la version; con forzar si', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube);
        const r = pub(origen, nube, LISTA, { ahora: F(2) });
        expect(r.estado).toBe('sin_novedades');
        expect(r.version).toBe(1);
        const f = pub(origen, nube, LISTA, { ahora: F(2), forzar: true });
        expect(f.estado).toBe('publicado');
        expect(f.version).toBe(2);
        expect(leer(nube, 'NOVEDADES.md')).toContain('Republicada sin cambios de contenido');
    });

    it('si la publicacion anterior quedo a medias, republicar la repara aunque no haya cambios', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube);
        fs.rmSync(path.join(nube, 'contenido', 'scripts', 'util.mjs'));
        const r = pub(origen, nube, LISTA, { ahora: F(2) });
        expect(r.estado).toBe('publicado');
        expect(leer(nube, 'contenido/scripts/util.mjs')).toBe(V1['scripts/util.mjs']);
        expect(P.verificarContenido(nube, P.leerPublicacion(nube).manifiesto).ok).toBe(true);
    });

    it('NOVEDADES: lo nuevo va arriba, lo viejo abajo, con la nota de Fak y palabras simples', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube);
        esc(origen, 'scripts/util.mjs', 'export const x = 2;\n');
        esc(origen, '.claude/skills/otra/SKILL.md', '---\nname: otra\n---\n# otra\n');
        esc(origen, '.claude/skills/docs-x/ref/b.md', 'referencia b\n');
        const lista = { ...LISTA, incluir: [...LISTA.incluir, { ruta: '.claude/skills/otra' }] };
        pub(origen, nube, lista, { ahora: F(3), notas: ['Se acomodó la skill de documentos'] });
        const n = leer(nube, 'NOVEDADES.md');
        expect(n.indexOf('## Versión 2')).toBeLessThan(n.indexOf('## Versión 1'));
        expect(n).toContain('- Se acomodó la skill de documentos');
        expect(n).toContain('otra (nueva)');
        expect(n).toContain('docs-x (actualizada)');   // la skill ya estaba publicada: un archivo nuevo adentro es "actualizada"
        expect(n).toContain('util.mjs (actualizado)');
        expect(n.startsWith('# Novedades de la base de Claude')).toBe(true);
    });

    it('lo que sale de la lista se anota como "sacado" y no se borra de la nube', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube);
        const sinDato = { ...LISTA, incluir: LISTA.incluir.filter((e) => !e.ruta.includes('dato.json')) };
        const r = pub(origen, nube, sinDato, { ahora: F(2) });
        expect(r.retirados).toEqual(['scripts/_lib/dato.json']);
        expect(r.sobrantes).toEqual(['scripts/_lib/dato.json']);
        expect(existe(nube, 'contenido/scripts/_lib/dato.json')).toBe(true);
        expect(leer(nube, 'NOVEDADES.md')).toContain('Sacado de la base');
    });

    it('--simular cuenta todo y no escribe nada', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        const r = pub(origen, nube, LISTA, { simular: true });
        expect(r.estado).toBe('simulado');
        expect(r.nuevos).toHaveLength(5);
        expect(fs.readdirSync(nube)).toEqual([]);
    });

    it('una PC que recibe la base no publica', () => {
        const origen = armarOrigen();
        esc(origen, '.claude/.paquete-instalado.json', '{}');
        const r = pub(origen, dir('nube'));
        expect(r.estado).toBe('rechazado');
        expect(r.errores.join(' ')).toContain('solo la PC de origen publica');
    });

    it('sin carpeta de nube no inventa una ruta: dice que hay que crearla', () => {
        const r = pub(armarOrigen(), null);
        expect(r.estado).toBe('rechazado');
        expect(r.errores[0]).toContain('Base Claude Ingenieria');
    });
});

// ---------------------------------------------------------------------------------------------
describe('publicar: el filtro frena lo que no puede viajar (y no escribe nada)', () => {
    it('un archivo con el nombre de la PC de Fak frena toda la publicacion', () => {
        const origen = armarOrigen({ ...V1, 'scripts/util.mjs': '// probado en FacundoS-PC\nexport const x = 1;\n' });
        const nube = dir('nube');
        const r = pub(origen, nube);
        expect(r.estado).toBe('rechazado');
        expect(r.errores.join('\n')).toMatch(/scripts\/util\.mjs:1: nombre de la PC de Fak/);
        expect(fs.readdirSync(nube)).toEqual([]);
    });

    it('junta todos los problemas de una vez, con archivo y linea', () => {
        const origen = armarOrigen({
            ...V1,
            'scripts/util.mjs': 'const a = 1;\n// ver FacundoS-PC\n',
            '.claude/rules/regla.md': '# regla\nleer el archivo .env.local\n',
        });
        const r = pub(origen, dir('nube'));
        expect(r.errores.filter((e) => /util\.mjs:2/.test(e) || /regla\.md:2/.test(e))).toHaveLength(2);
    });

    const C = (...xs) => xs.join('');
    const casosQueFrenan = [
        ['un archivo de variables de entorno', 'cargar el .env.local del repo'],
        ['un .env suelto', 'copiar ../.env al lado'],
        ['la carpeta personal de una PC', ['C:', 'Users', 'Juan', 'Desktop'].join(BARRA)],
        ['la carpeta personal con barras', 'C:/Users/Juan/Desktop'],
        ['el cache de documentos', 'mirar en .sgc-cache primero'],
        ['el cerebro en la nube', 'copiar a Barack-cerebro'],
        ['el indice de memoria', 'leer MEMORY.md'],
        ['la carpeta de memoria de Claude', 'en .claude/projects/algo/memory'],
        ['un token JWT', C('eyJ', 'a'.repeat(20), '.', 'b'.repeat(15), '.c')],
        ['una clave de API', C('sk-', 'ant-', 'api03-abcdefghijklmn')],
        ['una clave privada', C('-----BEGIN ', 'RSA PRIVATE KEY-----')],
        ['una contraseña escrita', 'password = "hunter22"'],
        // auditoria 01/10/2026: lo que pasaba sin que el filtro lo viera
        ['una clave sin comillas en una variable', C('MI_API', '_KEY=', 'abcd1234efgh5678')],
        ['una clave sin comillas con export', C('export SERVICE_', 'TOKEN = ', 'Zx81kQ', 'p0-_aB')],
        ['una clave nueva de Supabase', C('sb_', 'secret_', 'abcdefghij1234')],
        ['la direccion de un proyecto de Supabase', C('https://', 'abcdefghijklmnopqrst', '.supa', 'base.co/rest')],
    ];
    it.each(casosQueFrenan)('frena %s', (_que, texto) => {
        const h = P.revisarContenido(new Map([['x.md', esc(tmp, 'x.md', `linea uno\n${texto}\n`)]]), P.patronesFiltro({ identidad: NOIDENT }));
        expect(h.length).toBeGreaterThan(0);
        expect(h[0].linea).toBe(2);
    });

    const casosQuePasan = [
        ['process.env de Node', 'const u = process.env.USERPROFILE;'],
        ['import.meta.env de Vite', 'const k = import.meta.env.VITE_X;'],
        ['la palabra environment', 'el environment de la PC'],
        ['una clave de cache (variable)', "clave = '%s|%d|%d' % (a, b, c)"],
        ['la carpeta publica de Windows', 'C:/Users/Public/Documents'],
        ['una ruta con %USERPROFILE%', '%USERPROFILE%/Desktop'],
        // una variable que LEE la clave de otro lado no la lleva escrita
        ['una variable que lee del entorno', "TOKEN = os.environ['X_TOKEN']"],
        ['una variable que llama a una funcion', 'API_KEY = leer_credencial()'],
        ['una variable vacia o None', 'ARB_PASSWORD = None'],
        ['el nombre supabase sin proyecto', 'los datos estan en supabase.co y en el repo'],
        ['una palabra larga sin numeros', 'SECRET_NAME = BARACK_ARB_GENERICA'],
    ];
    it.each(casosQuePasan)('NO frena %s (un filtro que grita por todo se termina ignorando)', (_que, texto) => {
        const h = P.revisarContenido(new Map([['x.md', esc(tmp, 'x.md', `${texto}\n`)]]), P.patronesFiltro({ identidad: NOIDENT }));
        expect(h).toEqual([]);
    });

    it('el usuario y la PC de quien publica se filtran solos, salvo nombres cortos o comunes', () => {
        const a = esc(tmp, 'a.md', 'probado en LuccaT-PC y en ING-PC-07\n');
        const con = P.patronesFiltro({ identidad: { usuario: 'LuccaT-PC', pc: 'ING-PC-07' } });
        expect(P.revisarContenido(new Map([['a.md', a]]), con)).toHaveLength(1);   // una linea, dos motivos juntos
        const sin = P.patronesFiltro({ identidad: { usuario: 'user', pc: 'ab' } });
        expect(P.revisarContenido(new Map([['a.md', esc(tmp, 'b.md', 'el user y ab\n')]]), sin)).toEqual([]);
    });

    it('un .md de .claude con "hooks:" en el encabezado se rechaza (ejecutaria codigo solo)', () => {
        const origen = armarOrigen({ ...V1, '.claude/skills/docs-x/SKILL.md': '---\nname: docs-x\nhooks:\n  PreToolUse: []\n---\n# x\n' });
        const r = pub(origen, dir('nube'));
        expect(r.estado).toBe('rechazado');
        expect(r.errores.join(' ')).toContain('hooks:');
    });

    it('un .mjs que importa algo que no esta en la lista se rechaza', () => {
        const origen = armarOrigen({ ...V1, 'scripts/util.mjs': "import { y } from './_lib/falta.mjs';\nexport const x = y;\n" });
        const r = pub(origen, dir('nube'));
        expect(r.estado).toBe('rechazado');
        expect(r.errores.join(' ')).toContain('importa scripts/_lib/falta.mjs');
    });

    it('un .mjs que importa algo que SI esta en la lista pasa (con y sin extension)', () => {
        const origen = armarOrigen({ ...V1, 'scripts/util.mjs': "import datos from './_lib/dato.json' with { type: 'json' };\nimport { z } from './nuevo';\n", 'scripts/nuevo.mjs': 'export const z = 1;\n' });
        expect(pub(origen, dir('nube'), LISTA2).estado).toBe('publicado');
    });

    it('una entrada de la lista que no existe es error, salvo que sea opcional', () => {
        const origen = armarOrigen();
        const r1 = pub(origen, dir('nube1'), { ...LISTA, incluir: [...LISTA.incluir, { ruta: 'scripts/no-existe.mjs' }] });
        expect(r1.estado).toBe('rechazado');
        expect(r1.errores.join(' ')).toContain('no-existe.mjs');
        const r2 = pub(origen, dir('nube2'), { ...LISTA, incluir: [...LISTA.incluir, { ruta: 'CLAUDE.equipo.md', opcional: true }] });
        expect(r2.estado).toBe('publicado');
        expect(r2.omitidos.map((o) => o.ruta)).toContain('CLAUDE.equipo.md');
    });

    it('si la ruta en la nube pasa de Windows (259) se rechaza con el nombre del archivo', () => {
        let nubeLarga = tmp;
        for (const letra of ['x', 'y', 'z', 'w']) nubeLarga = path.join(nubeLarga, letra.repeat(45));
        expect(nubeLarga.length).toBeGreaterThan(P.LIMITE_RUTA - 40);
        fs.mkdirSync(nubeLarga, { recursive: true });
        const relMasLargo = '.claude/skills/docs-x/ref/a.md';
        expect(path.join(nubeLarga, 'contenido', ...relMasLargo.split('/')).length).toBeGreaterThan(P.LIMITE_RUTA);
        const r = pub(armarOrigen(), nubeLarga);
        expect(r.estado).toBe('rechazado');
        expect(r.errores.join(' ')).toContain('Windows no la abriria');
    });

    it('no sigue enlaces ni publica archivos excluidos por nombre', () => {
        const origen = armarOrigen({ ...V1, 'scripts/_lib/__pycache__/x.pyc': 'basura' });
        const r = pub(origen, dir('nube'), { ...LISTA, incluir: [...LISTA.incluir, { ruta: 'scripts/_lib' }] });
        expect(r.estado).toBe('publicado');
        expect(existe(dir('nube'), 'contenido/scripts/_lib/__pycache__/x.pyc')).toBe(false);
    });
});

// ---------------------------------------------------------------------------------------------
describe('la lista: que puede entrar', () => {
    it('rechaza rutas que no pueden viajar, en las dos direcciones', () => {
        const mala = (ruta) => P.revisarLista({ incluir: [{ ruta }] });
        for (const ruta of ['.claude/settings.json', '.claude/settings.local.json', '.claude/hooks/x.sh', '.env', 'scripts/.env.local', '../fuera.txt', 'C:/x/y.txt', 'CLAUDE.md', 'scripts', '.git/config', 'scripts/node_modules/x/index.js', 'otra-carpeta/x.md']) {
            expect(mala(ruta), ruta).not.toEqual([]);
        }
        for (const ruta of ['.claude/skills/docs-x', '.claude/rules/regla.md', 'scripts/util.mjs', 'docs/guia.md', 'tools/x/y.json', 'CLAUDE.equipo.md']) {
            expect(mala(ruta), ruta).toEqual([]);
        }
    });

    it('si algo de "incluir" cae adentro de "no_van" (lo personal de Fak) se niega', () => {
        const no_van = [{ ruta: '.claude/rules/autonomy-contract.md', motivo: 'personal' }, { ruta: 'docs/_archive', motivo: 'historial' }];
        expect(P.revisarLista({ incluir: [{ ruta: '.claude/rules/autonomy-contract.md' }], no_van }).join(' ')).toContain('no_van');
        expect(P.revisarLista({ incluir: [{ ruta: '.claude/rules' }], no_van }).join(' ')).toContain('no_van');   // la carpeta entera la incluiria
        expect(P.revisarLista({ incluir: [{ ruta: 'docs/_archive/x.md' }], no_van }).join(' ')).toContain('no_van');
        expect(P.revisarLista({ incluir: [{ ruta: '.claude/rules/regla.md' }], no_van })).toEqual([]);
    });

    it('la lista real no incluye nada personal de Fak y todo lo que incluye existe', () => {
        const real = P.cargarLista(path.join(RAIZ, P.REL_LISTA));
        expect(P.revisarLista(real)).toEqual([]);
        const personales = ['CLAUDE.md', 'docs/LECCIONES_APRENDIDAS.md', '.claude/settings.json', '.claude/settings.local.json', '.claude/hooks', '.claude/agent-memory',
            '.claude/rules/autonomy-contract.md', '.claude/rules/mail-envio.md', '.claude/rules/techo-agentes.md', '.claude/rules/coordinador.md',
            '.claude/rules/escritorio-tareas.md', '.claude/rules/git-deploy.md', '.env', '.env.local', '.sgc-cache'];
        const enNoVan = real.no_van.map((x) => x.ruta);
        for (const p of personales) {
            expect(enNoVan, `${p} tiene que estar en no_van`).toContain(p);
            expect(real.incluir.some((e) => e.ruta === p || e.ruta.startsWith(`${p}/`)), `${p} no puede estar en incluir`).toBe(false);
        }
        for (const e of real.incluir) {
            if (e.opcional) continue;
            expect(fs.existsSync(path.join(RAIZ, ...e.ruta.split('/'))), `${e.ruta} esta en la lista y no existe`).toBe(true);
        }
        expect(real.incluir.map((e) => e.ruta)).toContain('scripts/_paquete.mjs');
    });

    it('el propio _paquete.mjs pasa el filtro de la lista real (viaja en la base y no puede contener lo que prohibe)', () => {
        const real = P.cargarLista(path.join(RAIZ, P.REL_LISTA));
        const archivos = new Map([['scripts/_paquete.mjs', SCRIPT]]);
        expect(P.revisarContenido(archivos, P.patronesFiltro({ lista: real, identidad: NOIDENT }))).toEqual([]);
        expect(P.importsQueFaltan(archivos)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------------------------
describe('decidirArchivo: nunca pisar lo del compañero', () => {
    const d = (x) => P.decidirArchivo(x);
    it('cubre cada caso', () => {
        expect(d({ nuevoHash: 'N', localHash: 'N', instaladoHash: 'I' })).toBe('igual');
        expect(d({ nuevoHash: 'N', localHash: null, instaladoHash: undefined })).toBe('nuevo');
        expect(d({ nuevoHash: 'N', localHash: 'I', instaladoHash: 'I' })).toBe('actualizar');
        expect(d({ nuevoHash: 'N', localHash: 'X', instaladoHash: 'I' })).toBe('tocado');
        expect(d({ nuevoHash: 'N', localHash: 'X', instaladoHash: undefined })).toBe('tocado');   // ya habia algo suyo con ese nombre
        expect(d({ nuevoHash: 'N', localHash: 'X', instaladoHash: 'N' })).toBe('propio');          // lo toco y Fak no tiene nada nuevo
        expect(d({ nuevoHash: 'N', localHash: null, instaladoHash: 'N' })).toBe('sacado');         // lo saco el compañero: se respeta
        expect(d({ nuevoHash: 'N', localHash: null, instaladoHash: 'I' })).toBe('sacado');
        expect(d({ nuevoHash: 'N', localHash: null, instaladoHash: 'N', reponer: true })).toBe('nuevo');
    });
});

// ---------------------------------------------------------------------------------------------
describe('actualizar', () => {
    it('en una PC vacia copia todo, guarda el registro y no deja ningun .fak-nueva', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube);
        const pc = dir('pc1');
        const r = act(pc, nube);
        expect(r.estado).toBe('actualizado');
        expect(r.contadores).toMatchObject({ nuevos: 5, actualizados: 0, tocados: 0 });
        for (const [rel, txt] of Object.entries(V1)) expect(leer(pc, rel)).toBe(txt);
        const reg = JSON.parse(leer(pc, P.REL_INSTALADO));
        expect(reg.version).toBe(1);
        expect(reg.archivos['scripts/util.mjs']).toBe(P.sha256(V1['scripts/util.mjs']));
        expect(Object.keys(foto(pc)).filter((k) => k.endsWith('.fak-nueva'))).toEqual([]);
        expect(existe(pc, P.REL_PENDIENTES)).toBe(false);
        expect(existe(pc, P.REL_LOCK)).toBe(false);   // el candado se suelta
    });

    it('la segunda vez dice "al dia" y no reescribe nada', () => {
        const { nube, pc } = escenarioInstalado();
        const antes = foto(pc);
        const r = act(pc, nube);
        expect(r.estado).toBe('al_dia');
        expect(foto(pc)).toEqual(antes);
    });

    describe('el compañero cambio un archivo nuestro y agrego cosas propias', () => {
        let origen; let nube; let pc; let antes;
        beforeEach(() => {
            ({ origen, nube, pc } = escenarioInstalado());
            // el compañero: modifica util.mjs (A), agrega una skill propia y un archivo propio dentro de una carpeta nuestra
            esc(pc, 'scripts/util.mjs', 'export const x = 99; // mio\n');
            esc(pc, '.claude/skills/mi-skill/SKILL.md', '---\nname: mi-skill\n---\n# mia\n');
            esc(pc, '.claude/skills/docs-x/mio.md', 'nota mia\n');
            antes = foto(pc);
            // Fak: cambia util.mjs (A'), cambia regla.md (C') y suma nuevo.mjs (B)
            esc(origen, 'scripts/util.mjs', 'export const x = 2;\n');
            esc(origen, '.claude/rules/regla.md', '# regla dos\n');
            esc(origen, 'scripts/nuevo.mjs', 'export const z = 1;\n');
            expect(pub(origen, nube, LISTA2, { ahora: F(3) }).version).toBe(2);
        });

        it('lo suyo sigue, lo tocado NO se pisa (queda .fak-nueva), lo no tocado se actualiza con respaldo y nada se borra', () => {
            const r = act(pc, nube, { ahora: F(4, 9) });
            expect(r.estado).toBe('actualizado');
            expect(r.contadores).toMatchObject({ nuevos: 1, actualizados: 1, tocados: 1, iguales: 3 });
            // lo suyo
            expect(leer(pc, 'scripts/util.mjs')).toBe('export const x = 99; // mio\n');
            expect(leer(pc, '.claude/skills/mi-skill/SKILL.md')).toContain('mia');
            expect(leer(pc, '.claude/skills/docs-x/mio.md')).toBe('nota mia\n');
            // lo que cambio Fak
            expect(leer(pc, 'scripts/util.mjs.fak-nueva')).toBe('export const x = 2;\n');
            expect(leer(pc, '.claude/rules/regla.md')).toBe('# regla dos\n');
            expect(leer(pc, 'scripts/nuevo.mjs')).toBe('export const z = 1;\n');
            // respaldo de lo reemplazado
            const resp = path.join(pc, ...P.REL_RESPALDO.split('/'), P.selloCarpeta(F(4, 9)));
            expect(fs.readFileSync(path.join(resp, '.claude', 'rules', 'regla.md'), 'utf8')).toBe('# regla uno\n');
            // nada se borro: todo lo que habia sigue (salvo regla.md, que cambio por el de Fak)
            const despues = foto(pc);
            for (const k of Object.keys(antes)) {
                expect(despues, `se borro ${k}`).toHaveProperty([k]);
                // regla.md cambio por el de Fak; el registro de la sincronizacion es de ella
                if (k !== '.claude/rules/regla.md' && k !== P.REL_INSTALADO) expect(despues[k], `cambio ${k}`).toBe(antes[k]);
            }
            // la lista para el Claude del compañero
            const pend = leer(pc, P.REL_PENDIENTES);
            expect(pend).toContain('`scripts/util.mjs`');
            expect(pend).toContain('scripts/util.mjs.fak-nueva');
            expect(pend).toContain('te conviene cambiar');
            expect(pend).not.toContain('regla.md');
        });

        it('correrlo de nuevo no cambia nada (ni reescribe el .fak-nueva ni la lista)', () => {
            act(pc, nube, { ahora: F(4) });
            const despues1 = foto(pc);
            const m1 = fs.statSync(path.join(pc, 'scripts', 'util.mjs.fak-nueva')).mtimeMs;
            const r = act(pc, nube, { ahora: F(5) });
            expect(r.estado).toBe('al_dia');
            expect(r.tocados).toEqual(['scripts/util.mjs']);
            expect(foto(pc)).toEqual(despues1);
            expect(fs.statSync(path.join(pc, 'scripts', 'util.mjs.fak-nueva')).mtimeMs).toBe(m1);
        });

        it('si el compañero aplica el cambio, la lista queda limpia y el .fak-nueva NO se borra solo', () => {
            act(pc, nube, { ahora: F(4) });
            fs.copyFileSync(path.join(pc, 'scripts', 'util.mjs.fak-nueva'), path.join(pc, 'scripts', 'util.mjs'));
            const r = act(pc, nube, { ahora: F(5) });
            expect(r.contadores.tocados).toBe(0);
            expect(leer(pc, P.REL_PENDIENTES)).toContain('Sin cambios pendientes');
            expect(existe(pc, 'scripts/util.mjs.fak-nueva')).toBe(true);
            expect(act(pc, nube, { ahora: F(6) }).estado).toBe('al_dia');
        });

        it('si Fak publica otra version mientras el compañero no resolvio, el .fak-nueva se pone al dia', () => {
            act(pc, nube, { ahora: F(4) });
            esc(origen, 'scripts/util.mjs', 'export const x = 3;\n');
            pub(origen, nube, LISTA2, { ahora: F(5) });
            act(pc, nube, { ahora: F(6) });
            expect(leer(pc, 'scripts/util.mjs.fak-nueva')).toBe('export const x = 3;\n');
            expect(leer(pc, 'scripts/util.mjs')).toBe('export const x = 99; // mio\n');
        });

        it('--simular dice lo que haria y no toca nada', () => {
            const antesDeSimular = foto(pc);
            const r = act(pc, nube, { simular: true });
            expect(r.estado).toBe('simulado');
            expect(r.contadores).toMatchObject({ nuevos: 1, actualizados: 1, tocados: 1 });
            expect(foto(pc)).toEqual(antesDeSimular);
        });
    });

    it('un archivo que el compañero cambio y Fak NO toco no genera .fak-nueva (no hay nada nuevo)', () => {
        const { origen, nube, pc } = escenarioInstalado();
        esc(pc, 'scripts/_lib/dato.json', '{"a":1,"mio":true}\n');
        esc(origen, '.claude/rules/regla.md', '# regla dos\n');
        pub(origen, nube, LISTA, { ahora: F(3) });
        const r = act(pc, nube, { ahora: F(4) });
        expect(r.contadores).toMatchObject({ propios: 1, actualizados: 1, tocados: 0 });
        expect(existe(pc, 'scripts/_lib/dato.json.fak-nueva')).toBe(false);
        expect(leer(pc, 'scripts/_lib/dato.json')).toBe('{"a":1,"mio":true}\n');
    });

    it('lo que el compañero borro no se repone solo (se anota); con --reponer si', () => {
        const { origen, nube, pc } = escenarioInstalado();
        fs.rmSync(path.join(pc, 'scripts', 'util.mjs'));
        esc(origen, '.claude/rules/regla.md', '# regla dos\n');
        pub(origen, nube, LISTA, { ahora: F(3) });
        const r = act(pc, nube, { ahora: F(4) });
        expect(r.sacados).toEqual(['scripts/util.mjs']);
        expect(existe(pc, 'scripts/util.mjs')).toBe(false);
        expect(leer(pc, P.REL_PENDIENTES)).toContain('Los sacaste vos');
        const r2 = act(pc, nube, { ahora: F(5), reponer: true });
        expect(r2.estado).toBe('actualizado');
        expect(leer(pc, 'scripts/util.mjs')).toBe(V1['scripts/util.mjs']);
    });

    it('si el compañero ya tenia un archivo propio con el mismo nombre, no se lo pisa aunque sea la primera vez', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube);
        const pc = dir('pc1');
        esc(pc, 'scripts/util.mjs', 'const mio = 1;\n');
        const r = act(pc, nube);
        expect(r.contadores).toMatchObject({ nuevos: 4, tocados: 1 });
        expect(leer(pc, 'scripts/util.mjs')).toBe('const mio = 1;\n');
        expect(leer(pc, 'scripts/util.mjs.fak-nueva')).toBe(V1['scripts/util.mjs']);
    });

    it('lo que Fak saca de la lista sigue en la PC del compañero y se anota', () => {
        const { origen, nube, pc } = escenarioInstalado();
        const sinDato = { ...LISTA, incluir: LISTA.incluir.filter((e) => !e.ruta.includes('dato.json')) };
        esc(origen, '.claude/rules/regla.md', '# regla dos\n');
        pub(origen, nube, sinDato, { ahora: F(3) });
        const r = act(pc, nube, { ahora: F(4) });
        expect(r.retirados).toEqual(['scripts/_lib/dato.json']);
        expect(existe(pc, 'scripts/_lib/dato.json')).toBe(true);
        expect(leer(pc, P.REL_PENDIENTES)).toContain('Fak dejó de publicarlos');
    });

    it('no se actualiza la PC de origen (la que tiene la lista de publicacion)', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube);
        esc(origen, P.REL_LISTA, '{}');
        const antes = foto(origen);
        const r = act(origen, nube);
        expect(r.estado).toBe('error');
        expect(r.errores.join(' ')).toContain('PC de origen');
        expect(foto(origen)).toEqual(antes);
    });

    it('un candado reciente significa "otra sincronizacion corriendo"; uno viejo se retoma', () => {
        const { origen, nube, pc } = escenarioInstalado();
        esc(origen, '.claude/rules/regla.md', '# regla dos\n');
        pub(origen, nube, LISTA, { ahora: F(3) });
        const candado = esc(pc, P.REL_LOCK, '123 x\n');
        const r = act(pc, nube, { ahora: F(4) });
        expect(r.estado).toBe('ocupado');
        expect(leer(pc, '.claude/rules/regla.md')).toBe('# regla uno\n');
        const hace2h = new Date(Date.now() - 2 * 3600 * 1000);
        fs.utimesSync(candado, hace2h, hace2h);
        expect(act(pc, nube, { ahora: F(4) }).estado).toBe('actualizado');
        expect(existe(pc, P.REL_LOCK)).toBe(false);
    });
});

// ---------------------------------------------------------------------------------------------
describe('actualizar con la nube a medias: no toca NADA', () => {
    /** Publica la v1, instala en una PC, publica la v2 y la estropea de una forma; la PC no puede cambiar. */
    function v2Estropeada(estropear) {
        const { origen, nube, pc } = escenarioInstalado();
        esc(origen, '.claude/rules/regla.md', '# regla dos\n');
        esc(origen, 'scripts/nuevo.mjs', 'export const z = 1;\n');
        pub(origen, nube, LISTA2, { ahora: F(3) });
        estropear(nube);
        return { nube, pc };
    }
    const formas = {
        'sin VERSION.json': (nube) => fs.rmSync(path.join(nube, 'VERSION.json')),
        'VERSION.json cortado a la mitad': (nube) => fs.writeFileSync(path.join(nube, 'VERSION.json'), '{"version": 2, "manifest_sh'),
        'VERSION.json de una version y MANIFIESTO de otra': (nube) => {
            const v = JSON.parse(fs.readFileSync(path.join(nube, 'VERSION.json'), 'utf8'));
            v.manifest_sha256 = 'a'.repeat(64);
            fs.writeFileSync(path.join(nube, 'VERSION.json'), JSON.stringify(v));
        },
        'sin MANIFIESTO.json': (nube) => fs.rmSync(path.join(nube, 'MANIFIESTO.json')),
        'un archivo de contenido con otro hash (mismo tamaño)': (nube) => fs.writeFileSync(path.join(nube, 'contenido', 'scripts', 'nuevo.mjs'), 'export const z = 7;\n'),
        'un archivo de contenido con otro tamaño': (nube) => fs.writeFileSync(path.join(nube, 'contenido', '.claude', 'rules', 'regla.md'), '# regla\n'),
        'un archivo de contenido que falta': (nube) => fs.rmSync(path.join(nube, 'contenido', 'scripts', 'nuevo.mjs')),
        'un archivo viejo que falta (aunque no cambio en la v2)': (nube) => fs.rmSync(path.join(nube, 'contenido', 'scripts', '_lib', 'dato.json')),
    };
    it.each(Object.keys(formas))('%s', (forma) => {
        const { nube, pc } = v2Estropeada(formas[forma]);
        const antes = foto(pc);
        const r = act(pc, nube, { ahora: F(4) });
        expect(r.estado).toBe('esperar');
        expect(r.mensaje).toContain('OneDrive todavía está bajando');
        expect(foto(pc)).toEqual(antes);
        expect(leer(pc, '.claude/rules/regla.md')).toBe('# regla uno\n');
        expect(JSON.parse(leer(pc, P.REL_INSTALADO)).version).toBe(1);
    });

    it('en una PC vacia tampoco instala a medias', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube);
        fs.rmSync(path.join(nube, 'contenido', 'scripts', 'util.mjs'));
        const pc = dir('pcNueva');
        expect(act(pc, nube).estado).toBe('esperar');
        expect(foto(pc)).toEqual({});
    });

    it('cuando la nube termina de bajar, la siguiente corrida si actualiza', () => {
        const { origen, nube, pc } = escenarioInstalado();
        esc(origen, '.claude/rules/regla.md', '# regla dos\n');
        pub(origen, nube, LISTA, { ahora: F(3) });
        const copia = fs.readFileSync(path.join(nube, 'contenido', '.claude', 'rules', 'regla.md'));
        fs.rmSync(path.join(nube, 'contenido', '.claude', 'rules', 'regla.md'));
        expect(act(pc, nube, { ahora: F(4) }).estado).toBe('esperar');
        fs.writeFileSync(path.join(nube, 'contenido', '.claude', 'rules', 'regla.md'), copia);
        expect(act(pc, nube, { ahora: F(5) }).estado).toBe('actualizado');
        expect(leer(pc, '.claude/rules/regla.md')).toBe('# regla dos\n');
    });
});

// ---------------------------------------------------------------------------------------------
describe('actualizar: lo que llega de la nube es DATO, no ordenes', () => {
    const OK = { sha256: 'a'.repeat(64), bytes: 1 };
    const rutasMalas = ['../fuera.txt', 'scripts/../../fuera.txt', '.claude/settings.json', '.claude/settings.local.json', '.claude/hooks/hook.sh', 'CLAUDE.md', '.env', 'scripts/.env.local', '.git/config', 'C:/Windows/x.txt', 'otra-carpeta/x.md', '.claude/.paquete-instalado.json'];
    it('un manifiesto con una ruta que se sale, o que pisaria config/hooks/archivos propios, no se acepta y no se toca nada', () => {
        const { nube, pc } = escenarioInstalado();
        const limpio = JSON.parse(fs.readFileSync(path.join(nube, 'MANIFIESTO.json'), 'utf8'));
        const antes = foto(pc);
        const sinLaNube = () => Object.fromEntries(Object.entries(foto(tmp)).filter(([k]) => !k.startsWith('nube/')));
        const afuera = sinLaNube();
        for (const ruta of rutasMalas) {
            const man = { ...limpio, version: 2, archivos: { ...limpio.archivos, [ruta]: OK } };
            firmar(nube, man);
            const r = act(pc, nube, { ahora: F(4) });
            expect(r.estado, ruta).toBe('error');
            expect(r.errores.join(' '), ruta).toContain('rutas o datos que no se aceptan');
            expect(r.errores.join(' '), ruta).toContain(ruta);
            expect(foto(pc), ruta).toEqual(antes);
        }
        expect(sinLaNube()).toEqual(afuera);   // ni una escritura fuera de la PC del compañero
        expect(existe(tmp, 'fuera.txt')).toBe(false);
    });

    it('una skill cuyo encabezado declara hooks no se instala', () => {
        const { nube, pc } = escenarioInstalado();
        const contenido = '---\nname: x\nhooks:\n  PreToolUse: []\n---\n# x\n';
        esc(nube, 'contenido/.claude/skills/hook-x/SKILL.md', contenido);
        const man = JSON.parse(fs.readFileSync(path.join(nube, 'MANIFIESTO.json'), 'utf8'));
        man.version = 2;
        man.archivos['.claude/skills/hook-x/SKILL.md'] = { sha256: P.sha256(contenido), bytes: Buffer.byteLength(contenido) };
        firmar(nube, man);
        const antes = foto(pc);
        const r = act(pc, nube, { ahora: F(4) });
        expect(r.estado).toBe('error');
        expect(r.errores.join(' ')).toContain('hooks:');
        expect(foto(pc)).toEqual(antes);
    });
});

// ---------------------------------------------------------------------------------------------
describe('ver', () => {
    it('muestra la version local, la publicada y solo las novedades que faltan', () => {
        const { origen, nube, pc } = escenarioInstalado();
        esc(origen, 'scripts/util.mjs', 'export const x = 2;\n');
        pub(origen, nube, LISTA, { ahora: F(3), notas: ['segunda'] });
        esc(origen, 'scripts/util.mjs', 'export const x = 3;\n');
        pub(origen, nube, LISTA, { ahora: F(4), notas: ['tercera'] });
        const r = P.ver({ destino: pc, nube });
        expect(r.instalada.version).toBe(1);
        expect(r.publicada.version).toBe(3);
        expect(r.estadoNube).toBe('ok');
        expect(r.novedades.map((n) => n.version)).toEqual([3, 2]);
        expect(r.novedades[0].texto).toContain('tercera');
        expect(P.ver({ destino: pc, nube }).novedades.some((n) => n.version === 1)).toBe(false);
    });

    it('un VERSION.json con BOM (lo dejo un editor de Windows) se lee igual', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube);
        const p = path.join(nube, 'VERSION.json');
        fs.writeFileSync(p, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), fs.readFileSync(p)]));
        expect(P.leerPublicacion(nube).estado).toBe('ok');
    });

    it('una PC sin nada instalado y una nube a medias se cuentan sin inventar', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube);
        fs.rmSync(path.join(nube, 'VERSION.json'));
        const r = P.ver({ destino: dir('vacia'), nube });
        expect(r.instalada).toBe(null);
        expect(r.publicada).toBe(null);
        expect(r.estadoNube).toBe('sin_version');
        expect(P.ver({ destino: dir('vacia2'), nube: null }).estadoNube).toBe('sin_nube');
    });
});

// ---------------------------------------------------------------------------------------------
describe('buscarNube: la biblioteca lleva tilde y cambia entre PCs', () => {
    const NOMBRE = 'Base Claude Ingenieria';
    it('la encuentra adentro de la biblioteca sincronizada (con tilde)', () => {
        const home = dir('home');
        const esperada = dir('home', 'BARACK ARGENTINA SRL', 'Ingeniería y Proyecto - General', NOMBRE);
        expect(P.buscarNube(home)).toBe(esperada);
    });
    it('no le importan las tildes ni las mayusculas del nombre de la carpeta ni de la biblioteca', () => {
        const home = dir('home');
        const esperada = dir('home', 'Barack Argentina SRL', 'INGENIERIA Y PROYECTO - GENERAL', 'BASE CLAUDE INGENIERÍA');
        expect(P.buscarNube(home)).toBe(esperada);
    });
    it('prefiere la biblioteca de Ingenieria si la carpeta esta en mas de una', () => {
        const home = dir('home');
        dir('home', 'BARACK ARGENTINA SRL', 'Calidad - General', NOMBRE);
        const esperada = dir('home', 'BARACK ARGENTINA SRL', 'Ingeniería y Proyecto - General', NOMBRE);
        expect(P.buscarNube(home)).toBe(esperada);
    });
    it('tambien si cuelga directo de la raiz de la empresa', () => {
        const home = dir('home');
        expect(P.buscarNube(home)).toBe(null);
        const esperada = dir('home', 'OneDrive - BARACK ARGENTINA SRL', NOMBRE);
        expect(P.buscarNube(home)).toBe(esperada);
    });
    it('devuelve null si no esta (no inventa una ruta) y no se confunde con otra cosa', () => {
        const home = dir('home');
        dir('home', 'BARACK ARGENTINA SRL', 'Ingeniería y Proyecto - General', 'Claude Barack');
        dir('home', 'Documents', NOMBRE);
        expect(P.buscarNube(home)).toBe(null);
        expect(P.buscarNube(path.join(tmp, 'no-existe'))).toBe(null);
    });
    it('sigue un enlace (la carpeta de OneDrive puede ser un reparse point)', () => {
        const real = dir('real', 'Ingeniería y Proyecto - General', NOMBRE);
        const home = dir('home');
        try { fs.symlinkSync(path.join(tmp, 'real'), path.join(home, 'BARACK ARGENTINA SRL'), 'junction'); } catch { return; }   // sin permiso para crear enlaces: no se puede probar aca
        expect(fs.statSync(P.buscarNube(home)).isDirectory()).toBe(true);
        expect(path.basename(P.buscarNube(home))).toBe(NOMBRE);
        expect(fs.realpathSync(P.buscarNube(home))).toBe(fs.realpathSync(real));
    });
});

// ---------------------------------------------------------------------------------------------
describe('aportes de los compañeros', () => {
    const AUTOR = 'Federico Leonardo Lattanzi - Ingenieria';
    const aportar = (extra = {}) => P.aportar({ nube: extra.nube, destino: extra.destino, identidad: NOIDENT, ahora: F(1), ...extra });
    function preparar() {
        const nube = dir('nube');
        const pc = dir('pc1');
        esc(pc, '.claude/skills/mi-skill/SKILL.md', '---\nname: mi-skill\ndescription: "Arma la tabla de tiempos de una celda"\n---\n# mi-skill\n');
        esc(pc, '.claude/skills/mi-skill/ref/uno.md', 'detalle\n');
        return { nube, pc };
    }

    it('copia a aportes/<autor>/<fecha>-<nombre>/ con un LEEME, conservando la ruta original', () => {
        const { nube, pc } = preparar();
        const r = aportar({ ruta: path.join(pc, '.claude', 'skills', 'mi-skill'), autor: AUTOR, que: 'Tabla de tiempos por celda', nube, destino: pc });
        expect(r.estado).toBe('aportado');
        const base = path.join(nube, 'aportes', AUTOR, '2026-10-01-mi-skill');
        expect(r.carpeta).toBe(base);
        expect(fs.readFileSync(path.join(base, '.claude', 'skills', 'mi-skill', 'SKILL.md'), 'utf8')).toContain('mi-skill');
        expect(fs.existsSync(path.join(base, '.claude', 'skills', 'mi-skill', 'ref', 'uno.md'))).toBe(true);
        const leeme = fs.readFileSync(path.join(base, 'LEEME.md'), 'utf8');
        expect(leeme).toContain(`Autor: ${AUTOR}`);
        expect(leeme).toContain('Fecha: 01/10/2026');
        expect(leeme).toContain('Qué es: Tabla de tiempos por celda');
        expect(leeme).toContain('.claude/skills/mi-skill/SKILL.md');
        expect(leeme).toContain('NO forma parte de la base oficial');
    });

    it('nunca toca contenido\\, VERSION.json ni lo publicado por Fak', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube);
        const antes = foto(nube);
        const pc = dir('pc1');
        esc(pc, 'scripts/mio.py', 'print(1)\n');
        aportar({ ruta: path.join(pc, 'scripts', 'mio.py'), autor: AUTOR, que: 'un script', nube, destino: pc });
        const despues = foto(nube);
        for (const k of Object.keys(antes)) expect(despues[k]).toBe(antes[k]);
        expect(Object.keys(despues).filter((k) => !(k in antes)).every((k) => k.startsWith('aportes/'))).toBe(true);
    });

    it('un archivo de afuera de la carpeta del proyecto entra con su nombre', () => {
        const { nube, pc } = preparar();
        const suelto = esc(tmp, 'suelto/mi-script.py', 'print("hola")\n');
        const r = aportar({ ruta: suelto, autor: AUTOR, que: 'un script de prueba', nube, destino: pc });
        expect(r.estado).toBe('aportado');
        expect(fs.readFileSync(path.join(nube, 'aportes', AUTOR, '2026-10-01-mi-script', 'mi-script.py'), 'utf8')).toContain('hola');
    });

    it('no pisa un aporte anterior: el mismo nombre el mismo dia pasa a -2 y el primero queda intacto', () => {
        const { nube, pc } = preparar();
        const ruta = path.join(pc, '.claude', 'skills', 'mi-skill');
        aportar({ ruta, autor: AUTOR, que: 'primera', nube, destino: pc });
        const primera = foto(path.join(nube, 'aportes', AUTOR, '2026-10-01-mi-skill'));
        esc(pc, '.claude/skills/mi-skill/ref/uno.md', 'detalle cambiado\n');
        const r = aportar({ ruta, autor: AUTOR, que: 'segunda', nube, destino: pc });
        expect(path.basename(r.carpeta)).toBe('2026-10-01-mi-skill-2');
        expect(foto(path.join(nube, 'aportes', AUTOR, '2026-10-01-mi-skill'))).toEqual(primera);
        expect(aportar({ ruta, autor: AUTOR, que: 'tercera', nube, destino: pc }).carpeta.endsWith('mi-skill-3')).toBe(true);
    });

    it('el mismo autor escrito distinto (tildes, mayusculas) cae en la misma carpeta', () => {
        const { nube, pc } = preparar();
        const ruta = path.join(pc, '.claude', 'skills', 'mi-skill');
        aportar({ ruta, autor: AUTOR, que: 'a', nube, destino: pc });
        const r = aportar({ ruta, autor: 'FEDERICO LEONARDO LATTANZI - INGENIERÍA', que: 'b', nube, destino: pc, ahora: F(2) });
        expect(r.autor).toBe(AUTOR);
        expect(fs.readdirSync(path.join(nube, 'aportes'))).toEqual([AUTOR]);
    });

    it('el mismo filtro de secretos que --publicar: frena y no crea ni la carpeta de aportes', () => {
        const { nube, pc } = preparar();
        esc(pc, '.claude/skills/mi-skill/ref/uno.md', 'probado en LuccaT-PC, ver el .env.local\n');
        const ident = { usuario: 'LuccaT-PC', pc: '' };
        const r = P.aportar({ ruta: path.join(pc, '.claude', 'skills', 'mi-skill'), autor: AUTOR, que: 'x', nube, destino: pc, identidad: ident, ahora: F(1) });
        expect(r.estado).toBe('rechazado');
        expect(r.errores.join('\n')).toMatch(/uno\.md:1: .*variables de entorno/);
        expect(r.errores.join('\n')).toMatch(/uno\.md:1: .*nombre de usuario o de la PC/);
        expect(fs.existsSync(path.join(nube, 'aportes'))).toBe(false);
    });

    it('usa tambien los patrones propios de la lista cuando hay una', () => {
        const { nube, pc } = preparar();
        esc(pc, 'scripts/mio.py', '# FacundoS-PC\n');
        const r = aportar({ ruta: path.join(pc, 'scripts', 'mio.py'), autor: AUTOR, que: 'x', nube, destino: pc, lista: LISTA });
        expect(r.estado).toBe('rechazado');
        expect(fs.existsSync(path.join(nube, 'aportes'))).toBe(false);
    });

    it.each([
        ['un archivo de variables de entorno', '.env.local', 'A=1\n'],
        ['la configuracion de Claude Code', 'settings.json', '{}\n'],
        ['un archivo de claves', 'mi.pem', 'x\n'],
        ['un ejecutable', 'programa.exe', 'MZ\n'],
        ['un buzon', 'correo.pst', 'x\n'],
    ])('rechaza %s', (_que, nombre, contenido) => {
        const { nube, pc } = preparar();
        const ruta = esc(tmp, `suelto/${nombre}`, contenido);
        const r = aportar({ ruta, autor: AUTOR, que: 'x', nube, destino: pc });
        expect(r.estado).toBe('rechazado');
        expect(fs.existsSync(path.join(nube, 'aportes'))).toBe(false);
    });

    it('un aporte con "hooks:" en el encabezado se rechaza', () => {
        const { nube, pc } = preparar();
        esc(pc, '.claude/skills/mi-skill/SKILL.md', '---\nname: mi-skill\nhooks:\n  Stop: []\n---\n');
        const r = aportar({ ruta: path.join(pc, '.claude', 'skills', 'mi-skill'), autor: AUTOR, que: 'x', nube, destino: pc });
        expect(r.estado).toBe('rechazado');
        expect(r.errores.join(' ')).toContain('hooks:');
    });

    it('sin --que usa la description de la skill; sin eso, lo pide', () => {
        const { nube, pc } = preparar();
        const a = aportar({ ruta: path.join(pc, '.claude', 'skills', 'mi-skill'), autor: AUTOR, nube, destino: pc });
        expect(a.estado).toBe('aportado');
        expect(fs.readFileSync(path.join(a.carpeta, 'LEEME.md'), 'utf8')).toContain('Qué es: Arma la tabla de tiempos de una celda');
        const suelto = esc(tmp, 'suelto/otro.py', 'print(1)\n');
        const b = aportar({ ruta: suelto, autor: AUTOR, nube, destino: pc });
        expect(b.estado).toBe('rechazado');
        expect(b.errores.join(' ')).toContain('--que');
    });

    it('sin autor ni perfil pide quien sos; con perfil local lo usa', () => {
        const { nube, pc } = preparar();
        const ruta = path.join(pc, '.claude', 'skills', 'mi-skill');
        const sin = aportar({ ruta, que: 'x', nube, destino: pc });
        expect(sin.estado).toBe('rechazado');
        expect(sin.errores[0]).toContain('nombre y apellido y su sector');
        expect(P.guardarPerfil({ destino: pc, autor: AUTOR, ahora: F(1) }).estado).toBe('guardado');
        expect(JSON.parse(leer(pc, P.REL_PERFIL))).toMatchObject({ autor: AUTOR, nombre: 'Federico Leonardo Lattanzi', sector: 'Ingenieria' });
        const con = aportar({ ruta, que: 'x', nube, destino: pc });
        expect(con.estado).toBe('aportado');
        expect(con.autor).toBe(AUTOR);
    });

    it('no acepta rutas que no existen, enlaces ni carpetas enormes', () => {
        const { nube, pc } = preparar();
        expect(aportar({ ruta: path.join(pc, 'nada'), autor: AUTOR, que: 'x', nube, destino: pc }).errores[0]).toContain('no existe');
        const enorme = dir('enorme');
        for (let i = 0; i <= P.MAX_ARCHIVOS_APORTE; i++) fs.writeFileSync(path.join(enorme, `f${i}.md`), 'x');
        const r = aportar({ ruta: enorme, autor: AUTOR, que: 'x', nube, destino: pc });
        expect(r.estado).toBe('rechazado');
        expect(r.errores.join(' ')).toContain('mas de');
    });

    it('--simular cuenta y no escribe', () => {
        const { nube, pc } = preparar();
        const r = aportar({ ruta: path.join(pc, '.claude', 'skills', 'mi-skill'), autor: AUTOR, que: 'x', nube, destino: pc, simular: true });
        expect(r.estado).toBe('simulado');
        expect(r.archivos).toBe(2);
        expect(fs.existsSync(path.join(nube, 'aportes'))).toBe(false);
    });

    it('--aportes lista lo aportado por autor, con lo que es cada uno', () => {
        const { nube, pc } = preparar();
        const ruta = path.join(pc, '.claude', 'skills', 'mi-skill');
        aportar({ ruta, autor: AUTOR, que: 'Tabla de tiempos', nube, destino: pc });
        aportar({ ruta, autor: AUTOR, que: 'Otra version', nube, destino: pc, ahora: F(2) });
        aportar({ ruta, autor: 'Lucca Tuccio - Calidad', que: 'Del lado de calidad', nube, destino: pc, ahora: F(3) });
        const todo = P.listarAportes({ nube });
        expect(todo.map((x) => x.autor)).toEqual([AUTOR, 'Lucca Tuccio - Calidad']);
        expect(todo[0].aportes.map((a) => a.carpeta)).toEqual(['2026-10-01-mi-skill', '2026-10-02-mi-skill']);
        expect(todo[0].aportes[0]).toMatchObject({ queEs: 'Tabla de tiempos', archivos: 2 });
        const uno = P.listarAportes({ nube, autor: 'lucca tuccio - calidad' });
        expect(uno).toHaveLength(1);
        expect(uno[0].aportes[0].queEs).toBe('Del lado de calidad');
        expect(P.listarAportes({ nube: dir('otraNube') })).toEqual([]);
    });

    it('parseAutor: nombre y apellido, " - " y sector; nada que escape de la carpeta', () => {
        expect(P.parseAutor('Federico Leonardo Lattanzi - Ingenieria')).toMatchObject({ nombre: 'Federico Leonardo Lattanzi', sector: 'Ingenieria', carpeta: 'Federico Leonardo Lattanzi - Ingenieria' });
        expect(P.parseAutor('  Ana-María   Pérez - Calidad ').carpeta).toBe('Ana-María Pérez - Calidad');
        for (const mal of ['Fede - Ing', 'Federico Lattanzi', '../x y - Ingenieria', 'Federico Lattanzi - Ing3', 'Fede/rico Lattanzi - Ingenieria', '', null]) {
            expect(P.parseAutor(mal).error, String(mal)).toBeTruthy();
        }
    });
});

// ---------------------------------------------------------------------------------------------
describe('linea de comandos', () => {
    const correr = (args, env = {}) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, ...env }, timeout: 60000 });
    const listaEnArchivo = () => { const p = path.join(tmp, 'lista.json'); fs.writeFileSync(p, JSON.stringify(LISTA)); return p; };

    it('publicar -> actualizar -> ver, con sus codigos de salida', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        const pc = dir('pc1');
        const lista = listaEnArchivo();
        const p = correr(['--publicar', '--origen', origen, '--nube', nube, '--lista', lista, '--nota', 'primera version']);
        expect(p.status, p.stdout + p.stderr).toBe(0);
        expect(p.stdout).toContain('Publicada la version 1');
        expect(leer(nube, 'NOVEDADES.md')).toContain('- primera version');
        const a = correr(['--actualizar', '--destino', pc, '--nube', nube]);
        expect(a.status, a.stdout + a.stderr).toBe(0);
        expect(a.stdout).toContain('5 nuevos');
        expect(correr(['--actualizar', '--destino', pc, '--nube', nube]).stdout).toContain('Al dia');
        const v = correr(['--ver', '--destino', pc, '--nube', nube]);
        expect(v.status).toBe(0);
        expect(v.stdout).toContain('Instalada en esta PC: version 1');
        expect(v.stdout).toContain('Publicada en la nube: version 1');
    });

    it('nube a medias: salida 3 y el mensaje de OneDrive (no es un error)', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        const pc = dir('pc1');
        correr(['--publicar', '--origen', origen, '--nube', nube, '--lista', listaEnArchivo()]);
        fs.rmSync(path.join(nube, 'VERSION.json'));
        const a = correr(['--actualizar', '--destino', pc, '--nube', nube]);
        expect(a.status).toBe(3);
        expect(a.stdout).toContain('OneDrive todavía está bajando');
        expect(foto(pc)).toEqual({});
    });

    it('publicar con un archivo prohibido: salida 1, lista el problema y no escribe', () => {
        const origen = armarOrigen({ ...V1, 'scripts/util.mjs': '// FacundoS-PC\n' });
        const nube = dir('nube');
        const p = correr(['--publicar', '--origen', origen, '--nube', nube, '--lista', listaEnArchivo()]);
        expect(p.status).toBe(1);
        expect(p.stderr).toContain('NO SE PUBLICO NADA');
        expect(p.stderr).toContain('scripts/util.mjs:1');
        expect(fs.readdirSync(nube)).toEqual([]);
    });

    it('perfil, aportar y aportes desde la linea de comandos', () => {
        const nube = dir('nube');
        const pc = dir('pc1');
        esc(pc, 'scripts/mio.py', 'print(1)\n');
        const sin = correr(['--aportar', path.join(pc, 'scripts', 'mio.py'), '--que', 'un script', '--destino', pc, '--nube', nube]);
        expect(sin.status).toBe(1);
        expect(sin.stderr).toContain('nombre y apellido y su sector');
        expect(correr(['--perfil', 'Federico Leonardo Lattanzi - Ingenieria', '--destino', pc]).status).toBe(0);
        const ok = correr(['--aportar', path.join(pc, 'scripts', 'mio.py'), '--que', 'un script', '--destino', pc, '--nube', nube]);
        expect(ok.status, ok.stdout + ok.stderr).toBe(0);
        const ls = correr(['--aportes', '--nube', nube]);
        expect(ls.stdout).toContain('Federico Leonardo Lattanzi - Ingenieria (1)');
        expect(ls.stdout).toContain('un script');
    });

    it('sin opciones muestra el uso; un valor que falta es un error claro', () => {
        expect(correr([]).stdout).toContain('Uso:');
        const r = correr(['--nube']);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('necesita un valor');
    });
});
