/**
 * _colgados.mjs — dice que conversaciones o agentes de Claude estan QUIETOS hace mas de 10 minutos sin haber terminado,
 * y que esperan (una herramienta sin resultado = casi siempre un cartel de permiso). Solo lee los registros; no abre
 * ventanas ni toca nada.
 *
 * Fak, 04/10/2026: «que no vuelva a pasar eso de perder 55 minutos» (cuatro conversaciones del examen esperaban un
 * cartel y nadie lo miro). Lo corre el latido de «trabajar hasta la hora» (regla trabajar-hasta-la-hora.md).
 *
 * Uso:
 *   node scripts/_colgados.mjs                         lo quieto ahora (ultimas 3 horas, 10 minutos)
 *   node scripts/_colgados.mjs --minutos 5 --horas 6
 *   node scripts/_colgados.mjs --a "2026-10-04 13:30"  como estaba a esa hora (para repasar un caso)
 * Sale con 0 si no hay nada quieto, con 1 si hay algo para mirar, con 2 ante un argumento que no conoce.
 */
import os from 'node:os';
import path from 'node:path';
import { colgados } from './_lib/colgados.mjs';

const CON_VALOR = ['--minutos', '--horas', '--a', '--raiz'];
const args = process.argv.slice(2);
const op = {};
for (let i = 0; i < args.length; i++) {
  if (CON_VALOR.includes(args[i]) && i + 1 < args.length) { op[args[i]] = args[++i]; continue; }
  console.log(`no conozco el argumento ${args[i]}. No hago nada.\nuso: [--minutos N] [--horas N] [--a "AAAA-MM-DD HH:MM"]`);
  process.exit(2);
}
const num = (v, def) => (/^\d{1,4}$/.test(String(v ?? '')) ? Number(v) : def);
let hastaMs = null;
if (op['--a']) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(op['--a']);
  if (!m) { console.log('--a va como "AAAA-MM-DD HH:MM" (hora de esta PC)'); process.exit(2); }
  hastaMs = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
}
const raiz = op['--raiz'] || path.join(os.homedir(), '.claude', 'projects');
const lista = colgados({ raiz, ahoraMs: hastaMs ?? Date.now(), minutos: num(op['--minutos'], 10), horas: num(op['--horas'], 3), hastaMs });
if (!lista.length) { console.log(`[COLGADOS] nada quieto${hastaMs ? ` a las ${op['--a']}` : ''}: ninguna conversación ni agente lleva ${num(op['--minutos'], 10)} minutos sin escribir a mitad de un turno.`); process.exit(0); }
console.log(`[COLGADOS] ${lista.length} para MIRAR ahora (no esperar):`);
for (const c of lista) console.log(`  ${c.texto}`);
console.log('Qué hacer: abrir ese registro; si espera un cartel, lo aprueba Fak o se frena la conversación (stop_session) y se le manda cómo seguir.');
process.exit(1);
