/**
 * AMFE 158 (INSERT) — la operacion de inyeccion pasa a numerarse `70-71`.
 *
 * El flujograma 154 Rev.B separa 70 INYECCION DE PIEZAS PLASTICAS y 71 CONTROL DE PIEZA
 * INYECTADA. En el AMFE el control ya estaba adentro de la OP 70 (su log de revisiones del
 * 20/08 dice "SE AGREGA CONTROL DE PIEZA INYECTADA (WE MEASUREMENT: BALANZA/CALIBRE Y PIEZA
 * PATRON) EN LA OP 70"), asi que no hace falta partir el contenido en dos.
 *
 * Fak, 08/09/2026: "lo del 71 no me importa en el AMFE, pone 70-71 y listo, es re facil de
 * corregir eso, no te preocupes". La fila queda cubriendo las dos operaciones del flujograma.
 *
 * Uso:  node scripts/_amfeInsert7071.mjs            (dry-run)
 *       node scripts/_amfeInsert7071.mjs --apply
 */
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, logChange, finish } from './_lib/dryRunGuard.mjs';

const NUEVO_NUMERO = '70-71';
const NUEVO_NOMBRE = 'INYECCION DE PIEZAS PLASTICAS Y CONTROL DE PIEZA INYECTADA';

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

const op = (doc.operations || []).find((o) => String(o.opNumber) === '70');
if (!op) throw new Error('No encontre la OP 70 en el AMFE');

const nombreViejo = String(op.name ?? op.operationName);
op.opNumber = NUEVO_NUMERO;
op.operationNumber = NUEVO_NUMERO;
op.name = NUEVO_NOMBRE;
op.operationName = NUEVO_NOMBRE;
logChange(apply, `OP 70 -> ${NUEVO_NUMERO}`, `${nombreViejo}  ->  ${NUEVO_NOMBRE}`);

doc.revisions = Array.isArray(doc.revisions) ? doc.revisions : [];
doc.revisions.push({
    rev: 'A',
    date: '08/09/2026',
    item: NUEVO_NUMERO,
    details: 'LA OPERACION DE INYECCION PASA A NUMERARSE 70-71: CUBRE LA INYECCION Y EL CONTROL DE LA PIEZA INYECTADA, QUE EL FLUJOGRAMA DIBUJA COMO DOS PASOS.',
    pswDate: '',
    modifiedBy: 'FS',
});
doc.header = doc.header || {};
doc.header.revDate = '08/09/2026';

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
