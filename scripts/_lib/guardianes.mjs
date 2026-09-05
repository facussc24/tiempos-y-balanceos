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
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

/** Port del awk de arb-cerrar-guard: quita los CUERPOS de heredoc, deja las lineas de comando. */
export function sinCuerposHeredoc(cmd) {
  const out = [];
  let fin = '';
  for (const l of cmd.split('\n')) {
    if (fin) { if (l === fin || l.trim().split(/\s+/)[0] === fin) fin = ''; continue; }
    const m = l.match(/<<-?\s*'?([A-Za-z_][A-Za-z0-9_]*)'?/);
    if (m) fin = m[1];
    out.push(l);
  }
  return out.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────── parseo

/** Rescate a mano de campos de un JSON que no parsea (truncado, comilla sin cerrar). */
function rescatarCampos(raw) {
  const des = (s) => s.replace(/\\(["\\/bfnrt]|u[0-9a-fA-F]{4})/g, (m, c) =>
    ({ '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' })[c] ?? String.fromCharCode(parseInt(c.slice(1), 16)));
  const campo = (k) => { const m = raw.match(new RegExp(`"${k}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`)); return m ? des(m[1]) : ''; };
  return { tool: campo('tool_name'), cmd: campo('command'), file: campo('file_path'), content: campo('content') || campo('new_string') };
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
    return { ok: false, raw, rescate: r, tool: '', cmd: '', file: '', content: '', target: '', cmd6: '', body6: '', toolL: '', fileL: '', parsed4: '', parsed3: '' };
  }
  const t = j.tool_input && typeof j.tool_input === 'object' ? j.tool_input : {};
  return armarCtx({ raw, tool: String(j.tool_name ?? ''), cmd: String(t.command ?? ''), file: String(t.file_path ?? ''), content: String(t.content ?? t.new_string ?? '') });
}

function armarCtx({ raw, tool, cmd, file, content, parsed4 }) {
  const toolL = limpiar(tool), cmd6 = limpiar(cmd).slice(0, CORTE), fileL = limpiar(file), body6 = limpiar(content).slice(0, CORTE);
  return {
    ok: true, raw, rescate: null, tool, cmd, file, content, target: `${cmd} ${file}`,
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
const SOLO_SHELL = ['supabase-guard', 'validator-check', 'renumber-guard', 'push-guard', 'arb-cerrar-guard', 'script-inline-guard'];
const SOLO_ARCHIVO = ['file-guard', 'causas-ajenas-guard'];
const LOS_CUATRO = ['consumos-entregable-guard', 'cad-guard', 'patrones-guard', 'escritorio-guard', 'borrado-masivo-guard', 'ho-numeracion-guard', 'mail-guard'];
export const TODOS = ['file-guard', 'supabase-guard', 'validator-check', 'renumber-guard', 'push-guard', 'script-inline-guard', ...LOS_CUATRO, 'arb-cerrar-guard', 'causas-ajenas-guard'];

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
  if (f.endsWith('package-lock.json') || f.endsWith('.env') || f.includes('.env.') || f.includes('/.git/')) {
    return bloqueo(`BLOCKED: ${f} es archivo protegido`);
  }
  if (/\.claude\/rules\/.*\.md$/.test(f)) {
    return recordatorio(path.join(dirTmp(env), 'claude-rule-gate.flag'),
      `RULE-GATE: estas editando una regla (${f}). Si declara un SIEMPRE/NUNCA operativo, cargala con su ENFORCEMENT ejecutable en esta misma sesion (hook, check del validator o gate de script) — skill rule-enforcement-gate. Si ya lo tenes cubierto o es solo prosa informativa, segui.`);
  }
  return null;
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
GUARDIANES['push-guard'] = (ctx, { env }) => {
  const cmd = ctx.cmd;
  if (!cmd || !/(^|[;&|]\s*)git\s+(-C\s+\S+\s+)?push/m.test(cmd)) return null;
  const root = raizProyecto(env);
  const dist = path.join(root, 'dist', 'index.html');
  let distM;
  try { distM = Math.floor(fs.statSync(dist).mtimeMs / 1000); } catch {
    return bloqueo("PUSH-GUARD: no existe dist/index.html — corre 'npm run build' ANTES de pushear (regla git-deploy). Si el build pasa, reintenta el push.");
  }
  const r = spawnSync('git', ['ls-files', '-z', '--', '*.ts', '*.tsx', '*.css', 'index.html', 'package.json', 'vite.config.ts'], { cwd: root, encoding: 'utf8' });
  let newest = 0;
  for (const f of (r.stdout || '').split('\0')) {
    if (!f) continue;
    try { newest = Math.max(newest, Math.floor(fs.statSync(path.join(root, f)).mtimeMs / 1000)); } catch { /* borrado sin commitear */ }
  }
  if (newest > distM) {
    return bloqueo("PUSH-GUARD: hay codigo fuente mas nuevo que el ultimo build (dist/). Corre 'npm run build' primero (regla git-deploy — incidente 2026-04-13: el build de CI valida imports que el dev server no). Si pasa, reintenta el push.");
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
3. Vinilo/tela de SERIE: fuente autoritativa = tabla tizadas Mesa de Corte (col ML), no el arb/BOM.
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
  if (!ESC_ZONA.test(todo)) return null;

  // 1. Borrar: prohibido, sin excepcion
  if (ESC_BORRA.test(cmd) || ESC_BORRA_CMD.test(cmd)) {
    return bloqueo(`[ESCRITORIO-GUARD] BLOQUEADO: estas por borrar algo del Escritorio o de la biblioteca de
Ingenieria — que ademas lleva "(NUNCA BORRAR)" en el nombre y esta bajo control documental.

NADA SE BORRA NUNCA. El contexto de un reclamo aparece dos anos despues con un ECN o un
PPAP viejo, y guardar sale gratis.

Lo que se termino se ARCHIVA, no se borra:
${ESC_ARCHIVAR}

Si de verdad hay que sacar algo, lo decide Fak explicitamente, no yo.`);
  }
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
  } else if (ESC_GENERA.test(cmd) && ESC_DENTRO.test(cmd) && ESC_ENTREGABLE.test(cmd)) {
    return bloqueo(TEXTO_ESC_GENERA);
  }
  // Recordatorio 1x/h. El directorio se pisa por env var para que los tests no compitan por
  // el mismo archivo con el guardian vivo de la sesion.
  const flagdir = env.ESCRITORIO_GUARD_FLAGDIR ? aRutaWin(env.ESCRITORIO_GUARD_FLAGDIR, env.ESCRITORIO_GUARD_FLAGDIR) : path.join(dirHome(env), '.claude');
  return recordatorio(path.join(flagdir, 'escritorio-guard.flag'), TEXTO_ESC_RECORDATORIO);
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
const BM_EXCEPCION = /(__tests__|\.test\.|\.spec\.|[/\\]hooks[/\\]([a-z-]+-guard|_dispatcher)\.sh$|[/\\]_lib[/\\]guardianes\.mjs$)/i;
GUARDIANES['borrado-masivo-guard'] = (ctx) => {
  let tool, cmd, file, body;
  if (ctx.ok) { tool = ctx.toolL; cmd = ctx.cmd6; file = ctx.fileL; body = ctx.body6; }
  else {
    // Red de seguridad: si no se pudo parsear, mirar el JSON crudo (mas lo rescatado a mano).
    tool = ctx.rescate.tool; file = ctx.rescate.file;
    cmd = `${ctx.rescate.cmd} ${ctx.raw}`; body = `${ctx.rescate.content} ${ctx.raw}`;
  }
  // Segunda red: el contenido puede venir RECORTADO y el bucle que borra suele estar al FINAL
  // (verificado 2026-08-13 con un .py de 4.842 caracteres). Si llego cerca del tope, se suma
  // el JSON crudo al haystack.
  if (body.length >= TRUNC_HINT || cmd.length >= TRUNC_HINT) body = `${body} ${ctx.raw}`;
  const haystack = `${cmd} ${body}`;
  const esEscritura = tool === 'Write' || tool === 'Edit';
  // Los tests, los guardianes y este modulo CITAN los patrones peligrosos como dato: es su
  // trabajo. Sin esta excepcion el guardian se bloquea a si mismo (paso al escribir su test).
  if (esEscritura && BM_EXCEPCION.test(file)) return null;

  let motivo = '';
  // V1: -Include junto con -Recurse. El filtro se ignora en silencio y el alcance se dispara.
  if (/Get-ChildItem/i.test(haystack) && /-Recurse/i.test(haystack) && /-Include/i.test(haystack) && !/\\\*|\/\*/.test(haystack)) motivo += 'V1';
  // V2: .ps1 con caracteres no-ASCII (powershell.exe 5.1 lo lee como ANSI si no tiene BOM).
  if (/\.ps1$/i.test(file) && /[^\x00-\x7F]/.test(body)) motivo += 'V2';
  // V3: borrado permanente en vez de Papelera. Excluidos (auditor 07/08): `git rm` (queda en
  // el historial) y scratchpad/temporales (efimeros, no son cosas de Fak).
  const excluido = /(^|[;&|]|\s)git\s+rm\b/i.test(haystack)
    || /(scratchpad|[/\\]tmp[/\\]|AppData[/\\]Local[/\\]Temp|node_modules|[/\\]dist[/\\]?|\.venv)/i.test(haystack);
  if (!excluido && /(Remove-Item[^|;\n]*-(Force|Recurse)|rm +-[a-z]*r[a-z]*f|rm +-[a-z]*f[a-z]*r|DeletePermanently|shutil\.rmtree|fs\.rmSync)/i.test(haystack)) motivo += 'V3';
  // V4: script que borra/mueve en lote sin dry-run. Los tokens se buscan con los comentarios
  // afuera (05/09/2026: un comentario que decia "no usa fs.rename ni mv" bloqueo dos Write).
  if (esEscritura && /\.(ps1|sh|mjs|js|py|bat|cmd)$/i.test(file)) {
    const codigo = sinComentarios(body);
    if (/(Remove-Item|Move-Item|DeleteFile|DeleteDirectory|shutil\.(move|rmtree)|os\.remove|fs\.(unlink|rm|rename)|\bmv\b|\brm\b)/i.test(codigo)
      && /(foreach|for +\(|for +[a-z_]+ +in |while|Get-ChildItem|find |glob|walk|readdir|listdir|iterdir|rglob|scandir)/i.test(codigo)
      && !/dry[-_ ]?run|dryRun|DRYRUN|WhatIf/i.test(body)) motivo += 'V4';
  }
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
3. Los PASOS de una HO son instruccion de planta. Sin documento fuente van TBD.
   PROHIBIDO redactarlos por analogia con otra pieza "parecida" o copiar los de
   otro producto: el proceso puede ser otro (core-prohibiciones §1).
4. FOTOS: solo de la pieza real, o de maquina/gesto donde NO SE RECONOZCA otra pieza.
   Si no hay foto, el recuadro va VACIO — nada de leyendas tipo "FOTO PENDIENTE"
   (Fak, 13/08: "si no hay imagenes en alguna hoja no pongas nada").
   Al duplicar una hoja como plantilla, BORRAR sus imagenes de contenido: se arrastran
   invisibles. Paso con la HO-986: la plantilla era un reproceso de costura y sus 9 fotos
   de agujas quedaron en las 8 hojas nuevas, incluida la de inyeccion de PU.
5. UNA HO ES PARA EL OPERARIO, NO PARA AUDITAR: sin "BORRADOR", sin "pendiente de
   validacion", sin "el Plan de Control dice X pero Y". Donde no hay dato va TBD y nada
   mas; el analisis va en el informe aparte. Estilo de la casa en el ciclo de control:
   Resp. = OP / OC / Insp.; **Registro: los unicos validos son los "Set up" (de control o
   de lanzamiento) — "RC" NO EXISTE** (aparece en HOs viejas, es arrastre; Fak 14/08).
   Si no hay registro asociado va "-", no se inventa un codigo. Frases cortas: las
   columnas son angostas y un texto largo se CORTA.
6. AL CERRAR: actualizar el listado maestro
   (3- LISTADO\\Listado hojas de proceso.xlsx) con la fila nueva en el bloque de
   su sector + la hoja oculta _CONTEXTO_CLAUDE con el proximo numero libre.
7. El .xlsx del SGC lo edito YO con Excel COM (regla modificada por Fak el 19/08/2026:
   "automaticemos eso asi podes hacerlo vos"). Trampas COM en la memoria
   excel_com_argumentos_posicionales; verificar lock ~$ antes y releer despues de guardar.`;
GUARDIANES['ho-numeracion-guard'] = (ctx, { env }) => {
  // Red de seguridad: si no se pudo parsear (o no hay nada que mirar), grep sobre el JSON crudo.
  let target = ctx.target.trim() ? ctx.target : ctx.raw;
  if (!target.trim()) return null;
  const match = /(hojas? de operacion|hoja de proceso|hojas de proceso|\bHO[- ][0-9]{2,3}\b)/i.test(target) || /I-IN-002\.4/i.test(target);
  if (!match) return null;
  return recordatorio(path.join(dirTmp(env), 'claude-ho-numeracion-guard.flag'), TEXTO_HO);
};

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
  const target = `${ctx.cmd6} ${ctx.fileL} ${ctx.body6}`;
  // 1) Tiene que oler a Outlook. 2) Tiene que haber un envio real (Display/Save/ReplyAll no
  // envian). 3) Si va por la via autorizada, pasa.
  if (!/Outlook\.Application|olMailItem|GetDefaultFolder|MailItem|CreateItem\(/i.test(target)) return null;
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
const ARB_LECTOR = /^\s*(grep|rg|cat|sed -n|head|tail|less|type|wc|git (log|show|diff|blame))\s/i;
const ARB_ENCADENA = /(\||;|&&)\s*(ba)?sh|python|powershell|pwsh|xargs|-exec|node\s/i;
const ARB_MATAR = /taskkill|stop-process|pkill|killall|[^a-z]kill\s|\.kill\(|os\.kill|closemainwindow|wmic[^|\n]*(delete|terminate|call)|shutdown\s*\//i;
const ARB_CERRAR = /WM_CLOSE|0x0010|0x10[^0-9a-f]|DestroyWindow|EndTask|SC_CLOSE|0xF060|pywinauto|pyautogui|sendkeys|%\{F4\}|alt.{0,3}f4|\.close\(\)/i;
GUARDIANES['arb-cerrar-guard'] = (ctx, { env }) => {
  // Red de seguridad: si el parseo fallo, miro el comando rescatado + el JSON crudo.
  let cmd = ctx.ok ? ctx.cmd : `${ctx.rescate.cmd}\n${ctx.raw}`;
  if (!cmd.trim()) return null;
  // 0. No estorbar al que audita o documenta este mismo tema: un comando de SOLO LECTURA no
  //    cierra nada. Pide DOS cosas: arranca con un lector Y no encadena a nada que ejecute
  //    (`cat script.sh | bash` arranca con cat y corre codigo arbitrario). Se ancla al inicio
  //    del comando ENTERO — el grep original miraba linea por linea, y una segunda linea que
  //    empezara con `grep` eximia a un `taskkill` de la primera.
  if (ARB_LECTOR.test(cmd) && !ARB_ENCADENA.test(cmd)) return null;
  // 0b. El CUERPO de un heredoc es CONTENIDO, no comando (un commit que documenta este
  //     guardian se autobloqueaba, 31/08). Solo si lo maneja algo que escribe o versiona:
  //     `python - <<PY` se come el cuerpo por stdin y ahi el heredoc ES codigo.
  if (/<</.test(cmd) && /^\s*(git|cat|tee|echo|printf)\s/im.test(cmd) && !/\|\s*((ba)?sh|python|powershell|pwsh|node)/i.test(cmd)) {
    cmd = sinCuerposHeredoc(cmd);
  }
  let motivo = '';
  // 1a. cerrar sesion / apagar: se lleva puesto el arb sin nombrarlo
  if (/(^|[;&|]\s*)(shutdown\s+\/|logoff|restart-computer|stop-computer)/im.test(cmd)) motivo = 'cerrar la sesion de Windows o apagar (se lleva puesto el arb)';
  // 1. matar el proceso del arb (lista canonica de verbos, no un regex parcial)
  if (ARB_MATAR.test(cmd)) {
    if (/produc/i.test(cmd)) motivo = 'matar el proceso del arb (produc.exe)';
    else {
      // por PID pelado: se RESUELVE contra el sistema — solo aca, que es raro
      const pids = [...new Set([...cmd.matchAll(/(\/pid[\s:=]+|os\.kill\(\s*|-id\s+)([0-9]{2,7})/gi)].map((m) => m[2]))];
      for (const p of pids) {
        const r = spawnSync('tasklist', ['/FI', `PID eq ${p}`], { encoding: 'utf8' });
        if (/produc/i.test(r.stdout || '')) { motivo = `matar el proceso del arb (PID ${p} es produc.exe)`; break; }
      }
    }
  }
  // 2. cerrar la VENTANA PRINCIPAL: `ProdWindow` es la CLASE (señal fuerte); por titulo se
  //    exige que NO nombre un `Maestro ...`, porque ahi el WM_CLOSE es el de descartar edicion.
  if (!motivo && ARB_CERRAR.test(cmd)) {
    if (/ProdWindow/.test(cmd)) motivo = 'cerrar la ventana principal del arb (clase ProdWindow)';
    else if (/Producci/i.test(cmd) && !/Maestro/i.test(cmd)) motivo = 'cerrar la ventana principal del arb (titulo Produccion)';
  }
  if (!motivo) return null;
  const ok = path.join(dirHome(env), '.claude', '.arb-cerrar-ok');
  if (fs.existsSync(ok)) {
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

NO BLOQUEADO, por si era lo que buscabas: cerrar 'Maestro de Insumos' o 'Maestro de
Relaciones' con WM_CLOSE (es el modo documentado de descartar una edicion sin grabar),
y 'python scripts/_arbVer.py reset', que cierra y REABRE la de Relaciones.`);
};

export const NOMBRES = Object.keys(GUARDIANES);

// ─────────────────────────────────────────────────────────────────────────── motor

/** Corre los guardianes pedidos. Una excepcion adentro de uno BLOQUEA con el error. */
export function correr(nombres, ctx, deps = {}) {
  const ahora = deps.ahora ?? Math.floor(Date.now() / 1000);
  const env = deps.env ?? process.env;
  const res = { bloqueos: [], avisos: [], recordatorios: [], supabase: false };
  for (const n of nombres) {
    const g = GUARDIANES[n];
    if (!g) continue;
    let v;
    try { v = g(ctx, { ahora, env }); } catch (e) {
      res.bloqueos.push({ guardian: n, texto: `[${n}] ERROR interno del guardian — se bloquea por seguridad (un guardian que no corre parece un guardian que aprobo):\n${e && e.stack || e}` });
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
 * Convierte el resultado en salida de hook. Los recordatorios pasan por su cooldown recien
 * aca, y solo si nada bloqueo: si la llamada no va a correr, el aviso se perderia y encima
 * quedaria consumida la hora.
 */
export function resolver(res, { ahora = Math.floor(Date.now() / 1000), marcar = true } = {}) {
  const err = res.avisos.map((a) => a.texto);
  if (res.bloqueos.length) {
    err.push(...res.bloqueos.map((b) => b.texto));
    return { exit: 2, stderr: `${err.join('\n')}\n`, stdout: '', contexto: '' };
  }
  const textos = [];
  const vistos = new Set();
  for (const r of res.recordatorios) {
    if (vistos.has(r.flag)) continue;
    vistos.add(r.flag);
    if (cooldownVigente(r.flag, ahora)) continue;
    if (marcar) marcarFlag(r.flag, ahora);
    textos.push(`${r.texto}\n(Si ya cumpliste, o no aplica a esta operacion, segui: esto es un recordatorio, no un bloqueo.)`);
  }
  const contexto = textos.join('\n\n');
  const stdout = contexto ? JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: contexto } }) : '';
  return { exit: 0, stderr: err.length ? `${err.join('\n')}\n` : '', stdout, contexto };
}

/** Todo junto: JSON crudo → { ctx, res, salida }. `nombres` pisa la matriz (modo --solo). */
export function evaluar(raw, { nombres, ahora, env, marcar } = {}) {
  const ctx = parsear(raw);
  const lista = nombres ?? matriz(ctx.tool);
  const res = correr(lista, ctx, { ahora, env });
  return { ctx, res, salida: resolver(res, { ahora, marcar }) };
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
