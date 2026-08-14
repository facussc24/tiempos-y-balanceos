/**
 * _entregas.mjs — que se entrego, donde quedo, y si salio.
 *
 * SIN shebang a proposito: `_escritorio.mjs` documenta que el runner de tests no acepta
 * `#!` y el archivo no llegaba ni a cargar. Mismo criterio aca.
 *
 * POR QUE EXISTE (medido el 14/08/2026):
 *   Pasar 2 archivos al pendrive tardo 20 minutos. Ocho de esos veinte fueron BUSCAR donde
 *   habian quedado, leyendo transcripciones de sesiones viejas. No habia registro de que se
 *   entrego ni donde.
 *   Y el mismo dia, revisando 39 carpetas a mano, aparecieron dos entregables terminados que
 *   nunca salieron: la difusion de una tabla de BOM del 07/08 y un patron de corte RevB, listo
 *   desde el 10/08 y nunca enviado a mesa de corte. Ese chequeo tarda 2 segundos si se hace
 *   con las fuentes que YA existen.
 *
 * EL INDICE NO SE ESCRIBE A MANO — SE DERIVA.
 *   Un registro que dependa de que alguien se acuerde de anotar una linea se pudre. Ya paso:
 *   el listado maestro de hojas de proceso sigue diciendo un numero que ya se uso, y unas fichas
 *   se enviaron pero nunca se anotaron. Asi que cada corrida vuelve a cruzar tres fuentes
 *   vivas:
 *     1. Escritorio + `_EN ESPERA`  -> las tareas abiertas y sus archivos
 *     2. TAREAS CERRADAS + su listado Excel -> las cerradas y "donde quedo el entregable"
 *     3. .mail-cache/mails.jsonl    -> si el archivo salio (o entro) adjunto en un mail
 *     4. la biblioteca por tipo     -> si el archivo llego a su carpeta definitiva
 *
 * USO
 *   node scripts/_entregas.mjs                     # tablero: por tarea, lo ultimo, ¿salio?
 *   node scripts/_entregas.mjs --pendientes        # solo lo hecho que NO salio ni se archivo
 *   node scripts/_entregas.mjs --buscar "<pieza>"  # donde quedo lo ultimo de X
 *   node scripts/_entregas.mjs --json              # lo mismo, para otro script
 *
 * Es de SOLO LECTURA: no copia, no mueve, no manda mails. Dice que falta; el mail lo manda Fak.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import {
    RUTA_ESCRITORIO, RUTA_TAREAS_CERRADAS, RUTA_BIBLIOTECA_GENERAL, esRutaObsoleta,
} from './_lib/serverPaths.mjs';
import { CARPETA_EN_ESPERA, esEnEspera, clasificarEntrada, leerIndice, listar, anioDe } from './_escritorio.mjs';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const MAILS_JSONL = path.join(RAIZ, '.mail-cache', 'mails.jsonl');

const c = { r: '\x1b[31m', y: '\x1b[33m', g: '\x1b[32m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' };
const say = (s = '') => console.log(s);

// ─────────────────────────────────────────────────────────────────────────────
// Funciones puras (las ejerce __tests__/scripts/entregas.test.mjs)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lo que cuenta como ENTREGABLE. Un .png de "antes y despues" o un .md de notas son
 * material de trabajo: no se difunden ni se archivan, y si entraran taparian la señal.
 */
export const EXT_ENTREGABLE = new Set([
    '.dxf', '.plt', '.hpgl',                       // patrones de corte
    '.xlsx', '.xlsm', '.xls', '.csv',              // tablas, BOMs, HOs
    '.pdf', '.docx', '.doc', '.pptx',              // documentos
    '.step', '.stp', '.stl', '.igs', '.iges', '.3mf',  // 3D
]);

/**
 * Subcarpetas que son trabajo intermedio, no entrega. `esRutaObsoleta` ya cubre
 * OBSOLETO/OLD; aca se suman las que Fak usa en el Escritorio para apartar lo descartado.
 */
const RE_DESCARTE = /^(roto|backup|copias?|descartad[oa]s?|no va|viejo|previo|fuente|probet)/i;

export function esCarpetaDeTrabajo(nombre) {
    return RE_DESCARTE.test(String(nombre).trim()) || esRutaObsoleta(String(nombre));
}

/**
 * Nombre canonico para comparar contra los adjuntos de un mail. Outlook conserva el nombre
 * tal cual, pero el case y los acentos compuestos de OneDrive (NFD) no siempre coinciden.
 */
export const claveArchivo = (nombre) =>
    String(nombre).normalize('NFC').toLowerCase().trim();

/**
 * De un grupo de entregables, EL QUE IMPORTA es el ultimo.
 * Empata por mtime -> gana el nombre mayor, para que sea determinista.
 */
export function ultimoEntregable(archivos) {
    let mejor = null;
    for (const a of archivos) {
        if (!mejor) { mejor = a; continue; }
        if (a.mtime > mejor.mtime) mejor = a;
        else if (a.mtime === mejor.mtime && a.nombre > mejor.nombre) mejor = a;
    }
    return mejor;
}

/**
 * Tokens que marcan una VERSION del mismo documento, no un documento distinto.
 * El ORDEN importa: los que dependen de la puntuacion (decimales, fechas con guion,
 * parentesis) tienen que salir ANTES de que los separadores se colapsen a espacio.
 */
const VERSION_CON_PUNTUACION = [
    /\d+[,.]\d+/g,                            // 0,55  ·  antes de tocar la coma
    /\d{1,2}[-_.]\d{1,2}[-_.]\d{2,4}/g,       // 06-08-2026
    /\(\s*\d+\s*\)/g,                         // (004)
];
const VERSION_POR_PALABRA = [
    /\b\d{8}\b/g,                             // 20260807
    /\bv\s?\d+\s?[a-z]?\b/g,                  // v10, v3A, v2 B
    /\brev\s?[a-z0-9]+\b/g,                   // RevB, Rev 3
    /\bpaso\s?\d+\b/g,                        // PASO 2
    /\bcopia\b/g,
];

/**
 * La FAMILIA de un entregable: su nombre sin los tokens de version.
 *
 * Por que no alcanza con "el ultimo de la tarea" (aprendido el 14/08/2026): una carpeta de
 * BOMs y pesajes tenia CUATRO PDF distintos, uno por linea de producto, cada uno con su
 * propia difusion. Quedarse con el mas nuevo tapaba a los otros tres — y el que nunca salio
 * era justamente uno de los tapados.
 * Una version se llama igual que su anterior salvo el token; un documento distinto se llama
 * distinto.
 */
export function familiaEntregable(nombre) {
    let s = String(nombre).normalize('NFC').toLowerCase();
    const ext = path.extname(s);
    s = s.slice(0, s.length - ext.length);
    for (const re of VERSION_CON_PUNTUACION) s = s.replace(re, ' ');
    // Recien ahora se colapsan los separadores: sin esto "base_v2a" no tiene limite de
    // palabra entre "_" y "v" (el guion bajo es caracter de palabra) y \bv\d+\b no matchea.
    s = s.replace(/[^a-z0-9áéíóúñü]+/g, ' ');
    for (const re of VERSION_POR_PALABRA) s = s.replace(re, ' ');
    s = s.trim().replace(/\s+/g, ' ');
    return `${s}${ext}`;
}

/** Un representante por familia: el mas nuevo de cada documento distinto. */
export function porFamilia(archivos) {
    const grupos = new Map();
    for (const a of archivos) {
        const k = familiaEntregable(a.nombre);
        (grupos.get(k) ?? grupos.set(k, []).get(k)).push(a);
    }
    return [...grupos.values()].map(ultimoEntregable);
}

/**
 * El estado de UN entregable. Los dos motivos por los que una tarea no cierra (triage del
 * 03/08: 30 carpetas, las 30 caian en uno de estos dos) son justamente estas dos columnas.
 *
 * `recibido` mata el falso positivo mas obvio: un plano que mando el cliente aparece en la
 * carpeta de la tarea igual que un entregable, pero no tiene por que salir de Barack — ya
 * llego. Sin esa distincion, cada plano recibido se reporta como pendiente.
 */
export function estadoEntregable({ enviado, recibido, enBiblioteca }) {
    if (recibido && !enviado) return { estado: 'recibido', pendiente: false };
    if (enviado && enBiblioteca) return { estado: 'entregado', pendiente: false };
    if (enviado) return { estado: 'enviado', pendiente: false };
    if (enBiblioteca) return { estado: 'archivado', pendiente: false };
    return { estado: 'SIN SALIR', pendiente: true };
}

export const fmtFecha = (ms) => (ms > 0 ? new Date(ms).toISOString().slice(0, 10) : '—');

/** Corta a lo ancho sin romper la tabla, con puntos suspensivos si no entra. */
export const cortar = (s, n) => {
    const t = String(s ?? '');
    return t.length <= n ? t.padEnd(n) : `${t.slice(0, n - 1)}…`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Fuentes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Indice de adjuntos del cache de mails, separando ENVIADOS de RECIBIDOS.
 * Se lee por streaming: el .jsonl pesa 20 MB y no hace falta tenerlo entero en memoria.
 * Devuelve Map<claveArchivo, {enviado, recibido, fecha, asunto}>.
 */
export async function indexarAdjuntos(jsonl = MAILS_JSONL) {
    const idx = new Map();
    if (!fs.existsSync(jsonl)) return idx;
    const rl = readline.createInterface({ input: fs.createReadStream(jsonl, 'utf8'), crlfDelay: Infinity });
    for await (const linea of rl) {
        if (!linea.trim()) continue;
        let m;
        try { m = JSON.parse(linea); } catch { continue; }
        const carpeta = String(m.carpeta ?? '').toLowerCase();
        // "Elementos enviados" es la unica prueba de que salio. Borradores NO cuenta:
        // un mail escrito y no mandado es exactamente el caso que estamos buscando.
        const salio = carpeta.includes('enviado');
        const entro = carpeta.includes('entrada');
        if (!salio && !entro) continue;
        for (const adj of m.adjuntos ?? []) {
            const k = claveArchivo(adj);
            if (!k) continue;
            const prev = idx.get(k) ?? { enviado: false, recibido: false, fecha: '', asunto: '' };
            if (salio) prev.enviado = true;
            if (entro) prev.recibido = true;
            if (String(m.fecha ?? '') > prev.fecha) { prev.fecha = String(m.fecha ?? ''); prev.asunto = String(m.asunto ?? ''); }
            idx.set(k, prev);
        }
    }
    return idx;
}

/**
 * Nombres de archivo que ya viven en la biblioteca por tipo — la otra mitad de "esta
 * cerrada". La lista de carpetas se lee del disco: el arbol real manda sobre cualquier
 * lista que yo escriba y que envejezca.
 * Devuelve Map<claveArchivo, rutaRelativa>.
 */
export function indexarBiblioteca(raiz = RUTA_BIBLIOTECA_GENERAL, { profundidad = 4 } = {}) {
    const idx = new Map();
    if (!fs.existsSync(raiz)) return idx;
    const recorrer = (dir, nivel, rel) => {
        if (nivel > profundidad) return;
        for (const e of listar(dir)) {
            const r = rel ? `${rel}\\${e.nombre}` : e.nombre;
            if (e.dir) { if (!esRutaObsoleta(e.nombre)) recorrer(e.ruta, nivel + 1, r); continue; }
            const k = claveArchivo(e.nombre);
            if (!idx.has(k)) idx.set(k, r);
        }
    };
    recorrer(raiz, 0, '');
    return idx;
}

/**
 * Los entregables de una tarea: SOLO el primer nivel de la carpeta.
 *
 * No es un atajo, es como trabaja Fak — lo terminado queda a mano en la raiz y lo demas se
 * aparta en subcarpetas: versiones descartadas ("ROTO AutoCAD 10-8-26"), pruebas ("PARA QUE
 * GIRE MAS SUAVE", "PASO 3"), fotos, y sobre todo MATERIAL RECIBIDO ("ENVIADO CLIENTE",
 * "PDFS 3DS" con los planos que manda el cliente). Nada de eso es un entregable de Barack.
 *
 * Bajando a las subcarpetas salian 86 pendientes y el aviso no servia; con el primer nivel
 * quedan los que Fak marca a mano. Mismo criterio que `fechasDeTarea()` en `_escritorio.mjs`,
 * que tampoco baja: el dato que importa esta arriba.
 */
export function entregablesDe(dirTarea) {
    if (!fs.existsSync(dirTarea)) return [];
    return listar(dirTarea)
        .filter((e) => !e.dir && EXT_ENTREGABLE.has(path.extname(e.nombre).toLowerCase()))
        .map((e) => ({ nombre: e.nombre, ruta: e.ruta, sub: '', mtime: e.mtime }));
}

/** Las tareas abiertas: las que estan a la vista y las que Fak corrio a `_EN ESPERA`. */
export function tareasAbiertas(escritorio = RUTA_ESCRITORIO) {
    const out = [];
    for (const e of listar(escritorio)) {
        const clase = clasificarEntrada(e.nombre, e.dir);
        if (clase === 'espera') {
            // La bandeja NO es una tarea: adentro sigue todo ABIERTO y se cuenta una por una.
            for (const s of listar(e.ruta)) {
                if (clasificarEntrada(s.nombre, s.dir) === 'tarea' && s.dir) {
                    out.push({ tarea: s.nombre, ruta: s.ruta, donde: CARPETA_EN_ESPERA });
                }
            }
            continue;
        }
        if (clase === 'tarea' && e.dir && !esEnEspera(e.nombre)) {
            out.push({ tarea: e.nombre, ruta: e.ruta, donde: 'Escritorio' });
        }
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// El cruce
// ─────────────────────────────────────────────────────────────────────────────

export async function relevar({ escritorio = RUTA_ESCRITORIO, archivo = RUTA_TAREAS_CERRADAS,
    biblioteca = RUTA_BIBLIOTECA_GENERAL, jsonl = MAILS_JSONL } = {}) {
    const [adjuntos, enBiblio] = [await indexarAdjuntos(jsonl), indexarBiblioteca(biblioteca)];

    /** El estado de UN archivo contra las tres fuentes. */
    const juzgar = (a) => {
        const k = claveArchivo(a.nombre);
        const mail = adjuntos.get(k) ?? { enviado: false, recibido: false, fecha: '', asunto: '' };
        const casa = enBiblio.get(k) ?? null;
        return {
            entregable: a.nombre, sub: a.sub, ruta: a.ruta, mtime: a.mtime, mail, casa,
            ...estadoEntregable({ enviado: mail.enviado, recibido: mail.recibido, enBiblioteca: Boolean(casa) }),
        };
    };

    const filas = [];
    for (const t of tareasAbiertas(escritorio)) {
        const todos = entregablesDe(t.ruta);
        if (!todos.length) { filas.push({ ...t, entregable: null, total: 0, familias: [] }); continue; }
        // Una fila por DOCUMENTO distinto, no una por tarea: si no, el mas nuevo tapa a los
        // otros y un entregable sin difundir pasa desapercibido (el caso del 07/08).
        const familias = porFamilia(todos).map(juzgar).sort((a, b) => b.mtime - a.mtime);
        filas.push({ ...t, ...familias[0], total: todos.length, familias });
    }
    filas.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));

    // Las cerradas aportan el "donde quedo": es texto libre escrito por quien cerro, y es la
    // unica pista que existe de un entregable de hace meses.
    const cerradas = [];
    const anios = fs.existsSync(archivo) ? listar(archivo).filter((e) => e.dir && /^\d{4}$/.test(e.nombre)) : [];
    for (const a of anios) {
        try {
            for (const f of await leerIndice(archivo, a.nombre)) cerradas.push({ ...f, anio: a.nombre });
        } catch (e) { say(`${c.y}⚠${c.x}  no pude leer el listado de ${a.nombre}: ${e.message}`); }
    }
    return { filas, cerradas, adjuntos, enBiblio };
}

// ─────────────────────────────────────────────────────────────────────────────
// Comandos
// ─────────────────────────────────────────────────────────────────────────────

const PINTAR = {
    'SIN SALIR': (s) => `${c.r}${s}${c.x}`,
    archivado: (s) => `${c.y}${s}${c.x}`,
    recibido: (s) => `${c.d}${s}${c.x}`,
    enviado: (s) => `${c.g}${s}${c.x}`,
    entregado: (s) => `${c.g}${s}${c.x}`,
};

/**
 * Cuantos dias hace que un archivo esta quieto. Con OneDrive el mtime puede estar pisado,
 * asi que esto sirve para PRIORIZAR, nunca para afirmar una fecha.
 */
export const diasQuieto = (mtime, ahora = Date.now()) => Math.floor((ahora - mtime) / 86400000);

/**
 * Los documentos pendientes con al menos `dias` de quietud.
 *
 * El umbral no es cosmetico: sin el salen 86 documentos y el aviso no sirve. Casi todos son
 * trabajo EN CURSO — las 12 variantes de un tornillo que se esta probando hoy no son
 * "entregables sin difundir". El criterio que usa Fak cuando releva a mano es exactamente
 * este: "el DXF RevB esta listo DESDE EL 10/08 y no se envio". Lo de hoy todavia no es un
 * pendiente; lo de hace tres dias si.
 */
export const pendientesDe = (filas, { dias = 2, ahora = Date.now() } = {}) => filas.flatMap(
    (f) => (f.familias ?? [])
        .filter((g) => g.pendiente && diasQuieto(g.mtime, ahora) >= dias)
        .map((g) => ({ tarea: f.tarea, donde: f.donde, dias: diasQuieto(g.mtime, ahora), ...g })),
).sort((a, b) => b.dias - a.dias);

function tablero(filas, { soloPendientes = false, dias = 2 } = {}) {
    const conEntregable = filas.filter((f) => f.entregable);
    const sin = pendientesDe(filas, { dias });

    if (soloPendientes) {
        say();
        say(`${c.b}HECHO PERO SIN SALIR${c.x}   ${sin.length} documento(s) quietos hace ${dias}+ dias`);
        say(`${c.d}ni figuran como adjunto de un mail enviado, ni tienen copia en la biblioteca${c.x}`);
        say(`${c.d}(lo de hoy y ayer no entra: eso es trabajo en curso. Ajustar con --dias N)${c.x}`);
        for (const f of sin) {
            say();
            say(`${c.r}✗${c.x}  ${c.b}${f.tarea}${c.x}  ${c.d}(${f.donde})${c.x}`);
            say(`   ${f.entregable}${f.sub ? `   ${c.d}en ${f.sub}${c.x}` : ''}`);
            say(`   ${c.d}listo desde ${fmtFecha(f.mtime)} — hace ${f.dias} dias${c.x}`);
        }
        return;
    }

    say();
    say(`${c.b}ENTREGABLES POR TAREA${c.x}   ${conEntregable.length} tareas con entregable`);
    say(`${c.d}el documento mas nuevo de cada tarea · "SIN SALIR" = ni mail enviado ni copia en la biblioteca${c.x}`);
    say();
    say(`${c.d}${'TAREA'.padEnd(36)} ${'FECHA'.padEnd(11)} ${'ENTREGABLE'.padEnd(42)} ESTADO${c.x}`);
    say(`${c.d}${'─'.repeat(104)}${c.x}`);
    for (const f of conEntregable) {
        const pintar = PINTAR[f.estado] ?? ((s) => s);
        const otros = f.familias.length - 1;
        say(`${cortar(f.tarea, 36)} ${fmtFecha(f.mtime).padEnd(11)} ${cortar(f.entregable, 42)} ${pintar(f.estado)}`
            + (otros > 0 ? ` ${c.d}(+${otros} doc.)${c.x}` : ''));
    }

    if (sin.length) {
        say();
        say(`${c.r}${sin.length} documento(s) hechos hace ${dias}+ dias que no salieron ni se archivaron.${c.x}  Detalle: --pendientes`);
    }
    const mudas = filas.filter((f) => !f.entregable);
    if (mudas.length) {
        say();
        say(`${c.d}(${mudas.length} tareas sin ningun entregable todavia: ${mudas.slice(0, 6).map((m) => m.tarea).join(' · ')}${mudas.length > 6 ? ' …' : ''})${c.x}`);
    }
}

function buscar({ filas, cerradas, adjuntos, enBiblio }, termino) {
    // AND de palabras, no substring del string entero: "pieza plotter" tiene que encontrar una
    // tarea llamada "Acomodar patrones de <pieza> ... en PLT": las dos palabras estan, separadas.
    const terminos = termino.toLowerCase().split(/\s+/).filter(Boolean);
    const hit = (s) => { const t = String(s ?? '').toLowerCase(); return terminos.every((w) => t.includes(w)); };
    say();
    say(`${c.b}BUSCANDO "${termino}"${c.x}`);

    const abiertas = filas.filter((f) => hit(f.tarea) || (f.familias ?? []).some((g) => hit(g.entregable)));
    if (abiertas.length) {
        say();
        say(`${c.b}En tareas ABIERTAS${c.x}`);
        for (const f of abiertas) {
            say(`  ${c.b}${f.tarea}${c.x}  ${c.d}(${f.donde})${c.x}`);
            if (!f.entregable) { say(`     ${c.d}sin entregables todavia${c.x}`); continue; }
            const pintar = PINTAR[f.estado] ?? ((s) => s);
            say(`     ${f.entregable}   ${fmtFecha(f.mtime)}   ${pintar(f.estado)}   ${c.d}(${f.total} entregable(s) en la carpeta)${c.x}`);
            say(`     ${c.d}${f.ruta}${c.x}`);
            if (f.casa) say(`     ${c.g}copia en la biblioteca:${c.x} ${f.casa}`);
            if (f.mail.enviado) say(`     ${c.g}salio por mail:${c.x} ${f.mail.fecha.slice(0, 16)} — ${f.mail.asunto}`);
        }
    }

    const viejas = cerradas.filter((f) => hit(`${f.tarea} ${f.que} ${f.donde}`));
    if (viejas.length) {
        say();
        say(`${c.b}En tareas CERRADAS${c.x}  ${c.d}(el "donde quedo" lo escribio quien la cerro)${c.x}`);
        for (const f of viejas) {
            say(`  ${c.b}${f.tarea}${c.x}  ${c.d}cerrada ${f.cerrada}${c.x}`);
            say(`     ${f.que}`);
            say(`     ${c.g}→${c.x} ${f.donde}`);
        }
    }

    // Un archivo puede haber salido por mail y no estar en ninguna carpeta de tarea: es el
    // caso de lo entregado hace meses, que es justo lo que mas cuesta encontrar.
    const porNombre = [...enBiblio.entries()].filter(([k, rel]) => hit(`${rel} ${k}`)).slice(0, 12);
    if (porNombre.length) {
        say();
        say(`${c.b}Archivos en la biblioteca que matchean el nombre${c.x}`);
        for (const [, rel] of porNombre) say(`  ${rel}`);
    }
    const porMail = [...adjuntos.entries()].filter(([k, v]) => v.enviado && hit(`${k} ${v.asunto}`)).slice(0, 12);
    if (porMail.length) {
        say();
        say(`${c.b}Adjuntos que salieron por mail${c.x}`);
        for (const [k, v] of porMail) say(`  ${k}   ${c.d}${v.fecha.slice(0, 16)} — ${v.asunto}${c.x}`);
    }

    if (!abiertas.length && !viejas.length && !porNombre.length && !porMail.length) {
        say(`\n${c.y}Nada.${c.x} Probá con menos palabras, o con el nombre del archivo en vez del de la tarea.`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

async function main(argv) {
    const args = argv.slice(2);
    const flag = (n, def = null) => { const i = args.indexOf(n); return i === -1 ? def : args[i + 1] ?? true; };
    const escritorio = String(flag('--escritorio', RUTA_ESCRITORIO));
    const archivo = String(flag('--archivo', RUTA_TAREAS_CERRADAS));
    const biblioteca = String(flag('--biblioteca', RUTA_BIBLIOTECA_GENERAL));

    if (!fs.existsSync(escritorio)) { say(`${c.r}✗${c.x}  No existe el Escritorio: ${escritorio}`); return 1; }
    if (!fs.existsSync(MAILS_JSONL)) {
        say(`${c.y}⚠${c.x}  No hay cache de mails (${MAILS_JSONL}). Sin el, "¿salio?" no se puede responder.`);
        say(`${c.d}   Corre primero:  python scripts/_mails.py --sync${c.x}`);
    }

    const datos = await relevar({ escritorio, archivo, biblioteca });

    const termino = flag('--buscar');
    if (termino && termino !== true) { buscar(datos, String(termino)); return 0; }
    if (args.includes('--json')) { say(JSON.stringify(datos.filas, null, 2)); return 0; }
    const dias = Number(flag('--dias', 2));
    tablero(datos.filas, { soloPendientes: args.includes('--pendientes'), dias: Number.isFinite(dias) ? dias : 2 });
    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
    main(process.argv).then((n) => process.exit(n > 0 ? 1 : 0));
}

export { anioDe };
