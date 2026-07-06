/**
 * _exportOficial.ts — Excel oficial (formulario I-AC-005.3) de los AMFE 159/160.
 * Usa buildAmfeOficialWorkbook: Caratula (con tabla de REVISIONES) + AMFE.
 * Lee data + revisions del archivo persistido del MCP. Correr: npx tsx scripts/_exportOficial.ts <ruta>
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import XLSX from 'xlsx-js-style';
import { buildAmfeOficialWorkbook } from '../modules/amfe/amfeExcelExport';
import type { AmfeLifecycleStatus } from '../modules/amfe/amfeCaratulaSheet';

const SRC = process.argv[2];
if (!SRC) { console.error('Falta ruta del archivo persistido'); process.exit(1); }
const wrap = JSON.parse(readFileSync(SRC, 'utf8')) as { result: string };
const m = wrap.result.match(/\n(\[[\s\S]*\])\n<\/untrusted-data/);
if (!m) { console.error('No pude extraer datos'); process.exit(1); }
const rows = JSON.parse(m[1]) as Array<{ amfe_number: string; data: string; revisions: string; status?: string }>;

const dir = 'C:/Users/facun/Documents/AMFE_SERIE_PWA';
mkdirSync(dir, { recursive: true });

for (const row of rows) {
  const doc = JSON.parse(row.data);
  let wb: XLSX.WorkBook;
  try {
    wb = buildAmfeOficialWorkbook(doc, { revisions: row.revisions, status: (row.status ?? 'draft') as AmfeLifecycleStatus });
  } catch (e) {
    console.error(`ABORTADO AMFE ${row.amfe_number}: ${e instanceof Error ? e.message : String(e)}`);
    continue;
  }
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const dest = `${dir}/REV G - AMFE DE PROCESO N ${row.amfe_number}.xlsx`;
  writeFileSync(dest, Buffer.from(buf));
  console.info('OK', row.amfe_number, '| rev', doc?.header?.revision, '| sheets', wb.SheetNames.join(','), '->', dest);
}
