/**
 * _tokens.mjs — contabilidad de tokens y de conducta sobre los transcripts de Claude Code.
 *
 * Prometido el 04/09/2026 (Ola 1 del plan de mejoras) y escrito el 10/09: es el "token accounting"
 * que la guia de prompting de Fable 5.1 pone como prerrequisito de cualquier limpieza de prompts.
 * Mide ANTES y DESPUES de tocar CLAUDE.md, LECCIONES, reglas o skills, sobre los mismos
 * transcripts, para que el efecto se vea en numeros y no en impresiones.
 *
 * Uso:
 *   node scripts/_tokens.mjs                      # ultimos 14 dias
 *   node scripts/_tokens.mjs --desde 2026-09-02   # desde una fecha (por mtime del transcript)
 *   node scripts/_tokens.mjs --ventana 400000     # umbral de "turno grande" (default: el auto-compact)
 *   node scripts/_tokens.mjs --json               # salida cruda para guardar
 *
 * Que mide (una fila por metrica, con la definicion al lado para que el numero se pueda repetir):
 *   contexto 1er turno   input + cache_creation + cache_read del PRIMER mensaje del asistente de cada
 *                        sesion (p50 / min / max). Es lo que pesa el system prompt + CLAUDE.md + reglas
 *                        + memorias + descripciones de skills antes de trabajar.
 *   compactaciones       lineas con isCompactSummary o subtype compact_boundary.
 *   turnos > ventana     mensajes del asistente cuyo contexto total supera la ventana.
 *   AskUserQuestion      tool_use con ese nombre (CLAUDE.md: no preguntar, hacer).
 *   cierres con permiso  ultimo texto del asistente antes de un mensaje real de Fak que pide permiso
 *                        segun cierreGuard.evaluarPermiso (la misma lista que corta el hook Stop).
 *   limites de uso       mensajes de Fak o del sistema que hablan del limite de uso.
 *   arranques en ingles  textos del asistente cuyo primer parrafo es ingles (heuristica de palabras
 *                        funcion), y cuantos vienen justo despues de una compactacion.
 *   effort               tally modelo+effort por mensaje del asistente (dice si effortLevel se aplica).
 * Solo lee: no toca ningun archivo.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { evaluarPermiso } from './_lib/cierreGuard.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(AQUI, '..');
const args = process.argv.slice(2);
const valor = (k, def) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const JSON_OUT = args.includes('--json');
const VENTANA = Number(valor('--ventana', process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW || 400000));
const desdeTexto = valor('--desde', null);
const DESDE = desdeTexto ? new Date(`${desdeTexto}T00:00:00`) : new Date(Date.now() - 14 * 86400e3);

// Carpeta de transcripts de ESTE repo: ~/.claude/projects/<ruta con - en vez de : y \>/
const slug = REPO.replace(/[:\\/]/g, '-');
const DIR = valor('--dir', path.join(os.homedir(), '.claude', 'projects', slug));

const ING = /\b(the|and|is|are|with|this|that|I'll|Let me|I've|Here's|Now|Looking|Checking|Running|Done|Fixed)\b/g;
const ESP = /\b(el|la|los|las|que|de|con|para|una|un|ya|esto|esta|dale|listo|sigo|ahora)\b/gi;
function esIngles(texto) {
  const p = String(texto).replace(/```[\s\S]*?```/g, ' ').trim().slice(0, 300);
  if (p.length < 20) return false;
  const i = (p.match(ING) || []).length;
  const e = (p.match(ESP) || []).length;
  return i >= 3 && i > e * 2;
}
const LIMITE = /(usage limit|l[ií]mite de uso|hit your limit|rate limit|out of (usage|credits)|weekly limit|se restableci[oó]|reached your)/i;

function textoDe(msg) {
  const c = msg?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.filter((b) => b.type === 'text').map((b) => b.text || '').join('\n');
  return '';
}
function esFakReal(obj) {
  if (obj.isMeta || obj.isCompactSummary) return false;
  const t = textoDe(obj.message);
  return t.trim().length > 0 && !/^\s*(<system-reminder>|\[SYSTEM NOTIFICATION|<task-notification>|<local-command|<command-)/.test(t);
}

async function medirSesion(archivo) {
  const s = {
    archivo: path.basename(archivo), contexto1: null, turnos: 0, grandes: 0, compactaciones: 0, ask: 0,
    cierresPermiso: 0, limites: 0, ingles: 0, inglesPostCompact: 0, effort: {}, mensajesFak: 0,
  };
  let ultimoTextoAsistente = null;
  let recienCompacto = false;
  const rl = readline.createInterface({ input: fs.createReadStream(archivo, 'utf8'), crlfDelay: Infinity });
  for await (const linea of rl) {
    let o;
    try { o = JSON.parse(linea); } catch { continue; }
    if (o.isCompactSummary || o.subtype === 'compact_boundary') { s.compactaciones++; recienCompacto = true; ultimoTextoAsistente = null; continue; }
    if (o.type === 'user') {
      const t = textoDe(o.message);
      if (LIMITE.test(t)) s.limites++;
      if (esFakReal(o)) {
        s.mensajesFak++;
        if (ultimoTextoAsistente && evaluarPermiso(ultimoTextoAsistente).bloquea) s.cierresPermiso++;
        ultimoTextoAsistente = null;
      }
      continue;
    }
    if (o.type === 'system' && LIMITE.test(String(o.content || o.message || ''))) { s.limites++; continue; }
    if (o.type !== 'assistant') continue;
    const u = o.message?.usage;
    if (u) {
      const total = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
      if (s.contexto1 === null && total > 0) s.contexto1 = total;   // el primer turno con contexto real
      s.turnos++;
      if (total > VENTANA) s.grandes++;
    }
    const clave = `${o.message?.model || '?'} ${o.effort || o.message?.effort || ''}`.trim();
    if (u) s.effort[clave] = (s.effort[clave] || 0) + 1;
    for (const b of o.message?.content || []) {
      if (b.type === 'tool_use' && b.name === 'AskUserQuestion') s.ask++;
    }
    const t = textoDe(o.message);
    if (t.trim()) {
      ultimoTextoAsistente = t;
      if (esIngles(t)) { s.ingles++; if (recienCompacto) s.inglesPostCompact++; }
      recienCompacto = false;
    }
  }
  return s;
}

const p50 = (xs) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) / 2)] : null; };
const k = (n) => (n === null ? '—' : `${Math.round(n / 1000)}k`);

async function main() {
  if (!fs.existsSync(DIR)) { console.error(`No existe ${DIR}`); process.exit(1); }
  const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(DIR, f))
    .filter((f) => fs.statSync(f).mtime >= DESDE);
  const sesiones = [];
  for (const f of archivos) { try { sesiones.push(await medirSesion(f)); } catch { /* transcript roto: se salta */ } }
  const conTrabajo = sesiones.filter((s) => s.turnos > 0);
  const suma = (kk) => conTrabajo.reduce((a, s) => a + (s[kk] || 0), 0);
  const ctx = conTrabajo.map((s) => s.contexto1).filter((x) => x !== null);
  const effort = {};
  for (const s of conTrabajo) for (const [c, n] of Object.entries(s.effort)) effort[c] = (effort[c] || 0) + n;
  const turnos = suma('turnos');
  const resumen = {
    desde: DESDE.toISOString().slice(0, 10), dir: DIR, ventana: VENTANA,
    sesiones: conTrabajo.length, turnos, mensajesFak: suma('mensajesFak'),
    contexto1: { p50: p50(ctx), min: ctx.length ? Math.min(...ctx) : null, max: ctx.length ? Math.max(...ctx) : null },
    compactaciones: suma('compactaciones'), turnosGrandes: suma('grandes'),
    pctTurnosGrandes: turnos ? +(100 * suma('grandes') / turnos).toFixed(1) : 0,
    askUserQuestion: suma('ask'), cierresPermiso: suma('cierresPermiso'), limites: suma('limites'),
    ingles: suma('ingles'), inglesPostCompact: suma('inglesPostCompact'), effort,
  };
  if (JSON_OUT) { console.log(JSON.stringify({ resumen, sesiones: conTrabajo }, null, 2)); return; }
  console.log(`Transcripts desde ${resumen.desde} en ${DIR}\n`);
  const filas = [
    ['sesiones con trabajo / turnos del modelo / mensajes de Fak', `${resumen.sesiones} / ${turnos} / ${resumen.mensajesFak}`],
    ['contexto del 1er turno  p50 / min / max', `${k(resumen.contexto1.p50)} / ${k(resumen.contexto1.min)} / ${k(resumen.contexto1.max)}`],
    ['compactaciones', String(resumen.compactaciones)],
    [`turnos con contexto > ${k(VENTANA)}`, `${resumen.turnosGrandes} (${resumen.pctTurnosGrandes} %)`],
    ['AskUserQuestion', String(resumen.askUserQuestion)],
    ['cierres que piden permiso (lista del hook Stop)', String(resumen.cierresPermiso)],
    ['mensajes sobre el limite de uso', String(resumen.limites)],
    ['arranques en ingles / de esos, justo post-compactacion', `${resumen.ingles} / ${resumen.inglesPostCompact}`],
  ];
  const ancho = Math.max(...filas.map((f) => f[0].length));
  for (const [a, b] of filas) console.log(`  ${a.padEnd(ancho)}  ${b}`);
  console.log('\n  effort por mensaje del asistente:');
  for (const [c, n] of Object.entries(effort).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(6)}  ${c}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
