/**
 * bomLegajoCheck.mjs — ¿la BOM ultimo nivel del legajo APQP quedo al dia con el ultimo cambio?
 *
 * Fak, 22/09/2026: *"cada vez que modificamos la bom... la bom ultimo nivel ahi en el apqp...
 * sino siempre me va a quedar desactualizado el apqp"*. Hacerlo es `scripts/_bomLegajo.py`
 * (skill `carga-arb` §4b); ESTO es lo que avisa cuando no se hizo.
 *
 * Criterio: por cada familia de `bomLegajos.data.json`, ningun PDF de difusion de su carpeta
 * de la biblioteca (`Modificaciones BOM ARB_*.pdf`) puede traer una BOM que su
 * `BOM ARB ultimo nivel_<familia>_*.pdf` del legajo no tenga. Lo corre `scripts/_cierreSesion.mjs`.
 *
 *   1. Si el PDF del legajo es posterior a la ultima difusion (o del mismo minuto), esta al dia.
 *   2. Si hay difusiones posteriores, la FECHA sola no alcanza para decir "falta": del 02 al
 *      06/10/2026 dio un falso rojo en APC por una difusion guardada despues con la misma BOM.
 *      Se compara el CUERPO de cada pagina (titulo, encabezado y filas; sin el bloque
 *      ACTUALIZACIONES ni su fecha), PIEZA POR PIEZA: una difusion trae las piezas que
 *      cambiaron y el PDF del legajo la familia entera. Sigue siendo "falta" si una pieza de
 *      CUALQUIER difusion posterior difiere de la del legajo, si no esta en el PDF del legajo,
 *      o si el contenido no se pudo leer (falla cerrado). Entre dos difusiones posteriores no
 *      se elige cual vale por su fecha de archivo: tienen que coincidir todas (un cambio que
 *      despues se deshizo da un rojo de mas, y se va regenerando el PDF del legajo).
 *
 * Limites conocidos (auditoria del 06/10/2026):
 *   - Una BAJA pura no se ve: si la difusion posterior trae solo las piezas que quedan, y
 *     estan iguales, da verde aunque el PDF del legajo siga llevando la pieza dada de baja.
 *   - El minuto de tolerancia sigue siendo por fecha: una difusion guardada hasta 60 s despues
 *     del PDF del legajo no se compara.
 *   - El titulo de la pagina entra en la comparacion: si cambia la descripcion del producto,
 *     da rojo con las filas iguales.
 *
 * `evaluarBomLegajo()` es pura (la prueba el test); `relevarBomLegajo()` lee el disco y, solo
 * para las familias con una difusion posterior, le pide el cuerpo de los PDF a
 * `scripts/_bomLegajoCuerpo.py` (PyMuPDF, el mismo que los genera). Nada de esto escribe.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const DATOS = path.join(AQUI, 'bomLegajos.data.json');
const LECTOR = path.join(AQUI, '..', '_bomLegajoCuerpo.py');
const RE_DIFUSION = /^Modificaciones BOM ARB_.*\.pdf$/i;
const TOLERANCIA_MS = 60 * 1000;   // mismo minuto: el legajo se genera con el mismo export
const TOPE_PIEZAS_EN_DETALLE = 4;

function pdfsDe(carpeta, filtro) {
    if (!fs.existsSync(carpeta)) return [];
    return fs.readdirSync(carpeta).filter(filtro).map((archivo) => {
        const ruta = path.join(carpeta, archivo);
        return { archivo, ruta, mtime: fs.statSync(ruta).mtimeMs };
    });
}

const masNuevo = (pdfs) => pdfs.reduce((max, p) => (max === null || p.mtime > max.mtime ? p : max), null);

/** Cuerpo de cada pagina de cada PDF, en el orden pedido: `{ paginas: [{ pieza, cuerpo }] }` o
 *  `{ error }` por PDF. Tira si python no corre o no contesta una entrada por PDF. */
export function leerCuerposPdf(rutas) {
    const r = spawnSync('python', [LECTOR, ...rutas], {
        encoding: 'utf8', timeout: 60000, windowsHide: true,
        maxBuffer: 64 * 1024 * 1024,    // el megabyte por defecto no alcanza con ~25 PDF de familia entera
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    if (r.error) throw new Error(`python no corrio (${r.error.message})`);
    if (r.status !== 0) {
        const ultima = (r.stderr || '').trim().split(/\r?\n/).pop() ?? '';
        throw new Error(`_bomLegajoCuerpo.py salio con ${r.status} (${ultima.slice(0, 160)})`);
    }
    const leidos = JSON.parse((r.stdout || '').trim().split(/\r?\n/).pop());
    if (!Array.isArray(leidos) || leidos.length !== rutas.length) {
        throw new Error('_bomLegajoCuerpo.py no devolvio una entrada por PDF');
    }
    return leidos;
}

/** El `contenido` de una familia: la BOM por pieza del PDF del legajo y de cada difusion
 *  posterior. Si UN solo PDF no se puede leer, `{ error }`: no se compara a medias. */
function leerContenido(legajo, posteriores, leer) {
    const pdfs = [legajo, ...posteriores];
    let leidos;
    try {
        leidos = leer(pdfs.map((p) => p.ruta));
    } catch (e) {
        return { error: e.message };
    }
    const roto = pdfs.findIndex((_, i) => !Array.isArray(leidos[i]?.paginas));
    if (roto !== -1) return { error: `${pdfs[roto].archivo}: ${leidos[roto]?.error ?? 'sin paginas'}` };
    const [delLegajo, ...deDifusiones] = pdfs.map((p, i) => ({
        archivo: p.archivo,
        mtime: p.mtime,
        piezas: Object.fromEntries(leidos[i].paginas.map((g) => [g.pieza, g.cuerpo])),
    }));
    return { legajo: delLegajo, difusiones: deDifusiones };
}

export function relevarBomLegajo(datos = JSON.parse(fs.readFileSync(DATOS, 'utf8')), leer = leerCuerposPdf) {
    const raiz = datos.raiz_biblioteca.replace(/^~/, os.homedir());
    const legajoAlcanzable = Object.values(datos.familias).some((f) => fs.existsSync(f.legajo));
    const familias = Object.entries(datos.familias).map(([familia, f]) => {
        const prefijo = `BOM ARB ultimo nivel_${familia}_`.toLowerCase();
        const carpeta = path.join(raiz, f.biblioteca);
        const difusiones = pdfsDe(carpeta, (n) => RE_DIFUSION.test(n));
        const legajo = masNuevo(pdfsDe(f.legajo, (n) => n.toLowerCase().startsWith(prefijo) && n.toLowerCase().endsWith('.pdf')));
        const fila = {
            familia,
            bibliotecaExiste: fs.existsSync(carpeta),
            ultimaDifusion: masNuevo(difusiones)?.mtime ?? null,
            ultimoLegajo: legajo?.mtime ?? null,
        };
        // El contenido se abre solo cuando la fecha sola diria "falta": es el unico caso en
        // que cambia el veredicto, y asi el control no lee PDF en una corrida normal.
        const posteriores = legajo ? difusiones.filter((d) => d.mtime > legajo.mtime + TOLERANCIA_MS) : [];
        if (posteriores.length) fila.contenido = leerContenido(legajo, posteriores, leer);
        return fila;
    });
    return { legajoAlcanzable, familias };
}

const mismoCuerpo = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length > 0
    && a.length === b.length && a.every((renglon, i) => renglon === b[i]);

const algunas = (piezas) => piezas.slice(0, TOPE_PIEZAS_EN_DETALLE).join(', ')
    + (piezas.length > TOPE_PIEZAS_EN_DETALLE ? ` y ${piezas.length - TOPE_PIEZAS_EN_DETALLE} mas` : '');

/** Por que el PDF del legajo NO tiene la BOM de las difusiones posteriores; '' si la tiene.
 *  Cada pieza de CADA difusion posterior tiene que estar igual en el PDF del legajo: no se
 *  elige una difusion sobre otra por su fecha de archivo. Lo que no se pudo leer cuenta como
 *  diferencia: sin contenido comparado, el veredicto es el de la fecha. */
function diferenciaDeContenido(contenido) {
    if (!contenido) return 'difusion posterior, sin comparar el contenido';
    if (contenido.error) return `no se pudo comparar el contenido: ${contenido.error}`;
    const difusiones = contenido.difusiones ?? [];
    const delLegajo = contenido.legajo?.piezas;
    const sinPiezas = difusiones.some((d) => !d.piezas || !Object.keys(d.piezas).length);
    if (!difusiones.length || sinPiezas || !delLegajo) return 'no se pudo comparar el contenido: no se leyo ninguna pieza';
    const faltan = new Set();
    const distintas = new Set();
    for (const d of difusiones) {
        for (const [pieza, cuerpo] of Object.entries(d.piezas)) {
            if (!Object.hasOwn(delLegajo, pieza)) faltan.add(pieza);
            else if (!mismoCuerpo(cuerpo, delLegajo[pieza])) distintas.add(pieza);
        }
    }
    return [
        distintas.size ? `BOM distinta a la difundida: ${algunas([...distintas])}` : '',
        faltan.size ? `no esta en el PDF del legajo: ${algunas([...faltan])}` : '',
    ].filter(Boolean).join('; ');
}

export function evaluarBomLegajo({ legajoAlcanzable, familias }) {
    // Una biblioteca que no se lee NO es "sin difusion": sin esto la familia se caia del
    // control en silencio y el total daba verde (lo encontro el auditor el 23/09/2026).
    const ciegas = familias.filter((f) => f.bibliotecaExiste === false).map((f) => f.familia);
    const aviso = ciegas.length ? ` | sin leer la biblioteca de: ${ciegas.join(', ')} (revisar la ruta en bomLegajos.data.json)` : '';
    const conDifusion = familias.filter((f) => f.ultimaDifusion !== null);
    if (!conDifusion.length) {
        return ciegas.length
            ? { estado: 'aviso', detalle: 'no se pudo medir' + aviso }
            : { estado: 'no-aplica', detalle: 'ninguna familia registrada tiene PDF de difusion' };
    }
    if (!legajoAlcanzable) {
        return { estado: 'aviso', detalle: 'no se ven los legajos (Y: sin montar): node scripts/_montarDiscos.mjs y volver a medir' };
    }
    const atrasadas = [];
    const mismaBom = [];     // difusion posterior, pero el legajo ya tiene esa BOM
    for (const f of conDifusion) {
        if (f.ultimoLegajo === null) { atrasadas.push(`${f.familia} (no hay ninguna en el legajo)`); continue; }
        if (f.ultimaDifusion <= f.ultimoLegajo + TOLERANCIA_MS) continue;
        const diferencia = diferenciaDeContenido(f.contenido);
        if (diferencia) atrasadas.push(`${f.familia} (${diferencia})`);
        else mismaBom.push(f.familia);
    }
    if (atrasadas.length) {
        return {
            estado: 'falta',
            detalle: 'BOM ultimo nivel sin subir al legajo APQP: ' + atrasadas.join(', ')
                + ' -> python scripts/_bomLegajo.py <familia> --fecha dd/mm/aaaa --act "..." --apply' + aviso,
        };
    }
    if (ciegas.length) return { estado: 'aviso', detalle: `${conDifusion.length} familia(s) al dia` + aviso };
    return {
        estado: 'ok',
        detalle: `${conDifusion.length} familia(s): el legajo tiene la BOM del ultimo cambio`
            + (mismaBom.length ? ` (${mismaBom.join(', ')}: hay una difusion posterior con la misma BOM)` : ''),
    };
}
