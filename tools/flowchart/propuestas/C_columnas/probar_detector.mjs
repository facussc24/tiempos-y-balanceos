/**
 * probar_detector.mjs — el detector de textos encimados tiene que dar ROJO cuando hay un encimado y VERDE cuando
 * no (prueba en las dos direcciones). Usa la pagina ya generada por render.mjs (.build/<clave>.html).
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const clave = process.argv[2] || '153-ARMREST-DOOR-PANEL';
const nav = await chromium.launch();
const pg = await nav.newPage({ viewport: { width: 1700, height: 1200 } });
await pg.goto(pathToFileURL(join(AQUI, '.build', `${clave}.html`)).href);
await pg.waitForFunction('window.__FC_LISTO__ === true');
const limpio = await pg.evaluate(() => [...document.querySelectorAll('.fc-page')].map((p) => window.__overlapReport(p).length));
// 1) mover una descripcion encima de otra: tiene que saltar
const rojo1 = await pg.evaluate(() => {
  const d = [...document.querySelectorAll('[data-fc="desc"]')];
  d[1].style.position = 'relative';
  d[1].style.top = `${d[0].getBoundingClientRect().top - d[1].getBoundingClientRect().top + 3}px`;
  return window.__overlapReport(document.querySelector('.fc-page')).length;
});
// 2) mover un terminal encima de una figura: tiene que saltar
await pg.reload();
await pg.waitForFunction('window.__FC_LISTO__ === true');
const rojo2 = await pg.evaluate(() => {
  const t = document.querySelector('[data-fc="terminal"]');
  t.style.position = 'relative';
  t.style.left = '-130px';
  return window.__overlapReport(document.querySelector('.fc-page')).length;
});
console.log(`sin tocar: ${limpio.join(',')} encimados por hoja (esperado 0) | descripcion encima de otra: ${rojo1} (esperado >0) | terminal sobre figura: ${rojo2} (esperado >0)`);
await nav.close();
process.exit(limpio.every((n) => n === 0) && rojo1 > 0 && rojo2 > 0 ? 0 : 1);
