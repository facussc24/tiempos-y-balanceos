/**
 * Tests de `scripts/_pdfBomArb.py` — el generador del PDF de difusion de cambios de BOM.
 *
 * POR QUE EXISTEN: el 04/08/2026 ese PDF se difundio a 15 personas con tres filas sin
 * unidad ni consumo, y con la leyenda "fiel extracto" al pie. La causa fue una trampa del
 * formato del export del arb que YA estaba documentada en `.arb-cache/README.md` y que el
 * parser ignoraba. La primera correccion tambien fallo, por confiar en "¿este campo parece
 * un numero?" en vez de exigir la forma completa.
 *
 * Todos los fixtures se FABRICAN a mano (el repo es publico: cero datos de empresa). Esa es
 * la unica forma de cubrir un caso que no esta entre los datos reales de hoy pero va a
 * llegar manana — leccion del 03/08 con el lector de .msg.
 *
 * CADA GATE TIENE SU CASO VERDE Y SU CASO ROJO: un gate se rompe en silencio igual que un
 * parser (basta cambiar un sys.exit por un print, que es literalmente lo que decia el commit
 * del 04/08). Un test que solo prueba el camino feliz no protege el gate.
 *
 * Correr:  npx vitest run --pool=threads __tests__/scripts/pdfBomArb.test.mjs
 * (sin --pool=threads vitest no corre NINGUN test en esta notebook y sale con codigo 0)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** PDFBOM_SCRIPT permite apuntar la suite a una copia MUTADA del script, para comprobar que
 *  estos tests fallan cuando el codigo se rompe. Un test que sigue verde con el bug puesto no
 *  protege nada — y eso ya paso hoy: el "test 2" original seguia verde con la mutacion que
 *  decia cazar. La mutacion se corre con scripts/_mutarPdfBom.mjs. */
const SCRIPT = process.env.PDFBOM_SCRIPT
    ?? path.resolve(fileURLToPath(import.meta.url), '../../../scripts/_pdfBomArb.py');

/** El gate 1 exige >= 4500 lineas. Se rellena con registros validos en vez de bajarle el
 *  umbral al script con un flag: un flag de test seria una puerta trasera del gate. */
const RELLENO = 4600;
const ENCABEZADO = 'Articulo\t Rubro\t Medida\t  Descripcion\tUnidad\tConsumo\tModulo\tProceso';

let dir;

/** Fila de nivel 0 completa, con el padding a 15 caracteres que usa el arb. */
const fila = (art, medida, desc, unidad, consumo, mod = 'TAP', proc = 'PRDTAP') =>
    `${art.padEnd(15)}\t 1    \t ${medida.padEnd(14)}\t ${desc.padEnd(40)}\t ${unidad.padEnd(5)}\t   ${consumo}\t${mod.padEnd(10)}\t${proc.padEnd(15)}\t`;

/** Fila de nivel 1 (sub-ensamble): arranca en la columna 7 y deja la 0 vacia. */
const filaN1 = (padre, medida, desc, unidad, consumo) =>
    `${'\t'.repeat(7)}${padre.padEnd(15)}\t 1    \t ${medida.padEnd(14)}\t ${desc.padEnd(40)}\t ${unidad.padEnd(5)}\t   ${consumo}\t`;

/** Fila de cualquier nivel (arranca en la columna 7 x nivel) y con el rubro que se le pida. */
const filaNivel = (nivel, padre, medida, desc, unidad, consumo, rubro = '1') =>
    `${'\t'.repeat(7 * nivel)}${padre.padEnd(15)}\t ${rubro.padEnd(5)}\t ${medida.padEnd(14)}\t ${desc.padEnd(40)}\t ${unidad.padEnd(5)}\t   ${consumo}\tTAP       \tPRDTAP         \t`;

/** El registro partido en dos renglones con la linea vacia en el medio: EL incidente. */
const filaPartida = (art, medida, descIni, descFin, unidad, consumo, mod = 'COS', proc = 'PRDCOS') => [
    `${art.padEnd(15)}\t 1    \t ${medida.padEnd(14)}\t ${descIni}`,
    '',
    `${descFin}\t ${unidad.padEnd(5)}\t   ${consumo}\t${mod.padEnd(10)}\t${proc.padEnd(15)}\t`,
];

function escribir({ filas, articulos, sinArticulo = false, truncar = false }) {
    const cuerpo = [];
    for (let i = 0; i < RELLENO; i++) {
        cuerpo.push(fila(`REL-${String(i).padStart(5, '0')}`, 'MAT-X', 'RELLENO', 'UN', '1,00000000'));
    }
    let txt = [ENCABEZADO, ...filas, ...cuerpo].join('\n') + '\n';
    if (truncar) txt = txt.slice(0, Math.floor(txt.length / 3));   // corta a mitad de linea
    fs.writeFileSync(path.join(dir, 'RELACIONES.TXT'), txt, 'latin1');

    if (!sinArticulo) {
        const arts = (articulos ?? []).map(a => `${a.padEnd(20)}\tDESCRIPCION ${a}\t       0,0000\t         0,0000\t`);
        for (let i = 0; i < RELLENO; i++) {
            arts.push(`${`REL-${String(i).padStart(5, '0')}`.padEnd(20)}\tRELLENO\t       0,0000\t         0,0000\t`);
        }
        fs.writeFileSync(path.join(dir, 'ARTICULO.TXT'), arts.join('\n') + '\n', 'latin1');
    }
}

function correr(piezas, extra = []) {
    const salida = path.join(dir, 'out.pdf');
    try {
        const stdout = execFileSync('python', [
            SCRIPT, '--piezas', piezas, '--fecha', '04/08/2026', '--act', 'prueba',
            '--salida', salida, '--relaciones', path.join(dir, 'RELACIONES.TXT'), ...extra,
        ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        return { ok: true, stdout, salida };
    } catch (e) {
        return { ok: false, stdout: e.stdout ?? '', stderr: e.stderr ?? '', status: e.status, salida };
    }
}

/** Texto del PDF, pagina por pagina — se valida sobre el ARCHIVO, no sobre lo que dice el script. */
function textoPdf(salida) {
    const py = `import fitz,json;d=fitz.open(r"${salida}");print(json.dumps([p.get_text() for p in d]))`;
    return JSON.parse(execFileSync('python', ['-c', py], { encoding: 'utf8' }));
}

/** Las palabras de cada renglon del PDF con su caja: [[x0, x1, texto], ...] de izquierda a
 *  derecha, agrupadas por altura. Se lee del ARCHIVO, con una cuenta que no es la del script:
 *  si no, el test validaria al gate contra si mismo. */
function cajasPdf(salida) {
    const py = [
        'import fitz,json,collections',
        `d=fitz.open(r"${salida}")`,
        'out=[]',
        'for p in d:',
        '    r=collections.defaultdict(list)',
        '    for w in p.get_text("words"):',
        '        r[round(w[3])].append((w[0],w[2],w[4]))',
        '    out.append([sorted(v) for _y,v in sorted(r.items())])',
        'print(json.dumps(out))',
    ].join('\n');
    return JSON.parse(execFileSync('python', ['-c', py], { encoding: 'utf8' }));
}

/** Los renglones como texto. Dos columnas pegadas salen como UNA palabra. */
const renglonesPdf = (salida) => cajasPdf(salida).map(pag => pag.map(r => r.map(c => c[2]).join(' ')));

/** Palabras de un mismo renglon que se montan una sobre otra. El lector NO las junta cuando se
 *  pisan de mas (unos 7 pt): salen como dos palabras sanas, y por texto no se ve nada. */
const montadas = (salida) => cajasPdf(salida).flatMap(pag => pag.flatMap(r =>
    r.slice(1).filter((c, i) => c[0] < r[i][1] - 0.5).map(c => c[2])));

beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfbom-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

describe('_pdfBomArb.py', () => {
    it('0. python y PyMuPDF estan disponibles (nunca skip: un test salteado es un verde vacio)', () => {
        const v = execFileSync('python', ['-c', 'import fitz;print("ok")'], { encoding: 'utf8' });
        expect(v.trim()).toBe('ok');
    });

    describe('filas partidas — el incidente del 04/08/2026', () => {
        it('1. fusiona el registro partido y conserva unidad y consumo', () => {
            escribir({
                filas: [
                    fila('PZA-1', 'MAT-A', 'MATERIAL NORMAL', 'UN', '2,00000000'),
                    ...filaPartida('PZA-1', 'FX483TK-11930E', 'DECOR DOUBLE STITCHING LINE 20/3 NM', 'AL', 'KG', '0,00015000'),
                ],
                articulos: ['PZA-1'],
            });
            const r = correr('PZA-1');
            expect(r.stderr ?? '').toBe('');
            expect(r.ok).toBe(true);
            const [pag] = textoPdf(r.salida);
            expect(pag).toContain('FX483TK-11930E');
            expect(pag).toContain('0.00015');          // el consumo que se perdia
            expect(pag).toContain('KG');
        });

        it('2. una MEDIDA numerica no se traga la fila siguiente (bug de la 1ra correccion)', () => {
            escribir({
                filas: [
                    fila('PZA-1', '4034', 'CODIGO DE INSUMO QUE ES SOLO DIGITOS', 'UN', '3,00000000'),
                    fila('PZA-1', 'MAT-B', 'SEGUNDO MATERIAL', 'KG', '0,50000000'),
                ],
                articulos: ['PZA-1'],
            });
            const r = correr('PZA-1');
            expect(r.ok).toBe(true);
            const [pag] = textoPdf(r.salida);
            expect(pag).toContain('4034');
            expect(pag).toContain('MAT-B');
            expect(pag).toContain('0.5');              // el 2do material conserva SU consumo
            expect(r.stdout).toContain('2 filas');
        });

        it('3. incluye los sub-ensambles de nivel 1 (no solo el nivel 0)', () => {
            escribir({
                filas: [
                    fila('PZA-1', 'SUB-1', 'SUBENSAMBLE', 'UN', '1,00000000'),
                    filaN1('SUB-1', 'MAT-C', 'MATERIAL DEL SUBENSAMBLE', 'MT2', '0,25000000'),
                ],
                articulos: ['PZA-1'],
            });
            const r = correr('PZA-1');
            expect(r.ok).toBe(true);
            expect(textoPdf(r.salida)[0]).toContain('MAT-C');
            expect(r.stdout).toContain('sub-ensamble');
        });
    });

    describe('gates — cada uno con su caso rojo', () => {
        it('4. ROJO gate 1: export truncado aborta y no deja archivo', () => {
            escribir({ filas: [fila('PZA-1', 'MAT-A', 'X', 'UN', '1,00000000')], articulos: ['PZA-1'], truncar: true });
            const r = correr('PZA-1');
            expect(r.ok).toBe(false);
            expect(r.stderr).toMatch(/INCOMPLETO/);
            expect(fs.existsSync(r.salida)).toBe(false);
        });

        it('5. ROJO gate 2: producto anulado (esta en RELACIONES pero no en ARTICULO)', () => {
            escribir({ filas: [fila('PZA-VIEJA', 'MAT-A', 'X', 'UN', '1,00000000')], articulos: [] });
            const r = correr('PZA-VIEJA');
            expect(r.ok).toBe(false);
            expect(r.stderr).toMatch(/ANULADOS/);
            expect(fs.existsSync(r.salida)).toBe(false);
        });

        it('6. ROJO gate 2: sin ARTICULO.TXT falla CERRADO, no lo saltea', () => {
            escribir({ filas: [fila('PZA-1', 'MAT-A', 'X', 'UN', '1,00000000')], sinArticulo: true });
            const r = correr('PZA-1');
            expect(r.ok).toBe(false);
            expect(r.stderr).toMatch(/ARTICULO\.TXT/);
            expect(fs.existsSync(r.salida)).toBe(false);
        });

        it('7. ROJO gate 4: una fila sin consumo aborta en vez de difundirse', () => {
            escribir({
                filas: [`${'PZA-1'.padEnd(15)}\t 1    \t ${'MAT-A'.padEnd(14)}\t ${'SIN CONSUMO'.padEnd(40)}`],
                articulos: ['PZA-1'],
            });
            const r = correr('PZA-1');
            expect(r.ok).toBe(false);
            expect(fs.existsSync(r.salida)).toBe(false);
        });

        it('7b. ROJO gate 4: consumo presente pero con formato invalido tambien aborta', () => {
            // Llega al gate 4 (no al 3): la fila esta completa en forma, pero el consumo no
            // es un consumo. Sin este caso, cambiar el sys.exit del gate 4 por un print pasa
            // desapercibido — el gate 3 tapaba al 4 en el unico test que habia.
            escribir({
                filas: [fila('PZA-1', 'MAT-A', 'CONSUMO BASURA', 'UN', 'XXX')],
                articulos: ['PZA-1'],
            });
            const r = correr('PZA-1');
            expect(r.ok).toBe(false);
            expect(r.stderr).toMatch(/sin unidad o sin consumo/);
            expect(fs.existsSync(r.salida)).toBe(false);
        });

        it('7c. ROJO gate 3: una linea que no encaja en ninguna forma conocida aborta', () => {
            // Arranca en la columna 4, que no es un offset de nivel (0/7/14/21). Antes que
            // adivinar que es, el script frena: perder una fila en silencio es el modo de
            // falla que se difundio el 04/08/2026.
            escribir({
                filas: [
                    fila('PZA-1', 'MAT-A', 'MATERIAL', 'UN', '1,00000000'),
                    `${'\t'.repeat(4)}BASURA QUE NO ES NI REGISTRO NI CONTINUACION`,
                ],
                articulos: ['PZA-1'],
            });
            const r = correr('PZA-1');
            expect(r.ok).toBe(false);
            expect(r.stderr).toMatch(/no supe clasificar/);
            expect(fs.existsSync(r.salida)).toBe(false);
        });

        it('7d. la continuacion exige forma de UNIDAD, no solo un numero abajo', () => {
            // Fila partida abierta y, tras la linea vacia, un registro nuevo cuyo campo de
            // rubro NO tiene forma de unidad. Si se fusionara, la descripcion del registro
            // abierto se contaminaria y el registro nuevo desapareceria del PDF.
            escribir({
                filas: [
                    `${'PZA-1'.padEnd(15)}\t 1    \t ${'MAT-CORTADO'.padEnd(14)}\t DESCRIPCION QUE SIGUE`,
                    '',
                    `${'PZA-1'.padEnd(15)}\t 1    \t 0,5000\t ${'OTRO MATERIAL'.padEnd(40)}\t UN   \t   2,00000000\tTAP       \tPRDTAP         \t`,
                ],
                articulos: ['PZA-1'],
            });
            const r = correr('PZA-1');
            // El registro abierto nunca se cierra => el script frena en vez de inventar.
            expect(r.ok).toBe(false);
            expect(r.stderr).toMatch(/no supe clasificar|sin unidad o sin consumo/);
            expect(fs.existsSync(r.salida)).toBe(false);
        });

        it('7e. la continuacion exige la LINEA VACIA previa; sin ella, frena', () => {
            // Mismo contenido que una fila partida legitima pero SIN la linea vacia del medio.
            // El formato real siempre la trae; si no esta, es una forma que no conozco y el
            // script tiene que frenar en vez de fusionar a ciegas.
            escribir({
                filas: [
                    `${'PZA-1'.padEnd(15)}\t 1    \t ${'MAT-CORTADO'.padEnd(14)}\t DESCRIPCION QUE SIGUE`,
                    `RESTO\t KG   \t   0,00015000\tCOS       \tPRDCOS         \t`,
                ],
                articulos: ['PZA-1'],
            });
            const r = correr('PZA-1');
            expect(r.ok).toBe(false);
            expect(fs.existsSync(r.salida)).toBe(false);
        });

        it('8. VERDE: el caso sano pasa todos los gates y los enumera', () => {
            escribir({ filas: [fila('PZA-1', 'MAT-A', 'MATERIAL', 'UN', '1,00000000')], articulos: ['PZA-1'] });
            const r = correr('PZA-1');
            expect(r.ok).toBe(true);
            expect(r.stdout).toMatch(/gates OK/);
            expect(fs.existsSync(r.salida)).toBe(true);
        });

        it('9. cuando aborta no queda ni el archivo final ni el .parcial', () => {
            escribir({ filas: [fila('PZA-VIEJA', 'MAT-A', 'X', 'UN', '1,00000000')], articulos: [] });
            const r = correr('PZA-VIEJA');
            expect(r.ok).toBe(false);
            expect(fs.existsSync(r.salida)).toBe(false);
            expect(fs.existsSync(`${r.salida}.parcial`)).toBe(false);
        });
    });

    describe('columnas pisadas o pegadas — gate 5, el PDF releido renglon por renglon', () => {
        // El Rubro se corre a la derecha cuando el codigo con la sangria del sub-ensamble no
        // entra en su columna (06/10/2026). Corrido, puede llegar a la Medida: ahi el lector
        // del PDF —y una persona— lee `12MAT-N3`, un codigo que no existe. Hasta ese dia el
        // gate 5 buscaba la medida en el texto de la pagina y `MAT-N3` "estaba".
        const RAIZ_14 = 'PZA-CATORCE-14';
        const RAIZ_15 = 'PZA-QUINCE-0015';

        it('13. VERDE: con un codigo de 14 en un sub-ensamble el Rubro se corre y se lee solo', () => {
            expect(RAIZ_14).toHaveLength(14);
            escribir({
                filas: [
                    fila(RAIZ_14, 'SUB-1', 'SUBENSAMBLE', 'UN', '1,00000000'),
                    filaNivel(1, 'SUB-1', 'MAT-N1', 'MATERIAL DEL SUBENSAMBLE', 'MT2', '0,25000000'),
                ],
                articulos: [RAIZ_14],
            });
            const r = correr(RAIZ_14);
            expect(r.stderr ?? '').toBe('');
            expect(r.ok).toBe(true);
            const [pag] = renglonesPdf(r.salida);
            expect(pag).toContain(`. ${RAIZ_14} 1 MAT-N1 MATERIAL DEL SUBENSAMBLE MT2 0.25 TAP PRDTAP`);
            // Y mirado por las cajas, no por el texto: sin el corrimiento el `1` queda ARRIBA
            // del codigo, el lector igual devuelve las dos palabras sanas y el renglon de
            // arriba se lee identico. Este es el control que no depende del gate.
            expect(montadas(r.salida)).toEqual([]);
        });

        it('14. ROJO: un Rubro de 2 digitos que PISA la Medida aborta y no deja archivo', () => {
            expect(RAIZ_15).toHaveLength(15);
            escribir({
                filas: [
                    fila(RAIZ_15, 'SUB-1', 'SUBENSAMBLE', 'UN', '1,00000000'),
                    filaNivel(3, 'SUB-3', 'MAT-N3', 'MATERIAL DE NIVEL 3', 'UN', '2,00000000', '12'),
                ],
                articulos: [RAIZ_15],
            });
            const r = correr(RAIZ_15);
            expect(r.ok).toBe(false);
            expect(r.stderr).toMatch(/pisadas o pegadas/);
            expect(r.stderr).toContain('12MAT-N3');            // lo que se lee, y por eso frena
            expect(fs.existsSync(r.salida)).toBe(false);
            expect(fs.existsSync(`${r.salida}.parcial`)).toBe(false);
        });

        it('14b. ROJO: un Rubro que queda PEGADO a la Medida (sin pisarla) tambien aborta', () => {
            // Con un digito no llega a pisarla: queda a 0,8 pt, menos que un espacio. En la
            // hoja se lee igual que la pisada, un codigo con un 1 adelante.
            escribir({
                filas: [
                    fila(RAIZ_15, 'SUB-1', 'SUBENSAMBLE', 'UN', '1,00000000'),
                    filaNivel(3, 'SUB-3', 'MAT-N3', 'MATERIAL DE NIVEL 3', 'UN', '2,00000000', '1'),
                ],
                articulos: [RAIZ_15],
            });
            const r = correr(RAIZ_15);
            expect(r.ok).toBe(false);
            expect(r.stderr).toContain('1MAT-N3');
            expect(fs.existsSync(r.salida)).toBe(false);
        });

        it('14c. ROJO: pisada de mas (Rubro de 3 digitos) se lee como palabras sanas, y aborta igual', () => {
            // El lector junta en una palabra lo que se pisa hasta unos 7 pt. Con 10 pt devuelve
            // `123` y `MAT-N3` por separado, y comparar palabras da verde: es como pasaba el
            // incidente del 06/10. Lo ve el control de las cajas de las letras.
            escribir({
                filas: [
                    fila(RAIZ_15, 'SUB-1', 'SUBENSAMBLE', 'UN', '1,00000000'),
                    filaNivel(3, 'SUB-3', 'MAT-N3', 'MATERIAL DE NIVEL 3', 'UN', '2,00000000', '123'),
                ],
                articulos: [RAIZ_15],
            });
            const r = correr(RAIZ_15);
            expect(r.ok).toBe(false);
            expect(r.stderr).toMatch(/pisadas o pegadas/);
            expect(r.stderr).toMatch(/la letra '2' .* pisa a la 'M'/);
            expect(r.stderr).not.toContain('se lee');          // por palabras no habia nada que ver
            expect(fs.existsSync(r.salida)).toBe(false);
            expect(fs.existsSync(`${r.salida}.parcial`)).toBe(false);
        });

        it('14d. ROJO: el renglon malo en la SEGUNDA pagina tambien aborta (100% de las hojas)', () => {
            // El 04/08/2026 se revisaron 2 paginas de 5 y las 2 eran las buenas.
            escribir({
                filas: [
                    fila('PZA-1', 'MAT-A', 'MATERIAL', 'UN', '1,00000000'),
                    fila(RAIZ_15, 'SUB-1', 'SUBENSAMBLE', 'UN', '1,00000000'),
                    filaNivel(3, 'SUB-3', 'MAT-N3', 'MATERIAL DE NIVEL 3', 'UN', '2,00000000', '12'),
                ],
                articulos: ['PZA-1', RAIZ_15],
            });
            const r = correr(`PZA-1,${RAIZ_15}`);
            expect(r.ok).toBe(false);
            expect(r.stderr).toMatch(/pag 2 \(PZA-QUINCE-0015\) renglon 2/);
            expect(r.stderr).not.toMatch(/pag 1 /);
            expect(fs.existsSync(r.salida)).toBe(false);
        });

        it('15. VERDE: la raya larga del export (byte 0x97) se dibuja y no frena el PDF', () => {
            // El export es cp1252 leido como latin-1. Es la unica fila real que el gate frenaba
            // de mas, sobre las 1.408 BOM del 06/10/2026: un control que frena una BOM sana
            // se termina salteando.
            escribir({
                filas: [fila('PZA-1', 'MAT-A', 'BRANCO \x97 LARGURA', 'MT2', '0,00622220')],
                articulos: ['PZA-1'],
            });
            const r = correr('PZA-1');
            expect(r.stderr ?? '').toBe('');
            expect(r.ok).toBe(true);
            expect(renglonesPdf(r.salida)[0]).toContain('PZA-1 1 MAT-A BRANCO — LARGURA MT2 0.0062222 TAP PRDTAP');
        });
    });

    describe('formato de numeros', () => {
        const evaluar = (expr) => execFileSync('python', ['-c',
            `import importlib.util as u;s=u.spec_from_file_location("m",r"${SCRIPT}");m=u.module_from_spec(s);s.loader.exec_module(m);print(repr(${expr}))`,
        ], { encoding: 'utf8' }).trim();

        it('10. consumo_fmt saca ceros de cola sin redondear', () => {
            expect(evaluar('m.consumo_fmt("1,00000000")')).toBe("'1'");
            expect(evaluar('m.consumo_fmt("0,41066660")')).toBe("'0.4106666'");
        });

        it('11. consumo_fmt entiende el separador de miles', () => {
            expect(evaluar('m.consumo_fmt("1.234,50000000")')).toBe("'1234.5'");
        });

        it('12. es_consumo exige coma decimal: un entero pelado NO es un consumo', () => {
            expect(evaluar('m.es_consumo("0,00015000")')).toBe('True');
            expect(evaluar('m.es_consumo("4034")')).toBe('False');
            expect(evaluar('m.es_consumo("1")')).toBe('False');
        });
    });
});
