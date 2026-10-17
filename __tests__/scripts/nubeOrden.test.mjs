/**
 * Tests de la tanda 7 (la nube, 17/10/2026): `scripts/_lib/nubeOrden.mjs`, el simulado `scripts/_nubeSimular.mjs` y
 * el mapa `scripts/_nubeMapa.mjs`. Todo con datos de mentira: ningun test toca la nube ni corre PowerShell (en CI, Linux).
 *
 * Lo que tiene que ser verdad (encargo E261017-bdcb):
 *   - nada se mueve ni se borra: los dos programas escriben UN archivo, y solo adentro de exports/explicaciones/;
 *   - «que programa busca cada carpeta» es por TRAMO DE RUTA (FACUNDO no es Facundo Santoro, ni VARIOS\FACUNDO, ni el
 *     usuario FACUNDO del arb) y separa el codigo (se rompe al mover) del texto (queda desactualizado);
 *   - los LEEME propuestos tienen cinco renglones y no nombran a Claude ni a una IA (van a la nube: guardian firma-ia);
 *   - el nombre de la carpeta unica no lo elige el programa: sale de la lista del canon.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    cargarCanon, leerArgs, rutaSalida, raizPrincipal, reTramo, clasificarArchivo, esComentario, taparSecretos, buscarReferencias,
    buscarConAlias, porPc, porArchivo, dependientesDeNubeRutas, planCarpetaUnica, leemes, tipoDeCarpeta, quienEscribe, quienPorNombre,
    fraseEspacio, esNombreComun, mb, tareasDeWindows,
} from '../../scripts/_lib/nubeOrden.mjs';
import { firmaIaEnTexto } from '../../scripts/_lib/firmaIA.mjs';
import { renderSimulado, frenaGuardian, rutasAProbar } from '../../scripts/_nubeSimular.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const canon = cargarCanon();
// sin String.raw: «\x» (de «\xxx») en un template rompe el transformador de vitest aunque node lo acepte
const BIB = ['C:', 'Users', 'u', 'BARACK ARGENTINA SRL', 'Ingeniería y Proyecto - General'].join('\\');

describe('leerArgs y rutaSalida: no entra ninguna ruta y no se escribe afuera de exports/explicaciones', () => {
    it('un argumento desconocido frena (y --aplicar no existe)', () => {
        expect(() => leerArgs(['--aplicar'], ['--nombre', '--archivo'])).toThrow(/desconocido/);
        expect(() => leerArgs(['--nombre'], ['--nombre'])).toThrow(/falta el valor/);
        expect(leerArgs(['--nombre', 'X', '--archivo', 'a.md'], ['--nombre', '--archivo'])).toEqual({ nombre: 'X', archivo: 'a.md' });
    });
    it('la salida es un .md pelado y queda en exports/explicaciones', () => {
        const r = rutaSalida('nube_simulado_2026-10-16.md', RAIZ);
        expect(r).toBe(join(RAIZ, 'exports', 'explicaciones', 'nube_simulado_2026-10-16.md'));
        for (const malo of ['..\\x.md', '../x.md', 'C:\\Users\\x\\BARACK ARGENTINA SRL\\a.md', 'sub/a.md', 'a.txt', '', '..md']) {
            expect(() => rutaSalida(malo, RAIZ), malo).toThrow();
        }
    });
    it('desde un worktree, la salida va al checkout principal (exports/explicaciones esta en .gitignore)', () => {
        expect(raizPrincipal('C:\\Dev\\BarackMercosul\\.claude\\worktrees\\nube-tanda7-1017')).toBe('C:\\Dev\\BarackMercosul');
        expect(raizPrincipal('/home/runner/work/repo')).toBe('/home/runner/work/repo');
    });
    it('los dos programas no tienen ninguna llamada que mueva, borre o copie, y escriben solo en `salida`', () => {
        // (el simulado arma el TEXTO «New-Item ...» para preguntarle al guardian de firma si lo frenaria: no lo ejecuta;
        // por eso los cmdlets se buscan solo en el .ps1)
        for (const f of ['scripts/_nubeSimular.mjs', 'scripts/_nubeMapa.mjs']) {
            const src = readFileSync(join(RAIZ, f), 'utf8');
            expect(src, f).not.toMatch(/\b(?:renameSync|rename|rmSync|rmdirSync|unlinkSync|copyFileSync|cpSync|spawnSync|execSync|exec)\s*\(/);
            const escrituras = src.match(/writeFileSync\([^,]+/g) || [];
            for (const w of escrituras) expect(w, f).toMatch(/writeFileSync\(salida/);
        }
        // el .ps1 escribe solo su JSON de salida (el que le pasa Node, en la carpeta temporal) y no mueve ni borra nada
        const ps = readFileSync(join(RAIZ, 'scripts/_lib/nubeMedir.ps1'), 'utf8');
        expect(ps).not.toMatch(/\b(?:Move-Item|Remove-Item|Copy-Item|Rename-Item|New-Item|Set-Content|Out-File|robocopy|attrib)\b/i);
        expect(ps).not.toMatch(/\.(?:Delete|MoveTo|CopyTo|OpenRead|OpenText|ReadAllBytes|ReadAllText)\(/);
        expect(ps.match(/WriteAllText\(([^,]+)/g)).toEqual(['WriteAllText($Salida']);
        expect(/[^\x00-\x7F]/.test(ps), 'el .ps1 va sin tildes: powershell.exe lo lee como ANSI').toBe(false);
    });
});

describe('buscarReferencias: el nombre como tramo de ruta, codigo separado de texto', () => {
    const arch = [
        { ruta: 'scripts/_lib/pedidosCanon.data.json', origen: 'repo', texto: '{ "que": "la nube de Ingenieria", "carpeta": "FACUNDO" }' },
        { ruta: 'scripts/_arbLanzar.py', origen: 'repo', texto: "USUARIO_DEFAULT = 'FACUNDO'" },
        { ruta: 'scripts/x.mjs', origen: 'repo', texto: "// la biblioteca\nconst a = join(bib, 'VARIOS\\\\FACUNDO');\n// FACUNDO\\ es el canal\nconst b = 'FACUNDO SANTORO';" },
        { ruta: '~/.claude/projects/C--Dev-BarackMercosul/memory/ref.md', origen: 'esta PC', texto: 'La biblioteca: los pedidos van a `FACUNDO\\`.' },
        { ruta: 'scripts/_lib/nubeOrden.mjs', origen: 'repo', texto: "biblioteca 'FACUNDO'" },
    ];
    const fac = canon.carpetas.find((c) => c.nombre === 'FACUNDO');
    const opts = { canon, excluirSiAntes: fac.excluir_si_antes, exigirEnArchivo: fac.exigir_en_archivo };
    const refs = buscarReferencias(arch, 'FACUNDO', opts);
    it('encuentra el canon de pedidos (codigo) y la memoria (texto)', () => {
        expect(refs.map((r) => [r.ruta, r.categoria])).toEqual([
            ['scripts/_lib/pedidosCanon.data.json', 'codigo'],
            ['~/.claude/projects/C--Dev-BarackMercosul/memory/ref.md', 'texto'],
        ]);
    });
    it('no cuenta al usuario del arb, a VARIOS\\FACUNDO, a FACUNDO SANTORO, un comentario ni los programas de la tanda', () => {
        expect(refs.some((r) => /_arbLanzar|scripts\/x\.mjs|nubeOrden\.mjs/.test(r.ruta))).toBe(false);
    });
    it('reTramo distingue mayusculas y pide borde de ruta', () => {
        const re = reTramo('Claude Fak');
        expect("'Claude Fak'".match(re)).not.toBeNull();
        re.lastIndex = 0; expect('...General\\Claude Fak\\claude-memoria'.match(re)).not.toBeNull();
        re.lastIndex = 0; expect('Claude Fakultad'.match(re)).toBeNull();
        re.lastIndex = 0; expect('claude fak\\'.match(re)).toBeNull();
    });
    it('una subcarpeta cuenta solo en un archivo que nombra tambien a su carpeta de arriba', () => {
        const a = [
            { ruta: 'scripts/_mails.py', origen: 'repo', texto: "BASE = '_CUARENTENA_Claude Barack'\nM = join(BASE, 'mails')" },
            { ruta: 'scripts/otro.py', origen: 'repo', texto: "M = join(x, 'mails')" },
        ];
        expect(buscarReferencias(a, 'mails', { canon, tambien: '_CUARENTENA_Claude Barack' }).map((r) => r.ruta)).toEqual(['scripts/_mails.py']);
    });
    it('el nombre de antes de la cuarentena, en minusculas, tambien cuenta (auditor 17/10: mails_area.mjs)', () => {
        const a = [{ ruta: 'tools/claude-area/mails_area.mjs', origen: 'repo', texto: "if (padre.toLowerCase() !== 'claude barack') return null;" }];
        const fila = canon.carpetas.find((c) => c.nombre === '_CUARENTENA_Claude Barack');
        expect(buscarReferencias(a, fila.nombre, { canon })).toHaveLength(0);
        expect(buscarConAlias(a, [fila.nombre, ...fila.alias], { canon }).map((r) => r.ruta)).toEqual(['tools/claude-area/mails_area.mjs']);
    });
    it('un nombre adentro de una expresion regular (|Claude Barack|) cuenta como tramo', () => {
        const a = [{ ruta: 'scripts/_lib/guardianes.mjs', origen: 'repo', texto: 'const RE = /(?:CLAUDE POR AREA|Claude Barack|Base Claude Ingenieria)/i;' }];
        expect(buscarReferencias(a, 'Claude Barack', { canon })).toHaveLength(1);
    });
    it('un nombre comun cuenta solo usado como ruta, y no en el arbol del servidor (revisor-pedido 17/10)', () => {
        const opts = { canon, tambien: ['PROYECTOS'], lineaDeRuta: true, excluirLinea: canon.excluir_linea_si };
        const a = [
            { ruta: 'scripts/_pdfSemielaboradosArb.py', origen: 'repo', texto: "# PROYECTOS\n'ajenos': ('AMAROK','MIRGOR','TAOS')" },
            { ruta: 'scripts/x.mjs', origen: 'repo', texto: "const p = join(bib, 'PROYECTOS', 'TAOS');" },
            { ruta: 'scripts/y.mjs', origen: 'repo', texto: "// PROYECTOS\nconst q = 'TAOS/planos';" },
            { ruta: 'scripts/_lib/vocab.data.json', origen: 'repo', texto: '"PROYECTOS": 1,\n"HO:1- CLIENTES/TAOS/OBSOLETO/x.xlsx"' },
        ];
        expect(buscarReferencias(a, 'TAOS', opts).map((r) => r.ruta)).toEqual(['scripts/x.mjs', 'scripts/y.mjs']);
    });
    it('un nombre con espacios o parentesis no necesita estar pegado a una barra (auditor ronda 2: nubeRutas.mjs)', () => {
        expect(esNombreComun('OBSOLETO')).toBe(true);
        expect(esNombreComun('INGENIERIA BARACK (NUNCA BORRAR)')).toBe(false);
        const a = [{ ruta: 'scripts/_lib/nubeRutas.mjs', origen: 'repo', texto: "// biblioteca\nreturn cand.find((p) => esCarpeta(join(p, 'INGENIERIA BARACK (NUNCA BORRAR)')));" }];
        const n = 'INGENIERIA BARACK (NUNCA BORRAR)';
        expect(buscarReferencias(a, n, { canon, lineaDeRuta: esNombreComun(n), exigirEnArchivo: canon.exigir_biblioteca })).toHaveLength(1);
    });
    it('los dos renglones REALES que el auditor encontro sin listar (mails_area.mjs:437 y guardianes.mjs:535)', () => {
        const mails = "    if (!/^(?:_cuarentena_)?claude barack$/.test(normalizar(path.basename(path.dirname(r))))) return null;";
        expect(buscarReferencias([{ ruta: 'tools/claude-area/mails_area.mjs', origen: 'repo', texto: mails }], 'claude barack', { canon })).toHaveLength(1);
        const guard = String.raw`const FIRMA_EXENTOS_RE = /(?:Ingenier[ií]a y Proyecto - General(?:[\\/][^\\/"'\n]+[\\/]\.\.)?[\\/]Claude Fak(?=[\\/"']|$))/i;`;
        expect(buscarReferencias([{ ruta: 'scripts/_lib/guardianes.mjs', origen: 'repo', texto: guard }], 'Claude Fak', { canon })).toHaveLength(1);
    });
    it('en un canon .json, un campo «_fuente» es una nota, no un dato', () => {
        expect(esComentario('"_fuente": "Carlos Baptista (\'ACTUALIZACION_CLAUDE_LIMPIO\')",', 'tools/claude-area/persona/carlos.json')).toBe(true);
        expect(esComentario('"carpeta": "FACUNDO",', 'scripts/_lib/pedidosCanon.data.json')).toBe(false);
    });
    it('porPc reparte los programas por PC segun los prefijos del canon', () => {
        const items = [
            { ruta: 'tools/claude-area/mails_solo/subir_mails.ps1', carpetas: new Set(['x']) },
            { ruta: 'programa de esta PC: BarackMailsPC/programas/mails_area.mjs', carpetas: new Set(['y']) },
        ];
        const pcs = porPc(items, canon);
        expect(pcs.find((p) => /Carlos/.test(p.pc)).programas.map((x) => x.ruta)).toEqual(['tools/claude-area/mails_solo/subir_mails.ps1']);
        // lo instalado en %LOCALAPPDATA% de esta PC es de esta PC, no de la de Calidad
        expect(pcs.find((p) => /^Esta PC/.test(p.pc)).programas.map((x) => x.ruta)).toContain('programa de esta PC: BarackMailsPC/programas/mails_area.mjs');
        expect(pcs.find((p) => /mails de Calidad/.test(p.pc)).programas).toHaveLength(0);
    });
    it('porArchivo junta los renglones de un mismo archivo', () => {
        const p = porArchivo([{ ruta: 'a', origen: 'repo', linea: 3, texto: 'x', categoria: 'codigo' }, { ruta: 'a', origen: 'repo', linea: 9, texto: 'y', categoria: 'codigo' }]);
        expect(p).toHaveLength(1);
        expect(p[0].lineas).toEqual([3, 9]);
    });
});

describe('clasificarArchivo, comentarios, secretos', () => {
    it('codigo, tarea, texto', () => {
        expect(clasificarArchivo('scripts/_nube.mjs', canon)).toBe('codigo');
        expect(clasificarArchivo('scripts/_lib/pedidosCanon.data.json', canon)).toBe('codigo');
        expect(clasificarArchivo('.claude/rules/nube-ingenieria.md', canon)).toBe('texto');
        expect(clasificarArchivo('~/.claude/scheduled-tasks/barack-mails/SKILL.md', canon)).toBe('tarea');
        expect(clasificarArchivo('schtasks:\\Barack - mi asistente al dia', canon)).toBe('tarea');
        // el encargo de una sesion hija corre una vez: no se rompe nada al mover
        expect(clasificarArchivo('~/.claude/scheduled-tasks/hija-tanda7-nube-20261017/SKILL.md', canon)).toBe('texto');
    });
    it('esComentario segun el lenguaje', () => {
        expect(esComentario('  // Claude Fak', 'a.mjs')).toBe(true);
        expect(esComentario(' * Claude Fak', 'a.mjs')).toBe(true);
        expect(esComentario('# Claude Fak', 'a.py')).toBe(true);
        expect(esComentario('rem "0- INSTALAR CLAUDE"', 'a.cmd')).toBe(true);
        expect(esComentario("const X = 'Claude Fak'; // nube", 'a.mjs')).toBe(false);
        expect(esComentario('# titulo', 'a.md')).toBe(false);
    });
    it('una clave no llega al informe', () => {
        expect(taparSecretos('KEY=sk-ant-api03-abcdefghijklmnop')).toBe('KEY=[clave tapada]');
    });
});

describe('dependientesDeNubeRutas: los que reciben «Claude Fak» de buscarNube()', () => {
    it('cuenta a quien importa nubeRutas y llama a buscarNube, no a quien solo usa buscarBiblioteca', () => {
        const a = [
            { ruta: 'scripts/_nube.mjs', texto: "import { buscarNube } from './_lib/nubeRutas.mjs';\nconst n = buscarNube();" },
            { ruta: 'scripts/_lib/pedidosPendientes.mjs', texto: "import { buscarBiblioteca } from './nubeRutas.mjs';" },
            { ruta: 'scripts/_lib/nubeRutas.mjs', texto: "export function buscarNube() {} // nubeRutas.mjs'" },
            { ruta: 'scripts/_nubeSimular.mjs', texto: "import { buscarNube } from './_lib/nubeRutas.mjs'; buscarNube()" },
        ];
        expect(dependientesDeNubeRutas(a, canon)).toEqual(['scripts/_nube.mjs']);
    });
});

describe('planCarpetaUnica y LEEME', () => {
    const raiz = ['0- INSTALAR CLAUDE (entrar aca)', 'Base Claude Ingenieria', 'Claude Fak', 'FACUNDO', 'INSTALAR EN UNA PC NUEVA', 'MEJORAS CLAUDE',
        '_CUARENTENA_CLAUDE POR AREA', '_CUARENTENA_Claude Barack', 'PROYECTOS', 'VARIOS', '_CUARENTENA_otra'];
    const nombre = canon.nombres_carpeta_unica[0].nombre;
    const { filas, nuevas } = planCarpetaUnica(raiz, canon, nombre);
    const fila = (n) => filas.find((f) => f.nombre === n);
    it('cada carpeta va donde dice el arbol del 08/10; Claude Fak a 5-, los mails a 4-', () => {
        expect(fila('Claude Fak').destino).toBe(`${nombre}\\5- FACUNDO (memoria y configuracion)`);
        expect(fila('INSTALAR EN UNA PC NUEVA').destino).toBe(`${nombre}\\1- INSTALAR (doble clic)`);
        expect(fila('_CUARENTENA_Claude Barack').partes[0].destino).toBe(`${nombre}\\4- MAILS DEL EQUIPO\\mails`);
        expect(fila('Base Claude Ingenieria').destino).toMatch(/9- VIEJO/);
    });
    it('FACUNDO no tiene destino: lo decide Fak, con tres opciones', () => {
        expect(fila('FACUNDO').destino).toBeNull();
        expect(fila('FACUNDO').opciones).toHaveLength(3);
    });
    it('la que ya fue a la Papelera se lista como «ya no esta»; una carpeta nuestra nueva se avisa', () => {
        expect(fila('ACTUALIZACION_CLAUDE_LIMPIO').existe).toBe(false);
        expect(fila('ACTUALIZACION_CLAUDE_LIMPIO').ya_no_esta).toMatch(/Papelera/);
        expect(nuevas).toEqual(['_CUARENTENA_otra']);
    });
    it('los nombres de la carpeta unica no dicen Claude; el del plan del 08/10 queda descartado', () => {
        for (const o of canon.nombres_carpeta_unica) expect(/claude/i.test(o.nombre), o.nombre).toBe(false);
        expect(canon.nombre_descartado.nombre).toBe('CLAUDE BARACK');
        expect(canon.nombres_carpeta_unica[0].nota).toMatch(/15\/10/);
    });
    it('cada LEEME tiene cinco renglones y ninguno nombra a Claude ni a una IA (van a la nube)', () => {
        for (const o of canon.nombres_carpeta_unica) {
            const ls = leemes(canon, o.nombre);
            expect(ls).toHaveLength(canon.destinos.length + 1);
            for (const l of ls) {
                expect(l.renglones, l.carpeta).toHaveLength(5);
                expect(firmaIaEnTexto(l.renglones.join('\n')), l.carpeta).toEqual([]);
                expect(/(?<![A-Za-z])IA(?![A-Za-z])/.test(l.renglones.join(' ')), l.carpeta).toBe(false);
            }
        }
    });
});

describe('el guardian de firma sobre las rutas nuevas (medido con su propia funcion)', () => {
    it('la carpeta unica y sus destinos pasan; lo que viaja adentro de 5- con «claude» en el nombre, no', () => {
        const rutas = rutasAProbar(BIB, 'ASISTENTE INGENIERIA', canon, ['claude-memoria']);
        const frenan = rutas.filter((r) => frenaGuardian(r));
        expect(frenan).toEqual([`${BIB}\\ASISTENTE INGENIERIA\\5- FACUNDO (memoria y configuracion)\\claude-memoria`]);
    });
    it('hoy, Claude Fak colgada de la raiz pasa (por eso la excepcion tiene que seguirla al mover)', () => {
        expect(frenaGuardian(`${BIB}\\Claude Fak\\claude-memoria`)).toBeNull();
    });
});

describe('tipoDeCarpeta y quienEscribe (mapa)', () => {
    it('una regla por nombre; el segundo nivel hereda de su carpeta; lo demas queda «sin clasificar»', () => {
        expect(tipoDeCarpeta('Claude Fak', 1, canon).tipo).toBe('nuestro');
        expect(tipoDeCarpeta('4- MANUALES', 2, canon).tipo).toBe('documento oficial');
        expect(tipoDeCarpeta('5- VIDEOS Y FOTOS', 2, canon).tipo).toBe('material de máquina');
        // el archivo de correo se sigue escribiendo: no es «archivo viejo» (revisor-pedido 17/10)
        expect(tipoDeCarpeta('6- ARCHIVO DE CORREO', 2, canon).tipo).toBe('copia de mails');
        // FACUNDO es la carpeta de trabajo de Fak, con entregables: no «nuestro», y sus hijas tampoco
        const fac = tipoDeCarpeta('FACUNDO', 1, canon);
        expect(fac.tipo).toBe('de una persona');
        expect(tipoDeCarpeta('IMDS evidencias 13-10-2026', 2, canon, fac).tipo).toBe('de una persona');
        const padre = tipoDeCarpeta('PROYECTOS', 1, canon);
        expect(padre.tipo).toBe('entregable');
        expect(tipoDeCarpeta('Mubea', 2, canon, padre)).toMatchObject({ tipo: 'entregable', heredado: true });
        expect(tipoDeCarpeta('FACUNDO', 2, canon, tipoDeCarpeta('VARIOS', 1, canon)).tipo).toBe('de una persona');
        expect(tipoDeCarpeta('zzz', 1, canon).tipo).toBe('sin clasificar');
        // INGENIERIA BARACK (NUNCA BORRAR) no le pasa su tipo a sus hijas
        expect(tipoDeCarpeta('zzz', 2, canon, tipoDeCarpeta('INGENIERIA BARACK (NUNCA BORRAR)', 1, canon)).tipo).toBe('sin clasificar');
    });
    it('quien escribe dice QUIEN, por el nombre y la carpeta del archivo mas nuevo (revisor-pedido 17/10)', () => {
        expect(quienEscribe(null)).toBe('sin dato');
        expect(quienEscribe({ archivos: 0 })).toMatch(/solo carpetas vacías/);
        expect(quienEscribe({ archivos: 3, recientes: 0, ultima: '2025-01-02 10:00' })).toMatch(/nadie en 30 días \(último cambio 2025-01-02\)/);
        const reg = { archivos: 9, recientes: 2, ultima: '2026-10-17 11:40', ultimo_nombre: 'DESKTOP-90DOEFV.jsonl', ultimo_carpeta: '1- GENERAL\\5. 3D\\IMPRESORA BAMBU A2L\\registro' };
        // lo inferido es del archivo mas nuevo, no de la carpeta entera (auditor ronda 2)
        expect(quienEscribe(reg, 1, 30, canon)).toMatch(/^2 cambiados en 30 días; el más nuevo, «DESKTOP-90DOEFV\.jsonl» en 1- GENERAL.*parece de un programa de la casa \(deja un archivo por PC\); la nombra 1 programa/);
        expect(quienPorNombre('2025-07-31_1345_Desarrollo.json', '6- ARCHIVO DE CORREO\\CALIDAD', canon)).toMatch(/archivo de mails/);
        expect(quienPorNombre('PEDIDO 8 - listo.txt', '', canon)).toMatch(/canal de pedidos/);
        expect(quienPorNombre('x.json', '4- BUZON\\avisos\\DESKTOP-OV373UE', canon)).toMatch(/PC del equipo/);
        expect(quienPorNombre('HO-985 - IP PAD REV.A.pdf', 'HO-985', canon)).toBe(canon.quien_por_defecto);
    });
    it('la frase del espacio de C: no afirma «nada se bajó» si el libre bajo mientras se media (auditor 17/10)', () => {
        const G = 1024 ** 3;
        expect(fraseEspacio(5.8 * G, 5.79 * G)).toMatch(/prácticamente igual/);
        const baja = fraseEspacio(5.8 * G, 4.7 * G);
        expect(baja).toMatch(/bajó 1,10 GB mientras se medía/);
        expect(baja).not.toMatch(/no se baja\./);
    });
    it('mb en castellano', () => {
        expect(mb(1024 * 1024 * 1.5)).toBe('1,5 MB');
        expect(mb(1024 ** 3 * 7.3)).toBe('7,3 GB');
    });
    it('tareasDeWindows: un renglon por tarea, sin el encabezado ni repetidos', () => {
        const csv = '"Nombre de host","Nombre de tarea","Hora"\r\n"PC","\\Barack - mails","x Claude Fak"\r\n"PC","\\Barack - mails","y"\r\n"PC","\\Otra","z"';
        expect(tareasDeWindows(csv).map((t) => t.ruta)).toEqual(['schtasks:\\Barack - mails', 'schtasks:\\Otra']);
    });
});

describe('renderSimulado con datos de mentira', () => {
    const nombre = 'ASISTENTE INGENIERIA';
    const plan = planCarpetaUnica(['Claude Fak', 'FACUNDO', '_CUARENTENA_Claude Barack'], canon, nombre);
    const vacio = { archivos: 0, bytes: 0, archivos_disco: 0, bytes_disco: 0, sin_subir: 0, recientes: 0, ultima: null };
    const medicion = {
        medido: '2026-10-17 11:00', libre_antes: 5e9, libre_despues: 5e9,
        carpetas: [
            { nombre: 'Claude Fak', existe: true, terminado: false, total: { ...vacio, archivos: 10, bytes: 2e9, bytes_disco: 1e9, ultima: '2026-10-17 10:00' }, sub: {} },
            { nombre: 'FACUNDO', existe: true, terminado: true, total: { ...vacio, archivos: 4 }, sub: {} },
            { nombre: '_CUARENTENA_Claude Barack', existe: true, terminado: true, total: { ...vacio, archivos: 2 }, sub: { mails: { ...vacio, archivos: 1 } } },
        ],
    };
    const refs = new Map([['Claude Fak', [{ ruta: 'scripts/_lib/nubeRutas.mjs', origen: 'repo', linea: 30, texto: "export const CARPETA_EN_INGENIERIA = 'Claude Fak';", categoria: 'codigo' }]]]);
    const md = renderSimulado({ canon, nombreUnico: nombre, plan, medicion, refs, dependNubeRutas: ['scripts/_nube.mjs'], guardian: [], noLeidos: [], chats: 'renglon de los chats', forma: [] });
    it('dice que no se movio nada, pide el si, las dos opciones de nombre y la decision de FACUNDO', () => {
        expect(md).toMatch(/nada se movió ni se borró/);
        expect(md).toMatch(/El sí a este simulado/);
        for (const o of canon.nombres_carpeta_unica) expect(md).toContain(`«${o.nombre}»`);
        expect(md).toMatch(/Qué hacemos con `FACUNDO`/);
    });
    it('una carpeta que no termino de medirse lo dice, no da el numero como total', () => {
        expect(md).toMatch(/\| `Claude Fak` \| `ASISTENTE INGENIERIA\\5- FACUNDO \(memoria y configuracion\)` \| 10 \(no terminó\)/);
    });
    it('trae los LEEME, el renglon de los chats y los programas que dependen de nubeRutas', () => {
        expect(md).toContain('ASISTENTE INGENIERIA\\LEEME.txt');
        expect(md).toContain('renglon de los chats');
        expect(md).toContain('`scripts/_nube.mjs`');
        expect(md).toContain('scripts/_lib/nubeRutas.mjs');
    });
});

describe('separador de rutas', () => {
    it('rutaSalida usa el separador del sistema', () => {
        expect(rutaSalida('a.md', RAIZ).startsWith(join(RAIZ, 'exports', 'explicaciones') + sep)).toBe(true);
    });
});
