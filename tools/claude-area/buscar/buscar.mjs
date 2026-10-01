#!/usr/bin/env node
/**
 * buscar.mjs - busca en el conocimiento y devuelve los mejores pasajes, con documento, revision,
 * seccion, renglones, ruta del original y un recorte de 2 a 3 renglones.
 *
 *   node buscar.mjs "<pregunta o palabras>" [--area <id>] [--max 5] [--json]
 *
 *   --area <id>      busca en `comun` mas esa area (calidad, ingenieria, logistica, ...)
 *   --max <n>        cuantos pasajes (de 1 a 50, por defecto 5)
 *   --json           la salida para programas (el texto de siempre es para leer)
 *   --indice <ruta>  el indice (indice.db, o la carpeta que lo tiene)
 *   --conocimiento <carpeta>  para avisar si el indice quedo viejo
 *
 * No hace falta escribir las tildes ni las mayusculas ("inspeccion" encuentra "inspección") y los
 * plurales se encuentran solos ("piezas" encuentra "pieza"). Lo que va entre comillas, un codigo
 * (I-AC-018) y un numeral (5.2.3) se buscan tal cual. Primero salen las secciones que traen TODAS
 * las palabras; si faltan, se completa con las que traen algunas.
 *
 * --solo-documentos deja afuera las fichas y los indices (lo que no tiene `fuente:`): solo documentos del SGC.
 *
 * Donde busca el indice: --indice, la variable CLAUDE_AREA_INDICE, `indice.db` al lado de este
 * programa, o `..\indice\indice.db`.
 * Si algun archivo del conocimiento cambio despues de armar el indice, lo avisa en una linea.
 * Sale con 0 (tambien si no hay resultados) y con 1 si no pudo buscar (sin indice, opcion mala).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    ErrorUso, leerArgs, cargarSqlite, abrirIndice, leerMeta, areasDelIndice, buscarPasajes,
    nombreSeccion, revisarFrescura, avisoDeFrescura, normalizar,
} from './lib.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

const USO = `Uso: node buscar.mjs "<pregunta o palabras>" [--area <id>] [--max 5] [--json]
  --area <id>               busca en comun + esa area
  --max <n>                 cuantos pasajes (1 a 50, por defecto 5)
  --json                    salida para programas
  --solo-documentos         deja afuera las fichas y los indices (solo documentos con original)
  --indice <ruta>           el indice (indice.db o la carpeta que lo tiene)
  --conocimiento <carpeta>  para avisar si el indice quedo viejo
  No hace falta escribir tildes ni mayusculas. Sale con 0 (tambien sin resultados) y con 1 si no pudo buscar.`;

function esCarpeta(p) {
    try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function encontrarIndice(opcion) {
    const dado = opcion || process.env.CLAUDE_AREA_INDICE;
    if (dado) {
        const ruta = path.resolve(dado);
        return esCarpeta(ruta) ? path.join(ruta, 'indice.db') : ruta;
    }
    const candidatos = [path.join(AQUI, 'indice.db'), path.join(AQUI, '..', 'indice', 'indice.db')];
    return candidatos.find((c) => fs.existsSync(c)) || candidatos[0];
}

function encontrarConocimiento(opcion, meta) {
    const candidatos = [
        opcion, process.env.CLAUDE_AREA_CONOCIMIENTO, meta.conocimiento,
        path.join(AQUI, '..', 'conocimiento'), path.join(AQUI, '..', '..', 'conocimiento'),
    ].filter(Boolean).map((c) => path.resolve(c));
    return candidatos.find(esCarpeta) || null;
}

function texto(consulta, area, r, aviso) {
    const L = [];
    const donde = area ? ` en ${[...new Set(['comun', area])].join(' + ')}` : '';
    if (aviso) L.push(aviso);
    if (!r.resultados.length) {
        L.push(`Sin resultados para «${consulta}»${donde}. Probá con otras palabras${area ? ' o sin --area' : ''}.`);
        return L.join('\n');
    }
    L.push(`${r.resultados.length} ${r.resultados.length === 1 ? 'pasaje' : 'pasajes'} para «${consulta}»${donde}:`);
    r.resultados.forEach((p, i) => {
        L.push('');
        const rev = p.rev ? (/^v\d/.test(p.rev) ? p.rev : `rev ${p.rev}`) : 'sin revisión';
        const parcial = p.coinciden < p.de ? ` (trae ${p.coinciden} de ${p.de} palabras)` : '';
        L.push(`[${i + 1}] ${p.documento} · ${rev}${parcial}`);
        const sec = nombreSeccion(p);
        L.push(`    ${sec ? `sección: ${sec} · ` : ''}renglones ${p.desde}-${p.hasta} · ${p.area}`);
        L.push(`    extracto: ${p.archivo}`);
        L.push(`    original: ${p.fuente || '(no es un documento del SGC: es una ficha o un índice; el original está en el documento que nombra)'}`);
        const ancho = String(Math.max(...p.recorte.map((x) => x.n))).length;
        for (const x of p.recorte) L.push(`    ${String(x.n).padStart(ancho)} | ${x.texto}`);
    });
    return L.join('\n');
}

async function main() {
    const { pos, opts } = leerArgs(process.argv.slice(2), {
        valor: ['--area', '--max', '--indice', '--conocimiento'], bandera: ['--json', '--solo-documentos', '--help', '-h'],
    });
    if (opts['--help'] || opts['-h']) { console.log(USO); return 0; }
    if (pos.length === 0) throw new ErrorUso(`Falta qué buscar. ${USO.split('\n')[0]}`);
    const consulta = pos.join(' ').trim();
    let max = 5;
    if (opts['--max'] !== undefined) {
        max = Number(opts['--max']);
        if (!Number.isInteger(max) || max < 1 || max > 50) throw new ErrorUso('--max tiene que ser un número entero de 1 a 50.');
    }
    const area = opts['--area'] ? normalizar(opts['--area']).trim() : null;

    const { DatabaseSync } = await cargarSqlite();
    const rutaIndice = encontrarIndice(opts['--indice']);
    const db = abrirIndice(DatabaseSync, rutaIndice);
    try {
        const meta = leerMeta(db);
        if (area) {
            const areas = areasDelIndice(db);
            if (areas.length && !areas.includes(area)) throw new ErrorUso(`No hay documentos del área «${area}» en el índice. Áreas: ${areas.join(', ')}.`);
        }
        const raiz = encontrarConocimiento(opts['--conocimiento'], meta);
        let aviso = null;
        if (raiz) aviso = avisoDeFrescura(revisarFrescura(db, raiz), meta.creado);

        const r = buscarPasajes(db, consulta, { area, max, soloDocumentos: !!opts['--solo-documentos'] });
        if (!r.terminos.length) throw new ErrorUso('No hay nada que buscar en lo que escribiste (solo signos o palabras vacías).');
        if (opts['--json']) {
            const salida = {
                consulta, area, max, aviso,
                indice: { ruta: rutaIndice, creado: meta.creado, archivos: Number(meta.archivos), secciones: Number(meta.secciones) },
                resultados: r.resultados.map((p) => ({ ...p, ruta: raiz ? path.join(raiz, ...p.archivo.split('/')) : null })),
            };
            console.log(JSON.stringify(salida, null, 2));
        } else {
            console.log(texto(consulta, area, r, aviso));
        }
    } finally {
        db.close();
    }
    return 0;
}

main().then((c) => { process.exitCode = c; }, (e) => {
    console.error(`Error: ${e instanceof ErrorUso ? e.message : e && e.stack ? e.stack : e}`);
    process.exitCode = 1;
});
