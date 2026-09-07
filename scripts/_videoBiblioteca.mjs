/**
 * _videoBiblioteca.mjs — cruza el carrete del celular contra la biblioteca de videos y fotos
 * de Ingenieria ANTES de bajar un solo byte.
 *
 * POR QUE EXISTE (incidente 2026-09-07). Baje 39 videos del iPhone y los deje en carpetas de
 * tarea del Escritorio. Trece de ellos — el 02/09 entero, 5,59 GB — YA ESTABAN archivados en
 * `5- VIDEOS Y FOTOS\1- CLIENTES\NOVAX\TOP ROLL\MAQUINA MOLDEADORA IMG` desde el 02/09, con su
 * nombre descriptivo. Los volvi a bajar, los verifique con ffprobe y los reporte como un logro;
 * de paso llene el disco. Fak: "es gravisimo lo que paso", "no se pone algo que te obligue a
 * recordar? un seguro", "porque sino se me hace que va a volver a pasar".
 *
 * La clave estaba escrita en los nombres de la biblioteca: cada archivo termina en
 * `(IMG_xxxx)`, que es el nombre original del telefono. Eso es lo que se cruza.
 *
 *   node scripts/_videoBiblioteca.mjs --indice
 *   node scripts/_videoBiblioteca.mjs --cruzar <indice-del-telefono.tsv> [--json <salida>]
 *
 * `--cruzar` deja la marca `~/.claude/.cruce-video` con la hora. El guardian
 * `video-maquina-guard` (scripts/_lib/guardianes.mjs) NO deja copiar del telefono si esa marca
 * no existe o tiene mas de 12 h. Escribir la marca es el ULTIMO paso, cuando el cruce ya salio.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** El nombre archivado termina en `(IMG_0383)`, `(SANM8355)`, `(IMG_E0625)`. */
const CLAVE = /(IMG_E?\d{3,5}|SANM\d{3,5}|[A-Z]{4}\d{3,5})/gi;
const VIDEO = /\.(mov|mp4|m4v)$/i;
const FOTO = /\.(jpe?g|png|heic)$/i;

/** La biblioteca vive en la carpeta sincronizada de SharePoint, cuyo nombre lleva tilde. */
export function raizBiblioteca(home = os.homedir()) {
    const base = path.join(home, 'BARACK ARGENTINA SRL');
    let dirs = [];
    try { dirs = fs.readdirSync(base); } catch { return ''; }
    for (const d of dirs) {
        if (!/^Ingenier.a y Proyecto/i.test(d)) continue;
        const p = path.join(base, d, 'INGENIERIA BARACK (NUNCA BORRAR)', '5- VIDEOS Y FOTOS');
        if (fs.existsSync(p)) return p;
    }
    return '';
}

/** Recorre la biblioteca y devuelve Map clave-del-telefono -> [rutas relativas]. */
export function indexarBiblioteca(raiz) {
    const idx = new Map();
    const anda = (dir) => {
        let es = [];
        try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const e of es) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) { anda(p); continue; }
            if (!VIDEO.test(e.name) && !FOTO.test(e.name)) continue;
            const claves = e.name.toUpperCase().match(CLAVE);
            // Sin clave el archivo no se puede cruzar: se indexa igual por nombre pelado para
            // que el reporte lo cuente, pero no va a matchear con el celular. Es un dato, no
            // un error: hay material que no salio de un iPhone.
            const k = claves ? claves[claves.length - 1] : path.parse(e.name).name.toUpperCase();
            if (!idx.has(k)) idx.set(k, []);
            idx.get(k).push(path.relative(raiz, p));
        }
    };
    if (raiz) anda(raiz);
    return idx;
}

/** Lee el TSV que deja tel_indice.ps1 (carpeta/archivo/creado/bytes, con BOM). */
export function leerIndiceTelefono(ruta) {
    const txt = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '');
    const [cab, ...filas] = txt.split(/\r?\n/).filter((l) => l.trim() !== '');
    const cols = cab.split('\t').map((c) => c.trim());
    const i = (n) => cols.indexOf(n);
    const out = [];
    for (const f of filas) {
        const p = f.split('\t');
        const carpeta = p[i('carpeta')] ?? '';
        // La carpeta `_b` del iPhone DUPLICA archivos de la `_a`: contarla infla todo al doble.
        if (/_b$/.test(carpeta)) continue;
        const archivo = p[i('archivo')] ?? '';
        const creado = p[i('creado')] ?? '';
        const bytes = parseInt(p[i('bytes')] ?? '0', 10) || 0;
        const [d, m, a] = (creado.split(' ')[0] || '').split('/');
        const fecha = a ? `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : '';
        out.push({ carpeta, archivo, creado, fecha, bytes, clave: path.parse(archivo).name.toUpperCase() });
    }
    return out;
}

export function cruzar(items, idxBiblioteca) {
    const ya = [], faltan = [];
    for (const it of items) (idxBiblioteca.has(it.clave) ? ya : faltan).push(it);
    return { ya, faltan };
}

const gb = (n) => (n / 1e9).toFixed(2);
const mb = (n) => Math.round(n / 1e6);

function main() {
    const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
    const raiz = raizBiblioteca();
    if (!raiz) {
        console.error('No encontre la biblioteca 5- VIDEOS Y FOTOS. Se busca en');
        console.error('  ~\\BARACK ARGENTINA SRL\\Ingenieria y Proyecto - General\\INGENIERIA BARACK (NUNCA BORRAR)\\');
        console.error('Si OneDrive no esta sincronizando esa carpeta, el cruce no se puede hacer y NO se baja nada.');
        process.exitCode = 1;
        return;
    }
    const idx = indexarBiblioteca(raiz);

    if (process.argv.includes('--indice')) {
        console.log(`BIBLIOTECA: ${raiz}`);
        console.log(`archivos con clave de telefono: ${idx.size}`);
        for (const [k, rutas] of [...idx].sort()) console.log(`  ${k.padEnd(12)} ${rutas[0]}`);
        return;
    }

    const tsv = arg('--cruzar');
    if (!tsv) {
        console.log('uso: node scripts/_videoBiblioteca.mjs --indice');
        console.log('     node scripts/_videoBiblioteca.mjs --cruzar <indice-del-telefono.tsv> [--json <salida>]');
        return;
    }
    const items = leerIndiceTelefono(tsv);
    const vids = items.filter((x) => VIDEO.test(x.archivo));
    const { ya, faltan } = cruzar(vids, idx);

    console.log(`BIBLIOTECA: ${raiz}`);
    console.log(`  archivos indexados: ${idx.size}`);
    console.log(`TELEFONO: ${tsv}`);
    console.log(`  videos (sin la carpeta _b): ${vids.length}  ${gb(vids.reduce((s, x) => s + x.bytes, 0))} GB`);
    console.log('');
    console.log(`YA ARCHIVADOS — NO se bajan: ${ya.length}  ${gb(ya.reduce((s, x) => s + x.bytes, 0))} GB`);
    console.log(`FALTAN de verdad:            ${faltan.length}  ${gb(faltan.reduce((s, x) => s + x.bytes, 0))} GB`);
    console.log('');
    const porDia = new Map();
    for (const f of faltan) { if (!porDia.has(f.fecha)) porDia.set(f.fecha, []); porDia.get(f.fecha).push(f); }
    for (const [dia, fs_] of [...porDia].sort()) {
        console.log(`  ${dia}  ${String(fs_.length).padStart(2)} videos  ${gb(fs_.reduce((s, x) => s + x.bytes, 0))} GB`);
        for (const f of fs_) console.log(`     ${f.archivo.padEnd(16)} ${String(mb(f.bytes)).padStart(6)} MB  ${f.creado}`);
    }

    const salida = arg('--json');
    if (salida) {
        fs.writeFileSync(salida, JSON.stringify({ raiz, tsv, generado: new Date().toISOString(), ya: ya.map((x) => x.archivo), faltan }, null, 2));
        console.log(`\nlista -> ${salida}`);
    }

    // La marca va AL FINAL, cuando el cruce ya se imprimio: un cruce cortado a la mitad no
    // deberia destrabar la copia (leccion 07/09: el marcador va en el ULTIMO paso).
    const marca = path.join(os.homedir(), '.claude', '.cruce-video');
    try {
        fs.mkdirSync(path.dirname(marca), { recursive: true });
        fs.writeFileSync(marca, String(Math.floor(Date.now() / 1000)));
        console.log(`\ncruce registrado (${marca}) — vale 12 h para el guardian video-maquina-guard.`);
    } catch (e) {
        console.error(`\nNO pude dejar la marca ${marca}: ${e.message}`);
        console.error('El guardian va a seguir bloqueando la copia. Eso es correcto: sin marca no hay cruce probado.');
        process.exitCode = 1;
    }
}

if (process.argv[1] && /_videoBiblioteca\.mjs$/.test(process.argv[1].replace(/\\/g, '/'))) main();
