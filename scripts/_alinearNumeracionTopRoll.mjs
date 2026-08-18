/**
 * _alinearNumeracionTopRoll.mjs — el AMFE 162 se alinea con el flujograma 155 Rev. B.
 *
 * POR QUE AHORA Y NO ANTES
 * El AMFE del Top Roll estaba corrido UN ESCALON entero respecto del flujograma. No se
 * toco hasta hoy a proposito: el flujograma vigente estaba incompleto (no numeraba el
 * control final y le faltaba el almacenamiento WIP), y alinear contra un documento roto es
 * alinear contra nada. Con el flujograma 155 en Rev. B ya cerrado, se puede.
 *
 *      AMFE 162 (antes)   10  20  30  40  50  60  70  80  90 100
 *      flujograma 155      5  10  11  20  30  40  50  60  70  80  90
 *
 * El mapeo NO es "restar un escalon": el flujograma intercala el 11 (almacenamiento en
 * medios WIP), que en el AMFE no existe como operacion — y con razon, porque un
 * almacenamiento no lleva analisis de modos de falla (regla `amfe.md` §9: "Almacenamiento
 * WIP y transporte interno NO son operaciones de proceso con AMFE propio").
 *
 * Asi que se mapea POR CONTENIDO, operacion por operacion, leyendo el nombre de cada una:
 *
 *      RECEPCION DE MATERIA PRIMA        10 -> 5
 *      INYECCION DE PIEZA PLASTICA       20 -> 10
 *      ADHESIVADO HOT MELT               30 -> 20
 *      TERMOFORMADO                      40 -> 30    (el flujograma lo llama PROCESO DE IMG)
 *      CORTE FINAL                       50 -> 40    (flujograma: TRIMMING CORTE FINAL)
 *      PLEGADO DE BORDES                 60 -> 50    (flujograma: EDGE FOLDING)
 *      SOLDADURA DE REFUERZOS INTERNOS   70 -> 60
 *      SOLDADURA TWEETER                 80 -> 70
 *      CONTROL FINAL DE CALIDAD          90 -> 80
 *      EMBALAJE                         100 -> 90
 *
 * El 11 del flujograma queda sin contraparte en el AMFE, y esta bien que asi sea.
 *
 * ⚠️ El orden importa al escribir: si se renumera de menor a mayor, el 20->10 pisa al 10
 * que todavia no se movio. Se aplica de MAYOR a MENOR.
 *
 * Uso:  node scripts/_alinearNumeracionTopRoll.mjs           (dry-run)
 *       node scripts/_alinearNumeracionTopRoll.mjs --apply
 */

import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';
import { connectSupabase, parseData, saveAmfe, syncFieldAliases } from './_lib/amfeIo.mjs';

/** de -> a, identificado por el NOMBRE de la operacion (no por posicion). */
const MAPEO = [
    { re: /^RECEPCION DE MATERIA PRIMA$/i, de: '10', a: '5' },
    { re: /^INYECCI[OÓ]N DE PIEZA PL[AÁ]STICA$/i, de: '20', a: '10' },
    { re: /^ADHESIVADO HOT MELT$/i, de: '30', a: '20' },
    { re: /^TERMOFORMADO$/i, de: '40', a: '30' },
    { re: /^CORTE FINAL$/i, de: '50', a: '40' },
    { re: /^PLEGADO DE BORDES$/i, de: '60', a: '50' },
    { re: /^SOLDADURA DE REFUERZOS INTERNOS$/i, de: '70', a: '60' },
    { re: /^SOLDADURA TWEETER$/i, de: '80', a: '70' },
    { re: /^CONTROL FINAL DE CALIDAD$/i, de: '90', a: '80' },
    { re: /^EMBALAJE$/i, de: '100', a: '90' },
];

const num = (o) => String(o.opNumber ?? o.operationNumber ?? '').trim();
const nom = (o) => String(o.name ?? o.operationName ?? '').trim();

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const { data: rows, error } = await sb
    .from('amfe_documents').select('id, amfe_number, data').eq('amfe_number', 'AMFE-TR-PAT').limit(1);
if (error) throw error;
if (!rows.length) throw new Error('No encontre el AMFE del Top Roll.');
const row = rows[0];
const before = parseData(row.data);
const doc = parseData(row.data);

// Ubicar cada operacion por nombre y confirmar que esta donde el diagnostico dice.
const encontradas = MAPEO.map(m => {
    const op = (doc.operations || []).find(o => m.re.test(nom(o)));
    if (!op) throw new Error(`No encontre la operacion ${m.re}. Se aborta para no renumerar a ciegas.`);
    const actual = num(op);
    if (actual !== m.de) {
        throw new Error(`"${nom(op)}" esta en ${actual} y esperaba ${m.de}. Alguien ya la movio; se aborta.`);
    }
    return { op, ...m };
});

if (encontradas.length !== (doc.operations || []).length) {
    throw new Error(`El AMFE tiene ${doc.operations.length} operaciones y el mapeo cubre ${encontradas.length}. `
        + 'Alguna quedaria sin renumerar y colisionaria. Se aborta.');
}

// De MAYOR a MENOR: si se hace al reves, el 20->10 pisa al 10 sin mover.
for (const { op, de, a } of [...encontradas].sort((x, y) => Number(y.de) - Number(x.de))) {
    op.opNumber = a;
    op.operationNumber = a;
    logChange(apply, `${nom(op).padEnd(34)} ${de.padStart(3)} -> ${a}`, {});
}

doc.operations.sort((x, y) => Number(num(x) || 0) - Number(num(y) || 0));
console.log(`\n   secuencia final del AMFE: ${doc.operations.map(num).join(' · ')}`);
console.log(`   flujograma 155 Rev.B:     5 · 10 · 11 · 20 · 30 · 40 · 50 · 60 · 70 · 80 · 90`);
console.log(`   (el 11 es el almacenamiento en medios WIP: no lleva AMFE propio, regla amfe.md §9)\n`);

syncFieldAliases(doc);

await runWithValidation(
    [{ id: row.id, amfeNumber: 'AMFE-TR-PAT', productName: 'TOP ROLL', before, after: doc }],
    apply,
    async () => {
        await saveAmfe(sb, row.id, doc);
        const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', row.id).single();
        const live = parseData(chk.data);
        const nums = (live.operations || []).map(num).filter(Boolean);
        const esperado = ['5', '10', '20', '30', '40', '50', '60', '70', '80', '90'];
        if (nums.join(',') !== esperado.join(',')) {
            throw new Error(`POST-CHECK: quedo ${nums.join(',')} y esperaba ${esperado.join(',')}`);
        }
        const dup = nums.filter((v, i) => nums.indexOf(v) !== i);
        if (dup.length) throw new Error(`POST-CHECK: numeros duplicados ${dup.join(', ')}`);
        console.log(`POST-CHECK live: ${nums.join(' · ')} — sin duplicados`);
    },
);

finish(apply);
