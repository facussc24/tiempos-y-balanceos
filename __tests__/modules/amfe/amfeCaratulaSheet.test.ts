import { describe, it, expect } from 'vitest';
import XLSX from 'xlsx-js-style';
import { buildCaratulaSheet, computeRowHeights, consolidateRevisions, mergeRevisions, normalizeRevisions, wrapLines } from '../../../modules/amfe/amfeCaratulaSheet';
import { leyendaDeMarcas } from '../../../modules/amfe/specialChars';
import { buildAmfeOficialWorkbook, assertAmfeExportable } from '../../../modules/amfe/amfeExcelExport';
import type { AmfeDocument, AmfeOperation } from '../../../modules/amfe/amfeTypes';

/** Operacion minima con una causa; sod = [severity, occurrence, detection]. */
function makeOp(sod: [string | number, string | number, string | number]): AmfeOperation {
    const [severity, occurrence, detection] = sod;
    return {
        id: 'op1', opNumber: '10', name: 'COSTURA', workElements: [{
            id: 'we1', type: 'Machine', name: 'Máquina', functions: [{
                id: 'fn1', description: 'Coser', requirements: '', failures: [{
                    id: 'f1', description: 'Costura floja', effectLocal: 'Retrabajo',
                    effectNextLevel: '', effectEndUser: '', severity,
                    causes: [{
                        id: 'c1', cause: 'Tensión mal regulada', preventionControl: '', detectionControl: '',
                        occurrence, detection, ap: '', characteristicNumber: '', specialChar: '', filterCode: '',
                        preventionAction: '', detectionAction: '', responsible: '', targetDate: '', status: '',
                        actionTaken: '', completionDate: '', severityNew: '', occurrenceNew: '', detectionNew: '',
                        apNew: '', observations: '',
                    }],
                }],
            }],
        }],
    } as AmfeOperation;
}

// Documento minimo con header rico (aliases incluidos) para la caratula.
function makeDoc(headerOverrides: Record<string, unknown> = {}): AmfeDocument {
    return {
        header: {
            organization: 'BARACK MERCOSUL', location: 'PLANTA HURLINGHAM', client: 'PWA',
            modelYear: '2026', subject: 'Telas Planas', startDate: '23/06/2015', revDate: '01/06/2026',
            team: '', amfeNumber: '159', responsible: 'Carlos Baptista', confidentiality: 'Confidencial',
            partNumber: '21-6756', processResponsible: 'Carlos Baptista', revision: 'G',
            approvedBy: 'Gonzalo Cal', scope: 'Proceso completo', applicableParts: '',
            ...headerOverrides,
        } as AmfeDocument['header'],
        operations: [],
    };
}

/** Todas las celdas de una hoja como { addr: { v, s } }. */
function cells(ws: XLSX.WorkSheet): Array<{ v: string; s: Record<string, unknown> }> {
    const out: Array<{ v: string; s: Record<string, unknown> }> = [];
    const range = XLSX.utils.decode_range(ws['!ref'] as string);
    for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = ws[XLSX.utils.encode_cell({ r, c })];
            if (cell && String(cell.v).trim() !== '') out.push({ v: String(cell.v), s: (cell.s ?? {}) as Record<string, unknown> });
        }
    }
    return out;
}

describe('normalizeRevisions', () => {
    it('acepta el shape de scripts/registry {rev,date,description,modifiedBy}', () => {
        const out = normalizeRevisions([{ rev: 'A', date: '2020-01-01', description: 'Emision', modifiedBy: 'FS' }]);
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ rev: 'A', date: '2020-01-01', details: 'Emision', modifiedBy: 'FS' });
    });

    it('acepta el shape legacy {date,reason,revisedBy,description}', () => {
        const out = normalizeRevisions([{ date: '2020-01-01', reason: 'x', revisedBy: 'CB', description: 'Cambio de plano' }]);
        expect(out[0].details).toBe('Cambio de plano');
        expect(out[0].modifiedBy).toBe('CB');
    });

    it('acepta un JSON string y devuelve [] ante entrada invalida', () => {
        expect(normalizeRevisions('[{"rev":"B","date":"x","description":"y"}]')).toHaveLength(1);
        expect(normalizeRevisions('no-json')).toEqual([]);
        expect(normalizeRevisions(null)).toEqual([]);
        expect(normalizeRevisions(undefined)).toEqual([]);
        expect(normalizeRevisions(42)).toEqual([]);
    });
});

describe('buildCaratulaSheet', () => {
    const revs = normalizeRevisions([
        { rev: 'A', date: '2015-06-23', description: 'Emision inicial' },
        { rev: 'G', date: '2026-06-01', description: 'Alineada al PC rev G' },
    ]);

    it('titula PRELIMINAR cuando el estado no es approved', () => {
        const ws = buildCaratulaSheet(makeDoc(), { revisions: revs, status: 'draft' });
        const title = cells(ws).find(c => c.v.startsWith('A.M.F.E.'));
        expect(title?.v).toBe('A.M.F.E. DE PROCESO PRELIMINAR');
    });

    it('titula sin PRELIMINAR cuando el estado es approved', () => {
        const ws = buildCaratulaSheet(makeDoc(), { revisions: revs, status: 'approved' });
        const title = cells(ws).find(c => c.v.startsWith('A.M.F.E.'));
        expect(title?.v).toBe('A.M.F.E. DE PROCESO');
    });

    it('muestra el nivel de revision vigente en ROJO (FF0000)', () => {
        const ws = buildCaratulaSheet(makeDoc({ revision: 'G' }), { revisions: revs, status: 'draft' });
        // El valor "G" del bloque de identificacion va en rojo bold.
        const redG = cells(ws).find(c => c.v === 'G'
            && ((c.s.font as { color?: { rgb?: string } })?.color?.rgb === 'FF0000'));
        expect(redG).toBeTruthy();
    });

    it('incluye la banda REVISIONES con encabezados y >=15 filas de tabla', () => {
        const ws = buildCaratulaSheet(makeDoc(), { revisions: revs, status: 'draft' });
        const all = cells(ws).map(c => c.v);
        expect(all).toContain('REVISIONES');
        expect(all).toContain('ITEM CAMBIADO');
        expect(all).toContain('FECHA PSW');
        // Debe rellenar a un minimo de filas de formulario: la banda REVISIONES esta
        // bastante despues del bloque de identificacion aunque haya solo 2 revisiones.
        const range = XLSX.utils.decode_range(ws['!ref'] as string);
        expect(range.e.r).toBeGreaterThan(20);
    });

    it('lee el equipo desde coreTeam (array) o team (string)', () => {
        const wsArr = buildCaratulaSheet(
            makeDoc({ coreTeam: ['Carlos Baptista (Ingenieria)', 'Manuel Meszaros (Calidad)'] }),
            { revisions: revs, status: 'draft' });
        expect(cells(wsArr).map(c => c.v)).toContain('Carlos Baptista (Ingenieria)');

        const wsStr = buildCaratulaSheet(
            makeDoc({ team: 'Ana Perez (Ingenieria), Luis Gomez (Calidad)' }),
            { revisions: revs, status: 'draft' });
        const vals = cells(wsStr).map(c => c.v);
        expect(vals).toContain('Ana Perez (Ingenieria)');
        expect(vals).toContain('Luis Gomez (Calidad)');
    });

    it('deja los casilleros de firma SIN nombre impreso (se firman a mano)', () => {
        // El formulario I-AC-005.3 real deja INGENIERIA / CALIDAD / CLIENTE en
        // blanco. Imprimir approvedBy en el casillero de CALIDAD hacia figurar a
        // Gonzalo Cal (que firma HO/Planta) como firmante de calidad.
        const ws = buildCaratulaSheet(makeDoc(), { revisions: revs, status: 'approved' });
        const vals = cells(ws).map(c => String(c.v));
        expect(vals.join(' | ')).toContain('FIRMAS DE APROBACION');
        // Las etiquetas estan solas, sin "\nNombre" pegado abajo.
        expect(vals).toContain('INGENIERIA');
        expect(vals).toContain('CALIDAD');
        expect(vals).toContain('CLIENTE');
        expect(vals.some(v => v.startsWith('CALIDAD\n'))).toBe(false);
        expect(vals.some(v => v.startsWith('INGENIERIA\n'))).toBe(false);
    });

    it('lee las fechas y el equipo por sus alias historicos (amfeDate/revisionDate/coreTeam)', () => {
        // Caso real del AMFE 150: el dato existe pero bajo el nombre viejo.
        // Antes de 2026-08-03 la caratula salia sin fecha de inicio ni de revision.
        const ws = buildCaratulaSheet(
            makeDoc({
                startDate: undefined, revDate: undefined, revision: undefined, team: undefined,
                amfeDate: '2025-04-07', revisionDate: '2025-09-23', revisionLevel: 'B',
                coreTeam: ['Paulo Centurion (Ingenieria)', 'Manuel Meszaros (Calidad)'],
            }),
            { revisions: revs, status: 'draft' });
        const vals = cells(ws).map(c => String(c.v));
        // Salen en formato AR y con el dia correcto (el ISO es medianoche UTC).
        expect(vals).toContain('07/04/2025');
        expect(vals).toContain('23/09/2025');
        expect(vals).not.toContain('06/04/2025');
        expect(vals).toContain('B');
        expect(vals).toContain('Paulo Centurion (Ingenieria)');
    });
});

describe('assertAmfeExportable', () => {
    it('no lanza cuando todas las causas tienen S/O/D', () => {
        const doc = { ...makeDoc(), operations: [makeOp([6, 4, 3])] };
        expect(() => assertAmfeExportable(doc)).not.toThrow();
    });

    it('lanza si falta la severidad (del failure)', () => {
        const doc = { ...makeDoc(), operations: [makeOp(['', 4, 3])] };
        expect(() => assertAmfeExportable(doc)).toThrow(/incompleto/i);
    });

    it('lanza si falta occurrence o detection (de la causa)', () => {
        expect(() => assertAmfeExportable({ ...makeDoc(), operations: [makeOp([6, '', 3])] })).toThrow(/incompleto/i);
        expect(() => assertAmfeExportable({ ...makeDoc(), operations: [makeOp([6, 4, ''])] })).toThrow(/incompleto/i);
    });
});

describe('buildAmfeOficialWorkbook', () => {
    it('antepone la Caratula: SheetNames = [Caratula, AMFE]', () => {
        const doc = { ...makeDoc(), operations: [makeOp([6, 4, 3])] };
        const wb = buildAmfeOficialWorkbook(doc, { revisions: [], status: 'draft' });
        expect(wb.SheetNames).toEqual(['Caratula', 'AMFE']);
    });

    it('propaga el throw del guard cuando el AMFE esta incompleto', () => {
        const doc = { ...makeDoc(), operations: [makeOp([6, '', 3])] };
        expect(() => buildAmfeOficialWorkbook(doc, { revisions: [], status: 'draft' })).toThrow(/incompleto/i);
    });
});

describe('computeRowHeights', () => {
    const cols = [20, 20, 20];

    it('da alto suficiente a una celda con texto largo', () => {
        const texto = 'x'.repeat(300);
        const [h] = computeRowHeights([[{ v: texto }]], cols, [], { minPt: 20, maxPt: 400 });
        expect(h.hpt).toBeGreaterThan(20);
    });

    it('reparte el alto de un merge VERTICAL entre sus filas, no lo ignora', () => {
        // Regresion 2026-08-03: el merge vertical se salteaba entero del calculo,
        // asi que las dos filas quedaban en el minimo y el texto salia cortado.
        // Pasaba en 262 filas de los 17 AMFE del servidor (columna Efecto de Falla).
        const largo = 'Interno: riesgo de reproceso o scrap. '.repeat(8);
        const rows = [[{ v: largo }, { v: 'a' }], [{ v: '' }, { v: 'b' }]];
        const merges = [{ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }];
        const alturas = computeRowHeights(rows, cols, merges, { minPt: 20, maxPt: 400 });
        expect(alturas).toHaveLength(2);
        // Las DOS filas del merge reciben alto; ninguna queda en el minimo.
        expect(alturas[0].hpt).toBeGreaterThan(20);
        expect(alturas[1].hpt).toBeGreaterThan(20);
        // Y entre las dos alcanzan para todo el texto.
        const sinMerge = computeRowHeights([[{ v: largo }]], cols, [], { minPt: 20, maxPt: 400 })[0].hpt;
        expect(alturas[0].hpt + alturas[1].hpt).toBeGreaterThanOrEqual(sinMerge);
    });

    it('un merge HORIZONTAL suma el ancho de sus columnas (menos alto, no mas)', () => {
        const texto = 'y'.repeat(150);
        const solo = computeRowHeights([[{ v: texto }]], cols, [], { minPt: 15, maxPt: 400 })[0].hpt;
        const ancho = computeRowHeights([[{ v: texto }, { v: '' }, { v: '' }]], cols,
            [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }], { minPt: 15, maxPt: 400 })[0].hpt;
        expect(ancho).toBeLessThan(solo);
    });

    it('respeta el tope y el minimo, y nunca devuelve NaN', () => {
        const alturas = computeRowHeights(
            [[{ v: 'z'.repeat(99999) }], [{ v: '' }], [null], [{ v: undefined }]],
            cols, [], { minPt: 20, maxPt: 200 });
        expect(alturas[0].hpt).toBe(200);
        for (const a of alturas) {
            expect(Number.isFinite(a.hpt)).toBe(true);
            expect(a.hpt).toBeGreaterThanOrEqual(20);
        }
    });

    it('no rompe con merges que apuntan fuera del rango de columnas', () => {
        const alturas = computeRowHeights([[{ v: 'hola' }]], cols,
            [{ s: { r: 0, c: 0 }, e: { r: 0, c: 99 } }], { minPt: 15, maxPt: 200 });
        expect(Number.isFinite(alturas[0].hpt)).toBe(true);
    });
});

describe('consolidateRevisions — una fila por letra (Fak, 08/09/2026)', () => {
    it('junta todas las entradas de una misma letra en una sola fila', () => {
        const out = consolidateRevisions([
            { rev: 'A', date: '20/08/2026', item: '70', details: 'SE AGREGA CONTROL.', modifiedBy: 'FS' },
            { rev: 'A', date: '08/09/2026', item: '93', details: 'EL REPROCESO PASA A 93.', modifiedBy: 'FS' },
            { rev: 'A', date: '08/09/2026', item: '100', details: 'SE AGREGA TAPIZADO.', modifiedBy: 'FS' },
        ]);
        expect(out).toHaveLength(1);
        expect(out[0].rev).toBe('A');
        // La fecha que queda es la ULTIMA: es cuando la revision quedo como esta.
        expect(out[0].date).toBe('08/09/2026');
        expect(out[0].item).toBe('70, 93, 100');
        expect(out[0].details).toBe('SE AGREGA CONTROL. EL REPROCESO PASA A 93. SE AGREGA TAPIZADO.');
        // "FS" tres veces es una sola persona, no tres.
        expect(out[0].modifiedBy).toBe('FS');
    });

    it('mantiene separadas las letras distintas y en su orden', () => {
        const out = consolidateRevisions([
            { rev: 'A', date: '12/11/2025', item: 'N/A', details: 'EMISION INICIAL.' },
            { rev: 'B', date: '08/09/2026', item: '20', details: 'CAMBIO.' },
        ]);
        expect(out.map(r => r.rev)).toEqual(['A', 'B']);
    });

    it('ordena los items por numero de operacion y parte las listas', () => {
        const out = consolidateRevisions([
            { rev: 'A', date: '08/09/2026', item: '100', details: 'a.' },
            { rev: 'A', date: '08/09/2026', item: '20 / 21 / 22', details: 'b.' },
            { rev: 'A', date: '08/09/2026', item: '70-71', details: 'c.' },
            { rev: 'A', date: '08/09/2026', item: '93', details: 'd.' },
        ]);
        // "70-71" es UN numero de operacion: no se parte en 70 y 71.
        expect(out[0].item).toBe('20, 21, 22, 70-71, 93, 100');
    });

    it('no repite un item ni un detalle que ya estaba', () => {
        const out = consolidateRevisions([
            { rev: 'A', date: '08/09/2026', item: '20', details: 'MISMO TEXTO.' },
            { rev: 'A', date: '08/09/2026', item: '20', details: 'MISMO TEXTO.' },
        ]);
        expect(out[0].item).toBe('20');
        expect(out[0].details).toBe('MISMO TEXTO.');
    });
});

describe('wrapLines — se cuenta como corta Excel: por palabra', () => {
    it('manda la palabra entera a la linea siguiente en vez de partirla', () => {
        expect(wrapLines('aaaaa bbbbb', 6)).toBe(2);
        expect(wrapLines('aaaaa bbbbb ccccc', 11)).toBe(2);
    });

    it('cuenta MAS lineas que el corte por caracter cuando las palabras no cierran justo', () => {
        // 20 caracteres en lineas de 12: por caracter darian 2, pero ninguna palabra entra
        // de a dos, asi que Excel dibuja 3. Esa linea de diferencia es la que dejaba el
        // DETALLES del AMFE 158 cortado en "TOMADAS DE LA HO-" (PDF del 08/09/2026).
        const texto = 'AAAAAA BBBBBB CCCCCC';
        expect(Math.ceil(texto.length / 12)).toBe(2);
        expect(wrapLines(texto, 12)).toBe(3);
    });

    it('parte la palabra que es mas larga que la linea entera', () => {
        expect(wrapLines('x'.repeat(45), 10)).toBeGreaterThanOrEqual(5);
    });

    it('un texto vacio ocupa una linea, no cero', () => {
        expect(wrapLines('', 10)).toBe(1);
        expect(wrapLines('   ', 10)).toBe(1);
    });
});

describe('leyendaDeMarcas — la sigla se explica sin citar normas (Fak 08/09/2026)', () => {
    it('D/TLD es CARACTERISTICA CRITICA y SC es CARACTERISTICA SIGNIFICATIVA, sin instructivos ni manuales', () => {
        // En Caratula y Flujograma no se citan instructivos ni manuales en la simbologia (LECCIONES
        // 08/09): planta y cliente leen el entregable, no la cocina. Las fuentes viven en el JSON.
        const leyenda = leyendaDeMarcas(['D/TLD', 'SC']);
        const critica = leyenda.find(l => l.mark === 'D/TLD');
        const signif = leyenda.find(l => l.mark === 'SC');
        expect(critica?.meaning).toBe('CARACTERISTICA CRITICA');
        expect(signif?.meaning).toBe('CARACTERISTICA SIGNIFICATIVA');
        for (const l of leyenda) expect(l.meaning).not.toMatch(/VW|AIAG|I-AC-005|manual|instructivo|Formel/i);
        // La critica va primero.
        expect(leyenda[0].mark).toBe('D/TLD');
    });

    it('no repite una sigla que aparece muchas veces, ni cuenta el numero como parte', () => {
        expect(leyendaDeMarcas(['SC', 'SC 1', 'SC 2', 'SC']).map(l => l.mark)).toEqual(['SC']);
    });

    it('sin marcas no hay leyenda', () => {
        expect(leyendaDeMarcas(['', null, undefined])).toEqual([]);
    });

    it('una sigla que ninguna fuente define se lista, no se adivina', () => {
        const [entrada] = leyendaDeMarcas(['XX']);
        expect(entrada.mark).toBe('XX');
        expect(entrada.meaning).toMatch(/NO DEFINIDA/);
    });
});

describe('mergeRevisions — la columna y el documento se unen, no se pisan', () => {
    // Caso real del 11/09/2026 (AMFE 158 INSERT): la columna `revisions` de la tabla estaba
    // congelada en agosto y `data.revisions` tenia las revisiones de septiembre. El export
    // leia solo la columna, asi que el PDF que iba al cliente no registraba ningun cambio.
    const columna = [
        { rev: 'A', date: '17/08/2026', item: '10', description: 'RECEPCION DE MATERIALES.' },
        { rev: 'A', date: '20/08/2026', item: '70', description: 'CONTROL DE PIEZA INYECTADA.' },
    ];
    const documento = [
        { rev: 'A', date: '08/09/2026', item: '20, 21, 22', details: 'REORGANIZACION DEL CORTE.' },
        { rev: 'A', date: '11/09/2026', item: '10, 50', details: 'CARACTERISTICAS ESPECIALES POR CRITERIO.' },
    ];

    it('ROJO sin el merge: la columna sola pierde las revisiones del documento', () => {
        const soloColumna = normalizeRevisions(columna);
        expect(soloColumna.map(r => r.date)).not.toContain('11/09/2026');
    });

    it('VERDE: unidas quedan las cuatro, y la consolidada nombra la fecha mas nueva', () => {
        const todas = mergeRevisions(columna, documento);
        expect(todas).toHaveLength(4);
        expect(todas.map(r => r.date)).toEqual(['17/08/2026', '20/08/2026', '08/09/2026', '11/09/2026']);
        const [fila] = consolidateRevisions(todas);
        expect(fila.date).toBe('11/09/2026');
        expect(fila.details).toMatch(/CARACTERISTICAS ESPECIALES POR CRITERIO/);
        expect(fila.item).toContain('10');
        expect(fila.item).toContain('50');
    });

    it('la misma entrada en las dos fuentes no se duplica y gana la version completa', () => {
        const conRepetida = mergeRevisions(
            [{ rev: 'A', date: '17/08/2026', item: '10', description: 'RECEPCION.' }],
            [{ rev: 'A', date: '17/08/2026', item: '10', details: 'RECEPCION DE MATERIALES (ASAICHI 10-11/08).' }],
        );
        expect(conRepetida).toHaveLength(1);
        expect(conRepetida[0].details).toMatch(/ASAICHI/);
    });

    it('tolera fuentes vacias, nulas o en JSON string', () => {
        expect(mergeRevisions(null, undefined)).toEqual([]);
        expect(mergeRevisions('[{"rev":"A","date":"x","item":"1","description":"y"}]', [])).toHaveLength(1);
    });
});

describe('consolidateRevisions — la fila unica se lee como un texto, no como un pegote', () => {
    it('un item "A-B" se come los sueltos que caen adentro del rango', () => {
        // AMFE 161, 11/09/2026: una revision escribio "20-22" y otra "20","21","22";
        // la fila salia "20, 20-22, 21, 22".
        const [fila] = consolidateRevisions(normalizeRevisions([
            { rev: 'A', date: '09/09/2026', item: '20-22, 40-41, 80-82', description: 'a' },
            { rev: 'A', date: '11/09/2026', item: '10, 20, 21, 40, 41, 80, 81, 82, 100', description: 'b' },
        ]));
        expect(fila.item).toBe('10, 20-22, 40-41, 80-82, 100');
    });

    it('un item que no es "numero-numero" no se toca', () => {
        const [fila] = consolidateRevisions(normalizeRevisions([
            { rev: 'A', date: '18/08/2026', item: 'OP 5 A 90', description: 'a' },
            { rev: 'A', date: '11/09/2026', item: '5, 10', description: 'b' },
        ]));
        expect(fila.item).toContain('OP 5 A 90');
        expect(fila.item).toContain('5');
        expect(fila.item).toContain('10');
    });

    it('los detalles se separan con punto aunque la entrada no lo traiga', () => {
        const [fila] = consolidateRevisions(normalizeRevisions([
            { rev: 'A', date: '17/08/2026', item: '10', description: 'RECEPCION DE MATERIALES' },
            { rev: 'A', date: '11/09/2026', item: '50', description: 'SE ALINEA CON EL FLUJOGRAMA.' },
        ]));
        expect(fila.details).toBe('RECEPCION DE MATERIALES. SE ALINEA CON EL FLUJOGRAMA.');
    });
});
