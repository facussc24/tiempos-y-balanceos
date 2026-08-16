/**
 * _exportAmfe150.ts — Excel oficial (formulario I-AC-005.3) del AMFE 150
 * APB TRASERO CENTRAL PATAGONIA (2HC.885.081 RL1), para pasar a Calidad.
 *
 * ⚠️ SUPERADO por `_exportAmfeOficial.ts` (16/08/2026), que hace lo mismo para cualquier
 * AMFE y ademas borra el destino ANTES de generar y re-lee lo escrito. Este archivo NO
 * tiene esas dos protecciones: si la generacion falla, deja en disco el .xlsx de la corrida
 * anterior y lo hace pasar por nuevo. Se conserva como registro de la entrega del 14/08.
 * Para exportar hoy:  npx tsx scripts/_exportAmfeOficial.ts --amfe 150 --out <carpeta>
 *
 * Lee Supabase LIVE (regla verify-supabase-live). Usa buildAmfeOficialWorkbook:
 * Caratula (con tabla de REVISIONES) + hoja AMFE. Renumera los modos de falla
 * 1..N por operacion SOLO en la copia que se exporta (skill amfe-export-oficial §3).
 *
 * Correr:  npx tsx scripts/_exportAmfe150.ts [carpeta_destino]
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx-js-style';
import { buildAmfeOficialWorkbook } from '../modules/amfe/amfeExcelExport';
import type { AmfeLifecycleStatus } from '../modules/amfe/amfeCaratulaSheet';

const AMFE_NUMBER = '150';
// El repo es publico: la carpeta de destino se pasa por argumento, no se hardcodea.
// Sin argumento escribe en tmp/ y despues se copia a mano al Escritorio o al legajo.
const destDir = process.argv[2] ?? 'tmp/export-amfe';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const auth = await sb.auth.signInWithPassword({
  email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (auth.error) { console.error('auth:', auth.error.message); process.exit(1); }

const { data: rows, error } = await sb
  .from('amfe_documents')
  .select('amfe_number, data, revisions, status')
  .eq('amfe_number', AMFE_NUMBER);
if (error) { console.error(error.message); process.exit(1); }
if (!rows || rows.length !== 1) { console.error(`Esperaba 1 fila, hay ${rows?.length}`); process.exit(1); }

const row = rows[0] as { amfe_number: string; data: string | object; revisions: unknown; status?: string };
const doc = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;

// Renumerar FM 1..N por operacion (orden WE -> funcion -> falla)
let renumerados = 0;
for (const op of doc.operations ?? []) {
  let seq = 0;
  for (const we of op.workElements ?? []) {
    for (const fn of we.functions ?? []) {
      for (const f of fn.failures ?? []) {
        seq++;
        const limpio = String(f.description ?? '').replace(/^\s*\d+\s*[-).]\s*/, '').trim();
        f.description = `${seq}- ${limpio}`;
        renumerados++;
      }
    }
  }
}

let wb: XLSX.WorkBook;
try {
  wb = buildAmfeOficialWorkbook(doc, {
    revisions: row.revisions as never,
    status: (row.status ?? 'draft') as AmfeLifecycleStatus,
  });
} catch (e) {
  console.error(`ABORTADO: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
const dest = `${destDir}/AMFE 150 - APB TRASERO CENTRAL - Rev.A - revision 14-08-2026.xlsx`;
const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
writeFileSync(dest, Buffer.from(buf));

const stats = { ops: doc.operations.length, fm: renumerados };
console.info(`OK AMFE ${row.amfe_number} | rev ${doc?.header?.rev ?? doc?.header?.revisionLevel} | ops ${stats.ops} | FM ${stats.fm} | hojas ${wb.SheetNames.join(',')}`);
console.info('->', dest);
