/**
 * _exportIpPad.ts — Exporta el AMFE de proceso IP PAD (VWA-PAT-IPPADS-001) al Excel
 * oficial (buildAmfeCompletoWorkbook) con bloque "Historial de Revisiones" si existe.
 * Lee el archivo persistido del resultado MCP (mismo formato que _exportOficial.ts).
 * Correr: npx tsx scripts/_exportIpPad.ts <ruta-resultado-mcp>
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import XLSX from 'xlsx-js-style';
import { buildAmfeCompletoWorkbook } from '../modules/amfe/amfeExcelExport';

const SRC = process.argv[2];
if (!SRC) { console.error('Falta ruta del archivo persistido del resultado MCP'); process.exit(1); }

const raw = readFileSync(SRC, 'utf8');
// El archivo puede ser {"result":"...<untrusted-data-xxx>[...]</untrusted-data-xxx>..."} o el texto directo.
let text = raw;
try { const j = JSON.parse(raw); if (j && typeof j.result === 'string') text = j.result; } catch { /* texto plano */ }
const m = text.match(/(\[[\s\S]*\])\s*<\/untrusted-data/) || text.match(/(\[[\s\S]*\])/);
if (!m) { console.error('No pude extraer el array de datos'); process.exit(1); }
const rows = JSON.parse(m[1]) as Array<{ amfe_number: string; data: string; revisions: string | null }>;

const dir = 'C:/Users/facun/OneDrive/Escritorio/Enviar a Marcelo Nieve';
mkdirSync(dir, { recursive: true });

const thin = () => { const s = { style: 'thin', color: { rgb: 'BFBFBF' } }; return { top: s, bottom: s, left: s, right: s }; };
const titleSt = { font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thin() };
const hdrSt = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '4472C4' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: thin() };
const bodySt = { alignment: { vertical: 'top', wrapText: true }, border: thin() };
const ctrSt = { alignment: { horizontal: 'center', vertical: 'center' }, border: thin(), font: { bold: true } };
const C = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

for (const row of rows) {
  const doc = JSON.parse(row.data);
  const revs = JSON.parse(row.revisions || '[]') as Array<{ rev: string; date: string; description: string }>;
  const wb = buildAmfeCompletoWorkbook(doc);
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (revs.length) {
    const c0 = 7, descSpan = 6;
    ws['!merges'] = ws['!merges'] || [];
    let r = 1;
    ws[C(r, c0)] = { v: 'HISTORIAL DE REVISIONES', t: 's', s: titleSt };
    ws['!merges'].push({ s: { r, c: c0 }, e: { r, c: c0 + 1 + descSpan } }); r++;
    ws[C(r, c0)] = { v: 'Rev', t: 's', s: hdrSt };
    ws[C(r, c0 + 1)] = { v: 'Fecha', t: 's', s: hdrSt };
    ws[C(r, c0 + 2)] = { v: 'Descripción del cambio', t: 's', s: hdrSt };
    ws['!merges'].push({ s: { r, c: c0 + 2 }, e: { r, c: c0 + 1 + descSpan } }); r++;
    for (const rv of revs) {
      ws[C(r, c0)] = { v: rv.rev, t: 's', s: ctrSt };
      ws[C(r, c0 + 1)] = { v: rv.date, t: 's', s: { ...ctrSt, font: {} } };
      ws[C(r, c0 + 2)] = { v: rv.description, t: 's', s: bodySt };
      ws['!merges'].push({ s: { r, c: c0 + 2 }, e: { r, c: c0 + 1 + descSpan } }); r++;
    }
    const range = XLSX.utils.decode_range(ws['!ref'] as string);
    if (range.e.c < c0 + 1 + descSpan) range.e.c = c0 + 1 + descSpan;
    if (range.e.r < r) range.e.r = r;
    ws['!ref'] = XLSX.utils.encode_range(range);
  }
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const dest = `${dir}/AMFE - IP PAD REV.A.xlsx`;
  writeFileSync(dest, Buffer.from(buf));
  console.info('OK', row.amfe_number, '| ops', doc?.operations?.length, '| revs', revs.length, '->', dest);
}
