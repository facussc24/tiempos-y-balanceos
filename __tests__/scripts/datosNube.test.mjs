// @vitest-environment node
/**
 * Tests de la ETAPA 1 de P55 (10/10/2026): la copia de Supabase en la biblioteca de Ingenieria se mantiene
 * sola, en la direccion Supabase -> archivos (`scripts/_lib/datosNube.mjs`, `scripts/_datosSincronizar.mjs`)
 * y con la escritura doble de `saveAmfe/saveCp/saveHo/savePfd` (`scripts/_lib/amfeIo.mjs`).
 *
 * Las tres pruebas que pidio la revision independiente del plan (plan §7, punto 10):
 *   1. IDEMPOTENCIA: guardar y sincronizar enseguida = 0 escrituras; una HO con el mismo `updated_at` y otro
 *      contenido se exporta igual.
 *   2. NO PISAR LO AJENO: archivo cambiado + fila cambiada = no escribe y queda el conflicto anotado;
 *      ilegible / a medio bajar / copia `-PCNOMBRE` = aborta; Supabase con error o 0 filas = no toca la carpeta.
 *   3. FALLA PARCIAL: Supabase bien y el archivo falla (y al reves) = se dice, se repara en la corrida
 *      siguiente, y nunca queda un archivo truncado ni un manifest que describa lo que no esta.
 * Y los candados del encargo: no borra, sin biblioteca frena, nada de claves, la nube que falla no rompe el
 * guardado, vitest no toca la carpeta real, y la direccion archivos -> Supabase esta apagada.
 *
 * No toca Supabase ni la biblioteca: cliente falso en memoria y carpetas temporales.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    decidir, leerEstable, escribirAtomico, tieneSecreto, resolverCarpeta, sincronizar, corridaLimpia,
    espejarGuardado, leerEstado, evaluarCopiaNube, revisarCarpeta, ErrorNube, rutaEstadoPorDefecto,
} from '../../scripts/_lib/datosNube.mjs';
import { canonicoTexto, sha256, verificar } from '../../scripts/_datosExportar.mjs';
import { saveAmfe, saveCp, saveHo, savePfd } from '../../scripts/_lib/amfeIo.mjs';
import { HABILITADA, subir, planificarSubida } from '../../scripts/_lib/datosNubeSubir.mjs';
import { leerArgumentos, lineaResumen, separarSobrantes } from '../../scripts/_datosSincronizar.mjs';

const RAIZ = path.resolve(fileURLToPath(import.meta.url), '../../..');
const mudo = () => {};

// ---------------------------------------------------------------------------
// Supabase falso: lo que usan la pasada entera y los guardadores
// ---------------------------------------------------------------------------

const amfeDoc = (causa = 'a') => ({
    header: { rev: 'A' },
    operations: [{ opNumber: '10', operationNumber: '10', name: 'RECEPCION', operationName: 'RECEPCION', workElements: [{ name: 'Autoelevador', type: 'Machine', functions: [{ description: 'Mover', functionDescription: 'Mover', failures: [{ description: 'Golpe', causes: [{ cause: causa, description: causa, ap: 'M', actionPriority: 'M' }] }] }] }] }],
});

function tablasBase() {
    return {
        amfe_documents: { pk: ['id'], filas: [
            { id: 'amfe-1', amfe_number: 'AMFE-1', operation_count: 1, cause_count: 1, ap_h_count: 0, ap_m_count: 1, updated_at: '2026-10-01T10:00:00+00:00', data: JSON.stringify(amfeDoc()) },
            { id: 'amfe-2', amfe_number: 'AMFE-2', operation_count: 1, cause_count: 1, ap_h_count: 0, ap_m_count: 1, updated_at: '2026-10-01T10:00:00+00:00', data: JSON.stringify(amfeDoc('b')) },
        ] },
        cp_documents: { pk: ['id'], filas: [{ id: 'cp-1', control_plan_number: 'CP-1', updated_at: '2026-10-01T10:00:00+00:00', data: JSON.stringify({ items: [1] }) }] },
        ho_documents: { pk: ['id'], filas: [{ id: 'ho-1', form_number: 'HO-1', updated_at: '2026-10-01T10:00:00+00:00', data: JSON.stringify({ sheets: [1] }) }] },
        pfd_documents: { pk: ['id'], filas: [{ id: 'pfd-1', document_number: 'PFD-1', updated_at: '2026-10-01T10:00:00+00:00', data: JSON.stringify({ steps: [1] }) }] },
        products: { pk: ['id'], filas: [{ id: 1, codigo: 'A' }, { id: 2, codigo: 'B' }] },
    };
}

/**
 * @param {object} tablas  se MUTA con los update
 * @param {{fallaUpdate?: object|null, fallaRpc?: boolean}} [ctl]  se puede cambiar entre llamadas
 */
function sbFalso(tablas, ctl = {}) {
    return {
        ctl,
        rpc: async (nombre, { query }) => {
            if (nombre !== 'exec_sql_read') throw new Error(`RPC inesperado: ${nombre}`);
            if (ctl.fallaRpc) return { error: { message: 'fetch failed' }, data: null };
            if (query.includes('information_schema.tables')) return { error: null, data: Object.entries(tablas).map(([t, v]) => ({ table_name: t, filas: v.filas.length })) };
            if (query.includes('PRIMARY KEY')) return { error: null, data: Object.entries(tablas).flatMap(([t, v]) => v.pk.map((c, i) => ({ table_name: t, column_name: c, ordinal_position: i + 1 }))) };
            throw new Error('consulta inesperada');
        },
        from: (tabla) => ({
            select: () => {
                const q = {
                    order: () => q,
                    range: async (a, b) => ({ error: null, data: tablas[tabla].filas.slice(a, b + 1).map((f) => ({ ...f })) }),
                    eq: (col, v) => ({ single: async () => {
                        const f = tablas[tabla].filas.find((x) => x[col] === v);
                        return f ? { data: { ...f }, error: null } : { data: null, error: { message: 'sin fila' } };
                    } }),
                };
                return q;
            },
            update: (payload) => ({ eq: async (col, v) => {
                if (ctl.fallaUpdate) return { error: ctl.fallaUpdate, status: ctl.status };
                const f = tablas[tabla].filas.find((x) => x[col] === v);
                if (f) Object.assign(f, payload);
                return { error: null };
            } }),
        }),
    };
}

/** Foto de una carpeta: ruta relativa -> contenido. Para probar "no se toco nada". */
function foto(dir) {
    const out = {};
    const andar = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
        const p = path.join(d, e.name);
        if (e.isDirectory()) andar(p); else out[path.relative(dir, p).replace(/\\/g, '/')] = fs.readFileSync(p, 'utf8');
    });
    if (fs.existsSync(dir)) andar(dir);
    return out;
}

let tmp, dir, rutaEstado, avisos;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'datosNube-'));
    dir = path.join(tmp, 'DATOS');
    fs.mkdirSync(dir);
    rutaEstado = path.join(tmp, 'estado', 'datos-nube.json');
    avisos = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
    avisos.mockRestore();
    fs.rmSync(tmp, { recursive: true, force: true });
});

const pasada = (sb, extra = {}) => sincronizar({ sb, dir, rutaEstado, aplicar: true, log: mudo, ...extra });
const archivo = (rel) => path.join(dir, rel);
const cambiarEnDisco = (rel, cambio) => {
    const obj = JSON.parse(fs.readFileSync(archivo(rel), 'utf8'));
    cambio(obj);
    fs.writeFileSync(archivo(rel), canonicoTexto(obj), 'utf8');
};

// ---------------------------------------------------------------------------
describe('decidir: que se hace con un archivo (por hash de contenido, contra la base local)', () => {
    const A = 'contenido A\n', B = 'contenido B\n', C = 'contenido C\n';
    it.each([
        ['no hay archivo', { nuevo: A, disco: null }, 'crear'],
        ['archivo igual a Supabase', { nuevo: A, disco: A }, 'igual'],
        ['el archivo esta como lo deje y cambio Supabase', { nuevo: B, disco: A, shaBase: sha256(A) }, 'actualizar'],
        ['Supabase esta como lo deje y cambio el archivo', { nuevo: A, disco: B, shaBase: sha256(A) }, 'solo_nube'],
        ['cambiaron los dos', { nuevo: B, disco: C, shaBase: sha256(A) }, 'conflicto'],
        ['difieren y esta PC no tiene base', { nuevo: B, disco: A }, 'sin_base'],
        ['una persona dijo que vale Supabase', { nuevo: B, disco: C, shaBase: sha256(A), aceptar: true }, 'actualizar'],
    ])('%s', (_q, entrada, esperado) => { expect(decidir(entrada)).toBe(esperado); });

    it('los tres casos que NO escriben son exactamente los que el archivo cambio o no se sabe', () => {
        // el gemelo rojo: si alguno pasara a "actualizar", la pasada pisaria lo editado en la nube
        for (const d of ['solo_nube', 'conflicto', 'sin_base']) expect(['crear', 'actualizar']).not.toContain(d);
    });
});

describe('leer y escribir sin dejar nada a medias', () => {
    it('un archivo cuyo tamaño cambia mientras se lee NO se lee (a medio sincronizar)', () => {
        const ruta = path.join(tmp, 'x.json');
        fs.writeFileSync(ruta, '{"a":1}', 'utf8');
        expect(leerEstable(ruta)).toBe('{"a":1}');
        let n = 0;
        const fsx = { statSync: () => ({ size: n++ === 0 ? 7 : 9000, mtimeMs: 1 }), readFileSync: fs.readFileSync };
        expect(() => leerEstable(ruta, fsx)).toThrow(/a medio sincronizar/);
    });

    it('un archivo cuya fecha cambia mientras se lee tampoco', () => {
        const ruta = path.join(tmp, 'x.json');
        fs.writeFileSync(ruta, '{"a":1}', 'utf8');
        let n = 0;
        const fsx = { statSync: () => ({ size: 7, mtimeMs: n++ }), readFileSync: fs.readFileSync };
        expect(() => leerEstable(ruta, fsx)).toThrow(ErrorNube);
    });

    it('un archivo que no se puede leer (sin bajar de la nube) tira: no es "no existe"', () => {
        const fsx = { statSync: () => ({ size: 7, mtimeMs: 1 }), readFileSync: () => { throw Object.assign(new Error('nope'), { code: 'EIO' }); } };
        expect(() => leerEstable('cualquiera.json', fsx)).toThrow(/no se pudo leer/);
    });

    it('si el renombrado falla, el destino queda ENTERO con lo de antes', () => {
        const destino = path.join(tmp, 'doc.json');
        fs.writeFileSync(destino, 'viejo y entero\n', 'utf8');
        const fsx = { mkdirSync: fs.mkdirSync, writeFileSync: fs.writeFileSync, renameSync: () => { throw Object.assign(new Error('disco'), { code: 'ENOSPC' }); } };
        expect(() => escribirAtomico(destino, 'nuevo\n', fsx)).toThrow(/disco/);
        expect(fs.readFileSync(destino, 'utf8')).toBe('viejo y entero\n');
    });

    it.each([
        ['una clave de Anthropic', `sk-ant-${'api03-abcdefghij'}`],
        ['un JWT (anon key o sesion)', ['eyJhbGciOiJIUzI1NiIsInR5cCI6', 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6', 'SflKxwRJSMeKKF2QT4fw'].join('.')],
        ['una linea de .env', 'VITE_AUTO_LOGIN_PASSWORD=algo'],
    ])('tieneSecreto caza %s', (_q, texto) => { expect(tieneSecreto(`{"x": "${texto}"}`)).toBeTruthy(); });

    it('tieneSecreto no salta con un documento comun', () => {
        expect(tieneSecreto(canonicoTexto({ id: 'amfe-1', data: amfeDoc(), nota: 'VITE no es una clave' }))).toBeNull();
    });
});

describe('donde va: la biblioteca, y nunca la real desde vitest', () => {
    it('corriendo en vitest, sin carpeta explicita, NO hay carpeta (un test no escribe en la biblioteca)', () => {
        expect(process.env.VITEST).toBeTruthy();
        expect(resolverCarpeta(null, { env: { VITEST: 'true' }, buscar: () => 'C:/biblioteca/DATOS' })).toBeNull();
    });
    it('fuera de vitest usa la biblioteca; la carpeta explicita y la variable mandan', () => {
        expect(resolverCarpeta(null, { env: {}, buscar: () => dir })).toBe(path.resolve(dir));
        expect(resolverCarpeta(null, { env: {}, buscar: () => null })).toBeNull();
        expect(resolverCarpeta(tmp, { env: { VITEST: 'true' } })).toBe(path.resolve(tmp));
        expect(resolverCarpeta(null, { env: { BARACK_DATOS_NUBE_DIR: tmp } })).toBe(path.resolve(tmp));
    });
    it('en vitest ni la variable de entorno abre la carpeta: solo la explicita', () => {
        expect(resolverCarpeta(null, { env: { VITEST: 'true', BARACK_DATOS_NUBE_DIR: tmp }, buscar: () => dir })).toBeNull();
    });
    it('la base local es UNA POR CARPETA, y en un test hay que pasarla a mano', () => {
        const a = rutaEstadoPorDefecto('C:/x/DATOS', {}), b = rutaEstadoPorDefecto('C:/tmp/prueba', {});
        expect(a).not.toBe(b);
        expect(rutaEstadoPorDefecto('c:/X/datos', {})).toBe(a);                      // misma carpeta, otra grafia
        expect(a).toMatch(/[\\/]\.claude[\\/]state[\\/]datos-nube-[0-9a-f]{12}\.json$/);
        expect(() => rutaEstadoPorDefecto(dir)).toThrow(/en un test/);
        expect(rutaEstadoPorDefecto(dir, { VITEST: 'true', BARACK_DATOS_ESTADO: 'Z:/e.json' })).toBe('Z:/e.json');
    });
    it('la escritura doble con carpeta pero sin base explicita, en un test, no escribe nada (avisa y sigue)', async () => {
        const t = tablasBase(); const sb = sbFalso(t);
        await sincronizar({ sb, dir, rutaEstado, aplicar: true, log: mudo });
        const antes = foto(dir);
        await expect(saveAmfe(sb, 'amfe-1', amfeDoc('z'), { nubeDir: dir })).resolves.toBeUndefined();
        expect(foto(dir)).toEqual(antes);
    });
    it('saveAmfe sin carpeta explicita no deja ningun archivo (y guarda igual)', async () => {
        const t = tablasBase();
        await saveAmfe(sbFalso(t), 'amfe-1', amfeDoc('nueva'));
        expect(JSON.parse(t.amfe_documents.filas[0].data).operations[0].workElements[0].functions[0].failures[0].causes[0].cause).toBe('nueva');
        expect(foto(dir)).toEqual({});
    });
});

// ---------------------------------------------------------------------------
describe('la pasada entera (Supabase -> archivos)', () => {
    it('por defecto es un dry-run: dice que haria y no escribe nada, ni la base', async () => {
        const r = await sincronizar({ sb: sbFalso(tablasBase()), dir, rutaEstado, log: mudo });
        expect(r.aplicar).toBe(false);
        expect(r.creados.length).toBe(6);                 // 5 documentos + products.json
        expect(foto(dir)).toEqual({});
        expect(fs.existsSync(rutaEstado)).toBe(false);
    });

    it('aplicar crea todo, y `verificar` de la etapa 0 da verde', async () => {
        const sb = sbFalso(tablasBase());
        const r = await pasada(sb);
        expect(corridaLimpia(r)).toBe(true);
        expect(r.creados.sort()).toEqual(['amfe_documents/amfe-1.json', 'amfe_documents/amfe-2.json', 'cp_documents/cp-1.json', 'ho_documents/ho-1.json', 'pfd_documents/pfd-1.json', 'products.json']);
        expect((await verificar({ sb, dir, log: mudo })).problemas).toEqual([]);
        expect(leerEstado(rutaEstado, dir).limpia).toBe(true);
    });

    it('IDEMPOTENCIA: la segunda pasada no escribe nada, tampoco el manifest', async () => {
        const sb = sbFalso(tablasBase());
        await pasada(sb);
        const antes = foto(dir);
        const r = await pasada(sb);
        expect([r.creados.length, r.actualizados.length, r.manifestEscrito]).toEqual([0, 0, false]);
        expect(r.iguales).toBe(6);
        expect(foto(dir)).toEqual(antes);
    });

    it('cambio Supabase y el archivo esta como lo deje: se actualiza', async () => {
        const t = tablasBase(); const sb = sbFalso(t);
        await pasada(sb);
        t.cp_documents.filas[0].data = JSON.stringify({ items: [1, 2] });
        const r = await pasada(sb);
        expect(r.actualizados).toEqual(['cp_documents/cp-1.json']);
        expect(JSON.parse(fs.readFileSync(archivo('cp_documents/cp-1.json'), 'utf8')).data.items).toEqual([1, 2]);
        expect((await verificar({ sb, dir, log: mudo })).problemas).toEqual([]);
    });

    it('una HO con el MISMO updated_at y otro contenido se exporta igual (el cambio se ve por hash)', async () => {
        const t = tablasBase(); const sb = sbFalso(t);
        await pasada(sb);
        t.ho_documents.filas[0].data = JSON.stringify({ sheets: [1, 2, 3] });   // updated_at no se movio
        const r = await pasada(sb);
        expect(r.actualizados).toEqual(['ho_documents/ho-1.json']);
    });

    it('NO PISA: el archivo cambio en la nube y Supabase no -> queda como esta y se anota', async () => {
        const sb = sbFalso(tablasBase());
        await pasada(sb);
        cambiarEnDisco('amfe_documents/amfe-1.json', (o) => { o.data.header.rev = 'B'; });
        const antes = fs.readFileSync(archivo('amfe_documents/amfe-1.json'), 'utf8');
        const r = await pasada(sb);
        expect(r.pendientes).toEqual([expect.objectContaining({ ruta: 'amfe_documents/amfe-1.json', tipo: 'solo_nube' })]);
        expect(fs.readFileSync(archivo('amfe_documents/amfe-1.json'), 'utf8')).toBe(antes);
        expect(corridaLimpia(r)).toBe(false);
        expect(leerEstado(rutaEstado, dir).pendientes['amfe_documents/amfe-1.json'].tipo).toBe('solo_nube');
    });

    it('NO PISA: cambiaron el archivo Y la fila -> conflicto anotado, ninguno se toca', async () => {
        const t = tablasBase(); const sb = sbFalso(t);
        await pasada(sb);
        cambiarEnDisco('amfe_documents/amfe-1.json', (o) => { o.data.header.rev = 'B'; });
        t.amfe_documents.filas[0].data = JSON.stringify(amfeDoc('otra causa'));
        const antes = fs.readFileSync(archivo('amfe_documents/amfe-1.json'), 'utf8');
        const r = await pasada(sb);
        expect(r.pendientes).toEqual([expect.objectContaining({ ruta: 'amfe_documents/amfe-1.json', tipo: 'conflicto' })]);
        expect(fs.readFileSync(archivo('amfe_documents/amfe-1.json'), 'utf8')).toBe(antes);
        expect(JSON.parse(t.amfe_documents.filas[0].data).operations[0].workElements[0].functions[0].failures[0].causes[0].cause).toBe('otra causa');
        // el manifest describe lo que HAY en disco, y lo marca
        const m = JSON.parse(fs.readFileSync(archivo('_manifest.json'), 'utf8'));
        expect(m.tablas.amfe_documents.documentos['amfe-1']).toEqual(expect.objectContaining({ sha256: sha256(antes), difiere_de_supabase: true }));
        // y con el si de una persona para ESE archivo, vale Supabase
        const r2 = await pasada(sb, { aceptar: ['amfe_documents/amfe-1.json'] });
        expect(r2.actualizados).toEqual(['amfe_documents/amfe-1.json']);
        expect(corridaLimpia(r2)).toBe(true);
        expect(leerEstado(rutaEstado, dir).pendientes).toEqual({});
    });

    it('NO PISA: una PC sin base no pisa un archivo que difiere (no sabe quien cambio)', async () => {
        const t = tablasBase(); const sb = sbFalso(t);
        await pasada(sb);
        t.cp_documents.filas[0].data = JSON.stringify({ items: [9] });
        const r = await pasada(sb, { rutaEstado: path.join(tmp, 'otra-pc.json') });
        expect(r.pendientes).toEqual([expect.objectContaining({ ruta: 'cp_documents/cp-1.json', tipo: 'sin_base' })]);
        expect(JSON.parse(fs.readFileSync(archivo('cp_documents/cp-1.json'), 'utf8')).data.items).toEqual([1]);
        expect(r.iguales).toBe(5);     // lo que esta igual siembra la base de esa PC
    });

    it('un catalogo (archivo unico) editado en la nube tampoco se pisa', async () => {
        const t = tablasBase(); const sb = sbFalso(t);
        await pasada(sb);
        fs.writeFileSync(archivo('products.json'), canonicoTexto([{ id: 1, codigo: 'A' }, { id: 2, codigo: 'EDITADO' }]), 'utf8');
        t.products.filas.push({ id: 3, codigo: 'C' });
        const r = await pasada(sb);
        expect(r.pendientes).toEqual([expect.objectContaining({ ruta: 'products.json', tipo: 'conflicto' })]);
        expect(fs.readFileSync(archivo('products.json'), 'utf8')).toContain('EDITADO');
    });

    describe('ABORTA sin tocar nada', () => {
        let sb, t, antes;
        beforeEach(async () => {
            t = tablasBase(); sb = sbFalso(t);
            await pasada(sb);
            t.cp_documents.filas[0].data = JSON.stringify({ items: [1, 2] });      // hay algo para escribir
        });
        const abortaSinTocar = async (extra = {}) => {
            antes = foto(dir);
            const estadoAntes = fs.readFileSync(rutaEstado, 'utf8');
            const r = await pasada(sb, extra);
            expect(r.abortado).toBeTruthy();
            expect(corridaLimpia(r)).toBe(false);
            expect(foto(dir)).toEqual(antes);
            expect(fs.readFileSync(rutaEstado, 'utf8')).toBe(estadoAntes);
            return r.abortado;
        };

        it('un archivo que no es JSON (cortado)', async () => {
            fs.writeFileSync(archivo('amfe_documents/amfe-2.json'), '{"id": "amfe-2", "data": {', 'utf8');
            expect(await abortaSinTocar()).toMatch(/no es JSON/);
        });
        it('una copia de conflicto de OneDrive de un documento (<id>-PCNOMBRE.json)', async () => {
            fs.writeFileSync(archivo('amfe_documents/amfe-1-PCCARLOS.json'), fs.readFileSync(archivo('amfe_documents/amfe-1.json'), 'utf8'), 'utf8');
            expect(await abortaSinTocar()).toMatch(/copia de conflicto/);
        });
        it('una copia de conflicto del manifest o de un catalogo', async () => {
            fs.writeFileSync(archivo('_manifest-PCB.json'), '{}', 'utf8');
            expect(await abortaSinTocar()).toMatch(/copia de conflicto/);
        });
        it('un archivo a medio bajar (su tamaño cambia mientras se lee)', async () => {
            let n = 0;
            const fsx = { ...fs, statSync: (p, ...a) => (String(p).endsWith('ho-1.json') ? { size: 10 + n++, mtimeMs: 1 } : fs.statSync(p, ...a)) };
            expect(await abortaSinTocar({ fsx })).toMatch(/a medio sincronizar/);
        });
        it('un archivo que no se puede leer (deshidratado sin red)', async () => {
            const fsx = { ...fs, readFileSync: (p, ...a) => { if (String(p).endsWith('pfd-1.json')) throw Object.assign(new Error('cloud'), { code: 'ENOENT' }); return fs.readFileSync(p, ...a); } };
            expect(await abortaSinTocar({ fsx })).toMatch(/no se pudo leer/);
        });
        it('Supabase con error', async () => {
            sb.ctl.fallaRpc = true;
            expect(await abortaSinTocar()).toMatch(/Supabase no contesto/);
        });
        it('Supabase con 0 filas (con RLS eso es "no pude leer")', async () => {
            Object.values(t).forEach((v) => { v.filas = []; });
            expect(await abortaSinTocar()).toMatch(/vacio|0 filas/);
        });
        it('una fila viva con `data` roto', async () => {
            t.amfe_documents.filas[1].data = '{"operations": [';
            expect(await abortaSinTocar()).toMatch(/problema/);
        });
        it('sin biblioteca sincronizada en esta PC (carpeta null): frena y lo dice', async () => {
            const r = await sincronizar({ sb, dir: null, rutaEstado, aplicar: true, log: mudo });
            expect(r.abortado).toMatch(/no encuentro la biblioteca/);
        });
    });

    it('NUNCA BORRA: una fila que ya no esta en Supabase deja su archivo, listado como sobrante', async () => {
        const t = tablasBase(); const sb = sbFalso(t);
        await pasada(sb);
        t.amfe_documents.filas.pop();
        const r = await pasada(sb);
        expect(r.sobrantes).toEqual(['amfe_documents/amfe-2.json']);
        expect(fs.existsSync(archivo('amfe_documents/amfe-2.json'))).toBe(true);
        expect(corridaLimpia(r)).toBe(true);
    });

    it('nada con forma de clave llega a la carpeta', async () => {
        const t = tablasBase(); const sb = sbFalso(t);
        await pasada(sb);
        const jwt = ['eyJhbGciOiJIUzI1NiIsInR5cCI6', 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6', 'SflKxwRJSMeKKF2QT4fw'].join('.');
        t.cp_documents.filas[0].data = JSON.stringify({ items: [jwt] });
        const r = await pasada(sb);
        expect(r.fallidos).toEqual([expect.objectContaining({ ruta: 'cp_documents/cp-1.json' })]);
        expect(Object.values(foto(dir)).join('\n')).not.toContain('eyJhbGci');
    });

    it('FALLA PARCIAL: un archivo no se pudo escribir -> se dice, no queda truncado, y la corrida siguiente lo repara', async () => {
        const t = tablasBase(); const sb = sbFalso(t);
        await pasada(sb);
        const viejo = fs.readFileSync(archivo('cp_documents/cp-1.json'), 'utf8');
        t.cp_documents.filas[0].data = JSON.stringify({ items: [1, 2] });
        t.ho_documents.filas[0].data = JSON.stringify({ sheets: [7] });
        const fsx = { ...fs, renameSync: (a, b) => { if (String(b).endsWith('cp-1.json')) throw Object.assign(new Error('solo lectura'), { code: 'EROFS' }); return fs.renameSync(a, b); } };
        const r = await pasada(sb, { fsx });
        expect(r.fallidos).toEqual([expect.objectContaining({ ruta: 'cp_documents/cp-1.json' })]);
        expect(r.actualizados).toEqual(['ho_documents/ho-1.json']);                // el resto si se escribio
        expect(fs.readFileSync(archivo('cp_documents/cp-1.json'), 'utf8')).toBe(viejo);   // entero, el de antes
        expect(corridaLimpia(r)).toBe(false);
        // el manifest no describe lo que no esta: dice lo que hay en disco
        const m = JSON.parse(fs.readFileSync(archivo('_manifest.json'), 'utf8'));
        expect(m.tablas.cp_documents.documentos['cp-1'].sha256).toBe(sha256(viejo));
        expect(leerEstado(rutaEstado, dir).pendientes['cp_documents/cp-1.json'].tipo).toBe('fallo_escritura');
        // corrida siguiente, sin la falla: lo repara y queda limpio
        const r2 = await pasada(sb);
        expect(r2.actualizados).toEqual(['cp_documents/cp-1.json']);
        expect(corridaLimpia(r2)).toBe(true);
        expect((await verificar({ sb, dir, log: mudo })).problemas).toEqual([]);
    });

    it('CARRERA: otra sesion guardo el archivo mientras corria la pasada -> no se pisa y su anotacion en la base se conserva', async () => {
        const t = tablasBase(); const sb = sbFalso(t);
        await pasada(sb);
        t.cp_documents.filas[0].data = JSON.stringify({ items: [1, 2] });      // la pasada va a querer actualizarlo
        const rel = 'cp_documents/cp-1.json';
        const deOtraSesion = canonicoTexto({ id: 'cp-1', control_plan_number: 'CP-1', updated_at: 'x', data: { items: ['guardado solo en archivo'] } });
        let hecho = false;
        const fsx = { ...fs, existsSync: (p) => {
            // la pasada pregunta por ESTE archivo recien cuando lo va a escribir: ahi, entre la lectura de la
            // carpeta y la escritura, cae la escritura doble de otra sesion
            if (String(p).endsWith('cp-1.json') && !hecho) {
                hecho = true;
                fs.writeFileSync(archivo(rel), deOtraSesion, 'utf8');
                const e = JSON.parse(fs.readFileSync(rutaEstado, 'utf8'));
                e.pendientes[rel] = { tipo: 'solo_archivo', desde: 'ahora', shaArchivo: sha256(deOtraSesion) };
                fs.writeFileSync(rutaEstado, JSON.stringify(e), 'utf8');
            }
            return fs.existsSync(p);
        } };
        const r = await pasada(sb, { fsx });
        expect(r.pendientes).toEqual([expect.objectContaining({ ruta: rel, tipo: 'cambio_durante' })]);
        expect(fs.readFileSync(archivo(rel), 'utf8')).toBe(deOtraSesion);                 // no se piso
        expect(leerEstado(rutaEstado, dir).pendientes[rel]).toEqual(expect.objectContaining({ tipo: 'solo_archivo', shaArchivo: sha256(deOtraSesion) }));
        // el manifest describe lo que quedo en disco
        expect(JSON.parse(fs.readFileSync(archivo('_manifest.json'), 'utf8')).tablas.cp_documents.documentos['cp-1'].sha256).toBe(sha256(deOtraSesion));
    });

    it('R1: si el proceso se corta despues de escribir un archivo, la corrida siguiente NO lo toma por cambiado en la nube', async () => {
        const t = tablasBase(); const sb = sbFalso(t);
        await pasada(sb);
        t.cp_documents.filas[0].data = JSON.stringify({ items: [1, 2] });
        // el corte: desde el manifest en adelante no se escribe nada mas (ni el manifest ni la base del final)
        let cortado = false;
        const fsx = { ...fs, renameSync: (a, b) => {
            if (String(b).endsWith('_manifest.json')) cortado = true;
            if (cortado) throw new Error('corte');
            return fs.renameSync(a, b);
        } };
        const r1 = await pasada(sb, { fsx });
        expect(r1.actualizados).toEqual(['cp_documents/cp-1.json']);
        expect(r1.fallidos.map((f) => f.ruta)).toEqual(['_manifest.json', '(base local de esta PC)']);
        t.cp_documents.filas[0].data = JSON.stringify({ items: [1, 2, 3] });             // Supabase vuelve a cambiar
        const r2 = await pasada(sb);
        expect(r2.pendientes).toEqual([]);
        expect(r2.actualizados).toEqual(['cp_documents/cp-1.json']);
    });

    it('R1: si la base local no se puede guardar al final, la pasada no tira: lo dice en los fallidos', async () => {
        const t = tablasBase(); const sb = sbFalso(t);
        await pasada(sb);
        t.cp_documents.filas[0].data = JSON.stringify({ items: [1, 2] });
        const fsx = { ...fs, renameSync: (a, b) => { if (path.resolve(String(b)) === path.resolve(rutaEstado)) throw Object.assign(new Error('tomada'), { code: 'EBUSY' }); return fs.renameSync(a, b); } };
        const r = await pasada(sb, { fsx });
        expect(r.fallidos).toEqual([expect.objectContaining({ ruta: '(base local de esta PC)' })]);
        expect(corridaLimpia(r)).toBe(false);
    });

    it('R2: un sobrante no deja la verificacion en rojo para siempre, y el manifest lo describe', async () => {
        const t = tablasBase(); const sb = sbFalso(t);
        await pasada(sb);
        t.amfe_documents.filas.pop();
        await pasada(sb);
        const m = JSON.parse(fs.readFileSync(archivo('_manifest.json'), 'utf8'));
        expect(m.tablas.amfe_documents.filas).toBe(1);
        expect(m.tablas.amfe_documents.documentos['amfe-2']).toEqual(expect.objectContaining({ sobrante: true }));
        const v = await verificar({ sb, dir, log: mudo });
        expect(separarSobrantes(v.problemas)).toEqual({ problemas: [], sobrantes: ['amfe_documents: 1 sobrantes'] });
        // y con el sobrante en la carpeta, guardar y sincronizar sigue siendo 0 escrituras
        await saveAmfe(sb, 'amfe-1', amfeDoc('con sobrante al lado'), { nubeDir: dir, nubeEstado: rutaEstado });
        const r = await pasada(sb);
        expect([r.actualizados.length, r.manifestEscrito]).toEqual([0, false]);
    });

    it('lo que esta igual SIEMBRA la base: una PC nueva actualiza ese archivo cuando despues cambia Supabase', async () => {
        const t = tablasBase(); const sb = sbFalso(t);
        await pasada(sb);
        const pcNueva = path.join(tmp, 'pc-nueva.json');
        expect((await pasada(sb, { rutaEstado: pcNueva })).iguales).toBe(6);             // base vacia: solo ve iguales
        t.cp_documents.filas[0].data = JSON.stringify({ items: [1, 2] });
        const r = await pasada(sb, { rutaEstado: pcNueva });
        expect(r.actualizados).toEqual(['cp_documents/cp-1.json']);
        expect(r.pendientes).toEqual([]);
    });

    it('la copia de conflicto de un SOBRANTE tambien frena', async () => {
        const t = tablasBase(); const sb = sbFalso(t);
        await pasada(sb);
        t.amfe_documents.filas.pop();                                                     // amfe-2 queda de sobrante
        fs.writeFileSync(archivo('amfe_documents/amfe-2-PCB.json'), fs.readFileSync(archivo('amfe_documents/amfe-2.json'), 'utf8'), 'utf8');
        expect((await pasada(sb)).abortado).toMatch(/amfe-2-PCB\.json: copia de conflicto/);
    });

    it('una copia de conflicto en la raiz frena aunque su catalogo hoy no tenga filas', async () => {
        const t = tablasBase(); const sb = sbFalso(t);
        await pasada(sb);
        fs.writeFileSync(archivo('settings.json'), '[]\n', 'utf8');
        fs.writeFileSync(archivo('settings-PCB.json'), '[]\n', 'utf8');
        expect((await pasada(sb)).abortado).toMatch(/copia de conflicto/);
    });

    it('una corrida con otra carpeta (--out) no le pisa la base a esta', async () => {
        const sb = sbFalso(tablasBase());
        await pasada(sb);
        const otra = path.join(tmp, 'OTRA');
        fs.mkdirSync(otra);
        // misma ruta de base a proposito (el caso viejo): la base es de OTRA carpeta, asi que se lee vacia y no se mezcla
        const r = await sincronizar({ sb, dir: otra, rutaEstado: path.join(tmp, 'estado-otra.json'), aplicar: true, log: mudo });
        expect(r.creados.length).toBe(6);
        expect(Object.keys(leerEstado(rutaEstado, dir).archivos).length).toBe(6);        // la de esta carpeta sigue entera
    });

    it('revisarCarpeta no toma por copia de conflicto un documento vivo cuyo id empieza como otro', () => {
        fs.mkdirSync(archivo('projects'));
        fs.writeFileSync(archivo('projects/2.json'), '{"id":"2"}', 'utf8');
        fs.writeFileSync(archivo('projects/2-b.json'), '{"id":"2-b"}', 'utf8');
        const vivas = new Map([['projects', { modo: 'archivo-por-fila', claves: new Set(['2', '2-b']) }]]);
        expect(revisarCarpeta(dir, vivas).problemas).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
describe('la escritura doble de los guardadores', () => {
    let t, sb;
    const nube = () => ({ nubeDir: dir, nubeEstado: rutaEstado });
    beforeEach(async () => { t = tablasBase(); sb = sbFalso(t); await pasada(sb); });

    it('IDEMPOTENCIA: guardar con saveAmfe y sincronizar enseguida = 0 escrituras', async () => {
        await saveAmfe(sb, 'amfe-1', amfeDoc('causa nueva'), nube());
        const enDisco = JSON.parse(fs.readFileSync(archivo('amfe_documents/amfe-1.json'), 'utf8'));
        expect(enDisco.data.operations[0].workElements[0].functions[0].failures[0].causes[0].cause).toBe('causa nueva');
        expect(enDisco.updated_at).toBe(t.amfe_documents.filas[0].updated_at);
        const antes = foto(dir);
        const r = await pasada(sb);
        expect([r.creados.length, r.actualizados.length, r.pendientes.length, r.manifestEscrito]).toEqual([0, 0, 0, false]);
        expect(foto(dir)).toEqual(antes);
        expect((await verificar({ sb, dir, log: mudo })).problemas).toEqual([]);
    });

    it.each([
        ['saveCp', saveCp, 'cp_documents', 'cp-1', { items: [5, 6] }],
        ['saveHo', saveHo, 'ho_documents', 'ho-1', { sheets: [5, 6] }],
        ['savePfd', savePfd, 'pfd_documents', 'pfd-1', { steps: [5, 6] }],
    ])('%s escribe el archivo, mueve updated_at y la pasada siguiente no escribe nada', async (_n, guardar, tabla, id, doc) => {
        const antesFecha = t[tabla].filas[0].updated_at;
        await guardar(sb, id, doc, nube());
        expect(t[tabla].filas[0].updated_at).not.toBe(antesFecha);
        expect(JSON.parse(fs.readFileSync(archivo(`${tabla}/${id}.json`), 'utf8')).data).toEqual(doc);
        const r = await pasada(sb);
        expect([r.creados.length, r.actualizados.length, r.manifestEscrito]).toEqual([0, 0, false]);
    });

    it('LA NUBE FALLA y el guardado en Supabase NO se rompe: avisa y sigue', async () => {
        const destino = archivo('amfe_documents/amfe-1.json');
        fs.renameSync(destino, `${destino}.guardado`);
        fs.mkdirSync(destino);                               // el destino es una carpeta: no se puede leer ni pisar
        await expect(saveAmfe(sb, 'amfe-1', amfeDoc('igual se guarda'), nube())).resolves.toBeUndefined();
        expect(t.amfe_documents.filas[0].data).toContain('igual se guarda');
        expect(avisos.mock.calls.flat().join(' ')).toMatch(/copia en la nube.*NO se escribio/);
    });

    it('el archivo cambio en la nube: el guardador no lo pisa, lo anota, y Supabase queda guardado', async () => {
        cambiarEnDisco('amfe_documents/amfe-1.json', (o) => { o.data.header.rev = 'EDITADO EN OTRA PC'; });
        await saveAmfe(sb, 'amfe-1', amfeDoc('desde esta pc'), nube());
        expect(t.amfe_documents.filas[0].data).toContain('desde esta pc');
        expect(fs.readFileSync(archivo('amfe_documents/amfe-1.json'), 'utf8')).toContain('EDITADO EN OTRA PC');
        expect(leerEstado(rutaEstado, dir).pendientes['amfe_documents/amfe-1.json'].tipo).toBe('conflicto');
        expect(avisos).toHaveBeenCalled();
    });

    it('sin la copia inicial en la carpeta no arranca una copia de a pedazos', async () => {
        const vacia = path.join(tmp, 'VACIA');
        fs.mkdirSync(vacia);
        const r = await espejarGuardado({ sb, tabla: 'amfe_documents', id: 'amfe-1', dir: vacia, rutaEstado });
        expect(r).toEqual({ escrito: false, motivo: 'sin_copia_inicial' });
        expect(foto(vacia)).toEqual({});
    });

    it('`nube: false` y BARACK_DATOS_NUBE=0 la apagan', async () => {
        const antes = foto(dir);
        await saveAmfe(sb, 'amfe-1', amfeDoc('x'), { ...nube(), nube: false });
        process.env.BARACK_DATOS_NUBE = '0';
        try { await saveAmfe(sb, 'amfe-1', amfeDoc('y'), nube()); } finally { delete process.env.BARACK_DATOS_NUBE; }
        expect(foto(dir)).toEqual(antes);
    });

    it('FALLA PARCIAL AL REVES: Supabase no contesta -> el documento queda en el archivo, se dice, y al volver se repara', async () => {
        sb.ctl.fallaUpdate = { message: 'TypeError: fetch failed', code: '' };
        await expect(saveAmfe(sb, 'amfe-1', amfeDoc('sin supabase'), nube())).rejects.toThrow(/SAVE amfe\/amfe-1.*SOLO en el archivo de la nube/s);
        expect(t.amfe_documents.filas[0].data).not.toContain('sin supabase');            // Supabase quedo atras
        const enDisco = JSON.parse(fs.readFileSync(archivo('amfe_documents/amfe-1.json'), 'utf8'));
        expect(enDisco.data.operations[0].workElements[0].functions[0].failures[0].causes[0].cause).toBe('sin supabase');
        expect(enDisco.amfe_number).toBe('AMFE-1');                                       // la fila sigue entera
        // la pasada lo REPORTA y no lo pisa con la version vieja de Supabase
        sb.ctl.fallaUpdate = null;
        const r = await pasada(sb);
        expect(r.pendientes).toEqual([expect.objectContaining({ ruta: 'amfe_documents/amfe-1.json', tipo: 'solo_archivo' })]);
        expect(fs.readFileSync(archivo('amfe_documents/amfe-1.json'), 'utf8')).toContain('sin supabase');
        // Supabase volvio y el script se corre de nuevo: queda todo igual y sin pendientes
        await saveAmfe(sb, 'amfe-1', amfeDoc('sin supabase'), nube());
        expect(leerEstado(rutaEstado, dir).pendientes).toEqual({});
        const r2 = await pasada(sb);
        expect(corridaLimpia(r2)).toBe(true);
        expect([r2.creados.length, r2.actualizados.length]).toEqual([0, 0]);
        expect((await verificar({ sb, dir, log: mudo })).problemas).toEqual([]);
    });

    it('un 4xx de la puerta de Supabase (clave mala, sin sesion) tampoco es una caida: el archivo no se toca', async () => {
        const antes = foto(dir);
        sb.ctl.fallaUpdate = { message: 'No API key found in request', code: '' };
        sb.ctl.status = 401;
        await expect(saveCp(sb, 'cp-1', { items: [9] }, nube())).rejects.toThrow(/^SAVE cp\/cp-1: No API key found in request$/);
        expect(foto(dir)).toEqual(antes);
    });

    it('un 5xx sin respuesta de la base SI es una caida: el documento queda en el archivo', async () => {
        sb.ctl.fallaUpdate = { message: 'Service Unavailable', code: '' };
        sb.ctl.status = 503;
        await expect(saveCp(sb, 'cp-1', { items: [9] }, nube())).rejects.toThrow(/SOLO en el archivo de la nube/);
        expect(JSON.parse(fs.readFileSync(archivo('cp_documents/cp-1.json'), 'utf8')).data.items).toEqual([9]);
    });

    it('DOS PC: lo que escribio la otra PC al guardar no es un conflicto (el archivo es lo que Supabase tenia)', async () => {
        const otraPc = { nubeDir: dir, nubeEstado: path.join(tmp, 'estado-pc-b.json') };
        await sincronizar({ sb, dir, rutaEstado: otraPc.nubeEstado, aplicar: true, log: mudo });   // la PC B tambien tiene su base
        await saveAmfe(sb, 'amfe-1', amfeDoc('guardo la PC B'), otraPc);
        expect(fs.readFileSync(archivo('amfe_documents/amfe-1.json'), 'utf8')).toContain('guardo la PC B');
        // la PC A (su base todavia dice la version anterior) guarda sin haber sincronizado en el medio
        await saveAmfe(sb, 'amfe-1', amfeDoc('guardo la PC A'), nube());
        expect(fs.readFileSync(archivo('amfe_documents/amfe-1.json'), 'utf8')).toContain('guardo la PC A');
        expect(leerEstado(rutaEstado, dir).pendientes).toEqual({});
        expect(corridaLimpia(await pasada(sb))).toBe(true);
        // y el gemelo: si el archivo lo edito una PERSONA (no es lo que Supabase tenia), sigue siendo conflicto
        cambiarEnDisco('amfe_documents/amfe-1.json', (o) => { o.data.header.rev = 'A MANO'; });
        await saveAmfe(sb, 'amfe-1', amfeDoc('otra vez la PC A'), nube());
        expect(fs.readFileSync(archivo('amfe_documents/amfe-1.json'), 'utf8')).toContain('A MANO');
        expect(leerEstado(rutaEstado, dir).pendientes['amfe_documents/amfe-1.json'].tipo).toBe('conflicto');
    });

    it('dos guardados lanzados juntos no se pisan la base local', async () => {
        await Promise.all([saveCp(sb, 'cp-1', { items: [7] }, nube()), saveHo(sb, 'ho-1', { sheets: [7] }, nube()), savePfd(sb, 'pfd-1', { steps: [7] }, nube())]);
        const e = leerEstado(rutaEstado, dir);
        for (const rel of ['cp_documents/cp-1.json', 'ho_documents/ho-1.json', 'pfd_documents/pfd-1.json']) {
            expect(e.archivos[rel], rel).toBe(sha256(fs.readFileSync(archivo(rel), 'utf8')));
        }
        const r = await pasada(sb);
        expect([r.actualizados.length, r.pendientes.length]).toEqual([0, 0]);
    });

    it('con una copia de conflicto de OneDrive de ESE documento, el guardador no escribe encima', async () => {
        const original = fs.readFileSync(archivo('amfe_documents/amfe-1.json'), 'utf8');
        fs.writeFileSync(archivo('amfe_documents/amfe-1-PCJUAN.json'), original, 'utf8');
        await saveAmfe(sb, 'amfe-1', amfeDoc('no pisa'), nube());
        expect(fs.readFileSync(archivo('amfe_documents/amfe-1.json'), 'utf8')).toBe(original);
        expect(t.amfe_documents.filas[0].data).toContain('no pisa');
        expect(avisos.mock.calls.flat().join(' ')).toMatch(/copia de conflicto/);
    });

    // ---- hallazgos del auditor (10/10/2026), cada uno con el caso que lo reproducia ----

    it('T1: un documento hermano `<id>-algo` NO es una copia de conflicto (ni al guardar, ni cuando su fila se borro)', async () => {
        t.pfd_documents.filas.push({ id: 'pfd-1-l1', document_number: 'PFD-1-L1', updated_at: 'x', data: JSON.stringify({ steps: [1] }) });
        await pasada(sb);                                              // la base conoce a los dos
        await savePfd(sb, 'pfd-1', { steps: [1, 2] }, nube());
        expect(JSON.parse(fs.readFileSync(archivo('pfd_documents/pfd-1.json'), 'utf8')).data.steps).toEqual([1, 2]);
        expect(leerEstado(rutaEstado, dir).pendientes).toEqual({});
        t.pfd_documents.filas.pop();                                   // se borra en la app: su archivo queda de sobrante
        const r = await pasada(sb);
        expect(r.abortado).toBeNull();
        expect(r.sobrantes).toEqual(['pfd_documents/pfd-1-l1.json']);
    });

    it('T2: un `solo_archivo` seguido de un guardado DISTINTO que si entro es un conflicto, no "Supabase quedo atras"', async () => {
        sb.ctl.fallaUpdate = { message: 'TypeError: fetch failed', code: '' };
        await expect(saveCp(sb, 'cp-1', { items: ['v1 sin red'] }, nube())).rejects.toThrow(/SOLO en el archivo/);
        sb.ctl.fallaUpdate = null;
        await saveCp(sb, 'cp-1', { items: ['v2 con red'] }, nube());
        const rel = 'cp_documents/cp-1.json';
        expect(leerEstado(rutaEstado, dir).pendientes[rel].tipo).toBe('conflicto');
        expect(fs.readFileSync(archivo(rel), 'utf8')).toContain('v1 sin red');           // no se piso ninguno
        const r = await pasada(sb);
        expect(r.pendientes).toEqual([expect.objectContaining({ ruta: rel, tipo: 'conflicto' })]);
        // y el plan de subida (apagada) NO lo sube: el archivo viejo no puede pisar la fila nueva
        expect(planificarSubida(leerEstado(rutaEstado, dir).pendientes, { cp_documents: ['cp-1'] }).suben).toEqual([]);
    });

    it('T2 en la pasada: un `solo_archivo` y despues la fila cambia por otro camino (la app) = conflicto, con su nombre', async () => {
        sb.ctl.fallaUpdate = { message: 'TypeError: fetch failed', code: '' };
        await expect(saveCp(sb, 'cp-1', { items: ['v1 sin red'] }, nube())).rejects.toThrow(/SOLO en el archivo/);
        sb.ctl.fallaUpdate = null;
        const rel = 'cp_documents/cp-1.json';
        expect((await pasada(sb)).pendientes).toEqual([expect.objectContaining({ ruta: rel, tipo: 'solo_archivo' })]);   // Supabase sigue igual
        t.cp_documents.filas[0].data = JSON.stringify({ items: ['editado en la app'] });
        expect((await pasada(sb)).pendientes).toEqual([expect.objectContaining({ ruta: rel, tipo: 'conflicto' })]);
        expect(leerEstado(rutaEstado, dir).pendientes[rel].tipo).toBe('conflicto');
    });

    it('con Supabase caido NO se pisa un archivo que cambio en la nube (el camino solo-archivo tambien respeta el candado)', async () => {
        cambiarEnDisco('cp_documents/cp-1.json', (o) => { o.data.items = ['EDITADO EN OTRA PC']; });
        const antes = foto(dir);
        sb.ctl.fallaUpdate = { message: 'TypeError: fetch failed', code: '' };
        const error = await saveCp(sb, 'cp-1', { items: ['sin red'] }, nube()).catch((e) => e);
        expect(error.message).toMatch(/^SAVE cp\/cp-1: TypeError: fetch failed$/);       // sin el "quedo guardado SOLO en el archivo"
        expect(foto(dir)).toEqual(antes);
    });

    it('con Supabase caido y sin archivo previo del documento, no inventa una fila', async () => {
        t.cp_documents.filas.push({ id: 'cp-nuevo', control_plan_number: 'CP-N', updated_at: 'x', data: JSON.stringify({ items: [] }) });
        sb.ctl.fallaUpdate = { message: 'TypeError: fetch failed', code: '' };
        const error = await saveCp(sb, 'cp-nuevo', { items: [1] }, nube()).catch((e) => e);
        expect(error.message).not.toMatch(/SOLO en el archivo/);
        expect(fs.existsSync(archivo('cp_documents/cp-nuevo.json'))).toBe(false);
    });

    it('nada con forma de clave llega a la carpeta tampoco por el guardador', async () => {
        const jwt = ['eyJhbGciOiJIUzI1NiIsInR5cCI6', 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6', 'SflKxwRJSMeKKF2QT4fw'].join('.');
        await saveCp(sb, 'cp-1', { items: [jwt] }, nube());
        expect(Object.values(foto(dir)).join('\n')).not.toContain('eyJhbGci');
        expect(leerEstado(rutaEstado, dir).pendientes['cp_documents/cp-1.json'].tipo).toBe('secreto');
    });

    it('en el caso normal el guardador NO suma una lectura previa a Supabase (solo cuando el archivo no esta como lo dejo)', async () => {
        let lecturas = 0;
        const contar = { ...sb, from: (tabla) => { const q = sb.from(tabla); return { ...q, select: (...a) => { lecturas += 1; return q.select(...a); } }; } };
        await saveCp(contar, 'cp-1', { items: [3] }, nube());
        expect(lecturas).toBe(1);                                      // la relectura de despues, nada mas
        cambiarEnDisco('cp_documents/cp-1.json', (o) => { o.data.items = ['a mano']; });
        lecturas = 0;
        await saveCp(contar, 'cp-1', { items: [4] }, nube());
        expect(lecturas).toBe(2);                                      // ahora si: antes y despues
    });

    it('si la base CONTESTO y rechazo el pedido (error con codigo), el archivo no se toca', async () => {
        const antes = foto(dir);
        sb.ctl.fallaUpdate = { message: 'column "x" does not exist', code: '42703' };
        await expect(saveAmfe(sb, 'amfe-1', amfeDoc('no va'), nube())).rejects.toThrow(/^SAVE amfe\/amfe-1: column "x" does not exist$/);
        expect(foto(dir)).toEqual(antes);
    });
});

// ---------------------------------------------------------------------------
describe('archivos de la nube -> Supabase: APAGADO (espera el si de Fak)', () => {
    it('subir() tira siempre', async () => {
        expect(HABILITADA).toBe(false);
        await expect(subir()).rejects.toThrow(/APAGADO.*si de Fak/);
    });

    it('el plan de subida: solo documentos, solo lo que cambio de un lado, nunca crea una fila', () => {
        const p = planificarSubida({
            'amfe_documents/a1.json': { tipo: 'solo_nube' },
            'ho_documents/h1.json': { tipo: 'solo_archivo' },
            'cp_documents/c1.json': { tipo: 'conflicto' },
            'pfd_documents/p1.json': { tipo: 'sin_base' },
            'drafts/d1.json': { tipo: 'solo_nube' },
            'document_locks/l1.json': { tipo: 'solo_nube' },
            'products.json': { tipo: 'solo_nube' },
            'amfe_documents/borrado.json': { tipo: 'solo_nube' },
        }, { amfe_documents: ['a1'], ho_documents: ['h1'] });
        expect(p.suben).toEqual([
            { ruta: 'amfe_documents/a1.json', tabla: 'amfe_documents', id: 'a1', por: 'saveAmfe' },
            { ruta: 'ho_documents/h1.json', tabla: 'ho_documents', id: 'h1', por: 'saveHo' },
        ]);
        expect(p.noSuben.map((x) => x.ruta).sort()).toEqual(['amfe_documents/borrado.json', 'cp_documents/c1.json', 'document_locks/l1.json', 'drafts/d1.json', 'pfd_documents/p1.json', 'products.json']);
    });

    it('la noche LANZA la pasada como proceso aparte: no importa ni la pasada ni su libreria', () => {
        // adentro del proceso de la noche correria sin `escrituraSegura` y sin el cliente de solo lectura
        const importa = /(from\s+|import\(\s*)['"][^'"]*(datosNube|_datosSincronizar|_datosExportar)(\.mjs)?['"]/;
        for (const rel of ['scripts/_nocturno.mjs', 'scripts/_lib/nocturno.mjs', 'scripts/_preauditarAmfe.mjs', 'scripts/_lib/preauditoriaAmfe.mjs']) {
            expect(fs.readFileSync(path.join(RAIZ, rel), 'utf8'), rel).not.toMatch(importa);
        }
        expect("import { sincronizar } from './_lib/datosNube.mjs';").toMatch(importa);          // gemelo rojo
        expect("const m = await import('./_datosSincronizar.mjs');").toMatch(importa);
        expect(fs.readFileSync(path.join(RAIZ, 'scripts/_nocturno.mjs'), 'utf8')).toMatch(/spawnSync\(process\.execPath, args/);
    });

    it('ni la pasada, ni su libreria, ni la noche importan el modulo de subida', () => {
        for (const rel of ['scripts/_datosSincronizar.mjs', 'scripts/_lib/datosNube.mjs', 'scripts/_nocturno.mjs', 'scripts/_lib/nocturno.mjs', 'scripts/_lib/amfeIo.mjs']) {
            expect(fs.readFileSync(path.join(RAIZ, rel), 'utf8'), rel).not.toMatch(/from\s+['"][^'"]*datosNubeSubir|import\(\s*['"][^'"]*datosNubeSubir/);
        }
    });
});

describe('candados por texto: la pasada no escribe en Supabase y no borra nada', () => {
    const soloCodigo = (src) => src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/\s\/\/ .*$/gm, '');
    const ARCHIVOS = ['scripts/_datosSincronizar.mjs', 'scripts/_lib/datosNube.mjs'];
    const ESCRIBE_SUPABASE = [
        /\.from\([^)]*\)\s*\.(insert|update|upsert|delete)\(/,
        /\b(sb|q|supabase)\b[^;\n]*\.(insert|update|upsert|delete)\(/,
        /exec_sql_write/, /\bsave(Amfe|Cp|Ho|Pfd)\b/, /\.storage\b/, /\brunWithValidation\b/,
    ];
    const BORRA = [/\b(rm|rmdir|unlink|rmSync|rmdirSync|unlinkSync)\s*\(/, /\btruncate(Sync)?\s*\(/];

    it.each(ARCHIVOS)('%s no tiene ninguna escritura a Supabase ni un borrado', (rel) => {
        const codigo = soloCodigo(fs.readFileSync(path.join(RAIZ, rel), 'utf8'));
        for (const re of [...ESCRIBE_SUPABASE, ...BORRA]) expect(codigo, `aparecio ${re} en ${rel}`).not.toMatch(re);
    });

    it('los patrones cazan su gemelo rojo (si no, el test daria verde para todo)', () => {
        const rojos = ["sb.from('amfe_documents').update({ a: 1 })", "await sb.from('x').delete()", "sb.rpc('exec_sql_write', {})", 'await saveAmfe(sb, id, doc)', 'fs.rmSync(ruta)', 'fs.unlinkSync(ruta)'];
        for (const rojo of rojos) expect([...ESCRIBE_SUPABASE, ...BORRA].some((re) => re.test(rojo)), rojo).toBe(true);
    });

    it('el unico RPC es el de lectura (lo hereda de la etapa 0)', () => {
        for (const rel of ARCHIVOS) expect(soloCodigo(fs.readFileSync(path.join(RAIZ, rel), 'utf8'))).not.toMatch(/\.rpc\(/);
    });
});

describe('el cierre de sesion mira la base local (no va a la red)', () => {
    const ahoraMs = new Date('2026-10-10T20:00:00Z').getTime();
    const hace = (h) => new Date(ahoraMs - h * 3600000).toISOString();
    it.each([
        ['sin biblioteca en esta PC', { estado: null, hayCarpeta: false }, 'aviso'],
        ['nunca sincronizo', { estado: { pendientes: {} }, hayCarpeta: true }, 'aviso'],
        ['sincronizada hace un rato y sin pendientes', { estado: { ultimaCorrida: hace(1), pendientes: {} }, hayCarpeta: true }, 'ok'],
        ['con un conflicto sin resolver', { estado: { ultimaCorrida: hace(1), pendientes: { 'amfe_documents/a.json': { tipo: 'conflicto' } } }, hayCarpeta: true }, 'falta'],
        ['se escribio en Supabase despues de la ultima pasada', { estado: { ultimaCorrida: hace(3), pendientes: {} }, hayCarpeta: true, escrituraEpoch: (ahoraMs - 3600000) / 1000 }, 'falta'],
        ['la escritura fue antes de la ultima pasada', { estado: { ultimaCorrida: hace(1), pendientes: {} }, hayCarpeta: true, escrituraEpoch: (ahoraMs - 2 * 3600000) / 1000 }, 'ok'],
        ['la copia tiene mas de un dia', { estado: { ultimaCorrida: hace(40), pendientes: {} }, hayCarpeta: true }, 'aviso'],
        ['la ultima pasada no termino limpia (no se pudo escribir el manifest)', { estado: { ultimaCorrida: hace(1), pendientes: {}, limpia: false }, hayCarpeta: true }, 'falta'],
    ])('%s', (_q, entrada, esperado) => { expect(evaluarCopiaNube({ ...entrada, ahoraMs }).estado).toBe(esperado); });
});

describe('la linea de comandos', () => {
    it('sin argumentos no aplica (dry-run por defecto)', () => {
        expect(leerArgumentos([]).op.aplicar).toBeUndefined();
    });
    it.each([[['--aply']], [['--aplicar', '--verificar']], [['--aceptar-supabase', 'cp_documents/x.json']], [['--out']], [['--out', '--aplicar']]])(
        'frena ante %j', (argv) => { expect(leerArgumentos(argv).error).toMatch(/No hago nada/); });
    it('acepta --aplicar con --aceptar-supabase repetido', () => {
        expect(leerArgumentos(['--aplicar', '--aceptar-supabase', 'a/1.json', '--aceptar-supabase', 'b/2.json', '--json']).op).toEqual(expect.objectContaining({ aplicar: true, json: true, aceptar: ['a/1.json', 'b/2.json'] }));
    });
    it('la linea de resumen dice los pendientes en voz alta', () => {
        const base = { aplicar: true, abortado: null, totalFilas: 899, tablas: 19, creados: [], actualizados: ['a'], iguales: 110, pendientes: [{}], fallidos: [], sobrantes: [] };
        expect(lineaResumen(base)).toBe('899 filas en 19 tablas · 1 archivo(s) escritos · 110 sin cambios · 1 PENDIENTE(S) sin pisar');
        expect(lineaResumen({ ...base, abortado: 'sin red' })).toBe('ABORTADO: sin red');
    });
});
