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
 *   node scripts/_seguimientos.mjs --cerrar <id> --motivo "<por que>"
 *
 * `--enviado` va SOLO cuando el mail esta en Elementos enviados: un borrador no cuenta como pedido.
 * BARACK_SEGUIMIENTOS apunta a otro archivo (lo usa el test); BARACK_HOY fija la fecha.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { abiertos, estadoDe, textoHook, leerBloque, escribirBloque, anotar, cerrar, aIso, nombreDia } from './_lib/seguimientos.mjs';

const ARCHIVO = process.env.BARACK_SEGUIMIENTOS
  || join(homedir(), '.claude', 'projects', 'C--Dev-BarackMercosul', 'memory', 'project_seguimientos_con_fecha.md');
const HOY = process.env.BARACK_HOY || aIso(new Date());
const args = process.argv.slice(2);
const tiene = (f) => args.includes(f);
const valor = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };

const CONOCIDOS = ['--hook', '--anotar', '--cerrar', '--que', '--motivo', '--enviado', '--fecha'];
const desconocido = args.find((a) => a.startsWith('--') && !CONOCIDOS.includes(a));
if (desconocido) { console.error(`argumento que no conozco: ${desconocido}. No hago nada.`); process.exit(2); }

if (!existsSync(ARCHIVO)) {
  // En el arranque no se rompe nada si esta PC todavia no bajo la memoria.
  if (tiene('--hook')) process.exit(0);
  console.error(`no existe ${ARCHIVO}`); process.exit(1);
}

let bloque;
try {
  bloque = leerBloque(readFileSync(ARCHIVO, 'utf8'));
} catch (e) {
  if (tiene('--hook')) { console.log(`[SEGUIMIENTOS CON FECHA] no se pudo leer la memoria project_seguimientos_con_fecha: ${e.message}. Arreglarla antes de seguir.`); process.exit(0); }
  console.error(e.message); process.exit(1);
}
const { datos } = bloque;

try {
  if (tiene('--hook')) {
    const t = textoHook(datos, HOY);
    if (t) console.log(t);
  } else if (tiene('--anotar')) {
    const s = anotar(datos, valor('--anotar'), { fecha: valor('--fecha') || HOY, que: valor('--que'), enviado: tiene('--enviado') });
    writeFileSync(ARCHIVO, escribirBloque(bloque));
    const e = estadoDe(s, HOY);
    console.log(`anotado en "${s.id}": ${e.enviados} pedido(s) enviados. Proxima insistencia: ${nombreDia(e.proxima)} ${e.proxima}${e.escala ? `, con ${e.cc.join(' y ')} en copia` : ''}.`);
  } else if (tiene('--cerrar')) {
    const s = cerrar(datos, valor('--cerrar'), { fecha: valor('--fecha') || HOY, motivo: valor('--motivo') });
    writeFileSync(ARCHIVO, escribirBloque(bloque));
    console.log(`cerrado "${s.id}": ${s.cerrado.motivo}`);
  } else {
    const segs = abiertos(datos);
    console.log(`Seguimientos abiertos al ${nombreDia(HOY)} ${HOY}: ${segs.length}`);
    for (const s of segs) {
      const e = estadoDe(s, HOY);
      console.log(`\n${s.id} — ${s.que}`);
      console.log(`  abierto el ${s.abierto} · se insiste: ${(s.dias || []).join(' y ')} · pedidos enviados: ${e.enviados}`);
      for (const i of s.intentos || []) console.log(`    ${i.fecha}  ${i.enviado ? 'ENVIADO ' : 'sin enviar'}  ${i.que}`);
      if (e.sinEnviar) console.log('  >> EL PRIMER PEDIDO TODAVIA NO SALIO.');
      console.log(e.tocaHoy
        ? `  >> HOY TOCA${e.atrasado ? ' (atrasado)' : ''}: pedido numero ${e.proximoNumero}${e.escala ? `, CON ${e.cc.join(' y ')} EN COPIA` : ''}.`
        : `  proxima insistencia: ${nombreDia(e.proxima)} ${e.proxima}${e.escala ? ` (ya con ${e.cc.join(' y ')} en copia)` : ''}`);
      if (s.mail) console.log(`  mail: "${s.mail.asunto}" · para ${[].concat(s.mail.para).join(', ')} · cc ${[].concat(s.mail.cc || []).join(', ')}`);
      if (s.se_cierra_cuando) console.log(`  se cierra cuando: ${s.se_cierra_cuando}`);
    }
  }
} catch (e) {
  console.error(e.message);
  process.exit(tiene('--hook') ? 0 : 1);
}
