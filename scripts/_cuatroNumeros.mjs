/**
 * _cuatroNumeros.mjs — la línea de base y la hoja semanal de los 4 números del plan del sistema (§6).
 *
 * Fak, 15/10/2026: «¿cómo sé en una semana si el plan funcionó?». El plan contesta con cuatro números que solo
 * pueden bajar (trinquete) y uno que decide él. Este script los mide SIEMPRE de la misma forma, leyendo los
 * registros de las sesiones (`~/.claude/projects/C--Dev-BarackMercosul*\*.jsonl`), para que el viernes 23/10 se
 * compare contra el 16/10 con el mismo comando. Tanda 0 (línea de base) y tanda 9 (la hoja de los viernes).
 *
 *   node scripts/_cuatroNumeros.mjs --desde 2026-10-09 --hasta 2026-10-16 [--cupo "0 %"] [--json] [--filas <archivo>]
 *
 * Qué mide (y qué NO):
 *  1. Reentregas: los avisos del correccion-guard (`scripts/_lib/correccionGuard.mjs --medir`) sobre los mensajes
 *     de Fak y las entregas escritas en exports/ de cada sesión. «Sesiones con reentrega ≥ 3» = sesiones con 3 o
 *     más avisos (cortos o largos) en la ventana. Lo que no ve: una devolución dicha por WhatsApp o en persona.
 *  2. «Propongo: …»: cuántos mensajes del asistente traen el renglón, sobre cuántos cierres de turno hubo
 *     (un cierre = un mensaje del asistente seguido por un mensaje de Fak). Cuántas propuestas tomó Fak NO se
 *     mide solo: la primera semana lo valida él.
 *  3. «Te dije / otra vez / se olvida» en los mensajes de Fak (lista `REPETICION`, abajo). Es un conteo de
 *     palabras: una cita textual de LECCIONES o un «otra vez» inocente también cuentan; se lee como tendencia.
 *  4. Frenos de guardianes: cuántas veces un hook PreToolUse bloqueó una herramienta (el resultado dice
 *     «BLOQUEADO» o «hook error»). Cuáles fueron FALSOS no lo decide un script: al 15/10 eran 51 de 436 en 30 días
 *     (`20-informes\casa_guardianes_frenos.md`); la clasificación se repite a mano con `clasificar2.mjs`.
 *  5. Cupo semanal al viernes: lo lee la sesión con `get_usage` y lo pasa con --cupo; acá solo se anota.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { entregasDeLinea, claveDe } from './_lib/correccionGuard.mjs';
import { reentregasPorCarpeta, hallazgosRespondidos } from './_lib/ppm.mjs';


const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const PROYECTOS = path.join(os.homedir(), '.claude', 'projects');

const REPETICION = /\b(te dije|te lo dije|otra vez|de nuevo|se olvida|no record[aá]s|ya te (lo )?dije|siempre lo mismo|300 veces)\b/i;
const FRENO = /BLOQUEADO|hook error|PreToolUse:\w+ hook/;

const arg = (n, def) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : def; };
const hoy = new Date().toISOString().slice(0, 10);
const desde = arg('--desde', new Date(Date.now() - 7 * 86400e3).toISOString().slice(0, 10));
const hasta = arg('--hasta', hoy);
const cupo = arg('--cupo', 'sin medir (pasalo con --cupo)');

function textoDe(m) {
  const c = m?.content;
  if (typeof c === 'string') return c;
  if (!Array.isArray(c)) return '';
  return c.filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
}
function esDeFak(o) {
  if (o.type !== 'user' || o.isMeta || o.isCompactSummary) return false;
  const c = o.message?.content;
  if (Array.isArray(c) && c.some((b) => b?.type === 'tool_result')) return false;
  const t = textoDe(o.message).trim();
  if (!t) return false;
  if (/^\s*<(system-reminder|command-name|local-command|side-sessions-event|ci-monitor-event|task-notification)/.test(t)) return false;
  if (/^\[ENCARGO E\d/.test(t)) return false;   // el encargo de otra sesión no lo escribió Fak
  return true;
}
function entregasDe(o) {
  const out = [];
  for (const b of o.message?.content || []) {
    if (b?.type !== 'tool_use') continue;
    const inp = b.input || {};
    const ruta = inp.file_path || inp.command || '';
    const m = String(ruta).match(/exports[\\/][^\s"'`]+/g);
    if (m) out.push(...m);
  }
  return out;
}

const archivos = [];
for (const d of fs.existsSync(PROYECTOS) ? fs.readdirSync(PROYECTOS) : []) {
  if (!d.startsWith('C--Dev-BarackMercosul')) continue;
  const carpeta = path.join(PROYECTOS, d);
  for (const f of fs.readdirSync(carpeta)) if (f.endsWith('.jsonl')) archivos.push(path.join(carpeta, f));
}

const filasMedir = [];           // para correccionGuard --medir
const carpetasPorSesion = new Map(); // PPM v0 columna A: ses -> Map(carpeta -> Set(turnos de Fak))
const porSesion = new Map();     // ses -> {avisosEstimados}
let cierres = 0, propongo = 0, repeticiones = 0, frenos = 0, mensajesFak = 0, sesiones = new Set();
const ejemplosRep = [];
for (const f of archivos) {
  const ses = path.basename(f, '.jsonl');
  let ultimoAsistente = null;
  let turno = 0; const carpetas = new Map(); carpetasPorSesion.set(ses, carpetas);
  let lineas;
  try { lineas = fs.readFileSync(f, 'utf8').split('\n'); } catch { continue; }
  for (const l of lineas) {
    if (!l) continue;
    let o; try { o = JSON.parse(l); } catch { continue; }
    const ts = String(o.timestamp || '').slice(0, 10);
    if (!ts || ts < desde || ts > hasta) continue;
    sesiones.add(ses);
    if (o.type === 'assistant') {
      for (const a of entregasDeLinea(l)) { const k = claveDe(a); if (!k) continue; if (!carpetas.has(k)) carpetas.set(k, new Set()); carpetas.get(k).add(turno); }
      const t = textoDe(o.message);
      if (/(^|\n)\s*\**Propongo\**\s*:/i.test(t)) propongo++;
      const e = entregasDe(o);
      if (e.length) filasMedir.push({ ses, e, ts: o.timestamp });
      ultimoAsistente = o;
      continue;
    }
    if (o.type === 'user') {
      const c = o.message?.content;
      if (Array.isArray(c)) for (const b of c) {
        if (b?.type === 'tool_result') {
          const tx = typeof b.content === 'string' ? b.content : (Array.isArray(b.content) ? b.content.map((x) => x?.text || '').join('') : '');
          if (FRENO.test(tx)) frenos++;
        }
      }
      if (esDeFak(o)) {
        const t = textoDe(o.message);
        mensajesFak++; turno++;
        if (ultimoAsistente) { cierres++; ultimoAsistente = null; }
        filasMedir.push({ ses, t, ts: o.timestamp });
        if (REPETICION.test(t)) { repeticiones++; if (ejemplosRep.length < 6) ejemplosRep.push(`[${ses.slice(0, 8)} ${ts}] ${t.replace(/\s+/g, ' ').slice(0, 120)}`); }
      }
    }
  }
}

// 1. reentregas, con el mismo medidor del correccion-guard
let reentregas = 'sin medir';
const tmp = path.join(os.tmpdir(), `cuatro-numeros-${Date.now()}.jsonl`);
try {
  fs.writeFileSync(tmp, filasMedir.map((x) => JSON.stringify(x)).join('\n'));
  // --filas <archivo> (tanda 9, pieza 8): deja las filas (con su fecha) para correr el D7 a mano:
  // node scripts/_lib/correccionGuard.mjs --medir <archivo> --despues <fecha de la graduacion>
  const dFilas = arg('--filas', null); if (dFilas) fs.copyFileSync(tmp, dFilas);
  const r = spawnSync(process.execPath, [path.join(AQUI, '_lib', 'correccionGuard.mjs'), '--medir', tmp, '--muestra'], { encoding: 'utf8', cwd: RAIZ });
  const salida = (r.stdout || '') + (r.stderr || '');
  const porSes = new Map();
  for (const m of salida.matchAll(/^\s+\[([^\]]+)\] (LARGO|corto)/gm)) porSes.set(m[1], (porSes.get(m[1]) || 0) + 1);
  const conTres = [...porSes.values()].filter((n) => n >= 3).length;
  const resumen = salida.split('\n').slice(0, 2).join(' · ');
  reentregas = `${resumen} · sesiones con 3 o más avisos: ${conTres}`;
} catch (e) { reentregas = `no se pudo medir (${e.message})`; }
finally { try { fs.unlinkSync(tmp); } catch { /* nada */ } }

// PPM v0 (tanda 9, pieza 10): las dos columnas nuevas.
const porCarpeta = reentregasPorCarpeta(carpetasPorSesion);
let auditor = { informes: 0, emitidos: 0, respondidos: 0, arreglados: 0 };
try {
  const dirAud = path.join(RAIZ, 'docs', 'auditorias');
  auditor = hallazgosRespondidos(fs.readdirSync(dirAud).filter((f) => f.endsWith('.md')).map((f) => fs.readFileSync(path.join(dirAud, f), 'utf8')));
} catch { /* sin carpeta: queda en cero y se dice */ }

const hoja = {
  ventana: { desde, hasta, sesiones: sesiones.size, mensajesFak },
  '1_reentregas': reentregas,
  '1b_reentregas_por_carpeta': { metodo: 'el del 15 de 54 (01/10): SendUserFile por carpeta, una por turno de Fak; reentrega = una carpeta en 3 turnos o mas', sesiones_con_entregas: porCarpeta.conEntregas, sesiones_con_reentrega_3_o_mas: porCarpeta.conTres },
  '6_hallazgos_auditor': { ...auditor, nota: 'de docs/auditorias/ con etiquetas Importante/Nit/Preexistente (desde la tanda 9); aceptado = arreglado' },
  '2_propongo': { cierres, con_propongo: propongo, porcentaje: cierres ? Math.round((propongo / cierres) * 1000) / 10 : null, tomadas_por_fak: 'lo valida Fak' },
  '3_te_dije': { conteo: repeticiones, ejemplos: ejemplosRep },
  '4_frenos': { total: frenos, falsos: 'sin clasificar (al 15/10: 51 falsos de 436 en 30 días; se repite con clasificar2.mjs)' },
  '5_cupo_semanal': cupo,
};
if (process.argv.includes('--json')) { console.log(JSON.stringify(hoja, null, 2)); }
else {
  console.log(`LOS 4 NÚMEROS · ventana ${desde} a ${hasta} · ${sesiones.size} sesiones · ${mensajesFak} mensajes de Fak`);
  console.log(`1. Entregas devueltas (correccion-guard): ${reentregas}`);
  console.log(`1b. Reentregas por carpeta (el metodo del «15 de 54» del 01/10): ${porCarpeta.conTres} de ${porCarpeta.conEntregas} sesiones con entregas`);
  console.log(`2. Cierres con «Propongo: …»: ${propongo} de ${cierres} cierres (${hoja['2_propongo'].porcentaje ?? '-'} %) · tomadas por Fak: lo valida él`);
  console.log(`3. «Te dije / otra vez / se olvida» en mensajes de Fak: ${repeticiones}`);
  for (const e of ejemplosRep) console.log(`     ${e}`);
  console.log(`4. Frenos de guardianes: ${frenos} en la ventana · falsos: ${hoja['4_frenos'].falsos}`);
  console.log(`5. Cupo semanal al viernes: ${cupo}`);
  console.log(`6. Hallazgos del auditor (docs/auditorias con etiquetas): ${auditor.arreglados} arreglados de ${auditor.emitidos} emitidos · ${auditor.respondidos} con respuesta · ${auditor.informes} informe(s) con etiquetas`);
}
