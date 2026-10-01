#!/usr/bin/env node
/**
 * indexar.mjs - arma el indice de busqueda del conocimiento (se corre una vez, en la PC del
 * administrador; las demas PC solo lo leen).
 *
 *   node indexar.mjs <carpeta conocimiento> <salida>
 *
 *   <carpeta conocimiento>  la carpeta con `comun\` y una carpeta por area (fichas, INDICE.md, extractos\*.md)
 *   <salida>                una carpeta (se crea `indice.db` y `indice.json` adentro) o un archivo .db
 *
 * Que guarda, por cada seccion de cada documento: area, archivo, codigo del documento, revision
 * (`rev:` de la cabecera), ruta del original (`fuente:`), titulo de la seccion, renglon de inicio y de
 * fin, y el texto. Arriba lleva la fecha de armado y el sha256 de cada archivo indexado.
 *
 * Como parte cada documento: por titulos `#`; si no los tiene, por numerales (5.2.3, 1. PROPOSITO.,
 * IV. FUNCIONES.); si tampoco, por bloques de ~40 renglones. Una seccion de mas de 60 renglones se parte.
 *
 * El indice se escribe entero en un archivo temporal y despues se cambia de lugar: un corte a mitad
 * de camino no deja un indice a medias. Solo LEE el conocimiento; no escribe nada ahi.
 * Sale con 0 si anduvo (tambien con una carpeta vacia) y con 1 si no pudo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    FORMATO, ErrorUso, leerArgs, cargarSqlite, listarArchivos, leerTexto, sha256De, fechaLocalISO,
    partirEnSecciones,
} from './lib.mjs';

const USO = `Uso: node indexar.mjs <carpeta conocimiento> <salida>
  <salida> puede ser una carpeta (arma indice.db e indice.json adentro) o un archivo .db.
  Sale con 0 si anduvo y con 1 si no pudo.`;

/** Saca un archivo temporal PROPIO (el que este programa acaba de crear); si no esta, no pasa nada. */
function quitarTemporal(p) {
    try { fs.unlinkSync(p); } catch { /* no estaba */ }
}

export async function indexar(raiz, salida, { ahora = new Date() } = {}) {
    const { DatabaseSync } = await cargarSqlite();
    if (!fs.existsSync(raiz) || !fs.statSync(raiz).isDirectory()) throw new ErrorUso(`No existe la carpeta del conocimiento: ${raiz}`);
    const rutaDb = /\.db$/i.test(salida) ? path.resolve(salida) : path.join(path.resolve(salida), 'indice.db');
    const rutaJson = path.join(path.dirname(rutaDb), 'indice.json');
    fs.mkdirSync(path.dirname(rutaDb), { recursive: true });

    const t0 = Date.now();
    const archivos = [];
    const secciones = [];
    let bytesTexto = 0;
    for (const f of listarArchivos(raiz)) {
        let buf;
        let st;
        try { buf = fs.readFileSync(f.abs); st = fs.statSync(f.abs); } catch { continue; }
        const texto = leerTexto(buf);
        const doc = partirEnSecciones(texto, f.rel);
        bytesTexto += buf.length;
        archivos.push({ ruta: f.rel, area: f.area, sha256: sha256De(buf), bytes: buf.length, mtime_ms: Math.floor(st.mtimeMs), secciones: doc.secciones.length });
        for (const s of doc.secciones) {
            secciones.push({ area: f.area, archivo: f.rel, codigo: doc.codigo, documento: doc.documento, rev: doc.rev, fuente: doc.fuente, ...s });
        }
    }

    const creado = fechaLocalISO(ahora);
    const tmp = `${rutaDb}.tmp-${process.pid}`;
    quitarTemporal(tmp);
    const db = new DatabaseSync(tmp);
    try {
        db.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;');
        db.exec(`
            CREATE TABLE meta (clave TEXT PRIMARY KEY, valor TEXT);
            CREATE TABLE archivos (ruta TEXT PRIMARY KEY, area TEXT, sha256 TEXT, bytes INTEGER, mtime_ms INTEGER, secciones INTEGER);
            CREATE TABLE secciones (
                id INTEGER PRIMARY KEY, area TEXT, archivo TEXT, codigo TEXT, documento TEXT, rev TEXT, fuente TEXT,
                numeral TEXT, titulo TEXT, desde INTEGER, hasta INTEGER, texto TEXT
            );
            CREATE INDEX secciones_area ON secciones(area);
        `);
        try {
            db.exec(`CREATE VIRTUAL TABLE fts USING fts5(documento, titulo, texto,
                content='secciones', content_rowid='id', tokenize='unicode61 remove_diacritics 2')`);
        } catch {
            throw new ErrorUso('Este Node no trae el buscador de texto completo (FTS5). Hace falta el node.exe oficial de Node 22.');
        }
        db.exec('BEGIN');
        const insA = db.prepare('INSERT INTO archivos VALUES (?,?,?,?,?,?)');
        for (const a of archivos) insA.run(a.ruta, a.area, a.sha256, a.bytes, a.mtime_ms, a.secciones);
        const insS = db.prepare('INSERT INTO secciones (area, archivo, codigo, documento, rev, fuente, numeral, titulo, desde, hasta, texto) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
        for (const s of secciones) insS.run(s.area, s.archivo, s.codigo, s.documento, s.rev, s.fuente, s.numeral, s.titulo, s.desde, s.hasta, s.texto);
        const insM = db.prepare('INSERT INTO meta VALUES (?,?)');
        const meta = {
            formato: String(FORMATO), creado, conocimiento: path.resolve(raiz),
            archivos: String(archivos.length), secciones: String(secciones.length),
        };
        for (const [k, v] of Object.entries(meta)) insM.run(k, v);
        db.exec('COMMIT');
        db.exec("INSERT INTO fts(fts) VALUES('rebuild')");
        db.exec("INSERT INTO fts(fts) VALUES('optimize')");
        db.exec(`PRAGMA user_version = ${FORMATO}`);
        db.close();
        try {
            fs.renameSync(tmp, rutaDb); // en Windows pisa el indice anterior de una sola vez
        } catch (e) {
            throw new ErrorUso(`No pude dejar el índice en ${rutaDb} (${e.code || e.message}). ¿Está abierto en otro programa?`);
        }
    } catch (e) {
        try { db.close(); } catch { /* ya estaba cerrada */ }
        quitarTemporal(tmp);
        throw e;
    }

    const cabecera = {
        formato: FORMATO, creado, conocimiento: path.resolve(raiz),
        archivos: archivos.length, secciones: secciones.length,
        sha256_por_archivo: Object.fromEntries(archivos.map((a) => [a.ruta, { sha256: a.sha256, bytes: a.bytes, area: a.area, secciones: a.secciones }])),
    };
    const tmpJson = `${rutaJson}.tmp-${process.pid}`;
    fs.writeFileSync(tmpJson, JSON.stringify(cabecera, null, 2) + '\n', 'utf8');
    fs.renameSync(tmpJson, rutaJson);

    return {
        rutaDb, rutaJson, archivos: archivos.length, secciones: secciones.length, bytesTexto,
        bytesIndice: fs.statSync(rutaDb).size, ms: Date.now() - t0, creado,
    };
}

const mb = (b) => (b / 1048576).toFixed(1).replace('.', ',');

async function main() {
    const { pos, opts } = leerArgs(process.argv.slice(2), { valor: [], bandera: ['--help', '-h'] });
    if (opts['--help'] || opts['-h']) { console.log(USO); return 0; }
    if (pos.length !== 2) throw new ErrorUso(`Hay que indicar la carpeta del conocimiento y la salida. ${USO.split('\n')[0]}`);
    const r = await indexar(pos[0], pos[1]);
    if (r.archivos === 0) {
        console.log(`No encontré documentos (.md o .txt) en ${path.resolve(pos[0])}. Dejé un índice vacío en ${r.rutaDb}.`);
    } else {
        console.log(`Listo: ${r.archivos} archivos, ${r.secciones} secciones, ${mb(r.bytesTexto)} MB de texto, en ${(r.ms / 1000).toFixed(1).replace('.', ',')} s.`);
        console.log(`Índice: ${r.rutaDb} (${mb(r.bytesIndice)} MB). Fecha de armado: ${r.creado}.`);
    }
    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().then((c) => { process.exitCode = c; }, (e) => {
        console.error(`Error: ${e instanceof ErrorUso ? e.message : e && e.stack ? e.stack : e}`);
        process.exitCode = 1;
    });
}
