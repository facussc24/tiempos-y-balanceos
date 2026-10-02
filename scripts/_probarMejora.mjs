/**
 * _probarMejora.mjs — una mejora del sistema (hook, skill, regla, guardian) no esta implementada hasta que se la
 * probo con un mensaje REAL de Fak por el camino real. Regla: `.claude/rules/mejora-implementada.md`.
 *
 * Fak, 02/10/2026: "te pedi antes que me lo des facil de entender y no aplicaste la mejora que habiamos
 * implementado... pensa como evitar que cuando te digo que implementes algo realmente lo implementes".
 *
 * Uso:
 *   node scripts/_probarMejora.mjs --mensaje "<mensaje de Fak, textual>" [--mensaje "..."] [--espera "<texto>"]
 *       Corre cada mensaje por los hooks de `.claude/settings.json`, pelado y con el aviso que la app le pega
 *       adelante, y despues el cierre del turno sobre una respuesta comun. Dice que le llega a Claude y si el
 *       cierre lo frenaria. Al final, el renglon para Fak: si las sesiones abiertas toman el cambio solas.
 *       `--espera` exige que algun hook devuelva ese texto (p. ej. "EXPLICAR-MEJOR") en las dos formas.
 *   node scripts/_probarMejora.mjs --llego [--desde 2026-10-02T11:44:18Z]
 *       En los transcripts: cuantos mensajes debian recibir cada aviso y a cuantos les llego, por sesion.
 *   node scripts/_probarMejora.mjs --sesiones
 *       Solo el renglon de las sesiones abiertas.
 *
 * Sale con 0 si no hay fallas, 1 si las hay, 2 si no entiende los argumentos (y no hace nada).
 * No escribe en el repo ni en ninguna carpeta de trabajo: solo en el TEMP (claude-probar-mejora), siempre
 * los mismos seis archivos, que pisa en cada corrida. No borra nada.
 * El cierre-guard reconoce la corrida con `--mensaje` como la prueba de la sesion (cierreCanon, `mejora`).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO, DATOS, probarMensaje, sesionesAbiertas, llego } from './_lib/probarMejora.mjs';

const CON_VALOR = ['--mensaje', '--espera', '--desde'];
const SIN_VALOR = ['--llego', '--sesiones'];

function leerArgumentos(argv) {
  const op = { mensajes: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (SIN_VALOR.includes(a)) { op[a.slice(2)] = true; continue; }
    if (CON_VALOR.includes(a)) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) return { error: `a ${a} le falta su valor` };
      if (a === '--mensaje') op.mensajes.push(v); else op[a.slice(2)] = v;
      i++; continue;
    }
    return { error: `no conozco el argumento ${a}` };
  }
  if (!op.mensajes.length && !op.llego && !op.sesiones) return { error: 'falta --mensaje "<mensaje real de Fak>", --llego o --sesiones' };
  if (op.mensajes.some((m) => m.trim().length < 8)) return { error: 'el mensaje tiene que ser uno real de Fak, textual (no una palabra suelta)' };
  return op;
}

const corta = (t, n = 96) => { const u = String(t || '').replace(/\s+/g, ' ').trim(); return u.length > n ? `${u.slice(0, n)}…` : u; };
const dice = (...l) => console.log(l.join('\n'));

function imprimirPrueba(r) {
  dice('', `MENSAJE: «${corta(r.mensaje, 110)}»`, '  1. Lo que le llega a Claude con ese mensaje (hooks de mensajes):');
  for (const m of r.mensajes) {
    const pelado = m.pelado ? corta(m.pelado.split('\n')[0]) : 'nada';
    dice(`     ${m.hook.padEnd(40)} ${pelado}${m.distinto ? `\n     ${' '.repeat(40)} CON UN AVISO DE LA APP ADELANTE: ${m.conAviso ? corta(m.conAviso.split('\n')[0]) : 'nada'}` : ''}`);
  }
  if (r.mensajes.every((m) => !m.pelado)) dice('     -> ningun hook le agrega nada: Claude recibe el mensaje pelado.');
  dice('  2. El cierre del turno, si Claude contesta "normal" (texto y una tabla, sin skill, dibujo ni pagina):');
  for (const c of r.cierre) dice(`     ${c.hook.padEnd(40)} ${c.frena ? `FRENA — ${c.motivo}` : 'deja pasar'}`);
  for (const f of r.fallas) dice(`  FALLA: ${f}`);
}

async function main(argv) {
  const op = leerArgumentos(argv);
  if (op.error) { console.error(`${op.error}. No hago nada.\nuso: --mensaje "<mensaje real de Fak>" [--espera "<texto>"] | --llego [--desde <fecha ISO>] | --sesiones`); return 2; }
  let fallas = 0;

  if (op.mensajes.length) {
    dice(`PRUEBA DE MEJORA — hooks de ${path.join(REPO, '.claude', 'settings.json')}`);
    for (const mensaje of op.mensajes) {
      const r = probarMensaje(mensaje, { espera: op.espera || null });
      imprimirPrueba(r);
      fallas += r.fallas.length;
    }
  }

  if (op.mensajes.length || op.sesiones) {
    const s = sesionesAbiertas();
    dice('', 'SESIONES ABIERTAS', ...s.texto.map((t) => `  ${t}`));
  }

  if (op.llego) {
    dice('', '¿LLEGO? — lo que debia recibir cada aviso y lo que lo recibio, en los transcripts');
    for (const aviso of DATOS.avisos) {
      const r = await llego(aviso, op.desde ? { desde: op.desde } : {});
      if (!r.medible) { dice(`  ${aviso.id}: sin medidor (falta su funcion en DEBIA)`); continue; }
      dice(`  ${aviso.id} (desde ${r.desde}): debia ${r.debia} · llego ${r.llego}`);
      for (const s of r.sesiones) dice(`     sesion ${s.sesion}: debia ${s.debia} · llego ${s.llego}`);
      for (const m of r.faltaron) dice(`     NO LLEGO [${m.sesion} ${String(m.ts).slice(5, 16)}]${m.conAviso ? ' (con un aviso de la app adelante)' : ''} «${corta(m.texto, 80)}»`);
      if (!r.debia) dice('     todavia no hubo un mensaje que lo dispare: la mejora no se vio funcionar');
      fallas += r.faltaron.length;
    }
  }

  dice('', fallas ? `RESULTADO: ${fallas} falla(s). La mejora NO esta implementada.` : 'RESULTADO: sin fallas.');
  return fallas ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).then((n) => process.exit(n));
}

export { leerArgumentos, main };
