/**
 * viernesPlanificacion.mjs — los viernes, cuando la sesión la abre Fak, un renglón que le recuerda a la sesión que
 * le proponga el ritual de planificación.
 *
 * Fak, 15/10/2026 ≈ 17:45: *«este análisis de cosas nuevas que no se me ocurren a mí estaría bueno hacerlo
 * regularmente los viernes, cuando hacemos fase de planificación… dejarlo firme como estándar… no hace falta
 * automatizarlo como tarea programada, me da miedo, prefiero estar; pero que él lo sepa y me lo sugiera»*.
 * Plan del sistema del 16/10 (tanda 13, al final, y tanda 10); memoria
 * `feedback_viernes_de_planificacion_equipo_fuera_de_la_caja`; renglón en CLAUDE.md («Como interactuar con Fak»).
 *
 * Lo llama `.claude/hooks/session-start-context.sh` (modo inicio) con el JSON del SessionStart por stdin. El aviso
 * sale solo si TODO esto se cumple:
 *   1. hoy es viernes en la hora de la PC (no en UTC: un viernes a las 21 de Argentina ya es sábado en UTC);
 *   2. es una sesión nueva (`source: "startup"`), no un resume, un clear ni un compact;
 *   3. la sesión la abrió Fak: el registro que la app de escritorio deja de cada sesión
 *      (`%APPDATA%\Claude\claude-code-sessions\<cuenta>\<org>\<local_id>.json`) se encontró y no trae `spawnedFrom`
 *      (la lanzó otra sesión) ni `scheduledTaskId` (la lanzó el reloj), y el proceso no trae
 *      `CLAUDE_CODE_HOST_SCHEDULED_RUN=1` (la marca que la app le pone a una corrida programada);
 *   4. todavía no salió hoy en esta PC (`~/.claude/.viernes-planificacion` guarda el día del último aviso; se escribe
 *      solo cuando el aviso salió de verdad).
 * **Ante la duda calla** (registro que no aparece o no se puede leer, `source` desconocido): una hija que trabaja sola
 * y recibe el aviso podría lanzar el equipo de 22 agentes por su cuenta; si se calla de más, queda el renglón de
 * CLAUDE.md. Los viernes cada decisión deja un renglón en `~/.claude/.viernes-planificacion.log` (hora, sesión,
 * decisión y motivo): el primer viernes real es la prueba de punta a punta.
 *
 * Por qué estas señales y no otras (medido el 16/10/2026 en esta PC, Claude Code 2.1.299 y la app 2.42304.0):
 *   - `CLAUDE_CODE_CHILD_SESSION` NO sirve: Claude Code se la pone a todo proceso que lanza (la arma `cYe()` del
 *     ejecutable), también a los hooks de una sesión que abrió Fak.
 *   - El SessionStart corre ANTES de que el primer mensaje llegue al registro de la charla (en la hija del 16/10 el
 *     hook corrió 3 s antes de encolarse el encargo): el «Background (from the session that started this one)» no se
 *     puede leer acá.
 *   - `CLAUDE_CODE_HOST_SESSION_ID` trae el `local_…` de la app y es el nombre del archivo del registro: no hace falta
 *     recorrer las ~600 fichas. Si no viniera, se busca por `cliSessionId` (= `session_id` del JSON) entre las
 *     fichas tocadas en los últimos 2 días.
 *
 *   node scripts/_lib/viernesPlanificacion.mjs --hook   (stdin: el JSON del SessionStart)
 * En una prueba (solo con VITEST puesto) la fecha sale de `VIERNES_HOY_PRUEBA` («2026-10-16T10:00», hora local).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MARCA = '[VIERNES DE PLANIFICACIÓN]';
export const VAR_HOY_PRUEBA = 'VIERNES_HOY_PRUEBA';
const ID_APP = /^local_[0-9a-f-]{8,}$/i;
const DOS_DIAS = 2 * 86400000;

const dos = (n) => String(n).padStart(2, '0');
/** El día en la hora de la PC, AAAA-MM-DD. */
export const diaLocal = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
export const esViernes = (d) => d.getDay() === 5;

/** La hora de ahora; en una prueba (VITEST), la de VIERNES_HOY_PRUEBA si es una fecha válida. */
export function ahoraDe(env = process.env) {
  const p = String(env?.[VAR_HOY_PRUEBA] ?? '').trim();
  if (p && env?.VITEST) { const d = new Date(p); if (!Number.isNaN(d.getTime())) return d; }
  return new Date();
}

const raizRegistros = (env) => path.join(env?.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Claude', 'claude-code-sessions');

function subcarpetas(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => path.join(dir, e.name)); } catch { return []; }
}
function leerJson(ruta) { try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { return null; } }

/**
 * El registro que la app guardó de ESTA sesión, o null. Primero por `CLAUDE_CODE_HOST_SESSION_ID` (nombre de
 * archivo); si no vino, por `cliSessionId` entre las fichas tocadas en los últimos 2 días. Nunca tira.
 */
export function buscarRegistro({ env = process.env, cliId = null, ahora = new Date() } = {}) {
  const raiz = raizRegistros(env);
  const carpetas = subcarpetas(raiz).flatMap(subcarpetas);
  const hostId = String(env?.CLAUDE_CODE_HOST_SESSION_ID ?? '').trim();
  if (ID_APP.test(hostId)) {
    for (const c of carpetas) {
      const ruta = path.join(c, `${hostId}.json`);
      if (fs.existsSync(ruta)) { const j = leerJson(ruta); return j ? { registro: j, por: 'host' } : null; }
    }
  }
  // sin el id de la app (o sin su ficha): por el id de la charla, que tiene que coincidir exacto
  if (!cliId) return null;
  for (const c of carpetas) {
    let nombres = [];
    try { nombres = fs.readdirSync(c).filter((n) => /^local_.*\.json$/i.test(n)); } catch { continue; }
    for (const n of nombres) {
      const ruta = path.join(c, n);
      try { if (ahora.getTime() - fs.statSync(ruta).mtimeMs > DOS_DIAS) continue; } catch { continue; }
      const j = leerJson(ruta);
      if (j && j.cliSessionId === cliId) return { registro: j, por: 'cli' };
    }
  }
  return null;
}

/**
 * La decisión, sin tocar nada: { avisar, motivo }. `encontrado` es lo que devolvió buscarRegistro (o null);
 * `ultimoAviso` es el día (AAAA-MM-DD) del último aviso en esta PC, o null.
 */
export function decidir({ ahora, payload, env = {}, encontrado = null, ultimoAviso = null }) {
  if (!esViernes(ahora)) return { avisar: false, motivo: 'no es viernes' };
  const fuente = payload && typeof payload.source === 'string' ? payload.source : null;
  if (fuente !== 'startup') return { avisar: false, motivo: `arranque «${fuente ?? 'sin source'}», no una sesión nueva` };
  if (String(env.CLAUDE_CODE_HOST_SCHEDULED_RUN ?? '') === '1') return { avisar: false, motivo: 'corrida programada (CLAUDE_CODE_HOST_SCHEDULED_RUN)' };
  if (!encontrado || !encontrado.registro || typeof encontrado.registro !== 'object') return { avisar: false, motivo: 'no encontré el registro de la app: ante la duda, callo' };
  const r = encontrado.registro;
  // La variable del id de la app se hereda: un `claude` lanzado desde el Bash de una sesión de Fak tendría la ficha de
  // ella con OTRO id de charla (auditor 16/10, R4). Si la ficha ya trae su id de charla y no es este, no es esta sesión.
  const cliId = payload && typeof payload.session_id === 'string' ? payload.session_id : null;
  if (r.cliSessionId && cliId && r.cliSessionId !== cliId) return { avisar: false, motivo: 'la ficha de la app es de otra charla (id distinto)' };
  if (r.spawnedFrom) return { avisar: false, motivo: 'la lanzó otra sesión (spawnedFrom)' };
  if (r.scheduledTaskId) return { avisar: false, motivo: `la lanzó el reloj (scheduledTaskId ${r.scheduledTaskId})` };
  if (ultimoAviso === diaLocal(ahora)) return { avisar: false, motivo: 'ya se propuso hoy en esta PC' };
  return { avisar: true, motivo: `la abrió Fak (registro por ${encontrado.por})` };
}

/** El renglón para la sesión. Las fechas de los 4 números: del viernes anterior a hoy. */
export function aviso(ahora) {
  const hoy = diaLocal(ahora);
  const antes = diaLocal(new Date(ahora.getTime() - 7 * 86400000));
  return `${MARCA} Hoy es viernes y esta sesión la abrió Fak. Al final de tu primera respuesta, en UN renglón que empiece con «Propongo:», sugerile el ritual de los viernes (Fak 15/10: «que él lo sepa y me lo sugiera»; no es tarea programada, decide él): (1) revisar la semana con los 4 números (\`node scripts/_cuatroNumeros.mjs --desde ${antes} --hasta ${hoy}\`, con el cupo de \`get_usage\` en --cupo) y lo que quedó en la cola; (2) lanzar el equipo «fuera de la caja» con la plantilla de la nube de Ingeniería \`Claude Fak\\viernes-17-plan-sistema\\20-informes\\oportunidades\\00_encargo_equipo.md\`; (3) cruzar, decidir con evidencia y llevarle solo lo que es suyo; (4) implementar el fin de semana o el mismo viernes. Si ya está planificando o dice que no, no se insiste hoy. Memoria \`feedback_viernes_de_planificacion_equipo_fuera_de_la_caja\`.`;
}

const rutaMarca = () => path.join(os.homedir(), '.claude', '.viernes-planificacion');
const rutaLog = () => path.join(os.homedir(), '.claude', '.viernes-planificacion.log');
function leerMarca() { try { return fs.readFileSync(rutaMarca(), 'utf8').trim() || null; } catch { return null; } }

/** El hook entero: decide, imprime si corresponde y anota. Devuelve el texto impreso ('' si calla). Nunca tira. */
export function correrHook(payload, env = process.env) {
  const ahora = ahoraDe(env);
  if (!esViernes(ahora)) return '';   // el resto de la semana no se lee nada ni se anota nada
  let decision;
  let texto = '';
  try {
    const cliId = payload && typeof payload.session_id === 'string' ? payload.session_id : null;
    const encontrado = buscarRegistro({ env, cliId, ahora });
    decision = decidir({ ahora, payload, env, encontrado, ultimoAviso: leerMarca() });
    if (decision.avisar) {
      texto = aviso(ahora);
      fs.mkdirSync(path.dirname(rutaMarca()), { recursive: true });
      fs.writeFileSync(rutaMarca(), `${diaLocal(ahora)}\n`);
    }
  } catch (e) {
    decision = { avisar: false, motivo: `error: ${String(e && e.message ? e.message : e).slice(0, 120)}` };
    texto = '';
  }
  try {
    const sesion = (payload && payload.session_id) || '-';
    fs.appendFileSync(rutaLog(), `${ahora.toISOString()} ${sesion} ${env?.CLAUDE_CODE_HOST_SESSION_ID || '-'} ${decision.avisar ? 'AVISO' : 'calla'} ${decision.motivo}\n`);
  } catch { /* el arranque no se frena por el registro */ }
  return texto;
}

const comoScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (comoScript) {
  if (process.argv.includes('--hook')) {
    let crudo = '';
    process.stdin.on('data', (d) => { crudo += d; });
    process.stdin.on('end', () => {
      let j = null; try { j = JSON.parse(crudo); } catch { j = null; }
      const t = correrHook(j);
      if (t) console.log(t);
      process.exit(0);
    });
  } else {
    console.log('uso: node scripts/_lib/viernesPlanificacion.mjs --hook   (stdin: el JSON del SessionStart)');
    process.exit(2);
  }
}
