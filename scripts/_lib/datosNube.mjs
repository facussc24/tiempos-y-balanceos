/**
 * datosNube.mjs — ETAPA 1 de P55: la copia de Supabase en la biblioteca de Ingenieria se mantiene sola.
 *
 * Dos caminos, los dos en la direccion Supabase -> archivos:
 *   - `sincronizar()`      la pasada entera (la corre `scripts/_datosSincronizar.mjs`: a mano, en la noche y
 *                          cuando el cierre de sesion la pide). Por defecto es un dry-run (`aplicar: false`):
 *                          arma el plan archivo por archivo y no escribe nada, ni la base local;
 *   - `espejarGuardado()`  la escritura doble: `saveAmfe/saveCp/saveHo/savePfd` la llaman despues de guardar.
 *
 * La direccion archivos -> Supabase NO esta aca: vive apagada en `datosNubeSubir.mjs` y espera el si de Fak.
 *
 * COMO SE DECIDE SI UN ARCHIVO SE ESCRIBE (revision independiente del plan, 10/10/2026, plan §7):
 *   - La BASE no es `_manifest.json` (OneDrive lo sincroniza aparte de los documentos: otra PC puede recibir
 *     el manifest nuevo con el documento viejo). La base vive EN ESTA PC, sin sincronizar:
 *     `.claude/state/datos-nube-<huella de la carpeta>.json` = por cada archivo, el sha256 de lo ultimo que esta PC escribio o vio
 *     igual a Supabase.
 *   - Los cambios se detectan por HASH DE CONTENIDO, no por `updated_at` (saveHo y savePfd no lo tocaban, la
 *     tabla no tiene trigger y es la hora de cada PC).
 *   - Un archivo que cambio respecto de la base NO se pisa: queda anotado como pendiente (`solo_nube` si
 *     Supabase no cambio, `conflicto` si cambiaron los dos lados, `sin_base` si esta PC nunca lo vio).
 *
 * CANDADOS (cada uno con su test en __tests__/scripts/datosNube.test.mjs):
 *   - no borra ningun ARCHIVO ni ninguna fila de Supabase; tampoco su propio temporal si una escritura
 *     falla (queda `<archivo>.tmp-<pid>`, que no termina en .json y nadie lee). OJO con el alcance: un
 *     documento borrado en Supabase deja su archivo (sobrante), pero un CATALOGO de archivo unico
 *     (`products.json`) es el espejo de su tabla: una fila que se borra alla deja de estar en ese archivo;
 *   - un archivo a medio sincronizar (tamaño o fecha cambiando mientras se lee), ilegible, que no es JSON o
 *     que es una copia de conflicto de OneDrive (`<id>-PCNOMBRE.json`) ABORTA la corrida: no se lee como
 *     "no existe";
 *   - Supabase con error, con filas rotas o con 0 filas: no se toca la carpeta;
 *   - sin biblioteca sincronizada en esta PC (`carpetaNube()` = null): frena y lo dice;
 *   - nada con forma de clave llega a un archivo (`tieneSecreto`);
 *   - toda escritura va a un temporal y se renombra: no queda un archivo truncado;
 *   - corriendo en vitest no se usa la carpeta real si no se pasa una a proposito.
 *
 * SOLO LECTURA sobre Supabase: `select` y el RPC `exec_sql_read` (el mismo test de texto que la etapa 0).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    carpetaNube, canonicoTexto, sha256, hashDeFila, prepararFila, planificarTabla, claveDeFila,
    claveArchivoSegura, inventariar, clasificarTablas, prepararTablaViva, FORMATO,
} from '../_datosExportar.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export class ErrorNube extends Error {}

/**
 * La base local de esta PC para UNA carpeta (ignorada por git, NO se sincroniza con nadie). El nombre lleva
 * la huella de la carpeta: una corrida con `--out` a otra carpeta no le pisa la base a la de la biblioteca.
 * En un test la ruta se pasa a mano: un test nunca escribe la base real de la PC.
 */
export function rutaEstadoPorDefecto(dir, env = process.env) {
    if (env.BARACK_DATOS_ESTADO) return env.BARACK_DATOS_ESTADO;
    if (env.VITEST) throw new ErrorNube('en un test hay que pasar la ruta de la base local (rutaEstado / nubeEstado)');
    const huella = sha256(path.resolve(dir).toLowerCase()).slice(0, 12);
    return path.join(RAIZ, '.claude', 'state', `datos-nube-${huella}.json`);
}

const FS_REAL = {
    existsSync: fs.existsSync, statSync: fs.statSync, readFileSync: fs.readFileSync, readdirSync: fs.readdirSync,
    writeFileSync: fs.writeFileSync, renameSync: fs.renameSync, mkdirSync: fs.mkdirSync,
};

// --------------------------------------------------------------------------
// Donde va
// --------------------------------------------------------------------------

/**
 * La carpeta de la copia. `dir` explicito manda; despues `BARACK_DATOS_NUBE_DIR`; despues la biblioteca.
 * Corriendo en vitest SOLO vale la carpeta explicita (ni la variable, ni la biblioteca): un test de
 * `saveAmfe` no puede dejar un archivo en la carpeta de Ingenieria aunque la variable este puesta en la consola.
 */
export function resolverCarpeta(dir, { env = process.env, buscar = carpetaNube } = {}) {
    if (dir) return path.resolve(dir);
    if (env.VITEST) return null;
    if (env.BARACK_DATOS_NUBE_DIR) return path.resolve(env.BARACK_DATOS_NUBE_DIR);
    const d = buscar();
    return d ? path.resolve(d) : null;
}

// --------------------------------------------------------------------------
// Estado local (la base)
// --------------------------------------------------------------------------

const mismaCarpeta = (a, b) => !!a && !!b && path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const estadoVacio = (dir) => ({ version: 1, carpeta: dir, ultimaCorrida: null, limpia: null, archivos: {}, pendientes: {} });

/** Lee la base de ESTA carpeta. Si no existe, esta rota o es de otra carpeta: vacia (no se adivina una base). */
export function leerEstado(ruta, dir, fsx = FS_REAL) {
    try {
        const e = JSON.parse(fsx.readFileSync(ruta, 'utf8'));
        if (!e || e.version !== 1 || !mismaCarpeta(e.carpeta, dir)) return estadoVacio(dir);
        return { ...estadoVacio(dir), ...e, archivos: { ...(e.archivos || {}) }, pendientes: { ...(e.pendientes || {}) } };
    } catch {
        return estadoVacio(dir);
    }
}

function guardarEstado(ruta, estado, fsx = FS_REAL) {
    escribirAtomico(ruta, `${JSON.stringify(estado, null, 2)}\n`, fsx);
}

// --------------------------------------------------------------------------
// Leer y escribir sin dejar nada a medias
// --------------------------------------------------------------------------

/**
 * Lee un archivo SOLO si esta quieto: mismo tamaño y misma fecha antes y despues de leerlo, y los bytes
 * leidos son los que dice el tamaño. Si OneDrive lo esta bajando, tira (la corrida aborta). Un archivo
 * deshidratado sin red tira en la lectura: tambien aborta, nunca se toma como "no existe".
 */
export function leerEstable(ruta, fsx = FS_REAL) {
    let antes, buf, despues;
    try {
        antes = fsx.statSync(ruta);
        buf = fsx.readFileSync(ruta);
        despues = fsx.statSync(ruta);
    } catch (e) {
        throw new ErrorNube(`no se pudo leer ${ruta} (${e.code || e.message}): ¿sin bajar de la nube o tomado por otro programa?`);
    }
    const largo = Buffer.isBuffer(buf) ? buf.length : Buffer.byteLength(String(buf), 'utf8');
    if (antes.size !== despues.size || Number(antes.mtimeMs) !== Number(despues.mtimeMs) || largo !== despues.size) {
        throw new ErrorNube(`${ruta} esta cambiando mientras se lee (a medio sincronizar): no se lee`);
    }
    return Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf);
}

function esperar(ms) {
    try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { /* sin espera */ }
}

/**
 * Temporal + renombrar: el destino queda entero (el de antes o el nuevo), nunca truncado. Si falla tira, y
 * el temporal `<destino>.tmp-<pid>` queda donde esta: este modulo no borra nada.
 */
export function escribirAtomico(destino, texto, fsx = FS_REAL) {
    fsx.mkdirSync(path.dirname(destino), { recursive: true });
    const temporal = `${destino}.tmp-${process.pid}`;
    fsx.writeFileSync(temporal, texto, 'utf8');
    let intento = 0;
    for (;;) {
        try { fsx.renameSync(temporal, destino); return; } catch (e) {
            // OneDrive o un antivirus pueden tener el destino tomado un instante
            if (intento >= 3 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
            intento += 1;
            esperar(150 * intento);
        }
    }
}

/** Nada con forma de clave va a la biblioteca: clave de Anthropic, un JWT (anon key, sesion) o una linea de .env. */
const SECRETOS = [
    { que: 'clave de la API de Anthropic', re: /sk-ant-[A-Za-z0-9_-]{8,}/ },
    { que: 'token JWT (clave o sesion de Supabase)', re: /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/ },
    { que: 'variable de .env', re: /(VITE_[A-Z0-9_]+|ANTHROPIC_API_KEY)\s*=/ },
];
export function tieneSecreto(texto) {
    const hit = SECRETOS.find((s) => s.re.test(String(texto)));
    return hit ? hit.que : null;
}

// --------------------------------------------------------------------------
// La decision, archivo por archivo (funcion pura)
// --------------------------------------------------------------------------

function mismoData(textoA, textoB) {
    try {
        const a = JSON.parse(textoA), b = JSON.parse(textoB);
        if (!a || !b || !('data' in a) || !('data' in b)) return false;
        return canonicoTexto(a.data) === canonicoTexto(b.data);
    } catch { return false; }
}

/**
 * @param {{nuevo: string, disco: string|null, shaBase?: string, pendiente?: object|null, aceptar?: boolean}} p
 *   nuevo = lo que dice Supabase (texto canonico) · disco = lo que hay en la carpeta (null si no hay archivo)
 *   shaBase = sha de lo ultimo que ESTA PC escribio o vio igual a Supabase
 *   anterior = (solo en la escritura doble) lo que Supabase tenia JUSTO ANTES de este guardado
 * @returns {'crear'|'igual'|'actualizar'|'solo_nube'|'conflicto'|'sin_base'}
 */
export function decidir({ nuevo, disco, shaBase = null, pendiente = null, aceptar = false, anterior = null }) {
    if (disco === null || disco === undefined) return 'crear';
    if (disco === nuevo) return 'igual';
    if (aceptar) return 'actualizar';                 // una persona dijo "para este archivo vale Supabase"
    // El archivo es lo que Supabase tenia antes de este guardado: nadie lo edito a mano. Es el caso de dos
    // PC: la otra guardo y espejo; para esta, el archivo "cambio" respecto de SU base, pero es contenido de
    // Supabase. Sin esto, cada guardado cruzado entre dos PC dejaba un conflicto falso para siempre.
    if (anterior !== null && disco === anterior) return 'actualizar';
    const shaDisco = sha256(disco);
    // El archivo lo escribi yo cuando Supabase no contestaba, y Supabase ya tiene ese mismo contenido.
    if (pendiente?.tipo === 'solo_archivo' && pendiente.shaArchivo === shaDisco && mismoData(disco, nuevo)) return 'actualizar';
    if (!shaBase) return 'sin_base';                  // esta PC nunca lo vio: no puede saber quien cambio
    if (shaDisco === shaBase) return 'actualizar';    // el archivo esta como lo deje: cambio Supabase
    if (sha256(nuevo) === shaBase) return 'solo_nube'; // Supabase esta como lo deje: cambio el archivo
    return 'conflicto';                               // cambiaron los dos
}

export const NO_ESCRIBEN = Object.freeze(['solo_nube', 'conflicto', 'sin_base']);
const TEXTO_PENDIENTE = {
    solo_nube: 'el archivo cambio en la nube y Supabase no (subirlo a Supabase espera el si de Fak)',
    conflicto: 'cambiaron el archivo de la nube y la fila de Supabase: no se pisa ninguno',
    sin_base: 'el archivo difiere de Supabase y esta PC no tiene base para saber cual cambio',
    solo_archivo: 'guardado solo en el archivo: Supabase no contesto y quedo atras',
    fallo_escritura: 'no se pudo escribir el archivo',
    cambio_durante: 'el archivo cambio mientras corria la pasada (otra sesion guardo, o lo bajo OneDrive): no se piso; la proxima pasada lo resuelve',
    secreto: 'el contenido trae algo con forma de clave: no se escribe',
};
export const textoPendiente = (tipo) => TEXTO_PENDIENTE[tipo] || tipo;

// --------------------------------------------------------------------------
// Revisar la carpeta ANTES de tocarla
// --------------------------------------------------------------------------

/** `<algo>-PCNOMBRE.json` al lado de `<algo>.json` es como OneDrive nombra la copia de un choque. */
function esCopiaDeConflicto(nombre, hermanos, vivas) {
    if (vivas.has(nombre)) return false;
    return [...hermanos].some((h) => h !== nombre && nombre.startsWith(`${h}-`));
}

/**
 * Lee todo lo que la corrida va a mirar. Cualquier problema va a `problemas` y la corrida ABORTA.
 * @param {string} dir
 * @param {Map<string, {modo: string, claves: Set<string>}>} tablas  las tablas vivas
 * @returns {{textos: Map<string,string>, problemas: string[]}}  textos: ruta relativa -> contenido
 */
export function revisarCarpeta(dir, tablas, fsx = FS_REAL, conocidas = new Set()) {
    // `conocidas`: rutas que la base local de esta PC tiene como documento (las escribio o las vio iguales a
    // Supabase). Un documento `X-algo` al lado de `X` NO es una copia de conflicto, tampoco cuando su fila
    // se borro y quedo de sobrante. Una copia de OneDrive nunca entra en la base.
    const textos = new Map();
    const problemas = [];
    if (!fsx.existsSync(dir)) return { textos, problemas };

    const leer = (rel) => {
        let texto;
        try { texto = leerEstable(path.join(dir, rel), fsx); } catch (e) { problemas.push(e.message); return; }
        try { JSON.parse(texto); } catch (e) { problemas.push(`${rel}: no es JSON (${e.message}): ¿archivo cortado?`); return; }
        textos.set(rel, texto);
    };
    const jsonDe = (carpeta) => fsx.readdirSync(carpeta).filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5)).sort();

    let raiz = [];
    try { raiz = jsonDe(dir); } catch (e) { problemas.push(`no se pudo listar ${dir}: ${e.message}`); return { textos, problemas }; }
    const unicos = new Set(['_manifest', ...[...tablas].filter(([, t]) => t.modo === 'archivo-unico').map(([n]) => n)]);
    // Los hermanos son TODOS los .json de la raiz, no solo los de tablas vivas: una copia de conflicto de
    // un catalogo que hoy quedo sin filas tambien frena.
    const hermanosRaiz = new Set([...raiz, ...unicos]);
    raiz.forEach((nombre) => {
        if (unicos.has(nombre)) leer(`${nombre}.json`);
        else if (esCopiaDeConflicto(nombre, hermanosRaiz, unicos)) problemas.push(`${nombre}.json: copia de conflicto de OneDrive (dos PC escribieron el mismo archivo): resolverla a mano antes de sincronizar`);
    });
    [...tablas].filter(([, t]) => t.modo === 'archivo-por-fila').forEach(([tabla, t]) => {
        const carpeta = path.join(dir, tabla);
        if (!fsx.existsSync(carpeta)) return;
        let nombres;
        try { nombres = jsonDe(carpeta); } catch (e) { problemas.push(`no se pudo listar ${tabla}/: ${e.message}`); return; }
        const hermanos = new Set([...nombres, ...t.claves]);
        nombres.forEach((nombre) => {
            if (!conocidas.has(`${tabla}/${nombre}.json`) && esCopiaDeConflicto(nombre, hermanos, t.claves)) problemas.push(`${tabla}/${nombre}.json: copia de conflicto de OneDrive (dos PC escribieron el mismo documento): resolverla a mano antes de sincronizar`);
            else leer(`${tabla}/${nombre}.json`);
        });
    });
    return { textos, problemas };
}

// --------------------------------------------------------------------------
// Manifest: describe lo que HAY en disco, nunca lo que deberia haber
// --------------------------------------------------------------------------

function sinGenerado(m) {
    const resto = { ...m };
    delete resto.generado;
    return resto;
}

function armarManifest({ dir, planes, pks, enDisco, excluidas, vacias, ahora }) {
    const tablas = {};
    let totalFilas = 0;
    planes.forEach((plan, tabla) => {
        const documentos = {};
        if (plan.modo === 'archivo-por-fila') {
            const contenidos = new Map(plan.archivos.map((a) => [a.ruta, a.contenido]));
            Object.entries(plan.documentos).forEach(([clave, entrada]) => {
                const rel = `${tabla}/${clave}.json`;
                const disco = enDisco.get(rel);
                if (disco === undefined) return;                                // no esta en disco: no se describe
                if (disco === contenidos.get(rel)) { documentos[clave] = entrada; return; }
                const obj = JSON.parse(disco);
                documentos[clave] = { sha256: hashDeFila(obj), updated_at: obj.updated_at ?? null, difiere_de_supabase: true };
            });
            const filas = Object.keys(documentos).length;
            // Los sobrantes (archivo sin fila en Supabase: no se borra) tambien estan en disco: se describen, marcados.
            enDisco.forEach((texto, rel) => {
                if (!rel.startsWith(`${tabla}/`) || contenidos.has(rel)) return;
                documentos[rel.slice(tabla.length + 1, -5)] = { sha256: hashDeFila(JSON.parse(texto)), sobrante: true };
            });
            tablas[tabla] = { modo: plan.modo, filas, documentos };
        } else {
            const rel = `${tabla}.json`;
            const disco = enDisco.get(rel);
            if (disco === undefined) return;
            const alDia = plan.archivos[0] && disco === plan.archivos[0].contenido;
            if (alDia) Object.assign(documentos, plan.documentos);
            else {
                // del MISMO texto que se leyo quieto en el paso 2 (no se vuelve al disco: podria haber cambiado)
                const filas = JSON.parse(disco);
                (Array.isArray(filas) ? filas : []).forEach((obj) => {
                    try { documentos[claveDeFila(obj, pks.get(tabla))] = { sha256: hashDeFila(obj), difiere_de_supabase: true }; } catch { /* fila sin clave: no se describe */ }
                });
            }
            tablas[tabla] = { modo: plan.modo, filas: Object.keys(documentos).length, documentos, archivo: rel, sha256_archivo: sha256(disco) };
        }
        totalFilas += tablas[tabla].filas;
    });
    return { formato: FORMATO, generado: ahora().toISOString(), totalFilas, tablas, excluidas, vacias, errores: [] };
}

/** Escribe el manifest solo si cambio algo mas que la hora. @returns {boolean} si se escribio */
function escribirManifestSiCambio(dir, manifest, previoTexto, fsx) {
    if (previoTexto) {
        try {
            if (canonicoTexto(sinGenerado(JSON.parse(previoTexto))) === canonicoTexto(sinGenerado(manifest))) return false;
        } catch { /* manifest roto: se reescribe */ }
    }
    escribirAtomico(path.join(dir, '_manifest.json'), canonicoTexto(manifest), fsx);
    return true;
}

// --------------------------------------------------------------------------
// La pasada entera: Supabase -> archivos
// --------------------------------------------------------------------------

/**
 * @param {object} p
 * @param {object} p.sb            cliente de Supabase (solo se usa para leer)
 * @param {string|null} p.dir      carpeta de la copia (null = la biblioteca no esta sincronizada: frena)
 * @param {boolean} [p.aplicar]    false (por defecto) = dry-run: devuelve el plan y no escribe NADA, ni la base
 * @param {string[]} [p.aceptar]   rutas relativas para las que una persona dijo "vale Supabase"
 */
export async function sincronizar({ sb, dir, rutaEstado = null, aplicar = false, aceptar = [], log = () => {}, fsx = FS_REAL, ahora = () => new Date() }) {
    const r = {
        aplicar, abortado: null, dir, totalFilas: 0, tablas: 0,
        creados: [], actualizados: [], iguales: 0, pendientes: [], fallidos: [], sobrantes: [], manifestEscrito: false,
    };
    const abortar = (motivo) => { r.abortado = motivo; return r; };
    if (!dir) return abortar('no encuentro la biblioteca de Ingenieria en esta PC (BARACK ARGENTINA SRL\\Ingenieria y Proyecto - General): abrir OneDrive y esperar que sincronice');

    // 1. Supabase entero, ANTES de mirar la carpeta. Cualquier duda: no se toca nada.
    let conteos, pks;
    try { ({ conteos, pks } = await inventariar(sb)); } catch (e) { return abortar(`Supabase no contesto bien (${e.message}): no se toca la carpeta`); }
    const { exportables, excluidas, vacias } = clasificarTablas(conteos);
    const planes = new Map();
    const errores = [];
    for (const tabla of exportables) {
        let p;
        try { p = await prepararTablaViva(sb, tabla, conteos.get(tabla), pks.get(tabla)); } catch (e) { p = { error: `${tabla}: ${e.message}` }; }
        if (p.error) { errores.push(p.error); continue; }
        errores.push(...p.plan.errores);
        planes.set(tabla, p.plan);
    }
    r.totalFilas = [...planes.values()].reduce((n, p) => n + Object.keys(p.documentos).length, 0);
    r.tablas = planes.size;
    if (errores.length) return abortar(`Supabase con ${errores.length} problema(s), no se toca la carpeta: ${errores.slice(0, 3).join(' | ')}`);
    if (r.totalFilas === 0) return abortar('Supabase devolvio 0 filas: con RLS eso es "no pude leer", no "no hay". No se toca la carpeta');

    // 2. La carpeta, entera y quieta
    const vivas = new Map([...planes].map(([t, p]) => [t, { modo: p.modo, claves: new Set(Object.keys(p.documentos)) }]));
    rutaEstado ??= rutaEstadoPorDefecto(dir);
    const estado = leerEstado(rutaEstado, dir, fsx);
    const inicial = leerEstado(rutaEstado, dir, fsx);      // foto del arranque: para no pisar lo que anote otro
    const { textos, problemas } = revisarCarpeta(dir, vivas, fsx, new Set(Object.keys(inicial.archivos)));
    if (problemas.length) return abortar(`la carpeta no esta en condiciones (${problemas.length}): ${problemas.slice(0, 3).join(' | ')}`);

    // 3. Decidir, archivo por archivo (el plan); con `aplicar`, escribir lo que el plan dice
    /** Anota en la base UN archivo recien escrito, sin pisar lo que otra sesion haya anotado mientras tanto. */
    const anotarEscrito = (ruta, sha) => {
        try {
            const a = leerEstado(rutaEstado, dir, fsx);
            a.archivos[ruta] = sha;
            delete a.pendientes[ruta];
            guardarEstado(rutaEstado, a, fsx);
        } catch { /* se vuelve a intentar al final de la pasada */ }
    };
    const aceptadas = new Set(aceptar.map((a) => a.replace(/\\/g, '/')));
    const enDisco = new Map(textos);
    const esperados = new Set();
    const sello = ahora().toISOString();
    const pendientes = {};
    const tratar = ({ ruta, contenido }) => {
        esperados.add(ruta);
        const disco = textos.has(ruta) ? textos.get(ruta) : null;
        const previo = estado.pendientes[ruta] || null;
        const d = decidir({ nuevo: contenido, disco, shaBase: estado.archivos[ruta], pendiente: previo, aceptar: aceptadas.has(ruta) });
        if (d === 'igual') { r.iguales += 1; estado.archivos[ruta] = sha256(contenido); return; }
        if (NO_ESCRIBEN.includes(d)) {
            // Un `solo_archivo` que sigue igual conserva su marca: es lo que deja repararlo cuando Supabase vuelve.
            // Solo mientras Supabase sigue como la base lo conocia (`solo_nube`): si ademas cambio Supabase es
            // un conflicto de verdad, y la marca `solo_archivo` diria al reves que Supabase quedo atras.
            const sigue = d === 'solo_nube' && previo?.tipo === 'solo_archivo' && previo.shaArchivo === sha256(disco);
            pendientes[ruta] = sigue ? previo : { tipo: d, desde: previo?.tipo === d ? previo.desde : sello, shaArchivo: sha256(disco), shaSupabase: sha256(contenido) };
            r.pendientes.push({ ruta, tipo: pendientes[ruta].tipo, detalle: textoPendiente(pendientes[ruta].tipo) });
            return;
        }
        const secreto = tieneSecreto(contenido);
        if (secreto) {
            pendientes[ruta] = { tipo: 'secreto', desde: sello };
            r.fallidos.push({ ruta, detalle: `${textoPendiente('secreto')} (${secreto})` });
            return;
        }
        if (aplicar) {
            // Entre que se leyo la carpeta y ahora pudo guardar otra sesion (la escritura doble) o bajar
            // algo OneDrive: se relee justo antes de escribir y, si el archivo ya no es el que se miro, no se pisa.
            const destino = path.join(dir, ruta);
            let ahoraEnDisco;
            try { ahoraEnDisco = fsx.existsSync(destino) ? leerEstable(destino, fsx) : null; } catch { ahoraEnDisco = undefined; }
            if (ahoraEnDisco !== disco) {
                if (typeof ahoraEnDisco === 'string') enDisco.set(ruta, ahoraEnDisco);   // el manifest describe lo que hay
                pendientes[ruta] = { tipo: 'cambio_durante', desde: sello };
                r.pendientes.push({ ruta, tipo: 'cambio_durante', detalle: textoPendiente('cambio_durante') });
                return;
            }
            try {
                escribirAtomico(destino, contenido, fsx);
            } catch (e) {
                pendientes[ruta] = { tipo: 'fallo_escritura', desde: sello };
                r.fallidos.push({ ruta, detalle: `${textoPendiente('fallo_escritura')} (${e.code || e.message})` });
                return;
            }
            enDisco.set(ruta, contenido);
            estado.archivos[ruta] = sha256(contenido);
            // La base se guarda archivo por archivo: si el proceso se corta a mitad, lo ya escrito no queda
            // como "cambio en la nube" para la corrida siguiente.
            anotarEscrito(ruta, estado.archivos[ruta]);
        }
        (d === 'crear' ? r.creados : r.actualizados).push(ruta);
    };
    planes.forEach((plan) => plan.archivos.forEach(tratar));
    r.sobrantes = [...textos.keys()].filter((ruta) => ruta !== '_manifest.json' && !esperados.has(ruta));

    if (!aplicar) return r;

    // 4. Manifest (describe lo que quedo en disco) y la base local
    try {
        const manifest = armarManifest({ dir, planes, pks, enDisco, excluidas, vacias, ahora });
        r.manifestEscrito = escribirManifestSiCambio(dir, manifest, textos.get('_manifest.json'), fsx);
    } catch (e) {
        r.fallidos.push({ ruta: '_manifest.json', detalle: `${textoPendiente('fallo_escritura')} (${e.code || e.message})` });
    }
    estado.pendientes = pendientes;
    // Lo que OTRO anoto en la base mientras corria esta pasada (la escritura doble de una sesion) manda
    // para esa ruta: se relee la base y se conserva toda entrada que cambio desde el arranque.
    const actual = leerEstado(rutaEstado, dir, fsx);
    const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    new Set([...Object.keys(actual.archivos), ...Object.keys(actual.pendientes), ...Object.keys(inicial.pendientes)]).forEach((ruta) => {
        if (igual(actual.archivos[ruta], inicial.archivos[ruta]) && igual(actual.pendientes[ruta], inicial.pendientes[ruta])) return;
        if (actual.archivos[ruta]) estado.archivos[ruta] = actual.archivos[ruta];
        if (actual.pendientes[ruta]) estado.pendientes[ruta] = actual.pendientes[ruta]; else delete estado.pendientes[ruta];
    });
    estado.ultimaCorrida = sello;
    estado.limpia = r.pendientes.length === 0 && r.fallidos.length === 0;
    estado.resumen = { totalFilas: r.totalFilas, escritos: r.creados.length + r.actualizados.length, sobrantes: r.sobrantes.length };
    try {
        guardarEstado(rutaEstado, estado, fsx);
    } catch (e) {
        r.fallidos.push({ ruta: '(base local de esta PC)', detalle: `no se pudo guardar ${rutaEstado} (${e.code || e.message})` });
    }
    log(`  base local: ${rutaEstado}`);
    return r;
}

/**
 * ¿Hace falta leer la fila de Supabase ANTES de guardar? Solo si el archivo de la nube no esta como la base
 * de esta PC lo dejo: ahi hay que saber si lo escribio otra PC o lo edito una persona. En el caso normal (el
 * archivo esta como lo deje) se sabe sin ir a la red: no se suma una lectura a cada guardado, ni una espera
 * cuando Supabase no contesta. No tira: ante la duda dice que no.
 */
export function necesitaFilaAnterior({ tabla, id, dir = null, rutaEstado = null, fsx = FS_REAL }) {
    try {
        const carpeta = resolverCarpeta(dir);
        if (!carpeta || !fsx.existsSync(path.join(carpeta, '_manifest.json'))) return false;
        const rel = `${tabla}/${claveArchivoSegura(String(id))}.json`;
        const destino = path.join(carpeta, rel);
        if (!fsx.existsSync(destino)) return false;
        const estado = leerEstado(rutaEstado ?? rutaEstadoPorDefecto(carpeta), carpeta, fsx);
        return estado.archivos[rel] !== sha256(leerEstable(destino, fsx));
    } catch {
        return false;
    }
}

/** ¿La corrida salio sin nada que mirar? (los sobrantes se listan pero no son un error: nunca se borra) */
export const corridaLimpia = (r) => !r.abortado && r.pendientes.length === 0 && r.fallidos.length === 0;

// --------------------------------------------------------------------------
// La escritura doble: un documento, justo despues de guardarlo
// --------------------------------------------------------------------------

function anotarEnManifest({ dir, tabla, clave, fila, fsx, ahora }) {
    const ruta = path.join(dir, '_manifest.json');
    const manifest = JSON.parse(leerEstable(ruta, fsx));
    const entrada = planificarTabla({ tabla, filas: [fila], pk: ['id'] }).documentos[clave];
    if (!entrada || !manifest.tablas?.[tabla]?.documentos) throw new ErrorNube(`el manifest no tiene la tabla ${tabla}`);
    manifest.tablas[tabla].documentos[clave] = entrada;
    manifest.tablas[tabla].filas = Object.values(manifest.tablas[tabla].documentos).filter((d) => !d?.sobrante).length;
    manifest.totalFilas = Object.values(manifest.tablas).reduce((n, t) => n + (Number(t.filas) || 0), 0);
    manifest.generado = ahora().toISOString();
    escribirAtomico(ruta, canonicoTexto(manifest), fsx);
}

/**
 * Deja en la carpeta el archivo del documento recien guardado, identico al que escribiria `sincronizar()`.
 * Tira si algo falla: quien la llama (`amfeIo`) la envuelve, avisa y sigue (el guardado en Supabase ya esta).
 *
 * `soloArchivo` (objeto con las columnas que se iban a guardar, `data` como objeto): Supabase NO contesto.
 * Se arma la fila con el archivo que ya habia + esas columnas y se escribe igual, para no perder el trabajo;
 * queda anotado como pendiente `solo_archivo` y la base no se mueve (la corrida siguiente lo reporta).
 *
 * @returns {Promise<{escrito: boolean, motivo?: string, ruta?: string}>}
 */
export async function espejarGuardado({ sb, tabla, id, dir = null, rutaEstado = null, soloArchivo = null, filaAnterior = null, fsx = FS_REAL, ahora = () => new Date() }) {
    const carpeta = resolverCarpeta(dir);
    if (!carpeta) return { escrito: false, motivo: 'sin_carpeta' };
    // Sin la copia inicial no se arranca una copia de a pedazos: eso lo hace la pasada entera.
    if (!fsx.existsSync(path.join(carpeta, '_manifest.json'))) return { escrito: false, motivo: 'sin_copia_inicial' };
    rutaEstado ??= rutaEstadoPorDefecto(carpeta);

    const clave = claveArchivoSegura(String(id));
    const rel = `${tabla}/${clave}.json`;
    const destino = path.join(carpeta, rel);

    // La unica espera va PRIMERO. De aca para abajo todo es de corrido (sin `await`): dos guardados
    // lanzados juntos no se pisan la base local entre que uno la lee y la guarda.
    let filaViva = null;
    if (!soloArchivo) {
        const { data, error } = await sb.from(tabla).select('*').eq('id', id).single();
        if (error || !data) throw new ErrorNube(`no se pudo releer ${tabla}/${id} para la copia de la nube: ${error?.message || 'sin fila'}`);
        filaViva = data;
    }

    const estado = leerEstado(rutaEstado, carpeta, fsx);
    const previo = estado.pendientes[rel] || null;
    const disco = fsx.existsSync(destino) ? leerEstable(destino, fsx) : null;
    const sello = ahora().toISOString();
    const anotar = (tipo, extra = {}) => {
        estado.pendientes[rel] = { tipo, desde: previo?.tipo === tipo ? previo.desde : sello, ...extra };
        guardarEstado(rutaEstado, estado, fsx);
    };

    // Una copia de conflicto de OneDrive de ESTE documento (`<id>-PCNOMBRE.json`): no se escribe encima.
    const copias = fsx.existsSync(path.dirname(destino))
        ? fsx.readdirSync(path.dirname(destino)).filter((n) => n.endsWith('.json') && n.startsWith(`${clave}-`) && !estado.archivos[`${tabla}/${n}`]) : [];
    if (copias.length) {
        anotar('conflicto', { copia: copias[0] });
        return { escrito: false, motivo: `hay una copia de conflicto de OneDrive de este documento (${copias[0]}): resolverla a mano`, ruta: rel };
    }

    // Lo que Supabase tenia justo antes de este guardado: si el archivo es eso, nadie lo edito a mano.
    let anterior = null;
    if (filaAnterior) { const p = prepararFila(filaAnterior); if (p.ok) anterior = canonicoTexto(p.fila); }

    let fila = filaViva;
    if (soloArchivo) {
        if (disco === null) return { escrito: false, motivo: 'no hay archivo previo de este documento para completar la fila' };
        const mio = estado.archivos[rel] === sha256(disco) || disco === anterior
            || (previo?.tipo === 'solo_archivo' && previo.shaArchivo === sha256(disco));
        if (!mio) return { escrito: false, motivo: textoPendiente('solo_nube') };
        fila = { ...JSON.parse(disco), ...soloArchivo };
    }
    const prep = prepararFila(fila);
    if (!prep.ok) throw new ErrorNube(`${rel}: ${prep.error}`);
    const nuevo = canonicoTexto(prep.fila);
    const decision = soloArchivo ? (disco === nuevo ? 'igual' : 'actualizar')
        : decidir({ nuevo, disco, shaBase: estado.archivos[rel], pendiente: previo, anterior });

    if (NO_ESCRIBEN.includes(decision)) {
        if (!(decision === 'solo_nube' && previo?.tipo === 'solo_archivo' && previo.shaArchivo === sha256(disco))) anotar(decision, { shaArchivo: sha256(disco), shaSupabase: sha256(nuevo) });
        return { escrito: false, motivo: textoPendiente(decision), ruta: rel };
    }
    const secreto = tieneSecreto(nuevo);
    if (secreto) { anotar('secreto'); return { escrito: false, motivo: `${textoPendiente('secreto')} (${secreto})`, ruta: rel }; }

    if (decision !== 'igual') {
        try { escribirAtomico(destino, nuevo, fsx); } catch (e) {
            anotar('fallo_escritura');
            throw new ErrorNube(`${rel}: ${textoPendiente('fallo_escritura')} (${e.code || e.message})`);
        }
    }
    try {
        if (soloArchivo) {
            anotar('solo_archivo', { shaArchivo: sha256(nuevo) });
        } else {
            estado.archivos[rel] = sha256(nuevo);
            delete estado.pendientes[rel];
            guardarEstado(rutaEstado, estado, fsx);
        }
    } catch (e) {
        // el archivo SI quedo escrito; lo que no se pudo guardar es la base local de esta PC
        return { escrito: decision !== 'igual', ruta: rel, motivo: `no se pudo guardar la base local (${e.code || e.message}): la proxima pasada lo va a listar como pendiente` };
    }
    if (decision !== 'igual') {
        // El archivo ya esta bien; si el manifest falla lo repara la pasada entera.
        try { anotarEnManifest({ dir: carpeta, tabla, clave, fila: prep.fila, fsx, ahora }); } catch (e) {
            return { escrito: true, ruta: rel, motivo: `el manifest no se pudo actualizar (${e.message}): lo repara la proxima pasada` };
        }
    }
    return { escrito: decision !== 'igual', ruta: rel };
}

// --------------------------------------------------------------------------
// Para el cierre de sesion: solo mira la base local, no va a la red
// --------------------------------------------------------------------------

export const HORAS_COPIA_VIEJA = 26;

/**
 * @param {{estado: object|null, hayCarpeta: boolean, escrituraEpoch?: number|null, ahoraMs?: number}} p
 *   escrituraEpoch = ultima escritura en Supabase que esta sesion marco (segundos), si hubo
 * @returns {{estado: 'ok'|'aviso'|'falta', detalle: string}}
 */
export function evaluarCopiaNube({ estado, hayCarpeta, escrituraEpoch = null, ahoraMs = Date.now() }) {
    const comando = 'node scripts/_datosSincronizar.mjs --aplicar';
    if (!hayCarpeta) return { estado: 'aviso', detalle: 'la biblioteca de Ingenieria no esta sincronizada en esta PC: la copia de los documentos en la nube no se puede actualizar desde aca' };
    if (!estado?.ultimaCorrida) return { estado: 'aviso', detalle: `esta PC nunca sincronizo la copia de la nube — ${comando}` };
    const pendientes = Object.entries(estado.pendientes || {});
    if (pendientes.length) {
        const lista = pendientes.slice(0, 4).map(([ruta, p]) => `      ${ruta}: ${textoPendiente(p.tipo)}`).join('\n');
        return { estado: 'falta', detalle: `${pendientes.length} documento(s) de la copia de la nube sin resolver (node scripts/_datosSincronizar.mjs --pendientes):\n${lista}` };
    }
    // la ultima pasada dejo algo sin escribir que no es de un documento (el manifest, la propia base)
    if (estado.limpia === false) return { estado: 'falta', detalle: `la ultima sincronizacion de la copia de la nube no termino limpia — ${comando}` };
    const corrida = new Date(estado.ultimaCorrida).getTime();
    const cuando = new Date(corrida).toLocaleString('es-AR', { hour12: false });
    if (escrituraEpoch && escrituraEpoch * 1000 > corrida) return { estado: 'falta', detalle: `se escribio en Supabase despues de la ultima sincronizacion de la nube (${cuando}) — ${comando}` };
    const horas = (ahoraMs - corrida) / 3600000;
    if (horas > HORAS_COPIA_VIEJA) return { estado: 'aviso', detalle: `la copia de la nube se sincronizo por ultima vez el ${cuando} (hace ${Math.round(horas)} h) — ${comando}` };
    return { estado: 'ok', detalle: `copia de la nube sincronizada el ${cuando}, sin pendientes` };
}
