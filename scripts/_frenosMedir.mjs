// scripts/_frenosMedir.mjs
/**
 * _frenosMedir.mjs — la prueba de la tanda 3 (guardianes que frenan de mas) y la medicion mensual del plan (§6, numero 4).
 *
 * POR QUE: el informe de CATA del 15/10/2026 (`casa_guardianes_frenos.md`) etiqueto los 436 frenos reales de 30 dias como
 * verdadero (V), falso (F) o sin determinar (SD). Aflojar un guardian se demuestra con esos mismos comandos: los F tienen
 * que dejar de frenar, los V tienen que seguir frenando y los demas no tienen que cambiar. Este script pasa cada freno por
 * DOS versiones de `scripts/_lib/guardianes.mjs` (la BASE, p. ej. la de main, y la NUEVA, la de este checkout) y compara
 * el resultado del guardian que lo habia frenado. Es diferencial: no compara contra "lo que paso ese dia" (desde entonces
 * entraron P14, P15, HOY-16, HOY-28 y la tanda 1.6), sino version contra version sobre el mismo comando.
 *
 * NO EJECUTA NADA: llama a `evaluar()` de cada modulo, que solo mira el texto. Corre con un HOME y un TEMP de prueba
 * (los permisos de un solo uso reales ni se leen ni se gastan: `escapes: false`), sin COMPUTERNAME (la regla 4 de
 * video-maquina mira el disco de la PC) y con la hora fija. Lo que depende del estado de la PC queda dicho como tal:
 * push-guard mira dist/ y los commits sin subir; mail-guard, el registro de borradores del repo.
 * La carpeta de prueba queda en el TEMP del sistema (vacia: nada la escribe con marcar:false y escapes:false).
 *
 * Los datos NO van al repo (traen mensajes de Fak y salidas de herramientas): se leen de la carpeta del informe en la nube
 * de Ingenieria (`Claude Fak\viernes-17-plan-sistema\20-informes\scripts\frenos\`, `clasif2.json` + `frenos_bruto4.jsonl`).
 *
 *   node scripts/_frenosMedir.mjs --base <ruta a guardianes.mjs> [--nuevo <ruta>] [--datos <carpeta>] [--json <salida>] [--casos]
 *   (--nuevo por defecto: el guardianes.mjs de este checkout; --casos lista cada freno que cambio)
 *   Sale con 0 si midio, 2 si falta un archivo o un argumento.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buscarNube } from './_lib/nubeRutas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const DATOS_POR_DEFECTO = path.join(buscarNube(), 'viernes-17-plan-sistema', '20-informes', 'scripts', 'frenos');
// Los guardianes que viven en guardianes.mjs. Los otros frenos del informe son de hooks aparte (coordinador, agentes,
// pregunta), de otro producto (el plugin de las areas) o de la app: esta tanda no los toca y aca no se pueden repetir.
const HERRAMIENTAS = new Set(['Bash', 'PowerShell', 'Write', 'Edit']);

/** Une las etiquetas de CATA con el comando completo de cada freno (por `tool_use_id`). */
export function unirFrenos(clasif, bruto) {
  const porId = new Map();
  for (const b of bruto) if (b && b.id && !porId.has(b.id)) porId.set(b.id, b);
  return clasif.map((c) => ({ ...c, bruto: porId.get(c.id) || null }));
}

/**
 * La carpeta de trabajo de la sesion, sacada del nombre de su carpeta de registros (`C--Dev-BarackMercosul` es
 * `C:/Dev/BarackMercosul`). En vivo el despachador la recibe en el campo `cwd`, y con ella un borrado de una ruta
 * relativa (`tmp/x`) se sabe donde cae; el registro de CATA no la guardo. Un worktree lleva guiones en su nombre: se
 * arma la ruta de `.claude/worktrees/` de ese repo. Lo que no se reconoce queda sin carpeta (como un payload sin `cwd`).
 */
export function cwdDeCarpeta(carpeta) {
  const c = String(carpeta ?? '');
  const wt = c.match(/^C--(Dev-BarackMercosul|ClaudeBarack)--claude-worktrees-(.+)$/);
  if (wt) return `C:/${wt[1].replace('Dev-', 'Dev/')}/.claude/worktrees/${wt[2]}`;
  const exactas = { 'C--Dev-BarackMercosul': 'C:/Dev/BarackMercosul', 'C--ClaudeBarack': 'C:/ClaudeBarack', 'C--Dev': 'C:/Dev', 'C--Users-FacundoS-PC': 'C:/Users/FacundoS-PC' };
  return exactas[c] ?? '';
}

/** El JSON que el despachador recibiria por ese freno, o null si no es una herramienta de los guardianes. */
export function payloadDe(f, nombresGuardianes) {
  const b = f.bruto;
  if (!b || !HERRAMIENTAS.has(b.tool) || !nombresGuardianes.includes(f.guard)) return null;
  const tool_input = b.tool === 'Bash' || b.tool === 'PowerShell'
    ? { command: String(b.cmd ?? '') }
    : b.tool === 'Write' ? { file_path: String(b.file ?? ''), content: String(b.contentHead ?? '') }
      : { file_path: String(b.file ?? ''), old_string: '', new_string: String(b.contentHead ?? '') };
  const cwd = cwdDeCarpeta(b.carpeta);
  return JSON.stringify({ tool_name: b.tool, tool_input, session_id: 'frenos-medir', ...(cwd ? { cwd } : {}) });
}

/** Que guardianes frenan ese payload con el modulo `g` (sin ejecutar nada, sin gastar permisos). */
export function frenosDe(g, raw, env, ahora) {
  const { res } = g.evaluar(raw, { env, ahora, marcar: false, escapes: false });
  return [...new Set(res.bloqueos.map((b) => b.guardian))];
}

/** Clasifica cada freno con las dos versiones. `cambio`: 'afloja' (el guardian dejo de frenar), 'aprieta' o ''. */
export function medir({ frenos, base, nuevo, env, ahora }) {
  const filas = [];
  for (const f of frenos) {
    const raw = payloadDe(f, base.NOMBRES);
    if (!raw) { filas.push({ ...f, medible: false }); continue; }
    const fb = frenosDe(base, raw, env, ahora);
    const fn = frenosDe(nuevo, raw, env, ahora);
    const antes = fb.includes(f.guard), despues = fn.includes(f.guard);
    filas.push({ ...f, medible: true, antes, despues, otrosDespues: fn.filter((x) => x !== f.guard), cambio: antes === despues ? '' : despues ? 'aprieta' : 'afloja' });
  }
  return filas;
}

/** Tabla por guardian y etiqueta: cuantos frenaban con la base, cuantos con la nueva. */
export function resumir(filas) {
  const t = new Map();
  for (const x of filas) {
    const k = x.guard;
    if (!t.has(k)) t.set(k, { guard: k, n: 0, medibles: 0, V: { n: 0, base: 0, nuevo: 0 }, F: { n: 0, base: 0, nuevo: 0 }, SD: { n: 0, base: 0, nuevo: 0 } });
    const r = t.get(k);
    r.n++;
    const e = r[x.e] || (r[x.e] = { n: 0, base: 0, nuevo: 0 });
    e.n++;
    if (!x.medible) continue;
    r.medibles++;
    if (x.antes) e.base++;
    if (x.despues) e.nuevo++;
  }
  return [...t.values()].sort((a, b) => b.n - a.n);
}

export function totales(filas, filtro = () => true) {
  const s = { V: { n: 0, med: 0, base: 0, nuevo: 0 }, F: { n: 0, med: 0, base: 0, nuevo: 0 }, SD: { n: 0, med: 0, base: 0, nuevo: 0 } };
  for (const x of filas.filter(filtro)) {
    const e = s[x.e];
    e.n++;
    if (!x.medible) continue;
    e.med++;
    if (x.antes) e.base++;
    if (x.despues) e.nuevo++;
  }
  return s;
}

const leerJsonl = (p) => fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

async function main() {
  const args = process.argv.slice(2);
  const valor = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const baseRuta = valor('--base');
  const nuevoRuta = valor('--nuevo') || path.join(AQUI, '_lib', 'guardianes.mjs');
  const datos = valor('--datos') || DATOS_POR_DEFECTO;
  if (!baseRuta) { console.error('Falta --base <ruta a guardianes.mjs> (la version contra la que se compara, p. ej. la de main).'); process.exit(2); }
  const clasifRuta = path.join(datos, 'clasif2.json'), brutoRuta = path.join(datos, 'frenos_bruto4.jsonl');
  for (const p of [baseRuta, nuevoRuta, clasifRuta, brutoRuta]) if (!fs.existsSync(p)) { console.error(`No existe: ${p}`); process.exit(2); }

  const [base, nuevo] = await Promise.all([import(pathToFileURL(path.resolve(baseRuta)).href), import(pathToFileURL(path.resolve(nuevoRuta)).href)]);
  const frenos = unirFrenos(JSON.parse(fs.readFileSync(clasifRuta, 'utf8')), leerJsonl(brutoRuta));
  // HOME y TEMP de prueba: sin permisos de un solo uso, sin marcas de recordatorio, sin la marca del cruce de videos.
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'frenos-medir-'));
  fs.mkdirSync(path.join(sandbox, '.claude'), { recursive: true });
  const env = { HOME: sandbox, TMPDIR: sandbox, PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, CLAUDE_PROJECT_DIR: path.resolve(AQUI, '..') };
  const ahora = Math.floor(Date.parse('2026-10-16T12:00:00Z') / 1000);
  const filas = medir({ frenos, base, nuevo, env, ahora });

  const sinSI = (x) => x.guard !== 'script-inline-guard';
  const tSin = totales(filas, sinSI), tSI = totales(filas, (x) => !sinSI(x));
  const linea = (nom, t) => `${nom.padEnd(34)} V ${t.V.n} (medibles ${t.V.med}: frenan ${t.V.base} -> ${t.V.nuevo}) · F ${t.F.n} (medibles ${t.F.med}: frenan ${t.F.base} -> ${t.F.nuevo}) · SD ${t.SD.n} (medibles ${t.SD.med}: frenan ${t.SD.base} -> ${t.SD.nuevo})`;
  console.log(`Frenos: ${filas.length} (base ${baseRuta} -> nuevo ${nuevoRuta})`);
  console.log(linea('Sin script-inline (263 del informe)', tSin));
  console.log(linea('script-inline-guard (173)', tSI));
  console.log('\nPor guardian (frenan con la base -> con la nueva; "-" = no se puede repetir aca: otro hook, otro producto o la app):');
  for (const r of resumir(filas)) {
    const c = (e) => (r.medibles ? `${e.n}: ${e.base}->${e.nuevo}` : `${e.n}: -`);
    console.log(`  ${r.guard.padEnd(44)} ${String(r.n).padStart(3)} · V ${c(r.V)} · F ${c(r.F)} · SD ${c(r.SD)}`);
  }
  const cambiaron = filas.filter((x) => x.cambio);
  const raros = cambiaron.filter((x) => (x.e === 'V' && x.cambio === 'afloja') || (x.e !== 'V' && x.cambio === 'aprieta') || (x.e === 'SD' && x.cambio));
  console.log(`\nCambiaron: ${cambiaron.length} (aflojan ${cambiaron.filter((x) => x.cambio === 'afloja').length}, aprietan ${cambiaron.filter((x) => x.cambio === 'aprieta').length}). Para mirar uno por uno: --casos`);
  console.log(`Cambios que hay que mirar (un V que deja de frenar, o un F/SD que cambia de resultado): ${raros.length}`);
  if (args.includes('--casos')) {
    for (const x of cambiaron) console.log(`  [${x.e}] ${x.cambio.padEnd(7)} ${x.guard} ${x.ts} ${x.id} :: ${String(x.bruto?.cmd || x.bruto?.file || '').replace(/\s+/g, ' ').slice(0, 150)}${x.otrosDespues.length ? `  (sigue frenando por: ${x.otrosDespues.join(', ')})` : ''}`);
  }
  const json = valor('--json');
  if (json) fs.writeFileSync(json, JSON.stringify({ base: baseRuta, nuevo: nuevoRuta, totales: { sinScriptInline: tSin, scriptInline: tSI }, porGuardian: resumir(filas), filas: filas.map(({ bruto, ...x }) => ({ ...x, cmd: String(bruto?.cmd || bruto?.file || '').slice(0, 300) })) }, null, 1));
}

if (process.argv[1] && /_frenosMedir\.mjs$/.test(process.argv[1].replace(/\\/g, '/'))) {
  main().catch((e) => { console.error(e && e.stack || e); process.exit(2); });
}
