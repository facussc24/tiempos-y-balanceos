#!/usr/bin/env node
/**
 * _escritorio.mjs — la cola de tareas del Escritorio: relevar, archivar y verificar.
 *
 * El Escritorio es la lista de pendientes: una carpeta por tarea. Lo cerrado se va a
 * `_TERMINADAS <año>\` con la fecha de cierre adelante y una fila en el INDICE.md.
 * NADA SE BORRA NUNCA: este script no tiene una sola llamada de borrado.
 *
 *   node scripts/_escritorio.mjs                      # relevar + verificar
 *   node scripts/_escritorio.mjs --check              # solo invariantes (exit 1 si rompen)
 *   node scripts/_escritorio.mjs --archivar "<nombre>" --cerrada AAAA-MM-DD \
 *        --que "<que quedo hecho>" --donde "<donde quedo el entregable>"
 *   node scripts/_escritorio.mjs --registrar "<carpeta ya archivada>" --cerrada ... --que ... --donde ...
 *   node scripts/_escritorio.mjs --reabrir "<carpeta archivada>"
 *   ... cualquiera de esos + --dry-run  para ver el plan sin tocar nada
 *
 * POR QUE EXISTE: el archivado se venia haciendo a mano y quedaba sin registro, asi que
 * despues no habia forma de encontrar lo archivado ni de saber por que se cerro. El
 * mover y el registrar son UNA sola operacion aca: no se puede archivar sin dejar el
 * rastro, y no se puede dejar el rastro apuntando a una carpeta que no existe.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// Configuracion
// ─────────────────────────────────────────────────────────────────────────────

export const ESCRITORIO_DEFAULT = 'C:\\Users\\facun\\OneDrive\\Escritorio';

/** Extensiones que nunca son una tarea: accesos directos y archivos de sistema. */
const EXT_FIJAS = new Set(['.lnk', '.url', '.ini', '.exe', '.db']);

/** Nombres que viven en el Escritorio y no son tareas de trabajo. */
const NOMBRES_FIJOS = new Set(['juegos', 'desktop.ini', 'thumbs.db']);

/** Texto que no alcanza como registro de cierre. */
const RELLENO = /^(tbd|n\/?a|-+|\.+|ok|listo|pendiente|varios?|nada|sin datos?)$/i;

const CABECERA = ['Cerrada', 'Carpeta', 'Qué quedó hecho', 'Dónde quedó', 'Estado'];

const c = { r: '\x1b[31m', y: '\x1b[33m', g: '\x1b[32m', b: '\x1b[34m', d: '\x1b[2m', x: '\x1b[0m' };
const say = (s = '') => console.log(s);
const ok = (s) => console.log(`${c.g}✓${c.x}  ${s}`);
const warn = (s) => console.log(`${c.y}⚠${c.x}  ${s}`);
const bad = (s) => console.log(`${c.r}✗${c.x}  ${s}`);

// ─────────────────────────────────────────────────────────────────────────────
// Funciones puras (las ejerce __tests__/escritorio.test.ts)
// ─────────────────────────────────────────────────────────────────────────────

/** `_TERMINADAS 2026` para una fecha de cierre 2026-xx-xx. */
export function carpetaArchivo(fechaISO) {
  return `_TERMINADAS ${String(fechaISO).slice(0, 4)}`;
}

/** Nombre canonico de una carpeta archivada: la fecha adelante, el nombre original atras. */
export function nombreCanonico(fechaISO, nombreOriginal) {
  return `${fechaISO} - ${despojarFecha(nombreOriginal)}`;
}

/** Saca un prefijo de fecha ya presente, para que renombrar sea idempotente. */
export function despojarFecha(nombre) {
  return String(nombre).replace(/^\d{4}-\d{2}-\d{2}\s+-\s+/, '').trim();
}

export function esFechaValida(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s ?? ''))) return false;
  const d = new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  if (d.toISOString().slice(0, 10) !== s) return false;   // 2026-02-31 no existe
  return d.getTime() <= Date.now() + 86400000;            // no se cierra en el futuro
}

/**
 * Valida el registro de cierre. Devuelve la lista de motivos de rechazo (vacia = pasa).
 * Este es el gate: sin un cierre valido no se mueve nada.
 */
export function validarCierre({ cerrada, que, donde }) {
  const errores = [];
  if (!esFechaValida(cerrada)) {
    errores.push('--cerrada tiene que ser una fecha real AAAA-MM-DD y no puede ser futura');
  }
  for (const [flag, valor] of [['--que', que], ['--donde', donde]]) {
    const v = String(valor ?? '').trim();
    if (!v) { errores.push(`falta ${flag}`); continue; }
    if (v.includes('|') || /[\r\n]/.test(v)) errores.push(`${flag} no puede tener "|" ni saltos de linea`);
    if (v.length < 10) errores.push(`${flag} es demasiado corto (${v.length} caracteres, minimo 10)`);
    if (RELLENO.test(v)) errores.push(`${flag} es relleno ("${v}"), tiene que decir algo concreto`);
  }
  return errores;
}

/** Clasifica una entrada del Escritorio: 'tarea' | 'fijo' | 'archivo'. */
export function clasificarEntrada(nombre, esDirectorio) {
  const bajo = nombre.toLowerCase();
  if (NOMBRES_FIJOS.has(bajo)) return 'fijo';
  if (!esDirectorio && EXT_FIJAS.has(path.extname(bajo))) return 'fijo';
  if (esDirectorio && /^_terminadas\s+\d{4}$/i.test(nombre)) return 'archivo';
  if (nombre.startsWith('.')) return 'fijo';
  return 'tarea';
}

/** Arma la fila de la tabla del INDICE. */
export function filaIndice({ cerrada, carpeta, que, donde, estado = 'cerrada' }) {
  return `| ${[cerrada, carpeta, que, donde, estado].map((v) => String(v).trim()).join(' | ')} |`;
}

/** Lee la tabla del INDICE. Ignora prosa, cabecera y separador. */
export function parsearIndice(texto) {
  const filas = [];
  for (const linea of String(texto ?? '').split(/\r?\n/)) {
    const t = linea.trim();
    if (!t.startsWith('|') || !t.endsWith('|')) continue;
    if (/^\|[\s:|-]+\|$/.test(t)) continue;                       // separador
    const celdas = t.slice(1, -1).split('|').map((s) => s.trim());
    if (celdas.length !== 5) continue;
    if (celdas[0] === CABECERA[0]) continue;                      // cabecera
    filas.push({ cerrada: celdas[0], carpeta: celdas[1], que: celdas[2], donde: celdas[3], estado: celdas[4] });
  }
  return filas;
}

/**
 * Invariantes del archivo. `estadoFs` = { archivadas: string[], enEscritorio: string[] }.
 * Devuelve la lista de problemas (vacia = sano).
 */
export function verificarInvariantes(filas, estadoFs) {
  const problemas = [];
  const archivadas = new Set(estadoFs.archivadas);
  const registradas = new Set();

  for (const f of filas) {
    if (f.estado.startsWith('reabierta')) continue;               // historia, no se chequea
    if (!esFechaValida(f.cerrada)) problemas.push(`fila con fecha invalida: "${f.cerrada}" (${f.carpeta})`);
    if (!archivadas.has(f.carpeta)) problemas.push(`el INDICE nombra "${f.carpeta}" pero esa carpeta no esta en el archivo`);
    if (registradas.has(f.carpeta)) problemas.push(`"${f.carpeta}" esta dos veces en el INDICE`);
    registradas.add(f.carpeta);
    for (const [campo, v] of [['que quedo hecho', f.que], ['donde quedo', f.donde]]) {
      if (String(v).trim().length < 10 || RELLENO.test(String(v).trim())) {
        problemas.push(`"${f.carpeta}": el ${campo} no dice nada concreto ("${v}")`);
      }
    }
  }
  for (const carpeta of estadoFs.archivadas) {
    if (!registradas.has(carpeta)) problemas.push(`"${carpeta}" esta archivada pero no tiene fila en el INDICE`);
    if (!/^\d{4}-\d{2}-\d{2} - .+/.test(carpeta)) problemas.push(`"${carpeta}" no arranca con la fecha de cierre (AAAA-MM-DD - nombre)`);
  }
  return problemas;
}

export function diasDesde(ms, ahora = Date.now()) {
  return Math.floor((ahora - ms) / 86400000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Acceso al filesystem
// ─────────────────────────────────────────────────────────────────────────────

function listar(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).map((d) => {
    const p = path.join(dir, d.name);
    let mtime = 0;
    try { mtime = fs.statSync(p).mtimeMs; } catch { /* OneDrive puede negar el stat */ }
    return { nombre: d.name, dir: d.isDirectory(), ruta: p, mtime };
  });
}

/** Todos los `_TERMINADAS AAAA` del Escritorio. */
function archivos(escritorio) {
  return listar(escritorio).filter((e) => clasificarEntrada(e.nombre, e.dir) === 'archivo').map((e) => e.nombre);
}

function rutaIndice(escritorio, archivo) {
  return path.join(escritorio, archivo, 'INDICE.md');
}

function leerIndice(escritorio, archivo) {
  const p = rutaIndice(escritorio, archivo);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

function indiceVacio(archivo) {
  return `# ${archivo.replace('_', '')} — qué se cerró y dónde quedó

Acá se archiva lo que ya está cerrado. **Nada se borra.** Cada carpeta conserva su nombre
original con la fecha de cierre adelante, así que ordenando por nombre queda en orden
cronológico. Para encontrar algo: buscar en esta tabla, o buscar el nombre en el Explorador
dentro de esta carpeta.

Esta tabla la escribe \`node scripts/_escritorio.mjs --archivar\`. No editarla a mano: si la
fila y la carpeta dejan de coincidir, \`--check\` lo marca.

${filaIndice({ cerrada: CABECERA[0], carpeta: CABECERA[1], que: CABECERA[2], donde: CABECERA[3], estado: CABECERA[4] })}
|---|---|---|---|---|
`;
}

function agregarFila(escritorio, archivo, fila, dryRun) {
  const p = rutaIndice(escritorio, archivo);
  const previo = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : indiceVacio(archivo);
  const nuevo = `${previo.replace(/\s*$/, '')}\n${fila}\n`;
  if (dryRun) return nuevo;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, nuevo, 'utf8');
  return nuevo;
}

// ─────────────────────────────────────────────────────────────────────────────
// Comandos
// ─────────────────────────────────────────────────────────────────────────────

function cmdRelevar(escritorio) {
  const entradas = listar(escritorio);
  const tareas = entradas.filter((e) => clasificarEntrada(e.nombre, e.dir) === 'tarea');
  const arch = archivos(escritorio);

  say(`\n${c.b}ESCRITORIO${c.x}  ${escritorio}`);
  say(`${c.d}${tareas.length} cosa(s) abiertas · ${arch.length} archivo(s) de terminadas${c.x}\n`);

  const orden = [...tareas].sort((a, b) => b.mtime - a.mtime);
  for (const t of orden) {
    const d = t.mtime ? diasDesde(t.mtime) : null;
    const edad = d === null ? '   ?' : `${String(d).padStart(3)}d`;
    const marca = d !== null && d >= 7 ? c.y : c.d;
    const tipo = t.dir ? 'carpeta' : 'suelto ';
    say(`  ${marca}${edad}${c.x}  ${c.d}${tipo}${c.x}  ${t.nombre}`);
  }
  if (orden.some((t) => t.mtime && diasDesde(t.mtime) >= 7)) {
    say(`\n${c.d}Lo marcado en amarillo lleva 7 dias o mas sin tocarse: o esta cerrado sin archivar,${c.x}`);
    say(`${c.d}o esta trabado esperando a alguien. Las dos cosas se resuelven, no se dejan.${c.x}`);
  }

  for (const a of arch) {
    const filas = parsearIndice(leerIndice(escritorio, a));
    say(`\n${c.b}${a}${c.x}  ${c.d}${filas.length} fila(s) en el INDICE${c.x}`);
    for (const f of filas.slice(-10)) say(`  ${c.d}${f.cerrada}${c.x}  ${f.carpeta}`);
  }
  say('');
  return cmdCheck(escritorio, { silencioso: false });
}

function cmdCheck(escritorio, { silencioso = false } = {}) {
  const arch = archivos(escritorio);
  if (arch.length === 0) {
    if (!silencioso) warn('No hay ninguna carpeta `_TERMINADAS AAAA` en el Escritorio.');
    return 0;
  }
  let problemas = 0;
  for (const a of arch) {
    const filas = parsearIndice(leerIndice(escritorio, a));
    const archivadas = listar(path.join(escritorio, a)).filter((e) => e.dir).map((e) => e.nombre);
    const lista = verificarInvariantes(filas, { archivadas });
    if (lista.length === 0) {
      if (!silencioso) ok(`${a}: ${archivadas.length} carpeta(s), todas registradas y con nombre canonico.`);
    } else {
      problemas += lista.length;
      bad(`${a}: ${lista.length} problema(s)`);
      for (const p of lista) say(`     ${c.r}·${c.x} ${p}`);
    }
  }
  if (problemas > 0) {
    say(`\n${c.r}El archivo no cierra.${c.x} Se arregla registrando lo que falta:`);
    say(`  node scripts/_escritorio.mjs --registrar "<carpeta>" --cerrada AAAA-MM-DD --que "..." --donde "..."`);
  }
  return problemas;
}

function cmdArchivar(escritorio, { nombre, cerrada, que, donde, dryRun }) {
  const errores = validarCierre({ cerrada, que, donde });
  if (errores.length) {
    bad('No se archiva: falta el registro de cierre.');
    for (const e of errores) say(`     ${c.r}·${c.x} ${e}`);
    say(`\n${c.d}Archivar y registrar es la misma operacion. Sin "que quedo hecho" y "donde quedo",${c.x}`);
    say(`${c.d}dentro de tres meses la carpeta es una caja sin etiqueta.${c.x}`);
    return 1;
  }

  const origen = path.join(escritorio, nombre);
  if (!fs.existsSync(origen)) { bad(`No existe en el Escritorio: "${nombre}"`); return 1; }
  const esDir = fs.statSync(origen).isDirectory();
  if (clasificarEntrada(nombre, esDir) !== 'tarea') { bad(`"${nombre}" no es una tarea (es un acceso directo, un archivo de sistema o el archivo de terminadas).`); return 1; }

  const archivo = carpetaArchivo(cerrada);
  const destinoNombre = nombreCanonico(cerrada, path.parse(nombre).name);
  const destino = path.join(escritorio, archivo, destinoNombre);
  if (fs.existsSync(destino)) { bad(`Ya existe "${archivo}\\${destinoNombre}". Renombrar antes de archivar.`); return 1; }

  const fila = filaIndice({ cerrada, carpeta: destinoNombre, que, donde });

  if (dryRun) {
    say(`${c.y}DRY-RUN${c.x} — no se toca nada.`);
    say(`  mover   ${nombre}${esDir ? '\\' : ''}`);
    say(`  a       ${archivo}\\${destinoNombre}${esDir ? '' : `\\${path.basename(nombre)}`}`);
    say(`  INDICE  ${fila}`);
    return 0;
  }

  fs.mkdirSync(path.join(escritorio, archivo), { recursive: true });
  if (esDir) {
    fs.renameSync(origen, destino);
  } else {
    fs.mkdirSync(destino, { recursive: true });                   // un suelto viaja adentro de su carpeta
    fs.renameSync(origen, path.join(destino, path.basename(nombre)));
  }
  agregarFila(escritorio, archivo, fila, false);
  ok(`Archivada: ${archivo}\\${destinoNombre}`);
  return cmdCheck(escritorio, { silencioso: true });
}

function cmdRegistrar(escritorio, { nombre, cerrada, que, donde, dryRun }) {
  const errores = validarCierre({ cerrada, que, donde });
  if (errores.length) {
    bad('No se registra: el cierre esta incompleto.');
    for (const e of errores) say(`     ${c.r}·${c.x} ${e}`);
    return 1;
  }
  const archivo = carpetaArchivo(cerrada);
  const base = path.join(escritorio, archivo);
  const actual = path.join(base, nombre);
  if (!fs.existsSync(actual)) { bad(`No existe "${archivo}\\${nombre}"`); return 1; }

  const canonico = nombreCanonico(cerrada, nombre);
  const destino = path.join(base, canonico);
  const yaRegistrada = parsearIndice(leerIndice(escritorio, archivo)).some((f) => f.carpeta === canonico);
  if (yaRegistrada) { bad(`"${canonico}" ya tiene fila en el INDICE.`); return 1; }
  if (canonico !== nombre && fs.existsSync(destino)) { bad(`Ya existe "${canonico}".`); return 1; }

  const fila = filaIndice({ cerrada, carpeta: canonico, que, donde });
  if (dryRun) {
    say(`${c.y}DRY-RUN${c.x} — no se toca nada.`);
    if (canonico !== nombre) say(`  renombrar  ${nombre}  →  ${canonico}`);
    say(`  INDICE     ${fila}`);
    return 0;
  }
  if (canonico !== nombre) fs.renameSync(actual, destino);
  agregarFila(escritorio, archivo, fila, false);
  ok(`Registrada: ${archivo}\\${canonico}`);
  return cmdCheck(escritorio, { silencioso: true });
}

function cmdReabrir(escritorio, { nombre, dryRun }) {
  const hoy = new Date().toISOString().slice(0, 10);
  for (const archivo of archivos(escritorio)) {
    const actual = path.join(escritorio, archivo, nombre);
    if (!fs.existsSync(actual)) continue;
    const vuelta = despojarFecha(nombre);
    const destino = path.join(escritorio, vuelta);
    if (fs.existsSync(destino)) { bad(`Ya hay algo llamado "${vuelta}" en el Escritorio.`); return 1; }

    const texto = leerIndice(escritorio, archivo);
    const marcado = texto.split(/\r?\n/).map((l) => {
      const f = parsearIndice(l)[0];
      if (!f || f.carpeta !== nombre || f.estado.startsWith('reabierta')) return l;
      return filaIndice({ ...f, estado: `reabierta ${hoy}` });
    }).join('\n');

    if (dryRun) {
      say(`${c.y}DRY-RUN${c.x} — no se toca nada.`);
      say(`  mover  ${archivo}\\${nombre}  →  ${vuelta}`);
      say(`  INDICE la fila queda marcada "reabierta ${hoy}" (no se borra)`);
      return 0;
    }
    fs.renameSync(actual, destino);
    fs.writeFileSync(rutaIndice(escritorio, archivo), marcado, 'utf8');
    ok(`Reabierta: vuelve al Escritorio como "${vuelta}". La fila del INDICE queda como historia.`);
    return 0;
  }
  bad(`No encontre "${nombre}" en ningun _TERMINADAS.`);
  return 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

function main(argv) {
  const args = argv.slice(2);
  const flag = (n, def = null) => {
    const i = args.indexOf(n);
    return i === -1 ? def : args[i + 1] ?? true;
  };
  const escritorio = String(flag('--escritorio', ESCRITORIO_DEFAULT));
  const dryRun = args.includes('--dry-run');
  const comun = { cerrada: flag('--cerrada'), que: flag('--que'), donde: flag('--donde'), dryRun };

  if (!fs.existsSync(escritorio)) { bad(`No existe el Escritorio: ${escritorio}`); return 1; }

  if (args.includes('--archivar')) return cmdArchivar(escritorio, { nombre: String(flag('--archivar')), ...comun });
  if (args.includes('--registrar')) return cmdRegistrar(escritorio, { nombre: String(flag('--registrar')), ...comun });
  if (args.includes('--reabrir')) return cmdReabrir(escritorio, { nombre: String(flag('--reabrir')), dryRun });
  if (args.includes('--check')) return cmdCheck(escritorio);
  return cmdRelevar(escritorio);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv) > 0 ? 1 : 0);
}
