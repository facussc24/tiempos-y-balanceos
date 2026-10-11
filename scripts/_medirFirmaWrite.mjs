// scripts/_medirFirmaWrite.mjs
/**
 * _medirFirmaWrite.mjs — cuantos Write/Edit reales frenaria firma-ia-guard si revisara el contenido en vivo (cola HOY-16b).
 *
 * POR QUE: activarlo cambia que frena en todas las sesiones, y eso lo decide Fak con el numero delante. Cada Write/Edit
 * de los registros de las sesiones (la carpeta de proyectos del usuario, <sesion>.jsonl) pasa por la MISMA funcion
 * que va a correr el guardian (firmaIaEnArchivo, con el contexto que arma parsear a partir del JSON, como en el
 * despachador). Cuenta dos veces:
 *   - sin las excepciones (firmaIaEnEscritura a secas): se compara con la medicion del 11/10/2026 (39 de 17.770);
 *   - con exports/explicaciones y exports/<tarea>/_trabajo exceptuados (firmaIaEnArchivo).
 * Solo lee. Imprime fecha, ruta y el motivo del guardian (que trae un recorte de hasta ~110 caracteres), nunca el
 * contenido entero.
 *
 *   node scripts/_medirFirmaWrite.mjs [--dias 12] [--dir <carpeta con .jsonl>] [--json]
 *   Sale con 0 si midio; con 2 si no encontro registros o un argumento esta mal.
 *
 * Test: __tests__/scripts/firmaIAGuardArchivo.test.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parsear, firmaIaEnEscritura, firmaIaEnArchivo } from './_lib/guardianes.mjs';

const PROYECTOS = path.join(os.homedir(), '.claude', 'projects');
const PREFIJO = 'C--Dev-BarackMercosul';

/** Las carpetas de registros de este repo (y de sus worktrees: comparten el prefijo). */
export function carpetasDeRegistros(base = PROYECTOS) {
  try { return fs.readdirSync(base).filter((d) => d.startsWith(PREFIJO)).map((d) => path.join(base, d)); } catch { return []; }
}

/** Los Write/Edit de un renglon del registro: [{ tool, input, fecha }]. Un renglon roto (a medio escribir) no cuenta. */
export function usosDeArchivo(linea) {
  let j;
  try { j = JSON.parse(linea); } catch { return []; }
  const partes = Array.isArray(j?.message?.content) ? j.message.content : [];
  return partes
    .filter((p) => p?.type === 'tool_use' && /^(?:write|edit)$/i.test(String(p.name ?? '')) && p.input && typeof p.input === 'object')
    .map((p) => ({ tool: String(p.name), input: p.input, fecha: typeof j.timestamp === 'string' ? j.timestamp : '' }));
}

/** Recorre los .jsonl de `carpetas` y cuenta los Write/Edit desde `desde` (Date). Solo lee. */
export function medir({ carpetas, desde }) {
  const r = { archivos: 0, saltados: 0, usos: 0, frenanSinExcepcion: 0, frenan: [], porCarpeta: [] };
  const porCarpeta = new Map();
  for (const dir of carpetas) {
    // Los registros de la sesion principal (<sesion>.jsonl) y los de sus subagentes (<sesion>/subagents/*.jsonl): sin los
    // segundos el numero mentia (auditor Opus 11/10/2026: 4.738 Write/Edit mas en 12 dias, con 5 frenos que no se veian).
    let archivos = [];
    try {
      for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
        if (d.isFile() && d.name.endsWith('.jsonl')) archivos.push(path.join(dir, d.name));
        else if (d.isDirectory()) {
          const sd = path.join(dir, d.name, 'subagents');
          try { for (const n of fs.readdirSync(sd)) if (n.endsWith('.jsonl')) archivos.push(path.join(sd, n)); } catch { /* sin subagentes */ }
        }
      }
    } catch { continue; }
    for (const f of archivos) {
      let texto;
      try {
        if (fs.statSync(f).mtimeMs < desde.getTime()) continue;   // no se toco desde la fecha: no trae renglones nuevos
        texto = fs.readFileSync(f, 'utf8');
      } catch { r.saltados++; continue; }                          // lo esta escribiendo otra sesion, o no entra en memoria
      r.archivos++;
      for (const linea of texto.split('\n')) {
        if (!linea.includes('"tool_use"')) continue;               // atajo: la mayoria de los renglones no traen herramientas
        for (const u of usosDeArchivo(linea)) {
          if (!u.fecha || !(new Date(u.fecha) >= desde)) continue;  // sin fecha no se puede ubicar en la ventana
          r.usos++;
          const ctx = parsear(JSON.stringify({ tool_name: u.tool, tool_input: u.input }));
          if (firmaIaEnEscritura(ctx.content, ctx.file)) r.frenanSinExcepcion++;
          const motivo = firmaIaEnArchivo(ctx.content, ctx.file);
          if (!motivo) continue;
          r.frenan.push({ fecha: u.fecha, tool: u.tool, archivo: ctx.file, motivo });
          const c = path.win32.dirname(ctx.file);
          porCarpeta.set(c, (porCarpeta.get(c) ?? 0) + 1);
        }
      }
    }
  }
  r.porCarpeta = [...porCarpeta].sort((a, b) => b[1] - a[1]).map(([carpeta, n]) => ({ carpeta, n }));
  return r;
}

export function main(argv) {
  const valor = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const dias = Number(valor('--dias', '12'));
  if (!Number.isFinite(dias) || dias <= 0) { console.error('--dias tiene que ser un numero mayor que 0'); return 2; }
  const desde = new Date(Date.now() - dias * 86_400_000);
  const dir = valor('--dir', '');
  const r = medir({ carpetas: dir ? [dir] : carpetasDeRegistros(), desde });
  if (!r.archivos) { console.error(`No encontre registros de los ultimos ${dias} dias en ${dir || path.join(PROYECTOS, `${PREFIJO}*`)}.`); return 2; }
  if (argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); return 0; }
  const saltados = r.saltados ? ` (${r.saltados} no se pudieron leer)` : '';
  console.log(`Desde ${desde.toISOString().slice(0, 16)} · ${r.archivos} registros${saltados} · ${r.usos} Write/Edit`);
  console.log(`Frenarian sin excepciones: ${r.frenanSinExcepcion} · con explicaciones y _trabajo exceptuados: ${r.frenan.length}`);
  for (const { carpeta, n } of r.porCarpeta) console.log(`  ${String(n).padStart(4)}  ${carpeta}`);
  for (const x of r.frenan) console.log(`- ${x.fecha.slice(0, 16)} ${x.tool} ${x.archivo}\n    ${x.motivo}`);
  return 0;
}

if (process.argv[1] && /_medirFirmaWrite\.mjs$/.test(process.argv[1].replace(/\\/g, '/'))) process.exitCode = main(process.argv.slice(2));
