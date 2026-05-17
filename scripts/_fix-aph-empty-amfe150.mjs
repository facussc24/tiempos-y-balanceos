/**
 * Fix: AMFE 150 (Armrest Rear Center) tiene 9 causas con AP=H y acción totalmente vacía.
 *
 * Regla `amfe-aph-pending.md` autoriza llenar `optimizationAction` con
 * "Pendiente definición equipo APQP" automáticamente como placeholder válido.
 *
 * Detector D-APH (subcheck=sin-accion) en sesión 2026-05-17 reportó los 9 paths.
 * Backup previo: backups/2026-05-17T18-27-21/
 *
 * Uso:
 *   node scripts/_fix-aph-empty-amfe150.mjs            # dry-run (default)
 *   node scripts/_fix-aph-empty-amfe150.mjs --apply    # ejecuta
 */
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

const AMFE_ID = '37cab669-0543-43c0-bb78-d00638114530';
const EXPECTED_NUMBER = '150';
const PLACEHOLDER = 'Pendiente definición equipo APQP';

// 9 paths reportados por detector D-APH (sesión 2026-05-17)
// Formato: [opIdx, weIdx, fnIdx, failureIdx, causeIdx]
const PATHS = [
    [0, 0, 0, 0, 0], // OP10 Recepcion / Autoelevador / golpeada / Mala estiba
    [0, 0, 0, 0, 1], // OP10 Recepcion / Autoelevador / golpeada / Manipulacion incorrecta
    [0, 0, 0, 1, 0], // OP10 Recepcion / Autoelevador / contaminacion / Almacenaje sin protecciones
    [0, 0, 0, 1, 2], // OP10 Recepcion / Autoelevador / contaminacion / Falta inspeccion al llegar
    [0, 4, 0, 0, 1], // OP10 Recepcion / Materia prima / spec erronea / Falta control dimensional
    [0, 4, 0, 0, 2], // OP10 Recepcion / Materia prima / spec erronea / Proveedor no respeta tolerancias
    [0, 6, 0, 0, 2], // OP10 Recepcion / Procedimiento P-14 / trazabilidad / No usa ARB
    [1, 0, 0, 0, 0], // OP20 Corte / Operador / desviacion / Parametros mal ingresados
    [1, 0, 0, 0, 1], // OP20 Corte / Operador / desviacion / Maquina desajustada
];

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const read = await readAmfe(sb, AMFE_ID);
if (read.amfe_number !== EXPECTED_NUMBER) {
    throw new Error(`AMFE number mismatch: expected ${EXPECTED_NUMBER}, got ${read.amfe_number}`);
}

const before = read.doc;
const after = JSON.parse(JSON.stringify(before));

let touched = 0;
let skipped = 0;
for (const [o, w, f, fl, c] of PATHS) {
    const op = after.operations?.[o];
    const we = op?.workElements?.[w];
    const fn = we?.functions?.[f];
    const failure = fn?.failures?.[fl];
    const cause = failure?.causes?.[c];

    if (!cause) {
        console.warn(`  SKIP [${o},${w},${f},${fl},${c}] — path no existe`);
        skipped++;
        continue;
    }

    const ap = cause.ap || cause.actionPriority;
    if (ap !== 'H') {
        console.warn(`  SKIP [${o},${w},${f},${fl},${c}] — AP=${ap} (no es H)`);
        skipped++;
        continue;
    }

    const optAct = (cause.optimizationAction || '').trim();
    const prevAct = (cause.preventionAction || '').trim();
    const detAct = (cause.detectionAction || '').trim();
    if (optAct || prevAct || detAct) {
        console.warn(`  SKIP [${o},${w},${f},${fl},${c}] — ya tiene acción definida`);
        skipped++;
        continue;
    }

    cause.optimizationAction = PLACEHOLDER;
    touched++;

    const causeText = (cause.cause || cause.description || '(sin texto)').slice(0, 60);
    logChange(apply,
        `${read.amfe_number} op${op.opNumber || op.operationNumber} ${op.name || op.operationName} | WE=${we.name} | causa "${causeText}"`,
        { optimizationAction: PLACEHOLDER }
    );
}

console.log(`\nResumen: ${touched} causas a tocar, ${skipped} saltadas.`);

if (touched === 0) {
    console.log('Nada que cambiar. Saliendo.');
    process.exit(0);
}

const plan = [{
    id: AMFE_ID,
    amfeNumber: read.amfe_number,
    productName: read.row.project_name,
    before,
    after,
}];

await runWithValidation(plan, apply, async () => {
    await saveAmfe(sb, AMFE_ID, after, { expectedAmfeNumber: EXPECTED_NUMBER });
    console.log('✓ AMFE 150 actualizado en Supabase.');
});

finish(apply);
process.exit(0);
