/**
 * Fix: HRC-PAT OP25 + HRO-PAT OP25 (CONTROL CON PLANTILLA MYLAR) vacias.
 *
 * Reusar el contenido completo de AMFE-2 OP25 (CONTROL CON MYLAR) — 3 WEs:
 *   - Measurement "Mylar de control"
 *   - Method "Procedimiento de control dimensional"
 *   - Man "Operador de control"
 *
 * Transformacion: "Operador de control" -> "Operador de produccion" (Barack
 * usa Operador de produccion como rol estandar de control en proceso).
 *
 * Tambien copia operationFunction de AMFE-2 OP25. focusElementFunction NO
 * se copia de AMFE-2 (es del producto Telas Termoformadas) — se toma de otra
 * OP del mismo Headrest (invariante por producto, regla amfe.md).
 *
 * Uso:
 *   node scripts/_fix-hrc-hro-mylar-from-amfe2.mjs           # dry-run
 *   node scripts/_fix-hrc-hro-mylar-from-amfe2.mjs --apply
 */
import { connectSupabase, listAmfes, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

const TARGETS = ['AMFE-HRC-PAT', 'AMFE-HRO-PAT'];
const SOURCE_AMFE = 'AMFE-2';
const SOURCE_OP_NUM = 25;
const TARGET_OP_NUM = 25;

function transformOperator(text) {
    if (!text) return text;
    return String(text).replace(/Operador\s+de\s+control/gi, 'Operador de produccion');
}

function deepTransformWE(we) {
    const out = JSON.parse(JSON.stringify(we));
    out.name = transformOperator(out.name);
    for (const fn of (out.functions || [])) {
        if (fn.description) fn.description = transformOperator(fn.description);
        if (fn.functionDescription) fn.functionDescription = transformOperator(fn.functionDescription);
        for (const fl of (fn.failures || [])) {
            // failures no suelen mencionar el rol — pero por las dudas
            if (fl.description) fl.description = transformOperator(fl.description);
            for (const c of (fl.causes || [])) {
                if (c.cause) c.cause = transformOperator(c.cause);
                if (c.description) c.description = transformOperator(c.description);
                if (c.preventionControl) c.preventionControl = transformOperator(c.preventionControl);
                if (c.detectionControl) c.detectionControl = transformOperator(c.detectionControl);
            }
        }
    }
    return out;
}

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const all = await listAmfes(sb);
const byNumber = Object.fromEntries(all.map(a => [a.amfe_number, a]));

// Load source
const srcMeta = byNumber[SOURCE_AMFE];
if (!srcMeta) throw new Error(`Source AMFE not found: ${SOURCE_AMFE}`);
const src = await readAmfe(sb, srcMeta.id);
const srcOp = src.doc.operations.find(o => +(o.opNumber || o.operationNumber) === SOURCE_OP_NUM);
if (!srcOp) throw new Error(`Source OP${SOURCE_OP_NUM} not found in ${SOURCE_AMFE}`);
if ((srcOp.workElements || []).length === 0) throw new Error(`Source OP has 0 WEs`);

console.log(`Source: ${SOURCE_AMFE} OP${SOURCE_OP_NUM} "${srcOp.name || srcOp.operationName}" — ${srcOp.workElements.length} WEs`);

const plan = [];
for (const tgtNumber of TARGETS) {
    const tgtMeta = byNumber[tgtNumber];
    if (!tgtMeta) { console.warn(`SKIP ${tgtNumber} — no encontrado`); continue; }
    const tgt = await readAmfe(sb, tgtMeta.id);
    const before = tgt.doc;
    const after = JSON.parse(JSON.stringify(before));

    const tgtOp = after.operations.find(o => +(o.opNumber || o.operationNumber) === TARGET_OP_NUM);
    if (!tgtOp) { console.warn(`SKIP ${tgtNumber} OP${TARGET_OP_NUM} no existe`); continue; }
    if ((tgtOp.workElements || []).length > 0) {
        console.warn(`SKIP ${tgtNumber} OP${TARGET_OP_NUM} ya tiene WEs (${tgtOp.workElements.length}) — no sobrescribo`);
        continue;
    }

    // Buscar focusElementFunction de otra OP del mismo AMFE (invariante por producto)
    const refOp = after.operations.find(o =>
        o !== tgtOp &&
        o.focusElementFunction &&
        String(o.focusElementFunction).trim() !== ''
    );
    const focusFunc = refOp ? refOp.focusElementFunction : '';

    // Aplicar copia
    tgtOp.workElements = (srcOp.workElements || []).map(deepTransformWE);
    tgtOp.operationFunction = srcOp.operationFunction || '';
    if (!tgtOp.focusElementFunction || String(tgtOp.focusElementFunction).trim() === '') {
        tgtOp.focusElementFunction = focusFunc;
    }

    logChange(apply,
        `${tgtNumber} OP${TARGET_OP_NUM} "${tgtOp.name || tgtOp.operationName}" <- ${SOURCE_AMFE} OP${SOURCE_OP_NUM}`,
        {
            wes: `${tgtOp.workElements.length} WEs copiados`,
            opFunc: (tgtOp.operationFunction || '').slice(0, 70),
            focusFunc: refOp ? `copiado de OP${refOp.opNumber || refOp.operationNumber}` : '(no encontrado)',
        }
    );

    plan.push({
        id: tgtMeta.id,
        amfeNumber: tgtMeta.amfe_number,
        productName: tgt.row.project_name,
        before,
        after,
    });
}

console.log(`\nResumen: ${plan.length} AMFEs con cambios.`);
if (plan.length === 0) { process.exit(0); }

await runWithValidation(plan, apply, async () => {
    for (const p of plan) {
        await saveAmfe(sb, p.id, p.after, { expectedAmfeNumber: p.amfeNumber });
        console.log(`  ✓ ${p.amfeNumber} actualizado.`);
    }
});

finish(apply);
process.exit(0);
