/**
 * Fix: AMFE-1 (Telas Planas) OP70 PEGADO DE APLIX
 *
 * La funcion del Operador dice "Colocar dots/clips en posicion correcta con
 * cantidad correcta segun plano" — Telas Planas NO usa clips (regla pfd.md).
 * Se refuerza con APLIX y ganchos.
 *
 * Fix: cambiar "dots/clips" por "APLIX" en function.description Y functionDescription
 * (ambos aliases segun regla amfe.md schema).
 *
 * Uso:
 *   node scripts/_fix-telas-aplix-no-clips.mjs           # dry-run
 *   node scripts/_fix-telas-aplix-no-clips.mjs --apply
 */
import { connectSupabase, listAmfes, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const all = await listAmfes(sb);
const meta = all.find(a => a.amfe_number === 'AMFE-1');
if (!meta) throw new Error('AMFE-1 not found');

const read = await readAmfe(sb, meta.id);
const before = read.doc;
const after = JSON.parse(JSON.stringify(before));

const op = after.operations.find(o => +(o.opNumber || o.operationNumber) === 70);
if (!op) throw new Error('OP70 not found in AMFE-1');
if (!/PEGADO\s+DE\s+APLIX/i.test(op.name || op.operationName || '')) {
    throw new Error(`OP70 name is "${op.name || op.operationName}", expected PEGADO DE APLIX`);
}

let touched = 0;
for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
        const oldDesc = fn.description || fn.functionDescription || '';
        if (!/dots.*clips|clips.*dots/i.test(oldDesc)) continue;
        const newDesc = oldDesc.replace(/dots\s*\/\s*clips/gi, 'APLIX').replace(/clips\s*\/\s*dots/gi, 'APLIX');
        if (newDesc === oldDesc) continue;
        fn.description = newDesc;
        fn.functionDescription = newDesc;
        touched++;
        logChange(apply, `AMFE-1 OP70 WE="${we.name}" fn.description`, { before: oldDesc.slice(0, 80), after: newDesc.slice(0, 80) });
    }
}

console.log(`\nResumen: ${touched} funciones a tocar.`);
if (touched === 0) { console.log('Nada que cambiar.'); process.exit(0); }

const plan = [{
    id: meta.id,
    amfeNumber: meta.amfe_number,
    productName: read.row.project_name,
    before,
    after,
}];

await runWithValidation(plan, apply, async () => {
    await saveAmfe(sb, meta.id, after, { expectedAmfeNumber: 'AMFE-1' });
    console.log('✓ AMFE-1 actualizado.');
});

finish(apply);
process.exit(0);
