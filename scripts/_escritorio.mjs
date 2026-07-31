#!/usr/bin/env node
/**
 * _escritorio.mjs — la cola de tareas del Escritorio y su archivo.
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
 *   node scripts/_escritorio.mjs                      # relevar + verificar
 *   node scripts/_escritorio.mjs --check              # solo invariantes (exit 1 si rompen)
 *   node scripts/_escritorio.mjs --archivar "<carpeta>" --cerrada AAAA-MM-DD \
 *        --quien "<quien lo pidio>" --que "<que se hizo>" --donde "<donde quedo el entregable>"
 *   node scripts/_escritorio.mjs --reabrir "<carpeta archivada>"
 *   ... + --dry-run  para ver el plan sin tocar nada
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

import { RUTA_ESCRITORIO, RUTA_TAREAS_CERRADAS } from './_lib/serverPaths.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// Configuracion (las rutas viven en _lib/serverPaths.mjs, con el resto)
// ─────────────────────────────────────────────────────────────────────────────

export const ESCRITORIO_DEFAULT = RUTA_ESCRITORIO;
export const ARCHIVO_DEFAULT = RUTA_TAREAS_CERRADAS;

const EXT_FIJAS = new Set(['.lnk', '.url', '.ini', '.exe', '.db']);
const NOMBRES_FIJOS = new Set(['juegos', 'desktop.ini', 'thumbs.db']);
const RELLENO = /^(tbd|n\/?a|-+|\.+|ok|listo|pendiente|varios?|nada|sin datos?)$/i;

export const COLUMNAS = [
    { key: 'cerrada', header: 'Cerrada', width: 12 },
    { key: 'tarea', header: 'Tarea', width: 52 },
    { key: 'quien', header: 'Quién lo pidió', width: 20 },
    { key: 'que', header: 'Qué se hizo', width: 62 },
    { key: 'donde', header: 'Dónde quedó el entregable', width: 62 },
    { key: 'estado', header: 'Estado', width: 18 },
];

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
    if (nombre.startsWith('.')) return 'fijo';
    return 'tarea';
}

/**
 * Invariantes. `estadoFs.archivadas` = carpetas presentes en el año del archivo.
 * Devuelve la lista de problemas (vacia = sano).
 */
export function verificarInvariantes(filas, estadoFs) {
    const problemas = [];
    const archivadas = new Set(estadoFs.archivadas);
    const registradas = new Set();

    for (const f of filas) {
        if (String(f.estado ?? '').startsWith('reabierta')) continue;   // historia, no se chequea
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
        if (!registradas.has(carpeta)) problemas.push(`"${carpeta}" esta archivada pero no tiene fila en el INDICE`);
        if (!/^\d{4}-\d{2}-\d{2} - .+/.test(carpeta)) problemas.push(`"${carpeta}" no arranca con la fecha de cierre (AAAA-MM-DD - nombre)`);
    }
    return problemas;
}

export const diasDesde = (ms, ahora = Date.now()) => Math.floor((ahora - ms) / 86400000);

// ─────────────────────────────────────────────────────────────────────────────
// Filesystem
// ─────────────────────────────────────────────────────────────────────────────

function listar(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).map((d) => {
        const p = path.join(dir, d.name);
        let mtime = 0;
        try { mtime = fs.statSync(p).mtimeMs; } catch { /* OneDrive puede negar el stat */ }
        return { nombre: d.name, dir: d.isDirectory(), ruta: p, mtime };
    });
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

async function leerIndice(archivo, anio) {
    const p = rutaIndice(archivo, anio);
    if (!fs.existsSync(p)) return [];
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
    const entradas = listar(escritorio);
    const tareas = entradas.filter((e) => clasificarEntrada(e.nombre, e.dir) === 'tarea');

    say(`\n${c.b}ESCRITORIO${c.x}  ${escritorio}`);
    say(`${c.d}${tareas.length} cosa(s) abiertas${c.x}\n`);
    for (const t of [...tareas].sort((a, b) => b.mtime - a.mtime)) {
        const d = t.mtime ? diasDesde(t.mtime) : null;
        const edad = d === null ? '   ?' : `${String(d).padStart(3)}d`;
        say(`  ${d !== null && d >= 7 ? c.y : c.d}${edad}${c.x}  ${c.d}${t.dir ? 'carpeta' : 'suelto '}${c.x}  ${t.nombre}`);
    }
    if (tareas.some((t) => t.mtime && diasDesde(t.mtime) >= 7)) {
        say(`\n${c.d}Lo amarillo lleva 7 dias o mas sin tocarse: o esta cerrado sin archivar, o esta${c.x}`);
        say(`${c.d}trabado esperando a alguien. Las dos cosas se resuelven, no se dejan.${c.x}`);
    }

    say(`\n${c.b}ARCHIVO${c.x}  ${archivo}`);
    if (!fs.existsSync(archivo)) { warn('Todavia no existe: se crea con el primer --archivar.'); return 0; }
    for (const anio of listar(archivo).filter((e) => e.dir && /^\d{4}$/.test(e.nombre)).map((e) => e.nombre)) {
        const filas = await leerIndice(archivo, anio);
        say(`  ${anio}: ${filas.length} tarea(s) en el listado`);
        for (const f of filas.slice(-8)) say(`    ${c.d}${f.cerrada}${c.x}  ${f.tarea}`);
    }
    say('');
    return cmdCheck(archivo);
}

async function cmdCheck(archivo) {
    if (!fs.existsSync(archivo)) { warn(`El archivo todavia no existe: ${archivo}`); return 0; }
    const anios = listar(archivo).filter((e) => e.dir && /^\d{4}$/.test(e.nombre)).map((e) => e.nombre);
    if (anios.length === 0) { warn('No hay ningun año en el archivo.'); return 0; }

    let problemas = 0;
    for (const anio of anios) {
        const filas = await leerIndice(archivo, anio);
        const archivadas = listar(carpetaAnio(archivo, anio)).filter((e) => e.dir).map((e) => e.nombre);
        const lista = verificarInvariantes(filas, { archivadas });
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
    if (clasificarEntrada(base, esDir) !== 'tarea') { bad(`"${base}" no es una tarea (acceso directo, archivo de sistema o el archivo de terminadas).`); return 1; }

    const anio = anioDe(cerrada);
    const tarea = nombreCanonico(cerrada, path.parse(base).name);
    const destino = path.join(carpetaAnio(archivo, anio), tarea);
    if (fs.existsSync(destino)) { bad(`Ya existe "${anio}\\${tarea}". Renombrar antes de archivar.`); return 1; }
    if ((await leerIndice(archivo, anio)).some((f) => f.tarea === tarea)) { bad(`"${tarea}" ya figura en el listado.`); return 1; }

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
    return cmdCheck(archivo);
}

async function cmdReabrir(escritorio, archivo, { nombre, dryRun }) {
    const hoy = new Date().toISOString().slice(0, 10);
    for (const anio of listar(archivo).filter((e) => e.dir && /^\d{4}$/.test(e.nombre)).map((e) => e.nombre)) {
        const actual = path.join(carpetaAnio(archivo, anio), nombre);
        if (!fs.existsSync(actual)) continue;
        const vuelta = despojarFecha(nombre);
        const destino = path.join(escritorio, vuelta);
        if (fs.existsSync(destino)) { bad(`Ya hay algo llamado "${vuelta}" en el Escritorio.`); return 1; }

        if (dryRun) {
            say(`${c.y}DRY-RUN${c.x} — no se toca nada.`);
            say(`  mover    ${anio}\\${nombre}  →  Escritorio\\${vuelta}`);
            say(`  listado  la fila queda marcada "reabierta ${hoy}" (no se borra)`);
            return 0;
        }
        fs.renameSync(actual, destino);
        const filas = (await leerIndice(archivo, anio)).map((f) => (f.tarea === nombre && !String(f.estado).startsWith('reabierta')
            ? { ...f, estado: `reabierta ${hoy}` } : f));
        await escribirIndice(archivo, anio, filas);
        ok(`Reabierta: vuelve al Escritorio como "${vuelta}". La fila queda como historia.`);
        return 0;
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
    if (args.includes('--reabrir')) return cmdReabrir(escritorio, archivo, { nombre: String(flag('--reabrir')), dryRun });
    if (args.includes('--check')) return cmdCheck(archivo);
    return cmdRelevar(escritorio, archivo);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
    main(process.argv).then((n) => process.exit(n > 0 ? 1 : 0));
}
