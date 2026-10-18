/**
 * Tests del instalador y la sincronizacion de la base de Claude para el equipo de Ingenieria
 * (tools/paquete-equipo/ + los modos --pendrive y --donde de scripts/_paquete.mjs; 30/09/2026).
 *
 * Lo que se le prometio a Fak y protege este archivo:
 *  - el pendrive se arma con la MISMA publicacion que va a la nube y se instala con la misma logica
 *    (sin pisar nada del compañero, sin borrar nada);
 *  - Instalar agrega la linea @CLAUDE.equipo.md sin tocar el resto del CLAUDE.md, y es repetible;
 *  - la sincronizacion trae lo nuevo, deja `.fak-nueva` al lado de lo que el compañero cambio y no
 *    borra sus skills ni sus archivos;
 *  - lo privado no sube, sin `privados.json` no sube NADA, y una corrida cortada conserva lo hecho;
 *  - los .ps1 son ASCII puro (powershell 5.1 los lee como ANSI) y parsean;
 *  - la subida de mails no se nombra en CLAUDE.equipo.md, en las reglas siempre cargadas ni en las
 *    descripciones de las skills de la base (pedido de Fak), y nada ahi la oculta ni la niega.
 *
 * Todo corre en carpetas temporales con nubes y pendrives de mentira: no toca la nube real, ni el
 * pendrive, ni registra tareas de Windows, ni lee Outlook (la fuente de mails es un .jsonl).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as P from '../../scripts/_paquete.mjs';

vi.setConfig({ testTimeout: 180000, hookTimeout: 180000 });

const RAIZ = path.resolve(fileURLToPath(import.meta.url), '../../..');
const SCRIPT = path.join(RAIZ, 'scripts', '_paquete.mjs');
const TOOLS = path.join(RAIZ, 'tools', 'paquete-equipo');
const NOIDENT = { usuario: '', pc: '' };
const ES_WINDOWS = process.platform === 'win32';

/** Un Python 3 de verdad (no el atajo de la tienda de Windows). */
function buscarPython() {
    for (const exe of ['python', 'python3']) {
        const r = spawnSync(exe, ['-c', 'import sys;print(sys.version_info[0])'], { encoding: 'utf8', timeout: 20000 });
        if (r.status === 0 && r.stdout.trim() === '3') return exe;
    }
    return null;
}
const PY = buscarPython();

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'paqeq-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

const dir = (...partes) => { const p = path.join(tmp, ...partes); fs.mkdirSync(p, { recursive: true }); return p; };
const esc = (base, rel, texto) => { const p = path.join(base, ...rel.split('/')); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, texto); return p; };
const leer = (base, rel) => fs.readFileSync(path.join(base, ...rel.split('/')), 'utf8');
const existe = (base, rel) => fs.existsSync(path.join(base, ...rel.split('/')));
const copiarReal = (origen, destino, rel) => esc(destino, rel, fs.readFileSync(path.join(origen, ...rel.split('/')), 'utf8'));

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

// ---------------------------------------------------------------------------------------------
// Un origen de mentira con la maquinaria REAL (_paquete.mjs, sync, mails, CLAUDE.equipo.md e
// instaladores copiados del repo) y unas skills inventadas.
// ---------------------------------------------------------------------------------------------
const RUTAS_REALES = ['scripts/_paquete.mjs', 'tools/paquete-equipo/sync_equipo.ps1', 'tools/paquete-equipo/mails_equipo.py', 'CLAUDE.equipo.md'];
const INSTALADORES = ['tools/paquete-equipo/Instalar.cmd', 'tools/paquete-equipo/Instalar.ps1', 'tools/paquete-equipo/LEEME.txt'];
const PROPIOS_V1 = {
    '.claude/skills/docs-x/SKILL.md': '---\nname: docs-x\ndescription: "Mapa de documentos"\n---\n\n# docs-x\nversion de Fak 1\n',
    '.claude/rules/regla.md': '# regla\nversion de Fak 1\n',
    'scripts/util.mjs': 'export const x = 1;\n',
};
const LISTA_EQ = {
    incluir: [
        { ruta: 'CLAUDE.equipo.md' }, { ruta: 'scripts/_paquete.mjs' },
        { ruta: 'tools/paquete-equipo/sync_equipo.ps1' }, { ruta: 'tools/paquete-equipo/mails_equipo.py' },
        { ruta: '.claude/skills/docs-x' }, { ruta: '.claude/rules/regla.md' }, { ruta: 'scripts/util.mjs' },
        { ruta: '.claude/skills/nueva', opcional: true },
    ],
    no_van: [
        { ruta: 'tools/paquete-equipo/Instalar.cmd', motivo: 'solo pendrive' }, { ruta: 'tools/paquete-equipo/Instalar.ps1', motivo: 'solo pendrive' },
        { ruta: 'tools/paquete-equipo/LEEME.txt', motivo: 'solo pendrive' },
    ],
    excluir_nombres: ['__pycache__'],
    excluir_sufijos: ['.pyc', '.fak-nueva'],
    prohibido_contenido: [{ texto: 'FacundoS-PC', motivo: 'nombre de la PC de Fak' }],
};
function armarOrigenEq(propios = PROPIOS_V1) {
    const origen = dir('origen');
    for (const rel of [...RUTAS_REALES, ...INSTALADORES]) copiarReal(RAIZ, origen, rel);
    for (const [rel, txt] of Object.entries(propios)) esc(origen, rel, txt);
    return origen;
}

// ---------------------------------------------------------------------------------------------
describe('armarPendrive: la base + el instalador en una carpeta', () => {
    it('deja Base (la misma publicacion de la nube) y los 3 archivos de instalacion en la raiz', () => {
        const origen = armarOrigenEq();
        const pendrive = dir('pendrive');
        const r = P.armarPendrive({ origen, pendrive, lista: LISTA_EQ, identidad: NOIDENT, ahora: new Date(2026, 9, 1, 10) });
        expect(r.errores).toEqual([]);
        expect(r.estado).toBe('listo');
        expect(r.copiados.sort()).toEqual(['Instalar.cmd', 'Instalar.ps1', 'LEEME.txt']);
        for (const n of ['Instalar.cmd', 'Instalar.ps1', 'LEEME.txt']) expect(P.sha256Archivo(path.join(pendrive, n))).toBe(P.sha256Archivo(path.join(TOOLS, n)));
        const pub = P.leerPublicacion(path.join(pendrive, 'Base'));
        expect(pub.estado).toBe('ok');
        expect(Object.keys(pub.manifiesto.archivos)).toContain('scripts/_paquete.mjs');
        expect(Object.keys(pub.manifiesto.archivos)).toContain('CLAUDE.equipo.md');
        // los instaladores NO viajan dentro de la base (solo en el pendrive)
        expect(Object.keys(pub.manifiesto.archivos).some((k) => /Instalar\.|LEEME\.txt/.test(k))).toBe(false);
    });

    it('lo que trae Base se instala con la logica de la nube, sin pisar lo del compañero y sin borrar nada', () => {
        const origen = armarOrigenEq();
        const pendrive = dir('pendrive');
        expect(P.armarPendrive({ origen, pendrive, lista: LISTA_EQ, identidad: NOIDENT }).estado).toBe('listo');
        const pc = dir('pc');
        esc(pc, '.claude/skills/docs-x/SKILL.md', '# la mia: ya la habia cambiado\n');
        esc(pc, '.claude/skills/mia/SKILL.md', '# skill propia\n');
        const r = P.actualizar({ destino: pc, nube: path.join(pendrive, 'Base') });
        expect(r.estado).toBe('actualizado');
        expect(leer(pc, '.claude/skills/docs-x/SKILL.md')).toBe('# la mia: ya la habia cambiado\n');
        expect(leer(pc, '.claude/skills/docs-x/SKILL.md.fak-nueva')).toBe(PROPIOS_V1['.claude/skills/docs-x/SKILL.md']);
        expect(leer(pc, '.claude/skills/mia/SKILL.md')).toBe('# skill propia\n');
        expect(existe(pc, 'CLAUDE.equipo.md')).toBe(true);
        expect(existe(pc, 'tools/paquete-equipo/sync_equipo.ps1')).toBe(true);
        expect(existe(pc, 'tools/paquete-equipo/Instalar.ps1')).toBe(false);
    });

    it('no inventa la carpeta del pendrive: si no existe, se niega y no crea nada', () => {
        const origen = armarOrigenEq();
        const inexistente = path.join(tmp, 'D_que_no_esta');
        const r = P.armarPendrive({ origen, pendrive: inexistente, lista: LISTA_EQ, identidad: NOIDENT });
        expect(r.estado).toBe('rechazado');
        expect(r.errores.join(' ')).toContain('no existe');
        expect(fs.existsSync(inexistente)).toBe(false);
        expect(P.armarPendrive({ origen, pendrive: '', lista: LISTA_EQ, identidad: NOIDENT }).estado).toBe('rechazado');
    });

    it('si falta un archivo de instalacion se niega y no deja Base a medias', () => {
        const origen = armarOrigenEq();
        fs.rmSync(path.join(origen, 'tools', 'paquete-equipo', 'LEEME.txt'));
        const pendrive = dir('pendrive');
        const r = P.armarPendrive({ origen, pendrive, lista: LISTA_EQ, identidad: NOIDENT });
        expect(r.estado).toBe('rechazado');
        expect(r.errores.join(' ')).toContain('LEEME.txt');
        expect(fs.readdirSync(pendrive)).toEqual([]);
    });

    it('un instalador con el nombre de la PC de Fak no sale, y tampoco sale Base', () => {
        const origen = armarOrigenEq();
        esc(origen, 'tools/paquete-equipo/Instalar.ps1', '# probado en FacundoS-PC\n');
        const pendrive = dir('pendrive');
        const r = P.armarPendrive({ origen, pendrive, lista: LISTA_EQ, identidad: NOIDENT });
        expect(r.estado).toBe('rechazado');
        expect(r.errores.join(' ')).toContain('tools/paquete-equipo/Instalar.ps1:1');
        expect(fs.readdirSync(pendrive)).toEqual([]);
    });

    it('si la publicacion se rechaza (archivo prohibido en la base) no copia los instaladores', () => {
        const origen = armarOrigenEq({ ...PROPIOS_V1, 'scripts/util.mjs': '// FacundoS-PC\n' });
        const pendrive = dir('pendrive');
        const r = P.armarPendrive({ origen, pendrive, lista: LISTA_EQ, identidad: NOIDENT });
        expect(r.estado).toBe('rechazado');
        expect(r.errores.join(' ')).toContain('scripts/util.mjs:1');
        expect(fs.existsSync(path.join(pendrive, 'Instalar.cmd'))).toBe(false);
    });

    it('rearmar el mismo pendrive no cambia la base (sin novedades) y deja los instaladores al dia', () => {
        const origen = armarOrigenEq();
        const pendrive = dir('pendrive');
        expect(P.armarPendrive({ origen, pendrive, lista: LISTA_EQ, identidad: NOIDENT }).publicacion.estado).toBe('publicado');
        const antes = foto(path.join(pendrive, 'Base'));
        fs.writeFileSync(path.join(pendrive, 'LEEME.txt'), 'version vieja');
        const r = P.armarPendrive({ origen, pendrive, lista: LISTA_EQ, identidad: NOIDENT });
        expect(r.estado).toBe('listo');
        expect(r.publicacion.estado).toBe('sin_novedades');
        expect(foto(path.join(pendrive, 'Base'))).toEqual(antes);
        expect(P.sha256Archivo(path.join(pendrive, 'LEEME.txt'))).toBe(P.sha256Archivo(path.join(TOOLS, 'LEEME.txt')));
    });
});

// ---------------------------------------------------------------------------------------------
describe('linea de comandos: --pendrive y --donde', () => {
    const correr = (args, env = {}) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, ...env }, timeout: 120000 });

    it('--pendrive arma todo y dice que hacer en la PC del compañero', () => {
        const origen = armarOrigenEq();
        const lista = esc(tmp, 'lista.json', JSON.stringify(LISTA_EQ));
        const pendrive = dir('pendrive');
        const r = correr(['--pendrive', pendrive, '--origen', origen, '--lista', lista, '--nota', 'primera version']);
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain('Instalar.cmd');
        expect(r.stdout).toContain('doble click');
        expect(existe(path.join(pendrive, 'Base'), 'VERSION.json')).toBe(true);
        expect(leer(path.join(pendrive, 'Base'), 'NOVEDADES.md')).toContain('- primera version');
    });

    it('--pendrive sobre una carpeta que no existe: salida 1 y nada creado', () => {
        const origen = armarOrigenEq();
        const lista = esc(tmp, 'lista.json', JSON.stringify(LISTA_EQ));
        const falso = path.join(tmp, 'Z_no_esta');
        const r = correr(['--pendrive', falso, '--origen', origen, '--lista', lista]);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('NO QUEDO LISTO');
        expect(fs.existsSync(falso)).toBe(false);
    });

    it('--donde imprime la carpeta de la nube (la de --nube) y sin nube sale con 1', () => {
        const nube = dir('mi nube', 'Base Claude Ingenieria');
        const ok = correr(['--donde', '--nube', nube]);
        expect(ok.status).toBe(0);
        expect(ok.stdout.trim()).toBe(nube);
        const vacio = dir('casa');   // un USERPROFILE sin ninguna biblioteca sincronizada
        const no = correr(['--donde'], { USERPROFILE: vacio });
        expect(no.status).toBe(1);
        expect(no.stderr).toContain('no encuentro');
    });
});

// ---------------------------------------------------------------------------------------------
describe('los archivos reales del paquete', () => {
    const real = P.cargarLista(path.join(RAIZ, P.REL_LISTA));
    const ARCHIVOS = ['sync_equipo.ps1', 'Instalar.ps1', 'Instalar.cmd', 'LEEME.txt', 'mails_equipo.py'];

    it('la lista real lleva la sincronizacion y CLAUDE.equipo.md, y deja los instaladores solo para el pendrive', () => {
        expect(P.revisarLista(real)).toEqual([]);
        const rutas = real.incluir.map((e) => e.ruta);
        for (const r of ['CLAUDE.equipo.md', 'scripts/_paquete.mjs', 'tools/paquete-equipo/sync_equipo.ps1', 'tools/paquete-equipo/mails_equipo.py']) expect(rutas, r).toContain(r);
        expect(rutas.some((r) => /Instalar\.|LEEME\.txt/.test(r))).toBe(false);
        expect(real.incluir.find((e) => e.ruta === 'CLAUDE.equipo.md').opcional).toBeFalsy();
        // las dos reglas siempre activas atadas a Supabase y a los hooks de Fak no viajan
        for (const r of ['.claude/rules/core-prohibiciones.md', '.claude/rules/caracteristicas-especiales.md']) expect(rutas, r).not.toContain(r);
    });

    it('publicar la lista real (simulado) pasa el filtro: el nombre de la PC de Fak ya no esta en ningun archivo incluido', () => {
        const nube = dir('nube-real-simulada');
        const r = P.publicar({ origen: RAIZ, nube, lista: real, simular: true, identidad: NOIDENT });
        expect(r.errores).toEqual([]);
        expect(r.estado).toBe('simulado');
    });

    it('los instaladores y la sincronizacion pasan el filtro de datos personales y claves', () => {
        const archivos = new Map(ARCHIVOS.map((n) => [`tools/paquete-equipo/${n}`, path.join(TOOLS, n)]));
        archivos.set('CLAUDE.equipo.md', path.join(RAIZ, 'CLAUDE.equipo.md'));
        expect(P.revisarContenido(archivos, P.patronesFiltro({ lista: real, identidad: NOIDENT }))).toEqual([]);
    });

    it('los .ps1 y el .cmd son ASCII puro y con finales de linea de Windows (powershell 5.1 los lee como ANSI)', () => {
        for (const n of ['sync_equipo.ps1', 'Instalar.ps1', 'Instalar.cmd']) {
            const b = fs.readFileSync(path.join(TOOLS, n));
            expect(b.some((x) => x > 127), `${n} tiene caracteres que no son ASCII`).toBe(false);
            expect(b.toString('latin1'), `${n} tiene que terminar sus lineas con CRLF`).not.toMatch(/[^\r]\n/);
        }
    });

    it.skipIf(!ES_WINDOWS)('los .ps1 parsean en PowerShell (0 errores de sintaxis)', () => {
        for (const n of ['sync_equipo.ps1', 'Instalar.ps1']) {
            const p = path.join(TOOLS, n).replace(/'/g, "''");
            const cmd = `$e=$null;$t=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${p}',[ref]$t,[ref]$e);if($e.Count){$e|ForEach-Object{$_.Message};exit 1}else{'ok'}`;
            const r = spawnSync('powershell.exe', ['-NoProfile', '-Command', cmd], { encoding: 'utf8', timeout: 60000 });
            expect(r.status, `${n}: ${r.stdout}${r.stderr}`).toBe(0);
        }
    });

    it('LEEME.txt: UTF-8 con BOM, 5 pasos y dice a quien preguntarle', () => {
        const b = fs.readFileSync(path.join(TOOLS, 'LEEME.txt'));
        expect([b[0], b[1], b[2]]).toEqual([0xEF, 0xBB, 0xBF]);
        const lineas = b.toString('utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
        expect(lineas.filter((l) => /^\d\. /.test(l))).toHaveLength(5);
        expect(lineas.join('\n')).toMatch(/Instalar/);
        expect(lineas.join('\n')).toMatch(/Fak/);
    });

    it('CLAUDE.equipo.md trae lo pedido (--ver, .fak-nueva, aportes, perfil) y es corto', () => {
        const t = fs.readFileSync(path.join(RAIZ, 'CLAUDE.equipo.md'), 'utf8');
        for (const x of ['_paquete.mjs --ver', '.fak-nueva', '--aportar', '--perfil', 'paquete-pendientes.md', '¿Hay actualizaciones de Fak?', 'aportar valor a otros usuarios']) expect(t, x).toContain(x);
        expect(t.split('\n').length).toBeLessThan(70);
    });

    it('la subida de mails no se nombra en CLAUDE.equipo.md, ni en reglas siempre cargadas, ni en descripciones de skills (pedido de Fak)', () => {
        const nombra = /mails?_equipo|sincronizaci[oó]n de (los )?mails|sub(e|ir|ida|en)\b[^.\n]{0,40}\bmails?\b|\bOutlook\b|\bbuz[oó]n\b|correo/i;
        expect(fs.readFileSync(path.join(RAIZ, 'CLAUDE.equipo.md'), 'utf8')).not.toMatch(nombra);
        for (const e of real.incluir) {
            const base = path.join(RAIZ, ...e.ruta.split('/'));
            const md = [];
            const rec = (p) => { const st = fs.statSync(p); if (st.isDirectory()) fs.readdirSync(p).forEach((n) => rec(path.join(p, n))); else if (/\.md$/i.test(p)) md.push(p); };
            if (fs.existsSync(base)) rec(base);
            for (const f of md) {
                const rel = path.relative(RAIZ, f).split(path.sep).join('/');
                const t = fs.readFileSync(f, 'utf8');
                const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(t);
                if (/^\.claude\/skills\/[^/]+\/SKILL\.md$/i.test(rel)) {
                    const d = fm && /^description:\s*(.+)$/m.exec(fm[1]);
                    expect(d ? d[1] : '', `descripcion de ${rel}`).not.toMatch(/mails?_equipo|sub(e|ir|ida|en)\b[^.\n]{0,40}\bmails?\b/i);
                }
                if (/^\.claude\/rules\/[^/]+\.md$/i.test(rel) && !(fm && /^paths:/m.test(fm[1]))) {
                    expect(t, `regla siempre cargada ${rel}`).not.toMatch(/mails?_equipo|sub(e|ir|ida|en)\b[^.\n]{0,40}\bmails?\b/i);
                }
            }
        }
    });

    it('nada en la base ni en el instalador oculta o niega la subida: ni pide callarla ni dice que no existe', () => {
        const ocultar = /no (le )?(digas|cuentes|menciones|avises)|no (lo|la) (digas|menciones)|ocult[aeo]|negar|desment|si (te )?pregunta[^.\n]{0,40}(no|neg)/i;
        for (const n of ['sync_equipo.ps1', 'Instalar.ps1', 'mails_equipo.py', 'LEEME.txt']) expect(fs.readFileSync(path.join(TOOLS, n), 'utf8'), n).not.toMatch(ocultar);
        expect(fs.readFileSync(path.join(RAIZ, 'CLAUDE.equipo.md'), 'utf8')).not.toMatch(ocultar);
    });

    // Fak, 30/09: la subida de mails no se anuncia (tampoco se oculta ni se niega si preguntan).
    // El LEEME describe la tarea en general, con verdad, y no promete que "solo baja".
    it('LEEME.txt (lo que lee el compañero) describe la tarea con verdad y sin prometer de mas', () => {
        const t = fs.readFileSync(path.join(TOOLS, 'LEEME.txt'), 'utf8');
        expect(t).toMatch(/tarea en segundo plano/);
        expect(t).toMatch(/sincroniza tu PC con la nube del equipo/);
        expect(t).toMatch(/sin borrar ni pisar lo tuyo/);
        expect(t).not.toMatch(/solo baja|no sube nada|no comparte/i);
    });
});

// ---------------------------------------------------------------------------------------------
describe.skipIf(!PY)('mails_equipo.py: que sube, que no, y que conserva', () => {
    const MAILS = path.join(TOOLS, 'mails_equipo.py');
    const AUTOR = 'Federico Leonardo Lattanzi - Ingenieria';
    const pad = (n) => String(n).padStart(2, '0');
    const fechaHace = (dias, hora = 10) => { const d = new Date(Date.now() - dias * 86400000); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(hora)}:00`; };
    const mail = (id, extra = {}) => ({ id, eid: `E${id}`, carpeta: 'Bandeja de entrada', fecha: fechaHace(1), de: 'Compras', de_mail: 'compras@ejemplo.com', para: 'x', para_mails: ['yo@ejemplo.com'], cc: '', cc_mails: [], asunto: `asunto ${id}`, adjuntos: [], conversacion: 'c', cuerpo: 'texto normal de trabajo', ...extra });
    const jsonl = (nombre, mails) => esc(tmp, nombre, mails.map((m) => JSON.stringify(m)).join('\n') + '\n');
    const py = (args) => spawnSync(PY, [MAILS, ...args], { encoding: 'utf8', timeout: 120000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });

    function escenario({ privados = { direcciones: ['gerencia@ejemplo.com'], dominios: [], palabras_extra: [] }, perfil = { autor: AUTOR } } = {}) {
        const nube = dir('nube');
        const estado = dir('estado');
        if (privados) esc(nube, 'privados.json', JSON.stringify(privados));
        if (perfil) esc(estado, 'perfil.json', JSON.stringify(perfil));
        return { nube, estado };
    }
    const subidos = (nube, destino) => {
        const d = path.join(nube, 'mails', `_${destino}`, AUTOR);
        if (!fs.existsSync(d)) return [];
        return fs.readdirSync(d).sort().flatMap((f) => fs.readFileSync(path.join(d, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
    };
    const archivos = (nube, destino) => { const d = path.join(nube, 'mails', `_${destino}`, AUTOR); return fs.existsSync(d) ? fs.readdirSync(d).sort() : []; };

    it('el autotest de clasificacion pasa', () => {
        const r = py(['--selftest']);
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain('selftest: OK');
    });

    // Auditoria del 01/10/2026: la cuarentena subia a una carpeta que lee todo el equipo, y un mail con
    // el remitente o un destinatario sin casilla pasaba el filtro de privados sin que hubiera con que filtrar.
    it('solo el mail de trabajo sube: sueldos (cuarentena), privados, codigos de acceso y mails sin casilla legible no salen de la PC', () => {
        const { nube, estado } = escenario();
        const src = jsonl('src.jsonl', [
            mail('<trabajo@x>', { sin_resolver: 0 }),
            mail('<gerencia@x>', { de_mail: 'gerencia@ejemplo.com', asunto: 'reunion de direccion' }),
            mail('<cc-gerencia@x>', { cc_mails: ['Gerencia@Ejemplo.com'] }),
            mail('<sueldo@x>', { asunto: 'Anticipo de sueldo de Juan' }),
            mail('<login@x>', { de_mail: 'noreply@mail.anthropic.com', asunto: 'Your login code', cuerpo: '123456' }),
            mail('<dn@x>', { de_mail: '/o=exchangelabs/cn=recipients/cn=abc', asunto: 'remitente sin casilla' }),
            mail('<sinresolver@x>', { sin_resolver: 1, asunto: 'destinatario sin casilla' }),
        ]);
        const r = py(['--nube', nube, '--estado-dir', estado, '--fuente-jsonl', src]);
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(subidos(nube, 'entrada').map((m) => m.id)).toEqual(['<trabajo@x>']);
        expect(subidos(nube, 'entrada')[0]).not.toHaveProperty('sin_resolver');   // el formato de lo subido no cambia
        // en la nube no queda NADA mas que la entrada: ni carpeta de cuarentena
        expect(fs.readdirSync(path.join(nube, 'mails'))).toEqual(['_entrada']);
        const todo = JSON.stringify(foto(path.join(nube, 'mails'))) + JSON.stringify(subidos(nube, 'entrada'));
        expect(todo).not.toContain('gerencia');
        expect(todo).not.toContain('123456');
        expect(todo).not.toContain('sueldo');
        // lo que no sube tambien queda anotado: no se vuelve a evaluar
        const ids = fs.readFileSync(path.join(estado, 'mails-subidos.txt'), 'utf8').split('\n').filter(Boolean);
        expect(ids.sort()).toEqual(['<cc-gerencia@x>', '<dn@x>', '<gerencia@x>', '<login@x>', '<sinresolver@x>', '<sueldo@x>', '<trabajo@x>']);
        expect(r.stdout).toContain('entrada 1 - cuarentena (no suben) 1 - privados (no suben) 5');
    });

    it('la segunda corrida no sube nada repetido y no toca lo que ya estaba en la nube; un mail nuevo sube solo', () => {
        const { nube, estado } = escenario();
        const src = jsonl('src.jsonl', [mail('<a@x>'), mail('<b@x>')]);
        expect(py(['--nube', nube, '--estado-dir', estado, '--fuente-jsonl', src]).status).toBe(0);
        const antes = foto(path.join(nube, 'mails'));
        expect(Object.keys(antes)).toHaveLength(1);
        const r2 = py(['--nube', nube, '--estado-dir', estado, '--fuente-jsonl', src]);
        expect(r2.status).toBe(0);
        expect(r2.stdout).toContain('nuevos 0');
        expect(foto(path.join(nube, 'mails'))).toEqual(antes);
        const src2 = jsonl('src2.jsonl', [mail('<a@x>'), mail('<b@x>'), mail('<c@x>')]);
        expect(py(['--nube', nube, '--estado-dir', estado, '--fuente-jsonl', src2]).status).toBe(0);
        const despues = foto(path.join(nube, 'mails'));
        for (const [k, h] of Object.entries(antes)) expect(despues[k], `${k} no se puede modificar`).toBe(h);
        expect(Object.keys(despues)).toHaveLength(2);
        expect(subidos(nube, 'entrada').map((m) => m.id).sort()).toEqual(['<a@x>', '<b@x>', '<c@x>']);
    });

    it('SIN privados.json no sube nada (ese archivo es lo que deja afuera a Direccion y RRHH): sale con 5', () => {
        const { nube, estado } = escenario({ privados: null });
        const src = jsonl('src.jsonl', [mail('<a@x>')]);
        const r = py(['--nube', nube, '--estado-dir', estado, '--fuente-jsonl', src]);
        expect(r.status).toBe(5);
        expect(r.stdout).toContain('privados.json');
        expect(fs.existsSync(path.join(nube, 'mails'))).toBe(false);
        expect(fs.existsSync(path.join(estado, 'mails-subidos.txt'))).toBe(false);
    });

    // Auditoria del 01/10/2026: el privados.json de la nube era un borrador con tres direcciones
    // "TBD.*" y el script lo tomaba por bueno. Un filtro sin completar es lo mismo que no tenerlo.
    it.each([
        ['una direccion TBD', { direcciones: ['gerencia@ejemplo.com', 'TBD.rrhh@ejemplo.com'], dominios: [] }],
        ['un dominio TBD', { direcciones: ['gerencia@ejemplo.com'], dominios: ['tbd'] }],
        ['el objeto vacio', {}],
        ['las dos listas vacias', { direcciones: [], dominios: [], palabras_extra: ['sueldo'] }],
    ])('privados.json SIN COMPLETAR (%s) no sube nada: sale con 5 y no deja rastro', (_, privados) => {
        const { nube, estado } = escenario({ privados });
        const src = jsonl('src.jsonl', [mail('<a@x>')]);
        const r = py(['--nube', nube, '--estado-dir', estado, '--fuente-jsonl', src]);
        expect(r.status, r.stdout + r.stderr).toBe(5);
        expect(r.stdout).toContain('SIN COMPLETAR');
        expect(fs.existsSync(path.join(nube, 'mails'))).toBe(false);
        expect(fs.existsSync(path.join(estado, 'mails-subidos.txt'))).toBe(false);
    });

    it('privados.json: si una vez se vio en la nube queda una copia local que sigue valiendo', () => {
        const { nube, estado } = escenario();
        const src = jsonl('src.jsonl', [mail('<a@x>')]);
        expect(py(['--nube', nube, '--estado-dir', estado, '--fuente-jsonl', src]).status).toBe(0);
        expect(fs.existsSync(path.join(estado, 'privados.json'))).toBe(true);
        fs.rmSync(path.join(nube, 'privados.json'));
        const src2 = jsonl('src2.jsonl', [mail('<gerencia@x>', { de_mail: 'gerencia@ejemplo.com' }), mail('<b@x>')]);
        const r = py(['--nube', nube, '--estado-dir', estado, '--fuente-jsonl', src2]);
        expect(r.status, r.stdout).toBe(0);
        expect(r.stdout).toContain('copia local');
        expect(subidos(nube, 'entrada').map((m) => m.id).sort()).toEqual(['<a@x>', '<b@x>']);
    });

    it('sin perfil sale con 3; sin carpeta de nube sale con 6; y en los dos casos no deja rastro', () => {
        const a = escenario({ perfil: null });
        const src = jsonl('src.jsonl', [mail('<a@x>')]);
        expect(py(['--nube', a.nube, '--estado-dir', a.estado, '--fuente-jsonl', src]).status).toBe(3);
        expect(fs.existsSync(path.join(a.nube, 'mails'))).toBe(false);
        const b = escenario();
        const r = py(['--nube', path.join(tmp, 'no_esta'), '--estado-dir', b.estado, '--fuente-jsonl', src]);
        expect(r.status).toBe(6);
        expect(fs.existsSync(path.join(b.estado, 'mails-subidos.txt'))).toBe(false);
    });

    it('--dry-run cuenta pero no escribe nada (ni nube, ni ids, ni estado)', () => {
        const { nube, estado } = escenario();
        const src = jsonl('src.jsonl', [mail('<a@x>'), mail('<s@x>', { asunto: 'sueldos' })]);
        const r = py(['--nube', nube, '--estado-dir', estado, '--fuente-jsonl', src, '--dry-run']);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('entrada 1 - cuarentena (no suben) 1');
        expect(fs.existsSync(path.join(nube, 'mails'))).toBe(false);
        expect(fs.existsSync(path.join(estado, 'mails-subidos.txt'))).toBe(false);
        expect(fs.existsSync(path.join(estado, 'mails-estado.json'))).toBe(false);
    });

    it('la primera corrida mira solo hacia atras --dias-atras; la marca de una pasada completa corre el corte', () => {
        const { nube, estado } = escenario();
        const src = jsonl('src.jsonl', [mail('<viejo@x>', { fecha: fechaHace(200) }), mail('<reciente@x>', { fecha: fechaHace(5) })]);
        expect(py(['--nube', nube, '--estado-dir', estado, '--fuente-jsonl', src, '--dias-atras', '30']).status).toBe(0);
        expect(subidos(nube, 'entrada').map((m) => m.id)).toEqual(['<reciente@x>']);
        const st = JSON.parse(fs.readFileSync(path.join(estado, 'mails-estado.json'), 'utf8'));
        expect(st.completa).toBe(true);
        expect(st.marca).toBeTruthy();
        expect(st.autor).toBe(AUTOR);
    });

    it('si se acaba el tiempo la corrida es PARCIAL, conserva lo hecho y NO adelanta la marca: la proxima sigue', () => {
        const { nube, estado } = escenario();
        // 700 mails: con 0 minutos de tope corta enseguida; lo ya volcado queda anotado
        const muchos = Array.from({ length: 700 }, (_, i) => mail(`<m${i}@x>`));
        const src = jsonl('src.jsonl', muchos);
        const r = py(['--nube', nube, '--estado-dir', estado, '--fuente-jsonl', src, '--max-minutos', '0']);
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain('PARCIAL');
        const st = JSON.parse(fs.readFileSync(path.join(estado, 'mails-estado.json'), 'utf8'));
        expect(st.completa).toBe(false);
        expect(st.marca).toBeUndefined();
        const r2 = py(['--nube', nube, '--estado-dir', estado, '--fuente-jsonl', src]);
        expect(r2.status).toBe(0);
        expect(r2.stdout).toContain('completo');
        expect(subidos(nube, 'entrada')).toHaveLength(700);
        expect(new Set(subidos(nube, 'entrada').map((m) => m.id)).size).toBe(700);
        expect(archivos(nube, 'entrada').length).toBeGreaterThanOrEqual(3);   // lotes de 300
    });

    it('nunca pisa un archivo de la nube: con el mismo sello de hora desempata con -2, -3 y deja intacto el anterior', () => {
        const nube = dir('nube');
        const script = `
import sys, os, json
sys.path.insert(0, ${JSON.stringify(TOOLS)})
import mails_equipo as M
M.sello = lambda: '20260930-101500'
nube = ${JSON.stringify(nube)}
rutas = [M.escribir_lote(nube, 'entrada', 'Fulano Perez - Ingenieria', [{'id': '<%d@x>' % i}]) for i in range(3)]
nombres = [os.path.basename(r) for r in rutas]
assert nombres == ['20260930-101500.jsonl', '20260930-101500-2.jsonl', '20260930-101500-3.jsonl'], nombres
assert json.loads(open(rutas[0], encoding='utf-8').read())['id'] == '<0@x>'
assert not [f for f in os.listdir(os.path.dirname(rutas[0])) if f.endswith('.tmp')]
print('SIN_PISAR_OK')
`;
        const r = spawnSync(PY, [esc(tmp, 'sin_pisar.py', script)], { encoding: 'utf8', timeout: 60000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain('SIN_PISAR_OK');
    });

    it('recorre un Outlook de mentira: corta al pasar la fecha, salta carpetas excluidas y no sube dos veces el mismo mail', () => {
        const script = `
import sys, time
sys.path.insert(0, ${JSON.stringify(TOOLS)})
import mails_equipo as M
from datetime import datetime, timedelta

ahora = datetime.now()
lecturas = {'n': 0}

class PA:
    def __init__(s, mid): s.mid = mid
    def GetProperty(s, p): return s.mid
class Cnt:
    def __init__(s, n=0): s.Count = n
class Item:
    def __init__(s, mid, dias, cls=43):
        s.Class = cls; s._rt = ahora - timedelta(days=dias); s.EntryID = 'E' + mid
        s.Subject = 'asunto ' + mid; s.Body = 'cuerpo'; s.To = ''; s.CC = ''; s.SenderName = 'x'
        s.SenderEmailType = 'SMTP'; s.SenderEmailAddress = 'x@e.com'; s.ConversationID = 'c'
        s.Recipients = Cnt(); s.Attachments = Cnt(); s.PropertyAccessor = PA(mid)
    @property
    def ReceivedTime(s):
        lecturas['n'] += 1
        return s._rt
class Items:
    def __init__(s, lista): s.l = list(lista)
    def Sort(s, campo, desc): s.l.sort(key=lambda m: m._rt, reverse=desc)
    @property
    def Count(s): return len(s.l)
    def Item(s, n): return s.l[n - 1]
class Folders:
    def __init__(s, fs): s.f = fs; s.Count = len(fs)
    def Item(s, n): return s.f[n - 1]
class Folder:
    def __init__(s, nombre, eid, items=(), sub=(), tipo=0):
        s.Name = nombre; s.EntryID = eid; s.DefaultItemType = tipo; s.Items = Items(items); s.Folders = Folders(list(sub))
class Store:
    def __init__(s, raiz): s.r = raiz
    def GetRootFolder(s): return s.r
class NS:
    def __init__(s, raiz, eliminados): s.DefaultStore = Store(raiz); s.e = eliminados
    def GetDefaultFolder(s, k):
        return type('F', (), {'EntryID': 'ELIM' if k == 3 else 'OTRA%d' % k})()

viejos = [Item('v%d' % i, 400 + i) for i in range(50)]          # 50 mails de hace mas de un año
entrada = Folder('Bandeja de entrada', 'IN', [Item('a', 1), Item('b', 2), Item('dup', 3), Item('reunion', 4, cls=53)] + viejos,
                 sub=[Folder('Proveedores', 'PROV', [Item('c', 5), Item('dup', 6)])])
enviados = Folder('Elementos enviados', 'OUT', [Item('d', 1)])
eliminados = Folder('Elementos eliminados', 'ELIM', [Item('borrado', 1)])
calendario = Folder('Calendario', 'CAL', [Item('evento', 1)], tipo=1)
raiz = Folder('Top', 'ROOT', [], sub=[entrada, enviados, eliminados, calendario])
ns = NS(raiz, eliminados)

corte = ahora - timedelta(days=90)
ctx = {'limite': time.monotonic() + 60, 'completa': True, 'revisados': 0}
ids = [m['id'] for m in M.mails_de_outlook(ns, corte, set(), ctx)]
assert sorted(ids) == ['a', 'b', 'c', 'd', 'dup'], ids
assert ctx['completa'] is True
# corta en cuanto pasa la fecha: no lee los 50 viejos de la bandeja de entrada
assert lecturas['n'] < 30, lecturas['n']

# conocidos: no se vuelven a subir
ctx2 = {'limite': time.monotonic() + 60, 'completa': True, 'revisados': 0}
ids2 = [m['id'] for m in M.mails_de_outlook(ns, corte, {'a', 'dup'}, ctx2)]
assert sorted(ids2) == ['b', 'c', 'd'], ids2

# se acaba el tiempo: termina y avisa que quedo incompleto
ctx3 = {'limite': time.monotonic() - 1, 'completa': True, 'revisados': 0}
assert list(M.mails_de_outlook(ns, corte, set(), ctx3)) == []
assert ctx3['completa'] is False
print('OUTLOOK_FALSO_OK')
`;
        const f = esc(tmp, 'outlook_falso.py', script);
        const r = spawnSync(PY, [f], { encoding: 'utf8', timeout: 60000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain('OUTLOOK_FALSO_OK');
    });
});

// ---------------------------------------------------------------------------------------------
// De punta a punta con PowerShell: pendrive falso -> Instalar.ps1 -> nube falsa con la version 2 -> sync_equipo.ps1
// ---------------------------------------------------------------------------------------------
describe.skipIf(!ES_WINDOWS || !PY)('punta a punta: Instalar.ps1 y sync_equipo.ps1 con pendrive y nube de mentira', () => {
    const ps = (script, args) => spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args], { encoding: 'utf8', timeout: 170000 });
    const INSTALAR = path.join(TOOLS, 'Instalar.ps1');
    const pad = (n) => String(n).padStart(2, '0');
    const fechaHace = (dias) => { const d = new Date(Date.now() - dias * 86400000); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 10:00`; };

    /** Arma el origen, el pendrive con la v1 y instala en una PC de mentira. */
    function instalada(extraPc = () => {}) {
        const origen = armarOrigenEq();
        const pendrive = dir('pendrive');
        expect(P.armarPendrive({ origen, pendrive, lista: LISTA_EQ, identidad: NOIDENT, ahora: new Date(2026, 9, 1, 10) }).estado).toBe('listo');
        const pc = path.join(tmp, 'pc Ingenieria');   // con espacio a proposito
        const estado = dir('estado equipo');
        extraPc(pc);
        const r = ps(INSTALAR, ['-Destino', pc, '-Nombre', 'Prueba Equipo', '-Sector', 'Ingenieria', '-Base', path.join(pendrive, 'Base'), '-EstadoDir', estado, '-SinTareas', '-SinChequeos']);
        return { origen, pendrive, pc, estado, r };
    }

    it('Instalar -SinTareas: copia la base, guarda el perfil, crea CLAUDE.md y no registra ninguna tarea', () => {
        const { pc, estado, r } = instalada();
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain('LISTO');
        expect(existe(pc, 'CLAUDE.equipo.md')).toBe(true);
        expect(existe(pc, 'scripts/_paquete.mjs')).toBe(true);
        expect(existe(pc, 'tools/paquete-equipo/sync_equipo.ps1')).toBe(true);
        expect(existe(pc, 'tools/paquete-equipo/Instalar.ps1')).toBe(false);
        expect(leer(pc, 'CLAUDE.md')).toBe('# Ingenieria - Barack Mercosul\r\n\r\n@CLAUDE.equipo.md\r\n');
        expect(JSON.parse(leer(pc, '.claude/perfil-equipo.json')).autor).toBe('Prueba Equipo - Ingenieria');
        const perfil = JSON.parse(fs.readFileSync(path.join(estado, 'perfil.json'), 'utf8'));
        expect(perfil.autor).toBe('Prueba Equipo - Ingenieria');
        expect(perfil.destino).toBe(pc);
        const inst = JSON.parse(fs.readFileSync(path.join(estado, 'instalado.json'), 'utf8'));
        expect(inst.tarea).toBe('');
        expect(r.stdout).toContain('-SinTareas');
    });

    it('Instalar con TODOS los chequeos (Node, Python, pywin32, Claude Code, restos viejos): termina bien y solo avisa, no frena por un aviso', () => {
        const origen = armarOrigenEq();
        const pendrive = dir('pendrive');
        P.armarPendrive({ origen, pendrive, lista: LISTA_EQ, identidad: NOIDENT });
        const pc = path.join(tmp, 'pc');
        const r = ps(INSTALAR, ['-Destino', pc, '-Nombre', 'Prueba Equipo', '-Sector', 'Ingenieria', '-Base', path.join(pendrive, 'Base'), '-EstadoDir', dir('est'), '-SinTareas']);
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain('LISTO');
        expect(r.stdout).not.toContain('-SinChequeos');
        expect(existe(pc, 'CLAUDE.equipo.md')).toBe(true);
    });

    // Fak, 01/10/2026: "¿el pendrive no puede instalar node si no lo tenes?". El pendrive lleva node.exe.
    describe('PC sin Node', () => {
        /** Corre el Instalar.ps1 DEL PENDRIVE con un PATH donde no hay Node (solo Windows). */
        function instalarSinNode(pendrive, pc, estado) {
            const raiz = process.env.SystemRoot || 'C:\\Windows';
            const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^path$/i.test(k)));
            env.Path = [path.join(raiz, 'System32'), raiz, path.join(raiz, 'System32', 'WindowsPowerShell', 'v1.0')].join(';');
            return spawnSync(path.join(raiz, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
                ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(pendrive, 'Instalar.ps1'), '-Destino', pc, '-Nombre', 'Prueba Equipo',
                    '-Sector', 'Ingenieria', '-EstadoDir', estado, '-SinTareas', '-SinChequeos', '-SinPath'], { encoding: 'utf8', timeout: 170000, env });
        }

        it('VERDE: usa el Node que trae el pendrive, lo deja en la carpeta de estado y termina la instalacion', () => {
            const origen = armarOrigenEq();
            const pendrive = dir('pendrive con node');
            const armado = P.armarPendrive({ origen, pendrive, lista: LISTA_EQ, identidad: NOIDENT, nodeExe: process.execPath });
            expect(armado.estado).toBe('listo');
            expect(armado.copiados).toContain('node/node.exe');
            expect(P.sha256Archivo(path.join(pendrive, 'node', 'node.exe'))).toBe(P.sha256Archivo(process.execPath));
            const pc = path.join(tmp, 'pc sin node');
            const estado = dir('estado sin node');
            const r = instalarSinNode(pendrive, pc, estado);
            expect(r.status, r.stdout + r.stderr).toBe(0);
            expect(r.stdout).toContain('no tenia Node');
            expect(r.stdout).toContain('LISTO');
            const nodePropio = path.join(estado, 'node', 'node.exe');
            expect(fs.existsSync(nodePropio)).toBe(true);
            expect(existe(pc, 'CLAUDE.equipo.md')).toBe(true);
            expect(JSON.parse(fs.readFileSync(path.join(estado, 'instalado.json'), 'utf8')).node).toBe(nodePropio);
        });

        it('ROJO: sin Node en la PC y sin la carpeta node en el pendrive, frena y lo dice (no instala a medias)', () => {
            const origen = armarOrigenEq();
            const pendrive = dir('pendrive sin node');
            expect(P.armarPendrive({ origen, pendrive, lista: LISTA_EQ, identidad: NOIDENT }).estado).toBe('listo');
            expect(fs.existsSync(path.join(pendrive, 'node'))).toBe(false);
            const pc = path.join(tmp, 'pc sin node 2');
            const r = instalarSinNode(pendrive, pc, dir('estado sin node 2'));
            expect(r.status).not.toBe(0);
            expect(r.stdout + r.stderr).toContain('falta Node.js');
            expect(existe(pc, 'CLAUDE.equipo.md')).toBe(false);
        });
    });

    it('Instalar sobre un CLAUDE.md que ya existe agrega la linea al final sin tocar lo demas, y repetirlo no la duplica', () => {
        const original = '# Mi proyecto\r\nnota mia con tilde: está bien\r\n\r\n- punto 1\r\n- punto 2';   // sin salto final, CRLF
        const { pc, pendrive, estado, r } = instalada((pcDir) => { esc(pcDir, 'CLAUDE.md', original); esc(pcDir, '.claude/skills/mia/SKILL.md', '# mia\n'); });
        expect(r.status, r.stdout + r.stderr).toBe(0);
        const cm = leer(pc, 'CLAUDE.md');
        expect(cm.startsWith(original)).toBe(true);
        expect(cm.slice(original.length)).toBe('\r\n\r\n@CLAUDE.equipo.md\r\n');
        expect(leer(pc, '.claude/skills/mia/SKILL.md')).toBe('# mia\n');
        const otra = ps(INSTALAR, ['-Destino', pc, '-Nombre', 'Prueba Equipo', '-Sector', 'Ingenieria', '-Base', path.join(pendrive, 'Base'), '-EstadoDir', estado, '-SinTareas', '-SinChequeos']);
        expect(otra.status, otra.stdout + otra.stderr).toBe(0);
        expect(leer(pc, 'CLAUDE.md')).toBe(cm);
        expect(otra.stdout).toContain('ya tenia la linea');
    });

    it('Instalar no pisa un archivo de la base que el compañero ya tenia distinto: deja .fak-nueva', () => {
        const { pc, r } = instalada((pcDir) => esc(pcDir, '.claude/rules/regla.md', '# mi version de la regla\n'));
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(leer(pc, '.claude/rules/regla.md')).toBe('# mi version de la regla\n');
        expect(leer(pc, '.claude/rules/regla.md.fak-nueva')).toBe(PROPIOS_V1['.claude/rules/regla.md']);
        expect(leer(pc, '.claude/paquete-pendientes.md')).toContain('regla.md');
    });

    it('Instalar con un nombre invalido se niega (salida 1) y no copia la base', () => {
        const origen = armarOrigenEq();
        const pendrive = dir('pendrive');
        P.armarPendrive({ origen, pendrive, lista: LISTA_EQ, identidad: NOIDENT });
        const pc = path.join(tmp, 'pc');
        const r = ps(INSTALAR, ['-Destino', pc, '-Nombre', 'Solo', '-Sector', 'Ingenieria', '-Base', path.join(pendrive, 'Base'), '-EstadoDir', dir('est'), '-SinTareas', '-SinChequeos']);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('NO SE INSTALO');
        expect(existe(pc, '.claude/.paquete-instalado.json')).toBe(false);
        expect(existe(pc, 'scripts/_paquete.mjs')).toBe(false);
    });

    it('Instalar se niega a instalar sobre la copia completa del repositorio (la PC de origen)', () => {
        const origen = armarOrigenEq();
        const pendrive = dir('pendrive');
        P.armarPendrive({ origen, pendrive, lista: LISTA_EQ, identidad: NOIDENT });
        const pcOrigen = dir('pc-de-origen');
        esc(pcOrigen, 'scripts/_lib/paquete.data.json', '{}');
        const antes = foto(pcOrigen);
        const r = ps(INSTALAR, ['-Destino', pcOrigen, '-Nombre', 'Prueba Equipo', '-Sector', 'Ingenieria', '-Base', path.join(pendrive, 'Base'), '-EstadoDir', dir('est'), '-SinTareas', '-SinChequeos']);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('PC de origen');
        expect(foto(pcOrigen)).toEqual(antes);
    });

    it('Instalar -VerTarea muestra la tarea pedida (sin ventana, baja prioridad, a bateria, 30 min, una sola corrida) y no instala ni registra nada', () => {
        const hayTarea = () => spawnSync('powershell.exe', ['-NoProfile', '-Command', "if (Get-ScheduledTask -TaskName 'Barack - Base Claude y mails' -ErrorAction SilentlyContinue) { 'EXISTE' } else { 'NO_EXISTE' }"], { encoding: 'utf8', timeout: 60000 }).stdout.trim();
        const antesTarea = hayTarea();
        const pc = path.join(tmp, 'pc');
        const r = ps(INSTALAR, ['-Destino', pc, '-VerTarea']);
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(fs.existsSync(pc)).toBe(false);
        expect(r.stdout).toContain('Barack - Base Claude y mails');
        expect(r.stdout).toMatch(/conhost\.exe/i);
        expect(r.stdout).toContain('--headless');
        expect(r.stdout).toContain('sync_equipo.ps1');
        expect(r.stdout).toMatch(/Prioridad: 6/);
        expect(r.stdout).toMatch(/Bateria: permitido=True sigue=True/);
        expect(r.stdout).toMatch(/Tope: PT30M/);
        expect(r.stdout).toMatch(/Instancias multiples: IgnoreNew/);
        expect(r.stdout).toMatch(/Inicio de sesion: Interactive/);
        expect(r.stdout).toMatch(/PT4H/);
        // -VerTarea no registra ni cambia nada: la tarea esta igual que antes
        expect(hayTarea()).toBe(antesTarea);
    });

    it('sync_equipo: trae la version 2, deja .fak-nueva donde el compañero cambio, NO borra sus cosas y sube los mails', () => {
        const { origen, pc, estado, r } = instalada();
        expect(r.status, r.stdout + r.stderr).toBe(0);
        // el compañero cambia un archivo de la base y agrega lo suyo
        esc(pc, '.claude/skills/docs-x/SKILL.md', '# docs-x: version del compañero\n');
        esc(pc, '.claude/skills/mia/SKILL.md', '# skill propia del compañero\n');
        esc(pc, 'scripts/mio.py', 'print("mio")\n');
        // Fak publica la version 2 en la nube (distinta del pendrive) + privados.json
        esc(origen, '.claude/skills/docs-x/SKILL.md', PROPIOS_V1['.claude/skills/docs-x/SKILL.md'] + 'version de Fak 2\n');
        esc(origen, '.claude/rules/regla.md', '# regla\nversion de Fak 2\n');
        esc(origen, '.claude/skills/nueva/SKILL.md', '---\nname: nueva\ndescription: "Skill nueva"\n---\n# nueva\n');
        const nube = dir('nube', 'Base Claude Ingenieria');
        expect(P.publicar({ origen, nube, lista: LISTA_EQ, identidad: NOIDENT, ahora: new Date(2026, 9, 2, 10) }).estado).toBe('publicado');
        esc(nube, 'privados.json', JSON.stringify({ direcciones: ['gerencia@ejemplo.com'] }));
        const mails = [
            { id: '<t1@x>', eid: 'E1', carpeta: 'Bandeja de entrada', fecha: fechaHace(1), de: 'Compras', de_mail: 'compras@ejemplo.com', para: '', para_mails: ['yo@ejemplo.com'], cc: '', cc_mails: [], asunto: 'OC 77', adjuntos: [], conversacion: 'c', cuerpo: 'adjunto la orden' },
            { id: '<p1@x>', eid: 'E2', carpeta: 'Bandeja de entrada', fecha: fechaHace(1), de: 'Direccion', de_mail: 'gerencia@ejemplo.com', para: '', para_mails: ['yo@ejemplo.com'], cc: '', cc_mails: [], asunto: 'privado', adjuntos: [], conversacion: 'c', cuerpo: 'x' },
        ];
        const fuente = esc(tmp, 'fuente.jsonl', mails.map((m) => JSON.stringify(m)).join('\n') + '\n');
        const foto0 = foto(path.join(nube, 'contenido'));

        const sync = path.join(pc, 'tools', 'paquete-equipo', 'sync_equipo.ps1');
        const s = ps(sync, ['-Nube', nube, '-EstadoDir', estado, '-FuenteMailsPrueba', fuente, '-PrioridadNormal']);
        expect(s.status, s.stdout + s.stderr).toBe(0);

        // lo de Fak sin tocar por el compañero se actualiza (con respaldo); lo nuevo entra
        expect(leer(pc, '.claude/rules/regla.md')).toContain('version de Fak 2');
        expect(existe(pc, '.claude/skills/nueva/SKILL.md')).toBe(true);
        // lo que el compañero cambio NO se pisa: la nueva queda al lado
        expect(leer(pc, '.claude/skills/docs-x/SKILL.md')).toBe('# docs-x: version del compañero\n');
        expect(leer(pc, '.claude/skills/docs-x/SKILL.md.fak-nueva')).toContain('version de Fak 2');
        expect(leer(pc, '.claude/paquete-pendientes.md')).toContain('docs-x/SKILL.md');
        // nada del compañero se borro
        expect(leer(pc, '.claude/skills/mia/SKILL.md')).toBe('# skill propia del compañero\n');
        expect(leer(pc, 'scripts/mio.py')).toBe('print("mio")\n');
        // y la nube no se toco en `contenido`
        expect(foto(path.join(nube, 'contenido'))).toEqual(foto0);
        // mails: lo de trabajo sube, lo privado no
        const autor = 'Prueba Equipo - Ingenieria';
        const dEntrada = path.join(nube, 'mails', '_entrada', autor);
        expect(fs.existsSync(dEntrada)).toBe(true);
        const subidos = fs.readdirSync(dEntrada).flatMap((f) => fs.readFileSync(path.join(dEntrada, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).id));
        expect(subidos).toEqual(['<t1@x>']);
        // estado y log locales
        const st = JSON.parse(fs.readFileSync(path.join(estado, 'estado.json'), 'utf8'));
        expect(st.base.resultado).toBe('ok');
        expect(st.mails.resultado).toBe('ok');
        expect(st.errores).toEqual([]);
        expect(fs.readFileSync(path.join(estado, 'sync.log'), 'utf8')).toContain('== sync termina (0 error(es))');

        // una segunda corrida no cambia nada (ni la base, ni la nube, ni sube mails repetidos)
        const fotoPc = foto(pc);
        const fotoMails = foto(path.join(nube, 'mails'));
        const s2 = ps(sync, ['-Nube', nube, '-EstadoDir', estado, '-FuenteMailsPrueba', fuente, '-PrioridadNormal']);
        expect(s2.status, s2.stdout + s2.stderr).toBe(0);
        const fotoPc2 = foto(pc);
        for (const [k, h] of Object.entries(fotoPc)) { if (!k.startsWith('.claude/.paquete-instalado')) expect(fotoPc2[k], `${k} cambio en la segunda corrida`).toBe(h); }
        expect(foto(path.join(nube, 'mails'))).toEqual(fotoMails);
    });

    it('sync_equipo con la nube a medias (sin VERSION.json) no toca la base y lo deja dicho; los demas pasos siguen', () => {
        const { pc, estado, r } = instalada();
        expect(r.status, r.stdout + r.stderr).toBe(0);
        const nube = dir('nube', 'Base Claude Ingenieria');
        esc(nube, 'MANIFIESTO.json', '{"formato":1,"version":2,"archivos":{}}');
        const antes = foto(pc);
        const s = ps(path.join(pc, 'tools', 'paquete-equipo', 'sync_equipo.ps1'), ['-Nube', nube, '-EstadoDir', estado, '-SinMails', '-PrioridadNormal']);
        expect(s.status, s.stdout + s.stderr).toBe(0);
        expect(foto(pc)).toEqual(antes);
        const st = JSON.parse(fs.readFileSync(path.join(estado, 'estado.json'), 'utf8'));
        expect(st.base.resultado).toBe('esperando');
        expect(st.errores).toEqual([]);
    });

    it('sync_equipo sin privados.json en la nube: la base se actualiza igual y los mails no suben nada (queda dicho)', () => {
        const { origen, pc, estado, r } = instalada();
        expect(r.status, r.stdout + r.stderr).toBe(0);
        esc(origen, '.claude/rules/regla.md', '# regla\nversion de Fak 3\n');
        const nube = dir('nube', 'Base Claude Ingenieria');
        expect(P.publicar({ origen, nube, lista: LISTA_EQ, identidad: NOIDENT }).estado).toBe('publicado');
        const fuente = esc(tmp, 'fuente.jsonl', JSON.stringify({ id: '<a@x>', fecha: fechaHace(1), de_mail: 'a@ejemplo.com', para_mails: [], cc_mails: [], asunto: 'x', cuerpo: 'y' }) + '\n');
        const s = ps(path.join(pc, 'tools', 'paquete-equipo', 'sync_equipo.ps1'), ['-Nube', nube, '-EstadoDir', estado, '-FuenteMailsPrueba', fuente, '-PrioridadNormal']);
        expect(s.status, s.stdout + s.stderr).toBe(0);
        expect(leer(pc, '.claude/rules/regla.md')).toContain('version de Fak 3');
        expect(fs.existsSync(path.join(nube, 'mails'))).toBe(false);
        const st = JSON.parse(fs.readFileSync(path.join(estado, 'estado.json'), 'utf8'));
        expect(st.mails.resultado).toBe('falta_privados');
    });
});
