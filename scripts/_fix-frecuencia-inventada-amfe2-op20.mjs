/**
 * Fix: AMFE-2 OP20 detectionControl con frecuencia inventada "cada 50 piezas"
 * sin respaldo en procedimiento Barack.
 *
 * Decision Fak 2026-05-17: suena inventada. Reemplazo por referencia a P-09/I
 * (procedimiento oficial de control de proceso) — patron canonico Barack
 * (regla amfe-no-inventar-controles.md).
 *
 * Cambio:
 *   "Inspeccion visual de calidad de corte cada 50 piezas"
 *   -> "Autocontrol visual de calidad de corte segun P-09/I"
 *
 * NOTA: AMFE-2 OP70 tambien dice "cada 50 piezas" PERO tiene referencia
 * I-PY-001.7 explicita (documento oficial Barack) — eso NO es inventado,
 * se mantiene.
 *
 * Uso:
 *   node scripts/_fix-frecuencia-inventada-amfe2-op20.mjs           # dry-run
 *   node scripts/_fix-frecuencia-inventada-amfe2-op20.mjs --apply
 */
import { connectSupabase, listAmfes, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const all = await listAmfes(sb);
const meta = all.find(a => a.amfe_number === 'AMFE-2');
if (!meta) throw new Error('AMFE-2 not found');

const read = await readAmfe(sb, meta.id);
const before = read.doc;
const after = JSON.parse(JSON.stringify(before));

const op = after.operations.find(o => +(o.opNumber || o.operationNumber) === 20);
if (!op) throw new Error('OP20 not found in AMFE-2');

const PATRON_INVENTADO = /^Inspeccion\s+visual\s+de\s+calidad\s+de\s+corte\s+cada\s+50\s+piezas\.?$/i;
const NEW_TEXT = 'Autocontrol visual de calidad de corte según P-09/I';

let touched = 0;
for (const we of (op.workElements || [])) {
    for (const fn of (we.functions || [])) {
        for (const fl of (fn.failures || [])) {
            for (const c of (fl.causes || [])) {
                const v = c.detectionControl || '';
                if (!PATRON_INVENTADO.test(v.trim())) continue;
                c.detectionControl = NEW_TEXT;
                touched++;
                logChange(apply, `AMFE-2 OP20 causa "${(c.cause || '').slice(0, 50)}"`, { before: v, after: NEW_TEXT });
            }
        }
    }
}

console.log(`\nResumen: ${touched} causas tocadas.`);
if (touched === 0) { process.exit(0); }

const plan = [{
    id: meta.id,
    amfeNumber: meta.amfe_number,
    productName: read.row.project_name,
    before,
    after,
}];

await runWithValidation(plan, apply, async () => {
    await saveAmfe(sb, meta.id, after, { expectedAmfeNumber: 'AMFE-2' });
    console.log('✓ AMFE-2 actualizado.');
});

finish(apply);
process.exit(0);
