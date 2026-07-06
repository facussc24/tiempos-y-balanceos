/**
 * _exportAmfeAmarok.ts — Excel oficial de AMFE 128/129 (IP Decorative Amarok PA2) al pendrive D:\.
 * Lee data + revisions + status desde Supabase (service key) y usa buildAmfeOficialWorkbook,
 * que genera Caratula (formulario I-AC-005.3) + AMFE. El guard de S/O/D vive dentro.
 * Correr: SUPABASE_SERVICE_ROLE_KEY=... VITE_SUPABASE_URL=... npx tsx scripts/_exportAmfeAmarok.ts
 */
import { writeFileSync } from 'node:fs';
import XLSX from 'xlsx-js-style';
import { createClient } from '@supabase/supabase-js';
import { buildAmfeOficialWorkbook } from '../modules/amfe/amfeExcelExport';
import type { AmfeLifecycleStatus } from '../modules/amfe/amfeCaratulaSheet';

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const DEST: Record<string, string> = {
  '128': 'D:/AMFE 128 - IP DECORATIVE 115 AMAROK PA2 - REV G.xlsx',
  '129': 'D:/AMFE 129 - IP DECORATIVE 116 AMAROK PA2 - REV G.xlsx',
};

for (const k of ['128', '129']) {
  const { data: row, error } = await sb.from('amfe_documents').select('amfe_number,data,revisions,status').eq('amfe_number', k).single();
  if (error || !row) { console.error(`FETCH ${k} FALLO:`, error?.message); continue; }
  const doc = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;

  let wb: XLSX.WorkBook;
  try {
    // buildAmfeOficialWorkbook aborta (throw) si alguna causa tiene S/O/D vacío.
    wb = buildAmfeOficialWorkbook(doc, { revisions: row.revisions, status: row.status as AmfeLifecycleStatus });
  } catch (e) {
    console.error(`ABORTADO AMFE ${k}: ${e instanceof Error ? e.message : String(e)}`);
    continue;
  }

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  writeFileSync(DEST[k], Buffer.from(buf));
  const ops = doc?.operations?.length ?? 0;
  console.info(`OK AMFE ${k} | ops=${ops} | sheets=${wb.SheetNames.join(',')} -> ${DEST[k]}`);
}
console.info('DONE');
