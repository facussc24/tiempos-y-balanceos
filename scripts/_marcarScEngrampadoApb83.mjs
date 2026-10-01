/**
 * _marcarScEngrampadoApb83.mjs — marca SC las causas de la operacion 83 ENGRAMPADO del AMFE del
 * APB de puerta (AMFE-ARM-PAT, 161) que cumplen el criterio de caracteristica significativa.
 *
 *   node scripts/_marcarScEngrampadoApb83.mjs                                  # dry-run
 *   node scripts/_marcarScEngrampadoApb83.mjs --apply --allow-specialchar      # escribe
 *   (sin --allow-specialchar el candado de CC/SC de dryRunGuard frena el --apply: agregar una
 *   sigla pide el OK de Fak, que para este caso es la delegacion citada abajo)
 *
 * QUIEN LO DECIDIO: Fak, 01/10/2026 — "por ahora decidilo vos pero en base a evidencia contundente".
 * LA EVIDENCIA: instructivo I-AC-005 rev.B del SGC, tabla de caracteristicas especiales:
 *   "Caracteristica significativa. Severidad: 5 a 8. Ocurrencia: >= 4. CS" (la casa escribe SC).
 *   Fuente: Y:\BARACK\CALIDAD\DOCUMENTACION SGC\SISTEMA\SISTEMA SGC\Instructivos\CALIDAD\
 *           I-AC-005 Emision y control del AMFE y plan de control B.docx
 *   Precedente: el mismo elemento (engrampadora, S6 O6) lleva SC en el AMFE del Insert (OP 101).
 * La sigla sale de la S y la O de CADA causa; la de S=4 (arrugas) queda sin sigla.
 */
import { connectSupabase, listAmfes, readAmfe, saveAmfe, findOperation, syncLegacyFmFields, syncFieldAliases } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const NUMERO = 'AMFE-ARM-PAT';
const DETALLE_VIEJO = 'SE AGREGA LA OPERACION 83 ENGRAMPADO, DESPUES DEL TAPIZADO (80-82).';
const DETALLE_NUEVO = 'SE AGREGA LA OPERACION 83 ENGRAMPADO, DESPUES DEL TAPIZADO (80-82), CON SC EN LAS CAUSAS QUE CORRESPONDEN.';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const fila = (await listAmfes(sb)).filter(a => a.amfe_number === NUMERO);
if (fila.length !== 1) throw new Error(`${NUMERO}: esperaba 1 documento y hay ${fila.length}`);
const ID = fila[0].id;
const { doc: before } = await readAmfe(sb, ID);
const after = structuredClone(before);
const op = findOperation(after, '83');
if (!op) throw new Error('el AMFE no tiene la operacion 83');

let marcadas = 0;
for (const we of op.workElements || []) for (const fn of we.functions || []) for (const fm of fn.failures || []) {
    for (const c of fm.causes || []) {
        const S = Number(c.severity), O = Number(c.occurrence);
        const cumple = S >= 5 && S <= 8 && O >= 4;
        console.log(`  ${cumple ? 'SC' : '--'}  S${S} O${O}  ${fm.description} / ${c.cause}`);
        if (cumple && c.specialChar !== 'SC') { c.specialChar = 'SC'; marcadas++; }
    }
}
if (marcadas === 0) { console.log('Nada para marcar.'); process.exit(0); }
for (const r of after.revisions || []) if (r.details === DETALLE_VIEJO) r.details = DETALLE_NUEVO;

syncLegacyFmFields(after);
syncFieldAliases(after);
const plan = [{ id: ID, amfeNumber: NUMERO, productName: 'ARMREST DOOR PANEL Patagonia', before, after }];
await runWithValidation(plan, apply, async () => { await saveAmfe(sb, ID, after, { expectedAmfeNumber: NUMERO }); });
finish(apply);
