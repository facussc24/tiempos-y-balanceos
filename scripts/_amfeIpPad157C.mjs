/**
 * AMFE 149 (IP PAD, VWA-PAT-IPPADS-001) alineado al flujograma 157 Rev.C.
 *
 * El 157 Rev.B tenia un nodo por cada pestaña de la HO-985 (inyeccion 20 a 26, corte 30 a 38) y
 * el AMFE lo seguia con filas-rango ("OP 20-26 ...", "OP 30-37 ...", 38). La Rev.C dibuja cada
 * sector con el bloque de los hermanos 153 y 154: 20 INYECCION DE PIEZAS PLASTICAS, 21 CONTROL DE
 * PIEZA INYECTADA, 30 PREPARACION Y CARGA DE VINILO, 31 CORTE AUTOMATICO DE COMPONENTES y 32
 * CONTROL CON MYLAR. Pedido de Fak del 06/10/2026 al revisar el dibujo: "no esta muy unificado el
 * tema de inyeccion plastica y de corte, creo que es el IP que tiene eso muy largo".
 *
 * No se parte ni se reescribe contenido: las filas quedan cubriendo los pasos del flujograma,
 * igual que la 70-71 del AMFE del Insert (`_amfeInsert7071.mjs`, Fak 08/09/2026).
 *
 * Uso:  node scripts/_amfeIpPad157C.mjs            (dry-run)
 *       node scripts/_amfeIpPad157C.mjs --apply
 */
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, logChange, finish } from './_lib/dryRunGuard.mjs';

const NUMERO = 'VWA-PAT-IPPADS-001';
const FECHA = '06/10/2026';
// numero viejo -> [numero nuevo, nombre nuevo]
const CAMBIOS = {
    '20': ['20-21', 'INYECCION DE PIEZAS PLASTICAS Y CONTROL DE PIEZA INYECTADA'],
    '30': ['30-31', 'PREPARACION Y CARGA DE VINILO Y CORTE AUTOMATICO DE COMPONENTES'],
    '38': ['32', 'CONTROL CON MYLAR'],
};

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const { data: rows, error } = await sb
    .from('amfe_documents')
    .select('id, amfe_number, project_name')
    .eq('amfe_number', NUMERO);
if (error) throw error;
if (rows.length !== 1) throw new Error(`Esperaba 1 ${NUMERO}, encontre ${rows.length}`);

const row = rows[0];
const { doc } = await readAmfe(sb, row.id);
const antes = JSON.parse(JSON.stringify(doc));

if ((doc.operations || []).some((o) => String(o.opNumber) === '20-21')) {
    console.log('El AMFE ya tiene la fila 20-21: no hay nada que hacer.');
    process.exit(0);
}

for (const [viejo, [nuevo, nombre]] of Object.entries(CAMBIOS)) {
    const op = (doc.operations || []).find((o) => String(o.opNumber) === viejo);
    if (!op) throw new Error(`No encontre la OP ${viejo} en el AMFE`);
    const nombreViejo = String(op.name ?? op.operationName);
    op.opNumber = nuevo;
    op.operationNumber = nuevo;
    op.name = nombre;
    op.operationName = nombre;
    logChange(apply, `OP ${viejo} -> ${nuevo}`, `${nombreViejo}  ->  ${nombre}`);
}

// La inyeccion cita su control por numero ("Control en OP 22..."): el control de pieza inyectada es
// la 21 en la Rev.C. Se corrige ESA cita, y solo si es la unica (mostrada a Fak el 06/10/2026).
const VIEJA = 'Control en OP 22 con calibre y pieza patron';
let corregidas = 0;
for (const we of doc.operations.find((o) => String(o.opNumber) === '20-21').workElements || []) {
    for (const fn of we.functions || []) for (const fm of fn.failures || []) for (const c of fm.causes || []) {
        if (c.detectionControl === VIEJA) {
            c.detectionControl = VIEJA.replace('OP 22', 'OP 21');
            corregidas++;
        }
    }
}
if (corregidas !== 1) throw new Error(`Esperaba 1 control que cite "OP 22" en la inyeccion y encontre ${corregidas}`);
logChange(apply, 'OP 20-21, control de deteccion', `${VIEJA}  ->  ${VIEJA.replace('OP 22', 'OP 21')}`);

// Un texto que cite por numero una de las operaciones que se renumeran quedaria apuntando a otra:
// se listan para mirarlos, no se reescriben solos.
const citas = [];
const re = /\bOP\.?\s*(2[1-6]|3[1-8])\b/i;
(function barrer(o, ruta) {
    if (typeof o === 'string') {
        if (re.test(o)) citas.push(`${ruta}: ${o.slice(0, 140)}`);
    } else if (Array.isArray(o)) {
        o.forEach((x, i) => barrer(x, `${ruta}[${i}]`));
    } else if (o && typeof o === 'object') {
        for (const [k, v] of Object.entries(o)) {
            if (k !== 'revisions' && k !== 'name' && k !== 'operationName') barrer(v, `${ruta}.${k}`);
        }
    }
})(doc.operations, 'operations');
console.log(`\ntextos que citan por numero una operacion renumerada: ${citas.length}`);
citas.forEach((c) => console.log('   ' + c));

doc.revisions = Array.isArray(doc.revisions) ? doc.revisions : [];
doc.revisions.push({
    rev: 'A',
    date: FECHA,
    item: '20-21, 30-31, 32',
    details: 'SE ALINEA CON EL FLUJOGRAMA 157 REV. C: LA INYECCION PASA A NUMERARSE 20-21 (INYECCION Y CONTROL DE PIEZA INYECTADA), EL CORTE 30-31 (PREPARACION Y CORTE AUTOMATICO) Y EL CONTROL CON MYLAR PASA DE 38 A 32.',
    pswDate: '',
    modifiedBy: 'FS',
});
doc.header = doc.header || {};
doc.header.revDate = FECHA;

console.log(`\nsecuencia final: ${doc.operations.map((o) => o.opNumber).join(' ')}`);

await runWithValidation(
    [{ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before: antes, after: doc }],
    apply,
    async () => {
        await saveAmfe(sb, row.id, doc, { expectedAmfeNumber: row.amfe_number });
        console.log(`   escrito ${NUMERO}`);
    },
);

finish(apply);
