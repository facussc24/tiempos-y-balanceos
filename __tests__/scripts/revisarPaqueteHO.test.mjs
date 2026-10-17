/**
 * Tests de `scripts/_revisarPaqueteHO.py` - el revisor automatico del paquete de hojas de proceso.
 *
 * POR QUE EXISTEN: el 07/10/2026 Fak encontro a ojo, varias veces, los mismos errores en el paquete
 * que se iba a imprimir (portada metida, hojas sin numero de HO, operacion en "-", logo viejo, hoja
 * chica, hojas cortadas abajo, otro plan de reaccion, TBD y PRELIMINAR). Este revisor los busca antes.
 *
 * EN LAS DOS DIRECCIONES, CON PAGINAS REALES: un control que no puede dar rojo esta tan roto como el
 * que no puede dar verde. Cada defecto se prueba en una pagina del paquete que lo tiene (rojo o
 * aviso) y en una que no (verde). Las paginas salen de los PDF reales de exports/IMPRESION_0710_*
 * (solo se LEEN: las paginas se copian a un PDF chico en la carpeta temporal). Los errores que en esos
 * PDF no tienen ejemplo (coma decimal, HO-TBD, columna de acciones, palabras sueltas) se arman sobre
 * una COPIA de una pagina buena, tambien en la carpeta temporal.
 *
 * Si los PDF de ejemplo no estan (otra PC), los tests de paginas reales se saltean con un aviso.
 *
 * Correr:  npx vitest run __tests__/scripts/revisarPaqueteHO.test.mjs --pool=threads
 * (tarda ~2 minutos: arma los PDF chicos y corre el revisor sobre cada uno)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(fileURLToPath(import.meta.url), '../../..');
/** REVISAR_PAQUETE_SCRIPT apunta la suite a una copia MUTADA del script (umbrales rotos a proposito):
 *  los tests tienen que fallar. Un test que sigue verde con el bug puesto no protege nada. */
const SCRIPT = process.env.REVISAR_PAQUETE_SCRIPT ?? path.join(RAIZ, 'scripts', '_revisarPaqueteHO.py');

/** Los PDF de ejemplo viven en exports/, que no se versiona: un worktree no lo tiene y la suite se
 *  salteaba entera en silencio (un verde vacio). Orden: REVISAR_PAQUETE_EXPORTS, el exports/ de este
 *  checkout, y el del checkout principal (la carpeta padre del .git comun). */
function carpetaExports() {
    const cands = [process.env.REVISAR_PAQUETE_EXPORTS, path.join(RAIZ, 'exports')];
    try {
        const comun = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'],
            { cwd: RAIZ, encoding: 'utf8' }).trim();
        cands.push(path.join(path.dirname(comun), 'exports'));
    } catch { /* sin git: quedan las otras */ }
    return cands.find((c) => c && fs.existsSync(path.join(c, 'IMPRESION_0710_FINAL'))) ?? path.join(RAIZ, 'exports');
}
const EX = carpetaExports();
const FUENTES = {
    dep: path.join(EX, 'IMPRESION_0710_FINAL', '3_HOJAS_DE_PROCESO_A4_depurado.pdf'), // con muchos errores
    a3: path.join(EX, 'IMPRESION_0710_FINAL', '4_HOJAS_DE_PROCESO_A3.pdf'),          // con logo viejo
    v6: path.join(EX, 'IMPRESION_0710_V3', '3_HOJAS_DE_PROCESO_A4_v6.pdf'),          // corregido, A4
    a3v6: path.join(EX, 'IMPRESION_0710_V3', '4_HOJAS_DE_PROCESO_A3_v6.pdf'),        // corregido, A3
};
const FALTAN = Object.values(FUENTES).filter((p) => !fs.existsSync(p));
const HAY_PDFS = FALTAN.length === 0;
if (!HAY_PDFS) {
    console.warn('[revisarPaqueteHO] SE SALTEAN los tests con paginas reales: faltan los PDF de ejemplo de '
        + 'exports/IMPRESION_0710_* (otra PC). Faltan: ' + FALTAN.map((p) => path.basename(p)).join(', '));
}

/** Armado de los PDF chicos. Cada caso: [fuente, pagina (1 = primera), ediciones opcionales]. */
const E = (src, pag, ...ediciones) => ({ src, pag, ediciones });
const MANIFIESTO = {
    // todas las paginas de un solo defecto, una tras otra: se mira cada una por su nombre
    casos: {
        dep9: E('dep', 9), dep38: E('dep', 38), dep41: E('dep', 41), dep47: E('dep', 47), dep48: E('dep', 48),
        dep50: E('dep', 50), dep51: E('dep', 51), dep56: E('dep', 56), dep61: E('dep', 61), dep62: E('dep', 62),
        dep67: E('dep', 67), dep68: E('dep', 68), dep71: E('dep', 71), dep76: E('dep', 76), dep157: E('dep', 157),
        dep158: E('dep', 158), a3_9: E('a3', 9), a3_11: E('a3', 11),
        v6_1: E('v6', 1), v6_11: E('v6', 11), v6_12: E('v6', 12), v6_47: E('v6', 47), v6_62: E('v6', 62),
        v6_72: E('v6', 72),
        // copias editadas de paginas buenas (en la carpeta temporal)
        v6_2_hotbd: E('v6', 2, { ho: 'HO-TBD' }),
        v6_3_hon: E('v6', 3, { ho: 'HO N°' }),
        v6_7_opcoma: E('v6', 7, { operacion: '40,1' }),
        v6_8_optbd: E('v6', 8, { operacion: 'TBD' }),
        v6_4_fotos: E('v6', 4, { texto: 'FOTOS PENDIENTES' }),
        v6_5_varias: E('v6', 5, { texto: 'EN DESARROLLO  Por completar  BORRADOR  PENDIENTE' }),
        v6_6_pendctl: E('v6', 6, { texto: 'PENDIENTE DE CONTROL' }),
        v6_2_acciones: E('v6', 2, { plan_acciones: true }),
    },
    buenas_a4: { p1: E('v6', 1), p2: E('v6', 2), p3: E('v6', 3), p62: E('v6', 62), p63: E('v6', 63) },
    // Hasta el 16/10/2026 eran las paginas 1 a 4 del A3 v6 (hot melt del 07/10). Con la regla del 13/10
    // (0.8 b bis: la pieza rara va con su aclaracion entre parentesis) esas hojas dicen "volante cromado",
    // "fusor" y "guiador" sin aclarar: ya no son verdes, y lo prueba el bloque de la tanda 1.5. Las A3
    // buenas pasan a ser las paginas del hot melt regenerado el 13/10 que si cumplen y las de grampas
    // aprobadas por Fak ese dia (bloque de la tanda 1.5).
    buenas_a3: { p3: E('a3v6', 3) },
    solo_avisos: { epp: E('v6', 72) },
    tamano_mezcla: { a4_1: E('v6', 1), a4_2: E('v6', 2), vertical: E('v6', 49), a3: E('a3v6', 1) },
    tamano_parejo: { a4_1: E('v6', 1), a4_2: E('v6', 2) },
    tamano_chica: { a4_1: E('v6', 1), a4_2: E('v6', 2), chica: E('dep', 38) },
    repetida: { p968: E('v6', 72), p969: E('v6', 85), p970: E('v6', 98), otra: E('v6', 73) },
};

/** Python que arma los PDF chicos (lee el manifiesto por argv, escribe y devuelve {pdf: {nombre: pagina}}). */
const PY_ARMAR = String.raw`
import sys, json, os, fitz

spec = json.loads(sys.argv[1])
fuentes = {k: fitz.open(v) for k, v in spec['fuentes'].items()}


def unir(ws):
    r = fitz.Rect(ws[0][:4])
    for w in ws[1:]:
        r |= fitz.Rect(w[:4])
    return r


def reemplazar(pg, rect, texto, size):
    pg.add_redact_annot(rect, fill=(1, 1, 1))
    try:
        pg.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE)
    except TypeError:
        pg.apply_redactions()
    size = min(size, rect.height)
    pg.insert_text((rect.x0, rect.y1 - 1), texto, fontsize=size, fontname='hebo')


def editar(pg, ed):
    W, H = pg.rect.width, pg.rect.height
    words = pg.get_text('words')
    if 'ho' in ed:
        ho = [w for w in words if w[4].upper().startswith('HO') and not w[4].upper().startswith('HOJA')
              and w[0] > 0.5 * W and w[1] < 0.17 * H]
        assert ho, 'no encontre el casillero HO'
        a = min(ho, key=lambda w: w[1])
        linea = [w for w in words if abs(w[1] - a[1]) < 6 and w[0] >= a[0] - 1 and w[0] > 0.5 * W]
        reemplazar(pg, unir(linea), ed['ho'], 14)
    if 'operacion' in ed:
        # la etiqueta (no el titulo "HOJA DE OPERACIONES"): la que queda en la fila del cajetin
        lab = [x for x in pg.search_for('DE OPERACI') if x.y0 > 0.1 * H and x.height < 12]
        assert lab, 'no encontre la etiqueta de operacion'
        r = lab[0]
        celda = [w for w in words if r.y1 - 1 < w[1] < r.y1 + 22 and r.x0 - 20 <= (w[0] + w[2]) / 2 <= r.x1 + 20]
        assert celda, 'no encontre el valor de la operacion'
        reemplazar(pg, unir(celda), ed['operacion'], 9)
    if 'texto' in ed:
        pg.insert_text((30, 9), ed['texto'], fontsize=6, fontname='helv')
    if ed.get('plan_acciones'):
        r = pg.search_for('NOTIFIQUE DE INMEDIATO')[0]
        # a la derecha de los renglones del plan (como la columna de acciones de las hojas de la prensa)
        pg.insert_text((r.x1 + 140, r.y0 - 16), '1. Apartar la pieza no conforme.', fontsize=8, fontname='helv')
        pg.insert_text((r.x1 + 140, r.y0 - 2), '2. Dar aviso al Lider de Produccion.', fontsize=8, fontname='helv')


salida = {}
for nombre, casos in spec['pdfs'].items():
    dst = fitz.open()
    paginas = {}
    for etiqueta, c in casos.items():
        dst.insert_pdf(fuentes[c['src']], from_page=c['pag'] - 1, to_page=c['pag'] - 1)
        pg = dst[len(dst) - 1]
        for ed in c['ediciones']:
            editar(pg, ed)
        paginas[etiqueta] = len(dst)
    dst.save(os.path.join(spec['dir'], nombre + '.pdf'), garbage=1, deflate=True)
    salida[nombre] = paginas
print(json.dumps(salida))
`;

let TMP = null;
let PAGINAS = {};      // pdf -> etiqueta -> numero de pagina
const CORRIDA = {};    // pdf -> { defectos, status, stdout }

function correr(pdf, extra = []) {
    const r = spawnSync('python', [SCRIPT, path.join(TMP, pdf + '.pdf'), ...extra], {
        encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** Defectos de la pagina con esa etiqueta, del PDF chico `pdf`. */
const defs = (pdf, etiqueta) => CORRIDA[pdf].defectos.filter((x) => x.pagina === PAGINAS[pdf][etiqueta]);
const tiene = (pdf, etiqueta, codigo, nivel) =>
    defs(pdf, etiqueta).some((x) => x.codigo === codigo && (!nivel || x.nivel === nivel));
const evidencia = (pdf, etiqueta, codigo) =>
    defs(pdf, etiqueta).filter((x) => x.codigo === codigo).map((x) => x.evidencia).join(' || ');
const cuales = (pdf, etiqueta) => defs(pdf, etiqueta).map((x) => x.nivel + ' ' + x.codigo + ': ' + x.evidencia).join('\n');

describe('0. el entorno (nunca se saltea: un test salteado es un verde vacio)', () => {
    it('python, PyMuPDF, Pillow y numpy estan disponibles', () => {
        const v = execFileSync('python', ['-c', 'import fitz, PIL, numpy; print("ok")'], { encoding: 'utf8' });
        expect(v.trim()).toBe('ok');
    });
    it('el script existe y muestra su ayuda', () => {
        const v = execFileSync('python', [SCRIPT, '--help'], { encoding: 'utf8' });
        expect(v).toContain('--paginas');
        expect(v).toContain('--json');
    });
    it('un archivo que no abre sale con codigo 2 y lo dice (no da verde)', () => {
        const r = spawnSync('python', [SCRIPT, path.join(os.tmpdir(), 'no-existe-revpaq.pdf')], { encoding: 'utf8' });
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('NO SE PUDO ABRIR');
    });
});

describe.skipIf(!HAY_PDFS)('con paginas reales del paquete del 07/10/2026', () => {
    beforeAll(() => {
        TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'revpaq-'));
        const spec = {
            dir: TMP,
            fuentes: FUENTES,
            pdfs: Object.fromEntries(Object.entries(MANIFIESTO).map(([pdf, casos]) => [
                pdf,
                Object.fromEntries(Object.entries(casos).map(([k, c]) => [k, { src: c.src, pag: c.pag, ediciones: c.ediciones }])),
            ])),
        };
        PAGINAS = JSON.parse(execFileSync('python', ['-c', PY_ARMAR, JSON.stringify(spec)],
            { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
        for (const pdf of Object.keys(MANIFIESTO)) {
            const r = correr(pdf, ['--json']);
            CORRIDA[pdf] = { ...r, defectos: JSON.parse(r.stdout).defectos };
        }
    }, 600000);

    afterAll(() => {
        if (TMP) fs.rmSync(TMP, { recursive: true, force: true });
    });

    // ---------------------------------------------------------------------------------
    it('1. PORTADA: la portada de embossing frena; una hoja de operacion y un camino de inspeccion no', () => {
        expect(tiene('casos', 'dep67', 'PORTADA', 'ROJO'), cuales('casos', 'dep67')).toBe(true);
        expect(evidencia('casos', 'dep67', 'PORTADA')).toContain('HOJAS DE PROCESO');
        expect(tiene('casos', 'v6_1', 'PORTADA')).toBe(false);
        expect(tiene('casos', 'a3_11', 'PORTADA'), 'el camino de inspeccion es un anexo, no una portada').toBe(false);
        // y una portada no se juzga como hoja: no le pide HO ni operacion ni plan
        for (const c of ['SIN_HO', 'SIN_OP', 'PLAN_NO_ESTANDAR']) expect(tiene('casos', 'dep67', c)).toBe(false);
    });

    it('2. SIN_HO: "HO", "HO-", "HO-TBD" y "HO N°" frenan; "HO - 971", "HO-985" y "HO N° 968" pasan', () => {
        const rojas = ['dep47', 'dep50', 'dep51', 'v6_2_hotbd', 'v6_3_hon'];
        for (const e of rojas) expect(tiene('casos', e, 'SIN_HO', 'ROJO'), e + '\n' + cuales('casos', e)).toBe(true);
        expect(evidencia('casos', 'dep47', 'SIN_HO')).toContain('"HO"');
        expect(evidencia('casos', 'v6_2_hotbd', 'SIN_HO')).toContain('HO-TBD');
        for (const e of ['v6_1', 'v6_11', 'v6_72', 'v6_62']) {
            expect(tiene('casos', e, 'SIN_HO'), e + ' (HO escrito con espacios, guion o N°)\n' + cuales('casos', e)).toBe(false);
        }
    });

    it('3. SIN_OP: "-", "TBD" y coma decimal frenan; "20", "20.1" y la hoja de embalaje sin casillero pasan', () => {
        for (const e of ['dep48', 'v6_7_opcoma', 'v6_8_optbd']) {
            expect(tiene('casos', e, 'SIN_OP', 'ROJO'), e + '\n' + cuales('casos', e)).toBe(true);
        }
        expect(evidencia('casos', 'dep48', 'SIN_OP')).toContain('"-"');
        expect(evidencia('casos', 'v6_7_opcoma', 'SIN_OP')).toContain('40,1');
        expect(evidencia('casos', 'v6_7_opcoma', 'SIN_OP')).toContain('40.1');
        for (const e of ['v6_1', 'v6_12', 'v6_47']) {
            expect(tiene('casos', e, 'SIN_OP'), e + '\n' + cuales('casos', e)).toBe(false);
        }
    });

    it('4. PALABRA_PROHIBIDA: TBD, PRELIMINAR, xxx, x cantidad, FOTOS PENDIENTES, EN DESARROLLO, Por completar, BORRADOR y PENDIENTE frenan; PENDIENTE DE CONTROL no', () => {
        expect(evidencia('casos', 'dep76', 'PALABRA_PROHIBIDA')).toContain('PRELIMINAR');
        expect(evidencia('casos', 'dep62', 'PALABRA_PROHIBIDA')).toContain('TBD');
        const p61 = evidencia('casos', 'dep61', 'PALABRA_PROHIBIDA');
        expect(p61).toContain('xxx');
        expect(p61).toContain('x CANTIDAD');
        expect(tiene('casos', 'dep76', 'PALABRA_PROHIBIDA', 'ROJO')).toBe(true);
        expect(evidencia('casos', 'v6_4_fotos', 'PALABRA_PROHIBIDA')).toContain('FOTOS PENDIENTES');
        const varias = evidencia('casos', 'v6_5_varias', 'PALABRA_PROHIBIDA');
        for (const w of ['EN DESARROLLO', 'POR COMPLETAR', 'BORRADOR', 'PENDIENTE']) expect(varias).toContain(w);
        // "FOTOS PENDIENTES" es una sola palabra prohibida, no dos
        expect(evidencia('casos', 'v6_4_fotos', 'PALABRA_PROHIBIDA')).not.toMatch(/\|\| PENDIENTE/);
        // verde: texto normal de flujograma, y una hoja limpia
        expect(tiene('casos', 'v6_6_pendctl', 'PALABRA_PROHIBIDA'), cuales('casos', 'v6_6_pendctl')).toBe(false);
        expect(tiene('casos', 'v6_1', 'PALABRA_PROHIBIDA')).toBe(false);
    });

    it('5. LOGO_VIEJO: el logo violeta frena (A4 y A3); las cuatro variantes del oficial pasan', () => {
        for (const e of ['a3_9', 'a3_11', 'dep48', 'dep50', 'dep51']) {
            expect(tiene('casos', e, 'LOGO_VIEJO', 'ROJO'), e + '\n' + cuales('casos', e)).toBe(true);
        }
        expect(evidencia('casos', 'dep50', 'LOGO_VIEJO')).toContain('similitud');
        // el oficial en sus tamanos y recompresiones: nitido (v6_1, v6_11), estirado (dep157, dep158), pixelado (dep38, dep47)
        for (const e of ['v6_1', 'v6_11', 'v6_12', 'v6_47', 'dep157', 'dep158', 'dep38', 'dep47', 'dep62']) {
            expect(tiene('casos', e, 'LOGO_VIEJO'), e + '\n' + cuales('casos', e)).toBe(false);
        }
        expect(tiene('buenas_a3', 'p1', 'LOGO_VIEJO')).toBe(false);
    });

    it('6. HOJA_CHICA: la de 504 x 356 pt frena, la de Excel con margen ancho avisa, las normales pasan', () => {
        expect(tiene('casos', 'dep38', 'HOJA_CHICA', 'ROJO'), cuales('casos', 'dep38')).toBe(true);
        expect(evidencia('casos', 'dep38', 'HOJA_CHICA')).toMatch(/59 % del ancho/);
        expect(tiene('casos', 'dep41', 'HOJA_CHICA', 'AVISO'), cuales('casos', 'dep41')).toBe(true);
        expect(tiene('casos', 'dep41', 'HOJA_CHICA', 'ROJO')).toBe(false);
        for (const e of ['v6_1', 'v6_11', 'dep157', 'dep158', 'dep62']) expect(tiene('casos', e, 'HOJA_CHICA')).toBe(false);
    });

    it('7. CORTADA: sin borde de abajo (158) y tinta pegada al borde derecho (51) frenan; la hoja entera y el embalaje no', () => {
        expect(tiene('casos', 'dep158', 'CORTADA', 'ROJO'), cuales('casos', 'dep158')).toBe(true);
        expect(evidencia('casos', 'dep158', 'CORTADA')).toContain('borde inferior');
        expect(tiene('casos', 'dep51', 'CORTADA', 'ROJO'), cuales('casos', 'dep51')).toBe(true);
        expect(evidencia('casos', 'dep51', 'CORTADA')).toContain('derecho');
        for (const e of ['dep157', 'v6_1', 'v6_11', 'v6_47', 'dep62', 'dep71']) {
            expect(tiene('casos', e, 'CORTADA'), e + '\n' + cuales('casos', e)).toBe(false);
        }
    });

    it('8. PLAN_NO_ESTANDAR: disparador propio, plan con blanco a la derecha y columna de acciones frenan; SI DETECTA distinto avisa; el estandar pasa', () => {
        expect(tiene('casos', 'dep68', 'PLAN_NO_ESTANDAR', 'ROJO'), cuales('casos', 'dep68')).toBe(true);
        expect(evidencia('casos', 'dep68', 'PLAN_NO_ESTANDAR')).toContain('SI LA PRENSA NO ENCIENDE');
        // el de Gemini con el texto estandar pero el plan angosto: el blanco de la derecha lo frena solo
        expect(tiene('casos', 'dep71', 'PLAN_NO_ESTANDAR', 'ROJO'), cuales('casos', 'dep71')).toBe(true);
        expect(evidencia('casos', 'dep71', 'PLAN_NO_ESTANDAR')).toContain('en blanco');
        expect(evidencia('casos', 'dep71', 'PLAN_NO_ESTANDAR')).not.toContain('disparador propio');
        // la columna de acciones al costado
        expect(tiene('casos', 'v6_2_acciones', 'PLAN_NO_ESTANDAR', 'ROJO'), cuales('casos', 'v6_2_acciones')).toBe(true);
        expect(evidencia('casos', 'v6_2_acciones', 'PLAN_NO_ESTANDAR')).toContain('columna de acciones');
        // una pagina sin banda de plan
        expect(tiene('casos', 'dep51', 'PLAN_NO_ESTANDAR', 'ROJO')).toBe(true);
        // "SI DETECTA 3 PIEZAS NO CONFORMES..." es AVISO, no ROJO
        expect(tiene('casos', 'dep9', 'PLAN_NO_ESTANDAR', 'AVISO'), cuales('casos', 'dep9')).toBe(true);
        expect(tiene('casos', 'dep9', 'PLAN_NO_ESTANDAR', 'ROJO')).toBe(false);
        expect(tiene('casos', 'v6_11', 'PLAN_NO_ESTANDAR', 'AVISO')).toBe(true);
        // verde: el plan de las HO de Excel, el del generador nuevo y la hoja de embalaje
        for (const e of ['v6_1', 'dep157', 'dep62', 'v6_62', 'v6_47', 'v6_72']) {
            expect(tiene('casos', e, 'PLAN_NO_ESTANDAR'), e + '\n' + cuales('casos', e)).toBe(false);
        }
    });

    it('9. TAMANO_MEZCLADO: una vertical, una A3 y una de tamano propio entre A4 apaisadas avisan; todas iguales no', () => {
        expect(tiene('tamano_mezcla', 'vertical', 'TAMANO_MEZCLADO', 'AVISO'), cuales('tamano_mezcla', 'vertical')).toBe(true);
        expect(evidencia('tamano_mezcla', 'vertical', 'TAMANO_MEZCLADO')).toContain('vertical');
        expect(tiene('tamano_mezcla', 'a3', 'TAMANO_MEZCLADO', 'AVISO')).toBe(true);
        expect(evidencia('tamano_mezcla', 'a3', 'TAMANO_MEZCLADO')).toContain('A3');
        expect(tiene('tamano_chica', 'chica', 'TAMANO_MEZCLADO', 'AVISO')).toBe(true);
        expect(evidencia('tamano_chica', 'chica', 'TAMANO_MEZCLADO')).toContain('otro tamano');
        for (const e of ['a4_1', 'a4_2']) {
            expect(tiene('tamano_mezcla', e, 'TAMANO_MEZCLADO')).toBe(false);
            expect(tiene('tamano_parejo', e, 'TAMANO_MEZCLADO')).toBe(false);
        }
        expect(CORRIDA.tamano_parejo.defectos.filter((x) => x.codigo === 'TAMANO_MEZCLADO')).toHaveLength(0);
    });

    it('10. CAPTURA_PEGADA: la descripcion hecha con una captura avisa; la de texto no', () => {
        expect(tiene('casos', 'dep56', 'CAPTURA_PEGADA', 'AVISO'), cuales('casos', 'dep56')).toBe(true);
        expect(evidencia('casos', 'dep56', 'CAPTURA_PEGADA')).toContain('0 caracteres');
        for (const e of ['v6_1', 'dep62', 'dep157', 'v6_11', 'v6_72']) expect(tiene('casos', e, 'CAPTURA_PEGADA'), e).toBe(false);
    });

    it('11. REPETIDA: la misma hoja generica en 968, 969 y 970 avisa en las tres; una hoja distinta no', () => {
        for (const e of ['p968', 'p969', 'p970']) {
            expect(tiene('repetida', e, 'REPETIDA', 'AVISO'), e + '\n' + cuales('repetida', e)).toBe(true);
        }
        expect(evidencia('repetida', 'p968', 'REPETIDA')).toContain('3 productos');
        expect(evidencia('repetida', 'p968', 'REPETIDA')).toContain('imprimir una sola');
        expect(tiene('repetida', 'otra', 'REPETIDA'), cuales('repetida', 'otra')).toBe(false);
        // y en el paquete sin repetidas no aparece
        expect(CORRIDA.buenas_a4.defectos.filter((x) => x.codigo === 'REPETIDA')).toHaveLength(0);
    });

    it('12. EPP_VACIO: el recuadro sin iconos avisa; con iconos (sueltos o en tira, centrados o abiertos) no', () => {
        expect(tiene('casos', 'v6_72', 'EPP_VACIO', 'AVISO'), cuales('casos', 'v6_72')).toBe(true);
        for (const e of ['v6_1', 'v6_47', 'v6_62', 'dep157', 'dep62', 'v6_11']) {
            expect(tiene('casos', e, 'EPP_VACIO'), e + '\n' + cuales('casos', e)).toBe(false);
        }
    });

    // ---------------------------------------------------------------------------------
    it('VERDE: un paquete de hojas buenas (A4 y A3) no da ningun ROJO y sale con codigo 0; el unico aviso de las A4 de Excel es el ciclo lleno', () => {
        // A3: ni un defecto ni un aviso
        expect(CORRIDA.buenas_a3.defectos, CORRIDA.buenas_a3.defectos.map((x) => x.pagina + ' ' + x.codigo + ' ' + x.evidencia).join('\n')).toHaveLength(0);
        expect(CORRIDA.buenas_a3.status).toBe(0);
        // A4 de Excel: el ciclo de control lleno es AVISO (si se vacia es una pregunta abierta a Fak, informe A7)
        // y es lo unico que puede aparecer
        const otros = CORRIDA.buenas_a4.defectos.filter((x) => x.codigo !== 'CICLO_LLENO' || x.nivel !== 'AVISO');
        expect(otros, otros.map((x) => x.pagina + ' ' + x.nivel + ' ' + x.codigo + ' ' + x.evidencia).join('\n')).toHaveLength(0);
        expect(CORRIDA.buenas_a4.status).toBe(0);
    });

    it('CODIGO DE SALIDA: ROJO sale 1; solo avisos sale 0; --solo-rojo oculta los avisos', () => {
        expect(CORRIDA.casos.status).toBe(1);
        expect(CORRIDA.solo_avisos.defectos.length).toBeGreaterThan(0);
        expect(CORRIDA.solo_avisos.defectos.every((x) => x.nivel === 'AVISO')).toBe(true);
        expect(CORRIDA.solo_avisos.status).toBe(0);
        const r = correr('solo_avisos', ['--json', '--solo-rojo']);
        expect(JSON.parse(r.stdout).defectos).toHaveLength(0);
        expect(r.status).toBe(0);
    });

    it('SALIDA: cada hallazgo trae pagina, HO, operacion y evidencia; el texto legible los muestra', () => {
        const x = defs('casos', 'dep48').find((d) => d.codigo === 'SIN_OP');
        expect(x.ho).toMatch(/HO-990/);
        expect(x.operacion).toBe('-');
        expect(x.evidencia.length).toBeGreaterThan(5);
        const r = correr('casos', ['--paginas', String(PAGINAS.casos.dep48)]);
        expect(r.stdout).toContain('SIN_OP');
        expect(r.stdout).toContain('RESUMEN:');
        expect(r.stdout).toMatch(/p\.\d+\s+\[HO-990 \| op -\]/);
    });

    it('--paginas revisa solo las paginas pedidas', () => {
        const n = PAGINAS.casos.dep47;
        const r = correr('casos', ['--json', '--paginas', String(n)]);
        const j = JSON.parse(r.stdout);
        expect(j.defectos.length).toBeGreaterThan(0);
        expect(new Set(j.defectos.map((d) => d.pagina))).toEqual(new Set([n]));
        expect(j.defectos.some((d) => d.codigo === 'SIN_HO')).toBe(true);
    });
});

// =====================================================================================
// Tanda 1.5 del plan del sistema (16/10/2026): los chequeos de CONTENIDO, cada uno con una hoja real
// en ROJO y una en VERDE. Las hojas son las de respuesta conocida del informe casa_hojas_y_maquinas.md
// (A1 a A7): la HO-990 Rev.A del servidor (en el PDF por pieza del 14/10), la 20.6 del hot melt del
// 01/10, la hoja de tapizado de Pablo sin y con la tira de herramientas, el camino de inspeccion de
// grampas del 01/10 con los "×3"; y en verde las de grampas aprobadas el 13/10, el hot melt regenerado
// ese dia y las de Pablo corregidas el 14/10. Las paginas se COPIAN a un PDF chico: nada se modifica.
// =====================================================================================
const F15 = {
    h990: path.join(EX, 'hojas-por-pieza-14-10', 'HO 990 - INSERT - HOJAS DE PROCESO (todas).pdf'),
    hm0110: path.join(EX, 'hojas-hotmelt-01-10', 'HO-992 - OP 20 ADHESIVADO HOT MELT - TOP ROLL.pdf'),
    hmreg: path.join(EX, 'hojas-hotmelt-13-10', 'regenerado', 'HO-992 - OP 20 ADHESIVADO HOT MELT - TOP ROLL.pdf'),
    gr992: path.join(EX, 'hojas-grampas-a3', 'HO-992 - OP 50 UBICACION DE LAS GRAMPAS - TOP ROLL.pdf'),
    gr971: path.join(EX, 'hojas-grampas-a3', 'HO-971 - OP 93 UBICACION DE LAS GRAMPAS - APB DE PUERTA.pdf'),
    gr990: path.join(EX, 'hojas-grampas-a3', 'HO-990 - OP 101 UBICACION DE LAS GRAMPAS - INSERT.pdf'),
    tapiz: path.join(EX, 'hojas-img-a3', 'HO-992 - OP 50 TAPIZADO Y ENGRAMPADO DE PANEL - TOP ROLL TRASERO.pdf'),
    tira: path.join(EX, 'hojas-img-a3', 'HO-992 - OP 50 TAPIZADO Y ENGRAMPADO DE PANEL - TOP ROLL TRASERO - con tira de herramientas.pdf'),
    camino: path.join(EX, 'hojas-grampas-patagonia-01-10', 'CAMINO DE INSPECCION DE GRAMPAS - TOP ROLL TRASERO - 34.pdf'),
    espuma: path.join(EX, 'hojas-gamboa-corregidas-14-10', 'HO-990 - OP 80 ARMADO DE ESPUMA - INSERTO DELANTERO.pdf'),
    engr0110: path.join(EX, 'hojas-grampas-patagonia-01-10', 'HO-971 - OP 83 ENGRAMPADO - APB DE PUERTA DELANTERO.pdf'),
    engr1410: path.join(EX, 'hojas-gamboa-corregidas-14-10', 'HO-971 - OP 93 ENGRAMPADO - APB DE PUERTA DELANTERO.pdf'),
    h971: path.join(EX, 'hojas-por-pieza-14-10', 'HO 971 - APB DE PUERTA - HOJAS DE PROCESO (todas).pdf'),
    amfe: path.join(EX, 'RECLAMO_AGUJAS_PWA_20261009', 'AMFE 157 - TELAS_HILUX - Rev.A.pdf'),
    v6: FUENTES.v6,
    a3v6: FUENTES.a3v6,
};
const FALTAN15 = Object.values(F15).filter((p) => !fs.existsSync(p));
if (FALTAN15.length) {
    console.warn('[revisarPaqueteHO] SE SALTEA el bloque de la tanda 1.5: faltan ' + FALTAN15.map((p) => path.basename(p)).join(', '));
}

/** La tabla de respuesta conocida: [etiqueta, fuente, pagina, codigo, nivel esperado (null = que NO aparezca)]. */
const CASOS15 = [
    // 1 CICLO_LLENO: ROJO en el A3 de una foto por paso. La hoja de engrampado de Pablo del 01/10 lo traia lleno y la
    // misma hoja corregida el 14/10 va vacia. En otro formato es AVISO (pregunta abierta a Fak, informe A7): la HO-990
    // Rev.A (Fak 14/10: "¿el ciclo de control se basa en el plan de control del Insert?") y la HO de Excel, A4 o A3.
    ['ciclo_rojo_engrampado_0110', 'engr0110', 1, 'CICLO_LLENO', 'ROJO'],
    ['ciclo_verde_engrampado_1410', 'engr1410', 1, 'CICLO_LLENO', null],
    ['ciclo_verde_espuma_corregida', 'espuma', 1, 'CICLO_LLENO', null],
    ['ciclo_verde_grampas', 'gr992', 1, 'CICLO_LLENO', null],
    ['ciclo_aviso_h990', 'h990', 1, 'CICLO_LLENO', 'AVISO'],
    ['ciclo_aviso_excel_a4', 'v6', 1, 'CICLO_LLENO', 'AVISO'],
    ['ciclo_aviso_excel_a3', 'h971', 2, 'CICLO_LLENO', 'AVISO'],
    // el mismo ciclo, letra por letra, en la op 50 y en la 60.2 del paquete del 07/10: texto de otra hoja
    ['ciclo_copiado_op50', 'v6', 22, 'CICLO_LLENO', 'AVISO'],
    ['ciclo_copiado_op60_2', 'v6', 25, 'CICLO_LLENO', 'AVISO'],
    // 60 y 60.2 son la misma operacion partida: comparten ciclo sin que sea de otra hoja
    ['ciclo_partida_op60', 'v6', 16, 'CICLO_LLENO', 'AVISO'],
    ['ciclo_partida_op60_2', 'v6', 18, 'CICLO_LLENO', 'AVISO'],
    // 2 PIEZA_SIN_ACLARAR: "Verificar que los acumuladores..." (20.6 del 01/10) contra "los acumuladores (los rodillos...)"
    ['pieza_rojo_20_6_0110', 'hm0110', 7, 'PIEZA_SIN_ACLARAR', 'ROJO'],
    ['pieza_verde_20_6_regenerada', 'hmreg', 6, 'PIEZA_SIN_ACLARAR', null],
    // 3 EPP_NO_DEL_SECTOR: anteojos en la HO-990 (Fak 14/10: "en ese sector no hace falta gafas")
    ['epp_rojo_h990', 'h990', 1, 'EPP_NO_DEL_SECTOR', 'ROJO'],
    ['epp_verde_grampas_990', 'gr990', 1, 'EPP_NO_DEL_SECTOR', null],
    // 4 HERRAMENTAL_SIN_MARCAR: la hoja de Pablo con "Herramental del puesto" contra la de la tira de herramientas
    ['herr_rojo_tapizado', 'tapiz', 1, 'HERRAMENTAL_SIN_MARCAR', 'ROJO'],
    ['herr_verde_tira', 'tira', 1, 'HERRAMENTAL_SIN_MARCAR', null],
    // 5 PLAN_DEL_PLAN_DE_CONTROL: "Segregar... P-13... P-14" pegado al costado del plan
    ['plan_pc_rojo_h990', 'h990', 1, 'PLAN_DEL_PLAN_DE_CONTROL', 'ROJO'],
    ['plan_pc_verde_grampas', 'gr992', 1, 'PLAN_DEL_PLAN_DE_CONTROL', null],
    // 6 TEXTO_TACHADO: "3. No reiniciar la produccion..." cruzado por el borde de abajo
    ['tachado_rojo_h990', 'h990', 1, 'TEXTO_TACHADO', 'ROJO'],
    ['tachado_verde_grampas', 'gr992', 1, 'TEXTO_TACHADO', null],
    ['tachado_verde_camino_numeros', 'a3v6', 11, 'TEXTO_TACHADO', null],   // numeros de grampa cruzados por el recorrido
    // 7 CANTIDAD_ILEGIBLE: "×3 + 4" del camino de Pablo contra "4 grampas (1 a 4)" de la hoja aprobada
    ['cantidad_rojo_camino', 'camino', 1, 'CANTIDAD_ILEGIBLE', 'ROJO'],
    ['cantidad_verde_grampas', 'gr992', 1, 'CANTIDAD_ILEGIBLE', null],
    ['cantidad_verde_medidas_embalaje', 'h990', 16, 'CANTIDAD_ILEGIBLE', null],   // "600 × 400 × 400 mm" es una medida
    // el CAMINO DE INSPECCION ya no esta eximido: avisa que no es una HO y se le corren los de contenido
    ['camino_anexo', 'camino', 1, 'CAMINO_ANEXO', 'AVISO'],
    // ARMADO_DISTINTO contra la ultima aprobada de ese tamano
    ['armado_rojo_h990', 'h990', 1, 'ARMADO_DISTINTO', 'ROJO'],
    ['armado_verde_grampas', 'gr971', 1, 'ARMADO_DISTINTO', null],
    ['armado_verde_excel_a4', 'v6', 1, 'ARMADO_DISTINTO', null],
    ['armado_verde_generador_a4', 'v6', 62, 'ARMADO_DISTINTO', null],
];
/** Hojas que tienen que salir sin un solo defecto ni aviso: las aprobadas por Fak el 13/10. */
const VERDES15 = [['gr992', 1], ['gr992', 2], ['gr971', 1], ['gr971', 2], ['gr990', 1], ['gr990', 2],
    ['hmreg', 3], ['hmreg', 5], ['hmreg', 6], ['hmreg', 8], ['espuma', 1]];

describe.skipIf(FALTAN15.length > 0)('tanda 1.5: los chequeos de contenido, cada uno con una hoja real en rojo y una en verde', () => {
    const DEF15 = {};      // etiqueta -> defectos de esa pagina
    let STATUS_VERDES = null;
    beforeAll(() => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'revpaq15-'));
        const casos = {};
        for (const [et, src, pag] of CASOS15) casos[et] = { src, pag, ediciones: [] };
        const verdes = {};
        VERDES15.forEach(([src, pag], i) => { verdes['v' + i] = { src, pag, ediciones: [] }; });
        const spec = { dir, fuentes: F15, pdfs: { casos15: casos, verdes15: verdes } };
        const pags = JSON.parse(execFileSync('python', ['-c', PY_ARMAR, JSON.stringify(spec)],
            { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
        for (const pdf of ['casos15', 'verdes15']) {
            const r = spawnSync('python', [SCRIPT, path.join(dir, pdf + '.pdf'), '--json'], {
                encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
            });
            const defs = JSON.parse(r.stdout).defectos;
            if (pdf === 'verdes15') { DEF15.__verdes = defs; STATUS_VERDES = r.status; continue; }
            for (const [et, n] of Object.entries(pags.casos15)) DEF15[et] = defs.filter((x) => x.pagina === n);
        }
        // los dos PDF chicos, de a uno, y la carpeta vacia
        for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
        fs.rmdirSync(dir);
    }, 600000);

    for (const [et, , , codigo, nivel] of CASOS15) {
        it(`${et}: ${codigo} ${nivel ?? 'NO aparece'}`, () => {
            const ds = DEF15[et].filter((x) => x.codigo === codigo);
            const todo = DEF15[et].map((x) => x.nivel + ' ' + x.codigo + ': ' + x.evidencia).join('\n');
            if (nivel === null) expect(ds, todo).toHaveLength(0);
            else expect(ds.some((x) => x.nivel === nivel), todo).toBe(true);
        });
    }

    it('las evidencias dicen lo que Fak marco (la palabra, la herramienta, el icono, la frase cortada)', () => {
        const ev = (et, c) => DEF15[et].filter((x) => x.codigo === c).map((x) => x.evidencia).join(' || ');
        expect(ev('pieza_rojo_20_6_0110', 'PIEZA_SIN_ACLARAR')).toContain('acumuladores');
        expect(ev('epp_rojo_h990', 'EPP_NO_DEL_SECTOR')).toContain('anteojos');
        expect(ev('herr_rojo_tapizado', 'HERRAMENTAL_SIN_MARCAR')).toContain('pistola de calor');
        expect(ev('tachado_rojo_h990', 'TEXTO_TACHADO')).toContain('No reiniciar');
        expect(ev('cantidad_rojo_camino', 'CANTIDAD_ILEGIBLE')).toContain('×3');
        expect(ev('plan_pc_rojo_h990', 'PLAN_DEL_PLAN_DE_CONTROL')).toContain('P-13');
        expect(ev('armado_rojo_h990', 'ARMADO_DISTINTO')).toContain('el plan de reaccion');
        expect(ev('ciclo_aviso_excel_a3', 'CICLO_LLENO')).not.toMatch(/ROJO/);
        expect(DEF15.ciclo_aviso_excel_a3.some((x) => x.codigo === 'CICLO_LLENO' && x.nivel === 'ROJO')).toBe(false);
        expect(ev('ciclo_copiado_op50', 'CICLO_LLENO')).toContain('texto de otra hoja');
        expect(ev('ciclo_copiado_op60_2', 'CICLO_LLENO')).toContain('texto de otra hoja');
        expect(ev('ciclo_partida_op60', 'CICLO_LLENO')).not.toContain('texto de otra hoja');
        expect(ev('ciclo_partida_op60_2', 'CICLO_LLENO')).not.toContain('texto de otra hoja');
    });

    it('las hojas aprobadas por Fak el 13/10 (grampas, hot melt regenerado) y la espuma corregida el 14/10 salen sin un solo defecto ni aviso', () => {
        const ds = DEF15.__verdes;
        expect(ds, ds.map((x) => x.pagina + ' ' + x.nivel + ' ' + x.codigo + ' ' + x.evidencia).join('\n')).toHaveLength(0);
        expect(STATUS_VERDES).toBe(0);
    });
});

describe.skipIf(FALTAN15.length > 0)('tanda 1.5: la puerta de salida (lo que va a Fak o a planta pasa por el revisor, sea de quien sea)', () => {
    const PUERTA = String.raw`
import sys, os, json
sys.path.insert(0, os.path.join(sys.argv[1], 'scripts'))
import _revisarPaqueteHO as R
out = {}
for k, ruta in json.loads(sys.argv[2]).items():
    try:
        out[k] = {'avisos': R.exigir_sin_rojos(ruta, quien='mostrar'), 'frena': False}
    except SystemExit:
        out[k] = {'frena': True}
print(json.dumps(out))
`;
    it('frena la HO-990 Rev.A del servidor; deja pasar las de grampas aprobadas y un PDF que no es de hojas (flujograma, AMFE)', () => {
        const rutas = { h990: F15.h990, gr992: F15.gr992, flujo: path.join(EX, 'IMPRESION_0710_FINAL', '1_FLUJOGRAMAS_A3.pdf'), amfe: F15.amfe, hmreg: F15.hmreg };
        const r = spawnSync('python', ['-c', PUERTA, RAIZ, JSON.stringify(rutas)], {
            encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        });
        const j = JSON.parse(r.stdout.trim().split('\n').pop());
        expect(j.h990.frena).toBe(true);
        expect(j.gr992).toEqual({ avisos: 0, frena: false });
        expect(j.flujo).toEqual({ avisos: 0, frena: false });
        // un AMFE que dice "Hoja de operaciones del puesto" en una celda no es una hoja (lo encontro el auditor, 16/10)
        expect(j.amfe).toEqual({ avisos: 0, frena: false });
        // el hot melt regenerado y emitido el 13/10 (HO-992 OP 20, las 8 hojas) se puede imprimir: avisos si, ROJO no
        expect(j.hmreg.frena).toBe(false);
    }, 300000);

    it('_imprimir.py no imprime un PDF de hojas con ROJO: sale 1 antes de armar el archivo de impresion', () => {
        const r = spawnSync('python', [path.join(RAIZ, 'scripts', '_imprimir.py'), F15.h990, '--a3', '--seco'], {
            encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        });
        expect(r.status, r.stdout + r.stderr).toBe(1);
        expect(r.stdout).toContain('no se puede imprimir');
        expect(r.stdout).not.toContain('Archivo de impresion');
    }, 300000);
});

describe('tanda 1.5: --carpeta (el barrido de las hojas ya emitidas)', () => {
    it('lista los PDF de la carpeta y sus subcarpetas, sin OBSOLETO, HISTORICO ni las carpetas de trabajo "_"', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'revpaq-carpeta-'));
        const crear = (...p) => { fs.mkdirSync(path.join(dir, ...p.slice(0, -1)), { recursive: true }); fs.writeFileSync(path.join(dir, ...p), ''); return path.join(dir, ...p); };
        const archivos = [
            crear('HO 990 - INSERT', 'HO-990 - OP 80.pdf'), crear('HO 990 - INSERT', 'OBSOLETO', 'viejo.pdf'),
            crear('9- HISTORICO (NO USAR)', 'x.pdf'), crear('HO 992', '_fotos', 'foto.pdf'), crear('HO 992', 'HO-992 - OP 50.pdf'),
            crear('HO 992', 'notas.txt'),
        ];
        const r = spawnSync('python', ['-c', String.raw`
import sys, os, json
sys.path.insert(0, os.path.join(sys.argv[1], 'scripts'))
import _revisarPaqueteHO as R
print(json.dumps([os.path.relpath(p, sys.argv[2]).replace(os.sep, '/') for p in R.pdfs_de_carpeta(sys.argv[2])]))
`, RAIZ, dir], { encoding: 'utf8' });
        for (const f of archivos) fs.unlinkSync(f);
        expect(JSON.parse(r.stdout.trim())).toEqual(['HO 990 - INSERT/HO-990 - OP 80.pdf', 'HO 992/HO-992 - OP 50.pdf']);
    });
});
