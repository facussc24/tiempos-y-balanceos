/**
 * _exportAmfeAmarok.ts — Excel oficial de AMFE 128/129 (IP Decorative Amarok PA2) al pendrive D:\.
 * Lee data + revisions desde Supabase (service key). Reusa buildAmfeCompletoWorkbook (carátula + AMFE)
 * y AGREGA una hoja aparte "Revisiones" (Rev | Fecha | Responsable | Descripción).
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
const titleSt = { font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thin() };
const hdrSt = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '4472C4' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: thin() };
const bodySt = { alignment: { vertical: 'top', wrapText: true }, border: thin() };
const ctrSt = { alignment: { horizontal: 'center', vertical: 'center' }, border: thin() };
const C = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

for (const k of ['128', '129']) {
  const { data: row, error } = await sb.from('amfe_documents').select('amfe_number,data,revisions').eq('amfe_number', k).single();
  if (error || !row) { console.error(`FETCH ${k} FALLO:`, error?.message); continue; }
  const doc = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  const revs = JSON.parse(row.revisions || '[]') as Array<{ rev: string; date: string; description: string; responsible?: string }>;
  const wb = buildAmfeCompletoWorkbook(doc);

  // --- Hoja aparte "Revisiones" (Rev | Fecha | Responsable | Descripción) ---
  const revWs: any = {};
  const setCell = (r: number, c: number, v: string, s: any) => { revWs[C(r, c)] = { v, t: 's', s }; };
  setCell(0, 0, 'HISTORIAL DE REVISIONES', titleSt);
  ['Rev', 'Fecha', 'Responsable', 'Descripción del cambio'].forEach((h, i) => setCell(1, i, h, hdrSt));
  revs.forEach((rv, i) => {
    const r = i + 2;
    setCell(r, 0, rv.rev, ctrSt);
    setCell(r, 1, rv.date, ctrSt);
    setCell(r, 2, rv.responsible || '-', ctrSt);
    setCell(r, 3, rv.description, bodySt);
  });
  const lastRow = revs.length + 1;
  revWs['!ref'] = `A1:D${lastRow + 1}`;
  revWs['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 20 }, { wch: 80 }];
  revWs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  XLSX.utils.book_append_sheet(wb, revWs, 'Revisiones');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  writeFileSync(DEST[k], Buffer.from(buf));
  const ops = doc?.operations?.length ?? 0;
  console.info(`OK AMFE ${k} | ops=${ops} | revs=${revs.length} | sheets=${wb.SheetNames.join(',')} -> ${DEST[k]}`);
}
console.info('DONE');
