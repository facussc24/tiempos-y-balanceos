/**
 * _temasAbiertos.mjs — pagina de los temas abiertos: un renglon por tema con su estado, su ultima fecha y lo que
 * falta, para que Fak vea donde quedo cada cosa sin abrir una sesion (tanda 1.3.4 del plan del sistema, 16/10/2026).
 *
 *   node scripts/_temasAbiertos.mjs              genera exports/explicaciones/temas_abiertos.html (gitignoreado)
 *   node scripts/_temasAbiertos.mjs --out <ruta> la deja en otra ruta
 *
 * Fuentes (solo lee): las memorias `project_*` (frontmatter `modified` y `description`, y los renglones que dicen
 * pendiente / falta / a medir / a confirmar / sin mandar), los seguimientos con fecha (`project_seguimientos_con_fecha`,
 * con la misma logica que `node scripts/_seguimientos.mjs`) y cómo llama Fak a cada tema (`scripts/_lib/temasCanon.data.json`).
 * BARACK_MEMORIA apunta a otra carpeta de memoria (lo usa el test); BARACK_HOY fija la fecha.
 * El logo es el oficial (`tools/flowchart/assets/barack_logo.png`), embebido para que la pagina abra sola.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abiertos, aIso, estadoDe, leerBloque } from './_lib/seguimientos.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEMORIA = process.env.BARACK_MEMORIA || path.join(os.homedir(), '.claude', 'projects', 'C--Dev-BarackMercosul', 'memory');

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const limpiar = (t) => String(t).replace(/\*\*|`|__/g, '').replace(/^\s*(?:[-*]|\d+\.)\s+/, '').replace(/\s+/g, ' ').trim();
const corto = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

/** Frontmatter minimo: description (de una linea) y modified (suelto o adentro de metadata). */
export function leerFrontmatter(md) {
  const m = String(md).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = m ? m[1] : '';
  const valor = (k) => {
    const r = fm.match(new RegExp(`^\\s*${k}:\\s*(.*)$`, 'm'));
    return r ? r[1].trim().replace(/^"(.*)"$/, '$1') : null;
  };
  return { description: valor('description') ?? '', modified: valor('modified'), cuerpo: m ? String(md).slice(m[0].length) : String(md) };
}

const SECCION_VIEJA = /hist[oó]ric|superad|no usar|cerrad[oa]|entregado \(/i;
const PENDIENTE = /\b(pendientes?|falta|faltan|queda abierto|quedo abierto|sin mandar|sin enviar|a medir|a confirmar|tbd|esperando|en espera)\b/i;
// Un renglon que dice que algo NO falta no es un pendiente (auditor Opus 16/10: «No hace falta avisarles», «No falta
// cargarlo», «no es pendiente de Fak», «no se le lista como pendiente» salian en la columna «Lo que falta»).
const NIEGA = /\bno (hace|hacia|hara) falta\b|\bno falta\b|\bno (es|son|queda|quedan) pendientes?\b|\bno se (le )?lista como pendiente\b|\bsin pendientes\b|\bnada pendiente\b/i;

/** Hasta `max` renglones del cuerpo que dicen que algo falta, fuera de las secciones historicas. */
export function pendientesDe(cuerpo, max = 3) {
  const out = [];
  let vieja = false;
  for (const linea of String(cuerpo).split(/\r?\n/)) {
    const h = linea.match(/^#{1,6}\s+(.*)$/);
    if (h) { vieja = SECCION_VIEJA.test(h[1]); continue; }
    if (vieja || !PENDIENTE.test(linea) || NIEGA.test(linea)) continue;
    const t = corto(limpiar(linea), 170);
    if (t.length > 8 && !out.includes(t)) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** El estado por lo que dice la propia memoria: la descripcion y el primer titulo. */
export function estadoDeMemoria(description, cuerpo) {
  const primerTitulo = (String(cuerpo).match(/^#{1,6}\s+(.*)$/m) || [, ''])[1];
  const t = `${description} ${primerTitulo}`;
  if (/APAGAD/i.test(t)) return 'apagado';
  if (/TAREA CERRADA|\bCERRAD[OA]\b(?!.*sigue viva)/.test(t) && !/sigue viva/i.test(t)) return 'cerrado';
  if (/FRENAD|en espera|esperando/i.test(t)) return 'en espera';
  if (/🔴/.test(t)) return 'urgente';
  if (/🟡/.test(t)) return 'en curso';
  if (/🟢|HECHO|ENTREGAD/.test(t)) return 'hecho'; // en MAYUSCULAS es marca de estado; «entregadas» suelto no (auditor 16/10)
  return 'abierto';
}

const humano = (archivo) => archivo.replace(/^project_/, '').replace(/\.md$/, '').replace(/_\d{4}-\d{2}(-\d{2})?$/, '').replace(/[_-]+/g, ' ');

/** Como llama Fak a cada memoria, del canon de temas: { archivo: [frases] }. */
export function aliasDelCanon(canon) {
  const out = {};
  for (const t of canon?.temas ?? []) for (const a of t.archivos ?? []) (out[a] ??= []).push(...(t.frases ?? []));
  return out;
}

/** Un renglon por memoria project_*, de la mas reciente a la mas vieja. */
export function temasDeMemoria(dir, alias = {}) {
  const filas = [];
  for (const f of fs.readdirSync(dir).filter((x) => /^project_.*\.md$/.test(x)).sort()) {
    if (f === 'project_seguimientos_con_fecha.md') continue; // va arriba, con su propia logica
    const ruta = path.join(dir, f);
    const { description, modified, cuerpo } = leerFrontmatter(fs.readFileSync(ruta, 'utf8'));
    const fechaFm = modified && /^\d{4}-\d{2}-\d{2}/.test(modified) ? modified.slice(0, 10) : null;
    const pendientes = pendientesDe(cuerpo);
    const estado = estadoDeMemoria(description, cuerpo);
    filas.push({
      archivo: f,
      tema: humano(f),
      alias: [...new Set(alias[f] ?? [])].sort((a, b) => b.length - a.length), // lo especifico primero: se muestran 6
      estado: estado === 'hecho' && pendientes.length ? 'abierto' : estado, // con pendientes escritos no es «hecho»
      fecha: fechaFm ?? aIso(fs.statSync(ruta).mtime),
      fechaDeArchivo: !fechaFm,
      descripcion: corto(limpiar(description.replace(/^"|"$/g, '')), 220),
      pendientes,
    });
  }
  return filas.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : a.tema.localeCompare(b.tema)));
}

export function seguimientosAbiertos(dir, hoy) {
  const ruta = path.join(dir, 'project_seguimientos_con_fecha.md');
  if (!fs.existsSync(ruta)) return [];
  try {
    const { datos } = leerBloque(fs.readFileSync(ruta, 'utf8'));
    return abiertos(datos).map((s) => {
      try {
        const e = estadoDe(s, hoy);
        return { id: s.id, que: s.que, detalle: e.sinEnviar ? 'el primer pedido todavia no salio' : e.tocaHoy ? `hoy toca insistir (pedido ${e.proximoNumero})` : `${e.enviados} pedido(s), se insiste el ${e.proxima}`, cierra: s.se_cierra_cuando ?? '' };
      } catch (err) { return { id: s.id, que: s.que, detalle: `mal escrito: ${err.message}`, cierra: '' }; }
    });
  } catch (err) { return [{ id: '(no se pudo leer)', que: err.message, detalle: '', cierra: '' }]; }
}

const COLOR = { urgente: '#C00000', 'en curso': '#BF8F00', 'en espera': '#7F6000', abierto: '#44546A', hecho: '#548235', cerrado: '#7F7F7F', apagado: '#7F7F7F' };

export function armarHtml({ filas, seguimientos, hoy, logo }) {
  const fila = (f) => `<tr class="${f.estado === 'cerrado' || f.estado === 'apagado' ? 'gris' : ''}">
  <td><b>${esc(f.tema)}</b>${f.alias.length ? `<div class="alias">Fak lo llama: ${esc(f.alias.slice(0, 6).join(', '))}</div>` : ''}<div class="desc">${esc(f.descripcion)}</div></td>
  <td><span class="estado" style="background:${COLOR[f.estado] ?? '#44546A'}">${esc(f.estado)}</span></td>
  <td class="fecha">${esc(f.fecha)}${f.fechaDeArchivo ? '<div class="nota">fecha del archivo</div>' : ''}</td>
  <td>${f.pendientes.length ? `<ul>${f.pendientes.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '<span class="nota">la memoria no dice que falte algo</span>'}</td>
  <td class="archivo">${esc(f.archivo)}</td></tr>`;
  const seg = seguimientos.length
    ? `<table><thead><tr><th>Seguimiento</th><th>Que se pide</th><th>Donde esta</th><th>Se cierra cuando</th></tr></thead><tbody>${seguimientos.map((s) => `<tr><td><b>${esc(s.id)}</b></td><td>${esc(s.que)}</td><td>${esc(s.detalle)}</td><td>${esc(s.cierra)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="nota">No hay seguimientos con fecha abiertos.</p>';
  const cuenta = (e) => filas.filter((f) => f.estado === e).length;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Temas abiertos</title>
<style>
:root{--azul:#44546A}
body{font-family:Calibri,Carlito,Arial,sans-serif;color:#222;background:#fff;margin:0;padding:16px 24px}
header{display:flex;align-items:center;gap:16px;border-bottom:3px solid var(--azul);padding-bottom:8px;margin-bottom:12px}
header img{height:44px}
h1{color:var(--azul);font-size:22px;margin:0} h2{color:var(--azul);font-size:17px;margin:20px 0 6px}
.resumen{color:#555;font-size:13px}
table{border-collapse:collapse;width:100%;font-size:13px}
th{background:var(--azul);color:#fff;text-align:left;padding:5px 6px;position:sticky;top:0}
td{border-bottom:1px solid #d9d9d9;padding:5px 6px;vertical-align:top}
td ul{margin:0;padding-left:16px} .alias{color:var(--azul);font-size:12px;margin-top:2px}
.desc{color:#555;font-size:12px;margin-top:2px} .nota{color:#888;font-size:11px}
.estado{color:#fff;border-radius:3px;padding:1px 6px;white-space:nowrap;font-size:12px}
.fecha{white-space:nowrap} .archivo{color:#888;font-size:11px;word-break:break-all} tr.gris td{color:#999}
</style></head><body>
<header>${logo ? `<img src="${logo}" alt="Barack">` : ''}<div><h1>Temas abiertos</h1><div class="resumen">Al ${esc(hoy)} · ${filas.length} temas · ${cuenta('urgente')} urgentes · ${cuenta('en curso')} en curso · ${cuenta('en espera')} en espera · ${cuenta('abierto')} abiertos</div></div></header>
<h2>Seguimientos con fecha</h2>
${seg}
<h2>Temas, del mas reciente al mas viejo</h2>
<table><thead><tr><th style="width:34%">Tema</th><th>Estado</th><th>Ultima fecha</th><th style="width:38%">Lo que falta</th><th>Memoria</th></tr></thead>
<tbody>
${filas.map(fila).join('\n')}
</tbody></table>
</body></html>
`;
}

export function generar({ memoria = MEMORIA, hoy = process.env.BARACK_HOY || aIso(new Date()), out = path.join(REPO, 'exports', 'explicaciones', 'temas_abiertos.html') } = {}) {
  let canon = null;
  try { canon = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts', '_lib', 'temasCanon.data.json'), 'utf8')); } catch { /* sin alias */ }
  const logoRuta = path.join(REPO, 'tools', 'flowchart', 'assets', 'barack_logo.png');
  const logo = fs.existsSync(logoRuta) ? `data:image/png;base64,${fs.readFileSync(logoRuta).toString('base64')}` : null;
  const filas = temasDeMemoria(memoria, aliasDelCanon(canon));
  const html = armarHtml({ filas, seguimientos: seguimientosAbiertos(memoria, hoy), hoy, logo });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  return { out, filas: filas.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--out');
  const raro = args.find((a, k) => a !== '--out' && !(i >= 0 && k === i + 1));
  if (raro || (i >= 0 && !args[i + 1])) { console.error('uso: node scripts/_temasAbiertos.mjs [--out <ruta.html>]. No hago nada.'); process.exit(2); }
  if (!fs.existsSync(MEMORIA)) { console.error(`no existe la carpeta de memoria ${MEMORIA}`); process.exit(1); }
  const r = generar(i >= 0 ? { out: path.resolve(args[i + 1]) } : {});
  console.log(`${r.filas} temas -> ${r.out}`);
}
