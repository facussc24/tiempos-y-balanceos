/**
 * _escritorio.mjs — la cola de tareas del Escritorio y su archivo.
 *
 * SIN shebang a proposito: Vitest inlinea los modulos y se los pasa a `new vm.Script()`,
 * que NO acepta `#!`. Con el shebang, `escritorio.test.mjs` no llegaba ni a cargar —
 * moria con "SyntaxError: Invalid or unexpected token" en la linea 1, y el cache de Vite
 * lo venia tapando: solo aparecia con el cache limpio, como en CI.
 *
 * El Escritorio es la lista de pendientes: una carpeta por tarea. Cuando una se cierra:
 *
 *   1. El ENTREGABLE ya esta en su carpeta por tipo de la biblioteca de Ingenieria
 *      (FICHAS DE EMBALAJE, 2. CONSUMO DE MATERIAL BOM, 5. 3D, ULM GATE 2...). Eso no es
 *      archivar: eso ES haber terminado la tarea. Este script NO copia entregables — dos
 *      copias del mismo documento en dos lugares es el problema, no la solucion.
 *   2. El RASTRO (el mail que la origino, capturas, borradores) se mueve a
 *      `1- GENERAL\TAREAS CERRADAS\<año>\`, que es lo unico que hoy no tiene casa.
 *   3. El INDICE en Excel es el puente: dice que se pidio, quien, que se hizo y EN QUE
 *      CARPETA quedo el entregable. Ahi se busca, no revolviendo carpetas.
 *
 * NADA SE BORRA NUNCA: no hay una sola llamada de borrado en este archivo.
 *
 *   node scripts/_escritorio.mjs                      # relevar + barrido de mails + verificar
 *   node scripts/_escritorio.mjs --check              # solo invariantes (exit 1 si rompen)
 *   node scripts/_escritorio.mjs --archivar "<carpeta>" --cerrada AAAA-MM-DD \
 *        --quien "<quien lo pidio>" --que "<que se hizo>" --donde "<donde quedo el entregable>"
 *   node scripts/_escritorio.mjs --reabrir "<carpeta archivada>" [--como "<otro nombre>"]
 *   ... + --dry-run  para ver el plan sin tocar nada
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { RUTA_ESCRITORIO, RUTA_TAREAS_CERRADAS } from './_lib/serverPaths.mjs';
import { leerMsg } from './_leerMsg.mjs';
import { claveHilo,
    MAILS_JSONL, leerMailsDesde, cruzarMailsConTareas, fechaCorte, fechaLocal,
} from './_lib/mailCache.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// Configuracion (las rutas viven en _lib/serverPaths.mjs, con el resto)
// ─────────────────────────────────────────────────────────────────────────────

export const ESCRITORIO_DEFAULT = RUTA_ESCRITORIO;
export const ARCHIVO_DEFAULT = RUTA_TAREAS_CERRADAS;

const EXT_FIJAS = new Set(['.lnk', '.url', '.ini', '.exe', '.db']);
const NOMBRES_FIJOS = new Set(['juegos', 'desktop.ini', 'thumbs.db']);

/**
 * Carpeta-bandeja: Fak la creo el 09/08/2026 para sacarse de la vista las tareas que no son
 * de esta semana (el Escritorio tenia 81 iconos y le molestaba). NO es una tarea ni un
 * archivo de cerradas: lo de adentro sigue ABIERTO y se releva igual, solo que aparte.
 * Sin esto el relevador contaba "_EN ESPERA" como una tarea sola y perdia de vista 27.
 */
export const CARPETA_EN_ESPERA = '_EN ESPERA';
export const esEnEspera = (nombre) => /^_en\s*espera$/i.test(String(nombre).trim());
const RELLENO = /^(tbd|n\/?a|-+|\.+|ok|listo|pendiente|varios?|nada|sin datos?)$/i;

export const COLUMNAS = [
    { key: 'cerrada', header: 'Cerrada', width: 12 },
    { key: 'tarea', header: 'Tarea', width: 52 },
    { key: 'quien', header: 'Quién lo pidió', width: 20 },
    { key: 'que', header: 'Qué se hizo', width: 62 },
    { key: 'donde', header: 'Dónde quedó el entregable', width: 62 },
    { key: 'estado', header: 'Estado', width: 18 },
];

/**
 * ExcelJS se carga a demanda. Es el 90% del arranque de este script: medido el 11/09/2026 en
 * esta maquina, `node -e "import('exceljs')"` tarda 877-926 ms contra 94-101 ms de node pelado,
 * y el script arranca UNA VEZ POR COMANDO. Los caminos que no abren el listado (--relevar sin
 * archivo todavia, --limpiar-vacia, el --archivar que frena en el gate) dejan de pagarlo, y los
 * tests de integracion — que son 11 spawns — bajan otro tanto.
 */
let excelJS = null;
const cargarExcel = async () => (excelJS ??= (await import('exceljs')).default);

const c = { r: '\x1b[31m', y: '\x1b[33m', g: '\x1b[32m', b: '\x1b[34m', d: '\x1b[2m', x: '\x1b[0m' };
const say = (s = '') => console.log(s);
const ok = (s) => console.log(`${c.g}✓${c.x}  ${s}`);
const warn = (s) => console.log(`${c.y}⚠${c.x}  ${s}`);
const bad = (s) => console.log(`${c.r}✗${c.x}  ${s}`);

// ─────────────────────────────────────────────────────────────────────────────
// Funciones puras (las ejerce __tests__/scripts/escritorio.test.mjs)
// ─────────────────────────────────────────────────────────────────────────────

export const anioDe = (fechaISO) => String(fechaISO).slice(0, 4);
export const nombreIndice = (anio) => `LISTADO DE TAREAS CERRADAS ${anio}.xlsx`;

export function nombreCanonico(fechaISO, nombreOriginal) {
    return `${fechaISO} - ${despojarFecha(nombreOriginal)}`;
}

export function despojarFecha(nombre) {
    return String(nombre).replace(/^\d{4}-\d{2}-\d{2}\s+-\s+/, '').trim();
}

/**
 * El nombre con el que se archiva, sin la extension si es un archivo suelto.
 *
 * Una CARPETA se queda con su nombre entero. `path.parse().name` corta en el ultimo
 * punto, y Fak les pone la fecha adentro del nombre ("Asaichi 11.8.26",
 * "Tarea apb son las 10.50am ..."): tratado como extension, el nombre se archiva
 * mutilado y deja de ser reconocible. Ya paso dos veces antes de detectarse.
 */
export function nombreSinExtension(base, esDir) {
    return esDir ? String(base).trim() : path.parse(String(base)).name;
}

export function esFechaValida(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s ?? ''))) return false;
    const d = new Date(`${s}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) return false;
    if (d.toISOString().slice(0, 10) !== s) return false;   // 2026-02-31 no existe
    return d.getTime() <= Date.now() + 86400000;            // no se cierra en el futuro
}

/**
 * Valida el registro de cierre. Devuelve los motivos de rechazo (vacio = pasa).
 * Sin esto no se mueve nada: una carpeta archivada sin registro es una caja sin etiqueta.
 */
export function validarCierre({ cerrada, quien, que, donde }) {
    const errores = [];
    if (!esFechaValida(cerrada)) errores.push('--cerrada tiene que ser AAAA-MM-DD, real y no futura');
    const campos = [['--quien', quien, 3], ['--que', que, 10], ['--donde', donde, 10]];
    for (const [flag, valor, minimo] of campos) {
        const v = String(valor ?? '').trim();
        if (!v) { errores.push(`falta ${flag}`); continue; }
        if (/[\r\n]/.test(v)) errores.push(`${flag} no puede tener saltos de linea`);
        if (v.length < minimo) errores.push(`${flag} es demasiado corto (${v.length}, minimo ${minimo})`);
        if (RELLENO.test(v)) errores.push(`${flag} es relleno ("${v}"), tiene que decir algo concreto`);
    }
    return errores;
}

export function clasificarEntrada(nombre, esDirectorio) {
    const bajo = nombre.toLowerCase();
    if (NOMBRES_FIJOS.has(bajo)) return 'fijo';
    if (!esDirectorio && EXT_FIJAS.has(path.extname(bajo))) return 'fijo';
    if (esDirectorio && /^_terminadas(\s+\d{4})?$/i.test(nombre)) return 'archivo';
    if (esDirectorio && esEnEspera(nombre)) return 'espera';
    if (nombre.startsWith('.')) return 'fijo';
    return 'tarea';
}

/**
 * Clave para comparar la MISMA tarea entre la cola y el archivo: el archivo le pone la fecha
 * de cierre adelante y Windows no distingue mayusculas, asi que se despoja y se baja todo.
 */
export const claveTarea = (nombre) => despojarFecha(nombre).trim().toLowerCase();

/**
 * Invariantes del archivo de cerradas. Devuelve la lista de problemas (vacia = sano).
 *
 *   estadoFs.archivadas  carpetas presentes en el año del archivo.
 *   estadoFs.abiertas    nombres de las tareas que HOY estan abiertas en la cola (raiz +
 *                        `_EN ESPERA`). Opcional; sin esto no se ve la tarea que esta en los
 *                        dos lados a la vez, que es el estado peor: dos fuentes de lo mismo.
 */
export function verificarInvariantes(filas, estadoFs) {
    const problemas = [];
    const archivadas = new Set(estadoFs.archivadas);
    const abiertas = new Set((estadoFs.abiertas ?? []).map(claveTarea));
    const registradas = new Set();
    const reabiertas = new Map();

    for (const f of filas) {
        // Una fila "reabierta" es HISTORIA: la carpeta se fue de vuelta a la cola, asi que no
        // se le exige carpeta ni contenido. Pero se ANOTA, porque si la carpeta igual esta en
        // el archivo el problema no es que falte la fila: es que la carpeta volvio.
        const estado = String(f.estado ?? '');
        if (estado.startsWith('reabierta')) {
            const cuando = estado.replace(/^reabierta\s*/, '').trim();
            const previa = reabiertas.get(f.tarea);
            if (!previa || cuando > previa) reabiertas.set(f.tarea, cuando);
            continue;
        }
        if (!esFechaValida(f.cerrada)) problemas.push(`fila con fecha invalida: "${f.cerrada}" (${f.tarea})`);
        if (!archivadas.has(f.tarea)) problemas.push(`el INDICE nombra "${f.tarea}" pero esa carpeta no esta en el archivo`);
        if (registradas.has(f.tarea)) problemas.push(`"${f.tarea}" esta dos veces en el INDICE`);
        registradas.add(f.tarea);
        for (const [campo, v, minimo] of [['quien lo pidio', f.quien, 3], ['que se hizo', f.que, 10], ['donde quedo', f.donde, 10]]) {
            const s = String(v ?? '').trim();
            if (s.length < minimo || RELLENO.test(s)) problemas.push(`"${f.tarea}": el ${campo} no dice nada concreto ("${s}")`);
        }
    }
    for (const carpeta of estadoFs.archivadas) {
        // El mensaje tiene que mandar a mirar donde esta el problema. Una carpeta cuyas unicas
        // filas son "reabierta" SI tiene fila: lo que pasa es que volvio al archivo despues de
        // haberse reabierto. Decirle "no tiene fila en el INDICE" manda a buscar al Excel, que
        // esta bien, y la carpeta se queda donde no va (caso HOTMELT, 11/09/2026).
        if (!registradas.has(carpeta)) {
            problemas.push(reabiertas.has(carpeta)
                ? `"${carpeta}" esta en el archivo Y su ultima fila dice "reabierta ${reabiertas.get(carpeta)}": no falta la fila, sobra la carpeta. O volvio sola despues de reabrirse, o se re-archivo sin registrar.`
                : `"${carpeta}" esta archivada pero no tiene fila en el INDICE`);
        }
        // El chequeo frena, no decide: las dos lecturas son posibles y la de al lado no se
        // adivina desde el nombre. Se dicen las dos y se abren las dos carpetas.
        if (abiertas.has(claveTarea(carpeta))) {
            problemas.push(`"${carpeta}" esta archivada Y hay una tarea abierta con el mismo nombre ("${despojarFecha(carpeta)}"): o una de las dos es una copia que quedo atras (la del archivo sale con --reabrir), o son dos vueltas distintas del mismo tema y a la abierta le falta nombre propio. Se abren las dos y se mira.`);
        }
        if (!/^\d{4}-\d{2}-\d{2} - .+/.test(carpeta)) problemas.push(`"${carpeta}" no arranca con la fecha de cierre (AAAA-MM-DD - nombre)`);
    }
    return problemas;
}

export const diasDesde = (ms, ahora = Date.now()) => Math.floor((ahora - ms) / 86400000);

/**
 * Desde cuando esta abierta una tarea. La fecha del archivo NO sirve: copiar el Escritorio
 * a otra maquina (o un resync de OneDrive) le pone a todo la fecha de hoy, y el 02/08/2026
 * eso borro de un plumazo la antiguedad de 30 carpetas. La fecha del mail, en cambio, viaja
 * adentro del .msg y sobrevive a cualquier copia — por eso gana siempre que exista.
 */
export function elegirFechaTarea({ fechasMail = [], mtimes = [] }) {
    const validas = (xs) => xs.filter((n) => Number.isFinite(n) && n > 0);
    const mails = validas(fechasMail);
    if (mails.length) return { ms: Math.max(...mails), fuente: 'mail' };
    const archivos = validas(mtimes);
    if (archivos.length) return { ms: Math.max(...archivos), fuente: 'archivo' };
    return { ms: 0, fuente: 'sin fecha' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Filesystem
// ─────────────────────────────────────────────────────────────────────────────

export function listar(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).map((d) => {
        const p = path.join(dir, d.name);
        let mtime = 0;
        try { mtime = fs.statSync(p).mtimeMs; } catch { /* OneDrive puede negar el stat */ }
        return { nombre: d.name, dir: d.isDirectory(), ruta: p, mtime };
    });
}

/**
 * Las tareas ABIERTAS de la cola: las de la raiz mas las de adentro de `_EN ESPERA` (la bandeja
 * esconde de la vista, no cierra — regla `escritorio-tareas.md` §0). Exportada porque el
 * relevador, el `--check` y `_cierreSesion.mjs` tienen que contar exactamente lo mismo: cuando
 * cada uno se armaba su propia lista, alcanzaba con que uno se olvidara de la bandeja.
 */
export function tareasAbiertas(escritorio) {
    const entradas = listar(escritorio);
    const esTarea = (e) => clasificarEntrada(e.nombre, e.dir) === 'tarea';
    const bandeja = entradas.find((e) => clasificarEntrada(e.nombre, e.dir) === 'espera');
    return { vista: entradas.filter(esTarea), enEspera: bandeja ? listar(bandeja.ruta).filter(esTarea) : [] };
}

/** El nombre con el que una tarea abierta se compara contra el archivo (sin extension si es suelta). */
export const nombresDeTareas = (tareas) => tareas.map((t) => nombreSinExtension(t.nombre, t.dir));

/**
 * Junta las fechas candidatas de una tarea: las de los mails que tiene adentro y las del
 * filesystem. Mira solo el primer nivel — el mail que origino la tarea esta ahi, y abrir
 * los .msg de las subcarpetas seria leer decenas de megas de adjuntos al pedo.
 * Exportada: _cierreSesion.mjs releva la antiguedad con la MISMA regla (mail > mtime).
 */
export function fechasDeTarea(tarea) {
    const fechasMail = []; const mtimes = [];
    const sumarMsg = (ruta) => {
        try { const { fecha } = leerMsg(ruta); if (fecha) fechasMail.push(fecha.getTime()); } catch { /* .msg roto o placeholder de OneDrive */ }
    };
    if (!tarea.dir) {
        mtimes.push(tarea.mtime);
        if (tarea.nombre.toLowerCase().endsWith('.msg')) sumarMsg(tarea.ruta);
    } else {
        for (const e of listar(tarea.ruta)) {
            mtimes.push(e.mtime);
            if (!e.dir && e.nombre.toLowerCase().endsWith('.msg')) sumarMsg(e.ruta);
        }
    }
    return elegirFechaTarea({ fechasMail, mtimes });
}

/** Cuenta archivos y bytes para poder verificar que el movimiento no perdio nada. */
export function medir(destino) {
    let archivos = 0; let bytes = 0;
    const recorrer = (dir) => {
        for (const e of listar(dir)) {
            if (e.dir) recorrer(e.ruta);
            else { archivos += 1; try { bytes += fs.statSync(e.ruta).size; } catch { /* placeholder */ } }
        }
    };
    if (!fs.existsSync(destino)) return { archivos: 0, bytes: 0 };
    if (fs.statSync(destino).isDirectory()) recorrer(destino);
    else { archivos = 1; bytes = fs.statSync(destino).size; }
    return { archivos, bytes };
}

const carpetaAnio = (archivo, anio) => path.join(archivo, anio);
const rutaIndice = (archivo, anio) => path.join(carpetaAnio(archivo, anio), nombreIndice(anio));

/**
 * Filas del listado de tareas cerradas de un año. Exportada porque su columna
 * "Dónde quedó el entregable" es la ÚNICA pista de dónde fue a parar algo ya entregado:
 * `_entregas.mjs` empieza la búsqueda por acá antes de barrer disco.
 */
export async function leerIndice(archivo, anio) {
    const p = rutaIndice(archivo, anio);
    if (!fs.existsSync(p)) return [];
    const ExcelJS = await cargarExcel();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(p);
    const hoja = wb.worksheets[0];
    const filas = [];
    hoja.eachRow((row, i) => {
        if (i === 1) return;                                   // cabecera
        const celda = (n) => String(row.getCell(n).text ?? '').trim();
        const f = Object.fromEntries(COLUMNAS.map((col, j) => [col.key, celda(j + 1)]));
        if (f.tarea) filas.push(f);
    });
    return filas;
}

async function escribirIndice(archivo, anio, filas) {
    const p = rutaIndice(archivo, anio);
    const ExcelJS = await cargarExcel();
    const wb = new ExcelJS.Workbook();
    const hoja = wb.addWorksheet(`Tareas cerradas ${anio}`);
    hoja.columns = COLUMNAS.map(({ header, key, width }) => ({ header, key, width }));
    hoja.getRow(1).font = { bold: true };
    hoja.getRow(1).alignment = { vertical: 'middle' };
    hoja.views = [{ state: 'frozen', ySplit: 1 }];
    for (const f of filas) hoja.addRow(f);
    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNAS.length } };
    for (let i = 2; i <= filas.length + 1; i += 1) hoja.getRow(i).alignment = { vertical: 'top', wrapText: true };
    fs.mkdirSync(path.dirname(p), { recursive: true });
    await wb.xlsx.writeFile(p);
    return p;
}

// ─────────────────────────────────────────────────────────────────────────────
// Comandos
// ─────────────────────────────────────────────────────────────────────────────

async function cmdRelevar(escritorio, archivo) {
    const abiertas = tareasAbiertas(escritorio);
    const conFecha = (xs) => xs.map((t) => ({ ...t, fecha: fechasDeTarea(t) }));
    const tareas = conFecha(abiertas.vista);
    const enEspera = conFecha(abiertas.enEspera);

    const linea = (t) => {
        const d = t.fecha.ms ? diasDesde(t.fecha.ms) : null;
        const edad = d === null ? '   ?' : `${String(d).padStart(3)}d`;
        const origen = t.fecha.fuente === 'mail' ? '        ' : `${c.d}(fecha de archivo)${c.x}`;
        say(`  ${d !== null && d >= 7 ? c.y : c.d}${edad}${c.x}  ${c.d}${t.dir ? 'carpeta' : 'suelto '}${c.x}  ${t.nombre}  ${origen}`);
    };
    const porFecha = (xs) => [...xs].sort((a, b) => b.fecha.ms - a.fecha.ms);

    say(`\n${c.b}ESCRITORIO${c.x}  ${escritorio}`);
    say(`${c.d}${tareas.length} a la vista${enEspera.length ? ` + ${enEspera.length} en ${CARPETA_EN_ESPERA}` : ''} = ${tareas.length + enEspera.length} abiertas${c.x}\n`);
    for (const t of porFecha(tareas)) linea(t);

    if (enEspera.length) {
        say(`\n  ${c.b}${CARPETA_EN_ESPERA}${c.x} ${c.d}— fuera de la vista, pero ABIERTAS${c.x}`);
        for (const t of porFecha(enEspera)) linea(t);
    }

    if ([...tareas, ...enEspera].some((t) => t.fecha.ms && diasDesde(t.fecha.ms) >= 7)) {
        say(`\n${c.d}Lo amarillo lleva 7 dias o mas desde que llego el pedido: o esta cerrado sin${c.x}`);
        say(`${c.d}archivar, o esta trabado esperando a alguien. Las dos cosas se resuelven, no se dejan.${c.x}`);
    }
    if ([...tareas, ...enEspera].some((t) => t.fecha.fuente !== 'mail')) {
        say(`${c.d}Las marcadas "(fecha de archivo)" no tienen mail adentro: esa fecha se pisa sola${c.x}`);
        say(`${c.d}cuando se copia la carpeta, asi que puede ser mas nueva de lo que la tarea es.${c.x}`);
    }

    // El listado de cerradas se lee ANTES de imprimir el archivo porque el cruce de mails
    // tambien lo necesita: un mail sobre una tarea recien cerrada no es un pedido invisible.
    const cerradasPorAnio = [];
    if (fs.existsSync(archivo)) {
        for (const anio of listar(archivo).filter((e) => e.dir && /^\d{4}$/.test(e.nombre)).map((e) => e.nombre)) {
            cerradasPorAnio.push({ anio, filas: await leerIndice(archivo, anio) });
        }
    }
    await relevarMails([...tareas, ...enEspera], cerradasPorAnio);

    say(`\n${c.b}ARCHIVO${c.x}  ${archivo}`);
    if (!fs.existsSync(archivo)) { warn('Todavia no existe: se crea con el primer --archivar.'); return 0; }
    for (const { anio, filas } of cerradasPorAnio) {
        say(`  ${anio}: ${filas.length} tarea(s) en el listado`);
        for (const f of filas.slice(-8)) say(`    ${c.d}${f.cerrada}${c.x}  ${f.tarea}`);
    }
    say('');
    return cmdCheck(archivo, escritorio);
}

/**
 * El barrido de la Bandeja contra la cola — automatizado el 30/08/2026.
 *
 * Antes era un paso MANUAL del relevamiento ("barrer la Bandeja de los ultimos ~10 dias
 * contra los nombres de carpeta") y en los tres relevamientos en que se hizo (03/08, 14/08,
 * 19/08) destapo SIETE pedidos que llegaron por mail y nunca se volvieron carpeta. Las dos
 * secciones son listas para OJEAR, no verdades: la decision de abrir una carpeta o mandar
 * un borrador sigue siendo humana.
 */
const DIAS_BARRIDO = 10;
async function relevarMails(abiertas, cerradasPorAnio, { dias = DIAS_BARRIDO, jsonl = MAILS_JSONL } = {}) {
    if (!fs.existsSync(jsonl)) {
        say(`\n${c.y}⚠${c.x}  Sin cache de mails (${jsonl}): el barrido Bandeja↔Escritorio no se puede hacer.`);
        say(`${c.d}   Corre primero:  python scripts/_mails.py --sync${c.x}`);
        return;
    }
    const nombres = [
        ...abiertas.map((t) => t.nombre),
        ...cerradasPorAnio.flatMap(({ filas }) => filas.map((f) => despojarFecha(f.tarea))),
    ];
    const mails = await leerMailsDesde(fechaCorte(dias), jsonl);
    const { sinCarpeta, noAvisados } = cruzarMailsConTareas(mails, nombres);

    // Cuando de verdad se sincronizo, no cuando llego el ultimo mail: un finde sin mails
    // nuevos deja el cache "viejo" estando perfectamente al dia.
    let ultimoSync = 0;
    try { ultimoSync = fs.statSync(path.join(path.dirname(jsonl), 'sync.log')).mtimeMs; } catch { /* sin log */ }
    const syncViejo = ultimoSync && diasDesde(ultimoSync) >= 2;

    say(`\n${c.b}MAILS DE LA BANDEJA SIN CARPETA${c.x}  ${c.d}ultimos ${dias} dias — candidatas a pedido invisible${c.x}`);
    if (syncViejo) say(`${c.y}⚠${c.x}  El cache no se sincroniza hace ${diasDesde(ultimoSync)} dias: puede faltar lo ultimo (python scripts/_mails.py --sync).`);
    if (!sinCarpeta.length) {
        say(`${c.d}  (ninguno: todos los hilos recientes matchean alguna tarea abierta o cerrada)${c.x}`);
    } else {
        const TOPE = 15;
        for (const h of sinCarpeta.slice(0, TOPE)) {
            say(`  ${c.d}${h.fecha.slice(5, 10)}${c.x}  ${h.de.slice(0, 24).padEnd(24)}  ${h.asunto.slice(0, 70)}${h.mails > 1 ? `  ${c.d}(${h.mails} mails)${c.x}` : ''}`);
        }
        if (sinCarpeta.length > TOPE) say(`  ${c.d}… y ${sinCarpeta.length - TOPE} hilo(s) mas${c.x}`);
        say(`${c.d}  Un hilo aca puede ser charla sin tarea — pero si es un pedido, hoy NADIE lo esta mirando.${c.x}`);
    }

    if (noAvisados.length) {
        say(`\n${c.b}HECHO PERO NO AVISADO${c.x}  ${c.d}borradores y bandeja de salida de los ultimos ${dias} dias${c.x}`);
        say(`${c.d}  la firma del patron que explicaba 30 de 30 tareas sin cerrar (triage 03/08): el trabajo esta, el aviso no salio${c.x}`);
        for (const m of noAvisados) {
            const tipo = m.tipo === 'salida' ? `${c.r}EN COLA DE SALIDA${c.x}` : 'borrador';
            say(`  ${c.d}${m.fecha.slice(5, 10)}${c.x}  ${tipo}  ${c.d}para:${c.x} ${m.para.slice(0, 30).padEnd(30)}  ${m.asunto.slice(0, 55)}`);
        }
        say(`${c.d}  Solo aviso: los mails los manda Fak, o van por scripts/_mailEnviar.py (regla mail-envio).${c.x}`);
    }

    relevarSinRespuesta(jsonl, { nombresTareas: nombres });
}

/**
 * PEDIDOS SIN RESPUESTA — Ola 4 (05/09/2026), plan del 04/09 H6: el dia de la auditoria habia
 * 5 pedidos abiertos en la Bandeja (codigos 21-9694/95 con 14 dias, BOM IP Pad, dispositivo de
 * adhesivado, relevamiento de medios, PSW vinilos) y ninguno era una carpeta del Escritorio.
 * La logica vive en python (scripts/_mails.py --sin-respuesta, con selftest de 16 casos): aca
 * solo se corre y se muestra. Si python o el script fallan, se dice y se sigue: esta seccion
 * nunca tumba el relevamiento.
 */
export function relevarSinRespuesta(jsonl = MAILS_JSONL, { dias = 5, ventana = 45, tope = 15, nombresTareas = [] } = {}) {
    const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '_mails.py');
    say(`\n${c.b}PEDIDOS SIN RESPUESTA${c.x}  ${c.d}Bandeja de entrada, dirigidos a Fak, ultimos ${ventana} dias, sin mail suyo en el hilo hace ${dias} dias o mas${c.x}`);
    const r = spawnSync('python', [script, '--sin-respuesta', '--json', '--dias', String(dias), '--ventana', String(ventana)], {
        encoding: 'utf8', timeout: 60000,
        env: { ...process.env, BARACK_MAIL_CACHE: path.dirname(jsonl), PYTHONIOENCODING: 'utf-8' },
    });
    let datos = null;
    try { datos = JSON.parse((r.stdout || '').trim().split(/\r?\n/).pop()); } catch { /* sin JSON */ }
    if (datos?.error) {
        say(`${c.y}⚠${c.x}  ${datos.error}: sin cache de mails no hay pedidos que mirar (python scripts/_mails.py --sync). Correlo a mano despues.`);
        return null;
    }
    if (r.status !== 0 || !datos || !Array.isArray(datos.pedidos)) {
        say(`${c.y}⚠${c.x}  No pude correr \`python scripts/_mails.py --sin-respuesta\` (${(r.stderr || r.error?.message || 'sin salida').toString().trim().slice(0, 160)}). Correlo a mano.`);
        return null;
    }
    if (!datos.pedidos.length) {
        say(`${c.d}  (ninguno: todo lo que le pidieron a Fak por mail tiene respuesta suya, o tiene menos de ${dias} dias)${c.x}`);
        return datos.pedidos;
    }
    // El mismo cruce que el barrido de arriba: un pedido sin respuesta Y sin carpeta es el que
    // nadie esta mirando; uno con carpeta ya esta en la cola (se contesto por otro canal, o se
    // esta haciendo). Se reusa cruzarMailsConTareas con los pedidos disfrazados de mails de la
    // Bandeja, para que "matchea una tarea" signifique lo mismo en las dos secciones.
    const pseudo = datos.pedidos.map((p) => ({ carpeta: 'Bandeja de entrada', asunto: p.asunto, fecha: p.fecha, de: p.de, de_mail: p.de_mail }));
    const clavesSinCarpeta = new Set(cruzarMailsConTareas(pseudo, nombresTareas).sinCarpeta.map((h) => claveHilo(h.asunto)));
    for (const p of datos.pedidos) p.sinCarpeta = clavesSinCarpeta.has(claveHilo(p.asunto));
    const orden = [...datos.pedidos].sort((a, b) => (b.sinCarpeta - a.sinCarpeta) || (b.dias - a.dias));
    for (const p of orden.slice(0, tope)) {
        const marca = p.estado === 'sin respuesta' ? '' : `  ${c.r}${p.estado.toUpperCase()}${c.x}`;
        const carpeta = p.sinCarpeta ? `  ${c.y}SIN CARPETA${c.x}` : `  ${c.d}(tiene carpeta)${c.x}`;
        say(`  ${p.dias >= 7 ? c.y : ''}${String(p.dias).padStart(3)} d${c.x}  ${p.de.slice(0, 24).padEnd(24)}  ${p.asunto.slice(0, 56)}${p.mails > 1 ? `  ${c.d}(${p.mails} mails)${c.x}` : ''}${carpeta}${marca}`);
    }
    if (orden.length > tope) say(`  ${c.d}… y ${orden.length - tope} hilo(s) mas (python scripts/_mails.py --sin-respuesta)${c.x}`);
    const nSin = orden.filter((p) => p.sinCarpeta).length;
    say(`${c.d}  ${nSin} sin carpeta de ${orden.length}. Lista para OJEAR: un hilo aca puede ser un FYI o haberse contestado por WhatsApp. Los contesta Fak; una carpeta nueva en el Escritorio se abre solo con su OK.${c.x}`);
    return orden;
}

async function cmdCheck(archivo, escritorio) {
    if (!fs.existsSync(archivo)) { warn(`El archivo todavia no existe: ${archivo}`); return 0; }
    const anios = listar(archivo).filter((e) => e.dir && /^\d{4}$/.test(e.nombre)).map((e) => e.nombre);
    if (anios.length === 0) { warn('No hay ningun año en el archivo.'); return 0; }

    // La cola entra al chequeo: una tarea no puede estar cerrada y abierta a la vez.
    const cola = escritorio && fs.existsSync(escritorio) ? tareasAbiertas(escritorio) : { vista: [], enEspera: [] };
    const abiertas = nombresDeTareas([...cola.vista, ...cola.enEspera]);

    let problemas = 0;
    for (const anio of anios) {
        const filas = await leerIndice(archivo, anio);
        const archivadas = listar(carpetaAnio(archivo, anio)).filter((e) => e.dir).map((e) => e.nombre);
        const lista = verificarInvariantes(filas, { archivadas, abiertas });
        if (lista.length === 0) ok(`${anio}: ${archivadas.length} carpeta(s), todas registradas y con nombre canonico.`);
        else {
            problemas += lista.length;
            bad(`${anio}: ${lista.length} problema(s)`);
            for (const p of lista) say(`     ${c.r}·${c.x} ${p}`);
        }
    }
    return problemas;
}

async function cmdArchivar(escritorio, archivo, { nombre, cerrada, quien, que, donde, dryRun }) {
    const errores = validarCierre({ cerrada, quien, que, donde });
    if (errores.length) {
        bad('No se archiva: falta el registro de cierre.');
        for (const e of errores) say(`     ${c.r}·${c.x} ${e}`);
        say(`\n${c.d}Mover y registrar son la misma operacion. El "donde quedo el entregable" es lo${c.x}`);
        say(`${c.d}que despues te lo hace encontrar; sin eso la carpeta es una caja sin etiqueta.${c.x}`);
        return 1;
    }

    const origen = path.join(escritorio, nombre);
    if (!fs.existsSync(origen)) { bad(`No existe en el Escritorio: "${nombre}"`); return 1; }
    const esDir = fs.statSync(origen).isDirectory();
    const base = path.basename(nombre);
    if (clasificarEntrada(base, esDir) === 'espera') {
        bad(`"${base}" es la bandeja, no una tarea: adentro hay pendientes ABIERTOS.`);
        say(`${c.d}Archivarla mandaria todas al archivo de cerradas de un saque. Archivá una por una.${c.x}`);
        return 1;
    }
    if (clasificarEntrada(base, esDir) !== 'tarea') { bad(`"${base}" no es una tarea (acceso directo, archivo de sistema o el archivo de terminadas).`); return 1; }

    const anio = anioDe(cerrada);
    const tarea = nombreCanonico(cerrada, nombreSinExtension(base, esDir));
    const destino = path.join(carpetaAnio(archivo, anio), tarea);
    if (fs.existsSync(destino)) { bad(`Ya existe "${anio}\\${tarea}". Renombrar antes de archivar.`); return 1; }
    // Una fila "reabierta" NO cuenta como duplicado: reabrir existe justamente para volver a
    // archivar despues. Sin esta salvedad, toda tarea reabierta quedaba trabada afuera y habia
    // que inventarle un nombre distinto, que es peor que el problema que el chequeo evita.
    const yaEsta = (await leerIndice(archivo, anio))
        .filter((f) => !String(f.estado ?? '').startsWith('reabierta'))
        .some((f) => f.tarea === tarea);
    if (yaEsta) { bad(`"${tarea}" ya figura en el listado.`); return 1; }

    const antes = medir(origen);
    if (dryRun) {
        say(`${c.y}DRY-RUN${c.x} — no se toca nada.`);
        say(`  mover    ${nombre}   ${c.d}(${antes.archivos} archivo(s), ${(antes.bytes / 1024).toFixed(0)} KB)${c.x}`);
        say(`  a        ${anio}\\${tarea}${esDir ? '' : `\\${base}`}`);
        say(`  listado  ${cerrada} · ${quien} · ${que} · ${donde}`);
        return 0;
    }

    fs.mkdirSync(carpetaAnio(archivo, anio), { recursive: true });
    try {
        if (esDir) fs.renameSync(origen, destino);
        else { fs.mkdirSync(destino, { recursive: true }); fs.renameSync(origen, path.join(destino, base)); }
    } catch (e) {
        bad(`No se pudo mover "${nombre}": ${e.message}`);
        say(`${c.d}Nada quedo a medias: el origen sigue en su lugar. No borro nada para reintentar.${c.x}`);
        return 1;
    }

    // Verificar que el movimiento no perdio archivos (OneDrive con Files On-Demand puede morder).
    const despues = medir(destino);
    if (despues.archivos !== antes.archivos || despues.bytes !== antes.bytes) {
        bad(`El movimiento no cierra: antes ${antes.archivos} archivo(s)/${antes.bytes} bytes, ahora ${despues.archivos}/${despues.bytes}.`);
        say(`${c.d}La carpeta esta en ${destino} — revisala a mano antes de seguir.${c.x}`);
        return 1;
    }

    const filas = await leerIndice(archivo, anio);
    filas.push({ cerrada, tarea, quien, que, donde, estado: 'cerrada' });
    filas.sort((a, b) => String(a.cerrada).localeCompare(String(b.cerrada)));
    await escribirIndice(archivo, anio, filas);
    ok(`Archivada en ${anio}\\${tarea}  ${c.d}(${despues.archivos} archivo(s) verificados)${c.x}`);
    return cmdCheck(archivo, escritorio);
}

/**
 * Saca UNA carpeta que quedo COMPLETAMENTE vacia despues de archivar.
 *
 * "Nada se borra" es sobre DATOS: una carpeta sin un solo archivo adentro no es un dato, es
 * un cartel vacio. Pero hay que decirle CUAL: la primera version barria todas las vacias del
 * Escritorio y se llevo puesta una carpeta que Fak acababa de crear para llenar
 * (2026-07-31). Vacia o no, era suya y no la habia pedido tocar. Un comando de limpieza que
 * decide solo el alcance es peligroso aunque cada borrado individual sea seguro.
 *
 * Doble red: se chequea que este vacia y ademas se usa rmdir, que falla si tiene algo.
 */
function cmdLimpiarVacia(escritorio, { nombre, dryRun }) {
    const ruta = path.join(escritorio, nombre);
    if (!fs.existsSync(ruta)) { bad(`No existe "${nombre}"`); return 1; }
    if (!fs.statSync(ruta).isDirectory()) { bad(`"${nombre}" no es una carpeta`); return 1; }

    const adentro = listar(ruta);
    if (adentro.length > 0) {
        bad(`"${nombre}" NO esta vacia: tiene ${adentro.length} cosa(s) adentro. No la toco.`);
        say(`${c.d}Si esta terminada, va por --archivar. Nada se borra con contenido adentro.${c.x}`);
        return 1;
    }
    if (dryRun) { say(`${c.y}DRY-RUN${c.x}  sacaria la carpeta vacia "${nombre}"`); return 0; }
    try { fs.rmdirSync(ruta); ok(`Sacada la carpeta vacia "${nombre}"`); } catch (e) {
        bad(`No la pude sacar: ${e.message}`); return 1;
    }
    return 0;
}

/**
 * --reabrir: la tarea vuelve a la COLA.
 *
 * La carpeta se MUEVE, no se copia: dos copias de la misma tarea en dos lugares es el problema,
 * no la solucion (regla `escritorio-tareas.md` §2). La fila del listado queda marcada
 * `reabierta AAAA-MM-DD` y NO se borra: es la historia de que estuvo cerrada (§4).
 *
 * Verifica el movimiento y corre el `--check` al final, igual que --archivar. No lo hacia, y el
 * 11/09/2026 se vio por que hace falta: el 08/09 esta tarea se reabrio bien (el script dijo
 * "Reabierta"), y el 10/09 a las 23:58:35Z la carpeta REAPARECIO en el archivo con el contenido
 * viejo del 03/09 — el mismo segundo en que se tocaron las 72 carpetas del año, o sea una pasada
 * sobre el arbol entero y no un comando sobre esa carpeta. Quedo dos dias en los dos lados sin
 * que nadie se enterara, y el aviso que al final salio mandaba a buscar una fila que estaba.
 *
 * `--como` deja elegir con que nombre vuelve. Es para exactamente ese caso: la carpeta viva ya
 * ocupa el nombre en la cola, y la que hay que sacar del archivo es la copia que quedo atras.
 */
async function cmdReabrir(escritorio, archivo, { nombre, como, dryRun }) {
    const hoy = fechaLocal();
    let renombre = null;
    if (como !== null && como !== undefined) {
        renombre = typeof como === 'string' ? como.trim() : '';
        if (!renombre || renombre !== path.basename(renombre) || renombre === '.' || renombre === '..') {
            bad('--como tiene que ser un NOMBRE de carpeta, no una ruta ni vacio.');
            return 1;
        }
    }

    for (const anio of listar(archivo).filter((e) => e.dir && /^\d{4}$/.test(e.nombre)).map((e) => e.nombre)) {
        const actual = path.join(carpetaAnio(archivo, anio), nombre);
        if (!fs.existsSync(actual)) continue;
        const vuelta = renombre ?? despojarFecha(nombre);
        const destino = path.join(escritorio, vuelta);
        if (fs.existsSync(destino)) {
            bad(`Ya hay algo llamado "${vuelta}" en el Escritorio.`);
            say(`${c.d}Si esa es la carpeta viva y esta del archivo es una copia, sacala con otro nombre:${c.x}`);
            say(`${c.d}  --reabrir "${nombre}" --como "_${vuelta} (copia que volvio del archivo)"${c.x}`);
            return 1;
        }
        // La bandeja tambien es la cola: una tarea guardada ahi sigue ABIERTA (§0). Si no se
        // mira, reabrir la deja duplicada — la misma tarea en la raiz y adentro de _EN ESPERA.
        const bandeja = listar(escritorio).find((e) => clasificarEntrada(e.nombre, e.dir) === 'espera');
        if (bandeja && fs.existsSync(path.join(bandeja.ruta, vuelta))) {
            bad(`"${vuelta}" ya esta abierta adentro de ${CARPETA_EN_ESPERA}: sacala de la bandeja, o traela con otro nombre (--como).`);
            return 1;
        }

        const antes = medir(actual);
        if (dryRun) {
            // El dry-run LEE el listado en vez de anunciar lo que suele pasar: si la tarea ya
            // venia reabierta, ninguna fila se marca y decir que si es prometer de mas.
            const marcables = (await leerIndice(archivo, anio))
                .filter((f) => f.tarea === nombre && !String(f.estado).startsWith('reabierta')).length;
            say(`${c.y}DRY-RUN${c.x} — no se toca nada.`);
            say(`  mover    ${anio}\\${nombre}   ${c.d}(${antes.archivos} archivo(s), ${(antes.bytes / 1024).toFixed(0)} KB)${c.x}`);
            say(`  a        Escritorio\\${vuelta}`);
            say(marcables
                ? `  listado  ${marcables} fila(s) quedan marcadas "reabierta ${hoy}" (no se borra ninguna)`
                : `  listado  sin cambios: la(s) fila(s) de esta tarea ya dicen "reabierta"`);
            return 0;
        }
        try {
            fs.renameSync(actual, destino);
        } catch (e) {
            bad(`No se pudo mover "${nombre}": ${e.message}`);
            say(`${c.d}Nada quedo a medias: la carpeta sigue en el archivo y el listado sin tocar.${c.x}`);
            return 1;
        }

        // La fila se marca SIEMPRE que la carpeta se haya movido, aunque el conteo no cierre:
        // dejarla en "cerrada" con la carpeta afuera es una mentira peor que el desvio, y es la
        // que despues hace saltar "el INDICE nombra X pero esa carpeta no esta en el archivo".
        const filas = (await leerIndice(archivo, anio)).map((f) => (f.tarea === nombre && !String(f.estado).startsWith('reabierta')
            ? { ...f, estado: `reabierta ${hoy}` } : f));
        await escribirIndice(archivo, anio, filas);

        const despues = medir(destino);
        if (despues.archivos !== antes.archivos || despues.bytes !== antes.bytes) {
            bad(`El movimiento no cierra: antes ${antes.archivos} archivo(s)/${antes.bytes} bytes, ahora ${despues.archivos}/${despues.bytes}.`);
            say(`${c.d}La carpeta esta en ${destino} y la fila quedo "reabierta ${hoy}" — revisala a mano antes de seguir.${c.x}`);
            return 1;
        }
        ok(`Reabierta: vuelve al Escritorio como "${vuelta}"  ${c.d}(${despues.archivos} archivo(s) verificados)${c.x}`);
        say(`${c.d}   La fila queda como historia. Si la carpeta reaparece en el archivo, el --check de abajo lo canta.${c.x}`);
        return cmdCheck(archivo, escritorio);
    }
    bad(`No encontre "${nombre}" en el archivo.`);
    return 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

async function main(argv) {
    const args = argv.slice(2);
    const flag = (n, def = null) => {
        const i = args.indexOf(n);
        return i === -1 ? def : args[i + 1] ?? true;
    };
    const escritorio = String(flag('--escritorio', ESCRITORIO_DEFAULT));
    const archivo = String(flag('--archivo', ARCHIVO_DEFAULT));
    const dryRun = args.includes('--dry-run');
    const comun = { cerrada: flag('--cerrada'), quien: flag('--quien'), que: flag('--que'), donde: flag('--donde'), dryRun };

    if (!fs.existsSync(escritorio)) { bad(`No existe el Escritorio: ${escritorio}`); return 1; }

    if (args.includes('--archivar')) return cmdArchivar(escritorio, archivo, { nombre: String(flag('--archivar')), ...comun });
    if (args.includes('--reabrir')) {
        return cmdReabrir(escritorio, archivo, {
            nombre: String(flag('--reabrir')),
            como: args.includes('--como') ? flag('--como') : null,
            dryRun,
        });
    }
    if (args.includes('--limpiar-vacia')) return cmdLimpiarVacia(escritorio, { nombre: String(flag('--limpiar-vacia')), dryRun });
    if (args.includes('--check')) return cmdCheck(archivo, escritorio);
    return cmdRelevar(escritorio, archivo);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
    main(process.argv).then((n) => process.exit(n > 0 ? 1 : 0));
}
