// cfg_de_log.mjs <clave> [--guardar] — recupera la configuracion elegida de .build/logs/buscar_<clave>.log
// (linea "MEJOR ... cfg=" o, si la busqueda se corto, repitiendo en orden los cambios aceptados "  k=v ->").
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const AQUI = dirname(fileURLToPath(import.meta.url));
const clave = process.argv[2];
const log = readFileSync(join(AQUI, '.build', 'logs', `buscar_${clave}.log`), 'utf8').split(/\r?\n/);
const CFGS = join(AQUI, 'cfgs.json');
const cfgs = existsSync(CFGS) ? JSON.parse(readFileSync(CFGS, 'utf8')) : {};
let cfg = null;
const mejor = log.find((l) => l.includes(' MEJOR:'));
if (mejor) cfg = JSON.parse(mejor.slice(mejor.indexOf('cfg=') + 4));
else {
  cfg = { F: 10, ...(cfgs[clave] || {}) };
  for (const l of log) {
    const m = l.match(/^\s+(\w+)=([\d.]+)( \(reparto del aire\))? ->/);
    if (m) cfg[m[1]] = Number(m[2]);
  }
}
console.log(clave, JSON.stringify(cfg), mejor ? '(de la linea MEJOR)' : '(reconstruida de los cambios aceptados)');
if (process.argv.includes('--guardar')) {
  cfgs[clave] = cfg;
  writeFileSync(CFGS, JSON.stringify(cfgs, null, 1));
  console.log('guardada en cfgs.json');
}
