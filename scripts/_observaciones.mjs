/**
 * _observaciones.mjs — el libro de observaciones recibidas (lo que le marcaron a un documento de Fak) y el chequeo de
 * antes de mandar. Logica, formato y por que: `scripts/_lib/observaciones.mjs`. Tanda 13, item 5.
 *
 * Uso:
 *   node scripts/_observaciones.mjs                                 resumen por tipo de documento
 *   node scripts/_observaciones.mjs --antes-de-mandar AMFE          lo que ya le marcaron a ese tipo, primero lo de a mano
 *   node scripts/_observaciones.mjs --anotar --de "Carlos Baptista" --documento AMFE --que "<lo que marco>" \
 *        --clase <etiqueta> [--chequeo "<que mirar antes de mandar>"] [--pieza "<pieza>"] [--fecha AAAA-MM-DD] [--fuente "<mail o archivo>"]
 *   node scripts/_observaciones.mjs --cerrar <id> --como "<que se hizo>" [--chequeo "..."] [--gate "<control que la caza>"]
 *
 * Los datos viven en la memoria `project_observaciones_recibidas.md` (el repo es publico). BARACK_OBSERVACIONES apunta a
 * otro archivo (lo usa el test); BARACK_HOY fija la fecha. No manda nada a nadie.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { leerBloque, escribirBloque, aIso } from './_lib/seguimientos.mjs';
import { CLAVE, resumen, anotar, cerrar, textoAntesDeMandar } from './_lib/observaciones.mjs';

const ARCHIVO = process.env.BARACK_OBSERVACIONES
  || join(homedir(), '.claude', 'projects', 'C--Dev-BarackMercosul', 'memory', 'project_observaciones_recibidas.md');
const HOY = process.env.BARACK_HOY || aIso(new Date());

const CON_VALOR = ['--antes-de-mandar', '--de', '--documento', '--que', '--clase', '--chequeo', '--pieza', '--fecha', '--fuente', '--cerrar', '--como', '--gate'];
const SIN_VALOR = ['--anotar'];
const args = process.argv.slice(2);
const op = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (SIN_VALOR.includes(a)) { op[a] = true; continue; }
  if (CON_VALOR.includes(a)) {
    const v = args[i + 1];
    if (v === undefined || v.startsWith('--')) { console.error(`a ${a} le falta su valor. No hago nada.`); process.exit(2); }
    op[a] = v; i++; continue;
  }
  console.error(`argumento que no conozco: ${a}. No hago nada.`); process.exit(2);
}
const modos = ['--antes-de-mandar', '--anotar', '--cerrar'].filter((m) => op[m]);
if (modos.length > 1) { console.error(`${modos.join(' y ')} no van juntos. No hago nada.`); process.exit(2); }
if (op['--anotar']) {
  for (const f of ['--de', '--documento', '--que', '--clase']) if (!op[f]) { console.error(`--anotar necesita ${f}. No hago nada.`); process.exit(2); }
}
if (op['--cerrar'] && !op['--como']) { console.error('--cerrar necesita --como (que se hizo para que no vuelva). No hago nada.'); process.exit(2); }

if (!existsSync(ARCHIVO)) {
  // Tres skills mandan correr esto antes de mandar un documento: en una PC sin la memoria (la notebook de Calidad antes
  // de bajarla) no tiene que fallar, tiene que decirlo y dejar seguir (revision de la madre, 17/10). Anotar o cerrar si
  // falla: escribirian en un libro que no esta.
  if (op['--anotar'] || op['--cerrar']) { console.error(`no existe el libro de observaciones: ${ARCHIVO}. No hago nada.`); process.exit(1); }
  console.log(`No esta el libro de observaciones en esta PC (${ARCHIVO}): no hay observaciones recibidas para mirar. Si la PC es nueva, bajar la memoria (node scripts/_nube.mjs --bajar --aplicar).`);
  process.exit(0);
}

try {
  const bloque = leerBloque(readFileSync(ARCHIVO, 'utf8'), CLAVE);
  const { datos } = bloque;
  if (op['--antes-de-mandar']) {
    console.log(textoAntesDeMandar(datos, op['--antes-de-mandar']));
  } else if (op['--anotar']) {
    const { obs, volvio } = anotar(datos, {
      de: op['--de'], documento: op['--documento'], que: op['--que'], clase: op['--clase'], chequeo: op['--chequeo'],
      pieza: op['--pieza'], fecha: op['--fecha'], fuente: op['--fuente'],
    }, { hoy: HOY });
    writeFileSync(ARCHIVO, escribirBloque(bloque));
    console.log(`anotada "${obs.id}" (${obs.documento}, clase ${obs.clase}).`);
    for (const v of volvio) console.log(`VOLVIO: la clase «${obs.clase}» ya se habia cerrado el ${v.cerrada.fecha} (${v.id}: ${v.cerrada.como}). El chequeo que se armo no alcanzo: revisarlo.`);
  } else if (op['--cerrar']) {
    const o = cerrar(datos, op['--cerrar'], { fecha: op['--fecha'] || HOY, como: op['--como'], chequeo: op['--chequeo'], gate: op['--gate'] });
    writeFileSync(ARCHIVO, escribirBloque(bloque));
    console.log(`cerrada "${o.id}": ${o.cerrada.como}`);
  } else {
    const r = resumen(datos);
    const tipos = Object.entries(r).sort((a, b) => b[1].total - a[1].total);
    console.log(`Observaciones recibidas: ${tipos.reduce((s, [, x]) => s + x.total, 0)} en ${tipos.length} tipo(s) de documento`);
    for (const [t, x] of tipos) {
      console.log(`  ${t.padEnd(18)} ${x.total} · las caza un control solo: ${x.auto} · a medias: ${x.parcial} · a mano: ${x.manual} · sin cerrar: ${x.abiertas}${x.rotas ? ` · MAL ESCRITAS: ${x.rotas}` : ''}`);
    }
    if (tipos.some(([, x]) => x.rotas)) process.exit(1);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
