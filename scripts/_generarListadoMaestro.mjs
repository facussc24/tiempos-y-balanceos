/**
 * _generarListadoMaestro.mjs — Regenera el Listado Maestro de AMFEs (Excel del SGC)
 * desde el catalogo amfe_registry.
 *
 * Regenera SOLO las hojas "Listado AMFE" e "Historial de Revisiones" del archivo
 * Listado_Maestro_AMFE.xlsx, preservando intactas las demas hojas (Listas, Guia,
 * Contexto, Contexto interno). Por eso usa xlsx-populate abriendo el archivo real
 * como template — NUNCA SheetJS write completo (destruiria tablas, validaciones
 * y hojas de contexto).
 *
 * Estructura del template real (inspeccionado 2026-07-03):
 *   - Hoja "Listado AMFE": tabla Excel `Tabla_ListadoAMFE` ref B6:Q406.
 *     Headers en fila 6 (B..Q). Datos desde fila 7.
 *     Col P "Proxima revision planificada" y col Q "Dias a proxima" son FORMULAS
 *     con referencias estructuradas ([#This Row]) presentes en TODAS las filas de
 *     la tabla — no se tocan al limpiar, y se replican si se agregan filas.
 *     Fechas como serial Excel con formato mm-dd-yy.
 *   - Hoja "Historial de Revisiones": tabla Excel `Tabla_Historial` ref B5:H605.
 *     Headers en fila 5 (B..H): ID AMFE | Revision | Fecha | Descripcion del
 *     cambio | Solicitante | Aprobador | Vinculado a Control Plan / Doc.
 *
 * Fuente de datos (en orden):
 *   --dump <registry_dump.json>  array de filas de amfe_registry (snake_case)
 *   (sin --dump) Supabase via connectSupabase() de _lib/amfeIo.mjs — requiere
 *   .env.local; en PCs sin credenciales usar --dump.
 *
 * Salida:
 *   default      → PREVIEW local reports/Listado_Maestro_AMFE_preview.xlsx
 *   --publicar   → escribe el archivo REAL en Y:, PREVIO backup timestamped
 *                  Listado_Maestro_AMFE_backup_<yyyyMMdd_HHmmss>.xlsx en la misma carpeta.
 *
 * Uso:
 *   node scripts/_generarListadoMaestro.mjs --dump reports/registry_dump_ejemplo.json
 *   node scripts/_generarListadoMaestro.mjs                    # Supabase → preview
 *   node scripts/_generarListadoMaestro.mjs --publicar         # Supabase → archivo real
 *
 * La logica principal se exporta como regenerarListadoMaestro(opts) para reuso
 * desde el futuro script de oficializacion.
 */

import XlsxPopulate from 'xlsx-populate';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { ARCHIVO_LISTADO_MAESTRO, RUTA_LISTADO } from './_lib/serverPaths.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PREVIEW_DEFAULT = join(REPO_ROOT, 'reports', 'Listado_Maestro_AMFE_preview.xlsx');

/** Fin de la tabla Tabla_Historial (ref B5:H605 observada 2026-07-03). Solo para advertir overflow. */
const HISTORIAL_TABLE_END_ROW = 605;

// ─── Mapeos registry → template ─────────────────────────────────────────────

/** tipo del registry → etiqueta valida de la hoja Listas del template. */
const TIPO_LABEL = {
    proceso: 'Proceso (PFMEA)',
    // Los maestros SON PFMEAs (el codigo alfanumerico ya los distingue); la hoja
    // Listas no tiene categoria "Maestro", asi que van como Proceso (PFMEA).
    maestro: 'Proceso (PFMEA)',
    diseno: 'Diseño (DFMEA)',
};

/** estado del registry (sin acento, CHECK de la migracion 006) → etiqueta del template. */
const ESTADO_LABEL = {
    'Borrador': 'Borrador',
    'En revision': 'En revisión',
    'Liberado': 'Liberado',
    'Obsoleto': 'Obsoleto',
};

const FORMATO_FECHA = 'mm-dd-yy';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Normaliza texto para comparar headers (sin acentos, lowercase, espacios colapsados). */
function norm(s) {
    return String(s ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/** ISO "YYYY-MM-DD" → serial Excel (fecha local, sin hora). undefined si no parsea. */
function isoToSerial(iso) {
    const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return undefined;
    return XlsxPopulate.dateToNumber(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** Codigos numericos primero (orden numerico ascendente), despues maestros/alfanumericos. */
function compareAmfeCodes(a, b) {
    const na = Number(a);
    const nb = Number(b);
    const aNum = Number.isFinite(na) && String(a).trim() !== '';
    const bNum = Number.isFinite(nb) && String(b).trim() !== '';
    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    return String(a).localeCompare(String(b));
}

/** ID AMFE se escribe como numero si es numerico (asi lo guarda el template). */
function idComoCelda(amfeCode) {
    const n = Number(amfeCode);
    return Number.isFinite(n) && String(amfeCode).trim() !== '' ? n : String(amfeCode);
}

/** Valor de texto: undefined si viene vacio (deja la celda limpia). */
function texto(v) {
    const s = String(v ?? '').trim();
    return s === '' ? undefined : s;
}

/** Parsea la columna historial (TEXT JSON en la tabla; tolera array ya parseado). */
function parseHistorial(raw) {
    if (Array.isArray(raw)) return raw;
    try {
        const parsed = JSON.parse(raw ?? '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/**
 * Busca la fila de headers (celda "ID AMFE") y arma el mapa header normalizado → columna.
 * @returns {{ headerRow: number, cols: Map<string, number> }}
 */
function mapearHeaders(sheet, endCol) {
    for (let r = 1; r <= 15; r++) {
        for (let c = 1; c <= endCol; c++) {
            if (norm(sheet.cell(r, c).value()) === 'id amfe') {
                const cols = new Map();
                for (let cc = 1; cc <= endCol; cc++) {
                    const h = norm(sheet.cell(r, cc).value());
                    if (h) cols.set(h, cc);
                }
                return { headerRow: r, cols };
            }
        }
    }
    throw new Error(`No se encontro la fila de headers (celda "ID AMFE") en la hoja "${sheet.name()}"`);
}

// ─── Carga de datos ─────────────────────────────────────────────────────────

/**
 * Carga las filas de amfe_registry (snake_case) desde un dump JSON o Supabase.
 * @param {{ dump?: string }} opts
 * @returns {Promise<Array<object>>}
 */
async function cargarFilasRegistry({ dump } = {}) {
    if (dump) {
        const raw = JSON.parse(readFileSync(resolve(dump), 'utf8'));
        const filas = Array.isArray(raw) ? raw : raw.rows;
        if (!Array.isArray(filas)) {
            throw new Error(`El dump ${dump} no es un array de filas de amfe_registry (ni tiene .rows)`);
        }
        return filas;
    }
    let connectSupabase;
    try {
        ({ connectSupabase } = await import('./_lib/amfeIo.mjs'));
    } catch (err) {
        throw new Error(`No se pudo cargar _lib/amfeIo.mjs: ${err.message}`);
    }
    let sb;
    try {
        sb = await connectSupabase();
    } catch (err) {
        throw new Error(
            'Sin conexion a Supabase (¿falta .env.local en esta PC?). ' +
            `Usa --dump <registry_dump.json> con las filas de amfe_registry. Detalle: ${err.message}`,
        );
    }
    const { data, error } = await sb.from('amfe_registry').select('*');
    if (error) throw new Error(`Error leyendo amfe_registry: ${error.message}`);
    return data ?? [];
}

// ─── Regenerado de hojas ────────────────────────────────────────────────────

/**
 * Limpia las filas de datos existentes de una hoja (valores, no formulas) y
 * devuelve info util del template.
 * @returns {{ headerRow: number, cols: Map<string,number>, usedEndRow: number,
 *             formulaCols: Map<number, string>, lastFormulaRow: number }}
 */
function prepararHoja(sheet) {
    const used = sheet.usedRange();
    const usedEndRow = used.endCell().rowNumber();
    const usedEndCol = used.endCell().columnNumber();
    const { headerRow, cols } = mapearHeaders(sheet, usedEndCol);

    // Detectar columnas de formula en la primera fila de datos del template
    // (ej: "Proxima revision planificada" y "Dias a proxima" en Listado AMFE).
    const formulaCols = new Map();
    for (const c of cols.values()) {
        const f = sheet.cell(headerRow + 1, c).formula();
        if (f) formulaCols.set(c, f === 'SHARED' ? undefined : f);
    }

    // Hasta que fila llegan las formulas (= fin de la tabla Excel en la practica).
    let lastFormulaRow = headerRow;
    const [primeraColFormula] = formulaCols.keys();
    if (primeraColFormula) {
        for (let r = usedEndRow; r > headerRow; r--) {
            if (sheet.cell(r, primeraColFormula).formula()) { lastFormulaRow = r; break; }
        }
    }

    // Limpiar SOLO valores de las columnas mapeadas sin formula, en todo el rango usado.
    for (let r = headerRow + 1; r <= usedEndRow; r++) {
        for (const c of cols.values()) {
            if (!formulaCols.has(c)) sheet.cell(r, c).clear();
        }
    }

    return { headerRow, cols, usedEndRow, formulaCols, lastFormulaRow };
}

/** Escribe un valor en la celda (si no viene vacio) con formato opcional. */
function setCelda(sheet, r, c, valor, numberFormat) {
    if (valor === undefined) return;
    const cell = sheet.cell(r, c);
    cell.value(valor);
    if (numberFormat) cell.style('numberFormat', numberFormat);
}

/**
 * Regenera la hoja "Listado AMFE": una fila por entrada del catalogo.
 * @returns {{ filas: number, advertencias: string[] }}
 */
function regenerarHojaListado(sheet, filas) {
    const advertencias = [];
    const { headerRow, cols, formulaCols, lastFormulaRow } = prepararHoja(sheet);
    const col = (h) => {
        const c = cols.get(norm(h));
        if (!c) advertencias.push(`Hoja "Listado AMFE": no existe la columna "${h}" en el template`);
        return c;
    };

    const cId = col('ID AMFE');
    const cTipo = col('Tipo AMFE');
    const cProducto = col('Producto / Componente');
    const cPn = col('Código de pieza (PN)');
    const cCliente = col('Cliente');
    const cProyecto = col('Proyecto');
    const cPlanta = col('Planta / Proceso / Línea');
    const cUbicacion = col('Ubicación / Link (archivo)');
    const cEstado = col('Estado');
    const cPropietario = col('Propietario / Responsable');
    const cEquipo = col('Equipo / Contactos');
    const cFechaCreacion = col('Fecha de creación');
    const cRev = col('Revisión actual');
    const cFechaUltRev = col('Fecha de revisión (última)');
    const cProxima = col('Próxima revisión planificada');
    const cDias = col('Días a próxima');

    const ordenadas = [...filas].sort((a, b) => compareAmfeCodes(a.amfe_code, b.amfe_code));

    ordenadas.forEach((fila, i) => {
        const r = headerRow + 1 + i;
        setCelda(sheet, r, cId, idComoCelda(fila.amfe_code));
        setCelda(sheet, r, cTipo, TIPO_LABEL[fila.tipo] ?? texto(fila.tipo));
        setCelda(sheet, r, cProducto, texto(fila.producto));
        setCelda(sheet, r, cPn, texto(fila.part_number));
        setCelda(sheet, r, cCliente, texto(fila.cliente));
        setCelda(sheet, r, cProyecto, texto(fila.proyecto));
        setCelda(sheet, r, cPlanta, texto(fila.planta));
        setCelda(sheet, r, cUbicacion, texto(fila.server_path));
        setCelda(sheet, r, cEstado, ESTADO_LABEL[fila.estado] ?? texto(fila.estado));
        setCelda(sheet, r, cPropietario, texto(fila.propietario));
        setCelda(sheet, r, cEquipo, texto(fila.equipo));
        setCelda(sheet, r, cFechaCreacion, isoToSerial(fila.fecha_creacion) ?? texto(fila.fecha_creacion), FORMATO_FECHA);
        setCelda(sheet, r, cRev, texto(fila.rev_actual));
        setCelda(sheet, r, cFechaUltRev, isoToSerial(fila.fecha_ultima_rev) ?? texto(fila.fecha_ultima_rev), FORMATO_FECHA);

        if (r <= lastFormulaRow) {
            // Dentro de la tabla: las formulas de "Proxima revision" y "Dias a proxima"
            // ya estan en la fila del template — no tocarlas.
        } else {
            // Fuera del rango de la tabla: las referencias estructuradas no funcionarian.
            // Escribir valores calculados y avisar.
            advertencias.push(
                `Fila ${r} (AMFE ${fila.amfe_code}) queda FUERA de la tabla Tabla_ListadoAMFE ` +
                '(sin formato de tabla ni formulas). Extender la tabla a mano en Excel.',
            );
            const serialUlt = isoToSerial(fila.fecha_ultima_rev);
            const proxima = isoToSerial(fila.proxima_revision) ?? (serialUlt !== undefined ? serialUlt + 365 : undefined);
            setCelda(sheet, r, cProxima, proxima, FORMATO_FECHA);
            if (proxima !== undefined) {
                setCelda(sheet, r, cDias, proxima - XlsxPopulate.dateToNumber(new Date()));
            }
        }
    });

    // Si sobraron filas nuevas mas alla del template, ya se aviso arriba;
    // si la columna de formula existia pero alguna fila del medio la perdio, reponerla.
    const formulaProxima = cProxima ? formulaCols.get(cProxima) : undefined;
    const formulaDias = cDias ? formulaCols.get(cDias) : undefined;
    for (let i = 0; i < ordenadas.length; i++) {
        const r = headerRow + 1 + i;
        if (r > lastFormulaRow) break;
        if (formulaProxima && !sheet.cell(r, cProxima).formula()) sheet.cell(r, cProxima).formula(formulaProxima);
        if (formulaDias && !sheet.cell(r, cDias).formula()) sheet.cell(r, cDias).formula(formulaDias);
    }

    return { filas: ordenadas.length, advertencias };
}

/**
 * Regenera la hoja "Historial de Revisiones": una fila por entrada de historial
 * de cada AMFE del catalogo.
 * @returns {{ filas: number, advertencias: string[] }}
 */
function regenerarHojaHistorial(sheet, filas) {
    const advertencias = [];
    const { headerRow, cols } = prepararHoja(sheet);
    const col = (h) => {
        const c = cols.get(norm(h));
        if (!c) advertencias.push(`Hoja "Historial de Revisiones": no existe la columna "${h}" en el template`);
        return c;
    };

    const cId = col('ID AMFE');
    const cRev = col('Revisión');
    const cFecha = col('Fecha');
    const cDesc = col('Descripción del cambio');
    const cSolicitante = col('Solicitante');
    const cAprobador = col('Aprobador');
    const cVinculo = col('Vinculado a Control Plan / Doc');

    // Aplanar: una fila por entrada de historial, con su amfe_code.
    const entradas = [];
    for (const fila of filas) {
        for (const h of parseHistorial(fila.historial)) {
            entradas.push({ amfeCode: fila.amfe_code, ...h });
        }
    }
    entradas.sort((a, b) =>
        compareAmfeCodes(a.amfeCode, b.amfeCode) ||
        String(a.date ?? '').localeCompare(String(b.date ?? '')) ||
        String(a.rev ?? '').localeCompare(String(b.rev ?? '')),
    );

    entradas.forEach((e, i) => {
        const r = headerRow + 1 + i;
        if (r > HISTORIAL_TABLE_END_ROW) {
            advertencias.push(
                `Fila ${r} de historial (AMFE ${e.amfeCode}) queda FUERA de la tabla Tabla_Historial ` +
                `(ref hasta fila ${HISTORIAL_TABLE_END_ROW}). Extender la tabla a mano en Excel.`,
            );
        }
        setCelda(sheet, r, cId, idComoCelda(e.amfeCode));
        setCelda(sheet, r, cRev, texto(e.rev));
        setCelda(sheet, r, cFecha, isoToSerial(e.date) ?? texto(e.date), FORMATO_FECHA);
        setCelda(sheet, r, cDesc, texto(e.description));
        setCelda(sheet, r, cSolicitante, texto(e.solicitante));
        setCelda(sheet, r, cAprobador, texto(e.aprobador));
        setCelda(sheet, r, cVinculo, texto(e.vinculo));
    });

    return { filas: entradas.length, advertencias };
}

// ─── Logica principal (exportada para reuso) ────────────────────────────────

/**
 * Regenera el Listado Maestro de AMFEs desde el catalogo amfe_registry.
 *
 * @param {object} [opts]
 * @param {string} [opts.dump]      Path a un JSON con las filas de amfe_registry (snake_case).
 *                                  Sin dump: intenta Supabase via .env.local.
 * @param {boolean} [opts.publicar] true = escribe el archivo REAL en Y: (previo backup).
 *                                  false (default) = escribe un preview local en reports/.
 * @param {string} [opts.template]  Path al xlsx template (default: archivo real en Y:).
 * @param {string} [opts.salida]    Path del preview (default: reports/Listado_Maestro_AMFE_preview.xlsx).
 * @param {(msg: string) => void} [opts.log]  Logger (default console.log).
 * @returns {Promise<{ salida: string, backup: string|null, filasListado: number,
 *                     filasHistorial: number, advertencias: string[] }>}
 */
export async function regenerarListadoMaestro(opts = {}) {
    const {
        dump,
        publicar = false,
        template = ARCHIVO_LISTADO_MAESTRO,
        salida = PREVIEW_DEFAULT,
        log = console.log,
    } = opts;

    log(`Fuente de datos: ${dump ? `dump ${dump}` : 'Supabase (amfe_registry)'}`);
    const filas = await cargarFilasRegistry({ dump });
    log(`Catalogo: ${filas.length} AMFEs`);

    if (!existsSync(template)) {
        throw new Error(`No se encuentra el template: ${template} (¿unidad Y: desconectada?)`);
    }
    const wb = await XlsxPopulate.fromFileAsync(template);
    const hojasAntes = wb.sheets().map(s => s.name());

    const hojaListado = wb.sheet('Listado AMFE');
    const hojaHistorial = wb.sheet('Historial de Revisiones');
    if (!hojaListado || !hojaHistorial) {
        throw new Error(
            `El template no tiene las hojas esperadas ("Listado AMFE", "Historial de Revisiones"). Hojas: ${hojasAntes.join(', ')}`,
        );
    }

    const resListado = regenerarHojaListado(hojaListado, filas);
    const resHistorial = regenerarHojaHistorial(hojaHistorial, filas);
    const advertencias = [...resListado.advertencias, ...resHistorial.advertencias];

    let destino = salida;
    let backup = null;
    if (publicar) {
        // Backup timestamped del archivo real ANTES de pisarlo.
        const ts = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const stamp = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
        backup = join(RUTA_LISTADO, `Listado_Maestro_AMFE_backup_${stamp}.xlsx`);
        copyFileSync(ARCHIVO_LISTADO_MAESTRO, backup);
        log(`Backup creado: ${backup}`);
        destino = ARCHIVO_LISTADO_MAESTRO;
    } else {
        mkdirSync(dirname(destino), { recursive: true });
    }

    try {
        await wb.toFileAsync(destino);
    } catch (err) {
        throw new Error(
            `No se pudo escribir ${destino} (¿archivo abierto en Excel?). Detalle: ${err.message}`,
        );
    }

    log(`${publicar ? 'PUBLICADO' : 'Preview'}: ${destino}`);
    log(`Hoja "Listado AMFE": ${resListado.filas} filas | Hoja "Historial de Revisiones": ${resHistorial.filas} filas`);
    log(`Hojas preservadas: ${hojasAntes.join(', ')}`);
    for (const a of advertencias) log(`ADVERTENCIA: ${a}`);

    return {
        salida: destino,
        backup,
        filasListado: resListado.filas,
        filasHistorial: resHistorial.filas,
        advertencias,
    };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
    const opts = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--dump') opts.dump = argv[++i];
        else if (a === '--publicar') opts.publicar = true;
        else if (a === '--template') opts.template = argv[++i];
        else if (a === '--salida') opts.salida = argv[++i];
        else {
            console.error(`Flag desconocido: ${a}`);
            console.error('Uso: node scripts/_generarListadoMaestro.mjs [--dump <registry_dump.json>] [--publicar] [--template <xlsx>] [--salida <xlsx>]');
            process.exit(1);
        }
    }
    return opts;
}

const esEntryPoint = process.argv[1] &&
    fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (esEntryPoint) {
    try {
        await regenerarListadoMaestro(parseArgs(process.argv.slice(2)));
    } catch (err) {
        console.error(`ERROR: ${err.message}`);
        process.exit(1);
    }
}
