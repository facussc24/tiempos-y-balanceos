// _materialAfuera.mjs — inventario de fotos y videos fuera de la biblioteca, SIN filtro de palabras.
// Origen: 01/10/2026. Dije "no hay video de la prensa funcionando" buscando por nombre con mis palabras; el video
// estaba en una carpeta de tarea llamada "Video explicativo funcionamiento mdood automatico LMJ" y las fotos
// adentro de un zip. El test reproduce ese arbol: el inventario tiene que mostrar las dos cosas, y decir lo que
// no pudo mirar.
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inventario, nombra, argumento } from '../../scripts/_materialAfuera.mjs';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'material-afuera-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));
const pone = (rel, bytes = 10) => { const p = path.join(TMP, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, Buffer.alloc(bytes)); return p; };

pone('Desktop/_EN ESPERA/Video explicativo funcionamiento mdood automatico LMJ/WhatsApp Video 2026-08-06 at 14.16.49.mp4', 500);
pone('migracion/MIGRACION-FACU-PC.zip', 900);
pone('Downloads/WhatsApp Image 1.jpeg'); pone('Downloads/WhatsApp Image 2.jpeg'); pone('Downloads/notas.txt');
pone('Desktop/tarea/node_modules/paquete/logo.png');
pone('biblioteca/5- VIDEOS Y FOTOS/NOVAX/ya archivado.mp4');
pone('biblioteca vieja/foto suelta.jpg');
pone('Desktop/tarea sin material/informe.xlsx');
pone('destino del enlace/escondido.mp4');
let hayEnlace = true;
try { fs.symlinkSync(path.join(TMP, 'destino del enlace'), path.join(TMP, 'Desktop', 'enlace a otra carpeta'), 'junction'); } catch { hayEnlace = false; }

describe('_materialAfuera — lista todo lo que hay, no lo que yo creo que se llama', () => {
  const { filas, sinMirar } = inventario([path.join(TMP, 'Desktop'), path.join(TMP, 'migracion'), path.join(TMP, 'Downloads'), path.join(TMP, 'biblioteca'), path.join(TMP, 'biblioteca vieja')], { excluir: [path.join(TMP, 'biblioteca')] });
  const de = (trozo) => filas.find((f) => f.carpeta.includes(trozo));

  it('ROJO del 01/10: el video de la carpeta "…automatico LMJ" aparece aunque su nombre no diga "hot press"', () => {
    const f = de('automatico LMJ');
    expect(f).toBeTruthy(); expect(f.videos).toBe(1); expect(f.nombresVideo[0]).toMatch(/WhatsApp Video/);
    expect(nombra(f, 'hot press')).toBe(false);          // por palabra NO se encontraba
    expect(nombra(f, 'LMJ')).toBe(true);
  });
  it('un zip se NOMBRA con su tamaño aunque no se abra: lo que falta mirar queda a la vista', () => {
    expect(de('migracion').zips).toEqual([{ nombre: 'MIGRACION-FACU-PC.zip', bytes: 900 }]);
  });
  it('VERDE: lo excluido, node_modules y las carpetas sin fotos ni videos no entran', () => {
    expect(filas.find((f) => f.carpeta.endsWith(path.join('biblioteca', '5- VIDEOS Y FOTOS', 'NOVAX')))).toBeUndefined();
    expect(de('node_modules')).toBeUndefined();
    expect(de('tarea sin material')).toBeUndefined();
  });
  it('excluir "biblioteca" no se lleva puesta a "biblioteca vieja"', () => {
    expect(de('biblioteca vieja')?.fotos).toBe(1);
  });
  it('una carpeta con una sola foto tambien se lista; las que tienen videos van primero', () => {
    expect(de('Downloads').fotos).toBe(2);
    expect(filas[0].videos).toBe(1);
  });
  it.skipIf(!hayEnlace)('un enlace a otra carpeta NO se sigue y queda anotado como sin mirar', () => {
    expect(de('destino del enlace')).toBeUndefined();
    expect(sinMirar.some((s) => s.ruta.includes('enlace a otra carpeta') && /enlace/.test(s.motivo))).toBe(true);
  });
  it('una raiz que no existe no rompe el inventario y queda anotada como sin mirar', () => {
    const r = inventario([path.join(TMP, 'no-existe')]);
    expect(r.filas).toEqual([]); expect(r.sinMirar[0].motivo).toMatch(/no se pudo leer/);
  });
  it('`--json --buscar x` no toma "--buscar" como nombre de archivo', () => {
    expect(argumento(['node', 's', '--json', '--buscar', 'x'], '--json')).toBeNull();
    expect(argumento(['node', 's', '--json', 'sal.json'], '--json')).toBe('sal.json');
  });
});
