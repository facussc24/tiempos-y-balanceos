/**
 * _exportOficial.ts — Excel oficial (plantilla I-AC-005.3) de los AMFE 159/160 con
 * el bloque "Historial de Revisiones" inyectado (el exportador base no lo genera).
 * Lee data + revisions del archivo persistido del MCP. Correr: npx tsx scripts/_exportOficial.ts <ruta>
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import XLSX from 'xlsx-js-style';
import { buildAmfeCompletoWorkbook } from '../modules/amfe/amfeExcelExport';

const SRC = process.argv[2];
if (!SRC) { console.error('Falta ruta del archivo persistido'); process.exit(1); }
const wrap = JSON.parse(readFileSync(SRC, 'utf8')) as { result: string };
const m = wrap.result.match(/\n(\[[\s\S]*\])\n<\/untrusted-data/);
if (!m) { console.error('No pude extraer datos'); process.exit(1); }
const rows = JSON.parse(m[1]) as Array<{ amfe_number: string; data: string; revisions: string }>;

const dir = 'C:/Users/facun/Documents/AMFE_SERIE_PWA';
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
  const c0 = 7;            // columna H
  const descSpan = 6;      // descripcion ocupa 6 columnas
  ws['!merges'] = ws['!merges'] || [];
  let r = 1;
  ws[C(r, c0)] = { v: 'HISTORIAL DE REVISIONES', t: 's', s: titleSt };
  ws['!merges'].push({ s: { r, c: c0 }, e: { r, c: c0 + 1 + descSpan } });
  r++;
  ws[C(r, c0)] = { v: 'Rev', t: 's', s: hdrSt };
  ws[C(r, c0 + 1)] = { v: 'Fecha', t: 's', s: hdrSt };
  ws[C(r, c0 + 2)] = { v: 'Descripción del cambio', t: 's', s: hdrSt };
  ws['!merges'].push({ s: { r, c: c0 + 2 }, e: { r, c: c0 + 1 + descSpan } });
  r++;
  for (const rv of revs) {
    ws[C(r, c0)] = { v: rv.rev, t: 's', s: ctrSt };
    ws[C(r, c0 + 1)] = { v: rv.date, t: 's', s: { ...ctrSt, font: {} } };
    ws[C(r, c0 + 2)] = { v: rv.description, t: 's', s: bodySt };
    ws['!merges'].push({ s: { r, c: c0 + 2 }, e: { r, c: c0 + 1 + descSpan } });
    r++;
  }
  const range = XLSX.utils.decode_range(ws['!ref'] as string);
  if (range.e.c < c0 + 1 + descSpan) range.e.c = c0 + 1 + descSpan;
  if (range.e.r < r) range.e.r = r;
  ws['!ref'] = XLSX.utils.encode_range(range);
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const dest = `${dir}/REV G - AMFE DE PROCESO N ${row.amfe_number}.xlsx`;
  writeFileSync(dest, Buffer.from(buf));
  console.info('OK', row.amfe_number, '| rev', doc?.header?.revision, '| revs', revs.length, '->', dest);
}
