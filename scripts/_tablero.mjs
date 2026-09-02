/**
 * _tablero.mjs — G6 del rol coordinador: el estado se arma DESDE LA FUENTE.
 *
 * POR QUE EXISTE. El 31/08/2026 el coordinador reporto durante una hora que una sesion estaba
 * "frenada esperando el OK de Fak", con una foto de las 09:15 que ya no valia. Y tenia 21
 * carpetas del Escritorio sin abrir, de las que no sabia absolutamente nada, mientras repetia
 * un tablero armado con lo que las sesiones le habian contado. El dato para desmentirse estaba
 * a una llamada de distancia y no lo miro.
 *
 * REGLA: una fila del tablero NO puede venir de "me lo dijo la sesion". Cada fila declara su
 * FUENTE (escritorio | sesion | encargo) y lleva la HORA de su foto. Una foto vieja se marca
 * VIEJO — volver a mirar; nunca se reporta como presente.
 *
 * USO
 *   node scripts/_tablero.mjs            # arma el tablero y lo escribe
 *   node scripts/_tablero.mjs --check    # exit 1 si el tablero no es confiable
 *
 * QUE HACE --check (los tres modos en que este tablero se vuelve mentira):
 *   1. Carpetas del Escritorio SIN notas legibles -> no se sabe que son. Es el contador que
 *      hubiera cantado las 21.
 *   2. Una sesion con DOS encargos abiertos a la vez -> G3 visto desde afuera.
 *   3. El tablero en disco tiene mas de 60 minutos -> esta viejo, no se reporta.
 *
 * NADA SE BORRA: este script solo lee y escribe .claude/state/tablero.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { RUTA_ESCRITORIO } from './_lib/serverPaths.mjs';
import { listar, esEnEspera, diasDesde } from './_escritorio.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const DIR_ENCARGOS = path.join(RAIZ, '.claude', 'state', 'encargos');
const SALIDA = path.join(RAIZ, '.claude', 'state', 'tablero.md');
const DIR_SESIONES = path.join(os.homedir(), '.claude', 'projects', 'C--Dev-BarackMercosul');

export const MINUTOS_VIEJO = 60;

/**
 * Una carpeta es LEGIBLE si se puede saber que es sin adivinar: o tiene notas escritas
 * (cualquier .txt/.md del primer nivel), o tiene el .msg del mail que la origino.
 *
 * El criterio NO es una lista de nombres de archivo: probarlo asi marco como "muda" a
 * "Mejorar el rol de coordinador", que tiene un .md de 34 KB adentro. Un check que grita
 * sobre carpetas perfectamente documentadas es el que se termina ignorando.
 */
export function tieneNotas(dirTarea) {
  try {
    return fs.readdirSync(dirTarea).some((f) => /\.(txt|md|msg)$/i.test(f));
  } catch { return false; }
}

/** FUENTE escritorio — las carpetas abiertas, abiertas de verdad (se mira adentro). */
export function filasEscritorio(base = RUTA_ESCRITORIO, { ahora = Date.now() } = {}) {
  const filas = [];
  // OJO con la forma que devuelve listar(): el campo es `dir`, NO `esDirectorio`, y ya trae
  // `ruta` y `mtime`. Usar el nombre equivocado no rompe: devuelve 0 carpetas en silencio,
  // que es el "verde vacio" clasico — un control que da lo mismo para todos los casos no
  // detecta nada. Pasó el 02/09/2026 y lo caza el test del gemelo rojo.
  const recorrer = (dir, ubicacion) => {
    for (const e of listar(dir)) {
      if (!e.dir) continue;
      if (esEnEspera(e.nombre)) { recorrer(e.ruta, '_EN ESPERA'); continue; }
      if (/^tareas cerradas$/i.test(e.nombre)) continue;
      filas.push({
        fuente: 'escritorio', ubicacion, nombre: e.nombre,
        dias: e.mtime ? diasDesde(e.mtime, ahora) : null,
        legible: tieneNotas(e.ruta),
      });
    }
  };
  recorrer(base, 'raiz');
  return filas;
}

/** FUENTE encargo — lo que YO mande y todavia no volvio. */
export function filasEncargos(dir = DIR_ENCARGOS) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .filter((e) => !e.cerrado)
    .map((e) => ({ fuente: 'encargo', id: e.id, a: e.a, entregable: e.entregable, creado: e.creado }));
}

/**
 * FUENTE sesion — la ULTIMA ACTIVIDAD real, leida del mtime del transcript en disco.
 * No de lo que la sesion diga de si misma: ese fue justamente el error.
 */
export function filasSesiones(dir = DIR_SESIONES, { ahora = Date.now(), horas = 24 } = {}) {
  if (!fs.existsSync(dir)) return [];
  const corte = ahora - horas * 3600000;
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => {
      const p = path.join(dir, f);
      let m = 0;
      try { m = fs.statSync(p).mtimeMs; } catch { /* ignore */ }
      return { fuente: 'sesion', id: f.replace(/\.jsonl$/, ''), ultimaActividadMs: m };
    })
    .filter((s) => s.ultimaActividadMs >= corte)
    .sort((a, b) => b.ultimaActividadMs - a.ultimaActividadMs);
}

const hhmm = (ms) => new Date(ms).toTimeString().slice(0, 5);
const minutosDesde = (ms, ahora = Date.now()) => Math.round((ahora - ms) / 60000);

/** Los tres modos en que el tablero se vuelve mentira. */
export function chequear({ escritorio, encargos, sesiones }, { ahora = Date.now(), salida = SALIDA } = {}) {
  const problemas = [];

  const mudas = escritorio.filter((f) => !f.legible);
  if (mudas.length) {
    problemas.push(`${mudas.length} carpeta(s) del Escritorio sin notas legibles: no se sabe que son ni que falta. ` +
      `Abrirlas antes de reportar estado. -> ${mudas.slice(0, 6).map((m) => m.nombre).join(' · ')}${mudas.length > 6 ? ' …' : ''}`);
  }

  const porSesion = new Map();
  for (const e of encargos) porSesion.set(e.a, (porSesion.get(e.a) || 0) + 1);
  for (const [ses, n] of porSesion) {
    if (n > 1) problemas.push(`${ses} tiene ${n} encargos abiertos a la vez. Un encargo, un entregable: el segundo sale cuando vuelve el primero.`);
  }

  if (fs.existsSync(salida)) {
    const edad = minutosDesde(fs.statSync(salida).mtimeMs, ahora);
    if (edad > MINUTOS_VIEJO) problemas.push(`el tablero en disco tiene ${edad} minutos. Una foto vieja no se reporta como presente: volve a armarlo.`);
  }

  return problemas;
}

export function armarMarkdown({ escritorio, encargos, sesiones }, ahora = Date.now()) {
  const L = [];
  const foto = hhmm(ahora);
  L.push(`# Tablero — foto ${new Date(ahora).toISOString().slice(0, 10)} ${foto}`);
  L.push('');
  L.push('Armado leyendo la fuente, no lo que las sesiones contaron. Cada fila dice de donde sale.');
  L.push('');

  L.push(`## Encargos abiertos (fuente: encargo · foto ${foto})`);
  if (!encargos.length) L.push('_Ninguno._');
  else encargos.forEach((e) => L.push(`- **${e.id}** -> ${e.a} · ${e.entregable} · abierto desde ${e.creado.slice(0, 16).replace('T', ' ')}`));
  L.push('');

  L.push(`## Sesiones con actividad en las ultimas 24 h (fuente: sesion · foto ${foto})`);
  if (!sesiones.length) L.push('_Ninguna._');
  else sesiones.slice(0, 12).forEach((s) => {
    const min = minutosDesde(s.ultimaActividadMs, ahora);
    const marca = min > MINUTOS_VIEJO ? '  ⚠ VIEJO — volver a mirar' : '';
    L.push(`- \`${s.id.slice(0, 8)}\` · ultima actividad ${hhmm(s.ultimaActividadMs)} (hace ${min} min)${marca}`);
  });
  L.push('');

  const alaVista = escritorio.filter((f) => f.ubicacion === 'raiz');
  const espera = escritorio.filter((f) => f.ubicacion === '_EN ESPERA');
  L.push(`## Cola del Escritorio (fuente: escritorio · foto ${foto})`);
  L.push(`${alaVista.length} a la vista + ${espera.length} en _EN ESPERA = **${escritorio.length} abiertas**`);
  L.push('');
  const mudas = escritorio.filter((f) => !f.legible);
  if (mudas.length) {
    L.push(`### ⚠ ${mudas.length} sin notas legibles — no se sabe que son`);
    mudas.forEach((m) => L.push(`- ${m.nombre}${m.dias !== null ? `  (${m.dias}d)` : ''}${m.ubicacion === '_EN ESPERA' ? '  · _EN ESPERA' : ''}`));
    L.push('');
  }
  return L.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const ahora = Date.now();
  const datos = {
    escritorio: filasEscritorio(RUTA_ESCRITORIO, { ahora }),
    encargos: filasEncargos(),
    sesiones: filasSesiones(DIR_SESIONES, { ahora }),
  };

  if (args.includes('--check') || args.includes('--solo-encargos')) {
    // --solo-encargos: lo que corre el hook al cerrar el turno. Deja afuera el conteo de
    // carpetas mudas a proposito: esa lista cambia de a poco y gritarla en CADA turno es
    // como se gasta un control hasta que se desactiva. Lo que si es accionable ahora mismo
    // es un encargo que quedo abierto o un tablero viejo.
    const soloEncargos = args.includes('--solo-encargos');
    const datosCheck = soloEncargos ? { ...datos, escritorio: [] } : datos;
    const problemas = chequear(datosCheck, { ahora });
    if (!problemas.length) { console.log(soloEncargos ? 'Encargos al dia.' : 'Tablero confiable: 0 problemas.'); return 0; }
    console.error(soloEncargos ? 'ENCARGOS SIN CERRAR:' : 'TABLERO NO CONFIABLE:');
    problemas.forEach((p, i) => console.error(`  ${i + 1}. ${p}`));
    if (soloEncargos) {
      console.error('\n  Un encargo abierto es una sesion que todavia te debe algo, o que ya te');
      console.error('  contesto y no lo cerraste:  node scripts/_encargo.mjs --cerrar <id>');
    }
    return 1;
  }

  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
  const md = armarMarkdown(datos, ahora);
  fs.writeFileSync(SALIDA, md + '\n');
  console.log(md);
  console.error(`\n[escrito en ${SALIDA}]`);
  return 0;
}

if (process.argv[1]?.endsWith('_tablero.mjs')) process.exit(main());
