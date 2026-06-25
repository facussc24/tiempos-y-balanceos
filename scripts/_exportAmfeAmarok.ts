/**
 * _exportAmfeAmarok.ts — Excel oficial de AMFE 128/129 (IP Decorative Amarok PA2) al pendrive D:\.
 * Lee data + revisions desde Supabase (service key) y reusa buildAmfeCompletoWorkbook + bloque Historial.
 * Correr: SUPABASE_SERVICE_ROLE_KEY=... VITE_SUPABASE_URL=... npx tsx scripts/_exportAmfeAmarok.ts
 */
import { writeFileSync } from 'node:fs';
import XLSX from 'xlsx-js-style';
import { createClient } from '@supabase/supabase-js';
import { buildAmfeCompletoWorkbook } from '../modules/amfe/amfeExcelExport';

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const DEST: Record<string, string> = {
  '128': 'D:/AMFE 128 - IP DECORATIVE 115 AMAROK PA2 - REV G.xlsx',
  '129': 'D:/AMFE 129 - IP DECORATIVE 116 AMAROK PA2 - REV G.xlsx',
};

const thin = () => { const s = { style: 'thin', color: { rgb: 'BFBFBF' } }; return { top: s, bottom: s, left: s, right: s }; };
const titleSt = { font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thin() };
const hdrSt = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '4472C4' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: thin() };
const bodySt = { alignment: { vertical: 'top', wrapText: true }, border: thin() };
const ctrSt = { alignment: { horizontal: 'center', vertical: 'center' }, border: thin(), font: { bold: true } };
const C = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

for (const k of ['128', '129']) {
  const { data: row, error } = await sb.from('amfe_documents').select('amfe_number,data,revisions').eq('amfe_number', k).single();
  if (error || !row) { console.error(`FETCH ${k} FALLO:`, error?.message); continue; }
  const doc = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  const revs = JSON.parse(row.revisions || '[]') as Array<{ rev: string; date: string; description: string }>;
  const wb = buildAmfeCompletoWorkbook(doc);
  const ws = wb.Sheets[wb.SheetNames[0]];
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
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  writeFileSync(DEST[k], Buffer.from(buf));
  const ops = doc?.operations?.length ?? 0;
  console.info(`OK AMFE ${k} | ops=${ops} | revs=${revs.length} -> ${DEST[k]}`);
}
console.info('DONE');
