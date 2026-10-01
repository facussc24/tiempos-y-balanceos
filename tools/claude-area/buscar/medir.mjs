#!/usr/bin/env node
/**
 * medir.mjs - mide el buscador contra `rg -i` sobre el conocimiento real: tiempo de armar el indice,
 * tamano del indice, y 10 consultas con el tiempo total de cada una (con el arranque de Node) y
 * cuantas encuentra cada uno cuando se escribe sin tildes.
 *
 *   node medir.mjs <carpeta conocimiento> [--rg <rg.exe>] [--veces 9]
 *
 * El indice queda en una carpeta temporal (al final se dice la ruta; no se borra nada). No escribe
 * nada en el conocimiento. "Acierta" = el documento que contesta aparece (en los 5 primeros pasajes
 * de buscar.mjs; con al menos una linea encontrada en rg). Cada tiempo es la mediana de --veces corridas
 * (la primera, de calentamiento, no cuenta) y entre parentesis el minimo, que es lo que cuesta cuando la
 * PC no esta ocupada. rg se busca con --rg, con la variable RG, en el PATH y, si no esta, el que trae
 * Claude Code.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { leerArgs, ErrorUso, cargarSqlite, abrirIndice, buscarPasajes } from './lib.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

// consulta sin tildes (como la escribe la persona), la misma con tildes, y el documento que la contesta
const CONSULTAS = [
    ['tres piezas malas seguidas', 'tres piezas malas seguidas', /P-09\.1|P-13|calidad[\\/]ficha/],
    ['calibracion de cintas metricas', 'calibración de cintas métricas', /I-AC-018/],
    ['devolucion de cliente', 'devolución de cliente', /I-AC-012/],
    ['liberacion de inicio de produccion', 'liberación de inicio de producción', /I-AC-038/],
    ['notificacion al proveedor', 'notificación al proveedor', /I-AC-010/],
    ['funciones del supervisor de produccion', 'funciones del supervisor de producción', /F-24/],
    ['auditoria de producto terminado', 'auditoría de producto terminado', /I-AC-003/],
    ['medicion con calibre vernier', 'medición con calibre vernier', /I-AC-051/],
    ['plan de contingencia', 'plan de contingencia', /P-21/],
    ['analisis de los sistemas de medicion', 'análisis de los sistemas de medición', /I-AC-009/],
];

const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const ms = (n) => (n < 10 ? n.toFixed(1) : String(Math.round(n))).replace('.', ',');
const mm = (a) => `${ms(mediana(a))} (${ms(Math.min(...a))})`;

/** Corre un programa `veces` veces (mas una de calentamiento) y devuelve todos los tiempos en ms. */
function cronometrar(cmd, args, veces, opciones = {}) {
    const tiempos = [];
    let ultimo = null;
    for (let i = 0; i < veces + 1; i++) {
        const t0 = performance.now();
        ultimo = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opciones });
        const t = performance.now() - t0;
        if (i > 0) tiempos.push(t);
    }
    return { tiempos, salida: ultimo.stdout || '', codigo: ultimo.status };
}

function buscarRg(opcion) {
    const dado = opcion || process.env.RG;
    if (dado) return { cmd: dado, env: process.env, nombre: path.basename(dado) };
    const prueba = spawnSync('rg', ['--version'], { encoding: 'utf8' });
    if (!prueba.error) return { cmd: 'rg', env: process.env, nombre: 'rg' };
    const claude = process.env.CLAUDE_CODE_EXECPATH || path.join(os.homedir(), '.local', 'bin', 'claude.exe');
    if (fs.existsSync(claude)) return { cmd: claude, env: { ...process.env, ARGV0: 'rg' }, nombre: 'rg (el de Claude Code)' };
    throw new ErrorUso('No encuentro rg. Pasá --rg <ruta de rg.exe>.');
}

async function main() {
    const { pos, opts } = leerArgs(process.argv.slice(2), { valor: ['--rg', '--veces'], bandera: ['--help', '-h'] });
    if (opts['--help'] || opts['-h']) { console.log('Uso: node medir.mjs <carpeta conocimiento> [--rg <rg.exe>] [--veces 9]'); return 0; }
    if (pos.length !== 1) throw new ErrorUso('Hay que indicar la carpeta del conocimiento.');
    const raiz = path.resolve(pos[0]);
    const veces = Number(opts['--veces'] || 9);
    const rg = buscarRg(opts['--rg']);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'medir-buscar-'));
    const node = process.execPath;
    const buscarJs = path.join(AQUI, 'buscar.mjs');

    // 1. armar el indice (3 veces)
    const tIndice = [];
    let textoIndexar = '';
    for (let i = 0; i < 3; i++) {
        const t0 = performance.now();
        const r = spawnSync(node, [path.join(AQUI, 'indexar.mjs'), raiz, tmp], { encoding: 'utf8' });
        tIndice.push(performance.now() - t0);
        textoIndexar = r.stdout + r.stderr;
        if (r.status !== 0) throw new ErrorUso(`indexar.mjs falló: ${textoIndexar}`);
    }
    const db = path.join(tmp, 'indice.db');
    const bytesIndice = fs.statSync(db).size;
    const resumen = /Listo: (\d+) archivos, (\d+) secciones, ([\d,]+) MB/.exec(textoIndexar);

    // 2. lo que cuesta solo arrancar
    const vacio = cronometrar(node, ['-e', '0'], veces).tiempos;
    const rgVacio = cronometrar(rg.cmd, ['--version'], veces, { env: rg.env }).tiempos;

    // 3. la busqueda en si, dentro de un Node que ya arranco y con el indice abierto
    const { DatabaseSync } = await cargarSqlite();
    const conn = abrirIndice(DatabaseSync, db);
    const dentro = CONSULTAS.map(([q]) => {
        buscarPasajes(conn, q, { max: 5 });
        const t = [];
        for (let i = 0; i < 30; i++) {
            const t0 = performance.now();
            buscarPasajes(conn, q, { max: 5 });
            t.push(performance.now() - t0);
        }
        return mediana(t);
    });
    conn.close();

    // 4. las 10 consultas, de punta a punta
    const filas = [];
    for (const [sinTildes, conTildes, esperado] of CONSULTAS) {
        const b = cronometrar(node, [buscarJs, sinTildes, '--indice', db, '--max', '5'], veces);
        const archivosDe = (q) => JSON.parse(spawnSync(node, [buscarJs, q, '--indice', db, '--max', '5', '--json'], { encoding: 'utf8' }).stdout).resultados.map((r) => r.archivo);
        const aSin = archivosDe(sinTildes);
        const aCon = archivosDe(conTildes);
        const correrRg = (frase) => {
            const r = cronometrar(rg.cmd, ['-i', '-n', '-F', '--no-heading', '--glob', '*.md', '--glob', '*.txt', frase, raiz], veces, { env: rg.env });
            const archivos = [...new Set(r.salida.split(/\r?\n/).filter(Boolean).map((l) => l.replace(/:\d+:.*$/, '')))];
            return { tiempos: r.tiempos, archivos };
        };
        const rSin = correrRg(sinTildes);
        const rCon = correrRg(conTildes);
        filas.push({
            consulta: sinTildes,
            tBuscar: b.tiempos,
            tRg: rSin.tiempos,
            buscarSin: aSin.some((a) => esperado.test(a)),
            buscarCon: aCon.some((a) => esperado.test(a)),
            buscarMismo: JSON.stringify(aSin) === JSON.stringify(aCon),
            puesto: aSin.findIndex((a) => esperado.test(a)) + 1,
            rgSin: rSin.archivos.some((a) => esperado.test(a)),
            rgCon: rCon.archivos.some((a) => esperado.test(a)),
            rgArchivosSin: rSin.archivos.length,
            rgArchivosCon: rCon.archivos.length,
        });
    }

    const cuenta = (k) => filas.filter((f) => f[k]).length;
    const L = [];
    L.push(`Conocimiento: ${raiz}`);
    L.push(`Indexar (3 corridas): ${mm(tIndice)} ms · ${resumen ? `${resumen[1]} archivos, ${resumen[2]} secciones, ${resumen[3]} MB de texto` : ''} · índice ${(bytesIndice / 1048576).toFixed(1).replace('.', ',')} MB (${db})`);
    L.push(`Solo arrancar, sin buscar nada: node ${mm(vacio)} ms · ${rg.nombre} ${mm(rgVacio)} ms (mediana y, entre paréntesis, mínimo de ${veces} corridas).`);
    L.push(`La búsqueda dentro de Node ya arrancado: ${ms(mediana(dentro))} ms por consulta (mediana de ${CONSULTAS.length} consultas x 30; la más lenta ${ms(Math.max(...dentro))} ms).`);
    L.push('');
    L.push('| consulta (sin tildes) | buscar ms | rg ms | buscar acierta (puesto) | rg acierta sin tildes | rg acierta con tildes | archivos que ve rg (sin / con) |');
    L.push('|---|---|---|---|---|---|---|');
    for (const f of filas) {
        L.push(`| ${f.consulta} | ${mm(f.tBuscar)} | ${mm(f.tRg)} | ${f.buscarSin ? `sí (${f.puesto})` : 'no'} | ${f.rgSin ? 'sí' : 'no'} | ${f.rgCon ? 'sí' : 'no'} | ${f.rgArchivosSin} / ${f.rgArchivosCon} |`);
    }
    L.push('');
    L.push(`Encuentran el documento escribiendo SIN tildes: buscar ${cuenta('buscarSin')}/${filas.length} · rg ${cuenta('rgSin')}/${filas.length}.`);
    L.push(`Escribiendo CON tildes: buscar ${cuenta('buscarCon')}/${filas.length} · rg ${cuenta('rgCon')}/${filas.length}. Buscar da los mismos pasajes con y sin tildes en ${filas.filter((f) => f.buscarMismo).length}/${filas.length}.`);
    L.push(`Una consulta de punta a punta (mediana de las 10): buscar ${mm(filas.flatMap((f) => f.tBuscar))} ms · rg ${mm(filas.flatMap((f) => f.tRg))} ms.`);
    console.log(L.join('\n'));
    return 0;
}

main().then((c) => { process.exitCode = c; }, (e) => {
    console.error(`Error: ${e instanceof ErrorUso ? e.message : e && e.stack ? e.stack : e}`);
    process.exitCode = 1;
});
