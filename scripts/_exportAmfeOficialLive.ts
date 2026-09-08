/**
 * _exportAmfeOficialLive.ts — Excel oficial (formulario I-AC-005.3) de UN AMFE, leido de
 * Supabase LIVE. Caratula (con la tabla de REVISIONES) + hoja AMFE, via
 * `buildAmfeOficialWorkbook` (skill `amfe-export-oficial`).
 *
 * A diferencia de `_exportOficial.ts` (que era de los 159/160 y leia un archivo persistido del
 * MCP), este toma la clave del AMFE y va a la base: el estado actual de un documento APQP se
 * afirma solo contra live (regla `verify-supabase-live.md`).
 *
 * `buildAmfeOficialWorkbook` aborta si alguna causa tiene S/O/D vacio, asi que un AMFE
 * incompleto no llega nunca al pendrive ni al cliente.
 *
 * Uso:  npx tsx scripts/_exportAmfeOficialLive.ts <amfe_number> [carpeta destino]
 *       npx tsx scripts/_exportAmfeOficialLive.ts AMFE-INS-PAT "C:/tmp"
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import XLSX from 'xlsx-js-style';
import { buildAmfeOficialWorkbook } from '../modules/amfe/amfeExcelExport';
import type { AmfeLifecycleStatus } from '../modules/amfe/amfeCaratulaSheet';
// @ts-expect-error — helper .mjs sin tipos, es el unico acceso a Supabase de los scripts
import { connectSupabase, readAmfe } from './_lib/amfeIo.mjs';

const CLAVE = process.argv[2];
const DEST_DIR = process.argv[3] || 'tools/flowchart/.build';
if (!CLAVE) {
    console.error('Uso: npx tsx scripts/_exportAmfeOficialLive.ts <amfe_number> [carpeta]');
    process.exit(1);
}

const sb = await connectSupabase();
const { data: rows, error } = await sb
    .from('amfe_documents')
    .select('id, amfe_number, project_name, status, updated_at')
    .eq('amfe_number', CLAVE);
if (error) throw error;
if (!rows?.length) { console.error(`No existe el AMFE ${CLAVE}`); process.exit(1); }
if (rows.length > 1) { console.error(`Hay ${rows.length} documentos con clave ${CLAVE}`); process.exit(1); }

const row = rows[0];
const { doc } = await readAmfe(sb, row.id);

// El numero que va en el nombre del archivo es el de la EMPRESA (header.amfeNumber), no la
// clave interna de la app: son distintos (memoria `amfes_patagonia_numeracion_y_destinos`).
const numeroEmpresa = String(doc?.header?.amfeNumber || CLAVE);
const rev = String(doc?.header?.revision || doc?.header?.revisionLevel || doc?.header?.rev || '');

let wb: XLSX.WorkBook;
try {
    wb = buildAmfeOficialWorkbook(doc, {
        revisions: doc?.revisions,
        status: (row.status ?? 'draft') as AmfeLifecycleStatus,
    });
} catch (e) {
    console.error(`ABORTADO ${CLAVE}: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
}

mkdirSync(DEST_DIR, { recursive: true });
const dest = `${DEST_DIR}/AMFE DE PROCESO N ${numeroEmpresa}${rev ? ` - REV ${rev}` : ''}.xlsx`;
const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
writeFileSync(dest, Buffer.from(buf));

const ops = (doc.operations || []).length;
console.info(`OK ${CLAVE} (Nº empresa ${numeroEmpresa}) · rev ${rev} · ${ops} operaciones`);
console.info(`   hojas: ${wb.SheetNames.join(', ')}`);
console.info(`   live updated_at: ${row.updated_at}`);
console.info(`   -> ${dest}`);
