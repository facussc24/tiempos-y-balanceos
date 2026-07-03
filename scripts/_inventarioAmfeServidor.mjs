/**
 * _inventarioAmfeServidor.mjs — Inventario + reconciliacion de AMFEs (READ-ONLY)
 *
 * Fase 1 del plan de gestion de ciclo de vida de AMFEs. No modifica nada:
 * solo lee el arbol Y:, el Listado Maestro y un dump live de Supabase, y emite
 *   - reports/inventario_amfe.json   (input de las fases 2 y 6)
 *   - reports/INVENTARIO_AMFE_<fecha>.md  (informe para revisar con Fak)
 *
 * Uso:
 *   node scripts/_inventarioAmfeServidor.mjs --supabase-dump reports/supabase_amfe_dump.json
 *
 * El dump se genera via MCP Supabase (esta PC no tiene .env.local):
 *   SELECT id, amfe_number, project_name, subject, client, part_number,
 *          status, revision_level, last_revision_date, updated_at
 *   FROM amfe_documents;
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, relative, extname } from 'path';
import XLSX from 'xlsx-js-style';
import {
    RUTA_BASE_AMFE, ARCHIVO_LISTADO_MAESTRO, RUTA_PROCESO, RUTA_MAESTROS,
    esRutaObsoleta, esRutaQuilombo,
} from './_lib/serverPaths.mjs';

// ─── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dumpIdx = args.indexOf('--supabase-dump');
const DUMP_PATH = dumpIdx >= 0 ? args[dumpIdx + 1] : null;
if (!DUMP_PATH || !existsSync(DUMP_PATH)) {
    console.error('FALTA --supabase-dump <archivo.json> (dump live de amfe_documents via MCP).');
    process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Fecha serial de Excel (epoch 1899-12-30) → 'YYYY-MM-DD'. Deja strings como estan. */
function serialADate(v) {
    if (v === '' || v == null) return '';
    if (typeof v === 'string') return v.trim();
    if (typeof v !== 'number' || !isFinite(v) || v <= 0) return String(v);
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return d.toISOString().slice(0, 10);
}

/**
 * Extrae revision del nombre de archivo. Cubre: "REV 04", "REV2", "Rev.B",
 * "REVH", "REV_09", "Rev. E", "Rev 6 PROVISORIO", "REV G - ..." (prefijo).
 * @returns {{ rev: string|null, resto: string }} rev normalizada ("04"→"4") y nombre sin el token.
 */
function extraerRev(nombre) {
    const reNum = /\bREV(?:ISION)?[\s._-]*0*(\d{1,2})\b/i;
    const reLetra = /\bREV[\s._-]*\.?\s*([A-Z])(?![A-Za-z])/i;
    let m = nombre.match(reNum);
    if (m) return { rev: String(Number(m[1])), resto: nombre.replace(m[0], ' ') };
    m = nombre.match(reLetra);
    if (m) return { rev: m[1].toUpperCase(), resto: nombre.replace(m[0], ' ') };
    // "REVH" pegado (sin separador y sin boundary de palabra atras)
    m = nombre.match(/REV([A-Z])\b/i);
    if (m) return { rev: m[1].toUpperCase(), resto: nombre.replace(m[0], ' ') };
    return { rev: null, resto: nombre };
}

/**
 * Extrae numero de AMFE del nombre (ya sin token de rev). Solo 2-3 digitos:
 * numeros mas largos son part numbers, no IDs de AMFE.
 */
function extraerNumero(nombreSinRev) {
    const m = nombreSinRev.match(/AMFE[^0-9]{0,30}?(\d{2,4})(?!\d)/i);
    if (!m) return null;
    if (m[1].length > 3) return null; // PN en el nombre, no numero de AMFE
    return String(Number(m[1]));
}

/** Normaliza texto para comparaciones laxas (sin acentos, lowercase). */
function normalizar(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// ─── 1. Recorrer el arbol del servidor ───────────────────────────────────────

/** Basura de Windows/Office que no es documento: locks de Excel, thumbnails, accesos directos. */
function esBasura(nombre) {
    return nombre.startsWith('~$') || /^(thumbs\.db|desktop\.ini)$/i.test(nombre) || nombre.toLowerCase().endsWith('.lnk');
}

function walk(dir, out = []) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) walk(full, out);
        else if (!esBasura(e.name)) out.push(full);
    }
    return out;
}

console.log('Recorriendo servidor...');
const archivos = [];
for (const [zona, raiz] of [['PROCESO', RUTA_PROCESO], ['MAESTROS', RUTA_MAESTROS]]) {
    for (const full of walk(raiz)) {
        const rel = relative(RUTA_BASE_AMFE, full);
        const nombre = rel.split('\\').pop();
        const ext = extname(nombre).toLowerCase();
        const esExcel = ext === '.xlsx' || ext === '.xls';
        const { rev, resto } = esExcel ? extraerRev(nombre) : { rev: null, resto: nombre };
        archivos.push({
            rel,
            nombre,
            zona,                                   // PROCESO | MAESTROS
            carpeta: rel.split('\\').slice(0, -1).join('\\'),
            ext,
            esExcel,
            obsoleto: esRutaObsoleta(rel),
            enQuilombo: esRutaQuilombo(rel),
            numero: esExcel ? extraerNumero(resto) : null,
            rev,
        });
    }
}
console.log(`  ${archivos.length} archivos (${archivos.filter(a => a.esExcel).length} Excel).`);

// ─── 2. Leer Listado Maestro ─────────────────────────────────────────────────

console.log('Leyendo Listado Maestro...');
const wb = XLSX.readFile(ARCHIVO_LISTADO_MAESTRO);

function hojaAFilas(nombreHoja) {
    const ws = wb.Sheets[nombreHoja];
    if (!ws) throw new Error(`Falta hoja "${nombreHoja}" en el Listado Maestro`);
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

/** Busca la fila de headers (la que contiene 'ID AMFE') y mapea nombre→indice. */
function mapearHeaders(filas) {
    const idx = filas.findIndex(r => r.some(c => normalizar(c) === 'id amfe'));
    if (idx < 0) throw new Error('No se encontro fila de headers con "ID AMFE"');
    const mapa = {};
    filas[idx].forEach((h, i) => { if (String(h).trim()) mapa[normalizar(h)] = i; });
    return { idx, mapa };
}

const filasListado = hojaAFilas('Listado AMFE');
const { idx: hdrIdx, mapa: col } = mapearHeaders(filasListado);
const listado = [];
for (const r of filasListado.slice(hdrIdx + 1)) {
    const id = String(r[col['id amfe']] ?? '').trim();
    if (!id) continue;
    listado.push({
        id: String(Number(id) || id),
        tipo: String(r[col['tipo amfe']] || '').trim(),
        producto: String(r[col['producto / componente']] || '').trim(),
        pn: String(r[col['codigo de pieza (pn)']] || '').trim(),
        cliente: String(r[col['cliente']] || '').trim(),
        proyecto: String(r[col['proyecto']] || '').trim(),
        planta: String(r[col['planta / proceso / linea']] || '').trim(),
        ubicacion: String(r[col['ubicacion / link (archivo)']] || '').trim(),
        estado: String(r[col['estado']] || '').trim(),
        propietario: String(r[col['propietario / responsable']] || '').trim(),
        equipo: String(r[col['equipo / contactos']] || '').trim(),
        fechaCreacion: serialADate(r[col['fecha de creacion']]),
        revActual: String(r[col['revision actual']] || '').trim(),
        fechaUltimaRev: serialADate(r[col['fecha de revision (ultima)']]),
        proximaRevision: serialADate(r[col['proxima revision planificada']]),
    });
}
console.log(`  ${listado.length} entradas en "Listado AMFE".`);

const filasHist = hojaAFilas('Historial de Revisiones');
const { idx: hIdx, mapa: hcol } = mapearHeaders(filasHist);
const historial = [];
for (const r of filasHist.slice(hIdx + 1)) {
    const id = String(r[hcol['id amfe']] ?? '').trim();
    if (!id) continue;
    historial.push({
        id: String(Number(id) || id),
        rev: String(r[hcol['revision']] || '').trim(),
        fecha: serialADate(r[hcol['fecha']]),
        descripcion: String(r[hcol['descripcion del cambio']] || '').trim(),
        solicitante: String(r[hcol['solicitante']] || '').trim(),
        aprobador: String(r[hcol['aprobador']] || '').trim(),
        vinculo: String(r[hcol['vinculado a control plan / doc']] || r[hcol['vinculado a control plan / documento']] || '').trim(),
    });
}
console.log(`  ${historial.length} filas de historial de revisiones.`);

// ─── 3. Dump Supabase (live, generado via MCP en esta corrida) ───────────────

const supabase = JSON.parse(readFileSync(DUMP_PATH, 'utf8'));
console.log(`  ${supabase.length} documentos en Supabase (dump ${DUMP_PATH}).`);

// ─── 4. Reconciliacion por numero ────────────────────────────────────────────

const numeros = new Map(); // numero → { listado[], vigentes[], obsoletos[], supabase[] }
function slot(n) {
    if (!numeros.has(n)) numeros.set(n, { listado: [], vigentes: [], obsoletos: [], supabase: [] });
    return numeros.get(n);
}
for (const e of listado) slot(e.id).listado.push(e);
for (const a of archivos.filter(a => a.esExcel && a.numero)) {
    (a.obsoleto || a.enQuilombo ? slot(a.numero).obsoletos : slot(a.numero).vigentes).push(a);
}
for (const s of supabase) {
    const n = String(Number(s.amfe_number) || s.amfe_number);
    slot(n).supabase.push(s);
}

// Sugerencia de match por producto para archivos vigentes sin numero
const STOPWORDS = new Set(['amfe', 'de', 'proceso', 'del', 'la', 'el', 'los', 'las', 'y', 'rev',
    'fabricacion', 'con', 'sin', 'por', 'para', 'a', 'n', 'nuevo', 'preliminar']);
function tokens(s) {
    return normalizar(s).split(/[^a-z0-9]+/).filter(t => t.length >= 3 && !STOPWORDS.has(t));
}
function sugerirListado(archivo) {
    const tArch = new Set([...tokens(archivo.nombre), ...tokens(archivo.carpeta)]);
    let mejor = null, mejorScore = 0;
    for (const e of listado) {
        const tProd = tokens(`${e.producto} ${e.proyecto} ${e.cliente}`);
        const score = tProd.filter(t => tArch.has(t)).length;
        if (score > mejorScore) { mejorScore = score; mejor = e; }
    }
    return mejorScore >= 2 ? { id: mejor.id, producto: mejor.producto, score: mejorScore } : null;
}

// ─── 5. Hallazgos ────────────────────────────────────────────────────────────

const vigentes = archivos.filter(a => a.esExcel && !a.obsoleto && !a.enQuilombo);
const hallazgos = {
    archivosSinNumero: vigentes.filter(a => !a.numero)
        .map(a => ({ rel: a.rel, rev: a.rev, sugerencia: sugerirListado(a) })),
    servidorSinListado: [...numeros.entries()]
        .filter(([, v]) => v.vigentes.length && !v.listado.length)
        .map(([n, v]) => ({ numero: n, archivos: v.vigentes.map(a => a.rel) })),
    listadoSinArchivoVigente: [...numeros.entries()]
        .filter(([, v]) => v.listado.length && !v.vigentes.length)
        .map(([n, v]) => ({
            numero: n,
            producto: v.listado[0].producto,
            estado: v.listado[0].estado,
            soloObsoletos: v.obsoletos.length > 0,
        })),
    supabaseSinListado: supabase
        .filter(s => !slot(String(Number(s.amfe_number) || s.amfe_number)).listado.length)
        .map(s => ({ amfe_number: s.amfe_number, project: s.project_name, rev: s.revision_level })),
    listadoSinSupabase: [...numeros.entries()]
        .filter(([, v]) => v.listado.length && !v.supabase.length)
        .map(([n, v]) => ({ numero: n, producto: v.listado[0].producto, estado: v.listado[0].estado })),
    revMismatch: [...numeros.entries()].flatMap(([n, v]) => {
        const revs = {
            listado: v.listado[0]?.revActual || null,
            archivo: v.vigentes[0]?.rev || null,
            supabase: v.supabase[0]?.revision_level || null,
        };
        const presentes = Object.entries(revs).filter(([, r]) => r != null);
        const distintos = new Set(presentes.map(([, r]) => normalizar(r)));
        return presentes.length >= 2 && distintos.size > 1
            ? [{ numero: n, producto: v.listado[0]?.producto || v.vigentes[0]?.nombre || '', ...revs }]
            : [];
    }),
    duplicadosVigentes: [...numeros.entries()]
        .filter(([, v]) => v.vigentes.length > 1)
        .map(([n, v]) => ({ numero: n, archivos: v.vigentes.map(a => a.rel) })),
    idsDuplicadosEnListado: Object.entries(
        listado.reduce((acc, e) => { (acc[e.id] ||= []).push(e.producto); return acc; }, {})
    ).filter(([, prods]) => prods.length > 1).map(([id, prods]) => ({ id, productos: prods })),
    quilombo: archivos.filter(a => a.enQuilombo).map(a => ({ rel: a.rel, numero: a.numero, rev: a.rev, obsoleto: a.obsoleto })),
};

// ─── 6. Salidas ──────────────────────────────────────────────────────────────

mkdirSync('reports', { recursive: true });
const hoy = new Date().toISOString().slice(0, 10);

writeFileSync('reports/inventario_amfe.json', JSON.stringify({
    generado: new Date().toISOString(),
    rutaBase: RUTA_BASE_AMFE,
    archivos, listado, historial, supabase, hallazgos,
}, null, 2));

const md = [];
md.push(`# Inventario AMFE — servidor vs Listado Maestro vs Supabase (${hoy})`);
md.push('');
md.push(`- Archivos en servidor: **${archivos.length}** (${archivos.filter(a => a.esExcel).length} Excel; ${vigentes.length} vigentes fuera de OBSOLETO/1.ORGANIZAR)`);
md.push(`- Entradas en Listado Maestro: **${listado.length}** (IDs unicos: ${new Set(listado.map(e => e.id)).size})`);
md.push(`- Documentos en Supabase: **${supabase.length}**`);
md.push('');
const seccion = (titulo, items, render) => {
    md.push(`## ${titulo} (${items.length})`);
    md.push('');
    if (!items.length) { md.push('_Sin casos._'); md.push(''); return; }
    items.forEach(it => md.push(render(it)));
    md.push('');
};
seccion('Archivos vigentes SIN numero de AMFE', hallazgos.archivosSinNumero,
    it => `- \`${it.rel}\`${it.rev ? ` (rev ${it.rev})` : ''}${it.sugerencia ? ` → ¿listado **${it.sugerencia.id}** "${it.sugerencia.producto}"?` : ' → sin candidato en listado'}`);
seccion('Numeros en servidor que NO estan en el Listado', hallazgos.servidorSinListado,
    it => `- **${it.numero}**: ${it.archivos.map(a => `\`${a}\``).join(', ')}`);
seccion('Listado SIN archivo vigente en servidor', hallazgos.listadoSinArchivoVigente,
    it => `- **${it.numero}** "${it.producto}" (estado ${it.estado})${it.soloObsoletos ? ' — solo hay archivos en OBSOLETO/1.ORGANIZAR' : ' — sin ningun archivo con ese numero'}`);
seccion('Supabase SIN entrada en Listado', hallazgos.supabaseSinListado,
    it => `- **${it.amfe_number}** (${it.project}) rev ${it.rev}`);
seccion('Listado SIN documento en Supabase (contenido no cargado)', hallazgos.listadoSinSupabase,
    it => `- **${it.numero}** "${it.producto}" (estado ${it.estado})`);
seccion('Mismatch de revision entre fuentes', hallazgos.revMismatch,
    it => `- **${it.numero}** "${it.producto}": listado=${it.listado ?? '—'} · archivo=${it.archivo ?? '—'} · supabase=${it.supabase ?? '—'}`);
seccion('Duplicados vigentes (2+ archivos no-OBSOLETO con el mismo numero)', hallazgos.duplicadosVigentes,
    it => `- **${it.numero}**: ${it.archivos.map(a => `\`${a}\``).join(' · ')}`);
seccion('IDs duplicados dentro del Listado', hallazgos.idsDuplicadosEnListado,
    it => `- **${it.id}**: ${it.productos.join(' / ')}`);
md.push(`## Carpeta 1.ORGANIZAR (${hallazgos.quilombo.length} archivos)`);
md.push('');
md.push(`Detalle completo en \`reports/inventario_amfe.json\` → \`hallazgos.quilombo\`.`);
md.push('');

writeFileSync(`reports/INVENTARIO_AMFE_${hoy}.md`, md.join('\n'));
console.log(`\nOK → reports/inventario_amfe.json + reports/INVENTARIO_AMFE_${hoy}.md`);
