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
 *   : > ~/.claude/.encargo-libre.<session_id>
 * VA CON  : >  Y NO CON touch. Si el escape ya se uso, adentro quedo "consumido ..." y touch
 * solo le cambia la fecha: sigue sin valer, porque tiene que estar VACIO. Lo reporto
 * barackmercosul-38 el 02/09/2026, chocandose con el mensaje de bloqueo que decia touch.
 * Es POR SESION a proposito: con varias sesiones abiertas un flag compartido te lo consume
 * otra en el medio. El global sin sufijo sigue valiendo, para que Fak destrabe a mano.
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

/**
 * El escape es POR SESION: `~/.claude/.encargo-libre.<session_id>`.
 *
 * Era uno solo en el HOME y lo reporto barackmercosul-38 desde el uso real (02/09/2026):
 * con cuatro sesiones abiertas el flag es compartido, asi que armas el escape y te lo
 * consume otra sesion en el medio. Es una carrera, y le paso de verdad.
 *
 * Sigue valiendo el global sin sufijo, para que Fak pueda destrabar a mano sin saber el id.
 */
export function rutaEscape(sessionId) {
  return sessionId ? `${ESCAPE}.${sessionId}` : ESCAPE;
}

/**
 * Vale solo si es un ARCHIVO REGULAR vacio y escribible.
 *
 * Auditoria del 02/09/2026: `mkdir ~/.claude/.encargo-libre` lo dejaba abierto para siempre
 * — un directorio da size 0 (vigente) y el consumo tiraba EISDIR, que el catch se comia.
 * Idem `attrib +R`: EPERM al consumir, seguia vigente. Un escape que no se puede consumir
 * no es de un solo uso: es el candado apagado en silencio.
 */
export function escapeVigente(f = ESCAPE) {
  try {
    const st = fs.statSync(f);
    if (!st.isFile() || st.size !== 0) return false;
    fs.accessSync(f, fs.constants.W_OK);   // si no se puede consumir, NO vale
    return true;
  } catch { return false; }
}

/** El de esta sesion primero; el global como respaldo manual de Fak. */
export function escapeVigenteSesion(sessionId) {
  const propio = rutaEscape(sessionId);
  if (sessionId && escapeVigente(propio)) return propio;
  if (escapeVigente(ESCAPE)) return ESCAPE;
  return null;
}

function consumirEscape(f) {
  try { fs.writeFileSync(f, `consumido ${new Date().toISOString()}\n`); }
  catch { /* escapeVigente ya probo que se puede escribir; si igual fallo, no hay nada que hacer */ }
}

/**
 * Compara el mensaje contra el texto validado sin castigar el transporte.
 * Un CRLF o un espacio al final de linea NO son una edicion: son el portapapeles.
 * Pero el mensaje tiene que ser el encargo, no el encargo perdido adentro de otra cosa.
 */
export function mismoTexto(cuerpo, textoValidado) {
  const limpiar = (s) => s
    .replace(/\r\n/g, '\n')
    .split('\n').map((l) => l.replace(/[ \t ]+$/, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return limpiar(cuerpo) === limpiar(textoValidado);
}

/** Decide sobre un payload ya parseado. Exportada para poder testear sin proceso. */
export function decidir(payload, { hayEscape, leerEncargo } = {}) {
  const tool = payload?.tool_name;
  const inp = payload?.tool_input || {};
  const sid = payload?.session_id;
  // hayEscape se inyecta en los tests; en produccion se resuelve por sesion.
  const buscarEscape = hayEscape ? () => (hayEscape() ? rutaEscape(sid) : null)
                                 : () => escapeVigenteSesion(sid);

  // --- Lanzamientos de trabajo: solo los dos checks baratos ----------------
  // Todas las tools que arrancan trabajo en otro lado con un prompt propio. La auditoria del
  // 02/09/2026 encontro que el matcher solo nombraba dos y dejaba abiertos spawn_task,
  // send_message del MCP y las tareas agendadas: tres puertas al mismo cuarto.
  const LANZADORAS = ['Agent', 'Task', 'mcp__ccd_session__spawn_task',
                      'mcp__scheduled-tasks__create_scheduled_task'];
  if (LANZADORAS.includes(tool)) {
    const texto = `${inp.description || ''} ${inp.prompt || ''} ${inp.title || ''} ${inp.tldr || ''}`;
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

  // Cualquier otra tool que empiece trabajo en otro lado y todavia no este contemplada:
  // se avisa una vez, no se bloquea. Una lista de tools es una lista canonica mas, y esta
  // casa ya sabe que envejecen — pero bloquear a ciegas algo que no se conoce es peor.
  if (/spawn|dispatch|remote_trigger|create_scheduled/i.test(String(tool || ''))) {
    return { ok: true, aviso: `tool "${tool}" arranca trabajo en otro lado y el guardian no la revisa. Si le estas mandando un encargo, armalo con _encargo.mjs.` };
  }

  // --- SendMessage: canal unico -------------------------------------------
  if (tool !== 'SendMessage' && tool !== 'mcp__ccd_session_mgmt__send_message') return { ok: true };

  const cuerpo = inp.message || inp.content || '';
  if (typeof cuerpo !== 'string' || !cuerpo.trim()) return { ok: true };

  const esc = buscarEscape();
  if (esc) return { ok: true, escape: esc };

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
        `    : > ~/.claude/.encargo-libre.${sid || '<session_id>'}`,
        '',
        '  Va con  : >  y NO con touch: si el escape ya se uso antes, touch solo le cambia la',
        '  fecha y adentro queda "consumido", asi que sigue sin valer. Y es por SESION a',
        '  proposito — con varias sesiones abiertas, un flag compartido te lo consume otra en',
        '  el medio (lo reporto barackmercosul-38 el 02/09, le paso de verdad).',
      ] };
  }

  // Dos marcadores = uno valido usado de coartada para otro texto. `match` sin /g solo veia
  // el primero (auditoria 02/09, H5).
  const todos = cuerpo.match(new RegExp(RE_MARCADOR.source, 'g')) || [];
  if (todos.length > 1) {
    return { ok: false, titulo: 'el mensaje tiene mas de un marcador de encargo',
      lineas: [`  Encontrados: ${todos.join(' , ')}`,
               '  Un mensaje, un encargo. Dos marcadores es un encargo valido prestandole',
               '  la firma a un texto que nadie valido.'] };
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

  // Un registro SIN el campo `texto` no habilita nada. Antes el check era
  // `typeof reg.texto === 'string' && ...`, o sea que si el campo faltaba el check se
  // salteaba entero: los 7 encargos escritos por la version anterior del script eran
  // llaves maestras para cualquier prosa (auditoria 02/09, H1 — el agujero mas grave).
  if (typeof reg.texto !== 'string' || !reg.texto.trim()) {
    return { ok: false, titulo: `el encargo ${id} no tiene texto registrado`,
      lineas: ['  Es un registro viejo o incompleto: no se puede comparar contra nada, asi que',
               '  no habilita ningun mensaje. Arma el encargo de nuevo.'] };
  }

  // Un encargo cerrado ya cumplio su funcion. Antes `cerrado` no se miraba nunca y los
  // encargos cerrados seguian siendo llaves permanentes (auditoria 02/09, H3).
  if (reg.cerrado) {
    return { ok: false, titulo: `el encargo ${id} ya esta cerrado`,
      lineas: [`  Se cerro el ${String(reg.cerrado).slice(0, 16).replace('T', ' ')}.`,
               '  Un encargo cerrado no habilita mensajes nuevos: arma otro.'] };
  }

  // El encargo salio PARA una sesion. Mandarlo a otra es exactamente el error de hablarle a
  // la sesion equivocada, que G7 dice cubrir y el hook no comprobaba (auditoria 02/09, H4).
  const destino = inp.to || inp.recipient || '';
  if (reg.a && destino && String(reg.a).trim() !== String(destino).trim()) {
    return { ok: false, titulo: `el encargo ${id} no era para ${destino}`,
      lineas: [`  Se emitio para: ${reg.a}`,
               `  Lo estas mandando a: ${destino}`,
               '',
               '  Si es para otra sesion, es otro encargo. El mismo encargo mandado a varias',
               '  sesiones es como se termina trabajando dos veces lo mismo.'] };
  }

  // El mensaje tiene que SER el encargo, no contenerlo. Con `includes` alcanzaba con pegar
  // el bloque validado al final de cualquier prosa: el 95% del mensaje podia no estar
  // validado (auditoria 02/09, H2). mismoTexto() ignora CRLF y espacios de fin de linea,
  // que son transporte y no edicion (H22).
  if (!mismoTexto(cuerpo, reg.texto)) {
    return { ok: false, titulo: `el mensaje no es el encargo ${id} tal como se valido`,
      lineas: ['  El texto tiene que ir SOLO y TAL CUAL. Si le agregaste algo alrededor, eso',
               '  que agregaste no paso por ningun control — que es justo lo que el canal',
               '  existe para impedir.',
               '',
               '  Si hace falta decir algo mas, va adentro del --cuerpo cuando armas el encargo.'] };
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
  if (r.escape) consumirEscape(r.escape);
  if (r.ok) process.exit(0);

  console.error(`\n[COORDINADOR-GUARD — BLOQUEO] ${r.titulo}\n`);
  r.lineas.forEach((l) => console.error(l));
  console.error('');
  process.exit(2);
}

if (process.argv[1]?.endsWith('coordinadorGuard.mjs')) main();
