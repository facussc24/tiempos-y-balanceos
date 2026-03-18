#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = 'C:/Users/FacundoS-PC/Documents/AMFES PC HO/PLANES DE CONTROL ACTUALES REFERENCIA UNICAMENTE';
const outDir = join(__dirname, 'pdf-extracts');
mkdirSync(outDir, { recursive: true });

const files = [
    'PATAGONIA_FRONT_HEADREST_L0_PdC preliminar.pdf',
    'PATAGONIA_FRONT_HEADREST_L1-L2-L3_PdC preliminar.pdf',
    'PATAGONIA_REAR CENT_HEADREST_L0_PdC preliminar.pdf',
    'PATAGONIA_REAR CEN_HEADREST_L1-L2-L3_PdC preliminar.pdf',
    'PATAGONIA_REAR OUT_HEADREST_L0_PdC preliminar.pdf',
    'PATAGONIA_REAR OUT_HEADREST_L1-L2-L3_PdC preliminar.pdf',
];

for (const f of files) {
    try {
        const buf = new Uint8Array(readFileSync(join(base, f)));
        const doc = await getDocument({ data: buf, useSystemFonts: true }).promise;
        let text = '';
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            text += `--- PAGE ${i} ---\n` + content.items.map(item => item.str).join(' ') + '\n\n';
        }
        const outName = f.replace('.pdf', '.txt');
        writeFileSync(join(outDir, outName), text);
        console.log(`OK: ${f} -> ${doc.numPages} pages, ${text.length} chars`);
    } catch(e) {
        console.error('ERROR:', f, e.message);
    }
}
console.log('Done!');
