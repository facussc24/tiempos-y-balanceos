/**
 * _datosExportar.mjs — ETAPA 0 de "dejar de depender de Supabase" (decision Fak, 30/09/2026).
 *
 * Baja TODO lo que hay en Supabase a archivos JSON en la biblioteca de Ingenieria en la nube
 * (`...\INGENIERIA BARACK (NUNCA BORRAR)\1- GENERAL\AMFE\DATOS`, decision de Fak del 01/10/2026;
 * hasta el 30/09 era el repo local `C:\Dev\BarackDatos`) y prueba que no falta nada. NO cambia
 * nada de lo existente: Supabase sigue siendo la fuente de verdad, esto es una COPIA.
 * Plan: docs/auto-mejora/2026-09-30-automejora-10-frentes.md §4.
 *
 * Uso:
 *   node scripts/_datosExportar.mjs                   exporta (escribe SOLO en la carpeta destino)
 *   node scripts/_datosExportar.mjs --verificar       relee Supabase y compara contra los archivos
 *   node scripts/_datosExportar.mjs --out <carpeta>   otra carpeta destino (por defecto, la de la nube)
 *   node scripts/_datosExportar.mjs --pisar           exporta a la carpeta de la nube PISANDO lo que haya
 *
 * Desde el 10/10/2026 (etapa 1, P55) la carpeta de la nube se mantiene con `_datosSincronizar.mjs`, que
 * no pisa un archivo que cambio en la nube. Este script escribe todo archivo que difiere, asi que contra
 * la carpeta de la nube solo exporta con `--pisar` (la primera copia, o reconstruirla a proposito).
 *
 * SOLO LECTURA sobre Supabase: login, `select` y el RPC `exec_sql_read`. Nada de escrituras
 * (un test lee este archivo y falla si aparece alguna). No borra archivos: los que quedan
 * sin fila en Supabase se listan como "sobrantes" y se sacan a mano.
 *
 * Que tablas: las mismas que baja `_backup.mjs` (se descubren de information_schema, no hay
 * lista escrita a mano), MENOS las vacias y las copias viejas (`_bk_*`, `_backup_*` y
 * `backup_amfe_20260819_ingles`). Una tabla nueva con filas se exporta sola.
 *
 * Como se guarda cada una (regla simple, sin lista a mano):
 *   - La tabla tiene columna `data` (amfe/cp/ho/pfd/bom_documents, projects, drafts):
 *     UN ARCHIVO POR FILA, `<tabla>/<id>.json`. Son documentos: cada uno cambia solo y git
 *     muestra el diff de ese documento.
 *   - No la tiene (products, customer_lines, familias, medios_*, amfe_registry, settings...):
 *     UN SOLO ARCHIVO por tabla, `<tabla>.json`, arreglo ordenado por clave. Son catalogos o
 *     listados: 491 archivos de 6 lineas cada uno no le sirven a nadie.
 *
 * Formato canonico (lo que se hashea): claves ordenadas a cualquier profundidad, sangria de
 * 2 espacios, saltos LF, UTF-8 sin BOM, un LF al final. La columna `data`, que en Supabase es
 * TEXT con JSON adentro (a veces doble serializado), se guarda PARSEADA con `parseData` de
 * `_lib/amfeIo.mjs`. Las demas columnas van tal cual, incluidas `revisions`, `historial` y
 * `settings.value`, que tambien son TEXT con JSON: no se tocan en esta etapa. Una fila cuyo
 * `data` no parsea NO se adivina: no se escribe y queda listada como error.
 *
 * `_manifest.json` (en la carpeta destino): por tabla, cantidad de filas; por documento, sha256
 * del canonico, updated_at y etiqueta; para amfe_documents, operaciones y causas.
 *
 * Reutiliza `_lib/amfeIo.mjs` (login, parseData, countAmfeStats). La consulta de inventario y
 * la paginacion estan repetidas de `_backup.mjs` porque ese script corre al importarlo y no
 * exporta nada; conviene sacarlas a `_lib/` en una etapa posterior.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectSupabase, parseData, countAmfeStats } from './_lib/amfeIo.mjs';

/**
 * Donde van los datos: la biblioteca de Ingenieria en la nube (Fak, 01/10/2026: "los AMFE son de
 * ingenieria... usemos la nube, no en local"; carpeta aprobada el mismo dia). Se busca por FORMA y no
 * por ruta fija: la carpeta del usuario cambia de PC en PC y la biblioteca puede venir con o sin tilde.
 * Si la biblioteca no esta sincronizada en esta PC devuelve null, y el script frena: no guarda en local
 * "por las dudas". Hasta el 30/09 el destino era `C:\Dev\BarackDatos` (repo git local, queda de historia).
 */
export const CARPETA_EN_LA_BIBLIOTECA = ['INGENIERIA BARACK (NUNCA BORRAR)', '1- GENERAL', 'AMFE', 'DATOS'];
export function carpetaNube(home = homedir()) {
    const org = join(home, 'BARACK ARGENTINA SRL');
    let bibliotecas = [];
    try { bibliotecas = readdirSync(org).filter((n) => /^Ingenier.{1,2}a y Proyecto - General$/i.test(n)); } catch { return null; }
    for (const b of bibliotecas) {
        const general = join(org, b, CARPETA_EN_LA_BIBLIOTECA[0], CARPETA_EN_LA_BIBLIOTECA[1]);
        if (existsSync(general)) return join(general, ...CARPETA_EN_LA_BIBLIOTECA.slice(2));
    }
    return null;
}
export const FORMATO = 'canonico-v1: claves ordenadas, 2 espacios, LF, UTF-8; data parseada (objeto, no TEXT)';

// --------------------------------------------------------------------------
// Serializacion canonica (funciones puras, con test)
// --------------------------------------------------------------------------

/** Copia profunda con las claves de cada objeto ordenadas. Los arreglos conservan su orden. */
export function ordenarClaves(valor) {
    if (Array.isArray(valor)) return valor.map(ordenarClaves);
    if (valor !== null && typeof valor === 'object') {
        // fromEntries define propiedades propias: una clave "__proto__" no pisa el prototipo.
        return Object.fromEntries(Object.keys(valor).sort().map((k) => [k, ordenarClaves(valor[k])]));
    }
    return valor;
}

/** Texto canonico de un valor JSON, con LF final. Es lo que se escribe y lo que se hashea. */
export function canonicoTexto(valor) {
    const texto = JSON.stringify(ordenarClaves(valor), null, 2);
    if (typeof texto !== 'string') throw new Error('canonicoTexto: el valor no es serializable a JSON');
    return `${texto}\n`;
}

export function sha256(texto) {
    return createHash('sha256').update(texto, 'utf8').digest('hex');
}

/** Hash del contenido canonico de una fila (ya con `data` parseada). */
export function hashDeFila(fila) {
    return sha256(canonicoTexto(fila));
}

/**
 * Convierte el `data` de una fila (TEXT con JSON, doble serializado o ya objeto) en objeto.
 * NO adivina: si no parsea devuelve ok:false con el motivo.
 * @returns {{ok: true, valor: any, doble: boolean} | {ok: false, error: string}}
 */
export function normalizarData(raw) {
    if (raw === null || raw === undefined) return { ok: true, valor: null, doble: false };
    if (typeof raw !== 'string') return { ok: true, valor: raw, doble: false };
    const valor = parseData(raw);
    if (valor === null) {
        // parseData devuelve null tanto para "no parsea" como para el texto `null`.
        if (raw.trim() === 'null') return { ok: true, valor: null, doble: false };
        return { ok: false, error: `data no es JSON valido (empieza con ${JSON.stringify(raw.slice(0, 40))})` };
    }
    if (typeof valor === 'string') {
        return { ok: false, error: 'data doble serializado y el interior no es JSON' };
    }
    let doble = false;
    try { doble = typeof JSON.parse(raw) === 'string'; } catch { /* ya parseo arriba */ }
    return { ok: true, valor, doble };
}

/**
 * Deja la fila en su forma exportable: `data` parseada, el resto intacto.
 * @returns {{ok: true, fila: object, doble: boolean} | {ok: false, error: string}}
 */
export function prepararFila(fila) {
    if (!Object.prototype.hasOwnProperty.call(fila, 'data')) return { ok: true, fila, doble: false };
    const r = normalizarData(fila.data);
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, fila: { ...fila, data: r.valor }, doble: r.doble };
}

// --------------------------------------------------------------------------
// Claves, nombres de archivo y etiquetas
// --------------------------------------------------------------------------

const EXCLUIDAS_EXACTAS = new Set(['backup_amfe_20260819_ingles']);

/** Copias viejas que viven dentro de la base: no se exportan. */
export function esTablaExcluida(tabla) {
    return tabla.startsWith('_bk_') || tabla.startsWith('_backup_') || EXCLUIDAS_EXACTAS.has(tabla);
}

/** Clave de una fila a partir de las columnas de su clave primaria. */
export function claveDeFila(fila, pk) {
    return pk.map((col) => {
        const v = fila[col];
        if (v === null || v === undefined || v === '') throw new Error(`fila sin valor en la clave "${col}"`);
        return String(v);
    }).join('__');
}

const NOMBRES_RESERVADOS_WINDOWS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** Devuelve la clave lista para usar de nombre de archivo, o tira error: no se adivina. */
export function claveArchivoSegura(clave) {
    const c = String(clave);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(c) || c.endsWith('.') || NOMBRES_RESERVADOS_WINDOWS.test(c.split('.')[0])) {
        throw new Error(`la clave ${JSON.stringify(c)} no sirve de nombre de archivo (solo letras, numeros, . _ -)`);
    }
    return c;
}

/** Orden de las filas de un archivo unico: numerico si la clave es numerica, si no texto. */
export function compararFilas(a, b, pk) {
    for (const col of pk) {
        const x = a[col], y = b[col];
        if (typeof x === 'number' && typeof y === 'number') {
            if (x !== y) return x - y;
        } else {
            const sx = String(x), sy = String(y);
            if (sx !== sy) return sx < sy ? -1 : 1;
        }
    }
    return 0;
}

const CAMPOS_ETIQUETA = ['amfe_number', 'control_plan_number', 'bom_number', 'document_number', 'form_number',
    'amfe_code', 'codigo', 'code', 'name', 'project_name', 'key'];

/** Nombre legible de una fila para el manifest (no entra al hash). */
export function etiquetaDe(fila) {
    for (const campo of CAMPOS_ETIQUETA) {
        const v = fila[campo];
        if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 120);
    }
    if (fila.module && fila.document_key) return `${fila.module}/${fila.document_key}`.slice(0, 120);
    return null;
}

// --------------------------------------------------------------------------
// Plan de una tabla: que archivos salen y que dice el manifest de cada fila
// --------------------------------------------------------------------------

/**
 * @param {{tabla: string, filas: object[], pk: string[]}} p
 * @returns {{modo: 'archivo-por-fila'|'archivo-unico', archivos: {ruta: string, contenido: string}[],
 *   documentos: Record<string, object>, errores: string[], dobles: string[], hashes: Map<string,string>}}
 */
export function planificarTabla({ tabla, filas, pk }) {
    const errores = [];
    const dobles = [];
    const buenas = []; // {clave, fila, hash}
    const vistas = new Set();

    for (const cruda of filas) {
        let clave;
        try {
            clave = claveDeFila(cruda, pk);
        } catch (e) {
            errores.push(`${tabla}: ${e.message}`);
            continue;
        }
        if (vistas.has(clave)) {
            errores.push(`${tabla}/${clave}: clave repetida en la tabla`);
            continue;
        }
        vistas.add(clave);
        const prep = prepararFila(cruda);
        if (!prep.ok) {
            errores.push(`${tabla}/${clave}: ${prep.error}`);
            continue;
        }
        if (prep.doble) dobles.push(clave);
        buenas.push({ clave, fila: prep.fila, hash: hashDeFila(prep.fila), doble: prep.doble });
    }

    buenas.sort((a, b) => compararFilas(a.fila, b.fila, pk));
    const porFila = filas.length > 0 && Object.prototype.hasOwnProperty.call(filas[0], 'data');
    const modo = porFila ? 'archivo-por-fila' : 'archivo-unico';

    const documentos = {};
    const hashes = new Map();
    for (const { clave, fila, hash, doble } of buenas) {
        const entrada = { sha256: hash, updated_at: fila.updated_at ?? null };
        const etiqueta = etiquetaDe(fila);
        if (etiqueta) entrada.etiqueta = etiqueta;
        if (tabla === 'amfe_documents') {
            const st = countAmfeStats(fila.data);
            entrada.operaciones = st.opCount;
            entrada.causas = st.causeCount;
            if (fila.operation_count !== st.opCount || fila.cause_count !== st.causeCount) {
                entrada.conteos_de_la_fila_desfasados = { operation_count: fila.operation_count, cause_count: fila.cause_count };
            }
        }
        if (doble) entrada.data_doble_serializado = true;
        documentos[clave] = entrada;
        hashes.set(clave, hash);
    }

    const archivos = [];
    if (porFila) {
        for (const { clave, fila } of buenas) {
            try {
                archivos.push({ ruta: `${tabla}/${claveArchivoSegura(clave)}.json`, contenido: canonicoTexto(fila) });
            } catch (e) {
                errores.push(`${tabla}/${clave}: ${e.message}`);
                delete documentos[clave];
                hashes.delete(clave);
            }
        }
    } else if (buenas.length > 0) {
        archivos.push({ ruta: `${tabla}.json`, contenido: canonicoTexto(buenas.map((b) => b.fila)) });
    }
    return { modo, archivos, documentos, errores, dobles, hashes };
}

// --------------------------------------------------------------------------
// Disco: escribir, leer y comparar
// --------------------------------------------------------------------------

/** Escribe los archivos que cambiaron. No borra nada. */
export function escribirArchivos(dir, archivos) {
    let escritos = 0, sinCambios = 0;
    for (const { ruta, contenido } of archivos) {
        const destino = join(dir, ruta);
        if (existsSync(destino) && readFileSync(destino, 'utf8') === contenido) { sinCambios++; continue; }
        mkdirSync(dirname(destino), { recursive: true });
        writeFileSync(destino, contenido, 'utf8');
        escritos++;
    }
    return { escritos, sinCambios };
}

/**
 * Lee lo que hay en disco de una tabla y calcula el hash canonico de cada fila.
 * @returns {{modo: string|null, hashes: Map<string,string>, noCanonicos: string[], anomalias: string[]}}
 */
export function leerTablaDeDisco(dir, tabla, pk) {
    const hashes = new Map();
    const noCanonicos = [];
    const anomalias = [];
    const carpeta = join(dir, tabla);
    const unico = join(dir, `${tabla}.json`);

    if (existsSync(carpeta)) {
        for (const nombre of readdirSync(carpeta).filter((n) => n.endsWith('.json')).sort()) {
            const texto = readFileSync(join(carpeta, nombre), 'utf8');
            let obj;
            try { obj = JSON.parse(texto); } catch (e) { anomalias.push(`${tabla}/${nombre}: no es JSON (${e.message})`); continue; }
            const clave = nombre.slice(0, -5);
            let claveInterna;
            try { claveInterna = claveDeFila(obj, pk); } catch (e) { anomalias.push(`${tabla}/${nombre}: ${e.message}`); continue; }
            if (claveInterna !== clave) { anomalias.push(`${tabla}/${nombre}: el archivo dice clave ${claveInterna}`); continue; }
            if (texto !== canonicoTexto(obj)) noCanonicos.push(`${tabla}/${nombre}`);
            hashes.set(clave, hashDeFila(obj));
        }
        return { modo: 'archivo-por-fila', hashes, noCanonicos, anomalias };
    }
    if (existsSync(unico)) {
        const texto = readFileSync(unico, 'utf8');
        let arreglo;
        try { arreglo = JSON.parse(texto); } catch (e) { anomalias.push(`${tabla}.json: no es JSON (${e.message})`); return { modo: 'archivo-unico', hashes, noCanonicos, anomalias }; }
        if (!Array.isArray(arreglo)) { anomalias.push(`${tabla}.json: no es un arreglo`); return { modo: 'archivo-unico', hashes, noCanonicos, anomalias }; }
        if (texto !== canonicoTexto(arreglo)) noCanonicos.push(`${tabla}.json`);
        for (const obj of arreglo) {
            let clave;
            try { clave = claveDeFila(obj, pk); } catch (e) { anomalias.push(`${tabla}.json: ${e.message}`); continue; }
            if (hashes.has(clave)) { anomalias.push(`${tabla}.json: clave repetida ${clave}`); continue; }
            hashes.set(clave, hashDeFila(obj));
        }
        return { modo: 'archivo-unico', hashes, noCanonicos, anomalias };
    }
    return { modo: null, hashes, noCanonicos, anomalias };
}

/**
 * Compara el hash de cada fila viva contra el del archivo.
 * @param {Map<string,string>} vivo  clave -> hash de lo que hay en Supabase
 * @param {Map<string,string>} disco clave -> hash de lo que hay en los archivos
 */
export function compararHashes(vivo, disco) {
    const iguales = [], distintos = [], faltantes = [], sobrantes = [];
    for (const [clave, hash] of vivo) {
        if (!disco.has(clave)) faltantes.push(clave);
        else if (disco.get(clave) === hash) iguales.push(clave);
        else distintos.push(clave);
    }
    for (const clave of disco.keys()) if (!vivo.has(clave)) sobrantes.push(clave);
    return { iguales, distintos, faltantes, sobrantes };
}

// --------------------------------------------------------------------------
// Supabase (solo lectura): inventario, claves primarias y descarga paginada
// --------------------------------------------------------------------------

// Misma consulta que _backup.mjs: los conteos reales salen del RPC (no dependen de RLS).
const SQL_INVENTARIO = `
  select table_name,
         (xpath('/row/c/text()',
           query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name),
                        false, true, '')))[1]::text::bigint as filas
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by table_name`;

const SQL_CLAVES_PRIMARIAS = `
  select tc.table_name, kcu.column_name, kcu.ordinal_position
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
   and tc.table_name = kcu.table_name
  where tc.table_schema = 'public' and tc.constraint_type = 'PRIMARY KEY'
  order by tc.table_name, kcu.ordinal_position`;

const PAGINA = 1000;

async function leerSql(sb, query) {
    const { data, error } = await sb.rpc('exec_sql_read', { query, params: [] });
    if (error || !Array.isArray(data)) throw new Error(`exec_sql_read fallo: ${error?.message || 'respuesta vacia'}`);
    return data;
}

/** @returns {Promise<{conteos: Map<string, number>, pks: Map<string, string[]>}>} */
export async function inventariar(sb) {
    const inventario = await leerSql(sb, SQL_INVENTARIO);
    if (inventario.length === 0) throw new Error('el inventario de tablas vino vacio (login sin permisos o proyecto pausado)');
    const pks = new Map();
    for (const r of await leerSql(sb, SQL_CLAVES_PRIMARIAS)) {
        if (!pks.has(r.table_name)) pks.set(r.table_name, []);
        pks.get(r.table_name).push(r.column_name);
    }
    return { conteos: new Map(inventario.map((r) => [r.table_name, Number(r.filas)])), pks };
}

async function bajarTabla(sb, tabla, pk) {
    const filas = [];
    for (let desde = 0; ; desde += PAGINA) {
        let q = sb.from(tabla).select('*');
        for (const col of pk) q = q.order(col, { ascending: true });
        const { data, error } = await q.range(desde, desde + PAGINA - 1);
        if (error) return { error: error.message };
        filas.push(...(data || []));
        if (!data || data.length < PAGINA) break;
    }
    return { filas };
}

/** Tablas que se exportan: con filas y no excluidas. Devuelve tambien lo que queda afuera. */
export function clasificarTablas(conteos) {
    const exportables = [], excluidas = {}, vacias = [];
    for (const [tabla, n] of conteos) {
        if (n === 0) vacias.push(tabla);
        else if (esTablaExcluida(tabla)) excluidas[tabla] = n;
        else exportables.push(tabla);
    }
    return { exportables, excluidas, vacias };
}

/**
 * Baja una tabla y la deja lista: plan de archivos o el motivo por el que no se puede.
 * Un descuadre contra el conteo real (RLS, paginacion, cambio en el medio) invalida la tabla.
 */
export async function prepararTablaViva(sb, tabla, esperadas, pk) {
    if (!pk || pk.length === 0) return { error: `${tabla}: no tiene clave primaria (no se adivina la clave)` };
    const { filas, error } = await bajarTabla(sb, tabla, pk);
    if (error) return { error: `${tabla}: no se pudo leer (${error})` };
    if (filas.length !== esperadas) {
        return { error: `${tabla}: se leyeron ${filas.length} filas y el conteo real es ${esperadas} (RLS, paginacion o un cambio en el medio)` };
    }
    return { plan: planificarTabla({ tabla, filas, pk }) };
}

// --------------------------------------------------------------------------
// Exportar
// --------------------------------------------------------------------------

function sinGenerado(m) {
    const { generado, ...resto } = m; // eslint-disable-line no-unused-vars
    return resto;
}

export async function exportar({ sb, dir, log = console.log }) {
    const { conteos, pks } = await inventariar(sb);
    const { exportables, excluidas, vacias } = clasificarTablas(conteos);
    log(`  inventario: ${conteos.size} tablas; se exportan ${exportables.length}, vacias ${vacias.length}, copias viejas excluidas ${Object.keys(excluidas).length}`);

    const tablas = {};
    const errores = [];
    let totalFilas = 0, escritos = 0, sinCambios = 0;

    for (const tabla of exportables) {
        const esperadas = conteos.get(tabla);
        const r = await prepararTablaViva(sb, tabla, esperadas, pks.get(tabla));
        if (r.error) {
            log(`  X  ${tabla}: ${r.error}`);
            errores.push(r.error);
            continue;
        }
        const { plan } = r;
        errores.push(...plan.errores);
        const w = escribirArchivos(dir, plan.archivos);
        escritos += w.escritos;
        sinCambios += w.sinCambios;
        const filas = Object.keys(plan.documentos).length;
        totalFilas += filas;
        const entrada = { modo: plan.modo, filas, documentos: plan.documentos };
        if (plan.modo === 'archivo-unico') {
            entrada.archivo = `${tabla}.json`;
            entrada.sha256_archivo = sha256(plan.archivos[0].contenido);
        }
        tablas[tabla] = entrada;
        const marca = plan.errores.length ? 'X ' : 'OK';
        const extra = plan.dobles.length ? ` (${plan.dobles.length} con data doble serializado)` : '';
        log(`  ${marca} ${tabla}: ${filas}/${esperadas} filas, ${plan.modo}${extra}${plan.errores.length ? `, ${plan.errores.length} con error` : ''}`);
    }

    const manifest = { formato: FORMATO, generado: new Date().toISOString(), totalFilas, tablas, excluidas, vacias, errores };
    const rutaManifest = join(dir, '_manifest.json');
    let manifestEscrito = true;
    if (existsSync(rutaManifest)) {
        try {
            const previo = JSON.parse(readFileSync(rutaManifest, 'utf8'));
            // Si solo cambio la hora, no se reescribe: evita un diff vacio en cada corrida.
            if (canonicoTexto(sinGenerado(previo)) === canonicoTexto(sinGenerado(manifest))) manifestEscrito = false;
        } catch { /* manifest roto: se reescribe */ }
    }
    if (manifestEscrito) writeFileSync(rutaManifest, canonicoTexto(manifest), 'utf8');

    return { manifest, errores, totalFilas, escritos, sinCambios, manifestEscrito };
}

// --------------------------------------------------------------------------
// Verificar
// --------------------------------------------------------------------------

export async function verificar({ sb, dir, log = console.log }) {
    const { conteos, pks } = await inventariar(sb);
    const { exportables } = clasificarTablas(conteos);

    let manifest = null;
    const rutaManifest = join(dir, '_manifest.json');
    if (existsSync(rutaManifest)) {
        try { manifest = JSON.parse(readFileSync(rutaManifest, 'utf8')); } catch { /* se informa abajo */ }
    }
    const nombres = [...new Set([...exportables, ...Object.keys(manifest?.tablas ?? {})])].sort();

    const filasTabla = [];
    const problemas = [];
    const detalle = [];
    if (!manifest) problemas.push('no hay _manifest.json legible en la carpeta destino');

    for (const tabla of nombres) {
        const pk = pks.get(tabla);
        const esperadas = conteos.get(tabla) ?? 0;
        let hashesVivos = new Map();
        let erroresVivos = [];
        if (esperadas > 0 && exportables.includes(tabla)) {
            const r = await prepararTablaViva(sb, tabla, esperadas, pk);
            if (r.error) { problemas.push(r.error); continue; }
            hashesVivos = r.plan.hashes;
            erroresVivos = r.plan.errores;
        }
        const disco = leerTablaDeDisco(dir, tabla, pk ?? ['id']);
        const cmp = compararHashes(hashesVivos, disco.hashes);
        // El manifest tambien tiene que decir lo mismo que los archivos.
        const enManifest = manifest?.tablas?.[tabla]?.documentos ?? {};
        const manifestDistinto = [...disco.hashes].filter(([c, h]) => enManifest[c]?.sha256 !== h).map(([c]) => c);

        filasTabla.push({ tabla, vivo: esperadas, archivos: disco.hashes.size, ...Object.fromEntries(Object.entries(cmp).map(([k, v]) => [k, v.length])) });
        for (const [etq, lista] of [['distintos', cmp.distintos], ['faltantes', cmp.faltantes], ['sobrantes', cmp.sobrantes]]) {
            if (lista.length) { problemas.push(`${tabla}: ${lista.length} ${etq}`); detalle.push(`  ${tabla} ${etq}: ${lista.slice(0, 10).join(', ')}${lista.length > 10 ? ' ...' : ''}`); }
        }
        if (erroresVivos.length) { problemas.push(`${tabla}: ${erroresVivos.length} filas vivas con error`); detalle.push(...erroresVivos.map((e) => `  ${e}`)); }
        if (disco.anomalias.length) { problemas.push(`${tabla}: ${disco.anomalias.length} archivos anomalos`); detalle.push(...disco.anomalias.map((e) => `  ${e}`)); }
        if (disco.noCanonicos.length) { problemas.push(`${tabla}: ${disco.noCanonicos.length} archivos que no estan en formato canonico`); detalle.push(...disco.noCanonicos.map((e) => `  ${e}`)); }
        if (manifestDistinto.length) { problemas.push(`${tabla}: ${manifestDistinto.length} filas que el manifest no describe bien`); detalle.push(`  ${tabla} manifest desactualizado: ${manifestDistinto.slice(0, 10).join(', ')}`); }
    }

    const ancho = Math.max(...filasTabla.map((f) => f.tabla.length), 5);
    log(`\n${'tabla'.padEnd(ancho)}  ${'vivo'.padStart(5)} ${'archivos'.padStart(8)} ${'iguales'.padStart(8)} ${'distintos'.padStart(9)} ${'faltantes'.padStart(9)} ${'sobrantes'.padStart(9)}`);
    for (const f of filasTabla) {
        log(`${f.tabla.padEnd(ancho)}  ${String(f.vivo).padStart(5)} ${String(f.archivos).padStart(8)} ${String(f.iguales).padStart(8)} ${String(f.distintos).padStart(9)} ${String(f.faltantes).padStart(9)} ${String(f.sobrantes).padStart(9)}`);
    }
    const suma = (k) => filasTabla.reduce((a, f) => a + f[k], 0);
    log(`${'TOTAL'.padEnd(ancho)}  ${String(suma('vivo')).padStart(5)} ${String(suma('archivos')).padStart(8)} ${String(suma('iguales')).padStart(8)} ${String(suma('distintos')).padStart(9)} ${String(suma('faltantes')).padStart(9)} ${String(suma('sobrantes')).padStart(9)}`);
    if (detalle.length) log(`\nDetalle:\n${detalle.join('\n')}`);
    return { filasTabla, problemas };
}

// --------------------------------------------------------------------------
// CLI
// --------------------------------------------------------------------------

function argumento(args, nombre) {
    const i = args.indexOf(nombre);
    return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
    const args = process.argv.slice(2);
    const destino = argumento(args, '--out') ?? carpetaNube();
    if (!destino) {
        console.error('\n✗ ABORTADO — no encuentro la biblioteca de Ingenieria en esta PC (BARACK ARGENTINA SRL\\Ingenieria y Proyecto - General).'
            + '\n  Los datos van a la nube, no a una carpeta local: abrir OneDrive y esperar que sincronice, o pasar la carpeta con --out.\n');
        process.exit(1);
    }
    const dir = resolve(destino);
    const raizRepo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    if (dir.toLowerCase() === raizRepo.toLowerCase() || dir.toLowerCase().startsWith((raizRepo + sep).toLowerCase())) {
        console.error(`\n✗ ABORTADO — la carpeta destino (${dir}) esta adentro del repo de la app. Los datos van a la nube de Ingenieria.\n`);
        process.exit(1);
    }
    const t0 = Date.now();
    let sb;
    try {
        sb = await connectSupabase();
    } catch (e) {
        console.error(`\n✗ ABORTADO — ${e.message}\n`);
        process.exit(1);
    }
    console.log('  auth OK (solo lectura)');
    const modoVerificar = args.includes('--verificar');
    console.log(`  destino: ${dir}`);
    const nube = carpetaNube();
    if (!modoVerificar && !args.includes('--pisar') && nube && resolve(nube).toLowerCase() === dir.toLowerCase()) {
        console.error('\n✗ ABORTADO — la carpeta de la nube se actualiza con `node scripts/_datosSincronizar.mjs --aplicar`,'
            + '\n  que no pisa un archivo que cambio en la nube. Este script escribe todo lo que difiere:'
            + '\n  contra la nube solo corre con --pisar (primera copia o reconstruccion a proposito).\n');
        process.exit(1);
    }

    try {
        if (modoVerificar) {
            const { problemas } = await verificar({ sb, dir });
            const seg = ((Date.now() - t0) / 1000).toFixed(1);
            if (problemas.length) {
                console.error(`\n✗ VERIFICACION CON DIFERENCIAS (${problemas.length}):`);
                for (const p of problemas) console.error(`    - ${p}`);
                console.error(`  (${seg} s)\n`);
                process.exit(1);
            }
            console.log(`\n✓ Verificado: todo lo vivo esta en los archivos, sin diferencias ni sobrantes (${seg} s)`);
            return;
        }
        mkdirSync(dir, { recursive: true });
        const r = await exportar({ sb, dir });
        const seg = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`\nExportado: ${r.totalFilas} filas en ${Object.keys(r.manifest.tablas).length} tablas; ${r.escritos} archivos escritos, ${r.sinCambios} sin cambios; manifest ${r.manifestEscrito ? 'escrito' : 'igual (no se reescribio)'} (${seg} s)`);
        if (r.errores.length) {
            console.error(`\n✗ EXPORTACION CON ${r.errores.length} ERROR(ES) — lo que fallo NO se escribio:`);
            for (const e of r.errores) console.error(`    - ${e}`);
            process.exit(1);
        }
        console.log('✓ Exportacion completa, sin errores. Siguiente paso: node scripts/_datosExportar.mjs --verificar');
    } catch (e) {
        console.error(`\n✗ ABORTADO — ${e.message}\n`);
        process.exit(1);
    }
}

// Solo corre como script; importado (por el test) no hace nada.
const comoScript = process.argv[1]
    && resolve(process.argv[1]).toLowerCase() === resolve(fileURLToPath(import.meta.url)).toLowerCase();
if (comoScript) await main();
