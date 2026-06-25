/**
 * Fix: AMFE 150 OP40 COSTURA UNION — Falla 6 ("Ancho de costura fuera tolerancia
 * 5±1mm Dobladillo") tiene 3 problemas:
 *
 * 1. La descripcion incluye parametro numerico (5±1mm) — Fak: parametros van en
 *    el Plan de Control, NO en el AMFE.
 * 2. detControl con "Inspeccion Humana (Visual y Medicion Manual)..." — Claude.
 * 3. prevControl con "Instruccion de Trabajo (IT) visual..." — Claude.
 *
 * Cambios:
 *   description: "Ancho de costura fuera de tolerancia 5 ± 1mm (Dobladillo)"
 *     -> "Ancho de costura fuera de tolerancia (Dobladillo)"
 *   detControl: "Inspeccion Humana (Visual y Medicion Manual)..."
 *     -> "Autocontrol con calibre o regla del ancho de costura"
 *   prevControl: "Instruccion de Trabajo (IT) visual..."
 *     -> "Guia fisica en maquina + set up de lanzamiento validado"
 *
 * Sesion soft-snacking-elephant 2026-05-17.
 *
 * Uso:
 *   node scripts/_fix-amfe150-op40-falla6-claude.mjs           # dry-run
 *   node scripts/_fix-amfe150-op40-falla6-claude.mjs --apply
 */
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

const AMFE_ID = '37cab669-0543-43c0-bb78-d00638114530';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const read = await readAmfe(sb, AMFE_ID);
if (read.amfe_number !== '150') throw new Error('AMFE number mismatch');

const before = read.doc;
const after = JSON.parse(JSON.stringify(before));

const op = after.operations.find(o => +(o.opNumber || o.operationNumber) === 40);
if (!op) throw new Error('OP40 not found');

const RE_FALLA6_DESC = /Ancho\s+de\s+costura\s+fuera\s+de\s+tolerancia\s+5\s*[±+\-\\/]?\s*1\s*mm\s*\(Dobladillo\s+y\s+costura\s+simple\)/i;
const NEW_DESC = 'Ancho de costura fuera de tolerancia (Dobladillo y costura simple)';
const NEW_DET = 'Autocontrol con calibre o regla del ancho de costura';
const NEW_PREV = 'Guía física en máquina + set up de lanzamiento validado';

const RE_DET_CLAUDE = /Inspecci[oó]n\s+Humana\s+\(Visual\s+y\s+Medici[oó]n\s+Manual\)/i;
const RE_PREV_CLAUDE = /Instrucci[oó]n\s+de\s+Trabajo\s+\(IT\)\s+visual\s+que\s+detalla\s+la\s+gu[ií]a\s+correcta/i;

let touched = 0;
for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
        for (const fl of (fn.failures || [])) {
            if (!RE_FALLA6_DESC.test(fl.description || '')) continue;
            const oldDesc = fl.description;
            fl.description = NEW_DESC;
            touched++;
            logChange(apply, `AMFE 150 OP40 falla6 description`, { before: oldDesc, after: NEW_DESC });

            for (const c of (fl.causes || [])) {
                if (RE_DET_CLAUDE.test(c.detectionControl || '')) {
                    const oldDet = c.detectionControl;
                    c.detectionControl = NEW_DET;
                    touched++;
                    logChange(apply, `AMFE 150 OP40 falla6 detControl`, { before: oldDet.slice(0, 70), after: NEW_DET });
                }
                if (RE_PREV_CLAUDE.test(c.preventionControl || '')) {
                    const oldPrev = c.preventionControl;
                    c.preventionControl = NEW_PREV;
                    touched++;
                    logChange(apply, `AMFE 150 OP40 falla6 prevControl`, { before: oldPrev.slice(0, 70), after: NEW_PREV });
                }
            }
        }
    }
}

console.log(`\nResumen: ${touched} cambios.`);
if (touched === 0) { process.exit(0); }

const plan = [{ id: AMFE_ID, amfeNumber: read.amfe_number, productName: read.row.project_name, before, after }];
await runWithValidation(plan, apply, async () => {
    await saveAmfe(sb, AMFE_ID, after, { expectedAmfeNumber: '150' });
    console.log('✓ AMFE 150 actualizado.');
});
finish(apply);
process.exit(0);
