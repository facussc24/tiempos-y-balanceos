/**
 * lib.mjs - piezas comunes del buscador de "un Claude por area" (indexar.mjs, buscar.mjs, cita.mjs).
 *
 * Sin dependencias: solo modulos de Node. El indice es un archivo SQLite con FTS5, que Node 22 trae
 * adentro (`node:sqlite`): sirve el node.exe suelto del instalador, sin npm install.
 *
 * Que hace cada parte:
 *   - normalizar()           quita tildes y mayusculas (la misma regla para el indice, la consulta y la cita)
 *   - partirEnSecciones()    parte un documento en secciones con sus renglones reales del archivo
 *   - analizarConsulta()     pasa lo que escribe la persona a terminos del buscador (sin tildes, plurales)
 *   - buscarPasajes()        busca en el indice y devuelve pasajes con su recorte
 *   - revisarFrescura()      dice si el conocimiento cambio despues de armar el indice
 *   - buscarFrase()          (para cita.mjs) encuentra una frase textual en un documento
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const FORMATO = 1;
export const EXTENSIONES = ['.md', '.txt'];
export const AREA_RAIZ = 'raiz';
export const OBJETIVO_BLOQUE = 40; // renglones por bloque cuando no hay titulos
export const TOPE_SECCION = 60;    // una seccion mas larga que esto se parte en bloques

export class ErrorUso extends Error {}

// ---------------------------------------------------------------------------------------------
// Texto: tildes, mayusculas, espacios
// ---------------------------------------------------------------------------------------------

/** Minusculas y sin tildes ("Inspección" -> "inspeccion", "Ñandú" -> "nandu"). */
export function normalizar(s) {
    return String(s).normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
}

/**
 * Igual que normalizar() pero devuelve tambien, por cada letra del resultado, donde estaba en el
 * texto original (sirve para cortar un renglon largo alrededor de lo encontrado).
 */
export function normalizarConMapa(s) {
    let out = '';
    const mapa = [];
    let i = 0;
    for (const ch of s) {
        const n = ch.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
        for (const c of n) {
            out += c;
            for (let k = 0; k < c.length; k++) mapa.push(i);
        }
        i += ch.length;
    }
    return { texto: out, mapa };
}

export function sha256De(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function fechaLocalISO(d = new Date()) {
    const p = (n, l = 2) => String(n).padStart(l, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** "2026-10-01T18:30:00" -> "01/10/2026 18:30" */
export function fechaCorta(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(iso || ''));
    return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : String(iso || '?');
}

export function leerTexto(buffer) {
    let t = buffer.toString('utf8');
    if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
    return t;
}

// ---------------------------------------------------------------------------------------------
// Argumentos de linea de comandos
// ---------------------------------------------------------------------------------------------

/**
 * def = { valor: ['--area', ...], bandera: ['--json', ...] }
 * Una opcion que no existe o un valor que falta es un error de una linea (no se ejecuta nada).
 */
export function leerArgs(argv, def) {
    const pos = [];
    const opts = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--') { pos.push(...argv.slice(i + 1)); break; }
        if (/^--?[A-Za-z]/.test(a) && a.length > 1 && !/^-\d/.test(a)) {
            const eq = a.indexOf('=');
            const nombre = eq > 0 ? a.slice(0, eq) : a;
            const inline = eq > 0 ? a.slice(eq + 1) : undefined;
            if (def.bandera.includes(nombre)) {
                if (inline !== undefined) throw new ErrorUso(`La opción ${nombre} no lleva valor.`);
                opts[nombre] = true;
            } else if (def.valor.includes(nombre)) {
                const v = inline !== undefined ? inline : argv[++i];
                if (v === undefined) throw new ErrorUso(`Falta el valor de ${nombre}.`);
                opts[nombre] = v;
            } else {
                throw new ErrorUso(`No conozco la opción ${a}. Probá con --help.`);
            }
        } else {
            pos.push(a);
        }
    }
    return { pos, opts };
}

// ---------------------------------------------------------------------------------------------
// SQLite (node:sqlite)
// ---------------------------------------------------------------------------------------------

/** Carga node:sqlite sin el cartel "ExperimentalWarning" (que el asistente leeria como un error). */
export async function cargarSqlite() {
    const original = process.emitWarning;
    process.emitWarning = function (w, ...resto) {
        const msg = typeof w === 'string' ? w : (w && w.message) || '';
        if (/sqlite/i.test(msg)) return;
        return original.call(process, w, ...resto);
    };
    try {
        return await import('node:sqlite');
    } catch {
        throw new ErrorUso(`Este Node (${process.version}) no trae el motor de búsqueda. Hace falta Node 22.5 o más nuevo.`);
    } finally {
        process.emitWarning = original;
    }
}

// ---------------------------------------------------------------------------------------------
// Recorrer el conocimiento
// ---------------------------------------------------------------------------------------------

/** Los .md y .txt del conocimiento, en orden fijo. El area es la primera carpeta (los sueltos en la raiz: "raiz"). */
export function listarArchivos(raiz) {
    const out = [];
    const rec = (dir, rel) => {
        let ents;
        try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        ents.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        for (const e of ents) {
            if (e.name.startsWith('.') || e.name === 'node_modules') continue;
            const abs = path.join(dir, e.name);
            const r = rel ? `${rel}/${e.name}` : e.name;
            if (e.isDirectory()) rec(abs, r);
            else if (e.isFile() && EXTENSIONES.includes(path.extname(e.name).toLowerCase())) {
                out.push({ rel: r, abs, area: rel ? r.split('/')[0].toLowerCase() : AREA_RAIZ });
            }
        }
    };
    rec(raiz, '');
    return out;
}

// ---------------------------------------------------------------------------------------------
// Partir un documento en secciones
// ---------------------------------------------------------------------------------------------

const RE_MD = /^(#{1,6})\s+(.*\S)\s*$/;
const RE_ROMANO = /^ {0,3}([IVX]{1,5})\.\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 ,/()\-]{2,80}?)\.?\s*$/;
const RE_ARABIGO_MAYUS = /^ {0,3}(\d{1,2})\.\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 ,/()\-]{2,80}?)\.?\s*$/;
const RE_MULTINIVEL = /^ {0,3}(\d{1,2}(?:\.\d{1,3})+)\.?\s+(\p{Lu}.*\S)\s*$/u;
const RE_ANEXOS = /^ {0,3}(ANEXOS?)\.?\s*$/;
const RE_ANEXO_N = /^ {0,3}Anexo\s+([IVX]+|\d+)\b[.:\s-]*(.*)$/i;
const RE_NUMERAL_EN_TITULO = /^(\d{1,2}(?:\.\d{1,3})*|[IVX]{1,5}(?=\.))\.?\s+(.+)$/;

function acortar(t, n = 90) {
    t = t.replace(/\s+/g, ' ').trim().replace(/\.$/, '');
    if (t.length <= n) return t;
    const corte = t.lastIndexOf(' ', n);
    return t.slice(0, corte > n / 2 ? corte : n) + '…';
}

function limpiarTitulo(t) {
    return t.replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();
}

/** "5.2. Analisis del Producto" -> { numeral: '5.2', titulo: 'Analisis del Producto' } */
function separarNumeral(texto) {
    const t = limpiarTitulo(texto);
    const m = RE_NUMERAL_EN_TITULO.exec(t);
    if (m) return { numeral: m[1], titulo: acortar(m[2]) };
    return { numeral: '', titulo: acortar(t) };
}

function detectarNumeral(linea) {
    let m;
    if ((m = RE_ROMANO.exec(linea))) return { numeral: m[1], titulo: acortar(m[2]) };
    if ((m = RE_ARABIGO_MAYUS.exec(linea))) return { numeral: m[1], titulo: acortar(m[2]) };
    if ((m = RE_MULTINIVEL.exec(linea))) return { numeral: m[1], titulo: acortar(m[2]) };
    if ((m = RE_ANEXOS.exec(linea))) return { numeral: '', titulo: 'ANEXOS' };
    if ((m = RE_ANEXO_N.exec(linea))) return { numeral: `Anexo ${m[1]}`, titulo: acortar(m[2] || '') };
    return null;
}

/** Parte [a, b) en tramos de ~OBJETIVO_BLOQUE renglones, cortando de preferencia en un renglon en blanco. */
function trocear(lineas, a, b) {
    if (b - a <= TOPE_SECCION) return [[a, b]];
    const out = [];
    let ini = a;
    while (b - ini > TOPE_SECCION) {
        const objetivo = ini + OBJETIVO_BLOQUE;
        let corte = objetivo;
        let mejor = Infinity;
        for (let k = objetivo - 10; k <= objetivo + 15; k++) {
            if (k > ini + 10 && k < b - 10 && lineas[k].trim() === '' && Math.abs(k - objetivo) < mejor) {
                mejor = Math.abs(k - objetivo);
                corte = k;
            }
        }
        out.push([ini, corte]);
        ini = corte;
    }
    out.push([ini, b]);
    return out;
}

/** Cabecera `---` ... `---` con renglones `clave: valor`. */
export function leerCabecera(lineas) {
    const meta = {};
    if (!lineas.length || lineas[0].trim() !== '---') return { meta, fin: 0 };
    let j = -1;
    for (let k = 1; k < Math.min(lineas.length, 80); k++) {
        if (lineas[k].trim() === '---') { j = k; break; }
    }
    if (j < 0) return { meta, fin: 0 };
    for (let k = 1; k < j; k++) {
        const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(lineas[k]);
        if (!m) continue;
        let v = m[2].trim();
        if (/^(".*"|'.*')$/.test(v)) v = v.slice(1, -1);
        meta[m[1].toLowerCase()] = v;
    }
    return { meta, fin: j + 1 };
}

/** Codigo de un documento del SGC ("I-AC-018", "P-13", "F-62", "MC-00") al principio de un texto. */
export function codigoDe(texto) {
    const m = /^\s*([A-Z]{1,3}-(?:[A-Z]{1,3}-)?\d{1,4}(?:\.\d+)*(?:-R\d{1,2})?)(?=[\s_]|$)/.exec(texto);
    return m ? m[1] : '';
}

/**
 * Parte un documento. Devuelve la cabecera, los datos del documento y las secciones:
 *   { numeral, titulo, desde, hasta, texto }   (desde/hasta: renglones reales del archivo, desde 1)
 * Como se decide (en este orden):
 *   1. si el archivo tiene titulos `##` o menores: se parte por los titulos `#`;
 *   2. si no, por numerales: `5.2.3 Titulo`, `1. PROPOSITO.`, `IV. FUNCIONES.`, `Anexo I`;
 *   3. si tampoco, por bloques de ~40 renglones.
 * Una seccion mas larga que 60 renglones se parte en bloques.
 */
export function partirEnSecciones(texto, nombreArchivo = '') {
    const lineas = texto.split(/\r?\n/);
    if (lineas.length && lineas[lineas.length - 1] === '') lineas.pop();
    const { meta, fin } = leerCabecera(lineas);
    const n = lineas.length;

    // titulos markdown (sin mirar adentro de bloques de codigo)
    const md = [];
    let enCodigo = false;
    for (let i = fin; i < n; i++) {
        if (/^\s*```/.test(lineas[i])) { enCodigo = !enCodigo; continue; }
        if (enCodigo) continue;
        const m = RE_MD.exec(lineas[i]);
        if (m) md.push({ i, nivel: m[1].length, texto: m[2] });
    }
    const h1 = md.find((h) => h.nivel === 1) || null;

    let cortes = [];
    let modo = 'bloques';
    if (md.some((h) => h.nivel >= 2)) {
        modo = 'titulos';
        cortes = md.map((h) => ({ i: h.i, ...separarNumeral(h.texto) }));
    } else {
        const num = [];
        for (let i = fin; i < n; i++) {
            if (h1 && i === h1.i) continue;
            const d = detectarNumeral(lineas[i]);
            if (d) num.push({ i, ...d });
        }
        // el titulo del documento (H1) ya esta en `documento`: como seccion no lleva titulo propio
        if (num.length >= 2) {
            modo = 'numerales';
            cortes = num;
            if (h1) cortes.unshift({ i: h1.i, numeral: '', titulo: '' });
        } else if (h1) {
            cortes = [{ i: h1.i, numeral: '', titulo: '' }];
        }
    }

    // tramos: lo que va antes del primer corte y cada corte hasta el siguiente
    const tramos = [];
    const primero = cortes.length ? cortes[0].i : n;
    if (primero > fin) tramos.push({ a: fin, b: primero, numeral: '', titulo: '', conTitulo: false });
    cortes.forEach((c, k) => {
        tramos.push({ a: c.i, b: k + 1 < cortes.length ? cortes[k + 1].i : n, numeral: c.numeral, titulo: c.titulo, conTitulo: true });
    });

    const secciones = [];
    let pendiente = null; // un titulo suelto (sin nada abajo) se pega a la seccion que le sigue
    for (const t of tramos) {
        let a = t.a;
        let b = t.b;
        while (a < b && lineas[a].trim() === '') a++;
        while (b > a && lineas[b - 1].trim() === '') b--;
        if (a >= b) continue;
        const cuerpo = lineas.slice(t.conTitulo ? a + 1 : a, b).filter((l) => l.trim() !== '');
        if (cuerpo.length === 0) { if (pendiente === null) pendiente = a; continue; }
        if (pendiente !== null) { a = pendiente; pendiente = null; }
        const partes = trocear(lineas, a, b);
        partes.forEach(([pa, pb], idx) => {
            let x = pa;
            let y = pb;
            while (x < y && lineas[x].trim() === '') x++;
            while (y > x && lineas[y - 1].trim() === '') y--;
            if (x >= y) return;
            let titulo = t.titulo;
            if (partes.length > 1) titulo = `${titulo ? titulo + ' ' : ''}(parte ${idx + 1}/${partes.length})`;
            secciones.push({ numeral: t.numeral, titulo, desde: x + 1, hasta: y, texto: lineas.slice(x, y).join('\n') });
        });
    }

    // datos del documento
    const stem = path.basename(nombreArchivo, path.extname(nombreArchivo));
    const h1Texto = h1 ? limpiarTitulo(h1.texto) : '';
    let codigo = codigoDe(stem) || codigoDe(h1Texto);
    let nombre = h1Texto.replace(/\s*\((?:rev|revisi[oó]n)\.?\s*[^)]*\)\s*$/i, '');
    if (codigo && nombre.startsWith(codigo)) nombre = nombre.slice(codigo.length).trim();
    if (!nombre) nombre = limpiarTitulo(meta.titulo || '') || (codigo ? stem.replace(codigo, '').trim() : stem);
    nombre = acortar(nombre, 110);
    const documento = codigo ? `${codigo} ${nombre}`.trim() : nombre;

    let rev = (meta.rev || '').trim();
    if (!rev) { // sin cabecera, la revision de "(rev B)" del titulo
        const m = /\((?:rev|revisi[oó]n)\.?\s*([^)]*\S)\s*\)\s*$/i.exec(h1Texto);
        if (m) rev = m[1].trim();
    }
    if (!rev && meta.version) {
        const v = /^\S+/.exec(meta.version.trim());
        if (v) rev = `v${v[0].replace(/^v/i, '')}`;
    }

    return { meta, modo, codigo, documento, rev, fuente: meta.fuente || '', lineas: n, secciones };
}

// ---------------------------------------------------------------------------------------------
// La consulta: de lo que escribe la persona a terminos del buscador
// ---------------------------------------------------------------------------------------------

const PALABRAS_VACIAS = new Set((
    'de del la el los las lo un una unos unas y o u e en a al que se es por con para su sus mi mis tu tus ' +
    'como mas pero si no ya hay son ser esta este esto eso esa ese cual cuales cuando donde quien quienes cuanto ' +
    'cuanta cuantos cuantas me te nos sobre entre hasta desde hago hace hacer debo debe deben puedo puede pueden ' +
    'tengo tiene tienen pasa fue era sea sin segun ante bajo tras muy tambien ni despues antes luego cada dice dicen'
).split(' '));

/** Saca el plural y la terminacion de genero para buscar por prefijo ("piezas" -> "pieza", "seguidas" -> "seguid"). */
export function raiz(palabra) {
    if (!/^[a-zñ]+$/.test(palabra)) return palabra;
    let r = palabra;
    if (r.length > 5 && /(ciones|siones|dores|nes|les|res|des|ces|zes|jes)$/.test(r)) r = r.slice(0, -2);
    else if (r.length > 4 && r.endsWith('s')) r = r.slice(0, -1);
    if (r.length >= 6 && /[aoe]$/.test(r)) r = r.slice(0, -1);
    return r;
}

/**
 * Devuelve { terminos: [{ tipo: 'palabra'|'frase', partes: [..], prefijo: bool, texto }] }.
 * Lo que va entre comillas, un codigo (I-AC-018) y un numeral (5.2.3) se buscan como frase.
 */
export function analizarConsulta(texto) {
    const terminos = [];
    const vistos = new Set();
    const agregar = (t) => {
        const clave = `${t.tipo}:${t.partes.join(' ')}:${t.prefijo}`;
        if (vistos.has(clave) || !t.partes.length) return;
        vistos.add(clave);
        terminos.push(t);
    };
    const partesDe = (s) => s.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(normalizar);

    let resto = String(texto || '').replace(/["“”]([^"“”]+)["“”]/g, (_, f) => {
        agregar({ tipo: 'frase', partes: partesDe(f), prefijo: false, texto: f.trim() });
        return ' ';
    });
    const palabras = [];
    for (const crudo of resto.split(/\s+/)) {
        const t = crudo.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
        if (!t) continue;
        const partes = partesDe(t);
        if (partes.length > 1) agregar({ tipo: 'frase', partes, prefijo: false, texto: t });
        else if (partes.length === 1) palabras.push(partes[0]);
    }
    const utiles = palabras.filter((w) => !PALABRAS_VACIAS.has(w));
    for (const w of utiles.length ? utiles : palabras) {
        const r = raiz(w);
        agregar({ tipo: 'palabra', partes: [r], prefijo: r.length >= 4 && /^[a-zñ]+$/.test(r), texto: w });
    }
    return { terminos };
}

function aMatch(t) {
    const limpio = t.partes.map((p) => p.replace(/"/g, '')).join(' ');
    return `"${limpio}"${t.prefijo ? '*' : ''}`;
}

export function expresionFts(terminos, union) {
    return terminos.map(aMatch).join(` ${union} `);
}

/** Cuantos de los terminos aparecen en un texto (sin tildes ni mayusculas). */
export function regexDe(t) {
    const esc = t.partes.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const cuerpo = esc.join('[^a-z0-9ñ]+');
    // una palabra que se busca por prefijo ("calibr") puede seguir; una exacta ("5", "i ac 018") no
    const fin = t.prefijo ? '' : '(?![a-z0-9ñ])';
    return new RegExp(`(?<![a-z0-9ñ])${cuerpo}${fin}`, 'u');
}

// ---------------------------------------------------------------------------------------------
// El recorte: los 2 a 3 renglones donde estan las palabras
// ---------------------------------------------------------------------------------------------

export function armarRecorte(texto, desde, terminos, { maxLineas = 3, ancho = 220 } = {}) {
    const lineas = texto.split('\n');
    const res = terminos.map(regexDe);
    const info = lineas.map((l) => {
        const nm = normalizarConMapa(l);
        let aciertos = 0;
        let primera = -1;
        res.forEach((re) => {
            const m = re.exec(nm.texto);
            if (m) { aciertos++; if (primera < 0 || m.index < primera) primera = m.index; }
        });
        return { l, nm, aciertos, primera, vacio: l.trim() === '' };
    });
    let mejor = -1;
    info.forEach((x, i) => { if (!x.vacio && x.aciertos > 0 && (mejor < 0 || x.aciertos > info[mejor].aciertos)) mejor = i; });
    if (mejor < 0) mejor = Math.max(0, info.findIndex((x) => !x.vacio));
    const elegidos = [mejor];
    // el renglon siguiente con texto, despues el anterior, hasta maxLineas
    const siguiente = (desdeI, paso) => {
        for (let k = desdeI + paso; k >= 0 && k < info.length && Math.abs(k - desdeI) <= 2; k += paso) if (!info[k].vacio) return k;
        return -1;
    };
    let hi = mejor;
    let lo = mejor;
    while (elegidos.length < maxLineas) {
        const s = siguiente(hi, 1);
        if (s >= 0) { elegidos.push(s); hi = s; continue; }
        const p = siguiente(lo, -1);
        if (p >= 0) { elegidos.unshift(p); lo = p; continue; }
        break;
    }
    return elegidos.sort((a, b) => a - b).map((i) => {
        const x = info[i];
        let t = x.l.replace(/\t/g, ' ').replace(/ {2,}/g, ' ').trim();
        if (t.length > ancho) {
            const centro = x.primera >= 0 ? (x.nm.mapa[Math.min(x.primera, x.nm.mapa.length - 1)] ?? 0) : 0;
            const ini = Math.max(0, centro - 60);
            t = (ini > 0 ? '…' : '') + x.l.slice(ini, ini + ancho).replace(/\t/g, ' ').replace(/ {2,}/g, ' ').trim() + (ini + ancho < x.l.length ? '…' : '');
        }
        return { n: desde + i, texto: t };
    });
}

// ---------------------------------------------------------------------------------------------
// Buscar en el indice
// ---------------------------------------------------------------------------------------------

export function abrirIndice(DatabaseSync, ruta) {
    if (!fs.existsSync(ruta)) throw new ErrorUso(`No encuentro el índice en ${ruta}. Armalo con indexar.mjs.`);
    let db;
    try {
        db = new DatabaseSync(ruta, { readOnly: true });
        const v = db.prepare('PRAGMA user_version').get();
        if (Number(Object.values(v)[0]) !== FORMATO) {
            db.close();
            throw new ErrorUso('El índice es de otro formato. Armalo de nuevo con indexar.mjs.');
        }
    } catch (e) {
        if (e instanceof ErrorUso) throw e;
        throw new ErrorUso(`El índice no se puede abrir (${String(e.message).split('\n')[0]}). Armalo de nuevo con indexar.mjs.`);
    }
    return db;
}

export function leerMeta(db) {
    const meta = {};
    for (const r of db.prepare('SELECT clave, valor FROM meta').all()) meta[r.clave] = r.valor;
    return meta;
}

export function areasDelIndice(db) {
    return db.prepare('SELECT DISTINCT area FROM secciones ORDER BY area').all().map((r) => r.area);
}

const SQL_BUSCAR = (filtroArea) => `
    SELECT s.id, s.area, s.archivo, s.codigo, s.documento, s.rev, s.fuente, s.numeral, s.titulo,
           s.desde, s.hasta, s.texto, bm25(fts, 2.0, 4.0, 1.0) AS rango
      FROM fts JOIN secciones s ON s.id = fts.rowid
     WHERE fts MATCH ? ${filtroArea}
     ORDER BY rango, s.id
     LIMIT ?`;

/**
 * Busca. Primero las secciones que traen TODAS las palabras; si faltan, completa con las que traen
 * algunas (ordenadas por relevancia, bm25). `area` = una area: busca en `comun` mas esa.
 */
export function buscarPasajes(db, consulta, { area = null, max = 5, soloDocumentos = false } = {}) {
    const { terminos } = analizarConsulta(consulta);
    if (!terminos.length) return { terminos, resultados: [] };
    const areas = area ? [...new Set(['comun', area])] : null;
    const filtro = (soloDocumentos ? "AND s.fuente <> '' " : '') + (areas ? `AND s.area IN (${areas.map(() => '?').join(',')})` : '');
    const correr = (expr, tope) => db.prepare(SQL_BUSCAR(filtro)).all(expr, ...(areas || []), tope);

    const filas = [];
    const ids = new Set();
    const sumar = (rows) => { for (const r of rows) if (!ids.has(r.id) && filas.length < max) { ids.add(r.id); filas.push(r); } };
    sumar(correr(expresionFts(terminos, 'AND'), max));
    if (filas.length < max && terminos.length > 1) sumar(correr(expresionFts(terminos, 'OR'), max * 4));

    const res = terminos.map(regexDe);
    const resultados = filas.map((r) => {
        const nm = normalizar(`${r.documento}\n${r.titulo}\n${r.texto}`);
        const coinciden = res.filter((re) => re.test(nm)).length;
        return {
            area: r.area,
            archivo: r.archivo,
            codigo: r.codigo,
            documento: r.documento,
            rev: r.rev,
            fuente: r.fuente,
            numeral: r.numeral,
            titulo: r.titulo,
            desde: Number(r.desde),
            hasta: Number(r.hasta),
            puntaje: Math.round(-r.rango * 100) / 100,
            coinciden,
            de: terminos.length,
            recorte: armarRecorte(r.texto, Number(r.desde), terminos),
        };
    });
    return { terminos, resultados };
}

/** Una linea por pasaje: "I-AC-018 Calib... rev D, seccion 5.2 Titulo, renglones 34-52". */
export function nombreSeccion(r) {
    const partes = [];
    if (r.numeral) partes.push(r.numeral);
    if (r.titulo) partes.push(r.titulo);
    return partes.join(' ');
}

// ---------------------------------------------------------------------------------------------
// El indice contra el conocimiento: esta al dia?
// ---------------------------------------------------------------------------------------------

/**
 * Compara los archivos del indice contra los de la carpeta. Un archivo "cambio" si su contenido es
 * otro (primero se mira tamano y fecha; solo si no coinciden se calcula el sha256, asi un archivo que
 * solo se copio de nuevo -fecha nueva, mismo texto- no da falsa alarma).
 */
export function revisarFrescura(db, raiz) {
    const indexados = new Map(db.prepare('SELECT ruta, sha256, bytes, mtime_ms FROM archivos').all().map((r) => [r.ruta, r]));
    const actuales = listarArchivos(raiz);
    const cambiados = [];
    const nuevos = [];
    const vistos = new Set();
    for (const f of actuales) {
        vistos.add(f.rel);
        const idx = indexados.get(f.rel);
        if (!idx) { nuevos.push(f.rel); continue; }
        let st;
        try { st = fs.statSync(f.abs); } catch { continue; }
        if (st.size === Number(idx.bytes) && Math.floor(st.mtimeMs) === Number(idx.mtime_ms)) continue;
        let sha;
        try { sha = sha256De(fs.readFileSync(f.abs)); } catch { continue; }
        if (sha !== idx.sha256) cambiados.push(f.rel);
    }
    const faltan = [...indexados.keys()].filter((r) => !vistos.has(r));
    return { cambiados, nuevos, faltan, desactualizado: cambiados.length + nuevos.length + faltan.length > 0 };
}

export function avisoDeFrescura(f, creado) {
    if (!f.desactualizado) return null;
    const partes = [];
    if (f.cambiados.length) partes.push(`${f.cambiados.length} cambiaron`);
    if (f.nuevos.length) partes.push(`${f.nuevos.length} nuevos`);
    if (f.faltan.length) partes.push(`${f.faltan.length} ya no están`);
    const ejemplo = [...f.cambiados, ...f.nuevos, ...f.faltan][0];
    return `AVISO: el índice es del ${fechaCorta(creado)} y el conocimiento cambió después (${partes.join(', ')}; por ejemplo ${ejemplo}). Los resultados pueden estar viejos: hay que volver a correr indexar.mjs.`;
}

// ---------------------------------------------------------------------------------------------
// Cita: la frase esta de verdad en el documento?
// ---------------------------------------------------------------------------------------------

/**
 * Texto del documento listo para buscar una frase: sin tildes, sin mayusculas y con los espacios
 * (y un salto de renglon suelto) como UN solo espacio. Un renglon en blanco corta: una frase no puede
 * empezar en un parrafo y terminar en otro. `mapa[k]` = posicion en el original de la letra k.
 */
export function prepararParaCita(texto) {
    let out = '';
    const mapa = [];
    let i = 0;
    const L = texto.length;
    while (i < L) {
        const ch = texto[i];
        if (/\s/u.test(ch)) {
            let j = i;
            let saltos = 0;
            while (j < L && /\s/u.test(texto[j])) { if (texto[j] === '\n') saltos++; j++; }
            if (out.length) { out += saltos >= 2 ? '\u0001' : ' '; mapa.push(i); }
            i = j;
            continue;
        }
        const cp = texto.codePointAt(i);
        const c = String.fromCodePoint(cp);
        const n = c.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
        for (const x of n) for (let k = 0; k < x.length; k++) { out += x[k]; mapa.push(i); }
        i += c.length;
    }
    return { texto: out, mapa };
}

export function normalizarFrase(frase) {
    return prepararParaCita(String(frase)).texto.replace(/[\u0001 ]+$/g, '').replace(/^[\u0001 ]+/g, '');
}

/** Todas las apariciones de la frase: [{ desde, hasta }] (renglones, desde 1). Frase vacia: []. */
export function buscarFrase(texto, frase) {
    const buscada = normalizarFrase(frase).replace(/\u0001/g, ' ');
    if (!buscada) return [];
    const doc = prepararParaCita(texto);
    const inicios = [0];
    for (let i = 0; i < texto.length; i++) if (texto[i] === '\n') inicios.push(i + 1);
    const renglonDe = (pos) => {
        let lo = 0;
        let hi = inicios.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (inicios[mid] <= pos) lo = mid; else hi = mid - 1;
        }
        return lo + 1;
    };
    const out = [];
    let desde = 0;
    for (;;) {
        const k = doc.texto.indexOf(buscada, desde);
        if (k < 0) break;
        out.push({ desde: renglonDe(doc.mapa[k]), hasta: renglonDe(doc.mapa[k + buscada.length - 1]) });
        desde = k + 1;
    }
    return out;
}

/** El renglon del documento que mas palabras de la frase comparte (para decir "lo mas parecido es esto"). */
export function renglonMasParecido(texto, frase) {
    const palabras = [...new Set(normalizar(frase).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4))];
    if (!palabras.length) return null;
    const lineas = texto.split(/\r?\n/);
    let mejor = null;
    lineas.forEach((l, i) => {
        const nl = normalizar(l);
        const k = palabras.filter((p) => nl.includes(p)).length;
        if (k > 0 && (!mejor || k > mejor.k)) mejor = { n: i + 1, k, de: palabras.length, texto: l.trim() };
    });
    return mejor && mejor.k >= Math.max(2, Math.ceil(palabras.length / 2)) ? mejor : null;
}
