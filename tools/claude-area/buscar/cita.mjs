#!/usr/bin/env node
/**
 * cita.mjs - comprueba que una frase citada esta DE VERDAD en un documento. Es el control de
 * "cita inventada": antes de poner una frase entre comillas en una respuesta, se corre esto.
 *
 *   node cita.mjs "<frase textual>" <archivo> [--json] [--conocimiento <carpeta>]
 *
 * Compara sin tildes, sin mayusculas y con los espacios de mas (y un salto de renglon suelto) como
 * uno solo. Todo lo demas tiene que ser igual: una palabra distinta, una cifra o un signo cambiado
 * es "no esta". Una frase no puede empezar en un parrafo y terminar en otro (un renglon en blanco
 * corta). Si cruza celdas de una tabla (`|`) o lleva marcas de negrita, no coincide: hay que citar
 * el texto de una sola celda, tal como esta en el archivo.
 *
 * <archivo> es una ruta, o la ruta relativa que da buscar.mjs (se busca adentro del conocimiento:
 * --conocimiento, CLAUDE_AREA_CONOCIMIENTO o `..\conocimiento` al lado de este programa).
 * Si esta: dice el renglon, y el documento, la revision y la seccion para armar la cita.
 *
 * Codigos de salida:  0 la frase esta   1 la frase NO esta   2 no se pudo comprobar (archivo, opcion)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ErrorUso, leerArgs, leerTexto, buscarFrase, renglonMasParecido, partirEnSecciones, nombreSeccion } from './lib.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

const USO = `Uso: node cita.mjs "<frase textual>" <archivo> [--json] [--conocimiento <carpeta>]
  Sale con 0 si la frase esta en el archivo, 1 si NO esta, 2 si no se pudo comprobar.`;

function esArchivo(p) {
    try { return fs.statSync(p).isFile(); } catch { return false; }
}

function resolverArchivo(dado, opcionConocimiento) {
    if (esArchivo(dado)) return path.resolve(dado);
    const raices = [opcionConocimiento, process.env.CLAUDE_AREA_CONOCIMIENTO, path.join(AQUI, '..', 'conocimiento'), path.join(AQUI, '..', '..', 'conocimiento')]
        .filter(Boolean);
    for (const raiz of raices) {
        const c = path.resolve(raiz, ...dado.split(/[\\/]/));
        if (esArchivo(c)) return c;
    }
    throw new ErrorUso(`No encuentro el archivo ${dado}. Pasá la ruta completa o --conocimiento <carpeta>.`);
}

function main() {
    const { pos, opts } = leerArgs(process.argv.slice(2), { valor: ['--conocimiento'], bandera: ['--json', '--help', '-h'] });
    if (opts['--help'] || opts['-h']) { console.log(USO); return 0; }
    if (pos.length !== 2) throw new ErrorUso(`Hay que indicar la frase y el archivo. ${USO.split('\n')[0]}`);
    const [frase, archivo] = pos;
    if (!frase.trim()) throw new ErrorUso('La frase está vacía.');
    const ruta = resolverArchivo(archivo, opts['--conocimiento']);
    const texto = leerTexto(fs.readFileSync(ruta));
    const apariciones = buscarFrase(texto, frase);
    const lineas = texto.split(/\r?\n/);
    const doc = partirEnSecciones(texto, path.basename(ruta));

    if (!apariciones.length) {
        const parecido = renglonMasParecido(texto, frase);
        if (opts['--json']) {
            console.log(JSON.stringify({ esta: false, archivo: ruta, frase, mas_parecido: parecido }, null, 2));
        } else {
            console.log(`NO ESTÁ: esa frase no figura en ${archivo}. No la cites así.`);
            if (parecido) console.log(`Lo más parecido (no es una cita, es una pista): renglón ${parecido.n}: ${parecido.texto.slice(0, 200)}`);
        }
        return 1;
    }
    const a = apariciones[0];
    const sec = doc.secciones.find((s) => a.desde >= s.desde && a.desde <= s.hasta) || null;
    const renglones = a.desde === a.hasta ? `${a.desde}` : `${a.desde}-${a.hasta}`;
    if (opts['--json']) {
        console.log(JSON.stringify({
            esta: true, archivo: ruta, frase, desde: a.desde, hasta: a.hasta, apariciones: apariciones.length,
            documento: doc.documento, codigo: doc.codigo, rev: doc.rev, fuente: doc.fuente,
            seccion: sec ? { numeral: sec.numeral, titulo: sec.titulo, desde: sec.desde, hasta: sec.hasta } : null,
            renglon: lineas[a.desde - 1] ?? '',
        }, null, 2));
        return 0;
    }
    console.log(`OK: la frase está en ${archivo}, renglón ${renglones}${apariciones.length > 1 ? ` (y ${apariciones.length - 1} vez más: renglón ${apariciones.slice(1, 4).map((x) => x.desde).join(', ')})` : ''}.`);
    const rev = doc.rev ? (/^v\d/.test(doc.rev) ? doc.rev : `rev ${doc.rev}`) : 'sin revisión';
    console.log(`Documento: ${doc.documento} · ${rev}${sec && nombreSeccion(sec) ? ` · sección ${nombreSeccion(sec)}` : ''}`);
    if (doc.fuente) console.log(`Original: ${doc.fuente}`);
    console.log(`  ${a.desde} | ${(lineas[a.desde - 1] || '').trim().slice(0, 240)}`);
    return 0;
}

try {
    process.exitCode = main();
} catch (e) {
    console.error(`Error: ${e instanceof ErrorUso ? e.message : e && e.stack ? e.stack : e}`);
    process.exitCode = 2;
}
