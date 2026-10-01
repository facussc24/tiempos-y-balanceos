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

    // Hasta el 01/10/2026 lo retirado "seguia en tu PC". Desde las lapidas (punto 3 del plan), lo que
    // Fak saca de la lista pasa a cuarentena si en la PC esta identico a lo publicado: ver el bloque
    // "lapidas" mas abajo. Un manifiesto SIN lapidas (publicador viejo) sigue como antes:
    it('lo que un publicador VIEJO (sin lapidas) saca de la lista sigue en la PC del compañero y se anota', () => {
        const { nube, pc } = escenarioInstalado();
        const man = JSON.parse(fs.readFileSync(path.join(nube, 'MANIFIESTO.json'), 'utf8'));
        delete man.archivos['scripts/_lib/dato.json'];
        delete man.lapidas;
        man.version = 2;
        firmar(nube, man);
        const r = act(pc, nube, { ahora: F(4) });
        expect(r.estado).toBe('actualizado');
        expect(r.retirados).toEqual(['scripts/_lib/dato.json']);
        expect(r.cuarentena).toEqual([]);
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

// =============================================================================================
// 01/10/2026 — proyecto "un Claude por area": firma, historial/rollback, lapidas, areas, chequeo
// rapido, salud y la carpeta por proyecto (tools/claude-area/CONTRATO.md). Cada control se prueba
// en las dos direcciones y cada camino que escribe corre de verdad contra una carpeta temporal.
// =============================================================================================

/** Un par de claves de firma en una carpeta temporal (nunca la real). */
function claves(nombre = 'claves') {
    const rutaClave = path.join(dir(nombre), P.NOMBRE_CLAVE_PRIVADA);
    const r = P.generarClave({ rutaClave });
    expect(r.estado).toBe('creada');
    return { rutaClave, rutaPub: r.publica, huella: r.huella };
}
/** Un origen con la forma del proyecto `area`: sus raices son otras (marketplace, casa, conocimiento, programas). */
const V1_AREA = {
    'marketplace/.claude-plugin/marketplace.json': '{"name":"barack","plugins":[]}\n',
    'casa/CLAUDE.md': '# reglas de la casa\n',
    'conocimiento/comun/donde-vive.md': '- BOM: en el arb.\n',
    'programas/util.mjs': 'export const x = 1;\n',
};
const LISTA_AREA = { formato: 1, proyecto: 'area', incluir: [{ ruta: 'marketplace' }, { ruta: 'casa' }, { ruta: 'conocimiento/comun', opcional: true }, { ruta: 'programas' }], excluir_nombres: ['__pycache__'], excluir_sufijos: ['.pyc', '.fak-nueva'] };
const leerVersion = (nube) => JSON.parse(leer(nube, 'VERSION.json'));
const escribirVersion = (nube, v) => fs.writeFileSync(path.join(nube, 'VERSION.json'), P.jsonCanonico(v));
/** Vuelve a firmar el MANIFIESTO.json que hay en la nube con OTRA clave y deja VERSION.json coherente (lo que haria un atacante con escritura). */
function refirmar(nube, rutaClavePrivada) {
    const bytes = fs.readFileSync(path.join(nube, 'MANIFIESTO.json'));
    const { texto, huella } = P.firmarManifiesto(bytes, P.leerClavePrivada(rutaClavePrivada).clave);
    fs.writeFileSync(path.join(nube, 'MANIFIESTO.sig'), texto);
    const v = leerVersion(nube);
    v.manifest_sha256 = P.sha256(bytes);
    v.firma = { algoritmo: 'ed25519', sha256: P.sha256(texto), clave: huella };
    escribirVersion(nube, v);
}
const medido = (que, ms) => console.log(`[medido] ${que}: ${ms.toFixed(2)} ms`);

// ---------------------------------------------------------------------------------------------
describe('firma del manifiesto (Ed25519)', () => {
    it('generarClave crea el par, deja publicador.pub al lado y se NIEGA a pisar una clave existente', () => {
        const { rutaClave, rutaPub } = claves();
        expect(fs.existsSync(rutaClave)).toBe(true);
        expect(fs.existsSync(rutaPub)).toBe(true);
        expect(P.leerClavePrivada(rutaClave).clave.asymmetricKeyType).toBe('ed25519');
        expect(P.leerClavePublica(rutaPub).clave.asymmetricKeyType).toBe('ed25519');
        const antes = { k: P.sha256Archivo(rutaClave), p: P.sha256Archivo(rutaPub) };
        const otra = P.generarClave({ rutaClave });
        expect(otra.estado).toBe('existe');
        expect(otra.errores.join(' ')).toContain('no se pisa');
        expect(P.sha256Archivo(rutaClave)).toBe(antes.k);
        expect(P.sha256Archivo(rutaPub)).toBe(antes.p);
    });

    it('--publicar con clave firma: MANIFIESTO.sig verifica el manifiesto, VERSION.json lleva el hash de la firma y el historial la guarda', () => {
        const { rutaClave, rutaPub, huella } = claves();
        const origen = armarOrigen();
        const nube = dir('nube');
        const r = pub(origen, nube, LISTA, { clavePrivada: rutaClave });
        expect(r.estado).toBe('publicado');
        expect(r.firmada).toBe(true);
        expect(r.ms_firma).toBeGreaterThan(0);
        medido('firmar el manifiesto', r.ms_firma);
        const v = leerVersion(nube);
        expect(v.firma).toMatchObject({ algoritmo: 'ed25519', sha256: P.sha256Archivo(path.join(nube, 'MANIFIESTO.sig')), clave: huella });
        const t0 = process.hrtime.bigint();
        const ver = P.verificarFirma({ nube, bytesManifiesto: fs.readFileSync(path.join(nube, 'MANIFIESTO.json')), clavePublica: P.leerClavePublica(rutaPub).clave, infoVersion: v });
        medido('verificar la firma', Number(process.hrtime.bigint() - t0) / 1e6);
        expect(ver.estado).toBe('valida');
        expect(existe(nube, 'historial/v1/MANIFIESTO.sig')).toBe(true);
        expect(leer(nube, 'historial/v1/MANIFIESTO.sig')).toBe(leer(nube, 'MANIFIESTO.sig'));
        // la clave privada no viajo a la nube
        expect(JSON.stringify(foto(nube))).not.toContain('publicador.key');
    });

    it('la firma se escribe ANTES de VERSION.json: si la escritura de VERSION falla, la firma del manifiesto ya esta y es de ese manifiesto', () => {
        const { rutaClave, rutaPub } = claves();
        const origen = armarOrigen();
        const nube = dir('nube');
        // un directorio no vacio donde tiene que ir VERSION.json: el rename final falla
        fs.mkdirSync(path.join(nube, 'VERSION.json'));
        fs.writeFileSync(path.join(nube, 'VERSION.json', 'traba'), 'x');
        const r = pub(origen, nube, LISTA, { clavePrivada: rutaClave });
        expect(r.estado).toBe('rechazado');
        expect(r.errores.join(' ')).toContain('se cortó la publicación');
        expect(existe(nube, 'MANIFIESTO.sig')).toBe(true);
        const ver = P.verificarFirma({ nube, bytesManifiesto: fs.readFileSync(path.join(nube, 'MANIFIESTO.json')), clavePublica: P.leerClavePublica(rutaPub).clave, infoVersion: null });
        expect(ver.estado).toBe('valida');
        expect(P.leerPublicacion(nube).estado).not.toBe('ok');   // sin VERSION valida nadie la toma
    });

    it('VERDE: una PC con la clave publica acepta la publicacion firmada y lo anota', () => {
        const { rutaClave, rutaPub } = claves();
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube, LISTA, { clavePrivada: rutaClave });
        const pc = dir('pc1');
        const r = act(pc, nube, { clavePublica: rutaPub });
        expect(r.estado).toBe('actualizado');
        expect(r.firma).toBe('valida');
        expect(r.contadores.nuevos).toBe(5);
        expect(JSON.parse(leer(pc, P.REL_INSTALADO)).firma).toBe('valida');
    });

    describe('ROJO: una PC con la clave publica no toca nada si la publicacion no esta bien firmada', () => {
        /** v1 firmada e instalada; v2 firmada publicada; despues se la estropea de una forma. */
        function v2Firmada() {
            const { rutaClave, rutaPub } = claves();
            const origen = armarOrigen();
            const nube = dir('nube');
            const pc = dir('pc1');
            expect(pub(origen, nube, LISTA, { clavePrivada: rutaClave }).estado).toBe('publicado');
            expect(act(pc, nube, { clavePublica: rutaPub }).estado).toBe('actualizado');
            esc(origen, '.claude/rules/regla.md', '# regla dos\n');
            expect(pub(origen, nube, LISTA, { clavePrivada: rutaClave, ahora: F(3) }).estado).toBe('publicado');
            return { rutaClave, rutaPub, origen, nube, pc };
        }
        const formas = {
            'publicada SIN firma (--sin-firma) cuando esta PC exige firma': ({ origen, nube }) => {
                esc(origen, '.claude/rules/regla.md', '# regla tres\n');
                expect(pub(origen, nube, LISTA, { sinFirma: true, ahora: F(4) }).estado).toBe('publicado');
                return 'sin_firma';
            },
            'firmada con OTRA clave (alguien con escritura trajo la suya)': ({ nube }) => { refirmar(nube, claves('otras').rutaClave); return 'otra_clave'; },
            'manifiesto TOCADO (un hash cambiado y VERSION.json rehecho, con la firma vieja)': ({ nube }) => {
                const malo = '# regla envenenada\n';
                esc(nube, 'contenido/.claude/rules/regla.md', malo);
                const man = JSON.parse(leer(nube, 'MANIFIESTO.json'));
                man.archivos['.claude/rules/regla.md'] = { sha256: P.sha256(malo), bytes: Buffer.byteLength(malo), areas: ['comun'] };
                const txt = P.jsonCanonico(man);
                fs.writeFileSync(path.join(nube, 'MANIFIESTO.json'), txt);
                const v = leerVersion(nube); v.manifest_sha256 = P.sha256(txt); escribirVersion(nube, v);
                return 'invalida';
            },
            'firma DAÑADA (un caracter cambiado, VERSION.json rehecho)': ({ nube }) => {
                const sig = JSON.parse(leer(nube, 'MANIFIESTO.sig'));
                sig.firma = (sig.firma[0] === 'A' ? 'B' : 'A') + sig.firma.slice(1);
                const txt = P.jsonCanonico(sig);
                fs.writeFileSync(path.join(nube, 'MANIFIESTO.sig'), txt);
                const v = leerVersion(nube); v.firma.sha256 = P.sha256(txt); escribirVersion(nube, v);
                return 'invalida';
            },
            'MANIFIESTO.sig ilegible (VERSION.json rehecho)': ({ nube }) => {
                fs.writeFileSync(path.join(nube, 'MANIFIESTO.sig'), 'esto no es una firma');
                const v = leerVersion(nube); v.firma.sha256 = P.sha256('esto no es una firma'); escribirVersion(nube, v);
                return 'ilegible';
            },
        };
        it.each(Object.keys(formas))('%s', (forma) => {
            const esc2 = v2Firmada();
            const esperado = formas[forma](esc2);
            const antes = foto(esc2.pc);
            const r = act(esc2.pc, esc2.nube, { clavePublica: esc2.rutaPub, ahora: F(5) });
            expect(r.estado).toBe('firma_rechazada');
            expect(r.firma).toBe(esperado);
            expect(r.mensaje).toContain('No se tocó nada');
            expect(foto(esc2.pc)).toEqual(antes);
            expect(leer(esc2.pc, '.claude/rules/regla.md')).toBe('# regla uno\n');
            // la salud cuenta el rechazo
            const salud = JSON.parse(leer(esc2.nube, `salud/${P.identidadLocal().pc}.json`));
            expect(salud.firma_ok).toBe(false);
            expect(salud.estado).toBe('firma_rechazada');
        });

        it('si MANIFIESTO.sig todavia no bajo (VERSION.json dice que hay firma) es ESPERAR, no rechazo', () => {
            const { nube, pc, rutaPub } = v2Firmada();
            fs.rmSync(path.join(nube, 'MANIFIESTO.sig'));
            const antes = foto(pc);
            const r = act(pc, nube, { clavePublica: rutaPub, ahora: F(5) });
            expect(r.estado).toBe('esperar');
            expect(r.mensaje).toContain('todavía no bajó');
            expect(foto(pc)).toEqual(antes);
        });

        it('la misma PC SIN clave publica acepta esas publicaciones y dice que no verifico la firma (compatibilidad)', () => {
            const esc2 = v2Firmada();
            refirmar(esc2.nube, claves('otras').rutaClave);
            const r = act(esc2.pc, esc2.nube, { ahora: F(5) });
            expect(r.estado).toBe('actualizado');
            expect(r.firma).toBe('no_verificada');
            expect(leer(esc2.pc, '.claude/rules/regla.md')).toBe('# regla dos\n');
        });

        it('una clave publica ilegible en la PC frena (no se "cae" a no verificar)', () => {
            const { nube, pc } = v2Firmada();
            const rota = esc(tmp, 'rota/publicador.pub', 'no soy una clave\n');
            const antes = foto(pc);
            const r = act(pc, nube, { clavePublica: rota, ahora: F(5) });
            expect(r.estado).toBe('error');
            expect(r.errores.join(' ')).toContain('clave pública');
            expect(foto(pc)).toEqual(antes);
        });
    });

    it('publicar sin clave cuando la version anterior estaba firmada se niega (salvo --sin-firma, que avisa)', () => {
        const { rutaClave } = claves();
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube, LISTA, { clavePrivada: rutaClave });
        esc(origen, '.claude/rules/regla.md', '# regla dos\n');
        const antes = foto(nube);
        const r = pub(origen, nube, LISTA, { ahora: F(3) });
        expect(r.estado).toBe('rechazado');
        expect(r.errores.join(' ')).toContain('estaba firmada');
        expect(foto(nube)).toEqual(antes);
        const r2 = pub(origen, nube, LISTA, { ahora: F(3), sinFirma: true });
        expect(r2.estado).toBe('publicado');
        expect(r2.firmada).toBe(false);
        expect(r2.avisos.join(' ')).toContain('SIN firma');
        expect(leerVersion(nube).firma).toBe(null);
    });

    it('una clave privada que no se entiende frena la publicacion sin escribir nada', () => {
        const rota = esc(tmp, 'rota/publicador.key', 'basura\n');
        const nube = dir('nube');
        const r = pub(armarOrigen(), nube, LISTA, { clavePrivada: rota });
        expect(r.estado).toBe('rechazado');
        expect(r.errores.join(' ')).toContain('no se entiende');
        expect(fs.readdirSync(nube)).toEqual([]);
    });

    it('buscarClavePublica: con CLAUDE_AREA_ESTADO mira SOLO ahi; sin la variable, programas y despues el usuario', () => {
        const estado = dir('estado');
        expect(P.buscarClavePublica({ CLAUDE_AREA_ESTADO: estado })).toBe(null);
        const p = esc(estado, 'publicador.pub', 'x');
        expect(P.buscarClavePublica({ CLAUDE_AREA_ESTADO: estado, ProgramFiles: dir('pf'), LOCALAPPDATA: dir('la') })).toBe(p);
        const pf = dir('pf'); const la = dir('la');
        expect(P.buscarClavePublica({ ProgramFiles: pf, LOCALAPPDATA: la })).toBe(null);
        const enLa = esc(la, 'BarackEquipo/publicador.pub', 'x');
        expect(P.buscarClavePublica({ ProgramFiles: pf, LOCALAPPDATA: la })).toBe(enLa);
        const enPf = esc(pf, 'Claude Barack/publicador.pub', 'x');
        expect(P.buscarClavePublica({ ProgramFiles: pf, LOCALAPPDATA: la })).toBe(enPf);
    });

    it('el pendrive lleva publicador.pub en la raiz (y nunca la clave privada)', () => {
        const { rutaClave } = claves();
        const origen = armarOrigen();
        const pendrive = dir('pendrive');
        for (const n of P.ARCHIVOS_PENDRIVE) esc(origen, `${P.REL_INSTALADOR}/${n}`, `${n}\n`);
        const r = P.armarPendrive({ origen, pendrive, lista: LISTA, identidad: NOIDENT, ahora: F(1), clavePrivada: rutaClave });
        expect(r.estado).toBe('listo');
        expect(r.copiados).toContain('publicador.pub');
        expect(r.publicacion.firmada).toBe(true);
        const todo = Object.keys(foto(pendrive));
        expect(todo).toContain('publicador.pub');
        expect(todo.some((k) => k.endsWith('publicador.key'))).toBe(false);
    });

    describe('linea de comandos', () => {
        const correr = (args, env = {}) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, CLAUDE_AREA_ESTADO: dir('estado-vacio'), ...env }, timeout: 60000 });
        it('--generar-clave crea una vez y la segunda sale con 1; --publicar firma; --actualizar verifica; una firma mala sale con 4', () => {
            const rutaClave = path.join(dir('claves'), 'publicador.key');
            const g = correr(['--generar-clave', '--clave', rutaClave]);
            expect(g.status, g.stdout + g.stderr).toBe(0);
            expect(g.stdout).toContain('Clave de firma creada');
            expect(correr(['--generar-clave', '--clave', rutaClave]).status).toBe(1);
            const origen = armarOrigen();
            const nube = dir('nube');
            const lista = esc(tmp, 'lista.json', JSON.stringify(LISTA));
            const p = correr(['--publicar', '--origen', origen, '--nube', nube, '--lista', lista, '--clave', rutaClave]);
            expect(p.status, p.stdout + p.stderr).toBe(0);
            expect(p.stdout).toMatch(/firmada \([\d.]+ ms\)/);
            const pc = dir('pc1');
            const rutaPub = path.join(path.dirname(rutaClave), 'publicador.pub');
            const a = correr(['--actualizar', '--destino', pc, '--nube', nube, '--clave-publica', rutaPub]);
            expect(a.status, a.stdout + a.stderr).toBe(0);
            expect(a.stdout).toContain('firma verificada');
            // la clave publica tambien se encuentra sola en CLAUDE_AREA_ESTADO
            const estado = dir('estado');
            fs.copyFileSync(rutaPub, path.join(estado, 'publicador.pub'));
            expect(correr(['--actualizar', '--destino', pc, '--nube', nube], { CLAUDE_AREA_ESTADO: estado }).stdout).toContain('firma verificada');
            // atacante: otra clave
            refirmar(nube, claves('otras').rutaClave);
            const mala = correr(['--actualizar', '--destino', pc, '--nube', nube, '--clave-publica', rutaPub]);
            expect(mala.status).toBe(P.CODIGO_SALIDA_FIRMA);
            expect(mala.stderr).toContain('No se tocó nada');
            // sin clave publica: pasa, y lo dice
            const sin = correr(['--actualizar', '--destino', pc, '--nube', nube]);
            expect(sin.status, sin.stdout + sin.stderr).toBe(0);
            expect(sin.stdout).toContain('no tiene la clave pública');
        });
    });
});

// ---------------------------------------------------------------------------------------------
describe('historial y volver atras (--rollback)', () => {
    /** v1 y v2 publicadas (firmadas) y la PC en la v2. */
    function dosVersiones() {
        const { rutaClave, rutaPub } = claves();
        const origen = armarOrigen();
        const nube = dir('nube');
        const pc = dir('pc1');
        expect(pub(origen, nube, LISTA, { clavePrivada: rutaClave }).version).toBe(1);
        esc(origen, 'scripts/util.mjs', 'export const x = 2;\n');
        esc(origen, 'scripts/nuevo.mjs', 'export const z = 1;\n');
        expect(pub(origen, nube, LISTA2, { clavePrivada: rutaClave, ahora: F(2) }).version).toBe(2);
        expect(act(pc, nube, { clavePublica: rutaPub, ahora: F(3) }).estado).toBe('actualizado');
        expect(leer(pc, 'scripts/util.mjs')).toBe('export const x = 2;\n');
        return { rutaClave, rutaPub, origen, nube, pc };
    }

    it('de punta a punta: v1, v2, la PC en v2, rollback a v1 (sale como v3, firmada) y la PC queda con el contenido de v1', () => {
        const { rutaClave, rutaPub, nube, pc } = dosVersiones();
        const r = P.publicar({ origen: dir('origen'), nube, lista: null, rollback: 1, clavePrivada: rutaClave, identidad: NOIDENT, ahora: F(4) });
        expect(r.errores).toEqual([]);
        expect(r.estado).toBe('publicado');
        expect(r.version).toBe(3);
        expect(r.firmada).toBe(true);
        expect(r.rollback).toBe(1);
        expect(r.retirados).toEqual(['scripts/nuevo.mjs']);
        expect(leer(nube, 'contenido/scripts/util.mjs')).toBe(V1['scripts/util.mjs']);
        expect(leer(nube, 'NOVEDADES.md')).toContain('Se volvió a la versión 1');
        const man = JSON.parse(leer(nube, 'MANIFIESTO.json'));
        expect(man.version).toBe(3);
        expect(man.lapidas).toEqual([{ ruta: 'scripts/nuevo.mjs', desde_version: 3, motivo: 'no estaba en la versión 1', sha256: P.sha256('export const z = 1;\n') }]);
        const t0 = process.hrtime.bigint();
        const a = act(pc, nube, { clavePublica: rutaPub, ahora: F(5) });
        medido('actualizar la PC (rollback, 5 archivos + 1 cuarentena)', Number(process.hrtime.bigint() - t0) / 1e6);
        expect(a.estado).toBe('actualizado');
        expect(a.firma).toBe('valida');
        expect(leer(pc, 'scripts/util.mjs')).toBe(V1['scripts/util.mjs']);
        expect(JSON.parse(leer(pc, P.REL_INSTALADO)).version).toBe(3);
        // lo que no estaba en la v1 se fue a cuarentena (estaba identico a lo publicado), no se borro
        expect(existe(pc, 'scripts/nuevo.mjs')).toBe(false);
        expect(a.cuarentena).toEqual(['scripts/nuevo.mjs']);
        expect(fs.readFileSync(path.join(a.carpetaCuarentena, 'scripts', 'nuevo.mjs'), 'utf8')).toBe('export const z = 1;\n');
        expect(existe(nube, 'historial/v3/MANIFIESTO.json')).toBe(true);
    });

    it('el historial guarda cada version y el contenido una sola vez por hash', () => {
        const { nube } = dosVersiones();
        expect(existe(nube, 'historial/v1/MANIFIESTO.json')).toBe(true);
        expect(existe(nube, 'historial/v2/MANIFIESTO.json')).toBe(true);
        expect(JSON.parse(leer(nube, 'historial/v1/MANIFIESTO.json')).version).toBe(1);
        const objetos = Object.keys(foto(path.join(nube, 'historial', '_objetos')));
        // v1: 5 archivos; v2: cambia 1 y agrega 1 -> 7 contenidos distintos, no 11
        expect(objetos).toHaveLength(7);
        for (const o of objetos) expect(path.basename(o)).toBe(P.sha256Archivo(path.join(nube, 'historial', '_objetos', ...o.split('/'))));
    });

    it('ROJO: rollback a una version que no existe, a un numero invalido, o con el historial dañado: no se escribe nada', () => {
        const { rutaClave, nube } = dosVersiones();
        const antes = foto(nube);
        const intentar = (rollback) => P.publicar({ origen: dir('origen'), nube, lista: null, rollback, clavePrivada: rutaClave, identidad: NOIDENT, ahora: F(4) });
        expect(intentar(9).errores.join(' ')).toContain('no hay una version 9');
        expect(intentar(0).errores.join(' ')).toContain('--rollback necesita');
        expect(intentar(NaN).estado).toBe('rechazado');
        expect(foto(nube)).toEqual(antes);
        // un objeto del historial corrompido
        const h1 = JSON.parse(leer(nube, 'historial/v1/MANIFIESTO.json'));
        const sha = h1.archivos['scripts/util.mjs'].sha256;
        const obj = path.join(nube, 'historial', '_objetos', sha.slice(0, 2), sha);
        const original = fs.readFileSync(obj);
        fs.writeFileSync(obj, 'export const x = 9;\n');   // mismo tamaño, otro contenido
        const r = intentar(1);
        expect(r.estado).toBe('rechazado');
        expect(r.errores.join(' ')).toContain('no coincide con su hash');
        fs.writeFileSync(obj, original);
        // un manifiesto del historial con una ruta que se sale
        esc(nube, 'historial/v7/MANIFIESTO.json', JSON.stringify({ formato: 1, version: 7, archivos: { '../fuera.txt': { sha256: 'a'.repeat(64), bytes: 1 } } }));
        expect(intentar(7).errores.join(' ')).toContain('no se aceptan');
        expect(Object.keys(foto(nube)).filter((k) => !k.startsWith('historial/v7/'))).toEqual(Object.keys(antes));
        expect(leerVersion(nube).version).toBe(2);
    });

    it('--rollback --simular cuenta y no escribe; por linea de comandos un --rollback sin numero sale con 1', () => {
        const { rutaClave, nube } = dosVersiones();
        const antes = foto(nube);
        const r = P.publicar({ origen: dir('origen'), nube, lista: null, rollback: 1, clavePrivada: rutaClave, identidad: NOIDENT, ahora: F(4), simular: true });
        expect(r.estado).toBe('simulado');
        expect(r.version).toBe(3);
        expect(r.retirados).toEqual(['scripts/nuevo.mjs']);
        expect(foto(nube)).toEqual(antes);
        const cli = spawnSync(process.execPath, [SCRIPT, '--publicar', '--rollback', 'uno', '--nube', nube, '--clave', rutaClave], { encoding: 'utf8', timeout: 60000 });
        expect(cli.status).toBe(1);
        expect(cli.stderr).toContain('--rollback necesita');
        const ok = spawnSync(process.execPath, [SCRIPT, '--publicar', '--rollback', '1', '--nube', nube, '--clave', rutaClave], { encoding: 'utf8', timeout: 60000 });
        expect(ok.status, ok.stdout + ok.stderr).toBe(0);
        expect(ok.stdout).toContain('Vuelta a la versión 1');
        expect(leerVersion(nube).version).toBe(3);
    });
});

// ---------------------------------------------------------------------------------------------
describe('lapidas: retirar algo ya publicado (nada se borra)', () => {
    const SIN_DATO = { ...LISTA, incluir: LISTA.incluir.filter((e) => !e.ruta.includes('dato.json')) };
    const REL = 'scripts/_lib/dato.json';
    const enCuarentena = (pc) => Object.keys(foto(path.join(pc, ...P.REL_CUARENTENA.split('/'))));

    it('al sacar un archivo de la lista el manifiesto lleva su lapida (ruta, desde_version, motivo, hash publicado)', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube);
        const r = pub(origen, nube, SIN_DATO, { ahora: F(2), motivoRetiro: 'decía un procedimiento viejo' });
        expect(r.estado).toBe('publicado');
        expect(r.lapidas).toBe(1);
        const man = JSON.parse(leer(nube, 'MANIFIESTO.json'));
        expect(man.lapidas).toEqual([{ ruta: REL, desde_version: 2, motivo: 'decía un procedimiento viejo', sha256: P.sha256(V1[REL]) }]);
        expect(leerVersion(nube).lapidas).toBe(1);
        expect(existe(nube, `contenido/${REL}`)).toBe(true);   // en la nube no se borra
    });

    it('VERDE: en la PC el archivo IDENTICO a lo publicado se MUEVE a cuarentena con fecha (contenido igual, nada mas cambia)', () => {
        const { origen, nube, pc } = escenarioInstalado();
        esc(pc, `${REL}${P.SUFIJO_NUEVA}`, 'una nueva que quedo\n');
        pub(origen, nube, SIN_DATO, { ahora: F(2) });
        const antes = foto(pc);
        const r = act(pc, nube, { ahora: F(3, 8) });
        expect(r.estado).toBe('actualizado');
        expect(r.cuarentena).toEqual([REL]);
        expect(r.contadores.cuarentena).toBe(1);
        expect(r.retiradosTuyos).toEqual([]);
        expect(r.retirados).toEqual([]);
        const carpeta = path.join(pc, ...P.REL_CUARENTENA.split('/'), P.selloCarpeta(F(3, 8)));
        expect(r.carpetaCuarentena).toBe(carpeta);
        expect(fs.readFileSync(path.join(carpeta, 'scripts', '_lib', 'dato.json'), 'utf8')).toBe(V1[REL]);
        expect(fs.readFileSync(path.join(carpeta, 'scripts', '_lib', `dato.json${P.SUFIJO_NUEVA}`), 'utf8')).toBe('una nueva que quedo\n');
        expect(existe(pc, REL)).toBe(false);
        expect(existe(pc, `${REL}${P.SUFIJO_NUEVA}`)).toBe(false);
        // todo lo demas sigue igual, y el registro ya no lo tiene
        const despues = foto(pc);
        for (const k of Object.keys(antes)) if (k !== REL && k !== `${REL}${P.SUFIJO_NUEVA}` && k !== P.REL_INSTALADO) expect(despues[k], k).toBe(antes[k]);
        expect(JSON.parse(leer(pc, P.REL_INSTALADO)).archivos).not.toHaveProperty([REL]);
        expect(act(pc, nube, { ahora: F(4) }).estado).toBe('al_dia');
    });

    it('ROJO: si la persona lo habia cambiado, se queda donde esta y se anota en pendientes', () => {
        const { origen, nube, pc } = escenarioInstalado();
        esc(pc, REL, '{"a":1,"mio":true}\n');
        pub(origen, nube, SIN_DATO, { ahora: F(2) });
        const r = act(pc, nube, { ahora: F(3) });
        expect(r.estado).toBe('actualizado');
        expect(r.cuarentena).toEqual([]);
        expect(r.retiradosTuyos).toEqual([REL]);
        expect(leer(pc, REL)).toBe('{"a":1,"mio":true}\n');
        expect(enCuarentena(pc)).toEqual([]);
        expect(leer(pc, P.REL_PENDIENTES)).toContain('los habías cambiado');
        expect(leer(pc, P.REL_PENDIENTES)).toContain(`\`${REL}\``);
    });

    it('un archivo que la PC nunca recibio de la base no se nombra; salvo que sea igual a lo publicado, que entonces si va a cuarentena', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube);
        pub(origen, nube, SIN_DATO, { ahora: F(2) });
        const propia = dir('pc-propia');
        esc(propia, REL, '{"mio":1}\n');
        const r1 = act(propia, nube, { ahora: F(3) });
        expect(r1.estado).toBe('actualizado');
        expect(r1.cuarentena).toEqual([]);
        expect(r1.retiradosTuyos).toEqual([]);
        expect(leer(propia, REL)).toBe('{"mio":1}\n');
        const copiada = dir('pc-copiada');
        esc(copiada, REL, V1[REL]);
        const r2 = act(copiada, nube, { ahora: F(3) });
        expect(r2.cuarentena).toEqual([REL]);
        expect(existe(copiada, REL)).toBe(false);
    });

    it('la lapida se hereda: una PC que se salto la v2 la aplica al pasar a la v3; y si el archivo vuelve a la lista, la lapida se levanta', () => {
        const { origen, nube, pc } = escenarioInstalado();
        pub(origen, nube, SIN_DATO, { ahora: F(2) });
        esc(origen, '.claude/rules/regla.md', '# regla dos\n');
        pub(origen, nube, SIN_DATO, { ahora: F(3) });
        expect(JSON.parse(leer(nube, 'MANIFIESTO.json')).lapidas.map((l) => l.desde_version)).toEqual([2]);
        const r = act(pc, nube, { ahora: F(4) });
        expect(r.version).toBe(3);
        expect(r.cuarentena).toEqual([REL]);
        // vuelve a la lista: sin lapida, y la PC lo recibe como nuevo (lo de cuarentena no se toca)
        const r4 = pub(origen, nube, LISTA, { ahora: F(5) });
        expect(r4.estado).toBe('publicado');
        expect(JSON.parse(leer(nube, 'MANIFIESTO.json')).lapidas).toEqual([]);
        const a = act(pc, nube, { ahora: F(6) });
        expect(a.contadores.nuevos).toBe(1);
        expect(leer(pc, REL)).toBe(V1[REL]);
        expect(enCuarentena(pc)).toHaveLength(1);
    });

    it('ROJO: una lapida con una ruta que se sale, que pisaria la configuracion o que tambien figura como archivo, invalida el manifiesto y no se toca nada', () => {
        const { nube, pc } = escenarioInstalado();
        const limpio = JSON.parse(leer(nube, 'MANIFIESTO.json'));
        const antes = foto(pc);
        const casos = [
            [{ ruta: '../fuera.txt', desde_version: 2 }, 'fuera.txt'],
            [{ ruta: '.claude/settings.json', desde_version: 2 }, 'settings.json'],
            [{ ruta: 'scripts/util.mjs', desde_version: 2 }, 'tambien figura'],
            [{ ruta: 'scripts/_lib/dato.json', desde_version: 'dos' }, 'datos invalidos'],
        ];
        for (const [lapida, texto] of casos) {
            const man = { ...limpio, version: 2, lapidas: [lapida] };
            if (lapida.ruta === 'scripts/_lib/dato.json') delete man.archivos['scripts/_lib/dato.json'];
            firmar(nube, man);
            const r = act(pc, nube, { ahora: F(4) });
            expect(r.estado, texto).toBe('error');
            expect(r.errores.join(' '), texto).toContain(texto);
            expect(foto(pc), texto).toEqual(antes);
        }
        expect(existe(tmp, 'fuera.txt')).toBe(false);
    });

    it('--simular muestra el plan de cuarentena (origen -> destino) y no mueve nada', () => {
        const { origen, nube, pc } = escenarioInstalado();
        pub(origen, nube, SIN_DATO, { ahora: F(2) });
        const antes = foto(pc);
        const r = act(pc, nube, { ahora: F(3), simular: true });
        expect(r.estado).toBe('simulado');
        expect(r.plan.filter((p) => p.que === 'cuarentena').map((p) => p.rel)).toEqual([REL]);
        expect(r.carpetaCuarentena).toContain('_cuarentena-paquete');
        expect(foto(pc)).toEqual(antes);
        const cli = spawnSync(process.execPath, [SCRIPT, '--actualizar', '--simular', '--destino', pc, '--nube', nube], { encoding: 'utf8', env: { ...process.env, CLAUDE_AREA_ESTADO: dir('estado-vacio') }, timeout: 60000 });
        expect(cli.status, cli.stdout + cli.stderr).toBe(0);
        expect(cli.stdout).toContain('Pasarían a cuarentena');
        expect(cli.stdout).toMatch(/scripts\/_lib\/dato\.json {2}-> {2}.*_cuarentena-paquete/);
        expect(foto(pc)).toEqual(antes);
    });
});

// ---------------------------------------------------------------------------------------------
describe('areas: cada PC instala lo comun mas lo de su area', () => {
    const LISTA_AREAS = {
        ...LISTA,
        incluir: [
            { ruta: '.claude/skills/docs-x' },                                     // sin areas = comun
            { ruta: '.claude/rules/regla.md', areas: ['calidad'] },
            { ruta: 'scripts/util.mjs', areas: ['logistica', 'calidad', 'calidad'] },
            { ruta: 'scripts/_lib/dato.json', areas: ['comun'] },
        ],
    };
    const instalados = (pc) => Object.keys(foto(pc)).filter((k) => !k.startsWith('.claude/.paquete') && !k.startsWith('.claude/paquete-') && k !== 'perfil.json' && k !== P.REL_PERFIL).sort();

    it('revisarLista acepta las areas del contrato y rechaza una desconocida o mal escrita', () => {
        expect(P.revisarLista(LISTA_AREAS)).toEqual([]);
        expect(P.revisarLista({ ...LISTA, incluir: [{ ruta: 'scripts/util.mjs', areas: ['ventas'] }] }).join(' ')).toContain('"ventas" no existe');
        expect(P.revisarLista({ ...LISTA, incluir: [{ ruta: 'scripts/util.mjs', areas: 'calidad' }] }).join(' ')).toContain('lista de nombres de area');
        expect(P.areasDeEntrada({ ruta: 'x', areas: ['Calidad', 'calidad', 'comun'] })).toEqual(['calidad', 'comun']);
        expect(P.areasDeEntrada({ ruta: 'x' })).toEqual(['comun']);
    });

    it('el manifiesto guarda las areas de cada archivo (ordenadas, sin repetir; sin areas = comun)', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        expect(pub(origen, nube, LISTA_AREAS).estado).toBe('publicado');
        const man = JSON.parse(leer(nube, 'MANIFIESTO.json')).archivos;
        expect(man['.claude/skills/docs-x/SKILL.md'].areas).toEqual(['comun']);
        expect(man['.claude/rules/regla.md'].areas).toEqual(['calidad']);
        expect(man['scripts/util.mjs'].areas).toEqual(['calidad', 'logistica']);
        expect(man['scripts/_lib/dato.json'].areas).toEqual(['comun']);
    });

    it('cada PC recibe lo comun mas lo suyo: calidad, logistica, sin area y "todas"', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube, LISTA_AREAS);
        const calidad = dir('pc-calidad');
        const rc = act(calidad, nube, { area: 'calidad' });
        expect(rc.estado).toBe('actualizado');
        expect(rc.area).toBe('calidad');
        expect(rc.contadores).toMatchObject({ nuevos: 5, fuera_de_area: 0 });
        const logistica = dir('pc-logistica');
        const rl = act(logistica, nube, { area: 'Logística' });
        expect(rl.contadores).toMatchObject({ nuevos: 4, fuera_de_area: 1 });
        expect(instalados(logistica)).toEqual(['.claude/skills/docs-x/SKILL.md', '.claude/skills/docs-x/ref/a.md', 'scripts/_lib/dato.json', 'scripts/util.mjs']);
        const sinArea = dir('pc-sin-area');
        const rs = act(sinArea, nube);
        expect(rs.area).toBe(null);
        expect(rs.contadores).toMatchObject({ nuevos: 3, fuera_de_area: 2 });
        expect(instalados(sinArea)).toEqual(['.claude/skills/docs-x/SKILL.md', '.claude/skills/docs-x/ref/a.md', 'scripts/_lib/dato.json']);
        const todas = dir('pc-todas');
        expect(act(todas, nube, { area: 'todas' }).contadores).toMatchObject({ nuevos: 5, fuera_de_area: 0 });
        // una segunda pasada en cada una: al dia (lo de otras areas no se vuelve a mirar)
        expect(act(logistica, nube, { area: 'logistica', ahora: F(3) }).estado).toBe('al_dia');
        expect(act(sinArea, nube, { ahora: F(3) }).estado).toBe('al_dia');
    });

    it('el area sale de perfil.json (CLAUDE_AREA_HOME, el destino, o el perfil de siempre) cuando no se pasa --area', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube, LISTA_AREAS);
        const home = dir('home-area');
        esc(home, 'perfil.json', JSON.stringify({ nombre: 'Marta', area: 'compras' }));
        expect(P.resolverArea({ destino: dir('x'), env: { CLAUDE_AREA_HOME: home } })).toMatchObject({ area: 'compras' });
        const pc = dir('pc');
        esc(pc, 'perfil.json', JSON.stringify({ area: 'calidad' }));
        expect(act(pc, nube, { env: {} }).contadores.nuevos).toBe(5);
        const pc2 = dir('pc2');
        esc(pc2, P.REL_PERFIL, JSON.stringify({ autor: 'Ana Perez - Logistica', area: 'logistica' }));
        expect(act(pc2, nube, { env: {} }).contadores.nuevos).toBe(4);
        expect(JSON.parse(leer(pc2, P.REL_INSTALADO)).area).toBe('logistica');
    });

    it('ROJO: un area que no existe (por --area o en el perfil) frena sin escribir nada', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube, LISTA_AREAS);
        const pc = dir('pc');
        const r = act(pc, nube, { area: 'ventas' });
        expect(r.estado).toBe('error');
        expect(r.errores.join(' ')).toContain('"ventas" no existe');
        expect(foto(pc)).toEqual({});
        esc(pc, 'perfil.json', JSON.stringify({ area: 'marketing' }));
        const r2 = act(pc, nube, { env: {} });
        expect(r2.estado).toBe('error');
        expect(r2.errores.join(' ')).toContain('"marketing"');
        expect(Object.keys(foto(pc))).toEqual(['perfil.json']);
    });

    it('cambiar solo el area de un archivo es una publicacion nueva; el archivo que deja de ser de mi area se queda y no se olvida', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube, LISTA_AREAS);
        const pc = dir('pc-logistica');
        act(pc, nube, { area: 'logistica' });
        const soloCalidad = { ...LISTA_AREAS, incluir: LISTA_AREAS.incluir.map((e) => (e.ruta === 'scripts/util.mjs' ? { ...e, areas: ['calidad'] } : e)) };
        const r = pub(origen, nube, soloCalidad, { ahora: F(2) });
        expect(r.estado).toBe('publicado');
        expect(r.areasCambiadas).toEqual(['scripts/util.mjs']);
        expect(r.cambiados).toEqual([]);
        const a = act(pc, nube, { area: 'logistica', ahora: F(3) });
        expect(a.estado).toBe('actualizado');
        expect(a.contadores.fuera_de_area).toBe(2);
        expect(a.retirados).toEqual([]);
        expect(a.cuarentena).toEqual([]);
        expect(leer(pc, 'scripts/util.mjs')).toBe(V1['scripts/util.mjs']);
        expect(JSON.parse(leer(pc, P.REL_INSTALADO)).archivos).toHaveProperty(['scripts/util.mjs']);
        expect(existe(pc, 'scripts/util.mjs.fak-nueva')).toBe(false);
    });

    it('por linea de comandos: --area y lo que dice la salida', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube, LISTA_AREAS);
        const pc = dir('pc');
        const r = spawnSync(process.execPath, [SCRIPT, '--actualizar', '--destino', pc, '--nube', nube, '--area', 'logistica'], { encoding: 'utf8', env: { ...process.env, CLAUDE_AREA_ESTADO: dir('estado-vacio') }, timeout: 60000 });
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain('4 nuevos');
        expect(r.stdout).toContain('1 de otras áreas (no se tocan)');
        expect(r.stdout).toContain('área logistica');
    });
});

// ---------------------------------------------------------------------------------------------
describe('--chequear: en milisegundos, ¿hay version nueva? (no verifica hashes ni copia)', () => {
    it('da los cinco estados y no escribe nada', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        const pc = dir('pc1');
        expect(P.chequear({ destino: pc, nube: null }).estado).toBe('sin_nube');
        expect(P.chequear({ destino: pc, nube: path.join(tmp, 'no-esta') }).estado).toBe('sin_nube');
        expect(P.chequear({ destino: pc, nube }).estado).toBe('nube_incompleta');
        pub(origen, nube);
        const sinInstalar = P.chequear({ destino: pc, nube });
        expect(sinInstalar).toMatchObject({ estado: 'sin_instalar', publicada: 1, instalada: null });
        act(pc, nube);
        const fotoPc = foto(pc);
        let fotoNube = foto(nube);
        const alDia = P.chequear({ destino: pc, nube });
        expect(alDia).toMatchObject({ estado: 'al_dia', publicada: 1, instalada: 1, firmada: false });
        medido('--chequear adentro (al_dia)', alDia.ms);
        expect(alDia.ms).toBeLessThan(50);
        expect(foto(nube)).toEqual(fotoNube);
        esc(origen, '.claude/rules/regla.md', '# regla dos\n');
        pub(origen, nube, LISTA, { ahora: F(3) });
        fotoNube = foto(nube);
        expect(P.chequear({ destino: pc, nube })).toMatchObject({ estado: 'hay_novedades', publicada: 2, instalada: 1 });
        expect(foto(nube)).toEqual(fotoNube);
        fs.writeFileSync(path.join(nube, 'VERSION.json'), '{"version": 2, "manifest_sh');
        expect(P.chequear({ destino: pc, nube }).estado).toBe('nube_incompleta');
        expect(foto(pc)).toEqual(fotoPc);
    });

    it('por linea de comandos: una linea JSON y los codigos 0 al_dia / 2 hay_novedades / 3 sin nube o incompleta / 5 sin instalar', () => {
        const correr = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, CLAUDE_AREA_ESTADO: dir('estado-vacio') }, timeout: 60000 });
        const origen = armarOrigen();
        const nube = dir('nube');
        const pc = dir('pc1');
        expect(correr(['--chequear', '--destino', pc, '--nube', path.join(tmp, 'no-esta')]).status).toBe(3);
        expect(correr(['--chequear', '--destino', pc, '--nube', nube]).status).toBe(3);
        pub(origen, nube);
        expect(correr(['--chequear', '--destino', pc, '--nube', nube]).status).toBe(5);
        act(pc, nube);
        const t0 = process.hrtime.bigint();
        const ok = correr(['--chequear', '--destino', pc, '--nube', nube]);
        medido('--chequear por linea de comandos, con el arranque de Node', Number(process.hrtime.bigint() - t0) / 1e6);
        expect(ok.status, ok.stdout + ok.stderr).toBe(0);
        const j = JSON.parse(ok.stdout.trim());
        expect(j).toMatchObject({ estado: 'al_dia', publicada: 1, instalada: 1 });
        expect(typeof j.ms).toBe('number');
        esc(origen, '.claude/rules/regla.md', '# regla dos\n');
        pub(origen, nube, LISTA, { ahora: F(3) });
        const nov = correr(['--chequear', '--destino', pc, '--nube', nube]);
        expect(nov.status).toBe(2);
        expect(JSON.parse(nov.stdout.trim()).estado).toBe('hay_novedades');
    });
});

// ---------------------------------------------------------------------------------------------
describe('salud: lo que cada PC deja en la nube al terminar --actualizar', () => {
    const CAMPOS = ['pc', 'usuario_windows', 'area', 'version_instalada', 'version_publicada_vista', 'ultima_sync_ok', 'firma_ok', 'politica', 'outlook', 'python', 've_Y', 've_Z', 'disco_libre_gb', 'errores', 'escrito'];
    const IDENT = { usuario: 'marta', pc: 'COMPRAS-02' };

    it('despues de actualizar bien: salud\\<pc>.json con los campos del contrato, atomico, y lo que no sabe en null', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube);
        const pc = dir('pc1');
        const r = act(pc, nube, { identidad: IDENT, area: 'compras' });
        expect(r.estado).toBe('actualizado');
        expect(r.salud).toBe(path.join(nube, 'salud', 'COMPRAS-02.json'));
        const s = JSON.parse(leer(nube, 'salud/COMPRAS-02.json'));
        for (const c of CAMPOS) expect(s, c).toHaveProperty(c);
        expect(s).toMatchObject({ pc: 'COMPRAS-02', usuario_windows: 'marta', area: 'compras', version_instalada: 1, version_publicada_vista: 1, ultima_sync_ok: P.isoLocal(F(2)), firma_ok: null, politica: null, outlook: null, python: null, ve_Y: null, ve_Z: null, disco_libre_gb: null, errores: [], estado: 'actualizado', escrito: P.isoLocal(F(2)) });
        expect(fs.readdirSync(path.join(nube, 'salud')).filter((n) => n.endsWith('.tmp'))).toEqual([]);
        // al dia: se vuelve a escribir (es la señal de vida)
        const r2 = act(pc, nube, { identidad: IDENT, area: 'compras', ahora: F(3) });
        expect(r2.estado).toBe('al_dia');
        expect(JSON.parse(leer(nube, 'salud/COMPRAS-02.json'))).toMatchObject({ estado: 'al_dia', ultima_sync_ok: P.isoLocal(F(3)) });
    });

    it('tambien cuando sale mal: nube a medias (esperar) y firma rechazada quedan contados, con el error adentro', () => {
        const { rutaClave, rutaPub } = claves();
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube, LISTA, { clavePrivada: rutaClave });
        const pc = dir('pc1');
        expect(act(pc, nube, { identidad: IDENT, clavePublica: rutaPub }).estado).toBe('actualizado');
        expect(JSON.parse(leer(nube, 'salud/COMPRAS-02.json')).firma_ok).toBe(true);
        esc(origen, '.claude/rules/regla.md', '# regla dos\n');
        pub(origen, nube, LISTA, { clavePrivada: rutaClave, ahora: F(3) });
        fs.rmSync(path.join(nube, 'contenido', '.claude', 'rules', 'regla.md'));
        const e = act(pc, nube, { identidad: IDENT, clavePublica: rutaPub, ahora: F(4) });
        expect(e.estado).toBe('esperar');
        const s = JSON.parse(leer(nube, 'salud/COMPRAS-02.json'));
        expect(s).toMatchObject({ estado: 'esperar', version_instalada: 1, version_publicada_vista: 2, ultima_sync_ok: P.isoLocal(F(2)) });
        // la espera por OneDrive es normal: va en `mensaje`, y `errores` queda vacio para que el tablero no la pinte de rojo
        expect(s.errores).toEqual([]);
        expect(s.mensaje).toContain('OneDrive');
        refirmar(nube, claves('otras').rutaClave);
        esc(nube, 'contenido/.claude/rules/regla.md', '# regla dos\n');
        expect(act(pc, nube, { identidad: IDENT, clavePublica: rutaPub, ahora: F(5) }).estado).toBe('firma_rechazada');
        expect(JSON.parse(leer(nube, 'salud/COMPRAS-02.json'))).toMatchObject({ estado: 'firma_rechazada', firma_ok: false });
    });

    it('NO se escribe con --simular, sin nube, ni desde la PC de origen; y si la nube no deja escribir, es un aviso y no un error', () => {
        const origen = armarOrigen();
        const nube = dir('nube');
        pub(origen, nube);
        const pc = dir('pc1');
        act(pc, nube, { identidad: IDENT, simular: true });
        expect(existe(nube, 'salud')).toBe(false);
        expect(act(pc, null, { identidad: IDENT }).salud).toBeUndefined();
        esc(origen, P.REL_LISTA, '{}');
        expect(act(origen, nube, { identidad: IDENT }).estado).toBe('error');
        expect(existe(nube, 'salud')).toBe(false);
        // un archivo donde tiene que ir la carpeta salud: no se puede escribir
        fs.writeFileSync(path.join(nube, 'salud'), 'ocupado');
        const r = act(pc, nube, { identidad: IDENT });
        expect(r.estado).toBe('actualizado');
        expect(r.avisos.join(' ')).toContain('salud');
    });
});

// ---------------------------------------------------------------------------------------------
describe('la carpeta de la nube por proyecto: la de siempre por defecto, CLAUDE POR AREA\\1- PUBLICADO con --proyecto area', () => {
    it('buscarNube: por defecto Base Claude Ingenieria; con "area", CLAUDE POR AREA\\1- PUBLICADO (si existe la carpeta madre); nada se inventa', () => {
        const home = dir('home');
        const vieja = dir('home', 'BARACK ARGENTINA SRL', 'Ingeniería y Proyecto - General', 'Base Claude Ingenieria');
        expect(P.buscarNube(home)).toBe(vieja);
        expect(P.buscarNube(home, 'area')).toBe(null);
        const madre = dir('home', 'BARACK ARGENTINA SRL', 'Ingeniería y Proyecto - General', 'CLAUDE POR AREA');
        expect(P.buscarNube(home, 'area')).toBe(path.join(madre, '1- PUBLICADO'));
        expect(P.buscarNube(home, 'otro')).toBe(null);
        expect(P.nombreNube()).toBe('Base Claude Ingenieria');
        expect(P.nombreNube('area')).toBe('CLAUDE POR AREA\\1- PUBLICADO');
        expect(P.carpetaBuzon(path.join(madre, '1- PUBLICADO'))).toBe(path.join(madre, '4- BUZON'));
        expect(P.carpetaBuzon(vieja)).toBe(vieja);
    });

    it('publicar crea 1- PUBLICADO si falta (su carpeta madre existe); la de siempre sigue sin inventarse; en areas sin clave no publica', () => {
        const origen = armarOrigen(V1_AREA);
        const madre = dir('CLAUDE POR AREA');
        const nube = path.join(madre, '1- PUBLICADO');
        const { rutaClave } = claves();
        const sim = pub(origen, nube, LISTA_AREA, { simular: true, clavePrivada: rutaClave, proyecto: 'area' });
        expect(sim.errores).toEqual([]);
        expect(sim.estado).toBe('simulado');
        expect(fs.existsSync(nube)).toBe(false);
        // sin clave privada, en el proyecto de areas no se publica (ninguna PC lo aceptaria); con --sin-firma explicito si
        const sinClave = pub(origen, nube, LISTA_AREA, { proyecto: 'area' });
        expect(sinClave.estado).toBe('rechazado');
        expect(sinClave.errores.join(' ')).toContain('toda publicación va firmada');
        expect(fs.existsSync(nube)).toBe(false);
        const r = pub(origen, nube, LISTA_AREA, { proyecto: 'area', clavePrivada: rutaClave });
        expect(r.estado).toBe('publicado');
        expect(r.firmada).toBe(true);
        expect(P.leerPublicacion(nube).estado).toBe('ok');
        const otra = pub(origen, path.join(tmp, 'Base Claude Ingenieria'), LISTA);
        expect(otra.estado).toBe('rechazado');
        expect(otra.errores.join(' ')).toContain('no existe');
        expect(pub(origen, path.join(tmp, 'sin-madre', '1- PUBLICADO'), LISTA).estado).toBe('rechazado');
    });

    it('en la estructura de areas, salud y aportes van a 4- BUZON (hermana de 1- PUBLICADO)', () => {
        const origen = armarOrigen(V1_AREA);
        const madre = dir('CLAUDE POR AREA');
        const nube = path.join(madre, '1- PUBLICADO');
        const { rutaClave, rutaPub } = claves();
        expect(pub(origen, nube, LISTA_AREA, { proyecto: 'area', clavePrivada: rutaClave }).estado).toBe('publicado');
        const pc = dir('pc1');
        const r = act(pc, nube, { identidad: { usuario: 'u', pc: 'PC-01' }, clavePublica: rutaPub });
        expect(r.estado).toBe('actualizado');
        expect(r.salud).toBe(path.join(madre, '4- BUZON', 'salud', 'PC-01.json'));
        expect(fs.existsSync(path.join(nube, 'salud'))).toBe(false);
        esc(pc, 'scripts/mio.py', 'print(1)\n');
        const ap = P.aportar({ ruta: path.join(pc, 'scripts', 'mio.py'), autor: 'Ana Maria Perez - Compras', que: 'x', nube, destino: pc, identidad: NOIDENT, ahora: F(1) });
        expect(ap.estado).toBe('aportado');
        expect(ap.carpeta.startsWith(path.join(madre, '4- BUZON', 'aportes'))).toBe(true);
        expect(P.listarAportes({ nube })).toHaveLength(1);
    });

    it('resolverEntorno: CLAUDE_AREA_NUBE/HOME/CLAVE/ESTADO del contrato; --nube, --destino y --clave le ganan', () => {
        const raiz = dir('raiz');
        const vacio = { USERPROFILE: dir('casa') };
        const porDefecto = P.resolverEntorno({}, vacio, raiz);
        expect(porDefecto).toMatchObject({ proyecto: 'ingenieria', nube: null, origen: raiz, destino: raiz, clavePublica: null });
        expect(porDefecto.clavePrivada).toBe(path.join(vacio.USERPROFILE, '.claude-area', 'publicador.key'));
        const nubeArea = dir('nube area');
        const home = dir('home pc');
        const estado = dir('estado');
        const pubKey = esc(estado, 'publicador.pub', 'x');
        const env = { CLAUDE_AREA_NUBE: nubeArea, CLAUDE_AREA_HOME: home, CLAUDE_AREA_CLAVE: path.join(tmp, 'k', 'publicador.key'), CLAUDE_AREA_ESTADO: estado };
        const area = P.resolverEntorno({}, env, raiz);
        expect(area).toMatchObject({ proyecto: 'area', nube: path.join(nubeArea, '1- PUBLICADO'), destino: path.join(home, 'publicado'), clavePrivada: path.join(tmp, 'k', 'publicador.key'), clavePublica: pubKey });
        const manual = P.resolverEntorno({ nube: dir('otra'), destino: dir('dest'), clave: path.join(tmp, 'c.key'), 'clave-publica': path.join(tmp, 'c.pub'), proyecto: 'ingenieria' }, env, raiz);
        expect(manual).toMatchObject({ proyecto: 'ingenieria', nube: dir('otra'), destino: dir('dest'), clavePrivada: path.join(tmp, 'c.key'), clavePublica: path.join(tmp, 'c.pub') });
        expect(P.resolverEntorno({ proyecto: 'ventas' }, env, raiz).error).toContain('--proyecto');
    });

    // -----------------------------------------------------------------------------------------
    // Revision del coordinador (01/10): en el proyecto `area` una PC SIN clave publica no instala nada.
    // -----------------------------------------------------------------------------------------
    describe('proyecto area: la PC tiene que poder comprobar quien publico', () => {
        /** Una nube `CLAUDE POR AREA\1- PUBLICADO` con la v1 publicada (firmada salvo que se pida lo contrario). */
        function nubeDeArea({ firmada = true } = {}) {
            const { rutaClave, rutaPub } = claves();
            const madre = dir('CLAUDE POR AREA');
            const nube = path.join(madre, '1- PUBLICADO');
            const origen = armarOrigen(V1_AREA);
            const r = pub(origen, nube, LISTA_AREA, firmada ? { proyecto: 'area', clavePrivada: rutaClave } : { proyecto: 'area', sinFirma: true });
            expect(r.errores).toEqual([]);
            expect(r.estado).toBe('publicado');
            return { rutaClave, rutaPub, madre, nube, origen };
        }

        it('VERDE: con la clave publica instala. ROJO: sin clave no toca nada, lo dice en una linea y la salud queda en rojo', () => {
            const { rutaPub, madre, nube } = nubeDeArea();
            const conClave = act(dir('pc-con-clave'), nube, { clavePublica: rutaPub, identidad: { usuario: 'u', pc: 'CON-CLAVE' } });
            expect(conClave).toMatchObject({ estado: 'actualizado', firma: 'valida' });
            const sinClave = dir('pc-sin-clave');
            const r = act(sinClave, nube, { identidad: { usuario: 'u', pc: 'SIN-CLAVE' } });
            expect(r.estado).toBe('sin_clave');
            expect(r.firma).toBe('sin_clave');
            expect(r.mensaje).toContain('le falta la clave');
            expect(r.mensaje).toContain('Avisale al administrador');
            expect(foto(sinClave)).toEqual({});
            const s = JSON.parse(fs.readFileSync(path.join(madre, '4- BUZON', 'salud', 'SIN-CLAVE.json'), 'utf8'));
            expect(s).toMatchObject({ estado: 'sin_clave', firma_ok: false, version_instalada: 0 });
            expect(s.errores).toHaveLength(1);
            // tambien si la nube se llama de otra forma pero se pidio el proyecto area; y en el proyecto de siempre sigue entrando (compatibilidad)
            const { rutaClave: otraClave } = claves('otras');
            const otraNube = dir('nube-cualquiera');
            expect(pub(armarOrigen(), otraNube, LISTA, { clavePrivada: otraClave }).estado).toBe('publicado');
            expect(act(dir('pc3'), otraNube, { proyecto: 'area' }).estado).toBe('sin_clave');
            expect(act(dir('pc4'), otraNube).estado).toBe('actualizado');
            expect(P.exigeFirma({ nube, proyecto: 'ingenieria' })).toBe(true);
            expect(P.exigeFirma({ nube: otraNube, proyecto: 'ingenieria' })).toBe(false);
        });

        it('una nube de area publicada SIN firma (--sin-firma) no entra en ninguna PC: sin clave es sin_clave, con clave es sin_firma', () => {
            const { rutaPub, nube } = nubeDeArea({ firmada: false });
            expect(act(dir('pc1'), nube).estado).toBe('sin_clave');
            const r = act(dir('pc2'), nube, { clavePublica: rutaPub });
            expect(r.estado).toBe('firma_rechazada');
            expect(r.firma).toBe('sin_firma');
            expect(foto(dir('pc2'))).toEqual({});
        });

        it('por linea de comandos: sin clave sale con 4 y no copia nada; con publicador.pub en CLAUDE_AREA_ESTADO, 0', () => {
            const correr = (args, env = {}) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, CLAUDE_AREA_ESTADO: dir('estado-vacio'), ...env }, timeout: 60000 });
            const { rutaPub, nube } = nubeDeArea();
            const pc = dir('pc');
            const porNombre = correr(['--actualizar', '--destino', pc, '--nube', nube]);
            expect(porNombre.status).toBe(P.CODIGO_SALIDA_FIRMA);
            expect(porNombre.stderr).toContain('le falta la clave');
            const porProyecto = correr(['--actualizar', '--destino', pc, '--nube', nube, '--proyecto', 'area']);
            expect(porProyecto.status).toBe(P.CODIGO_SALIDA_FIRMA);
            expect(foto(pc)).toEqual({});
            const estado = dir('estado');
            fs.copyFileSync(rutaPub, path.join(estado, 'publicador.pub'));
            const ok = correr(['--actualizar', '--destino', pc, '--nube', nube], { CLAUDE_AREA_ESTADO: estado });
            expect(ok.status, ok.stdout + ok.stderr).toBe(0);
            expect(ok.stdout).toContain('firma verificada');
        });
    });

    // -----------------------------------------------------------------------------------------
    // Revision del coordinador (01/10): la version nunca retrocede.
    // -----------------------------------------------------------------------------------------
    describe('la version nunca retrocede', () => {
        const IDENT = { usuario: 'marta', pc: 'COMPRAS-02' };
        /** v1 y v2 firmadas; la PC (con clave publica) en la v2. Devuelve lo necesario para poner la v1 vieja en la raiz. */
        function pcEnV2() {
            const { rutaClave, rutaPub } = claves();
            const origen = armarOrigen();
            const nube = dir('nube');
            const pc = dir('pc1');
            expect(pub(origen, nube, LISTA, { clavePrivada: rutaClave }).version).toBe(1);
            esc(origen, '.claude/rules/regla.md', '# regla dos\n');
            expect(pub(origen, nube, LISTA, { clavePrivada: rutaClave, ahora: F(2) }).version).toBe(2);
            expect(act(pc, nube, { clavePublica: rutaPub, identidad: IDENT, ahora: F(3) }).estado).toBe('actualizado');
            return { rutaClave, rutaPub, origen, nube, pc };
        }
        /**
         * Lo que haria alguien con escritura: vuelve a poner en la raiz la v1 ENTERA (manifiesto y firma legitimos
         * y su contenido, que esta en historial\_objetos), con un VERSION.json coherente que dice `numero`.
         */
        function reponerV1(nube, numero) {
            const man = fs.readFileSync(path.join(nube, 'historial', 'v1', 'MANIFIESTO.json'));
            const sig = fs.readFileSync(path.join(nube, 'historial', 'v1', 'MANIFIESTO.sig'));
            for (const [rel, e] of Object.entries(JSON.parse(man.toString('utf8')).archivos)) {
                esc(nube, `contenido/${rel}`, fs.readFileSync(path.join(nube, 'historial', '_objetos', e.sha256.slice(0, 2), e.sha256)));
            }
            fs.writeFileSync(path.join(nube, 'MANIFIESTO.json'), man);
            fs.writeFileSync(path.join(nube, 'MANIFIESTO.sig'), sig);
            const v = leerVersion(nube);
            v.version = numero;
            v.manifest_sha256 = P.sha256(man);
            v.firma.sha256 = P.sha256(sig);
            escribirVersion(nube, v);
        }

        it('ROJO: la v1 (firma legitima) vuelta a poner en la raiz: version_anterior, nada se toca, la salud lo anota como error; una PC nueva si la instala', () => {
            const { rutaPub, nube, pc } = pcEnV2();
            reponerV1(nube, 1);
            expect(P.leerPublicacion(nube).estado).toBe('ok');   // es una publicacion valida y firmada: solo la version la delata
            const antes = foto(pc);
            const r = act(pc, nube, { clavePublica: rutaPub, identidad: IDENT, ahora: F(5) });
            expect(r.estado).toBe('version_anterior');
            expect(r.firma).toBe('valida');
            expect(r.mensaje).toContain('más vieja (1)');
            expect(r.mensaje).toContain('(2)');
            expect(foto(pc)).toEqual(antes);
            expect(leer(pc, '.claude/rules/regla.md')).toBe('# regla dos\n');
            const s = JSON.parse(leer(nube, 'salud/COMPRAS-02.json'));
            expect(s).toMatchObject({ estado: 'version_anterior', version_instalada: 2, version_publicada_vista: 1 });
            expect(s.errores).toHaveLength(1);
            // sin clave publica (proyecto de siempre) tampoco retrocede
            expect(act(pc, nube, { identidad: IDENT, ahora: F(6) }).estado).toBe('version_anterior');
            // una PC sin nada instalado no tiene contra que comparar: instala la v1 como siempre
            expect(act(dir('pc-nueva'), nube, { clavePublica: rutaPub, ahora: F(6) })).toMatchObject({ estado: 'actualizado', version: 1 });
        });

        it('ROJO: VERSION.json reescrito con un numero igual o mas alto sobre el manifiesto viejo tampoco pasa: la version viaja adentro del manifiesto firmado', () => {
            const { rutaPub, nube, pc } = pcEnV2();
            const antes = foto(pc);
            for (const numero of [2, 3, 99]) {
                reponerV1(nube, numero);
                expect(P.leerPublicacion(nube).estado, String(numero)).toBe('manifiesto_invalido');
                const r = act(pc, nube, { clavePublica: rutaPub, identidad: IDENT, ahora: F(5) });
                expect(r.estado, String(numero)).toBe('error');
                expect(r.errores.join(' '), String(numero)).toContain('dice ser la versión 1');
                expect(foto(pc), String(numero)).toEqual(antes);
            }
        });

        it('VERDE: el rollback legitimo entra porque sale como version NUEVA; por linea de comandos la vieja sale con 4', () => {
            const { rutaClave, rutaPub, nube, pc } = pcEnV2();
            const rb = P.publicar({ origen: dir('origen'), nube, lista: null, rollback: 1, clavePrivada: rutaClave, identidad: NOIDENT, ahora: F(4) });
            expect(rb).toMatchObject({ estado: 'publicado', version: 3 });
            const a = act(pc, nube, { clavePublica: rutaPub, identidad: IDENT, ahora: F(5) });
            expect(a).toMatchObject({ estado: 'actualizado', version: 3 });
            expect(leer(pc, '.claude/rules/regla.md')).toBe('# regla uno\n');
            reponerV1(nube, 1);
            const cli = spawnSync(process.execPath, [SCRIPT, '--actualizar', '--destino', pc, '--nube', nube, '--clave-publica', rutaPub], { encoding: 'utf8', env: { ...process.env, CLAUDE_AREA_ESTADO: dir('estado-vacio') }, timeout: 60000 });
            expect(cli.status).toBe(P.CODIGO_SALIDA_FIRMA);
            expect(cli.stderr).toContain('más vieja');
            expect(JSON.parse(leer(pc, P.REL_INSTALADO)).version).toBe(3);
        });
    });

    it('de punta a punta por linea de comandos con las variables del contrato: generar clave, publicar, actualizar, chequear, salud', () => {
        const nubeArea = dir('CLAUDE POR AREA');
        const home = dir('ClaudeBarack');
        const estado = dir('estado');
        const clave = path.join(tmp, 'claves', 'publicador.key');
        const origen = armarOrigen(V1_AREA);
        const lista = esc(tmp, 'lista.json', JSON.stringify(LISTA_AREA));
        const env = { ...process.env, CLAUDE_AREA_NUBE: nubeArea, CLAUDE_AREA_HOME: home, CLAUDE_AREA_CLAVE: clave, CLAUDE_AREA_ESTADO: estado };
        const correr = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env, timeout: 60000 });
        expect(correr(['--generar-clave']).status).toBe(0);
        fs.copyFileSync(path.join(path.dirname(clave), 'publicador.pub'), path.join(estado, 'publicador.pub'));
        esc(home, 'perfil.json', JSON.stringify({ nombre: 'Marta', area: 'compras' }));
        const p = correr(['--publicar', '--origen', origen, '--lista', lista]);
        expect(p.status, p.stdout + p.stderr).toBe(0);
        expect(p.stdout).toContain(path.join(nubeArea, '1- PUBLICADO'));
        expect(p.stdout).toContain('firmada');
        expect(correr(['--chequear']).status).toBe(5);
        const a = correr(['--actualizar']);
        expect(a.status, a.stdout + a.stderr).toBe(0);
        expect(a.stdout).toContain('firma verificada');
        expect(a.stdout).toContain('área compras');
        expect(fs.existsSync(path.join(home, 'publicado', 'programas', 'util.mjs'))).toBe(true);
        expect(fs.existsSync(path.join(home, 'Trabajo', '.claude', 'rules', 'casa.md'))).toBe(true);   // --home regenera las reglas de la casa
        expect(correr(['--chequear']).status).toBe(0);
        expect(fs.readdirSync(path.join(nubeArea, '4- BUZON', 'salud'))).toHaveLength(1);
        expect(correr(['--donde']).stdout.trim()).toBe(path.join(nubeArea, '1- PUBLICADO'));
    });
});
