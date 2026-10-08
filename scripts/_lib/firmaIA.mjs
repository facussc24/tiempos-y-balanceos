/**
 * firmaIA.mjs — la misma regla que scripts/_lib/firmaIA.py, para texto, desde node.
 *
 * Fak, 08/10/2026: ningun documento de Barack dice ni deja ver que lo hizo Claude o una IA. Las
 * palabras viven en una sola fuente, `firmaIA.data.json`, que leen el detector de Python (archivos
 * enteros: celdas, pestañas ocultas, propiedades) y este modulo (texto suelto: una fila de un
 * listado, un nombre de carpeta). Lo usa `_escritorio.mjs --archivar` antes de escribir el listado
 * de tareas cerradas, que vive en la biblioteca de Ingenieria y lo ve el equipo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CANON = JSON.parse(fs.readFileSync(path.join(AQUI, 'firmaIA.data.json'), 'utf8'));

const REGLAS = CANON.bloqueante
  .filter((p) => !p.solo_unido)
  .map((p) => ({ id: p.id, que: p.que, re: new RegExp(p.re, p.distingue_mayusculas ? '' : 'i') }));

/** Hallazgos [{ id, que, texto }] de un texto; lista vacia si no nombra a Claude ni a una IA. */
export function firmaIaEnTexto(texto) {
  const t = String(texto ?? '');
  const out = [];
  for (const r of REGLAS) {
    const m = r.re.exec(t);
    if (m) out.push({ id: r.id, que: r.que, texto: t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).replace(/\s+/g, ' ').trim() });
  }
  return out;
}

/** Las rutas que la regla deja pasar (configuracion de Claude por decision de Fak, asistente de area). */
export function rutaExcluida(ruta) {
  const r = `${String(ruta ?? '').toLowerCase()}\\`;
  return CANON.rutas_excluidas.contiene.some((x) => r.includes(x.toLowerCase()));
}
