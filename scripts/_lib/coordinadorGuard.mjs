/**
 * coordinadorGuard.mjs — el cerrojo del rol coordinador.
 *
 * Lo llama .claude/hooks/coordinador-guard.sh (PreToolUse; el matcher vive en .claude/settings.json: SendMessage,
 * Agent, Task, send_message del MCP, spawn_task, start_session, hand_off_to_session y las tareas agendadas).
 * Recibe por stdin el JSON del hook y decide si la llamada pasa o se bloquea.
 *
 * POR QUE EN NODE Y NO EN BASH: el cuerpo de un mensaje trae comillas, saltos de linea y
 * backslashes de Windows. Parsearlo con sed es exactamente donde esta casa ya se comio bugs
 * (escritorio-tareas.md: "los backslashes se colapsan y el hook cae en su rama de fallback
 * dando un verde falso"). JSON.parse no se equivoca.
 *
 * QUE BLOQUEA
 *   SendMessage  -> si el cuerpo no salio de scripts/_encargo.mjs (sin marcador, marcador
 *                   inventado, o texto editado despues de validarlo). EXCEPTO (22/09/2026) si
 *                   el destino es un subagente que lanzo esta MISMA sesion (su `name` o su
 *                   agentId, leidos del transcript): ahi corren los checks de un Agent (G3 y G4).
 *   Agent        -> solo los dos checks baratos: segunda tarea (G3) y accion irreversible
 *                   (G4). El canal completo no aplica: lanzar subagentes lo hacen todas las
 *                   sesiones todo el dia y un gate pesado ahi es el candado que se saltea.
 *   start_session (16/10/2026) -> G3 y G4 sobre title + background + prompt, y despues el canal
 *                   completo sobre el `prompt` (tiene que SER el encargo; el `title` es el destino).
 *                   Sin prompt (oferta, proposal_id) no hay texto que revisar.
 *   hand_off_to_session -> G3 y G4 sobre title + remaining_plan (es un fork: no hay encargo).
 *   LA CITA DE FAK (23/10/2026, item 6g; revisarCita, despues de decidir): un Agent/Task, un start_session con prompt
 *                   y un encargo [ENCARGO] a otra sesion traen «PEDIDO DE FAK: "<frase textual>"», rastreada a un
 *                   mensaje real de Fak del transcript, y cada pregunta su ancla [sale de: "…"] o [agregado mío].
 *                   Trabajo propio: «PEDIDO DE FAK: ninguno (trabajo propio: <por qué>)», pasa con aviso. AVISA hasta
 *                   el 30/10 y FRENA desde el 31/10 (canon citaFak). Va aparte de decidir() a proposito: los tests que
 *                   ya existen llaman a decidir() sin transcript ni fecha y no pueden ponerse rojos el 31/10.
 *
 * AVISOS (23/10/2026): un aviso (de decidir o de la cita) sale por stdout como JSON con
 *   hookSpecificOutput.additionalContext y exit 0, que es lo que el modelo lee. Antes main() descartaba el campo
 *   `aviso` de decidir() y el aviso de «tool desconocida» no le llegaba a nadie (informe 01 del viernes 23/10).
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
 * SALIDA: exit 0 = pasa (con JSON en stdout si hay aviso) · exit 2 = bloquea (stderr vuelve a Claude como feedback).
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { detectarSegundaTarea, detectarIrreversibles, normalizar } from '../_encargo.mjs';
import { mensajesDeFak } from './mailOkFak.mjs';
import { distancia } from './correccionGuard.mjs';

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

/**
 * Los subagentes que lanzo ESTA sesion, leidos de su propio transcript (`transcript_path` del
 * payload): el `name` con que se lanzo cada Agent/Task y el `agentId` que devolvio ese
 * lanzamiento. Solo cuentan los agentIds de resultados cuyo tool_use_id es un Agent/Task de la
 * sesion (no un texto cualquiera que diga "agentId:"). Transcript ilegible = conjunto vacio:
 * el mensaje vuelve al canal completo.
 */
export function subagentesPropios(transcriptPath, sessionId) {
  const propios = new Set();
  if (!transcriptPath) return propios;
  let txt;
  try { txt = fs.readFileSync(transcriptPath, 'utf8'); } catch { return propios; }
  const lanzamientos = new Set();
  const resultados = [];
  for (const l of txt.split('\n')) {
    if (!/"name":"(Agent|Task)"|agentId/.test(l)) continue;
    let j;
    try { j = JSON.parse(l); } catch { continue; }
    if (j?.isSidechain) continue;
    if (sessionId && j?.sessionId && j.sessionId !== sessionId) continue;
    const c = j?.message?.content;
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (b?.type === 'tool_use' && (b.name === 'Agent' || b.name === 'Task')) {
        lanzamientos.add(b.id);
        if (typeof b.input?.name === 'string' && b.input.name.trim()) propios.add(b.input.name.trim());
      } else if (b?.type === 'tool_result') resultados.push(b);
    }
  }
  for (const b of resultados) {
    if (!lanzamientos.has(b.tool_use_id)) continue;
    const texto = typeof b.content === 'string' ? b.content
      : Array.isArray(b.content) ? b.content.map((x) => (typeof x?.text === 'string' ? x.text : '')).join('\n') : '';
    for (const m of texto.matchAll(/agentId:\s*([A-Za-z0-9_-]+)/g)) propios.add(m[1]);
  }
  return propios;
}

/** Los dos checks baratos (G4 irreversible, G3 segunda tarea) sobre un texto que arranca trabajo. */
function checksDeLanzamiento(texto, prompt, quien = 'un subagente') {
  const irre = detectarIrreversibles(texto);
  if (irre.length) {
    return { ok: false, titulo: `${quien} no puede recibir una orden irreversible`,
      lineas: [`  Encontrado: "${irre[0].encontrados[0]}"  (${irre[0].id})`,
               `  ${irre[0].motivo}`,
               `  Se revierte con: ${irre[0].revierte}`,
               '',
               '  Eso vuelve a Fak. Sacalo del prompt y relanzá.'] };
  }
  const seg = detectarSegundaTarea(prompt);
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

/** Decide sobre un payload ya parseado. Exportada para poder testear sin proceso. */
export function decidir(payload, { hayEscape, leerEncargo, leerSubagentes } = {}) {
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
    return checksDeLanzamiento(texto, inp.prompt || '');
  }

  // --- start_session: la hija anidada (volvio el 16/10/2026, tanda 1.1 del plan del sistema) ---
  // Es el camino normal para abrir una hija desde la sesion. Su `prompt` ES el encargo que la hija
  // recibe como primer mensaje, asi que pasa por el mismo cerrojo que un SendMessage a otra sesion:
  // tiene que ser el texto de _encargo.mjs, tal cual. Sin `prompt` (una oferta, o arrancar una ficha
  // ya propuesta por `proposal_id`) no sale ningun texto hacia otra sesion y no hay nada que revisar.
  const ES_START = tool === 'mcp__ccd_session__start_session';
  const ES_HANDOFF = tool === 'mcp__ccd_session__hand_off_to_session';
  if (ES_START || ES_HANDOFF) {
    // G3 y G4 sobre TODO lo que viaja a la hija, ANTES del escape y del encargo (auditor 16/10, H1 y H2): el
    // `background` de start_session y el `remaining_plan` de hand_off llegan a la hija como texto libre y no pasan
    // por _encargo.mjs; una orden irreversible ahi es la misma orden que en un prompt.
    const viaja = ES_START ? `${inp.title || ''} ${inp.background || ''} ${inp.prompt || ''}`
                           : `${inp.title || ''} ${inp.remaining_plan || ''}`;
    const r = checksDeLanzamiento(viaja, ES_START ? `${inp.background || ''} ${inp.prompt || ''}` : (inp.remaining_plan || ''), 'una sesion hija');
    if (!r.ok) return r;
    // hand_off es un fork: la conversacion entera viaja y no hay un encargo que comparar (auditor 16/10, H5).
    if (ES_HANDOFF) return { ok: true };
    if (typeof inp.prompt !== 'string' || !inp.prompt.trim()) return { ok: true };
  }

  // Cualquier otra tool que empiece trabajo en otro lado y todavia no este contemplada:
  // se avisa una vez, no se bloquea. Una lista de tools es una lista canonica mas, y esta
  // casa ya sabe que envejecen — pero bloquear a ciegas algo que no se conoce es peor.
  if (!ES_START && /spawn|dispatch|remote_trigger|create_scheduled/i.test(String(tool || ''))) {
    return { ok: true, aviso: `tool "${tool}" arranca trabajo en otro lado y el guardian no la revisa. Si le estas mandando un encargo, armalo con _encargo.mjs.` };
  }

  // --- SendMessage y start_session: canal unico -------------------------------------------
  if (!ES_START && tool !== 'SendMessage' && tool !== 'mcp__ccd_session_mgmt__send_message') return { ok: true };

  const cuerpo = ES_START ? inp.prompt : (inp.message || inp.content || '');
  if (typeof cuerpo !== 'string' || !cuerpo.trim()) return { ok: true };

  // En start_session el destino es el titulo de la hija (lo que _encargo.mjs registra en `a`).
  const destino = ES_START ? String(inp.title || '').trim() : String(inp.to || inp.recipient || '').trim();

  // Un SendMessage a un SUBAGENTE que lanzo esta MISMA sesion no sale hacia otra sesion: es
  // seguir hablandole a un Agent propio (una correccion, "me devolviste las rutas pero no el
  // veredicto"). 22/09/2026: 6 de los 9 bloqueos "no salio de _encargo.mjs" desde el 05/09 eran
  // esto (los otros 3 iban a otra sesion), y cada uno se resolvia con el escape + reenvio (2 turnos). Pasa por los MISMOS checks
  // que el lanzamiento (G4 irreversible, G3 segunda tarea). Lo que va a otra sesion (`uds:`, un
  // nombre que esta sesion no lanzo) o por el send_message del MCP sigue exigiendo _encargo.mjs.
  if (tool === 'SendMessage' && destino && !/^uds:/i.test(destino)) {
    const propios = leerSubagentes ? leerSubagentes() : subagentesPropios(payload?.transcript_path, sid);
    if (propios.has(destino)) {
      const r = checksDeLanzamiento(cuerpo, cuerpo, `el subagente ${destino}`);
      return r.ok ? { ok: true, subagentePropio: destino } : r;
    }
  }

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
        '  Despues pegás la salida TAL CUAL en el SendMessage (o como `prompt` de start_session).',
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

// ═══════════════════════════════════════════ 6g · el encargo cita la frase de Fak (23/10/2026, opción 3 del informe 01)
//
// LA FALLA (item 0 GRAVE de la cola del viernes 23/10, ~12:30): Fak pidio buscar «repositorios con Claudes ya
// entrenados, con skills ya hechas» y la sesion lanzo un Opus a buscar «ejercicios 3D publicos con respuesta», lo que ella
// misma habia propuesto un mensaje antes. Fak: «esto es gravisimo... que no me entiendas, estas son las cosas que no
// deberian pasarnos». El encargo tradujo las palabras de Fak al plan propio en vez de usarlas tal cual.
//
// LO QUE MIDE Y LO QUE NO (informe 01): mide que haya cita, que se rastree a un mensaje real de Fak y que cada pregunta
// diga de que trozo sale. Que la pregunta SALGA de verdad de ese trozo no se aprueba con palabras: el lanzamiento del
// incidente traia una cita real. Lo que da es que el ancla quede escrita al lado de la pregunta, donde se ve.

const CANON_COORD = JSON.parse(fs.readFileSync(path.join(AQUI, 'coordinadorCanon.data.json'), 'utf8'));
export const CITA = CANON_COORD.citaFak;
const VACIAS = new Set(CITA.vacias);
const LANZA_AGENTE = new Set(['Agent', 'Task']);
const POR_QUE_6G = 'el 23/10 Fak pidió «repositorios con Claudes ya entrenados, con skills ya hechas» y se lanzó un agente a buscar '
  + 'otra cosa (lo que la sesión había propuesto antes). Fak: «esto es gravísimo... que no me entiendas, estas son las cosas que no deberían pasarnos».';

const corta = (s, n) => { const u = String(s ?? '').replace(/\s+/g, ' ').trim(); return u.length > n ? `${u.slice(0, n)}…` : u; };

/** Minusculas, sin tildes, solo letras y numeros separados por un espacio. */
export const plano = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

/** La fecha AAAA-MM-DD en Argentina: el 30/10 a las 22:30 ya es 31/10 en UTC y todavia tiene que avisar. */
export function fechaAR(ahora = new Date()) {
  return new Date(ahora.getTime() + CITA.husoHorasUTC * 3600e3).toISOString().slice(0, 10);
}
const horaAR = (ms) => new Date(ms + CITA.husoHorasUTC * 3600e3).toISOString().slice(11, 16);
/** Desde el dia siguiente a avisoHasta, frena. */
export const frena = (ahora = new Date()) => fechaAR(ahora) > CITA.avisoHasta;

const palabrasDe = (s) => plano(s).split(' ').filter(Boolean);
const deContenido = (ws) => ws.filter((w) => w.length >= CITA.minLetrasPalabra && !VACIAS.has(w) && !/^\d+$/.test(w));
const toleranciaDe = (n) => (n <= 4 ? 1 : n <= 7 ? 2 : 3);
const ordenadas = (w) => [...w].sort().join('');

/** Un texto (mensaje de Fak o la propia cita) listo para comparar: sus palabras en orden y donde esta cada una. */
function preparar(texto, extra = {}) {
  const p = plano(String(texto ?? '').slice(0, 50000));
  const ws = p ? p.split(' ') : [];
  const pos = new Map();
  ws.forEach((w, i) => { if (w.length >= 3) { if (!pos.has(w)) pos.set(w, []); pos.get(w).push(i); } });
  return { ...extra, texto, plano: p, pos };
}

/** ¿Dos palabras son la misma con los errores de tipeo de Fak? (distancia segun el largo, o las mismas letras en otro orden) */
function coincide(w, x) {
  if (w === x) return true;
  const t = toleranciaDe(w.length);
  if (Math.abs(x.length - w.length) > t) return false;
  if (w.length >= 5 && x.length === w.length && ordenadas(x) === ordenadas(w)) return true;
  return distancia(w, x, t) <= t;
}

/**
 * Que parte de las palabras de contenido de la cita esta JUNTA en el mensaje: la mejor ventana de un largo parecido al
 * de la cita (1,5 veces sus palabras + 4, por el tipeo que parte o pega palabras). Sin la ventana, en un mensaje largo
 * de Fak las palabras parecidas sueltas sumaban: «revisa las cotas del molde nuevo» daba 0,80 contra su mensaje de las
 * 12:28 del 23/10, que no habla de eso (cotas ~ cosas, nuevo ~ nueb). El brief pide subcadena, no bolsa de palabras.
 */
function coberturaJunta(pal, totalPalabras, m) {
  const ev = [];
  pal.forEach((w, j) => {
    for (const [x, is] of m.pos) if (coincide(w, x)) for (const i of is) ev.push([i, j]);
  });
  if (new Set(ev.map((e) => e[1])).size / pal.length < CITA.umbralPalabras) return 0;
  ev.sort((a, b) => a[0] - b[0]);
  const ancho = Math.ceil(totalPalabras * 1.5) + 4;
  const cnt = new Map();
  let lo = 0; let mejor = 0;
  for (let hi = 0; hi < ev.length; hi++) {
    cnt.set(ev[hi][1], (cnt.get(ev[hi][1]) || 0) + 1);
    while (ev[hi][0] - ev[lo][0] >= ancho) {
      const j = ev[lo][1]; const c = cnt.get(j) - 1;
      if (c) cnt.set(j, c); else cnt.delete(j);
      lo++;
    }
    mejor = Math.max(mejor, cnt.size);
  }
  return mejor / pal.length;
}

/**
 * Un pedazo de cita contra los textos preparados, del ultimo para atras. { mensaje, metodo, cobertura } o null.
 * literal = subcadena normalizada · al reves = el mensaje entero (25 letras o mas) adentro de la cita ·
 * palabras = 70 % de las palabras de contenido, juntas y con tipeo (informe 01: el literal solo coincide en 3 de 202).
 */
function rastrearPedazo(pedazo, textos) {
  const fp = plano(pedazo);
  if (!fp) return null;
  const todas = fp.split(' ');
  const pal = deContenido(todas);
  for (let i = textos.length - 1; i >= 0; i--) {
    const m = textos[i];
    if (m.plano.includes(fp)) return { mensaje: m, metodo: 'literal', cobertura: 1 };
    if (m.plano.length >= CITA.minLetrasAlReves && fp.includes(m.plano)) return { mensaje: m, metodo: 'al reves', cobertura: 1 };
    if (pal.length) {
      const c = coberturaJunta(pal, todas.length, m);
      if (c >= CITA.umbralPalabras) return { mensaje: m, metodo: 'palabras', cobertura: c };
    }
  }
  return null;
}

/**
 * Una cita entera: se parte en sus «...» (la sesion junta dos frases de Fak, a veces en otro orden) y cada parte con 3
 * palabras de contenido o mas tiene que salir de un mensaje de Fak. Las partes mas cortas (un «osea») acompañan.
 */
export function rastrearCita(cita, textos) {
  const partes = String(cita ?? '').split(/\.{2,}|…/).map((s) => s.trim()).filter(Boolean);
  const fuertes = partes.filter((p) => deContenido(palabrasDe(p)).length >= CITA.minPalabrasFragmento);
  if (!fuertes.length) return { ok: false, motivo: `«${corta(cita, 80)}» no tiene una parte con ${CITA.minPalabrasFragmento} palabras de contenido o más` };
  const de = [];
  for (const p of fuertes) {
    const r = rastrearPedazo(p, textos);
    if (!r) return { ok: false, motivo: `«${corta(p, 90)}» no está en ningún mensaje de Fak de esta sesión` };
    de.push(r);
  }
  return { ok: true, de };
}

/** Renglon de encabezado: palabras en MAYUSCULAS (3 letras o mas en total) seguidas de «:», «(», «—» o el fin. */
export function esEncabezado(l) {
  const s = String(l ?? '').replace(/\*\*/g, '').replace(/^[\s>]+/, '');
  if (/^#{1,6}\s/.test(s)) return true;
  const m = s.match(/^([A-ZÁÉÍÓÚÑÜ¿?]+(?:[ /][A-ZÁÉÍÓÚÑÜ¿?]+)*)\s*(?::|\(|—|–|-\s|$)/);
  return !!m && m[1].replace(/[^A-ZÁÉÍÓÚÑÜ]/g, '').length >= 3;
}

const RE_ROTULO = /^\s*[*_]*\s*pedido de fak\s*[*_]*\s*(?:\([^)]*\))?\s*[*_]*\s*:/i;
const RE_ITEM = /^\s*(?:\d+[.)]|[-•*]|[a-z]\))\s+/;
const RE_COMILLAS = /"([^"]+)"|«([^»]+)»|“([^”]+)”/g;
const RE_SALE_DE = /\[\s*sale de\s*:\s*(?:"([^"\]]+)"|«([^»\]]+)»|“([^”\]]+)”)\s*\]/gi;
const RE_AGREGADO = /\[\s*agregado m[ií]o\s*\]/i;
const renglones = (s) => String(s ?? '').replace(/\r\n/g, '\n').split('\n');

/** ¿Quedo una comilla abierta? (la cita sigue en el renglon de abajo) */
const cuenta = (t, c) => t.split(c).length - 1;
const comillaAbierta = (t) => cuenta(t, '"') % 2 === 1 || cuenta(t, '«') > cuenta(t, '»') || cuenta(t, '“') > cuenta(t, '”');

/**
 * El renglon «PEDIDO DE FAK: ...» y, si la cita queda con la comilla abierta, los renglones que siguen hasta cerrarla
 * (10 como mucho). null si no esta. Lo que viene despues ya no es el pedido: es el encargo, con sus anclas.
 */
export function bloquePedido(prompt) {
  const L = renglones(prompt);
  const i = L.findIndex((l) => RE_ROTULO.test(normalizar(l)));
  if (i < 0) return null;
  const sigue = [];
  let t = L[i];
  for (let k = i + 1; k < L.length && k <= i + 10 && comillaAbierta(t); k++) {
    sigue.push(L[k]);
    t += `\n${L[k]}`;
  }
  const primera = L[i].replace(RE_ROTULO, '');
  return { texto: [primera, ...sigue].join('\n').trim(), desde: i, hasta: i + sigue.length };
}

/**
 * Las preguntas del prompt, cada una con su texto. Las lineas numeradas o con guion de una seccion de preguntas
 * (canon seccionesConPreguntas: «TU PREGUNTA», «PREGUNTAS», ...) son una pregunta cada una; una seccion sin lista es UNA.
 * Sin ninguna seccion de preguntas, el prompt entero (sin el renglon del pedido) es UN encargo.
 */
export function preguntasDe(prompt, bloque = bloquePedido(prompt)) {
  const L = renglones(prompt);
  const secciones = [];
  let actual = { cabeza: null, lineas: [] };
  L.forEach((l, k) => {
    if (bloque && k >= bloque.desde && k <= bloque.hasta) {
      if (k === bloque.desde) { secciones.push(actual); actual = { cabeza: '__pedido', lineas: [] }; }
      if (k === bloque.hasta) { secciones.push(actual); actual = { cabeza: null, lineas: [] }; }   // lo que sigue ya es el encargo
      return;
    }
    if (esEncabezado(l)) { secciones.push(actual); actual = { cabeza: l, lineas: [] }; return; }
    actual.lineas.push(l);
  });
  secciones.push(actual);
  const esDePreguntas = (c) => {
    if (!c || c === '__pedido') return false;
    const p = plano(String(c).replace(/[:(—–].*$/, ''));
    return CITA.seccionesConPreguntas.some((h) => p === h || p.startsWith(`${h} `));
  };
  const out = [];
  for (const s of secciones.filter((x) => esDePreguntas(x.cabeza))) {
    const intro = String(s.cabeza).replace(/^[^:]*:/, '').trim();
    const items = [];
    for (const l of s.lineas) {
      if (RE_ITEM.test(l)) items.push([l]);
      else if (items.length) items[items.length - 1].push(l);
    }
    if (items.length) items.forEach((it) => out.push({ etiqueta: corta(it[0], 70), texto: it.join('\n') }));
    else {
      const t = [intro, ...s.lineas].join('\n').trim();
      if (t) out.push({ etiqueta: corta(String(s.cabeza), 70), texto: t });
    }
  }
  if (!out.length) {
    const resto = secciones.filter((s) => s.cabeza !== '__pedido').map((s) => [s.cabeza || '', ...s.lineas].join('\n')).join('\n').trim();
    if (resto) out.push({ etiqueta: 'el encargo (no tiene una sección de preguntas)', texto: resto });
  }
  return out;
}

/** El transcript de la sesion: el del payload o, si no vino, ~/.claude/projects/C--Dev-BarackMercosul*\/<sesion>.jsonl. */
export function rutaTranscript(payload, home = os.homedir()) {
  if (payload?.transcript_path) return payload.transcript_path;
  const sid = String(payload?.session_id || '');
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(sid)) return null;
  const dir = path.join(home, '.claude', 'projects');
  try {
    for (const d of fs.readdirSync(dir)) {
      if (!d.startsWith('C--Dev-BarackMercosul')) continue;
      const f = path.join(dir, d, `${sid}.jsonl`);
      if (fs.existsSync(f)) return f;
    }
  } catch { /* sin carpeta de proyectos */ }
  return null;
}

/**
 * Los mensajes REALES de Fak de la sesion (mensajesDeFak: sin avisos de la app adelante, sin resultados de herramientas,
 * sin los automaticos de la lista unica no_es_de_fak) menos los prefijos locales del canon (un encargo de otra sesion,
 * el «Background» con que arranca una hija). null si el transcript no se puede leer.
 */
export function mensajesDeFakDeLaSesion(payload, home = os.homedir()) {
  const ruta = rutaTranscript(payload, home);
  if (!ruta) return null;
  const ms = mensajesDeFak(ruta, { colaBytes: CITA.colaBytes });
  return ms ? filtrarLocales(ms) : null;
}
const filtrarLocales = (ms) => ms.filter((m) => !CITA.noEsDeFakLocal.prefijos.some((p) => String(m.texto).trimStart().startsWith(p)))
  .slice(-CITA.maxMensajes);

/** Una linea por caso en ~/.claude/.encargo-cita.log (fecha, sesion, tool, tipo, resultado, nivel, detalle). */
function anotar(home, campos) {
  try {
    const f = path.join(home, '.claude', CITA.registro);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.appendFileSync(f, `${campos.map((c) => String(c ?? '-').replace(/\s+/g, ' ').slice(0, 400)).join('\t')}\n`);
  } catch { /* el registro no puede frenar un lanzamiento */ }
}

/**
 * Revisa la cita de Fak de un lanzamiento. Va DESPUES de decidir() (`r` es su resultado): si decidir bloqueo, uso el
 * escape o el destino es un subagente propio, no hay nada que revisar. Devuelve null (no aplica) o
 * { resultado, nivel: 'ok'|'aviso'|'freno', faltan, texto, detalle }.
 *   resultado: exento | cita rastreada | cita no rastreada | sin cita | trabajo propio | sin transcript
 * `mensajes` ([{ts, texto}]) y `ahora` se inyectan en los tests; `home` es donde va el registro.
 */
export function revisarCita(payload, r = { ok: true }, { ahora = new Date(), home = os.homedir(), mensajes } = {}) {
  if (!r?.ok || r.escape || r.subagentePropio) return null;
  const tool = payload?.tool_name;
  const inp = payload?.tool_input || {};
  let prompt; let tipo; let canal;
  if (LANZA_AGENTE.has(tool)) { prompt = inp.prompt; tipo = inp.subagent_type || 'general-purpose'; canal = 'agente'; }
  else if (tool === 'mcp__ccd_session__start_session') { prompt = inp.prompt; tipo = 'sesion hija'; canal = 'encargo'; }
  else if (tool === 'SendMessage' || tool === 'mcp__ccd_session_mgmt__send_message') {
    prompt = inp.message || inp.content || '';
    if (typeof prompt !== 'string' || !RE_MARCADOR.test(prompt)) return null;   // solo los encargos a otra sesion
    tipo = 'otra sesion'; canal = 'encargo';
  } else return null;
  if (typeof prompt !== 'string' || !prompt.trim()) return null;

  const fecha = new Date(ahora.getTime() + CITA.husoHorasUTC * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  const registro = (resultado, nivel, detalle) => anotar(home, [fecha, payload?.session_id, tool, tipo, resultado, nivel, detalle]);

  // Exentos del informe 01, solo para Agent/Task: los que ya reciben el pedido textual o no traducen un pedido.
  if (canal === 'agente') {
    const n = normalizar(prompt).trim();
    const motivo = CITA.tiposExentos.includes(tipo) ? `tipo ${tipo}`
      : prompt.length < CITA.mecanicoLargoMenorA ? `paso mecánico (${prompt.length} caracteres)`
        : CITA.mecanicoArranques.some((a) => n.startsWith(a)) ? 'paso mecánico (arranque)' : null;
    if (motivo) { registro('exento', 'ok', motivo); return { resultado: 'exento', nivel: 'ok', faltan: [], texto: [], detalle: motivo }; }
  }

  let msgs; let leidos = false;
  const leer = () => {
    if (!leidos) {
      leidos = true;
      const crudos = mensajes ? filtrarLocales(mensajes) : mensajesDeFakDeLaSesion(payload, home);
      msgs = crudos ? crudos.map((m, i) => preparar(m.texto, { ts: m.ts, desdeElUltimo: crudos.length - 1 - i })) : null;
    }
    return msgs;
  };

  const bloque = bloquePedido(prompt);
  const faltan = [];
  let resultado; let porQue = ''; let citas = []; const origen = [];
  if (!bloque) {
    resultado = 'sin cita';
    faltan.push('no hay un renglón «PEDIDO DE FAK: "<frase textual de Fak>"»');
  } else if (normalizar(bloque.texto).trim().startsWith(CITA.ninguno)) {
    const m = bloque.texto.match(/trabajo propio\s*:?\s*([^)]*)/i);
    porQue = m ? m[1].trim() : '';
    if (porQue.length >= CITA.minLetrasPorQue) resultado = 'trabajo propio';
    else { resultado = 'sin cita'; faltan.push('«PEDIDO DE FAK: ninguno» va con su por qué: «ninguno (trabajo propio: <por qué>)»'); }
  } else {
    citas = [...bloque.texto.matchAll(RE_COMILLAS)].map((m) => (m[1] ?? m[2] ?? m[3]).trim()).filter(Boolean);
    const largas = citas.filter((c) => palabrasDe(c).length >= CITA.minPalabrasCita);
    if (!citas.length) { resultado = 'sin cita'; faltan.push('el renglón PEDIDO DE FAK no trae su frase entre comillas: un resumen con tus palabras no es la frase de Fak'); }
    else if (!largas.length) { resultado = 'sin cita'; faltan.push(`la cita tiene menos de ${CITA.minPalabrasCita} palabras: no alcanza para saber qué pidió`); }
    else if (leer() === null) resultado = 'sin transcript';
    else if (!msgs.length) { resultado = 'cita no rastreada'; faltan.push('esta sesión no tiene ningún mensaje de Fak (una hija o un worktree): su frase vive en la sesión que te lanzó'); }
    else {
      for (const c of largas) {
        const rc = rastrearCita(c, msgs);
        if (rc.ok) origen.push(...rc.de); else faltan.push(rc.motivo);
      }
      resultado = faltan.length ? 'cita no rastreada' : 'cita rastreada';
    }
  }

  // Cada pregunta con su ancla (no se pide en el trabajo propio: no hay frase de la que salir).
  const anclas = { saleDe: 0, agregado: 0 };
  if (resultado !== 'trabajo propio') {
    const contraCita = citas.map((c) => preparar(c));
    for (const q of preguntasDe(prompt, bloque)) {
      const sale = [...q.texto.matchAll(RE_SALE_DE)].map((m) => (m[1] ?? m[2] ?? m[3]).trim());
      const agregado = RE_AGREGADO.test(q.texto);
      if (agregado) anclas.agregado++;
      if (!sale.length && !agregado) { faltan.push(`«${q.etiqueta}» no dice de qué frase sale: falta [sale de: "<trozo de la frase>"] o [agregado mío]`); continue; }
      for (const t of sale) {
        anclas.saleDe++;
        const ok = rastrearPedazo(t, contraCita) || (leer() && rastrearPedazo(t, msgs));
        if (!ok) faltan.push(`el ancla [sale de: "${corta(t, 60)}"] de «${q.etiqueta}» no está en la cita ni en un mensaje de Fak`);
      }
    }
  }

  let nivel;
  if (resultado === 'trabajo propio' || resultado === 'sin transcript') nivel = 'aviso';
  else if (!faltan.length) nivel = 'ok';
  else nivel = frena(ahora) ? 'freno' : 'aviso';

  const donde = origen.map((o) => `de=${o.mensaje.desdeElUltimo} ${o.metodo} ${o.cobertura.toFixed(2)}`).join(' | ');
  const detalle = [donde, `anclas=${anclas.saleDe} agregados=${anclas.agregado}`, porQue && `por que: ${porQue}`, ...faltan].filter(Boolean).join(' ; ');
  registro(resultado, nivel, detalle);
  if (nivel === 'ok') return { resultado, nivel, faltan, texto: [], detalle };

  const desc = corta(inp.description || inp.title || tipo, 60);
  const texto = [];
  if (resultado === 'trabajo propio') {
    texto.push(`[COORDINADOR-GUARD — AVISO] «${desc}» sale como trabajo propio, sin pedido de Fak detrás: ${corta(porQue, 160)}.`,
      '  Si en realidad sale de algo que pidió Fak, va su frase textual: PEDIDO DE FAK: "<su frase>".');
    return { resultado, nivel, faltan, texto, detalle };
  }
  if (resultado === 'sin transcript') {
    texto.push(`[COORDINADOR-GUARD — AVISO] no pude leer el transcript de esta sesión: la cita de «${desc}» no se rastreó contra los mensajes de Fak.`);
    faltan.forEach((f) => texto.push(`  · ${f}`));
    return { resultado, nivel, faltan, texto, detalle };
  }
  texto.push(nivel === 'freno'
    ? `[COORDINADOR-GUARD — FRENO] «${desc}» no trae la frase de Fak rastreada a su mensaje (${resultado}).`
    : `[COORDINADOR-GUARD — AVISO, hasta el ${CITA.avisoHasta.slice(8, 10)}/${CITA.avisoHasta.slice(5, 7)}; desde el día siguiente frena] «${desc}»: ${resultado}.`);
  texto.push('  Qué falta:');
  faltan.forEach((f) => texto.push(`    · ${f}`));
  texto.push('  El formato (ítem 6g del viernes 23/10):',
    '    PEDIDO DE FAK: "<su frase, copiada TAL CUAL de su mensaje: con su tipeo se rastrea siempre; corregida, a veces no>"',
    '    1. <pregunta> [sale de: "<el trozo de esa frase>"]',
    '    2. <pregunta> [agregado mío]',
    '    Sin pedido de Fak detrás (una auditoría que decidís vos): PEDIDO DE FAK: ninguno (trabajo propio: <por qué>)');
  const ultimo = leer()?.[msgs.length - 1];
  if (ultimo) texto.push(`  El último mensaje de Fak (${horaAR(ultimo.ts)}), textual: «${corta(ultimo.texto, 300)}»`);
  texto.push(`  Por qué: ${POR_QUE_6G}`);
  return { resultado, nivel, faltan, texto, detalle };
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
  if (!r.ok) {
    console.error(`\n[COORDINADOR-GUARD — BLOQUEO] ${r.titulo}\n`);
    r.lineas.forEach((l) => console.error(l));
    console.error('');
    process.exit(2);
  }

  // 6g: la cita de Fak. Si el chequeo se rompe por dentro, avisa y deja pasar (un guardian que rompe el trabajo diario
  // porque falla el mismo se termina desactivando entero).
  let c = null;
  try { c = revisarCita(payload, r); } catch (e) {
    c = { nivel: 'aviso', texto: [`[COORDINADOR-GUARD — AVISO] el chequeo de la cita de Fak falló por dentro (${e?.message ?? e}) y no revisó este lanzamiento.`] };
  }
  if (c?.nivel === 'freno') {
    console.error(`\n${c.texto.join('\n')}\n`);
    process.exit(2);
  }

  // Los avisos van por additionalContext (JSON en stdout, exit 0), que es lo que el modelo lee; el stderr con exit 0 no
  // le llega. Hasta el 23/10/2026 el `aviso` de decidir() se descartaba aca.
  const avisos = [r.aviso ? `[COORDINADOR-GUARD — AVISO] ${r.aviso}` : null, c?.nivel === 'aviso' ? c.texto.join('\n') : null].filter(Boolean);
  if (!avisos.length) process.exit(0);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: avisos.join('\n\n') } }), () => process.exit(0));
}

if (process.argv[1]?.endsWith('coordinadorGuard.mjs')) main();
