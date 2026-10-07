/**
 * _alinearAmfes0710.mjs — cierra las divergencias de numeracion AMFE vs flujograma que marca
 * _verificarNumeracion.mjs el 07/10/2026. Pedido y OK de Fak ese dia: "completa todo lo que falte...
 * alineemos todo" y "obviamente lo autorizo".
 *
 *   node scripts/_alinearAmfes0710.mjs            # dry-run
 *   node scripts/_alinearAmfes0710.mjs --apply    # escribe (runWithValidation)
 *
 * 1. APOYACABEZAS TRASEROS (AMFE-HRC-PAT 153 y AMFE-HRO-PAT 155): el flujograma 152 Rev.B y las hojas
 *    HO-969 / HO-970 (pestañas 42, 50 y 51) tienen 42 COLOCACION DE PRECINTO, 50 COLOCACION DE BOLSA Y
 *    CARGA EN EL MOLDE y 51 CIERRE DEL MOLDE Y COLOCACION DE BOQUILLA; los AMFE traseros no. Se copian del
 *    AMFE del delantero (AMFE-HF-PAT 151): mismo puesto y mismo molde de PU, mismas fallas y S/O/D. Solo
 *    cambia la HO citada en los textos (HO-968 -> HO-969 o HO-970). Van despues de la 41.
 * 2. IP PAD (VWA-PAT-IPPADS-001, 149): el flujograma 157 Rev.C tiene 90 ALINEACION DE COSTURA (PRE-FIXING)
 *    y 91 TAPIZADO Y FIJADO SUPERIOR; el AMFE tiene una fila 90 "ALINEACION DE COSTURA (PRE-FIXING,
 *    FIJADO INFERIOR Y SUPERIOR)" que cubre los dos pasos. Se numera "90-91" (como el "70-71" del AMFE 158,
 *    Fak 08/09: "pone 70-71 y listo"); _verificarNumeracion.mjs expande el rango.
 *
 * Idempotente: si ya esta hecho, no hace nada en ese AMFE.
 */
import { randomUUID } from 'crypto';
import { connectSupabase, listAmfes, readAmfe, saveAmfe, findOperation, syncLegacyFmFields, syncFieldAliases } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const FECHA = '07/10/2026';
const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const todos = await listAmfes(sb);
const idDe = n => {
    const f = todos.filter(a => a.amfe_number === n);
    if (f.length !== 1) throw new Error(`${n}: esperaba 1 documento y hay ${f.length}`);
    return f[0].id;
};
const num = o => String(o.opNumber ?? o.operationNumber);
const nuevosIds = obj => {
    if (Array.isArray(obj)) return obj.map(nuevosIds);
    if (obj && typeof obj === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(obj)) out[k] = k === 'id' ? randomUUID() : nuevosIds(v);
        return out;
    }
    return obj;
};
const cambiarTexto = (obj, de, a) => JSON.parse(JSON.stringify(obj).split(de).join(a));
const plan = [];

// 1. traseros
const { doc: del } = await readAmfe(sb, idDe('AMFE-HF-PAT'));
const modelo = ['42', '50', '51'].map(n => {
    const o = findOperation(del, n);
    if (!o) throw new Error(`el AMFE 151 no tiene la OP ${n}`);
    return o;
});
for (const [numero, ho, producto] of [['AMFE-HRC-PAT', 'HO-969', 'APC TRASERO CENTRAL'], ['AMFE-HRO-PAT', 'HO-970', 'APC TRASERO LATERAL']]) {
    const id = idDe(numero);
    const { doc: before } = await readAmfe(sb, id);
    if (findOperation(before, '42')) { console.log(`${numero}: ya tiene la 42, nada para hacer.`); continue; }
    const after = structuredClone(before);
    const varilla = findOperation(after, '41');
    if (!varilla || !findOperation(after, '52')) throw new Error(`${numero}: no encuentro la 41 o la 52`);
    const copias = modelo.map(o => cambiarTexto(nuevosIds(structuredClone(o)), 'HO-968', ho));
    for (const c of copias) {
        c.focusElementFunction = after.operations[0].focusElementFunction ?? c.focusElementFunction;
        c._copiadoDe = 'AMFE 151 (AMFE-HF-PAT) OP ' + num(c) + ', 07/10/2026';
    }
    after.operations.splice(after.operations.indexOf(varilla) + 1, 0, ...copias);
    after.revisions = Array.isArray(after.revisions) ? after.revisions : [];
    after.revisions.push({
        rev: 'A', date: FECHA, item: '42 / 50 / 51', modifiedBy: 'FS', pswDate: '',
        details: 'SE AGREGAN 42 COLOCACION DE PRECINTO CON PISTOLA ETIQUETADORA, 50 COLOCACION DE BOLSA Y CARGA DEL '
            + 'APOYACABEZAS EN EL MOLDE Y 51 CIERRE DEL MOLDE Y COLOCACION DE BOQUILLA, QUE ESTAN EN EL FLUJOGRAMA 152 '
            + 'REV.B Y EN LA ' + ho + ' (MISMO PUESTO Y MOLDE QUE EL APC DELANTERO, AMFE 151).',
    });
    after.header = after.header || {}; after.header.revDate = FECHA;
    syncLegacyFmFields(after); syncFieldAliases(after);
    console.log(`\n${numero} (${producto}): ${before.operations.map(num).join(' ')}\n   -> ${after.operations.map(num).join(' ')}`);
    for (const c of copias) {
        const causas = c.workElements.flatMap(w => w.functions).flatMap(f => f.failures).flatMap(f => f.causes);
        console.log(`   + ${num(c)} ${c.name ?? c.operationName} | ${causas.length} causas | ` +
            causas.map(x => `S${x.severity}O${x.occurrence}D${x.detection}${x.specialChar ? ' ' + x.specialChar : ''}`).join(', '));
    }
    plan.push({ id, amfeNumber: numero, productName: producto + ' Patagonia', before, after });
}

// 2. IP Pad
{
    const numero = 'VWA-PAT-IPPADS-001';
    const id = idDe(numero);
    const { doc: before } = await readAmfe(sb, id);
    if (findOperation(before, '90-91')) {
        console.log(`\n${numero}: ya esta 90-91, nada para hacer.`);
    } else {
        const after = structuredClone(before);
        const op = findOperation(after, '90');
        if (!op || !/ALINEACION DE COSTURA/i.test(op.name ?? op.operationName ?? '')) throw new Error('IP Pad: la 90 no es ALINEACION DE COSTURA');
        op.opNumber = op.operationNumber = '90-91';
        after.revisions = Array.isArray(after.revisions) ? after.revisions : [];
        after.revisions.push({
            rev: 'A', date: FECHA, item: '90-91', modifiedBy: 'FS', pswDate: '',
            details: 'LA OPERACION 90 ALINEACION DE COSTURA (PRE-FIXING, FIJADO INFERIOR Y SUPERIOR) SE NUMERA 90-91: CUBRE '
                + 'LOS PASOS 90 ALINEACION DE COSTURA Y 91 TAPIZADO Y FIJADO SUPERIOR DEL FLUJOGRAMA 157 REV.C.',
        });
        after.header = after.header || {}; after.header.revDate = FECHA;
        syncLegacyFmFields(after); syncFieldAliases(after);
        console.log(`\n${numero} (IP PAD): OP 90 -> 90-91 "${op.name ?? op.operationName}"`);
        plan.push({ id, amfeNumber: numero, productName: 'IP PAD Patagonia', before, after });
    }
}

if (!plan.length) { console.log('\nNada para hacer.'); process.exit(0); }
await runWithValidation(plan, apply, async () => {
    for (const p of plan) await saveAmfe(sb, p.id, p.after, { expectedAmfeNumber: p.amfeNumber });
});
finish(apply);
