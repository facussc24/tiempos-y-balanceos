/**
 * _seguimientos.mjs — SEGUIMIENTOS CON FECHA: lo que hay que volver a pedir hasta que contesten.
 *
 * Pedido de Fak, 02/10/2026 (reunion de AMFE con Calidad): "no me puedo olvidar de esto... el
 * lunes y el viernes de cada semana debemos insistir... a la tercera vez que no me respondan
 * pongo al director en copia". Lo corre el hook de arranque de cada sesion (`session-start-context.sh`)
 * y la tarea programada de los lunes y viernes.
 *
 * Los datos viven en la memoria `project_seguimientos_con_fecha.md` (bloque ```json), no en el
 * repo, que es publico. Este script no manda mails: dice que toca y lleva la cuenta.
 *
 * Uso:
 *   node scripts/_seguimientos.mjs                      lista lo abierto y que toca hoy
 *   node scripts/_seguimientos.mjs --hook               texto corto para el arranque (vacio si no hay nada)
 *   node scripts/_seguimientos.mjs --anotar <id> --que "<que se hizo>" [--enviado] [--fecha AAAA-MM-DD]
 *   node scripts/_seguimientos.mjs --cerrar <id> --motivo "<por que>" [--fecha AAAA-MM-DD]
 *
 * `--enviado` va SOLO cuando el mail esta en Elementos enviados: un borrador no cuenta como pedido.
 * BARACK_SEGUIMIENTOS apunta a otro archivo (lo usa el test); BARACK_HOY fija la fecha.
 *
 * En modo --hook NUNCA sale con error ni se calla ante datos rotos: lo que no se puede leer se
 * dice por la salida normal, que es la que llega al arranque (el hook descarta la de error).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { abiertos, estadoDe, textoHook, leerBloque, escribirBloque, anotar, cerrar, aIso, aFecha, nombreDia } from './_lib/seguimientos.mjs';

const ARCHIVO = process.env.BARACK_SEGUIMIENTOS
  || join(homedir(), '.claude', 'projects', 'C--Dev-BarackMercosul', 'memory', 'project_seguimientos_con_fecha.md');
const HOY = process.env.BARACK_HOY || aIso(new Date());

// Argumentos: lo que no se conoce, lo que sobra y un valor que falta frenan ANTES de tocar nada.
const CON_VALOR = ['--anotar', '--cerrar', '--que', '--motivo', '--fecha'];
const SIN_VALOR = ['--hook', '--enviado'];
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
if (op['--anotar'] && op['--cerrar']) { console.error('--anotar y --cerrar no van juntos. No hago nada.'); process.exit(2); }
const HOOK = !!op['--hook'];

/** En el arranque un problema se DICE (por la salida normal) y no frena; fuera de el, sale con error. */
function fallar(mensaje) {
  if (HOOK) {
    console.log(`[SEGUIMIENTOS CON FECHA] NO SE PUDO LEER la memoria project_seguimientos_con_fecha: ${mensaje}. Arreglarla AHORA y decirselo a Fak: mientras tanto nadie avisa que toca insistir.`);
    process.exit(0);
  }
  console.error(mensaje);
  process.exit(1);
}

if (!existsSync(ARCHIVO)) {
  // En el arranque de una PC que todavia no bajo la memoria no hay nada que avisar.
  if (HOOK) process.exit(0);
  fallar(`no existe ${ARCHIVO}`);
}

let bloque;
try {
  aFecha(HOY);
  bloque = leerBloque(readFileSync(ARCHIVO, 'utf8'));
  abiertos(bloque.datos);
} catch (e) {
  fallar(e.message);
}
const { datos } = bloque;

try {
  if (HOOK) {
    const t = textoHook(datos, HOY);
    if (t) console.log(t);
  } else if (op['--anotar']) {
    const fecha = op['--fecha'] || HOY;
    const s = anotar(datos, op['--anotar'], { fecha, que: op['--que'], enviado: !!op['--enviado'], hoy: HOY });
    const e = estadoDe(s, HOY);
    writeFileSync(ARCHIVO, escribirBloque(bloque));
    console.log(`anotado en "${s.id}" (${op['--enviado'] ? 'ENVIADO' : 'sin enviar'}): ${e.enviados} pedido(s) enviados. Proxima insistencia: ${nombreDia(e.proxima)} ${e.proxima}${e.escala ? `, con ${e.cc.join(' y ') || 'la copia de escalamiento'} en copia` : ''}.`);
  } else if (op['--cerrar']) {
    const s = cerrar(datos, op['--cerrar'], { fecha: op['--fecha'] || HOY, motivo: op['--motivo'] });
    writeFileSync(ARCHIVO, escribirBloque(bloque));
    console.log(`cerrado "${s.id}": ${s.cerrado.motivo}`);
  } else {
    const segs = abiertos(datos);
    let rotos = 0;
    console.log(`Seguimientos abiertos al ${nombreDia(HOY)} ${HOY}: ${segs.length}`);
    for (const s of segs) {
      console.log(`\n${s.id} — ${s.que}`);
      let e;
      try { e = estadoDe(s, HOY); } catch (err) { rotos++; console.log(`  >> ESTA MAL ESCRITO: ${err.message}`); continue; }
      console.log(`  abierto el ${s.abierto} · se insiste: ${(s.dias || []).join(' y ')} · pedidos enviados: ${e.enviados}`);
      for (const i of s.intentos || []) console.log(`    ${i.fecha}  ${i.enviado ? 'ENVIADO   ' : 'sin enviar'}  ${i.que}`);
      if (e.sinEnviar) console.log('  >> EL PRIMER PEDIDO TODAVIA NO SALIO.');
      if (e.borradorPendiente && !e.sinEnviar) console.log(`  >> hay un borrador del ${e.borradorPendiente} SIN ENVIAR.`);
      console.log(e.tocaHoy
        ? `  >> HOY TOCA${e.atrasado ? ' (atrasado)' : ''}: pedido numero ${e.proximoNumero}${e.escala ? `, CON ${e.cc.join(' y ') || 'la copia de escalamiento'} EN COPIA` : ''}.`
        : `  proxima insistencia: ${nombreDia(e.proxima)} ${e.proxima}${e.escala ? ` (ya con ${e.cc.join(' y ') || 'la copia de escalamiento'} en copia)` : ''}`);
      if (s.mail) console.log(`  mail: "${s.mail.asunto}" · para ${[].concat(s.mail.para).join(', ')} · cc ${[].concat(s.mail.cc || []).join(', ')}`);
      if (s.se_cierra_cuando) console.log(`  se cierra cuando: ${s.se_cierra_cuando}`);
    }
    if (rotos) process.exit(1);
  }
} catch (e) {
  fallar(e.message);
}
