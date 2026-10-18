/**
 * fichaLectores.mjs — lo que lee la ficha de configuracion por pieza de cada documento. SOLO LECTURA.
 *
 * Cada lector devuelve TEXTO tal cual lo dice el documento (y donde lo dijo); la comparacion la hace
 * fichaPieza.mjs. Asi un lector nunca "interpreta" un valor: si el texto no se entiende, queda sin valor
 * y se lista.
 *
 *   flujogramaDelRepo  tools/flowchart/data/<clave>.json: letra, fecha, historial y operaciones
 *   amfeDeDoc          un AMFE ya leido de Supabase: letra, fecha, operaciones y nombres de los recursos
 *   leerAmfeLive       Supabase LIVE con el cliente de SOLO LECTURA (supabaseSoloLectura.mjs)
 *   bomDelArb          el export del arb (C:/tmp/RELACIONES.TXT) con su fecha, via parsearBom()
 *   textoPptx / textoDoc / textoPdf   python-pptx, antiword, pdftotext (UTF-8 forzado)
 *   anchoMrk           el <WIDTH> de una tizada .MRK (cm)
 *   filasBeon          la tabla «revisiones que vio VW» que dejo la notebook de Calidad
 *   mailDelCache       un mail del cache local (`_mails.py --ver`, que no abre Outlook)
 *   archivosDe         los nombres de una carpeta (para ver que letras hay en una copia)
 *
 * Nada escribe: ni Supabase, ni el arb, ni Outlook, ni el servidor. Y: se lee solo si esta montada.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pasosDelFlujograma, leerBomDelArb, EXPORT_BOM_ARB } from './amfeAutoria.mjs';
import { numerosDe } from './numeracionAmfe.mjs';
import { RAIZ_REPO } from './fichaPieza.mjs';

const UTF8 = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };

function correr(cmd, args, { timeout = 60_000, input } = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', env: UTF8, timeout, input, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} salio con ${r.status}: ${String(r.stderr || '').slice(0, 300)}`);
  return r.stdout;
}

/** Hay con que leer? (en el CI de GitHub no hay antiword, pdftotext ni la nube) */
export function hay(cmd) {
  // python con -I, igual que textoPptx: sin -I ve los paquetes del usuario y despues el lector no
  const r = spawnSync(cmd, cmd === 'python' ? ['-I', '-c', 'import pptx'] : ['-v'], { encoding: 'utf8', timeout: 15_000 });
  return !r.error && (cmd !== 'python' || r.status === 0);
}

// ---------------------------------------------------------------------------
// documentos del repo y de Supabase
// ---------------------------------------------------------------------------

/**
 * El checkout principal del repo. Una copia de trabajo aparte no trae lo ignorado (.env.local, el cache
 * de mails): para LEER esas cosas se usa el principal en su lugar, sin copiar nada.
 */
export async function checkoutPrincipal(raiz = RAIZ_REPO) {
  const { repoPrincipalDe } = await import(pathToFileURL(join(raiz, 'scripts', '_lib', 'cerebroLint.mjs')).href);
  return resolve(repoPrincipalDe(raiz));
}

/** El flujograma vigente de nuestro lado es el JSON del generador: de ahi sale lo que se emite. */
export function flujogramaDelRepo(clave, raiz = RAIZ_REPO) {
  const ruta = join(raiz, 'tools', 'flowchart', 'data', `${clave}.json`);
  const j = JSON.parse(readFileSync(ruta, 'utf8'));
  return {
    ruta,
    letra: j.header?.revision ?? null,
    fecha: j.header?.revisionDate ?? null,
    revisiones: (j.revisions || []).map((r) => ({ letra: r.rev, fecha: r.date })),
    operaciones: [...new Set(pasosDelFlujograma(j).map((p) => p.n))],
  };
}

/** Lo que la ficha necesita de un AMFE ya leido (puro: el test lo llama con un objeto). */
export function amfeDeDoc(doc, { updated_at } = {}) {
  const h = doc.header || {};
  const recursos = [];
  for (const o of doc.operations || []) {
    for (const w of o.workElements || []) recursos.push({ op: String(o.opNumber ?? o.operationNumber ?? ''), tipo: w.type, nombre: w.name });
  }
  return {
    letra: h.rev ?? h.revisionLevel ?? null,
    fecha: h.revDate ?? null,
    actualizado: updated_at ?? null,
    operaciones: numerosDe(doc),
    recursos,
  };
}

/**
 * Supabase LIVE (regla verify-supabase-live), con el cliente que solo sabe hacer select(). Desde un
 * worktree no hay .env.local (no se copia: lo frena la casa): se usa el cliente del checkout principal,
 * que lee el suyo en su lugar.
 */
export async function leerAmfeLive(claveSupabase, raiz = RAIZ_REPO) {
  const base = existsSync(join(raiz, '.env.local')) ? raiz : await checkoutPrincipal(raiz);
  const { conectarSoloLectura } = await import(pathToFileURL(join(base, 'scripts', '_lib', 'supabaseSoloLectura.mjs')).href);
  const { parseData } = await import(pathToFileURL(join(raiz, 'scripts', '_lib', 'amfeIo.mjs')).href);
  const sb = await conectarSoloLectura();
  const { data, error } = await sb.from('amfe_documents').select('id, amfe_number, updated_at, data').eq('amfe_number', claveSupabase);
  if (error) throw new Error(`no pude leer el AMFE ${claveSupabase}: ${error.message}`);
  if (!data?.length) throw new Error(`Supabase no devolvio el AMFE ${claveSupabase}: con RLS, "nada" es "no pude leer"`);
  return { id: data[0].id, updated_at: data[0].updated_at, ...amfeDeDoc(parseData(data[0].data), data[0]) };
}

/** La BOM del arb de los productos, con la FECHA del export (la ficha la dice siempre). */
export function bomDelArb(productos, ruta = EXPORT_BOM_ARB) {
  const { lineas, fecha } = leerBomDelArb(productos, ruta);
  const porCodigo = new Map();
  for (const l of lineas) {
    const e = porCodigo.get(l.codigo) || { codigo: l.codigo, descripcion: l.descripcion, productos: new Set() };
    e.productos.add(l.producto);
    porCodigo.set(l.codigo, e);
  }
  return { ruta, fecha: fecha.toISOString(), lineas: [...porCodigo.values()].map((e) => ({ ...e, productos: [...e.productos].sort() })) };
}

// ---------------------------------------------------------------------------
// archivos
// ---------------------------------------------------------------------------

// -I deja afuera las variables PYTHON* (tambien PYTHONIOENCODING): la salida se fuerza a UTF-8 adentro.
const PY_PPTX = `
import sys, json
sys.stdout.reconfigure(encoding='utf-8')
from pptx import Presentation
p = Presentation(sys.argv[1])
out = []
for i, s in enumerate(p.slides, 1):
    t = []
    for sh in s.shapes:
        if sh.has_text_frame and sh.text_frame.text.strip():
            t.append(sh.text_frame.text)
        if getattr(sh, 'has_table', False) and sh.has_table:
            for r in sh.table.rows:
                t.append(' | '.join(c.text for c in r.cells))
    out.append({'hoja': i, 'texto': ' | '.join(x.replace('\\n', ' ') for x in t)})
sys.stdout.write(json.dumps(out, ensure_ascii=False))
`;

/** Texto de cada hoja de un PowerPoint: [{hoja, texto}]. */
export function textoPptx(ruta) {
  return JSON.parse(correr('python', ['-I', '-c', PY_PPTX, ruta]));
}

/** Texto de un Word viejo (.doc), con los acentos bien (mapa UTF-8 de antiword). */
export function textoDoc(ruta) {
  return correr('antiword', ['-m', 'UTF-8.txt', ruta]);
}

export function textoPdf(ruta) {
  return correr('pdftotext', ['-layout', '-enc', 'UTF-8', ruta, '-']);
}

/** El ancho de la tizada que guarda el .MRK (en cm, como lo escribe el programa de tizadas). */
export function anchoMrk(ruta) {
  const m = /<WIDTH>\s*([\d.,]+)\s*<\/WIDTH>/i.exec(readFileSync(ruta, 'latin1'));
  return m ? `<WIDTH>${m[1]}</WIDTH>` : null;
}

export function archivosDe(carpeta) {
  return existsSync(carpeta) ? readdirSync(carpeta).filter((f) => statSync(join(carpeta, f)).isFile()).sort() : null;
}

/**
 * La tabla de la notebook de Calidad («BeOn Patagonia - revisiones que vio VW»), una fila por informe y
 * documento: informe | estado | tipo | archivo | fecha | revision leida adentro | ¿VW lo vio? | nota
 */
export function filasBeon(texto) {
  const filas = [];
  for (const renglon of String(texto).split(/\r?\n/)) {
    const c = renglon.split('|').map((x) => x.trim());
    if (c.length < 7 || !/^2HC\b/.test(c[0])) continue;
    filas.push({ informe: c[0], estado: c[1], tipo: c[2], archivo: c[3], revision: c[5], vio: c[6], nota: c[7] || '' });
  }
  return filas;
}

/** Un mail del cache local, sin abrir Outlook (`_mails.py --ver` lee el cache). */
export async function mailDelCache(id, raiz = RAIZ_REPO) {
  const base = existsSync(join(raiz, '.mail-cache')) ? raiz : await checkoutPrincipal(raiz);
  const txt = correr('python', [join(base, 'scripts', '_mails.py'), '--ver', id], { timeout: 90_000 });
  const campo = (n) => (new RegExp(`^${n}\\s+(.*)$`, 'm').exec(txt) || [])[1]?.trim() ?? null;
  return {
    asunto: campo('ASUNTO'), para: campo('PARA'), cc: campo('CC'), fecha: campo('FECHA'),
    adjuntos: (campo('ADJUNTOS') || '').split('|').map((x) => x.trim()).filter(Boolean),
  };
}
