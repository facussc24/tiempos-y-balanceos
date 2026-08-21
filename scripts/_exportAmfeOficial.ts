/**
 * _exportAmfeOficial.ts — Excel oficial (formulario I-AC-005.3) de CUALQUIER AMFE.
 *
 * Generalizacion de `_exportAmfe150.ts`, que servia solo para el AMFE 150. Misma logica:
 * lee Supabase LIVE (regla verify-supabase-live), usa `buildAmfeOficialWorkbook`
 * (Caratula con tabla de REVISIONES + hoja AMFE) y renumera los modos de falla 1..N por
 * operacion SOLO en la copia que se exporta (skill amfe-export-oficial §3).
 *
 * Agrega dos cosas que faltaron el 14/08 y costaron un PDF verificado que era el viejo:
 *   1. BORRA el archivo destino antes de generar. Si la generacion falla tiene que FALTAR
 *      el archivo, no sobrevivir el de la corrida anterior.
 *   2. Re-lee el archivo escrito y verifica tamaño y hojas. El destino puede estar tomado
 *      por Excel o por OneDrive y `writeFileSync` no lanza.
 *
 * Correr:  npx tsx scripts/_exportAmfeOficial.ts --amfe <numero> --out <carpeta> [--nombre <archivo.xlsx>]
 * Ej:      npx tsx scripts/_exportAmfeOficial.ts --amfe AMFE-HF-PAT --out tmp/export-amfe
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx-js-style';
import { buildAmfeOficialWorkbook } from '../modules/amfe/amfeExcelExport';
import { scanRevisionMeta } from './_lib/forbiddenContent.mjs';
import type { AmfeLifecycleStatus } from '../modules/amfe/amfeCaratulaSheet';

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const AMFE_NUMBER = arg('amfe');
if (!AMFE_NUMBER) {
  console.error('Falta --amfe <numero>. Ej: --amfe AMFE-HF-PAT');
  process.exit(1);
}
// El repo es publico: la carpeta de destino se pasa por argumento, no se hardcodea.
const destDir = arg('out') ?? 'tmp/export-amfe';

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
  .select('amfe_number, project_name, data, revisions, status')
  .eq('amfe_number', AMFE_NUMBER);
if (error) { console.error(error.message); process.exit(1); }
if (!rows || rows.length !== 1) { console.error(`Esperaba 1 fila para ${AMFE_NUMBER}, hay ${rows?.length}`); process.exit(1); }

const row = rows[0] as {
  amfe_number: string; project_name: string; data: string | object;
  revisions: unknown; status?: string;
};
const doc = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;

// GATE — el log de REVISIONES no puede hablar del REDACTOR (Fak, 20/08/2026).
// La caratula del AMFE lleva la tabla de revisiones y la lee el cliente y la auditoria: ahi
// va que cambio del PROCESO, nunca una correccion de redaccion propia ("se reescriben en
// espanol los terminos en ingles"), de donde se copio el contenido, ni notas internas.
// Fak: *"parece una burla... esas cosas se ocultan, nunca tuvieron que haber estado en
// ingles"*. Se corta ACA porque el export es el unico camino de un AMFE al cliente.
const revisionesRaw = typeof row.revisions === 'string'
  ? JSON.parse(row.revisions || '[]') : (row.revisions ?? []);
const sospechosas = (revisionesRaw as Array<Record<string, string>>)
  .map((r, i) => ({ i, texto: r.details ?? r.description ?? '', hits: scanRevisionMeta(r.details ?? r.description ?? '') }))
  .filter(x => x.hits.length > 0);
if (sospechosas.length) {
  console.error(`\nABORTADO — el log de revisiones de ${AMFE_NUMBER} habla del redactor, no de la pieza:\n`);
  for (const s of sospechosas) {
    console.error(`  [${s.i}] "${s.texto}"`);
    console.error(`       detectado: ${s.hits.map(h => h.match).join(', ')}`);
  }
  console.error('\nUna correccion de redaccion/idioma/estilo NO es una revision del AMFE: se aplica');
  console.error('en silencio. Sacala del log (scripts/_limpiarRevisionesMeta.mjs) y volve a exportar.\n');
  process.exit(1);
}

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

mkdirSync(destDir, { recursive: true });
const nombre = arg('nombre') ?? `AMFE ${row.amfe_number}.xlsx`;
const dest = `${destDir}/${nombre}`;

// 1. Borrar ANTES de intentar generar, no despues. Si la generacion falla (el caso mas
// comun es `assertAmfeExportable` abortando por un S/O/D vacio), el archivo tiene que
// FALTAR, no sobrevivir el de la corrida anterior — que es como el 14/08 se dio por bueno
// un PDF viejo. Si el borrado no se puede hacer, se aborta: seguir dejaria el viejo igual.
if (existsSync(dest)) {
  try {
    rmSync(dest);
  } catch (e) {
    console.error(
      `ABORTADO: no se pudo borrar ${dest} antes de regenerarlo `
      + `(¿abierto en Excel o tomado por OneDrive?): ${e instanceof Error ? e.message : String(e)}`,
    );
    process.exit(1);
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

try {
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  writeFileSync(dest, Buffer.from(buf));
} catch (e) {
  console.error(`ABORTADO: no se pudo escribir ${dest}: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}

// 2. Re-leer lo escrito. El destino puede estar tomado y writeFileSync no lanza.
if (!existsSync(dest)) { console.error(`FALLO: no se escribio ${dest}`); process.exit(1); }
const bytes = statSync(dest).size;
if (bytes < 10_000) { console.error(`FALLO: ${dest} pesa ${bytes} bytes, sospechosamente poco`); process.exit(1); }
const releido = XLSX.read(readFileSync(dest), { type: 'buffer' });
if (releido.SheetNames.length !== wb.SheetNames.length) {
  console.error(`FALLO: releido tiene hojas [${releido.SheetNames}] y se esperaba [${wb.SheetNames}]`);
  process.exit(1);
}

console.info(
  `OK ${row.amfe_number} (${row.project_name}) | rev ${doc?.header?.rev ?? doc?.header?.revisionLevel} `
  + `| ops ${doc.operations.length} | FM ${renumerados} | hojas ${releido.SheetNames.join(',')} | ${bytes} bytes`
);
console.info('->', dest);
