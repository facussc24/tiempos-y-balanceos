/**
 * _catalogoServidor.mjs — pasa los listados de `robocopy /L` (UTF-16, solo nombres/tamaños/fechas)
 * a un catalogo .tsv en UTF-8 para contestar "¿donde esta X?" sin el servidor conectado.
 *
 *   node scripts/_catalogoServidor.mjs                      convierte todos los .log de .sgc-cache/catalogo-servidor
 *   node scripts/_catalogoServidor.mjs --buscar "texto"     busca en los .tsv (sin tildes ni mayusculas)
 *   node scripts/_catalogoServidor.mjs --resumen "<carpeta>" suma archivos y MB por subcarpeta de esa ruta
 *
 * El listado se arma aparte, por rama (no recorre nada: solo lee los .log ya hechos):
 *   robocopy "<carpeta>" C:\__no_existe__ /L /E [/LEV:n] /NJH /NJS /NC /BYTES /TS /FP /R:0 /W:0 /UNILOG:<archivo>.log
 * Columnas del .tsv: tipo (A archivo / C carpeta) · bytes · fecha (AAAA-MM-DD) · ruta completa.
 * La primera linea dice de que carpeta y de que dia es el listado: un catalogo sin fecha no se cita.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, '.sgc-cache', 'catalogo-servidor');
const RE_ARCHIVO = /^\s*(\d+)\s+(\d{4})\/(\d{2})\/(\d{2}) \d{2}:\d{2}:\d{2}\s+(.+)$/;
const RE_CARPETA = /^\s*(\d+)\s+(.+\\)$/;
const plano = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function convertir(log) {
    const texto = fs.readFileSync(log, 'utf16le').replace(/^\uFEFF/, '');
    const filas = [];
    let raiz = '';
    let archivos = 0;
    for (const linea of texto.split(/\r?\n/)) {
        let m = RE_ARCHIVO.exec(linea);
        if (m) { filas.push(`A\t${m[1]}\t${m[2]}-${m[3]}-${m[4]}\t${m[5].trim()}`); archivos++; continue; }
        m = RE_CARPETA.exec(linea);
        if (m) { if (!raiz) raiz = m[2].trim(); filas.push(`C\t${m[1]}\t\t${m[2].trim()}`); }
    }
    const dia = /(\d{4})(\d{2})(\d{2})\.log$/.exec(log);
    const cabecera = `# listado de ${raiz} · relevado el ${dia ? `${dia[3]}/${dia[2]}/${dia[1]}` : 'fecha desconocida'} · ${archivos} archivos · solo nombres, tamaños y fechas`;
    const tsv = log.replace(/\.log$/, '.tsv');
    fs.writeFileSync(tsv, `${cabecera}\n${filas.join('\n')}\n`, 'utf8');
    return { tsv, raiz, archivos, carpetas: filas.length - archivos };
}

function* lineas(tsv) {
    for (const l of fs.readFileSync(tsv, 'utf8').split('\n')) if (l && !l.startsWith('#')) yield l.split('\t');
}
const catalogos = () => fs.readdirSync(DIR).filter((f) => f.endsWith('.tsv')).map((f) => path.join(DIR, f));

function buscar(texto) {
    const palabras = plano(texto).split(/\s+/).filter(Boolean);
    let n = 0;
    for (const tsv of catalogos()) {
        console.log(fs.readFileSync(tsv, 'utf8').split('\n', 1)[0]);
        for (const [tipo, bytes, fecha, ruta] of lineas(tsv)) {
            const p = plano(ruta);
            if (!palabras.every((w) => p.includes(w))) continue;
            console.log(`  ${tipo === 'C' ? '[carpeta]' : fecha}  ${ruta}`);
            if (++n >= 200) { console.log('  … (corto en 200; afiná la búsqueda)'); return; }
        }
    }
    if (!n) console.log('  sin coincidencias en los catálogos (no prueba que no exista: mirá la fecha y el alcance de cada listado)');
}

function resumen(carpeta) {
    const base = plano(carpeta).replace(/\\+$/, '') + '\\';
    const suma = new Map();
    for (const tsv of catalogos()) {
        for (const [tipo, bytes, , ruta] of lineas(tsv)) {
            if (tipo !== 'A') continue;
            const p = plano(ruta);
            if (!p.startsWith(base)) continue;
            const resto = ruta.slice(base.length).split('\\');
            const hijo = resto.length > 1 ? resto[0] : '(sueltos)';
            const s = suma.get(hijo) ?? { n: 0, b: 0 };
            s.n++; s.b += Number(bytes); suma.set(hijo, s);
        }
    }
    for (const [hijo, s] of [...suma].sort((a, b) => b[1].b - a[1].b)) console.log(`${String(s.n).padStart(7)} arch  ${(s.b / 1048576).toFixed(1).padStart(9)} MB  ${hijo}`);
}

const args = process.argv.slice(2);
if (args[0] === '--buscar') buscar(args.slice(1).join(' '));
else if (args[0] === '--resumen') resumen(args.slice(1).join(' '));
else {
    for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.log'))) {
        const r = convertir(path.join(DIR, f));
        console.log(`${path.basename(r.tsv)}: ${r.archivos} archivos, ${r.carpetas} carpetas (${r.raiz})`);
    }
}
