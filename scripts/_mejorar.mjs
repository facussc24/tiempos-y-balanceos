/**
 * El molde para «quiero mejorar X» (skill `mejorar`, viernes 23/10/2026). Siete pasos en orden fijo, con freno que
 * corre solo: no deja marcar el paso 5 (cambio chico) sin el 3 (qué ya existe) y el 4 (banco congelado), no deja
 * marcar el 6 (medir de nuevo) si el banco no sube o algo que pasaba deja de pasar, y no deja cerrar sin el 6.
 *
 *   node scripts/_mejorar.mjs --nuevo "<X, con las palabras de Fak>"            crea docs/mejoras/<fecha>-<x>/
 *   node scripts/_mejorar.mjs --carpeta <dir> --paso N --hecho --evidencia "..."  marca un paso (1..7)
 *   node scripts/_mejorar.mjs --carpeta <dir> --banco <congelado.json>           ata el banco congelado (paso 4)
 *   node scripts/_mejorar.mjs --carpeta <dir> --paso 6 --hecho --scores <nuevo.json>  compara contra el congelado
 *   node scripts/_mejorar.mjs --carpeta <dir> --cerrar                            exige el paso 6
 *   node scripts/_mejorar.mjs --carpeta <dir> --estado                            imprime la tabla
 * Sale con 0 (ok), 3 (freno: lo dice en una línea) o 2 (error de uso). Raíz por defecto: docs/mejoras (MEJORAR_RAIZ la cambia).
 */
import fs from 'node:fs';
import path from 'node:path';
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
  'Medir de nuevo: entra solo si el banco sube y nada que pasaba deja de pasar',
  'Preguntar solo lo de la lista «solo Fak» (PREGUNTAS_FAK.md)',
];
const ARCHIVOS = ['01_fallas.md', '02_huecos.md', '03_ya_hecho.md', '06_medicion.md', 'PREGUNTAS_FAK.md'];

const hoy = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 16);
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const leer = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
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

/** Compara un scores nuevo contra el congelado: {sube, regresion, detalle}. */
export function comparar(congelado, nuevo) {
  const c = congelado.resumen, n = nuevo.resumen;
  if (!c || !n) throw new Error('los dos scores necesitan el campo resumen (cazados, mutantes, bien_en_verde, bien)');
  const regresion = n.bien_en_verde < c.bien_en_verde || n.cazados < c.cazados;
  const sube = !regresion && (n.cazados > c.cazados || n.mutantes > c.mutantes && n.cazados - c.cazados === n.mutantes - c.mutantes && n.cazados > c.cazados);
  return { sube, regresion, detalle: `congelado ${c.cazados}/${c.mutantes} (BIEN ${c.bien_en_verde}/${c.bien}) → nuevo ${n.cazados}/${n.mutantes} (BIEN ${n.bien_en_verde}/${n.bien})` };
}

export function marcar(carpeta, n, evidencia, opciones = {}) {
  const e = leer(estadoDe(carpeta));
  const paso = e.pasos.find((p) => p.n === n);
  if (!paso) throw new Error(`paso ${n} no existe (1..7)`);
  if (!evidencia) throw new Error('un paso se marca con --evidencia "<qué se midió o escribió>"');
  const hecho = (k) => e.pasos.find((p) => p.n === k).hecho;
  if (n === 5 && !(hecho(3) && hecho(4))) freno('el paso 5 (cambio chico) no se marca sin el 3 (qué ya existe) y el 4 (banco congelado)');
  if (n === 4 && !e.banco?.congelado) freno('el paso 4 exige atar el banco congelado: --banco <congelado.json>');
  if (n === 6) {
    if (!hecho(5)) freno('el paso 6 (medir de nuevo) no se marca sin el 5 (el cambio)');
    if (!opciones.scores) freno('el paso 6 exige --scores <nuevo.json> para comparar contra el congelado');
    const r = comparar(leer(e.banco.congelado), leer(opciones.scores));
    if (r.regresion) freno(`algo que pasaba deja de pasar: ${r.detalle}. El cambio se saca.`);
    if (!r.sube) freno(`el banco no sube: ${r.detalle}. El cambio se saca (o se documenta por qué entra igual: PREGUNTAS_FAK)`);
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
  console.log(`MEJORAR · ${e.x} · creado ${e.creado}${e.cerrado ? ` · CERRADO ${e.cerrado}` : ''}${e.banco ? ` · banco ${e.banco.congelado}` : ''}`);
  for (const p of e.pasos) console.log(`  ${p.hecho ? '✓' : '·'} ${p.n}. ${p.nombre}${p.hecho ? ` — ${p.fecha}: ${p.evidencia}` : ''}`);
}

const esPrincipal = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) {
  try {
    if (tiene('--nuevo')) { const c = nuevo(arg('--nuevo')); console.log(`creado ${c}`); tabla(c); process.exit(0); }
    const carpeta = arg('--carpeta'); if (!carpeta) throw new Error('falta --carpeta <dir> (o --nuevo "<X>")');
    if (tiene('--banco')) { const e = leer(estadoDe(carpeta)); const b = path.resolve(arg('--banco')); if (!fs.existsSync(b)) throw new Error(`no existe ${b}`); e.banco = { congelado: b, atado: hoy() }; guardar(carpeta, e); console.log(`banco atado: ${b}`); }
    if (tiene('--paso') && tiene('--hecho')) { const p = marcar(carpeta, Number(arg('--paso')), arg('--evidencia'), { scores: arg('--scores') }); console.log(`paso ${p.n} hecho: ${p.evidencia}`); }
    if (tiene('--cerrar')) { cerrar(carpeta); console.log('cerrado'); }
    tabla(carpeta);
  } catch (err) { console.error(`error: ${err.message}`); process.exit(2); }
}
