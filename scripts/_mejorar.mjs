/**
 * El molde para «quiero mejorar X» (skill `mejorar`, viernes 23/10/2026). Siete pasos en orden fijo, con freno que
 * corre solo: no deja marcar el paso 5 (cambio chico) sin el 3 (qué ya existe) y el 4 (banco congelado), no deja
 * marcar el 6 (medir de nuevo) si el banco no sube sobre los casos CONGELADOS o algo que pasaba deja de pasar (los
 * casos nuevos no cuentan: Fak 23/10), y no deja cerrar sin el 6.
 *
 *   node scripts/_mejorar.mjs --nuevo "<X, con las palabras de Fak>"            crea docs/mejoras/<fecha>-<x>/
 *   node scripts/_mejorar.mjs --carpeta <dir> --paso N --hecho --evidencia "..."  marca un paso (1..7)
 *   node scripts/_mejorar.mjs --carpeta <dir> --banco <scores/congelado.json>    ata el banco congelado (antes del 4)
 *   node scripts/_mejorar.mjs --carpeta <dir> --paso 6 --hecho --scores <nuevo.json>  compara contra el congelado
 *   node scripts/_mejorar.mjs --carpeta <dir> --cerrar                            exige los pasos 1 a 6
 *   node scripts/_mejorar.mjs --carpeta <dir> --estado                            imprime la tabla
 * Sale con 0 (ok), 3 (freno: lo dice en una línea) o 2 (error de uso). Raíz por defecto: docs/mejoras (MEJORAR_RAIZ la cambia).
 * Los scores son los que escribe evals/banco3d/correr.py (campos `resumen` y `ejercicios[id].piezas[archivo]`).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = process.env.MEJORAR_RAIZ || path.join(AQUI, '..', 'docs', 'mejoras');
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const tiene = (k) => argv.includes(k);

export const PASOS = [
  'Qué me falló (mensajes de Fak y LECCIONES, con conteo)',
  'Qué no sé (huecos escritos antes de buscar)',
  'Qué ya existe hecho y probado (oficial > plugin oficial > repo con estrellas y tests)',
  'Banco con pieza BIEN y pieza MAL, congelado («hoy caza X de N»)',
  'Cambio chico como freno que corre solo (nunca regla de texto), con test',
  'Medir de nuevo: entra solo si el banco congelado sube y nada que pasaba deja de pasar',
  'Preguntar solo lo de la lista «solo Fak» (PREGUNTAS_FAK.md)',
];
const ARCHIVOS = ['01_fallas.md', '02_huecos.md', '03_ya_hecho.md', '06_medicion.md', 'PREGUNTAS_FAK.md'];

const hoy = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 16);
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const leer = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
const estadoDe = (carpeta) => path.join(carpeta, 'estado.json');
const guardar = (carpeta, e) => fs.writeFileSync(estadoDe(carpeta), JSON.stringify(e, null, 2) + '\n');
const freno = (msg) => { console.log(`FRENO: ${msg}`); process.exit(3); };

export function nuevo(x, raiz = RAIZ) {
  if (!x) throw new Error('--nuevo exige el texto de X');
  const carpeta = path.join(raiz, `${hoy().slice(0, 10)}-${slug(x)}`);
  if (fs.existsSync(carpeta)) throw new Error(`ya existe ${carpeta}`);
  fs.mkdirSync(carpeta, { recursive: true });
  const e = { x, creado: hoy(), pasos: PASOS.map((nombre, i) => ({ n: i + 1, nombre, hecho: false, evidencia: '', fecha: '' })), banco: null };
  guardar(carpeta, e);
  for (const a of ARCHIVOS) fs.writeFileSync(path.join(carpeta, a), `# ${a.replace(/\.md$/, '')} — ${x}\n\n(se completa en el paso que corresponde; ver estado.json)\n`);
  return carpeta;
}

/** Un scores vale si lo escribió correr.py: trae `ejercicios` con piezas y un `resumen` coherente. */
export function validarScores(s, que) {
  if (!s || typeof s !== 'object' || !s.ejercicios || typeof s.ejercicios !== 'object' || !s.resumen) throw new Error(`${que}: no es un scores de evals/banco3d/correr.py (faltan ejercicios o resumen)`);
  const piezas = Object.values(s.ejercicios).flatMap((e) => Object.values(e.piezas || {}));
  if (!piezas.length) throw new Error(`${que}: sin piezas`);
  const r = s.resumen;
  if (!(Number.isInteger(r.cazados) && Number.isInteger(r.mutantes) && r.cazados <= r.mutantes)) throw new Error(`${que}: resumen incoherente (cazados ${r.cazados} de ${r.mutantes})`);
  return s;
}

const cazada = (p) => Object.values(p.controles || {}).some((c) => c.obtenido === 'rojo');
const enVerde = (p) => { const cs = Object.values(p.controles || {}); return cs.length > 0 && cs.every((c) => c.obtenido === 'verde'); };

/** Compara pieza por pieza SOLO sobre las piezas del congelado: {sube, regresion, detalle}. Los casos nuevos no cuentan. */
export function comparar(congelado, nuevo) {
  validarScores(congelado, 'congelado'); validarScores(nuevo, 'scores nuevo');
  let c0 = 0, c1 = 0, b0 = 0, b1 = 0; const perdidos = [], bienRotos = [], ausentes = [];
  for (const [ej, e] of Object.entries(congelado.ejercicios)) {
    for (const [archivo, p] of Object.entries(e.piezas || {})) {
      if (p.esperado !== 'rojo' && p.esperado !== 'verde') continue;
      const q = nuevo.ejercicios[ej]?.piezas?.[archivo];
      if (!q) { ausentes.push(`${ej}/${archivo}`); continue; }
      if (p.esperado === 'rojo') { const a = cazada(p), b = cazada(q); c0 += a; c1 += b; if (a && !b) perdidos.push(`${ej}/${archivo}`); }
      else { const a = enVerde(p), b = enVerde(q); b0 += a; b1 += b; if (a && !b) bienRotos.push(`${ej}/${archivo}`); }
    }
  }
  const regresion = perdidos.length > 0 || bienRotos.length > 0 || ausentes.length > 0;
  const sube = !regresion && c1 > c0;
  const detalle = `congelados: cazados ${c0} → ${c1}, BIEN en verde ${b0} → ${b1}`
    + (perdidos.length ? `; dejan de cazarse: ${perdidos.join(', ')}` : '') + (bienRotos.length ? `; BIEN que pasan a rojo: ${bienRotos.join(', ')}` : '')
    + (ausentes.length ? `; faltan en el nuevo: ${ausentes.join(', ')}` : '') + ' (los casos nuevos no cuentan)';
  return { sube, regresion, detalle };
}

export function atarBanco(carpeta, ruta) {
  const e = leer(estadoDe(carpeta));
  const b = path.resolve(ruta);
  if (path.basename(b) !== 'congelado.json') freno('el banco se ata a un scores/congelado.json (lo escribe correr.py --congelar), no a otro archivo');
  if (!fs.existsSync(b)) throw new Error(`no existe ${b}`);
  validarScores(leer(b), 'congelado');
  if (e.pasos.find((p) => p.n === 4).hecho) freno('el banco no se cambia después del paso 4: si cambió, el paso 4 se vuelve a hacer');
  e.banco = { congelado: b, sha: sha(b), atado: hoy() };
  guardar(carpeta, e); return e.banco;
}

export function marcar(carpeta, n, evidencia, opciones = {}) {
  const e = leer(estadoDe(carpeta));
  const paso = e.pasos.find((p) => p.n === n);
  if (!paso) throw new Error(`paso ${n} no existe (1..7)`);
  if (!evidencia) throw new Error('un paso se marca con --evidencia "<qué se midió o escribió>"');
  const hecho = (k) => e.pasos.find((p) => p.n === k).hecho;
  if (n === 4 && !e.banco?.congelado) freno('el paso 4 exige atar el banco congelado: --banco <scores/congelado.json>');
  if (n === 5 && !(hecho(3) && hecho(4))) freno('el paso 5 (cambio chico) no se marca sin el 3 (qué ya existe) y el 4 (banco congelado)');
  if (n === 6) {
    if (!hecho(5)) freno('el paso 6 (medir de nuevo) no se marca sin el 5 (el cambio)');
    if (!opciones.scores) freno('el paso 6 exige --scores <nuevo.json> (el que escribe correr.py) para comparar contra el congelado');
    if (sha(e.banco.congelado) !== e.banco.sha) freno(`el congelado cambió después del paso 4 (sha ${e.banco.sha} → ${sha(e.banco.congelado)}): el paso 4 se vuelve a hacer`);
    const r = comparar(leer(e.banco.congelado), leer(opciones.scores));
    if (r.regresion) freno(`algo que pasaba deja de pasar: ${r.detalle}. El cambio se saca.`);
    if (!r.sube) freno(`el banco congelado no sube: ${r.detalle}. El cambio se saca, o se documenta por qué entra igual en PREGUNTAS_FAK (lo decide Fak)`);
    evidencia = `${evidencia} · ${r.detalle}`;
  }
  Object.assign(paso, { hecho: true, evidencia, fecha: hoy() });
  guardar(carpeta, e);
  return paso;
}

export function cerrar(carpeta) {
  const e = leer(estadoDe(carpeta));
  const faltan = e.pasos.filter((p) => !p.hecho && p.n !== 7).map((p) => p.n);
  if (faltan.length) freno(`no se cierra: faltan los pasos ${faltan.join(', ')} (el 6 es la medición; sin ella la mejora no existe)`);
  e.cerrado = hoy(); guardar(carpeta, e); return e;
}

function tabla(carpeta) {
  const e = leer(estadoDe(carpeta));
  console.log(`MEJORAR · ${e.x} · creado ${e.creado}${e.cerrado ? ` · CERRADO ${e.cerrado}` : ''}${e.banco ? ` · banco ${e.banco.congelado} (${e.banco.sha})` : ''}`);
  for (const p of e.pasos) console.log(`  ${p.hecho ? '✓' : '·'} ${p.n}. ${p.nombre}${p.hecho ? ` — ${p.fecha}: ${p.evidencia}` : ''}`);
}

const esPrincipal = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) {
  try {
    if (tiene('--nuevo')) { const c = nuevo(arg('--nuevo')); console.log(`creado ${c}`); tabla(c); process.exit(0); }
    const carpeta = arg('--carpeta'); if (!carpeta) throw new Error('falta --carpeta <dir> (o --nuevo "<X>")');
    if (tiene('--banco')) { const b = atarBanco(carpeta, arg('--banco')); console.log(`banco atado: ${b.congelado} (${b.sha})`); }
    if (tiene('--paso') && tiene('--hecho')) { const p = marcar(carpeta, Number(arg('--paso')), arg('--evidencia'), { scores: arg('--scores') }); console.log(`paso ${p.n} hecho: ${p.evidencia}`); }
    if (tiene('--cerrar')) { cerrar(carpeta); console.log('cerrado'); }
    tabla(carpeta);
  } catch (err) { console.error(`error: ${err.message}`); process.exit(2); }
}
