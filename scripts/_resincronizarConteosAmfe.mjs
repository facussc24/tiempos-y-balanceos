/**
 * _resincronizarConteosAmfe.mjs — pone `operation_count` y `cause_count` de cada fila de
 * `amfe_documents` de acuerdo con lo que realmente tiene el documento.
 *
 * POR QUE HACIA FALTA
 * Esas dos columnas son DERIVADAS del JSON, pero ningun camino de escritura las mantenia:
 * ni `saveAmfe()` ni los scripts que hacen `.update()` crudo. Quedaban con el valor de la
 * primera carga. Lo encontro el agente auditor el 31/08/2026, despues de podar 6 causas en
 * cada apoyacabezas: `cause_count` seguia diciendo 184/178/175 cuando el real era
 * 178/172/169. En la misma pasada apareció que **dos documentos que esa tanda no habia
 * tocado tambien estaban desfasados** — el 150 (106 contra 110) y el Top Roll (184 contra
 * 155, 29 de diferencia) —, o sea que el agujero venia de antes y de cualquier script.
 *
 * La causa de raiz ya esta tapada: `saveAmfe()` los calcula y los escribe en cada guardado.
 * Este script es para lo que quedo desfasado de antes, y para volver a correrlo si algun
 * `.update()` crudo se saltea el helper.
 *
 * No hay nada que inventar: el numero se cuenta del propio documento con `countAmfeStats()`.
 * Toca METADATA, no `amfe_documents.data`, asi que no pasa por `runWithValidation()` (mismo
 * criterio que `_importListadoMaestro.mjs`). Igual va con dry-run.
 *
 * Uso:  node scripts/_resincronizarConteosAmfe.mjs            (dry-run: la tabla de desvios)
 *       node scripts/_resincronizarConteosAmfe.mjs --apply
 */
import { connectSupabase, parseData, countAmfeStats } from './_lib/amfeIo.mjs';
import { parseSafeArgs } from './_lib/dryRunGuard.mjs';

const { apply: APLICAR } = parseSafeArgs();

const sb = await connectSupabase();
const { data: filas, error } = await sb.from('amfe_documents')
    .select('id, amfe_number, operation_count, cause_count, data');
if (error) { console.error(error.message); process.exit(1); }

const desfasados = [];
for (const row of filas) {
    const doc = parseData(row.data);
    if (!doc || !Array.isArray(doc.operations)) {
        console.error(`${row.amfe_number}: data no parseable — se saltea, no se toca`);
        continue;
    }
    const st = countAmfeStats(doc);
    const opOk = Number(row.operation_count) === st.opCount;
    const cOk = Number(row.cause_count) === st.causeCount;
    if (opOk && cOk) continue;
    desfasados.push({
        id: row.id, amfeNumber: row.amfe_number,
        opCol: row.operation_count, opReal: st.opCount,
        cCol: row.cause_count, cReal: st.causeCount,
    });
}

if (!desfasados.length) {
    console.log('Los conteos de las filas coinciden con el documento. Nada que hacer.');
    process.exit(0);
}

console.log(`\n${desfasados.length} fila(s) con los conteos desfasados:\n`);
console.log('amfe_number          | operation_count | cause_count');
for (const d of desfasados) {
    const op = d.opCol === d.opReal ? `${d.opReal} (ok)` : `${d.opCol} -> ${d.opReal}`;
    const c = d.cCol === d.cReal ? `${d.cReal} (ok)` : `${d.cCol} -> ${d.cReal}`;
    console.log(`${String(d.amfeNumber).padEnd(21)}| ${op.padEnd(15)} | ${c}`);
}

if (!APLICAR) {
    console.log('\nDRY-RUN. Agrega --apply para escribir.');
    process.exit(0);
}

let ok = 0;
for (const d of desfasados) {
    const { error: e } = await sb.from('amfe_documents')
        .update({ operation_count: d.opReal, cause_count: d.cReal }).eq('id', d.id);
    if (e) { console.error(`${d.amfeNumber}: ${e.message}`); process.exit(1); }
    // Releer: el conteo se verifica contra la fila, no contra el resultado del update.
    const { data: chk } = await sb.from('amfe_documents')
        .select('operation_count, cause_count').eq('id', d.id).single();
    if (Number(chk.operation_count) !== d.opReal || Number(chk.cause_count) !== d.cReal) {
        console.error(`${d.amfeNumber}: quedo en ${chk.operation_count}/${chk.cause_count} y esperaba ${d.opReal}/${d.cReal}`);
        process.exit(1);
    }
    console.log(`  ${String(d.amfeNumber).padEnd(21)} OK — ${d.opReal} operaciones, ${d.cReal} causas`);
    ok++;
}
console.log(`\n=== RESINCRONIZADAS ${ok}/${desfasados.length} ===`);
