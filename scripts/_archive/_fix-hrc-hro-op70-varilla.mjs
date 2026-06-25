/**
 * Fix: HRC-PAT OP70 + HRO-PAT OP70 INSERCION DE VARILLA tienen falla mal
 * copiada desde EMBALAJE ("Colocación de mayor o menor cantidad de piezas
 * por medio") en vez de la falla correcta de inserción.
 *
 * Sesion soft-snacking-elephant M-review 2026-05-17.
 *
 * Reusar de HF-PAT OP51 INSERCION DE VARILLA (donde la falla esta correcta):
 *   - operationFunction: "Insertar varilla en funda asegurando vinilo como
 *     reten para evitar fuga PU"
 *   - failure[0].description: "2- Varilla desalineada"
 *   - cause[0].cause: "Colocación incorrecta por parte del operador"
 *   - cause[0].severity/occurrence/detection: 7/4/5 (HF-PAT actual)
 *   - cause[0].ap/actionPriority: M (recalculado con calculateAP)
 *
 * NOTA: effectLocal/NextLevel/EndUser NO se tocan (HRC/HRO tienen
 * "Cliente Interno-Barack"/"Cliente Externo"/"TBD" — esos textos son
 * incorrectos VDA pero arreglarlos es otro fix separado, no tocamos aca).
 *
 * Uso:
 *   node scripts/_fix-hrc-hro-op70-varilla.mjs           # dry-run
 *   node scripts/_fix-hrc-hro-op70-varilla.mjs --apply
 */
import { connectSupabase, listAmfes, readAmfe, saveAmfe, calculateAP } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

const TARGETS = ['AMFE-HRC-PAT', 'AMFE-HRO-PAT'];
const NEW_OP_FUNCTION = 'Insertar varilla en funda asegurando vinilo como retén para evitar fuga PU';
const NEW_FAILURE_DESC = '2- Varilla desalineada';
const NEW_CAUSE_TEXT = 'Colocación incorrecta por parte del operador';
const NEW_S = 7;
const NEW_O = 4;
const NEW_D = 5;
const NEW_AP = calculateAP(NEW_S, NEW_O, NEW_D);

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const all = await listAmfes(sb);
const byNumber = Object.fromEntries(all.map(a => [a.amfe_number, a]));

console.log(`AP calculado para S=${NEW_S} O=${NEW_O} D=${NEW_D}: ${NEW_AP}`);

const plan = [];
for (const tgtNumber of TARGETS) {
    const meta = byNumber[tgtNumber];
    if (!meta) { console.warn(`SKIP ${tgtNumber} — no encontrado`); continue; }
    const read = await readAmfe(sb, meta.id);
    const before = read.doc;
    const after = JSON.parse(JSON.stringify(before));

    const op = after.operations.find(o => +(o.opNumber || o.operationNumber) === 70);
    if (!op) { console.warn(`SKIP ${tgtNumber} OP70 no existe`); continue; }
    if (!/INSERCION\s+DE\s+VARILLA/i.test(op.name || op.operationName || '')) {
        console.warn(`SKIP ${tgtNumber} OP70 name no es "INSERCION DE VARILLA" ("${op.name || op.operationName}")`);
        continue;
    }

    // 1. operationFunction
    const oldOpFunc = op.operationFunction || '';
    if (!oldOpFunc.trim()) {
        op.operationFunction = NEW_OP_FUNCTION;
    }

    // 2. Buscar y arreglar el failure mal copiado
    let touched = 0;
    for (const we of (op.workElements || [])) {
        for (const fn of (we.functions || [])) {
            for (const fl of (fn.failures || [])) {
                if (!/colocaci[oó]n\s+de\s+mayor\s+o\s+menor\s+cantidad/i.test(fl.description || '')) continue;
                const oldDesc = fl.description;
                fl.description = NEW_FAILURE_DESC;
                // Arreglar causa
                for (const c of (fl.causes || [])) {
                    const oldS = c.severity;
                    const oldAp = c.ap || c.actionPriority;
                    const oldCause = c.cause || c.description || '';
                    if (/falta\s+de\s+control\s+en\s+la\s+cantidad/i.test(oldCause)) {
                        c.cause = NEW_CAUSE_TEXT;
                        c.description = NEW_CAUSE_TEXT;
                        c.severity = NEW_S;
                        c.occurrence = NEW_O;
                        c.detection = NEW_D;
                        c.ap = NEW_AP;
                        c.actionPriority = NEW_AP;
                        touched++;
                        logChange(apply,
                            `${tgtNumber} OP70 INSERCION DE VARILLA`,
                            {
                                fail_old: oldDesc.slice(0, 60),
                                fail_new: NEW_FAILURE_DESC,
                                cause_old: oldCause.slice(0, 60),
                                cause_new: NEW_CAUSE_TEXT,
                                SOD: `${oldS}/${c.occurrence}/${c.detection} -> ${NEW_S}/${NEW_O}/${NEW_D}`,
                                AP: `${oldAp} -> ${NEW_AP}`,
                            }
                        );
                    }
                }
            }
        }
    }

    if (touched > 0) {
        plan.push({
            id: meta.id,
            amfeNumber: meta.amfe_number,
            productName: read.row.project_name,
            before,
            after,
        });
    } else {
        console.warn(`SKIP ${tgtNumber} — no se encontro la falla esperada para arreglar`);
    }
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
