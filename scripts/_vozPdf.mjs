/**
 * _vozPdf.mjs — rinde la carilla "Como escribis los mails" a PDF.
 *
 *   node scripts/_vozPdf.mjs            # docs/voz_de_fak.html -> docs/VOZ_DE_FAK.pdf
 *   node scripts/_vozPdf.mjs --png      # ademas deja el PNG al lado, para MIRARLO
 *
 * POR QUE EXISTE ESTE SCRIPT Y NO UN PDF SUELTO
 *   Un entregable que se genera una vez queda viejo el dia que el perfil se vuelve a medir
 *   (leccion del 08/09/2026: "lo ya entregado no queda entregado"). El HTML es la fuente y
 *   vive en el repo al lado del PDF: se edita, se vuelve a rendir, y el numero que cambio se
 *   ve en el diff.
 *
 * El juez de la carilla es COMO SE VE IMPRESA, no el HTML (`hojas-proceso.md`): por eso
 * `--png` emula `media: print` y rinde a 2x, y por eso el script canta el alto del contenido
 * — si pasa el alto util de una A4, dejo de ser una carilla y hay que recortar texto.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(fileURLToPath(import.meta.url), '../..');
const HTML = path.join(RAIZ, 'docs', 'voz_de_fak.html');
const PDF = path.join(RAIZ, 'docs', 'VOZ_DE_FAK.pdf');
const PNG = path.join(RAIZ, 'docs', 'voz_de_fak.png');

/** A4 a 96 dpi = 794x1123 px. */
const A4_ANCHO = 794;
const A4_ALTO = 1123;

/**
 * Cuantas hojas salieron. El juez es el PDF, no el alto del HTML: `scrollHeight` del
 * documento nunca baja del viewport, asi que medirlo ahi decia "1123 px" para una carilla
 * que entraba de sobra. Se cuentan los objetos `/Type /Page` del PDF (el `/Pages` del arbol
 * queda afuera por el `[^s]`).
 */
function hojas(pdf) {
    return (fs.readFileSync(pdf, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
}

export async function rendir({ png = false } = {}) {
    const { chromium } = await import('playwright');
    const nav = await chromium.launch();
    try {
        const pag = await nav.newPage({ viewport: { width: A4_ANCHO, height: A4_ALTO }, deviceScaleFactor: 2 });
        await pag.emulateMedia({ media: 'print' });
        await pag.goto(pathToFileURL(HTML).href, { waitUntil: 'load' });
        await pag.pdf({ path: PDF, format: 'A4', printBackground: true, preferCSSPageSize: true });
        if (png) await pag.screenshot({ path: PNG, fullPage: true });
        return { hojas: hojas(PDF), png };
    } finally {
        await nav.close();
    }
}

const esCli = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (esCli) {
    const r = await rendir({ png: process.argv.includes('--png') });
    console.log(`PDF: ${path.relative(RAIZ, PDF)}  ·  ${r.hojas} hoja(s)`);
    if (r.png) console.log(`PNG: ${path.relative(RAIZ, PNG)}  — mirarlo antes de entregar`);
    if (r.hojas !== 1) {
        console.log('ROJO: dejo de ser una carilla. Recortar texto, no achicar la letra.');
        process.exit(1);
    }
}
