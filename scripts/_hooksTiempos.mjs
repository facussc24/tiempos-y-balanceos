/**
 * _hooksTiempos.mjs — lee el registro de tiempos del control de cierre y dice en qué fase se va el tiempo.
 *
 * El registro lo escriben `.claude/hooks/cierre-guard.sh` (inicio y fin de cada corrida) y
 * `scripts/_lib/hooksTiempos.mjs` (el tiempo de cada fase). Plan P9, commit C0
 * (docs/PLAN_P9_P10_HOOKS_INCREMENTAL_2026-10-10.md §6.4): hacen falta por lo menos 5 días hábiles de corridas antes
 * de decidir. Lo que decide: corridas MATADAS 0; fase «relevar» con p90 bajo 300 ms; total máximo bajo 10 s. Y si
 * «relevar» no es la fase que domina, el plan P9 no va como está escrito.
 *
 *   node scripts/_hooksTiempos.mjs                       # todo el registro
 *   node scripts/_hooksTiempos.mjs --desde 2026-10-11    # desde ese día (hora de esta PC; acepta "AAAA-MM-DD HH:MM")
 *   node scripts/_hooksTiempos.mjs --json                # el resumen como JSON
 *   node scripts/_hooksTiempos.mjs --con-pruebas         # cuenta también las corridas que lanzó una prueba
 *   node scripts/_hooksTiempos.mjs --ruta                # dónde está el registro
 *   node scripts/_hooksTiempos.mjs --registro <archivo>  # otro registro
 *
 * Las corridas que lanza una prueba (un test, `_probarMejora.mjs`) no se anotan; si alguna se anotó igual (su registro
 * de conversación no es el de una sesión real), el resumen la deja afuera salvo con --con-pruebas.
 * Solo lee. Sale con 0 siempre que pudo leer (aunque haya matadas: es un informe, no un control); 2 si un argumento
 * está mal.
 */
import { leerRegistro, resumir, textoResumen, rutaRegistroReal } from './_lib/hooksTiempos.mjs';

const CONOCIDOS = ['--desde', '--json', '--con-pruebas', '--ruta', '--registro', '--hook'];
const args = process.argv.slice(2);
const mal = (m) => { console.error(m); process.exit(2); };
// `--desde=2026-10-11` se acepta igual que `--desde 2026-10-11`; una opción que no existe no se ignora en silencio
const plano = args.flatMap((a) => (/^--[a-z-]+=/.test(a) ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a]));
for (const a of plano) if (a.startsWith('--') && !CONOCIDOS.includes(a)) mal(`No conozco la opción ${a}. Las que hay: ${CONOCIDOS.join(' ')}`);
const arg = (n) => { const i = plano.indexOf(n); return i >= 0 && i + 1 < plano.length && !plano[i + 1].startsWith('--') ? plano[i + 1] : null; };

function aMs(texto) {
  const m = String(texto || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const [a, me, d, h, mi] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] || 0), Number(m[5] || 0)];
  const f = new Date(a, me - 1, d, h, mi, 0, 0);
  // un 30 de febrero no se corre solo a marzo: es un error de tipeo
  if (Number.isNaN(f.getTime()) || f.getFullYear() !== a || f.getMonth() !== me - 1 || f.getDate() !== d || f.getHours() !== h || f.getMinutes() !== mi) return null;
  return f.getTime();
}

const ruta = arg('--registro') || rutaRegistroReal();
if (plano.includes('--ruta')) { console.log(ruta); process.exit(0); }
let desde = null;
if (plano.includes('--desde')) {
  desde = aMs(arg('--desde'));
  if (desde == null) mal('--desde va como AAAA-MM-DD o "AAAA-MM-DD HH:MM" (hora de esta PC), con una fecha que exista');
}
const hook = arg('--hook') || 'cierre-guard';
const { eventos, rotos, existe } = leerRegistro(ruta);
if (!existe) { console.log(`Todavía no existe el registro (${ruta}): el control de cierre no corrió desde que se mide.`); process.exit(0); }
const r = resumir(eventos, { desde, hook, conPruebas: plano.includes('--con-pruebas') });
if (plano.includes('--json')) console.log(JSON.stringify({ ruta, rotos, ...r }, null, 2));
else {
  console.log(textoResumen(r, { hook }));
  if (rotos) console.log(`\n${rotos} renglón(es) ilegibles en el registro (se saltearon).`);
  console.log(`\nRegistro: ${ruta}`);
}
