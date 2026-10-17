/**
 * captura.mjs — saca una captura de página entera de un HTML local con Playwright, sin abrir ninguna ventana.
 * Sirve para mostrar las maquetas y la página del programita sin tocar la pantalla de Fak (tanda 6, 17/10/2026).
 * Uso: node tools/vista_chat/captura.mjs <archivo.html> <salida.png> [ancho]
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const [html, png, ancho] = process.argv.slice(2);
if (!html || !png) { console.log('uso: node tools/vista_chat/captura.mjs <archivo.html> <salida.png> [ancho]'); process.exit(2); }
const nav = await chromium.launch();
try {
  const pag = await nav.newPage({ viewport: { width: Number(ancho) || 1280, height: 900 } });
  await pag.goto(pathToFileURL(path.resolve(html)).href, { waitUntil: 'load' });
  await pag.screenshot({ path: path.resolve(png), fullPage: true });
  console.log(`captura: ${path.resolve(png)}`);
} finally { await nav.close(); }
