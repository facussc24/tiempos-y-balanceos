/**
 * _materialAfuera.mjs — fotos y videos que estan FUERA de la biblioteca (`5- VIDEOS Y FOTOS`), carpeta por carpeta.
 * Solo lee. No copia, no mueve, no abre los archivos (un zip de OneDrive se bajaria entero al abrirlo).
 *
 * Por que existe (01/10/2026, fotos de las prensas Hot Press): dije "no hay videos de la prensa funcionando"
 * despues de buscar por NOMBRE de archivo, con MIS palabras ("hot press", "tapizado"). El video estaba en
 * `Escritorio\_EN ESPERA\Video explicativo funcionamiento mdood automatico LMJ\` y las fotos adentro de un zip de
 * 1,39 GB: ninguno de los dos nombres decia "hot press". Un listado SIN filtro de palabras los mostraba los dos.
 * Por eso este script no filtra: lista todas las carpetas, y dice lo que NO pudo mirar (zip sin abrir, enlaces
 * que no siguio, carpetas que no pudo leer), para que un "no hay" no salga de un inventario a medias.
 *
 *   node scripts/_materialAfuera.mjs                 # todo lo que hay, por carpeta
 *   node scripts/_materialAfuera.mjs --buscar lmj    # ademas marca las carpetas/archivos que nombran esa palabra
 *   node scripts/_materialAfuera.mjs --json <salida> # el inventario completo, para cruzarlo con otra cosa
 *
 * Antes de decir "no hay foto/video de X": correr esto, MIRAR las carpetas que tengan videos o zip, y recien ahi
 * concluir. Regla video-maquina.md (el material de maquina vive en la biblioteca; lo que este afuera esta sin archivar).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VIDEO = /\.(mov|mp4|m4v|avi|3gp|wmv)$/i;
const FOTO = /\.(jpe?g|png|heic|webp)$/i;
const ZIP = /\.(zip|rar|7z)$/i;
const SALTEAR = /^(node_modules|\.git|appdata|\.venv[^\\/]*|\$recycle\.bin|windowsapps|\.cache|__pycache__)$/i;

/** Donde suele quedar material sin archivar. La biblioteca (`~\BARACK ARGENTINA SRL\`) no es raiz: no se recorre. */
export function raicesPorDefecto(home = os.homedir()) {
  const personal = path.join(home, 'OneDrive - BARACK ARGENTINA SRL');
  return [
    path.join(personal, 'Desktop'), path.join(personal, 'Attachments'), path.join(personal, 'Pictures'),
    path.join(personal, 'Archivos de chat de Microsoft Teams'), path.join(personal, 'migracion-fak-2026-08-02'),
    path.join(home, 'Downloads'), path.join(home, 'Pictures'), path.join(home, 'Videos'), path.join(home, 'Desktop'),
    'C:\\Dev\\_telefono',
  ].filter((p) => fs.existsSync(p));
}

const dentroDe = (dir, base) => { const d = path.resolve(dir).toLowerCase(), b = path.resolve(base).toLowerCase(); return d === b || d.startsWith(b + path.sep); };

/**
 * Recorre `raices` y devuelve { filas, sinMirar }: una fila por carpeta con fotos, videos o zip, y la lista de lo
 * que quedo sin mirar (enlaces que no se siguen, carpetas que no se pudieron leer).
 */
export function inventario(raices, { excluir = [] } = {}) {
  const filas = []; const sinMirar = [];
  const anda = (dir, raiz) => {
    if (excluir.some((x) => dentroDe(dir, x))) return;
    let es = [];
    try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch (err) { sinMirar.push({ ruta: dir, motivo: `no se pudo leer (${err.code || 'error'})` }); return; }
    const f = { carpeta: dir, raiz, fotos: 0, videos: 0, zips: [], bytes: 0, ultimo: 0, nombresVideo: [] };
    for (const e of es) {
      const p = path.join(dir, e.name);
      if (e.isSymbolicLink()) { sinMirar.push({ ruta: p, motivo: 'es un enlace a otra carpeta: no se siguio' }); continue; }
      if (e.isDirectory()) { if (!SALTEAR.test(e.name)) anda(p, raiz); continue; }
      const esV = VIDEO.test(e.name), esF = FOTO.test(e.name), esZ = ZIP.test(e.name);
      if (!esV && !esF && !esZ) continue;
      let st = null; try { st = fs.statSync(p); } catch { continue; }
      f.bytes += st.size; f.ultimo = Math.max(f.ultimo, st.mtimeMs);
      if (esV) { f.videos += 1; f.nombresVideo.push(e.name); } else if (esF) f.fotos += 1; else f.zips.push({ nombre: e.name, bytes: st.size });
    }
    if (f.fotos || f.videos || f.zips.length) filas.push(f);
  };
  for (const r of raices) anda(r, r);
  filas.sort((a, b) => b.videos - a.videos || b.zips.length - a.zips.length || b.fotos - a.fotos);
  return { filas, sinMirar };
}

const sinTildes = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** ¿La carpeta, un video o un zip de la fila nombra la palabra? (sin tildes, sin mayusculas) */
export function nombra(fila, palabra) {
  const q = sinTildes(palabra);
  return [fila.carpeta, ...fila.nombresVideo, ...fila.zips.map((z) => z.nombre)].some((n) => sinTildes(n).includes(q));
}

/** Valor de `--opcion valor`; null si falta o si lo que sigue es otra opcion. */
export function argumento(argv, nombre) {
  const i = argv.indexOf(nombre); const v = i >= 0 ? argv[i + 1] : null;
  return v && !v.startsWith('--') ? v : null;
}

const mb = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(2).replace('.', ',')} GB` : `${Math.round(b / 1e6)} MB`);
const fecha = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : '');

function main() {
  const raices = raicesPorDefecto();
  const { filas, sinMirar } = inventario(raices);
  const buscar = argumento(process.argv, '--buscar'); const json = argumento(process.argv, '--json');
  const tot = filas.reduce((a, f) => ({ v: a.v + f.videos, f: a.f + f.fotos, z: a.z + f.zips.length }), { v: 0, f: 0, z: 0 });
  const home = os.homedir(); const corto = (p) => p.replace(home, '~');
  console.log(`Material fuera de la biblioteca: ${tot.v} videos, ${tot.f} fotos y ${tot.z} zip en ${filas.length} carpetas (${raices.length} raices recorridas).`);
  console.log(`SIN MIRAR: los ${tot.z} zip no se abrieron${sinMirar.length ? `, y ${sinMirar.length} carpeta(s) o enlace(s) no se recorrieron (listados al final)` : ''}.\n`);
  for (const f of filas) {
    const marca = buscar && nombra(f, buscar) ? '>> ' : '   ';
    if (!f.videos && !f.zips.length) { console.log(`${marca}${corto(f.carpeta)}  [${f.fotos} fotos · ${mb(f.bytes)} · ${fecha(f.ultimo)}]`); continue; }
    console.log(`${marca}${corto(f.carpeta)}`);
    console.log(`      ${f.videos} videos · ${f.fotos} fotos · ${f.zips.length} zip · ${mb(f.bytes)} · ultimo ${fecha(f.ultimo)}`);
    for (const n of f.nombresVideo) console.log(`      video: ${n}`);
    for (const z of f.zips) console.log(`      zip sin abrir: ${z.nombre} (${mb(z.bytes)})`);
  }
  for (const s of sinMirar) console.log(`   SIN MIRAR ${corto(s.ruta)}: ${s.motivo}`);
  if (buscar) console.log(`\nCarpetas que nombran "${buscar}": ${filas.filter((f) => nombra(f, buscar)).length}. Que una carpeta NO lo nombre no quiere decir que no lo tenga: mirala.`);
  if (json) { fs.writeFileSync(json, JSON.stringify({ filas, sinMirar }, null, 1)); console.log(`\ninventario -> ${json}`); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
