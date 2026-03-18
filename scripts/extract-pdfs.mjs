#!/usr/bin/env node
/**
 * Extract text from all AMFE/PFD/CP PDFs into .txt files for seed scripts.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = 'C:/Users/FacundoS-PC/Documents/AMFES PC HO';
const outDir = join(__dirname, 'pdf-extracts');
mkdirSync(outDir, { recursive: true });

async function extractPdf(filePath) {
    const data = new Uint8Array(readFileSync(filePath));
    const doc = await getDocument({ data, useSystemFonts: true }).promise;
    let text = '';
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        text += `\n--- PAGE ${i} ---\n${pageText}\n`;
    }
    return { text, numPages: doc.numPages };
}

const files = [
    'VWA/TOP ROLL/AMFE_TOP ROLL_Rev.pdf',
    'VWA/TOP ROLL/122 FLUJOGRAMA TOP ROLL PAT 2.pdf',
    'VWA/ARMREST DOOR PANEL/AMFE_ARMREST_Rev.pdf',
    'VWA/ARMREST DOOR PANEL/FLUJOGRAMA_153_ARMREST_REV.pdf',
    'PLANES DE CONTROL ACTUALES REFERENCIA UNICAMENTE/PC_TOP ROLL.pdf',
    'PLANES DE CONTROL ACTUALES REFERENCIA UNICAMENTE/PdC Insertos.pdf',
    'PWA/TELAS PWA PLANAS/flujograma actual/FLUJOGRAMA_150_TELAS_581D_REV.pdf',
    'PWA/TELAS PWA TERMOFORMADAS/FLUJOGRAMA ACTUAL/FLUJOGRAMA_156_ASIENTO_RESPALDO_REV.pdf',
];

for (const f of files) {
    const full = join(base, f);
    if (!existsSync(full)) { console.log('MISSING:', f); continue; }
    try {
        const { text, numPages } = await extractPdf(full);
        const outName = f.replace(/[\\/]/g, '_').replace('.pdf', '.txt');
        writeFileSync(join(outDir, outName), text);
        console.log(`OK: ${f} -> ${numPages} pages, ${text.length} chars`);
    } catch(e) {
        console.error('ERROR:', f, e.message);
    }
}

// Copy existing .txt files
const txtFiles = [
    ['PWA/TELAS PWA PLANAS/amfe viejo referencia/AMFE_TELAS_PLANAS.txt', 'AMFE_TELAS_PLANAS.txt'],
    ['PWA/TELAS PWA TERMOFORMADAS/AMFE REFERENCIA/AMFE_TERMOFORMADAS.txt', 'AMFE_TERMOFORMADAS.txt'],
    ['VWA/INSERT/AMFE_INSERT_Rev.txt', 'AMFE_INSERT_Rev.txt'],
];
for (const [src, dest] of txtFiles) {
    const full = join(base, src);
    if (existsSync(full)) {
        copyFileSync(full, join(outDir, dest));
        console.log(`COPIED: ${src}`);
    }
}

console.log('\nDone! Extracts in:', outDir);
