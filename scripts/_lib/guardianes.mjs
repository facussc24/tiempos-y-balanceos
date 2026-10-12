/**
 * guardianes.mjs — los guardianes PreToolUse de Bash/PowerShell/Write/Edit, en UN solo node.
 *
 * POR QUE EXISTE (medido 04-05/09/2026, Ola 2 del plan de mejoras):
 *   El despachador `_dispatcher.sh` corria 13 guardianes bash en subshell, y cada uno hacia
 *   `$(cat)`, `printf | grep` por chequeo y algun `date`: 50-60 procesos por llamada, que en
 *   msys (Windows) cuestan 2,6-3,5 s con la maquina tranquila y 6-12 s con otras sesiones
 *   abiertas. Con 11.400 Bash/Edit/Write en dos semanas son horas de espera. Aca el matching
 *   de los 13 corre dentro del unico node que el despachador ya levantaba para parsear el JSON.
 *
 * CONTRATO (identico al de un hook suelto):
 *   exit 0 = permite · exit 2 = bloquea y el stderr va a Claude.
 *   Novedad 05/09/2026: los RECORDATORIOS 1x/hora (escritorio, cad, patrones, HO, consumos,
 *   rule-gate) ya NO bloquean. Salen como `additionalContext` (JSON en stdout, exit 0): el
 *   texto le llega al modelo en el mismo turno sin perder la llamada ni forzar el reintento.
 *   Medido 21/08-04/09: ~250 de los 350 bloqueos eran recordatorios. Los bloqueos reales
 *   (borrar en el Escritorio, mover a TERMINADAS, .Send() suelto, cerrar el arb, borrado
 *   masivo, push sin build, renumerar sin leer, .env) siguen con exit 2.
 *   Si en la misma llamada hay un bloqueo, los recordatorios no se emiten ni consumen su
 *   cooldown: la herramienta no va a correr y el aviso se perderia; saltan en el reintento.
 *
 * FALLA HACIA EL LADO SEGURO:
 *   · JSON roto: los campos quedan vacios de verdad (ctx.ok=false) y cada guardian cae a su
 *     red de seguridad sobre el JSON crudo, como hacian los .sh. Ademas se rescata a mano lo
 *     que se pueda ("command":"...") para que la red vea el comando y no solo comillas.
 *   · Un guardian que tira una excepcion BLOQUEA con el error: un guardian que no corre
 *     parece un guardian que aprobo (leccion del despachador, 2026-08-04).
 *
 * COMO SE USA:
 *   Despachador:  node -e '<parseo>' | import(este modulo).despachar(json, tmpdir)
 *   Suelto:       printf '%s' "$JSON" | node scripts/_lib/guardianes.mjs --solo escritorio-guard
 *   Los `.claude/hooks/X-guard.sh` son wrappers finos que hacen exactamente eso, para que los
 *   tests existentes (.test.sh y Vitest) sigan corriendo cada guardian por su ruta de siempre.
 *   Con variables HOOK_FILE / HOOK_PARSED4 / HOOK_CMD en el entorno y `--solo`, no lee stdin
 *   (asi lo invoca causas-ajenas-guard.test.sh).
 *
 * `supabase-guard` es la excepcion: aca solo se DETECTA el script destructivo (marca
 * `supabase` en el tmpdir); el backup lo sigue corriendo `.claude/hooks/supabase-guard.sh`,
 * que el despachador invoca unicamente cuando hay marca. Antes el backup corria aunque otro
 * guardian bloqueara el comando; ahora solo si el comando va a correr.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sinCuerposHeredoc, sinCuerposHeredocDeGit, sinArgumentosDeCommit, analizarComando, comandosSimples, separarHeredocs } from './shellTexto.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pedidoDeEnvio, evaluarEnvio } from './mailOkFak.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..', '..');
export const COOLDOWN_S = 3600;
const CORTE = 6000;      // mismo corte que usaba el despachador para parsed4/parsed3
const TRUNC_HINT = 3900; // borrado-masivo: si el cuerpo llego cerca del tope, suma el JSON crudo
export const INLINE_MAX = 3000; // script-inline-guard: caracteres de script pegado que se toleran

// ─────────────────────────────────────────────────────────────────────────── utilidades

const limpiar = (x) => String(x ?? '').replace(/[\x1f\n\r]/g, ' ');

/** Ruta msys (/c/Users/x, /tmp) → ruta que node entiende. */
function aRutaWin(p, porDefecto) {
  if (!p) return porDefecto;
  if (p === '/tmp' || p.startsWith('/tmp/')) return path.join(os.tmpdir(), p.slice(4));
  const m = p.match(/^\/([a-zA-Z])\/(.*)$/);
  if (m) return `${m[1].toUpperCase()}:/${m[2]}`;
  if (p.startsWith('/')) return porDefecto;
  return p;
}
export const dirTmp = (env = process.env) => aRutaWin(env.TMPDIR, os.tmpdir());
export const dirHome = (env = process.env) => aRutaWin(env.HOME, os.homedir());

function cooldownVigente(flag, ahora) {
  try {
    const last = parseInt(fs.readFileSync(flag, 'utf8').trim(), 10);
    return Number.isFinite(last) && last > 0 && ahora - last < COOLDOWN_S;
  } catch { return false; }
}
function marcarFlag(flag, ahora) {
  try { fs.mkdirSync(path.dirname(flag), { recursive: true }); fs.writeFileSync(flag, String(ahora)); } catch { /* sin permiso: se recuerda otra vez, no se cae */ }
}

// RECORDATORIOS "UNA VEZ POR SESION" (30/09/2026). Medido en septiembre (98 sesiones): 428
// inyecciones de recordatorios 1x/h (CAD, Escritorio, CC/SC, HO), ~175 mil tokens: el aviso
// que salia cada hora se repetia dentro de la misma sesion, que ya lo tenia en contexto. Ahora
// cada recordatorio sale UNA vez por sesion: la clave es el `session_id` del payload (y el
// `agent_id` si la llamada viene de un subagente, que tiene su propio contexto y no vio el
// aviso del padre). Las marcas de una sesion viven en UN archivo del TEMP, una linea por
// recordatorio ya mostrado. Sin `session_id` (JSON roto, payload sin el campo) se vuelve al
// cooldown de una hora por recordatorio: fallar hacia el lado de avisar de mas, no de menos.
const limpiarId = (x) => String(x ?? '').replace(/[^\w-]/g, '_');
function archivoMarcasSesion(sesion, env) {
  const clave = [sesion.sid, sesion.agente].filter(Boolean).map(limpiarId).join('.');
  return path.join(dirTmp(env), `claude-recordatorios.${clave}`);
}
function recordatoriosYaMostrados(archivo) {
  try { return new Set(fs.readFileSync(archivo, 'utf8').split(/\r?\n/).filter(Boolean)); } catch { return new Set(); }
}
function marcarRecordatorioDeSesion(archivo, clave) {
  try { fs.mkdirSync(path.dirname(archivo), { recursive: true }); fs.appendFileSync(archivo, `${clave}\n`); } catch { /* sin permiso: se recuerda otra vez, no se cae */ }
}

const bloqueo = (texto) => ({ tipo: 'bloqueo', texto });
const aviso = (texto) => ({ tipo: 'aviso', texto });
const recordatorio = (flag, texto) => ({ tipo: 'recordatorio', flag, texto });

function raizProyecto(env) {
  if (env.CLAUDE_PROJECT_DIR) return aRutaWin(env.CLAUDE_PROJECT_DIR, RAIZ);
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  const top = r.status === 0 ? r.stdout.trim() : '';
  return top ? aRutaWin(top, RAIZ) : '.';
}

/** Saca comentarios (#, //, bloques) para que una PROSA que nombra `rm`/`mv` no parezca codigo. */
function sinComentarios(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((l) => l.replace(/(^|\s)(#|\/\/).*$/, '$1'))
    .join('\n');
}

// `sinCuerposHeredoc` vive en shellTexto.mjs desde el 10/09/2026 (la comparte cierreGuard.mjs);
// se re-exporta para que los tests y quien la importaba de aca sigan andando.
export { sinCuerposHeredoc };

// ─────────────────────────────────────────────────────────────────────────── parseo

/** Rescate a mano de campos de un JSON que no parsea (truncado, comilla sin cerrar). */
function rescatarCampos(raw) {
  const des = (s) => s.replace(/\\(["\\/bfnrt]|u[0-9a-fA-F]{4})/g, (m, c) =>
    ({ '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' })[c] ?? String.fromCharCode(parseInt(c.slice(1), 16)));
  const campo = (k) => { const m = raw.match(new RegExp(`"${k}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`)); return m ? des(m[1]) : ''; };
  return { tool: campo('tool_name'), cmd: campo('command'), file: campo('file_path'), content: campo('content') || campo('new_string'), sid: campo('session_id'), agente: campo('agent_id') };
}

/**
 * Contexto que ven los guardianes. Replica lo que el despachador exportaba en HOOK_*:
 *   cmd/file/content/target = crudos · cmd6/body6/toolL/fileL = limpios y cortados a 6000
 *   parsed4/parsed3 = los campos unidos por \x1f (lo que recibian cad/patrones/borrado/mail
 *   y escritorio). Con ok=false todo eso queda VACIO y `raw` es la red de seguridad.
 */
export function parsear(raw) {
  raw = String(raw ?? '');
  let j = null;
  try { j = JSON.parse(raw); } catch { j = null; }
  if (!j || typeof j !== 'object') {
    const r = rescatarCampos(raw);
    return { ok: false, raw, rescate: r, tool: '', cmd: '', file: '', content: '', cwd: '', target: '', cmd6: '', body6: '', toolL: '', fileL: '', parsed4: '', parsed3: '', sid: r.sid, agente: r.agente };
  }
  const t = j.tool_input && typeof j.tool_input === 'object' ? j.tool_input : {};
  // `cwd` es el directorio de la sesion cuando corre la tool (22/09/2026): con el, un `rm x`
  // relativo se sabe DONDE borra sin adivinarlo por palabras sueltas del comando.
  // `session_id` (y `agent_id`, solo cuando la llamada sale de un subagente) son la clave de los
  // recordatorios "una vez por sesion": ver `resolver`.
  return armarCtx({ raw, tool: String(j.tool_name ?? ''), cmd: String(t.command ?? ''), file: String(t.file_path ?? ''), content: String(t.content ?? t.new_string ?? ''), cwd: typeof j.cwd === 'string' ? j.cwd : '', sid: typeof j.session_id === 'string' ? j.session_id : '', agente: typeof j.agent_id === 'string' ? j.agent_id : '' });
}

function armarCtx({ raw, tool, cmd, file, content, parsed4, cwd = '', sid = '', agente = '' }) {
  const toolL = limpiar(tool), cmd6 = limpiar(cmd).slice(0, CORTE), fileL = limpiar(file), body6 = limpiar(content).slice(0, CORTE);
  return {
    ok: true, raw, rescate: null, tool, cmd, file, content, cwd, sid, agente, target: `${cmd} ${file}`,
    cmd6, body6, toolL, fileL,
    parsed4: parsed4 ?? [toolL, cmd6, fileL, body6].join('\x1f'),
    parsed3: [toolL, cmd6, fileL].join('\x1f'),
  };
}

/** Contexto armado desde las variables HOOK_* (modo --solo sin stdin, como lo usa un .test.sh). */
export function ctxDesdeEnv(env) {
  const p4 = env.HOOK_PARSED4 ?? '';
  const partes = p4.includes('\x1f') ? p4.split('\x1f') : null;
  const tool = partes ? partes[0] : '';
  const cmd = env.HOOK_CMD ?? (partes ? partes[1] : '');
  const file = env.HOOK_FILE ?? (partes ? partes[2] : '');
  const content = partes ? partes[3] : (env.HOOK_CMD !== undefined ? '' : p4);
  return armarCtx({ raw: '', tool, cmd, file, content, parsed4: p4 || undefined });
}

// ─────────────────────────────────────────────────────────────────────────── matriz

/**
 * Que guardian corre con que herramienta — replica EXACTO los matchers que vivian en
 * settings.json antes del despachador (2026-08-04). Si corrieran todos siempre, guardianes
 * que hoy no ven un Write empezarian a verlo: eso es cambiar el comportamiento, no acelerarlo.
 */
const SOLO_SHELL = ['supabase-guard', 'validator-check', 'renumber-guard', 'push-guard', 'commit-rutas-guard', 'arb-cerrar-guard', 'script-inline-guard', 'secretos-guard'];
const SOLO_ARCHIVO = ['file-guard', 'causas-ajenas-guard'];
const LOS_CUATRO = ['consumos-entregable-guard', 'cad-guard', 'patrones-guard', 'escritorio-guard', 'borrado-masivo-guard', 'ho-numeracion-guard', 'mail-guard', 'documentacion-oficial-guard', 'video-maquina-guard', 'caracteristicas-especiales-guard', 'apqp-cliente-guard', 'nube-personal-guard', 'firma-ia-guard'];
export const TODOS = ['file-guard', 'supabase-guard', 'validator-check', 'renumber-guard', 'push-guard', 'commit-rutas-guard', 'script-inline-guard', 'secretos-guard', ...LOS_CUATRO, 'arb-cerrar-guard', 'causas-ajenas-guard'];

export function matriz(tool) {
  // Si no se pudo leer el tool_name, NO se adivina: corren TODOS. Fallar hacia el lado seguro
  // es correr de mas, nunca de menos.
  if (tool === '') return TODOS.slice();
  const g = [];
  if (tool === 'Bash' || tool === 'PowerShell') g.push(...SOLO_SHELL);
  if (tool === 'Edit' || tool === 'Write') g.push(...SOLO_ARCHIVO);
  if (['Bash', 'PowerShell', 'Write', 'Edit'].includes(tool)) g.push(...LOS_CUATRO);
  return g;
}

// ─────────────────────────────────────────────────────────────────────────── guardianes
// Cada uno recibe (ctx, { ahora, env }) y devuelve null, un veredicto o una lista de veredictos:
//   bloqueo(texto) · recordatorio(flag, texto) · aviso(texto) · { tipo: 'supabase' }

export const GUARDIANES = {};

// ── file-guard ─────────────────────────────────────────────────────────────
// Bloquea edits a archivos protegidos (lockfile, .env, .git). Y al tocar una regla de
// .claude/rules/ recuerda 1x/h el gate de enforcement (skill rule-enforcement-gate: toda
// regla con SIEMPRE/NUNCA nace con check ejecutable en la misma sesion).
GUARDIANES['file-guard'] = (ctx, { env }) => {
  if (!ctx.file) return null;
  const f = ctx.file.replace(/\\/g, '/');
  if (f.endsWith('package-lock.json') || f.endsWith('.env') || f.includes('.env.') || f.endsWith('.qr-secret') || f.includes('/.git/')) {
    return bloqueo(`BLOCKED: ${f} es archivo protegido`);
  }
  if (/\.claude\/rules\/.*\.md$/.test(f)) {
    return recordatorio(path.join(dirTmp(env), 'claude-rule-gate.flag'),
      `RULE-GATE: estas editando una regla (${f}). Si declara un SIEMPRE/NUNCA operativo, cargala con su ENFORCEMENT ejecutable en esta misma sesion (hook, check del validator o gate de script) — skill rule-enforcement-gate. Si ya lo tenes cubierto o es solo prosa informativa, segui.`);
  }
  return null;
};

// ── secretos-guard ─────────────────────────────────────────────────────────
// Bloquea que un comando de shell LEA o PISE un archivo de secretos: `.env`, `.env.<algo>`
// (menos `.env.example`, que es la plantilla) y `.qr-secret`. El deny de settings
// (`Read(**/.env.local)`) cubre la tool Read, no Bash: la auditoria del entorno del 04/09/2026
// (H7 del plan de mejoras) probo `head -c 1 .env.local | wc -c` -> 1, y `.qr-secret` no
// figuraba en ningun deny. Lo que se frena es que el CONTENIDO llegue al contexto de la sesion
// (y de ahi al transcript, que se sincroniza a la nube) o que un `>` lo pise.
// Pasa: los scripts del repo que lo leen por dentro (el comando no nombra al archivo), cp/copy
// (memoria worktree_sin_env_local), ls/stat/test -f, git, un grep que lo nombra ENTRE COMILLAS
// como patron (buscar quien lo usa no es leerlo), y un heredoc o un -m que lo mencionan (los
// verbos se buscan fuera de las comillas; el nombre del archivo, adentro tambien, porque
// `python -c "open('.env.local')"` es justamente la lectura). En bypass es una red, no un candado.
const SECRETO_SRC = String.raw`(?:^|[\s"'\x60=(\/\\:])(\.env(?:\.(?!example\b)[\w.-]+)?|\.qr-secret)(?=$|[\s"'\x60|;&)>\\/])`;
const SECRETO_RE = new RegExp(SECRETO_SRC, 'i');
const LECTORES_RE = /(?:^|[\s|;&(`])(?:cat|type|head|tail|less|more|bat|strings|od|xxd|hexdump|base64|nl|tac|rev|cut|paste|column|tee|source|python[\d.]*|py|node|perl|ruby|php|pwsh|powershell|Get-Content|gc|Out-String|Import-Csv|Format-Table|ft)(?=\s|$)/i;
const PATRONEROS_RE = /(?:^|[\s|;&(`])(?:grep|egrep|fgrep|rg|ag|sed|awk|findstr|Select-String|sls)(?=\s|$)/i;
const REDIRECCION_RE = /[<>]{1,2}\s*["']?(?:[^\s"'|;&<>]*[\/\\])?\.(?:env(?:\.(?!example\b)[\w.-]+)?|qr-secret)(?=$|[\s"'|;&)])/i;
const SOURCE_PUNTO_RE = /(?:^|[;&|(]\s*)\.\s+\S*\.env(?:\.[\w.-]+)?(?=$|[\s;&|)])/;
const sinComillas = (s) => s.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, ' "" ');

/** null si el comando no lee ni pisa un secreto; si no, { como: 'lectura'|'redireccion'|'source', nombres }. */
export function comandoTocaSecreto(cmd) {
  const c = sinCuerposHeredoc(String(cmd ?? ''));
  if (!SECRETO_RE.test(c)) return null;
  const nombres = [...new Set([...c.matchAll(new RegExp(SECRETO_SRC, 'gi'))].map((m) => m[1]))];
  if (REDIRECCION_RE.test(c)) return { como: 'redireccion', nombres };
  if (SOURCE_PUNTO_RE.test(c)) return { como: 'source', nombres };
  const pelado = sinComillas(c);
  if (LECTORES_RE.test(pelado)) return { como: 'lectura', nombres };
  if (PATRONEROS_RE.test(pelado) && SECRETO_RE.test(pelado)) return { como: 'lectura', nombres };
  return null;
}

GUARDIANES['secretos-guard'] = (ctx) => {
  if (!ctx.ok || !ctx.cmd) return null;
  const t = comandoTocaSecreto(ctx.cmd);
  if (!t) return null;
  const verbo = t.como === 'redireccion' ? 'pisa' : 'lee';
  return bloqueo(`[SECRETOS-GUARD] BLOQUEADO: el comando ${verbo} un archivo de secretos (${t.nombres.join(', ')}).
Su contenido no entra al contexto de la sesion: queda en el transcript, que se sincroniza a la nube.
Los scripts del repo lo leen por dentro y no lo imprimen (node scripts/_backup.mjs, _nube.mjs, los
_tmp_query con dotenv): correlos por ruta. A la sesion le alcanza con saber que existe: ls -la,
test -f. Para un worktree: cp .env.local <worktree>/.env.local. Buscar quien lo usa: grep con el
patron entre comillas. Si hace falta un VALOR, lo mira Fak: aca no se tipea ni se pega (memoria
supabase_no_rotar_decidido: una clave filtrada no se rota).`);
};

// ── causas-ajenas-guard ────────────────────────────────────────────────────
// Bloquea RECONSTRUCCIONES CAUSALES de errores ajenos sin fuente, en los archivos donde una
// especulacion se vuelve permanente (memorias, reglas, LECCIONES).
// INCIDENTE 21/08/2026: escribi en memoria, como hecho, que un consumo de 15 g/pieza "salia de
// leer el numero del codigo AD-ADFA15". No habia fuente: era una historia causal sobre una
// coincidencia numerica. Se cito a si misma en sesiones siguientes y le gano a una correccion
// verbal de Fak ("es una gran fantasia tuya... estoy cansado de que digas todo eso").
// CAUSA RAIZ: core-prohibiciones §1 prohibe inventar DATOS y ese filtro funciona; no se activa
// con las EXPLICACIONES. Un mecanismo causal es una afirmacion sobre el mundo y necesita
// evidencia igual que un numero — y ademas acusa por implicacion a una persona real de Barack.
// Describir el ESTADO ("el doc dice A, el envase dice B") pasa siempre; narrar COMO se llego, no.
const CAUSAS_GENERO = [
  /se comi[oó] (?:la coma|el \d)/gi,
  /nadie (?:recalcul|revis|declar|convirti|renegoci|avis|not)/gi,
  /alguien (?:lo )?(?:copi|edit|aplic|retipe|carg|puso|ley)/gi,
  /confundi(?:o|ó|eron)/gi,
  /l[oa]s? leyeron mal|leerlo mal|invita a leer/gi,
  /sale de leer|copiado plano/gi,
  /nunca se (?:le )?comunic/gi,
  /sin que nadie/gi,
];
// Marcadores que convierten la frase en legitima: una FUENTE, o una HIPOTESIS declarada.
const CAUSAS_OK = /fuente|mail del|mail de|textual|dijo|dice el|segun|hilo |PROHIBIDO|ejemplo|hipotesis|hipótesis|probablemente|posiblemente|puede ser|no verificado|no consta|sin registro|TBD|\bcita\b/i;

export function frasesCausalesSinFuente(txt) {
  const malas = [];
  for (const re of CAUSAS_GENERO) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(txt))) {
      const ini = Math.max(0, m.index - 300), fin = Math.min(txt.length, m.index + m[0].length + 300);
      if (!CAUSAS_OK.test(txt.slice(ini, fin))) malas.push(m[0]);
    }
  }
  return [...new Set(malas)];
}

GUARDIANES['causas-ajenas-guard'] = (ctx) => {
  if (!ctx.file) return null;
  // Las rutas llegan con barra de Windows: el .sh original comparaba globs con `/` y por eso
  // no veia las memorias escritas por la tool Write (C:\...\memory\x.md). Se normaliza.
  const f = ctx.file.replace(/\\/g, '/');
  const enAlcance = (f.includes('/memory/') && f.endsWith('.md')) || f.endsWith('MEMORY.md')
    || f.endsWith('LECCIONES_APRENDIDAS.md') || (f.includes('/.claude/rules/') && f.endsWith('.md'));
  if (!enAlcance) return null;
  // El archivo que DOCUMENTA la regla cita las frases como ejemplos: no puede autobloquearse.
  if (f.endsWith('no_inventar_causas_de_errores_ajenos.md') || f.includes('causas-ajenas-guard')) return null;
  const txt = ctx.content || ctx.parsed4;
  if (!txt) return null;
  const hits = frasesCausalesSinFuente(txt);
  if (!hits.length) return null;
  return bloqueo(`[CAUSAS-AJENAS-GUARD] Estas por escribir una RECONSTRUCCION de como se equivoco un tercero,
sin fuente al lado. Frase(s): ${hits.join('|').slice(0, 200)}

Regla core-prohibiciones §1: inventar incluye las EXPLICACIONES CAUSALES, no solo los numeros.
Incidente 21/08/2026 — Fak: "es una gran fantasia tuya".

Como se arregla:
  - Escribi el ESTADO, no el mecanismo:  "la BOM dice 18 KG y la etiqueta dice 15 Kg"
    en vez de  "confundieron litros con kilos".
  - Si tenes la fuente, citala en la misma frase: "mail del 11/12/2025", "fuente: FT120".
  - Si es una inferencia, marcala: "probablemente", "no consta", "sin registro", "TBD".
  - Una coincidencia numerica NO es una fuente.`);
};

// ── firma-ia-guard ─────────────────────────────────────────────────────────
// Ningun documento de Barack dice que lo hizo Claude o una IA (Fak, 08/10/2026: el listado de
// hojas de proceso tenia "Claude" en CREADO POR de 14 filas y una pestaña oculta
// "_CONTEXTO_CLAUDE"; *"es un error gravisimo, no puede volver a suceder nunca... en ningun tipo de
// documento"*). Este guardian frena en la ESCRITURA, mirando el texto del comando o del archivo:
//   1. un campo de autoria con una IA de valor   (CREADO POR / Elaboro / author / creator = Claude)
//   2. una IA escrita en un objeto de documento  (.Value = 'Claude', ws['J74'] = ..., create_sheet('..CLAUDE'),
//      core_properties.author = ..., add_paragraph('.. Claude ..'))
//   3. un archivo o carpeta con "claude" en el nombre adentro del servidor Y:\ o de la nube de Ingenieria
//   4. un Write/Edit de un archivo que vive en Y:\, en la nube de Ingenieria o en exports/ con una IA en el texto
// Lo que un script escribe por dentro no se ve aca: eso lo ataja el detector (`scripts/_sinFirmaIA.py`)
// en el cierre del turno y en los que mandan, imprimen o archivan. Tests: __tests__/scripts/firmaIAGuard.test.mjs.
const IA_NOMBRES = String.raw`claude|anthropic|chat\s?gpt|openai|gemini|copilot`;
const FIRMA_CAMPO = String.raw`(?:cread[oa][_\s-]+por|elaborad[oa][_\s-]+por|hech[oa][_\s-]+por|realizad[oa][_\s-]+por|modificad[oa][_\s-]+por|preparad[oa][_\s-]+por|redactad[oa][_\s-]+por|elabor[oó]|realiz[oó]|confeccion[oó]|prepar[oó]|redact[oó]|modific[oó]|autor(?:es)?|authors?|creator|created[_\s]?by|prepared[_\s]?by|modified[_\s]?by|updated[_\s]?by|last[_\s]?modified[_\s]?by|lastmodifiedby)(?![a-záéíóú])`;
const FIRMA_AUTORIA_RE = new RegExp(String.raw`${FIRMA_CAMPO}["'\]\x60]?\s*[:=,]?\s*[(\[]?\s*[fFrRbBuU]?["'\x60]?\s*(?:${IA_NOMBRES}|ia(?![a-z])|ai(?![a-z]))`, 'i');
// Una pasada por tipo de comilla: un `python -c "ws.Value = 'Claude'"` tiene el literal simple ADENTRO del doble.
const FIRMA_LITERALES_RE = ['"', "'", '\x60'].map((q) => new RegExp(String.raw`${q}([^${q}\n]*?(?:${IA_NOMBRES})[^${q}\n]*?)${q}`, 'gi'));
const FIRMA_PREFIJO_RE = /(?:\.(?:value2?|formula|text|name|caption|title|author|comments?|subject|keywords|description|last_modified_by|lastmodifiedby|creator|category)\s*=\s*|\]\s*=\s*|\b(?:create_sheet|add_paragraph|add_run|add_textbox|add_heading|add_slide|add_comment|add_table|setcellvalue|insert_text|write_string|write_rich_string|cell)\s*\([^()\n]*?)$/i;
// P16 (11/10/2026, R6: 3 de 6 falsos): el `Add(` de COM (`Sheets.Add(`, `Comments.Add(rng, …)`) va aparte y SIN la
// bandera i. Con ella, el `.add(` de un Set o de una lista (`carpetas.add('Claude Fak')`, `s.add('CLAUDE.md')`) contaba
// como escribir en un documento.
const FIRMA_PREFIJO_ADD_RE = /\bAdd\s*\([^()\n]*?$/;
// ...pero el `.add(` de una COLECCION de un documento cuenta en cualquier caja: COM no distingue mayusculas y xlwings
// lo escribe en minuscula (`wb.sheets.add('_CONTEXTO_…')`, `wb.Names.add(…)`, `ws.Comments.add(…)`). Auditor, 11/10/2026.
const FIRMA_PREFIJO_COLECCION_RE = /(?:\b(?:sheets|worksheets|names|comments|shapes|slides|paragraphs|tables|charts|pictures|notes)|[\w$\])]\.[A-Za-z_]\w*)\.add\s*\([^()\n]*?$/i;
// (El borrador de P16 traia ademas una excepcion por «nombre propio»: un literal que fuera exactamente `CLAUDE.md` o
// `Claude Fak` no contaba. El auditor la saco el 11/10/2026: no liberaba ninguno de los 39 frenos reales de la historia
// y dejaba pasar una celda o una pestaña con ese nombre.)
const FIRMA_RAIZ_RE = /(?:^|[\s"'=])(?:[yY]:[\\/]|\/y\/|[^"'\n]*Ingenier[ií]a y Proyecto)/;
// P16: «Claude Fak» y CLAUDE.md quedan exentos tambien SIN barra final (`cd ".../Claude Fak" && node …`): el nombre
// exacto seguido de barra, comilla o fin. Un espacio NO alcanza: «Claude Fak notas» o «Claude Fakultad» son otra carpeta.
// La carpeta exenta es la de la BIBLIOTECA de Ingenieria: una carpeta «Claude Fak» en el servidor (`Y:\...`) no lo es
// (auditor, 11/10/2026).
const FIRMA_EXENTOS_RE = /(?:[\\/]\.claude[\\/]|[\\/]memory[\\/]|[\\/]docs[\\/]|[\\/]__tests__[\\/]|[\\/]_archive[\\/]|[\\/]claude-area[\\/]|CLAUDES_POR_AREA|CLAUDE POR AREA|Claude Barack|Base Claude Ingenieria|INSTALAR CLAUDE|ACTUALIZACION_CLAUDE|Ingenier[ií]a y Proyecto - General(?:[\\/][^\\/"'\n]+[\\/]\.\.)?[\\/]Claude Fak(?=[\\/"']|$)|firmaIA|_sinFirmaIA|_limpiarListadoHoClaude|guardianes\.mjs|cierreGuard\.mjs|CLAUDE\.md(?=["']|$)|LECCIONES_APRENDIDAS\.md$|MEMORY\.md$|\.claude[\\/])/i;
// Comandos que solo leen o que guardan texto que no es un documento (un mensaje de commit lleva
// "Co-Authored-By: Claude" por convencion del repo, y no sale de aca como documento de Barack).
//
// HOY-16 (11/10/2026, con el si de Fak del 10/10 23:57 a «¿aflojo el guardian de firma para dos casos que hoy frena
// de mas?»). El criterio es el VERBO (¿el comando escribe?) y el DESTINO (¿un documento de Barack o el registro
// interno de la app?), nunca «si la ruta dice Claude, pasa». Tres cambios, los dos primeros aflojan y el tercero aprieta:
//   (a) Un comando de Bash de SOLO LECTURA no frena aunque no EMPIECE por un verbo de lectura (`esSoloLectura`): cada
//       comando simple de la linea y de sus sustituciones tiene que ser un verbo de lectura conocido. Caso: el
//       inventario del 10/10 12:12 (echo, for, find, wc, awk, ls, grep sobre la carpeta «Claude Fak»). Es estricto a
//       proposito: sin git, sin interpretes, sin redireccion a un archivo, sin heredoc, sin sustitucion de proceso, sin
//       comentarios, sin `$'…'`; awk y sed solo en su forma de imprimir. Lo que no reconoce cuenta como escritura.
//   (b) La regla 2 no frena el ID DE UN MODELO (`claude-opus-5-5`) cuando lo que el comando nombra es SOLO el registro
//       interno de la app o temporales (`destinoEsRegistroInterno`). Caso: 10/10 11:30, scheduled-tasks.json.
//   (c) El camino viejo (la linea EMPIEZA con un verbo de lectura o con git, `FIRMA_COMANDO_LECTURA_RE`) dejaba pasar
//       todo lo que viniera despues en la misma linea: `ls; python -c "ws['J74'] = …"` no frenaba (lo mostraron los
//       gemelos rojos de firmaIAGuard.test.mjs antes de tocar nada). Ahora ademas cada comando simple de esa linea
//       tiene que leer o ser de git (`lineaLeeOEsGit`). Medido contra 68.715 comandos reales de 12 dias.
// Auditor del 11/10/2026 (.sgc-cache/auditorias/HOY16_firma_ia_guard_auditor_2026-10-11.md): la primera version de
// (a) contaba a git en cualquier lugar de la linea y miraba awk/sed/uniq de mas: 9 escrituras pasaban. De ahi lo estricto.
// Agujero ANTERIOR que sigue (no es de este cambio): una linea que EMPIEZA con git y escribe afuera del repo
// (`git archive -o`, `git diff --output=`) pasa, como pasaba.
const FIRMA_COMANDO_LECTURA_RE = /^\s*(?:git|grep|rg|egrep|ls|dir|head|tail|less|find|wc|stat|Get-ChildItem|Select-String)\b/i;
const FIRMA_LEE = new Set(['echo', 'printf', 'ls', 'dir', 'grep', 'egrep', 'fgrep', 'cat', 'head', 'tail', 'wc', 'stat', 'du', 'df',
  'basename', 'dirname', 'cygpath', 'cut', 'tr', 'true', 'false', 'test', '[', '[[', 'pwd', 'date', 'cd', 'which', 'type']);
// palabras de la shell que van ADELANTE de un comando y no son el comando
const FIRMA_PALABRA_SHELL = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!']);
// comandos simples que son estructura (un `for d in a b c` solo nombra la lista; `fi`, `done` cierran)
const FIRMA_ESTRUCTURA = new Set(['for', 'fi', 'done', 'break', 'continue']);
const FIRMA_FIND_ESCRIBE = /^-(?:delete|exec|ok|fprint|fls)/;                   // por prefijo: -execdir, -okdir, -fprintf, -fprint0
// Lo que un texto no puede traer para contar como lectura: `$'…'` (escapes), `${x@P}` y parecidos, sustitucion de
// proceso `<( )` `>( )`, una barra invertida delante de un guion o de una letra de opcion (`\-o`), un comentario.
const FIRMA_LECTURA_PROHIBIDO_RE = /\$'|\$\{[^}]*[@!][^}]*\}|[<>]\(|\\-/;
/** ¿El texto trae una forma que el partidor de comandos no lee bien? El comentario se busca FUERA de las comillas
 *  (un `#12` adentro del mensaje de un commit no es un comentario; un `# don't` si, y su comilla se traga lo de abajo). */
function firmaFormaDudosa(t) {
  if (FIRMA_LECTURA_PROHIBIDO_RE.test(t)) return true;
  return /(?:^|\s)#/.test(String(t).replace(/"(?:[^"\\\n]|\\.)*"|'[^'\n]*'/g, '""'));
}

/** El cierre de una sustitucion `$(` que arranca en i (en el `$`), respetando comillas y parentesis. -1 si no cierra. */
function cierreSustitucion(s, i) {
  let prof = 0;
  for (let j = i + 1; j < s.length; j++) {
    const c = s[j];
    if (c === '\\') { j++; continue; }
    if (c === '"' || c === "'" || c === '\x60') { const k = s.indexOf(c, j + 1); if (k < 0) return -1; j = k; continue; }
    if (c === '(') prof++;
    else if (c === ')') { prof--; if (prof === 0) return j; }
  }
  return -1;
}
/** Las sustituciones de comando de una palabra (`$(...)` y backticks): su texto de adentro, o null si alguna no cierra. */
function sustitucionesDe(palabra) {
  const out = [];
  const s = String(palabra ?? '');
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\x60') { const k = s.indexOf('\x60', i + 1); if (k < 0) return null; out.push(s.slice(i + 1, k)); i = k; continue; }
    if (s[i] !== '$' || s[i + 1] !== '(') continue;
    const j = cierreSustitucion(s, i);
    if (j < 0) return null;
    out.push(s.slice(i + 2, j));
    i = j;
  }
  return out;
}

/** ¿Este comando simple solo lee? */
function comandoSimpleLee(c, prof) {
  // toda redireccion de salida tiene que ir a /dev/null; de entrada, solo `<` (un heredoc no se sabe que alimenta)
  for (const r of c.redirs) {
    if (r.op === '<') continue;
    if (!/^>{1,2}$/.test(r.op) || String(r.t).trim() !== '/dev/null') return false;
  }
  const palabras = [...c.palabras];
  // lo que venga adentro de una sustitucion tambien tiene que leer
  for (const w of palabras) {
    const subs = sustitucionesDe(w);
    if (subs === null) return false;
    for (const s of subs) if (!lineaSoloLee(s, prof + 1)) return false;
  }
  while (palabras.length && (FIRMA_PALABRA_SHELL.has(palabras[0]) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(palabras[0]))) palabras.shift();
  if (!palabras.length) return true;                                           // una asignacion o una palabra de la shell sola
  const verbo = palabras[0];
  const args = palabras.slice(1);
  if (FIRMA_ESTRUCTURA.has(verbo)) return true;
  if (verbo === 'find') return !args.some((a) => FIRMA_FIND_ESCRIBE.test(a));
  // sort, uniq: solo adentro de una cañeria, sin archivos (un segundo argumento de uniq es su SALIDA; sort tiene -o)
  if (verbo === 'sort' || verbo === 'uniq') return args.every((a) => /^-[a-zA-Z0-9,.]+$/.test(a) && !/o/.test(a));
  // awk: un solo programa, sin opciones, que no escribe ni lanza nada
  // (un `$variable` de la shell adentro del programa —viene de comillas dobles— puede esconder el `>`: no cuenta como lectura;
  //  el `$1` de un programa entre comillas simples llega marcado distinto por `comandosSimples` y si pasa)
  if (verbo === 'awk') return args.length >= 1 && !args.some((a) => a.startsWith('-')) && !/[>|]|system|getline|close|fflush|print\s*>|\$[A-Za-z_{(]|\x60/.test(args[0]);
  // sed: solo `sed -n '<rango>p' archivo…`
  if (verbo === 'sed') return args.length >= 2 && args[0] === '-n' && /^\d+(?:,(?:\d+|\$))?p$/.test(args[1]) && !args.slice(2).some((a) => a.startsWith('-'));
  return FIRMA_LEE.has(verbo);
}
function lineaSoloLee(texto, prof = 0) {
  const t = String(texto ?? '');
  if (prof > 4 || firmaFormaDudosa(t)) return false;
  const { lineas, cuerpos } = separarHeredocs(t);
  if (cuerpos.length) return false;                                            // un heredoc alimenta a un programa: no se sabe que hace
  const cmds = comandosSimples(lineas);
  return cmds.length > 0 && cmds.every((c) => comandoSimpleLee(c, prof));
}
/**
 * ¿El comando de Bash entero es de SOLO LECTURA? Cada comando simple de la linea (y de sus sustituciones) tiene que
 * ser un verbo de lectura conocido, sin redireccion a un archivo, sin `-exec`/`-delete`, sin heredoc. Lo que no se
 * conoce (git, un interprete, cp, xargs, tee, curl, un programa propio) cuenta como escritura.
 */
export function esSoloLectura(texto) { return lineaSoloLee(texto, 0); }

/**
 * (c) Para el camino viejo: la linea EMPIEZA con un verbo de lectura o con git; ademas, cada comando simple tiene que
 * leer o ser de git (un commit escribe el repo y su mensaje, no un documento de Barack). El cuerpo de un heredoc que
 * alimenta a git es el mensaje del commit. Si la linea trae otra cosa (un interprete, cp, una redireccion), no esta
 * exenta: se le aplican las reglas, que frenan solo si ven una IA escrita en un documento.
 */
function lineaLeeOEsGit(texto) {
  const { lineas, cuerpos } = separarHeredocs(String(texto ?? ''));
  if (cuerpos.some((c) => !c.deGit)) return false;
  if (firmaFormaDudosa(lineas)) return false;
  const cmds = comandosSimples(lineas);
  return cmds.length > 0 && cmds.every((c) => {
    const p = c.palabras.filter((w, i, a) => !(a.slice(0, i + 1).every((x) => FIRMA_PALABRA_SHELL.has(x))));
    // git: sin una variable adelante (GIT_EXTERNAL_DIFF=…), sin `-c` (un alias que corre otra cosa) y sin las formas
    // que escriben un archivo afuera del repo (--output, -o, archive, bundle, format-patch, difftool, config)
    if (p[0] === 'git') return !p.slice(1).some((a) => /^(?:-c|-o|--output|--exec-path|--ext-diff|archive|bundle|format-patch|difftool|config)(?:$|=)/.test(a) || /^-o./.test(a));
    // un cmdlet de lectura de PowerShell, tal como lo aceptaba la regla vieja
    if (/^(?:Get-ChildItem|Select-String|rg|less)$/i.test(p[0] || '') && c.redirs.every((r) => r.op === '<' || String(r.t).trim() === '/dev/null' || /^\$null$/i.test(String(r.t).trim()))) return true;
    return comandoSimpleLee(c, 0);
  });
}

// (b) El id de un modelo: claude-opus-5-5, claude-sonnet-5-5, claude-3-5-sonnet-20241022. Nada mas: «claude-fak» o
// «Claude-Contexto-HO» no son un id (auditor 11/10: la primera version aceptaba cualquier nombre con dos guiones).
const FIRMA_ID_MODELO_RE = /^claude-(?:(?:opus|sonnet|haiku|fable|mythos|instant)-\d+(?:-\d+)*|\d+(?:-\d+)*-(?:opus|sonnet|haiku)(?:-\d{8}|-latest)?)$/;
// el registro interno de la app y de Claude Code: no son documentos de Barack
const FIRMA_INTERNO_RE = /^(?:[A-Za-z]:[\\/]Users[\\/][^\\/]+|\/[a-z]\/Users\/[^/]+)[\\/](?:AppData[\\/]Roaming[\\/]Claude|AppData[\\/]Local[\\/]AnthropicClaude|\.claude)(?:[\\/]|$)/;
const FIRMA_TEMPORAL_RE = /^(?:(?:[A-Za-z]:[\\/]Users[\\/][^\\/]+|\/[a-z]\/Users\/[^/]+)[\\/]AppData[\\/]Local[\\/]Temp|\/tmp|\/dev\/null)(?:[\\/]|$)/;
const FIRMA_DOCUMENTO_RE = /\.(?:xlsx|xlsm|xlsb|xltx|xltm|xlt|xls|xla|xlam|docx|docm|dotx|dotm|dot|doc|pptx|pptm|potx|potm|pot|ppsx|ppsm|pps|ppt|pdf|csv|tsv|msg|eml|dxf|dwg|plt|hpgl|odt|ods|odp|rtf)(?![a-z])|openpyxl|xlsxwriter|xlwings|pandas|to_excel|to_csv|csv\.writer|win32com|comtypes|pptx|docx|odfpy|workbook|worksheet|\.Application|New-Object|Export-Csv|ImportExcel|\.(?:Range|Cells|Sheets|Worksheets|Slides|Shapes|Value2?)\b/i;
// lo que tiene forma de ruta: trae una barra, o una barra invertida entre dos caracteres de nombre
const FIRMA_TOKEN_RUTA_RE = /[^\s"'\x60|;&<>()=,\[\]{}]*(?:\/|(?<=[\w.$%~:-])\\(?=[\w.$%~-]))[^\s"'\x60|;&<>(),\[\]{}]*/g;
/**
 * ¿Lo que el comando nombra es SOLO el registro interno de la app (AppData\Roaming\Claude, AppData\Local\
 * AnthropicClaude, ~/.claude) y temporales? De un `python - <<EOF` no se puede saber que archivo abre, asi que se
 * mira TODO el texto y cualquier cosa que no se pueda ubicar lo descalifica:
 *   - cada cosa con forma de ruta tiene que ser absoluta y del registro interno o temporal, o colgar de una variable
 *     definida en el mismo comando con una ruta asi (`D="…/AppData/Roaming/Claude/…"; … "$D/x.json"`); sin `..`;
 *   - por lo menos una es del registro interno;
 *   - ningun nombre de archivo suelto entre comillas (`'listado.json'`), ningun documento por extension, ninguna
 *     libreria ni objeto de Office.
 */
export function destinoEsRegistroInterno(texto) {
  const t = String(texto ?? '');
  if (FIRMA_DOCUMENTO_RE.test(t)) return false;
  if (/["'\x60][^"'\x60\s\\/]+\.[A-Za-z0-9]{2,5}["'\x60]/.test(t)) return false;        // 'notas.txt', "listado.json": un archivo relativo
  const clase = (r) => (FIRMA_INTERNO_RE.test(r) ? 'interno' : FIRMA_TEMPORAL_RE.test(r) ? 'temporal' : null);
  // variables definidas en el comando con una ruta ubicable: NOMBRE="ruta" / NOMBRE=ruta
  const vars = new Map();
  for (const m of t.matchAll(/(?:^|[\s;&|(])([A-Za-z_][A-Za-z0-9_]*)=(?:"([^"\n]*)"|'([^'\n]*)'|([^\s;&|"']+))/g)) {
    const c = clase(m[2] ?? m[3] ?? m[4] ?? '');
    vars.set(m[1], vars.has(m[1]) && vars.get(m[1]) !== c ? null : c);          // redefinida con otra clase: no se sabe
  }
  let hayInterno = false;
  for (const r of t.match(FIRMA_TOKEN_RUTA_RE) || []) {
    if (/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(r)) return false;
    let c = clase(r);
    if (!c) {
      const v = r.match(/^\$([A-Za-z_][A-Za-z0-9_]*)[\\/]/);                    // "$D/scheduled-tasks.json"
      c = v ? vars.get(v[1]) ?? null : null;
    }
    if (!c) return false;
    if (c === 'interno') hayInterno = true;
  }
  return hayInterno;
}

/** Lo que frena (texto) o null. `texto` es el comando o el contenido del archivo; `archivo` la ruta del Write/Edit. */
export function firmaIaEnEscritura(texto, archivo = '', { bash = false } = {}) {
  const t = String(texto ?? '');
  const f = String(archivo ?? '');
  if (f && FIRMA_EXENTOS_RE.test(f)) return null;
  if (!f && ((bash && esSoloLectura(t)) || (FIRMA_COMANDO_LECTURA_RE.test(t) && lineaLeeOEsGit(t)))) return null;
  const m1 = FIRMA_AUTORIA_RE.exec(t);
  if (m1) return `un campo de AUTORIA con una IA de valor: «${m1[0].slice(0, 80)}»`;
  const interno = !f && destinoEsRegistroInterno(t);   // (b): solo exime al id de un modelo, abajo
  for (const linea of t.split('\n')) {
    for (const re of FIRMA_LITERALES_RE) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(linea))) {
        const antes = linea.slice(Math.max(0, m.index - 120), m.index);
        const literal = m[1].trim();
        if (interno && FIRMA_ID_MODELO_RE.test(literal)) { re.lastIndex = m.index + 1; continue; }
        if (FIRMA_PREFIJO_RE.test(antes) || FIRMA_PREFIJO_ADD_RE.test(antes) || FIRMA_PREFIJO_COLECCION_RE.test(antes)) return `una IA escrita ADENTRO de un documento: «${(antes.slice(-40) + m[0]).trim().slice(0, 110)}»`;
        re.lastIndex = m.index + 1;   // un literal "abierto" de mas no tapa el siguiente
      }
    }
  }
  if (!f) {
    // 3. nombre de archivo o carpeta en el servidor o en la nube de Ingenieria
    const rutas = t.match(/(?:[A-Za-z]:[\\/]|\/[a-z]\/)[^"'\n|;&<>]*/g) || [];
    for (const r of rutas) {
      if (!/claude/i.test(r) || FIRMA_EXENTOS_RE.test(r)) continue;
      if (/^(?:[yY]:[\\/]|\/y\/)/.test(r) || /Ingenier[ií]a y Proyecto/i.test(r)) {
        return `un archivo o carpeta con "Claude" en el nombre en el servidor o la nube: «${r.slice(0, 110)}»`;
      }
    }
  } else if (FIRMA_RAIZ_RE.test(' ' + f) || /[\\/]exports[\\/]/i.test(f)) {
    // 4. el archivo vive donde se entregan documentos
    const m4 = new RegExp(String.raw`(?<![a-z])(?:${IA_NOMBRES})(?![a-z])|inteligencia\s+artificial`, 'i').exec(t);
    if (m4) return `un documento en ${/[\\/]exports[\\/]/i.test(f) ? 'exports/' : 'el servidor o la nube'} que nombra a «${m4[0]}»`;
    if (/claude/i.test(path.basename(f))) return `un archivo con "Claude" en el nombre: «${path.basename(f)}»`;
  }
  return null;
}

// ── HOY-16b: el contenido de un Write / Edit ───────────────────────────────
// Dos carpetas de exports/ no son entregables y nombran a Claude a proposito: las paginas que le explican el sistema a
// Fak (exports/explicaciones/) y los archivos de trabajo de una tarea (exports/<tarea>/_trabajo/, indices de busqueda).
// Segun la fila HOY-16b (medicion del 11/10/2026), 26 de los 39 Write/Edit de 12 dias que frenaria activar la revision
// en vivo caen ahi. Se vuelve a medir con `node scripts/_medirFirmaWrite.mjs` antes de activar nada.
// Solo adentro de exports/: un `_trabajo` en la nube o en el servidor lo ve el equipo y se sigue revisando.
// Con `..` en la ruta no hay excepcion: por ahi se sale a una carpeta de entregables.
const FIRMA_EXPORTS_INTERNOS_RE = /[\\/]exports[\\/](?:explicaciones|(?:[^\\/]+[\\/])*_trabajo)[\\/]/i;
export function esExportInterno(archivo) {
  const f = String(archivo ?? '');
  return FIRMA_EXPORTS_INTERNOS_RE.test(f) && !/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(f);
}
// ── HOY-16c (11/10/2026): un script no es un documento, el TEMP no es de la empresa ──
// Medido con `node scripts/_medirFirmaWrite.mjs` sobre 12 dias: 5.339 Write/Edit, frenaria 5. Dos eran documentos de
// verdad (un LEEME.txt en la nube; el armar.py de una guia sobre la IA, legitima); tres, SCRIPTS (.py, .mjs) en exports/
// o en el TEMP de la sesion, y uno era el medidor de este mismo control con un fixture «CREADO POR = Claude».
//   1. Un script, por extension, no se revisa por contenido (nombra a la IA en una ruta o en un fixture; lo que PRODUCE
//      lo revisa scripts/_sinFirmaIA.py al escribirse o imprimirse). Su NOMBRE si (regla 4). En el servidor o en la nube
//      de Ingenieria se revisa entero: ahi lo ve el equipo, mismo criterio que el `_trabajo` de HOY-16b.
//   2. Bajo AppData\Local\Temp (\ o /, mayusculas indistintas, tambien el nombre corto FACUND~1) o bajo /tmp no se revisa
//      nada; con `..` no hay excepcion, igual que en exports/. Es otra regex que FIRMA_TEMPORAL_RE (la de Bash): esa no se toca.
// Solo para el contenido de un Write / Edit con JSON sano: Bash y la red del JSON roto no cambian. Van como constantes al
// lado de las otras: este guardian no lee firmaIA.data.json (ese canon es del detector).
// Auditor Opus 03:00: un .json / .jsonl / .yml son DATOS, no scripts (un `datos.json` en exports con "creado_por": "Claude"
// pasaba; el 170.json del flujograma se dibuja en el cajetin): quedan afuera de la lista.
const FIRMA_SCRIPT_RE = /\.(?:py|mjs|cjs|js|ts|sh|ps1)$/i;
// Anclada a la carpeta temporal del USUARIO (C:\Users\<x>\AppData\Local\Temp, tambien /c/Users/... y FACUND~1) y a /tmp:
// un `Y:\BARACK\AppData\Local\Temp\x.csv` del servidor no es temporal (auditor Opus 03:00).
const FIRMA_TEMPORAL_ARCHIVO_RE = /^(?:[A-Za-z]:|\/[A-Za-z])?[\\/]Users[\\/][^\\/]+[\\/]AppData[\\/]Local[\\/]Temp(?:[\\/]|$)|^\/tmp(?:\/|$)/i;
// La cache interna del repo (.sgc-cache/, ignorada por git) guarda notas de investigacion que nombran a la IA a proposito
// (medido 11/10/2026 con los subagentes: 5 de 6 frenos de 12 dias eran eso). Nunca sale de la PC: no se revisa.
const FIRMA_CACHE_INTERNA_RE = /(?:^|[\\/])\.sgc-cache[\\/]/i;
export function esScript(archivo) { return FIRMA_SCRIPT_RE.test(String(archivo ?? '')); }
export function esArchivoTemporal(archivo) {
  const f = String(archivo ?? '');
  return FIRMA_TEMPORAL_ARCHIVO_RE.test(f) && !/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(f);
}
export function esCacheInterna(archivo) {
  const f = String(archivo ?? '');
  return FIRMA_CACHE_INTERNA_RE.test(f) && !/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(f);
}
/** Lo que frena en el contenido de un Write / Edit, o null. Las excepciones valen SOLO aca: el JSON roto no las usa. */
export function firmaIaEnArchivo(contenido, archivo) {
  // Ninguna excepcion vale en el servidor ni en la nube de Ingenieria: un `...\exports\explicaciones\a.csv` en Y: o un
  // `_trabajo` en la nube los ve el equipo (auditor Opus 03:00: la regex de exports aceptaba cualquier tramo `\exports\`).
  const enLaCasa = FIRMA_RAIZ_RE.test(' ' + String(archivo ?? ''));
  if (!enLaCasa && (esExportInterno(archivo) || esArchivoTemporal(archivo) || esCacheInterna(archivo))) return null;
  // un script afuera del servidor y de la nube: se mira el NOMBRE (contenido vacio), no el contenido
  const soloElNombre = esScript(archivo) && !FIRMA_RAIZ_RE.test(' ' + String(archivo ?? ''));
  return firmaIaEnEscritura(soloElNombre ? '' : contenido, archivo);
}

const textoFirmaIa = (motivo) => `[FIRMA-IA] BLOQUEADO: estas por escribir ${motivo}

Regla de Fak (08/10/2026): ningun documento de Barack dice ni deja ver que lo hizo Claude o una IA
— ni en una celda, ni en una pestaña oculta, ni en una nota, ni en las propiedades del archivo, ni
en el nombre. *"Es un error gravisimo, no puede volver a suceder nunca"* (el listado de hojas de
proceso decia "Claude" en CREADO POR y tenia una pestaña oculta "_CONTEXTO_CLAUDE").

  · Autor / CREADO POR / Elaboro = la persona: F.Santoro (Facundo Santoro en las propiedades).
  · Mi contexto (notas, historia, "proximo numero") va a la memoria o al repo, NUNCA adentro del documento.
  · Despues de escribir: python scripts/_sinFirmaIA.py <archivo>

Regla: .claude/rules/core-prohibiciones.md §9`;

// HOY-16b (activado el 11/10/2026 03:00 por decision de la sesion, con la medicion de 12 dias como evidencia; Fak a la
// 01:35: «yo no quiero responder nada»): en vivo el despachador pasa «Write» / «Edit» con mayuscula y los tests viejos arman el
// contexto en minuscula. Se compara sin distinguir, para que el control del contenido corra igual en los dos lados.
const FIRMA_TOOL_ARCHIVO_RE = /^(?:write|edit)$/i;
GUARDIANES['firma-ia-guard'] = (ctx) => {
  let motivo = null;
  if (ctx.ok) {
    const tool = String(ctx.toolL ?? '');
    if (FIRMA_TOOL_ARCHIVO_RE.test(tool)) motivo = firmaIaEnArchivo(ctx.content ?? '', ctx.file ?? '');
    else motivo = firmaIaEnEscritura(ctx.cmd ?? ctx.cmd6 ?? '', '', { bash: /^bash$/i.test(tool) });
  } else {
    // JSON roto: sin la excepcion de exports/. Es la red de seguridad y falla hacia el lado de frenar.
    motivo = firmaIaEnEscritura(`${ctx.rescate?.cmd ?? ''}\n${ctx.rescate?.content ?? ''}`, ctx.rescate?.file ?? '');
  }
  return motivo ? bloqueo(textoFirmaIa(motivo)) : null;
};

// ── supabase-guard (solo deteccion; el backup lo corre el .sh) ─────────────
// Dispara _backup.mjs ANTES de correr scripts destructivos contra Supabase:
//   node scripts/_(fix|sync|delete|clean|reset|reseed|propagate|apply|seed|migrate)*.mjs
//   o cualquier .mjs con --apply. Solo la EJECUCION (un `git commit -m "...mjs..."` solo
//   lo menciona — incidente 2026-07-08: bloqueaba commits).
const EJECUTA_MJS = /(^|[;&|(]\s*|^\s*)(node|npx)\s[^;&|\n]*\.mjs/m;
const FLAG_APPLY = /(^|\s)--apply(\s|$)/m;
GUARDIANES['supabase-guard'] = (ctx) => {
  const cmd = ctx.cmd;
  if (!cmd || !EJECUTA_MJS.test(cmd)) return null;
  const destructivo = /(node|npx)\s[^;&|\n]*scripts\/_(fix|sync|delete|clean|reset|reseed|propagate|apply|seed|migrate)/.test(cmd) || FLAG_APPLY.test(cmd);
  return destructivo ? { tipo: 'supabase' } : null;
};

// ── validator-check ────────────────────────────────────────────────────────
// BLOQUEA si un script .mjs que va a escribir a amfe_documents.data con --apply no importa
// runWithValidation (regla amfe.md §14 + contrato de autonomia fila A; enforcement desde
// 2026-07-16, antes solo alertaba). Complementario a supabase-guard (ese corre el backup).
GUARDIANES['validator-check'] = (ctx, { env }) => {
  const cmd = ctx.cmd;
  if (!cmd || !EJECUTA_MJS.test(cmd) || !FLAG_APPLY.test(cmd)) return null;
  const m = cmd.match(/scripts\/[a-zA-Z_0-9./-]+\.mjs/);
  if (!m) return null;
  const full = path.join(raizProyecto(env), m[0]);
  let src;
  try { src = fs.readFileSync(full, 'utf8'); } catch { return null; }
  const toca = /amfe_documents/.test(src) && /\.update\(|\.upsert\(|saveAmfe/.test(src) && (/(data:|\{ ?data ?\})/.test(src) || /saveAmfe/.test(src));
  if (!toca || /runWithValidation/.test(src)) return null;
  return bloqueo(`
VALIDATOR-CHECK BLOQUEO: ${m[0]} escribe a amfe_documents.data con --apply pero NO usa runWithValidation().
   Obligatorio por regla amfe.md §14 + contrato de autonomia fila A.
   Fix: importar { parseSafeArgs, runWithValidation } de scripts/_lib/dryRunGuard.mjs y envolver la escritura (ver skill supabase-safety).
`);
};

// ── renumber-guard ─────────────────────────────────────────────────────────
// Bloquea scripts .mjs que renumeren/reasignen OPs con --apply sin haber leido el contenido
// (incidente 2026-05-14, AMFE-HF-PAT: renumeracion ciega dejo 76 placeholders pobres).
// Bypass: --i-read-content si ya se hizo la lectura.
GUARDIANES['renumber-guard'] = (ctx) => {
  const cmd = ctx.cmd;
  if (!cmd) return null;
  if (!/(^|[;&|(]\s*|^\s*)(node|npx)\s[^;&|\n]*scripts\/_[A-Za-z]+\.mjs/m.test(cmd)) return null;
  if (!/scripts\/_[A-Za-z]*(renumber|align|reassign|realloc)[A-Za-z]*\.mjs/i.test(cmd)) return null;
  if (!FLAG_APPLY.test(cmd)) return null;
  if (/(^|\s)--i-read-content(\s|$)/m.test(cmd)) return null;
  return bloqueo(`
[RENUMBER-GUARD BLOQUEO]

Estas por correr un script que renumera o reasigna OPs/WEs en amfe_documents
sin haber verificado el contenido previo. La regla
\`amfe.md\` §10 (leer contenido antes de renumerar) requiere:

  1. Correr ANTES:
     node scripts/_auditWePlaceholdersAndAllocation.mjs

  2. Resolver placeholders y failures mal alocados PRIMERO

  3. Mostrar tabla diff a Fak (WE.name actual vs propuesto, failure mappings)

  4. RECIEN ENTONCES renumerar

Si ya hiciste los pasos 1-3, agregar el flag al comando para bypass:
     ... --apply --i-read-content

Incidente fuente: 2026-05-14 (AMFE-HF-PAT) — renumeracion ciega dejo 76 placeholders
pobres + failures mal alocados que el equipo APQP tuvo que corregir post-hoc.
`);
};

// ── push-guard ─────────────────────────────────────────────────────────────
// Regla git-deploy: "SIEMPRE npm run build antes de pushear" (incidente 2026-04-13: 3 deploys
// rotos por un import sin dependencia). vite solo escribe dist/ cuando pasa, asi que dist mas
// nuevo que todo el codigo == hubo build exitoso post-cambios.
//
// 22/09/2026: mira SOLO lo que va en el push. Antes comparaba contra dist/ la fecha de CUALQUIER
// .ts del arbol, y con otras sesiones editando codigo en paralelo el push de un .md quedaba
// frenado (e1f76bb0 11/09 LECCIONES, 903ada0d 21/09 un SKILL.md): cada falso positivo costaba
// un build completo. Ahora: los commits sin subir (@{u}..HEAD) mas lo que el MISMO comando va a
// commitear (lo stageado, lo que nombra su `git add`, y todo lo modificado si es `commit -a`).
// Si ahi no hay codigo que el build compile, no hay build que exigir. Si no se puede saber que
// va en el push (sin upstream ni origin), queda la regla vieja.
const esCodigoDeBuild = (f) => /\.(ts|tsx|css)$/i.test(f) || /^(index\.html|package\.json)$/i.test(f);

/** Archivos (rutas del repo) que van en el push que arma `cmd`; null si no se puede saber. */
export function archivosDelPush(cmd, root) {
  const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8' });
  const nombres = (r) => (r.status === 0 ? String(r.stdout || '').split('\0').filter(Boolean) : null);
  let base = null;
  for (const ref of ['@{u}', 'origin/HEAD', 'origin/main']) {
    base = nombres(git('diff', '--name-only', '-z', `${ref}..HEAD`));
    if (base) break;
  }
  if (!base) return null;
  const set = new Set(base);
  const lineas = sinArgumentosDeCommit(sinCuerposHeredoc(cmd));
  if (!/\bgit\s+(-C\s+\S+\s+)?commit\b/.test(lineas)) return [...set];
  // El commit que arma este mismo comando: lo que ya esta stageado entra entero.
  for (const f of nombres(git('diff', '--cached', '--name-only', '-z')) || []) set.add(f);
  const statusDe = (specs) => {
    const r = git('status', '--porcelain', '-z', '--untracked-files=all', '--', ...specs);
    const partes = r.status === 0 ? String(r.stdout || '').split('\0') : [];
    const out = [];
    for (let i = 0; i < partes.length; i++) {
      const e = partes[i];
      if (e.length < 4) continue;
      out.push(e.slice(3));
      if (/[RC]/.test(e.slice(0, 2))) i++; // renombre: el nombre viejo viene a continuacion
    }
    return out;
  };
  for (const c of comandosSimples(lineas)) {
    const p = c.palabras;
    let k = p.indexOf('git');
    if (k < 0) continue;
    k++;
    while (k < p.length && /^-(C|c)$/.test(p[k])) k += 2;
    const sub = p[k];
    const args = p.slice(k + 1);
    if (sub === 'add') {
      const todo = args.some((a) => /^(-A|--all|-u|--update|\.|:\/|\*)$/.test(a));
      const specs = args.filter((a) => !/^-/.test(a));
      for (const f of statusDe(todo || !specs.length ? [] : specs)) set.add(f);
    } else if (sub === 'commit' && args.some((a) => a === '--all' || /^-[A-Za-z]*a[A-Za-z]*$/.test(a))) {
      for (const f of nombres(git('diff', '--name-only', '-z', 'HEAD')) || []) set.add(f);
    }
  }
  return [...set];
}

GUARDIANES['push-guard'] = (ctx, { env }) => {
  const cmd = ctx.cmd;
  if (!cmd || !/(^|[;&|]\s*)git\s+(-C\s+\S+\s+)?push/m.test(cmd)) return null;
  const root = raizProyecto(env);
  const enPush = archivosDelPush(cmd, root);
  const codigo = enPush ? enPush.filter(esCodigoDeBuild) : null;
  if (codigo && !codigo.length) return null; // solo docs, reglas, scripts: el build no los compila
  const dist = path.join(root, 'dist', 'index.html');
  let distM;
  try { distM = Math.floor(fs.statSync(dist).mtimeMs / 1000); } catch {
    return bloqueo("PUSH-GUARD: no existe dist/index.html — corre 'npm run build' ANTES de pushear (regla git-deploy). Si el build pasa, reintenta el push.");
  }
  let lista = codigo;
  if (!lista) {
    const r = spawnSync('git', ['ls-files', '-z', '--', '*.ts', '*.tsx', '*.css', 'index.html', 'package.json', 'vite.config.ts'], { cwd: root, encoding: 'utf8' });
    lista = (r.stdout || '').split('\0').filter(Boolean);
  }
  let newest = 0;
  let falta = false;
  for (const f of lista) {
    try { newest = Math.max(newest, Math.floor(fs.statSync(path.join(root, f)).mtimeMs / 1000)); } catch { falta = true; /* borrado */ }
  }
  // Un .ts BORRADO en el push tambien puede romper el build (un import que quedo colgando): la
  // referencia pasa a ser la hora del ultimo commit.
  if (codigo && falta) {
    const t = parseInt(spawnSync('git', ['log', '-1', '--format=%ct'], { cwd: root, encoding: 'utf8' }).stdout, 10);
    if (Number.isFinite(t)) newest = Math.max(newest, t);
  }
  if (newest > distM) {
    const cuales = codigo ? ` En el push: ${codigo.slice(0, 5).join(', ')}${codigo.length > 5 ? ` y ${codigo.length - 5} mas` : ''}.` : '';
    return bloqueo(`PUSH-GUARD: hay codigo fuente mas nuevo que el ultimo build (dist/).${cuales} Corre 'npm run build' primero (regla git-deploy — incidente 2026-04-13: el build de CI valida imports que el dev server no). Si pasa, reintenta el push.`);
  }
  return null;
};

// ── script-inline-guard (nuevo 05/09/2026) ─────────────────────────────────
// POR QUE: en la sesion mas cara de agosto-septiembre (hojas HOTMELT, 1.036 M tokens leidos)
// el contexto era 1,24 MB de scripts pegados dentro de Bash (heredocs, `python -`, `node -e`)
// contra 0,13 MB de texto de Fak. Cada iteracion de un script inline vuelve a mandar el script
// ENTERO. Poblacion medida (21/08-04/09): 282 comandos de mas de 2.500 caracteres, 274 con
// heredoc. Ademas, en esta PC la Bash tool colapsa cada `\\` a `\` antes de ejecutar (memoria
// bash_tool_colapsa_barras_invertidas) y los heredocs largos fallan con "unexpected EOF".
// QUE HACE: mide los caracteres de script pegado (cuerpos de heredoc que no alimentan a
// git/gh, o el comando entero si trae `node -e` / `python -c`). Pasado INLINE_MAX, bloquea.
const RE_HD = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/;
const HD_DE_GIT = /\bgit\s+(commit|tag|notes)\b|\bgh\s+(pr|issue|release)\b/;
const HD_A_ARCHIVO = /(^|[;&|]\s*)(cat|tee)\b[^\n]*>/;
const HD_A_INTERPRETE = /\|\s*((ba)?sh|python3?|node|powershell|pwsh)\b/;
export function medirInline(cmd) {
  let total = 0, aArchivo = 0, fin = null, dueno = '', buf = 0;
  const cerrar = () => {
    if (HD_DE_GIT.test(dueno)) return;
    total += buf;
    if (HD_A_ARCHIVO.test(dueno) && !HD_A_INTERPRETE.test(dueno)) aArchivo += buf;
  };
  for (const l of cmd.split('\n')) {
    if (fin !== null) {
      if (l === fin || l.trim().split(/\s+/)[0] === fin) { cerrar(); fin = null; } else buf += l.length + 1;
      continue;
    }
    const m = l.match(RE_HD);
    if (m) { fin = m[2]; dueno = l; buf = 0; }
  }
  if (fin !== null) cerrar(); // heredoc sin cerrar (comando truncado): cuenta igual
  // `node -e` / `python -c` se buscan en el comando SIN los cuerpos de heredoc: un mensaje de
  // commit que NOMBRA "node -e" no es un node -e (falso positivo real: el commit de esta misma
  // Ola, 05/09/2026, bloqueado por su propio guardian).
  const sinCuerpos = sinCuerposHeredoc(cmd);
  if (/\bnode\s+(-e|--eval|-p)\b|\bpython3?\s+-c\s/.test(sinCuerpos)) total = Math.max(total, sinCuerpos.length);
  return { inline: total, archivo: aArchivo };
}
GUARDIANES['script-inline-guard'] = (ctx) => {
  if (!ctx.ok || !ctx.cmd) return null;
  const { inline, archivo } = medirInline(ctx.cmd);
  if (inline < INLINE_MAX) return null;
  const n = inline.toLocaleString('es-AR');
  if (archivo >= inline * 0.8) {
    return bloqueo(`[SCRIPT-INLINE-GUARD] BLOQUEADO: estas escribiendo un archivo de ${n} caracteres con cat/tee + heredoc.
Usa la tool Write. En esta PC la Bash tool colapsa cada '\\\\' a '\\' antes de ejecutar (memoria
bash_tool_colapsa_barras_invertidas) y los heredocs largos fallan con "unexpected EOF": el 04/09
un archivo de 300 lineas llego roto por las dos vias. Write escribe el contenido exacto y una
sola vez; despues el archivo se corre por ruta y se corrige con Edit.`);
  }
  return bloqueo(`[SCRIPT-INLINE-GUARD] BLOQUEADO: ${n} caracteres de script pegados dentro del comando (heredoc / python - / node -e).
Cada vez que se itera un script inline, el script ENTERO vuelve a viajar al contexto: la sesion
HOTMELT (02-03/09) acumulo 1,24 MB solo de scripts pegados en Bash, diez veces mas que todo lo
que escribio Fak. Y en esta PC la Bash tool colapsa cada '\\\\' a '\\' antes de ejecutar: un regex
o una ruta Windows dentro de un heredoc llega cambiada (memoria bash_tool_colapsa_barras_invertidas).
Que hacer: guardalo con la tool Write en el scratchpad (o en scripts/ si es del repo) y
ejecutalo POR RUTA: python "<scratchpad>/x.py" · node "<scratchpad>/x.mjs". Para iterar,
Edit sobre el archivo; no re-pegarlo. Un heredoc de menos de ${INLINE_MAX.toLocaleString('es-AR')} caracteres pasa,
y un mensaje de commit (git commit -F -) tambien.`);
};

// ── consumos-entregable-guard ──────────────────────────────────────────────
// Lecciones 2026-07-14/16 (6 fallos con el mismo patron: regla canonica pisada por dato
// puntual, entregable ejecutable sin verificar, tolerancia que tapa typos). Recuerda 1x/h el
// checklist canonico al detectar trabajo de consumos/BOM/arb o un entregable xlsx/csv hacia
// afuera del repo. Desde 05/09/2026 la lista de disparadores vive en consumosCanon.data.json
// (`guard_disparadores`): la palabra suelta "consumo" disparaba con memorias, commits y hasta
// con el nombre de este guardian (26 disparos entre 15/08 y 04/09, la mitad sin trabajo de
// consumos detras).
let _canonConsumos;
function canonConsumos() {
  if (_canonConsumos !== undefined) return _canonConsumos;
  try { _canonConsumos = JSON.parse(fs.readFileSync(path.join(AQUI, 'consumosCanon.data.json'), 'utf8')); } catch { _canonConsumos = null; }
  return _canonConsumos;
}
const TEXTO_CONSUMOS = `[CONSUMOS-GUARD — checklist canonico ANTES de entregar/cargar. Leer skill verificacion-consumos]
1. REGLA CANONICA > dato puntual: etiqueta 100x60 = 1/CAJA (nunca por pieza);
   quimicos A+B con valor IGUAL en "LTS" = fraccion-de-envase (envases distintos != 1:1);
   la UNIDAD no se elige, SE BUSCA en INSUMOS.txt.
2. BOM: listar el folder de consumo ACTUAL y tomar la Rev de numero MAYOR (parsear int).
   PROHIBIDO decir "no documentado" sin pegar la salida del listado.
3. Material de corte (vinilo, tela, microfibra): el consumo no se carga ni se cambia sin la PLANILLA
   OFICIAL de Mesa de Corte que esta en el SERVIDOR o la confirmacion de Pablo Gamboa (un mail suyo,
   o el adjunto de un mail suyo citando ese mail). Fak 06/10/2026: "no cambiamos el consumo sin un
   excel oficial o una confirmacion oficial... ante la duda le preguntamos a Pablo Gamboa". Una tizada
   (.MRK) sola puede ser una prueba y no alcanza; tampoco una BOM de proyecto, un flujograma ni una
   cuenta mia. Un margen pedido por el gerente entra por \`fak:\`. Detalle: consumos-entregables.md §6.
4. Auditoria de valores: tolerancia 0,1% (2% tapa typos reales) + invariantes que cierran
   + node scripts/_validarConsumos.mjs + UN AGENTE INDEPENDIENTE ademas del script propio.
5. Entregable ejecutable: mostrar a Fak el dato crudo before→after con columna
   "actual en arb" + ABRIR el archivo generado antes de entregar.`;
GUARDIANES['consumos-entregable-guard'] = (ctx, { env }) => {
  const target = ctx.target;
  if (!target.trim()) return null;
  const canon = canonConsumos();
  const disparadores = canon?.guard_disparadores;
  if (!Array.isArray(disparadores) || !canon.guard_entregable_regex) {
    return aviso('consumos-entregable-guard: consumosCanon.data.json sin guard_disparadores/guard_entregable_regex — el recordatorio quedo apagado.');
  }
  if (canon.guard_excluir_rutas && new RegExp(canon.guard_excluir_rutas, 'i').test(target)) return null;
  let match = new RegExp(canon.guard_entregable_regex, 'i').test(target);
  if (!match) match = disparadores.some((d) => new RegExp(d.regex, 'i').test(target));
  if (!match) return null;
  return recordatorio(path.join(dirTmp(env), 'claude-consumos-guard.flag'), TEXTO_CONSUMOS);
};

// ── caracteristicas-especiales-guard ─────────────────────────────────────────
// RECORDATORIO 1x/h del criterio de caracteristicas especiales. Pedido de Fak 11/09/2026
// ("es un error gravisimo que debemos corregir para siempre... me gustan esas memorias pero
// a veces no las lees, me gustaria que incluyas guards"): ese dia llame "error" a que dos
// causas S7 O3 perdieran su D/TLD comparando contra un backup, sin mirar S y O.
// El texto (`recordatorio`), los disparadores y las exclusiones viven en
// core/amfe/caracteristicasEspeciales.data.json — la MISMA fuente que leen el validador y la
// app. Dispara al tocar la columna de sigla (specialChar/criticalType), un flujograma, la
// sigla D/TLD o el tema por su nombre; NO dispara al escribir SOBRE el tema (memorias,
// LECCIONES, reglas, hooks, tests, commits). NO bloquea: el enforcement duro son los checks
// CRITICAL del validador (CAUSE_CC_LOW_SEVERITY, CAUSE_SC_FUERA_DE_REGLA, SIGLA_DESCONOCIDA).
let _canonCE;
function canonCaracteristicasEspeciales() {
  if (_canonCE !== undefined) return _canonCE;
  try { _canonCE = JSON.parse(fs.readFileSync(path.join(AQUI, '..', '..', 'core', 'amfe', 'caracteristicasEspeciales.data.json'), 'utf8')); } catch { _canonCE = null; }
  return _canonCE;
}
/** El recordatorio canonico, tal cual lo inyectan los dos hooks (PreToolUse y UserPromptSubmit). */
export function textoCaracteristicasEspeciales() {
  const c = canonCaracteristicasEspeciales();
  return Array.isArray(c?.recordatorio) ? c.recordatorio.join('\n') : '';
}
GUARDIANES['caracteristicas-especiales-guard'] = (ctx, { env }) => {
  const target = ctx.target;
  if (!target.trim()) return null;
  const canon = canonCaracteristicasEspeciales();
  if (!canon || !Array.isArray(canon.guard_disparadores) || !Array.isArray(canon.recordatorio)) {
    return aviso('caracteristicas-especiales-guard: core/amfe/caracteristicasEspeciales.data.json sin guard_disparadores/recordatorio — el recordatorio quedo apagado.');
  }
  if (canon.guard_excluir_rutas && new RegExp(canon.guard_excluir_rutas, 'i').test(target)) return null;
  const texto = `${target} ${ctx.content || ''}`;
  if (!canon.guard_disparadores.some((d) => new RegExp(d.regex, 'i').test(texto))) return null;
  return recordatorio(path.join(dirTmp(env), 'claude-caracteristicas-especiales-guard.flag'), textoCaracteristicasEspeciales());
};

// ── cad-guard ──────────────────────────────────────────────────────────────
// RECORDATORIO 1x/h de los gates 3D del skill cad-design. HONESTIDAD: esto NO es enforcement;
// el enforcement DURO vive en export_deliverables.py, que se niega a entregar sin evidencia
// (collision_check n_inside=0 + render fresco) en manifest.json.
// Matching por tool_name para no disparar con read-only que solo MENCIONAN una palabra CAD:
// Bash/PowerShell solo si EJECUTA python CAD; Write/Edit solo si escribe un 3D o un .py que
// importa gmsh/build123d.
const TEXTO_CAD = `[CAD-GUARD — RECORDATORIO 1x/h de los gates 3D. Detalle: skill cad-design]
Dos causas raiz. La primera: sustituir la fuente real por un proxy (export parcial, capa
blanda, dibujo generico, "confio que salio") y NO verificar contra la fuente. La segunda,
encontrada el 02/09/2026 despues de TRES entregas rechazadas en tres dias con el calculo
estructural bien las tres veces: disenar la ESTRUCTURA y no el PROCESO.

GATE P — EL PROCESO (antes de abrir un CAD). Todo lo de abajo mira la pieza QUIETA; lo que
hace fallar un dispositivo pasa MIENTRAS el operario trabaja:
  0a. Que FUERZAS actuan sobre la pieza en cada etapa, y que PIEZA del dispositivo resuelve
      cada una. Toda etapa de la secuencia lleva al menos una fuerza analizada.
  0b. Si el que pide mando un VIDEO/plano/foto, se mira ANTES de disenar. El video ES el pliego.
  0c. Que tiene Barack YA fabricado que resuelva algo parecido:
      indice_dispositivos.py --buscar <mecanismo>
  Ejecutable:  gate_proceso.py plantilla --tags <...> --out pliego.json
               gate_proceso.py verificar pliego.json --workdir W --carpeta-pedido <dir>

GATE PRE-MODELADO (antes de escribir geometria):
  1. Tengo el ENSAMBLE completo, no un export parcial? Si es parcial -> STOP, pedir el assembly.
  2. Confirme CUAL pieza modificar (no adivinar) y compute el ROL de cada solido por codigo.
  3. Existe el 3D/STEP REAL de la pieza? Si existe -> PROHIBIDO usar un dibujo generico.
  4. Toda cota sale del STEP MEDIDO o es dato de Fak. Si falta -> TBD y preguntar.

GATE PRE-ENTREGA (antes de decir "listo" / pasarle algo a Fak):
  5. Renderice y MIRE yo el resultado. Adjuntar el render + el dato crudo.
  6. Interferencia contra el SUSTRATO RIGIDO ~= 0 (no vs el tapizado blando).
  7. CADGenBench: validez(watertight) -> forma -> interface/fit -> topologia.
  8. Lo que va a Fak: PDF visual + STEP + SIMULACION GRABADA. Un .txt o un .html NO son el
     entregable. Los renders con foto3d.py (fondo blanco), NUNCA con matplotlib.
     Ejecutable:  gate_entregable.py --entrega <carpeta> --motor foto3d --render *.png

Enforcement DURO: export_deliverables.py NO entrega sin evidencia en manifest.json
(proceso_declarado sin fuerzas pendientes + collision_check con 0 puntos dentro + render
fresco), y con --final corre ademas el gate de entregable sobre la carpeta destino.
Usa el workdir + los CLIs del skill.`;
GUARDIANES['cad-guard'] = (ctx, { env }) => {
  let match = false;
  if (!ctx.ok) {
    // Red de seguridad: NO desactivarse en silencio — grep burdo del JSON crudo
    match = /(gmsh|build123d|cadquery|\.venv-cad|\.(step|stp|stl|glb|iges|igs)[^a-z])/i.test(ctx.raw);
  } else if (ctx.tool === 'Bash' || ctx.tool === 'PowerShell') {
    // solo si EJECUTA python (o el venv CAD) sobre algo CAD — un ls/grep que menciona
    // "posicionador" no dispara
    match = /(python|\.venv-cad)/i.test(ctx.cmd6) && /(gmsh|build123d|cadquery|trimesh|\.venv-cad|\.(step|stp|stl|glb|iges|igs)([^a-z]|$))/i.test(ctx.cmd6);
  } else if (ctx.tool === 'Write' || ctx.tool === 'Edit') {
    match = /\.(step|stp|stl|glb|iges|igs)$/i.test(ctx.fileL)
      || (/\.py$/i.test(ctx.fileL) && /(import +(gmsh|build123d|cadquery|trimesh)|from +(build123d|cadlib))/i.test(ctx.body6));
  }
  if (!match) return null;
  return recordatorio(path.join(dirTmp(env), 'claude-cad-guard.flag'), TEXTO_CAD);
};

// ── patrones-guard ─────────────────────────────────────────────────────────
// RECORDATORIO 1x/h de los 3 gates de patrones de corte (skill patrones-corte-plotter, regla
// patrones-corte.md). El enforcement DURO vive en patronlib.entregar(), que levanta
// EntregaRechazada y NO escribe el PLT si el contorno se movio, si una cruz quedo a menos de
// 3 mm del filo, si un brazo no mide 6.000 o si el patron esta chueco.
const TEXTO_PATRONES = `[PATRONES-GUARD — RECORDATORIO 1x/h de los 3 gates. Detalle: skill patrones-corte-plotter]
Los 2 errores caros de este trabajo no se ven mirando: se miden en 3 segundos.

GATE 1 — APLOMO (posicion 0), ANTES de mover nada:
  gate_aplomo(C). La pieza apoyada en la mesa toca en 2 puntos: el envolvente convexo
  INFERIOR. Esa recta es el datum. Si el patron esta chueco, "1 mm para abajo" se va en
  diagonal -> convertir los deltas con a_marco_pieza() o enderezar primero.
  NO ajustar una recta al borde inferior: es curvo, devuelve la curvatura y no el giro.

GATE 2 — DIRECCION: EL CHEQUEO FRENA, NO DECIDE.
  Si Fak dice "moveme el punto 4,5 a la derecha", eso es un DATO, no una hipotesis.
  Si tabla_4_combinaciones() da alarma (punto a menos de 3 mm del filo; sano 5-17 mm),
  la accion correcta es MOSTRARLE LA TABLA Y PREGUNTAR — jamas invertirle la direccion
  por cuenta propia. Invertir en silencio ya rompio un patron (30/07/2026).
  Y ojo con la regla de negocio que hace que la alarma sea un falso positivo:
  PARA QUE LA COSTURA VAYA A LA IZQUIERDA, EL PUNTO VA A LA DERECHA (se mueven en
  sentido contrario). Que el punto se acerque al filo puede ser exactamente lo buscado.
  Anclar a la anatomia (punta_fina), nunca a "izquierda/derecha" ni al nombre del archivo.

GATE 3 — VERIFICACION RITUAL antes de entregar:
  contorno con desviacion maxima 0.000000 mm · brazos de cruz en 6.000 · misma cantidad
  de entidades · piquetes sin mover · Y MIRAR la imagen de comparacion, con un zoom por
  CADA punto movido.

Mover trasladando los brazos existentes (nunca reconstruir la cruz) y guardar con
doc.saveas() sobre el documento leido. Enforcement duro: patronlib.entregar().`;
GUARDIANES['patrones-guard'] = (ctx, { env }) => {
  let match = false;
  const PAT = /(ezdxf|patronlib|\.(dxf|plt|hpgl)([^a-z]|$))/i;
  if (!ctx.ok) match = PAT.test(ctx.raw);
  else if (ctx.tool === 'Bash' || ctx.tool === 'PowerShell') match = /(python|\.venv-cad)/i.test(ctx.cmd6) && PAT.test(ctx.cmd6);
  else if (ctx.tool === 'Write' || ctx.tool === 'Edit') {
    match = /\.(dxf|plt|hpgl)$/i.test(ctx.fileL)
      || (/\.py$/i.test(ctx.fileL) && /(import +ezdxf|from +ezdxf|import +patronlib|from +patronlib)/i.test(ctx.body6));
  }
  if (!match) return null;
  // El flag va a ~/.claude y no a TMPDIR: en los hooks TMPDIR puede venir distinto o vacio.
  return recordatorio(path.join(dirHome(env), '.claude', 'patrones-guard.flag'), TEXTO_PATRONES);
};

// ── escritorio-guard ───────────────────────────────────────────────────────
// Protege la cola de tareas y su archivo (regla escritorio-tareas.md, script _escritorio.mjs).
// Territorio: el Escritorio (la cola), la biblioteca de Ingenieria sincronizada (`BARACK
// ARGENTINA SRL\...`, que lleva "(NUNCA BORRAR)" en el nombre) y `TAREAS CERRADAS\` /
// `_TERMINADAS\`. BLOQUEA: borrar ahi (nada se borra nunca); mover a mano hacia/desde el
// archivo (archivar y registrar son la misma operacion); tocar el listado a mano o dejar un
// README/LEEME/NOTAS suelto (incidente 2026-07-24, GRAVE); GENERAR un entregable adentro del
// Escritorio (2026-08-28: "no me dejes cosas en el escritorio"). Y RECUERDA 1x/h el
// procedimiento cuando una orden simplemente toca ese territorio.
// Se exige la barra de RUTA adelante de la zona porque el guardian mira tambien mensajes de
// commit y prosa, donde "el Escritorio" aparece todo el tiempo; y `del`/`rd` exigen una letra
// de unidad atras: `del` es alias de borrado Y preposicion en español.
const ESC_ZONA = /[\\/](Escritorio([^A-Za-z]|$)|Desktop([^A-Za-z]|$)|_TERMINADAS|TAREAS CERRADAS|BARACK ARGENTINA SRL)/im;
const ESC_BORRA = /(^|[;&|\s])(rm|rmdir|unlink|erase)(\s|$)|Remove-Item|Clear-Content|shutil\.rmtree/im;
// `ri` es el alias PowerShell de Remove-Item: lo destapo el auditor de la Ola 2 (05/09/2026), pasaba
// en el bash original y en el port. Como `del`/`rd`, exige una ruta con letra de unidad detras.
const ESC_BORRA_CMD = /(^|[;&|\s])(del|rd|ri)(\s+-?\/?[A-Za-z]+)*\s+.?[A-Za-z]:/im;
const ESC_MUEVE = /(^|[;&|\s])(mv|move|cp|copy|xcopy|robocopy)(\s|$)|Move-Item|Copy-Item|shutil\.(move|copy)/im;
const ESC_ENTREGABLE = /\.(pdf|xlsx|xlsm|xls|docx|doc|pptx|step|stp|igs|iges)([^A-Za-z0-9]|$)/im;
const ESC_GENERA = /--salida|--out|--output|-o\s|>\s*["']?[A-Za-z]:/i;
const ESC_DENTRO = /[\\/](Escritorio|Desktop)[\\/]/i;
const ESC_ARCHIVAR = `  node scripts/_escritorio.mjs --archivar "<carpeta>" --cerrada AAAA-MM-DD \\
       --quien "<quien lo pidio>" --que "<que se hizo>" --donde "<donde quedo el entregable>"`;
const TEXTO_ESC_RECORDATORIO = `[ESCRITORIO-GUARD — RECORDATORIO 1x/h. Regla: .claude/rules/escritorio-tareas.md]
El Escritorio es la cola de tareas: una carpeta por pendiente, y ahi queda SOLO lo abierto.

CERRADA = la ultima accion que era de Barack esta hecha Y el ENTREGABLE ya esta en su
carpeta por tipo de la biblioteca de Ingenieria. Esperando a un tercero NO es cerrada.
"El archivo esta listo pero no lo mande" NO es cerrada.

LOS DOS MOTIVOS POR LOS QUE NO CIERRA (triage 03/08: las 30 carpetas caian en uno de estos):
  1. El trabajo tecnico ESTA hecho, pero nadie le contesto al que lo pidio.
     -> se comprueba: no hay ningun .msg de respuesta en la carpeta.
  2. El entregable ESTA hecho, pero quedo suelto en el Escritorio.
     -> se comprueba: no esta en su carpeta por tipo.
Que el archivo exista en su carpeta NO prueba que el trabajo se hizo: puede ser el mismo
adjunto que ya estaba ahi, reenviado. Comparar fecha y contenido, nunca el nombre.

Al archivar NO se copia el entregable: eso duplicaria el documento. Se mueve solo el RASTRO
(el mail que la origino, capturas, borradores) y el listado dice DONDE quedo el entregable.

  node scripts/_leerMsg.mjs --dir "<carpeta>"   # que se pidio, quien y CUANDO (fecha del mail)
  node scripts/_escritorio.mjs              # relevar: que hay abierto y hace cuanto
${ESC_ARCHIVAR}

Nada se borra. No se mueve a mano.`;
const TEXTO_ESC_GENERA = `[ESCRITORIO-GUARD] BLOQUEADO: estas GENERANDO un entregable adentro del Escritorio.

El Escritorio es la cola de tareas: guarda el RASTRO (el mail del pedido, capturas,
borradores). El ENTREGABLE tiene su casa y es otra: su carpeta POR TIPO de la biblioteca
de Ingenieria (2. CONSUMO DE MATERIAL BOM, FICHAS DE EMBALAJE, 5. 3D, ULM GATE 2, FLUJOGRAMA,
DESVIOS...). Generarlo aca deja DOS copias: una suelta que le molesta a Fak, y otra que se
va al archivo al cerrar la tarea.

  1. Generalo directo en su carpeta por tipo (mira los hermanos para elegir cual).
  2. En la carpeta de la tarea, en el Escritorio, no queda ninguna copia.
  3. Al cerrar: node scripts/_escritorio.mjs --archivar ... --donde "<esa carpeta por tipo>"

Incidente 2026-08-28: PDF de difusion de BOM generado en el Escritorio y reportado como
entregado. Fak: "no me dejes cosas en el escritorio".`;

/**
 * ¿Algun borrado del comando cae en la zona? (22/09/2026)
 * Antes: la zona y el verbo se buscaban por separado en TODO el comando, y ~10 de los 19
 * bloqueos del 05/09 al 22/09 eran un `rm` del scratchpad o del repo con la palabra Escritorio
 * en otro lado (un `find` que la listaba, el `python -c` de al lado). Ahora cuenta el OBJETIVO:
 *   · objetivo resuelto (variables del mismo comando, `cd` previos, cwd de la sesion) en la zona -> borra;
 *   · objetivo que no se puede resolver (variable de un for, `$(...)`, `xargs rm`, rm sin argumentos
 *     que recibe por tuberia) con la zona a la vista -> borra (regla vieja: no se adivina);
 *   · verbo de borrar que el analisis no reconoce como comando (codigo pegado en python -c, un
 *     heredoc, powershell -Command; o una forma rara) con la zona a la vista -> borra (regla vieja).
 */
function borraEnZona(an, zonaALaVista) {
  if (zonaALaVista && (ESC_BORRA.test(an.residual) || ESC_BORRA_CMD.test(an.residual))) return true;
  for (const b of an.borrados) {
    if (b.objetivos.some((o) => o.ok && ESC_ZONA.test(o.valor))) return true;
    if (zonaALaVista && (b.sinObjetivo || b.objetivos.some((o) => !o.ok))) return true;
  }
  return false;
}

/** Una salida ya resuelta que cae adentro del Escritorio y es un entregable (o una carpeta, y el comando nombra uno). */
function generaEntregable(salida, cmd) {
  if (!ESC_DENTRO.test(salida)) return false;
  if (ESC_ENTREGABLE.test(salida)) return true;
  const hoja = salida.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '';
  return !/\.[A-Za-z0-9]{1,5}$/.test(hoja) && ESC_ENTREGABLE.test(cmd);
}

GUARDIANES['escritorio-guard'] = (ctx, { env }) => {
  let tool, cmd, file;
  if (ctx.ok) { tool = ctx.toolL; cmd = ctx.cmd6; file = ctx.fileL; }
  else {
    // Red: el comando rescatado a mano + el JSON crudo entero (sin saltos, como el tr -d '\n').
    tool = ctx.rescate.tool; file = ctx.rescate.file;
    cmd = `${ctx.rescate.cmd} ${ctx.raw.replace(/\n/g, '')}`;
  }
  const todo = `${cmd} ${file}`;
  // El propio script es la via autorizada: pasa siempre, y sin recordatorio.
  if (/_escritorio\.mjs/.test(todo)) return null;
  const zonaEnTexto = ESC_ZONA.test(todo);
  // La sesion puede estar PARADA adentro del Escritorio (un `cd` de antes): un `rm x` relativo
  // borra ahi aunque el comando no nombre la zona. Eso solo cuenta para el borrado.
  const zonaEnCwd = ctx.ok && ESC_ZONA.test(ctx.cwd || '');
  if (!zonaEnTexto && !zonaEnCwd) return null;
  // Con JSON sano se mira A QUE apunta cada borrado y cada salida (analizarComando); con JSON
  // roto no hay comando confiable y queda la regla vieja sobre el texto entero.
  const an = ctx.ok && ctx.cmd ? analizarComando(ctx.cmd, { cwd: ctx.cwd || null }) : null;

  // 1. Borrar: prohibido, sin excepcion
  if (an ? borraEnZona(an, zonaEnTexto || zonaEnCwd) : (ESC_BORRA.test(cmd) || ESC_BORRA_CMD.test(cmd))) {
    return bloqueo(`[ESCRITORIO-GUARD] BLOQUEADO: estas por borrar algo del Escritorio o de la biblioteca de
Ingenieria — que ademas lleva "(NUNCA BORRAR)" en el nombre y esta bajo control documental.

NADA SE BORRA NUNCA. El contexto de un reclamo aparece dos anos despues con un ECN o un
PPAP viejo, y guardar sale gratis.

Lo que se termino se ARCHIVA, no se borra:
${ESC_ARCHIVAR}

Si de verdad hay que sacar algo, lo decide Fak explicitamente, no yo.`);
  }
  // Solo el cwd estaba en la zona: las demas reglas miran lo que el comando NOMBRA.
  if (!zonaEnTexto) return null;
  // 2. Mover a mano hacia/desde el archivo
  if (/(_TERMINADAS|TAREAS CERRADAS)/i.test(todo) && ESC_MUEVE.test(cmd)) {
    return bloqueo(`[ESCRITORIO-GUARD] BLOQUEADO: mover a mano hacia/desde el archivo de tareas cerradas.

Mover y registrar son UNA operacion. A mano, la carpeta queda archivada sin fila en el
listado — que es exactamente el problema que Fak pidio resolver: despues no hay forma de
encontrar lo archivado ni de saber donde quedo el entregable. El script ademas VERIFICA
que el movimiento no haya perdido archivos (OneDrive con Files On-Demand puede morder).

${ESC_ARCHIVAR}
  node scripts/_escritorio.mjs --reabrir "<carpeta archivada>"   # si se reabre
  node scripts/_escritorio.mjs --check                           # invariantes

Agrega --dry-run para ver el plan sin tocar nada.`);
  }
  const esEscritura = tool === 'Write' || tool === 'Edit';
  // 3. Listado a mano, o archivo auxiliar en carpeta de Fak
  if (esEscritura) {
    const ruta = file.replace(/\\/g, '/');
    if (/LISTADO DE TAREAS CERRADAS/i.test(ruta)) {
      return bloqueo(`[ESCRITORIO-GUARD] BLOQUEADO: el listado de tareas cerradas no se toca a mano.

Lo escribe \`_escritorio.mjs\` en el mismo momento que mueve la carpeta. Editarlo aparte es
como se desincronizan la fila y la carpeta, y entonces el listado miente. Si hay que
corregir una fila mal cargada, decilo y lo resolvemos por el script.`);
    }
    if (/\/(READ ?ME|LEE ?ME|NOTAS?|APUNTES|CHANGELOG|POR.?QUE)[^/\n]*\.(md|txt)$/im.test(ruta)) {
      return bloqueo(`[ESCRITORIO-GUARD] BLOQUEADO: archivo auxiliar suelto en una carpeta de Fak.

Incidente 2026-07-24, marcado GRAVE por Fak: un "LEEME - por que esta aca.txt" en una
carpeta suya. Ahi va EXACTAMENTE el entregable que pidio y nada mas. El porque va a MI
memoria y, si la tarea se cierra, a la fila del listado (--quien / --que / --donde).`);
    }
  }
  // 4. Generar un ENTREGABLE dentro del Escritorio. dxf/plt/stl/glb quedan afuera a
  // proposito: lo que Fak va a USAR YA va suelto en el Escritorio (10/08/2026).
  if (esEscritura) {
    if (ESC_DENTRO.test(file) && ESC_ENTREGABLE.test(file)) return bloqueo(TEXTO_ESC_GENERA);
  } else if (an) {
    // La SALIDA real (--salida/--out/--output/-o/>) tiene que caer adentro del Escritorio. Antes
    // bastaba con que las tres cosas aparecieran en cualquier lado: el `-o` de un `find` que
    // LISTABA pptx del Escritorio contaba como salida (6e8e78c2, 10/09), y un generador que
    // vive en el Escritorio pero escribe al scratchpad tambien (2934e9bd, 08/09).
    if (an.salidas.some((s) => s.ok && generaEntregable(s.valor, cmd))) return bloqueo(TEXTO_ESC_GENERA);
    const reglaVieja = ESC_GENERA.test(cmd) && ESC_DENTRO.test(cmd) && ESC_ENTREGABLE.test(cmd);
    // Salida que no se pudo resolver, o la opcion de salida adentro de codigo pegado: regla vieja.
    if (reglaVieja && (an.salidas.some((s) => !s.ok) || ESC_GENERA.test(an.embebido))) return bloqueo(TEXTO_ESC_GENERA);
  } else if (ESC_GENERA.test(cmd) && ESC_DENTRO.test(cmd) && ESC_ENTREGABLE.test(cmd)) {
    return bloqueo(TEXTO_ESC_GENERA);
  }
  // Recordatorio 1x/h. El directorio se pisa por env var para que los tests no compitan por
  // el mismo archivo con el guardian vivo de la sesion.
  const flagdir = env.ESCRITORIO_GUARD_FLAGDIR ? aRutaWin(env.ESCRITORIO_GUARD_FLAGDIR, env.ESCRITORIO_GUARD_FLAGDIR) : path.join(dirHome(env), '.claude');
  return recordatorio(path.join(flagdir, 'escritorio-guard.flag'), TEXTO_ESC_RECORDATORIO);
};

// ── documentacion-oficial-guard ────────────────────────────────────────────
// Regla `.claude/rules/documentacion-oficial.md` (Fak, 05/09/2026). En la carpeta donde vive un
// documento de un TERCERO (cliente, proveedor, organismo) no entra nada producido aca, y el
// original conserva el nombre que le puso el emisor. Incidente que lo origino: extraje la ayuda
// online del BeOn (portal VW, no descargable), arme con eso una guia en espaniol REORDENADA POR
// MI y la guarde junto al Formel Q; ademas le cambie el nombre al PDF que habia mandado VW.
// Fak: "no pueden haber archivos interpretados por vos ahi, sino esa interpretacion luego le vas
// a hacer otra y los datos no van a ser reales al final del dia".
// Lo UNICO mio que puede compartir carpeta con el original es la TRANSCRIPCION .txt de algo que
// no es archivo (una ayuda online, la pantalla de un portal), y solo si trae en la cabecera de
// donde salio y cuando: fuente + fecha de consulta es justo lo que separa una transcripcion de
// un resumen. Las traducciones van a la carpeta hermana TRADUCIDOS.
// Los nombres de carpeta son los REALES, verificados: `4- MANUALES` en la biblioteca de la nube,
// `0-Documentacion cliente` de la estructura QTR, `1. Imput` del legajo APQP y `normas-vw`.
const DOC_ZONA = /[\\/](4-\s*MANUALES|0-\s*Documentaci[oó]n cliente|1\.\s*Imput|normas-vw)(?=[\\/]|["'\s]|$)/i;
const DOC_EXCEPCION = /(__tests__|\.test\.|\.spec\.|[/\\]hooks[/\\]|[/\\]_lib[/\\]guardianes\.mjs$|[/\\]\.claude[/\\]rules[/\\]|LECCIONES_APRENDIDAS)/i;
// Origen que delata que el archivo lo produje YO en esta PC.
const DOC_MIO = /(scratchpad|[/\\]tmp[/\\]|[/\\]\.build[/\\]|[A-Za-z]:[\\/]Dev[\\/]|[\\/](Escritorio|Desktop)[\\/]|_trabajo)/i;
const DOC_COPIA = /(^|[;&|\s])(cp|copy|xcopy|robocopy)(\s|$)|Copy-Item|shutil\.copy/im;
const DOC_MUEVE = /(^|[;&|\s])(mv|move|ren|rename)(\s|$)|Move-Item|Rename-Item|shutil\.move|os\.rename/im;
// Sin `-o` pelado a proposito: `grep -o` y `sort -o` sobre un manual son lectura, no generacion.
const DOC_GENERA = /--salida\b|--out\b|--output\b|--destino\b|>\s*["']?[^"'\s|]*[\\/]/i;
const DOC_TRADUCIDOS = /[\\/]TRADUCIDOS[\\/]/i;
// Cabecera de transcripcion: de donde salio y cuando. Sin las dos cosas no es transcripcion.
const DOC_FUENTE = /(^|\n)\s*(fuente|url|origen)\s*:/i;
const DOC_FECHA = /fecha de (consulta|extraccion|descarga)\s*:/i;

/** Ultimo token con pinta de ruta: en un cp/mv/Copy-Item es el DESTINO. */
export function ultimaRuta(cmd) {
  const tokens = String(cmd).match(/"[^"]*"|'[^']*'|\S+/g) || [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i].replace(/^["']|["']$/g, '');
    if (/[\\/]/.test(t) && !t.startsWith('-')) return t;
  }
  return '';
}

/**
 * Un .txt que arranca declarando de donde salio y cuando es una TRANSCRIPCION (regla 4), y esa
 * SI va en la carpeta del original: es el original disponible cuando la fuente no es un archivo.
 * Se mira el archivo en el disco, no el nombre — el nombre no es el contenido.
 */
function esTranscripcionEnDisco(origen) {
  for (const t of String(origen).match(/"[^"]+\.txt"|'[^']+\.txt'|\S+\.txt/gi) || []) {
    const p = aRutaWin(t.replace(/^["']|["']$/g, ''), '');
    if (!p) continue;
    try {
      const cab = fs.readFileSync(p, 'utf8').slice(0, 1200);
      if (DOC_FUENTE.test(cab) && DOC_FECHA.test(cab)) return true;
    } catch { /* no existe o no se puede leer: no prueba nada, sigue */ }
  }
  return false;
}

const DOC_CIERRE = `Fak, 05/09/2026: "primero debe estar claro cuales son los manuales originales, que me importa
si esta en aleman o en ingles", "no pueden haber archivos interpretados por vos ahi, sino esa
interpretacion luego le vas a hacer otra y los datos no van a ser reales al final del dia".`;
const TEXTO_DOC_RECORDATORIO = `[DOCUMENTACION-OFICIAL — RECORDATORIO 1x/h. Regla: .claude/rules/documentacion-oficial.md]
Estas tocando una carpeta donde vive documentacion de un tercero (cliente, proveedor, organismo).
Ahi el criterio es uno solo: tiene que quedar claro CUAL es el original.

1. El original entra TAL CUAL, con el nombre que le puso el emisor. No se renombra, no se le
   agrega fecha, sigla ni revision. Que este en aleman o en ingles no es un problema.
2. En la carpeta del original no va NADA producido aca: ni resumen, ni guia, ni indice.
3. Traduccion: carpeta hermana TRADUCIDOS, el mismo texto en otro idioma, tema por tema, sin
   reordenar ni resumir. Nombre = nombre del original + idioma.
4. Lo que NO es un archivo (una ayuda online, la pantalla de un portal, lo que dijo el cliente
   por mail) se guarda como transcripcion .txt con URL o fuente, fecha de consulta y como se
   obtuvo, en la cabecera. Transcripcion es lo que DICE, no lo que entendi.
5. Mi material propio (guias, checklists, resumenes) va a la carpeta de trabajo del tema o de la
   tarea, y arranca diciendo de donde salio.

${DOC_CIERRE}`;
GUARDIANES['documentacion-oficial-guard'] = (ctx, { env }) => {
  let tool, cmd, file, body;
  if (ctx.ok) { tool = ctx.toolL; cmd = ctx.cmd6; file = ctx.fileL; body = ctx.body6; }
  else {
    tool = ctx.rescate.tool; file = ctx.rescate.file;
    cmd = `${ctx.rescate.cmd} ${ctx.raw.replace(/\n/g, ' ')}`; body = ctx.rescate.content;
  }
  const esEscritura = tool === 'Write' || tool === 'Edit';
  // Los tests, los hooks, este modulo y la propia regla NOMBRAN estas carpetas como dato.
  if (DOC_EXCEPCION.test(file)) return null;

  if (esEscritura && DOC_ZONA.test(file)) {
    const esTranscripcion = /\.txt$/i.test(file) && DOC_FUENTE.test(body) && DOC_FECHA.test(body);
    if (!esTranscripcion && !DOC_TRADUCIDOS.test(file)) {
      return bloqueo(`[DOCUMENTACION-OFICIAL] BLOQUEADO: estas ESCRIBIENDO un archivo tuyo en la carpeta de un
documento oficial de un tercero.

${file}

Un archivo mio guardado entre los originales deja de distinguirse a la semana siguiente: la
proxima consulta se hace sobre MI version, la siguiente interpretacion sobre esa, y a los dos
pasos lo que Barack tiene escrito ya no es lo que dijo el cliente.

Los tres destinos que SI existen:
  1. Es una TRANSCRIPCION de algo que no es archivo (ayuda online, pantalla de un portal):
     guardala en .txt y arranca la cabecera con "Fuente:" (URL) y "Fecha de consulta:".
     Transcripcion es lo que DICE, no lo que entendi: sin reordenar y sin resumir.
  2. Es una TRADUCCION del original: carpeta hermana TRADUCIDOS\\, nombre del original + idioma.
  3. Es material MIO (guia, resumen, checklist, indice): va a la carpeta de trabajo del tema o
     a la de la tarea, nunca aca, y dice en la primera linea de donde salio.

${DOC_CIERRE}`);
    }
  }

  if (!esEscritura) {
    const destino = ultimaRuta(cmd);
    const haciaLaZona = DOC_ZONA.test(destino);
    const origen = destino ? cmd.replace(destino, '') : cmd;
    // 1. Renombrar o reordenar DENTRO de la carpeta oficial (el origen tambien esta en la zona).
    //    Sacar algo de ahi NO se bloquea: es la unica correccion posible cuando ya se colo un
    //    archivo mio. Y traer el original desde donde llego (un adjunto, Descargas) tampoco: asi
    //    es como entra.
    if (DOC_MUEVE.test(cmd) && haciaLaZona && DOC_ZONA.test(origen)) {
      return bloqueo(`[DOCUMENTACION-OFICIAL] BLOQUEADO: mover o renombrar dentro de la carpeta de documentacion
oficial.

El original entra TAL CUAL y se queda con el nombre que le puso el emisor, aunque el nombre sea
un desastre: es el nombre por el que el cliente lo va a nombrar cuando lo reclame. Agregarle
fecha, sigla, cliente o revision lo convierte en un archivo de Barack.

  · Si lo que estas sacando de ahi es un archivo TUYO que no deberia estar: eso si va, moviendolo
    hacia AFUERA de la carpeta (este guardian no lo bloquea).
  · Si de verdad hay que renombrar un original, lo decide Fak explicitamente.

${DOC_CIERRE}`);
    }
    // 2. Copiar o mover hacia la carpeta oficial algo que se produjo en esta PC.
    if ((DOC_COPIA.test(cmd) || DOC_MUEVE.test(cmd)) && haciaLaZona && DOC_MIO.test(origen)
        && !esTranscripcionEnDisco(origen)) {
      return bloqueo(`[DOCUMENTACION-OFICIAL] BLOQUEADO: estas poniendo en la carpeta del original un archivo
generado en esta PC (scratchpad, repo, .build, Escritorio).

Lo que se guarda ahi es lo que MANDO el emisor, con su nombre. Lo mio va a la carpeta de trabajo
del tema o a la de la tarea. Si lo que necesitas es dejar disponible algo que no es un archivo
(una ayuda online, una pantalla del portal), va como transcripcion .txt con "Fuente:" y
"Fecha de consulta:" en la cabecera; si es una traduccion, a la carpeta hermana TRADUCIDOS\\.

${DOC_CIERRE}`);
    }
    // 3. Generar el archivo directamente adentro (redireccion o --out del script).
    if (DOC_GENERA.test(cmd) && haciaLaZona) {
      return bloqueo(`[DOCUMENTACION-OFICIAL] BLOQUEADO: estas generando un archivo DIRECTO adentro de la carpeta
de documentacion oficial.

Que lo escriba un script no lo hace original: sigue siendo material producido aca, y ahi adentro
en dos consultas pasa por documento del cliente. Generalo en la carpeta de trabajo del tema o de
la tarea. Si es una transcripcion de algo que no es archivo, .txt con "Fuente:" y "Fecha de
consulta:" en la cabecera; si es una traduccion, TRADUCIDOS\\.

${DOC_CIERRE}`);
    }
  }

  if (!DOC_ZONA.test(`${cmd} ${file}`)) return null;
  return recordatorio(path.join(dirTmp(env), 'claude-docoficial-guard.flag'), TEXTO_DOC_RECORDATORIO);
};

// ── borrado-masivo-guard ───────────────────────────────────────────────────
// ENFORCEMENT DURO contra el incidente 2026-08-07: para rescatar ~17 archivos CAD escribi un
// .ps1 que copiaba, verificaba tamano y borraba el original. Movio 942 (toda la carpeta
// REVISAR de Fak, 1,76 GB) a un arbol de carpetas fantasma y aplano 242 subcarpetas. Ningun
// byte se perdio; se perdio la JERARQUIA, que era el dato. Los dos bugs eran SILENCIOSOS:
//   1. .ps1 UTF-8 sin BOM leido como ANSI: "Ingenieria" con tilde creo un arbol paralelo.
//   2. Get-ChildItem -Recurse -Include: -Include se IGNORA si el Path no termina en \*.
// La causa de fondo fue de metodo: _escritorio.mjs ya hacia esto con --dry-run y verificacion
// de bytes. El dry-run habria impreso "942" cuando yo esperaba 17. Sin cooldown: los 4
// vectores son bugs objetivos o pasos salteados, no recordatorios de estilo.
// 06/09/2026: tambien la POLITICA administrada de Claude Code (`managed-settings*.json`): su lista
// `permissions.deny` cita `rm -rf` y `Remove-Item -Recurse` justamente para PROHIBIRLOS en las PCs
// de Claude Barack. Sin la excepcion, el guardian bloqueaba escribir la regla que lo replica.
const BM_EXCEPCION = /(__tests__|\.test\.|\.spec\.|[/\\]hooks[/\\]([a-z-]+-guard|_dispatcher)\.sh$|[/\\]_lib[/\\]guardianes\.mjs$|[/\\]managed-settings(\.[a-z]+)?\.json$)/i;
// V3: el patron del borrado PERMANENTE (sin Papelera). Un `rm` cuenta en cuanto es RECURSIVO, se escriba como se
// escriba: -rf, -fr, -r -f, -R, --recursive --force (11/10/2026, cola HOY-28: solo se veian las banderas pegadas
// con la r y la f juntas, y `rm -r -f`, `rm --recursive --force` y `rm -R` sobre una carpeta del dueno pasaban).
// `git rm -r` no cuenta: saca del indice y queda en el historial (y en un archivo de prueba aparece como texto).
// Auditor, 11/10/2026: `git` exime solo en el MISMO renglon y como palabra suelta (no `.git`, `/git`, `-git`: un
// `cd repo/.git` arriba escondia el borrado de abajo); un `\n` o `\t` ESCRITO adelante no esconde el verbo
// (`printf '#!/bin/bash\nrm -rf "$1"\n' > limpiar.sh`); y las banderas de adelante admiten una sola lectura (con dos, el
// verbo seguido de 24 opciones largas tardaba 2,5 s).
const BM_RM_RECURSIVO = /(?:(?<![\w.-])|(?<=\\[nrt]))(?<!(?<![\w./\\-])git[ \t]{1,4})rm +(?:--?[a-z][a-z-]* +)*(?:-[a-z]*r[a-z]*|--recursive)(?![a-z-])/i;
const BM_V3 = new RegExp(`(Remove-Item[^|;\\n]*-(Force|Recurse)|${BM_RM_RECURSIVO.source}|DeletePermanently|shutil\\.rmtree|fs\\.rmSync)`, 'i');
// Las palabras que eximen por nombrar un temporal. Valen para un SCRIPT que se escribe (ahi todavia no se resuelve a
// que apunta cada borrado) y para el codigo pegado en un comando; NO para un borrado que el analisis del comando
// resolvio a otra carpeta. `dist` es la carpeta entera: `/distribucion` no es `/dist` (HOY-28).
const BM_PALABRA_EFIMERA = /(scratchpad|[/\\]tmp[/\\]|AppData[/\\]Local[/\\]Temp|node_modules|[/\\]dist(?![\w-])|\.venv)/i;
const BM_GIT_RM = /(^|[;&|]|\s)git\s+rm\b/i;
// V1 (22/09/2026): el -Include ignorado solo hace dano si despues se MUEVE, COPIA o BORRA lo listado.
// Un listado de solo lectura con -Recurse -Include (4af94165 07/09, b2ae0714 15/09) no toca nada.
// Los alias cortos cuentan solo en posicion de COMANDO (principio de linea o despues de | ; { ( &):
// "fuera del telefono" dentro de un echo no es un `del` (4af94165, 07/09).
const BM_MUTA = /\b(Remove-Item|Move-Item|Copy-Item|Rename-Item|Clear-Content)\b|(^|[|;{(&])[ \t]*(ri|rm|rmdir|del|erase|rd|mi|mv|move|cpi|cp|copy|ren|rni|robocopy|xcopy)(?=\s|$)|Delete(File|Directory)|Move(File|Directory)|Copy(File|Directory)|\[(System\.)?IO\.(File|Directory)\]::(Delete|Move|Copy)|\.(Delete|MoveTo|CopyTo)\(|shutil\.|os\.(remove|rename|unlink)/im;
// V3 (22/09/2026): destinos efimeros que un borrado permanente puede limpiar sin Papelera. Se
// comparan contra el OBJETIVO resuelto del rm (no contra el comando entero): el TEMP de Windows
// (ahi vive el scratchpad; $TEMP/$TMPDIR resuelven ahi), /tmp, y el tmp/ y .video/ de un repo en
// C:\Dev\<repo>\ (7f176ac8 `rm -rf tmp/amfe158`, 623be82a `rm -rf .video/clips`), node_modules, .venv.
const BM_EFIMERO = /AppData[\\/]Local[\\/]Temp([\\/]|$)|^(\/|[A-Za-z]:[\\/])tmp([\\/]|$)|[\\/]Dev[\\/][^\\/]+[\\/](tmp|\.video)([\\/]|$)|[\\/]node_modules([\\/]|$)|[\\/]\.venv([\\/]|$)/i;
// Archivos que no se ejecutan: un plan o una nota que CITA `rm -rf` no borra nada (fc581284, 07/09).
const BM_PROSA = /\.(md|markdown|txt|rst|csv|tsv|log)$/i;

// V5 (23/09/2026): `git worktree remove` sobre un worktree con un ENLACE adentro. Un worktree
// viejo tenia su node_modules como junction a la instalacion principal; git entro por el enlace
// y borro en orden alfabetico 38 paquetes de C:\Dev\BarackMercosul\node_modules (.bin, @babel,
// @dnd-kit...) hasta cortar con "Invalid argument". Se repuso con `npm install` desde el lock.
const RE_WT_REMOVE = /\bgit\s+(?:-C\s+("[^"]*"|'[^']*'|\S+)\s+)?worktree\s+remove\s+(?:(?:-f|--force)\s+)*("[^"]*"|'[^']*'|\S+)/gi;

/** Los enlaces (symlink o junction) en el primer nivel de cada worktree que el comando saca. */
export function enlacesDeWorktree(cmd, cwd) {
  const sinComillas = (s) => String(s ?? '').replace(/^["']|["']$/g, '');
  const aWin = (s) => s.replace(/^\/([a-zA-Z])\//, (m, d) => `${d}:/`);
  const hallados = [];
  for (const m of String(cmd ?? '').matchAll(RE_WT_REMOVE)) {
    const base = m[1] ? aWin(sinComillas(m[1])) : (cwd || process.cwd());
    const dir = path.resolve(aWin(base), aWin(sinComillas(m[2])));
    let entradas = [];
    try { entradas = fs.readdirSync(dir); } catch { continue; }
    for (const e of entradas) {
      try { if (fs.lstatSync(path.join(dir, e)).isSymbolicLink()) hallados.push(path.join(dir, e)); } catch { /* sigue */ }
    }
  }
  return hallados;
}

/** Un comando de shell cuyos borrados permanentes apuntan TODOS a destinos efimeros resueltos. */
function borraSoloEfimero(ctx) {
  const an = analizarComando(sinCuerposHeredocDeGit(ctx.cmd), { cwd: ctx.cwd || null });
  if (!an.borrados.length) return false;
  // Queda un borrado permanente en codigo pegado (python -c, heredoc, -Command) o en una forma
  // que el analisis no desarmo: no se sabe a que apunta.
  if (BM_V3.test(limpiar(an.residual))) return false;
  return an.borrados.every((b) => !b.sinObjetivo && b.objetivos.length
    && b.objetivos.every((o) => o.ok && BM_EFIMERO.test(o.valor)));
}

/**
 * Los borrados PERMANENTES de un comando de shell que apuntan a algo que NO es un temporal resuelto: una ruta fuera
 * de los efimeros, una variable que no se pudo resolver o ningun destino. Devuelve sus textos ([] = ninguno).
 * Es lo que cierra HOY-28 (11/10/2026): hasta ese dia alcanzaba con que el comando NOMBRARA `/tmp/`, `scratchpad` o
 * `node_modules` en cualquier lado para que un `rm -rf` sobre una carpeta del dueno pasara
 * (`rm -rf Y:/INGENIERIA/otra ; ls node_modules`). La palabra ya no tapa un destino que si se pudo leer.
 */
export function borradosPermanentesFueraDeEfimero(cmd, cwd) {
  const an = analizarComando(sinCuerposHeredocDeGit(cmd), { cwd: cwd || null });
  // La ruta se lee como la lee el sistema antes de compararla: `/c/tmp/x` es `C:/tmp/x`, `./tmp/x` es `tmp/x`, y un
  // `..` sube (`/tmp/../Users/x` NO es un temporal). Medido el 11/10/2026 contra 110.742 comandos reales: sin esto
  // se frenaban tres limpiezas de temporales escritas con `/c/tmp/` o `./tmp/`.
  const normal = (v) => {
    const x = String(v).replace(/\\/g, '/').replace(/^\/([A-Za-z])\//, (m, d) => `${d.toUpperCase()}:/`);
    const raiz = /^[A-Za-z]:\//.test(x) ? x.slice(0, 3) : x.startsWith('/') ? '/' : '';
    const partes = [];
    for (const p of x.slice(raiz.length).split('/')) {
      if (p === '' || p === '.') continue;
      // un `..` que sube mas alla de la raiz no vuelve a parecer un temporal (auditor: `/tmp/../../c/Users/…` pasaba)
      if (p === '..') { if (partes.length) partes.pop(); else if (!raiz) return '..'; continue; }
      partes.push(p);
    }
    return raiz + partes.join('/');
  };
  // `node_modules` y `.venv` son efimeros esten donde esten: una ruta relativa que los nombra lo es aunque no se sepa
  // el directorio de la sesion (sin variables sin resolver adentro).
  const efimero = (o) => {
    const v = normal(o.valor);
    return (o.ok && BM_EFIMERO.test(v)) || (!/[$\x60]/.test(v) && !/(^|\/)\.\.(\/|$)/.test(v) && /(^|\/)(node_modules|\.venv)(\/|$)/i.test(v));
  };
  return an.borrados
    .filter((b) => BM_V3.test(limpiar(b.crudo)))
    .filter((b) => b.sinObjetivo || !b.objetivos.length || !b.objetivos.every(efimero))
    .map((b) => b.crudo.trim());
}

GUARDIANES['borrado-masivo-guard'] = (ctx) => {
  let tool, cmd, file, body;
  if (ctx.ok) {
    // El texto ENTERO (antes: cortado a 6000 y, cerca del tope, con el JSON crudo encima, que
    // es lo mismo escapado). Los cuerpos de heredoc de git y el -m de un commit son PROSA: un
    // mensaje que cita `rm -rf` no borra nada (37c172a1, 07/09).
    tool = ctx.toolL; file = ctx.fileL;
    cmd = limpiar(sinArgumentosDeCommit(sinCuerposHeredocDeGit(ctx.cmd)));
    body = limpiar(ctx.content);
  } else {
    // Red de seguridad: si no se pudo parsear, mirar el JSON crudo (mas lo rescatado a mano).
    tool = ctx.rescate.tool; file = ctx.rescate.file;
    cmd = `${ctx.rescate.cmd} ${ctx.raw}`; body = `${ctx.rescate.content} ${ctx.raw}`;
    // Segunda red: el contenido puede venir RECORTADO y el bucle que borra suele estar al FINAL
    // (verificado 2026-08-13 con un .py de 4.842 caracteres). Si llego cerca del tope, se suma
    // el JSON crudo al haystack.
    if (body.length >= TRUNC_HINT || cmd.length >= TRUNC_HINT) body = `${body} ${ctx.raw}`;
  }
  const haystack = `${cmd} ${body}`;
  const esEscritura = tool === 'Write' || tool === 'Edit';
  const esShell = ctx.ok && (tool === 'Bash' || tool === 'PowerShell');
  // Los tests, los guardianes y este modulo CITAN los patrones peligrosos como dato: es su
  // trabajo. Sin esta excepcion el guardian se bloquea a si mismo (paso al escribir su test).
  if (esEscritura && BM_EXCEPCION.test(file)) return null;

  let motivo = '';
  // V1: -Include junto con -Recurse. El filtro se ignora en silencio y el alcance se dispara;
  // el dano lo hace lo que se MUEVE, COPIA o BORRA con esa lista.
  // BM_MUTA se prueba sobre el texto CON sus saltos de linea (un alias al principio de un renglon
  // de un .ps1 es un comando); con JSON roto, sobre el haystack de la red.
  const conLineas = ctx.ok ? `${sinArgumentosDeCommit(sinCuerposHeredocDeGit(ctx.cmd))}\n${ctx.content}` : haystack;
  if (/Get-ChildItem/i.test(haystack) && /-Recurse/i.test(haystack) && /-Include/i.test(haystack) && !/\\\*|\/\*/.test(haystack)
    && BM_MUTA.test(conLineas)) motivo += 'V1';
  // V2: .ps1 con caracteres no-ASCII (powershell.exe 5.1 lo lee como ANSI si no tiene BOM).
  if (/\.ps1$/i.test(file) && /[^\x00-\x7F]/.test(body)) motivo += 'V2';
  // V3: borrado permanente en vez de Papelera. Excluidos (auditor 07/08): `git rm` (queda en
  // el historial) y scratchpad/temporales (efimeros, no son cosas de Fak). Desde 22/09 tambien
  // pasan: un archivo de prosa que lo cita, y un comando de shell cuyos rm apuntan SOLO a
  // temporales (el objetivo resuelto, no la palabra en cualquier lado).
  // 11/10/2026 (HOY-28): en un comando, la palabra no exime un borrado cuyo destino se leyo y no es un temporal.
  const excluido = BM_GIT_RM.test(haystack) || BM_PALABRA_EFIMERA.test(haystack);
  // (el analisis del comando se paga solo si el patron aparece: este guardian corre en cada comando de cada sesion)
  const fueraDeEfimero = esShell && BM_V3.test(ctx.cmd) ? borradosPermanentesFueraDeEfimero(ctx.cmd, ctx.cwd) : [];
  if (fueraDeEfimero.length) motivo += 'V3';
  else if (!excluido && !(esEscritura && BM_PROSA.test(file)) && BM_V3.test(haystack) && !(esShell && borraSoloEfimero(ctx))) motivo += 'V3';
  // V4: script que borra/mueve en lote sin dry-run. Los tokens se buscan con los comentarios
  // afuera (05/09/2026: un comentario que decia "no usa fs.rename ni mv" bloqueo dos Write).
  // `mv`/`rm` pelados son verbos solo en scripts de shell; en .py/.mjs/.js cuentan como comando
  // entre comillas (os.system("rm ..."), ["mv", ...]): `mv = re.match(...)` es una variable
  // (829f7135, 12/09).
  if (esEscritura && /\.(ps1|sh|mjs|js|py|bat|cmd)$/i.test(file)) {
    const codigo = sinComentarios(body);
    const verboSuelto = /\.(ps1|sh|bat|cmd)$/i.test(file) ? /\bmv\b|\brm\b/i : /["'\x60]\s*(mv|rm)\b/i;
    if ((/(Remove-Item|Move-Item|DeleteFile|DeleteDirectory|shutil\.(move|rmtree)|os\.remove|fs\.(unlink|rm|rename))/i.test(codigo) || verboSuelto.test(codigo))
      && /(foreach|for +\(|for +[a-z_]+ +in |while|Get-ChildItem|find |glob|walk|readdir|listdir|iterdir|rglob|scandir)/i.test(codigo)
      && !/dry[-_ ]?run|dryRun|DRYRUN|WhatIf/i.test(body)) motivo += 'V4';
  }
  const enlaces = esShell ? enlacesDeWorktree(ctx.cmd, ctx.cwd) : [];
  if (enlaces.length) motivo += 'V5';
  if (!motivo) return null;
  const partes = ['[BORRADO-MASIVO-GUARD - BLOQUEO. Incidente 2026-08-07: 942 archivos movidos en vez de 17]', ''];
  if (motivo.includes('V1')) partes.push('V1 - Get-ChildItem con -Recurse Y -Include, y el Path no termina en \\*',
    '     -Include se IGNORA en silencio: esto devuelve TODOS los archivos, no los',
    '     de la extension que pediste. Es exactamente el bug que movio los 942.',
    '     Usar: -Filter, o -Path "$dir\\*", o Where-Object { $_.Extension -in @(...) }', '');
  if (motivo.includes('V2')) partes.push('V2 - .ps1 con caracteres no-ASCII (tildes, enies)',
    "     powershell.exe lo lee como ANSI: 'Ingenieria' con tilde apunta a OTRA ruta",
    '     y la crea sola. Asi nacio el arbol de carpetas fantasma.',
    '     Armar las rutas con variables/wildcard, o pasarlas como argumento. Cero',
    '     acentos en literales de ruta dentro del .ps1.', '');
  if (motivo.includes('V3')) partes.push('V3 - borrado PERMANENTE (-Force / -Recurse / rm -rf / rmtree)',
    '     Sobre carpetas de Fak va a PAPELERA, que se deshace con un click:',
    "       [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($p,'OnlyErrorDialogs','SendToRecycleBin')",
    '     La papelera local quedo VACIA tras el incidente: -Force no deja vuelta atras.', '');
  if (motivo.includes('V4')) partes.push('V4 - script que borra o mueve EN LOTE y no tiene dry-run',
    '     Antes de tocar nada: imprimir el plan (origen -> destino, uno por linea)',
    '     y MIRAR EL CONTEO. Si esperabas 17 y dice 942, ahi se termina.', '');
  if (motivo.includes('V5')) partes.push('V5 - git worktree remove sobre un worktree con ENLACES adentro',
    ...enlaces.map((e) => `       ${e}`),
    '     git entra por el enlace y borra el DESTINO: el 23/09/2026 se llevo 38 paquetes de la',
    '     instalacion principal. Primero se quita SOLO el enlace, despues el worktree:',
    "       powershell -Command \"[System.IO.Directory]::Delete('<enlace>', $false)\"", '');
  partes.push("ANTES DE ESCRIBIR UNO NUEVO: 'node scripts/_escritorio.mjs --archivar ... --dry-run'",
    'ya hace esto con verificacion de bytes y sin una sola llamada de borrado.',
    "Regla: .claude/rules/escritorio-tareas.md - 'Nada se borra, nunca'.");
  return bloqueo(partes.join('\n'));
};

// ── ho-numeracion-guard ────────────────────────────────────────────────────
// Regla no-pfd-no-ho §"la numeracion la manda el flujograma" (leccion 2026-08-13, HO-986 APB
// Trasero Central: el Plan de Control tenia OTRA numeracion que el flujograma y el AMFE 150, y
// una COLISION real — el 80 era "reproceso" en uno y "test de lay out" en el otro — y los dos
// documentos iban al BeOn del cliente). Recuerda 1x/h el gate al detectar trabajo sobre HO.
const TEXTO_HO = `[HO-GUARD — gate de numeracion ANTES de armar una Hoja de Operaciones.
 Regla: .claude/rules/no-pfd-no-ho.md]

1. COTEJAR LAS TRES FUENTES antes de escribir una celda, y armar la tabla
   operacion por operacion:
     FLUJOGRAMA (I-IN-002/III)  ·  AMFE (Supabase live)  ·  PLAN DE CONTROL
   Si no cierran: NO se tapa. Se reporta la tabla de divergencias a Fak.
2. LA NUMERACION LA MANDA EL FLUJOGRAMA. Es el orden APQP: flujograma → AMFE →
   Plan de Control. Si el PdC difiere, lo que se corrige es el PdC.
   Mirar especialmente las COLISIONES (mismo numero, distinta operacion).
3. Los PASOS de una HO son instruccion de planta: cada uno sale de una fuente (video con
   minuto, documento, o quien lo dijo y cuando); sin fuente el paso no va. PROHIBIDO
   redactarlos por analogia con otra pieza "parecida" o copiar los de otro producto: el
   proceso puede ser otro (core-prohibiciones §1). En la DESCRIPCION no va ni un TBD
   (Fak, 24/09/2026: "no puede haber ni 1 TBD"): lo que no se sabe se escribe generico,
   sin inventar valores, y el hueco va a la lista de pendientes. El TBD queda solo en el
   cajetin (hojas-proceso.md 11 y 18).
4. FORMATO: el PowerPoint del generador (scripts/img/generar_hojas_img.py, skill
   hojas-de-proceso) sobre el formulario I-IN-002.4-R01: portada, una foto por paso, de 2
   a 4 pasos por hoja. No el Excel viejo pestaña por pestaña (Fak, 24/09/2026).
   FOTOS: solo de la pieza real, o de maquina/gesto donde NO SE RECONOZCA otra pieza.
   Si no hay foto, el recuadro va VACIO — nada de leyendas tipo "FOTO PENDIENTE"
   (Fak, 13/08: "si no hay imagenes en alguna hoja no pongas nada").
5. UNA HO ES PARA EL OPERARIO, NO PARA AUDITAR: sin "BORRADOR", sin "pendiente de
   validacion", sin "el Plan de Control dice X pero Y". Lo interno no va a la hoja ni a un
   informe (no se hacen informes): va al .txt de estado de la carpeta de la tarea.
   Estilo de la casa en el ciclo de control:
   Resp. = OP / OC / Insp.; **Registro: los unicos validos son los "Set up" (de control o
   de lanzamiento) — "RC" NO EXISTE** (aparece en HOs viejas, es arrastre; Fak 14/08).
   Si no hay registro asociado va "-", no se inventa un codigo. Frases cortas: las
   columnas son angostas y un texto largo se CORTA.
6. LISTADO MAESTRO (3- LISTADO\\Listado hojas de proceso.xlsx): la fila nueva, en el
   bloque de su sector, se PREPARA en la misma tanda en que se arma la hoja y se ESCRIBE
   con el OK de Fak (registro compartido, autonomy-contract.md §F). CREADO POR = la persona
   (F.Santoro), NUNCA "Claude"; y en el libro no va ninguna pestaña ni nota para mi (la
   oculta _CONTEXTO_CLAUDE se borro el 08/10/2026 por orden de Fak).
   El numero es de la HOJA, no del codigo, y no se pasa de 999 (Fak 25/09/2026): antes de
   dar uno y al cerrar, python scripts/_hoNumeros.py (sale 1 si hay un numero repetido).
7. Con ese OK, el .xlsx lo edito YO con Excel COM (Fak, 19/08/2026: "automaticemos eso
   asi podes hacerlo vos"). Trampas COM en la memoria excel_com_argumentos_posicionales;
   verificar lock ~$ antes y releer despues de guardar. Limite (25/09/2026): un libro con
   imagenes "en celda" no se guarda por COM para cambiar una celda — asi se perdieron
   imagenes en 17 HO; ese cambio va por el XML (skill hojas-de-proceso §3 bis).`;
GUARDIANES['ho-numeracion-guard'] = (ctx, { env }) => {
  // Red de seguridad: si no se pudo parsear (o no hay nada que mirar), grep sobre el JSON crudo.
  let target = ctx.target.trim() ? ctx.target : ctx.raw;
  if (!target.trim()) return null;
  const match = /(hojas? de operacion|hoja de proceso|hojas de proceso|\bHO[- ][0-9]{2,3}\b)/i.test(target) || /I-IN-002\.4/i.test(target);
  if (!match) return null;
  return recordatorio(path.join(dirTmp(env), 'claude-ho-numeracion-guard.flag'), TEXTO_HO);
};

// ── que parte de un comando de shell CORRE (P14 + P15, 11/10/2026) ─────────
// arb-cerrar-guard y mail-guard buscaban `taskkill` y `.Send()` en el TEXTO ENTERO del comando. R6 §4A: 9 de 10 frenos
// del arb y 10 de 10 del mail eran un grep, un sed -i, el -m de un commit, el filtro del test runner o el propio
// guardian nombrando el patron como dato. El criterio pasa a ser el VERBO, como en firma-ia (HOY-16): se mira lo que
// CORRE. `corre` es el texto donde se buscan los verbos y el codigo peligroso; `visible` es el comando sin la prosa
// (mensaje de commit, heredocs que van a cat/tee/git o a un .md), donde se mira el CONTEXTO (a que proceso, que
// ventana), que puede quedar fuera del tramo que corre (`T=Produccion; python -c "...WM_CLOSE..."`).
//   · un verbo que lee o guarda texto (echo, grep, sed, git, npx, python/node corriendo un ARCHIVO): sus argumentos
//     son datos, no suma;
//   · un interprete con codigo pegado (python -c, node -e, powershell -Command, bash -c, cmd /c, eval): suma ese codigo;
//   · un interprete que lee de stdin (bash, python -, node solos): suma el comando ENTERO, no se sabe que le llega;
//   · un heredoc que alimenta a un interprete: suma su cuerpo; el que va a cat/tee/echo/git es prosa;
//   · un heredoc, un echo, un printf o un tee que se GUARDAN en un archivo que no es prosa ni cita los patrones como
//     dato (un .py, un .sh): suman, porque eso corre despues por ruta y el guardian ya no lo ve;
//   · cualquier otro verbo (taskkill, wmic, Stop-Process, kill, shutdown, un programa propio) suma entero; y lo que no
//     se puede desarmar (una sustitucion de proceso, un `$(` sin cerrar) suma el comando entero: no se adivina.
// En PowerShell (y si la herramienta no tiene nombre) el comando entero es codigo: `porVerbo: false`.
// Archivos que CITAN los patrones peligrosos como dato: tests, hooks, este modulo, reglas, skills, memorias, docs.
const CITA_PATRONES_RE = /(?:__tests__|\.test\.|\.spec\.|(?:^|[\\/])\.claude[\\/](?:hooks|rules|skills)[\\/]|(?:^|[\\/])scripts[\\/]_lib[\\/]guardianes\.mjs$|(?:^|[\\/])(?:memory|docs)[\\/]|LECCIONES_APRENDIDAS|MEMORY\.md$|CLAUDE\.md$)/i;
const CORRE_TEXTO_RE = /(?:^|[\\/])(?:echo|printf|grep|egrep|fgrep|rg|ag|sed|awk|cat|head|tail|less|more|wc|sort|uniq|cut|tr|tee|ls|dir|find|stat|file|diff|cmp|jq|git|gh|npx|npm|pnpm|yarn|vitest|test|\[|\[\[|true|false|touch|mkdir|cp|mv|rm|cd|pwd|date|basename|dirname|type|which|column|nl|tac|rev|paste|comm|md5sum|sha256sum|base64|iconv|cygpath|code)(?:\.exe)?$/i;
const CORRE_INTERPRETE_RE = /(?:^|[\\/])(?:pythonw?[\d.]*|py|node|powershell|pwsh|bash|sh|zsh|dash|cmd|perl|ruby|php)(?:\.exe)?$/i;
const CORRE_INLINE_RE = /^(?:-c(?:om(?:m(?:a(?:n(?:d)?)?)?)?)?|-e|--eval|-p|--print|\/\/?[ck])$/i;   // lo que sigue es codigo
const CORRE_ENVOLTORIO_RE = /^(?:xargs|timeout|nohup|sudo|env|command|builtin|exec|winpty|time|nice|start)$/i;
const CORRE_HD_ARCHIVO_RE = /(?:>{1,2}\s*|\btee\s+(?:-[a-z]+\s+)*)("[^"]*"|'[^']*'|[^\s;&|<>]+)/i;
/** Prosa (.md/.txt/...) o un archivo que cita los patrones como dato: lo que se guarda ahi no corre. */
const esProsaOCita = (f) => { const x = String(f ?? '').trim().replace(/^["']|["']$/g, ''); return x === '/dev/null' || /^&\d/.test(x) || BM_PROSA.test(x) || citaSinCorrer(x); };
// Los cinco arreglos del auditor (11/10/2026, informe P14-P18, seccion 6) viven de aca para abajo.
// (1) Un archivo que SE EJECUTA no queda exento por la carpeta donde vive: en `.claude/skills/`, `.claude/hooks/`,
// `docs/` y `memory/` tambien hay scripts que corren. La carpeta exime solo lo que no corre; siguen exentos, corran o
// no, los tests de JS y de consola, este modulo y los envoltorios de los guardianes, que citan el patron por oficio.
const EXT_CORRE_RE = /\.(?:py|pyw|ps1|psm1|sh|bash|bat|cmd|js|mjs|cjs|ts|vbs|wsf|pl|rb|php)$/i;
const CITA_SIEMPRE_RE = /(?:__tests__|\.(?:test|spec)\.(?:mjs|cjs|js|ts|tsx|sh)$|(?:^|[\\/])scripts[\\/]_lib[\\/]guardianes\.mjs$|(?:^|[\\/])\.claude[\\/]hooks[\\/](?:[a-z-]+-guard|_dispatcher)(?:\.test)?\.sh$)/i;
// (7) Segunda auditoria: un .py / .ps1 / .vbs / .bat no es un test de JS ni de consola: adentro de __tests__ tambien corre.
const citaSinCorrer = (f) => { const x = String(f ?? ''); if (/\.(?:py|pyw|ps1|psm1|bat|cmd|vbs|wsf|pl|rb|php)$/i.test(x)) return false; return CITA_SIEMPRE_RE.test(x) || (CITA_PATRONES_RE.test(x) && !EXT_CORRE_RE.test(x)); };
// (2) El cuerpo de un heredoc es CODIGO salvo que lo reciba un verbo de texto (cat, tee, echo, printf) que lo manda a
// la salida o a un archivo de prosa. Antes era al reves (codigo solo si el dueño era un interprete conocido escrito
// pelado) y `ruta/python.exe - <<EOF` o `$PY - <<EOF` no se miraban: 820 de los 14.740 heredocs reales tienen esa forma.
const CORRE_HD_TEXTO_RE = /(?:^|[\\/])(?:cat|tee|echo|printf)(?:\.exe)?$/i;
function verboDeComando(c) {
  const p = [...c.palabras];
  while (p.length && (p[0] === '' || FIRMA_PALABRA_SHELL.has(p[0]) || /^[A-Za-z_][A-Za-z0-9_]*\+?=/.test(p[0]) || CORRE_ENVOLTORIO_RE.test(p[0]))) {
    if (CORRE_ENVOLTORIO_RE.test(p.shift())) while (p.length && (p[0].startsWith('-') || /^\d+[smhd]?$/.test(p[0]))) p.shift();
  }
  return { verbo: p[0] ?? '', args: p.slice(1) };
}
// (6) Segunda auditoria (11/10/2026): ¿de donde toma su PROGRAMA un interprete? De stdin cuando la bandera de codigo no
// trae nada atras (`powershell -Command -`, `cmd /k`, `bash -e`), cuando su primer argumento es `-` (`python - x`), en
// una shell con `-s` (`bash -s -- x`) o cuando nada de lo que recibe parece un archivo (`python -X utf8`, `bash -o
// pipefail`, `cmd /q`). Antes alcanzaba un argumento cualquiera para leerlo como «corre un archivo».
const pareceArchivo = (a) => /^\$|[\\/]|\.[A-Za-z0-9]{1,5}$/.test(a);
const enVariable = (verbo, args) => /^\$\{?[A-Za-z_]/.test(verbo) && [undefined, '-'].includes(args.find((a) => a === '-' || !a.startsWith('-')));
function modoInterprete(verbo, args) {
  const esPS = /(?:^|[\\/])(?:powershell|pwsh)(?:\.exe)?$/i.test(verbo);
  const esCmd = /(?:^|[\\/])cmd(?:\.exe)?$/i.test(verbo);
  const i = args.findIndex((a) => CORRE_INLINE_RE.test(a) || (!esPS && !esCmd && /^-[A-Za-z]{1,3}[ce]$/.test(a)));
  if (i >= 0) { const pegado = args.slice(i + 1).join(' ').trim(); return pegado && pegado !== '-' ? { modo: 'pegado', codigo: pegado } : { modo: 'stdin' }; }
  const opcion = (a) => a.startsWith('-') || (esCmd && /^\/\/?[A-Za-z](?::.*)?$/.test(a));
  const primero = args.find((a) => a === '-' || !opcion(a));
  if (primero === '-') return { modo: 'stdin' };
  if (esPS && primero !== undefined && !args.some((a) => /^-f(?:ile)?$/i.test(a))) return { modo: 'pegado', codigo: args.join(' ') };
  if (/(?:^|[\\/])(?:ba|z|da)?sh(?:\.exe)?$/i.test(verbo) && args.some((a) => /^-[A-Za-z]*s$/.test(a))) return { modo: 'stdin' };
  if (args.includes('-m')) return { modo: 'archivo' };
  return args.some((a) => !opcion(a) && pareceArchivo(a)) ? { modo: 'archivo' } : { modo: 'stdin' };
}
function duenoEsTexto(dueno) {
  let cs;
  try { cs = comandosSimples(dueno); } catch { return false; }
  const k = cs.findIndex((c) => c.redirs.some((r) => /^<</.test(r.op)));
  if (k < 0) return false;                                           // no se ve quien lo recibe: codigo
  if (!CORRE_HD_TEXTO_RE.test(verboDeComando(cs[k]).verbo)) return false;
  // `cat <<EOF | python -`: el texto termina en un interprete que lee de stdin
  for (const c of cs.slice(k + 1)) {
    const { verbo, args } = verboDeComando(c);
    if (/^(?:eval|xargs)$/i.test(verbo)) return false;
    if (CORRE_INTERPRETE_RE.test(verbo) && modoInterprete(verbo, args).modo === 'stdin') return false;
    if (enVariable(verbo, args)) return false;                       // `cat <<EOF | $PY -`
  }
  return true;
}

/** { corre, visible } de un comando de shell (ver arriba). `porVerbo: false` = el comando entero es codigo. */
export function queCorre(cmd, { porVerbo = true, prof = 0 } = {}) {
  const sinProsa = sinArgumentosDeCommit(String(cmd ?? ''));   // el -m de un commit es prosa
  const { lineas, cuerpos } = separarHeredocs(sinProsa);
  const codigo = [];
  for (const h of cuerpos) {
    if (h.deGit) continue;
    const dueno = String(h.dueno ?? '');
    const guardado = dueno.match(CORRE_HD_ARCHIVO_RE);
    if (!duenoEsTexto(dueno) || (guardado && !esProsaOCita(guardado[1]))) codigo.push(h.cuerpo);
  }
  const visible = [lineas, ...codigo].join('\n');
  // una sustitucion de proceso `<(...)` no se desarma; mas de cuatro niveles de `$(...)` tampoco
  if (!porVerbo || prof > 4 || /[<>]\(/.test(lineas)) return { corre: visible, visible };
  const corre = [...codigo];
  for (const c of comandosSimples(lineas)) {
    const p = [...c.palabras];
    let desarmado = true;
    for (const w of p) {
      const subs = sustitucionesDe(w);
      if (subs === null) { desarmado = false; break; }
      for (const s of subs) corre.push(queCorre(s, { prof: prof + 1 }).corre);
    }
    // adelante del verbo pueden ir palabras de la shell, asignaciones y envoltorios con sus opciones
    // (4) una palabra vacia no es el verbo: `start "" taskkill …` (el titulo vacio de `start`)
    while (p.length && (p[0] === '' || FIRMA_PALABRA_SHELL.has(p[0]) || /^[A-Za-z_][A-Za-z0-9_]*\+?=/.test(p[0]) || CORRE_ENVOLTORIO_RE.test(p[0]))) {
      if (CORRE_ENVOLTORIO_RE.test(p.shift())) while (p.length && p[0].startsWith('-')) p.shift();
    }
    const verbo = p[0] ?? '';
    const args = p.slice(1);
    if (!desarmado) { corre.push(c.crudo); continue; }
    if (!verbo || FIRMA_ESTRUCTURA.has(verbo)) continue;
    if (/^eval$/i.test(verbo)) { corre.push(args.join(' ')); continue; }
    if (CORRE_INTERPRETE_RE.test(verbo)) {
      // (3) tambien es codigo: una bandera JUNTA que termina en c o e (`bash -lc`, `sh -ec`, `python -Ic`, `node -pe`;
      // no en PowerShell ni cmd, donde `-NoProfile` termina en e) y lo posicional de `powershell` / `pwsh` sin `-File`
      // (`powershell "Stop-Process …"`).
      const r = modoInterprete(verbo, args);
      if (r.modo === 'pegado') corre.push(r.codigo);
      else if (r.modo === 'stdin') return { corre: visible, visible };                                 // lee de stdin
      continue;                                                                                        // corre un ARCHIVO: sus argumentos son datos
    }
    // un programa que viaja en una variable y no corre un archivo (`$PY -`, `"$PY"` solo): no se sabe que le llega
    if (enVariable(verbo, args)) return { corre: visible, visible };
    const guarda = c.redirs.some((r) => /^\d?>{1,2}$/.test(r.op) && !esProsaOCita(r.t))
      || (/^tee$/i.test(verbo) && args.some((a) => !a.startsWith('-') && !esProsaOCita(a)));
    const ejecuta = (/^find$/i.test(verbo) && args.some((a) => FIRMA_FIND_ESCRIBE.test(a)))
      || (/^awk$/i.test(verbo) && /system|\|/.test(args.join(' ')));
    // un tee a un .sh/.py recibe por la cañeria lo que otro imprimio (`echo "..." | tee matar.sh`): suma la linea entera
    if (guarda && /^tee$/i.test(verbo)) { corre.push(lineas); continue; }
    if (CORRE_TEXTO_RE.test(verbo) && !guarda && !ejecuta) continue;
    corre.push(c.crudo);
  }
  return { corre: corre.join('\n'), visible };
}

// ── mail-guard ─────────────────────────────────────────────────────────────
// Bloquea cualquier envio de mail por Outlook que NO pase por scripts/_mailEnviar.py, el unico
// camino con gate anti-duplicado. INCIDENTE 2026-08-14: Fak mando el mail del AMFE 150, quedo
// en la Bandeja de salida sin transmitir; mire la cola, afirme "no salio", lo edite y lo mande
// con un .Send() suelto: salieron DOS mails a Marcelo, Nicolas y Carlos. La entrada duplicada
// YA ESTABA en Enviados y la explique como "copia vieja". Un item en la Bandeja de salida NO
// prueba que el mensaje no se haya enviado. La leccion escrita no alcanza: el .Send() se
// escribe en 3 segundos dentro de un heredoc. Por eso el bloqueo es aca.
GUARDIANES['mail-guard'] = (ctx) => {
  if (!ctx.ok) return null;

  // 0-bis) VOZ: un borrador `_mail*.txt` se mide contra como escribe Fak antes de que exista
  // el mail. Fak, 11/09/2026: "revise porque revisamos, yo revise", y al dia siguiente el
  // mismo pedido. Avisa, no bloquea: el ROJO que frena esta en _mailEnviar.py, que es el
  // unico camino de envio. Solo corre para ese patron de archivo, para no sumarle un node
  // al despachador en cada Write.
  if (/[\\/]_mail[^\\/]*\.txt$/i.test(ctx.file || '') && String(ctx.content || '').trim()) {
    const r = spawnSync(process.execPath, [path.join(RAIZ, 'scripts', '_vozFak.mjs'), '--revisar', '-'],
      { input: ctx.content, encoding: 'utf8', cwd: RAIZ, timeout: 30000 });
    const salida = (r.stdout || '').trim();
    if (salida && !/\[VERDE\]/.test(salida)) {
      return aviso(`[MAIL-GUARD — voz del mail. Regla: .claude/rules/mail-envio.md]\n\n${salida}\n\n`
        + 'El mail sale a nombre de Fak. Los numeros salen de sus 935 mails:\n'
        + '  node scripts/_vozFak.mjs --revisar "<archivo>"   (vuelve a medirlo)');
    }
  }

  // 0-ter) El OK de Fak tiene que ser POSTERIOR al borrador (incidente 08/10/2026: "arma el mail y
  // mandalo" escrito antes de que el borrador existiera; Fak: "yo siempre reviso los mails... pone
  // un bloqueante"). Logica y caso en scripts/_lib/mailOkFak.mjs. Sin escape: --forzar no lo saltea.
  if (/^(Bash|PowerShell)$/i.test(ctx.tool) && pedidoDeEnvio(ctx.cmd)) {
    let tp = '';
    try { tp = String(JSON.parse(ctx.raw).transcript_path || ''); } catch { tp = ''; }
    const v = evaluarEnvio({ cmd: ctx.cmd, transcriptPath: tp, raizRepo: RAIZ });
    if (!v.ok) {
      return bloqueo(`
[MAIL-GUARD — BLOQUEO. Regla: .claude/rules/mail-envio.md ("El OK va despues del borrador")]

No se manda: ${v.motivo}.

Un mail sale solo si Fak lo VIO armado en su pantalla y DESPUES dijo que se mande.
Un "mandalo" escrito antes de que el borrador exista no es el OK de ese borrador
(08/10/2026: asi salio el mail a Paulo con un link que no andaba).

Que hacer: dejarle el borrador abierto, decirle que lo revise y esperar su respuesta.
Si contesta que se mande, recien ahi se corre el --enviar. Si apuro, el lo manda
apretando Enviar en la ventana que ya tiene abierta.
`);
    }
  }

  // P15 (11/10/2026, R6 §4A: 10 de 10 frenos eran tests, demos o el propio guardian): se revisa lo que CORRE. En un
  // Write/Edit decide el archivo: un test, un hook, este modulo, una regla, una skill, una memoria, las LECCIONES o un
  // .md/.txt CITAN el .Send() como dato y no mandan nada. En Bash decide `queCorre`: el codigo pegado a un interprete,
  // un heredoc que va a python o se guarda en un .py, un verbo desconocido; un grep, un sed -i o el -m de un commit
  // que lo nombran, no. En PowerShell el comando entero es codigo.
  const esEscritura = /^(?:write|edit)$/i.test(ctx.toolL);
  if (esEscritura && (BM_PROSA.test(ctx.fileL) || citaSinCorrer(ctx.fileL))) return null;
  // (5) el unico camino autorizado se puede editar: `scripts/_mailEnviar.py` queda exento por su nombre de archivo
  // (antes pasaba porque el nombre entraba en el texto mirado; ahora en un Write/Edit se mira solo el contenido).
  if (esEscritura && /(?:^|[\\/])scripts[\\/]_mailEnviar\.py$/i.test(ctx.fileL)) return null;
  const target = esEscritura ? ctx.body6
    : /^(?:bash|powershell)$/i.test(ctx.toolL) ? limpiar(queCorre(ctx.cmd, { porVerbo: ctx.tool === 'Bash' }).corre)
      : `${ctx.cmd6} ${ctx.fileL} ${ctx.body6}`;
  // 1) Tiene que oler a Outlook. 2) Tiene que haber un envio real (Display/Save/ReplyAll no
  // envian). 3) Si va por la via autorizada, pasa.
  if (!/Outlook\.Application|olMailItem|GetDefaultFolder|MailItem|CreateItem\(/i.test(target)) return null;

  // 0) Destinatarios como STRING en .To/.CC/.BCC. Incidente 08/09/2026: asi quedan con
  //    Address vacia y Exchange rebota ("Ninguna de sus cuentas pudo enviar a este
  //    destinatario"). El 10/09 el mismo patron seguia vivo en _reenviarMail.py.
  //    Los archivos que DESCRIBEN el patron (CITA_PATRONES_RE) no pasan por aca: si no el guardian se bloquea solo.
  // (5) sin la exencion por el TEXTO del comando: que nombre `docs/` o `__tests__` (un adjunto, un cat al lado) no
  // apaga el control; alcanza con que `target` ya es solo lo que corre.
  if (!citaSinCorrer(ctx.fileL) &&
      /\.(To|CC|BCC)\s*=[^=]/i.test(target)) {
    return bloqueo(`
[MAIL-GUARD — BLOQUEO. Regla: .claude/rules/mail-envio.md]

Estas asignando destinatarios como string a .To / .CC / .BCC de un item de Outlook.

Asi quedan con Address vacia y Exchange rebota con "Ninguna de sus cuentas pudo
enviar a este destinatario" (incidente 08/09/2026 en _prepararMail.py; el mismo
patron seguia vivo en _reenviarMail.py hasta el 10/09/2026).

EL CAMINO CORRECTO:

    for direccion, tipo in destinatarios:      # tipo: 1 = Para, 2 = CC, 3 = CCO
        r = mail.Recipients.Add(direccion)
        r.Type = tipo
    if not mail.Recipients.ResolveAll():       # sobre el ITEM, no sobre cada recipient
        sys.exit('ABORTADO: hay destinatarios sin resolver')

Leer .To para mostrarlo por pantalla esta bien; lo que no va es ASIGNARLO.
`);
  }
  if (!/\.Send\(\)|\.Send\s*\(|SendAndReceive|\.Submit\(/i.test(target)) return null;
  if (/_mailEnviar\.py/.test(target)) return null;
  return bloqueo(`
[MAIL-GUARD — BLOQUEO. Regla: .claude/rules/mail-envio.md]

Estas por mandar un mail con un .Send() suelto. Eso ya salio mal.

INCIDENTE 2026-08-14: Fak mando el mail del AMFE 150, quedo en la Bandeja de
salida sin transmitir, mire la cola y afirme "no salio, no hay nada que
recuperar". Lo edite y lo mande. Salieron DOS mails a Marcelo, Nicolas y Carlos.
Peor: la entrada duplicada YA ESTABA en Enviados —mismo asunto, mismos
destinatarios, mismo CC, mismo adjunto— y la explique como "copia vieja".

  Un item en la Bandeja de salida NO prueba que el mensaje no se haya enviado.
  Outlook puede tener la copia en Enviados y el item en cola al mismo tiempo.

EL CAMINO CORRECTO — deja el borrador armado con .Display() y despues:

    python scripts/_mailEnviar.py --buscar "<parte del asunto>"            # dry-run
    python scripts/_mailEnviar.py --buscar "<parte del asunto>" --enviar

Ese script, antes de enviar:
  - barre Enviados de las ultimas 72 h y ABORTA si algo coincide por
    asunto + destinatarios + adjuntos (no solo asunto, no solo una vez al empezar)
  - chequea que no haya nada de ese asunto en la Bandeja de salida
  - abre una ventana de Outlook si no hay ninguna (sin ventana no transmite)
  - despues de enviar verifica que la cola quedo vacia y que aparecio en Enviados,
    y si quedo trabado diagnostica los flags MAPI

REGLA DE FONDO, que ningun script reemplaza: un mail que Fak ya mando NO SE TOCA.
Se le reporta que esta mal y decide el.

Si de verdad hay que mandar algo que el gate marca como duplicado, requiere OK
EXPLICITO de Fak para ese mail y se corre con --forzar.
`);
};

// ── video-maquina-guard ────────────────────────────────────────────────────
// Regla `.claude/rules/video-maquina.md`. Los videos y fotos de maquina de Barack viven en
// `5- VIDEOS Y FOTOS` de la biblioteca de Ingenieria, por cliente/proyecto/maquina y con
// nombre `AAAA-MM-DD - lo que se ve (IMG_xxxx).MOV`. Ese `(IMG_xxxx)` del final existe para
// poder CRUZAR contra el indice del celular y no bajar dos veces lo mismo.
// Incidente 2026-09-07 (Fak: "ah nunca entendiste que tenias que cargarlos ahi? es gravisimo
// lo que paso"): baje 39 videos del iPhone y los deje en carpetas de tarea del Escritorio;
// 13 (el 02/09 entero, 5,59 GB) YA ESTABAN archivados en MAQUINA MOLDEADORA IMG desde el
// 02/09, con su nombre descriptivo. La respuesta estaba escrita en los nombres de archivo de
// la biblioteca y no la mire. Esa misma mañana Fak habia preguntado si no se repetian.
// BLOQUEA dos cosas:
//   1. dejar un video en una carpeta del Escritorio (su lugar es la biblioteca);
//   2. copiar del telefono por MTP sin haber cruzado antes contra la biblioteca.
// El cruce lo hace `node scripts/_videoBiblioteca.mjs --cruzar <indice.tsv>`, que deja la
// marca ~/.claude/.cruce-video con la hora. Vale 12 h: el celular no cambia cada 5 minutos,
// pero un cruce de la semana pasada no dice nada.
const VID_EXT = /\.(mov|mp4|m4v)\b/i;
const VID_BIBLIOTECA = /5-\s*VIDEOS Y FOTOS/i;
const VID_ESCRITORIO = /[\\/](Desktop|Escritorio)[\\/]/i;
const VID_MTP = /Apple\s*iPhone|Internal\s*Storage|CopyHere|NameSpace\(\s*17\s*\)|tel_a_nube|tel_copiar/i;
const VID_MUEVE = /(^|[;&|\s])(cp|copy|mv|move|xcopy|robocopy)(\s|$)|Copy-Item|Move-Item|shutil\.(copy|move)|os\.rename|CopyHere/im;
// Lo que NOMBRA estas rutas como dato (tests, hooks, reglas, memorias, lecciones) no las toca.
// Ojo con anclar a `[/\\]` a secas: una ruta RELATIVA (`.claude/rules/x.md`, tal como llega
// desde la tool Write) arranca sin barra, y ademas el guardian mira `cmd + " " + file`, asi que
// tampoco esta al principio de la cadena — quedaba afuera de la excepcion y el guardian se
// autobloqueaba al escribir su propia regla. El separador valido es inicio, espacio, comilla
// o barra: `SEP`.
const SEP = '(?:^|[\\s"\'/\\\\])';
const VID_EXCEPCION = new RegExp(`(__tests__|\\.test\\.|\\.spec\\.|${SEP}hooks[/\\\\]|guardianes\\.mjs|${SEP}\\.claude[/\\\\]rules[/\\\\]|LECCIONES_APRENDIDAS|MEMORY\\.md|${SEP}memory[/\\\\]|_videoBiblioteca)`, 'i');
const VID_CRUCE_H = 12;
// La RAIZ de una carpeta de maquina: `...5- VIDEOS Y FOTOS\...\MAQUINA <X>\<un solo nombre>`.
// Si despues de la carpeta de la maquina hay mas de un tramo, ya esta adentro de una subcarpeta
// (`.claude\transcripciones\x.txt`) y no es asunto de este candado.
const VID_RAIZ_MAQUINA = /5-\s*VIDEOS Y FOTOS[\\/].*[\\/]MAQUINA [^\\/]+[\\/][^\\/]+$/i;
const VID_MEDIA = /\.(mov|mp4|m4v|heic|jpe?g|png)$/i;
const VID_NOMBRE_CASA = /[\\/]\d{4}-\d{2}-\d{2} - [^\\/]+ \([^()\\/]+\)\.[A-Za-z0-9]{2,4}$/;

/**
 * El DESTINO de un comando que mueve o copia: el ultimo argumento con pinta de ruta
 * (o el que va detras de `-Destination`).
 *
 * Por que existe (07/09/2026): la regla 1 miraba si "Desktop" aparecia en CUALQUIER lado del
 * comando, asi que SACAR un video de una carpeta de tarea hacia afuera quedaba bloqueado igual
 * que meterlo — el candado frenaba justo la correccion que pide la regla. Aparecio sacando un
 * video PERSONAL que habia caido en una carpeta de trabajo. Un candado que frena la correccion
 * no protege nada (LECCIONES 07/09).
 *
 * Si no logra identificar un destino devuelve '' y el guardian vuelve al criterio viejo (mirar
 * el comando entero): ante la duda bloquea, no afloja.
 */
function vidDestino(sentencia) {
  const explicito = sentencia.match(/-(?:Destination|dest|dst)\s+("[^"]+"|'[^']+'|\S+)/i);
  const candidatos = explicito
    ? [explicito[1]]
    : (sentencia.match(/"[^"]+"|'[^']+'|\S+/g) || []).filter((t) => /[\\/]/.test(t));
  if (!candidatos.length) return '';
  return candidatos[candidatos.length - 1].replace(/^["']+/, '').replace(/["')\],;]+$/, '');
}

/**
 * Las sentencias de un comando compuesto. Sin esto, `vidDestino` sobre un `mv ... ; ls <carpeta>`
 * devuelve la carpeta del `ls` y el guardian bloquea un movimiento que estaba bien (paso en la
 * misma sesion del arreglo). El destino sale de la sentencia que MUEVE, no del comando entero.
 * No parte por `|` solo: rompe `find ... | xargs mv`.
 */
function vidSentencias(cmd) {
  return cmd.split(/\r?\n|&&|\|\||;/).map((s) => s.trim()).filter(Boolean);
}

const VID_CIERRE = `Fak, 07/09/2026: "ah nunca entendiste que tenias que cargarlos ahi? ... es gravisimo lo que paso",
"no se pone algo que te obligue a recordar? un seguro", "porque sino se me hace que va a volver a pasar".`;

const VID_DONDE = `DONDE VAN (verificado, ya existe y esta poblado):
  ...\\INGENIERIA BARACK (NUNCA BORRAR)\\5- VIDEOS Y FOTOS\\
      1- CLIENTES\\<CLIENTE>\\<PROYECTO>\\<PIEZA o MAQUINA>\\     NOVAX\\TOP ROLL\\MAQUINA HOTMELT
      2- SECTORES\\<SECTOR>\\                                    2- SECTORES\\INYECCION PU
  Nombre: "AAAA-MM-DD - lo que se ve (IMG_xxxx).MOV"
  Reales: "2026-08-26 - PARAMETROS - rodillos 130 grados produccion 195 (IMG_0383).MOV"
          "2026-08-25 - DEFECTO - el material se traba (IMG_0362).MOV"
  El (IMG_xxxx) del final NO es decorativo: es la clave para cruzar contra el celular.`;

GUARDIANES['video-maquina-guard'] = (ctx, { ahora, env }) => {
  let tool, cmd, file;
  if (ctx.ok) { tool = ctx.toolL; cmd = ctx.cmd6; file = ctx.fileL; }
  else { tool = ctx.rescate.tool; file = ctx.rescate.file; cmd = `${ctx.rescate.cmd} ${ctx.raw.replace(/\n/g, ' ')}`; }
  const todo = `${cmd} ${file}`;
  if (VID_EXCEPCION.test(todo)) return null;

  // 1. Un video que TERMINA en una carpeta del Escritorio. La carpeta de la tarea es para
  //    trabajar; el master no vive ahi. Se mira el DESTINO, no el comando entero: sacarlo del
  //    Escritorio (a la biblioteca o al disco de transito) es la correccion, no la falta.
  const enEscritorioSinBiblioteca = (t) => VID_ESCRITORIO.test(t) && !VID_BIBLIOTECA.test(t);
  const queMueven = vidSentencias(cmd).filter((s) => VID_MUEVE.test(s));
  const dejaEnEscritorio = queMueven.length
    ? queMueven.some((s) => {
        const destino = vidDestino(s) || (VID_EXT.test(file) ? file : '');
        return enEscritorioSinBiblioteca(destino || todo);
      })
    : enEscritorioSinBiblioteca(todo);
  if (VID_EXT.test(todo) && VID_MUEVE.test(cmd) && dejaEnEscritorio) {
    return bloqueo(`[VIDEO-MAQUINA] BLOQUEADO: estas dejando un video en una carpeta del Escritorio.

El Escritorio es la cola de tareas, no el archivo. Un video guardado ahi se pierde cuando la
tarea se cierra, no lo encuentra nadie del equipo, y — lo que ya paso — se vuelve a bajar del
celular porque nadie sabe que ya estaba.

${VID_DONDE}

Si lo que estas haciendo es justamente SACARLO del Escritorio hacia la biblioteca, poné la ruta
de destino completa (tiene que contener "5- VIDEOS Y FOTOS") y este guardian te deja pasar.

${VID_CIERRE}`);
  }

  // 3. Dejar en la RAIZ de una carpeta de maquina algo que no sea un original bien nombrado.
  //    Pedido de Fak el 21/09/2026: "que esten los archivos originales videos o fotos
  //    originales y todo lo demas dentro de una carpeta que diga .claude para que no estorbe".
  //    Antes de ordenarlas, esas tres carpetas tenian adentro el generador de las hojas, los
  //    fotogramas de otra maquina, un PDF de un caso y dos carpetas numeradas: 228 hallazgos.
  const destinos = [];
  for (const s of vidSentencias(cmd)) if (VID_MUEVE.test(s)) destinos.push(vidDestino(s));
  if (file) destinos.push(file);
  for (const d of destinos.filter(Boolean)) {
    if (!VID_RAIZ_MAQUINA.test(d)) continue;
    if (/[\\/]\.claude$/i.test(d)) continue;             // la carpeta de trabajo, justamente
    const esMedia = VID_MEDIA.test(d);
    if (esMedia && VID_NOMBRE_CASA.test(d)) continue;    // original bien nombrado: pasa
    return bloqueo(`[VIDEO-MAQUINA] BLOQUEADO: ${esMedia
      ? 'ese nombre no es el de la casa y la carpeta de la maquina ordena por fecha.'
      : 'en la raiz de una carpeta de maquina van SOLO los originales (videos y fotos).'}

  ${d}

En la raiz de MAQUINA <X> van solo videos y fotos, con el nombre
    AAAA-MM-DD - lo que se ve (IMG_xxxx).ext
y TODO lo demas — transcripciones, fotogramas, PDFs, scripts, borradores — va adentro de
\`.claude\`, que para eso esta. Lo chequea:

  node scripts/_videoBiblioteca.mjs --auditar

Fak, 21/09/2026: "la idea es que esten los archivos originales videos o fotos originales y
todo lo demas dentro de una carpeta que diga .claude para que no estorbe".`);
  }

  // 2. Copiar del telefono sin haber cruzado antes contra la biblioteca.
  if (VID_MTP.test(cmd) && VID_MUEVE.test(cmd)) {
    const marca = path.join(dirHome(env), '.claude', '.cruce-video');
    let edadH = Infinity;
    try {
      const t = parseInt(fs.readFileSync(marca, 'utf8').trim(), 10);
      if (Number.isFinite(t) && t > 0) edadH = (ahora - t) / 3600;
    } catch { /* sin marca: nunca se cruzo */ }
    if (edadH > VID_CRUCE_H) {
      return bloqueo(`[VIDEO-MAQUINA] BLOQUEADO: vas a copiar del telefono sin haber cruzado antes contra la
biblioteca.

${edadH === Infinity ? 'No hay ningun cruce hecho.' : `El ultimo cruce fue hace ${edadH.toFixed(1)} h (vale ${VID_CRUCE_H} h).`}

El 07/09/2026 baje 39 videos y 13 YA ESTABAN archivados con nombre descriptivo desde el 02/09:
5,59 GB de red, de disco y de tu tiempo para llegar a un duplicado. Y el disco se lleno.

  node scripts/_videoBiblioteca.mjs --cruzar <indice-del-telefono.tsv>

imprime que falta de verdad y deja la marca. Despues copia solo eso.

${VID_DONDE}

${VID_CIERRE}`);
    }
  }
  return null;
};

// ── arb-cerrar-guard ───────────────────────────────────────────────────────
// Regla arb-no-cerrar.md: EL arb NO SE CIERRA SIN CONSULTARLE A FAK. NUNCA.
// Incidente 2026-08-31 (Fak: "fue gravisimo"): termine de leer el maestro de insumos, cerre
// el arb porque una instruccion decia "cuando termines, cerralo", y al rato hubo que cargar.
// Reabrirlo pide USUARIO Y CONTRASEÑA, que yo no tipeo: la tarea quedo frenada esperando a
// Fak, dos veces. Cerrar cuesta segundos y destrabarlo depende de otra persona: asimetrico.
// BLOQUEA matar el proceso (taskkill/Stop-Process/.Kill()/os.kill/wmic sobre produc, o por
// PID resuelto contra tasklist), cerrar la ventana PRINCIPAL (WM_CLOSE/0x10/DestroyWindow/
// pywinauto/Alt+F4 apuntando a ProdWindow o al titulo "Produccion") y cerrar la sesion de
// Windows. NO bloquea WM_CLOSE sobre `Maestro de Insumos`/`Maestro de Relaciones` (asi se
// descarta una edicion sin grabar) ni `_arbVer.py reset`. Los 8 bypasses que encontro el
// auditor del 31/08 estan en arb-cerrar-guard.test.sh.
// ESCAPE (lo usa Fak): touch ~/.claude/.arb-cerrar-ok — vale para UN comando y se consume.
// P14 (11/10/2026, R6 §4A: 9 de 10 frenos eran un grep, un sed -i, un commit o el test runner nombrando `taskkill`):
// se mira lo que CORRE (`queCorre`, arriba de mail-guard). Un taskkill de verdad —en posicion de comando, pegado a un
// interprete, en un heredoc que va a python o a bash, en un `$(...)`, por xargs, por find -exec, guardado en un .sh—
// sigue frenando. La exencion vieja ("empieza con un lector y no encadena") se va: su regex contaba `python` o `node`
// en cualquier lado de la linea (hasta en el nombre de un archivo) y dejaba de eximir.
// (el tramo que corre llega con un espacio adelante: ` shutdown //l` despues de `cd x &&`. Auditor, 11/10/2026.)
// Tambien adentro de un subshell o de un `if … then …` (pasaban antes y despues del cambio: informe, seccion 7).
const ARB_SESION = /(^\s*|[;&|({]\s*|\b(?:then|do|else)\s+)(shutdown\s+\/|logoff|restart-computer|stop-computer)/im;
// HOY-57 (12/10/2026; auditor de P14-P16, seccion 2): formas NATURALES de apagar o cerrar la sesion que la regla de
// arriba no veia, y que pasaban desde antes de P14. Se SUMAN: la regla de arriba no se toca, asi el cambio solo puede
// frenar mas. Todas se buscan en lo que CORRE: un commit, un grep o un documento que las nombra no llega aca.
//  - `shutdown` con una bandera, escrita con barra, doble barra o guion (en Git Bash el guion es la forma normal),
//    con `.exe`, con la carpeta adelante, detras de un envoltorio o de una variable, adentro de un codigo pegado
//    (`os.system('shutdown /s')`) o como lista (`['shutdown', '/r']`). `-a` (anular un apagado) y `-?` no apagan.
const ARB_APAGAR = /\bshutdown(?:\.exe)?(?:["']\s*,\s*["']|["']?\s+["']?)(?:\/{1,2}|-)(?!a\b|\?)[a-z]/i;
//  - los cmdlets de PowerShell en cualquier posicion (`$null = Restart-Computer`) y las llamadas del sistema.
const ARB_APAGAR_CMDLET = /\b(?:restart|stop)-computer\b/i;
const ARB_APAGAR_API = /\bwmic\b[^|\n]*\bos\b[^|\n]*\bcall\s+(?:reboot|shutdown|win32shutdown)\b|\bWin32Shutdown(?:Tracker)?\b|\bExitWindowsEx\b|\bInitiate(?:System)?Shutdown(?:Ex)?[AW]?\b/i;
//  - `logoff` como una cadena que ES el comando (`os.system('logoff')`, `['logoff']`). Una clave `'logoff': …` no.
const ARB_LOGOFF_CADENA = /["'](?:[\w.:~$-]*[\\/])?logoff(?:\.exe)?(?:\s[^"'\n]*)?["'](?!\s*:)/i;
//  - y la regla de arriba otra vez, sobre el texto sin lo que va ADELANTE del verbo: variables (`X=1 logoff`),
//    envoltorios (`timeout 5 logoff`, `nohup …`, `start "" …`) y la carpeta (`C:/Windows/System32/logoff.exe`).
const ARB_ADELANTE = /(^[ \t]*|[;&|({]\s*|\b(?:then|do|else)\s+)(?:[A-Za-z_]\w*=\S*[ \t]+|(?:timeout(?:\.exe)?(?:[ \t]+(?:\/{1,2}t|-[A-Za-z-]+(?:=\S+)?))*[ \t]+\d+(?:\.\d+)?[smhd]?|nohup|sudo|command|exec|env|call|start(?:[ \t]+""|[ \t]+\/{1,2}[a-z]+)*)[ \t]+)/gim;
const ARB_CARPETA = /(^[ \t]*|[;&|({]\s*|\b(?:then|do|else)\s+)["']?(?:[\w.:~$-]*[\\/])+(?=(?:shutdown|logoff)(?:\.exe)?\b)/gim;
function sinLoDeAdelante(corre) {
  let t = String(corre ?? '');
  for (let i = 0; i < 6; i++) { const n = t.replace(ARB_ADELANTE, '$1'); if (n === t) break; t = n; }
  return t.replace(ARB_CARPETA, '$1');
}
/** ¿Lo que corre apaga la PC o cierra la sesion de Windows? Devuelve la regla que lo dice, o ''. */
export function apagaOCierraSesion(corre) {
  const t = String(corre ?? '');
  if (ARB_SESION.test(t)) return 'verbo';
  if (ARB_APAGAR.test(t)) return 'shutdown con bandera';
  if (ARB_APAGAR_CMDLET.test(t)) return 'cmdlet';
  if (ARB_APAGAR_API.test(t)) return 'llamada del sistema';
  if (ARB_LOGOFF_CADENA.test(t)) return 'logoff como cadena';
  if (ARB_SESION.test(sinLoDeAdelante(t))) return 'verbo detras de una variable, un envoltorio o una carpeta';
  return '';
}
const ARB_MATAR =/taskkill|stop-process|pkill|killall|(?:^|[^a-z])kill\s|\.kill\(|os\.kill|closemainwindow|wmic[^|\n]*(delete|terminate|call)|shutdown\s*\//i;
const ARB_CERRAR = /WM_CLOSE|0x0010|0x10[^0-9a-f]|DestroyWindow|EndTask|SC_CLOSE|0xF060|pywinauto|pyautogui|sendkeys|%\{F4\}|alt.{0,3}f4|\.close\(\)/i;
GUARDIANES['arb-cerrar-guard'] = (ctx, { env, escapes }) => {
  // Red de seguridad: si el parseo fallo, miro el comando rescatado + el JSON crudo.
  const cmd = ctx.ok ? ctx.cmd : `${ctx.rescate.cmd}\n${ctx.raw}`;
  if (!cmd.trim()) return null;
  // Con JSON sano se mira lo que corre (en PowerShell el comando entero es codigo); con JSON roto no hay comando
  // confiable y vale la regla vieja sobre el texto entero: no se adivina.
  const { corre, visible } = ctx.ok ? queCorre(cmd, { porVerbo: ctx.tool === 'Bash' }) : { corre: cmd, visible: cmd };
  let motivo = '';
  // 1a. cerrar sesion / apagar: se lleva puesto el arb sin nombrarlo
  if (apagaOCierraSesion(corre)) motivo = 'cerrar la sesion de Windows o apagar (se lleva puesto el arb)';
  // 1. matar el proceso del arb (lista canonica de verbos, no un regex parcial)
  if (ARB_MATAR.test(corre)) {
    if (/produc/i.test(visible)) motivo = 'matar el proceso del arb (produc.exe)';
    else {
      // por PID pelado: se RESUELVE contra el sistema — solo aca, que es raro
      const pids = [...new Set([...visible.matchAll(/(\/pid[\s:=]+|os\.kill\(\s*|-id\s+)([0-9]{2,7})/gi)].map((m) => m[2]))];
      for (const p of pids) {
        const r = spawnSync('tasklist', ['/FI', `PID eq ${p}`], { encoding: 'utf8' });
        if (/produc/i.test(r.stdout || '')) { motivo = `matar el proceso del arb (PID ${p} es produc.exe)`; break; }
      }
    }
  }
  // 2. cerrar la VENTANA PRINCIPAL: `ProdWindow` es la CLASE (señal fuerte); por titulo se
  //    exige que NO nombre un `Maestro ...`, porque ahi el WM_CLOSE es el de descartar edicion.
  if (!motivo && ARB_CERRAR.test(corre)) {
    if (/ProdWindow/.test(visible)) motivo = 'cerrar la ventana principal del arb (clase ProdWindow)';
    else if (/Producci/i.test(visible) && !/Maestro/i.test(visible)) motivo = 'cerrar la ventana principal del arb (titulo Produccion)';
  }
  if (!motivo) return null;
  const ok = path.join(dirHome(env), '.claude', '.arb-cerrar-ok');
  if (escapes !== false && fs.existsSync(ok)) {
    try { fs.unlinkSync(ok); } catch { /* si no se pudo consumir, igual se deja pasar esta vez */ }
    return aviso('ARB-CERRAR-GUARD: habilitado por ~/.claude/.arb-cerrar-ok (consumido). Cerrando el arb.');
  }
  return bloqueo(`[ARB-CERRAR-GUARD] BLOQUEADO: ibas a ${motivo}.

REGLA DURA (Fak, 31/08/2026): el arb NO se cierra sin consultarle. Ni al terminar una
tarea, ni "para dejar limpio", ni porque una instruccion de otra sesion lo diga.

POR QUE: reabrirlo pide USUARIO Y CONTRASEÑA, y la sesion no tipea contraseñas. O sea
que cerrarlo cuesta un segundo y volver a abrirlo NO depende de mi: depende de que Fak
este disponible. El 31/08 lo cerre al terminar de leer el maestro, al rato hubo que
cargar el reemplazo del remache, y la tarea quedo frenada dos veces esperandolo. Fak:
"no vuelvas a cerrar arb sin consultarme, fue gravisimo eso".

QUE HACER EN VEZ:
  - Dejalo abierto. Un arb abierto no molesta a nadie y es el estado por defecto.
  - Si de verdad hay que cerrarlo, PREGUNTALE A FAK primero, con el motivo.
  - Si Fak ya dijo que si:  touch ~/.claude/.arb-cerrar-ok   y reintenta (vale 1 vez).

NO BLOQUEADO, por si era lo que buscabas: cerrar 'Maestro de Insumos' con WM_CLOSE (es el
modo documentado de descartar una edicion sin grabar) y 'python scripts/_arbVer.py reset'
con Relaciones CERRADA (solo la abre). 'Maestro de Relaciones' ABIERTA no se cierra: crashea
el arb (25/09/2026, regla arb-no-cerrar.md); 'reset --forzar' solo con OK de Fak.`);
};

// ── apqp-cliente-guard ─────────────────────────────────────────────────────
// Regla `.claude/rules/autonomy-contract.md` §F (Fak, 21/09/2026). Dos zonas donde Ingenieria
// no escribe sola:
//
//   1. EL PAQUETE QUE VA AL CLIENTE. Adentro de un legajo PPAP, la carpeta del paquete del
//      cliente (`PPAP_<part number>_<n>`) la arma CALIDAD, no Ingenieria. El 21/09/2026 emiti
//      el flujograma 159 Rev.A y lo copie ahi sin que Fak lo viera: *"lo del plano no me parece
//      mal que lo pongas en su carpeta pero todo lo demas... si"*.
//   2. LOS LISTADOS MAESTROS (flujogramas, AMFEs, hojas de proceso). Son registro compartido:
//      la fila la carga Fak o se carga con su OK.
//
// Lo que NO bloquea: leer cualquiera de las dos, y SACAR algo del paquete del cliente — esa es
// la unica correccion posible cuando ya se colo un archivo. Tampoco toca el resto del legajo
// APQP: cargar el plano del cliente en `6-Planos de la pieza` quedo autorizado.
const APQP_PAQUETE = /[\\/]PPAP_[A-Za-z0-9][A-Za-z0-9._-]*[\\/]/;
const APQP_LISTADO = /Listado_Maestro_[A-Za-z]+\.xlsx|Listado hojas de proceso\.xlsx/i;
const APQP_EXCEPCION = /(__tests__|\.test\.|\.spec\.|[/\\]hooks[/\\]|[/\\]_lib[/\\]guardianes\.mjs$|[/\\]\.claude[/\\]rules[/\\]|[/\\]\.claude[/\\]skills[/\\]|LECCIONES_APRENDIDAS)/i;
// Que cuenta como ESCRIBIR. Son comandos concretos, no heuristicas.
//
// Sin el `>` a proposito: la redireccion es demasiado facil de encontrar adentro de un
// `python -c` cualquiera, y bloquear una LECTURA es peor que no bloquear nada — un gate que
// frena leer termina apagado. Paso el 21/09/2026: un script que solo abria el listado para
// verificarlo cayo en rojo porque su regex incluia `[^>]*` y una barra mas adelante.
// Lo que de verdad escribe en un listado maestro llega por dos caminos y los dos estan aca:
// copiar/mover un archivo encima, o correr un script de alta con --apply (APQP_REGISTRA).
const APQP_ESCRIBE = /(^|[;&|\s])(cp|copy|xcopy|robocopy|mv|move)(\s|$)|Copy-Item|Move-Item|shutil\.(copy|move)/im;
// El `>` SI se mira para el paquete del cliente, donde un archivo generado directo adentro es
// justamente una de las formas de colarlo, y la ruta del paquete es inconfundible.
const APQP_GENERA = /(^|[;&|\s])(cp|copy|xcopy|robocopy|mv|move)(\s|$)|Copy-Item|Move-Item|shutil\.(copy|move)|>\s*["']?[^"'\s|]*[\\/]/im;
// Los scripts de alta en un listado maestro siguen todos el mismo patron: `_registrar*` + --apply.
//
// Tiene que estar EJECUTANDOSE: un interprete adelante, y en el mismo tramo del comando.
// Nombrar el script como argumento de un `grep`, un `ls` o un `cat` es LEERLO, y un gate que
// frena leer termina apagado. El 21/09/2026 este patron corto tres veces seguidas sin que
// hubiera una sola escritura: la ultima fue `grep -n "...--apply..." scripts/_registrarAmfe173.py`,
// o sea el comando con el que iba a ARREGLAR la fila que el gate cuida.
const APQP_REGISTRA = /(^|[;&|]+\s*)(py|python3?|node)\b[^\n;&|]*_registrar[A-Za-z0-9]*\.(py|mjs)\b[^\n;&|]*--apply/i;

const APQP_CIERRE = `Regla: .claude/rules/autonomy-contract.md §F — "la PRIMERA VEZ se pregunta".
Que va en cada casillero del legajo APQP: skill \`apqp-legajo\`.`;

GUARDIANES['apqp-cliente-guard'] = (ctx, { env, escapes } = {}) => {
  let tool, cmd, file;
  if (ctx.ok) { tool = ctx.toolL; cmd = ctx.cmd6; file = ctx.fileL; }
  else { tool = ctx.rescate.tool; file = ctx.rescate.file; cmd = `${ctx.rescate.cmd} ${ctx.raw.replace(/\n/g, ' ')}`; }
  const todo = `${cmd} ${file}`;
  if (APQP_EXCEPCION.test(todo)) return null;
  // `toolL` es el nombre LIMPIO, no en minuscula: por el despachador llega «Write» / «Edit» (hasta el 11/10/2026 se
  // comparaba con 'write' y esta rama no corria nunca en vivo; los tests armaban el contexto a mano en minuscula).
  const esEscritura = /^(?:write|edit)$/i.test(tool);

  // 1. El paquete del cliente
  const destino = esEscritura ? file : ultimaRuta(cmd);
  const vaAlPaquete = APQP_PAQUETE.test(destino);
  if (vaAlPaquete && (esEscritura || APQP_GENERA.test(cmd))) {
    return bloqueo(`[APQP-CLIENTE] BLOQUEADO: estas poniendo un archivo en el PAQUETE QUE VA AL CLIENTE.

${destino}

Esa carpeta es el paquete de PPAP que Barack le devuelve al cliente, y lo arma CALIDAD.
Ingenieria le deja la base (flujograma, AMFE, base de plan de control) en el LEGAJO; quien
decide que entra al paquete, con que revision y cuando se presenta, no soy yo.

Y hay un motivo mas: un documento vivo tiene UN solo lugar. La copia que se deja "por las
dudas" en el paquete envejece sola y despues nadie sabe cual manda.

  · Dejalo en el casillero del legajo que le corresponde y avisale a Fak que esta listo.
  · Si Fak ya dijo que va al paquete, decilo y lo copio.
  · SACAR algo de ahi no esta bloqueado: eso siempre se puede.

${APQP_CIERRE}`);
  }

  // 2. Los listados maestros
  const tocaListado = APQP_LISTADO.test(destino) || (!esEscritura && APQP_LISTADO.test(cmd));
  if ((esEscritura && APQP_LISTADO.test(file)) || (!esEscritura && tocaListado && APQP_ESCRIBE.test(cmd)) || APQP_REGISTRA.test(cmd)) {
    // Escape de UN uso, igual que arb-cerrar-guard: cuando Fak ya dijo que si, el gate tiene
    // que poder abrirse. Un gate que no se puede pasar ni con autorizacion no se respeta, se
    // esquiva — y ahi deja de existir. Se consume al usarlo para que valga por UNA carga.
    const okListado = path.join(dirHome(env ?? process.env), '.claude', '.apqp-listado-ok');
    if (escapes !== false && fs.existsSync(okListado)) {
      try { fs.unlinkSync(okListado); } catch { /* si no se puede borrar, igual paso: el aviso queda */ }
      return aviso(`[APQP-CLIENTE] Paso con el OK de Fak (se consumio ~/.claude/.apqp-listado-ok).
Despues de cargar: releer la fila y verificar que la de al lado quedo intacta.`);
    }
    return bloqueo(`[APQP-CLIENTE] BLOQUEADO: estas por escribir en un LISTADO MAESTRO.

${destino || cmd.slice(0, 120)}

Los listados maestros (flujogramas, AMFEs, hojas de proceso) son el registro compartido de
Ingenieria: de ahi sale el numero de cada documento y el estado de cada uno. Una fila cargada
de mas, o con una ruta que todavia no existe, la arrastra despues todo el mundo.

  · Corre el script en DRY-RUN (sin --apply), mostrale a Fak la fila que va a quedar, y
    aplicala con su OK.
  · Leer el listado no esta bloqueado.
  · Si Fak YA dijo que si:  : > ~/.claude/.apqp-listado-ok   y reintenta (vale UNA carga).

${APQP_CIERRE}`);
  }

  return null;
};

// ── nube-personal-guard ────────────────────────────────────────────────────
// Regla `.claude/rules/nube-ingenieria.md` (Fak, 01/10/2026): "no quiero nada en mi nube personal...
// solo laburamos en la nube de ingenieria... dejalo bien anotado como regla dura, no podemos volver a
// fallar". En la PC hay DOS carpetas de OneDrive: `OneDrive - BARACK ARGENTINA SRL\` es la nube de la
// CUENTA de Fak (la ve solo el, y cualquier PC donde ponga su cuenta) y `BARACK ARGENTINA SRL\Ingenieria
// y Proyecto - General\` es la biblioteca del sector. BLOQUEA guardar, copiar, mover o crear adentro de
// la primera. Deja pasar: LEER de ahi, SACAR cosas de ahi, y lo que hoy vive ahi y todavia no se mudo
// (el Escritorio, que Windows guarda ahi, y la copia de docs-local): cuando se muden salen de NP_TRANSICION.
const NP_ZONA = /[\\/]OneDrive - BARACK ARGENTINA SRL(?=[\\/]|["'\s]|$)/i;
const NP_TRANSICION = /[\\/]OneDrive - BARACK ARGENTINA SRL[\\/](Desktop|Escritorio|Barack-docs-local)(?=[\\/]|["'\s]|$)/i;
const NP_CREA = /(^|[;&|\s(])(mkdir|md|touch)(\s|$)|New-Item|os\.makedirs|mkdirSync/im;
const NP_COPIA_O_MUEVE = /(^|[;&|\s(])(cp|copy|xcopy|robocopy|mv|move)(\s|$)|Copy-Item|Move-Item|shutil\.(copy|move)/im;
const enNubePersonal = (ruta) => NP_ZONA.test(ruta) && !NP_TRANSICION.test(ruta);

/** La ruta de la nube personal a la que el comando ESCRIBE, o '' si solo lee o saca de ahi. */
export function escribeEnNubePersonal(cmd, cwd = null) {
  const an = analizarComando(cmd, { cwd });
  const salida = an.salidas.find((s) => s.ok && enNubePersonal(s.valor));
  if (salida) return salida.valor;
  for (const tramo of String(cmd).split(/&&|\|\||[;|]|\r?\n/)) {
    // Argumentos del tramo sin opciones (-r, -Force, /E, /MIR) ni redirecciones (2>&1, >/dev/null).
    const args = (tramo.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((t) => t.replace(/^["']|["']$/g, ''))
      .filter((t) => !/^-/.test(t) && !/^\/[A-Za-z]{1,8}(:\S*)?$/.test(t) && !/^\d*[<>]/.test(t));
    if (!args.length) continue;
    // crear: cualquier argumento del tramo; copiar o mover: solo el DESTINO (el ultimo). Sacar de ahi pasa.
    if (NP_CREA.test(tramo)) { const r = args.find(enNubePersonal); if (r) return r; }
    if (NP_COPIA_O_MUEVE.test(tramo) && enNubePersonal(args[args.length - 1])) return args[args.length - 1];
  }
  return '';
}

GUARDIANES['nube-personal-guard'] = (ctx, { env, escapes } = {}) => {
  let destino = '';
  if (ctx.ok) {
    const tool = ctx.toolL;
    // `toolL` llega «Write» / «Edit» por el despachador (nombre limpio, no en minuscula): sin la `i` un Write a la nube
    // personal pasaba en vivo y solo se frenaban los comandos de consola (medido el 11/10/2026 con `evaluar`).
    if (/^(?:write|edit)$/i.test(tool)) destino = enNubePersonal(ctx.fileL) ? ctx.fileL : '';
    else destino = escribeEnNubePersonal(ctx.cmd ?? ctx.cmd6 ?? '', ctx.cwd || null);
  } else {
    // JSON roto: no hay comando confiable. Regla sobre el texto entero, hacia el lado seguro.
    const todo = `${ctx.rescate.cmd} ${ctx.rescate.file} ${ctx.raw.replace(/\n/g, '')}`;
    if (enNubePersonal(todo) && (NP_CREA.test(todo) || NP_COPIA_O_MUEVE.test(todo) || /"tool_name"\s*:\s*"(Write|Edit)"/.test(todo))) destino = 'la nube personal (no pude leer el comando entero)';
  }
  if (!destino) return null;
  // Escape de UN uso, igual que apqp-cliente-guard: si Fak dijo que ESE archivo va ahi, el freno se abre.
  const ok = path.join(dirHome(env ?? process.env), '.claude', '.nube-personal-ok');
  if (escapes !== false && fs.existsSync(ok)) {
    try { fs.unlinkSync(ok); } catch { /* si no se puede borrar, igual paso: el aviso queda */ }
    return aviso('[NUBE-PERSONAL] Paso con el OK de Fak (se consumio ~/.claude/.nube-personal-ok).');
  }
  return bloqueo(`[NUBE-PERSONAL] BLOQUEADO: estas por guardar algo en la nube PERSONAL de Fak.

${destino}

Regla dura de Fak, 01/10/2026: "no quiero nada en mi nube personal... solo laburamos en la nube
de ingenieria". \`OneDrive - BARACK ARGENTINA SRL\\\` es la nube de SU cuenta. El trabajo va a la
biblioteca del sector: \`BARACK ARGENTINA SRL\\Ingenieria y Proyecto - General\\\`.

  · Guardalo en su carpeta por tipo de la biblioteca de Ingenieria.
  · Leer de la nube personal y SACAR cosas de ahi no esta bloqueado.
  · Si Fak dijo que ESTE archivo va ahi:  : > ~/.claude/.nube-personal-ok   y reintenta (vale una vez).

Regla: .claude/rules/nube-ingenieria.md`);
};

// ── commit-rutas-guard ─────────────────────────────────────────────────────
// Regla `.claude/rules/git-deploy.md` paso 2: el commit lleva las rutas (`git commit -m "..." -- a b`).
// El indice de git es UNO para todas las sesiones que trabajan en el worktree principal: un
// `git commit` sin rutas guarda lo que haya ahi en ese instante, sea de quien sea. 02/10/2026: una
// sesion hizo `git add` de 9 archivos por nombre y despues `git commit` pelado; en esos segundos otra
// sesion puso 12 suyos en el indice y `cee8f1b2` salio con los 21 bajo un mensaje que no los
// describe, ya pusheado. La memoria `reference_sesiones_claude_en_paralelo_mismo_repo` lo decia desde
// el 30/08 y volvio a pasar el 11/09 y el 02/10: por eso pasa de memoria a freno.
// BLOQUEA un `git commit`: sin rutas · con `-a` (todo lo modificado) · con `--include` (suma las
// rutas a lo que ya este en el indice) · con una ruta que es TODO (`.`, `..`, `*`, `:/`, o solo una
// exclusion) · con rutas que no estan escritas (una variable que sale de un `$(...)`, `xargs`,
// `--pathspec-from-file`: si la lista viene vacia es un commit del indice entero).
// PASA: rutas despues de `--`, `--only rutas`, rutas sueltas, `--amend --only` (cambia solo el
// mensaje), `--allow-empty --only`, `--dry-run`, y el `git commit` que cierra un merge o un
// cherry-pick (ahi git no acepta rutas).
// Medido el 02/10/2026 contra los 887 comandos con `git commit` de los transcripts de 10 dias: 855
// iban sin rutas y 7 eran `--amend` pelados; los que ya llevaban rutas pasan todos (0 falsos rojos).
// Limites conocidos (auditoria del 02/10/2026): mira el texto del comando, asi que no ve un script
// que commitea por dentro, un alias, un commit entre backticks ni un `echo ... | bash`; un `<<PALABRA`
// ENTRE COMILLAS le esconde las lineas que siguen (lo decide `separarHeredocs`); y de PowerShell no
// entiende la continuacion con backtick ni los here-strings.
const CR_SQ = String.fromCharCode(0xE000); // la marca que `comandosSimples` deja por un `$` entre comillas simples
const CR_CONTROL = new Set(['then', 'do', 'else', 'elif', 'if', 'while', 'until', '!']);
// Lo que va DELANTE de un comando con sus propias opciones (`nice -n 5 git commit`, `sudo -u x git
// commit`, `xargs git commit`): tras uno de estos, `git` se busca entre las palabras que siguen.
const CR_ENVOLTORIOS = new Set(['sudo', 'command', 'builtin', 'exec', 'nohup', 'nice', 'time', 'env', 'timeout', 'stdbuf', 'winpty', 'xargs']);
const CR_DECLARA = new Set(['export', 'local', 'declare', 'typeset', 'readonly']);
const CR_GIT_GLOBAL_CON_VALOR = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix', '--attr-source']);
// Opciones de `git commit` que se llevan la palabra siguiente (git-commit(1)). `-S[id]` y `-u[modo]`
// llevan el valor pegado, no la palabra siguiente. Git acepta las largas abreviadas (`--mess`).
const CR_LARGAS_CON_VALOR = ['--message', '--file', '--reuse-message', '--reedit-message', '--fixup', '--squash', '--author', '--date', '--template', '--cleanup', '--trailer', '--pathspec-from-file'];
const CR_CORTAS_CON_VALOR = 'mFCct';
const CR_CORTAS_VALOR_PEGADO = 'Su';
const CR_EXCLUSION = /^:(\([^)]*\bexclude\b[^)]*\)|\/*[!^])/;
const crVerbo = (w) => String(w ?? '').replace(/^.*[\\/]/, '').replace(/\.exe$/i, '').toLowerCase();

/** Parte una palabra en lo que queda escrito y lo que va adentro de sus `$(...)` (con parentesis anidados). */
function crPartes(w) {
  let resto = '';
  const dentro = [];
  for (let i = 0; i < w.length; i++) {
    if (w[i] === '$' && w[i + 1] === '(') {
      let prof = 0;
      let j = i + 1;
      for (; j < w.length; j++) { if (w[j] === '(') prof++; else if (w[j] === ')' && --prof === 0) break; }
      dentro.push(w.slice(i + 2, j));
      i = j;
    } else if (w[i] === '`') {
      const j = w.indexOf('`', i + 1);
      i = j < 0 ? w.length : j;
    } else resto += w[i];
  }
  return { resto, dentro };
}
const crSinVariables = (x) => crPartes(String(x)).resto.replace(/\$\{[^}]*\}|\$env:\w+|\$\w+/gi, '');
/** Una ruta ESCRITA: le queda algo despues de sacarle variables y sustituciones. */
const crRutaEscrita = (x) => crSinVariables(x).length > 0;
/** Una ruta que es TODO: `.`, `./.`, `..`, `*`, `**`, `./*`, `*.*`, `:/`, `:(top)*`, `"$PWD/"`. */
function crRutaEsTodo(x) {
  const y = crSinVariables(x);
  if (y === '' && y !== String(x)) return false; // una variable sola: no se sabe (eso lo mira crRutaEscrita)
  return /^[.\\/*]*$/.test(y.replace(/^:\([^)]*\)/, '').replace(/^:\/*/, ''));
}

/** Saca los comentarios `# ...` de las lineas de comando (fuera de comillas): sus palabras no son rutas. */
function crSinComentarios(s) {
  let out = '';
  let q = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && q !== "'") { out += c + (s[i + 1] ?? ''); i++; continue; }
    if (q) { if (c === q) q = ''; out += c; continue; }
    if (c === '"' || c === "'") { q = c; out += c; continue; }
    if (c === '#' && (i === 0 || /[\s;&|(]/.test(s[i - 1]))) {
      while (i < s.length && s[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    out += c;
  }
  return out;
}

/**
 * Los comandos `git` de un comando de shell: [{ sub, args, crudo, dir, rutaConValor }].
 * Entra a `bash -c "..."`, `eval`, `cmd /c`, `powershell -Command`, a los `$(...)` y al heredoc que
 * alimenta a un shell. `dir`: undefined = la carpeta de la sesion · una ruta = un `cd`/`-C` absoluto ·
 * null = no se sabe (cd relativo, shell anidado).
 */
function comandosGit(texto, prof = 0, dirInicial = undefined) {
  const out = [];
  const adentro = (t) => { if (prof < 4 && t) out.push(...comandosGit(t.split(CR_SQ).join('$'), prof + 1, null)); };
  const { lineas, cuerpos } = separarHeredocs(String(texto ?? '').replace(/\r\n?/g, '\n'));
  for (const h of cuerpos) if (!h.deGit && /(^|[\s|;&(])(ba|z|da)?sh(\s|$)/.test(h.dueno)) adentro(h.cuerpo);
  // Variables que el MISMO comando escribe con un valor a la vista (`F="a.md b.md"; git commit -- $F`):
  // esas rutas estan escritas. Una que sale de un `$(...)` queda sin valor: puede venir vacia.
  const vars = new Map();
  let dir = dirInicial;
  for (const c of comandosSimples(crSinComentarios(lineas))) {
    const p = c.palabras;
    for (const w of p) if (w.includes('$(')) for (const s of crPartes(w).dentro) adentro(s);
    const asignadas = [];
    let envuelto = false;
    let k = 0;
    while (k < p.length) {
      const asg = p[k].match(/^([A-Za-z_][A-Za-z0-9_]*)(\+?)=([\s\S]*)$/);
      if (asg) { asignadas.push([asg[1], asg[2] || /[$`]/.test(asg[3]) || asg[3].includes(CR_SQ) ? '' : asg[3]]); k++; continue; }
      const w = crVerbo(p[k]);
      if (CR_CONTROL.has(w) || CR_DECLARA.has(w)) { k++; continue; }
      if (CR_ENVOLTORIOS.has(w)) { envuelto = true; k++; continue; }
      break;
    }
    // `F=x` solo, en su propio comando, queda para los que siguen; `F=x git commit` vale solo para ese proceso.
    if (k === p.length) for (const [n, v] of asignadas) vars.set(n, v);
    if (envuelto && crVerbo(p[k]) !== 'git') { const j = p.findIndex((w, n) => n > k && crVerbo(w) === 'git'); if (j > 0) k = j; }
    const verbo = crVerbo(p[k]);
    const esAbsoluta = (d) => typeof d === 'string' && /^([A-Za-z]:|[\\/])/.test(d) && !/[$`]/.test(d) && !d.includes(CR_SQ);
    if (verbo === 'git') {
      k++;
      let enC;
      while (k < p.length && p[k].startsWith('-')) {
        if (p[k] === '-C') enC = p[k + 1];
        k += CR_GIT_GLOBAL_CON_VALOR.has(p[k]) ? 2 : 1;
      }
      // Solo las RUTAS se resuelven (el valor de un `-m "$MSG"` partido en palabras pareceria una ruta).
      const valores = new Map(vars);
      const rutaConValor = (a) => { const m = a.match(/^\$\{?([A-Za-z_]\w*)\}?$/); return m && valores.get(m[1]) ? valores.get(m[1]).split(/\s+/).filter(Boolean) : [a]; };
      out.push({ sub: p[k] ?? '', args: p.slice(k + 1), crudo: c.crudo, dir: enC === undefined ? dir : (esAbsoluta(enC) ? enC : null), rutaConValor });
    } else if (/^(cd|pushd|chdir|set-location|sl|push-location)$/.test(verbo)) {
      const d = p.slice(k + 1).find((x) => !/^-/.test(x));
      dir = esAbsoluta(d) ? d : null;
    } else if (/^(popd|pop-location)$/.test(verbo)) {
      dir = null;
    } else if (/^(ba|z|da)?sh$/.test(verbo)) {
      const i = p.findIndex((a, n) => n > k && /^-[a-z]*c$/.test(a));
      if (i >= 0) adentro(p[i + 1]);
    } else if (verbo === 'cmd' || /^(powershell|pwsh)$/.test(verbo)) {
      const i = p.findIndex((a, n) => n > k && /^(\/[ck]|-c|-command)$/i.test(a));
      if (i >= 0) adentro(p.slice(i + 1).join(' '));
    } else if (/^(eval|iex|invoke-expression)$/.test(verbo)) {
      adentro(p.slice(k + 1).join(' '));
    }
  }
  return out;
}

/** Lee los argumentos de un `git commit`: que rutas lleva y que opciones cambian lo que guarda. */
export function leerArgsDeCommit(args) {
  const r = { rutas: [], todo: false, incluir: false, solo: false, amend: false, vacio: false, seco: false, desdeArchivo: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') { r.rutas.push(...args.slice(i + 1)); break; }
    if (a.startsWith('--')) {
      const nombre = a.split('=')[0];
      // `--no-dry-run` apaga a `--dry-run`: gana la ultima, como en git.
      const no = nombre.startsWith('--no-');
      const es = (larga) => (no ? `--no-${larga.slice(2)}` : larga).startsWith(nombre);
      if (es('--all')) r.todo = !no;
      else if (es('--include')) r.incluir = !no;
      else if (es('--only')) r.solo = !no;
      else if (es('--amend')) r.amend = !no;
      else if (es('--allow-empty') && !nombre.startsWith('--allow-empty-')) r.vacio = !no;
      else if (es('--dry-run') || es('--short') || es('--porcelain') || es('--long') || es('--help')) r.seco = !no;
      else if (es('--pathspec-from-file')) r.desdeArchivo = !no;
      if (!no && !a.includes('=') && CR_LARGAS_CON_VALOR.some((larga) => larga.startsWith(nombre))) i++;
      continue;
    }
    if (/^-[A-Za-z]/.test(a)) {
      for (let k = 1; k < a.length; k++) {
        const c = a[k];
        if (c === 'a') r.todo = true;
        else if (c === 'i') r.incluir = true;
        else if (c === 'o') r.solo = true;
        else if (c === 'h') r.seco = true;
        if (CR_CORTAS_VALOR_PEGADO.includes(c)) break;
        if (CR_CORTAS_CON_VALOR.includes(c)) { if (k === a.length - 1) i++; break; }
      }
      continue;
    }
    if (a === '-') continue;
    r.rutas.push(a);
  }
  return r;
}

/** Por que un `git commit` no pasa ('' si pasa). */
function motivoDeCommit(a) {
  if (a.seco) return '';
  if (a.todo) return 'todo';
  if (a.incluir) return 'incluir';
  if (a.desdeArchivo) return 'ruta-variable';
  // `--only` sin rutas solo lo acepta git con --amend o --allow-empty, y ahi no toca el indice.
  if (!a.rutas.length) return a.solo && (a.amend || a.vacio) ? '' : 'sin-rutas';
  const positivas = a.rutas.filter((x) => !CR_EXCLUSION.test(x));
  if (!positivas.length) return 'ruta-todo'; // solo exclusiones: todo menos eso
  if (!positivas.some(crRutaEscrita)) return 'ruta-variable';
  if (positivas.some(crRutaEsTodo)) return 'ruta-todo';
  return '';
}

/** Los `git commit` del comando que no pasan, cuantos commits trae, y las rutas que el mismo comando agrego con `git add`. */
export function commitsSinRutas(cmd) {
  const cmds = comandosGit(String(cmd ?? ''));
  const malos = [];
  let commits = 0;
  for (const c of cmds) {
    if (c.sub !== 'commit') continue;
    commits++;
    const leido = leerArgsDeCommit(c.args);
    leido.rutas = leido.rutas.flatMap(c.rutaConValor);
    const motivo = motivoDeCommit(leido);
    if (motivo) malos.push({ motivo, crudo: c.crudo.replace(/\s+/g, ' ').trim(), dir: c.dir });
  }
  const agregadas = [...new Set(cmds.filter((c) => c.sub === 'add')
    .flatMap((c) => c.args.filter((a) => !a.startsWith('-')).flatMap(c.rutaConValor).filter((a) => crRutaEscrita(a) && !crRutaEsTodo(a))))];
  return { malos, agregadas, commits };
}

/** 'merge' / 'cherry-pick' si el repo de `dir` esta en medio de uno (git no acepta rutas ahi); '' si no. */
function commitQueCierra(dir) {
  const r = spawnSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: dir, encoding: 'utf8' });
  const g = r.status === 0 ? String(r.stdout || '').trim() : '';
  if (!g) return '';
  if (fs.existsSync(path.join(g, 'MERGE_HEAD'))) return 'merge';
  if (fs.existsSync(path.join(g, 'CHERRY_PICK_HEAD'))) return 'cherry-pick';
  return '';
}

const CR_MOTIVO = {
  'sin-rutas': 'no dice QUE archivos guarda',
  todo: 'lleva `-a`: guarda TODO lo modificado, tambien lo que este tocando otra sesion',
  incluir: 'lleva `--include`: suma las rutas a lo que ya este en el indice, sea de quien sea',
  'ruta-todo': 'pone como ruta `.` (o `..`, `*`, `:/`), que es TODO: se lleva tambien lo de otra sesion',
  'ruta-variable': 'no trae las rutas ESCRITAS (salen de una variable, de un `$(...)` o de una lista): si la lista viene vacia, guarda el indice entero',
};

GUARDIANES['commit-rutas-guard'] = (ctx, { env } = {}) => {
  const cmd = ctx.ok ? ctx.cmd : ctx.rescate.cmd;
  if (!cmd || !/\bcommit\b/.test(cmd)) return null;
  const { malos, agregadas, commits } = commitsSinRutas(cmd);
  if (!malos.length) return null;
  // El commit que cierra un merge o un cherry-pick no admite rutas ("cannot do a partial commit
  // during a merge"): ese pasa. Solo si es el UNICO commit del comando (un segundo ya no cierra nada)
  // y se sabe en que carpeta corre. `-a` e `--include` siguen frenados tambien ahi.
  const m = malos[0];
  if (commits === 1 && m.motivo === 'sin-rutas' && m.dir !== null) {
    const dir = m.dir === undefined ? (ctx.cwd || raizProyecto(env ?? process.env)) : aRutaWin(m.dir, m.dir);
    const cierra = dir ? commitQueCierra(dir) : '';
    if (cierra) {
      return recordatorio(path.join(dirTmp(env ?? process.env), 'claude-commit-rutas-merge.flag'),
        `[COMMIT-RUTAS] Este \`git commit\` paso sin rutas porque cierra un ${cierra} (git no acepta rutas ahi). Se lleva lo que haya en el indice: mira \`git show --stat HEAD\` antes del push.`);
    }
  }
  const comillas = (x) => (/\s/.test(x) ? `"${x}"` : x);
  const tuyas = agregadas.length ? `
En este mismo comando agregaste: ${agregadas.map(comillas).join(' ')}
Termina el commit con:  -- ${agregadas.map(comillas).join(' ')}
` : '';
  return bloqueo(`[COMMIT-RUTAS] BLOQUEADO: este \`git commit\` ${CR_MOTIVO[m.motivo]}.

  ${m.crudo.slice(0, 200)}

El indice de git es UNO SOLO para todas las sesiones que trabajan en la misma carpeta. Un commit
sin rutas guarda lo que haya ahi en ese momento, incluido lo que otra sesion agrego mientras
tanto (02/10/2026: el commit cee8f1b2 salio con 12 archivos de otra sesion, y ya estaba pusheado).

El comando correcto lleva las rutas, escritas una por una, despues de \`--\`:

  git add ruta1 ruta2
  git commit -m "mensaje" -- ruta1 ruta2
${tuyas}
  · Con el mensaje por heredoc:  git commit -F - -- ruta1 ruta2 <<'MSG'
  · Sumar un archivo al ultimo commit:  git commit --amend --no-edit -- ruta1
  · Cambiar solo el mensaje del ultimo commit:  git commit --amend --only -m "mensaje"
  · Antes del push:  git show --stat HEAD   y contar los archivos.

Regla: .claude/rules/git-deploy.md, paso 2.`);
};

export const NOMBRES = Object.keys(GUARDIANES);

// ─────────────────────────────────────────────────────────────────────────── motor

/**
 * CARRIL DE AUTO-REPARACION (22/09/2026). Un guardian roto bloquea TODO Bash/Edit/Write, y eso
 * incluye el Edit que lo arreglaria: el 10/09 (03292ba3, un export sin definir) todas las sesiones
 * quedaron trabadas ~9 minutos hasta que un subagente lo arreglo desde un worktree, y el 21/09
 * paso dos veces mas (un ReferenceError adentro de apqp-cliente-guard). Solo un Edit/Write sobre
 * los archivos DE LOS GUARDIANES pasa cuando el que falla es un guardian: guardianes.mjs, los
 * modulos locales que importa (./shellTexto.mjs) y los .data.json que lee (los de scripts/_lib y
 * los que su fuente nombra). Todo lo demas sigue bloqueado. El despachador (_dispatcher.sh) repite
 * esta misma regla para cuando el modulo ni siquiera carga (ahi no puede importar esta funcion).
 */
export function esArchivoDeReparacion(file, fuente, raizRepo) {
  const f = path.posix.normalize(String(file ?? '').replace(/\\/g, '/').replace(/^\/([a-zA-Z])\//, (m, d) => `${d}:/`));
  const base = (f.split('/').pop() || '').toLowerCase();
  if (!base) return false;
  // Solo archivos DE ESTE REPO (22/09/2026, prueba de ataque): sin esto, con los guardianes
  // caidos pasaba un Write a <Escritorio>/scripts/_lib/guardianes.mjs o a cualquier *.data.json
  // de una carpeta scripts/_lib de afuera. La ruta se normaliza antes (un `..` no sale).
  const raiz = (raizRepo ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'))
    .replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  if (!f.toLowerCase().startsWith(raiz + '/')) return false;
  const enLib = /(^|\/)scripts\/_lib\/[^/]+$/i.test(f);
  if (enLib && (base === 'guardianes.mjs' || base.endsWith('.data.json'))) return true;
  let src = fuente;
  if (src === undefined) { try { src = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8'); } catch { src = ''; } }
  const locales = [...src.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)].map((m) => m[1].toLowerCase());
  if (enLib && locales.includes(base)) return true;
  const datos = [...src.matchAll(/['"`/\\]([\w.-]+\.data\.json)['"`]/g)].map((m) => m[1].toLowerCase());
  return datos.includes(base);
}

/** Corre los guardianes pedidos. Una excepcion adentro de uno BLOQUEA con el error. */
export function correr(nombres, ctx, deps = {}) {
  const ahora = deps.ahora ?? Math.floor(Date.now() / 1000);
  const env = deps.env ?? process.env;
  const res = { bloqueos: [], avisos: [], recordatorios: [], contextos: [], supabase: false, sesion: { sid: ctx.sid || '', agente: ctx.agente || '' } };
  const reparando = ctx.ok && (ctx.tool === 'Edit' || ctx.tool === 'Write') && esArchivoDeReparacion(ctx.file, undefined, env.GUARDIANES_RAIZ_REPO);
  for (const n of nombres) {
    const g = GUARDIANES[n];
    if (!g) continue;
    let v;
    try { v = g(ctx, { ahora, env, escapes: deps.escapes }); } catch (e) {
      const texto = `[${n}] ERROR interno del guardian — se bloquea por seguridad (un guardian que no corre parece un guardian que aprobo):\n${e && e.stack || e}`;
      if (reparando) {
        res.contextos.push({ guardian: n, texto: `${texto}\n[CARRIL DE AUTO-REPARACION] Este Edit/Write es sobre un archivo de los guardianes (${ctx.file}): pasa igual para que se pueda arreglar. Cualquier otra herramienta sigue bloqueada hasta que el guardian vuelva a correr.` });
      } else res.bloqueos.push({ guardian: n, texto });
      continue;
    }
    for (const x of [].concat(v ?? [])) {
      if (!x) continue;
      if (x.tipo === 'bloqueo') res.bloqueos.push({ guardian: n, texto: x.texto });
      else if (x.tipo === 'aviso') res.avisos.push({ guardian: n, texto: x.texto });
      else if (x.tipo === 'recordatorio') res.recordatorios.push({ guardian: n, flag: x.flag, texto: x.texto });
      else if (x.tipo === 'supabase') res.supabase = true;
    }
  }
  return res;
}

/**
 * Convierte el resultado en salida de hook. Los recordatorios pasan por su control recien
 * aca (una vez por sesion si el payload trae `session_id`; si no, el cooldown de una hora), y
 * solo si nada bloqueo: si la llamada no va a correr, el aviso se perderia y encima quedaria
 * consumido.
 */
export function resolver(res, { ahora = Math.floor(Date.now() / 1000), marcar = true, env = process.env } = {}) {
  const err = res.avisos.map((a) => a.texto);
  if (res.bloqueos.length) {
    err.push(...(res.contextos || []).map((c) => c.texto), ...res.bloqueos.map((b) => b.texto));
    return { exit: 2, stderr: `${err.join('\n')}\n`, stdout: '', contexto: '' };
  }
  // Los avisos del carril de auto-reparacion van al contexto sin cooldown: el modelo tiene que
  // saber que un guardian esta roto aunque la herramienta haya pasado.
  const textos = (res.contextos || []).map((c) => c.texto);
  const vistos = new Set();
  const conSesion = Boolean(res.sesion?.sid);
  const marcasSesion = conSesion ? archivoMarcasSesion(res.sesion, env) : '';
  const yaMostrados = conSesion && res.recordatorios.length ? recordatoriosYaMostrados(marcasSesion) : new Set();
  for (const r of res.recordatorios) {
    if (vistos.has(r.flag)) continue;
    vistos.add(r.flag);
    if (conSesion) {
      const clave = path.basename(r.flag);
      if (yaMostrados.has(clave)) continue;                 // ya salio en esta sesion
      if (marcar) marcarRecordatorioDeSesion(marcasSesion, clave);
    } else {
      if (cooldownVigente(r.flag, ahora)) continue;
      if (marcar) marcarFlag(r.flag, ahora);
    }
    textos.push(`${r.texto}\n(Si ya cumpliste, o no aplica a esta operacion, segui: esto es un recordatorio, no un bloqueo.)`);
  }
  const contexto = textos.join('\n\n');
  const stdout = contexto ? JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: contexto } }) : '';
  return { exit: 0, stderr: err.length ? `${err.join('\n')}\n` : '', stdout, contexto };
}

/**
 * Todo junto: JSON crudo → { ctx, res, salida }. `nombres` pisa la matriz (modo --solo).
 * `escapes: false` es para quien CONSULTA a los guardianes sin ser la sesion de Fak (el agente por API): los permisos de
 * un solo uso (`~/.claude/.arb-cerrar-ok`, `.apqp-listado-ok`, `.nube-personal-ok`) ni se usan ni se consumen. Sin eso,
 * una consulta con `marcar: false` se llevaba el permiso que Fak habia dejado para otra cosa (cola HOY-24b, 11/10/2026).
 */
export function evaluar(raw, { nombres, ahora, env, marcar, escapes } = {}) {
  const ctx = parsear(raw);
  const lista = nombres ?? matriz(ctx.tool);
  const res = correr(lista, ctx, { ahora, env, escapes });
  return { ctx, res, salida: resolver(res, { ahora, marcar, env }) };
}

/** Entrada del despachador: escribe stdout/stderr, deja la marca `supabase` y devuelve el exit. */
export async function despachar(raw, dir) {
  const { res, salida } = evaluar(raw);
  if (res.supabase && dir) { try { fs.writeFileSync(path.join(dir, 'supabase'), '1'); } catch { /* el .sh lo vuelve a detectar solo */ } }
  if (salida.stdout) process.stdout.write(salida.stdout);
  if (salida.stderr) process.stderr.write(salida.stderr);
  return salida.exit;
}

// ─────────────────────────────────────────────────────────────────────────── CLI

async function leerStdin() {
  if (process.stdin.isTTY) return '';
  let s = '';
  for await (const chunk of process.stdin) s += chunk;
  return s;
}

async function main() {
  const args = process.argv.slice(2);
  const valor = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const solo = valor('--solo');
  const tmp = valor('--tmp');
  let nombres;
  if (solo) {
    nombres = solo.split(',').map((s) => s.trim()).filter(Boolean);
    const malos = nombres.filter((n) => !GUARDIANES[n]);
    if (malos.length) { process.stderr.write(`guardianes.mjs: guardian desconocido: ${malos.join(', ')}. Conozco: ${NOMBRES.join(', ')}\n`); process.exitCode = 1; return; }
  }
  const desdeEnv = solo && ['HOOK_FILE', 'HOOK_CMD', 'HOOK_PARSED4', 'HOOK_PARSED3', 'HOOK_TARGET'].some((k) => k in process.env);
  let ctx, raw = '';
  if (desdeEnv) ctx = ctxDesdeEnv(process.env);
  else { raw = await leerStdin(); ctx = parsear(raw); }
  const res = correr(nombres ?? matriz(ctx.tool), ctx, {});
  const salida = resolver(res, {});
  if (res.supabase) {
    if (tmp) { try { fs.writeFileSync(path.join(tmp, 'supabase'), '1'); } catch { /* idem */ } }
    else process.stderr.write('supabase-guard: script destructivo detectado (el backup lo corre .claude/hooks/supabase-guard.sh).\n');
  }
  if (salida.stdout) process.stdout.write(salida.stdout);
  if (salida.stderr) process.stderr.write(salida.stderr);
  process.exitCode = salida.exit;
}

if (process.argv[1] && /guardianes\.mjs$/.test(process.argv[1].replace(/\\/g, '/'))) {
  main().catch((e) => { process.stderr.write(`[GUARDIANES] fallo interno — se bloquea por seguridad:\n${e && e.stack || e}\n`); process.exitCode = 2; });
}
