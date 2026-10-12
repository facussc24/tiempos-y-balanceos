// scripts/_h6Evidencia.mjs
/**
 * _h6Evidencia.mjs — que cambia relevarTranscript con H6 (plan P9 §6.1) contra un commit base, sobre registros reales.
 * Es la evidencia del commit: toda diferencia tiene que ser de H6 (orden canonico, miradas viejas de subagentes
 * afuera, miradas del turno que antes se desalojaban). Cualquier otra sale como INESPERADO y el exit es 1.
 *   node scripts/_h6Evidencia.mjs --base HEAD [--dir <carpeta>] [--max 50 | 0 = todos] [--json]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { relevarTranscript, REPO, MARGEN_MIRADA_MS } from './_lib/cierreGuard.mjs';
import { bytesDelRegistro } from './_lib/hooksTiempos.mjs';

const plano = (v) => (v instanceof Set ? [...v] : v instanceof Map ? [...v.entries()] : v);
const esObjeto = (v) => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Set) && !(v instanceof Map);
const comoLista = (v) => JSON.stringify(v.map((x) => JSON.stringify(x)).sort());

function comparar(a, b, prefijo, campos) {
  if (esObjeto(a) && esObjeto(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) comparar(a[k], b[k], prefijo ? `${prefijo}.${k}` : k, campos);
    return;
  }
  const pa = plano(a); const pb = plano(b);
  if (JSON.stringify(pa) === JSON.stringify(pb)) return;
  campos[prefijo] = Array.isArray(pa) && Array.isArray(pb) && comoLista(pa) === comoLista(pb) ? 'orden' : 'contenido';
}

/** Diferencias campo por campo. Las miradas se separan en lo que H6 explica y lo que no. */
export function diferencias(base = {}, nuevo = {}) {
  const campos = {};
  comparar(base, nuevo, '', campos);
  const corte = Date.parse(nuevo.turnoTs || base.turnoTs || '') - MARGEN_MIRADA_MS;
  const hay = Number.isFinite(corte);
  const clave = (m) => JSON.stringify([m.ts, m.txt, m.esRead]);
  const enA = new Set((base.miradas || []).map(clave));
  const enB = new Set((nuevo.miradas || []).map(clave));
  const soloNuevo = (nuevo.miradas || []).filter((m) => !enA.has(clave(m)));
  const soloBase = (base.miradas || []).filter((m) => !enB.has(clave(m)));
  const miradas = {
    recuperadas: soloNuevo.filter((m) => !hay || m.ts >= corte).length,   // las desalojaba el shift de 600
    descartadas: soloBase.filter((m) => hay && m.ts < corte).length,      // viejas de subagente: no decidian nada
    inesperadas: soloNuevo.filter((m) => hay && m.ts < corte).length + soloBase.filter((m) => !hay || m.ts >= corte).length,
  };
  const inesperado = Object.entries(campos).filter(([k, v]) => v === 'contenido' && k !== 'miradas').map(([k]) => k);
  if (miradas.inesperadas) inesperado.push('miradas');
  return { igual: !Object.keys(campos).length, campos, miradas, inesperado };
}

function textoFila(f) {
  if (f.igual) return 'igual';
  const orden = Object.entries(f.campos).filter(([, v]) => v === 'orden').map(([k]) => k);
  const p = [];
  if (orden.length) p.push(`orden: ${orden.join(', ')}`);
  if (f.miradas.recuperadas) p.push(`${f.miradas.recuperadas} miradas del turno recuperadas`);
  if (f.miradas.descartadas) p.push(`${f.miradas.descartadas} viejas de subagente afuera`);
  if (f.inesperado.length) p.push(`INESPERADO: ${f.inesperado.join(', ')}`);
  return p.join(' · ');
}

async function main(argv) {
  const arg = (n, def) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
  const ref = arg('--base', '');
  if (!/^[\w.~^/-]+$/.test(ref)) { console.error('Falta --base <commit> (el anterior a H6; antes de commitear: HEAD)'); return 1; }
  const dir = arg('--dir', path.join(os.homedir(), '.claude', 'projects', 'C--Dev-BarackMercosul'));
  const max = Number(arg('--max', '50'));
  let archivos = [];
  try { archivos = fs.readdirSync(dir).filter((f) => /\.jsonl$/i.test(f)).map((f) => path.join(dir, f)); } catch { /* abajo */ }
  if (!archivos.length) { console.error(`No hay registros en ${dir}`); return 1; }
  archivos = archivos.map((f) => ({ f, s: fs.statSync(f).size })).sort((a, b) => b.s - a.s).map((x) => x.f);
  if (max > 0) archivos = archivos.slice(0, max);
  // El oraculo es el fuente del commit base, no el codigo nuevo (plan §6.2). Va al lado del original: sus imports relativos resuelven.
  const fuente = execFileSync('git', ['show', `${ref}:scripts/_lib/cierreGuard.mjs`], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const tmp = path.join(REPO, 'scripts', '_lib', `.cierreGuard.base-${process.pid}.mjs`);
  fs.writeFileSync(tmp, fuente);
  const filas = [];
  try {
    const base = await import(pathToFileURL(tmp).href);
    for (const f of archivos) {
      const reg = bytesDelRegistro(f);
      const d = diferencias(await base.relevarTranscript(f), await relevarTranscript(f));
      filas.push({ archivo: path.basename(f), mb: reg.bytes / 1048576, subagentes: reg.subagentes, ...d });
    }
  } finally { try { fs.unlinkSync(tmp); } catch { /* si quedo, se borra a mano: empieza con punto */ } }
  const malos = filas.filter((f) => f.inesperado.length);
  if (argv.includes('--json')) { console.log(JSON.stringify(filas, null, 1)); return malos.length ? 1 : 0; }
  for (const f of filas) console.log(`${f.archivo.slice(0, 44).padEnd(44)} ${f.mb.toFixed(1).padStart(5)} MB ${String(f.subagentes).padStart(3)} sub  ${textoFila(f)}`);
  console.log(`\n${filas.length} registros · ${filas.filter((f) => f.igual).length} iguales · `
    + `${filas.filter((f) => f.miradas.recuperadas).length} con miradas del turno recuperadas (antes el chequeo 4 podia frenar de mas) · `
    + `${malos.length} con diferencias INESPERADAS`);
  return malos.length ? 1 : 0;
}

const esDirecto = Boolean(process.argv[1] && /_h6Evidencia\.mjs$/i.test(process.argv[1]));
if (esDirecto) main(process.argv.slice(2)).then((rc) => process.exit(rc), (e) => { console.error(e?.message || e); process.exit(1); });
