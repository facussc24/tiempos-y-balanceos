/**
 * _flujograma.mjs — genera un flujograma de proceso como PNG, desde el repo.
 *
 * POR QUE EXISTE
 * Hasta el 18/08/2026 los flujogramas los dibujaba Fak a mano en Claude Design y yo le
 * pasaba un prompt. Fak: *"vos sos el que hace los flujogramas ahora, te lo habia dicho ya"*,
 * *"no necesito prompts, vos mismo los corregis"*. Asi que el motor se trajo al repo.
 *
 * COMO FUNCIONA
 * El motor (`tools/flowchart/Flowchart.jsx`, extraido del generador de Claude Design) NO
 * calcula el layout: dibuja `<div>` con clases Tailwind y deja que **flexbox de Chromium**
 * resuelva anchos, alturas y convergencia de ramas. Por eso no hay `render(datos) -> imagen`
 * y hace falta un navegador de verdad:
 *
 *     esbuild bundlea el JSX  ->  HTML temporal  ->  Chromium headless (Playwright)
 *     ->  espera a que flexbox termine  ->  captura el nodo #pdf-content
 *
 * Los DATOS viven aparte, en `tools/flowchart/data/<clave>.json`. Esa separacion es la que
 * permite que el flujograma y el AMFE no diverjan: el mismo numero de operacion sale de un
 * solo lugar. Contrato de datos y trampas del motor: memoria `flujogramas_barack_numeracion`.
 *
 * ⚠️ Del generador sale el DIBUJO, no el CONTENIDO. Toda operacion tiene que venir de un
 * documento o de alguien que la afirme (regla `no-pfd-no-ho.md`). El 18/08 el generador
 * invento dos controles que nadie habia decidido.
 *
 * Uso:  node scripts/_flujograma.mjs --lista
 *       node scripts/_flujograma.mjs 151                 (render a tmp, para mirar)
 *       node scripts/_flujograma.mjs 151 --out <carpeta>
 *       node scripts/_flujograma.mjs --todos --out <carpeta>
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { spawnSync } from 'child_process';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const TOOLS = join(RAIZ, 'tools', 'flowchart');
const DATA = join(TOOLS, 'data');
const TMP = join(TOOLS, '.build');

// ─── argumentos ─────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const tiene = (n) => argv.includes(n);

const clavesDisponibles = () => existsSync(DATA)
    ? readdirSync(DATA).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')).sort()
    : [];

if (tiene('--lista') || argv.length === 0) {
    const l = clavesDisponibles();
    console.log(l.length ? `Flujogramas disponibles:\n  ${l.join('\n  ')}` : `No hay datos en ${DATA}`);
    console.log(`\nUso: node scripts/_flujograma.mjs <clave> [--out <carpeta>]`);
    process.exit(0);
}

const claves = tiene('--todos') ? clavesDisponibles() : argv.filter(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--out');
const salida = flag('--out') ? resolve(flag('--out')) : TMP;

if (!claves.length) { console.error('No indicaste que flujograma generar. Probá --lista.'); process.exit(1); }

// ─── 1. bundle del motor ────────────────────────────────────────────────────
mkdirSync(TMP, { recursive: true });
const BUNDLE = join(TMP, 'flowchart.bundle.js');

console.log('Compilando el motor...');
await build({
    entryPoints: [join(TOOLS, 'entry.jsx')],
    bundle: true, format: 'iife', jsx: 'automatic',
    outfile: BUNDLE, logLevel: 'error', minify: false,
});
const bundleJs = readFileSync(BUNDLE, 'utf8');

// Tailwind: el motor esta escrito con utilidades de Tailwind. Se usa el CSS cacheado en
// el repo para que la generacion no dependa de internet; si no esta, se avisa y se cae.
const CSS = join(TOOLS, 'tailwind.css');
if (!existsSync(CSS)) {
    console.error(`\nFalta ${CSS}.\nGeneralo una vez con:  node scripts/_flujograma.mjs --preparar-css\n`);
    process.exit(1);
}
const css = readFileSync(CSS, 'utf8');

// ─── 2. render de cada flujograma ───────────────────────────────────────────
mkdirSync(salida, { recursive: true });
const navegador = await chromium.launch();
let ok = 0;

try {
    for (const clave of claves) {
        const archivoDatos = join(DATA, `${clave}.json`);
        if (!existsSync(archivoDatos)) { console.error(`  ✗ ${clave}: no existe ${archivoDatos}`); continue; }
        const datos = JSON.parse(readFileSync(archivoDatos, 'utf8'));

        const html = `<!doctype html><html><head><meta charset="utf-8">
<style>${css}</style>
<style>body{margin:0;background:#F3F4F6}#root{width:max-content}</style>
</head><body><div id="root"></div>
<script>window.__FC__=${JSON.stringify(datos).replace(/</g, '\\u003c')};</script>
<script>${bundleJs}</script></body></html>`;

        const htmlPath = join(TMP, `${clave}.html`);
        writeFileSync(htmlPath, html, 'utf8');

        const pagina = await navegador.newPage({ viewport: { width: 2200, height: 1400 }, deviceScaleFactor: 2 });
        const errores = [];
        pagina.on('pageerror', e => errores.push(String(e)));
        await pagina.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });

        // El motor deja el layout en manos de flexbox: hay que esperar a que termine.
        await pagina.waitForFunction('window.__FC_LISTO__ === true', { timeout: 20000 });

        if (errores.length) throw new Error(`${clave}: el render tiro errores:\n  ${errores.join('\n  ')}`);

        const nodo = await pagina.$('#pdf-content');
        if (!nodo) throw new Error(`${clave}: no aparecio #pdf-content — el motor no monto.`);

        // El destino se BORRA antes de generar: si falla, tiene que faltar el archivo, no
        // sobrevivir el anterior (leccion 14/08).
        const destino = join(salida, `FLUJOGRAMA_${clave}.png`);
        if (existsSync(destino)) rmSync(destino);

        await nodo.screenshot({ path: destino });
        await pagina.close();

        const bytes = statSync(destino).size;
        if (bytes < 20000) throw new Error(`${clave}: el PNG pesa ${bytes} bytes — salio vacio.`);
        console.log(`  ✓ ${clave.padEnd(28)} ${(bytes / 1024).toFixed(0).padStart(5)} KB   ${destino}`);
        ok++;
    }
} finally {
    await navegador.close();
}

console.log(`\n${ok}/${claves.length} flujogramas generados en ${salida}`);

// Chequeo anti-corte, encadenado a proposito: es EL modo de falla de este motor —las ramas
// laterales van en absolute y no empujan el ancho— y falla en silencio, con el PNG entero y
// del peso normal. Si depende de que me acuerde de correrlo, algun dia no me acuerdo.
if (ok) {
    console.log('');
    const r = spawnSync('python', [join(AQUI, '_verificarFlujogramas.py'), salida], { stdio: 'inherit' });
    if (r.status !== 0) {
        console.error('\n🔴 Hay flujogramas CORTADOS: no se entregan asi.');
        process.exit(1);
    }
}

process.exit(ok === claves.length ? 0 : 1);
