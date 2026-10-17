/**
 * _parametrosMaquina.mjs — los parametros de cada maquina en el tiempo, leidos de su ficha (memoria `reference_maquina_*`
 * u otra con un bloque ```json "parametros"), con la marca de cuando cambiaron. Logica y formato:
 * `scripts/_lib/parametrosMaquina.mjs`. Tanda 13, item 9 (la hot melt paso de 195 a 185 °C el 26/08/2026).
 *
 * Uso:
 *   node scripts/_parametrosMaquina.mjs                       todas las fichas con parametros: cambios e historia
 *   node scripts/_parametrosMaquina.mjs --maquina hotmelt     solo las fichas cuyo nombre de archivo lo contiene
 *   node scripts/_parametrosMaquina.mjs --anotar hotmelt --campo "consigna de los rodillos" --valor 185 \
 *        --fecha 2026-08-26 --fuente "video IMG_0394" [--unidad "°C"]
 *       anota una lectura en la ficha y dice si CAMBIO contra la anterior. La fecha es la del VIDEO o la foto, no la del
 *       panel. --anotar tiene que dar con UNA sola ficha.
 *
 * BARACK_MEMORIA_DIR apunta a otra carpeta de memorias (lo usa el test). No manda nada a nadie.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CLAVE, leerBloque, escribirBloque, informe, anotarLectura, lineaCambio } from './_lib/parametrosMaquina.mjs';

const DIR = process.env.BARACK_MEMORIA_DIR || join(homedir(), '.claude', 'projects', 'C--Dev-BarackMercosul', 'memory');

const CON_VALOR = ['--maquina', '--anotar', '--campo', '--valor', '--fecha', '--fuente', '--unidad'];
const args = process.argv.slice(2);
const op = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (CON_VALOR.includes(a)) {
    const v = args[i + 1];
    if (v === undefined || v.startsWith('--')) { console.error(`a ${a} le falta su valor. No hago nada.`); process.exit(2); }
    op[a] = v; i++; continue;
  }
  console.error(`argumento que no conozco: ${a}. No hago nada.`); process.exit(2);
}
if (op['--anotar'] && op['--maquina']) { console.error('--anotar y --maquina no van juntos. No hago nada.'); process.exit(2); }
if (op['--anotar']) {
  for (const f of ['--campo', '--valor', '--fecha', '--fuente']) {
    if (!op[f]) { console.error(`--anotar necesita ${f}. No hago nada.`); process.exit(2); }
  }
} else if (op['--campo'] || op['--valor'] || op['--fecha'] || op['--fuente'] || op['--unidad']) {
  console.error('--campo, --valor, --fecha, --fuente y --unidad van solo con --anotar. No hago nada.'); process.exit(2);
}

if (!existsSync(DIR)) { console.error(`no existe la carpeta de memorias ${DIR}`); process.exit(1); }

/** Las fichas que tienen un bloque "parametros" (y las que lo tienen roto: eso se dice). */
function fichas(filtro) {
  const f = (filtro || '').toLowerCase();
  const out = [];
  for (const nombre of readdirSync(DIR).filter((n) => n.endsWith('.md')).sort()) {
    if (f && !nombre.toLowerCase().includes(f)) continue;
    const ruta = join(DIR, nombre);
    const md = readFileSync(ruta, 'utf8');
    if (!md.includes(`"${CLAVE}"`)) continue;
    try { out.push({ nombre, ruta, bloque: leerBloque(md, CLAVE) }); } catch (e) { out.push({ nombre, ruta, error: e.message }); }
  }
  return out;
}

try {
  if (op['--anotar']) {
    const encontradas = fichas(op['--anotar']);
    if (encontradas.length !== 1) {
      console.error(`--anotar "${op['--anotar']}" tiene que dar con UNA ficha con parametros y dio ${encontradas.length}: ${encontradas.map((x) => x.nombre).join(', ') || 'ninguna'}. No hago nada.`);
      process.exit(1);
    }
    const [fi] = encontradas;
    if (fi.error) { console.error(`la ficha ${fi.nombre} esta mal escrita: ${fi.error}. No hago nada.`); process.exit(1); }
    const { parametro, lectura } = anotarLectura(fi.bloque.datos, op['--campo'], {
      fecha: op['--fecha'], valor: op['--valor'], fuente: op['--fuente'], unidad: op['--unidad'],
    });
    writeFileSync(fi.ruta, escribirBloque(fi.bloque));
    console.log(lectura.cambio ? lineaCambio(parametro, lectura) : `anotado en «${parametro.campo}» (${fi.nombre}): sin cambio contra la lectura anterior.`);
  } else {
    const lista = fichas(op['--maquina']);
    if (!lista.length) { console.log(`ninguna ficha con un bloque "${CLAVE}"${op['--maquina'] ? ` que contenga "${op['--maquina']}"` : ''} en ${DIR}`); process.exit(0); }
    let rotas = 0;
    for (const fi of lista) {
      if (fi.error) { rotas++; console.log(`== ${fi.nombre}: ESTA MAL ESCRITA (${fi.error})`); continue; }
      const t = informe(fi.nombre.replace(/\.md$/, ''), fi.bloque.datos);
      if (/ESTA MAL ESCRITO/.test(t)) rotas++;
      console.log(`${t}\n`);
    }
    if (rotas) process.exit(1);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
