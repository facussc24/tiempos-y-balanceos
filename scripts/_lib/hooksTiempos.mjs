/**
 * hooksTiempos.mjs — cuanto tarda el control de cierre (hook Stop `cierre-guard`) y en que se le va el tiempo.
 *
 * Por que existe (plan P9, commit C0: docs/PLAN_P9_P10_HOOKS_INCREMENTAL_2026-10-10.md §6.4): el cierre midio
 * p50 3 s, p90 18 s y un maximo de 234 s en un mes, y el plan para acelerarlo ataca UNA fase (releer el registro).
 * Un registro real mide 3 a 8 MB, que no explican esos tiempos: sin el tiempo de cada fase no se sabe si ese plan
 * ataca el 90 % del costo o el 10 %. Esto SOLO mide y anota: no cambia ninguna decision del cierre ni ningun tope.
 *
 * El registro: `<tmp>/claude-hooks-tiempos.jsonl`, un renglon JSON por evento, tres por corrida, unidos por `id`:
 *   {"ev":"inicio","hook":"cierre-guard","id":"<pid>.<us>","t":<epoch ms>}             lo escribe el .sh antes de node
 *   {"ev":"fases", "hook":…,"id":…,"t":…,"sesion":…,"modo":…,"arranque_ms":…,"total_ms":…,
 *    "fases":{"relevar":ms,"documentos":ms,"firma":ms,"pendientes":ms,"exports":ms,"tanda":ms,"resto":ms},
 *    "veces":{…},"bytes_registro":N,"bytes_leidos":N,"subagentes":N,"ok":true|false,"titulo":"…"}   lo escribe node
 *   {"ev":"fin","hook":…,"id":…,"t":…,"rc":0|2,"ms":<total del .sh>}                    lo escribe el .sh al volver node
 * Un `inicio` sin su `fin` es una corrida que la app corto por el tope (o que murio): es lo que deja ciego al cierre.
 *
 * Las fases (los nombres del plan entre parentesis cuando difieren):
 *   arranque    desde que arranca el .sh hasta que node tiene el pedido leido (bash + node + cargar el modulo)
 *   relevar     releer el registro de la sesion y los de sus subagentes (`relevarTranscript`)
 *   documentos  buscar en exports/ los documentos del turno para el chequeo de firma (`documentosDelTurno`)
 *   firma       el detector de firma de IA, en python (`correrDetectorFirma`)
 *   pendientes  (git) `git status` + el flag de Supabase + el peso y los bullets de LECCIONES (`relevarPendientes`)
 *   exports     el barrido de exports/ para el chequeo de entregables sin abrir (`exportsDelTurno`)
 *   tanda       las reglas de la tanda, que pueden releer el registro (`avisoParaCierre`)
 *   resto       lo que queda del total: los chequeos sobre el texto del mensaje
 * Una fase que no corrio en esa pasada (el cierre corta en el primer chequeo que frena) no figura.
 *
 * Si el registro no se puede escribir, no se dice nada y el cierre sigue igual: esto no puede romper un cierre.
 *
 *   node scripts/_hooksTiempos.mjs [--desde AAAA-MM-DD] [--hook cierre-guard] [--json]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

export const NOMBRE = 'claude-hooks-tiempos.jsonl';
/**
 * Donde vive el registro: el que le pasa el .sh (`CLAUDE_HOOKS_TIEMPOS`), o el temporal de la PC. Devuelve null
 * (no se anota nada) con `CLAUDE_HOOKS_TIEMPOS=off` y, si nadie dijo donde, adentro de una corrida de tests
 * (`VITEST`): una prueba que lanza el hook no es una corrida real y no puede caer en el registro de verdad (auditor
 * 10/10/2026: a 20 minutos de prendida la medicion, 15 de 23 corridas eran de tests y el lector concluia al reves).
 */
export function rutaRegistro(env = process.env) {
  const v = String(env.CLAUDE_HOOKS_TIEMPOS || '').trim();
  if (v.toLowerCase() === 'off') return null;
  if (v) return v;
  return env.VITEST ? null : path.join(os.tmpdir(), NOMBRE);
}
/** El registro de verdad de esta PC, para el lector (que no escribe): no depende de estar o no en un test. */
export const rutaRegistroReal = () => path.join(os.tmpdir(), NOMBRE);

/** Un renglon al registro. No tira nunca y no dice nada si falla. Sin ruta (medicion apagada) no hace nada. */
export function anotar(obj, { ruta = rutaRegistro() } = {}) {
  if (!ruta) return false;
  try { fs.appendFileSync(ruta, `${JSON.stringify(obj)}\n`, 'utf8'); return true; } catch { return false; }
}

/** ¿El registro de conversacion es el de una sesion real de Claude Code? (vive en ~/.claude/projects) */
export const esSesionReal = (transcriptPath) => /[\\/]\.claude[\\/]projects[\\/]/i.test(String(transcriptPath || ''));

/** El tamaño del registro de la sesion y de los de sus subagentes (lo que hoy relee el cierre en cada pasada). */
export function bytesDelRegistro(transcriptPath) {
  const out = { bytes: 0, subagentes: 0 };
  if (!transcriptPath) return out;
  try { out.bytes += fs.statSync(transcriptPath).size; } catch { return out; }
  try {
    const dir = path.join(String(transcriptPath).replace(/\.jsonl$/i, ''), 'subagents');
    for (const f of fs.readdirSync(dir)) {
      if (!/\.jsonl$/i.test(f)) continue;
      try { out.bytes += fs.statSync(path.join(dir, f)).size; out.subagentes++; } catch { /* se fue en el medio */ }
    }
  } catch { /* sin subagentes */ }
  return out;
}

/**
 * Un cronometro por corrida. `envolver(nombre, fn)` devuelve una funcion que hace lo mismo que `fn` (mismos
 * argumentos, mismo resultado, misma excepcion) y suma lo que tardo a la fase `nombre`; sirve para funciones
 * comunes y para las que devuelven una promesa. `medir(nombre, fn)` corre `fn()` una vez, cronometrado.
 */
export function crearCronometro({ ahora = () => performance.now() } = {}) {
  const fases = {}; const veces = {};
  const sumar = (nombre, t0) => { fases[nombre] = (fases[nombre] || 0) + (ahora() - t0); veces[nombre] = (veces[nombre] || 0) + 1; };
  const envolver = (nombre, fn) => (...args) => {
    const t0 = ahora();
    let r;
    try { r = fn(...args); } catch (e) { sumar(nombre, t0); throw e; }
    if (r && typeof r.then === 'function') return r.then((v) => { sumar(nombre, t0); return v; }, (e) => { sumar(nombre, t0); throw e; });
    sumar(nombre, t0);
    return r;
  };
  const medir = (nombre, fn) => envolver(nombre, fn)();
  const redondo = () => Object.fromEntries(Object.entries(fases).map(([k, v]) => [k, Math.round(v)]));
  return { envolver, medir, fases: redondo, veces: () => ({ ...veces }) };
}

/**
 * Corre `decidir(payload, deps)` del cierre con cada fase cronometrada y anota el renglon `fases`. Devuelve lo MISMO
 * que `decidir` (o tira lo mismo): quien llama no nota la diferencia. `depsReales` son las piezas del cierre
 * (`DEPS_REALES` de cierreGuard.mjs): se envuelven, no se cambian.
 */
export async function correrMedido({ decidir, depsReales, payload, hook = 'cierre-guard', env = process.env, t0 = performance.now(), ahoraMs = Date.now() } = {}) {
  // Todo lo que se arma ANTES de decidir va en un try: si el medidor falla aca, se decide sin medir (una sola vez).
  let crono = null; let deps = null; let base = null;
  try {
    crono = crearCronometro();
    const FASES = { fueraEnEsteTurno: 'relevar', firmaIA: 'firma', pendientes: 'pendientes', exportsDelTurno: 'exports', avisoTanda: 'tanda' };
    deps = { medir: crono.medir };
    // una pieza que no vino no se envuelve: `decidir` usa la suya, como siempre
    for (const [pieza, fase] of Object.entries(FASES)) if (typeof depsReales?.[pieza] === 'function') deps[pieza] = crono.envolver(fase, depsReales[pieza]);
    const inicioSh = Number(env.CLAUDE_HOOKS_TIEMPOS_T0);            // epoch ms en que arranco el .sh
    base = {
      ev: 'fases', hook, id: String(env.CLAUDE_HOOKS_TIEMPOS_ID || `node.${process.pid}.${ahoraMs}`), t: ahoraMs,
      sesion: String(payload?.session_id || '').slice(0, 8), modo: String(payload?.permission_mode || ''),
      real: esSesionReal(payload?.transcript_path),               // false: lo lanzo una prueba, no una sesion
      segundo_stop: Boolean(payload?.stop_hook_active),
      arranque_ms: Number.isFinite(inicioSh) && inicioSh > 0 ? Math.max(0, ahoraMs - inicioSh) : null,
    };
  } catch { return decidir(payload); }
  const cerrar = (extra) => {
    try {
      const total = performance.now() - t0;
      const fases = crono.fases();
      const medido = Object.values(fases).reduce((a, b) => a + b, 0);
      const reg = bytesDelRegistro(payload?.transcript_path);
      anotar({ ...base, total_ms: Math.round(total), fases: { ...fases, resto: Math.max(0, Math.round(total - medido)) }, veces: crono.veces(),
        // hoy el cierre relee el registro entero en cada pasada: leidos = registro. Cuando lea de a tramos (P9), leidos baja.
        bytes_registro: reg.bytes, bytes_leidos: crono.veces().relevar ? reg.bytes : 0, subagentes: reg.subagentes, ...extra }, { ruta: rutaRegistro(env) });
    } catch { /* medir no puede romper el cierre */ }
  };
  try {
    const r = await decidir(payload, deps);
    cerrar({ ok: Boolean(r && r.ok), titulo: r && r.titulo ? String(r.titulo).slice(0, 90) : (r && r.motivo) || '' });
    return r;
  } catch (e) {
    cerrar({ ok: null, titulo: `ERROR: ${String((e && e.message) || e).slice(0, 80)}` });
    throw e;
  }
}

// ---------------------------------------------------------------------------------------------
// El lector
// ---------------------------------------------------------------------------------------------

/** El percentil `p` (0 a 1) de una lista de numeros, por posicion (el que usa el plan: p50, p90). */
export function percentil(valores, p) {
  const v = valores.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.max(0, Math.ceil(p * v.length) - 1))];
}

/** Lee el registro. Un renglon roto se saltea y se cuenta. */
export function leerRegistro(ruta = rutaRegistro()) {
  let texto = '';
  try { texto = fs.readFileSync(ruta, 'utf8'); } catch { return { eventos: [], rotos: 0, existe: false }; }
  const eventos = []; let rotos = 0;
  for (const l of texto.split('\n')) {
    if (!l.trim()) continue;
    try { const j = JSON.parse(l); if (j && typeof j === 'object' && j.ev && j.id) eventos.push(j); else rotos++; } catch { rotos++; }
  }
  return { eventos, rotos, existe: true };
}

/** Cuanto se espera el `fin` de una corrida antes de darla por matada (el tope de un hook es de 60 s por defecto). */
export const GRACIA_MATADO_MS = 5 * 60000;

/**
 * El resumen: por fase p50 / p90 / maximo y cuantas corridas la tuvieron; las corridas completas, las matadas
 * (un `inicio` sin `fin` pasado el tiempo de gracia) y la fase que domina (la que mas tiempo suma).
 * @param eventos  los de `leerRegistro`
 * @param desde    epoch ms: solo las corridas que arrancaron de ahi en mas (null = todas)
 */
export function resumir(eventos, { desde = null, hook = 'cierre-guard', ahora = Date.now(), conPruebas = false } = {}) {
  const corridas = new Map();
  for (const e of eventos) {
    if (hook && e.hook !== hook) continue;
    const c = corridas.get(e.id) || {};
    if (e.ev === 'inicio') c.inicio = e; else if (e.ev === 'fin') c.fin = e; else if (e.ev === 'fases') c.fases = e;
    corridas.set(e.id, c);
  }
  const todas = [...corridas.values()].filter((c) => {
    if (!conPruebas && c.fases && c.fases.real === false) return false;      // la lanzo una prueba, no una sesion
    const t = (c.inicio || c.fases || c.fin || {}).t;
    return desde == null || (Number.isFinite(t) && t >= desde);
  });
  const maximo = (v) => v.reduce((a, b) => (b > a ? b : a), -Infinity);   // sin `Math.max(...v)`: con cientos de miles de corridas desborda
  const conInicio = todas.filter((c) => c.inicio);
  const completas = conInicio.filter((c) => c.fin);
  const matadas = conInicio.filter((c) => !c.fin && ahora - c.inicio.t > GRACIA_MATADO_MS);
  const enCurso = conInicio.filter((c) => !c.fin && ahora - c.inicio.t <= GRACIA_MATADO_MS);
  const stats = (vals) => ({ n: vals.length, p50: percentil(vals, 0.5), p90: percentil(vals, 0.9), max: vals.length ? maximo(vals) : null, suma: vals.reduce((a, b) => a + b, 0) });
  const conFases = todas.filter((c) => c.fases);
  const nombres = new Set(['arranque']);
  for (const c of conFases) for (const k of Object.keys(c.fases.fases || {})) nombres.add(k);
  const fases = {};
  for (const n of nombres) {
    const vals = conFases.map((c) => (n === 'arranque' ? c.fases.arranque_ms : (c.fases.fases || {})[n])).filter((x) => Number.isFinite(x));
    if (vals.length) fases[n] = stats(vals);
  }
  const sumaTotal = Object.values(fases).reduce((a, f) => a + f.suma, 0);
  const domina = Object.entries(fases).sort((a, b) => b[1].suma - a[1].suma)[0] || null;
  return {
    corridas: conInicio.length, completas: completas.length, matadas: matadas.length, en_curso: enCurso.length, sin_fases: completas.filter((c) => !c.fases).length,
    total: stats(completas.map((c) => c.fin.ms).filter((x) => Number.isFinite(x))),
    frenadas: completas.filter((c) => c.fin.rc === 2).length,
    fases,
    domina: domina ? { fase: domina[0], parte: sumaTotal > 0 ? domina[1].suma / sumaTotal : 0 } : null,
    registro: stats(conFases.map((c) => c.fases.bytes_registro).filter((x) => Number.isFinite(x) && x > 0)),
    matadas_lista: matadas.map((c) => ({ id: c.inicio.id, t: c.inicio.t, fases: c.fases ? c.fases.fases : null })),
    primera: todas.map((c) => (c.inicio || c.fases || c.fin).t).filter(Number.isFinite).reduce((a, b) => (a == null || b < a ? b : a), null),
  };
}

const seg = (ms) => (ms == null ? '—' : ms >= 10000 ? `${(ms / 1000).toFixed(0)} s` : ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);
const fecha = (ms) => { const d = new Date(ms); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`; };

/** El resumen en texto, para leer de una pasada. */
export function textoResumen(r, { hook = 'cierre-guard' } = {}) {
  if (!r.corridas && !Object.keys(r.fases).length) return `Todavía no hay corridas de ${hook} en el registro.`;
  const L = [];
  L.push(`${hook}: ${r.corridas} corridas${r.primera ? ` desde el ${fecha(r.primera)}` : ''} · ${r.completas} completas · ${r.matadas} MATADAS (inicio sin fin)${r.en_curso ? ` · ${r.en_curso} en curso` : ''} · ${r.frenadas} frenaron el cierre`);
  L.push(`Total por corrida: p50 ${seg(r.total.p50)} · p90 ${seg(r.total.p90)} · máximo ${seg(r.total.max)}`);
  if (r.registro.n) L.push(`Registro releído por corrida: p50 ${(r.registro.p50 / 1048576).toFixed(1)} MB · máximo ${(r.registro.max / 1048576).toFixed(1)} MB`);
  L.push('');
  L.push('fase         corridas    p50      p90      máximo   parte del tiempo');
  const suma = Object.values(r.fases).reduce((a, f) => a + f.suma, 0) || 1;
  for (const [n, f] of Object.entries(r.fases).sort((a, b) => b[1].suma - a[1].suma)) {
    L.push(`${n.padEnd(12)} ${String(f.n).padStart(8)}  ${seg(f.p50).padStart(7)}  ${seg(f.p90).padStart(7)}  ${seg(f.max).padStart(7)}   ${(100 * f.suma / suma).toFixed(0).padStart(3)} %`);
  }
  L.push('');
  if (r.domina) L.push(`Domina: ${r.domina.fase} (${(100 * r.domina.parte).toFixed(0)} % del tiempo medido).${r.domina.fase === 'relevar' ? '' : ' OJO: no es «relevar»: el plan P9 (leer el registro de a tramos) no ataca la fase que más pesa.'}`);
  if (r.sin_fases) L.push(`${r.sin_fases} corrida(s) completas sin el renglón de fases (el cierre salió antes de medir, o el medidor no cargó).`);
  for (const m of r.matadas_lista.slice(0, 5)) L.push(`  matada: ${fecha(m.t)} · ${m.fases ? `llegó a medir ${JSON.stringify(m.fases)}` : 'node no llegó a anotar las fases'}`);
  return L.join('\n');
}
