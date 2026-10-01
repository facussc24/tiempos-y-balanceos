/**
 * Tests de `scripts/_datosExportar.mjs` — ETAPA 0 de dejar de depender de Supabase (30/09/2026).
 *
 * Lo que protege este test es lo que hace confiable la copia en archivos:
 *  - el formato canonico (claves ordenadas, 2 espacios, LF): si cambia sin avisar, TODOS los
 *    hashes del manifest pasan a "distintos" y `--verificar` deja de servir;
 *  - `data` TEXT -> objeto, con el doble serializado (incidente 06/04/2026: 8 AMFE ilegibles) y
 *    el caso que NO se adivina (no parsea -> error, no se escribe);
 *  - que `--verificar` SI vea un archivo editado a mano, uno que falta y uno que sobra: un
 *    verificador que no puede dar rojo esta tan roto como el que no puede dar verde;
 *  - que el script no tenga ninguna escritura a Supabase (Fak: "SOLO LECTURA").
 *
 * No toca Supabase: el orquestador se prueba contra un cliente falso en memoria y los
 * archivos se escriben en una carpeta temporal.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    ordenarClaves, canonicoTexto, sha256, hashDeFila, normalizarData, prepararFila,
    esTablaExcluida, claveDeFila, claveArchivoSegura, compararFilas, etiquetaDe,
    planificarTabla, escribirArchivos, leerTablaDeDisco, compararHashes, exportar, verificar,
    carpetaNube,
} from '../../scripts/_datosExportar.mjs';

const RUTA_SCRIPT = resolve(fileURLToPath(import.meta.url), '../../../scripts/_datosExportar.mjs');
const mudo = () => {};

/** AMFE minimo: 2 operaciones y 3 causas, con `data` como TEXT igual que en Supabase. */
function filaAmfe(id, { doble = false, rota = false } = {}) {
    const doc = {
        operations: [
            { opNumber: '10', workElements: [{ name: 'Autoelevador', functions: [{ failures: [
                { description: 'Golpe', causes: [{ cause: 'a' }, { cause: 'b' }] }] }] }] },
            { opNumber: '20', workElements: [{ name: 'Mesa', functions: [{ failures: [
                { description: 'Corte', causes: [{ cause: 'c' }] }] }] }] },
        ],
        header: { z: 1, a: 2 },
    };
    let data = JSON.stringify(doc);
    if (doble) data = JSON.stringify(data);
    if (rota) data = '{"operations": [';
    return {
        id, amfe_number: `AMFE-${id}`, project_name: 'Proyecto', operation_count: 2, cause_count: 3,
        updated_at: '2026-09-30T12:00:00+00:00', revisions: '[]', data,
    };
}

describe('serializacion canonica', () => {
    it('ordena las claves a cualquier profundidad y conserva el orden de los arreglos', () => {
        const r = ordenarClaves({ b: 1, a: { d: [3, 1, 2], c: { z: 1, y: 2 } } });
        expect(Object.keys(r)).toEqual(['a', 'b']);
        expect(Object.keys(r.a)).toEqual(['c', 'd']);
        expect(Object.keys(r.a.c)).toEqual(['y', 'z']);
        expect(r.a.d).toEqual([3, 1, 2]);
    });

    it('escribe 2 espacios, solo LF, sin BOM y con un LF al final', () => {
        const t = canonicoTexto({ b: [1, { y: 1, x: 2 }], a: 'ñandú' });
        expect(t).toBe('{\n  "a": "ñandú",\n  "b": [\n    1,\n    {\n      "x": 2,\n      "y": 1\n    }\n  ]\n}\n');
        expect(t.includes('\r')).toBe(false);
        expect(t.charCodeAt(0)).not.toBe(0xFEFF);
        expect(t.endsWith('}\n')).toBe(true);
    });

    it('el mismo contenido con otro orden de claves da el mismo texto y el mismo hash', () => {
        const a = { id: 1, data: { x: 1, y: { p: 1, q: 2 } } };
        const b = { data: { y: { q: 2, p: 1 }, x: 1 }, id: 1 };
        expect(canonicoTexto(a)).toBe(canonicoTexto(b));
        expect(hashDeFila(a)).toBe(hashDeFila(b));
        expect(hashDeFila(a)).toMatch(/^[0-9a-f]{64}$/);
    });

    it('un cambio de valor cambia el hash, y el orden de un arreglo tambien cuenta', () => {
        const base = { id: 1, lista: [1, 2, 3], n: 5 };
        expect(hashDeFila({ ...base, n: 6 })).not.toBe(hashDeFila(base));
        expect(hashDeFila({ ...base, lista: [3, 2, 1] })).not.toBe(hashDeFila(base));
    });

    it('el hash es el sha256 del texto canonico, o sea el del archivo', () => {
        const fila = { id: 'x', v: 1 };
        expect(hashDeFila(fila)).toBe(sha256(canonicoTexto(fila)));
    });

    it('una clave "__proto__" del JSON se conserva como dato y no pisa el prototipo', () => {
        const obj = JSON.parse('{"b":1,"__proto__":{"a":1}}');
        const ord = ordenarClaves(obj);
        expect(Object.keys(ord)).toEqual(['__proto__', 'b']);
        expect(canonicoTexto(obj)).toContain('"__proto__"');
        expect(Object.getPrototypeOf(ord)).toBe(Object.prototype);
    });

    it('un valor que no se puede serializar tira error en vez de escribir "undefined"', () => {
        expect(() => canonicoTexto(undefined)).toThrow();
    });
});

describe('data TEXT -> objeto', () => {
    it('un TEXT con JSON se guarda como objeto', () => {
        const r = normalizarData('{"operations":[{"opNumber":"10"}]}');
        expect(r).toEqual({ ok: true, valor: { operations: [{ opNumber: '10' }] }, doble: false });
    });

    it('un doble serializado se desarma y se avisa', () => {
        const r = normalizarData(JSON.stringify(JSON.stringify({ items: [1, 2] })));
        expect(r.ok).toBe(true);
        expect(r.valor).toEqual({ items: [1, 2] });
        expect(r.doble).toBe(true);
    });

    it('lo que ya es objeto pasa igual, y null queda null', () => {
        expect(normalizarData({ a: 1 })).toEqual({ ok: true, valor: { a: 1 }, doble: false });
        expect(normalizarData(null).valor).toBeNull();
        expect(normalizarData(undefined).valor).toBeNull();
        expect(normalizarData('null')).toEqual({ ok: true, valor: null, doble: false });
    });

    it('si no parsea NO se adivina: error con el motivo', () => {
        for (const malo of ['{"operations": [', 'esto no es json', '']) {
            const r = normalizarData(malo);
            expect(r.ok).toBe(false);
            expect(r.error).toMatch(/data/);
        }
    });

    it('un doble serializado cuyo interior no es JSON tambien es error', () => {
        const r = normalizarData(JSON.stringify('texto suelto que no es json'));
        expect(r.ok).toBe(false);
    });

    it('prepararFila cambia solo `data`: las otras columnas TEXT con JSON quedan como vienen', () => {
        const fila = { id: 'a', revisions: '[{"rev":"A"}]', data: '{"x":1}', checksum: null };
        const r = prepararFila(fila);
        expect(r.ok).toBe(true);
        expect(r.fila.data).toEqual({ x: 1 });
        expect(r.fila.revisions).toBe('[{"rev":"A"}]');
        expect(r.fila.checksum).toBeNull();
        expect(fila.data).toBe('{"x":1}'); // no muta la fila original
    });

    it('una fila sin columna data pasa tal cual, y una con data rota vuelve error', () => {
        const sinData = { id: 1, codigo: 'X' };
        expect(prepararFila(sinData)).toEqual({ ok: true, fila: sinData, doble: false });
        expect(prepararFila({ id: 1, data: '{"a":' }).ok).toBe(false);
    });
});

describe('claves, nombres de archivo y exclusiones', () => {
    it('la clave sale de la clave primaria, simple o compuesta, y sin valor es error', () => {
        expect(claveDeFila({ id: 7 }, ['id'])).toBe('7');
        expect(claveDeFila({ a: 'x', b: 2 }, ['a', 'b'])).toBe('x__2');
        expect(() => claveDeFila({ id: null }, ['id'])).toThrow(/sin valor/);
        expect(() => claveDeFila({}, ['id'])).toThrow(/sin valor/);
    });

    it('un uuid y un numero sirven de nombre de archivo; lo demas se rechaza', () => {
        expect(claveArchivoSegura('3f2b1c9e-0d4a-4e8b-9a7c-1234567890ab')).toBe('3f2b1c9e-0d4a-4e8b-9a7c-1234567890ab');
        expect(claveArchivoSegura('42')).toBe('42');
        for (const malo of ['', '../x', 'a/b', 'a\\b', 'con', 'nul.x', 'a b', 'ñ', '.oculto', 'fin.', 'x'.repeat(101)]) {
            expect(() => claveArchivoSegura(malo), `deberia rechazar ${JSON.stringify(malo)}`).toThrow();
        }
    });

    it('excluye las copias viejas y no toca las tablas de verdad', () => {
        for (const t of ['_bk_amfe150_20260814', '_bk_resp_20260814', '_backup_ippad_20260702', '_backup_amfe_registry_20260703', 'backup_amfe_20260819_ingles']) {
            expect(esTablaExcluida(t), t).toBe(true);
        }
        for (const t of ['amfe_documents', 'amfe_registry', 'products', 'bom_documents', 'drafts', 'backup_amfe_otra']) {
            expect(esTablaExcluida(t), t).toBe(false);
        }
    });

    it('las filas se ordenan por clave, numerica si la clave es numero', () => {
        const filas = [{ id: 10 }, { id: 2 }, { id: 1 }];
        expect(filas.sort((a, b) => compararFilas(a, b, ['id'])).map((f) => f.id)).toEqual([1, 2, 10]);
        const uuids = [{ id: 'b' }, { id: 'a' }];
        expect(uuids.sort((a, b) => compararFilas(a, b, ['id'])).map((f) => f.id)).toEqual(['a', 'b']);
    });

    it('la etiqueta del manifest sale del primer campo legible', () => {
        expect(etiquetaDe({ amfe_number: 'AMFE-1', name: 'otro' })).toBe('AMFE-1');
        expect(etiquetaDe({ codigo: '21-9689' })).toBe('21-9689');
        expect(etiquetaDe({ module: 'amfe', document_key: 'k1' })).toBe('amfe/k1');
        expect(etiquetaDe({ id: 1 })).toBeNull();
    });
});

describe('plan de una tabla', () => {
    it('con columna data: un archivo por fila, <tabla>/<id>.json, con data como objeto', () => {
        const p = planificarTabla({ tabla: 'amfe_documents', filas: [filaAmfe('bbb'), filaAmfe('aaa')], pk: ['id'] });
        expect(p.modo).toBe('archivo-por-fila');
        expect(p.archivos.map((a) => a.ruta)).toEqual(['amfe_documents/aaa.json', 'amfe_documents/bbb.json']);
        const escrito = JSON.parse(p.archivos[0].contenido);
        expect(typeof escrito.data).toBe('object');
        expect(escrito.data.operations).toHaveLength(2);
        expect(escrito.revisions).toBe('[]');
        expect(p.archivos[0].contenido).toBe(canonicoTexto(escrito));
    });

    it('sin columna data: un solo archivo con las filas ordenadas por id', () => {
        const filas = [{ id: 10, codigo: 'C' }, { id: 2, codigo: 'B' }, { id: 1, codigo: 'A' }];
        const p = planificarTabla({ tabla: 'products', filas, pk: ['id'] });
        expect(p.modo).toBe('archivo-unico');
        expect(p.archivos).toHaveLength(1);
        expect(p.archivos[0].ruta).toBe('products.json');
        expect(JSON.parse(p.archivos[0].contenido).map((f) => f.id)).toEqual([1, 2, 10]);
        expect(Object.keys(p.documentos)).toEqual(['1', '2', '10']);
    });

    it('el hash del manifest de una fila es el sha256 de su archivo', () => {
        const p = planificarTabla({ tabla: 'cp_documents', filas: [{ id: 'k', updated_at: 'hoy', data: '{"items":[]}' }], pk: ['id'] });
        expect(p.documentos.k.sha256).toBe(sha256(p.archivos[0].contenido));
        expect(p.documentos.k.updated_at).toBe('hoy');
    });

    it('para amfe_documents el manifest lleva operaciones y causas contadas del data', () => {
        const p = planificarTabla({ tabla: 'amfe_documents', filas: [filaAmfe('a1')], pk: ['id'] });
        expect(p.documentos.a1.operaciones).toBe(2);
        expect(p.documentos.a1.causas).toBe(3);
        expect(p.documentos.a1.etiqueta).toBe('AMFE-a1');
        expect(p.documentos.a1.conteos_de_la_fila_desfasados).toBeUndefined();
    });

    it('si las columnas de conteo no coinciden con el data real, el manifest lo marca', () => {
        const fila = { ...filaAmfe('a2'), cause_count: 99 };
        const p = planificarTabla({ tabla: 'amfe_documents', filas: [fila], pk: ['id'] });
        expect(p.documentos.a2.causas).toBe(3);
        expect(p.documentos.a2.conteos_de_la_fila_desfasados).toEqual({ operation_count: 2, cause_count: 99 });
    });

    it('un doble serializado se desarma y queda marcado en el manifest', () => {
        const p = planificarTabla({ tabla: 'amfe_documents', filas: [filaAmfe('d1', { doble: true })], pk: ['id'] });
        expect(p.errores).toEqual([]);
        expect(p.dobles).toEqual(['d1']);
        expect(p.documentos.d1.data_doble_serializado).toBe(true);
        expect(JSON.parse(p.archivos[0].contenido).data.operations).toHaveLength(2);
    });

    it('una fila que no parsea se lista como error y NO sale archivo; las demas si', () => {
        const p = planificarTabla({ tabla: 'amfe_documents', filas: [filaAmfe('ok1'), filaAmfe('rota', { rota: true })], pk: ['id'] });
        expect(p.errores).toHaveLength(1);
        expect(p.errores[0]).toContain('amfe_documents/rota');
        expect(p.archivos.map((a) => a.ruta)).toEqual(['amfe_documents/ok1.json']);
        expect(Object.keys(p.documentos)).toEqual(['ok1']);
    });

    it('una clave repetida o con caracteres invalidos es error, no se pisa ni se adivina', () => {
        const rep = planificarTabla({ tabla: 't', filas: [{ id: 'x', data: '{}' }, { id: 'x', data: '{}' }], pk: ['id'] });
        expect(rep.errores.join(' ')).toMatch(/repetida/);
        const mala = planificarTabla({ tabla: 't', filas: [{ id: '../x', data: '{}' }], pk: ['id'] });
        expect(mala.errores.join(' ')).toMatch(/nombre de archivo/);
        expect(mala.archivos).toEqual([]);
    });
});

describe('disco: escribir, leer y comparar', () => {
    let dir;
    beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'datosExportar-')); });
    afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

    const planDocs = () => planificarTabla({ tabla: 'cp_documents', filas: [
        { id: 'a', updated_at: 't1', data: '{"items":[1]}' },
        { id: 'b', updated_at: 't2', data: '{"items":[2]}' },
    ], pk: ['id'] });

    it('escribir es idempotente: la segunda vez no toca nada', () => {
        const p = planDocs();
        expect(escribirArchivos(dir, p.archivos)).toEqual({ escritos: 2, sinCambios: 0 });
        expect(escribirArchivos(dir, p.archivos)).toEqual({ escritos: 0, sinCambios: 2 });
        const cambiada = planificarTabla({ tabla: 'cp_documents', filas: [
            { id: 'a', updated_at: 't1', data: '{"items":[9]}' }, { id: 'b', updated_at: 't2', data: '{"items":[2]}' },
        ], pk: ['id'] });
        expect(escribirArchivos(dir, cambiada.archivos)).toEqual({ escritos: 1, sinCambios: 1 });
    });

    it('lo que se lee del disco da los mismos hashes que el plan, en los dos modos', () => {
        const p = planDocs();
        escribirArchivos(dir, p.archivos);
        const d = leerTablaDeDisco(dir, 'cp_documents', ['id']);
        expect(d.modo).toBe('archivo-por-fila');
        expect(compararHashes(p.hashes, d.hashes)).toEqual({ iguales: ['a', 'b'], distintos: [], faltantes: [], sobrantes: [] });
        expect(d.noCanonicos).toEqual([]);

        const u = planificarTabla({ tabla: 'products', filas: [{ id: 2, codigo: 'B' }, { id: 1, codigo: 'A' }], pk: ['id'] });
        escribirArchivos(dir, u.archivos);
        const du = leerTablaDeDisco(dir, 'products', ['id']);
        expect(du.modo).toBe('archivo-unico');
        expect(compararHashes(u.hashes, du.hashes).iguales.sort()).toEqual(['1', '2']);
    });

    it('el verificador ve un archivo editado a mano, uno que falta y uno que sobra', () => {
        const p = planDocs();
        escribirArchivos(dir, p.archivos);
        // editado a mano
        const ruta = join(dir, 'cp_documents', 'a.json');
        writeFileSync(ruta, readFileSync(ruta, 'utf8').replace('1', '7'), 'utf8');
        // sobrante: un documento que ya no existe en vivo
        writeFileSync(join(dir, 'cp_documents', 'fantasma.json'), canonicoTexto({ id: 'fantasma', data: {} }), 'utf8');
        // faltante: lo vivo trae uno que no se exporto
        const vivo = new Map([...p.hashes, ['nuevo', 'h']]);
        const d = leerTablaDeDisco(dir, 'cp_documents', ['id']);
        const r = compararHashes(vivo, d.hashes);
        expect(r.distintos).toEqual(['a']);
        expect(r.iguales).toEqual(['b']);
        expect(r.faltantes).toEqual(['nuevo']);
        expect(r.sobrantes).toEqual(['fantasma']);
    });

    it('un archivo con saltos CRLF o mal indentado se marca como no canonico, aunque el contenido coincida', () => {
        const p = planDocs();
        escribirArchivos(dir, p.archivos);
        const ruta = join(dir, 'cp_documents', 'a.json');
        writeFileSync(ruta, readFileSync(ruta, 'utf8').replace(/\n/g, '\r\n'), 'utf8');
        const d = leerTablaDeDisco(dir, 'cp_documents', ['id']);
        expect(d.noCanonicos).toEqual(['cp_documents/a.json']);
        expect(d.hashes.get('a')).toBe(p.hashes.get('a'));
    });

    it('un archivo cuyo nombre no coincide con su clave, o que no es JSON, es anomalia', () => {
        const p = planDocs();
        escribirArchivos(dir, p.archivos);
        writeFileSync(join(dir, 'cp_documents', 'zzz.json'), canonicoTexto({ id: 'otra', data: {} }), 'utf8');
        writeFileSync(join(dir, 'cp_documents', 'roto.json'), '{ no es json', 'utf8');
        const d = leerTablaDeDisco(dir, 'cp_documents', ['id']);
        expect(d.anomalias).toHaveLength(2);
        expect(d.hashes.has('zzz')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Orquestador contra un Supabase falso en memoria
// ---------------------------------------------------------------------------

/** Cliente con la misma forma que usa el script: rpc('exec_sql_read') y from().select().order().range(). */
function sbFalso(tablas, { conteoMentiroso = {} } = {}) {
    return {
        rpc: async (nombre, { query }) => {
            if (nombre !== 'exec_sql_read') throw new Error(`RPC inesperado: ${nombre}`);
            if (query.includes('information_schema.tables')) {
                return { error: null, data: Object.entries(tablas).map(([t, v]) => ({ table_name: t, filas: conteoMentiroso[t] ?? v.filas.length })) };
            }
            if (query.includes('PRIMARY KEY')) {
                return { error: null, data: Object.entries(tablas).flatMap(([t, v]) => v.pk.map((c, i) => ({ table_name: t, column_name: c, ordinal_position: i + 1 }))) };
            }
            throw new Error('consulta inesperada');
        },
        from: (tabla) => ({
            select: () => {
                const q = { order: () => q, range: async (a, b) => ({ error: null, data: tablas[tabla].filas.slice(a, b + 1) }) };
                return q;
            },
        }),
    };
}

describe('exportar y verificar (Supabase falso)', () => {
    let dir;
    beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'datosExportar-')); });
    afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

    const tablasBase = () => ({
        amfe_documents: { pk: ['id'], filas: [filaAmfe('a1'), filaAmfe('a2', { doble: true })] },
        products: { pk: ['id'], filas: [{ id: 2, codigo: 'B', updated_at: 'x' }, { id: 1, codigo: 'A', updated_at: 'x' }] },
        settings: { pk: ['key'], filas: [{ key: 'assets', value: '{"a":1}', updated_at: 'x' }] },
        _bk_amfe150_20260814: { pk: ['id'], filas: [{ id: 'v', data: '{}' }] },
        backup_amfe_20260819_ingles: { pk: ['id'], filas: [{ id: 'v', data: '{}' }, { id: 'w', data: '{}' }] },
        cross_doc_checks: { pk: ['id'], filas: [] },
    });

    it('exporta las tablas con datos, deja afuera las copias viejas y las vacias, y cuenta todo', async () => {
        const r = await exportar({ sb: sbFalso(tablasBase()), dir, log: mudo });
        expect(r.errores).toEqual([]);
        expect(r.totalFilas).toBe(5);
        expect(Object.keys(r.manifest.tablas)).toEqual(['amfe_documents', 'products', 'settings']);
        expect(r.manifest.excluidas).toEqual({ _bk_amfe150_20260814: 1, backup_amfe_20260819_ingles: 2 });
        expect(r.manifest.vacias).toEqual(['cross_doc_checks']);
        expect(r.manifest.tablas.amfe_documents.documentos.a1.operaciones).toBe(2);
        expect(r.manifest.tablas.amfe_documents.documentos.a2.data_doble_serializado).toBe(true);
        expect(existsSync(join(dir, 'amfe_documents', 'a1.json'))).toBe(true);
        expect(existsSync(join(dir, 'products.json'))).toBe(true);
        expect(existsSync(join(dir, '_bk_amfe150_20260814'))).toBe(false);
        expect(readdirSync(dir).sort()).toEqual(['_manifest.json', 'amfe_documents', 'products.json', 'settings.json']);
    });

    it('la segunda corrida sin cambios no reescribe ni archivos ni manifest', async () => {
        await exportar({ sb: sbFalso(tablasBase()), dir, log: mudo });
        const r2 = await exportar({ sb: sbFalso(tablasBase()), dir, log: mudo });
        expect(r2.escritos).toBe(0);
        expect(r2.manifestEscrito).toBe(false);
    });

    it('verificar da todo igual justo despues de exportar', async () => {
        await exportar({ sb: sbFalso(tablasBase()), dir, log: mudo });
        const v = await verificar({ sb: sbFalso(tablasBase()), dir, log: mudo });
        expect(v.problemas).toEqual([]);
        expect(v.filasTabla.find((f) => f.tabla === 'amfe_documents')).toMatchObject({ vivo: 2, archivos: 2, distintos: 0, faltantes: 0, sobrantes: 0 });
    });

    it('verificar detecta un cambio en vivo, una fila nueva en vivo y una fila borrada en vivo', async () => {
        await exportar({ sb: sbFalso(tablasBase()), dir, log: mudo });
        const vivo = tablasBase();
        vivo.products.filas[0] = { id: 2, codigo: 'B-CAMBIADO', updated_at: 'y' }; // distinto
        vivo.products.filas.push({ id: 3, codigo: 'C', updated_at: 'y' });          // faltante en archivos
        vivo.amfe_documents.filas.pop();                                            // sobrante en archivos
        const v = await verificar({ sb: sbFalso(vivo), dir, log: mudo });
        expect(v.filasTabla.find((f) => f.tabla === 'products')).toMatchObject({ iguales: 1, distintos: 1, faltantes: 1, sobrantes: 0 });
        expect(v.filasTabla.find((f) => f.tabla === 'amfe_documents')).toMatchObject({ iguales: 1, sobrantes: 1 });
        expect(v.problemas.join(' | ')).toMatch(/products: 1 distintos/);
        expect(v.problemas.join(' | ')).toMatch(/products: 1 faltantes/);
        expect(v.problemas.join(' | ')).toMatch(/amfe_documents: 1 sobrantes/);
    });

    it('verificar ve un archivo editado a mano aunque Supabase no haya cambiado', async () => {
        await exportar({ sb: sbFalso(tablasBase()), dir, log: mudo });
        const ruta = join(dir, 'amfe_documents', 'a1.json');
        writeFileSync(ruta, readFileSync(ruta, 'utf8').replace('"Proyecto"', '"Otro"'), 'utf8');
        const v = await verificar({ sb: sbFalso(tablasBase()), dir, log: mudo });
        expect(v.problemas.join(' | ')).toMatch(/amfe_documents: 1 distintos/);
    });

    it('si falta el manifest, verificar lo dice', async () => {
        await exportar({ sb: sbFalso(tablasBase()), dir, log: mudo });
        rmSync(join(dir, '_manifest.json'));
        const v = await verificar({ sb: sbFalso(tablasBase()), dir, log: mudo });
        expect(v.problemas.join(' | ')).toMatch(/_manifest\.json/);
    });

    it('una fila con data que no parsea queda como error, no se escribe y la exportacion lo reporta', async () => {
        const t = tablasBase();
        t.amfe_documents.filas.push(filaAmfe('mala', { rota: true }));
        const r = await exportar({ sb: sbFalso(t), dir, log: mudo });
        expect(r.errores).toHaveLength(1);
        expect(r.errores[0]).toContain('amfe_documents/mala');
        expect(existsSync(join(dir, 'amfe_documents', 'mala.json'))).toBe(false);
        expect(existsSync(join(dir, 'amfe_documents', 'a1.json'))).toBe(true);
    });

    it('un descuadre contra el conteo real (RLS devolvio de menos) invalida la tabla y no la escribe', async () => {
        const r = await exportar({ sb: sbFalso(tablasBase(), { conteoMentiroso: { products: 3 } }), dir, log: mudo });
        expect(r.errores.join(' ')).toMatch(/products: se leyeron 2 filas y el conteo real es 3/);
        expect(existsSync(join(dir, 'products.json'))).toBe(false);
        expect(existsSync(join(dir, 'amfe_documents', 'a1.json'))).toBe(true);
    });

    it('una tabla con filas y sin clave primaria no se adivina: error', async () => {
        const t = tablasBase();
        t.settings.pk = [];
        const r = await exportar({ sb: sbFalso(t), dir, log: mudo });
        expect(r.errores.join(' ')).toMatch(/settings: no tiene clave primaria/);
    });

    it('una tabla NUEVA con filas se exporta sola: nada queda afuera en silencio', async () => {
        const t = tablasBase();
        t.tabla_nueva = { pk: ['id'], filas: [{ id: 1, x: 'y' }] };
        const r = await exportar({ sb: sbFalso(t), dir, log: mudo });
        expect(Object.keys(r.manifest.tablas)).toContain('tabla_nueva');
    });
});

describe('solo lectura sobre Supabase', () => {
    /** Saca los comentarios y el `createHash(...).update(...)` de node:crypto para mirar solo codigo de base. */
    const soloCodigo = (src) => src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/\s\/\/ .*$/gm, '')
        .replace(/createHash\([^)]*\)\s*\.update\(/g, 'createHash(');

    it('el script no tiene ninguna escritura a Supabase', () => {
        const codigo = soloCodigo(readFileSync(RUTA_SCRIPT, 'utf8'));
        // Map.delete() y compania no son Supabase: se miran las escrituras encadenadas a un cliente.
        const prohibidos = [
            /\.from\([^)]*\)\s*\.(insert|update|upsert|delete)\(/,
            /\b(sb|q|supabase)\b[^;]*\.(insert|update|upsert|delete)\(/,
            /exec_sql_write/, /\bsave(Amfe|Cp|Ho|Pfd)\b/, /\.storage\b/,
        ];
        for (const re of prohibidos) expect(codigo, `aparecio ${re}`).not.toMatch(re);
    });

    it('el unico RPC que usa es exec_sql_read', () => {
        const codigo = soloCodigo(readFileSync(RUTA_SCRIPT, 'utf8'));
        const rpcs = [...codigo.matchAll(/\.rpc\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
        expect(rpcs.length).toBeGreaterThan(0);
        expect([...new Set(rpcs)]).toEqual(['exec_sql_read']);
    });
});

// Fak, 01/10/2026: "los AMFE son de ingenieria... usemos la nube, no en local".
describe('carpetaNube: el destino por defecto es la biblioteca de Ingenieria, buscada por forma', () => {
    let home;
    beforeEach(() => { home = mkdtempSync(join(tmpdir(), 'datos-nube-')); });
    afterEach(() => { rmSync(home, { recursive: true, force: true }); });
    const general = (biblioteca) => join(home, 'BARACK ARGENTINA SRL', biblioteca, 'INGENIERIA BARACK (NUNCA BORRAR)', '1- GENERAL');

    it.each([['con tilde', 'Ingeniería y Proyecto - General'], ['sin tilde', 'Ingenieria y Proyecto - General']])(
        'encuentra la biblioteca %s y devuelve 1- GENERAL/AMFE/DATOS (aunque DATOS todavia no exista)', (_q, biblioteca) => {
            mkdirSync(general(biblioteca), { recursive: true });
            expect(carpetaNube(home)).toBe(join(general(biblioteca), 'AMFE', 'DATOS'));
        });

    it('ROJO: sin la biblioteca sincronizada devuelve null (el script frena, no guarda en local)', () => {
        expect(carpetaNube(home)).toBe(null);
        mkdirSync(join(home, 'BARACK ARGENTINA SRL', 'Otra biblioteca - General'), { recursive: true });
        expect(carpetaNube(home)).toBe(null);
        // la biblioteca esta pero vacia (no bajo todavia): tampoco
        mkdirSync(join(home, 'BARACK ARGENTINA SRL', 'Ingeniería y Proyecto - General'), { recursive: true });
        expect(carpetaNube(home)).toBe(null);
    });

    it('con dos bibliotecas de nombre parecido elige la que tiene la carpeta de Ingenieria', () => {
        mkdirSync(join(home, 'BARACK ARGENTINA SRL', 'Ingenieria y Proyecto - General'), { recursive: true });
        mkdirSync(general('Ingeniería y Proyecto - General'), { recursive: true });
        expect(carpetaNube(home)).toBe(join(general('Ingeniería y Proyecto - General'), 'AMFE', 'DATOS'));
    });
});
