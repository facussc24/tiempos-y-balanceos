/**
 * Tests de `scripts/_lib/bomLegajoCheck.mjs` — el aviso de cierre que dice si la BOM ultimo
 * nivel del legajo APQP quedo atras del ultimo cambio de BOM (regla de Fak, 22/09/2026).
 *
 * En las dos direcciones: un control que no puede dar rojo esta tan roto como el que no
 * puede dar verde. Los fixtures se fabrican a mano, sin datos de empresa (el repo es publico).
 *
 * Desde el 06/10/2026 la fecha sola no alcanza para decir "falta": si la difusion es posterior
 * se compara la BOM pieza por pieza. El caso que lo origino (una difusion guardada despues con
 * la misma BOM: falso rojo) y su inverso (una difusion que cambia UNA pieza: rojo de verdad)
 * estan los dos, en la funcion pura y de punta a punta sobre PDF de verdad.
 *
 * Correr:  npx vitest run --pool=threads __tests__/scripts/bomLegajoCheck.test.mjs
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluarBomLegajo, relevarBomLegajo, leerCuerposPdf, DATOS } from '../../scripts/_lib/bomLegajoCheck.mjs';

const H = 3600 * 1000;
const fam = (familia, ultimaDifusion, ultimoLegajo) => ({ familia, ultimaDifusion, ultimoLegajo });

describe('evaluarBomLegajo', () => {
    it('ROJO: la difusion es posterior a la BOM del legajo', () => {
        const r = evaluarBomLegajo({ legajoAlcanzable: true, familias: [fam('A', 10 * H, 5 * H), fam('B', 1 * H, 2 * H)] });
        expect(r.estado).toBe('falta');
        expect(r.detalle).toContain('A');
        expect(r.detalle).not.toMatch(/\bB\b/);
    });

    it('ROJO: hay difusion y el legajo no tiene ninguna BOM de esa familia', () => {
        const r = evaluarBomLegajo({ legajoAlcanzable: true, familias: [fam('A', 10 * H, null)] });
        expect(r.estado).toBe('falta');
    });

    it('VERDE: el legajo se genero despues (o en el mismo minuto) que la difusion', () => {
        expect(evaluarBomLegajo({ legajoAlcanzable: true, familias: [fam('A', 10 * H, 10 * H + 5000)] }).estado).toBe('ok');
        expect(evaluarBomLegajo({ legajoAlcanzable: true, familias: [fam('A', 10 * H + 30000, 10 * H)] }).estado).toBe('ok');
    });

    it('AVISO y no rojo: sin el disco de los legajos no se puede medir', () => {
        const r = evaluarBomLegajo({ legajoAlcanzable: false, familias: [fam('A', 10 * H, null)] });
        expect(r.estado).toBe('aviso');
        expect(r.detalle).toContain('_montarDiscos');
    });

    it('AVISO y no verde: una familia cuya biblioteca no se puede leer no desaparece del control', () => {
        const ciega = { ...fam('B', null, null), bibliotecaExiste: false };
        const r = evaluarBomLegajo({ legajoAlcanzable: true, familias: [fam('A', 10 * H, 11 * H), ciega] });
        expect(r.estado).toBe('aviso');
        expect(r.detalle).toContain('B');
        // y si ademas otra familia esta atrasada, manda el rojo y el aviso viaja en el detalle
        const r2 = evaluarBomLegajo({ legajoAlcanzable: true, familias: [fam('A', 10 * H, 5 * H), ciega] });
        expect(r2.estado).toBe('falta');
        expect(r2.detalle).toContain('B');
    });

    it('NO APLICA: ninguna familia tiene difusion', () => {
        expect(evaluarBomLegajo({ legajoAlcanzable: true, familias: [fam('A', null, null)] }).estado).toBe('no-aplica');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Difusion posterior al legajo: decide el contenido, pieza por pieza
// ─────────────────────────────────────────────────────────────────────────────

const cuerpo = (pieza, consumo = '0.3066666') => [
    `${pieza} PIEZA DE PRUEBA`,
    'Articulo Rubro Medida Descripcion Unidad Consumo Modulo Proceso',
    `${pieza} 1 MAT-A VINILO DE PRUEBA MTL ${consumo} CO CUM`,
    `${pieza} 1 MAT-B HILO DE PRUEBA KG 0.0010725 COS PRDCOS`,
];
const LEGAJO_3 = { P1: cuerpo('P1'), P2: cuerpo('P2'), P3: cuerpo('P3') };
/** Familia con el legajo en la hora 5 y las difusiones que se le pasen, todas posteriores. */
const posterior = (difusiones, extra = {}) => ({
    ...fam('F', Math.max(50 * H, ...difusiones.map((d) => d.mtime)), 5 * H),
    contenido: { legajo: { archivo: 'legajo.pdf', mtime: 5 * H, piezas: LEGAJO_3 }, difusiones, ...extra },
});
const evaluar = (familia) => evaluarBomLegajo({ legajoAlcanzable: true, familias: [familia] });

describe('evaluarBomLegajo — difusion posterior al legajo: se compara la BOM por pieza', () => {
    it('VERDE (el falso rojo de APC, 02 al 06/10/2026): difusion posterior de la familia entera con la misma BOM', () => {
        const r = evaluar(posterior([{ archivo: 'dif.pdf', mtime: 50 * H, piezas: { ...LEGAJO_3 } }]));
        expect(r.estado).toBe('ok');
        expect(r.detalle).toMatch(/F: hay una difusion posterior con la misma BOM/);
    });

    it('ROJO (el caso inverso): la difusion trae UNA pieza y esa pieza no es igual a la del legajo', () => {
        const r = evaluar(posterior([{ archivo: 'dif.pdf', mtime: 50 * H, piezas: { P2: cuerpo('P2', '0.42933') } }]));
        expect(r.estado).toBe('falta');
        expect(r.detalle).toContain('BOM distinta a la difundida: P2');
        expect(r.detalle).not.toMatch(/\bP1\b|\bP3\b/);
    });

    it('VERDE: la difusion trae UNA pieza y es la misma BOM que ya tiene el legajo', () => {
        expect(evaluar(posterior([{ archivo: 'dif.pdf', mtime: 50 * H, piezas: { P2: cuerpo('P2') } }])).estado).toBe('ok');
    });

    it('ROJO: una pieza de la difusion no esta en el PDF del legajo, aunque las demas sean iguales', () => {
        const r = evaluar(posterior([{ archivo: 'dif.pdf', mtime: 50 * H, piezas: { ...LEGAJO_3, 'SEMI-01': cuerpo('SEMI-01') } }]));
        expect(r.estado).toBe('falta');
        expect(r.detalle).toContain('no esta en el PDF del legajo: SEMI-01');
    });

    it('ROJO: una fila de mas, una de menos o en otro orden tambien es otra BOM', () => {
        const deMas = [...cuerpo('P1'), 'P1 1 MAT-C ETIQUETA DE PRUEBA UN 1 QUA QW'];
        const deMenos = cuerpo('P1').slice(0, 3);
        const otroOrden = [cuerpo('P1')[0], cuerpo('P1')[1], cuerpo('P1')[3], cuerpo('P1')[2]];
        for (const p1 of [deMas, deMenos, otroOrden, []]) {
            expect(evaluar(posterior([{ archivo: 'dif.pdf', mtime: 50 * H, piezas: { P1: p1 } }])).estado).toBe('falta');
        }
    });

    it('con varias difusiones posteriores tienen que coincidir TODAS: no se elige una por su fecha de archivo', () => {
        const cambiaP2 = { archivo: 'd1.pdf', mtime: 30 * H, piezas: { P2: cuerpo('P2', '0.42933') } };
        const soloP1 = { archivo: 'd2.pdf', mtime: 50 * H, piezas: { P1: cuerpo('P1') } };
        const p2Igual = { archivo: 'd2.pdf', mtime: 50 * H, piezas: { P2: cuerpo('P2') } };
        // ROJO: la mas nueva trae otra pieza; el cambio de la P2 sigue sin llegar al legajo
        const r = evaluar(posterior([soloP1, cambiaP2]));
        expect(r.estado).toBe('falta');
        expect(r.detalle).toContain('BOM distinta a la difundida: P2');
        // ROJO (auditoria 06/10/2026): una difusion con la P2 como en el legajo y fecha de archivo
        // mas nueva (un PDF viejo vuelto a guardar) NO tapa el cambio; tampoco con la misma fecha,
        // ni en otro orden. El precio: un cambio que despues se deshizo da un rojo de mas.
        expect(evaluar(posterior([cambiaP2, p2Igual])).estado).toBe('falta');
        expect(evaluar(posterior([p2Igual, cambiaP2])).estado).toBe('falta');
        expect(evaluar(posterior([{ ...cambiaP2, mtime: 50 * H }, p2Igual])).estado).toBe('falta');
        expect(evaluar(posterior([p2Igual, { ...cambiaP2, mtime: 50 * H }])).estado).toBe('falta');
        expect(evaluar(posterior([p2Igual, { ...cambiaP2, mtime: 90 * H }])).estado).toBe('falta');
        // VERDE: las dos traen lo mismo que el legajo
        expect(evaluar(posterior([soloP1, p2Igual])).estado).toBe('ok');
    });

    it('ROJO, falla cerrado: difusion posterior y el contenido no se pudo leer o vino vacio', () => {
        const sinLeer = evaluar(posterior([], { error: 'dif.pdf: no se pudo abrir' }));
        expect(sinLeer.estado).toBe('falta');
        expect(sinLeer.detalle).toContain('no se pudo comparar el contenido: dif.pdf');
        const igual = { archivo: 'dif.pdf', mtime: 50 * H, piezas: { P1: cuerpo('P1') } };
        const vacia = { archivo: 'vacia.pdf', mtime: 50 * H, piezas: {} };
        expect(evaluar(posterior([vacia])).estado).toBe('falta');
        expect(evaluar(posterior([igual, vacia])).estado).toBe('falta');     // una leida no salva a la que vino vacia
        expect(evaluar(posterior([])).estado).toBe('falta');
        expect(evaluar({ ...fam('F', 50 * H, 5 * H), contenido: { difusiones: [igual] } }).estado).toBe('falta');
    });

    it('una familia con la misma BOM no tapa a otra que esta atrasada', () => {
        const igual = posterior([{ archivo: 'dif.pdf', mtime: 50 * H, piezas: { ...LEGAJO_3 } }]);
        const r = evaluarBomLegajo({ legajoAlcanzable: true, familias: [igual, fam('G', 10 * H, 5 * H)] });
        expect(r.estado).toBe('falta');
        expect(r.detalle).toContain('G');
        expect(r.detalle).not.toMatch(/\bF\b/);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// De punta a punta: PDF dibujados con `pagina()` de _pdfBomArb.py (la funcion que arma los
// reales), leidos por _bomLegajoCuerpo.py y juzgados por relevarBomLegajo + evaluarBomLegajo.
// ─────────────────────────────────────────────────────────────────────────────

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const GENERADOR = path.resolve(AQUI, '../../scripts/_pdfBomArb.py');
const PY_ARMAR = `
import importlib.util as u, json, sys
import fitz
s = u.spec_from_file_location('generador', sys.argv[1]); g = u.module_from_spec(s); s.loader.exec_module(g)
for pdf in json.load(open(sys.argv[2], encoding='utf-8')):
    doc = fitz.open()
    if pdf.get('suelto'):
        doc.new_page().insert_text((72, 72), pdf['suelto'])
    for p in pdf.get('piezas', []):
        g.pagina(doc, p['pieza'], p['filas'], pdf['fecha'], pdf['act'], p.get('descripcion', ''))
    doc.save(pdf['ruta']); doc.close()
`;

/** Filas como las deja `leer_bom()`: [nivel, rubro, medida, desc, unidad, consumo, modulo, proceso]. */
const filasDe = (consumoVinilo = '0,30666660') => [
    [0, '1', 'MAT-A', 'VINILO DE PRUEBA NEGRO', 'MTL', consumoVinilo, 'CO', 'CUM'],
    [0, '1', 'SEMI-01-V1', 'SEMIELABORADO DE PRUEBA', 'UNID', '1,00000000', 'TAP', 'PRDTAP'],
    [1, '1', 'MAT-B', 'ESPUMA DE PRUEBA', 'KG', '0,02205000', '', ''],
    [0, '1', 'MAT-C', 'ETIQUETA DE PRUEBA', 'UN', '0,04166670', 'QUA', 'QW'],
    [0, '1', 'AD - ADFA15', 'ADHESIVO DE PRUEBA', 'KG', '0,04800000', 'TAP', 'PRDTAP'],     // codigo con espacios, como los hay
];
/** Las mismas letras en la ultima fila, corridas de la medida a la descripcion. */
const filasCorridas = () => [...filasDe().slice(0, 4), [0, '1', 'AD -', 'ADFA15 ADHESIVO DE PRUEBA', 'KG', '0,04800000', 'TAP', 'PRDTAP']];
const pieza = (codigo, filas = filasDe()) => ({ pieza: codigo, descripcion: `PIEZA DE PRUEBA ${codigo}`, filas });
const FAMILIA = ['PZA 001', 'PZA 002', 'PZA 003'];
const T0 = Date.UTC(2026, 8, 30, 18, 0, 0);
const DIA = 24 * H;

let dir;
const pdf = (nombre) => path.join(dir, 'pdfs', nombre);

/** Una familia con su legajo (fechado en T0) y las difusiones que se pidan, cada una con su fecha.
 *  `otrosEnLegajo`: [origen, nombre, mtime] de mas PDF en la misma carpeta del legajo. */
function montar(nombre, difusiones, otrosEnLegajo = []) {
    const base = path.join(dir, nombre);
    const legajo = path.join(base, 'legajo');
    const biblioteca = path.join(base, 'biblioteca', 'FAM');
    fs.mkdirSync(legajo, { recursive: true });
    fs.mkdirSync(biblioteca, { recursive: true });
    const poner = (origen, destino, mtime) => {
        fs.copyFileSync(origen, destino);
        fs.utimesSync(destino, new Date(mtime), new Date(mtime));
    };
    poner(pdf('legajo.pdf'), path.join(legajo, 'BOM ARB ultimo nivel_FAM_20260930.pdf'), T0);
    for (const [origen, archivo, mtime] of otrosEnLegajo) poner(origen, path.join(legajo, archivo), mtime);
    difusiones.forEach(([origen, mtime], i) => poner(origen, path.join(biblioteca, `Modificaciones BOM ARB_2026100${i + 1}_FAM.pdf`), mtime));
    return { raiz_biblioteca: path.join(base, 'biblioteca'), familias: { FAM: { legajo, biblioteca: 'FAM', piezas: FAMILIA } } };
}
const medir = (datos, leer) => evaluarBomLegajo(leer ? relevarBomLegajo(datos, leer) : relevarBomLegajo(datos));

// 30 s por test: cada lectura arranca python + PyMuPDF (1,5 a 2,5 s en la notebook).
describe('de punta a punta, sobre PDF de verdad', { timeout: 30000 }, () => {
    beforeAll(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bomlegajo-'));
        fs.mkdirSync(path.join(dir, 'pdfs'));
        const act3 = ['Se da de alta el insumo MAT-Z en la BOM de todas las piezas.', 'PZA 002 1 MAT-Z FILA QUE NO ES DE LA BOM KG 9.99 CO CUM', 'Tercer renglon del bloque.'];
        const pedidos = [
            { ruta: pdf('legajo.pdf'), fecha: '30/09/2026', act: ['Se cambia la unidad del vinilo.'], piezas: FAMILIA.map((c) => pieza(c)) },
            // el caso del 06/10: misma BOM, otra fecha y otro bloque ACTUALIZACIONES (mas largo)
            { ruta: pdf('familia-igual.pdf'), fecha: '07/08/2026', act: act3, piezas: FAMILIA.map((c) => pieza(c)) },
            { ruta: pdf('una-distinta.pdf'), fecha: '02/10/2026', act: ['Cambia el consumo del vinilo.'], piezas: [pieza('PZA 002', filasDe('0,42933000'))] },
            { ruta: pdf('una-igual.pdf'), fecha: '02/10/2026', act: act3, piezas: [pieza('PZA 002')] },
            { ruta: pdf('otra-igual.pdf'), fecha: '03/10/2026', act: act3, piezas: [pieza('PZA 001')] },
            { ruta: pdf('con-semielaborado.pdf'), fecha: '02/10/2026', act: act3, piezas: [...FAMILIA.map((c) => pieza(c)), pieza('SEMI-01-V1', [filasDe()[0], filasDe()[3]])] },
            { ruta: pdf('una-corrida.pdf'), fecha: '02/10/2026', act: act3, piezas: [pieza('PZA 002', filasCorridas())] },
            // una BOM anterior de la misma familia (la PZA 002 con otro consumo): para la carpeta del legajo
            { ruta: pdf('legajo-viejo.pdf'), fecha: '01/09/2026', act: ['Emision anterior.'], piezas: FAMILIA.map((c) => pieza(c, c === 'PZA 002' ? filasDe('0,42933000') : filasDe())) },
            // lo que NO tiene la forma conocida
            { ruta: pdf('sin-bloque.pdf'), suelto: 'Un PDF cualquiera, sin la forma de una BOM del arb' },
            { ruta: pdf('pieza-repetida.pdf'), fecha: '02/10/2026', act: act3, piezas: [pieza('PZA 001'), pieza('PZA 001', filasDe('0,42933000'))] },
            { ruta: pdf('sin-filas.pdf'), fecha: '02/10/2026', act: act3, piezas: [pieza('PZA 001', [])] },
            { ruta: pdf('primera-fila-ajena.pdf'), fecha: '02/10/2026', act: act3, piezas: [pieza('PZA 001', filasDe().slice(2))] },
        ];
        fs.writeFileSync(path.join(dir, 'armar.py'), PY_ARMAR);
        fs.writeFileSync(path.join(dir, 'pedidos.json'), JSON.stringify(pedidos));
        execFileSync('python', [path.join(dir, 'armar.py'), GENERADOR, path.join(dir, 'pedidos.json')], { encoding: 'utf8' });
        fs.writeFileSync(pdf('no-es-pdf.pdf'), 'esto no es un PDF');
    }, 60000);
    afterAll(() => { fs.rmSync(dir, { recursive: true, force: true }); });

    it('0. python y PyMuPDF estan disponibles (nunca skip: un test salteado es un verde vacio)', () => {
        expect(execFileSync('python', ['-c', 'import fitz;print("ok")'], { encoding: 'utf8' }).trim()).toBe('ok');
    });

    it('el lector devuelve la pieza del titulo y el cuerpo SIN el bloque ACTUALIZACIONES, la fecha ni la nota', () => {
        const [legajo, igual, corrida] = leerCuerposPdf([pdf('legajo.pdf'), pdf('familia-igual.pdf'), pdf('una-corrida.pdf')]);
        expect(legajo.paginas.map((p) => p.pieza)).toEqual(FAMILIA);
        const p1 = legajo.paginas[0].cuerpo;
        expect(p1[0]).toBe('PZA 001 PIEZA DE PRUEBA PZA 001');
        expect(p1[1].split('\t')).toEqual(['Articulo', 'Rubro', 'Medida', 'Descripcion', 'Unidad Consumo', 'Modulo', 'Proceso']);
        expect(p1[2].split('\t')).toEqual(['PZA 001', '1', 'MAT-A', 'VINILO DE PRUEBA NEGRO', 'MTL', '0.3066666', 'CO', 'CUM']);
        expect(p1[4].split('\t')).toEqual(['. PZA 001', '1', 'MAT-B', 'ESPUMA DE PRUEBA', 'KG', '0.02205']);
        expect(p1).toHaveLength(7);                              // titulo, encabezado y las 5 filas
        expect(p1.join('\n')).not.toMatch(/ACTUALIZACIONES|30\/09\/2026|NOTA|unidad del vinilo/);
        // misma BOM con otra fecha y un bloque de tres renglones (uno con forma de fila): mismo cuerpo
        expect(igual.paginas).toEqual(legajo.paginas);
        expect(igual.paginas[1].cuerpo.join('\n')).not.toMatch(/MAT-Z|07\/08\/2026/);
        // las celdas no se funden: las mismas letras corridas de la medida a la descripcion son otra fila
        const p2 = legajo.paginas[1].cuerpo;
        expect(corrida.paginas[0].cuerpo[6].replace(/\t/g, ' ')).toBe(p2[6].replace(/\t/g, ' '));
        expect(corrida.paginas[0].cuerpo[6]).not.toBe(p2[6]);
    });

    it('el lector falla cerrado: lo que no tiene la forma conocida es un error para el PDF entero, no una BOM vacia', () => {
        const rotos = ['sin-bloque.pdf', 'no-es-pdf.pdf', 'pieza-repetida.pdf', 'sin-filas.pdf', 'primera-fila-ajena.pdf', 'no-existe.pdf'];
        const [sinBloque, noPdf, repetida, sinFilas, filaAjena, noExiste] = leerCuerposPdf(rotos.map(pdf));
        expect(sinBloque.error).toMatch(/pagina 1: no tiene el bloque ACTUALIZACIONES/);
        expect(noPdf.error).toMatch(/no se pudo abrir/);
        expect(repetida.error).toMatch(/pagina 2: la pieza PZA 001 esta dos veces/);
        expect(sinFilas.error).toMatch(/pagina 1: no tiene filas de BOM/);
        expect(filaAjena.error).toMatch(/pagina 1: la primera fila no es de la pieza del titulo/);
        expect(noExiste.error).toMatch(/no se pudo abrir/);
        for (const r of [sinBloque, noPdf, repetida, sinFilas, filaAjena, noExiste]) expect(r.paginas).toBeUndefined();
    });

    it('VERDE (el caso del 06/10/2026): difusion dos dias posterior, familia entera, misma BOM', () => {
        const datos = montar('verde-familia', [[pdf('familia-igual.pdf'), T0 + 2 * DIA]]);
        const relevado = relevarBomLegajo(datos);
        expect(relevado.familias[0].ultimaDifusion).toBeGreaterThan(relevado.familias[0].ultimoLegajo);   // por fecha seria rojo
        const r = evaluarBomLegajo(relevado);
        expect(r.estado).toBe('ok');
        expect(r.detalle).toContain('FAM: hay una difusion posterior con la misma BOM');
    });

    it('ROJO (el caso inverso): difusion posterior de UNA pieza con otro consumo', () => {
        const r = medir(montar('rojo-una', [[pdf('una-distinta.pdf'), T0 + 2 * DIA]]));
        expect(r.estado).toBe('falta');
        expect(r.detalle).toContain('BOM distinta a la difundida: PZA 002');
        expect(r.detalle).not.toMatch(/PZA 001|PZA 003/);
    });

    it('VERDE: difusion posterior de UNA pieza, igual a esa pieza en el PDF del legajo', () => {
        expect(medir(montar('verde-una', [[pdf('una-igual.pdf'), T0 + 2 * DIA]])).estado).toBe('ok');
    });

    it('ROJO: la difusion posterior trae una pieza que el PDF del legajo no tiene', () => {
        const r = medir(montar('rojo-falta', [[pdf('con-semielaborado.pdf'), T0 + 2 * DIA]]));
        expect(r.estado).toBe('falta');
        expect(r.detalle).toContain('no esta en el PDF del legajo: SEMI-01-V1');
        expect(r.detalle).not.toContain('BOM distinta');
    });

    it('ROJO: las mismas letras corridas de una columna a la otra son otra BOM', () => {
        const r = medir(montar('rojo-corrida', [[pdf('una-corrida.pdf'), T0 + 2 * DIA]]));
        expect(r.estado).toBe('falta');
        expect(r.detalle).toContain('BOM distinta a la difundida: PZA 002');
    });

    it('dos difusiones posteriores: tienen que coincidir las dos, no manda la fecha de archivo', () => {
        // ROJO: la mas nueva trae otra pieza, asi que el cambio de la PZA 002 sigue sin llegar al legajo
        const tapada = medir(montar('rojo-dos', [[pdf('una-distinta.pdf'), T0 + 1 * DIA], [pdf('otra-igual.pdf'), T0 + 2 * DIA]]));
        expect(tapada.estado).toBe('falta');
        expect(tapada.detalle).toContain('BOM distinta a la difundida: PZA 002');
        // ROJO: un PDF con la PZA 002 como en el legajo y fecha de archivo mas nueva no tapa el cambio
        expect(medir(montar('rojo-resguardada', [[pdf('una-distinta.pdf'), T0 + 1 * DIA], [pdf('una-igual.pdf'), T0 + 2 * DIA]])).estado).toBe('falta');
        // VERDE: las dos traen lo que ya tiene el legajo
        expect(medir(montar('verde-dos', [[pdf('una-igual.pdf'), T0 + 1 * DIA], [pdf('otra-igual.pdf'), T0 + 2 * DIA]])).estado).toBe('ok');
    });

    it('una difusion ANTERIOR al legajo no se compara ni se abre: el legajo se genero despues de ella', () => {
        const pedidos = [];
        const espia = (rutas) => { pedidos.push(rutas); return leerCuerposPdf(rutas); };
        const anterior = relevarBomLegajo(montar('verde-anterior', [[pdf('una-distinta.pdf'), T0 - 1 * DIA]]), espia);
        expect(pedidos).toHaveLength(0);
        expect(anterior.familias[0].contenido).toBeUndefined();
        expect(evaluarBomLegajo(anterior).estado).toBe('ok');
        // con una anterior y una posterior se abren el PDF del legajo y SOLO la posterior
        const mezcla = relevarBomLegajo(montar('verde-mezcla', [[pdf('una-distinta.pdf'), T0 - 1 * DIA], [pdf('una-igual.pdf'), T0 + 2 * DIA]]), espia);
        expect(pedidos).toHaveLength(1);
        expect(pedidos[0].map((r) => path.basename(r))).toEqual(['BOM ARB ultimo nivel_FAM_20260930.pdf', 'Modificaciones BOM ARB_20261002_FAM.pdf']);
        expect(evaluarBomLegajo(mezcla).estado).toBe('ok');
    });

    it('se compara contra el PDF MAS NUEVO de ESA familia, aunque la carpeta del legajo tenga otros', () => {
        // ROJO: la carpeta la comparte otra familia con un PDF mas nuevo (pasa de verdad con las tres
        // de puerta); si se tomara ese, la fecha diria "al dia" y el cambio de la PZA 002 no se veria
        const deOtra = [pdf('familia-igual.pdf'), 'BOM ARB ultimo nivel_OTRA FAM_20261005.pdf', T0 + 5 * DIA];
        const rojo = medir(montar('rojo-compartida', [[pdf('una-distinta.pdf'), T0 + 2 * DIA]], [deOtra]));
        expect(rojo.estado).toBe('falta');
        expect(rojo.detalle).toContain('BOM distinta a la difundida: PZA 002');
        // VERDE: quedo una BOM anterior de la familia sin pasar a Obsoleto; la que vale es la ultima
        const anterior = [pdf('legajo-viejo.pdf'), 'BOM ARB ultimo nivel_FAM_20260901.pdf', T0 - 10 * DIA];
        expect(medir(montar('verde-dos-legajos', [[pdf('familia-igual.pdf'), T0 + 2 * DIA]], [anterior, deOtra])).estado).toBe('ok');
    });

    it('ROJO, falla cerrado: la difusion posterior no se puede leer, o python no corre', () => {
        for (const roto of ['no-es-pdf.pdf', 'sin-bloque.pdf']) {
            const r = medir(montar(`rojo-${roto}`, [[pdf(roto), T0 + 2 * DIA]]));
            expect(r.estado, roto).toBe('falta');
            expect(r.detalle, roto).toContain('no se pudo comparar el contenido: Modificaciones BOM ARB_20261001_FAM.pdf');
        }
        const sinPython = medir(montar('rojo-sin-python', [[pdf('familia-igual.pdf'), T0 + 2 * DIA]]), () => { throw new Error('python no corrio (ENOENT)'); });
        expect(sinPython.estado).toBe('falta');
        expect(sinPython.detalle).toContain('no se pudo comparar el contenido: python no corrio');
    });
});

describe('bomLegajos.data.json', () => {
    const d = JSON.parse(fs.readFileSync(DATOS, 'utf8'));
    it('cada familia tiene legajo en el casillero 7, carpeta de biblioteca y piezas sin repetir', () => {
        for (const [nombre, f] of Object.entries(d.familias)) {
            expect(f.legajo, nombre).toMatch(/7-Lista de materiales/);
            expect(f.biblioteca, nombre).toBeTruthy();
            expect(f.piezas.length, nombre).toBeGreaterThan(0);
            expect(new Set(f.piezas).size, nombre).toBe(f.piezas.length);
        }
    });
    it('la raiz de la biblioteca no tiene caracteres de control (el escape \\1 ya paso una vez)', () => {
        expect(d.raiz_biblioteca).not.toMatch(/[\u0000-\u001f]/);
    });
});
