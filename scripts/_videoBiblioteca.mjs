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
 *   node scripts/_videoBiblioteca.mjs --auditar [--carpeta "<ruta>"]... [--tsv <salida>]
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

/* ---------------------------------------------------------------------- auditar
 * Una carpeta de maquina ordenada tiene UNA sola forma (pedido de Fak, 21/09/2026: "que esten
 * los archivos originales videos o fotos originales y todo lo demas dentro de una carpeta que
 * diga .claude para que no estorbe"):
 *
 *     MAQUINA <X>\  AAAA-MM-DD - lo que se ve (IMG_xxxx).MOV   <- SOLO originales, planos
 *                   .claude\  transcripciones, fotogramas, casos, borradores
 *
 * Esto lo MIDE. No mueve ni borra nada, y no hidrata: solo lee nombres y tamanos.
 * Nace de lo que habia el 21/09/2026: el mismo video de 1,19 GB guardado en dos maquinas con
 * dos nombres que se contradecian, y los fotogramas de 15 videos de la moldeadora viviendo
 * adentro de la carpeta de la hotmelt.
 */
export const TRABAJO = '.claude';
export const FOTOGRAMAS = 'fotogramas de cada video';
export const TRANSCRIPCIONES = 'transcripciones';

/** Las tres maquinas nuevas de la linea Top Roll. Lo viejo de VWA/SMRC no se audita: se ordeno
 *  con otro criterio y Fak no lo pidio. Se puede auditar cualquier otra con --carpeta. */
export const CARPETAS_DE_MAQUINA = [
    '1- CLIENTES/NOVAX/TOP ROLL/MAQUINA HOTMELT',
    '1- CLIENTES/NOVAX/TOP ROLL/MAQUINA MOLDEADORA IMG',
    '1- CLIENTES/NOVAX/TOP ROLL/MAQUINA PRENSA KINGPOWER 1004',
];

/** `AAAA-MM-DD - lo que se ve (CLAVE).ext` — el formato de la casa, con la fecha adelante. */
export const NOMBRE_DE_LA_CASA = /^(\d{4})-(\d{2})-(\d{2}) - (.+) \(([^()]+)\)\.[A-Za-z0-9]{2,4}$/;

/** Dos archivos GRANDES del mismo tamano son el mismo archivo dos veces (el caso real: 1,19 GB
 *  repetidos en dos maquinas). Abajo de 1 MB la coincidencia no dice nada — dos capturas de
 *  pantalla o dos .txt cortos pueden pesar igual — y marcarlas seria un rojo falso. */
export const MISMO_TAMANO_MIN = 1_000_000;

export function claveDe(nombre) {
    const m = nombre.toUpperCase().match(CLAVE);
    return m ? m[m.length - 1] : '';
}

const esFechaReal = (a, m, d) => {
    const f = new Date(`${a}-${m}-${d}T12:00:00`);
    return f.getFullYear() === +a && f.getMonth() + 1 === +m && f.getDate() === +d;
};

/** Devuelve los hallazgos de UNA carpeta de maquina. Cada uno con su codigo y su porque. */
export function auditarCarpeta(dir, nombre = path.basename(dir)) {
    const hallazgos = [];
    const anota = (codigo, archivo, detalle) => hallazgos.push({ carpeta: nombre, codigo, archivo, detalle });
    let entradas;
    try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) {
        anota('NO_SE_PUEDE_LEER', '', e.message);
        return { carpeta: nombre, hallazgos, originales: [] };
    }

    const originales = [], porClave = new Map(), porTamano = new Map();
    for (const e of entradas) {
        if (e.isDirectory()) {
            if (e.name !== TRABAJO) anota('CARPETA_EN_LA_RAIZ', e.name, `en la raiz solo va \`${TRABAJO}\``);
            continue;
        }
        if (!VIDEO.test(e.name) && !FOTO.test(e.name)) {
            anota('RAIZ_NO_ORIGINAL', e.name, `no es un video ni una foto: su lugar es \`${TRABAJO}\``);
            continue;
        }
        originales.push(e.name);
        const m = e.name.match(NOMBRE_DE_LA_CASA);
        if (!m) anota('NOMBRE_FUERA_DE_FORMATO', e.name, 'va `AAAA-MM-DD - lo que se ve (IMG_xxxx).ext`');
        else if (!esFechaReal(m[1], m[2], m[3])) anota('FECHA_QUE_NO_EXISTE', e.name, `${m[1]}-${m[2]}-${m[3]}`);
        // Entre parentesis va el ORIGEN. Si salio del telefono es la clave `IMG_xxxx`, que es lo
        // que permite cruzar y no bajar dos veces lo mismo; si vino por WhatsApp o lo saco otro,
        // alcanza con que diga de donde salio. Vacio no: ahi no se sabe de donde vino.
        const k = claveDe(e.name);
        if (m && !k && m[5].trim().length < 3) anota('ORIGEN_SIN_DECLARAR', e.name, 'entre parentesis va de donde salio (IMG_xxxx, WhatsApp, quien la mando)');
        if (k) { if (!porClave.has(k)) porClave.set(k, []); porClave.get(k).push(e.name); }
        let bytes = 0;
        try { bytes = fs.statSync(path.join(dir, e.name)).size; } catch { /* sin tamano, se saltea */ }
        if (bytes > 0) { if (!porTamano.has(bytes)) porTamano.set(bytes, []); porTamano.get(bytes).push(e.name); }
    }
    for (const [k, fs_] of porClave) if (fs_.length > 1) anota('CLAVE_REPETIDA', fs_.join(' | '), `los ${fs_.length} dicen ser ${k}`);
    for (const [b, fs_] of porTamano) if (fs_.length > 1 && b >= MISMO_TAMANO_MIN) anota('MISMO_TAMANO', fs_.join(' | '), `${b} bytes los ${fs_.length}: es el mismo archivo dos veces`);

    // Lo que se saco de los videos tiene que ser de un video DE ESTA carpeta. La excepcion se
    // DECLARA: un original que todavia no se pudo archivar (el IMG_9527 son 37 GB y sigue en el
    // celular de Fak) se anota en `.claude/ORIGINALES QUE FALTAN.txt`, una clave por linea, y
    // entonces su material no es "de otra maquina" sino un original que falta. Un control que
    // no distingue las dos cosas obliga a ignorarlo, y un control que se ignora no existe.
    const claves = new Set(originales.map(claveDe).filter(Boolean));
    const faltan = new Set();
    try {
        for (const l of fs.readFileSync(path.join(dir, TRABAJO, 'ORIGINALES QUE FALTAN.txt'), 'utf8').split(/\r?\n/)) {
            const k = claveDe(l.trim());
            if (k) { faltan.add(k); claves.add(k); }
        }
    } catch { /* no hay declaracion: todo original tiene que estar */ }
    for (const k of faltan) anota('ORIGINAL_QUE_FALTA', k, 'declarado en ORIGINALES QUE FALTAN.txt: el archivo original no esta en la biblioteca');
    const trabajo = path.join(dir, TRABAJO);
    const hijos = (sub) => { try { return fs.readdirSync(path.join(trabajo, sub)); } catch { return []; } };
    const conFotogramas = new Set(), conTranscripcion = new Set();
    for (const d of hijos(FOTOGRAMAS)) {
        const k = claveDe(d) || d.toUpperCase();
        const kk = /^\d/.test(d) ? `IMG_${d.slice(0, 4)}` : k;
        if (claves.has(kk) || claves.has(k)) conFotogramas.add(claves.has(kk) ? kk : k);
        else anota('TRABAJO_DE_OTRA_MAQUINA', `${TRABAJO}/${FOTOGRAMAS}/${d}`, 'no hay ningun original de esa clave aca');
    }
    for (const f of hijos(TRANSCRIPCIONES)) {
        const base = path.parse(f).name;
        const k = claveDe(base) || `IMG_${base.slice(0, 4)}`;
        if (claves.has(k)) conTranscripcion.add(k);
        else anota('TRABAJO_DE_OTRA_MAQUINA', `${TRABAJO}/${TRANSCRIPCIONES}/${f}`, 'no hay ningun original de esa clave aca');
    }
    for (const v of originales.filter((x) => VIDEO.test(x))) {
        const k = claveDe(v);
        if (k && !conFotogramas.has(k)) anota('VIDEO_SIN_FOTOGRAMAS', v, 'nadie le saco los cuadros todavia');
        if (k && !conTranscripcion.has(k)) anota('VIDEO_SIN_TRANSCRIPCION', v, 'nadie le saco el audio todavia');
    }
    if (!fs.existsSync(path.join(trabajo, 'LEEME - que hay aca.txt')))
        anota('SIN_LEEME', `${TRABAJO}/LEEME - que hay aca.txt`, 'el que abre la carpeta tiene que saber que hay adentro');

    return { carpeta: nombre, hallazgos, originales };
}

/* ------------------------------------------------------------------- indice
 * El indice que lee una PERSONA. Lo escribe el codigo leyendo la carpeta, no yo a mano: el
 * `_INDICE - que hay en cada video.txt` anterior se quedo en el 02/09/2026 y desde entonces
 * entraron 60 videos y una maquina entera. Un texto a mano envejece en silencio.
 */
function indiceMaquinas(raiz) {
    const base = path.join(raiz, '1- CLIENTES', 'NOVAX', 'TOP ROLL');
    const hoy = new Date().toLocaleDateString('es-AR');
    const out = [
        'INDICE — VIDEOS Y FOTOS DE LAS MAQUINAS NUEVAS (linea Top Roll / VW427 Patagonia)',
        `Generado el ${hoy} con: node scripts/_videoBiblioteca.mjs --indice-maquinas`,
        '',
        'Una carpeta por MAQUINA. En la raiz de cada una van SOLO los originales, con el nombre',
        '  AAAA-MM-DD - lo que se ve (IMG_xxxx).ext',
        'y todo lo que se les saco (transcripciones, fotogramas, casos) vive adentro de `.claude`,',
        'con un LEEME que lo explica. Los archivos quedan "solo online" para no ocupar el disco:',
        'se abren igual con doble click.',
        '',
    ];
    for (const c of CARPETAS_DE_MAQUINA) {
        const dir = path.join(raiz, c);
        const r = auditarCarpeta(dir);
        const nombre = path.basename(dir);
        out.push('='.repeat(78), nombre, '='.repeat(78));
        const porDia = new Map();
        for (const o of r.originales.sort()) {
            const dia = (o.match(/^(\d{4}-\d{2}-\d{2})/) || [, 'sin fecha'])[1];
            if (!porDia.has(dia)) porDia.set(dia, []);
            porDia.get(dia).push(o);
        }
        const vids = r.originales.filter((x) => VIDEO.test(x)).length;
        out.push(`${vids} videos y ${r.originales.length - vids} fotos, en ${porDia.size} dias.`, '');
        for (const [dia, fs_] of [...porDia].sort()) {
            out.push(`${dia} — ${fs_.length}`);
            for (const f of fs_) {
                const m = f.match(NOMBRE_DE_LA_CASA);
                out.push(`   ${m ? `${m[4]}  (${m[5]})` : f}`);
            }
            out.push('');
        }
    }
    const destino = path.join(base, '_INDICE - que hay en cada video.txt');
    fs.writeFileSync(destino, out.join('\r\n'), 'utf8');
    console.log(`indice -> ${destino}\n${out.length} lineas`);
}

function auditar(raiz) {
    const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
    const pedidas = process.argv.reduce((acc, a, i) => (a === '--carpeta' ? [...acc, process.argv[i + 1]] : acc), []);
    const carpetas = (pedidas.length ? pedidas : CARPETAS_DE_MAQUINA).map((c) => (path.isAbsolute(c) ? c : path.join(raiz, c)));
    let total = 0;
    const filas = [];
    const resultados = [];
    for (const c of carpetas) {
        const r = auditarCarpeta(c);
        resultados.push({ dir: c, ...r });
        const porCodigo = new Map();
        for (const h of r.hallazgos) porCodigo.set(h.codigo, (porCodigo.get(h.codigo) ?? 0) + 1);
        console.log(`\n=== ${r.carpeta}  (${r.originales.length} originales en la raiz)`);
        if (!r.hallazgos.length) console.log('    ordenada');
        for (const [cod, n] of [...porCodigo].sort()) {
            console.log(`  ${String(n).padStart(4)}  ${cod}`);
            for (const h of r.hallazgos.filter((x) => x.codigo === cod).slice(0, 6))
                console.log(`        ${h.archivo}${h.detalle ? `  — ${h.detalle}` : ''}`);
            if (n > 6) console.log(`        ... y ${n - 6} mas`);
        }
        total += r.hallazgos.length;
        filas.push(...r.hallazgos);
    }

    // El defecto mas caro del 21/09/2026 no se ve mirando UNA carpeta: el mismo video de
    // 1,19 GB estaba en dos maquinas con dos nombres que se contradecian. Se cruza entre todas.
    const entre = [];
    const porClave = new Map(), porTamano = new Map();
    for (const r of resultados) for (const o of r.originales) {
        const k = claveDe(o);
        let b = 0; try { b = fs.statSync(path.join(r.dir, o)).size; } catch { /* sin tamano */ }
        if (k) { if (!porClave.has(k)) porClave.set(k, []); porClave.get(k).push(`${r.carpeta}/${o}`); }
        if (b > 0) { if (!porTamano.has(b)) porTamano.set(b, []); porTamano.get(b).push(`${r.carpeta}/${o}`); }
    }
    for (const [k, fs_] of porClave) if (new Set(fs_.map((x) => x.split('/')[0])).size > 1) entre.push({ carpeta: '(entre carpetas)', codigo: 'MISMA_CLAVE_EN_DOS_MAQUINAS', archivo: fs_.join(' | '), detalle: `los ${fs_.length} dicen ser ${k}` });
    for (const [b, fs_] of porTamano) if (fs_.length > 1 && b >= MISMO_TAMANO_MIN && new Set(fs_.map((x) => x.split('/')[0])).size > 1) entre.push({ carpeta: '(entre carpetas)', codigo: 'MISMO_TAMANO_EN_DOS_MAQUINAS', archivo: fs_.join(' | '), detalle: `${b} bytes los ${fs_.length}: es el mismo archivo dos veces` });
    if (entre.length) {
        console.log('\n=== entre carpetas');
        for (const h of entre) console.log(`     1  ${h.codigo}\n        ${h.archivo}  — ${h.detalle}`);
        total += entre.length;
        filas.push(...entre);
    }

    const tsv = arg('--tsv');
    if (tsv) {
        fs.writeFileSync(tsv, ['carpeta\tcodigo\tarchivo\tdetalle', ...filas.map((h) => `${h.carpeta}\t${h.codigo}\t${h.archivo}\t${h.detalle}`)].join('\n'));
        console.log(`\ntabla -> ${tsv}`);
    }
    // El ORDEN es lo que este control exige (y lo que Fak pidio): eso tiene que dar cero.
    // Que a un video todavia no le sacaron los cuadros, o que un original siga en el celular,
    // es trabajo pendiente: se lista, pero no pone en rojo una carpeta que esta ordenada.
    const pendiente = (c) => ['VIDEO_SIN_FOTOGRAMAS', 'VIDEO_SIN_TRANSCRIPCION', 'ORIGINAL_QUE_FALTA'].includes(c);
    const desorden = filas.filter((h) => !pendiente(h.codigo)).length;
    console.log(`\nTOTAL: ${total} hallazgo(s) en ${carpetas.length} carpeta(s)`
        + ` — ${desorden} de orden, ${total - desorden} de trabajo pendiente (material sin sacar).`);
    if (desorden) process.exitCode = 1;
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

    if (process.argv.includes('--auditar')) {
        console.log(`BIBLIOTECA: ${raiz}`);
        auditar(raiz);
        return;
    }

    if (process.argv.includes('--indice-maquinas')) {
        indiceMaquinas(raiz);
        return;
    }

    const tsv = arg('--cruzar');
    if (!tsv) {
        console.log('uso: node scripts/_videoBiblioteca.mjs --indice');
        console.log('     node scripts/_videoBiblioteca.mjs --cruzar <indice-del-telefono.tsv> [--json <salida>]');
        console.log('     node scripts/_videoBiblioteca.mjs --auditar [--carpeta "<ruta o subruta>"]... [--tsv <salida>]');
        console.log("     node scripts/_videoBiblioteca.mjs --indice-maquinas");
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
