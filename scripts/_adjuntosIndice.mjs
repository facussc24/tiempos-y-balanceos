/**
 * _adjuntosIndice.mjs — indice de los 3D y DXF que llegaron por mail (tanda 14 del plan del sistema, item 13).
 *
 * POR QUE EXISTE: el 09/10/2026 una sesion busco «los 3D de Carlos (estanteria del inserto)» y cerro con «no hay 3D en
 * la nube ni en los mails». Estaban en dos mails de Pablo Gamboa con Fak en copia: «ESTANTERIA INSERTO MODIFICADO»
 * (25/08, `ESTANTERIA INSERTO -1.rar`) y «ESTANTERIA MOVIL INSERTO ESPUMA» (28/08). Nadie habia hecho un indice de los
 * adjuntos de diseño que manda la gente: es la pieza que le falta a HOY-19h («buscar un 3D por nombre o por quien lo
 * hizo»). Informe D del 15/10, punto 3.
 *
 * QUE HACE Y QUE NO:
 *   - Lee SOLO la copia local (`.mail-cache/mails.jsonl`): el NOMBRE de cada adjunto, la fecha, el remitente y el
 *     asunto. No abre Outlook, no baja ni abre ningun archivo.
 *   - Por cada adjunto de diseño (.step .stp .igs .iges .stl .dxf .plt .dwg .3dm, y tambien .catpart .catproduct
 *     .sldprt .sldasm .3mf .x_t .f3d .jt) dice en que mail esta. Los comprimidos (.rar .zip .7z .tar) van APARTE como
 *     «comprimido, sin abrir»: el de la estanteria era un .rar, y adentro no se mira (puede traer un 3D o cualquier cosa).
 *   - Agrupa por pieza (el nombre del archivo sin la version del final: «TOPE TOP ROLL 2A» y «… 10B» son la misma
 *     pieza) y deja la lista de versiones con su fecha.
 *   - Para sacar un archivo: `python scripts/_mails.py --adjuntos <id>` en la PC que tiene el Outlook (eso SI abre Outlook).
 *
 *   node scripts/_adjuntosIndice.mjs                         -> exports/adjuntos_3d_dxf_<fecha>.md del checkout principal
 *   node scripts/_adjuntosIndice.mjs --buscar "estanteria inserto"   -> solo los que tienen TODAS esas palabras
 *   node scripts/_adjuntosIndice.mjs [--mails <jsonl>] [--out <archivo.md>]
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    rutaMailsJsonl, salidaPorDefecto, leerMails, celda, escribirSalida, leerArgs, normalizarTexto, fechaLocal, taparClaves,
} from './_lib/lectorMails.mjs';

/** Lo que pidio el encargo (tanda 14) y lo que suma este indice porque Barack lo recibe (CATIA, SolidWorks, Bambu). */
export const EXT_PEDIDAS = Object.freeze(['step', 'stp', 'igs', 'iges', 'stl', 'dxf', 'plt', 'dwg', '3dm']);
export const EXT_SUMADAS = Object.freeze(['catpart', 'catproduct', 'sldprt', 'sldasm', '3mf', 'x_t', 'f3d', 'jt']);
export const EXT_COMPRIMIDOS = Object.freeze(['rar', 'zip', '7z', 'tar']);

/** 'cad' | 'comprimido' | null, por la extension del nombre (sin importar mayusculas). */
export function tipoAdjunto(nombre) {
    const m = /\.([a-z0-9_]+)$/i.exec(String(nombre ?? '').trim());
    if (!m) return null;
    const e = m[1].toLowerCase();
    if (EXT_PEDIDAS.includes(e) || EXT_SUMADAS.includes(e)) return 'cad';
    if (EXT_COMPRIMIDOS.includes(e)) return 'comprimido';
    return null;
}

/*
 * Lo que se saca del final del nombre CRUDO (antes de normalizar: asi se sabe como esta pegado) para quedarse con la pieza:
 *   - una palabra de version o copia (v3, 2A, 10B, R13, Rev25, «REV 12», una letra sola, modelo, final, corregido…);
 *   - una fecha separada por un espacio («DUCTO COZZUOL 8-8-25»);
 *   - un numero suelto de 1 a 3 cifras SOLO si va separado por un espacio («INSERTO -1», «Corte 1») o entre parentesis
 *     (la copia de Windows, «(2)»). Pegado con -, _ o . es parte del nombre. Medido en la copia el 17/10/2026: de 40
 *     piezas que juntaban mas de un nombre, dos eran cosas distintas y las dos por un numero pegado: «ESTANTERIA-1»
 *     (otra estanteria que «ESTANTERIA», mails del 21/08 con asuntos distintos) y «MYLAR MP7315-16» (otro codigo que MP7315).
 */
const PALABRA_VERSION = /[\s_.-]+(v\d+[a-z]?|\d{1,3}[a-z]|[a-z]|rev\s*[a-z0-9]*|r\d+|modelo|final|nuevo|nueva|modificado|modificada|copia|corregido|ok)$/i;
const FECHA_FINAL = /\s+\d{1,2}[-._]\d{1,2}[-._]\d{2,4}$/;
const NUMERO_SUELTO = /(?:\s+-?\s*\d{1,3}|\s*\(\d{1,3}\))$/;

/**
 * La pieza a la que pertenece un archivo: el nombre sin extension y sin las marcas de version del final, sin tildes ni
 * mayusculas. «TOPE TOP ROLL 10B.STL» -> «tope top roll»; «ESTANTERIA INSERTO -1.rar» -> «estanteria inserto»;
 * «ESTANTERIA-1.rar» -> «estanteria 1». Un nombre que es solo version («1.stl») queda como esta.
 * La clave se tapa sobre el nombre crudo, ANTES de normalizar: normalizar parte en los guiones y una clave partida ya no
 * la reconoce nadie (revision por API, encargo E261018-bbbc, punto 1).
 */
export function piezaDe(nombre) {
    let raiz = taparClaves(String(nombre ?? '')).replace(/\.[a-z0-9_]+$/i, '').trim();
    for (;;) {
        const sin = raiz.replace(PALABRA_VERSION, '').replace(FECHA_FINAL, '').replace(NUMERO_SUELTO, '').trim();
        if (sin === raiz || !normalizarTexto(sin)) break;
        raiz = sin;
    }
    return normalizarTexto(raiz);
}

/** Una fila por adjunto de diseño (o comprimido) de cada mail. El mismo archivo en dos mails da dos filas. */
export function filasDeAdjuntos(mails) {
    const filas = [];
    for (const m of mails) {
        const vistos = new Set();
        for (const nombre of m.adjuntos) {
            const tipo = tipoAdjunto(nombre);
            if (!tipo) continue;
            const k = nombre.toLowerCase();
            if (vistos.has(k)) continue;          // el mismo archivo dos veces en el mismo mail cuenta una
            vistos.add(k);
            filas.push({
                tipo, archivo: nombre, pieza: piezaDe(nombre), fecha: m.fecha, de: m.de || m.de_mail,
                para: m.para, asunto: m.asunto, id: m.id, enviado: m.clase === 'enviados',
            });
        }
    }
    return filas;
}

/** Filtra por palabras: TODAS tienen que estar en el nombre del archivo o en el asunto (sin tildes, plural o singular). */
export function buscar(filas, consulta) {
    const raiz = (t) => (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t);
    const palabras = normalizarTexto(consulta).split(' ').filter(Boolean).map(raiz);
    if (!palabras.length) return filas;
    return filas.filter((f) => {
        const bolsa = new Set(normalizarTexto(`${f.archivo} ${f.asunto}`).split(' ').map(raiz));
        return palabras.every((p) => bolsa.has(p));
    });
}

/** Agrupa por pieza: archivos distintos, fechas, quien los mando y cuantos mails. La pieza mas nueva primero. */
export function porPieza(filas) {
    const g = new Map();
    for (const f of filas) {
        const p = g.get(f.pieza) ?? { pieza: f.pieza, archivos: new Map(), remitentes: new Set(), mails: new Set(), asuntos: new Set(), primera: f.fecha, ultima: f.fecha };
        if (!p.archivos.has(f.archivo.toLowerCase())) p.archivos.set(f.archivo.toLowerCase(), { archivo: f.archivo, fecha: f.fecha });
        p.remitentes.add(f.de);
        p.asuntos.add(f.asunto.replace(/^((re|rv|fw|fwd)\s*:\s*)+/i, '').trim());
        p.mails.add(f.id);
        if (f.fecha < p.primera) p.primera = f.fecha;
        if (f.fecha > p.ultima) p.ultima = f.fecha;
        g.set(f.pieza, p);
    }
    return [...g.values()].sort((a, b) => (a.ultima < b.ultima ? 1 : a.ultima > b.ultima ? -1 : 0));
}

function conteo(filas, campo) {
    const c = new Map();
    for (const f of filas) c.set(f[campo], (c.get(f[campo]) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
}

const ext = (n) => (/\.([a-z0-9_]+)$/i.exec(n)?.[1] ?? '').toLowerCase();

/** El markdown completo. `meta`: { hoy, fuente, leidos, contados, fechaMin, fechaMax, consulta }. */
export function aMarkdown(filas, meta) {
    const cad = filas.filter((f) => f.tipo === 'cad');
    const comp = filas.filter((f) => f.tipo === 'comprimido');
    const distintos = (fs) => new Set(fs.map((f) => f.archivo.toLowerCase())).size;
    const o = [];
    o.push(`# Adjuntos 3D y DXF que llegaron por mail — ${meta.hoy}`);
    o.push('');
    o.push(`Fuente: la copia local de mails (${meta.leidos} renglones, ${meta.contados} mails sin repetir, del ${meta.fechaMin} al ${meta.fechaMax}). Se leyo solo el NOMBRE de cada adjunto: no se abrio Outlook ni se bajo ningun archivo. Un mismo mail en la Bandeja y en Eliminados cuenta una vez; Borradores, Bandeja de salida y Correo no deseado no cuentan.`);
    if (meta.consulta) o.push(`\nFiltro: archivos o asuntos con todas estas palabras: «${celda(meta.consulta)}».`);
    o.push('');
    o.push('Para sacar un archivo: `python scripts/_mails.py --adjuntos <id>` en la PC que tiene el Outlook (el id esta en la ultima columna del detalle).');
    o.push('');
    o.push('## Resumen');
    o.push('');
    o.push(`- **${cad.length} adjuntos de diseño** en ${new Set(cad.map((f) => f.id)).size} mails (${distintos(cad)} nombres de archivo distintos).`);
    o.push(`- **${comp.length} comprimidos sin abrir** (.rar, .zip, .7z, .tar) en ${new Set(comp.map((f) => f.id)).size} mails: pueden traer un 3D adentro; no se miro.`);
    o.push(`- Por tipo: ${conteo(cad.map((f) => ({ e: ext(f.archivo) })), 'e').map(([e, n]) => `${e} ${n}`).join(' · ') || 'ninguno'}.`);
    o.push(`- Por quien lo mando (diseño + comprimidos): ${conteo(filas, 'de').slice(0, 10).map(([d, n]) => `${celda(d) || 'sin remitente'} ${n}`).join(' · ') || 'nadie'}.`);
    o.push('');
    const tablaPiezas = (titulo, fs) => {
        o.push(`## ${titulo}`);
        o.push('');
        if (!fs.length) { o.push('Ninguno.'); o.push(''); return; }
        // El asunto va al lado: el nombre del archivo solo junta piezas distintas («ESTANTERIA.rar» y «ESTANTERIA-1.rar»
        // del 21/08 son dos estanterias: «DE CAJAS» y «IP Y TOP ROLL»; auditor de la tanda 14, nit 2).
        o.push('| Pieza | Archivos (versiones), con la fecha del primer mail | Asuntos de los mails | Primer mail | Ultimo mail | Quien lo mando | Mails |');
        o.push('|---|---|---|---|---|---|---|');
        for (const p of porPieza(fs)) {
            const archivos = [...p.archivos.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).map((a) => `${celda(a.archivo)} (${a.fecha.slice(0, 10)})`).join('; ');
            const asuntos = [...p.asuntos].filter(Boolean);
            const verAsuntos = asuntos.slice(0, 3).map((x) => `«${celda(x)}»`).join('; ') + (asuntos.length > 3 ? ` y ${asuntos.length - 3} mas` : '');
            o.push(`| ${celda(p.pieza) || '(sin nombre)'} | ${archivos} | ${verAsuntos || '—'} | ${p.primera.slice(0, 10)} | ${p.ultima.slice(0, 10)} | ${[...p.remitentes].map(celda).join(', ')} | ${p.mails.size} |`);
        }
        o.push('');
    };
    tablaPiezas('Por pieza — archivos de diseño', cad);
    tablaPiezas('Por pieza — comprimidos sin abrir', comp);
    const detalle = (titulo, fs) => {
        o.push(`## ${titulo}`);
        o.push('');
        if (!fs.length) { o.push('Ninguno.'); o.push(''); return; }
        o.push('| Fecha | De | Asunto | Archivo | Enviado por Fak | id del mail |');
        o.push('|---|---|---|---|---|---|');
        for (const f of [...fs].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))) {
            o.push(`| ${f.fecha} | ${celda(f.de)} | ${celda(f.asunto)} | ${celda(f.archivo)} | ${f.enviado ? 'si' : ''} | \`${f.id}\` |`);
        }
        o.push('');
    };
    detalle('Detalle — archivos de diseño, el mas nuevo primero', cad);
    detalle('Detalle — comprimidos sin abrir, el mas nuevo primero', comp);
    return o.join('\n');
}

async function main() {
    let a;
    try { a = leerArgs(process.argv.slice(2), ['--mails', '--out', '--buscar']); } catch (e) { console.error(e.message); process.exit(1); }
    if (a.ayuda) {
        console.log('Uso: node scripts/_adjuntosIndice.mjs [--buscar "<palabras>"] [--mails <mails.jsonl>] [--out <archivo.md>]');
        return;
    }
    const jsonl = a.mails || rutaMailsJsonl();
    if (!jsonl) { console.error('No encontre la copia local de mails (.mail-cache/mails.jsonl) ni aca ni en el checkout principal.'); process.exit(1); }
    const { mails, leidos, fechaMin, fechaMax } = await leerMails(jsonl);
    let filas = filasDeAdjuntos(mails);
    if (a.buscar) filas = buscar(filas, a.buscar);
    const hoy = fechaLocal();
    const md = aMarkdown(filas, { hoy, leidos, contados: mails.length, fechaMin, fechaMax, consulta: a.buscar });
    const out = a.out || (a.buscar ? null : salidaPorDefecto(`adjuntos_3d_dxf_${hoy}.md`));
    if (out) { escribirSalida(out, md); console.log(`Dejado en ${out}`); } else console.log(taparClaves(md));
    const cad = filas.filter((f) => f.tipo === 'cad').length;
    console.log(`${cad} adjuntos de diseño y ${filas.length - cad} comprimidos sin abrir (${mails.length} mails sin repetir leidos de ${path.basename(jsonl)}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
