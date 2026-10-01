// @vitest-environment node
/**
 * Pruebas del buscador de "un Claude por area" (tools/claude-area/buscar/):
 *   - indexar.mjs   parte cada documento en secciones y arma el indice (SQLite + FTS5 de node:sqlite)
 *   - buscar.mjs    devuelve pasajes con documento, revision, seccion, renglones, original y recorte
 *   - cita.mjs      comprueba que una frase citada esta de verdad en el documento
 *
 * Todo corre contra un conocimiento CHICO armado en una carpeta temporal: nada toca el conocimiento
 * real ni la nube. Los programas se corren como los corre una PC (un proceso de Node por llamada),
 * porque lo que importa es el codigo de salida, lo que sale por stdout y que stderr quede vacio.
 *
 * Las dos direcciones: lo bueno se encuentra (con y sin tilde) y lo malo se frena (cita inventada,
 * area que no existe, indice viejo, carpeta vacia, caracteres raros en la consulta).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    normalizar, raiz, analizarConsulta, partirEnSecciones, leerTexto, buscarFrase, normalizarFrase,
    cargarSqlite, abrirIndice, buscarPasajes,
} from '../../tools/claude-area/buscar/lib.mjs';

// cada prueba levanta procesos de Node: con la PC cargada tardan mas que los 15 s de la config general
vi.setConfig({ testTimeout: 120000, hookTimeout: 120000 });

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = path.join(REPO, 'tools', 'claude-area', 'buscar');
const INDEXAR = path.join(DIR, 'indexar.mjs');
const BUSCAR = path.join(DIR, 'buscar.mjs');
const CITA = path.join(DIR, 'cita.mjs');

const temporales = [];
function carpetaTemporal(prefijo = 'claude-area-buscar-') {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefijo));
    temporales.push(d);
    return d;
}
afterAll(() => {
    for (const d of temporales) fs.rmSync(d, { recursive: true, force: true });
});

function correr(script, args = []) {
    const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    return { codigo: r.status, out: r.stdout || '', err: r.stderr || '' };
}

function escribir(raizConocimiento, rel, contenido) {
    const ruta = path.join(raizConocimiento, ...rel.split('/'));
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(ruta, contenido);
    return ruta;
}

const FUENTE_010 = 'Y:/BARACK/CALIDAD/DOCUMENTACION SGC/SISTEMA/SISTEMA SGC/Instructivos/CALIDAD/I-AC-010 Proceso de notificacion al proveedor A.doc';

const DOC_010 = [
    '---',
    `fuente: "${FUENTE_010}"`,
    'rev: "A"',
    'extraido: 2026-10-01',
    '---',
    '',
    '# I-AC-010 Proceso de notificacion al proveedor (rev A)',
    '1.  PROPOSITO.',
    '',
    'Establecer las pautas para la notificación al proveedor del material no conforme.',
    '',
    '2.  ALCANCE.',
    '',
    'Aplica a todos los materiales comprados que presenten no conformidades en la recepción.',
    '',
    '5.  METODOLOGIA.',
    '',
    '5.1. Criterio de apertura.',
    '',
    'Una Notificación al proveedor se emite cuando la inspección de recepción detecta un defecto.',
    '',
    '5.2. Plazos de envío.',
    '',
    'La notificación se envía al proveedor dentro de las 48 horas de detectado el defecto.  El proveedor responde en 15 días.',
    'Si el proveedor no contesta, se escala al responsable de compras.',
    '',
    '6.  REVISION HISTORICA.',
    '',
    '09-18 | A | EMISIÓN INICIAL',
].join('\n') + '\n';

const DOC_018 = [
    '---',
    'fuente: "Y:/BARACK/CALIDAD/DOCUMENTACION SGC/SISTEMA/SISTEMA SGC/Instructivos/CALIDAD/I-AC-018 Calib.de cintas metricas y reglas metalicas D.doc"',
    'rev: "D"',
    'extraido: 2026-10-01',
    '---',
    '',
    '# I-AC-018 Calib.de cintas metricas y reglas metalicas (rev D)',
    '1.  PROPOSITO.',
    '',
    'Establecer las pautas de calibración para las cintas métricas y reglas metálicas.',
    '',
    '5.  METODOLOGIA.',
    '',
    '5.1. Control visual.',
    '',
    'Antes de cada calibración se revisa la cinta métrica: sin dobleces ni borrado de escala.',
    'La inspección visual la hace el auxiliar de laboratorio.',
    '',
    '5.2. Calibración.',
    '',
    'Extender la cinta métrica paralela al patrón y relevar las desviaciones. Con tres piezas fuera de tolerancia seguidas se para la línea.',
].join('\n') + '\n';

const DOC_LOGISTICA = [
    '---',
    'fuente: "Y:/BARACK/CALIDAD/DOCUMENTACION SGC/SISTEMA/SISTEMA SGC/Instructivos/LOGISTICA/I-LG-001 Recepcion de materias primas C.doc"',
    'rev: "C"',
    'extraido: 2026-10-01',
    '---',
    '',
    '# I-LG-001 Recepcion de materias primas (rev C)',
    '1.  PROPOSITO.',
    '',
    'Fijar como se recibe la materia prima.',
    '',
    '5.  METODOLOGIA.',
    '',
    '5.1. Descarga.',
    '',
    'El camion se descarga con montacargas. La inspección visual del embalaje se hace antes de firmar el remito.',
].join('\n') + '\n';

const FICHA_CALIDAD = [
    '---',
    'titulo: Ficha de conocimiento - Area CALIDAD',
    'version: 2 (actualizada el 01/10/2026)',
    'estado: MATERIAL PROPIO, NO OFICIAL',
    '---',
    '',
    '# Ficha de conocimiento - Area CALIDAD',
    '',
    '## 1. Encabezado',
    '',
    'Esta ficha es del area de Calidad.',
    '',
    '## 3. Preguntas tipicas',
    '',
    '**17. ¿Que hago si aparece una pieza mala, tres seguidas?** Parar la linea y avisar al responsable de calidad.',
].join('\n') + '\n';

// un documento sin titulos ni numerales: 100 renglones -> bloques de ~40
const SIN_TITULOS = Array.from({ length: 100 }, (_, i) => `renglon ${i + 1} de relleno del registro${i + 1 === 70 ? ' con la temperatura del horno medida cada hora' : ''}`).join('\n') + '\n';

// con BOM y CRLF, y con una ene
const DOC_BOM = '\ufeff' + ['# P-98 Documento con BOM (rev B)', '1.  PROPOSITO.', '', 'El Ñandú es un ave. La señalización del pasillo.', '', '2.  ALCANCE.', '', 'Todo el sector.'].join('\r\n') + '\r\n';

function armarConocimiento() {
    const k = carpetaTemporal('conocimiento-');
    escribir(k, 'LEEME.md', '# Conocimiento\n\nEsta carpeta tiene lo que lleva el asistente de cada area.\n');
    escribir(k, 'comun/extractos/I-AC-010 Proceso de notificacion al proveedor.md', DOC_010);
    escribir(k, 'comun/extractos/P-98 Documento con BOM.md', DOC_BOM);
    escribir(k, 'calidad/extractos/I-AC-018 Calib.de cintas metricas y reglas metalicas.md', DOC_018);
    escribir(k, 'calidad/ficha.md', FICHA_CALIDAD);
    escribir(k, 'logistica/extractos/I-LG-001 Recepcion de materias primas.md', DOC_LOGISTICA);
    escribir(k, 'produccion/extractos/Registro sin titulos.md', SIN_TITULOS);
    escribir(k, 'produccion/personas.json', '{ "no": "se indexa" }');
    return k;
}

function hashes(dir) {
    const out = {};
    const rec = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) rec(p);
            else out[path.relative(dir, p)] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') + ':' + fs.statSync(p).mtimeMs;
        }
    };
    rec(dir);
    return out;
}

/** Arma el conocimiento chico y su indice; devuelve las dos carpetas. */
let K; // conocimiento
let I; // salida del indice
const buscar = (consulta, extra = []) => correr(BUSCAR, [consulta, '--indice', I, ...extra]);
const buscarJson = (consulta, extra = []) => {
    const r = buscar(consulta, [...extra, '--json']);
    expect(r.codigo).toBe(0);
    return JSON.parse(r.out);
};

beforeAll(() => {
    K = armarConocimiento();
    I = carpetaTemporal('indice-');
    const r = correr(INDEXAR, [K, I]);
    expect(r.err).toBe('');
    expect(r.codigo).toBe(0);
});

// ---------------------------------------------------------------------------------------------
describe('texto: tildes, mayusculas y plurales', () => {
    it('normalizar saca tildes, ene y mayusculas', () => {
        expect(normalizar('Inspección Ñandú MÉTRICAS')).toBe('inspeccion nandu metricas');
    });

    it('raiz junta singular y plural, masculino y femenino', () => {
        expect(raiz('piezas')).toBe('pieza');
        expect(raiz('calibraciones')).toBe('calibracion');
        expect(raiz('proveedores')).toBe('proveedor');
        expect(raiz('seguidas')).toBe('seguid');
        expect(raiz('seguidas')).toBe(raiz('seguido'));
        expect(raiz('5.2')).toBe('5.2'); // lo que no es una palabra no se toca
    });

    it('la consulta saca las palabras vacias, deja los codigos y los numerales como frase', () => {
        const q = analizarConsulta('¿Que dice el I-AC-018 sobre la seccion 5.2.3?');
        const claves = q.terminos.map((t) => `${t.tipo}:${t.partes.join(' ')}`);
        expect(claves).toContain('frase:i ac 018');
        expect(claves).toContain('frase:5 2 3');
        expect(claves.some((c) => c === 'palabra:que' || c === 'palabra:sobre')).toBe(false);
        expect(analizarConsulta('"cintas métricas"').terminos[0]).toMatchObject({ tipo: 'frase', partes: ['cintas', 'metricas'] });
    });
});

// ---------------------------------------------------------------------------------------------
describe('partir en secciones', () => {
    const doc010 = partirEnSecciones(DOC_010, 'I-AC-010 Proceso de notificacion al proveedor.md');
    const lineas010 = DOC_010.split('\n');

    it('por numerales: cada seccion trae su numeral, su titulo y los renglones REALES del archivo', () => {
        expect(doc010.modo).toBe('numerales');
        const s52 = doc010.secciones.find((s) => s.numeral === '5.2');
        expect(s52).toBeTruthy();
        expect(s52.titulo).toBe('Plazos de envío');
        // el renglon `desde` es el del titulo "5.2." y el texto guardado es exactamente lo que dice el archivo
        expect(lineas010[s52.desde - 1].startsWith('5.2.')).toBe(true);
        expect(s52.texto).toBe(lineas010.slice(s52.desde - 1, s52.hasta).join('\n'));
        expect(s52.texto).toContain('48 horas');
        expect(doc010.secciones.map((s) => s.numeral)).toEqual(['1', '2', '5.1', '5.2', '6']);
    });

    it('toma el codigo del nombre, la revision y el original de la cabecera', () => {
        expect(doc010.codigo).toBe('I-AC-010');
        expect(doc010.rev).toBe('A');
        expect(doc010.fuente).toBe(FUENTE_010);
        expect(doc010.documento).toBe('I-AC-010 Proceso de notificacion al proveedor');
    });

    it('por titulos #: sin codigo en el nombre, usa version como revision', () => {
        const d = partirEnSecciones(FICHA_CALIDAD, 'ficha.md');
        expect(d.modo).toBe('titulos');
        expect(d.codigo).toBe('');
        expect(d.rev).toBe('v2');
        expect(d.secciones.map((s) => s.titulo)).toContain('Preguntas tipicas');
        expect(d.secciones.find((s) => s.titulo === 'Preguntas tipicas').numeral).toBe('3');
    });

    it('sin titulos ni numerales: bloques de ~40 renglones que juntos cubren TODO el archivo', () => {
        const d = partirEnSecciones(SIN_TITULOS, 'Registro sin titulos.md');
        expect(d.modo).toBe('bloques');
        expect(d.secciones.length).toBeGreaterThanOrEqual(2);
        for (const s of d.secciones) expect(s.hasta - s.desde + 1).toBeLessThanOrEqual(60);
        expect(d.secciones[0].desde).toBe(1);
        expect(d.secciones.at(-1).hasta).toBe(100);
        d.secciones.slice(1).forEach((s, i) => expect(s.desde).toBe(d.secciones[i].hasta + 1));
    });

    it('una seccion de mas de 60 renglones se parte en partes numeradas', () => {
        const larga = ['# Doc (rev A)', '1.  PROPOSITO.', 'uno', '5.  METODOLOGIA.', ...Array.from({ length: 130 }, (_, i) => `paso ${i}`), '7.  RESPONSABLES.', 'todos'].join('\n');
        const d = partirEnSecciones(larga, 'X-01 Doc.md');
        const metodologia = d.secciones.filter((s) => s.numeral === '5');
        expect(metodologia.length).toBeGreaterThanOrEqual(3);
        expect(metodologia[0].titulo).toMatch(/\(parte 1\/\d+\)$/);
    });

    it('un titulo suelto, sin nada abajo, se pega a la seccion que sigue', () => {
        const d = partirEnSecciones(['# Doc (rev A)', '1.  PROPOSITO.', 'uno', '5.  METODOLOGIA.', '5.1. Primero.', 'el contenido de 5.1', '5.2. Segundo.', 'el contenido de 5.2'].join('\n'), 'X-01 Doc.md');
        const s51 = d.secciones.find((s) => s.numeral === '5.1');
        expect(s51.texto).toContain('5.  METODOLOGIA.');
        expect(s51.texto).toContain('el contenido de 5.1');
    });

    it('un archivo con BOM y renglones CRLF se lee bien y la ene se encuentra sin ene', () => {
        const d = partirEnSecciones(leerTexto(Buffer.from(DOC_BOM, 'utf8')), 'P-98 Documento con BOM.md');
        expect(d.codigo).toBe('P-98');
        expect(d.rev).toBe('B');
        expect(d.secciones[0].texto.includes('\r')).toBe(false);
        expect(normalizar(d.secciones[0].texto)).toContain('nandu');
    });
});

// ---------------------------------------------------------------------------------------------
describe('indexar', () => {
    it('guarda la fecha y el sha256 de cada archivo indexado', () => {
        const meta = JSON.parse(fs.readFileSync(path.join(I, 'indice.json'), 'utf8'));
        expect(meta.creado).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
        const ruta = 'comun/extractos/I-AC-010 Proceso de notificacion al proveedor.md';
        expect(meta.sha256_por_archivo[ruta].sha256).toBe(crypto.createHash('sha256').update(DOC_010).digest('hex'));
        // el .json de personas y nada que no sea .md/.txt se deja afuera
        expect(Object.keys(meta.sha256_por_archivo).some((r) => r.endsWith('.json'))).toBe(false);
        expect(meta.archivos).toBe(7);
        expect(meta.archivos).toBe(Object.keys(meta.sha256_por_archivo).length);
        expect(fs.existsSync(path.join(I, 'indice.db'))).toBe(true);
    });

    it('cada seccion del indice lleva area, archivo, codigo, revision, original, titulo y renglones', () => {
        const r = buscarJson('plazos de envio', ['--max', '1']);
        const p = r.resultados[0];
        expect(p).toMatchObject({
            area: 'comun', codigo: 'I-AC-010', rev: 'A', fuente: FUENTE_010, numeral: '5.2', titulo: 'Plazos de envío',
        });
        expect(p.archivo).toBe('comun/extractos/I-AC-010 Proceso de notificacion al proveedor.md');
        const lineas = DOC_010.split('\n');
        expect(lineas[p.desde - 1]).toMatch(/^5\.2\./);
        expect(p.hasta).toBeGreaterThanOrEqual(p.desde);
    });

    it('no escribe nada en el conocimiento y reemplazar el indice no deja temporales', () => {
        const antes = hashes(K);
        const salida = carpetaTemporal('indice-dos-');
        expect(correr(INDEXAR, [K, salida]).codigo).toBe(0);
        expect(correr(INDEXAR, [K, salida]).codigo).toBe(0); // dos veces: la segunda reemplaza
        expect(hashes(K)).toEqual(antes);
        expect(fs.readdirSync(salida).sort()).toEqual(['indice.db', 'indice.json']);
    });

    it('una carpeta vacia no rompe: indice vacio, y buscar dice "sin resultados"', () => {
        const vacia = carpetaTemporal('conocimiento-vacio-');
        const salida = carpetaTemporal('indice-vacio-');
        const r = correr(INDEXAR, [vacia, salida]);
        expect(r.codigo).toBe(0);
        expect(r.err).toBe('');
        expect(r.out).toMatch(/No encontré documentos/);
        const b = correr(BUSCAR, ['inspeccion', '--indice', salida]);
        expect(b.codigo).toBe(0);
        expect(b.out).toMatch(/Sin resultados/);
        expect(b.err).toBe('');
        const j = JSON.parse(correr(BUSCAR, ['inspeccion', '--indice', salida, '--json']).out);
        expect(j.resultados).toEqual([]);
    });

    it('una carpeta que no existe, una opcion que no existe y argumentos que faltan: error corto, codigo 1, nada escrito', () => {
        const salida = path.join(carpetaTemporal('indice-nada-'), 'no-debe-existir');
        const a = correr(INDEXAR, [path.join(os.tmpdir(), 'no-existe-esta-carpeta-xyz'), salida]);
        expect(a.codigo).toBe(1);
        expect(a.err).toMatch(/^Error: No existe la carpeta/);
        expect(a.err.trim().split('\n')).toHaveLength(1);
        const b = correr(INDEXAR, [K, salida, '--rapido']);
        expect(b.codigo).toBe(1);
        expect(b.err).toMatch(/--rapido/);
        expect(correr(INDEXAR, [K]).codigo).toBe(1);
        expect(fs.existsSync(salida)).toBe(false);
    });

    it('--help muestra el uso y sale con 0', () => {
        for (const p of [INDEXAR, BUSCAR, CITA]) {
            const r = correr(p, ['--help']);
            expect(r.codigo).toBe(0);
            expect(r.out).toMatch(/^Uso:/);
        }
    });
});

// ---------------------------------------------------------------------------------------------
describe('buscar', () => {
    it('encuentra con y sin tilde, con mayusculas y en plural: siempre el mismo pasaje', () => {
        const formas = ['inspeccion', 'inspección', 'INSPECCIÓN', 'Inspeccion de recepcion', 'inspecciones'];
        const archivos = formas.map((q) => buscarJson(q, ['--area', 'calidad', '--max', '1']).resultados[0]?.archivo);
        expect(archivos.every(Boolean)).toBe(true);
        // las cuatro primeras formas dan exactamente el mismo primer pasaje
        expect(new Set(archivos.slice(0, 3)).size).toBe(1);
        expect(buscarJson('nandu').resultados[0].archivo).toMatch(/P-98/);
        expect(buscarJson('Ñandú').resultados[0].archivo).toMatch(/P-98/);
        expect(buscarJson('cintas metricas').resultados[0].codigo).toBe('I-AC-018');
        expect(buscarJson('cintas métricas').resultados[0].codigo).toBe('I-AC-018');
        expect(buscarJson('calibraciones').resultados[0].codigo).toBe('I-AC-018'); // el texto dice "calibración"
        expect(buscarJson('piezas malas').resultados.length).toBeGreaterThan(0);
    });

    it('devuelve documento, revision, seccion, renglones, ruta del original y un recorte con las palabras', () => {
        const r = buscar('notificacion proveedor plazos', ['--max', '1']);
        expect(r.codigo).toBe(0);
        expect(r.err).toBe('');
        expect(r.out).toMatch(/\[1\] I-AC-010 Proceso de notificacion al proveedor · rev A/);
        expect(r.out).toMatch(/sección: 5\.2 Plazos de envío · renglones \d+-\d+ · comun/);
        expect(r.out).toContain(`original: ${FUENTE_010}`);
        expect(r.out).toContain('extracto: comun/extractos/I-AC-010 Proceso de notificacion al proveedor.md');
        // el recorte tiene de 2 a 3 renglones, cada uno con su numero de renglon real, y trae la palabra
        const recorte = r.out.split('\n').filter((l) => /^\s+\d+ \| /.test(l));
        expect(recorte.length).toBeGreaterThanOrEqual(2);
        expect(recorte.length).toBeLessThanOrEqual(4);
        expect(recorte.some((l) => /notificación se envía al proveedor dentro de las 48 horas/.test(l))).toBe(true);
        const lineas = DOC_010.split('\n');
        for (const l of recorte) {
            const m = /^\s+(\d+) \| (.*)$/.exec(l);
            expect(lineas[Number(m[1]) - 1].replace(/\s+/g, ' ').trim().startsWith(m[2].replace(/…$/, '').trim().slice(0, 40))).toBe(true);
        }
    });

    it('--json trae los mismos campos para un programa', () => {
        const j = buscarJson('notificacion', ['--max', '2']);
        expect(j.consulta).toBe('notificacion');
        expect(j.indice.archivos).toBe(7);
        expect(j.indice.creado).toMatch(/^\d{4}-/);
        expect(j.resultados.length).toBeLessThanOrEqual(2);
        for (const p of j.resultados) {
            expect(Object.keys(p)).toEqual(expect.arrayContaining(['area', 'archivo', 'codigo', 'documento', 'rev', 'fuente', 'numeral', 'titulo', 'desde', 'hasta', 'puntaje', 'recorte', 'ruta']));
            expect(fs.existsSync(p.ruta)).toBe(true);
        }
    });

    it('--area busca en comun + esa area y NO devuelve lo de otra area', () => {
        // "montacargas" solo esta en logistica
        expect(buscar('montacargas', ['--area', 'calidad']).out).toMatch(/Sin resultados/);
        expect(buscarJson('montacargas', ['--area', 'logistica']).resultados[0].area).toBe('logistica');
        // "inspeccion" esta en comun, calidad y logistica
        const todas = buscarJson('inspeccion', ['--max', '20']).resultados.map((p) => p.area);
        expect(new Set(todas).has('logistica')).toBe(true);
        const deCalidad = buscarJson('inspeccion', ['--area', 'calidad', '--max', '20']).resultados.map((p) => p.area);
        expect(deCalidad.length).toBeGreaterThan(0);
        expect(deCalidad.every((a) => a === 'calidad' || a === 'comun')).toBe(true);
        // el area se escribe como sea: con mayusculas y tilde da lo mismo
        const deLogistica = buscarJson('inspeccion', ['--area', 'LOGÍSTICA', '--max', '20']).resultados.map((p) => p.area);
        expect(deLogistica.length).toBeGreaterThan(0);
        expect(deLogistica.every((a) => a === 'logistica' || a === 'comun')).toBe(true);
    });

    it('un area que no existe da un error que lista las que hay', () => {
        const r = buscar('inspeccion', ['--area', 'finanzas']);
        expect(r.codigo).toBe(1);
        expect(r.err).toMatch(/No hay documentos del área «finanzas»/);
        expect(r.err).toMatch(/calidad/);
        expect(r.out).toBe('');
    });

    it('un codigo (I-AC-018) y un numeral (5.2) se buscan como frase; las palabras vacias no cuentan', () => {
        const porCodigo = buscarJson('I-AC-018').resultados;
        expect(porCodigo.length).toBeGreaterThan(0);
        expect(porCodigo.every((p) => p.codigo === 'I-AC-018')).toBe(true);
        expect(analizarConsulta('que dice el i-ac-018 sobre calibracion').terminos.map((t) => t.partes.join(' '))).toEqual(['i ac 018', 'calibracion']);
        expect(buscarJson('que dice el i-ac-018 sobre calibracion', ['--max', '1']).resultados[0].codigo).toBe('I-AC-018');
        expect(buscarJson('"tres piezas"').resultados[0].codigo).toBe('I-AC-018');
    });

    it('primero salen las secciones con TODAS las palabras; despues las que traen algunas', () => {
        const r = buscarJson('calibracion tolerancia montacargas', ['--max', '5']).resultados;
        expect(r[0].codigo).toBe('I-AC-018'); // tiene calibracion y tolerancia
        expect(r.some((p) => p.coinciden < p.de)).toBe(true);
        expect(r[0].coinciden).toBeGreaterThanOrEqual(r.at(-1).coinciden);
    });

    it('--max limita los pasajes y --solo-documentos deja afuera las fichas', () => {
        expect(buscarJson('calidad', ['--max', '1']).resultados).toHaveLength(1);
        expect(buscarJson('calidad', ['--max', '20']).resultados.some((p) => p.archivo === 'calidad/ficha.md')).toBe(true);
        expect(buscarJson('calidad', ['--max', '20', '--solo-documentos']).resultados.every((p) => p.fuente)).toBe(true);
        expect(buscar('calidad', ['--max', '0']).codigo).toBe(1);
        expect(buscar('calidad', ['--max', 'muchos']).err).toMatch(/--max/);
    });

    it('lo que no esta da "sin resultados" con codigo 0; lo vacio y lo raro no rompen nada', async () => {
        const nada = buscar('xyzzyplugh');
        expect(nada.codigo).toBe(0);
        expect(nada.out).toMatch(/Sin resultados para «xyzzyplugh»/);
        // signos que el motor de busqueda lee como operadores: ninguno puede romper la consulta
        const raras = ['"', '""', '(', ')', '*', '"inspeccion', 'inspeccion*', 'a" OR "b', 'NEAR(a b)', 'AND OR NOT', "d'angelo", '{titulo}:x', 'col:valor', '^x', '5.2.', '\\', ';--', '50%', '-inspeccion', '+', '"*"', 'texto: AND'];
        const { DatabaseSync } = await cargarSqlite();
        const db = abrirIndice(DatabaseSync, path.join(I, 'indice.db'));
        try {
            for (const q of raras) {
                expect(() => buscarPasajes(db, q, { max: 5 }), `consulta ${q}`).not.toThrow();
            }
            expect(buscarPasajes(db, '"inspeccion*').resultados.length).toBeGreaterThan(0);
        } finally {
            db.close();
        }
        const porCli = buscar('a" OR "b');
        expect(porCli.err).toBe('');
        expect(porCli.codigo).toBe(0);
        // solo signos: no hay nada que buscar, error corto
        const vacio = buscar('¿?!');
        expect(vacio.codigo).toBe(1);
        expect(vacio.err).toMatch(/^Error: No hay nada que buscar/);
    });

    it('un documento sin titulos se encuentra por su bloque, con el renglon real', () => {
        const p = buscarJson('temperatura del horno').resultados[0];
        expect(p.archivo).toBe('produccion/extractos/Registro sin titulos.md');
        expect(p.desde).toBeLessThanOrEqual(70);
        expect(p.hasta).toBeGreaterThanOrEqual(70);
        expect(p.recorte.find((x) => /temperatura/.test(x.texto)).n).toBe(70);
        expect(p.rev).toBe('');
        const texto = buscar('temperatura del horno').out;
        expect(texto).toMatch(/sin revisión/);
        expect(texto).toMatch(/no es un documento del SGC/);
    });

    it('sin indice: dice donde lo busco y sale con 1; sin el cartel experimental de node:sqlite', () => {
        const r = correr(BUSCAR, ['inspeccion', '--indice', path.join(os.tmpdir(), 'no-hay-indice-aca', 'indice.db')]);
        expect(r.codigo).toBe(1);
        expect(r.err).toMatch(/No encuentro el índice/);
        const ok = buscar('inspeccion');
        expect(ok.err).toBe('');
        expect(ok.err).not.toMatch(/Experimental/);
        expect(correr(BUSCAR, []).codigo).toBe(1);
        expect(buscar('x', ['--no-existe']).err).toMatch(/--no-existe/);
    });
});

// ---------------------------------------------------------------------------------------------
describe('indice viejo', () => {
    function armarPar() {
        const k = armarConocimiento();
        const i = carpetaTemporal('indice-viejo-');
        expect(correr(INDEXAR, [k, i]).codigo).toBe(0);
        return { k, i };
    }
    const consultar = (i, extra = []) => correr(BUSCAR, ['notificacion', '--indice', i, ...extra]);

    it('al dia: ningun aviso', () => {
        const { i } = armarPar();
        const r = consultar(i);
        expect(r.out).not.toMatch(/AVISO/);
        expect(r.out).toMatch(/pasaje/);
    });

    it('un archivo cambio despues de armar el indice: lo avisa en UNA linea, con cual y que hacer', () => {
        const { k, i } = armarPar();
        const f = path.join(k, 'comun', 'extractos', 'I-AC-010 Proceso de notificacion al proveedor.md');
        fs.writeFileSync(f, DOC_010.replace('48 horas', '24 horas'));
        const r = consultar(i);
        expect(r.codigo).toBe(0);
        const aviso = r.out.split('\n').filter((l) => l.startsWith('AVISO'));
        expect(aviso).toHaveLength(1);
        expect(aviso[0]).toMatch(/1 cambiaron/);
        expect(aviso[0]).toContain('I-AC-010 Proceso de notificacion al proveedor.md');
        expect(aviso[0]).toMatch(/indexar\.mjs/);
        expect(r.out.split('\n')[0]).toBe(aviso[0]); // el aviso va primero
        expect(JSON.parse(consultar(i, ['--json']).out).aviso).toBe(aviso[0]);
    });

    it('un archivo nuevo o uno que ya no esta tambien se avisa; volver a indexar lo arregla', () => {
        const { k, i } = armarPar();
        escribir(k, 'compras/extractos/I-CO-001 Compras.md', '# I-CO-001 Compras (rev A)\n1.  PROPOSITO.\n\nComprar.\n');
        expect(consultar(i).out).toMatch(/AVISO.*1 nuevos/);
        fs.unlinkSync(path.join(k, 'logistica', 'extractos', 'I-LG-001 Recepcion de materias primas.md'));
        expect(consultar(i).out).toMatch(/AVISO.*1 nuevos, 1 ya no están/);
        expect(correr(INDEXAR, [k, i]).codigo).toBe(0);
        expect(consultar(i).out).not.toMatch(/AVISO/);
    });

    it('un archivo con fecha nueva pero el mismo texto (se copio de nuevo) NO da falsa alarma', () => {
        const { k, i } = armarPar();
        const f = path.join(k, 'comun', 'extractos', 'I-AC-010 Proceso de notificacion al proveedor.md');
        const futuro = new Date(Date.now() + 3 * 3600 * 1000);
        fs.utimesSync(f, futuro, futuro);
        expect(consultar(i).out).not.toMatch(/AVISO/);
    });

    it('si el conocimiento no esta a mano (otra PC), busca igual y no avisa nada', () => {
        const { k, i } = armarPar();
        fs.renameSync(k, k + '-movida');
        temporales.push(k + '-movida');
        const r = consultar(i);
        expect(r.codigo).toBe(0);
        expect(r.out).toMatch(/pasaje/);
        expect(r.out).not.toMatch(/AVISO/);
        // y con --conocimiento apuntando a la carpeta nueva sigue al dia
        expect(consultar(i, ['--conocimiento', k + '-movida']).out).not.toMatch(/AVISO/);
    });
});

// ---------------------------------------------------------------------------------------------
describe('cita', () => {
    const rel010 = 'comun/extractos/I-AC-010 Proceso de notificacion al proveedor.md';
    const abs010 = () => path.join(K, ...rel010.split('/'));
    const renglon = (texto) => DOC_010.split('\n').findIndex((l) => l.includes(texto)) + 1;

    it('una cita buena pasa aunque cambien tildes, mayusculas y espacios, y dice el renglon', () => {
        const r = correr(CITA, ['LA NOTIFICACION   se envia al   proveedor dentro de las 48 horas', abs010()]);
        expect(r.codigo).toBe(0);
        expect(r.out).toMatch(new RegExp(`^OK: la frase está en .*, renglón ${renglon('48 horas')}\\.`));
        expect(r.out).toContain('Documento: I-AC-010 Proceso de notificacion al proveedor · rev A · sección 5.2 Plazos de envío');
        expect(r.out).toContain(`Original: ${FUENTE_010}`);
        expect(r.err).toBe('');
        // la frase tal cual, con tildes y doble espacio del archivo
        expect(correr(CITA, ['el proveedor responde en 15 días', abs010()]).codigo).toBe(0);
        expect(correr(CITA, ['detectado el defecto. El proveedor responde', abs010()]).codigo).toBe(0);
    });

    it('--json trae renglon, revision y seccion', () => {
        const j = JSON.parse(correr(CITA, ['se escala al responsable de compras', abs010(), '--json']).out);
        expect(j).toMatchObject({ esta: true, desde: renglon('se escala al responsable'), rev: 'A', codigo: 'I-AC-010' });
        expect(j.seccion).toMatchObject({ numeral: '5.2', titulo: 'Plazos de envío' });
    });

    it('una cita inventada NO pasa (codigo 1): una cifra distinta, una palabra distinta o algo que no existe', () => {
        const casos = [
            'la notificación se envía al proveedor dentro de las 72 horas', // cifra cambiada
            'la notificación se envía al cliente dentro de las 48 horas', // palabra cambiada
            'el proveedor tiene un plazo de 30 días para responder', // inventada
            'El Gerente General aprueba la notificación', // inventada
        ];
        for (const frase of casos) {
            const r = correr(CITA, [frase, abs010()]);
            expect(r.codigo, frase).toBe(1);
            expect(r.out).toMatch(/^NO ESTÁ/);
            expect(r.out).toMatch(/No la cites/);
        }
        // la pista de "lo mas parecido" existe pero no es una cita
        const pista = correr(CITA, ['la notificación se envía al proveedor dentro de las 72 horas', abs010()]);
        expect(pista.out).toMatch(/Lo más parecido \(no es una cita, es una pista\): renglón \d+/);
        expect(JSON.parse(correr(CITA, ['frase que no esta', abs010(), '--json']).out).esta).toBe(false);
    });

    it('una frase puede seguir en el renglon de abajo (texto cortado), pero no cruzar un renglon en blanco', () => {
        const dos = ['Primera parte del', 'texto partido en dos renglones.', '', 'Otro parrafo distinto.'].join('\n');
        const f = path.join(carpetaTemporal('cita-'), 'doc.md');
        fs.writeFileSync(f, dos);
        expect(correr(CITA, ['parte del texto partido en dos', f]).codigo).toBe(0);
        expect(correr(CITA, ['renglones. Otro parrafo', f]).codigo).toBe(1);
        expect(buscarFrase(dos, 'texto partido')).toEqual([{ desde: 2, hasta: 2 }]);
        expect(buscarFrase(dos, 'parte del texto')).toEqual([{ desde: 1, hasta: 2 }]);
        expect(normalizarFrase('  Él   SEÑALIZÓ  ')).toBe('el senalizo');
    });

    it('resuelve la ruta que da buscar.mjs con --conocimiento, y avisa si el archivo no existe o la frase esta vacia', () => {
        const rel = correr(CITA, ['48 horas', rel010, '--conocimiento', K]);
        expect(rel.codigo).toBe(0);
        const noExiste = correr(CITA, ['lo que sea', 'comun/no-existe.md', '--conocimiento', K]);
        expect(noExiste.codigo).toBe(2);
        expect(noExiste.err).toMatch(/No encuentro el archivo/);
        expect(correr(CITA, ['   ', abs010()]).codigo).toBe(2);
        expect(correr(CITA, ['solo la frase']).codigo).toBe(2);
        expect(correr(CITA, ['x', abs010(), '--raro']).codigo).toBe(2);
    });

    it('cada pasaje que devuelve buscar se puede citar: la frase del recorte pasa por cita.mjs', () => {
        const p = buscarJson('plazos envio proveedor', ['--max', '1']).resultados[0];
        const linea = p.recorte.find((x) => /48 horas/.test(x.texto));
        expect(linea).toBeTruthy();
        const frase = linea.texto.replace(/…$/, '').replace(/^…/, '').split('.')[0];
        expect(correr(CITA, [frase, p.ruta]).codigo).toBe(0);
    });
});
