/**
 * _latido.mjs — el despertador de una sesion que Fak dejo trabajando hasta una hora (regla trabajar-hasta-la-hora.md).
 *
 * Se lanza en SEGUNDO PLANO desde la sesion (herramienta Bash con run_in_background y una descripcion que empiece con
 * "LATIDO"). Deja una señal con su numero de proceso (~/.claude/.latido/<sesion>.<pid>.json), la refresca cada 30 s
 * mientras espera y termina. El aviso de "termino" del programa despierta a la sesion; en ese turno la sesion mira la
 * hora, sigue con la lista y lo vuelve a lanzar. El control de cierre (hora-guard.sh) mira que haya una señal viva.
 * Por que asi y no CronCreate ni una tarea programada de la app: lo medido, en scripts/_lib/horaGuard.mjs (seccion 2 bis).
 *
 * LO QUE LA SESION VE ES EL CODIGO DE SALIDA, no lo que se imprime (auditor 09/10/2026: el aviso de un programa en
 * segundo plano trae su descripcion y su "exit code", no su salida). Por eso:
 *   0  desperto con la hora vigente: seguir y relanzarlo
 *   4  no hay (o ya no hay) una hora vigente para esta sesion: NO se relanza; no arranca si no hay hora
 *   2  argumento o sin sesion
 * Lo impreso queda en el archivo de salida del aviso, para quien lo abra.
 *
 * Uso:
 *   node scripts/_latido.mjs                 espera 9 minutos
 *   node scripts/_latido.mjs --minutos 5     otra espera (de 0,05 a 9,5)
 *   node scripts/_latido.mjs --sesion <id>   otra sesion (por defecto CLAUDE_CODE_SESSION_ID, que da Claude Code)
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  escribirLatido, borrarLatido, vigente, enLocal, LATIDO_MINUTOS, COMO_LANZAR, REFRESCO_LATIDO_MS, SALIDA_SIN_HORA,
} from './_lib/horaGuard.mjs';

/** Lo que imprime al despertar (queda en el archivo de salida del aviso). */
export function textoAlDespertar({ estado, ahora = new Date() } = {}) {
  if (!estado) {
    return `LATIDO ${enLocal(ahora).slice(11)}: no hay una hora vigente para esta sesión (llegó la hora o se terminó el pedido). No lo relances: si llegó la hora, cerrá con node scripts/_lib/horaGuard.mjs --terminar y el resumen para Fak.`;
  }
  return [
    `LATIDO ${enLocal(ahora).slice(11)}: Fak pidió trabajar hasta las ${estado.hasta}.`,
    '1. Corré node scripts/_colgados.mjs (lo que lanzaste y lleva 10 minutos quieto se mira, no se espera).',
    `2. Leé la lista (${estado.lista || 'sin archivo: armala'}), anotá lo hecho y seguí con lo que falta; si se acabó, agregale trabajo de la cola que no necesite su sí.`,
    `3. Relanzá el latido: ${COMO_LANZAR}.`,
  ].join('\n');
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export async function main(argv, { env = process.env, home, ahora = () => new Date(), esperar = dormir, log = console.log, pid = process.pid } = {}) {
  const op = {};
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === '--minutos' || argv[i] === '--sesion') && i + 1 < argv.length) { op[argv[i]] = argv[++i]; continue; }
    log(`no conozco el argumento ${argv[i]}. uso: node scripts/_latido.mjs [--minutos N] [--sesion <id>]`);
    return 2;
  }
  const minutos = op['--minutos'] != null ? Number(String(op['--minutos']).replace(',', '.')) : LATIDO_MINUTOS;
  if (!Number.isFinite(minutos) || minutos < 0.05 || minutos > 9.5) { log('--minutos va de 0,05 a 9,5.'); return 2; }
  const sesion = op['--sesion'] || env.CLAUDE_CODE_SESSION_ID;
  if (!sesion) { log('no sé de qué sesión es: falta CLAUDE_CODE_SESSION_ID (lo da Claude Code) o --sesion <id>.'); return 2; }

  // sin hora vigente no arranca: un latido sin pedido despertaria a la sesion para nada
  if (!vigente(sesion, { ahora: ahora(), home })) {
    log(textoAlDespertar({ estado: null, ahora: ahora() }));
    return SALIDA_SIN_HORA;
  }
  const inicio = ahora();
  const senal = escribirLatido({ sesion, pid, minutos, ahora: inicio, home });
  try {
    // espera por tramos y refresca la señal en cada uno: el control sabe que ESTE proceso sigue dando señales
    let falta = senal.despierta_ms - senal.inicio_ms;
    while (falta > 0) {
      const tramo = Math.min(falta, REFRESCO_LATIDO_MS);
      await esperar(tramo);
      falta -= tramo;
      if (falta > 0) escribirLatido({ sesion, pid, minutos, ahora: ahora(), inicio, home });
    }
  } finally {
    borrarLatido({ sesion, pid, home });
  }
  const momento = ahora();
  const estado = vigente(sesion, { ahora: momento, home });
  log(textoAlDespertar({ estado, ahora: momento }));
  return estado ? 0 : SALIDA_SIN_HORA;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
