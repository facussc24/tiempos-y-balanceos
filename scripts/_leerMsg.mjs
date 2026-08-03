/**
 * _leerMsg.mjs — leer mails de Outlook (.msg) sin dependencias ni Outlook instalado.
 *
 * SIN shebang a proposito: Vitest inlinea los modulos y se los pasa a `new vm.Script()`,
 * que NO acepta `#!` y tira "SyntaxError: Invalid or unexpected token" apuntando a la
 * linea 1, sin decir por que. Estos scripts se invocan como `node scripts/...`, asi que
 * el shebang no aportaba nada.
 *
 * Adentro de cada carpeta del Escritorio, el .msg ES el pedido: sin poder abrirlo no se
 * puede saber que se pidio, quien lo pidio ni cuando. La libreria de Python `extract_msg`
 * no esta en esta maquina, y Outlook COM aborta sobre rutas de OneDrive — asi que el
 * formato se parsea a mano.
 *
 * Un .msg es un Compound File Binary (el mismo contenedor que los .doc/.xls viejos):
 * un mini sistema de archivos con FAT propia adentro de un solo archivo. Cada propiedad
 * MAPI es un "stream" llamado `__substg1.0_<tag><tipo>`.
 *
 *   node scripts/_leerMsg.mjs "<ruta.msg>"           # asunto, de, para, fecha y cuerpo
 *   node scripts/_leerMsg.mjs "<ruta.msg>" --json    # lo mismo en JSON
 *   node scripts/_leerMsg.mjs --dir "<carpeta>"      # todos los .msg de una carpeta
 *   ... + --max <n>  para recortar el cuerpo (default 6000; 0 = completo)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// Compound File Binary: la FAT interna del archivo
// ─────────────────────────────────────────────────────────────────────────────

const FIRMA_CFB = 'd0cf11e0a1b11ae1';
const FIN_CADENA = 0xfffffffa;   // >= esto es marca de fin/libre, no un numero de sector

/**
 * Abre el contenedor y devuelve sus entradas + una funcion para leer cada stream.
 * Los streams chicos no viven en la FAT normal sino en el "mini-FAT" (otra cadena,
 * con sectores de 64 bytes); saltearse eso es lo que hace que un mail devuelva basura.
 */
export function abrirCFB(buf) {
    if (buf.subarray(0, 8).toString('hex') !== FIRMA_CFB) {
        throw new Error('no es un archivo Compound Binary (.msg valido)');
    }
    const TAM_SECTOR = 1 << buf.readUInt16LE(0x1e);
    const TAM_MINI = 1 << buf.readUInt16LE(0x20);
    const cantFat = buf.readUInt32LE(0x2c);
    const dirInicio = buf.readUInt32LE(0x30);
    const corteMini = buf.readUInt32LE(0x38);
    const miniInicio = buf.readUInt32LE(0x3c);
    const difatInicio = buf.readUInt32LE(0x44);
    const difatCant = buf.readUInt32LE(0x48);

    const sector = (n) => buf.subarray(512 + n * TAM_SECTOR, 512 + (n + 1) * TAM_SECTOR);

    // DIFAT: los primeros 109 punteros a sectores de FAT estan en el header; el resto
    // encadenado en sectores propios, con el "siguiente" en las ultimas 4 bytes.
    const sectoresFat = [];
    for (let i = 0; i < 109 && sectoresFat.length < cantFat; i++) {
        const v = buf.readUInt32LE(0x4c + i * 4);
        if (v < FIN_CADENA) sectoresFat.push(v);
    }
    let sig = difatInicio;
    for (let n = 0; n < difatCant && sig < FIN_CADENA; n++) {
        const s = sector(sig);
        for (let i = 0; i < TAM_SECTOR / 4 - 1; i++) {
            const v = s.readUInt32LE(i * 4);
            if (v < FIN_CADENA) sectoresFat.push(v);
        }
        sig = s.readUInt32LE(TAM_SECTOR - 4);
    }

    const FAT = [];
    for (const n of sectoresFat) {
        const s = sector(n);
        for (let i = 0; i < TAM_SECTOR / 4; i++) FAT.push(s.readUInt32LE(i * 4));
    }

    const cadena = (inicio, tabla) => {
        const out = [];
        let c = inicio;
        const tope = tabla.length + 1;
        while (c < FIN_CADENA && out.length < tope) { out.push(c); c = tabla[c]; }
        return out;
    };
    const leerCadena = (inicio, tam) =>
        Buffer.concat(cadena(inicio, FAT).map(sector)).subarray(0, tam);

    // Directorio: entradas fijas de 128 bytes con el nombre en UTF-16. Se conservan TODAS,
    // incluidas las vacias, porque los punteros izq/der/hijo son INDICES en este array:
    // saltearse una corre los indices y el arbol queda apuntando a cualquier lado.
    const dirSectores = cadena(dirInicio, FAT);
    const dirBuf = Buffer.concat(dirSectores.map(sector));
    const entradas = [];
    for (let i = 0; (i + 1) * 128 <= dirBuf.length; i++) {
        const e = dirBuf.subarray(i * 128, (i + 1) * 128);
        const largoNombre = e.readUInt16LE(64);
        entradas.push({
            nombre: largoNombre ? e.subarray(0, Math.max(0, largoNombre - 2)).toString('utf16le') : '',
            tipo: largoNombre ? e[66] : 0,                // 1 = carpeta, 2 = stream, 5 = raiz
            izq: e.readUInt32LE(68),
            der: e.readUInt32LE(72),
            hijo: e.readUInt32LE(76),
            inicio: e.readUInt32LE(116),
            tam: Number(e.readBigUInt64LE(120)),
        });
    }

    /**
     * Hijos DIRECTOS de una entrada. Sin esto no se puede distinguir una propiedad del
     * mensaje de la misma propiedad de un destinatario o de un adjunto: los nombres se
     * repiten identicos en cada nivel, y agarrar "la primera que aparece" devuelve, por
     * ejemplo, la fecha del destinatario — o ninguna. Los hijos cuelgan de un arbol
     * binario que se recorre desde `hijo`.
     */
    const hijosDe = (entrada) => {
        const out = [];
        const vistos = new Set();
        const visitar = (i) => {
            if (i >= FIN_CADENA || i >= entradas.length || vistos.has(i)) return;
            vistos.add(i);
            const e = entradas[i];
            visitar(e.izq);
            if (e.nombre) out.push(e);
            visitar(e.der);
        };
        visitar(entrada?.hijo ?? FIN_CADENA);
        return out;
    };

    // El mini-stream cuelga de la entrada raiz y contiene todos los streams < 4096 bytes.
    const raiz = entradas.find((e) => e.tipo === 5);
    const miniStream = raiz?.tam ? leerCadena(raiz.inicio, raiz.tam) : Buffer.alloc(0);
    const miniFatBuf = Buffer.concat(cadena(miniInicio, FAT).map(sector));
    const MINIFAT = [];
    for (let i = 0; (i + 1) * 4 <= miniFatBuf.length; i++) MINIFAT.push(miniFatBuf.readUInt32LE(i * 4));

    const leer = (e) => {
        if (!e || !e.tam) return Buffer.alloc(0);
        if (e.tam < corteMini && e.tipo === 2) {
            return Buffer.concat(
                cadena(e.inicio, MINIFAT).map((n) => miniStream.subarray(n * TAM_MINI, (n + 1) * TAM_MINI)),
            ).subarray(0, e.tam);
        }
        return leerCadena(e.inicio, e.tam);
    };

    return { entradas, leer, hijosDe, raiz };
}

// ─────────────────────────────────────────────────────────────────────────────
// Texto: los .msg mezclan UTF-16, CP1252 y HTML en el mismo archivo
// ─────────────────────────────────────────────────────────────────────────────

/** Los 32 caracteres donde CP1252 y latin1 difieren: comillas tipograficas, guiones, €. */
const CP1252_ALTO = [
    '\u20ac', '\u0081', '\u201a', '\u0192', '\u201e', '\u2026', '\u2020', '\u2021',
    '\u02c6', '\u2030', '\u0160', '\u2039', '\u0152', '\u008d', '\u017d', '\u008f',
    '\u0090', '\u2018', '\u2019', '\u201c', '\u201d', '\u2022', '\u2013', '\u2014',
    '\u02dc', '\u2122', '\u0161', '\u203a', '\u0153', '\u009d', '\u017e', '\u0178',
];

export function decodificarAnsi(buf) {
    let s = '';
    for (const b of buf) s += b >= 0x80 && b <= 0x9f ? CP1252_ALTO[b - 0x80] : String.fromCharCode(b);
    return s;
}

const ENTIDADES = {
    nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ldquo: '“', rdquo: '”',
    lsquo: '‘', rsquo: '’', ndash: '–', mdash: '—', hellip: '…', aacute: 'á', eacute: 'é',
    iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', deg: '°',
    euro: '€', bull: '•', middot: '·',
};

export function desescapar(s) {
    return s
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
        .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n] ?? m);
}

/**
 * HTML de Outlook → texto plano legible. Los saltos importan: la mayoria de estos mails
 * son listas numeradas de pedidos y sin los saltos se leen como un chorizo.
 */
export function htmlATexto(html) {
    return desescapar(
        html
            .replace(/<!--[\s\S]*?-->/g, ' ')
            .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
            .replace(/<\/?(p|div|tr|h[1-6]|ul|ol|blockquote)\b[^>]*>/gi, '\n')
            .replace(/<(br|li)\b[^>]*>/gi, '\n')
            .replace(/<\/t[dh]>/gi, '\t')
            .replace(/<[^>]+>/g, ''),
    )
        .replace(/\r\n?/g, '\n')
        // Espacios que Outlook mete y que no son el espacio comun (nbsp, en/em space,
        // zero-width, BOM): sin normalizarlos, las lineas "vacias" de la firma no se
        // detectan como vacias y quedan veinte renglones en blanco al final del mail.
        .replace(/[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000\ufeff]/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Propiedades MAPI
// ─────────────────────────────────────────────────────────────────────────────

const TAG = {
    asunto: '0037', deName: '0C1A', deSmtp: '5D01', deDireccion: '0C1F',
    para: '0E04', copia: '0E03', cuerpoTexto: '1000', cuerpoHtml: '1013',
    headers: '007D', adjuntoLargo: '3707', adjuntoCorto: '3704',
};

/** FILETIME (100 ns desde 1601) → Date. */
export function fileTimeADate(bajo, alto) {
    const ticks = (BigInt(alto) << 32n) | BigInt(bajo >>> 0);
    if (ticks === 0n) return null;
    const ms = ticks / 10000n - 11644473600000n;
    const d = new Date(Number(ms));
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Busca una propiedad de fecha en `__properties_version1.0`. El stream arranca con un
 * header (32 bytes en el nivel del mensaje) y sigue con entradas fijas de 16 bytes:
 * tag(4) + flags(4) + valor(8).
 */
function fechaDePropiedades(buf, tags) {
    for (let off = 32; off + 16 <= buf.length; off += 16) {
        const tipo = buf.readUInt16LE(off);
        const prop = buf.readUInt16LE(off + 2).toString(16).padStart(4, '0').toUpperCase();
        if (tipo !== 0x0040 || !tags.includes(prop)) continue;   // 0x0040 = PT_SYSTIME
        const d = fileTimeADate(buf.readUInt32LE(off + 8), buf.readUInt32LE(off + 12));
        if (d) return d;
    }
    return null;
}

/** Fecha del header `Date:` de internet — el respaldo cuando la propiedad MAPI no esta. */
function fechaDeHeaders(headers) {
    const m = /^Date:\s*(.+)$/mi.exec(headers || '');
    if (!m) return null;
    const d = new Date(m[1].trim());
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Lee un .msg y devuelve lo que hace falta para saber que se pidio:
 * `{ asunto, de, para, fecha, cuerpo, adjuntos, archivo }`.
 */
export function leerMsg(ruta) {
    const { leer, hijosDe, raiz } = abrirCFB(fs.readFileSync(ruta));

    // Solo el primer nivel: los destinatarios y los adjuntos son sub-carpetas que repiten
    // los MISMOS nombres de propiedad que el mensaje (asunto, nombre, fecha). Mezclarlos
    // hace que un mail devuelva el nombre del destinatario como remitente, o ninguna fecha.
    const propios = hijosDe(raiz);
    const streams = new Map();
    for (const e of propios) {
        if (e.tipo === 2 && e.nombre.startsWith('__substg1.0_')) streams.set(e.nombre, e);
    }
    const texto = (tag) => {
        const uni = streams.get(`__substg1.0_${tag}001F`);
        if (uni) return leer(uni).toString('utf16le').replace(/\0+$/, '').trim();
        const ansi = streams.get(`__substg1.0_${tag}001E`);
        return ansi ? decodificarAnsi(leer(ansi)).replace(/\0+$/, '').trim() : '';
    };

    let cuerpo = texto(TAG.cuerpoTexto);
    if (!cuerpo) {
        const htmlUni = streams.get(`__substg1.0_${TAG.cuerpoHtml}001F`);
        const htmlBin = streams.get(`__substg1.0_${TAG.cuerpoHtml}0102`);
        const crudo = htmlUni ? leer(htmlUni).toString('utf16le')
            : htmlBin ? decodificarAnsi(leer(htmlBin))
                : '';
        // Outlook declara el charset adentro del propio HTML; si dice UTF-8 hay que releer.
        const html = /charset=["']?utf-?8/i.test(crudo) && htmlBin
            ? leer(htmlBin).toString('utf8')
            : crudo;
        if (html) cuerpo = htmlATexto(html);
    }

    const headers = texto(TAG.headers);
    const propiedades = propios.find((e) => e.nombre === '__properties_version1.0' && e.tipo === 2);
    const fecha = (propiedades ? fechaDePropiedades(leer(propiedades), ['0039', '0E06']) : null)
        ?? fechaDeHeaders(headers);

    // Cada adjunto es una carpeta `__attach_version1.0_#XXXXXXXX` colgada de la raiz, con
    // su nombre de archivo adentro.
    const adjuntos = [];
    for (const carpeta of propios) {
        if (carpeta.tipo !== 1 || !carpeta.nombre.startsWith('__attach_version1.0')) continue;
        for (const tag of [TAG.adjuntoLargo, TAG.adjuntoCorto]) {
            const e = hijosDe(carpeta).find((x) => x.nombre === `__substg1.0_${tag}001F`);
            const n = e ? leer(e).toString('utf16le').replace(/\0+$/, '').trim() : '';
            if (n) { if (!adjuntos.includes(n)) adjuntos.push(n); break; }
        }
    }

    const de = [texto(TAG.deName), texto(TAG.deSmtp) || texto(TAG.deDireccion)]
        .filter((s) => s && !s.startsWith('/O='))
        .join(' <') || '(sin remitente)';

    return {
        archivo: path.basename(ruta),
        asunto: texto(TAG.asunto) || '(sin asunto)',
        de: de.includes('<') ? `${de}>` : de,
        para: texto(TAG.para),
        copia: texto(TAG.copia),
        fecha,
        cuerpo,
        adjuntos,
        headers,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

function imprimir(m, max) {
    console.log(`\n${'═'.repeat(78)}`);
    console.log(`ARCHIVO  ${m.archivo}`);
    console.log(`ASUNTO   ${m.asunto}`);
    console.log(`DE       ${m.de}`);
    if (m.para) console.log(`PARA     ${m.para}`);
    if (m.copia) console.log(`CC       ${m.copia}`);
    console.log(`FECHA    ${m.fecha ? m.fecha.toISOString().replace('T', ' ').slice(0, 16) : '(sin fecha)'}`);
    if (m.adjuntos.length) console.log(`ADJUNTOS ${m.adjuntos.join(' | ')}`);
    console.log(`${'─'.repeat(78)}`);
    const cuerpo = max > 0 && m.cuerpo.length > max
        ? `${m.cuerpo.slice(0, max)}\n[... ${m.cuerpo.length - max} caracteres mas, usar --max 0]`
        : m.cuerpo;
    console.log(cuerpo || '(cuerpo vacio)');
}

function main(argv) {
    const json = argv.includes('--json');
    const iMax = argv.indexOf('--max');
    const max = iMax >= 0 ? Number(argv[iMax + 1]) : 6000;
    const iDir = argv.indexOf('--dir');
    const libres = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--max' && argv[i - 1] !== '--dir');

    let rutas = [];
    if (iDir >= 0) {
        const dir = argv[iDir + 1];
        if (!dir || !fs.existsSync(dir)) { console.error(`no existe la carpeta: ${dir}`); return 1; }
        rutas = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.msg')).map((f) => path.join(dir, f));
        if (!rutas.length) { console.error(`sin archivos .msg en ${dir}`); return 1; }
    } else if (libres.length) {
        rutas = libres;
    } else {
        console.error('uso: node scripts/_leerMsg.mjs "<ruta.msg>" [--json] [--max <n>]');
        console.error('     node scripts/_leerMsg.mjs --dir "<carpeta>"');
        return 1;
    }

    const leidos = [];
    for (const r of rutas) {
        try {
            const m = leerMsg(r);
            leidos.push(m);
            if (!json) imprimir(m, max);
        } catch (e) {
            if (json) leidos.push({ archivo: path.basename(r), error: String(e.message) });
            else console.error(`✗  ${path.basename(r)}: ${e.message}`);
        }
    }
    if (json) console.log(JSON.stringify(leidos.length === 1 ? leidos[0] : leidos, null, 2));
    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
    process.exit(main(process.argv.slice(2)));
}
