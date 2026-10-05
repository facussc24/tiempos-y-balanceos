/**
 * _scrapSeveridadApb161.mjs — en el AMFE del APB de puerta (AMFE-ARM-PAT, 161), toda falla cuyo efecto
 * dice SCRAP lleva S >= 7 (amfe.md §13, Tabla P1 del AIAG-VDA: S=6 para abajo son bandas de RETRABAJO;
 * scrap de una parte de la produccion = 7; el 100% de la produccion scrapeada = 8).
 *
 *   node scripts/_scrapSeveridadApb161.mjs            # dry-run: lista cada falla con su S vieja y nueva
 *   node scripts/_scrapSeveridadApb161.mjs --apply    # escribe (pasa por runWithValidation)
 *
 * POR QUE: lo marco el auditor del 05/10/2026 al revisar la OP 60 nueva (efecto "Scrap de la cinta" con
 * S=5) y encontro el mismo patron en otras fallas del 161. Fak, 05/10/2026: "si corregi todo".
 *
 * Que hace: la S de cada causa de esas fallas pasa a 7 (u 8 si un efecto dice que se scrapea el 100% de
 * la produccion), y el AP se recalcula con calculateAP. No toca O, D, controles ni siglas. Si una causa
 * tiene sigla, se informa: una SC sigue valida con S 7-8 y O >= 4 (caracteristicas-especiales.md).
 */
import { connectSupabase, listAmfes, readAmfe, saveAmfe, calculateAP, syncLegacyFmFields, syncFieldAliases } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const NUMERO = 'AMFE-ARM-PAT';
const FECHA = '05/10/2026';
const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const fila = (await listAmfes(sb)).filter(a => a.amfe_number === NUMERO);
if (fila.length !== 1) throw new Error(`${NUMERO}: esperaba 1 documento y hay ${fila.length}`);
const ID = fila[0].id;
const { doc: before, amfe_number } = await readAmfe(sb, ID);
if (amfe_number !== NUMERO) throw new Error(`esperaba ${NUMERO} y lei ${amfe_number}`);
const after = structuredClone(before);

const SCRAP = /scrap/i;
const TODO = /100\s*%\s*de la produccion|100% de la producci[oó]n/i;
const ops = new Set();
let n = 0;
for (const op of after.operations) {
    for (const we of op.workElements ?? []) {
        for (const fn of we.functions ?? []) {
            for (const fm of fn.failures ?? []) {
                const efectos = [fm.effectLocal, fm.effectNextLevel, fm.effectEndUser].join(' / ');
                if (!SCRAP.test(efectos)) continue;
                // la S que manda es la del modo de falla (el validador la toma de ahi)
                const sMax = Math.max(Number(fm.severity) || 0, ...(fm.causes ?? []).map(c => Number(c.severity) || 0));
                if (sMax > 6) continue;
                const nueva = TODO.test(efectos) ? 8 : 7;
                n++;
                ops.add(String(op.opNumber));
                console.log(`OP ${op.opNumber} | ${fm.description}\n   efectos: ${efectos}`);
                fm.severity = nueva;
                for (const c of fm.causes ?? []) {
                    const ap = calculateAP(nueva, Number(c.occurrence), Number(c.detection));
                    console.log(`   causa: ${c.cause} | S${c.severity} -> S${nueva} | O${c.occurrence} D${c.detection} | AP ${c.ap} -> ${ap}${c.specialChar ? ' | sigla ' + c.specialChar : ''}`);
                    c.severity = nueva;
                    c.ap = c.actionPriority = ap;
                }
            }
        }
    }
}
console.log(`\n${n} fallas en las OP ${[...ops].join(', ')}`);
if (!n) { console.log('Nada para hacer.'); process.exit(0); }

const item = [...ops].join(' / ');
after.revisions = Array.isArray(after.revisions) ? after.revisions : [];
after.revisions.push({ rev: 'A', date: FECHA, item,
    details: 'SE RECALIFICA LA SEVERIDAD DE LAS FALLAS CUYO EFECTO ES SCRAP A S=7 (S=8 SI SE SCRAPEA EL 100% DE LA PRODUCCION), SEGUN LA TABLA P1 DEL AIAG-VDA. AP RECALCULADO.',
    pswDate: '', modifiedBy: 'FS' });
after.header = after.header || {};
after.header.revDate = FECHA;

syncLegacyFmFields(after);
syncFieldAliases(after);
const plan = [{ id: ID, amfeNumber: NUMERO, productName: 'ARMREST DOOR PANEL Patagonia', before, after }];
await runWithValidation(plan, apply, async () => {
    await saveAmfe(sb, ID, after, { expectedAmfeNumber: NUMERO });
});
finish(apply);
