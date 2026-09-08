import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

import { fileURLToPath } from 'node:url';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const LOGO = path.resolve(DIR, '../../.sgc-cache/indicativos-uso-material/evidencia/firma_logo_barack_del_mail.png');

const logoB64 = 'data:image/png;base64,' + fs.readFileSync(LOGO).toString('base64');
const html = fs.readFileSync(path.join(DIR, 'devoluciones.html'), 'utf8').replace('__LOGO__', logoB64);

const tmpHtml = path.join(DIR, '_render.html');
fs.writeFileSync(tmpHtml, html, 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file:///' + tmpHtml.replace(/\\/g, '/'), { waitUntil: 'networkidle' });

const out = path.join(DIR, 'FORMULARIO_ACEPTACION_DEVOLUCIONES_BARACK.pdf');
await page.pdf({ path: out, format: 'A4', printBackground: true });

// PNG de control para mirarlo sin abrir el PDF
await page.setViewportSize({ width: 794, height: 1123 });
await page.screenshot({ path: path.join(DIR, 'control.png'), fullPage: true });

await browser.close();
console.log('PDF:', out, fs.statSync(out).size, 'bytes');
