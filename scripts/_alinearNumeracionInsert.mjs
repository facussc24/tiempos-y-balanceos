/**
 * _alinearNumeracionInsert.mjs — la recepcion del AMFE del Insert pasa de 5 a 10.
 *
 * POR QUE SOLO ESTA
 * Regla de la casa: la numeracion la manda el FLUJOGRAMA (orden APQP flujograma -> AMFE ->
 * Plan de Control). Cuando dos documentos coinciden y uno difiere, se corrige el que
 * difiere.
 *
 *   Flujograma del Insert (FLUJOGRAMA_154_INSERT PAT_REV.A.vsdx, Rev A del 12/11/2025):
 *       10 Recepcion de materia prima
 *   Plan de Control (CP-INSERT-001 Rev 1):
 *       10 Recepcion
 *   AMFE en la app:
 *        5 RECEPCION DE MATERIA PRIMA        <- el unico que dice 5
 *
 * El resto de las operaciones del Insert (15, 20, 25, 50, 60, 70, 90, 91, 103, 110, 120) ya
 * coincide con el flujograma, asi que no se toca nada mas.
 *
 * El 5 probablemente se copio del Top Roll, que si arranca en 5 en su flujograma.
 *
 * NO SE RENUMERA EL TOP ROLL en este script, aunque este corrido un escalon entero
 * (AMFE 10/20/30... contra flujograma 5/10/20...). Motivo: su flujograma vigente **no
 * numera** el control final ("Inspeccion Final" aparece sin numero) y le falta el 11.
 * Alinear el AMFE contra un flujograma incompleto seria alinearlo contra algo roto. Primero
 * el flujograma pasa a Rev. 02, despues se alinea el AMFE.
 *
 * Se cambia SOLO el numero. El contenido de la operacion (work elements, fallas, causas)
 * queda intacto: se verifico que la operacion 5 del AMFE y la 10 del flujograma son la
 * misma cosa por CONTENIDO, no por posicion (regla `renumerar_sin_leer_contenido`).
 *
 * Uso:  node scripts/_alinearNumeracionInsert.mjs           (dry-run)
 *       node scripts/_alinearNumeracionInsert.mjs --apply
 */

import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';
import { connectSupabase, parseData, saveAmfe, syncFieldAliases } from './_lib/amfeIo.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const { data: rows, error } = await sb
    .from('amfe_documents').select('id, amfe_number, data').eq('amfe_number', 'AMFE-INS-PAT').limit(1);
if (error) throw error;
const row = rows[0];
const before = parseData(row.data);
const doc = parseData(row.data);

const op = (doc.operations || []).find(
    o => /RECEPCION DE MATERIA PRIMA/i.test(o.name || o.operationName || ''));
if (!op) throw new Error('No se encontro la operacion de recepcion en el AMFE del Insert');

const numActual = op.opNumber || op.operationNumber || '(vacio)';
if (String(numActual) !== '5') {
    console.log(`La recepcion ya no esta en 5, esta en ${numActual}. No se toca.`);
    finish(apply);
    process.exit(0);
}

// Chequeo anti-colision: que no exista ya una operacion 10 en este AMFE.
const yaHay10 = (doc.operations || []).some(
    o => String(o.opNumber || o.operationNumber || '') === '10');
if (yaHay10) throw new Error('Ya existe una operacion 10 en el AMFE del Insert: colision, se aborta.');

op.opNumber = '10';
op.operationNumber = '10';
logChange(apply, `Insert: operacion "${op.name}"  ${numActual} -> 10  (flujograma Rev A y CP-INSERT-001 Rev 1 dicen 10)`, {});

syncFieldAliases(doc);

await runWithValidation(
    [{ id: row.id, amfeNumber: 'AMFE-INS-PAT', productName: 'INSERT', before, after: doc }],
    apply,
    async () => {
        await saveAmfe(sb, row.id, doc);
        const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', row.id).single();
        const live = parseData(chk.data);
        const opLive = (live.operations || []).find(
            o => /RECEPCION DE MATERIA PRIMA/i.test(o.name || o.operationName || ''));
        const n = opLive.opNumber || opLive.operationNumber;
        if (String(n) !== '10') throw new Error(`POST-CHECK: la recepcion quedo en ${n}, se esperaba 10`);
        const nums = (live.operations || []).map(o => String(o.opNumber || o.operationNumber || ''));
        const dup = nums.filter((v, i) => v && nums.indexOf(v) !== i);
        if (dup.length) throw new Error(`POST-CHECK: numeros de operacion duplicados: ${dup.join(', ')}`);
        console.log(`POST-CHECK live: recepcion = ${n}, sin numeros duplicados`);
    },
);

finish(apply);
