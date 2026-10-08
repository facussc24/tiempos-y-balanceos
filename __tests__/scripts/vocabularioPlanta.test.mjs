/**
 * Control de vocabulario de planta (lista blanca): rojo y verde, en JS, en Python y entre los dos.
 *
 * Origen (Fak, 08/10/2026): un flujograma salio con «RESTITUCION DE CONTROL DE MATERIA PRIMA (IQC) CON
 * CUARENTENA» y Fak: «no se entiende un carajo... jamas podes poner algo que yo no pueda defender o que
 * no entienda». Un documento para la planta lleva solo palabras que Barack usa.
 *
 * Mismo criterio que firmaIASelftest.test.mjs: NUNCA skip si falta python; el gemelo Python y el JS
 * leen el MISMO vocabularioPlanta.data.json y tienen que contestar igual.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    DATOS, palabras, variantes, revisarTextos, resumir, textoDeHallazgos, cargar,
    textosDeFlujograma, revisarVocabularioFlujograma, exigirVocabulario,
} from '../../scripts/_lib/vocabularioPlanta.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = path.join(RAIZ, 'scripts', '_vocabularioPlanta.py');
const FLUJO = path.join(RAIZ, 'scripts', '_flujograma.mjs');
const ENV = { ...process.env, PYTHONIOENCODING: 'utf-8' };

const fuera = (texto, ruta = DATOS) => [...new Set(revisarTextos([['t', texto]], ruta).map((h) => h.palabra))].sort();

/** Copia el data.json, le aplica `mutar` y devuelve la ruta del temporal (cada llamada, un archivo nuevo). */
function datosTemporales(mutar) {
    const d = JSON.parse(fs.readFileSync(DATOS, 'utf8'));
    mutar(d);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-'));
    const ruta = path.join(dir, 'datos.json');
    fs.writeFileSync(ruta, JSON.stringify(d));
    return ruta;
}

// Texto REAL de hojas de operaciones de Barack (HO 933 REV2 y otras de Y:\...\HOJAS DE OPERACIONES\).
const HO_REAL = [
    'Colocar Lamina PEAD dentro del porta bobina.',
    'A través del panel de comando cerrar porta bobina.',
    'Hacer tope de la bobina sobre la izquierda hasta que la misma no presente juego.',
    'Seleccionar programa de corte según el ancho de la bobina que se desee cortar.',
    'Finalizado el corte destrabar porta bobina y retirar los rollos fraccionados.',
    'Verificar que la pieza coincida con la forma con el troquel.',
    'PLAN DE REACCION ANTE NO CONFORME. DE INMEDIATO A SU LIDER O SUPERVISOR',
    'Caracteristicas a controlar. Control visual de pantalla. Recepción de materia prima.',
];

describe('vocabularioPlanta.mjs - ROJO: lo que la lista blanca frena', () => {
    it('el texto que Fak rechazo da rojo, con IQC y RESTITUCION', () => {
        const texto = 'RESTITUCION DE CONTROL DE MATERIA PRIMA (IQC) CON CUARENTENA';
        const f = fuera(texto);
        expect(f).toContain('iqc');
        expect(f).toContain('restitucion');
        // y dice DONDE esta cada una
        const h = revisarTextos([['flow[3].description', texto]]);
        expect(h.every((x) => x.donde === 'flow[3].description')).toBe(true);
        // las dos estan prohibidas a mano: el motivo es "prohibida", no solo "no esta"
        expect(h.find((x) => x.palabra === 'iqc').motivo).toBe('prohibida');
        expect(textoDeHallazgos(h)).toContain('flow[3].description');
    });

    it('jerga que nadie penso en prohibir tambien da rojo (lo que una lista negra no atrapa)', () => {
        expect(fuera('Paradigma sinergico de gobernanza holistica')).toEqual(expect.arrayContaining(['paradigma', 'sinergico']));
        expect(fuera('Control XQZ de la pieza')).toContain('xqz');
    });

    it('las prohibidas que ya existian siguen siendo rojo (hojas de proceso y candado del AMFE)', () => {
        const seta = revisarTextos([['t', 'Apretar la seta de emergencia']]);
        expect(seta.some((h) => h.motivo === 'prohibida' && /parada de emergencia/.test(h.reemplazo))).toBe(true);
        expect(revisarTextos([['t', 'Medir con flexometro']]).some((h) => h.motivo === 'prohibida')).toBe(true);
        const rechazo = revisarTextos([['t', 'Tirar al contenedor de rechazo']]);
        expect(rechazo.some((h) => h.motivo === 'prohibida' && h.reemplazo === 'cajon de scrap')).toBe(true);
    });

    it('una prohibida le gana al corpus y a las aprobadas', () => {
        const ruta = datosTemporales((d) => {
            d.corpus.pieza = [5, 5, 5];
            d.aprobadas.pieza = { fuente: 'x' };
            d.prohibidas.pieza = { reemplazo: 'parte', nota: 'n', fuente: 'f' };
        });
        expect(revisarTextos([['t', 'Colocar la pieza']], ruta).some((h) => h.palabra === 'pieza' && h.motivo === 'prohibida')).toBe(true);
    });

    it('una entrada a mano sin fuente rompe la carga (sin fuente no entra)', () => {
        for (const seccion of ['aprobadas', 'prohibidas']) {
            const ruta = datosTemporales((d) => { d[seccion].palabraxx = { nota: 'sin fuente' }; });
            expect(() => cargar(ruta)).toThrow(/no tiene fuente/);
        }
        const ruta2 = datosTemporales((d) => { d.aprobadas['dos palabras'] = { fuente: 'x' }; });
        expect(() => cargar(ruta2)).toThrow(/UNA palabra/);
    });

    it('el umbral de Fak: dicha una sola vez no alcanza; en muchos mensajes o en una hoja, si', () => {
        const ruta = datosTemporales((d) => {
            d.reglas.min_mensajes_fak = 3;
            d.corpus.xqzsolofakuno = [0, 0, 1];
            d.corpus.xqzsolofaknueve = [0, 0, 9];
            d.corpus.xqzenho = [1, 0, 0];
            d.corpus.xqzensgc = [0, 1, 0];
        });
        expect(fuera('xqzsolofakuno', ruta)).toEqual(['xqzsolofakuno']);
        expect(fuera('xqzsolofaknueve', ruta)).toEqual([]);
        expect(fuera('xqzenho', ruta)).toEqual([]);
        expect(fuera('xqzensgc', ruta)).toEqual([]);
    });
});

describe('vocabularioPlanta.mjs - VERDE: lo que Barack escribe de verdad pasa', () => {
    it.each(HO_REAL)('HO real: %s', (t) => {
        expect(fuera(t)).toEqual([]);
    });

    it('codigos de pieza, numeros de operacion, fechas y unidades no se miran', () => {
        expect(fuera('2HC.858.417 N 231 MP8147 21-9689 OP 10 OP-20.1 I-IN-002.4-R01 10mm 5 kg 2 bar 180 rpm')).toEqual([]);
        expect(fuera('Pieza 2HC.858.417.A PN4455XQ')).toEqual([]);
        expect(fuera('08/10/2026 85% 3,5 - 4,5 mm +/- 0,2')).toEqual([]);
    });

    it('mayusculas, tildes, plural y genero cuentan como la misma palabra', () => {
        expect(fuera('RECEPCIÓN DE MATERIA PRIMA')).toEqual([]);
        expect(fuera('Colocar las bobinas y retirar los rollos fraccionados')).toEqual([]);
    });

    it('una URL o un mail no se miran', () => {
        expect(fuera('ver https://www.xqzkwv.com/abc o escribir a juan@xqzkwv.com')).toEqual([]);
    });

    it('una palabra aprobada CON FUENTE pasa (y sin aprobar, no)', () => {
        const ruta = datosTemporales((d) => { d.aprobadas.xqzterm = { fuente: 'Test: documento ficticio de prueba' }; });
        expect(fuera('Colocar xqzterm')).toContain('xqzterm');
        expect(fuera('Colocar xqzterm', ruta)).toEqual([]);
        expect(fuera('Colocar xqzterms', ruta)).toEqual([]);
    });

    it('las unidades ignoradas llevan su fuente', () => {
        const d = JSON.parse(fs.readFileSync(DATOS, 'utf8'));
        for (const [k, blk] of Object.entries(d.ignoradas)) {
            expect(String(blk.fuente ?? '').trim().length, `ignoradas.${k} sin fuente`).toBeGreaterThan(5);
        }
    });
});

describe('vocabularioPlanta.mjs - tokenizacion', () => {
    it('palabras(): sin tildes, sin codigos, partidas por guion, la enie es n', () => {
        expect(palabras('Pre-armado de CÓDIGO MP8147 y 2HC.858.417, pieza N° 231')).toEqual(['pre', 'armado', 'de', 'codigo', 'pieza']);
        expect(palabras('diseño año')).toEqual(['diseno', 'ano']);
    });
    it('variantes(): plural y genero', () => {
        expect(variantes('operaciones').has('operacion')).toBe(true);
        expect(variantes('controles').has('control')).toBe(true);
        expect(variantes('piezas').has('pieza')).toBe(true);
        expect(variantes('colocada').has('colocado')).toBe(true);
    });
});

describe('vocabularioPlanta.mjs - flujogramas', () => {
    const doc = {
        _doc: 'nota interna con palabras raras zzqq que NO se imprime',
        header: { title: 'FLUJOGRAMA DE PROCESO', documentCode: 'I-IN-002/III', revision: 'A', date: '08/10/2026',
            preparedBy: 'FACUNDO SANTORO', specialChars: [{ mark: 'D/TLD', meaning: 'CARACTERÍSTICA CRÍTICA' }],
            footerNote: 'Para toda operación marcada es obligatorio consultar el Plan de Control.' },
        products: [{ code: 'MP8405', level: '', description: 'SOPORTE', version: '2HC.864.263.C' }],
        revisions: [{ rev: 'A', date: '08/10/2026', item: 'N/A', details: 'EMISION INICIAL DEL FLUJOGRAMA', modifiedBy: 'FS' }],
        flow: [
            { stepId: '10', type: 'operation', description: 'RECEPCIÓN DE MATERIA PRIMA', critical: true, criticalType: 'D/TLD', criticalColor: 'black' },
            { type: 'condition', description: 'CONTROL DE PIEZA', labelCondition: 'OK', branchSide: { direction: 'right', type: 'terminal', text: 'SCRAP', description: 'RESTITUCION DEL LOTE', labelNode: 'NO' } },
            { type: 'storage', description: 'ALMACENADO CON IQC', rework: { label: 'REPROCESO (A OP. 10)', targetId: '10' } },
            { type: 'operation', stepId: '20', description: 'COSTURA', branches: [[{ type: 'operation', stepId: '21', description: 'CORTE' }]] },
        ],
    };

    it('textosDeFlujograma(): junta los textos que se imprimen y no las notas con guion bajo', () => {
        const t = textosDeFlujograma(doc);
        const donde = t.map(([d]) => d);
        expect(donde).toContain('header.title');
        expect(donde).toContain('header.specialChars[0].meaning');
        expect(donde).toContain('revisions[0].details');
        expect(donde).toContain('products[0].description');
        expect(donde).toContain('flow[1].branchSide.description');
        expect(donde).toContain('flow[2].rework.label');
        expect(donde).toContain('flow[3].branches[0][0].description');
        expect(donde.some((d) => d.startsWith('_'))).toBe(false);
        expect(t.map(([, x]) => x).join(' ')).not.toContain('zzqq');
    });

    it('revisarVocabularioFlujograma(): frena las palabras fuera y dice el renglon', () => {
        const h = revisarVocabularioFlujograma(doc);
        const r = resumir(h);
        expect(Object.keys(r)).toContain('iqc');
        expect(Object.keys(r)).toContain('restitucion');
        expect(r.restitucion.donde).toContain('flow[1].branchSide.description');
        expect(r.iqc.donde).toContain('flow[2].description');
        expect(Object.keys(r)).not.toContain('zzqq');
    });

    it('exigirVocabulario(): devuelve false y lista las palabras; true si pasa', () => {
        const lineas = [];
        expect(exigirVocabulario(textosDeFlujograma(doc), { nombre: 'el flujograma', log: (s) => lineas.push(s) })).toBe(false);
        expect(lineas.join('\n')).toMatch(/NO SE GENERA/);
        expect(lineas.join('\n')).toMatch(/"iqc"/);
        expect(exigirVocabulario([['t', 'Colocar la pieza']], { log: () => { throw new Error('no deberia loguear'); } })).toBe(true);
    });

    it('_flujograma.mjs --solo-vocabulario --archivo: sale 1 con la palabra mala y 0 sin ella', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-flujo-'));
        const malo = path.join(dir, 'malo.json');
        const bueno = path.join(dir, 'bueno.json');
        fs.writeFileSync(malo, JSON.stringify(doc));
        const limpio = JSON.parse(JSON.stringify(doc));
        limpio.flow[1].branchSide.description = 'DEVOLUCION DEL LOTE';
        limpio.flow[2].description = 'ALMACENADO PENDIENTE DE CONTROL';
        fs.writeFileSync(bueno, JSON.stringify(limpio));
        const rMalo = spawnSync('node', [FLUJO, '--solo-vocabulario', '--archivo', malo], { encoding: 'utf8', env: ENV, timeout: 60000 });
        expect(rMalo.status).toBe(1);
        expect(rMalo.stdout).toMatch(/"iqc"/);
        expect(rMalo.stdout).toMatch(/"restitucion"/);
        const rBueno = spawnSync('node', [FLUJO, '--solo-vocabulario', '--archivo', bueno], { encoding: 'utf8', env: ENV, timeout: 60000 });
        expect(rBueno.stdout).toMatch(/0 palabra\(s\) fuera/);
        expect(rBueno.status).toBe(0);
    }, 90000);
});

describe('vocabulario_planta.py - el gemelo Python', () => {
    it('el selftest Python da todo verde (rojo y verde)', () => {
        const out = execFileSync('python', [CLI, '--selftest'], { encoding: 'utf8', env: ENV, timeout: 170000 });
        expect(out).toContain('selftest vocabularioPlanta: todo verde');
        expect(out).not.toMatch(/^ {2}MAL/m);
        expect(out).toMatch(/ok {4}el flujograma que Fak rechazo da rojo/);
        expect((out.match(/^ {2}ok {2}/gm) || []).length).toBeGreaterThanOrEqual(25);
    }, 180000);

    it('paridad: el gemelo Python y el JS contestan IGUAL sobre los mismos textos', () => {
        const items = [
            ['a', 'RESTITUCION DE CONTROL DE MATERIA PRIMA (IQC) CON CUARENTENA'],
            ['b', ...[HO_REAL[0]]],
            ['c', 'Apretar la seta de emergencia y medir con flexometro'],
            ['d', 'Tirar al contenedor de rechazo. 2HC.858.417 N 231 MP8147 21-9689'],
            ['e', 'Paradigma sinergico de gobernanza holistica; diseño del año; Pre-armado'],
            ['f', 'OPERACIONES de CONTROLES; piezas colocadas; ver https://xqz.com/a y juan@xqz.com'],
            ['g', 'RECEPCIÓN DE MATERIA PRIMA | ALMACENADO PENDIENTE DE CONTROL | SCRAP'],
        ];
        const js = revisarTextos(items).map((h) => ({ palabra: h.palabra, motivo: h.motivo, donde: h.donde }));
        const r = spawnSync('python', [CLI, '--revisar-json'], { input: JSON.stringify(items), encoding: 'utf8', env: ENV, timeout: 120000 });
        const py = JSON.parse(r.stdout);
        expect(py).toEqual(js);
        expect(js.length).toBeGreaterThan(4);       // que la comparacion no sea vacia
    }, 130000);
});
