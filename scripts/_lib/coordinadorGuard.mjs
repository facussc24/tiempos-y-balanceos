/**
 * coordinadorGuard.mjs — el cerrojo del rol coordinador.
 *
 * Lo llama .claude/hooks/coordinador-guard.sh (PreToolUse, matcher SendMessage|Agent).
 * Recibe por stdin el JSON del hook y decide si la llamada pasa o se bloquea.
 *
 * POR QUE EN NODE Y NO EN BASH: el cuerpo de un mensaje trae comillas, saltos de linea y
 * backslashes de Windows. Parsearlo con sed es exactamente donde esta casa ya se comio bugs
 * (escritorio-tareas.md: "los backslashes se colapsan y el hook cae en su rama de fallback
 * dando un verde falso"). JSON.parse no se equivoca.
 *
 * QUE BLOQUEA
 *   SendMessage  -> si el cuerpo no salio de scripts/_encargo.mjs (sin marcador, marcador
 *                   inventado, o texto editado despues de validarlo).
 *   Agent        -> solo los dos checks baratos: segunda tarea (G3) y accion irreversible
 *                   (G4). El canal completo no aplica: lanzar subagentes lo hacen todas las
 *                   sesiones todo el dia y un gate pesado ahi es el candado que se saltea.
 *
 * ESCAPE (un solo uso), para mensajes que no son encargos — un "gracias", un aviso:
 *   touch ~/.claude/.encargo-libre
 * Vale mientras el archivo este VACIO. Al usarlo, el guardian le escribe la fecha adentro y
 * deja de valer. Para volver a habilitarlo:  : > ~/.claude/.encargo-libre
 * (No se borra: en esta casa nada se borra, ni un flag.)
 *
 * SALIDA: exit 0 = pasa · exit 2 = bloquea (stderr vuelve a Claude como feedback).
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { detectarSegundaTarea, detectarIrreversibles } from '../_encargo.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const DIR_ESTADO = path.join(RAIZ, '.claude', 'state', 'encargos');
const ESCAPE = path.join(os.homedir(), '.claude', '.encargo-libre');

const RE_MARCADOR = /\[ENCARGO\s+(E\d{6}-[0-9a-f]{4})\]/;

/** El escape vale solo si existe y esta vacio (asi es de un solo uso, sin borrar nada). */
export function escapeVigente(f = ESCAPE) {
  try { return fs.existsSync(f) && fs.statSync(f).size === 0; } catch { return false; }
}
function consumirEscape(f = ESCAPE) {
  try { fs.writeFileSync(f, `consumido ${new Date().toISOString()}\n`); } catch { /* da igual */ }
}

/** Decide sobre un payload ya parseado. Exportada para poder testear sin proceso. */
export function decidir(payload, { hayEscape = escapeVigente, leerEncargo } = {}) {
  const tool = payload?.tool_name;
  const inp = payload?.tool_input || {};

  // --- Agent: solo los dos checks baratos ---------------------------------
  if (tool === 'Agent' || tool === 'Task') {
    const texto = `${inp.description || ''} ${inp.prompt || ''}`;
    const irre = detectarIrreversibles(texto);
    if (irre.length) {
      return { ok: false, titulo: 'un subagente no puede recibir una orden irreversible',
        lineas: [`  Encontrado: "${irre[0].encontrados[0]}"  (${irre[0].id})`,
                 `  ${irre[0].motivo}`,
                 `  Se revierte con: ${irre[0].revierte}`,
                 '',
                 '  Eso vuelve a Fak. Sacalo del prompt y relanzá.'] };
    }
    const seg = detectarSegundaTarea(inp.prompt || '');
    if (seg.length) {
      return { ok: false, titulo: 'un subagente, un entregable',
        lineas: [`  Conector de segunda tarea: "${seg.join('", "')}"`,
                 '  El 31/08 se le dieron dos tareas a una sesion: agarro la segunda y dejo',
                 '  parada la primera, que era la que importaba.',
                 '',
                 '  Partilo en dos lanzamientos.'] };
    }
    return { ok: true };
  }

  // --- SendMessage: canal unico -------------------------------------------
  if (tool !== 'SendMessage' && tool !== 'mcp__ccd_session_mgmt__send_message') return { ok: true };

  const cuerpo = inp.message || inp.content || '';
  if (typeof cuerpo !== 'string' || !cuerpo.trim()) return { ok: true };

  if (hayEscape()) return { ok: true, escape: true };

  const m = cuerpo.match(RE_MARCADOR);
  if (!m) {
    return { ok: false, titulo: 'este mensaje no salio de _encargo.mjs',
      lineas: [
        '  Un encargo a otra sesion se arma con el script, que lo valida y lo registra:',
        '',
        '    node scripts/_encargo.mjs --a "<sesion>" --entregable "<UNO>" --origen fak \\',
        '         --cuerpo "<el texto>" --sin-supuestos',
        '',
        '  Despues pegás la salida TAL CUAL en el SendMessage.',
        '',
        '  Por que existe esto: hasta el 02/09/2026 del coordinador salia prosa libre y en',
        '  dos dias produjo 7 errores reales — un "creo" de Fak convertido en dato, un mail',
        '  inexistente mandado a buscar, dos tareas en un mismo encargo, una orden de cerrar',
        '  el arb que dejo todo trabado, y un OK de Fak reenviado. Las lecciones se',
        '  escribieron las siete veces y ninguna frenaba nada.',
        '',
        '  Si esto NO es un encargo (un gracias, un aviso, una correccion de una linea):',
        '    touch ~/.claude/.encargo-libre     # un solo uso, lo consume el guardian',
      ] };
  }

  const id = m[1];
  const leer = leerEncargo || ((i) => {
    const f = path.join(DIR_ESTADO, `${i}.json`);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
  });
  const reg = leer(id);

  if (!reg) {
    return { ok: false, titulo: `el marcador ${id} no existe en el registro`,
      lineas: ['  Escribir un marcador a mano no alcanza: tiene que haberlo emitido el script.',
               `  Registro esperado: .claude/state/encargos/${id}.json`,
               '',
               '  Arma el encargo de verdad con node scripts/_encargo.mjs'] };
  }

  if (typeof reg.texto === 'string' && reg.texto && !cuerpo.includes(reg.texto.trim())) {
    return { ok: false, titulo: `el encargo ${id} se edito despues de validarlo`,
      lineas: ['  El texto que mandas no coincide con el que el script valido y registro.',
               '  Si necesitas cambiarlo, volve a armarlo: los checks corren sobre el texto',
               '  final, no sobre el que se aprobo antes de editarlo a mano.'] };
  }

  // El bloque validado esta entero, pero pudieron AGREGARLE texto alrededor. Un encargo
  // inocuo con "y cerrá el arb" pegado al final pasaba el check de arriba: contenerlo no
  // alcanza. Los checks de contenido se corren sobre el mensaje COMPLETO — lo que ya salio
  // del script no puede dispararlos de nuevo, asi que lo unico que cazan es lo agregado.
  // (Bypass encontrado por el propio test rojo 3, 02/09/2026.)
  const irre = detectarIrreversibles(cuerpo);
  if (irre.length) {
    return { ok: false, titulo: `el encargo ${id} lleva pegada una accion IRREVERSIBLE`,
      lineas: [`  Encontrado fuera del bloque validado: "${irre[0].encontrados[0]}"  (${irre[0].id})`,
               `  ${irre[0].motivo}`,
               `  Se revierte con: ${irre[0].revierte}`,
               '',
               '  Eso vuelve a Fak. Sacalo del mensaje.'] };
  }
  const seg = detectarSegundaTarea(cuerpo);
  if (seg.length) {
    return { ok: false, titulo: `el encargo ${id} lleva pegada una SEGUNDA TAREA`,
      lineas: [`  Conector encontrado: "${seg.join('", "')}"`,
               '  Un encargo, un entregable. Si hace falta otra cosa, es otro encargo y sale',
               '  cuando vuelva este.'] };
  }

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────── proceso

async function main() {
  let crudo = '';
  for await (const chunk of process.stdin) crudo += chunk;

  let payload;
  try {
    payload = JSON.parse(crudo);
  } catch {
    // No se pudo leer el payload: se deja pasar. Un guardian que rompe el trabajo diario
    // por no poder parsear es peor que uno que no corre (se termina desactivando entero).
    process.exit(0);
  }

  const r = decidir(payload);
  if (r.escape) consumirEscape();
  if (r.ok) process.exit(0);

  console.error(`\n[COORDINADOR-GUARD — BLOQUEO] ${r.titulo}\n`);
  r.lineas.forEach((l) => console.error(l));
  console.error('');
  process.exit(2);
}

if (process.argv[1]?.endsWith('coordinadorGuard.mjs')) main();
