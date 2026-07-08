/**
 * _regenerarArbolCaratulas.ts — Regenera con caratula oficial los AMFEs cargados,
 * dentro del arbol nuevo (AMFES DE PROCESO_NUEVO), pisando la copia legacy.
 *
 * Lee un dump JSON (guardado por el MCP) con [{code, producto, server_path,
 * rev_actual, data, revisions, status}] y, para cada uno que pase el gate S/O/D,
 * escribe el Excel oficial (Caratula + AMFE) en su carpeta canonica. Los que no
 * pasan el gate se dejan con su Excel legacy (ya copiado) y se reportan.
 *
 * Uso: npx tsx scripts/_regenerarArbolCaratulas.ts <dump.txt-del-mcp>
 * NO destructivo respecto del arbol viejo (solo escribe dentro de _NUEVO).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import XLSX from 'xlsx-js-style';
import { buildAmfeOficialWorkbook } from '../modules/amfe/amfeExcelExport';
import type { AmfeLifecycleStatus } from '../modules/amfe/amfeCaratulaSheet';
import type { AmfeDocument } from '../modules/amfe/amfeTypes';
import { RUTA_BASE_AMFE } from './_lib/serverPaths.mjs';

const FILE = process.argv[2];
if (!FILE || !existsSync(FILE)) { console.error('Uso: npx tsx scripts/_regenerarArbolCaratulas.ts <dump-del-mcp.txt>'); process.exit(1); }

const DEST_ROOT = join(RUTA_BASE_AMFE, 'AMFES DE PROCESO_NUEVO');

// ─── Helpers (mismos que _construirArbolAmfe.mjs, para pegar en la misma ruta) ─
const sinAcentos = (s: string) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const ascii = (s: string) => sinAcentos(s).replace(/[^a-zA-Z0-9 _().-]/g, '').replace(/\s+/g, ' ').trim();
function revDeArchivo(nombre: string): string {
    let m = nombre.match(/\bREV(?:ISION)?[\s._-]*0*(\d{1,2})\b/i);
    if (m) return String(Number(m[1]));
    m = nombre.match(/\bREV[\s._-]*\.?\s*([A-Z])(?![A-Za-z])/i);
    if (m) return m[1].toUpperCase();
    m = nombre.match(/REV([A-Z])\b/i);
    if (m) return m[1].toUpperCase();
    return '';
}
const revLetra = (revArchivo: string, revReg: string) =>
    /^[A-Z]$/i.test(revArchivo) ? revArchivo.toUpperCase() : String(revReg || '').toUpperCase();
function derivar(serverPath: string) {
    const segs = serverPath.split('\\');
    const cliente = segs[1] || 'SIN_CLIENTE';
    const middle = segs.slice(2, -1);
    const proyecto = middle.length >= 2 ? middle[0] : '';
    return { cliente, proyecto };
}
function parseData(raw: unknown): AmfeDocument | null {
    if (raw == null) return null;
    if (typeof raw !== 'string') return raw as AmfeDocument;
    try { const p = JSON.parse(raw); return typeof p === 'string' ? JSON.parse(p) : p; } catch { return null; }
}

// ─── Extraer los docs del dump del MCP ────────────────────────────────────────
interface Row { code: string; producto: string; server_path: string; rev_actual: string; data: string; revisions: string; status: string; }
const wrap = JSON.parse(readFileSync(FILE, 'utf8')) as { result: string };
const m = wrap.result.match(/\n(\[[\s\S]*\])\n<\/untrusted-data/);
if (!m) { console.error('No pude extraer el array del dump'); process.exit(1); }
const rows: Row[] = (JSON.parse(m[1]) as Array<{ result: Row[] }>)[0].result;
console.info(`Docs en el dump: ${rows.length}`);

// ─── Regenerar ────────────────────────────────────────────────────────────────
let ok = 0; const fallos: string[] = [];
for (const r of rows) {
    const doc = parseData(r.data);
    if (!doc || !Array.isArray(doc.operations)) { fallos.push(`${r.code}: data corrupta`); continue; }
    const { cliente, proyecto } = derivar(r.server_path);
    const rev = revLetra(revDeArchivo(basename(r.server_path)), r.rev_actual);
    const prod = ascii(r.producto).slice(0, 50).trim() || `AMFE ${r.code}`;
    const relDir = [cliente, proyecto, `${r.code} - ${prod}`].filter(Boolean).join('\\');
    const nombre = `AMFE ${r.code} - ${prod}${rev ? ` - Rev.${rev}` : ''}.xlsx`;
    const destDir = join(DEST_ROOT, relDir);
    if (!existsSync(destDir)) { fallos.push(`${r.code}: no existe la carpeta ${relDir} (¿corriste _construirArbolAmfe?)`); continue; }

    // El N° oficial del AMFE es el del registro (ej. 149), no el id viejo del doc
    // (ej. VWA-PAT-IPPADS-001). Forzarlo en la caratula para consistencia.
    if (doc.header) doc.header.amfeNumber = r.code;

    try {
        const wb = buildAmfeOficialWorkbook(doc, { revisions: r.revisions, status: r.status as AmfeLifecycleStatus });
        writeFileSync(join(destDir, nombre), Buffer.from(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer));
        console.info(`  OK [${r.code}] ${nombre} (caratula + AMFE)`);
        ok++;
    } catch (e) {
        fallos.push(`${r.code}: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
    }
}

console.info(`\n✅ Regenerados con caratula: ${ok}/${rows.length}`);
if (fallos.length) {
    console.info(`\n⚠ Quedaron con Excel legacy (no pasaron el gate S/O/D o error) — ${fallos.length}:`);
    fallos.forEach(f => console.info('  ' + f));
}
