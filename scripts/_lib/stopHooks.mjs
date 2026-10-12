/**
 * stopHooks.mjs — el cierre del turno en UN node (cola P10, plan §2): cierre-guard y despues hora-guard.
 *
 * Lee el pedido una vez y corre las dos piezas, LAS DOS siempre: ninguna corta a la otra, cada una decide sola con
 * stop_hook_active, como hoy. El codigo de salida es el mas alto de los dos (2 = el turno sigue) y los mensajes se
 * concatenan al stderr, en ese orden. Una pieza que tira deja pasar (lo que ya hacia su .sh suelto) pero deja un renglon
 * en <tmp>/claude-stop-hooks.log, que antes no existia (plan §6.3: el `.catch(() => process.exit(0))` no dejaba rastro).
 * dev-server-guard no esta: se saca en el cableado (P11, si de Fak 09/10). Se arranca con `--correr` (ver promptHooks.mjs).
 * Contrato de pieza: `correrStop(payload) -> {rc: 0|2, stderr} | {ok: boolean, stderr} | 0|2`.
 * Tests: stopHooks.test.mjs (dobles; ROJO exit 2, VERDE exit 0), stopHooks.gate.test.mjs (las piezas reales).
 *
 *   printf '%s' "$JSON" | node scripts/_lib/stopHooks.mjs --correr   # exit 0 o 2
 */
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Nada de la casa se importa de forma ESTATICA (auditor, 11/10/2026, T1): con `hooksTiempos.mjs` o `hookComun.mjs`
// rotos este archivo no cargaba, el .sh salia con 1 y el turno terminaba sin que frenaran ni el cierre ni la hora (el
// cierre-guard suelto si frenaba: su medidor se importa adentro de un try). Si el medidor no carga, no se anota; si la
// libreria comun no carga, valen las versiones minimas de abajo. Las dos piezas se cargan una por una, cada una en su try.
let anotarCrudo = null;
try { ({ anotar: anotarCrudo } = await import('./hooksTiempos.mjs')); } catch { /* sin medidor: se sigue sin anotar */ }
// El try de arriba cubre el import, no la funcion que trae (auditor, R12): si el modulo carga sin `anotar`, o si
// `anotar` tira, el error salia desde adentro de un catch y el proceso moria con 1 antes de que decidiera la hora.
const anotar = (...args) => { try { if (typeof anotarCrudo === 'function') anotarCrudo(...args); } catch { /* anotar nunca frena ni rompe */ } };
let comun = {};
try { comun = await import('./hookComun.mjs'); } catch { /* sin la libreria comun: lo minimo, aca abajo */ }
const esPrograma = comun.esPrograma ?? ((url, argv1 = process.argv[1]) => {
  try { return path.resolve(String(argv1 || '')).toLowerCase() === fileURLToPath(url).toLowerCase(); } catch { return false; }
});
const leerStdin = comun.leerStdin ?? ((stream = process.stdin) => new Promise((resolve) => {
  let s = ''; stream.setEncoding('utf8');
  stream.on('data', (d) => { s += d; }); stream.on('end', () => resolve(s)); stream.on('error', () => resolve(s));
}));
const parsearPayload = comun.parsearPayload ?? ((s) => { try { const p = JSON.parse(s); if (p && typeof p === 'object') return p; } catch { /* no era JSON */ } return {}; });
const cargarPiezas = comun.cargarPiezas ?? (async (tabla, { avisar = () => {}, marca = '[HOOKS]' } = {}) => {
  const piezas = [];
  for (const p of tabla) {
    try {
      const fn = (await import(new URL(p.modulo, import.meta.url).href))?.[p.exportacion];
      if (typeof fn !== 'function') throw new Error(`no exporta ${p.exportacion}`);
      piezas.push({ nombre: p.nombre, fn });
    } catch (e) { avisar(`${marca} pieza ${p.nombre} apagada: ${String(e?.message || e).slice(0, 120)}\n`); }
  }
  return piezas;
});

export const MARCA = '[STOP-HOOKS]';
/** Donde queda lo que falla adentro (una pieza que tira o que no carga). Adentro de vitest no se escribe: una prueba no es una corrida (leccion de hooksTiempos, 10/10/2026). */
export const RUTA_LOG = process.env.VITEST ? null : path.join(os.tmpdir(), 'claude-stop-hooks.log');
export const PIEZAS_REALES = [
  { nombre: 'cierre-guard', modulo: './cierreGuard.mjs', exportacion: 'correrStop' },
  { nombre: 'hora-guard', modulo: './horaGuard.mjs', exportacion: 'correrStop' },
];

/** Lo que devuelve una pieza, como {rc, stderr}. Para un Stop solo existen 0 y 2; cualquier otra cosa es 0 (deja pasar). */
export function normalizar(r) {
  if (typeof r === 'number') return { rc: r === 2 ? 2 : 0, stderr: '' };
  if (!r || typeof r !== 'object') return { rc: 0, stderr: '' };
  const rc = Number.isInteger(r.rc) ? (r.rc === 2 ? 2 : 0) : (r.ok === false ? 2 : 0);
  return { rc, stderr: String(r.stderr ?? '').trim() };
}

/** Corre las piezas en orden (todas) y junta: rc = el mas alto, stderr = los mensajes concatenados. */
export async function correr(payload, piezas, { registrar = (o) => anotar(o, { ruta: RUTA_LOG }) } = {}) {
  let rc = 0; const textos = [];
  for (const p of piezas) {
    let r;
    try { r = normalizar(await p.fn(payload)); }
    catch (e) {
      // deja pasar, como su .sh de antes; el log queda para el chequeo diario
      registrar({ t: Date.now(), sesion: String(payload?.session_id || '').slice(0, 8), pieza: p.nombre, error: String(e?.message || e).slice(0, 160) });
      continue;
    }
    if (r.rc > rc) rc = r.rc;
    if (r.stderr) textos.push(r.stderr);
  }
  return { rc, stderr: textos.join('\n\n') };
}

if (esPrograma(import.meta.url) && process.argv.includes('--correr')) {
  const payload = parsearPayload(await leerStdin());
  // una pieza que no carga va al log, no al stderr: con exit 0 nadie lo leeria y con exit 2 ensuciaria el aviso de la otra
  const piezas = await cargarPiezas(PIEZAS_REALES, { marca: MARCA, avisar: (m) => anotar({ t: Date.now(), aviso: m.trim() }, { ruta: RUTA_LOG }) });
  const { rc, stderr } = await correr(payload, piezas);
  if (stderr) process.stderr.write(`${stderr}\n`, () => process.exit(rc)); else process.exit(rc);
}
