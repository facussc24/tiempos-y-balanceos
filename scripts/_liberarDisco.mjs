/**
 * _liberarDisco.mjs — libera espacio en C: borrando SOLO artefactos que genero YO
 * y que se pueden volver a generar. Nunca toca material de Fak.
 *
 *   node scripts/_liberarDisco.mjs              # dry-run: lista y cuenta, no borra nada
 *   node scripts/_liberarDisco.mjs --aplicar    # borra
 *
 * Que borra (y por que se puede):
 *   - backups/<timestamp>/  snapshots viejos de Supabase. Se conservan los 12 mas
 *     nuevos + el primero de cada dia. El resto se regenera con `_backup.mjs`
 *     contra Supabase live, que es la fuente de verdad.
 *   - .video/<work|seg|zoom|win|cuadros|niveles|v2>/  intermedios del render del
 *     institucional (10/09). Los masters viven en OneDrive `5- VIDEOS Y FOTOS`
 *     y el entregable final esta en `.video/final`.
 *
 * Lo que NO toca nunca: `in/`, `entrega/`, `.sgc-cache`, `.venv-*`, `docs/`,
 * cualquier cosa fuera del repo, y cualquier archivo de Fak
 * (regla feedback_material_de_fak_no_se_borra_va_a_la_nube).
 */
import { readdirSync, statSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = 'C:\\Dev\\BarackMercosul';
const APLICAR = process.argv.includes('--aplicar');
const CONSERVAR_NUEVOS = 12;

function pesoDe(ruta) {
  let total = 0;
  const pila = [ruta];
  while (pila.length) {
    const p = pila.pop();
    let entradas;
    try { entradas = readdirSync(p, { withFileTypes: true }); } catch { continue; }
    for (const e of entradas) {
      const hijo = join(p, e.name);
      if (e.isDirectory()) pila.push(hijo);
      else { try { total += statSync(hijo).size; } catch { /* ignorar */ } }
    }
  }
  return total;
}

const gb = (bytes) => (bytes / 1024 ** 3).toFixed(2);

/** Snapshots de backup: conservar los N mas nuevos + el primero de cada dia. */
function planBackups() {
  const dir = join(RAIZ, 'backups');
  if (!existsSync(dir)) return [];
  const snaps = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(e.name))
    .map((e) => e.name)
    .sort();
  const conservar = new Set(snaps.slice(-CONSERVAR_NUEVOS));
  const vistos = new Set();
  for (const n of snaps) {
    const dia = n.slice(0, 10);
    if (!vistos.has(dia)) { vistos.add(dia); conservar.add(n); }
  }
  return snaps.filter((n) => !conservar.has(n)).map((n) => join(dir, n));
}

/** Intermedios del render de video. El final y la biblioteca se quedan. */
function planVideo() {
  const base = join(RAIZ, '.video');
  if (!existsSync(base)) return [];
  return ['work', 'seg', 'zoom', 'win', 'cuadros', 'niveles', 'v2']
    .map((n) => join(base, n))
    .filter((p) => existsSync(p));
}

const grupos = [
  { nombre: 'snapshots de backup viejos', rutas: planBackups() },
  { nombre: 'intermedios de render de video', rutas: planVideo() },
];

let totalBytes = 0;
let totalRutas = 0;
for (const g of grupos) {
  const peso = g.rutas.reduce((acc, r) => acc + pesoDe(r), 0);
  totalBytes += peso;
  totalRutas += g.rutas.length;
  console.log(`${g.nombre.padEnd(34)} ${String(g.rutas.length).padStart(4)} rutas  ${gb(peso).padStart(7)} GB`);
}
console.log(`${'TOTAL'.padEnd(34)} ${String(totalRutas).padStart(4)} rutas  ${gb(totalBytes).padStart(7)} GB`);

if (!APLICAR) {
  console.log('\nDRY-RUN: no se borro nada. Correr con --aplicar para ejecutar.');
  process.exit(0);
}

let borradas = 0;
for (const g of grupos) {
  for (const r of g.rutas) {
    try { rmSync(r, { recursive: true, force: true }); borradas++; }
    catch (e) { console.error(`  no se pudo borrar ${r}: ${e.message}`); }
  }
}
console.log(`\nBorradas ${borradas} de ${totalRutas} rutas (${gb(totalBytes)} GB).`);
