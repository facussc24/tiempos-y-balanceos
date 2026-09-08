/**
 * AMFE 158 (INSERT) — renumera las operaciones contra el flujograma 154 Rev.B.
 *
 * Fak, 08/09/2026: "dentro del mismo sector intentemos mantenernos en el mismo decimal".
 * El flujograma 154 Rev.B (emitido ese dia) agrupo la mesa de corte en la decena 20 y mando
 * el reproceso de adhesivado a la decena de su sector. El orden APQP es flujograma -> AMFE ->
 * Plan de Control, asi que el que se alinea es el AMFE.
 *
 *   15 PREPARACION DE CORTE         -> 20
 *   20 CORTE DE COMPONENTES         -> 21
 *   25 CONTROL CON MYLAR            -> 22
 *   103 REPROCESO FALTA DE ADHESIVO -> 93
 *
 * SOLO cambia el NUMERO. No toca contenido, ni S/O/D, ni caracteristicas especiales.
 * Chequeos previos hechos el 08/09/2026 (memoria `renumerar_sin_leer_contenido`):
 *   - `_auditWePlaceholdersAndAllocation.mjs`: AMFE-INS-PAT sin hallazgos (0 CRITICAL).
 *   - Contenido de las 4 operaciones leido WE por WE: coherente con su nombre.
 *   - Ningun texto del documento nombra los numeros viejos, y `linkedPfdStepId` esta vacio.
 *
 * Uso:  node scripts/_renumerarAmfeInsert.mjs            (dry-run)
 *       node scripts/_renumerarAmfeInsert.mjs --apply
 */
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, logChange, finish } from './_lib/dryRunGuard.mjs';

const MAPA = { 15: '20', 20: '21', 25: '22', 103: '93' };

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const { data: rows, error } = await sb
    .from('amfe_documents')
    .select('id, amfe_number, project_name')
    .eq('amfe_number', 'AMFE-INS-PAT');
if (error) throw error;
if (rows.length !== 1) throw new Error(`Esperaba 1 AMFE-INS-PAT, encontre ${rows.length}`);

const row = rows[0];
const { doc } = await readAmfe(sb, row.id);
const antes = JSON.parse(JSON.stringify(doc));

// Se resuelve todo el mapa de una, contra los numeros ORIGINALES: si se aplicara uno por uno,
// el 15 -> 20 pisaria al 20 antes de que este pase a 21.
const originales = (doc.operations || []).map((op) => String(op.opNumber ?? op.operationNumber));
const destinos = originales.map((n) => MAPA[n] ?? n);

const repetidos = destinos.filter((n, i) => destinos.indexOf(n) !== i);
if (repetidos.length) {
    throw new Error(`La renumeracion generaria colisiones: ${[...new Set(repetidos)].join(', ')}`);
}

const faltantes = Object.keys(MAPA).filter((n) => !originales.includes(n));
if (faltantes.length) throw new Error(`El AMFE no tiene las operaciones ${faltantes.join(', ')}`);

(doc.operations || []).forEach((op, i) => {
    if (destinos[i] === originales[i]) return;
    op.opNumber = destinos[i];
    op.operationNumber = destinos[i];
    logChange(apply, `OP ${originales[i]} -> ${destinos[i]}`, String(op.name ?? op.operationName));
});

// El orden del array es el que ve la app y el que sale al export: tiene que quedar ascendente.
doc.operations.sort((a, b) => Number(a.opNumber) - Number(b.opNumber));
console.log(`\nsecuencia final: ${doc.operations.map((o) => o.opNumber).join(' ')}`);

await runWithValidation(
    [{ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before: antes, after: doc }],
    apply,
    async () => {
        await saveAmfe(sb, row.id, doc, { expectedAmfeNumber: row.amfe_number });
        console.log('   escrito AMFE-INS-PAT');
    },
);

finish(apply);
