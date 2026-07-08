/**
 * _regenerarMaestros.ts — Regenera los AMFEs MAESTROS con caratula oficial en un
 * arbol limpio (AMFES MAESTROS_NUEVO\<producto>\). Lee el dump del MCP.
 * Uso: npx tsx scripts/_regenerarMaestros.ts <dump.txt>
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import XLSX from 'xlsx-js-style';
import { buildAmfeOficialWorkbook } from '../modules/amfe/amfeExcelExport';
import type { AmfeLifecycleStatus } from '../modules/amfe/amfeCaratulaSheet';
import type { AmfeDocument } from '../modules/amfe/amfeTypes';
import { RUTA_BASE_AMFE } from './_lib/serverPaths.mjs';

const FILE = process.argv[2];
if (!FILE || !existsSync(FILE)) { console.error('Uso: npx tsx scripts/_regenerarMaestros.ts <dump.txt>'); process.exit(1); }
const DEST_ROOT = join(RUTA_BASE_AMFE, 'AMFES MAESTROS_NUEVO');

const ascii = (s: string) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9 _().-]/g, '').replace(/\s+/g, ' ').trim();
function parseData(raw: unknown): AmfeDocument | null {
    if (typeof raw !== 'string') return (raw as AmfeDocument) ?? null;
    try { const p = JSON.parse(raw); return typeof p === 'string' ? JSON.parse(p) : p; } catch { return null; }
}

interface Row { code: string; producto: string; data: string; revisions: string; status: string; }
const wrap = JSON.parse(readFileSync(FILE, 'utf8')) as { result: string };
const m = wrap.result.match(/\n(\[[\s\S]*\])\n<\/untrusted-data/);
if (!m) { console.error('No pude extraer el array'); process.exit(1); }
const rows: Row[] = (JSON.parse(m[1]) as Array<{ result: Row[] }>)[0].result;

let ok = 0; const fallos: string[] = [];
for (const r of rows) {
    const doc = parseData(r.data);
    if (!doc || !Array.isArray(doc.operations)) { fallos.push(`${r.code}: data corrupta`); continue; }
    const prod = ascii(r.producto).slice(0, 55) || r.code;
    const rev = String((doc.header?.revision || 'A')).toUpperCase();
    const destDir = join(DEST_ROOT, prod);
    const nombre = `AMFE Maestro - ${prod} - Rev.${rev}.xlsx`;
    try {
        const wb = buildAmfeOficialWorkbook(doc, { revisions: r.revisions, status: r.status as AmfeLifecycleStatus });
        mkdirSync(destDir, { recursive: true });
        writeFileSync(join(destDir, nombre), Buffer.from(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer));
        console.info(`  OK [${r.code}] ${nombre}`);
        ok++;
    } catch (e) {
        fallos.push(`${r.code}: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
    }
}
console.info(`\nMaestros regenerados: ${ok}/${rows.length}`);
if (fallos.length) { console.info('Con problema (dejar legacy):'); fallos.forEach(f => console.info('  ' + f)); }
