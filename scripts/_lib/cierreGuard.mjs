/**
 * cierreGuard.mjs — gate de cierre de turno (hook Stop) + gate por bullet de LECCIONES.
 *
 * Nace el 04/09/2026 de medir dos semanas de chats (21/08 → 04/09): 375 turnos terminados en
 * texto, 32 con pedido de permiso para hacer mi propio trabajo y 20 de esos con Fak
 * contestando "hacelo" de alguna forma ("estas esperando que te diga ok nada mas", "no
 * arrancaste ni siquiera?"). Ademas 17 pedidos de "pasame la ruta" y un Stop hook viejo
 * (session-close-guard.sh) que devolvia exit 2 en 115 cierres, uno por turno con git sucio.
 * El 10/09/2026 (Ola A) suma dos chequeos, salidos de las 29 sesiones del 02 al 10/09: ~42
 * correcciones de Fak por afirmar o entregar sin abrir el resultado, ~17 por informe largo.
 *
 * Ocho cosas mide, en este orden, sobre el ULTIMO mensaje del asistente:
 *   1. la COLA (ultimos 500 caracteres) pide permiso  → exit 2 siempre
 *   2. en este turno escribi/copie algo afuera del repo y el texto no dice la RUTA → exit 2
 *   6. el ultimo parrafo ANUNCIA trabajo ("Sigo con eso.") y no corre nada en segundo plano que el
 *      texto diga esperar → exit 2 (22/09/2026: 19 empujes de Fak medidos, "sigo sigo sigo").
 *      Va antes del 3 porque un anuncio no es un cierre.
 *   7. el ultimo mensaje de Fak pedia que se lo explique ("no entiendo", "explicame", "faicl de entender":
 *      explicarGuard) y en el turno no cargue el skill `explicar-mejor`, ni mostre un dibujo o una pagina,
 *      ni entregue un archivo → exit 2 (02/10/2026: el skill estaba en la lista y conteste una tabla).
 *      Salida: un renglon "No aplica explicar-mejor: <motivo>". Si ademas bloquea el 1 o el 6, va en ese aviso.
 *   8. el mensaje dice que no tengo acceso a los mails de un companero ("el correo de Carlos no lo puedo leer, solo tengo
 *      acceso al tuyo") y en el turno no corrio `_mails.py --buscar|--buzones|--ver` (sin --solo-fak) ni abri nada de
 *      mails\_entrada → exit 2 (07/10/2026: eran falsas; los mails del equipo ya estan en la nube). Cualquier turno, no solo
 *      cierres. Salida: un renglon "No aplica mails-del-equipo: <motivo>". Frases en cierreCanon `mails_equipo`.
 *   3. el texto DECLARA cierre ("listo", "pusheado") y hay pendientes medibles → exit 2,
 *      una vez cada 20 minutos por sesion (cooldown), para no repetir el mismo texto. Entre los
 *      pendientes, desde el 02/10/2026: una pieza del sistema (hook, skill, regla, guardian) escrita y
 *      sin probar con un mensaje real de Fak, o un cierre que no dice si las sesiones abiertas la toman.
 *   4. declara cierre y en la sesion escribi un ENTREGABLE afuera del repo (pdf, xlsx, step…)
 *      que no abri despues de su ultima escritura → exit 2, una vez por (archivo, escritura).
 *      Desde el 10/10/2026 (H14) tambien lo de `exports/`, pero solo lo escrito en el turno y
 *      nombrado en el mensaje de cierre (`entregablesSinAbrir`).
 *   5. declara cierre y el mensaje es un INFORME (mas de 3.000 caracteres, 35 lineas o 2 tablas)
 *      → exit 2, 1x/20 min; exento si Fak pidio el detalle o la sesion esta en modo plan.
 *      Re-medido el 22/09/2026 contra 65 "no entendi / sintetiza" de Fak: el largo no separa los
 *      mensajes objetados de los que no, ni en cierres ni en todo turno (cierreCanon, _medicion_22_09).
 *      Desde el 10/10/2026 (H5) ese mismo aviso suma un renglon si lo que necesito de Fak no esta al
 *      inicio (`evaluarOrdenCierre`, canon `cierre_orden`): un aviso adentro de este freno, no un freno nuevo.
 *   Los frenos 3 y 5 suman ademas, para una sesion con una hora vigente, el aviso de las reglas de la tanda (HOY-17:
 *   2 horas sin un pedido a la API, o el latido con varios despertares sin avance): `avisoParaCierre`, tandaReglas.mjs.
 * Con stop_hook_active=true (segundo Stop del mismo turno) siempre deja pasar: sin loops.
 *
 * Toda frase vive en cierreCanon.data.json con su fuente (incidente + fecha). Una frase nueva
 * se agrega AHI, nunca como regex suelto aca (feedback_heuristicas_lista_canonica_no_regex_parcial).
 * Tests, en las dos direcciones y con textos reales: __tests__/scripts/cierreGuard*.test.mjs.
 *
 * El transcript se recorre UNA vez (`relevarTranscript`) y de esa pasada salen los cinco datos
 * que usan los chequeos 2 a 6: lo entregado afuera, los archivos del repo que ESTA sesion toco
 * (subagentes incluidos: viven en <sesion>/subagents/*.jsonl), los entregables y si se miraron,
 * el ultimo mensaje de Fak, y lo que sigue corriendo en segundo plano (lanzado y sin su
 * <task-notification> de fin). `archivosTocadosEnSesion` la expone para dev-server-guard.sh.
 *
 * "Archivos sin commitear" (chequeo 3), 30/09/2026: cuenta solo los archivos que ESTA sesion
 * ESCRIBIO —Write/Edit/MultiEdit/NotebookEdit y los comandos que escriben (`escrituraEnComando`:
 * redireccion, tee, sed -i, mv/cp/rm, git add, un interprete con una marca de escritura)—
 * cruzados con `git status --porcelain`. Nombrar un archivo en un cat o un grep no lo toca:
 * antes una sesion con 9 escritos figuraba con 465 "tocados" y el aviso listaba lo que dejo
 * sucio otra sesion. Si la sesion corrio algo que no se ubica (un interprete, un agente) y no
 * tiene ninguna escritura atribuible, se cuenta lo sucio modificado desde que arranco; sin
 * transcript, todo lo sucio, como siempre (fallar al lado seguro).
 *
 * Nota sobre el flag de Supabase: el guard viejo renombraba el flag a `.avisado` al recordarlo.
 * Aca se copia su contenido a `.avisado`, se vacia el flag y se conservan las dos fechas de
 * modificacion, asi _cierreSesion.mjs sigue viendo la misma "ultima escritura".
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { execSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { soloLineasDeComando, separarHeredocs, comandosSimples } from './shellTexto.mjs';
import { sinAvisosAdelante, esAutomatico } from './correccionGuard.mjs';
import { pideExplicar, pideEstado, CANON as CANON_EXPLICAR } from './explicarGuard.mjs';
import { esIngles } from './idioma.mjs';
import { avisoParaCierre } from './tandaReglas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(AQUI, '..', '..');
export const CANON = JSON.parse(fs.readFileSync(path.join(AQUI, 'cierreCanon.data.json'), 'utf8'));

const rx = (s, flags = 'i') => new RegExp(s, flags);
const PERMISO = CANON.permiso.map((p) => ({ ...p, regex: rx(p.re) }));
const EXCEPCIONES = CANON.excepciones.map((e) => ({ ...e, regex: rx(e.re) }));
const CIERRE = CANON.cierre_declarado.map((s) => rx(s));
const RUTA = CANON.ruta_en_texto.map((s) => rx(s));
const FUERA = CANON.fuera_del_repo.map((s) => rx(s));
const BASH_ENTREGA = rx(CANON.bash_que_entrega);
const SCRATCH = rx(CANON.scratch_re);
const TEMP = rx(CANON.temp_re);
const ENT = CANON.entregables;
const EXT_ENTREGABLE = rx(`\\.(${ENT.extensiones})$`);
const EXCLUIR_ENTREGABLE = rx(ENT.excluir_re);
const SALIDA_ANTES = rx(ENT.salida_antes_re);
const ESCRIBE = rx(ENT.escribe_re);
const MIRA = rx(ENT.mira_re);
const PIDE_DETALLE = rx(CANON.cierre_largo.pide_detalle_re);
const MEJ_SISTEMA = rx(CANON.mejora.sistema_re);
const MEJ_MENSAJES = rx(CANON.mejora.mensajes_re);
const MEJ_WORKTREE = /^\.claude\/worktrees\/[^/]+\//;
const MEJ_PRUEBA = rx(CANON.mejora.prueba_re);
const MEJ_SESIONES = rx(CANON.mejora.sesiones_re);

/** Sin markdown, sin acentos, espacios colapsados. Conserva mayusculas y los signos ¿?¡!. */
export function normalizar(texto) {
  return String(texto ?? '')
    .replace(/[*_`#>]+/g, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lo que importa es como TERMINA el mensaje: los ultimos `cola_chars` caracteres normalizados. */
export function cola(texto, n = CANON.cola_chars) {
  const t = normalizar(texto);
  return t.length > n ? t.slice(-n) : t;
}

/** ¿La cola pide permiso para hacer mi propio trabajo? Las excepciones ganan (esperar una
 *  accion fisica de Fak, un dato que solo el tiene, el OK de un mail). */
export function evaluarPermiso(texto) {
  const c = cola(texto);
  for (const e of EXCEPCIONES) {
    if (e.regex.test(c)) return { bloquea: false, excepcion: e.re, por: e.por };
  }
  for (const p of PERMISO) {
    const m = c.match(p.regex);
    if (m) return { bloquea: true, patron: p.re, fuente: p.fuente, frase: m[0] };
  }
  return { bloquea: false };
}

export function declaraCierre(texto) {
  const c = cola(texto);
  return CIERRE.some((r) => r.test(c));
}

/** Rutas se buscan en el texto CRUDO (las barras invertidas importan). */
export function tieneRuta(texto) {
  const t = String(texto ?? '');
  return RUTA.some((r) => r.test(t));
}

/** ¿El ultimo mensaje de Fak pide el detalle? Entonces un cierre largo no es un informe no pedido. */
export function pideDetalle(texto) {
  return PIDE_DETALLE.test(normalizar(texto));
}

// ---------------------------------------------------------------------------------------
// Chequeo 6: el turno termina ANUNCIANDO trabajo ("Sigo con eso.") y nada lo va a despertar
// ---------------------------------------------------------------------------------------

const AN = CANON.anuncio_sin_hacer;
const AN_ORACION = rx(AN.oracion_re);
const AN_EXCLUYE = rx(AN.excluye_re);
const AN_FRASE = rx(AN.frase_re);
const AN_TE_AVISO = rx(AN.te_aviso_re);
const AN_ESPERA = rx(AN.espera_re);

/** El ultimo parrafo del texto crudo (bloques separados por una linea en blanco). */
export function ultimoParrafo(texto) {
  return String(texto ?? '').trim().split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).at(-1) || '';
}

/** Oraciones normalizadas; el guion largo y los dos puntos tambien cortan ("Sigo: revierto…"). */
const oraciones = (p) => normalizar(p).split(/(?<=[.!?;:])\s+|\s+[—–-]\s+/).map((s) => s.trim()).filter(Boolean);

/**
 * Chequeo 6. ¿El ultimo parrafo ANUNCIA trabajo que el turno no hizo? Mira la primera y la ultima
 * oracion del parrafo (`oracion_re`, anclado al inicio) y dos formas sueltas (`frase_re`,
 * `te_aviso_re`). No bloquea si:
 *   - el parrafo tiene una pregunta (espera una respuesta de Fak; la de permiso es del chequeo 1),
 *   - hay trabajo en segundo plano sin su aviso de fin Y el texto dice que lo espera (`espera_re`),
 *   - o dice "te aviso cuando…" y ese trabajo se lanzo DESPUES del ultimo mensaje de Fak.
 * `bg` = { total, delTurno } de relevarTranscript. Un "Sigo con X" pelado mientras corre OTRA cosa
 * bloquea igual: e5b1b3cc 21/09 12:43, una busqueda en Y: corria desde las 12:21 y termino 15:15.
 */
export function evaluarAnuncio(texto, bg = {}) {
  const total = bg?.total ?? 0;
  const delTurno = bg?.delTurno ?? 0;
  const ult = ultimoParrafo(texto);
  const n = normalizar(ult);
  const os = oraciones(ult);
  const anuncia = (s) => AN_ORACION.test(s) && !AN_EXCLUYE.test(s);
  const frase = [os[0], os.at(-1)].find((s) => s && anuncia(s)) || n.match(AN_FRASE)?.[0] || n.match(AN_TE_AVISO)?.[0];
  if (!frase) return { bloquea: false };
  if (n.includes('?')) return { bloquea: false, motivo: 'pregunta' };
  if (total > 0 && AN_ESPERA.test(n)) return { bloquea: false, motivo: 'espera lo que corre en segundo plano' };
  if (delTurno > 0 && AN_TE_AVISO.test(n)) return { bloquea: false, motivo: 'te aviso + algo lanzado en este turno' };
  return { bloquea: true, frase: frase.slice(0, 140), motivo: total > 0 ? 'corre algo, pero el texto no dice que lo espera' : 'no corre nada en segundo plano' };
}

// Trabajo en segundo plano: lo lanzado (Bash/PowerShell con run_in_background, Agent asincrono,
// Workflow, Monitor, un agente retomado con SendMessage) sin su <task-notification> de fin.
// El id sale del toolUseResult (backgroundTaskId · agentId/taskId con status async_launched ·
// taskId+timeoutMs del Monitor) o, si falta, del texto del resultado. El aviso de fin llega como
// queue-operation, attachment o mensaje user segun la version: se lee de la linea CRUDA, y un
// mismo aviso puede cerrar varias tareas (el "__orphan_summary__" al retomar una sesion).
const RE_ID_TEXTO = [/Command running in background with ID: ([\w-]+)/, /agentId: ([\w-]+)/, /Monitor started \(task ([\w-]+)/, /Task ID: ([\w-]+)/];
const LANZA = /^(Bash|PowerShell|Agent|Task|Monitor|Workflow)$/;

export function nuevoBackground() {
  return { pend: new Map(), agentes: new Map(), usos: new Map() };
}

function textoResultado(c) {
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((x) => (typeof x === 'string' ? x : x?.text || '')).join('\n');
  return '';
}

/** Procesa UNA linea del transcript (objeto parseado + texto crudo) sobre el estado `bg`. */
export function registrarBackground(bg, obj, linea) {
  const ts = obj?.timestamp || '';
  if (String(linea).includes('<task-notification>')) {
    for (const trozo of String(linea).split('<task-notification>').slice(1)) {
      const bloque = trozo.split('</task-notification>')[0];
      const estado = bloque.match(/<status>([a-z_]+)<\/status>/)?.[1];
      if (!estado || estado === 'running') continue;          // eventos de Monitor: no son el fin
      for (const m of bloque.matchAll(/<task-id>([^<]+)<\/task-id>/g)) bg.pend.delete(m[1]);
    }
  }
  const contenido = obj?.message?.content;
  if (!Array.isArray(contenido)) return;
  if (obj.type === 'assistant') {
    for (const b of contenido) {
      if (b?.type !== 'tool_use') continue;
      const inp = b.input || {};
      if (LANZA.test(b.name || '')) {
        bg.usos.set(b.id, { name: b.name, desc: String(inp.description || inp.command || '').slice(0, 80), nombre: inp.name });
      } else if (b.name === 'SendMessage') {
        const id = bg.agentes.get(String(inp.to ?? ''));
        if (id) bg.pend.set(id, { desc: `agente ${inp.to} (retomado)`, ts });
      } else if (b.name === 'TaskStop') {
        bg.pend.delete(String(inp.task_id || inp.shell_id || ''));
      }
    }
  } else if (obj.type === 'user') {
    const r = obj.toolUseResult && typeof obj.toolUseResult === 'object' ? obj.toolUseResult : {};
    for (const b of contenido) {
      if (b?.type !== 'tool_result') continue;
      const uso = bg.usos.get(b.tool_use_id);
      if (!uso) continue;
      bg.usos.delete(b.tool_use_id);
      let id = r.backgroundTaskId
        || (r.status === 'async_launched' ? (r.agentId || r.taskId) : null)
        || (r.taskId && r.timeoutMs !== undefined ? r.taskId : null);
      if (!id && !b.is_error) {
        const t = textoResultado(b.content);
        for (const re of RE_ID_TEXTO) { const m = t.match(re); if (m) { id = m[1]; break; } }
      }
      if (!id) continue;
      bg.pend.set(id, { desc: `${uso.name}: ${uso.desc}`, ts });
      if (/^(Agent|Task)$/.test(uso.name)) {
        bg.agentes.set(id, id);
        if (uso.nombre) bg.agentes.set(String(uso.nombre), id);
      }
    }
  }
}

export function pendientesBackground(bg) {
  return [...bg.pend.entries()].map(([id, v]) => ({ id, ...v }));
}

/** Chequeo 5: ¿el mensaje es un informe? Tablas = bloques de lineas seguidas que arrancan con `|`. */
export function evaluarLargo(texto, cfg = CANON.cierre_largo) {
  const t = String(texto ?? '');
  const lineas = t.split(/\r?\n/);
  let tablas = 0;
  let enTabla = false;
  for (const l of lineas) {
    const es = /^\s*\|/.test(l);
    if (es && !enTabla) tablas++;
    enTabla = es;
  }
  const noVacias = lineas.filter((l) => l.trim()).length;
  const motivos = [];
  if (t.length > cfg.max_chars) motivos.push(`${t.length} caracteres (maximo ${cfg.max_chars})`);
  if (noVacias > cfg.max_lineas) motivos.push(`${noVacias} lineas (maximo ${cfg.max_lineas})`);
  if (tablas > cfg.max_tablas) motivos.push(`${tablas} tablas (maximo ${cfg.max_tablas})`);
  return { largo: motivos.length > 0, chars: t.length, lineas: noVacias, tablas, motivos };
}

// ---------------------------------------------------------------------------------------
// Aviso DENTRO del chequeo 5 (cola H5, 10/10/2026): el cierre empieza por lo que necesito de Fak
// ---------------------------------------------------------------------------------------
// El 05/10 Fak paso el consejo de cerrar cada corrida en tres partes: lo que esta frenado esperandolo a el, lo que
// cambio y lo que se encontro. Medido el 10/10: de 188 cierres desde el 01/10, 20 traian algo que necesitaba de el
// y casi siempre estaba despues del primer parrafo (con las frases que quedaron en el canon `cierre_orden`: 14 cierres, los 14 enterrados). NO es un freno (Fak, 09/10: "me preocupa que
// tenga muchos bloqueantes"): esta funcion solo MIDE, y `decidir` suma su renglon al aviso que el chequeo 5 ya da.
// Limite conocido y aceptado: un cierre corto no pasa por el chequeo 5 y no recibe el aviso (un hook Stop que deja
// pasar no le muestra nada al modelo). Medido por el auditor el 10/10: de esos 14 cierres, solo 1 era un informe; el
// aviso habria llegado en 1 de 14. Lo que maneja la conducta es el renglon de CLAUDE.md; esto es un recordatorio mas.
// Otros limites (auditor): mide por PARRAFO (un pedido al final de una lista sin lineas en blanco cuenta como del
// parrafo donde empieza la lista) y no conoce frases sin caso real, como "necesito tu OK para…".

const ORD = CANON.cierre_orden;
const ORD_NECESITO = ORD.necesito_re.map((p) => ({ ...p, regex: rx(p.re) }));
const ORD_NADA = rx(ORD.nada_re);
const ORD_TITULO = /^(#{1,6}\s+[^\n]+|\*\*[^*\n]+\*\*:?)$/;              // un parrafo que es solo un titulo
const ORD_RUTA_REL = /[\w.-]+\/[\w./-]*[\w-]+\.[a-z0-9]{2,5}\b/i;        // exports/X/hoja.pdf, docs/x.md

/**
 * ¿Donde dice el mensaje lo que necesita de Fak? Devuelve:
 *   necesita  — alguna frase de `necesito_re` aparece (false si antes el mensaje dice que no necesita nada: `nada_re`)
 *   alInicio  — esta en el primer parrafo, o en el segundo cuando el primero trae la RUTA del entregable
 *   parrafo / parrafos / frase — donde aparecio (1 = el primero) y con que palabras
 *   aviso     — necesita y NO esta al inicio: lo unico que `decidir` usa
 */
export function evaluarOrdenCierre(texto) {
  const parrafos = String(texto ?? '').trim().split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean);
  // "De vos no necesito nada" vale este donde este: es la salida honesta de todo el mensaje (auditor 10/10).
  if (ORD_NADA.test(normalizar(texto))) return { necesita: false, alInicio: false, aviso: false, motivo: 'dice que no necesita nada de Fak' };
  // Parrafos de gracia adelante: un titulo solo ("## Cierre", "**Resumen**") y el que trae la ruta del entregable,
  // absoluta o relativa (`exports/X/hoja.pdf`). Antes de eso no hay "inicio" que medir (auditor 10/10, H5).
  let tope = 0;
  if (parrafos[tope] && ORD_TITULO.test(parrafos[tope])) tope++;
  if (parrafos[tope] && (tieneRuta(parrafos[tope]) || ORD_RUTA_REL.test(parrafos[tope]))) tope++;
  for (let i = 0; i < parrafos.length; i++) {
    const n = normalizar(parrafos[i]);
    const hallada = ORD_NECESITO.map((p) => n.match(p.regex)).find(Boolean);
    if (!hallada) continue;
    const alInicio = i <= tope;
    return { necesita: true, alInicio, aviso: !alInicio, parrafo: i + 1, parrafos: parrafos.length, frase: hallada[0] };
  }
  return { necesita: false, alInicio: false, aviso: false };
}

// ---------------------------------------------------------------------------------------
// Gate por bullet de docs/LECCIONES_APRENDIDAS.md
// ---------------------------------------------------------------------------------------

/**
 * Un bullet arranca con "- " en columna 0, sigue mientras las lineas vengan indentadas y
 * se corta en una linea en blanco, un titulo o un parrafo. Devuelve los que NO pasan:
 *   - mas de `bullet_max_chars` caracteres (el detalle se gradua, no se recorta)
 *   - dice "graduado a X" y ocupa mas de `graduado_max_lineas` lineas (lo graduado no
 *     conserva su narrativa aca)
 * La cabecera del archivo (Snapshots, Tabla incidente) no cuenta como leccion.
 */
export function evaluarBullets(texto, cfg = CANON.lecciones) {
  const lineas = String(texto ?? '').split(/\r?\n/);
  const bullets = [];
  let actual = null;
  const cerrar = () => { if (actual) { bullets.push(actual); actual = null; } };
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (/^- /.test(l)) { cerrar(); actual = { linea: i + 1, lineas: [l.slice(2)] }; continue; }
    if (actual && /^\s+\S/.test(l)) { actual.lineas.push(l.trim()); continue; }
    cerrar();
  }
  cerrar();

  const graduado = rx(cfg.graduado_re);
  const excluir = /^\*{0,2}(Snapshots|Tabla incidente)/i;
  const malos = [];
  for (const b of bullets) {
    const inicio = b.lineas[0];
    if (excluir.test(inicio)) continue;
    const textoB = b.lineas.join(' ');
    const chars = textoB.length;
    const nLineas = b.lineas.length;
    let motivo = null;
    if (chars > cfg.bullet_max_chars) {
      motivo = `tiene ${chars} caracteres (maximo ${cfg.bullet_max_chars}): el detalle se gradua a memoria/regla/snapshot, no se recorta`;
    } else if (graduado.test(normalizar(textoB)) && nLineas > cfg.graduado_max_lineas) {
      motivo = `dice "graduado a" y ocupa ${nLineas} lineas (maximo ${cfg.graduado_max_lineas}): lo graduado no conserva su narrativa aca`;
    }
    if (motivo) malos.push({ linea: b.linea, inicio: inicio.slice(0, 70), chars, lineas: nLineas, motivo });
  }
  return malos;
}

// ---------------------------------------------------------------------------------------
// Rutas: adentro / afuera del repo, scratchpad, TEMP
// ---------------------------------------------------------------------------------------

/** `/c/Dev/x` (Git Bash) → `C:\Dev\x`. Lo demas queda como vino. */
function aWindows(r) {
  let s = String(r ?? '').trim();
  const m = s.match(/^\/([a-z])\/(.*)$/i);
  if (m) s = `${m[1].toUpperCase()}:\\${m[2].replace(/\//g, '\\')}`;
  return s;
}
/** `C:\x` o `\\server\x` siempre; y `/home/x` cuando el repo tambien arranca en `/`
 *  (el runner del CI es Linux: sin esto toda ruta absoluta se leia como relativa y la
 *  lista de tocados salia vacia). El criterio sale del repo, no de `process.platform`. */
const esAbsoluta = (r, repo = REPO) => /^[a-z]:[\\/]/i.test(r) || /^\\\\/.test(r)
  || (r.startsWith('/') && aWindows(String(repo ?? '')).startsWith('/'));
const rutaLarga = (p) => { try { return fs.realpathSync.native(p); } catch { return p; } };

const repoNormalizado = new Map();
function normRepo(repo) {
  const k = repo ?? REPO;
  if (!repoNormalizado.has(k)) {
    repoNormalizado.set(k, rutaLarga(aWindows(k)).replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase());
  }
  return repoNormalizado.get(k);
}

/** Relativa (con /) si la ruta ABSOLUTA cae dentro del repo, o null. Resuelve nombres cortos 8.3
 *  (`FACUND~1`) solo si hace falta: el repo real no los tiene, los repos temporales de los tests si. */
function dentroDelRepo(rutaWin, repo) {
  const base = normRepo(repo);
  let norm = rutaWin.replace(/\//g, '\\');
  if (!norm.toLowerCase().startsWith(`${base}\\`) && norm.includes('~')) {
    const dir = path.win32.dirname(norm);
    const largo = rutaLarga(dir);
    if (largo !== dir) norm = path.win32.join(largo, path.win32.basename(norm));
  }
  if (!norm.toLowerCase().startsWith(`${base}\\`)) return null;
  return norm.slice(base.length + 1).replace(/\\/g, '/');
}

function esRutaFuera(ruta, repo = REPO) {
  if (!ruta) return false;
  const r = aWindows(ruta);
  if (!esAbsoluta(r, repo)) return false;            // relativa = dentro del repo
  if (dentroDelRepo(r, repo) !== null) return false;
  if (SCRATCH.test(r) || TEMP.test(r)) return false;
  return FUERA.some((f) => f.test(r));
}

/** Un tool_use que deja algo afuera del repo: Write/Edit con ruta de afuera, o un Bash que
 *  copia/entrega hacia una ruta de afuera. Devuelve una descripcion corta o null. */
export function evaluarToolUse(bloque, repo = REPO) {
  const nombre = bloque?.name || '';
  const input = bloque?.input || {};
  if (/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(nombre)) {
    const ruta = input.file_path || input.notebook_path;
    return esRutaFuera(ruta, repo) ? `${nombre} ${ruta}` : null;
  }
  if (/^(Bash|PowerShell)$/.test(nombre)) {
    const cmd = String(input.command || '');
    // Lo que entrega es la LINEA de comando: el cuerpo de un heredoc y el mensaje de un
    // `git commit -m "..."` son prosa (falsos positivos del 05/09 y 10/09). Las rutas del
    // scratchpad y del TEMP se sacan antes de mirar si el comando apunta afuera.
    const linea = soloLineasDeComando(cmd);
    const sinTemp = linea.split(/\s+/).filter((t) => !SCRATCH.test(t) && !TEMP.test(t)).join(' ');
    if (BASH_ENTREGA.test(sinTemp) && FUERA.some((f) => f.test(sinTemp))) return `${nombre}: ${cmd.slice(0, 120)}`;
  }
  return null;
}

/** Ruta repo-relativa (con /) de un Write/Edit DENTRO del repo, o null. */
export function rutaRelativaAlRepo(bloque, repo = REPO) {
  if (!/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(bloque?.name || '')) return null;
  const r = aWindows(bloque.input?.file_path || bloque.input?.notebook_path || '');
  if (!esAbsoluta(r, repo)) return null;
  return dentroDelRepo(r, repo);
}

const EXT_CODIGO = /\.(ts|tsx|js|jsx|mjs|css|json|md|py|sh)$/i;
const RE_TOKEN_RUTA = /^[\w@.\-]+(?:\/[\w@.\-]+)*$/;

/** Rutas del repo que NOMBRA un comando Bash/PowerShell: `sed -i … scripts/x.mjs`, `cat > docs/x.md`,
 *  `python scripts/_arb.py`, `git add a b`. Relativas con extension de codigo, o absolutas dentro
 *  del repo (se relativizan). No mira el disco, asi cuenta tambien lo borrado. Un token que sube
 *  con `..` (imports dentro de un heredoc) no se puede ubicar y se salta; URLs y rutas de afuera
 *  tampoco entran. Sobreincluir es barato: solo cuenta si ademas esta sucio en git. */
export function rutasRepoEnComando(cmd, repo = REPO) {
  const out = new Set();
  for (const t of String(cmd || '').split(/\s+/)) {
    const r = rutaDeToken(t, repo);
    if (r) out.add(r);
  }
  return out;
}

/** Ruta repo-relativa (con /) si UN token nombra un archivo de codigo del repo; null si no (sin extension
 *  de codigo, URL, `..`, o absoluta de afuera). No mira el disco. */
function rutaDeToken(t, repo = REPO) {
  t = String(t ?? '').replace(/^["'`(]+|["'`),;:]+$/g, '');
  if (!t || !EXT_CODIGO.test(t)) return null;
  const rel = rutaRelativaAlRepo({ name: 'Write', input: { file_path: t } }, repo);
  if (rel) return rel;
  if (/^[a-z]:[\\/]/i.test(t) || t.startsWith('\\\\') || t.startsWith('/')) return null;   // absoluta, afuera del repo
  const n = t.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!RE_TOKEN_RUTA.test(n) || n.split('/').includes('..')) return null;
  return n;
}

// ---------------------------------------------------------------------------------------
// Que ESCRIBE un comando (pendientes de ESTA sesion, 30/09/2026)
// ---------------------------------------------------------------------------------------
// `rutasRepoEnComando` cuenta todo archivo NOMBRADO: un cat, un grep o un node --check lo
// vuelven "tocado" (25 transcripts con el aviso: 9 archivos escritos figuraban como 465, y la
// mayoria de los avisos listaban lo que OTRA sesion dejo sucio). `escrituraEnComando` cuenta
// solo lo que el comando ESCRIBE; lo que no se puede ubicar es OPACO. Las listas de verbos
// viven en cierreCanon.data.json (`escrituras`), no como regex.

const ESC = CANON.escrituras;
const aSet = (a) => new Set(a ?? []);
const conjuntosPorVerbo = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, aSet(v)]));
const V_LECTORES = aSet(ESC.lectores);
const V_LECTOR_OPC = conjuntosPorVerbo(ESC.lectores_con_opcion_que_escribe);
const V_INTERP_LEE = conjuntosPorVerbo(ESC.interpretes_que_leen);
const V_CD = aSet(ESC.cd);
const V_ESCRIBEN = aSet(ESC.escriben_todo);
const V_BORRAN = aSet(ESC.borran);
const V_MUEVEN = aSet(ESC.mueven);
const V_COPIAN = aSet(ESC.copian);
const V_SED = aSet(ESC.sed_en_sitio);
const V_GIT_LEE = aSet(ESC.git_lee);
const V_GIT_RUTAS = aSet(ESC.git_escribe_rutas);
const V_GIT_CHECKOUT = aSet(ESC.git_checkout);
const V_GIT_ADD_TODO = aSet(ESC.ruta_que_no_se_puede_ubicar.git_add_todo);
const RE_CODIGO_ESCRIBE = ESC.codigo_que_escribe.re.map((s) => new RegExp(s, 'i'));
const NPM = { lee: aSet(ESC.npm.lee), runLee: aSet(ESC.npm.run_lee), npxLee: aSet(ESC.npm.npx_lee), escriben: aSet(ESC.npm.opciones_que_escriben) };
const ENVOLTORIOS = new Set(['sudo', 'command', 'builtin', 'exec', 'nohup', 'nice', 'time', 'stdbuf', 'then', 'do', 'else', 'elif', 'if', '!', '&', '{']);

const INTERPRETES = new Set(['node', 'python', 'python3', 'py', 'bash', 'sh', 'zsh', 'pwsh', 'powershell', 'ruby', 'perl', 'deno', 'bun']);
// Candidatos a ruta dentro de un texto de codigo: corridas de caracteres de ruta, aunque vengan pegadas a
// comillas o a `p=` (`p='docs/x.md'`, `r"C:\Dev\x.py"`): en un script pegado nadie las separa con espacios.
// Se parte el texto (lineal) en vez de buscar con un regex anidado: un script con un blob base64 de 50 KB
// haria explotar el backtracking de ese regex (n^2) en el hook Stop. Una corrida de mas de 400 no es una ruta.
const SEPARADOR_DE_RUTAS = /[^\w@.:\\/-]+/;
function rutasEnCodigo(texto) {
  const out = [];
  for (let t of String(texto ?? '').split(SEPARADOR_DE_RUTAS)) {
    if (t.length < 4 || t.length > 400) continue;
    t = t.replace(/^:+|[.:]+$/g, '');                 // "…en docs/x.md." al final de una oracion
    if (t) out.push(t);
  }
  return out;
}
// Una variable, un comodin o una sustitucion donde deberia ir el archivo. Un texto con espacios (el
// contenido de un Set-Content, una frase) no es una ruta: no cuenta como incognita.
const tieneIncognita = (t) => /[$*`(]/.test(t) && !/\s/.test(t);
const esOpcion = (a) => /^-/.test(a);
const sinExt = (a) => !/\.[A-Za-z0-9]+$/.test(a);

/**
 * Lo que un comando Bash/PowerShell ESCRIBE dentro del repo.
 *   escritos: Set de rutas repo-relativas (con /) de archivos de codigo que el comando escribe, borra,
 *             mueve, copia o agrega al indice de git (`git add`).
 *   soloIndice: de esos, los que el comando solo agrego al indice (`git add x`): su contenido no cambio.
 *   opaco:    true si el comando puede escribir en un lugar que no se ubica: un interprete que corre
 *             codigo (python, node x.mjs, bash), un comodin o una variable como destino, `git add .`,
 *             un verbo que ninguna lista conoce. Un comando que solo LEE no es opaco.
 * No mira el disco. Un `cd` a otra carpeta hace opaca toda ruta relativa que venga despues.
 */
export function escrituraEnComando(cmd, repo = REPO) {
  const escritos = new Set();
  let opaco = false;
  let nombrar = false;                                              // corrio codigo: lo que ese codigo NOMBRA puede estar escrito
  let movido = false;
  const ejecutados = new Set();                                     // el script que un interprete EJECUTA no es un archivo que escribe
  const corre = (script) => {
    opaco = true;
    nombrar = true;
    const r = script === undefined ? null : rutaDeToken(script, repo);
    if (r) ejecutados.add(r);
  };
  const alIndice = new Set();                                       // `git add x`: entra al indice de git, su contenido no cambia
  const contenido = new Set();
  const atribuir = (tok, soloAlIndice = false) => {
    if (tieneIncognita(tok)) { opaco = true; return; }
    const r = rutaDeToken(tok, repo);
    if (!r) return;
    escritos.add(r);
    (soloAlIndice ? alIndice : contenido).add(r);
    if (movido && !/^([a-z]:|[\\/])/i.test(tok)) opaco = true;
  };
  const esRaiz = (t) => /git\s+rev-parse\s+--show-toplevel/.test(t)
    || aWindows(t).replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase() === normRepo(repo);
  const { lineas } = separarHeredocs(cmd);
  for (const c of comandosSimples(lineas)) {
    for (const r of c.redirs) if (/^&?>/.test(r.op)) atribuir(r.t);
    let p = c.palabras.slice();
    while (p.length) {
      if (/^[A-Za-z_][A-Za-z0-9_]*\+?=/.test(p[0])) { p.shift(); continue; }
      if (/^\$\w+$/.test(p[0]) && p[1] === '=') { p = p.slice(2); continue; }   // $x = ... (PowerShell)
      if (ENVOLTORIOS.has(p[0].toLowerCase())) { p.shift(); continue; }
      if (/^(env|timeout)$/i.test(p[0])) { p.shift(); while (p.length && (esOpcion(p[0]) || /^\d+[smhd]?$/.test(p[0]) || /^[A-Za-z_]\w*=/.test(p[0]))) p.shift(); continue; }
      break;
    }
    if (!p.length) continue;
    const verbo = p[0].replace(/^.*[\\/]/, '').replace(/\.exe$/i, '').toLowerCase();
    const args = p.slice(1);
    const noOpc = args.filter((a) => !esOpcion(a));
    if (verbo.startsWith('$')) continue;                            // `$_.Name -like ...` (PowerShell): una expresion, no un comando

    if (V_CD.has(verbo)) {
      const dest = noOpc[0];
      if (dest !== undefined && !esRaiz(dest)) movido = true;
      continue;
    }

    if (verbo === 'git') {
      let k = 0;
      let otraCarpeta = false;
      while (k < args.length && esOpcion(args[k])) { if (args[k] === '-C') otraCarpeta = true; k += /^-[cC]$/.test(args[k]) ? 2 : 1; }
      const sub = (args[k] ?? '').toLowerCase();
      const resto = args.slice(k + 1);
      if (sub === '' || V_GIT_LEE.has(sub)) continue;               // `git --version`, status, diff, log, commit...
      if (otraCarpeta) { opaco = true; continue; }
      if (V_GIT_RUTAS.has(sub)) {
        for (const a of resto) {
          if (V_GIT_ADD_TODO.has(a)) { opaco = true; continue; }        // `-A`, `.`, `-u`: todo el arbol (antes del filtro de opciones: -A es una opcion)
          if (esOpcion(a) || a === '--') continue;
          if (tieneIncognita(a) || sinExt(a)) { opaco = true; continue; }   // una carpeta, un comodin, una variable
          atribuir(a, sub === 'add');
        }
        continue;
      }
      if (V_GIT_CHECKOUT.has(sub)) {
        const i = resto.indexOf('--');
        if (i >= 0) { for (const a of resto.slice(i + 1)) { if (sinExt(a) || tieneIncognita(a)) opaco = true; else atribuir(a); } continue; }
        if (resto.some((a) => /^-[bBcC]$/.test(a))) continue;      // crear rama no cambia archivos
        opaco = true;                                               // cambia de rama o restaura: no se ubica
        continue;
      }
      opaco = true;                                                 // stash, pull, merge, reset, apply...: no se ubica
      continue;
    }

    if (V_BORRAN.has(verbo)) {
      const cmdEstilo = verbo === 'del' || verbo === 'rd' || verbo === 'erase';
      for (const a of noOpc.filter((x) => !(cmdEstilo && /^\/[A-Za-z]$/.test(x)))) {
        if (tieneIncognita(a) || sinExt(a)) opaco = true; else atribuir(a);   // una carpeta se lleva archivos que no se ven
      }
      continue;
    }
    if (V_MUEVEN.has(verbo)) {
      for (const a of noOpc) {
        if (tieneIncognita(a) || (sinExt(a) && !/^([a-z]:|[\\/])/i.test(a))) opaco = true; else atribuir(a);
      }
      continue;
    }
    if (V_COPIAN.has(verbo)) {
      const i = args.findIndex((a) => /^(-t|--target-directory|-destination|-dest)$/i.test(a));
      const dest = i >= 0 ? args[i + 1] : noOpc[noOpc.length - 1];
      if (dest === undefined) continue;
      if (tieneIncognita(dest)) opaco = true;
      else if (sinExt(dest)) { if (!/^([a-z]:|[\\/])/i.test(dest)) opaco = true; }   // carpeta de adentro: el nombre sale del origen
      else atribuir(dest);
      continue;
    }
    if (V_ESCRIBEN.has(verbo)) {
      for (const a of noOpc) atribuir(a);
      continue;
    }
    if (V_SED.has(verbo)) {
      const enSitio = args.some((a) => /^-[A-Za-z]*i[A-Za-z0-9.]*$/.test(a) || /^--in-place/.test(a));
      if (enSitio) {
        // El guion del script no es un archivo: es el valor de -e/-f, o el primer argumento sin opcion.
        const scripts = new Set();
        args.forEach((a, i) => { if (/^(-e|-f|--expression|--file)$/.test(a) && args[i + 1] !== undefined) scripts.add(i + 1); });
        let saltado = scripts.size > 0;
        args.forEach((a, i) => {
          if (esOpcion(a) || scripts.has(i)) return;
          if (!saltado) { saltado = true; return; }
          atribuir(a);
        });
        continue;
      }
      if (verbo === 'sed') continue;                                // sed sin -i solo imprime
      corre();                                                      // perl sin -i corre codigo
      continue;
    }
    if (V_LECTOR_OPC[verbo]) {
      const dispara = args.findIndex((a) => V_LECTOR_OPC[verbo].has(a));
      if (dispara >= 0) {
        if (/^(sort|curl|wget)$/.test(verbo) && args[dispara + 1] !== undefined) atribuir(args[dispara + 1]); else corre();
      }
      continue;
    }
    if (V_LECTORES.has(verbo)) continue;
    if (V_INTERP_LEE[verbo]) {
      if (!args.some((a) => V_INTERP_LEE[verbo].has(a))) corre(noOpc[0]);
      continue;
    }
    if (verbo === 'npx') {
      const primero = noOpc[0];
      if (!(NPM.npxLee.has(primero) && !args.some((a) => NPM.escriben.has(a)))) corre();
      continue;
    }
    if (/^(npm|pnpm|yarn)$/.test(verbo)) {
      const sub = noOpc[0];
      const lee = (sub === 'run' || sub === 'run-script') ? NPM.runLee.has(noOpc[1]) : NPM.lee.has(sub) || NPM.runLee.has(sub);
      if (!(lee && !args.some((a) => NPM.escriben.has(a)))) corre();
      continue;
    }
    corre(INTERPRETES.has(verbo) ? noOpc[0] : undefined);           // verbo que ninguna lista conoce (bash x.sh, pwsh, un .exe): no se ubica lo que escribe
  }
  // Un interprete que corrio codigo (python - <<EOF ... open('docs/x.md','w')) puede haber escrito los archivos
  // que NOMBRA: es como editan las sesiones cuando no usan Edit (d5ac4fb1 y deeb4d2b, 09/2026). Solo si ese
  // mismo comando tiene una marca de escritura (canon `codigo_que_escribe`): un py -c que lee un json y lo
  // imprime nombra el archivo sin tocarlo. Un comando que solo lee no entra aca: nombrar no es tocar.
  if (nombrar && RE_CODIGO_ESCRIBE.some((re) => re.test(cmd))) {
    for (const t of rutasEnCodigo(cmd)) {
      const r = rutaDeToken(t, repo);
      if (r && !ejecutados.has(r)) { escritos.add(r); contenido.add(r); }
    }
  }
  // soloIndice: lo que el comando SOLO agrego al indice (`git add x`). Sigue siendo "tocado" para el chequeo de
  // archivos sin commitear, pero su contenido no cambio: no cuenta como un cambio nuevo a una pieza ya probada.
  const soloIndice = new Set([...alIndice].filter((r) => !contenido.has(r)));
  return { escritos, opaco, soloIndice };
}

// ---------------------------------------------------------------------------------------
// Entregables (chequeo 4): que se escribio afuera y si se miro despues
// ---------------------------------------------------------------------------------------

const nombreBase = (ruta) => aWindows(ruta).replace(/\//g, '\\').replace(/\\+$/, '').split('\\').pop().toLowerCase();
const sinExtension = (n) => n.replace(/\.[^.]+$/, '');
const limpiarToken = (t) => String(t ?? '').replace(/^["'`(]+|["'`),;:]+$/g, '');

/** Ruta absoluta con extension de entregable, afuera del repo, del scratchpad, del TEMP y de las
 *  carpetas internas (`.claude`, caches). No exige que matchee `fuera_del_repo`: un PDF en
 *  cualquier carpeta que no sea el repo es un entregable para alguien. */
export function esEntregableFuera(ruta, repo = REPO) {
  const r = aWindows(limpiarToken(ruta));
  if (!EXT_ENTREGABLE.test(r) || !esAbsoluta(r, repo)) return false;
  if (dentroDelRepo(r, repo) !== null) return false;
  if (SCRATCH.test(r) || TEMP.test(r) || EXCLUIR_ENTREGABLE.test(r)) return false;
  return true;
}

/** Rutas de entregables que nombra un texto de comando, con `salida: true` si vienen detras de un
 *  flag de salida, una redireccion o un `.save(`. Primero las entrecomilladas (pueden tener
 *  espacios: `OneDrive - BARACK`), despues los tokens sueltos. */
function rutasEntregablesEn(texto, repo) {
  const t = String(texto || '');
  const out = [];
  const reComillas = /"([^"\n]+)"|'([^'\n]+)'/g;
  for (const m of t.matchAll(reComillas)) {
    const ruta = m[1] ?? m[2];
    if (!esEntregableFuera(ruta, repo)) continue;
    out.push({ ruta, salida: SALIDA_ANTES.test(t.slice(Math.max(0, m.index - 60), m.index)) });
  }
  const sinComillas = t.replace(reComillas, ' ');
  const tokens = sinComillas.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    let tok = tokens[i];
    let prefijo = '';
    const red = tok.match(/^(>{1,2})(.+)$/);
    if (red) { prefijo = red[1]; tok = red[2]; }
    const igual = tok.match(/^(--?[a-z-]+=)(.+)$/i);
    if (igual) { prefijo = igual[1]; tok = igual[2]; }
    tok = limpiarToken(tok);
    if (!esEntregableFuera(tok, repo)) continue;
    const antes = prefijo || (i > 0 ? `${tokens[i - 1]} ` : '');
    out.push({ ruta: tok, salida: SALIDA_ANTES.test(antes) });
  }
  return out;
}

/** Que entregables ESCRIBE y cuales MIRA un comando. La linea de comando decide lo escrito (sin
 *  cuerpos de heredoc ni mensajes de commit); el texto entero decide lo mirado, porque el
 *  verificador puede vivir dentro de un `python - <<EOF`. */
export function entregablesEnComando(cmd, repo = REPO) {
  const texto = String(cmd || '');
  const linea = soloLineasDeComando(texto);
  const todo = rutasEntregablesEn(texto, repo);
  const escritos = todo.filter((x) => x.salida).map((x) => x.ruta);
  let insumos = todo.filter((x) => !x.salida).map((x) => x.ruta);
  if (BASH_ENTREGA.test(linea)) {
    const enLinea = rutasEntregablesEn(linea, repo).filter((x) => !x.salida).map((x) => x.ruta);
    const destino = enLinea[enLinea.length - 1];
    if (destino) { escritos.push(destino); insumos = insumos.filter((r) => r !== destino); }
    return { escritos, mirados: [] };
  }
  if (MIRA.test(texto)) return { escritos, mirados: insumos };
  if (ESCRIBE.test(texto)) return { escritos: [...escritos, ...insumos], mirados: [] };
  return { escritos, mirados: [] };
}

function registrarEntregables(b, st, repo) {
  const nombre = b.name || '';
  const input = b.input || {};
  const escrito = (ruta) => {
    const k = nombreBase(ruta);
    const e = st.ent.get(k) || { ruta, escritoEn: -1, miradoEn: -1 };
    e.ruta = ruta;
    e.escritoEn = st.seq;
    st.ent.set(k, e);
  };
  const mirado = (k) => {
    const stem = sinExtension(k);
    for (const [n, e] of st.ent) if (n === k || sinExtension(n) === stem) e.miradoEn = st.seq;
  };
  if (/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(nombre)) {
    const ruta = input.file_path || input.notebook_path;
    if (esEntregableFuera(ruta, repo)) escrito(ruta);
  } else if (nombre === 'Read') {
    const r = aWindows(input.file_path || '');
    if (EXT_ENTREGABLE.test(r)) mirado(nombreBase(r));
  } else if (/^(Bash|PowerShell)$/.test(nombre)) {
    const { escritos, mirados } = entregablesEnComando(input.command, repo);
    for (const m of mirados) mirado(nombreBase(m));
    for (const w of escritos) escrito(w);
  } else if (nombre.startsWith('mcp__') && st.ent.size) {
    const j = JSON.stringify(input).toLowerCase();
    for (const [n, e] of st.ent) if (j.includes(n)) e.miradoEn = st.seq;
  }
}

// H14 (10/10/2026): MIRADAS del turno, para lo escrito en `exports/`. Va APARTE de `registrarEntregables` a
// proposito: ese mecanismo (lo de afuera del repo) no cambia. Aca se guarda el TEXTO de cada cosa que pudo abrir
// un archivo (la ruta de un Read, un comando con un verificador de `mira_re`, la entrada de una tool MCP) y su
// hora; despues `entregablesSinAbrir` busca ahi el NOMBRE del archivo. Por nombre y no por ruta porque, medido por
// el auditor sobre 339 verificaciones reales de exports/, 228 no traen la ruta entera (`cd` a la carpeta y nombre
// pelado, `python -c`, barras dobles). La hora es la del RESULTADO del comando, no la de cuando se lanzo: generar
// y verificar en el mismo comando es mirar (caso real f14f5aae, 07/10 18:35). Un Read que vuelve con error no cuenta.
const MIRADAS_MAX = 600;
const MIRADA_TXT_MAX = 8000;
function registrarMirada(b, st, ts) {
  const nombre = b.name || '';
  const input = b.input || {};
  let txt = '';
  if (nombre === 'Read') {
    const r = aWindows(input.file_path || '');
    if (EXT_ENTREGABLE.test(r)) txt = r;
  } else if (/^(Bash|PowerShell)$/.test(nombre)) {
    const cmd = String(input.command || '');
    if (MIRA.test(cmd)) txt = cmd;
  } else if (nombre.startsWith('mcp__')) {
    txt = JSON.stringify(input);
  }
  if (!txt) return;
  const m = { txt: textoPlano(txt.slice(0, MIRADA_TXT_MAX)), ts, esRead: nombre === 'Read' };
  st.miradas.push(m);
  if (st.miradas.length > MIRADAS_MAX) st.miradas.shift();
  if (b.id) st.miradasPorId.set(b.id, m);
}

/** El resultado de una mirada: su hora pasa a ser la del resultado; si volvio con error, no fue una mirada. */
function cerrarMiradas(st, obj) {
  const bloques = obj.message?.content;
  if (!st.miradasPorId.size || !Array.isArray(bloques)) return;
  for (const b of bloques) {
    if (b.type !== 'tool_result' || !st.miradasPorId.has(b.tool_use_id)) continue;
    const m = st.miradasPorId.get(b.tool_use_id);
    st.miradasPorId.delete(b.tool_use_id);
    if (b.is_error) { const i = st.miradas.indexOf(m); if (i >= 0) st.miradas.splice(i, 1); continue; }
    const fin = Date.parse(obj.timestamp || '');
    if (Number.isFinite(fin) && fin > m.ts) m.ts = fin;
  }
}

// ---------------------------------------------------------------------------------------
// Relevadores (leen el mundo). En los tests se inyectan versiones falsas.
// ---------------------------------------------------------------------------------------

/** Lo que ESCRIBIO Fak: el texto sin los avisos que la app le pega ADELANTE. Hasta el 02/10/2026 un mensaje suyo
 *  que llegaba detras de un "<system-reminder>The user started your suggested background task…" se tomaba entero
 *  por un aviso: el turno no arrancaba ahi y el chequeo 2 reclamaba la ruta de algo entregado en el turno ANTERIOR
 *  (61a9a9ac 02/10 14:19, justo en el turno del incidente de explicar-mejor). */
/** El texto de un contenido de mensaje (cadena, o lista de bloques: se juntan los de texto; una imagen no es texto). */
const textoDeBloques = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b?.type === 'text').map((b) => b.text || '').join('\n') : '');
const crudoDeUsuario = (obj) => textoDeBloques(obj.message?.content);
const textoDeUsuario = (obj) => sinAvisosAdelante(crudoDeUsuario(obj));

// Lo que Claude Code mete como "user" sin que Fak lo haya escrito (avisos de tareas, salidas de comandos, el
// resumen de un compactado, lo que manda otra sesion) no cuenta como mensaje de Fak. Como arranca cada uno
// vive en UNA lista: correccionCanon.data.json, `no_es_de_fak` (esAutomatico).
function esMensajeRealDeUsuario(obj) {
  if (obj.isMeta || obj.isCompactSummary) return false;
  if (obj.origin?.kind && obj.origin.kind !== 'human') return false;       // task-notification, peer: lo dice el transcript
  const t = textoDeUsuario(obj);
  return t.trim().length > 0 && !esAutomatico(t);
}

// ---------------------------------------------------------------------------------------
// Chequeo 7: Fak pidio que se lo explique y el turno contesto sin cambiar la forma
// ---------------------------------------------------------------------------------------
// Las palabras de Fak las reconoce explicarGuard (hook UserPromptSubmit explicar-prompt.sh); aca se mide lo
// que ese aviso no puede medir: que en el turno se haya CARGADO el skill, o mostrado un dibujo o una pagina.
// El 02/10/2026 el skill estaba en la lista y se contesto una tabla (Fak: "me respondiste normal como si no
// recordaras esa conversacion"). Lo que cuenta como cada cosa vive en explicarCanon.data.json (`cierre`).

const CX = CANON_EXPLICAR.cierre;
const CX_SKILL_ARCHIVO = rx(CX.skill_archivo_re);
const CX_DIBUJO = rx(CX.dibujo_re);
const CX_PAGINA_EXT = rx(CX.pagina_ext_re);
const CX_PAGINA_RUTA = rx(CX.pagina_ruta_re);
const CX_PAGINA_TOOL = rx(CX.pagina_tools_re);
const CX_NO_APLICA = rx(CX.no_aplica_re);
const CX_ENCARGO = rx(CX.encargo_re);
const CX_MENCION = /explicar[- ]mejor/i;
const turnoDeExplicar = () => ({ skill: false, dibujo: false, pagina: false, envio: false, noAplica: false });

/** Anota en `t` (el turno en curso) lo que un tool_use deja hecho para el chequeo 7. */
function registrarExplicar(b, t) {
  const nombre = b.name || '';
  const input = b.input || {};
  if (nombre === 'Skill') {
    if (String(input.skill || '').split(':').pop() === CX.skill) t.skill = true;
  } else if (nombre === 'Read') {
    if (CX_SKILL_ARCHIVO.test(String(input.file_path || ''))) t.skill = true;
  } else if (CX_DIBUJO.test(nombre)) {
    t.dibujo = true;
  } else if (/^(Write|Edit|MultiEdit)$/.test(nombre)) {
    // Una pagina de explicacion vive en exports/explicaciones/: el index.html de la app o un html suelto no lo son.
    if (CX_PAGINA_RUTA.test(String(input.file_path || ''))) t.pagina = true;
  } else if (nombre === 'SendUserFile') {
    const archivos = Array.isArray(input.files) ? input.files.map(String) : [];
    if (archivos.some((a) => CX_PAGINA_EXT.test(a))) t.pagina = true;
    else if (archivos.length) t.envio = true;
  } else if (CX_PAGINA_TOOL.test(nombre)) {
    if (!input.action || input.action === 'publish') t.pagina = true;
  }
}

/**
 * Chequeo 7. `rel` es lo que devuelve relevarTranscript: el ultimo mensaje de Fak y lo que el turno hizo desde
 * ese mensaje (`explicar`). No bloquea si el mensaje no pedia explicar, si es el encargo de otra sesion, si el
 * skill se cargo en el turno, si se mostro un dibujo o una pagina, si el turno le mando un archivo a Fak (el
 * pedido era de un entregable: sigue con sus reglas), o si la respuesta —esta o una anterior del mismo turno—
 * dice que el aviso no aplica. Escribir algo afuera del repo NO exime (auditoria 02/10: de 12 turnos reales que
 * pasaban, 5 eran pedidos de explicacion que pasaban solo por eso).
 */
export function evaluarExplicar(texto, rel = {}) {
  const pedido = String(rel?.ultimoMensajeFak || '');
  if (!pedido || !pideExplicar(pedido)) return { bloquea: false };
  if (rel.encargo) return { bloquea: false, motivo: 'es el encargo de otra sesion, no palabras de Fak' };
  const t = rel.explicar || {};
  if (t.skill) return { bloquea: false, motivo: 'cargo el skill' };
  if (t.dibujo || t.pagina) return { bloquea: false, motivo: 'mostro un dibujo o una pagina' };
  if (t.envio) return { bloquea: false, motivo: 'le mando un archivo: el pedido era de un entregable' };
  if (t.noAplica || CX_NO_APLICA.test(normalizar(texto))) return { bloquea: false, motivo: 'dice que no aplica' };
  return { bloquea: true, pedido: normalizar(pedido).slice(0, 220), estado: pideEstado(pedido) };
}

const detalleExplicar = (ex) => `Su mensaje: «${ex.pedido}».\n`
  + `En este turno no cargaste el skill \`${CX.skill}\` ni mostraste un dibujo o una pagina: verlo en la lista no es usarlo. `
  + 'Fak, 02/10: "te pedi antes que me lo des facil de entender y no aplicaste la mejora que habiamos implementado... me respondiste normal como si no recordaras esa conversacion".\n'
  + `Carga el skill ahora, elegi el escalon y rehace la respuesta con esa forma${ex.estado ? ': pide el ESTADO de una tarea o proyecto, que es el escalon 3 (texto corto y UNA pagina en exports/explicaciones/, mostrada con SendUserFile)' : ''}. `
  + 'Si no aplica (habla de un entregable para otra persona, o las palabras son de un tercero), decilo en un renglon que empiece con "No aplica explicar-mejor:" y el motivo.';

// ---------------------------------------------------------------------------------------
// Chequeo 8: el mensaje dice que no tengo acceso a los mails de un companero y no mire la nube del equipo
// ---------------------------------------------------------------------------------------
// 07/10/2026: "El correo de Carlos no lo puedo leer: solo tengo acceso al tuyo." Era falso: los mails de Carlos y de la PC
// que era de Marcelo suben solos a la nube de Ingenieria y `scripts/_mails.py --buscar` los lee. Fak: "si lo podes leer,
// esta en la nube... desde cuando no recordas eso?". Las frases y las excepciones viven en cierreCanon.data.json
// (`mails_equipo`), cada una con su caso. Frena, no decide: si la negacion es verdad (Pedro no comparte sus mails), se mira
// y se dice "no esta en la nube", no "no puedo leerlo".

const MQ = CANON.mails_equipo;
const MQ_NIEGA = MQ.niega_re.map((p) => ({ ...p, regex: rx(p.re) }));
const MQ_BUSCO = rx(MQ.busco_re);
const MQ_BUSCO_EXCLUYE = rx(MQ.busco_excluye_re);
const MQ_NO_APLICA = rx(MQ.no_aplica_re);
const MQ_RUTA = /mails[\\/]_entrada/i;
const MQ_MENCION = /mails-del-equipo/i;            // el renglon "No aplica ..." vive en un texto sin tool_use: la pasada solo lee esas lineas si lo nombran
const turnoDeMails = () => ({ busco: false, noAplica: false });

/** Anota en `t` (el turno en curso) si un tool_use miro la nube de mails del equipo: `_mails.py --buscar|--buzones|--ver`
 *  sin `--solo-fak` (solo cuenta como COMANDO, no un grep que nombra el script), o abrir algo de `mails\_entrada`. */
function registrarMails(b, t) {
  const nombre = b.name || '';
  const input = b.input || {};
  if (/^(Bash|PowerShell)$/.test(nombre)) {
    const cmd = soloLineasDeComando(String(input.command || ''));
    if ((MQ_BUSCO.test(cmd) && !MQ_BUSCO_EXCLUYE.test(cmd)) || MQ_RUTA.test(cmd)) t.busco = true;
  } else if (/^(Read|Grep|Glob)$/.test(nombre)) {
    if (MQ_RUTA.test(`${input.file_path || ''} ${input.path || ''} ${input.pattern || ''}`)) t.busco = true;
  }
}

/**
 * Chequeo 8. `texto` es el mensaje final; `rel` lo que devuelve relevarTranscript (`mails`: lo que el turno hizo desde el
 * ultimo mensaje de Fak). Mira el mensaje ENTERO (la negacion puede estar en el medio), normalizado como el resto del guard.
 * No bloquea si ninguna regla de `niega_re` calza, si en el turno se miro la nube (`busco`) o si el mensaje, este o uno
 * anterior del mismo turno, trae el renglon "No aplica mails-del-equipo: <motivo>".
 */
export function evaluarMailsEquipo(texto, rel = {}) {
  const n = normalizar(texto);
  const hallada = MQ_NIEGA.map((p) => ({ p, m: n.match(p.regex) })).find((x) => x.m);
  if (!hallada) return { bloquea: false };
  const t = rel?.mails || {};
  if (t.busco) return { bloquea: false, motivo: 'miro la nube del equipo en este turno' };
  if (t.noAplica || MQ_NO_APLICA.test(n)) return { bloquea: false, motivo: 'dice que no aplica' };
  // la frase se muestra hasta el final de la oracion ("El correo de Carlos no lo puedo leer"), no hasta donde calzo la regla
  const desde = hallada.m.index ?? n.indexOf(hallada.m[0]);
  const resto = n.slice(desde);
  const fin = resto.search(/[.?!]/);
  return { bloquea: true, frase: resto.slice(0, fin > 0 ? fin : 140).slice(0, 140), fuente: hallada.p.fuente };
}

const detalleMails = (mq) => `El mensaje dice «${mq.frase}»: que no tenes acceso a los mails de un companero. `
  + 'El 07/10/2026 eso era FALSO: los mails de trabajo de Carlos Baptista (cbaptista) y de la PC que era de Marcelo Nieve (lucca.tuccio) '
  + 'ya suben solos a la nube de Ingenieria y `scripts/_mails.py --buscar` los lee. Fak: "si lo podes leer, esta en la nube... desde cuando no recordas eso?" '
  + '(memoria project_mails_del_equipo_a_la_nube).\n'
  + 'Antes de decir que no se puede, mira (en este turno):\n'
  + '  python scripts/_mails.py --buzones                       (que buzones hay, cuantos mails y hasta que fecha llega cada uno)\n'
  + '  python scripts/_mails.py --buscar "<tema>" [--buzon carlos]   (busca en el buzon de Fak Y en los del equipo)\n'
  + 'Si despues de mirar la persona no figura, decile a Fak eso ("no esta en la nube", y hasta que fecha llega lo que si esta), '
  + 'no "no puedo leerlo". La carpeta _cuarentena de esa nube (lo que el filtro aparto por privado) no se lee nunca. '
  + 'Si la frase no es sobre acceso a los mails de otra persona, escribi un renglon que empiece con "No aplica mails-del-equipo:" y el motivo.';

// Ventana de un comando OPACO: desde que se lanzo hasta que volvio su resultado. Lo que quedo sucio con
// fecha adentro de una ventana lo pudo escribir ese comando (auditoria 01/10/2026: `python scripts/gen.py
// --out x` junto a un Write dejaba afuera a `x`, porque con UN archivo atribuido ya no se miraba lo opaco).
// Sin hora en el transcript no hay ventana que armar: se marca y se cae a "todo desde el inicio".
function abrirVentana(st, b, obj) {
  const ini = Date.parse(obj.timestamp || '');
  if (!Number.isFinite(ini)) { st.sinVentana = true; return; }
  if (b.input?.run_in_background || !b.id) st.ventanas.push([ini, Infinity]);   // sigue corriendo: no se sabe hasta cuando
  else st.abiertas.set(b.id, ini);
}

function cerrarVentanas(st, obj) {
  const bloques = obj.message?.content;
  if (!st.abiertas.size || !Array.isArray(bloques)) return;
  for (const b of bloques) {
    if (b.type !== 'tool_result' || !st.abiertas.has(b.tool_use_id)) continue;
    const fin = Date.parse(obj.timestamp || '');
    st.ventanas.push([st.abiertas.get(b.tool_use_id), Number.isFinite(fin) ? fin : Infinity]);
    st.abiertas.delete(b.tool_use_id);
  }
}

/** El resultado de una corrida de `_probarMejora.mjs --mensaje`: si volvio sin error, la prueba cuenta. */
function cerrarPruebas(st, obj) {
  const bloques = obj.message?.content;
  if (!st.sis.pruebas.size || !Array.isArray(bloques)) return;
  for (const b of bloques) {
    if (b.type !== 'tool_result' || !st.sis.pruebas.has(b.tool_use_id)) continue;
    if (!b.is_error) st.sis.probado = Math.max(st.sis.probado, st.sis.pruebas.get(b.tool_use_id));
    st.sis.pruebas.delete(b.tool_use_id);
  }
}

async function pasada(archivo, st, { completa, repo }) {
  const rl = readline.createInterface({ input: fs.createReadStream(archivo, 'utf8'), crlfDelay: Infinity });
  for await (const linea of rl) {
    if (!linea.includes('"tool_use"') && !linea.includes('"type":"user"')
      && !linea.includes('<task-notification>') && !linea.includes('"queued_command"')
      && !(completa && (CX_MENCION.test(linea) || MQ_MENCION.test(linea)))) continue;
    let obj;
    try { obj = JSON.parse(linea); } catch { continue; }
    if (completa && !st.inicio && obj.timestamp) st.inicio = Date.parse(obj.timestamp) || 0;
    if (completa) registrarBackground(st.bg, obj, linea);
    // Lo que Fak escribe MIENTRAS trabajo entra como attachment queued_command (commandMode prompt). Lo que
    // encola OTRA sesion trae origin.kind 'peer' (42 en dos meses) y no es de Fak; con una imagen adjunta el
    // prompt es una lista de bloques (24), no una cadena.
    if (obj.type === 'attachment' && obj.attachment?.type === 'queued_command' && obj.attachment.commandMode === 'prompt') {
      const a = obj.attachment;
      const t = sinAvisosAdelante(textoDeBloques(a.prompt));
      if (completa && !(a.origin?.kind && a.origin.kind !== 'human') && t.trim() && !esAutomatico(t)) {
        st.ultimoMensajeFak = t; st.ultimoMensajeFakTs = obj.timestamp || ''; st.explicar = turnoDeExplicar(); st.mails = turnoDeMails(); st.encargo = false;
      }
      continue;
    }
    if (obj.type === 'user') {
      cerrarVentanas(st, obj);
      cerrarPruebas(st, obj);
      cerrarMiradas(st, obj);
      if (completa && esMensajeRealDeUsuario(obj)) {
        // turnoTs: donde empieza el turno para el chequeo 4 de exports/. Lo mueve solo un mensaje que ABRE un turno, no
        // uno que Fak escribe mientras trabajo (queued_command, arriba): ese no corta lo que ya se genero (auditor R3).
        st.turnoTs = obj.timestamp || ''; st.miradas = []; st.miradasPorId = new Map();
        st.ejemplo = null; st.ultimoMensajeFak = textoDeUsuario(obj); st.ultimoMensajeFakTs = obj.timestamp || ''; st.explicar = turnoDeExplicar(); st.mails = turnoDeMails();
        st.encargo = CX_ENCARGO.test(crudoDeUsuario(obj));           // el primer mensaje de una sesion lanzada por otra
      } else if (completa && linea.includes('<command-name>') && linea.includes(`/${CX.skill}<`)) st.explicar.skill = true;   // Fak lo cargo a mano
      continue;
    }
    if (obj.type !== 'assistant') continue;
    const bloques = obj.message?.content;
    if (!Array.isArray(bloques)) continue;
    for (const b of bloques) {
      // El renglon "No aplica explicar-mejor:" vale para todo el turno: si despues un aviso de tarea despierta
      // la sesion y hay otro cierre, no se vuelve a pedir (auditoria 02/10: 4 turnos reales con 2 cierres o mas).
      if (completa && b.type === 'text' && CX_NO_APLICA.test(normalizar(b.text))) st.explicar.noAplica = true;
      if (completa && b.type === 'text' && MQ_NO_APLICA.test(normalizar(b.text))) st.mails.noAplica = true;
      if (b.type !== 'tool_use') continue;
      st.seq++;
      registrarMirada(b, st, Date.parse(obj.timestamp || '') || 0);   // tambien lo que abre un subagente (el auditor)
      const orden = Date.parse(obj.timestamp || '') || st.seq;
      const pieza = (r) => {
        if (!MEJ_SISTEMA.test(r)) return;
        const limpia = r.replace(MEJ_WORKTREE, '');
        st.sis.archivos.add(limpia);
        if (MEJ_MENSAJES.test(limpia)) { st.sis.deMensajes.add(limpia); st.sis.escrito = Math.max(st.sis.escrito, orden); }
      };
      const rel = rutaRelativaAlRepo(b, repo);
      if (rel) { st.tocados.add(rel); pieza(rel); }
      if (/^(Bash|PowerShell)$/.test(b.name || '')) {
        st.huboComando = true;
        // Solo lo que el comando ESCRIBE (30/09/2026): nombrar un archivo en un cat o un grep no lo toca.
        const e = escrituraEnComando(b.input?.command, repo);
        for (const r of e.escritos) {
          st.tocados.add(r);
          if (!e.soloIndice.has(r)) pieza(r);               // `git add` despues de la prueba no es un cambio nuevo
        }
        if (e.opaco) { st.huboOpaco = true; abrirVentana(st, b, obj); }
        // La prueba cuenta cuando VUELVE sin error (cerrarPruebas): un grep que nombra el script, o una que fallo, no.
        if (completa && b.id && MEJ_PRUEBA.test(soloLineasDeComando(String(b.input?.command || '')))) st.sis.pruebas.set(b.id, orden);
      } else if (/^(Agent|Task)$/.test(b.name || '')) {
        st.huboComando = true;
        st.huboOpaco = true;                              // un agente puede escribir donde no se ve (y su transcript puede faltar)
        abrirVentana(st, b, obj);
      }
      if (!completa) continue;
      const e = evaluarToolUse(b, repo);
      if (e) st.ejemplo = e;
      registrarEntregables(b, st, repo);
      registrarExplicar(b, st.explicar);
      registrarMails(b, st.mails);
    }
  }
}

/**
 * UNA pasada por el transcript de la sesion (y por los de sus subagentes, que viven en
 * `<sesion>/subagents/*.jsonl` y NO en el transcript principal). Devuelve:
 *   fuera / ejemplo   — algo entregado afuera del repo DESPUES del ultimo mensaje real de Fak
 *   tocados           — Set de rutas repo-relativas que esta sesion ESCRIBIO: Write/Edit/MultiEdit/
 *                       NotebookEdit y los comandos que escriben (`escrituraEnComando`: redireccion,
 *                       tee, sed -i, mv/cp/rm, git add...), subagentes incluidos. Nombrar un archivo
 *                       en un cat, un grep o un node --check NO lo toca (30/09/2026: una sesion con
 *                       9 escritos figuraba con 465 "tocados"). Con dos sesiones sobre el mismo repo,
 *                       lo sucio de la otra no es pendiente mio (falso positivo del 05/09). Si la
 *                       sesion corrio algo OPACO (un interprete, un agente, un comodin) y no se le
 *                       puede atribuir NINGUN archivo, vuelve null (auditoria 05/09, C.1) y se cuenta
 *                       lo sucio modificado desde `inicio`; sin transcript, todo lo sucio, como antes.
 *   inicio            — epoch ms del primer mensaje del transcript (desde cuando puede haber escrito)
 *   huboOpaco         — corrio algo que puede escribir donde no se ve
 *   ventanas          — [[desde, hasta], ...] en epoch ms: cuando corrio cada comando opaco. Lo sucio con
 *                       fecha adentro de una ventana se suma a `tocados` (lo pudo escribir ese comando)
 *   entregables      — archivos de entrega escritos afuera, con `mirado` (hubo Read, verificador
 *                       o tool MCP sobre ese archivo DESPUES de su ultima escritura)
 *   miradas           — [{ txt, ts, esRead }] del turno: el texto (minuscula, con /) de cada Read, verificador o tool
 *                       MCP y la hora de su resultado (H14: ahi se busca el nombre de lo escrito en exports/)
 *   turnoTs           — hora del mensaje que ABRIO el turno (uno escrito a mitad del turno no lo mueve)
 *   sinMirar          — los entregables con mirado=false
 *   ultimoMensajeFak  — texto del ultimo mensaje real de Fak (para el chequeo 5)
 *   bg                — { total, delTurno, lista }: trabajo en segundo plano lanzado y sin su aviso
 *                       de fin (chequeo 6). Solo el transcript principal: lo que corre adentro de
 *                       un subagente lo espera el subagente, no yo.
 */
export async function relevarTranscript(transcriptPath, { repo = REPO } = {}) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return { fuera: false };
  const st = {
    ejemplo: null, huboComando: false, huboOpaco: false, inicio: 0, tocados: new Set(), ultimoMensajeFak: '', ultimoMensajeFakTs: '', ent: new Map(), miradas: [], miradasPorId: new Map(), turnoTs: '', seq: 0,
    bg: nuevoBackground(), ventanas: [], abiertas: new Map(), sinVentana: false,
    explicar: turnoDeExplicar(), mails: turnoDeMails(), encargo: false,
    sis: { archivos: new Set(), deMensajes: new Set(), escrito: 0, probado: 0, pruebas: new Map() },
  };
  await pasada(transcriptPath, st, { completa: true, repo });
  const dirSub = path.join(String(transcriptPath).replace(/\.jsonl$/i, ''), 'subagents');
  let subagentes = [];
  try { subagentes = fs.readdirSync(dirSub).filter((f) => /\.jsonl$/i.test(f)); } catch { /* sin subagentes */ }
  for (const f of subagentes) {
    try { await pasada(path.join(dirSub, f), st, { completa: false, repo }); } catch { /* un transcript roto no frena el cierre */ }
  }
  const atribuibles = st.tocados.size > 0 || !st.huboOpaco ? st.tocados : null;
  for (const ini of st.abiertas.values()) st.ventanas.push([ini, Infinity]);   // sin resultado todavia: sigue abierta
  if (st.sinVentana && st.inicio) st.ventanas.push([st.inicio, Infinity]);
  const entregables = [...st.ent.entries()].map(([nombre, e]) => ({
    nombre, ruta: e.ruta, escritoEn: e.escritoEn, mirado: e.miradoEn > e.escritoEn,
  }));
  const lista = pendientesBackground(st.bg);
  return {
    fuera: Boolean(st.ejemplo),
    ejemplo: st.ejemplo ?? undefined,
    tocados: atribuibles,
    inicio: st.inicio || undefined,
    huboComando: st.huboComando,
    huboOpaco: st.huboOpaco,
    ventanas: st.ventanas,
    entregables,
    sinMirar: entregables.filter((e) => !e.mirado),
    miradas: st.miradas.map(({ txt, ts, esRead }) => ({ txt, ts, esRead })),
    turnoTs: st.turnoTs,
    ultimoMensajeFak: st.ultimoMensajeFak,
    ultimoMensajeFakTs: st.ultimoMensajeFakTs,
    // chequeo 7: lo que el turno hizo desde el ultimo mensaje de Fak (skill cargado, dibujo, pagina, archivo enviado)
    explicar: st.explicar,
    // chequeo 8: si en el turno miro la nube de mails del equipo (o dijo que el aviso no aplica)
    mails: st.mails,
    encargo: st.encargo,
    // pendiente de "mejora sin probar": las piezas del sistema que la sesion escribio; de esas, las que un mensaje
    // de Fak ejercita (deMensajes); y si despues de la ultima escritura de estas corrio la prueba y volvio bien
    sistema: { archivos: [...st.sis.archivos], deMensajes: [...st.sis.deMensajes], probada: st.sis.probado > 0 && st.sis.probado >= st.sis.escrito },
    // chequeo 6: lo que sigue corriendo; delTurno = lanzado despues del ultimo mensaje de Fak
    bg: {
      total: lista.length,
      delTurno: lista.filter((p) => !st.ultimoMensajeFakTs || p.ts > st.ultimoMensajeFakTs).length,
      lista,
    },
  };
}

/** Nombre historico del relevador (tests y deps lo siguen usando). */
export const escribioFueraEnEsteTurno = relevarTranscript;

/** Set de rutas repo-relativas que toco ESTA sesion, o null si no se puede atribuir
 *  (sin transcript, o sesion con comandos sin archivo atribuible). Lo usa dev-server-guard.sh
 *  via scripts/_lib/archivosSesion.mjs. */
export async function archivosTocadosEnSesion(transcriptPath, opts) {
  const r = await relevarTranscript(transcriptPath, opts);
  return r.tocados instanceof Set ? r.tocados : null;
}

function flagSupabase() {
  const dir = process.env.TEMP || process.env.TMPDIR || os.tmpdir();
  const flag = path.join(dir, 'claude-supabase-write.flag');
  try {
    if (!fs.existsSync(flag)) return false;
    const contenido = fs.readFileSync(flag, 'utf8');
    if (!contenido.trim()) return false;             // ya avisado en un turno anterior
    const st = fs.statSync(flag);
    const avisado = `${flag}.avisado`;
    fs.writeFileSync(avisado, contenido);
    fs.utimesSync(avisado, st.atime, st.mtime);      // la fecha de la escritura se conserva
    fs.truncateSync(flag, 0);
    fs.utimesSync(flag, st.atime, st.mtime);
    return true;
  } catch { return false; }
}

/** `true` si el archivo sucio se modifico desde `desde` (epoch ms, con un minuto de margen). Borrado o
 *  ilegible: no se sabe, cuenta. */
function modificadoDesde(rel, desde, repo = REPO) {
  try { return fs.statSync(path.join(repo, rel)).mtimeMs >= desde - 60_000; } catch { return true; }
}

/** `true` si el archivo sucio quedo con fecha adentro de la ventana de un comando opaco (5 s de margen).
 *  Borrado: no tiene fecha y no se le atribuye a la ventana (seria contar lo que borro otra sesion). */
function modificadoEnVentana(rel, ventanas, repo = REPO) {
  let t;
  try { t = fs.statSync(path.join(repo, rel)).mtimeMs; } catch { return false; }
  return ventanas.some(([ini, fin]) => t >= ini - 5000 && t <= fin + 5000);
}

/** Pendientes medibles al declarar un cierre. Cada renglon es accionable.
 *  `tocados` (Set de rutas repo-relativas que ESCRIBIO esta sesion) filtra el git status; a eso se le
 *  suma lo sucio con fecha adentro de una de las `ventanas` (lo que pudo escribir un comando opaco).
 *  Si `tocados` viene null la sesion no se puede atribuir y se cuenta lo sucio: con `desde` (la sesion
 *  tiene transcript pero corrio algo opaco) solo lo modificado desde que arranco; sin `desde` (no hubo
 *  transcript) todo, como antes: fallar hacia el lado seguro. */
export function relevarPendientes(tocados = null, { desde = null, ventanas = null, repo = REPO } = {}) {
  const out = [];
  try {
    const st = execSync('git status --porcelain', { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    let archivos = st.split(/\r?\n/).filter(Boolean).map((l) => l.slice(3).trim().replace(/^.*-> /, '').replace(/^"|"$/g, '')).filter((a) => EXT_CODIGO.test(a));
    const vent = Array.isArray(ventanas) ? ventanas : [];
    if (tocados instanceof Set) archivos = archivos.filter((a) => tocados.has(a.replace(/\\/g, '/')) || (vent.length > 0 && modificadoEnVentana(a, vent, repo)));
    else if (Number.isFinite(desde) && desde > 0) archivos = archivos.filter((a) => modificadoDesde(a, desde, repo));
    if (archivos.length) {
      out.push(`hay ${archivos.length} archivo(s) sin commitear (${archivos.slice(0, 4).join(', ')}${archivos.length > 4 ? ', …' : ''}) — regla git-deploy: build + commit por ruta + push`);
    }
  } catch { /* sin git no hay pendiente medible */ }
  if (flagSupabase()) {
    out.push('esta sesion escribio Supabase: node scripts/_backup.mjs si no hay backup posterior (node scripts/_cierreSesion.mjs --sin-build lo mide)');
  }
  try {
    const texto = fs.readFileSync(path.join(REPO, 'docs', 'LECCIONES_APRENDIDAS.md'), 'utf8');
    const bytes = Buffer.byteLength(texto, 'utf8');
    if (bytes > CANON.lecciones.aviso_bytes) {
      out.push(`LECCIONES pesa ${(bytes / 1024).toFixed(1)} KB (aviso ${CANON.lecciones.aviso_bytes / 1024} KB): pasada de consolidacion, no de poda`);
    }
    const malos = evaluarBullets(texto);
    if (malos.length) {
      out.push(`${malos.length} leccion(es) fuera del gate por bullet (l.${malos.slice(0, 3).map((m) => m.linea).join(', l.')}): graduar el detalle a memoria/regla, no recortar frases`);
    }
  } catch { /* sin archivo no hay gate */ }
  return out;
}

/**
 * Pendientes de una MEJORA del sistema (regla `mejora-implementada.md`, 02/10/2026). `sistema` sale de
 * relevarTranscript: las piezas que esta sesion escribio (hooks, skills, reglas, guardianes y sus canones,
 * settings.json, CLAUDE.md) y si despues de la ultima escritura corrio `_probarMejora.mjs --mensaje`.
 *   - sin esa prueba, el cierre no puede decir que la mejora esta implementada;
 *   - con piezas tocadas, el cierre le dice a Fak si las sesiones abiertas la toman solas o hay que reabrirlas.
 * Fak, 02/10: "pensa como evitar que cuando te digo que implementes algo realmente lo implementes".
 */
export function pendientesDeMejora(texto, sistema) {
  const archivos = sistema?.archivos || [];
  if (!archivos.length) return [];
  const out = [];
  const deMensajes = sistema.deMensajes || [];
  if (deMensajes.length && !sistema.probada) {
    out.push(`tocaste ${deMensajes.length} pieza(s) que leen los mensajes de Fak (${deMensajes.slice(0, 3).join(', ')}${deMensajes.length > 3 ? ', …' : ''}) y no las probaste despues del ultimo cambio con un mensaje REAL suyo: `
      + 'node scripts/_probarMejora.mjs --mensaje "<el mensaje, textual>" — regla mejora-implementada.md: sin esa prueba la mejora no esta implementada');
  }
  if (!MEJ_SESIONES.test(normalizar(texto))) {
    out.push('el cierre no le dice a Fak si las sesiones abiertas toman el cambio solas o hay que reabrirlas (lo contesta _probarMejora.mjs, renglon "Sesiones abiertas")');
  }
  return out;
}

// Marcas por sesion en el TEMP: `claude-cierre-recordado.<sid>` (chequeo 3), `.largo` (chequeo 5)
// y `.entregables` (chequeo 4: una linea por `<archivo>@<escritura>` ya reclamado).
const archivoMarca = (sid, clave = '') => path.join(
  os.tmpdir(),
  `claude-cierre-recordado.${String(sid || 'sin-id').replace(/[^\w-]/g, '_')}${clave ? `.${clave}` : ''}`,
);

export function cooldownVigente(sid, clave = '') {
  const seg = clave === 'largo' ? CANON.cierre_largo.cooldown_seg : CANON.cooldown_recordatorio_seg;
  try {
    const t = Number(fs.readFileSync(archivoMarca(sid, clave), 'utf8'));
    return Number.isFinite(t) && (Date.now() / 1000 - t) < seg;
  } catch { return false; }
}

export function marcarRecordatorio(sid, clave = '') {
  try { fs.writeFileSync(archivoMarca(sid, clave), String(Math.floor(Date.now() / 1000))); } catch { /* sin marca, se repite: mal menor */ }
}

export function yaReclamado(sid, clave) {
  try { return fs.readFileSync(archivoMarca(sid, 'entregables'), 'utf8').split(/\r?\n/).includes(clave); } catch { return false; }
}

export function reclamar(sid, clave) {
  try { fs.appendFileSync(archivoMarca(sid, 'entregables'), `${clave}\n`); } catch { /* idem */ }
}

// ---------------------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------
// Chequeo 9: un documento escrito en este turno dice que lo hizo Claude o una IA
// ---------------------------------------------------------------------------------------
// Fak, 08/10/2026: el listado de hojas de proceso decia "Claude" en CREADO POR, tenia una pestaña
// oculta "_CONTEXTO_CLAUDE" y la marca del complemento "Claude para Excel". *"Es un error gravisimo,
// no puede volver a suceder nunca... en ningun tipo de documento"*. El guardian PreToolUse
// (firma-ia-guard) frena lo que se ve en el comando; lo que un script escribe por dentro lo ve este
// chequeo: corre el detector (`scripts/_sinFirmaIA.py`) sobre los documentos escritos en el turno.
// Salida honesta para un falso positivo: el renglon "No aplica firma-ia: <motivo>".
const EXT_DOC_FIRMA = /\.(xlsx|xlsm|xltx|docx|docm|dotx|pptx|pptm|potx|pdf|csv|msg|eml|dxf|plt)$/i;
const NO_APLICA_FIRMA = /No aplica firma-ia:\s*\S/i;

function documentosRecientes(dir, desde, out, tope = 300) {
  let entradas = [];
  try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entradas) {
    if (out.length >= tope) return;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) documentosRecientes(p, desde, out, tope);
    else if (EXT_DOC_FIRMA.test(e.name) && !e.name.startsWith('~$')) {
      try { if (fs.statSync(p).mtimeMs >= desde) out.push(p); } catch { /* borrado en el medio */ }
    }
  }
}

/** Documentos escritos en el turno: los entregables que nombra el transcript y lo de `exports/`, con fecha
 *  posterior al ultimo mensaje de Fak (un minuto de margen). */
export function documentosDelTurno(fuera = {}, repo = REPO) {
  const ts = Date.parse(fuera?.ultimoMensajeFakTs || '');
  if (!ts) return [];   // sin el mensaje de Fak no se sabe donde empieza el turno (y un relevador falso no barre el disco)
  const desde = ts - 60_000;
  const out = [];
  for (const e of fuera?.entregables || []) {
    const r = aWindows(e.ruta || '');
    if (!EXT_DOC_FIRMA.test(r)) continue;
    try { if (fs.statSync(r).mtimeMs >= desde) out.push(r); } catch { /* ya no esta */ }
  }
  documentosRecientes(path.join(repo, 'exports'), desde, out);
  return [...new Set(out)];
}

/** Corre el detector; devuelve los hallazgos BLOQUEANTES (lista vacia si no hay o si no pudo correr). */
export function correrDetectorFirma(rutas, repo = REPO) {
  if (!rutas.length) return [];
  try {
    const salida = execFileSync('python', [path.join(repo, 'scripts', '_sinFirmaIA.py'), '--json', '--sin-avisos', '--incluir-nube', ...rutas],
      { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, timeout: 90_000, maxBuffer: 20 * 1024 * 1024 });
    return JSON.parse(salida || '[]');
  } catch (e) {
    // sale 1 con hallazgos: el JSON viene en stdout igual
    try { return JSON.parse(e.stdout || '[]'); } catch { return []; }
  }
}

export function evaluarFirmaIA(texto, rutas, correr = correrDetectorFirma) {
  if (NO_APLICA_FIRMA.test(texto || '')) return { bloquea: false, motivo: 'no aplica (dicho en el mensaje)' };
  if (!rutas?.length) return { bloquea: false, motivo: 'sin documentos en el turno' };
  const hs = correr(rutas).filter((h) => h.nivel === 'BLOQUEANTE');
  if (!hs.length) return { bloquea: false, motivo: 'documentos limpios' };
  return { bloquea: true, hallazgos: hs };
}

// ---------------------------------------------------------------------------------------
// Chequeo 4 en `exports/` (cola H14, 10/10/2026)
// ---------------------------------------------------------------------------------------
// `exports/` es donde viven casi todos los entregables (R4 #1: 112 pptx, xlsx y pdf desde el 01/09) y el chequeo 4
// no lo veia: `esEntregableFuera` da falso adentro del repo. Lo escrito ahi se lee del DISCO, no del comando:
// medido sobre 251 transcripts desde el 01/10, el archivo casi nunca aparece en el texto del comando que lo genera
// (lo escribe un programa por dentro). Se reclama solo lo modificado despues del ultimo mensaje de Fak, que el
// mensaje de cierre NOMBRA y que no se miro despues de su fecha: en exports/ tambien quedan renders, carpetas
// `_trabajo` y lo que escribe otra sesion; nada de eso se declara listo.

const EXT_DOC_ENTREGA = /\.(xlsx|xlsm|xls|pptx|docx|pdf|dxf|plt|hpgl)$/i;
const EXT_IMAGEN = /\.(png|jpe?g)$/i;
const NOMBRE_CHAR = /[a-z0-9áéíóúñü_]/i;
/** Barras a `/`, tildes compuestas (NFC), minuscula. */
const textoPlano = (t) => String(t ?? '').replace(/\\+/g, '/').normalize('NFC').toLowerCase();

/** Entregables de `<repo>/exports` escritos despues del mensaje que abrio el turno (`turnoTs`; si falta, el ultimo
 *  mensaje de Fak), sin `.build` ni lo de `excluir_re` y sin temporales `~$`. La fecha es la mas nueva entre la de
 *  modificacion y la de creacion: una copia hecha con Copy-Item, robocopy o `copyFileSync` conserva la fecha de
 *  modificacion del origen, pero nace hoy (auditor R4). Sin la hora del turno no se sabe donde empieza: lista vacia.
 *  El tope es una red contra un arbol descomunal, no un filtro: 5.000 (exports/ tiene ~4.200 archivos y el barrido
 *  entero tarda 0,2 s; con 400 se cortaba en orden alfabetico antes de llegar al entregable, auditor R1). */
export function exportsDelTurno(fuera = {}, repo = REPO, tope = 5000) {
  const desde = Date.parse(fuera?.turnoTs || fuera?.ultimoMensajeFakTs || '');
  if (!desde) return [];
  const out = [];
  const raiz = path.join(repo, 'exports');
  const andar = (dir) => {
    let entradas = [];
    try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entradas) {
      if (out.length >= tope) return;
      const p = path.join(dir, e.name);
      // el filtro de carpetas mira la ruta RELATIVA al repo: con el repo colgado de `.claude` (un worktree) la
      // absoluta calzaba entera y no se barria nada (auditor R9)
      const rel = path.relative(repo, p).replace(/\\/g, '/');
      if (e.isDirectory()) { if (!EXCLUIR_ENTREGABLE.test(`/${rel}/`)) andar(p); continue; }
      if (!EXT_ENTREGABLE.test(e.name) || e.name.startsWith('~$')) continue;
      let fecha = 0;
      try { const s = fs.statSync(p); fecha = Math.max(s.mtimeMs, s.birthtimeMs || 0); } catch { continue; }
      if (fecha < desde) continue;
      out.push({ nombre: e.name.toLowerCase(), rel, mtimeMs: fecha });
    }
  };
  andar(raiz);
  return out;
}

/** ¿El texto (ya pasado por `textoPlano`) nombra `aguja` como nombre entero? No calza adentro de otro nombre:
 *  ni "22.pdf" en "hoja22.pdf" ni en "HO-971-22.pdf" (adelante tampoco puede haber un guion o un punto). */
function nombraEntero(t, aguja) {
  for (let i = t.indexOf(aguja); i >= 0; i = t.indexOf(aguja, i + 1)) {
    const antes = t[i - 1];
    const despues = t[i + aguja.length];
    if (!(antes && (NOMBRE_CHAR.test(antes) || antes === '-' || antes === '.')) && !(despues && NOMBRE_CHAR.test(despues))) return true;
  }
  return false;
}

/**
 * ¿El mensaje de cierre nombra este archivo de exports/? Tres formas, de la mas segura a la mas amplia:
 *   - el nombre con su extension;
 *   - el nombre sin extension, solo si tiene forma de nombre de archivo (8 caracteres o mas y un `_`, un `-` o un
 *     numero): medido el 10/10, sin esa condicion "contacto.png" y "entera.png" calzaban con palabras comunes
 *     de 20 cierres que no hablaban de esos archivos;
 *   - su CARPETA (`exports/X/`), si es un documento (xlsx, pptx, pdf, dxf…) que esta directamente en ella: es
 *     como se cierra casi siempre ("quedo en exports/X/"). Una imagen o lo de una subcarpeta no entra por aca. La
 *     carpeta tiene que estar escrita entera: no vale como comienzo de otra ruta (`exports/X/otro.pdf`), de otra
 *     carpeta (`…/APB` en "…/APB CEN/": por eso un espacio detras no la cierra) ni colgada de otra (`docs/exports/X`).
 */
export function cierreNombra(texto, archivo) {
  const t = textoPlano(texto);
  const n = textoPlano(archivo?.nombre);
  if (!n) return false;
  if (nombraEntero(t, n)) return true;
  const stem = sinExtension(n);
  if (stem.length >= 8 && /[_\d-]/.test(stem) && nombraEntero(t, stem)) return true;
  if (!EXT_DOC_ENTREGA.test(n)) return false;
  const carpeta = textoPlano(archivo.rel).split('/').slice(0, -1).join('/');
  if (!carpeta || carpeta === 'exports') return false;
  for (let i = t.indexOf(carpeta); i >= 0; i = t.indexOf(carpeta, i + 1)) {
    const antes = t[i - 1];
    if (antes && (NOMBRE_CHAR.test(antes) || antes === '/' || antes === '-' || antes === '.')) {
      // adelante solo puede venir la raiz del repo (…/barackmercosul/exports/x): cualquier otra carpeta es otra ruta
      const previo = t.slice(Math.max(0, i - 40), i);
      if (!/(^|[\s`'"(\[])([a-z]:)?[^\s`'"]*barackmercosul\/$/.test(previo)) continue;
    }
    const resto = t.slice(i + carpeta.length);
    if (/^\/?([`'")\]*]|[.,;:]+(\s|$)|\n|$)/.test(resto)) return true;
  }
  return false;
}

/** ¿Esta mirada abrio ese archivo? Su texto lo nombra entero; o es el Read de una imagen con el mismo nombre (el
 *  render del documento). No vale cualquier archivo con la misma raiz (un .csv de entrada, auditor R2). */
function miradaNombra(m, nombre, carpeta = '') {
  if (nombraEntero(m.txt, nombre)) return true;
  // un verificador que trabaja sobre la CARPETA del archivo (`f=$(ls exports/X/HO-992*.pdf); pdftoppm "$f" …`): la
  // ruta va en una variable o con comodin y el nombre entero no aparece (27 + 3 de los comandos reales medidos)
  if (!m.esRead && carpeta && carpeta !== 'exports' && m.txt.includes(`${carpeta}/`)) return true;
  if (!m.esRead || !EXT_IMAGEN.test(m.txt)) return false;
  return sinExtension(m.txt.split('/').pop()) === sinExtension(nombre);
}

/**
 * Chequeo 4: los entregables sin abrir que el cierre tiene que reclamar. Lo de afuera del repo, todo, como desde
 * el 10/09 (`fuera.sinMirar`). Lo de exports/ (`deExports`, de `exportsDelTurno`): lo que el cierre nombra y no
 * tiene una mirada (`fuera.miradas`: Read, verificador o tool MCP cuyo texto lo nombra) que haya terminado despues
 * de su fecha en disco, con 2 s de margen.
 * Limites conocidos (auditor 10/10, todos del lado de dejar pasar): la mirada va por NOMBRE, asi que abrir otro
 * archivo que se llama igual en otra carpeta cuenta (43 % de los documentos de exports/ repiten nombre); un
 * comando que nombra el archivo (o su carpeta) y trae una palabra de `mira_re` en otro tramo cuenta aunque no lo
 * abra; y el texto de una tool MCP que lo nombra, tambien. Del lado de frenar de mas queda uno: mirar un render
 * que tiene OTRO nombre sin que ningun comando nombre el archivo ni su carpeta (frena una vez y dice que abrirlo).
 */
export function entregablesSinAbrir(texto, fuera = {}, deExports = []) {
  const out = [...(fuera?.sinMirar || [])];
  const miradas = Array.isArray(fuera?.miradas) ? fuera.miradas : [];
  for (const a of deExports || []) {
    if (!cierreNombra(texto, a)) continue;
    const nombre = textoPlano(a.nombre);
    const carpeta = textoPlano(a.rel).split('/').slice(0, -1).join('/');
    const mirado = miradas.some((m) => m.ts >= a.mtimeMs - 2000 && miradaNombra(m, nombre, carpeta));
    if (!mirado) out.push({ nombre: a.nombre, ruta: a.rel, escritoEn: Math.round(a.mtimeMs), mirado: false, origen: 'exports' });
  }
  return out;
}

const DEPS_REALES = {
  firmaIA: correrDetectorFirma,
  exportsDelTurno,
  fueraEnEsteTurno: relevarTranscript,
  pendientes: relevarPendientes,
  enCooldown: cooldownVigente,
  marcar: marcarRecordatorio,
  yaReclamado,
  reclamar,
  avisoTanda: avisoParaCierre,
};

/** @returns {Promise<{ok:boolean, titulo?:string, detalle?:string, motivo?:string}>} */
export async function decidir(payload = {}, deps = {}) {
  const d = { ...DEPS_REALES, ...deps };
  if (payload.stop_hook_active) return { ok: true, motivo: 'stop_hook_active' };
  const texto = String(payload.last_assistant_message ?? '');
  if (!texto.trim()) return { ok: true, motivo: 'sin texto' };

  // El transcript se lee una vez, antes de todo: el chequeo 7 necesita el ultimo mensaje de Fak, y un turno se
  // frena UNA sola vez (stop_hook_active), asi que si otro chequeo bloquea, el de explicar va en el mismo aviso.
  const fuera = await d.fueraEnEsteTurno(payload.transcript_path);
  const ex = evaluarExplicar(texto, fuera);
  const conExplicar = (r) => (ex.bloquea ? { ...r, detalle: `${r.detalle}\nADEMAS, Fak pidio que se lo expliques y contestaste sin cambiar la forma. ${detalleExplicar(ex)}` } : r);
  // Chequeo 8: lo mismo, el turno se frena una sola vez: si otro chequeo bloquea, el de los mails del equipo va en el mismo aviso.
  const mq = evaluarMailsEquipo(texto, fuera);
  const conMails = (r) => (mq.bloquea ? { ...r, detalle: `${r.detalle}\nADEMAS, el mensaje niega el acceso a los mails de un companero. ${detalleMails(mq)}` } : r);
  const conExtras = (r) => conMails(conExplicar(r));
  // Las reglas de la tanda (HOY-17, 10/10/2026): un renglon que se SUMA a un freno que ya salia (chequeos 3 y 5), solo
  // para una sesion con una hora vigente. No frena nada por si mismo y, si no se puede medir, no dice nada.
  const tanda = () => { try { return d.avisoTanda({ sesion: payload.session_id, registro: payload.transcript_path }) || ''; } catch { return ''; } };

  // 9. Un documento escrito en este turno nombra a Claude o a una IA. Va primero: es lo mas grave.
  const fi = evaluarFirmaIA(texto, documentosDelTurno(fuera), d.firmaIA);
  if (fi.bloquea) {
    const lista = fi.hallazgos.slice(0, 12).map((h) => `- ${h.archivo} — ${h.lugar}: «${String(h.texto).slice(0, 80)}»`).join('\n');
    return conExtras({
      ok: false,
      titulo: 'CIERRE-GUARD: un documento escrito en este turno dice que lo hizo Claude o una IA',
      detalle: `${lista}\n`
        + 'Regla de Fak (08/10/2026): ningun documento de Barack nombra a Claude ni a una IA, ni en lo que se ve ni en lo oculto '
        + '(pestañas ocultas, notas, comentarios, propiedades). Sacalo del archivo y del generador: '
        + '`python scripts/_sinFirmaIA.py --arreglar <archivo> --apply` arregla la marca del complemento y las propiedades; '
        + 'una celda o un texto se corrige a mano (CREADO POR = F.Santoro). Si es un falso positivo, el mensaje lleva el renglon '
        + '"No aplica firma-ia: <motivo>".',
    });
  }

  // 10. El turno termina en ingles (cola H4, 09/10/2026). Fak, 07/10: "deja de hablar en ingles"; R4: 65 turnos en
  // ingles desde el 01/09, 7 justo despues de compactar; 09/10 08:56 otra vez. Frena una vez (stop_hook_active) y pide
  // el mismo mensaje en castellano. Lo que no es prosa (codigo, rutas, citas) no cuenta: idioma.mjs.
  if (esIngles(texto)) {
    return conExtras({
      ok: false,
      titulo: 'CIERRE-GUARD: el turno termina en ingles',
      detalle: 'Con Fak se habla en castellano, tambien en los avisos cortos (Fak, 07/10/2026: "deja de hablar en ingles"; '
        + 'paso 65 veces desde el 01/09, 7 de ellas justo despues de compactar). Escribi el mismo mensaje en castellano '
        + 'rioplatense y cerra. Una cita en ingles entre comillas o un bloque de codigo no cuentan.',
    });
  }

  // 1. La cola pide permiso para mi propio trabajo.
  const p = evaluarPermiso(texto);
  if (p.bloquea) {
    return conExtras({
      ok: false,
      titulo: 'CIERRE-GUARD: el turno termina pidiendo permiso para hacer tu propio trabajo',
      detalle: `La cola del mensaje dice "${p.frase}". Patron nacido del incidente: ${p.fuente}.\n`
        + 'Regla de la casa (CLAUDE.md): para tu propio trabajo la respuesta es SI. Hacelo ahora y reporta el resultado con la ruta. '
        + 'Si lo que falta es un OK que el contrato de autonomia exige (escribir en Supabase, un listado maestro, emitir en el SGC '
        + 'o el legajo, la primera vez de algo, mandar un mail, cerrar el arb) o un dato que SOLO Fak tiene, pedilo con '
        + 'AskUserQuestion y un renglon "Lo que ya tengo:".',
    });
  }

  // 2. Entregue afuera del repo y no digo donde.
  if (fuera?.fuera && !tieneRuta(texto)) {
    return {
      ok: false,
      titulo: 'CIERRE-GUARD: entregaste algo afuera del repo y el cierre no dice DONDE quedo',
      detalle: `En este turno: ${fuera.ejemplo}.\n`
        + 'El mensaje final arranca con la RUTA completa del entregable (Fak la pidio 17 veces en dos semanas: "pasame la ruta"). Repetilo con la ruta.',
    };
  }

  // 6. Termina anunciando trabajo ("Sigo con eso.") y no corre nada que lo espere.
  const an = evaluarAnuncio(texto, fuera?.bg);
  if (an.bloquea) {
    return conExtras({
      ok: false,
      titulo: 'CIERRE-GUARD: el turno termina anunciando trabajo que no hiciste',
      detalle: `El ultimo parrafo dice "${an.frase}" y ${an.motivo}: si el turno termina aca, nadie lo hace. `
        + 'Fak, 21/09: "porque decis sigo sigo sigo dale segui y listo no lo digas" (19 veces tuvo que empujar un anuncio asi entre el 03/08 y el 22/09).\n'
        + 'Si decis que seguis, segui: hacelo ahora, en este mismo turno, y reporta el resultado. Si de verdad estas esperando algo '
        + '(un agente, el CI, un dato o un OK de Fak), escribilo asi: "Espero X" o "¿…?", sin anunciar trabajo.',
    });
  }

  // 7. Fak pidio que se lo explique (o que sea facil de entender) y el turno contesto sin cambiar la forma.
  if (ex.bloquea) {
    return conMails({
      ok: false,
      titulo: 'CIERRE-GUARD: Fak pidio que se lo expliques y contestaste sin cambiar la forma',
      detalle: detalleExplicar(ex),
    });
  }

  // 8. El mensaje dice que no tengo acceso a los mails de un companero y en este turno no mire la nube del equipo.
  if (mq.bloquea) {
    return {
      ok: false,
      titulo: 'CIERRE-GUARD: el mensaje dice que no tenes acceso a los mails de un companero, y esos mails estan en la nube',
      detalle: detalleMails(mq),
    };
  }

  if (!declaraCierre(texto)) return { ok: true };
  const sid = payload.session_id || 'sin-id';

  // 3. Cierre declarado con pendientes medibles (1x/20 min).
  if (!d.enCooldown(sid)) {
    const pend = [
      ...(d.pendientes(fuera?.tocados ?? null, { desde: fuera?.inicio, ventanas: fuera?.ventanas }) || []),
      ...pendientesDeMejora(texto, fuera?.sistema),
    ];
    if (pend.length) {
      d.marcar(sid);
      return {
        ok: false,
        titulo: 'CIERRE-GUARD: el mensaje declara cierre y hay pendientes medibles',
        detalle: pend.map((x) => `- ${x}`).join('\n')
          + '\nSi es un cierre real, resolvelos antes de cerrar. Si no lo es, segui: este aviso no se repite por 20 minutos.'
          + tanda(),
      };
    }
  }

  // 4. Entregable escrito afuera (o en exports/, en este turno y nombrado en el cierre) y nunca abierto despues
  //    (una vez por archivo y escritura).
  const sinMirar = entregablesSinAbrir(texto, fuera, d.exportsDelTurno(fuera)).filter((e) => !d.yaReclamado(sid, `${e.nombre}@${e.escritoEn}`));
  if (sinMirar.length) {
    for (const e of sinMirar) d.reclamar(sid, `${e.nombre}@${e.escritoEn}`);
    return {
      ok: false,
      titulo: sinMirar.every((e) => e.origen === 'exports')
        ? 'CIERRE-GUARD: el cierre nombra un entregable de exports/ escrito en este turno y no lo abriste despues'
        : 'CIERRE-GUARD: escribiste un entregable afuera del repo y no lo abriste despues',
      detalle: `Sin mirar desde su ultima escritura: ${sinMirar.map((e) => e.ruta).join(' · ')}.\n`
        + 'El juez es el archivo que quedo en la carpeta, no el script que lo genero (LECCIONES 03-04/09 y 08/09: '
        + 'el pptx viejo, el margen que no se veia en el HTML, el texto recortado que solo se ve en el PDF). Abrilo antes de decir listo: '
        + 'Read del PDF o de su render, _xlsxAPdf.py para un Excel, _validarDxf.py para un DXF, gate_entregable.py para un 3D. '
        + 'Este aviso sale una vez por archivo y escritura.',
    };
  }

  // 5. El cierre es un informe (exento si Fak pidio el detalle o la sesion esta en modo plan).
  const largo = evaluarLargo(texto);
  if (largo.largo && payload.permission_mode !== 'plan' && !pideDetalle(fuera?.ultimoMensajeFak) && !d.enCooldown(sid, 'largo')) {
    d.marcar(sid, 'largo');
    // Aviso de orden (H5): viaja en este freno, que ya existia; no agrega ninguno. Ver `evaluarOrdenCierre`.
    const orden = evaluarOrdenCierre(texto);
    const avisoOrden = orden.aviso
      ? `\nADEMAS, el orden: lo que necesitas de Fak («${orden.frase}») esta en el parrafo ${orden.parrafo} de ${orden.parrafos}. `
        + 'Va PRIMERO (con la ruta del entregable adelante si hay una), despues que cambio y despues que encontraste '
        + '(CLAUDE.md, "Como interactuar con Fak").'
      : '';
    return {
      ok: false,
      titulo: 'CIERRE-GUARD: el cierre es un informe',
      detalle: `El mensaje tiene ${largo.motivos.join(', ')}. Fak, 08/09: "no voy a leer todo eso... podes sintetizar que recomendas".\n`
        + 'El cierre pasa el test de un mail: que recomiendo, el comando o la ruta, y lo que le cambia una decision; el detalle ya vive '
        + 'en el archivo o la memoria (memoria no_hacer_informes). Reescribilo corto. Si Fak pidio el detalle con esas palabras, este aviso '
        + 'no aplica (se lee su ultimo mensaje). Lo que Fak objeta no es el largo sino lo que no se entiende de una lectura '
        + '(medicion 22/09, cierreCanon cierre_largo): palabras de planta, sin siglas ni rotulos inventados. No se repite por 20 minutos.'
        + avisoOrden + tanda(),
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------------------
// CLI (hook Stop): lee el JSON por stdin, exit 0 deja terminar, exit 2 devuelve el stderr.
// ---------------------------------------------------------------------------------------

const esDirecto = Boolean(process.argv[1] && /cierreGuard\.mjs$/i.test(process.argv[1]));
if (esDirecto) {
  let payload = {};
  try { payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { payload = {}; }
  decidir(payload)
    .then((r) => {
      if (r.ok) process.exit(0);
      process.stderr.write(`${r.titulo}\n${r.detalle}\n`);
      process.exit(2);
    })
    .catch(() => process.exit(0));                   // un guardian roto no frena el cierre
}
